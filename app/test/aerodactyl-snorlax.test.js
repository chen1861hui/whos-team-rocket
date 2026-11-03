import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore } from '../server/store.js';
import { endBattleTurn } from '../server/combat.js';




const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));
function fixture(t, { count = 3, turnSeconds = 0, responseSeconds = 0 } = {}) {
  const root = fileURLToPath(new URL('../.data/', import.meta.url));
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'aerodactyl-snorlax-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `aerodactyl-snorlax-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates, activeId = candidates.find(id => !['koffing', 'jynx', 'tauros'].includes(id)); act(who, 'selectPokemon', { activeId, reserveId: candidates.find(id => id !== activeId) }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-aerodactyl-snorlax-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private Aerodactyl Snorlax card ${serial}` } });
  room().drawPile = Array.from({ length: 48 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const top = (...weather) => { const cards = weather.map(value => makeCard('reveal-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const judgments = (...weather) => { const cards = weather.map(value => makeCard('judgment-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id), third = seats.find(who => who !== leader && who !== target);
  const play = (family = 'aerodactyl', level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, family, level); };
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
const allCards = room => [...room.drawPile, ...room.discardPile, ...room.players.flatMap(p => [...(p.hand || []), ...[p.active?.item, p.reserve?.item].filter(Boolean)]), ...[room.resolution, ...(room.resolutionStack || [])].flatMap(r => r ? [...(r.card && !r.cardClaimedBy ? [r.card] : []), ...(r.revealedCards || [])] : []), ...(room.judgment?.card ? [room.judgment.card] : []), ...(room.drawChoice?.cards || [])];
const countCard = (room, id) => allCards(room).filter(card => card.id === id).length;

const start = (f, who = f.leader) => f.store.startTurn(f.room(), who.playerId, f.room().turn.number + 1);
const drawToPlay = f => { while (f.room().turn.drawRemaining) f.act(f.leader, 'draw'); };
const enterEnd = f => { f.act(f.leader, 'finishPlay'); while (f.room().turn.phase === 'discard') f.act(f.leader, 'discard', { cardId: f.player(f.leader).hand[0].id }); };
const protect = (f, level = 1) => { f.seed(f.target, 'aerodactyl', level); return f.supply(f.target, 'event', 'rain'); };
const pay = (f, cardId) => f.respond('discard', { cardId });
const activeView = (f, who, viewer = f.leader) => f.view(viewer).players.find(player => player.id === who.playerId).active;

test('Aerodactyl and Snorlax expose exact reviewed HP and native command damage progression', t => {
  for (const [family, hp, damage] of [['aerodactyl', [3, 4, 4], [2, 2, 3]], ['snorlax', [4, 5, 6], [1, 2, 2]]]) { const entry = catalogue.entries.find(entry => entry.id === family); assert.deepEqual(entry.levels.map(face => face.hp), hp); assert.deepEqual(entry.levels.map(face => face.effectStatus), Array(3).fill('combat-preview')); for (const level of [1, 2, 3]) { const f = fixture(t); f.play(family, level); const battle = f.view(f.leader).self.battle; assert.equal(battle.moves.length, 1); assert.equal(battle.move.printedValue, damage[level - 1]); assert.equal(battle.move.maxTargets, 1); assert.equal(battle.canCommand, true); assert.equal(battle.canTrait, false); } }
});

test('catalogue and roster agree on executable groups while both new groups are supported', () => {
  const supported = catalogue.entries.filter(entry => entry.levels.every(face => face.effectStatus === 'combat-preview')); assert.ok(supported.length >= 39); assert.equal(catalogue.metadata.combatSupportedGroups, supported.length); assert.equal(supported.flatMap(entry => entry.levels).length, supported.length * 3); const roster = JSON.parse(readFileSync(new URL('../content/selection-roster.json', import.meta.url), 'utf8')); assert.equal(roster.entries.filter(entry => entry.supportedEffects).length, supported.length); for (const id of ['aerodactyl', 'snorlax']) assert.equal(roster.entries.find(entry => entry.id === id).supportedEffects, true); assert.equal(roster.entries.find(entry => entry.id === 'chansey').supportedEffects, false);
});

test('Pressure offers on every active level before defense and both payments use actual own cards', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t); f.play('squirtle'); const cost = protect(f, level), fee = f.supply(f.leader, 'dodge', 'thunderstorm'), command = f.supply(f.leader); f.attack({ cardId: command }); assert.equal(f.room().pendingBattle.kind, 'pressure'); assert.equal(f.room().pendingBattle.actorId, f.target.playerId); assert.equal(f.room().pendingBattle.targetId, f.leader.playerId); pay(f, cost); assert.equal(f.room().pendingBattle.kind, 'pressure-payment'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); assert.equal(f.room().pendingBattle.targetId, f.target.playerId); pay(f, fee); assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond(); assert.equal(f.player(f.target).active.damage, 2); for (const id of [cost, fee, command]) assert.equal(countCard(f.room(), id), 1); }
});

test('Pressure accepts every physical hand-card kind and any weather for either payment', t => {
  for (const kind of ['command', 'dodge', 'event', 'held-item']) { const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'aerodactyl'); const cost = f.supply(f.target, kind, 'clear'), fee = f.supply(f.leader, kind, 'rain'); f.attack(); pay(f, cost); pay(f, fee); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().discardPile.some(card => card.id === cost), true); assert.equal(f.room().discardPile.some(card => card.id === fee), true); }
});

