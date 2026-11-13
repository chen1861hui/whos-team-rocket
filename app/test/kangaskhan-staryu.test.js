import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore } from '../server/store.js';
import { battleEventTargetAllowed } from '../server/combat.js';


const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));
function fixture(t, { count = 3, turnSeconds = 0, responseSeconds = 0 } = {}) {
  const root = fileURLToPath(new URL('../.data/', import.meta.url));
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'kangaskhan-staryu-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ allowTestDecks: true, dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `kangaskhan-staryu-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates, activeId = candidates.find(id => !['koffing','jynx','tauros'].includes(id)); act(who, 'selectPokemon', { activeId, reserveId: candidates.find(id => id !== activeId) }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-kangaskhan-staryu-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private Kangaskhan Staryu card ${serial}` } });
  room().drawPile = Array.from({ length: 48 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const top = (...weather) => { const cards = weather.map(value => makeCard('reveal-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const judgments = (...weather) => { const cards = weather.map(value => makeCard('judgment-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id), third = seats.find(who => who !== leader && who !== target);
  const play = (family = 'kangaskhan', level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, family, level); };
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

const start = (f, who = f.leader) => f.store.startTurn(f.room(), who.playerId, f.room().turn.number + 1);
const drawToPlay = f => { while (f.room().turn.drawRemaining) f.act(f.leader, 'draw'); };
const illuminate = f => f.act(f.leader, 'useTrait');
const drawSetup = (f, level = 1, extra = {}) => { f.seed(f.leader, 'staryu', level, extra); f.player(f.leader).hand = []; start(f); };
const boost = f => { assert.equal(f.room().pendingBattle.kind, 'double-edge'); f.respond('boost'); };
const prepareEdge = (f, extra = {}) => { f.play('kangaskhan', 2); Object.assign(f.player(f.leader).active, extra); };
const activeView = (f, who, viewer = f.leader) => f.view(viewer).players.find(player => player.id === who.playerId).active;

// Scenarios enter through the real shared-deck room, identity and partner setup.
test('Kangaskhan and Staryu expose reviewed HP, command values and correct target counts', t => {
  for (const [family, hp, values] of [['kangaskhan', [3, 4, 5], [1, 2, 3]], ['staryu', [3, 3, 4], [2, 2, 2]]]) {
    const entry = catalogue.entries.find(entry => entry.id === family); assert.deepEqual(entry.levels.map(face => face.hp), hp); assert.deepEqual(entry.levels.map(face => face.effectStatus), Array(3).fill('combat-preview'));
    for (const level of [1, 2, 3]) { const f = fixture(t); f.play(family, level); const battle = f.view(f.leader).self.battle; assert.equal(battle.canCommand, true); assert.equal(battle.canTrait, false); assert.equal(battle.moves.length, 1); assert.equal(battle.move.printedValue, values[level - 1]); assert.equal(battle.move.maxTargets, family === 'staryu' && level === 3 ? 2 : 1); assert.equal(battle.moves[0].condition.kind, 'command'); }
  }
});

test('catalogue and selection roster retain the Kangaskhan/Staryu baseline and agree on current coverage', () => {
  assert.ok(catalogue.metadata.combatSupportedGroups >= 31); assert.ok(catalogue.metadata.effectReviewedGroups >= 32); assert.ok(catalogue.metadata.effectReviewedFaces >= 96);
  const executable = catalogue.entries.filter(entry => entry.levels.every(face => face.effectStatus === 'combat-preview')); assert.equal(executable.length, catalogue.metadata.combatSupportedGroups); assert.equal(executable.flatMap(entry => entry.levels).length, catalogue.metadata.combatSupportedGroups*3);
  const roster = JSON.parse(readFileSync(new URL('../content/selection-roster.json', import.meta.url), 'utf8')); assert.equal(roster.entries.filter(entry => entry.supportedEffects).length, catalogue.metadata.combatSupportedGroups);
  for (const id of ['kangaskhan', 'staryu']) { const entry = roster.entries.find(entry => entry.id === id); assert.equal(entry.supportedEffects, true); assert.equal(entry.effectStatus, 'existing-reviewed-combat-preview'); }
  assert.ok(catalogue.entries.find(entry => entry.id === 'chansey').levels.every(face => face.effectStatus === 'combat-preview'));
  assert.equal(roster.entries.find(entry => entry.id === 'chansey').supportedEffects, true);
});

test('Early Bird excludes exactly the two named events on each active Kangaskhan level', t => {
  for (const level of [1, 2, 3]) {
    const f = fixture(t); f.play('kangaskhan', level); const pokemon = f.player(f.leader).active;
    for (const event of ['胖丁的表演', '魔墙人偶的戏法']) assert.equal(battleEventTargetAllowed(f.room(), pokemon, event), false);
    for (const event of ['其他事件', '胖丁的表演 ', '胖丁', '', null, undefined]) assert.equal(battleEventTargetAllowed(f.room(), pokemon, event), true);
  }
});

test('Early Bird excludes neither other Pokémon nor reserve, defeated or eliminated Kangaskhan', t => {
  for (const exclusion of ['other', 'reserve', 'defeated', 'eliminated']) {
    const f = fixture(t); f.play(); let pokemon = f.player(f.leader).active;
    if (exclusion === 'other') pokemon.catalogueId = 'squirtle'; else if (exclusion === 'reserve') { f.player(f.leader).reserve.catalogueId = 'kangaskhan'; pokemon = f.player(f.leader).reserve; } else if (exclusion === 'defeated') pokemon.defeated = true; else f.player(f.leader).eliminated = true;
    for (const event of ['胖丁的表演', '魔墙人偶的戏法']) assert.equal(battleEventTargetAllowed(f.room(), pokemon, event), true);
  }
});

test('Early Bird is passive and does not grant a useTrait action or general status immunity', t => {
  const f = fixture(t); f.play(); assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => f.act(f.leader, 'useTrait'));
  f.seed(f.target, 'kangaskhan'); f.seed(f.leader, 'kangaskhan'); f.attack(); f.respond(); assert.equal(f.player(f.target).active.status, 'flinch');
});

test('Fake Out spends one actual command and directly flinches after its one positive damage without judgment', t => {
  const f = fixture(t); f.play(); const command = f.supply(f.leader), actual = structuredClone(f.player(f.leader).hand[0]), top = f.room().drawPile.at(-1).id; f.attack({ cardId: command }); f.respond();
  assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.player(f.target).active.status, 'flinch'); assert.equal(f.room().drawPile.at(-1).id, top); assert.deepEqual(f.room().discardPile.find(card => card.id === command), actual); assert.equal(countCard(f.room(), command), 1); assert.equal(f.view(f.leader).self.battle.canCommand, false);
});

test('Fake Out skips flinch on Dodge, immunity and zero damage and never flinches a deployed reserve', t => {
  for (const prevention of ['dodge', 'immunity', 'shed', 'faint']) {
    const f = fixture(t); f.play(); if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; if (prevention === 'shed') { f.seed(f.target, 'caterpie', 2); f.supply(f.target, 'event'); }
    if (prevention === 'faint') f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); const incoming = f.player(f.target).reserve.instanceId; f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {});
    if (prevention === 'shed') f.respond('shed', { cardIds: ids(f.player(f.target).hand) }); f.drain(); assert.equal(f.player(f.target).active.status, null); if (prevention === 'faint') assert.equal(f.player(f.target).active.instanceId, incoming);
  }
});

