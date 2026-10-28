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
  const dir = mkdtempSync(join(root, 'shell-dragon-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `shell-dragon-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates; act(who, 'selectPokemon', { activeId: candidates[0], reserveId: candidates[1] }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-shell-dragon-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private shell dragon card ${serial}` } });
  room().drawPile = Array.from({ length: 48 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const judgments = (...weather) => { for (const value of [...weather].reverse()) room().drawPile.push(makeCard('judgment-fixture', value)); };
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id), third = seats.find(who => who !== leader && who !== target);
  const play = (family = 'shellder', level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, family, level); };
  const attack = (payload = {}, who = leader) => act(who, 'attack', { cardId: payload.cardId ?? supply(who), targetIds: [target.playerId], ...payload });
  const respond = (choice = 'pass', payload = {}) => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload }); };
  const helmet = who => { const card = { ...makeCard('held-item'), itemType: 'rocky-helmet' }; player(who).active.item = card; return card; };
  const drain = () => { for (let i = 0; room().pendingBattle && i < 40; i++) { const pending = room().pendingBattle; respond(pending.kind === 'effects' ? 'effect' : 'pass', pending.kind === 'effects' ? { effect: pending.effects[0] } : {}); } assert.equal(room().pendingBattle, null); };
  return { store, dir, now, owner, seats, leader, target, third, room, player, byId, view, input, act, seed, makeCard, supply, judgments, play, attack, respond, helmet, drain, advance: ms => { time += ms; } };
}
function rejectsAtomically(f, action, code) { const before = structuredClone(f.room()); assert.throws(action, error => code === undefined || error.code === code); assert.deepEqual(f.room(), before); }
const ids = cards => cards.map(card => card.id);
const allCards = room => [...room.drawPile, ...room.discardPile, ...room.players.flatMap(p => [...(p.hand || []), ...[p.active?.item, p.reserve?.item].filter(Boolean)]), ...[room.resolution, ...(room.resolutionStack || [])].flatMap(r => r?.card && !r.cardClaimedBy ? [r.card] : []), ...(room.judgment?.card ? [room.judgment.card] : [])];
const countCard = (room, id) => allCards(room).filter(card => card.id === id).length;
const publicChoice = ({ id, name, weather, kind }) => ({ id, name, weather, kind });

// Every scenario starts through the legal shared roster/deck setup; explicit seeds
// isolate printed combat effects without relying on shuffled candidates or roles.
test('all six shell and dragon faces expose the reviewed printed damage and targeting', t => {
  for (const family of ['shellder', 'dratini']) {
    assert.deepEqual(catalogue.entries.find(p => p.id === family).levels.map(p => p.effectStatus), Array(3).fill('combat-preview'));
    for (const level of [1, 2, 3]) { const f = fixture(t); f.play(family, level); const battle = f.view(f.leader).self.battle; assert.equal(battle.canCommand, true); assert.equal(battle.move.printedValue, level === 1 ? 1 : 2); assert.equal(battle.moves[0].maxTargets, family === 'dratini' && level === 3 ? 2 : 1); assert.equal(battle.move.maxTargets, battle.moves[0].maxTargets); }
  }
});

test('Skill Link allows repeated same-instance commands at all levels with a fresh real payment each time', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t); f.play('shellder', level); const paid = []; for (let n = 0; n < 3; n++) { f.judgments('clear'); const cardId = f.supply(f.leader); paid.push(cardId); f.attack({ cardId }); f.drain(); assert.equal(f.view(f.leader).self.battle.canCommand, true); assert.equal(f.room().turn.commandCreatureId, f.player(f.leader).active.instanceId); } assert.equal(f.player(f.target).active.damage, (level === 1 ? 1 : 2) * 3); for (const id of paid) assert.equal(f.room().discardPile.filter(c => c.id === id).length, 1); }
});

