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
  const dir = mkdtempSync(join(root, 'split-tools-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `split-tools-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates, activeId = candidates.find(id => !['koffing', 'jynx', 'tauros'].includes(id)); act(who, 'selectPokemon', { activeId, reserveId: candidates.find(id => id !== activeId) }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-split-tools-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private split tool card ${serial}` } });
  room().drawPile = Array.from({ length: 48 }, () => makeCard()); room().discardPile = [];
  const supply = (who, kind = 'command', weather = 'intense-sun') => { const card = makeCard(kind, weather); player(who).hand.push(card); return card.id; };
  const top = (...weather) => { const cards = weather.map(value => makeCard('reveal-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const judgments = (...weather) => { const cards = weather.map(value => makeCard('judgment-fixture', value)); room().drawPile.push(...[...cards].reverse()); return cards; };
  const target = byId(room().players.find(p => p.id !== leader.playerId && !p.spectator).id), third = seats.find(who => who !== leader && who !== target);
  const play = (family = 'squirtle', level = 1) => { while (room().turn.drawRemaining) act(leader, 'draw'); player(leader).hand = []; seed(leader, family, level); };
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
const allCards = room => [...room.drawPile, ...room.discardPile, ...room.players.flatMap(p => [...(p.hand || []), ...[p.active?.item, p.reserve?.item].filter(Boolean)]), ...[room.resolution, ...(room.resolutionStack || [])].flatMap(r => r ? [...(r.card && !r.cardClaimedBy ? [r.card] : []), ...(r.revealedCards || [])] : []), ...(room.judgment?.card ? [room.judgment.card] : []), ...(room.drawChoice?.cards || [])];
const countCard = (room, id) => allCards(room).filter(card => card.id === id).length;

const start = (f, who = f.leader) => f.store.startTurn(f.room(), who.playerId, f.room().turn.number + 1);
const drawToPlay = f => { while (f.room().turn.drawRemaining) f.act(f.leader, 'draw'); };
const tool = (f, who = f.leader, toolType = 'potion-full-heal') => { const card = { ...f.makeCard('tool', 'clear'), toolType, name: toolType === 'potion-full-heal' ? { zh: '伤药／万灵药', en: 'Potion / Full Heal' } : { zh: '神奇糖果／金珠', en: 'Rare Candy / Nugget' } }; f.player(who).hand.push(card); return card.id; };
const use = (f, cardId, effect = 'full-heal', who = f.target, slot = 'active', actor = f.leader) => f.act(actor, 'useTool', { cardId, effect, targetId: who.playerId, slot });
const choices = (f, toolType = 'potion-full-heal', viewer = f.leader) => f.view(viewer).self.battle.tools.find(tool => tool.toolType === toolType)?.choices || [];
const targets = (f, effect = 'full-heal') => choices(f, effect === 'rare-candy' ? 'rare-candy-nugget' : 'potion-full-heal').find(choice => choice.effect === effect)?.targets || [];
const hasTarget = (f, effect, who, slot = 'active') => targets(f, effect).some(target => target.targetId === who.playerId && target.slot === slot);

test('tool projection includes held matching pair types and enables Potion and trainer-targeted Nugget', t => {
  const f = fixture(t); f.play(); assert.deepEqual(f.view(f.leader).self.battle.tools, []); tool(f); assert.equal(f.view(f.leader).self.battle.tools.length, 1); assert.deepEqual(choices(f).map(choice => choice.effect), ['potion', 'full-heal']); const potion = choices(f).find(choice => choice.effect === 'potion'); assert.deepEqual(potion.targets, []); assert.equal(potion.unavailableReason,undefined); tool(f, f.leader, 'rare-candy-nugget'); assert.equal(f.view(f.leader).self.battle.tools.length, 2); assert.deepEqual(choices(f, 'rare-candy-nugget').map(choice => choice.effect), ['rare-candy', 'nugget']); const nugget = choices(f, 'rare-candy-nugget').find(choice => choice.effect === 'nugget'); assert.equal(nugget.targeting, 'trainer'); assert.equal(nugget.unavailableReason, undefined); assert.deepEqual(new Set(nugget.targets.map(target => target.targetId)), new Set(f.seats.map(who => who.playerId))); assert.ok(nugget.targets.every(target => Object.keys(target).length === 1));
  for (const choice of [...choices(f), ...choices(f, 'rare-candy-nugget')]) { assert.ok(choice.name?.zh); assert.ok(choice.name?.en); assert.ok(choice.description?.zh); assert.ok(choice.description?.en); }
});

test('duplicate physical copies share one pair menu while each real card remains individually spendable', t => {
  const f = fixture(t); f.play(); const first = tool(f), second = tool(f); assert.equal(f.view(f.leader).self.battle.tools.length, 1); f.player(f.target).active.status = 'burn'; use(f, first); f.player(f.third).active.status = 'sleep'; use(f, second, 'full-heal', f.third); assert.equal(f.player(f.target).active.status, null); assert.equal(f.player(f.third).active.status, null); assert.equal(f.view(f.leader).self.battle.tools.length, 0); for (const id of [first, second]) assert.equal(countCard(f.room(), id), 1);
});

test('Full Heal cures each of the six special statuses without healing injury or altering the Pokémon identity', t => {
  for (const status of ['burn', 'paralysis', 'poison', 'confusion', 'sleep', 'flinch']) { const f = fixture(t); f.play(); f.player(f.target).active.status = status; f.player(f.target).active.damage = 2; const before = structuredClone(f.player(f.target).active), cardId = tool(f); use(f, cardId); assert.deepEqual(f.player(f.target).active, { ...before, status: null }); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null); assert.equal(countCard(f.room(), cardId), 1); }
});

test('Full Heal discards the entire physical pair once and preserves its exact real card data', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.status = 'poison'; const cardId = tool(f), card = structuredClone(f.player(f.leader).hand[0]), before = allCards(f.room()).length, deck = structuredClone(f.room().drawPile); use(f, cardId); assert.equal(f.player(f.leader).hand.some(card => card.id === cardId), false); assert.deepEqual(f.room().discardPile.find(card => card.id === cardId), card); assert.equal(countCard(f.room(), cardId), 1); assert.equal(allCards(f.room()).length, before); assert.deepEqual(f.room().drawPile, deck); rejectsAtomically(f, () => use(f, cardId));
});

test('Full Heal can cure the current trainer active and own hidden reserve', t => {
  for (const slot of ['active', 'reserve']) { const f = fixture(t); f.play(); f.player(f.leader)[slot].status = 'confusion'; assert.equal(f.player(f.leader).reserve.revealed, false); const cardId = tool(f); assert.equal(hasTarget(f, 'full-heal', f.leader, slot), true); use(f, cardId, 'full-heal', f.leader, slot); assert.equal(f.player(f.leader)[slot].status, null); if (slot === 'reserve') assert.equal(f.player(f.leader).reserve.revealed, true); }
});

test('Full Heal can cure a revealed other-trainer reserve without changing active state or moving partners', t => {
  const f = fixture(t); f.play(); Object.assign(f.player(f.target).reserve, { status: 'sleep', revealed: true, damage: 2 }); const active = structuredClone(f.player(f.target).active), reserve = structuredClone(f.player(f.target).reserve), cardId = tool(f); assert.equal(hasTarget(f, 'full-heal', f.target, 'reserve'), true); use(f, cardId, 'full-heal', f.target, 'reserve'); assert.deepEqual(f.player(f.target).active, active); assert.deepEqual(f.player(f.target).reserve, { ...reserve, status: null });
});

test('hidden other-trainer reserve eligibility never discloses whether it has a private status', t => {
  const f = fixture(t); f.play(); tool(f); const healthy = structuredClone(targets(f)); f.player(f.target).reserve.status = 'burn'; assert.equal(f.player(f.target).reserve.revealed, false); assert.deepEqual(targets(f), healthy); assert.equal(hasTarget(f, 'full-heal', f.target, 'reserve'), false); const cardId = f.player(f.leader).hand[0].id; rejectsAtomically(f, () => use(f, cardId, 'full-heal', f.target, 'reserve'));
});

test('Full Heal rejects healthy partners, nonexistent reserves, defeated partners and eliminated trainers', t => {
  for (const exclusion of ['healthy', 'missing', 'defeated', 'eliminated']) { const f = fixture(t); f.play(); f.player(f.target).active.status = 'burn'; if (exclusion === 'healthy') f.player(f.target).active.status = null; else if (exclusion === 'missing') f.player(f.target).reserve = null; else if (exclusion === 'defeated') f.player(f.target).active.defeated = true; else f.player(f.target).eliminated = true; const cardId = tool(f); rejectsAtomically(f, () => use(f, cardId, 'full-heal', f.target, exclusion === 'missing' ? 'reserve' : 'active')); }
});

test('both supported tools target distant living trainers without any printed distance restriction', t => {
  const f = fixture(t, { count: 6 }); f.play(); const far = f.byId(f.room().players[3].id); assert.equal(f.view(f.leader).self.battle.legalTargetIds.includes(far.playerId), false); f.player(far).active.status = 'paralysis'; const heal = tool(f), candy = tool(f, f.leader, 'rare-candy-nugget'); assert.equal(hasTarget(f, 'full-heal', far), true); assert.equal(hasTarget(f, 'rare-candy', far), true); use(f, heal, 'full-heal', far); use(f, candy, 'rare-candy', far); assert.equal(f.player(far).active.status, null); assert.equal(f.player(far).active.level, 2);
});

test('paralysis and absent range grants do not shrink distant tool targets', t => {
  const f = fixture(t, { count: 6 }); f.play(); f.player(f.leader).active.status = 'paralysis'; f.player(f.leader).active.reinforcements = ['speed']; const far = f.byId(f.room().players[3].id); f.player(far).active.status = 'poison'; const heal = tool(f), candy = tool(f, f.leader, 'rare-candy-nugget'); assert.equal(hasTarget(f, 'full-heal', far), true); assert.equal(hasTarget(f, 'rare-candy', far), true); use(f, heal, 'full-heal', far); use(f, candy, 'rare-candy', far); assert.deepEqual(f.player(f.leader).active.reinforcements, ['speed']); assert.equal(f.player(f.leader).active.status, 'paralysis');
});

test('Full Heal cannot target spectators or unknown trainer identities', t => {
  const f = fixture(t); f.play(); const cardId = tool(f), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); for (const targetId of [observer.playerId, 'forged', undefined, null, 1]) rejectsAtomically(f, () => f.act(f.leader, 'useTool', { cardId, effect: 'full-heal', targetId, slot: 'active' }));
});

test('Rare Candy evolves living level-one and level-two active partners by exactly one level', t => {
  for (const level of [1, 2]) { const f = fixture(t); f.play(); f.seed(f.target, 'squirtle', level, { damage: 2, status: 'burn', reinforcements: ['power', 'defense', 'speed'] }); f.helmet(f.target); const before = structuredClone(f.player(f.target).active), cardId = tool(f, f.leader, 'rare-candy-nugget'); use(f, cardId, 'rare-candy'); assert.deepEqual(f.player(f.target).active, { ...before, level: level + 1 }); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null); }
});

test('Rare Candy preserves leader bonus, injuries and current HP arithmetic across self evolution', t => {
  const f = fixture(t, { count: 6 }); f.play('squirtle'); Object.assign(f.player(f.leader).active, { hpBonus: 1, damage: 1 }); const before = f.view(f.leader).players.find(player => player.id === f.leader.playerId).active, role = f.player(f.leader).role, cardId = tool(f, f.leader, 'rare-candy-nugget'); use(f, cardId, 'rare-candy', f.leader); const after = f.view(f.leader).players.find(player => player.id === f.leader.playerId).active; assert.equal(f.player(f.leader).role, role); assert.equal(f.player(f.leader).active.hpBonus, 1); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(after.maxHp, before.maxHp + 1); assert.equal(after.hp, before.hp + 1);
});

test('Rare Candy never targets a reserve, a level-three active, a defeated active or eliminated trainer', t => {
  for (const exclusion of ['reserve', 'level-cap', 'defeated', 'eliminated']) { const f = fixture(t); f.play(); if (exclusion === 'reserve') f.player(f.target).reserve.revealed = true; else if (exclusion === 'level-cap') f.player(f.target).active.level = 3; else if (exclusion === 'defeated') f.player(f.target).active.defeated = true; else f.player(f.target).eliminated = true; const cardId = tool(f, f.leader, 'rare-candy-nugget'); assert.equal(hasTarget(f, 'rare-candy', f.target, exclusion === 'reserve' ? 'reserve' : 'active'), false); rejectsAtomically(f, () => use(f, cardId, 'rare-candy', f.target, exclusion === 'reserve' ? 'reserve' : 'active')); }
});

test('Rare Candy consumes the entire actual pair, preserves deck count and cannot reuse the paid identity', t => {
  const f = fixture(t); f.play(); const cardId = tool(f, f.leader, 'rare-candy-nugget'), actual = structuredClone(f.player(f.leader).hand[0]), before = allCards(f.room()).length; use(f, cardId, 'rare-candy'); assert.deepEqual(f.room().discardPile.find(card => card.id === cardId), actual); assert.equal(countCard(f.room(), cardId), 1); assert.equal(allCards(f.room()).length, before); rejectsAtomically(f, () => use(f, cardId, 'rare-candy', f.third));
});

test('multiple real Candy copies can evolve the same active through two levels but the cap rejects before consuming another', t => {
  const f = fixture(t); f.play(); const first = tool(f, f.leader, 'rare-candy-nugget'), second = tool(f, f.leader, 'rare-candy-nugget'), third = tool(f, f.leader, 'rare-candy-nugget'); use(f, first, 'rare-candy'); assert.equal(f.player(f.target).active.level, 2); use(f, second, 'rare-candy'); assert.equal(f.player(f.target).active.level, 3); rejectsAtomically(f, () => use(f, third, 'rare-candy')); assert.equal(f.player(f.leader).hand.some(card => card.id === third), true);
});

test('Candy evolution never triggers Tauros entry or redeals the active Pokémon instance', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'tauros', 1); f.supply(f.third); const original = f.player(f.target).active.instanceId, cardId = tool(f, f.leader, 'rare-candy-nugget'); use(f, cardId, 'rare-candy'); assert.equal(f.player(f.target).active.instanceId, original); assert.equal(f.player(f.target).active.level, 2); assert.equal(f.room().entryEvent ?? null, null); assert.equal(f.room().pendingBattle, null); assert.equal(f.player(f.third).hand.length, 1);
});

