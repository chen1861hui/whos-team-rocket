import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { BattleError, isBattle, setupBattle, acknowledgeBattleIdentity, selectBattlePartners, drawBattleCards, beginBattleTurn, playBattleMove, giveBattleCards, equipBattleItem, handLimit, respondBattle, useBattleTrait, previewActions, publicBattlePokemon, publicBattleDecision, requestBattleSwitch } from './combat.js';
import { dealPokemon, shufflePokemon } from './pokemon-deal.js';

export const IDLE_MS = 7 * 60 * 60 * 1000;
export const CONNECTED_MS = 30_000;
export const OWNER_GRACE_MS = 60_000;
const hash = token => createHash('sha256').update(token).digest('hex');
const fail = (status, code, message) => { throw new ApiError(status, code, message); };
export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function fields(value, allowed) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(400, 'INVALID_INPUT', 'Invalid request fields.');
}
function nickname(value) {
  if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > 24 || /[\x00-\x1f\x7f]/.test(value)) fail(400, 'INVALID_NICKNAME', 'Nickname must contain 1–24 visible characters.');
  return value.trim();
}
function log(room, zh, en) {
  room.log.push({ id: randomUUID(), text: { zh, en } });
  room.log = room.log.slice(-80);
}
// Only the public identity/level are safe to project; creature state may grow later.
function publicPokemon(pokemon) { return pokemon ? { catalogueId: pokemon.catalogueId, level: pokemon.level } : null; }
function placeholder() { return { id: randomUUID(), kind: 'placeholder', name: { zh: '未实现效果的测试手牌', en: 'Unplayable fixture card' } }; }
function replaceSavedRoom(source, destination) {
  for (let attempt = 0; ; attempt++) {
    try { renameSync(source, destination); return; }
    catch (error) {
      // Windows scanners can briefly lock the destination. Keep the replacement atomic.
      if (process.platform !== 'win32' || !['EPERM', 'EBUSY'].includes(error.code) || attempt >= 4) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10 * 2 ** attempt);
    }
  }
}

