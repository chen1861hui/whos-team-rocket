import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoomStore } from '../server/store.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url)));
const protection = 'articuno-protection';
const song = 'jigglypuff-performance';
const weatherKinds = ['intense-sun', 'clear', 'rain', 'thunderstorm'];

function fixture(t, { count = 3, responseSeconds = 0 } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'articuno-protection-'));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  let serial = 0;
  let time = 1_000_000;
  const options = { dataDir, allowTestDecks: true, catalogue, now: () => time };
  const store = new RoomStore(options);
  const owner = store.create({ nickname: 'Trainer 0' });
  const joined = [owner, ...Array.from({ length: count - 1 }, (_, index) =>
    store.join(owner.code, { nickname: 'Trainer ' + (index + 1) }))];
  const room = () => store.rooms.get(owner.code);
  const player = who => room().players.find(seat => seat.id === who.playerId);
  const view = who => store.view(owner.code, who.token).view;
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, {
    id: 'articuno-action-' + (++serial), revision: room().revision, type, ...payload
  }).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds: 0, responseSeconds });
  for (const who of joined) act(who, 'ready', { ready: true });
  act(owner, 'startBattlePreview');
  for (const who of joined) act(who, 'acknowledgeIdentity');
  for (const who of joined) {
    for (let draw = 0; draw < 5; draw++) act(who, 'drawPokemon');
    const candidates = view(who).self.candidates;
    const activeId = candidates.find(id => !['koffing', 'jynx', 'tauros'].includes(id));
    act(who, 'selectPokemon', { activeId, reserveId: candidates.find(id => id !== activeId) });
  }

  const seats = room().players.map(seat => joined.find(who => who.playerId === seat.id));
  const [leader, target, third] = seats;
  const byId = id => seats.find(who => who.playerId === id);
  const makeCard = (fields = {}) => {
    const id = 'articuno-private-card-' + (++serial);
    return {
      id, kind: 'event', weather: 'clear', name: { zh: '测试牌', en: 'Test card ' + id },
      fixture: true, privateMarker: 'hidden-' + id, ...fields
    };
  };
  const give = (who, fields) => {
    const card = makeCard(fields);
    player(who).hand.push(card);
    return card;
  };
  const protectCard = (who, fields = {}) => give(who, { eventType: protection, ...fields });
  const seed = (who, family = 'squirtle', level = 1, fields = {}) => Object.assign(player(who).active, {
    catalogueId: family, level, damage: 0, hpBonus: 20, status: null, reinforcements: [], ...fields
  });
  const play = (actor = leader) => {
    for (const who of seats) {
      seed(who);
      player(who).hand = [];
    }
    room().scenario.articunoReactions = true;
    room().drawPile = Array.from({ length: 16 }, () => makeCard());
    room().discardPile = [];
    if (actor !== leader) store.startTurn(room(), actor.playerId, 2);
    while (room().turn.drawRemaining) act(actor, 'draw');
    player(actor).hand = [];
  };
  const event = (eventType, payload = {}, who = leader) => {
    const card = give(who, { eventType });
    act(who, 'useEvent', { cardId: card.id, ...payload });
    return card;
  };
  const judgments = (...weather) => {
    const cards = weather.map(value => makeCard({ weather: value }));
    room().drawPile.push(...[...cards].reverse());
    return cards;
  };
  const pending = () => room().pendingBattle;
  const respond = (choice = 'pass', payload = {}, who = byId(pending().actorId)) =>
    act(who, 'respondBattle', { decisionId: pending().id, choice, ...payload });
  const protect = card => respond('protect', { cardId: card.id });
  const expectWindow = (mode, intended, actor = leader) => {
    assert.equal(pending()?.kind, 'articuno');
    assert.equal(pending().mode, mode);
    assert.equal(pending().targetId, intended.playerId);
    assert.equal(pending().actorId, actor.playerId);
  };
  const passWindow = (expected = seats.filter(who => !player(who).eliminated)) => {
    const { mode, targetId } = pending();
    for (const who of expected) {
      expectWindow(mode, byId(targetId), who);
      respond();
    }
  };
  const spectate = () => store.join(owner.code, { nickname: 'Observer', spectator: true });

  return {
    store, options, owner, seats, leader, target, third, room, player, view, act, play, seed, give,
    protectCard, event, judgments, pending, respond, protect, expectWindow, passWindow, spectate,
    advance: ms => { time += ms; }
  };
}

