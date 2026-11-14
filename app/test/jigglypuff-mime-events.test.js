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
  const dir = mkdtempSync(join(root, 'jiggly-mime-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ allowTestDecks: true, dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `jiggly-mime-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates, activeId = candidates.find(id => !['koffing', 'jynx', 'tauros'].includes(id)); act(who, 'selectPokemon', { activeId, reserveId: candidates.find(id => id !== activeId) }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-jiggly-mime-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private targeted event card ${serial}` } });
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
  const drain = () => { for (let i = 0; room().pendingBattle && i < 100; i++) { const pending = room().pendingBattle; if (pending.kind === 'event-hand') respond('card', { handIndex: 0 }); else if (pending.kind === 'mew-blessing') respond(pending.choices[0]); else if (pending.kind === 'sweet-kiss') respond('discard', { cardIds: player(byId(pending.actorId)).hand.slice(0, 2).map(card => card.id) }); else if (pending.kind === 'damage-order') order(pending.effects[0]); else respond(pending.kind === 'effects' ? 'effect' : 'pass', pending.kind === 'effects' ? { effect: pending.effects[0] } : {}); } assert.equal(room().pendingBattle, null); };
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
const use = (f, cardId, payload = {}, who = f.leader) => f.act(who, 'useEvent', { cardId, ...payload });
const describe = (f, type) => f.view(f.leader).self.battle.events.find(event => event.eventType === type);
const start = (f, who = f.leader) => f.store.startTurn(f.room(), who.playerId, f.room().turn.number + 1);
const drawToPlay = f => { while (f.room().turn.drawRemaining) f.act(f.leader, 'draw'); };


const sing = (f, target = f.target, payload = {}) => use(f, event(f, 'jigglypuff-performance'), { targetId: target.playerId, ...payload });
const mime = (f, effect = 'hand', target = f.target, payload = {}) => use(f, event(f, 'mr-mime-trick'), { targetId: target.playerId, effect, ...payload });
const menu = (f, type = 'mr-mime-trick') => describe(f, type);
const choicesFor = (f, effect) => menu(f).choices.find(choice => choice.effect === effect).targetIds;
const farSeat = f => f.byId(f.room().players[3].id);

test('targeted event menus use canonical descriptions and distinct single-target contracts', t => {
  const f = fixture(t); f.play(); event(f, 'jigglypuff-performance'); event(f, 'jigglypuff-performance'); event(f, 'mr-mime-trick'); f.supply(f.target);
  const song = menu(f, 'jigglypuff-performance'), trick = menu(f); assert.equal(f.view(f.leader).self.battle.events.length, 2); assert.equal(song.name.zh, '胖丁的表演'); assert.equal(trick.name.zh, '魔墙人偶的戏法'); assert.equal(song.targeting, 'single'); assert.equal(trick.targeting, 'single'); assert.equal(song.canUse, true); assert.equal(trick.canUse, true); assert.ok(song.description.en); assert.ok(trick.description.zh); assert.ok(trick.choices.some(choice => choice.effect === 'hand')); assert.ok(trick.choices.some(choice => choice.effect === 'item'));
});

test('Jigglypuff may select own or distant active, never a reserve, observer or eliminated trainer', t => {
  for (const self of [true, false]) { const f = fixture(t, { count: 6 }); f.play(); const target = self ? f.leader : farSeat(f), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }), skipped = f.byId(f.room().players[4].id); f.player(skipped).eliminated = true; const cardId = event(f, 'jigglypuff-performance'), legal = menu(f, 'jigglypuff-performance').targetIds; assert.ok(legal.includes(target.playerId)); assert.equal(legal.includes(observer.playerId), false); assert.equal(legal.includes(skipped.playerId), false); assert.equal(legal.includes(f.player(f.target).reserve.instanceId), false); f.judgments('clear'); use(f, cardId, { targetId: target.playerId }); assert.equal(f.player(target).active.status, 'sleep'); assert.equal(f.player(target).reserve.status, null); assert.equal(f.room().pendingBattle, null); assert.equal(countCard(f.room(), cardId), 1); }
});