test('passing the Pressure offer keeps the defender card and opens normal defense', t => {
  const f = fixture(t); f.play('squirtle'); const cost = protect(f); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.player(f.target).hand.some(card => card.id === cost), true); f.respond(); assert.equal(f.player(f.target).active.damage, 2);
});

test('Pressure skips an empty-handed defender and reserve-only Aerodactyl', t => {
  for (const exclusion of ['empty', 'reserve']) { const f = fixture(t); f.play('squirtle'); if (exclusion === 'empty') f.seed(f.target, 'aerodactyl'); else { f.player(f.target).reserve.catalogueId = 'aerodactyl'; f.supply(f.target); } f.attack(); assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond(); assert.equal(f.player(f.target).active.damage, 2); }
});

test('a paid Pressure offer auto-invalidates the target when source has no spare card after its command', t => {
  const f = fixture(t); f.play('squirtle'); const cost = protect(f), command = f.supply(f.leader); f.player(f.leader).active.reinforcements = ['power']; f.player(f.target).active.reinforcements = ['defense']; f.helmet(f.target); f.attack({ cardId: command }); pay(f, cost); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.leader).active.damage, 0); assert.deepEqual(f.player(f.leader).active.reinforcements, []); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); for (const id of [command, cost]) assert.equal(countCard(f.room(), id), 1); assert.equal(f.view(f.leader).self.battle.canCommand, false);
});

test('source payment pass invalidates the whole command for that target and preserves the source spare card', t => {
  const f = fixture(t); f.play('squirtle'); const cost = protect(f), spare = f.supply(f.leader, 'event'); f.attack(); pay(f, cost); f.respond(); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.leader).hand.some(card => card.id === spare), true); assert.equal(f.room().discardPile.some(card => card.id === cost), true);
});

test('self-targeted Pressure requires two distinct remaining cards after command payment', t => {
  const f = fixture(t); f.play('aerodactyl'); const first = f.supply(f.leader, 'event'), second = f.supply(f.leader, 'dodge'), command = f.supply(f.leader); f.attack({ cardId: command, targetIds: [f.leader.playerId] }); assert.equal(f.room().pendingBattle.kind, 'pressure'); pay(f, first); assert.equal(f.room().pendingBattle.kind, 'pressure-payment'); rejectsAtomically(f, () => pay(f, first)); pay(f, second); f.respond(); assert.equal(f.player(f.leader).active.damage, 2); for (const id of [first, second, command]) assert.equal(countCard(f.room(), id), 1);
});

test('self-targeted Pressure with only one remaining card invalidates after spending its first cost', t => {
  const f = fixture(t); f.play('aerodactyl'); const first = f.supply(f.leader, 'event'); f.attack({ targetIds: [f.leader.playerId] }); pay(f, first); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.leader).hand.length, 0);
});

