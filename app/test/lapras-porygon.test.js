import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore } from '../server/store.js';
import { battleReinforcementEffective } from '../server/combat.js';



const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));
function fixture(t, { count = 3, turnSeconds = 0, responseSeconds = 0 } = {}) {
  const root = fileURLToPath(new URL('../.data/', import.meta.url));
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'lapras-porygon-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ allowTestDecks: true, dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `lapras-porygon-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates, activeId = candidates.find(id => !['koffing', 'jynx', 'tauros'].includes(id)); act(who, 'selectPokemon', { activeId, reserveId: candidates.find(id => id !== activeId) }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-lapras-porygon-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private Lapras Porygon card ${serial}` } });
  room().drawPile = Array.from({ length: 48 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const top = (...weather) => { const cards = weather.map(value => makeCard('reveal-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const judgments = (...weather) => { const cards = weather.map(value => makeCard('judgment-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id), third = seats.find(who => who !== leader && who !== target);
  const play = (family = 'lapras', level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, family, level); };
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
const drawSetup = (f, level = 1, extra = {}) => { f.seed(f.leader, 'porygon', level, extra); start(f); };
const download = f => f.act(f.leader, 'useTrait');
const choose = (f, who = []) => f.respond('targets', { targetIds: who.map(who => who.playerId) });
const steal = (f, handIndex = 0) => f.respond('card', { handIndex });
const activeView = (f, who, viewer = f.leader) => f.view(viewer).players.find(player => player.id === who.playerId).active;
const lock = (f, who = f.target, weather = 'clear') => { const move = f.view(f.leader).self.battle.moves.find(move => move.effectKind === 'lock-on'); assert.ok(move); return f.attack({ moveIndex: move.index, targetIds: [who.playerId], cardId: f.supply(f.leader, 'event', weather) }); };

test('Lapras and Porygon expose reviewed HP, native command damage and the extra level-three Lock-On', t => {
  for (const [family, hp, damage] of [['lapras', [3, 4, 5], [1, 2, 2]], ['porygon', [3, 4, 4], [1, 2, 2]]]) { const entry = catalogue.entries.find(entry => entry.id === family); assert.deepEqual(entry.levels.map(face => face.hp), hp); assert.deepEqual(entry.levels.map(face => face.effectStatus), Array(3).fill('combat-preview')); for (const level of [1, 2, 3]) { const f = fixture(t); f.play(family, level); const battle = f.view(f.leader).self.battle; assert.equal(battle.canCommand, true); assert.equal(battle.canTrait, false); assert.equal(battle.move.printedValue, damage[level - 1]); assert.equal(battle.moves.length, family === 'porygon' && level === 3 ? 2 : 1); } }
});

test('catalogue and roster consistently support both new groups and support Chansey', () => {
  const supported = catalogue.entries.filter(entry => entry.levels.every(face => face.effectStatus === 'combat-preview')); assert.ok(supported.length >= 37); assert.equal(catalogue.metadata.combatSupportedGroups, supported.length); const roster = JSON.parse(readFileSync(new URL('../content/selection-roster.json', import.meta.url), 'utf8')); assert.equal(roster.entries.filter(entry => entry.supportedEffects).length, supported.length); for (const id of ['lapras', 'porygon']) assert.equal(roster.entries.find(entry => entry.id === id).supportedEffects, true); assert.equal(roster.entries.find(entry => entry.id === 'chansey').supportedEffects, true);
});

test('mandatory Water Absorb judges every Lapras level after positive damage: rain heals one, storm draws one', t => {
  for (const level of [1, 2, 3]) for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) { const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'lapras', level); const judged = f.judgments(weather)[0], drawn = f.room().drawPile.at(-2); f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, weather === 'rain' ? 1 : 2); assert.deepEqual(f.player(f.target).hand, weather === 'thunderstorm' ? [drawn] : []); assert.equal(f.room().pendingBattle, null); assert.equal(countCard(f.room(), judged.id), 1); }
});

test('Water Absorb does not judge after Dodge, immunity, lethal original-target defeat or reserve-only ability', t => {
  for (const prevention of ['dodge', 'immunity', 'faint', 'reserve']) { const f = fixture(t); f.play('squirtle'); f.seed(f.target, prevention === 'reserve' ? 'squirtle' : 'lapras', 1, prevention === 'faint' ? { hpBonus: 0, damage: 2 } : {}); f.player(f.target).reserve.catalogueId = 'lapras'; if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; const judged = f.judgments('rain')[0]; f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); f.drain(); assert.equal(f.player(f.target).hand.length, 0); if (prevention !== 'faint') assert.equal(f.room().drawPile.at(-1).id, judged.id); else assert.equal(f.player(f.target).active.damage, 0); }
});

