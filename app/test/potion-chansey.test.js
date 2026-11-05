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
  const dir = mkdtempSync(join(root, 'potion-chansey-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let serial = 0, time = 1_000_000;
  const now = () => time, store = new RoomStore({ dataDir: dir, catalogue, now });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const room = () => store.rooms.get(owner.code), player = who => room().players.find(p => p.id === who.playerId);
  const byId = id => seats.find(who => who.playerId === id), view = who => store.view(owner.code, who.token).view;
  const input = (type, payload = {}) => ({ id: `potion-chansey-${++serial}`, revision: room().revision, type, ...payload });
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, input(type, payload)).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds });
  seats.forEach(who => act(who, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(room().players.find(p => p.role === 'leader').id);
  seats.forEach(who => act(who, 'acknowledgeIdentity'));
  for (const who of seats) { for (let i = 0; i < 5; i++) act(who, 'drawPokemon'); const candidates = view(who).self.candidates, activeId = candidates.find(id => !['koffing', 'jynx', 'tauros'].includes(id)); act(who, 'selectPokemon', { activeId, reserveId: candidates.find(id => id !== activeId) }); }
  const seed = (who, family = 'squirtle', level = 1, extra = {}) => Object.assign(player(who).active, { instanceId: `private-active-${who.playerId}`, catalogueId: family, level, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: true, ...extra });
  for (const who of seats) { seed(who); Object.assign(player(who).reserve, { instanceId: `private-reserve-${who.playerId}`, catalogueId: 'squirtle', level: 1, damage: 0, status: null, reinforcements: [], hpBonus: 20, defeated: false, revealed: false }); player(who).hand = []; }
  const makeCard = (kind = 'event', weather = 'clear') => ({ id: `private-potion-chansey-${++serial}`, kind, weather, fixture: true, privateMarker: `secret-${serial}`, name: { zh: `私牌${serial}`, en: `Private Potion Chansey card ${serial}` } });
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

const tool = (f, who = f.leader, toolType = 'potion-full-heal') => { const card = { ...f.makeCard('tool', 'clear'), toolType, name: { zh: '伤药组合道具', en: 'Potion split tool' } }; f.player(who).hand.push(card); return card.id; };
const potion = (f, cardId, who = f.target, slot = 'active') => f.act(f.leader, 'useTool', { cardId, effect: 'potion', targetId: who.playerId, slot });
const rescue = (f, extra = {}, payload = {}) => { f.seed(f.target, 'charmander', 1, { hpBonus: 0, damage: 2, ...extra }); f.attack(payload); f.respond(); if (f.room().pendingBattle?.kind === 'double-edge') f.respond(); assert.equal(f.room().pendingBattle.kind, 'rescue'); };
const save = (f, cardId, choice = 'potion') => f.respond(choice, { cardId });
const untilActor = (f, who) => { for (let i = 0; f.room().pendingBattle?.kind === 'rescue' && f.room().pendingBattle.actorId !== who.playerId && i < 8; i++) f.respond(); assert.equal(f.room().pendingBattle.actorId, who.playerId); };
const start = (f, who = f.leader) => f.store.startTurn(f.room(), who.playerId, f.room().turn.number + 1);
const drawToPlay = f => { while (f.room().turn.drawRemaining) f.act(f.leader, 'draw'); };

test('Potion works on both pairs and Revive requires a formally defeated target', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.damage = 1; tool(f); tool(f, f.leader, 'potion-revive'); const tools = f.view(f.leader).self.battle.tools; for (const toolType of ['potion-full-heal', 'potion-revive']) { const entry = tools.find(tool => tool.toolType === toolType); assert.ok(entry); const choice = entry.choices.find(choice => choice.effect === 'potion'); assert.equal(choice.unavailableReason, undefined); assert.ok(choice.targets.some(target => target.targetId === f.target.playerId && target.slot === 'active')); } const revive = tools.find(tool => tool.toolType === 'potion-revive').choices.find(choice => choice.effect === 'revive'); assert.equal(revive.unavailableReason, undefined); assert.deepEqual(revive.targets, []);
});

test('Revive restores the formally defeated Pokémon to exactly 2 HP in its reserve slot', t => {
  const f = fixture(t);
  f.play();
  const cardId = tool(f, f.leader, 'potion-revive');
  rescue(f);
  const defeatedId = f.player(f.target).active.instanceId;
  rejectsAtomically(f, () => f.act(f.leader, 'useTool', { cardId, effect: 'revive', targetId: f.target.playerId, slot: 'active' }), 'RESPONSE_PENDING');
  f.drain();
  const deployedId = f.player(f.target).active.instanceId;
  assert.equal(f.player(f.target).reserve.instanceId, defeatedId);
  assert.equal(f.player(f.target).reserve.defeated, true);
  f.act(f.leader, 'useTool', { cardId, effect: 'revive', targetId: f.target.playerId, slot: 'reserve' });
  assert.equal(f.player(f.target).active.instanceId, deployedId);
  assert.equal(f.player(f.target).reserve.instanceId, defeatedId);
  const publicReserve = f.view(f.third).players.find(player => player.id === f.target.playerId).reserve;
  assert.equal(publicReserve.hp, 2);
  assert.equal(publicReserve.defeated, false);
  assert.equal(f.room().discardPile.filter(card => card.id === cardId).length, 1);
  start(f, f.target);
  while (f.room().turn.drawRemaining) f.act(f.target, 'draw');
  f.act(f.target, 'switchPokemon');
  assert.equal(f.player(f.target).active.instanceId, defeatedId);
});

test('Revive cannot target a defeated Pokémon belonging to an eliminated trainer', t => {
  const f = fixture(t);
  f.play();
  Object.assign(f.player(f.target).reserve, { defeated: true, revealed: true });
  f.player(f.target).eliminated = true;
  const cardId = tool(f, f.leader, 'potion-revive');
  rejectsAtomically(f, () => f.act(f.leader, 'useTool', { cardId, effect: 'revive', targetId: f.target.playerId, slot: 'reserve' }), 'INVALID_TARGET');
});

test('ordinary Potion heals two capped at full HP and spends either entire physical pair exactly once', t => {
  for (const type of ['potion-full-heal', 'potion-revive']) for (const injury of [1, 2, 4]) { const f = fixture(t); f.play(); f.player(f.target).active.damage = injury; f.player(f.target).active.status = 'burn'; const before = structuredClone(f.player(f.target).active), cardId = tool(f, f.leader, type), card = structuredClone(f.player(f.leader).hand[0]); potion(f, cardId); assert.deepEqual(f.player(f.target).active, { ...before, damage: Math.max(0, injury - 2) }); assert.deepEqual(f.room().discardPile.find(card => card.id === cardId), card); assert.equal(countCard(f.room(), cardId), 1); assert.equal(f.room().pendingBattle, null); }
});

test('ordinary Potion targets distant active or revealed reserves and reveals an own hidden reserve without switching', t => {
  const f = fixture(t, { count: 6 }); f.play(); const far = f.byId(f.room().players[3].id); Object.assign(f.player(far).reserve, { revealed: true, damage: 2 }); f.player(far).active.damage = 2; const first = tool(f), second = tool(f), third = tool(f); potion(f, first, far); potion(f, second, far, 'reserve'); f.player(f.leader).reserve.damage = 2; const active = structuredClone(f.player(f.leader).active); potion(f, third, f.leader, 'reserve'); assert.equal(f.player(far).active.damage, 0); assert.equal(f.player(far).reserve.damage, 0); assert.equal(f.player(f.leader).reserve.damage, 0); assert.equal(f.player(f.leader).reserve.revealed, true); assert.deepEqual(f.player(f.leader).active, active); assert.equal(f.room().entryEvent ?? null, null);
});

test('ordinary Potion rejects healthy, fainting, defeated and private opposing reserves without revealing hidden injuries', t => {
  for (const scenario of ['healthy', 'fainting', 'defeated', 'hidden']) { const f = fixture(t); f.play(); if (scenario === 'fainting') Object.assign(f.player(f.target).active, { hpBonus: 0, damage: 3 }); else if (scenario === 'defeated') Object.assign(f.player(f.target).active, { damage: 1, defeated: true }); else if (scenario === 'hidden') f.player(f.target).reserve.damage = 2; const cardId = tool(f); rejectsAtomically(f, () => potion(f, cardId, f.target, scenario === 'hidden' ? 'reserve' : 'active')); }
});

test('ordinary Potion requires a real matching own pair and cannot execute Revive or Healer conversion', t => {
  const f = fixture(t); f.play('chansey', 2); f.player(f.target).active.damage = 2; const sunny = f.supply(f.leader, 'event', 'clear'), wrong = tool(f, f.leader, 'rare-candy-nugget'), revive = tool(f, f.leader, 'potion-revive'), foreign = tool(f, f.target); for (const cardId of [sunny, wrong, foreign, 'forged']) rejectsAtomically(f, () => potion(f, cardId)); rejectsAtomically(f, () => f.act(f.leader, 'useTool', { cardId: revive, effect: 'revive', targetId: f.target.playerId, slot: 'active' })); rejectsAtomically(f, () => f.act(f.leader, 'useTrait'));
});

test('ordinary Potion strict target fields reject malformed slots, selectors and nontrainer identities before consuming', t => {
  const f = fixture(t); f.play(); f.player(f.target).active.damage = 2; const cardId = tool(f); for (const slot of [undefined, null, 'bench', 1, {}]) rejectsAtomically(f, () => f.act(f.leader, 'useTool', { cardId, effect: 'potion', targetId: f.target.playerId, slot })); for (const extra of [{ amount: 4 }, { targetIds: [] }, { cardIds: [] }, { choice: 'potion' }, { decisionId: 'forged' }]) rejectsAtomically(f, () => f.act(f.leader, 'useTool', { cardId, effect: 'potion', targetId: f.target.playerId, slot: 'active', ...extra }));
});

test('a real Potion rescues immediately at positive HP without cycling to later rescue actors or deploying the reserve', t => {
  const f = fixture(t); f.play(); const cardId = tool(f), original = f.player(f.target).active.instanceId, incoming = f.player(f.target).reserve.instanceId; rescue(f); const actual = f.player(f.target).active.instanceId; assert.equal(actual, original); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); save(f, cardId); assert.equal(f.player(f.target).active.instanceId, actual); assert.equal(f.player(f.target).reserve.instanceId, incoming); assert.equal(f.player(f.target).active.defeated, false); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle, null); assert.equal(f.room().resolution, null); assert.equal(countCard(f.room(), cardId), 1);
});

