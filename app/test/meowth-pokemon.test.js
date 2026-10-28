import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore, CONNECTED_MS } from '../server/store.js';

import { gainBattleCards, drawBattleCards } from '../server/combat.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));
function fixture(t, { count = 3, turnSeconds = 0, responseSeconds = 0 } = {}) {
  const root = fileURLToPath(new URL('../.data/', import.meta.url));
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'meowth-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `meowth-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates; act(who, 'selectPokemon', { activeId: candidates[0], reserveId: candidates[1] }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-meowth-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private Meowth card ${serial}` } });
  room().drawPile = Array.from({ length: 48 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const judgments = (...weather) => { for (const value of [...weather].reverse()) room().drawPile.push(makeCard('judgment-fixture', value)); };
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id), third = seats.find(who => who !== leader && who !== target);
  const play = (family = 'meowth', level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, family, level); };
  const attack = (payload = {}, who = leader) => act(who, 'attack', { cardId: payload.cardId ?? supply(who), targetIds: [target.playerId], ...payload });
  const respond = (choice = 'pass', payload = {}) => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload }); };
  const drain = () => { for (let i = 0; room().pendingBattle && i < 50; i++) { const pending = room().pendingBattle; respond(pending.kind === 'effects' ? 'effect' : 'pass', pending.kind === 'effects' ? { effect: pending.effects[0] } : {}); } assert.equal(room().pendingBattle, null); };
  const startPoison = (who = target) => { player(who).active.status = 'poison'; store.startTurn(room(), who.playerId, 2); };
  return { store, dir, now, owner, seats, leader, target, third, room, player, byId, view, input, act, seed, makeCard, supply, judgments, play, attack, respond, drain, startPoison, advance: ms => { time += ms; } };
}
function rejectsAtomically(f, action, code) { const before = structuredClone(f.room()); assert.throws(action, error => code === undefined || error.code === code); assert.deepEqual(f.room(), before); }

const ids = cards => cards.map(card => card.id);
const reserveCards = f => f.room().resolution.distributionCards;
const allocations = (f, recipients = [f.leader]) => reserveCards(f).map((card, index) => ({ index, recipientId: recipients[index % recipients.length].playerId }));
const distribute = (f, recipients) => f.respond('distribute', { allocations: allocations(f, recipients) });
function payDay(f, { level = 2, target = f.target } = {}) {
  f.play('meowth', level); f.attack({ targetIds: [target.playerId] }); f.respond();
  assert.equal(f.room().pendingBattle.kind, 'pay-day');
}
function inspectPayDay(f, options) { payDay(f, options); f.respond('trait'); assert.equal(f.room().pendingBattle.kind, 'distribute'); }
const gains = (f, who, cards, options) => gainBattleCards(f.room(), f.player(who), cards, options);
const usedPickup = (f, who) => f.room().turn.pickupUsedIds.includes(f.player(who).active.instanceId);
const zoneCards = room => [...room.drawPile, ...room.discardPile, ...room.players.flatMap(p => [...p.hand, ...(p.exiledCards || [])]), ...[room.resolution, ...(room.resolutionStack || [])].flatMap(r => [...(r?.distributionCards || []), ...(r?.card && !r.cardClaimedBy ? [r.card] : [])]), ...(room.judgment?.card ? [room.judgment.card] : [])];

// Shared legal setup is followed by explicit seeds so random roles and roster
// candidates do not determine the reviewed face, private card or decision.
test('Meowth reviewed faces expose 3/3/4 HP, Protect and independent indexed Pay Day/Fake Out', t => {
  const faces = catalogue.entries.find(p => p.id === 'meowth').levels;
  assert.deepEqual(faces.map(p => p.hp), [3, 3, 4]);
  assert.deepEqual(faces.map(p => p.effectStatus), Array(3).fill('combat-preview'));
  for (const level of [1, 2, 3]) {
    const f = fixture(t); f.play('meowth', level); const legal = f.view(f.leader).self.battle;
    assert.equal(legal.canCommand, level > 1); assert.equal(legal.moves.length, level === 3 ? 2 : 1);
    assert.equal(legal.moves[0].canUse, true); assert.equal(legal.move.printedValue, level === 1 ? null : 2);
    if (level === 3) assert.equal(legal.moves[1].printedValue, 1);
  }
});

