import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore } from '../server/store.js';



const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));
function fixture(t, { count = 3, turnSeconds = 0, responseSeconds = 0 } = {}) {
  const root = fileURLToPath(new URL('../.data/', import.meta.url));
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'scyther-jynx-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ allowTestDecks: true, dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `scyther-jynx-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates, activeId = candidates.find(id => !['koffing','jynx','tauros'].includes(id)); act(who, 'selectPokemon', { activeId, reserveId: candidates.find(id => id !== activeId) }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-scyther-jynx-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private Scyther Jynx card ${serial}` } });
  room().drawPile = Array.from({ length: 48 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const top = (...weather) => { const cards = weather.map(value => makeCard('reveal-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const judgments = (...weather) => { const cards = weather.map(value => makeCard('judgment-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id), third = seats.find(who => who !== leader && who !== target);
  const play = (family = 'scyther', level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, family, level); };
  const attack = (payload = {}, who = leader) => act(who, 'attack', { cardId: payload.cardId ?? supply(who), targetIds: [target.playerId], ...payload });
  const respond = (choice = 'pass', payload = {}) => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload }); };
  const order = effect => respond('damage-effect', { effect });
  const helmet = who => { const card = { ...makeCard('held-item'), itemType: 'rocky-helmet' }; player(who).active.item = card; return card; };
  const drain = () => { for (let i = 0; room().pendingBattle && i < 100; i++) { const pending = room().pendingBattle; if (pending.kind === 'sweet-kiss') respond('discard', { cardIds: player(byId(pending.actorId)).hand.slice(0, 2).map(card => card.id) }); else if (pending.kind === 'damage-order') order(pending.effects[0]); else respond(pending.kind === 'effects' ? 'effect' : 'pass', pending.kind === 'effects' ? { effect: pending.effects[0] } : {}); } assert.equal(room().pendingBattle, null); };
  const startStatus = (status = 'poison', who = target) => { player(who).active.status = status; store.startTurn(room(), who.playerId, 2); };
  return { store, dir, now, owner, seats, leader, target, third, room, player, byId, view, input, act, seed, makeCard, supply, top, judgments, play, attack, respond, order, helmet, drain, startStatus, advance: ms => { time += ms; } };
}
function rejectsAtomically(f, action, code) { const before = structuredClone(f.room()); assert.throws(action, error => code === undefined || error.code === code); assert.deepEqual(f.room(), before); }
const ids = cards => cards.map(card => card.id);
const publicFace = ({ name, weather, kind }) => ({ name, weather, kind });
const publicHand = ({ id, name, weather, kind }) => ({ id, name, weather, kind });
const allCards = room => [...room.drawPile, ...room.discardPile, ...room.players.flatMap(p => [...(p.hand || []), ...[p.active?.item, p.reserve?.item].filter(Boolean)]), ...[room.resolution, ...(room.resolutionStack || [])].flatMap(r => r ? [...(r.card && !r.cardClaimedBy ? [r.card] : []), ...(r.revealedCards || [])] : []), ...(room.judgment?.card ? [room.judgment.card] : [])];
const countCard = (room, id) => allCards(room).filter(card => card.id === id).length;

const start = (f, who = f.leader) => f.store.startTurn(f.room(), who.playerId, f.room().turn.number + 1);
const drawToPlay = f => { while (f.room().turn.drawRemaining) f.act(f.leader, 'draw'); };
const moves = f => f.view(f.leader).self.battle.moves;
const powerCount = pokemon => pokemon.reinforcements.filter(marker => marker === 'power').length;
const dance = (f, moveIndex = 1, weather = 'clear') => f.attack({ moveIndex, cardId: f.supply(f.leader, 'event', weather), targetIds: [f.leader.playerId] });
const forewarn = f => { assert.equal(f.room().pendingBattle.kind, 'forewarn'); f.respond('trait'); };
const reorder = (f, topOrder, bottomOrder) => f.respond('order', { topOrder, bottomOrder });
const prep = (f, level = 1, extra = {}) => { f.seed(f.leader, 'jynx', level, extra); start(f); };

test('both families expose reviewed HP and native face damage values', t => {
  for (const [family, hp, values] of [['scyther', [3, 4, 4], [1, 1, 3]], ['jynx', [3, 4, 4], [1, 1, null]]]) {
    const entry = catalogue.entries.find(entry => entry.id === family); assert.deepEqual(entry.levels.map(face => face.hp), hp); assert.deepEqual(entry.levels.map(face => face.effectStatus), Array(3).fill('combat-preview'));
    for (const level of [1, 2, 3]) { const f = fixture(t); f.play(family, level); assert.equal(moves(f)[0].printedValue, values[level - 1]); assert.equal(moves(f)[0].condition.kind, 'command'); assert.equal(f.view(f.leader).self.battle.canTrait, false); }
  }
});

