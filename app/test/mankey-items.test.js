import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore, CONNECTED_MS } from '../server/store.js';
import * as combat from '../server/combat.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));
function fixture(t, { count = 3, turnSeconds = 0, responseSeconds = 0, originalDeck = false } = {}) {
  const root = fileURLToPath(new URL('../.data/', import.meta.url));
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'mankey-items-test-'));
  t.after(() => {
    if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path');
    rmSync(dir, { recursive: true, force: true });
  });
  let time = 1_000_000, serial = 0;
  const now = () => time, store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `mankey-items-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) {
    for (let draw = 0; draw < 5; draw++) act(who, 'drawPokemon');
    const candidates = view(who).self.candidates;
    act(who, 'selectPokemon', { activeId: candidates[0], reserveId: candidates[1] });
  }
  const seed = (who, family = 'mankey', level = 1, extra = {}) => Object.assign(player(who).active, {
    instanceId: `active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null,
    reinforcements: [], hpBonus: 0, defeated: false, revealed: true, ...extra,
  });
  const makeCard = (kind = 'dodge', weather = 'clear') => ({ id: `private-mankey-${++serial}`, kind, weather, fixture: true, name: { zh: `私牌${serial}`, en: `Private item fixture ${serial}` } });
  const helmet = () => ({ id: `private-helmet-${++serial}`, kind: 'held-item', itemType: 'rocky-helmet', name: { en: 'Rocky Helmet', zh: '凸凸头盔' }, weather: 'thunderstorm' });
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const item = (who, slot = 'active') => { const card = helmet(); player(who)[slot].item = card; return card; };
  if (!originalDeck) {
    for (const who of seats) {
      seed(who, 'mankey', 1);
      Object.assign(player(who).reserve, { instanceId: `reserve-${who.playerId}`, catalogueId: 'mankey', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 0, defeated: false, revealed: false });
      player(who).hand = [];
    }
    room().drawPile = Array.from({ length: 48 }, () => makeCard()); room().discardPile = [];
  }
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id);
  const play = (who = leader) => { while (room().turn.drawRemaining) act(who, 'draw'); };
  const attack = (targets = [target], who = leader) => { const cardId = supply(who); act(who, 'attack', { cardId, targetIds: targets.map(p => p.playerId) }); return cardId; };
  const respond = (choice = 'pass', payload = {}) => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload }); };
  const equip = (who = leader, slot = 'active') => { const card = helmet(); player(who).hand.push(card); act(who, 'equipItem', { cardId: card.id, slot }); return card; };
  const drain = () => { for (let i = 0; room().pendingBattle && i < 40; i++) { const pending = room().pendingBattle; respond(pending.kind === 'effects' ? 'effect' : 'pass', pending.kind === 'effects' ? { effect: pending.effects.includes('oblivious') ? 'oblivious' : pending.effects[0] } : {}); } assert.equal(room().pendingBattle, null); };
  return { store, dir, now, owner, seats, leader, target, room, player, byId, view, input, act, seed, makeCard, helmet, supply, item, play, attack, respond, equip, drain, advance: ms => { time += ms; } };
}
function rejectsAtomically(f, fn, code) { const before = structuredClone(f.room()); assert.throws(fn, code ? error => error.code === code : undefined); assert.deepEqual(f.room(), before); }
const occurrences = (f, id) => [f.room().drawPile, f.room().discardPile, ...f.room().players.flatMap(p => [p.hand, [p.active?.item, p.reserve?.item].filter(Boolean)])].flat().filter(card => card.id === id).length;
const finish = (f, who) => { f.act(who, 'finishPlay'); while (f.room().turn.phase === 'discard') f.act(who, 'discard', { cardId: f.player(who).hand[0].id }); f.act(who, 'endTurn', { levelUp: false }); };

test('production preview keeps six real commands and six Dodges per seat without invented item quantities', t => {
  const f = fixture(t, { originalDeck: true });
  const cards = [...f.room().drawPile, ...f.room().players.flatMap(p => p.hand)];
  assert.equal(cards.length, 36); assert.equal(cards.filter(c => c.kind === 'command').length, 18);
  assert.equal(cards.filter(c => c.kind === 'dodge').length, 18); assert.equal(cards.filter(c => c.kind === 'held-item').length, 0);
});

