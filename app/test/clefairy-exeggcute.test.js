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
  const dir = mkdtempSync(join(root, 'clefairy-exeggcute-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `clefairy-exeggcute-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates; act(who, 'selectPokemon', { activeId: candidates[0], reserveId: candidates[1] }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-clefairy-exeggcute-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private Clefairy Exeggcute card ${serial}` } });
  room().drawPile = Array.from({ length: 48 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const top = (...weather) => { const cards = weather.map(value => makeCard('reveal-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const judgments = (...weather) => { const cards = weather.map(value => makeCard('judgment-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id), third = seats.find(who => who !== leader && who !== target);
  const play = (family = 'clefairy', level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, family, level); };
  const attack = (payload = {}, who = leader) => act(who, 'attack', { cardId: payload.cardId ?? supply(who), targetIds: [target.playerId], ...payload });
  const respond = (choice = 'pass', payload = {}) => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload }); };
  const order = effect => respond('damage-effect', { effect });
  const helmet = who => { const card = { ...makeCard('held-item'), itemType: 'rocky-helmet' }; player(who).active.item = card; return card; };
  const drain = () => { for (let i = 0; room().pendingBattle && i < 100; i++) { const pending = room().pendingBattle; if (pending.kind === 'damage-order') order(pending.effects[0]); else respond(pending.kind === 'effects' ? 'effect' : 'pass', pending.kind === 'effects' ? { effect: pending.effects[0] } : {}); } assert.equal(room().pendingBattle, null); };
  const startStatus = (status = 'poison', who = target) => { player(who).active.status = status; store.startTurn(room(), who.playerId, 2); };
  return { store, dir, now, owner, seats, leader, target, third, room, player, byId, view, input, act, seed, makeCard, supply, top, judgments, play, attack, respond, order, helmet, drain, startStatus, advance: ms => { time += ms; } };
}
function rejectsAtomically(f, action, code) { const before = structuredClone(f.room()); assert.throws(action, error => code === undefined || error.code === code); assert.deepEqual(f.room(), before); }
const ids = cards => cards.map(card => card.id);
const publicFace = ({ name, weather, kind }) => ({ name, weather, kind });
const publicHand = ({ id, name, weather, kind }) => ({ id, name, weather, kind });
const allCards = room => [...room.drawPile, ...room.discardPile, ...room.players.flatMap(p => [...(p.hand || []), ...[p.active?.item, p.reserve?.item].filter(Boolean)]), ...[room.resolution, ...(room.resolutionStack || [])].flatMap(r => r ? [...(r.card && !r.cardClaimedBy ? [r.card] : []), ...(r.revealedCards || [])] : []), ...(room.judgment?.card ? [room.judgment.card] : [])];
const countCard = (room, id) => allCards(room).filter(card => card.id === id).length;

const charm = (f, level = 1) => { f.seed(f.target, 'clefairy', level); return f.supply(f.target, 'event', 'intense-sun'); };
const redirect = (f, cardId, targetId = f.third.playerId) => f.respond('redirect', { cardId, targetId });
const enterEnd = f => { f.act(f.leader, 'finishPlay'); while (f.room().turn.phase === 'discard') f.act(f.leader, 'discard', { cardId: f.player(f.leader).hand[0].id }); assert.equal(f.room().turn.phase, 'end'); };
const harvest = f => f.act(f.leader, 'useTrait');
const support = (f, moveIndex = 0, effectChoice = 'heal', payload = {}) => f.attack({ moveIndex, ...(moveIndex === 0 ? { effectChoice } : {}), ...payload });

// Every scenario starts with the real room/identity/shared-candidate setup.
// Cards have real unique identities and move through the ordinary hand/deck/discard paths.
test('reviewed Clefairy and Exeggcute faces expose exact HP and executable move menus', t => {
  for (const family of ['clefairy', 'exeggcute']) {
    const entry = catalogue.entries.find(entry => entry.id === family);
    assert.deepEqual(entry.levels.map(face => face.hp), [3, 4, 4]);
    assert.deepEqual(entry.levels.map(face => face.effectStatus), Array(3).fill('combat-preview'));
    for (const level of [1, 2, 3]) {
      const f = fixture(t); f.play(family, level); const battle = f.view(f.leader).self.battle;
      assert.equal(battle.canCommand, true); assert.equal(battle.canTrait, false);
      assert.equal(battle.moves.length, family === 'clefairy' && level === 3 ? 2 : 1);
      assert.equal(battle.moves[0].printedValue, family === 'exeggcute' ? level : level === 1 ? 1 : null);
      assert.equal(battle.moves.every(move => move.condition.kind === 'command' && move.maxTargets === 1), true);
    }
  }
});

test('Pound consumes exactly one actual Take this and deals one ordinary damage', t => {
  const f = fixture(t); f.play(); const command = f.supply(f.leader), actual = structuredClone(f.player(f.leader).hand[0]);
  f.attack({ cardId: command }); assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond();
  assert.equal(f.player(f.target).active.damage, 1); assert.deepEqual(f.room().discardPile.find(card => card.id === command), actual);
  assert.equal(countCard(f.room(), command), 1); assert.equal(f.view(f.leader).self.battle.canCommand, false);
});

test('Cute Charm on all levels changes one target slot before defense and uses the exact payment', t => {
  for (const level of [1, 2, 3]) {
    const f = fixture(t); f.play('squirtle'); const cost = charm(f, level), actual = structuredClone(f.player(f.target).hand[0]), command = f.supply(f.leader);
    f.attack({ cardId: command }); assert.equal(f.room().pendingBattle.kind, 'cute-charm');
    assert.equal(f.room().pendingBattle.actorId, f.target.playerId); assert.equal(f.room().pendingBattle.targetId, f.target.playerId);
    redirect(f, cost); assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); f.respond();
    assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.third).active.damage, 2);
    assert.deepEqual(f.room().discardPile.find(card => card.id === cost), actual); assert.equal(countCard(f.room(), command), 1); assert.equal(countCard(f.room(), cost), 1);
  }
});

