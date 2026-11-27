// Supplied booklet pp.2–12 and reviewed-playcard-spec.md define these effects.
// This is an explicitly labelled development scenario, not a retail deck manifest.
import { TOUR_PACK, HOENN_PACK, hasPack, tourTools, hoennTools, tourItems, tourEvents, tourActionNames, showdownWeatherRank, hoennEvents, hoennDelayedEvents, hoennItems, fieldWeathers, labWeatherByPrint, futureSightEvent, airLockEvent, lightClay, powerHerb, emergencyRetreat, canCoordinateCommand, counterMoves, NINCADA_ID, SHEDINJA_ID, MIMIKYU_ID } from '../public/expansion-content.js';
import { trainerProfessions } from '../public/trainer-professions.js';
import { moveRecipe } from '../public/battlefield-effect-recipes.js';
import { pokemonTypes, sandstormAffects } from '../public/pokemon-types.js';
import { randomUUID, randomInt } from 'node:crypto';
import { dealPokemon, shufflePokemon } from './pokemon-deal.js';
import { BASIC_DECK, playtestDeckPlan, makePlaytestCards } from './playtest-deck.js';
import { partnerProfiles } from '../public/trainer-profiles.js';
import { isTeamRole, teamRoles, validTeamScenarioSize, matchTeamRoles, isLakeRaid, isSilphControl, RADIO_TOWER, RADIO_GOAL, VIRIDIAN_GYM, validViridianSize, viridianMinimum, VIRIDIAN_MAX, VIRIDIAN_REVEAL_ROUND, INFILTRATOR_ROUND, openingGymAce } from '../public/match-mode.js';
import { roleDeck, hasBattleHp, maxHp, currentHp, heal, applyDamage, beginCommand, blazeBonus, computeDamage, capReceivingDamage, reinforcementEffective, eligibleTargetIds, evaluateVictory, ordinarySwitch } from './battle-rules.js';

export class BattleError extends Error {
  constructor(code, message, status = 409) { super(message); this.code = code; this.status = status; }
}
const requireRule = (condition, code, message) => { if (!condition) throw new BattleError(code, message); };
export const isBattle = room => room.gameMode === 'combat-preview';
export const battleSelectionIds = (catalogue, contentPack) => catalogue.entries.filter(entry => entry.selectionEligible === true &&
  (!entry.expansionPack || hasPack(contentPack, entry.expansionPack)) && [1,2,3].every(level => entry.levels?.some(face =>
    face.level === level && hasBattleHp(entry, face)))).map(entry => entry.id);
const trainer = (room, id) => room.players.find(p => p.id === id);
const live = room => room.players.filter(p => !p.spectator && !p.eliminated);
const face = (pokemon, catalogue) => catalogue.entries.find(p => p.id === pokemon.catalogueId)?.levels.find(p => p.level === pokemon.level);
const creature = (room, id) => room.players.flatMap(p => [p.active, p.reserve]).find(p => p?.instanceId === id) ??
  [room.resolution,...(room.resolutionStack ?? [])].find(resolution=>resolution?.raidSpentPhase?.instanceId===id)?.raidSpentPhase;
// Suppression belongs to the trainer for the entire global turn, including reserves.
export const battleTraitsEffective=(room,pokemon)=>Boolean(pokemon&&!pokemon.defeated&&!room?.turn?.suppressedTraitPlayerIds?.some(id=>{const owner=trainer(room,id);return [owner?.active,owner?.reserve].some(partner=>partner?.instanceId===pokemon.instanceId);}));
// Named-event permission remains specific to the two printed Early Bird events.
export const battleEventTargetAllowed=(room,pokemon,eventNameZh)=>!(pokemon?.catalogueId==='kangaskhan'&&activeOwner(room,pokemon.instanceId)&&battleTraitsEffective(room,pokemon)&&['胖丁的表演','魔墙人偶的戏法'].includes(eventNameZh));
const reinforcementsSuppressed=(room,pokemon)=>Boolean(pokemon&&[room.resolution,...(room.resolutionStack||[])].some(resolution=>resolution?.suppressedReinforcementIds?.includes(pokemon.instanceId)));
export const battleReinforcementEffective=(room,pokemon,kind)=>!reinforcementsSuppressed(room,pokemon)&&reinforcementEffective(pokemon,kind);
const damageOptions=(room,source,target,options={})=>({...options,targetReinforcements:!reinforcementsSuppressed(room,target),sourceTraits:battleTraitsEffective(room,source),targetTraits:battleTraitsEffective(room,target)});
const damageImmune=(room,pokemon)=>battleTraitsEffective(room,pokemon)&&room.turn?.damageImmunityIds?.includes(pokemon.instanceId);
function note(room, zh, en, details = {}) {
  room.log.push({ id: randomUUID(), text: { zh, en }, ...details });
  room.log = room.log.slice(-80);
}
const currentCardEvent = room => room.resolution?.kind==='event' ? room.resolution :
  room.resolutionStack?.findLast(resolution=>resolution.kind==='event');
const cardEventId = event => event.visualId ?? event.card?.id;
export function publicActiveCardEvent(room) {
  const event = currentCardEvent(room);
  const eventId = event && cardEventId(event);
  if (!eventId) return null;
  return {kind:'event',eventId,effect:event.eventType,name:event.eventName,
    sourceId:event.actorPlayerId,targetIds:[...event.targetIds]};
}
function visualEvent(room, kind, details) {
  const event = currentCardEvent(room);
  const eventId = event && cardEventId(event);
  room.visualEvents = [...(room.visualEvents || []), {id:randomUUID(),kind,
    ...(eventId ? {eventId} : {}),...details}].slice(-32);
}
export function revealBattleIdentity(room, player) {
  player.identityPublic = true;
  visualEvent(room,'identity-reveal',{targetIds:[player.id]});
}
function revealViridianLeader(room) {
  const viridian = room.scenario?.viridian;
  if (!viridian || viridian.leaderRevealed) return;
  const leader = room.players.find(player => player.role === 'leader' && !player.spectator);
  viridian.leaderRevealed = true;
  revealBattleIdentity(room,leader);
  note(room,`${leader.nickname}公开身份，是真馆主。`,`${leader.nickname} is revealed as the true Gym Leader.`);
}
export function startViridianRound(room) {
  const viridian = room.scenario?.viridian;
  if (!viridian) return;
  viridian.round++;
  if (viridian.round===INFILTRATOR_ROUND && room.settings.rocketInfiltration) room.turn.rocketPledgePending = true;
  if (viridian.round===VIRIDIAN_REVEAL_ROUND) revealViridianLeader(room);
}
function moveVisual(room, targetId, telegraph = false) {
  const resolution = room.resolution;
  visualEvent(room,'attack',{
    sourceId:resolution.sourcePlayerId, targetIds:[targetId], family:resolution.sourceFamily,
    name:resolution.moveName, effect:resolution.effectKind, ...(resolution.weatherBallForm ? {weatherBallForm:resolution.weatherBallForm} : {}), ...(telegraph ? {telegraph:true} : {release:true}),
  });
}
function moveDodgeVisual(room, targetId) {
  moveVisual(room,targetId);
  visualEvent(room,'dodge',{sourceId:room.resolution.sourcePlayerId,targetIds:[targetId]});
}
export function publicPartnerTrainerAvatar(player) {
  return (Object.values(partnerProfiles).includes(player.trainerAvatar) ? player.trainerAvatar : undefined) ??
    partnerProfiles[player.active?.catalogueId] ??
    (player.reserve?.revealed ? partnerProfiles[player.reserve.catalogueId] : undefined);
}
function abilityVisual(room, player, catalogue, details = {}) {
  const name = player?.active && face(player.active,catalogue)?.traitName;
  if (name) visualEvent(room,'ability',{sourceId:player.id,name,...details});
}
function shuffled(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) { const j = randomInt(i + 1); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
export function setupBattle(room, catalogue) {
  const seats = room.players.filter(p => !p.spectator).toSorted((a,b)=>(a.seatNumber ?? 0)-(b.seatNumber ?? 0));
  const teams = room.settings.matchMode === 'teams';
  const viridian = !teams && room.settings.identityScenario === VIRIDIAN_GYM;
  const practiceDuel = !teams && !viridian && seats.length === 2 && seats.filter(player => player.ai).length === 1;
  const lake=isLakeRaid(room.settings), silph=isSilphControl(room.settings);
  if (teams) requireRule(validTeamScenarioSize(seats.length,room.settings), 'INVALID_TEAM_SIZE',
    lake ? 'Lake of Rage requires 2–6 challengers.' : silph ? 'Silph Co. requires 6 or 12 trainers.' :
      'Team battles require an even number of trainers.');
  if (viridian) requireRule(validViridianSize(seats.length,room.settings), 'INVALID_VIRIDIAN_SIZE',
    `Viridian Gym requires ${viridianMinimum(room.settings)}–${VIRIDIAN_MAX} trainers for the selected rules.`);
  requireRule((teams || viridian || practiceDuel || (seats.length >= 3 && seats.length <= 6)) && seats.every(p => p.ready),
    'NOT_READY', teams || viridian ? 'All trainers must be ready.' : 'Start with 3–6 ready trainers, or one human and one AI for a practice duel.');
  const pokemonPoolCount = battleSelectionIds(catalogue, room.settings.contentPack).length;
  requireRule(pokemonPoolCount >= (teams ? 5 : seats.length * 5), 'CONTENT_UNAVAILABLE', 'The Pokémon deck needs five unique groups per player.');
  const deck = playtestDeckPlan(room.settings.deckProfile ?? BASIC_DECK, seats.length, catalogue, room.settings.contentPack);
  requireRule(deck, 'CONTENT_UNAVAILABLE', 'The selected playtest deck requires all of its reviewed cards.');
  const publicRoles=matchTeamRoles(room.settings);
  const seatedTeams = teams ? seats.map((_, index) => lake ? 'team-a' : publicRoles[index % publicRoles.length]) : null;
  const roles = teams && room.settings.teamAssignment !== 'random' ? seatedTeams
    : shuffled(seatedTeams ?? (practiceDuel ? ['leader', 'rocket'] : roleDeck(seats.length,room.settings.identityScenario,room.settings)));
  seats.forEach((p, index) => { p.role = roles[index]; p.eliminated = false; p.candidates = []; p.candidateDeal = []; p.identityAcknowledged = false; p.setupComplete = false; p.active = null; p.reserve = null; p.hand = []; p.exiledCards=[]; delete p.emergencyRetreatDebt; delete p.trainerAvatar; });
  for (const player of seats) {
    if (teams) player.identityPublic = true;
    else delete player.identityPublic;
    delete player.rocketAlias;
    delete player.profession; delete player.professionUsed; delete player.researcherJudged;
  }
  if (viridian && room.settings.rocketPartners) {
    const aliases = shuffled(['jessie','james']);
    seats.filter(player=>player.role==='rocket').forEach((player,index)=>{ player.rocketAlias=aliases[index]; });
  }
  const gymSeats = viridian ? seats.filter(player=>player.role==='gym') : [];
  const proxy = viridian ? gymSeats[randomInt(gymSeats.length)] : null;
  if (proxy) proxy.identityPublic = true;
  room.trainerPoolSeed = randomInt(0x100000000);
  const first = teams ? randomInt(seats.length) : seats.findIndex(player=>proxy ? player.id===proxy.id : player.role==='leader');
  const boss=lake ? {
    id:randomUUID(),nickname:'Gyarados',seatNumber:7,raidBoss:true,ai:true,aiDifficulty:'normal',
    spectator:false,ready:true,eliminated:false,identityAcknowledged:true,identityPublic:true,
    role:'team-b',hand:[],candidates:[],candidateDeal:[],lastSeenAt:0,actions:{},
    active:lakeBossPokemon(1,seats.length),reserve:null,setupComplete:true,
  } : null;
  room.players = [...seats.slice(first), ...seats.slice(0, first), ...(boss?[boss]:[]), ...room.players.filter(p => p.spectator)];
  delete room.judgment;delete room.resolutionStack;delete room.statusEvent;delete room.protectionWindow;delete room.turnStart;delete room.switchEvent;delete room.entryEvent;delete room.drawChoice;delete room.initialBattleEntries;
  delete room.fieldWeather; delete room.visualEvents; delete room.expansionTool; delete room.tourAfterSwitches; delete room.tourDefiantNext;
  room.gameMode = 'combat-preview'; room.result = null; room.pendingBattle = null; room.resolution = null; room.status = 'identity';
  const deckCopies = teams ? Math.ceil(seats.length * 5 / deck.cards.length) : 1;
  room.scenario = { name: 'reviewed-roster', developmentFixture: true, candidateCount: 5, pokemonPoolCount, potionSupported: true,
    ...(practiceDuel ? { practiceDuel } : {}), ...deck.summary };
  if (proxy) {
    room.scenario.viridian = {proxyId:proxy.id,round:0,leaderRevealed:false,clues:{},investigatorIds:[]};
    if (room.settings.gymGuard) {
      const guard = gymSeats.find(player=>player.id!==proxy.id) ?? proxy;
      guard.identityPublic = true;
      room.scenario.viridian.guard = {playerId:guard.id,used:false};
      note(room,`${guard.nickname}担任公开的道馆护卫。`,`${guard.nickname} is the public Gym Guard.`);
    }
  }
  if (room.settings.weatherLab && hasPack(room.settings.contentPack,HOENN_PACK)) {
    room.scenario.weatherLab = {round:0,forecast:null};
  }
  if (teams && room.settings.teamScenario === RADIO_TOWER) {
    room.scenario.radio = { goal: RADIO_GOAL, scores: Object.fromEntries(teamRoles.map(role=>[role,0])) };
  }
  if (boss) room.scenario.lake={bossId:boss.id,challengers:seats.length,phase:1,transmitter:true};
  if (silph) room.scenario.silph={control:null};
  if (deckCopies > 1) Object.assign(room.scenario, { deckCopies, deckCardCount: deck.cards.length * deckCopies, extraCardCount: deck.summary.extraCardCount * deckCopies });
  if (lake) note(room,'挑战者协力迎战红色暴鲤龙。','The challengers face Red Gyarados together.');
  else if (teams) note(room, '队伍名单已公开；所有人确认后摸取宝可梦候选。', 'Teams are public. Confirm the lineup before drawing Pokémon candidates.');
  else if (proxy) note(room,`${proxy.nickname}是公开的代理馆主，将先行动。`,`${proxy.nickname} is the public Acting Gym Leader and will take the first turn.`);
  else note(room, '身份已分配；所有人查看身份后再摸取宝可梦候选。', 'Identities assigned; Pokémon candidates are dealt after everyone has viewed their identity.');
}
function lakeBossPokemon(phase, challengers) {
  return {instanceId:randomUUID(),catalogueId:'magikarp',level:phase+1,revealed:true,
    damage:0,status:null,reinforcements:[],hpBonus:challengers*2+(phase-1)*2,defeated:false,raidColor:'red'};
}
export function acknowledgeBattleIdentity(room, player, catalogue) {
  requireRule(!player.identityAcknowledged, 'IDENTITY_ALREADY_SEEN', 'Your identity is already acknowledged.');
  player.identityAcknowledged = true;
  const seats = room.players.filter(p => !p.spectator && !p.raidBoss);
  if (!seats.every(p => p.identityAcknowledged)) return;
  const ids = battleSelectionIds(catalogue, room.settings.contentPack);
  const refill = room.settings.matchMode === 'teams' && ids.length < seats.length * 5;
  room.pokemonDeck = dealPokemon(seats, ids, { refill });
  room.status = 'setup';
  if (refill) note(room, '每人有五个不同候选；大型对局的不同训练家可能拿到相同候选。', 'Each trainer gets five distinct candidates. Trainers in large matches may draw the same Pokémon.');
  else note(room, '从共享洗匀的宝可梦牌库为每位训练家预留五张，所有玩家之间不重复。', 'Five candidates per trainer reserved from one shuffled shared Pokémon deck, without repeats between trainers.');
}
export function selectBattlePartners(room, player, activeId, reserveId, catalogue) {
  requireRule(!player.setupComplete && activeId !== reserveId && player.candidates.includes(activeId) && player.candidates.includes(reserveId), 'INVALID_SELECTION', 'Choose two different candidates.');
  requireRule(player.candidates.length === 5 && !(player.candidateDeal?.length), 'CANDIDATE_DRAW_INCOMPLETE', 'Draw all five Pokémon before choosing two.');
  const count = room.players.filter(p => !p.spectator).length;
  const ace = openingGymAce(room,player);
  const make = (id, level, revealed) => ({ instanceId: randomUUID(), catalogueId: id, level, revealed, damage: 0, status: null, reinforcements: [], hpBonus: ace && count >= 5 ? 1 : 0, defeated: false });
  player.active = make(activeId, ace ? 2 : 1, true);
  player.reserve = make(reserveId, 1, false); player.setupComplete = true;
  room.pokemonDeck.push(...player.candidates.filter(id => id !== activeId && id !== reserveId));
  if (!room.players.filter(p => !p.spectator).every(p => p.setupComplete)) return false;
  const deck = playtestDeckPlan(room.scenario?.deckProfile ?? BASIC_DECK, count, catalogue, room.scenario?.contentPack);
  requireRule(deck, 'CONTENT_UNAVAILABLE', 'The selected playtest deck requires all of its reviewed cards.');
  const deckCopies = room.scenario?.deckCopies ?? 1;
  room.drawPile = shuffled(Array.from({ length: deckCopies }, () => makePlaytestCards(deck)).flat());
  room.discardPile = []; room.pokemonDeck = shufflePokemon(room.pokemonDeck); room.status = 'playing';
  for (const p of room.players.filter(p => !p.spectator)) { p.candidates = []; drawBattleCards(room, p, 4,'setup'); maxHp(p.active, catalogue); }
  room.initialBattleEntries=live(room).map(player=>player.id);
  return true;
}
function refillDrawPile(room, required) {
  if(room.drawPile.length>=required||!room.discardPile.length)return;
  const remaining=room.drawPile.length, recycled=room.discardPile.length;
  room.drawPile=[...shuffled(room.discardPile),...room.drawPile];
  room.discardPile=[];
  note(room,`牌堆剩${remaining}张，本次操作需要${required}张。已洗混${recycled}张弃牌并放到牌堆底。`,`The deck had ${remaining} card(s) and this action needed ${required}. Shuffled ${recycled} discard(s) under the deck.`);
}
function topCard(room) {
  refillDrawPile(room,1);
  requireRule(room.drawPile.length > 0, 'DECK_EMPTY', 'No card can currently be drawn.');
  return room.drawPile.pop();
}
function tryPickup(room,player,reason) {
  const pokemon=player.active;
  const ownDraw=room.turn?.playerId===player.id&&room.turn.phase==='draw'&&!room.turnStart;
  if(reason==='setup'||!room.turn||room.status!=='playing'||ownDraw||player.spectator||player.eliminated||!pokemon||pokemon.defeated||pokemon.catalogueId!=='meowth'||pokemon.level>=3||!battleTraitsEffective(room,pokemon))return;
  room.turn.pickupUsedIds??=[];
  if(room.turn.pickupUsedIds.includes(pokemon.instanceId))return;
  room.turn.pickupUsedIds.push(pokemon.instanceId);
  // Spend the mandatory trigger before its draw so it cannot trigger itself.
  // A finite empty deck gives no fictional card and does not undo the gain.
  if(!room.drawPile.length&&!room.discardPile.length) {
    note(room,'捡拾已触发，但当前没有可摸取的牌。','Pickup triggered, but no card is currently available to draw.');return;
  }
  visualEvent(room,'ability',{sourceId:player.id,name:{zh:'捡拾',en:'Pickup'}});
  drawBattleCards(room,player,1,'pickup');
  note(room,'捡拾在摸牌阶段外得到牌后摸一张牌。','Pickup drew one card after a gain outside this trainer’s draw phase.');
}
export function gainBattleCards(room,player,cards,{reason='effect'}={}) {
  if(!cards.length)return;
  player.hand.push(...cards);tryPickup(room,player,reason);
}
function gainBatches(room,batches,reason) {
  for(const {player,cards} of batches)player.hand.push(...cards);
  const receivers=new Set(batches.filter(batch=>batch.cards.length).map(batch=>batch.player.id));
  const start=Math.max(0,room.players.findIndex(player=>player.id===room.turn.playerId));
  for(const player of [...room.players.slice(start),...room.players.slice(0,start)])if(receivers.has(player.id))tryPickup(room,player,reason);
}
export function drawBattleCards(room, player, count = 1,reason='effect') {
  requireRule(Number.isSafeInteger(count)&&count>=0,'INVALID_DRAW','Choose a nonnegative draw count.');
  requireRule(room.drawPile.length+room.discardPile.length>=count,'DECK_EMPTY','No card can currently be drawn.');
  refillDrawPile(room,count);
  const cards=[];for(let i=0;i<count;i++)cards.push(topCard(room));gainBattleCards(room,player,cards,{reason});
}
function publicJudgmentFace({name,weather,kind,toolType,eventType,itemType}) {
  return {name,weather,kind,...(toolType?{toolType}:{}),...(eventType?{eventType}:{}),...(itemType?{itemType}:{})};
}
function startJudgment(room,ctx,continuation,judgeId) {
  requireRule(!room.judgment,'JUDGMENT_PENDING','Finish the current judgment first.');
  if (room.settings.autoJudgment === false && (room.drawPile.length || room.discardPile.length)) {
    const seats = live(room);
    const actor = seats.find(player => player.id === judgeId) ??
      seats.find(player => player.id === room.turn.playerId) ?? seats[0];
    if (actor) {
      room.judgment = { continuation, judgeId };
      decision(room, 'reveal-judgment', actor.id, actor.id, ctx);
      return;
    }
  }
  revealJudgment(room,ctx,continuation,judgeId);
}
function revealJudgment(room,ctx,continuation,judgeId) {
  delete room.judgment;
  if(!room.drawPile.length&&!room.discardPile.length) {
    room.pendingBattle=null;
    note(room,'当前没有可用的判定牌；没有判定结果，相关效果跳过。','No judgment card is available. There is no result, so the judgment effect is skipped.');
    return continueJudgment(room,ctx,continuation,null);
  }
  const judge=trainer(room,judgeId);
  if (judge?.profession==='researcher' && !judge.eliminated && !judge.researcherJudged) {
    judge.researcherJudged=true;
    if (judge.hand.length && room.drawPile.length+room.discardPile.length>=2) {
      refillDrawPile(room,1);
      const top=room.drawPile.at(-1);
      const [zh,en]=printedWeatherNames[top.weather];
      room.judgment={continuation,judgeId,forecastId:top.id};
      tourDecision(room,judge,trainerProfessions.researcher.action,judge.hand.map(tourCardOption),{kind:'researcher-forecast'},ctx,true);
      room.pendingBattle.privateDetail={
        zh:`顶牌天气为${zh}。选一张手牌弃置可将顶牌置底，也可放弃。`,
        en:`The top card is ${en}. Discard a hand card to put it on the bottom, or pass.`,
      };
      return;
    }
  }
  const card=topCard(room),seats=live(room),start=seats.findIndex(p=>p.id===room.turn.playerId);
  const ordered=[...seats.slice(start),...seats.slice(0,start)].filter(p=>p.active?.catalogueId==='vulpix'&&battleTraitsEffective(room,p.active));
  room.judgment={card,actorIds:ordered.map(p=>p.id),actorInstances:Object.fromEntries(ordered.map(p=>[p.id,p.active.instanceId])),index:0,continuation,judgeId};
  const names=printedWeatherNames[card.weather];
  note(room,`判定展示一张牌，天气为${names[0]}；判定结果等待生效。`,`A judgment revealed ${names[1]}; its result is pending.`,
    {judgment:publicJudgmentFace(card)});
  advanceJudgment(room,ctx);
}
function advanceJudgment(room,ctx) {
  const judgment=room.judgment;
  while(judgment.index<judgment.actorIds.length) {
    const actor=trainer(room,judgment.actorIds[judgment.index]);
    if(actor && !actor.eliminated && !actor.active.defeated && actor.active.catalogueId==='vulpix' && battleTraitsEffective(room,actor.active) && actor.active.instanceId===judgment.actorInstances[actor.id]) {
      decision(room,'judgment',actor.id,judgment.judgeId,ctx);
      const card=judgment.card;
      room.pendingBattle.judgmentCard=publicJudgmentFace(card);
      return;
    }
    judgment.index++;
  }
  if (offerFutureSight(room, ctx)) return;
  const {card,continuation}=judgment;
  const gained=continuation.kind==='icicle-spear' && ['rain','thunderstorm'].includes(card.weather);
  if(gained)gainBattleCards(room,trainer(room,continuation.ownerId),[card],{reason:'judgment'});else room.discardPile.push(card);
  delete room.judgment;room.pendingBattle=null;
  note(room,gained?'冰锥获得最终的雨天判定牌。':'最终判定牌进入弃牌堆。',gained?'Icicle Spear obtained the final rainy judgment card.':'The final judgment card entered the discard pile.');
  continueJudgment(room,ctx,continuation,card.weather);
}
const isFutureSight = card => card.kind === 'event' && card.eventType === 'hoenn-future-sight';
function offerFutureSight(room, ctx) {
  const judgment = room.judgment;
  if (judgment.futureSightUsed || !hasPack(room.settings.contentPack, HOENN_PACK) ||
      room.drawPile.length + room.discardPile.length === 0) return false;
  if (!judgment.futureSightOrder) {
    const seats = live(room);
    const start = Math.max(0, seats.findIndex(seat => seat.id === judgment.judgeId));
    judgment.futureSightOrder = [...seats.slice(start), ...seats.slice(0, start)].map(seat => seat.id);
    judgment.futureSightIndex = 0;
  }
  while (judgment.futureSightIndex < judgment.futureSightOrder.length) {
    const player = trainer(room, judgment.futureSightOrder[judgment.futureSightIndex++]);
    if (!player || player.eliminated) continue;
    const events = player.hand.filter(card => isFutureSight(card) &&
      player.hand.some(cost => cost.id !== card.id && cost.weather === judgment.card.weather));
    if (!events.length) continue;
    futureSightDecision(room, player, futureSightEvent.name, events, { kind:'future-sight-event' }, ctx);
    return true;
  }
  return false;
}
function futureSightDecision(room, player, title, cards, continuation, ctx) {
  tourDecision(room, player, title, cards.map(tourCardOption), continuation, ctx, true);
  room.pendingBattle.targetId = room.judgment.judgeId;
  room.pendingBattle.judgmentCard = publicJudgmentFace(room.judgment.card);
}
function continueJudgment(room,ctx,next,weather) {
  if (next.kind === 'weather-lab') {
    const research = room.scenario.weatherLab;
    const forecast = research.forecast = labWeatherByPrint[weather] ?? null;
    if (forecast) {
      const {name} = fieldWeathers[forecast];
      note(room,`天气研究所第 ${research.round} 轮预报为${name.zh}。`,
        `Weather Institute forecast for round ${research.round} is ${name.en}.`);
    } else {
      note(room,`天气研究所第 ${research.round} 轮维持常态。`,
        `Weather Institute forecast for round ${research.round} adds no field weather.`);
    }
    return continueBattleTurnStart(room,trainer(room,next.playerId),ctx);
  }
  if (next.kind === 'hoenn-delayed') {
    if (room.resolution.eventType === 'hoenn-raikou' && weather === 'thunderstorm') {
      return settleEventDamage(room, ctx, 1);
    }
    if (room.resolution.eventType === 'hoenn-roadblock' && weather && weather !== 'clear') {
      room.turn.hoennRoadblocked = true;
      note(room, '卡比兽堵住道路，本回合发起普通交替须额外弃一张手牌。', 'Snorlax blocks the road. An ordinary switch costs one extra hand card this turn.');
    }
    return finishResolution(room, ctx);
  }
  if(next.kind==='zapdos') {
    const resolution=room.resolution,owner=activeOwner(room,next.targetId);
    if(weather==='thunderstorm'&&resolution?.kind==='event'&&resolution.eventType==='zapdos-punishment'&&owner&&owner.active.instanceId===resolution.targetCreatureId&&currentHp(owner.active,ctx.catalogue)>0)return settleEventDamage(room,ctx,owner.active.level);
    return nextSettlement(room,ctx);
  }
  if(next.kind==='water-absorb') {
    const owner=activeOwner(room,next.pokemonId);
    if(owner&&battleTraitsEffective(room,owner.active)) {
      if(weather==='rain') {
        heal(owner.active,1,ctx.catalogue);
        abilityVisual(room,owner,ctx.catalogue,{effect:'water-absorb',action:'heal'});
      }
      if(weather==='thunderstorm'&&room.drawPile.length+room.discardPile.length) {
        drawBattleCards(room,owner,1,'water-absorb');
        abilityVisual(room,owner,ctx.catalogue,{effect:'water-absorb',action:'draw'});
      }
    }
    return continueReceiving(room,ctx);
  }
  if(next.kind==='tri-attack') {
    const status=weather==='intense-sun'?'burn':weather==='thunderstorm'?'paralysis':null;
    if(status)return applyStatus(room,ctx,creature(room,next.targetId),status,'afterDamage');
    return afterDamage(room,ctx);
  }
  // No real card means no result, including for "not this weather" clauses.
  if(weather===null) {
    if(next.kind==='status')return resumeStatusContinuation(room,ctx,next.next);
    if(['icicle-spear','shadow-ball','static','poison-point'].includes(next.kind))return afterDamage(room,ctx);
  }
  if(next.kind==='icicle-spear')return afterDamage(room,ctx);
  if(next.kind==='shadow-ball') {
    const owner=trainer(room,next.targetOwnerId),actor=trainer(room,next.sourcePlayerId);
    if(weather==='rain'&&owner?.hand.length&&actor&&!actor.eliminated) {
      room.resolution.handChoiceIds=shuffled(owner.hand.map(card=>card.id));
      decision(room,'hand',actor.id,owner.id,ctx);
      Object.assign(room.pendingBattle,{effect:'discard',choiceCount:owner.hand.length});return;
    }
    return afterDamage(room,ctx);
  }
  if(next.kind==='status') {
    const matches=next.weathers?next.weathers.includes(weather):next.comparison==='not'?weather!==next.weather:weather===next.weather;
    if(matches)return applyStatus(room,ctx,creature(room,next.targetId),next.status,next.next);
    return resumeStatusContinuation(room,ctx,next.next);
  }
  if(next.kind==='static') {
    if(weather!=='intense-sun') {
      const target=activeOwner(room,next.sourceId);
      abilityVisual(room,activeOwner(room,room.resolution.targetCreatureId),ctx.catalogue,{targetIds:target?[target.id]:[]});
      return applyStatus(room,ctx,creature(room,next.sourceId),'paralysis','afterDamage');
    }
    return afterDamage(room,ctx);
  }
  if(next.kind==='poison-point') {
    if(weather!=='intense-sun') {
      const target=activeOwner(room,next.sourceId);
      abilityVisual(room,activeOwner(room,room.resolution.targetCreatureId),ctx.catalogue,{targetIds:target?[target.id]:[]});
      return applyStatus(room,ctx,creature(room,next.sourceId),'poison','afterDamage');
    }
    return afterDamage(room,ctx);
  }
  if(next.kind==='sand-veil'||next.kind==='bright-powder'||next.kind==='tour-protect') {
    const name=next.kind==='sand-veil'?{zh:'沙隐',en:'Sand Veil'}:next.kind==='tour-protect'?{zh:'守住学习器',en:'Protect TM'}:{zh:'光粉',en:'Bright Powder'};
    if(['intense-sun','clear'].includes(weather)) {
      if(next.kind==='sand-veil')abilityVisual(room,trainer(room,next.defense.actorId),ctx.catalogue);
      moveDodgeVisual(room,next.defense.actorId);
      if(!next.defense.dodgeReducesDamage) {
        if(next.defense.dodgesRequired===2&&++next.defense.dodgesPlayed<2)note(room,`${name.zh}视为一次躲闪；仍需要另一次才能抵消本次结算。`,`${name.en} counted as one Dodge; another is needed to cancel this settlement.`);
        else {note(room,`${name.zh}视为使用一张快躲开！并抵消本次结算。`,`${name.en} counted as one Dodge! and canceled this settlement.`);return cancelMoveWithDodge(room,ctx);}
      }else {
        next.defense.damageReduction=reduceMoveDamage(room,room.resolution.targetCreatureId);
        note(room,`${name.zh}视为使用一张快躲开！，锐利目光将其改为此招式伤害减1。`,`${name.en} counted as one Dodge!; Keen Eye changed it to one damage reduction for this move.`);
      }
    }
    room.pendingBattle=next.defense;
    const clock=next.defense.clock;
    if(clock) {
      clock.pausedReason=!ctx.connected(trainer(room,next.defense.actorId))?'disconnected':clock.expired?'mandatory':null;
      clock.deadlineAt=clock.pausedReason?null:ctx.now()+clock.remainingMs;
    }
    return;
  }
  if(next.kind==='trait') {
    const pokemon=creature(room,next.sourceId);
    if(pokemon && !pokemon.defeated) {
      if(next.family==='bulbasaur' && ['intense-sun','clear'].includes(weather)){
        room.turn.rangeCreatureId=next.sourceId;room.turn.cardRangePlayerId=next.ownerId;
        abilityVisual(room,activeOwner(room,next.sourceId),ctx.catalogue);
      }
      if(next.family==='squirtle' && ['rain','thunderstorm'].includes(weather)){
        pokemon.status=null;heal(pokemon,1,ctx.catalogue);
        abilityVisual(room,activeOwner(room,next.sourceId),ctx.catalogue);
      }
      if(next.family==='psyduck' && ['rain','thunderstorm'].includes(weather)) {
        room.turn.cardRangePlayerId=next.ownerId;
        room.turn.swiftSwimCreatureIds??=[];
        if(!room.turn.swiftSwimCreatureIds.includes(next.sourceId))room.turn.swiftSwimCreatureIds.push(next.sourceId);
        abilityVisual(room,activeOwner(room,next.sourceId),ctx.catalogue);
        note(room,'悠游自如使本回合训练家使用牌及此宝可梦使用招式不受距离限制。','Swift Swim removes distance limits from this trainer’s cards and this Pokémon’s moves for this turn.');
      }
    }
  }
}

function takeCard(player, id, kind) {
  const index = player.hand.findIndex(c => c.id === id && c.kind === kind);
  requireRule(index >= 0, 'INVALID_CARD', 'Choose the required card from your own hand.');
  return player.hand.splice(index, 1)[0];
}
function decision(room, kind, actorId, targetId, ctx) {
  const seconds = room.settings.responseSeconds;
  const connected = ctx.connected(trainer(room, actorId));
  room.pendingBattle = { id: randomUUID(), kind, actorId, targetId, clock: seconds > 0 ? { remainingMs: seconds * 1000, deadlineAt: connected ? ctx.now() + seconds * 1000 : null, pausedReason: connected ? null : 'disconnected', expired: false } : null };
}
export const handLimit=(room,player)=>room.turn?.noHandLimitIds?.includes(player.id)?Infinity:4;
const heldItemDescriptions={
  ...Object.fromEntries([...tourItems, ...hoennItems].map(item => [item.itemType, item.description])),
  'rocky-helmet':{zh:'出场宝可梦受到伤害后，对伤害来源造成1点伤害。',en:'After the active holder receives damage, it deals 1 damage to the source.'},
  leftovers:{zh:'你的回合结束时，出场宝可梦回复1点体力。',en:'At the end of your turn, the active holder recovers 1 HP.'},
  'poison-barb':{zh:'出场宝可梦受到伤害后，令伤害来源陷入中毒。',en:'After the active holder receives damage, the Pokémon that dealt it becomes Poisoned.'},
  'bright-powder':{zh:'需要使用快躲开！时，可以判定。晴天视为使用一张快躲开！',en:'When asked to use Dodge!, you may judge. Intense sun or clear counts as one Dodge.'},
  'kings-rock':{zh:'携带者的招式造成伤害后，令目标陷入畏缩。',en:'After the holder damages a target with a move, the target Flinches.'},
  'flame-orb':{zh:'携带者造成伤害后，进行判定。烈日或晴朗使目标陷入灼伤。',en:'After the holder deals damage, judge. Intense sun or clear Burns the target.'},
  'life-orb':{zh:'携带者造成伤害时，可以令伤害加1。该次伤害结算结束后，携带者失去1点体力。',en:'When the holder deals damage, you may add 1 damage. After that settlement, the holder loses 1 HP.'},
  'blunder-policy':{zh:'携带者的招式被躲闪抵消时，可以弃置两张手牌，使本次结算继续生效。',en:'When a Dodge cancels the holder’s move, you may discard two hand cards to resolve that settlement anyway.'},
  'muscle-band':{zh:'可以将两张手牌当一张接招吧！使用。',en:'You may use two hand cards as one Take this! command.'},
  'light-ball':{zh:'出牌阶段可以弃置此持有物，令一只宝可梦陷入麻痹。',en:'During Play, discard this item to Paralyze one Pokémon.'},
  'quick-claw':{zh:'使用牌及招式无距离限制。其他训练家的回合开始时，可以对其出战宝可梦使用一张晴天接招吧！',en:'Your cards and the holder’s moves ignore distance. At another trainer’s turn start, you may use a sunny command against their active Pokémon.'},
};
const reviewedItem=card=>card?.kind==='held-item'&&Object.hasOwn(heldItemDescriptions,card.itemType);
const equipItems=player=>[...new Set(player.hand.filter(reviewedItem).map(card=>card.itemType))]
  .map(itemType=>({itemType,description:heldItemDescriptions[itemType]}));
const publicItem=card=>card?{itemType:card.itemType,name:card.name,weather:card.weather}:null;
function joyItemSlots(room,player,targetId) {
  if (player.profession!=='joy' || player.professionUsed || (rescueOwnerOnly(room) && targetId!==player.id)) return [];
  return ['active','reserve'].filter(slot=>{
    const pokemon=player[slot];
    return pokemon && !pokemon.defeated && (slot==='active'||pokemon.revealed) && reviewedItem(pokemon.item);
  });
}
function itemEffective(room,pokemon) {
  return pokemon?.item?.kind==='held-item'&&![room.resolution,...(room.resolutionStack||[])].some(resolution=>resolution?.suppressedItemIds?.includes(pokemon.instanceId));
}
const gluttonyReplacesItem=(room,pokemon)=>Boolean(room&&pokemon?.catalogueId==='snorlax'&&activeOwner(room,pokemon.instanceId)&&battleTraitsEffective(room,pokemon)&&itemEffective(room,pokemon));
const activeItemIs=(room,pokemon,itemType)=>pokemon?.item?.itemType===itemType&&itemEffective(room,pokemon)&&!gluttonyReplacesItem(room,pokemon);
export function endBattleTurn(room,player,ctx) {
  if(!isBattle(room)||room.status!=='playing'||room.turn?.playerId!==player?.id||room.turn.endEffectsDone)return;
  room.turn.endEffectsDone=true;
  const pokemon=player.active;
  if(player.eliminated||!pokemon||pokemon.defeated||currentHp(pokemon,ctx.catalogue)<=0)return;
  if(pokemon.catalogueId==='magikarp'&&pokemon.level===1&&battleTraitsEffective(room,pokemon)) abilityVisual(room,player,ctx.catalogue);
  const gluttony=gluttonyReplacesItem(room,pokemon);
  if ((gluttony||activeItemIs(room,pokemon,'leftovers')) && heal(pokemon,1,ctx.catalogue).healed) {
    if (gluttony) {
      abilityVisual(room,player,ctx.catalogue);
      note(room,'贪吃鬼将持有物效果改为回合结束时回复1点体力。','Gluttony replaced the held-item effect and healed 1 HP at this trainer’s turn end.');
    } else note(room,'吃剩的东西使携带者回复1点体力。','Leftovers restored 1 HP to the holder.');
  }
  if (room.turn.tourNightObservation && room.drawPile.length + room.discardPile.length > 0) {
    drawBattleCards(room,player,1,'night-observation');
    note(room,'夜间观察使本回合的训练家摸了一张牌。','Night Observation let the current trainer draw one card.');
  }
  if (activeFieldWeather(room)?.kind === 'sand' && sandstormAffects(pokemon) && !damageImmune(room,pokemon)) {
    room.resolution = { kind:'turn-end', environment:'sand', targetCreatureId:pokemon.instanceId,
      sourceId:null, sourcePlayerId:null, damagedIds:[], defenseIds:[], actualDamage:0 };
    return settleDealtDamage(room,ctx,1);
  }
}
export function equipBattleItem(room,player,input,ctx) {
  requireRule(previewActions(room,player,ctx.catalogue)?.canEquip,'ITEM_UNAVAILABLE','A reviewed held item cannot be equipped now.');
  requireRule(['active','reserve'].includes(input.slot),'INVALID_TARGET','Choose your active or reserve Pokémon.');
  const pokemon=player[input.slot];
  requireRule(pokemon&&!pokemon.defeated,'INVALID_TARGET','Choose an undefeated partner.');
  const index=player.hand.findIndex(card=>card.id===input.cardId&&reviewedItem(card));
  requireRule(index>=0,'INVALID_CARD','Choose a reviewed held item from your own hand.');
  const [card]=player.hand.splice(index,1),old=pokemon.item;pokemon.item=card;
  if(old)room.discardPile.push(old);
  note(room,old?'使用持有物并弃置原来的持有物。':'宝可梦携带了一件持有物。',old?'The held item was equipped and the old item discarded.':'The Pokémon equipped a held item.');
  if(old && input.slot==='active' && pokemon.catalogueId==='mankey' && battleTraitsEffective(room,pokemon)) {
    decision(room,'defiant',player.id,player.id,ctx);
    room.pendingBattle.trait='defiant';room.pendingBattle.canTrait=true;
  }
}
function lightBallTargets(room,catalogue) {
  return live(room).filter(seat=>seat.active&&!seat.active.defeated&&currentHp(seat.active,catalogue)>0).map(seat=>seat.id);
}
export function useLightBall(room,player,targetId,ctx) {
  requireRule(previewActions(room,player,ctx.catalogue)?.lightBallTargets.includes(targetId),'ITEM_UNAVAILABLE','Choose a legal active Pokémon during Play with Light Ball equipped.');
  const source=player.active,target=trainer(room,targetId).active;
  room.discardPile.push(source.item);
  delete source.item;
  room.resolution={kind:'light-ball',sourceId:source.instanceId,sourcePlayerId:player.id,targetCreatureId:target.instanceId};
  note(room,'弃置电气球，结算其麻痹效果。','Light Ball was discarded to apply Paralysis.');
  if(source.catalogueId==='mankey'&&battleTraitsEffective(room,source)) {
    decision(room,'defiant',player.id,player.id,ctx);
    Object.assign(room.pendingBattle,{trait:'defiant',canTrait:true});
    return;
  }
  return applyStatus(room,ctx,target,'paralysis','light-ball');
}
function continueReceiving(room,ctx) {
  const resolution=room.resolution,target=creature(room,resolution.targetCreatureId);
  const owner=room.players.find(p=>p.active?.instanceId===target?.instanceId&&!p.eliminated);
  if(!owner||target.defeated)return nextSettlement(room,ctx);
  const effects=resolution.receivingEffects||[];
  if(effects.length>1) {
    decision(room,'effects',owner.id,owner.id,ctx);room.pendingBattle.effects=[...effects];return;
  }
  if(effects.length)return runReceivingEffect(room,effects.shift(),ctx);
  nextSettlement(room,ctx);
}
function runReceivingEffect(room,effect,ctx) {
  const resolution=room.resolution,target=creature(room,resolution.targetCreatureId),source=creature(room,resolution.sourceId);
  const owner=room.players.find(p=>p.active?.instanceId===target?.instanceId&&!p.eliminated),sourceOwner=source?activeOwner(room,source.instanceId):null;
  if(!owner||target.defeated)return continueReceiving(room,ctx);
  if(!['rocky-helmet','poison-barb'].includes(effect)&&!battleTraitsEffective(room,target))return continueReceiving(room,ctx);
  if (effect==='wobbuffet-counter') {
    const response = wobbuffetResponse(room,owner,ctx.catalogue);
    if (response) {
      return tourDecision(room,owner,response.move.name,response.cards.map(tourCardOption),
        {kind:'wobbuffet-counter',sourceId:response.source.active.instanceId},ctx,true);
    }
    return continueReceiving(room,ctx);
  }
  if(effect==='water-absorb')return startJudgment(room,ctx,{kind:'water-absorb',pokemonId:target.instanceId},owner.id);
  if(effect==='battle-armor'&&owner.hand.length) {
    decision(room,'battle-armor',owner.id,owner.id,ctx);return;
  }
  if(effect==='static' && sourceOwner && !source.defeated) {
    decision(room,'static',owner.id,sourceOwner.id,ctx);Object.assign(room.pendingBattle,{trait:'static',canTrait:true});return;
  }
  if(effect==='poison-point'&&sourceOwner&&!source.defeated&&room.drawPile.length+room.discardPile.length>0) {
    decision(room,'poison-point',owner.id,sourceOwner.id,ctx);Object.assign(room.pendingBattle,{trait:'poison-point',canTrait:true});return;
  }
  if(effect==='synchronize' && resolution.card&&!resolution.cardClaimedBy) {
    decision(room,'synchronize',owner.id,owner.id,ctx);Object.assign(room.pendingBattle,{trait:'synchronize',canTrait:true,card:{name:resolution.card.name,weather:resolution.card.weather,kind:resolution.card.kind}});return;
  }
  if(effect==='cursed-body') {
    const sourceTrainer=trainer(room,resolution.sourcePlayerId);
    if(sourceTrainer?.hand.length && sourceTrainer.id!==owner.id) {
      resolution.handChoiceIds=shuffled(sourceTrainer.hand.map(card=>card.id));
      decision(room,'cursed-body',owner.id,sourceTrainer.id,ctx);
      Object.assign(room.pendingBattle,{choiceCount:sourceTrainer.hand.length,trait:'cursed-body',canTrait:true});return;
    }
  }
  if(effect==='oblivious') {
    room.turn.damageImmunityIds??=[];
    if(!room.turn.damageImmunityIds.includes(target.instanceId)) {
      room.turn.damageImmunityIds.push(target.instanceId);
      abilityVisual(room,owner,ctx.catalogue);
    }
    note(room,'迟钝使此宝可梦在当前训练家回合结束前不再受到伤害。','Oblivious prevents further damage to this Pokémon until the current trainer turn ends.');
  }
  if(effect==='poison-barb'&&sourceOwner&&activeItemIs(room,target,'poison-barb')&&target.item.id===resolution.poisonBarbCardId) {
    return applyStatus(room,ctx,source,'poison','afterDamage');
  }
  if(effect==='rocky-helmet' && sourceOwner && !source.defeated && activeItemIs(room,target,'rocky-helmet') && target.item.id===resolution.helmetCardId) {
    room.resolutionStack??=[];room.resolutionStack.push(resolution);
    room.resolution={kind:'item',card:null,channelCard:target.item,sourceId:target.instanceId,sourcePlayerId:owner.id,targetCreatureId:source.instanceId,targetIds:[sourceOwner.id],index:0,damagedIds:[],defenseIds:[],actualDamage:0};
    const amount=damageImmune(room,source)?0:computeDamage(target,source,1,ctx.catalogue,damageOptions(room,target,source,{command:false,channel:'item',receiving:false}));
    settleDealtDamage(room,ctx,amount);
    return;
  }
  continueReceiving(room,ctx);
}
function cleanResolution(room,resolution) {
  if(resolution.cleaned)return;
  resolution.cleaned=true;
  if(resolution.card&&!resolution.cardClaimedBy)room.discardPile.push(resolution.card);
  if(resolution.berryCards?.length)room.discardPile.push(...resolution.berryCards);
  if(resolution.revealedCards?.length){room.discardPile.push(...resolution.revealedCards);delete resolution.revealedCards;}
  if(resolution.distributionCards?.length){room.drawPile.push(...[...resolution.distributionCards].reverse());delete resolution.distributionCards;}
  for(const id of new Set(resolution.defenseIds||[])) {
    const pokemon=creature(room,id);
    if (pokemon && !resolution.retainedDefenseIds?.includes(id)) clearDefense(pokemon);
  }
}
function clearDefense(pokemon) {
  pokemon.reinforcements = (pokemon.reinforcements || []).filter(kind => kind !== 'defense');
  delete pokemon.hoennClayDefense;
}

function canSandVeil(room,player) {
  return Boolean(player?.active && !player.active.defeated && player.active.catalogueId==='sandshrew' && !player.active.item && battleTraitsEffective(room,player.active));
}
const hasShedSkin=(room,pokemon)=>['caterpie','weedle'].includes(pokemon?.catalogueId)&&pokemon.level===2&&battleTraitsEffective(room,pokemon);
function activeOwner(room,instanceId) {
  if(!instanceId)return undefined;
  return live(room).find(player=>player.active?.instanceId===instanceId&&!player.active.defeated);
}
function switchStillValid(room,event,ctx) {
  const player=trainer(room,event.playerId);
  return player&&!player.eliminated&&player.active?.instanceId===event.activeId&&player.reserve?.instanceId===event.reserveId&&!player.active.defeated&&!player.reserve.defeated&&currentHp(player.active,ctx.catalogue)>0&&currentHp(player.reserve,ctx.catalogue)>0;
}
function resumeBattleEntry(room,ctx,next) {
  if(next.kind==='turn')return beginBattleTurn(room,trainer(room,next.playerId),ctx);
  if(next.kind==='damage')return afterDamage(room,ctx);
  if(['tour-post','emergency-retreat'].includes(next.switchKind))return advanceTourSwitches(room,ctx);
  if(next.switchKind==='ordinary')finishTourTool(room);
  if(next.switchKind==='u-turn')return finishResolution(room,ctx);
  if(next.switchKind!=='ordinary')return nextSettlement(room,ctx);
}
function beginIllusion(room,player,catalogue) {
  const {active,reserve}=player;
  if (active.catalogueId!=='hoenn-zorua' || !hasPack(room.settings.contentPack,HOENN_PACK) ||
      !battleTraitsEffective(room,active) || !reserve || reserve.defeated || currentHp(reserve,catalogue)<=0) return;
  active.hoennIllusion={catalogueId:reserve.catalogueId,level:reserve.level,
    ...(reserve.catalogueId===MIMIKYU_ID && reserve.disguiseSpent ? {disguiseSpent:true} : {})};
}
function revealIllusion(room,player,ctx,showCue=true) {
  if (!player?.active?.hoennIllusion) return;
  delete player.active.hoennIllusion;
  if(showCue)abilityVisual(room,player,ctx.catalogue,{effect:'illusion'});
  note(room,'幻觉解除，出战搭档现出真身。','Illusion ended and revealed the active Pokémon.');
}
function beginBattleEntries(room,players,ctx,next) {
  requireRule(!room.entryEvent,'ENTRY_PENDING','Finish the current entry effect first.');
  for (const player of players) {
    beginIllusion(room,player,ctx.catalogue);
    player.trainerAvatar = publicPartnerTrainerAvatar(player);
  }
  room.entryEvent={actorIds:players.map(player=>player.id),actorInstances:Object.fromEntries(players.map(player=>[player.id,player.active.instanceId])),index:0,next};
  return advanceBattleEntries(room,ctx);
}
function bugPrizeCards(room, player, catalogue) {
  if (player.profession!=='bugcatcher' || player.professionUsed ||
      !pokemonTypes(player.active.catalogueId,player.active.level).includes('bug')) return [];
  const moves=face(player.active,catalogue)?.moves ?? [];
  const commandOnly=moves.length>0 && moves.every(move=>move.condition?.kind==='command');
  const eligible=commandOnly ? player.hand.filter(card=>card.kind==='command').map(card=>card.weather) :
    moves.flatMap(move=>move.condition?.weatherIconsInCondition ?? []);
  return room.discardPile.filter(card=>card.kind==='tool' && eligible.includes(card.weather));
}
function advanceBattleEntries(room,ctx) {
  const event=room.entryEvent;
  while(event.index<event.actorIds.length) {
    const actor=trainer(room,event.actorIds[event.index]);
    const targets=live(room).filter(player=>player.hand.length).map(player=>player.id);
    if(actor&&!actor.eliminated&&actor.active?.instanceId===event.actorInstances[actor.id]&&actor.active.catalogueId==='tauros'&&battleTraitsEffective(room,actor.active)&&currentHp(actor.active,ctx.catalogue)>0&&targets.length) {
      decision(room,'intimidate',actor.id,actor.id,ctx);room.pendingBattle.legalTargetIds=targets;return;
    }
    const prizes=actor && !actor.eliminated && actor.active?.instanceId===event.actorInstances[actor.id] &&
      !actor.active.defeated && currentHp(actor.active,ctx.catalogue)>0 ? bugPrizeCards(room,actor,ctx.catalogue) : [];
    if (prizes.length) {
      return tourDecision(room,actor,trainerProfessions.bugcatcher.action,prizes.map(tourCardOption),
        {kind:'bug-prize',activeId:actor.active.instanceId},ctx,true);
    }
    event.index++;
  }
  const next=event.next;delete room.entryEvent;room.pendingBattle=null;
  return resumeBattleEntry(room,ctx,next);
}
function finishBattleSwitch(room,ctx,success) {
  const event=room.switchEvent,player=trainer(room,event.playerId);
  const valid=switchStillValid(room,event,ctx);
  delete room.switchEvent;room.pendingBattle=null;
  if(success&&valid) {
    const outgoing = player.active;
    revealIllusion(room,player,ctx,false);
    delete outgoing.illusionDecoyId;
    const relay = event.kind==='ordinary' && outgoing.catalogueId==='tour-eevee' && battleTraitsEffective(room,outgoing) && outgoing.reinforcements.includes('speed');
    ordinarySwitch(player,ctx.catalogue);player.reserve.revealed=true;
    delete outgoing.hoennClayDefense;
    if(relay && !player.active.reinforcements.includes('speed')) player.active.reinforcements.push('speed');
    if(event.kind==='ordinary' && tourEnabled(room)) {
      room.turn.tourHandoff={activeId:player.active.instanceId,reserveId:player.reserve.instanceId};
      if(room.expansionTool?.effect==='tour-switch') heal(player.reserve,1,ctx.catalogue);
      if(player.active.catalogueId==='tour-togepi'&&battleTraitsEffective(room,player.active)&&!room.turn.tourWelcome){heal(player.reserve,1,ctx.catalogue);room.turn.tourWelcome=true;}
    }
    if(event.kind==='ordinary') {
      room.turn.switchUsed=true;
      if(player.profession==='brock') room.turn.brockOrdinarySwitch=true;
      if(player.profession==='birdkeeper') room.turn.birdOrdinaryEntry=player.active.instanceId;
    }
    if(event.kind==='emergency-retreat') {
      player.emergencyRetreatDebt = true;
      note(room,'紧急撤退成功，占用该训练家下回合的普通交替。','Emergency Retreat used this trainer’s ordinary switch for their next turn.');
    }
    note(room,'出战与备战宝可梦已交替。','The active and reserve Pokémon switched.');
    return beginBattleEntries(room,[player],ctx,{kind:'switch',switchKind:event.kind});
  }else note(room,'本次交替未完成，已经支付的费用不退还。','The switch did not complete; any cards already paid remain discarded.');
  if(['tour-post','emergency-retreat'].includes(event.kind))return advanceTourSwitches(room,ctx);
  if(event.kind==='ordinary')finishTourTool(room);
  if(event.kind==='u-turn')return finishResolution(room,ctx);
  if(event.kind!=='ordinary')return nextSettlement(room,ctx);
}
function advanceBattleSwitch(room,ctx) {
  const event=room.switchEvent;
  if(!switchStillValid(room,event,ctx))return finishBattleSwitch(room,ctx,false);
  while(event.index<event.actorIds.length) {
    const actor=trainer(room,event.actorIds[event.index]);
    if(actor&&!actor.eliminated&&actor.active?.instanceId===event.actorInstances[actor.id]&&actor.active.catalogueId==='diglett'&&battleTraitsEffective(room,actor.active)&&currentHp(actor.active,ctx.catalogue)>0) {
      decision(room,'arena-trap',actor.id,event.playerId,ctx);Object.assign(room.pendingBattle,{trait:'arena-trap',canTrait:true,switchKind:event.kind});return;
    }
    event.index++;
  }
  finishBattleSwitch(room,ctx,true);
}
export function requestBattleSwitch(room,player,kind,ctx) {
  if (kind === 'ordinary' && room.turn.hoennRoadblocked) {
    requireRule(player.hand.length > 0, 'SWITCH_UNAVAILABLE', 'Snorlax Roadblock requires a hand card.');
    return tourDecision(room, player,
      { zh: '卡比兽堵路 · 弃一张手牌再交替', en: 'Snorlax Roadblock · discard one card to switch' },
      player.hand.map(tourCardOption), { kind:'roadblock-switch' }, ctx, true);
  }
  return beginBattleSwitch(room, player, kind, ctx);
}
function beginBattleSwitch(room,player,kind,ctx) {
  requireRule(!room.switchEvent,'SWITCH_PENDING','Finish the current switch first.');
  const start=Math.max(0,room.players.findIndex(p=>p.id===room.turn.playerId));
  // Speed removes card/move distance only; Arena Trap uses passive base adjacency.
  const actors=[...room.players.slice(start),...room.players.slice(0,start)].filter(actor=>!actor.spectator&&!actor.eliminated&&actor.active?.catalogueId==='diglett'&&battleTraitsEffective(room,actor.active)&&currentHp(actor.active,ctx.catalogue)>0&&eligibleTargetIds(room.players,actor.id).includes(player.id));
  room.switchEvent={kind,playerId:player.id,activeId:player.active?.instanceId??null,reserveId:player.reserve?.instanceId??null,actorIds:actors.map(actor=>actor.id),actorInstances:Object.fromEntries(actors.map(actor=>[actor.id,actor.active.instanceId])),index:0};
  advanceBattleSwitch(room,ctx);
}
const isArticunoCard=card=>card?.kind==='event'&&card.eventType==='articuno-protection';
function protectionActorIds(room, excludedId) {
  const seats=live(room);
  const start=Math.max(0,seats.findIndex(player=>player.id===room.turn.playerId));
  return [...seats.slice(start),...seats.slice(0,start)]
    .filter(player=>player.id!==excludedId&&player.hand.some(isArticunoCard)).map(player=>player.id);
}
function startProtectionWindow(room,ctx,window) {
  if(room.scenario?.articunoReactions!==true)return false;
  const actorIds=protectionActorIds(room);
  if(!actorIds.length)return false;
  requireRule(!room.protectionWindow,'REACTION_PENDING','Finish the current protection window first.');
  room.protectionWindow={...window,actorIds,index:0};
  advanceProtectionWindow(room,ctx);return true;
}
function protectionTarget(room,ctx,window) {
  if(!window)return null;
  const owner=trainer(room,window.targetId),target=owner?.active;
  if(!owner||owner.eliminated||owner.spectator||!target||target.defeated||target.instanceId!==window.targetCreatureId||currentHp(target,ctx.catalogue)<=0)return null;
  if(window.mode==='cure-status')return target.status===window.status?target:null;
  const resolution=room.resolution;
  return resolution?.kind==='event'&&resolution.card?.id===window.eventCardId&&resolution.index===window.eventIndex&&resolution.targetIds[resolution.index]===owner.id&&resolution.targetInstances[owner.id]===target.instanceId?target:null;
}
function finishProtectionWindow(room,ctx,protectedTarget=false) {
  const window=room.protectionWindow;
  delete room.protectionWindow;room.pendingBattle=null;
  if(window.mode==='cancel-event')return protectedTarget?nextSettlement(room,ctx):openEventTarget(room,ctx);
  return resumeStatusContinuation(room,ctx,window.next);
}
function advanceProtectionWindow(room,ctx) {
  const window=room.protectionWindow;
  if(protectionTarget(room,ctx,window)) {
    while(window.index<window.actorIds.length) {
      const actor=trainer(room,window.actorIds[window.index]);
      if(actor&&!actor.eliminated&&!actor.spectator&&actor.hand.some(isArticunoCard)) {
        decision(room,'articuno',actor.id,window.targetId,ctx);
        Object.assign(room.pendingBattle,{mode:window.mode,...(window.mode==='cancel-event'?{eventName:window.eventName}:{status:window.status}),...(window.berryProtectionCount?{counterProtection:true}:{})});return;
      }
      window.index++;
    }
  }
  const protectedTarget=Boolean(window.berryProtectionCount%2);
  if(protectedTarget) {
    visualEvent(room,'event-action',{sourceId:window.berryProtectorId,targetIds:[window.targetId],name:{zh:'急冻鸟的庇护',en:'Articuno’s Protection'},effect:'articuno-protection',action:'shield'});
    note(room,'急冻鸟的庇护抵消了树果大丰收对此目标的效果。','Articuno’s Protection canceled Berry Harvest for this target.');
  }
  return finishProtectionWindow(room,ctx,protectedTarget);
}
function resumeStatusContinuation(room,ctx,next) {
  if(next==='light-ball')return finishResolution(room,ctx);
  return next==='settlement'?nextSettlement(room,ctx):afterDamage(room,ctx);
}
function applyStatus(room,ctx,pokemon,status,next='afterDamage') {
  // One-status restriction precedes replacement. Never redirect to a reserve
  // deployed after the original target fainted.
  if(!pokemon || !activeOwner(room,pokemon.instanceId) || pokemon.status)return resumeStatusContinuation(room,ctx,next);
  if(['caterpie','weedle'].includes(pokemon.catalogueId)&&pokemon.level===1&&battleTraitsEffective(room,pokemon)) {
    abilityVisual(room,activeOwner(room,pokemon.instanceId),ctx.catalogue);
    note(room,'鳞粉阻止此宝可梦陷入特殊状态。','Shield Dust prevented this Pokémon from gaining a special status.');
    return resumeStatusContinuation(room,ctx,next);
  }
  if(status==='paralysis'&&pokemon.catalogueId==='meowth'&&pokemon.level===3&&battleTraitsEffective(room,pokemon)) {
    abilityVisual(room,activeOwner(room,pokemon.instanceId),ctx.catalogue);
    note(room,'柔软阻止此宝可梦陷入麻痹。','Limber prevented this Pokémon from becoming Paralyzed.');
    return resumeStatusContinuation(room,ctx,next);
  }
  if(status==='sleep'&&pokemon.catalogueId==='electabuzz'&&battleTraitsEffective(room,pokemon)) {
    abilityVisual(room,activeOwner(room,pokemon.instanceId),ctx.catalogue);
    note(room,'干劲阻止此宝可梦陷入睡眠。','Vital Spirit prevented this Pokémon from falling asleep.');
    return resumeStatusContinuation(room,ctx,next);
  }
  startPoisonTouch(room,ctx,{kind:'status',targetId:pokemon.instanceId,status,next});
}
function startPoisonTouch(room,ctx,event) {
  requireRule(!room.statusEvent,'STATUS_PENDING','Finish the current status effect first.');
  const start=Math.max(0,room.players.findIndex(player=>player.id===room.turn.playerId));
  const ordered=[...room.players.slice(start),...room.players.slice(0,start)].filter(player=>!player.spectator&&!player.eliminated&&player.active?.catalogueId==='grimer'&&battleTraitsEffective(room,player.active)&&currentHp(player.active,ctx.catalogue)>0);
  room.statusEvent={...event,actorIds:ordered.map(player=>player.id),actorInstances:Object.fromEntries(ordered.map(player=>[player.id,player.active.instanceId])),index:0};
  // Replacing Poison with Poison cannot change the outcome. Accepting once
  // also makes subsequent identical replacements/setters irrelevant.
  if(event.kind==='status'&&event.status==='poison')room.statusEvent.index=ordered.length;
  advancePoisonTouch(room,ctx);
}
function advancePoisonTouch(room,ctx) {
  const event=room.statusEvent,owner=activeOwner(room,event.targetId);
  while(owner&&event.index<event.actorIds.length) {
    const actor=trainer(room,event.actorIds[event.index]);
    if(actor&&!actor.eliminated&&actor.active?.instanceId===event.actorInstances[actor.id]&&actor.active.catalogueId==='grimer'&&battleTraitsEffective(room,actor.active)&&currentHp(actor.active,ctx.catalogue)>0) {
      decision(room,'poison-touch',actor.id,owner.id,ctx);
      Object.assign(room.pendingBattle,{trait:'poison-touch',canTrait:true,mode:event.kind,...(event.kind==='status'?{status:event.status}:{damage:event.damage})});return;
    }
    event.index++;
  }
  delete room.statusEvent;room.pendingBattle=null;
  if(event.kind==='status') {
    if(owner&&!owner.active.status) {
      owner.active.status=event.status;
      const activeEvent = currentCardEvent(room);
      if (event.status==='sleep' && activeEvent?.eventType==='jigglypuff-performance') {
        visualEvent(room,'event-action',{sourceId:activeEvent.actorPlayerId,targetIds:[owner.id],
          name:activeEvent.eventName,effect:activeEvent.eventType,action:'lull'});
      }
      const names={burn:['灼伤','Burn'],poison:['中毒','Poison'],paralysis:['麻痹','Paralysis'],confusion:['混乱','Confusion'],sleep:['睡眠','Sleep'],flinch:['畏缩','Flinch']}[event.status];
      note(room,`宝可梦陷入${names[0]}状态。`,`The Pokémon gained ${names[1]}.`);
      if(startProtectionWindow(room,ctx,{mode:'cure-status',targetId:owner.id,targetCreatureId:owner.active.instanceId,status:event.status,next:event.next}))return;
    }
    return resumeStatusContinuation(room,ctx,event.next);
  }
  if(!owner || owner.active.status!=='poison')return finishResolution(room,ctx);
  // Poison has no damage source or resolving card, but receiving modifiers
  // still apply before the shared optional Marvel Scale / HP pipeline.
  const amount=computeDamage(null,owner.active,event.damage,ctx.catalogue,damageOptions(room,null,owner.active,{command:false,channel:'status',receiving:!hasShedSkin(room,owner.active)}));
  receiveDamage(room,ctx,amount);
}
function effectCamera(room, resolution) {
  if (!resolution?.targetIds?.length) return undefined;
  return {
    sourceId: resolution.sourcePlayerId || resolution.actorPlayerId || null,
    targetIds: [...resolution.targetIds],
    wide: resolution.targetIds.length > 1 &&
      (resolution.kind==='event' || resolution.targetIds.length >= live(room).length - 1),
  };
}
export function publicBattleDecision(room,self) {
  if(!room.pendingBattle)return null;
  const pending=structuredClone(room.pendingBattle);
  delete pending.targetCreatureId;
  if (pending.kind === 'expansion') {
    if (pending.actorId !== self.id) {
      if (pending.continuation?.kind === 'illusion-decoy') pending.title={zh:'训练家正在选择',en:'Trainer is choosing'};
      delete pending.options;
    }
    if (pending.actorId === self.id && pending.privateDetail) pending.detail=pending.privateDetail;
    delete pending.privateDetail;
    delete pending.continuation;
  }
  if(pending.kind==='defense'&&room.resolution?.effectKind==='swords-dance')pending.moveEffect='swords-dance';
  const resolution = [room.resolution, ...(room.resolutionStack || []).toReversed()]
    .find(item => item?.targetIds?.length);
  if (resolution) pending.camera = effectCamera(room, resolution);
  if(room.resolution?.berryCards) {
    pending.berryCards=room.resolution.berryCards.map(({name,weather,kind},index)=>({index,name,weather,kind}));
  }
  if(pending.kind==='articuno'&&pending.actorId===self.id)pending.protectionCards=self.hand.filter(isArticunoCard).map(({id,name,kind,weather})=>({id,name,kind,weather}));
  if(pending.kind==='mew-blessing') {
    const target=trainer(room,pending.targetId)?.active;
    if(target)pending.choices=mewBlessingChoices(target);
  }
  if(pending.kind==='quick-claw') {
    if(pending.actorId===self.id)pending.commandCards=self.hand.filter(sunnyCommand).map(({id,name,weather})=>({id,name,weather}));
    else delete pending.moves;
  }
  if(['blunder-policy','power-herb'].includes(pending.kind)&&pending.actorId===self.id)pending.paymentCards=self.hand.map(({id,name,kind,weather})=>({id,name,kind,weather}));
  if(pending.kind==='rescue') {
    const restricted=rescueOwnerOnly(room);
    pending.canUsePotion=!restricted||pending.actorId===pending.targetId;
    if(restricted)pending.potionRestrictedToOwner=true;
    if(pending.actorId===self.id) {
      const stub=({id,name,weather,kind})=>({id,name,weather,kind});
      pending.potionCards=pending.canUsePotion?self.hand.filter(isPotionCard).map(stub):[];
      pending.healerCards=pending.canUsePotion&&hasHealer(room,self)?self.hand.filter(card=>['intense-sun','clear'].includes(card.weather)).map(stub):[];
      const joySlots=joyItemSlots(room,self,pending.targetId);
      if (joySlots.length) pending.joyItems=joySlots.map(slot=>({...stub(self[slot].item),slot}));
    }
  }
  if(['battle-armor','bonemerang','neutralizing-gas','pressure','pressure-payment'].includes(pending.kind)&&pending.actorId===self.id)pending.paymentCards=self.hand.map(({id,name,weather,kind})=>({id,name,weather,kind}));
  if(pending.kind==='cute-charm'&&pending.actorId===self.id)pending.paymentCards=self.hand.filter(card=>card.weather==='intense-sun').map(({id,name,weather,kind})=>({id,name,weather,kind}));
  const repeated=[room.resolution,...(room.resolutionStack||[])].find(resolution=>resolution?.settlementCount!==undefined);
  if(repeated) {
    Object.assign(pending,{settlementNumber:repeated.settlementIndex+1,settlementCount:repeated.settlementCount});
    if(repeated.revealedCards)pending.revealedCards=repeated.revealedCards.map(({name,weather,kind})=>({name,weather,kind}));
    if(repeated.effectKind==='double-kick')pending.settlementMove={zh:'二连踢',en:'Double Kick'};
    if(repeated.effectKind==='bonemerang')pending.settlementMove={zh:'骨头回力镖',en:'Bonemerang'};
  }
  if(pending.kind==='switch-payment'&&pending.actorId===self.id)pending.cards=self.hand.map(({id,name,weather,kind})=>({id,name,weather,kind}));
  if(pending.kind==='shed-skin'&&pending.actorId===self.id)pending.cards=self.hand.map(({id,name,weather,kind})=>({id,name,weather,kind}));
  if(pending.kind==='distribute'&&pending.actorId===self.id)pending.cards=(room.resolution.distributionCards||[]).map(({name,weather,kind},index)=>({index,name,weather,kind}));
  if(pending.kind==='cycle' && pending.actorId===self.id)pending.cards=self.hand.map(({id,name,weather,kind})=>({id,name,weather,kind}));
  if(pending.kind==='judgment' && pending.actorId===self.id)pending.replacementCards=self.hand.filter(card=>['intense-sun','clear'].includes(card.weather)).map(({id,name,weather,kind})=>({id,name,weather,kind}));
  if(['hand','event-hand','exile','cursed-body'].includes(pending.kind) && pending.actorId===self.id) {
    const target=trainer(room,pending.targetId);
    pending.choices=(room.resolution.handChoiceIds||[]).map((id,index)=>{
      const card=target.hand.find(c=>c.id===id);
      return self.id===target.id ? {index,name:card.name,weather:card.weather,kind:card.kind} : {index};
    });
  }
  if(pending.kind==='reorder' && pending.actorId===self.id) {
    pending.cards=(room.resolution.scryCardIds||[]).map((id,index)=>{
      const card=room.drawPile.find(c=>c.id===id);
      return {index,name:card.name,weather:card.weather,kind:card.kind};
    });
  }
  if(pending.kind==='forewarn-order'&&pending.actorId===self.id)pending.cards=(room.turnStart.forewarnCardIds||[]).map((id,index)=>{
    const card=room.drawPile.find(card=>card.id===id);return {index,name:card.name,weather:card.weather,kind:card.kind};
  });
  if(pending.kind==='sweet-kiss'&&pending.actorId===self.id)pending.cards=self.hand.map(({id,name,weather,kind})=>({id,name,weather,kind}));
  if(pending.kind==='vital-spirit'&&pending.actorId===self.id)pending.cards=room.drawChoice.cardIds.map((id,index)=>{
    const card=room.drawPile.find(card=>card.id===id);return {index,name:card.name,weather:card.weather,kind:card.kind};
  });
  if(pending.kind==='intimidate-hand'&&pending.actorId===self.id)pending.choices=room.entryEvent.handChoiceIds.map((id,index)=>{
    const card=trainer(room,pending.targetId).hand.find(card=>card.id===id);
    return pending.targetId===self.id?{index,name:card.name,weather:card.weather,kind:card.kind}:{index};
  });
  if(pending.kind==='download-hand'&&pending.actorId===self.id)pending.choices=room.drawChoice.handChoiceIds.map((id,index)=>({index}));
  return pending;
}
function finishDownload(room,player,ctx) {
  abilityVisual(room,player,ctx.catalogue);
  gainBattleCards(room,player,room.drawChoice.cards,{reason:'download'});
  delete room.drawChoice;room.pendingBattle=null;room.turn.drawRemaining=0;room.turn.phase='play';
  note(room,'下载获得所选手牌并替代通常摸牌。','Download gained the selected hand cards and replaced the ordinary draws.');
}
function advanceDownload(room,player,ctx) {
  const choice=room.drawChoice;
  while(choice.index<choice.targetIds.length) {
    const target=trainer(room,choice.targetIds[choice.index]);
    if(target&&!target.eliminated&&target.hand.length) {
      choice.handChoiceIds=shuffled(target.hand.map(card=>card.id));
      decision(room,'download-hand',player.id,target.id,ctx);room.pendingBattle.choiceCount=choice.handChoiceIds.length;return;
    }
    choice.index++;
  }
  return finishDownload(room,player,ctx);
}
function charmTargets(room,owner,ctx) {
  const resolution=room.resolution,index=resolution.targetingIndex;
  return eligibleTargetIds(room.players,owner.id).filter(id=>id!==owner.id&&id!==resolution.sourcePlayerId&&!resolution.targetIds.some((target,i)=>i!==index&&target===id)&&face(trainer(room,id).active,ctx.catalogue)?.effectStatus==='combat-preview');
}
function followMeCandidates(room, ctx) {
  const resolution = room.resolution;
  if (!resolution.followMeRange?.length || resolution.followMeAccepted || resolution.targetIds.length!==1) return [];
  const target = trainer(room,resolution.targetIds[0]);
  const source = trainer(room,resolution.sourcePlayerId);
  if (!isTeamRole(target?.role) || source?.role===target.role || target.eliminated ||
      !target.active || target.active.defeated || currentHp(target.active,ctx.catalogue)<=0) return [];
  const seats = live(room), anchor = seats.indexOf(target);
  return [...seats.slice(anchor+1),...seats.slice(0,anchor)].filter(player =>
    player.role===target.role && player.id!==source.id && player.hand.length &&
    resolution.followMeRange.includes(player.id) && player.active && !player.active.defeated &&
    currentHp(player.active,ctx.catalogue)>0 && face(player.active,ctx.catalogue)?.effectStatus==='combat-preview');
}
function offerFollowMe(room, ctx) {
  const resolution = room.resolution;
  const cover = followMeCandidates(room,ctx).find(player=>!resolution.followMeAsked?.includes(player.id));
  if (!cover) return false;
  const ally = trainer(room,resolution.targetIds[0]);
  (resolution.followMeAsked ??= []).push(cover.id);
  tourDecision(room,cover,tourActionNames['follow-me'],cover.hand.map(tourCardOption),
    {kind:'follow-me', targetInstance:ally.active.instanceId, coverInstance:cover.active.instanceId},ctx,true);
  Object.assign(room.pendingBattle,{targetId:ally.id, detail:{
    zh:`弃置一张手牌，替 ${ally.nickname} 承接${resolution.moveName.zh}。`,
    en:`Discard one card to take ${resolution.moveName.en} for ${ally.nickname}.`,
  }});
  return true;
}
const gymGuardName = {zh:'道馆护卫',en:'Gym Guard'};
function gymGuardForMove(room, ctx) {
  const resolution = room.resolution, viridian = room.scenario?.viridian, guard = viridian?.guard;
  if (!guard || guard.used || !viridian.leaderRevealed || resolution.targetIds.length!==1 ||
      !resolution.gymGuardRange?.includes(guard.playerId) || resolution.sourcePlayerId===guard.playerId) return null;
  const leader = trainer(room,resolution.targetIds[0]);
  const protector = trainer(room,guard.playerId);
  if (leader?.role!=='leader' || !leader.identityPublic || ![leader,protector].every(player=>
    player?.active && !player.eliminated && !player.active.defeated && currentHp(player.active,ctx.catalogue)>0)) return null;
  return {leader,protector};
}
function offerGymGuard(room, ctx) {
  const resolution = room.resolution;
  if (resolution.gymGuardAsked) return false;
  const assignment = gymGuardForMove(room,ctx);
  if (!assignment) return false;
  const {leader,protector} = assignment;
  resolution.gymGuardAsked = true;
  tourDecision(room,protector,gymGuardName,[{value:'guard',label:{zh:'承接招式',en:'Intercept move'}}],
    {kind:'gym-guard',leaderInstance:leader.active.instanceId,guardInstance:protector.active.instanceId},ctx,true);
  Object.assign(room.pendingBattle,{targetId:leader.id,detail:{
    zh:`代替 ${leader.nickname} 承接${resolution.moveName.zh}，每局限一次。`,
    en:`Take ${resolution.moveName.en} for ${leader.nickname}. Once per match.`,
  }});
  return true;
}
function finishTargetAssignment(room,ctx) {
  delete room.resolution.targetingIndex;delete room.resolution.charmSeenIds;
  if (offerGymGuard(room,ctx) || offerFollowMe(room,ctx)) return;
  if(!room.resolution.statusMove&&!room.resolution.pressureDone)return advancePressure(room,ctx);
  if(room.resolution.sourceFamily==='slowpoke'&&room.resolution.sourceLevel===3) {
    decision(room,'foresee',room.resolution.sourcePlayerId,room.resolution.sourcePlayerId,ctx);Object.assign(room.pendingBattle,{trait:'future-sight',canTrait:true});return;
  }
  openMoveUse(room,ctx);
}
function finishPressureChoice(room,ctx,invalid) {
  const resolution=room.resolution;
  if(invalid) {
    resolution.pressureInvalidIds??=[];
    if(!resolution.pressureInvalidIds.includes(resolution.pressurePokemonId))resolution.pressureInvalidIds.push(resolution.pressurePokemonId);
    note(room,'压迫感使此指令牌使用的整个招式对原目标无效；其他目标不受影响。','Pressure made this command’s entire move ineffective against the original target; other targets are unaffected.');
  }
  delete resolution.pressurePokemonId;resolution.pressureIndex++;room.pendingBattle=null;
  return advancePressure(room,ctx);
}
function advancePressure(room,ctx) {
  const resolution=room.resolution;
  resolution.pressureIndex??=0;
  resolution.pressureActorInstances??=Object.fromEntries(resolution.targetIds.map(id=>[id,trainer(room,id).active.instanceId]));
  while(resolution.pressureIndex<resolution.targetIds.length) {
    const target=trainer(room,resolution.targetIds[resolution.pressureIndex]),pokemon=target.active;
    if(!target.eliminated&&pokemon?.catalogueId==='aerodactyl'&&pokemon.instanceId===resolution.pressureActorInstances[target.id]&&battleTraitsEffective(room,pokemon)&&currentHp(pokemon,ctx.catalogue)>0&&target.hand.length) {
      resolution.pressurePokemonId=pokemon.instanceId;
      decision(room,'pressure',target.id,resolution.sourcePlayerId,ctx);return;
    }
    resolution.pressureIndex++;
  }
  resolution.pressureDone=true;
  resolution.targetIds=resolution.targetIds.filter(id=>!resolution.pressureInvalidIds?.includes(trainer(room,id).active.instanceId));
  return finishTargetAssignment(room,ctx);
}
function advanceCommandTargets(room,ctx) {
  const resolution=room.resolution;
  if(resolution.statusMove)return finishTargetAssignment(room,ctx);
  resolution.targetingIndex??=0;resolution.charmSeenIds??=[];
  while(resolution.targetingIndex<resolution.targetIds.length) {
    const owner=trainer(room,resolution.targetIds[resolution.targetingIndex]),pokemon=owner.active;
    if(pokemon.catalogueId==='clefairy'&&battleTraitsEffective(room,pokemon)&&!owner.eliminated&&!resolution.charmSeenIds.includes(pokemon.instanceId)) {
      resolution.charmSeenIds.push(pokemon.instanceId);
      const targets=charmTargets(room,owner,ctx);
      if(targets.length&&owner.hand.some(card=>card.weather==='intense-sun')) {
        resolution.charmActorInstance=pokemon.instanceId;
        decision(room,'cute-charm',owner.id,owner.id,ctx);Object.assign(room.pendingBattle,{legalTargetIds:targets});return;
      }
    }
    resolution.targetingIndex++;
  }
  delete resolution.charmActorInstance;
  finishTargetAssignment(room,ctx);
}
// Target assignment, including Cute Charm, precedes move-use effects and defense.
function openMoveUse(room, ctx) {
  const resolution = room.resolution;
  if(!resolution.targetIds.length)return finishResolution(room,ctx);
  if(resolution.effectKind==='freeze-dry'&&!resolution.suppressedReinforcementIds)resolution.suppressedReinforcementIds=resolution.targetIds.map(id=>trainer(room,id).active.instanceId);
  if(resolution.effectKind==='bonemerang'&&resolution.settlementCount===undefined) {
    resolution.settlementCount=1;resolution.settlementIndex=0;
    resolution.originalTargetId=trainer(room,resolution.targetIds[0]).active.instanceId;
  }
  if(resolution.effectKind==='double-kick'&&resolution.settlementCount===undefined) {
    resolution.settlementIndex=0;resolution.settlementCount=2;
    resolution.originalTargetId=trainer(room,resolution.targetIds[0]).active.instanceId;
  }
  if(resolution.effectKind==='fury-attack'&&resolution.settlementCount===undefined) {
    refillDrawPile(room,4);
    const count=Math.min(4,room.drawPile.length);
    resolution.revealedCards=count?room.drawPile.splice(-count,count).reverse():[];
    resolution.settlementIndex=0;resolution.settlementCount=1+resolution.revealedCards.filter(card=>['intense-sun','clear'].includes(card.weather)).length;
    resolution.originalTargetId=trainer(room,resolution.targetIds[0]).active.instanceId;
    note(room,`乱击亮出${count}张牌，本次使用共结算${resolution.settlementCount}次。`,`Fury Attack revealed ${count} card(s); this move resolves ${resolution.settlementCount} time(s).`);
  }
  if(resolution.sourceFamily==='squirtle' && resolution.sourceLevel>=2 && !resolution.suppressedItemIds)resolution.suppressedItemIds=resolution.targetIds.map(id=>trainer(room,id).active).filter(p=>p.item).map(p=>p.instanceId);
  if((resolution.sourceFamily==='machop'&&resolution.sourceLevel<=2)||(resolution.sourceFamily==='mankey'&&resolution.sourceLevel>=2)) {
    resolution.useIndex??=0;
    while(resolution.useIndex<resolution.targetIds.length) {
      const target=trainer(room,resolution.targetIds[resolution.useIndex]),markers=[...new Set(target.active.reinforcements||[])];
      if(markers.length) {
        resolution.markerTargetId=target.active.instanceId;decision(room,'reinforcement',resolution.sourcePlayerId,target.id,ctx);room.pendingBattle.reinforcements=markers;return;
      }
      resolution.useIndex++;
    }
  }
  openDefense(room, ctx);
}
function openDefense(room, ctx) {
  const resolution = room.resolution;
  if(resolution.kind==='event')return openEventTarget(room,ctx);
  if (resolution.index >= resolution.targetIds.length) return finishResolution(room, ctx);
  const target = trainer(room, resolution.targetIds[resolution.index]);
  if(resolution.settlementCount!==undefined&&(!activeOwner(room,resolution.sourceId)||!activeOwner(room,resolution.originalTargetId)||target.active.instanceId!==resolution.originalTargetId||currentHp(creature(room,resolution.sourceId),ctx.catalogue)<=0||currentHp(target.active,ctx.catalogue)<=0))return finishResolution(room,ctx);
  if (target.eliminated || target.active.defeated) { resolution.index++; return openDefense(room, ctx); }
  resolution.targetCreatureId = target.active.instanceId;
  const visualKey = `${resolution.index}:${resolution.settlementIndex ?? 0}:${target.id}`;
  if (resolution.kind==='move' && resolution.visualKey!==visualKey) {
    resolution.visualKey = visualKey;
    moveVisual(room,target.id,true);
  }
  delete resolution.incomingDamage;delete resolution.modifierState;
  resolution.sourceAfterDone=false; resolution.sourceItemAfterDone=false; resolution.staticDone=false; delete resolution.receivingEffects;delete resolution.helmetCardId; resolution.actualDamage=0; delete resolution.handChoiceIds;delete resolution.lifeOrbRecoil;
  if (resolution.baseDamage>0 && !resolution.statusMove && wonderGuardBlocks(room,target.active,resolution)) {
    abilityVisual(room,target,ctx.catalogue);
    note(room,'神奇守护挡下了这次招式。','Wonder Guard blocked this move.');
    return nextSettlement(room,ctx);
  }
  decision(room, 'defense', target.id, target.id, ctx);
  room.pendingBattle.cannotDodge=Boolean(resolution.ignoresReinforcements);
  if(room.turn.dodgeBlockedCreatureIds?.includes(target.active.instanceId)){room.pendingBattle.cannotDodge=true;room.pendingBattle.dodgeBlockedBy='lock-on';}
  if(resolution.dodgesRequired===2) {
    room.pendingBattle.dodgesRequired=2;
    room.pendingBattle.dodgesPlayed=0;
    room.pendingBattle.doubleDodgeMove=resolution.moveName;
  }
  room.pendingBattle.canTrait=!room.pendingBattle.cannotDodge && canSandVeil(room,target) && room.drawPile.length+room.discardPile.length>0;
  if(!room.pendingBattle.cannotDodge&&activeItemIs(room,target.active,'bright-powder')&&room.drawPile.length+room.discardPile.length>0)room.pendingBattle.canBrightPowder=true;
  if (!room.pendingBattle.cannotDodge && activeItemIs(room,target.active,'tour-protect') && !room.turn.tourProtectUsed?.includes(target.active.instanceId) && room.drawPile.length+room.discardPile.length>0) room.pendingBattle.canTourProtect=true;
  if(room.pendingBattle.canTrait)room.pendingBattle.trait='sand-veil';
  if(resolution.sourceFamily==='caterpie'&&resolution.sourceLevel===3&&battleTraitsEffective(room,creature(room,resolution.sourceId))&&resolution.sourcePlayerId!==target.id) {
    room.pendingBattle.blockedDodgeWeathers=['intense-sun'];
    abilityVisual(room,activeOwner(room,resolution.sourceId),ctx.catalogue);
  }
  if(resolution.settlementCount!==undefined)Object.assign(room.pendingBattle,{settlementNumber:resolution.settlementIndex+1,settlementCount:resolution.settlementCount});
  if(resolution.sourceFamily==='pidgey'&&battleTraitsEffective(room,creature(room,resolution.sourceId))&&resolution.sourcePlayerId!==target.id) {
    room.pendingBattle.dodgeReducesDamage=true;room.pendingBattle.damageReduction=resolution.dodgeReductions?.[target.active.instanceId]||0;
  }
}
function reduceMoveDamage(room,targetId) {
  room.resolution.dodgeReductions??={};
  return room.resolution.dodgeReductions[targetId]=(room.resolution.dodgeReductions[targetId]||0)+1;
}
function cancelMoveWithDodge(room,ctx,card=null) {
  const resolution=room.resolution;
  const source=activeOwner(room,resolution.sourceId),target=activeOwner(room,resolution.targetCreatureId);
  if (resolution.kind === 'move' && target && hasPack(room.settings.contentPack,HOENN_PACK) &&
      card?.variant === emergencyRetreat.variant && !target.emergencyRetreatDebt) queueEmergencyRetreat(resolution,target);
  if (resolution.kind === 'move' && source?.hand.length >= 2 && target) {
    const policy = activeItemIs(room,source.active,'blunder-policy');
    const herb = hasPack(room.settings.contentPack,HOENN_PACK) && activeItemIs(room,source.active,powerHerb.itemType) &&
      resolution.baseDamage > 0 && resolution.targetIds.length === 1 && !resolution.statusMove &&
      resolution.effectKind !== 'bonemerang' && (resolution.settlementCount ?? 1) === 1 &&
      !damageImmune(room,target.active);
    if (policy || herb) {
      const kind = policy ? 'blunder-policy' : powerHerb.itemType;
      resolution.dodgePaymentItemId=source.active.item.id;
      decision(room,kind,source.id,target.id,ctx);
      return;
    }
  }
  return nextSettlement(room,ctx);
}
const hasSniper=(room,player)=>!player.spectator&&!player.eliminated&&player.active?.catalogueId==='weedle'&&player.active.level===3&&battleTraitsEffective(room,player.active);
export const cardDistanceIgnored=(room,player)=>room.turn?.cardRangePlayerId===player.id||Boolean(room.turn?.rangeCreatureId&&[player.active,player.reserve].some(pokemon=>pokemon?.instanceId===room.turn.rangeCreatureId))||hasSniper(room,player)||activeItemIs(room,player.active,'quick-claw');
const sandObservationMoves = new Set(['Mud-Slap','Bulldoze','Earthquake','Bone Rush','Bonemerang',
  'Rock Throw','Rock Slide','Stone Edge','Headlong Rush']);
const weatherMoveEffects=new Set(['burn-judgment','temporary-hand-exile','self-defense','paralysis-judgment','forced-switch','sleep-judgment','swords-dance','light-screen','lock-on','discard-other-hand','life-dew','moonlight','u-turn','hoenn-weather-ball']);
const isPotionCard=card=>card?.kind==='tool'&&['potion-full-heal','potion-revive'].includes(card.toolType);
const rescueOwnerOnly=room=>[room.resolution,...(room.resolutionStack||[])].some(resolution=>resolution?.effectKind==='fainting-owner-potion-only');
// A fainting active still has its trait until formal defeat; reserves do not.
const hasHealer=(room,owner)=>Boolean(owner&&!owner.eliminated&&owner.active?.catalogueId==='chansey'&&battleTraitsEffective(room,owner.active));
const potionChoice={effect:'potion',name:{zh:'伤药',en:'Potion'},description:{zh:'出牌阶段令一只已受伤的出战或备战宝可梦回复2点体力；昏厥结算中可救援目标并回复2点体力。',en:'During Play, restore 2 HP to an injured active or reserve Pokémon; during fainting settlement, restore 2 HP to that target.'}};
const reinforcementNames={power:{zh:'力量强化',en:'Power Boost'},defense:{zh:'防御强化',en:'Defense Boost'},speed:{zh:'速度强化',en:'Speed Boost'}};
function reinforcementChoice(effect) {
  const name=reinforcementNames[effect];
  return {effect,name,description:{
    zh:`在你的出牌阶段，令一只没有${name.zh}指示物的出战宝可梦获得一枚该指示物。`,
    en:`During Play, give one active Pokémon a ${name.en} marker if it does not already have one.`
  }};
}
// One physical split card supplies two alternatives; only one executes. These
// readable tool faces impose no distance restriction (booklet p07 is conditional).
const printedWeatherNames = {
  'intense-sun':['烈日','intense sun'], clear:['晴朗','clear'], rain:['暴雨','heavy rain'], thunderstorm:['雷雨','thunderstorm'],
};
const splitTools=[
  ...tourTools,
  ...hoennTools,
  {toolType:'potion-full-heal',choices:[
    potionChoice,
    {effect:'full-heal',name:{zh:'万灵药',en:'Full Heal'},description:{zh:'在你的出牌阶段，对一只处于特殊状态的出战或备战宝可梦使用，恢复其特殊状态。',en:'During your Play phase, cure one active or reserve Pokémon’s special status.'}},
  ]},
  {toolType:'potion-revive',choices:[potionChoice,{effect:'revive',name:{zh:'活力碎片',en:'Revive'},description:{zh:'在你的出牌阶段，令一名未退场训练家的已失去战斗能力的宝可梦恢复战斗能力，体力回复至2点。',en:'During Play, restore a defeated Pokémon of a trainer still in the battle to fighting condition at 2 HP.'}}]},
  {toolType:'rare-candy-nugget',choices:[
    {effect:'rare-candy',name:{zh:'神奇糖果',en:'Rare Candy'},description:{zh:'在你的出牌阶段，使一只不处于等级3的出战宝可梦提升一个等级。',en:'During your Play phase, raise one active Pokémon below level 3 by one level.'}},
    {effect:'nugget',targeting:'trainer',name:{zh:'金珠',en:'Nugget'},description:{zh:'在你的出牌阶段，对一名训练家使用，令其摸两张牌。',en:'During your Play phase, one trainer draws two cards.'}},
  ]},
  {toolType:'defense-speed',choices:['defense','speed'].map(reinforcementChoice)},
  {toolType:'power-speed',choices:['power','speed'].map(reinforcementChoice)},
];
function toolTargets(room,player,catalogue,effect,card) {
  if (effect.startsWith('tour-')) return tourEnabled(room) ? tourToolTargets(room,player,catalogue,effect,card) : [];
  if (effect === 'hoenn-lum' || effect === 'hoenn-umbrella') {
    if (!hasPack(room.settings?.contentPack, HOENN_PACK)) return [];
    const slots = effect === 'hoenn-lum' ? ['reserve'] : ['active','reserve'];
    return slots.filter(slot => {
      const pokemon = player[slot];
      return pokemon && !pokemon.defeated && currentHp(pokemon,catalogue)>0 &&
        (effect === 'hoenn-lum' ? pokemon.status : !pokemon.hoennUmbrella);
    }).map(slot => ({targetId:player.id,slot}));
  }
  if(effect==='nugget')return live(room).map(owner=>({targetId:owner.id}));
  if(Object.hasOwn(reinforcementNames,effect))return live(room)
    .filter(({active})=>active&&!active.defeated&&currentHp(active,catalogue)>0&&!active.reinforcements?.includes(effect))
    .map(owner=>({targetId:owner.id,slot:'active'}));
  if(!['potion','full-heal','rare-candy','revive'].includes(effect))return [];
  return live(room).flatMap(owner=>['active','reserve'].flatMap(slot=>{
    const pokemon=owner[slot];
    // No current status source reaches an unrevealed opposing reserve. Never
    // query its hidden state; future reserve-status effects need a reveal flow.
    if(slot==='reserve'&&owner.id!==player.id&&!pokemon?.revealed)return [];
    if(effect==='revive')return pokemon?.defeated?[{targetId:owner.id,slot}]:[];
    if(!pokemon||pokemon.defeated||currentHp(pokemon,catalogue)<=0)return [];
    const legal=effect==='potion'?(pokemon.damage||0)>0:effect==='full-heal'?Boolean(pokemon.status):slot==='active'&&pokemon.level<3;
    return legal?[{targetId:owner.id,slot}]:[];
  }));
}
function toolActions(room,player,catalogue,own) {
  return splitTools.flatMap(tool=>{
    const held=player.hand.filter(card=>card.kind==='tool'&&card.toolType===tool.toolType);
    const expansion=Boolean(tool.weather);
    return (expansion?held:held.slice(0,1)).map(card=>({
      toolType:tool.toolType,...(expansion?{cardId:card.id}:{}),
      choices:tool.choices.map(choice=>({...choice,targets:own?toolTargets(room,player,catalogue,choice.effect,card):[]})),
    }));
  });
}
// Ordinary Play events from the reviewed card faces. Articuno uses its own reaction window.
const reviewedEvents={
  ...tourEvents,
  ...hoennEvents,
  'rival-challenge':{targeting:'single',name:{zh:'劲敌的挑战',en:'Rival’s Challenge'},description:{zh:'选择另一名训练家，从目标开始轮流打出「接招吧！」。最后打出的一方由出战宝可梦对另一方造成2点基础伤害。若目标一开始就放弃，则由发起者的出战宝可梦造成这次伤害。',en:'Choose another trainer and alternate playing Take this!, starting with the target. The last player’s active Pokémon deals 2 base damage to the other active Pokémon. If the target passes immediately, the challenger’s active Pokémon deals the damage.'}},
  'berry-harvest':{name:{zh:'树果大丰收',en:'Berry Harvest'},description:{zh:'亮出与目标数相同的牌。从你开始，各训练家依次获得一张尚未被选走的牌。',en:'Reveal one card per target. Starting with you, each trainer chooses and gains one of the remaining cards.'}},
  'farfetchd-prank':{targeting:'single',name:{zh:'大葱鸭的恶作剧',en:'Farfetch’d’s Prank'},description:{zh:'弃置另一名训练家的一张手牌，或弃置一只出战宝可梦的持有物或一枚强化指示物。',en:'Discard another trainer’s hand card, or discard an active Pokémon’s held item or one of its reinforcement markers.'}},
  'moltres-trial':{name:{zh:'火焰鸟的试炼',en:"Moltres’s Trial"},description:{zh:'从下一位训练家起依次结算其他训练家的出战宝可梦；打出一张接招吧！，否则受到火焰鸟造成的2点伤害。',en:'Resolve other active Pokémon, starting with the next trainer. Play one actual command card response or receive 2 damage from Moltres.'}},
  'zapdos-punishment':{name:{zh:'闪电鸟的惩戒',en:"Zapdos’s Punishment"},description:{zh:'从下一位训练家开始，依次结算所有出战宝可梦（你最后）。目标训练家判定，雷雨时受到闪电鸟造成的等同于目标等级的伤害。',en:'Starting with the next trainer and ending with you, every active Pokémon’s trainer judges. Thunderstorm causes damage from Zapdos equal to that target’s level.'}},
  'jigglypuff-performance':{targeting:'single',name:{zh:'胖丁的表演',en:"Jigglypuff’s Performance"},description:{zh:'选择一只出战宝可梦；其训练家进行判定，结果不为雷雨时，目标陷入睡眠。',en:'Choose one active Pokémon. Its trainer judges; any result other than thunderstorm puts the target to Sleep.'}},
  'mr-mime-trick':{targeting:'single',name:{zh:'魔墙人偶的戏法',en:"Mr. Mime’s Trick"},description:{zh:'选择距离范围内的其他出战宝可梦，获得其训练家的一张手牌或其携带的持有物。',en:'Choose another active Pokémon within range and take one card from its trainer’s hand or its held item.'}},
  'mewtwo-threat':{name:{zh:'超梦的威压',en:"Mewtwo's Threat"},description:{zh:'从下一位训练家起依次结算所有其他训练家的出战宝可梦；打出一张快躲开！，否则受到超梦造成的2点伤害。',en:'Resolve every other active Pokémon, starting with the next trainer. Play one actual Dodge response or receive 2 damage from Mewtwo.'}},
  'mew-blessing':{name:{zh:'梦幻的祝福',en:"Mew’s Blessing"},description:{zh:'从你开始依次结算出战宝可梦。未满级且受伤可选回复2点体力或升1级，满体力只能升级，Lv.3只能回复。满体力的Lv.3跳过。',en:'Resolve active Pokémon starting with you. An injured Pokémon below Lv. 3 can heal 2 HP or gain one level. A healthy Pokémon can only level up, and an injured Lv. 3 Pokémon must heal. Skip full-HP Lv. 3 Pokémon.'}}
};
function eventTargets(room,player,eventType) {
  const seats=live(room),index=seats.findIndex(seat=>seat.id===player.id);
  const ordered=[...seats.slice(index),...seats.slice(0,index)];
  if(eventType==='zapdos-punishment')ordered.push(ordered.shift());
  if (hoennEvents[eventType]?.response || (Object.hasOwn(hoennEvents, eventType) && !hasPack(room.settings.contentPack, HOENN_PACK))) return [];
  const delayed = hoennDelayedEvents[eventType];
  if (delayed) {
    const neighbors = delayed.adjacent ? eligibleTargetIds(room.players, player.id) : null;
    return ordered.filter(seat => seat.id !== player.id && seat.active && !seat.active.defeated &&
      (!neighbors || neighbors.includes(seat.id)) && !seat.delayedEvents?.some(card => card.eventType === eventType));
  }
  if (eventType === 'tour-supply' || Object.hasOwn(hoennEvents, eventType)) return ordered.filter(seat => seat.id === player.id);
  if (eventType === 'tour-gift') return ordered.filter(seat => seat.id !== player.id && player.hand.length > 1 && eligibleTargetIds(room.players,player.id,{ignoreDistance:cardDistanceIgnored(room,player)||battleReinforcementEffective(room,player.active,'speed')}).includes(seat.id));
  if (eventType === 'tour-search') return ordered.filter(seat => seat.id !== player.id && seat.hand.length && eligibleTargetIds(room.players,player.id,{ignoreDistance:cardDistanceIgnored(room,player)||battleReinforcementEffective(room,player.active,'speed')}).includes(seat.id));
  const ranged=eventType==='mr-mime-trick';
  const inRange=ranged?eligibleTargetIds(room.players,player.id,{ignoreDistance:cardDistanceIgnored(room,player)||battleReinforcementEffective(room,player.active,'speed')}):null;
  return ordered.filter(seat=>(!['mewtwo-threat','moltres-trial','mr-mime-trick','rival-challenge'].includes(eventType)||seat.id!==player.id)&&seat.active&&!seat.active.defeated&&battleEventTargetAllowed(room,seat.active,reviewedEvents[eventType].name.zh)&&(!ranged||inRange.includes(seat.id)));
}
function eventChoices(eventType, targets, player) {
  const choice = (effect, zh, en, eligible) => ({effect,name:{zh,en},targetIds:targets.filter(eligible).map(seat=>seat.id)});
  if(eventType==='mr-mime-trick')return [
    {...choice('hand','获得一张手牌','Take one hand card',seat=>seat.hand.length),description:{zh:'私下选择一张背面手牌并获得。',en:'Privately choose one hidden card back and take that card.'}},
    {...choice('item','获得持有物','Take held item',seat=>seat.active.item),description:{zh:'将持有物加入你的手牌，不自动携带。',en:'Put the held item in your hand; it is not automatically equipped.'}}
  ];
  if(eventType==='farfetchd-prank')return [
    choice('hand','弃置一张手牌','Discard one hand card',seat=>seat.id!==player.id&&seat.hand.length),
    choice('item','弃置持有物','Discard held item',seat=>seat.active.item),
    ...[['power','力量','Power'],['defense','防御','Defense'],['speed','速度','Speed']].map(([marker,zh,en])=>
      choice(marker,`弃置一枚${zh}强化`,`Discard one ${en} marker`,seat=>seat.active.reinforcements?.includes(marker)))
  ];
  return null;
}
function eventActions(room,player,own) {
  return [...new Set(player.hand.filter(card=>card.kind==='event'&&Object.hasOwn(reviewedEvents,card.eventType)).map(card=>card.eventType))].map(eventType=>{
    const targets=eventTargets(room,player,eventType);
    const choices=eventChoices(eventType,targets,player);
    const targetIds=choices?[...new Set(choices.flatMap(choice=>choice.targetIds))]:targets.map(seat=>seat.id);
    return {eventType,...reviewedEvents[eventType],...(choices?{choices}:{}),targetIds,canUse:Boolean(own&&targetIds.length)};
  });
}
export function useBattleEvent(room,player,input,ctx) {
  const legal=previewActions(room,player,ctx.catalogue);
  requireRule(room.turn?.playerId===player.id&&room.turn.phase==='play'&&legal&&!room.pendingBattle&&!room.pendingVote,'EVENT_UNAVAILABLE','Events require your unblocked Play phase.');
  const selected=player.hand.find(card=>card.id===input.cardId&&card.kind==='event'&&Object.hasOwn(reviewedEvents,card.eventType));
  requireRule(selected&&legal.events.some(event=>event.eventType===selected.eventType&&event.canUse),'INVALID_CARD','Choose a reviewed event from your own hand.');
  const descriptor=legal.events.find(event=>event.eventType===selected.eventType);
  const single=descriptor.targeting==='single', split=Boolean(descriptor.choices);
  requireRule(Object.keys(input).every(key=>['id','revision','type','cardId',...(single?['targetId']:[]),...(split?['effect']:[])].includes(key)),'INVALID_INPUT','Choose only the fields required by this event.');
  if(single)requireRule(typeof input.targetId==='string'&&descriptor.targetIds.includes(input.targetId),'INVALID_TARGET','Choose a legal active Pokémon for this event.');
  if(split)requireRule(descriptor.choices.some(choice=>choice.effect===input.effect&&choice.targetIds.includes(input.targetId)),'INVALID_EVENT_CHOICE','Choose an available effect for this target.');
  const targets=eventTargets(room,player,selected.eventType).filter(target=>!single||target.id===input.targetId);
  player.hand.splice(player.hand.indexOf(selected),1);
  room.resolution={kind:'event',card:selected,eventType:selected.eventType,eventName:reviewedEvents[selected.eventType].name,sourceId:null,sourcePlayerId:null,actorPlayerId:player.id,actorCreatureId:player.active.instanceId,...(split?{eventEffect:input.effect}:{}),...(['mewtwo-threat','moltres-trial','zapdos-punishment'].includes(selected.eventType)?{externalSource:{kind:'external-pokemon',name:selected.eventType==='moltres-trial'?{zh:'火焰鸟',en:'Moltres'}:selected.eventType==='zapdos-punishment'?{zh:'闪电鸟',en:'Zapdos'}:{zh:'超梦',en:'Mewtwo'}}}:{}),targetIds:targets.map(seat=>seat.id),targetInstances:Object.fromEntries(targets.map(seat=>[seat.id,seat.active.instanceId])),index:0,damagedIds:[],defenseIds:[],actualDamage:0};
  room.resolution.visualId = randomUUID();
  visualEvent(room,'event',{sourceId:player.id,targetIds:room.resolution.targetIds,
    name:room.resolution.eventName,effect:selected.eventType});
  note(room,`使用${reviewedEvents[selected.eventType].name.zh}。`,`Used ${reviewedEvents[selected.eventType].name.en}.`,{camera:effectCamera(room,room.resolution)});
  if(selected.eventType==='berry-harvest') {
    const count=Math.min(targets.length,room.drawPile.length+room.discardPile.length);
    refillDrawPile(room,count);
    room.resolution.berryCards=Array.from({length:count},()=>topCard(room));
    note(room,`树果大丰收亮出${count}张牌。`,`Berry Harvest revealed ${count} card(s).`);
  }
  openDefense(room,ctx);
}
function showEventTransfer(room,resolution,targetId,object,itemType) {
  visualEvent(room,'event-action',{
    sourceId:resolution.actorPlayerId,targetIds:[targetId],
    name:resolution.eventName,effect:resolution.eventType,
    action:resolution.eventType==='farfetchd-prank'?'discard':'take',object,
    ...(itemType?{itemType}:{}),
  });
}
function mewBlessingChoices(target) {
  return [...((target.damage||0)>0||target.level>=3?['heal']:[]),...(target.level<3?['evolve']:[])];
}
function openEventTarget(room,ctx) {
  const resolution=room.resolution;
  while(resolution.index<resolution.targetIds.length) {
    const owner=trainer(room,resolution.targetIds[resolution.index]),target=owner?.active;
    if(owner&&!owner.eliminated&&target&&!target.defeated&&target.instanceId===resolution.targetInstances[owner.id]&&currentHp(target,ctx.catalogue)>0) {
      resolution.targetCreatureId=target.instanceId;
      delete resolution.incomingDamage;delete resolution.modifierState;delete resolution.receivingEffects;delete resolution.helmetCardId;
      resolution.actualDamage=0;resolution.sourceAfterDone=false;resolution.sourceItemAfterDone=false;resolution.staticDone=false;delete resolution.lifeOrbRecoil;
      if(!battleEventTargetAllowed(room,target,resolution.eventName.zh)){resolution.index++;continue;}
      if(resolution.eventType==='mew-blessing'&&target.level>=3&&!(target.damage>0)){resolution.index++;continue;}
      if(resolution.eventType==='berry-harvest'&&!resolution.berryCards.length)break;
      if(room.scenario?.articunoReactions===true&&resolution.protectionCheckedIndex!==resolution.index) {
        resolution.protectionCheckedIndex=resolution.index;
        if(startProtectionWindow(room,ctx,{mode:'cancel-event',targetId:owner.id,targetCreatureId:target.instanceId,eventName:resolution.eventName,eventCardId:resolution.card.id,eventIndex:resolution.index}))return;
      }
      if (hoennDelayedEvents[resolution.eventType]) {
        (owner.delayedEvents ??= []).push(resolution.card);
        resolution.card = null;
        note(room, `${resolution.eventName.zh}挂在${owner.nickname}的席位。`, `${resolution.eventName.en} was placed at ${owner.nickname}’s seat.`);
        return nextSettlement(room, ctx);
      }
      const field = hoennEvents[resolution.eventType]?.field;
      if (field) {
        const { itemType, name } = fieldWeathers[field];
        const rounds = activeItemIs(room, target, itemType) ? 2 : 1;
        room.fieldWeather = { kind: field, expiresAtTurn: room.turn.number + live(room).length * rounds };
        note(room, `场上出现${name.zh}，持续${rounds}轮。`, `${name.en} set field weather for ${rounds} round(s).`);
        return nextSettlement(room, ctx);
      }
      if (resolution.eventType === 'tour-supply') {
        drawBattleCards(room,owner,Math.min(2,room.drawPile.length+room.discardPile.length),'tour-supply');
        return nextSettlement(room,ctx);
      }
      if (resolution.eventType === 'tour-search') {
        if (owner.hand.length) {
          const actor = trainer(room,resolution.actorPlayerId);
          gainBattleCards(room,actor,owner.hand.splice(randomInt(owner.hand.length),1),{reason:'tour-search'});
          note(room,'火箭队搜查取得了一张手牌。','Rocket Search took one hand card.');
        }
        return nextSettlement(room,ctx);
      }
      if (resolution.eventType === 'tour-clinic') { heal(target,1,ctx.catalogue); return nextSettlement(room,ctx); }
      if (resolution.eventType === 'tour-gift') {
        const actor = trainer(room,resolution.actorPlayerId);
        if (!actor.hand.length) return nextSettlement(room,ctx);
        return tourDecision(room,actor,resolution.eventName,actor.hand.map(tourCardOption),{kind:'gift',recipientId:owner.id},ctx);
      }
      if(resolution.eventType==='zapdos-punishment')return startJudgment(room,ctx,{kind:'zapdos',targetId:target.instanceId},owner.id);
      if(resolution.eventType==='jigglypuff-performance')return startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'sleep',weather:'thunderstorm',comparison:'not',next:'settlement'},owner.id);
      if(resolution.eventType==='rival-challenge') {
        decision(room,'rival-command',owner.id,resolution.actorPlayerId,ctx);
        return;
      }
      if(resolution.eventType==='berry-harvest') {
        decision(room,'berry-pick',owner.id,owner.id,ctx);
        return;
      }
      if(resolution.eventType==='mr-mime-trick'||resolution.eventType==='farfetchd-prank') {
        const actor=trainer(room,resolution.actorPlayerId);
        const discard=resolution.eventType==='farfetchd-prank';
        if(resolution.eventEffect==='hand') {
          if(!owner.hand.length)return nextSettlement(room,ctx);
          resolution.handChoiceIds=shuffled(owner.hand.map(card=>card.id));
          decision(room,'event-hand',actor.id,owner.id,ctx);
          Object.assign(room.pendingBattle,{eventName:resolution.eventName,eventType:resolution.eventType});
          return;
        }
        if(resolution.eventEffect!=='item') {
          const index=target.reinforcements?.indexOf(resolution.eventEffect)??-1;
          if(index>=0) {
            target.reinforcements.splice(index,1);
            if (resolution.eventEffect === 'defense') delete target.hoennClayDefense;
            showEventTransfer(room,resolution,owner.id,'marker');
            note(room,'大葱鸭的恶作剧弃置一枚强化指示物。','Farfetch’d’s Prank discarded one reinforcement marker.');
          }
          return nextSettlement(room,ctx);
        }
        const item=target.item;
        if(!item)return nextSettlement(room,ctx);
        delete target.item;
        showEventTransfer(room,resolution,owner.id,'item',item.itemType);
        if(discard) {
          room.discardPile.push(item);
          note(room,'大葱鸭的恶作剧弃置目标的持有物。','Farfetch’d’s Prank discarded the target’s held item.');
        }else {
          gainBattleCards(room,actor,[item],{reason:'take'});
          note(room,'魔墙人偶的戏法获得持有物并加入手牌。','Mr. Mime’s Trick took the held item into the actor’s hand.');
        }
        if(target.catalogueId==='mankey'&&battleTraitsEffective(room,target)) {
          decision(room,'defiant',owner.id,owner.id,ctx);room.pendingBattle.trait='defiant';room.pendingBattle.canTrait=true;return;
        }
        return nextSettlement(room,ctx);
      }
      decision(room,resolution.eventType==='moltres-trial'?'event-command':resolution.eventType==='mewtwo-threat'?'event-dodge':'mew-blessing',owner.id,owner.id,ctx);
      Object.assign(room.pendingBattle,{eventType:resolution.eventType,eventName:resolution.eventName,targetCreatureId:target.instanceId,...(resolution.externalSource?{damage:2,source:resolution.externalSource}:{choices:mewBlessingChoices(target)})});
      return;
    }
    resolution.index++;
  }
  finishResolution(room,ctx);
}
function settleEventDamage(room,ctx,base=2) {
  const resolution=room.resolution;
  const target=creature(room,resolution.targetCreatureId);
  const source=creature(room,resolution.sourceId);
  const amount=damageImmune(room,target)?0:computeDamage(source,target,base,ctx.catalogue,damageOptions(room,source,target,{command:false,channel:'event',receiving:false}));
  if (resolution.externalSource && amount>0) {
    visualEvent(room,'attack',{targetIds:[resolution.targetIds[resolution.index]],
      name:resolution.eventName,effect:resolution.eventType,external:true});
  }
  settleDealtDamage(room,ctx,amount);
}
function respondRivalChallenge(room,player,input,ctx) {
  const resolution=room.resolution;
  const challenger=trainer(room,resolution?.actorPlayerId);
  const opponent=trainer(room,resolution?.targetIds?.[0]);
  const isOriginal=(seat,instanceId)=>seat&&!seat.eliminated&&seat.active&&!seat.active.defeated&&
    seat.active.instanceId===instanceId&&currentHp(seat.active,ctx.catalogue)>0;
  requireRule(resolution?.eventType==='rival-challenge'&&isOriginal(challenger,resolution.actorCreatureId)&&
    isOriginal(opponent,resolution.targetInstances[opponent?.id])&&[challenger,opponent].includes(player),
    'STALE_DECISION','The duel participants changed.');
  requireRule(Object.keys(input).every(key=>['id','revision','type','decisionId','choice','cardId'].includes(key))&&
    ['command','pass'].includes(input.choice)&&(input.choice!=='pass'||input.cardId===undefined),
    'INVALID_RESPONSE','Play one actual command card or pass.');
  const other=player===challenger?opponent:challenger;
  if(input.choice==='command') {
    const index=player.hand.findIndex(card=>card.id===input.cardId&&card.kind==='command');
    requireRule(typeof input.cardId==='string'&&index>=0,'INVALID_CARD','Choose an actual command card from your hand.');
    room.discardPile.push(...player.hand.splice(index,1));
    visualEvent(room,'event-action',{sourceId:player.id,targetIds:[other.id],
      name:resolution.eventName,effect:resolution.eventType,action:'challenge'});
    note(room,'一名训练家打出接招吧！，由另一方继续响应。','A trainer played a command. The other trainer responds next.');
    decision(room,'rival-command',other.id,player.id,ctx);
    return;
  }
  // After a pass, the other trainer is either the challenger on the opening response or the last to play a command.
  resolution.sourceId=other.active.instanceId;
  resolution.sourcePlayerId=other.id;
  resolution.targetCreatureId=player.active.instanceId;
  room.pendingBattle=null;
  if (!damageImmune(room,player.active)) {
    visualEvent(room,'event-action',{sourceId:other.id,targetIds:[player.id],
      name:resolution.eventName,effect:resolution.eventType,action:'duel-strike'});
  }
  return settleEventDamage(room,ctx);
}
export function useBattleTool(room,player,input,ctx) {
  const legal=previewActions(room,player,ctx.catalogue);
  requireRule(room.turn?.playerId===player.id&&room.turn.phase==='play'&&legal&&!room.pendingBattle&&!room.pendingVote,'TOOL_UNAVAILABLE','Tools require your unblocked Play phase.');
  const card=player.hand.find(card=>card.id===input.cardId&&card.kind==='tool');
  const choice=legal.tools.find(tool=>tool.toolType===card?.toolType&&(!tool.cardId||tool.cardId===card.id))?.choices.find(choice=>choice.effect===input.effect);
  requireRule(card&&choice&&!choice.unavailableReason,'INVALID_CARD','Choose a reviewed effect of a physical split tool in your own hand.');
  requireRule(choice.targets.some(target=>target.targetId===input.targetId&&target.slot===input.slot),'INVALID_TARGET','Choose a legal target for this tool.');
  const owner=trainer(room,input.targetId);
  player.hand.splice(player.hand.indexOf(card),1);
  if (input.effect.startsWith('tour-')) return useTourTool(room,player,input,card,ctx);
  let drawn=0;
  if(input.effect==='nugget') {
    // The used card stays outside both piles until the effect and any Pickup
    // finish. An exhausted finite fixture supplies only available real cards.
    drawn=Math.min(2,room.drawPile.length+room.discardPile.length);
    drawBattleCards(room,owner,drawn,'nugget');
  } else {
    const pokemon=owner[input.slot];
    if(input.slot==='reserve' && !input.effect.startsWith('hoenn-'))pokemon.revealed=true;
    if(input.effect==='hoenn-lum')pokemon.status=null;
    else if(input.effect==='hoenn-umbrella')pokemon.hoennUmbrella=true;
    else if(input.effect==='potion')heal(pokemon,2,ctx.catalogue);
    else if(input.effect==='full-heal')pokemon.status=null;
    else if(input.effect==='rare-candy')pokemon.level++;
    else if(input.effect==='revive') {
      pokemon.damage=Math.max(0,maxHp(pokemon,ctx.catalogue)-2);
      pokemon.defeated=false;
    }else {
      pokemon.reinforcements??=[];
      pokemon.reinforcements.push(input.effect);
    }
  }
  room.discardPile.push(card);
  if(input.effect==='hoenn-lum')note(room,'木子果解除了使用者后备的异常状态。','Lum Berry cured the user’s reserve status.');
  else if(input.effect==='hoenn-umbrella')note(room,'万能伞将抵消一次气象球的天气增伤。','Utility Umbrella will cancel the weather bonus on one Weather Ball.');
  else if(input.effect==='potion')note(room,'伤药回复目标至多2点体力；整张组合道具牌已弃置。','Potion restored up to 2 HP; the entire split tool was discarded.');
  else if(input.effect==='nugget')note(room,`金珠令目标训练家摸了${drawn}张牌；整张组合道具牌已弃置。`,`Nugget let the target trainer draw ${drawn} card${drawn===1?'':'s'}; the entire split tool was discarded.`);
  else if(input.effect==='revive')note(room,'活力碎片恢复目标的战斗能力，体力回复至2点。','Revive restored the defeated Pokémon to fighting condition at 2 HP.');
  else if(Object.hasOwn(reinforcementNames,input.effect)) {
    const name=reinforcementNames[input.effect];
    note(room,`目标宝可梦获得一枚${name.zh}指示物。`,`The target Pokémon gained one ${name.en} marker.`);
  }
  else note(room,input.effect==='full-heal'?'使用万灵药恢复目标的特殊状态；整张组合道具牌已弃置。':'使用神奇糖果使目标提升一个等级；整张组合道具牌已弃置。',input.effect==='full-heal'?'Full Heal cured the target’s special status; the entire split tool was discarded.':'Rare Candy raised the target by one level; the entire split tool was discarded.');
}
export function activeFieldWeather(room) {
  if (room.status !== 'playing') return null;
  const forecast = room.scenario?.weatherLab?.forecast;
  return room.fieldWeather ?? (forecast ? {kind:forecast,source:'weather-lab'} : null);
}
function weatherBallWeather(room, pokemon) {
  return pokemon.catalogueId === 'hoenn-castform' && battleTraitsEffective(room, pokemon) ? activeFieldWeather(room)?.kind : undefined;
}
function castformWeather(room, pokemon) {
  const weather = weatherBallWeather(room, pokemon);
  return weather === 'sand' ? undefined : weather;
}
function battleMoves(room,pokemon,catalogue) {
  const native=face(pokemon,catalogue)?.moves||[];
  const field = weatherBallWeather(room, pokemon);
  if (field) {
    return native.map(move => move.effectKind === 'hoenn-weather-ball'
      ? { ...move, printedValue: 2, condition: { ...move.condition, weatherIconsInCondition: fieldWeathers[field].icons } }
      : move);
  }
  if(pokemon.catalogueId!=='scyther'||!battleTraitsEffective(room,pokemon))return native;
  return [...native,...catalogue.entries.find(entry=>entry.id==='scyther').levels.filter(level=>level.level<pokemon.level).sort((a,b)=>a.level-b.level).flatMap(level=>level.moves)];
}
function hasUsedDamagingMove(turn,player,catalogue) {
  if (turn.damagingMoveUsed || !turn.usedMoves?.length) return Boolean(turn.damagingMoveUsed);
  // Older room saves recorded move names but did not track the first damaging move.
  return [player.active,player.reserve].some(pokemon=>pokemon && catalogue.entries
    .find(entry=>entry.id===pokemon.catalogueId)?.levels.some(level=>level.moves?.some(move=>
      move.printedValue>0 && turn.usedMoves?.includes(`${pokemon.instanceId}:${move.name.zh}`))));
}
function moveOptions(room,player,catalogue,own,quickTargetId=null) {
  const pokemon=player.active;
  const used = room.turn?.usedMoves || [];
  const unlocked = quickTargetId || !room.turn.commandCreatureId || room.turn.commandCreatureId === pokemon.instanceId;
  const ignoresReinforcements=pokemon.catalogueId==='dratini' && pokemon.level>=2;
  const ownNincadaTurn = own && !quickTargetId && pokemon.catalogueId===NINCADA_ID && battleTraitsEffective(room,pokemon);
  const speedBoostAvailable = ownNincadaTurn && pokemon.level===3 && !hasUsedDamagingMove(room.turn,player,catalogue);
  const targetsFor=(ignoreDistance,distance)=>eligibleTargetIds(room.players,player.id,{distance,ignoreDistance:ignoreDistance||player.raidBoss||activeItemIs(room,pokemon,'quick-claw')||hasSniper(room,player)||room.turn.rangeCreatureId===pokemon.instanceId||room.turn.swiftSwimCreatureIds?.includes(pokemon.instanceId)||(!ignoresReinforcements&&battleReinforcementEffective(room,pokemon,'speed'))}).filter(id=>face(trainer(room,id).active,catalogue)?.effectStatus==='combat-preview');
  const teleport=pokemon.catalogueId==='abra' && pokemon.level===1;
  const teleportBlocked=teleport && !quickTargetId && room.turn.switchBlocked && player.reserve && !player.reserve.defeated;
  const moveAvailable=Boolean(own && face(pokemon,catalogue)?.effectStatus==='combat-preview' && !room.turn.movesBlocked && !(room.turn.blockedMoveIds||[]).includes(pokemon.instanceId));
  return battleMoves(room,pokemon,catalogue).map((item,index)=>{
    const command=item.condition?.kind==='command';
    const charm=item.effectKind==='discard-other-hand',dew=item.effectKind==='life-dew';
    const supported=command||(item.condition?.kind==='weather-card'&&weatherMoveEffects.has(item.effectKind)&&item.condition.weatherIconsInCondition?.length>0);
    const speedBoost = speedBoostAvailable && item.printedValue>0;
    const compoundEyes = ownNincadaTurn && pokemon.level<3 && item.name.en==='Scratch' && !used.includes(`${pokemon.instanceId}:${item.name.zh}`);
    const scarfRange = command && activeItemIs(room,pokemon,'tour-scarf') ? 2 : 1;
    const distance = scarfRange + Number(speedBoost);
    const targets=!own?[]:(teleport||item.targeting?.kind==='self'?[player.id]:targetsFor(item.targeting?.ignoresDistance===true,distance).filter(id=>!charm||(id!==player.id&&trainer(room,id).hand.length>0)));
    const boss=room.scenario?.lake && trainer(room,room.scenario.lake.bossId);
    if (own && boss?.active && !boss.eliminated && !boss.active.defeated && !player.raidBoss &&
        item.printedValue>0 && item.targeting?.kind!=='self' && !targets.includes(boss.id)) targets.push(boss.id);
    const scarfKey = room.turn.tourCommandMoves?.[pokemon.instanceId];
    const scarfAllowed = !command || !activeItemIs(room,pokemon,'tour-scarf') || !scarfKey || scarfKey===item.name.zh;
    const legalTargetIds=own?(quickTargetId?targets.filter(id=>id===quickTargetId):targets):[];
    return {index,name:item.name,condition:item.condition,printedValue:item.printedValue,effectKind:item.effectKind||null,...(speedBoost?{speedBoost:true}:{}),...(compoundEyes?{compoundEyes:true}:{}),...(charm?{targeting:'trainer'}:{}),cannotDodge:ignoresReinforcements,ignoresReinforcements,maxTargets:dew?live(room).length:item.targeting?.max||1,legalTargetIds,canUse:Boolean(moveAvailable&&supported&&scarfAllowed&&(!quickTargetId||(command&&legalTargetIds.length))&&(!charm||legalTargetIds.length)&&(!command||(!teleportBlocked&&unlocked))&&((pokemon.catalogueId==='shellder'&&battleTraitsEffective(room,pokemon))||item.uses?.unlimited===true||!used.includes(`${pokemon.instanceId}:${item.name.zh}`)))};
  });
}
export function canChooseShedinja(room,pokemon) {
  return hasPack(room.settings?.contentPack,HOENN_PACK) && pokemon?.catalogueId===NINCADA_ID &&
    pokemon.level===2 && !pokemon.defeated && !pokemon.damage;
}
export function previewActions(room, player, catalogue) {
  if (room.status !== 'playing' || player.spectator || player.eliminated || !player.active) return null;
  const own = room.turn?.playerId === player.id && room.turn.phase === 'play' && !room.pendingBattle && !room.pendingVote;
  const pokemon = player.active;
  const move = face(pokemon, catalogue)?.moves?.[0];
  const illusionDecoyId = own && battleTraitsEffective(room,pokemon) &&
    player.hand.some(card=>card.id===pokemon.illusionDecoyId) ? pokemon.illusionDecoyId : null;
  const endTarget = room.turn.tourLevelTarget ? creature(room,room.turn.tourLevelTarget) : pokemon;
  const shedinjaEvolution = room.turn.playerId===player.id && room.turn.phase==='end' && !room.turn.tourLevelUsed &&
    !room.pendingBattle && canChooseShedinja(room,endTarget);
  const traitUsed = (room.turn.traitsUsed || []).includes(pokemon.instanceId);
  const moves=moveOptions(room,player,catalogue,own);
  const canCommand=Boolean(move?.condition?.kind==='command'&&moves[0]?.canUse);
  const giveRecipientIds = live(room).filter(p=>p.id!==player.id).map(p=>p.id);
  // A virtual command has no printed sunny weather, so it cannot meet paralysis.
  const giveCommandAvailable = canCommand && pokemon.status!=='paralysis';
  const canGive = own && face(pokemon,catalogue)?.effectStatus==='combat-preview' && pokemon.catalogueId==='growlithe' && battleTraitsEffective(room,pokemon) && !room.turn.justifiedUsed && giveRecipientIds.length>0 && (player.hand.length>1 || (player.hand.length===1 && giveCommandAvailable));
  return { ...(shedinjaEvolution?{shedinjaEvolution:true}:{}), ...(illusionDecoyId?{illusionDecoyId}:{}), tourActions:tourActions(room,player,catalogue), events:eventActions(room,player,own), tools:toolActions(room,player,catalogue,own), canEquip:Boolean(own&&player.hand.some(reviewedItem)), equipItems:equipItems(player), muscleBand:Boolean(own&&player.hand.length>=2&&pokemon.status!=='paralysis'&&activeItemIs(room,pokemon,'muscle-band')), lightBallTargets:own&&activeItemIs(room,pokemon,'light-ball')?lightBallTargets(room,catalogue):[], equipSlots:own?['active','reserve'].filter(slot=>player[slot]&&!player[slot].defeated):[], moves, canCommand, canGive:Boolean(canGive), giveCommandAvailable, giveRecipientIds:own?giveRecipientIds:[], canSwitch: Boolean(own && !room.turn.switchUsed && !room.turn.switchBlocked && player.reserve && !player.reserve.defeated && (!room.turn.hoennRoadblocked || player.hand.length)), canTrait: Boolean(face(pokemon,catalogue)?.effectStatus==='combat-preview'&&battleTraitsEffective(room,pokemon)&&!room.pendingBattle && !room.pendingVote && !traitUsed && room.turn.playerId === player.id && ((['bulbasaur','magnemite','rhyhorn'].includes(pokemon.catalogueId) && room.turn.phase === 'play') || (pokemon.catalogueId==='psyduck'&&room.turn.phase==='play'&&!room.turn.swiftSwimUsed) || (pokemon.catalogueId==='staryu'&&room.turn.phase==='draw'&&!room.turnStart) || (['electabuzz','porygon'].includes(pokemon.catalogueId)&&room.turn.phase==='draw'&&room.turn.drawRemaining>0&&room.turn.drawStarted===false&&!room.turnStart) || (['squirtle','exeggcute'].includes(pokemon.catalogueId) && room.turn.phase === 'end'))), ...(pokemon.catalogueId==='porygon'?{trait:{kind:'download',name:{zh:'下载',en:'Download'}}}:pokemon.catalogueId==='electabuzz'?{trait:{kind:'vital-spirit',name:{zh:'干劲',en:'Vital Spirit'}}}:pokemon.catalogueId==='staryu'?{trait:{kind:'illuminate',name:{zh:'发光',en:'Illuminate'}}}:pokemon.catalogueId==='rhyhorn'?{trait:{kind:'reckless',name:{zh:'舍身',en:'Reckless'},maxHpLoss:Number.MAX_SAFE_INTEGER-(pokemon.damage||0)}}:pokemon.catalogueId==='magnemite'?{trait:{kind:'analytic',name:{zh:'分析',en:'Analytic'},maxCards:Math.min(player.hand.length,Math.max(0,currentHp(pokemon,catalogue)))}}:pokemon.catalogueId==='exeggcute'?{trait:{kind:'harvest',name:{zh:'收获',en:'Harvest'}}}:{}),legalTargetIds:moves[0]?.legalTargetIds||[], move: move ? { name: move.name, printedValue: move.printedValue, maxTargets:moves[0].maxTargets } : null };
}
export function playBattleMove(room, player, input, ctx, quickTargetId=null) {
  const legal=quickTargetId?{moves:moveOptions(room,player,ctx.catalogue,true,quickTargetId)}:previewActions(room,player,ctx.catalogue);
  const index=input.moveIndex===undefined?0:input.moveIndex;
  requireRule(Number.isSafeInteger(index)&&index>=0 && legal?.moves?.[index]?.canUse,'MOVE_UNAVAILABLE','This Pokémon cannot use the selected move now.');
  const move=legal.moves[index],command=move.condition.kind==='command';
  requireRule(move.effectKind==='moonlight'?['heal','cure'].includes(input.effectChoice):move.effectKind==='x-scissor'?[undefined,'normal','double-dodge'].includes(input.effectChoice):input.effectChoice===undefined,'INVALID_MOVE_CHOICE','Choose a printed effect of this move only.');
  const muscle=input.cardIds!==undefined;
  const selected=player.hand.find(card=>card.id===input.cardId);
  const decoy = command && move.printedValue>0 && !quickTargetId && selected?.kind!=='command' &&
    selected?.id && selected.id===legal.illusionDecoyId;
  const coordinating=input.coordinationCardIds!==undefined;
  const coordinationCards=coordinating&&Array.isArray(input.coordinationCardIds) ?
    input.coordinationCardIds.map(id=>player.hand.find(card=>card.id===id)) : [];
  if (coordinating) {
    requireRule(!quickTargetId && !muscle && hasPack(room.settings.contentPack,HOENN_PACK) && canCoordinateCommand(move,selected) &&
      coordinationCards.length===2 && coordinationCards.every(card=>card && card!==selected) &&
      coordinationCards[0].weather!==coordinationCards[1].weather,
      'INVALID_CARD','Choose a coordinated command and two other cards of different weather.');
  }
  const maximum=move.maxTargets+Number(coordinating);
  requireRule(Array.isArray(input.targetIds)&&input.targetIds.length>=(coordinating?maximum:1)&&input.targetIds.length<=maximum&&
    new Set(input.targetIds).size===input.targetIds.length&&input.targetIds.every(id=>move.legalTargetIds.includes(id)),
    'INVALID_TARGET','Choose legal active Pokémon within range.');
  if(muscle) {
    requireRule(command&&!quickTargetId&&input.cardId===undefined&&legal.muscleBand&&Array.isArray(input.cardIds)&&input.cardIds.length===2&&
      new Set(input.cardIds).size===2&&input.cardIds.every(id=>typeof id==='string'&&player.hand.some(card=>card.id===id)),
      'INVALID_CARD','Choose two distinct own hand cards with Muscle Band.');
  }else {
    requireRule(selected && (command?(selected.kind==='command'||decoy):move.condition.weatherIconsInCondition.includes(selected.weather)),'INVALID_CARD','Choose one qualifying card from your own hand.');
    requireRule(!(quickTargetId||(command&&player.active.status==='paralysis'))||['intense-sun','clear'].includes(selected.weather),'INVALID_CARD','Choose a sunny-weather command card.');
  }
  const hyperBeam=command&&move.effectKind==='hyper-beam';
  requireRule(hyperBeam||move.compoundEyes||input.boostCardId===undefined,'INVALID_CARD','This move does not accept an additional discard.');
  const boost=input.boostCardId===undefined?null:player.hand.find(card=>card.id===input.boostCardId);
  requireRule(input.boostCardId===undefined||(boost&&boost!==selected&&!input.cardIds?.includes(boost.id)&&!coordinationCards.includes(boost)),'INVALID_CARD','Choose a different card from your own hand for the additional discard.');
  const usedCompoundEyes=Boolean(move.compoundEyes&&boost);
  const doubleDodge=move.effectKind==='x-scissor'&&input.effectChoice==='double-dodge';
  requireRule(!doubleDodge||player.active.reinforcements.includes('power'),'INVALID_MOVE_CHOICE','X-Scissor must discard one carried Power marker to require two Dodges.');
  if(doubleDodge)player.active.reinforcements.splice(player.active.reinforcements.indexOf('power'),1);
  if(boost)room.discardPile.push(...player.hand.splice(player.hand.indexOf(boost),1));
  if (coordinating) {
    player.hand=player.hand.filter(card=>!coordinationCards.includes(card));
    room.discardPile.push(...coordinationCards);
    note(room,'合力指挥弃置两张不同天气的手牌，增加了一个目标。','Coordinated Command discarded two cards of different weather for one extra target.');
  }
  if(muscle) {
    const paid=new Set(input.cardIds);
    room.discardPile.push(...player.hand.filter(card=>paid.has(card.id)));
    player.hand=player.hand.filter(card=>!paid.has(card.id));
  }else {
    player.hand.splice(player.hand.indexOf(selected),1);
    if(!command||decoy)room.discardPile.push(selected);
    if(decoy) delete player.active.illusionDecoyId;
  }
  if (!command && selected?.weather==='thunderstorm' && player.active.catalogueId==='tour-mareep' && battleTraitsEffective(room,player.active) && !room.turn.tourCharge) {
    room.turn.tourCharge=true;
    if(!player.active.reinforcements.includes('speed'))player.active.reinforcements.push('speed');
  }
  const field = activeFieldWeather(room)?.kind;
  const weather = fieldWeathers[field];
  const ball = move.effectKind === 'hoenn-weather-ball';
  const matchesWeather = ball ? weatherBallWeather(room, player.active) === field
    : field === 'sand' ? sandObservationMoves.has(move.name.en)
    : moveRecipe(move.name.en)?.family === weather?.moveFamily;
  if (weather && selected && move.printedValue > 0 && matchesWeather && weather.icons.includes(selected.weather)) {
    room.turn.hoennObservedWeather = field;
  }
  beginBattleMove(room,player,input.targetIds,command&&!muscle&&!decoy?selected:null,{...legal,move,muscle,decoy,quickTargetId,damageBoost:hyperBeam&&boost?1:0,usedCompoundEyes,effectChoice:input.effectChoice,dodgesRequired:doubleDodge||usedCompoundEyes?2:1},ctx,command);
}
function beginBattleMove(room,player,targetIds,command,legal,ctx,isCommand=true) {
  revealIllusion(room,player,ctx);
  const source = player.active;
  if(isCommand&&!legal.quickTargetId)room.turn.commandCreatureId = source.instanceId;
  room.turn.usedMoves ??= [];
  const moveUse = `${source.instanceId}:${legal.move.name.zh}`;
  if(battleTraitsEffective(room,source)) {
    if(source.catalogueId==='shellder' && room.turn.usedMoves.includes(moveUse)) abilityVisual(room,player,ctx.catalogue);
    if(source.catalogueId==='scyther' && !face(source,ctx.catalogue)?.moves.some(move=>move.name.en===legal.move.name.en)) {
      abilityVisual(room,player,ctx.catalogue);
    }
  }
  room.turn.usedMoves.push(moveUse);
  if (room.turn.playerId===player.id && legal.move.printedValue>0 && hasPack(room.settings.contentPack,HOENN_PACK)) room.turn.damagingMoveUsed=true;
  if (legal.usedCompoundEyes) {
    abilityVisual(room,player,ctx.catalogue,{targetIds});
    note(room,'复眼额外弃置一张手牌，每个目标需要两次躲闪。','Compound Eyes discarded an extra hand card. Each target needs two Dodges.');
  }
  if (legal.move.speedBoost) {
    abilityVisual(room,player,ctx.catalogue,{targetIds});
    note(room,'加速使本回合第一个伤害招式的距离上限加 1。','Speed Boost added 1 range to the first damaging move this turn.');
  }
  if (isCommand) {
    room.turn.tourCommandMoves ??= {};
    room.turn.tourCommandMoves[source.instanceId] ??= legal.move.name.zh;
  }
  const signalBoost=Number(Boolean(player.raidBoss && room.scenario.lake.transmitter && room.turn.playerId===player.id &&
    !room.turn.lakePulseUsed && legal.move.printedValue>0));
  if (signalBoost) {
    room.turn.lakePulseUsed=true;
    note(room,'电波装置为暴鲤龙的首个伤害招式增加 1 点基础伤害。','The transmitter added 1 base damage to Gyarados’s first damaging move.');
  }
  room.resolution = { kind: 'move', card: command, virtualCommand:isCommand&&!command, statusMove:!isCommand&&legal.move.effectKind!=='hoenn-weather-ball', moveIndex:legal.move.index??0,effectKind:legal.move.effectKind||null, ignoresReinforcements:source.catalogueId==='dratini'&&source.level>=2, sourceId: source.instanceId, sourcePlayerId: player.id, sourceLevel: source.level, sourceFamily: source.catalogueId, moveName:legal.move.name, baseDamage: (legal.move.printedValue??0)+(legal.damageBoost||0)+signalBoost, powerBoost: isCommand&&!reinforcementsSuppressed(room,source)?beginCommand(source):0, targetIds: [...targetIds], index: 0, damagedIds: [], defenseIds: [] };
  if (targetIds.length===1 && legal.move.maxTargets===1 && room.resolution.baseDamage>0 && !room.resolution.statusMove) {
    const range = legal.move.legalTargetIds ?? legal.legalTargetIds;
    if (tourEnabled(room) && room.settings.matchMode==='teams') room.resolution.followMeRange = [...range];
    if (room.scenario?.viridian?.guard && room.scenario.viridian.leaderRevealed) room.resolution.gymGuardRange = [...range];
  }
  if(legal.move.effectKind==='hoenn-weather-ball') room.resolution.weatherBallForm = weatherBallWeather(room, source) ?? 'normal';
  if(legal.effectChoice)room.resolution.effectChoice=legal.effectChoice;
  if(legal.dodgesRequired===2)room.resolution.dodgesRequired=2;
  const camera = {camera:effectCamera(room,room.resolution)};
  if(!isCommand)note(room,`弃置一张符合天气的手牌使用${legal.move.name.zh}；目标正在决定响应。`,`One qualifying weather hand card was discarded to use ${legal.move.name.en}; the target is deciding a response.`,camera);
  else if(legal.muscle)note(room,'力量头带将两张手牌当接招吧！使用。','Muscle Band used two hand cards as one Take this! command.',camera);
  else if(legal.decoy)note(room,'诱饵作为本次招式的指挥费用弃置。','The decoy was discarded as the command payment for this move.',camera);
  else if(legal.quickTargetId)note(room,'先制之爪在其他训练家的回合开始时使用接招吧！。','Quick Claw used a command at another trainer’s turn start.',camera);
  else note(room, command?'当前玩家使用接招吧！；目标正在决定响应。':'正义之心视为使用接招吧！；目标正在决定响应。', command?'The current trainer used Take this!; the target is deciding a response.':'Justified counted as using Take this!; the target is deciding a response.',camera);
  if(isCommand&&source.catalogueId==='magikarp'&&source.level>=2&&battleTraitsEffective(room,source)) {
    abilityVisual(room,player,ctx.catalogue);
    if(room.drawPile.length+room.discardPile.length)drawBattleCards(room,player,1,'moxie');
    else note(room,'自信过度已触发，但当前没有可摸取的牌。','Moxie triggered, but no card is currently available to draw.');
  }
  advanceCommandTargets(room,ctx);
}
export function giveBattleCards(room,player,input,ctx) {
  const legal=previewActions(room,player,ctx.catalogue);
  requireRule(legal?.canGive,'TRAIT_UNAVAILABLE','Justified is unavailable now.');
  requireRule(legal.giveRecipientIds.includes(input.recipientId),'INVALID_RECIPIENT','Give cards to one other living trainer.');
  requireRule(Array.isArray(input.cardIds) && input.cardIds.length>0 && new Set(input.cardIds).size===input.cardIds.length && input.cardIds.every(id=>typeof id==='string' && player.hand.some(card=>card.id===id)),'INVALID_CARD','Choose distinct cards from your own hand.');
  const all=input.cardIds.length===player.hand.length;
  if(all) {
    requireRule(legal.giveCommandAvailable,'MOVE_UNAVAILABLE','An all-hand gift requires an available command move.');
    requireRule(Array.isArray(input.targetIds) && input.targetIds.length>0 && input.targetIds.length<=legal.move.maxTargets && new Set(input.targetIds).size===input.targetIds.length && input.targetIds.every(id=>legal.legalTargetIds.includes(id)),'INVALID_TARGET','Choose legal targets for the Justified command move.');
  }else requireRule(input.targetIds===undefined,'INVALID_TARGET','Only an all-hand gift performs a command move.');
  const selected=new Set(input.cardIds),cards=player.hand.filter(card=>selected.has(card.id));
  player.hand=player.hand.filter(card=>!selected.has(card.id));
  gainBattleCards(room,trainer(room,input.recipientId),cards,{reason:'gift'});room.turn.justifiedUsed=true;
  abilityVisual(room,player,ctx.catalogue,{targetIds:[input.recipientId]});
  note(room,`正义之心向另一名训练家交给了${cards.length}张手牌。`,`Justified gave ${cards.length} hand card(s) to another trainer.`);
  if(all)beginBattleMove(room,player,input.targetIds,null,legal,ctx);
}
function beginRescue(room, targetId, ctx) {
  if (room.scenario?.lake?.bossId===targetId) return defeat(room,targetId,ctx);
  const index=room.players.findIndex(p=>p.id===room.turn.playerId);
  room.resolution.rescueActors=[...room.players.slice(index),...room.players.slice(0,index)].filter(p=>!p.spectator&&!p.eliminated).map(p=>p.id);
  room.resolution.rescueIndex = 0;
  room.resolution.rescueCreatureId=trainer(room,targetId).active.instanceId;
  room.resolution.rescueActorInstances=Object.fromEntries(room.resolution.rescueActors.map(id=>[id,trainer(room,id).active?.instanceId]));
  note(room, '宝可梦昏厥；从当前回合训练家起依次结算救援。', 'A Pokémon is fainting; rescue starts with the current turn’s trainer.');
  decision(room, 'rescue', room.resolution.rescueActors[0], targetId, ctx);
}
export function intactDisguise(room, pokemon) {
  return pokemon?.catalogueId === MIMIKYU_ID && !pokemon.disguiseSpent && battleTraitsEffective(room, pokemon);
}
function spendDisguise(room, owner, ctx) {
  owner.active.disguiseSpent = true;
  abilityVisual(room, owner, ctx.catalogue);
}
function blockWithDisguise(room, ctx, amount) {
  const resolution = room.resolution;
  if (resolution.kind !== 'move' || amount <= 0) return false;
  const owner = activeOwner(room, resolution.targetCreatureId);
  if (!owner || owner.id === resolution.sourcePlayerId || !intactDisguise(room, owner.active) ||
      amount <= (resolution.dodgeReductions?.[owner.active.instanceId] ?? 0)) return false;
  moveVisual(room, owner.id);
  spendDisguise(room, owner, ctx);
  note(room, '画皮挡下了这次招式伤害，谜拟丘变为现形。', 'Disguise blocked the hit and Mimikyu changed to Busted Form.');
  return true;
}
function settleDamage(room, ctx) {
  const resolution = room.resolution;
  const target = creature(room, resolution.targetCreatureId), source = creature(room, resolution.sourceId);
  if (resolution.baseDamage===0) moveVisual(room,resolution.targetIds[resolution.index]);
  if(resolution.effectKind==='life-dew') {
    if(activeOwner(room,target?.instanceId)&&currentHp(target,ctx.catalogue)>0)heal(target,1,ctx.catalogue);
    note(room,'生命水滴令目标回复至多1点体力。','Life Dew restored up to 1 HP to the target.');
    return nextSettlement(room,ctx);
  }
  if(resolution.effectKind==='discard-other-hand') {
    const owner=trainer(room,resolution.targetIds[resolution.index]);
    if(!owner.hand.length)return nextSettlement(room,ctx);
    resolution.handChoiceIds=shuffled(owner.hand.map(card=>card.id));
    decision(room,'hand',resolution.sourcePlayerId,owner.id,ctx);room.pendingBattle.effect='discard';return;
  }
  if(resolution.effectKind==='lock-on') {
    if(activeOwner(room,target.instanceId)) {
      room.turn.dodgeBlockedCreatureIds??=[];
      if(!room.turn.dodgeBlockedCreatureIds.includes(target.instanceId))room.turn.dodgeBlockedCreatureIds.push(target.instanceId);
      note(room,'锁定令目标宝可梦在本回合内无法使用快躲开！。','Lock-On prevents this Pokémon from using Dodge! for this global turn.');
    }
    return nextSettlement(room,ctx);
  }
  if(resolution.effectKind==='swords-dance') {
    if(activeOwner(room,target.instanceId))target.reinforcements.push('power');
    note(room,'剑舞无视上限获得一枚力量强化。','Swords Dance gained one Power marker, ignoring the normal duplicate limit.');return nextSettlement(room,ctx);
  }
  if(resolution.effectKind==='light-screen') {
    if(activeOwner(room,target.instanceId)&&!target.reinforcements.includes('defense'))target.reinforcements.push('defense');
    return nextSettlement(room,ctx);
  }
  if(resolution.effectKind==='sweet-kiss') {
    const owner=activeOwner(room,target.instanceId);
    if(!owner)return nextSettlement(room,ctx);
    if(owner.hand.length){decision(room,'sweet-kiss',owner.id,owner.id,ctx);room.pendingBattle.requiredCards=Math.min(2,owner.hand.length);return;}
    drawBattleCards(room,owner,Math.min(2,room.drawPile.length+room.discardPile.length),'sweet-kiss');return nextSettlement(room,ctx);
  }
  if(['moonlight','helping-hand'].includes(resolution.effectKind)&&!activeOwner(room,target.instanceId))return nextSettlement(room,ctx);
  if(resolution.effectKind==='moonlight') {
    if(resolution.effectChoice==='heal')heal(target,2,ctx.catalogue);else target.status=null;
    note(room,resolution.effectChoice==='heal'?'月光回复目标2点体力（不超过体力上限）。':'月光使目标恢复特殊状态。',resolution.effectChoice==='heal'?'Moonlight restored up to 2 HP to the target.':'Moonlight cleared the target’s special status.');
    return nextSettlement(room,ctx);
  }
  if(resolution.effectKind==='helping-hand') {
    const owner=activeOwner(room,target.instanceId),count=Math.min(2,room.drawPile.length+room.discardPile.length);
    if(owner)drawBattleCards(room,owner,count,'helping-hand');
    note(room,`帮助使目标训练家摸取${count}张牌。`,`Helping Hand drew ${count} card(s) for the target’s trainer.`);
    return nextSettlement(room,ctx);
  }
  if(resolution.effectKind==='forced-switch') {
    const owner=activeOwner(room,target.instanceId),reserve=owner?.reserve;
    if(reserve&&!reserve.defeated&&currentHp(reserve,ctx.catalogue)>0) {
      return requestBattleSwitch(room,owner,'whirlwind',ctx);
    }else note(room,'目标没有可以登场的备战搭档，吹飞未调换位置。','Whirlwind did not swap partners because the target has no living reserve.');
    return nextSettlement(room,ctx);
  }
  if(resolution.sourceFamily==='magikarp'&&resolution.sourceLevel===1)return nextSettlement(room,ctx);
  if(resolution.effectKind==='sleep-judgment')return startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'sleep',weather:'thunderstorm',comparison:'not',next:'settlement'},resolution.sourcePlayerId);
  if(resolution.effectKind==='paralysis-judgment'&&resolution.statusMove)return startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'paralysis',weather:'intense-sun',comparison:'not',next:'settlement'},resolution.sourcePlayerId);
  if(resolution.effectKind==='self-defense') {
    if(!target.reinforcements.includes('defense'))target.reinforcements.push('defense');
    note(room,`${resolution.moveName.zh}使此宝可梦保有一枚防御强化指示物。`,`${resolution.moveName.en} leaves this Pokémon with one Defense reinforcement.`);
    return nextSettlement(room,ctx);
  }
  if(resolution.effectKind==='temporary-hand-exile') {
    const owner=trainer(room,resolution.targetIds[resolution.index]);
    if(!owner.hand.length)return nextSettlement(room,ctx);
    resolution.handChoiceIds=shuffled(owner.hand.map(card=>card.id));
    decision(room,'exile',resolution.sourcePlayerId,owner.id,ctx);room.pendingBattle.maxCards=Math.min(2,owner.hand.length);return;
  }
  if(resolution.statusMove) {
    return startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'burn',weather:'rain',comparison:'not',next:'settlement'},resolution.sourcePlayerId);
  }
  if(resolution.sourceFamily==='abra' && resolution.sourceLevel===1) {
    const owner=trainer(room,resolution.sourcePlayerId);
    drawBattleCards(room,owner);
    if(owner.reserve && !owner.reserve.defeated) {
      return requestBattleSwitch(room,owner,'teleport',ctx);
    }
    return nextSettlement(room,ctx);
  }
  if (intactDisguise(room, target) && blockWithDisguise(room, ctx, commandDamage(room, source, target, resolution, ctx.catalogue))) {
    return nextSettlement(room, ctx);
  }
  if(resolution.effectKind==='double-edge'&&!resolution.doubleEdgeDecided&&!damageImmune(room,target)&&activeOwner(room,source?.instanceId)) {
    decision(room,'double-edge',resolution.sourcePlayerId,trainer(room,resolution.targetIds[resolution.index]).id,ctx);return;
  }
  if (!resolution.airLockOffered && weatherBallBonus(resolution) &&
      !umbrellaBlocksBonus(target,resolution) && !damageImmune(room,target) && hasPack(room.settings.contentPack,HOENN_PACK)) {
    resolution.airLockOffered = true;
    const owner = activeOwner(room,target.instanceId);
    const cards = owner?.hand.filter(isAirLock);
    if (cards?.length) return tourDecision(room, owner, airLockEvent.name, cards.map(tourCardOption), {kind:'air-lock'}, ctx, true);
  }
  const amount = commandDamage(room, source, target, resolution, ctx.catalogue);
  if (umbrellaBlocksBonus(target, resolution) && !damageImmune(room,target)) {
    delete target.hoennUmbrella;
    note(room,'万能伞抵消了气象球的天气增伤。','Utility Umbrella canceled Weather Ball’s weather bonus.');
  }
  if(amount>0 && source?.status!=='burn' && blazeBonus(source,ctx.catalogue,battleTraitsEffective(room,source))) {
    abilityVisual(room,activeOwner(room,source.instanceId),ctx.catalogue,{effect:'blaze'});
  }
  if(amount>0 && source?.catalogueId==='machop' && source.status && battleTraitsEffective(room,source)) {
    abilityVisual(room,activeOwner(room,source.instanceId),ctx.catalogue);
  }
  return settleDealtDamage(room,ctx,amount);
}

const isAirLock = card => card.kind === 'event' && card.eventType === 'hoenn-air-lock';
function weatherBallBonus(resolution) {
  return resolution.effectKind === 'hoenn-weather-ball' && Boolean(fieldWeathers[resolution.weatherBallForm]);
}
function umbrellaBlocksBonus(target, resolution) {
  return target.hoennUmbrella && weatherBallBonus(resolution);
}
const rockMoves = new Set(['Rock Throw','Rock Slide','Stone Edge']);
const wonderGuardWeaknessFamilies = new Set(['fire','air','spirit','dark']);
function wonderGuardBlocks(room,target,resolution) {
  if (target.catalogueId!==SHEDINJA_ID || !battleTraitsEffective(room,target)) return false;
  if (resolution.effectKind==='hoenn-weather-ball') return !['sun','sand'].includes(resolution.weatherBallForm);
  return !rockMoves.has(resolution.moveName?.en) && resolution.moveName?.en!=='Crunch' &&
    !wonderGuardWeaknessFamilies.has(moveRecipe(resolution.moveName?.en)?.family);
}
function commandDamage(room, source, target, resolution, catalogue) {
  if (wonderGuardBlocks(room,target,resolution)) return 0;
  const printedDamage=resolution.baseDamage-(resolution.airLockApplied||umbrellaBlocksBonus(target,resolution)?1:0)+(resolution.doubleEdgeBoost?1:0)+(resolution.effectKind==='reversal'&&currentHp(target,catalogue)>currentHp(source,catalogue)?1:0)+(resolution.sourceFamily==='gastly'&&resolution.sourceLevel===3&&target.status?1:0)+(resolution.sourceFamily==='nidoran-m'&&resolution.sourceLevel>=2&&(source.damage||0)===0?1:0);
  return damageImmune(room,target)?0:computeDamage(source,target,printedDamage,catalogue,damageOptions(room,source,target,{command:true,powerBoost:resolution.powerBoost,reinforcements:!resolution.ignoresReinforcements,receiving:false}));
}

// AI only. Estimate the current hit before optional responses, without mutating either partner.
export function estimateCommandDamage(room, source, target, move, catalogue, boost = 0) {
  const resolution = move ? {
    baseDamage: move.printedValue + boost, moveName:move.name, effectKind: move.effectKind,
    sourceFamily: source.catalogueId, sourceLevel: source.level,
    weatherBallForm: move.effectKind === 'hoenn-weather-ball' ? weatherBallWeather(room,source) : undefined,
    powerBoost: battleReinforcementEffective(room, source, 'power')
      ? source.reinforcements.filter(marker => marker === 'power').length : 0,
    ignoresReinforcements: move.ignoresReinforcements,
  } : room.resolution;
  const amount = commandDamage(room, source, target, resolution, catalogue);
  return capReceivingDamage(target, amount, damageOptions(room, source, target, {
    reinforcements: !resolution.ignoresReinforcements,
  }));
}
function settleDealtDamage(room,ctx,amount) {
  const resolution=room.resolution;
  const source=activeOwner(room,resolution.sourceId);
  const target=activeOwner(room,resolution.targetCreatureId);
  const burnBlocksBoost=resolution.kind==='move'&&source?.active.status==='burn'&&
    !(source.active.catalogueId==='machop'&&battleTraitsEffective(room,source.active));
  if(amount>0&&source&&target&&!burnBlocksBoost&&activeItemIs(room,source.active,'life-orb')) {
    resolution.lifeOrbOffer={amount,itemId:source.active.item.id};
    decision(room,'life-orb',source.id,target.id,ctx);
    room.pendingBattle.damage=amount;
    return;
  }
  return resolveDealtDamage(room,ctx,amount);
}
function resolveDealtDamage(room,ctx,amount) {
  if (blockWithDisguise(room, ctx, amount)) return nextSettlement(room, ctx);
  const resolution=room.resolution;
  const target=creature(room,resolution.targetCreatureId),source=creature(room,resolution.sourceId);
  const reduction=resolution.dodgeReductions?.[target.instanceId]||0;
  // Older saved Fury Cutter modifiers may already have awarded Power.
  if(resolution.effectKind==='fury-cutter'&&!resolution.powerHerbApplied)resolution.grantFuryCutterPower=true;
  if(resolution.kind==='move'&&(reduction>0||hasShedSkin(room,target)||resolution.effectKind==='fury-cutter')) {
    resolution.modifierState={targetId:target.instanceId,amount,reduction,remaining:['dodge','defense','multiscale','marvel-scale','shed-skin']};
    return continueDamageModifiers(room,ctx);
  }
  const capped=hasShedSkin(room,target)?amount:capReceivingDamage(target,amount,damageOptions(room,source,target,{reinforcements:!resolution.ignoresReinforcements}));
  if (capped < amount) {
    if (target.catalogueId==='dratini' && target.level===3 && (target.damage||0)===0 && battleTraitsEffective(room,target)) {
      abilityVisual(room,activeOwner(room,target.instanceId),ctx.catalogue);
    } else recordLightClay(room,target);
  }
  return receiveDamage(room,ctx,capped);
}
function continueDamageModifiers(room,ctx) {
  const resolution=room.resolution,state=resolution.modifierState,target=creature(room,state.targetId),owner=activeOwner(room,state.targetId);
  if(!owner){delete resolution.modifierState;return nextSettlement(room,ctx);}
  const eligible=effect=>{
    if(state.amount<=0)return false;
    if(effect==='dodge')return state.reduction>0;
    if(effect==='shed-skin')return hasShedSkin(room,target)&&owner.hand.length>0;
    if(state.amount<=1)return false;
    if(effect==='defense')return !resolution.ignoresReinforcements&&battleReinforcementEffective(room,target,'defense');
    if(effect==='multiscale')return battleTraitsEffective(room,target)&&target.catalogueId==='dratini'&&target.level===3&&(target.damage||0)===0;
    return effect==='marvel-scale'&&battleTraitsEffective(room,target)&&target.catalogueId==='dratini'&&target.level<=2&&Boolean(target.status);
  };
  state.remaining=state.remaining.filter(eligible);
  if(!state.remaining.length) {
    const amount=Math.max(0,state.amount);delete resolution.modifierState;return commitDamage(room,ctx,amount);
  }
  if(state.remaining.length>1) {
    decision(room,'damage-order',owner.id,owner.id,ctx);Object.assign(room.pendingBattle,{effects:[...state.remaining],damage:state.amount,damageReduction:state.reduction});return;
  }
  runDamageModifier(room,state.remaining[0],ctx);
}
function runDamageModifier(room,effect,ctx) {
  const state=room.resolution.modifierState;
  state.remaining.splice(state.remaining.indexOf(effect),1);
  if(effect==='shed-skin') {
    const owner=activeOwner(room,state.targetId);
    decision(room,'shed-skin',owner.id,owner.id,ctx);Object.assign(room.pendingBattle,{trait:'shed-skin',damage:state.amount,maxCards:owner.hand.length});return;
  }
  if(effect==='marvel-scale') {
    const owner=activeOwner(room,state.targetId);room.resolution.incomingDamage=state.amount;
    decision(room,'scales',owner.id,owner.id,ctx);Object.assign(room.pendingBattle,{trait:'marvel-scale',canTrait:true,damage:state.amount});return;
  }
  state.amount=effect==='dodge'?Math.max(0,state.amount-state.reduction):Math.min(state.amount,1);
  if (effect==='defense') recordLightClay(room,creature(room,state.targetId));
  if(effect==='multiscale')abilityVisual(room,activeOwner(room,state.targetId),ctx.catalogue);
  continueDamageModifiers(room,ctx);
}
// All damage channels finish source/mandatory target changes before this
// optional receiving change. The saved amount belongs to this exact event.
function receiveDamage(room,ctx,amount) {
  const resolution=room.resolution,target=creature(room,resolution.targetCreatureId);
  if(hasShedSkin(room,target)) {
    resolution.modifierState={targetId:target.instanceId,amount,reduction:0,remaining:['defense','shed-skin']};return continueDamageModifiers(room,ctx);
  }
  if(amount>1 && battleTraitsEffective(room,target) && target.catalogueId==='dratini' && target.level<=2 && target.status && !target.defeated) {
    resolution.incomingDamage=amount;
    const owner=room.players.find(p=>p.active?.instanceId===target.instanceId&&!p.eliminated);
    decision(room,'scales',owner.id,owner.id,ctx);
    Object.assign(room.pendingBattle,{trait:'marvel-scale',canTrait:true,damage:amount});return;
  }
  commitDamage(room,ctx,amount);
}
function commitDamage(room,ctx,amount) {
  const resolution=room.resolution,target=creature(room,resolution.targetCreatureId);
  delete resolution.incomingDamage;
  if(amount>0)revealIllusion(room,activeOwner(room,target.instanceId),ctx);
  const result = applyDamage(target, amount, ctx.catalogue);
  resolution.actualDamage = amount;
  if (amount > 0) queueTourSwitch(room,target,ctx);
  if (amount > 0) resolution.damagedIds.push(target.instanceId);
  if (amount > 0 && !['turn-start','turn-end'].includes(resolution.kind) && battleReinforcementEffective(room,target, 'defense')) resolution.defenseIds.push(target.instanceId);
  const labels=resolution.environment==='sand'?['沙暴','Sandstorm']:resolution.kind==='item'?['凸凸头盔','Rocky Helmet']:resolution.kind==='turn-start'?['特殊状态','The special status']:resolution.kind==='event'?[resolution.externalSource?.name.zh||'事件',resolution.externalSource?.name.en||'The event']:['招式','The move'];
  const recipient = activeOwner(room,target.instanceId);
  if (recipient && resolution.kind==='move') moveVisual(room,recipient.id);
  if (amount > 0 && recipient) visualEvent(room,'hit',{sourceId:resolution.sourcePlayerId || null,targetIds:[recipient.id],amount,
    hpBefore:result.hp+amount,targetCatalogueId:target.catalogueId,
    ...(['move','retaliation'].includes(resolution.kind) ? {name:resolution.moveName, ...(resolution.weatherBallForm ? {weatherBallForm:resolution.weatherBallForm} : {})} : {})});
  note(room, `${labels[0]}造成${amount}点伤害。`, `${labels[1]} dealt ${amount} damage.`);
  if(resolution.grantFuryCutterPower&&result.damage>0) {
    const source=activeOwner(room,resolution.sourceId)?.active;
    if(source) {
      source.reinforcements.push(...Array(result.damage).fill('power'));
      note(room,`连斩按实际扣减的体力获得${result.damage}枚力量强化。`,`Fury Cutter gained ${result.damage} Power marker(s) from the damage actually dealt.`);
    }
  }
  if (result.fainting) beginRescue(room, room.players.find(p=>p.active?.instanceId===target.instanceId).id, ctx);
  else afterDamage(room, ctx);
}
function moveDamageEffect(room,ctx,resolution,source,target) {
  if(resolution.sourceAfterDone||resolution.kind!=='move'||!source||source.defeated)return null;
  if(resolution.sourceFamily==='bulbasaur')return ()=>{
    heal(source,1,ctx.catalogue);
    if(resolution.sourceLevel===3)drawBattleCards(room,trainer(room,resolution.sourcePlayerId));
    afterDamage(room,ctx);
  };
  if(resolution.sourceFamily==='exeggcute'&&resolution.sourceLevel===1)return ()=>{heal(source,1,ctx.catalogue);afterDamage(room,ctx);};
  const family=resolution.sourceFamily,level=resolution.sourceLevel;
  if (resolution.effectKind === 'tour-crunch' && !resolution.tourCrunchOffered && activeOwner(room,target.instanceId)) return () => {
    resolution.tourCrunchOffered = true;
    const owner = activeOwner(room,target.instanceId);
    const options = [{value:'damage',label:{zh:'承受额外1点伤害',en:'Take 1 extra damage'}}];
    if (target.item) options.unshift({value:'discard',label:{zh:'弃持有物免额外伤害',en:'Discard held item'}});
    return tourDecision(room,owner,{zh:'咬碎',en:'Crunch'},options,{kind:'crunch'},ctx);
  };
  if(resolution.effectKind==='rainy-flinch')return ()=>startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'flinch',weathers:['rain','thunderstorm'],next:'afterDamage'},resolution.sourcePlayerId);
  if(resolution.effectKind==='sunny-paralysis')return ()=>startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'paralysis',weathers:['intense-sun','clear'],next:'afterDamage'},resolution.sourcePlayerId);
  if(['remove-speed-after-damage','freeze-dry'].includes(resolution.effectKind)&&activeOwner(room,target.instanceId)) {
    if(!target.reinforcements?.some(marker=>resolution.effectKind==='freeze-dry'||marker==='speed'))return null;
    return ()=>{
      target.reinforcements=resolution.effectKind==='freeze-dry'?[]:target.reinforcements.filter(marker=>marker!=='speed');
      if (resolution.effectKind === 'freeze-dry') delete target.hoennClayDefense;
      afterDamage(room,ctx);
    };
  }
  if(family==='porygon'&&resolution.effectKind==='tri-attack')return ()=>startJudgment(room,ctx,{kind:'tri-attack',targetId:target.instanceId},resolution.sourcePlayerId);
  if(resolution.effectKind==='pay-day')return ()=>{
    decision(room,'pay-day',resolution.sourcePlayerId,resolution.sourcePlayerId,ctx);Object.assign(room.pendingBattle,{trait:'pay-day',canTrait:true});
  };
  if(resolution.effectKind==='flinch-after-damage'&&resolution.sourceFamily!=='magikarp')return ()=>applyStatus(room,ctx,target,'flinch','afterDamage');
  if(((family==='psyduck'&&level<=2)||(family==='diglett'&&level>=2)||resolution.effectKind==='reinforcement-after-damage')&&activeOwner(room,target.instanceId)) {
    const markers=[...new Set(target.reinforcements||[])];
    if(markers.length)return ()=>{
      resolution.markerTargetId=target.instanceId;decision(room,'reinforcement',resolution.sourcePlayerId,activeOwner(room,target.instanceId).id,ctx);
      Object.assign(room.pendingBattle,{reinforcements:markers,timing:'after-damage'});
    };
  }
  if(family==='shellder'&&level===2&&trainer(room,resolution.sourcePlayerId).hand.length)return ()=>decision(room,'cycle',resolution.sourcePlayerId,resolution.sourcePlayerId,ctx);
  if(family==='shellder' && level===3)return ()=>startJudgment(room,ctx,{kind:'icicle-spear',ownerId:resolution.sourcePlayerId},resolution.sourcePlayerId);
  if(resolution.effectKind==='paralysis-judgment'&&['electabuzz','tauros','porygon'].includes(family))return ()=>startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'paralysis',weathers:family==='tauros'?['intense-sun','clear']:['thunderstorm'],next:'afterDamage'},resolution.sourcePlayerId);
  const statusJudgment=(family==='charmander'||family==='vulpix'||(family==='growlithe'&&level>=2))?['burn','intense-sun']:['pikachu','magnemite'].includes(family)?['paralysis','thunderstorm']:family==='gastly'&&level===1?['paralysis','rain']:family==='abra'&&level>=2?['confusion','intense-sun']:family==='psyduck'&&level===3?['confusion','rain']:(family==='slowpoke'&&level===2)||(family==='pidgey'&&level===3)||(family==='magikarp'&&level===2)?['flinch','thunderstorm']:family==='sandshrew'&&level===1||family==='grimer'&&level>=2||family==='weedle'&&level<=2?['poison','rain']:null;
  if(statusJudgment)return ()=>startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:statusJudgment[0],weather:statusJudgment[1],...((['grimer','psyduck'].includes(family)&&level===3)||(family==='gastly'&&level===1)?{weathers:['rain','thunderstorm']}:{}),next:'afterDamage'},resolution.sourcePlayerId);
  if(family==='gastly'&&level===2) {
    const targetOwner=activeOwner(room,target.instanceId);
    return ()=>startJudgment(room,ctx,{kind:'shadow-ball',targetOwnerId:targetOwner?.id,sourcePlayerId:resolution.sourcePlayerId},resolution.sourcePlayerId);
  }
  if((family==='exeggcute'&&level===3)||(family==='staryu'&&level>=2))return ()=>startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'confusion',weather:'intense-sun',next:'afterDamage'},resolution.sourcePlayerId);
  if(family==='koffing'&&level>=2)return ()=>startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'poison',weather:'rain',next:'afterDamage'},resolution.sourcePlayerId);
  if(resolution.sourceFamily==='machop' && resolution.sourceLevel===3)return ()=>applyStatus(room,ctx,target,'confusion','afterDamage');
  if(resolution.sourceFamily==='sandshrew') {
    if(resolution.sourceLevel>=2) {
      const targetPlayer=trainer(room,resolution.targetIds[resolution.index]);
      if(targetPlayer.hand.length)return ()=>{
        resolution.handChoiceIds=shuffled(targetPlayer.hand.map(card=>card.id));
        decision(room,'hand',resolution.sourcePlayerId,targetPlayer.id,ctx);
        Object.assign(room.pendingBattle,{effect:resolution.sourceLevel===2?'discard':'take',choiceCount:targetPlayer.hand.length});
      };
    }
  }
  return null;
}

function dealingDamageEffects(room,ctx,source,target) {
  const resolution=room.resolution;
  const effects=new Map();
  const move=moveDamageEffect(room,ctx,resolution,source,target);
  if(move)effects.set('move',()=>{
    resolution.sourceAfterDone=true;
    move();
  });
  if(resolution.sourceItemAfterDone||!activeOwner(room,source?.instanceId)||!target)return effects;
  const item=source.item?.itemType;
  if(!['kings-rock','flame-orb'].includes(item)||!activeItemIs(room,source,item))return effects;
  if(item==='kings-rock'&&(resolution.kind!=='move'||!activeOwner(room,target.instanceId)||target.status))return effects;
  effects.set(item,()=>{
    resolution.sourceItemAfterDone=true;
    if(item==='kings-rock') {
      note(room,'王者之证触发畏缩效果。','King’s Rock triggered its Flinch effect.');
      return applyStatus(room,ctx,target,'flinch','afterDamage');
    }
    note(room,'火焰宝珠触发判定。','Flame Orb triggered a judgment.');
    return startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'burn',weathers:['intense-sun','clear'],next:'afterDamage'},resolution.sourcePlayerId);
  });
  return effects;
}

function afterDamage(room,ctx) {
  const resolution=room.resolution;
  // HP loss is not damage (booklet p.10). Resume its draw only after rescue,
  // deployment and immediate victory, without entering either damage stage.
  if(resolution.kind==='hp-loss') {
    const draw=resolution.lossDraw,owner=draw?trainer(room,draw.playerId):null;
    if(owner&&!owner.eliminated) {
      const count=Math.min(draw.count,room.drawPile.length+room.discardPile.length);
      drawBattleCards(room,owner,count,'reckless');
      note(room,`舍身摸取${count}张牌。`,`Reckless drew ${count} card(s).`);
    }
    return finishResolution(room,ctx);
  }
  if(resolution.actualDamage<=0)return nextSettlement(room,ctx);
  const source=creature(room,resolution.sourceId),target=creature(room,resolution.targetCreatureId);
  // The source trainer orders simultaneous effects before the receiver's stage.
  const dealing=dealingDamageEffects(room,ctx,source,target);
  if(dealing.size>1) {
    decision(room,'source-effect-order',resolution.sourcePlayerId,resolution.sourcePlayerId,ctx);
    room.pendingBattle.effects=[...dealing.keys()];
    return;
  }
  if(dealing.size===1)return dealing.values().next().value();
  resolution.sourceAfterDone=true;
  resolution.sourceItemAfterDone=true;
  if(!resolution.staticDone) {
    resolution.staticDone=true;resolution.receivingEffects=[];
    const targetOwner=room.players.find(p=>p.active?.instanceId===target?.instanceId&&!p.eliminated),sourceOwner=source?activeOwner(room,source.instanceId):null;
    if(targetOwner&&!target.defeated) {
      const traits=battleTraitsEffective(room,target);
      if(traits&&target.catalogueId==='cubone'&&targetOwner.hand.length)resolution.receivingEffects.push('battle-armor');
      if(traits&&target.catalogueId==='lapras')resolution.receivingEffects.push('water-absorb');
      if(wobbuffetResponse(room,targetOwner,ctx.catalogue))resolution.receivingEffects.push('wobbuffet-counter');
      if(traits&&target.catalogueId==='pikachu'&&sourceOwner&&!source.defeated)resolution.receivingEffects.push('static');
      if(traits&&target.catalogueId==='nidoran-m'&&sourceOwner&&!source.defeated)resolution.receivingEffects.push('poison-point');
      if(traits&&['abra','hoenn-ralts'].includes(target.catalogueId)&&resolution.card&&['command','event'].includes(resolution.card.kind)&&!resolution.cardClaimedBy)resolution.receivingEffects.push('synchronize');
      if(traits&&target.catalogueId==='slowpoke'&&room.turn.playerId!==targetOwner.id)resolution.receivingEffects.push('oblivious');
      if(traits&&target.catalogueId==='gastly'&&target.level===3&&sourceOwner?.hand.length&&sourceOwner.id!==targetOwner.id)resolution.receivingEffects.push('cursed-body');
      if(activeItemIs(room,target,'rocky-helmet')&&sourceOwner&&!source.defeated){resolution.receivingEffects.push('rocky-helmet');resolution.helmetCardId=target.item.id;}
      if(activeItemIs(room,target,'poison-barb')&&sourceOwner&&!source.status){resolution.receivingEffects.push('poison-barb');resolution.poisonBarbCardId=target.item.id;}
    }
  }
  continueReceiving(room,ctx);
}
function applySettlementRecoil(room,ctx,owner,name) {
  const source=owner.active;
  room.resolutionStack??=[];
  room.resolutionStack.push(room.resolution);
  room.resolution={kind:'hp-loss',card:null,sourceId:null,sourcePlayerId:owner.id,targetCreatureId:source.instanceId,targetIds:[owner.id],index:0,damagedIds:[],defenseIds:[],actualDamage:0};
  source.damage=(source.damage||0)+1;
  note(room,`${name.zh}的伤害结算结束，原伤害来源失去1点体力；这不是伤害。`,`After ${name.en}’s damage settlement, the original damage source lost 1 HP; this is not damage.`);
  if(currentHp(source,ctx.catalogue)<=0)return beginRescue(room,owner.id,ctx);
  return afterDamage(room,ctx);
}
function nextSettlement(room, ctx) {
  room.pendingBattle = null;
  const resolution=room.resolution;
  if(resolution.lifeOrbRecoil) {
    delete resolution.lifeOrbRecoil;
    const owner=activeOwner(room,resolution.sourceId);
    if(owner&&currentHp(owner.active,ctx.catalogue)>0)return applySettlementRecoil(room,ctx,owner,{zh:'生命宝珠',en:'Life Orb'});
  }
  if (['turn-start','turn-end','item','retaliation'].includes(resolution.kind)) return finishResolution(room, ctx);
  if(resolution.effectKind==='double-edge'&&resolution.doubleEdgeBoost&&resolution.actualDamage>0&&!resolution.recoilDone) {
    resolution.recoilDone=true;
    const owner=activeOwner(room,resolution.sourceId);
    if(owner&&currentHp(owner.active,ctx.catalogue)>0)return applySettlementRecoil(room,ctx,owner,{zh:'舍身冲撞',en:'Double-Edge'});
  }
  if(resolution.effectKind==='bonemerang'&&resolution.settlementIndex===0&&!resolution.repeatOffered) {
    resolution.repeatOffered=true;
    const owner=activeOwner(room,resolution.sourceId),target=activeOwner(room,resolution.originalTargetId);
    if(owner&&target&&currentHp(owner.active,ctx.catalogue)>0&&currentHp(target.active,ctx.catalogue)>0&&owner.hand.length) {
      decision(room,'bonemerang',owner.id,target.id,ctx);return;
    }
  }
  if(room.resolution.settlementCount!==undefined) {
    room.resolution.settlementIndex++;
    if(room.resolution.settlementIndex<room.resolution.settlementCount)return openDefense(room,ctx);
  }
  room.resolution.index++; openDefense(room, ctx);
}
function finishResolution(room,ctx) {
  const resolution=room.resolution;
  if (!resolution.tourAfterDone && resolution.tourSwitches?.length) {
    resolution.tourAfterDone = true;
    const seats = live(room), index = Math.max(0,seats.findIndex(seat=>seat.id===room.turn.playerId));
    const order = [...seats.slice(index),...seats.slice(0,index)].map(seat=>seat.id);
    room.tourAfterSwitches = {resolution, entries:resolution.tourSwitches.toSorted((a,b)=>order.indexOf(a.holderId)-order.indexOf(b.holderId)),index:0,switchedIds:[]};
    room.resolution = null; room.pendingBattle = null;
    return advanceTourSwitches(room,ctx);
  }
  if (resolution.effectKind === 'tour-rush' && !resolution.tourRushPaid) {
    resolution.tourRushPaid = true;
    const owner = activeOwner(room,resolution.sourceId);
    if (owner?.hand.length) room.discardPile.push(...owner.hand.splice(0,1));
  }
  if (offerLightClay(room,ctx)) return;
  cleanResolution(room,resolution);room.pendingBattle=null;delete room.judgment;delete room.statusEvent;
  if(resolution.effectKind==='u-turn'&&!resolution.uTurnOffered) {
    resolution.uTurnOffered=true;
    const owner=activeOwner(room,resolution.sourceId);
    if(owner&&currentHp(owner.active,ctx.catalogue)>0&&owner.reserve&&!owner.reserve.defeated&&currentHp(owner.reserve,ctx.catalogue)>0){decision(room,'u-turn',owner.id,owner.id,ctx);return;}
  }
  const parent=room.resolutionStack?.pop();
  if(parent){room.resolution=parent;return continueReceiving(room,ctx);}
  room.resolution=null;delete room.resolutionStack;
  if(room.turnStart)return continueTurnStart(room,ctx);
}
function defeat(room, targetPlayerId, ctx) {
  const player = trainer(room, targetPlayerId), pokemon = player.active, resolution = room.resolution;
  pokemon.defeated = true; pokemon.status = null; pokemon.reinforcements = []; delete pokemon.hoennUmbrella; delete pokemon.hoennClayDefense; if(pokemon.item)room.discardPile.push(pokemon.item);delete pokemon.item;
  if (player.raidBoss && room.scenario.lake.phase===1) {
    const lake=room.scenario.lake;
    lake.phase=2;
    room.resolution.raidSpentPhase=pokemon;
    player.active=lakeBossPokemon(2,lake.challengers);
    note(room,'红色暴鲤龙进入狂暴阶段，下一次行动起基础摸牌增加 1 张。','Red Gyarados entered its enraged phase and will draw one extra card on its turns.');
    return beginBattleEntries(room,[player],ctx,{kind:'damage'});
  }
  const source = creature(room, resolution.sourceId);
  if (source && source.instanceId !== pokemon.instanceId) {
    if(room.drawPile.length+room.discardPile.length)drawBattleCards(room,trainer(room,resolution.sourcePlayerId));
    else note(room,'击倒奖励没有当前可摸取的牌；结算继续。','No card is currently available for the defeat reward; resolution continues.');
  }
  const deployed=Boolean(player.reserve&&!player.reserve.defeated);
  visualEvent(room,'knockout',{targetIds:[targetPlayerId]});
  if (deployed) {
    const reserve = player.reserve; reserve.revealed = true; pokemon.revealed = true;
    player.active = reserve; player.reserve = pokemon;
    note(room, '备战宝可梦强制登场；不消耗普通交替。', 'The reserve was deployed; this does not consume ordinary switching.');
  } else {
    player.eliminated = true; room.discardPile.push(...player.hand, ...(player.delayedEvents || [])); player.hand = [];
    delete player.delayedEvents;
    if(player.role!=='leader'&&!player.identityPublic)revealBattleIdentity(room,player);
    if (room.scenario?.viridian && (targetPlayerId === room.scenario.viridian.proxyId || player.role === 'leader')) {
      revealViridianLeader(room);
    }
    if (room.settings.matchMode === 'teams') note(room, '一名训练家退场。', 'A trainer was eliminated.');
    else note(room, '一名训练家退场并公开身份。', 'A trainer was eliminated and revealed their identity.');
  }
  const silph=room.scenario?.silph;
  if (silph?.control && !live(room).some(seat=>seat.role===silph.control.team)) silph.control=null;
  const result = evaluateVictory(room.players, room.settings.matchMode, room.settings);
  if (result) {
    const reason=room.scenario?.lake ? (result.winner==='team-a'?'boss-defeated':'raid-failed') :
      (room.scenario?.radio || silph ? 'elimination' : null);
    return finishBattle(room,reason?{...result,reason}:result,ctx);
  }
  if(deployed)return beginBattleEntries(room,[player],ctx,{kind:'damage'});
  afterDamage(room, ctx);
}
export function finishSilphRotation(room,priorIndex,nextIndex,ctx) {
  const control=room.scenario?.silph?.control;
  if (!control) return false;
  const anchor=room.players.findIndex(player=>player.id===control.anchorId);
  const crossed=nextIndex>priorIndex ? anchor>priorIndex && anchor<=nextIndex :
    anchor>priorIndex || anchor<=nextIndex;
  if (anchor<0 || !crossed) return false;
  const winnerIds=room.players.filter(player=>player.role===control.team).map(player=>player.id);
  finishBattle(room,{winner:control.team,winnerIds,reason:'master-ball'},ctx);
  return true;
}
function finishBattle(room,result,ctx) {
  for (const pending of [room.resolution,...(room.resolutionStack||[])].filter(Boolean)) cleanResolution(room,pending);
  room.resolution = null;
  room.pendingBattle = null;
  for (const key of ['resolutionStack','judgment','statusEvent','protectionWindow','turnStart','switchEvent','entryEvent',
    'drawChoice','initialBattleEntries','fieldWeather','tourDexSurvey']) delete room[key];
  revealViridianLeader(room);
  room.result = {...result,completedAt:ctx.now(),developmentFixture:true};
  room.status = 'finished';
  room.turn = null;
  note(room, '胜利条件已达成，所有身份与剩余手牌公开。', 'A victory condition was met; all identities and remaining hands are revealed.');
}
function continueRescueAfterHealing(room,player,targetId,ctx) {
  const resolution=room.resolution;
  if(currentHp(trainer(room,targetId).active,ctx.catalogue)>=1) {
    room.pendingBattle=null;
    delete resolution.rescueActors;delete resolution.rescueIndex;delete resolution.rescueCreatureId;delete resolution.rescueActorInstances;
    note(room,'救援成功；立即继续原结算。','Rescue succeeded; the original settlement resumes immediately.');
    return afterDamage(room,ctx);
  }
  decision(room,'rescue',player.id,targetId,ctx);
}
export function respondBattle(room,player,input,ctx) {
  const pending=room.pendingBattle;
  requireRule(pending && input.decisionId===pending.id,'STALE_DECISION','Refresh the pending decision.');
  requireRule(pending.actorId===player.id && !player.spectator && !player.eliminated,'NOT_YOUR_DECISION','This response belongs to another trainer.');
  if (pending.kind === 'expansion') return respondTour(room,player,input,ctx);
  requireRule(pending.kind==='distribute'||input.allocations===undefined,'INVALID_RESPONSE','This decision does not distribute cards.');
  requireRule(pending.kind==='exile'||input.handIndices===undefined,'INVALID_RESPONSE','This decision does not select multiple hand slots.');
  requireRule(['shed-skin','sweet-kiss','blunder-policy','power-herb'].includes(pending.kind)||input.cardIds===undefined,'INVALID_RESPONSE','This decision does not select hand cards.');
  requireRule(['cute-charm','neutralizing-gas','intimidate'].includes(pending.kind)||input.targetId===undefined,'INVALID_RESPONSE','This decision does not choose a target.');
  requireRule(pending.kind==='forewarn-order'||(input.topOrder===undefined&&input.bottomOrder===undefined),'INVALID_RESPONSE','Only Forewarn chooses the deck top and bottom.');
  requireRule(pending.kind==='download'||input.targetIds===undefined,'INVALID_RESPONSE','Only Download chooses multiple trainers.');
  requireRule(pending.kind==='quick-claw'||(input.moveIndex===undefined&&input.boostCardId===undefined&&input.effectChoice===undefined),'INVALID_RESPONSE','This response does not declare a move.');
  if (pending.kind === 'reveal-judgment') {
    const judgment = room.judgment;
    requireRule(judgment && !judgment.card, 'STALE_DECISION', 'The judgment is no longer waiting to be revealed.');
    requireRule(input.choice === 'reveal' &&
      Object.keys(input).every(key => ['id','revision','type','decisionId','choice'].includes(key)),
      'INVALID_RESPONSE', 'Reveal the top card for judgment.');
    return revealJudgment(room,ctx,judgment.continuation,judgment.judgeId);
  }
  if(pending.kind==='quick-claw') {
    const allowed=input.choice==='pass'?['id','revision','type','decisionId','choice']:['id','revision','type','decisionId','choice','cardId','moveIndex','boostCardId','effectChoice'];
    requireRule(['command','pass'].includes(input.choice)&&Object.keys(input).every(key=>allowed.includes(key)),'INVALID_RESPONSE','Use a sunny command or pass.');
    const start=room.turnStart,entry=start?.quickClawHolders?.[start.quickClawIndex];
    requireRule(entry?.playerId===player.id,'STALE_DECISION','The Quick Claw opportunity changed.');
    if(input.choice==='command') {
      requireRule(quickClawHolder(room,ctx,entry)&&activeOwner(room,start.quickClawTarget)?.id===pending.targetId,'STALE_DECISION','The Quick Claw holder or target changed.');
    }
    start.quickClawIndex++;
    room.pendingBattle=null;
    if(input.choice==='pass')return continueTurnStart(room,ctx);
    return playBattleMove(room,player,{...input,targetIds:[pending.targetId]},ctx,pending.targetId);
  }
  if(pending.kind==='life-orb') {
    requireRule(['boost','pass'].includes(input.choice)&&Object.keys(input).every(key=>['id','revision','type','decisionId','choice'].includes(key)),
      'INVALID_RESPONSE','Boost with Life Orb or pass.');
    const resolution=room.resolution,offer=resolution?.lifeOrbOffer;
    requireRule(offer&&player.active?.instanceId===resolution.sourceId&&player.active.item?.id===offer.itemId&&
      activeItemIs(room,player.active,'life-orb')&&activeOwner(room,resolution.targetCreatureId)?.id===pending.targetId,
      'STALE_DECISION','The damage source, target, or Life Orb changed.');
    delete resolution.lifeOrbOffer;
    room.pendingBattle=null;
    if(input.choice==='boost') {
      resolution.lifeOrbRecoil=true;
      note(room,'生命宝珠令伤害值加1。','Life Orb added 1 damage.');
    }
    return resolveDealtDamage(room,ctx,offer.amount+(input.choice==='boost'?1:0));
  }
  if(['blunder-policy','power-herb'].includes(pending.kind)) {
    requireRule(['discard','pass'].includes(input.choice)&&Object.keys(input).every(key=>['id','revision','type','decisionId','choice','cardIds'].includes(key))&&
      (input.choice!=='pass'||input.cardIds===undefined),'INVALID_RESPONSE','Discard two hand cards or pass.');
    const resolution=room.resolution;
    requireRule(resolution?.kind==='move'&&player.active?.instanceId===resolution.sourceId&&
      player.active.item?.id===(resolution.dodgePaymentItemId ?? resolution.blunderPolicyItemId)&&activeItemIs(room,player.active,pending.kind)&&
      activeOwner(room,resolution.targetCreatureId)?.id===pending.targetId,'STALE_DECISION','The move, target, or Blunder Policy changed.');
    delete resolution.blunderPolicyItemId;
    delete resolution.dodgePaymentItemId;
    room.pendingBattle=null;
    if(input.choice==='pass')return nextSettlement(room,ctx);
    const ids=input.cardIds;
    requireRule(Array.isArray(ids)&&ids.length===2&&new Set(ids).size===2&&ids.every(id=>typeof id==='string'&&player.hand.some(card=>card.id===id)),
      'INVALID_RESPONSE','Choose two distinct cards from your hand.');
    const selected=new Set(ids);
    room.discardPile.push(...player.hand.filter(card=>selected.has(card.id)));
    player.hand=player.hand.filter(card=>!selected.has(card.id));
    if (pending.kind==='power-herb') {
      room.discardPile.push(player.active.item);
      delete player.active.item;
      resolution.powerHerbApplied=true;
      resolution.sourceAfterDone=true;
      resolution.sourceItemAfterDone=true;
      note(room,'强力香草与两张手牌已弃置，对原目标结算 1 点招式伤害。','Power Herb and two hand cards were discarded for 1 move damage to the original target.');
      return resolveDealtDamage(room,ctx,damageImmune(room,creature(room,resolution.targetCreatureId))?0:1);
    }
    note(room,'打空保险弃置两张手牌，使本次结算继续生效。','Blunder Policy discarded two cards so the settlement could resolve.');
    return settleDamage(room,ctx);
  }
  if(pending.kind==='articuno') {
    requireRule(Object.keys(input).every(key=>['id','revision','type','decisionId','choice','cardId'].includes(key))&&['protect','pass'].includes(input.choice)&&(input.choice!=='pass'||input.cardId===undefined),'INVALID_RESPONSE','Use one Articuno card, or pass without a card.');
    const window=room.protectionWindow;
    requireRule(room.scenario?.articunoReactions===true&&window&&window.mode===pending.mode&&window.targetId===pending.targetId&&window.actorIds[window.index]===player.id,'STALE_DECISION','The protection window changed.');
    if(input.choice==='pass'){window.index++;return advanceProtectionWindow(room,ctx);}
    const target=protectionTarget(room,ctx,window);
    requireRule(target,'STALE_DECISION','The protected target or effect changed.');
    const index=player.hand.findIndex(card=>card.id===input.cardId&&isArticunoCard(card));
    requireRule(typeof input.cardId==='string'&&index>=0,'INVALID_CARD','Choose an actual Articuno’s Protection card from your hand.');
    const [card]=player.hand.splice(index,1);
    room.discardPile.push(card);
    if(window.mode==='cancel-event'&&room.resolution?.eventType==='berry-harvest') {
      window.berryProtectionCount=(window.berryProtectionCount||0)+1;
      window.berryProtectorId=player.id;
      note(room,window.berryProtectionCount===1?'打出急冻鸟的庇护，尝试抵消树果大丰收对这一席的效果。':'打出另一张急冻鸟的庇护，反制上一张。',window.berryProtectionCount===1?'Articuno’s Protection was played against Berry Harvest for this target.':'Another Articuno’s Protection countered the previous one.');
      window.actorIds=protectionActorIds(room,player.id);
      window.index=0;
      return advanceProtectionWindow(room,ctx);
    }
    if(window.mode==='cure-status')target.status=null;
    visualEvent(room,'event-action',{sourceId:player.id,targetIds:[window.targetId],
      name:card.name,effect:'articuno-protection',action:'shield'});
    note(room,window.mode==='cancel-event'?'急冻鸟的庇护抵消了事件对此目标的效果。':'急冻鸟的庇护恢复了目标刚获得的特殊状态。',window.mode==='cancel-event'?'Articuno’s Protection canceled the event for this target.':'Articuno’s Protection cured the target’s newly applied status.');
    return finishProtectionWindow(room,ctx,true);
  }
  if(pending.kind==='rival-command')return respondRivalChallenge(room,player,input,ctx);
  if(pending.kind==='berry-pick') {
    const resolution=room.resolution, cards=resolution?.berryCards;
    requireRule(resolution?.eventType==='berry-harvest'&&resolution.targetIds[resolution.index]===player.id&&
      player.active?.instanceId===resolution.targetInstances[player.id]&&!player.active.defeated&&currentHp(player.active,ctx.catalogue)>0,
      'STALE_DECISION','The harvest recipient changed.');
    requireRule(Object.keys(input).every(key=>['id','revision','type','decisionId','choice','handIndex'].includes(key))&&
      input.choice==='card'&&Number.isSafeInteger(input.handIndex)&&input.handIndex>=0&&input.handIndex<cards.length,
      'INVALID_RESPONSE','Choose one of the remaining face-up cards.');
    gainBattleCards(room,player,cards.splice(input.handIndex,1),{reason:'harvest'});
    visualEvent(room,'event-action',{sourceId:resolution.actorPlayerId,targetIds:[player.id],
      name:resolution.eventName,effect:resolution.eventType,action:'harvest'});
    note(room,'一名训练家获得了一张亮出的牌。','A trainer gained one of the revealed cards.');
    return nextSettlement(room,ctx);
  }
  if(pending.kind==='event-hand') {
    requireRule(Object.keys(input).every(key=>['id','revision','type','decisionId','choice','handIndex'].includes(key))&&input.choice==='card'&&Number.isSafeInteger(input.handIndex),'INVALID_RESPONSE','Choose one hidden hand-card slot.');
    const resolution=room.resolution,owner=trainer(room,pending.targetId),target=owner?.active;
    requireRule(resolution?.kind==='event'&&['mr-mime-trick','farfetchd-prank'].includes(resolution.eventType)&&resolution.eventEffect==='hand'&&resolution.actorPlayerId===player.id&&player.active?.instanceId===resolution.actorCreatureId&&owner&&!owner.eliminated&&target&&!target.defeated&&target.instanceId===resolution.targetInstances[owner.id],'STALE_DECISION','The event participants changed.');
    const ids=resolution.handChoiceIds||[];
    requireRule(input.handIndex>=0&&input.handIndex<ids.length,'INVALID_RESPONSE','Choose an available hidden slot.');
    const index=owner.hand.findIndex(card=>card.id===ids[input.handIndex]);
    requireRule(index>=0,'STALE_DECISION','The selected hand card changed.');
    const cards=owner.hand.splice(index,1);
    delete resolution.handChoiceIds;
    // The animation shows only a card back. The chosen hand card stays private.
    showEventTransfer(room,resolution,owner.id,'card');
    if(resolution.eventType==='farfetchd-prank') {
      room.discardPile.push(...cards);
      note(room,'大葱鸭的恶作剧弃置目标训练家的一张手牌。','Farfetch’d’s Prank discarded one card from the target trainer’s hand.');
    }else {
      gainBattleCards(room,player,cards,{reason:'take'});
      note(room,'魔墙人偶的戏法获得目标训练家的一张手牌。','Mr. Mime’s Trick took one card from the target trainer’s hand.');
    }
    return nextSettlement(room,ctx);
  }
  if(['event-dodge','event-command','mew-blessing'].includes(pending.kind)) {
    const resolution=room.resolution,target=player.active;
    requireRule(resolution?.kind==='event'&&resolution.targetIds[resolution.index]===player.id&&target&&!target.defeated&&currentHp(target,ctx.catalogue)>0&&target.instanceId===resolution.targetInstances[player.id]&&target.instanceId===pending.targetCreatureId,'STALE_DECISION','The event target changed.');
    requireRule(Object.keys(input).every(key=>['id','revision','type','decisionId','choice',...(['event-dodge','event-command'].includes(pending.kind)?['cardId']:[])].includes(key)),'INVALID_RESPONSE','This event does not accept extra response fields.');
    if(pending.kind==='mew-blessing') {
      requireRule(mewBlessingChoices(target).includes(input.choice),'INVALID_RESPONSE','Choose an available Mew’s Blessing effect.');
      if(input.choice==='heal')heal(target,2,ctx.catalogue);else target.level++;
      visualEvent(room,'event-action',{sourceId:resolution.actorPlayerId,targetIds:[player.id],
        name:resolution.eventName,effect:resolution.eventType,action:'bless'});
      note(room,input.choice==='heal'?'梦幻的祝福回复目标至多2点体力。':'梦幻的祝福令目标升1级。',input.choice==='heal'?"Mew’s Blessing restored up to 2 HP.":"Mew’s Blessing raised the target by one level.");
      return nextSettlement(room,ctx);
    }
    const responseKind=pending.kind==='event-command'?'command':'dodge';
    requireRule(['pass',responseKind].includes(input.choice)&&(input.choice!=='pass'||input.cardId===undefined),'INVALID_RESPONSE','Play the required actual card response, or pass without a card.');
    if(input.choice===responseKind) {
      const index=player.hand.findIndex(card=>card.id===input.cardId&&card.kind===responseKind);
      requireRule(typeof input.cardId==='string'&&index>=0,'INVALID_CARD','Choose an actual required response card from your hand.');
      room.discardPile.push(...player.hand.splice(index,1));
      if (responseKind==='dodge') visualEvent(room,'dodge',{targetIds:[player.id]});
      note(room,responseKind==='command'?'打出接招吧！抵消火焰鸟对此目标的伤害。':'打出快躲开！抵消超梦对此目标的伤害。',responseKind==='command'?'A played command response canceled Moltres’s damage to this target.':'A played Dodge response canceled Mewtwo’s damage to this target.');
      return nextSettlement(room,ctx);
    }
    room.pendingBattle=null;return settleEventDamage(room,ctx);
  }
  if(pending.kind==='rescue') {
    requireRule(Object.keys(input).every(key=>['id','revision','type','decisionId','choice','cardId'].includes(key))&&['pass','potion','healer','joy'].includes(input.choice)&&(input.choice!=='pass'||input.cardId===undefined),'INVALID_RESPONSE','Use an available rescue option or pass without extra fields.');
    const resolution=room.resolution,owner=trainer(room,pending.targetId),target=owner?.active;
    requireRule(resolution&&resolution.rescueActors?.[resolution.rescueIndex]===player.id&&target&&!target.defeated&&target.instanceId===(resolution.rescueCreatureId??resolution.targetCreatureId)&&currentHp(target,ctx.catalogue)<=0&&(!resolution.rescueActorInstances||resolution.rescueActorInstances[player.id]===player.active?.instanceId),'STALE_DECISION','The fainting Pokémon or rescue actor changed.');
    if(input.choice==='pass') {
      resolution.rescueIndex++;
      if(resolution.rescueIndex<resolution.rescueActors.length)decision(room,'rescue',resolution.rescueActors[resolution.rescueIndex],pending.targetId,ctx);
      else {room.pendingBattle=null;defeat(room,pending.targetId,ctx);}
      return;
    }
    requireRule(!rescueOwnerOnly(room)||player.id===pending.targetId,'POTION_RESTRICTED','Only the fainting Pokémon’s trainer may use Potion during this move.');
    if (input.choice==='joy') {
      const slot=joyItemSlots(room,player,pending.targetId).find(key=>player[key].item.id===input.cardId);
      requireRule(slot,'INVALID_CARD','Nurse Joy needs one public held item and an unused rescue.');
      const holder=player[slot];
      room.discardPile.push(holder.item);
      delete holder.item;
      player.professionUsed=true;
      heal(target,1,ctx.catalogue);
      note(room,'乔伊弃置一件已公开的持有物，为昏厥目标回复1点体力。',
        'Nurse Joy discarded one public held item to restore 1 HP to the fainting target.');
      if (slot==='active' && holder.catalogueId==='mankey' && battleTraitsEffective(room,holder) &&
          currentHp(holder,ctx.catalogue)>0 && room.drawPile.length+room.discardPile.length>=2) {
        resolution.joyRescue={actorId:player.id,targetId:pending.targetId};
        decision(room,'defiant',player.id,player.id,ctx);
        Object.assign(room.pendingBattle,{trait:'defiant',canTrait:true});
        return;
      }
      return continueRescueAfterHealing(room,player,pending.targetId,ctx);
    }
    const index=player.hand.findIndex(card=>card.id===input.cardId),card=player.hand[index];
    requireRule(typeof input.cardId==='string'&&index>=0&&(input.choice==='potion'?isPotionCard(card):hasHealer(room,player)&&['intense-sun','clear'].includes(card.weather)),'INVALID_CARD','Choose an actual Potion pair, or one sunny own hand card with active Healer.');
    player.hand.splice(index,1);room.discardPile.push(card);
    heal(target,2,ctx.catalogue);
    if(input.choice==='healer')abilityVisual(room,player,ctx.catalogue,{targetIds:[pending.targetId]});
    note(room,input.choice==='healer'?'治愈之心将一张晴天手牌当伤药，昏厥目标回复2点体力。':'伤药令昏厥目标回复2点体力；整张组合道具牌已弃置。',input.choice==='healer'?'Healer used one sunny hand card as Potion; the fainting target restored 2 HP.':'Potion restored 2 HP to the fainting target; the entire split card was discarded.');
    return continueRescueAfterHealing(room,player,pending.targetId,ctx);
  }
  if(['pressure','pressure-payment'].includes(pending.kind)) {
    const resolution=room.resolution,target=trainer(room,resolution?.targetIds?.[resolution.pressureIndex]),source=trainer(room,resolution?.sourcePlayerId);
    requireRule(resolution?.kind==='move'&&!resolution.statusMove&&target?.active?.instanceId===resolution.pressurePokemonId&&target.active.catalogueId==='aerodactyl'&&!target.eliminated&&battleTraitsEffective(room,target.active)&&source?.active?.instanceId===resolution.sourceId&&!source.eliminated,'STALE_DECISION','The Pressure participants changed.');
    requireRule(player.id===(pending.kind==='pressure'?target.id:source.id),'NOT_YOUR_DECISION','This payment belongs to another trainer.');
    requireRule(['discard','pass'].includes(input.choice)&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined&&input.effect===undefined&&(input.choice!=='pass'||input.cardId===undefined),'INVALID_RESPONSE','Discard one own hand card or pass.');
    if(input.choice==='pass')return finishPressureChoice(room,ctx,pending.kind==='pressure-payment');
    const index=player.hand.findIndex(card=>card.id===input.cardId);
    requireRule(typeof input.cardId==='string'&&index>=0,'INVALID_CARD','Choose one card from your own hand.');
    room.discardPile.push(...player.hand.splice(index,1));
    if(pending.kind==='pressure-payment')return finishPressureChoice(room,ctx,false);
    abilityVisual(room,target,ctx.catalogue,{targetIds:[source.id]});
    if(!source.hand.length)return finishPressureChoice(room,ctx,true);
    decision(room,'pressure-payment',source.id,target.id,ctx);return;
  }
  if(['download','download-hand'].includes(pending.kind)) {
    const choice=room.drawChoice;
    requireRule(choice?.kind==='download'&&choice.playerId===player.id&&choice.pokemonId===player.active.instanceId&&room.turn.playerId===player.id&&room.turn.phase==='draw'&&player.active.catalogueId==='porygon'&&battleTraitsEffective(room,player.active),'STALE_DECISION','The Download actor changed.');
    requireRule(input.cardId===undefined&&input.order===undefined&&input.reinforcement===undefined&&input.effect===undefined,'INVALID_RESPONSE','Use the Download controls only.');
    if(pending.kind==='download') {
      const ids=input.targetIds;
      requireRule(!pending.legalTargetIds.length || ids?.length>0,'INVALID_RESPONSE','Choose at least one trainer before confirming Download.');
      requireRule(input.choice==='targets'&&input.handIndex===undefined&&Array.isArray(ids)&&ids.length<=pending.maxTargets&&new Set(ids).size===ids.length&&ids.every(id=>pending.legalTargetIds.includes(id)&&live(room).some(target=>target.id===id&&target.id!==player.id&&target.hand.length)),'INVALID_RESPONSE','Choose up to two distinct other trainers with hand cards.');
      Object.assign(choice,{targetIds:[...ids],index:0,cards:[]});return advanceDownload(room,player,ctx);
    }
    const ids=choice.handChoiceIds,target=trainer(room,pending.targetId);
    requireRule(input.choice==='card'&&Number.isSafeInteger(input.handIndex)&&input.handIndex>=0&&input.handIndex<ids.length,'INVALID_RESPONSE','Choose one face-down hand-card slot.');
    requireRule(target&&!target.eliminated&&target.id===choice.targetIds[choice.index],'STALE_DECISION','The chosen trainer changed.');
    const index=target.hand.findIndex(card=>card.id===ids[input.handIndex]);
    requireRule(index>=0,'STALE_DECISION','The selected hand card changed.');
    choice.cards.push(...target.hand.splice(index,1));delete choice.handChoiceIds;choice.index++;
    return advanceDownload(room,player,ctx);
  }
  if(['intimidate','intimidate-hand'].includes(pending.kind)) {
    const event=room.entryEvent;
    requireRule(event&&event.actorIds[event.index]===player.id&&event.actorInstances[player.id]===player.active.instanceId&&player.active.catalogueId==='tauros'&&battleTraitsEffective(room,player.active),'STALE_DECISION','The Intimidate actor changed.');
    requireRule(input.cardId===undefined&&input.order===undefined&&input.reinforcement===undefined&&input.effect===undefined,'INVALID_RESPONSE','Use the Intimidate controls only.');
    if(pending.kind==='intimidate') {
      const target=trainer(room,input.targetId);
      requireRule(input.choice==='target'&&input.handIndex===undefined&&pending.legalTargetIds.includes(input.targetId)&&target&&!target.eliminated&&!target.spectator&&target.hand.length,'INVALID_RESPONSE','Choose a living trainer with hand cards.');
      event.handChoiceIds=shuffled(target.hand.map(card=>card.id));decision(room,'intimidate-hand',player.id,target.id,ctx);room.pendingBattle.choiceCount=target.hand.length;return;
    }
    const target=trainer(room,pending.targetId),ids=event.handChoiceIds;
    requireRule(input.choice==='card'&&Number.isSafeInteger(input.handIndex)&&input.handIndex>=0&&input.handIndex<ids.length,'INVALID_RESPONSE','Choose one hand-card slot.');
    const index=target.hand.findIndex(card=>card.id===ids[input.handIndex]);
    requireRule(index>=0,'STALE_DECISION','The selected hand card changed.');
    room.discardPile.push(...target.hand.splice(index,1));delete event.handChoiceIds;event.index++;
    abilityVisual(room,player,ctx.catalogue,{targetIds:[target.id]});
    note(room,'威吓弃置了一名训练家的一张手牌。','Intimidate discarded one card from a trainer’s hand.');
    return advanceBattleEntries(room,ctx);
  }
  if(pending.kind==='vital-spirit') {
    const choice=room.drawChoice,order=input.order;
    requireRule(choice&&choice.playerId===player.id&&choice.pokemonId===player.active.instanceId&&room.turn.playerId===player.id&&room.turn.phase==='draw'&&player.active.catalogueId==='electabuzz'&&battleTraitsEffective(room,player.active),'STALE_DECISION','The Vital Spirit actor changed.');
    requireRule(input.choice==='gain'&&input.cardId===undefined&&input.handIndex===undefined&&input.reinforcement===undefined&&input.effect===undefined&&Array.isArray(order)&&order.length===pending.requiredCards&&new Set(order).size===order.length&&order.every(index=>Number.isSafeInteger(index)&&index>=0&&index<choice.cardIds.length),'INVALID_RESPONSE','Choose the required number of viewed cards.');
    const cards=room.drawPile.slice(-choice.cardIds.length).reverse();
    requireRule(cards.length===choice.cardIds.length&&cards.every((card,index)=>card.id===choice.cardIds[index]),'STALE_DECISION','The inspected cards changed.');
    const selected=new Set(order.map(index=>cards[index].id));room.drawPile=room.drawPile.filter(card=>!selected.has(card.id));
    gainBattleCards(room,player,order.map(index=>cards[index]),{reason:'vital-spirit'});
    abilityVisual(room,player,ctx.catalogue);
    room.turn.drawRemaining=0;room.turn.phase='play';delete room.drawChoice;room.pendingBattle=null;
    note(room,'干劲获得所选牌，其余牌留在牌堆顶；通常摸牌已被替代。','Vital Spirit gained the selected cards and left the rest on top; it replaced the ordinary draws.');return;
  }
  if(pending.kind==='forewarn'||pending.kind==='forewarn-order') {
    const start=room.turnStart;
    requireRule(start&&start.preparationPokemonId===player.active.instanceId&&player.id===start.playerId&&player.active.catalogueId==='jynx'&&battleTraitsEffective(room,player.active),'STALE_DECISION','The Forewarn actor changed.');
    requireRule(input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined&&input.effect===undefined,'INVALID_RESPONSE','Use the Forewarn controls only.');
    if(pending.kind==='forewarn') {
      requireRule(['trait','pass'].includes(input.choice),'INVALID_RESPONSE','View with Forewarn or pass.');
      if(input.choice==='trait') {
        refillDrawPile(room,4);
        const ids=room.drawPile.slice(-4).reverse().map(card=>card.id);
        if(ids.length){start.forewarnCardIds=ids;decision(room,'forewarn-order',player.id,player.id,ctx);room.pendingBattle.choiceCount=ids.length;return;}
      }
    }else {
      const ids=start.forewarnCardIds||[],top=input.topOrder,bottom=input.bottomOrder;
      requireRule(input.choice==='order'&&Array.isArray(top)&&Array.isArray(bottom)&&top.length+bottom.length===ids.length&&new Set([...top,...bottom]).size===ids.length&&[...top,...bottom].every(i=>Number.isSafeInteger(i)&&i>=0&&i<ids.length),'INVALID_RESPONSE','Place every viewed card exactly once on top or bottom.');
      const cards=room.drawPile.slice(-ids.length).reverse();
      requireRule(cards.length===ids.length&&cards.every((card,index)=>card.id===ids[index]),'STALE_DECISION','The inspected cards changed.');
      room.drawPile.splice(-ids.length,ids.length);
      room.drawPile=[...bottom.map(i=>cards[i]).reverse(),...room.drawPile,...top.map(i=>cards[i]).reverse()];
      abilityVisual(room,player,ctx.catalogue);
      delete start.forewarnCardIds;
    }
    room.pendingBattle=null;return continueTurnStart(room,ctx);
  }
  if(pending.kind==='u-turn') {
    requireRule(['switch','pass'].includes(input.choice)&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined&&input.effect===undefined,'INVALID_RESPONSE','Choose the U-turn switch or pass.');
    const resolution=room.resolution;
    requireRule(resolution?.effectKind==='u-turn'&&resolution.sourceId===player.active.instanceId&&!player.active.defeated&&currentHp(player.active,ctx.catalogue)>0,'STALE_DECISION','The U-turn source changed.');
    if(input.choice==='switch')return requestBattleSwitch(room,player,'u-turn',ctx);
    return finishResolution(room,ctx);
  }
  if(pending.kind==='sweet-kiss') {
    const ids=input.cardIds;
    requireRule(room.resolution?.targetCreatureId===player.active.instanceId&&!player.active.defeated,'STALE_DECISION','The Sweet Kiss target changed.');
    requireRule(input.choice==='discard'&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined&&input.effect===undefined&&Array.isArray(ids)&&ids.length===pending.requiredCards&&ids.length===Math.min(2,player.hand.length)&&new Set(ids).size===ids.length&&ids.every(id=>typeof id==='string'&&player.hand.some(card=>card.id===id)),'INVALID_RESPONSE','Discard the required number of distinct own hand cards.');
    const selected=new Set(ids);room.discardPile.push(...player.hand.filter(card=>selected.has(card.id)));player.hand=player.hand.filter(card=>!selected.has(card.id));
    drawBattleCards(room,player,Math.min(2,room.drawPile.length+room.discardPile.length),'sweet-kiss');room.pendingBattle=null;return nextSettlement(room,ctx);
  }
  if(pending.kind==='double-edge') {
    requireRule(['boost','pass'].includes(input.choice)&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined&&input.effect===undefined,'INVALID_RESPONSE','Boost Double-Edge or pass without extra fields.');
    const resolution=room.resolution;
    requireRule(resolution?.effectKind==='double-edge'&&!resolution.doubleEdgeDecided&&resolution.sourceId===player.active.instanceId&&!player.active.defeated&&currentHp(player.active,ctx.catalogue)>0,'STALE_DECISION','The Double-Edge source changed.');
    resolution.doubleEdgeDecided=true;resolution.doubleEdgeBoost=input.choice==='boost';room.pendingBattle=null;
    return settleDamage(room,ctx);
  }
  if(['battle-armor','bonemerang','neutralizing-gas'].includes(pending.kind)) {
    const kind=pending.kind,choice=kind==='battle-armor'?'armor':kind==='bonemerang'?'repeat':'suppress';
    requireRule(['pass',choice].includes(input.choice)&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined&&input.effect===undefined,'INVALID_RESPONSE','Pay one actual hand card for this effect or pass.');
    if(input.choice==='pass')requireRule(input.cardId===undefined&&input.targetId===undefined,'INVALID_RESPONSE','Passing does not pay or choose a target.');
    const resolution=room.resolution;
    if(kind==='battle-armor')requireRule(resolution?.targetCreatureId===player.active.instanceId&&resolution.actualDamage>0&&player.active.catalogueId==='cubone'&&battleTraitsEffective(room,player.active),'STALE_DECISION','The Battle Armor recipient changed.');
    if(kind==='bonemerang')requireRule(resolution?.effectKind==='bonemerang'&&resolution.settlementIndex===0&&activeOwner(room,resolution.sourceId)?.id===player.id&&activeOwner(room,resolution.originalTargetId)&&currentHp(player.active,ctx.catalogue)>0&&currentHp(creature(room,resolution.originalTargetId),ctx.catalogue)>0,'STALE_DECISION','The Bonemerang partners changed.');
    if(kind==='neutralizing-gas')requireRule(room.turnStart?.actorIds?.[room.turnStart.index]===player.id&&room.turnStart.actorInstances[player.id]===player.active.instanceId&&player.active.catalogueId==='koffing'&&battleTraitsEffective(room,player.active),'STALE_DECISION','The Neutralizing Gas actor changed.');
    if(input.choice!=='pass') {
      const index=player.hand.findIndex(card=>card.id===input.cardId);requireRule(index>=0,'INVALID_CARD','Choose one actual own hand card.');
      if(kind==='neutralizing-gas')requireRule(pending.legalTargetIds.includes(input.targetId)&&live(room).some(p=>p.id===input.targetId),'INVALID_TARGET','Choose one living trainer.');
      room.discardPile.push(...player.hand.splice(index,1));
      if(kind==='battle-armor') {
        abilityVisual(room,player,ctx.catalogue);
        if(!player.active.reinforcements.includes('defense'))player.active.reinforcements.push('defense');
        // The booklet removes even a newly gained Defense at this damaging card's end.
        if(!['turn-start','turn-end'].includes(resolution.kind))resolution.defenseIds.push(player.active.instanceId);
        note(room,'战斗盔甲弃置一张手牌，获得一枚防御强化（不叠加）。','Battle Armor discarded one card and gained one Defense reinforcement, without stacking.');
      }else if(kind==='bonemerang') {
        resolution.settlementCount=2;
        note(room,'骨头回力镖弃置一张手牌，将再结算一次。','Bonemerang discarded one card and will settle once more.');
      }else {
        if(!room.turn.suppressedTraitPlayerIds.includes(input.targetId))room.turn.suppressedTraitPlayerIds.push(input.targetId);
      revealIllusion(room,trainer(room,input.targetId),ctx);
        abilityVisual(room,player,ctx.catalogue,{targetIds:[input.targetId]});
        note(room,'化学变化气体弃置一张手牌，使所选训练家的所有宝可梦特性失效至当前回合结束。','Neutralizing Gas discarded one card and suppressed the chosen trainer’s Pokémon traits until this turn ends.');
      }
    }
    room.pendingBattle=null;
    return kind==='battle-armor'?continueReceiving(room,ctx):kind==='bonemerang'?nextSettlement(room,ctx):continueTurnStart(room,ctx);
  }
  if(pending.kind==='cute-charm') {
    requireRule(['redirect','pass'].includes(input.choice)&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined&&input.effect===undefined,'INVALID_RESPONSE','Redirect with one intense-sun hand card or pass.');
    const resolution=room.resolution;
    requireRule(resolution&&player.active.instanceId===resolution.charmActorInstance&&resolution.targetIds[resolution.targetingIndex]===player.id&&!player.active.defeated&&player.active.catalogueId==='clefairy'&&battleTraitsEffective(room,player.active),'STALE_DECISION','The Cute Charm target changed.');
    if(input.choice==='pass') {
      requireRule(input.cardId===undefined&&input.targetId===undefined,'INVALID_RESPONSE','Passing does not pay or choose a target.');
      resolution.targetingIndex++;
    }else {
      const index=player.hand.findIndex(card=>card.id===input.cardId&&card.weather==='intense-sun');
      requireRule(index>=0,'INVALID_CARD','Choose one intense-sun card from your own hand.');
      requireRule(pending.legalTargetIds.includes(input.targetId)&&charmTargets(room,player,ctx).includes(input.targetId),'INVALID_TARGET','Choose another legal active Pokémon within Cute Charm’s range.');
      room.discardPile.push(...player.hand.splice(index,1));resolution.targetIds[resolution.targetingIndex]=input.targetId;
      abilityVisual(room,player,ctx.catalogue,{targetIds:[input.targetId]});
      note(room,'迷人之躯弃置一张烈日手牌，将此招式的目标转移给另一只宝可梦。','Cute Charm discarded an intense-sun hand card and redirected this move’s target.');
    }
    delete resolution.charmActorInstance;room.pendingBattle=null;return advanceCommandTargets(room,ctx);
  }
  if(pending.kind==='arena-trap') {
    requireRule(['trait','pass'].includes(input.choice)&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined&&input.effect===undefined,'INVALID_RESPONSE','Use Arena Trap or allow this switch.');
    const event=room.switchEvent;
    requireRule(event&&switchStillValid(room,event,ctx)&&event.actorIds[event.index]===player.id&&event.actorInstances[player.id]===player.active.instanceId&&player.active.catalogueId==='diglett'&&battleTraitsEffective(room,player.active),'STALE_DECISION','The switch or trapper changed.');
    room.pendingBattle=null;
    if(input.choice==='trait') {
      const switching=trainer(room,event.playerId);
      abilityVisual(room,player,ctx.catalogue,{targetIds:[switching.id]});
      if(!switching.hand.length)return finishBattleSwitch(room,ctx,false);
      decision(room,'switch-payment',switching.id,switching.id,ctx);Object.assign(room.pendingBattle,{switchKind:event.kind});return;
    }
    event.index++;return advanceBattleSwitch(room,ctx);
  }
  if(pending.kind==='switch-payment') {
    requireRule(['discard','pass'].includes(input.choice)&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined&&input.effect===undefined,'INVALID_RESPONSE','Discard one own hand card or cancel the switch.');
    const event=room.switchEvent;
    requireRule(event&&event.playerId===player.id&&switchStillValid(room,event,ctx),'STALE_DECISION','The switching Pokémon changed.');
    if(input.choice==='pass'){requireRule(input.cardId===undefined,'INVALID_RESPONSE','Canceling does not submit a card.');return finishBattleSwitch(room,ctx,false);}
    const index=player.hand.findIndex(card=>card.id===input.cardId);requireRule(index>=0,'INVALID_CARD','Choose one actual own hand card.');
    room.discardPile.push(...player.hand.splice(index,1));room.pendingBattle=null;event.index++;
    note(room,'沙穴使交替的训练家弃置一张手牌。','Arena Trap made the switching trainer discard one hand card.');
    return advanceBattleSwitch(room,ctx);
  }
  if(pending.kind==='shed-skin') {
    requireRule(['shed','pass'].includes(input.choice)&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined&&input.effect===undefined,'INVALID_RESPONSE','Discard selected hand cards with Shed Skin or pass.');
    const state=room.resolution.modifierState,ids=input.choice==='pass'?[]:input.cardIds;
    requireRule(state&&state.targetId===player.active.instanceId&&hasShedSkin(room,player.active),'STALE_DECISION','The Shed Skin Pokémon changed.');
    requireRule((input.choice!=='pass'||input.cardIds===undefined)&&Array.isArray(ids)&&ids.length<=player.hand.length&&new Set(ids).size===ids.length&&ids.every(id=>typeof id==='string'&&player.hand.some(card=>card.id===id)),'INVALID_CARD','Choose distinct own hand cards.');
    const selected=new Set(ids),cards=player.hand.filter(card=>selected.has(card.id));player.hand=player.hand.filter(card=>!selected.has(card.id));room.discardPile.push(...cards);
    state.amount=Math.max(0,state.amount-cards.length);room.pendingBattle=null;
    if(cards.length)abilityVisual(room,player,ctx.catalogue);
    note(room,`蜕皮弃置${cards.length}张手牌，本次伤害值减${cards.length}。`,`Shed Skin discarded ${cards.length} hand card(s) and reduced this damage by ${cards.length}.`);
    return continueDamageModifiers(room,ctx);
  }
  if(pending.kind==='damage-order') {
    requireRule(input.choice==='damage-effect'&&pending.effects.includes(input.effect)&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined,'INVALID_RESPONSE','Choose the next receiving-damage modifier.');
    const state=room.resolution.modifierState;
    requireRule(state&&player.active.instanceId===state.targetId&&state.remaining.includes(input.effect),'STALE_DECISION','The damage modifiers changed.');
    room.pendingBattle=null;runDamageModifier(room,input.effect,ctx);return;
  }
  if(pending.kind==='turn-start-order') {
    requireRule(input.choice==='start-effect'&&pending.effects.includes(input.effect)&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined,'INVALID_RESPONSE','Choose one pending turn-start effect.');
    requireRule((room.turnStart?.actorIds?.[room.turnStart.index]??room.turnStart?.playerId)===player.id&&room.turnStart.remaining.includes(input.effect),'STALE_DECISION','The turn-start effects changed.');
    room.pendingBattle=null;runTurnStartEffect(room,input.effect,ctx);return;
  }
  if(pending.kind==='effects') {
    requireRule(input.choice==='effect'&&pending.effects.includes(input.effect)&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined,'INVALID_RESPONSE','Choose one pending after-damage effect.');
    const effects=room.resolution.receivingEffects,index=effects.indexOf(input.effect);requireRule(index>=0,'STALE_DECISION','The effect changed.');effects.splice(index,1);room.pendingBattle=null;runReceivingEffect(room,input.effect,ctx);return;
  }
  if(pending.kind==='source-effect-order') {
    requireRule(input.choice==='effect'&&pending.effects.includes(input.effect)&&
      Object.keys(input).every(key=>['id','revision','type','decisionId','choice','effect'].includes(key)),
      'INVALID_RESPONSE','Choose one of the source effects.');
    const resolution=room.resolution;
    requireRule(resolution?.actualDamage>0&&resolution.sourcePlayerId===player.id,'STALE_DECISION','The source effects changed.');
    const effect=dealingDamageEffects(room,ctx,creature(room,resolution.sourceId),creature(room,resolution.targetCreatureId)).get(input.effect);
    requireRule(effect,'STALE_DECISION','The chosen source effect changed.');
    room.pendingBattle=null;
    return effect();
  }
  requireRule(input.effect===undefined,'INVALID_RESPONSE','This decision does not choose an effect.');
  if(pending.kind==='pay-day') {
    requireRule(['trait','pass'].includes(input.choice)&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined,'INVALID_RESPONSE','Inspect Pay Day cards or pass.');
    if(input.choice==='trait') {
      refillDrawPile(room,2);
      const count=Math.min(2,room.drawPile.length);
      if(count) {
        room.resolution.distributionCards=room.drawPile.splice(-count,count).reverse();
        decision(room,'distribute',player.id,player.id,ctx);Object.assign(room.pendingBattle,{choiceCount:count,recipientIds:live(room).map(p=>p.id)});return;
      }
    }
    room.pendingBattle=null;afterDamage(room,ctx);return;
  }
  if(pending.kind==='distribute') {
    const cards=room.resolution.distributionCards||[],allocations=input.allocations;
    requireRule(input.choice==='distribute'&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined&&Array.isArray(allocations)&&allocations.length===cards.length&&new Set(allocations.map(item=>item?.index)).size===cards.length&&allocations.every(item=>item&&typeof item==='object'&&!Array.isArray(item)&&Object.keys(item).length===2&&Object.hasOwn(item,'index')&&Object.hasOwn(item,'recipientId')&&Number.isSafeInteger(item.index)&&item.index>=0&&item.index<cards.length&&pending.recipientIds.includes(item.recipientId)&&live(room).some(p=>p.id===item.recipientId)),'INVALID_RESPONSE','Assign every inspected card once to a living trainer.');
    const batches=new Map();
    for(const allocation of allocations){if(!batches.has(allocation.recipientId))batches.set(allocation.recipientId,{player:trainer(room,allocation.recipientId),cards:[]});batches.get(allocation.recipientId).cards.push(cards[allocation.index]);}
    delete room.resolution.distributionCards;room.pendingBattle=null;
    gainBatches(room,[...batches.values()],'distribution');
    note(room,`聚宝功已分配${cards.length}张查看的牌。`,`Pay Day distributed ${cards.length} inspected card(s).`);
    afterDamage(room,ctx);return;
  }
  if(pending.kind==='exile') {
    requireRule(['exile','pass'].includes(input.choice)&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined,'INVALID_RESPONSE','Choose up to two hand-card slots or pass.');
    const indices=input.choice==='pass'?[]:input.handIndices;
    requireRule((input.choice!=='pass'||input.handIndices===undefined)&&Array.isArray(indices)&&indices.length<=pending.maxCards&&new Set(indices).size===indices.length&&indices.every(index=>Number.isSafeInteger(index)&&index>=0&&index<(room.resolution.handChoiceIds||[]).length),'INVALID_RESPONSE','Choose zero, one or two distinct hand-card slots.');
    const owner=trainer(room,pending.targetId),ids=indices.map(index=>room.resolution.handChoiceIds[index]);
    requireRule(ids.every(id=>owner.hand.some(card=>card.id===id)),'STALE_DECISION','The target hand changed.');
    const cards=ids.map(id=>owner.hand.find(card=>card.id===id));
    owner.hand=owner.hand.filter(card=>!ids.includes(card.id));owner.exiledCards??=[];owner.exiledCards.push(...cards);
    delete room.resolution.handChoiceIds;room.pendingBattle=null;
    note(room,`定身法将${cards.length}张手牌移出游戏，直到该训练家的下次回合开始。`,`Disable removed ${cards.length} hand card(s) until that trainer’s next turn begins.`);
    nextSettlement(room,ctx);return;
  }
  if(pending.kind==='poison-touch') {
    requireRule(['trait','pass'].includes(input.choice)&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined,'INVALID_RESPONSE','Use Poison Touch or pass.');
    const event=room.statusEvent;
    requireRule(event&&event.actorIds[event.index]===player.id&&event.actorInstances[player.id]===player.active?.instanceId&&player.active.catalogueId==='grimer'&&battleTraitsEffective(room,player.active)&&currentHp(player.active,ctx.catalogue)>0,'STALE_DECISION','The Poison Touch responder changed.');
    if(input.choice==='trait') {
      if(event.kind==='status')event.status='poison';else event.damage=2;
      event.index=event.actorIds.length;
      abilityVisual(room,player,ctx.catalogue);
      note(room,event.kind==='status'?'毒手将待生效的特殊状态改为中毒。':'毒手将本次中毒效果的基础伤害改为2点。',event.kind==='status'?'Poison Touch changed the pending status to Poison.':'Poison Touch set this Poison effect’s base damage to 2.');
    }else event.index++;
    room.pendingBattle=null;advancePoisonTouch(room,ctx);return;
  }
  if(pending.kind==='cycle') {
    requireRule(['cycle','pass'].includes(input.choice)&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined,'INVALID_RESPONSE','Discard one hand card to draw, or pass.');
    if(input.choice==='cycle') {
      const index=player.hand.findIndex(card=>card.id===input.cardId);
      requireRule(index>=0,'INVALID_CARD','Choose one card from your own hand.');
      room.discardPile.push(...player.hand.splice(index,1));drawBattleCards(room,player);
      note(room,'尖刺加农炮弃置一张手牌，然后摸一张牌。','Spike Cannon discarded one hand card, then drew one card.');
    }else requireRule(input.cardId===undefined,'INVALID_RESPONSE','Passing does not submit a card.');
    room.pendingBattle=null;afterDamage(room,ctx);return;
  }
  if(pending.kind==='cursed-body') {
    requireRule(['trait','pass'].includes(input.choice)&&input.cardId===undefined&&input.order===undefined&&input.reinforcement===undefined,'INVALID_RESPONSE','Take one source-trainer hand card with Cursed Body or pass.');
    const ids=room.resolution.handChoiceIds||[],sourceTrainer=trainer(room,pending.targetId);
    if(input.choice==='trait') {
      requireRule(Number.isSafeInteger(input.handIndex)&&input.handIndex>=0&&input.handIndex<ids.length,'INVALID_RESPONSE','Choose an available hand-card slot.');
      const index=sourceTrainer.hand.findIndex(card=>card.id===ids[input.handIndex]);
      requireRule(index>=0,'STALE_DECISION','The source trainer hand changed.');
      const [card]=sourceTrainer.hand.splice(index,1);gainBattleCards(room,player,[card],{reason:'take'});
      abilityVisual(room,player,ctx.catalogue,{targetIds:[sourceTrainer.id]});
      note(room,'咒术之躯获得了伤害来源训练家的一张手牌。','Cursed Body took one hand card from the damage source’s trainer.');
    }else requireRule(input.handIndex===undefined,'INVALID_RESPONSE','Passing does not choose a hand-card slot.');
    delete room.resolution.handChoiceIds;room.pendingBattle=null;afterDamage(room,ctx);return;
  }
  if(pending.kind==='scales') {
    requireRule(['trait','pass'].includes(input.choice)&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined,'INVALID_RESPONSE','Use Marvel Scale or pass.');
    const resolution=room.resolution;
    requireRule(player.active.instanceId===resolution.targetCreatureId&&player.active.catalogueId==='dratini'&&battleTraitsEffective(room,player.active)&&player.active.level<=2&&player.active.status&&!player.active.defeated&&resolution.incomingDamage>1,'STALE_DECISION','The incoming damage changed.');
    const amount=resolution.incomingDamage-(input.choice==='trait'?1:0);
    if(input.choice==='trait')abilityVisual(room,player,ctx.catalogue);
    room.pendingBattle=null;
    if(resolution.modifierState){resolution.modifierState.amount=amount;delete resolution.incomingDamage;continueDamageModifiers(room,ctx);}else commitDamage(room,ctx,amount);
    return;
  }
  if(pending.kind==='defiant') {
    const joyRescue=room.resolution?.joyRescue;
    if(joyRescue) requireRule(joyRescue.actorId===player.id,'STALE_DECISION','The rescue actor changed.');
    if(!joyRescue && room.resolution?.kind==='light-ball') {
      requireRule(room.resolution.sourceId===player.active?.instanceId&&player.active.catalogueId==='mankey'&&
        (input.choice!=='trait'||battleTraitsEffective(room,player.active)),'STALE_DECISION','The Light Ball holder changed.');
    }
    if(!joyRescue && room.resolution?.kind==='event') {
      const resolution=room.resolution;
      requireRule(Object.keys(input).every(key=>['id','revision','type','decisionId','choice'].includes(key)),'INVALID_RESPONSE','Defiant accepts only use or pass.');
      requireRule(['mr-mime-trick','farfetchd-prank'].includes(resolution.eventType)&&resolution.eventEffect==='item'&&player.active?.instanceId===resolution.targetInstances[player.id]&&!player.active.defeated&&player.active.catalogueId==='mankey'&&(input.choice!=='trait'||battleTraitsEffective(room,player.active)),'STALE_DECISION','The item-loss recipient changed.');
    }
    requireRule(['trait','pass'].includes(input.choice)&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined,'INVALID_RESPONSE','Use Defiant or pass.');
    if(input.choice==='trait'){drawBattleCards(room,player,2);room.turn.noHandLimitIds??=[];if(!room.turn.noHandLimitIds.includes(player.id))room.turn.noHandLimitIds.push(player.id);abilityVisual(room,player,ctx.catalogue);note(room,'不服输摸两张牌，本回合没有手牌上限。','Defiant drew two cards and removed this trainer’s hand limit for the current turn.');}
    room.pendingBattle=null;
    if (joyRescue) {
      delete room.resolution.joyRescue;
      return continueRescueAfterHealing(room,player,joyRescue.targetId,ctx);
    }
    if(room.resolution?.kind==='light-ball')return applyStatus(room,ctx,creature(room,room.resolution.targetCreatureId),'paralysis','light-ball');
    if(room.resolution?.kind==='event'&&['mr-mime-trick','farfetchd-prank'].includes(room.resolution.eventType))return nextSettlement(room,ctx);
    if(room.tourDefiantNext) {
      const next=room.tourDefiantNext;delete room.tourDefiantNext;
      if(next.kind==='damage')return afterDamage(room,ctx);
      return requestBattleSwitch(room,trainer(room,next.playerId),'tour-post',ctx);
    }
    return;
  }
  if(pending.kind==='judgment') {
    requireRule(input.reinforcement===undefined&&input.order===undefined&&input.handIndex===undefined,'INVALID_RESPONSE','This judgment only accepts replacement or pass.');
    const judgment=room.judgment;
    requireRule(judgment && judgment.actorIds[judgment.index]===player.id && judgment.actorInstances[player.id]===player.active.instanceId && player.active.catalogueId==='vulpix' && battleTraitsEffective(room,player.active),'STALE_DECISION','The judgment responder changed.');
    requireRule(input.choice==='replace'||input.choice==='pass','INVALID_RESPONSE','Replace with a sunny hand card or pass.');
    if(input.choice==='replace') {
      const index=player.hand.findIndex(card=>card.id===input.cardId && ['intense-sun','clear'].includes(card.weather));
      requireRule(index>=0,'INVALID_CARD','Choose a sunny-weather card from your own hand.');
      const [replacement]=player.hand.splice(index,1);gainBattleCards(room,player,[judgment.card],{reason:'judgment-replacement'});judgment.card=replacement;
      abilityVisual(room,player,ctx.catalogue);
      note(room,'日照替换判定牌，并获得刚被替换的牌。','Drought replaced the judgment and obtained the displaced card.',
        {judgment:publicJudgmentFace(replacement)});
    }else requireRule(input.cardId===undefined,'INVALID_RESPONSE','Passing does not submit a card.');
    judgment.index++;room.pendingBattle=null;advanceJudgment(room,ctx);return;
  }
  if(pending.kind==='reinforcement') {
    requireRule(input.choice==='reinforcement' && input.cardId===undefined && input.handIndex===undefined && input.order===undefined && pending.reinforcements.includes(input.reinforcement),'INVALID_RESPONSE','Choose one target reinforcement marker.');
    const target=trainer(room,pending.targetId)?.active;
    requireRule(target?.instanceId===room.resolution.markerTargetId && target.reinforcements.includes(input.reinforcement),'STALE_DECISION','The target reinforcement changed.');
    target.reinforcements.splice(target.reinforcements.indexOf(input.reinforcement),1);
    if (input.reinforcement === 'defense') delete target.hoennClayDefense;
    const labels={power:['力量','Power'],defense:['防御','Defense'],speed:['速度','Speed']}[input.reinforcement];
    note(room,`${pending.timing==='after-damage'?'招式造成伤害后':'招式使用时'}弃置目标的一枚${labels[0]}强化指示物。`,`The move discarded one ${labels[1]} reinforcement from the target ${pending.timing==='after-damage'?'after damage':'before defense'}.`);
    if(pending.timing==='after-damage'){delete room.resolution.markerTargetId;room.pendingBattle=null;afterDamage(room,ctx);return;}
    delete room.resolution.markerTargetId;room.pendingBattle=null;room.resolution.useIndex=(room.resolution.useIndex??0)+1;
    openMoveUse(room,ctx);return;
  }
  requireRule(input.reinforcement===undefined,'INVALID_RESPONSE','This decision does not choose a reinforcement.');
  if(pending.kind==='reorder') {
    const ids=room.resolution.scryCardIds||[],order=input.order;
    requireRule(input.choice==='order' && input.cardId===undefined && input.handIndex===undefined && Array.isArray(order) && order.length===ids.length && new Set(order).size===ids.length && order.every(index=>Number.isSafeInteger(index)&&index>=0&&index<ids.length),'INVALID_RESPONSE','Choose every viewed card once, next draw first.');
    const top=room.drawPile.slice(-ids.length).reverse();
    requireRule(top.length===ids.length && top.every((card,index)=>card.id===ids[index]),'STALE_DECISION','The inspected top cards changed.');
    const reordered=order.map(index=>top[index]);
    room.drawPile.splice(room.drawPile.length-ids.length,ids.length,...reordered.reverse());
    delete room.resolution.scryCardIds;room.pendingBattle=null;
    note(room,'预知未来已将查看的牌按所选顺序放回牌堆顶。','Future Sight returned the viewed cards to the deck top in the chosen order.');
    openDefense(room,ctx);return;
  }
  requireRule(input.order===undefined,'INVALID_RESPONSE','This decision does not reorder cards.');
  if(pending.kind==='hand') {
    requireRule(input.choice==='card' && input.cardId===undefined && Number.isSafeInteger(input.handIndex),'INVALID_RESPONSE','Choose a hand-card slot.');
    const ids=room.resolution.handChoiceIds||[],target=trainer(room,pending.targetId);
    requireRule(input.handIndex>=0 && input.handIndex<ids.length,'INVALID_RESPONSE','Choose an available hand-card slot.');
    const index=target.hand.findIndex(card=>card.id===ids[input.handIndex]);
    requireRule(index>=0,'STALE_DECISION','The hand-card choice changed.');
    const [card]=target.hand.splice(index,1);
    if(pending.effect==='take')gainBattleCards(room,player,[card],{reason:'take'});else room.discardPile.push(card);
    delete room.resolution.handChoiceIds;room.pendingBattle=null;
    note(room,pending.effect==='take'?'招式获得了目标训练家的一张手牌。':'招式弃置了目标训练家的一张手牌。',pending.effect==='take'?"The move took one card from the target trainer's hand.":"The move discarded one card from the target trainer's hand.");
    afterDamage(room,ctx);return;
  }
  requireRule(input.handIndex===undefined,'INVALID_RESPONSE','This decision does not choose a hand-card slot.');
  requireRule(input.choice==='dodge'||input.cardId===undefined,'INVALID_RESPONSE','This response cannot submit a card.');
  if(pending.kind==='foresee') {
    requireRule(input.choice==='pass'||input.choice==='trait','INVALID_RESPONSE','Use Future Sight or pass.');
    if(input.choice==='trait') {
      refillDrawPile(room,3);
      const ids=room.drawPile.slice(-3).reverse().map(card=>card.id);
      if(ids.length) {
        room.resolution.scryCardIds=ids;decision(room,'reorder',player.id,player.id,ctx);
        room.pendingBattle.choiceCount=ids.length;return;
      }
    }
    room.pendingBattle=null;openDefense(room,ctx);return;
  }
  if(pending.kind==='synchronize') {
    requireRule(input.choice==='pass'||input.choice==='trait','INVALID_RESPONSE','Use Synchronize or pass.');
    if(input.choice==='trait') {
      const resolution=room.resolution;
      requireRule(resolution.card && !resolution.cardClaimedBy && ['command','event'].includes(resolution.card.kind),'TRAIT_UNAVAILABLE','The damage-causing card is unavailable.');
      resolution.cardClaimedBy=player.id;gainBattleCards(room,player,[resolution.card],{reason:'synchronize'});
      abilityVisual(room,player,ctx.catalogue);
      const eventName=resolution.eventName;
      if(eventName)note(room,`${player.nickname}发动同步，将刚使用的「${eventName.zh}」收入手牌。`,`${player.nickname} used Synchronize to take the played ${eventName.en} into their hand.`);
      else note(room,'同步获得了造成此次伤害的牌。','Synchronize obtained the card that caused this damage.');
    }
    room.pendingBattle=null;afterDamage(room,ctx);return;
  }
  if(pending.kind==='static') {
    requireRule(input.choice==='pass'||input.choice==='trait','INVALID_RESPONSE','Use Static or pass.');
    if(input.choice==='trait') {
      return startJudgment(room,ctx,{kind:'static',sourceId:room.resolution.sourceId},player.id);
    }
    room.pendingBattle=null;afterDamage(room,ctx);return;
  }
  if(pending.kind==='poison-point') {
    requireRule(input.choice==='pass'||input.choice==='trait','INVALID_RESPONSE','Use Poison Point or pass.');
    if(input.choice==='trait')return startJudgment(room,ctx,{kind:'poison-point',sourceId:room.resolution.sourceId},player.id);
    room.pendingBattle=null;afterDamage(room,ctx);return;
  }
  if(pending.kind==='defense') {
    requireRule(['pass','dodge','trait','bright-powder','tour-protect'].includes(input.choice),'INVALID_RESPONSE','Choose a defense or pass.');
    if(input.choice==='tour-protect') {
      requireRule(!pending.cannotDodge && pending.canTourProtect && activeItemIs(room,player.active,'tour-protect') && !room.turn.tourProtectUsed?.includes(player.active.instanceId),'ITEM_UNAVAILABLE','Protect TM is unavailable.');
      room.turn.tourProtectUsed ??= [];
      room.turn.tourProtectUsed.push(player.active.instanceId);
      pending.canTourProtect = false;
      const defense = structuredClone(pending);
      if (defense.clock) { if(defense.clock.deadlineAt!==null) defense.clock.remainingMs=Math.max(0,defense.clock.deadlineAt-ctx.now()); defense.clock.deadlineAt=null; }
      return startJudgment(room,ctx,{kind:'tour-protect',defense},player.id);
    }
    if(input.choice==='trait'||input.choice==='bright-powder') {
      const powder=input.choice==='bright-powder';
      if(powder) {
        requireRule(Object.keys(input).every(key=>['id','revision','type','decisionId','choice'].includes(key)),'INVALID_RESPONSE','Bright Powder needs no card or extra fields.');
        requireRule(!pending.cannotDodge&&pending.canBrightPowder&&player.active?.instanceId===room.resolution.targetCreatureId&&activeItemIs(room,player.active,'bright-powder')&&room.drawPile.length+room.discardPile.length>0,'ITEM_UNAVAILABLE','Bright Powder is unavailable for this settlement.');
        pending.canBrightPowder=false;
      }else {
        requireRule(pending.canTrait && !pending.traitAttempted && canSandVeil(room,player),'TRAIT_UNAVAILABLE','Sand Veil is unavailable for this settlement.');
        pending.traitAttempted=true;pending.canTrait=false;
      }
      const defense=structuredClone(pending);
      if(defense.clock){if(defense.clock.deadlineAt!==null)defense.clock.remainingMs=Math.max(0,defense.clock.deadlineAt-ctx.now());defense.clock.deadlineAt=null;}
      startJudgment(room,ctx,{kind:powder?'bright-powder':'sand-veil',defense},player.id);
      return;
    }
    if(input.choice==='dodge') {
      requireRule(!pending.cannotDodge,'INVALID_RESPONSE','This move cannot be canceled by Dodge!');
      const responseIndex=player.hand.findIndex(card=>card.id===input.cardId);
      const response=player.hand[responseIndex];
      const levitate=player.active?.catalogueId==='gastly'&&player.active.level<=2&&battleTraitsEffective(room,player.active)&&['rain','thunderstorm'].includes(response?.weather);
      requireRule(responseIndex>=0&&(response.kind==='dodge'||levitate),'INVALID_CARD','Choose Dodge! or a rainy hand card with Levitate.');
      requireRule(!pending.blockedDodgeWeathers?.includes(response.weather),'INVALID_CARD','Compound Eyes prevents an intense-sun Dodge against this move.');
      player.hand.splice(responseIndex,1);room.discardPile.push(response);
      if (levitate && response.kind!=='dodge') abilityVisual(room,player,ctx.catalogue);
      moveDodgeVisual(room,player.id);
      if(pending.dodgeReducesDamage) {
        abilityVisual(room,trainer(room,room.resolution.sourcePlayerId),ctx.catalogue);
        pending.damageReduction=reduceMoveDamage(room,room.resolution.targetCreatureId);
        note(room,'锐利目光将快躲开！改为此招式对该宝可梦的伤害减1，持续到整个招式结束。','Keen Eye changed Dodge! into one damage reduction for this Pokémon until the whole move ends.');return;
      }
      if(pending.dodgesRequired===2&&++pending.dodgesPlayed<2){note(room,'已使用一次躲闪，仍需要另一次才能抵消本次结算。','One Dodge was played. Another is required to cancel this settlement.');return;}
      note(room,'快躲开！抵消了本次结算。','Dodge! canceled this settlement.');return cancelMoveWithDodge(room,ctx,response);
    }else settleDamage(room,ctx);
    return;
  }
  requireRule(false,'INVALID_RESPONSE','Choose a supported response.');
}
export function useBattleTrait(room, player, ctx,input={}) {
  requireRule(previewActions(room, player, ctx.catalogue)?.canTrait, 'TRAIT_UNAVAILABLE', 'This optional trait is unavailable now.');
  requireRule(player.active.catalogueId==='rhyhorn'||input.hpLoss===undefined,'INVALID_INPUT','Only Reckless chooses HP loss.');
  if(player.active.catalogueId==='rhyhorn') {
    const loss=input.hpLoss,pokemon=player.active;
    requireRule(input.cardIds===undefined&&Number.isSafeInteger(loss)&&loss>=0&&Number.isSafeInteger((pokemon.damage||0)+loss),'INVALID_INPUT','Choose a nonnegative whole HP loss within the safe numeric range.');
    abilityVisual(room,player,ctx.catalogue);
    room.turn.traitsUsed??=[];room.turn.traitsUsed.push(pokemon.instanceId);
    room.resolution={kind:'hp-loss',card:null,sourceId:null,sourcePlayerId:player.id,targetCreatureId:pokemon.instanceId,targetIds:[player.id],index:0,damagedIds:[],defenseIds:[],actualDamage:0,lossDraw:{playerId:player.id,count:loss}};
    pokemon.damage=(pokemon.damage||0)+loss;
    note(room,`舍身失去${loss}点体力；这不是伤害。`,`Reckless lost ${loss} HP; this is not damage.`);
    if(currentHp(pokemon,ctx.catalogue)<=0)return beginRescue(room,player.id,ctx);
    return afterDamage(room,ctx);
  }
  if(player.active.catalogueId==='magnemite') {
    const ids=input.cardIds,max=previewActions(room,player,ctx.catalogue).trait.maxCards;
    requireRule(Array.isArray(ids)&&ids.length<=max&&new Set(ids).size===ids.length&&ids.every(id=>typeof id==='string'&&player.hand.some(card=>card.id===id)),'INVALID_CARD','Choose distinct own hand cards up to this Pokémon’s current HP.');
    abilityVisual(room,player,ctx.catalogue);
    room.turn.traitsUsed??=[];room.turn.traitsUsed.push(player.active.instanceId);
    const selected=new Set(ids),cards=player.hand.filter(card=>selected.has(card.id));
    player.hand=player.hand.filter(card=>!selected.has(card.id));room.discardPile.push(...cards);
    drawBattleCards(room,player,cards.length,'analytic');
    note(room,`分析弃置${cards.length}张手牌，然后摸取等量的牌。`,`Analytic discarded ${cards.length} hand card(s), then drew the same number.`);return;
  }
  requireRule(input.cardIds===undefined,'INVALID_INPUT','This trait does not choose hand cards.');
  if (['staryu','exeggcute'].includes(player.active.catalogueId)) abilityVisual(room,player,ctx.catalogue);
  room.turn.traitsUsed ??= []; room.turn.traitsUsed.push(player.active.instanceId);
  if(player.active.catalogueId==='porygon') {
    room.turn.drawStarted=true;
    room.drawChoice={kind:'download',playerId:player.id,pokemonId:player.active.instanceId};
    const targets=live(room).filter(target=>target.id!==player.id&&target.hand.length).map(target=>target.id);
    decision(room,'download',player.id,player.id,ctx);Object.assign(room.pendingBattle,{legalTargetIds:targets,maxTargets:Math.min(2,targets.length)});return;
  }
  if(player.active.catalogueId==='electabuzz') {
    room.turn.drawStarted=true;
    refillDrawPile(room,3);
    const ids=room.drawPile.slice(-3).reverse().map(card=>card.id);
    if(!ids.length){room.turn.drawRemaining=0;room.turn.phase='play';return;}
    room.drawChoice={playerId:player.id,pokemonId:player.active.instanceId,cardIds:ids};
    decision(room,'vital-spirit',player.id,player.id,ctx);room.pendingBattle.requiredCards=Math.min(2,ids.length);return;
  }
  if(player.active.catalogueId==='staryu') {
    if(room.drawPile.length+room.discardPile.length) {
      drawBattleCards(room,player,1,'illuminate');
      note(room,'发光额外摸取了1张牌。','Illuminate drew one extra card.');
    }
    else note(room,'发光已发动，但当前没有可摸取的牌。','Illuminate was used, but no card is currently available to draw.');
    return;
  }
  if(player.active.catalogueId==='exeggcute') {
    room.turn.discardComplete=true;
    if(room.drawPile.length+room.discardPile.length)drawBattleCards(room,player,1,'harvest');
    else note(room,'收获已发动，但当前没有可摸取的牌。','Harvest was used, but no card is currently available to draw.');
    return;
  }
  if(player.active.catalogueId==='psyduck')room.turn.swiftSwimUsed=true;
  startJudgment(room,ctx,{kind:'trait',sourceId:player.active.instanceId,family:player.active.catalogueId,ownerId:player.id},player.id);
}
export function beginBattleTurn(room, player, ctx) {
  delete room.tourDexSurvey;
  if (room.fieldWeather?.expiresAtTurn <= room.turn.number) {
    delete room.fieldWeather;
    note(room, '场上天气结束。', 'Field weather ended.');
  }
  if(room.initialBattleEntries) {
    const players=room.initialBattleEntries.map(id=>trainer(room,id));delete room.initialBattleEntries;
    return beginBattleEntries(room,players,ctx,{kind:'turn',playerId:player.id});
  }
  for (const pokemon of [player.active, player.reserve]) {
    if (!pokemon) continue;
    delete pokemon.hoennUmbrella;
    if (pokemon.hoennClayDefense) clearDefense(pokemon);
  }
  if (player.emergencyRetreatDebt) {
    room.turn.switchUsed = true;
    delete player.emergencyRetreatDebt;
    note(room,'此前的紧急撤退已占用本回合的普通交替。','An earlier Emergency Retreat used the ordinary switch for this turn.');
  }
  if (player.raidBoss && room.scenario.lake.phase===2) room.turn.drawRemaining++;
  room.turn.drawStarted=false;
  room.turn.dodgeBlockedCreatureIds=[];
  room.turn.suppressedTraitPlayerIds=[];
  room.turn.noHandLimitIds=[];
  room.turn.justifiedUsed = false;
  room.turn.pickupUsedIds=[];
  room.turn.swiftSwimUsed=false;room.turn.cardRangePlayerId=null;room.turn.swiftSwimCreatureIds=[];
  room.turn.usedMoves = []; room.turn.traitsUsed = []; room.turn.commandCreatureId = null; room.turn.rangeCreatureId = null;
  room.turn.movesBlocked = false; room.turn.switchBlocked = false;
  room.turn.blockedMoveIds = []; room.turn.damageImmunityIds = [];
  delete room.turnStart;
  if (room.turn.weatherLabRoundStart) {
    delete room.turn.weatherLabRoundStart;
    const research = room.scenario.weatherLab;
    research.round++;
    research.forecast = null;
    return startJudgment(room,ctx,{kind:'weather-lab',playerId:player.id},player.id);
  }
  continueBattleTurnStart(room,player,ctx);
}
function continueBattleTurnStart(room,player,ctx) {
  if (room.turn.rocketPledgePending) {
    delete room.turn.rocketPledgePending;
    const infiltrator = live(room).find(seat=>seat.role==='infiltrator');
    if (infiltrator) {
      tourDecision(room,infiltrator,{zh:'潜伏者表态',en:'Infiltrator’s Allegiance'},[
        {value:'independent',label:{zh:'保持独立',en:'Stay independent'}},
        {value:'rocket',label:{zh:'加入火箭队',en:'Join Team Rocket'}},
      ],{kind:'rocket-pledge'},ctx);
      room.pendingBattle.detail = {
        zh:'选择会向全桌公开，整局不能再更改。超时默认保持独立。',
        en:'This choice is public and final. If time expires, stay independent.',
      };
      return;
    }
  }
  const remaining=[...(player.exiledCards?.length?['return-cards']:[]),...(['flinch','sleep','confusion','poison'].includes(player.active.status)?['status']:[]),...(player.active.catalogueId==='koffing'?['neutralizing-gas']:[])];
  const index=room.players.findIndex(p=>p.id===player.id),actors=[player,...[...room.players.slice(index+1),...room.players.slice(0,index)].filter(p=>!p.spectator&&!p.eliminated&&p.active?.catalogueId==='koffing'&&!p.active.defeated)];
  if(player.delayedEvents?.length||remaining.length||actors.length>1||player.active.catalogueId==='jynx'||live(room).some(seat=>seat.id!==player.id&&activeItemIs(room,seat.active,'quick-claw'))) {
    room.turnStart={playerId:player.id,pokemonId:player.active.instanceId,remaining,actorIds:actors.map(p=>p.id),actorInstances:Object.fromEntries(actors.map(p=>[p.id,p.active.instanceId])),index:0};
    continueTurnStart(room,ctx);
  }
}
const sunnyCommand=card=>card.kind==='command'&&['intense-sun','clear'].includes(card.weather);
function quickClawHolder(room,ctx,entry) {
  const holder=activeOwner(room,entry.pokemonId);
  return holder?.id===entry.playerId&&holder.active.item?.id===entry.itemId&&
    activeItemIs(room,holder.active,'quick-claw')&&currentHp(holder.active,ctx.catalogue)>0?holder:null;
}
function offerQuickClaw(room,ctx,start) {
  const turnOwner=trainer(room,start.playerId);
  if(!turnOwner?.active||turnOwner.eliminated)return false;
  if(!start.quickClawHolders) {
    const order=live(room),index=order.findIndex(seat=>seat.id===turnOwner.id);
    const others=[...order.slice(index+1),...order.slice(0,index)];
    start.quickClawHolders=others.filter(seat=>activeItemIs(room,seat.active,'quick-claw')).map(seat=>({playerId:seat.id,pokemonId:seat.active.instanceId,itemId:seat.active.item.id}));
    start.quickClawIndex=0;
    start.quickClawTarget=turnOwner.active.instanceId;
  }
  if(turnOwner.active.instanceId!==start.quickClawTarget)return false;
  while(start.quickClawIndex<start.quickClawHolders.length) {
    const holder=quickClawHolder(room,ctx,start.quickClawHolders[start.quickClawIndex]);
    if(holder?.hand.some(sunnyCommand)) {
      const moves=moveOptions(room,holder,ctx.catalogue,true,turnOwner.id).filter(move=>move.canUse);
      if(moves.length) {
        decision(room,'quick-claw',holder.id,turnOwner.id,ctx);
        room.pendingBattle.moves=moves;
        return true;
      }
    }
    start.quickClawIndex++;
  }
  return false;
}
function returnExiledCards(room,player) {
  const cards=player.exiledCards||[];player.exiledCards=[];
  gainBattleCards(room,player,cards,{reason:'return'});
  if(player.eliminated){room.discardPile.push(...player.hand);player.hand=[];}
  note(room,`${cards.length}张移出游戏的牌返回该训练家的手牌。`,`${cards.length} removed card(s) returned to that trainer’s hand.`);
}
function continueTurnStart(room,ctx) {
  const start=room.turnStart;if(!start)return;
  const owner = trainer(room, start.playerId);
  if (owner && !owner.eliminated && owner.delayedEvents?.length) {
    const card = owner.delayedEvents.shift();
    const eventName = hoennDelayedEvents[card.eventType].name;
    room.resolution = { kind:'event', card, eventType:card.eventType, eventName, sourceId:null, sourcePlayerId:null,
      targetCreatureId:owner.active.instanceId, targetIds:[owner.id], index:0, damagedIds:[], defenseIds:[], actualDamage:0,
      ...(card.eventType === 'hoenn-raikou' ? { externalSource:{ kind:'external-pokemon', name:{ zh:'雷公', en:'Raikou' } } } : {}) };
    visualEvent(room, 'event', { targetIds:[owner.id], name:eventName, effect:card.eventType });
    note(room, `现在判定${eventName.zh}。`, `Judging ${eventName.en}.`);
    return startJudgment(room, ctx, { kind:'hoenn-delayed' }, owner.id);
  }
  // Legacy saved local turn-start queues retain their original continuation.
  start.actorIds??=[start.playerId];start.actorInstances??={[start.playerId]:start.pokemonId};start.index??=0;
  while(start.index<start.actorIds.length) {
    const actor=trainer(room,start.actorIds[start.index]);
    if(actor?.id===start.playerId&&actor.eliminated&&start.remaining.includes('return-cards'))returnExiledCards(room,actor);
    if(!actor||actor.eliminated)start.remaining=[];
    if(start.remaining.includes('neutralizing-gas')&&(!actor||actor.active?.instanceId!==start.actorInstances[actor.id]||actor.active.catalogueId!=='koffing'||!battleTraitsEffective(room,actor.active)||(!actor.hand.length&&start.remaining.length===1)))start.remaining=start.remaining.filter(effect=>effect!=='neutralizing-gas');
    if(start.remaining.length) {
      if(start.remaining.length>1) {
        decision(room,'turn-start-order',actor.id,actor.id,ctx);room.pendingBattle.effects=[...start.remaining];return;
      }
      return runTurnStartEffect(room,start.remaining[0],ctx);
    }
    start.index++;start.remaining=start.index<start.actorIds.length?['neutralizing-gas']:[];
  }
  if(offerQuickClaw(room,ctx,start))return;
  if(!start.preparationDone) {
    start.preparationDone=true;
    const owner=trainer(room,start.playerId),pokemon=owner?.active;
    if(owner&&!owner.eliminated&&pokemon?.catalogueId==='jynx'&&battleTraitsEffective(room,pokemon)&&currentHp(pokemon,ctx.catalogue)>0&&room.drawPile.length+room.discardPile.length>0){start.preparationPokemonId=pokemon.instanceId;decision(room,'forewarn',owner.id,owner.id,ctx);return;}
  }
  delete room.turnStart;room.pendingBattle=null;
}
function runTurnStartEffect(room,effect,ctx) {
  const start=room.turnStart,player=trainer(room,start.actorIds?.[start.index]??start.playerId);
  start.remaining.splice(start.remaining.indexOf(effect),1);
  if(effect==='neutralizing-gas') {
    if(!player.hand.length)return continueTurnStart(room,ctx);
    decision(room,'neutralizing-gas',player.id,player.id,ctx);room.pendingBattle.legalTargetIds=live(room).map(p=>p.id);return;
  }
  if(effect==='return-cards'){returnExiledCards(room,player);return continueTurnStart(room,ctx);}
  const pokemon=creature(room,start.pokemonId);
  if(!pokemon||player.active.instanceId!==pokemon.instanceId||pokemon.defeated)return continueTurnStart(room,ctx);
  const status = pokemon.status;
  if (status === 'flinch') { player.active.status = null; room.turn.drawRemaining = 1; }
  if (status === 'sleep') { player.active.status = null; room.turn.blockedMoveIds.push(player.active.instanceId); room.turn.switchBlocked = true; }
  if (status === 'confusion') { player.active.status = null; room.turn.blockedMoveIds.push(player.active.instanceId); }
  if (status === 'poison' || status === 'confusion') {
    const damage = status === 'confusion' ? computeDamage(pokemon, pokemon, 1, ctx.catalogue, damageOptions(room,pokemon,pokemon,{ command: false,receiving:false })) : 1;
    room.resolution = { kind: 'turn-start', targetCreatureId: pokemon.instanceId, sourceId: status === 'confusion' ? pokemon.instanceId : null, sourcePlayerId: status === 'confusion' ? player.id : null, damagedIds: [], defenseIds: [], actualDamage: 0 };
    if(status==='poison')return startPoisonTouch(room,ctx,{kind:'poison',targetId:pokemon.instanceId,damage:1});
    settleDealtDamage(room,ctx,damage);
    return;
  }
  continueTurnStart(room,ctx);
}
export function publicBattlePokemon(pokemon, catalogue, room, own = false) {
  if (!pokemon) return null;
  const turn=room?.turn;
  let fieldTrait;
  const mask = !own && room?.status==='playing' ? pokemon.hoennIllusion : null;
  const presented = mask ? {...pokemon,...mask} : pokemon;
  const fieldForm = presented.catalogueId === MIMIKYU_ID && presented.disguiseSpent
    ? 'busted' : room && castformWeather(room, presented);
  if(pokemon.catalogueId==='bulbasaur' && turn?.rangeCreatureId===pokemon.instanceId) fieldTrait='chlorophyll';
  if(pokemon.catalogueId==='psyduck' && turn?.swiftSwimCreatureIds?.includes(pokemon.instanceId)) fieldTrait='swift-swim';
  if(room && pokemon.catalogueId==='slowpoke' && damageImmune(room,pokemon)) fieldTrait='oblivious';
  return { catalogueId: presented.catalogueId, level: presented.level, ...(own&&pokemon.hoennIllusion?{illusionActive:true}:{}), hp: currentHp(pokemon, catalogue), maxHp: maxHp(pokemon, catalogue), status: pokemon.status, damageProtected:Boolean(room&&damageImmune(room,pokemon)),traitsSuppressed:!pokemon.defeated&&!battleTraitsEffective(room,pokemon),reinforcementsSuppressed:Boolean(room&&reinforcementsSuppressed(room,pokemon)), ...(fieldTrait?{fieldTrait}:{}), ...(fieldForm ? { fieldForm } : {}), ...(pokemon.raidColor ? {raidColor:pokemon.raidColor} : {}), ...(pokemon.hoennUmbrella ? {hoennUmbrella:true} : {}), ...(pokemon.hoennClayDefense ? {hoennClayDefense:true} : {}), ...(pokemon.item?{item:publicItem(pokemon.item),itemSuppressed:!itemEffective(room,pokemon),...(gluttonyReplacesItem(room,pokemon)?{itemEffectReplacement:'gluttony'}:{})}:{}), defeated: Boolean(pokemon.defeated), reinforcements: [...(pokemon.reinforcements || [])] };
}


// The tour uses the original response, switch and damage continuations.
const tourEnabled = room => hasPack(room.settings?.contentPack, TOUR_PACK);
const livingReserve = (player, catalogue) => player.reserve && !player.reserve.defeated && currentHp(player.reserve, catalogue) > 0;
const tourCanSwitch = (room, player, catalogue) => !room.turn.switchBlocked && !player.eliminated &&
  player.active && !player.active.defeated && currentHp(player.active, catalogue) > 0 && livingReserve(player, catalogue);
const showdownTargets = (room, player) => live(room).filter(other => other.id !== player.id && other.hand.length);
const canGoAllOut = (room, player, catalogue) => !player.tourAllOutUsed &&
  currentHp(player.active, catalogue) >= 2 && room.drawPile.length + room.discardPile.length >= 2;
const tourCardOption = card => ({ value: card.id, label: card.name, card: { id: card.id, name: card.name, kind: card.kind, weather: card.weather } });
function tourDecision(room, player, title, options, continuation, ctx, allowPass = false) {
  requireRule(options.length > 0, 'INVALID_RESPONSE', 'There must be an available choice.');
  decision(room, 'expansion', player.id, player.id, ctx);
  Object.assign(room.pendingBattle, { title, options, continuation, allowPass });
}
const showdownOrder = { zh: '雷雨 ＞ 暴雨 ＞ 烈日 ＞ 晴朗', en: 'Thunderstorm > Heavy Rain > Intense Sun > Clear' };
function showdownDecision(room, player, other, title, options, continuation, ctx, allowPass) {
  tourDecision(room, player, title, options, continuation, ctx, allowPass);
  Object.assign(room.pendingBattle, { targetId: other?.id ?? player.id, detail: showdownOrder });
}
function resolveShowdown(room, player, option, next, ctx) {
  if (next.kind === 'showdown-target') {
    const other = showdownTargets(room, player).find(target => target.id === option.value);
    requireRule(other, 'STALE_DECISION', 'The selected trainer is no longer eligible.');
    return showdownDecision(room, player, other, { zh: '训练家对视 · 暗选一张手牌', en: 'Trainer Showdown · choose a hand card' },
      player.hand.map(tourCardOption), { kind: 'showdown-commit', opponentId: other.id }, ctx, true);
  }
  if (next.kind === 'showdown-commit') {
    const other = showdownTargets(room, player).find(target => target.id === next.opponentId);
    requireRule(other && player.hand.some(card => card.id === option.value),
      'STALE_DECISION', 'The selected trainer or hand card has changed.');
    room.turn.tourShowdownUsed = true;
    return showdownDecision(room, other, player, { zh: '训练家对视 · 暗选一张手牌', en: 'Trainer Showdown · choose a hand card' },
      other.hand.map(tourCardOption), { kind: 'showdown-reveal', sourceId: player.id, cardId: option.value }, ctx, false);
  }
  const source = trainer(room, next.sourceId);
  const committed = source?.hand.find(card => card.id === next.cardId);
  const response = player.hand.find(card => card.id === option.value);
  requireRule(committed && response, 'STALE_DECISION', 'The Showdown hand cards have changed.');
  const cards = [takeCard(source, committed.id, committed.kind), takeCard(player, response.id, response.kind)];
  room.discardPile.push(...cards);
  const margin = showdownWeatherRank[committed.weather] - showdownWeatherRank[response.weather];
  const winner = margin > 0 ? source : margin < 0 ? player : null;
  if (winner) drawBattleCards(room, winner, 1, 'showdown');
  const [sourceZh, sourceEn] = printedWeatherNames[committed.weather];
  const [responseZh, responseEn] = printedWeatherNames[response.weather];
  const captionZh = winner ? `，${winner.nickname}获胜并摸一张牌。` : '，平局。';
  const captionEn = winner ? `. ${winner.nickname} won and drew one card.` : '. Draw.';
  note(room, `训练家对视：${source.nickname}亮出${sourceZh}「${committed.name.zh}」，${player.nickname}亮出${responseZh}「${response.name.zh}」${captionZh}`,
    `Trainer Showdown: ${source.nickname} revealed ${committed.name.en} (${sourceEn}); ${player.nickname} revealed ${response.name.en} (${responseEn})${captionEn}`);
}
function wobbuffetResponse(room, owner, catalogue) {
  const hit=room.resolution, pokemon=owner.active;
  if (pokemon?.catalogueId!=='hoenn-wobbuffet' || hit?.kind!=='move' || hit.actualDamage<=0 ||
      hit.targetCreatureId!==pokemon.instanceId || room.turn.wobbuffetCounterIds?.includes(pokemon.instanceId) ||
      !hasPack(room.settings.contentPack,HOENN_PACK) || !battleTraitsEffective(room,pokemon) || currentHp(pokemon,catalogue)<=0) return null;
  const source=activeOwner(room,hit.sourceId);
  if (!source || source.id===owner.id || damageImmune(room,source.active) || currentHp(source.active,catalogue)<=0) return null;
  const command = hit.card?.kind==='command' || hit.virtualCommand;
  if (!command && pokemon.level<2) return null;
  const move = command ? counterMoves.command : counterMoves.weather;
  const cards=owner.hand.filter(card=>move.weather.includes(card.weather));
  return cards.length ? {move,cards,source} : null;
}
function recordLightClay(room, target) {
  if (target.hoennClayDefense || !activeItemIs(room,target,lightClay.itemType) || !hasPack(room.settings.contentPack,HOENN_PACK)) return;
  const entries = room.resolution.lightClayChecks ??= [];
  if (!entries.some(entry => entry.pokemonId === target.instanceId)) entries.push({pokemonId:target.instanceId,itemId:target.item.id});
}
function canUseLightClay(room, resolution, pokemon, itemId, catalogue) {
  return pokemon?.item?.id === itemId && activeItemIs(room,pokemon,lightClay.itemType) &&
    currentHp(pokemon,catalogue)>0 && !pokemon.hoennClayDefense && pokemon.reinforcements.includes('defense') &&
    resolution.defenseIds.includes(pokemon.instanceId);
}
function offerLightClay(room, ctx) {
  const resolution = room.resolution;
  while (resolution.lightClayChecks?.length) {
    const {pokemonId,itemId} = resolution.lightClayChecks.shift();
    const owner = activeOwner(room,pokemonId);
    if (!canUseLightClay(room,resolution,owner?.active,itemId,ctx.catalogue)) continue;
    tourDecision(room,owner,lightClay.name,[{value:'retain',label:{zh:'弃置道具 · 保留防御强化',en:'Discard item · keep Defense'}}],
      {kind:'light-clay',pokemonId,itemId},ctx,true);
    return true;
  }
  return false;
}
function finishTourTool(room) {
  if (!room.expansionTool) return;
  room.discardPile.push(room.expansionTool.card);
  note(room, '巡回道具结算完成，组合牌进入弃牌堆。', 'The tour tool resolved and the physical card was discarded.');
  delete room.expansionTool;
}
function tourToolTargets(room, player, catalogue, effect, card) {
  const reserve = livingReserve(player, catalogue);
  const active = player.active;
  const own = slot => [{ targetId: player.id, slot }];
  switch (effect) {
    case 'tour-heal': return reserve && player.reserve.damage > 0 ? own('reserve') : [];
    case 'tour-power': return !active.reinforcements.includes('power') ? own('active') : [];
    case 'tour-gear': return player.hand.length >= 2 ? own('active') : [];
    case 'tour-dex': return room.drawPile.length + room.discardPile.length > 0 ? own('active') : [];
    case 'tour-switch': return !room.turn.switchUsed && tourCanSwitch(room, player, catalogue) && (!room.turn.hoennRoadblocked || player.hand.length > 1) ? own('active') : [];
    case 'tour-incense': return reserve && player.reserve.level < 3 && !room.turn.tourLevelUsed ? own('reserve') : [];
    case 'tour-recycle': {
      return room.discardPile.some(item => item.kind === 'tool' && item.weather === card?.weather) ? own('active') : [];
    }
    case 'tour-berry': return ['active', 'reserve'].filter(slot => player[slot] && !player[slot].defeated &&
      player[slot].status === 'paralysis').flatMap(own);
    default: return [];
  }
}
function useTourTool(room, player, input, card, ctx) {
  room.expansionTool = { card, playerId: player.id, effect: input.effect };
  const pokemon = player[input.slot];
  switch (input.effect) {
    case 'tour-heal': pokemon.revealed = true; heal(pokemon, 1, ctx.catalogue); break;
    case 'tour-power': pokemon.reinforcements.push('power'); break;
    case 'tour-incense':
      pokemon.revealed = true;
      room.turn.tourLevelTarget = pokemon.instanceId;
      note(room, '进化香薰已公开后备，结束时可选择为其升级。', 'Incense revealed the reserve; it can receive the end-turn level-up.');
      break;
    case 'tour-berry': pokemon.revealed = true; pokemon.status = null; break;
    case 'tour-switch': return requestBattleSwitch(room, player, 'ordinary', ctx);
    case 'tour-gear':
      return tourDecision(room, player, { zh: '宝可装置 · 弃一张再摸一张', en: 'Pokégear · discard and draw' },
        player.hand.map(tourCardOption), { kind: 'gear' }, ctx);
    case 'tour-dex': {
      const count = Math.min(2, room.drawPile.length + room.discardPile.length);
      refillDrawPile(room, count);
      const cards = room.drawPile.splice(-count, count).reverse();
      room.expansionTool.peek = cards;
      return tourDecision(room, player, { zh: '图鉴 · 选择先摸到的一张', en: 'Pokédex · choose the top card' },
        cards.map(tourCardOption), { kind: 'dex' }, ctx);
    }
    case 'tour-recycle':
      return tourDecision(room, player, { zh: '能量回收 · 选择道具', en: 'Energy Retrieval · choose a tool' },
        room.discardPile.filter(item => item.kind === 'tool' && item.weather === card.weather).map(tourCardOption),
        { kind: 'recycle' }, ctx);
  }
  finishTourTool(room);
}
function canContactRadio(room, player, catalogue) {
  return room.scenario?.radio && isTeamRole(player.role) && !room.turn.radioContactUsed &&
    player.active && !player.active.defeated && currentHp(player.active,catalogue)>0 &&
    new Set(player.hand.map(card=>card.weather)).size>1;
}
function radioDecision(room, player, cards, continuation, ctx) {
  tourDecision(room,player,tourActionNames['radio-contact'],cards.map(tourCardOption),continuation,ctx,true);
  room.pendingBattle.detail = continuation.kind==='radio-first'
    ? {zh:'选择第一张手牌，两张牌的印刷天气须不同。',en:'Choose the first of two cards with different printed weather.'}
    : {zh:'选一张不同天气的手牌，弃置两张并获得 1 情报点。',en:'Choose a different weather. Discard both cards for one intelligence point.'};
}
function resolveRadioContact(room, player, selected, continuation, ctx) {
  const card = player.hand.find(item=>item.id===selected);
  requireRule(card && canContactRadio(room,player,ctx.catalogue),'STALE_DECISION','Radio Contact can no longer be completed.');
  if (continuation.kind==='radio-first') {
    radioDecision(room,player,player.hand.filter(item=>item.weather!==card.weather),
      {kind:'radio-second',firstId:card.id},ctx);
    return;
  }
  const first = player.hand.find(item=>item.id===continuation.firstId);
  requireRule(first && first.weather!==card.weather,'INVALID_CARD','Choose two cards with different printed weather.');
  room.discardPile.push(takeCard(player,first.id,first.kind),takeCard(player,card.id,card.kind));
  room.turn.radioContactUsed = true;
  const radio = room.scenario.radio;
  const score = ++radio.scores[player.role];
  note(room,`${player.nickname}完成广播塔联络，队伍情报进度为 ${score}/${radio.goal}。`,
    `${player.nickname} completed Radio Contact. Their team has ${score}/${radio.goal} intelligence.`);
  if (score >= radio.goal) {
    return finishBattle(room,{reason:'intelligence',winner:player.role,
      winnerIds:room.players.filter(seat=>!seat.spectator && seat.role===player.role).map(seat=>seat.id)},ctx);
  }
}
function viridianInvestigationTargets(room, player) {
  const viridian = room.scenario?.viridian;
  if (!viridian || viridian.leaderRevealed || !player.hand.length || viridian.investigatorIds.includes(player.id)) return [];
  return live(room).filter(target=>target.id!==player.id && !target.identityPublic && !Object.hasOwn(viridian.clues,target.id));
}
function resolveViridianInvestigation(room, player, selected, next, ctx) {
  const target = viridianInvestigationTargets(room,player).find(seat=>seat.id===(next.targetId ?? selected.value));
  requireRule(target,'STALE_DECISION','This trainer is no longer a valid investigation target.');
  if (next.kind==='viridian-investigate-target') {
    return tourDecision(room,player,{zh:'公开查验 · 弃置一张手牌',en:'Public Investigation · discard a card'},
      player.hand.map(tourCardOption),{kind:'viridian-investigate-payment',targetId:target.id},ctx,true);
  }
  room.discardPile.push(takeCard(player,selected.value,selected.card.kind));
  const viridian = room.scenario.viridian;
  const challenger = target.role==='challenger';
  viridian.clues[target.id] = challenger;
  viridian.investigatorIds.push(player.id);
  note(room,`${player.nickname}查验了 ${target.nickname}。${challenger?'对方是挑战者。':'对方不是挑战者。'}`,
    `${player.nickname} investigated ${target.nickname}. ${challenger?'They are a Challenger.':'They are not a Challenger.'}`);
}
function surveyTopCard(room) {
  const top = room.drawPile.at(-1);
  return top && top.id===room.tourDexSurvey?.cardId && room.turn.number===room.tourDexSurvey.turnNumber &&
    !room.turn.tourNightObservation ? top : null;
}
const objectiveActionNames={
  'lake-shutoff':{zh:'关闭电波装置',en:'Shut down transmitter'},
  'silph-claim':{zh:'争夺大师球',en:'Claim Master Ball'},
};
function objectiveAction(room,player) {
  if (player.raidBoss || room.turn.objectiveUsed || new Set(player.hand.map(card=>card.weather)).size<2) return null;
  if (room.scenario?.lake?.transmitter) return 'lake-shutoff';
  if (room.scenario?.silph && room.scenario.silph.control?.team!==player.role) return 'silph-claim';
  return null;
}
function objectivePayment(room,player,action,cards,firstId,ctx) {
  tourDecision(room,player,objectiveActionNames[action],cards.map(tourCardOption),{kind:'objective-payment',action,firstId},ctx,true);
  room.pendingBattle.detail=firstId
    ? {zh:'选择不同天气的第二张手牌。确定后弃置两张。',en:'Choose a second card with different weather. Both are discarded on confirmation.'}
    : {zh:'选择要弃置的第一张手牌，两张牌的天气须不同。',en:'Choose the first of two hand cards of different weather to discard.'};
}
function resolveObjectivePayment(room,player,option,next,ctx) {
  const card=player.hand.find(item=>item.id===option.value);
  requireRule(card && objectiveAction(room,player)===next.action,'STALE_DECISION','The objective or payment changed.');
  if (!next.firstId) return objectivePayment(room,player,next.action,player.hand.filter(item=>item.weather!==card.weather),card.id,ctx);
  const first=player.hand.find(item=>item.id===next.firstId);
  requireRule(first && first.weather!==card.weather,'INVALID_CARD','Choose two hand cards with different weather.');
  room.discardPile.push(takeCard(player,first.id,first.kind),takeCard(player,card.id,card.kind));
  room.turn.objectiveUsed=true;
  if (next.action==='lake-shutoff') {
    room.scenario.lake.transmitter=false;
    note(room,'挑战者关闭了火箭队的电波装置。','The challengers shut down Team Rocket’s transmitter.');
  } else {
    room.scenario.silph.control={team:player.role,anchorId:player.id};
    note(room,`${player.nickname}的队伍占领大师球，需要守住一圈。`,
      `${player.nickname}’s team claimed the Master Ball and must hold it for a full rotation.`);
  }
}
const professionActionNames = {
  'brock-care':trainerProfessions.brock.action, 'oak-register':trainerProfessions.oak.action,
  'disguise-trade':trainerProfessions.disguise.action, 'bird-supply':trainerProfessions.birdkeeper.action,
  'looker-inquiry':trainerProfessions.looker.action,
};
const professionNeighbors = (room, player) => eligibleTargetIds(room.players,player.id)
  .filter(id=>id!==player.id).map(id=>trainer(room,id));
const tradeNeighbors = (room, player) => professionNeighbors(room,player).filter(other=>other.hand.length);
const professionTrainerOption = other => ({value:other.id,label:{zh:other.nickname,en:other.nickname}});
function birdSupplyTargets(room, player) {
  const flying=player.active.instanceId===room.turn.birdOrdinaryEntry &&
    pokemonTypes(player.active.catalogueId,player.active.level).includes('flying');
  return flying ? [player,...professionNeighbors(room,player)] : [player];
}
export function tourActions(room, player, catalogue) {
  if (room.status !== 'playing' || player.eliminated || player.spectator ||
      room.turn.playerId !== player.id || room.pendingBattle || room.pendingVote) return [];
  const play = room.turn.phase === 'play', end = room.turn.phase === 'end', reserve = livingReserve(player, catalogue);
  const actions = [];
  const objective=play && objectiveAction(room,player);
  if (objective) actions.push(objective);
  const field = activeFieldWeather(room);
  const observe = play && field && room.turn.hoennObservedWeather === field.kind &&
      !room.turn.hoennObserved && player.hand.length && room.drawPile.length + room.discardPile.length > 0;
  if (observe) actions.push('observe');
  if (play && player.active.hoennIllusion && player.active.level>=2 && battleTraitsEffective(room,player.active) &&
      !player.active.illusionDecoyId && player.hand.some(card=>card.kind!=='command')) actions.push('illusion-decoy');
  if (play && hasPack(room.settings?.contentPack, HOENN_PACK) && player.active.catalogueId === 'hoenn-absol' &&
      battleTraitsEffective(room, player.active) && !room.turn.hoennForecastUsed &&
      room.drawPile.length + room.discardPile.length > 0) actions.push('forecast');
  if (play && player.active.level === 3 && intactDisguise(room, player.active) &&
      !player.active.reinforcements.includes('power')) actions.push('shed-disguise');
  if (play && canContactRadio(room,player,catalogue)) actions.push('radio-contact');
  if (play && viridianInvestigationTargets(room,player).length) actions.push('viridian-investigate');
  if (end && player.profession==='brock' && room.turn.brockOrdinarySwitch && !room.turn.brockCareUsed &&
      reserve && player.reserve.damage>0) actions.push('brock-care');
  if (play && player.profession==='oak' && !player.professionUsed && reserve &&
      room.drawPile.length+room.discardPile.length>0) actions.push('oak-register');
  if (play && !player.professionUsed) {
    if (player.profession==='disguise' && player.hand.length && tradeNeighbors(room,player).length) actions.push('disguise-trade');
    if (player.profession==='looker' && professionNeighbors(room,player).length) actions.push('looker-inquiry');
    if (player.profession==='birdkeeper' && room.turn.birdOrdinaryEntry &&
        room.drawPile.length+room.discardPile.length>0) actions.push('bird-supply');
  }
  const present = kind=>({kind,name:objectiveActionNames[kind] ?? professionActionNames[kind] ?? tourActionNames[kind]});
  if (!tourEnabled(room)) return actions.map(present);
  if (play && !room.turn.tourPrepared && player.hand.length) actions.push('prepare');
  if (play && surveyTopCard(room)) actions.push('publish-survey');
  if (play && !room.turn.tourShowdownUsed && player.hand.length && showdownTargets(room, player).length) actions.push('showdown');
  if (play && canGoAllOut(room, player, catalogue)) actions.push('all-out');
  if (end && reserve && player.reserve.level < 3 && !room.turn.tourLevelUsed && player.hand.length) actions.push('train');
  const handoff = room.turn.tourHandoff;
  if (play && handoff && handoff.activeId === player.active.instanceId && handoff.reserveId === player.reserve?.instanceId &&
      (player.active.item || player.reserve.item) && player.hand.length) actions.push('handoff');
  if (play && player.active.catalogueId === 'tour-teddiursa' && battleTraitsEffective(room, player.active) &&
      !room.turn.tourPickup && player.hand.some(card => room.discardPile.some(item => item.kind === 'held-item' && item.weather === card.weather))) actions.push('pickup');
  return actions.map(present);
}
export function useTourAction(room, player, input, ctx) {
  requireRule(tourActions(room, player, ctx.catalogue).some(action => action.kind === input.action), 'ACTION_UNAVAILABLE', 'This action is unavailable now.');
  if (Object.hasOwn(objectiveActionNames,input.action))
    return objectivePayment(room,player,input.action,player.hand,null,ctx);
  if (input.action === 'brock-care') {
    room.turn.brockCareUsed=true;
    heal(player.reserve,1,ctx.catalogue);
    note(room,'小刚为自己受伤的后备回复1点体力。','Brock restored 1 HP to the injured reserve.');
    return;
  }
  if (input.action === 'oak-register') {
    const count=Math.min(2,room.drawPile.length+room.discardPile.length);
    refillDrawPile(room,count);
    const top=room.drawPile.slice(-count).reverse();
    player.reserve.revealed=true;
    player.professionUsed=true;
    note(room,`${player.nickname}发动图鉴登记，公开自己的后备。`,
      `${player.nickname} used Pokédex Registration and revealed their reserve.`);
    tourDecision(room,player,professionActionNames['oak-register'],top.map(tourCardOption),
      {kind:'oak-order',cardIds:top.map(card=>card.id)},ctx,true);
    room.pendingBattle.detail = {
      zh:'选择哪张牌留在最上面。放弃则保持原顺序。',
      en:'Choose the card to place on top, or pass to keep the current order.',
    };
    return;
  }
  if (input.action === 'disguise-trade') {
    tourDecision(room,player,professionActionNames[input.action],tradeNeighbors(room,player).map(professionTrainerOption),
      {kind:'disguise-target'},ctx,true);
    room.pendingBattle.detail={zh:'选择一名有手牌的相邻训练家。',en:'Choose a neighbor who has hand cards.'};
    return;
  }
  if (input.action === 'looker-inquiry') {
    tourDecision(room,player,professionActionNames[input.action],professionNeighbors(room,player).map(professionTrainerOption),
      {kind:'looker-target'},ctx,true);
    room.pendingBattle.detail={zh:'选择一名相邻训练家，由对方决定公开哪项线索。',en:'Choose a neighbor, who will decide what to reveal.'};
    return;
  }
  if (input.action === 'bird-supply') {
    const targets=birdSupplyTargets(room,player);
    if (targets.length===1) return giveBirdSupply(room,player,player);
    tourDecision(room,player,professionActionNames[input.action],targets.map(professionTrainerOption),
      {kind:'bird-recipient'},ctx,true);
    room.pendingBattle.detail={zh:'选择摸一张牌的训练家。',en:'Choose who draws one card.'};
    return;
  }
  if (input.action === 'radio-contact') {
    return radioDecision(room,player,player.hand,{kind:'radio-first'},ctx);
  }
  if (input.action === 'viridian-investigate') {
    return tourDecision(room,player,tourActionNames[input.action],viridianInvestigationTargets(room,player).map(target=>({
      value:target.id,label:{zh:target.nickname,en:target.nickname},
    })),{kind:'viridian-investigate-target'},ctx,true);
  }
  if (input.action === 'publish-survey') {
    const revealed = surveyTopCard(room);
    const [zh,en] = printedWeatherNames[revealed.weather];
    room.turn.tourNightObservation = true;
    delete room.tourDexSurvey;
    note(room,`图鉴调查公开当前顶牌「${revealed.name.zh}」（${zh}）。本回合结束时进行夜间观察。`,
      `Pokédex Survey revealed ${revealed.name.en} (${en}) on top of the deck. Night Observation is ready.`,
      {tourCard:publicJudgmentFace(revealed)});
    return;
  }
  if (input.action === 'shed-disguise') return tourDecision(room, player, tourActionNames[input.action],
    [{ value: 'power', label: { zh: '消耗画皮并获得一枚力量强化', en: 'Spend Disguise and gain one Power marker' } }],
    { kind: 'shed-disguise' }, ctx, true);
  if (input.action === 'showdown') return showdownDecision(room, player, null,
    { zh: '训练家对视 · 选择训练家', en: 'Trainer Showdown · choose a trainer' },
    showdownTargets(room, player).map(other => ({ value: other.id, label: { zh: other.nickname, en: other.nickname } })),
    { kind: 'showdown-target' }, ctx, true);
  if (input.action === 'all-out') return tourDecision(room, player, tourActionNames['all-out'],
    [{ value: 'pay', label: { zh: '支付 1 点体力，摸两张牌', en: 'Pay 1 HP and draw two cards' } }],
    { kind: 'all-out' }, ctx, true);
  if (input.action === 'illusion-decoy') return tourDecision(room,player,tourActionNames[input.action],
    player.hand.filter(card=>card.kind!=='command').map(tourCardOption),
    {kind:'illusion-decoy',activeId:player.active.instanceId},ctx,true);
  if (input.action === 'forecast') {
    refillDrawPile(room,1);
    const card = room.drawPile.at(-1);
    const [zh,en] = printedWeatherNames[card.weather];
    const speed = player.active.level === 3 && card.weather === 'thunderstorm' && !player.active.reinforcements.includes('speed');
    const options = [{
      value:'keep', label: speed ? {zh:`保留${zh} · 获得速度强化`,en:`Keep ${en} · gain Speed`}
        : {zh:`保留${zh}`,en:`Keep ${en}`},
    }];
    if (player.active.level >= 2 && room.drawPile.length + room.discardPile.length > 1) {
      options.push({value:'bottom',label:{zh:'将这张牌置底',en:'Put it on the bottom'}});
    }
    room.turn.hoennForecastUsed = true;
    return tourDecision(room, player, tourActionNames.forecast, options, {kind:'absol-forecast',cardId:card.id}, ctx, true);
  }
  const eligible = input.action === 'pickup' ? player.hand.filter(card =>
    room.discardPile.some(item => item.kind === 'held-item' && item.weather === card.weather)) : player.hand;
  tourDecision(room, player, tourActionNames[input.action], eligible.map(tourCardOption),
    { kind: 'action', action: input.action, activeId: player.active.instanceId, reserveId: player.reserve?.instanceId }, ctx, true);
}
function giveBirdSupply(room, player, recipient) {
  player.professionUsed=true;
  drawBattleCards(room,recipient,1,'bird-supply');
  note(room,`驯鸟补给使 ${recipient.nickname} 摸了一张牌。`,
    `Bird Keeper’s Supply let ${recipient.nickname} draw one card.`);
}
const heldInquiryOption={value:'held',label:{zh:'回答后备是否有持有物',en:'Answer about the reserve’s held item'}};
function resolveProfessionDecision(room, player, option, next, ctx) {
  switch (next.kind) {
    case 'bug-prize': {
      const prize=bugPrizeCards(room,player,ctx.catalogue).find(card=>card.id===option.value);
      requireRule(room.entryEvent && player.active.instanceId===next.activeId && prize,
        'STALE_DECISION','The entry or discarded Item changed.');
      room.discardPile.splice(room.discardPile.indexOf(prize),1);
      player.professionUsed=true;
      gainBattleCards(room,player,[prize],{reason:'bug-prize'});
      note(room,`捕虫大会奖品使 ${player.nickname} 取回了${prize.name.zh}。`,
        `Bug-Catching Prize let ${player.nickname} recover ${prize.name.en}.`,{tourCard:publicJudgmentFace(prize)});
      room.entryEvent.index++;
      return advanceBattleEntries(room,ctx);
    }
    case 'bird-recipient': {
      const recipient=birdSupplyTargets(room,player).find(other=>other.id===option.value);
      requireRule(recipient && !player.professionUsed,'STALE_DECISION','The recipient changed.');
      return giveBirdSupply(room,player,recipient);
    }
    case 'researcher-forecast': {
      const judgment=room.judgment;
      requireRule(judgment?.judgeId===player.id && room.drawPile.at(-1)?.id===judgment.forecastId,
        'STALE_DECISION','The forecast card changed.');
      const index=player.hand.findIndex(card=>card.id===option.value);
      requireRule(index>=0,'INVALID_CARD','Choose one of your hand cards.');
      refillDrawPile(room,2);
      room.drawPile.unshift(room.drawPile.pop());
      room.discardPile.push(player.hand.splice(index,1)[0]);
      note(room,'气象研究员弃一张手牌，将原顶牌置底后继续判定。','The Weather Researcher discarded a hand card and moved the original top card to the bottom.');
      return revealJudgment(room,ctx,judgment.continuation,judgment.judgeId);
    }
    case 'disguise-target': {
      const other=tradeNeighbors(room,player).find(seat=>seat.id===option.value);
      requireRule(other && player.hand.length,'STALE_DECISION','The exchange partner changed.');
      return tourDecision(room,player,{zh:'暗号交换 · 选择要提出的手牌',en:'Trade by Password · choose your offered card'},
        player.hand.map(tourCardOption),{kind:'disguise-offer',recipientId:other.id},ctx,true);
    }
    case 'disguise-offer': {
      const other=tradeNeighbors(room,player).find(seat=>seat.id===next.recipientId);
      const offered=player.hand.find(card=>card.id===option.value);
      requireRule(other && offered && !player.professionUsed,'STALE_DECISION','The offered card or the exchange partner changed.');
      player.professionUsed=true;
      const [zh,en]=printedWeatherNames[offered.weather];
      const detail={
        zh:`${player.nickname} 向 ${other.nickname} 提议交换一张${zh}手牌。`,
        en:`${player.nickname} offered a ${en} card to ${other.nickname}.`,
      };
      note(room,detail.zh,detail.en);
      tourDecision(room,other,trainerProfessions.disguise.action,[
        ...other.hand.filter(card=>card.weather===offered.weather).map(tourCardOption),
        {value:'decline',label:{zh:'拒绝交换',en:'Decline exchange'}},
      ],{kind:'disguise-reply',sourceId:player.id,cardId:offered.id},ctx);
      room.pendingBattle.detail=detail;
      return;
    }
    case 'disguise-reply': {
      if (option.value==='decline') {
        note(room,`${player.nickname} 拒绝了暗号交换。`,`${player.nickname} declined the trade.`);
        return;
      }
      const source=trainer(room,next.sourceId);
      const sourceIndex=source?.hand.findIndex(card=>card.id===next.cardId) ?? -1;
      const ownIndex=player.hand.findIndex(card=>card.id===option.value);
      requireRule(sourceIndex>=0 && ownIndex>=0 && source.hand[sourceIndex].weather===player.hand[ownIndex].weather,
        'STALE_DECISION','The matching hand cards changed.');
      const [offered]=source.hand.splice(sourceIndex,1);
      const [returned]=player.hand.splice(ownIndex,1);
      gainBatches(room,[{player,cards:[offered]},{player:source,cards:[returned]}],'disguise-trade');
      note(room,`${player.nickname} 与 ${source.nickname} 完成了暗号交换。`,
        `${player.nickname} and ${source.nickname} completed the trade.`);
      return;
    }
    case 'looker-target': {
      const other=professionNeighbors(room,player).find(seat=>seat.id===option.value);
      requireRule(other && !player.professionUsed,'STALE_DECISION','The interview target changed.');
      player.professionUsed=true;
      tourDecision(room,other,trainerProfessions.looker.action,[heldInquiryOption,
        ...other.hand.map(tourCardOption)],{kind:'looker-reply'},ctx);
      room.pendingBattle.detail={zh:'只公开所选手牌的天气，或存活后备是否有持有物。',
        en:'Reveal only the chosen card’s weather, or whether your living reserve has a held item.'};
      return;
    }
    case 'looker-reply': {
      if (option.value==='held') {
        const equipped=livingReserve(player,ctx.catalogue) && Boolean(player.reserve.item);
        note(room,equipped ? `${player.nickname} 回答：存活后备有持有物。` : `${player.nickname} 回答：没有携带持有物的存活后备。`,
          equipped ? `${player.nickname} confirmed their living reserve holds an item.` :
            `${player.nickname} confirmed they have no living reserve with an item.`);
        return;
      }
      const card=player.hand.find(card=>card.id===option.value);
      requireRule(card,'INVALID_CARD','Choose one of your hand cards.');
      const [zh,en]=printedWeatherNames[card.weather];
      note(room,`${player.nickname} 回答：一张手牌的天气为${zh}。`,
        `${player.nickname} reported a hand card with ${en} weather.`);
    }
  }
}
export function tourTimeoutChoice(pending) {
  if (pending.kind !== 'expansion') return null;
  const { kind } = pending.continuation;
  if (kind === 'showdown-reveal') return { choice: 'choose', effect: pending.options[randomInt(pending.options.length)].value };
  if (kind==='rocket-pledge') return {choice:'choose',effect:'independent'};
  if (['oak-order','bug-prize','bird-recipient','researcher-forecast','disguise-target','disguise-offer','looker-target'].includes(kind)) return {choice:'pass'};
  if (kind==='objective-payment') return {choice:'pass'};
  if (kind==='disguise-reply') return {choice:'choose',effect:'decline'};
  if (kind==='looker-reply') return {choice:'choose',effect:'held'};
  if (kind==='gym-guard' || kind.startsWith('viridian-investigate-')) return {choice:'pass'};
  if (kind === 'showdown-target' || kind === 'showdown-commit' || kind === 'all-out' || kind === 'shed-disguise' || kind === 'follow-me' || kind === 'radio-first' || kind === 'radio-second') return { choice: 'pass' };
  return null;
}
function respondTour(room, player, input, ctx) {
  const pending = room.pendingBattle, next = pending.continuation;
  requireRule(Object.keys(input).every(key => ['id', 'revision', 'type', 'decisionId', 'choice', 'effect'].includes(key)),
    'INVALID_RESPONSE', 'Only submit an available tour choice.');
  if (input.choice === 'pass') {
    requireRule(pending.allowPass && input.effect === undefined, 'INVALID_RESPONSE', 'Choose an available option.');
    room.pendingBattle = null;
    if (next.kind === 'follow-me' || next.kind === 'gym-guard') return finishTargetAssignment(room,ctx);
    if (next.kind === 'wobbuffet-counter') return continueReceiving(room,ctx);
    if (next.kind === 'air-lock') return settleDamage(room,ctx);
    if (next.kind === 'light-clay') return finishResolution(room,ctx);
    if (['post-switch','emergency-retreat'].includes(next.kind)) return advanceTourSwitches(room, ctx);
    if (next.kind === 'roadblock-switch') return finishTourTool(room);
    if (next.kind === 'future-sight-event' || next.kind === 'future-sight-payment') return advanceJudgment(room, ctx);
    if (next.kind==='researcher-forecast') return revealJudgment(room,ctx,room.judgment.continuation,room.judgment.judgeId);
    if (next.kind==='bug-prize') {
      room.entryEvent.index++;
      return advanceBattleEntries(room,ctx);
    }
    return;
  }
  const option = pending.options.find(option => option.value === input.effect);
  requireRule(input.choice === 'choose' && option, 'INVALID_RESPONSE', 'Choose an available option.');
  room.pendingBattle = null;
  if (next.kind==='objective-payment') return resolveObjectivePayment(room,player,option,next,ctx);
  if (['bug-prize','bird-recipient','researcher-forecast'].includes(next.kind) ||
      next.kind.startsWith('disguise-') || next.kind.startsWith('looker-')) {
    return resolveProfessionDecision(room,player,option,next,ctx);
  }
  if (next.kind === 'rocket-pledge') {
    const viridian = room.scenario.viridian;
    requireRule(room.settings.rocketInfiltration && viridian.round===INFILTRATOR_ROUND &&
      !viridian.infiltrator && player.role==='infiltrator' && !player.eliminated,
      'STALE_DECISION','The infiltrator has already declared allegiance or left the game.');
    const joined = option.value==='rocket';
    if (joined) player.role = 'rocket';
    viridian.infiltrator = {playerId:player.id,choice:option.value};
    revealBattleIdentity(room,player);
    note(room,joined?`${player.nickname}公开身份并加入火箭队。`:`${player.nickname}公开身份，选择保持独立。`,
      joined?`${player.nickname} revealed their identity and joined Team Rocket.`:`${player.nickname} revealed their identity and stayed independent.`);
    return continueBattleTurnStart(room,trainer(room,room.turn.playerId),ctx);
  }
  if (next.kind === 'radio-first' || next.kind === 'radio-second') return resolveRadioContact(room,player,option.value,next,ctx);
  if (next.kind.startsWith('viridian-investigate-')) return resolveViridianInvestigation(room,player,option,next,ctx);
  if (next.kind === 'gym-guard') {
    const assignment = gymGuardForMove(room,ctx);
    requireRule(assignment?.leader.active.instanceId===next.leaderInstance &&
      assignment.protector.id===player.id && player.active.instanceId===next.guardInstance,
      'STALE_DECISION','The Gym Guard or the original target changed.');
    const resolution = room.resolution;
    room.scenario.viridian.guard.used = true;
    resolution.targetIds[0] = player.id;
    visualEvent(room,'ability',{sourceId:player.id,targetIds:[assignment.leader.id],name:gymGuardName});
    note(room,`${player.nickname}发动道馆护卫，替 ${assignment.leader.nickname} 承接${resolution.moveName.zh}。`,
      `${player.nickname} used Gym Guard to take ${resolution.moveName.en} for ${assignment.leader.nickname}.`,
      {camera:effectCamera(room,resolution)});
    return finishTargetAssignment(room,ctx);
  }
  if (next.kind === 'follow-me') {
    const resolution = room.resolution, ally = trainer(room,pending.targetId);
    requireRule(ally?.active?.instanceId===next.targetInstance && player.active?.instanceId===next.coverInstance &&
      followMeCandidates(room,ctx).some(candidate=>candidate.id===player.id),
      'STALE_DECISION','The trainer or the attack target changed.');
    room.discardPile.push(takeCard(player,option.value,option.card.kind));
    resolution.targetIds[0] = player.id;
    resolution.followMeAccepted = true;
    const name = tourActionNames['follow-me'];
    visualEvent(room,'ability',{sourceId:player.id,targetIds:[ally.id],name});
    note(room,`${player.nickname}用「看我嘛」替 ${ally.nickname} 承接了${resolution.moveName.zh}。`,
      `${player.nickname} used Follow Me to take ${resolution.moveName.en} for ${ally.nickname}.`,
      {camera:effectCamera(room,resolution)});
    return finishTargetAssignment(room,ctx);
  }
  if (next.kind === 'shed-disguise') {
    requireRule(intactDisguise(room, player.active) && !player.active.reinforcements.includes('power'),
      'ACTION_UNAVAILABLE', 'Mimikyu cannot spend Disguise now.');
    spendDisguise(room, player, ctx);
    player.active.reinforcements.push('power');
    note(room, '谜拟丘主动解除画皮，获得一枚力量强化。', 'Mimikyu spent Disguise and gained one Power marker.');
    return;
  }
  if (next.kind.startsWith('showdown-')) return resolveShowdown(room, player, option, next, ctx);
  if (next.kind === 'all-out') {
    requireRule(canGoAllOut(room, player, ctx.catalogue), 'ACTION_UNAVAILABLE', 'This trainer cannot pay 1 HP and draw two cards.');
    player.tourAllOutUsed = true;
    applyDamage(player.active, 1, ctx.catalogue);
    drawBattleCards(room, player, 2, 'all-out');
    note(room, `${player.nickname}发动「拼尽全力」，支付1点体力并摸两张牌。`,
      `${player.nickname} used Go All Out, paid 1 HP, and drew two cards.`);
    return;
  }
  if (next.kind === 'illusion-decoy') {
    requireRule(player.active?.instanceId===next.activeId && player.active.hoennIllusion &&
      player.active.level>=2 && !player.active.illusionDecoyId &&
      player.hand.some(card=>card.id===option.value && card.kind!=='command'),
      'INVALID_RESPONSE','Choose a non-command card from your own hand while disguised.');
    player.active.illusionDecoyId=option.value;
    return;
  }
  if (next.kind === 'wobbuffet-counter') {
    const parent = room.resolution, pokemon = player.active;
    const response = wobbuffetResponse(room,player,ctx.catalogue);
    const card = response?.cards.find(card=>card.id===option.value);
    requireRule(response?.source.active.instanceId===next.sourceId && card,'STALE_DECISION','The incoming move or counter payment changed.');
    player.hand.splice(player.hand.indexOf(card),1);
    room.discardPile.push(card);
    (room.turn.wobbuffetCounterIds ??= []).push(pokemon.instanceId);
    (room.resolutionStack ??= []).push(parent);
    const source = response.source;
    room.resolution = {kind:'retaliation',sourceId:pokemon.instanceId,sourcePlayerId:player.id,
      targetIds:[source.id], targetCreatureId:source.active.instanceId, moveName:response.move.name,
      sourceAfterDone:true, sourceItemAfterDone:true, damagedIds:[], defenseIds:[], actualDamage:0};
    const amount = pokemon.level===3 ? Math.min(2,parent.actualDamage) : 1;
    note(room,`${response.move.name.zh}向原招式来源反击。`,`${response.move.name.en} struck back at the original attacker.`);
    visualEvent(room,'attack',{sourceId:player.id,targetIds:[source.id],name:response.move.name,release:true});
    return resolveDealtDamage(room,ctx,amount);
  }
  if (next.kind === 'air-lock') {
    const resolution = room.resolution;
    requireRule(resolution?.targetCreatureId === player.active?.instanceId && weatherBallBonus(resolution) && !resolution.airLockApplied,
      'STALE_DECISION','The weather damage changed.');
    requireRule(player.hand.some(card => card.id === option.value && isAirLock(card)),'INVALID_CARD','Choose a held Air Lock response.');
    const card = takeCard(player,option.value,'event');
    room.discardPile.push(card);
    resolution.airLockApplied = true;
    visualEvent(room,'event',{sourceId:player.id,targetIds:[player.id],name:card.name,effect:card.eventType});
    note(room,'烈空坐的气闸抵消了这次气象球的天气增伤。','Rayquaza’s Air Lock canceled the weather bonus on this Weather Ball.');
    return settleDamage(room,ctx);
  }
  if (next.kind === 'light-clay') {
    const resolution = room.resolution, pokemon = player.active;
    requireRule(resolution && pokemon?.instanceId === next.pokemonId && canUseLightClay(room,resolution,pokemon,next.itemId,ctx.catalogue),
      'STALE_DECISION','The defense marker or held item changed.');
    room.discardPile.push(pokemon.item);
    delete pokemon.item;
    pokemon.hoennClayDefense = true;
    (resolution.retainedDefenseIds ??= []).push(pokemon.instanceId);
    note(room,'光之黏土保留了一次防御强化。','Light Clay kept the Defense marker for one more settlement.');
    return finishResolution(room,ctx);
  }
  if (next.kind === 'future-sight-event' || next.kind === 'future-sight-payment') {
    const judgment = room.judgment;
    requireRule(judgment?.card && !judgment.futureSightUsed && room.drawPile.length + room.discardPile.length > 0,
      'STALE_DECISION', 'There is no longer a judgment to replace.');
    const eventId = next.kind === 'future-sight-event' ? option.value : next.eventId;
    const event = player.hand.find(card => card.id === eventId && isFutureSight(card));
    requireRule(event, 'INVALID_CARD', 'Choose a Future Sight card from your own hand.');
    const matches = card => card.id !== event.id && card.weather === judgment.card.weather;
    if (next.kind === 'future-sight-event') {
      return futureSightDecision(room, player,
        { zh:'预知未来 · 弃一张同天气手牌', en:'Future Sight · discard a matching weather card' },
        player.hand.filter(matches), { kind:'future-sight-payment', eventId }, ctx);
    }
    const cost = player.hand.find(card => card.id === option.value && matches(card));
    requireRule(cost, 'INVALID_CARD', 'Choose a different card with the current judgment weather.');
    const replacement = topCard(room);
    room.drawPile.unshift(judgment.card);
    player.hand = player.hand.filter(card => card !== event && card !== cost);
    room.discardPile.push(event, cost);
    judgment.card = replacement;
    judgment.futureSightUsed = true;
    visualEvent(room, 'event', { sourceId:player.id, targetIds:[judgment.judgeId], effect:event.eventType, name:event.name });
    note(room, '预知未来将原判定牌置底，并翻出一张新的判定牌。', 'Future Sight put the old judgment card on the bottom and revealed a new one.',
      { judgment:publicJudgmentFace(replacement) });
    return advanceJudgment(room, ctx);
  }
  if (next.kind === 'absol-forecast') {
    const top = room.drawPile.at(-1);
    requireRule(top?.id === next.cardId, 'STALE_DECISION', 'The top card has changed.');
    if (option.value === 'bottom') {
      refillDrawPile(room,2);
      room.drawPile.unshift(room.drawPile.pop());
    } else if (player.active.level === 3 && top.weather === 'thunderstorm' && !player.active.reinforcements.includes('speed')) {
      player.active.reinforcements.push('speed');
    }
    return;
  }
  if (next.kind === 'oak-order') {
    const top=room.drawPile.slice(-next.cardIds.length).reverse();
    requireRule(next.cardIds.every((id,index)=>top[index]?.id===id),'STALE_DECISION','The registered cards moved.');
    if (option.value!==top[0].id) {
      room.drawPile.pop();
      room.drawPile.pop();
      room.drawPile.push(top[0],top[1]);
    }
    return;
  }
  if (next.kind === 'dex') {
    const cards = room.expansionTool.peek;
    const ordered = [cards.find(card => card.id === option.value), ...cards.filter(card => card.id !== option.value)];
    room.drawPile.push(...ordered.reverse());
    room.tourDexSurvey = {cardId:option.value,turnNumber:room.turn.number};
    delete room.expansionTool.peek;
    return finishTourTool(room);
  }
  if (next.kind === 'recycle' || next.kind === 'pickup-item') {
    const index = room.discardPile.findIndex(card => card.id === option.value);
    requireRule(index >= 0, 'INVALID_CARD', 'The discarded card is unavailable.');
    const [card] = room.discardPile.splice(index, 1);
    gainBattleCards(room, player, [card], { reason: 'tour-retrieval' });
    note(room, '公开取回了一张弃牌。', 'A discarded card was publicly retrieved.', { tourCard: { name: card.name, weather: card.weather } });
    return finishTourTool(room);
  }
  if (next.kind === 'gift') {
    const event = room.resolution, recipient = trainer(room, next.recipientId);
    requireRule(event?.eventType === 'tour-gift' && recipient && !recipient.eliminated, 'STALE_DECISION', 'The gift recipient changed.');
    if (option.value === 'done') return finishTourGift(room, ctx);
    const index = player.hand.findIndex(card => card.id === option.value);
    requireRule(index >= 0, 'INVALID_CARD', 'Choose a card from your hand.');
    gainBattleCards(room, recipient, player.hand.splice(index, 1), { reason: 'tour-gift' });
    event.giftCount = (event.giftCount || 0) + 1;
    if (event.giftCount === 2 || !player.hand.length) return finishTourGift(room, ctx);
    return tourDecision(room, player, pending.title,
      [{ value: 'done', label: { zh: '结束赠礼', en: 'Finish gift' } }, ...player.hand.map(tourCardOption)],
      next, ctx);
  }
  if (next.kind === 'emergency-retreat') {
    const event = room.tourAfterSwitches, entry = event.entries[event.index - 1];
    requireRule(tourSwitchValid(room,entry,ctx) && entry.playerId===player.id,'STALE_DECISION','The retreating partners changed.');
    event.switchedIds.push(player.id);
    return requestBattleSwitch(room,player,'emergency-retreat',ctx);
  }
  if (next.kind === 'post-switch') {
    const event = room.tourAfterSwitches, entry = event.entries[event.index - 1];
    const holder = trainer(room, entry.holderId), switching = trainer(room, entry.playerId);
    if (tourSwitchValid(room, entry, ctx)) {
      room.discardPile.push(holder.active.item);
      delete holder.active.item;
      event.switchedIds.push(switching.id);
      if(holder.active.catalogueId==='mankey'&&battleTraitsEffective(room,holder.active)) {
        room.tourDefiantNext={kind:'switch',playerId:switching.id};
        decision(room,'defiant',holder.id,holder.id,ctx);return;
      }
      return requestBattleSwitch(room, switching, 'tour-post', ctx);
    }
    return advanceTourSwitches(room, ctx);
  }
  if (next.kind === 'crunch') {
    const target = creature(room, room.resolution.targetCreatureId);
    if (option.value === 'discard' && target.item) {
      room.discardPile.push(target.item); delete target.item;
      if (target.catalogueId === 'mankey' && battleTraitsEffective(room, target)) {
        room.tourDefiantNext={kind:'damage'};
        decision(room, 'defiant', player.id, player.id, ctx);
        return;
      }
      return afterDamage(room, ctx);
    }
    room.resolution.tourCrunchDamage = true;
    return receiveDamage(room, ctx, 1);
  }
  const index = player.hand.findIndex(card => card.id === option.value);
  requireRule(index >= 0, 'INVALID_CARD', 'Choose a card from your own hand.');
  const [card] = player.hand.splice(index, 1);
  if (next.kind === 'roadblock-switch') {
    room.discardPile.push(card);
    note(room, '本次普通交替已为卡比兽堵路弃置一张手牌。', 'A hand card was discarded to attempt an ordinary switch through Snorlax Roadblock.');
    return beginBattleSwitch(room, player, 'ordinary', ctx);
  }
  if (next.kind === 'gear') {
    room.discardPile.push(card);
    drawBattleCards(room, player, Math.min(1, room.drawPile.length + room.discardPile.length), 'tour-gear');
    return finishTourTool(room);
  }
  requireRule(next.kind === 'action' && player.active.instanceId === next.activeId &&
    player.reserve?.instanceId === next.reserveId, 'STALE_DECISION', 'Your partners changed.');
  if (next.action === 'prepare' || next.action === 'observe') {
    const observe = next.action === 'observe';
    if (observe) {
      room.turn.hoennObserved = true;
      refillDrawPile(room, 1);
    } else room.turn.tourPrepared = true;
    room.drawPile.unshift(card);
    drawBattleCards(room, player, 1, observe ? 'hoenn-observe' : 'tour-prepare');
  } else {
    room.discardPile.push(card);
    if (next.action === 'train') {
      player.reserve.revealed = true; player.reserve.level++; room.turn.tourLevelUsed = true;
      delete room.turn.tourLevelTarget;
    }
    if (next.action === 'handoff') {
      const item = player.active.item;
      player.active.item = player.reserve.item;
      player.reserve.item = item;
      delete room.turn.tourHandoff;
      // Losing or replacing an active item uses Defiant's existing continuation.
      if (item && player.active.catalogueId === 'mankey' && battleTraitsEffective(room, player.active)) {
        decision(room, 'defiant', player.id, player.id, ctx);
      }
    }
    if (next.action === 'pickup') {
      room.turn.tourPickup = true;
      return tourDecision(room, player, tourActionNames.pickup,
        room.discardPile.filter(item => item.kind === 'held-item' && item.weather === card.weather).map(tourCardOption),
        { kind: 'pickup-item' }, ctx);
    }
  }
  note(room, '巡回行动已完成。', 'The tour action resolved.');
}
function finishTourGift(room, ctx) {
  const event = room.resolution, source = creature(room, event.actorCreatureId);
  if (event.giftCount === 2 && activeOwner(room, source?.instanceId)) heal(source, 1, ctx.catalogue);
  note(room, '赠礼已完成，手牌内容仅双方可见。', 'The gift resolved. Card faces are private to the participants.');
  return nextSettlement(room, ctx);
}
function queueEmergencyRetreat(resolution,player) {
  resolution.tourSwitches ??= [];
  if (!resolution.tourSwitches.some(entry=>entry.kind==='emergency-retreat' && entry.playerId===player.id)) {
    resolution.tourSwitches.push({kind:'emergency-retreat',holderId:player.id,playerId:player.id,
      activeId:player.active.instanceId,reserveId:player.reserve?.instanceId});
  }
}
function tourSwitchValid(room, entry, ctx) {
  if (entry.kind==='emergency-retreat') {
    const owner=trainer(room,entry.playerId);
    return owner && !owner.emergencyRetreatDebt && owner.active?.instanceId===entry.activeId &&
      owner.reserve?.instanceId===entry.reserveId && tourCanSwitch(room,owner,ctx.catalogue) &&
      !room.tourAfterSwitches.switchedIds.includes(owner.id);
  }
  const holder = trainer(room, entry.holderId), switching = trainer(room, entry.playerId);
  return holder && !holder.eliminated && holder.active?.instanceId === entry.holderInstanceId &&
    activeItemIs(room, holder.active, entry.itemType) && holder.active.item.id === entry.itemId &&
    currentHp(holder.active, ctx.catalogue) > 0 &&
    switching?.active?.instanceId === entry.activeId && tourCanSwitch(room, switching, ctx.catalogue) &&
    !room.tourAfterSwitches.switchedIds.includes(switching.id);
}
function queueTourSwitch(room, target, ctx) {
  const resolution = room.resolution;
  if (resolution.kind !== 'move' || resolution.tourCrunchDamage) return;
  const holder = activeOwner(room, target.instanceId);
  if (!holder || !['tour-eject', 'tour-red-card'].some(type => activeItemIs(room, target, type))) return;
  const item = target.item;
  const playerId = item.itemType === 'tour-eject' ? holder.id : resolution.sourcePlayerId;
  const switching = trainer(room, playerId);
  if (!switching) return;
  resolution.tourSwitches ??= [];
  if (resolution.tourSwitches.some(entry => entry.itemId === item.id)) return;
  resolution.tourSwitches.push({ holderId: holder.id, holderInstanceId: target.instanceId, itemId: item.id,
    itemType: item.itemType, playerId, activeId: switching.active.instanceId });
}
function advanceTourSwitches(room, ctx) {
  const event = room.tourAfterSwitches;
  while (event.index < event.entries.length) {
    const entry = event.entries[event.index++];
    if (!tourSwitchValid(room, entry, ctx)) continue;
    const holder = trainer(room, entry.holderId);
    if (entry.kind==='emergency-retreat') return tourDecision(room,holder,emergencyRetreat.name,
      [{value:'switch',label:{zh:'交替 · 占用下回合普通交替',en:'Switch · use next turn’s ordinary switch'}}],
      {kind:'emergency-retreat'},ctx,true);
    return tourDecision(room, holder, holder.active.item.name,
      [{ value: 'switch', label: { zh: '弃物并交替', en: 'Discard item and switch' } }],
      { kind: 'post-switch' }, ctx, true);
  }
  const resolution = event.resolution;
  delete room.tourAfterSwitches;
  room.resolution = resolution;
  return finishResolution(room, ctx);
}