test('Pressure actor-only payment projections expose safe card stubs for each distinct payer', t => {
  const f = fixture(t); f.play('squirtle'); const cost = protect(f), fee = f.supply(f.leader, 'dodge'), targetCard = structuredClone(f.player(f.target).hand[0]), sourceCard = structuredClone(f.player(f.leader).hand[0]), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); f.attack(); assert.deepEqual(f.view(f.target).pendingBattle.paymentCards, [publicHand(targetCard)]); for (const who of [f.leader, f.third, observer]) { const view = f.view(who); assert.equal(view.pendingBattle.paymentCards, undefined); assert.equal(JSON.stringify(view).includes(cost), false); }
  pay(f, cost); assert.deepEqual(f.view(f.leader).pendingBattle.paymentCards, [publicHand(sourceCard)]); for (const who of [f.target, f.third, observer]) { const view = f.view(who); assert.equal(view.pendingBattle.paymentCards, undefined); assert.equal(JSON.stringify(view).includes(fee), false); } assert.equal(JSON.stringify(f.view(f.leader).pendingBattle).includes('privateMarker'), false);
});

test('Pressure rejects wrong actor, stale decision, foreign payment and unrelated response fields atomically', t => {
  const f = fixture(t); f.play('squirtle'); const own = protect(f), foreign = f.supply(f.third); f.supply(f.leader); f.attack(); const pending = f.room().pendingBattle; rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, choice: 'discard', cardId: own }), 'NOT_YOUR_DECISION'); rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: 'stale', choice: 'pass' }), 'STALE_DECISION');
  for (const payload of [{ choice: 'trait' }, { choice: 'discard' }, { choice: 'discard', cardId: foreign }, { choice: 'discard', cardId: 'forged' }, { choice: 'pass', cardId: own }, { choice: 'discard', cardId: own, targetId: f.third.playerId }, { choice: 'discard', cardId: own, cardIds: [] }]) rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, ...payload }));
});

test('Pressure payment enforces the original source authority and its own strict card selection', t => {
  const f = fixture(t); f.play('squirtle'); const first = protect(f), fee = f.supply(f.leader), foreign = f.supply(f.third); f.attack(); pay(f, first); const pending = f.room().pendingBattle; rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'pass' }), 'NOT_YOUR_DECISION'); for (const payload of [{ choice: 'trait' }, { choice: 'discard', cardId: foreign }, { choice: 'discard', cardId: first }, { choice: 'pass', cardId: fee }, { choice: 'discard', cardId: fee, targetId: f.target.playerId }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...payload }));
});

test('Pressure offers only once for Double Kick and a paid source card covers both settlements', t => {
  const f = fixture(t); f.play('nidoran-m'); const cost = protect(f), fee = f.supply(f.leader); f.attack(); pay(f, cost); pay(f, fee); for (let hit = 1; hit <= 2; hit++) { assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.view(f.target).pendingBattle.settlementNumber, hit); f.respond(); } assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle, null); for (const id of [cost, fee]) assert.equal(countCard(f.room(), id), 1);
});

test('unpaid Pressure invalidates every Double Kick hit and Fury Attack without opening later defenses or reveals', t => {
  for (const family of ['nidoran-m', 'weedle']) { const f = fixture(t); f.play(family, family === 'weedle' ? 3 : 1); const cost = protect(f), spare = f.supply(f.leader, 'event'); const cards = f.top('clear', 'rain', 'intense-sun', 'rain'); f.attack(); pay(f, cost); f.respond(); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.leader).hand.some(card => card.id === spare), true); assert.equal(f.room().drawPile.at(-1).id, cards[0].id); for (const card of cards) assert.equal(f.room().discardPile.some(value => value.id === card.id), false); }
});

test('multi-target Pressure invalidates only the refused original slot while another paid target still resolves', t => {
  const f = fixture(t); f.play('diglett', 3); const first = protect(f); f.seed(f.third, 'aerodactyl'); const second = f.supply(f.third), fee = f.supply(f.leader, 'event'); f.player(f.target).active.reinforcements = ['speed']; f.attack({ targetIds: [f.target.playerId, f.third.playerId] }); pay(f, first); f.respond(); assert.equal(f.room().pendingBattle.kind, 'pressure'); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); pay(f, second); pay(f, fee); assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); f.respond(); assert.equal(f.player(f.target).active.damage, 0); assert.deepEqual(f.player(f.target).active.reinforcements, ['speed']); assert.equal(f.player(f.third).active.damage, 2); assert.equal(f.room().pendingBattle, null);
});

