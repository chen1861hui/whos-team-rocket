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
  const dir = mkdtempSync(join(root, 'bird-magnet-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `bird-magnet-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates; act(who, 'selectPokemon', { activeId: candidates[0], reserveId: candidates[1] }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-bird-magnet-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private bird magnet card ${serial}` } });
  room().drawPile = Array.from({ length: 48 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const judgments = (...weather) => { for (const value of [...weather].reverse()) room().drawPile.push(makeCard('judgment-fixture', value)); };
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id), third = seats.find(who => who !== leader && who !== target);
  const play = (family = 'pidgey', level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, family, level); };
  const attack = (payload = {}, who = leader) => act(who, 'attack', { cardId: payload.cardId ?? supply(who), targetIds: [target.playerId], ...payload });
  const respond = (choice = 'pass', payload = {}) => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload }); };
  const order = effect => respond('damage-effect', { effect });
  const helmet = who => { const card = { ...makeCard('held-item'), itemType: 'rocky-helmet' }; player(who).active.item = card; return card; };
  const drain = () => { for (let i = 0; room().pendingBattle && i < 40; i++) { const pending = room().pendingBattle; if (pending.kind === 'damage-order') order(pending.effects[0]); else respond(pending.kind === 'effects' ? 'effect' : 'pass', pending.kind === 'effects' ? { effect: pending.effects[0] } : {}); } assert.equal(room().pendingBattle, null); };
  return { store, dir, now, owner, seats, leader, target, third, room, player, byId, view, input, act, seed, makeCard, supply, judgments, play, attack, respond, order, helmet, drain, advance: ms => { time += ms; } };
}
function rejectsAtomically(f, action, code) { const before = structuredClone(f.room()); assert.throws(action, error => code === undefined || error.code === code); assert.deepEqual(f.room(), before); }
const ids = cards => cards.map(card => card.id);
const allCards = room => [...room.drawPile, ...room.discardPile, ...room.players.flatMap(p => [...(p.hand || []), ...[p.active?.item, p.reserve?.item].filter(Boolean)]), ...[room.resolution, ...(room.resolutionStack || [])].flatMap(r => r?.card && !r.cardClaimedBy ? [r.card] : []), ...(room.judgment?.card ? [room.judgment.card] : [])];
const countCard = (room, id) => allCards(room).filter(card => card.id === id).length;

// Legal shared setup precedes every isolated printed-effect scenario.
test('all six bird and magnet faces expose reviewed HP, command damage and legal actions', t => {
  for (const [family, hp, damage] of [['pidgey', [3, 4, 4], [1, 2, 3]], ['magnemite', [3, 3, 4], [1, 1, 2]]]) {
    const entry = catalogue.entries.find(p => p.id === family);
    assert.deepEqual(entry.levels.map(p => p.hp), hp);
    assert.deepEqual(entry.levels.map(p => p.effectStatus), Array(3).fill('combat-preview'));
    for (const level of [1, 2, 3]) { const f = fixture(t); f.play(family, level); const battle = f.view(f.leader).self.battle; assert.equal(battle.canCommand, true); assert.equal(battle.move.printedValue, damage[level - 1]); assert.equal(battle.moves.length, family === 'magnemite' && level > 1 ? 2 : 1); if (family === 'magnemite') { assert.equal(battle.canTrait, true); assert.equal(battle.trait.kind, 'analytic'); } }
  }
});

