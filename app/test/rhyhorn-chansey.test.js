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
  const dir = mkdtempSync(join(root, 'rhyhorn-chansey-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `rhyhorn-chansey-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates, activeId = candidates.find(id => id !== 'koffing'); act(who, 'selectPokemon', { activeId, reserveId: candidates.find(id => id !== activeId) }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-rhyhorn-chansey-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private Rhyhorn Chansey card ${serial}` } });
  room().drawPile = Array.from({ length: 48 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const top = (...weather) => { const cards = weather.map(value => makeCard('reveal-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const judgments = (...weather) => { const cards = weather.map(value => makeCard('judgment-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id), third = seats.find(who => who !== leader && who !== target);
  const play = (family = 'rhyhorn', level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, family, level); };
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

const reckless = (f, hpLoss, who = f.leader) => f.act(who, 'useTrait', { hpLoss });
const enterEnd = f => { f.act(f.leader, 'finishPlay'); while (f.room().turn.phase === 'discard') f.act(f.leader, 'discard', { cardId: f.player(f.leader).hand[0].id }); };
const start = (f, who = f.leader) => f.store.startTurn(f.room(), who.playerId, f.room().turn.number + 1);
const drawToPlay = (f, who = f.leader) => { while (f.room().turn.drawRemaining) f.act(who, 'draw'); };
const potionPermission = (f, restricted) => {
  const pending = f.room().pendingBattle; assert.equal(pending.kind, 'rescue');
  for (const who of f.seats) {
    const view = f.view(who).pendingBattle; assert.equal(view.canUsePotion, restricted ? pending.actorId === pending.targetId : true);
    if (restricted) assert.equal(view.potionRestrictedToOwner, true);
  }
};

// All scenarios use the shared room/identity/candidate protocol and actual unique cards.
test('Rhyhorn reviewed faces expose 3/4/5 HP and the exact one-command move progression', t => {
  const entry = catalogue.entries.find(entry => entry.id === 'rhyhorn'); assert.deepEqual(entry.levels.map(face => face.hp), [3, 4, 5]);
  assert.deepEqual(entry.levels.map(face => face.effectStatus), Array(3).fill('combat-preview'));
  for (const [level, name] of [[1, 'Rock Throw'], [2, 'Rock Slide'], [3, 'Stone Edge']]) {
    const f = fixture(t); f.play('rhyhorn', level); const battle = f.view(f.leader).self.battle;
    assert.equal(battle.canCommand, true); assert.equal(battle.canTrait, true); assert.equal(battle.moves.length, 1); assert.equal(battle.move.printedValue, level); assert.equal(battle.move.name.en, name);
    assert.equal(battle.moves[0].condition.kind, 'command'); assert.equal(battle.move.maxTargets, 1); assert.equal(battle.moves[0].effectKind, 'fainting-owner-potion-only');
  }
});

test('Chansey faces retain reviewed HP and reference text while remaining unavailable in battle', t => {
  const entry = catalogue.entries.find(entry => entry.id === 'chansey'); assert.deepEqual(entry.levels.map(face => face.hp), [3, 4, 5]);
  for (const level of [1, 2, 3]) {
    const face = entry.levels.find(face => face.level === level); assert.notEqual(face.effectStatus, 'combat-preview'); assert.ok(face.abilityText?.en); assert.equal(face.traitName.en, 'Healer'); assert.ok(face.moves.length > 0);
    const f = fixture(t); f.play('chansey', level); const battle = f.view(f.leader).self.battle; assert.equal(battle.canCommand, false); assert.equal(battle.canTrait, false);
    const command = f.supply(f.leader); rejectsAtomically(f, () => f.attack({ cardId: command })); rejectsAtomically(f, () => reckless(f, 0));
  }
});

test('catalogue counts distinguish executable Rhyhorn from reference-only Chansey', () => {
  assert.ok(catalogue.metadata.combatSupportedGroups >= 29); assert.ok(catalogue.metadata.effectReviewedGroups >= 30); assert.ok(catalogue.metadata.effectReviewedFaces >= 90);
  const executable = catalogue.entries.filter(entry => entry.levels.every(face => face.effectStatus === 'combat-preview')); assert.equal(executable.length, catalogue.metadata.combatSupportedGroups); assert.equal(executable.flatMap(entry => entry.levels).length, catalogue.metadata.combatSupportedGroups*3);
  const roster = JSON.parse(readFileSync(new URL('../content/selection-roster.json', import.meta.url), 'utf8'));
  assert.equal(roster.entries.filter(entry => entry.supportedEffects).length, catalogue.metadata.combatSupportedGroups);
  for (const [id, supportedEffects, effectStatus] of [['rhyhorn', true, 'existing-reviewed-combat-preview'], ['chansey', false, 'reference-only']]) {
    const entry = roster.entries.find(entry => entry.id === id); assert.ok(entry); assert.equal(entry.supportedEffects, supportedEffects); assert.equal(entry.effectStatus, effectStatus); assert.equal(Object.hasOwn(entry, 'combatSupported'), false);
  }
});

test('unsupported Chansey cannot be a command target and reserve Healer does not grant a trait action', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'chansey', 3); const command = f.supply(f.leader); assert.equal(f.view(f.leader).self.battle.legalTargetIds.includes(f.target.playerId), false);
  rejectsAtomically(f, () => f.attack({ cardId: command })); f.player(f.leader).active.catalogueId = 'squirtle'; f.player(f.leader).reserve.catalogueId = 'chansey'; assert.equal(f.view(f.leader).self.battle.canTrait, false);
});

test('each Rhyhorn command spends one real Take this and deals exactly its printed damage', t => {
  for (const level of [1, 2, 3]) {
    const f = fixture(t); f.play('rhyhorn', level); const command = f.supply(f.leader), actual = structuredClone(f.player(f.leader).hand[0]), top = f.room().drawPile.at(-1).id; f.attack({ cardId: command }); f.respond();
    assert.equal(f.player(f.target).active.damage, level); assert.equal(f.player(f.target).active.status, null); assert.deepEqual(f.room().discardPile.find(card => card.id === command), actual); assert.equal(countCard(f.room(), command), 1); assert.equal(f.room().drawPile.at(-1).id, top);
    assert.equal(f.view(f.leader).self.battle.canCommand, false); assert.equal(f.view(f.leader).self.battle.canTrait, true);
  }
});

test('Rhyhorn commands retain ordinary target range and require an actual own command card', t => {
  const f = fixture(t, { count: 6 }); f.play('rhyhorn', 3); const command = f.supply(f.leader), wrong = f.supply(f.leader, 'event'), foreign = f.supply(f.target), legal = f.view(f.leader).self.battle.legalTargetIds;
  assert.equal(legal.length, 3); const far = f.seats.find(who => !legal.includes(who.playerId)); assert.ok(far);
  for (const cardId of [wrong, foreign, 'forged']) rejectsAtomically(f, () => f.attack({ cardId }));
  rejectsAtomically(f, () => f.attack({ cardId: command, targetIds: [far.playerId] })); rejectsAtomically(f, () => f.attack({ cardId: command, targetIds: [f.target.playerId, f.third.playerId] }));
});

test('Dodge cancels Rhyhorn damage while Power and command use are consumed', t => {
  const f = fixture(t); f.play('rhyhorn', 3); f.player(f.leader).active.reinforcements = ['power']; f.player(f.target).active.reinforcements = ['defense']; const command = f.supply(f.leader), dodge = f.supply(f.target, 'dodge');
  f.attack({ cardId: command }); f.respond('dodge', { cardId: dodge }); assert.equal(f.player(f.target).active.damage, 0); assert.deepEqual(f.player(f.leader).active.reinforcements, []); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']);
  for (const id of [command, dodge]) assert.equal(countCard(f.room(), id), 1); assert.equal(f.view(f.leader).self.battle.canCommand, false);
});

test('Power, burn and Defense still modify the Rhyhorn move damage normally', t => {
  for (const [status, defense, expected] of [[null, false, 4], [null, true, 1], ['burn', false, 1]]) {
    const f = fixture(t); f.play('rhyhorn', 3); f.player(f.leader).active.status = status; f.player(f.leader).active.reinforcements = ['power']; if (defense) f.player(f.target).active.reinforcements = ['defense']; f.attack(); f.respond();
    assert.equal(f.player(f.target).active.damage, expected); if (defense) assert.deepEqual(f.player(f.target).active.reinforcements, []);
  }
});

test('Rhyhorn moves follow ordinary once-per-move and same command-using instance limits', t => {
  const f = fixture(t); f.play('rhyhorn', 2); f.player(f.leader).reserve.catalogueId = 'rhyhorn'; f.player(f.leader).reserve.level = 2; f.attack(); f.respond(); const command = f.supply(f.leader);
  rejectsAtomically(f, () => f.attack({ cardId: command })); f.act(f.leader, 'switchPokemon'); assert.equal(f.view(f.leader).self.battle.canCommand, false); rejectsAtomically(f, () => f.attack({ cardId: command }));
});

test('Reckless projects an exact numeric representability limit without capping current HP', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.damage = 2; const trait = f.view(f.leader).self.battle.trait;
  assert.deepEqual(trait, { kind: 'reckless', name: { zh: '舍身', en: 'Reckless' }, maxHpLoss: Number.MAX_SAFE_INTEGER - 2 }); assert.ok(trait.maxHpLoss > 3);
});

test('Reckless loses declared HP then gains exactly the next actual cards on every level', t => {
  for (const level of [1, 2, 3]) {
    const f = fixture(t); f.play('rhyhorn', level); const cards = f.top('rain', 'thunderstorm'); reckless(f, 2);
    assert.equal(f.player(f.leader).active.damage, 2); assert.deepEqual(f.player(f.leader).hand, cards); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null); assert.equal(f.room().judgment ?? null, null);
    for (const card of cards) assert.equal(countCard(f.room(), card.id), 1);
  }
});

test('zero Reckless spends the instance use while moving no cards or HP', t => {
  const f = fixture(t); f.play(); const top = f.room().drawPile.at(-1).id, before = allCards(f.room()).length; reckless(f, 0);
  assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(f.room().drawPile.at(-1).id, top); assert.equal(allCards(f.room()).length, before);
  assert.equal(f.view(f.leader).self.battle.canTrait, false); assert.deepEqual(f.room().turn.traitsUsed, [f.player(f.leader).active.instanceId]); rejectsAtomically(f, () => reckless(f, 1));
});

test('Reckless rejects missing, negative, fractional, string and unsafe loss declarations atomically', t => {
  const f = fixture(t); f.play();
  for (const hpLoss of [undefined, null, -1, 0.5, '1', true, [], {}, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) rejectsAtomically(f, () => reckless(f, hpLoss));
});

test('Reckless rejects safe loss values whose accumulated injury would overflow', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.damage = 2; rejectsAtomically(f, () => reckless(f, Number.MAX_SAFE_INTEGER));
  assert.equal(f.view(f.leader).self.battle.canTrait, true); assert.equal(f.player(f.leader).active.damage, 2);
});

test('the largest representable injury is accepted and its draw is bounded by real availability', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.damage = 2; f.room().drawPile = []; f.room().discardPile = []; const cards = f.top('rain'); const original = f.player(f.leader).active.instanceId;
  reckless(f, Number.MAX_SAFE_INTEGER - 2); assert.equal(f.room().pendingBattle.kind, 'rescue'); assert.equal(f.player(f.leader).active.damage, Number.MAX_SAFE_INTEGER); f.drain();
  assert.equal(f.player(f.leader).reserve.instanceId, original); assert.equal(f.player(f.leader).reserve.defeated, true); assert.deepEqual(f.player(f.leader).hand, cards); assert.equal(f.room().resolution, null);
});