test('targeting an own hidden reserve with Full Heal reveals that real partner without swapping or triggering entry', t => {
  const f = fixture(t); f.play(); Object.assign(f.player(f.leader).reserve, { catalogueId: 'tauros', status: 'burn', damage: 2, revealed: false }); f.supply(f.third); const active = structuredClone(f.player(f.leader).active), reserve = structuredClone(f.player(f.leader).reserve), cardId = tool(f); use(f, cardId, 'full-heal', f.leader, 'reserve'); assert.deepEqual(f.player(f.leader).active, active); assert.deepEqual(f.player(f.leader).reserve, { ...reserve, status: null, revealed: true }); assert.equal(f.room().entryEvent ?? null, null); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().turn.switchUsed, false);
});

test('failed hidden reserve targeting neither consumes the pair nor reveals or mutates the hidden partner', t => {
  const f = fixture(t); f.play(); f.player(f.target).reserve.status = 'poison'; const before = structuredClone(f.player(f.target).reserve), cardId = tool(f); rejectsAtomically(f, () => use(f, cardId, 'full-heal', f.target, 'reserve')); assert.deepEqual(f.player(f.target).reserve, before); assert.equal(f.player(f.leader).hand.some(card => card.id === cardId), true);
});

test('tools reject nonpositive-HP fainting partners without performing rescue or evolution', t => {
  for (const effect of ['full-heal', 'rare-candy']) { const f = fixture(t); f.play(); Object.assign(f.player(f.target).active, { hpBonus: 0, damage: 3, status: 'burn' }); const cardId = tool(f, f.leader, effect === 'full-heal' ? 'potion-full-heal' : 'rare-candy-nugget'); assert.equal(hasTarget(f, effect, f.target), false); rejectsAtomically(f, () => use(f, cardId, effect)); assert.equal(f.room().pendingBattle, null); }
});