test('Protect discards either sunny weather of any kind before ordinary self defense and spends no Power or command', t => {
  for (const kind of ['event', 'command', 'dodge']) for (const weather of ['clear', 'intense-sun']) {
    const f = fixture(t); f.play(); f.player(f.leader).active.reinforcements = ['power']; const payment = f.supply(f.leader, kind, weather);
    f.attack({ cardId: payment, targetIds: [f.leader.playerId] }); assert.equal(f.room().pendingBattle.kind, 'defense');
    assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); assert.equal(f.player(f.leader).hand.some(c => c.id === payment), false);
    assert.equal(f.room().discardPile.filter(c => c.id === payment).length, 1); f.respond();
    assert.equal(f.player(f.leader).active.damage, 0); assert.deepEqual(f.player(f.leader).active.reinforcements, ['power', 'defense']);
    assert.equal(f.room().turn.commandCreatureId, null); assert.equal(f.room().resolution, null);
  }
});

test('Protect rejects foreign, forged, rainy payments, other targets and invalid indices atomically', t => {
  const f = fixture(t); f.play(); const good = f.supply(f.leader, 'event', 'clear'), rain = f.supply(f.leader, 'event', 'rain'), foreign = f.supply(f.target, 'event', 'clear');
  for (const cardId of [rain, foreign, 'forged']) rejectsAtomically(f, () => f.attack({ cardId, targetIds: [f.leader.playerId] }));
  rejectsAtomically(f, () => f.attack({ cardId: good }));
  for (const moveIndex of [-1, 1, 0.5, '0', null, false]) rejectsAtomically(f, () => f.attack({ cardId: good, targetIds: [f.leader.playerId], moveIndex }));
  rejectsAtomically(f, () => f.act(f.target, 'attack', { cardId: foreign, targetIds: [f.target.playerId] }));
});

test('Protect grants Defense only after pass, Dodge cancels it, and an existing marker is never duplicated', t => {
  for (const scenario of ['pass', 'dodge', 'existing']) {
    const f = fixture(t); f.play(); if (scenario === 'existing') f.player(f.leader).active.reinforcements = ['defense'];
    f.attack({ cardId: f.supply(f.leader, 'event', 'clear'), targetIds: [f.leader.playerId] });
    assert.deepEqual(f.player(f.leader).active.reinforcements, scenario === 'existing' ? ['defense'] : []);
    f.respond(scenario === 'dodge' ? 'dodge' : 'pass', scenario === 'dodge' ? { cardId: f.supply(f.leader, 'dodge') } : {});
    assert.deepEqual(f.player(f.leader).active.reinforcements, scenario === 'dodge' ? [] : ['defense']);
    assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.room().pendingBattle, null);
  }
});

test('Protect is once per move and cannot be used outside its trainer Play phase', t => {
  const f = fixture(t); f.play(); const use = () => f.attack({ cardId: f.supply(f.leader, 'event', 'clear'), targetIds: [f.leader.playerId] });
  use(); f.respond(); const payment = f.supply(f.leader, 'event', 'clear');
  rejectsAtomically(f, () => f.attack({ cardId: payment, targetIds: [f.leader.playerId] }));
  f.store.startTurn(f.room(), f.leader.playerId, 2); rejectsAtomically(f, () => f.attack({ cardId: payment, targetIds: [f.leader.playerId] }));
  while (f.room().turn.drawRemaining) f.act(f.leader, 'draw'); f.act(f.leader, 'finishPlay');
  rejectsAtomically(f, () => f.attack({ cardId: payment, targetIds: [f.leader.playerId] }));
});