test('Reckless accepts no card, target, weather, move or effect selectors', t => {
  const f = fixture(t); f.play(); const cardId = f.supply(f.leader);
  for (const extra of [{ cardIds: [] }, { cardIds: [cardId] }, { cardId }, { targetId: f.target.playerId }, { effectChoice: 'heal' }, { moveIndex: 0 }, { weather: 'rain' }]) rejectsAtomically(f, () => f.act(f.leader, 'useTrait', { hpLoss: 1, ...extra }));
});

test('other traits and attack actions reject the Rhyhorn-only hpLoss declaration', t => {
  for (const family of ['bulbasaur', 'magnemite', 'psyduck', 'squirtle', 'exeggcute']) {
    const f = fixture(t); f.play(family); rejectsAtomically(f, () => f.act(f.leader, 'useTrait', { hpLoss: 0, ...(family === 'magnemite' ? { cardIds: [] } : {}) }));
  }
  const f = fixture(t); f.play(); const command = f.supply(f.leader); rejectsAtomically(f, () => f.attack({ cardId: command, hpLoss: 1 }));
});

test('Reckless is available only in the active owner Play phase', t => {
  for (const phase of ['draw', 'discard', 'end']) {
    const f = fixture(t); f.play(); f.room().turn.phase = phase; assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => reckless(f, 1));
  }
  const f = fixture(t); f.play(); f.seed(f.target, 'rhyhorn'); rejectsAtomically(f, () => reckless(f, 1, f.target), 'NOT_YOUR_TURN');
});