test('all Mankey faces are enabled and Scratch has only its printed two damage', t => {
  assert.deepEqual(catalogue.entries.find(p => p.id === 'mankey').levels.map(p => p.effectStatus), Array(3).fill('combat-preview'));
  const f = fixture(t); f.play();
  assert.equal(f.view(f.leader).self.battle.move.printedValue, 2);
  f.player(f.target).active.reinforcements = ['speed']; f.attack();
  assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond();
  assert.equal(f.player(f.target).active.damage, 2); assert.deepEqual(f.player(f.target).active.reinforcements, ['speed']); assert.equal(f.room().pendingBattle, null);
});

test('equipping moves the actual card to either own slot and discards a replaced item once', t => {
  for (const slot of ['active', 'reserve']) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'squirtle', 1);
    const old = f.item(f.leader, slot), card = f.equip(f.leader, slot);
    assert.deepEqual(f.player(f.leader)[slot].item, card);
    assert.equal(f.player(f.leader).hand.some(c => c.id === card.id), false);
    assert.deepEqual(f.room().discardPile.filter(c => c.id === old.id), [old]);
    assert.equal(occurrences(f, old.id), 1); assert.equal(occurrences(f, card.id), 1); assert.equal(f.room().pendingBattle, null);
  }
});

test('equip rejects forged cards, slots, extraneous fields and generic unequip atomically', t => {
  const f = fixture(t); f.play(); const card = f.helmet(); f.player(f.leader).hand.push(card);
  const ordinary = f.supply(f.leader), foreign = f.helmet(); f.player(f.target).hand.push(foreign);
  for (const payload of [{ cardId: card.id }, { cardId: card.id, slot: 'opponent' }, { cardId: card.id, slot: null }, { cardId: ordinary, slot: 'active' }, { cardId: foreign.id, slot: 'active' }, { cardId: 'forged', slot: 'reserve' }, { cardId: card.id, slot: 'active', targetId: f.target.playerId }, { cardId: card.id, slot: 'active', choice: 'pass' }]) rejectsAtomically(f, () => f.act(f.leader, 'equipItem', payload));
  rejectsAtomically(f, () => f.act(f.leader, 'unequipItem', { slot: 'active' }));
});

test('equip requires own Play, a living own slot, no response and no closing vote', t => {
  const f = fixture(t); const card = f.helmet(); f.player(f.leader).hand.push(card);
  rejectsAtomically(f, () => f.act(f.leader, 'equipItem', { cardId: card.id, slot: 'active' })); f.play();
  rejectsAtomically(f, () => f.act(f.target, 'equipItem', { cardId: card.id, slot: 'active' }), 'NOT_YOUR_TURN');
  const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true });
  rejectsAtomically(f, () => f.act(observer, 'equipItem', { cardId: card.id, slot: 'active' }), 'SPECTATOR_ONLY_VIEW');
  f.player(f.leader).reserve.defeated = true;
  rejectsAtomically(f, () => f.act(f.leader, 'equipItem', { cardId: card.id, slot: 'reserve' })); f.player(f.leader).reserve.defeated = false;
  f.act(f.owner, 'requestEndGame'); rejectsAtomically(f, () => f.act(f.leader, 'equipItem', { cardId: card.id, slot: 'active' }), 'VOTE_PENDING');
  f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); f.attack();
  rejectsAtomically(f, () => f.act(f.leader, 'equipItem', { cardId: card.id, slot: 'active' }), 'RESPONSE_PENDING');
});

test('active items expose a safe public stub while unrevealed opposing reserves and held IDs stay private', t => {
  const f = fixture(t); f.play(); const active = f.equip(), hidden = f.item(f.target, 'reserve');
  const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true });
  for (const who of [f.leader, f.target, observer]) {
    const view = f.view(who), publicActive = view.players.find(p => p.id === f.leader.playerId).active;
    assert.deepEqual(publicActive.item, { itemType: active.itemType, name: active.name, weather: active.weather });
    assert.equal(publicActive.item.id, undefined); assert.equal(view.resolutionStack, undefined); assert.equal(view.resolution, undefined);
    if (who !== f.target) { assert.equal(view.players.find(p => p.id === f.target.playerId).reserve, undefined); assert.equal(JSON.stringify(view).includes(hidden.id), false); }
  }
  assert.deepEqual(f.view(f.target).self.reserve.item, hidden);
});

