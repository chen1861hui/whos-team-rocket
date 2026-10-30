import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore, IDLE_MS, OWNER_GRACE_MS, CONNECTED_MS } from '../server/store.js';
import { createApplication } from '../server/index.js';

const catalogue = { entries: Array.from({ length: 10 }, (_, index) => ({ id: `pokemon-${index}` })) };
function fixture(t) {
  const testRoot = fileURLToPath(new URL('../.data/', import.meta.url));
  mkdirSync(testRoot, { recursive: true });
  const dir = mkdtempSync(join(testRoot, 'test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  let time = 1_000_000;
  const store = new RoomStore({ dataDir: join(dir, 'data'), catalogue, now: () => time });
  const a = store.create({ nickname: 'A' });
  const b = store.join(a.code, { nickname: 'B' });
  let nextId = 0;
  const act = (who, type, payload = {}, overrides = {}) => store.action(a.code, who.token, { id: `action-${++nextId}`, revision: store.rooms.get(a.code).revision, type, ...payload, ...overrides });
  const start = () => {
    act(a, 'ready', { ready: true }); act(b, 'ready', { ready: true }); act(a, 'start');
  };
  const play = () => {
    start();
    for (const who of [a, b]) {
      const picks = store.view(a.code, who.token).view.self.candidates;
      act(who, 'selectPokemon', { activeId: picks[0], reserveId: picks[1] });
    }
  };
  return { dir, store, a, b, act, start, play, advance: ms => { time += ms; }, now: () => time };
}
function rejects(fn, code, status) { assert.throws(fn, error => error.code === code && (!status || error.status === status)); }
function timedFixture(t, seconds = 10) {
  const f = fixture(t);
  f.act(f.a, 'settings', { arena: 'stadium', turnSeconds: seconds, responseSeconds: 15 });
  f.play();
  return f;
}
function discardExcess(f, who = f.a) {
  while (f.store.view(f.a.code, who.token).view.self.hand.length > 4) {
    const cardId = f.store.view(f.a.code, who.token).view.self.hand[0].id;
    f.act(who, 'discard', { cardId });
  }
}
function reachEnd(f, who = f.a) {
  f.act(who, 'draw'); f.act(who, 'draw'); f.act(who, 'finishPlay'); discardExcess(f, who);
}

test('private setup and hands project only to their credential; spectators receive no private selections', t => {
  const { store, a, b, act, start } = fixture(t);
  const spectator = store.join(a.code, { nickname: 'Observer', spectator: true });
  start();
  const av = store.view(a.code, a.token).view;
  const bv = store.view(a.code, b.token).view;
  assert.equal(av.self.candidates.length, 5);
  assert.equal(new Set(av.self.candidates).size, 5);
  assert.equal(bv.self.candidates.length, 5);
  const sv = store.view(a.code, spectator.token).view;
  assert.deepEqual(sv.self, { spectator: true, hand: [], candidates: [], reserve: null });
  for (const player of av.players) {
    assert.equal(player.candidates, undefined); assert.equal(player.hand, undefined); assert.equal(player.reserve, undefined); assert.equal(player.tokenHash, undefined);
  }
  rejects(() => act(a, 'selectPokemon', { activeId: av.self.candidates[0], reserveId: av.self.candidates[0] }), 'INVALID_SELECTION');
  rejects(() => act(spectator, 'selectPokemon', { activeId: 'pokemon-0', reserveId: 'pokemon-1' }), 'SPECTATOR_ONLY_VIEW');
  act(a, 'selectPokemon', { activeId: av.self.candidates[0], reserveId: av.self.candidates[1] });
  assert.equal(store.view(a.code, b.token).view.players.find(player => player.id === a.playerId).active, null);
  assert.equal(store.view(a.code, spectator.token).view.players.find(player => player.id === a.playerId).active, null);
  assert.equal(store.view(a.code, a.token).view.players.find(player => player.id === a.playerId).active.catalogueId, av.self.candidates[0]);
  act(b, 'selectPokemon', { activeId: bv.self.candidates[0], reserveId: bv.self.candidates[1] });
  const playing = store.view(a.code, a.token).view;
  assert.equal(playing.self.hand.length, 4);
  const serializedSpectator = JSON.stringify(store.view(a.code, spectator.token).view);
  for (const card of playing.self.hand) assert.ok(!serializedSpectator.includes(card.id));
  assert.equal(JSON.stringify(playing).includes(a.token), false);
  assert.equal(JSON.stringify(playing).includes('tokenHash'), false);
});

test('authoritative turns enforce both draws, excess discards, player identity, and no invented card effects', t => {
  const { store, a, b, act, play } = fixture(t);
  play();
  rejects(() => act(b, 'draw'), 'NOT_YOUR_TURN');
  rejects(() => act(a, 'endTurn'), 'TURN_INCOMPLETE');
  rejects(() => act(a, 'discard', { cardId: store.view(a.code, a.token).view.self.hand[0].id }), 'DISCARD_NOT_ALLOWED');
  act(a, 'draw');
  rejects(() => act(a, 'endTurn'), 'TURN_INCOMPLETE');
  act(a, 'draw');
  rejects(() => act(a, 'draw'), 'DRAW_EXHAUSTED');
  rejects(() => act(a, 'endTurn'), 'TURN_INCOMPLETE');
  rejects(() => act(a, 'discard', { cardId: store.view(a.code, a.token).view.self.hand[0].id }), 'DISCARD_NOT_ALLOWED');
  assert.equal(act(a, 'finishPlay').view.turn.phase, 'discard');
  rejects(() => act(a, 'discard', { cardId: store.view(a.code, b.token).view.self.hand[0].id }), 'INVALID_CARD');
  for (let i = 0; i < 2; i++) act(a, 'discard', { cardId: store.view(a.code, a.token).view.self.hand[0].id });
  rejects(() => act(a, 'discard', { cardId: store.view(a.code, a.token).view.self.hand[0].id }), 'DISCARD_NOT_ALLOWED');
  rejects(() => act(a, 'playCard', { cardId: 'anything' }), 'UNKNOWN_ACTION');
  const result = act(a, 'endTurn').view;
  assert.deepEqual(result.turn, { playerId: b.playerId, drawRemaining: 2, number: 2, phase: 'draw', switchUsed: false, discardComplete: false, clock: null });
  assert.ok(result.log.every(entry => !entry.text.en.includes('pokemon-')));
});

test('stale actions fail without mutation; exact retries are idempotent, including prototype-like ids and after restart', t => {
  const f = fixture(t);
  const { store, a, b, act, play } = f;
  play();
  const revision = store.view(a.code, a.token).view.revision;
  const input = { id: '__proto__', revision, type: 'draw' };
  const first = store.action(a.code, a.token, input).view;
  const retry = store.action(a.code, a.token, input).view;
  assert.equal(retry.revision, first.revision);
  assert.equal(retry.self.hand.length, 5);
  rejects(() => store.action(a.code, a.token, { ...input, type: 'endTurn' }), 'ACTION_ID_REUSED');
  rejects(() => store.action(a.code, a.token, { ...input, id: 'new', revision }), 'STALE_REVISION');
  assert.equal(store.view(a.code, a.token).view.revision, first.revision);
  const restored = new RoomStore({ dataDir: join(f.dir, 'data'), catalogue, now: f.now });
  assert.equal(restored.action(a.code, a.token, input).view.self.hand.length, 5);
  assert.equal(restored.view(a.code, b.token).view.self.hand.length, 4);
  const saved = readFileSync(join(f.dir, 'data', `${a.code}.json`), 'utf8');
  assert.ok(!saved.includes(a.token));
});

test('optional end-turn level increase affects only the active Pokémon once and stops at level three', t => {
  const f = fixture(t);
  f.play();
  const initial = f.store.view(f.a.code, f.a.token).view;
  const active = initial.players.find(player => player.id === f.a.playerId).active;
  const reserve = initial.self.reserve;
  reachEnd(f);
  const input = { id: 'level-one-to-two', revision: f.store.rooms.get(f.a.code).revision, type: 'endTurn', levelUp: true };
  const first = f.store.action(f.a.code, f.a.token, input).view;
  assert.deepEqual(first.players.find(player => player.id === f.a.playerId).active, { ...active, level: 2 });
  assert.deepEqual(first.self.reserve, reserve);
  const retry = f.store.action(f.a.code, f.a.token, input).view;
  assert.equal(retry.revision, first.revision);
  assert.equal(retry.players.find(player => player.id === f.a.playerId).active.level, 2);
  assert.equal(retry.log.filter(entry => entry.text.en.includes('raise their active Pokémon')).length, 1);
  assert.equal(retry.log.some(entry => entry.text.en.includes(active.catalogueId)), false);
  reachEnd(f, f.b); f.act(f.b, 'endTurn');
  assert.equal(f.store.view(f.a.code, f.b.token).view.players.find(player => player.id === f.b.playerId).active.level, 1);
  reachEnd(f);
  assert.equal(f.act(f.a, 'endTurn', { levelUp: true }).view.players.find(player => player.id === f.a.playerId).active.level, 3);
  reachEnd(f, f.b); f.act(f.b, 'endTurn', { levelUp: false }); reachEnd(f);
  const before = f.store.view(f.a.code, f.a.token).view;
  rejects(() => f.act(f.a, 'endTurn', { levelUp: true }), 'LEVEL_CAP');
  const capped = f.store.view(f.a.code, f.a.token).view;
  assert.equal(capped.revision, before.revision);
  assert.equal(capped.turn.phase, 'end');
  assert.deepEqual(capped.self.reserve, reserve);
  assert.equal(f.act(f.a, 'endTurn').view.players.find(player => player.id === f.a.playerId).active.level, 3);
});

test('end-turn level choice rejects invalid values, the wrong player, and incomplete phases without changing levels', t => {
  const f = fixture(t);
  f.play();
  rejects(() => f.act(f.a, 'endTurn', { levelUp: true }), 'TURN_INCOMPLETE');
  rejects(() => f.act(f.b, 'endTurn', { levelUp: true }), 'NOT_YOUR_TURN');
  f.act(f.a, 'draw'); f.act(f.a, 'draw');
  rejects(() => f.act(f.a, 'endTurn', { levelUp: true }), 'TURN_INCOMPLETE');
  f.act(f.a, 'finishPlay');
  rejects(() => f.act(f.a, 'endTurn', { levelUp: true }), 'TURN_INCOMPLETE');
  discardExcess(f);
  const before = f.store.view(f.a.code, f.a.token).view;
  for (const levelUp of [null, 0, 1, 'true', {}, []]) rejects(() => f.act(f.a, 'endTurn', { levelUp }), 'INVALID_INPUT');
  const after = f.store.view(f.a.code, f.a.token).view;
  assert.equal(after.revision, before.revision);
  assert.equal(after.players.find(player => player.id === f.a.playerId).active.level, 1);
  assert.equal(f.act(f.a, 'endTurn', { levelUp: false }).view.players.find(player => player.id === f.a.playerId).active.level, 1);
});

test('closure needs the connected seated electorate; reject cancels and endGame clears private state', t => {
  const { store, a, b, act, play } = fixture(t);
  const spectator = store.join(a.code, { nickname: 'Observer', spectator: true });
  play();
  rejects(() => act(b, 'requestEndGame'), 'OWNER_ONLY');
  const proposal = act(a, 'requestEndGame').view;
  assert.deepEqual(proposal.pendingVote.requiredIds, [a.playerId, b.playerId]);
  assert.deepEqual(proposal.pendingVote.approvedIds, [a.playerId]);
  rejects(() => act(a, 'draw'), 'VOTE_PENDING');
  rejects(() => act(spectator, 'approveEnd'), 'SPECTATOR_ONLY_VIEW');
  assert.equal(act(b, 'rejectEnd').view.pendingVote, null);
  act(a, 'requestEndGame');
  const ended = act(b, 'approveEnd').view;
  assert.equal(ended.status, 'lobby'); assert.equal(ended.turn, null);
  assert.deepEqual(ended.self.hand, []); assert.deepEqual(ended.self.candidates, []); assert.equal(ended.self.reserve, null);
  assert.ok(ended.players.every(player => player.active === null && player.reserveCount === 0 && !player.ready));
  const revision = ended.revision;
  const close = { id: 'close', type: 'requestEndRoom', revision };
  assert.equal(store.action(a.code, a.token, close).view.status, 'closed');
  assert.equal(store.action(a.code, a.token, close).view.status, 'closed');
  rejects(() => store.join(a.code, { nickname: 'New' }), 'ROOM_CLOSED', 410);
  rejects(() => store.view(a.code, a.token), 'ROOM_CLOSED', 410);
});

test('polls preserve inactivity expiry; expiry removes persisted room and credentials', t => {
  const f = fixture(t);
  const initial = f.store.view(f.a.code, f.a.token).view;
  f.advance(IDLE_MS - 1);
  assert.equal(f.store.view(f.a.code, f.a.token).view.expiresAt, initial.expiresAt);
  f.advance(1);
  rejects(() => f.store.view(f.a.code, f.a.token), 'ROOM_NOT_FOUND');
  assert.deepEqual(readdirSync(join(f.dir, 'data')), []);
});

test('disconnect transfers ownership after grace; recovery preserves identity; required disconnected turns are never skipped', t => {
  const f = fixture(t);
  f.play();
  f.advance(OWNER_GRACE_MS + 1);
  const recovered = f.store.view(f.a.code, f.b.token).view;
  assert.equal(recovered.selfId, f.b.playerId);
  assert.equal(recovered.ownerId, f.b.playerId);
  assert.equal(recovered.turn.playerId, f.a.playerId);
  rejects(() => f.act(f.b, 'draw'), 'NOT_YOUR_TURN');
  assert.equal(f.store.view(f.a.code, f.a.token).view.selfId, f.a.playerId);
  rejects(() => f.store.view(f.a.code, f.a.playerId), 'UNAUTHORIZED');
  rejects(() => f.store.view(f.a.code, 'A'), 'UNAUTHORIZED');
  const oldOwnerRecovery = f.store.view(f.a.code, f.a.token).view;
  assert.equal(oldOwnerRecovery.ownerId, f.b.playerId);
});

test('restart gives the offline owner sixty seconds to recover without extending room expiry', t => {
  const f = fixture(t);
  const expiresAt = f.store.view(f.a.code, f.a.token).view.expiresAt;
  const restored = new RoomStore({ dataDir: join(f.dir, 'data'), catalogue, now: f.now });
  const immediate = restored.view(f.a.code, f.b.token).view;
  assert.equal(immediate.ownerId, f.a.playerId);
  assert.equal(immediate.players.find(player => player.id === f.a.playerId).connected, false);
  assert.equal(immediate.expiresAt, expiresAt);
  f.advance(OWNER_GRACE_MS - 1);
  assert.equal(restored.view(f.a.code, f.b.token).view.ownerId, f.a.playerId);
  f.advance(1);
  assert.equal(restored.view(f.a.code, f.b.token).view.ownerId, f.b.playerId);
  assert.equal(restored.view(f.a.code, f.b.token).view.expiresAt, expiresAt);

  // An owner who recovers during a subsequent restart keeps ownership beyond startup grace.
  const again = new RoomStore({ dataDir: join(f.dir, 'data'), catalogue, now: f.now });
  f.advance(OWNER_GRACE_MS - 1);
  assert.equal(again.view(f.a.code, f.b.token).view.ownerId, f.b.playerId);
  f.advance(2);
  assert.equal(again.view(f.a.code, f.a.token).view.ownerId, f.b.playerId);
});

test('a required voter disconnecting does not silently approve closure; spectator is excluded', t => {
  const f = fixture(t);
  f.play();
  f.act(f.a, 'requestEndRoom');
  f.advance(OWNER_GRACE_MS + 1);
  const view = f.store.view(f.a.code, f.a.token).view;
  assert.equal(view.status, 'playing');
  assert.deepEqual(view.pendingVote.requiredIds, [f.a.playerId, f.b.playerId]);
  const final = f.act(f.b, 'approveEnd').view;
  assert.equal(final.status, 'closed');
});

test('clock expiry skips optional play but leaves mandatory draw and discard choices with the player', t => {
  const f = timedFixture(t);
  const initial = f.store.view(f.a.code, f.a.token).view;
  assert.equal(initial.serverNow, f.now());
  assert.deepEqual(initial.turn.clock, { remainingMs: 10_000, deadlineAt: f.now() + 10_000, pausedReason: null, expired: false });
  f.advance(10_000);
  const expired = f.store.view(f.a.code, f.a.token).view;
  assert.equal(expired.turn.phase, 'draw');
  assert.equal(expired.turn.drawRemaining, 2);
  assert.equal(expired.self.hand.length, 4);
  assert.deepEqual(expired.turn.clock, { remainingMs: 0, deadlineAt: null, pausedReason: 'mandatory', expired: true });
  const revision = expired.revision;
  f.store.cleanup(); f.store.cleanup();
  assert.equal(f.store.view(f.a.code, f.a.token).view.revision, revision);
  f.act(f.a, 'draw');
  assert.equal(f.act(f.a, 'draw').view.turn.phase, 'discard');
  assert.equal(f.store.view(f.a.code, f.a.token).view.self.hand.length, 6);
  discardExcess(f);
  const next = f.store.view(f.a.code, f.a.token).view;
  assert.equal(next.turn.playerId, f.b.playerId);
  assert.equal(next.turn.number, 2);
  assert.equal(next.turn.clock.expired, false);
  assert.equal(next.turn.clock.remainingMs, 10_000);
  assert.equal(next.players.find(player => player.id === f.a.playerId).active.level, 1);
  assert.deepEqual(next.self.reserve, initial.self.reserve);
  assert.equal(next.settings.responseSeconds, 15);
  assert.equal(next.expiresAt, next.lastActionAt + IDLE_MS);
});

test('play timeout and discard timeout never choose a discard and advance only after the last required choice', t => {
  for (const phase of ['play', 'discard']) {
    const f = timedFixture(t);
    f.act(f.a, 'draw'); f.act(f.a, 'draw');
    if (phase === 'discard') f.act(f.a, 'finishPlay');
    const before = f.store.view(f.a.code, f.a.token).view;
    f.advance(10_000);
    const expired = f.store.view(f.a.code, f.a.token).view;
    assert.equal(expired.turn.phase, 'discard');
    assert.deepEqual(expired.self.hand, before.self.hand);
    assert.equal(expired.lastActionAt, before.lastActionAt);
    assert.equal(expired.expiresAt, before.expiresAt);
    discardExcess(f);
    assert.equal(f.store.view(f.a.code, f.a.token).view.turn.number, 2);
  }
});

test('expiry in the end phase advances once without an extra click or extending inactivity expiry', t => {
  const f = timedFixture(t);
  f.act(f.a, 'draw'); f.act(f.a, 'draw'); f.act(f.a, 'finishPlay'); discardExcess(f);
  const ended = f.store.view(f.a.code, f.a.token).view;
  assert.equal(ended.turn.phase, 'end');
  f.advance(10_000);
  f.store.cleanup();
  const next = f.store.view(f.a.code, f.a.token).view;
  assert.equal(next.turn.playerId, f.b.playerId);
  assert.equal(next.turn.number, 2);
  assert.equal(next.turn.clock.remainingMs, 10_000);
  assert.equal(next.lastActionAt, ended.lastActionAt);
  assert.equal(next.expiresAt, ended.expiresAt);
  assert.equal(next.players.find(player => player.id === f.a.playerId).active.level, 1);
  assert.deepEqual(next.self.reserve, ended.self.reserve);
  f.store.cleanup();
  assert.equal(f.store.view(f.a.code, f.a.token).view.revision, next.revision);
});

test('timer pauses at the presence boundary, only its player resumes it, and an offline next player is never skipped', t => {
  const f = timedFixture(t, 60);
  const initial = f.store.view(f.a.code, f.a.token).view;
  f.advance(CONNECTED_MS + 5_000);
  const paused = f.store.view(f.a.code, f.b.token).view;
  assert.deepEqual(paused.turn.clock, { remainingMs: 30_000, deadlineAt: null, pausedReason: 'disconnected', expired: false });
  f.advance(20_000);
  assert.deepEqual(f.store.view(f.a.code, f.b.token).view.turn.clock, paused.turn.clock);
  const resumed = f.store.view(f.a.code, f.a.token).view;
  assert.equal(resumed.turn.clock.remainingMs, 30_000);
  assert.equal(resumed.turn.clock.deadlineAt, f.now() + 30_000);
  assert.equal(resumed.lastActionAt, initial.lastActionAt);
  f.advance(30_001);
  const expired = f.store.view(f.a.code, f.a.token).view;
  assert.equal(expired.turn.clock.expired, true);
  f.act(f.a, 'draw'); f.act(f.a, 'draw'); discardExcess(f);
  const next = f.store.view(f.a.code, f.a.token).view;
  assert.equal(next.turn.playerId, f.b.playerId);
  assert.equal(next.turn.number, 2);
  assert.deepEqual(next.turn.clock, { remainingMs: 60_000, deadlineAt: null, pausedReason: 'disconnected', expired: false });
  f.advance(90_000);
  assert.equal(f.store.view(f.a.code, f.a.token).view.turn.number, 2);
});

test('closing votes preserve remaining clock time, rejection resumes, and expiry precedes a later disconnect', t => {
  const f = timedFixture(t);
  f.advance(2_000);
  const vote = f.act(f.a, 'requestEndGame').view;
  assert.deepEqual(vote.turn.clock, { remainingMs: 8_000, deadlineAt: null, pausedReason: 'vote', expired: false });
  const idle = vote.expiresAt;
  f.advance(20_000);
  assert.deepEqual(f.store.view(f.a.code, f.a.token).view.turn.clock, vote.turn.clock);
  assert.equal(f.store.view(f.a.code, f.b.token).view.expiresAt, idle);
  const rejected = f.act(f.b, 'rejectEnd').view;
  assert.equal(rejected.turn.clock.deadlineAt, f.now() + 8_000);
  assert.equal(rejected.turn.clock.remainingMs, 8_000);
  f.advance(CONNECTED_MS + 20_000);
  const expired = f.store.view(f.a.code, f.b.token).view;
  assert.equal(expired.turn.clock.expired, true);
  assert.equal(expired.turn.clock.pausedReason, 'mandatory');
  assert.equal(expired.turn.drawRemaining, 2);
});

test('restart restores clock checkpoints without server downtime, including zero expired mandatory clocks', t => {
  const f = timedFixture(t);
  f.advance(3_000);
  const saved = f.store.view(f.a.code, f.a.token).view;
  f.advance(100_000);
  const restored = new RoomStore({ dataDir: join(f.dir, 'data'), catalogue, now: f.now });
  const other = restored.view(f.a.code, f.b.token).view;
  assert.equal(other.turn.clock.remainingMs, 7_000);
  assert.equal(other.turn.clock.pausedReason, 'disconnected');
  assert.equal(other.expiresAt, saved.expiresAt);
  const recovered = restored.view(f.a.code, f.a.token).view;
  assert.equal(recovered.turn.clock.deadlineAt, f.now() + 7_000);
  f.advance(7_000);
  restored.view(f.a.code, f.a.token);
  f.advance(100_000);
  const again = new RoomStore({ dataDir: join(f.dir, 'data'), catalogue, now: f.now });
  assert.deepEqual(again.view(f.a.code, f.a.token).view.turn.clock, { remainingMs: 0, deadlineAt: null, pausedReason: 'mandatory', expired: true });
});

test('accepted retries at the timeout boundary apply once; clock and phase payload edits are rejected', t => {
  const f = timedFixture(t);
  const input = { id: 'boundary-draw', revision: f.store.rooms.get(f.a.code).revision, type: 'draw' };
  f.advance(9_999);
  f.store.action(f.a.code, f.a.token, input);
  f.advance(1);
  const retry = f.store.action(f.a.code, f.a.token, input).view;
  assert.equal(retry.turn.drawRemaining, 1);
  assert.equal(retry.self.hand.length, 5);
  assert.equal(retry.turn.clock.expired, true);
  const revision = retry.revision;
  assert.equal(f.store.action(f.a.code, f.a.token, input).view.revision, revision);
  for (const payload of [{ phase: 'end' }, { clock: null }, { remainingMs: 90000 }, { deadlineAt: f.now() + 90000 }]) {
    rejects(() => f.act(f.a, 'draw', payload), 'INVALID_INPUT');
  }
  assert.equal(f.store.view(f.a.code, f.a.token).view.turn.drawRemaining, 1);
  assert.equal(f.store.view(f.a.code, f.a.token).view.lastActionAt, retry.lastActionAt);
});

test('legacy persisted turns infer draw or play and keep untimed games untimed', t => {
  for (const remaining of [2, 0]) {
    const f = fixture(t);
    f.play();
    const path = join(f.dir, 'data', `${f.a.code}.json`);
    const room = JSON.parse(readFileSync(path, 'utf8'));
    room.turn = { playerId: f.a.playerId, number: 3, drawRemaining: remaining };
    writeFileSync(path, JSON.stringify(room));
    const restored = new RoomStore({ dataDir: join(f.dir, 'data'), catalogue, now: f.now });
    const turn = restored.view(f.a.code, f.a.token).view.turn;
    assert.equal(turn.phase, remaining ? 'draw' : 'play');
    assert.equal(turn.clock, null);
    assert.equal(turn.switchUsed, false);
    if (!remaining) {
      const input = { id: 'finish-legacy', revision: restored.rooms.get(f.a.code).revision, type: 'finishPlay' };
      assert.equal(restored.action(f.a.code, f.a.token, input).view.turn.phase, 'end');
    }
  }
});

test('HTTP separates credentials and JSON errors, bounds bodies, and serves only public allowlist', async t => {
  const f = fixture(t);
  const publicDir = join(f.dir, 'public');
  mkdirSync(publicDir);
  writeFileSync(join(publicDir, 'index.html'), '<!doctype html><title>Fixture</title>');
  writeFileSync(join(publicDir, 'secret.json'), '{"private":true}');
  const { server } = createApplication({ store: f.store, publicDir, cleanupIntervalMs: 0 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, value, token) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: typeof value === 'string' ? value : JSON.stringify(value) });
  assert.deepEqual(await (await fetch(base + '/api/health')).json(), { ok: true });
  assert.equal((await fetch(base + '/')).status, 200);
  for (const path of ['/vendor/three.module.js', '/vendor/three.core.js']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /javascript/);
    assert.ok((await response.text()).length > 1000);
  }
  for (const path of ['/node_modules/three/package.json', '/vendor/package.json', '/server/store.js', '/.data/' + f.a.code + '.json', '/content/catalogue.json', '/secret.json', '/%2e%2e/server/store.js']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 404);
    assert.deepEqual(Object.keys(await response.json()).sort(), ['code', 'error']);
  }
  assert.equal((await fetch(base + `/api/rooms/${f.a.code}`)).status, 401);
  assert.equal((await post(`/api/rooms/${f.a.code}/actions`, { id: 'one', revision: f.store.rooms.get(f.a.code).revision, type: 'ready', ready: true }, f.b.token)).status, 200);
  assert.equal(f.store.view(f.a.code, f.a.token).view.players.find(player => player.id === f.b.playerId).ready, true);
  const made = await (await post('/api/rooms', { nickname: 'Separate' })).json();
  assert.equal((await fetch(base + `/api/rooms/${f.a.code}`, { headers: { authorization: `Bearer ${made.token}` } })).status, 401);
  assert.equal((await post('/api/rooms', '{oops')).status, 400);
  assert.equal((await post('/api/rooms', 'x'.repeat(9000))).status, 413);
  assert.equal((await post('/api/rooms', { nickname: 'X', token: f.a.token })).status, 400);
  const cross = await fetch(base + '/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://other.example' }, body: '{"nickname":"X"}' });
  assert.equal(cross.status, 403);
});