test('catalogue and roster retain the Scyther/Jynx baseline and agree on current coverage', () => {
  assert.ok(catalogue.metadata.combatSupportedGroups >= 33); assert.ok(catalogue.metadata.effectReviewedGroups >= 34); assert.ok(catalogue.metadata.effectReviewedFaces >= 102);
  const supported = catalogue.entries.filter(entry => entry.levels.every(face => face.effectStatus === 'combat-preview')); assert.equal(supported.length, catalogue.metadata.combatSupportedGroups); assert.equal(supported.flatMap(entry => entry.levels).length, supported.length * 3);
  const roster = JSON.parse(readFileSync(new URL('../content/selection-roster.json', import.meta.url), 'utf8')); assert.equal(roster.entries.filter(entry => entry.supportedEffects).length, supported.length); for (const id of ['scyther', 'jynx', 'chansey']) assert.equal(roster.entries.find(entry => entry.id === id).supportedEffects, true); assert.ok(catalogue.entries.find(entry => entry.id === 'chansey').levels.every(face => face.effectStatus === 'combat-preview'));
});

test('Technician exposes native moves first then lower faces in ascending order', t => {
  for (const [level, expected] of [[1, ['u-turn']], [2, ['fury-cutter', 'swords-dance', 'u-turn']], [3, ['x-scissor', 'u-turn', 'fury-cutter', 'swords-dance']]]) { const f = fixture(t); f.play('scyther', level); assert.deepEqual(moves(f).map(move => move.effectKind), expected); assert.deepEqual(moves(f).map(move => move.index), expected.map((_, index) => index)); }
});

test('inherited move use follows instance and move name through evolution', t => {
  const f = fixture(t); f.play(); f.attack(); f.drain(); f.player(f.leader).active.level = 2; assert.equal(moves(f)[2].effectKind, 'u-turn'); assert.equal(moves(f)[2].canUse, false); assert.equal(moves(f)[0].canUse, true); f.player(f.leader).active.level = 3; assert.equal(moves(f)[1].canUse, false); assert.equal(moves(f)[0].canUse, true); assert.equal(moves(f)[2].canUse, true);
});

test('ordinary command consumes all effective Power and adds their count', t => {
  const f = fixture(t); f.play('squirtle'); f.player(f.leader).active.reinforcements = ['power', 'defense', 'power', 'power']; f.attack(); assert.deepEqual(f.player(f.leader).active.reinforcements, ['defense']); f.respond(); assert.equal(f.player(f.target).active.damage, 5);
});

test('paralysis keeps all ordinary Power inactive and unconsumed', t => {
  const f = fixture(t); f.play('squirtle'); f.player(f.leader).active.status = 'paralysis'; f.player(f.leader).active.reinforcements = ['power', 'power', 'power']; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(powerCount(f.player(f.leader).active), 3);
});

test('Fury Cutter gains its source damage value before receiving Defense without boosting itself', t => {
  for (const defense of [false, true]) { const f = fixture(t); f.play('scyther', 2); f.player(f.leader).active.reinforcements = ['power', 'power']; if (defense) f.player(f.target).active.reinforcements = ['defense']; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, defense ? 1 : 3); assert.equal(powerCount(f.player(f.leader).active), 3); }
});

test('Fury Cutter grant survives later Shed Skin reduction to zero', t => {
  const f = fixture(t); f.play('scyther', 2); f.seed(f.target, 'caterpie', 2); const cost = f.supply(f.target, 'event'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'shed-skin'); assert.equal(powerCount(f.player(f.leader).active), 1); f.respond('shed', { cardIds: [cost] }); assert.equal(f.player(f.target).active.damage, 0); assert.equal(powerCount(f.player(f.leader).active), 1);
});

test('Fury Cutter gets no Power after Dodge or known immunity', t => {
  for (const prevention of ['dodge', 'immunity']) { const f = fixture(t); f.play('scyther', 2); if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); assert.equal(powerCount(f.player(f.leader).active), 0); assert.equal(f.player(f.target).active.damage, 0); }
});

test('Burn caps Fury Cutter source value and its marker grant before Defense', t => {
  const f = fixture(t); f.play('scyther', 2); f.player(f.leader).active.status = 'burn'; f.player(f.leader).active.reinforcements = ['power', 'power', 'power']; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 1); assert.equal(powerCount(f.player(f.leader).active), 1);
});

test('Swords Dance accepts both sunny card weathers and stacks without consuming existing Power', t => {
  for (const weather of ['intense-sun', 'clear']) { const f = fixture(t); f.play('scyther', 2); f.player(f.leader).active.reinforcements = ['power', 'power']; dance(f, 1, weather); f.respond(); assert.equal(powerCount(f.player(f.leader).active), 3); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.room().turn.commandCreatureId, null); }
});

test('paralyzed Swords Dance stacks Power but rejects rainy cost and another target', t => {
  const f = fixture(t); f.play('scyther', 2); f.player(f.leader).active.status = 'paralysis'; f.player(f.leader).active.reinforcements = ['power', 'power']; const rain = f.supply(f.leader, 'event', 'rain'), sunny = f.supply(f.leader, 'event', 'clear'); rejectsAtomically(f, () => f.attack({ cardId: rain, moveIndex: 1, targetIds: [f.leader.playerId] })); rejectsAtomically(f, () => f.attack({ cardId: sunny, moveIndex: 1 })); dance(f); f.respond(); assert.equal(powerCount(f.player(f.leader).active), 3);
});