test('Pressure follows final Cute Charm target assignment and precedes Future Sight and marker-use effects', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'clefairy'); const charm = f.supply(f.target); f.seed(f.third, 'aerodactyl'); const cost = f.supply(f.third); f.supply(f.leader); f.attack(); assert.equal(f.room().pendingBattle.kind, 'cute-charm'); f.respond('redirect', { cardId: charm, targetId: f.third.playerId }); assert.equal(f.room().pendingBattle.kind, 'pressure'); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); pay(f, cost); f.respond(); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.third).active.damage, 0);
  const g = fixture(t); g.play('slowpoke', 3); const pressure = protect(g), fee = g.supply(g.leader); g.attack(); assert.equal(g.room().pendingBattle.kind, 'pressure'); pay(g, pressure); pay(g, fee); assert.equal(g.room().pendingBattle.kind, 'foresee'); g.drain();
});

test('a Pressure-invalid target never receives Machop marker removal or Freeze-Dry suppression', t => {
  for (const family of ['machop', 'lapras']) { const f = fixture(t); f.play(family, family === 'lapras' ? 3 : 1); const cost = protect(f); f.player(f.target).active.reinforcements = ['power', 'defense', 'speed']; f.attack(); assert.equal(activeView(f, f.target).reinforcementsSuppressed, false); pay(f, cost); assert.deepEqual(f.player(f.target).active.reinforcements, ['power', 'defense', 'speed']); assert.equal(activeView(f, f.target).reinforcementsSuppressed, false); assert.equal(f.room().pendingBattle, null); }
});

test('Moxie resolves before Pressure and its actual gained card can pay the source fee', t => {
  const f = fixture(t); f.play('magikarp', 2); const cost = protect(f), drawn = f.room().drawPile.at(-1).id; f.attack(); assert.equal(f.room().pendingBattle.kind, 'pressure'); assert.equal(f.player(f.leader).hand.some(card => card.id === drawn), true); pay(f, cost); pay(f, drawn); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(countCard(f.room(), drawn), 1);
});

test('Pressure also invalidates a virtual Justified command without consuming a fictional command card', t => {
  const f = fixture(t); f.play('growlithe'); const cost = protect(f), gift = f.supply(f.leader, 'event'); f.act(f.leader, 'giveCards', { cardIds: [gift], recipientId: f.third.playerId, targetIds: [f.target.playerId] }); assert.equal(f.room().resolution.virtualCommand, true); assert.equal(f.room().pendingBattle.kind, 'pressure'); pay(f, cost); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.third).hand.some(card => card.id === gift), true); assert.equal(f.room().pendingBattle, null); assert.equal(countCard(f.room(), gift), 1);
});

test('Pressure excludes weather-paid moves but can invalidate no-damage command effects', t => {
  const f = fixture(t); f.play('porygon', 3); protect(f); const move = f.view(f.leader).self.battle.moves.find(move => move.effectKind === 'lock-on'); f.attack({ moveIndex: move.index, cardId: f.supply(f.leader, 'event', 'clear') }); assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond(); assert.deepEqual(f.room().turn.dodgeBlockedCreatureIds, [f.player(f.target).active.instanceId]);
  const g = fixture(t); g.play('clefairy', 2); const cost = protect(g), spare = g.supply(g.leader); g.player(g.target).active.damage = 2; g.attack({ effectChoice: 'heal' }); pay(g, cost); g.respond(); assert.equal(g.player(g.target).active.damage, 2); assert.equal(g.player(g.leader).hand.some(card => card.id === spare), true); assert.equal(g.room().pendingBattle, null);
});

test('Pressure offer timeout preserves its unspent card and opens a fresh ordinary defense window', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play('squirtle'); const cost = protect(f); f.advance(1_000); f.attack(); f.advance(5_000); const view = f.view(f.target); assert.equal(view.pendingBattle.kind, 'defense'); assert.equal(view.pendingBattle.clock.remainingMs, 5_000); assert.equal(f.player(f.target).hand.some(card => card.id === cost), true); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.view(f.leader).turn.clock.remainingMs, 59_000);
});

test('Pressure source payment timeout invalidates the whole target without taking its remaining source card', t => {
  const f = fixture(t, { responseSeconds: 5 }); f.play('squirtle'); const cost = protect(f), fee = f.supply(f.leader); f.attack(); pay(f, cost); f.advance(5_000); f.view(f.leader); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.leader).hand.some(card => card.id === fee), true); assert.equal(f.room().discardPile.some(card => card.id === cost), true);
});

