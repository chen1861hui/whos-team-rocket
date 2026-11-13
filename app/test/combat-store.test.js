import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomStore, CONNECTED_MS } from '../server/store.js';
import { civilianProfiles, roleProfiles } from '../public/trainer-profiles.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));
const publicShape = p => ({ catalogueId: p.catalogueId, level: p.level });
function fixture(t, { count = 3, turnSeconds = 0, responseSeconds = 0, content = catalogue, deckProfile = 'basic', autoDraw, autoJudgment } = {}) {
  const root = fileURLToPath(new URL('../.data/', import.meta.url)); mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'combat-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  let time = 1_000_000, serial = 0;
  const now = () => time;
  const store = new RoomStore({ dataDir: dir, catalogue: content, now, allowTestDecks: deckProfile !== 'retail' });
  const owner = store.create({ nickname: 'Trainer 0' });
  const seats = [owner, ...Array.from({ length: count - 1 }, (_, i) => store.join(owner.code, { nickname: `Trainer ${i + 1}` }))];
  const byId = id => seats.find(p => p.playerId === id);
  const act = (who, type, payload = {}) => store.action(owner.code, who.token, { id: `battle-${++serial}`, revision: store.rooms.get(owner.code).revision, type, ...payload }).view;
  act(owner, 'settings', { arena: 'stadium', turnSeconds, responseSeconds, deckProfile, autoDraw, autoJudgment });
  seats.forEach(p => act(p, 'ready', { ready: true })); act(owner, 'startBattlePreview');
  const leader = byId(store.rooms.get(owner.code).players.find(p => p.role === 'leader').id);
  const seededSetupExclusions = ['koffing', 'jynx', 'tauros'];
  if (autoDraw) seededSetupExclusions.push('staryu', 'electabuzz', 'porygon');
  for (const who of seats) act(who, 'acknowledgeIdentity');
  for (const who of seats) {
    for (let draw = 0; draw < 5; draw++) act(who, 'drawPokemon');
    const candidates = store.view(owner.code, who.token).view.self.candidates;
    const picks = [...candidates].sort((a, b) => Number(seededSetupExclusions.includes(a)) - Number(seededSetupExclusions.includes(b)));
    act(who, 'selectPokemon', { activeId: picks[0], reserveId: picks[1] });
  }
  // These pre-existing combat scenarios intentionally seed starter creatures after
  // exercising legal setup. Dedicated selection tests verify the real disjoint deals.
  for (const p of store.rooms.get(owner.code).players.filter(p => !p.spectator)) { p.active.catalogueId = 'bulbasaur'; p.reserve.catalogueId = 'squirtle'; }
  const room = () => store.rooms.get(owner.code);
  const player = who => room().players.find(p => p.id === who.playerId);
  const view = who => store.view(owner.code, who.token).view;
  const play = () => { act(leader, 'draw'); return act(leader, 'draw'); };
  const supply = (who, kind) => { const id = `seed-${++serial}`; player(who).hand.push({ id, kind, weather: 'intense-sun', fixture: true, name: {zh:kind,en:kind} }); return id; };
  const target = () => seats.find(p => p !== leader);
  const attack = (victim = target()) => act(leader, 'attack', { cardId: supply(leader, 'command'), targetIds: [victim.playerId] });
  const pass = () => { const pending = room().pendingBattle; return act(byId(pending.actorId), 'respondBattle', { decisionId: pending.id, choice: 'pass' }); };
  return { store, dir, now, advance: ms => { time += ms; }, owner, seats, leader, byId, act, room, player, view, play, supply, target, attack, pass };
}
function rejects(fn, code) { assert.throws(fn, e => e.code === code); }

