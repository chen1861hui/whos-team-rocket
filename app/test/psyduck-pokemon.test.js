import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore, CONNECTED_MS } from '../server/store.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));
function fixture(t, { count = 3, turnSeconds = 0, responseSeconds = 0 } = {}) {
  const root = fileURLToPath(new URL('../.data/', import.meta.url));
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'psyduck-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `psyduck-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates; act(who, 'selectPokemon', { activeId: candidates[0], reserveId: candidates[1] }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-psyduck-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private Psyduck card ${serial}` } });
  room().drawPile = Array.from({ length: 48 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const judgments = (...weather) => { for (const value of [...weather].reverse()) room().drawPile.push(makeCard('judgment-fixture', value)); };
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id), third = seats.find(who => who !== leader && who !== target);
  const play = (family = 'psyduck', level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, family, level); };
  const attack = (payload = {}, who = leader) => act(who, 'attack', { cardId: payload.cardId ?? supply(who), targetIds: [target.playerId], ...payload });
  const respond = (choice = 'pass', payload = {}) => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload }); };
  const drain = () => { for (let i = 0; room().pendingBattle && i < 50; i++) { const pending = room().pendingBattle; respond(pending.kind === 'effects' ? 'effect' : 'pass', pending.kind === 'effects' ? { effect: pending.effects[0] } : {}); } assert.equal(room().pendingBattle, null); };
  const startPoison = (who = target) => { player(who).active.status = 'poison'; store.startTurn(room(), who.playerId, 2); };
  return { store, dir, now, owner, seats, leader, target, third, room, player, byId, view, input, act, seed, makeCard, supply, judgments, play, attack, respond, drain, advance: ms => { time += ms; } };
}
function rejectsAtomically(f, action, code) { const before = structuredClone(f.room()); assert.throws(action, error => code === undefined || error.code === code); assert.deepEqual(f.room(), before); }

const ids = cards => cards.map(card => card.id);
const allCards = room => [...room.drawPile, ...room.discardPile, ...room.players.flatMap(p => [...(p.hand || []), ...(p.exiledCards || []), ...[p.active?.item, p.reserve?.item].filter(Boolean)]), ...[room.resolution, ...(room.resolutionStack || [])].flatMap(r => r?.card && !r.cardClaimedBy ? [r.card] : []), ...(room.judgment?.card ? [room.judgment.card] : [])];
const countCard = (f, id) => allCards(f.room()).filter(card => card.id === id).length;
const disable = (f, payload = {}) => f.attack({ cardId: payload.cardId ?? f.supply(f.leader, 'event', 'rain'), moveIndex: 1, ...payload });
const exile = (f, handIndices = [0]) => f.respond('exile', { handIndices });
function prepareExile(f, { target = f.target, cards = 3 } = {}) {
  f.play('psyduck', 2);
  for (let i = 0; i < cards; i++) f.supply(target, i % 2 ? 'dodge' : 'event', i % 2 ? 'thunderstorm' : 'clear');
  disable(f, { targetIds: [target.playerId] }); f.respond();
  assert.equal(f.room().pendingBattle.kind, 'exile');
  return structuredClone(f.player(target).hand);
}
function held(f, who) { const item = { ...f.makeCard('held-item'), itemType: 'rocky-helmet' }; f.player(who).active.item = item; return item; }
function returnOrder(f, who = f.target, status = 'poison') {
  prepareExile(f, { target: who }); exile(f, [0, 1]); f.player(who).active.status = status;
  f.store.startTurn(f.room(), who.playerId, 7);
  assert.equal(f.room().pendingBattle.kind, 'turn-start-order');
}
const startEffect = (f, effect) => f.respond('start-effect', { effect });

// Legal shared setup precedes explicit seeds so roles and shuffled candidates
// do not determine the printed effects or the identity of a private hand card.
test('Psyduck faces expose reviewed 3/4/4 HP, 1/1/2 command values and indexed Disable', t => {
  const faces = catalogue.entries.find(p => p.id === 'psyduck').levels;
  assert.deepEqual(faces.map(p => p.hp), [3, 4, 4]);
  assert.deepEqual(faces.map(p => p.effectStatus), Array(3).fill('combat-preview'));
  for (const level of [1, 2, 3]) {
    const f = fixture(t); f.play('psyduck', level); const legal = f.view(f.leader).self.battle;
    assert.equal(legal.canCommand, true); assert.equal(legal.move.printedValue, level === 3 ? 2 : 1);
    assert.equal(legal.moves.length, level === 1 ? 1 : 2); assert.equal(legal.canTrait, true);
    if (level > 1) assert.equal(legal.moves[1].canUse, true);
  }
});

