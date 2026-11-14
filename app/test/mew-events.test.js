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
  const dir = mkdtempSync(join(root, 'mew-events-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ allowTestDecks: true, dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `mew-events-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates, activeId = candidates.find(id => !['koffing', 'jynx', 'tauros'].includes(id)); act(who, 'selectPokemon', { activeId, reserveId: candidates.find(id => id !== activeId) }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-mew-events-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private Mew event card ${serial}` } });
  room().drawPile = Array.from({ length: 48 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const top = (...weather) => { const cards = weather.map(value => makeCard('reveal-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const judgments = (...weather) => { const cards = weather.map(value => makeCard('judgment-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id), third = seats.find(who => who !== leader && who !== target);
  const play = (family = 'squirtle', level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, family, level); };
  const attack = (payload = {}, who = leader) => act(who, 'attack', { cardId: payload.cardId ?? supply(who), targetIds: [target.playerId], ...payload });
  const respond = (choice = 'pass', payload = {}) => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload }); };
  const order = effect => respond('damage-effect', { effect });
  const helmet = who => { const card = { ...makeCard('held-item'), itemType: 'rocky-helmet' }; player(who).active.item = card; return card; };
  const drain = () => { for (let i = 0; room().pendingBattle && i < 100; i++) { const pending = room().pendingBattle; if (pending.kind === 'mew-blessing') respond(pending.choices[0]); else if (pending.kind === 'sweet-kiss') respond('discard', { cardIds: player(byId(pending.actorId)).hand.slice(0, 2).map(card => card.id) }); else if (pending.kind === 'damage-order') order(pending.effects[0]); else respond(pending.kind === 'effects' ? 'effect' : 'pass', pending.kind === 'effects' ? { effect: pending.effects[0] } : {}); } assert.equal(room().pendingBattle, null); };
  const startStatus = (status = 'poison', who = target) => { player(who).active.status = status; store.startTurn(room(), who.playerId, 2); };
  return { store, dir, now, owner, seats, leader, target, third, room, player, byId, view, input, act, seed, makeCard, supply, top, judgments, play, attack, respond, order, helmet, drain, startStatus, advance: ms => { time += ms; } };
}
function rejectsAtomically(f, action, code) { const before = structuredClone(f.room()); assert.throws(action, error => code === undefined || error.code === code); assert.deepEqual(f.room(), before); }
const ids = cards => cards.map(card => card.id);
const publicFace = ({ name, weather, kind }) => ({ name, weather, kind });
const publicHand = ({ id, name, weather, kind }) => ({ id, name, weather, kind });
const allCards = room => [...room.drawPile, ...room.discardPile, ...room.players.flatMap(p => [...(p.hand || []), ...[p.active?.item, p.reserve?.item].filter(Boolean)]), ...[room.resolution, ...(room.resolutionStack || [])].flatMap(r => r ? [...(r.card && !r.cardClaimedBy ? [r.card] : []), ...(r.revealedCards || [])] : []), ...(room.judgment?.card ? [room.judgment.card] : []), ...(room.drawChoice?.cards || [])];
const countCard = (room, id) => allCards(room).filter(card => card.id === id).length;

const event = (f, eventType = 'mewtwo-threat', who = f.leader) => { const card = { ...f.makeCard('event', 'clear'), eventType }; f.player(who).hand.push(card); return card.id; };
const use = (f, cardId, who = f.leader) => f.act(who, 'useEvent', { cardId });
const describe = (f, type) => f.view(f.leader).self.battle.events.find(event => event.eventType === type);
const start = (f, who = f.leader) => f.store.startTurn(f.room(), who.playerId, f.room().turn.number + 1);
const drawToPlay = f => { while (f.room().turn.drawRemaining) f.act(f.leader, 'draw'); };

test('event menus group real held event types and use canonical names rather than arbitrary private card names', t => {
  const f = fixture(t); f.play(); assert.deepEqual(f.view(f.leader).self.battle.events, []); const first = event(f), duplicate = event(f), blessing = event(f, 'mew-blessing'); assert.equal(f.view(f.leader).self.battle.events.length, 2); const threat = describe(f, 'mewtwo-threat'), gift = describe(f, 'mew-blessing'); assert.match(threat.name.en, /Mewtwo/); assert.match(gift.name.en, /Mew/); assert.notDeepEqual(threat.name, f.player(f.leader).hand.find(card => card.id === first).name); assert.equal(threat.canUse, true); assert.equal(gift.canUse, true); assert.ok(threat.description.en); assert.ok(gift.description.zh); for (const id of [first, duplicate, blessing]) assert.equal(countCard(f.room(), id), 1);
});

test('Mewtwo targets every other living active next-trainer first without distance, spectators or eliminated seats', t => {
  const f = fixture(t, { count: 6 }); f.play(); const skipped = f.byId(f.room().players[3].id); f.player(skipped).eliminated = true; const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }), cardId = event(f), expected = f.room().players.filter(player => !player.spectator && !player.eliminated && player.id !== f.leader.playerId).map(player => player.id); assert.deepEqual(describe(f, 'mewtwo-threat').targetIds, expected); use(f, cardId); const actors = []; while (f.room().pendingBattle) { assert.equal(f.room().pendingBattle.kind, 'event-dodge'); actors.push(f.room().pendingBattle.actorId); f.respond(); } assert.deepEqual(actors, expected); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(actors.includes(observer.playerId), false); for (const id of expected) assert.equal(f.player(f.byId(id)).active.damage, 2);
});