function allCards(room) {
  const resolvingCards = [room.resolution, ...(room.resolutionStack || [])]
    .flatMap(resolution => resolution?.card && !resolution.cardClaimedBy ? [resolution.card] : []);
  return [
    ...room.drawPile, ...room.discardPile, ...resolvingCards,
    ...room.players.flatMap(player => [...player.hand, ...[player.active?.item, player.reserve?.item].filter(Boolean)]),
    ...[room.judgment?.card].filter(Boolean)
  ];
}

function assertOne(room, card) {
  assert.deepEqual(allCards(room).filter(candidate => candidate.id === card.id), [card]);
}

function rejectAtomically(f, action, code) {
  const before = structuredClone(f.room());
  assert.throws(action, error => code === undefined || error.code === code);
  assert.deepEqual(f.room(), before);
}

function beginSong(f) {
  return f.event(song, { targetId: f.target.playerId });
}

function assertDone(f) {
  assert.equal(f.pending(), null);
  assert.equal(f.room().resolution, null);
  assert.equal(f.room().protectionWindow ?? null, null);
}

test('stock preview still starts with six commands and six Dodges per seat', t => {
  const f = fixture(t, { count: 4 });
  const cards = allCards(f.room());
  assert.equal(cards.length, 48);
  assert.equal(cards.filter(card => card.kind === 'command').length, 24);
  assert.equal(cards.filter(card => card.kind === 'dodge').length, 24);
  assert.ok(cards.every(card => card.eventType !== protection));
  assert.notEqual(f.view(f.leader).scenario.articunoReactions, true);
});

for (const flag of [undefined, false, 'true']) {
  test('scenario flag ' + (typeof flag === 'string' ? JSON.stringify(flag) : String(flag)) + ' leaves both Articuno windows disabled', t => {
    const f = fixture(t);
    f.play();
    f.room().scenario.articunoReactions = flag;
    const reply = f.protectCard(f.leader);
    f.judgments('clear');
    const original = beginSong(f);
    assertDone(f);
    assert.equal(f.player(f.target).active.status, 'sleep');
    assert.deepEqual(f.player(f.leader).hand, [reply]);
    assertOne(f.room(), original);
  });
}

test('an enabled room with zero copies opens identical pre-event and post-status pass queues', t => {
  const f = fixture(t);
  f.play();
  assert.equal(f.view(f.target).scenario.articunoReactions, true);
  const original = beginSong(f);
  f.expectWindow('cancel-event', f.target);
  assert.match(f.view(f.leader).pendingBattle.eventName.en, /Jigglypuff/);
  assert.deepEqual(f.view(f.leader).pendingBattle.protectionCards, []);
  f.passWindow();
  f.expectWindow('cure-status', f.target);
  assert.equal(f.pending().status, 'sleep');
  f.passWindow();
  assertDone(f);
  assert.equal(f.player(f.target).active.status, 'sleep');
  assertOne(f.room(), original);
});

test('the current trainer gets first offer, wrapping seats and skipping eliminated trainers and spectators', t => {
  const f = fixture(t, { count: 5 });
  const actor = f.seats[3];
  f.play(actor);
  const observer = f.spectate();
  f.player(f.seats[4]).eliminated = true;
  f.protectCard(f.seats[4]);
  f.protectCard(observer);
  f.judgments('thunderstorm');
  f.event(song, { targetId: f.target.playerId }, actor);
  f.expectWindow('cancel-event', f.target, actor);
  f.passWindow([actor, f.leader, f.target, f.third]);
  assertDone(f);
  assert.equal(f.player(f.seats[4]).hand.length, 1);
  assert.equal(f.player(observer).hand.length, 1);
});