test('Bubble removes one reinforcement after positive damage and before Static receiving effects', t => {
  for (const level of [1, 2]) {
    const f = fixture(t); f.play('psyduck', level); f.seed(f.target, 'pikachu', 1, { reinforcements: ['power', 'speed'] }); f.attack();
    assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond(); const pending = f.room().pendingBattle;
    assert.equal(f.player(f.target).active.damage, 1); assert.equal(pending.kind, 'reinforcement'); assert.equal(pending.timing, 'after-damage');
    assert.equal(pending.actorId, f.leader.playerId); assert.equal(pending.targetId, f.target.playerId);
    f.respond('reinforcement', { reinforcement: 'speed' }); assert.deepEqual(f.player(f.target).active.reinforcements, ['power']);
    assert.equal(f.room().pendingBattle.kind, 'static'); f.respond(); assert.equal(f.room().resolution, null);
  }
});

test('Bubble creates no reinforcement choice after Dodge or zero damage', t => {
  for (const level of [1, 2]) for (const prevention of ['dodge', 'immunity']) {
    const f = fixture(t); f.play('psyduck', level); f.player(f.target).active.reinforcements = ['speed'];
    if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId];
    f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {});
    assert.equal(f.player(f.target).active.damage, 0); assert.deepEqual(f.player(f.target).active.reinforcements, ['speed']); assert.equal(f.room().pendingBattle, null);
  }
});

test('Bubble never removes a replacement reserve reinforcement after the original target faints', t => {
  const f = fixture(t); f.play('psyduck'); f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2, reinforcements: ['power'] });
  f.player(f.target).reserve.reinforcements = ['speed']; const incoming = f.player(f.target).reserve.instanceId; f.attack(); f.drain();
  assert.equal(f.player(f.target).active.instanceId, incoming); assert.deepEqual(f.player(f.target).active.reinforcements, ['speed']); assert.equal(f.player(f.target).reserve.defeated, true);
});

test('Water Pulse judges exactly once after damage and confuses on either rainy weather', t => {
  for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) {
    const f = fixture(t); f.play('psyduck', 3); f.judgments(weather); const card = f.room().drawPile.at(-1); f.attack(); f.respond();
    assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, ['rain', 'thunderstorm'].includes(weather) ? 'confusion' : null);
    assert.equal(f.room().discardPile.filter(c => c.id === card.id).length, 1); assert.equal(f.room().pendingBattle, null);
  }
});

test('Water Pulse uses final Drought weather and routes confusion through Poison Touch', t => {
  for (const replace of [false, true]) {
    const f = fixture(t, { count: 4 }); f.play('psyduck', 3); f.seed(f.third, 'vulpix');
    const grimer = f.seats.find(who => who !== f.leader && who !== f.target && who !== f.third); f.seed(grimer, 'grimer');
    const sunny = f.supply(f.third, 'event', 'clear'); f.judgments('rain'); f.attack(); f.respond();
    assert.equal(f.room().pendingBattle.kind, 'judgment'); assert.equal(f.player(f.target).active.status, null);
    f.respond(replace ? 'replace' : 'pass', replace ? { cardId: sunny } : {});
    if (!replace) { assert.equal(f.room().pendingBattle.kind, 'poison-touch'); assert.equal(f.room().pendingBattle.status, 'confusion'); f.respond('trait'); }
    assert.equal(f.player(f.target).active.status, replace ? null : 'poison'); assert.equal(f.room().pendingBattle, null);
  }
});

test('Water Pulse neither judges canceled damage nor applies confusion to a forced reserve', t => {
  for (const scenario of ['dodge', 'immunity', 'faint']) {
    const f = fixture(t); f.play('psyduck', 3); f.judgments('rain'); const top = f.room().drawPile.at(-1).id;
    if (scenario === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId];
    if (scenario === 'faint') f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 });
    const original = f.player(f.target).active.instanceId; f.attack(); f.respond(scenario === 'dodge' ? 'dodge' : 'pass', scenario === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); f.drain();
    if (scenario !== 'faint') assert.equal(f.room().drawPile.at(-1).id, top); assert.equal(f.room().discardPile.filter(c => c.kind === 'judgment-fixture').length, 0); assert.equal(f.player(f.target).active.status, null);
    if (scenario === 'faint') assert.notEqual(f.player(f.target).active.instanceId, original);
  }
});