test('Mewtwo keeps its actual card outside all piles until the whole wave completes and discards it once', t => {
  const f = fixture(t); f.play(); const cardId = event(f), actual = structuredClone(f.player(f.leader).hand[0]), before = allCards(f.room()).length; use(f, cardId); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(f.room().discardPile.some(card => card.id === cardId), false); assert.equal(f.room().drawPile.some(card => card.id === cardId), false); assert.equal(countCard(f.room(), cardId), 1); f.respond(); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); assert.equal(f.room().discardPile.some(card => card.id === cardId), false); f.respond(); assert.deepEqual(f.room().discardPile.find(card => card.id === cardId), actual); assert.equal(countCard(f.room(), cardId), 1); assert.equal(allCards(f.room()).length, before);
});

test('Mewtwo identifies an external Pokémon source and deals fixed two independently of the event user offense', t => {
  for (const [family, level, extra] of [['charmander', 1, { hpBonus: 0, damage: 2, status: 'burn' }], ['machop', 2, { status: 'burn' }], ['magikarp', 2, {}]]) { const f = fixture(t); f.play(family, level); Object.assign(f.player(f.leader).active, extra, { reinforcements: ['power', 'power'] }); const cardId = event(f), beforeHand = f.player(f.leader).hand.length; use(f, cardId); assert.equal(f.room().resolution.sourceId, null); assert.equal(f.room().resolution.sourcePlayerId, null); assert.deepEqual(f.room().resolution.externalSource, { kind: 'external-pokemon', name: { zh: '超梦', en: 'Mewtwo' } }); assert.deepEqual(f.view(f.target).pendingBattle.source, f.room().resolution.externalSource); f.drain(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.third).active.damage, 2); assert.equal(f.player(f.leader).hand.length, beforeHand - 1); assert.deepEqual(f.player(f.leader).active.reinforcements, ['power', 'power']); }
});

test('only an actual Dodge cancels its one Mewtwo target while later targets continue', t => {
  const f = fixture(t); f.play(); const cardId = event(f), dodge = f.supply(f.target, 'dodge', 'intense-sun'); use(f, cardId); f.respond('dodge', { cardId: dodge }); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); f.respond(); assert.equal(f.player(f.third).active.damage, 2); for (const id of [cardId, dodge]) assert.equal(countCard(f.room(), id), 1);
});