test('Keen Eye accepts multiple actual Dodge cards without settling damage or changing the defense decision', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t, { responseSeconds: 60 }); f.play('pidgey', level); f.attack(); const original = structuredClone(f.room().pendingBattle); assert.equal(f.view(f.target).pendingBattle.dodgeReducesDamage, true); assert.equal(f.view(f.target).pendingBattle.damageReduction, 0); const paid = [];
    for (let n = 1; n <= 3; n++) { f.advance(1_000); const cardId = f.supply(f.target, 'dodge'); paid.push(cardId); f.respond('dodge', { cardId }); assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.room().pendingBattle.id, original.id); assert.equal(f.room().pendingBattle.clock.deadlineAt, original.clock.deadlineAt); assert.equal(f.view(f.target).pendingBattle.damageReduction, n); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().resolution.dodgeReductions[f.player(f.target).active.instanceId], n); }
    f.respond(); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().pendingBattle, null); for (const id of paid) assert.equal(f.room().discardPile.filter(c => c.id === id).length, 1);
  }
});

test('Keen Eye snapshot survives source-face changes and applies reduction to this target instance only', t => {
  const f = fixture(t); f.play('pidgey', 3); f.judgments('clear'); f.attack(); f.player(f.leader).active.catalogueId = 'squirtle'; f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.third).active.damage, 0); assert.equal(f.room().resolution, null);
});

test('the source trainer own Dodge still cancels a self-targeted Pidgey move normally', t => {
  const f = fixture(t); f.play('pidgey', 3); f.judgments('thunderstorm'); const top = f.room().drawPile.at(-1).id; f.attack({ targetIds: [f.leader.playerId] }); assert.equal(Boolean(f.view(f.leader).pendingBattle.dodgeReducesDamage), false); f.respond('dodge', { cardId: f.supply(f.leader, 'dodge') }); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.room().drawPile.at(-1).id, top);
});

test('ordinary non-Pidgey Dodge retains cancellation and never creates a modifier queue', t => {
  const f = fixture(t); f.play('squirtle', 3); f.attack(); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null);
});

test('Keen Eye validates Dodge authority, actual ownership, stale IDs and fields atomically', t => {
  const f = fixture(t); f.play(); const own = f.supply(f.target, 'dodge'), wrong = f.supply(f.target, 'event'), foreign = f.supply(f.third, 'dodge'); f.attack(); const decisionId = f.room().pendingBattle.id;
  rejectsAtomically(f, () => f.act(f.third, 'respondBattle', { decisionId, choice: 'dodge', cardId: foreign }), 'NOT_YOUR_DECISION');
  for (const payload of [{ choice: 'dodge', cardId: wrong }, { choice: 'dodge', cardId: foreign }, { choice: 'dodge', cardId: 'forged' }, { choice: 'dodge' }, { choice: 'pass', cardId: own }, { choice: 'dodge', cardId: own, damageReduction: 99 }, { choice: 'dodge', cardId: own, effect: 'dodge' }]) rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId, ...payload }));
  rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: 'stale', choice: 'dodge', cardId: own }), 'STALE_DECISION'); f.respond('dodge', { cardId: own }); rejectsAtomically(f, () => f.respond('dodge', { cardId: own }));
});

test('successful Sand Veil adds a virtual Dodge and restores the original clock before another actual Dodge', t => {
  const f = fixture(t, { responseSeconds: 60 }); f.play('pidgey', 3); f.seed(f.target, 'sandshrew'); f.seed(f.third, 'vulpix'); f.judgments('clear', 'clear'); f.attack(); const defenseId = f.room().pendingBattle.id; f.advance(2_000); f.respond('trait'); assert.equal(f.room().pendingBattle.kind, 'judgment'); f.advance(3_000); f.respond(); const restored = f.view(f.target).pendingBattle;
  assert.equal(restored.kind, 'defense'); assert.equal(restored.id, defenseId); assert.equal(restored.clock.remainingMs, 58_000); assert.equal(restored.damageReduction, 1); assert.equal(restored.canTrait, false); assert.equal(f.player(f.target).active.damage, 0); rejectsAtomically(f, () => f.respond('trait')); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); assert.equal(f.view(f.target).pendingBattle.damageReduction, 2); f.respond(); f.drain(); assert.equal(f.player(f.target).active.damage, 1);
});

