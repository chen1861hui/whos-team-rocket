import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore, CONNECTED_MS } from '../server/store.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));
function fixture(t, { count = 3, turnSeconds = 0, responseSeconds = 0 } = {}) {
  const root = fileURLToPath(new URL('../.data/', import.meta.url));
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'grimer-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `grimer-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates; act(who, 'selectPokemon', { activeId: candidates[0], reserveId: candidates[1] }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-grimer-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private Grimer card ${serial}` } });
  room().drawPile = Array.from({ length: 48 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const judgments = (...weather) => { for (const value of [...weather].reverse()) room().drawPile.push(makeCard('judgment-fixture', value)); };
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id), third = seats.find(who => who !== leader && who !== target);
  const play = (family = 'grimer', level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, family, level); };
  const attack = (payload = {}, who = leader) => act(who, 'attack', { cardId: payload.cardId ?? supply(who), targetIds: [target.playerId], ...payload });
  const respond = (choice = 'pass', payload = {}) => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload }); };
  const drain = () => { for (let i = 0; room().pendingBattle && i < 50; i++) { const pending = room().pendingBattle; respond(pending.kind === 'effects' ? 'effect' : 'pass', pending.kind === 'effects' ? { effect: pending.effects[0] } : {}); } assert.equal(room().pendingBattle, null); };
  const startPoison = (who = target) => { player(who).active.status = 'poison'; store.startTurn(room(), who.playerId, 2); };
  return { store, dir, now, owner, seats, leader, target, third, room, player, byId, view, input, act, seed, makeCard, supply, judgments, play, attack, respond, drain, startPoison, advance: ms => { time += ms; } };
}
function rejectsAtomically(f, action, code) { const before = structuredClone(f.room()); assert.throws(action, error => code === undefined || error.code === code); assert.deepEqual(f.room(), before); }
function touch(f, { mode = 'status', status = 'confusion', actor = f.third, target = f.target } = {}) {
  const pending = f.room().pendingBattle;
  assert.equal(pending.kind, 'poison-touch'); assert.equal(pending.trait, 'poison-touch'); assert.equal(pending.canTrait, true);
  assert.equal(pending.mode, mode); assert.equal(pending.actorId, actor.playerId); assert.equal(pending.targetId, target.playerId);
  if (mode === 'status') assert.equal(pending.status, status); else assert.equal(pending.damage, 1);
}
const judged = f => f.room().discardPile.filter(card => card.kind === 'judgment-fixture').length;

// Legal shared roster setup precedes explicit seeds isolating the reviewed effects.
test('all Grimer faces expose executable 1/2/2 printed moves and Pound has no added status', t => {
  assert.deepEqual(catalogue.entries.find(p => p.id === 'grimer').levels.map(p => p.effectStatus), Array(3).fill('combat-preview'));
  for (const level of [1, 2, 3]) { const f = fixture(t); f.play('grimer', level); assert.equal(f.view(f.leader).self.battle.canCommand, true); assert.equal(f.view(f.leader).self.battle.move.printedValue, level === 1 ? 1 : 2); f.judgments('clear'); f.attack(); f.drain(); assert.equal(f.player(f.target).active.damage, level === 1 ? 1 : 2); assert.equal(f.player(f.target).active.status, null); assert.equal(judged(f), level === 1 ? 0 : 1); }
});

test('Sludge Bomb poisons only on heavy rain while Toxic accepts both rainy weather cards', t => {
  for (const level of [2, 3]) for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) { const f = fixture(t); f.play('grimer', level); f.judgments(weather); f.attack(); f.respond(); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, weather === 'rain' || (level === 3 && weather === 'thunderstorm') ? 'poison' : null); assert.equal(judged(f), 1); assert.equal(f.room().statusEvent ?? null, null); }
});

test('Grimer poison moves judge only after positive damage and Dodge cancels without drawing a judgment', t => {
  for (const level of [2, 3]) for (const prevention of ['dodge', 'immunity']) { const f = fixture(t); f.play('grimer', level); f.judgments('rain'); const top = f.room().drawPile.at(-1).id; if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.target).active.status, null); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().drawPile.at(-1).id, top); }
});