test('Swords Dance is independent of commands and its Power boosts a later Fury Cutter', t => {
  const f = fixture(t); f.play('scyther', 2); dance(f); f.respond(); assert.equal(moves(f)[1].canUse, false); assert.equal(moves(f)[0].canUse, true); f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(powerCount(f.player(f.leader).active), 2);
});

test('normal X-Scissor consumes all Power and is canceled by one Dodge', t => {
  for (const effectChoice of [undefined, 'normal']) { const f = fixture(t); f.play('scyther', 3); f.player(f.leader).active.reinforcements = ['power', 'power']; f.attack({ effectChoice }); assert.equal(powerCount(f.player(f.leader).active), 0); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().pendingBattle, null); }
});

test('X-Scissor spends one physical Power before consuming the remaining boost', t => {
  const f = fixture(t); f.play('scyther', 3); f.player(f.leader).active.reinforcements = ['power', 'power', 'power']; f.attack({ effectChoice: 'double-dodge' }); assert.equal(powerCount(f.player(f.leader).active), 0); assert.equal(f.view(f.target).pendingBattle.dodgesRequired, 2); assert.equal(f.view(f.target).pendingBattle.dodgesPlayed, 0); f.respond(); assert.equal(f.player(f.target).active.damage, 5);
});

test('paralyzed X-Scissor can physically pay one inactive Power while keeping the remainder', t => {
  const f = fixture(t); f.play('scyther', 3); f.player(f.leader).active.status = 'paralysis'; f.player(f.leader).active.reinforcements = ['power', 'power', 'power']; f.attack({ effectChoice: 'double-dodge' }); assert.equal(powerCount(f.player(f.leader).active), 2); f.respond(); assert.equal(f.player(f.target).active.damage, 3);
});

test('X-Scissor validates its choice and physical marker before card payment', t => {
  const f = fixture(t); f.play('scyther', 3); const cardId = f.supply(f.leader); rejectsAtomically(f, () => f.attack({ cardId, effectChoice: 'double-dodge' })); for (const effectChoice of [null, 'boost', 'double', 1, {}, []]) rejectsAtomically(f, () => f.attack({ cardId, effectChoice }));
  for (const [family, level] of [['scyther', 1], ['scyther', 2], ['jynx', 1], ['jynx', 3]]) { const g = fixture(t); g.play(family, level); const cost = g.supply(g.leader); rejectsAtomically(g, () => g.attack({ cardId: cost, effectChoice: 'normal' })); }
});

test('first X-Scissor Dodge keeps the decision and clock while the second cancels', t => {
  const f = fixture(t, { responseSeconds: 5 }); f.play('scyther', 3); f.player(f.leader).active.reinforcements = ['power']; f.attack({ effectChoice: 'double-dodge' }); const before = structuredClone(f.room().pendingBattle), first = f.supply(f.target, 'dodge'), second = f.supply(f.target, 'dodge'); f.advance(1_000); f.respond('dodge', { cardId: first }); assert.equal(f.room().pendingBattle.id, before.id); assert.equal(f.view(f.target).pendingBattle.dodgesPlayed, 1); assert.equal(f.room().pendingBattle.clock.deadlineAt, before.clock.deadlineAt); f.respond('dodge', { cardId: second }); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.target).active.damage, 0); for (const id of [first, second]) assert.equal(countCard(f.room(), id), 1);
});

test('passing after one X-Scissor Dodge causes full damage and whole-card Defense cleanup', t => {
  const f = fixture(t); f.play('scyther', 3); f.player(f.leader).active.reinforcements = ['power', 'power']; f.player(f.target).active.reinforcements = ['defense']; f.attack({ effectChoice: 'double-dodge' }); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); f.respond(); assert.equal(f.player(f.target).active.damage, 1); assert.deepEqual(f.player(f.target).active.reinforcements, []);
});

test('Sand Veil supplies one virtual Dodge toward X-Scissor double defense', t => {
  const f = fixture(t); f.play('scyther', 3); f.player(f.leader).active.reinforcements = ['power']; f.seed(f.target, 'sandshrew'); f.judgments('clear'); f.attack({ effectChoice: 'double-dodge' }); f.respond('trait'); assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.view(f.target).pendingBattle.dodgesPlayed, 1); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().pendingBattle, null);
});

test('X-Scissor first-Dodge retry and restart preserve its unfinished defense once', t => {
  const f = fixture(t); f.play('scyther', 3); f.player(f.leader).active.reinforcements = ['power']; f.attack({ effectChoice: 'double-dodge' }); const cardId = f.supply(f.target, 'dodge'), request = f.input('respondBattle', { decisionId: f.room().pendingBattle.id, choice: 'dodge', cardId }); f.store.action(f.owner.code, f.target.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.target.token, request); assert.deepEqual(f.room(), once);
  const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.target.token).view; assert.equal(view.pendingBattle.dodgesPlayed, 1); assert.equal(view.pendingBattle.dodgesRequired, 2); assert.equal(countCard(restored.rooms.get(f.owner.code), cardId), 1);
});

test('U-turn offers switching after damage, Dodge or immunity with the command already cleaned once', t => {
  for (const prevention of ['none', 'dodge', 'immunity']) { const f = fixture(t); f.play(); if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; const command = f.supply(f.leader); f.attack({ cardId: command }); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); assert.equal(f.room().pendingBattle.kind, 'u-turn'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); assert.equal(f.room().discardPile.filter(card => card.id === command).length, 1); f.respond(); assert.equal(f.room().pendingBattle, null); assert.equal(countCard(f.room(), command), 1); }
});