test('Pickup is mandatory once per global turn, adds exactly one real card and cannot recurse on its own draw', t => {
  for (const level of [1, 2]) {
    const f = fixture(t); f.play('meowth', level); const first = f.makeCard(), second = f.makeCard(), top = f.room().drawPile.at(-1);
    const deck = f.room().drawPile.length; gains(f, f.leader, [first, second]);
    assert.deepEqual(ids(f.player(f.leader).hand), [first.id, second.id, top.id]); assert.equal(f.room().drawPile.length, deck - 1);
    assert.equal(usedPickup(f, f.leader), true); assert.equal(f.room().pendingBattle, null);
    const later = f.makeCard(); gains(f, f.leader, [later]); assert.equal(f.player(f.leader).hand.length, 4); assert.equal(f.room().drawPile.length, deck - 1);
  }
});

test('Pickup excludes the owner Draw phase but still triggers off turn while another trainer draws', t => {
  const f = fixture(t); f.seed(f.leader, 'meowth', 1); f.seed(f.target, 'meowth', 2);
  const deck = f.room().drawPile.length; f.act(f.leader, 'draw');
  assert.equal(f.player(f.leader).hand.length, 1); assert.equal(f.room().drawPile.length, deck - 1); assert.equal(usedPickup(f, f.leader), false);
  const gift = f.makeCard(); gains(f, f.target, [gift]); assert.equal(f.player(f.target).hand.length, 2); assert.equal(usedPickup(f, f.target), true);
  f.act(f.leader, 'draw'); assert.equal(f.player(f.leader).hand.length, 2); assert.equal(usedPickup(f, f.leader), false);
  gains(f, f.leader, [f.makeCard()]); assert.equal(f.player(f.leader).hand.length, 4); assert.equal(usedPickup(f, f.leader), true);
});

test('setup gains, no-turn gains and empty gain arrays do not spend Pickup or draw bonuses', t => {
  const f = fixture(t); f.play(); const deck = f.room().drawPile.length;
  gains(f, f.leader, []); gains(f, f.leader, [f.makeCard()], { reason: 'setup' });
  assert.equal(usedPickup(f, f.leader), false); const turn = f.room().turn; f.room().turn = null;
  gains(f, f.leader, [f.makeCard()]); f.room().turn = turn;
  assert.equal(f.player(f.leader).hand.length, 2); assert.equal(f.room().drawPile.length, deck); assert.equal(usedPickup(f, f.leader), false);
});

test('Pickup ignores reserve, defeated, eliminated, spectator and level-three Meowth', t => {
  for (const excluded of ['reserve', 'defeated', 'eliminated', 'spectator', 'level-three']) {
    const f = fixture(t); f.play('squirtle'); let who = f.target;
    if (excluded === 'spectator') { who = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); f.player(who).hand = []; f.player(who).active = { ...f.player(f.target).active, catalogueId: 'meowth', level: 1, instanceId: 'private-observer' }; }
    else if (excluded === 'reserve') f.player(who).reserve.catalogueId = 'meowth';
    else { f.seed(who, 'meowth', excluded === 'level-three' ? 3 : 1); if (excluded === 'defeated') f.player(who).active.defeated = true; if (excluded === 'eliminated') f.player(who).eliminated = true; }
    const deck = f.room().drawPile.length; gains(f, who, [f.makeCard()]); assert.equal(f.player(who).hand.length, 1, excluded); assert.equal(f.room().drawPile.length, deck, excluded);
  }
});

test('Pickup tracks the Pokemon instance through switching, gives a new instance its own use and resets next global turn', t => {
  const f = fixture(t); f.play(); gains(f, f.leader, [f.makeCard()]); const original = f.player(f.leader).active;
  f.act(f.leader, 'switchPokemon'); gains(f, f.leader, [f.makeCard()]); assert.equal(f.player(f.leader).hand.length, 3);
  [f.player(f.leader).active, f.player(f.leader).reserve] = [original, f.player(f.leader).active];
  gains(f, f.leader, [f.makeCard()]); assert.equal(f.player(f.leader).hand.length, 4);
  f.player(f.leader).active.instanceId = 'private-second-meowth'; gains(f, f.leader, [f.makeCard()]); assert.equal(f.player(f.leader).hand.length, 6);
  f.store.startTurn(f.room(), f.target.playerId, 2); assert.deepEqual(f.room().turn.pickupUsedIds, []);
  gains(f, f.leader, [f.makeCard()]); assert.equal(f.player(f.leader).hand.length, 8);
});