test('Mewtwo disallows Sand Veil and Levitate substitutions without consuming cards or judging', t => {
  for (const family of ['sandshrew', 'gastly']) { const f = fixture(t); f.play(); f.seed(f.target, family); const rain = f.supply(f.target, 'event', 'rain'), top = f.room().drawPile.at(-1).id, cardId = event(f); use(f, cardId); rejectsAtomically(f, () => f.respond('trait')); rejectsAtomically(f, () => f.respond('dodge', { cardId: rain })); assert.equal(f.room().drawPile.at(-1).id, top); f.respond(); assert.equal(f.player(f.target).active.damage, 2); f.drain(); }
});

test('event Dodge enforces actor, fresh decision, own actual card and strict response selectors', t => {
  const f = fixture(t); f.play(); const cardId = event(f), dodge = f.supply(f.target, 'dodge'), foreign = f.supply(f.third, 'dodge'); use(f, cardId); const pending = f.room().pendingBattle; rejectsAtomically(f, () => f.act(f.third, 'respondBattle', { decisionId: pending.id, choice: 'pass' }), 'NOT_YOUR_DECISION'); rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: 'stale', choice: 'pass' }), 'STALE_DECISION'); for (const payload of [{ choice: 'dodge' }, { choice: 'dodge', cardId: foreign }, { choice: 'pass', cardId: dodge }, { choice: 'pass', cardIds: [] }, { choice: 'dodge', cardId: dodge, targetId: f.third.playerId }, { choice: 'pass', effect: 'damage' }]) rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, ...payload }));
});

test('target Defense and Multiscale reduce external Mewtwo damage while marker cleanup waits for the complete event', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.reinforcements = ['defense']; f.seed(f.third, 'dratini', 3); use(f, event(f)); f.respond(); assert.equal(f.player(f.target).active.damage, 1); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); f.respond(); assert.equal(f.player(f.third).active.damage, 1); assert.deepEqual(f.player(f.target).active.reinforcements, []);
});

test('Mewtwo still uses ordinary receiving Shed Skin and damage immunity without creating source retaliation', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'caterpie', 2); const costs = [f.supply(f.target), f.supply(f.target)], cardId = event(f); f.room().turn.damageImmunityIds = [f.player(f.third).active.instanceId]; use(f, cardId); f.respond(); assert.equal(f.room().pendingBattle.kind, 'shed-skin'); f.respond('shed', { cardIds: costs }); assert.equal(f.player(f.target).active.damage, 0); f.respond(); assert.equal(f.player(f.third).active.damage, 0); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.room().resolution, null);
});

test('external Mewtwo damage triggers mandatory Water Absorb after receiving damage and continues the wave', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'lapras'); f.judgments('rain'); use(f, event(f)); f.respond(); assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.room().pendingBattle.kind, 'event-dodge'); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); f.respond(); assert.equal(f.player(f.third).active.damage, 2);
});

test('Battle Armor receives the external hit and its new Defense persists until the entire event ends', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'cubone'); const armor = f.supply(f.target), cardId = event(f); use(f, cardId); f.respond(); assert.equal(f.room().pendingBattle.kind, 'battle-armor'); f.respond('armor', { cardId: armor }); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(f.room().pendingBattle.kind, 'event-dodge'); f.respond(); assert.deepEqual(f.player(f.target).active.reinforcements, []); assert.equal(f.player(f.target).active.damage, 2);
});

test('Oblivious protection acquired from one Mewtwo event applies to another event in that same global turn', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'slowpoke'); const first = event(f), second = event(f); use(f, first); f.drain(); assert.equal(f.player(f.target).active.damage, 2); assert.ok(f.room().turn.damageImmunityIds.includes(f.player(f.target).active.instanceId)); use(f, second); f.drain(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.third).active.damage, 4);
});

test('Synchronize may claim the physical event once while later original targets still resolve normally', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'abra'); const cardId = event(f), actual = structuredClone(f.player(f.leader).hand[0]); use(f, cardId); f.respond(); assert.equal(f.room().pendingBattle.kind, 'synchronize'); f.respond('trait'); assert.deepEqual(f.player(f.target).hand, [actual]); assert.equal(countCard(f.room(), cardId), 1); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); f.respond(); assert.equal(f.player(f.third).active.damage, 2); assert.equal(f.room().discardPile.some(card => card.id === cardId), false); assert.equal(countCard(f.room(), cardId), 1);
});

