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
  const dir = mkdtempSync(join(root, 'nugget-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ allowTestDecks: true, dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `nugget-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates, activeId = candidates.find(id => !['koffing', 'jynx', 'tauros'].includes(id)); act(who, 'selectPokemon', { activeId, reserveId: candidates.find(id => id !== activeId) }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-nugget-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private Nugget card ${serial}` } });
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

const tool = (f, who = f.leader, toolType = 'rare-candy-nugget') => { const card = { ...f.makeCard('tool', 'clear'), toolType, name: { zh: '神奇糖果／金珠', en: 'Rare Candy / Nugget' } }; f.player(who).hand.push(card); return card.id; };
const nugget = (f, cardId, recipient = f.target, actor = f.leader) => f.act(actor, 'useTool', { cardId, effect: 'nugget', targetId: recipient.playerId });
const descriptor = (f, viewer = f.leader) => f.view(viewer).self.battle.tools.find(tool => tool.toolType === 'rare-candy-nugget')?.choices.find(choice => choice.effect === 'nugget');
const start = (f, who = f.leader) => f.store.startTurn(f.room(), who.playerId, f.room().turn.number + 1);
const drawToPlay = (f, who = f.leader) => { while (f.room().turn.drawRemaining) f.act(who, 'draw'); };
const enterEnd = (f, who = f.leader) => { f.act(who, 'finishPlay'); while (f.room().turn.phase === 'discard') f.act(who, 'discard', { cardId: f.player(who).hand[0].id }); };

test('Nugget is an enabled trainer-targeted choice on a held Rare Candy pair only', t => {
  const f = fixture(t); f.play(); assert.equal(descriptor(f), undefined); tool(f, f.leader, 'potion-full-heal'); assert.equal(descriptor(f), undefined); tool(f); const choice = descriptor(f); assert.equal(choice.targeting, 'trainer'); assert.equal(choice.unavailableReason, undefined); assert.ok(choice.name.zh); assert.ok(choice.name.en); assert.ok(choice.description.zh); assert.ok(choice.description.en); assert.deepEqual(new Set(choice.targets.map(target => target.targetId)), new Set(f.seats.map(who => who.playerId))); assert.ok(choice.targets.every(target => Object.keys(target).length === 1));
});

test('Nugget gives exactly the next two actual cards to the chosen other trainer and discards the entire physical pair', t => {
  const f = fixture(t); f.play(); const cards = f.top('rain', 'thunderstorm'), cardId = tool(f), physical = structuredClone(f.player(f.leader).hand.find(card => card.id === cardId)), before = allCards(f.room()).length; nugget(f, cardId); assert.deepEqual(f.player(f.target).hand, cards); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(f.player(f.third).hand.length, 0); assert.deepEqual(f.room().discardPile.find(card => card.id === cardId), physical); assert.equal(countCard(f.room(), cardId), 1); assert.equal(allCards(f.room()).length, before); for (const card of cards) assert.equal(countCard(f.room(), card.id), 1);
});

test('Nugget may target its current trainer without transferring a held card or changing ordinary Draw counts', t => {
  const f = fixture(t); f.play(); const retained = f.supply(f.leader, 'dodge'), cards = f.top('rain', 'clear'), cardId = tool(f); nugget(f, cardId, f.leader); assert.deepEqual(ids(f.player(f.leader).hand), [retained, ...ids(cards)]); assert.equal(f.room().turn.drawRemaining, 0); assert.equal(f.room().turn.phase, 'play'); assert.equal(f.player(f.target).hand.length, 0); assert.equal(f.player(f.third).hand.length, 0);
});

test('Nugget targets distant living trainers without a range grant even under paralysis', t => {
  const f = fixture(t, { count: 6 }); f.play(); f.player(f.leader).active.status = 'paralysis'; const far = f.byId(f.room().players[3].id), cardId = tool(f); assert.equal(f.view(f.leader).self.battle.legalTargetIds.includes(far.playerId), false); assert.ok(descriptor(f).targets.some(target => target.targetId === far.playerId)); nugget(f, cardId, far); assert.equal(f.player(far).hand.length, 2); assert.equal(f.player(f.leader).active.status, 'paralysis');
});

test('Nugget target projection excludes spectators and eliminated trainers while retaining empty hands', t => {
  const f = fixture(t, { count: 4 }); f.play(); const eliminated = f.seats.find(who => ![f.leader, f.target].includes(who)); f.player(eliminated).eliminated = true; const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); tool(f); assert.equal(f.player(f.target).hand.length, 0); const ids = descriptor(f).targets.map(target => target.targetId); assert.equal(ids.includes(f.target.playerId), true); assert.equal(ids.includes(eliminated.playerId), false); assert.equal(ids.includes(observer.playerId), false);
});

test('Nugget does not inspect or change active/reserve level, HP, injury, status, markers or item', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'snorlax', 3, { damage: 2, status: 'burn', reinforcements: ['power', 'defense', 'speed'] }); f.helmet(f.target); Object.assign(f.player(f.target).reserve, { level: 3, damage: 1, status: 'poison', revealed: false }); const active = structuredClone(f.player(f.target).active), reserve = structuredClone(f.player(f.target).reserve), cardId = tool(f); nugget(f, cardId); assert.deepEqual(f.player(f.target).active, active); assert.deepEqual(f.player(f.target).reserve, reserve); assert.equal(f.player(f.target).hand.length, 2); assert.equal(f.room().entryEvent ?? null, null);
});