test('both physical Potion pair kinds can rescue while preserving injury and existing special status', t => {
  for (const type of ['potion-full-heal', 'potion-revive']) { const f = fixture(t); f.play(); const cardId = tool(f, f.leader, type); rescue(f, { status: 'poison' }); save(f, cardId); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.target).active.status, 'poison'); assert.equal(f.room().pendingBattle, null); }
});

test('negative HP is preserved through repeated Potions by the same actor until the target reaches at least one', t => {
  const f = fixture(t); f.play('aerodactyl', 3); f.player(f.leader).active.reinforcements = ['power', 'power']; const first = tool(f), second = tool(f); rescue(f, { damage: 0 }); assert.equal(f.player(f.target).active.damage, 5); const initial = f.room().pendingBattle.id; save(f, first); assert.equal(f.player(f.target).active.damage, 3); assert.equal(f.room().pendingBattle.kind, 'rescue'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); assert.notEqual(f.room().pendingBattle.id, initial); const next = f.room().pendingBattle.id; rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: initial, choice: 'potion', cardId: second }), 'STALE_DECISION'); save(f, second); assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.room().pendingBattle, null); assert.notEqual(next, initial); for (const id of [first, second]) assert.equal(countCard(f.room(), id), 1);
});

test('passing advances rescue actors in current-turn-first order and all passes formally defeat only afterward', t => {
  const f = fixture(t); f.play(); rescue(f); const incoming = f.player(f.target).reserve.instanceId, actors = []; while (f.room().pendingBattle?.kind === 'rescue') { actors.push(f.room().pendingBattle.actorId); assert.equal(f.player(f.target).active.defeated, false); f.respond(); } assert.deepEqual(actors, f.room().players.filter(player => !player.spectator).map(player => player.id)); assert.equal(f.player(f.target).active.instanceId, incoming); assert.equal(f.player(f.target).reserve.defeated, true);
});