test('the reviewed lobby deck deals physical copies of every reviewed card kind at three and six seats', t => {
  for (const count of [3, 6]) {
    const f = fixture(t, { count, deckProfile: 'reviewed' });
    const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }).view;
    const room = f.room();
    const cards = [...room.drawPile, ...room.players.flatMap(player => player.hand)];
    assert.equal(cards.length, 14 * count + 31);
    assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
    assert.ok(cards.every(card => card.fixture && card.name.en && card.name.zh));
    for (const [kind, quantities] of [['command', [3, 2, 2, 1]], ['dodge', [2, 2, 1, 1]]]) {
      const weathers = ['intense-sun', 'clear', 'rain', 'thunderstorm'];
      assert.deepEqual(weathers.map(weather => cards.filter(card => card.kind === kind && card.weather === weather).length), quantities.map(n => n * count));
    }
    const tools = cards.filter(card => card.kind === 'tool');
    assert.equal(tools.length, 10);
    for (const pair of ['potion-full-heal', 'potion-revive', 'rare-candy-nugget', 'defense-speed', 'power-speed']) {
      assert.equal(tools.filter(card => card.toolType === pair).length, 2);
    }
    assert.deepEqual(cards.filter(card => card.kind === 'held-item').map(card => card.itemType).sort(), catalogue.heldItems.map(card => card.id).sort());
    assert.deepEqual(cards.filter(card => card.kind === 'event').map(card => card.eventType).sort(), catalogue.playCardPreviews.filter(card => card.eventType).map(card => card.eventType).sort());
    assert.equal(observer.settings.deckProfile, 'reviewed');
    assert.equal(observer.scenario.deckCardCount, cards.length);
    assert.equal(observer.scenario.articunoReactions, true);
    assert.equal(observer.drawCount, cards.length - 4 * count);
    assert.deepEqual(observer.self.hand, []);
    assert.ok(observer.players.every(player => player.hand === undefined));
    assert.equal(observer.drawPile, undefined);
  }
});

test('Master Edition deals from one fixed deck and keeps opening hands private', t => {
  for (const count of [3, 6]) {
    const f = fixture(t, { count, deckProfile: 'retail' });
    const room = f.room();
    const observer = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true }).view;
    const cards = [...room.drawPile, ...room.players.flatMap(player => player.hand)];
    assert.equal(cards.length, 108);
    assert.equal(new Set(cards.map(card => card.id)).size, 108);
    for (const weather of ['intense-sun', 'clear', 'rain', 'thunderstorm']) {
      assert.equal(cards.filter(card => card.weather === weather).length, 27);
    }
    assert.equal(cards.filter(card => card.kind === 'command' && card.weather === 'rain').length, 14);
    assert.equal(cards.filter(card => card.toolType === 'potion-full-heal').length, 8);
    assert.equal(cards.filter(card => card.eventType === 'articuno-protection' && card.weather === 'thunderstorm').length, 1);
    assert.equal(observer.settings.deckProfile, 'retail');
    assert.equal(observer.scenario.deckCardCount, 108);
    assert.equal(observer.scenario.articunoReactions, true);
    assert.equal(observer.drawCount, 108 - count * 4);
    for (const seat of f.seats) assert.equal(f.view(seat).self.hand.length, 4);
    assert.deepEqual(observer.self.hand, []);
    assert.ok(observer.players.every(player => player.hand === undefined));
    assert.equal(observer.drawPile, undefined);
  }
});

test('only the host can save a known deck and a timer-only save preserves the profile across restart', t => {
  const root = fileURLToPath(new URL('../.data/', import.meta.url));
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, 'deck-settings-test-'));
  t.after(() => { if (resolve(dirname(dir)) !== resolve(root)) throw new Error('Unexpected test path'); rmSync(dir, { recursive: true, force: true }); });
  const store = new RoomStore({ dataDir: dir, catalogue });
  const owner = store.create({ nickname: 'Host' });
  const guest = store.join(owner.code, { nickname: 'Guest' });
  const update = (seat, id, deckProfile) => store.action(owner.code, seat.token, {
    id, revision: store.view(owner.code, seat.token).view.revision, type: 'settings',
    arena: 'stadium', turnSeconds: 10, responseSeconds: 0, ...(deckProfile === undefined ? {} : { deckProfile }),
  });
  rejects(() => update(guest, 'guest-change', 'reviewed'), 'OWNER_ONLY');
  rejects(() => update(owner, 'invalid-deck', 'unknown'), 'INVALID_SETTINGS');
  rejects(() => update(owner, 'test-deck', 'reviewed'), 'INVALID_SETTINGS');
  assert.equal(owner.view.settings.deckProfile, 'retail');
  update(owner, 'retail-deck', 'retail');
  update(owner, 'timer-only', undefined);
  const restored = new RoomStore({ dataDir: dir, catalogue });
  assert.equal(restored.view(owner.code, owner.token).view.settings.deckProfile, 'retail');
});