test('finite Nugget supply draws zero, one or two actual cards and never recycles its in-use pair', t => {
  for (const available of [0, 1, 2, 3]) { const f = fixture(t); f.play(); f.room().drawPile = []; f.room().discardPile = []; const cards = f.top(...Array(available).fill('rain')), cardId = tool(f); nugget(f, cardId); assert.deepEqual(f.player(f.target).hand, cards.slice(0, 2)); assert.equal(f.room().drawPile.length, Math.max(0, available - 2)); assert.deepEqual(ids(f.room().discardPile), [cardId]); assert.equal(allCards(f.room()).length, available + 1); assert.equal(countCard(f.room(), cardId), 1); }
});

test('a completely empty pile still consumes Nugget without a fictional card or pending decision', t => {
  const f = fixture(t); f.play(); f.room().drawPile = []; f.room().discardPile = []; const cardId = tool(f); nugget(f, cardId, f.leader); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null); assert.equal(f.room().discardPile.length, 1); assert.equal(f.room().discardPile[0].id, cardId); rejectsAtomically(f, () => nugget(f, cardId, f.leader));
});

test('Nugget exhausts an existing deck top before refilling the next actual discard', t => {
  const f = fixture(t); f.play(); f.room().drawPile = []; const top = f.top('rain')[0], discarded = f.makeCard('dodge', 'clear'); f.room().discardPile = [discarded]; const cardId = tool(f); nugget(f, cardId); assert.deepEqual(f.player(f.target).hand, [top, discarded]); assert.deepEqual(ids(f.room().discardPile), [cardId]); assert.equal(f.room().drawPile.length, 0); for (const id of [top.id, discarded.id, cardId]) assert.equal(countCard(f.room(), id), 1);
});

test('Nugget may refill an entirely empty deck using real discards without duplicating or discarding the gained cards', t => {
  const f = fixture(t); f.play(); f.room().drawPile = []; const cards = [f.makeCard('event', 'rain'), f.makeCard('dodge', 'clear')]; f.room().discardPile = [...cards]; const cardId = tool(f); nugget(f, cardId); assert.deepEqual(new Set(ids(f.player(f.target).hand)), new Set(ids(cards))); assert.deepEqual(ids(f.room().discardPile), [cardId]); assert.equal(f.room().drawPile.length, 0); assert.equal(allCards(f.room()).length, 3);
});

test('active Meowth levels one and two receive the two-card batch before one actual Pickup bonus', t => {
  for (const level of [1, 2]) { const f = fixture(t); f.play(); f.seed(f.target, 'meowth', level); const cards = f.top('rain', 'clear', 'thunderstorm'), cardId = tool(f); nugget(f, cardId); assert.deepEqual(f.player(f.target).hand, cards); assert.deepEqual(f.room().turn.pickupUsedIds, [f.player(f.target).active.instanceId]); assert.equal(f.room().discardPile.some(card => card.id === cardId), true); }
});

test('self-targeted Nugget triggers Pickup during Play without giving the current trainer its discarded pair back', t => {
  const f = fixture(t); f.play('meowth'); const cards = f.top('rain', 'clear', 'thunderstorm'), cardId = tool(f); nugget(f, cardId, f.leader); assert.deepEqual(f.player(f.leader).hand, cards); assert.deepEqual(f.room().turn.pickupUsedIds, [f.player(f.leader).active.instanceId]); assert.equal(f.player(f.leader).hand.some(card => card.id === cardId), false); assert.equal(countCard(f.room(), cardId), 1);
});