test('failed Sand Veil adds no reduction and Drought replacement determines its success', t => {
  for (const replace of [false, true]) { const f = fixture(t); f.play('pidgey', 2); f.seed(f.target, 'sandshrew'); f.seed(f.third, 'vulpix'); const sunny = f.supply(f.third, 'event', 'clear'); f.judgments('rain'); f.attack(); const originalId = f.room().pendingBattle.id; f.respond('trait'); f.respond(replace ? 'replace' : 'pass', replace ? { cardId: sunny } : {}); assert.equal(f.room().pendingBattle.id, originalId); assert.equal(f.view(f.target).pendingBattle.damageReduction, replace ? 1 : 0); assert.equal(f.view(f.target).pendingBattle.canTrait, false); f.respond(); assert.equal(f.player(f.target).active.damage, replace ? 1 : 2); }
});

test('Defense and Dodge can be ordered to produce zero or one damage with consumption only on positive damage', t => {
  for (const first of ['defense', 'dodge']) { const f = fixture(t); f.play('pidgey', 2); f.player(f.target).active.reinforcements = ['defense']; f.attack(); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); f.respond(); assert.equal(f.room().pendingBattle.kind, 'damage-order'); assert.deepEqual(new Set(f.room().pendingBattle.effects), new Set(['defense', 'dodge'])); assert.equal(f.room().pendingBattle.damage, 2); f.order(first); f.drain(); assert.equal(f.player(f.target).active.damage, first === 'defense' ? 0 : 1); assert.deepEqual(f.player(f.target).active.reinforcements, first === 'defense' ? ['defense'] : []); }
});

test('Multiscale and Dodge order uses current injuries and prunes effects after damage reaches one', t => {
  for (const [injuries, first, expected] of [[0, 'multiscale', 0], [0, 'dodge', 1], [1, 'dodge', 1]]) { const f = fixture(t); f.play('pidgey', 2); f.seed(f.target, 'dratini', 3, { damage: injuries }); f.attack(); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); f.respond(); if (!injuries) { assert.equal(f.room().pendingBattle.kind, 'damage-order'); f.order(first); } f.drain(); assert.equal(f.player(f.target).active.damage, injuries + expected); }
});

test('Marvel Scale before Dodge reaches zero whereas Dodge first removes the ineligible optional offer', t => {
  for (const first of ['marvel-scale', 'dodge']) { const f = fixture(t); f.play('pidgey', 2); f.seed(f.target, 'dratini', 2, { status: 'poison' }); f.attack(); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); f.respond(); assert.equal(f.room().pendingBattle.kind, 'damage-order'); f.order(first); if (first === 'marvel-scale') { assert.equal(f.room().pendingBattle.kind, 'scales'); assert.equal(f.room().pendingBattle.canTrait, true); assert.equal(f.room().pendingBattle.damage, 2); f.respond('trait'); } assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.target).active.damage, first === 'marvel-scale' ? 0 : 1); }
});

test('passing optional Marvel Scale resumes the queue without a second offer', t => {
  const f = fixture(t); f.play('pidgey', 3); f.seed(f.target, 'dratini', 2, { status: 'poison', reinforcements: ['defense'] }); f.judgments('clear'); f.attack(); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); f.respond(); f.order('marvel-scale'); assert.equal(f.room().pendingBattle.kind, 'scales'); f.respond(); assert.equal(f.room().pendingBattle.kind, 'damage-order'); assert.equal(f.room().pendingBattle.effects.includes('marvel-scale'), false); f.order('defense'); f.drain(); assert.equal(f.player(f.target).active.damage, 0); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']);
});

