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
  const dir = mkdtempSync(join(root, 'cubone-koffing-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `cubone-koffing-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates, activeId = candidates.find(id => id !== 'koffing'); act(who, 'selectPokemon', { activeId, reserveId: candidates.find(id => id !== activeId) }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-cubone-koffing-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private Cubone Koffing card ${serial}` } });
  room().drawPile = Array.from({ length: 48 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const top = (...weather) => { const cards = weather.map(value => makeCard('reveal-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const judgments = (...weather) => { const cards = weather.map(value => makeCard('judgment-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id), third = seats.find(who => who !== leader && who !== target);
  const play = (family = 'cubone', level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, family, level); };
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

const armor = (f, cardId) => f.respond('armor', { cardId });
const repeat = (f, cardId) => f.respond('repeat', { cardId });
const gas = (f, cardId, targetId) => f.respond('suppress', { cardId, targetId });
const start = (f, who = f.leader) => f.store.startTurn(f.room(), who.playerId, f.room().turn.number + 1);
const drawToPlay = (f, who = f.leader) => { while (f.room().turn.drawRemaining) f.act(who, 'draw'); };
const enterEnd = (f, who = f.leader) => { f.act(who, 'finishPlay'); while (f.room().turn.phase === 'discard') f.act(who, 'discard', { cardId: f.player(who).hand[0].id }); };
function suppress(f, target = f.target, actor = f.third) {
  f.seed(actor, 'koffing'); const cost = f.supply(actor, 'event', 'rain'); start(f);
  assert.equal(f.room().pendingBattle.kind, 'neutralizing-gas'); assert.equal(f.room().pendingBattle.actorId, actor.playerId);
  gas(f, cost, target.playerId); f.drain(); drawToPlay(f); return cost;
}
const activeView = (f, who, viewer = f.leader) => f.view(viewer).players.find(player => player.id === who.playerId).active;
const switchIds = (f, who = f.leader) => [f.player(who).active.instanceId, f.player(who).reserve.instanceId];

// Shared legal room, identity and candidate setup; physical cards retain unique identities.
test('Cubone and Koffing reviewed faces expose exact HP, command values and target limits', t => {
  for (const family of ['cubone', 'koffing']) {
    const entry = catalogue.entries.find(entry => entry.id === family); assert.deepEqual(entry.levels.map(face => face.hp), [3, 4, 4]);
    assert.deepEqual(entry.levels.map(face => face.effectStatus), Array(3).fill('combat-preview'));
    for (const level of [1, 2, 3]) {
      const f = fixture(t); f.play(family, level); const battle = f.view(f.leader).self.battle;
      assert.equal(battle.canCommand, true); assert.equal(battle.canTrait, false); assert.equal(battle.moves.length, 1);
      assert.equal(battle.move.printedValue, family === 'cubone' && level === 1 ? 1 : 2);
      assert.equal(battle.move.maxTargets, family === 'koffing' && level === 3 ? 2 : 1);
      assert.equal(battle.moves[0].condition.kind, 'command');
    }
  }
});

test('Tackle spends one actual command, deals one and retains the ordinary once-per-move limit', t => {
  const f = fixture(t); f.play(); const command = f.supply(f.leader), actual = structuredClone(f.player(f.leader).hand[0]); f.attack({ cardId: command }); f.respond();
  assert.equal(f.player(f.target).active.damage, 1); assert.deepEqual(f.room().discardPile.find(card => card.id === command), actual); assert.equal(countCard(f.room(), command), 1);
  assert.equal(f.view(f.leader).self.battle.canCommand, false); const second = f.supply(f.leader); rejectsAtomically(f, () => f.attack({ cardId: second }));
});

test('Battle Armor on each level pays any actual own card after positive receiving damage and gains one Defense', t => {
  for (const level of [1, 2, 3]) for (const kind of ['command', 'dodge', 'event', 'held-item']) {
    const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'cubone', level); const cost = f.supply(f.target, kind, 'thunderstorm'), actual = structuredClone(f.player(f.target).hand[0]); f.attack(); f.respond();
    assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle.kind, 'battle-armor'); assert.equal(f.room().pendingBattle.actorId, f.target.playerId);
    armor(f, cost); assert.deepEqual(f.player(f.target).active.reinforcements, []); assert.deepEqual(f.room().discardPile.find(card => card.id === cost), actual); assert.equal(countCard(f.room(), cost), 1);
    assert.equal(f.room().pendingBattle, null);
  }
});

test('Battle Armor pass keeps payment and does not install Defense', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'cubone'); const cost = f.supply(f.target); f.attack(); f.respond(); f.respond();
  assert.equal(f.player(f.target).hand.some(card => card.id === cost), true); assert.deepEqual(f.player(f.target).active.reinforcements, []); assert.equal(f.room().resolution, null);
});

test('Battle Armor is absent after Dodge, zero damage, defeat and reserve-only traits', t => {
  for (const prevention of ['dodge', 'immunity', 'defeat', 'reserve']) {
    const f = fixture(t); f.play('squirtle'); f.seed(f.target, prevention === 'reserve' ? 'squirtle' : 'cubone', 1, prevention === 'defeat' ? { hpBonus: 0, damage: 2 } : {}); f.player(f.target).reserve.catalogueId = 'cubone'; f.supply(f.target);
    if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId];
    f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); f.drain();
    assert.deepEqual(f.player(f.target).active.reinforcements, []); assert.equal(f.room().pendingBattle, null);
  }
});

