import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoomStore, OWNER_GRACE_MS } from '../server/store.js';
import { choosePublicStrategy } from '../public/ai-worker.js';
import { aiActions } from '../server/ai-players.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url)));

function fixture(t) {
  const dataDir = mkdtempSync(join(tmpdir(), 'rocket-ai-'));
  let time = 100_000;
  let sequence = 0;
  const timers = new Map();
  const options = { dataDir, catalogue, now: () => time, scheduleAi(callback, delay) {
    const id = ++sequence;
    timers.set(id, { callback, at: time + delay });
    return id;
  }, cancelAi(id) { timers.delete(id); } };
  let store = new RoomStore(options);
  const owner = store.create({ nickname: 'Host' });
  let actionId = 0;
  const room = () => store.rooms.get(owner.code);
  const get = (seat = owner) => store.view(owner.code, seat.token).view;
  const act = (type, fields = {}, seat = owner, revision = room().revision) => store.action(owner.code, seat.token, {
    id: 'action-' + (++actionId), revision, type, ...fields,
  }).view;
  const tick = () => {
    const entry = timers.entries().next().value;
    assert.ok(entry, 'expected one scheduled AI action');
    assert.equal(timers.size, 1);
    const [id, { callback, at }] = entry;
    timers.delete(id);
    time = Math.max(time, at);
    callback();
  };
  const flushUntil = (condition) => {
    for (let i = 0; i < 50 && !condition(); i++) tick();
    assert.ok(condition());
  };
  t.after(() => { store.stopAi(); rmSync(dataDir, { recursive: true, force: true }); });
  return {
    get store() { return store; }, owner, room, get, act, tick, flushUntil, timers,
    get nextAiDelay() { return timers.values().next().value?.at - time; },
    join: (name, spectator = false) => store.join(owner.code, { nickname: name, spectator }),
    restart() { store.stopAi(); store = new RoomStore(options); },
    elapse(ms) { time += ms; },
  };
}

test('owner inserts AI in any open seat and sets each difficulty in a six-seat mixed lobby', t => {
  const f = fixture(t);
  const guest = f.join('Guest');
  const observer = f.join('Observer', true);
  assert.throws(() => f.act('addAi', { seatNumber: 6 }, guest), { code: 'OWNER_ONLY' });
  const before = f.room().revision;
  const view = f.act('addAi', { seatNumber: 6 });
  const ai = view.players.find(player => player.ai);
  assert.deepEqual([ai.seatNumber, ai.aiDifficulty, ai.ready, ai.connected], [6, 'normal', true, true]);
  assert.equal(f.room().players.find(player => player.ai).tokenHash, undefined);
  assert.throws(() => f.act('chooseSeat', { seatNumber: 6 }, guest, before), { code: 'SEAT_TAKEN' });
  assert.throws(() => f.act('addAi', { seatNumber: 6 }), { code: 'SEAT_TAKEN' });
  assert.throws(() => f.act('setAiDifficulty', { playerId: ai.id, difficulty: 'expert' }), { code: 'INVALID_AI_DIFFICULTY' });
  assert.throws(() => f.act('setAiDifficulty', { playerId: ai.id, difficulty: 'easy' }, guest), { code: 'OWNER_ONLY' });
  f.act('setAiDifficulty', { playerId: ai.id, difficulty: 'hard' });
  f.act('removeAi', { playerId: ai.id });
  for (const seatNumber of [3, 4, 5, 6]) f.act('addAi', { seatNumber });
  assert.throws(() => f.join('Seventh'), { code: 'ROOM_FULL' });
  assert.equal(f.get(observer).players.filter(player => player.ai).length, 4);
  f.act('ready', { ready: true });
  f.act('ready', { ready: true }, guest);
  f.act('startBattlePreview');
  assert.throws(() => f.act('removeAi', { playerId: f.room().players.find(player => player.ai).id }), { code: 'WRONG_PHASE' });
  const vote = f.act('requestEndGame').pendingVote;
  assert.deepEqual(new Set(vote.requiredIds), new Set([f.owner.playerId, guest.playerId]));
  assert.equal(f.timers.size, 0);
  assert.equal(f.act('approveEnd', {}, guest).players.filter(player => player.ai && player.ready).length, 4);
});

function startSolo(f, count = 2) {
  for (let i = 0; i < count; i++) f.act('addAi', { seatNumber: i + 2 });
  f.act('ready', { ready: true });
  f.act('startBattlePreview');
  f.act('acknowledgeIdentity');
  f.flushUntil(() => f.room().status === 'setup');
  for (let i = 0; i < 5; i++) f.act('drawPokemon');
  const [activeId, reserveId] = f.get().self.candidates;
  f.act('selectPokemon', { activeId, reserveId });
  f.flushUntil(() => f.room().status === 'playing');
}