test('Fake Out honors Shield Dust immunity and Poison Touch replacement', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'caterpie'); f.attack(); f.respond(); assert.equal(f.player(f.target).active.status, null);
  const g = fixture(t); g.play(); g.seed(g.third, 'grimer'); g.attack(); g.respond(); assert.equal(g.room().pendingBattle.kind, 'poison-touch'); assert.equal(g.room().pendingBattle.status, 'flinch'); g.respond('trait'); assert.equal(g.player(g.target).active.status, 'poison');
});

test('Double Edge opens its source boost choice only after target defense passes and before damage', t => {
  const f = fixture(t); prepareEdge(f); const command = f.supply(f.leader); f.attack({ cardId: command }); assert.equal(f.room().pendingBattle.kind, 'defense'); f.respond();
  assert.equal(f.room().pendingBattle.kind, 'double-edge'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); assert.equal(f.room().pendingBattle.targetId, f.target.playerId); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.leader).active.damage, 0);
  boost(f); assert.equal(f.player(f.target).active.damage, 3); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.room().pendingBattle, null); assert.equal(countCard(f.room(), command), 1);
});

test('passing Double Edge deals printed two damage with no HP loss or extra card cost', t => {
  const f = fixture(t); prepareEdge(f); const retained = f.supply(f.leader, 'event'); f.attack(); f.respond(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.player(f.leader).hand.some(card => card.id === retained), true);
});