test('U-turn switching preserves the ordinary switch flag and original command lock', t => {
  for (const switchUsed of [false, true]) { const f = fixture(t); f.play(); f.room().turn.switchUsed = switchUsed; const original = f.player(f.leader).active.instanceId, incoming = f.player(f.leader).reserve.instanceId; f.attack(); f.respond(); f.respond('switch'); assert.equal(f.player(f.leader).active.instanceId, incoming); assert.equal(f.room().turn.switchUsed, switchUsed); assert.equal(f.room().turn.commandCreatureId, original); assert.equal(f.view(f.leader).self.battle.canCommand, false); }
});

test('U-turn waits for receiving Static and nested Helmet before its optional switch', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'pikachu'); f.helmet(f.target); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'effects'); f.respond('effect', { effect: 'rocky-helmet' }); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.room().pendingBattle.kind, 'static'); f.respond(); assert.equal(f.room().pendingBattle.kind, 'u-turn'); f.respond();
});

test('U-turn invokes Arena Trap with its own switch kind and an unpaid fee cancels only that switch', t => {
  const f = fixture(t); f.play(); f.seed(f.third, 'diglett'); const original = f.player(f.leader).active.instanceId, retained = f.supply(f.leader, 'event'); f.attack(); f.respond(); f.respond('switch'); assert.equal(f.room().pendingBattle.kind, 'arena-trap'); assert.equal(f.room().pendingBattle.switchKind, 'u-turn'); f.respond('trait'); assert.equal(f.room().pendingBattle.kind, 'switch-payment'); f.respond(); assert.equal(f.player(f.leader).active.instanceId, original); assert.equal(f.player(f.leader).hand.some(card => card.id === retained), true); assert.equal(f.room().turn.switchUsed, false); assert.equal(f.room().pendingBattle, null);
});

test('U-turn skips a defeated source, unavailable reserve and immediate victory', t => {
  const f = fixture(t); f.play(); Object.assign(f.player(f.leader).active, { hpBonus: 0, damage: 2 }); f.helmet(f.target); const incoming = f.player(f.leader).reserve.instanceId; f.attack(); f.drain(); assert.equal(f.player(f.leader).active.instanceId, incoming); assert.equal(f.room().pendingBattle, null);
  const g = fixture(t); g.play(); g.player(g.leader).reserve.defeated = true; g.attack(); g.respond(); assert.equal(g.room().pendingBattle, null);
  const h = fixture(t); h.play(); h.player(h.target).role = 'rocket'; h.player(h.third).role = 'challenger'; h.player(h.third).eliminated = true; h.seed(h.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); h.player(h.target).reserve.defeated = true; h.attack(); h.drain(); assert.equal(h.room().status, 'finished'); assert.equal(h.room().pendingBattle, null);
});

test('U-turn enforces source authority and strict switch response fields', t => {
  const f = fixture(t); f.play(); f.attack(); f.respond(); const pending = f.room().pendingBattle; rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'switch' }), 'NOT_YOUR_DECISION'); for (const payload of [{ choice: 'trait' }, { choice: 'switch', targetId: f.third.playerId }, { choice: 'switch', cardIds: [] }, { choice: 'switch', effect: 'u-turn' }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...payload }));
});

test('U-turn restart and exact switch retries move partners only once', t => {
  const f = fixture(t); f.play(); f.attack(); f.respond(); const incoming = f.player(f.leader).reserve.instanceId, restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.leader.token).view; assert.equal(view.pendingBattle.kind, 'u-turn'); const request = { id: 'restored-u-turn', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'switch' }; restored.action(f.owner.code, f.leader.token, request); const once = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.leader.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), once); assert.equal(once.players.find(player => player.id === f.leader.playerId).active.instanceId, incoming);
});

test('U-turn timeout passes without an ordinary switch', t => {
  const f = fixture(t, { responseSeconds: 5 }); f.play(); const original = f.player(f.leader).active.instanceId; f.attack(); f.respond(); f.advance(5_000); f.view(f.leader); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.leader).active.instanceId, original); assert.equal(f.room().turn.switchUsed, false);
});

test('Jynx Pound on both lower faces is plain one damage and consumes one real command', t => {
  for (const level of [1, 2]) { const f = fixture(t); f.play('jynx', level); const top = f.room().drawPile.at(-1).id, command = f.supply(f.leader); f.attack({ cardId: command }); f.respond(); assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.room().drawPile.at(-1).id, top); assert.equal(countCard(f.room(), command), 1); }
});

test('Light Screen grants one nonstacking Defense using either sunny card without damage hooks', t => {
  for (const level of [2, 3]) for (const weather of ['intense-sun', 'clear']) { const f = fixture(t); f.play('jynx', level); f.player(f.target).active.reinforcements = ['defense']; f.helmet(f.target); const card = f.supply(f.leader, 'event', weather); f.attack({ cardId: card, moveIndex: 1 }); f.respond(); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(countCard(f.room(), card), 1); }
  const f = fixture(t); f.play('jynx', 2); f.attack({ moveIndex: 1, cardId: f.supply(f.leader, 'event', 'clear') }); f.respond(); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']);
});

