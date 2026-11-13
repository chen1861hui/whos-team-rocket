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
  const dir = mkdtempSync(join(root, 'legendary-birds-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ allowTestDecks: true, dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `legendary-birds-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates, activeId = candidates.find(id => !['koffing', 'jynx', 'tauros'].includes(id)); act(who, 'selectPokemon', { activeId, reserveId: candidates.find(id => id !== activeId) }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-legendary-birds-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private bird event card ${serial}` } });
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
  const drain = () => { for (let i = 0; room().pendingBattle && i < 100; i++) { const pending = room().pendingBattle; if (pending.kind === 'mew-blessing') respond('heal'); else if (pending.kind === 'sweet-kiss') respond('discard', { cardIds: player(byId(pending.actorId)).hand.slice(0, 2).map(card => card.id) }); else if (pending.kind === 'damage-order') order(pending.effects[0]); else respond(pending.kind === 'effects' ? 'effect' : 'pass', pending.kind === 'effects' ? { effect: pending.effects[0] } : {}); } assert.equal(room().pendingBattle, null); };
  const startStatus = (status = 'poison', who = target) => { player(who).active.status = status; store.startTurn(room(), who.playerId, 2); };
  return { store, dir, now, owner, seats, leader, target, third, room, player, byId, view, input, act, seed, makeCard, supply, top, judgments, play, attack, respond, order, helmet, drain, startStatus, advance: ms => { time += ms; } };
}
function rejectsAtomically(f, action, code) { const before = structuredClone(f.room()); assert.throws(action, error => code === undefined || error.code === code); assert.deepEqual(f.room(), before); }
const ids = cards => cards.map(card => card.id);
const publicFace = ({ name, weather, kind }) => ({ name, weather, kind });
const publicHand = ({ id, name, weather, kind }) => ({ id, name, weather, kind });
const allCards = room => [...room.drawPile, ...room.discardPile, ...room.players.flatMap(p => [...(p.hand || []), ...[p.active?.item, p.reserve?.item].filter(Boolean)]), ...[room.resolution, ...(room.resolutionStack || [])].flatMap(r => r ? [...(r.card && !r.cardClaimedBy ? [r.card] : []), ...(r.revealedCards || [])] : []), ...(room.judgment?.card ? [room.judgment.card] : []), ...(room.drawChoice?.cards || [])];
const countCard = (room, id) => allCards(room).filter(card => card.id === id).length;

const event = (f, eventType = 'moltres-trial', who = f.leader) => { const card = { ...f.makeCard('event', 'clear'), eventType }; f.player(who).hand.push(card); return card.id; };
const use = (f, cardId, who = f.leader) => f.act(who, 'useEvent', { cardId });
const describe = (f, type) => f.view(f.leader).self.battle.events.find(event => event.eventType === type);
const start = (f, who = f.leader) => f.store.startTurn(f.room(), who.playerId, f.room().turn.number + 1);
const drawToPlay = f => { while (f.room().turn.drawRemaining) f.act(f.leader, 'draw'); };

const song = (f, type = 'moltres-trial', who = f.leader) => event(f, type, who);
const liveOrder = f => f.room().players.filter(player => !player.spectator && !player.eliminated).map(player => player.id);
const round = (f, who = f.leader) => { f.store.startTurn(f.room(), who.playerId, f.room().turn.number + 1); while (f.room().turn.drawRemaining) f.act(who, 'draw'); };
const rescuePotion = (f, who = f.leader) => { const card = { ...f.makeCard('tool', 'clear'), toolType: 'potion-full-heal' }; f.player(who).hand.push(card); return card.id; };

test('bird event menus use canonical names and one physical-card global contracts', t => {
  const f = fixture(t); f.play(); const a = song(f), b = song(f), z = song(f, 'zapdos-punishment'); const entries = f.view(f.leader).self.battle.events; assert.equal(entries.length, 2); assert.match(describe(f, 'moltres-trial').name.en, /Moltres/); assert.match(describe(f, 'zapdos-punishment').name.en, /Zapdos/); assert.equal(describe(f, 'moltres-trial').canUse, true); assert.equal(describe(f, 'zapdos-punishment').canUse, true); assert.ok(entries.every(entry => entry.description.en && entry.description.zh)); for (const id of [a, b, z]) assert.equal(countCard(f.room(), id), 1);
});

test('Moltres covers all other live active seats in next-trainer-first order including distant targets', t => {
  const f = fixture(t, { count: 6 }); f.play(); const removed = f.byId(f.room().players[3].id); f.player(removed).eliminated = true; const spectator = f.store.join(f.owner.code, { nickname: 'Bird audience', spectator: true }), cardId = song(f), expected = liveOrder(f).filter(id => id !== f.leader.playerId); assert.deepEqual(describe(f, 'moltres-trial').targetIds, expected); use(f, cardId); const asked = []; while (f.room().pendingBattle) { assert.equal(f.room().pendingBattle.kind, 'event-command'); asked.push(f.room().pendingBattle.actorId); f.respond(); } assert.deepEqual(asked, expected); assert.equal(asked.includes(spectator.playerId), false); assert.equal(f.player(f.leader).active.damage, 0); for (const id of expected) assert.equal(f.player(f.byId(id)).active.damage, 2);
});

test('a nonleader Moltres user starts with the next live trainer and wraps around seating once', t => {
  const f = fixture(t, { count: 5 }); f.play(); const actor = f.byId(f.room().players[2].id); round(f, actor); const cardId = song(f, 'moltres-trial', actor), seats = liveOrder(f), index = seats.indexOf(actor.playerId), expected = [...seats.slice(index + 1), ...seats.slice(0, index)]; use(f, cardId, actor); const asked = []; while (f.room().pendingBattle) { asked.push(f.room().pendingBattle.actorId); f.respond(); } assert.deepEqual(asked, expected); assert.equal(f.player(actor).active.damage, 0);
});

test('Moltres asks an actual command response and keeps its physical event outside piles until the wave ends', t => {
  const f = fixture(t); f.play(); const cardId = song(f), actual = structuredClone(f.player(f.leader).hand[0]), total = allCards(f.room()).length; use(f, cardId); assert.equal(f.room().pendingBattle.kind, 'event-command'); assert.equal(f.room().pendingBattle.damage, 2); assert.deepEqual(f.room().resolution.externalSource, { kind: 'external-pokemon', name: { zh: '火焰鸟', en: 'Moltres' } }); assert.equal(f.room().resolution.sourceId, null); assert.equal(f.room().resolution.sourcePlayerId, null); assert.deepEqual(f.view(f.target).pendingBattle.source, f.room().resolution.externalSource); assert.equal(f.room().discardPile.some(card => card.id === cardId), false); f.respond(); assert.equal(f.room().discardPile.some(card => card.id === cardId), false); f.respond(); assert.deepEqual(f.room().discardPile.find(card => card.id === cardId), actual); assert.equal(allCards(f.room()).length, total); assert.equal(countCard(f.room(), cardId), 1);
});

test('playing any weather of actual command cancels only the responding Moltres target', t => {
  for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) { const f = fixture(t); f.play(); const cardId = song(f), reply = f.supply(f.target, 'command', weather); use(f, cardId); f.respond('command', { cardId: reply }); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); assert.equal(f.room().discardPile.filter(card => card.id === reply).length, 1); f.respond(); assert.equal(f.player(f.third).active.damage, 2); assert.equal(countCard(f.room(), reply), 1); }
});