test('an exhausted Pickup bonus marks its use and logs zero without fake cards; a discard can supply the real bonus', t => {
  for (const recyclable of [false, true]) {
    const f = fixture(t); f.play(); f.room().drawPile = []; const real = f.makeCard(); f.room().discardPile = recyclable ? [real] : [];
    const log = f.room().log.length; const gained = f.makeCard(); assert.doesNotThrow(() => gains(f, f.leader, [gained]));
    assert.deepEqual(ids(f.player(f.leader).hand), recyclable ? [gained.id, real.id] : [gained.id]); assert.equal(usedPickup(f, f.leader), true);
    assert.ok(f.room().log.length > log); assert.equal(f.room().pendingBattle, null);
    assert.throws(() => drawBattleCards(f.room(), f.player(f.target)), error => error.code === 'DECK_EMPTY');
  }
});

test('Justified transfers actual cards to an off-turn Meowth and triggers one Pickup for the whole gift', t => {
  const f = fixture(t); f.play('growlithe'); f.seed(f.target, 'meowth', 2); const one = f.supply(f.leader, 'event'), two = f.supply(f.leader, 'dodge'); f.supply(f.leader);
  const top = f.room().drawPile.at(-1); f.act(f.leader, 'giveCards', { recipientId: f.target.playerId, cardIds: [one, two] });
  assert.deepEqual(ids(f.player(f.target).hand), [one, two, top.id]); assert.equal(usedPickup(f, f.target), true); assert.equal(f.room().pendingBattle, null);
});

test('a taken hand card passes through centralized Pickup gain processing', t => {
  const f = fixture(t); f.play('sandshrew', 3); const stolen = f.supply(f.target, 'event'); f.attack(); f.respond();
  assert.equal(f.room().pendingBattle.kind, 'hand'); f.seed(f.leader, 'meowth', 2); const top = f.room().drawPile.at(-1);
  f.respond('card', { handIndex: 0 }); assert.deepEqual(ids(f.player(f.leader).hand), [stolen, top.id]); assert.equal(usedPickup(f, f.leader), true);
});

test('central effect draws and gained judgment or Synchronize cards use the same nonrecursive Pickup contract', t => {
  for (const kind of ['draw', 'judgment', 'synchronize']) {
    const f = fixture(t); f.play('meowth', 2); const top = f.room().drawPile.at(-1), next = f.room().drawPile.at(-2);
    if (kind === 'draw') { drawBattleCards(f.room(), f.player(f.leader), 1, 'effect'); assert.deepEqual(ids(f.player(f.leader).hand), [top.id, next.id]); }
    else { const card = f.makeCard(kind); gains(f, f.leader, [card], { reason: 'effect' }); assert.deepEqual(ids(f.player(f.leader).hand), [card.id, top.id]); }
    assert.equal(usedPickup(f, f.leader), true); assert.equal(f.room().pendingBattle, null);
  }
});

test('an effect draw of two cards transfers the base batch before exactly one Pickup bonus', t => {
  for (const level of [1, 2]) for (const available of [2, 4]) {
    const f = fixture(t); f.play('meowth', level);
    const deck = Array.from({ length: available }, () => f.makeCard()), nextDraws = deck.slice().reverse();
    f.room().drawPile = deck.slice(); f.room().discardPile = [];
    drawBattleCards(f.room(), f.player(f.leader), 2, 'effect');
    const gained = Math.min(3, available);
    assert.deepEqual(ids(f.player(f.leader).hand), ids(nextDraws.slice(0, gained)));
    assert.equal(f.room().drawPile.length, available - gained); assert.equal(usedPickup(f, f.leader), true);
    assert.equal(f.room().pendingBattle, null);
    if (available === 4) { drawBattleCards(f.room(), f.player(f.leader), 1, 'effect'); assert.deepEqual(ids(f.player(f.leader).hand), ids(nextDraws)); }
    assert.deepEqual(ids(zoneCards(f.room())).sort(), ids(deck).sort());
  }
});
test('returning exiled cards at turn beginning triggers Pickup before the owner ordinary Draw phase', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'meowth', 1); const cards = [f.makeCard(), f.makeCard()], top = f.room().drawPile.at(-1);
  f.player(f.target).exiledCards = cards; f.store.startTurn(f.room(), f.target.playerId, 2);
  assert.deepEqual(ids(f.player(f.target).hand), [...ids(cards), top.id]); assert.deepEqual(f.player(f.target).exiledCards, []);
  assert.equal(f.room().turn.phase, 'draw'); assert.equal(f.room().turn.drawRemaining, 2); assert.equal(usedPickup(f, f.target), true);
  f.act(f.target, 'draw'); assert.equal(f.player(f.target).hand.length, 4);
});