test('a second Abra cannot duplicate an event already claimed by the first Synchronize', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'abra'); f.seed(f.third, 'abra'); const cardId = event(f); use(f, cardId); f.respond(); f.respond('trait'); f.respond(); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.target).hand.filter(card => card.id === cardId).length, 1); assert.equal(f.player(f.third).hand.length, 0); assert.equal(countCard(f.room(), cardId), 1);
});

test('spectator null active is never an external source owner for Helmet, Static or Poison Point while Water Absorb still runs', t => {
  const f = fixture(t, { count: 5 }); f.play(); const ordered = f.room().players.filter(player => player.id !== f.leader.playerId).map(player => f.byId(player.id)); f.seed(ordered[0], 'pikachu'); f.helmet(ordered[0]); f.seed(ordered[1], 'nidoran-m'); f.seed(ordered[2], 'lapras'); f.seed(ordered[3], 'squirtle'); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }), judged = f.judgments('rain')[0]; use(f, event(f)); f.drain(); for (const who of ordered) assert.equal(f.player(who).active.damage, who === ordered[2] ? 1 : 2); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.player(f.leader).active.status, null); assert.equal(f.player(observer).active, null); assert.equal(countCard(f.room(), judged.id), 1); assert.equal(f.room().pendingBattle, null);
});

test('Mewtwo does not trigger command-target Pressure or Cute Charm', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'aerodactyl'); f.supply(f.target); f.seed(f.third, 'clefairy'); f.supply(f.third); use(f, event(f)); assert.equal(f.room().pendingBattle.kind, 'event-dodge'); f.respond(); assert.equal(f.room().pendingBattle.kind, 'event-dodge'); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.third).active.damage, 2);
});

test('Lock-On move restrictions do not forbid an actual event-response Dodge against external Mewtwo', t => {
  const f = fixture(t); f.play('porygon', 3); const lock = f.view(f.leader).self.battle.moves.find(move => move.effectKind === 'lock-on'); f.attack({ moveIndex: lock.index, cardId: f.supply(f.leader, 'event', 'clear') }); f.respond(); assert.ok(f.room().turn.dodgeBlockedCreatureIds.includes(f.player(f.target).active.instanceId)); const cardId = event(f), dodge = f.supply(f.target, 'dodge'); use(f, cardId); f.respond('dodge', { cardId: dodge }); assert.equal(f.player(f.target).active.damage, 0); f.drain();
});

test('a saved original target can be rescued by Potion and the wave resumes at the next trainer without re-hitting it', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); const potion = { ...f.makeCard('tool', 'clear'), toolType: 'potion-full-heal' }; f.player(f.leader).hand.push(potion); use(f, event(f)); f.respond(); assert.equal(f.room().pendingBattle.kind, 'rescue'); f.respond('potion', { cardId: potion.id }); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.defeated, false); assert.equal(f.room().pendingBattle.kind, 'event-dodge'); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.third).active.damage, 2);
});

test('formal target defeat never awards the event user a kill reward or hits the newly deployed reserve', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); const incoming = f.player(f.target).reserve.instanceId, before = f.room().drawPile.length; use(f, event(f)); f.drain(); assert.equal(f.player(f.target).active.instanceId, incoming); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(f.room().drawPile.length, before); assert.equal(f.player(f.third).active.damage, 2);
});

test('a pinned future event target that switched, was defeated or eliminated is skipped rather than retargeted', t => {
  for (const scenario of ['switched', 'defeated', 'eliminated']) { const f = fixture(t); f.play(); use(f, event(f)); if (scenario === 'switched') { const old = f.player(f.third).active; f.player(f.third).active = f.player(f.third).reserve; f.player(f.third).reserve = old; } else if (scenario === 'defeated') f.player(f.third).active.defeated = true; else f.player(f.third).eliminated = true; f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.third).active.damage, 0); assert.equal(f.room().pendingBattle, null); }
});

