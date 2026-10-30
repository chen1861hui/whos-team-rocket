import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore, CONNECTED_MS } from '../server/store.js';
import { cardDistanceIgnored } from '../server/combat.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));
function fixture(t, { count = 3, turnSeconds = 0, responseSeconds = 0 } = {}) {
  const root = fileURLToPath(new URL('../.data/', import.meta.url));
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'nidoran-diglett-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `nidoran-diglett-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates; act(who, 'selectPokemon', { activeId: candidates[0], reserveId: candidates[1] }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-nidoran-diglett-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private caterpie weedle card ${serial}` } });
  room().drawPile = Array.from({ length: 48 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const top = (...weather) => { const cards = weather.map(value => makeCard('reveal-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const judgments = (...weather) => { const cards = weather.map(value => makeCard('judgment-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id), third = seats.find(who => who !== leader && who !== target);
  const play = (family = 'caterpie', level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, family, level); };
  const attack = (payload = {}, who = leader) => act(who, 'attack', { cardId: payload.cardId ?? supply(who), targetIds: [target.playerId], ...payload });
  const respond = (choice = 'pass', payload = {}) => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload }); };
  const order = effect => respond('damage-effect', { effect });
  const helmet = who => { const card = { ...makeCard('held-item'), itemType: 'rocky-helmet' }; player(who).active.item = card; return card; };
  const drain = () => { for (let i = 0; room().pendingBattle && i < 100; i++) { const pending = room().pendingBattle; if (pending.kind === 'damage-order') order(pending.effects[0]); else respond(pending.kind === 'effects' ? 'effect' : 'pass', pending.kind === 'effects' ? { effect: pending.effects[0] } : {}); } assert.equal(room().pendingBattle, null); };
  const startStatus = (status = 'poison', who = target) => { player(who).active.status = status; store.startTurn(room(), who.playerId, 2); };
  return { store, dir, now, owner, seats, leader, target, third, room, player, byId, view, input, act, seed, makeCard, supply, top, judgments, play, attack, respond, order, helmet, drain, startStatus, advance: ms => { time += ms; } };
}
function rejectsAtomically(f, action, code) { const before = structuredClone(f.room()); assert.throws(action, error => code === undefined || error.code === code); assert.deepEqual(f.room(), before); }
const ids = cards => cards.map(card => card.id);
const publicFace = ({ name, weather, kind }) => ({ name, weather, kind });
const publicHand = ({ id, name, weather, kind }) => ({ id, name, weather, kind });
const allCards = room => [...room.drawPile, ...room.discardPile, ...room.players.flatMap(p => [...(p.hand || []), ...[p.active?.item, p.reserve?.item].filter(Boolean)]), ...[room.resolution, ...(room.resolutionStack || [])].flatMap(r => r ? [...(r.card && !r.cardClaimedBy ? [r.card] : []), ...(r.revealedCards || [])] : []), ...(room.judgment?.card ? [room.judgment.card] : [])];
const countCard = (room, id) => allCards(room).filter(card => card.id === id).length;

const switchIds = (f, who = f.leader) => [f.player(who).active.instanceId, f.player(who).reserve.instanceId];
const trap = (f, who = f.third, level = 1) => f.seed(who, 'diglett', level);
const fee = (f, cardId) => f.respond('discard', { cardId });
const poisonPoint = f => { assert.equal(f.room().pendingBattle.kind, 'poison-point'); assert.equal(f.room().pendingBattle.trait, 'poison-point'); f.respond('trait'); };
const ordinary = f => f.act(f.leader, 'switchPokemon');
function prepareTrap(f, who = f.third) { f.play('squirtle'); trap(f, who); const before = switchIds(f); ordinary(f); assert.equal(f.room().pendingBattle.kind, 'arena-trap'); return before; }

// All scenarios enter through the legal shared room, identity and partner setup.
test('six reviewed faces expose exact HP, command values and target limits', t => {
  for (const [family, hp, damage] of [['nidoran-m', [3, 4, 4], [1, 2, 3]], ['diglett', [3, 3, 4], [2, 2, 2]]]) {
    const entry = catalogue.entries.find(p => p.id === family); assert.ok(entry); assert.deepEqual(entry.levels.map(p => p.hp), hp); assert.deepEqual(entry.levels.map(p => p.effectStatus), Array(3).fill('combat-preview'));
    for (const level of [1, 2, 3]) { const f = fixture(t); f.play(family, level); const battle = f.view(f.leader).self.battle; assert.equal(battle.canTrait, false); assert.equal(battle.canCommand, true); assert.equal(battle.moves.length, 1); assert.equal(battle.move.printedValue, damage[level - 1]); assert.equal(battle.move.maxTargets, family === 'diglett' && level === 3 ? 2 : 1); }
  }
});