test('Jigglypuff sleeps on every real judgment result except thunderstorm', t => {
  for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) { const f = fixture(t); f.play(); const cardId = event(f, 'jigglypuff-performance'), judged = f.judgments(weather)[0], before = structuredClone(f.player(f.target).active); use(f, cardId, { targetId: f.target.playerId }); assert.equal(f.player(f.target).active.status, weather === 'thunderstorm' ? null : 'sleep'); assert.equal(f.player(f.target).active.damage, before.damage); assert.equal(f.room().discardPile.some(card => card.id === judged.id), true); assert.equal(f.room().discardPile.some(card => card.id === cardId), true); assert.equal(countCard(f.room(), judged.id), 1); }
});

test('Jigglypuff has no invented Dodge window or command effects and preserves move, Power and Defense state', t => {
  const f = fixture(t); f.play('magikarp', 2); const dodge = f.supply(f.target, 'dodge'), cardId = event(f, 'jigglypuff-performance'); f.player(f.leader).active.reinforcements = ['power', 'power']; f.player(f.target).active.reinforcements = ['defense']; const before = structuredClone(f.room().turn), source = structuredClone(f.player(f.leader).active); f.judgments('rain'); use(f, cardId, { targetId: f.target.playerId }); assert.deepEqual(f.room().turn, before); assert.deepEqual(f.player(f.leader).active, source); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(f.player(f.target).hand.some(card => card.id === dodge), true); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().pendingBattle, null);
});

test('Jigglypuff always performs its judgment but never overwrites an existing status', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.status = 'burn'; const cardId = event(f, 'jigglypuff-performance'), judged = f.judgments('clear')[0]; use(f, cardId, { targetId: f.target.playerId }); assert.equal(f.player(f.target).active.status, 'burn'); assert.ok(f.room().discardPile.some(card => card.id === judged.id)); assert.equal(f.room().pendingBattle, null);
});

test('Shield Dust and Vital Spirit prevent Jigglypuff Sleep after the mandatory judgment', t => {
  for (const [family, level] of [['caterpie', 1], ['weedle', 1], ['electabuzz', 1], ['electabuzz', 3]]) { const f = fixture(t); f.play(); f.seed(f.target, family, level); const judged = f.judgments('clear')[0]; sing(f); assert.equal(f.player(f.target).active.status, null); assert.ok(f.room().discardPile.some(card => card.id === judged.id)); assert.equal(f.player(f.target).active.damage, 0); }
});

test('Gas suppresses receiving Sleep immunity while it never suppresses a played Jigglypuff event', t => {
  for (const family of ['caterpie', 'electabuzz']) { const f = fixture(t); f.play(); f.seed(f.target, family); f.room().turn.suppressedTraitPlayerIds = [f.leader.playerId, f.target.playerId]; f.judgments('clear'); sing(f); assert.equal(f.player(f.target).active.status, 'sleep'); assert.equal(f.room().pendingBattle, null); }
});

test('active Early Bird excludes both named event targets before payment but Gas restores eligibility', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'kangaskhan', 3); f.supply(f.target); f.helmet(f.target); const song = event(f, 'jigglypuff-performance'), trick = event(f, 'mr-mime-trick'); assert.equal(menu(f, 'jigglypuff-performance').targetIds.includes(f.target.playerId), false); assert.equal(menu(f).targetIds.includes(f.target.playerId), false); rejectsAtomically(f, () => use(f, song, { targetId: f.target.playerId })); rejectsAtomically(f, () => use(f, trick, { targetId: f.target.playerId, effect: 'hand' })); f.room().turn.suppressedTraitPlayerIds = [f.target.playerId]; assert.ok(menu(f, 'jigglypuff-performance').targetIds.includes(f.target.playerId)); assert.ok(choicesFor(f, 'hand').includes(f.target.playerId)); f.judgments('clear'); use(f, song, { targetId: f.target.playerId }); assert.equal(f.player(f.target).active.status, 'sleep'); use(f, trick, { targetId: f.target.playerId, effect: 'hand' }); f.respond('card', { handIndex: 0 }); assert.equal(f.player(f.target).hand.length, 0);
});

test('reserve Kangaskhan does not protect a different active from either named event', t => {
  const f = fixture(t); f.play(); f.player(f.target).reserve.catalogueId = 'kangaskhan'; f.supply(f.target); event(f, 'mr-mime-trick'); event(f, 'jigglypuff-performance'); assert.ok(menu(f).targetIds.includes(f.target.playerId)); assert.ok(menu(f, 'jigglypuff-performance').targetIds.includes(f.target.playerId)); f.judgments('clear'); sing(f); assert.equal(f.player(f.target).active.status, 'sleep'); assert.equal(f.player(f.target).reserve.status, null);
});