test('a poison move never gives the fainted original target status to its forced reserve', t => {
  for (const level of [2, 3]) { const f = fixture(t); f.play('grimer', level); f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); const original = f.player(f.target).active.instanceId, incoming = f.player(f.target).reserve.instanceId; f.judgments('rain'); f.attack(); f.drain(); assert.equal(f.player(f.target).active.instanceId, incoming); assert.equal(f.player(f.target).active.status, null); assert.equal(f.player(f.target).reserve.instanceId, original); assert.equal(f.player(f.target).reserve.defeated, true); assert.equal(f.room().statusEvent ?? null, null); }
});

test('every Grimer level may globally replace Dynamic Punch confusion before the status is committed', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t); f.play('machop', 3); f.seed(f.third, 'grimer', level); f.attack(); f.respond(); touch(f); assert.equal(f.player(f.target).active.status, null); assert.equal(f.player(f.target).active.damage, 3); f.respond('trait'); assert.equal(f.player(f.target).active.status, 'poison'); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null); assert.equal(judged(f), 0); }
});

test('global Poison Touch covers burn, paralysis, confusion and flinch judgment callers', t => {
  for (const [family, level, weather, status] of [['charmander', 1, 'intense-sun', 'burn'], ['pikachu', 1, 'thunderstorm', 'paralysis'], ['abra', 2, 'intense-sun', 'confusion'], ['slowpoke', 2, 'thunderstorm', 'flinch']]) { const f = fixture(t); f.play(family, level); f.seed(f.third, 'grimer', 1); f.judgments(weather); f.attack(); f.respond(); touch(f, { status }); assert.equal(f.player(f.target).active.status, null); f.respond('trait'); assert.equal(f.player(f.target).active.status, 'poison'); assert.equal(f.room().pendingBattle, null); assert.equal(judged(f), 1); }
});

test('Will-O-Wisp enters the same global status window and resumes its zero damage settlement once', t => {
  const f = fixture(t); f.play('vulpix', 3); f.seed(f.third, 'grimer', 2); f.judgments('clear'); const cost = f.supply(f.leader, 'event', 'clear'); f.attack({ cardId: cost, moveIndex: 1 }); f.respond(); assert.equal(f.room().pendingBattle.kind, 'judgment'); f.respond(); touch(f, { status: 'burn' }); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.target).active.status, null); f.respond('trait'); assert.equal(f.player(f.target).active.status, 'poison'); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().discardPile.filter(c => c.id === cost).length, 1);
});

test('Static replacement applies to the original attacker and resumes receiving effects exactly once', t => {
  const f = fixture(t); f.play('squirtle', 1); f.seed(f.target, 'pikachu', 1); f.seed(f.third, 'grimer', 3); f.judgments('clear'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'static'); f.respond('trait'); touch(f, { status: 'paralysis', target: f.leader }); assert.equal(f.player(f.leader).active.status, null); f.respond('trait'); assert.equal(f.player(f.leader).active.status, 'poison'); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle, null); assert.equal(judged(f), 1);
});

test('an existing status prevents both replacement offers and overwriting for every one-status value', t => {
  for (const status of ['burn', 'poison', 'paralysis', 'confusion', 'sleep', 'flinch']) { const f = fixture(t); f.play('machop', 3); f.seed(f.third, 'grimer'); f.player(f.target).active.status = status; f.attack(); f.respond(); assert.equal(f.player(f.target).active.status, status); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().statusEvent ?? null, null); }
});

test('multiple Grimer actors pass in current-turn-first seat order, then commit the original status', t => {
  const f = fixture(t, { count: 6 }); f.play('machop', 3); const ordered = f.room().players.filter(p => !p.spectator && p.id !== f.leader.playerId && p.id !== f.target.playerId).map(p => f.byId(p.id)); ordered.forEach((who, index) => f.seed(who, 'grimer', index % 3 + 1)); f.attack(); f.respond(); const seen = []; for (const who of ordered) { touch(f, { actor: who }); assert.equal(f.player(f.target).active.status, null); seen.push(f.room().pendingBattle.id); f.respond(); } assert.equal(new Set(seen).size, ordered.length); assert.equal(f.player(f.target).active.status, 'confusion'); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().statusEvent ?? null, null);
});

test('the current Grimer actor is first at poison turn start and the first acceptance ends the procedure', t => {
  const f = fixture(t); f.play('grimer'); f.seed(f.target, 'grimer', 2); f.seed(f.third, 'grimer', 3); f.startPoison(); touch(f, { mode: 'poison', actor: f.target }); f.respond('trait'); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().statusEvent ?? null, null);
});

