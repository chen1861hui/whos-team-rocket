import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore } from '../server/store.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));

function fixture(t) {
  const root = fileURLToPath(new URL('../.data/', import.meta.url));
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'gastly-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0;
  const store = new RoomStore({ dataDir: dir, catalogue, now: () => 1_000_000 });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, store.join(owner.code, { nickname: 'Trainer 1' }), store.join(owner.code, { nickname: 'Trainer 2' })];
  const room = () => store.rooms.get(owner.code);
  const player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id);
  const view = who => store.view(owner.code, who.token).view;
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, { id: `gastly-${++serial}`, revision: room().revision, type, ...payload }).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds: 0, responseSeconds: 0 });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates; act(who, 'selectPokemon', { activeId: candidates[0], reserveId: candidates[1] }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-gastly-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private Gastly card ${serial}` } });
  room().drawPile = Array.from({ length: 40 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const judgments = (...weather) => room().drawPile.push(...weather.map(value => makeCard('judgment-fixture', value)).reverse());
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id);
  const third = seats.find(who => who !== leader && who !== target);
  const play = (level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, 'gastly', level); };
  const attack = (payload = {}) => act(leader, 'attack', { cardId: payload.cardId ?? supply(leader), targetIds: [target.playerId], ...payload });
  const respond = (choice = 'pass', payload = {}) => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload }); };
  return { store, owner, seats, leader, target, third, room, player, byId, view, act, seed, supply, judgments, play, attack, respond };
}

test('Gastly faces expose reviewed HP, command damage and combat eligibility', t => {
  const entry = catalogue.entries.find(p => p.id === 'gastly');
  assert.deepEqual(entry.levels.map(face => face.hp), [3, 3, 4]);
  assert.deepEqual(entry.levels.map(face => face.effectStatus), ['combat-preview', 'combat-preview', 'combat-preview']);
  for (const [level, damage] of [[1, 1], [2, 2], [3, 3]]) { const f = fixture(t); f.play(level); const battle = f.view(f.leader).self.battle; assert.equal(battle.canCommand, true); assert.equal(battle.moves[0].printedValue, damage); }
});

test('Levitate converts any rainy hand card into an actual Dodge and composes with Keen Eye', t => {
  for (const weather of ['rain', 'thunderstorm']) { const f = fixture(t); f.play(1); f.seed(f.target, 'gastly', 1); const rainy = f.supply(f.target, 'event', weather); f.attack(); f.respond('dodge', { cardId: rainy }); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.target).active.damage, 0); assert.ok(f.room().discardPile.some(card => card.id === rainy)); }
  const f = fixture(t); f.play(1); f.seed(f.target, 'gastly', 1); const clear = f.supply(f.target, 'event', 'clear'); f.attack(); assert.throws(() => f.respond('dodge', { cardId: clear }));
  const keen = fixture(t); keen.play(1); keen.seed(keen.leader, 'pidgey', 2); keen.seed(keen.target, 'gastly', 1); const rainy = keen.supply(keen.target, 'event', 'rain'); keen.attack(); keen.respond('dodge', { cardId: rainy }); assert.equal(keen.room().pendingBattle.kind, 'defense'); keen.respond(); assert.equal(keen.player(keen.target).active.damage, 1);
});

test('Lick paralyzes after positive damage on either rainy judgment only', t => {
  for (const weather of ['rain', 'thunderstorm', 'intense-sun']) { const f = fixture(t); f.play(1); f.judgments(weather); f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.player(f.target).active.status, weather === 'intense-sun' ? null : 'paralysis'); }
});

test('Shadow Ball heavy-rain judgment privately discards one target-trainer card', t => {
  const f = fixture(t); f.play(2); const chosen = f.supply(f.target, 'event', 'clear'), kept = f.supply(f.target, 'dodge', 'rain'); f.judgments('rain'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'hand'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); assert.equal(f.view(f.leader).pendingBattle.choices.length, 2); assert.equal(f.view(f.third).pendingBattle.choices, undefined); const handIndex=f.room().resolution.handChoiceIds.indexOf(chosen); f.respond('card', { handIndex }); assert.deepEqual(f.player(f.target).hand.map(card => card.id), [kept]); assert.ok(f.room().discardPile.some(card => card.id === chosen));
});

test('Cursed Body optionally takes one source-trainer hand card after actual damage', t => {
  const f = fixture(t); while (f.room().turn.drawRemaining) f.act(f.leader, 'draw'); f.seed(f.leader, 'squirtle', 1); f.seed(f.target, 'gastly', 3); f.player(f.leader).hand = []; const command = f.supply(f.leader), chosen = f.supply(f.leader, 'event', 'rain'), kept = f.supply(f.leader, 'dodge'); f.act(f.leader, 'attack', { cardId: command, targetIds: [f.target.playerId] }); f.respond(); assert.equal(f.room().pendingBattle.kind, 'cursed-body'); assert.equal(f.room().pendingBattle.actorId, f.target.playerId); assert.equal(f.view(f.target).pendingBattle.choices.length, 2); assert.equal(f.view(f.third).pendingBattle.choices, undefined); const handIndex=f.room().resolution.handChoiceIds.indexOf(chosen); f.respond('trait', { handIndex }); assert.ok(f.player(f.target).hand.some(card => card.id === chosen)); assert.deepEqual(f.player(f.leader).hand.map(card => card.id), [kept]);
});

test('Hex adds one damage exactly when target has a special status', t => {
  for (const status of [null, 'burn', 'poison', 'confusion', 'paralysis', 'flinch']) { const f = fixture(t); f.play(3); f.seed(f.target, 'squirtle', 1, { status }); f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, status ? 4 : 3); }
});