test('preview uses sourced roles/leader levels and keeps opponents roles/reserve/deck private', t => {
  for (const count of [3, 4, 5, 6]) {
    const f = fixture(t, { count });
    const outsider = f.store.join(f.owner.code, { nickname: 'Observer', spectator: true });
    const publicView = outsider.view;
    assert.equal(publicView.scenario.developmentFixture, true);
    assert.equal(publicView.scenario.cardsPerSeat, 12);
    assert.equal(publicView.players.filter(p => p.role === 'leader').length, 1);
    assert.equal(publicView.players.filter(p => p.role).length, 1);
    assert.equal(publicView.self.role, null);
    assert.deepEqual(publicView.self.hand, []);
    assert.equal(publicView.drawPile, undefined);
    for (const seat of f.seats) {
      const privatePlayer = f.player(seat), visible = publicView.players.find(p => p.id === seat.playerId);
      assert.equal(visible.reserve, undefined); assert.equal(visible.hand, undefined);
      assert.equal(visible.active.level, seat === f.leader ? 2 : 1);
      assert.equal(visible.active.maxHp, seat === f.leader ? 4 + (count >= 5 ? 1 : 0) : 3);
      assert.equal(JSON.stringify(publicView).includes(privatePlayer.reserve.instanceId), false);
      assert.equal(f.view(seat).self.role, privatePlayer.role);
    }
  }
});

test('pending defense does not depend on holding a dodge; wrong actor, pass payload and interrupting actions fail', t => {
  const f = fixture(t); f.play();
  const target = f.target(); f.player(target).hand = [];
  const before = f.attack(target);
  assert.equal(before.pendingBattle.kind, 'defense');
  assert.equal(before.pendingBattle.actorId, target.playerId);
  rejects(() => f.act(f.leader, 'respondBattle', { decisionId: before.pendingBattle.id, choice: 'pass' }), 'NOT_YOUR_DECISION');
  rejects(() => f.act(f.leader, 'finishPlay'), 'RESPONSE_PENDING');
  rejects(() => f.act(f.leader, 'switchPokemon'), 'RESPONSE_PENDING');
  rejects(() => f.act(target, 'respondBattle', { decisionId: before.pendingBattle.id, choice: 'pass', cardId: 'bad' }), 'INVALID_RESPONSE');
  rejects(() => f.act(target, 'respondBattle', { decisionId: before.pendingBattle.id, choice: 'dodge', cardId: 'bad' }), 'INVALID_CARD');
  assert.deepEqual(f.view(target).pendingBattle, before.pendingBattle);
  f.pass();
  assert.equal(f.view(target).players.find(p => p.id === target.playerId).active.hp, 1);
});

test('Dodge cancels one settlement, consumes one own card and exact retry never spends twice', t => {
  const f = fixture(t); f.play(); const victim = f.target(); f.attack(victim);
  const pending = f.room().pendingBattle, cardId = f.supply(victim, 'dodge');
  const input = { id: 'dodge-once', revision: f.room().revision, type: 'respondBattle', decisionId: pending.id, choice: 'dodge', cardId };
  const view = f.store.action(f.owner.code, victim.token, input).view;
  assert.equal(view.pendingBattle, null); assert.equal(f.player(victim).active.damage, 0);
  const hand = f.player(victim).hand.length, discard = f.room().discardPile.length;
  assert.deepEqual(f.store.action(f.owner.code, victim.token, input).view, view);
  assert.equal(f.player(victim).hand.length, hand); assert.equal(f.room().discardPile.length, discard);
  rejects(() => f.act(victim, 'respondBattle', { decisionId: pending.id, choice: 'pass' }), 'STALE_DECISION');
});