test('Pay Day opens optional trait/pass after positive damage and before receiving Static', t => {
  for (const level of [2, 3]) for (const choice of ['trait', 'pass']) {
    const f = fixture(t); f.seed(f.target, 'pikachu'); payDay(f, { level }); const pending = f.room().pendingBattle;
    assert.equal(pending.actorId, f.leader.playerId); assert.equal(pending.canTrait, true); assert.equal(pending.trait, 'pay-day'); assert.equal(f.player(f.target).active.damage, 2);
    f.respond(choice); if (choice === 'trait') { assert.equal(f.room().pendingBattle.kind, 'distribute'); distribute(f); }
    assert.equal(f.room().pendingBattle.kind, 'static'); f.respond(); assert.equal(f.room().pendingBattle, null);
  }
});

test('Dodge, zero damage and damage immunity skip both Pay Day and its card reservation', t => {
  for (const level of [2, 3]) for (const prevention of ['dodge', 'zero', 'immunity']) {
    const f = fixture(t); f.play('meowth', level); const top = f.room().drawPile.at(-1).id;
    if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId];
    f.attack(); if (prevention === 'zero') f.room().resolution.baseDamage = 0;
    f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {});
    assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().drawPile.at(-1).id, top);
  }
});

test('Pay Day waits until rescue and forced replacement have finished before offering its source effect', t => {
  const f = fixture(t); f.play('meowth', 2); f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); const incoming = f.player(f.target).reserve.instanceId;
  f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'rescue');
  while (f.room().pendingBattle.kind === 'rescue') f.respond();
  assert.equal(f.player(f.target).active.instanceId, incoming); assert.equal(f.room().pendingBattle.kind, 'pay-day'); f.respond(); assert.equal(f.room().pendingBattle, null);
});

test('accepted Pay Day reserves two real top cards outside the deck and distributes each once, including both to self', t => {
  for (const same of [false, true]) {
    const f = fixture(t); const original = f.room().drawPile.slice(-4).reverse(); inspectPayDay(f, { level: 3 });
    assert.deepEqual(ids(reserveCards(f)), ids(original.slice(2, 4))); const total = ids(zoneCards(f.room())).sort(); const reserved = [...reserveCards(f)];
    for (const card of reserved) assert.equal(f.room().drawPile.some(c => c.id === card.id), false);
    distribute(f, same ? [f.leader] : [f.target, f.third]);
    assert.deepEqual(ids(zoneCards(f.room())).sort(), total); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null);
    assert.equal(f.player(same ? f.leader : f.target).hand.some(c => c.id === reserved[0].id), true);
    assert.equal(f.player(same ? f.leader : f.third).hand.some(c => c.id === reserved[1].id), true);
  }
});

test('distribution views expose only indexed card faces to the source and public counts and living recipient IDs to everyone', t => {
  const f = fixture(t, { count: 4 }); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); const eliminated = f.seats.find(who => who !== f.leader && who !== f.target && who !== f.third); f.player(eliminated).eliminated = true;
  inspectPayDay(f); const cards = reserveCards(f), recipients = f.room().players.filter(p => !p.spectator && !p.eliminated).map(p => p.id);
  for (const who of [...f.seats, observer]) {
    const pending = f.view(who).pendingBattle; assert.equal(pending.kind, 'distribute'); assert.equal(pending.choiceCount, 2); assert.deepEqual(pending.recipientIds, recipients);
    if (who === f.leader) { assert.equal(pending.cards.length, 2); for (const [index, card] of pending.cards.entries()) { assert.deepEqual(Object.keys(card).sort(), ['index', 'kind', 'name', 'weather']); assert.equal(card.index, index); } }
    else assert.equal(pending.cards, undefined);
    const serialized = JSON.stringify(f.view(who)); for (const card of cards) assert.equal(serialized.includes(card.id), false);
    assert.equal(serialized.includes('privateMarker'), false); assert.equal(f.view(who).resolution, undefined);
  }
});