test('Skill Link preserves the one command-user instance lock across ordinary switching in either order', t => {
  for (const first of ['shellder', 'squirtle']) { const f = fixture(t); f.play(first, 1); f.player(f.leader).reserve.catalogueId = first === 'shellder' ? 'squirtle' : 'shellder'; f.attack(); f.drain(); const locked = f.room().turn.commandCreatureId; f.act(f.leader, 'switchPokemon'); assert.equal(f.view(f.leader).self.battle.canCommand, false); const cardId = f.supply(f.leader); rejectsAtomically(f, () => f.attack({ cardId })); assert.equal(f.room().turn.commandCreatureId, locked); }
});

test('Skill Link retains range, command payment, paralysis, move blocks and pending-response restrictions', t => {
  const f = fixture(t, { count: 6 }); f.play(); const command = f.supply(f.leader), wrong = f.supply(f.leader, 'event'), foreign = f.supply(f.target); const far = f.seats.find(who => !f.view(f.leader).self.battle.legalTargetIds.includes(who.playerId)); assert.ok(far);
  for (const payload of [{ cardId: wrong }, { cardId: foreign }, { cardId: 'forged' }, { cardId: command, targetIds: [far.playerId] }, { cardId: command, moveIndex: 1 }, { cardId: command, damage: 99 }]) rejectsAtomically(f, () => f.attack(payload));
  f.player(f.leader).active.status = 'paralysis'; const rainy = f.supply(f.leader, 'command', 'rain'); rejectsAtomically(f, () => f.attack({ cardId: rainy })); f.player(f.leader).active.status = null;
  for (const restriction of ['movesBlocked', 'blockedMoveIds']) { f.room().turn[restriction] = restriction === 'movesBlocked' ? true : [f.player(f.leader).active.instanceId]; rejectsAtomically(f, () => f.attack({ cardId: command })); f.room().turn[restriction] = restriction === 'movesBlocked' ? false : []; }
  f.attack({ cardId: command }); rejectsAtomically(f, () => f.attack({ cardId: f.player(f.leader).hand[0].id }), 'RESPONSE_PENDING'); rejectsAtomically(f, () => f.act(f.leader, 'switchPokemon'), 'RESPONSE_PENDING');
});

test('Spike Cannon discards the chosen real hand card then draws once before Static may respond', t => {
  const f = fixture(t); f.play('shellder', 2); f.seed(f.target, 'pikachu'); const chosen = f.supply(f.leader, 'dodge', 'rain'), kept = f.supply(f.leader, 'event'); const actual = structuredClone(f.player(f.leader).hand[0]), top = structuredClone(f.room().drawPile.at(-1)); f.attack(); f.respond();
  assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle.kind, 'cycle'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); f.respond('cycle', { cardId: chosen });
  assert.deepEqual(f.room().discardPile.find(card => card.id === chosen), actual); assert.deepEqual(ids(f.player(f.leader).hand), [kept, top.id]); assert.deepEqual(f.player(f.leader).hand.at(-1), top); assert.equal(f.room().pendingBattle.kind, 'static'); assert.equal(countCard(f.room(), chosen), 1); assert.equal(countCard(f.room(), top.id), 1); f.respond();
});

test('Spike Cannon pass keeps the hand and empty-hand settlement never draws for free', t => {
  for (const spare of [false, true]) { const f = fixture(t); f.play('shellder', 2); if (spare) f.supply(f.leader, 'event'); const before = structuredClone(f.player(f.leader).hand), deck = f.room().drawPile.length; f.attack(); f.respond(); if (f.room().pendingBattle) { assert.equal(f.room().pendingBattle.kind, 'cycle'); f.respond(); } assert.deepEqual(f.player(f.leader).hand, before); assert.equal(f.room().drawPile.length, deck); assert.equal(f.player(f.target).active.damage, 2); }
});