test('damage heals Bulbasaur only after real damage and switching does not unlock another command Pokémon', t => {
  const f = fixture(t); f.play(); f.player(f.leader).active.damage = 2;
  const victim = f.target(); f.attack(victim); f.pass();
  assert.equal(f.player(f.leader).active.damage, 1);
  const usedId = f.player(f.leader).active.instanceId;
  f.act(f.leader, 'switchPokemon');
  assert.equal(f.room().turn.commandCreatureId, usedId);
  rejects(() => f.attack(victim), 'MOVE_UNAVAILABLE');
});

test('rescue asks every living trainer from current turn, then forces reserve without using ordinary switch', t => {
  const f = fixture(t); f.play(); const victim = f.target(); f.player(victim).active.damage = 2;
  f.attack(victim); f.pass();
  assert.equal(f.room().pendingBattle.kind, 'rescue');
  assert.equal(f.room().pendingBattle.actorId, f.leader.playerId);
  assert.equal(f.player(victim).active.damage, 4); // HP remains -1, not clamped.
  const asked = [];
  while (f.room().pendingBattle) { asked.push(f.room().pendingBattle.actorId); f.pass(); }
  assert.deepEqual(asked, f.room().players.filter(p => !p.spectator).map(p => p.id));
  assert.equal(f.player(victim).active.catalogueId, 'squirtle');
  assert.equal(f.player(victim).reserve.defeated, true);
  assert.equal(f.player(victim).eliminated, false);
  assert.equal(f.room().turn.switchUsed, false);
  assert.ok(f.view(f.leader).players.find(p => p.id === victim.playerId).reserve);
});

test('leader elimination triggers immediate Challenger victory and only then discloses all hands/roles', t => {
  const f = fixture(t); f.play();
  const leader = f.player(f.leader); leader.active.damage = 3; leader.reserve.defeated = true;
  f.attack(f.leader); f.pass(); while (f.room().pendingBattle) f.pass();
  const ended = f.view(f.owner);
  assert.equal(ended.status, 'finished'); assert.equal(ended.result.winner, 'challengers');
  assert.equal(ended.turn, null); assert.equal(ended.pendingBattle, null);
  assert.ok(ended.players.filter(p => !p.spectator).every(p => p.role && Array.isArray(p.hand) && p.reserve));
  const lobby = f.act(f.owner, 'returnToLobby');
  assert.equal(lobby.status, 'lobby'); assert.equal(lobby.gameMode, undefined);
  assert.ok(lobby.players.every(p => p.role === undefined && p.hand === undefined && p.active === null));
});

test('multi-target Surf opens independent defense windows and one dodge leaves the other target affected', t => {
  const f = fixture(t); f.play(); const source = f.player(f.leader).active;
  source.catalogueId = 'squirtle'; source.level = 3;
  const victims = f.seats.filter(p => p !== f.leader);
  f.act(f.leader, 'attack', { cardId: f.supply(f.leader, 'command'), targetIds: victims.map(p => p.playerId) });
  const first = f.room().pendingBattle;
  f.act(victims[0], 'respondBattle', { decisionId: first.id, choice: 'dodge', cardId: f.supply(victims[0], 'dodge') });
  assert.equal(f.room().pendingBattle.actorId, victims[1].playerId);
  f.pass();
  assert.equal(f.player(victims[0]).active.damage, 0); assert.equal(f.player(victims[1]).active.damage, 2);
});