test('an immediate victory stops later event targets and cleans the held event exactly once', t => {
  const f = fixture(t, { count: 4 }); f.play(); const rest = f.room().players.filter(player => player.id !== f.leader.playerId).map(player => f.byId(player.id)), rocket = rest[0], gym = rest[1], removed = rest[2]; f.player(rocket).role = 'rocket'; f.player(gym).role = 'gym'; f.player(removed).role = 'challenger'; f.player(removed).eliminated = true; f.seed(rocket, 'charmander', 1, { hpBonus: 0, damage: 2 }); f.player(rocket).reserve.defeated = true; const cardId = event(f); use(f, cardId); f.drain(); assert.equal(f.room().status, 'finished'); assert.equal(f.player(gym).active.damage, 0); assert.equal(f.room().turn, null); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null); assert.equal(countCard(f.room(), cardId), 1);
});

test('Mew Blessing targets all living original actives in self-first seat order with a mandatory owner choice', t => {
  const f = fixture(t, { count: 6 }); f.play(); const removed = f.byId(f.room().players[3].id); f.player(removed).eliminated = true; const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }), cardId = event(f, 'mew-blessing'), expected = f.room().players.filter(player => !player.spectator && !player.eliminated).map(player => player.id); assert.deepEqual(describe(f, 'mew-blessing').targetIds, expected); use(f, cardId); const actors = []; while (f.room().pendingBattle) { assert.equal(f.room().pendingBattle.kind, 'mew-blessing'); const pending = f.room().pendingBattle; assert.equal(pending.actorId, pending.targetId); actors.push(pending.actorId); f.respond('evolve'); } assert.deepEqual(actors, expected); assert.equal(actors.includes(observer.playerId), false); assert.equal(countCard(f.room(), cardId), 1);
});

test('Mew Blessing forces evolution at full HP below level three and caps healing without clearing statuses or markers', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.damage = 0; Object.assign(f.player(f.target).active, { damage: 1, status: 'poison', reinforcements: ['defense'] }); Object.assign(f.player(f.third).active, { damage: 4, status: 'sleep' }); use(f, event(f, 'mew-blessing')); assert.deepEqual(f.view(f.leader).pendingBattle.choices, ['evolve']); rejectsAtomically(f, () => f.respond('heal')); f.drain(); assert.equal(f.player(f.leader).active.level, 2); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.third).active.damage, 2); assert.equal(f.player(f.target).active.status, 'poison'); assert.equal(f.player(f.third).active.status, 'sleep'); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']);
});

test('Mew Blessing evolves exactly one level while preserving active identity, injury, status, markers, item and role bonus', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'squirtle', 2, { damage: 2, status: 'burn', reinforcements: ['power', 'defense'], hpBonus: 1 }); f.helmet(f.leader); const before = structuredClone(f.player(f.leader).active), role = f.player(f.leader).role; use(f, event(f, 'mew-blessing')); f.respond('evolve'); assert.deepEqual(f.player(f.leader).active, { ...before, level: 3 }); assert.equal(f.player(f.leader).role, role); f.drain();
});

test('Mew Blessing skips full-HP level three and requires injured level three to heal', t => {
  const f = fixture(t); f.play('squirtle', 3); f.seed(f.target, 'squirtle', 3, { damage: 3 }); use(f, event(f, 'mew-blessing')); assert.equal(f.room().pendingBattle.actorId, f.target.playerId); assert.deepEqual(f.view(f.target).pendingBattle.choices, ['heal']); rejectsAtomically(f, () => f.respond('evolve')); rejectsAtomically(f, () => f.respond('pass')); f.respond('heal'); assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.player(f.leader).active.level, 3); assert.equal(f.player(f.leader).active.damage, 0); f.drain();
});

test('Mew Blessing evolves Tauros without entry triggers or touching its reserve partner', t => {
  const f = fixture(t); f.play('tauros'); f.supply(f.target); const reserve = structuredClone(f.player(f.leader).reserve); use(f, event(f, 'mew-blessing')); f.respond('evolve'); assert.equal(f.player(f.leader).active.level, 2); assert.deepEqual(f.player(f.leader).reserve, reserve); assert.equal(f.room().entryEvent ?? null, null); assert.equal(f.room().pendingBattle.kind, 'mew-blessing'); assert.equal(f.room().pendingBattle.actorId, f.target.playerId); f.drain(); assert.equal(f.player(f.target).hand.length, 1);
});