test('Water Absorb uses Drought final weather rather than its original revealed result', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'lapras'); f.seed(f.third, 'vulpix'); const replacement = f.supply(f.third, 'event', 'clear'); f.judgments('rain'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'judgment'); assert.equal(f.player(f.target).active.damage, 2); f.respond('replace', { cardId: replacement }); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).hand.length, 0);
});

test('Water Absorb and Helmet let the receiver choose either receiving order with nested damage settled', t => {
  for (const first of ['water-absorb', 'rocky-helmet']) { const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'lapras'); f.helmet(f.target); f.judgments('rain'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'effects'); assert.deepEqual(new Set(f.room().pendingBattle.effects), new Set(['water-absorb', 'rocky-helmet'])); f.respond('effect', { effect: first }); f.drain(); assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.room().resolution, null); }
});

test('Water Absorb triggers on source-free poison and confusion without creating a move or defeat reward', t => {
  for (const status of ['poison', 'confusion']) { const f = fixture(t); f.seed(f.leader, 'lapras', 2, { status }); f.judgments('rain'); start(f); f.drain(); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(f.room().resolution, null); assert.equal(f.room().turn.drawRemaining, 2); }
});

test('Water Absorb triggers after real Helmet item damage and may draw its one storm card', t => {
  const f = fixture(t); f.play('lapras'); f.helmet(f.target); const cards = f.top('thunderstorm', 'clear'); f.attack(); f.respond(); assert.equal(f.player(f.leader).active.damage, 1); assert.deepEqual(f.player(f.leader).hand, [cards[1]]); assert.equal(f.room().resolution, null); assert.equal(f.player(f.target).active.damage, 1);
});

test('Water Absorb safely skips an empty judgment without healing, drawing or rolling back the damage', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'lapras'); f.room().drawPile = []; f.room().discardPile = []; const command = f.supply(f.leader); f.attack({ cardId: command }); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).hand.length, 0); assert.equal(f.room().resolution, null); assert.deepEqual(ids(f.room().discardPile), [command]);
});

test('Ice Shard and Ice Beam remove every Speed only after positive damage and keep other markers', t => {
  for (const level of [1, 2]) { const f = fixture(t); f.play('lapras', level); f.player(f.target).active.reinforcements = ['speed', 'power', 'speed']; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, level); assert.deepEqual(f.player(f.target).active.reinforcements, ['power']); assert.equal(f.room().pendingBattle, null); }
});

test('Ice Beam leaves target Speed after Dodge or zero damage and never edits an incoming reserve', t => {
  for (const prevention of ['dodge', 'immunity', 'faint']) { const f = fixture(t); f.play('lapras', 2); f.player(f.target).active.reinforcements = ['speed']; f.player(f.target).reserve.reinforcements = ['speed', 'power']; if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; if (prevention === 'faint') Object.assign(f.player(f.target).active, { hpBonus: 0, damage: 2 }); f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); f.drain(); assert.deepEqual(f.player(f.target).active.reinforcements, prevention === 'faint' ? ['speed', 'power'] : ['speed']); }
});

test('Freeze-Dry suppresses all target marker kinds before defense without suppressing traits or held items', t => {
  const f = fixture(t); f.play('lapras', 3); f.player(f.target).active.reinforcements = ['power', 'defense', 'speed']; f.helmet(f.target); f.attack(); for (const kind of ['power', 'defense', 'speed']) assert.equal(battleReinforcementEffective(f.room(), f.player(f.target).active, kind), false); const view = activeView(f, f.target); assert.equal(view.reinforcementsSuppressed, true); assert.equal(view.traitsSuppressed, false); assert.equal(view.itemSuppressed, false); assert.deepEqual(f.player(f.target).active.reinforcements, ['power', 'defense', 'speed']); f.respond(); f.drain(); assert.equal(f.player(f.target).active.damage, 2); assert.deepEqual(f.player(f.target).active.reinforcements, []); assert.equal(f.player(f.leader).active.damage, 1);
});

test('Freeze-Dry positive damage removes all physical target markers before receiving effects', t => {
  const f = fixture(t); f.play('lapras', 3); f.seed(f.target, 'nidoran-m', 2, { reinforcements: ['power', 'power', 'defense', 'speed'] }); f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.deepEqual(f.player(f.target).active.reinforcements, []); assert.equal(f.room().pendingBattle.kind, 'poison-point'); assert.equal(activeView(f, f.target).reinforcementsSuppressed, true); f.respond(); assert.equal(activeView(f, f.target).reinforcementsSuppressed, false);
});