test('Swift Swim at every level grants trainer card range and only its own Pokemon move range on rain', t => {
  for (const level of [1, 2, 3]) for (const weather of ['clear', 'intense-sun', 'rain', 'thunderstorm']) {
    const f = fixture(t, { count: 6 }); f.play('psyduck', level); const original = f.player(f.leader).active.instanceId;
    const before = f.view(f.leader).self.battle.legalTargetIds; assert.equal(before.length, 3); f.judgments(weather); f.act(f.leader, 'useTrait');
    const success = ['rain', 'thunderstorm'].includes(weather);
    assert.equal(f.room().turn.swiftSwimUsed, true); assert.equal(f.room().turn.cardRangePlayerId, success ? f.leader.playerId : null);
    assert.deepEqual(f.room().turn.swiftSwimCreatureIds, success ? [original] : []);
    assert.equal(f.view(f.leader).self.battle.legalTargetIds.length, success ? 6 : 3); assert.equal(f.view(f.leader).self.battle.canTrait, false);
    rejectsAtomically(f, () => f.act(f.leader, 'useTrait'));
  }
});

test('Swift Swim waits for final Drought replacement before granting either range permission', t => {
  const f = fixture(t, { count: 6 }); f.play('psyduck'); f.seed(f.third, 'vulpix'); const sunny = f.supply(f.third, 'event', 'clear'); f.judgments('rain');
  f.act(f.leader, 'useTrait'); assert.equal(f.room().pendingBattle.kind, 'judgment'); assert.equal(f.room().turn.cardRangePlayerId, null); assert.deepEqual(f.room().turn.swiftSwimCreatureIds, []);
  f.respond('replace', { cardId: sunny }); assert.equal(f.room().turn.cardRangePlayerId, null); assert.deepEqual(f.room().turn.swiftSwimCreatureIds, []); assert.equal(f.room().turn.swiftSwimUsed, true);
});

test('switching retains Swift Swim trainer permission without transferring move range or resetting command locks', t => {
  const f = fixture(t, { count: 6 }); f.play('psyduck', 2); f.player(f.leader).reserve.catalogueId = 'psyduck'; f.player(f.leader).reserve.level = 2; const original = f.player(f.leader).active.instanceId; f.judgments('rain'); f.act(f.leader, 'useTrait'); f.attack(); f.drain();
  const used = structuredClone(f.room().turn.usedMoves); assert.equal(f.room().turn.commandCreatureId, original);
  f.act(f.leader, 'switchPokemon'); assert.equal(f.room().turn.cardRangePlayerId, f.leader.playerId); assert.deepEqual(f.room().turn.swiftSwimCreatureIds, [original]);
  assert.equal(f.view(f.leader).self.battle.legalTargetIds.length, 3); assert.equal(f.view(f.leader).self.battle.canCommand, false); assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => f.act(f.leader, 'useTrait')); assert.deepEqual(f.room().turn.usedMoves, used);
  assert.equal(f.room().turn.commandCreatureId, original); f.store.startTurn(f.room(), f.target.playerId, 8);
  assert.equal(f.room().turn.cardRangePlayerId, null); assert.deepEqual(f.room().turn.swiftSwimCreatureIds, []); assert.equal(f.room().turn.swiftSwimUsed, false);
});

test('Swift Swim is restricted to the active trainer Play phase and never resets an existing command', t => {
  const f = fixture(t); f.play('psyduck', 3); f.attack(); f.drain(); const lock = f.room().turn.commandCreatureId, used = structuredClone(f.room().turn.usedMoves);
  f.judgments('rain'); f.act(f.leader, 'useTrait'); assert.equal(f.room().turn.commandCreatureId, lock); assert.deepEqual(f.room().turn.usedMoves, used); assert.equal(f.view(f.leader).self.battle.canCommand, false);
  rejectsAtomically(f, () => f.act(f.target, 'useTrait')); f.store.startTurn(f.room(), f.leader.playerId, 9); rejectsAtomically(f, () => f.act(f.leader, 'useTrait'));
  f.room().turn.drawRemaining = 0; f.room().turn.phase = 'end'; rejectsAtomically(f, () => f.act(f.leader, 'useTrait'));
});