test('Battle Armor is a receiving trait and never activates merely for dealing damage', t => {
  const f = fixture(t); f.play(); f.supply(f.leader, 'event'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle, null); assert.deepEqual(f.player(f.leader).active.reinforcements, []);
});

test('Battle Armor publicly exposes safe actor-only payment cards and keeps hand identities private', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'cubone'); const cost = f.supply(f.target, 'dodge', 'rain'), actual = structuredClone(f.player(f.target).hand[0]), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); f.attack(); f.respond();
  assert.deepEqual(f.view(f.target).pendingBattle.paymentCards, [publicHand(actual)]);
  for (const who of [f.leader, f.third, observer]) { const view = f.view(who); assert.equal(view.pendingBattle.paymentCards, undefined); assert.equal(JSON.stringify(view).includes(cost), false); assert.equal(JSON.stringify(view).includes(actual.privateMarker), false); }
  assert.equal(JSON.stringify(f.view(f.target).pendingBattle).includes('privateMarker'), false);
});

test('Battle Armor rejects wrong actor, stale decisions, foreign cards and extra response fields atomically', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'cubone'); const own = f.supply(f.target), foreign = f.supply(f.third); f.attack(); f.respond(); const pending = f.room().pendingBattle;
  rejectsAtomically(f, () => f.act(f.third, 'respondBattle', { decisionId: pending.id, choice: 'armor', cardId: foreign }), 'NOT_YOUR_DECISION');
  rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: 'stale', choice: 'armor', cardId: own }), 'STALE_DECISION');
  for (const payload of [{ choice: 'armor', cardId: foreign }, { choice: 'armor', cardId: 'forged' }, { choice: 'armor' }, { choice: 'pass', cardId: own }, { choice: 'trait' }, { choice: 'armor', cardId: own, targetId: f.third.playerId }, { choice: 'armor', cardId: own, cardIds: [] }]) rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, ...payload }));
});

test('Battle Armor and Rocky Helmet allow receiver-selected ordering with nested damage fully completed', t => {
  for (const first of ['battle-armor', 'rocky-helmet']) {
    const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'cubone'); const cost = f.supply(f.target); f.helmet(f.target); f.attack(); f.respond();
    assert.equal(f.room().pendingBattle.kind, 'effects'); assert.deepEqual(new Set(f.room().pendingBattle.effects), new Set(['battle-armor', 'rocky-helmet'])); f.respond('effect', { effect: first });
    if (first === 'rocky-helmet') assert.equal(f.player(f.leader).active.damage, 1);
    assert.equal(f.room().pendingBattle.kind, 'battle-armor'); armor(f, cost); f.drain(); assert.equal(f.player(f.leader).active.damage, 1); assert.deepEqual(f.player(f.target).active.reinforcements, []);
  }
});

test('Battle Armor restart and exact response retries discard once and perform whole-card Defense cleanup', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'cubone'); const cost = f.supply(f.target); f.attack(); f.respond();
  const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); const view = restored.view(f.owner.code, f.target.token).view;
  assert.equal(view.pendingBattle.kind, 'battle-armor'); const request = { id: 'restored-armor', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'armor', cardId: cost };
  restored.action(f.owner.code, f.target.token, request); const state = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.target.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), state);
  assert.equal(countCard(state, cost), 1); assert.deepEqual(state.players.find(player => player.id === f.target.playerId).active.reinforcements, []);
});

test('Bone Rush can be commanded repeatedly while every use pays a distinct actual command', t => {
  const f = fixture(t); f.play('cubone', 2); const commands = Array.from({ length: 4 }, () => f.supply(f.leader));
  for (let index = 0; index < commands.length; index++) { f.attack({ cardId: commands[index] }); f.respond(); assert.equal(f.player(f.target).active.damage, 2 * (index + 1)); assert.equal(f.view(f.leader).self.battle.canCommand, true); }
  for (const cardId of commands) assert.equal(countCard(f.room(), cardId), 1);
  rejectsAtomically(f, () => f.attack({ cardId: commands[0] })); assert.equal(f.room().turn.commandCreatureId, f.player(f.leader).active.instanceId);
});

test('Bone Rush keeps the one command-using instance rule across switching', t => {
  const f = fixture(t); f.play('cubone', 2); f.player(f.leader).reserve.catalogueId = 'cubone'; f.player(f.leader).reserve.level = 2; const original = f.player(f.leader).active.instanceId; f.attack(); f.respond();
  f.act(f.leader, 'switchPokemon'); assert.equal(f.view(f.leader).self.battle.canCommand, false); const command = f.supply(f.leader); rejectsAtomically(f, () => f.attack({ cardId: command }));
  f.room().turn.switchUsed = false; f.act(f.leader, 'switchPokemon'); assert.equal(f.player(f.leader).active.instanceId, original); assert.equal(f.view(f.leader).self.battle.canCommand, true);
});

test('Bone Rush needs command kind, respects ordinary target range and consumes Power only on its first use', t => {
  const f = fixture(t, { count: 6 }); f.play('cubone', 2); f.player(f.leader).active.reinforcements = ['power']; const event = f.supply(f.leader, 'event');
  rejectsAtomically(f, () => f.attack({ cardId: event })); const far = f.seats.find(who => !f.view(f.leader).self.battle.legalTargetIds.includes(who.playerId)), command = f.supply(f.leader); assert.ok(far);
  rejectsAtomically(f, () => f.attack({ cardId: command, targetIds: [far.playerId] })); f.attack({ cardId: command }); f.respond(); assert.equal(f.player(f.target).active.damage, 3);
  f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 5); assert.deepEqual(f.player(f.leader).active.reinforcements, []);
});