test('canceled or damage-immune Spike Cannon never offers a cycle or draws', t => {
  for (const cancellation of ['dodge', 'immunity']) { const f = fixture(t); f.play('shellder', 2); f.supply(f.leader, 'event'); const top = f.room().drawPile.at(-1).id; if (cancellation === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; f.attack(); f.respond(cancellation === 'dodge' ? 'dodge' : 'pass', cancellation === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().drawPile.at(-1).id, top); }
});

test('cycle choices reveal only acting owner card stubs and hide hand IDs and nested state from others', t => {
  const f = fixture(t); f.play('shellder', 2); f.supply(f.leader, 'event', 'rain'); f.supply(f.leader, 'dodge'); const cards = structuredClone(f.player(f.leader).hand); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); f.attack(); f.respond(); assert.deepEqual(f.view(f.leader).pendingBattle.cards, cards.map(publicChoice));
  for (const who of [f.target, f.third, observer]) { const view = f.view(who); assert.equal(view.pendingBattle.cards, undefined); assert.equal(view.resolution, undefined); assert.equal(view.resolutionStack, undefined); for (const card of cards) { assert.equal(JSON.stringify(view).includes(card.id), false); assert.equal(JSON.stringify(view).includes(card.privateMarker), false); } }
});

test('cycle authority, stale IDs, non-hand payments and extra response fields reject atomically', t => {
  const f = fixture(t); f.play('shellder', 2); const own = f.supply(f.leader, 'event'), foreign = f.supply(f.target); f.attack(); f.respond(); const decisionId = f.room().pendingBattle.id;
  rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId, choice: 'cycle', cardId: foreign }), 'NOT_YOUR_DECISION');
  for (const payload of [{ choice: 'cycle', cardId: foreign }, { choice: 'cycle', cardId: 'forged' }, { choice: 'cycle' }, { choice: 'trait' }, { choice: 'pass', cardId: own }, { choice: 'cycle', cardId: own, effect: 'draw' }, { choice: 'cycle', cardId: own, handIndex: 0 }, { choice: 'cycle', cardId: own, order: [] }, { choice: 'cycle', cardId: own, reinforcement: 'power' }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId, ...payload }));
  rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: 'stale', choice: 'pass' }), 'STALE_DECISION');
});

test('cycle saved decision and exact retry draw once and resume the receiving continuation once after restart', t => {
  const f = fixture(t); f.play('shellder', 2); f.seed(f.target, 'pikachu'); const chosen = f.supply(f.leader, 'event'), top = f.room().drawPile.at(-1).id; f.attack(); f.respond(); const pending = structuredClone(f.room().pendingBattle); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); const recovered = restored.view(f.owner.code, f.leader.token).view; assert.equal(recovered.pendingBattle.id, pending.id);
  const request = { id: 'restored-cycle-once', revision: recovered.revision, type: 'respondBattle', decisionId: pending.id, choice: 'cycle', cardId: chosen }; restored.action(f.owner.code, f.leader.token, request); const state = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.leader.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), state); assert.equal(state.pendingBattle.kind, 'static'); assert.equal(state.players.find(p => p.id === f.target.playerId).active.damage, 2); assert.equal(state.players.find(p => p.id === f.leader.playerId).hand.filter(c => c.id === top).length, 1); assert.equal(state.discardPile.filter(c => c.id === chosen).length, 1);
});

test('cycle clocks pause for votes and disconnects and expire optionally as pass without spending turn time', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play('shellder', 2); f.supply(f.leader, 'event'); f.advance(1_000); f.attack(); f.respond(); const top = f.room().drawPile.at(-1).id; f.advance(2_000); f.act(f.owner, 'requestEndGame'); f.advance(8_000); assert.equal(f.view(f.leader).pendingBattle.clock.remainingMs, 3_000); rejectsAtomically(f, () => f.respond(), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd');
  f.advance(3_000); const view = f.view(f.leader); assert.equal(view.pendingBattle, null); assert.equal(f.room().drawPile.at(-1).id, top); assert.equal(view.turn.clock.remainingMs, 59_000);
  const g = fixture(t, { responseSeconds: 60 }); g.play('shellder', 2); g.supply(g.leader, 'event'); g.attack(); g.respond(); const pendingId = g.room().pendingBattle.id; g.advance(CONNECTED_MS + 1_000); const paused = g.view(g.target).pendingBattle; assert.equal(paused.clock.pausedReason, 'disconnected'); const remaining = paused.clock.remainingMs; g.advance(5_000); assert.equal(g.view(g.target).pendingBattle.clock.remainingMs, remaining); const restored = new RoomStore({ dataDir: g.dir, catalogue, now: g.now }); const recovered = restored.view(g.owner.code, g.leader.token).view; assert.equal(recovered.pendingBattle.id, pendingId); assert.equal(recovered.pendingBattle.clock.remainingMs, remaining);
});