test('Double Edge boost adds one before Burn, Power and receiving reduction, with recoil after any positive result', t => {
  for (const [status, power, defense, expected] of [[null, false, false, 3], ['burn', true, false, 1], [null, true, false, 4], [null, false, true, 1]]) {
    const f = fixture(t); prepareEdge(f, { status, reinforcements: power ? ['power'] : [] }); if (defense) f.player(f.target).active.reinforcements = ['defense']; f.attack(); f.respond(); boost(f);
    assert.equal(f.player(f.target).active.damage, expected); assert.equal(f.player(f.leader).active.damage, 1); if (defense) assert.deepEqual(f.player(f.target).active.reinforcements, []);
  }
});

test('Dodge or known damage immunity skips Double Edge boost and causes no recoil', t => {
  for (const prevention of ['dodge', 'immunity']) {
    const f = fixture(t); prepareEdge(f); if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {});
    assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null);
  }
});

test('boosted Double Edge reduced to zero by Shed Skin never causes recoil', t => {
  const f = fixture(t); prepareEdge(f); f.seed(f.target, 'caterpie', 2); const costs = Array.from({ length: 3 }, () => f.supply(f.target, 'event')); f.attack(); f.respond(); boost(f);
  assert.equal(f.room().pendingBattle.kind, 'shed-skin'); f.respond('shed', { cardIds: costs }); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.room().pendingBattle, null);
});

test('Double Edge rejects wrong actor, stale decisions and every extraneous payment or target selector atomically', t => {
  const f = fixture(t); prepareEdge(f); const cardId = f.supply(f.leader, 'event'); f.attack(); f.respond(); const pending = f.room().pendingBattle;
  rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'boost' }), 'NOT_YOUR_DECISION'); rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: 'stale', choice: 'boost' }), 'STALE_DECISION');
  for (const payload of [{ choice: 'trait' }, { choice: 'boost', cardId }, { choice: 'pass', cardId }, { choice: 'boost', cardIds: [] }, { choice: 'boost', targetId: f.third.playerId }, { choice: 'boost', hpLoss: 1 }, { choice: 'boost', effect: 'boost' }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...payload }));
});

test('Double Edge recoil waits until receiving Poison Point has completed', t => {
  const f = fixture(t); prepareEdge(f); f.seed(f.target, 'nidoran-m'); f.attack(); f.respond(); boost(f); assert.equal(f.room().pendingBattle.kind, 'poison-point'); assert.equal(f.player(f.leader).active.damage, 0); f.respond(); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.room().pendingBattle, null);
});

test('Double Edge recoil waits for all receiving effects and nested Helmet damage before creating a source-free HP loss rescue', t => {
  const f = fixture(t); prepareEdge(f, { hpBonus: 0, damage: 2 }); f.seed(f.target, 'cubone'); f.supply(f.target, 'event'); f.helmet(f.target); f.attack(); f.respond(); boost(f);
  assert.equal(f.room().pendingBattle.kind, 'effects'); f.respond('effect', { effect: 'rocky-helmet' }); assert.equal(f.player(f.leader).active.damage, 3); assert.equal(f.room().pendingBattle.kind, 'battle-armor'); f.respond();
  assert.equal(f.room().pendingBattle.kind, 'rescue'); assert.equal(f.player(f.leader).active.damage, 4); assert.equal(f.room().resolution.kind, 'hp-loss'); assert.equal(f.room().resolution.sourceId, null); assert.equal(f.room().resolution.card, null); assert.equal(f.room().resolution.actualDamage, 0); assert.equal(f.room().resolutionStack[0].recoilDone, true); f.drain();
  assert.equal(f.player(f.leader).reserve.defeated, true); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.room().resolution, null);
});