test('reserve, defeated, eliminated and spectator Grimer never get a global replacement offer', t => {
  for (const excluded of ['reserve', 'defeated', 'eliminated', 'spectator']) { const f = fixture(t); f.play('machop', 3); if (excluded === 'spectator') { const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); f.player(observer).active = { ...f.player(f.third).active, catalogueId: 'grimer', level: 1, instanceId: 'private-spectator', defeated: false }; } else if (excluded === 'reserve') f.player(f.third).reserve.catalogueId = 'grimer'; else { f.seed(f.third, 'grimer'); if (excluded === 'defeated') f.player(f.third).active.defeated = true; else f.player(f.third).eliminated = true; } f.attack(); f.respond(); assert.equal(f.room().pendingBattle, null, excluded); assert.equal(f.player(f.target).active.status, 'confusion', excluded); }
});

test('a captured later actor cannot transfer its offer to a different active instance', t => {
  const f = fixture(t, { count: 4 }); f.play('machop', 3); const actors = f.room().players.filter(p => p.id !== f.leader.playerId && p.id !== f.target.playerId).map(p => f.byId(p.id)); actors.forEach(who => f.seed(who, 'grimer')); f.attack(); f.respond(); touch(f, { actor: actors[0] }); f.player(actors[1]).active.instanceId = 'private-replacement-grimer'; f.respond(); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.target).active.status, 'confusion');
});

test('Poison Touch has no once-per-turn cap across separate status events', t => {
  const f = fixture(t); f.play('vulpix', 3); f.seed(f.third, 'grimer'); f.judgments('clear', 'intense-sun'); f.attack({ cardId: f.supply(f.leader, 'event', 'clear'), moveIndex: 1 }); f.respond(); f.respond(); touch(f, { status: 'burn' }); f.respond('trait'); f.attack({ targetIds: [f.leader.playerId] }); f.respond(); f.respond(); touch(f, { status: 'burn', target: f.leader }); f.respond('trait'); assert.equal(f.player(f.target).active.status, 'poison'); assert.equal(f.player(f.leader).active.status, 'poison'); assert.equal(f.room().pendingBattle, null);
});

test('would-be poison application skips no-op replacement offers even when multiple Grimer are active', t => {
  const f = fixture(t); f.play('grimer', 3); f.seed(f.third, 'grimer', 2); f.judgments('thunderstorm'); f.attack(); f.respond(); assert.equal(f.player(f.target).active.status, 'poison'); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().statusEvent ?? null, null);
});

test('poison tick waits for all actor choices and passes retain base one without removing poison', t => {
  const f = fixture(t); f.play('grimer'); f.seed(f.third, 'grimer', 2); f.startPoison(); const start = f.room().players.findIndex(p => p.id === f.target.playerId), rotated = [...f.room().players.slice(start), ...f.room().players.slice(0, start)], ordered = rotated.filter(p => p.active.catalogueId === 'grimer').map(p => f.byId(p.id)); for (const actor of ordered) { touch(f, { mode: 'poison', actor }); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.target).active.status, 'poison'); f.respond(); } assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.player(f.target).active.status, 'poison'); assert.equal(f.room().turn.phase, 'draw'); assert.equal(f.room().turn.drawRemaining, 2); assert.equal(f.room().pendingBattle, null);
});

test('poison amplification then receiving Defense, Multiscale and Marvel Scale use ordinary damage modifiers', t => {
  for (const scenario of ['defense', 'multiscale', 'marvel', 'marvel-pass']) { const f = fixture(t); f.play('grimer'); f.seed(f.target, scenario === 'defense' ? 'squirtle' : 'dratini', scenario === 'multiscale' ? 3 : 2, { reinforcements: scenario === 'defense' ? ['defense'] : [] }); f.startPoison(); touch(f, { mode: 'poison', actor: f.leader }); f.respond('trait'); if (scenario.startsWith('marvel')) { assert.equal(f.room().pendingBattle.kind, 'scales'); assert.equal(f.room().pendingBattle.damage, 2); assert.equal(f.player(f.target).active.damage, 0); f.respond(scenario === 'marvel' ? 'trait' : 'pass'); } assert.equal(f.player(f.target).active.damage, scenario === 'marvel-pass' ? 2 : 1); assert.equal(f.room().pendingBattle, null); if (scenario === 'defense') assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); }
});

test('unamplified poison still uses receiving Defense and leaves its marker for the next card resolution', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'dratini', 2, { reinforcements: ['defense'] }); f.startPoison(); assert.equal(f.player(f.target).active.damage, 1); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(f.room().pendingBattle, null);
});