test('Icicle Spear gains only the final rainy judgment card with its exact identity and conserves zones', t => {
  for (const weather of ['rain', 'thunderstorm', 'clear', 'intense-sun']) { const f = fixture(t); f.play('shellder', 3); f.judgments(weather); const judged = structuredClone(f.room().drawPile.at(-1)); f.attack(); f.respond(); const rainy = ['rain', 'thunderstorm'].includes(weather); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.target).active.damage, 2); assert.deepEqual((rainy ? f.player(f.leader).hand : f.room().discardPile).find(c => c.id === judged.id), judged); assert.equal((rainy ? f.room().discardPile : f.player(f.leader).hand).some(c => c.id === judged.id), false); assert.equal(countCard(f.room(), judged.id), 1); }
});

test('Icicle Spear waits for every Drought actor and uses the final card after actual exchanges', t => {
  for (const replace of [false, true]) { const f = fixture(t); f.play('shellder', 3); f.seed(f.target, 'vulpix', 1); f.seed(f.third, 'vulpix', 2); const first = f.supply(f.target, 'event', 'clear'), second = f.supply(f.third, 'event', 'intense-sun'); const firstCard = structuredClone(f.player(f.target).hand[0]), secondCard = structuredClone(f.player(f.third).hand[0]); f.judgments('thunderstorm'); const original = structuredClone(f.room().drawPile.at(-1)); f.attack(); f.respond();
    assert.equal(f.room().pendingBattle.kind, 'judgment'); assert.equal(f.room().pendingBattle.actorId, f.target.playerId); assert.equal(f.player(f.leader).hand.some(c => c.id === original.id), false); f.respond(replace ? 'replace' : 'pass', replace ? { cardId: first } : {}); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); f.respond(replace ? 'replace' : 'pass', replace ? { cardId: second } : {}); assert.equal(f.room().pendingBattle, null);
    if (replace) { assert.deepEqual(f.player(f.target).hand.find(c => c.id === original.id), original); assert.deepEqual(f.player(f.third).hand.find(c => c.id === first), firstCard); assert.deepEqual(f.room().discardPile.find(c => c.id === second), secondCard); assert.equal(f.player(f.leader).hand.length, 0); } else assert.deepEqual(f.player(f.leader).hand.find(c => c.id === original.id), original);
    for (const id of [first, second, original.id]) assert.equal(countCard(f.room(), id), 1);
  }
});

test('Icicle Spear final-card gain finishes before target receiving effects and cannot retrigger itself', t => {
  const f = fixture(t); f.play('shellder', 3); f.seed(f.target, 'abra', 1); f.seed(f.third, 'vulpix', 1); f.judgments('rain'); const original = f.room().drawPile.at(-1).id; f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'judgment'); f.respond(); assert.equal(f.room().pendingBattle.kind, 'synchronize'); assert.ok(f.player(f.leader).hand.some(c => c.id === original)); const deckSize = f.room().drawPile.length; f.respond('trait'); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().drawPile.length, deckSize); assert.equal(f.player(f.target).active.damage, 2); assert.equal(countCard(f.room(), original), 1);
});

test('Dodged Icicle Spear does not reveal a judgment or gain a card', t => {
  const f = fixture(t); f.play('shellder', 3); f.judgments('rain'); const top = f.room().drawPile.at(-1).id; f.attack(); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().drawPile.at(-1).id, top); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(f.player(f.target).active.damage, 0);
});