test('eligibility is private to the current actor and exposes only safe actual card stubs', t => {
  const f = fixture(t);
  f.play();
  const observer = f.spectate();
  const a = f.protectCard(f.leader, { weather: 'rain' });
  const b = f.protectCard(f.leader, { weather: 'thunderstorm' });
  const c = f.protectCard(f.target);
  f.protectCard(f.leader, { kind: 'dodge' });
  f.give(f.leader, { eventType: 'mew-two-fictional', name: a.name });
  const original = beginSong(f);
  const stub = ({ id, name, kind, weather }) => ({ id, name, kind, weather });
  assert.deepEqual(f.view(f.leader).pendingBattle.protectionCards, [stub(a), stub(b)]);
  for (const who of [f.target, f.third, observer]) {
    const projected = f.view(who).pendingBattle;
    assert.equal(Object.hasOwn(projected, 'protectionCards'), false);
    const json = JSON.stringify(projected);
    for (const secret of [a.id, b.id, c.id, original.id, f.player(f.target).active.instanceId]) {
      assert.equal(json.includes(secret), false);
    }
  }
  f.respond();
  assert.deepEqual(f.view(f.target).pendingBattle.protectionCards, [stub(c)]);
  assert.equal(Object.hasOwn(f.view(f.leader).pendingBattle, 'protectionCards'), false);
});

test('an actual Articuno card has no normal event menu action', t => {
  const f = fixture(t);
  f.play();
  const card = f.protectCard(f.leader);
  assert.equal(f.view(f.leader).self.battle.events.some(event => event.eventType === protection), false);
  rejectAtomically(f, () => f.act(f.leader, 'useEvent', { cardId: card.id }), 'INVALID_CARD');
});

for (const weather of weatherKinds) {
  test('accepts an actual Articuno of ' + weather + ' weather before judgment', t => {
    const f = fixture(t);
    f.play();
    const reply = f.protectCard(f.leader, { weather });
    const [judged] = f.judgments('rain');
    const original = beginSong(f);
    f.expectWindow('cancel-event', f.target);
    f.protect(reply);
    assertDone(f);
    assert.equal(f.player(f.target).active.status, null);
    assert.ok(f.room().drawPile.some(card => card.id === judged.id));
    assert.deepEqual(f.room().discardPile, [reply, original]);
  });
}

test('only the acting trainer can protect with a physical card from their own hand', t => {
  const f = fixture(t);
  f.play();
  const observer = f.spectate();
  const foreign = f.protectCard(f.target);
  const ordinary = f.give(f.leader, { eventType: 'mew-blessing' });
  const mislabeled = f.protectCard(f.leader, { kind: 'command' });
  const actual = f.protectCard(f.leader);
  beginSong(f);
  rejectAtomically(f, () => f.respond('protect', { cardId: foreign.id }, f.target));
  rejectAtomically(f, () => f.respond('pass', {}, observer), 'SPECTATOR_ONLY_VIEW');
  for (const cardId of [foreign.id, ordinary.id, mislabeled.id, 'invented-card', 17, null]) {
    rejectAtomically(f, () => f.respond('protect', { cardId }), 'INVALID_CARD');
  }
  rejectAtomically(f, () => f.respond('protect'), 'INVALID_CARD');
  f.protect(actual);
  assertDone(f);
  assert.deepEqual(f.player(f.target).hand, [foreign]);
});

test('strict response validation rejects pass payment, retargeting, and extra fields', t => {
  const f = fixture(t);
  f.play();
  const cardId = f.protectCard(f.leader).id;
  beginSong(f);
  for (const payload of [
    { choice: 'pass', cardId }, { choice: 'pass', cardId: null },
    { choice: 'dodge', cardId }, { choice: 'command', cardId }, { choice: 'cure', cardId },
    { choice: 'protect', cardId, targetId: f.third.playerId },
    { choice: 'protect', cardId, targetIds: [f.third.playerId] },
    { choice: 'protect', cardId, cardIds: [cardId] },
    { choice: 'protect', cardId, effect: 'cure-status' },
    { choice: 'protect', cardId, handIndex: 0 }
  ]) {
    rejectAtomically(f, () => f.respond(payload.choice, payload), 'INVALID_RESPONSE');
  }
  rejectAtomically(f, () => f.respond('protect', { cardId, mode: 'cure-status' }), 'INVALID_INPUT');
});