test('Pickup receives only supply remaining after the base Nugget batch and cannot recycle the still-in-use tool', t => {
  for (const available of [0, 1, 2, 3]) { const f = fixture(t); f.play(); f.seed(f.target, 'meowth'); f.room().drawPile = []; f.room().discardPile = []; const cards = f.top(...Array(available).fill('rain')), cardId = tool(f); nugget(f, cardId); assert.deepEqual(f.player(f.target).hand, cards); assert.equal(f.player(f.target).hand.some(card => card.id === cardId), false); assert.deepEqual(f.room().turn.pickupUsedIds, available ? [f.player(f.target).active.instanceId] : []); assert.deepEqual(ids(f.room().discardPile), [cardId]); assert.equal(f.room().drawPile.length, 0); }
});

test('an exhausted Pickup attempt is spent and a later Nugget in the same global turn cannot retry its bonus', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'meowth'); f.room().drawPile = []; f.room().discardPile = []; const first = f.top('rain', 'clear'), cardId = tool(f); nugget(f, cardId); assert.deepEqual(f.player(f.target).hand, first); assert.deepEqual(f.room().turn.pickupUsedIds, [f.player(f.target).active.instanceId]); const more = f.top('rain', 'clear', 'thunderstorm'), second = tool(f); nugget(f, second); assert.deepEqual(f.player(f.target).hand, [...first, ...more.slice(0, 2)]); assert.equal(f.room().drawPile.at(-1).id, more[2].id); assert.equal(countCard(f.room(), cardId), 1);
});

test('two Nugget gains in one global turn trigger Pickup only once for that active instance', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'meowth', 2); const first = tool(f), second = tool(f), cards = f.top('rain', 'clear', 'thunderstorm', 'rain', 'clear', 'thunderstorm'); nugget(f, first); assert.deepEqual(f.player(f.target).hand, cards.slice(0, 3)); nugget(f, second); assert.deepEqual(f.player(f.target).hand, cards.slice(0, 5)); assert.equal(f.room().drawPile.at(-1).id, cards[5].id); assert.deepEqual(f.room().turn.pickupUsedIds, [f.player(f.target).active.instanceId]);
});

test('Meowth source pays Nugget without Pickup while the distinct Meowth receiver gets its own one bonus', t => {
  const f = fixture(t); f.play('meowth'); f.seed(f.target, 'meowth'); const cards = f.top('rain', 'clear', 'thunderstorm'), cardId = tool(f); nugget(f, cardId); assert.equal(f.player(f.leader).hand.length, 0); assert.deepEqual(f.player(f.target).hand, cards); assert.deepEqual(f.room().turn.pickupUsedIds, [f.player(f.target).active.instanceId]);
});

test('reserve-only, level-three and defeated Meowth do not trigger Pickup for the living recipient trainer', t => {
  for (const scenario of ['reserve', 'level-three', 'defeated']) { const f = fixture(t); f.play(); if (scenario === 'reserve') f.player(f.target).reserve.catalogueId = 'meowth'; else f.seed(f.target, 'meowth', scenario === 'level-three' ? 3 : 1, scenario === 'defeated' ? { defeated: true } : {}); const cards = f.top('rain', 'clear', 'thunderstorm'), cardId = tool(f); nugget(f, cardId); assert.deepEqual(f.player(f.target).hand, cards.slice(0, 2)); assert.equal(f.room().drawPile.at(-1).id, cards[2].id); assert.deepEqual(f.room().turn.pickupUsedIds, []); }
});

test('next global turn resets Pickup and normal own Draw does not consume its newly available bonus', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'meowth'); const ownNugget = tool(f, f.target), first = tool(f); nugget(f, first); const oldInstance = f.player(f.target).active.instanceId; assert.ok(f.room().turn.pickupUsedIds.includes(oldInstance)); enterEnd(f); f.act(f.leader, 'endTurn', { levelUp: false }); assert.equal(f.room().turn.playerId, f.target.playerId); assert.deepEqual(f.room().turn.pickupUsedIds, []); drawToPlay(f, f.target); assert.deepEqual(f.room().turn.pickupUsedIds, []); const before = f.player(f.target).hand.length; nugget(f, ownNugget, f.target, f.target); assert.equal(f.player(f.target).hand.length, before + 2); assert.deepEqual(f.room().turn.pickupUsedIds, [oldInstance]);
});