test('Double Edge recoil ignores source Defense and damage immunity and leaves its markers unspent', t => {
  const f = fixture(t); prepareEdge(f, { reinforcements: ['defense'] }); f.room().turn.damageImmunityIds = [f.player(f.leader).active.instanceId]; f.attack(); f.respond(); boost(f);
  assert.equal(f.player(f.leader).active.damage, 1); assert.deepEqual(f.player(f.leader).active.reinforcements, ['defense']); assert.equal(f.player(f.target).active.damage, 3);
});

test('Double Edge recoil creates no defeat reward or HP-loss draw after a surviving reserve deploys', t => {
  const f = fixture(t); prepareEdge(f, { hpBonus: 0, damage: 3 }); const original = f.player(f.leader).active.instanceId, incoming = f.player(f.leader).reserve.instanceId, before = f.room().drawPile.length; f.attack(); f.respond(); boost(f); f.drain();
  assert.equal(f.player(f.leader).active.instanceId, incoming); assert.equal(f.player(f.leader).reserve.instanceId, original); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(f.player(f.target).hand.length, 0); assert.equal(f.room().drawPile.length, before); assert.equal(f.room().resolution, null);
});

test('Double Edge never applies recoil to a reserve after Helmet has already defeated the original source', t => {
  const f = fixture(t); prepareEdge(f, { hpBonus: 0, damage: 3 }); const incoming = f.player(f.leader).reserve.instanceId; f.helmet(f.target); f.attack(); f.respond(); boost(f); f.drain();
  assert.equal(f.player(f.leader).active.instanceId, incoming); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.player(f.leader).reserve.damage, 4); assert.equal(f.player(f.target).active.damage, 3);
});

test('target fainting finishes rescue before Double Edge recoil and original source then loses exactly one HP', t => {
  const f = fixture(t); prepareEdge(f); f.seed(f.target, 'charmander', 1, { hpBonus: 0 }); f.attack(); f.respond(); boost(f); assert.equal(f.room().pendingBattle.kind, 'rescue'); assert.equal(f.player(f.leader).active.damage, 0); f.drain();
  assert.equal(f.player(f.target).reserve.defeated, true); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.room().resolution, null);
});

test('immediate victory from boosted Double Edge cleans its parent command without post-victory recoil', t => {
  const f = fixture(t); prepareEdge(f); f.player(f.target).role = 'rocket'; f.player(f.third).role = 'challenger'; f.player(f.third).eliminated = true; f.seed(f.target, 'charmander', 1, { hpBonus: 0 }); f.player(f.target).reserve.defeated = true; const command = f.supply(f.leader); f.attack({ cardId: command }); f.respond(); boost(f); f.drain();
  assert.equal(f.room().status, 'finished'); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.room().turn, null); assert.equal(f.room().resolution, null); assert.equal(countCard(f.room(), command), 1);
});

test('Double Edge pending boost survives restart and exact boost retries settle damage and recoil once', t => {
  const f = fixture(t); prepareEdge(f); const command = f.supply(f.leader); f.attack({ cardId: command }); f.respond(); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.leader.token).view;
  assert.equal(view.pendingBattle.kind, 'double-edge'); const request = { id: 'restored-edge-boost', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'boost' }; restored.action(f.owner.code, f.leader.token, request); const state = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.leader.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), state);
  assert.equal(state.players.find(player => player.id === f.target.playerId).active.damage, 3); assert.equal(state.players.find(player => player.id === f.leader.playerId).active.damage, 1); assert.equal(countCard(state, command), 1);
});

test('restart during Double Edge recoil rescue resumes its saved child exactly once and cleans the original command', t => {
  const f = fixture(t); prepareEdge(f, { hpBonus: 0, damage: 3 }); const command = f.supply(f.leader); f.attack({ cardId: command }); f.respond(); boost(f); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); assert.equal(restored.rooms.get(f.owner.code).resolution.kind, 'hp-loss');
  let serial = 0; while (restored.rooms.get(f.owner.code).pendingBattle) { const room = restored.rooms.get(f.owner.code), pending = room.pendingBattle, actor = f.byId(pending.actorId), request = { id: `edge-recoil-rescue-${++serial}`, revision: room.revision, type: 'respondBattle', decisionId: pending.id, choice: 'pass' }; restored.action(f.owner.code, actor.token, request); const once = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, actor.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), once); }
  const room = restored.rooms.get(f.owner.code); assert.equal(room.resolution, null); assert.equal(room.players.find(player => player.id === f.leader.playerId).active.damage, 0); assert.equal(countCard(room, command), 1);
});

