import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore } from '../server/store.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));
function fixture(t, { turnSeconds = 0, responseSeconds = 0 } = {}) {
  const root = fileURLToPath(new URL('../.data/', import.meta.url));
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'batch3-pokemon-test-'));
  t.after(() => {
    if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path');
    rmSync(dir, { recursive: true, force: true });
  });
  let time = 1_000_000, serial = 0;
  const now = () => time, store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: 2 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code);
  const player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(p => p.playerId === id);
  const view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `batch3-${++serial}`, revision: room().revision, type, ...payload });
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
  // Complete legal setup first; then fix combat identities, levels and deck order.
  const seed = (who, family, level = 1, extra = {}) => Object.assign(player(who).active, {
    instanceId: `active-${who.playerId}`, catalogueId: family, level, damage: 0,
    status: null, reinforcements: [], hpBonus: 0, defeated: false, revealed: true, ...extra,
  });
  for (const who of seats) {
    seed(who, 'squirtle', 3);
    Object.assign(player(who).reserve, { instanceId: `reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 0, defeated: false, revealed: false });
    player(who).hand = [];
  }
  const makeCard = (kind = 'dodge', weather = 'clear') => ({ id: `private-batch3-${++serial}`, kind, weather, fixture: true, name: { zh: `私牌${serial}`, en: `Private batch three card ${serial}` } });
  room().drawPile = Array.from({ length: 24 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind, weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const judgments = (...weather) => { for (const value of [...weather].reverse()) room().drawPile.push(makeCard('judgment-fixture', value)); };
  const target = seats.find(who => who !== leader);
  const play = () => { act(leader, 'draw'); act(leader, 'draw'); };
  const attack = (victim = target) => act(leader, 'attack', { cardId: supply(leader, 'command'), targetIds: [victim.playerId] });
  const respond = (choice = 'pass', payload = {}) => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload }); };
  const rescueAll = () => { while (room().pendingBattle?.kind === 'rescue') respond(); };
  return { store, dir, now, owner, seats, leader, target, room, player, byId, view, input, act, seed, makeCard, supply, judgments, play, attack, respond, rescueAll, advance: ms => { time += ms; } };
}
const judgmentsMade = f => f.room().log.filter(entry => entry.text.en.includes('judgment revealed')).length;
const activeView = (f, who, observer = f.leader) => f.view(observer).players.find(p => p.id === who.playerId).active;
const deckTop = f => [...f.room().drawPile].reverse();

// Reviewed batch-three faces, with an actual command card and ordinary defense.
test('Abra levels 2/3 use printed 2/3 damage and intense-sun confusion preserves existing status', t => {
  for (const level of [2, 3]) for (const [weather, status] of [['intense-sun', null], ['rain', null], ['intense-sun', 'poison']]) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'abra', level); f.seed(f.target, 'squirtle', 3, { status });
    f.judgments(weather); f.attack(); f.respond();
    assert.equal(f.player(f.target).active.damage, level);
    assert.equal(f.player(f.target).active.status, status || (weather === 'intense-sun' ? 'confusion' : null));
    assert.equal(judgmentsMade(f), 1); assert.equal(f.room().pendingBattle, null);
  }
});

test('Synchronize receives the exact causing command once after source effects and retries safely', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'charmander'); f.seed(f.target, 'abra', 3); f.judgments('intense-sun');
  f.attack(); const causing = f.room().resolution.card; f.respond();
  assert.equal(f.player(f.target).active.status, 'burn'); assert.equal(judgmentsMade(f), 1);
  const pending = f.room().pendingBattle;
  assert.equal(pending.kind, 'synchronize'); assert.equal(pending.actorId, f.target.playerId);
  const before = structuredClone(f.room());
  for (const payload of [{ choice: 'dodge' }, { choice: 'trait', cardId: causing.id }, { choice: 'trait', order: [0] }]) {
    assert.throws(() => f.act(f.target, 'respondBattle', { decisionId: pending.id, ...payload })); assert.deepEqual(f.room(), before);
  }
  assert.throws(() => f.act(f.leader, 'respondBattle', { decisionId: pending.id, choice: 'trait' })); assert.deepEqual(f.room(), before);
  const input = f.input('respondBattle', { decisionId: pending.id, choice: 'trait' });
  f.store.action(f.owner.code, f.target.token, input); f.store.action(f.owner.code, f.target.token, input);
  // Store transactions clone room state; equality plus one physical zone verifies exact card identity.
  assert.deepEqual(f.player(f.target).hand.find(card => card.id === causing.id), causing);
  assert.equal(f.player(f.target).hand.filter(card => card.id === causing.id).length, 1);
  assert.equal(f.room().discardPile.some(card => card.id === causing.id), false);
  assert.equal(f.player(f.target).active.damage, 1); assert.equal(judgmentsMade(f), 1); assert.equal(f.room().pendingBattle, null);
});

test('Synchronize can pass or claim an event and ignores dodge, zero damage, poison and confusion without a card', t => {
  for (const choice of ['pass', 'trait']) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'slowpoke'); f.seed(f.target, 'abra', 3); f.attack();
    // Events have no play API in this development deck: seed only their resolution envelope.
    f.room().resolution.kind = 'event'; f.room().resolution.card.kind = 'event'; const causing = structuredClone(f.room().resolution.card);
    f.respond(); assert.equal(f.room().pendingBattle.kind, 'synchronize'); f.respond(choice);
    assert.equal(f.player(f.target).hand.some(card => card.id === causing.id), choice === 'trait');
    assert.equal(f.room().discardPile.filter(card => card.id === causing.id).length, choice === 'pass' ? 1 : 0);
  }
  for (const avoided of ['dodge', 'zero']) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'slowpoke'); f.seed(f.target, 'abra', 3); f.attack();
    if (avoided === 'zero') { f.room().resolution.baseDamage = 0; f.respond(); }
    else f.respond('dodge', { cardId: f.supply(f.target, 'dodge') });
    assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().pendingBattle, null);
  }
  for (const status of ['poison', 'confusion']) {
    const f = fixture(t); f.seed(f.leader, 'abra', 3, { status }); f.store.startTurn(f.room(), f.leader.playerId, 7);
    assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.room().pendingBattle, null);
  }
});

test('a defeated Abra cannot Synchronize on behalf of its incoming reserve', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'abra', 3); f.seed(f.target, 'abra', 1); f.judgments('rain');
  f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'rescue'); f.rescueAll();
  assert.equal(f.player(f.target).active.catalogueId, 'squirtle'); assert.equal(f.player(f.target).reserve.defeated, true);
  assert.equal(f.room().pendingBattle, null);
});

test('Teleport has no printed numeral, self-targets, draws before switching and preserves command/switch limits', t => {
  for (const switchUsed of [false, true]) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'abra', 1, { reinforcements: ['power', 'defense'] }); f.room().turn.switchUsed = switchUsed;
    const outgoing = f.player(f.leader).active.instanceId, incoming = f.player(f.leader).reserve.instanceId;
    const legal = f.view(f.leader).self.battle; assert.equal(legal.move.printedValue, null); assert.deepEqual(legal.legalTargetIds, [f.leader.playerId]);
    const wrong = f.supply(f.leader, 'command'), before = structuredClone(f.room());
    assert.throws(() => f.act(f.leader, 'attack', { cardId: wrong, targetIds: [f.target.playerId] })); assert.deepEqual(f.room(), before);
    const drawId = f.room().drawPile.at(-1).id; f.attack(f.leader);
    assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId);
    assert.equal(f.player(f.leader).active.instanceId, outgoing); f.respond();
    assert.equal(f.player(f.leader).hand.filter(card => card.id === drawId).length, 1);
    assert.equal(f.player(f.leader).active.instanceId, incoming); assert.equal(f.player(f.leader).active.revealed, true);
    assert.deepEqual(f.player(f.leader).reserve.reinforcements, []); assert.equal(f.player(f.leader).reserve.damage, 0);
    assert.equal(f.room().turn.switchUsed, switchUsed); assert.equal(f.room().turn.commandCreatureId, outgoing);
    assert.equal(f.view(f.leader).self.battle.canCommand, false); assert.equal(f.room().pendingBattle, null);
  }
});

test('Teleport respects Dodge and switch blocking, but a fainted reserve permits the draw without a switch', t => {
  const dodge = fixture(t); dodge.play(); dodge.seed(dodge.leader, 'abra'); const beforeDeck = dodge.room().drawPile.length;
  const original = dodge.player(dodge.leader).active.instanceId; dodge.attack(dodge.leader); dodge.respond('dodge', { cardId: dodge.supply(dodge.leader, 'dodge') });
  assert.equal(dodge.room().drawPile.length, beforeDeck); assert.equal(dodge.player(dodge.leader).active.instanceId, original); assert.equal(dodge.room().pendingBattle, null);
  const blocked = fixture(t); blocked.play(); blocked.seed(blocked.leader, 'abra'); blocked.room().turn.switchBlocked = true;
  assert.equal(blocked.view(blocked.leader).self.battle.canCommand, false);
  const cardId = blocked.supply(blocked.leader, 'command'), snapshot = structuredClone(blocked.room());
  assert.throws(() => blocked.act(blocked.leader, 'attack', { cardId, targetIds: [blocked.leader.playerId] })); assert.deepEqual(blocked.room(), snapshot);
  blocked.player(blocked.leader).reserve.defeated = true; blocked.player(blocked.leader).reserve.damage = 99;
  assert.equal(blocked.view(blocked.leader).self.battle.canCommand, true);
  const hand = blocked.player(blocked.leader).hand.length; blocked.attack(blocked.leader); blocked.respond();
  assert.equal(blocked.player(blocked.leader).hand.length, hand + 1); assert.equal(blocked.player(blocked.leader).active.catalogueId, 'abra');
});

test('Slowpoke level 1 has only base 2; level 2 flinches on thunderstorm after positive damage', t => {
  for (const level of [1, 2]) for (const [weather, status] of [['thunderstorm', null], ['rain', null], ['thunderstorm', 'poison']]) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'slowpoke', level); f.seed(f.target, 'squirtle', 3, { status }); f.judgments(weather);
    f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2);
    assert.equal(f.player(f.target).active.status, status || (level === 2 && weather === 'thunderstorm' ? 'flinch' : null));
    assert.equal(judgmentsMade(f), level === 2 ? 1 : 0); assert.equal(f.room().pendingBattle, null);
  }
});

test('Oblivious protects the same active Slowpoke after first outside-turn damage and suppresses later damage judgments', t => {
  for (const level of [1, 2, 3]) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'abra', 2); f.seed(f.target, 'slowpoke', level); f.judgments('rain', 'intense-sun');
    const instanceId = f.player(f.target).active.instanceId;
    assert.equal(activeView(f, f.target).damageProtected, false); f.attack(); f.respond();
    assert.equal(f.player(f.target).active.damage, 2); assert.ok(f.room().turn.damageImmunityIds.includes(instanceId));
    assert.equal(activeView(f, f.target).damageProtected, true); assert.equal(judgmentsMade(f), 1);
    // An explicit fixture grants a second move in this trainer turn, isolating repeated-damage settlement.
    f.room().turn.usedMoves = []; const nextJudgment = f.room().drawPile.at(-1).id; f.attack(); f.respond();
    assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, null);
    assert.equal(judgmentsMade(f), 1); assert.equal(f.room().drawPile.at(-1).id, nextJudgment);
    const priorTurn = f.room().turn; f.store.advanceTurn(f.room()); assert.notEqual(f.room().turn, priorTurn);
    assert.equal(activeView(f, f.target).damageProtected, false);
  }
});

test('Oblivious does not activate on its own turn, own poison/confusion, or a defeated outgoing Slowpoke', t => {
  for (const status of [null, 'poison', 'confusion']) {
    const f = fixture(t); f.seed(f.leader, 'slowpoke', 3, { status });
    if (status) f.store.startTurn(f.room(), f.leader.playerId, 7);
    else { f.play(); f.attack(f.leader); f.respond('pass'); f.respond('pass'); }
    assert.equal(Boolean(f.room().turn.damageImmunityIds?.includes(f.player(f.leader).active.instanceId)), false);
    assert.equal(activeView(f, f.leader).damageProtected, false);
  }
  const f = fixture(t); f.play(); f.seed(f.leader, 'abra', 3); f.seed(f.target, 'slowpoke', 1); f.judgments('rain');
  f.attack(); f.respond(); f.rescueAll();
  assert.equal(f.player(f.target).reserve.defeated, true); assert.equal(activeView(f, f.target).damageProtected, false);
  assert.equal(Boolean(f.room().turn.damageImmunityIds?.includes(f.player(f.target).reserve.instanceId)), false);
});

test('Future Sight is optional before defense; inspecting/reordering does not draw and Dodge still prevents base 2', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'slowpoke', 3); const before = deckTop(f).map(c => c.id), hand = f.player(f.leader).hand.length;
  f.attack(); assert.equal(f.room().pendingBattle.kind, 'foresee'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId);
  assert.equal(f.player(f.target).active.damage, 0); f.respond('trait'); assert.equal(f.room().pendingBattle.kind, 'reorder');
  assert.deepEqual(deckTop(f).map(c => c.id), before); assert.equal(f.player(f.leader).hand.length, hand);
  f.respond('order', { order: [2, 0, 1] }); assert.deepEqual(deckTop(f).slice(0, 3).map(c => c.id), [before[2], before[0], before[1]]);
  assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.room().pendingBattle.actorId, f.target.playerId);
  f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().pendingBattle, null);
  const skip = fixture(t); skip.play(); skip.seed(skip.leader, 'slowpoke', 3); const top = deckTop(skip).map(c => c.id);
  skip.attack(); skip.respond(); assert.equal(skip.room().pendingBattle.kind, 'defense'); assert.deepEqual(deckTop(skip).map(c => c.id), top);
  skip.respond(); assert.equal(skip.player(skip.target).active.damage, 2); assert.equal(judgmentsMade(skip), 0);
});

test('Future Sight exposes indexed names/weather/kinds only to its actor and never public card identities', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'slowpoke', 3); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true });
  const cards = deckTop(f).slice(0, 3); f.attack(); f.respond('trait');
  const actor = f.view(f.leader), target = f.view(f.target), spectator = f.view(observer);
  assert.deepEqual(actor.pendingBattle.cards, cards.map((card, index) => ({ index, name: card.name, weather: card.weather, kind: card.kind })));
  assert.equal(target.pendingBattle.cards, undefined); assert.equal(spectator.pendingBattle.cards, undefined);
  for (const card of cards) for (const view of [actor, target, spectator]) assert.equal(JSON.stringify(view).includes(card.id), false);
  for (const card of cards) for (const view of [target, spectator]) assert.equal(JSON.stringify(view).includes(card.name.en), false);
  for (const view of [actor, target, spectator]) { assert.equal(view.resolution, undefined); assert.equal(view.drawPile, undefined); assert.equal(view.turn.scryCardIds, undefined); }
});

test('Future Sight validates order atomically and an exact retry cannot reorder or damage twice', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'slowpoke', 3); f.attack(); f.respond('trait');
  const pending = f.room().pendingBattle, snapshot = structuredClone(f.room());
  for (const payload of [{ choice: 'pass' }, { choice: 'order' }, { choice: 'order', order: [0, 0, 1] }, { choice: 'order', order: [0, 1] }, { choice: 'order', order: [0, 1, 3] }, { choice: 'order', order: [0, 1, 1.5] }, { choice: 'order', order: [0, 1, 2], cardId: 'forged' }, { choice: 'order', order: ['0', 1, 2] }, { choice: 'order', order: [0, 1, 2], handIndex: 0 }]) {
    assert.throws(() => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...payload })); assert.deepEqual(f.room(), snapshot);
  }
  assert.throws(() => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'order', order: [0, 1, 2] })); assert.deepEqual(f.room(), snapshot);
  const input = f.input('respondBattle', { decisionId: pending.id, choice: 'order', order: [1, 2, 0] });
  f.store.action(f.owner.code, f.leader.token, input); const committed = structuredClone(f.room());
  f.store.action(f.owner.code, f.leader.token, input); assert.deepEqual(f.room(), committed); assert.equal(f.player(f.target).active.damage, 0);
  f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle, null);
});

test('Future Sight handles short/empty decks and reshuffles discard beneath existing top cards without inventing cards', t => {
  for (const [drawCount, discardCount] of [[0, 0], [1, 0], [2, 0], [1, 4], [0, 2]]) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'slowpoke', 3);
    const draw = Array.from({ length: drawCount }, () => f.makeCard()), discarded = Array.from({ length: discardCount }, () => f.makeCard());
    f.room().drawPile = [...draw]; f.room().discardPile = [...discarded]; f.attack(); f.respond('trait');
    const available = drawCount + discardCount;
    assert.equal(f.room().drawPile.length + f.room().discardPile.length, available);
    if (!available) { assert.equal(f.room().pendingBattle.kind, 'defense'); continue; }
    assert.equal(f.room().pendingBattle.kind, 'reorder'); const inspected = f.view(f.leader).pendingBattle.cards;
    assert.equal(inspected.length, Math.min(3, available));
    assert.deepEqual([...f.room().drawPile, ...f.room().discardPile].map(c => c.id).sort(), [...draw, ...discarded].map(c => c.id).sort());
    if (draw.length) assert.equal(deckTop(f)[0].id, draw.at(-1).id);
    const expectedTop = deckTop(f).slice(0, inspected.length).reverse().map(c => c.id);
    f.respond('order', { order: inspected.map(c => c.index).reverse() });
    assert.deepEqual(deckTop(f).slice(0, inspected.length).map(c => c.id), expectedTop);
    assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.room().drawPile.length + f.room().discardPile.length, available);
  }
});

test('Future Sight keeps its private mapping across restart and resumes the selected top order exactly once', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'slowpoke', 3); f.attack(); f.respond('trait');
  const pending = f.view(f.leader).pendingBattle, ids = [...f.room().resolution.scryCardIds];
  const restarted = new RoomStore({ dataDir: f.dir, catalogue, now: f.now });
  const recovered = restarted.view(f.owner.code, f.leader.token).view;
  assert.equal(recovered.pendingBattle.id, pending.id); assert.deepEqual(recovered.pendingBattle.cards, pending.cards);
  assert.deepEqual(restarted.rooms.get(f.owner.code).resolution.scryCardIds, ids);
  const input = { id: 'batch3-reorder-after-restart', revision: recovered.revision, type: 'respondBattle', decisionId: pending.id, choice: 'order', order: [2, 1, 0] };
  restarted.action(f.owner.code, f.leader.token, input); restarted.action(f.owner.code, f.leader.token, input);
  const final = restarted.rooms.get(f.owner.code); assert.deepEqual([...final.drawPile].reverse().slice(0, 3).map(c => c.id), [...ids].reverse());
  assert.equal(final.pendingBattle.kind, 'defense'); assert.equal(final.players.find(p => p.id === f.target.playerId).active.damage, 0);
});

test('Future Sight optional timeout passes but mandatory reorder pauses at zero without choosing', t => {
  const skip = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); skip.play(); skip.seed(skip.leader, 'slowpoke', 3); skip.attack();
  skip.advance(5_000); assert.equal(skip.view(skip.leader).pendingBattle.kind, 'defense'); assert.equal(skip.player(skip.target).active.damage, 0);
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play(); f.seed(f.leader, 'slowpoke', 3); f.attack(); f.respond('trait');
  const pendingId = f.room().pendingBattle.id, top = deckTop(f).map(c => c.id), actionAt = f.room().lastActionAt;
  f.advance(5_000); const expired = f.view(f.leader);
  assert.equal(expired.pendingBattle.id, pendingId); assert.equal(expired.pendingBattle.clock.remainingMs, 0); assert.equal(expired.pendingBattle.clock.deadlineAt, null);
  assert.equal(expired.turn.clock.pausedReason, 'response'); assert.deepEqual(deckTop(f).map(c => c.id), top); assert.equal(expired.lastActionAt, actionAt);
  f.respond('order', { order: [0, 1, 2] }); assert.equal(f.room().pendingBattle.kind, 'defense');
});

test('Future Sight response clocks respect offline presence and closing votes without leaking or auto-ordering', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 60 }); f.play(); f.seed(f.leader, 'slowpoke', 3); f.attack(); f.respond('trait');
  const pendingId = f.room().pendingBattle.id; f.advance(31_000);
  const offline = f.view(f.target); assert.equal(offline.pendingBattle.id, pendingId); assert.equal(offline.pendingBattle.clock.remainingMs, 30_000);
  assert.equal(offline.pendingBattle.clock.pausedReason, 'disconnected'); assert.equal(offline.pendingBattle.cards, undefined);
  f.seats.forEach(who => f.view(who)); f.advance(2_000); const vote = f.act(f.owner, 'requestEndGame');
  assert.equal(vote.pendingBattle.clock.remainingMs, 28_000); assert.equal(vote.pendingBattle.clock.pausedReason, 'vote');
  const before = deckTop(f).map(c => c.id); f.advance(20_000);
  assert.throws(() => f.respond('order', { order: [0, 1, 2] })); assert.deepEqual(deckTop(f).map(c => c.id), before);
  const resumed = f.act(f.seats.find(p => p !== f.owner), 'rejectEnd'); assert.equal(resumed.pendingBattle.id, pendingId); assert.equal(resumed.pendingBattle.clock.remainingMs, 28_000);
  f.respond('order', { order: [0, 1, 2] }); assert.equal(f.room().pendingBattle.kind, 'defense');
});