test('damage-order decisions are mandatory, target-owned and reject forged or stale choices atomically', t => {
  const f = fixture(t); f.play('pidgey', 2); f.player(f.target).active.reinforcements = ['defense']; f.attack(); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); f.respond(); const decisionId = f.room().pendingBattle.id;
  rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId, choice: 'damage-effect', effect: 'dodge' }), 'NOT_YOUR_DECISION');
  for (const payload of [{ choice: 'pass' }, { choice: 'trait' }, { choice: 'effect', effect: 'dodge' }, { choice: 'damage-effect', effect: 'unknown' }, { choice: 'damage-effect' }, { choice: 'damage-effect', effect: 'dodge', cardId: 'forged' }, { choice: 'damage-effect', effect: 'dodge', order: ['dodge'] }, { choice: 'damage-effect', effect: 'dodge', damage: 0 }]) rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId, ...payload }));
  rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: 'stale', choice: 'damage-effect', effect: 'dodge' }), 'STALE_DECISION');
});

test('Keen Eye reduction runs after source Power and burn modifiers without changing their consumption', t => {
  for (const burn of [false, true]) { const f = fixture(t); f.play('pidgey', 3); f.player(f.leader).active.reinforcements = ['power']; if (burn) f.player(f.leader).active.status = 'burn'; f.judgments('clear'); f.attack(); assert.deepEqual(f.player(f.leader).active.reinforcements, []); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); f.respond(); f.drain(); assert.equal(f.player(f.target).active.damage, burn ? 0 : 3); }
});

test('zero damage suppresses Air Slash judgment, Static, Synchronize and Rocky Helmet completely', t => {
  for (const family of ['pikachu', 'abra', 'slowpoke']) { const f = fixture(t); f.play('pidgey', 3); f.seed(f.target, family); f.helmet(f.target); f.judgments('thunderstorm'); const top = f.room().drawPile.at(-1).id; f.attack(); for (let n = 0; n < 3; n++) f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); f.respond(); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.target).active.status, null); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.player(f.target).hand.length, 0); assert.equal(f.room().drawPile.at(-1).id, top); }
});

test('Rocky Helmet nested damage never inherits the parent move Dodge reduction', t => {
  const f = fixture(t); f.play('pidgey', 3); f.helmet(f.target); f.judgments('clear'); const command = f.supply(f.leader); f.attack({ cardId: command }); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); f.respond(); f.drain(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.room().resolution, null); assert.equal((f.room().resolutionStack || []).length, 0); assert.equal(countCard(f.room(), command), 1);
});

test('Pidgey Air Slash judges thunderstorm only after positive damage at level three', t => {
  for (const level of [1, 2, 3]) for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) { const f = fixture(t); f.play('pidgey', level); f.judgments(weather); const top = f.room().drawPile.at(-1).id; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, level); assert.equal(f.player(f.target).active.status, level === 3 && weather === 'thunderstorm' ? 'flinch' : null); assert.equal(f.room().drawPile.at(-1).id === top, level < 3); }
});

test('Air Slash waits for Drought and allows global Poison Touch to replace successful flinch', t => {
  const f = fixture(t, { count: 4 }); f.play('pidgey', 3); f.seed(f.third, 'vulpix'); const grimer = f.seats.find(who => who !== f.leader && who !== f.target && who !== f.third); f.seed(grimer, 'grimer'); f.judgments('thunderstorm'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'judgment'); assert.equal(f.player(f.target).active.status, null); f.respond(); assert.equal(f.room().pendingBattle.kind, 'poison-touch'); assert.equal(f.room().pendingBattle.status, 'flinch'); f.respond('trait'); assert.equal(f.player(f.target).active.status, 'poison'); assert.equal(f.player(f.target).active.damage, 3); assert.equal(f.room().pendingBattle, null);
});

