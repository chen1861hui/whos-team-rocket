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
  const dir = mkdtempSync(join(root, 'expanded-pokemon-test-'));
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
  const input = (type, payload = {}) => ({ id: `expanded-${++serial}`, revision: room().revision, type, ...payload });
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
  // Legal setup is deliberately followed by explicit combat seeds. The public
  // scenario's command/dodge deck remains all-sun; judgments below are fixtures.
  const seed = (who, family, level = 1, extra = {}) => Object.assign(player(who).active, {
    instanceId: `active-${who.playerId}`, catalogueId: family, level, damage: 0,
    status: null, reinforcements: [], hpBonus: 0, defeated: false, ...extra,
  });
  for (const who of seats) {
    seed(who, 'squirtle', 3);
    Object.assign(player(who).reserve, { catalogueId: 'squirtle', level: 1, damage: 0, status: null, defeated: false });
    player(who).hand = [];
  }
  const supply = (who, kind, weather = 'intense-sun') => {
    const card = { id: `private-${++serial}`, kind, weather, fixture: true, name: { zh: `私牌${serial}`, en: `Private card ${serial}` } };
    player(who).hand.push(card); return card.id;
  };
  const judgments = (...weather) => {
    for (const value of [...weather].reverse()) room().drawPile.push({ id: `judgment-${++serial}`, kind: 'judgment-fixture', weather: value, fixture: true, name: { zh: '判定测试', en: 'Judgment fixture' } });
  };
  const target = seats.find(who => who !== leader);
  const play = () => { act(leader, 'draw'); act(leader, 'draw'); };
  const attack = (victim = target, weather = 'intense-sun') => act(leader, 'attack', { cardId: supply(leader, 'command', weather), targetIds: [victim.playerId] });
  const respond = (choice = 'pass', payload = {}) => {
    const pending = room().pendingBattle;
    return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload });
  };
  return { store, dir, now, owner, seats, leader, target, room, player, byId, view, input, act, seed, supply, judgments, play, attack, respond, advance: ms => { time += ms; } };
}
const rejects = (fn, code) => assert.throws(fn, error => error.code === code);
const judgmentCount = f => f.room().log.filter(entry => entry.text.en.includes('judgment revealed')).length;

// Damage values and weather branches come from the six reviewed face photos.
test('Pikachu levels use printed damage 1/2/3 and thunderstorm paralysis never replaces a status', t => {
  for (const level of [1, 2, 3]) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'pikachu', level);
    f.seed(f.target, 'squirtle', 3, { status: level === 2 ? 'burn' : null });
    f.judgments('thunderstorm'); f.attack(); f.respond();
    assert.equal(f.player(f.target).active.damage, level);
    assert.equal(f.player(f.target).active.status, level === 2 ? 'burn' : 'paralysis');
    assert.equal(judgmentCount(f), 1);
    assert.equal(f.room().pendingBattle, null);
  }
});

test('a real Dodge prevents Pikachu damage, move judgment and the target Static trigger', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'pikachu'); f.seed(f.target, 'pikachu');
  f.judgments('thunderstorm'); const topId = f.room().drawPile.at(-1).id;
  f.attack(); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') });
  assert.equal(f.player(f.target).active.damage, 0);
  assert.equal(f.player(f.target).active.status, null);
  assert.equal(f.room().drawPile.at(-1).id, topId);
  assert.equal(judgmentCount(f), 0); assert.equal(f.room().pendingBattle, null);
});

test('Static follows the source after-damage effect and paralyzes its actual source without spending a hand card', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'charmander'); f.seed(f.target, 'pikachu');
  f.judgments('intense-sun', 'rain'); f.attack(); f.respond();
  const pending = f.room().pendingBattle;
  assert.equal(pending.kind, 'static'); assert.equal(pending.actorId, f.target.playerId);
  assert.equal(pending.targetId, f.leader.playerId);
  assert.equal(f.player(f.target).active.status, 'burn');
  assert.equal(judgmentCount(f), 1);
  rejects(() => f.act(f.leader, 'respondBattle', { decisionId: pending.id, choice: 'trait' }), 'NOT_YOUR_DECISION');
  const hand = structuredClone(f.player(f.target).hand);
  f.respond('trait');
  assert.equal(f.player(f.leader).active.status, 'paralysis');
  assert.deepEqual(f.player(f.target).hand, hand);
  assert.equal(judgmentCount(f), 2); assert.equal(f.room().pendingBattle, null);
});