test('Moltres rejects Dodge, weather substitutes, virtual Justified, invented cards and response extras atomically', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'growlithe'); const eventId = song(f), dodge = f.supply(f.target, 'dodge'), weatherCard = f.supply(f.target, 'event', 'rain'), command = f.supply(f.target); use(f, eventId); for (const payload of [{ choice: 'dodge', cardId: dodge }, { choice: 'trait' }, { choice: 'command', cardId: dodge }, { choice: 'command', cardId: weatherCard }, { choice: 'command', cardId: 'invented' }, { choice: 'pass', cardId: command }, { choice: 'command', cardId: command, effect: 'attack' }, { choice: 'command', cardId: command, targetId: f.leader.playerId }]) rejectsAtomically(f, () => f.respond(payload.choice, Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'choice')))); assert.equal(f.player(f.target).hand.length, 3);
});

test('Moltres played command is not command use and bypasses Paralysis weather and used-move locks', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'magikarp', 2, { status: 'paralysis', reinforcements: ['power', 'power'] }); Object.assign(f.room().turn, { commandCreatureId: f.player(f.third).active.instanceId, usedMoves: ['already-used'], movesBlocked: true }); const cardId = song(f), response = f.supply(f.target, 'command', 'rain'), before = structuredClone(f.room().turn), pile = f.room().drawPile.length; use(f, cardId); f.respond('command', { cardId: response }); assert.deepEqual(f.room().turn, before); assert.deepEqual(f.player(f.target).active.reinforcements, ['power', 'power']); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().drawPile.length, pile); f.drain();
});