test('Cute Charm accepts any own intense-sun card kind but never clear sunny weather', t => {
  for (const kind of ['command', 'dodge', 'event', 'held-item']) {
    const f = fixture(t); f.play('squirtle'); charm(f); f.player(f.target).hand = [];
    const cost = f.supply(f.target, kind), clear = f.supply(f.target, kind, 'clear'); f.attack();
    assert.deepEqual(ids(f.view(f.target).pendingBattle.paymentCards), [cost]);
    rejectsAtomically(f, () => redirect(f, clear)); redirect(f, cost); f.drain(); assert.equal(f.player(f.third).active.damage, 2);
  }
});

test('Cute Charm projects public legal targets and only actor-safe payment faces', t => {
  const f = fixture(t); f.play('squirtle'); const cost = charm(f), sunny = f.player(f.target).hand[0];
  const foreign = f.supply(f.third), rain = f.supply(f.target, 'dodge', 'rain'), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); f.attack();
  assert.deepEqual(f.view(f.target).pendingBattle.paymentCards, [publicHand(sunny)]);
  for (const who of [...f.seats, observer]) {
    const view = f.view(who); assert.deepEqual(view.pendingBattle.legalTargetIds, [f.third.playerId]);
    if (who !== f.target) { assert.equal(view.pendingBattle.paymentCards, undefined); assert.equal(JSON.stringify(view).includes(cost), false); }
    assert.equal(JSON.stringify(view.pendingBattle).includes('privateMarker'), false);
    assert.equal(JSON.stringify(view.pendingBattle).includes(foreign), false); assert.equal(JSON.stringify(view.pendingBattle).includes(rain), false);
  }
});

test('Cute Charm enforces decision actor, current decision and own real payment atomically', t => {
  const f = fixture(t); f.play('squirtle'); const cost = charm(f), foreign = f.supply(f.third); f.attack(); const pending = f.room().pendingBattle;
  rejectsAtomically(f, () => f.act(f.third, 'respondBattle', { decisionId: pending.id, choice: 'redirect', cardId: foreign, targetId: f.third.playerId }), 'NOT_YOUR_DECISION');
  rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: 'forged', choice: 'redirect', cardId: cost, targetId: f.third.playerId }), 'STALE_DECISION');
  for (const cardId of [foreign, 'forged', undefined, null]) rejectsAtomically(f, () => redirect(f, cardId));
  for (const targetId of [f.target.playerId, f.leader.playerId, 'forged', undefined, null]) rejectsAtomically(f, () => redirect(f, cost, targetId === undefined ? null : targetId));
  redirect(f, cost); f.drain();
});

test('Cute Charm rejects malformed and unrelated response fields without paying', t => {
  const f = fixture(t); f.play('squirtle'); const cardId = charm(f); f.attack();
  for (const payload of [{ choice: 'trait' }, { choice: 'redirect', cardId }, { choice: 'redirect', targetId: f.third.playerId }, { choice: 'pass', cardId }, { choice: 'pass', targetId: f.third.playerId }, { choice: 'redirect', cardId, targetId: f.third.playerId, cardIds: [] }, { choice: 'redirect', cardId, targetId: f.third.playerId, effect: 'heal' }]) {
    rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: f.room().pendingBattle.id, ...payload }));
  }
});

test('Cute Charm uses its passive neighbor range and excludes unsupported or inactive destinations', t => {
  const f = fixture(t, { count: 6 }); f.play('weedle', 3); const cost = charm(f);
  f.player(f.target).active.reinforcements = ['speed']; f.room().turn.rangeCreatureId = f.player(f.target).active.instanceId;
  f.attack(); const seats = f.room().players.filter(player => !player.spectator), index = seats.findIndex(player => player.id === f.target.playerId);
  const neighbor = seats[(index + 1) % seats.length].id;
  assert.deepEqual(f.room().pendingBattle.legalTargetIds, [neighbor]);
  const far = seats.find(player => ![f.leader.playerId, f.target.playerId, neighbor].includes(player.id));
  rejectsAtomically(f, () => redirect(f, cost, far.id)); redirect(f, cost, neighbor); f.drain();
  const g = fixture(t); g.play('squirtle'); charm(g); const unsupported = catalogue.entries.find(entry => entry.selectionEligible && entry.levels.every(face => face.effectStatus !== 'combat-preview'));
  assert.ok(unsupported); g.seed(g.third, unsupported.id); g.attack(); assert.notEqual(g.room().pendingBattle.kind, 'cute-charm');
});