test('Static may be passed, fails in intense sun, and preserves a preexisting source status', t => {
  for (const scenario of [{ choice: 'pass', weather: 'rain', status: null }, { choice: 'trait', weather: 'intense-sun', status: null }, { choice: 'trait', weather: 'clear', status: 'burn' }]) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'bulbasaur', 1, { status: scenario.status }); f.seed(f.target, 'pikachu');
    f.judgments(scenario.weather); f.attack(); f.respond(); f.respond(scenario.choice);
    assert.equal(f.player(f.leader).active.status, scenario.status);
    assert.equal(judgmentCount(f), scenario.choice === 'pass' ? 0 : 1);
    assert.equal(f.room().pendingBattle, null);
  }
});

test('Static uses confusion self-damage, excludes sourceless poison and does not transfer to forced reserves', t => {
  const confusion = fixture(t); confusion.seed(confusion.leader, 'pikachu', 1, { status: 'confusion' });
  confusion.judgments('clear'); confusion.store.startTurn(confusion.room(), confusion.leader.playerId, 7);
  assert.equal(confusion.room().pendingBattle.kind, 'static');
  assert.equal(confusion.room().pendingBattle.actorId, confusion.leader.playerId);
  assert.equal(confusion.room().pendingBattle.targetId, confusion.leader.playerId);
  confusion.respond('trait');
  assert.equal(confusion.player(confusion.leader).active.damage, 1);
  assert.equal(confusion.player(confusion.leader).active.status, 'paralysis');
  const poison = fixture(t); poison.seed(poison.leader, 'pikachu', 1, { status: 'poison' });
  poison.store.startTurn(poison.room(), poison.leader.playerId, 7);
  assert.equal(poison.player(poison.leader).active.damage, 1);
  assert.equal(poison.room().pendingBattle, null);
  const defeat = fixture(t); defeat.play(); defeat.seed(defeat.leader, 'bulbasaur'); defeat.seed(defeat.target, 'pikachu', 1, { damage: 2 });
  defeat.attack(); defeat.respond();
  while (defeat.room().pendingBattle?.kind === 'rescue') defeat.respond();
  assert.equal(defeat.player(defeat.target).active.catalogueId, 'squirtle');
  assert.equal(defeat.room().pendingBattle, null);
});

test('Sand Veil sunny judgments cancel exactly one settlement without consuming a hand and retry safely', t => {
  for (const weather of ['intense-sun', 'clear']) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'pikachu'); f.seed(f.target, 'sandshrew');
    f.supply(f.target, 'dodge'); f.judgments(weather); f.attack();
    assert.equal(f.view(f.target).pendingBattle.canTrait, true);
    assert.equal(f.view(f.target).pendingBattle.trait, 'sand-veil');
    const hand = structuredClone(f.player(f.target).hand), pending = f.room().pendingBattle;
    const input = f.input('respondBattle', { decisionId: pending.id, choice: 'trait' });
    const result = f.store.action(f.owner.code, f.target.token, input).view;
    assert.equal(result.pendingBattle, null); assert.equal(f.player(f.target).active.damage, 0);
    assert.deepEqual(f.player(f.target).hand, hand); assert.equal(judgmentCount(f), 1);
    f.store.action(f.owner.code, f.target.token, input);
    assert.deepEqual(f.player(f.target).hand, hand); assert.equal(judgmentCount(f), 1);
    rejects(() => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'trait' }), 'STALE_DECISION');
  }
});

test('failed Sand Veil keeps its response id and deadline, forbids repeat attempts and still accepts Dodge', t => {
  for (const weather of ['rain', 'thunderstorm']) {
    const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play(); f.seed(f.target, 'sandshrew');
    f.judgments(weather); f.attack(); const before = structuredClone(f.room().pendingBattle);
    f.advance(1_000); f.respond('trait'); const after = f.view(f.target).pendingBattle;
    assert.equal(after.id, before.id); assert.equal(after.canTrait, false);
    assert.equal(after.clock.deadlineAt, before.clock.deadlineAt); assert.equal(after.clock.remainingMs, 4_000);
    const snapshot = structuredClone(f.room());
    assert.throws(() => f.respond('trait')); assert.deepEqual(f.room(), snapshot);
    f.respond('dodge', { cardId: f.supply(f.target, 'dodge') });
    assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().pendingBattle, null);
    assert.equal(judgmentCount(f), 1);
  }
});