test('Freeze-Dry self-target consumes carried Power before suppression and bypasses its own Defense afterward', t => {
  const f = fixture(t); f.play('lapras', 3); f.player(f.leader).active.reinforcements = ['power', 'power', 'defense', 'speed']; f.judgments('clear'); f.attack({ targetIds: [f.leader.playerId] }); assert.deepEqual(f.player(f.leader).active.reinforcements, ['defense', 'speed']); assert.equal(activeView(f, f.leader).reinforcementsSuppressed, true); f.respond(); assert.equal(f.player(f.leader).active.damage, 4); assert.deepEqual(f.player(f.leader).active.reinforcements, []); assert.equal(f.room().resolution, null);
});

test('Freeze-Dry Dodge, immunity and later Shed Skin zero preserve physical markers and restore effectiveness at card end', t => {
  for (const prevention of ['dodge', 'immunity', 'shed']) { const f = fixture(t); f.play('lapras', 3); if (prevention === 'shed') { f.seed(f.target, 'caterpie', 2); f.supply(f.target, 'event'); f.supply(f.target, 'event'); } f.player(f.target).active.reinforcements = ['power', 'defense', 'speed']; if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); if (prevention === 'shed') f.respond('shed', { cardIds: ids(f.player(f.target).hand) }); assert.equal(f.player(f.target).active.damage, 0); assert.deepEqual(f.player(f.target).active.reinforcements, ['power', 'defense', 'speed']); assert.equal(activeView(f, f.target).reinforcementsSuppressed, false); for (const kind of ['power', 'defense', 'speed']) assert.equal(battleReinforcementEffective(f.room(), f.player(f.target).active, kind), true); }
});

test('Freeze-Dry suppression remains active through nested Helmet and Water Absorb judgments on the resolution stack', t => {
  const f = fixture(t); f.play('lapras', 3); f.player(f.target).active.reinforcements = ['speed', 'defense']; f.helmet(f.target); f.seed(f.third, 'vulpix'); f.supply(f.third, 'event', 'clear'); f.judgments('rain'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'judgment'); assert.equal(f.room().resolution.kind, 'item'); assert.equal(f.room().resolutionStack.length, 1); assert.equal(activeView(f, f.target).reinforcementsSuppressed, true); assert.equal(f.player(f.leader).active.damage, 1); f.respond(); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(activeView(f, f.target).reinforcementsSuppressed, false); assert.equal(f.room().resolution, null);
});

test('Freeze-Dry suppression survives restart and a defense retry removes markers only once', t => {
  const f = fixture(t); f.play('lapras', 3); f.player(f.target).active.reinforcements = ['power', 'defense', 'speed']; const command = f.supply(f.leader); f.attack({ cardId: command }); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.target.token).view; assert.equal(view.players.find(player => player.id === f.target.playerId).active.reinforcementsSuppressed, true); const request = { id: 'restored-freeze-dry', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'pass' }; restored.action(f.owner.code, f.target.token, request); const once = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.target.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), once); assert.equal(once.players.find(player => player.id === f.target.playerId).active.damage, 2); assert.deepEqual(once.players.find(player => player.id === f.target.playerId).active.reinforcements, []); assert.equal(countCard(once, command), 1);
});

test('Download is available on every level only before any ordinary Draw has started', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t); drawSetup(f, level); const battle = f.view(f.leader).self.battle; assert.equal(battle.canTrait, true); assert.equal(battle.trait.kind, 'download'); f.act(f.leader, 'draw'); assert.equal(f.view(f.leader).self.battle.canTrait, false); assert.equal(f.room().turn.drawRemaining, 1); rejectsAtomically(f, () => download(f)); }
});

test('Download chooses up to two other live nonempty hands regardless of range', t => {
  const f = fixture(t, { count: 6 }); drawSetup(f); for (const who of f.seats.filter(who => who !== f.leader)) f.supply(who); const excluded = f.byId(f.room().players[3].id); f.player(excluded).eliminated = true; const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); download(f); assert.equal(f.room().pendingBattle.kind, 'download'); assert.equal(f.room().pendingBattle.maxTargets, 2); assert.deepEqual(new Set(f.room().pendingBattle.legalTargetIds), new Set(f.seats.filter(who => ![f.leader, excluded].includes(who)).map(who => who.playerId))); assert.equal(f.room().pendingBattle.legalTargetIds.includes(observer.playerId), false); choose(f, []); assert.equal(f.room().turn.phase, 'play');
});