test('a later rescue actor may save the original target immediately and stop the rest of the rescue order', t => {
  const f = fixture(t); f.play(); const cardId = tool(f, f.target); rescue(f); f.respond(); assert.equal(f.room().pendingBattle.actorId, f.target.playerId); save(f, cardId); assert.equal(f.player(f.target).active.defeated, false); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle, null);
});

test('rescue Potion validates response actor, real own card and strict fields atomically', t => {
  const f = fixture(t); f.play(); const own = tool(f), foreign = tool(f, f.third), wrong = f.supply(f.leader, 'event', 'clear'); rescue(f); const pending = f.room().pendingBattle; rejectsAtomically(f, () => f.act(f.third, 'respondBattle', { decisionId: pending.id, choice: 'potion', cardId: foreign }), 'NOT_YOUR_DECISION');
  for (const payload of [{ choice: 'potion' }, { choice: 'potion', cardId: foreign }, { choice: 'potion', cardId: wrong }, { choice: 'potion', cardId: 'forged' }, { choice: 'potion', cardId: own, targetId: f.target.playerId }, { choice: 'potion', cardId: own, slot: 'active' }, { choice: 'potion', cardId: own, cardIds: [] }, { choice: 'pass', cardId: own }]) rejectsAtomically(f, () => f.act(f.leader, 'respondBattle', { decisionId: pending.id, ...payload }));
});