test('Drought replaces the displayed judgment before Jigglypuff decides Sleep and gains the displaced card', t => {
  const f = fixture(t); f.play(); f.seed(f.third, 'vulpix'); const payment = f.supply(f.third, 'event', 'clear'), judged = f.judgments('thunderstorm')[0], cardId = event(f, 'jigglypuff-performance'); use(f, cardId, { targetId: f.target.playerId }); assert.equal(f.room().pendingBattle.kind, 'judgment'); assert.equal(f.room().judgment.judgeId, f.target.playerId); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); assert.equal(f.player(f.target).active.status, null); assert.equal(f.room().discardPile.some(card => card.id === cardId), false); f.respond('replace', { cardId: payment }); assert.equal(f.player(f.target).active.status, 'sleep'); assert.ok(f.player(f.third).hand.some(card => card.id === judged.id)); assert.ok(f.room().discardPile.some(card => card.id === payment)); assert.equal(countCard(f.room(), cardId), 1);
});

test('passing Drought leaves the real thunderstorm result effective without sleeping the target', t => {
  const f = fixture(t); f.play(); f.seed(f.third, 'vulpix'); f.supply(f.third, 'event', 'clear'); f.judgments('thunderstorm'); sing(f); assert.equal(f.room().pendingBattle.kind, 'judgment'); f.respond(); assert.equal(f.player(f.target).active.status, null); assert.equal(f.room().pendingBattle, null);
});

test('empty judgment supply neither fabricates a result nor recycles the resolving Jigglypuff card', t => {
  const f = fixture(t); f.play(); const cardId = event(f, 'jigglypuff-performance'); f.room().drawPile = []; f.room().discardPile = []; use(f, cardId, { targetId: f.target.playerId }); assert.equal(f.player(f.target).active.status, null); assert.deepEqual(ids(f.room().discardPile), [cardId]); assert.equal(countCard(f.room(), cardId), 1); assert.equal(f.room().pendingBattle, null);
});

test('Poison Touch may replace Jigglypuff Sleep with Poison after its final judgment', t => {
  const f = fixture(t); f.play(); f.seed(f.third, 'grimer'); const cardId = event(f, 'jigglypuff-performance'); f.judgments('rain'); use(f, cardId, { targetId: f.target.playerId }); assert.equal(f.room().pendingBattle.kind, 'poison-touch'); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); assert.equal(f.player(f.target).active.status, null); assert.equal(f.room().discardPile.some(card => card.id === cardId), false); f.respond('trait'); assert.equal(f.player(f.target).active.status, 'poison'); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().resolution, null); assert.equal(countCard(f.room(), cardId), 1);
});

test('Mr Mime requires one other active and cannot target reserves, self, distant, empty or missing-item targets', t => {
  const f = fixture(t, { count: 6 }); f.play(); f.supply(f.target); f.supply(farSeat(f)); const cardId = event(f, 'mr-mime-trick'); assert.ok(choicesFor(f, 'hand').includes(f.target.playerId)); assert.equal(menu(f).targetIds.includes(f.leader.playerId), false); assert.equal(menu(f).targetIds.includes(farSeat(f).playerId), false); assert.deepEqual(choicesFor(f, 'item'), []); for (const payload of [{ targetId: f.leader.playerId, effect: 'hand' }, { targetId: farSeat(f).playerId, effect: 'hand' }, { targetId: f.player(f.target).reserve.instanceId, effect: 'hand' }, { targetId: f.target.playerId, effect: 'item' }, { targetId: f.third.playerId, effect: 'hand' }]) rejectsAtomically(f, () => use(f, cardId, payload));
});

test('Mr Mime lists only branches the actual active supplies and blocks use when neither branch can resolve', t => {
  const f = fixture(t); f.play(); const cardId = event(f, 'mr-mime-trick'); assert.equal(menu(f).canUse, false); assert.deepEqual(menu(f).targetIds, []); f.helmet(f.target); assert.equal(menu(f).canUse, true); assert.deepEqual(choicesFor(f, 'hand'), []); assert.deepEqual(choicesFor(f, 'item'), [f.target.playerId]); rejectsAtomically(f, () => use(f, cardId, { targetId: f.target.playerId, effect: 'hand' }));
});