test('Pressure restart preserves both original instances and exact source-payment retries discard and settle once', t => {
  const f = fixture(t); f.play('squirtle'); const cost = protect(f), fee = f.supply(f.leader), command = f.supply(f.leader); f.attack({ cardId: command }); pay(f, cost); const saved = structuredClone(f.room().resolution), restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.leader.token).view; assert.equal(view.pendingBattle.kind, 'pressure-payment'); assert.deepEqual(restored.rooms.get(f.owner.code).resolution, saved); const request = { id: 'restored-pressure-fee', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'discard', cardId: fee }; restored.action(f.owner.code, f.leader.token, request); const once = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.leader.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), once); assert.equal(once.pendingBattle.kind, 'defense'); for (const id of [cost, fee, command]) assert.equal(countCard(once, id), 1);
});

test('Pressure first payment exact retry never discards twice or repeats the target offer', t => {
  const f = fixture(t); f.play('squirtle'); const cost = protect(f); f.supply(f.leader); f.attack(); const request = f.input('respondBattle', { decisionId: f.room().pendingBattle.id, choice: 'discard', cardId: cost }); f.store.action(f.owner.code, f.target.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.target.token, request); assert.deepEqual(f.room(), once); assert.equal(f.room().pendingBattle.kind, 'pressure-payment'); assert.equal(countCard(f.room(), cost), 1);
});

test('closing votes preserve unfinished Pressure payments and block responses without consuming source cards', t => {
  const f = fixture(t); f.play('squirtle'); const cost = protect(f), fee = f.supply(f.leader); f.attack(); pay(f, cost); const pending = structuredClone(f.room().pendingBattle); f.act(f.owner, 'requestEndGame'); rejectsAtomically(f, () => pay(f, fee), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); assert.equal(f.room().pendingBattle.id, pending.id); pay(f, fee); f.respond(); assert.equal(f.player(f.target).active.damage, 2);
});

test('Gluttony replaces a held Helmet effect on every active Snorlax level without modifying the actual item', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'snorlax', level); const item = f.helmet(f.target), original = structuredClone(item); assert.equal(activeView(f, f.target).itemEffectReplacement, 'gluttony'); f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.room().pendingBattle, null); assert.deepEqual(f.player(f.target).active.item, original); assert.equal(countCard(f.room(), item.id), 1); }
});

test('Gluttony heals exactly one on actual own turn handoff and not merely when entering End', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t); f.play('snorlax', level); f.player(f.leader).active.damage = 3; const item = f.helmet(f.leader); enterEnd(f); assert.equal(f.player(f.leader).active.damage, 3); assert.equal(f.room().turn.phase, 'end'); f.act(f.leader, 'endTurn', { levelUp: false }); assert.equal(f.player(f.leader).active.damage, 2); assert.equal(countCard(f.room(), item.id), 1); }
});

test('Gluttony healing caps at full HP and requires a real held-item card rather than a missing or wrong-kind object', t => {
  for (const scenario of ['full', 'none', 'wrong-kind', 'other-held']) { const f = fixture(t); f.play('snorlax'); f.player(f.leader).active.damage = scenario === 'full' ? 0 : 2; if (scenario === 'full') f.helmet(f.leader); else if (scenario === 'wrong-kind') f.player(f.leader).active.item = f.makeCard('event', 'clear'); else if (scenario === 'other-held') f.player(f.leader).active.item = f.makeCard('held-item', 'rain'); enterEnd(f); f.act(f.leader, 'endTurn', { levelUp: false }); assert.equal(f.player(f.leader).active.damage, scenario === 'other-held' ? 1 : scenario === 'full' ? 0 : 2); }
});

test('Gluttony does not heal a reserve Snorlax or another trainer Snorlax at the current owner handoff', t => {
  const f = fixture(t); f.play('squirtle'); Object.assign(f.player(f.leader).reserve, { catalogueId: 'snorlax', damage: 2, item: f.makeCard('held-item') }); f.seed(f.target, 'snorlax', 2, { damage: 2 }); f.helmet(f.target); enterEnd(f); f.act(f.leader, 'endTurn', { levelUp: false }); assert.equal(f.player(f.leader).reserve.damage, 2); assert.equal(f.player(f.target).active.damage, 2);
});

test('Gluttony is a passive item replacement and offers no optional useTrait or extra card gain', t => {
  const f = fixture(t); f.play('snorlax'); f.player(f.leader).active.damage = 2; const item = f.helmet(f.leader), original = structuredClone(item), deck = structuredClone(f.room().drawPile); rejectsAtomically(f, () => f.act(f.leader, 'useTrait')); enterEnd(f); f.act(f.leader, 'endTurn', { levelUp: true }); assert.equal(f.player(f.leader).active.level, 2); assert.equal(f.player(f.leader).active.damage, 1); assert.deepEqual(f.player(f.leader).active.item, original); assert.deepEqual(f.room().drawPile, deck); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(f.room().pendingBattle, null);
});