test('a held item disables Sand Veil and an unrelated active cannot invoke it', t => {
  for (const family of ['sandshrew', 'squirtle']) {
    const f = fixture(t); f.play(); f.seed(f.target, family, 1, family === 'sandshrew' ? { item: { id: 'held-test-item' } } : {}); f.attack();
    assert.equal(Boolean(f.view(f.target).pendingBattle.canTrait), false);
    const hand = structuredClone(f.player(f.target).hand), deck = f.room().drawPile.length;
    assert.throws(() => f.respond('trait'));
    assert.deepEqual(f.player(f.target).hand, hand); assert.equal(f.room().drawPile.length, deck);
    f.respond(); assert.equal(f.player(f.target).active.damage, 2);
  }
});

test('Sandshrew level 1 heavy-rain judgment poisons only an unstatused target after positive damage', t => {
  for (const status of [null, 'paralysis']) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'sandshrew'); f.seed(f.target, 'squirtle', 3, { status });
    f.judgments('rain'); f.attack(); f.respond();
    assert.equal(f.player(f.target).active.damage, 1);
    assert.equal(f.player(f.target).active.status, status || 'poison');
    assert.equal(judgmentCount(f), 1); assert.equal(f.room().pendingBattle, null);
  }
});

test('mandatory Sandshrew hand choice exposes only indexed backs to the source and never expires into pass', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play(); f.seed(f.leader, 'sandshrew', 2);
  f.supply(f.target, 'command', 'rain'); f.supply(f.target, 'dodge', 'clear');
  const hidden = structuredClone(f.player(f.target).hand);
  const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true });
  f.attack(); f.respond(); const pending = f.view(f.leader).pendingBattle;
  assert.equal(pending.kind, 'hand'); assert.equal(pending.effect, 'discard');
  assert.equal(pending.actorId, f.leader.playerId); assert.equal(pending.targetId, f.target.playerId);
  assert.equal(pending.choiceCount, 2); assert.deepEqual(pending.choices, [{ index: 0 }, { index: 1 }]);
  assert.equal(f.view(f.target).pendingBattle.choices, undefined);
  assert.equal(f.view(observer).pendingBattle.choices, undefined);
  for (const card of hidden) {
    assert.equal(JSON.stringify(f.view(f.leader)).includes(card.id), false);
    assert.equal(JSON.stringify(f.view(f.leader)).includes(card.name.en), false);
    assert.equal(JSON.stringify(f.view(observer)).includes(card.id), false);
  }
  rejects(() => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'card', handIndex: 0 }), 'NOT_YOUR_DECISION');
  assert.throws(() => f.respond());
  const lastActionAt = f.room().lastActionAt;
  f.advance(5_000); const expired = f.view(f.leader);
  assert.equal(expired.pendingBattle.id, pending.id); assert.equal(expired.pendingBattle.clock.remainingMs, 0);
  assert.equal(expired.pendingBattle.clock.deadlineAt, null); assert.equal(expired.turn.clock.pausedReason, 'response');
  assert.equal(expired.lastActionAt, lastActionAt); assert.deepEqual(f.player(f.target).hand, hidden);
});

test('Sandshrew discard choice validates atomically, retries once and resumes with target Static after source effects', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'sandshrew', 2); f.seed(f.target, 'pikachu', 3);
  const removed = f.supply(f.target, 'dodge'); f.supply(f.target, 'command');
  f.attack(); f.respond(); const pending = f.room().pendingBattle;
  const snapshot = structuredClone(f.room());
  for (const payload of [{ handIndex: -1 }, { handIndex: 2 }, { handIndex: 0.5 }, { cardId: removed }, { handIndex: 0, cardId: removed }]) {
    assert.throws(() => f.act(f.leader, 'respondBattle', { decisionId: pending.id, choice: 'card', ...payload }));
    assert.deepEqual(f.room(), snapshot);
  }
  const removedIndex = f.room().resolution.handChoiceIds.indexOf(removed);
  const input = f.input('respondBattle', { decisionId: pending.id, choice: 'card', handIndex: removedIndex });
  f.store.action(f.owner.code, f.leader.token, input);
  assert.equal(f.room().pendingBattle.kind, 'static'); assert.equal(f.room().pendingBattle.actorId, f.target.playerId);
  assert.equal(f.player(f.target).active.damage, 2);
  assert.equal(f.player(f.target).hand.some(card => card.id === removed), false);
  assert.equal(f.room().discardPile.filter(card => card.id === removed).length, 1);
  const staticId = f.room().pendingBattle.id;
  f.store.action(f.owner.code, f.leader.token, input);
  assert.equal(f.room().pendingBattle.id, staticId); assert.equal(f.player(f.target).active.damage, 2);
  assert.equal(f.room().discardPile.filter(card => card.id === removed).length, 1);
  f.respond(); assert.equal(f.room().pendingBattle, null); assert.equal(judgmentCount(f), 0);
});