test('the first acceptance stops this queue and leaves every other Articuno unspent', t => {
  const f = fixture(t);
  f.play();
  const chosen = f.protectCard(f.target);
  const other = f.protectCard(f.target);
  const counter = f.protectCard(f.third);
  const original = beginSong(f);
  f.respond();
  f.expectWindow('cancel-event', f.target, f.target);
  const expired = f.pending().id;
  f.protect(chosen);
  assertDone(f);
  assert.deepEqual(f.player(f.target).hand, [other]);
  assert.deepEqual(f.player(f.third).hand, [counter]);
  assert.deepEqual(f.room().discardPile, [chosen, original]);
  rejectAtomically(f, () => f.act(f.third, 'respondBattle', { decisionId: expired, choice: 'protect', cardId: counter.id }));
});

const multiTargetDamageEvents = [
  ['mewtwo-threat', 'event-dodge', 'dodge'],
  ['moltres-trial', 'event-command', 'command']
];
for (const [eventType, defenseKind, defenseCardKind] of multiTargetDamageEvents) {
  test(eventType + ' cancels one slot before its defense and damages the next target normally', t => {
    const f = fixture(t);
    f.play();
    const reply = f.protectCard(f.third);
    const defense = f.give(f.target, { kind: defenseCardKind });
    const original = f.event(eventType);
    f.expectWindow('cancel-event', f.target);
    f.respond();
    f.respond();
    f.protect(reply);
    assert.equal(f.player(f.target).active.damage, 0);
    assert.deepEqual(f.player(f.target).hand, [defense]);
    f.expectWindow('cancel-event', f.third);
    f.passWindow();
    assert.equal(f.pending().kind, defenseKind);
    assert.equal(f.pending().actorId, f.third.playerId);
    f.respond();
    assertDone(f);
    assert.equal(f.player(f.third).active.damage, 2);
    for (const card of [original, reply, defense]) assertOne(f.room(), card);
  });
}

test('Articuno can cancel the self-first Mew slot and resume later healing and evolution choices', t => {
  const f = fixture(t);
  f.play();
  for (const who of f.seats) f.player(who).active.damage = 3;
  const reply = f.protectCard(f.leader);
  const original = f.event('mew-blessing');
  f.expectWindow('cancel-event', f.leader);
  f.protect(reply);
  f.expectWindow('cancel-event', f.target);
  f.passWindow();
  assert.equal(f.pending().kind, 'mew-blessing');
  f.respond('heal');
  f.expectWindow('cancel-event', f.third);
  f.passWindow();
  f.respond('evolve');
  assertDone(f);
  assert.equal(f.player(f.leader).active.damage, 3);
  assert.equal(f.player(f.target).active.damage, 1);
  assert.equal(f.player(f.third).active.level, 2);
  assertOne(f.room(), original);
});

test('Zapdos cancellation consumes no judgment and preserves the later self-last queue', t => {
  const f = fixture(t);
  f.play();
  const reply = f.protectCard(f.leader);
  const [thunder, clear] = f.judgments('thunderstorm', 'clear');
  const original = f.event('zapdos-punishment');
  f.expectWindow('cancel-event', f.target);
  f.protect(reply);
  assert.ok(f.room().drawPile.some(card => card.id === thunder.id));
  f.expectWindow('cancel-event', f.third);
  f.passWindow();
  assert.equal(f.player(f.third).active.damage, 1);
  f.expectWindow('cancel-event', f.leader);
  f.passWindow();
  assertDone(f);
  assert.equal(f.player(f.target).active.damage, 0);
  assert.equal(f.player(f.leader).active.damage, 0);
  assert.deepEqual(f.room().discardPile, [reply, thunder, clear, original]);
});