test('ordinary switching reveals the incoming partner and retains public knowledge of outgoing reserves', t => {
  const f = fixture(t); f.play();
  const watcher = f.store.join(f.a.code, { nickname: 'Switch observer', spectator: true });
  const initial = f.store.view(f.a.code, f.a.token).view;
  const oldActive = initial.players.find(p => p.id === f.a.playerId).active;
  const oldReserve = initial.self.reserve;
  const publicView = () => f.store.view(f.a.code, watcher.token).view;
  assert.equal(publicView().players.find(p => p.id === f.a.playerId).reserve, undefined);
  f.act(f.a, 'draw'); f.act(f.a, 'draw');
  const hand = f.store.view(f.a.code, f.a.token).view.self.hand;
  const switched = f.act(f.a, 'switchPokemon').view;
  assert.deepEqual(switched.players.find(p => p.id === f.a.playerId).active, oldReserve);
  assert.deepEqual(switched.players.find(p => p.id === f.a.playerId).reserve, oldActive);
  assert.deepEqual(switched.self.hand, hand);
  assert.equal(switched.turn.switchUsed, true);
  assert.equal(switched.turn.phase, 'play');
  assert.deepEqual(publicView().players.find(p => p.id === f.a.playerId).reserve, oldActive);
  assert.equal(publicView().players.find(p => p.id === f.b.playerId).reserve, undefined);
  assert.deepEqual(publicView().self.hand, []);
  rejects(() => f.act(f.a, 'switchPokemon'), 'SWITCH_USED');
  f.act(f.a, 'finishPlay'); discardExcess(f); f.act(f.a, 'endTurn');
  reachEnd(f, f.b); f.act(f.b, 'endTurn');
  assert.equal(f.store.view(f.a.code, f.a.token).view.turn.switchUsed, false);
  f.act(f.a, 'draw'); f.act(f.a, 'draw'); f.act(f.a, 'switchPokemon');
  const again = publicView().players.find(p => p.id === f.a.playerId);
  assert.deepEqual(again.active, oldActive);
  assert.deepEqual(again.reserve, oldReserve);
  const late = f.store.join(f.a.code, { nickname: 'Late observer', spectator: true });
  assert.deepEqual(late.view.players.find(p => p.id === f.a.playerId).reserve, oldReserve);
});