test('Fire judgment applies burn after damage and burn caps subsequent move damage', t => {
  const f = fixture(t); f.play(); const source = f.player(f.leader).active;
  source.catalogueId = 'charmander'; source.level = 1;
  const victim = f.target(); f.attack(victim); f.pass();
  assert.equal(f.player(victim).active.status, 'burn');
  assert.equal(f.player(victim).active.damage, 1);
  assert.ok(f.room().log.some(entry => entry.text.en.includes('judgment revealed intense sun')));
});

test('auto draw deals ordinary draws once and applies Flinch before the next draw', t => {
  const f = fixture(t, { autoDraw: true });
  const opened = f.view(f.leader);
  assert.equal(opened.turn.phase, 'play');
  assert.equal(opened.self.hand.length, 6);
  assert.equal(f.view(f.leader).drawCount, opened.drawCount);
  const next = f.byId(f.room().players[1].id);
  f.player(next).active.status = 'flinch';
  f.act(f.leader, 'finishPlay');
  while (f.player(f.leader).hand.length > 4) f.act(f.leader, 'discard', { cardId: f.player(f.leader).hand[0].id });
  f.act(f.leader, 'endTurn');
  const following = f.view(next);
  assert.equal(following.turn.phase, 'play');
  assert.equal(following.self.hand.length, 5);
  assert.equal(following.drawCount, opened.drawCount - 1);
});

test('auto draw waits for Illuminate, then takes the two ordinary draws', t => {
  const f = fixture(t, { autoDraw: true });
  const next = f.byId(f.room().players[1].id);
  f.player(next).active.catalogueId = 'staryu';
  f.act(f.leader, 'finishPlay');
  while (f.player(f.leader).hand.length > 4) f.act(f.leader, 'discard', { cardId: f.player(f.leader).hand[0].id });
  f.act(f.leader, 'endTurn');
  const waiting = f.view(next);
  assert.equal(waiting.turn.phase, 'draw');
  assert.equal(waiting.self.battle.trait.kind, 'illuminate');
  assert.equal(waiting.self.hand.length, 4);
  const after = f.act(next, 'useTrait');
  assert.equal(after.self.hand.length, 7);
  assert.equal(after.turn.phase, 'play');
});

test('manual judgment keeps the deck hidden until reveal and still offers Drought', t => {
  const f = fixture(t, { autoJudgment: false, responseSeconds: 5 });
  f.play();
  const source = f.player(f.leader).active;
  source.catalogueId = 'charmander'; source.level = 1;
  const victim = f.target();
  f.player(victim).active.catalogueId = 'vulpix';
  const attack = f.attack(victim);
  assert.deepEqual(attack.pendingBattle.camera,{sourceId:f.leader.playerId,targetIds:[victim.playerId],wide:false});
  const cue = f.view(victim).visualEvents.at(-1);
  assert.equal(cue.telegraph,true);
  assert.deepEqual(
    {kind:cue.kind,sourceId:cue.sourceId,targetIds:cue.targetIds,name:cue.name.en},
    {kind:'attack',sourceId:f.leader.playerId,targetIds:[victim.playerId],name:'Ember'},
  );
  const before = f.view(f.leader).drawCount;
  f.pass();
  const pending = f.view(f.leader).pendingBattle;
  const [release,hit] = f.view(victim).visualEvents.slice(-2);
  assert.equal(release.release,true);
  assert.equal(release.name.en,'Ember');
  assert.deepEqual(release.targetIds,[victim.playerId]);
  assert.equal(hit.kind,'hit');
  assert.deepEqual(hit.targetIds,[victim.playerId]);
  assert.ok(hit.amount>0);
  assert.equal(pending.kind, 'reveal-judgment');
  assert.equal(pending.judgmentCard, undefined);
  assert.equal(f.view(f.leader).log.some(entry=>entry.judgment),false);
  assert.equal(f.view(f.leader).drawCount, before);
  rejects(() => f.act(victim, 'respondBattle', { decisionId: pending.id, choice: 'reveal' }), 'NOT_YOUR_DECISION');
  f.advance(5_000);
  assert.equal(f.view(f.leader).pendingBattle.id, pending.id);
  const revealed = f.act(f.leader, 'respondBattle', { decisionId: pending.id, choice: 'reveal' });
  assert.equal(revealed.drawCount, before - 1);
  assert.equal(revealed.pendingBattle.kind, 'judgment');
  assert.equal(revealed.pendingBattle.actorId, victim.playerId);
  assert.equal(revealed.pendingBattle.judgmentCard.weather, 'intense-sun');
  const publicCard = f.view(victim).log.findLast(entry=>entry.judgment).judgment;
  assert.deepEqual(publicCard,revealed.pendingBattle.judgmentCard);
  assert.ok(publicCard.kind);
  assert.equal(publicCard.id,undefined);
  f.pass();
  assert.equal(f.player(victim).active.status, 'burn');
});