test('active Mankey replacement offers optional Defiant for each distinct loss and draws before granting this-turn exemption', t => {
  const f = fixture(t); f.play(); f.item(f.leader);
  for (let loss = 0; loss < 2; loss++) {
    const before = f.player(f.leader).hand.length, deck = f.room().drawPile.slice(-2).reverse().map(c => c.id);
    f.equip(); assert.equal(f.room().pendingBattle.kind, 'defiant'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId);
    assert.equal(f.player(f.leader).hand.length, before); f.respond('trait');
    assert.equal(f.player(f.leader).hand.length, before + 2); assert.deepEqual(f.player(f.leader).hand.slice(-2).map(c => c.id), deck);
    assert.equal(f.view(f.leader).self.handLimit, null); assert.equal(combat.handLimit(f.room(), f.player(f.leader)), Infinity);
  }
  assert.equal(f.room().pendingBattle, null);
});

test('passing Defiant draws nothing and grants no hand-limit exception', t => {
  const f = fixture(t); f.play(); f.item(f.leader); const before = f.player(f.leader).hand.length; f.equip(); f.respond();
  assert.equal(f.player(f.leader).hand.length, before); assert.equal(f.view(f.leader).self.handLimit, 4); assert.equal(combat.handLimit(f.room(), f.player(f.leader)), 4);
});

test('reserve Mankey replacement and ordinary switching do not create loss triggers', t => {
  const f = fixture(t); f.play(); const active = f.equip(), old = f.item(f.leader, 'reserve'); f.equip(f.leader, 'reserve');
  assert.equal(f.room().pendingBattle, null); assert.equal(f.room().discardPile.filter(c => c.id === old.id).length, 1);
  f.act(f.leader, 'switchPokemon'); assert.equal(f.room().pendingBattle, null); assert.deepEqual(f.player(f.leader).reserve.item, active); assert.equal(f.view(f.leader).self.handLimit, 4);
});

test('Defiant exception survives switching, skips discard and resets on the next global turn', t => {
  const f = fixture(t); f.play(); f.item(f.leader); f.equip(); f.respond('trait');
  while (f.player(f.leader).hand.length < 7) f.supply(f.leader);
  f.act(f.leader, 'switchPokemon'); assert.equal(f.view(f.leader).self.handLimit, null);
  f.act(f.leader, 'finishPlay'); assert.equal(f.room().turn.phase, 'end');
  rejectsAtomically(f, () => f.act(f.leader, 'discard', { cardId: f.player(f.leader).hand[0].id }), 'DISCARD_NOT_ALLOWED');
  f.act(f.leader, 'endTurn', { levelUp: false }); assert.equal(f.view(f.leader).self.handLimit, 4); assert.equal(f.player(f.leader).hand.length, 7);
});

test('turn timeout uses Defiant exemption instead of stranding a large hand in discard', t => {
  const f = fixture(t, { turnSeconds: 5 }); f.play(); f.item(f.leader); f.equip(); f.respond('trait');
  while (f.player(f.leader).hand.length < 7) f.supply(f.leader);
  f.advance(5_000); f.view(f.leader); assert.notEqual(f.room().turn.playerId, f.leader.playerId); assert.equal(f.player(f.leader).hand.length, 7);
});

test('equip and Defiant retries plus restart neither duplicate item loss nor double the draw', t => {
  const f = fixture(t); f.play(); const old = f.item(f.leader), replacement = f.helmet(); f.player(f.leader).hand.push(replacement);
  const equip = f.input('equipItem', { cardId: replacement.id, slot: 'active' }); f.store.action(f.owner.code, f.leader.token, equip);
  const pending = f.room().pendingBattle, committed = structuredClone(f.room());
  f.store.action(f.owner.code, f.leader.token, equip); assert.deepEqual(f.room(), committed);
  const restarted = new RoomStore({ dataDir: f.dir, catalogue, now: f.now });
  const recovered = restarted.view(f.owner.code, f.leader.token).view; assert.equal(recovered.pendingBattle.id, pending.id);
  const choice = { id: 'mankey-defiant-restarted', revision: recovered.revision, type: 'respondBattle', decisionId: pending.id, choice: 'trait' };
  restarted.action(f.owner.code, f.leader.token, choice); const state = structuredClone(restarted.rooms.get(f.owner.code));
  restarted.action(f.owner.code, f.leader.token, choice); assert.deepEqual(restarted.rooms.get(f.owner.code), state);
  assert.equal(state.players.find(p => p.id === f.leader.playerId).hand.length, 4); assert.equal(state.discardPile.filter(c => c.id === old.id).length, 1);
  assert.equal(restarted.view(f.owner.code, f.leader.token).view.self.handLimit, null);
});