test('one human can start with five computers and each selects privately', t => {
  const f = fixture(t);
  const observer = f.join('Observer', true);
  startSolo(f, 5);
  const view = f.get(observer);
  assert.equal(view.players.filter(player => player.ai && player.setupComplete).length, 5);
  assert.equal(view.players.filter(player => player.role === 'leader').length, 1);
  assert.ok(view.players.every(player => player.hand === undefined && player.reserve === undefined));
  assert.equal(view.aiTask, undefined);
});

test('pending tasks recover after restart and only owner may submit a public suggestion once', t => {
  const f = fixture(t);
  const observer = f.join('Observer', true);
  startSolo(f);
  // At most one human turn needs to pass before an AI turn in this three-seat room.
  const human = f.room().players.find(player => player.id === f.owner.playerId);
  const ai = f.room().players.find(player => player.ai);
  const room = f.room();
  room.pendingBattle = null;
  delete room.turnStart;
  room.turn = { playerId: ai.id, number: 2, phase: 'play', drawRemaining: 0, clock: null };
  room.revision++;
  f.store.persist(room);
  f.restart();
  const { aiTask: task } = f.get();
  assert.ok(task);
  assert.equal(task.actorId, ai.id);
  assert.equal(f.timers.size, 1);
  assert.ok(task.players.every(player => Object.keys(player).every(key =>
    ['id', 'role', 'eliminated', 'active', 'handCount', 'hasReserve'].includes(key))));
  assert.equal(task.players.find(player => player.id === human.id).hand, undefined);
  assert.equal(task.players.find(player => player.id === ai.id).role, ai.role === 'leader' ? 'leader' : null);
  assert.equal(f.get(observer).aiTask, undefined);
  const { id, revision, turnNumber, decisionId } = task;
  const payload = { id, revision, turnNumber, decisionId, targetIds: [human.id], focus: 'attack' };
  const suggest = (data = payload, seat = f.owner) => f.store.suggestAi(f.owner.code, seat.token, data);
  assert.throws(() => suggest(payload, observer), { code: 'OWNER_ONLY' });
  assert.throws(() => suggest({ ...payload, targetIds:[ai.id] }), { code: 'INVALID_AI_STRATEGY' });
  assert.throws(() => suggest({ ...payload, turnNumber: 1 }), { code: 'STALE_AI_TASK' });
  assert.throws(() => suggest({ ...payload, cardId: 'private-id' }), { code: 'INVALID_INPUT' });
  assert.deepEqual(suggest(), { accepted: true });
  assert.deepEqual(suggest(), { accepted: true });
  f.tick();
  assert.equal(f.room().revision, revision + 1);
  assert.throws(() => suggest(), { code: 'STALE_AI_TASK' });
});

test('owner transfer skips AI even if the bot seat precedes a connected human', t => {
  const f = fixture(t);
  f.act('addAi', { seatNumber: 2 });
  const next = f.join('New host');
  f.elapse(OWNER_GRACE_MS + 1);
  assert.equal(f.get(next).ownerId, next.playerId);
  f.act('addAi', { seatNumber: 5 }, next);
  assert.throws(() => f.act('removeAi', { playerId: f.room().players.find(player => player.ai).id }), { code: 'OWNER_ONLY' });
});

test('the three difficulties change tactics while discard and end remain legal', () => {
  const creature = catalogue.entries.find(entry => entry.id === 'snorlax');
  const actor = { id: 'bot', ai: true, role: 'rocket', hand: [], active: { catalogueId: creature.id, level: 1, damage: 4, reinforcements: [] }, reserve: { catalogueId: creature.id, level: 1, damage: 0 } };
  const room = { status: 'playing', gameMode: 'combat-preview', players: [actor], turn: { playerId: actor.id, phase: 'play' } };
  assert.equal(aiActions(room, { ...actor, aiDifficulty: 'easy' }, catalogue)[0].type, 'finishPlay');
  assert.equal(aiActions(room, { ...actor, aiDifficulty: 'normal' }, catalogue)[0].type, 'switchPokemon');
  assert.equal(aiActions(room, { ...actor, aiDifficulty: 'hard' }, catalogue)[0].type, 'switchPokemon');
});