test('Light Screen obeys range and sunny cost requirements and ordinary Dodge cancellation', t => {
  const f = fixture(t, { count: 6 }); f.play('jynx', 3); const rainy = f.supply(f.leader, 'event', 'rain'), sunny = f.supply(f.leader, 'event', 'clear'), far = f.seats.find(who => !moves(f)[1].legalTargetIds.includes(who.playerId)); assert.ok(far); rejectsAtomically(f, () => f.attack({ cardId: rainy, moveIndex: 1 })); rejectsAtomically(f, () => f.attack({ cardId: sunny, moveIndex: 1, targetIds: [far.playerId] })); f.attack({ cardId: sunny, moveIndex: 1 }); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); assert.deepEqual(f.player(f.target).active.reinforcements, []);
});

test('Sweet Kiss target chooses exactly two real discards then gains the next actual two cards', t => {
  const f = fixture(t); f.play('jynx', 3); const own = [f.supply(f.target), f.supply(f.target, 'dodge'), f.supply(f.target, 'event')], cards = f.top('rain', 'clear'), command = f.supply(f.leader); f.attack({ cardId: command }); f.respond(); assert.equal(f.room().pendingBattle.kind, 'sweet-kiss'); assert.equal(f.room().pendingBattle.actorId, f.target.playerId); f.respond('discard', { cardIds: [own[2], own[0]] }); assert.deepEqual(ids(f.player(f.target).hand), [own[1], ...ids(cards)]); for (const id of [...own, command, ...ids(cards)]) assert.equal(countCard(f.room(), id), 1);
});

test('Sweet Kiss handles one-card and empty hands without a fictional discard', t => {
  for (const count of [0, 1]) { const f = fixture(t); f.play('jynx', 3); const old = Array.from({ length: count }, () => f.supply(f.target)), cards = f.top('rain', 'clear'); f.attack(); f.respond(); if (count) { assert.equal(f.room().pendingBattle.kind, 'sweet-kiss'); f.respond('discard', { cardIds: old }); } assert.equal(f.room().pendingBattle, null); assert.deepEqual(f.player(f.target).hand, cards); }
});

test('Sweet Kiss consumes all Power but has no damage, Helmet, Poison Point or Defense cleanup', t => {
  const f = fixture(t); f.play('jynx', 3); f.player(f.leader).active.reinforcements = ['power', 'power']; f.seed(f.target, 'nidoran-m', 2, { reinforcements: ['defense'] }); f.helmet(f.target); f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.player(f.leader).active.status, null); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(powerCount(f.player(f.leader).active), 0); assert.equal(f.room().pendingBattle, null);
});

test('Sweet Kiss Dodge cancels the entire hand effect', t => {
  const f = fixture(t); f.play('jynx', 3); const retained = f.supply(f.target, 'event'), dodge = f.supply(f.target, 'dodge'), top = f.room().drawPile.at(-1).id; f.attack(); f.respond('dodge', { cardId: dodge }); assert.deepEqual(ids(f.player(f.target).hand), [retained]); assert.equal(f.room().drawPile.at(-1).id, top); assert.equal(f.room().pendingBattle, null);
});

test('Sweet Kiss projects only safe actor hand stubs and keeps identities private from other viewers', t => {
  const f = fixture(t); f.play('jynx', 3); f.supply(f.target, 'dodge', 'rain'); f.supply(f.target, 'event', 'clear'); const hand = structuredClone(f.player(f.target).hand), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); f.attack(); f.respond(); assert.deepEqual(f.view(f.target).pendingBattle.cards, hand.map(publicHand)); for (const who of [f.leader, f.third, observer]) { const view = f.view(who); assert.equal(view.pendingBattle.cards, undefined); for (const card of hand) { assert.equal(JSON.stringify(view).includes(card.id), false); assert.equal(JSON.stringify(view).includes(card.privateMarker), false); } }
});

test('Sweet Kiss rejects wrong actor, wrong count, duplicate or foreign cards and extra fields atomically', t => {
  const f = fixture(t); f.play('jynx', 3); const own = [f.supply(f.target), f.supply(f.target), f.supply(f.target)], foreign = f.supply(f.third); f.attack(); f.respond(); const pending = f.room().pendingBattle; rejectsAtomically(f, () => f.act(f.third, 'respondBattle', { decisionId: pending.id, choice: 'discard', cardIds: own.slice(0, 2) }), 'NOT_YOUR_DECISION');
  for (const payload of [{ choice: 'pass' }, { choice: 'discard', cardIds: [] }, { choice: 'discard', cardIds: [own[0]] }, { choice: 'discard', cardIds: own }, { choice: 'discard', cardIds: [own[0], own[0]] }, { choice: 'discard', cardIds: [own[0], foreign] }, { choice: 'discard', cardIds: [own[0], 'forged'] }, { choice: 'discard', cardIds: own.slice(0, 2), targetId: f.third.playerId }, { choice: 'discard', cardIds: own.slice(0, 2), cardId: own[0] }]) rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, ...payload }));
});