test('reserve, defeated and eliminated Rhyhorn cannot invoke Reckless', t => {
  for (const exclusion of ['reserve', 'defeated', 'eliminated']) {
    const f = fixture(t); f.play(); if (exclusion === 'reserve') { f.player(f.leader).active.catalogueId = 'clefairy'; f.player(f.leader).reserve.catalogueId = 'rhyhorn'; } else if (exclusion === 'defeated') f.player(f.leader).active.defeated = true; else f.player(f.leader).eliminated = true;
    assert.equal(f.view(f.leader).self.battle?.canTrait ?? false, false); rejectsAtomically(f, () => reckless(f, 1));
  }
});

test('special statuses and move/switch blocks do not prevent the optional non-move Reckless action', t => {
  for (const status of ['burn', 'paralysis', 'poison', 'confusion', 'sleep', 'flinch']) {
    const f = fixture(t); f.play(); f.player(f.leader).active.status = status; Object.assign(f.room().turn, { movesBlocked: true, blockedMoveIds: [f.player(f.leader).active.instanceId], switchBlocked: true });
    assert.equal(f.view(f.leader).self.battle.canTrait, true); reckless(f, 1); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.player(f.leader).active.status, status); assert.equal(f.player(f.leader).hand.length, 1);
  }
});

test('HP loss ignores Power, Defense and damage immunity without spending those protections', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.reinforcements = ['power', 'defense']; f.room().turn.damageImmunityIds = [f.player(f.leader).active.instanceId]; reckless(f, 3);
  assert.equal(f.player(f.leader).active.damage, 3); assert.deepEqual(f.player(f.leader).active.reinforcements, ['power', 'defense']); assert.equal(f.player(f.leader).hand.length, 3);
});