test('external Moltres damage never borrows the event users Blaze, Guts, Burn, Moxie or Power', t => {
  for (const [family, level, extra] of [['charmander', 1, { hpBonus: 0, damage: 2, status: 'burn' }], ['machop', 2, { status: 'burn' }], ['magikarp', 2, {}]]) { const f = fixture(t); f.play(family, level); Object.assign(f.player(f.leader).active, extra, { reinforcements: ['power', 'power', 'power'] }); const before = structuredClone(f.player(f.leader).active), pile = f.room().drawPile.length; use(f, song(f)); f.drain(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.third).active.damage, 2); assert.deepEqual(f.player(f.leader).active, before); assert.equal(f.room().drawPile.length, pile); }
});

test('Moltres does not invoke command targeting Pressure, Cute Charm or the Early Bird named immunity', t => {
  const f = fixture(t, { count: 4 }); f.play(); const others = liveOrder(f).filter(id => id !== f.leader.playerId).map(f.byId); f.seed(others[0], 'aerodactyl'); f.supply(others[0]); f.seed(others[1], 'clefairy'); f.supply(others[1]); f.seed(others[2], 'kangaskhan'); use(f, song(f)); while (f.room().pendingBattle) { assert.equal(f.room().pendingBattle.kind, 'event-command'); f.respond(); } for (const who of others) assert.equal(f.player(who).active.damage, 2);
});

test('Defense caps Moltres and stays until whole-event cleanup rather than disappearing after its first target', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.reinforcements = ['defense']; use(f, song(f)); f.respond(); assert.equal(f.player(f.target).active.damage, 1); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); f.respond(); assert.deepEqual(f.player(f.target).active.reinforcements, []);
});

test('Moltres receiving Marvel Scale and Shed Skin use shared private choices without source retaliation', t => {
  for (const family of ['dratini', 'caterpie']) { const f = fixture(t); f.play(); f.seed(f.target, family, 2, { status: family === 'dratini' ? 'burn' : null }); const fees = [f.supply(f.target), f.supply(f.target)]; use(f, song(f)); f.respond(); assert.equal(f.room().pendingBattle.kind, family === 'dratini' ? 'scales' : 'shed-skin'); if (family === 'dratini') f.respond('trait'); else f.respond('shed', { cardIds: fees }); assert.equal(f.player(f.target).active.damage, family === 'dratini' ? 1 : 0); f.drain(); assert.equal(f.player(f.leader).active.damage, 0); }
});

test('Moltres still triggers Water Absorb after damage and then continues to the next target', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'lapras'); f.judgments('rain'); use(f, song(f)); f.respond(); assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.room().pendingBattle.kind, 'event-command'); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); f.respond(); assert.equal(f.player(f.third).active.damage, 2);
});