test('explicit End validation happens before Gluttony and a rejected level-cap request cannot heal', t => {
  const f = fixture(t); f.play('snorlax', 3); f.player(f.leader).active.damage = 2; f.helmet(f.leader); enterEnd(f); rejectsAtomically(f, () => f.act(f.leader, 'endTurn', { levelUp: true }), 'LEVEL_CAP'); assert.equal(f.player(f.leader).active.damage, 2); f.act(f.leader, 'endTurn', { levelUp: false }); assert.equal(f.player(f.leader).active.damage, 1);
});

test('timeout handoff uses the same Gluttony heal once and later polling does not repeat it', t => {
  const f = fixture(t, { turnSeconds: 5 }); f.play('snorlax'); f.player(f.leader).active.damage = 3; f.helmet(f.leader); enterEnd(f); f.advance(5_000); f.view(f.leader); assert.notEqual(f.room().turn.playerId, f.leader.playerId); assert.equal(f.player(f.leader).active.damage, 2); f.view(f.leader); f.view(f.target); assert.equal(f.player(f.leader).active.damage, 2);
});

test('endBattleTurn idempotence marker permits only one Gluttony application for the same completed turn', t => {
  const f = fixture(t); f.play('snorlax'); f.player(f.leader).active.damage = 3; f.helmet(f.leader); enterEnd(f); endBattleTurn(f.room(), f.player(f.leader), f.store.battleContext()); assert.equal(f.room().turn.endEffectsDone, true); assert.equal(f.player(f.leader).active.damage, 2); endBattleTurn(f.room(), f.player(f.leader), f.store.battleContext()); assert.equal(f.player(f.leader).active.damage, 2); f.act(f.leader, 'endTurn', { levelUp: false }); assert.equal(f.player(f.leader).active.damage, 2);
});

test('Gluttony export never heals a defeated or nonpositive-HP Snorlax', t => {
  for (const scenario of ['defeated', 'zero']) { const f = fixture(t); f.play('snorlax'); f.helmet(f.leader); enterEnd(f); Object.assign(f.player(f.leader).active, scenario === 'defeated' ? { defeated: true, damage: 2 } : { hpBonus: 0, damage: 4 }); const before = f.player(f.leader).active.damage; endBattleTurn(f.room(), f.player(f.leader), f.store.battleContext()); assert.equal(f.player(f.leader).active.damage, before);
    // Fainting during rescue retains trait projection until formal defeat; End never rescues it.
    assert.equal(activeView(f, f.leader).itemEffectReplacement, scenario === 'defeated' ? undefined : 'gluttony'); }
});

test('item suppression on either the current resolution or an ancestor blocks Gluttony replacement and End healing', t => {
  for (const scope of ['current', 'ancestor']) { const f = fixture(t); f.play('snorlax'); f.player(f.leader).active.damage = 2; f.helmet(f.leader); enterEnd(f); const suppressed = { kind: 'move', suppressedItemIds: [f.player(f.leader).active.instanceId] }; if (scope === 'current') f.room().resolution = suppressed; else f.room().resolutionStack = [suppressed]; assert.equal(activeView(f, f.leader).itemEffectReplacement, undefined); assert.equal(activeView(f, f.leader).itemSuppressed, true); endBattleTurn(f.room(), f.player(f.leader), f.store.battleContext()); assert.equal(f.player(f.leader).active.damage, 2); }
});

test('Gluttony End exact retry and restart preserve one heal and the original held-card identity', t => {
  const f = fixture(t); f.play('snorlax'); f.player(f.leader).active.damage = 3; const item = f.helmet(f.leader); enterEnd(f); const request = f.input('endTurn', { levelUp: true }); f.store.action(f.owner.code, f.leader.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), once); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), pokemon = restored.rooms.get(f.owner.code).players.find(player => player.id === f.leader.playerId).active; assert.equal(pokemon.damage, 2); assert.equal(pokemon.level, 2); assert.equal(pokemon.item.id, item.id); assert.equal(countCard(restored.rooms.get(f.owner.code), item.id), 1);
});