test('amplified poison is sourceless and creates no Static, Helmet, Synchronize or fake card settlement', t => {
  for (const family of ['pikachu', 'abra', 'slowpoke']) { const f = fixture(t); f.play('grimer'); f.seed(f.target, family, 1); const item = { ...f.makeCard('held-item'), itemType: 'rocky-helmet' }; f.player(f.target).active.item = item; const deck = structuredClone(f.room().drawPile), discard = structuredClone(f.room().discardPile), sourceDamage = f.player(f.leader).active.damage; f.startPoison(); f.respond('trait'); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.leader).active.damage, sourceDamage); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null); assert.deepEqual(f.room().drawPile, deck); assert.deepEqual(f.room().discardPile, discard); assert.deepEqual(f.player(f.target).active.item, item); }
});

test('poison fainting keeps source-free rescue and reserve substitution without attacker rewards', t => {
  const f = fixture(t); f.play('grimer'); f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); const original = f.player(f.target).active.instanceId, incoming = f.player(f.target).reserve.instanceId; f.startPoison(); f.respond('trait'); assert.equal(f.room().pendingBattle.kind, 'rescue'); const deck = f.room().drawPile.length, hand = structuredClone(f.player(f.leader).hand); f.drain(); assert.equal(f.player(f.target).active.instanceId, incoming); assert.equal(f.player(f.target).active.status, null); assert.equal(f.player(f.target).reserve.instanceId, original); assert.equal(f.player(f.target).reserve.defeated, true); assert.equal(f.room().drawPile.length, deck); assert.deepEqual(f.player(f.leader).hand, hand); assert.equal(f.room().statusEvent ?? null, null);
});

test('both Poison Touch modes enforce actor authority, stale decisions and strict trait/pass-only payloads atomically', t => {
  for (const mode of ['status', 'poison']) { const f = fixture(t); f.play('machop', 3); f.seed(f.third, 'grimer'); if (mode === 'status') { f.attack(); f.respond(); } else f.startPoison(); const decisionId = f.room().pendingBattle.id; rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId, choice: 'trait' }), 'NOT_YOUR_DECISION'); rejectsAtomically(f, () => f.act(f.third, 'respondBattle', { decisionId: 'stale', choice: 'pass' }), 'STALE_DECISION'); for (const payload of [{ choice: 'dodge' }, { choice: 'replace' }, { choice: 'effect' }, { choice: 'trait', cardId: 'forged' }, { choice: 'trait', damage: 99 }, { choice: 'trait', status: 'burn' }, { choice: 'trait', targetIds: [] }, { choice: 'trait', order: [] }, { choice: 'pass', cardId: 'forged' }, { choice: 'trait', handIndex: 0 }, { choice: 'trait', reinforcement: 'power' }]) rejectsAtomically(f, () => f.act(f.third, 'respondBattle', { decisionId, ...payload })); f.respond(); assert.equal(f.player(f.target).active.status, mode === 'status' ? 'confusion' : 'poison'); }
});

test('public Poison Touch exposes only the public decision and hides captured actors, instances and continuations', t => {
  for (const mode of ['status', 'poison']) { const f = fixture(t); f.play('machop', 3); f.seed(f.third, 'grimer'); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); if (mode === 'status') { f.attack(); f.respond(); } else f.startPoison(); assert.equal(f.room().statusEvent.kind, mode); for (const who of [...f.seats, observer]) { const view = f.view(who), serialized = JSON.stringify(view.pendingBattle); assert.equal(view.pendingBattle.mode, mode); assert.equal(view.statusEvent, undefined); assert.equal(view.resolution, undefined); assert.equal(view.resolutionStack, undefined); for (const key of ['actorIds', 'actorInstances', 'targetCreatureId', 'continuation', 'next']) assert.equal(view.pendingBattle[key], undefined); for (const p of f.room().players) for (const pokemon of [p.active, p.reserve].filter(Boolean)) assert.equal(serialized.includes(pokemon.instanceId), false); assert.equal(serialized.includes('privateMarker'), false); } }
});