test('Double Edge boost timeout passes while its response pauses the main turn clock', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); prepareEdge(f); f.advance(1_000); f.attack(); f.respond(); f.advance(5_000); f.view(f.leader); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.room().pendingBattle, null); assert.equal(f.view(f.leader).turn.clock.remainingMs, 59_000);
});

test('Reversal adds one only when the target current HP is strictly greater than its source current HP', t => {
  for (const [sourceDamage, targetDamage, expected] of [[0, 0, 3], [3, 0, 4], [0, 5, 3], [2, 0, 3]]) {
    const f = fixture(t); f.play('kangaskhan', 3); f.player(f.leader).active.damage = sourceDamage; f.player(f.target).active.damage = targetDamage; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, targetDamage + expected);
  }
});

test('Reversal uses current HP at settlement and applies its increase before Burn and receiving Defense', t => {
  const f = fixture(t); f.play('kangaskhan', 3); f.attack(); f.player(f.leader).active.damage = 4; f.respond(); assert.equal(f.player(f.target).active.damage, 4);
  const g = fixture(t); g.play('kangaskhan', 3); g.player(g.leader).active.damage = 4; g.player(g.leader).active.status = 'burn'; g.attack(); g.respond(); assert.equal(g.player(g.target).active.damage, 1);
  const h = fixture(t); h.play('kangaskhan', 3); h.player(h.leader).active.damage = 4; h.player(h.target).active.reinforcements = ['defense']; h.attack(); h.respond(); assert.equal(h.player(h.target).active.damage, 1);
});

test('Illuminate is available on each Staryu level only during its own unfinished Draw phase', t => {
  for (const level of [1, 2, 3]) {
    const f = fixture(t); drawSetup(f, level); const battle = f.view(f.leader).self.battle; assert.equal(battle.canTrait, true); assert.equal(battle.trait.kind, 'illuminate'); assert.equal(f.room().turn.drawRemaining, 2); drawToPlay(f); assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => illuminate(f));
  }
});

test('Illuminate gains the actual next card immediately and leaves both mandatory draws remaining', t => {
  const f = fixture(t); drawSetup(f); const cards = f.top('rain', 'clear', 'thunderstorm'); illuminate(f); assert.deepEqual(f.player(f.leader).hand, cards.slice(0, 1)); assert.equal(f.room().turn.drawRemaining, 2); assert.equal(f.room().turn.phase, 'draw');
  drawToPlay(f); assert.deepEqual(f.player(f.leader).hand, cards); assert.equal(f.room().turn.phase, 'play'); assert.deepEqual(f.room().turn.pickupUsedIds, []); for (const card of cards) assert.equal(countCard(f.room(), card.id), 1);
});

test('Illuminate can be used between mandatory draws and still adds exactly one card', t => {
  const f = fixture(t); drawSetup(f); const cards = f.top('rain', 'clear', 'thunderstorm'); f.act(f.leader, 'draw'); assert.equal(f.room().turn.drawRemaining, 1); illuminate(f); assert.equal(f.room().turn.drawRemaining, 1); assert.deepEqual(f.player(f.leader).hand, cards.slice(0, 2)); f.act(f.leader, 'draw'); assert.deepEqual(f.player(f.leader).hand, cards);
});

test('Flinch reduces mandatory draws to one while Illuminate still adds one independent actual card', t => {
  const f = fixture(t); drawSetup(f, 1, { status: 'flinch' }); assert.equal(f.room().turn.drawRemaining, 1); const cards = f.top('rain', 'clear'); illuminate(f); assert.equal(f.room().turn.drawRemaining, 1); f.act(f.leader, 'draw'); assert.deepEqual(f.player(f.leader).hand, cards); assert.equal(f.room().turn.phase, 'play');
});