test('one human and one AI can play a practice duel while a two-human room requires a third trainer', t => {
  const twoHumans = fixture(t);
  const guest = twoHumans.join('Guest');
  twoHumans.act('ready', { ready: true });
  twoHumans.act('ready', { ready: true }, guest);
  assert.throws(() => twoHumans.act('startBattlePreview'), { code: 'NOT_READY' });

  const duel = fixture(t);
  startSolo(duel, 1);
  assert.equal(duel.room().scenario.practiceDuel, true);
  assert.equal(duel.room().scenario.deckCardCount, 108);
  assert.deepEqual(new Set(duel.room().players.map(player => player.role)), new Set(['leader', 'rocket']));
});

function tacticalRoom(source, targets, hand) {
  const creature = ({ id, family, level = 1, damage = 0, status = null, reinforcements = [], ...other }) =>
    ({ catalogueId: family, instanceId: id, level, damage, status, reinforcements, ...other });
  const actor = {
    id: 'actor', ai: true, aiDifficulty: 'hard', role: 'challenger',
    active: creature({ id: 'active', ...source }), hand,
  };
  const enemies = targets.map(({ role, reserve, ...face }, index) => ({
    id: 'enemy-' + index, role, identityAcknowledged: role === 'leader', hand: [{ id: 'unknown-card-' + index }],
    active: creature({ id: 'target-' + index, ...face }),
    ...(reserve ? { reserve: creature({ id: 'reserve-' + index, ...reserve }) } : {}),
  }));
  const room = {
    gameMode: 'combat-preview', status: 'playing', players: [actor, ...enemies],
    turn: { playerId: actor.id, phase: 'play', number: 1, drawRemaining: 0 },
    drawPile: [], discardPile: [],
  };
  return { room, actor, next: () => aiActions(room, actor, catalogue)[0] };
}

const command = { id: 'command', kind: 'command', weather: 'clear' };

test('AI uses real damage to finish an exposed enemy instead of wasting Power on Defense or immunity', () => {
  const { room, actor, next } = tacticalRoom({ family: 'pikachu', level: 2, reinforcements: ['power'] }, [
    { family: 'snorlax', level: 1, damage: 2, reinforcements: ['defense'], role: 'leader' },
    { family: 'snorlax', level: 1, damage: 1, role: 'rocket' },
  ], [command]);
  assert.deepEqual(next(), { type: 'attack', moveIndex: 0, targetIds: ['enemy-1'], cardId: 'command' });
  room.turn.damageImmunityIds = ['target-1'];
  assert.deepEqual(next().targetIds, ['enemy-0']);
  room.turn.damageImmunityIds.push('target-0');
  assert.equal(next().type, 'finishPlay');
  assert.deepEqual(actor.active.reinforcements, ['power']);
});

test('Hard Hyper Beam pays a spare card only when the boost changes the knockout', () => {
  const { room, actor, next } = tacticalRoom({ family: 'aerodactyl', level: 3 }, [
    { family: 'snorlax', level: 1, role: 'leader' },
  ], [command, { id: 'spare', kind: 'event', weather: 'rain' }]);
  assert.equal(next().boostCardId, 'spare');
  actor.aiDifficulty = 'normal';
  assert.equal(next().boostCardId, undefined);
  actor.aiDifficulty = 'hard';
  room.players[1].active.damage = 1;
  assert.equal(next().boostCardId, undefined);
  room.players[1].active.reinforcements.push('defense');
  assert.equal(next().boostCardId, undefined);
});

test('Porygon sets up Lock-On when it can follow with a command, and preserves a lone command', () => {
  const { actor, next } = tacticalRoom({ family: 'porygon', level: 3 }, [
    { family: 'snorlax', level: 2, role: 'leader' },
  ], [command, { id: 'setup', kind: 'held-item', itemType: 'light-ball', weather: 'clear' }]);
  assert.deepEqual(next(), { type: 'attack', moveIndex: 1, targetIds: ['enemy-0'], cardId: 'setup' });
  actor.hand.pop();
  assert.deepEqual(next(), { type: 'attack', moveIndex: 0, targetIds: ['enemy-0'], cardId: 'command' });
});

test('AI selects valuable exposed Berry Harvest cards and keeps Dodge when a protected hit does no damage', () => {
  const { room, actor, next } = tacticalRoom({ family: 'pikachu', level: 2 }, [
    { family: 'snorlax', level: 2, role: 'leader' },
  ], [{ id: 'dodge', kind: 'dodge', weather: 'rain' }]);
  room.resolution = { kind: 'event', berryCards: [{ kind: 'held-item' }, { kind: 'command' }] };
  room.pendingBattle = { kind: 'berry-pick', id: 'berries', actorId: actor.id, targetId: actor.id };
  assert.equal(next().handIndex, 1);

  room.resolution = { kind: 'move', sourcePlayerId: 'enemy-0', baseDamage: 2, powerBoost: 0 };
  room.pendingBattle = { kind: 'defense', id: 'defense', actorId: actor.id, targetId: actor.id };
  assert.equal(next().choice, 'dodge');
  room.turn.damageImmunityIds = ['active'];
  assert.equal(next().choice, 'pass');
});