test('rescue projection reveals safe Potion and Healer choices only to the current response actor', t => {
  const f = fixture(t); f.play(); f.seed(f.third, 'chansey', 2); const cardId = tool(f), sunny = f.supply(f.leader, 'event', 'clear'), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); rescue(f); assert.equal(f.view(f.leader).pendingBattle.canUsePotion, true); assert.deepEqual(f.view(f.leader).pendingBattle.potionCards, [publicHand(f.player(f.leader).hand.find(card => card.id === cardId))]); assert.deepEqual(f.view(f.leader).pendingBattle.healerCards, []); for (const who of [f.target, f.third, observer]) { const view = f.view(who); assert.equal(view.pendingBattle.potionCards, undefined); assert.equal(view.pendingBattle.healerCards, undefined); assert.equal(view.pendingBattle.canUsePotion, true); assert.equal(JSON.stringify(view).includes(cardId), false); assert.equal(JSON.stringify(view).includes(sunny), false); }
});

test('public Potion permission is independent of whether the current actor holds a healing card', t => {
  const f = fixture(t); f.play(); rescue(f); const first = f.view(f.leader).pendingBattle; assert.equal(first.canUsePotion, true); assert.deepEqual(first.potionCards, []); f.respond(); const second = f.view(f.target).pendingBattle; assert.equal(second.canUsePotion, true); assert.deepEqual(second.potionCards, []);
});

test('Healer converts any own sunny card kind into a real rescue Potion on every Chansey level', t => {
  for (const level of [1, 2, 3]) for (const kind of ['command', 'dodge', 'event', 'held-item']) { const f = fixture(t); f.play(); f.seed(f.third, 'chansey', level); const cardId = f.supply(f.third, kind, level % 2 ? 'clear' : 'intense-sun'); rescue(f); untilActor(f, f.third); save(f, cardId, 'healer'); assert.equal(f.player(f.target).active.defeated, false); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().pendingBattle, null); assert.equal(countCard(f.room(), cardId), 1); }
});

test('Healer rejects rainy cards, foreign cards and already equipped cards without changing the rescue', t => {
  const f = fixture(t); f.play('chansey', 3); const rain = f.supply(f.leader, 'event', 'rain'), storm = f.supply(f.leader, 'dodge', 'thunderstorm'), foreign = f.supply(f.third, 'event', 'clear'), held = f.helmet(f.leader); rescue(f); for (const cardId of [rain, storm, foreign, held.id, 'forged']) rejectsAtomically(f, () => save(f, cardId, 'healer'));
});

test('Healer conversion of a sunny split tool activates neither its Candy/Nugget nor Full Heal side', t => {
  for (const toolType of ['rare-candy-nugget', 'potion-full-heal']) { const f = fixture(t); f.play(); f.seed(f.third, 'chansey', 2); const cardId = tool(f, f.third, toolType); rescue(f, { status: 'burn' }); untilActor(f, f.third); save(f, cardId, 'healer'); assert.equal(f.player(f.target).active.level, 1); assert.equal(f.player(f.target).active.status, 'burn'); assert.equal(f.player(f.target).hand.length, 0); assert.equal(f.player(f.third).hand.length, 0); assert.equal(countCard(f.room(), cardId), 1); }
});

test('a fainting but not formally defeated active Chansey may rescue itself at zero HP with its own Healer', t => {
  for (const level of [1, 2, 3]) { const f = fixture(t); f.play(); const hp = [3, 4, 5][level - 1]; f.seed(f.target, 'chansey', level, { hpBonus: 0, damage: hp - 2 }); const cardId = f.supply(f.target, 'event', 'clear'), original = f.player(f.target).active.instanceId; f.attack(); f.respond(); assert.equal(f.player(f.target).active.damage, hp); untilActor(f, f.target); assert.deepEqual(f.view(f.target).pendingBattle.healerCards, [publicHand(f.player(f.target).hand.find(card => card.id === cardId))]); save(f, cardId, 'healer'); assert.equal(f.player(f.target).active.instanceId, original); assert.equal(f.player(f.target).active.damage, hp - 2); assert.equal(f.player(f.target).active.defeated, false); assert.equal(f.room().pendingBattle, null); }
});

test('reserve Chansey and other active families cannot convert ordinary sunny cards into rescue healing', t => {
  const f = fixture(t); f.play(); f.player(f.third).reserve.catalogueId = 'chansey'; const cardId = f.supply(f.third, 'event', 'clear'); rescue(f); untilActor(f, f.third); assert.deepEqual(f.view(f.third).pendingBattle.healerCards, []); rejectsAtomically(f, () => save(f, cardId, 'healer'));
});

test('Healer strict fields never permit another target, multiple cards or fabricated healing amounts', t => {
  const f = fixture(t); f.play(); f.seed(f.third, 'chansey'); const cardId = f.supply(f.third, 'event', 'clear'); rescue(f); untilActor(f, f.third); const pending = f.room().pendingBattle; for (const extra of [{ targetId: f.leader.playerId }, { amount: 5 }, { cardIds: [cardId] }, { handIndex: 0 }, { effect: 'potion' }, { slot: 'active' }]) rejectsAtomically(f, () => f.act(f.third, 'respondBattle', { decisionId: pending.id, choice: 'healer', cardId, ...extra }));
});