test('tools do not require executable Pokémon moves and can operate with a reference-only active partner', t => {
  const f = fixture(t); f.play('chansey'); f.player(f.target).active.status = 'burn'; const heal = tool(f), candy = tool(f, f.leader, 'rare-candy-nugget'); assert.equal(f.view(f.leader).self.battle.canCommand, false); use(f, heal); use(f, candy, 'rare-candy'); assert.equal(f.player(f.target).active.status, null); assert.equal(f.player(f.target).active.level, 2); assert.equal(f.view(f.leader).self.battle.canCommand, false);
});

test('Full Heal and Candy remain usable despite command, move, switch and trait counters being exhausted', t => {
  const f = fixture(t); f.play(); const instance = f.player(f.leader).active.instanceId; Object.assign(f.room().turn, { commandCreatureId: f.player(f.leader).reserve.instanceId, usedMoves: [`${instance}:水枪`], movesBlocked: true, blockedMoveIds: [instance], switchUsed: true, switchBlocked: true, traitsUsed: [instance] }); f.player(f.target).active.status = 'sleep'; const heal = tool(f), candy = tool(f, f.leader, 'rare-candy-nugget'), before = structuredClone(f.room().turn); use(f, heal); use(f, candy, 'rare-candy'); assert.deepEqual(f.room().turn, before); assert.equal(f.player(f.target).active.status, null); assert.equal(f.player(f.target).active.level, 2);
});