test('all reserved cards transfer before Pickup bonuses and multiple recipients draw in current-turn-first seat order', t => {
  const f = fixture(t, { count: 4 }); inspectPayDay(f, { level: 2 }); f.seed(f.target, 'meowth', 1); const reserved = [...reserveCards(f)], bonus = f.room().drawPile.slice(-2).reverse();
  // Submit the target first: seat order, not client allocation order, determines the bonus draw order.
  f.respond('distribute', { allocations: [{ index: 0, recipientId: f.target.playerId }, { index: 1, recipientId: f.leader.playerId }] });
  assert.deepEqual(ids(f.player(f.leader).hand), [reserved[1].id, bonus[0].id]); assert.deepEqual(ids(f.player(f.target).hand), [reserved[0].id, bonus[1].id]);
  assert.equal(usedPickup(f, f.leader), true); assert.equal(usedPickup(f, f.target), true); assert.equal(f.room().pendingBattle, null);
});

test('short Pay Day reservations use only available real cards and recycle below the remaining top card', t => {
  for (const count of [0, 1, 2]) {
    const f = fixture(t); payDay(f, { level: 3 }); const cards = Array.from({ length: count }, () => f.makeCard()); f.room().drawPile = cards.slice(); f.room().discardPile = [];
    f.respond('trait');
    if (!count) { assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null); }
    else { assert.equal(reserveCards(f).length, count); assert.deepEqual(ids(reserveCards(f)), ids(cards.slice().reverse())); distribute(f, [f.target]); assert.equal(f.player(f.target).hand.length, count); }
  }
  const f = fixture(t); payDay(f, { level: 3 }); const top = f.makeCard(), recycled = f.makeCard(); f.room().drawPile = [top]; f.room().discardPile = [recycled]; f.respond('trait');
  assert.deepEqual(ids(reserveCards(f)), [top.id, recycled.id]); distribute(f, [f.target]);
});

test('distribution rejects malformed, missing, duplicate, unsafe and foreign allocations without mutation', t => {
  const f = fixture(t); inspectPayDay(f); const recipientId = f.target.playerId, valid = allocations(f), id = f.room().pendingBattle.id;
  rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: id, choice: 'distribute', allocations: valid }), 'NOT_YOUR_DECISION');
  rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: 'stale', choice: 'distribute', allocations: valid }), 'STALE_DECISION');
  for (const value of [undefined, null, {}, [], [valid[0]], [...valid, valid[0]], [{ index: 0, recipientId }, { index: 0, recipientId }], [{ index: 0, recipientId }, { index: 2, recipientId }], [{ index: '0', recipientId }, valid[1]], [{ index: -1, recipientId }, valid[1]], [{ index: 0.5, recipientId }, valid[1]], [{ index: Number.MAX_SAFE_INTEGER + 1, recipientId }, valid[1]], [{ index: 0, recipientId: 'forged' }, valid[1]], [{ index: 0, recipientId, extra: true }, valid[1]], [null, valid[1]]]) rejectsAtomically(f, () => f.respond('distribute', { allocations: value }));
  for (const payload of [{ choice: 'pass' }, { choice: 'trait' }, { choice: 'distribute', allocations: valid, cardId: 'forged' }, { choice: 'distribute', allocations: valid, handIndex: 0 }, { choice: 'distribute', allocations: valid, order: [] }, { choice: 'distribute', allocations: valid, targetIds: [] }]) rejectsAtomically(f, () => f.respond(payload.choice, payload));
  distribute(f); assert.equal(f.room().pendingBattle, null);
});