test('Battle Armor gains Defense from external Moltres but cleans the marker at the end of that actual card', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'cubone'); const fee = f.supply(f.target), cardId = song(f); use(f, cardId); f.respond(); assert.equal(f.room().pendingBattle.kind, 'battle-armor'); f.respond('armor', { cardId: fee }); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); f.respond(); assert.deepEqual(f.player(f.target).active.reinforcements, []); assert.equal(f.player(f.target).active.damage, 2); assert.equal(countCard(f.room(), cardId), 1);
});

test('Synchronize claims the actual Moltres event once while later targets keep resolving', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'abra'); f.seed(f.third, 'abra'); const cardId = song(f), actual = structuredClone(f.player(f.leader).hand[0]); use(f, cardId); f.respond(); assert.equal(f.room().pendingBattle.kind, 'synchronize'); f.respond('trait'); assert.deepEqual(f.player(f.target).hand, [actual]); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); f.respond(); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.third).active.damage, 2); assert.equal(f.player(f.third).hand.length, 0); assert.equal(f.room().discardPile.some(card => card.id === cardId), false); assert.equal(countCard(f.room(), cardId), 1);
});

test('Oblivious after external Moltres protects its original active from a later event this global turn', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'slowpoke'); const a = song(f), b = song(f); use(f, a); f.drain(); assert.ok(f.room().turn.damageImmunityIds.includes(f.player(f.target).active.instanceId)); use(f, b); f.drain(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.third).active.damage, 4);
});

test('spectator null actives never become external source owners for Static, Poison Point or Helmet', t => {
  const f = fixture(t, { count: 5 }); f.play(); const others = liveOrder(f).filter(id => id !== f.leader.playerId).map(f.byId); f.seed(others[0], 'pikachu'); f.helmet(others[0]); f.seed(others[1], 'nidoran-m'); f.seed(others[2], 'gastly', 3); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }), before = structuredClone(f.player(f.leader).active); use(f, song(f)); f.drain(); assert.deepEqual(f.player(f.leader).active, before); assert.equal(f.player(observer).active, null); for (const who of others) assert.equal(f.player(who).active.damage, 2); assert.equal(f.room().pendingBattle, null);
});

test('Potion rescues a Moltres target before the next original target receives its response', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'squirtle', 1, { hpBonus: 0, damage: 2 }); const potion = rescuePotion(f), eventId = song(f); use(f, eventId); f.respond(); assert.equal(f.room().pendingBattle.kind, 'rescue'); f.respond('potion', { cardId: potion }); assert.equal(f.player(f.target).active.defeated, false); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); f.respond(); assert.equal(f.player(f.third).active.damage, 2); assert.equal(countCard(f.room(), potion), 1);
});

test('formal Moltres defeat gives no event-user reward and does not hit the incoming reserve', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'squirtle', 1, { hpBonus: 0, damage: 2 }); const incoming = f.player(f.target).reserve.instanceId, before = f.room().drawPile.length; use(f, song(f)); f.drain(); assert.equal(f.player(f.target).active.instanceId, incoming); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(f.room().drawPile.length, before);
});

test('immediate victory during Moltres stops its remaining queue and cleans the physical card once', t => {
  const f = fixture(t, { count: 4 }); f.play(); const rest = liveOrder(f).filter(id => id !== f.leader.playerId).map(f.byId); f.player(rest[0]).role = 'rocket'; f.player(rest[1]).role = 'gym'; f.player(rest[2]).role = 'challenger'; f.player(rest[2]).eliminated = true; f.seed(rest[0], 'squirtle', 1, { hpBonus: 0, damage: 2 }); f.player(rest[0]).reserve.defeated = true; const cardId = song(f); use(f, cardId); f.drain(); assert.equal(f.room().status, 'finished'); assert.equal(f.player(rest[1]).active.damage, 0); assert.equal(f.room().resolution, null); assert.equal(f.room().pendingBattle, null); assert.equal(countCard(f.room(), cardId), 1);
});