test('curing a later status does not erase the move and switch restrictions already triggered by Sleep or Confusion', t => {
  for (const status of ['sleep', 'confusion']) { const f = fixture(t); f.seed(f.leader, 'squirtle', 1, { status }); start(f); f.drain(); drawToPlay(f); const instance = f.player(f.leader).active.instanceId; assert.ok(f.room().turn.blockedMoveIds.includes(instance)); const switchBlocked = f.room().turn.switchBlocked; f.player(f.leader).active.status = 'burn'; const cardId = tool(f); use(f, cardId, 'full-heal', f.leader); assert.equal(f.player(f.leader).active.status, null); assert.ok(f.room().turn.blockedMoveIds.includes(instance)); assert.equal(f.room().turn.switchBlocked, switchBlocked); assert.equal(f.view(f.leader).self.battle.canCommand, false); }
});

test('curing a later status does not refund the mandatory draw already lost to Flinch', t => {
  const f = fixture(t); f.seed(f.leader, 'squirtle', 1, { status: 'flinch' }); start(f); assert.equal(f.room().turn.drawRemaining, 1); f.act(f.leader, 'draw'); const handSize = f.player(f.leader).hand.length; f.player(f.leader).active.status = 'poison'; const cardId = tool(f); use(f, cardId, 'full-heal', f.leader); assert.equal(f.room().turn.phase, 'play'); assert.equal(f.room().turn.drawRemaining, 0); assert.equal(f.player(f.leader).hand.length, handSize);
});