test('Double Kick consumes one real command and settles exactly twice without revealing cards', t => {
  const f = fixture(t); f.play('nidoran-m'); const command = f.supply(f.leader), original = structuredClone(f.player(f.leader).hand[0]), top = f.room().drawPile.at(-1).id; f.attack({ cardId: command });
  for (let hit = 1; hit <= 2; hit++) { const pending = f.view(f.target).pendingBattle; assert.equal(pending.kind, 'defense'); assert.equal(pending.settlementNumber, hit); assert.equal(pending.settlementCount, 2); assert.equal(pending.revealedCards, undefined); assert.equal(f.room().resolution.revealedCards, undefined); f.respond(); assert.equal(f.player(f.target).active.damage, hit); }
  assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null); assert.equal(f.room().drawPile.at(-1).id, top); assert.deepEqual(f.room().discardPile.find(c => c.id === command), original); assert.equal(countCard(f.room(), command), 1); assert.equal(f.view(f.leader).self.battle.canCommand, false);
});

test('Double Kick gives independent Dodge decisions and rejects a stale first-hit decision', t => {
  const f = fixture(t); f.play('nidoran-m'); f.attack(); const first = f.room().pendingBattle.id, dodge = f.supply(f.target, 'dodge'); f.respond('dodge', { cardId: dodge }); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.view(f.target).pendingBattle.settlementNumber, 2); assert.notEqual(f.room().pendingBattle.id, first); rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: first, choice: 'pass' }), 'STALE_DECISION'); f.respond(); assert.equal(f.player(f.target).active.damage, 1); assert.equal(countCard(f.room(), dodge), 1);
});

test('Double Kick Power covers both hits and Defense lasts until the complete card ends', t => {
  for (const defense of [false, true]) { const f = fixture(t); f.play('nidoran-m'); f.player(f.leader).active.reinforcements = ['power']; if (defense) f.player(f.target).active.reinforcements = ['defense']; f.attack(); assert.deepEqual(f.player(f.leader).active.reinforcements, []); f.respond(); assert.equal(f.player(f.target).active.damage, defense ? 1 : 2); if (defense) assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); f.respond(); assert.equal(f.player(f.target).active.damage, defense ? 2 : 4); assert.deepEqual(f.player(f.target).active.reinforcements, []); }
});

test('Double Kick fully dodged preserves unused Defense and makes no receiving effects', t => {
  const f = fixture(t); f.play('nidoran-m'); f.seed(f.target, 'nidoran-m', 3, { reinforcements: ['defense'] }); f.helmet(f.target); f.attack(); for (let i = 0; i < 2; i++) f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.player(f.leader).active.status, null); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']);
});

test('Double Kick stops after the original target faints and never damages its replacement', t => {
  const f = fixture(t); f.play('nidoran-m'); f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); const before = switchIds(f, f.target), command = f.supply(f.leader); f.attack({ cardId: command }); f.drain(); assert.deepEqual(switchIds(f, f.target), before.reverse()); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.target).reserve.defeated, true); assert.equal(f.room().resolution, null); assert.equal(countCard(f.room(), command), 1);
});

test('Double Kick stops if Rocky Helmet defeats its original source during the first hit', t => {
  const f = fixture(t); f.play('nidoran-m'); Object.assign(f.player(f.leader).active, { hpBonus: 0, damage: 2 }); f.helmet(f.target); const before = switchIds(f), command = f.supply(f.leader); f.attack({ cardId: command }); f.drain(); assert.deepEqual(switchIds(f), before.reverse()); assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.player(f.leader).reserve.defeated, true); assert.equal(f.room().resolution, null); assert.equal((f.room().resolutionStack || []).length, 0); assert.equal(countCard(f.room(), command), 1);
});

test('Double Kick saved second settlement and exact request retries settle once', t => {
  const f = fixture(t); f.play('nidoran-m'); const command = f.supply(f.leader), request = f.input('attack', { cardId: command, targetIds: [f.target.playerId] }); f.store.action(f.owner.code, f.leader.token, request); const first = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), first); f.respond(); const saved = structuredClone(f.room().pendingBattle), restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.target.token).view; assert.equal(view.pendingBattle.id, saved.id); assert.equal(view.pendingBattle.settlementNumber, 2); assert.equal(view.pendingBattle.settlementCount, 2); assert.equal(view.pendingBattle.revealedCards, undefined); const action = { id: 'double-kick-restored', revision: view.revision, type: 'respondBattle', decisionId: saved.id, choice: 'pass' }; restored.action(f.owner.code, f.target.token, action); const final = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.target.token, action); assert.deepEqual(restored.rooms.get(f.owner.code), final); assert.equal(final.players.find(p => p.id === f.target.playerId).active.damage, 2); assert.equal(final.discardPile.filter(c => c.id === command).length, 1);
});