test('trainer appearance follows a public partner and keeps an unrevealed reserve private', t => {
  const f = fixture(t);
  const subject = f.target();
  const player = f.player(subject);
  delete player.trainerAvatar;
  player.reserve.catalogueId = 'growlithe';
  const publicSeat = () => f.view(f.leader).players.find(seat => seat.id === subject.playerId);
  assert.equal(publicSeat().reserve, undefined);
  assert.ok(civilianProfiles.includes(publicSeat().trainerAvatar));
  f.play();
  f.room().turn.playerId = subject.playerId;
  f.act(subject, 'switchPokemon');
  assert.equal(publicSeat().active.catalogueId, 'growlithe');
  assert.equal(publicSeat().role, null);
  assert.equal(publicSeat().trainerAvatar, 'jenny');
  assert.equal(f.player(subject).trainerAvatar, 'jenny');
  f.act(subject, 'revealRole');
  assert.ok(roleProfiles[player.role].includes(publicSeat().trainerAvatar));
});

test('active identity reveal publishes only the acting trainer’s identity and model', t => {
  const f = fixture(t, {count:6});
  for (const seat of f.seats) delete f.player(seat).trainerAvatar;
  const observer = f.store.join(f.owner.code,{nickname:'Observer',spectator:true});
  const roster = () => f.view(observer).players.filter(seat=>!seat.spectator);
  const hidden = roster().filter(seat=>!seat.role);
  assert.equal(hidden.length,5);
  assert.equal(new Set(hidden.map(seat=>seat.trainerAvatar)).size,5);
  assert.ok(hidden.every(seat=>civilianProfiles.includes(seat.trainerAvatar)));
  const rocket = f.seats.find(seat=>f.player(seat).role==='rocket');
  rejects(()=>f.act(rocket,'revealRole'),'NOT_YOUR_TURN');
  f.room().turn.playerId = rocket.playerId;
  rejects(()=>f.act(rocket,'revealRole'),'WRONG_PHASE');
  f.room().turn.phase = 'play';
  const turn = structuredClone(f.room().turn);
  f.act(rocket,'revealRole');
  const revealed = roster().find(seat=>seat.id===rocket.playerId);
  assert.equal(revealed.role,'rocket');
  assert.ok(roleProfiles.rocket.includes(revealed.trainerAvatar));
  assert.deepEqual(roster().filter(seat=>!seat.role),hidden.filter(seat=>seat.id!==rocket.playerId));
  assert.deepEqual(f.room().turn,turn);
  rejects(()=>f.act(rocket,'revealRole'),'IDENTITY_ALREADY_PUBLIC');
});

test('response clock pauses turn clock and deadline passes without extending inactivity lifetime', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play(); f.advance(2_000);
  const attacked = f.attack();
  assert.equal(attacked.turn.clock.remainingMs, 58_000); assert.equal(attacked.turn.clock.pausedReason, 'response');
  const actionAt = attacked.lastActionAt;
  f.advance(5_000); const after = f.view(f.leader);
  assert.equal(after.pendingBattle, null); assert.equal(after.turn.clock.remainingMs, 58_000);
  assert.equal(after.turn.clock.pausedReason, null); assert.equal(after.lastActionAt, actionAt);
});

