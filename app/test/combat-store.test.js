import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore, CONNECTED_MS } from '../server/store.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));
const publicShape = p => ({ catalogueId: p.catalogueId, level: p.level });
function fixture(t, { count = 3, turnSeconds = 0, responseSeconds = 0 } = {}) {
  const root = fileURLToPath(new URL('../.data/', import.meta.url)); mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'combat-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let time = 1_000_000, serial = 0;
  const now = () => time;
  const store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const byId = id => seats.find(p => p.playerId === id);
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, { id: `battle-${++serial}`, revision: store.rooms.get(owner.code).revision, type, ...payload }).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(p => act(p, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(store.rooms.get(owner.code).players.find(p => p.role === 'leader').id);
  for (const who of seats) act(who, 'acknowledgeIdentity');
  for (const who of seats) {
    for (let draw = 0; draw < 5; draw++) act(who, 'drawPokemon');
    const picks = store.view(owner.code, who.token).view.self.candidates;
    act(who, 'selectPokemon', { activeId: picks[0], reserveId: picks[1] });
  }
  // These pre-existing combat scenarios intentionally seed starter creatures after
  // exercising legal setup. Dedicated selection tests verify the real disjoint deals.
  for (const p of store.rooms.get(owner.code).players.filter(p => !p.spectator)) { p.active.catalogueId = 'bulbasaur'; p.reserve.catalogueId = 'squirtle'; }
  const room = () => store.rooms.get(owner.code);
  const player = who => room().players.find(p => p.id === who.playerId);
  const view = who => store.view(owner.code, who.token).view;
  const play = () => { act(leader, 'draw'); return act(leader, 'draw'); };
  const supply = (who, kind) => { const id = `seed-${++serial}`; player(who).hand.push({ id, kind, weather: 'intense-sun', fixture: true, name: {zh:kind,en:kind} }); return id; };
  const target = () => seats.find(p => p !== leader);
  const attack = (victim = target()) => act(leader, 'attack', { cardId: supply(leader, 'command'), targetIds: [victim.playerId] });
  const pass = () => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice: 'pass' }); };
  return { store, dir, now, advance: ms => { time += ms; }, owner, seats, leader, byId, act, room, player, view, play, supply, target, attack, pass };
}
function rejects(fn, code) { assert.throws(fn, e => e.code === code); }

test('preview uses sourced roles/leader levels and keeps opponents roles/reserve/deck private', t => {
  for (const count of [3, 4, 5, 6]) {
    const f = fixture(t, { count });
    const outsider = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true });
    const publicView = outsider.view;
    assert.equal(publicView.scenario.developmentFixture, true);
    assert.equal(publicView.scenario.cardsPerSeat, 12);
    assert.equal(publicView.players.filter(p => p.role === 'leader').length, 1);
    assert.equal(publicView.players.filter(p => p.role).length, 1);
    assert.equal(publicView.self.role, null);
    assert.deepEqual(publicView.self.hand, []);
    assert.equal(publicView.drawPile, undefined);
    for (const seat of f.seats) {
      const privatePlayer = f.player(seat), visible = publicView.players.find(p => p.id === seat.playerId);
      assert.equal(visible.reserve, undefined); assert.equal(visible.hand, undefined);
      assert.equal(visible.active.level, seat === f.leader ? 2 : 1);
      assert.equal(visible.active.maxHp, seat === f.leader ? 4 + (count >= 5 ? 1 : 0) : 3);
      assert.equal(JSON.stringify(publicView).includes(privatePlayer.reserve.instanceId), false);
      assert.equal(f.view(seat).self.role, privatePlayer.role);
    }
  }
});

test('pending defense does not depend on holding a dodge; wrong actor, pass payload and interrupting actions fail', t => {
  const f = fixture(t); f.play();
  const target = f.target(); f.player(target).hand = [];
  const before = f.attack(target);
  assert.equal(before.pendingBattle.kind, 'defense');
  assert.equal(before.pendingBattle.actorId, target.playerId);
  rejects(() => f.act(f.leader, 'respondBattle', { decisionId: before.pendingBattle.id, choice: 'pass' }), 'NOT_YOUR_DECISION');
  rejects(() => f.act(f.leader, 'finishPlay'), 'RESPONSE_PENDING');
  rejects(() => f.act(f.leader, 'switchPokemon'), 'RESPONSE_PENDING');
  rejects(() => f.act(target, 'respondBattle', { decisionId: before.pendingBattle.id, choice: 'pass', cardId: 'bad' }), 'INVALID_RESPONSE');
  rejects(() => f.act(target, 'respondBattle', { decisionId: before.pendingBattle.id, choice: 'dodge', cardId: 'bad' }), 'INVALID_CARD');
  assert.deepEqual(f.view(target).pendingBattle, before.pendingBattle);
  f.pass();
  assert.equal(f.view(target).players.find(p => p.id === target.playerId).active.hp, 1);
});