test('Double Kick resets each defense clock and optional expiry advances just the current hit', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play('nidoran-m'); f.advance(1_000); f.attack(); f.advance(2_000); f.respond(); const next = f.view(f.target).pendingBattle; assert.equal(next.settlementNumber, 2); assert.equal(next.clock.remainingMs, 5_000); assert.equal(next.clock.deadlineAt, f.now() + 5_000); f.advance(5_000); assert.equal(f.view(f.target).pendingBattle, null); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.view(f.leader).turn.clock.remainingMs, 59_000);
});

test('Nidorino Horn Attack and Nidoking Megahorn gain one only while uninjured', t => {
  for (const [level, injury, expected] of [[2, 0, 3], [2, 1, 2], [3, 0, 4], [3, 1, 3]]) { const f = fixture(t); f.play('nidoran-m', level); f.player(f.leader).active.damage = injury; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, expected); assert.equal(f.room().pendingBattle, null); }
});

test('Nidoking move increase is forbidden by Burn and precedes Multiscale receiving reduction', t => {
  const burned = fixture(t); burned.play('nidoran-m', 3); burned.player(burned.leader).active.status = 'burn'; burned.attack(); burned.respond(); assert.equal(burned.player(burned.target).active.damage, 1);
  const capped = fixture(t); capped.play('nidoran-m', 3); capped.seed(capped.target, 'dratini', 3); capped.attack(); capped.respond(); assert.equal(capped.player(capped.target).active.damage, 1);
});

test('Nidoking uninjured move text never boosts Rocky Helmet or confusion damage', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'nidoran-m', 3); f.helmet(f.target); f.attack(); f.respond(); f.player(f.target).active.damage = 0; if (f.room().pendingBattle.kind === 'effects') f.respond('effect', { effect: 'rocky-helmet' }); assert.equal(f.player(f.leader).active.damage, 1); f.drain();
  const g = fixture(t); g.play(); g.seed(g.target, 'nidoran-m', 3, { status: 'confusion' }); g.store.startTurn(g.room(), g.target.playerId, 2); g.drain(); assert.equal(g.player(g.target).active.damage, 1); assert.equal(g.player(g.target).active.status, null);
});

test('Poison Point is offered on all levels only after positive damage and judges not intense sun', t => {
  for (const level of [1, 2, 3]) for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) { const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'nidoran-m', level); f.judgments(weather); const judged = f.room().drawPile.at(-1).id; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle.actorId, f.target.playerId); assert.equal(f.room().pendingBattle.targetId, f.leader.playerId); poisonPoint(f); assert.equal(f.player(f.leader).active.status, weather === 'intense-sun' ? null : 'poison'); assert.equal(f.player(f.target).active.status, null); assert.equal(f.room().discardPile.filter(c => c.id === judged).length, 1); assert.equal(f.room().pendingBattle, null); }
});

test('Poison Point pass consumes neither a judgment card nor a once-per-turn marker', t => {
  const f = fixture(t); f.play('nidoran-m'); f.seed(f.target, 'nidoran-m', 2); const top = f.room().drawPile.at(-1).id; f.attack(); f.respond(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond(); assert.equal(f.room().pendingBattle.kind, 'poison-point'); f.respond(); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().drawPile.at(-1).id, top); assert.equal(f.player(f.leader).active.status, null); assert.equal((f.room().turn.traitsUsed || []).includes(f.player(f.target).active.instanceId), false);
});

test('Poison Point does not trigger after Dodge, damage immunity or a lethal receiving hit', t => {
  for (const prevention of ['dodge', 'immunity', 'faint']) { const f = fixture(t); f.play('squirtle', 3); f.seed(f.target, 'nidoran-m', 1, prevention === 'faint' ? { hpBonus: 0, damage: 2 } : {}); if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; const top = f.room().drawPile.at(-1).id; f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); f.drain(); assert.equal(f.player(f.leader).active.status, null); if (prevention !== 'faint') assert.equal(f.room().drawPile.at(-1).id, top); }
});