test('Full Heal removes Burn for a later command without prematurely spending Power or command use', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.status = 'burn'; f.player(f.leader).active.reinforcements = ['power', 'power']; const cardId = tool(f); use(f, cardId, 'full-heal', f.leader); assert.deepEqual(f.player(f.leader).active.reinforcements, ['power', 'power']); assert.equal(f.room().turn.commandCreatureId, null); f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 4);
});

test('Full Heal removes paralysis while preserving markers for their later normal effectiveness', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.status = 'paralysis'; f.player(f.leader).active.reinforcements = ['power', 'power', 'defense', 'speed']; const cardId = tool(f); use(f, cardId, 'full-heal', f.leader); assert.deepEqual(f.player(f.leader).active.reinforcements, ['power', 'power', 'defense', 'speed']); f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, 4); assert.deepEqual(f.player(f.leader).active.reinforcements, ['defense', 'speed']);
});

test('Full Heal has no Dodge, Pressure, Helmet, damage or status-application judgment pipeline', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'aerodactyl', 2, { status: 'poison', reinforcements: ['defense'] }); f.supply(f.target); f.helmet(f.target); f.seed(f.third, 'grimer'); const top = f.room().drawPile.at(-1).id, cardId = tool(f); use(f, cardId); assert.equal(f.player(f.target).active.status, null); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.leader).active.damage, 0); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().judgment ?? null, null); assert.equal(f.room().drawPile.at(-1).id, top);
});

test('Candy preserves used move names through evolution and does not reset inherited move use', t => {
  const f = fixture(t); f.play('scyther'); f.attack(); f.drain(); const before = structuredClone(f.room().turn), original = f.player(f.leader).active.instanceId, cardId = tool(f, f.leader, 'rare-candy-nugget'); use(f, cardId, 'rare-candy', f.leader); assert.deepEqual(f.room().turn, before); assert.equal(f.player(f.leader).active.instanceId, original); const moves = f.view(f.leader).self.battle.moves; assert.equal(moves.find(move => move.effectKind === 'u-turn').canUse, false); assert.equal(moves.find(move => move.effectKind === 'fury-cutter').canUse, true);
});

