import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore } from '../server/store.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));
function fixture(t, { count = 3 } = {}) {
  const root = fileURLToPath(new URL('../.data/', import.meta.url));
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'growlithe-test-'));
  t.after(() => {
    if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path');
    rmSync(dir, { recursive: true, force: true });
  });
  let serial = 0;
  const now = () => 1_000_000;
  const store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code);
  const player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id);
  const view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `growlithe-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds: 0, responseSeconds: 0 });
  seats.forEach(who => act(who, 'ready', { ready: true }));
  act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) {
    for (let i = 0; i < 5; i++) act(who, 'drawPokemon');
    const candidates = view(who).self.candidates;
    act(who, 'selectPokemon', { activeId: candidates[0], reserveId: candidates[1] });
  }
  // Complete ordinary setup before isolating the reviewed card behavior.
  const seed = (who, family = 'growlithe', level = 1, extra = {}) => Object.assign(player(who).active, {
    instanceId: `active-${who.playerId}`, catalogueId: family, level, damage: 0,
    status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra,
  });
  for (const who of seats) {
    seed(who, 'squirtle', 3);
    Object.assign(player(who).reserve, { instanceId: `reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false });
    player(who).hand = [];
  }
  const makeCard = (kind = 'dodge', weather = 'clear') => ({ id: `private-growlithe-${++serial}`, kind, weather, fixture: true, name: { zh: `私牌${serial}`, en: `Private Growlithe card ${serial}` } });
  room().drawPile = Array.from({ length: 40 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'dodge', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const judgments = (...weather) => weather.toReversed().forEach(value => room().drawPile.push(makeCard('judgment-fixture', value)));
  const target = seats.find(who => who !== leader);
  const play = () => { act(leader, 'draw'); act(leader, 'draw'); player(leader).hand = []; seed(leader); };
  const attack = (targetIds = [target.playerId]) => act(leader, 'attack', { cardId: supply(leader, 'command'), targetIds });
  const give = (cardIds, recipientId = target.playerId, targetIds) => act(leader, 'giveCards', { cardIds, recipientId, ...(targetIds === undefined ? {} : { targetIds }) });
  const respond = (choice = 'pass', payload = {}) => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload }); };
  return { store, dir, now, owner, seats, leader, target, room, player, byId, view, input, act, seed, makeCard, supply, judgments, play, attack, give, respond };
}
const judgmentsMade = f => f.room().log.filter(entry => entry.text.en.includes('judgment revealed')).length;
const rejectsAtomically = (f, action, code) => {
  const before = structuredClone(f.room());
  assert.throws(action, error => code === undefined || error.code === code);
  assert.deepEqual(f.room(), before);
};
const cardIds = cards => cards.map(card => card.id);

test('the three reviewed Growlithe faces use printed two damage and level 3 permits two targets', t => {
  const faces = catalogue.entries.find(entry => entry.id === 'growlithe').levels;
  assert.deepEqual(faces.map(face => face.effectStatus), ['combat-preview', 'combat-preview', 'combat-preview']);
  for (const level of [1, 2, 3]) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'growlithe', level);
    const legal = f.view(f.leader).self.battle;
    assert.equal(legal.canCommand, true); assert.equal(legal.move.printedValue, 2); assert.equal(legal.move.maxTargets, level === 3 ? 2 : 1);
    f.judgments('rain'); f.attack(); f.respond();
    assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, null);
    assert.equal(judgmentsMade(f), level === 1 ? 0 : 1);
  }
});

test('Flamethrower and Heat Wave judge intense sun after positive damage and preserve an existing status', t => {
  for (const level of [2, 3]) for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) for (const status of [null, 'poison']) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'growlithe', level); f.seed(f.target, 'squirtle', 3, { status });
    f.judgments(weather); const revealed = f.room().drawPile.at(-1).id; f.attack();
    assert.equal(f.player(f.target).active.status, status); assert.equal(judgmentsMade(f), 0);
    f.respond(); assert.equal(f.player(f.target).active.damage, 2);
    assert.equal(f.player(f.target).active.status, status || (weather === 'intense-sun' ? 'burn' : null));
    assert.equal(judgmentsMade(f), 1); assert.equal(f.room().discardPile.some(card => card.id === revealed), true);
  }
});