test('closing votes prevent an own End heal until the actual authorized handoff resumes', t => {
  const f = fixture(t); f.play('snorlax'); f.player(f.leader).active.damage = 2; f.helmet(f.leader); enterEnd(f); f.act(f.owner, 'requestEndGame'); rejectsAtomically(f, () => f.act(f.leader, 'endTurn', { levelUp: false }), 'VOTE_PENDING'); assert.equal(f.player(f.leader).active.damage, 2); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); f.act(f.leader, 'endTurn', { levelUp: false }); assert.equal(f.player(f.leader).active.damage, 1);
});

test('Wing Attack and Tackle are plain native command damage without weather judgments', t => {
  for (const [family, damage] of [['aerodactyl', 2], ['snorlax', 1]]) { const f = fixture(t); f.play(family); const command = f.supply(f.leader), top = f.room().drawPile.at(-1).id; f.attack({ cardId: command }); f.respond(); assert.equal(f.player(f.target).active.damage, damage); assert.equal(f.player(f.target).active.status, null); assert.equal(f.room().drawPile.at(-1).id, top); assert.equal(countCard(f.room(), command), 1); }
});

test('both Bite faces deal two and flinch on either rainy final judgment only', t => {
  for (const family of ['aerodactyl', 'snorlax']) for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) { const f = fixture(t); f.play(family, 2); const judged = f.judgments(weather)[0]; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, ['rain', 'thunderstorm'].includes(weather) ? 'flinch' : null); assert.equal(countCard(f.room(), judged.id), 1); }
});

test('Snorlax Body Slam deals two and paralyzes on either sunny final judgment only', t => {
  for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) { const f = fixture(t); f.play('snorlax', 3); f.judgments(weather); f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, ['intense-sun', 'clear'].includes(weather) ? 'paralysis' : null); }
});

test('Bite judgments require positive damage and never flinch a newly deployed reserve', t => {
  for (const prevention of ['dodge', 'immunity', 'shed', 'faint']) { const f = fixture(t); f.play('aerodactyl', 2); if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; if (prevention === 'shed') { f.seed(f.target, 'caterpie', 2); f.supply(f.target, 'event'); f.supply(f.target, 'event'); } if (prevention === 'faint') f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); const incoming = f.player(f.target).reserve.instanceId, judged = f.judgments('rain')[0]; f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); if (prevention === 'shed') f.respond('shed', { cardIds: ids(f.player(f.target).hand) }); f.drain(); assert.equal(f.player(f.target).active.status, null); if (prevention === 'faint') assert.equal(f.player(f.target).active.instanceId, incoming); else assert.equal(f.room().drawPile.at(-1).id, judged.id); }
});

test('Bite and Body Slam share Drought final-weather, Shield Dust and Poison Touch rules', t => {
  const f = fixture(t); f.play('aerodactyl', 2); f.seed(f.third, 'vulpix'); const clear = f.supply(f.third, 'event', 'clear'); f.judgments('rain'); f.attack(); f.respond(); f.respond('replace', { cardId: clear }); assert.equal(f.player(f.target).active.status, null);
  const g = fixture(t); g.play('snorlax', 3); g.seed(g.target, 'caterpie'); g.judgments('clear'); g.attack(); g.respond(); assert.equal(g.player(g.target).active.status, null);
  const h = fixture(t); h.play('aerodactyl', 2); h.seed(h.third, 'grimer'); h.judgments('thunderstorm'); h.attack(); h.respond(); assert.equal(h.room().pendingBattle.kind, 'poison-touch'); h.respond('trait'); assert.equal(h.player(h.target).active.status, 'poison');
});

test('Aerodactyl Hyper Beam declaration discard adds one damage before Burn and receiving Defense', t => {
  for (const [status, defense, expected] of [[null, false, 4], ['burn', false, 1], [null, true, 1]]) { const f = fixture(t); f.play('aerodactyl', 3); f.player(f.leader).active.status = status; if (defense) f.player(f.target).active.reinforcements = ['defense']; const command = f.supply(f.leader), boost = f.supply(f.leader, 'event', 'rain'); f.attack({ cardId: command, boostCardId: boost }); f.respond(); assert.equal(f.player(f.target).active.damage, expected); for (const id of [command, boost]) assert.equal(countCard(f.room(), id), 1); }
});