test('HP loss never triggers held-item damage, other trainers receiving traits or a weather judgment', t => {
  const f = fixture(t); f.play(); f.helmet(f.leader); f.seed(f.target, 'pikachu'); f.seed(f.third, 'grimer'); f.supply(f.target); f.supply(f.third); const top = f.room().drawPile.at(-3).id; reckless(f, 2);
  assert.equal(f.player(f.leader).active.damage, 2); assert.equal(f.player(f.leader).active.status, null); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.third).active.damage, 0); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().drawPile.at(-1).id, top);
});

test('Reckless does not spend a command, a move use, switching or any card from hand', t => {
  const f = fixture(t); f.play(); const cardId = f.supply(f.leader, 'dodge'), actual = structuredClone(f.player(f.leader).hand[0]); reckless(f, 1);
  assert.deepEqual(f.player(f.leader).hand.find(card => card.id === cardId), actual); assert.equal(f.room().turn.commandCreatureId, null); assert.deepEqual(f.room().turn.usedMoves, []); assert.equal(f.room().turn.switchUsed, false); assert.equal(f.view(f.leader).self.battle.canCommand, true);
});

test('commanding before Reckless or after Reckless leaves the independent action available', t => {
  for (const first of ['command', 'trait']) {
    const f = fixture(t); f.play(); if (first === 'command') { f.attack(); f.respond(); reckless(f, 1); } else { reckless(f, 1); f.attack(); f.respond(); }
    assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.view(f.leader).self.battle.canTrait, false); assert.equal(f.view(f.leader).self.battle.canCommand, false);
  }
});