test('Poison Point uses Drought final judgment and established Poison Touch poison semantics', t => {
  const f = fixture(t, { count: 4 }); f.play('squirtle'); f.seed(f.target, 'nidoran-m'); f.seed(f.third, 'vulpix'); const grimer = f.seats.find(who => ![f.leader, f.target, f.third].includes(who)); f.seed(grimer, 'grimer'); const replacement = f.supply(f.third, 'event', 'clear'); f.judgments('intense-sun'); f.attack(); f.respond(); poisonPoint(f); assert.equal(f.room().pendingBattle.kind, 'judgment'); f.respond('replace', { cardId: replacement }); assert.equal(f.player(f.leader).active.status, 'poison'); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().statusEvent ?? null, null); assert.equal(countCard(f.room(), replacement), 1); f.store.startTurn(f.room(), f.leader.playerId, 2); assert.equal(f.room().pendingBattle.kind, 'poison-touch'); assert.equal(f.room().pendingBattle.mode, 'poison'); f.respond('trait'); assert.equal(f.player(f.leader).active.damage, 2);
});

test('Poison Point honors source Shield Dust status immunity', t => {
  const f = fixture(t); f.play('caterpie'); f.seed(f.target, 'nidoran-m'); f.judgments('rain'); f.attack(); f.respond(); poisonPoint(f); assert.equal(f.player(f.leader).active.status, null); assert.equal(f.room().pendingBattle, null);
});

test('Poison Point and Rocky Helmet let the receiver choose their receiving order', t => {
  for (const first of ['poison-point', 'rocky-helmet']) { const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'nidoran-m'); f.helmet(f.target); f.judgments('clear'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'effects'); assert.deepEqual(new Set(f.room().pendingBattle.effects), new Set(['poison-point', 'rocky-helmet'])); f.respond('effect', { effect: first }); if (first === 'poison-point') poisonPoint(f); assert.equal(f.player(f.leader).active.damage, 1); if (first === 'rocky-helmet') poisonPoint(f); assert.equal(f.player(f.leader).active.status, 'poison'); assert.equal(f.room().pendingBattle, null); }
});

test('Poison Point targets the captured original source and cannot poison its incoming reserve', t => {
  const f = fixture(t); f.play('squirtle'); Object.assign(f.player(f.leader).active, { hpBonus: 0, damage: 2 }); f.seed(f.target, 'nidoran-m'); f.helmet(f.target); const incoming = f.player(f.leader).reserve.instanceId; f.attack(); f.respond(); f.respond('effect', { effect: 'rocky-helmet' }); f.drain(); assert.equal(f.player(f.leader).active.instanceId, incoming); assert.equal(f.player(f.leader).active.status, null); assert.equal(f.room().pendingBattle, null);
});

test('Poison Point validates authority and fields and expires as an optional pass', t => {
  const f = fixture(t, { responseSeconds: 5 }); f.play('squirtle'); f.seed(f.target, 'nidoran-m'); f.attack(); f.respond(); const id = f.room().pendingBattle.id, top = f.room().drawPile.at(-1).id; rejectsAtomically(f, () => f.act(f.third, 'respondBattle', { decisionId: id, choice: 'trait' }), 'NOT_YOUR_DECISION'); for (const payload of [{ choice: 'trait', cardId: 'fake' }, { choice: 'pass', cardIds: [] }, { choice: 'trait', effect: 'poison-point' }, { choice: 'dodge' }]) rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: id, ...payload })); f.advance(5_000); assert.equal(f.view(f.target).pendingBattle, null); assert.equal(f.room().drawPile.at(-1).id, top); assert.equal(f.player(f.leader).active.status, null);
});

test('Mud Slap deals plain two damage and never removes a reinforcement', t => {
  const f = fixture(t); f.play('diglett'); f.player(f.target).active.reinforcements = ['power', 'speed']; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.deepEqual(f.player(f.target).active.reinforcements, ['power', 'speed']); assert.equal(f.room().pendingBattle, null);
});

test('Bulldoze settles one target and Earthquake two, removing one original reinforcement after each hit', t => {
  for (const level of [2, 3]) { const f = fixture(t); f.play('diglett', level); const targets = level === 2 ? [f.target] : [f.target, f.third]; for (const who of targets) f.player(who).active.reinforcements = ['power', 'speed']; f.attack({ targetIds: targets.map(who => who.playerId) }); for (const who of targets) { assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.room().pendingBattle.actorId, who.playerId); f.respond(); assert.equal(f.player(who).active.damage, 2); assert.equal(f.room().pendingBattle.kind, 'reinforcement'); assert.equal(f.room().pendingBattle.timing, 'after-damage'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); assert.equal(f.room().pendingBattle.targetId, who.playerId); f.respond('reinforcement', { reinforcement: 'speed' }); assert.deepEqual(f.player(who).active.reinforcements, ['power']); } assert.equal(f.room().pendingBattle, null); }
});

