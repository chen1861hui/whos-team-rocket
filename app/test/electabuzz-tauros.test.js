import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore } from '../server/store.js';



const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));
function fixture(t, { count = 3, turnSeconds = 0, responseSeconds = 0, initialTauros = false } = {}) {
  const root = fileURLToPath(new URL('../.data/', import.meta.url));
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'electabuzz-tauros-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ allowTestDecks: true, dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `electabuzz-tauros-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  if (initialTauros) { const deal = player(owner).candidateDeal; if (!deal.includes('tauros')) { const zone = [...room().players.map(player => player.candidateDeal), room().pokemonDeck].find(cards => cards.includes('tauros')); const at = zone.indexOf('tauros'); zone[at] = deal[0]; deal[0] = 'tauros'; } }
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates, activeId = initialTauros && who === owner ? 'tauros' : candidates.find(id => !['koffing', 'jynx', 'tauros'].includes(id)); act(who, 'selectPokemon', { activeId, reserveId: candidates.find(id => id !== activeId) }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  if (!initialTauros) for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-electabuzz-tauros-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private Electabuzz Tauros card ${serial}` } });
  if (!initialTauros) { room().drawPile = Array.from({ length: 48 }, () => makeCard()); room().discardPile = []; }
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const top = (...weather) => { const cards = weather.map(value => makeCard('reveal-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const judgments = (...weather) => { const cards = weather.map(value => makeCard('judgment-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id), third = seats.find(who => who !== leader && who !== target);
  const play = (family = 'electabuzz', level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, family, level); };
  const attack = (payload = {}, who = leader) => act(who, 'attack', { cardId: payload.cardId ?? supply(who), targetIds: [target.playerId], ...payload });
  const respond = (choice = 'pass', payload = {}) => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice, ...payload }); };
  const order = effect => respond('damage-effect', { effect });
  const helmet = who => { const card = { ...makeCard('held-item'), itemType: 'rocky-helmet' }; player(who).active.item = card; return card; };
  const drain = () => { for (let i = 0; room().pendingBattle && i < 100; i++) { const pending = room().pendingBattle; if (pending.kind === 'sweet-kiss') respond('discard', { cardIds: player(byId(pending.actorId)).hand.slice(0, 2).map(card => card.id) }); else if (pending.kind === 'damage-order') order(pending.effects[0]); else respond(pending.kind === 'effects' ? 'effect' : 'pass', pending.kind === 'effects' ? { effect: pending.effects[0] } : {}); } assert.equal(room().pendingBattle, null); };
  const startStatus = (status = 'poison', who = target) => { player(who).active.status = status; store.startTurn(room(), who.playerId, 2); };
  return { store, dir, now, owner, seats, leader, target, third, room, player, byId, view, input, act, seed, makeCard, supply, top, judgments, play, attack, respond, order, helmet, drain, startStatus, advance: ms => { time += ms; } };
}
function rejectsAtomically(f, action, code) { const before = structuredClone(f.room()); assert.throws(action, error => code === undefined || error.code === code); assert.deepEqual(f.room(), before); }
const ids = cards => cards.map(card => card.id);
const publicFace = ({ name, weather, kind }) => ({ name, weather, kind });
const publicHand = ({ id, name, weather, kind }) => ({ id, name, weather, kind });
const allCards = room => [...room.drawPile, ...room.discardPile, ...room.players.flatMap(p => [...(p.hand || []), ...[p.active?.item, p.reserve?.item].filter(Boolean)]), ...[room.resolution, ...(room.resolutionStack || [])].flatMap(r => r ? [...(r.card && !r.cardClaimedBy ? [r.card] : []), ...(r.revealedCards || [])] : []), ...(room.judgment?.card ? [room.judgment.card] : [])];
const countCard = (room, id) => allCards(room).filter(card => card.id === id).length;

const start = (f, who = f.leader) => f.store.startTurn(f.room(), who.playerId, (f.room().turn?.number || 0) + 1);
const drawToPlay = (f, who = f.leader) => { while (f.room().turn.drawRemaining) f.act(who, 'draw'); };
const drawSetup = (f, level = 1, extra = {}) => { f.seed(f.leader, 'electabuzz', level, extra); start(f); };
const vital = f => f.act(f.leader, 'useTrait');
const gain = (f, order) => f.respond('gain', { order });
const target = (f, who = f.target) => f.respond('target', { targetId: who.playerId });
const slot = (f, handIndex = 0) => f.respond('card', { handIndex });
const reserveTauros = (f, who = f.leader, level = 1) => Object.assign(f.player(who).reserve, { catalogueId: 'tauros', level });

test('Electabuzz and Tauros expose reviewed HP and all native two-damage command faces', t => {
  for (const family of ['electabuzz', 'tauros']) { const entry = catalogue.entries.find(entry => entry.id === family); assert.deepEqual(entry.levels.map(face => face.hp), [3, 4, 4]); assert.deepEqual(entry.levels.map(face => face.effectStatus), Array(3).fill('combat-preview')); for (const level of [1, 2, 3]) { const f = fixture(t); f.play(family, level); const battle = f.view(f.leader).self.battle; assert.equal(battle.canCommand, true); assert.equal(battle.canTrait, false); assert.equal(battle.moves.length, 1); assert.equal(battle.move.printedValue, 2); assert.equal(battle.move.maxTargets, level === 3 ? 2 : 1); } }
});

test('catalogue and roster support the new pair while supporting Chansey', () => {
  const executable = catalogue.entries.filter(entry => entry.levels.every(face => face.effectStatus === 'combat-preview')); assert.equal(catalogue.metadata.combatSupportedGroups, executable.length); assert.ok(executable.length >= 35); assert.equal(executable.flatMap(entry => entry.levels).length, executable.length * 3);
  const roster = JSON.parse(readFileSync(new URL('../content/selection-roster.json', import.meta.url), 'utf8')); assert.equal(roster.entries.filter(entry => entry.supportedEffects).length, executable.length); for (const id of ['electabuzz', 'tauros']) assert.equal(roster.entries.find(entry => entry.id === id).supportedEffects, true); assert.equal(roster.entries.find(entry => entry.id === 'chansey').supportedEffects, true);
});

test('Vital Spirit projects only before any normal mandatory draw on each level', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t); drawSetup(f, level); const battle = f.view(f.leader).self.battle; assert.equal(battle.canTrait, true); assert.equal(battle.trait.kind, 'vital-spirit'); assert.equal(f.room().turn.drawStarted, false); f.act(f.leader, 'draw'); assert.equal(f.room().turn.drawStarted, true); assert.equal(f.room().turn.drawRemaining, 1); assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => vital(f)); }
});

test('Vital Spirit replaces the complete Draw with an immediate choice of two of the actual top three', t => {
  const f = fixture(t); drawSetup(f); const cards = f.top('rain', 'clear', 'thunderstorm'), below = f.room().drawPile.at(-4).id; vital(f); assert.equal(f.room().turn.drawStarted, true); assert.equal(f.room().pendingBattle.kind, 'vital-spirit'); assert.equal(f.room().pendingBattle.requiredCards, 2); assert.deepEqual(f.room().drawChoice.cardIds, ids(cards)); assert.equal(f.player(f.leader).hand.length, 0); gain(f, [2, 0]);
  assert.deepEqual(f.player(f.leader).hand, [cards[2], cards[0]]); assert.equal(f.room().drawPile.at(-1).id, cards[1].id); assert.equal(f.room().drawPile.at(-2).id, below); assert.equal(f.room().turn.drawRemaining, 0); assert.equal(f.room().turn.phase, 'play'); assert.equal(f.room().drawChoice ?? null, null); for (const card of cards) assert.equal(countCard(f.room(), card.id), 1);
});

test('Vital Spirit selected indexes define hand gain order and unchosen card stays the next actual draw', t => {
  const f = fixture(t); drawSetup(f); const cards = f.top('rain', 'clear', 'intense-sun'); vital(f); gain(f, [1, 0]); assert.deepEqual(f.player(f.leader).hand, [cards[1], cards[0]]); assert.equal(f.room().drawPile.at(-1).id, cards[2].id);
});

test('Vital Spirit finite supply gains zero through two actual cards without inventing missing draws', t => {
  for (const available of [0, 1, 2]) { const f = fixture(t); drawSetup(f); f.room().drawPile = []; f.room().discardPile = []; const cards = f.top(...Array(available).fill('rain')); vital(f); if (available) { assert.equal(f.room().pendingBattle.requiredCards, available); gain(f, cards.map((_, index) => index).reverse()); } assert.equal(f.room().pendingBattle, null); assert.equal(f.room().turn.phase, 'play'); assert.equal(f.room().turn.drawRemaining, 0); assert.deepEqual(f.player(f.leader).hand, [...cards].reverse()); assert.equal(f.view(f.leader).self.battle.canTrait, false); }
});

test('Vital Spirit refills real discards under an existing top card before privately choosing', t => {
  const f = fixture(t); drawSetup(f); f.room().drawPile = []; const top = f.top('rain')[0], discards = [f.makeCard('dodge', 'clear'), f.makeCard('event', 'thunderstorm')]; f.room().discardPile = [...discards]; vital(f); assert.equal(f.room().drawChoice.cardIds[0], top.id); assert.deepEqual(new Set(f.room().drawChoice.cardIds), new Set([top.id, ...ids(discards)])); assert.equal(f.room().discardPile.length, 0); gain(f, [0, 2]); assert.equal(allCards(f.room()).length, 3);
});

test('Vital Spirit replacement gains two despite Flinch reducing the base mandatory Draw to one', t => {
  const f = fixture(t); drawSetup(f, 1, { status: 'flinch' }); assert.equal(f.room().turn.drawRemaining, 1); const cards = f.top('rain', 'clear', 'thunderstorm'); vital(f); gain(f, [0, 1]); assert.deepEqual(f.player(f.leader).hand, cards.slice(0, 2)); assert.equal(f.room().turn.drawRemaining, 0); assert.equal(f.room().turn.phase, 'play');
});

test('Vital Spirit peek is not a judgment or a gain, and selected batch finishes while still in own Draw', t => {
  const f = fixture(t); drawSetup(f); f.seed(f.third, 'vulpix'); f.seed(f.target, 'meowth'); const sunny = f.supply(f.third, 'event', 'clear'); vital(f); assert.equal(f.room().judgment ?? null, null); assert.equal(f.player(f.leader).hand.length, 0); assert.deepEqual(f.room().turn.pickupUsedIds, []); gain(f, [0, 1]); assert.equal(f.player(f.leader).hand.length, 2); assert.deepEqual(f.room().turn.pickupUsedIds, []); assert.equal(f.player(f.third).hand.some(card => card.id === sunny), true);
});

test('Vital Spirit private choices expose indexed safe faces only to the acting trainer', t => {
  const f = fixture(t); drawSetup(f); const cards = f.top('rain', 'clear', 'intense-sun'), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); vital(f); assert.deepEqual(f.view(f.leader).pendingBattle.cards, cards.map(({ name, weather, kind }, index) => ({ index, name, weather, kind })));
  for (const who of [...f.seats, observer]) { const view = f.view(who); assert.equal(view.drawChoice, undefined); if (who !== f.leader) assert.equal(view.pendingBattle.cards, undefined); for (const card of cards) { assert.equal(JSON.stringify(view).includes(card.id), false); assert.equal(JSON.stringify(view).includes(card.privateMarker), false); } }
});

test('Vital Spirit gain enforces actor, exact distinct indexes and strict response fields atomically', t => {
  const f = fixture(t); drawSetup(f); vital(f); const pending = f.room().pendingBattle; rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'gain', order: [0, 1] }), 'NOT_YOUR_DECISION');
  for (const payload of [{ choice: 'pass' }, { choice: 'gain' }, { choice: 'gain', order: [] }, { choice: 'gain', order: [0] }, { choice: 'gain', order: [0, 1, 2] }, { choice: 'gain', order: [0, 0] }, { choice: 'gain', order: [0, 3] }, { choice: 'gain', order: [0, '1'] }, { choice: 'gain', order: [0, 1], cardIds: [] }, { choice: 'gain', order: [0, 1], targetId: f.target.playerId }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...payload }));
});

test('Vital Spirit activation rejects extra selectors and is blocked on wrong trainer or phase', t => {
  const f = fixture(t); drawSetup(f); for (const payload of [{ cardIds: [] }, { hpLoss: 0 }, { targetId: f.target.playerId }, { order: [0, 1] }]) rejectsAtomically(f, () => f.act(f.leader, 'useTrait', payload)); f.seed(f.target, 'electabuzz'); rejectsAtomically(f, () => f.act(f.target, 'useTrait'), 'NOT_YOUR_TURN'); drawToPlay(f); rejectsAtomically(f, () => vital(f)); assert.equal(f.view(f.leader).self.battle.canTrait, false);
});

test('reserve, defeated and eliminated Electabuzz cannot replace the current Draw', t => {
  for (const exclusion of ['reserve', 'defeated', 'eliminated']) { const f = fixture(t); drawSetup(f); if (exclusion === 'reserve') { f.player(f.leader).active.catalogueId = 'squirtle'; f.player(f.leader).reserve.catalogueId = 'electabuzz'; } else if (exclusion === 'defeated') f.player(f.leader).active.defeated = true; else f.player(f.leader).eliminated = true; assert.equal(f.view(f.leader).self.battle?.canTrait ?? false, false); rejectsAtomically(f, () => vital(f)); }
});

test('Vital Spirit action and gain retries cannot duplicate the peek, gain or Draw completion', t => {
  const f = fixture(t); drawSetup(f); const request = f.input('useTrait'); f.store.action(f.owner.code, f.leader.token, request); const selected = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), selected); const gainRequest = f.input('respondBattle', { decisionId: f.room().pendingBattle.id, choice: 'gain', order: [2, 0] }); f.store.action(f.owner.code, f.leader.token, gainRequest); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, gainRequest); assert.deepEqual(f.room(), once); assert.equal(f.player(f.leader).hand.length, 2); assert.equal(f.room().turn.drawRemaining, 0);
});

test('Vital Spirit restart preserves private selected identities, order and mandatory Draw replacement', t => {
  const f = fixture(t); drawSetup(f); const cards = f.top('rain', 'clear', 'thunderstorm'); vital(f); const saved = structuredClone(f.room().drawChoice), restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.leader.token).view; assert.deepEqual(restored.rooms.get(f.owner.code).drawChoice, saved); restored.action(f.owner.code, f.leader.token, { id: 'restored-vital', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'gain', order: [1, 2] }); const room = restored.rooms.get(f.owner.code); assert.deepEqual(room.players.find(player => player.id === f.leader.playerId).hand, [cards[1], cards[2]]); assert.equal(room.drawPile.at(-1).id, cards[0].id); assert.equal(room.turn.phase, 'play');
});

test('Vital Spirit mandatory response expiry waits and pauses the main turn without auto-selecting cards', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); drawSetup(f); vital(f); const id = f.room().pendingBattle.id; f.advance(5_000); const view = f.view(f.leader); assert.equal(view.pendingBattle.id, id); assert.equal(view.pendingBattle.clock.expired, true); assert.equal(view.pendingBattle.clock.pausedReason, 'mandatory'); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(view.turn.clock.remainingMs, 60_000);
});

test('closing vote freezes Vital Spirit selection without changing its captured cards', t => {
  const f = fixture(t); drawSetup(f); vital(f); const selected = [...f.room().drawChoice.cardIds]; f.act(f.owner, 'requestEndGame'); rejectsAtomically(f, () => gain(f, [0, 1]), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); assert.deepEqual(f.room().drawChoice.cardIds, selected); gain(f, [0, 1]);
});

test('a later own Draw resets Vital Spirit but evolution or repeat activation cannot reopen the same Draw', t => {
  const f = fixture(t); drawSetup(f); vital(f); gain(f, [0, 1]); f.player(f.leader).active.level = 2; rejectsAtomically(f, () => vital(f)); start(f); assert.equal(f.room().turn.drawStarted, false); assert.equal(f.view(f.leader).self.battle.canTrait, true);
});

test('initial Tauros entry runs after every setup four-card hand and before the first trainer turn', t => {
  const f = fixture(t, { initialTauros: true }); assert.equal(f.player(f.owner).active.catalogueId, 'tauros'); assert.equal(f.room().pendingBattle.kind, 'intimidate'); assert.equal(f.room().pendingBattle.actorId, f.owner.playerId); for (const who of f.seats) assert.equal(f.player(who).hand.length, 4);
  const who = f.seats.find(who => who !== f.owner); target(f, who); assert.equal(f.room().pendingBattle.kind, 'intimidate-hand'); slot(f); assert.equal(f.player(who).hand.length, 3); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().turn.drawRemaining, 2); assert.equal(f.room().turn.phase, 'draw');
  const groups = [...f.room().players.flatMap(player => [player.active.catalogueId, player.reserve.catalogueId]), ...f.room().pokemonDeck]; assert.equal(groups.length, 40); assert.equal(new Set(groups).size, 40);
});

test('ordinary switching into Tauros on each level forces one selected trainer hand discard', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t); f.play('squirtle'); reserveTauros(f, f.leader, level); const costs = [f.supply(f.target), f.supply(f.target, 'event')], incoming = f.player(f.leader).reserve.instanceId; f.act(f.leader, 'switchPokemon'); assert.equal(f.player(f.leader).active.instanceId, incoming); assert.equal(f.room().pendingBattle.kind, 'intimidate'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); assert.equal(f.room().entryEvent.actorInstances[f.leader.playerId], incoming); target(f); assert.equal(f.room().pendingBattle.choiceCount, 2); slot(f); assert.equal(f.player(f.target).hand.length, 1); assert.equal(f.room().discardPile.filter(card => costs.includes(card.id)).length, 1); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().turn.switchUsed, true); }
});

test('Intimidate targets every live trainer with a hand including self, regardless of range', t => {
  const f = fixture(t, { count: 6 }); f.play('squirtle'); reserveTauros(f); for (const who of f.seats) f.supply(who); f.act(f.leader, 'switchPokemon'); assert.deepEqual(new Set(f.room().pendingBattle.legalTargetIds), new Set(f.seats.map(who => who.playerId))); const distant = f.byId(f.room().players[2].id); target(f, distant); slot(f); assert.equal(f.player(distant).hand.length, 0);
});

test('Intimidate excludes empty hands, spectators and eliminated trainers', t => {
  const f = fixture(t, { count: 4 }); f.play('squirtle'); reserveTauros(f); f.supply(f.target); const excluded = f.seats.find(who => ![f.leader, f.target].includes(who)); f.player(excluded).eliminated = true; f.supply(excluded); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); f.act(f.leader, 'switchPokemon'); assert.deepEqual(f.room().pendingBattle.legalTargetIds, [f.target.playerId]);
  for (const targetId of [f.leader.playerId, excluded.playerId, observer.playerId, 'forged']) rejectsAtomically(f, () => f.respond('target', { targetId })); target(f); slot(f);
});

test('Intimidate skips itself when every living trainer hand is empty', t => {
  const f = fixture(t); f.play('squirtle'); reserveTauros(f); f.act(f.leader, 'switchPokemon'); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().entryEvent ?? null, null); assert.equal(f.player(f.leader).active.catalogueId, 'tauros');
});

test('Intimidate mandatory target selection validates actor, live target and strict fields atomically', t => {
  const f = fixture(t); f.play('squirtle'); reserveTauros(f); const own = f.supply(f.target); f.act(f.leader, 'switchPokemon'); const pending = f.room().pendingBattle; rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'target', targetId: f.target.playerId }), 'NOT_YOUR_DECISION'); rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: 'stale', choice: 'target', targetId: f.target.playerId }), 'STALE_DECISION');
  for (const payload of [{ choice: 'pass' }, { choice: 'target' }, { choice: 'target', targetId: f.target.playerId, cardId: own }, { choice: 'target', targetId: f.target.playerId, handIndex: 0 }, { choice: 'target', targetId: f.target.playerId, cardIds: [] }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...payload }));
});

test('Intimidate foreign-hand slots are privately randomized indexes with no face or identity leakage', t => {
  const f = fixture(t); f.play('squirtle'); reserveTauros(f); const hand = [f.supply(f.target, 'event', 'rain'), f.supply(f.target, 'dodge', 'clear'), f.supply(f.target)], originals = structuredClone(f.player(f.target).hand), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); f.act(f.leader, 'switchPokemon'); target(f); const view = f.view(f.leader); assert.deepEqual(view.pendingBattle.choices, hand.map((_, index) => ({ index })));
  for (const who of [...f.seats, observer]) { const view = f.view(who); assert.equal(view.entryEvent, undefined); if (who !== f.leader) assert.equal(view.pendingBattle.choices, undefined); for (const card of originals) { assert.equal(JSON.stringify(view.pendingBattle).includes(card.id), false); assert.equal(JSON.stringify(view.pendingBattle).includes(card.privateMarker), false); } }
  slot(f, 1); assert.equal(f.player(f.target).hand.length, 2); const discarded = f.room().discardPile.find(card => hand.includes(card.id)); assert.deepEqual(discarded, originals.find(card => card.id === discarded.id));
});

test('Intimidate choosing the Tauros trainer own hand exposes only safe indexed faces', t => {
  const f = fixture(t); f.play('squirtle'); reserveTauros(f); f.supply(f.leader, 'event', 'rain'); f.supply(f.leader, 'dodge', 'clear'); const originals = structuredClone(f.player(f.leader).hand); f.act(f.leader, 'switchPokemon'); target(f, f.leader); const choices = f.view(f.leader).pendingBattle.choices; assert.equal(choices.length, 2); for (const choice of choices) { assert.deepEqual(Object.keys(choice).sort(), ['index', 'kind', 'name', 'weather']); assert.ok(originals.some(card => card.kind === choice.kind && card.weather === choice.weather)); } slot(f); assert.equal(f.player(f.leader).hand.length, 1);
});

test('Intimidate hand selection enforces original actor, valid index and no extra selectors or pass', t => {
  const f = fixture(t); f.play('squirtle'); reserveTauros(f); const own = f.supply(f.target); f.act(f.leader, 'switchPokemon'); target(f); const pending = f.room().pendingBattle; rejectsAtomically(f, () => f.act(f.target, 'respondBattle', { decisionId: pending.id, choice: 'card', handIndex: 0 }), 'NOT_YOUR_DECISION');
  for (const payload of [{ choice: 'pass' }, { choice: 'card' }, { choice: 'card', handIndex: -1 }, { choice: 'card', handIndex: 1 }, { choice: 'card', handIndex: '0' }, { choice: 'card', handIndex: 0.5 }, { choice: 'card', handIndex: 0, cardId: own }, { choice: 'card', handIndex: 0, targetId: f.target.playerId }, { choice: 'card', handIndex: 0, order: [0] }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...payload }));
});

test('both Intimidate choices remain mandatory after timeout with the main turn paused', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play('squirtle'); reserveTauros(f); f.supply(f.target); f.act(f.leader, 'switchPokemon'); const targetId = f.room().pendingBattle.id; f.advance(5_000); let view = f.view(f.leader); assert.equal(view.pendingBattle.id, targetId); assert.equal(view.pendingBattle.clock.pausedReason, 'mandatory'); target(f); const handId = f.room().pendingBattle.id; f.advance(5_000); view = f.view(f.leader); assert.equal(view.pendingBattle.id, handId); assert.equal(view.pendingBattle.clock.expired, true); assert.equal(view.pendingBattle.clock.pausedReason, 'mandatory'); assert.equal(view.turn.clock.remainingMs, 60_000); slot(f);
});

test('Intimidate target action retries do not resample the private slot identities', t => {
  const f = fixture(t); f.play('squirtle'); reserveTauros(f); f.supply(f.target); f.supply(f.target); f.act(f.leader, 'switchPokemon'); const request = f.input('respondBattle', { decisionId: f.room().pendingBattle.id, choice: 'target', targetId: f.target.playerId }); f.store.action(f.owner.code, f.leader.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), once); assert.equal(f.room().pendingBattle.kind, 'intimidate-hand');
});

test('Intimidate restart and exact card retries discard one real card and resume the saved entry once', t => {
  const f = fixture(t); f.play('squirtle'); reserveTauros(f); const originals = [f.supply(f.target), f.supply(f.target)]; f.act(f.leader, 'switchPokemon'); target(f); const saved = structuredClone(f.room().entryEvent), restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.leader.token).view; assert.deepEqual(restored.rooms.get(f.owner.code).entryEvent, saved); const request = { id: 'restored-intimidate', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'card', handIndex: 0 }; restored.action(f.owner.code, f.leader.token, request); const once = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.leader.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), once); assert.equal(once.players.find(player => player.id === f.target.playerId).hand.length, 1); assert.equal(once.discardPile.filter(card => originals.includes(card.id)).length, 1); assert.equal(once.entryEvent ?? null, null);
});

test('votes block Intimidate without losing its captured actor or chosen hand slots', t => {
  const f = fixture(t); f.play('squirtle'); reserveTauros(f); f.supply(f.target); f.act(f.leader, 'switchPokemon'); target(f); const event = structuredClone(f.room().entryEvent); f.act(f.owner, 'requestEndGame'); rejectsAtomically(f, () => slot(f), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); assert.deepEqual(f.room().entryEvent, event); slot(f);
});

test('U-turn actual entry runs Tauros Intimidate before resuming the original cleaned command', t => {
  const f = fixture(t); f.play('scyther'); reserveTauros(f); const discarded = f.supply(f.target), command = f.supply(f.leader), original = f.player(f.leader).active.instanceId; f.attack({ cardId: command }); f.respond(); assert.equal(f.room().pendingBattle.kind, 'u-turn'); f.respond('switch'); assert.equal(f.room().pendingBattle.kind, 'intimidate'); target(f); slot(f); assert.equal(f.player(f.target).hand.length, 0); assert.equal(f.room().discardPile.some(card => card.id === discarded), true); assert.equal(f.room().turn.commandCreatureId, original); assert.equal(f.room().turn.switchUsed, false); assert.equal(f.room().resolution, null); assert.equal(countCard(f.room(), command), 1);
});

test('Teleport actual entry runs Intimidate after the move draw and before move cleanup', t => {
  const f = fixture(t); f.play('abra'); reserveTauros(f); f.supply(f.target); f.attack({ targetIds: [f.leader.playerId] }); f.respond(); assert.equal(f.player(f.leader).hand.length, 1); assert.equal(f.room().pendingBattle.kind, 'intimidate'); target(f); slot(f); assert.equal(f.room().resolution, null); assert.equal(f.room().turn.switchUsed, false); assert.equal(f.player(f.leader).active.catalogueId, 'tauros');
});

test('Whirlwind forced entry makes the incoming Tauros owner choose its mandatory discard target', t => {
  const f = fixture(t); f.play('caterpie', 3); reserveTauros(f, f.target); f.supply(f.target); const rainy = f.supply(f.leader, 'event', 'rain'); f.attack({ cardId: rainy, moveIndex: 0 }); f.respond(); assert.equal(f.room().pendingBattle.kind, 'intimidate'); assert.equal(f.room().pendingBattle.actorId, f.target.playerId); target(f, f.target); slot(f); assert.equal(f.player(f.target).active.catalogueId, 'tauros'); assert.equal(f.player(f.target).hand.length, 0); assert.equal(f.room().resolution, null);
});

test('fainting deployment runs Tauros entry after rescue and before the original damage continuation finishes', t => {
  const f = fixture(t); f.play('squirtle'); f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); reserveTauros(f, f.target); f.supply(f.target); const command = f.supply(f.leader); f.attack({ cardId: command }); f.respond(); while (f.room().pendingBattle?.kind === 'rescue') f.respond(); assert.equal(f.room().pendingBattle.kind, 'intimidate'); assert.equal(f.room().pendingBattle.actorId, f.target.playerId); assert.equal(f.player(f.target).active.catalogueId, 'tauros'); target(f, f.target); slot(f); assert.equal(f.room().resolution, null); assert.equal(countCard(f.room(), command), 1);
});

test('a blocked Arena Trap switch into Tauros never triggers Intimidate', t => {
  const f = fixture(t); f.play('squirtle'); reserveTauros(f); f.seed(f.third, 'diglett'); const retained = f.supply(f.leader), original = f.player(f.leader).active.instanceId; f.act(f.leader, 'switchPokemon'); f.respond('trait'); assert.equal(f.room().pendingBattle.kind, 'switch-payment'); f.respond(); assert.equal(f.player(f.leader).active.instanceId, original); assert.equal(f.player(f.leader).hand.some(card => card.id === retained), true); assert.equal(f.room().entryEvent ?? null, null); assert.equal(f.room().pendingBattle, null);
});

test('Tauros evolution alone never creates another entry trigger', t => {
  const f = fixture(t); f.play('tauros'); f.player(f.leader).active.level = 2; assert.equal(f.room().pendingBattle, null); f.attack(); f.drain(); assert.equal(f.room().entryEvent ?? null, null); assert.equal(f.room().pendingBattle, null);
});

test('Vital Spirit prevents newly applied Sleep on every active level before Poison Touch replacement', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t, { count: 4 }); f.play('caterpie', 3); f.seed(f.target, 'electabuzz', level); f.seed(f.third, 'grimer'); f.judgments('rain'); const cost = f.supply(f.leader, 'event', 'clear'); f.attack({ cardId: cost, moveIndex: 1 }); f.respond(); assert.equal(f.player(f.target).active.status, null); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().statusEvent ?? null, null); }
});

test('reserve-only Vital Spirit does not protect another active Pokémon from Sleep', t => {
  const f = fixture(t); f.play('caterpie', 3); f.player(f.target).reserve.catalogueId = 'electabuzz'; f.judgments('rain'); f.attack({ moveIndex: 1, cardId: f.supply(f.leader, 'event', 'clear') }); f.respond(); assert.equal(f.player(f.target).active.status, 'sleep'); assert.equal(f.room().pendingBattle, null);
});

test('Vital Spirit sleep immunity does not protect the active Electabuzz against unrelated paralysis', t => {
  const f = fixture(t); f.play('electabuzz', 2); f.seed(f.target, 'electabuzz'); f.judgments('thunderstorm'); f.attack(); f.respond(); assert.equal(f.player(f.target).active.status, 'paralysis'); assert.equal(f.player(f.target).active.damage, 2);
});

test('Shock Wave and Stomp are plain two damage with one actual command and no judgment', t => {
  for (const family of ['electabuzz', 'tauros']) { const f = fixture(t); f.play(family); const command = f.supply(f.leader), actual = structuredClone(f.player(f.leader).hand[0]), top = f.room().drawPile.at(-1).id; f.attack({ cardId: command }); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, null); assert.equal(f.room().drawPile.at(-1).id, top); assert.deepEqual(f.room().discardPile.find(card => card.id === command), actual); assert.equal(countCard(f.room(), command), 1); }
});

test('Thunderbolt and Electroweb deal two and paralyze only on the final thunderstorm judgment', t => {
  for (const level of [2, 3]) for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) { const f = fixture(t); f.play('electabuzz', level); const judgment = f.judgments(weather)[0]; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, weather === 'thunderstorm' ? 'paralysis' : null); assert.equal(countCard(f.room(), judgment.id), 1); }
});

test('Body Slam deals two and paralyzes on either sunny final judgment only', t => {
  for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) { const f = fixture(t); f.play('tauros', 2); const judgment = f.judgments(weather)[0]; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, ['intense-sun', 'clear'].includes(weather) ? 'paralysis' : null); assert.equal(countCard(f.room(), judgment.id), 1); }
});

test('Electroweb defends two target slots and judges each actual hit independently in supplied order', t => {
  const f = fixture(t); f.play('electabuzz', 3); f.judgments('thunderstorm', 'clear'); const command = f.supply(f.leader); f.attack({ cardId: command, targetIds: [f.target.playerId, f.third.playerId] }); f.respond(); assert.equal(f.player(f.target).active.status, 'paralysis'); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.third).active.damage, 0); assert.equal(f.room().pendingBattle.actorId, f.third.playerId); f.respond(); assert.equal(f.player(f.third).active.status, null); assert.equal(f.player(f.third).active.damage, 2); assert.equal(countCard(f.room(), command), 1);
});

test('paralysis judgments require positive actual damage and never affect newly deployed reserves', t => {
  for (const prevention of ['dodge', 'immunity', 'shed', 'faint']) { const f = fixture(t); f.play('electabuzz', 2); if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; if (prevention === 'shed') { f.seed(f.target, 'caterpie', 2); f.supply(f.target, 'event'); f.supply(f.target, 'event'); } if (prevention === 'faint') f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2 }); const incoming = f.player(f.target).reserve.instanceId, judgment = f.judgments('thunderstorm')[0]; f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); if (prevention === 'shed') f.respond('shed', { cardIds: ids(f.player(f.target).hand) }); f.drain(); assert.equal(f.player(f.target).active.status, null); if (prevention === 'faint') assert.equal(f.player(f.target).active.instanceId, incoming); else assert.equal(f.room().drawPile.at(-1).id, judgment.id); }
});

test('Drought final weather can cancel Thunderbolt paralysis or enable Body Slam sunny paralysis', t => {
  for (const family of ['electabuzz', 'tauros']) { const f = fixture(t); f.play(family, 2); f.seed(f.third, 'vulpix'); const replacement = f.supply(f.third, 'event', 'clear'); f.judgments(family === 'electabuzz' ? 'thunderstorm' : 'rain'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'judgment'); f.respond('replace', { cardId: replacement }); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, family === 'tauros' ? 'paralysis' : null); }
});

test('paralysis moves respect Limber and Shield Dust and otherwise allow Poison Touch substitution', t => {
  for (const family of ['meowth', 'caterpie']) { const f = fixture(t); f.play('electabuzz', 2); f.seed(f.target, family, family === 'meowth' ? 3 : 1); f.judgments('thunderstorm'); f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, null); }
  const f = fixture(t); f.play('tauros', 2); f.seed(f.third, 'grimer'); f.judgments('clear'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'poison-touch'); assert.equal(f.room().pendingBattle.status, 'paralysis'); f.respond('trait'); assert.equal(f.player(f.target).active.status, 'poison');
});

test('Earthquake removes exactly one selected physical reinforcement after positive damage', t => {
  const f = fixture(t); f.play('tauros', 3); f.player(f.target).active.reinforcements = ['power', 'power', 'speed']; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle.kind, 'reinforcement'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); assert.equal(f.room().pendingBattle.timing, 'after-damage'); f.respond('reinforcement', { reinforcement: 'power' }); assert.deepEqual(f.player(f.target).active.reinforcements, ['power', 'speed']); assert.equal(f.room().pendingBattle, null);
});

test('Earthquake handles two target reinforcement choices independently after their respective hits', t => {
  const f = fixture(t); f.play('tauros', 3); f.player(f.target).active.reinforcements = ['power']; f.player(f.third).active.reinforcements = ['speed']; f.attack({ targetIds: [f.target.playerId, f.third.playerId] }); f.respond(); assert.equal(f.room().pendingBattle.targetId, f.target.playerId); f.respond('reinforcement', { reinforcement: 'power' }); assert.equal(f.room().pendingBattle.kind, 'defense'); assert.equal(f.player(f.third).active.damage, 0); f.respond(); assert.equal(f.room().pendingBattle.targetId, f.third.playerId); f.respond('reinforcement', { reinforcement: 'speed' }); for (const who of [f.target, f.third]) { assert.equal(f.player(who).active.damage, 2); assert.deepEqual(f.player(who).active.reinforcements, []); }
});

test('Earthquake skips marker removal on Dodge, immunity and an original target that faints', t => {
  for (const prevention of ['dodge', 'immunity', 'faint']) { const f = fixture(t); f.play('tauros', 3); f.player(f.target).active.reinforcements = ['power']; if (prevention === 'immunity') f.room().turn.damageImmunityIds = [f.player(f.target).active.instanceId]; if (prevention === 'faint') Object.assign(f.player(f.target).active, { hpBonus: 0, damage: 2 }); f.attack(); f.respond(prevention === 'dodge' ? 'dodge' : 'pass', prevention === 'dodge' ? { cardId: f.supply(f.target, 'dodge') } : {}); f.drain(); assert.equal(f.room().pendingBattle, null); if (prevention !== 'faint') assert.deepEqual(f.player(f.target).active.reinforcements, ['power']); }
});

test('Earthquake marker removal precedes receiving Battle Armor while normal Defense cleanup still waits for card end', t => {
  const f = fixture(t); f.play('tauros', 3); f.seed(f.target, 'cubone', 2, { reinforcements: ['speed'] }); const cost = f.supply(f.target, 'event'); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'reinforcement'); f.respond('reinforcement', { reinforcement: 'speed' }); assert.equal(f.room().pendingBattle.kind, 'battle-armor'); f.respond('armor', { cardId: cost }); assert.deepEqual(f.player(f.target).active.reinforcements, []); assert.equal(f.player(f.target).active.damage, 2);
});

test('both families require one real own command, ordinary range and a single command-using instance', t => {
  for (const family of ['electabuzz', 'tauros']) { const f = fixture(t, { count: 6 }); f.play(family, 3); const cardId = f.supply(f.leader), wrong = f.supply(f.leader, 'event'), foreign = f.supply(f.target), far = f.seats.find(who => !f.view(f.leader).self.battle.legalTargetIds.includes(who.playerId)); assert.ok(far); for (const cost of [wrong, foreign, 'forged']) rejectsAtomically(f, () => f.attack({ cardId: cost })); rejectsAtomically(f, () => f.attack({ cardId, targetIds: [far.playerId] })); f.judgments('rain'); f.attack({ cardId }); f.drain(); assert.equal(f.view(f.leader).self.battle.canCommand, false); const next = f.supply(f.leader); rejectsAtomically(f, () => f.attack({ cardId: next })); f.act(f.leader, 'switchPokemon'); assert.equal(f.view(f.leader).self.battle.canCommand, false); }
});

test('Gas suppresses Vital Spirit Draw replacement while leaving normal mandatory draws intact', t => {
  const f = fixture(t); f.seed(f.leader, 'electabuzz'); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); start(f); f.respond('suppress', { cardId: cost, targetId: f.leader.playerId }); assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => vital(f)); assert.equal(f.room().turn.drawRemaining, 2); drawToPlay(f); assert.equal(f.player(f.leader).hand.length, 2);
});

test('Gas removes Vital Spirit sleep immunity so the ordinary Sleep and Poison Touch pipeline resumes', t => {
  const f = fixture(t, { count: 4 }); f.play('caterpie', 3); f.seed(f.target, 'electabuzz'); f.seed(f.third, 'grimer'); const actor = f.seats.find(who => ![f.leader, f.target, f.third].includes(who)); f.seed(actor, 'koffing'); const cost = f.supply(actor); start(f); f.respond('suppress', { cardId: cost, targetId: f.target.playerId }); drawToPlay(f); f.judgments('rain'); f.attack({ moveIndex: 1, cardId: f.supply(f.leader, 'event', 'clear') }); f.respond(); assert.equal(f.room().pendingBattle.kind, 'poison-touch'); assert.equal(f.room().pendingBattle.status, 'sleep'); f.respond(); assert.equal(f.player(f.target).active.status, 'sleep');
});

test('Gas suppression follows the trainer into an incoming Tauros and prevents its entry trait', t => {
  const f = fixture(t); f.play('squirtle'); reserveTauros(f); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); f.supply(f.target); start(f); f.respond('suppress', { cardId: cost, targetId: f.leader.playerId }); drawToPlay(f); const hand = structuredClone(f.player(f.target).hand); f.act(f.leader, 'switchPokemon'); assert.equal(f.player(f.leader).active.catalogueId, 'tauros'); assert.equal(f.room().pendingBattle, null); assert.deepEqual(f.player(f.target).hand, hand); assert.equal(f.room().entryEvent ?? null, null);
});

test('Gas never suppresses Electabuzz paralysis judgments or Tauros Earthquake move effects', t => {
  for (const family of ['electabuzz', 'tauros']) { const f = fixture(t); f.play(family, 3); f.seed(f.third, 'koffing'); const cost = f.supply(f.third); start(f); f.respond('suppress', { cardId: cost, targetId: f.leader.playerId }); drawToPlay(f); if (family === 'tauros') f.player(f.target).active.reinforcements = ['power']; f.judgments('thunderstorm'); f.attack(); f.respond(); if (family === 'electabuzz') assert.equal(f.player(f.target).active.status, 'paralysis'); else { assert.equal(f.room().pendingBattle.kind, 'reinforcement'); f.respond('reinforcement', { reinforcement: 'power' }); assert.deepEqual(f.player(f.target).active.reinforcements, []); } assert.equal(f.player(f.target).active.damage, 2); }
});

test('legacy Draw without a drawStarted checkpoint cannot gain an extra replacement until the next fresh turn', t => {
  for (const remaining of [1, 2]) { const f = fixture(t); drawSetup(f); if (remaining === 1) f.act(f.leader, 'draw'); delete f.room().turn.drawStarted; assert.equal(f.room().turn.drawRemaining, remaining); assert.equal(f.view(f.leader).self.battle.canTrait, false); rejectsAtomically(f, () => vital(f)); assert.equal(f.room().turn.drawRemaining, remaining); start(f); assert.equal(f.room().turn.drawStarted, false); assert.equal(f.view(f.leader).self.battle.canTrait, true); }
});