test('Disable accepts either rainy real hand card of any kind, pays before defense and consumes no Power or command', t => {
  for (const level of [2, 3]) for (const [kind, weather] of [['event', 'rain'], ['dodge', 'thunderstorm'], ['command', 'rain']]) {
    const f = fixture(t); f.play('psyduck', level); f.player(f.leader).active.reinforcements = ['power']; const payment = f.supply(f.leader, kind, weather); f.supply(f.target, 'event');
    disable(f, { cardId: payment }); assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.player(f.leader).hand.some(c => c.id === payment), false); assert.equal(f.room().discardPile.filter(c => c.id === payment).length, 1);
    assert.deepEqual(f.player(f.leader).active.reinforcements, ['power']); assert.equal(f.room().turn.commandCreatureId, null); f.respond(); exile(f, []);
    assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.target).active.status, null); assert.equal(f.view(f.leader).self.battle.canCommand, true); assert.equal(f.view(f.leader).self.battle.moves[1].canUse, false);
  }
});

test('Disable rejects unsupported indices, nonrain weather, foreign and forged payment atomically', t => {
  const f = fixture(t); f.play('psyduck', 2); const sunny = f.supply(f.leader, 'event', 'clear'), foreign = f.supply(f.target, 'event', 'rain'), valid = f.supply(f.leader, 'dodge', 'rain');
  for (const cardId of [sunny, foreign, 'forged']) rejectsAtomically(f, () => disable(f, { cardId }));
  for (const moveIndex of [-1, 2, 1.5, '1', null, false]) rejectsAtomically(f, () => f.attack({ cardId: valid, moveIndex }));
  f.seed(f.leader, 'psyduck', 1); rejectsAtomically(f, () => disable(f, { cardId: valid }));
});

test('Dodge and successful Sand Veil cancel Disable before its exile choice', t => {
  for (const defense of ['dodge', 'sand-veil']) {
    const f = fixture(t); f.play('psyduck', 2); f.supply(f.target, 'event'); if (defense === 'sand-veil') { f.seed(f.target, 'sandshrew'); f.judgments('clear'); }
    const before = structuredClone(f.player(f.target).hand); disable(f); f.respond(defense === 'dodge' ? 'dodge' : 'trait', defense === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {});
    assert.equal(f.room().pendingBattle, null); assert.deepEqual(f.player(f.target).hand, before); assert.equal((f.player(f.target).exiledCards || []).length, 0); assert.equal(f.view(f.leader).self.battle.moves[1].canUse, false);
  }
});

test('Disable and the primary command each remain independently once per move in either order', t => {
  for (const first of ['disable', 'command']) {
    const f = fixture(t); f.play('psyduck', 2); f.supply(f.target, 'event');
    if (first === 'disable') { disable(f); f.respond(); f.respond(); f.attack(); f.drain(); }
    else { f.attack(); f.drain(); disable(f); f.respond(); f.respond(); }
    assert.equal(f.room().turn.usedMoves.length, 2); assert.equal(f.room().turn.commandCreatureId, f.player(f.leader).active.instanceId);
    const primary = f.supply(f.leader), rainy = f.supply(f.leader, 'event', 'rain'); rejectsAtomically(f, () => f.attack({ cardId: primary })); rejectsAtomically(f, () => disable(f, { cardId: rainy }));
  }
});

test('exile optionally moves zero, one or two actual cards to a separate conserved zone', t => {
  for (const indices of [[], [1], [2, 0]]) {
    const f = fixture(t); const cards = prepareExile(f), conserved = ids(allCards(f.room())).sort(), mapping = [...f.room().resolution.handChoiceIds], chosen = indices.map(index => mapping[index]);
    exile(f, indices); assert.deepEqual(ids(allCards(f.room())).sort(), conserved); assert.equal(f.room().pendingBattle, null); assert.deepEqual(ids(f.player(f.target).exiledCards).sort(), chosen.sort());
    assert.deepEqual(ids(f.player(f.target).hand).sort(), ids(cards).filter(id => !chosen.includes(id)).sort());
    for (const card of cards) { assert.equal(countCard(f, card.id), 1); assert.deepEqual(allCards(f.room()).find(c => c.id === card.id), card); }
  }
});