test('Download zero selected targets consumes the complete Draw without taking a card or ordinary drawing', t => {
  const f = fixture(t); drawSetup(f); f.supply(f.target); const deck = structuredClone(f.room().drawPile); download(f); choose(f); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(f.player(f.target).hand.length, 1); assert.deepEqual(f.room().drawPile, deck); assert.equal(f.room().turn.drawRemaining, 0); assert.equal(f.room().turn.phase, 'play'); assert.equal(f.view(f.leader).self.battle.canTrait, false); assert.equal(f.room().drawChoice ?? null, null);
});

test('Download with no available hands still offers an explicit zero-target whole-Draw replacement', t => {
  const f = fixture(t); drawSetup(f); download(f); assert.equal(f.room().pendingBattle.maxTargets, 0); assert.deepEqual(f.room().pendingBattle.legalTargetIds, []); choose(f); assert.equal(f.room().turn.phase, 'play'); assert.equal(f.room().turn.drawRemaining, 0); assert.equal(f.player(f.leader).hand.length, 0);
});

test('Download one target transfers one actual selected physical card and consumes the whole Draw', t => {
  const f = fixture(t); drawSetup(f); f.supply(f.target, 'dodge', 'rain'); const actual = structuredClone(f.player(f.target).hand[0]); download(f); choose(f, [f.target]); assert.equal(f.room().pendingBattle.kind, 'download-hand'); assert.equal(f.room().pendingBattle.targetId, f.target.playerId); steal(f); assert.deepEqual(f.player(f.leader).hand, [actual]); assert.equal(f.player(f.target).hand.length, 0); assert.equal(f.room().turn.drawRemaining, 0); assert.equal(f.room().turn.phase, 'play'); assert.equal(countCard(f.room(), actual.id), 1);
});

test('Download reserves two stolen cards privately until one final gain batch in the chosen trainer order', t => {
  const f = fixture(t); drawSetup(f); f.seed(f.target, 'meowth'); f.supply(f.target, 'event', 'rain'); f.supply(f.third, 'dodge', 'clear'); const first = structuredClone(f.player(f.third).hand[0]), second = structuredClone(f.player(f.target).hand[0]); download(f); choose(f, [f.third, f.target]); assert.equal(f.room().pendingBattle.targetId, f.third.playerId); steal(f); assert.equal(f.player(f.leader).hand.length, 0); assert.deepEqual(f.room().drawChoice.cards, [first]); assert.equal(countCard(f.room(), first.id), 1); assert.equal(f.room().pendingBattle.targetId, f.target.playerId); steal(f); assert.deepEqual(f.player(f.leader).hand, [first, second]); assert.deepEqual(f.room().turn.pickupUsedIds, []); assert.equal(f.room().drawChoice ?? null, null); for (const card of [first, second]) assert.equal(countCard(f.room(), card.id), 1);
});

test('Download takes two actual hand cards even with an empty real draw and discard pile', t => {
  const f = fixture(t); drawSetup(f); const first = f.supply(f.target), second = f.supply(f.third); f.room().drawPile = []; f.room().discardPile = []; download(f); choose(f, [f.target, f.third]); steal(f); steal(f); assert.deepEqual(ids(f.player(f.leader).hand), [first, second]); assert.equal(allCards(f.room()).length, 2); assert.equal(f.room().turn.phase, 'play');
});

test('Download replacement can still take two cards when Flinch reduces the ordinary Draw to one', t => {
  const f = fixture(t); drawSetup(f, 1, { status: 'flinch' }); assert.equal(f.room().turn.drawRemaining, 1); f.supply(f.target); f.supply(f.third); download(f); choose(f, [f.target, f.third]); steal(f); steal(f); assert.equal(f.player(f.leader).hand.length, 2); assert.equal(f.room().turn.drawRemaining, 0); assert.equal(f.room().turn.phase, 'play');
});

test('Download public choices are actor-only randomized hand backs without foreign faces or private IDs', t => {
  const f = fixture(t); drawSetup(f); f.supply(f.target, 'dodge', 'rain'); f.supply(f.target, 'event', 'clear'); const originals = structuredClone(f.player(f.target).hand), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); download(f); choose(f, [f.target]); assert.equal(f.room().pendingBattle.choiceCount, 2); assert.deepEqual(f.view(f.leader).pendingBattle.choices, [{ index: 0 }, { index: 1 }]); for (const who of [...f.seats, observer]) { const view = f.view(who); assert.equal(view.drawChoice, undefined); if (who !== f.leader) assert.equal(view.pendingBattle.choices, undefined); for (const card of originals) { assert.equal(JSON.stringify(view.pendingBattle).includes(card.id), false); assert.equal(JSON.stringify(view.pendingBattle).includes(card.privateMarker), false); } }
});