test('Moltres pins current and queued target instances and rejects or skips replacement actives', t => {
  const f = fixture(t); f.play(); use(f, song(f)); const original = f.player(f.target).active; f.player(f.target).active = f.player(f.target).reserve; f.player(f.target).reserve = original; rejectsAtomically(f, () => f.respond(), 'STALE_DECISION'); const g = fixture(t); g.play(); use(g, song(g)); const old = g.player(g.third).active; g.player(g.third).active = g.player(g.third).reserve; g.player(g.third).reserve = old; g.respond(); assert.equal(g.room().pendingBattle, null); assert.equal(g.player(g.third).active.damage, 0);
});

test('Moltres command response enforces target actor, decision freshness and exact retry safety', t => {
  const f = fixture(t); f.play(); const cardId = song(f), response = f.supply(f.target), foreign = f.supply(f.third); use(f, cardId); const pending = f.room().pendingBattle; rejectsAtomically(f, () => f.act(f.third, 'respondBattle', { decisionId: pending.id, choice: 'command', cardId: foreign }), 'NOT_YOUR_DECISION'); rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: 'old', choice: 'command', cardId: response }), 'STALE_DECISION'); const request = f.input('respondBattle', { decisionId: pending.id, choice: 'command', cardId: response }); f.store.action(f.owner.code, f.target.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.target.token, request); assert.deepEqual(f.room(), once); assert.equal(countCard(f.room(), response), 1); assert.equal(f.player(f.target).active.damage, 0); f.drain();
});

test('Moltres optional response timeout passes one target and opens a fresh next response clock', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play(); use(f, song(f)); const id = f.room().pendingBattle.id; f.advance(5000); const view = f.view(f.leader); assert.equal(f.player(f.target).active.damage, 2); assert.equal(view.pendingBattle.kind, 'event-command'); assert.notEqual(view.pendingBattle.id, id); assert.equal(view.pendingBattle.actorId, f.third.playerId); assert.equal(view.pendingBattle.clock.remainingMs, 5000); assert.equal(view.turn.clock.remainingMs, 60000);
});

test('Moltres never exposes private command availability, actual event IDs or internal instance queues', t => {
  const f = fixture(t); f.play(); const cardId = song(f), reply = f.supply(f.target), hidden = f.player(f.target).hand[0].privateMarker, observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); use(f, cardId); for (const who of [...f.seats, observer]) { const view = f.view(who), publicPending = JSON.stringify(view.pendingBattle); assert.equal(view.resolution, undefined); assert.equal(publicPending.includes(reply), false); assert.equal(publicPending.includes(hidden), false); assert.equal(publicPending.includes(f.player(f.target).active.instanceId), false); assert.equal(JSON.stringify(view).includes(cardId), false); } const before = structuredClone(f.view(observer).pendingBattle); f.player(f.target).hand = []; assert.deepEqual(f.view(observer).pendingBattle, before);
});

test('Zapdos targets all live original actives next-trainer first and self last', t => {
  const f = fixture(t, { count: 5 }); f.play('vulpix'); const removed = f.byId(f.room().players[2].id); f.player(removed).eliminated = true; const cardId = song(f, 'zapdos-punishment'), expected = [...liveOrder(f).slice(1), f.leader.playerId]; assert.deepEqual(describe(f, 'zapdos-punishment').targetIds, expected); f.judgments(...expected.map(() => 'clear')); use(f, cardId); const judges = []; while (f.room().pendingBattle) { assert.equal(f.room().pendingBattle.kind, 'judgment'); judges.push(f.room().pendingBattle.targetId); f.respond(); } assert.deepEqual(judges, expected); assert.equal(f.room().resolution, null);
});