test('Illuminate is once per instance per Draw and cannot be repeated by evolution or a retry with a new action id', t => {
  const f = fixture(t); drawSetup(f); const original = f.player(f.leader).active.instanceId; illuminate(f); f.player(f.leader).active.level = 2; assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => illuminate(f)); assert.deepEqual(f.room().turn.traitsUsed, [original]); assert.equal(f.player(f.leader).hand.length, 1);
});

test('Illuminate resets on a later own Draw without changing prior hand identities', t => {
  const f = fixture(t); drawSetup(f); illuminate(f); const first = structuredClone(f.player(f.leader).hand[0]); start(f); assert.equal(f.view(f.leader).self.battle.canTrait, true); illuminate(f); assert.equal(f.player(f.leader).hand.length, 2); assert.deepEqual(f.player(f.leader).hand[0], first);
});

test('Illuminate gains zero on an empty pile, spends its use and preserves mandatory draw count', t => {
  const f = fixture(t); drawSetup(f); f.room().drawPile = []; f.room().discardPile = []; illuminate(f); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(f.room().turn.drawRemaining, 2); assert.equal(f.view(f.leader).self.battle.canTrait, false); assert.equal(f.room().pendingBattle, null); rejectsAtomically(f, () => illuminate(f));
});

test('Illuminate refills one actual discard without judgment or a fictional extra gain', t => {
  const f = fixture(t); drawSetup(f); f.seed(f.third, 'vulpix'); f.room().drawPile = []; const card = f.makeCard('event', 'rain'); f.room().discardPile = [card]; illuminate(f);
  assert.deepEqual(f.player(f.leader).hand, [card]); assert.equal(f.room().judgment ?? null, null); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().discardPile.length, 0); assert.equal(countCard(f.room(), card.id), 1); assert.equal(f.room().turn.drawRemaining, 2);
});

test('Illuminate rejects all extra card, HP-loss, target and move fields before changing cards or use', t => {
  const f = fixture(t); drawSetup(f); const cardId = f.supply(f.leader);
  for (const extra of [{ cardIds: [] }, { cardId }, { hpLoss: 0 }, { targetId: f.target.playerId }, { moveIndex: 0 }, { effectChoice: 'heal' }]) rejectsAtomically(f, () => f.act(f.leader, 'useTrait', extra)); assert.equal(f.view(f.leader).self.battle.canTrait, true);
});

test('other trainers, reserve, defeated and eliminated Staryu cannot invoke Illuminate', t => {
  const f = fixture(t); drawSetup(f); f.seed(f.target, 'staryu'); rejectsAtomically(f, () => f.act(f.target, 'useTrait'), 'NOT_YOUR_TURN');
  for (const exclusion of ['reserve', 'defeated', 'eliminated']) { const g = fixture(t); drawSetup(g); if (exclusion === 'reserve') { g.player(g.leader).active.catalogueId = 'squirtle'; g.player(g.leader).reserve.catalogueId = 'staryu'; } else if (exclusion === 'defeated') g.player(g.leader).active.defeated = true; else g.player(g.leader).eliminated = true; assert.equal(g.view(g.leader).self.battle?.canTrait ?? false, false); rejectsAtomically(g, () => illuminate(g)); }
});

test('Play, Discard and End phase Staryu never offer the unused Illuminate trait', t => {
  for (const phase of ['play', 'discard', 'end']) { const f = fixture(t); drawSetup(f); f.room().turn.phase = phase; f.room().turn.drawRemaining = 0; assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => illuminate(f)); }
});

test('Illuminate remains optional under burn, paralysis and turn-start sleep or confusion move blocks', t => {
  for (const status of ['burn', 'paralysis', 'sleep', 'confusion']) { const f = fixture(t); drawSetup(f, 1, { status }); f.drain(); assert.equal(f.view(f.leader).self.battle.canTrait, true); const before = f.player(f.leader).active.damage; illuminate(f); assert.equal(f.player(f.leader).hand.length, 1); assert.equal(f.player(f.leader).active.damage, before); assert.equal(f.room().turn.drawRemaining, 2); }
});