test('response reconnect/restart preserves actor, pending id, private hand and remaining response clock', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 60 }); f.play(); const victim = f.target();
  f.attack(victim); const id = f.room().pendingBattle.id; const hand = structuredClone(f.player(victim).hand);
  f.advance(CONNECTED_MS + 5_000); const paused = f.view(f.leader);
  assert.equal(paused.pendingBattle.clock.pausedReason, 'disconnected');
  assert.equal(paused.pendingBattle.clock.remainingMs, 30_000);
  const restored = new RoomStore({ dataDir: f.dir, catalogue, now: f.now });
  const recovered = restored.view(f.owner.code, victim.token).view;
  assert.equal(recovered.pendingBattle.id, id); assert.deepEqual(recovered.self.hand, hand);
  assert.equal(recovered.pendingBattle.clock.remainingMs, 30_000);
  assert.equal(recovered.pendingBattle.clock.deadlineAt, f.now() + 30_000);
});

test('self-elimination advances from the original seat to the next living trainer, not back to leader', t => {
  const f = fixture(t, { count: 4 });
  const ordered = f.room().players.filter(p => !p.spectator), actor = f.byId(ordered[1].id), nextId = ordered[2].id;
  f.player(actor).active.damage = 2; f.player(actor).reserve.defeated = true;
  f.store.startTurn(f.room(), actor.playerId, 9);
  f.act(actor, 'draw'); f.act(actor, 'draw');
  f.act(actor, 'attack', { cardId: f.supply(actor, 'command'), targetIds: [actor.playerId] });
  f.pass(); while (f.room().pendingBattle) f.pass();
  assert.equal(f.player(actor).eliminated, true);
  assert.equal(f.room().turn.playerId, nextId);
  assert.equal(f.room().turn.number, 10);
});

test('paralysis suppresses defense without discarding it when the card finishes', t => {
  const f = fixture(t); f.play(); const victim = f.target();
  f.player(victim).active.status = 'paralysis'; f.player(victim).active.reinforcements = ['defense'];
  f.attack(victim); f.pass();
  assert.equal(f.player(victim).active.damage, 2);
  assert.deepEqual(f.player(victim).active.reinforcements, ['defense']);
});

test('confusion self-damage uses Blaze, then its blocked move identity does not transfer to forced reserve', t => {
  const f = fixture(t); const source = f.player(f.leader).active;
  source.catalogueId = 'charmander'; source.level = 1; source.damage = 2; source.status = 'confusion';
  f.store.startTurn(f.room(), f.leader.playerId, 7);
  assert.equal(source.damage, 5);
  assert.equal(f.room().pendingBattle.kind, 'rescue');
  while (f.room().pendingBattle) f.pass();
  assert.equal(f.player(f.leader).active.catalogueId, 'squirtle');
  f.play();
  assert.equal(f.view(f.leader).self.battle.canCommand, true);
});

test('Chlorophyll is optional once per creature and its range permission does not transfer on switching', t => {
  const f = fixture(t, { count: 6 }); f.play();
  assert.equal(f.view(f.leader).self.battle.legalTargetIds.length, 3);
  const hand = f.player(f.leader).hand.length;
  f.act(f.leader, 'useTrait');
  assert.equal(f.view(f.leader).self.battle.legalTargetIds.length, 6);
  assert.equal(f.player(f.leader).hand.length, hand);
  rejects(() => f.act(f.leader, 'useTrait'), 'TRAIT_UNAVAILABLE');
  f.act(f.leader, 'switchPokemon');
  assert.equal(f.view(f.leader).self.battle.legalTargetIds.length, 3);
});