test('Pay Day accepts only strict trait/pass and allocation payloads are forbidden in other response kinds', t => {
  const f = fixture(t); f.play('meowth', 3); f.attack(); const allocation = [{ index: 0, recipientId: f.leader.playerId }];
  rejectsAtomically(f, () => f.respond('pass', { allocations: allocation })); f.respond();
  for (const payload of [{ choice: 'distribute', allocations: allocation }, { choice: 'trait', allocations: [] }, { choice: 'trait', cardId: 'forged' }, { choice: 'trait', handIndex: 0 }, { choice: 'trait', damage: 99 }, { choice: 'trait', order: [] }, { choice: 'trait', targetIds: [] }, { choice: 'pass', allocations: [] }]) rejectsAtomically(f, () => f.respond(payload.choice, payload));
  f.respond(); assert.equal(f.room().resolution, null);
});

test('saved Pay Day and private distribution survive restart; exact retries transfer the reserved cards once', t => {
  for (const stage of ['pay-day', 'distribute']) {
    const f = fixture(t); payDay(f); if (stage === 'distribute') f.respond('trait'); f.store.persist(f.room());
    const pending = structuredClone(f.room().pendingBattle), reserved = stage === 'distribute' ? [...reserveCards(f)] : null;
    const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); const recovered = restored.view(f.owner.code, f.leader.token).view;
    assert.equal(recovered.pendingBattle.id, pending.id); if (reserved) assert.deepEqual(restored.rooms.get(f.owner.code).resolution.distributionCards, reserved);
    const request = { id: `restored-meowth-${stage}`, revision: recovered.revision, type: 'respondBattle', decisionId: pending.id, choice: stage === 'distribute' ? 'distribute' : 'trait', ...(reserved ? { allocations: reserved.map((card, index) => ({ index, recipientId: f.target.playerId })) } : {}) };
    restored.action(f.owner.code, f.leader.token, request); const committed = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.leader.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), committed);
    if (reserved) { for (const card of reserved) assert.equal(committed.players.find(p => p.id === f.target.playerId).hand.filter(c => c.id === card.id).length, 1); assert.equal(committed.pendingBattle, null); }
    else assert.equal(committed.pendingBattle.kind, 'distribute');
  }
});

test('Pay Day optionally expires as pass, mandatory distribution waits and vote pause spends no turn time', t => {
  for (const stage of ['pay-day', 'distribute']) {
    const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play('meowth', 3); f.advance(1_000); f.attack(); f.respond(); if (stage === 'distribute') f.respond('trait');
    const id = f.room().pendingBattle.id; f.advance(2_000); f.act(f.owner, 'requestEndGame'); f.advance(8_000);
    assert.equal(f.view(f.leader).pendingBattle.clock.remainingMs, 3_000); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); f.advance(3_000); const view = f.view(f.leader);
    if (stage === 'pay-day') assert.equal(view.pendingBattle, null);
    else { assert.equal(view.pendingBattle.id, id); assert.equal(view.pendingBattle.clock.pausedReason, 'mandatory'); assert.equal(view.pendingBattle.clock.remainingMs, 0); rejectsAtomically(f, () => f.respond()); distribute(f); }
    assert.equal(f.view(f.leader).turn.clock.remainingMs, 59_000);
  }
});

test('disconnected distribution preserves its private cards and frozen response clock across restart', t => {
  const f = fixture(t, { responseSeconds: 60 }); inspectPayDay(f, { level: 3 }); const reserved = structuredClone(reserveCards(f)), id = f.room().pendingBattle.id;
  f.advance(CONNECTED_MS + 1_000); const paused = f.view(f.target).pendingBattle; assert.equal(paused.clock.pausedReason, 'disconnected');
  f.advance(5_000); assert.equal(f.view(f.target).pendingBattle.clock.remainingMs, paused.clock.remainingMs);
  const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); const recovered = restored.view(f.owner.code, f.leader.token).view;
  assert.equal(recovered.pendingBattle.id, id); assert.equal(recovered.pendingBattle.clock.remainingMs, paused.clock.remainingMs); assert.deepEqual(restored.rooms.get(f.owner.code).resolution.distributionCards, reserved);
});