test('saved cumulative Dodge and a later ordered modifier survive restart and exact retry once', t => {
  const f = fixture(t); f.play('pidgey', 3); f.player(f.target).active.reinforcements = ['defense']; const command = f.supply(f.leader); f.attack({ cardId: command }); const dodge = f.supply(f.target, 'dodge'); const request = f.input('respondBattle', { decisionId: f.room().pendingBattle.id, choice: 'dodge', cardId: dodge }); f.store.action(f.owner.code, f.target.token, request); const snapshot = structuredClone(f.room()); f.store.action(f.owner.code, f.target.token, request); assert.deepEqual(f.room(), snapshot); f.respond(); const pending = structuredClone(f.room().pendingBattle); assert.equal(pending.kind, 'damage-order'); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); const recovered = restored.view(f.owner.code, f.target.token).view; assert.equal(recovered.pendingBattle.id, pending.id); const chosen = { id: 'restored-bird-order', revision: recovered.revision, type: 'respondBattle', decisionId: pending.id, choice: 'damage-effect', effect: 'defense' }; restored.action(f.owner.code, f.target.token, chosen); const state = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.target.token, chosen); assert.deepEqual(restored.rooms.get(f.owner.code), state); assert.equal(state.players.find(p => p.id === f.target.playerId).active.damage, 0); assert.equal(countCard(state, command), 1); assert.equal(countCard(state, dodge), 1);
});

test('Dodge and order projections hide private modifier state and other trainers hand IDs', t => {
  const f = fixture(t); f.play('pidgey', 2); f.player(f.target).active.reinforcements = ['defense']; const secret = f.supply(f.target, 'event'); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); f.attack(); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); f.respond(); for (const who of [...f.seats, observer]) { const view = f.view(who); assert.equal(view.pendingBattle.kind, 'damage-order'); assert.equal(view.pendingBattle.damage, 2); assert.equal(view.resolution, undefined); assert.equal(view.resolutionStack, undefined); for (const key of ['modifierState', 'dodgeReductions', 'targetCreatureId', 'remaining', 'sourceId']) assert.equal(view.pendingBattle[key], undefined); assert.equal(JSON.stringify(view.pendingBattle).includes('private-active-'), false); if (who !== f.target) { assert.equal(JSON.stringify(view).includes(secret), false); assert.equal(JSON.stringify(view).includes('privateMarker'), false); } }
});

test('cumulative defense response time pauses for a vote and timeout settles with the paid reduction', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play('pidgey', 2); f.advance(1_000); f.attack(); const defenseId = f.room().pendingBattle.id; f.advance(1_000); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); f.advance(1_000); f.act(f.owner, 'requestEndGame'); f.advance(8_000); assert.equal(f.view(f.target).pendingBattle.id, defenseId); assert.equal(f.view(f.target).pendingBattle.clock.remainingMs, 3_000); rejectsAtomically(f, () => f.respond(), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); f.advance(3_000); const after = f.view(f.target); assert.equal(after.pendingBattle, null); assert.equal(f.player(f.target).active.damage, 1); assert.equal(after.turn.clock.remainingMs, 59_000);
});

test('modifier clock survives disconnect and restart and a completed move leaks no reduction into the next card', t => {
  const f = fixture(t, { responseSeconds: 60 }); f.play('pidgey', 2); f.player(f.target).active.reinforcements = ['defense']; f.attack(); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); f.respond(); f.advance(CONNECTED_MS + 1_000); const paused = f.view(f.third).pendingBattle; assert.equal(paused.clock.pausedReason, 'disconnected'); f.advance(5_000); assert.equal(f.view(f.third).pendingBattle.clock.remainingMs, paused.clock.remainingMs); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); const recovered = restored.view(f.owner.code, f.target.token).view; assert.equal(recovered.pendingBattle.id, paused.id); assert.equal(recovered.pendingBattle.clock.remainingMs, paused.clock.remainingMs);
  const g = fixture(t); g.play('pidgey', 2); g.attack(); g.respond('dodge', { cardId: g.supply(g.target, 'dodge') }); g.respond(); assert.equal(g.player(g.target).active.damage, 1); g.player(g.leader).active.catalogueId = 'shellder'; g.attack(); g.respond(); assert.equal(g.player(g.target).active.damage, 3); assert.equal(g.room().resolution, null);
});

