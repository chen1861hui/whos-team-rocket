import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { BattleError, isBattle, setupBattle, acknowledgeBattleIdentity, selectBattlePartners, drawBattleCards, beginBattleTurn, endBattleTurn, canChooseShedinja, playBattleMove, giveBattleCards, equipBattleItem, useLightBall, useBattleTool, useBattleEvent, handLimit, respondBattle, useBattleTrait, previewActions, publicBattlePokemon, publicBattleDecision, publicActiveCardEvent, publicPartnerTrainerAvatar, requestBattleSwitch, battleTraitsEffective, revealBattleIdentity, useTourAction, tourTimeoutChoice, activeFieldWeather, startViridianRound, finishSilphRotation } from './combat.js';
import { contentPacks, expansionCatalogue, hasPack, HOENN_PACK, SHEDINJA_ID } from '../public/expansion-content.js';
import { civilianProfiles, gymLeaderProfiles, roleProfiles } from '../public/trainer-profiles.js';
import { RADIO_TOWER, LAKE_RAGE, SILPH_CONTROL, ROOM_CAPACITY, seatCapacity, VIRIDIAN_GYM } from '../public/match-mode.js';
import { trainerProfessionIds } from '../public/trainer-professions.js';
import { pokemonTypes } from '../public/pokemon-types.js';
import { dealPokemon, shufflePokemon } from './pokemon-deal.js';
import { rocketPartnerFor } from './battle-rules.js';
import { aiActor, aiActions, aiDifficulty, aiDifficulties, needsAiStrategy, publicAiTable } from './ai-players.js';
import { BASIC_DECK, isDeckProfile, RETAIL_DECK } from './playtest-deck.js';

export const IDLE_MS = 7 * 60 * 60 * 1000;
export const CONNECTED_MS = 30_000;
export const OWNER_GRACE_MS = 60_000;
const aiNames = ['小岚', '赤羽', '蓝铃', '青藤', '岩星', '月白', '霜叶', '小遥'];
function availableAiName(players) {
  const occupied = new Set(players.map(player => player.nickname));
  const available = aiNames.find(name => !occupied.has(`${name} · AI`));
  if (available) return `${available} · AI`;
  let number = 2;
  while (occupied.has(`小岚 ${number} · AI`)) number++;
  return `小岚 ${number} · AI`;
}
// Minimum time after a public action before any following AI action.
function aiPresentationDelay(before, after, input) {
  if (after.status !== 'playing') return 0;
  const recent = new Set((before.visualEvents ?? []).map(cue => cue.id));
  const cues = (after.visualEvents ?? []).filter(cue => !recent.has(cue.id));
  if (cues.some(cue => cue.kind === 'knockout')) return 2200;
  const previousJudgment = before.log.findLast(entry => entry.judgment)?.id;
  const currentJudgment = after.log.findLast(entry => entry.judgment)?.id;
  if (currentJudgment && currentJudgment !== previousJudgment) return 1850;
  if (cues.some(cue => ['attack', 'event', 'event-action', 'hit'].includes(cue.kind))) return 1700;
  if (input?.type === 'switchPokemon' ||
      (input?.type === 'respondBattle' && ['potion', 'healer', 'switch'].includes(input.choice))) return 1400;
  if (['attack', 'useEvent', 'useTool', 'equipItem', 'useLightBall'].includes(input?.type)) return 1350;
  return 0;
}

const publicAiActions = {
  attack: ['发起了招式。', ' used a move.'],
  useEvent: ['打出了事件牌。', ' played an event.'],
  useTool: ['使用了道具。', ' used a tool.'],
  equipItem: ['装备了持有物。', ' equipped a held item.'],
  useLightBall: ['使用了电气球。', ' used Light Ball.'],
  switchPokemon: ['发起了搭档交替。', ' initiated a partner switch.'],
};

const openSeatNumber = room => Array.from({ length: seatCapacity(room.settings ?? {}) }, (_, index) => index + 1)
  .find(number => !room.players.some(player => player.seatNumber === number));