test('Diglett target validation rejects duplicate, third and default single-move second targets atomically', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t); f.play('diglett', level); const cardId = f.supply(f.leader); for (const targetIds of [[f.target.playerId, f.target.playerId], [f.leader.playerId, f.target.playerId, f.third.playerId], ...(level < 3 ? [[f.target.playerId, f.third.playerId]] : [])]) rejectsAtomically(f, () => f.attack({ cardId, targetIds }), 'INVALID_TARGET'); assert.equal(f.player(f.leader).hand.some(c => c.id === cardId), true); }
});

test('Diglett reinforcement removal precedes target Poison Point and is mandatory', t => {
  for (const level of [2, 3]) { const f = fixture(t); f.play('diglett', level); f.seed(f.target, 'nidoran-m', 1, { reinforcements: ['speed'] }); f.attack(); f.respond(); const id = f.room().pendingBattle.id; rejectsAtomically(f, () => f.respond()); rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: id, choice: 'reinforcement', reinforcement: 'defense' })); f.respond('reinforcement', { reinforcement: 'speed' }); assert.equal(f.room().pendingBattle.kind, 'poison-point'); f.respond(); assert.deepEqual(f.player(f.target).active.reinforcements, []); }
});

test('Diglett removes no reinforcement after Dodge or zero damage', t => {
  for (const level of [2, 3]) for (const prevention of ['dodge', 'immunity']) { const f = fixture(t); f.play('diglett', level); f.player(f.target).active.reinforcements = ['speed']; if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.target).active.damage, 0); assert.deepEqual(f.player(f.target).active.reinforcements, ['speed']); }
});

test('Diglett faint deployment bypasses Arena Trap and preserves incoming reinforcement', t => {
  const f = fixture(t); f.play('diglett', 3); f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2, reinforcements: ['power'] }); trap(f); f.player(f.target).reserve.reinforcements = ['speed']; const incoming = f.player(f.target).reserve.instanceId; f.attack(); f.drain(); assert.equal(f.player(f.target).active.instanceId, incoming); assert.deepEqual(f.player(f.target).active.reinforcements, ['speed']); assert.equal(f.room().switchEvent ?? null, null);
});

test('Arena Trap all three levels optionally charges one actual switching-trainer card', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t); f.play('squirtle'); trap(f, f.third, level); const cardId = f.supply(f.leader, 'dodge', 'rain'), card = structuredClone(f.player(f.leader).hand[0]), before = switchIds(f); ordinary(f); assert.equal(f.room().pendingBattle.kind, 'arena-trap'); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); assert.equal(f.room().pendingBattle.targetId, f.leader.playerId); assert.equal(f.room().pendingBattle.trait, 'arena-trap'); assert.equal(f.room().pendingBattle.canTrait, true); assert.deepEqual(switchIds(f), before); assert.equal(f.room().turn.switchUsed, false); f.respond('trait'); assert.equal(f.room().pendingBattle.kind, 'switch-payment'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); assert.equal(f.room().pendingBattle.targetId, f.leader.playerId); fee(f, cardId); assert.deepEqual(switchIds(f), before.reverse()); assert.equal(f.room().turn.switchUsed, true); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().switchEvent ?? null, null); assert.deepEqual(f.room().discardPile.find(c => c.id === cardId), card); assert.equal(countCard(f.room(), cardId), 1); }
});

test('Arena Trap passing offers swaps freely and reserves do not trap', t => {
  const f = fixture(t); const before = prepareTrap(f); f.respond(); assert.deepEqual(switchIds(f), before.reverse()); assert.equal(f.room().turn.switchUsed, true); assert.equal(f.room().discardPile.length, 0);
  const g = fixture(t); g.play('squirtle'); g.player(g.third).reserve.catalogueId = 'diglett'; const initial = switchIds(g); ordinary(g); assert.equal(g.room().pendingBattle, null); assert.deepEqual(switchIds(g), initial.reverse());
});

test('Arena Trap includes a trapper switching its own active partner', t => {
  const f = fixture(t); f.play('diglett'); const card = f.supply(f.leader), before = switchIds(f); ordinary(f); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); assert.equal(f.room().pendingBattle.targetId, f.leader.playerId); f.respond('trait'); fee(f, card); assert.deepEqual(switchIds(f), before.reverse()); assert.equal(f.room().turn.switchUsed, true);
});