test('switch authority rejects illegal phases, actors, extra state and closure votes without mutation', t => {
  const f = fixture(t); f.play();
  const watcher = f.store.join(f.a.code, { nickname: 'Observer', spectator: true });
  rejects(() => f.act(f.a, 'switchPokemon'), 'WRONG_PHASE');
  rejects(() => f.act(f.b, 'switchPokemon'), 'NOT_YOUR_TURN');
  rejects(() => f.act(watcher, 'switchPokemon'), 'SPECTATOR_ONLY_VIEW');
  f.act(f.a, 'draw'); f.act(f.a, 'draw');
  const initial = f.store.view(f.a.code, f.a.token).view;
  for (const payload of [{ switchUsed: false }, { activeId: 'fake' }, { reserveId: 'fake' }, { level: 3 }]) {
    rejects(() => f.act(f.a, 'switchPokemon', payload), 'INVALID_INPUT');
  }
  assert.deepEqual(f.store.view(f.a.code, f.a.token).view, initial);
  f.act(f.a, 'requestEndGame');
  rejects(() => f.act(f.a, 'switchPokemon'), 'VOTE_PENDING');
  f.act(f.b, 'rejectEnd');
  const internal = f.store.rooms.get(f.a.code).players.find(p => p.id === f.a.playerId);
  const reserve = internal.reserve;
  internal.reserve = null;
  rejects(() => f.act(f.a, 'switchPokemon'), 'SWITCH_UNAVAILABLE');
  internal.reserve = reserve;
  f.act(f.a, 'finishPlay');
  rejects(() => f.act(f.a, 'switchPokemon'), 'WRONG_PHASE');
  discardExcess(f);
  rejects(() => f.act(f.a, 'switchPokemon'), 'WRONG_PHASE');
});