test('Defiant rejects wrong actors and payloads atomically, pauses for a vote and optionally times out as pass', t => {
  const f = fixture(t, { responseSeconds: 5 }); f.play(); f.item(f.leader); f.equip(); const pending = f.room().pendingBattle;
  rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'trait' }), 'NOT_YOUR_DECISION');
  for (const payload of [{ choice: 'dodge' }, { choice: 'trait', cardId: 'forged' }, { choice: 'trait', effect: 'rocky-helmet' }, { choice: 'trait', reinforcement: 'speed' }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...payload }));
  f.advance(2_000); f.act(f.owner, 'requestEndGame'); f.advance(10_000);
  assert.equal(f.view(f.leader).pendingBattle.clock.remainingMs, 3_000);
  rejectsAtomically(f, () => f.respond('trait'), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd');
  f.advance(3_000); f.view(f.leader); assert.equal(f.room().pendingBattle, null); assert.equal(f.view(f.leader).self.handLimit, 4); assert.equal(f.player(f.leader).hand.length, 2);
  const exhausted = fixture(t); exhausted.play(); exhausted.item(exhausted.leader); exhausted.equip();
  exhausted.room().drawPile = [exhausted.makeCard()]; exhausted.room().discardPile = [];
  rejectsAtomically(exhausted, () => exhausted.respond('trait'), 'DECK_EMPTY'); assert.equal(exhausted.view(exhausted.leader).self.handLimit, 4);
});

test('Lv2 removes one chosen marker at move use even when its later damage is Dodged', t => {
  for (const marker of ['power', 'defense', 'speed']) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'mankey', 2); f.player(f.target).active.reinforcements = ['power', 'defense', 'speed']; f.attack();
    assert.equal(f.room().pendingBattle.kind, 'reinforcement'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId);
    assert.equal(f.player(f.target).active.damage, 0); f.respond('reinforcement', { reinforcement: marker });
    assert.deepEqual(f.player(f.target).active.reinforcements, ['power', 'defense', 'speed'].filter(p => p !== marker));
    assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); assert.equal(f.player(f.target).active.damage, 0);
  }
});

test('Lv3 completes every marked target choice before the first defense and preserves its consumed source power', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'mankey', 3, { reinforcements: ['power', 'speed'] }); f.player(f.target).active.reinforcements = ['defense', 'speed'];
  const legal = f.view(f.leader).self.battle; assert.equal(legal.move.maxTargets, 2); assert.equal(legal.moves[0].maxTargets, 2);
  f.attack([f.leader, f.target]); assert.deepEqual(f.player(f.leader).active.reinforcements, ['speed']);
  assert.equal(f.room().pendingBattle.kind, 'reinforcement'); f.respond('reinforcement', { reinforcement: 'speed' });
  assert.equal(f.room().pendingBattle.kind, 'reinforcement'); assert.equal(f.room().pendingBattle.targetId, f.target.playerId);
  assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.player(f.target).active.damage, 0);
  f.respond('reinforcement', { reinforcement: 'defense' }); assert.equal(f.room().pendingBattle.kind, 'defense');
  f.respond(); assert.equal(f.player(f.leader).active.damage, 3); assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') });
  assert.deepEqual(f.player(f.target).active.reinforcements, ['speed']); assert.equal(f.room().pendingBattle, null);
});

test('Lv3 skips unmarked targets and rejects duplicate, excessive and out-of-range targets atomically', t => {
  const f = fixture(t, { count: 6 }); f.play(); f.seed(f.leader, 'mankey', 3);
  const legal = f.view(f.leader).self.battle.legalTargetIds, far = f.seats.find(who => !legal.includes(who.playerId)); const cardId = f.supply(f.leader);
  for (const targetIds of [[], [f.target.playerId, f.target.playerId], legal.slice(0, 3), [far.playerId]]) rejectsAtomically(f, () => f.act(f.leader, 'attack', { cardId, targetIds }), 'INVALID_TARGET');
  f.act(f.leader, 'attack', { cardId, targetIds: [f.target.playerId, f.leader.playerId] }); assert.equal(f.room().pendingBattle.kind, 'defense');
  f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); f.respond('dodge', { cardId: f.supply(f.leader, 'dodge') }); assert.equal(f.room().pendingBattle, null);
});