test('Hyper Beam optional declaration is validated before command, boost or Power payment', t => {
  const f = fixture(t); f.play('aerodactyl', 3); f.player(f.leader).active.reinforcements = ['power']; const command = f.supply(f.leader), foreign = f.supply(f.target); for (const boostCardId of [command, foreign, 'forged']) rejectsAtomically(f, () => f.attack({ cardId: command, boostCardId })); assert.deepEqual(f.player(f.leader).active.reinforcements, ['power']);
  const g = fixture(t); g.play('snorlax', 3); const own = g.supply(g.leader), cost = g.supply(g.leader, 'event'); rejectsAtomically(g, () => g.attack({ cardId: own, boostCardId: cost }));
});

test('Pressure costs never refund a Hyper Beam declaration discard or its captured Power after invalidation', t => {
  const f = fixture(t); f.play('aerodactyl', 3); f.player(f.leader).active.reinforcements = ['power', 'power']; const cost = protect(f), command = f.supply(f.leader), boost = f.supply(f.leader, 'event'); f.attack({ cardId: command, boostCardId: boost }); assert.equal(f.player(f.leader).hand.length, 0); pay(f, cost); assert.equal(f.player(f.target).active.damage, 0); assert.deepEqual(f.player(f.leader).active.reinforcements, []); for (const id of [command, boost, cost]) assert.equal(countCard(f.room(), id), 1);
});

test('Hyper Beam exact attack retries cannot duplicate declaration payment or damage', t => {
  const f = fixture(t); f.play('aerodactyl', 3); const command = f.supply(f.leader), boost = f.supply(f.leader, 'event'), request = f.input('attack', { cardId: command, boostCardId: boost, targetIds: [f.target.playerId] }); f.store.action(f.owner.code, f.leader.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), once); f.respond(); assert.equal(f.player(f.target).active.damage, 4); for (const id of [command, boost]) assert.equal(countCard(f.room(), id), 1);
});

test('Gas suppresses Pressure without suppressing Aerodactyl native move effects', t => {
  const f = fixture(t); f.play('squirtle'); protect(f); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); start(f); f.respond('suppress', { cardId: cost, targetId: f.target.playerId }); drawToPlay(f); f.attack(); assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond(); assert.equal(f.player(f.target).active.damage, 2);
  const g = fixture(t); g.play('aerodactyl', 2); g.seed(g.third, 'koffing'); const fee = g.supply(g.third); start(g); g.respond('suppress', { cardId: fee, targetId: g.leader.playerId }); drawToPlay(g); g.judgments('rain'); g.attack(); g.respond(); assert.equal(g.player(g.target).active.status, 'flinch');
});

test('Gas restores a Snorlax held Helmet original retaliation and removes its Gluttony replacement label', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'snorlax'); f.helmet(f.target); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); start(f); f.respond('suppress', { cardId: cost, targetId: f.target.playerId }); drawToPlay(f); assert.equal(activeView(f, f.target).itemEffectReplacement, undefined); f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.room().pendingBattle, null);
});

test('Gluttony is evaluated before the old turn Gas suppression clears on handoff', t => {
  const f = fixture(t); f.play('snorlax'); f.player(f.leader).active.damage = 2; f.helmet(f.leader); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); start(f); f.respond('suppress', { cardId: cost, targetId: f.leader.playerId }); drawToPlay(f); enterEnd(f); f.act(f.leader, 'endTurn', { levelUp: false }); assert.equal(f.player(f.leader).active.damage, 2); assert.deepEqual(f.room().turn.suppressedTraitPlayerIds, []); assert.equal(activeView(f, f.leader).itemEffectReplacement, 'gluttony'); f.drain();
});

test('both new families retain ordinary range, real command payment and one command-using instance limits', t => {
  for (const family of ['aerodactyl', 'snorlax']) { const f = fixture(t, { count: 6 }); f.play(family, 3); const command = f.supply(f.leader), wrong = f.supply(f.leader, 'event'), foreign = f.supply(f.target), far = f.seats.find(who => !f.view(f.leader).self.battle.legalTargetIds.includes(who.playerId)); for (const cardId of [wrong, foreign, 'forged']) rejectsAtomically(f, () => f.attack({ cardId })); rejectsAtomically(f, () => f.attack({ cardId: command, targetIds: [far.playerId] })); f.judgments('rain'); f.attack({ cardId: command }); f.drain(); const next = f.supply(f.leader); rejectsAtomically(f, () => f.attack({ cardId: next })); f.act(f.leader, 'switchPokemon'); assert.equal(f.view(f.leader).self.battle.canCommand, false); }
});