test('Dragon Rage and Draco Meteor ignore Speed range, Power boost and Defense cap while retaining ordinary marker consumption', t => {
  for (const level of [2, 3]) { const f = fixture(t, { count: 6 }); f.play('dratini', level); const far = f.seats.find(who => !f.view(f.leader).self.battle.legalTargetIds.includes(who.playerId)); assert.ok(far); const command = f.supply(f.leader); rejectsAtomically(f, () => f.attack({ cardId: command, targetIds: [far.playerId] })); f.player(f.leader).active.reinforcements = ['power', 'speed']; f.player(f.target).active.reinforcements = ['defense']; assert.equal(f.view(f.leader).self.battle.legalTargetIds.includes(far.playerId), false); f.attack({ cardId: command }); assert.deepEqual(f.player(f.leader).active.reinforcements, ['speed']); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.deepEqual(f.player(f.target).active.reinforcements, []); }
});

test('Dragon Rage and Draco Meteor cannot be canceled by Dodge or Sand Veil', t => {
  for (const level of [2, 3]) { const f = fixture(t); f.play('dratini', level); f.seed(f.target, 'sandshrew', 1); const dodge = f.supply(f.target, 'dodge'); f.judgments('clear'); const top = f.room().drawPile.at(-1).id; f.attack(); assert.equal(f.room().pendingBattle.cannotDodge, true); assert.equal(f.room().pendingBattle.canTrait, false); rejectsAtomically(f, () => f.respond('dodge', { cardId: dodge })); rejectsAtomically(f, () => f.respond('trait')); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.ok(f.player(f.target).hand.some(c => c.id === dodge)); assert.equal(f.room().drawPile.at(-1).id, top); }
});

test('Twister keeps ordinary reinforcement damage, Speed range and Dodge behavior', t => {
  const f = fixture(t, { count: 6 }); f.play('dratini', 1); const far = f.seats.find(who => !f.view(f.leader).self.battle.legalTargetIds.includes(who.playerId)); f.player(f.leader).active.reinforcements = ['power', 'speed']; f.player(far).active.reinforcements = ['defense']; assert.ok(f.view(f.leader).self.battle.legalTargetIds.includes(far.playerId)); f.attack({ targetIds: [far.playerId] }); f.respond(); assert.equal(f.player(far).active.damage, 1); assert.deepEqual(f.player(far).active.reinforcements, []);
  const g = fixture(t); g.play('dratini', 1); g.attack(); g.respond('dodge', { cardId: g.supply(g.target, 'dodge') }); assert.equal(g.player(g.target).active.damage, 0); assert.equal(g.room().pendingBattle, null);
});

test('Draco Meteor resolves two distinct targets independently while Dragon Rage remains single-target', t => {
  for (const level of [2, 3]) { const f = fixture(t); f.play('dratini', level); const command = f.supply(f.leader); for (const targetIds of [[], [f.target.playerId, f.target.playerId], ['missing'], [f.target.playerId, f.third.playerId, f.leader.playerId]]) rejectsAtomically(f, () => f.attack({ cardId: command, targetIds }));
    if (level === 2) rejectsAtomically(f, () => f.attack({ cardId: command, targetIds: [f.target.playerId, f.third.playerId] }));
    else { f.player(f.target).active.reinforcements = ['defense']; f.player(f.third).active.reinforcements = ['defense']; f.attack({ cardId: command, targetIds: [f.target.playerId, f.third.playerId] }); f.respond(); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.third).active.damage, 0); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); assert.equal(f.room().pendingBattle.cannotDodge, true); f.respond(); assert.equal(f.player(f.third).active.damage, 2); assert.deepEqual(f.player(f.target).active.reinforcements, []); assert.deepEqual(f.player(f.third).active.reinforcements, []); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().discardPile.filter(c => c.id === command).length, 1); }
  }
});

test('dragon command moves retain once-per-instance use, paralysis payment and switch restrictions', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t); f.play('dratini', level); f.player(f.leader).active.status = 'paralysis'; const rain = f.supply(f.leader, 'command', 'rain'); rejectsAtomically(f, () => f.attack({ cardId: rain })); f.attack(); f.drain(); assert.equal(f.view(f.leader).self.battle.canCommand, false); const cardId = f.supply(f.leader); rejectsAtomically(f, () => f.attack({ cardId })); f.room().turn.switchBlocked = true; rejectsAtomically(f, () => f.act(f.leader, 'switchPokemon')); }
});