test('AI pays the minimum Shed Skin discard that survives a hit', () => {
  const spare = { id: 'spare', kind: 'event' };
  const dodge = { id: 'dodge', kind: 'dodge' };
  const { room, actor, next } = tacticalRoom({ family: 'caterpie', level: 2 }, [], [command, spare, dodge]);
  room.pendingBattle = { kind: 'shed-skin', id: 'shed', actorId: actor.id, targetId: actor.id, damage: catalogue.entries.find(entry => entry.id === 'caterpie').levels[1].hp };
  assert.deepEqual(next(), { type: 'respondBattle', decisionId: 'shed', choice: 'shed', cardIds: ['spare'] });
});

test('AI equips Leftovers on the active partner and avoids replacing it with a weaker item', () => {
  const leftovers = { id: 'leftovers', kind: 'held-item', itemType: 'leftovers', weather: 'clear' };
  const helmet = { id: 'helmet', kind: 'held-item', itemType: 'rocky-helmet', weather: 'clear' };
  const { actor, next } = tacticalRoom({ family: 'pikachu', level: 2 }, [
    { family: 'snorlax', level: 1, role: 'leader' },
  ], [helmet, leftovers]);
  assert.deepEqual(next(), { type: 'equipItem', cardId: 'leftovers', slot: 'active' });
  actor.hand.pop();
  actor.active.item = leftovers;
  assert.equal(next().type, 'finishPlay');
});

test('AI uses Split Potion to survive an exposed turn when it has no finishing attack', () => {
  const potion = { id: 'potion', kind: 'tool', toolType: 'potion-full-heal', weather: 'rain' };
  const { next } = tacticalRoom({ family: 'pikachu', level: 3, damage: 3 }, [
    { family: 'snorlax', level: 2, role: 'leader' },
  ], [potion, command]);
  assert.deepEqual(next(), { type: 'useTool', cardId: 'potion', effect: 'potion', targetId: 'actor', slot: 'active' });
});

test('AI catches a useful Articuno window while holding protection during a beneficial event', () => {
  const protect = { id: 'protect', kind: 'event', eventType: 'articuno-protection', weather: 'clear' };
  const { room, actor, next } = tacticalRoom({ family: 'snorlax', level: 2 }, [], [protect]);
  room.resolution = { kind: 'event', eventType: 'mewtwo-threat' };
  room.pendingBattle = { kind: 'articuno', mode: 'cancel-event', id: 'shield', actorId: actor.id, targetId: actor.id };
  assert.deepEqual(next(), { type: 'respondBattle', decisionId: 'shield', choice: 'protect', cardId: 'protect' });
  room.resolution.eventType = 'mew-blessing';
  assert.equal(next().choice, 'pass');
});

test('scheduled AI actions execute Lock-On then damage a trainer holding a Dodge', t => {
  const f = fixture(t);
  startSolo(f);
  const room = f.room();
  const actor = room.players.find(player => player.ai);
  const target = room.players.find(player => player.id === f.owner.playerId);
  const partner = (instanceId, catalogueId, level) => ({
    instanceId, catalogueId, level, revealed: true, defeated: false, damage: 0, status: null, reinforcements: [],
  });
  actor.role = 'challenger';
  target.role = 'leader';
  const other = room.players.find(player => player.id !== actor.id && player.id !== target.id);
  other.role = 'challenger';
  other.identityPublic = true;
  actor.active = partner('porygon', 'porygon', 3);
  actor.hand = [command, { id: 'weather', kind: 'held-item', itemType: 'light-ball', weather: 'clear' }];
  target.active = partner('snorlax', 'snorlax', 2);
  target.hand = [{ id: 'dodge', kind: 'dodge', weather: 'rain' }];
  Object.assign(room.turn, {
    playerId: actor.id, phase: 'play', drawRemaining: 0, drawStarted: true, usedMoves: [],
    number: 2, commandCreatureId: null, dodgeBlockedCreatureIds: [], clock: null,
  });
  room.pendingBattle = null;
  room.resolution = null;
  delete room.turnStart;
  room.revision++;
  f.store.persist(room);
  f.restart();

  f.tick();
  const lockOn = f.get().pendingBattle;
  if (lockOn?.kind === 'defense') f.act('respondBattle', { decisionId: lockOn.id, choice: 'pass' });
  assert.ok(f.room().turn.dodgeBlockedCreatureIds.includes('snorlax'));
  assert.ok(f.room().players.find(player => player.id === actor.id).hand.some(card => card.id === command.id));
  f.tick();
  const decision = f.get().pendingBattle;
  if (decision?.kind === 'defense') {
    assert.equal(decision.cannotDodge, true);
    f.act('respondBattle', { decisionId: decision.id, choice: 'pass' });
  }
  assert.equal(f.get().players.find(player => player.id === target.id).active.hp, 3);
  assert.equal(f.get().self.hand[0].id, 'dodge');
});