test('Download reserved cards do not leak during the second target choice or after final private gain', t => {
  const f = fixture(t); drawSetup(f); f.supply(f.target, 'dodge', 'rain'); f.supply(f.third, 'event', 'clear'); const first = structuredClone(f.player(f.target).hand[0]), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); download(f); choose(f, [f.target, f.third]); steal(f); for (const who of [f.target, f.third, observer]) { const view = f.view(who); assert.equal(JSON.stringify(view).includes(first.id), false); assert.equal(JSON.stringify(view).includes(first.privateMarker), false); } steal(f); for (const who of [f.target, f.third, observer]) assert.equal(JSON.stringify(f.view(who)).includes(first.id), false);
});

test('Download target selection rejects actor violations, duplicates, self, unknown targets and extraneous data atomically', t => {
  const f = fixture(t, { count: 4 }); drawSetup(f); f.supply(f.target); f.supply(f.third); const fourth = f.seats.find(who => ![f.leader, f.target, f.third].includes(who)); f.supply(fourth); download(f); const pending = f.room().pendingBattle; rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'targets', targetIds: [f.target.playerId] }), 'NOT_YOUR_DECISION');
  for (const payload of [{ choice: 'pass' }, { choice: 'targets' }, { choice: 'targets', targetIds: [f.leader.playerId] }, { choice: 'targets', targetIds: [f.target.playerId, f.target.playerId] }, { choice: 'targets', targetIds: [f.target.playerId, f.third.playerId, fourth.playerId] }, { choice: 'targets', targetIds: ['forged'] }, { choice: 'targets', targetIds: [], cardIds: [] }, { choice: 'targets', targetIds: [], handIndex: 0 }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...payload }));
});

test('Download hand selection rejects wrong actor, stale decision, invalid indexes and extra fields', t => {
  const f = fixture(t); drawSetup(f); const cardId = f.supply(f.target); download(f); choose(f, [f.target]); const pending = f.room().pendingBattle; rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'card', handIndex: 0 }), 'NOT_YOUR_DECISION'); rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: 'stale', choice: 'card', handIndex: 0 }), 'STALE_DECISION');
  for (const payload of [{ choice: 'pass' }, { choice: 'card' }, { choice: 'card', handIndex: -1 }, { choice: 'card', handIndex: 1 }, { choice: 'card', handIndex: '0' }, { choice: 'card', handIndex: 0, cardId }, { choice: 'card', handIndex: 0, targetIds: [] }, { choice: 'card', handIndex: 0, order: [] }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...payload }));
});

test('Download activation accepts no selectors and requires the current live active before ordinary draws', t => {
  const f = fixture(t); drawSetup(f); for (const payload of [{ cardIds: [] }, { targetIds: [] }, { hpLoss: 0 }, { order: [] }]) rejectsAtomically(f, () => f.act(f.leader, 'useTrait', payload)); f.seed(f.target, 'porygon'); rejectsAtomically(f, () => f.act(f.target, 'useTrait'), 'NOT_YOUR_TURN'); drawToPlay(f); rejectsAtomically(f, () => download(f));
  for (const exclusion of ['reserve', 'defeated', 'eliminated']) { const g = fixture(t); drawSetup(g); if (exclusion === 'reserve') { g.player(g.leader).active.catalogueId = 'squirtle'; g.player(g.leader).reserve.catalogueId = 'porygon'; } else if (exclusion === 'defeated') g.player(g.leader).active.defeated = true; else g.player(g.leader).eliminated = true; assert.equal(g.view(g.leader).self.battle?.canTrait ?? false, false); rejectsAtomically(g, () => download(g)); }
});

test('Download both mandatory phases wait on expiry and pause the main turn without stealing automatically', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); drawSetup(f); f.supply(f.target); download(f); const id = f.room().pendingBattle.id; f.advance(5_000); let view = f.view(f.leader); assert.equal(view.pendingBattle.id, id); assert.equal(view.pendingBattle.clock.pausedReason, 'mandatory'); choose(f, [f.target]); const handId = f.room().pendingBattle.id; f.advance(5_000); view = f.view(f.leader); assert.equal(view.pendingBattle.id, handId); assert.equal(view.pendingBattle.clock.pausedReason, 'mandatory'); assert.equal(f.player(f.target).hand.length, 1); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(view.turn.clock.remainingMs, 60_000);
});