test('switch moves existing creature state and strips only outgoing reinforcement without projecting internals', t => {
  const f = fixture(t); f.play();
  f.act(f.a, 'draw'); f.act(f.a, 'draw');
  const internal = f.store.rooms.get(f.a.code).players.find(p => p.id === f.a.playerId);
  // Seed future state to verify zone-transfer semantics; these effects remain unavailable to users.
  Object.assign(internal.active, { level: 2, damage: 1, status: 'poison', item: 'test-item', reinforcements: ['speed', 'defense'], privateScratch: 'never-project' });
  Object.assign(internal.reserve, { damage: 2, status: 'sleep', item: 'reserve-item', reinforcements: ['power'], privateScratch: 'hidden' });
  const outgoing = structuredClone(internal.active);
  const incoming = structuredClone(internal.reserve);
  const changed = f.act(f.a, 'switchPokemon').view;
  const current = f.store.rooms.get(f.a.code).players.find(p => p.id === f.a.playerId);
  assert.deepEqual(current.reserve, { ...outgoing, reinforcements: [], revealed: true });
  assert.deepEqual(current.active, { ...incoming, revealed: true });
  assert.deepEqual(changed.players.find(p => p.id === f.a.playerId).active, { catalogueId: incoming.catalogueId, level: incoming.level });
  assert.deepEqual(changed.players.find(p => p.id === f.a.playerId).reserve, { catalogueId: outgoing.catalogueId, level: outgoing.level });
  assert.equal(JSON.stringify(changed.players).includes('privateScratch'), false);
});