test('Sweet Kiss draws only actual available cards and triggers Pickup once after the gain batch', t => {
  for (const available of [0, 1, 2]) { const f = fixture(t); f.play('jynx', 3); f.room().drawPile = []; f.room().discardPile = []; const cards = f.top(...Array(available).fill('rain')); f.attack(); f.respond(); assert.deepEqual(f.player(f.target).hand, cards); }
  const f = fixture(t); f.play('jynx', 3); f.seed(f.target, 'meowth', 2); const cards = f.top('rain', 'clear', 'thunderstorm'); f.attack(); f.respond(); assert.deepEqual(f.player(f.target).hand, cards); assert.deepEqual(f.room().turn.pickupUsedIds, [f.player(f.target).active.instanceId]);
});

test('Sweet Kiss mandatory expiry waits for private discards and pauses the main turn', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play('jynx', 3); f.supply(f.target); f.supply(f.target); f.attack(); f.respond(); const id = f.room().pendingBattle.id; f.advance(5_000); const view = f.view(f.target); assert.equal(view.pendingBattle.id, id); assert.equal(view.pendingBattle.kind, 'sweet-kiss'); assert.equal(view.pendingBattle.clock.expired, true); assert.equal(view.pendingBattle.clock.pausedReason, 'mandatory'); assert.equal(f.player(f.target).hand.length, 2); assert.equal(view.turn.clock.remainingMs, 60_000);
});

test('Sweet Kiss restart and exact discard retries gain the selected real cards only once', t => {
  const f = fixture(t); f.play('jynx', 3); const costs = [f.supply(f.target), f.supply(f.target)], cards = f.top('rain', 'clear'); f.attack(); f.respond(); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.target.token).view, request = { id: 'restored-sweet-kiss', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'discard', cardIds: costs }; restored.action(f.owner.code, f.target.token, request); const once = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.target.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), once); assert.deepEqual(once.players.find(player => player.id === f.target.playerId).hand, cards);
});

test('Forewarn is offered on every current active Jynx level after Prep without consuming mandatory draws', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t); prep(f, level); assert.equal(f.room().pendingBattle.kind, 'forewarn'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); assert.equal(f.view(f.leader).turn.phase, 'draw'); assert.equal(f.room().turn.drawRemaining, 2); assert.equal(f.player(f.leader).hand.length, 0); rejectsAtomically(f, () => f.act(f.leader, 'draw'), 'RESPONSE_PENDING'); f.respond(); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().turn.drawRemaining, 2); }
});

test('Forewarn pass does not inspect or move any deck cards', t => {
  const f = fixture(t); prep(f); const deck = structuredClone(f.room().drawPile); f.respond(); assert.deepEqual(f.room().drawPile, deck); assert.equal(f.room().turnStart ?? null, null); assert.equal(f.player(f.leader).hand.length, 0);
});

test('Forewarn acceptance privately exposes safe indexed faces of exactly the next four actual cards', t => {
  const f = fixture(t); const cards = f.top('rain', 'clear', 'intense-sun', 'thunderstorm'); prep(f); const deck = structuredClone(f.room().drawPile), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); forewarn(f);
  assert.equal(f.room().pendingBattle.kind, 'forewarn-order'); assert.deepEqual(f.room().turnStart.forewarnCardIds, ids(cards)); assert.deepEqual(f.room().drawPile, deck);
  assert.deepEqual(f.view(f.leader).pendingBattle.cards, cards.map(({ name, weather, kind }, index) => ({ index, name, weather, kind })));
  for (const who of [f.target, f.third, observer]) { const view = f.view(who); assert.equal(view.pendingBattle.cards, undefined); assert.equal(view.turnStart, undefined); for (const card of cards) { assert.equal(JSON.stringify(view).includes(card.id), false); assert.equal(JSON.stringify(view).includes(card.privateMarker), false); } }
  for (const card of cards) assert.equal(countCard(f.room(), card.id), 1);
});

test('Forewarn chosen top and bottom orders preserve the untouched middle and actual next-draw order', t => {
  const f = fixture(t); const cards = f.top('rain', 'clear', 'intense-sun', 'thunderstorm'), middle = f.room().drawPile.slice(0, -4); prep(f); forewarn(f); reorder(f, [2, 0], [3, 1]);
  assert.deepEqual(ids(f.room().drawPile), [cards[1].id, cards[3].id, ...ids(middle), cards[0].id, cards[2].id]); assert.equal(f.room().turnStart ?? null, null); assert.equal(f.room().turn.drawRemaining, 2); f.act(f.leader, 'draw'); f.act(f.leader, 'draw'); assert.deepEqual(ids(f.player(f.leader).hand), [cards[2].id, cards[0].id]);
});

test('Forewarn permits either all selected cards on top or all on the bottom', t => {
  for (const side of ['top', 'bottom']) { const f = fixture(t); const cards = f.top('rain', 'clear', 'intense-sun', 'thunderstorm'), middle = f.room().drawPile.slice(0, -4); prep(f); forewarn(f); const order = [1, 3, 0, 2]; reorder(f, side === 'top' ? order : [], side === 'bottom' ? order : []); const ordered = order.map(index => cards[index]).reverse(); assert.deepEqual(ids(f.room().drawPile), side === 'top' ? [...ids(middle), ...ids(ordered)] : [...ids(ordered), ...ids(middle)]); }
});