test('Zapdos nonleader use wraps in action order with its user still last', t => {
  const f = fixture(t, { count: 5 }); f.play(); const actor = f.byId(f.room().players[2].id); round(f, actor); f.seed(actor, 'vulpix'); const cardId = song(f, 'zapdos-punishment', actor), seats = liveOrder(f), index = seats.indexOf(actor.playerId), expected = [...seats.slice(index + 1), ...seats.slice(0, index), actor.playerId]; assert.deepEqual(f.view(actor).self.battle.events.find(event => event.eventType === 'zapdos-punishment').targetIds, expected); f.judgments(...expected.map(() => 'clear')); use(f, cardId, actor); const judges = []; while (f.room().pendingBattle) { judges.push(f.room().pendingBattle.targetId); f.respond(); } assert.deepEqual(judges, expected);
});

test('only a real thunderstorm Zapdos judgment deals damage, using each original target level', t => {
  for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) { const f = fixture(t); f.play('squirtle', 3); f.seed(f.target, 'squirtle', 1); f.seed(f.third, 'squirtle', 2); f.judgments(weather, weather, weather); const cardId = song(f, 'zapdos-punishment'); use(f, cardId); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.target).active.damage, weather === 'thunderstorm' ? 1 : 0); assert.equal(f.player(f.third).active.damage, weather === 'thunderstorm' ? 2 : 0); assert.equal(f.player(f.leader).active.damage, weather === 'thunderstorm' ? 3 : 0); assert.equal(countCard(f.room(), cardId), 1); }
});

test('Zapdos cannot recycle its resolving event as an empty-deck judgment or fabricate a result', t => {
  const f = fixture(t); f.play(); f.room().drawPile = []; f.room().discardPile = []; const cardId = song(f, 'zapdos-punishment'); use(f, cardId); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null); assert.equal(f.room().drawPile.length, 0); assert.equal(f.room().discardPile.filter(card => card.id === cardId).length, 1); for (const who of f.seats) assert.equal(f.player(who).active.damage, 0);
});

test('Drought can replace thunderstorm before Zapdos damage is decided and gains its displaced card', t => {
  const f = fixture(t); f.play('vulpix'); const replacement = f.supply(f.leader, 'event', 'clear'), judged = f.judgments('thunderstorm', 'clear', 'clear')[0], cardId = song(f, 'zapdos-punishment'); use(f, cardId); assert.equal(f.room().pendingBattle.targetId, f.target.playerId); assert.equal(f.player(f.target).active.damage, 0); f.respond('replace', { cardId: replacement }); assert.equal(f.player(f.target).active.damage, 0); assert.ok(f.player(f.leader).hand.some(card => card.id === judged.id)); f.drain(); assert.equal(f.room().pendingBattle, null); assert.equal(countCard(f.room(), cardId), 1); assert.equal(countCard(f.room(), replacement), 1);
});

test('Zapdos uses the pinned target current level after final judgment rather than the event user level', t => {
  const f = fixture(t); f.play('vulpix', 1); f.seed(f.target, 'squirtle', 1); f.judgments('thunderstorm', 'clear', 'clear'); use(f, song(f, 'zapdos-punishment')); f.player(f.target).active.level = 3; f.respond(); assert.equal(f.player(f.target).active.damage, 3); f.drain(); assert.equal(f.player(f.leader).active.damage, 0);
});

test('Zapdos skips a replaced current judgment target and a replaced queued original without striking the reserve', t => {
  for (const changed of ['current', 'future']) { const f = fixture(t); f.play('vulpix'); f.judgments('thunderstorm', 'thunderstorm', 'clear'); use(f, song(f, 'zapdos-punishment')); const who = changed === 'current' ? f.target : f.third, old = f.player(who).active, incoming = f.player(who).reserve; f.player(who).active = incoming; f.player(who).reserve = old; f.drain(); assert.equal(f.player(who).active.damage, 0); assert.equal(f.player(who).reserve.damage, 0); assert.equal(f.room().resolution, null); }
});