test('Reckless is once per Pokémon instance and evolution does not reset its use', t => {
  const f = fixture(t); f.play(); reckless(f, 1); const original = f.player(f.leader).active.instanceId; f.player(f.leader).active.level = 2; assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => reckless(f, 1)); assert.deepEqual(f.room().turn.traitsUsed, [original]);
});

test('a distinct reserve Rhyhorn has its own Reckless use and switching back cannot repeat the first', t => {
  const f = fixture(t); f.play(); f.player(f.leader).reserve.catalogueId = 'rhyhorn'; const original = f.player(f.leader).active.instanceId; reckless(f, 1); f.act(f.leader, 'switchPokemon');
  assert.equal(f.view(f.leader).self.battle.canTrait, true); const second = f.player(f.leader).active.instanceId; reckless(f, 2); assert.deepEqual(new Set(f.room().turn.traitsUsed), new Set([original, second]));
  f.room().turn.switchUsed = false; f.act(f.leader, 'switchPokemon'); assert.equal(f.view(f.leader).self.battle.canTrait, false);
});

test('Reckless resets on a later own turn without refunding prior HP loss', t => {
  const f = fixture(t); f.play(); reckless(f, 1); start(f); drawToPlay(f); assert.equal(f.view(f.leader).self.battle.canTrait, true); reckless(f, 1); assert.equal(f.player(f.leader).active.damage, 2);
});

test('Reckless draws up to the real finite pile and refills discards without inventing cards', t => {
  for (const available of [0, 1, 3]) {
    const f = fixture(t); f.play(); f.room().drawPile = []; f.room().discardPile = []; const cards = f.top(...Array(available).fill('rain')); reckless(f, 5);
    assert.deepEqual(f.player(f.leader).hand, cards); assert.equal(f.room().drawPile.length, 0); assert.equal(f.room().discardPile.length, 0); assert.equal(f.view(f.leader).self.battle.canTrait, false);
  }
  const f = fixture(t); f.play(); f.room().drawPile = []; const card = f.makeCard('event', 'clear'); f.room().discardPile = [card]; reckless(f, 2); assert.deepEqual(f.player(f.leader).hand, [card]); assert.equal(countCard(f.room(), card.id), 1);
});

test('lethal Reckless pauses its draw until the entire rescue sequence has ended', t => {
  const f = fixture(t); f.play(); Object.assign(f.player(f.leader).active, { hpBonus: 0, damage: 1 }); const original = f.player(f.leader).active.instanceId, incoming = f.player(f.leader).reserve.instanceId, cards = f.top('rain', 'clear'); reckless(f, 2);
  assert.equal(f.player(f.leader).active.damage, 3); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(f.room().pendingBattle.kind, 'rescue'); assert.equal(f.room().resolution.kind, 'hp-loss');
  assert.equal(f.room().resolution.sourceId, null); assert.equal(f.room().resolution.actualDamage, 0); assert.equal(f.room().resolution.targetCreatureId, original); assert.deepEqual(f.room().resolution.lossDraw, { playerId: f.leader.playerId, count: 2 });
  f.respond(); assert.equal(f.player(f.leader).hand.length, 0); f.drain(); assert.equal(f.player(f.leader).active.instanceId, incoming); assert.deepEqual(f.player(f.leader).hand, cards); assert.equal(f.player(f.leader).reserve.defeated, true);
});

test('loss greater than current HP is permitted and still draws the full declared amount for a surviving trainer', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.hpBonus = 0; reckless(f, 5); assert.equal(f.room().pendingBattle.kind, 'rescue'); assert.equal(f.player(f.leader).active.damage, 5); f.drain();
  assert.equal(f.player(f.leader).hand.length, 5); assert.equal(f.player(f.leader).reserve.defeated, true); assert.equal(f.player(f.leader).active.damage, 0);
});