test('saved status and poison choices survive restart and exact retry commits once and resumes once', t => {
  for (const mode of ['status', 'poison']) { const f = fixture(t); f.play('machop', 3); f.seed(f.third, 'grimer'); if (mode === 'status') { f.attack(); f.respond(); } else f.startPoison(); // Persist the directly started poison turn before simulating process restart.
    f.store.persist(f.room()); const pending = structuredClone(f.room().pendingBattle), event = structuredClone(f.room().statusEvent); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); const recovered = restored.view(f.owner.code, f.third.token).view; assert.equal(recovered.pendingBattle.id, pending.id); assert.deepEqual(restored.rooms.get(f.owner.code).statusEvent, event); const request = { id: `restored-touch-${mode}`, revision: recovered.revision, type: 'respondBattle', decisionId: pending.id, choice: 'trait' }; restored.action(f.owner.code, f.third.token, request); const state = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.third.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), state); assert.equal(state.players.find(p => p.id === f.target.playerId).active.status, 'poison'); assert.equal(state.players.find(p => p.id === f.target.playerId).active.damage, mode === 'status' ? 3 : 2); assert.equal(state.pendingBattle, null); assert.equal(state.statusEvent ?? null, null); assert.equal(state.resolution, null); }
});

test('optional Poison Touch response clocks pass on expiry and pause during closing votes without spending turn time', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play('machop', 3); f.seed(f.third, 'grimer'); f.advance(1_000); f.attack(); f.respond(); f.advance(2_000); f.act(f.owner, 'requestEndGame'); f.advance(8_000); assert.equal(f.view(f.third).pendingBattle.clock.remainingMs, 3_000); rejectsAtomically(f, () => f.respond('trait'), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); f.advance(3_000); const view = f.view(f.third); assert.equal(view.pendingBattle, null); assert.equal(f.player(f.target).active.status, 'confusion'); assert.equal(view.turn.clock.remainingMs, 59_000); assert.equal(f.room().statusEvent ?? null, null);
});

test('disconnected Poison Touch clocks pause and preserve the pending choice across restart', t => {
  const f = fixture(t, { responseSeconds: 60 }); f.play('machop', 3); f.seed(f.third, 'grimer'); f.attack(); f.respond(); const pendingId = f.room().pendingBattle.id; f.advance(CONNECTED_MS + 1_000); const paused = f.view(f.target).pendingBattle; assert.equal(paused.clock.pausedReason, 'disconnected'); const remaining = paused.clock.remainingMs; f.advance(5_000); assert.equal(f.view(f.target).pendingBattle.clock.remainingMs, remaining); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); const recovered = restored.view(f.owner.code, f.third.token).view; assert.equal(recovered.pendingBattle.id, pendingId); assert.equal(recovered.pendingBattle.clock.remainingMs, remaining);
});

test('successful closing votes clear status procedures as well as battle decisions and continuations', t => {
  for (const mode of ['status', 'poison']) { const f = fixture(t); f.play('machop', 3); f.seed(f.third, 'grimer'); if (mode === 'status') { f.attack(); f.respond(); } else f.startPoison(); f.act(f.owner, 'requestEndGame'); for (const who of f.seats.filter(who => who !== f.owner)) f.act(who, 'approveEnd'); assert.equal(f.room().status, 'lobby'); assert.equal(f.room().pendingBattle ?? null, null); assert.equal(f.room().statusEvent ?? null, null); assert.equal(f.room().resolution ?? null, null); assert.equal(f.room().resolutionStack ?? null, null); }
});

test('turn-start confusion uses Blaze then Defense without spending Defense or inventing a resolving card', t => {
  const f = fixture(t); f.play('squirtle');
  f.seed(f.target, 'charmander', 1, { hpBonus: 3, damage: 3, status: 'confusion', reinforcements: ['defense'] });
  const deck = structuredClone(f.room().drawPile), discard = structuredClone(f.room().discardPile), hand = structuredClone(f.player(f.target).hand);
  const original = f.player(f.target).active.instanceId;
  f.store.startTurn(f.room(), f.target.playerId, 2);
  assert.equal(f.player(f.target).active.damage, 4, 'half-HP Blaze makes confusion 3, then Defense caps it at 1');
  assert.equal(f.player(f.target).active.status, null);
  assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']);
  assert.deepEqual(f.room().turn.blockedMoveIds, [original]);
  assert.equal(f.room().turn.commandCreatureId, null);
  assert.deepEqual(f.room().turn.usedMoves, []);
  assert.equal(f.room().turn.phase, 'draw');
  assert.equal(f.room().pendingBattle, null);
  assert.equal(f.room().resolution, null);
  assert.equal(f.room().statusEvent ?? null, null);
  assert.deepEqual(f.room().drawPile, deck);
  assert.deepEqual(f.room().discardPile, discard);
  assert.deepEqual(f.player(f.target).hand, hand);
});