test('passing Cute Charm preserves payment and opens original target defense only once', t => {
  const f = fixture(t); f.play('squirtle'); const cost = charm(f); f.attack(); const old = f.room().pendingBattle.id; f.respond();
  assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.room().pendingBattle.actorId, f.target.playerId);
  rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: old, choice: 'pass' }), 'STALE_DECISION'); f.respond();
  assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).hand.some(card => card.id === cost), true); assert.equal(f.room().pendingBattle, null);
});

test('new Clefairy destinations can chain while each instance is offered at most once for the whole command', t => {
  const f = fixture(t, { count: 4 }); f.play('weedle', 3); const ordered = f.room().players.filter(player => !player.spectator).map(player => f.byId(player.id));
  const a = ordered[1], b = ordered[2], c = ordered[3]; f.seed(a, 'clefairy'); f.seed(b, 'clefairy'); f.seed(c, 'clefairy');
  const ca = f.supply(a), cb = f.supply(b), cc = f.supply(c); f.top('rain', 'rain', 'rain', 'rain'); f.attack({ targetIds: [a.playerId] });
  redirect(f, ca, b.playerId); assert.equal(f.room().pendingBattle.actorId, b.playerId);
  redirect(f, cb, c.playerId); assert.equal(f.room().pendingBattle.actorId, c.playerId);
  redirect(f, cc, b.playerId); assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.room().pendingBattle.actorId, b.playerId); f.drain();
  assert.equal(f.player(b).active.damage, 1); assert.equal(f.player(a).active.damage, 0); assert.equal(f.player(c).active.damage, 0);
  for (const id of [ca, cb, cc]) assert.equal(countCard(f.room(), id), 1);
});

test('multi-target commands retain other slots and cannot redirect onto another scheduled slot', t => {
  const f = fixture(t, { count: 6 }); f.play('diglett', 3); const seats = f.room().players.filter(player => !player.spectator).map(player => f.byId(player.id));
  const a = seats[1], b = seats[2], c = seats.at(-1); f.seed(a, 'clefairy'); const cost = f.supply(a); f.player(f.leader).active.reinforcements = ['speed'];
  f.attack({ targetIds: [a.playerId, c.playerId] }); assert.equal(f.room().pendingBattle.kind, 'cute-charm');
  assert.equal(f.room().pendingBattle.legalTargetIds.includes(c.playerId), false);
  rejectsAtomically(f, () => redirect(f, cost, c.playerId)); redirect(f, cost, b.playerId); f.drain();
  assert.equal(f.player(a).active.damage, 0); assert.equal(f.player(b).active.damage, 2); assert.equal(f.player(c).active.damage, 2);
});

test('Double Kick binds the redirected original instance and later hits never reopen Cute Charm', t => {
  const f = fixture(t); f.play('nidoran-m'); const cost = charm(f); f.seed(f.third, 'clefairy'); const nextCost = f.supply(f.third); f.attack();
  redirect(f, cost); assert.equal(f.room().pendingBattle.kind, 'cute-charm'); f.respond();
  for (let hit = 1; hit <= 2; hit++) { assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); assert.equal(f.view(f.third).pendingBattle.settlementNumber, hit); f.respond(); }
  assert.equal(f.player(f.third).active.damage, 2); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.third).hand.some(card => card.id === nextCost), true);
});

test('Fury Attack redirects before revealing and settles all hits against the redirected instance', t => {
  const f = fixture(t); f.play('weedle', 3); const cost = charm(f), cards = f.top('clear', 'intense-sun', 'rain', 'rain'); f.attack();
  assert.equal(f.room().resolution.revealedCards, undefined); assert.equal(f.room().drawPile.at(-1).id, cards[0].id);
  redirect(f, cost); assert.deepEqual(f.room().resolution.revealedCards, cards); f.drain();
  assert.equal(f.player(f.third).active.damage, 3); assert.equal(f.player(f.target).active.damage, 0);
  for (const card of cards) assert.equal(countCard(f.room(), card.id), 1);
});

test('Cute Charm precedes Future Sight, marker removal and held-item suppression', t => {
  for (const [family, level, next] of [['slowpoke', 3, 'foresee'], ['machop', 1, 'reinforcement'], ['squirtle', 2, 'defense']]) {
    const f = fixture(t); f.play(family, level); const cost = charm(f); f.player(f.target).active.reinforcements = ['defense']; f.player(f.third).active.reinforcements = ['power']; f.helmet(f.target); f.helmet(f.third);
    f.attack(); assert.equal(f.room().pendingBattle.kind, 'cute-charm'); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(f.view(f.target).players.find(player => player.id === f.target.playerId).active.itemSuppressed, false);
    redirect(f, cost); assert.equal(f.room().pendingBattle.kind, next);
    if (next === 'reinforcement') { assert.equal(f.room().pendingBattle.targetId, f.third.playerId); f.respond('reinforcement', { reinforcement: 'power' }); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); }
    if (family === 'squirtle') { const view = f.view(f.leader); assert.equal(view.players.find(player => player.id === f.target.playerId).active.itemSuppressed, false); assert.equal(view.players.find(player => player.id === f.third.playerId).active.itemSuppressed, true); }
    f.drain();
  }
});