test('Nugget draws fresh pile cards without transferring any retained source hand card', t => {
  const f = fixture(t); f.play(); const kept = [f.supply(f.leader), f.supply(f.leader, 'dodge')], existing = f.supply(f.target, 'event'), cards = f.top('rain', 'clear'), cardId = tool(f); nugget(f, cardId); assert.deepEqual(ids(f.player(f.leader).hand), kept); assert.deepEqual(ids(f.player(f.target).hand), [existing, ...ids(cards)]); assert.equal(f.player(f.target).hand.some(card => kept.includes(card.id)), false); assert.equal(f.player(f.target).hand.some(card => card.id === cardId), false);
});

test('Nugget does not create weather judgments, battle responses, command counters or marker consumption', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.reinforcements = ['power', 'power']; f.seed(f.target, 'aerodactyl'); f.supply(f.target); f.helmet(f.target); f.seed(f.third, 'vulpix'); const weatherCard = f.supply(f.third, 'event', 'clear'), cardId = tool(f), beforeTurn = structuredClone(f.room().turn); nugget(f, cardId); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null); assert.equal(f.room().judgment ?? null, null); assert.deepEqual(f.room().turn, beforeTurn); assert.deepEqual(f.player(f.leader).active.reinforcements, ['power', 'power']); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.third).hand.some(card => card.id === weatherCard), true);
});

test('command, move, switch and status restrictions do not consume or block an otherwise legal Nugget action', t => {
  const f = fixture(t); f.play(); const instance = f.player(f.leader).active.instanceId; f.player(f.leader).active.status = 'sleep'; Object.assign(f.room().turn, { commandCreatureId: f.player(f.leader).reserve.instanceId, usedMoves: [`${instance}:水枪`], movesBlocked: true, blockedMoveIds: [instance], switchUsed: true, switchBlocked: true, traitsUsed: [instance] }); const before = structuredClone(f.room().turn), cardId = tool(f); nugget(f, cardId); assert.deepEqual(f.room().turn, before); assert.equal(f.player(f.leader).active.status, 'sleep'); assert.equal(f.player(f.target).hand.length, 2);
});

test('Nugget requires its actual current trainer authority and rejects a spectator', t => {
  const f = fixture(t); f.play(); const foreign = tool(f, f.target); rejectsAtomically(f, () => nugget(f, foreign, f.target, f.target), 'NOT_YOUR_TURN'); const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }), own = tool(f, observer); rejectsAtomically(f, () => nugget(f, own, f.target, observer), 'SPECTATOR_ONLY_VIEW');
});

test('Draw, Discard and End phases cannot play Nugget or project usable trainer targets', t => {
  for (const phase of ['draw', 'discard', 'end']) { const f = fixture(t); f.play(); const cardId = tool(f); f.room().turn.phase = phase; assert.deepEqual(descriptor(f).targets, []); rejectsAtomically(f, () => nugget(f, cardId)); }
});

test('pending battle defense blocks Nugget without consuming the tool or inventing cards', t => {
  const f = fixture(t); f.play(); const cardId = tool(f); f.attack(); assert.equal(f.room().pendingBattle.kind, 'defense'); assert.deepEqual(descriptor(f).targets, []); rejectsAtomically(f, () => nugget(f, cardId), 'RESPONSE_PENDING'); assert.equal(f.player(f.target).hand.length, 0); assert.equal(f.player(f.leader).hand.some(card => card.id === cardId), true); f.drain(); nugget(f, cardId); assert.equal(f.player(f.target).hand.length, 2);
});

test('closing votes block Nugget and preserve its physical card until the vote is rejected', t => {
  const f = fixture(t); f.play(); const cardId = tool(f); f.act(f.owner, 'requestEndGame'); assert.deepEqual(descriptor(f).targets, []); rejectsAtomically(f, () => nugget(f, cardId), 'VOTE_PENDING'); assert.equal(f.player(f.target).hand.length, 0); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); nugget(f, cardId); assert.equal(f.player(f.target).hand.length, 2);
});

test('Nugget rejects a Pokémon slot field and every invented draw count, payment or move selector atomically', t => {
  const f = fixture(t); f.play(); const cardId = tool(f); for (const slot of ['active', 'reserve', null, '', 0, {}]) rejectsAtomically(f, () => f.act(f.leader, 'useTool', { cardId, effect: 'nugget', targetId: f.target.playerId, slot }));
  for (const extra of [{ count: 3 }, { amount: 2 }, { drawCount: 2 }, { cardIds: [] }, { targetIds: [f.target.playerId] }, { recipientId: f.third.playerId }, { moveIndex: 0 }, { effectChoice: 'draw' }, { hpLoss: 0 }, { decisionId: 'forged' }]) rejectsAtomically(f, () => f.act(f.leader, 'useTool', { cardId, effect: 'nugget', targetId: f.target.playerId, ...extra }));
});