for (const effect of ['hand', 'item']) {
  test('Mr. Mime ' + effect + ' cancellation keeps the possession with the original trainer', t => {
    const f = fixture(t);
    f.play();
    const possession = effect === 'hand' ? f.give(f.target, { kind: 'command' }) : {
      id: 'helmet', kind: 'held-item', weather: 'rain', itemType: 'rocky-helmet'
    };
    if (effect === 'item') f.player(f.target).active.item = possession;
    const reply = f.protectCard(f.leader);
    const original = f.event('mr-mime-trick', { effect, targetId: f.target.playerId });
    f.expectWindow('cancel-event', f.target);
    assert.equal(Object.hasOwn(f.view(f.leader).pendingBattle, 'choices'), false);
    f.protect(reply);
    assertDone(f);
    const cues = f.view(f.third).visualEvents.filter(cue=>cue.kind==='event-action');
    assert.deepEqual(cues.map(cue=>[cue.action,cue.targetIds]), [['shield',[f.target.playerId]]]);
    assert.deepEqual(effect === 'hand' ? f.player(f.target).hand[0] : f.player(f.target).active.item, possession);
    assert.deepEqual(f.player(f.leader).hand, []);
    assertOne(f.room(), original);
    assertOne(f.room(), possession);
  });
}

test('passing Mr. Mime hand protection restores the original private choice and exact gain', t => {
  const f = fixture(t);
  f.play();
  const taken = f.give(f.target, { kind: 'command' });
  f.event('mr-mime-trick', { effect: 'hand', targetId: f.target.playerId });
  f.passWindow();
  assert.equal(f.pending().kind, 'event-hand');
  assert.deepEqual(f.view(f.leader).pendingBattle.choices, [{ index: 0 }]);
  assert.equal(f.view(f.third).pendingBattle.choices, undefined);
  f.respond('card', { handIndex: 0 });
  assertDone(f);
  assert.deepEqual(f.player(f.leader).hand, [taken]);
  assert.deepEqual(f.player(f.target).hand, []);
  const cue = f.view(f.third).visualEvents.at(-1);
  assert.deepEqual([cue.kind,cue.action,cue.object], ['event-action','take','card']);
});

test('a passed first target can still claim the resolving event via Synchronize before later protection', t => {
  const f = fixture(t);
  f.play();
  f.seed(f.target, 'abra', 2);
  const reply = f.protectCard(f.leader);
  const original = f.event('mewtwo-threat');
  f.passWindow();
  f.respond();
  assert.equal(f.pending().kind, 'synchronize');
  f.respond('trait');
  assert.deepEqual(f.player(f.target).hand, [original]);
  f.expectWindow('cancel-event', f.third);
  f.protect(reply);
  assertDone(f);
  assert.equal(f.player(f.target).active.damage, 2);
  assert.equal(f.player(f.third).active.damage, 0);
  assertOne(f.room(), original);
  assert.deepEqual(f.room().discardPile, [reply]);
});

test('an already-immune named event target stays outside both windows', t => {
  const f = fixture(t);
  f.play();
  f.seed(f.target, 'kangaskhan', 3);
  const card = f.give(f.leader, { eventType: song });
  const reply = f.protectCard(f.leader);
  rejectAtomically(f, () => f.act(f.leader, 'useEvent', { cardId: card.id, targetId: f.target.playerId }), 'INVALID_TARGET');
  assertDone(f);
  assert.deepEqual(f.player(f.leader).hand, [card, reply]);
});

for (const [label, family, status, weather] of [
  ['an existing Burn', 'squirtle', 'burn', 'rain'],
  ['Shield Dust', 'caterpie', null, 'rain'],
  ['Vital Spirit', 'electabuzz', null, 'rain'],
  ['a nonmatching judgment', 'squirtle', null, 'thunderstorm'],
  ['an empty judgment supply', 'squirtle', null, null]
]) {
  test(label + ' produces no post-status Articuno offer', t => {
    const f = fixture(t);
    f.play();
    f.seed(f.target, family, 1, { status });
    if (weather) f.judgments(weather);
    else f.room().drawPile = [];
    const reply = f.protectCard(f.leader);
    const original = beginSong(f);
    f.passWindow();
    assertDone(f);
    assert.equal(f.player(f.target).active.status, status);
    assert.deepEqual(f.player(f.leader).hand, [reply]);
    assertOne(f.room(), original);
  });
}

