import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore } from '../server/store.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));

function fixture(t) {
  const root = fileURLToPath(new URL('../.data/', import.meta.url));
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'magikarp-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0;
  const store = new RoomStore({ dataDir: dir, catalogue, now: () => 1_000_000 });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, store.join(owner.code, { nickname: 'Trainer 1' }), store.join(owner.code, { nickname: 'Trainer 2' })];
  const room = () => store.rooms.get(owner.code);
  const player = who => room().players.find(entry => entry.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id);
  const view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `magikarp-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds: 0, responseSeconds: 0 });
  seats.forEach(who => act(who, 'ready', { ready: true }));
  act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(entry => entry.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) {
    for (let i = 0; i < 5; i++) act(who, 'drawPokemon');
    const candidates = view(who).self.candidates;
    act(who, 'selectPokemon', { activeId: candidates[0], reserveId: candidates[1] });
  }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, {
    instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0,
    status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra
  });
  for (const who of seats) {
    seed(who);
    Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false });
    player(who).hand = [];
  }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-magikarp-${++serial}`, kind, weather, fixture: true, name: { zh: `私牌${serial}`, en: `Private Magikarp card ${serial}` } });
  room().drawPile = Array.from({ length: 40 }, () => makeCard());
  room().discardPile = [];
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const judgments = (...weather) => room().drawPile.push(...weather.map(value => makeCard('judgment-fixture', value)).reverse());
  const target = byId(room().players.find(entry => entry.id !== leader.playerId && !entry.spectator).id);
  const play = (level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, 'magikarp', level); };
  const attack = (payload = {}) => act(leader, 'attack', { cardId: payload.cardId ?? supply(leader), targetIds: payload.targetIds ?? [target.playerId], ...payload });
  const respond = (choice = 'pass', payload = {}) => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload }); };
  return { store, owner, seats, room, player, byId, view, input, act, seed, makeCard, supply, judgments, leader, target, play, attack, respond };
}

function rejectsAtomically(f, action) {
  const before = structuredClone(f.room());
  assert.throws(action);
  assert.deepEqual(f.room(), before);
}

test('Magikarp faces expose reviewed HP and printed move actions', t => {
  const entry = catalogue.entries.find(item => item.id === 'magikarp');
  assert.deepEqual(entry.levels.map(level => level.hp), [3, 4, 4]);
  for (const level of [1, 2, 3]) {
    const f = fixture(t); f.play(level);
    const battle = f.view(f.leader).self.battle;
    assert.equal(battle.moves.length, 1);
    assert.equal(battle.moves[0].printedValue, level === 1 ? null : level === 2 ? 2 : 3);
    assert.equal(battle.moves[0].maxTargets, 1);
  }
});

test('active Magikarp Rattled skips discard phase without changing the ordinary hand limit', t => {
  const f = fixture(t); f.play(1);
  while (f.player(f.leader).hand.length < 7) f.supply(f.leader, 'event');
  f.room().turn.drawRemaining = 0;
  assert.equal(f.act(f.leader, 'finishPlay').turn.phase, 'end');
  assert.equal(f.player(f.leader).hand.length, 7);
  assert.equal(f.view(f.leader).self.handLimit, 4);
  assert.notEqual(f.act(f.leader, 'endTurn', { levelUp: false }).turn.playerId, f.leader.playerId);

  const g = fixture(t); g.play(2);
  while (g.player(g.leader).hand.length < 7) g.supply(g.leader, 'event');
  g.room().turn.drawRemaining = 0;
  assert.equal(g.act(g.leader, 'finishPlay').turn.phase, 'discard');
});

test('Splash self-targets and spends its real command and move use while doing nothing', t => {
  const f = fixture(t); f.play(1);
  const command = f.supply(f.leader);
  rejectsAtomically(f, () => f.attack({ cardId: command, targetIds: [f.target.playerId] }));
  f.attack({ cardId: command, targetIds: [f.leader.playerId] });
  f.respond();
  assert.equal(f.player(f.leader).active.damage, 0);
  assert.equal(f.player(f.leader).active.status, null);
  assert.equal(f.room().turn.commandCreatureId, f.player(f.leader).active.instanceId);
  assert.equal(f.view(f.leader).self.battle.canCommand, false);
  assert.equal(f.room().discardPile.filter(card => card.id === command).length, 1);
});

test('Moxie draws once after target selection and before defense, including a Dodged command', t => {
  for (const level of [2, 3]) {
    const f = fixture(t); f.play(level);
    const command = f.supply(f.leader), dodge = f.supply(f.target, 'dodge');
    const expected = f.room().drawPile.at(-1);
    const before = f.player(f.leader).hand.length;
    f.attack({ cardId: command });
    assert.equal(f.room().pendingBattle.kind, 'defense');
    assert.equal(f.player(f.leader).hand.length, before);
    assert.equal(f.player(f.leader).hand.some(card => card.id === expected.id), true);
    f.respond('dodge', { cardId: dodge });
    assert.equal(f.player(f.target).active.damage, 0);
    assert.equal(f.player(f.leader).hand.filter(card => card.id === expected.id).length, 1);
  }
});

test('Waterfall deals two and flinches only on a thunderstorm judgment after positive damage', t => {
  for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) {
    const f = fixture(t); f.play(2); f.judgments(weather); f.room().drawPile.push(f.makeCard('moxie-fixture'));
    f.attack(); f.respond();
    assert.equal(f.player(f.target).active.damage, 2);
    assert.equal(f.player(f.target).active.status, weather === 'thunderstorm' ? 'flinch' : null);
  }
  const f = fixture(t); f.play(2); f.judgments('thunderstorm'); f.room().drawPile.push(f.makeCard('moxie-fixture'));
  f.attack(); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') });
  assert.equal(f.player(f.target).active.status, null);
  assert.equal(f.room().drawPile.at(-1).weather, 'thunderstorm');
});

test('Hyper Beam validates and discards its optional declaration cost before Moxie draws, then adds one damage', t => {
  const f = fixture(t); f.play(3);
  const command = f.supply(f.leader), boost = f.supply(f.leader, 'event', 'rain');
  const expectedDraw = f.room().drawPile.at(-1).id;
  f.attack({ cardId: command, boostCardId: boost });
  assert.equal(f.room().discardPile.filter(card => card.id === boost).length, 1);
  assert.equal(f.player(f.leader).hand.some(card => card.id === expectedDraw), true);
  f.respond();
  assert.equal(f.player(f.target).active.damage, 4);

  const g = fixture(t); g.play(3);
  const ownCommand = g.supply(g.leader), foreign = g.supply(g.target, 'event');
  rejectsAtomically(g, () => g.attack({ cardId: ownCommand, boostCardId: foreign }));
  rejectsAtomically(g, () => g.attack({ cardId: ownCommand, boostCardId: ownCommand }));
});

test('an exact Moxie and Hyper Beam attack retry cannot draw, discard or damage twice', t => {
  const f = fixture(t); f.play(3);
  const command = f.supply(f.leader), boost = f.supply(f.leader, 'event');
  const request = f.input('attack', { cardId: command, boostCardId: boost, targetIds: [f.target.playerId] });
  f.store.action(f.owner.code, f.leader.token, request);
  const first = structuredClone(f.room());
  f.store.action(f.owner.code, f.leader.token, request);
  assert.deepEqual(f.room(), first);
  f.respond();
  assert.equal(f.player(f.target).active.damage, 4);
  assert.equal(f.room().discardPile.filter(card => card.id === boost).length, 1);
});