test('lethal HP loss awards no defeat-reward card and causes no damage aftereffects', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.hpBonus = 0; f.seed(f.target, 'nidoran-m'); f.seed(f.third, 'pikachu'); const hands = [structuredClone(f.player(f.target).hand), structuredClone(f.player(f.third).hand)], before = f.room().drawPile.length;
  reckless(f, 3); f.drain(); assert.equal(f.room().drawPile.length, before - 3); assert.deepEqual(f.player(f.target).hand, hands[0]); assert.deepEqual(f.player(f.third).hand, hands[1]); assert.equal(f.player(f.leader).active.status, null); assert.equal(f.player(f.leader).hand.length, 3);
});

test('after lethal loss a newly deployed Meowth receives one shared Pickup bonus for the single draw batch', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.hpBonus = 0; f.player(f.leader).reserve.catalogueId = 'meowth'; f.player(f.leader).reserve.level = 2; const cards = f.top('rain', 'clear', 'thunderstorm', 'rain'); reckless(f, 3); f.drain();
  assert.deepEqual(f.player(f.leader).hand, cards); assert.deepEqual(f.room().turn.pickupUsedIds, [f.player(f.leader).active.instanceId]); assert.equal(f.player(f.leader).active.catalogueId, 'meowth'); for (const card of cards) assert.equal(countCard(f.room(), card.id), 1);
});

test('an eliminated nonleader gets no deferred Reckless draw and other trainers get no defeat reward', t => {
  const f = fixture(t); f.play(); f.player(f.target).role = 'rocket'; f.player(f.third).role = 'challenger'; start(f, f.target); drawToPlay(f, f.target); f.player(f.target).hand = []; f.seed(f.target, 'rhyhorn', 1, { hpBonus: 0 }); f.player(f.target).reserve.defeated = true;
  const before = f.room().drawPile.length, hands = [structuredClone(f.player(f.leader).hand), structuredClone(f.player(f.third).hand)]; reckless(f, 3, f.target); f.drain();
  assert.equal(f.player(f.target).eliminated, true); assert.equal(f.player(f.target).hand.length, 0); assert.equal(f.room().drawPile.length, before); assert.deepEqual(f.player(f.leader).hand, hands[0]); assert.deepEqual(f.player(f.third).hand, hands[1]); assert.equal(f.room().status, 'playing');
});

test('immediate victory from lethal Reckless cleans the pending loss and never draws afterward', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.hpBonus = 0; f.player(f.leader).reserve.defeated = true; const before = f.room().drawPile.length; reckless(f, 3); f.drain();
  assert.equal(f.room().status, 'finished'); assert.equal(f.room().turn, null); assert.equal(f.room().resolution, null); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().drawPile.length, before); assert.equal(f.player(f.leader).hand.length, 0);
});

test('Reckless exact retries cannot duplicate HP loss or private drawn cards', t => {
  const f = fixture(t); f.play(); const request = f.input('useTrait', { hpLoss: 2 }); f.store.action(f.owner.code, f.leader.token, request); const before = structuredClone(f.room());
  f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), before); assert.equal(f.player(f.leader).active.damage, 2); assert.equal(f.player(f.leader).hand.length, 2); for (const card of f.player(f.leader).hand) assert.equal(countCard(f.room(), card.id), 1);
});

test('restart after nonlethal Reckless preserves HP, its spent use and exact hand identities', t => {
  const f = fixture(t); f.play(); reckless(f, 2); const hand = structuredClone(f.player(f.leader).hand), restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); const view = restored.view(f.owner.code, f.leader.token).view, room = restored.rooms.get(f.owner.code);
  assert.equal(view.self.battle.canTrait, false); assert.equal(room.players.find(player => player.id === f.leader.playerId).active.damage, 2); assert.deepEqual(room.players.find(player => player.id === f.leader.playerId).hand, hand);
});