test('effective Speed removes Mr Mime card distance even for Dragonair while Paralysis disables the marker', t => {
  const f = fixture(t, { count: 6 }); f.play('dratini', 2); const far = farSeat(f); f.supply(far); event(f, 'mr-mime-trick'); assert.equal(menu(f).targetIds.includes(far.playerId), false); f.player(f.leader).active.reinforcements = ['speed']; assert.ok(menu(f).targetIds.includes(far.playerId)); f.player(f.leader).active.status = 'paralysis'; assert.equal(menu(f).targetIds.includes(far.playerId), false); f.player(f.leader).active.status = null; const cardId = event(f, 'mr-mime-trick'); use(f, cardId, { targetId: far.playerId, effect: 'hand' }); f.respond('card', { handIndex: 0 }); assert.equal(f.player(far).hand.length, 0); assert.deepEqual(f.player(f.leader).active.reinforcements, ['speed']);
});

test('Sniper removes Mr Mime card distance only for an effective active Beedrill', t => {
  const f = fixture(t, { count: 6 }); f.play('weedle', 3); const far = farSeat(f); f.supply(far); event(f, 'mr-mime-trick'); assert.ok(menu(f).targetIds.includes(far.playerId)); f.room().turn.suppressedTraitPlayerIds = [f.leader.playerId]; assert.equal(menu(f).targetIds.includes(far.playerId), false); f.room().turn.suppressedTraitPlayerIds = []; f.player(f.leader).active.level = 2; assert.equal(menu(f).targetIds.includes(far.playerId), false); f.player(f.leader).reserve.catalogueId = 'weedle'; f.player(f.leader).reserve.level = 3; assert.equal(menu(f).targetIds.includes(far.playerId), false);
});

test('successful Chlorophyll grants Mr Mime card range that persists after switching from the granting active', t => {
  const f = fixture(t, { count: 6 }); f.play('bulbasaur'); const far = farSeat(f); f.supply(far); event(f, 'mr-mime-trick'); assert.equal(menu(f).targetIds.includes(far.playerId), false); f.judgments('clear'); f.act(f.leader, 'useTrait'); assert.ok(menu(f).targetIds.includes(far.playerId)); f.act(f.leader, 'switchPokemon'); assert.ok(menu(f).targetIds.includes(far.playerId)); const cardId = event(f, 'mr-mime-trick'); use(f, cardId, { targetId: far.playerId, effect: 'hand' }); f.respond('card', { handIndex: 0 }); assert.equal(f.player(far).hand.length, 0);
});

test('legacy saved Chlorophyll grant still gives trainer card range after ordinary switching', t => {
  const f = fixture(t, { count: 6 }); f.play('bulbasaur'); const far = farSeat(f); f.supply(far); event(f, 'mr-mime-trick'); f.judgments('clear'); f.act(f.leader, 'useTrait'); delete f.room().turn.cardRangePlayerId; assert.ok(f.room().turn.rangeCreatureId); f.act(f.leader, 'switchPokemon'); assert.ok(menu(f).targetIds.includes(far.playerId));
});

test('Swift Swim trainer card permission survives ordinary switching and later Gas suppression', t => {
  const f = fixture(t, { count: 6 }); f.play('psyduck'); const far = farSeat(f); f.supply(far); event(f, 'mr-mime-trick'); f.judgments('rain'); f.act(f.leader, 'useTrait'); assert.ok(menu(f).targetIds.includes(far.playerId)); f.act(f.leader, 'switchPokemon'); f.room().turn.suppressedTraitPlayerIds = [f.leader.playerId]; assert.ok(menu(f).targetIds.includes(far.playerId)); const cardId = event(f, 'mr-mime-trick'); use(f, cardId, { targetId: far.playerId, effect: 'hand' }); f.respond('card', { handIndex: 0 }); assert.equal(f.player(far).hand.length, 0);
});