test('exile pass and empty hands settle without removing a card and expose a bounded maximum', t => {
  for (const cards of [0, 1, 4]) {
    const f = fixture(t); f.play('psyduck', 2); for (let i = 0; i < cards; i++) f.supply(f.target, 'event'); const before = structuredClone(f.player(f.target).hand);
    disable(f); f.respond();
    if (cards) { assert.equal(f.view(f.leader).pendingBattle.maxCards, Math.min(2, cards)); f.respond(); }
    assert.deepEqual(f.player(f.target).hand, before); assert.equal((f.player(f.target).exiledCards || []).length, 0); assert.equal(f.room().pendingBattle, null);
  }
});

test('exile indices enforce source authority, private mapping, distinct safe integers and atomic validation', t => {
  const f = fixture(t); prepareExile(f); const decisionId = f.room().pendingBattle.id;
  rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId, choice: 'exile', handIndices: [0] }), 'NOT_YOUR_DECISION');
  rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: 'stale', choice: 'exile', handIndices: [0] }), 'STALE_DECISION');
  for (const handIndices of [[0, 0], [0, 1, 2], [-1], [3], [0.5], ['0'], [null], [Number.MAX_SAFE_INTEGER], null, '0', {}]) rejectsAtomically(f, () => exile(f, handIndices));
  for (const payload of [{ choice: 'exile' }, { choice: 'pass', handIndices: [] }, { choice: 'exile', handIndices: [0], handIndex: 0 }, { choice: 'exile', handIndices: [0], cardId: f.player(f.target).hand[0].id }, { choice: 'exile', handIndices: [0], order: [] }, { choice: 'trait' }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId, ...payload }));
  const id = f.room().resolution.handChoiceIds[0]; f.player(f.target).hand = f.player(f.target).hand.filter(card => card.id !== id); rejectsAtomically(f, () => exile(f, [0]));
});

test('new handIndices payload is rejected by ordinary defense and reinforcement decisions', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.reinforcements = ['speed']; f.attack();
  rejectsAtomically(f, () => f.respond('pass', { handIndices: [] })); f.respond(); assert.equal(f.room().pendingBattle.kind, 'reinforcement');
  rejectsAtomically(f, () => f.respond('reinforcement', { reinforcement: 'speed', handIndices: [0] })); f.respond('reinforcement', { reinforcement: 'speed' });
});

test('exile choices reveal only actor stubs, hide other hand identities and never expose the nonce mapping', t => {
  for (const selfTarget of [false, true]) {
    const f = fixture(t); const target = selfTarget ? f.leader : f.target, cards = prepareExile(f, { target }), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true });
    const actor = f.view(f.leader).pendingBattle, mapping = f.room().resolution.handChoiceIds;
    assert.equal(actor.kind, 'exile'); assert.equal(actor.actorId, f.leader.playerId); assert.equal(actor.targetId, target.playerId); assert.equal(actor.maxCards, 2);
    assert.deepEqual(actor.choices, mapping.map((id, index) => selfTarget ? { index, name: cards.find(c => c.id === id).name, weather: cards.find(c => c.id === id).weather, kind: cards.find(c => c.id === id).kind } : { index }));
    for (const who of [...f.seats, observer]) {
      const view = f.view(who), pending = view.pendingBattle; if (who !== f.leader) assert.equal(pending.choices, undefined);
      assert.equal(pending.handChoiceIds, undefined); assert.equal(view.resolution, undefined); assert.equal(view.turnStart, undefined);
      for (const card of cards) { assert.equal(JSON.stringify(pending).includes(card.id), false); assert.equal(JSON.stringify(pending).includes(card.privateMarker), false); }
    }
    exile(f, [0, 1]); const hiddenIds = ids(f.player(target).exiledCards);
    for (const who of [...f.seats, observer]) {
      const view = f.view(who); assert.equal(view.players.find(p => p.id === target.playerId).exiledCount, 2); assert.equal(view.self.exiledCards, undefined);
      if (who === target) assert.equal(view.self.exiledCount, 2);
      for (const id of hiddenIds) { assert.equal(JSON.stringify(view).includes(id), false); const card = cards.find(c => c.id === id); assert.equal(JSON.stringify(view).includes(card.name.en), false); assert.equal(JSON.stringify(view).includes(card.privateMarker), false); }
    }
  }
});