test('Dodge cancels one settlement, consumes one own card and exact retry never spends twice', t => {
  const f = fixture(t); f.play(); const victim = f.target(); f.attack(victim);
  const pending = f.room().pendingBattle, cardId = f.supply(victim, 'dodge');
  const input = { id: 'dodge-once', revision: f.room().revision, type: 'respondBattle', decisionId: pending.id, choice: 'dodge', cardId };
  const view = f.store.action(f.owner.code, victim.token, input).view;
  assert.equal(view.pendingBattle, null); assert.equal(f.player(victim).active.damage, 0);
  const hand = f.player(victim).hand.length, discard = f.room().discardPile.length;
  assert.deepEqual(f.store.action(f.owner.code, victim.token, input).view, view);
  assert.equal(f.player(victim).hand.length, hand); assert.equal(f.room().discardPile.length, discard);
  rejects(() => f.act(victim, 'respondBattle', { decisionId: pending.id, choice: 'pass' }), 'STALE_DECISION');
});

test('damage heals Bulbasaur only after real damage and switching does not unlock another command Pokémon', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.damage = 2;
  const victim = f.target(); f.attack(victim); f.pass();
  assert.equal(f.player(f.leader).active.damage, 1);
  const usedId = f.player(f.leader).active.instanceId;
  f.act(f.leader, 'switchPokemon');
  assert.equal(f.room().turn.commandCreatureId, usedId);
  rejects(() => f.attack(victim), 'MOVE_UNAVAILABLE');
});

test('rescue asks every living trainer from current turn, then forces reserve without using ordinary switch', t => {
  const f = fixture(t); f.play(); const victim = f.target(); f.player(victim).active.damage = 2;
  f.attack(victim); f.pass();
  assert.equal(f.room().pendingBattle.kind, 'rescue');
  assert.equal(f.room().pendingBattle.actorId, f.leader.playerId);
  assert.equal(f.player(victim).active.damage, 4); // HP remains -1, not clamped.
  const asked = [];
  while (f.room().pendingBattle) { asked.push(f.room().pendingBattle.actorId); f.pass(); }
  assert.deepEqual(asked, f.room().players.filter(p => !p.spectator).map(p => p.id));
  assert.equal(f.player(victim).active.catalogueId, 'squirtle');
  assert.equal(f.player(victim).reserve.defeated, true);
  assert.equal(f.player(victim).eliminated, false);
  assert.equal(f.room().turn.switchUsed, false);
  assert.ok(f.view(f.leader).players.find(p => p.id === victim.playerId).reserve);
});

test('leader elimination triggers immediate Challenger victory and only then discloses all hands/roles', t => {
  const f = fixture(t); f.play();
  const leader = f.player(f.leader); leader.active.damage = 3; leader.reserve.defeated = true;
  f.attack(f.leader); f.pass(); while (f.room().pendingBattle) f.pass();
  const ended = f.view(f.owner);
  assert.equal(ended.status, 'finished'); assert.equal(ended.result.winner, 'challengers');
  assert.equal(ended.turn, null); assert.equal(ended.pendingBattle, null);
  assert.ok(ended.players.filter(p => !p.spectator).every(p => p.role && Array.isArray(p.hand) && p.reserve));
  const lobby = f.act(f.owner, 'returnToLobby');
  assert.equal(lobby.status, 'lobby'); assert.equal(lobby.gameMode, undefined);
  assert.ok(lobby.players.every(p => p.role === undefined && p.hand === undefined && p.active === null));
});

test('multi-target Surf opens independent defense windows and one dodge leaves the other target affected', t => {
  const f = fixture(t); f.play(); const source = f.player(f.leader).active;
  source.catalogueId = 'squirtle'; source.level = 3;
  const victims = f.seats.filter(p => p !== f.leader);
  f.act(f.leader, 'attack', { cardId: f.supply(f.leader, 'command'), targetIds: victims.map(p => p.playerId) });
  const first = f.room().pendingBattle;
  f.act(victims[0], 'respondBattle', { decisionId: first.id, choice: 'dodge', cardId: f.supply(victims[0], 'dodge') });
  assert.equal(f.room().pendingBattle.actorId, victims[1].playerId);
  f.pass();
  assert.equal(f.player(victims[0]).active.damage, 0); assert.equal(f.player(victims[1]).active.damage, 2);
});