test('Mr Mime privately selects a shuffled hand back and obtains exactly that card without damage or judgment', t => {
  const f = fixture(t); f.play(); const first = f.supply(f.target, 'command'), second = f.supply(f.target, 'dodge', 'rain'), actual = structuredClone(f.player(f.target).hand), cardId = event(f, 'mr-mime-trick'), top = f.room().drawPile.at(-1).id; use(f, cardId, { targetId: f.target.playerId, effect: 'hand' }); assert.equal(f.room().pendingBattle.kind, 'event-hand'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); const chosenId = f.room().resolution.handChoiceIds[1]; f.respond('card', { handIndex: 1 }); assert.deepEqual(f.player(f.leader).hand, actual.filter(card => card.id === chosenId)); assert.deepEqual(f.player(f.target).hand, actual.filter(card => card.id !== chosenId)); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().drawPile.at(-1).id, top); assert.equal(f.room().discardPile.some(card => card.id === chosenId), false); for (const id of [cardId, first, second]) assert.equal(countCard(f.room(), id), 1); assert.equal(f.room().resolution, null);
});

test('Mr Mime hand gain preserves statuses, markers and both Pokémon instances', t => {
  const f = fixture(t); f.play(); f.supply(f.target); f.player(f.target).active.status = 'burn'; f.player(f.target).active.reinforcements = ['defense', 'speed']; const target = structuredClone(f.player(f.target).active), reserve = structuredClone(f.player(f.target).reserve), before = structuredClone(f.room().turn); mime(f); f.respond('card', { handIndex: 0 }); assert.deepEqual(f.player(f.target).active, target); assert.deepEqual(f.player(f.target).reserve, reserve); assert.deepEqual(f.room().turn, before); assert.equal(f.player(f.target).hand.length, 0);
});

test('only Mr Mime actor sees anonymous selectable backs while everyone else learns no shuffled mapping', t => {
  const f = fixture(t); f.play(); f.supply(f.target); f.supply(f.target, 'dodge'); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }), hand = structuredClone(f.player(f.target).hand), cardId = event(f, 'mr-mime-trick'); use(f, cardId, { targetId: f.target.playerId, effect: 'hand' }); const own = f.view(f.leader).pendingBattle; assert.deepEqual(own.choices, [{ index: 0 }, { index: 1 }]); for (const who of [...f.seats, observer]) { const pending = f.view(who).pendingBattle; assert.equal(pending.handChoiceIds, undefined); assert.equal(pending.targetCreatureId, undefined); assert.equal(JSON.stringify(pending).includes(cardId), false); for (const card of hand) { assert.equal(JSON.stringify(pending).includes(card.id), false); assert.equal(JSON.stringify(pending).includes(card.privateMarker), false); assert.equal(JSON.stringify(pending).includes(card.name.en), false); } if (who !== f.leader) assert.equal(pending.choices, undefined); } f.respond('card', { handIndex: 0 });
});

test('Mr Mime real hand-card gain triggers acting Meowth Pickup once only at levels one and two', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t); f.play('meowth', level); const victim = f.supply(f.target), bonus = f.room().drawPile.at(-1).id, cardId = event(f, 'mr-mime-trick'); use(f, cardId, { targetId: f.target.playerId, effect: 'hand' }); f.respond('card', { handIndex: 0 }); assert.ok(f.player(f.leader).hand.some(card => card.id === victim)); assert.equal(f.player(f.leader).hand.some(card => card.id === bonus), level < 3); assert.equal(f.player(f.leader).hand.length, level < 3 ? 2 : 1); assert.equal(countCard(f.room(), cardId), 1); }
});

test('Mr Mime item effect moves the real equipped item into hand without equipping or discarding it', t => {
  const f = fixture(t); f.play(); const stolen = structuredClone(f.helmet(f.target)), own = structuredClone(f.helmet(f.leader)), reserveItem = { ...f.makeCard('held-item'), itemType: 'rocky-helmet' }; f.player(f.target).reserve.item = reserveItem; const cardId = event(f, 'mr-mime-trick'); use(f, cardId, { targetId: f.target.playerId, effect: 'item' }); assert.equal(f.player(f.target).active.item, undefined); assert.deepEqual(f.player(f.leader).hand, [stolen]); assert.deepEqual(f.player(f.leader).active.item, own); assert.deepEqual(f.player(f.target).reserve.item, reserveItem); assert.equal(f.room().discardPile.some(card => card.id === stolen.id), false); assert.equal(f.room().pendingBattle, null); for (const id of [stolen.id, own.id, reserveItem.id, cardId]) assert.equal(countCard(f.room(), id), 1);
});