test('Candy on a newly switched partner never unlocks a different command-using instance', t => {
  const f = fixture(t); f.play(); f.attack(); f.respond(); const original = f.player(f.leader).active.instanceId; f.act(f.leader, 'switchPokemon'); const cardId = tool(f, f.leader, 'rare-candy-nugget'); use(f, cardId, 'rare-candy', f.leader); assert.equal(f.player(f.leader).active.level, 2); assert.equal(f.room().turn.commandCreatureId, original); assert.equal(f.view(f.leader).self.battle.canCommand, false);
});

test('Potion heals an injured target and Nugget rejects the old Pokémon-slot payload', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.damage = 2; const potion = tool(f), nugget = tool(f, f.leader, 'rare-candy-nugget'); use(f, potion, 'potion'); rejectsAtomically(f, () => use(f, nugget, 'nugget')); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.target).hand.length, 0);
});

test('physical pair effects cannot be mixed and a matching toolType on a wrong card kind never qualifies', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.status = 'burn'; const heal = tool(f), candy = tool(f, f.leader, 'rare-candy-nugget'); rejectsAtomically(f, () => use(f, heal, 'rare-candy')); rejectsAtomically(f, () => use(f, candy, 'full-heal')); const fake = { ...f.makeCard('event', 'clear'), toolType: 'potion-full-heal' }; f.player(f.leader).hand.push(fake); rejectsAtomically(f, () => use(f, fake.id));
});

test('foreign, spent, forged and unknown physical tool identities reject before any mutation', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.status = 'sleep'; const foreign = tool(f, f.target), unknown = tool(f, f.leader, 'unknown-pair'); for (const cardId of [foreign, unknown, 'forged', undefined, null, 1, {}]) rejectsAtomically(f, () => use(f, cardId)); assert.deepEqual(f.view(f.leader).self.battle.tools, []);
});

test('useTool strict fields reject malformed effects, slots and unrelated move or response selectors', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.status = 'burn'; const cardId = tool(f);
  for (const effect of [undefined, null, 'heal', 'FULL-HEAL', {}, 1]) rejectsAtomically(f, () => use(f, cardId, effect === undefined ? null : effect)); for (const slot of [undefined, null, 'bench', '', 1, {}]) rejectsAtomically(f, () => f.act(f.leader, 'useTool', { cardId, effect: 'full-heal', targetId: f.target.playerId, slot }));
  for (const extra of [{ amount: 2 }, { levelUp: true }, { cardIds: [] }, { targetIds: [f.target.playerId] }, { moveIndex: 0 }, { effectChoice: 'cure' }, { hpLoss: 0 }, { decisionId: 'forged' }]) rejectsAtomically(f, () => f.act(f.leader, 'useTool', { cardId, effect: 'full-heal', targetId: f.target.playerId, slot: 'active', ...extra }));
});

test('useTool requires its current trainer authority and rejects spectator actions', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.status = 'burn'; const foreign = tool(f, f.target); rejectsAtomically(f, () => use(f, foreign, 'full-heal', f.target, 'active', f.target), 'NOT_YOUR_TURN'); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); const cardId = tool(f, observer); rejectsAtomically(f, () => use(f, cardId, 'full-heal', f.target, 'active', observer), 'SPECTATOR_ONLY_VIEW');
});

test('Draw, Discard and End phases never allow a tool play or project usable tool targets', t => {
  for (const phase of ['draw', 'discard', 'end']) { const f = fixture(t); f.play(); f.player(f.target).active.status = 'poison'; const cardId = tool(f); f.room().turn.phase = phase; assert.deepEqual(targets(f), []); rejectsAtomically(f, () => use(f, cardId)); }
});

test('pending defense blocks a tool play while preserving its card and target status', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.status = 'burn'; const cardId = tool(f); f.attack(); assert.equal(f.room().pendingBattle.kind, 'defense'); assert.deepEqual(targets(f), []); rejectsAtomically(f, () => use(f, cardId), 'RESPONSE_PENDING'); assert.equal(f.player(f.target).active.status, 'burn'); assert.equal(f.player(f.leader).hand.some(card => card.id === cardId), true); f.drain(); assert.equal(hasTarget(f, 'full-heal', f.target), true);
});