test('Bonemerang first settlement ends before the optional repeat and pays any own card for exactly one second hit', t => {
  for (const kind of ['command', 'dodge', 'event', 'held-item']) {
    const f = fixture(t); f.play('cubone', 3); const command = f.supply(f.leader), cost = f.supply(f.leader, kind, 'rain'); f.attack({ cardId: command }); f.respond();
    assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle.kind, 'bonemerang'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId);
    repeat(f, cost); assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond(); assert.equal(f.player(f.target).active.damage, 4); assert.equal(f.room().pendingBattle, null);
    for (const id of [command, cost]) assert.equal(countCard(f.room(), id), 1); assert.equal(f.view(f.leader).self.battle.canCommand, false);
  }
});

test('Bonemerang repeat can be declined with no extra payment or second settlement', t => {
  const f = fixture(t); f.play('cubone', 3); const cost = f.supply(f.leader, 'event'); f.attack(); f.respond(); f.respond();
  assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.leader).hand.some(card => card.id === cost), true); assert.equal(f.room().resolution, null);
});

test('Bonemerang can repeat after a dodged or zero-damage first settlement', t => {
  for (const prevention of ['dodge', 'immunity']) {
    const f = fixture(t); f.play('cubone', 3); const cost = f.supply(f.leader, 'event'); if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId];
    f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {});
    assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().pendingBattle.kind, 'bonemerang'); repeat(f, cost); assert.equal(f.room().pendingBattle.kind, 'defense');
    if (prevention === 'immunity') f.room().turn.damageImmunityIds = []; f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle, null);
  }
});

test('Bonemerang waits for receiving traits and nested Helmet damage before offering its repeat', t => {
  const f = fixture(t); f.play('cubone', 3); f.seed(f.target, 'pikachu'); f.helmet(f.target); const cost = f.supply(f.leader, 'event'); f.attack(); f.respond();
  assert.equal(f.room().pendingBattle.kind, 'effects'); f.respond('effect', { effect: 'rocky-helmet' }); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.room().pendingBattle.kind, 'battle-armor'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); f.respond(); assert.equal(f.room().pendingBattle.kind, 'static'); f.respond();
  assert.equal(f.room().pendingBattle.kind, 'bonemerang'); repeat(f, cost); f.drain(); assert.equal(f.player(f.target).active.damage, 4); assert.equal(f.player(f.leader).active.damage, 2);
});

test('Bonemerang Power boosts both settlements and preexisting Defense lasts for the whole card', t => {
  const f = fixture(t); f.play('cubone', 3); f.player(f.leader).active.reinforcements = ['power']; f.player(f.target).active.reinforcements = ['defense']; const cost = f.supply(f.leader, 'event');
  f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 1); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); repeat(f, cost); f.respond();
  assert.equal(f.player(f.target).active.damage, 2); assert.deepEqual(f.player(f.target).active.reinforcements, []); assert.deepEqual(f.player(f.leader).active.reinforcements, []);
  const g = fixture(t); g.play('cubone', 3); g.player(g.leader).active.reinforcements = ['power']; const payment = g.supply(g.leader, 'event'); g.attack(); g.respond(); repeat(g, payment); g.respond(); assert.equal(g.player(g.target).active.damage, 6);
});

test('Bonemerang stops after original target defeat and cannot attack its deployed reserve', t => {
  const f = fixture(t); f.play('cubone', 3); f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); const incoming = f.player(f.target).reserve.instanceId, cost = f.supply(f.leader, 'event'); f.attack(); f.drain();
  assert.equal(f.player(f.target).active.instanceId, incoming); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.leader).hand.some(card => card.id === cost), true); assert.equal(f.room().resolution, null);
});

test('Bonemerang source defeat in nested Helmet damage ends the command without a reserve repeat', t => {
  const f = fixture(t); f.play('cubone', 3); Object.assign(f.player(f.leader).active, { hpBonus: 0, damage: 3 }); f.helmet(f.target); const before = switchIds(f), cost = f.supply(f.leader, 'event'); f.attack(); f.drain();
  assert.deepEqual(switchIds(f), before.reverse()); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.leader).hand.some(card => card.id === cost), true); assert.equal(f.room().resolution, null);
});

test('Bonemerang binds a Cute Charm redirected original instance before its two settlements', t => {
  const f = fixture(t); f.play('cubone', 3); f.seed(f.target, 'clefairy'); const charm = f.supply(f.target), payment = f.supply(f.leader, 'event'); f.attack();
  assert.equal(f.room().pendingBattle.kind, 'cute-charm'); f.respond('redirect', { cardId: charm, targetId: f.third.playerId }); f.respond(); assert.equal(f.room().pendingBattle.kind, 'bonemerang'); repeat(f, payment); f.respond();
  assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.third).active.damage, 4); assert.equal(f.room().pendingBattle, null);
});

test('Bonemerang enforces actor, stale decision, own payment and strict response fields', t => {
  const f = fixture(t); f.play('cubone', 3); const own = f.supply(f.leader, 'event'), foreign = f.supply(f.third); f.attack(); f.respond(); const pending = f.room().pendingBattle;
  rejectsAtomically(f, () => f.act(f.third, 'respondBattle', { decisionId: pending.id, choice: 'repeat', cardId: foreign }), 'NOT_YOUR_DECISION');
  for (const payload of [{ choice: 'repeat', cardId: foreign }, { choice: 'repeat', cardId: 'forged' }, { choice: 'repeat' }, { choice: 'pass', cardId: own }, { choice: 'repeat', cardId: own, targetId: f.third.playerId }, { choice: 'repeat', cardId: own, effect: 'repeat' }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...payload }));
  repeat(f, own); rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, choice: 'pass' }), 'STALE_DECISION'); f.drain();
});