test('an acquired item triggers acting Pickup as a real card gain without automatic equipment', t => {
  const f = fixture(t); f.play('meowth'); const item = structuredClone(f.helmet(f.target)), bonus = f.room().drawPile.at(-1).id; mime(f, 'item'); assert.equal(f.player(f.leader).active.item, undefined); assert.ok(f.player(f.leader).hand.some(card => card.id === item.id)); assert.ok(f.player(f.leader).hand.some(card => card.id === bonus)); assert.equal(f.player(f.leader).hand.length, 2); assert.equal(f.player(f.target).active.item, undefined);
});

test('Mr Mime item loss offers active Mankey Defiant after transfer and keeps event outside piles until response', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'mankey'); const item = structuredClone(f.helmet(f.target)), cardId = event(f, 'mr-mime-trick'); use(f, cardId, { targetId: f.target.playerId, effect: 'item' }); assert.equal(f.player(f.target).active.item, undefined); assert.deepEqual(f.player(f.leader).hand, [item]); assert.equal(f.room().pendingBattle.kind, 'defiant'); assert.equal(f.room().pendingBattle.actorId, f.target.playerId); assert.equal(f.room().discardPile.some(card => card.id === cardId), false); f.respond('trait'); assert.equal(f.player(f.target).hand.length, 2); assert.ok(f.room().turn.noHandLimitIds.includes(f.target.playerId)); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null); assert.equal(countCard(f.room(), cardId), 1);
});

test('passing item-loss Defiant finishes Mr Mime without cards or no-hand-limit permission', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'mankey'); f.helmet(f.target); const cardId = event(f, 'mr-mime-trick'); use(f, cardId, { targetId: f.target.playerId, effect: 'item' }); f.respond(); assert.equal(f.player(f.target).hand.length, 0); assert.equal(f.room().turn.noHandLimitIds?.includes(f.target.playerId) || false, false); assert.equal(f.room().resolution, null); assert.equal(countCard(f.room(), cardId), 1);
});

test('Gas suppresses item-loss Defiant while Mr Mime still takes the actual item', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'mankey'); f.room().turn.suppressedTraitPlayerIds = [f.target.playerId]; const item = f.helmet(f.target); mime(f, 'item'); assert.equal(f.player(f.target).active.item, undefined); assert.ok(f.player(f.leader).hand.some(card => card.id === item.id)); assert.equal(f.room().pendingBattle, null);
});

test('Mr Mime cannot take a reserve item even when that reserve is publicly revealed', t => {
  const f = fixture(t); f.play(); f.player(f.target).reserve.item = { ...f.makeCard('held-item'), itemType: 'rocky-helmet' }; f.player(f.target).reserve.revealed = true; const cardId = event(f, 'mr-mime-trick'); assert.equal(choicesFor(f, 'item').includes(f.target.playerId), false); rejectsAtomically(f, () => use(f, cardId, { targetId: f.target.playerId, effect: 'item' })); assert.ok(f.player(f.target).reserve.item);
});

test('targeted event use rejects invented slots, target arrays, effect selectors and foreign or fake cards atomically', t => {
  const f = fixture(t); f.play(); f.supply(f.target); const song = event(f, 'jigglypuff-performance'), trick = event(f, 'mr-mime-trick'), foreign = event(f, 'mr-mime-trick', f.target); for (const payload of [{ cardId: song }, { cardId: song, targetId: f.target.playerId, effect: 'sleep' }, { cardId: song, targetId: f.target.playerId, slot: 'active' }, { cardId: song, targetIds: [f.target.playerId] }, { cardId: trick, targetId: f.target.playerId }, { cardId: trick, targetId: f.target.playerId, effect: 'discard' }, { cardId: trick, targetId: f.target.playerId, effect: 'hand', handIndex: 0 }, { cardId: foreign, targetId: f.target.playerId, effect: 'hand' }, { cardId: 'fake', targetId: f.target.playerId }]) rejectsAtomically(f, () => f.act(f.leader, 'useEvent', payload));
});

test('global Mew events retain card-only action shape after targeted event support is enabled', t => {
  const f = fixture(t); f.play(); for (const type of ['mewtwo-threat', 'mew-blessing']) { const cardId = event(f, type); for (const extra of [{ targetId: f.target.playerId }, { effect: 'hand' }, { slot: 'active' }, { targetIds: [] }]) rejectsAtomically(f, () => use(f, cardId, extra)); }
});