test('Dodge, zero damage and damage immunity skip the burn judgment', t => {
  for (const level of [2, 3]) for (const prevention of ['dodge', 'zero', 'immunity']) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'growlithe', level); f.judgments('intense-sun');
    const top = f.room().drawPile.at(-1).id;
    if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId];
    f.attack(); if (prevention === 'zero') f.room().resolution.baseDamage = 0;
    if (prevention === 'dodge') f.respond('dodge', { cardId: f.supply(f.target) }); else f.respond();
    assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.target).active.status, null);
    assert.equal(judgmentsMade(f), 0); assert.equal(f.room().drawPile.at(-1).id, top);
  }
});

test('Heat Wave resolves two targets in order and makes an independent judgment for each hit', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'growlithe', 3);
  const second = f.seats.find(who => who !== f.leader && who !== f.target);
  f.judgments('intense-sun', 'rain'); f.attack([f.target.playerId, second.playerId]); f.respond();
  assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, 'burn');
  assert.equal(f.room().pendingBattle.actorId, second.playerId); assert.equal(judgmentsMade(f), 1);
  f.respond(); assert.equal(f.player(second).active.damage, 2); assert.equal(f.player(second).active.status, null);
  assert.equal(judgmentsMade(f), 2); assert.equal(f.room().pendingBattle, null);
});

test('partial Justified gifts preserve real card data and do not use a command or power', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.reinforcements = ['power'];
  const gift = [f.supply(f.leader, 'command', 'rain'), f.supply(f.leader, 'potion', 'thunderstorm'), f.supply(f.leader, 'event', 'clear')];
  const retained = f.supply(f.leader, 'dodge', 'intense-sun');
  const cards = structuredClone(f.player(f.leader).hand.filter(card => gift.includes(card.id)));
  const piles = { draw: structuredClone(f.room().drawPile), discard: structuredClone(f.room().discardPile) };
  f.give(gift);
  assert.deepEqual(f.player(f.target).hand, cards); assert.deepEqual(cardIds(f.player(f.leader).hand), [retained]);
  assert.deepEqual(f.room().drawPile, piles.draw); assert.deepEqual(f.room().discardPile, piles.discard);
  assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null);
  assert.deepEqual(f.room().turn.usedMoves, []); assert.equal(f.room().turn.commandCreatureId, null);
  assert.deepEqual(f.player(f.leader).active.reinforcements, ['power']); assert.equal(f.view(f.leader).self.battle.canGive, false);
  f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 3);
});

test('gift recipients include distant living trainers while command targets still obey range', t => {
  const f = fixture(t, { count: 6 }); f.play(); const held = f.supply(f.leader); f.supply(f.leader);
  const legal = f.view(f.leader).self.battle;
  const far = f.seats.find(who => who !== f.leader && !legal.legalTargetIds.includes(who.playerId));
  assert.ok(far); assert.equal(legal.canGive, true); assert.equal(legal.giveCommandAvailable, true);
  assert.deepEqual(new Set(legal.giveRecipientIds), new Set(f.seats.filter(who => who !== f.leader).map(who => who.playerId)));
  f.give([held], far.playerId); assert.deepEqual(cardIds(f.player(far).hand), [held]); assert.equal(f.room().pendingBattle, null);
});