test('Download activation and targets exact retries never duplicate selection or resample hand slots', t => {
  const f = fixture(t); drawSetup(f); f.supply(f.target); f.supply(f.target); const activate = f.input('useTrait'); f.store.action(f.owner.code, f.leader.token, activate); const opened = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, activate); assert.deepEqual(f.room(), opened); const targets = f.input('respondBattle', { decisionId: f.room().pendingBattle.id, choice: 'targets', targetIds: [f.target.playerId] }); f.store.action(f.owner.code, f.leader.token, targets); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, targets); assert.deepEqual(f.room(), once);
});

test('Download restart between steals preserves the reserved first card and exact final retries gain once', t => {
  const f = fixture(t); drawSetup(f); f.supply(f.target, 'event', 'rain'); f.supply(f.third, 'dodge', 'clear'); const cards = [structuredClone(f.player(f.target).hand[0]), structuredClone(f.player(f.third).hand[0])]; download(f); choose(f, [f.target, f.third]); steal(f); const saved = structuredClone(f.room().drawChoice), restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.leader.token).view; assert.deepEqual(restored.rooms.get(f.owner.code).drawChoice, saved); const request = { id: 'restored-download-second', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'card', handIndex: 0 }; restored.action(f.owner.code, f.leader.token, request); const once = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.leader.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), once); assert.deepEqual(once.players.find(player => player.id === f.leader.playerId).hand, cards); assert.equal(once.drawChoice ?? null, null); assert.equal(once.turn.phase, 'play'); for (const card of cards) assert.equal(countCard(once, card.id), 1);
});

test('closing votes preserve Download reserved cards and block the unfinished private transfer', t => {
  const f = fixture(t); drawSetup(f); f.supply(f.target); f.supply(f.third); download(f); choose(f, [f.target, f.third]); steal(f); const choice = structuredClone(f.room().drawChoice); f.act(f.owner, 'requestEndGame'); rejectsAtomically(f, () => steal(f), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); assert.deepEqual(f.room().drawChoice, choice); steal(f); assert.equal(f.player(f.leader).hand.length, 2);
});

test('Download legacy draw checkpoints cannot create an extra replacement, while a fresh turn resets its use', t => {
  for (const remaining of [1, 2]) { const f = fixture(t); drawSetup(f); if (remaining === 1) f.act(f.leader, 'draw'); delete f.room().turn.drawStarted; assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => download(f)); start(f); assert.equal(f.view(f.leader).self.battle.canTrait, true); download(f); choose(f); assert.equal(f.room().turn.drawRemaining, 0); }
});

test('Thunder Shock deals one and paralyzes only on its final thunderstorm judgment', t => {
  for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) { const f = fixture(t); f.play('porygon'); const judged = f.judgments(weather)[0]; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.player(f.target).active.status, weather === 'thunderstorm' ? 'paralysis' : null); assert.equal(countCard(f.room(), judged.id), 1); }
});

test('Tri Attack uses one final judgment: intense sun burns, storm paralyzes and other weather does nothing', t => {
  for (const level of [2, 3]) for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) { const f = fixture(t); f.play('porygon', level); const judged = f.judgments(weather)[0], next = f.room().drawPile.at(-2).id; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, weather === 'intense-sun' ? 'burn' : weather === 'thunderstorm' ? 'paralysis' : null); assert.equal(f.room().drawPile.at(-1).id, next); assert.equal(countCard(f.room(), judged.id), 1); }
});

test('Tri Attack Drought final weather and status immunities use the shared pipeline', t => {
  const f = fixture(t); f.play('porygon', 2); f.seed(f.third, 'vulpix'); const clear = f.supply(f.third, 'event', 'clear'); f.judgments('intense-sun'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'judgment'); f.respond('replace', { cardId: clear }); assert.equal(f.player(f.target).active.status, null);
  for (const family of ['meowth', 'caterpie']) { const g = fixture(t); g.play('porygon', 2); g.seed(g.target, family, family === 'meowth' ? 3 : 1); g.judgments('thunderstorm'); g.attack(); g.respond(); assert.equal(g.player(g.target).active.status, null); assert.equal(g.player(g.target).active.damage, 2); }
});