test('Multiscale caps mandatory incoming move damage only while uninjured, including Power and self-targeting', t => {
  for (const [damage, expected] of [[0, 1], [1, 3]]) { const f = fixture(t); f.play('squirtle', 3); f.seed(f.target, 'dratini', 3, { damage }); f.player(f.leader).active.reinforcements = ['power']; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, damage + expected); assert.equal(f.room().pendingBattle, null); }
  const f = fixture(t); f.play('dratini', 3); f.attack({ targetIds: [f.leader.playerId] }); f.respond(); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.room().pendingBattle, null);
});

test('Marvel Scale optionally reduces incoming damage by one for every existing status on levels one and two', t => {
  for (const level of [1, 2]) for (const status of ['burn', 'poison', 'confusion', 'paralysis', 'flinch']) { const f = fixture(t); f.play('squirtle', 3); f.seed(f.target, 'dratini', level, { status }); f.player(f.leader).active.reinforcements = ['power']; f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'scales'); assert.equal(f.room().pendingBattle.actorId, f.target.playerId); assert.equal(f.room().pendingBattle.trait, 'marvel-scale'); assert.equal(f.room().pendingBattle.damage, 3); assert.equal(f.player(f.target).active.damage, 0); f.respond('trait'); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle, null); }
});

test('Defense and source damage modifications run before Marvel Scale and omit irrelevant offers', t => {
  for (const scenario of ['healthy', 'defense', 'burned-source', 'one-damage']) { const f = fixture(t); f.play(scenario === 'one-damage' ? 'shellder' : 'squirtle', scenario === 'one-damage' ? 1 : 3); f.seed(f.target, 'dratini', 2, { status: scenario === 'healthy' ? null : 'poison', reinforcements: scenario === 'defense' ? ['defense'] : [] }); if (scenario === 'burned-source') f.player(f.leader).active.status = 'burn'; f.attack(); f.respond(); assert.equal(f.room().pendingBattle, null, scenario); assert.equal(f.player(f.target).active.damage, scenario === 'healthy' ? 2 : 1, scenario); }
});

test('Marvel Scale pass applies the original incoming amount and rejects unauthorized or extra payloads atomically', t => {
  const f = fixture(t); f.play('squirtle', 3); f.seed(f.target, 'dratini', 2, { status: 'poison' }); f.attack(); f.respond(); const decisionId = f.room().pendingBattle.id;
  rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId, choice: 'trait' }), 'NOT_YOUR_DECISION');
  for (const payload of [{ choice: 'dodge' }, { choice: 'trait', cardId: 'forged' }, { choice: 'trait', handIndex: 0 }, { choice: 'trait', order: [] }, { choice: 'trait', reinforcement: 'defense' }, { choice: 'trait', effect: 'marvel-scale' }, { choice: 'pass', cardId: 'forged' }]) rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId, ...payload }));
  rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: 'stale', choice: 'trait' }), 'STALE_DECISION'); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle, null);
});

test('saved Marvel Scale resumes before applying damage and exact retry cannot subtract or apply it twice', t => {
  const f = fixture(t); f.play('squirtle', 3); f.seed(f.target, 'dratini', 1, { status: 'poison' }); f.attack(); f.respond(); const pending = structuredClone(f.room().pendingBattle), resolution = structuredClone(f.room().resolution); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); const recovered = restored.view(f.owner.code, f.target.token).view; assert.equal(recovered.pendingBattle.id, pending.id); assert.deepEqual(restored.rooms.get(f.owner.code).resolution, resolution); assert.equal(restored.rooms.get(f.owner.code).players.find(p => p.id === f.target.playerId).active.damage, 0);
  const request = { id: 'restored-scales-once', revision: recovered.revision, type: 'respondBattle', decisionId: pending.id, choice: 'trait' }; restored.action(f.owner.code, f.target.token, request); const committed = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.target.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), committed); assert.equal(committed.players.find(p => p.id === f.target.playerId).active.damage, 1); assert.equal(committed.pendingBattle, null);
});