test('Fire judgment applies burn after damage and burn caps subsequent move damage', t => {
  const f = fixture(t); f.play(); const source = f.player(f.leader).active;
  source.catalogueId = 'charmander'; source.level = 1;
  const victim = f.target(); f.attack(victim); f.pass();
  assert.equal(f.player(victim).active.status, 'burn');
  assert.equal(f.player(victim).active.damage, 1);
  assert.ok(f.room().log.some(entry => entry.text.en.includes('judgment revealed intense sun')));
});

test('response clock pauses turn clock and deadline passes without extending inactivity lifetime', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play(); f.advance(2_000);
  const attacked = f.attack();
  assert.equal(attacked.turn.clock.remainingMs, 58_000); assert.equal(attacked.turn.clock.pausedReason, 'response');
  const actionAt = attacked.lastActionAt;
  f.advance(5_000); const after = f.view(f.leader);
  assert.equal(after.pendingBattle, null); assert.equal(after.turn.clock.remainingMs, 58_000);
  assert.equal(after.turn.clock.pausedReason, null); assert.equal(after.lastActionAt, actionAt);
});

test('response reconnect/restart preserves actor, pending id, private hand and remaining response clock', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 60 }); f.play(); const victim = f.target();
  f.attack(victim); const id = f.room().pendingBattle.id; const hand = structuredClone(f.player(victim).hand);
  f.advance(CONNECTED_MS + 5_000); const paused = f.view(f.leader);
  assert.equal(paused.pendingBattle.clock.pausedReason, 'disconnected');
  assert.equal(paused.pendingBattle.clock.remainingMs, 30_000);
  const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now });
  const recovered = restored.view(f.owner.code, victim.token).view;
  assert.equal(recovered.pendingBattle.id, id); assert.deepEqual(recovered.self.hand, hand);
  assert.equal(recovered.pendingBattle.clock.remainingMs, 30_000);
  assert.equal(recovered.pendingBattle.clock.deadlineAt, f.now() + 30_000);
});

test('self-elimination advances from the original seat to the next living trainer, not back to leader', t => {
  const f = fixture(t, { count: 4 });
  const ordered = f.room().players.filter(p => !p.spectator), actor = f.byId(ordered[1].id), nextId = ordered[2].id;
  f.player(actor).active.damage = 2; f.player(actor).reserve.defeated = true;
  f.store.startTurn(f.room(), actor.playerId, 9);
  f.act(actor, 'draw'); f.act(actor, 'draw');
  f.act(actor, 'attack', { cardId: f.supply(actor, 'command'), targetIds: [actor.playerId] });
  f.pass(); while (f.room().pendingBattle) f.pass();
  assert.equal(f.player(actor).eliminated, true);
  assert.equal(f.room().turn.playerId, nextId);
  assert.equal(f.room().turn.number, 10);
});

test('paralysis suppresses defense without discarding it when the card finishes', t => {
  const f = fixture(t); f.play(); const victim = f.target();
  f.player(victim).active.status = 'paralysis'; f.player(victim).active.reinforcements = ['defense'];
  f.attack(victim); f.pass();
  assert.equal(f.player(victim).active.damage, 2);
  assert.deepEqual(f.player(victim).active.reinforcements, ['defense']);
});

test('confusion self-damage uses Blaze, then its blocked move identity does not transfer to forced reserve', t => {
  const f = fixture(t); const source = f.player(f.leader).active;
  source.catalogueId = 'charmander'; source.level = 1; source.damage = 2; source.status = 'confusion';
  f.store.startTurn(f.room(), f.leader.playerId, 7);
  assert.equal(source.damage, 5);
  assert.equal(f.room().pendingBattle.kind, 'rescue');
  while (f.room().pendingBattle) f.pass();
  assert.equal(f.player(f.leader).active.catalogueId, 'squirtle');
  f.play();
  assert.equal(f.view(f.leader).self.battle.canCommand, true);
});