test('targeted events stay separate from Sleep and used move counters but require own unblocked Play', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.status = 'sleep'; f.room().turn.movesBlocked = true; const instance = f.player(f.leader).active.instanceId; f.room().turn.blockedMoveIds = [instance]; f.room().turn.commandCreatureId = f.player(f.leader).reserve.instanceId; f.room().turn.traitsUsed = [instance]; f.supply(f.target); const before = structuredClone(f.room().turn); mime(f); f.respond('card', { handIndex: 0 }); f.judgments('thunderstorm'); sing(f); assert.deepEqual(f.room().turn, before); assert.equal(f.player(f.leader).active.status, 'sleep');
  for (const phase of ['draw', 'discard', 'end']) { const g = fixture(t); g.play(); const cardId = event(g, 'jigglypuff-performance'); g.room().turn.phase = phase; assert.equal(menu(g, 'jigglypuff-performance').canUse, false); rejectsAtomically(g, () => use(g, cardId, { targetId: g.target.playerId })); }
});

test('Mr Mime hand choices enforce actor, fresh decision, exact fields and saved anonymous index', t => {
  const f = fixture(t); f.play(); const victim = f.supply(f.target); mime(f); const pending = f.room().pendingBattle; rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'card', handIndex: 0 }), 'NOT_YOUR_DECISION'); rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: 'stale', choice: 'card', handIndex: 0 }), 'STALE_DECISION'); for (const extra of [{ choice: 'pass' }, { choice: 'card' }, { choice: 'card', handIndex: -1 }, { choice: 'card', handIndex: 1 }, { choice: 'card', handIndex: 0, cardId: victim }, { choice: 'card', handIndex: 0, effect: 'hand' }, { choice: 'card', handIndex: 0, targetId: f.target.playerId }, { choice: 'card', handIndex: 0, cardIds: [] }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...extra })); f.respond('card', { handIndex: 0 }); assert.ok(f.player(f.leader).hand.some(card => card.id === victim));
});

test('changed original target or actor instance rejects stale Mr Mime hand selection without taking cards', t => {
  for (const whoName of ['target', 'leader']) { const f = fixture(t); f.play(); f.supply(f.target); mime(f); const who = f[whoName], old = f.player(who).active; f.player(who).active = f.player(who).reserve; f.player(who).reserve = old; rejectsAtomically(f, () => f.respond('card', { handIndex: 0 }), 'STALE_DECISION'); }
});

test('a removed saved Mr Mime hand choice cannot silently select a newly supplied replacement card', t => {
  const f = fixture(t); f.play(); f.supply(f.target); mime(f); const old = f.player(f.target).hand.pop(); f.room().discardPile.push(old); const fresh = f.supply(f.target); rejectsAtomically(f, () => f.respond('card', { handIndex: 0 }), 'STALE_DECISION'); assert.equal(f.player(f.target).hand[0].id, fresh);
});

test('mandatory Mr Mime hand timeout pauses without choosing and a later real choice finishes normally', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play(); f.supply(f.target); const cardId = event(f, 'mr-mime-trick'); use(f, cardId, { targetId: f.target.playerId, effect: 'hand' }); const id = f.room().pendingBattle.id; f.advance(5000); const view = f.view(f.leader); assert.equal(view.pendingBattle.id, id); assert.equal(view.pendingBattle.clock.expired, true); assert.equal(view.pendingBattle.clock.pausedReason, 'mandatory'); assert.equal(f.player(f.target).hand.length, 1); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(view.turn.clock.remainingMs, 60000); f.respond('card', { handIndex: 0 }); assert.equal(f.room().pendingBattle, null); assert.equal(countCard(f.room(), cardId), 1);
});

test('optional item-loss Defiant timeout passes and finishes Mr Mime while retaining the acquired item', t => {
  const f = fixture(t, { responseSeconds: 5 }); f.play(); f.seed(f.target, 'mankey'); const item = f.helmet(f.target), cardId = event(f, 'mr-mime-trick'); use(f, cardId, { targetId: f.target.playerId, effect: 'item' }); f.advance(5000); const view = f.view(f.leader); assert.equal(view.pendingBattle, null); assert.equal(f.player(f.target).hand.length, 0); assert.ok(f.player(f.leader).hand.some(card => card.id === item.id)); assert.equal(countCard(f.room(), cardId), 1);
});