export class RoomStore {
  constructor({ dataDir, catalogue, now = Date.now } = {}) {
    if (!dataDir || !Array.isArray(catalogue?.entries)) throw new Error('RoomStore requires private dataDir and catalogue entries.');
    this.dataDir = dataDir;
    this.catalogueIds = [...new Set(catalogue.entries.map(entry => entry.id).filter(id => typeof id === 'string'))];
    this.now = now;
    this.catalogue = catalogue;
    // Loaded owners get a full recovery window even though saved transport presence is cleared.
    this.restartGraceUntil = this.now() + OWNER_GRACE_MS;
    this.rooms = new Map();
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    for (const file of readdirSync(dataDir)) {
      if (!/^[A-Z2-9]{6}\.json$/.test(file)) continue;
      try {
        const room = JSON.parse(readFileSync(join(dataDir, file), 'utf8'));
        if (room.schemaVersion !== 1 || `${room.code}.json` !== file || !Array.isArray(room.players)) throw new Error('Invalid persisted room');
        if (room.turn) {
          room.turn.switchUsed ??= false;
          room.turn.phase ??= room.turn.drawRemaining > 0 ? 'draw' : 'play';
          room.turn.discardComplete ??= room.turn.phase==='end';
          room.turn.clock ??= room.settings.turnSeconds > 0 ? { remainingMs: room.settings.turnSeconds * 1000, deadlineAt: null, pausedReason: 'disconnected', expired: false } : null;
          // Saved remaining time is a checkpoint. Never charge server downtime.
          if (room.turn.clock) {
            room.turn.clock.deadlineAt = null;
            room.turn.clock.pausedReason = room.pendingVote ? 'vote' : room.turn.clock.expired ? 'mandatory' : 'disconnected';
          }
        }
        if (room.pendingBattle?.clock) { room.pendingBattle.clock.deadlineAt = null; room.pendingBattle.clock.pausedReason = room.pendingVote ? 'vote' : 'disconnected'; }
        // A restart breaks transport presence; credentials and game state still recover.
        room.players.forEach(player => { player.lastSeenAt = 0; });
        this.rooms.set(room.code, room);
        this.persist(room);
      } catch { throw new Error('A saved room is unreadable. Preserve the private data directory and repair it before starting.'); }
    }
    this.cleanup();
  }
  persist(room) {
    const temp = join(this.dataDir, `${room.code}.${randomUUID()}.tmp`);
    try {
      writeFileSync(temp, JSON.stringify(room), { mode: 0o600, flush: true });
      replaceSavedRoom(temp, join(this.dataDir, `${room.code}.json`));
    } finally { try { unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  }
  cleanup() {
    for (const [code, room] of this.rooms) {
      if (this.now() - room.lastActionAt >= IDLE_MS) {
        unlinkSync(join(this.dataDir, `${code}.json`));
        this.rooms.delete(code);
      } else if (room.status !== 'closed') {
        this.synchronizeTurn(room);
        this.transferOwner(room);
      }
    }
  }
  connected(player) { return player.lastSeenAt > 0 && this.now() - player.lastSeenAt <= CONNECTED_MS; }
  battleContext() { return { catalogue: this.catalogue, now: this.now, connected: player => this.connected(player) }; }
  battleCall(callback) {
    try { return callback(); }
    catch (error) { if (error instanceof BattleError) fail(error.status, error.code, error.message); throw error; }
  }
  startTurn(room, playerId, number) {
    room.turn = {
      playerId, number, drawRemaining: 2, phase: 'draw', switchUsed: false, discardComplete:false,
      clock: room.settings.turnSeconds > 0 ? { remainingMs: room.settings.turnSeconds * 1000, deadlineAt: null, pausedReason: null, expired: false } : null,
    };
    const clock = room.turn.clock;
    if (clock) {
      const connected = this.connected(room.players.find(player => player.id === playerId));
      clock.deadlineAt = connected ? this.now() + clock.remainingMs : null;
      clock.pausedReason = connected ? null : 'disconnected';
    }
    if (isBattle(room)) beginBattleTurn(room, room.players.find(p => p.id === playerId), this.battleContext());
    if (room.pendingBattle && clock) { clock.deadlineAt = null; clock.pausedReason = 'response'; }
  }
  advanceTurn(room) {
    const priorIndex = room.players.findIndex(player => player.id === room.turn.playerId);
    const next = Array.from({ length: room.players.length }, (_, offset) => room.players[(priorIndex + offset + 1) % room.players.length]).find(player => !player.spectator && (!isBattle(room) || !player.eliminated));
    this.startTurn(room, next.id, room.turn.number + 1);
    log(room, isBattle(room) ? '回合结束。' : '回合结束；卡牌效果及胜负判定尚未实现。', isBattle(room) ? 'Turn ended.' : 'Turn ended; card effects and victory evaluation are not implemented.');
  }
  synchronizeTurn(room, { commit = true } = {}) {
    if (isBattle(room) && room.status === 'playing' && room.pendingBattle) return this.synchronizeBattleDecision(room, { commit });
    if (isBattle(room) && room.status === 'playing' && room.turn && room.players.find(p => p.id === room.turn.playerId)?.eliminated) this.advanceTurn(room);
    if (isBattle(room) && room.status === 'playing' && room.pendingBattle) return this.synchronizeBattleDecision(room, { commit });
    if (room.status !== 'playing' || !room.turn?.clock) return;
    const before = JSON.stringify(room.turn);
    const stateBefore = JSON.stringify({ ...room.turn, clock: { ...room.turn.clock, remainingMs: 0, deadlineAt: null } });
    const turn = room.turn;
    const clock = turn.clock;
    const player = room.players.find(entry => entry.id === turn.playerId);
    const now = this.now();
    if (clock.deadlineAt !== null) {
      // A late poll must stop charging at the actual presence timeout.
      const chargeUntil = this.connected(player) ? now : Math.min(now, player.lastSeenAt + CONNECTED_MS);
      clock.remainingMs = Math.max(0, clock.deadlineAt - chargeUntil);
      if (clock.remainingMs === 0) clock.expired = true;
    }
    if (clock.expired && !room.pendingVote) {
      // Expiry only skips optional play. Draws and discard choices stay private decisions.
      const skipsDiscard=isBattle(room)&&player.active?.catalogueId==='magikarp'&&player.active.level===1&&!player.active.defeated;
      if (turn.drawRemaining === 0 && turn.phase === 'play') {turn.phase = skipsDiscard||player.hand.length <= handLimit(room,player) ? 'end' : 'discard';turn.discardComplete=turn.phase==='end';}
      if (turn.phase === 'end' && turn.drawRemaining === 0 && (turn.discardComplete||skipsDiscard||player.hand.length <= handLimit(room,player))) this.advanceTurn(room);
    }
    if (room.turn === turn) {
      const reason = room.pendingVote ? 'vote' : clock.expired ? 'mandatory' : !this.connected(player) ? 'disconnected' : null;
      clock.pausedReason = reason;
      clock.deadlineAt = reason ? null : now + clock.remainingMs;
    }
    const stateAfter = JSON.stringify({ ...room.turn, clock: { ...room.turn.clock, remainingMs: 0, deadlineAt: null } });
    if (commit && before !== JSON.stringify(room.turn)) {
      if (stateBefore !== stateAfter) room.revision++;
      this.persist(room);
    }
  }
  synchronizeBattleDecision(room, { commit = true } = {}) {
    const before = JSON.stringify(room), pending = room.pendingBattle;
    const turnClock = room.turn?.clock;
    let structural = false;
    if (turnClock) {
      if (turnClock.deadlineAt !== null) turnClock.remainingMs = Math.max(0, turnClock.deadlineAt - this.now());
      const reason = room.pendingVote ? 'vote' : 'response';
      structural ||= turnClock.pausedReason !== reason;
      turnClock.deadlineAt = null; turnClock.pausedReason = reason;
    }
    const clock = pending.clock, actor = room.players.find(p => p.id === pending.actorId);
    if (clock) {
      if (clock.deadlineAt !== null) {
        const until = this.connected(actor) ? this.now() : Math.min(this.now(), actor.lastSeenAt + CONNECTED_MS);
        clock.remainingMs = Math.max(0, clock.deadlineAt - until);
      }
      if (clock.remainingMs === 0 && !room.pendingVote) {
        if(['hand','reorder','reinforcement','effects','turn-start-order','distribute','damage-order'].includes(pending.kind)) {
          const reason=this.connected(actor)?'mandatory':'disconnected';
          structural ||= !clock.expired || clock.pausedReason!==reason;
          clock.expired=true;clock.deadlineAt=null;clock.pausedReason=reason;
        } else {
          respondBattle(room, actor, { decisionId: pending.id, choice: 'pass' }, this.battleContext());
          structural = true;
        }
      } else {
        const reason = room.pendingVote ? 'vote' : !this.connected(actor) ? 'disconnected' : null;
        structural ||= clock.pausedReason !== reason;
        clock.pausedReason = reason; clock.deadlineAt = reason ? null : this.now() + clock.remainingMs;
      }
    }
    if (!room.pendingBattle && room.status === 'playing') this.synchronizeTurn(room, { commit: false });
    if (commit && before !== JSON.stringify(room)) { if (structural) room.revision++; this.persist(room); }
  }
  transferOwner(room) {
    const owner = room.players.find(player => player.id === room.ownerId);
    if (owner?.lastSeenAt === 0 && this.now() < this.restartGraceUntil) return;
    if (owner && this.now() - owner.lastSeenAt <= OWNER_GRACE_MS) return;
    const next = room.players.find(player => !player.spectator && player.id !== room.ownerId && this.connected(player));
    if (!next) return;
    room.ownerId = next.id;
    room.revision++;
    log(room, '原房主离线，已转移房主。', 'The disconnected owner was replaced by a connected player.');
    this.persist(room);
  }
  get(code, allowClosed = false) {
    this.cleanup();
    const room = this.rooms.get(String(code).toUpperCase());
    if (!room) fail(404, 'ROOM_NOT_FOUND', 'Room not found or expired.');
    if (room.status === 'closed' && !allowClosed) fail(410, 'ROOM_CLOSED', 'This room is closed.');
    return room;
  }
  authenticate(room, token) {
    if (typeof token !== 'string' || token.length > 200) fail(401, 'UNAUTHORIZED', 'A valid room credential is required.');
    const player = room.players.find(entry => entry.tokenHash === hash(token));
    if (!player) fail(401, 'UNAUTHORIZED', 'A valid room credential is required.');
    return player;
  }
  addPlayer(room, name, spectator) {
    const token = randomBytes(32).toString('base64url');
    const player = { id: randomUUID(), nickname: name, spectator, tokenHash: hash(token), ready: false, lastSeenAt: this.now(), hand: [], candidates: [], active: null, reserve: null, setupComplete: false, actions: {} };
    room.players.push(player);
    return { token, player };
  }
  create(input) {
    fields(input, ['nickname']);
    const name = nickname(input.nickname);
    this.cleanup();
    let code;
    do { code = Array.from(randomBytes(6), byte => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[byte % 32]).join(''); } while (this.rooms.has(code));
    const room = { schemaVersion: 1, code, revision: 0, status: 'lobby', ownerId: null, settings: { arena: 'stadium', turnSeconds: 0, responseSeconds: 0 }, players: [], turn: null, pendingVote: null, log: [], lastActionAt: this.now() };
    const { token, player } = this.addPlayer(room, name, false);
    room.ownerId = player.id;
    log(room, '测试房间已建立。', 'Foundation room created.');
    this.persist(room);
    this.rooms.set(code, room);
    return { code, token, playerId: player.id, view: this.project(room, player) };
  }
  join(code, input) {
    fields(input, ['nickname', 'spectator']);
    const name = nickname(input.nickname);
    if (input.spectator !== undefined && typeof input.spectator !== 'boolean') fail(400, 'INVALID_INPUT', 'Spectator must be a boolean.');
    const room = structuredClone(this.get(code));
    const spectator = input.spectator === true;
    if (!spectator && room.status !== 'lobby') fail(409, 'GAME_STARTED', 'Only spectators can join a game in progress.');
    if (room.players.length >= 30 || (!spectator && room.players.filter(player => !player.spectator).length >= 6)) fail(409, 'ROOM_FULL', 'This development room is full.');
    const { token, player } = this.addPlayer(room, name, spectator);
    room.revision++;
    room.lastActionAt = this.now();
    log(room, spectator ? '观战者已加入。' : '玩家已加入。', spectator ? 'A spectator joined.' : 'A player joined.');
    this.persist(room);
    this.rooms.set(room.code, room);
    return { code: room.code, token, playerId: player.id, view: this.project(room, player) };
  }
  view(code, token) {
    const room = this.get(code);
    const player = this.authenticate(room, token);
    player.lastSeenAt = this.now();
    this.synchronizeTurn(room);
    this.transferOwner(room);
    return { view: this.project(room, player) };
  }
  project(room, self) {
    const battle = isBattle(room), disclosed = battle && room.status === 'finished';
    const visiblePokemon = pokemon => battle ? publicBattlePokemon(pokemon, this.catalogue, room) : publicPokemon(pokemon);
    return {
      code: room.code, revision: room.revision, status: room.status, ownerId: room.ownerId, selfId: self.id,
      settings: { ...room.settings },
      players: room.players.map(player => ({ id: player.id, nickname: player.nickname, ready: player.ready, connected: this.connected(player), spectator: player.spectator, handCount: player.hand.length,...(battle?{exiledCount:player.exiledCards?.length||0}:{}),
        active: player.active && (room.status !== 'setup' || player.id === self.id) ? visiblePokemon(player.active) : null,
        ...((room.status === 'playing' && player.reserve?.revealed === true) || (disclosed && player.reserve) ? { reserve: visiblePokemon(player.reserve) } : {}),
        reserveCount: player.reserve ? 1 : 0, setupComplete: player.setupComplete,
        ...(battle ? { role: player.role === 'leader' || player.eliminated || disclosed ? player.role ?? null : null, eliminated: Boolean(player.eliminated), identityAcknowledged: Boolean(player.identityAcknowledged), candidateDrawCount: player.candidates.length } : {}),
        ...(disclosed ? { hand: structuredClone(player.hand) } : {}),
      })),
      self: { spectator: self.spectator, hand: structuredClone(self.hand), ...(battle?{exiledCount:self.exiledCards?.length||0}:{}), candidates: [...self.candidates], reserve: self.reserve ? { ...self.reserve } : null,
        ...(battle ? { role: self.role ?? null, identityAcknowledged: Boolean(self.identityAcknowledged), pokemonDrawRemaining: self.candidateDeal?.length ?? 0, handLimit:Number.isFinite(handLimit(room,self))?handLimit(room,self):null, battle: previewActions(room, self, this.catalogue) } : {}) },
      turn: room.turn ? structuredClone(room.turn) : null, log: structuredClone(room.log), pendingVote: room.pendingVote ? structuredClone(room.pendingVote) : null,
      ...(battle ? { gameMode: 'combat-preview', scenario: { ...room.scenario }, pendingBattle: publicBattleDecision(room,self), result: room.result ? structuredClone(room.result) : null, drawCount: room.drawPile?.length ?? 0, discardCount: room.discardPile?.length ?? 0 } : {}),
      lastActionAt: room.lastActionAt, expiresAt: room.lastActionAt + IDLE_MS, serverNow: this.now(), foundation: true,
    };
  }
  action(code, token, input) {
    if (!object(input) || typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.id) || !Number.isSafeInteger(input.revision) || input.revision < 0 || typeof input.type !== 'string') fail(400, 'INVALID_INPUT', 'Action needs an id, revision, and type.');
    const current = this.get(code, true);
    const currentPlayer = this.authenticate(current, token);
    const signature = JSON.stringify(Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b))));
    if (Object.hasOwn(currentPlayer.actions, input.id)) {
      if (currentPlayer.actions[input.id] !== signature) fail(409, 'ACTION_ID_REUSED', 'This action id was already used with different input.');
      currentPlayer.lastSeenAt = this.now();
      this.synchronizeTurn(current);
      return { view: this.project(current, currentPlayer) };
    }
    if (current.status === 'closed') fail(410, 'ROOM_CLOSED', 'This room is closed.');
    if (current.revision !== input.revision) fail(409, 'STALE_REVISION', 'Room changed. Refresh and try again.');
    if (Object.keys(currentPlayer.actions).length >= 20000) fail(429, 'ACTION_LIMIT', 'This credential has reached the development action limit.');
    const room = structuredClone(current);
    const player = room.players.find(entry => entry.id === currentPlayer.id);
    player.lastSeenAt = this.now();
    const seated = room.players.filter(entry => !entry.spectator);
    const owner = () => { if (player.id !== room.ownerId) fail(403, 'OWNER_ONLY', 'Only the room owner can do this.'); };
    const seat = () => { if (player.spectator) fail(403, 'SPECTATOR_ONLY_VIEW', 'Spectators cannot perform player actions.'); };
    const status = value => { if (room.status !== value) fail(409, 'WRONG_PHASE', 'This action is unavailable in this phase.'); };
    const ownTurn = () => { seat(); status('playing'); if (room.turn.playerId !== player.id) fail(403, 'NOT_YOUR_TURN', 'Wait for your turn.'); };
    const check = extra => fields(input, ['id', 'revision', 'type', ...extra]);
    if (room.pendingVote && !['approveEnd', 'rejectEnd'].includes(input.type)) fail(409, 'VOTE_PENDING', 'Resolve the closing vote first.');
    if (room.pendingBattle && !['respondBattle', 'requestEndGame', 'requestEndRoom', 'approveEnd', 'rejectEnd'].includes(input.type)) fail(409, 'RESPONSE_PENDING', 'Resolve the pending response first.');
    switch (input.type) {
      case 'ready':
        check(['ready']); seat(); status('lobby');
        if (typeof input.ready !== 'boolean') fail(400, 'INVALID_INPUT', 'Ready must be a boolean.');
        player.ready = input.ready;
        break;
      case 'settings':
        check(['arena', 'turnSeconds', 'responseSeconds']); owner(); status('lobby');
        if (!['stadium', 'gym', 'floating'].includes(input.arena) || ![input.turnSeconds, input.responseSeconds].every(value => Number.isInteger(value) && (value === 0 || (value >= 5 && value <= 600)))) fail(400, 'INVALID_SETTINGS', 'Choose a supported arena and timers of 0 or 5–600 seconds.');
        room.settings = { arena: input.arena, turnSeconds: input.turnSeconds, responseSeconds: input.responseSeconds };
        break;
      case 'startBattlePreview':
        check([]); owner(); status('lobby');
        this.battleCall(() => setupBattle(room, this.catalogue));
        break;
      case 'acknowledgeIdentity':
        check([]); seat(); status('identity');
        this.battleCall(() => acknowledgeBattleIdentity(room, player, this.catalogue));
        break;
      case 'drawPokemon':
        check([]); seat(); status('setup');
        if (player.setupComplete || !player.candidateDeal?.length) fail(409, 'POKEMON_DRAW_EXHAUSTED', 'All five Pokémon candidates have been drawn.');
        player.candidates.push(player.candidateDeal.shift());
        log(room, '一名训练家摸取了一张私密宝可梦候选。', 'A trainer drew one private Pokémon candidate.');
        break;
      case 'start':
        check([]); owner(); status('lobby');
        if (seated.length < 2 || seated.length > 6 || seated.some(entry => !entry.ready)) fail(409, 'NOT_READY', 'Development setup requires 2–6 ready players.');
        if (this.catalogueIds.length < seated.length * 5) fail(503, 'CONTENT_UNAVAILABLE', 'The shared deck needs five unique Pokémon per player.');
        room.pokemonDeck = dealPokemon(seated, this.catalogueIds, { revealImmediately: true });
        room.status = 'setup';
        log(room, '每位训练家从共享洗匀牌库获得五个不重复候选，并选两只搭档。', 'Each trainer receives five distinct candidates from one shuffled shared deck and selects two partners.');
        break;
      case 'selectPokemon':
        check(['activeId', 'reserveId']); seat(); status('setup');
        if (player.setupComplete) fail(409, 'ALREADY_SELECTED', 'Your setup selection is already locked.');
        if (input.activeId === input.reserveId || !player.candidates.includes(input.activeId) || !player.candidates.includes(input.reserveId)) fail(400, 'INVALID_SELECTION', 'Choose two distinct candidates from your private selection.');
        if (isBattle(room)) {
          const complete = this.battleCall(() => selectBattlePartners(room, player, input.activeId, input.reserveId, this.catalogue));
          if (complete) this.startTurn(room, room.players.find(p => !p.spectator).id, 1);
          break;
        }
        room.pokemonDeck.push(...player.candidates.filter(id => id !== input.activeId && id !== input.reserveId));
        player.active = { catalogueId: input.activeId, level: 1 };
        player.reserve = { catalogueId: input.reserveId, level: 1 };
        player.setupComplete = true;
        if (seated.every(entry => entry.setupComplete)) {
          room.status = 'playing'; room.pokemonDeck = shufflePokemon(room.pokemonDeck);
          seated.forEach(entry => { entry.hand = Array.from({ length: 4 }, placeholder); entry.candidates = []; });
          this.startTurn(room, seated[0].id, 1);
          log(room, '测试回合开始；可交替搭档及选择结束时升级，手牌效果、战斗及胜负尚未实现。', 'Fixture turns started. Partner switching and optional end-turn level-up are available; hand-card effects, combat and victory remain pending.');
        }
        break;
      case 'draw':
        check([]); ownTurn();
        if (room.turn.drawRemaining <= 0 || room.turn.phase !== 'draw') fail(409, 'DRAW_EXHAUSTED', 'Both mandatory draws are already complete.');
        if (isBattle(room)) this.battleCall(() => drawBattleCards(room, player,1,'draw-phase')); else player.hand.push(placeholder());
        room.turn.drawRemaining--;
        if (room.turn.drawRemaining === 0) room.turn.phase = 'play';
        log(room, isBattle(room) ? '当前玩家摸取一张牌。' : '当前玩家抽取一张测试手牌。', isBattle(room) ? 'The current player drew one card.' : 'The current player drew one fixture card.');
        break;
      case 'attack':
        check(['cardId', 'targetIds', 'moveIndex', 'boostCardId','effectChoice']); ownTurn();
        if (!isBattle(room)) fail(409, 'WRONG_MODE', 'Attacks are available in the combat preview.');
        this.battleCall(() => playBattleMove(room, player, input, this.battleContext()));
        break;
      case 'equipItem':
        check(['cardId','slot']);ownTurn();if(!isBattle(room))fail(409,'WRONG_MODE','Held items require combat preview.');
        this.battleCall(()=>equipBattleItem(room,player,input,this.battleContext()));break;
      case 'giveCards':
        check(['cardIds', 'recipientId', 'targetIds']); ownTurn();
        if (!isBattle(room)) fail(409, 'WRONG_MODE', 'Justified is available in the combat preview.');
        this.battleCall(() => giveBattleCards(room, player, input, this.battleContext()));
        break;
      case 'respondBattle':
        check(['decisionId', 'choice', 'cardId', 'cardIds', 'handIndex', 'handIndices', 'order', 'reinforcement', 'effect','allocations','targetId']); seat(); status('playing');
        if (!isBattle(room)) fail(409, 'WRONG_MODE', 'There is no combat response.');
        this.battleCall(() => respondBattle(room, player, input, this.battleContext()));
        break;
      case 'useTrait':
        check(['cardIds']); ownTurn();
        if (!isBattle(room)) fail(409, 'WRONG_MODE', 'Traits are available in the combat preview.');
        this.battleCall(() => useBattleTrait(room, player, this.battleContext(),input));
        break;
      case 'returnToLobby':
        check([]); owner(); status('finished');
        room.pendingVote = { kind: 'endGame', requiredIds: [], approvedIds: [] }; this.resolveVote(room, true);
        break;
      case 'switchPokemon': {
        check([]); ownTurn();
        if (room.turn.phase !== 'play') fail(409, 'WRONG_PHASE', 'Switch partners only during your play phase.');
        if (room.turn.switchUsed) fail(409, 'SWITCH_USED', 'You already switched partners during this play phase.');
        if (!player.active || !player.reserve) fail(409, 'SWITCH_UNAVAILABLE', 'An active and reserve partner are required.');
        if (isBattle(room)) {
          if (!previewActions(room, player, this.catalogue)?.canSwitch) fail(409, 'SWITCH_UNAVAILABLE', 'The current battle state forbids switching.');
          this.battleCall(() => requestBattleSwitch(room,player,'ordinary',this.battleContext()));
          break;
        }
        // Booklet p.5: the creatures and their attached state move between zones.
        // p.8: an incoming hidden reserve is revealed. p.11: outgoing reinforcement is discarded.
        const outgoing = player.active;
        const incoming = player.reserve;
        if (Object.hasOwn(outgoing, 'reinforcements')) outgoing.reinforcements = [];
        outgoing.revealed = true;
        incoming.revealed = true;
        player.active = incoming;
        player.reserve = outgoing;
        room.turn.switchUsed = true;
        log(room, '当前玩家交替了出场与备战宝可梦；已公开的搭档保持公开。', 'The current player switched active and reserve Pokémon; revealed partners remain public.');
        break;
      }
      case 'finishPlay':
        check([]); ownTurn();
        if (room.turn.phase !== 'play') fail(409, 'WRONG_PHASE', 'Only the play phase can be finished.');
        room.turn.phase = isBattle(room) && player.active?.catalogueId === 'magikarp' && player.active.level === 1 && !player.active.defeated
          ? 'end'
          : player.hand.length > handLimit(room,player) ? 'discard' : 'end';
        room.turn.discardComplete=room.turn.phase==='end';
        break;
      case 'discard': {
        check(['cardId']); ownTurn();
        if (room.turn.phase !== 'discard' || room.turn.drawRemaining !== 0 || player.hand.length <= handLimit(room,player)) fail(409, 'DISCARD_NOT_ALLOWED', 'Finish play, then discard only excess cards above four.');
        const index = player.hand.findIndex(card => card.id === input.cardId);
        if (typeof input.cardId !== 'string' || index < 0) fail(400, 'INVALID_CARD', 'Choose a card from your own hand.');
        const discarded = player.hand.splice(index, 1)[0];
        if (isBattle(room)) room.discardPile.push(discarded);
        if (player.hand.length <= handLimit(room,player)){room.turn.phase = 'end';room.turn.discardComplete=true;}
        log(room, '当前玩家弃置一张测试手牌。', 'The current player discarded one fixture card.');
        break;
      }
      case 'endTurn': {
        check(['levelUp']); ownTurn();
        if (input.levelUp !== undefined && typeof input.levelUp !== 'boolean') fail(400, 'INVALID_INPUT', 'Level up must be a boolean.');
        const skipsDiscard=isBattle(room)&&player.active?.catalogueId==='magikarp'&&player.active.level===1&&!player.active.defeated;
        if (room.turn.phase !== 'end' || room.turn.drawRemaining !== 0 || (!room.turn.discardComplete&&!skipsDiscard&&player.hand.length > handLimit(room,player))) fail(409, 'TURN_INCOMPLETE', 'Finish play, complete both draws and discard down to four cards first.');
        if (input.levelUp === true) {
          if (player.active.level >= 3) fail(409, 'LEVEL_CAP', 'The active Pokémon is already at level 3.');
          player.active.level++;
          log(room, '当前玩家选择让出战宝可梦提升一个等级。', 'The current player chose to raise their active Pokémon by one level.');
        }
        this.advanceTurn(room);
        break;
      }
      case 'requestEndGame':
      case 'requestEndRoom': {
        check([]); owner();
        const kind = input.type === 'requestEndGame' ? 'endGame' : 'endRoom';
        if (room.status === 'lobby') {
          if (kind === 'endGame') fail(409, 'WRONG_PHASE', 'No game is in progress.');
          room.status = 'closed';
        } else {
          room.pendingVote = { kind, requestedBy: player.id, approvedIds: [player.id], requiredIds: seated.filter(entry => this.connected(entry)).map(entry => entry.id) };
          log(room, '房主提出结束表决；需当前在线的在座玩家一致同意。', 'Owner requested closure; all currently connected seated players must agree.');
          this.resolveVote(room);
        }
        break;
      }
      case 'approveEnd':
      case 'rejectEnd':
        check([]); seat();
        if (!room.pendingVote || !room.pendingVote.requiredIds.includes(player.id)) fail(409, 'NO_VOTE', 'There is no closing vote for you.');
        if (input.type === 'rejectEnd') { room.pendingVote = null; log(room, '结束提案已被否决。', 'The closing request was rejected.'); }
        else { if (!room.pendingVote.approvedIds.includes(player.id)) room.pendingVote.approvedIds.push(player.id); this.resolveVote(room); }
        break;
      default: fail(400, 'UNKNOWN_ACTION', 'This action is not implemented in the foundation.');
    }
    Object.defineProperty(player.actions, input.id, { value: signature, enumerable: true, configurable: true, writable: true });
    this.synchronizeTurn(room, { commit: false });
    room.revision++;
    room.lastActionAt = this.now();
    this.persist(room);
    this.rooms.set(room.code, room);
    return { view: this.project(room, player) };
  }
  resolveVote(room, completedResult = false) {
    const vote = room.pendingVote;
    if (!vote.requiredIds.every(id => vote.approvedIds.includes(id))) return;
    room.pendingVote = null;
    delete room.pokemonDeck; delete room.gameMode; delete room.pendingBattle; delete room.resolution; delete room.resolutionStack; delete room.judgment; delete room.statusEvent;delete room.turnStart;delete room.switchEvent; delete room.drawPile; delete room.discardPile; delete room.scenario; delete room.result;
    room.turn = null;
    room.status = vote.kind === 'endRoom' ? 'closed' : 'lobby';
    for (const player of room.players) {
      delete player.role; delete player.eliminated; delete player.identityAcknowledged; delete player.candidateDeal;
      delete player.exiledCards;
      player.ready = false; player.hand = []; player.candidates = []; player.active = null; player.reserve = null; player.setupComplete = false;
    }
    log(room, vote.kind === 'endRoom' ? '全员同意，房间已关闭。' : completedResult ? '房主已在结果后返回大厅，可准备下一局。' : '全员同意，游戏已结束并返回大厅。', vote.kind === 'endRoom' ? 'Unanimous vote closed the room.' : completedResult ? 'The host returned to the lobby after the result; ready for a rematch.' : 'Unanimous vote ended the game and returned to the lobby.');
  }
}