test('Bonemerang actor-only payment projection and restart retries preserve the exact second settlement', t => {
  const f = fixture(t); f.play('cubone', 3); const payment = f.supply(f.leader, 'event', 'rain'), actual = f.player(f.leader).hand.find(card => card.id === payment); f.attack(); f.respond();
  assert.deepEqual(f.view(f.leader).pendingBattle.paymentCards, [publicHand(actual)]); assert.deepEqual(f.view(f.leader).pendingBattle.settlementMove, { zh: '骨头回力镖', en: 'Bonemerang' }); assert.equal(f.view(f.target).pendingBattle.paymentCards, undefined);
  const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.leader.token).view;
  const request = { id: 'restored-bonemerang', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'repeat', cardId: payment };
  restored.action(f.owner.code, f.leader.token, request); const before = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.leader.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), before);
  const pending = before.pendingBattle; assert.equal(pending.kind, 'defense'); const finish = { id: 'restored-bonemerang-hit', revision: before.revision, type: 'respondBattle', decisionId: pending.id, choice: 'pass' };
  restored.action(f.owner.code, f.target.token, finish); const room = restored.rooms.get(f.owner.code); assert.equal(room.players.find(player => player.id === f.target.playerId).active.damage, 4); assert.equal(room.pendingBattle, null); assert.equal(countCard(room, payment), 1);
});

test('optional Armor and Bonemerang clocks expire as pass and keep unspent payment', t => {
  for (const kind of ['battle-armor', 'bonemerang']) {
    const f = fixture(t, { responseSeconds: 5 }); f.play(kind === 'bonemerang' ? 'cubone' : 'squirtle', kind === 'bonemerang' ? 3 : 1);
    if (kind === 'battle-armor') f.seed(f.target, 'cubone'); const owner = kind === 'bonemerang' ? f.leader : f.target, cost = f.supply(owner, 'event'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, kind);
    f.advance(5_000); f.view(owner); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(owner).hand.some(card => card.id === cost), true); assert.equal(f.player(f.target).active.damage, 2);
  }
});

test('Acid Spray is a plain two-damage command with no weather judgment', t => {
  const f = fixture(t); f.play('koffing'); const top = f.room().drawPile.at(-1).id, command = f.supply(f.leader); f.attack({ cardId: command }); f.respond();
  assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, null); assert.equal(f.room().drawPile.at(-1).id, top); assert.equal(countCard(f.room(), command), 1); assert.equal(f.view(f.leader).self.battle.canCommand, false);
});

test('Sludge Bomb and Sludge Wave poison only on heavy-rain final judgment', t => {
  for (const level of [2, 3]) for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) {
    const f = fixture(t); f.play('koffing', level); const judgment = f.judgments(weather)[0]; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2);
    assert.equal(f.player(f.target).active.status, weather === 'rain' ? 'poison' : null); assert.equal(countCard(f.room(), judgment.id), 1); assert.equal(f.room().pendingBattle, null);
  }
});

test('Sludge Wave keeps other target slots and makes independent judgments in supplied target order', t => {
  const f = fixture(t); f.play('koffing', 3); f.judgments('rain', 'intense-sun'); const command = f.supply(f.leader); f.attack({ cardId: command, targetIds: [f.target.playerId, f.third.playerId] });
  f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, 'poison'); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); assert.equal(f.player(f.third).active.damage, 0);
  f.respond(); assert.equal(f.player(f.third).active.damage, 2); assert.equal(f.player(f.third).active.status, null); assert.equal(countCard(f.room(), command), 1);
});

test('Sludge judgments require positive damage and never poison incoming reserves', t => {
  for (const prevention of ['dodge', 'immunity', 'shed', 'faint']) {
    const f = fixture(t); f.play('koffing', 2); if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId];
    if (prevention === 'shed') { f.seed(f.target, 'caterpie', 2); f.supply(f.target, 'event'); f.supply(f.target, 'event'); }
    if (prevention === 'faint') f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); const incoming = f.player(f.target).reserve.instanceId, judgment = f.judgments('rain')[0]; f.attack();
    f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); if (prevention === 'shed') f.respond('shed', { cardIds: ids(f.player(f.target).hand) }); f.drain();
    assert.equal(f.player(f.target).active.status, null); if (prevention === 'faint') assert.equal(f.player(f.target).active.instanceId, incoming); else assert.equal(f.room().drawPile.at(-1).id, judgment.id);
  }
});

test('Sludge uses Drought final weather and Shield Dust status immunity', t => {
  for (const shield of [false, true]) {
    const f = fixture(t); f.play('koffing', 2); f.seed(f.third, 'vulpix'); if (shield) f.seed(f.target, 'caterpie'); const replacement = f.supply(f.third, 'event', 'clear'); f.judgments('rain'); f.attack(); f.respond();
    assert.equal(f.room().pendingBattle.kind, 'judgment'); f.respond('replace', { cardId: replacement }); assert.equal(f.player(f.target).active.status, null); assert.equal(f.player(f.target).active.damage, 2); assert.equal(countCard(f.room(), replacement), 1);
  }
});