test('gifting the entire hand starts a virtual command without manufacturing or discarding a command card', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.reinforcements = ['power'];
  const ids = [f.supply(f.leader, 'dodge', 'rain'), f.supply(f.leader, 'potion', 'thunderstorm')];
  const hand = structuredClone(f.player(f.leader).hand), draw = structuredClone(f.room().drawPile);
  f.give(ids, f.target.playerId, [f.target.playerId]);
  assert.deepEqual(f.player(f.leader).hand, []); assert.deepEqual(f.player(f.target).hand, hand);
  assert.equal(f.room().resolution.virtualCommand, true); assert.equal(f.room().resolution.card, null);
  assert.equal(f.room().turn.commandCreatureId, f.player(f.leader).active.instanceId); assert.equal(f.room().turn.usedMoves.length, 1);
  assert.deepEqual(f.player(f.leader).active.reinforcements, []); assert.equal(f.room().resolution.powerBoost, 1);
  f.respond(); assert.equal(f.player(f.target).active.damage, 3);
  assert.deepEqual(f.room().drawPile, draw); assert.deepEqual(f.room().discardPile, []); assert.equal(f.room().resolution, null);
  const command = f.supply(f.leader, 'command');
  rejectsAtomically(f, () => f.act(f.leader, 'attack', { cardId: command, targetIds: [f.target.playerId] }), 'MOVE_UNAVAILABLE');
});

test('an entire-hand recipient can Dodge the virtual command with the card just received', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'growlithe', 3);
  const dodge = f.supply(f.leader, 'dodge', 'rain'); f.judgments('intense-sun');
  const top = f.room().drawPile.at(-1).id;
  f.give([dodge], f.target.playerId, [f.target.playerId]); f.respond('dodge', { cardId: dodge });
  assert.deepEqual(f.player(f.target).hand, []); assert.deepEqual(cardIds(f.room().discardPile), [dodge]);
  assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.target).active.status, null);
  assert.equal(judgmentsMade(f), 0); assert.equal(f.room().drawPile.at(-1).id, top);
});

test('a virtual command cannot offer Synchronize a fictional card', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'abra', 3);
  const gift = f.supply(f.leader, 'potion', 'rain'); f.give([gift], f.target.playerId, [f.target.playerId]); f.respond();
  assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle, null);
  assert.deepEqual(cardIds(f.player(f.target).hand), [gift]); assert.deepEqual(f.room().discardPile, []);
});

test('level 3 entire-hand gifts run the current two-target move and its burn judgments', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'growlithe', 3);
  const second = f.seats.find(who => who !== f.leader && who !== f.target), gift = f.supply(f.leader, 'event', 'rain');
  f.judgments('intense-sun', 'intense-sun'); f.give([gift], second.playerId, [f.target.playerId, second.playerId]);
  f.respond(); f.respond();
  for (const who of [f.target, second]) { assert.equal(f.player(who).active.damage, 2); assert.equal(f.player(who).active.status, 'burn'); }
  assert.equal(judgmentsMade(f), 2); assert.deepEqual(cardIds(f.player(second).hand), [gift]);
  assert.equal(f.room().discardPile.some(card => card.id === gift), false);
});

test('invalid gift cards, recipients, extra fields and target data are rejected before any transfer', t => {
  const f = fixture(t); f.play(); const own = f.supply(f.leader), foreign = f.supply(f.target);
  const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true });
  const third = f.seats.find(who => who !== f.leader && who !== f.target); f.player(third).eliminated = true;
  assert.deepEqual(f.view(f.leader).self.battle.giveRecipientIds, [f.target.playerId]);
  const valid = { cardIds: [own], recipientId: f.target.playerId, targetIds: [f.target.playerId] };
  for (const invalid of [
    { cardIds: [] }, { cardIds: [own, own] }, { cardIds: [foreign] }, { cardIds: [own, foreign] },
    { cardIds: ['missing'] }, { cardIds: own }, { cardIds: [null] }, { cardIds: [0] }, { cardIds: null },
    { recipientId: f.leader.playerId }, { recipientId: observer.playerId }, { recipientId: third.playerId },
    { recipientId: 'missing' }, { recipientId: null }, { recipientId: [f.target.playerId] },
    { weather: 'intense-sun' }, { cardId: own }, { handIndex: 0 }, { targetId: f.target.playerId },
  ]) rejectsAtomically(f, () => f.act(f.leader, 'giveCards', { ...valid, ...invalid }));
  const { cardIds: omittedCards, ...withoutCards } = valid;
  const { recipientId: omittedRecipient, ...withoutRecipient } = valid;
  rejectsAtomically(f, () => f.act(f.leader, 'giveCards', withoutCards));
  rejectsAtomically(f, () => f.act(f.leader, 'giveCards', withoutRecipient));
});