test('Mew Blessing holds its real card outside piles and permits neither another play nor ordinary handoff until complete', t => {
  const f = fixture(t); f.play(); const cardId = event(f, 'mew-blessing'); use(f, cardId); assert.equal(f.room().discardPile.some(card => card.id === cardId), false); assert.equal(countCard(f.room(), cardId), 1); rejectsAtomically(f, () => f.act(f.leader, 'finishPlay'), 'RESPONSE_PENDING'); f.respond('evolve'); assert.equal(f.room().discardPile.some(card => card.id === cardId), false); f.drain(); assert.equal(f.room().discardPile.filter(card => card.id === cardId).length, 1);
});

test('Mew Blessing response authority and exact field validation reject fake payments, targets and level selectors atomically', t => {
  const f = fixture(t); f.play(); const cardId = event(f, 'mew-blessing'), held = f.supply(f.leader); use(f, cardId); const pending = f.room().pendingBattle; rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'heal' }), 'NOT_YOUR_DECISION'); rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: 'stale', choice: 'heal' }), 'STALE_DECISION'); for (const payload of [{ choice: 'pass' }, { choice: 'heal', cardId: held }, { choice: 'heal', cardIds: [] }, { choice: 'evolve', targetId: f.target.playerId }, { choice: 'heal', effect: 'heal' }, { choice: 'evolve', levelUp: true }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...payload }));
});

test('Mew Blessing mandatory response expiry waits without auto-healing, auto-evolving or passing', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play(); f.player(f.leader).active.damage = 3; use(f, event(f, 'mew-blessing')); const id = f.room().pendingBattle.id; f.advance(5_000); const view = f.view(f.leader); assert.equal(view.pendingBattle.id, id); assert.equal(view.pendingBattle.clock.expired, true); assert.equal(view.pendingBattle.clock.pausedReason, 'mandatory'); assert.equal(f.player(f.leader).active.damage, 3); assert.equal(f.player(f.leader).active.level, 1); assert.equal(view.turn.clock.remainingMs, 60_000);
});

test('Mew Blessing skips a queued original active that was replaced instead of evolving its new reserve', t => {
  const f = fixture(t); f.play(); use(f, event(f, 'mew-blessing')); const before = f.player(f.target).active, incoming = f.player(f.target).reserve; f.player(f.target).active = incoming; f.player(f.target).reserve = before; f.respond('evolve'); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); assert.equal(f.player(f.target).active.level, 1); f.respond('evolve'); assert.equal(f.room().pendingBattle, null);
});

test('several real Mew events may be played in one Play phase without using command, move, switch or trait allowances', t => {
  const f = fixture(t); f.play(); const instance = f.player(f.leader).active.instanceId; Object.assign(f.room().turn, { movesBlocked: true, blockedMoveIds: [instance], commandCreatureId: f.player(f.leader).reserve.instanceId, switchUsed: true, traitsUsed: [instance] }); f.player(f.leader).active.status = 'sleep'; f.player(f.leader).active.reinforcements = ['power', 'power']; const before = structuredClone(f.room().turn), threat = event(f), gift = event(f, 'mew-blessing'); use(f, threat); f.drain(); use(f, gift); f.drain(); assert.deepEqual(f.room().turn, before); assert.equal(f.player(f.leader).active.status, 'sleep'); assert.deepEqual(f.player(f.leader).active.reinforcements, ['power', 'power']); for (const id of [threat, gift]) assert.equal(countCard(f.room(), id), 1);
});