test('Marvel Scale optional timeout passes, pauses for votes and keeps private pending damage machinery hidden', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play('squirtle', 3); f.seed(f.target, 'dratini', 2, { status: 'poison' }); f.advance(1_000); f.attack(); f.respond(); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); for (const who of [f.leader, f.target, observer]) { const view = f.view(who); assert.equal(view.pendingBattle.damage, 2); assert.equal(view.resolution, undefined); assert.equal(view.resolutionStack, undefined); }
  f.advance(2_000); f.act(f.owner, 'requestEndGame'); f.advance(8_000); assert.equal(f.view(f.target).pendingBattle.clock.remainingMs, 3_000); rejectsAtomically(f, () => f.respond('trait'), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); f.advance(3_000); const view = f.view(f.target); assert.equal(view.pendingBattle, null); assert.equal(f.player(f.target).active.damage, 2); assert.equal(view.turn.clock.remainingMs, 59_000);
});

test('turn-start confusion uses Multiscale and omits irrelevant Marvel Scale offers', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t); f.play(); f.seed(f.target, 'dratini', level, { status: 'confusion', reinforcements: ['power'] });
    // Confusion deals printed one: Multiscale remains mandatory, while an
    // irrelevant Marvel Scale offer must never stall the new turn.
    f.store.startTurn(f.room(), f.target.playerId, 2); assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().turn.phase, 'draw'); }
});

test('Rocky Helmet damage uses Multiscale and a persisted nested Marvel Scale decision preserves its parent and all card zones', t => {
  for (const level of [2, 3]) { const f = fixture(t); f.play('dratini', level); f.player(f.leader).active.status = 'poison'; f.seed(f.target, 'charmander', 1, { damage: 20 }); const held = f.helmet(f.target); const command = f.supply(f.leader); f.attack({ cardId: command }); f.respond();
    if (level === 3) { assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.room().pendingBattle, null); }
    else { assert.equal(f.room().pendingBattle.kind, 'scales'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); assert.equal(f.room().resolutionStack.length, 1); assert.equal(f.player(f.leader).active.damage, 0); const pendingId = f.room().pendingBattle.id, parent = structuredClone(f.room().resolutionStack); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); const view = restored.view(f.owner.code, f.leader.token).view; assert.equal(view.pendingBattle.id, pendingId); assert.deepEqual(restored.rooms.get(f.owner.code).resolutionStack, parent); restored.action(f.owner.code, f.leader.token, { id: 'nested-scales-once', revision: view.revision, type: 'respondBattle', decisionId: pendingId, choice: 'trait' }); const state = restored.rooms.get(f.owner.code); assert.equal(state.pendingBattle, null); assert.equal(state.resolution, null); assert.equal(state.players.find(p => p.id === f.leader.playerId).active.damage, 2); assert.equal(countCard(state, command), 1); assert.equal(countCard(state, held.id), 1); assert.deepEqual(state.players.find(p => p.id === f.target.playerId).active.item, held); }
  }
});

test('unimplemented selectable groups retain closed command and target execution', t => {
  const unsupported = catalogue.entries.find(entry => entry.selectionEligible && entry.levels.every(face => face.effectStatus !== 'combat-preview')); assert.ok(unsupported, 'Some reviewed roster groups remain intentionally non-executable'); const f = fixture(t); f.play(unsupported.id, 1); const cardId = f.supply(f.leader); assert.equal(f.view(f.leader).self.battle.canCommand, false); rejectsAtomically(f, () => f.attack({ cardId })); f.seed(f.leader, 'shellder', 1); f.seed(f.target, unsupported.id, 1); assert.equal(f.view(f.leader).self.battle.legalTargetIds.includes(f.target.playerId), false); rejectsAtomically(f, () => f.attack({ cardId }));
});


