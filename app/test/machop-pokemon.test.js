import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore, CONNECTED_MS } from '../server/store.js';
import { computeDamage } from '../server/battle-rules.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));
function fixture(t, { count = 3, turnSeconds = 0, responseSeconds = 0 } = {}) {
  const root = fileURLToPath(new URL('../.data/', import.meta.url));
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'machop-test-'));
  t.after(() => {
    if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path');
    rmSync(dir, { recursive: true, force: true });
  });
  let time = 1_000_000, serial = 0;
  const now = () => time, store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code);
  const player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(p => p.playerId === id);
  const view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `machop-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true }));
  act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) {
    for (let draw = 0; draw < 5; draw++) act(who, 'drawPokemon');
    const candidates = view(who).self.candidates;
    act(who, 'selectPokemon', { activeId: candidates[0], reserveId: candidates[1] });
  }
  // Exercise legal setup, then isolate reviewed combat behavior with explicit fixtures.
  const seed = (who, family, level = 1, extra = {}) => Object.assign(player(who).active, {
    instanceId: `active-${who.playerId}`, catalogueId: family, level, damage: 0,
    status: null, reinforcements: [], hpBonus: 0, defeated: false, revealed: true, ...extra,
  });
  for (const who of seats) {
    seed(who, 'squirtle', 3);
    Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 0, defeated: false, revealed: false });
    player(who).hand = [];
  }
  const makeCard = (kind = 'dodge', weather = 'clear') => ({ id: `private-machop-${++serial}`, kind, weather, fixture: true, name: { zh: `私牌${serial}`, en: `Private Machop card ${serial}` } });
  room().drawPile = Array.from({ length: 24 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind, weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id);
  const play = () => { act(leader, 'draw'); act(leader, 'draw'); };
  const attack = (victim = target) => act(leader, 'attack', { cardId: supply(leader, 'command'), targetIds: [victim.playerId] });
  const respond = (choice = 'pass', payload = {}) => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload }); };
  const remove = reinforcement => respond('reinforcement', { reinforcement });
  return { store, dir, now, owner, seats, leader, target, room, player, byId, view, input, act, seed, makeCard, supply, play, attack, respond, remove, advance: ms => { time += ms; } };
}
const judgmentsMade = f => f.room().log.filter(entry => entry.text.en.includes('judgment revealed')).length;
const rejectCode = (fn, code) => assert.throws(fn, error => error.code === code);

test('all three reviewed Machop faces are enabled with their printed 1/2/3 damage', t => {
  const faces = catalogue.entries.find(entry => entry.id === 'machop').levels;
  assert.deepEqual(faces.map(face => face.effectStatus), ['combat-preview', 'combat-preview', 'combat-preview']);
  for (const level of [1, 2, 3]) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'machop', level);
    const legal = f.view(f.leader).self.battle;
    assert.equal(legal.canCommand, true); assert.equal(legal.move.printedValue, level); assert.equal(legal.move.maxTargets, 1);
    f.attack(); assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond();
    assert.equal(f.player(f.target).active.damage, level);
    assert.equal(f.player(f.target).active.status, level === 3 ? 'confusion' : null);
    assert.equal(judgmentsMade(f), 0); assert.equal(f.room().pendingBattle, null);
  }
});

test('Rock Smash and Brick Break require the source to remove one marker before any defense', t => {
  for (const level of [1, 2]) for (const marker of ['power', 'defense', 'speed']) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'machop', level);
    f.seed(f.target, 'squirtle', 3, { reinforcements: ['power', 'defense', 'speed'] });
    f.attack(); const pending = f.room().pendingBattle;
    assert.equal(pending.kind, 'reinforcement'); assert.equal(pending.actorId, f.leader.playerId); assert.equal(pending.targetId, f.target.playerId);
    assert.deepEqual(new Set(pending.reinforcements), new Set(['power', 'defense', 'speed']));
    assert.equal(pending.reinforcements.length, new Set(pending.reinforcements).size);
    assert.equal(f.player(f.target).active.damage, 0); assert.deepEqual(f.player(f.target).active.reinforcements, ['power', 'defense', 'speed']);
    f.remove(marker);
    assert.deepEqual(f.player(f.target).active.reinforcements, ['power', 'defense', 'speed'].filter(value => value !== marker));
    assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.room().pendingBattle.actorId, f.target.playerId);
    assert.equal(f.player(f.target).active.damage, 0);
    f.respond('dodge', { cardId: f.supply(f.target, 'dodge') });
    assert.equal(f.player(f.target).active.damage, 0);
    assert.deepEqual(f.player(f.target).active.reinforcements, ['power', 'defense', 'speed'].filter(value => value !== marker));
    assert.equal(f.room().pendingBattle, null); assert.equal(judgmentsMade(f), 0);
  }
});

test('one marker still requires a choice, zero markers proceeds directly to defense, and paralysis does not hide markers', t => {
  for (const level of [1, 2]) for (const status of [null, 'paralysis']) for (const marker of ['power', 'defense', 'speed']) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'machop', level);
    f.seed(f.target, 'squirtle', 3, { status, reinforcements: [marker] }); f.attack();
    assert.equal(f.room().pendingBattle.kind, 'reinforcement'); assert.deepEqual(f.room().pendingBattle.reinforcements, [marker]);
    f.remove(marker); assert.deepEqual(f.player(f.target).active.reinforcements, []); assert.equal(f.player(f.target).active.status, status);
    f.respond(); assert.equal(f.player(f.target).active.damage, level); assert.equal(f.room().pendingBattle, null);
  }
});

test('choosing defense before Brick Break prevents its damage cap; an unselected defense caps damage and expires normally', t => {
  for (const selected of ['defense', 'speed']) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'machop', 2);
    f.seed(f.target, 'squirtle', 3, { reinforcements: ['power', 'defense', 'speed'] });
    f.attack(); f.remove(selected); f.respond();
    assert.equal(f.player(f.target).active.damage, selected === 'defense' ? 2 : 1);
    assert.deepEqual(f.player(f.target).active.reinforcements, selected === 'defense' ? ['power', 'speed'] : ['power']);
    assert.equal(f.room().pendingBattle, null);
  }
});

test('public reinforcement choices are unique and selection removes one stored marker instance', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'machop', 1);
  // Duplicate-marker fixture verifies the boundary contract even for restored legacy state.
  f.seed(f.target, 'squirtle', 3, { reinforcements: ['speed', 'speed', 'power'] }); f.attack();
  assert.deepEqual(new Set(f.view(f.leader).pendingBattle.reinforcements), new Set(['speed', 'power']));
  assert.equal(f.view(f.leader).pendingBattle.reinforcements.length, 2);
  f.remove('speed'); assert.deepEqual(f.player(f.target).active.reinforcements, ['speed', 'power']);
  const before = structuredClone(f.room());
  assert.throws(() => f.respond('pass', { reinforcement: 'power' })); assert.deepEqual(f.room(), before);
  f.respond('dodge', { cardId: f.supply(f.target, 'dodge') });
  assert.deepEqual(f.player(f.target).active.reinforcements, ['speed', 'power']);
});

test('source power is consumed before a self-target marker choice and its boost survives the choice', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'machop', 2, { reinforcements: ['power', 'defense', 'speed'] });
  f.attack(f.leader);
  assert.deepEqual(f.player(f.leader).active.reinforcements, ['defense', 'speed']);
  assert.deepEqual(new Set(f.room().pendingBattle.reinforcements), new Set(['defense', 'speed']));
  assert.equal(f.room().resolution.powerBoost, 1); f.remove('defense'); f.respond();
  assert.equal(f.player(f.leader).active.damage, 3); assert.deepEqual(f.player(f.leader).active.reinforcements, ['speed']);
  const onlyPower = fixture(t); onlyPower.play(); onlyPower.seed(onlyPower.leader, 'machop', 1, { reinforcements: ['power'] });
  onlyPower.attack(onlyPower.leader); assert.equal(onlyPower.room().pendingBattle.kind, 'defense');
  onlyPower.respond(); assert.equal(onlyPower.player(onlyPower.leader).active.damage, 2);
});

test('suppressed source power remains available for mandatory self-target removal and supplies no power boost', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'machop', 1, { status: 'paralysis', reinforcements: ['power'] });
  f.attack(f.leader); assert.deepEqual(f.room().pendingBattle.reinforcements, ['power']); assert.equal(f.room().resolution.powerBoost, 0);
  f.remove('power'); f.respond(); assert.deepEqual(f.player(f.leader).active.reinforcements, []);
  assert.equal(f.player(f.leader).active.damage, 2); assert.equal(f.player(f.leader).active.status, 'paralysis');
});

test('reinforcement responses reject wrong actors, unsupported choices and extraneous response data atomically', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'machop', 2); f.seed(f.target, 'squirtle', 3, { reinforcements: ['defense', 'speed'] }); f.attack();
  const pending = f.room().pendingBattle, before = structuredClone(f.room());
  for (const payload of [
    { choice: 'pass' }, { choice: 'dodge' }, { choice: 'trait' }, { choice: 'reinforcement' },
    { choice: 'reinforcement', reinforcement: 'power' }, { choice: 'reinforcement', reinforcement: 0 },
    { choice: 'reinforcement', reinforcement: ['defense'] }, { choice: 'reinforcement', reinforcement: 'defense', cardId: 'forged' },
    { choice: 'reinforcement', reinforcement: 'defense', handIndex: 0 }, { choice: 'reinforcement', reinforcement: 'defense', order: [0] },
  ]) {
    assert.throws(() => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...payload })); assert.deepEqual(f.room(), before);
  }
  rejectCode(() => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'reinforcement', reinforcement: 'defense' }), 'NOT_YOUR_DECISION');
  assert.deepEqual(f.room(), before);
  for (const type of ['finishPlay', 'switchPokemon', 'useTrait']) {
    rejectCode(() => f.act(f.leader, type), 'RESPONSE_PENDING'); assert.deepEqual(f.room(), before);
  }
});

test('reinforcement choice retries remove only once and an obsolete decision or stale room revision cannot mutate defense', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'machop', 2); f.seed(f.target, 'squirtle', 3, { reinforcements: ['defense', 'speed'] }); f.attack();
  const pending = f.room().pendingBattle, input = f.input('respondBattle', { decisionId: pending.id, choice: 'reinforcement', reinforcement: 'speed' });
  f.store.action(f.owner.code, f.leader.token, input); const committed = structuredClone(f.room());
  f.store.action(f.owner.code, f.leader.token, input); assert.deepEqual(f.room(), committed);
  assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(f.player(f.target).active.damage, 0);
  rejectCode(() => f.act(f.leader, 'respondBattle', { decisionId: pending.id, choice: 'reinforcement', reinforcement: 'defense' }), 'STALE_DECISION');
  const stale = { ...f.input('respondBattle', { decisionId: f.room().pendingBattle.id, choice: 'pass' }), revision: input.revision };
  rejectCode(() => f.store.action(f.owner.code, f.target.token, stale), 'STALE_REVISION'); assert.deepEqual(f.room(), committed);
  f.respond(); assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.room().pendingBattle, null);
});

test('a removed selected marker or changed target instance invalidates its pending reinforcement choice', t => {
  for (const changed of ['marker', 'instance']) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'machop', 1); f.seed(f.target, 'squirtle', 3, { reinforcements: ['defense', 'speed'] }); f.attack();
    // Explicit corruption fixtures isolate stale decision validation from ordinary switch blocking.
    if (changed === 'marker') f.player(f.target).active.reinforcements = ['speed'];
    else f.player(f.target).active.instanceId = 'replacement-target-instance';
    const before = structuredClone(f.room());
    rejectCode(() => f.remove('defense'), 'STALE_DECISION'); assert.deepEqual(f.room(), before);
  }
});

test('reinforcement choices are public while hands, reserves and resolution identities remain private', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'machop', 1); f.seed(f.target, 'squirtle', 3, { reinforcements: ['power', 'speed'] });
  const privateId = f.supply(f.target, 'dodge'), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true });
  f.attack(); const views = [f.view(f.leader), f.view(f.target), f.view(observer)];
  for (const view of views) {
    assert.equal(view.pendingBattle.kind, 'reinforcement'); assert.equal(view.pendingBattle.actorId, f.leader.playerId); assert.equal(view.pendingBattle.targetId, f.target.playerId);
    assert.deepEqual(new Set(view.pendingBattle.reinforcements), new Set(['power', 'speed']));
    assert.equal(view.resolution, undefined); assert.equal(view.drawPile, undefined); assert.equal(view.pendingBattle.cards, undefined); assert.equal(view.pendingBattle.choices, undefined);
    assert.equal(JSON.stringify(view).includes(f.player(f.leader).reserve.instanceId), view.self.reserve?.instanceId === f.player(f.leader).reserve.instanceId);
  }
  for (const view of [views[0], views[2]]) assert.equal(JSON.stringify(view).includes(privateId), false);
  for (const card of f.room().drawPile) for (const view of views) assert.equal(JSON.stringify(view).includes(card.id), false);
});

test('mandatory marker timeout waits at zero, preserves markers, and accepts the eventual explicit choice', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play(); f.seed(f.leader, 'machop', 1); f.seed(f.target, 'squirtle', 3, { reinforcements: ['defense'] });
  f.advance(2_000); f.attack(); const pending = f.room().pendingBattle, actionAt = f.room().lastActionAt;
  f.advance(5_000); const expired = f.view(f.leader);
  assert.equal(expired.pendingBattle.id, pending.id); assert.equal(expired.pendingBattle.clock.remainingMs, 0); assert.equal(expired.pendingBattle.clock.deadlineAt, null);
  assert.equal(expired.pendingBattle.clock.expired, true); assert.equal(expired.pendingBattle.clock.pausedReason, 'mandatory');
  assert.equal(expired.turn.clock.remainingMs, 58_000); assert.equal(expired.turn.clock.pausedReason, 'response'); assert.equal(expired.lastActionAt, actionAt);
  assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(f.player(f.target).active.damage, 0);
  f.remove('defense'); assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond();
  assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.view(f.leader).turn.clock.remainingMs, 58_000);
});

test('mandatory marker clock pauses for disconnection and closing votes and resumes without choosing', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 60 }); f.play(); f.seed(f.leader, 'machop', 2); f.seed(f.target, 'squirtle', 3, { reinforcements: ['defense', 'speed'] }); f.attack();
  const id = f.room().pendingBattle.id; f.advance(CONNECTED_MS + 1_000);
  const offline = f.view(f.target); assert.equal(offline.pendingBattle.id, id); assert.equal(offline.pendingBattle.clock.remainingMs, 30_000); assert.equal(offline.pendingBattle.clock.pausedReason, 'disconnected');
  f.seats.forEach(who => f.view(who)); f.advance(2_000); const vote = f.act(f.owner, 'requestEndGame');
  assert.equal(vote.pendingBattle.clock.remainingMs, 28_000); assert.equal(vote.pendingBattle.clock.pausedReason, 'vote'); f.advance(20_000);
  rejectCode(() => f.remove('defense'), 'VOTE_PENDING'); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense', 'speed']);
  const resumed = f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); assert.equal(resumed.pendingBattle.id, id); assert.equal(resumed.pendingBattle.clock.remainingMs, 28_000);
  f.remove('defense'); assert.equal(f.room().pendingBattle.kind, 'defense'); assert.deepEqual(f.player(f.target).active.reinforcements, ['speed']);
});

test('restart retains mandatory marker options and an exact post-restart retry removes only one marker', t => {
  const f = fixture(t, { responseSeconds: 60 }); f.play(); f.seed(f.leader, 'machop', 2); f.seed(f.target, 'squirtle', 3, { reinforcements: ['power', 'defense', 'speed'] }); f.attack();
  f.advance(2_000); const pending = f.view(f.leader).pendingBattle;
  const restarted = new RoomStore({ dataDir: f.dir, catalogue, now: f.now });
  const recovered = restarted.view(f.owner.code, f.leader.token).view;
  assert.equal(recovered.pendingBattle.id, pending.id); assert.deepEqual(recovered.pendingBattle.reinforcements, pending.reinforcements); assert.equal(recovered.pendingBattle.clock.remainingMs, 58_000);
  const input = { id: 'machop-restarted-choice', revision: recovered.revision, type: 'respondBattle', decisionId: pending.id, choice: 'reinforcement', reinforcement: 'defense' };
  restarted.action(f.owner.code, f.leader.token, input); const committed = structuredClone(restarted.rooms.get(f.owner.code));
  restarted.action(f.owner.code, f.leader.token, input); assert.deepEqual(restarted.rooms.get(f.owner.code), committed);
  assert.equal(committed.pendingBattle.kind, 'defense'); assert.equal(committed.pendingBattle.actorId, f.target.playerId);
  assert.deepEqual(committed.players.find(p => p.id === f.target.playerId).active.reinforcements, ['power', 'speed']);
  assert.equal(committed.players.find(p => p.id === f.target.playerId).active.damage, 0);
});

test('range is validated when the move is used and an on-use self speed removal does not revalidate its accepted target', t => {
  const f = fixture(t, { count: 6 }); f.play(); f.seed(f.leader, 'machop', 1);
  const far = f.byId(f.room().players[3].id), command = f.supply(f.leader, 'command');
  assert.equal(f.view(f.leader).self.battle.legalTargetIds.includes(far.playerId), false); const before = structuredClone(f.room());
  rejectCode(() => f.act(f.leader, 'attack', { cardId: command, targetIds: [far.playerId] }), 'INVALID_TARGET'); assert.deepEqual(f.room(), before);
  f.player(f.leader).active.reinforcements = ['speed']; f.seed(far, 'squirtle', 3, { reinforcements: ['defense'] });
  f.act(f.leader, 'attack', { cardId: command, targetIds: [far.playerId] }); f.remove('defense'); f.respond();
  assert.equal(f.player(far).active.damage, 1); assert.deepEqual(f.player(f.leader).active.reinforcements, ['speed']);
  const self = fixture(t); self.play(); self.seed(self.leader, 'machop', 1, { reinforcements: ['speed'] }); self.attack(self.leader); self.remove('speed'); self.respond();
  assert.equal(self.player(self.leader).active.damage, 1); assert.equal(self.room().pendingBattle, null);
});

test('Guts adds exactly one for every special status, keeps the status and ignores burn reduction across all three levels', t => {
  for (const level of [1, 2, 3]) for (const status of [null, 'burn', 'poison', 'paralysis', 'confusion', 'sleep', 'flinch']) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'machop', level, { status }); f.seed(f.target, 'squirtle', 3, { hpBonus: 20 });
    f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, level + (status ? 1 : 0));
    assert.equal(f.player(f.leader).active.status, status); assert.equal(judgmentsMade(f), 0); assert.equal(f.room().pendingBattle, null);
  }
});

test('Guts and power stack before receiving defense, while ordinary burned Pokémon keep the burn cap', t => {
  for (const defense of [false, true]) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'machop', 3, { status: 'burn', reinforcements: ['power'] });
    f.seed(f.target, 'squirtle', 3, { hpBonus: 20, reinforcements: defense ? ['defense'] : [] });
    f.attack(); assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond();
    assert.equal(f.player(f.target).active.damage, defense ? 1 : 5); assert.deepEqual(f.player(f.leader).active.reinforcements, []);
    assert.equal(f.player(f.leader).active.status, 'burn'); assert.deepEqual(f.player(f.target).active.reinforcements, []);
    assert.equal(f.player(f.target).active.status, 'confusion'); assert.equal(judgmentsMade(f), 0);
  }
  const source = { catalogueId: 'squirtle', level: 3, damage: 0, status: 'burn', reinforcements: [] };
  const target = { ...source, status: null };
  assert.equal(computeDamage(source, target, 3, catalogue, { powerBoost: 1 }), 1);
  const machop = { ...source, catalogueId: 'machop' };
  assert.equal(computeDamage(machop, target, 2, catalogue, { command: false }), 3);
});

test('Dynamic Punch has no marker removal or judgment and applies confusion only after positive damage without overwriting status', t => {
  for (const [status, prevention] of [[null, null], ['poison', null], [null, 'dodge'], [null, 'zero'], [null, 'immunity']]) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'machop', 3); f.seed(f.target, 'squirtle', 3, { hpBonus: 20, status, reinforcements: ['power', 'speed'] });
    if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId];
    const top = f.room().drawPile.at(-1).id; f.attack(); assert.equal(f.room().pendingBattle.kind, 'defense');
    assert.equal(f.player(f.target).active.status, status);
    if (prevention === 'zero') f.room().resolution.baseDamage = 0;
    if (prevention === 'dodge') f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); else f.respond();
    assert.equal(f.player(f.target).active.damage, prevention ? 0 : 3);
    assert.equal(f.player(f.target).active.status, status || (prevention ? null : 'confusion'));
    assert.deepEqual(f.player(f.target).active.reinforcements, ['power', 'speed']);
    assert.equal(judgmentsMade(f), 0); assert.equal(f.room().drawPile.at(-1).id, top); assert.equal(f.room().pendingBattle, null);
  }
});

test('Dynamic Punch does not confuse the replacement reserve after its original target faints', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'machop', 3); f.seed(f.target, 'machop', 1);
  f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'rescue');
  while (f.room().pendingBattle?.kind === 'rescue') f.respond();
  assert.equal(f.player(f.target).active.catalogueId, 'squirtle'); assert.equal(f.player(f.target).active.status, null);
  assert.equal(f.player(f.target).reserve.defeated, true); assert.equal(f.room().pendingBattle, null); assert.equal(judgmentsMade(f), 0);
});
