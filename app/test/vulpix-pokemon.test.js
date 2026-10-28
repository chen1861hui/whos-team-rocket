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
  const dir = mkdtempSync(join(root, 'vulpix-test-'));
  t.after(() => {
    if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path');
    rmSync(dir, { recursive: true, force: true });
  });
  let serial = 0, time = 1_000_000;
  const now = () => time;
  const store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code);
  const player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id);
  const view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `vulpix-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true }));
  act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) {
    for (let i = 0; i < 5; i++) act(who, 'drawPokemon');
    const candidates = view(who).self.candidates;
    act(who, 'selectPokemon', { activeId: candidates[0], reserveId: candidates[1] });
  }
  // Legal shared-deck setup precedes explicit isolated combat scenarios. Some
  // ordering tests deliberately seed duplicate Vulpix to exercise the responder queue.
  const seed = (who, family = 'vulpix', level = 2, extra = {}) => Object.assign(player(who).active, {
    instanceId: `active-${who.playerId}`, catalogueId: family, level, damage: 0,
    status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra,
  });
  for (const who of seats) {
    seed(who, 'squirtle', 3);
    Object.assign(player(who).reserve, { instanceId: `reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false });
    player(who).hand = [];
  }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-vulpix-${++serial}`, kind, weather, fixture: true, name: { zh: `私牌${serial}`, en: `Private Vulpix card ${serial}` }, privateMarker: `secret-${serial}` });
  room().drawPile = Array.from({ length: 40 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'dodge', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const judgments = (...weather) => { for (const value of [...weather].reverse()) room().drawPile.push(makeCard('judgment-fixture', value)); };
  const target = seats.find(who => who !== leader);
  const third = seats.find(who => who !== leader && who !== target);
  const play = (family = 'vulpix', level = 2) => { act(leader, 'draw'); act(leader, 'draw'); player(leader).hand = []; seed(leader, family, level); };
  const attack = (payload = {}) => act(leader, 'attack', { cardId: payload.cardId ?? supply(leader, 'command'), targetIds: [target.playerId], ...payload });
  const wisp = (payload = {}) => attack({ cardId: payload.cardId ?? supply(leader, 'event', 'clear'), moveIndex: 1, ...payload });
  const respond = (choice = 'pass', payload = {}) => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload }); };
  const passJudgments = () => { let count = 0; while (room().pendingBattle?.kind === 'judgment') { assert.ok(count++ < seats.length + 1, 'Drought must terminate after one response per actor'); respond(); } return count; };
  return { store, dir, now, owner, seats, leader, target, third, room, player, byId, view, input, act, seed, makeCard, supply, judgments, play, attack, wisp, respond, passJudgments, advance: ms => { time += ms; } };
}
const ids = cards => cards.map(card => card.id);
const rejectsAtomically = (f, action, code) => {
  const before = structuredClone(f.room());
  assert.throws(action, error => code === undefined || error.code === code);
  assert.deepEqual(f.room(), before);
};
const publicCard = card => ({ name: card.name, weather: card.weather, kind: card.kind });
const allCards = f => [...f.room().drawPile, ...f.room().discardPile, ...f.room().players.flatMap(p => p.hand || []), ...(f.room().resolution?.card ? [f.room().resolution.card] : []), ...(f.room().judgment?.card ? [f.room().judgment.card] : [])];

test('all Vulpix faces execute their printed primary move and expose indexed move choices with legacy fields', t => {
  const faces = catalogue.entries.find(entry => entry.id === 'vulpix').levels;
  assert.deepEqual(faces.map(face => face.effectStatus), ['combat-preview', 'combat-preview', 'combat-preview']);
  for (const level of [1, 2, 3]) {
    const f = fixture(t); f.play('vulpix', level);
    const legal = f.view(f.leader).self.battle;
    assert.equal(legal.canCommand, true); assert.equal(legal.move.printedValue, level === 3 ? 2 : 1);
    assert.equal(legal.moves.length, level === 1 ? 1 : 2);
    for (const [index, move] of legal.moves.entries()) {
      assert.equal(move.index, index); assert.ok(move.name.zh); assert.ok(move.condition);
      assert.equal(move.canUse, true); assert.equal(move.maxTargets, 1);
      assert.deepEqual(move.legalTargetIds, legal.legalTargetIds);
    }
    assert.equal(legal.moves[0].printedValue, legal.move.printedValue);
    if (level > 1) assert.equal(legal.moves[1].printedValue, null);
    f.judgments('intense-sun'); f.attack(); f.respond();
    assert.equal(f.player(f.target).active.status, null);
    assert.equal(f.room().pendingBattle.kind, 'judgment'); f.passJudgments();
    assert.equal(f.player(f.target).active.damage, level === 3 ? 2 : 1);
    assert.equal(f.player(f.target).active.status, 'burn');
  }
});

test('omitted moveIndex and explicit zero both select the primary command', t => {
  for (const explicit of [false, true]) {
    const f = fixture(t); f.play(); f.judgments('rain');
    f.attack(explicit ? { moveIndex: 0 } : {}); f.respond(); f.passJudgments();
    assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.player(f.target).active.status, null);
    assert.equal(f.room().turn.commandCreatureId, f.player(f.leader).active.instanceId);
  }
});

test('malformed, negative, out-of-range and unsupported move indices reject before any payment', t => {
  const f = fixture(t); f.play(); const cardId = f.supply(f.leader, 'command');
  for (const moveIndex of [-1, 2, 1.5, '1', null, false, {}, [], Number.MAX_SAFE_INTEGER]) {
    rejectsAtomically(f, () => f.act(f.leader, 'attack', { cardId, moveIndex, targetIds: [f.target.playerId] }));
  }
  f.seed(f.leader, 'vulpix', 1);
  rejectsAtomically(f, () => f.act(f.leader, 'attack', { cardId, moveIndex: 1, targetIds: [f.target.playerId] }));
  f.seed(f.leader, 'squirtle', 3);
  rejectsAtomically(f, () => f.act(f.leader, 'attack', { cardId, moveIndex: 1, targetIds: [f.target.playerId] }));
});

test('Will-O-Wisp discards exactly one sunny card of any kind before defense', t => {
  for (const [kind, weather] of [['command', 'intense-sun'], ['dodge', 'clear'], ['event', 'clear']]) {
    const f = fixture(t); f.play(); const cardId = f.supply(f.leader, kind, weather), retained = f.supply(f.leader, 'event', 'rain');
    const paid = structuredClone(f.player(f.leader).hand.find(card => card.id === cardId));
    f.act(f.leader, 'attack', { cardId, moveIndex: 1, targetIds: [f.target.playerId] });
    assert.equal(f.room().pendingBattle.kind, 'defense'); assert.deepEqual(f.room().discardPile, [paid]);
    assert.deepEqual(ids(f.player(f.leader).hand), [retained]); assert.equal(f.player(f.target).active.damage, 0);
    assert.equal(f.room().turn.commandCreatureId, null);
  }
});

test('sunny payment rejects foreign, missing and nonsunny cards and extra request fields atomically', t => {
  const f = fixture(t); f.play();
  const own = f.supply(f.leader, 'event', 'clear'), foreign = f.supply(f.target, 'event', 'clear');
  const invalid = [foreign, 'missing', null, f.supply(f.leader, 'command', 'rain'), f.supply(f.leader, 'dodge', 'thunderstorm')];
  for (const cardId of invalid) rejectsAtomically(f, () => f.act(f.leader, 'attack', { cardId, moveIndex: 1, targetIds: [f.target.playerId] }));
  for (const extra of [{ weather: 'clear' }, { cardIds: [own] }, { printedValue: 0 }, { damage: 1 }]) {
    rejectsAtomically(f, () => f.act(f.leader, 'attack', { cardId: own, moveIndex: 1, targetIds: [f.target.playerId], ...extra }));
  }
});

test('Dodge cancels Will-O-Wisp before judgment and leaves its sunny cost discarded', t => {
  const f = fixture(t); f.play(); f.judgments('intense-sun'); const top = f.room().drawPile.at(-1).id;
  const cost = f.supply(f.leader, 'event', 'clear'); f.wisp({ cardId: cost });
  const dodge = f.supply(f.target, 'dodge'); f.respond('dodge', { cardId: dodge });
  assert.equal(f.room().pendingBattle, null); assert.equal(f.room().judgment ?? null, null);
  assert.equal(f.room().drawPile.at(-1).id, top); assert.deepEqual(ids(f.room().discardPile), [cost, dodge]);
  assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.target).active.status, null);
});

test('Will-O-Wisp has no damage, Power consumption, defense consumption or after-damage abilities', t => {
  for (const family of ['pikachu', 'abra', 'slowpoke']) {
    const f = fixture(t); f.play(); f.seed(f.target, family, 3, { reinforcements: ['defense'] });
    f.player(f.leader).active.reinforcements = ['power']; f.judgments('clear'); f.wisp(); f.respond(); f.passJudgments();
    assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.target).active.status, 'burn');
    assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']);
    assert.deepEqual(f.player(f.leader).active.reinforcements, ['power']);
    assert.equal(f.room().turn.commandCreatureId, null); assert.deepEqual(f.room().turn.damageImmunityIds, []);
    assert.equal(f.room().pendingBattle, null);
  }
});

test('Will-O-Wisp burns except on heavy rain and preserves an existing status', t => {
  for (const [weather, initial, expected] of [['rain', null, null], ['thunderstorm', null, 'burn'], ['clear', 'poison', 'poison']]) {
    const f = fixture(t); f.play(); f.player(f.target).active.status = initial;
    f.judgments(weather); f.wisp(); f.respond();
    assert.equal(f.player(f.target).active.status, initial); f.passJudgments();
    assert.equal(f.player(f.target).active.status, expected); assert.equal(f.player(f.target).active.damage, 0);
  }
});

test('primary and secondary moves have independent once-per-instance locks in either order', t => {
  for (const first of [0, 1]) {
    const f = fixture(t); f.play(); f.judgments('rain', 'rain');
    const use = index => index ? f.wisp() : f.attack({ moveIndex: 0 });
    use(first); f.respond(); f.passJudgments();
    assert.equal(f.view(f.leader).self.battle.moves[first].canUse, false);
    assert.equal(f.view(f.leader).self.battle.moves[1 - first].canUse, true);
    use(1 - first); f.respond(); f.passJudgments();
    assert.equal(f.room().turn.usedMoves.length, 2);
    const held = f.supply(f.leader, 'command');
    for (const moveIndex of [0, 1]) rejectsAtomically(f, () => f.act(f.leader, 'attack', { cardId: held, moveIndex, targetIds: [f.target.playerId] }));
  }
});

test('another instance command lock permits Vulpix sunny move after switching but still blocks its command', t => {
  const f = fixture(t); f.play('squirtle', 3);
  Object.assign(f.player(f.leader).reserve, { catalogueId: 'vulpix', level: 2 });
  f.attack(); f.respond(); const commandId = f.room().turn.commandCreatureId;
  f.act(f.leader, 'switchPokemon'); const legal = f.view(f.leader).self.battle;
  assert.equal(legal.canCommand, false); assert.equal(legal.moves[1].canUse, true);
  f.judgments('rain'); f.wisp(); f.respond(); f.passJudgments();
  assert.equal(f.room().turn.commandCreatureId, commandId); assert.equal(f.room().turn.usedMoves.length, 2);
});

test('sunny move obeys target range, one target and ordinary turn/move restrictions', t => {
  const f = fixture(t, { count: 6 }); f.play(); const cardId = f.supply(f.leader, 'event', 'clear');
  const legal = f.view(f.leader).self.battle.moves[1]; const far = f.seats.find(who => !legal.legalTargetIds.includes(who.playerId));
  assert.ok(far);
  for (const targetIds of [[], [far.playerId], [f.target.playerId, f.target.playerId], [f.target.playerId, f.third.playerId], ['missing'], f.target.playerId]) {
    rejectsAtomically(f, () => f.act(f.leader, 'attack', { cardId, moveIndex: 1, targetIds }));
  }
  const payload = { cardId, moveIndex: 1, targetIds: [f.target.playerId] };
  rejectsAtomically(f, () => f.act(f.target, 'attack', payload), 'NOT_YOUR_TURN');
  for (const restriction of ['movesBlocked', 'blockedMoveIds']) {
    f.room().turn[restriction] = restriction === 'movesBlocked' ? true : [f.player(f.leader).active.instanceId];
    assert.equal(f.view(f.leader).self.battle.moves[1].canUse, false);
    rejectsAtomically(f, () => f.act(f.leader, 'attack', payload));
    f.room().turn[restriction] = restriction === 'movesBlocked' ? false : [];
  }
  f.room().turn.phase = 'end'; rejectsAtomically(f, () => f.act(f.leader, 'attack', payload));
});

test('Drought exchanges the actual revealed card with one sunny hand card and conserves every card', t => {
  const f = fixture(t); f.play(); f.judgments('rain');
  const original = structuredClone(f.room().drawPile.at(-1)), replacementId = f.supply(f.leader, 'event', 'clear');
  const replacement = structuredClone(f.player(f.leader).hand.find(card => card.id === replacementId));
  f.wisp(); const before = allCards(f).length; f.respond();
  assert.equal(f.room().pendingBattle.kind, 'judgment');
  assert.deepEqual(f.room().judgment.card, original); assert.ok(f.room().judgment.continuation);
  assert.equal(f.room().judgment.index, 0); assert.deepEqual(f.room().judgment.actorIds, [f.leader.playerId]);
  assert.equal(f.room().drawPile.some(card => card.id === original.id), false);
  assert.equal(f.room().discardPile.some(card => card.id === original.id), false);
  assert.equal(allCards(f).length, before); f.respond('replace', { cardId: replacementId });
  assert.deepEqual(f.player(f.leader).hand.find(card => card.id === original.id), original);
  assert.deepEqual(f.room().discardPile.find(card => card.id === replacementId), replacement);
  assert.equal(f.room().judgment ?? null, null); assert.equal(f.room().pendingBattle, null);
  assert.equal(f.player(f.target).active.status, 'burn'); assert.equal(allCards(f).length, before);
  assert.equal(new Set(ids(allCards(f))).size, before);
});

test('multiple Drought actors each respond once in seat order starting at the current turn', t => {
  const f = fixture(t); f.play();
  const ordered = f.room().players.filter(p => !p.spectator).map(p => f.byId(p.id));
  for (const who of ordered) { f.seed(who); f.supply(who, 'event', 'clear'); }
  const actor = ordered[1]; f.store.startTurn(f.room(), actor.playerId, 8);
  f.act(actor, 'draw'); f.act(actor, 'draw'); f.judgments('rain');
  const original = f.room().drawPile.at(-1).id;
  f.act(actor, 'attack', { cardId: f.supply(actor, 'event', 'clear'), moveIndex: 1, targetIds: [ordered[2].playerId] });
  f.respond(); const expected = [ordered[1], ordered[2], ordered[0]].map(who => who.playerId), actual = [];
  let previous = original;
  for (const actorId of expected) {
    actual.push(f.room().pendingBattle.actorId); assert.equal(actual.at(-1), actorId);
    const who = f.byId(actorId), replacementId = f.player(who).hand.find(card => card.weather === 'clear').id;
    f.respond('replace', { cardId: replacementId });
    assert.ok(f.player(who).hand.some(card => card.id === previous)); previous = replacementId;
  }
  assert.deepEqual(actual, expected); assert.equal(f.room().pendingBattle, null);
  assert.ok(f.room().discardPile.some(card => card.id === previous));
});

test('Drought excludes reserve, defeated and eliminated Vulpix', t => {
  for (const excluded of ['reserve', 'defeated', 'eliminated']) {
    const f = fixture(t); f.play('charmander', 1);
    if (excluded === 'reserve') f.player(f.third).reserve.catalogueId = 'vulpix';
    else { f.seed(f.third); if (excluded === 'defeated') f.player(f.third).active.defeated = true; else f.player(f.third).eliminated = true; }
    f.judgments('intense-sun'); f.attack(); f.respond();
    assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.target).active.status, 'burn');
  }
});

test('Drought offers pass even with no sunny card and exposes only the acting trainer replacement cards', t => {
  const f = fixture(t); f.play('charmander', 1); f.seed(f.third);
  const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true });
  f.supply(f.third, 'event', 'rain'); f.judgments('intense-sun'); const original = f.room().drawPile.at(-1);
  f.attack(); f.respond();
  const actorView = f.view(f.third); assert.deepEqual(actorView.pendingBattle.replacementCards, []);
  assert.deepEqual(actorView.pendingBattle.judgmentCard, publicCard(original));
  const sunnyId = f.supply(f.third, 'dodge', 'clear'), sunny = f.player(f.third).hand.find(card => card.id === sunnyId);
  assert.deepEqual(f.view(f.third).pendingBattle.replacementCards, [{ id: sunny.id, ...publicCard(sunny) }]);
  for (const who of [f.leader, f.target, observer]) {
    const visible = f.view(who); assert.equal(visible.pendingBattle.replacementCards, undefined);
    assert.deepEqual(visible.pendingBattle.judgmentCard, publicCard(original));
    const json = JSON.stringify(visible);
    assert.equal(json.includes(original.id), false); assert.equal(json.includes(original.privateMarker), false);
    assert.equal(json.includes(sunnyId), false); assert.equal(json.includes(sunny.privateMarker), false);
    assert.equal(visible.judgment, undefined); assert.equal(visible.resolution, undefined);
  }
  f.respond(); assert.equal(f.player(f.target).active.status, 'burn');
});

test('Drought invalid authority, weather, extra fields and stale decisions are atomic', t => {
  const f = fixture(t); f.play(); const sunny = f.supply(f.leader, 'event', 'clear'), rain = f.supply(f.leader, 'command', 'rain'), foreign = f.supply(f.target, 'event', 'clear');
  f.judgments('rain'); f.wisp(); f.respond(); const decisionId = f.room().pendingBattle.id;
  for (const payload of [{ choice: 'replace', cardId: rain }, { choice: 'replace', cardId: foreign }, { choice: 'replace', cardId: 'missing' }, { choice: 'replace' }, { choice: 'pass', cardId: sunny }, { choice: 'trait' }, { choice: 'replace', cardId: sunny, weather: 'clear' }, { choice: 'replace', cardId: sunny, handIndex: 0 }, { choice: 'replace', cardId: sunny, order: [] }, { choice: 'replace', cardId: sunny, reinforcement: 'power' }]) {
    rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId, ...payload }));
  }
  rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId, choice: 'replace', cardId: foreign }), 'NOT_YOUR_DECISION');
  rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: 'stale', choice: 'pass' }), 'STALE_DECISION');
  rejectsAtomically(f, () => f.act(f.leader, 'finishPlay'), 'RESPONSE_PENDING');
  f.respond(); rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId, choice: 'pass' }), 'STALE_DECISION');
});

test('an exact Drought retry exchanges once and does not resolve the continuation twice', t => {
  const f = fixture(t); f.play(); f.judgments('rain'); const replacement = f.supply(f.leader, 'event', 'clear');
  f.wisp(); f.respond(); const pending = f.room().pendingBattle;
  const request = f.input('respondBattle', { decisionId: pending.id, choice: 'replace', cardId: replacement });
  const result = f.store.action(f.owner.code, f.leader.token, request).view;
  const before = structuredClone(f.room());
  assert.deepEqual(f.store.action(f.owner.code, f.leader.token, request).view, result);
  assert.deepEqual(f.room(), before); assert.equal(f.player(f.target).active.damage, 0);
  assert.equal(f.player(f.target).active.status, 'burn'); assert.equal(ids(f.room().discardPile).filter(id => id === replacement).length, 1);
});

test('a replacement does not flip recursively and Drought has no limit across distinct judgments', t => {
  const f = fixture(t); f.play(); const first = f.supply(f.leader, 'event', 'clear'), second = f.supply(f.leader, 'event', 'intense-sun');
  f.judgments('rain', 'rain'); f.wisp(); f.respond();
  const remaining = f.room().drawPile.length; f.respond('replace', { cardId: first });
  assert.equal(f.room().drawPile.length, remaining); assert.equal(f.room().pendingBattle, null);
  f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'judgment');
  f.respond('replace', { cardId: second });
  assert.equal(f.room().pendingBattle, null); assert.equal(f.room().drawPile.length, remaining - 1);
});

test('persisted Drought resumes the exact remaining actor and card after an earlier replacement', t => {
  const f = fixture(t); f.play(); f.seed(f.third); f.judgments('rain');
  const replacement = f.supply(f.leader, 'event', 'clear'); f.wisp(); f.respond(); f.respond('replace', { cardId: replacement });
  const saved = structuredClone(f.room().judgment), pendingId = f.room().pendingBattle.id;
  assert.equal(f.room().pendingBattle.actorId, f.third.playerId);
  const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now });
  const recovered = restored.view(f.owner.code, f.third.token).view;
  assert.equal(recovered.pendingBattle.id, pendingId); assert.deepEqual(restored.rooms.get(f.owner.code).judgment, saved);
  assert.equal(JSON.stringify(recovered).includes(replacement), false);
  restored.action(f.owner.code, f.third.token, { id: 'vulpix-restart-pass', revision: recovered.revision, type: 'respondBattle', decisionId: pendingId, choice: 'pass' });
  const room = restored.rooms.get(f.owner.code);
  assert.equal(room.pendingBattle, null); assert.equal(room.judgment ?? null, null);
  assert.equal(room.players.find(p => p.id === f.target.playerId).active.status, 'burn');
  assert.equal(ids(room.discardPile).filter(id => id === replacement).length, 1);
});

test('Drought timeout passes optionally and resumes the paused turn without changing inactivity time', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play(); f.advance(1_000);
  f.judgments('rain'); f.wisp(); f.respond(); const revealed = f.room().judgment.card.id;
  const actionAt = f.room().lastActionAt; assert.equal(f.view(f.leader).turn.clock.remainingMs, 59_000);
  f.advance(5_000); const after = f.view(f.leader);
  assert.equal(after.pendingBattle, null); assert.equal(after.turn.clock.remainingMs, 59_000);
  assert.equal(after.turn.clock.pausedReason, null); assert.equal(after.lastActionAt, actionAt);
  assert.equal(f.player(f.target).active.status, null); assert.ok(f.room().discardPile.some(card => card.id === revealed));
});

test('Drought clock pauses for a vote, disconnection and restart with the same saved card and continuation', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 60 }); f.play(); f.judgments('rain'); f.wisp(); f.respond();
  const pendingId = f.room().pendingBattle.id, judgment = structuredClone(f.room().judgment);
  f.advance(2_000); f.act(f.owner, 'requestEndGame');
  const voted = f.view(f.leader); assert.equal(voted.pendingBattle.clock.pausedReason, 'vote');
  const remaining = voted.pendingBattle.clock.remainingMs;
  f.advance(5_000); assert.equal(f.view(f.leader).pendingBattle.clock.remainingMs, remaining);
  rejectsAtomically(f, () => f.respond(), 'VOTE_PENDING');
  f.act(f.target, 'rejectEnd');
  f.advance(CONNECTED_MS + 5_000); const paused = f.view(f.target);
  assert.equal(paused.pendingBattle.clock.pausedReason, 'disconnected');
  const savedMs = paused.pendingBattle.clock.remainingMs;
  const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now });
  const recovered = restored.view(f.owner.code, f.leader.token).view;
  assert.equal(recovered.pendingBattle.id, pendingId); assert.equal(recovered.pendingBattle.clock.remainingMs, savedMs);
  assert.equal(recovered.pendingBattle.clock.deadlineAt, f.now() + savedMs);
  assert.deepEqual(restored.rooms.get(f.owner.code).judgment, judgment);
});

test('all damage-triggered judgment continuations wait for Drought and apply the replaced result once', t => {
  const scenarios = [
    ['charmander', 1, 'clear', 'intense-sun', 'burn'], ['growlithe', 2, 'rain', 'intense-sun', 'burn'],
    ['pikachu', 1, 'thunderstorm', 'clear', null], ['abra', 2, 'rain', 'intense-sun', 'confusion'],
    ['slowpoke', 2, 'thunderstorm', 'clear', null], ['sandshrew', 1, 'rain', 'clear', null],
  ];
  for (const [family, level, original, replacementWeather, expected] of scenarios) {
    const f = fixture(t); f.play(family, level); f.seed(f.third);
    const replacement = f.supply(f.third, 'event', replacementWeather); f.judgments(original);
    f.attack(); f.respond(); const damage = f.player(f.target).active.damage;
    assert.ok(damage > 0); assert.equal(f.player(f.target).active.status, null, family);
    assert.equal(f.room().pendingBattle.kind, 'judgment', family);
    f.respond('replace', { cardId: replacement });
    assert.equal(f.player(f.target).active.status, expected, family); assert.equal(f.player(f.target).active.damage, damage);
    assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null);
  }
});

test('Static pauses its own judgment and resumes after Drought without another damage trigger', t => {
  const f = fixture(t); f.play('charmander', 1); f.seed(f.target, 'pikachu', 1); f.seed(f.third);
  f.judgments('rain', 'rain'); f.attack(); f.respond(); f.passJudgments();
  assert.equal(f.room().pendingBattle.kind, 'static'); f.respond('trait');
  assert.equal(f.room().pendingBattle.kind, 'judgment'); assert.equal(f.player(f.leader).active.status, null);
  const sunny = f.supply(f.third, 'event', 'intense-sun'); f.respond('replace', { cardId: sunny });
  assert.equal(f.player(f.leader).active.status, null); assert.equal(f.player(f.target).active.damage, 1);
  assert.equal(f.room().pendingBattle, null);
});

test('failed Sand Veil restores the original defense ID and its unspent response clock after Drought', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 60 }); f.play('squirtle', 1); f.seed(f.target, 'sandshrew', 1); f.seed(f.third);
  f.judgments('rain'); f.attack(); const defenseId = f.room().pendingBattle.id;
  f.advance(1_000); f.respond('trait'); assert.equal(f.room().pendingBattle.kind, 'judgment');
  f.advance(2_000); f.respond(); const restored = f.view(f.target).pendingBattle;
  assert.equal(restored.kind, 'defense'); assert.equal(restored.id, defenseId); assert.equal(restored.canTrait, false);
  assert.equal(restored.clock.remainingMs, 59_000); assert.equal(restored.clock.deadlineAt, f.now() + 59_000);
  rejectsAtomically(f, () => f.respond('trait'));
  f.respond('dodge', { cardId: f.supply(f.target, 'dodge') });
  assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().pendingBattle, null);
});

test('a sunny Drought replacement makes Sand Veil cancel its settlement', t => {
  const f = fixture(t); f.play('squirtle', 1); f.seed(f.target, 'sandshrew', 1); f.seed(f.third);
  const replacement = f.supply(f.third, 'event', 'clear'); f.judgments('rain'); f.attack(); f.respond('trait');
  assert.equal(f.player(f.target).active.damage, 0); f.respond('replace', { cardId: replacement });
  assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.target).active.damage, 0);
});

test('Chlorophyll waits for Drought before granting range to the same creature', t => {
  const f = fixture(t, { count: 6 }); f.play('bulbasaur', 1); f.seed(f.third);
  const replacement = f.supply(f.third, 'event', 'clear'); f.judgments('rain');
  const before = f.view(f.leader).self.battle.legalTargetIds.length; f.act(f.leader, 'useTrait');
  assert.equal(f.room().pendingBattle.kind, 'judgment'); assert.equal(f.room().turn.rangeCreatureId, null);
  f.respond('replace', { cardId: replacement });
  assert.equal(f.room().turn.rangeCreatureId, f.player(f.leader).active.instanceId);
  assert.ok(f.view(f.leader).self.battle.legalTargetIds.length > before); assert.equal(f.room().pendingBattle, null);
});

test('Rain Dish waits for Drought and uses the final card without healing on a replaced rainy result', t => {
  const f = fixture(t); f.play('squirtle', 1); f.seed(f.third);
  f.player(f.leader).active.damage = 2; f.player(f.leader).active.status = 'poison';
  f.room().turn.phase = 'end'; const replacement = f.supply(f.third, 'event', 'clear'); f.judgments('rain');
  f.act(f.leader, 'useTrait'); assert.equal(f.room().pendingBattle.kind, 'judgment');
  assert.equal(f.player(f.leader).active.damage, 2); assert.equal(f.player(f.leader).active.status, 'poison');
  f.respond('replace', { cardId: replacement });
  assert.equal(f.player(f.leader).active.damage, 2); assert.equal(f.player(f.leader).active.status, 'poison');
  assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null);
});

test('Heat Wave resumes the next independent target only after that targets Drought window completes', t => {
  const f = fixture(t); f.play('growlithe', 3); f.seed(f.third);
  f.judgments('rain', 'rain'); const replacement = f.supply(f.third, 'event', 'intense-sun');
  f.attack({ targetIds: [f.target.playerId, f.third.playerId] }); f.respond();
  assert.equal(f.room().pendingBattle.kind, 'judgment');
  assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.third).active.damage, 0);
  f.respond('replace', { cardId: replacement });
  assert.equal(f.player(f.target).active.status, 'burn');
  assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.room().pendingBattle.actorId, f.third.playerId);
  f.respond(); assert.equal(f.room().pendingBattle.kind, 'judgment');
  assert.equal(f.player(f.third).active.damage, 2); assert.equal(f.player(f.third).active.status, null);
  f.respond(); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null);
  assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.third).active.status, null);
});

test('restart inside a Sand Veil judgment preserves the suspended defense ID and remaining response time', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 60 }); f.play('squirtle', 1);
  f.seed(f.target, 'sandshrew', 1); f.seed(f.third); f.judgments('rain'); f.attack();
  const defenseId = f.room().pendingBattle.id, dodge = f.supply(f.target, 'dodge');
  f.advance(2_000); f.respond('trait'); f.advance(3_000); f.view(f.third);
  const judgment = structuredClone(f.room().judgment), judgmentId = f.room().pendingBattle.id;
  const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now });
  f.advance(20_000); const recovered = restored.view(f.owner.code, f.third.token).view;
  assert.deepEqual(restored.rooms.get(f.owner.code).judgment, judgment);
  assert.equal(recovered.pendingBattle.id, judgmentId);
  assert.equal(recovered.pendingBattle.clock.remainingMs, 57_000);
  restored.action(f.owner.code, f.third.token, { id: 'nested-sand-veil-pass', revision: recovered.revision, type: 'respondBattle', decisionId: judgmentId, choice: 'pass' });
  const resumed = restored.view(f.owner.code, f.target.token).view;
  assert.equal(resumed.pendingBattle.id, defenseId); assert.equal(resumed.pendingBattle.kind, 'defense');
  assert.equal(resumed.pendingBattle.clock.remainingMs, 58_000);
  assert.equal(resumed.pendingBattle.clock.deadlineAt, f.now() + 58_000);
  restored.action(f.owner.code, f.target.token, { id: 'nested-sand-veil-dodge', revision: resumed.revision, type: 'respondBattle', decisionId: defenseId, choice: 'dodge', cardId: dodge });
  const settled = restored.rooms.get(f.owner.code);
  assert.equal(settled.pendingBattle, null); assert.equal(settled.players.find(p => p.id === f.target.playerId).active.damage, 0);
});