test('Zapdos has no Dodge or command response and preserves command-user, move and marker allowances', t => {
  const f = fixture(t); f.play('magikarp', 2); f.player(f.leader).active.reinforcements = ['power', 'speed']; f.player(f.leader).active.status = 'burn'; f.supply(f.target, 'dodge'); f.supply(f.target, 'command'); const before = structuredClone(f.room().turn); f.judgments('thunderstorm', 'thunderstorm', 'clear'); use(f, song(f, 'zapdos-punishment')); assert.equal(f.room().pendingBattle, null); assert.deepEqual(f.room().turn, before); assert.deepEqual(f.player(f.leader).active.reinforcements, ['power', 'speed']); assert.equal(f.player(f.target).hand.length, 2); assert.equal(f.player(f.target).active.damage, 1);
});

test('Zapdos uses receiving Defense and Multiscale against level-based external damage', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'dratini', 3); f.seed(f.third, 'squirtle', 3, { reinforcements: ['defense'] }); f.judgments('thunderstorm', 'thunderstorm', 'clear'); use(f, song(f, 'zapdos-punishment')); assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.player(f.third).active.damage, 1); assert.deepEqual(f.player(f.third).active.reinforcements, []);
});

test('positive Zapdos event damage still performs Water Absorb before the next trainer judgment', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'lapras', 1); f.judgments('thunderstorm', 'rain', 'clear', 'clear'); use(f, song(f, 'zapdos-punishment')); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.third).active.damage, 0); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.room().resolution, null);
});

test('Synchronize may claim Zapdos once and its remaining per-target judgments continue after transfer', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'abra', 2); f.seed(f.third, 'abra', 3); f.judgments('thunderstorm', 'thunderstorm', 'clear'); const cardId = song(f, 'zapdos-punishment'); use(f, cardId); assert.equal(f.room().pendingBattle.kind, 'synchronize'); assert.equal(f.player(f.target).active.damage, 2); assert.deepEqual(f.room().resolution.externalSource, { kind: 'external-pokemon', name: { zh: '闪电鸟', en: 'Zapdos' } }); f.respond('trait'); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.third).active.damage, 3); assert.equal(f.player(f.target).hand.filter(card => card.id === cardId).length, 1); assert.equal(f.player(f.third).hand.length, 0); assert.equal(f.room().discardPile.some(card => card.id === cardId), false); assert.equal(countCard(f.room(), cardId), 1);
});

test('Zapdos can hit its own active last and lets that active Synchronize claim the original physical event', t => {
  const f = fixture(t); f.play('abra', 2); f.judgments('clear', 'clear', 'thunderstorm'); const cardId = song(f, 'zapdos-punishment'); use(f, cardId); assert.equal(f.room().pendingBattle.kind, 'synchronize'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); assert.equal(f.player(f.leader).active.damage, 2); f.respond('trait'); assert.ok(f.player(f.leader).hand.some(card => card.id === cardId)); assert.equal(countCard(f.room(), cardId), 1); assert.equal(f.room().resolution, null);
});

test('Gas suppresses receiving bird-event traits while preserving each printed event and its judgments', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'lapras'); f.room().turn.suppressedTraitPlayerIds = [f.target.playerId]; f.judgments('thunderstorm', 'clear', 'clear'); const before = f.room().drawPile.length; use(f, song(f, 'zapdos-punishment')); assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.room().drawPile.length, before - 3); const m = song(f); use(f, m); f.drain(); assert.equal(f.player(f.target).active.damage, 3);
});

test('a level-three Zapdos target requires repeated Potion healing through negative HP before its next judgment target', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'charmander', 3, { hpBonus: 0, damage: 3 }); const a = rescuePotion(f), b = rescuePotion(f); f.judgments('thunderstorm', 'clear', 'clear'); const cardId = song(f, 'zapdos-punishment'); use(f, cardId); assert.equal(f.room().pendingBattle.kind, 'rescue'); const old = f.room().pendingBattle.id; f.respond('potion', { cardId: a }); assert.equal(f.player(f.target).active.damage, 4); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); assert.notEqual(f.room().pendingBattle.id, old); f.respond('potion', { cardId: b }); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.defeated, false); assert.equal(f.room().resolution, null); assert.equal(countCard(f.room(), cardId), 1);
});