test('Mankey mandatory marker response validates actor, option and instance and exact retries remove only once', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'mankey', 2); f.player(f.target).active.reinforcements = ['defense', 'speed']; f.attack(); const pending = f.room().pendingBattle;
  for (const payload of [{ choice: 'pass' }, { choice: 'reinforcement', reinforcement: 'power' }, { choice: 'reinforcement', reinforcement: 'speed', effect: 'rocky-helmet' }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...payload }));
  rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'reinforcement', reinforcement: 'speed' }), 'NOT_YOUR_DECISION');
  const id = f.player(f.target).active.instanceId; f.player(f.target).active.instanceId = 'changed-instance'; rejectsAtomically(f, () => f.respond('reinforcement', { reinforcement: 'speed' }), 'STALE_DECISION'); f.player(f.target).active.instanceId = id;
  const input = f.input('respondBattle', { decisionId: pending.id, choice: 'reinforcement', reinforcement: 'speed' }); f.store.action(f.owner.code, f.leader.token, input); const committed = structuredClone(f.room());
  f.store.action(f.owner.code, f.leader.token, input); assert.deepEqual(f.room(), committed); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']);
  rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, choice: 'reinforcement', reinforcement: 'defense' }), 'STALE_DECISION');
});

test('marker timeout remains mandatory across restart and a closing vote without leaking hand or item identities', t => {
  const f = fixture(t, { responseSeconds: 5 }); f.play(); f.seed(f.leader, 'mankey', 3); f.player(f.target).active.reinforcements = ['speed']; const hidden = f.item(f.target, 'reserve'); const privateCard = f.supply(f.target, 'dodge'); f.attack();
  f.advance(5_000); const view = f.view(f.leader); assert.equal(view.pendingBattle.kind, 'reinforcement'); assert.equal(view.pendingBattle.clock.pausedReason, 'mandatory'); assert.equal(view.pendingBattle.clock.remainingMs, 0);
  assert.equal(JSON.stringify(view).includes(privateCard), false); assert.equal(JSON.stringify(view).includes(hidden.id), false);
  const restarted = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); const restored = restarted.view(f.owner.code, f.leader.token).view;
  assert.equal(restored.pendingBattle.id, view.pendingBattle.id); assert.deepEqual(restored.pendingBattle.reinforcements, ['speed']);
  f.act(f.owner, 'requestEndGame'); rejectsAtomically(f, () => f.respond('reinforcement', { reinforcement: 'speed' }), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); f.respond('reinforcement', { reinforcement: 'speed' }); assert.equal(f.room().pendingBattle.kind, 'defense');
});

test('Rocky Helmet damages the actual source after positive damage, has no Dodge window and keeps its real card attached', t => {
  const f = fixture(t); f.play(); const held = f.item(f.target); const command = f.attack(); f.respond();
  assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.room().pendingBattle, null);
  assert.deepEqual(f.player(f.target).active.item, held); assert.equal(occurrences(f, held.id), 1); assert.equal(f.room().discardPile.filter(c => c.id === command).length, 1);
  const dodged = fixture(t); dodged.play(); dodged.item(dodged.target); dodged.attack(); dodged.respond('dodge', { cardId: dodged.supply(dodged.target, 'dodge') }); assert.equal(dodged.player(dodged.leader).active.damage, 0);
});

test('Helmet uses source Blaze and Guts, receiving defense, and item damage is not capped by burn', t => {
  for (const [family, status, expected] of [['charmander', 'burn', 3], ['machop', 'burn', 2], ['mankey', 'burn', 1]]) {
    const f = fixture(t); f.play(); f.seed(f.target, family, 1, { hpBonus: 10, damage: family === 'charmander' ? 10 : 0, status }); f.item(f.target); f.attack(); f.respond();
    assert.equal(f.player(f.leader).active.damage, expected, `${family} item damage`);
    if (f.room().pendingBattle) f.drain();
  }
  const f = fixture(t); f.play(); f.player(f.leader).active.reinforcements = ['defense']; f.seed(f.target, 'machop', 1, { hpBonus: 10, status: 'poison' }); f.item(f.target); f.attack(); f.respond(); assert.equal(f.player(f.leader).active.damage, 1); assert.deepEqual(f.player(f.leader).active.reinforcements, []);
});