test('Articuno sees the marker after Drought determines the final Jigglypuff judgment', t => {
  const f = fixture(t);
  f.play();
  f.seed(f.third, 'vulpix');
  const reply = f.protectCard(f.leader);
  const weather = f.give(f.third, { weather: 'clear' });
  const [displaced] = f.judgments('thunderstorm');
  const original = beginSong(f);
  f.passWindow();
  assert.equal(f.pending().kind, 'judgment');
  assert.equal(f.player(f.target).active.status, null);
  f.respond('replace', { cardId: weather.id });
  f.expectWindow('cure-status', f.target);
  assert.equal(f.pending().status, 'sleep');
  assert.equal(f.player(f.target).active.status, 'sleep');
  assert.deepEqual(f.player(f.third).hand, [displaced]);
  f.protect(reply);
  assertDone(f);
  assert.equal(f.player(f.target).active.status, null);
  for (const card of [original, reply, weather, displaced]) assertOne(f.room(), card);
});

test('Articuno cures the final Poison Touch replacement once, preserving unrelated markers and turn flags', t => {
  const f = fixture(t);
  f.play();
  f.seed(f.third, 'grimer', 1, { status: 'burn' });
  f.player(f.target).reserve.status = 'confusion';
  f.player(f.target).active.reinforcements = ['speed'];
  f.room().turn.switchBlocked = true;
  f.room().turn.blockedMoveIds = [f.player(f.target).active.instanceId];
  const turn = structuredClone(f.room().turn);
  const reply = f.protectCard(f.third);
  const next = f.protectCard(f.leader);
  const original = beginSong(f);
  f.passWindow();
  assert.equal(f.pending().kind, 'poison-touch');
  assert.equal(f.pending().status, 'sleep');
  assert.equal(f.player(f.target).active.status, null);
  f.respond('trait');
  f.expectWindow('cure-status', f.target);
  assert.equal(f.pending().status, 'poison');
  assert.equal(f.player(f.target).active.status, 'poison');
  f.respond();
  f.respond();
  f.protect(reply);
  assertDone(f);
  assert.equal(f.player(f.target).active.status, null);
  assert.equal(f.player(f.target).reserve.status, 'confusion');
  assert.equal(f.player(f.third).active.status, 'burn');
  assert.deepEqual(f.player(f.target).active.reinforcements, ['speed']);
  assert.deepEqual(f.room().turn, turn);
  assert.deepEqual(f.player(f.leader).hand, [next]);
  assertOne(f.room(), original);
});

for (const [family, level, weather, status, damage] of [
  ['charmander', 1, 'intense-sun', 'burn', 1],
  ['pikachu', 1, 'thunderstorm', 'paralysis', 1],
  ['abra', 2, 'intense-sun', 'confusion', 2],
  ['slowpoke', 2, 'thunderstorm', 'flinch', 2],
  ['grimer', 2, 'rain', 'poison', 2]
]) {
  test(family + ' move status can be cured without reversing damage or move payment', t => {
    const f = fixture(t);
    f.play();
    f.seed(f.leader, family, level);
    const payment = f.give(f.leader, { kind: 'command' });
    const reply = f.protectCard(f.leader);
    const [judged] = f.judgments(weather);
    f.act(f.leader, 'attack', { cardId: payment.id, targetIds: [f.target.playerId] });
    f.respond();
    f.expectWindow('cure-status', f.target);
    assert.equal(f.pending().status, status);
    assert.equal(f.player(f.target).active.status, status);
    f.protect(reply);
    assertDone(f);
    assert.equal(f.player(f.target).active.status, null);
    assert.equal(f.player(f.target).active.damage, damage);
    assert.deepEqual(f.room().discardPile, [judged, reply, payment]);
  });
}