test('Nugget target is a living trainer ID and not a spectator, eliminated trainer, Pokémon instance or forged identity', t => {
  const f = fixture(t, { count: 4 }); f.play(); const cardId = tool(f), excluded = f.seats.find(who => ![f.leader, f.target].includes(who)); f.player(excluded).eliminated = true; const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); for (const targetId of [excluded.playerId, observer.playerId, f.player(f.target).active.instanceId, 'forged', undefined, null, 1, {}]) rejectsAtomically(f, () => f.act(f.leader, 'useTool', { cardId, effect: 'nugget', targetId }));
});

test('wrong pair, wrong card kind and foreign or forged physical identities cannot execute Nugget', t => {
  const f = fixture(t); f.play(); const wrong = tool(f, f.leader, 'potion-full-heal'), foreign = tool(f, f.target), unknown = tool(f, f.leader, 'unknown-pair'), fake = { ...f.makeCard('event', 'clear'), toolType: 'rare-candy-nugget' }; f.player(f.leader).hand.push(fake); for (const cardId of [wrong, foreign, unknown, fake.id, 'forged', undefined, null, 1, {}]) rejectsAtomically(f, () => nugget(f, cardId)); assert.equal(f.player(f.target).hand.length, 1);
});

test('a stale Nugget request cannot consume its card or apply draw after another legal action changed the revision', t => {
  const f = fixture(t); f.play(); const stale = tool(f), other = tool(f), request = f.input('useTool', { cardId: stale, effect: 'nugget', targetId: f.target.playerId }); nugget(f, other, f.third); rejectsAtomically(f, () => f.store.action(f.owner.code, f.leader.token, request), 'STALE_REVISION'); assert.equal(f.player(f.target).hand.length, 0); assert.equal(f.player(f.leader).hand.some(card => card.id === stale), true);
});

test('an exact Nugget retry preserves the same two-card gain and one discarded physical pair', t => {
  const f = fixture(t); f.play(); const cards = f.top('rain', 'clear'), cardId = tool(f), request = f.input('useTool', { cardId, effect: 'nugget', targetId: f.target.playerId }); f.store.action(f.owner.code, f.leader.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), once); assert.deepEqual(f.player(f.target).hand, cards); assert.equal(countCard(f.room(), cardId), 1);
});

test('an exact Nugget retry cannot duplicate its mandatory Pickup bonus or spend another trigger', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'meowth'); const cards = f.top('rain', 'clear', 'thunderstorm'), cardId = tool(f), request = f.input('useTool', { cardId, effect: 'nugget', targetId: f.target.playerId }); f.store.action(f.owner.code, f.leader.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), once); assert.deepEqual(f.player(f.target).hand, cards); assert.deepEqual(f.room().turn.pickupUsedIds, [f.player(f.target).active.instanceId]);
});

test('a used Nugget action ID cannot be reused for another recipient or another real card', t => {
  const f = fixture(t); f.play(); const first = tool(f), second = tool(f), request = f.input('useTool', { cardId: first, effect: 'nugget', targetId: f.target.playerId }); f.store.action(f.owner.code, f.leader.token, request); rejectsAtomically(f, () => f.store.action(f.owner.code, f.leader.token, { ...request, cardId: second, targetId: f.third.playerId }), 'ACTION_ID_REUSED'); assert.equal(f.player(f.third).hand.length, 0); assert.equal(f.player(f.leader).hand.some(card => card.id === second), true);
});

test('restart preserves actual gained cards, spent Pickup and idempotent Nugget requests', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'meowth'); const cards = f.top('rain', 'clear', 'thunderstorm'), cardId = tool(f), request = f.input('useTool', { cardId, effect: 'nugget', targetId: f.target.playerId }); f.store.action(f.owner.code, f.leader.token, request); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }); restored.view(f.owner.code, f.leader.token); const before = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.leader.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), before); const recipient = restored.rooms.get(f.owner.code).players.find(player => player.id === f.target.playerId); assert.deepEqual(recipient.hand, cards); assert.deepEqual(restored.rooms.get(f.owner.code).turn.pickupUsedIds, [recipient.active.instanceId]); assert.equal(countCard(restored.rooms.get(f.owner.code), cardId), 1);
});