test('Moxie draws before Cute Charm and virtual Justified commands also offer Cute Charm', t => {
  const f = fixture(t); f.play('magikarp', 2); charm(f); const drawn = f.room().drawPile.at(-1).id; f.attack();
  assert.equal(f.room().pendingBattle.kind, 'cute-charm'); assert.equal(f.player(f.leader).hand.some(card => card.id === drawn), true); f.drain();
  const g = fixture(t); g.play('growlithe'); const cost = charm(g), gift = g.supply(g.leader); g.act(g.leader, 'giveCards', { cardIds: [gift], recipientId: g.third.playerId, targetIds: [g.target.playerId] });
  assert.equal(g.room().resolution.virtualCommand, true); assert.equal(g.room().pendingBattle.kind, 'cute-charm'); redirect(g, cost); g.drain();
  assert.equal(g.player(g.third).active.damage, 2); assert.equal(g.player(g.third).hand.some(card => card.id === gift), true); assert.equal(countCard(g.room(), gift), 1);
});

test('Cute Charm survives restart and exact redirect retries consume payment once', t => {
  const f = fixture(t); f.play('squirtle'); const cost = charm(f); f.attack(); const pending = structuredClone(f.view(f.target).pendingBattle);
  const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); const view = restored.view(f.owner.code, f.target.token).view; assert.deepEqual(view.pendingBattle, pending);
  const request = { id: 'restored-cute-charm', revision: view.revision, type: 'respondBattle', decisionId: pending.id, choice: 'redirect', cardId: cost, targetId: f.third.playerId };
  restored.action(f.owner.code, f.target.token, request); const state = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.target.token, request);
  assert.deepEqual(restored.rooms.get(f.owner.code), state); assert.equal(state.pendingBattle.actorId, f.third.playerId); assert.equal(countCard(state, cost), 1);
});

test('Cute Charm expiry passes and targetId is rejected on ordinary defense decisions', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play('squirtle'); const cost = charm(f); f.advance(1_000); f.attack(); f.advance(5_000);
  let view = f.view(f.target); assert.equal(view.pendingBattle.kind, 'defense'); assert.equal(view.pendingBattle.clock.remainingMs, 5_000);
  rejectsAtomically(f, () => f.respond('pass', { targetId: f.third.playerId })); f.respond();
  assert.equal(f.player(f.target).hand.some(card => card.id === cost), true); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.view(f.leader).turn.clock.remainingMs, 59_000);
});

test('Moonlight requires an exact heal or cure declaration before consuming the command or Power', t => {
  for (const level of [2, 3]) {
    const f = fixture(t); f.play('clefairy', level); const cardId = f.supply(f.leader); f.player(f.leader).active.reinforcements = ['power'];
    for (const effectChoice of [undefined, null, '', 'damage', 'HEAL', 1, [], {}]) rejectsAtomically(f, () => f.attack({ cardId, effectChoice }));
    support(f, 0, 'heal', { cardId }); f.respond(); assert.equal(countCard(f.room(), cardId), 1); assert.deepEqual(f.player(f.leader).active.reinforcements, []);
  }
});

test('Moonlight heals exactly two capped at max HP and creates no damage effects or Defense cleanup', t => {
  for (const damage of [0, 1, 2, 4]) {
    const f = fixture(t); f.play('clefairy', 2); f.seed(f.target, 'nidoran-m', 3, { damage, reinforcements: ['defense'] }); f.helmet(f.target); f.player(f.leader).active.reinforcements = ['power']; const top = f.room().drawPile.at(-1).id;
    support(f); assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond();
    assert.equal(f.player(f.target).active.damage, Math.max(0, damage - 2)); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.player(f.leader).active.status, null);
    assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().drawPile.at(-1).id, top);
  }
});

test('Moonlight cure removes each of the six special statuses without healing or judging', t => {
  for (const status of ['burn', 'paralysis', 'poison', 'confusion', 'sleep', 'flinch']) {
    const f = fixture(t); f.play('clefairy', 3); f.player(f.target).active.status = status; f.player(f.target).active.damage = 3; const top = f.room().drawPile.at(-1).id;
    support(f, 0, 'cure'); f.respond(); assert.equal(f.player(f.target).active.status, null); assert.equal(f.player(f.target).active.damage, 3); assert.equal(f.room().drawPile.at(-1).id, top);
  }
});

test('Moonlight alone ignores move distance while Helping Hand and Cute Charm retain ordinary range', t => {
  const f = fixture(t, { count: 6 }); f.play('clefairy', 3); const battle = f.view(f.leader).self.battle;
  assert.equal(battle.moves[0].legalTargetIds.length, 6); assert.equal(battle.moves[1].legalTargetIds.length, 3);
  const far = f.seats.find(who => !battle.moves[1].legalTargetIds.includes(who.playerId)); assert.ok(far); f.player(far).active.damage = 3;
  const cardId = f.supply(f.leader); rejectsAtomically(f, () => support(f, 1, undefined, { cardId, targetIds: [far.playerId] }));
  support(f, 0, 'heal', { cardId, targetIds: [far.playerId] }); f.respond(); assert.equal(f.player(far).active.damage, 1);
});