test('ongoing Poison damage at turn start does not create a new status cure', t => {
  const f = fixture(t);
  f.play();
  f.seed(f.target, 'squirtle', 1, { status: 'poison' });
  const reply = f.protectCard(f.leader);
  f.store.startTurn(f.room(), f.target.playerId, 2);
  assertDone(f);
  assert.equal(f.player(f.target).active.status, 'poison');
  assert.equal(f.player(f.target).active.damage, 1);
  assert.deepEqual(f.player(f.leader).hand, [reply]);
});

test('passing a non-event status window leaves its new marker in place', t => {
  const f = fixture(t);
  f.play();
  f.seed(f.leader, 'grimer', 2);
  f.judgments('rain');
  const payment = f.give(f.leader, { kind: 'command' });
  f.act(f.leader, 'attack', { cardId: payment.id, targetIds: [f.target.playerId] });
  f.respond();
  f.expectWindow('cure-status', f.target);
  assert.deepEqual(f.view(f.leader).pendingBattle.protectionCards, []);
  f.passWindow();
  assertDone(f);
  assert.equal(f.player(f.target).active.damage, 2);
  assert.equal(f.player(f.target).active.status, 'poison');
  assertOne(f.room(), payment);
});

test('replaced event target rejects stale protection and pass safely skips its old slot', t => {
  const f = fixture(t);
  f.play();
  const reply = f.protectCard(f.leader);
  const original = f.event('mewtwo-threat');
  f.expectWindow('cancel-event', f.target);
  const seat = f.player(f.target);
  [seat.active, seat.reserve] = [seat.reserve, seat.active];
  rejectAtomically(f, () => f.protect(reply), 'STALE_DECISION');
  f.respond();
  f.expectWindow('cancel-event', f.third);
  f.passWindow();
  f.respond();
  assertDone(f);
  assert.equal(f.player(f.target).active.damage, 0);
  assert.equal(f.player(f.third).active.damage, 2);
  assert.deepEqual(f.player(f.leader).hand, [reply]);
  assertOne(f.room(), original);
});

for (const field of ['card', 'index']) {
  test('protect rejects if the pinned event ' + field + ' changed while the prompt waited', t => {
    const f = fixture(t);
    f.play();
    const reply = f.protectCard(f.leader);
    f.event('mewtwo-threat');
    if (field === 'card') f.room().resolution.card.id = 'different-event-card';
    else f.room().resolution.index++;
    rejectAtomically(f, () => f.protect(reply), 'STALE_DECISION');
  });
}

for (const changed of ['status', 'active']) {
  test('a stale cure leaves the changed ' + changed + ' untouched and can pass safely', t => {
    const f = fixture(t);
    f.play();
    const reply = f.protectCard(f.leader);
    const original = beginSong(f);
    f.passWindow();
    f.expectWindow('cure-status', f.target);
    const seat = f.player(f.target);
    if (changed === 'active') {
      [seat.active, seat.reserve] = [seat.reserve, seat.active];
      seat.reserve.status = 'sleep';
    }
    seat.active.status = 'burn';
    rejectAtomically(f, () => f.protect(reply), 'STALE_DECISION');
    f.respond();
    assertDone(f);
    assert.equal(f.player(f.target).active.status, 'burn');
    if (changed === 'active') assert.equal(f.player(f.target).reserve.status, 'sleep');
    assert.deepEqual(f.player(f.leader).hand, [reply]);
    assertOne(f.room(), original);
  });
}