test('Rhyhorn permission blocks both physical Potion and a nonowner Chansey Healer in the original rescue window', t => {
  const f = fixture(t); f.play('rhyhorn', 3); const physical = tool(f); f.seed(f.third, 'chansey'); const sunny = f.supply(f.third, 'event', 'clear'); rescue(f, { damage: 0 }); assert.equal(f.view(f.leader).pendingBattle.canUsePotion, false); rejectsAtomically(f, () => save(f, physical)); f.respond(); assert.equal(f.view(f.target).pendingBattle.canUsePotion, true); f.respond(); assert.equal(f.view(f.third).pendingBattle.canUsePotion, false); rejectsAtomically(f, () => save(f, sunny, 'healer')); assert.equal(f.player(f.leader).hand.some(card => card.id === physical), true); assert.equal(f.player(f.third).hand.some(card => card.id === sunny), true); f.drain();
});

test('Rhyhorn permits the fainting owner physical Potion or self-Healer and ends rescue immediately', t => {
  for (const conversion of [false, true]) { const f = fixture(t); f.play('rhyhorn', 3); const cardId = conversion ? f.supply(f.target, 'event', 'clear') : tool(f, f.target); f.seed(f.target, conversion ? 'chansey' : 'charmander', 1, { hpBonus: 0 }); f.attack(); f.respond(); untilActor(f, f.target); assert.equal(f.view(f.target).pendingBattle.canUsePotion, true); save(f, cardId, conversion ? 'healer' : 'potion'); assert.equal(f.player(f.target).active.defeated, false); assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.room().pendingBattle, null); }
});

test('rescue Potion refreshes the same actor response clock and pauses the source turn through repeated healing', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play('aerodactyl', 3); f.player(f.leader).active.reinforcements = ['power', 'power']; const first = tool(f), second = tool(f); f.advance(1_000); rescue(f, { damage: 0 }); f.advance(2_000); save(f, first); assert.equal(f.view(f.leader).pendingBattle.clock.remainingMs, 5_000); assert.equal(f.room().pendingBattle.clock.deadlineAt, f.now() + 5_000); save(f, second); assert.equal(f.view(f.leader).turn.clock.remainingMs, 59_000);
});

test('optional rescue timeout passes only the current actor and does not automatically consume a real Potion', t => {
  const f = fixture(t, { responseSeconds: 5 }); f.play(); const cardId = tool(f); rescue(f); const first = f.room().pendingBattle.id; f.advance(5_000); const view = f.view(f.target); assert.notEqual(view.pendingBattle.id, first); assert.equal(view.pendingBattle.actorId, f.target.playerId); assert.equal(f.player(f.leader).hand.some(card => card.id === cardId), true); assert.equal(f.player(f.target).active.damage, 4);
});

test('exact Potion rescue retries do not duplicate healing, card cost or continuation', t => {
  const f = fixture(t); f.play(); const cardId = tool(f); rescue(f); const request = f.input('respondBattle', { decisionId: f.room().pendingBattle.id, choice: 'potion', cardId }); f.store.action(f.owner.code, f.leader.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.leader.token, request); assert.deepEqual(f.room(), once); assert.equal(f.player(f.target).active.damage, 2); assert.equal(countCard(f.room(), cardId), 1);
});

test('restart during repeated negative-HP rescue preserves the current actor and exact used-card retry', t => {
  const f = fixture(t); f.play('aerodactyl', 3); f.player(f.leader).active.reinforcements = ['power', 'power']; const first = tool(f), second = tool(f); rescue(f, { damage: 0 }); save(f, first); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.leader.token).view; assert.equal(view.pendingBattle.kind, 'rescue'); assert.equal(view.pendingBattle.actorId, f.leader.playerId); const request = { id: 'restored-rescue-potion', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'potion', cardId: second }; restored.action(f.owner.code, f.leader.token, request); const once = structuredClone(restored.rooms.get(f.owner.code)); restored.action(f.owner.code, f.leader.token, request); assert.deepEqual(restored.rooms.get(f.owner.code), once); assert.equal(once.players.find(player => player.id === f.target.playerId).active.damage, 1); assert.equal(once.pendingBattle, null); for (const id of [first, second]) assert.equal(countCard(once, id), 1);
});