test('Sludge safely skips an empty judgment and commits real damage without fabricated poison', t => {
  const f = fixture(t); f.play('koffing', 3); f.room().drawPile = []; f.room().discardPile = []; const command = f.supply(f.leader); f.attack({ cardId: command, targetIds: [f.target.playerId, f.third.playerId] }); f.drain();
  for (const who of [f.target, f.third]) { assert.equal(f.player(who).active.damage, 2); assert.equal(f.player(who).active.status, null); }
  assert.equal(f.room().judgment ?? null, null); assert.equal(f.room().resolution, null); assert.deepEqual(ids(f.room().discardPile), [command]);
});

test('Neutralizing Gas triggers at any trainer turn start on all levels, pays any weather and can target its own trainer', t => {
  for (const level of [1, 2, 3]) {
    const f = fixture(t); f.play('squirtle'); f.seed(f.third, 'koffing', level); const cost = f.supply(f.third, 'dodge', 'thunderstorm'); start(f);
    assert.equal(f.room().pendingBattle.kind, 'neutralizing-gas'); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); gas(f, cost, f.third.playerId);
    assert.deepEqual(f.room().turn.suppressedTraitPlayerIds, [f.third.playerId]); assert.equal(activeView(f, f.third).traitsSuppressed, true); assert.equal(countCard(f.room(), cost), 1); assert.equal(f.room().pendingBattle, null);
  }
});

test('Gas target choices include every distant living trainer but exclude spectators and eliminated trainers', t => {
  const f = fixture(t, { count: 6 }); f.play('squirtle'); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); const removed = f.seats.find(who => ![f.leader, f.target, f.third].includes(who)); f.player(removed).eliminated = true;
  const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); start(f); const legal = f.room().pendingBattle.legalTargetIds;
  assert.deepEqual(new Set(legal), new Set(f.seats.filter(who => who !== removed).map(who => who.playerId))); assert.equal(legal.includes(observer.playerId), false);
  for (const targetId of [removed.playerId, observer.playerId, 'forged']) rejectsAtomically(f, () => gas(f, cost, targetId));
  const far = f.seats.find(who => who !== removed && ![f.third.playerId, f.leader.playerId].includes(who.playerId)); gas(f, cost, far.playerId); assert.equal(activeView(f, far).traitsSuppressed, true);
});

test('Gas projects public legal trainer choices and safe actor-only payment cards', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.third, 'koffing'); const cost = f.supply(f.third, 'event', 'rain'), actual = structuredClone(f.player(f.third).hand[0]), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); start(f);
  for (const who of [...f.seats, observer]) { const view = f.view(who); assert.deepEqual(new Set(view.pendingBattle.legalTargetIds), new Set(f.seats.map(who => who.playerId))); if (who !== f.third) { assert.equal(view.pendingBattle.paymentCards, undefined); assert.equal(JSON.stringify(view).includes(cost), false); } assert.equal(JSON.stringify(view.pendingBattle).includes(actual.privateMarker), false); }
  assert.deepEqual(f.view(f.third).pendingBattle.paymentCards, [publicHand(actual)]);
});

test('Gas actor authority and strict own-card target selection reject atomically', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.third, 'koffing'); const own = f.supply(f.third), foreign = f.supply(f.target); start(f); const pending = f.room().pendingBattle;
  rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'suppress', cardId: foreign, targetId: f.leader.playerId }), 'NOT_YOUR_DECISION');
  for (const payload of [{ choice: 'suppress', cardId: foreign, targetId: f.leader.playerId }, { choice: 'suppress', cardId: 'forged', targetId: f.leader.playerId }, { choice: 'suppress', cardId: own }, { choice: 'suppress', targetId: f.leader.playerId }, { choice: 'pass', cardId: own }, { choice: 'pass', targetId: f.leader.playerId }, { choice: 'suppress', cardId: own, targetId: f.leader.playerId, cardIds: [] }, { choice: 'suppress', cardId: own, targetId: f.leader.playerId, effect: 'status' }]) rejectsAtomically(f, () => f.act(f.third, 'respondBattle', { decisionId: pending.id, ...payload }));
});

test('Gas pass preserves payment and does not suppress any trainer', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); start(f); f.respond();
  assert.deepEqual(f.room().turn.suppressedTraitPlayerIds, []); assert.equal(f.player(f.third).hand.some(card => card.id === cost), true); assert.equal(f.room().pendingBattle, null);
});

test('multiple Koffing offers follow current-first living seat order and a suppressed queued Koffing is skipped', t => {
  const f = fixture(t, { count: 4 }); f.play('koffing'); const ordered = f.room().players.filter(player => !player.spectator).map(player => f.byId(player.id));
  for (const who of ordered) { f.seed(who, 'koffing'); f.supply(who); } start(f); const actual = [];
  for (const who of ordered) { assert.equal(f.room().pendingBattle.actorId, who.playerId); actual.push(f.room().pendingBattle.actorId); f.respond(); }
  assert.deepEqual(actual, ordered.map(who => who.playerId)); assert.equal(f.room().pendingBattle, null);
  start(f); const cost = f.player(f.leader).hand[0].id; gas(f, cost, ordered[1].playerId); assert.equal(f.room().pendingBattle.actorId, ordered[2].playerId); f.drain();
});

test('Gas excludes reserve-only, defeated and eliminated Koffings', t => {
  for (const excluded of ['reserve', 'defeated', 'eliminated']) {
    const f = fixture(t); f.play('squirtle'); if (excluded === 'reserve') f.player(f.third).reserve.catalogueId = 'koffing'; else { f.seed(f.third, 'koffing'); if (excluded === 'defeated') f.player(f.third).active.defeated = true; else f.player(f.third).eliminated = true; }
    f.supply(f.third); start(f); assert.equal(f.room().pendingBattle, null); assert.deepEqual(f.room().turn.suppressedTraitPlayerIds, []);
  }
});