test('closing votes block Jigglypuff judgment and Mr Mime private hand responses without losing cards', t => {
  for (const type of ['jigglypuff-performance', 'mr-mime-trick']) { const f = fixture(t); f.play(); if (type === 'jigglypuff-performance') { f.seed(f.third, 'vulpix'); f.judgments('clear'); } else f.supply(f.target); const cardId = event(f, type); use(f, cardId, { targetId: f.target.playerId, ...(type === 'mr-mime-trick' ? { effect: 'hand' } : {}) }); f.act(f.owner, 'requestEndGame'); rejectsAtomically(f, () => type === 'mr-mime-trick' ? f.respond('card', { handIndex: 0 }) : f.respond(), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); f.drain(); assert.equal(countCard(f.room(), cardId), 1); }
});

test('exact Mr Mime use and private-card retries never duplicate the acquired item or hand card', t => {
  for (const effect of ['hand', 'item']) { const f = fixture(t); f.play(); if (effect === 'hand') f.supply(f.target); else f.helmet(f.target); const cardId = event(f, 'mr-mime-trick'), request = f.input('useEvent', { cardId, targetId: f.target.playerId, effect }); f.store.action(f.owner.code, f.leader.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), once); if (effect === 'hand') { const response = f.input('respondBattle', { decisionId: f.room().pendingBattle.id, choice: 'card', handIndex: 0 }); f.store.action(f.owner.code, f.leader.token, response); const taken = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, response); assert.deepEqual(f.room(), taken); } assert.equal(f.player(f.leader).hand.length, 1); assert.equal(countCard(f.room(), cardId), 1); }
});

test('restart preserves Mr Mime private hand mapping and settles that exact actual card once', t => {
  const f = fixture(t); f.play(); f.supply(f.target); f.supply(f.target, 'dodge'); const cardId = event(f, 'mr-mime-trick'); use(f, cardId, { targetId: f.target.playerId, effect: 'hand' }); const chosen = f.room().resolution.handChoiceIds[1], restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.leader.token).view; assert.equal(view.pendingBattle.kind, 'event-hand'); assert.deepEqual(view.pendingBattle.choices, [{ index: 0 }, { index: 1 }]); const request = { id: 'restored-mime', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'card', handIndex: 1 }; restored.action(f.owner.code, f.leader.token, request); const once = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.leader.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), once); assert.ok(once.players.find(player => player.id === f.leader.playerId).hand.some(card => card.id === chosen)); assert.equal(countCard(once, cardId), 1); assert.equal(once.resolution, null);
});

test('restart during Jigglypuff Drought preserves original target and final judgment continuation', t => {
  const f = fixture(t); f.play(); f.seed(f.third, 'vulpix'); const replacement = f.supply(f.third, 'event', 'clear'), cardId = event(f, 'jigglypuff-performance'); f.judgments('thunderstorm'); use(f, cardId, { targetId: f.target.playerId }); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.third.token).view; const request = { id: 'restored-song', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'replace', cardId: replacement }; restored.action(f.owner.code, f.third.token, request); const once = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.third.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), once); assert.equal(once.players.find(player => player.id === f.target.playerId).active.status, 'sleep'); assert.equal(countCard(once, cardId), 1); assert.equal(once.resolution, null);
});

test('Jigglypuff delayed judgment never applies its status to a newly deployed reserve', t => {
  const f = fixture(t); f.play(); f.seed(f.third, 'vulpix'); f.judgments('clear'); const original = f.player(f.target).active, incoming = f.player(f.target).reserve; sing(f); assert.equal(f.room().pendingBattle.kind, 'judgment'); f.player(f.target).active = incoming; f.player(f.target).reserve = original; f.respond(); assert.equal(f.player(f.target).active.status, null); assert.equal(f.player(f.target).reserve.status, null); assert.equal(f.room().resolution, null);
});

test('a targeted event paid for a weather move executes that Pokémon move without executing its event', t => {
  const f = fixture(t); f.play('jynx', 2); const cardId = event(f, 'mr-mime-trick'); f.attack({ cardId, moveIndex: 1 }); assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond(); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(f.player(f.target).active.status, null); assert.equal(f.room().pendingBattle, null); assert.equal(countCard(f.room(), cardId), 1);
});