test('entire-hand gifts require nonempty, distinct legal targets within the current move target count', t => {
  for (const level of [1, 2, 3]) {
    const f = fixture(t, { count: 6 }); f.play(); f.seed(f.leader, 'growlithe', level); const held = f.supply(f.leader);
    const legal = f.view(f.leader).self.battle, far = f.seats.find(who => !legal.legalTargetIds.includes(who.playerId));
    const near = legal.legalTargetIds;
    for (const targets of [undefined, [], [null], [f.target.playerId, f.target.playerId], ['missing'], [far.playerId], near.slice(0, level === 3 ? 3 : 2), f.target.playerId]) {
      rejectsAtomically(f, () => f.give([held], f.target.playerId, targets));
    }
  }
});

test('a partial gift does not accept targetIds even when the supplied targets are legal or empty', t => {
  const f = fixture(t); f.play(); const held = f.supply(f.leader); f.supply(f.leader);
  for (const targets of [[], [f.target.playerId], null]) rejectsAtomically(f, () => f.give([held], f.target.playerId, targets));
  f.give([held]); assert.deepEqual(cardIds(f.player(f.target).hand), [held]); assert.equal(f.room().pendingBattle, null);
});

test('wrong actors, spectators, non-play phases, closing votes and pending responses cannot give cards', t => {
  const f = fixture(t); f.play(); const held = f.supply(f.leader); f.supply(f.leader);
  const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true });
  const payload = { cardIds: [held], recipientId: f.target.playerId };
  rejectsAtomically(f, () => f.act(f.target, 'giveCards', payload), 'NOT_YOUR_TURN');
  rejectsAtomically(f, () => f.act(observer, 'giveCards', payload), 'SPECTATOR_ONLY_VIEW');
  for (const phase of ['draw', 'discard', 'end']) {
    f.room().turn.phase = phase; assert.equal(f.view(f.leader).self.battle.canGive, false);
    rejectsAtomically(f, () => f.act(f.leader, 'giveCards', payload));
  }
  f.room().turn.phase = 'play'; f.act(f.owner, 'requestEndGame');
  rejectsAtomically(f, () => f.act(f.leader, 'giveCards', payload), 'VOTE_PENDING');
  f.act(f.target, 'rejectEnd'); f.attack();
  rejectsAtomically(f, () => f.act(f.leader, 'giveCards', payload), 'RESPONSE_PENDING');
});

test('empty hands and other families cannot use Justified', t => {
  const f = fixture(t); f.play(); assert.equal(f.view(f.leader).self.battle.canGive, false);
  rejectsAtomically(f, () => f.give([], f.target.playerId, [f.target.playerId]));
  const held = f.supply(f.leader); f.seed(f.leader, 'squirtle', 3);
  assert.equal(f.view(f.leader).self.battle.canGive, false);
  rejectsAtomically(f, () => f.give([held], f.target.playerId, [f.target.playerId]));
});