test('Fake Out guarantees flinch after positive damage through the global Grimer replacement window without a judgment', t => {
  for (const replace of [false, true]) {
    const f = fixture(t); f.play('meowth', 3); f.seed(f.third, 'grimer'); const top = f.room().drawPile.at(-1).id;
    f.attack({ moveIndex: 1 }); f.respond(); assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.room().pendingBattle.kind, 'poison-touch'); assert.equal(f.room().pendingBattle.status, 'flinch');
    f.respond(replace ? 'trait' : 'pass'); assert.equal(f.player(f.target).active.status, replace ? 'poison' : 'flinch'); assert.equal(f.room().drawPile.at(-1).id, top); assert.equal(f.room().pendingBattle, null);
  }
  for (const prevention of ['dodge', 'immunity', 'existing', 'faint']) {
    const f = fixture(t); f.play('meowth', 3); if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId];
    if (prevention === 'existing') f.player(f.target).active.status = 'burn'; if (prevention === 'faint') f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 });
    f.attack({ moveIndex: 1 }); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); f.drain();
    assert.equal(f.player(f.target).active.status, prevention === 'existing' ? 'burn' : null);
  }
});

test('Pay Day and Fake Out each consume one real command and one independent move use while retaining the same-instance command lock', t => {
  for (const first of [0, 1]) {
    const f = fixture(t); f.play('meowth', 3); const original = f.player(f.leader).active.instanceId;
    for (const moveIndex of [first, 1 - first]) { const card = f.supply(f.leader); f.attack({ cardId: card, moveIndex }); f.drain(); assert.equal(f.room().discardPile.filter(c => c.id === card).length, 1); }
    assert.equal(f.room().turn.usedMoves.length, 2); assert.equal(f.room().turn.commandCreatureId, original);
    const card = f.supply(f.leader); for (const moveIndex of [0, 1]) rejectsAtomically(f, () => f.attack({ cardId: card, moveIndex }));
    f.player(f.leader).reserve.catalogueId = 'meowth'; f.player(f.leader).reserve.level = 3; f.act(f.leader, 'switchPokemon');
    for (const moveIndex of [0, 1]) rejectsAtomically(f, () => f.attack({ cardId: card, moveIndex }));
    assert.equal(f.room().turn.commandCreatureId, original);
  }
});

test('Limber prevents new paralysis before Grimer can replace it and preserves unrelated status rules', t => {
  for (const level of [1, 2, 3]) {
    const f = fixture(t); f.play('pikachu'); f.seed(f.target, 'meowth', level); f.seed(f.third, 'grimer'); f.judgments('thunderstorm'); f.attack(); f.respond();
    if (level < 3) { assert.equal(f.room().pendingBattle.kind, 'poison-touch'); f.respond(); }
    assert.equal(f.player(f.target).active.status, level === 3 ? null : 'paralysis'); assert.equal(f.room().pendingBattle, null);
  }
  const f = fixture(t); f.play('machop', 3); f.seed(f.target, 'meowth', 3); f.attack(); f.respond(); assert.equal(f.player(f.target).active.status, 'confusion');
});

test('leveling an already paralyzed Meowth to Limber retains its status and sunny command restriction', t => {
  const f = fixture(t); f.play('meowth', 2); f.player(f.leader).active.status = 'paralysis'; f.act(f.leader, 'finishPlay'); f.act(f.leader, 'endTurn', { levelUp: true });
  assert.equal(f.player(f.leader).active.level, 3); assert.equal(f.player(f.leader).active.status, 'paralysis');
  f.store.startTurn(f.room(), f.leader.playerId, 9); while (f.room().turn.drawRemaining) f.act(f.leader, 'draw');
  const rainy = f.supply(f.leader, 'command', 'rain'); rejectsAtomically(f, () => f.attack({ cardId: rainy, moveIndex: 1 }));
  f.attack({ cardId: f.supply(f.leader, 'command', 'clear'), moveIndex: 1 }); f.drain(); assert.equal(f.player(f.leader).active.status, 'paralysis');
});