test('Dodge cancels Moonlight and Helping Hand while command use and Power are spent', t => {
  for (const moveIndex of [0, 1]) {
    const f = fixture(t); f.play('clefairy', 3); f.player(f.leader).active.reinforcements = ['power']; f.player(f.target).active.damage = 3; f.player(f.target).active.reinforcements = ['defense']; const top = f.room().drawPile.at(-1).id;
    const command = f.supply(f.leader), dodge = f.supply(f.target, 'dodge'); support(f, moveIndex, 'heal', { cardId: command }); f.respond('dodge', { cardId: dodge });
    assert.equal(f.player(f.target).active.damage, 3); assert.equal(f.player(f.target).hand.length, 0); assert.equal(f.room().drawPile.at(-1).id, top);
    assert.deepEqual(f.player(f.leader).active.reinforcements, []); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(countCard(f.room(), command), 1); assert.equal(countCard(f.room(), dodge), 1);
  }
});

test('Sand Veil sunny success cancels either support command using the ordinary judgment pipeline', t => {
  for (const moveIndex of [0, 1]) {
    const f = fixture(t); f.play('clefairy', 3); f.seed(f.target, 'sandshrew', 1, { damage: 3 }); const judgment = f.judgments('clear')[0]; support(f, moveIndex);
    assert.equal(f.room().pendingBattle.canTrait, true); f.respond('trait'); assert.equal(f.player(f.target).active.damage, 3); assert.equal(f.player(f.target).hand.length, 0); assert.equal(f.room().pendingBattle, null); assert.equal(countCard(f.room(), judgment.id), 1);
  }
});

test('Helping Hand gains the exact next two cards for its uncanceled target trainer', t => {
  const f = fixture(t); f.play('clefairy', 3); f.player(f.target).active.reinforcements = ['defense']; f.helmet(f.target); const cards = f.top('rain', 'clear'), command = f.supply(f.leader);
  support(f, 1, undefined, { cardId: command }); f.respond(); assert.deepEqual(f.player(f.target).hand, cards);
  assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.leader).active.damage, 0); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']);
  for (const id of [command, ...ids(cards)]) assert.equal(countCard(f.room(), id), 1); assert.equal(f.room().judgment ?? null, null);
});

test('Helping Hand shared gain batch triggers Pickup once after both cards have entered hand', t => {
  const f = fixture(t); f.play('clefairy', 3); f.seed(f.target, 'meowth', 2); const cards = f.top('rain', 'clear', 'thunderstorm'); support(f, 1); f.respond();
  assert.deepEqual(f.player(f.target).hand, cards); assert.deepEqual(f.room().turn.pickupUsedIds, [f.player(f.target).active.instanceId]);
  for (const card of cards) assert.equal(countCard(f.room(), card.id), 1);
});

test('Helping Hand draws zero through two actually available cards and refills real discards', t => {
  for (const count of [0, 1, 2]) {
    const f = fixture(t); f.play('clefairy', 3); f.room().drawPile = []; f.room().discardPile = []; const cards = f.top(...Array(count).fill('rain'));
    support(f, 1); f.respond(); assert.deepEqual(f.player(f.target).hand, cards); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().drawPile.length, 0);
  }
  const f = fixture(t); f.play('clefairy', 3); f.room().drawPile = []; const cards = [f.makeCard('dodge', 'rain'), f.makeCard('event', 'clear')]; f.room().discardPile = [...cards];
  support(f, 1); f.respond(); assert.deepEqual(new Set(ids(f.player(f.target).hand)), new Set(ids(cards))); for (const card of cards) assert.equal(countCard(f.room(), card.id), 1);
});

test('Cute Charm redirects support effects and both Clefable commands keep independent move-use limits', t => {
  const f = fixture(t); f.play('clefairy', 3); const cost = charm(f); f.player(f.third).active.damage = 3;
  support(f); redirect(f, cost); f.respond(); assert.equal(f.player(f.third).active.damage, 1); assert.equal(f.player(f.target).active.damage, 0);
  let battle = f.view(f.leader).self.battle; assert.equal(battle.moves[0].canUse, false); assert.equal(battle.moves[1].canUse, true);
  support(f, 1, undefined, { targetIds: [f.third.playerId] }); f.respond(); assert.equal(f.player(f.third).hand.length, 2); assert.equal(f.view(f.leader).self.battle.moves[1].canUse, false);
  f.act(f.leader, 'switchPokemon'); assert.equal(f.view(f.leader).self.battle.canCommand, false);
});

test('only Moonlight accepts effectChoice and commands never accept another trainer payment', t => {
  for (const [family, level, moveIndex] of [['clefairy', 1, 0], ['clefairy', 3, 1], ['exeggcute', 1, 0], ['squirtle', 1, 0]]) {
    const f = fixture(t); f.play(family, level); const own = f.supply(f.leader), foreign = f.supply(f.target);
    rejectsAtomically(f, () => f.attack({ cardId: own, moveIndex, effectChoice: 'heal' })); rejectsAtomically(f, () => f.attack({ cardId: foreign, moveIndex }));
  }
});

test('Harvest is projected only for the active owner in End on every level', t => {
  for (const level of [1, 2, 3]) {
    const f = fixture(t); f.play('exeggcute', level); assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => harvest(f));
    enterEnd(f); const battle = f.view(f.leader).self.battle; assert.equal(battle.canTrait, true); assert.deepEqual(battle.trait, { kind: 'harvest', name: { zh: '收获', en: 'Harvest' } });
    assert.equal(f.view(f.target).self.battle.canTrait, false); rejectsAtomically(f, () => f.act(f.target, 'useTrait'), 'NOT_YOUR_TURN');
  }
});

