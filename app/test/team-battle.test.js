import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoomStore } from '../server/store.js';
import { choosePublicStrategy } from '../public/ai-worker.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));

function createTeamRoom(t, teamAssignment) {
  const dataDir = mkdtempSync(join(tmpdir(), 'rocket-team-test-'));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const options = { dataDir, catalogue, now: () => 1_000_000 };
  let store = new RoomStore(options);
  const host = store.create({ nickname: 'Host' });
  const seats = [host];
  let sequence = 0;
  const room = () => store.rooms.get(host.code);
  const view = (who = host) => store.view(host.code, who.token).view;
  const act = (who, type, payload) => store.action(host.code, who.token, {
    id: `teams-${++sequence}`, type, revision: room().revision, ...payload,
  }).view;
  const settings = (matchMode, who = host) => act(who, 'settings', {
    matchMode, teamAssignment, arena: 'fire', turnSeconds: 0, responseSeconds: 0,
  });
  const joinRoom = (nickname, spectator = false) => store.join(host.code, { nickname, spectator });
  const add = () => {
    const trainer = joinRoom(`Trainer ${seats.length + 1}`);
    seats.push(trainer);
    return trainer;
  };
  const start = () => {
    for (const trainer of seats) act(trainer, 'ready', { ready: true });
    return act(host, 'startBattlePreview');
  };
  const select = candidateGroups => {
    for (const trainer of seats) act(trainer, 'acknowledgeIdentity');
    const groups = [];
    for (const [index, trainer] of seats.entries()) {
      if (candidateGroups) {
        room().players.find(player => player.id === trainer.playerId).candidateDeal = candidateGroups[index];
      }
      let pick;
      for (let draw = 0; draw < 5; draw++) pick = act(trainer, 'drawPokemon');
      assert.equal(new Set(pick.self.candidates).size, 5);
      groups.push(...pick.self.candidates);
      act(trainer, 'selectPokemon', { activeId: pick.self.candidates[0], reserveId: pick.self.candidates[1] });
    }
    return groups;
  };
  return { host, seats, act, view, settings, joinRoom, add, start, select, room, restart() { store = new RoomStore(options); } };
}

test('seat order alternates two equal public teams and an odd lineup cannot start', t => {
  const match = createTeamRoom(t, 'seat');
  assert.equal(match.view().settings.matchMode, undefined);
  match.settings('teams');
  assert.throws(() => match.start(), { code: 'INVALID_TEAM_SIZE' });
  const second = match.add();
  assert.throws(() => match.settings('identity', second), { code: 'OWNER_ONLY' });
  match.act(second, 'chooseSeat', { seatNumber: 12 });
  const third = match.add();
  assert.throws(() => match.start(), { code: 'INVALID_TEAM_SIZE' });
  match.add();
  const spectator = match.joinRoom('Observer', true);
  match.start();
  const projected = match.view(spectator);
  assert.deepEqual(projected.players.filter(p => !p.spectator).toSorted((a, b) => a.seatNumber - b.seatNumber)
    .map(p => [p.seatNumber, p.role]), [[1, 'team-a'], [2, 'team-b'], [3, 'team-a'], [12, 'team-b']]);
  assert.equal(projected.players.find(p => p.spectator).role, null);
  match.restart();
  assert.equal(match.view(third).self.role, 'team-b');
  const groups = match.select();
  assert.equal(new Set(groups).size, groups.length);
  assert.equal(match.view().scenario.deckCardCount, 108);
  assert.ok(match.view().players.filter(p => !p.spectator).every(p => p.active.level === 1 && p.hand === undefined));
  assert.deepEqual(match.view(spectator).self.hand, []);
  const turnOrder = match.room().players.filter(p => !p.spectator).map(p => p.seatNumber);
  const ring = [1, 2, 3, 12];
  const first = ring.indexOf(turnOrder[0]);
  assert.deepEqual(turnOrder, [...ring.slice(first), ...ring.slice(0, first)]);
  assert.equal(match.room().turn.playerId, match.room().players[0].id);
});