test('AI trainers receive distinct names that survive a restart', t => {
  const f = fixture(t);
  f.join('小岚 · AI');
  f.act('addAi', { seatNumber: 3 });
  f.act('addAi', { seatNumber: 4 });
  const names = () => f.get().players.filter(player => player.ai).map(player => player.nickname);
  assert.deepEqual(names(), ['赤羽 · AI', '蓝铃 · AI']);
  f.restart();
  assert.deepEqual(names(), ['赤羽 · AI', '蓝铃 · AI']);
});

test('saved numbered AI names are migrated without replacing their seats', t => {
  const f = fixture(t);
  const view = f.act('addAi', { seatNumber: 4 });
  const ai = view.players.find(player => player.ai);
  f.room().players.find(player => player.id === ai.id).nickname = 'AI 1';
  f.store.persist(f.room());
  f.restart();
  const loaded = f.get().players.find(player => player.id === ai.id);
  assert.equal(loaded.nickname, '小岚 · AI');
  assert.equal(loaded.seatNumber, 4);
});

test('hard public lookahead prioritizes eliminating a reachable threat before it can retaliate', () => {
  const active = { catalogueId: 'pikachu', hp: 3, maxHp: 4, level: 3, power: 0, status: null, defense: 0, speed: false };
  const actor = { id: 'ai', role: null, active, handCount: 3, hasReserve: true };
  const exposed = { id: 'exposed', active: { ...active, level: 1 }, handCount: 0, hasReserve: false };
  const threat = { id: 'threat', active: { ...active, power: 1 }, handCount: 3, hasReserve: false };
  const choose = (difficulty, players) => choosePublicStrategy({ actorId: actor.id, difficulty, players });
  assert.deepEqual(choose('hard', [actor, exposed, threat]), { targetIds: ['threat', 'exposed'], focus: 'recover' });
  const reserve = { ...threat, hasReserve: true };
  assert.equal(choose('hard', [actor, exposed, reserve]).targetIds[0], 'threat');
  const disabled = { ...threat, active: { ...threat.active, status: 'sleep' } };
  assert.deepEqual(choose('hard', [actor, exposed, disabled]), { targetIds: ['exposed', 'threat'], focus: 'attack' });
});

test('AI fallback leaves time to see a move, while manual draws advance at the short pace', t => {
  const f = fixture(t);
  startSolo(f, 1);
  const room = f.room();
  const actor = room.players.find(player => player.id === f.owner.playerId);
  const target = room.players.find(player => player.ai);
  const pokemon = (instanceId, catalogueId) => ({
    instanceId, catalogueId, level: 1, damage: 0, status: null, reinforcements: [], revealed: true,
  });
  actor.active = pokemon('human-machop', 'machop');
  actor.hand = [command];
  target.active = pokemon('ai-snorlax', 'snorlax');
  target.hand = [];
  room.pendingBattle = null;
  room.resolution = null;
  delete room.turnStart;
  room.turn = { playerId: actor.id, phase: 'play', number: 2, drawRemaining: 0, clock: null };
  room.revision++;
  f.store.persist(room);
  f.restart();
  f.act('attack', { cardId: command.id, targetIds: [target.id] });
  assert.equal(f.get().pendingBattle.kind, 'defense');
  assert.equal(f.nextAiDelay, 1700);
  f.tick();
  assert.equal(f.get().pendingBattle, null);
  assert.equal(f.get().players.find(player => player.id === target.id).active.hp, 3);
  f.act('finishPlay');
  f.act('endTurn', { levelUp: true });
  assert.equal(f.get().turn.phase, 'draw');
  assert.equal(f.nextAiDelay, 1700);
  f.tick();
  assert.equal(f.get().turn.drawRemaining, 1);
  assert.equal(f.nextAiDelay, 650);
});