test('Gas suppression follows trainer across partner switches and resets at the next turn', t => {
  const f = fixture(t); f.play('squirtle'); suppress(f, f.leader); assert.equal(activeView(f, f.leader).traitsSuppressed, true); f.act(f.leader, 'switchPokemon'); assert.equal(activeView(f, f.leader).traitsSuppressed, true);
  assert.deepEqual(f.room().turn.suppressedTraitPlayerIds, [f.leader.playerId]); enterEnd(f); f.act(f.leader, 'endTurn', { levelUp: false }); assert.deepEqual(f.room().turn.suppressedTraitPlayerIds, []); assert.equal(activeView(f, f.leader).traitsSuppressed, false); f.drain();
});

test('Gas pending and selected target persist through restart and exact request retry', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); start(f); f.store.persist(f.room());
  const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.third.token).view; assert.equal(view.pendingBattle.kind, 'neutralizing-gas');
  const request = { id: 'gas-retry', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'suppress', cardId: cost, targetId: f.target.playerId };
  restored.action(f.owner.code, f.third.token, request); const saved = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.third.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), saved);
  const second = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); assert.deepEqual(second.rooms.get(f.owner.code).turn.suppressedTraitPlayerIds, [f.target.playerId]); assert.equal(countCard(saved, cost), 1);
});

test('Gas optional timer expires as pass and keeps the main turn clock paused during its decision', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play('squirtle'); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); start(f); f.advance(5_000); f.view(f.third);
  assert.equal(f.room().pendingBattle, null); assert.deepEqual(f.room().turn.suppressedTraitPlayerIds, []); assert.equal(f.player(f.third).hand.some(card => card.id === cost), true); assert.equal(f.view(f.leader).turn.clock.remainingMs, 60_000);
});

test('Gas disables source damage traits while preserving move damage text and Power', t => {
  for (const [family, level, extra, expected] of [['charmander', 1, { hpBonus: 0, damage: 2 }, 2], ['machop', 1, { status: 'burn' }, 1], ['nidoran-m', 3, {}, 5]]) {
    const f = fixture(t); f.play(family, level); Object.assign(f.player(f.leader).active, extra); suppress(f, f.leader); f.player(f.leader).active.reinforcements = ['power']; f.judgments('clear'); f.attack();
    if (f.room().pendingBattle.kind === 'reinforcement') f.respond('reinforcement', { reinforcement: f.room().pendingBattle.reinforcements[0] }); f.drain(); assert.equal(f.player(f.target).active.damage, expected);
  }
});

test('Gas disables receiving Multiscale and Shed Skin but retains ordinary Defense marker reduction', t => {
  for (const family of ['dratini', 'caterpie']) {
    const f = fixture(t); f.play('squirtle'); f.seed(f.target, family, family === 'dratini' ? 3 : 2); f.supply(f.target); suppress(f); f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle, null);
  }
  const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'dratini', 3, { reinforcements: ['defense'] }); suppress(f); f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 1); assert.deepEqual(f.player(f.target).active.reinforcements, []);
});

test('Gas disables Shield Dust while a suppressed Koffing still uses its poison move effect', t => {
  const f = fixture(t); f.play('koffing', 2); f.seed(f.target, 'caterpie'); suppress(f, f.target); f.judgments('rain'); f.attack(); f.respond(); assert.equal(f.player(f.target).active.status, 'poison');
  const g = fixture(t); g.play('koffing', 2); suppress(g, g.leader); g.judgments('rain'); g.attack(); g.respond(); assert.equal(g.player(g.target).active.damage, 2); assert.equal(g.player(g.target).active.status, 'poison');
});

test('Gas disables Drought without removing the rainy judgment or taking its sunny hand card', t => {
  const f = fixture(t, { count: 4 }); f.play('koffing', 2); f.seed(f.target, 'vulpix'); const sunny = f.supply(f.target, 'event', 'clear'); suppress(f); const judgment = f.judgments('rain')[0]; f.attack(); f.respond();
  assert.equal(f.player(f.target).active.status, 'poison'); assert.equal(f.player(f.target).hand.some(card => card.id === sunny), true); assert.equal(f.room().pendingBattle, null); assert.equal(countCard(f.room(), judgment.id), 1);
});

test('Gas disables Static, Poison Point and Battle Armor receiving offers', t => {
  for (const family of ['pikachu', 'nidoran-m', 'cubone']) {
    const f = fixture(t); f.play('squirtle'); f.seed(f.target, family); f.supply(f.target); suppress(f); f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle, null);
    assert.equal(f.player(f.leader).active.status, null); assert.deepEqual(f.player(f.target).active.reinforcements, []);
  }
});

test('Gas disables Cute Charm and Sand Veil without removing ordinary Dodge', t => {
  for (const family of ['clefairy', 'sandshrew']) {
    const f = fixture(t); f.play('squirtle'); f.seed(f.target, family); f.supply(f.target); suppress(f); f.attack(); assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.room().pendingBattle.canTrait, false);
    const dodge = f.supply(f.target, 'dodge'); f.respond('dodge', { cardId: dodge }); assert.equal(f.player(f.target).active.damage, 0); assert.equal(countCard(f.room(), dodge), 1);
  }
});