test('votes block a Potion response while preserving the original pending target and held card', t => {
  const f = fixture(t); f.play(); const cardId = tool(f); rescue(f); const pending = f.room().pendingBattle.id; f.act(f.owner, 'requestEndGame'); rejectsAtomically(f, () => save(f, cardId), 'VOTE_PENDING'); f.act(f.seats.find(who => who !== f.owner), 'rejectEnd'); assert.equal(f.room().pendingBattle.id, pending); save(f, cardId); assert.equal(f.player(f.target).active.damage, 2);
});

test('Healer remains usable under ordinary special statuses because they do not suppress the active trait', t => {
  for (const status of ['burn', 'paralysis', 'sleep']) { const f = fixture(t); f.play(); f.seed(f.third, 'chansey', 2, { status }); const cardId = f.supply(f.third, 'event', 'clear'); rescue(f); untilActor(f, f.third); save(f, cardId, 'healer'); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.third).active.status, status); assert.equal(f.room().pendingBattle, null); }
});

test('Gas suppresses active Healer conversion but still permits a real Potion in that same rescue window', t => {
  const f = fixture(t); f.play('chansey', 3); f.seed(f.third, 'koffing'); const gas = f.supply(f.third); start(f); f.respond('suppress', { cardId: gas, targetId: f.leader.playerId }); drawToPlay(f); const sunny = f.supply(f.leader, 'event', 'clear'), cardId = tool(f); rescue(f); assert.deepEqual(f.view(f.leader).pendingBattle.healerCards, []); assert.ok(f.view(f.leader).pendingBattle.potionCards.some(card => card.id === cardId)); rejectsAtomically(f, () => save(f, sunny, 'healer')); save(f, cardId); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.leader).hand.some(card => card.id === sunny), true);
});

test('formal defeat disables Chansey Healer even though a fainting, not defeated Chansey may self-rescue', t => {
  const f = fixture(t); f.play(); f.seed(f.third, 'chansey', 2, { defeated: true }); const cardId = f.supply(f.third, 'event', 'clear'); rescue(f); untilActor(f, f.third); assert.deepEqual(f.view(f.third).pendingBattle.healerCards, []); rejectsAtomically(f, () => save(f, cardId, 'healer'));
});

test('a reserve Chansey deployed after all rescue passes cannot retrospectively rescue the formally defeated original', t => {
  const f = fixture(t); f.play(); const sunny = f.supply(f.target, 'event', 'clear'); f.player(f.target).reserve.catalogueId = 'chansey'; rescue(f); const original = f.player(f.target).active.instanceId; f.drain(); assert.equal(f.player(f.target).reserve.instanceId, original); assert.equal(f.player(f.target).reserve.defeated, true); assert.equal(f.player(f.target).active.catalogueId, 'chansey'); assert.equal(f.player(f.target).active.damage, 0); assert.equal(f.player(f.target).hand.some(card => card.id === sunny), true); assert.equal(f.room().pendingBattle, null);
});

test('Healer private card projection includes only actual own sunny hand faces and strips private fields', t => {
  const f = fixture(t); f.play(); f.seed(f.third, 'chansey'); f.supply(f.third, 'event', 'rain'); const first = f.supply(f.third, 'dodge', 'clear'), second = f.supply(f.third, 'command', 'intense-sun'), originals = structuredClone(f.player(f.third).hand.filter(card => [first, second].includes(card.id))), observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }); rescue(f); untilActor(f, f.third); assert.deepEqual(f.view(f.third).pendingBattle.healerCards, originals.map(publicHand)); assert.equal(JSON.stringify(f.view(f.third).pendingBattle).includes('privateMarker'), false); for (const who of [f.leader, f.target, observer]) { const view = f.view(who); assert.equal(view.pendingBattle.healerCards, undefined); assert.equal(view.pendingBattle.potionCards, undefined); for (const card of originals) assert.equal(JSON.stringify(view).includes(card.id), false); }
});

test('exact Healer rescue retries spend one real sunny card and heal only once', t => {
  const f = fixture(t); f.play(); f.seed(f.third, 'chansey'); const cardId = f.supply(f.third, 'event', 'clear'); rescue(f); untilActor(f, f.third); const request = f.input('respondBattle', { decisionId: f.room().pendingBattle.id, choice: 'healer', cardId }); f.store.action(f.owner.code, f.third.token, request); const once = structuredClone(f.room()); f.store.action(f.owner.code, f.third.token, request); assert.deepEqual(f.room(), once); assert.equal(f.player(f.target).active.damage, 2); assert.equal(countCard(f.room(), cardId), 1);
});