test('Rain Dish during End uses actual judgment weather, cures status and heals one without changing level', t => {
  const f = fixture(t); f.play();
  const source = f.player(f.leader).active;
  source.catalogueId = 'squirtle'; source.level = 1; source.damage = 1; source.status = 'burn';
  f.act(f.leader, 'finishPlay');
  while (f.player(f.leader).hand.length > 4) f.act(f.leader, 'discard', { cardId: f.player(f.leader).hand[0].id });
  // A source-derived judgment fixture exercises the rain branch; the public scenario remains all-sun.
  f.room().drawPile.push({ id:'rain-test', kind:'judgment-fixture', weather:'rain', fixture:true, name:{zh:'判定测试',en:'Judgment fixture'} });
  f.act(f.leader, 'useTrait');
  assert.equal(f.player(f.leader).active.damage, 0);
  assert.equal(f.player(f.leader).active.status, null);
  assert.equal(f.player(f.leader).active.level, 1);
  assert.ok(f.room().log.some(entry => entry.text.en.includes('judgment revealed heavy rain')));
  rejects(() => f.act(f.leader, 'useTrait'), 'TRAIT_UNAVAILABLE');
});

test('closing votes pause an actual response countdown and prohibit responding until vote rejection', t => {
  const f = fixture(t, { turnSeconds: 60, responseSeconds: 5 }); f.play(); const victim = f.target(); f.attack(victim);
  f.advance(2_000); const vote = f.act(f.owner, 'requestEndGame');
  assert.equal(vote.pendingBattle.clock.remainingMs, 3_000);
  assert.equal(vote.pendingBattle.clock.pausedReason, 'vote');
  f.advance(20_000);
  rejects(() => f.act(victim, 'respondBattle', { decisionId: vote.pendingBattle.id, choice:'pass' }), 'VOTE_PENDING');
  const rejected = f.act(f.seats.find(p => p !== f.owner), 'rejectEnd');
  assert.equal(rejected.pendingBattle.clock.remainingMs, 3_000);
  const actionAt = rejected.lastActionAt;
  f.advance(3_000); const after = f.view(f.owner);
  assert.equal(after.pendingBattle, null);
  assert.equal(after.lastActionAt, actionAt);
});


test('abandoning a pending combat response clears the match without disclosing hidden hands or fabricating a result', t => {
  const f = fixture(t); f.play(); f.attack();
  f.act(f.owner, 'requestEndGame');
  for (const seat of f.seats.filter(p => p !== f.owner)) f.act(seat, 'approveEnd');
  const lobby = f.view(f.owner);
  assert.equal(lobby.status, 'lobby'); assert.equal(lobby.result, undefined);
  assert.equal(lobby.pendingBattle, undefined); assert.equal(lobby.gameMode, undefined);
  assert.deepEqual(lobby.self.hand, []); assert.equal(lobby.self.reserve, null);
  assert.ok(lobby.players.every(p => p.role === undefined && p.hand === undefined && p.reserve === undefined));
});

test('synthetically unimplemented roster effects cannot attack or be silently ignored as defensive targets', t => {
  const content = structuredClone(catalogue), unsupported = structuredClone(content.entries.find(entry => entry.id === 'squirtle'));
  unsupported.id = 'synthetic-unimplemented'; unsupported.effectStatus = 'unavailable'; unsupported.levels.forEach(face => { face.effectStatus = 'unavailable'; }); content.entries.push(unsupported);
  const f = fixture(t, { content }); f.play();
  const target = f.target(); f.player(target).active.catalogueId = unsupported.id;
  const cardId = f.supply(f.leader, 'command');
  const before = f.player(f.leader).hand.length;
  rejects(() => f.act(f.leader, 'attack', { cardId, targetIds: [target.playerId] }), 'INVALID_TARGET');
  assert.equal(f.player(f.leader).hand.length, before);
  assert.equal(f.room().pendingBattle, null);
  f.player(f.leader).active.catalogueId = unsupported.id;
  rejects(() => f.act(f.leader, 'attack', { cardId, targetIds: [f.leader.playerId] }), 'MOVE_UNAVAILABLE');
  assert.equal(f.player(f.leader).hand.length, before);
});