test('closing votes block both supported effects without consuming either real pair', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.status = 'sleep'; const heal = tool(f), candy = tool(f, f.leader, 'rare-candy-nugget'); f.act(f.owner, 'requestEndGame'); assert.deepEqual(targets(f), []); assert.deepEqual(targets(f, 'rare-candy'), []); rejectsAtomically(f, () => use(f, heal), 'VOTE_PENDING'); rejectsAtomically(f, () => use(f, candy, 'rare-candy'), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); use(f, heal); use(f, candy, 'rare-candy'); assert.equal(f.player(f.target).active.status, null); assert.equal(f.player(f.target).active.level, 2);
});

test('stale tool requests reject before consuming cards or reapplying a newly changed target effect', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.status = 'burn'; f.player(f.third).active.status = 'poison'; const staleCard = tool(f), other = tool(f), request = f.input('useTool', { cardId: staleCard, effect: 'full-heal', targetId: f.target.playerId, slot: 'active' }); use(f, other, 'full-heal', f.third); rejectsAtomically(f, () => f.store.action(f.owner.code, f.leader.token, request), 'STALE_REVISION'); assert.equal(f.player(f.target).active.status, 'burn'); assert.equal(f.player(f.leader).hand.some(card => card.id === staleCard), true);
});

test('Full Heal exact action retries cure and discard once even though the healed target no longer qualifies', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.status = 'confusion'; const cardId = tool(f), request = f.input('useTool', { cardId, effect: 'full-heal', targetId: f.target.playerId, slot: 'active' }); f.store.action(f.owner.code, f.leader.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), once); assert.equal(f.player(f.target).active.status, null); assert.equal(countCard(f.room(), cardId), 1);
});

test('Rare Candy exact action retries raise only one level and discard the physical pair only once', t => {
  const f = fixture(t); f.play(); const cardId = tool(f, f.leader, 'rare-candy-nugget'), request = f.input('useTool', { cardId, effect: 'rare-candy', targetId: f.target.playerId, slot: 'active' }); f.store.action(f.owner.code, f.leader.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), once); assert.equal(f.player(f.target).active.level, 2); assert.equal(countCard(f.room(), cardId), 1);
});

test('a used tool action ID cannot be repurposed for another real pair, target or effect', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.status = 'burn'; const heal = tool(f), candy = tool(f, f.leader, 'rare-candy-nugget'), request = f.input('useTool', { cardId: heal, effect: 'full-heal', targetId: f.target.playerId, slot: 'active' }); f.store.action(f.owner.code, f.leader.token, request); rejectsAtomically(f, () => f.store.action(f.owner.code, f.leader.token, { ...request, cardId: candy, effect: 'rare-candy', targetId: f.third.playerId }), 'ACTION_ID_REUSED'); assert.equal(f.player(f.third).active.level, 1); assert.equal(f.player(f.leader).hand.some(card => card.id === candy), true);
});

test('restart preserves cured and evolved target state, exact discarded pairs and successful request retries', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.status = 'poison'; f.player(f.target).active.damage = 2; const heal = tool(f), candy = tool(f, f.leader, 'rare-candy-nugget'); use(f, heal); const request = f.input('useTool', { cardId: candy, effect: 'rare-candy', targetId: f.target.playerId, slot: 'active' }); f.store.action(f.owner.code, f.leader.token, request); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); restored.view(f.owner.code, f.leader.token); const before = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.leader.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), before); const pokemon = restored.rooms.get(f.owner.code).players.find(player => player.id === f.target.playerId).active; assert.equal(pokemon.status, null); assert.equal(pokemon.damage, 2); assert.equal(pokemon.level, 2); for (const id of [heal, candy]) assert.equal(countCard(restored.rooms.get(f.owner.code), id), 1);
});

test('restart before tool use preserves actual owned pair eligibility and does not synthesize card copies', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.status = 'sleep'; const cardId = tool(f); f.store.persist(f.room()); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.leader.token).view; assert.equal(view.self.battle.tools.length, 1); restored.action(f.owner.code, f.leader.token, { id: 'restored-full-heal', revision: view.revision, type: 'useTool', cardId, effect: 'full-heal', targetId: f.target.playerId, slot: 'active' }); const room = restored.rooms.get(f.owner.code); assert.equal(room.players.find(player => player.id === f.target.playerId).active.status, null); assert.equal(countCard(room, cardId), 1);
});