test('Gas disables optional active and End traits but leaves legal moves and switch actions available', t => {
  for (const family of ['magnemite', 'bulbasaur', 'psyduck', 'squirtle', 'exeggcute']) {
    const f = fixture(t); f.play(family); suppress(f, f.leader); assert.equal(f.view(f.leader).self.battle.canTrait, false); assert.equal(f.view(f.leader).self.battle.canCommand, true); assert.equal(f.view(f.leader).self.battle.canSwitch, true);
    rejectsAtomically(f, () => f.act(f.leader, 'useTrait', family === 'magnemite' ? { cardIds: [] } : {})); enterEnd(f); assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => f.act(f.leader, 'useTrait'));
  }
});

test('Gas suppresses Pickup gains but does not suppress Helping Hand card gain or held-item damage', t => {
  const f = fixture(t); f.play('clefairy', 3); f.seed(f.target, 'meowth'); suppress(f); const top = f.top('rain', 'clear', 'thunderstorm'); f.attack({ moveIndex: 1 }); f.respond(); assert.deepEqual(f.player(f.target).hand, top.slice(0, 2)); assert.deepEqual(f.room().turn.pickupUsedIds, []);
  const g = fixture(t); g.play('squirtle'); g.seed(g.target, 'cubone'); g.helmet(g.target); suppress(g); g.attack(); g.respond(); g.drain(); assert.equal(g.player(g.target).active.damage, 2); assert.equal(g.player(g.leader).active.damage, 1);
});

test('Gas suppresses source Moxie while Future Sight remains an on-use move effect', t => {
  for (const [family, level] of [['magikarp', 2], ['slowpoke', 3]]) {
    const f = fixture(t); f.play(family, level); suppress(f, f.leader); f.player(f.leader).hand = []; const top = f.room().drawPile.at(-1).id; f.attack(); assert.equal(f.room().pendingBattle.kind, family === 'slowpoke' ? 'foresee' : 'defense'); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(f.room().drawPile.at(-1).id, top); f.drain(); assert.equal(f.player(f.target).active.damage, 2);
  }
});

test('Gas disables Sniper range and Levitate substitutions while ordinary move range remains', t => {
  const f = fixture(t, { count: 6 }); f.play('weedle', 3); suppress(f, f.leader); assert.equal(f.view(f.leader).self.battle.legalTargetIds.length, 3);
  const g = fixture(t); g.play('squirtle'); g.seed(g.target, 'gastly'); suppress(g); const rainy = g.supply(g.target, 'event', 'rain'); g.attack(); rejectsAtomically(g, () => g.respond('dodge', { cardId: rainy })); g.respond(); assert.equal(g.player(g.target).active.damage, 2);
});

test('Gas does not clear burn or paralysis and cannot suppress command weather payment restrictions', t => {
  const f = fixture(t); f.play('machop'); f.player(f.leader).active.status = 'paralysis'; suppress(f, f.leader); const rainy = f.supply(f.leader, 'command', 'rain'); rejectsAtomically(f, () => f.attack({ cardId: rainy }));
  const sunny = f.supply(f.leader); f.attack({ cardId: sunny }); f.drain(); assert.equal(f.player(f.leader).active.status, 'paralysis');
});

test('Battle Armor may trigger on each hit, keeps at most one Defense and cleans it only after the complete card', t => {
  const f = fixture(t); f.play('weedle', 3); f.player(f.leader).active.reinforcements = ['power']; f.seed(f.target, 'cubone', 3);
  const costs = [f.supply(f.target, 'event'), f.supply(f.target, 'event')]; f.top('clear', 'clear', 'rain', 'rain'); f.attack();
  f.respond(); assert.equal(f.player(f.target).active.damage, 2); armor(f, costs[0]); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(f.room().pendingBattle.kind, 'defense');
  f.respond(); assert.equal(f.player(f.target).active.damage, 3); assert.equal(f.room().pendingBattle.kind, 'battle-armor'); armor(f, costs[1]); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']);
  f.respond(); assert.equal(f.player(f.target).active.damage, 4); assert.deepEqual(f.player(f.target).active.reinforcements, []); assert.equal(f.room().pendingBattle, null); for (const id of costs) assert.equal(countCard(f.room(), id), 1);
});

test('Battle Armor after source-free poison or confusion persists because there is no resolving card', t => {
  for (const status of ['poison', 'confusion']) {
    const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'cubone', 2, { status }); const cost = f.supply(f.target, 'event'); start(f, f.target);
    assert.equal(f.room().pendingBattle.kind, 'battle-armor'); armor(f, cost); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.room().pendingBattle, null);
  }
});

test('optional payment traits are not offered without a real own hand card', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'cubone'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle, null);
  const g = fixture(t); g.play('cubone', 3); g.attack(); g.respond(); assert.equal(g.room().pendingBattle, null); assert.equal(g.player(g.target).active.damage, 2);
  const h = fixture(t); h.play('squirtle'); h.seed(h.third, 'koffing'); start(h); assert.equal(h.room().pendingBattle, null); assert.deepEqual(h.room().turn.suppressedTraitPlayerIds, []);
});