test('both bird event uses enforce card-only action shape and current trainer Play authority', t => {
  for (const type of ['moltres-trial', 'zapdos-punishment']) { const f = fixture(t); f.play(); const cardId = song(f, type), foreign = song(f, type, f.target); for (const extra of [{ targetId: f.target.playerId }, { targetIds: [] }, { effect: 'damage' }, { slot: 'active' }, { level: 3 }]) rejectsAtomically(f, () => f.act(f.leader, 'useEvent', { cardId, ...extra })); rejectsAtomically(f, () => use(f, foreign, f.target), 'NOT_YOUR_TURN'); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }), observed = song(f, type, observer); rejectsAtomically(f, () => use(f, observed, observer), 'SPECTATOR_ONLY_VIEW'); f.room().turn.phase = 'discard'; rejectsAtomically(f, () => use(f, cardId)); }
});

test('closing votes block command responses and pending Zapdos judgment choices without spending more cards', t => {
  for (const type of ['moltres-trial', 'zapdos-punishment']) { const f = fixture(t); f.play(type === 'zapdos-punishment' ? 'vulpix' : 'squirtle'); f.judgments('clear', 'clear', 'clear'); use(f, song(f, type)); assert.ok(f.room().pendingBattle); f.act(f.owner, 'requestEndGame'); rejectsAtomically(f, () => f.respond(), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); f.drain(); assert.equal(f.room().pendingBattle, null); }
});

test('restart preserves a Moltres response clock and one exact actual command response', t => {
  const f = fixture(t, { responseSeconds: 5 }); f.play(); const reply = f.supply(f.target), cardId = song(f); use(f, cardId); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); assert.equal(restored.rooms.get(f.owner.code).pendingBattle.clock.pausedReason, 'disconnected'); const view = restored.view(f.owner.code, f.target.token).view; assert.equal(view.pendingBattle.kind, 'event-command'); assert.equal(view.pendingBattle.clock.pausedReason, null); assert.equal(view.pendingBattle.clock.remainingMs, 5000); const request = { id: 'restored-bird-command', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'command', cardId: reply }; restored.action(f.owner.code, f.target.token, request); const once = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.target.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), once); assert.equal(once.players.find(player => player.id === f.target.playerId).active.damage, 0); assert.equal(countCard(once, reply), 1); assert.equal(countCard(once, cardId), 1);
});

test('restart during Zapdos Drought retains the target, final-weather continuation and remaining self-last queue', t => {
  const f = fixture(t); f.play('vulpix'); const replacement = f.supply(f.leader, 'event', 'clear'); f.judgments('thunderstorm', 'clear', 'clear'); const cardId = song(f, 'zapdos-punishment'); use(f, cardId); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.leader.token).view; assert.equal(view.pendingBattle.targetId, f.target.playerId); const request = { id: 'restored-zapdos-weather', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'replace', cardId: replacement }; restored.action(f.owner.code, f.leader.token, request); const once = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.leader.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), once); assert.equal(once.players.find(player => player.id === f.target.playerId).active.damage, 0); assert.equal(countCard(once, cardId), 1); assert.equal(once.pendingBattle.targetId, f.third.playerId);
});

test('using a bird event as a weather move payment never executes its global event', t => {
  for (const type of ['moltres-trial', 'zapdos-punishment']) { const f = fixture(t); f.play('jynx', 2); const cardId = song(f, type); f.attack({ cardId, moveIndex: 1 }); assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond(); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.third).active.damage, 0); assert.equal(f.room().pendingBattle, null); assert.equal(countCard(f.room(), cardId), 1); }
});