test('command restrictions forbid an entire-hand gift but still permit a nonempty partial gift', t => {
  for (const restriction of ['paralysis', 'sleep', 'movesBlocked', 'blockedMoveIds', 'usedMove', 'differentCreature']) {
    const f = fixture(t); f.play(); const held = f.supply(f.leader, 'command', 'intense-sun');
    if (restriction === 'paralysis') f.player(f.leader).active.status = 'paralysis';
    if (restriction === 'sleep') { f.player(f.leader).active.status = 'sleep'; f.room().turn.blockedMoveIds = [f.player(f.leader).active.instanceId]; }
    if (restriction === 'movesBlocked') f.room().turn.movesBlocked = true;
    if (restriction === 'blockedMoveIds') f.room().turn.blockedMoveIds = [f.player(f.leader).active.instanceId];
    if (restriction === 'usedMove') f.room().turn.usedMoves = [`${f.player(f.leader).active.instanceId}:${f.view(f.leader).self.battle.move.name.zh}`];
    if (restriction === 'differentCreature') f.room().turn.commandCreatureId = f.player(f.leader).reserve.instanceId;
    let legal = f.view(f.leader).self.battle;
    assert.equal(legal.giveCommandAvailable, false, restriction); assert.equal(legal.canGive, false, restriction);
    rejectsAtomically(f, () => f.give([held], f.target.playerId, [f.target.playerId]));
    const retained = f.supply(f.leader, 'event', 'rain'); legal = f.view(f.leader).self.battle;
    assert.equal(legal.canGive, true, restriction); assert.equal(legal.giveCommandAvailable, false, restriction);
    f.give([held]); assert.deepEqual(cardIds(f.player(f.leader).hand), [retained]); assert.equal(f.room().pendingBattle, null);
  }
});

test('a normal command followed by a partial gift stays legal but cannot produce a second move', t => {
  const f = fixture(t); f.play(); const gift = f.supply(f.leader), retained = f.supply(f.leader);
  f.attack(); f.respond();
  assert.equal(f.view(f.leader).self.battle.canGive, true); assert.equal(f.view(f.leader).self.battle.giveCommandAvailable, false);
  rejectsAtomically(f, () => f.give([gift, retained], f.target.playerId, [f.target.playerId]));
  f.give([gift]); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle, null);
});

test('Justified is once per trainer play phase across partner switching', t => {
  const f = fixture(t); f.play(); const gift = f.supply(f.leader), held = f.supply(f.leader);
  Object.assign(f.player(f.leader).reserve, { catalogueId: 'growlithe', level: 2 });
  f.give([gift]); f.act(f.leader, 'switchPokemon');
  assert.equal(f.player(f.leader).active.catalogueId, 'growlithe'); assert.equal(f.view(f.leader).self.battle.canGive, false);
  rejectsAtomically(f, () => f.give([held], f.target.playerId, [f.target.playerId]));
});

test('a virtual command locks later commands to its source even after switching to another Growlithe', t => {
  const f = fixture(t); f.play(); const gift = f.supply(f.leader);
  Object.assign(f.player(f.leader).reserve, { catalogueId: 'growlithe', level: 3 });
  f.give([gift], f.target.playerId, [f.target.playerId]); f.respond(); f.act(f.leader, 'switchPokemon');
  const command = f.supply(f.leader, 'command'); assert.equal(f.view(f.leader).self.battle.canCommand, false);
  rejectsAtomically(f, () => f.act(f.leader, 'attack', { cardId: command, targetIds: [f.target.playerId] }), 'MOVE_UNAVAILABLE');
});