test('Tri Attack positive status may be replaced by Poison Touch and never overwrites an existing status', t => {
  const f = fixture(t); f.play('porygon', 2); f.seed(f.third, 'grimer'); f.judgments('intense-sun'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'poison-touch'); assert.equal(f.room().pendingBattle.status, 'burn'); f.respond('trait'); assert.equal(f.player(f.target).active.status, 'poison');
  const g = fixture(t); g.play('porygon', 2); g.player(g.target).active.status = 'sleep'; g.judgments('intense-sun'); g.attack(); g.respond(); assert.equal(g.player(g.target).active.status, 'sleep');
});

test('Porygon judgments require positive damage, skip empty piles and never status an incoming reserve', t => {
  for (const prevention of ['dodge', 'immunity', 'faint', 'empty']) { const f = fixture(t); f.play('porygon', 2); if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; if (prevention === 'faint') f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); f.judgments('intense-sun'); const originalTop = f.room().drawPile.at(-1).id; if (prevention === 'empty') { f.room().drawPile = []; f.room().discardPile = []; } f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); f.drain(); assert.equal(f.player(f.target).active.status, null); if (['dodge', 'immunity'].includes(prevention)) assert.equal(f.room().drawPile.at(-1).id, originalTop); if (prevention === 'empty') assert.equal(f.player(f.target).active.damage, 2); }
});

test('Lock-On uses either sunny hand card, marks the uncanceled original active and causes no damage effects', t => {
  for (const weather of ['intense-sun', 'clear']) { const f = fixture(t); f.play('porygon', 3); f.seed(f.target, 'nidoran-m', 2, { reinforcements: ['defense'] }); f.helmet(f.target); f.player(f.leader).active.reinforcements = ['power', 'power']; lock(f, f.target, weather); f.respond(); assert.deepEqual(f.room().turn.dodgeBlockedCreatureIds, [f.player(f.target).active.instanceId]); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.player(f.leader).active.status, null); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.deepEqual(f.player(f.leader).active.reinforcements, ['power', 'power']); assert.equal(f.room().turn.commandCreatureId, null); }
});

test('Lock-On retains ordinary target range and rejects rainy cost before discarding cards', t => {
  const f = fixture(t, { count: 6 }); f.play('porygon', 3); const move = f.view(f.leader).self.battle.moves.find(move => move.effectKind === 'lock-on'), rain = f.supply(f.leader, 'event', 'rain'), sun = f.supply(f.leader, 'event', 'clear'), far = f.seats.find(who => !move.legalTargetIds.includes(who.playerId)); assert.ok(far); rejectsAtomically(f, () => f.attack({ moveIndex: move.index, cardId: rain })); rejectsAtomically(f, () => f.attack({ moveIndex: move.index, cardId: sun, targetIds: [far.playerId] }));
});

test('Dodge cancels Lock-On without saving any blocked instance', t => {
  const f = fixture(t); f.play('porygon', 3); lock(f); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); assert.deepEqual(f.room().turn.dodgeBlockedCreatureIds, []); assert.equal(f.room().pendingBattle, null);
});

test('Lock-On is independent of damage immunity because its non-damage effect needs only an uncanceled settlement', t => {
  const f = fixture(t); f.play('porygon', 3); f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; lock(f); f.respond(); assert.deepEqual(f.room().turn.dodgeBlockedCreatureIds, [f.player(f.target).active.instanceId]); assert.equal(f.player(f.target).active.damage, 0);
});

test('locked targets reject physical Dodge, Sand Veil and Levitate without consuming cards or judging', t => {
  for (const family of ['squirtle', 'sandshrew', 'gastly']) { const f = fixture(t); f.play('porygon', 3); f.seed(f.target, family); lock(f); f.respond(); const own = f.supply(f.target, 'dodge'), rain = f.supply(f.target, 'event', 'rain'), top = f.room().drawPile.at(-1).id; f.attack(); const pending = f.view(f.target).pendingBattle; assert.equal(pending.cannotDodge, true); assert.equal(pending.dodgeBlockedBy, 'lock-on'); assert.equal(pending.canTrait, false); rejectsAtomically(f, () => f.respond('dodge', { cardId: own })); if (family === 'gastly') rejectsAtomically(f, () => f.respond('dodge', { cardId: rain })); if (family === 'sandshrew') rejectsAtomically(f, () => f.respond('trait')); assert.equal(f.player(f.target).hand.some(card => card.id === own), true); assert.equal(f.room().drawPile.at(-1).id, top); f.respond(); }
});