test('Arena Trap payment pass cancels the swap and leaves ordinary switching available', t => {
  const f = fixture(t); const before = prepareTrap(f), card = f.supply(f.leader); f.respond('trait'); f.respond(); assert.deepEqual(switchIds(f), before); assert.equal(f.room().turn.switchUsed, false); assert.equal(f.player(f.leader).hand.some(c => c.id === card), true);
  ordinary(f); f.respond(); assert.deepEqual(switchIds(f), before.reverse()); assert.equal(f.room().turn.switchUsed, true);
});

test('Arena Trap invocation blocks an empty hand without creating an impossible payment', t => {
  const f = fixture(t); const before = prepareTrap(f); f.respond('trait'); assert.equal(f.room().pendingBattle, null); assert.deepEqual(switchIds(f), before); assert.equal(f.room().turn.switchUsed, false); assert.equal(f.room().switchEvent ?? null, null);
});

test('Arena Trap private payment choices expose only actor-owned safe card fields', t => {
  const f = fixture(t); const before = prepareTrap(f); const cards = [f.supply(f.leader, 'event', 'clear'), f.supply(f.leader, 'dodge', 'rain')], original = structuredClone(f.player(f.leader).hand), foreign = f.supply(f.target); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); f.respond('trait'); assert.deepEqual(f.view(f.leader).pendingBattle.cards, original.map(publicHand));
  for (const who of [...f.seats, observer]) { const view = f.view(who); assert.equal(view.switchEvent, undefined); assert.equal(view.resolution, undefined); for (const key of ['activeId', 'reserveId', 'eligibleActors', 'sourceId']) assert.equal(view.pendingBattle[key], undefined); if (who !== f.leader) { assert.equal(view.pendingBattle.cards, undefined); for (const id of cards) assert.equal(JSON.stringify(view).includes(id), false); } for (const card of original) { assert.equal(JSON.stringify(view.pendingBattle).includes(card.privateMarker), false); if (who !== f.leader) assert.equal(JSON.stringify(view).includes(card.privateMarker), false); } }
  rejectsAtomically(f, () => fee(f, foreign)); assert.deepEqual(switchIds(f), before); fee(f, cards[0]); assert.equal(countCard(f.room(), cards[0]), 1);
});

test('Arena Trap authority, stale decisions and arbitrary response fields reject atomically', t => {
  const f = fixture(t); prepareTrap(f); const own = f.supply(f.leader), foreign = f.supply(f.third), id = f.room().pendingBattle.id; rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: id, choice: 'trait' }), 'NOT_YOUR_DECISION');
  for (const payload of [{ choice: 'discard', cardId: own }, { choice: 'trait', cardId: own }, { choice: 'trait', cardIds: [] }, { choice: 'pass', effect: 'arena-trap' }]) rejectsAtomically(f, () => f.act(f.third, 'respondBattle', { decisionId: id, ...payload })); f.respond('trait'); const payment = f.room().pendingBattle.id; rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: id, choice: 'pass' }), 'STALE_DECISION'); rejectsAtomically(f, () => f.act(f.third, 'respondBattle', { decisionId: payment, choice: 'discard', cardId: foreign }), 'NOT_YOUR_DECISION');
  for (const payload of [{ choice: 'discard', cardId: foreign }, { choice: 'discard', cardId: 'forged' }, { choice: 'discard' }, { choice: 'discard', cardId: own, cardIds: [] }, { choice: 'discard', cardId: own, handIndex: 0 }, { choice: 'pass', cardId: own }, { choice: 'trait' }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: payment, ...payload })); fee(f, own);
});

test('Arena Trap multiple trappers use current-turn-first seat order and charge sequential fees', t => {
  const f = fixture(t); f.play('diglett'); trap(f, f.target); trap(f, f.third); const expected = [f.leader, ...[...f.room().players.slice(f.room().players.findIndex(p => p.id === f.leader.playerId) + 1), ...f.room().players.slice(0, f.room().players.findIndex(p => p.id === f.leader.playerId))].map(p => f.byId(p.id))]; const costs = expected.map(() => f.supply(f.leader)); const before = switchIds(f); ordinary(f);
  for (let i = 0; i < expected.length; i++) { assert.equal(f.room().pendingBattle.kind, 'arena-trap'); assert.equal(f.room().pendingBattle.actorId, expected[i].playerId); f.respond('trait'); assert.equal(f.room().pendingBattle.kind, 'switch-payment'); fee(f, costs[i]); if (i < expected.length - 1) assert.deepEqual(switchIds(f), before); }
  assert.deepEqual(switchIds(f), before.reverse()); for (const cost of costs) assert.equal(f.room().discardPile.filter(c => c.id === cost).length, 1);
});