test('exiled physical cards stay outside hand counts, limits, draws and discard recycling until return', t => {
  const f = fixture(t); const cards = prepareExile(f, { cards: 5 }); const selected = f.room().resolution.handChoiceIds.slice(0, 2); exile(f, [0, 1]);
  assert.equal(f.view(f.target).players.find(p => p.id === f.target.playerId).handCount, 3); assert.equal(f.view(f.target).self.hand.length, 3);
  f.room().drawPile = []; const recyclable = f.makeCard('event'); f.room().discardPile = [recyclable]; f.room().turn.phase = 'draw'; f.room().turn.drawRemaining = 1; f.act(f.leader, 'draw');
  assert.deepEqual(ids(f.player(f.leader).hand), [recyclable.id]); assert.deepEqual(ids(f.player(f.target).exiledCards).sort(), selected.sort());
  f.store.startTurn(f.room(), f.target.playerId, 8); assert.deepEqual(ids(f.player(f.target).hand).sort(), ids(cards).sort()); assert.deepEqual(f.player(f.target).exiledCards, []);
  assert.equal(f.room().turn.drawRemaining, 2); assert.equal(f.room().turn.phase, 'draw'); assert.equal(f.room().pendingBattle, null);
  for (const id of selected) assert.equal(countCard(f, id), 1);
});

test('self-target Disable keeps its chosen cards exiled through the current turn and returns before next draws', t => {
  const f = fixture(t); const cards = prepareExile(f, { target: f.leader, cards: 5 }); const selected = f.room().resolution.handChoiceIds.slice(0, 2); exile(f, [0, 1]);
  f.act(f.leader, 'finishPlay'); assert.equal(f.room().turn.phase, 'end'); f.act(f.leader, 'endTurn', { levelUp: false }); assert.deepEqual(ids(f.player(f.leader).exiledCards).sort(), selected.sort());
  f.store.startTurn(f.room(), f.leader.playerId, 9); assert.deepEqual(ids(f.player(f.leader).hand).sort(), ids(cards).sort()); assert.deepEqual(f.player(f.leader).exiledCards, []);
  const top = f.room().drawPile.at(-1).id; f.act(f.leader, 'draw'); assert.equal(f.player(f.leader).hand.filter(c => c.id === top).length, 1); assert.equal(f.player(f.leader).hand.length, cards.length + 1);
});

test('each turn-start status shares a mandatory owner choice with returning exiled cards in either order', t => {
  for (const status of ['flinch', 'sleep', 'confusion', 'poison']) for (const first of ['return-cards', 'status']) {
    const f = fixture(t); returnOrder(f, f.target, status); const pending = f.room().pendingBattle;
    assert.equal(pending.actorId, f.target.playerId); assert.deepEqual(new Set(pending.effects), new Set(['return-cards', 'status']));
    assert.equal(f.room().turnStart.playerId, f.target.playerId); assert.equal(f.room().turnStart.pokemonId, f.player(f.target).active.instanceId); assert.deepEqual(new Set(f.room().turnStart.remaining), new Set(['return-cards', 'status']));
    const cards = [...f.player(f.target).exiledCards]; assert.equal(cards.length, 2); startEffect(f, first); f.drain();
    assert.deepEqual(f.player(f.target).exiledCards, []); for (const card of cards) assert.deepEqual(f.player(f.target).hand.find(c => c.id === card.id), card);
    assert.equal(f.room().turnStart ?? null, null); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().turn.drawRemaining, status === 'flinch' ? 1 : 2);
  }
});

test('turn-start status chosen first removes its queue entry before Poison Touch and resumes the return exactly once', t => {
  const f = fixture(t); returnOrder(f); f.seed(f.third, 'grimer'); const selected = ids(f.player(f.target).exiledCards); startEffect(f, 'status');
  assert.equal(f.room().pendingBattle.kind, 'poison-touch'); assert.deepEqual(f.room().turnStart.remaining, ['return-cards']); assert.equal(f.player(f.target).hand.length, 1);
  f.respond('trait'); assert.equal(f.player(f.target).active.damage, 2); assert.deepEqual(f.player(f.target).exiledCards, []); assert.equal(f.player(f.target).hand.length, 3);
  for (const id of selected) assert.equal(f.player(f.target).hand.filter(c => c.id === id).length, 1); assert.equal(f.room().turnStart ?? null, null); assert.equal(f.room().resolution, null);
});