test('opponent and spectator projections never expose the source physical tool identities or private card fields', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.status = 'burn'; const cardId = tool(f), actual = f.player(f.leader).hand.find(card => card.id === cardId), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); for (const who of [f.target, f.third, observer]) { const view = f.view(who); assert.equal(JSON.stringify(view).includes(cardId), false); assert.equal(JSON.stringify(view).includes(actual.privateMarker), false); } use(f, cardId); for (const who of [f.target, f.third, observer]) { const view = f.view(who); assert.equal(JSON.stringify(view).includes(cardId), false); assert.equal(JSON.stringify(view).includes(actual.privateMarker), false); }
});

test('using a Full Heal pair as a sunny weather payment never cures a status or activates its tool side', t => {
  const f = fixture(t); f.play('scyther', 2); f.player(f.leader).active.status = 'burn'; const cardId = tool(f); f.attack({ cardId, moveIndex: 1, targetIds: [f.leader.playerId] }); f.respond(); assert.equal(f.player(f.leader).active.status, 'burn'); assert.deepEqual(f.player(f.leader).active.reinforcements, ['power']); assert.equal(countCard(f.room(), cardId), 1); assert.equal(f.room().turn.commandCreatureId, null);
});

test('using a Rare Candy pair as sunny Light Screen payment never levels either Pokémon', t => {
  const f = fixture(t); f.play('jynx', 2); const sourceLevel = f.player(f.leader).active.level, targetLevel = f.player(f.target).active.level, cardId = tool(f, f.leader, 'rare-candy-nugget'); f.attack({ cardId, moveIndex: 1 }); f.respond(); assert.equal(f.player(f.leader).active.level, sourceLevel); assert.equal(f.player(f.target).active.level, targetLevel); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(countCard(f.room(), cardId), 1);
});

test('a physical tool pair cannot pay for an actual command merely because its weather is sunny', t => {
  const f = fixture(t); f.play(); const cardId = tool(f); rejectsAtomically(f, () => f.attack({ cardId })); assert.equal(f.player(f.leader).hand.some(card => card.id === cardId), true);
});

test('a tool pair used as another real discard cost does not activate either printed tool effect', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'aerodactyl', 1, { status: 'burn' }); const cost = f.supply(f.target), cardId = tool(f); f.attack(); f.respond('discard', { cardId: cost }); assert.equal(f.room().pendingBattle.kind, 'pressure-payment'); f.respond('discard', { cardId }); f.respond(); assert.equal(f.player(f.target).active.status, 'burn'); assert.equal(f.player(f.target).active.level, 1); assert.equal(countCard(f.room(), cardId), 1);
});

test('Gas and paralysis cannot impose a distance restriction on either trainer tool effect', t => {
  const f = fixture(t, { count: 6 }); f.play(); f.player(f.leader).active.status = 'paralysis'; f.seed(f.third, 'koffing'); const gas = f.supply(f.third); start(f); f.respond('suppress', { cardId: gas, targetId: f.leader.playerId }); drawToPlay(f); const far = f.byId(f.room().players[3].id); f.player(far).active.status = 'burn'; const heal = tool(f), candy = tool(f, f.leader, 'rare-candy-nugget'); assert.equal(hasTarget(f, 'full-heal', far), true); assert.equal(hasTarget(f, 'rare-candy', far), true); use(f, heal, 'full-heal', far); use(f, candy, 'rare-candy', far); assert.equal(f.player(far).active.status, null); assert.equal(f.player(far).active.level, 2); assert.equal(f.player(f.leader).active.status, 'paralysis'); assert.deepEqual(f.room().turn.suppressedTraitPlayerIds, [f.leader.playerId]);
});

test('Full Heal clears a target status without clearing its independent Gas suppression or turn protections', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.status = 'poison'; f.seed(f.third, 'koffing'); const gas = f.supply(f.third); start(f); f.respond('suppress', { cardId: gas, targetId: f.target.playerId }); drawToPlay(f); const instance = f.player(f.target).active.instanceId; f.room().turn.damageImmunityIds = [instance]; const cardId = tool(f); use(f, cardId); assert.equal(f.player(f.target).active.status, null); assert.deepEqual(f.room().turn.suppressedTraitPlayerIds, [f.target.playerId]); assert.deepEqual(f.room().turn.damageImmunityIds, [instance]);
});