test('gift action retries, stale revisions and restarts preserve exactly one transfer and the phase limit', t => {
  const f = fixture(t); f.play(); const gift = f.supply(f.leader), held = f.supply(f.leader);
  const input = f.input('giveCards', { cardIds: [gift], recipientId: f.target.playerId });
  f.store.action(f.owner.code, f.leader.token, input); const committed = structuredClone(f.room());
  f.store.action(f.owner.code, f.leader.token, input); assert.deepEqual(f.room(), committed);
  rejectsAtomically(f, () => f.store.action(f.owner.code, f.leader.token, { ...input, recipientId: f.leader.playerId }), 'ACTION_ID_REUSED');
  rejectsAtomically(f, () => f.store.action(f.owner.code, f.leader.token, { ...f.input('giveCards', { cardIds: [held], recipientId: f.target.playerId }), revision: input.revision }), 'STALE_REVISION');
  const restarted = new RoomStore({ dataDir: f.dir, catalogue, now: f.now });
  let recovered = restarted.view(f.owner.code, f.leader.token).view;
  assert.equal(recovered.self.battle.canGive, false);
  restarted.action(f.owner.code, f.leader.token, input);
  const state = restarted.rooms.get(f.owner.code);
  assert.deepEqual(cardIds(state.players.find(p => p.id === f.target.playerId).hand), [gift]);
  assert.deepEqual(cardIds(state.players.find(p => p.id === f.leader.playerId).hand), [held]);
  recovered = restarted.view(f.owner.code, f.leader.token).view;
  const before = structuredClone(state);
  assert.throws(() => restarted.action(f.owner.code, f.leader.token, { id: 'growlithe-after-restart', revision: recovered.revision, type: 'giveCards', cardIds: [held], recipientId: f.target.playerId, targetIds: [f.target.playerId] }));
  assert.deepEqual(restarted.rooms.get(f.owner.code), before);
});

test('a new trainer turn resets Justified and allows a new gift', t => {
  const f = fixture(t); f.play(); const first = f.supply(f.leader); f.supply(f.leader); f.give([first]);
  const finish = who => { f.act(who, 'finishPlay'); f.act(who, 'endTurn', { levelUp: false }); };
  finish(f.leader);
  while (f.room().turn.playerId !== f.leader.playerId) {
    const who = f.byId(f.room().turn.playerId); f.act(who, 'draw'); f.act(who, 'draw'); finish(who);
  }
  f.act(f.leader, 'draw'); f.act(f.leader, 'draw');
  assert.equal(f.view(f.leader).self.battle.canGive, true); assert.equal(f.view(f.leader).self.battle.giveCommandAvailable, true);
  const second = f.player(f.leader).hand[0].id; f.give([second]);
  assert.equal(f.player(f.target).hand.filter(card => card.id === second).length, 1);
  assert.equal(f.view(f.leader).self.battle.canGive, false);
});

test('restart during a virtual command preserves its defense window, gift, power and command limits', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.reinforcements = ['power'];
  const gift = f.supply(f.leader, 'potion', 'rain');
  const input = f.input('giveCards', { cardIds: [gift], recipientId: f.target.playerId, targetIds: [f.target.playerId] });
  f.store.action(f.owner.code, f.leader.token, input);
  const decisionId = f.room().pendingBattle.id;
  const restarted = new RoomStore({ dataDir: f.dir, catalogue, now: f.now });
  const state = () => restarted.rooms.get(f.owner.code);
  const view = who => restarted.view(f.owner.code, who.token).view;
  let recovered = view(f.leader);
  assert.equal(recovered.pendingBattle.id, decisionId); assert.equal(recovered.pendingBattle.kind, 'defense');
  assert.equal(state().resolution.virtualCommand, true); assert.equal(state().resolution.card, null);
  assert.equal(state().resolution.powerBoost, 1);
  const committed = structuredClone(state());
  restarted.action(f.owner.code, f.leader.token, input); assert.deepEqual(state(), committed);
  assert.deepEqual(cardIds(state().players.find(p => p.id === f.target.playerId).hand), [gift]);
  const targetView = view(f.target);
  restarted.action(f.owner.code, f.target.token, { id: 'growlithe-restart-defense', revision: targetView.revision, type: 'respondBattle', decisionId, choice: 'pass' });
  assert.equal(state().players.find(p => p.id === f.target.playerId).active.damage, 3);
  assert.deepEqual(state().players.find(p => p.id === f.leader.playerId).active.reinforcements, []);
  assert.deepEqual(state().discardPile, []); assert.equal(state().pendingBattle, null);
  recovered = view(f.leader); assert.equal(recovered.self.battle.canCommand, false); assert.equal(recovered.self.battle.canGive, false);
});