test('switch retries and recovery preserve the same revealed creatures and once-per-phase limit', t => {
  const f = timedFixture(t, 60);
  f.act(f.a, 'draw'); f.act(f.a, 'draw'); f.advance(2_000);
  const before = f.store.view(f.a.code, f.a.token).view;
  const input = { id: 'committed-switch', revision: before.revision, type: 'switchPokemon' };
  const result = f.store.action(f.a.code, f.a.token, input).view;
  assert.equal(result.turn.clock.remainingMs, 58_000);
  assert.equal(result.turn.clock.deadlineAt, before.turn.clock.deadlineAt);
  assert.deepEqual(f.store.action(f.a.code, f.a.token, input).view, result);
  rejects(() => f.store.action(f.a.code, f.a.token, { ...input, id: 'stale-switch' }), 'STALE_REVISION');
  f.advance(CONNECTED_MS + 1);
  const paused = f.store.view(f.a.code, f.b.token).view;
  assert.equal(paused.turn.clock.pausedReason, 'disconnected');
  const restored = new RoomStore({ dataDir: join(f.dir, 'data'), catalogue, now: f.now });
  const recovered = restored.action(f.a.code, f.a.token, input).view;
  assert.equal(recovered.turn.switchUsed, true);
  assert.deepEqual(recovered.players.map(({connected, ...state}) => state), result.players.map(({connected, ...state}) => state));
  assert.equal(recovered.players.find(p => p.id === f.b.playerId).connected, false);
  assert.deepEqual(recovered.self.reserve, result.self.reserve);
  rejects(() => restored.action(f.a.code, f.a.token, { id: 'switch-again', revision: recovered.revision, type: 'switchPokemon' }), 'SWITCH_USED');
});