test('current Koffing chooses Gas, status and returning exiled cards in its local turn-start order', t => {
  const f = fixture(t); f.play('koffing'); f.player(f.leader).active.status = 'poison'; const returned = f.makeCard('event', 'rain'); f.player(f.leader).exiledCards = [returned]; const cost = f.supply(f.leader, 'dodge'); start(f);
  assert.equal(f.room().pendingBattle.kind, 'turn-start-order'); assert.deepEqual(new Set(f.room().pendingBattle.effects), new Set(['return-cards', 'status', 'neutralizing-gas']));
  f.respond('start-effect', { effect: 'neutralizing-gas' }); assert.equal(f.room().pendingBattle.kind, 'neutralizing-gas'); gas(f, cost, f.leader.playerId);
  assert.equal(f.room().pendingBattle.kind, 'turn-start-order'); assert.deepEqual(new Set(f.room().pendingBattle.effects), new Set(['return-cards', 'status'])); f.respond('start-effect', { effect: 'return-cards' });
  assert.deepEqual(f.player(f.leader).exiledCards, []); assert.equal(f.player(f.leader).hand.some(card => card.id === returned.id), true); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.room().pendingBattle, null); assert.equal(countCard(f.room(), returned.id), 1);
});

test('returning a real exiled card first can supply the current Koffing Gas payment', t => {
  const f = fixture(t); f.play('koffing'); const returned = f.makeCard('event', 'rain'); f.player(f.leader).exiledCards = [returned]; start(f);
  assert.equal(f.room().pendingBattle.kind, 'turn-start-order'); f.respond('start-effect', { effect: 'return-cards' }); assert.equal(f.room().pendingBattle.kind, 'neutralizing-gas');
  assert.deepEqual(f.view(f.leader).pendingBattle.paymentCards, [publicHand(returned)]); gas(f, returned.id, f.target.playerId); assert.equal(countCard(f.room(), returned.id), 1); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(activeView(f, f.target).traitsSuppressed, true);
});

test('choosing Gas first with an empty current Koffing skips its payment opportunity then returns exiled cards exactly once', t => {
  const f = fixture(t); f.play('koffing'); const returned = f.makeCard('dodge', 'thunderstorm'); f.player(f.leader).exiledCards = [returned]; start(f);
  assert.equal(f.room().pendingBattle.kind, 'turn-start-order'); assert.deepEqual(new Set(f.room().pendingBattle.effects), new Set(['return-cards', 'neutralizing-gas'])); assert.equal(f.player(f.leader).hand.length, 0);
  f.respond('start-effect', { effect: 'neutralizing-gas' }); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().turnStart ?? null, null);
  assert.deepEqual(f.room().turn.suppressedTraitPlayerIds, []); assert.deepEqual(f.player(f.leader).hand, [returned]); assert.deepEqual(f.player(f.leader).exiledCards, []); assert.equal(f.room().discardPile.some(card => card.id === returned.id), false); assert.equal(countCard(f.room(), returned.id), 1);
});

test('Gas suppresses Grimer Poison Touch while the already-running poison status still deals its normal damage', t => {
  const f = fixture(t, { count: 4 }); f.play('koffing'); f.player(f.leader).active.status = 'poison'; f.seed(f.third, 'grimer'); const cost = f.supply(f.leader); start(f);
  assert.equal(f.room().pendingBattle.kind, 'turn-start-order'); f.respond('start-effect', { effect: 'neutralizing-gas' }); gas(f, cost, f.third.playerId);
  assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.leader).active.status, 'poison');
});

test('a captured current Koffing instance defeated by its earlier status cannot redirect its queued Gas through the reserve', t => {
  const f = fixture(t); f.play('koffing'); Object.assign(f.player(f.leader).active, { hpBonus: 0, damage: 2, status: 'poison' }); const original = f.player(f.leader).active.instanceId, incoming = f.player(f.leader).reserve.instanceId;
  const kept = f.supply(f.leader, 'event'); f.seed(f.third, 'koffing'); f.supply(f.third); start(f); assert.equal(f.room().pendingBattle.kind, 'turn-start-order'); f.respond('start-effect', { effect: 'status' });
  while (f.room().pendingBattle?.kind === 'rescue') f.respond(); assert.equal(f.player(f.leader).active.instanceId, incoming); assert.equal(f.player(f.leader).reserve.instanceId, original); assert.equal(f.player(f.leader).reserve.defeated, true);
  assert.equal(f.room().pendingBattle.kind, 'neutralizing-gas'); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); assert.equal(f.player(f.leader).hand.some(card => card.id === kept), true); f.respond(); assert.equal(f.room().pendingBattle, null);
});

test('Gas suppresses Arena Trap switching interception and Justified card-giving availability', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'diglett'); suppress(f); f.act(f.leader, 'switchPokemon'); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().turn.switchUsed, true);
  const g = fixture(t); g.play('growlithe'); suppress(g, g.leader); g.supply(g.leader); assert.equal(g.view(g.leader).self.battle.canGive, false); rejectsAtomically(g, () => g.act(g.leader, 'giveCards', { cardIds: ids(g.player(g.leader).hand), recipientId: g.target.playerId, targetIds: [g.target.playerId] }));
});

test('Gas suppresses Rattled so the current Magikarp must complete its ordinary excess-card Discard', t => {
  const f = fixture(t); f.play('magikarp'); suppress(f, f.leader); while (f.player(f.leader).hand.length < 6) f.supply(f.leader, 'event');
  f.act(f.leader, 'finishPlay'); assert.equal(f.room().turn.phase, 'discard'); assert.equal(f.room().turn.discardComplete, false); rejectsAtomically(f, () => f.act(f.leader, 'endTurn', { levelUp: false }));
  while (f.room().turn.phase === 'discard') f.act(f.leader, 'discard', { cardId: f.player(f.leader).hand[0].id }); assert.equal(f.player(f.leader).hand.length, 4); assert.equal(f.room().turn.discardComplete, true);
});