test('queued return resumes after nested Scales, Helmet and rescue continuations without duplicating cards', t => {
  for (const scenario of ['scales', 'helmet-rescue']) {
    const f = fixture(t); returnOrder(f, f.target, scenario === 'scales' ? 'poison' : 'confusion');
    if (scenario === 'scales') { f.seed(f.target, 'dratini', 2, { status: 'poison' }); f.seed(f.third, 'grimer'); }
    else { f.seed(f.target, 'mankey', 1, { status: 'confusion', hpBonus: 0 }); held(f, f.target); }
    const selected = ids(f.player(f.target).exiledCards); startEffect(f, 'status');
    if (scenario === 'scales') { assert.equal(f.room().pendingBattle.kind, 'poison-touch'); f.respond('trait'); assert.equal(f.room().pendingBattle.kind, 'scales'); f.respond('trait'); }
    else { assert.equal(f.room().pendingBattle.kind, 'rescue'); f.drain(); }
    assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null); assert.equal(f.room().turnStart ?? null, null); assert.deepEqual(f.player(f.target).exiledCards, []);
    for (const id of selected) { assert.equal(countCard(f, id), 1); assert.equal(f.player(f.target).hand.filter(c => c.id === id).length, 1); }
  }
});

test('elimination retains unreturned exiles, while a queued return after nonwinning elimination becomes ordinary discard', t => {
  for (const atTurnStart of [false, true]) {
    const f = fixture(t, { count: 4 }); prepareExile(f); exile(f, [0, 1]); const cards = structuredClone(f.player(f.target).exiledCards);
    f.player(f.target).role = 'gym'; f.player(f.third).role = 'rocket'; f.player(f.seats.find(who => who !== f.leader && who !== f.target && who !== f.third)).role = 'challenger';
    f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2, status: atTurnStart ? 'poison' : null }); f.player(f.target).reserve.defeated = true;
    if (atTurnStart) { f.store.startTurn(f.room(), f.target.playerId, 8); startEffect(f, 'status'); }
    else f.attack();
    f.drain(); assert.equal(f.player(f.target).eliminated, true); assert.equal(f.room().status, 'playing');
    assert.deepEqual(f.player(f.target).exiledCards, atTurnStart ? [] : cards);
    for (const card of cards) { assert.equal(countCard(f, card.id), 1); assert.equal(f.room().discardPile.some(c => c.id === card.id), atTurnStart); }
  }
});

test('immediate victory stops queued returns and keeps exile faces hidden until rematch cleanup', t => {
  const f = fixture(t); prepareExile(f, { target: f.leader }); exile(f, [0, 1]); const cards = structuredClone(f.player(f.leader).exiledCards);
  f.seed(f.leader, 'charmander', 1, { hpBonus: 0, damage: 2, status: 'poison' }); f.player(f.leader).reserve.defeated = true; f.store.startTurn(f.room(), f.leader.playerId, 8); startEffect(f, 'status'); f.drain();
  assert.equal(f.room().status, 'finished'); assert.equal(f.room().turnStart ?? null, null); assert.deepEqual(f.player(f.leader).exiledCards, cards);
  for (const who of f.seats) { const json = JSON.stringify(f.view(who)); for (const card of cards) { assert.equal(json.includes(card.id), false); assert.equal(json.includes(card.name.en), false); } }
  f.act(f.owner, 'returnToLobby'); assert.ok(f.room().players.every(p => !(p.exiledCards || []).length)); assert.equal(f.room().turnStart ?? null, null);
  f.seats.forEach(who => f.act(who, 'ready', { ready: true })); f.act(f.owner, 'startBattlePreview'); assert.ok(f.room().players.every(p => !(p.exiledCards || []).length));
});