test('Illuminate exact action retries and restart preserve one gained card, spent use and mandatory draws', t => {
  const f = fixture(t); drawSetup(f); const card = structuredClone(f.room().drawPile.at(-1)), request = f.input('useTrait'); f.store.action(f.owner.code, f.leader.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), once);
  const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.leader.token).view, room = restored.rooms.get(f.owner.code); assert.equal(view.self.battle.canTrait, false); assert.equal(room.turn.drawRemaining, 2); assert.deepEqual(room.players.find(player => player.id === f.leader.playerId).hand, [card]);
});

test('Illuminate drawn identities are private and never appear in opponents or spectator projections', t => {
  const f = fixture(t); drawSetup(f); const card = structuredClone(f.room().drawPile.at(-1)), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); illuminate(f);
  for (const who of [f.target, f.third, observer]) { const view = f.view(who); assert.equal(JSON.stringify(view).includes(card.id), false); assert.equal(JSON.stringify(view).includes(card.privateMarker), false); assert.equal(view.resolution, undefined); }
});

test('closing votes and pending turn-start decisions block Illuminate without spending its use', t => {
  const f = fixture(t); drawSetup(f); f.act(f.owner, 'requestEndGame'); rejectsAtomically(f, () => illuminate(f), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); assert.equal(f.view(f.leader).self.battle.canTrait, true);
  const g = fixture(t); g.seed(g.leader, 'staryu', 1, { status: 'poison' }); g.seed(g.third, 'grimer'); start(g); assert.equal(g.room().pendingBattle.kind, 'poison-touch'); rejectsAtomically(g, () => illuminate(g), 'RESPONSE_PENDING'); g.respond(); assert.equal(g.view(g.leader).self.battle.canTrait, true);
});

test('an expired Draw clock still permits optional Illuminate before mandatory draws are complete', t => {
  const f = fixture(t, { turnSeconds: 5 }); drawSetup(f); f.advance(5_000); f.view(f.leader); assert.equal(f.room().turn.phase, 'draw'); assert.equal(f.room().turn.drawRemaining, 2); illuminate(f); assert.equal(f.player(f.leader).hand.length, 1); assert.equal(f.room().turn.drawRemaining, 2);
});

test('Staryu Water Gun is plain two damage with one actual command and no judgment', t => {
  const f = fixture(t); f.play('staryu'); const command = f.supply(f.leader), top = f.room().drawPile.at(-1).id; f.attack({ cardId: command }); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, null); assert.equal(f.room().drawPile.at(-1).id, top); assert.equal(countCard(f.room(), command), 1);
});

test('Confusion and Psybeam confuse only on an intense-sun judgment after positive two damage', t => {
  for (const level of [2, 3]) for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) {
    const f = fixture(t); f.play('staryu', level); const judged = f.judgments(weather)[0]; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, weather === 'intense-sun' ? 'confusion' : null); assert.equal(countCard(f.room(), judged.id), 1);
  }
});

test('Psybeam has two independently defended target slots and independent final weather judgments', t => {
  const f = fixture(t); f.play('staryu', 3); f.judgments('intense-sun', 'rain'); const command = f.supply(f.leader); f.attack({ cardId: command, targetIds: [f.target.playerId, f.third.playerId] }); f.respond(); assert.equal(f.player(f.target).active.status, 'confusion'); assert.equal(f.player(f.third).active.damage, 0); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); f.respond(); assert.equal(f.player(f.third).active.status, null); assert.equal(f.player(f.third).active.damage, 2); assert.equal(countCard(f.room(), command), 1);
});

test('Staryu status judgments require positive damage and never affect a deployed reserve', t => {
  for (const prevention of ['dodge', 'immunity', 'shed', 'faint']) {
    const f = fixture(t); f.play('staryu', 2); if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; if (prevention === 'shed') { f.seed(f.target, 'caterpie', 2); f.supply(f.target, 'event'); f.supply(f.target, 'event'); }
    if (prevention === 'faint') f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); const incoming = f.player(f.target).reserve.instanceId, judged = f.judgments('intense-sun')[0]; f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); if (prevention === 'shed') f.respond('shed', { cardIds: ids(f.player(f.target).hand) }); f.drain();
    assert.equal(f.player(f.target).active.status, null); if (prevention === 'faint') assert.equal(f.player(f.target).active.instanceId, incoming); else assert.equal(f.room().drawPile.at(-1).id, judged.id);
  }
});