test('cyclic Helmets continue naturally until defeat and give reward/deployment to the actual nested damage source', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'mankey', 1, { hpBonus: 10 }); const source = f.item(f.leader), target = f.item(f.target); const original = f.player(f.target).active.instanceId, hand = f.player(f.leader).hand.length; const command = f.attack();
  f.respond(); assert.equal(f.room().pendingBattle.kind, 'rescue'); f.drain();
  assert.equal(f.player(f.target).reserve.instanceId, original); assert.equal(f.player(f.target).reserve.defeated, true); assert.equal(f.player(f.target).reserve.item, undefined);
  assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.target).active.item, undefined); assert.equal(f.player(f.leader).active.damage, 1);
  assert.equal(f.player(f.leader).hand.length, hand + 1); assert.equal(occurrences(f, target.id), 1); assert.equal(occurrences(f, source.id), 1); assert.equal(f.room().discardPile.filter(c => c.id === command).length, 1);
  assert.equal(f.room().resolution, null);
  const g = fixture(t); g.play(); g.seed(g.leader, 'mankey', 1, { hpBonus: 10 }); const first = g.item(g.leader), second = g.item(g.target), physicalCommand = g.attack(); g.respond();
  const suspended = g.room().pendingBattle; assert.equal(suspended.kind, 'rescue');
  const restarted = new RoomStore({ dataDir: g.dir, catalogue, now: g.now });
  assert.equal(restarted.view(g.owner.code, g.byId(suspended.actorId).token).view.pendingBattle.id, suspended.id);
  let serial = 0;
  while (restarted.rooms.get(g.owner.code).pendingBattle && serial < 12) {
    const state = restarted.rooms.get(g.owner.code), pending = state.pendingBattle;
    assert.equal(pending.kind, 'rescue');
    restarted.action(g.owner.code, g.byId(pending.actorId).token, { id: `nested-rescue-restart-${++serial}`, revision: state.revision, type: 'respondBattle', decisionId: pending.id, choice: 'pass' });
  }
  const state = restarted.rooms.get(g.owner.code), resumedCards = [state.drawPile, state.discardPile, ...state.players.flatMap(p => [p.hand, [p.active?.item, p.reserve?.item].filter(Boolean)])].flat();
  assert.equal(state.pendingBattle, null); assert.equal(state.resolution, null);
  assert.equal(state.players.find(p => p.id === g.target.playerId).reserve.defeated, true);
  for (const id of [first.id, second.id, physicalCommand]) assert.equal(resumedCards.filter(c => c.id === id).length, 1);
});

test('Slowpoke chooses Oblivious before Helmet or Helmet before nested damage', t => {
  for (const first of ['oblivious', 'rocky-helmet']) {
    const f = fixture(t); f.play(); f.seed(f.target, 'slowpoke', 1, { hpBonus: 10 }); f.item(f.target); f.item(f.leader); f.attack(); f.respond();
    assert.equal(f.room().pendingBattle.kind, 'effects'); assert.equal(f.room().pendingBattle.actorId, f.target.playerId); assert.deepEqual(new Set(f.room().pendingBattle.effects), new Set(['oblivious', 'rocky-helmet']));
    f.respond('effect', { effect: first });
    if (first === 'rocky-helmet') { assert.equal(f.player(f.target).active.damage, 3); assert.equal(f.room().pendingBattle.kind, 'effects'); f.respond('effect', { effect: 'oblivious' }); }
    f.drain(); assert.equal(f.player(f.target).active.damage, first === 'oblivious' ? 2 : 3); assert.equal(f.view(f.target).players.find(p => p.id === f.target.playerId).active.damageProtected, true);
  }
});