test('Analytic discards exactly the selected actual cards before drawing the same number and conserves zones', t => {
  const f = fixture(t); f.play('magnemite', 2); const one = f.supply(f.leader, 'dodge'), kept = f.supply(f.leader, 'event'), two = f.supply(f.leader); const selected = f.player(f.leader).hand.filter(c => [one, two].includes(c.id)).map(c => structuredClone(c)); const top = f.room().drawPile.slice(-2).reverse().map(c => structuredClone(c)); const total = allCards(f.room()).length;
  f.act(f.leader, 'useTrait', { cardIds: [two, one] }); assert.deepEqual(f.player(f.leader).hand, [f.player(f.leader).hand.find(c => c.id === kept), ...top]); for (const card of selected) assert.deepEqual(f.room().discardPile.find(c => c.id === card.id), card); assert.equal(allCards(f.room()).length, total); for (const card of [...selected, ...top]) assert.equal(countCard(f.room(), card.id), 1); assert.equal(f.view(f.leader).self.battle.canTrait, false); assert.deepEqual(f.room().turn.traitsUsed, [f.player(f.leader).active.instanceId]);
});

test('Analytic maxCards uses current HP and hand size at every level and rejects excessive payments atomically', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t); f.play('magnemite', level); f.player(f.leader).active.hpBonus = 0; f.player(f.leader).active.damage = (level === 3 ? 4 : 3) - 2; const cards = Array.from({ length: 3 }, () => f.supply(f.leader)); assert.equal(f.view(f.leader).self.battle.trait.maxCards, 2); rejectsAtomically(f, () => f.act(f.leader, 'useTrait', { cardIds: cards })); f.player(f.leader).hand.pop(); assert.equal(f.view(f.leader).self.battle.trait.maxCards, 2); f.act(f.leader, 'useTrait', { cardIds: cards.slice(0, 2) }); assert.equal(f.player(f.leader).hand.length, 2); }
});

test('Analytic zero-card activation spends the per-instance ability without a draw, discard, judgment or free bonus', t => {
  for (const withHand of [false, true]) { const f = fixture(t); f.play('magnemite'); f.seed(f.third, 'vulpix'); if (withHand) f.supply(f.leader); const hand = structuredClone(f.player(f.leader).hand), deck = structuredClone(f.room().drawPile), discard = structuredClone(f.room().discardPile); f.act(f.leader, 'useTrait', { cardIds: [] }); assert.deepEqual(f.player(f.leader).hand, hand); assert.deepEqual(f.room().drawPile, deck); assert.deepEqual(f.room().discardPile, discard); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().judgment ?? null, null); assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => f.act(f.leader, 'useTrait', { cardIds: [] })); }
});

test('Analytic may recycle its just-discarded cards when the deck is empty without duplicating them', t => {
  const f = fixture(t); f.play('magnemite'); f.room().drawPile = []; f.room().discardPile = []; const cardId = f.supply(f.leader, 'dodge', 'rain'), actual = structuredClone(f.player(f.leader).hand[0]); f.act(f.leader, 'useTrait', { cardIds: [cardId] }); assert.deepEqual(f.player(f.leader).hand, [actual]); assert.equal(f.room().discardPile.length, 0); assert.equal(f.room().drawPile.length, 0); assert.equal(countCard(f.room(), cardId), 1);
});

test('Analytic rejects undefined, malformed, duplicate, foreign and forged selections before mutation', t => {
  const f = fixture(t); f.play('magnemite'); const own = f.supply(f.leader), foreign = f.supply(f.target); for (const cardIds of [undefined, null, own, {}, [own, own], [foreign], ['forged'], [own, foreign], [1], [null], [own, {}]]) rejectsAtomically(f, () => f.act(f.leader, 'useTrait', { cardIds })); rejectsAtomically(f, () => f.act(f.leader, 'useTrait', { cardIds: [own], damage: 9 }));
});