test('Arena Trap an earlier paid fee stays discarded when a later trap fee is declined', t => {
  const f = fixture(t); f.play('diglett'); trap(f, f.target); const cost = f.supply(f.leader), kept = f.supply(f.leader), before = switchIds(f); ordinary(f); f.respond('trait'); fee(f, cost); assert.equal(f.room().pendingBattle.kind, 'arena-trap'); f.respond('trait'); f.respond(); assert.deepEqual(switchIds(f), before); assert.equal(f.room().turn.switchUsed, false); assert.equal(f.room().discardPile.filter(c => c.id === cost).length, 1); assert.equal(f.player(f.leader).hand.some(c => c.id === kept), true); assert.equal(f.room().pendingBattle, null);
});

test('Arena Trap uses live-seat adjacency with self; Speed and paralysis do not extend passive range', t => {
  for (const status of [null, 'paralysis']) { const f = fixture(t, { count: 6 }); f.play('squirtle'); const at = f.room().players.findIndex(p => p.id === f.leader.playerId), far = f.byId(f.room().players[(at + 2) % 6].id); trap(f, far); f.player(far).active.status = status; f.player(far).active.reinforcements = ['speed']; ordinary(f); assert.equal(f.room().pendingBattle, null); }
  const g = fixture(t, { count: 6 }); g.play('squirtle'); const at = g.room().players.findIndex(p => p.id === g.leader.playerId), near = g.byId(g.room().players[(at + 1) % 6].id); trap(g, near); g.player(near).active.status = 'paralysis'; ordinary(g); assert.equal(g.room().pendingBattle.actorId, near.playerId);
});

test('Arena Trap range compresses eliminated seats and excludes defeated or eliminated trappers', t => {
  const f = fixture(t, { count: 6 }); f.play('squirtle'); const at = f.room().players.findIndex(p => p.id === f.leader.playerId), skipped = f.byId(f.room().players[(at + 1) % 6].id), next = f.byId(f.room().players[(at + 2) % 6].id); f.player(skipped).eliminated = true; trap(f, next); ordinary(f); assert.equal(f.room().pendingBattle.actorId, next.playerId);
  for (const exclusion of ['defeated', 'eliminated']) { const g = fixture(t); g.play('squirtle'); trap(g); if (exclusion === 'defeated') g.player(g.third).active.defeated = true; else g.player(g.third).eliminated = true; ordinary(g); assert.equal(g.room().pendingBattle, null); }
});

test('Teleport draws before Arena Trap; blocked effect keeps its real command and draw settled', t => {
  const f = fixture(t); f.play('abra'); trap(f); const command = f.supply(f.leader), drawn = structuredClone(f.room().drawPile.at(-1)), before = switchIds(f); f.attack({ cardId: command, targetIds: [f.leader.playerId] }); f.respond(); assert.equal(f.room().pendingBattle.kind, 'arena-trap'); assert.equal(f.player(f.leader).hand.some(c => c.id === drawn.id), true); f.respond('trait'); f.respond(); assert.deepEqual(switchIds(f), before); assert.equal(f.room().turn.switchUsed, false); assert.equal(f.room().turn.commandCreatureId, before[0]); assert.equal(countCard(f.room(), command), 1); assert.deepEqual(f.player(f.leader).hand.find(c => c.id === drawn.id), drawn); assert.equal(f.room().resolution, null);
});

test('Whirlwind pays its rainy card before Arena Trap and keeps sleep/ordinary flags when blocked', t => {
  const f = fixture(t); f.play('caterpie', 3); trap(f); const card = f.supply(f.leader, 'event', 'rain'), before = switchIds(f, f.target); Object.assign(f.room().turn, { switchUsed: true, switchBlocked: true }); f.player(f.target).active.status = 'sleep'; f.supply(f.target, 'event'); f.attack({ cardId: card }); f.respond(); assert.equal(f.room().pendingBattle.kind, 'arena-trap'); f.respond('trait'); assert.equal(f.room().pendingBattle.actorId, f.target.playerId); f.respond(); assert.deepEqual(switchIds(f, f.target), before); assert.equal(f.room().turn.switchUsed, true); assert.equal(f.room().turn.switchBlocked, true); assert.equal(f.player(f.target).active.status, 'sleep'); assert.equal(f.room().discardPile.filter(c => c.id === card).length, 1); assert.equal(f.room().resolution, null);
});