test('Sandshrew take retains its private choice mapping across restart and transfers the selected card once', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'sandshrew', 3);
  f.supply(f.target, 'command', 'rain'); const takenId = f.supply(f.target, 'dodge', 'thunderstorm');
  f.attack(); f.respond(); const pending = f.view(f.leader).pendingBattle;
  assert.equal(pending.effect, 'take');
  assert.deepEqual([...f.room().resolution.handChoiceIds].sort(), f.player(f.target).hand.map(card => card.id).sort());
  const takenIndex = f.room().resolution.handChoiceIds.indexOf(takenId);
  const restarted = new RoomStore({ dataDir: f.dir, catalogue, now: f.now });
  const recovered = restarted.view(f.owner.code, f.leader.token).view;
  assert.equal(recovered.pendingBattle.id, pending.id);
  assert.deepEqual(recovered.pendingBattle.choices, [{ index: 0 }, { index: 1 }]);
  assert.deepEqual(restarted.rooms.get(f.owner.code).resolution.handChoiceIds, f.room().resolution.handChoiceIds);
  const input = { id: 'take-after-restart', revision: recovered.revision, type: 'respondBattle', decisionId: pending.id, choice: 'card', handIndex: takenIndex };
  restarted.action(f.owner.code, f.leader.token, input);
  restarted.action(f.owner.code, f.leader.token, input);
  const final = restarted.rooms.get(f.owner.code);
  assert.equal(final.players.find(p => p.id === f.leader.playerId).hand.filter(card => card.id === takenId).length, 1);
  assert.equal(final.players.find(p => p.id === f.target.playerId).hand.some(card => card.id === takenId), false);
  assert.equal(final.discardPile.some(card => card.id === takenId), false); assert.equal(final.pendingBattle, null);
});

test('self-targeted Sandshrew hand choice shows own names/weather and an emptied mapped slot cannot select another card', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'sandshrew', 2);
  f.player(f.leader).hand = []; f.supply(f.leader, 'dodge', 'rain'); f.supply(f.leader, 'dodge', 'clear');
  const ownCards = structuredClone(f.player(f.leader).hand);
  f.attack(f.leader); f.respond(); const pending = f.view(f.leader).pendingBattle;
  assert.equal(pending.targetId, f.leader.playerId); assert.equal(pending.choiceCount, 2);
  const mappedIds = f.room().resolution.handChoiceIds;
  assert.deepEqual(pending.choices.map(choice => ({ index: choice.index, name: choice.name, weather: choice.weather })), mappedIds.map((id, index) => { const card = ownCards.find(value => value.id === id); return { index, name: card.name, weather: card.weather }; }));
  // Simulate a stale private mapping, preserving its original slot identities.
  f.player(f.leader).hand.shift(); const snapshot = structuredClone(f.room());
  assert.throws(() => f.respond('card', { handIndex: mappedIds.indexOf(ownCards[0].id) })); assert.deepEqual(f.room(), snapshot);
  f.respond('card', { handIndex: mappedIds.indexOf(ownCards[1].id) });
  assert.equal(f.player(f.leader).hand.length, 0); assert.equal(f.room().pendingBattle, null);
  assert.equal(f.player(f.leader).active.damage, 2);
});

test('paralysis rejects rainy command cards before spending them and permits sunny cards with power suppressed', t => {
  for (const weather of ['intense-sun', 'clear']) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'pikachu', 2, { status: 'paralysis', reinforcements: ['power'] });
    for (const forbidden of ['rain', 'thunderstorm']) {
      const cardId = f.supply(f.leader, 'command', forbidden), before = structuredClone(f.room());
      assert.throws(() => f.act(f.leader, 'attack', { cardId, targetIds: [f.target.playerId] }));
      assert.deepEqual(f.room(), before);
    }
    f.judgments('intense-sun'); f.attack(f.target, weather); f.respond();
    assert.equal(f.player(f.target).active.damage, 2);
    assert.deepEqual(f.player(f.leader).active.reinforcements, ['power']);
  }
});