test('Analytic is once per instance through evolution and switching while a different Magnemite may use its own ability', t => {
  const f = fixture(t); f.play('magnemite'); const original = f.player(f.leader).active.instanceId; f.act(f.leader, 'useTrait', { cardIds: [] }); f.player(f.leader).active.level = 2; assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => f.act(f.leader, 'useTrait', { cardIds: [] })); f.player(f.leader).reserve.catalogueId = 'magnemite'; f.act(f.leader, 'switchPokemon'); assert.equal(f.view(f.leader).self.battle.canTrait, true); f.act(f.leader, 'useTrait', { cardIds: [] }); assert.deepEqual(new Set(f.room().turn.traitsUsed), new Set([original, f.player(f.leader).active.instanceId])); f.room().turn.switchUsed = false; f.act(f.leader, 'switchPokemon'); assert.equal(f.player(f.leader).active.instanceId, original); assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => f.act(f.leader, 'useTrait', { cardIds: [] }));
});

test('Analytic survives status and move or switch blocks but respects actor, phase, vote and pending-response authority', t => {
  for (const status of ['burn', 'paralysis', 'confusion', 'sleep', 'flinch']) { const f = fixture(t); f.play('magnemite'); f.player(f.leader).active.status = status; Object.assign(f.room().turn, { movesBlocked: true, blockedMoveIds: [f.player(f.leader).active.instanceId], switchBlocked: true }); assert.equal(f.view(f.leader).self.battle.canTrait, true); f.act(f.leader, 'useTrait', { cardIds: [] }); }
  const f = fixture(t); f.play('magnemite'); rejectsAtomically(f, () => f.act(f.target, 'useTrait', { cardIds: [] }), 'NOT_YOUR_TURN'); f.room().turn.phase = 'end'; assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => f.act(f.leader, 'useTrait', { cardIds: [] })); f.room().turn.phase = 'play'; f.act(f.owner, 'requestEndGame'); rejectsAtomically(f, () => f.act(f.leader, 'useTrait', { cardIds: [] }), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); f.attack(); rejectsAtomically(f, () => f.act(f.leader, 'useTrait', { cardIds: [] }), 'RESPONSE_PENDING');
});

test('Analytic persisted exact retry exchanges once, exposes no opponent private cards and other trait families reject cardIds', t => {
  const f = fixture(t); f.play('magnemite'); const chosen = f.supply(f.leader, 'event'), drawn = f.room().drawPile.at(-1).id; const request = f.input('useTrait', { cardIds: [chosen] }); f.store.action(f.owner.code, f.leader.token, request); const before = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), before); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); const recovered = restored.view(f.owner.code, f.leader.token).view; assert.equal(recovered.self.battle.canTrait, false); assert.equal(restored.rooms.get(f.owner.code).players.find(p => p.id === f.leader.playerId).hand.filter(c => c.id === drawn).length, 1); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); for (const who of [f.target, f.third, observer]) { const view = f.view(who); assert.equal(JSON.stringify(view).includes(drawn), false); assert.equal(JSON.stringify(view).includes('privateMarker'), false); }
  for (const family of ['bulbasaur', 'psyduck', 'squirtle']) { const g = fixture(t); g.play(family); if (family === 'squirtle') g.room().turn.phase = 'end'; rejectsAtomically(g, () => g.act(g.leader, 'useTrait', { cardIds: [] })); }
});

test('Magnemite commands judge paralysis only on thunderstorm after positive damage and remain command-locked', t => {
  for (const level of [1, 2, 3]) for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) { const f = fixture(t); f.play('magnemite', level); f.judgments(weather); f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, level === 3 ? 2 : 1); assert.equal(f.player(f.target).active.status, weather === 'thunderstorm' ? 'paralysis' : null); assert.equal(f.view(f.leader).self.battle.canCommand, false); assert.equal(f.room().turn.commandCreatureId, f.player(f.leader).active.instanceId); }
});