test('Harvest gains one actual card without judgment and preserves private card identity', t => {
  const f = fixture(t); f.play('exeggcute'); enterEnd(f); f.seed(f.third, 'vulpix'); const drawn = structuredClone(f.room().drawPile.at(-1)), before = allCards(f.room()).length; harvest(f);
  assert.deepEqual(f.player(f.leader).hand, [drawn]); assert.equal(f.room().judgment ?? null, null); assert.equal(f.room().pendingBattle, null); assert.equal(allCards(f.room()).length, before); assert.equal(countCard(f.room(), drawn.id), 1);
  const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true });
  for (const who of [f.target, f.third, observer]) { const view = f.view(who); assert.equal(JSON.stringify(view).includes(drawn.id), false); assert.equal(JSON.stringify(view).includes(drawn.privateMarker), false); }
});

test('Harvest is once per instance per End and resets on a later own turn', t => {
  const f = fixture(t); f.play('exeggcute'); enterEnd(f); const instance = f.player(f.leader).active.instanceId; harvest(f);
  assert.equal(f.view(f.leader).self.battle.canTrait, false); assert.deepEqual(f.room().turn.traitsUsed, [instance]); rejectsAtomically(f, () => harvest(f));
  f.store.startTurn(f.room(), f.leader.playerId, 9); while (f.room().turn.drawRemaining) f.act(f.leader, 'draw'); enterEnd(f);
  assert.equal(f.view(f.leader).self.battle.canTrait, true); harvest(f); assert.deepEqual(f.room().turn.traitsUsed, [instance]);
});

test('reserve, defeated, eliminated, other-phase and interrupted Harvest cannot be used', t => {
  for (const exclusion of ['reserve', 'defeated', 'eliminated', 'draw', 'discard', 'vote']) {
    const f = fixture(t); f.play('exeggcute'); enterEnd(f);
    if (exclusion === 'reserve') { f.player(f.leader).reserve.catalogueId = 'exeggcute'; f.player(f.leader).active.catalogueId = 'clefairy'; }
    else if (exclusion === 'defeated') f.player(f.leader).active.defeated = true;
    else if (exclusion === 'eliminated') f.player(f.leader).eliminated = true;
    else if (exclusion === 'vote') f.act(f.owner, 'requestEndGame');
    else f.room().turn.phase = exclusion;
    assert.equal(f.view(f.leader).self.battle?.canTrait ?? false, false); rejectsAtomically(f, () => harvest(f));
  }
});

test('empty-pile Harvest spends the use and real discard refill never invents cards', t => {
  for (const available of [false, true]) {
    const f = fixture(t); f.play('exeggcute'); enterEnd(f); f.room().drawPile = []; const card = f.makeCard('dodge', 'rain'); f.room().discardPile = available ? [card] : [];
    harvest(f); assert.deepEqual(f.player(f.leader).hand, available ? [card] : []); assert.equal(f.view(f.leader).self.battle.canTrait, false); assert.equal(f.room().drawPile.length, 0); assert.equal(f.room().discardPile.length, 0); rejectsAtomically(f, () => harvest(f));
  }
});

test('Harvest takes no extra selection or effect fields and rejected actions are atomic', t => {
  const f = fixture(t); f.play('exeggcute'); enterEnd(f); const cardId = f.supply(f.leader);
  for (const payload of [{ cardIds: [] }, { cardIds: [cardId] }, { cardId }, { targetId: f.target.playerId }, { effectChoice: 'heal' }, { moveIndex: 0 }]) rejectsAtomically(f, () => f.act(f.leader, 'useTrait', payload));
});

test('Harvest exact retries and restart preserve the once-only gain and completed Discard', t => {
  const f = fixture(t); f.play('exeggcute'); for (let i = 0; i < 4; i++) f.supply(f.leader); enterEnd(f); const drawn = f.room().drawPile.at(-1).id, request = f.input('useTrait');
  f.store.action(f.owner.code, f.leader.token, request); const before = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), before);
  const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); const view = restored.view(f.owner.code, f.leader.token).view, room = restored.rooms.get(f.owner.code);
  assert.equal(view.self.battle.canTrait, false); assert.equal(room.turn.discardComplete, true); assert.equal(room.players.find(player => player.id === f.leader.playerId).hand.filter(card => card.id === drawn).length, 1);
  restored.action(f.owner.code, f.leader.token, { id: 'harvest-end-restored', revision: view.revision, type: 'endTurn', levelUp: false }); assert.notEqual(restored.rooms.get(f.owner.code).turn.playerId, f.leader.playerId);
});

