import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { RoomStore } from '../server/store.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url)));

function fixture(t, { protection = false } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'remaining-events-'));
  t.after(() => {
    assert.equal(resolve(dirname(dataDir)), resolve(tmpdir()));
    rmSync(dataDir, { recursive: true, force: true });
  });
  const store = new RoomStore({ allowTestDecks: true, dataDir, catalogue });
  const owner = store.create({ nickname: 'Trainer 1' });
  const joined = [owner, ...[2, 3].map(number => store.join(owner.code, { nickname: `Trainer ${number}` }))];
  const room = () => store.rooms.get(owner.code);
  const player = seat => room().players.find(member => member.id === seat.playerId);
  const view = seat => store.view(owner.code, seat.token).view;
  let serial = 0;
  const action = (seat, type, fields = {}) => store.action(owner.code, seat.token, {
    id: `remaining-action-${++serial}`, revision: room().revision, type, ...fields
  });
  joined.forEach(seat => action(seat, 'ready', { ready: true }));
  action(owner, 'startBattlePreview');
  joined.forEach(seat => action(seat, 'acknowledgeIdentity'));
  for (const seat of joined) {
    for (let index = 0; index < 5; index++) action(seat, 'drawPokemon');
    const candidates = view(seat).self.candidates;
    const activeId = candidates.find(id => !['koffing', 'jynx', 'tauros'].includes(id));
    action(seat, 'selectPokemon', { activeId, reserveId: candidates.find(id => id !== activeId) });
  }
  const seats = room().players.map(member => joined.find(seat => seat.playerId === member.id));
  const [leader, opponent, third] = seats;
  while (room().turn.drawRemaining) action(leader, 'draw');
  for (const seat of seats) {
    const member = player(seat);
    member.hand = [];
    Object.assign(member.active, { catalogueId: 'squirtle', level: 2, damage: 0, hpBonus: 10, reinforcements: [] });
  }
  room().scenario.articunoReactions = protection;
  room().drawPile = [];
  room().discardPile = [];
  const card = (label, fields = {}) => ({
    id: `private-card-${++serial}`, kind: 'command', weather: 'rain', name: { en: label, zh: label }, ...fields
  });
  const give = (seat, physicalCard) => player(seat).hand.push(physicalCard);
  const use = (eventType, fields = {}) => {
    const physicalCard = card(eventType, { kind: 'event', eventType });
    give(leader, physicalCard);
    action(leader, 'useEvent', { cardId: physicalCard.id, ...fields });
    return physicalCard;
  };
  const pending = () => room().pendingBattle;
  const respond = (choice, fields = {}, seat = seats.find(member => member.playerId === pending().actorId)) =>
    action(seat, 'respondBattle', { decisionId: pending().id, choice, ...fields });
  const spectator = store.join(owner.code, { nickname: 'Observer', spectator: true });
  return { room, player, view, seats, leader, opponent, third, spectator, card, give, use, pending, respond };
}

test('Rival starts with the selected trainer and an opening pass has no damage source', t => {
  const f = fixture(t);
  const event = f.use('rival-challenge', { targetId: f.opponent.playerId });
  assert.equal(f.pending().actorId, f.opponent.playerId);
  f.respond('pass');
  assert.equal(f.player(f.opponent).active.damage, 0);
  assert.equal(f.player(f.leader).active.damage, 0);
  assert.deepEqual(f.room().discardPile, [event]);
});

test('Rival accepts only the responder’s actual command and attributes the hit to the last player', t => {
  const f = fixture(t);
  const opening = f.card('Opening command'), answer = f.card('Answer command');
  f.give(f.opponent, opening);
  f.give(f.leader, answer);
  f.player(f.opponent).active.status = 'paralysis';
  f.player(f.leader).active.reinforcements.push('power');
  f.use('rival-challenge', { targetId: f.opponent.playerId });
  assert.throws(() => f.respond('command', { cardId: answer.id }), { code: 'INVALID_CARD' });
  f.respond('command', { cardId: opening.id });
  assert.equal(f.pending().actorId, f.leader.playerId);
  f.respond('command', { cardId: answer.id });
  f.respond('pass');
  assert.equal(f.player(f.opponent).active.damage, 2);
  assert.deepEqual(f.player(f.leader).active.reinforcements, ['power']);
  assert.deepEqual(f.room().discardPile.slice(0, 2), [opening, answer]);
});

test('Rival can damage the event user and Synchronize can claim the causative event', t => {
  const f = fixture(t);
  Object.assign(f.player(f.leader).active, { catalogueId: 'abra', level: 2 });
  const opening = f.card('Opening command');
  f.give(f.opponent, opening);
  const event = f.use('rival-challenge', { targetId: f.opponent.playerId });
  f.respond('command', { cardId: opening.id });
  f.respond('pass');
  assert.equal(f.player(f.leader).active.damage, 2);
  assert.equal(f.room().resolution.sourcePlayerId, f.opponent.playerId);
  assert.equal(f.pending().kind, 'synchronize');
  f.respond('trait');
  assert.deepEqual(f.player(f.leader).hand, [event]);
  assert.deepEqual(f.room().discardPile, [opening]);
});