test('restart preserves a fainting Chansey self-Healer decision and its original instance binding', t => {
  const f = fixture(t); f.play(); f.seed(f.target, 'chansey', 1, { hpBonus: 0, damage: 1 }); const cardId = f.supply(f.target, 'event', 'clear'), original = f.player(f.target).active.instanceId; f.attack(); f.respond(); untilActor(f, f.target); const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now }), view = restored.view(f.owner.code, f.target.token).view; assert.ok(view.pendingBattle.healerCards.some(card => card.id === cardId)); restored.action(f.owner.code, f.target.token, { id: 'restored-self-healer', revision: view.revision, type: 'respondBattle', decisionId: view.pendingBattle.id, choice: 'healer', cardId }); const room = restored.rooms.get(f.owner.code), pokemon = room.players.find(player => player.id === f.target.playerId).active; assert.equal(pokemon.instanceId, original); assert.equal(pokemon.damage, 1); assert.equal(pokemon.defeated, false); assert.equal(room.pendingBattle, null); assert.equal(countCard(room, cardId), 1);
});

test('rescuing source-free Reckless loss resumes its deferred real gain without defeat or a fictitious damage reward', t => {
  const f = fixture(t); f.play('rhyhorn'); f.player(f.leader).active.hpBonus = 0; const cardId = tool(f), original = f.player(f.leader).active.instanceId, cards = f.top('rain', 'clear', 'thunderstorm'); f.act(f.leader, 'useTrait', { hpLoss: 3 }); assert.equal(f.room().pendingBattle.kind, 'rescue'); assert.equal(f.room().resolution.kind, 'hp-loss'); assert.equal(f.view(f.leader).pendingBattle.canUsePotion, true); save(f, cardId); assert.equal(f.player(f.leader).active.instanceId, original); assert.equal(f.player(f.leader).active.damage, 1); assert.deepEqual(f.player(f.leader).hand, cards); assert.equal(f.room().resolution, null); assert.equal(f.room().turn.commandCreatureId, null); assert.deepEqual(f.room().turn.traitsUsed, [original]);
});

test('Potion can rescue nested Helmet damage and resume the saved parent command once', t => {
  const f = fixture(t); f.play(); Object.assign(f.player(f.leader).active, { hpBonus: 0, damage: 2 }); f.helmet(f.target); const cardId = tool(f), command = f.supply(f.leader); f.attack({ cardId: command }); f.respond(); assert.equal(f.room().pendingBattle.kind, 'rescue'); assert.equal(f.room().resolution.kind, 'item'); assert.equal(f.room().resolutionStack.length, 1); save(f, cardId); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.player(f.leader).active.defeated, false); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.room().resolution, null); assert.equal((f.room().resolutionStack || []).length, 0); for (const id of [cardId, command]) assert.equal(countCard(f.room(), id), 1);
});

test('Rhyhorn owner-only restriction also permits the original owner Potion in nested Helmet rescue', t => {
  const f = fixture(t); f.play('rhyhorn', 3); Object.assign(f.player(f.leader).active, { hpBonus: 0, damage: 4 }); f.helmet(f.target); const cardId = tool(f); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'rescue'); assert.equal(f.room().resolution.kind, 'item'); assert.equal(f.view(f.leader).pendingBattle.potionRestrictedToOwner, true); assert.equal(f.view(f.leader).pendingBattle.canUsePotion, true); save(f, cardId); assert.equal(f.player(f.leader).active.damage, 3); assert.equal(f.room().resolution, null);
});

test('a zero-HP Chansey may self-Healer its Double-Edge recoil child without reapplying recoil', t => {
  const f = fixture(t); f.play('chansey', 3); Object.assign(f.player(f.leader).active, { hpBonus: 0, damage: 4 }); const sunny = f.supply(f.leader, 'event', 'clear'), command = f.supply(f.leader); f.attack({ cardId: command }); f.respond(); assert.equal(f.room().pendingBattle.kind, 'double-edge'); f.respond('boost'); assert.equal(f.room().pendingBattle.kind, 'rescue'); assert.equal(f.room().resolution.kind, 'hp-loss'); assert.equal(f.player(f.leader).active.damage, 5); save(f, sunny, 'healer'); assert.equal(f.player(f.leader).active.damage, 3); assert.equal(f.player(f.target).active.damage, 3); assert.equal(f.room().resolution, null); assert.equal((f.room().resolutionStack || []).length, 0); for (const id of [sunny, command]) assert.equal(countCard(f.room(), id), 1);
});

test('successful rescue immediately resumes source after-damage status on the same surviving original target', t => {
  const f = fixture(t); f.play('weedle'); const cardId = tool(f), original = f.player(f.target).active.instanceId; f.judgments('rain'); rescue(f); save(f, cardId); assert.equal(f.player(f.target).active.instanceId, original); assert.equal(f.player(f.target).active.damage, 1); assert.equal(f.player(f.target).active.status, 'poison'); assert.equal(f.player(f.target).active.defeated, false); assert.equal(f.room().pendingBattle, null);
});