test('Static and Helmet are ordered by their holder after source judgments and Static can still be declined', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'charmander', 1, { hpBonus: 10 }); f.seed(f.target, 'pikachu', 1, { hpBonus: 10 }); f.item(f.target); f.room().drawPile.push(f.makeCard('dodge', 'intense-sun')); f.attack(); f.respond();
  assert.equal(f.player(f.target).active.status, 'burn'); assert.equal(f.room().pendingBattle.kind, 'effects'); assert.deepEqual(new Set(f.room().pendingBattle.effects), new Set(['static', 'rocky-helmet']));
  f.respond('effect', { effect: 'static' }); assert.equal(f.room().pendingBattle.kind, 'static'); f.respond(); f.drain();
  assert.equal(f.player(f.leader).active.status, null); assert.equal(f.player(f.leader).active.damage, 1);
});

test('Synchronize can claim the real command while Helmet stays attached, and item damage cannot claim the item card', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'abra', 2, { hpBonus: 10 }); const held = f.item(f.target); const command = f.attack(); f.respond();
  assert.equal(f.room().pendingBattle.kind, 'effects'); assert.deepEqual(new Set(f.room().pendingBattle.effects), new Set(['synchronize', 'rocky-helmet']));
  f.respond('effect', { effect: 'synchronize' }); f.respond('trait'); f.drain(); assert.equal(f.player(f.target).hand.filter(c => c.id === command).length, 1); assert.equal(f.room().discardPile.some(c => c.id === command), false); assert.deepEqual(f.player(f.target).active.item, held);
  const g = fixture(t); g.play(); g.seed(g.leader, 'abra', 2, { hpBonus: 10 }); g.item(g.target); g.attack(); g.respond(); assert.equal(g.room().pendingBattle, null); assert.equal(g.player(g.leader).active.damage, 1);
});

test('Squirtle suppression lasts the entire move, keeps carried items and grants no Defiant or Sand Veil', t => {
  for (const level of [2, 3]) for (const family of ['sandshrew', 'mankey']) {
    const f = fixture(t); f.play(); f.seed(f.leader, 'squirtle', level); f.seed(f.target, family, 1, { hpBonus: 10 }); const held = f.item(f.target); f.item(f.leader);
    const targets = level === 3 ? [f.target, f.leader] : [f.target]; f.attack(targets);
    assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.room().pendingBattle.canTrait, false); f.respond();
    assert.equal(f.player(f.leader).active.damage, 0); assert.deepEqual(f.player(f.target).active.item, held);
    if (level === 3) { assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond('dodge', { cardId: f.supply(f.leader, 'dodge') }); }
    assert.equal(f.room().pendingBattle, null); assert.equal(f.view(f.target).self.handLimit, 4); assert.equal(occurrences(f, held.id), 1);
  }
});

test('defeated Helmet holder cannot retaliate and actual defeat discards its item without Defiant', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.damage = 1; const held = f.item(f.target); const id = f.player(f.target).active.instanceId; f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'rescue'); f.drain();
  assert.equal(f.player(f.target).reserve.instanceId, id); assert.equal(f.player(f.target).reserve.defeated, true); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.room().discardPile.filter(c => c.id === held.id).length, 1); assert.equal(f.view(f.target).self.handLimit, 4);
});

test('source-free poison has no invented Helmet target while confusion can retaliate against its own source', t => {
  for (const status of ['poison', 'confusion']) {
    const f = fixture(t); f.play(); f.seed(f.target, 'mankey', 1, { status, hpBonus: 3 }); f.item(f.target); finish(f, f.leader);
    // The first nonleader in turn order is this fixture's target.
    assert.equal(f.room().turn.playerId, f.target.playerId);
    if (status === 'poison') { assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.room().pendingBattle, null); }
    else { assert.equal(f.room().pendingBattle.kind, 'rescue'); f.drain(); assert.equal(f.player(f.target).reserve.defeated, true); assert.equal(f.player(f.target).active.damage, 0); }
  }
});