test('random teams accept 30 trainers and provide separate physical deck copies', t => {
  const match = createTeamRoom(t, 'random');
  match.settings('teams');
  while (match.seats.length < 30) match.add();
  assert.throws(() => match.settings('identity'), { code: 'TOO_MANY_TRAINERS' });
  assert.throws(() => match.joinRoom('Extra watcher', true), { code: 'ROOM_FULL' });
  const start = match.start();
  for (const role of ['team-a', 'team-b']) assert.equal(start.players.filter(p => p.role === role).length, 15);
  assert.equal(start.settings.teamAssignment, 'random');
  match.select();
  const room = match.room();
  const cards = [...room.drawPile, ...room.players.flatMap(p => p.hand)];
  assert.equal(room.status, 'playing');
  assert.equal(room.scenario.deckCardCount, 216);
  assert.equal(cards.length, 216);
  assert.equal(new Set(cards.map(card => card.id)).size, 216);
  for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) {
    assert.equal(cards.filter(card => card.weather === weather).length, 54);
  }
});

test('a two-human team battle resolves an actual final knockout and returns to its lobby', t => {
  const match = createTeamRoom(t, 'seat');
  match.settings('teams');
  match.add();
  match.start();
  match.select([
    ['bulbasaur','charmander','pidgey','caterpie','weedle'],
    ['squirtle','pikachu','abra','machop','mankey'],
  ]);
  const room = match.room();
  const [attacker, defender] = room.players;
  const who = id => match.seats.find(seat => seat.playerId === id);
  const pass = () => {
    const decision = match.room().pendingBattle;
    match.act(who(decision.actorId), 'respondBattle', { decisionId: decision.id, choice: 'pass' });
  };
  while (match.room().pendingBattle) pass();
  const source = match.room().players[0], target = match.room().players[1];
  // Set up the final knockout while retaining the real deck and battle actions.
  source.active.catalogueId = 'bulbasaur';
  target.active.catalogueId = 'squirtle';
  target.active.damage = catalogue.entries.find(row => row.id === 'squirtle').levels[0].hp - 1;
  target.reserve.defeated = true;
  const cmdIndex = match.room().drawPile.findIndex(card => card.kind === 'command');
  source.hand.push(...match.room().drawPile.splice(cmdIndex, 1));
  const cardId = source.hand.find(card => card.kind === 'command').id;
  while (match.room().turn.drawRemaining) match.act(who(attacker.id), 'draw');
  match.act(who(attacker.id), 'attack', { cardId, targetIds: [defender.id] });
  while (match.room().pendingBattle) pass();
  const ended = match.view();
  assert.equal(ended.status, 'finished');
  assert.equal(ended.result.winner, attacker.role);
  assert.deepEqual(ended.result.winnerIds, [attacker.id]);
  assert.ok(ended.players.every(p => Array.isArray(p.hand)));
  const lobby = match.act(match.host, 'returnToLobby');
  assert.equal(lobby.status, 'lobby');
  assert.equal(lobby.settings.matchMode, 'teams');
  assert.ok(lobby.players.every(p => p.role === undefined));
  assert.equal(match.settings('identity').settings.matchMode, undefined);
});

test('public AI strategy ranks opposing trainers in an open team battle', () => {
  const active = { catalogueId: 'bulbasaur', level: 1, hp: 4, maxHp: 4, power: 0, defense: 0 };
  const players = [
    { id: 'ai', role: 'team-a' }, { id: 'ally', role: 'team-a' }, { id: 'opponent', role: 'team-b' },
  ].map(seat => ({ ...seat, active, handCount: 4 }));
  assert.deepEqual(choosePublicStrategy({ actorId: 'ai', players, difficulty: 'hard' }).targetIds, ['opponent']);
});