test('Arena Trap payment restart and exact retry persist a single real discard and swap', t => {
  const f = fixture(t); const before = prepareTrap(f), cost = f.supply(f.leader, 'event', 'rain'); f.respond('trait'); const saved = f.view(f.leader), restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), recovered = restored.view(f.owner.code, f.leader.token).view; assert.equal(recovered.pendingBattle.id, saved.pendingBattle.id); assert.deepEqual(recovered.pendingBattle.cards, saved.pendingBattle.cards); const request = { id: 'restored-trap-payment', revision: recovered.revision, type: 'respondBattle', decisionId: recovered.pendingBattle.id, choice: 'discard', cardId: cost }; restored.action(f.owner.code, f.leader.token, request); const final = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.leader.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), final); const who = final.players.find(p => p.id === f.leader.playerId); assert.deepEqual([who.active.instanceId, who.reserve.instanceId], before.reverse()); assert.equal(final.discardPile.filter(c => c.id === cost).length, 1); assert.equal(final.switchEvent ?? null, null);
});

test('Arena Trap offer and payment optional expiry apply their distinct pass outcomes', t => {
  for (const invoke of [false, true]) { const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); const before = prepareTrap(f); f.supply(f.leader); if (invoke) f.respond('trait'); f.advance(5_000); assert.equal(f.view(f.leader).pendingBattle, null); assert.deepEqual(switchIds(f), invoke ? before : before.reverse()); assert.equal(f.room().turn.switchUsed, !invoke); assert.equal(f.room().switchEvent ?? null, null); }
});

test('Arena Trap views are read-only and an ordinary switch cannot bypass initial sleep blocking', t => {
  const f = fixture(t); prepareTrap(f); f.supply(f.leader); f.respond('trait'); const before = structuredClone(f.room()); for (let i = 0; i < 3; i++) for (const who of f.seats) f.view(who); assert.deepEqual(f.room(), before);
  const g = fixture(t); g.play('squirtle'); trap(g); g.room().turn.switchBlocked = true; const initial = switchIds(g); rejectsAtomically(g, () => ordinary(g), 'SWITCH_UNAVAILABLE'); assert.deepEqual(switchIds(g), initial); assert.equal(g.room().switchEvent ?? null, null);
});

test('Arena Trap snapshots eligible active instances and rejects a changed switching partner', t => {
  const f = fixture(t); const before = prepareTrap(f); trap(f, f.target); f.respond(); assert.equal(f.room().pendingBattle, null); assert.deepEqual(switchIds(f), before.reverse());
  const g = fixture(t); prepareTrap(g); const id = g.room().pendingBattle.id; g.player(g.leader).active.instanceId = 'replaced-after-switch-request'; rejectsAtomically(g, () => g.act(g.third, 'respondBattle', { decisionId: id, choice: 'trait' }), 'STALE_DECISION');
});

test('Arena Trap payment clock pauses for votes and disconnect, and restart preserves remaining time', t => {
  const f = fixture(t, { responseSeconds: 5 }); const before = prepareTrap(f); const cost = f.supply(f.leader); f.respond('trait'); f.advance(2_000); f.act(f.owner, 'requestEndGame'); f.advance(8_000); assert.equal(f.view(f.leader).pendingBattle.clock.remainingMs, 3_000); rejectsAtomically(f, () => f.respond(), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); f.advance(3_000); assert.equal(f.view(f.leader).pendingBattle, null); assert.deepEqual(switchIds(f), before); assert.equal(f.player(f.leader).hand.some(c => c.id === cost), true);
  const g = fixture(t, { responseSeconds: 60 }); prepareTrap(g); g.supply(g.leader); g.respond('trait'); const id = g.room().pendingBattle.id; g.advance(CONNECTED_MS + 1_000); const paused = g.view(g.third).pendingBattle; assert.equal(paused.clock.pausedReason, 'disconnected'); g.advance(5_000); assert.equal(g.view(g.third).pendingBattle.clock.remainingMs, paused.clock.remainingMs); const restored = new RoomStore({ dataDir: g.dir, catalogue, now: g.now }), recovered = restored.view(g.owner.code, g.leader.token).view; assert.equal(recovered.pendingBattle.id, id); assert.equal(recovered.pendingBattle.clock.remainingMs, paused.clock.remainingMs); assert.equal(recovered.pendingBattle.kind, 'switch-payment');
});