test('Harvest after four-card Discard completion hands off five cards without a second Discard', t => {
  const f = fixture(t); f.play('exeggcute'); for (let i = 0; i < 6; i++) f.supply(f.leader); assert.equal(f.room().turn.discardComplete, false);
  f.act(f.leader, 'finishPlay'); assert.equal(f.room().turn.phase, 'discard'); assert.equal(f.room().turn.discardComplete, false);
  f.act(f.leader, 'discard', { cardId: f.player(f.leader).hand[0].id }); assert.equal(f.room().turn.discardComplete, false);
  f.act(f.leader, 'discard', { cardId: f.player(f.leader).hand[0].id }); assert.equal(f.room().turn.phase, 'end'); assert.equal(f.room().turn.discardComplete, true);
  harvest(f); assert.equal(f.player(f.leader).hand.length, 5); rejectsAtomically(f, () => f.act(f.leader, 'discard', { cardId: f.player(f.leader).hand[0].id }));
  f.act(f.leader, 'endTurn', { levelUp: false }); assert.notEqual(f.room().turn.playerId, f.leader.playerId); assert.equal(f.player(f.leader).hand.length, 5); assert.equal(f.room().turn.discardComplete, false);
});

test('End clock after Harvest keeps the gained fifth card and does not invent a second Discard', t => {
  const f = fixture(t, { turnSeconds: 5 }); f.play('exeggcute'); for (let i = 0; i < 4; i++) f.supply(f.leader); enterEnd(f); harvest(f); const hand = structuredClone(f.player(f.leader).hand);
  f.advance(5_000); f.view(f.leader); assert.notEqual(f.room().turn.playerId, f.leader.playerId); assert.deepEqual(f.player(f.leader).hand, hand);
});

test('Harvest marks a legal legacy End as completed before its gain and evolution stays after Harvest', t => {
  const f = fixture(t); f.play('exeggcute'); for (let i = 0; i < 4; i++) f.supply(f.leader); enterEnd(f); delete f.room().turn.discardComplete;
  const instance = f.player(f.leader).active.instanceId; harvest(f); assert.equal(f.room().turn.discardComplete, true); assert.equal(f.player(f.leader).active.level, 1);
  assert.deepEqual(f.room().turn.traitsUsed, [instance]); f.act(f.leader, 'endTurn', { levelUp: true }); assert.equal(f.player(f.leader).active.level, 2); assert.equal(f.player(f.leader).hand.length, 5);
});

test('Discard completion initializes false and records direct End, Rattled skip and timeout handoff', t => {
  const f = fixture(t); assert.equal(f.room().turn.discardComplete, false); f.play('exeggcute'); enterEnd(f); assert.equal(f.room().turn.discardComplete, true);
  const g = fixture(t); g.play('magikarp'); for (let i = 0; i < 7; i++) g.supply(g.leader); enterEnd(g); assert.equal(g.room().turn.discardComplete, true); g.act(g.leader, 'endTurn', { levelUp: true }); assert.equal(g.player(g.leader).hand.length, 7);
  const h = fixture(t, { turnSeconds: 5 }); h.play('exeggcute'); h.advance(5_000); h.view(h.leader); assert.notEqual(h.room().turn.playerId, h.leader.playerId); assert.equal(h.room().turn.discardComplete, false);
});

test('Leech Seed deals one damage and heals its original source by one only after positive damage', t => {
  for (const injury of [0, 1, 3]) {
    const f = fixture(t); f.play('exeggcute'); f.player(f.leader).active.damage = injury; const command = f.supply(f.leader); f.attack({ cardId: command }); f.respond();
    assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.player(f.leader).active.damage, Math.max(0, injury - 1)); assert.equal(countCard(f.room(), command), 1);
  }
});

test('Leech Seed does not heal after Dodge, immunity or Shed Skin reduction to zero', t => {
  for (const prevention of ['dodge', 'immunity', 'shed']) {
    const f = fixture(t); f.play('exeggcute'); f.player(f.leader).active.damage = 2;
    if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId];
    if (prevention === 'shed') { f.seed(f.target, 'caterpie', 2); f.supply(f.target, 'event'); }
    f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {});
    if (prevention === 'shed') f.respond('shed', { cardIds: [f.player(f.target).hand[0].id] });
    assert.equal(f.player(f.leader).active.damage, 2); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().pendingBattle, null);
  }
});

test('Leech Seed source healing precedes receiving traits and never heals the target or reserve', t => {
  const f = fixture(t); f.play('exeggcute'); f.player(f.leader).active.damage = 2; f.player(f.leader).reserve.damage = 2; f.seed(f.target, 'nidoran-m', 2, { damage: 2 }); f.attack(); f.respond();
  assert.equal(f.room().pendingBattle.kind, 'poison-point'); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.player(f.target).active.damage, 3); assert.equal(f.player(f.leader).reserve.damage, 2); f.respond();
});

test('Seed Bomb deals exactly two plain damage without healing or a judgment', t => {
  const f = fixture(t); f.play('exeggcute', 2); f.player(f.leader).active.damage = 2; const top = f.room().drawPile.at(-1).id; f.attack(); f.respond();
  assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.leader).active.damage, 2); assert.equal(f.room().drawPile.at(-1).id, top); assert.equal(f.room().pendingBattle, null);
});

test('Psychic deals three and confuses only on final intense-sun judgment after positive damage', t => {
  for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) {
    const f = fixture(t); f.play('exeggcute', 3); const judged = f.judgments(weather)[0]; f.attack(); f.respond();
    assert.equal(f.player(f.target).active.damage, 3); assert.equal(f.player(f.target).active.status, weather === 'intense-sun' ? 'confusion' : null); assert.equal(countCard(f.room(), judged.id), 1); assert.equal(f.room().pendingBattle, null);
  }
});