test('Confusion judgment uses Drought final weather, Poison Touch substitution and Shield Dust immunity', t => {
  for (const shield of [false, true]) {
    const f = fixture(t, { count: 4 }); f.play('staryu', 2); f.seed(f.third, 'vulpix'); const grimer = f.seats.find(who => ![f.leader, f.target, f.third].includes(who)); f.seed(grimer, 'grimer'); if (shield) f.seed(f.target, 'caterpie'); const replacement = f.supply(f.third, 'event', 'intense-sun'); f.judgments('rain'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'judgment'); f.respond('replace', { cardId: replacement }); if (!shield) { assert.equal(f.room().pendingBattle.kind, 'poison-touch'); f.respond('trait'); } assert.equal(f.player(f.target).active.status, shield ? null : 'poison');
  }
});

test('Psybeam skips empty judgments without rolling back damage or inventing confusion', t => {
  const f = fixture(t); f.play('staryu', 3); f.room().drawPile = []; f.room().discardPile = []; const command = f.supply(f.leader); f.attack({ cardId: command, targetIds: [f.target.playerId, f.third.playerId] }); f.drain(); for (const who of [f.target, f.third]) { assert.equal(f.player(who).active.damage, 2); assert.equal(f.player(who).active.status, null); } assert.equal(f.room().resolution, null); assert.deepEqual(ids(f.room().discardPile), [command]);
});

test('new pair commands require real own payment, ordinary range and once-per-move instance limits', t => {
  for (const family of ['kangaskhan', 'staryu']) {
    const f = fixture(t, { count: 6 }); f.play(family, 3); const legal = f.view(f.leader).self.battle.legalTargetIds, far = f.seats.find(who => !legal.includes(who.playerId)), command = f.supply(f.leader), wrong = f.supply(f.leader, 'event'), foreign = f.supply(f.target); assert.ok(far);
    rejectsAtomically(f, () => f.attack({ cardId: command, targetIds: [far.playerId] })); for (const cardId of [wrong, foreign, 'forged']) rejectsAtomically(f, () => f.attack({ cardId })); f.judgments('rain'); f.attack({ cardId: command }); f.drain(); assert.equal(f.view(f.leader).self.battle.canCommand, false); const second = f.supply(f.leader); rejectsAtomically(f, () => f.attack({ cardId: second })); f.act(f.leader, 'switchPokemon'); assert.equal(f.view(f.leader).self.battle.canCommand, false);
  }
});

test('Gas suppresses Early Bird event protection and Illuminate while preserving the pair move effects', t => {
  const f = fixture(t); f.play(); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); start(f); f.respond('suppress', { cardId: cost, targetId: f.leader.playerId }); drawToPlay(f); assert.equal(battleEventTargetAllowed(f.room(), f.player(f.leader).active, '胖丁的表演'), true); f.attack(); f.respond(); assert.equal(f.player(f.target).active.status, 'flinch');
  const g = fixture(t); g.seed(g.leader, 'staryu', 2); g.seed(g.third, 'koffing'); const payment = g.supply(g.third); start(g); g.respond('suppress', { cardId: payment, targetId: g.leader.playerId }); assert.equal(g.view(g.leader).self.battle.canTrait, false); rejectsAtomically(g, () => illuminate(g)); drawToPlay(g); g.judgments('intense-sun'); g.attack(); g.respond(); assert.equal(g.player(g.target).active.status, 'confusion');
});

test('Gas does not suppress Double Edge boost/recoil or Reversal current-HP increase because they are move effects', t => {
  for (const level of [2, 3]) {
    const f = fixture(t); f.play('kangaskhan', level); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); start(f); f.respond('suppress', { cardId: cost, targetId: f.leader.playerId }); drawToPlay(f); f.player(f.leader).active.damage = 3; f.attack(); f.respond(); if (level === 2) boost(f); assert.equal(f.player(f.target).active.damage, level === 2 ? 3 : 4); assert.equal(f.player(f.leader).active.damage, level === 2 ? 4 : 3);
  }
});