test('Chansey exposes reviewed HP and native move menus now that Healer rescue is executable', t => {
  const entry = catalogue.entries.find(entry => entry.id === 'chansey'); assert.deepEqual(entry.levels.map(face => face.hp), [3, 4, 5]); assert.deepEqual(entry.levels.map(face => face.effectStatus), Array(3).fill('combat-preview')); for (const [level, effects] of [[1, ['discard-other-hand']], [2, ['discard-other-hand', 'life-dew']], [3, ['double-edge', 'life-dew']]]) { const f = fixture(t); f.play('chansey', level); assert.deepEqual(f.view(f.leader).self.battle.moves.map(move => move.effectKind), effects); assert.equal(f.view(f.leader).self.battle.canTrait, false); }
});

test('Charm uses one actual rainy card and a source-selected private hand position without damage or Power consumption', t => {
  for (const weather of ['rain', 'thunderstorm']) { const f = fixture(t); f.play('chansey', 2); f.player(f.leader).active.reinforcements = ['power', 'power']; const held = [f.supply(f.target), f.supply(f.target, 'dodge')], cost = f.supply(f.leader, 'event', weather); f.attack({ cardId: cost }); f.respond(); assert.equal(f.room().pendingBattle.kind, 'hand'); assert.equal(f.room().pendingBattle.actorId, f.leader.playerId); assert.deepEqual(f.view(f.leader).pendingBattle.choices, [{ index: 0 }, { index: 1 }]); f.respond('card', { handIndex: 1 }); assert.equal(f.player(f.target).hand.length, 1); assert.equal(f.room().discardPile.filter(card => held.includes(card.id)).length, 1); assert.equal(f.player(f.target).active.damage, 0); assert.deepEqual(f.player(f.leader).active.reinforcements, ['power', 'power']); assert.equal(f.room().turn.commandCreatureId, null); }
});

test('Charm rejects self, empty or distant hands and sunny costs before payment, while ordinary Dodge cancels it', t => {
  const f = fixture(t, { count: 6 }); f.play('chansey'); f.supply(f.target); const rainy = f.supply(f.leader, 'event', 'rain'), sunny = f.supply(f.leader, 'event', 'clear'), far = f.byId(f.room().players[3].id); f.supply(far); for (const targetId of [f.leader.playerId, far.playerId]) rejectsAtomically(f, () => f.attack({ cardId: rainy, targetIds: [targetId] })); rejectsAtomically(f, () => f.attack({ cardId: sunny })); f.attack({ cardId: rainy }); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); assert.equal(f.player(f.target).hand.length, 1); assert.equal(f.room().pendingBattle, null);
});

test('Life Dew heals exactly one from any selected active set including distant self but never reserves or zero targets', t => {
  const f = fixture(t, { count: 6 }); f.play('chansey', 2); const far = f.byId(f.room().players[3].id); f.player(f.leader).active.damage = 2; f.player(far).active.damage = 3; f.player(far).reserve.damage = 2; const cost = f.supply(f.leader, 'event', 'clear'); rejectsAtomically(f, () => f.attack({ cardId: cost, moveIndex: 1, targetIds: [] })); f.attack({ cardId: cost, moveIndex: 1, targetIds: [f.leader.playerId, far.playerId] }); f.drain(); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.player(far).active.damage, 2); assert.equal(f.player(far).reserve.damage, 2); assert.equal(f.room().turn.commandCreatureId, null); assert.equal(countCard(f.room(), cost), 1);
});

test('Life Dew uses independent ordinary Dodge responses for each active and creates no damage hooks', t => {
  const f = fixture(t); f.play('chansey', 3); f.seed(f.target, 'nidoran-m', 2, { damage: 2, reinforcements: ['defense'] }); f.player(f.third).active.damage = 2; f.helmet(f.target); f.attack({ cardId: f.supply(f.leader, 'event', 'intense-sun'), moveIndex: 1, targetIds: [f.target.playerId, f.third.playerId] }); f.respond('dodge', { cardId: f.supply(f.target, 'dodge') }); f.respond(); assert.equal(f.player(f.target).active.damage, 2); assert.equal(f.player(f.third).active.damage, 1); assert.deepEqual(f.player(f.target).active.reinforcements, ['defense']); assert.equal(f.player(f.leader).active.damage, 0); assert.equal(f.player(f.leader).active.status, null); assert.equal(f.room().pendingBattle, null);
});

test('Chansey Double-Edge uses the shared optional damage boost and one source HP loss after positive damage', t => {
  const f = fixture(t); f.play('chansey', 3); f.attack(); f.respond(); assert.equal(f.room().pendingBattle.kind, 'double-edge'); f.respond('boost'); assert.equal(f.player(f.target).active.damage, 3); assert.equal(f.player(f.leader).active.damage, 1); assert.equal(f.room().pendingBattle, null);
});