test('Psychic uses Drought final weather, Poison Touch replacement and Shield Dust immunity', t => {
  for (const shield of [false, true]) {
    const f = fixture(t, { count: 4 }); f.play('exeggcute', 3); f.seed(f.third, 'vulpix'); const grimer = f.seats.find(who => ![f.leader, f.target, f.third].includes(who)); f.seed(grimer, 'grimer');
    if (shield) f.seed(f.target, 'caterpie'); const replacement = f.supply(f.third, 'event', 'intense-sun'); f.judgments('rain'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'judgment'); f.respond('replace', { cardId: replacement });
    if (!shield) { assert.equal(f.room().pendingBattle.kind, 'poison-touch'); assert.equal(f.room().pendingBattle.status, 'confusion'); f.respond('trait'); }
    assert.equal(f.player(f.target).active.status, shield ? null : 'poison'); assert.equal(f.room().pendingBattle, null);
  }
});

test('Psychic skips judgment on canceled or immune damage and never confuses a deployed reserve', t => {
  for (const prevention of ['dodge', 'immunity', 'faint']) {
    const f = fixture(t); f.play('exeggcute', 3); if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId];
    if (prevention === 'faint') f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); const incoming = f.player(f.target).reserve.instanceId; const judged = f.judgments('intense-sun')[0];
    f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); f.drain();
    assert.equal(f.player(f.target).active.status, null); if (prevention === 'faint') assert.equal(f.player(f.target).active.instanceId, incoming); else assert.equal(f.room().drawPile.at(-1).id, judged.id);
  }
});

test('empty Psychic judgment commits damage and command cleanup without a fabricated result or Drought exchange', t => {
  const f = fixture(t); f.play('exeggcute', 3); f.seed(f.third, 'vulpix'); const sunny = f.supply(f.third, 'event', 'intense-sun');
  const hand = structuredClone(f.player(f.third).hand); f.room().drawPile = []; f.room().discardPile = [];
  const command = f.supply(f.leader); f.attack({ cardId: command }); assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond();
  assert.equal(f.player(f.target).active.damage, 3); assert.equal(f.player(f.target).active.status, null);
  assert.deepEqual(f.player(f.third).hand, hand); assert.equal(countCard(f.room(), sunny), 1);
  assert.equal(f.room().judgment ?? null, null); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null);
  assert.deepEqual(ids(f.room().discardPile), [command]); assert.equal(countCard(f.room(), command), 1); assert.equal(f.room().drawPile.length, 0);
  assert.equal(f.view(f.leader).self.battle.canCommand, false);
});

test('empty Psychic then optional Static judgments never interpret no result as non-intense-sun paralysis', t => {
  const f = fixture(t); f.play('exeggcute', 3); f.seed(f.target, 'pikachu'); f.seed(f.third, 'vulpix');
  f.supply(f.third, 'event', 'clear'); const hand = structuredClone(f.player(f.third).hand); f.room().drawPile = []; f.room().discardPile = [];
  const command = f.supply(f.leader); f.attack({ cardId: command }); f.respond();
  assert.equal(f.player(f.target).active.damage, 3); assert.equal(f.player(f.target).active.status, null);
  assert.equal(f.room().pendingBattle.kind, 'static'); assert.equal(f.room().pendingBattle.actorId, f.target.playerId); f.respond('trait');
  assert.equal(f.player(f.leader).active.status, null); assert.deepEqual(f.player(f.third).hand, hand);
  assert.equal(f.room().judgment ?? null, null); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null);
  assert.deepEqual(ids(f.room().discardPile), [command]); assert.equal(countCard(f.room(), command), 1); assert.equal(f.room().drawPile.length, 0);
});

test('empty Psychic skips unavailable Poison Point without poisoning source or stalling receiving continuation', t => {
  const f = fixture(t); f.play('exeggcute', 3); f.seed(f.target, 'nidoran-m', 3); f.room().drawPile = []; f.room().discardPile = [];
  const command = f.supply(f.leader); f.attack({ cardId: command }); f.respond();
  assert.equal(f.player(f.target).active.damage, 3); assert.equal(f.player(f.target).active.status, null); assert.equal(f.player(f.leader).active.status, null);
  assert.equal(f.room().judgment ?? null, null); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null);
  assert.deepEqual(ids(f.room().discardPile), [command]); assert.equal(countCard(f.room(), command), 1); assert.equal(allCards(f.room()).length, 1);
});

test('Psychic and Poison Point still judge the actual recycled discard when a real card is available', t => {
  const f = fixture(t); f.play('exeggcute', 3); f.seed(f.target, 'nidoran-m'); f.room().drawPile = [];
  const judged = f.makeCard('event', 'rain'); f.room().discardPile = [judged]; const command = f.supply(f.leader); f.attack({ cardId: command }); f.respond();
  assert.equal(f.player(f.target).active.damage, 3); assert.equal(f.player(f.target).active.status, null); assert.equal(f.room().pendingBattle.kind, 'poison-point');
  assert.deepEqual(f.room().discardPile, [judged]); f.respond('trait'); assert.equal(f.player(f.leader).active.status, 'poison');
  assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null); assert.equal(countCard(f.room(), judged.id), 1); assert.equal(countCard(f.room(), command), 1);
  assert.equal(allCards(f.room()).length, 2);
});