test('Forewarn uses only real available cards and skips an offer on completely empty piles', t => {
  for (const count of [0, 1, 2, 3]) { const f = fixture(t); f.room().drawPile = []; f.room().discardPile = []; const cards = f.top(...Array(count).fill('rain')); prep(f); if (!count) { assert.equal(f.room().pendingBattle, null); continue; } forewarn(f); assert.equal(f.view(f.leader).pendingBattle.cards.length, count); assert.deepEqual(f.room().turnStart.forewarnCardIds, ids(cards)); reorder(f, cards.map((_, index) => index), []); assert.equal(allCards(f.room()).length, count); }
});

test('Forewarn refills discards underneath an existing deck top before looking at up to four', t => {
  const f = fixture(t); f.room().drawPile = []; const top = f.top('rain')[0], discards = [f.makeCard('event', 'clear'), f.makeCard('dodge', 'thunderstorm')]; f.room().discardPile = [...discards]; prep(f); forewarn(f);
  const selected = f.room().turnStart.forewarnCardIds; assert.equal(selected[0], top.id); assert.deepEqual(new Set(selected), new Set([top.id, ...ids(discards)])); assert.equal(f.room().discardPile.length, 0); reorder(f, [0, 1, 2], []); assert.equal(allCards(f.room()).length, 3);
});

test('Forewarn peek is neither a card gain nor a judgment and does not activate Pickup or Drought', t => {
  const f = fixture(t); f.seed(f.third, 'vulpix'); f.seed(f.target, 'meowth'); const sunny = f.supply(f.third, 'event', 'clear'), hand = structuredClone(f.player(f.third).hand); prep(f); forewarn(f); assert.equal(f.room().judgment ?? null, null); assert.equal(f.player(f.leader).hand.length, 0); assert.deepEqual(f.room().turn.pickupUsedIds, []); assert.deepEqual(f.player(f.third).hand, hand); assert.equal(countCard(f.room(), sunny), 1); reorder(f, [0, 1, 2, 3], []);
});

test('Forewarn rejects wrong actor, stale decision and extra offer fields before peeking', t => {
  const f = fixture(t); prep(f); const pending = f.room().pendingBattle; rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'trait' }), 'NOT_YOUR_DECISION'); rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: 'stale', choice: 'trait' }), 'STALE_DECISION');
  for (const payload of [{ choice: 'order', topOrder: [], bottomOrder: [] }, { choice: 'trait', cardIds: [] }, { choice: 'trait', targetId: f.target.playerId }, { choice: 'pass', topOrder: [] }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...payload }));
});

test('Forewarn reorder requires each index exactly once across two proper arrays and rejects extraneous fields', t => {
  const f = fixture(t); prep(f); forewarn(f); const pending = f.room().pendingBattle; rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'order', topOrder: [0, 1, 2, 3], bottomOrder: [] }), 'NOT_YOUR_DECISION');
  for (const payload of [{ choice: 'pass' }, { choice: 'order', topOrder: [0, 1, 2], bottomOrder: [] }, { choice: 'order', topOrder: [0, 1, 2, 3], bottomOrder: [0] }, { choice: 'order', topOrder: [0, 1, 1, 3], bottomOrder: [] }, { choice: 'order', topOrder: [0, 1, 2, 4], bottomOrder: [] }, { choice: 'order', topOrder: [0, 1, 2, '3'], bottomOrder: [] }, { choice: 'order', topOrder: null, bottomOrder: [0, 1, 2, 3] }, { choice: 'order', topOrder: [0, 1, 2, 3] }, { choice: 'order', topOrder: [0, 1, 2, 3], bottomOrder: [], cardIds: [] }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...payload }));
});

test('Forewarn occurs after all local status/return effects and all global Koffing choices', t => {
  const f = fixture(t); f.seed(f.leader, 'jynx', 2, { status: 'poison' }); const returned = f.makeCard('event', 'rain'); f.player(f.leader).exiledCards = [returned]; f.seed(f.third, 'koffing'); f.supply(f.third); start(f); assert.equal(f.room().pendingBattle.kind, 'turn-start-order'); f.respond('start-effect', { effect: 'status' }); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.player(f.leader).hand.some(card => card.id === returned.id), true); assert.equal(f.room().pendingBattle.kind, 'neutralizing-gas'); f.respond(); assert.equal(f.room().pendingBattle.kind, 'forewarn'); f.respond();
});

test('global Gas can suppress Forewarn before its post-queue evaluation', t => {
  const f = fixture(t); f.seed(f.leader, 'jynx'); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); start(f); assert.equal(f.room().pendingBattle.kind, 'neutralizing-gas'); f.respond('suppress', { cardId: cost, targetId: f.leader.playerId }); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().turnStart ?? null, null); assert.equal(f.room().turn.drawRemaining, 2);
});

test('a newly deployed reserve Jynx receives Forewarn after the original active dies during Prep', t => {
  const f = fixture(t); f.seed(f.leader, 'squirtle', 1, { hpBonus: 0, damage: 2, status: 'poison' }); f.player(f.leader).reserve.catalogueId = 'jynx'; const incoming = f.player(f.leader).reserve.instanceId; start(f); while (f.room().pendingBattle?.kind === 'rescue') f.respond(); assert.equal(f.player(f.leader).active.instanceId, incoming); assert.equal(f.room().pendingBattle.kind, 'forewarn'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); f.respond();
});