test('timeout never switches automatically and cannot be bypassed with a switch request', t => {
  const f = timedFixture(t);
  f.act(f.a, 'draw'); f.act(f.a, 'draw');
  const before = f.store.view(f.a.code, f.a.token).view;
  f.advance(10_000);
  const expired = f.store.view(f.a.code, f.a.token).view;
  assert.equal(expired.turn.phase, 'discard');
  assert.equal(expired.turn.switchUsed, false);
  assert.deepEqual(expired.self.reserve, before.self.reserve);
  assert.deepEqual(expired.players.find(p => p.id === f.a.playerId).active, before.players.find(p => p.id === f.a.playerId).active);
  rejects(() => f.act(f.a, 'switchPokemon'), 'WRONG_PHASE');
});

test('end-turn level-up follows the switched active partner while the revealed reserve keeps its level', t => {
  const f = fixture(t); f.play();
  const original = f.store.view(f.a.code, f.a.token).view;
  f.act(f.a, 'draw'); f.act(f.a, 'draw'); f.act(f.a, 'switchPokemon');
  f.act(f.a, 'finishPlay'); discardExcess(f);
  const ended = f.act(f.a, 'endTurn', { levelUp: true }).view;
  const player = ended.players.find(p => p.id === f.a.playerId);
  assert.deepEqual(player.active, { catalogueId: original.self.reserve.catalogueId, level: 2 });
  assert.deepEqual(player.reserve, original.players.find(p => p.id === f.a.playerId).active);
  f.act(f.a, 'requestEndGame'); f.act(f.b, 'approveEnd');
  const lobby = f.store.view(f.a.code, f.a.token).view;
  assert.equal(lobby.turn, null);
  assert.ok(lobby.players.every(p => p.reserve === undefined && p.active === null));
});