test('mandatory effect choice pauses on timeout, disconnection and votes and survives restart without exposing nested state', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play(); f.seed(f.target, 'slowpoke', 1, { hpBonus: 10 }); f.item(f.target); f.attack(); f.respond(); const pending = f.room().pendingBattle;
  rejectsAtomically(f, () => f.respond('pass')); rejectsAtomically(f, () => f.respond('effect', { effect: 'static' })); rejectsAtomically(f, () => f.respond('effect', { effect: 'oblivious', cardId: 'forged' }));
  f.advance(5_000); const expired = f.view(f.target); assert.equal(expired.pendingBattle.id, pending.id); assert.equal(expired.pendingBattle.clock.pausedReason, 'mandatory'); assert.equal(expired.pendingBattle.clock.remainingMs, 0);
  f.advance(CONNECTED_MS + 1_000); assert.equal(f.view(f.leader).pendingBattle.clock.pausedReason, 'disconnected'); f.seats.forEach(who => f.view(who));
  f.act(f.owner, 'requestEndGame'); assert.equal(f.view(f.target).pendingBattle.clock.pausedReason, 'vote'); rejectsAtomically(f, () => f.respond('effect', { effect: 'oblivious' }), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd');
  const restarted = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); const view = restarted.view(f.owner.code, f.target.token).view;
  assert.equal(view.pendingBattle.id, pending.id); assert.deepEqual(view.pendingBattle.effects, pending.effects); assert.equal(view.resolutionStack, undefined); assert.equal(view.resolution, undefined);
  const input = { id: 'restored-effects-choice', revision: view.revision, type: 'respondBattle', decisionId: pending.id, choice: 'effect', effect: 'oblivious' };
  restarted.action(f.owner.code, f.target.token, input); const committed = structuredClone(restarted.rooms.get(f.owner.code)); restarted.action(f.owner.code, f.target.token, input); assert.deepEqual(restarted.rooms.get(f.owner.code), committed);
});

test('immediate victory during nested Helmet defeat cuts pending effects and conserves physical command and items', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'mankey', 1, { damage: 2 }); f.player(f.leader).reserve.defeated = true;
  f.seed(f.target, 'mankey', 1, { hpBonus: 10 }); const held = f.item(f.target), source = f.item(f.leader), command = f.attack(); f.respond(); f.drain();
  assert.equal(f.room().status, 'finished'); assert.equal(f.room().turn, null); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null);
  assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().discardPile.filter(c => c.id === command).length, 1); assert.equal(occurrences(f, held.id), 1); assert.equal(occurrences(f, source.id), 1);
});

test('nested Helmet Static judgment accepts global Drought then resumes retaliation against the original source through defeat', t => {
  const f = fixture(t); f.play(); f.seed(f.leader, 'pikachu', 2, { hpBonus: 10 });
  const vulpix = f.seats.find(who => who !== f.leader && who !== f.target); f.seed(vulpix, 'vulpix', 1);
  const sourceItem = f.item(f.leader), targetItem = f.item(f.target), originalTarget = f.player(f.target).active.instanceId;
  const nestedJudgment = f.makeCard('dodge', 'thunderstorm'), moveJudgment = f.makeCard('dodge', 'intense-sun');
  f.room().drawPile.push(nestedJudgment, moveJudgment);
  const command = f.attack(); f.respond();
  assert.equal(f.room().pendingBattle.kind, 'judgment'); assert.equal(f.room().pendingBattle.actorId, vulpix.playerId);
  f.respond(); // The move's after-dealing judgment completes before receiving effects.
  assert.equal(f.room().pendingBattle.kind, 'effects'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId);
  assert.deepEqual(new Set(f.room().pendingBattle.effects), new Set(['static', 'rocky-helmet']));
  assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.player(f.target).active.damage, 2);
  f.respond('effect', { effect: 'static' }); assert.equal(f.room().pendingBattle.kind, 'static'); f.respond('trait');
  assert.equal(f.room().pendingBattle.kind, 'judgment'); assert.equal(f.room().pendingBattle.actorId, vulpix.playerId); assert.equal(f.room().pendingBattle.judgmentCard.weather, 'thunderstorm');
  const replacement = f.supply(vulpix, 'dodge', 'clear'); f.respond('replace', { cardId: replacement });
  assert.equal(f.player(vulpix).hand.filter(card => card.id === nestedJudgment.id).length, 1);
  assert.equal(f.room().discardPile.filter(card => card.id === replacement).length, 1);
  // The remaining Helmet resumes after the judgment and defeats that same nested source.
  assert.equal(f.room().pendingBattle.kind, 'rescue'); assert.equal(f.player(f.target).active.status, 'paralysis'); f.drain();
  assert.equal(f.player(f.target).reserve.instanceId, originalTarget); assert.equal(f.player(f.target).reserve.defeated, true);
  assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.target).active.status, null); assert.equal(f.player(f.target).active.item, undefined);
  assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.room().resolution, null);
  for (const id of [sourceItem.id, targetItem.id, command]) assert.equal(occurrences(f, id), 1);
});