test('Thunder Wave consumes one actual rainy card of any kind, never deals damage or consumes Power or command lock', t => {
  for (const level of [2, 3]) for (const kind of ['event', 'dodge', 'command']) for (const weather of ['rain', 'thunderstorm']) { const f = fixture(t); f.play('magnemite', level); f.player(f.leader).active.reinforcements = ['power']; const cost = f.supply(f.leader, kind, weather), actual = structuredClone(f.player(f.leader).hand[0]); f.judgments('clear'); f.attack({ cardId: cost, moveIndex: 1 }); f.respond(); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.target).active.status, 'paralysis'); assert.deepEqual(f.player(f.leader).active.reinforcements, ['power']); assert.equal(f.room().turn.commandCreatureId, null); assert.equal(f.view(f.leader).self.battle.canCommand, true); assert.equal(f.view(f.leader).self.battle.moves[1].canUse, false); assert.deepEqual(f.room().discardPile.find(c => c.id === cost), actual); assert.equal(countCard(f.room(), cost), 1); }
});

test('Thunder Wave fails only intense-sun judgment and validates rainy payment, range and selected move', t => {
  for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) { const f = fixture(t); f.play('magnemite', 2); f.judgments(weather); f.attack({ moveIndex: 1, cardId: f.supply(f.leader, 'event', 'rain') }); f.respond(); assert.equal(f.player(f.target).active.status, weather === 'intense-sun' ? null : 'paralysis'); assert.equal(f.player(f.target).active.damage, 0); }
  const f = fixture(t, { count: 6 }); f.play('magnemite', 2); const rainy = f.supply(f.leader, 'event', 'rain'), sunny = f.supply(f.leader, 'event', 'clear'), foreign = f.supply(f.target, 'event', 'rain'); const far = f.seats.find(who => !f.view(f.leader).self.battle.moves[1].legalTargetIds.includes(who.playerId)); assert.ok(far); for (const payload of [{ cardId: sunny }, { cardId: foreign }, { cardId: 'forged' }, { cardId: rainy, targetIds: [far.playerId] }, { cardId: rainy, targetIds: [f.target.playerId, f.third.playerId] }, { cardId: rainy, damage: 9 }]) rejectsAtomically(f, () => f.attack({ moveIndex: 1, ...payload })); f.player(f.leader).active.level = 1; rejectsAtomically(f, () => f.attack({ moveIndex: 1, cardId: rainy }));
});

test('magnet judgments honor Drought, Poison Touch, Limber and canceled or immune damage without extra judgments', t => {
  for (const statusMove of [false, true]) { const f = fixture(t, { count: 4 }); f.play('magnemite', 3); f.seed(f.third, 'vulpix'); const grimer = f.seats.find(who => who !== f.leader && who !== f.target && who !== f.third); f.seed(grimer, 'grimer'); f.judgments('thunderstorm'); f.attack(statusMove ? { moveIndex: 1, cardId: f.supply(f.leader, 'event', 'rain') } : {}); f.respond(); assert.equal(f.room().pendingBattle.kind, 'judgment'); f.respond(); assert.equal(f.room().pendingBattle.kind, 'poison-touch'); assert.equal(f.room().pendingBattle.status, 'paralysis'); f.respond('trait'); assert.equal(f.player(f.target).active.status, 'poison'); assert.equal(f.player(f.target).active.damage, statusMove ? 0 : 2); }
  for (const prevention of ['limber', 'dodge', 'immunity']) { const f = fixture(t); f.play('magnemite', 3); if (prevention === 'limber') f.seed(f.target, 'meowth', 3); if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; f.judgments('thunderstorm'); const top = f.room().drawPile.at(-1).id; f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); assert.equal(f.player(f.target).active.status, null); assert.equal(f.room().pendingBattle, null); if (prevention !== 'limber') { assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().drawPile.at(-1).id, top); } }
});