test('saved Bubble, exile and turn-start continuations survive restart and exact retries commit once', t => {
  for (const kind of ['reinforcement', 'exile', 'turn-start-order', 'queued-poison']) {
    const f = fixture(t);
    if (kind === 'reinforcement') { f.play(); f.player(f.target).active.reinforcements = ['speed']; f.attack(); f.respond(); }
    else if (kind === 'exile') prepareExile(f);
    else { returnOrder(f); if (kind === 'queued-poison') { f.seed(f.third, 'grimer'); startEffect(f, 'status'); } }
    f.store.persist(f.room()); const pending = structuredClone(f.room().pendingBattle), actor = f.byId(pending.actorId), saved = structuredClone(f.room().turnStart);
    const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), recovered = restored.view(f.owner.code, actor.token).view;
    assert.equal(recovered.pendingBattle.id, pending.id); assert.deepEqual(restored.rooms.get(f.owner.code).turnStart, saved);
    const request = { id: `restored-psyduck-${kind}`, revision: recovered.revision, type: 'respondBattle', decisionId: pending.id, ...(kind === 'reinforcement' ? { choice: 'reinforcement', reinforcement: 'speed' } : kind === 'exile' ? { choice: 'exile', handIndices: [0, 1] } : kind === 'queued-poison' ? { choice: 'trait' } : { choice: 'start-effect', effect: 'status' }) };
    restored.action(f.owner.code, actor.token, request); const committed = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, actor.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), committed);
    const p = committed.players.find(p => p.id === f.target.playerId); assert.equal(p.exiledCards.length, kind === 'exile' ? 2 : 0); assert.equal(p.hand.length, kind === 'exile' ? 1 : kind === 'reinforcement' ? 0 : 3);
    if (kind === 'reinforcement') { assert.equal(p.active.damage, 1); assert.deepEqual(p.active.reinforcements, []); }
    if (kind === 'queued-poison') { assert.equal(p.active.damage, 2); assert.equal(committed.turnStart ?? null, null); }
  }
});

test('mandatory Bubble and turn-start choices wait on expiry while optional exile expires as pass without spending turn time', t => {
  for (const kind of ['reinforcement', 'exile', 'turn-start-order']) {
    const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 });
    if (kind === 'reinforcement') { f.play(); f.player(f.target).active.reinforcements = ['speed']; f.attack(); f.respond(); }
    else if (kind === 'exile') prepareExile(f); else returnOrder(f);
    const pending = structuredClone(f.room().pendingBattle); if (kind !== 'exile') rejectsAtomically(f, () => f.respond()); f.advance(2_000); f.act(f.owner, 'requestEndGame'); f.advance(8_000);
    assert.equal(f.view(f.byId(pending.actorId)).pendingBattle.clock.remainingMs, 3_000); rejectsAtomically(f, () => f.respond(), 'VOTE_PENDING');
    f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); f.advance(3_000); const view = f.view(f.byId(pending.actorId));
    if (kind === 'exile') { assert.equal(view.pendingBattle, null); assert.equal(f.player(f.target).hand.length, 3); assert.deepEqual(f.player(f.target).exiledCards, []); }
    else { assert.equal(view.pendingBattle.id, pending.id); assert.equal(view.pendingBattle.clock.pausedReason, 'mandatory'); assert.equal(view.pendingBattle.clock.remainingMs, 0); }
    assert.equal(view.turn.clock.remainingMs, 60_000);
  }
});

test('turn-start order validates authority and effects atomically and pauses on disconnect without exposing its private queue', t => {
  const f = fixture(t, { responseSeconds: 60 }); returnOrder(f); const decisionId = f.room().pendingBattle.id;
  rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId, choice: 'start-effect', effect: 'status' }), 'NOT_YOUR_DECISION');
  for (const payload of [{ choice: 'pass' }, { choice: 'start-effect' }, { choice: 'start-effect', effect: 'poison' }, { choice: 'start-effect', effect: 'status', handIndices: [] }, { choice: 'start-effect', effect: 'status', cardId: 'forged' }]) rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId, ...payload }));
  for (const who of f.seats) { const view = f.view(who); assert.equal(view.turnStart, undefined); assert.equal(view.pendingBattle.remaining, undefined); assert.equal(view.pendingBattle.pokemonId, undefined); assert.equal(JSON.stringify(view.pendingBattle).includes(f.player(f.target).active.instanceId), false); }
  f.advance(CONNECTED_MS + 1_000); const paused = f.view(f.leader).pendingBattle; assert.equal(paused.clock.pausedReason, 'disconnected'); f.advance(5_000); assert.equal(f.view(f.leader).pendingBattle.clock.remainingMs, paused.clock.remainingMs);
  f.seats.forEach(who => f.view(who)); f.act(f.owner, 'requestEndGame'); for (const who of f.seats.filter(who => who !== f.owner)) f.act(who, 'approveEnd'); assert.equal(f.room().status, 'lobby'); assert.equal(f.room().turnStart ?? null, null); assert.ok(f.room().players.every(p => !(p.exiledCards || []).length));
});