test('restart during lethal Reckless preserves its private draw continuation and rescue retries settle once', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.hpBonus = 0; const cards = f.top('rain', 'clear', 'thunderstorm'); reckless(f, 3); f.respond(); const saved = structuredClone(f.room().resolution), restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now });
  assert.deepEqual(restored.rooms.get(f.owner.code).resolution, saved); let serial = 0;
  while (restored.rooms.get(f.owner.code).pendingBattle) { const room = restored.rooms.get(f.owner.code), pending = room.pendingBattle, actor = f.byId(pending.actorId), request = { id: `loss-rescue-retry-${++serial}`, revision: room.revision, type: 'respondBattle', decisionId: pending.id, choice: 'pass' }; restored.action(f.owner.code, actor.token, request); const once = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, actor.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), once); }
  const room = restored.rooms.get(f.owner.code); assert.equal(room.resolution, null); assert.deepEqual(room.players.find(player => player.id === f.leader.playerId).hand, cards);
});

test('Reckless private cards and loss continuation never leak to opponents or spectators', t => {
  const f = fixture(t); f.play(); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); const cards = f.top('rain', 'clear'); reckless(f, 2);
  for (const who of [f.target, f.third, observer]) for (const card of cards) { const view = f.view(who); assert.equal(JSON.stringify(view).includes(card.id), false); assert.equal(JSON.stringify(view).includes(card.privateMarker), false); assert.equal(view.resolution, undefined); }
  const g = fixture(t); g.play(); g.player(g.leader).active.hpBonus = 0; reckless(g, 3); for (const who of g.seats) { const view = g.view(who); assert.equal(view.resolution, undefined); assert.equal(view.pendingBattle.lossDraw, undefined); assert.equal(view.pendingBattle.targetCreatureId, undefined); }
});

test('votes and existing battle decisions block Reckless without spending HP or its use', t => {
  const f = fixture(t); f.play(); f.act(f.owner, 'requestEndGame'); rejectsAtomically(f, () => reckless(f, 1), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); f.attack(); rejectsAtomically(f, () => reckless(f, 1), 'RESPONSE_PENDING'); f.drain(); assert.equal(f.view(f.leader).self.battle.canTrait, true);
});

test('Gas suppresses Reckless while leaving Rhyhorn moves and their rescue restriction intact', t => {
  const f = fixture(t); f.play('rhyhorn', 3); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); start(f); f.respond('suppress', { cardId: cost, targetId: f.leader.playerId }); drawToPlay(f); f.player(f.leader).hand = [];
  assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => reckless(f, 1)); f.seed(f.target, 'charmander', 1, { hpBonus: 0 }); f.attack(); f.respond(); potionPermission(f, true); f.drain();
});

test('ordinary rescues retain Potion permission for every actor despite the unsupported Potion implementation', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); f.attack(); f.respond();
  while (f.room().pendingBattle?.kind === 'rescue') { potionPermission(f, false); f.respond(); } assert.equal(f.room().scenario.potionSupported, false);
});

test('each Rhyhorn move restricts Potion permission to the fainting trainer across the whole rescue order', t => {
  for (const level of [1, 2, 3]) {
    const f = fixture(t); f.play('rhyhorn', level); f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 3 - level }); f.attack(); f.respond(); const actors = [];
    while (f.room().pendingBattle?.kind === 'rescue') { actors.push(f.room().pendingBattle.actorId); potionPermission(f, true); f.respond(); }
    assert.deepEqual(actors, f.room().players.filter(player => !player.spectator).map(player => player.id)); assert.equal(f.player(f.target).reserve.defeated, true);
  }
});

test('Potion remains unsupported even for the permitted fainting owner and forged rescue fields reject atomically', t => {
  const f = fixture(t); f.play('rhyhorn', 3); f.seed(f.target, 'charmander', 1, { hpBonus: 0 }); const potion = f.supply(f.target, 'potion'); f.attack(); f.respond(); while (f.room().pendingBattle.actorId !== f.target.playerId) f.respond();
  potionPermission(f, true); for (const payload of [{ choice: 'potion', cardId: potion }, { choice: 'pass', canUsePotion: true }, { choice: 'pass', potionRestrictedToOwner: false }, { choice: 'pass', hpLoss: 0 }, { choice: 'pass', targetId: f.leader.playerId }]) rejectsAtomically(f, () => f.respond(payload.choice, Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'choice')))); f.drain(); assert.equal(f.player(f.target).hand.some(card => card.id === potion), true);
});