test('event use requires the actual current trainer Play phase and rejects spectators', t => {
  const f = fixture(t); f.play(); const foreign = event(f, 'mewtwo-threat', f.target); rejectsAtomically(f, () => use(f, foreign, f.target), 'NOT_YOUR_TURN'); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }), spectatorCard = event(f, 'mewtwo-threat', observer); rejectsAtomically(f, () => use(f, spectatorCard, observer), 'SPECTATOR_ONLY_VIEW');
  for (const phase of ['draw', 'discard', 'end']) { const g = fixture(t); g.play(); const cardId = event(g); g.room().turn.phase = phase; assert.equal(describe(g, 'mewtwo-threat').canUse, false); rejectsAtomically(g, () => use(g, cardId)); }
});

test('event use rejects foreign, unknown, spent or wrong-kind physical cards and forged action fields', t => {
  const f = fixture(t); f.play(); const cardId = event(f), foreign = event(f, 'mew-blessing', f.target), unknown = event(f, 'unknown-event'), wrong = { ...f.makeCard('tool', 'clear'), eventType: 'mewtwo-threat' }; f.player(f.leader).hand.push(wrong); for (const id of [foreign, unknown, wrong.id, 'forged', undefined, null]) rejectsAtomically(f, () => use(f, id)); for (const extra of [{ targetIds: [f.target.playerId] }, { targetId: f.target.playerId }, { choice: 'heal' }, { effect: 'mewtwo-threat' }, { cardIds: [] }, { amount: 5 }]) rejectsAtomically(f, () => f.act(f.leader, 'useEvent', { cardId, ...extra })); use(f, cardId); f.drain(); rejectsAtomically(f, () => use(f, cardId));
});

test('stale event-use requests cannot consume another physical event after a completed legal action changes revision', t => {
  const f = fixture(t); f.play(); const stale = event(f), other = event(f, 'mew-blessing'), request = f.input('useEvent', { cardId: stale }); use(f, other); f.drain(); rejectsAtomically(f, () => f.store.action(f.owner.code, f.leader.token, request), 'STALE_REVISION'); assert.equal(f.player(f.leader).hand.some(card => card.id === stale), true); assert.equal(f.player(f.target).active.damage, 0);
});

test('a pending event and closing votes block other event plays without consuming the waiting card', t => {
  const f = fixture(t); f.play(); const first = event(f), second = event(f, 'mew-blessing'); use(f, first); rejectsAtomically(f, () => use(f, second), 'RESPONSE_PENDING'); f.act(f.owner, 'requestEndGame'); rejectsAtomically(f, () => f.respond(), 'VOTE_PENDING'); assert.equal(f.player(f.leader).hand.some(card => card.id === second), true); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); f.drain(); use(f, second); f.drain();
});

test('an exact event-use retry preserves one held physical card and the same initial target decision', t => {
  const f = fixture(t); f.play(); const cardId = event(f), request = f.input('useEvent', { cardId }); f.store.action(f.owner.code, f.leader.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), once); assert.equal(f.room().pendingBattle.kind, 'event-dodge'); assert.equal(countCard(f.room(), cardId), 1); f.drain();
});

test('Mewtwo damage response retries never hit twice or advance the next trainer decision again', t => {
  const f = fixture(t); f.play(); use(f, event(f)); const request = f.input('respondBattle', { decisionId: f.room().pendingBattle.id, choice: 'pass' }); f.store.action(f.owner.code, f.target.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.target.token, request); assert.deepEqual(f.room(), once); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.third).active.damage, 0); f.drain();
});

test('Mew Blessing exact evolve retries cannot raise another level or apply to the next trainer', t => {
  const f = fixture(t); f.play(); use(f, event(f, 'mew-blessing')); const request = f.input('respondBattle', { decisionId: f.room().pendingBattle.id, choice: 'evolve' }); f.store.action(f.owner.code, f.leader.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), once); assert.equal(f.player(f.leader).active.level, 2); assert.equal(f.player(f.target).active.level, 1); f.drain();
});