const validSeat = (room, number) => Number.isInteger(number) && number >= 1 && number <= seatCapacity(room.settings);
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
  #aiTasks = new Map();
  #aiPresentationUntil = new Map();
  #aiStopped = false;

  constructor({ dataDir, catalogue, now = Date.now, allowTestDecks = false,
    aiPaceMs = 650, aiTimeoutMs = 2400, scheduleAi = setTimeout, cancelAi = clearTimeout } = {}) {
    this.aiPaceMs = aiPaceMs;
    this.aiTimeoutMs = aiTimeoutMs;
    this.scheduleAi = scheduleAi;
    this.cancelAi = cancelAi;
    if (!dataDir || !Array.isArray(catalogue?.entries)) throw new Error('RoomStore requires private dataDir and catalogue entries.');
    this.dataDir = dataDir;
    this.catalogueIds = [...new Set(catalogue.entries.map(entry => entry.id).filter(id => typeof id === 'string'))];
    this.now = now;
    this.catalogue = expansionCatalogue(catalogue);
    this.allowTestDecks = allowTestDecks;
    // Loaded owners get a full recovery window even though saved transport presence is cleared.
    this.restartGraceUntil = this.now() + OWNER_GRACE_MS;
    this.rooms = new Map();
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    for (const file of readdirSync(dataDir)) {
      if (!/^[A-Z2-9]{6}\.json$/.test(file)) continue;
      try {
        const room = JSON.parse(readFileSync(join(dataDir, file), 'utf8'));
        if (room.schemaVersion !== 1 || `${room.code}.json` !== file || !Array.isArray(room.players)) throw new Error('Invalid persisted room');
        for (const player of room.players.filter(player => !player.spectator && player.seatNumber === undefined)) {
          player.seatNumber = openSeatNumber(room);
        }
        if (room.status === 'lobby' && !this.allowTestDecks) room.settings.deckProfile = RETAIL_DECK;
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
        if(isBattle(room)&&room.scenario)room.scenario.potionSupported=true;
        // A restart breaks transport presence; credentials and game state still recover.
        for (const player of room.players) {
          player.lastSeenAt = 0;
          if (player.ai && /^AI \d+$/.test(player.nickname)) player.nickname = availableAiName(room.players);
        }
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
        this.#aiPresentationUntil.delete(code);
        this.#clearAiTask(code);
      } else if (room.status !== 'closed') {
        this.synchronizeTurn(room);
        this.transferOwner(room);
        this.#updateAiTask(room);
      }
    }
  }
  connected(player) { return Boolean(player?.ai || (player?.lastSeenAt > 0 && this.now() - player.lastSeenAt <= CONNECTED_MS)); }
  battleContext() { return { catalogue: this.catalogue, now: this.now, connected: player => this.connected(player) }; }
  battleCall(callback) {
    try { return callback(); }
    catch (error) { if (error instanceof BattleError) fail(error.status, error.code, error.message); throw error; }
  }
  resolveAutomaticDraw(room) {
    const turn = room.turn;
    if (room.settings.autoDraw !== true || !isBattle(room) || room.status !== 'playing' ||
        turn?.phase !== 'draw' || room.pendingBattle || room.pendingVote || room.turnStart) return false;
    const player = room.players.find(entry => entry.id === turn.playerId);
    if (!player || player.eliminated || previewActions(room, player, this.catalogue)?.canTrait) return false;
    const count = Math.min(turn.drawRemaining, room.drawPile.length + room.discardPile.length);
    if (count > 0) drawBattleCards(room, player, count, 'draw-phase');
    turn.drawStarted = true;
    turn.drawRemaining = 0;
    turn.phase = 'play';
    log(room, `本回合自动摸取${count}张牌。`, `The current trainer automatically drew ${count} card(s).`);
    return true;
  }
  startTurn(room, playerId, number, roundStart = number === 1) {
    room.turn = {
      playerId, number, drawRemaining: 2, phase: 'draw', switchUsed: false, discardComplete:false,
      ...(roundStart && room.scenario?.weatherLab ? {weatherLabRoundStart:true} : {}),
      clock: room.settings.turnSeconds > 0 ? { remainingMs: room.settings.turnSeconds * 1000, deadlineAt: null, pausedReason: null, expired: false } : null,
    };
    const clock = room.turn.clock;
    if (clock) {
      const connected = this.connected(room.players.find(player => player.id === playerId));
      clock.deadlineAt = connected ? this.now() + clock.remainingMs : null;
      clock.pausedReason = connected ? null : 'disconnected';
    }
    if (isBattle(room)) {
      if (roundStart) {
        for (const player of room.players) delete player.researcherJudged;
        startViridianRound(room);
      }
      beginBattleTurn(room, room.players.find(p => p.id === playerId), this.battleContext());
    }
    this.resolveAutomaticDraw(room);
    if (room.pendingBattle && clock) { clock.deadlineAt = null; clock.pausedReason = 'response'; }
  }
  advanceTurn(room) {
    if (isBattle(room)) {
      const ending = room.turn;
      endBattleTurn(room, room.players.find(player=>player.id===ending.playerId), this.battleContext());
      if (room.status !== 'playing') return;
      if (room.pendingBattle) {
        ending.awaitingEndSettlement = true;
        return;
      }
    }
    const priorIndex = room.players.findIndex(player => player.id === room.turn.playerId);
    const next = Array.from({ length: room.players.length }, (_, offset) => room.players[(priorIndex + offset + 1) % room.players.length]).find(player => !player.spectator && (!isBattle(room) || !player.eliminated));
    const nextIndex=room.players.indexOf(next);
    if (isBattle(room) && finishSilphRotation(room,priorIndex,nextIndex,this.battleContext())) return;
    this.startTurn(room, next.id, room.turn.number + 1, nextIndex <= priorIndex);
    log(room, isBattle(room) ? '回合结束。' : '回合结束；卡牌效果及胜负判定尚未实现。', isBattle(room) ? 'Turn ended.' : 'Turn ended; card effects and victory evaluation are not implemented.');
  }
  synchronizeTurn(room, { commit = true } = {}) {
    if (isBattle(room) && room.status === 'playing' && room.pendingBattle) return this.synchronizeBattleDecision(room, { commit });
    if (isBattle(room) && room.status === 'playing' && room.turn &&
        (room.turn.awaitingEndSettlement || room.players.find(p => p.id === room.turn.playerId)?.eliminated)) this.advanceTurn(room);
    if (isBattle(room) && room.status === 'playing' && room.pendingBattle) return this.synchronizeBattleDecision(room, { commit });
    if (this.resolveAutomaticDraw(room) && commit) {
      room.revision++;
      this.persist(room);
    }
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
      const skipsDiscard=isBattle(room)&&player.active?.catalogueId==='magikarp'&&player.active.level===1&&battleTraitsEffective(room,player.active);
      if (turn.drawRemaining === 0 && turn.phase === 'play') {turn.phase = skipsDiscard||player.hand.length <= handLimit(room,player) ? 'end' : 'discard';turn.discardComplete=turn.phase==='end';}
      if (turn.phase === 'end' && turn.drawRemaining === 0 && (turn.discardComplete||skipsDiscard||player.hand.length <= handLimit(room,player))) this.advanceTurn(room);
    }
    if (room.turn === turn) {
      const reason = room.pendingVote ? 'vote' : room.pendingBattle ? 'response' : clock.expired ? 'mandatory' : !this.connected(player) ? 'disconnected' : null;
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
        const tourChoice = !actor?.ai && tourTimeoutChoice(pending);
        if (tourChoice) {
          respondBattle(room, actor, { decisionId: pending.id, ...tourChoice }, this.battleContext());
          structural = true;
        } else if(actor?.ai || ['hand','reorder','forewarn-order','sweet-kiss','vital-spirit','download','download-hand','intimidate','intimidate-hand','reinforcement','effects','source-effect-order','turn-start-order','distribute','damage-order','mew-blessing','event-hand','berry-pick','reveal-judgment','expansion'].includes(pending.kind)) {
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
    const next = room.players.find(player => !player.spectator && !player.ai && player.id !== room.ownerId && this.connected(player));
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
    const tokenHash = hash(token);
    const player = room.players.find(entry => !entry.ai && entry.tokenHash === tokenHash);
    if (!player) fail(401, 'UNAUTHORIZED', 'A valid room credential is required.');
    return player;
  }
  addPlayer(room, name, spectator) {
    const token = randomBytes(32).toString('base64url');
    const player = { id: randomUUID(), nickname: name, spectator, tokenHash: hash(token), ready: false, lastSeenAt: this.now(), hand: [], candidates: [], active: null, reserve: null, setupComplete: false, actions: {} };
    if (!spectator) player.seatNumber = openSeatNumber(room);
    room.players.push(player);
    return { token, player };
  }
  create(input) {
    fields(input, ['nickname']);
    const name = nickname(input.nickname);
    this.cleanup();
    let code;
    do { code = Array.from(randomBytes(6), byte => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[byte % 32]).join(''); } while (this.rooms.has(code));
    const deckProfile = this.allowTestDecks ? BASIC_DECK : RETAIL_DECK;
    const room = { schemaVersion: 1, code, revision: 0, status: 'lobby', ownerId: null, settings: { arena: 'fire', turnSeconds: 0, responseSeconds: 0, deckProfile }, players: [], turn: null, pendingVote: null, log: [], lastActionAt: this.now() };
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
    if (room.players.length >= ROOM_CAPACITY || (!spectator && !openSeatNumber(room))) fail(409, 'ROOM_FULL', 'This development room is full.');
    const { token, player } = this.addPlayer(room, name, spectator);
    room.revision++;
    room.lastActionAt = this.now();
    log(room, spectator ? '观战者已加入。' : '玩家已加入。', spectator ? 'A spectator joined.' : 'A player joined.');
    this.persist(room);
    this.rooms.set(room.code, room);
    this.#updateAiTask(room);
    return { code: room.code, token, playerId: player.id, view: this.project(room, player) };
  }
  view(code, token) {
    const room = this.get(code);
    const player = this.authenticate(room, token);
    player.lastSeenAt = this.now();
    this.synchronizeTurn(room);
    this.transferOwner(room);
    this.#updateAiTask(room);
    return { view: this.project(room, player) };
  }
  project(room, self) {
    const battle = isBattle(room), disclosed = battle && room.status === 'finished';
    const field = battle ? activeFieldWeather(room) : null;
    const fieldWeather = field && (field.source==='weather-lab' ? field : {kind:field.kind,turnsRemaining:field.expiresAtTurn-room.turn.number});
    const viridian = room.scenario?.viridian;
    const rocketPartner = battle ? rocketPartnerFor(room,self) : null;
    const leaderConcealed = !viridian && room.settings.matchMode !== 'teams' && room.status==='identity' && !room.players.some(player=>player.role==='leader' && player.identityAcknowledged);
    // Match order starts at the leader, so withhold that ordering until the public flip.
    const players = leaderConcealed ? room.players.toSorted((a,b)=>Number(a.spectator)-Number(b.spectator) || a.id.localeCompare(b.id)) : room.players;
    const visiblePokemon = (pokemon,own) => battle ? publicBattlePokemon(pokemon, this.catalogue, room, own) : publicPokemon(pokemon);
    const hasTrainerAvatars = battle || room.status === 'lobby';
    const cosmeticSeats = hasTrainerAvatars ? room.players.filter(player=>!player.spectator).toSorted((a,b)=>a.id.localeCompare(b.id)) : [];
    const seed = room.trainerPoolSeed ?? Number.parseInt(hash(room.code).slice(0,8),16);
    const publicIdentity = player => (player.role==='leader' && !viridian && !leaderConcealed) || player.identityPublic || player.eliminated || disclosed ? player.role ?? null : null;
    const avatar = (player, role) => {
      if (role==='leader' && !viridian) return gymLeaderProfiles[room.settings.arena] ?? gymLeaderProfiles.fire;
      const pool = roleProfiles[role];
      if (pool) {
        const index = cosmeticSeats.filter(seat=>seat.role===role).indexOf(player);
        return pool[(seed+index)%pool.length];
      }
      const special = room.status==='playing' && publicPartnerTrainerAvatar(player);
      return special || civilianProfiles[(seed+cosmeticSeats.indexOf(player))%civilianProfiles.length];
    };
    const task = this.#aiTasks.get(room.code);
    const canSuggest = task?.needsStrategy && self.id === room.ownerId && task.revision === room.revision;
    return {
      ...(canSuggest && !task.failed ? { aiTask: {
        id: task.id, revision: task.revision, actorId: task.actorId, turnNumber: task.turnNumber,
        decisionId: task.decisionId, difficulty: task.difficulty, players: task.players,
      } } : {}),
      ...(task?.failed && task.revision === room.revision ? { aiError: {
        code: 'AI_ACTION_UNAVAILABLE', kind: task.decisionKind,
      } } : {}),
      code: room.code, revision: room.revision, status: room.status, ownerId: room.ownerId, selfId: self.id,
      settings: { ...room.settings },
      players: players.map(player => ({ id: player.id, nickname: player.nickname, ready: player.ready, connected: this.connected(player), spectator: player.spectator, ai: Boolean(player.ai), ...(player.ai ? { aiDifficulty: aiDifficulty(player) } : {}), handCount: player.hand.length,...(battle?{exiledCount:player.exiledCards?.length||0}:{}),
        ...(!player.spectator ? {seatNumber: player.seatNumber} : {}),
        active: player.active && (room.status !== 'setup' || player.id === self.id) ? visiblePokemon(player.active,player.id===self.id) : null,
        ...((room.status === 'playing' && player.reserve?.revealed === true) || (disclosed && player.reserve) ? { reserve: visiblePokemon(player.reserve) } : {}),
        reserveCount: player.reserve ? 1 : 0, setupComplete: player.setupComplete,
        ...(battle && player.delayedEvents?.length ? {
          delayedEvents: player.delayedEvents.map(({kind,eventType,name,weather})=>({kind,eventType,name,weather})),
        } : {}),
        ...(player.raidBoss ? {raidBoss:true} : {}),
        ...(battle ? { role:publicIdentity(player), eliminated:Boolean(player.eliminated), identityAcknowledged:Boolean(player.identityAcknowledged), candidateDrawCount:player.candidates.length } : {}),
        ...(battle && player.rocketAlias && publicIdentity(player)==='rocket' ? {rocketAlias:player.rocketAlias} : {}),
        ...(battle && player.profession ? {profession:player.profession,
          ...(player.professionUsed ? {professionUsed:true} : {})} : {}),
        ...(hasTrainerAvatars && !player.spectator ? {trainerAvatar:avatar(player,battle ? publicIdentity(player) : null)} : {}),
        ...(disclosed ? { hand: structuredClone(player.hand) } : {}),
      })),
      self: { spectator: self.spectator, hand: structuredClone(self.hand), ...(battle?{exiledCount:self.exiledCards?.length||0}:{}), candidates: [...self.candidates], reserve: self.reserve ? { ...self.reserve } : null,
        ...(rocketPartner ? {rocketAlias:self.rocketAlias,
          rocketPartner:{id:rocketPartner.id,nickname:rocketPartner.nickname,alias:rocketPartner.rocketAlias}} : {}),
        ...(battle && room.status==='setup' && !self.spectator && !self.setupComplete
          ? {candidateTypeHints:(self.candidateDeal || []).map(id => pokemonTypes(id)[0] ?? null)} : {}),
        ...(battle ? { role: self.role ?? null, identityAcknowledged: Boolean(self.identityAcknowledged), pokemonDrawRemaining: self.candidateDeal?.length ?? 0, handLimit:Number.isFinite(handLimit(room,self))?handLimit(room,self):null, battle: previewActions(room, self, this.catalogue) } : {}) },
      turn: room.turn ? structuredClone(room.turn) : null, log: structuredClone(room.log), pendingVote: room.pendingVote ? structuredClone(room.pendingVote) : null,
      ...(battle ? { gameMode: 'combat-preview', scenario: { ...room.scenario }, visualEvents:structuredClone(room.visualEvents || []), activeCardEvent:publicActiveCardEvent(room), pendingBattle: publicBattleDecision(room,self), result: room.result ? structuredClone(room.result) : null, ...(fieldWeather ? {fieldWeather} : {}), drawCount: room.drawPile?.length ?? 0, discardCount: room.discardPile?.length ?? 0 } : {}),
      lastActionAt: room.lastActionAt, expiresAt: room.lastActionAt + IDLE_MS, serverNow: this.now(), foundation: true,
    };
  }
  action(code, token, input) {
    const current = this.get(code, true);
    const currentPlayer = this.authenticate(current, token);
    const room = this.#applyAction(current, currentPlayer, input);
    return { view: this.project(room, room.players.find(player => player.id === currentPlayer.id)) };
  }

  #applyAction(current, currentPlayer, input) {
    if (!object(input) || typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.id) || !Number.isSafeInteger(input.revision) || input.revision < 0 || typeof input.type !== 'string') fail(400, 'INVALID_INPUT', 'Action needs an id, revision, and type.');
    const signature = JSON.stringify(Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b))));
    if (Object.hasOwn(currentPlayer.actions, input.id)) {
      if (currentPlayer.actions[input.id] !== signature) fail(409, 'ACTION_ID_REUSED', 'This action id was already used with different input.');
      currentPlayer.lastSeenAt = this.now();
      this.synchronizeTurn(current);
      this.#updateAiTask(current);
      return current;
    }
    if (current.status === 'closed') fail(410, 'ROOM_CLOSED', 'This room is closed.');
    // Seat claims are checked against current occupancy below, even if another seat just changed.
    const lateSeatClaim = input.type === 'chooseSeat' && input.revision < current.revision;
    // Other trainers' lobby actions do not invalidate this trainer's ready choice.
    const concurrentReady = input.type === 'ready' && current.status === 'lobby' &&
      input.revision < current.revision && input.revision >= (currentPlayer.readyRevision ?? 0);
    // Private setup actions can run concurrently until this player's own setup state changes.
    const privateSetupAction = (current.status === 'identity' && input.type === 'acknowledgeIdentity') ||
      (current.status === 'setup' && ['drawPokemon', 'selectPokemon'].includes(input.type));
    const concurrentSetup = privateSetupAction && input.revision < current.revision &&
      input.revision >= (currentPlayer.setupRevision ?? current.revision);
    if (current.revision !== input.revision && !lateSeatClaim && !concurrentReady && !concurrentSetup) fail(409, 'STALE_REVISION', 'Room changed. Refresh and try again.');
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
      case 'addAi': {
        check(['seatNumber']); owner(); status('lobby');
        const { seatNumber } = input;
        if (!validSeat(room, seatNumber)) fail(400, 'INVALID_SEAT', 'Choose a seat available in this match mode.');
        if (seated.some(entry => entry.seatNumber === seatNumber)) fail(409, 'SEAT_TAKEN', 'That seat is occupied.');
        if (room.players.length >= ROOM_CAPACITY) fail(409, 'ROOM_FULL', 'This development room is full.');
        const nickname = availableAiName(room.players);
        room.players.push({ id: randomUUID(), nickname, seatNumber, ai: true, aiDifficulty: 'normal', spectator: false,
          ready: true, lastSeenAt: 0, hand: [], candidates: [], active: null, reserve: null, setupComplete: false, actions: {} });
        log(room, `${nickname} 加入了牌桌。`, `${nickname} joined the table.`);
        break;
      }
      case 'setAiDifficulty': {
        check(['playerId', 'difficulty']); owner(); status('lobby');
        const ai = seated.find(entry => entry.id === input.playerId && entry.ai);
        if (!ai) fail(400, 'INVALID_SEAT', 'Choose an AI seat.');
        if (!aiDifficulties.includes(input.difficulty)) fail(400, 'INVALID_AI_DIFFICULTY', 'Choose Easy, Normal or Hard.');
        ai.aiDifficulty = input.difficulty;
        break;
      }
      case 'removeAi': {
        check(['playerId']); owner(); status('lobby');
        const ai = seated.find(entry => entry.id === input.playerId && entry.ai);
        if (!ai) fail(400, 'INVALID_SEAT', 'Choose an AI seat.');
        room.players = room.players.filter(entry => entry.id !== ai.id);
        log(room, `${ai.nickname} 离开了牌桌。`, `${ai.nickname} left the table.`);
        break;
      }
      case 'chooseSeat':
        check(['seatNumber']); seat(); status('lobby');
        if (!validSeat(room, input.seatNumber)) fail(400, 'INVALID_SEAT', 'Choose a seat available in this match mode.');
        if (seated.some(entry => entry.id !== player.id && entry.seatNumber === input.seatNumber)) fail(409, 'SEAT_TAKEN', 'That seat is occupied.');
        if (player.seatNumber !== input.seatNumber) {
          player.seatNumber = input.seatNumber;
          player.ready = false;
          player.readyRevision = room.revision + 1;
        }
        break;
      case 'ready':
        check(['ready']); seat(); status('lobby');
        if (typeof input.ready !== 'boolean') fail(400, 'INVALID_INPUT', 'Ready must be a boolean.');
        player.ready = input.ready;
        player.readyRevision = room.revision + 1;
        break;
      case 'settings': {
        check(['arena', 'turnSeconds', 'responseSeconds', 'deckProfile', 'autoDraw', 'autoJudgment', 'matchMode', 'teamAssignment', 'teamScenario', 'identityScenario', 'contentPack', 'weatherLab', 'gymGuard', 'rocketPartners', 'rocketInfiltration', 'trainerProfessions']); owner(); status('lobby');
        if (!['fire', 'water', 'grass', 'stadium', 'gym', 'floating'].includes(input.arena) || ![input.turnSeconds, input.responseSeconds].every(value => Number.isInteger(value) && (value === 0 || (value >= 5 && value <= 600)))) fail(400, 'INVALID_SETTINGS', 'Choose a supported arena and timers of 0 or 5–600 seconds.');
        if (input.deckProfile !== undefined && !(this.allowTestDecks ? isDeckProfile(input.deckProfile) : input.deckProfile === RETAIL_DECK)) fail(400, 'INVALID_SETTINGS', 'Choose a supported deck.');
        const contentPack = input.contentPack === undefined ? current.settings.contentPack ?? 'base' : input.contentPack;
        if (!contentPacks.includes(contentPack)) fail(400, 'INVALID_SETTINGS', 'Choose a supported content pack.');
        const weatherPack = hasPack(contentPack, HOENN_PACK);
        const weatherLab = input.weatherLab === undefined ? weatherPack && Boolean(current.settings.weatherLab) : input.weatherLab;
        if (typeof weatherLab !== 'boolean' || (weatherLab && !weatherPack))
          fail(400, 'INVALID_SETTINGS', 'The Weather Institute requires the Hoenn content pack.');
        const deckProfile = input.deckProfile ?? room.settings.deckProfile;
        const matchMode = input.matchMode === undefined ? current.settings.matchMode ?? 'identity' : input.matchMode;
        const teamAssignment = input.teamAssignment === undefined ? current.settings.teamAssignment ?? 'seat' : input.teamAssignment;
        if (!['identity', 'teams'].includes(matchMode) || !['seat', 'random'].includes(teamAssignment)) fail(400, 'INVALID_SETTINGS', 'Choose a supported match mode and team assignment.');
        const teamScenario = input.teamScenario === undefined
          ? (matchMode === 'teams' ? current.settings.teamScenario ?? 'standard' : 'standard') : input.teamScenario;
        if (!['standard', RADIO_TOWER, LAKE_RAGE, SILPH_CONTROL].includes(teamScenario) || (matchMode !== 'teams' && teamScenario !== 'standard'))
          fail(400, 'INVALID_SETTINGS', 'Choose a supported team scenario.');
        const identityScenario = input.identityScenario === undefined
          ? (matchMode === 'identity' ? current.settings.identityScenario ?? 'standard' : 'standard') : input.identityScenario;
        if (!['standard', VIRIDIAN_GYM].includes(identityScenario) || (matchMode !== 'identity' && identityScenario !== 'standard'))
          fail(400, 'INVALID_SETTINGS', 'Choose a supported identity scenario.');
        const viridian = identityScenario === VIRIDIAN_GYM;
        const gymGuard = input.gymGuard === undefined ? viridian && Boolean(current.settings.gymGuard) : input.gymGuard;
        if (typeof gymGuard !== 'boolean' || (gymGuard && !viridian))
          fail(400, 'INVALID_SETTINGS', 'Gym Guard requires the Viridian Gym identity scenario.');
        const rocketPartners = input.rocketPartners === undefined ? viridian && Boolean(current.settings.rocketPartners) : input.rocketPartners;
        if (typeof rocketPartners !== 'boolean' || (rocketPartners && !viridian))
          fail(400, 'INVALID_SETTINGS', 'Rocket Partners requires the Viridian Gym identity scenario.');
        const rocketInfiltration = input.rocketInfiltration === undefined
          ? viridian && Boolean(current.settings.rocketInfiltration) : input.rocketInfiltration;
        if (typeof rocketInfiltration !== 'boolean' || (rocketInfiltration && !viridian))
          fail(400, 'INVALID_SETTINGS', 'Rocket Infiltrator requires the Viridian Gym identity scenario.');
        const trainerProfessions = input.trainerProfessions ?? Boolean(current.settings.trainerProfessions);
        if (typeof trainerProfessions !== 'boolean' || input.trainerProfessions === null)
          fail(400, 'INVALID_SETTINGS', 'Trainer professions must be on or off.');
        if (seated.length > seatCapacity({ matchMode, identityScenario, teamScenario })) fail(409, 'TOO_MANY_TRAINERS', 'There are too many trainers for the selected mode.');
        room.settings = { arena: input.arena, turnSeconds: input.turnSeconds, responseSeconds: input.responseSeconds, ...(deckProfile ? { deckProfile } : {}) };
        if (contentPack !== 'base') room.settings.contentPack = contentPack;
        if (weatherLab) room.settings.weatherLab = true;
        if (viridian) room.settings.identityScenario = identityScenario;
        if (gymGuard) room.settings.gymGuard = true;
        if (rocketPartners) room.settings.rocketPartners = true;
        if (rocketInfiltration) room.settings.rocketInfiltration = true;
        if (trainerProfessions) room.settings.trainerProfessions = true;
        if (matchMode === 'teams') {
          Object.assign(room.settings, { matchMode, teamAssignment });
          if (teamScenario !== 'standard') room.settings.teamScenario = teamScenario;
        }
        // When returning to the smaller lobby, keep the relative seating order.
        if (seated.some(entry => !validSeat(room, entry.seatNumber))) {
          seated.toSorted((a, b) => a.seatNumber - b.seatNumber).forEach((entry, index) => {
            entry.seatNumber = index + 1;
            entry.ready = Boolean(entry.ai);
            entry.readyRevision = room.revision + 1;
          });
        }
        for (const key of ['autoDraw', 'autoJudgment']) {
          if (input[key] !== undefined && typeof input[key] !== 'boolean') fail(400, 'INVALID_SETTINGS', 'Automation settings must be on or off.');
          const value = input[key] ?? current.settings[key];
          if (value !== undefined) room.settings[key] = value;
        }
        break;
      }
      case 'startBattlePreview':
        check([]); owner(); status('lobby');
        this.battleCall(() => setupBattle(room, this.catalogue));
        for (const entry of seated) entry.setupRevision = room.revision + 1;
        break;
      case 'acknowledgeIdentity':
        check([]); seat(); status('identity');
        this.battleCall(() => acknowledgeBattleIdentity(room, player, this.catalogue));
        if (room.status === 'setup') {
          for (const entry of seated) entry.setupRevision = room.revision + 1;
        } else player.setupRevision = room.revision + 1;
        break;
      case 'drawPokemon':
        check([]); seat(); status('setup');
        if (player.setupComplete || !player.candidateDeal?.length) fail(409, 'POKEMON_DRAW_EXHAUSTED', 'All five Pokémon candidates have been drawn.');
        player.candidates.push(player.candidateDeal.shift());
        player.setupRevision = room.revision + 1;
        log(room, '一名训练家摸取了一张私密宝可梦候选。', 'A trainer drew one private Pokémon candidate.');
        break;
      case 'start':
        check([]); owner(); status('lobby');
        if (seated.some(entry => entry.ai)) fail(409, 'WRONG_MODE', 'AI players require the battle game.');
        if (seated.length < 2 || seated.length > 6 || seated.some(entry => !entry.ready)) fail(409, 'NOT_READY', 'Development setup requires 2–6 ready players.');
        if (this.catalogueIds.length < seated.length * 5) fail(503, 'CONTENT_UNAVAILABLE', 'The shared deck needs five unique Pokémon per player.');
        room.pokemonDeck = dealPokemon(seated, this.catalogueIds, { revealImmediately: true });
        room.status = 'setup';
        for (const entry of seated) entry.setupRevision = room.revision + 1;
        log(room, '每位训练家从共享洗匀牌库获得五个不重复候选，并选两只搭档。', 'Each trainer receives five distinct candidates from one shuffled shared deck and selects two partners.');
        break;
      case 'selectPokemon':
        check(['activeId', 'reserveId', 'profession']); seat(); status('setup');
        if (player.setupComplete) fail(409, 'ALREADY_SELECTED', 'Your setup selection is already locked.');
        if (input.activeId === input.reserveId || !player.candidates.includes(input.activeId) || !player.candidates.includes(input.reserveId)) fail(400, 'INVALID_SELECTION', 'Choose two distinct candidates from your private selection.');
        if (input.profession !== undefined &&
            (!isBattle(room) || !room.settings.trainerProfessions || !trainerProfessionIds.includes(input.profession)))
          fail(400, 'INVALID_PROFESSION', 'Choose an available trainer profession.');
        player.setupRevision = room.revision + 1;
        if (isBattle(room)) {
          if (input.profession) player.profession = input.profession;
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
        if (isBattle(room)) {
          if (room.drawPile.length + room.discardPile.length || !player.ai) this.battleCall(() => drawBattleCards(room, player,1,'draw-phase'));
          else {
            room.turn.drawStarted = true;
            room.turn.drawRemaining = 0;
            room.turn.phase = 'play';
            log(room, '牌库已空，进入出牌阶段。', 'The deck is empty. Play phase begins.');
            break;
          }
        } else player.hand.push(placeholder());
        room.turn.drawStarted=true;
        room.turn.drawRemaining--;
        if (room.turn.drawRemaining === 0) room.turn.phase = 'play';
        log(room, isBattle(room) ? '当前玩家摸取一张牌。' : '当前玩家抽取一张测试手牌。', isBattle(room) ? 'The current player drew one card.' : 'The current player drew one fixture card.');
        break;
      case 'attack':
        check(['cardId', 'cardIds', 'coordinationCardIds', 'targetIds', 'moveIndex', 'boostCardId','effectChoice']); ownTurn();
        if (!isBattle(room)) fail(409, 'WRONG_MODE', 'Attacks are available in the combat preview.');
        this.battleCall(() => playBattleMove(room, player, input, this.battleContext()));
        break;
      case 'tourAction':
        check(['action']); ownTurn();
        this.battleCall(() => useTourAction(room, player, input, this.battleContext())); break;
      case 'useEvent':
        check(['cardId','targetId','effect']);ownTurn();if(!isBattle(room))fail(409,'WRONG_MODE','Events require combat preview.');
        this.battleCall(()=>useBattleEvent(room,player,input,this.battleContext()));break;
      case 'useTool':
        check(['cardId','effect','targetId','slot']);ownTurn();if(!isBattle(room))fail(409,'WRONG_MODE','Tools require combat preview.');
        this.battleCall(()=>useBattleTool(room,player,input,this.battleContext()));break;
      case 'equipItem':
        check(['cardId','slot']);ownTurn();if(!isBattle(room))fail(409,'WRONG_MODE','Held items require combat preview.');
        this.battleCall(()=>equipBattleItem(room,player,input,this.battleContext()));break;
      case 'useLightBall':
        check(['targetId']);ownTurn();if(!isBattle(room))fail(409,'WRONG_MODE','Held items require combat preview.');
        this.battleCall(()=>useLightBall(room,player,input.targetId,this.battleContext()));break;
      case 'giveCards':
        check(['cardIds', 'recipientId', 'targetIds']); ownTurn();
        if (!isBattle(room)) fail(409, 'WRONG_MODE', 'Justified is available in the combat preview.');
        this.battleCall(() => giveBattleCards(room, player, input, this.battleContext()));
        break;
      case 'respondBattle':
        check(['decisionId', 'choice', 'cardId', 'cardIds', 'handIndex', 'handIndices', 'order', 'topOrder','bottomOrder', 'reinforcement', 'effect','allocations','targetId','targetIds','moveIndex','boostCardId','effectChoice']); seat(); status('playing');
        if (!isBattle(room)) fail(409, 'WRONG_MODE', 'There is no combat response.');
        this.battleCall(() => respondBattle(room, player, input, this.battleContext()));
        break;
      case 'revealRole':
        check([]); ownTurn();
        if (!isBattle(room) || room.turn.phase!=='play' || player.eliminated) fail(409, 'WRONG_PHASE', 'Reveal your identity during your play phase.');
        if (player.role==='infiltrator' && !player.identityPublic)
          fail(409, 'INFILTRATOR_AWAITS_PLEDGE', 'Wait for the public allegiance decision.');
        if (!player.role || player.role==='leader' || player.identityPublic) fail(409, 'IDENTITY_ALREADY_PUBLIC', 'Your identity is already public.');
        revealBattleIdentity(room,player);
        log(room, `${player.nickname}主动公开了身份。`, `${player.nickname} revealed their identity.`);
        break;
      case 'useTrait':
        check(['cardIds','hpLoss']); ownTurn();
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
        room.turn.phase = isBattle(room) && player.active?.catalogueId === 'magikarp' && player.active.level === 1 && battleTraitsEffective(room,player.active)
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
        const battle = isBattle(room);
        if (battle) room.discardPile.push(discarded);
        if (player.hand.length <= handLimit(room,player)){room.turn.phase = 'end';room.turn.discardComplete=true;}
        log(room, battle ? '当前玩家弃置一张手牌。' : '当前玩家弃置一张测试手牌。', battle ? 'The current player discarded one card.' : 'The current player discarded one fixture card.');
        break;
      }
      case 'endTurn': {
        check(['levelUp','evolution']); ownTurn();
        if(input.evolution!==undefined && (input.evolution!==SHEDINJA_ID || input.levelUp!==true || !isBattle(room)))
          fail(400,'INVALID_EVOLUTION','Choose an available evolution with a level-up.');
        if (input.levelUp !== undefined && typeof input.levelUp !== 'boolean') fail(400, 'INVALID_INPUT', 'Level up must be a boolean.');
        const skipsDiscard=isBattle(room)&&player.active?.catalogueId==='magikarp'&&player.active.level===1&&battleTraitsEffective(room,player.active);
        if (room.turn.phase !== 'end' || room.turn.drawRemaining !== 0 || (!room.turn.discardComplete&&!skipsDiscard&&player.hand.length > handLimit(room,player))) fail(409, 'TURN_INCOMPLETE', 'Finish play, complete both draws and discard down to four cards first.');
        if (input.levelUp === true) {
          if (player.raidBoss) fail(409,'LEVEL_CAP','Red Gyarados levels up only when it changes phase.');
          if (room.turn.tourLevelUsed) fail(409, 'LEVEL_CAP', 'The level-up opportunity was already used.');
          const levelTarget = room.turn.tourLevelTarget ? [player.active,player.reserve].find(pokemon=>pokemon?.instanceId===room.turn.tourLevelTarget&&!pokemon.defeated) : player.active;
          if (!levelTarget) fail(409,'LEVEL_CAP','The selected partner can no longer level up.');
          if (levelTarget.level >= 3) fail(409, 'LEVEL_CAP', 'The active Pokémon is already at level 3.');
          if(input.evolution===SHEDINJA_ID) {
            if(!canChooseShedinja(room,levelTarget)) fail(409,'INVALID_EVOLUTION','Only an uninjured Lv. 2 Ninjask can choose Shedinja.');
            levelTarget.catalogueId=SHEDINJA_ID;
            levelTarget.hpBonus=0;
            log(room,'选择了脱壳忍者进化分支。','Shedinja was chosen as the evolution branch.');
          }
          levelTarget.level++;
          if(isBattle(room))levelTarget.revealed = true;
          room.turn.tourLevelUsed = true;
          log(room, levelTarget===player.reserve?'当前玩家选择让备战宝可梦提升一个等级。':'当前玩家选择让出战宝可梦提升一个等级。', levelTarget===player.reserve?'The current trainer leveled up their reserve.':'The current player chose to raise their active Pokémon by one level.');
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
          room.pendingVote = { kind, requestedBy: player.id, approvedIds: [player.id], requiredIds: seated.filter(entry => !entry.ai && this.connected(entry)).map(entry => entry.id) };
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
    if (player.ai) {
      // Each AI task consumes one revision; old suggestions cannot replay it.
      player.actions = {};
      const description = publicAiActions[input.type];
      if (description && room.status === 'playing') {
        log(room, player.nickname + ' ' + description[0], player.nickname + description[1]);
      }
    }
    this.synchronizeTurn(room, { commit: false });
    room.revision++;
    room.lastActionAt = this.now();
    this.persist(room);
    this.rooms.set(room.code, room);
    if (room.players.some(player => player.ai)) {
      const delay = aiPresentationDelay(current, room, input);
      if (delay) this.#aiPresentationUntil.set(room.code, this.now() + Math.round(delay * this.aiPaceMs / 650));
    }
    this.#updateAiTask(room);
    return room;
  }

  #clearAiTask(code) {
    const task = this.#aiTasks.get(code);
    if (task?.timer != null) this.cancelAi(task.timer);
    this.#aiTasks.delete(code);
  }

  stopAi() {
    this.#aiStopped = true;
    this.#aiPresentationUntil.clear();
    for (const code of this.#aiTasks.keys()) this.#clearAiTask(code);
  }

  #updateAiTask(room) {
    if (this.#aiStopped) return;
    if (!room.players.some(player => player.ai)) {
      this.#clearAiTask(room.code);
      return;
    }
    const actor = aiActor(room);
    const existing = this.#aiTasks.get(room.code);
    if (actor && existing?.revision === room.revision && existing.actorId === actor.id &&
        existing.ownerId === room.ownerId && existing.decisionId === (room.pendingBattle?.id ?? null) &&
        existing.turnNumber === (room.turn?.number ?? null)) return;
    this.#clearAiTask(room.code);
    if (!actor) {
      if (room.status !== 'playing') this.#aiPresentationUntil.delete(room.code);
      return;
    }
    const startedAt = this.now();
    const readyAt = Math.max(startedAt + this.aiPaceMs, this.#aiPresentationUntil.get(room.code) ?? 0);
    const needsStrategy = needsAiStrategy(room);
    const task = {
      id: randomUUID(), ownerId: room.ownerId, actorId: actor.id, revision: room.revision,
      turnNumber: room.turn?.number ?? null, decisionId: room.pendingBattle?.id ?? null,
      decisionKind: room.pendingBattle?.kind ?? room.turn?.phase ?? room.status,
      readyAt, preferences: null, needsStrategy,
      ...(needsStrategy ? { difficulty: aiDifficulty(actor), players: publicAiTable(room, this.catalogue) } : {}),
    };
    this.#aiTasks.set(room.code, task);
    const owner = room.players.find(player => player.id === room.ownerId);
    const waitForSuggestion = needsStrategy && this.connected(owner) ? this.aiTimeoutMs : 0;
    this.#scheduleAiTask(room.code, task, Math.max(waitForSuggestion, task.readyAt - startedAt));
  }

  #scheduleAiTask(code, task, delay) {
    if (task.timer != null) this.cancelAi(task.timer);
    task.timer = this.scheduleAi(() => {
      if (this.#aiTasks.get(code) !== task) return;
      task.timer = null;
      try {
        const room = this.rooms.get(code);
        this.#updateAiTask(room);
        if (this.#aiTasks.get(code) !== task) return;
        const actor = aiActor(room);
        const choices = aiActions(room, actor, this.catalogue, task.preferences);
        for (const action of choices) {
          try {
            this.#applyAction(room, actor, { id: task.id, revision: task.revision, ...action });
            return;
          } catch (error) {
            if (!(error instanceof ApiError) || ![400, 409].includes(error.status)) throw error;
          }
        }
        task.failed = true;
        console.error('AI action unavailable:', task.decisionKind);
      } catch {
        task.failed = true;
        console.error('AI action could not be saved or completed:', task.decisionKind);
      }
    }, Math.max(0, delay));
    task.timer?.unref?.();
  }

  suggestAi(code, token, input) {
    fields(input, ['id', 'revision', 'turnNumber', 'decisionId', 'targetIds', 'focus']);
    const room = this.get(code);
    const owner = this.authenticate(room, token);
    if (owner.id !== room.ownerId || owner.ai || owner.spectator) fail(403, 'OWNER_ONLY', 'Only the room owner can suggest AI strategy.');
    const task = this.#aiTasks.get(room.code);
    if (!task?.needsStrategy || task.failed || room.status !== 'playing' || task.id !== input.id ||
        task.revision !== input.revision || task.turnNumber !== input.turnNumber || task.decisionId !== input.decisionId)
      fail(409, 'STALE_AI_TASK', 'The AI task changed.');
    const actor = aiActor(room);
    if (actor?.id !== task.actorId || task.ownerId !== owner.id || task.revision !== room.revision)
      fail(409, 'STALE_AI_TASK', 'The AI task changed.');
    const { targetIds, focus } = input;
    if (!Array.isArray(targetIds) || targetIds.length >= room.players.filter(player=>!player.spectator).length || new Set(targetIds).size !== targetIds.length ||
        targetIds.some(id => id === actor.id || !room.players.some(player => player.id === id && !player.spectator && !player.eliminated)) ||
        !['attack', 'recover'].includes(focus)) fail(400, 'INVALID_AI_STRATEGY', 'Submit public target preferences only.');
    if (task.preferences) return { accepted: true };
    task.preferences = { targetIds, focus };
    this.#scheduleAiTask(room.code, task, task.readyAt - this.now());
    return { accepted: true };
  }

  resolveVote(room, completedResult = false) {
    const vote = room.pendingVote;
    if (!vote.requiredIds.every(id => vote.approvedIds.includes(id))) return;
    room.pendingVote = null;
    delete room.fieldWeather; delete room.visualEvents; delete room.pokemonDeck; delete room.gameMode; delete room.pendingBattle; delete room.resolution; delete room.resolutionStack; delete room.judgment; delete room.statusEvent; delete room.protectionWindow;delete room.turnStart;delete room.switchEvent;delete room.entryEvent;delete room.drawChoice;delete room.initialBattleEntries; delete room.expansionTool; delete room.tourDexSurvey; delete room.tourAfterSwitches; delete room.tourDefiantNext; delete room.drawPile; delete room.discardPile; delete room.scenario; delete room.result;
    room.turn = null;
    room.status = vote.kind === 'endRoom' ? 'closed' : 'lobby';
    if (room.status === 'lobby' && !this.allowTestDecks) room.settings.deckProfile = RETAIL_DECK;
    room.players=room.players.filter(player=>!player.raidBoss);
    for (const player of room.players) {
      delete player.role; delete player.eliminated; delete player.identityAcknowledged; delete player.identityPublic; delete player.candidateDeal;
      delete player.exiledCards; delete player.delayedEvents; delete player.tourAllOutUsed; delete player.rocketAlias;
      delete player.profession; delete player.professionUsed; delete player.researcherJudged;
      player.ready = Boolean(player.ai); player.hand = []; player.candidates = []; player.active = null; player.reserve = null; player.setupComplete = false;
      player.readyRevision = room.revision + 1;
    }
    log(room, vote.kind === 'endRoom' ? '全员同意，房间已关闭。' : completedResult ? '房主已在结果后返回大厅，可准备下一局。' : '全员同意，游戏已结束并返回大厅。', vote.kind === 'endRoom' ? 'Unanimous vote closed the room.' : completedResult ? 'The host returned to the lobby after the result; ready for a rematch.' : 'Unanimous vote ended the game and returned to the lobby.');
  }
}