test('Chlorophyll is optional once per creature and its range permission does not transfer on switching', t => {
  const f = fixture(t, { count: 6 }); f.play();
  assert.equal(f.view(f.leader).self.battle.legalTargetIds.length, 3);
  const hand = f.player(f.leader).hand.length;
  f.act(f.leader, 'useTrait');
  assert.equal(f.view(f.leader).self.battle.legalTargetIds.length, 6);
  assert.equal(f.player(f.leader).hand.length, hand);
  rejects(() => f.act(f.leader, 'useTrait'), 'TRAIT_UNAVAILABLE');
  f.act(f.leader, 'switchPokemon');
  assert.equal(f.view(f.leader).self.battle.legalTargetIds.length, 3);
});

test('Rain Dish during End uses actual judgment weather, cures status and heals one without changing level', t => {
  const f = fixture(t); f.play();
  const source = f.player(f.leader).active;
  source.catalogueId = 'squirtle'; source.level = 1; source.damage = 1; source.status = 'burn';
  f.act(f.leader, 'finishPlay');
  while (f.player(f.leader).hand.length > 4) f.act(f.leader, 'discard', { cardId: f.player(f.leader).hand[0].id });
  // A source-derived judgment fixture exercises the rain branch; the public scenario remains all-sun.
  f.room().drawPile.push({ id:'rain-test', kind:'judgment-fixture', weather:'rain', fixture:true, name:{zh:'判定测试',en:'Judgment fixture'} });
  f.act(f.leader, 'useTrait');
  assert.equal(f.player(f.leader).active.damage, 0);
  assert.equal(f.player(f.leader).active.status, null);
  assert.equal(f.player(f.leader).active.level, 1);
  assert.ok(f.room().log.some(entry => entry.text.en.includes('judgment revealed heavy rain')));
  rejects(() => f.act(f.leader, 'useTrait'), 'TRAIT_UNAVAILABLE');
});

test('closing votes pause an actual response countdown and prohibit responding until vote rejection', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play(); const victim = f.target(); f.attack(victim);
  f.advance(2_000); const vote = f.act(f.owner, 'requestEndGame');
  assert.equal(vote.pendingBattle.clock.remainingMs, 3_000);
  assert.equal(vote.pendingBattle.clock.pausedReason, 'vote');
  f.advance(20_000);
  rejects(() => f.act(victim, 'respondBattle', { decisionId: vote.pendingBattle.id, choice:'pass' }), 'VOTE_PENDING');
  const rejected = f.act(f.seats.find(p => p !== f.owner), 'rejectEnd');
  assert.equal(rejected.pendingBattle.clock.remainingMs, 3_000);
  const actionAt = rejected.lastActionAt;
  f.advance(3_000); const after = f.view(f.owner);
  assert.equal(after.pendingBattle, null);
  assert.equal(after.lastActionAt, actionAt);
});


test('abandoning a pending combat response clears the match without disclosing hidden hands or fabricating a result', t => {
  const f = fixture(t); f.play(); f.attack();
  f.act(f.owner, 'requestEndGame');
  for (const seat of f.seats.filter(p => p !== f.owner)) f.act(seat, 'approveEnd');
  const lobby = f.view(f.owner);
  assert.equal(lobby.status, 'lobby'); assert.equal(lobby.result, undefined);
  assert.equal(lobby.pendingBattle, undefined); assert.equal(lobby.gameMode, undefined);
  assert.deepEqual(lobby.self.hand, []); assert.equal(lobby.self.reserve, null);
  assert.ok(lobby.players.every(p => p.role === undefined && p.hand === undefined && p.reserve === undefined));
});

test('unimplemented roster effects cannot attack or be silently ignored as defensive targets', t => {
  const f = fixture(t); f.play();
  const unsupported=catalogue.entries.find(entry=>entry.selectionEligible&&entry.levels.every(face=>face.effectStatus!=='combat-preview'));
  assert.ok(unsupported,'The incomplete roster still has unsupported groups to validate.');
  const target = f.target(); f.player(target).active.catalogueId = unsupported.id;
  const cardId = f.supply(f.leader, 'command');
  const before = f.player(f.leader).hand.length;
  rejects(() => f.act(f.leader, 'attack', { cardId, targetIds: [target.playerId] }), 'INVALID_TARGET');
  assert.equal(f.player(f.leader).hand.length, before);
  assert.equal(f.room().pendingBattle, null);
  f.player(f.leader).active.catalogueId = unsupported.id;
  rejects(() => f.act(f.leader, 'attack', { cardId, targetIds: [f.leader.playerId] }), 'MOVE_UNAVAILABLE');
  assert.equal(f.player(f.leader).hand.length, before);
});