test('restart during Mewtwo wave preserves original target bindings, current decision and single final card cleanup', t => {
  const f = fixture(t); f.play(); const cardId = event(f); use(f, cardId); f.respond(); const saved = structuredClone(f.room().resolution), restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.third.token).view; assert.deepEqual(restored.rooms.get(f.owner.code).resolution, saved); assert.equal(view.pendingBattle.actorId, f.third.playerId); const request = { id: 'restored-mewtwo-last', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'pass' }; restored.action(f.owner.code, f.third.token, request); const once = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.third.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), once); assert.equal(once.players.find(player => player.id === f.target.playerId).active.damage, 2); assert.equal(once.players.find(player => player.id === f.third.playerId).active.damage, 2); assert.equal(once.resolution, null); assert.equal(countCard(once, cardId), 1);
});

test('restart after Synchronize keeps the claimed physical event while the saved wave completes without discarding it', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'abra'); const cardId = event(f); use(f, cardId); f.respond(); f.respond('trait'); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.third.token).view; assert.equal(countCard(restored.rooms.get(f.owner.code), cardId), 1); restored.action(f.owner.code, f.third.token, { id: 'restored-claimed-event', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'pass' }); const room = restored.rooms.get(f.owner.code); assert.equal(room.players.find(player => player.id === f.target.playerId).hand.some(card => card.id === cardId), true); assert.equal(room.discardPile.some(card => card.id === cardId), false); assert.equal(countCard(room, cardId), 1);
});

test('restart during mandatory Mew Blessing preserves the unresolved owner choice and actual held event', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.damage = 3; const cardId = event(f, 'mew-blessing'); use(f, cardId); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.leader.token).view; assert.equal(view.pendingBattle.kind, 'mew-blessing'); assert.equal(countCard(restored.rooms.get(f.owner.code), cardId), 1); restored.action(f.owner.code, f.leader.token, { id: 'restored-mew-heal', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'heal' }); const room = restored.rooms.get(f.owner.code); assert.equal(room.players.find(player => player.id === f.leader.playerId).active.damage, 1); assert.equal(room.pendingBattle.actorId, f.target.playerId); assert.equal(room.discardPile.some(card => card.id === cardId), false);
});

test('optional Mewtwo event Dodge timeout passes only its one target and pauses the main turn clock', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play(); f.advance(1_000); use(f, event(f)); const first = f.room().pendingBattle.id; f.advance(5_000); const view = f.view(f.third); assert.notEqual(view.pendingBattle.id, first); assert.equal(view.pendingBattle.actorId, f.third.playerId); assert.equal(view.pendingBattle.clock.remainingMs, 5_000); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.third).active.damage, 0); f.respond(); assert.equal(f.view(f.leader).turn.clock.remainingMs, 59_000);
});

test('pending events expose no private physical IDs, private card fields or internal original-instance queues', t => {
  const f = fixture(t); f.play(); const cardId = event(f), card = f.player(f.leader).hand.find(card => card.id === cardId), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); use(f, cardId); for (const who of [...f.seats, observer]) { const view = f.view(who); assert.equal(view.resolution, undefined); assert.equal(view.resolutionStack, undefined); assert.equal(JSON.stringify(view).includes(cardId), false); assert.equal(JSON.stringify(view).includes(card.privateMarker), false); assert.equal(JSON.stringify(view.pendingBattle).includes(f.player(f.target).active.instanceId), false); }
});

test('using an event as a sunny weather cost activates only the chosen move and never starts its global event wave', t => {
  const f = fixture(t); f.play('jynx', 2); const cardId = event(f); f.attack({ cardId, moveIndex: 1 }); assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond(); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.third).active.damage, 0); assert.equal(f.room().pendingBattle, null); assert.equal(countCard(f.room(), cardId), 1);
});

test('Gas never suppresses either played event but still suppresses receiving Pokémon traits', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'lapras'); f.seed(f.third, 'koffing'); const fee = f.supply(f.third); start(f); f.respond('suppress', { cardId: fee, targetId: f.target.playerId }); drawToPlay(f); const top = f.room().drawPile.at(-1).id; use(f, event(f)); f.drain(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().drawPile.at(-1).id, top); use(f, event(f, 'mew-blessing')); f.drain(); assert.equal(f.player(f.target).active.damage, 0);
});