test('restart before Nugget preserves the original physical pair and exact next actual draw identities', t => {
  const f = fixture(t); f.play(); const cards = f.top('rain', 'clear'), cardId = tool(f); f.store.persist(f.room()); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.leader.token).view; restored.action(f.owner.code, f.leader.token, { id: 'restored-new-nugget', revision: view.revision, type: 'useTool', cardId, effect: 'nugget', targetId: f.target.playerId }); const room = restored.rooms.get(f.owner.code); assert.deepEqual(room.players.find(player => player.id === f.target.playerId).hand, cards); assert.equal(countCard(room, cardId), 1);
});

test('Nugget drawn identities are private to the recipient and never exposed to other trainers or spectators', t => {
  const f = fixture(t); f.play(); const cards = f.top('rain', 'clear'), cardId = tool(f), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); nugget(f, cardId); assert.deepEqual(f.view(f.target).self.hand, cards); for (const who of [f.leader, f.third, observer]) { const view = f.view(who); for (const card of cards) { assert.equal(JSON.stringify(view).includes(card.id), false); assert.equal(JSON.stringify(view).includes(card.privateMarker), false); } assert.equal(JSON.stringify(view).includes(cardId), false); }
});

test('Nugget can raise another trainer hand above four without opening an immediate discard decision', t => {
  const f = fixture(t); f.play(); for (let i = 0; i < 4; i++) f.supply(f.target); const cardId = tool(f); nugget(f, cardId); assert.equal(f.player(f.target).hand.length, 6); assert.equal(f.room().turn.playerId, f.leader.playerId); assert.equal(f.room().turn.phase, 'play'); assert.equal(f.room().pendingBattle, null); rejectsAtomically(f, () => f.act(f.target, 'discard', { cardId: f.player(f.target).hand[0].id }), 'NOT_YOUR_TURN');
});

test('self Nugget gain leaves excess cards until ordinary own Discard after Play', t => {
  const f = fixture(t); f.play(); for (let i = 0; i < 4; i++) f.supply(f.leader); const cardId = tool(f); nugget(f, cardId, f.leader); assert.equal(f.player(f.leader).hand.length, 6); assert.equal(f.room().turn.phase, 'play'); rejectsAtomically(f, () => f.act(f.leader, 'discard', { cardId: f.player(f.leader).hand[0].id })); f.act(f.leader, 'finishPlay'); assert.equal(f.room().turn.phase, 'discard'); while (f.room().turn.phase === 'discard') f.act(f.leader, 'discard', { cardId: f.player(f.leader).hand[0].id }); assert.equal(f.player(f.leader).hand.length, 4);
});

test('Gas suppresses the recipient Pickup but never the Nugget trainer draw or range', t => {
  const f = fixture(t, { count: 6 }); f.play(); const far = f.byId(f.room().players[3].id); f.seed(far, 'meowth'); const actor = f.seats.find(who => ![f.leader, far].includes(who)); f.seed(actor, 'koffing'); const cost = f.supply(actor); start(f); f.respond('suppress', { cardId: cost, targetId: far.playerId }); drawToPlay(f); const cards = f.top('rain', 'clear', 'thunderstorm'), cardId = tool(f); nugget(f, cardId, far); assert.deepEqual(f.player(far).hand, cards.slice(0, 2)); assert.equal(f.room().drawPile.at(-1).id, cards[2].id); assert.deepEqual(f.room().turn.pickupUsedIds, []);
});

test('Nugget paid as a sunny weather card never activates its draw effect', t => {
  const f = fixture(t); f.play('jynx', 2); const cardId = tool(f), top = f.room().drawPile.at(-1).id; f.attack({ cardId, moveIndex: 1 }); f.respond(); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(f.player(f.target).hand.length, 0); assert.equal(f.player(f.leader).hand.length, 0); assert.equal(f.room().drawPile.at(-1).id, top); assert.equal(countCard(f.room(), cardId), 1);
});

test('a Rare Candy pair cannot execute both its Candy side and Nugget side after being consumed', t => {
  const f = fixture(t); f.play(); const cardId = tool(f); f.act(f.leader, 'useTool', { cardId, effect: 'rare-candy', targetId: f.target.playerId, slot: 'active' }); assert.equal(f.player(f.target).active.level, 2); rejectsAtomically(f, () => nugget(f, cardId)); assert.equal(f.player(f.target).hand.length, 0); assert.equal(countCard(f.room(), cardId), 1);
});