test('Lock-On follows the marked instance out and back without applying to its reserve partner', t => {
  for (const restoreOriginal of [false, true]) { const f = fixture(t); f.play('porygon', 3); const original = f.player(f.leader).active.instanceId, incoming = f.player(f.leader).reserve.instanceId; lock(f, f.leader); f.respond(); f.act(f.leader, 'switchPokemon'); assert.equal(f.player(f.leader).active.instanceId, incoming); if (restoreOriginal) { f.room().turn.switchUsed = false; f.act(f.leader, 'switchPokemon'); } f.attack({ targetIds: [f.leader.playerId] }); assert.equal(f.view(f.leader).pendingBattle.cannotDodge, restoreOriginal); assert.deepEqual(f.room().turn.dodgeBlockedCreatureIds, [original]); f.drain(); }
});

test('Lock-On persists after its source switches and expires at the next global trainer turn', t => {
  const f = fixture(t); f.play('porygon', 3); lock(f); f.respond(); f.act(f.leader, 'switchPokemon'); f.attack(); assert.equal(f.view(f.target).pendingBattle.cannotDodge, true); f.respond(); start(f, f.target); assert.deepEqual(f.room().turn.dodgeBlockedCreatureIds, []);
});

test('Lock-On command defense and marked identity persist through restart without duplicate marks on exact retry', t => {
  const f = fixture(t); f.play('porygon', 3); lock(f); const request = f.input('respondBattle', { decisionId: f.room().pendingBattle.id, choice: 'pass' }); f.store.action(f.owner.code, f.target.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.target.token, request); assert.deepEqual(f.room(), once); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); assert.deepEqual(restored.rooms.get(f.owner.code).turn.dodgeBlockedCreatureIds, [f.player(f.target).active.instanceId]); const view = restored.view(f.owner.code, f.leader.token).view, card = { ...f.makeCard('command', 'intense-sun') }; restored.rooms.get(f.owner.code).players.find(player => player.id === f.leader.playerId).hand.push(card); restored.action(f.owner.code, f.leader.token, { id: 'restored-locked-command', revision: view.revision, type: 'attack', cardId: card.id, targetIds: [f.target.playerId] }); assert.equal(restored.view(f.owner.code, f.target.token).view.pendingBattle.cannotDodge, true);
});

test('both new command families retain real own payment, range and per-move/per-instance use limits', t => {
  for (const family of ['lapras', 'porygon']) { const f = fixture(t, { count: 6 }); f.play(family, 3); const own = f.supply(f.leader), wrong = f.supply(f.leader, 'event'), foreign = f.supply(f.target), far = f.seats.find(who => !f.view(f.leader).self.battle.legalTargetIds.includes(who.playerId)); for (const cardId of [wrong, foreign, 'forged']) rejectsAtomically(f, () => f.attack({ cardId })); rejectsAtomically(f, () => f.attack({ cardId: own, targetIds: [far.playerId] })); f.attack({ cardId: own }); f.drain(); const next = f.supply(f.leader); rejectsAtomically(f, () => f.attack({ cardId: next })); f.act(f.leader, 'switchPokemon'); assert.equal(f.view(f.leader).self.battle.canCommand, false); }
});

test('Gas suppresses Water Absorb while Freeze-Dry still suppresses markers as a move effect', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'lapras'); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); start(f); f.respond('suppress', { cardId: cost, targetId: f.target.playerId }); drawToPlay(f); const top = f.room().drawPile.at(-1).id; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().drawPile.at(-1).id, top); assert.equal(f.player(f.target).hand.length, 0);
  const g = fixture(t); g.play('lapras', 3); g.seed(g.third, 'koffing'); const payment = g.supply(g.third); start(g); g.respond('suppress', { cardId: payment, targetId: g.leader.playerId }); drawToPlay(g); g.player(g.target).active.reinforcements = ['defense', 'speed']; g.attack(); assert.equal(activeView(g, g.target).reinforcementsSuppressed, true); g.respond(); assert.equal(g.player(g.target).active.damage, 2); assert.deepEqual(g.player(g.target).active.reinforcements, []);
});

test('Gas suppresses Download but preserves Porygon Tri Attack and Lock-On as native moves', t => {
  const f = fixture(t); f.seed(f.leader, 'porygon', 3); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); start(f); f.respond('suppress', { cardId: cost, targetId: f.leader.playerId }); assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => download(f)); drawToPlay(f); lock(f); f.respond(); f.judgments('intense-sun'); f.attack(); assert.equal(f.view(f.target).pendingBattle.cannotDodge, true); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, 'burn');
});