test('noncurrent and reserve-only Jynx do not get Forewarn on another trainer turn', t => {
  const f = fixture(t); f.seed(f.third, 'jynx'); f.player(f.leader).reserve.catalogueId = 'jynx'; start(f); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().turnStart ?? null, null);
});

test('Forewarn optional timeout passes but accepted reorder timeout remains a mandatory private choice', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); prep(f); f.advance(5_000); f.view(f.leader); assert.equal(f.room().pendingBattle, null); assert.equal(f.view(f.leader).turn.clock.remainingMs, 60_000);
  const g = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); prep(g); forewarn(g); const id = g.room().pendingBattle.id; g.advance(5_000); const view = g.view(g.leader); assert.equal(view.pendingBattle.id, id); assert.equal(view.pendingBattle.kind, 'forewarn-order'); assert.equal(view.pendingBattle.clock.expired, true); assert.equal(view.pendingBattle.clock.pausedReason, 'mandatory'); assert.equal(view.turn.clock.remainingMs, 60_000);
});

test('closing votes block Forewarn reorder and preserve the private deck selection', t => {
  const f = fixture(t); prep(f); forewarn(f); const selected = [...f.room().turnStart.forewarnCardIds]; f.act(f.owner, 'requestEndGame'); rejectsAtomically(f, () => reorder(f, [0, 1, 2, 3], []), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); assert.deepEqual(f.room().turnStart.forewarnCardIds, selected); reorder(f, [0, 1, 2, 3], []);
});

test('Forewarn acceptance exact retry never peeks again or changes the selected identities', t => {
  const f = fixture(t); prep(f); const request = f.input('respondBattle', { decisionId: f.room().pendingBattle.id, choice: 'trait' }); f.store.action(f.owner.code, f.leader.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), once); assert.equal(f.room().pendingBattle.kind, 'forewarn-order'); assert.equal(f.room().turnStart.forewarnCardIds.length, 4);
});

test('Forewarn restart and exact reorder retries preserve all private card identities and apply order once', t => {
  const f = fixture(t); prep(f); forewarn(f); const selected = [...f.room().turnStart.forewarnCardIds], restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.leader.token).view; assert.equal(view.pendingBattle.kind, 'forewarn-order'); assert.deepEqual(restored.rooms.get(f.owner.code).turnStart.forewarnCardIds, selected);
  const request = { id: 'restored-forewarn-order', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'order', topOrder: [3, 1], bottomOrder: [2, 0] }; restored.action(f.owner.code, f.leader.token, request); const once = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.leader.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), once); assert.equal(once.drawPile.at(-1).id, selected[3]); assert.equal(once.turn.drawRemaining, 2); assert.equal(once.pendingBattle, null); for (const id of selected) assert.equal(countCard(once, id), 1);
});

test('legacy turn-start shape resumes status/returns and still reaches post-queue Forewarn', t => {
  const f = fixture(t); f.seed(f.leader, 'jynx', 2, { status: 'poison' }); const returned = f.makeCard('event', 'rain'); f.player(f.leader).exiledCards = [returned]; start(f); assert.equal(f.room().pendingBattle.kind, 'turn-start-order'); delete f.room().turnStart.actorIds; delete f.room().turnStart.actorInstances; delete f.room().turnStart.index; f.store.persist(f.room());
  const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.leader.token).view; restored.action(f.owner.code, f.leader.token, { id: 'legacy-jynx-prep', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'start-effect', effect: 'return-cards' }); const room = restored.rooms.get(f.owner.code); assert.equal(room.pendingBattle.kind, 'forewarn'); assert.equal(room.players.find(player => player.id === f.leader.playerId).active.damage, 1); assert.equal(countCard(room, returned.id), 1);
});

test('Gas removes only Scyther inherited menus and stale inherited indexes reject before payment', t => {
  const f = fixture(t); f.play('scyther', 3); assert.equal(moves(f).length, 4); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); start(f); f.respond('suppress', { cardId: cost, targetId: f.leader.playerId }); drawToPlay(f); assert.deepEqual(moves(f).map(move => move.effectKind), ['x-scissor']); const command = f.supply(f.leader); rejectsAtomically(f, () => f.attack({ cardId: command, moveIndex: 1 })); f.player(f.leader).active.reinforcements = ['power']; f.attack({ cardId: command, effectChoice: 'double-dodge' }); f.respond(); assert.equal(f.player(f.target).active.damage, 3);
});

test('Gas preserves native Fury Cutter grants and Jynx Sweet Kiss because their effects belong to moves', t => {
  for (const family of ['scyther', 'jynx']) { const f = fixture(t); f.play(family, family === 'scyther' ? 2 : 3); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); start(f); f.respond('suppress', { cardId: cost, targetId: f.leader.playerId }); drawToPlay(f); f.attack(); f.respond(); if (family === 'scyther') assert.equal(powerCount(f.player(f.leader).active), 1); else { assert.equal(f.player(f.target).hand.length, 2); assert.equal(f.player(f.target).active.damage, 0); } }
});