test('Berry reveals one face per trainer without physical IDs and offers the remaining pool in order', t => {
  const f = fixture(t);
  const cards = ['First', 'Second', 'Third'].map(label => f.card(label));
  f.room().drawPile = [...cards].reverse();
  const event = f.use('berry-harvest');
  const firstView = f.view(f.spectator);
  const activeEvent = firstView.activeCardEvent;
  assert.equal(activeEvent.effect, 'berry-harvest');
  assert.equal(activeEvent.eventId, firstView.visualEvents.findLast(cue=>cue.kind==='event').eventId);
  const observed = firstView.pendingBattle.berryCards;
  assert.deepEqual(observed.map(card => card.name.en), ['First', 'Second', 'Third']);
  assert.ok(observed.every(card => card.id === undefined));
  assert.throws(() => f.respond('card', { handIndex: 0 }, f.opponent), { code: 'NOT_YOUR_DECISION' });
  assert.throws(() => f.respond('pass'), { code: 'INVALID_RESPONSE' });
  f.respond('card', { handIndex: 2 });
  assert.equal(f.pending().actorId, f.opponent.playerId);
  assert.deepEqual(f.view(f.spectator).activeCardEvent, activeEvent);
  assert.deepEqual(f.view(f.spectator).pendingBattle.berryCards.map(card => card.name.en), ['First', 'Second']);
  f.respond('card', { handIndex: 0 });
  f.respond('card', { handIndex: 0 });
  assert.equal(f.view(f.spectator).activeCardEvent, null);
  assert.deepEqual(f.seats.map(seat => f.player(seat).hand[0]), [cards[2], cards[0], cards[1]]);
  assert.deepEqual(f.room().discardPile, [event]);
});

test('Berry keeps its pool through Articuno and discards the unclaimed card at the end', t => {
  const f = fixture(t, { protection: true });
  const cards = ['First', 'Second', 'Third'].map(label => f.card(label));
  f.room().drawPile = [...cards].reverse();
  const art = f.card('Articuno', { kind: 'event', eventType: 'articuno-protection' });
  f.give(f.leader, art);
  const event = f.use('berry-harvest');
  assert.equal(f.view(f.spectator).pendingBattle.berryCards.length, 3);
  f.respond('protect', { cardId: art.id });
  for (const seat of [f.opponent, f.third]) {
    assert.equal(f.pending().targetId, seat.playerId);
    for (const responder of f.seats) f.respond('pass', {}, responder);
    f.respond('card', { handIndex: 0 });
  }
  assert.deepEqual(f.player(f.leader).hand, []);
  assert.deepEqual(f.room().discardPile, [art, event, cards[2]]);
});

test('Berry with a short supply offers the real card and finishes when the pool is empty', t => {
  const f = fixture(t);
  const card = f.card('Only available card');
  f.room().drawPile.push(card);
  const event = f.use('berry-harvest');
  f.respond('card', { handIndex: 0 });
  assert.deepEqual(f.player(f.leader).hand, [card]);
  assert.equal(f.pending(), null);
  assert.deepEqual(f.room().discardPile, [event]);
});

test('Farfetch’d discards an opponent hand card from a private blind choice', t => {
  const f = fixture(t);
  const hidden = f.card('Hidden face');
  f.give(f.opponent, hidden);
  const event = f.use('farfetchd-prank', { targetId: f.opponent.playerId, effect: 'hand' });
  assert.deepEqual(f.view(f.leader).pendingBattle.choices, [{ index: 0 }]);
  assert.equal(f.view(f.spectator).pendingBattle.choices, undefined);
  assert.equal(f.view(f.spectator).visualEvents.some(cue=>cue.kind==='event-action'), false);
  const eventId = f.view(f.spectator).activeCardEvent.eventId;
  f.respond('card', { handIndex: 0 });
  const {id, ...animation} = f.view(f.spectator).visualEvents.at(-1);
  assert.deepEqual(animation, {
    kind:'event-action', eventId, effect:'farfetchd-prank', action:'discard', object:'card',
    sourceId:f.leader.playerId, targetIds:[f.opponent.playerId],
    name:{en:'Farfetch’d’s Prank',zh:'大葱鸭的恶作剧'},
  });
  assert.deepEqual(f.room().discardPile, [hidden, event]);
  assert.deepEqual(f.player(f.leader).hand, []);
  assert.deepEqual(f.player(f.opponent).hand, []);
});

test('Farfetch’d removes only one matching marker, including on the user’s own active Pokémon', t => {
  const f = fixture(t);
  f.player(f.leader).active.reinforcements = ['power', 'speed', 'power'];
  f.use('farfetchd-prank', { targetId: f.leader.playerId, effect: 'power' });
  assert.deepEqual(f.player(f.leader).active.reinforcements, ['speed', 'power']);
});

test('Farfetch’d discards the actual held item and resumes after Defiant', t => {
  const f = fixture(t);
  const item = f.card('Rocky Helmet', { kind: 'held-item', itemType: 'rocky-helmet' });
  Object.assign(f.player(f.opponent).active, { catalogueId: 'mankey', item });
  const event = f.use('farfetchd-prank', { targetId: f.opponent.playerId, effect: 'item' });
  assert.equal(f.player(f.opponent).active.item, undefined);
  assert.equal(f.pending().kind, 'defiant');
  const animation = f.view(f.spectator).visualEvents.at(-1);
  assert.equal(animation.action, 'discard');
  assert.equal(animation.itemType, 'rocky-helmet');
  f.respond('pass');
  assert.deepEqual(f.room().discardPile, [item, event]);
  assert.equal(f.pending(), null);
});