for (const mode of ['cancel-event', 'cure-status']) {
  test('restart retains the ' + mode + ' reaction and exactly one committed response', t => {
    const f = fixture(t, { responseSeconds: 5 });
    f.play();
    const reply = f.protectCard(f.target, { weather: 'rain' });
    const original = beginSong(f);
    if (mode === 'cure-status') f.passWindow();
    f.respond();
    f.expectWindow(mode, f.target, f.target);
    f.advance(2000);
    assert.equal(f.view(f.target).pendingBattle.clock.remainingMs, 3000);
    const restored = new RoomStore(f.options);
    const restoredRoom = () => restored.rooms.get(f.owner.code);
    assert.equal(restoredRoom().pendingBattle.clock.pausedReason, 'disconnected');
    assert.ok(restoredRoom().protectionWindow);
    const resumed = restored.view(f.owner.code, f.target.token).view;
    assert.equal(resumed.pendingBattle.id, f.pending().id);
    assert.equal(resumed.pendingBattle.clock.pausedReason, null);
    assert.equal(resumed.pendingBattle.clock.remainingMs, 3000);
    assert.deepEqual(resumed.pendingBattle.protectionCards.map(card => card.id), [reply.id]);

    const request = {
      id: 'restored-articuno', revision: resumed.revision, type: 'respondBattle',
      decisionId: resumed.pendingBattle.id, choice: 'protect', cardId: reply.id
    };
    restored.action(f.owner.code, f.target.token, request);
    const committed = structuredClone(restoredRoom());
    restored.action(f.owner.code, f.target.token, request);
    assert.deepEqual(restoredRoom(), committed);
    assert.equal(committed.pendingBattle, null);
    assert.equal(committed.protectionWindow ?? null, null);
    assert.equal(committed.players.find(player => player.id === f.target.playerId).active.status, null);
    for (const card of [reply, original]) assertOne(committed, card);
    assert.throws(() => restored.action(f.owner.code, f.target.token, { ...request, choice: 'pass' }),
      error => error.code === 'ACTION_ID_REUSED');
  });
}

test('each Articuno timeout passes only the current seat and the final timeout resumes the effect', t => {
  const f = fixture(t, { responseSeconds: 5 });
  f.play();
  const unused = f.protectCard(f.leader);
  f.judgments('thunderstorm');
  const original = beginSong(f);
  for (const who of f.seats) {
    f.expectWindow('cancel-event', f.target, who);
    const id = f.pending().id;
    f.advance(5000);
    f.view(who);
    assert.notEqual(f.pending()?.id, id);
  }
  assertDone(f);
  assert.equal(f.player(f.target).active.status, null);
  assert.deepEqual(f.player(f.leader).hand, [unused]);
  assertOne(f.room(), original);
});

test('a rejected end vote pauses and resumes the same clock and Articuno window', t => {
  const f = fixture(t, { responseSeconds: 5 });
  f.play();
  const reply = f.protectCard(f.leader);
  beginSong(f);
  const id = f.pending().id;
  f.advance(2000);
  f.act(f.owner, 'requestEndGame');
  assert.equal(f.pending().clock.remainingMs, 3000);
  assert.equal(f.pending().clock.pausedReason, 'vote');
  rejectAtomically(f, () => f.protect(reply), 'VOTE_PENDING');
  f.advance(5000);
  f.act(f.seats.find(who => who !== f.owner), 'rejectEnd');
  assert.equal(f.pending().id, id);
  assert.equal(f.pending().clock.pausedReason, null);
  assert.equal(f.pending().clock.remainingMs, 3000);
  f.protect(reply);
  assertDone(f);
});

test('a successful end vote clears the saved reaction before a stock rematch', t => {
  const f = fixture(t);
  f.play();
  f.protectCard(f.leader);
  beginSong(f);
  f.act(f.owner, 'requestEndGame');
  for (const who of f.seats.filter(who => who !== f.owner)) f.act(who, 'approveEnd');
  const restored = new RoomStore(f.options).rooms.get(f.owner.code);
  assert.equal(restored.status, 'lobby');
  assert.equal(restored.protectionWindow, undefined);
  assert.equal(restored.pendingBattle, undefined);
  assert.equal(restored.scenario, undefined);
  for (const who of f.seats) f.act(who, 'ready', { ready: true });
  const rematch = f.act(f.owner, 'startBattlePreview');
  assert.notEqual(rematch.scenario.articunoReactions, true);
  assert.equal(rematch.pendingBattle, null);
});