test('Reckless self-HP loss has ordinary rescue permissions rather than a Rhyhorn command restriction', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.hpBonus = 0; reckless(f, 3); while (f.room().pendingBattle?.kind === 'rescue') { potionPermission(f, false); f.respond(); } assert.equal(f.player(f.leader).hand.length, 3);
});

test('Rhyhorn command restriction persists through nested Rocky Helmet rescue and cleans with the parent card', t => {
  const f = fixture(t); f.play('rhyhorn', 3); Object.assign(f.player(f.leader).active, { hpBonus: 0, damage: 4 }); f.helmet(f.target); const command = f.supply(f.leader); f.attack({ cardId: command }); f.respond();
  assert.equal(f.room().pendingBattle.kind, 'rescue'); assert.equal(f.room().resolution.kind, 'item'); assert.equal(f.room().resolutionStack.length, 1);
  while (f.room().pendingBattle?.kind === 'rescue') { potionPermission(f, true); f.respond(); } assert.equal(f.room().resolution, null); assert.equal((f.room().resolutionStack || []).length, 0); assert.equal(countCard(f.room(), command), 1);
});

test('Rhyhorn restriction belongs to the resolving card and does not leak into a later unrelated rescue', t => {
  const f = fixture(t); f.play(); f.attack(); f.respond(); f.player(f.leader).active.hpBonus = 0; reckless(f, 3); potionPermission(f, false); f.drain();
});

test('restricted rescue permission survives persistence and remains identical for every viewer', t => {
  const f = fixture(t); f.play('rhyhorn', 3); f.seed(f.target, 'charmander', 1, { hpBonus: 0 }); f.attack(); f.respond(); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true });
  const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); for (const who of [...f.seats, observer]) { const view = restored.view(f.owner.code, who.token).view; assert.equal(view.pendingBattle.potionRestrictedToOwner, true); assert.equal(view.pendingBattle.canUsePotion, view.pendingBattle.actorId === f.target.playerId); }
});

test('response expiry advances only the current Reckless rescue actor and draws after all rescue actors pass', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play(); f.player(f.leader).active.hpBonus = 0; f.advance(1_000); reckless(f, 3); const first = f.room().pendingBattle.id; f.advance(5_000); f.view(f.target);
  assert.notEqual(f.room().pendingBattle.id, first); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(f.room().pendingBattle.clock.remainingMs, 5_000); f.drain(); assert.equal(f.player(f.leader).hand.length, 3); assert.equal(f.view(f.leader).turn.clock.remainingMs, 59_000);
});

test('a completed Reckless hand gain follows ordinary excess-card Discard before End', t => {
  const f = fixture(t); f.play(); reckless(f, 6); assert.equal(f.player(f.leader).hand.length, 6); f.act(f.leader, 'finishPlay'); assert.equal(f.room().turn.phase, 'discard');
  rejectsAtomically(f, () => f.act(f.leader, 'endTurn', { levelUp: false })); while (f.room().turn.phase === 'discard') f.act(f.leader, 'discard', { cardId: f.player(f.leader).hand[0].id }); assert.equal(f.player(f.leader).hand.length, 4); assert.equal(f.room().turn.phase, 'end');
});

test('Chansey reference Healer never upgrades real command damage or exposes Potion execution', t => {
  const f = fixture(t); f.play('squirtle'); f.player(f.third).reserve.catalogueId = 'chansey'; f.player(f.third).reserve.revealed = true; f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); const potion = f.supply(f.third, 'potion'); f.attack(); f.respond();
  assert.equal(f.room().scenario.potionSupported, false); while (f.room().pendingBattle.actorId !== f.third.playerId) f.respond(); rejectsAtomically(f, () => f.respond('potion', { cardId: potion })); f.drain(); assert.equal(f.player(f.target).reserve.defeated, true);
});
