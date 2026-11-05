// Supplied booklet pp.2–12 and reviewed-playcard-spec.md define these effects.
// This is an explicitly labelled development scenario, not a retail deck manifest.
import { randomUUID, randomInt } from 'node:crypto';
import { dealPokemon, shufflePokemon } from './pokemon-deal.js';
import { roleDeck, maxHp, currentHp, heal, applyDamage, beginCommand, computeDamage, reinforcementEffective, eligibleTargetIds, evaluateVictory, ordinarySwitch } from './battle-rules.js';

export class BattleError extends Error {
  constructor(code, message, status = 409) { super(message); this.code = code; this.status = status; }
}
const requireRule = (condition, code, message) => { if (!condition) throw new BattleError(code, message); };
export const isBattle = room => room.gameMode === 'combat-preview';
export const battleSelectionIds = catalogue => catalogue.entries.filter(entry => entry.selectionEligible === true && [1,2,3].every(level => entry.levels?.some(face => face.level === level && face.hpStatus === 'photo-reviewed' && Number.isInteger(face.hp)))).map(entry => entry.id);
const trainer = (room, id) => room.players.find(p => p.id === id);
const live = room => room.players.filter(p => !p.spectator && !p.eliminated);
const face = (pokemon, catalogue) => catalogue.entries.find(p => p.id === pokemon.catalogueId)?.levels.find(p => p.level === pokemon.level);
const creature = (room, id) => room.players.flatMap(p => [p.active, p.reserve]).find(p => p?.instanceId === id);
// Suppression belongs to the trainer for the entire global turn, including reserves.
export const battleTraitsEffective=(room,pokemon)=>Boolean(pokemon&&!pokemon.defeated&&!room?.turn?.suppressedTraitPlayerIds?.some(id=>{const owner=trainer(room,id);return [owner?.active,owner?.reserve].some(partner=>partner?.instanceId===pokemon.instanceId);}));
// Named-event permission remains specific to the two printed Early Bird events.
export const battleEventTargetAllowed=(room,pokemon,eventNameZh)=>!(pokemon?.catalogueId==='kangaskhan'&&activeOwner(room,pokemon.instanceId)&&battleTraitsEffective(room,pokemon)&&['胖丁的表演','魔墙人偶的戏法'].includes(eventNameZh));
const reinforcementsSuppressed=(room,pokemon)=>Boolean(pokemon&&[room.resolution,...(room.resolutionStack||[])].some(resolution=>resolution?.suppressedReinforcementIds?.includes(pokemon.instanceId)));
export const battleReinforcementEffective=(room,pokemon,kind)=>!reinforcementsSuppressed(room,pokemon)&&reinforcementEffective(pokemon,kind);
const damageOptions=(room,source,target,options={})=>({...options,targetReinforcements:!reinforcementsSuppressed(room,target),sourceTraits:battleTraitsEffective(room,source),targetTraits:battleTraitsEffective(room,target)});
const damageImmune=(room,pokemon)=>battleTraitsEffective(room,pokemon)&&room.turn?.damageImmunityIds?.includes(pokemon.instanceId);
function note(room, zh, en) { room.log.push({ id: randomUUID(), text: { zh, en } }); room.log = room.log.slice(-80); }
function shuffled(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) { const j = randomInt(i + 1); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
function card(kind) {
  return { id: randomUUID(), kind, weather: 'intense-sun', fixture: true, name: kind === 'command' ? { zh: '接招吧！', en: 'Take this!' } : { zh: '快躲开！', en: 'Dodge!' } };
}
export function setupBattle(room, catalogue) {
  const seats = room.players.filter(p => !p.spectator);
  requireRule(seats.length >= 3 && seats.length <= 6 && seats.every(p => p.ready), 'NOT_READY', 'Combat preview requires 3–6 ready players.');
  requireRule(battleSelectionIds(catalogue).length >= seats.length * 5, 'CONTENT_UNAVAILABLE', 'The shared Pokémon deck needs five unique groups per player.');
  const roles = shuffled(roleDeck(seats.length));
  seats.forEach((p, index) => { p.role = roles[index]; p.eliminated = false; p.candidates = []; p.candidateDeal = []; p.identityAcknowledged = false; p.setupComplete = false; p.active = null; p.reserve = null; p.hand = []; p.exiledCards=[]; });
  const leaderIndex = seats.findIndex(p => p.role === 'leader');
  room.players = [...seats.slice(leaderIndex), ...seats.slice(0, leaderIndex), ...room.players.filter(p => p.spectator)];
  delete room.judgment;delete room.resolutionStack;delete room.statusEvent;delete room.protectionWindow;delete room.turnStart;delete room.switchEvent;delete room.entryEvent;delete room.drawChoice;delete room.initialBattleEntries;
  room.gameMode = 'combat-preview'; room.result = null; room.pendingBattle = null; room.resolution = null; room.status = 'identity';
  room.scenario = { name: 'reviewed-roster', developmentFixture: true, candidateCount: 5, pokemonPoolCount: battleSelectionIds(catalogue).length, cardsPerSeat: 12, commandPerSeat: 6, dodgePerSeat: 6, potionSupported: true, articunoReactions: false };
  note(room, '身份已分配；所有人查看身份后再摸取宝可梦候选。', 'Identities assigned; Pokémon candidates are dealt after everyone has viewed their identity.');
}
export function acknowledgeBattleIdentity(room, player, catalogue) {
  requireRule(!player.identityAcknowledged, 'IDENTITY_ALREADY_SEEN', 'Your identity is already acknowledged.');
  player.identityAcknowledged = true;
  const seats = room.players.filter(p => !p.spectator);
  if (!seats.every(p => p.identityAcknowledged)) return;
  room.pokemonDeck = dealPokemon(seats, battleSelectionIds(catalogue));
  room.status = 'setup';
  note(room, '从共享洗匀的宝可梦牌库为每位训练家预留五张，所有玩家之间不重复。', 'Five candidates per trainer reserved from one shuffled shared Pokémon deck, without repeats between trainers.');
}
export function selectBattlePartners(room, player, activeId, reserveId, catalogue) {
  requireRule(!player.setupComplete && activeId !== reserveId && player.candidates.includes(activeId) && player.candidates.includes(reserveId), 'INVALID_SELECTION', 'Choose two different candidates.');
  requireRule(player.candidates.length === 5 && !(player.candidateDeal?.length), 'CANDIDATE_DRAW_INCOMPLETE', 'Draw all five Pokémon before choosing two.');
  const count = room.players.filter(p => !p.spectator).length;
  const make = (id, level, revealed) => ({ instanceId: randomUUID(), catalogueId: id, level, revealed, damage: 0, status: null, reinforcements: [], hpBonus: player.role === 'leader' && count >= 5 ? 1 : 0, defeated: false });
  player.active = make(activeId, player.role === 'leader' ? 2 : 1, true);
  player.reserve = make(reserveId, 1, false); player.setupComplete = true;
  room.pokemonDeck.push(...player.candidates.filter(id => id !== activeId && id !== reserveId));
  if (!room.players.filter(p => !p.spectator).every(p => p.setupComplete)) return false;
  room.drawPile = shuffled(Array.from({ length: count * 12 }, (_, index) => card(index % 2 ? 'command' : 'dodge')));
  room.discardPile = []; room.pokemonDeck = shufflePokemon(room.pokemonDeck); room.status = 'playing';
  for (const p of room.players.filter(p => !p.spectator)) { p.candidates = []; drawBattleCards(room, p, 4,'setup'); maxHp(p.active, catalogue); }
  room.initialBattleEntries=live(room).map(player=>player.id);
  return true;
}
function topCard(room) {
  if (!room.drawPile.length && room.discardPile.length) { room.drawPile = shuffled(room.discardPile); room.discardPile = []; }
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
  const cards=[];for(let i=0;i<count;i++)cards.push(topCard(room));gainBattleCards(room,player,cards,{reason});
}
function startJudgment(room,ctx,continuation,judgeId) {
  requireRule(!room.judgment,'JUDGMENT_PENDING','Finish the current judgment first.');
  if(!room.drawPile.length&&!room.discardPile.length) {
    room.pendingBattle=null;
    note(room,'当前没有可用的判定牌；没有判定结果，相关效果跳过。','No judgment card is available. There is no result, so the judgment effect is skipped.');
    return continueJudgment(room,ctx,continuation,null);
  }
  const card=topCard(room),seats=live(room),start=seats.findIndex(p=>p.id===room.turn.playerId);
  const ordered=[...seats.slice(start),...seats.slice(0,start)].filter(p=>p.active?.catalogueId==='vulpix'&&battleTraitsEffective(room,p.active));
  room.judgment={card,actorIds:ordered.map(p=>p.id),actorInstances:Object.fromEntries(ordered.map(p=>[p.id,p.active.instanceId])),index:0,continuation,judgeId};
  const names={'intense-sun':['烈日','intense sun'],clear:['晴朗','clear'],rain:['暴雨','heavy rain'],thunderstorm:['雷雨','thunderstorm']}[card.weather];
  note(room,`判定展示一张牌，天气为${names[0]}；判定结果等待生效。`,`A judgment revealed ${names[1]}; its result is pending.`);
  advanceJudgment(room,ctx);
}
function advanceJudgment(room,ctx) {
  const judgment=room.judgment;
  while(judgment.index<judgment.actorIds.length) {
    const actor=trainer(room,judgment.actorIds[judgment.index]);
    if(actor && !actor.eliminated && !actor.active.defeated && actor.active.catalogueId==='vulpix' && battleTraitsEffective(room,actor.active) && actor.active.instanceId===judgment.actorInstances[actor.id]) {
      decision(room,'judgment',actor.id,judgment.judgeId,ctx);
      const card=judgment.card;
      room.pendingBattle.judgmentCard={name:card.name,weather:card.weather,kind:card.kind};
      return;
    }
    judgment.index++;
  }
  const {card,continuation}=judgment;
  const gained=continuation.kind==='icicle-spear' && ['rain','thunderstorm'].includes(card.weather);
  if(gained)gainBattleCards(room,trainer(room,continuation.ownerId),[card],{reason:'judgment'});else room.discardPile.push(card);
  delete room.judgment;room.pendingBattle=null;
  note(room,gained?'冰锥获得最终的雨天判定牌。':'最终判定牌进入弃牌堆。',gained?'Icicle Spear obtained the final rainy judgment card.':'The final judgment card entered the discard pile.');
  continueJudgment(room,ctx,continuation,card.weather);
}
function continueJudgment(room,ctx,next,weather) {
  if(next.kind==='zapdos') {
    const resolution=room.resolution,owner=activeOwner(room,next.targetId);
    if(weather==='thunderstorm'&&resolution?.kind==='event'&&resolution.eventType==='zapdos-punishment'&&owner&&owner.active.instanceId===resolution.targetCreatureId&&currentHp(owner.active,ctx.catalogue)>0)return settleEventDamage(room,ctx,owner.active.level);
    return nextSettlement(room,ctx);
  }
  if(next.kind==='water-absorb') {
    const owner=activeOwner(room,next.pokemonId);
    if(owner&&battleTraitsEffective(room,owner.active)) {
      if(weather==='rain')heal(owner.active,1,ctx.catalogue);
      if(weather==='thunderstorm'&&room.drawPile.length+room.discardPile.length)drawBattleCards(room,owner,1,'water-absorb');
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
    if(weather!=='intense-sun')return applyStatus(room,ctx,creature(room,next.sourceId),'paralysis','afterDamage');
    return afterDamage(room,ctx);
  }
  if(next.kind==='poison-point') {
    if(weather!=='intense-sun')return applyStatus(room,ctx,creature(room,next.sourceId),'poison','afterDamage');
    return afterDamage(room,ctx);
  }
  if(next.kind==='sand-veil') {
    if(['intense-sun','clear'].includes(weather)) {
      if(!next.defense.dodgeReducesDamage) {
        if(next.defense.dodgesRequired===2&&++next.defense.dodgesPlayed<2)note(room,'沙隐视为一次躲闪；十字剪仍需要另一次才能抵消。','Sand Veil counted as one Dodge; X-Scissor still needs another to cancel.');
        else {note(room,'沙隐视为使用一张快躲开！并抵消本次结算。','Sand Veil counted as one Dodge! and canceled this settlement.');return nextSettlement(room,ctx);}
      }else {
        next.defense.damageReduction=reduceMoveDamage(room,room.resolution.targetCreatureId);
        note(room,'沙隐视为使用一张快躲开！，锐利目光将其改为此招式伤害减1。','Sand Veil counted as one Dodge!; Keen Eye changed it to one damage reduction for this move.');
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
      if(next.family==='bulbasaur' && ['intense-sun','clear'].includes(weather)){room.turn.rangeCreatureId=next.sourceId;room.turn.cardRangePlayerId=next.ownerId;}
      if(next.family==='squirtle' && ['rain','thunderstorm'].includes(weather)){pokemon.status=null;heal(pokemon,1,ctx.catalogue);}
      if(next.family==='psyduck' && ['rain','thunderstorm'].includes(weather)) {
        room.turn.cardRangePlayerId=next.ownerId;
        room.turn.swiftSwimCreatureIds??=[];
        if(!room.turn.swiftSwimCreatureIds.includes(next.sourceId))room.turn.swiftSwimCreatureIds.push(next.sourceId);
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
const reviewedItem=card=>card?.kind==='held-item'&&card.itemType==='rocky-helmet';
const publicItem=card=>card?{itemType:card.itemType,name:card.name,weather:card.weather}:null;
function itemEffective(room,pokemon) {
  return pokemon?.item?.kind==='held-item'&&![room.resolution,...(room.resolutionStack||[])].some(resolution=>resolution?.suppressedItemIds?.includes(pokemon.instanceId));
}
const gluttonyReplacesItem=(room,pokemon)=>Boolean(room&&pokemon?.catalogueId==='snorlax'&&activeOwner(room,pokemon.instanceId)&&battleTraitsEffective(room,pokemon)&&itemEffective(room,pokemon));
const helmetEffective=(room,pokemon)=>reviewedItem(pokemon?.item)&&itemEffective(room,pokemon)&&!gluttonyReplacesItem(room,pokemon);
export function endBattleTurn(room,player,ctx) {
  if(!isBattle(room)||room.status!=='playing'||room.turn?.playerId!==player?.id||room.turn.endEffectsDone)return;
  room.turn.endEffectsDone=true;
  const pokemon=player.active;
  if(!player.eliminated&&pokemon&&!pokemon.defeated&&currentHp(pokemon,ctx.catalogue)>0&&gluttonyReplacesItem(room,pokemon)) {
    const result=heal(pokemon,1,ctx.catalogue);
    if(result.healed)note(room,'贪吃鬼将持有物效果改为回合结束时回复1点体力。','Gluttony replaced the held-item effect and healed 1 HP at this trainer’s turn end.');
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
  if(effect!=='rocky-helmet'&&!battleTraitsEffective(room,target))return continueReceiving(room,ctx);
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
    room.turn.damageImmunityIds??=[];if(!room.turn.damageImmunityIds.includes(target.instanceId))room.turn.damageImmunityIds.push(target.instanceId);
    note(room,'迟钝使此宝可梦在当前训练家回合结束前不再受到伤害。','Oblivious prevents further damage to this Pokémon until the current trainer turn ends.');
  }
  if(effect==='rocky-helmet' && sourceOwner && !source.defeated && helmetEffective(room,target) && target.item.id===resolution.helmetCardId) {
    room.resolutionStack??=[];room.resolutionStack.push(resolution);
    room.resolution={kind:'item',card:null,channelCard:target.item,sourceId:target.instanceId,sourcePlayerId:owner.id,targetCreatureId:source.instanceId,targetIds:[sourceOwner.id],index:0,damagedIds:[],defenseIds:[],actualDamage:0};
    const amount=damageImmune(room,source)?0:computeDamage(target,source,1,ctx.catalogue,damageOptions(room,target,source,{command:false,channel:'item',receiving:!hasShedSkin(room,source)}));
    receiveDamage(room,ctx,amount);
    return;
  }
  continueReceiving(room,ctx);
}
function cleanResolution(room,resolution) {
  if(resolution.cleaned)return;
  resolution.cleaned=true;
  if(resolution.card&&!resolution.cardClaimedBy)room.discardPile.push(resolution.card);
  if(resolution.revealedCards?.length){room.discardPile.push(...resolution.revealedCards);delete resolution.revealedCards;}
  if(resolution.distributionCards?.length){room.drawPile.push(...[...resolution.distributionCards].reverse());delete resolution.distributionCards;}
  for(const id of new Set(resolution.defenseIds||[])) {
    const pokemon=creature(room,id);if(pokemon)pokemon.reinforcements=(pokemon.reinforcements||[]).filter(kind=>kind!=='defense');
  }
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
  if(next.switchKind==='u-turn')return finishResolution(room,ctx);
  if(next.switchKind!=='ordinary')return nextSettlement(room,ctx);
}
function beginBattleEntries(room,players,ctx,next) {
  requireRule(!room.entryEvent,'ENTRY_PENDING','Finish the current entry effect first.');
  room.entryEvent={actorIds:players.map(player=>player.id),actorInstances:Object.fromEntries(players.map(player=>[player.id,player.active.instanceId])),index:0,next};
  return advanceBattleEntries(room,ctx);
}
function advanceBattleEntries(room,ctx) {
  const event=room.entryEvent;
  while(event.index<event.actorIds.length) {
    const actor=trainer(room,event.actorIds[event.index]);
    const targets=live(room).filter(player=>player.hand.length).map(player=>player.id);
    if(actor&&!actor.eliminated&&actor.active?.instanceId===event.actorInstances[actor.id]&&actor.active.catalogueId==='tauros'&&battleTraitsEffective(room,actor.active)&&currentHp(actor.active,ctx.catalogue)>0&&targets.length) {
      decision(room,'intimidate',actor.id,actor.id,ctx);room.pendingBattle.legalTargetIds=targets;return;
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
    ordinarySwitch(player,ctx.catalogue);player.reserve.revealed=true;
    if(event.kind==='ordinary')room.turn.switchUsed=true;
    note(room,'出战与备战宝可梦已交替。','The active and reserve Pokémon switched.');
    return beginBattleEntries(room,[player],ctx,{kind:'switch',switchKind:event.kind});
  }else note(room,'本次交替未完成，已经支付的费用不退还。','The switch did not complete; any cards already paid remain discarded.');
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
  requireRule(!room.switchEvent,'SWITCH_PENDING','Finish the current switch first.');
  const start=Math.max(0,room.players.findIndex(p=>p.id===room.turn.playerId));
  // Speed removes card/move distance only; Arena Trap uses passive base adjacency.
  const actors=[...room.players.slice(start),...room.players.slice(0,start)].filter(actor=>!actor.spectator&&!actor.eliminated&&actor.active?.catalogueId==='diglett'&&battleTraitsEffective(room,actor.active)&&currentHp(actor.active,ctx.catalogue)>0&&eligibleTargetIds(room.players,actor.id).includes(player.id));
  room.switchEvent={kind,playerId:player.id,activeId:player.active?.instanceId??null,reserveId:player.reserve?.instanceId??null,actorIds:actors.map(actor=>actor.id),actorInstances:Object.fromEntries(actors.map(actor=>[actor.id,actor.active.instanceId])),index:0};
  advanceBattleSwitch(room,ctx);
}
const isArticunoCard=card=>card?.kind==='event'&&card.eventType==='articuno-protection';
// Public deck capability: offer the same windows even when every hand is empty.
// The default command/Dodge fixture has no reaction cards.
function startProtectionWindow(room,ctx,window) {
  if(room.scenario?.articunoReactions!==true)return false;
  requireRule(!room.protectionWindow,'REACTION_PENDING','Finish the current protection window first.');
  const seats=live(room),start=Math.max(0,seats.findIndex(player=>player.id===room.turn.playerId));
  room.protectionWindow={...window,actorIds:[...seats.slice(start),...seats.slice(0,start)].map(player=>player.id),index:0};
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
      if(actor&&!actor.eliminated&&!actor.spectator) {
        decision(room,'articuno',actor.id,window.targetId,ctx);
        Object.assign(room.pendingBattle,{mode:window.mode,...(window.mode==='cancel-event'?{eventName:window.eventName}:{status:window.status})});return;
      }
      window.index++;
    }
  }
  return finishProtectionWindow(room,ctx);
}
function resumeStatusContinuation(room,ctx,next) {
  return next==='settlement'?nextSettlement(room,ctx):afterDamage(room,ctx);
}
function applyStatus(room,ctx,pokemon,status,next='afterDamage') {
  // One-status restriction precedes replacement. Never redirect to a reserve
  // deployed after the original target fainted.
  if(!pokemon || !activeOwner(room,pokemon.instanceId) || pokemon.status)return resumeStatusContinuation(room,ctx,next);
  if(['caterpie','weedle'].includes(pokemon.catalogueId)&&pokemon.level===1&&battleTraitsEffective(room,pokemon)) {
    note(room,'鳞粉阻止此宝可梦陷入特殊状态。','Shield Dust prevented this Pokémon from gaining a special status.');
    return resumeStatusContinuation(room,ctx,next);
  }
  if(status==='paralysis'&&pokemon.catalogueId==='meowth'&&pokemon.level===3&&battleTraitsEffective(room,pokemon)) {
    note(room,'柔软阻止此宝可梦陷入麻痹。','Limber prevented this Pokémon from becoming Paralyzed.');
    return resumeStatusContinuation(room,ctx,next);
  }
  if(status==='sleep'&&pokemon.catalogueId==='electabuzz'&&battleTraitsEffective(room,pokemon)) {
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
export function publicBattleDecision(room,self) {
  if(!room.pendingBattle)return null;
  const pending=structuredClone(room.pendingBattle);
  delete pending.targetCreatureId;
  if(pending.kind==='articuno'&&pending.actorId===self.id)pending.protectionCards=self.hand.filter(isArticunoCard).map(({id,name,kind,weather})=>({id,name,kind,weather}));
  if(pending.kind==='rescue') {
    const restricted=rescueOwnerOnly(room);
    pending.canUsePotion=!restricted||pending.actorId===pending.targetId;
    if(restricted)pending.potionRestrictedToOwner=true;
    if(pending.actorId===self.id) {
      const stub=({id,name,weather,kind})=>({id,name,weather,kind});
      pending.potionCards=pending.canUsePotion?self.hand.filter(isPotionCard).map(stub):[];
      pending.healerCards=pending.canUsePotion&&hasHealer(room,self)?self.hand.filter(card=>['intense-sun','clear'].includes(card.weather)).map(stub):[];
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
function finishDownload(room,player) {
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
  return finishDownload(room,player);
}
function charmTargets(room,owner,ctx) {
  const resolution=room.resolution,index=resolution.targetingIndex;
  return eligibleTargetIds(room.players,owner.id).filter(id=>id!==owner.id&&id!==resolution.sourcePlayerId&&!resolution.targetIds.some((target,i)=>i!==index&&target===id)&&face(trainer(room,id).active,ctx.catalogue)?.effectStatus==='combat-preview');
}
function finishTargetAssignment(room,ctx) {
  delete room.resolution.targetingIndex;delete room.resolution.charmSeenIds;
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
    if(room.drawPile.length<4&&room.discardPile.length){room.drawPile=[...shuffled(room.discardPile),...room.drawPile];room.discardPile=[];}
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
  delete resolution.incomingDamage;delete resolution.modifierState;
  resolution.sourceAfterDone=false; resolution.staticDone=false; delete resolution.receivingEffects;delete resolution.helmetCardId; resolution.actualDamage=0; delete resolution.handChoiceIds;
  decision(room, 'defense', target.id, target.id, ctx);
  room.pendingBattle.cannotDodge=Boolean(resolution.ignoresReinforcements);
  if(room.turn.dodgeBlockedCreatureIds?.includes(target.active.instanceId)){room.pendingBattle.cannotDodge=true;room.pendingBattle.dodgeBlockedBy='lock-on';}
  if(resolution.dodgesRequired===2){room.pendingBattle.dodgesRequired=2;room.pendingBattle.dodgesPlayed=0;}
  room.pendingBattle.canTrait=!room.pendingBattle.cannotDodge && canSandVeil(room,target) && room.drawPile.length+room.discardPile.length>0;
  if(room.pendingBattle.canTrait)room.pendingBattle.trait='sand-veil';
  if(resolution.sourceFamily==='caterpie'&&resolution.sourceLevel===3&&battleTraitsEffective(room,creature(room,resolution.sourceId))&&resolution.sourcePlayerId!==target.id)room.pendingBattle.blockedDodgeWeathers=['intense-sun'];
  if(resolution.settlementCount!==undefined)Object.assign(room.pendingBattle,{settlementNumber:resolution.settlementIndex+1,settlementCount:resolution.settlementCount});
  if(resolution.sourceFamily==='pidgey'&&battleTraitsEffective(room,creature(room,resolution.sourceId))&&resolution.sourcePlayerId!==target.id) {
    room.pendingBattle.dodgeReducesDamage=true;room.pendingBattle.damageReduction=resolution.dodgeReductions?.[target.active.instanceId]||0;
  }
}
function reduceMoveDamage(room,targetId) {
  room.resolution.dodgeReductions??={};
  return room.resolution.dodgeReductions[targetId]=(room.resolution.dodgeReductions[targetId]||0)+1;
}
const hasSniper=(room,player)=>!player.spectator&&!player.eliminated&&player.active?.catalogueId==='weedle'&&player.active.level===3&&battleTraitsEffective(room,player.active);
export const cardDistanceIgnored=(room,player)=>room.turn?.cardRangePlayerId===player.id||Boolean(room.turn?.rangeCreatureId&&[player.active,player.reserve].some(pokemon=>pokemon?.instanceId===room.turn.rangeCreatureId))||hasSniper(room,player);
const weatherMoveEffects=new Set(['burn-judgment','temporary-hand-exile','self-defense','paralysis-judgment','forced-switch','sleep-judgment','swords-dance','light-screen','lock-on','discard-other-hand','life-dew']);
const isPotionCard=card=>card?.kind==='tool'&&['potion-full-heal','potion-revive'].includes(card.toolType);
const rescueOwnerOnly=room=>[room.resolution,...(room.resolutionStack||[])].some(resolution=>resolution?.effectKind==='fainting-owner-potion-only');
// A fainting active still has its trait until formal defeat; reserves do not.
const hasHealer=(room,owner)=>Boolean(owner&&!owner.eliminated&&owner.active?.catalogueId==='chansey'&&battleTraitsEffective(room,owner.active));
const potionChoice={effect:'potion',name:{zh:'伤药',en:'Potion'},description:{zh:'出牌阶段令一只已受伤的出战或备战宝可梦回复2点体力；昏厥结算中可救援目标并回复2点体力。',en:'During Play, restore 2 HP to an injured active or reserve Pokémon; during fainting settlement, restore 2 HP to that target.'}};
// One physical split card supplies two alternatives; only one executes. These
// readable tool faces impose no distance restriction (booklet p07 is conditional).
const splitTools=[
  {toolType:'potion-full-heal',choices:[
    potionChoice,
    {effect:'full-heal',name:{zh:'万灵药',en:'Full Heal'},description:{zh:'在你的出牌阶段，对一只处于特殊状态的出战或备战宝可梦使用，恢复其特殊状态。',en:'During your Play phase, cure one active or reserve Pokémon’s special status.'}},
  ]},
  {toolType:'potion-revive',choices:[potionChoice,{effect:'revive',name:{zh:'活力碎片',en:'Revive'},description:{zh:'复活效果尚未实现。',en:'Revival is not implemented yet.'},unavailableReason:{zh:'复活效果尚未实现。',en:'Revival is not implemented yet.'}}]},
  {toolType:'rare-candy-nugget',choices:[
    {effect:'rare-candy',name:{zh:'神奇糖果',en:'Rare Candy'},description:{zh:'在你的出牌阶段，使一只不处于等级3的出战宝可梦提升一个等级。',en:'During your Play phase, raise one active Pokémon below level 3 by one level.'}},
    {effect:'nugget',targeting:'trainer',name:{zh:'金珠',en:'Nugget'},description:{zh:'在你的出牌阶段，对一名训练家使用，令其摸两张牌。',en:'During your Play phase, one trainer draws two cards.'}},
  ]},
];
function toolTargets(room,player,catalogue,effect) {
  if(effect==='nugget')return live(room).map(owner=>({targetId:owner.id}));
  if(!['potion','full-heal','rare-candy'].includes(effect))return [];
  return live(room).flatMap(owner=>['active','reserve'].flatMap(slot=>{
    const pokemon=owner[slot];
    // No current status source reaches an unrevealed opposing reserve. Never
    // query its hidden state; future reserve-status effects need a reveal flow.
    if(slot==='reserve'&&owner.id!==player.id&&!pokemon?.revealed)return [];
    if(!pokemon||pokemon.defeated||currentHp(pokemon,catalogue)<=0)return [];
    const legal=effect==='potion'?(pokemon.damage||0)>0:effect==='full-heal'?Boolean(pokemon.status):slot==='active'&&pokemon.level<3;
    return legal?[{targetId:owner.id,slot}]:[];
  }));
}
function toolActions(room,player,catalogue,own) {
  return splitTools.filter(tool=>player.hand.some(card=>card.kind==='tool'&&card.toolType===tool.toolType)).map(tool=>({toolType:tool.toolType,choices:tool.choices.map(choice=>({...choice,targets:own?toolTargets(room,player,catalogue,choice.effect):[]}))}));
}
// Reviewed O03 and Master Edition video event faces; retail quantities stay gated.
const reviewedEvents={
  'moltres-trial':{name:{zh:'火焰鸟的试炼',en:"Moltres’s Trial"},description:{zh:'从下一位训练家起依次结算其他训练家的出战宝可梦；打出一张接招吧！，否则受到火焰鸟造成的2点伤害。',en:'Resolve other active Pokémon, starting with the next trainer. Play one actual command card response or receive 2 damage from Moltres.'}},
  'zapdos-punishment':{name:{zh:'闪电鸟的惩戒',en:"Zapdos’s Punishment"},description:{zh:'从下一位训练家开始，依次结算所有出战宝可梦（你最后）。目标训练家判定，雷雨时受到闪电鸟造成的等同于目标等级的伤害。',en:'Starting with the next trainer and ending with you, every active Pokémon’s trainer judges. Thunderstorm causes damage from Zapdos equal to that target’s level.'}},
  'jigglypuff-performance':{targeting:'single',name:{zh:'胖丁的表演',en:"Jigglypuff’s Performance"},description:{zh:'选择一只出战宝可梦；其训练家进行判定，结果不为雷雨时，目标陷入睡眠。',en:'Choose one active Pokémon. Its trainer judges; any result other than thunderstorm puts the target to Sleep.'}},
  'mr-mime-trick':{targeting:'single',name:{zh:'魔墙人偶的戏法',en:"Mr. Mime’s Trick"},description:{zh:'选择距离范围内的其他出战宝可梦，获得其训练家的一张手牌或其携带的持有物。',en:'Choose another active Pokémon within range and take one card from its trainer’s hand or its held item.'}},
  'mewtwo-threat':{name:{zh:'超梦的威压',en:"Mewtwo's Threat"},description:{zh:'从下一位训练家起依次结算所有其他训练家的出战宝可梦；打出一张快躲开！，否则受到超梦造成的2点伤害。',en:'Resolve every other active Pokémon, starting with the next trainer. Play one actual Dodge response or receive 2 damage from Mewtwo.'}},
  'mew-blessing':{name:{zh:'梦幻的祝福',en:"Mew’s Blessing"},description:{zh:'从你开始依次结算所有训练家的出战宝可梦；各目标的训练家选择回复2点体力或升1级（最高3级）。',en:'Resolve all active Pokémon, starting with you. Each target trainer chooses heal 2 HP or raise one level (up to level 3).'}}
};
function eventTargets(room,player,eventType) {
  const seats=live(room),index=seats.findIndex(seat=>seat.id===player.id);
  const ordered=[...seats.slice(index),...seats.slice(0,index)];
  if(eventType==='zapdos-punishment')ordered.push(ordered.shift());
  const ranged=eventType==='mr-mime-trick';
  const inRange=ranged?eligibleTargetIds(room.players,player.id,{ignoreDistance:cardDistanceIgnored(room,player)||battleReinforcementEffective(room,player.active,'speed')}):null;
  return ordered.filter(seat=>(!['mewtwo-threat','moltres-trial','mr-mime-trick'].includes(eventType)||seat.id!==player.id)&&seat.active&&!seat.active.defeated&&battleEventTargetAllowed(room,seat.active,reviewedEvents[eventType].name.zh)&&(!ranged||inRange.includes(seat.id)));
}
function eventActions(room,player,own) {
  return [...new Set(player.hand.filter(card=>card.kind==='event'&&Object.hasOwn(reviewedEvents,card.eventType)).map(card=>card.eventType))].map(eventType=>{
    const targets=eventTargets(room,player,eventType);
    const choices=eventType==='mr-mime-trick'?[{effect:'hand',name:{zh:'获得一张手牌',en:'Take one hand card'},description:{zh:'私下选择一张背面手牌并获得。',en:'Privately choose one hidden card back and take that card.'},targetIds:targets.filter(seat=>seat.hand.length).map(seat=>seat.id)},{effect:'item',name:{zh:'获得持有物',en:'Take held item'},description:{zh:'将持有物加入你的手牌，不自动携带。',en:'Put the held item in your hand; it is not automatically equipped.'},targetIds:targets.filter(seat=>seat.active.item).map(seat=>seat.id)}]:null;
    const targetIds=choices?[...new Set(choices.flatMap(choice=>choice.targetIds))]:targets.map(seat=>seat.id);
    return {eventType,...reviewedEvents[eventType],...(choices?{choices}:{}),targetIds,canUse:Boolean(own&&targetIds.length)};
  });
}
export function useBattleEvent(room,player,input,ctx) {
  const legal=previewActions(room,player,ctx.catalogue);
  requireRule(room.turn?.playerId===player.id&&room.turn.phase==='play'&&legal&&!room.pendingBattle&&!room.pendingVote,'EVENT_UNAVAILABLE','Events require your unblocked Play phase.');
  const selected=player.hand.find(card=>card.id===input.cardId&&card.kind==='event'&&Object.hasOwn(reviewedEvents,card.eventType));
  requireRule(selected&&legal.events.some(event=>event.eventType===selected.eventType&&event.canUse),'INVALID_CARD','Choose a reviewed event from your own hand.');
  const single=reviewedEvents[selected.eventType].targeting==='single',mime=selected.eventType==='mr-mime-trick';
  requireRule(Object.keys(input).every(key=>['id','revision','type','cardId',...(single?['targetId']:[]),...(mime?['effect']:[])].includes(key)),'INVALID_INPUT','Choose only the fields required by this event.');
  const descriptor=legal.events.find(event=>event.eventType===selected.eventType);
  if(single)requireRule(typeof input.targetId==='string'&&descriptor.targetIds.includes(input.targetId),'INVALID_TARGET','Choose a legal active Pokémon for this event.');
  if(mime)requireRule(descriptor.choices.some(choice=>choice.effect===input.effect&&choice.targetIds.includes(input.targetId)),'INVALID_EVENT_CHOICE','Choose a legal hand-card or held-item gain.');
  const targets=eventTargets(room,player,selected.eventType).filter(target=>!single||target.id===input.targetId);
  player.hand.splice(player.hand.indexOf(selected),1);
  room.resolution={kind:'event',card:selected,eventType:selected.eventType,eventName:reviewedEvents[selected.eventType].name,sourceId:null,sourcePlayerId:null,actorPlayerId:player.id,actorCreatureId:player.active.instanceId,...(mime?{eventEffect:input.effect}:{}),...(['mewtwo-threat','moltres-trial','zapdos-punishment'].includes(selected.eventType)?{externalSource:{kind:'external-pokemon',name:selected.eventType==='moltres-trial'?{zh:'火焰鸟',en:'Moltres'}:selected.eventType==='zapdos-punishment'?{zh:'闪电鸟',en:'Zapdos'}:{zh:'超梦',en:'Mewtwo'}}}:{}),targetIds:targets.map(seat=>seat.id),targetInstances:Object.fromEntries(targets.map(seat=>[seat.id,seat.active.instanceId])),index:0,damagedIds:[],defenseIds:[],actualDamage:0};
  note(room,`使用${reviewedEvents[selected.eventType].name.zh}。`,`Used ${reviewedEvents[selected.eventType].name.en}.`);
  openDefense(room,ctx);
}
function openEventTarget(room,ctx) {
  const resolution=room.resolution;
  while(resolution.index<resolution.targetIds.length) {
    const owner=trainer(room,resolution.targetIds[resolution.index]),target=owner?.active;
    if(owner&&!owner.eliminated&&target&&!target.defeated&&target.instanceId===resolution.targetInstances[owner.id]&&currentHp(target,ctx.catalogue)>0) {
      resolution.targetCreatureId=target.instanceId;
      delete resolution.incomingDamage;delete resolution.modifierState;delete resolution.receivingEffects;delete resolution.helmetCardId;
      resolution.actualDamage=0;resolution.sourceAfterDone=false;resolution.staticDone=false;
      if(!battleEventTargetAllowed(room,target,resolution.eventName.zh)){resolution.index++;continue;}
      if(room.scenario?.articunoReactions===true&&resolution.protectionCheckedIndex!==resolution.index) {
        resolution.protectionCheckedIndex=resolution.index;
        if(startProtectionWindow(room,ctx,{mode:'cancel-event',targetId:owner.id,targetCreatureId:target.instanceId,eventName:resolution.eventName,eventCardId:resolution.card.id,eventIndex:resolution.index}))return;
      }
      if(resolution.eventType==='zapdos-punishment')return startJudgment(room,ctx,{kind:'zapdos',targetId:target.instanceId},owner.id);
      if(resolution.eventType==='jigglypuff-performance')return startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'sleep',weather:'thunderstorm',comparison:'not',next:'settlement'},owner.id);
      if(resolution.eventType==='mr-mime-trick') {
        const actor=trainer(room,resolution.actorPlayerId);
        if(resolution.eventEffect==='hand') {
          if(!owner.hand.length)return nextSettlement(room,ctx);
          resolution.handChoiceIds=shuffled(owner.hand.map(card=>card.id));
          decision(room,'event-hand',actor.id,owner.id,ctx);room.pendingBattle.eventName=resolution.eventName;return;
        }
        const item=target.item;
        if(!item)return nextSettlement(room,ctx);
        delete target.item;gainBattleCards(room,actor,[item],{reason:'take'});
        note(room,'魔墙人偶的戏法获得持有物并加入手牌。','Mr. Mime’s Trick took the held item into the actor’s hand.');
        if(target.catalogueId==='mankey'&&battleTraitsEffective(room,target)) {
          decision(room,'defiant',owner.id,owner.id,ctx);room.pendingBattle.trait='defiant';room.pendingBattle.canTrait=true;return;
        }
        return nextSettlement(room,ctx);
      }
      decision(room,resolution.eventType==='moltres-trial'?'event-command':resolution.eventType==='mewtwo-threat'?'event-dodge':'mew-blessing',owner.id,owner.id,ctx);
      Object.assign(room.pendingBattle,{eventType:resolution.eventType,eventName:resolution.eventName,targetCreatureId:target.instanceId,...(resolution.externalSource?{damage:2,source:resolution.externalSource}:{choices:['heal',...(target.level<3?['evolve']:[])]})});
      return;
    }
    resolution.index++;
  }
  finishResolution(room,ctx);
}
function settleEventDamage(room,ctx,base=2) {
  const target=creature(room,room.resolution.targetCreatureId);
  const amount=damageImmune(room,target)?0:computeDamage(null,target,base,ctx.catalogue,damageOptions(room,null,target,{command:false,channel:'event',receiving:!hasShedSkin(room,target)}));
  receiveDamage(room,ctx,amount);
}
export function useBattleTool(room,player,input,ctx) {
  const legal=previewActions(room,player,ctx.catalogue);
  requireRule(room.turn?.playerId===player.id&&room.turn.phase==='play'&&legal&&!room.pendingBattle&&!room.pendingVote,'TOOL_UNAVAILABLE','Tools require your unblocked Play phase.');
  const card=player.hand.find(card=>card.id===input.cardId&&card.kind==='tool');
  const choice=legal.tools.find(tool=>tool.toolType===card?.toolType)?.choices.find(choice=>choice.effect===input.effect);
  requireRule(card&&choice&&!choice.unavailableReason,'INVALID_CARD','Choose a reviewed effect of a physical split tool in your own hand.');
  requireRule(choice.targets.some(target=>target.targetId===input.targetId&&target.slot===input.slot),'INVALID_TARGET','Choose a legal target for this tool.');
  const owner=trainer(room,input.targetId);
  player.hand.splice(player.hand.indexOf(card),1);
  let drawn=0;
  if(input.effect==='nugget') {
    // The used card stays outside both piles until the effect and any Pickup
    // finish. An exhausted finite fixture supplies only available real cards.
    drawn=Math.min(2,room.drawPile.length+room.discardPile.length);
    drawBattleCards(room,owner,drawn,'nugget');
  } else {
    const pokemon=owner[input.slot];
    if(input.slot==='reserve')pokemon.revealed=true;
    if(input.effect==='potion')heal(pokemon,2,ctx.catalogue);
    else if(input.effect==='full-heal')pokemon.status=null;
    else pokemon.level++;
  }
  room.discardPile.push(card);
  if(input.effect==='potion')note(room,'伤药回复目标至多2点体力；整张组合道具牌已弃置。','Potion restored up to 2 HP; the entire split tool was discarded.');
  else if(input.effect==='nugget')note(room,`金珠令目标训练家摸了${drawn}张牌；整张组合道具牌已弃置。`,`Nugget let the target trainer draw ${drawn} card${drawn===1?'':'s'}; the entire split tool was discarded.`);
  else note(room,input.effect==='full-heal'?'使用万灵药恢复目标的特殊状态；整张组合道具牌已弃置。':'使用神奇糖果使目标提升一个等级；整张组合道具牌已弃置。',input.effect==='full-heal'?'Full Heal cured the target’s special status; the entire split tool was discarded.':'Rare Candy raised the target by one level; the entire split tool was discarded.');
}
function battleMoves(room,pokemon,catalogue) {
  const native=face(pokemon,catalogue)?.moves||[];
  if(pokemon.catalogueId!=='scyther'||!battleTraitsEffective(room,pokemon))return native;
  return [...native,...catalogue.entries.find(entry=>entry.id==='scyther').levels.filter(level=>level.level<pokemon.level).sort((a,b)=>a.level-b.level).flatMap(level=>level.moves)];
}
export function previewActions(room, player, catalogue) {
  if (room.status !== 'playing' || player.spectator || player.eliminated || !player.active) return null;
  const own = room.turn?.playerId === player.id && room.turn.phase === 'play' && !room.pendingBattle && !room.pendingVote;
  const pokemon = player.active;
  const used = room.turn?.usedMoves || [];
  const move = face(pokemon, catalogue)?.moves?.[0];
  const unlocked = !room.turn.commandCreatureId || room.turn.commandCreatureId === pokemon.instanceId;
  const ignoresReinforcements=pokemon.catalogueId==='dratini' && pokemon.level>=2;
  const targetsFor=ignoreDistance=>eligibleTargetIds(room.players,player.id,{ignoreDistance:ignoreDistance||hasSniper(room,player)||room.turn.rangeCreatureId===pokemon.instanceId||room.turn.swiftSwimCreatureIds?.includes(pokemon.instanceId)||(!ignoresReinforcements&&battleReinforcementEffective(room,pokemon,'speed'))}).filter(id=>face(trainer(room,id).active,catalogue)?.effectStatus==='combat-preview');
  const traitUsed = (room.turn.traitsUsed || []).includes(pokemon.instanceId);
  const teleport=pokemon.catalogueId==='abra' && pokemon.level===1;
  const teleportBlocked=teleport && room.turn.switchBlocked && player.reserve && !player.reserve.defeated;
  const moveAvailable=Boolean(own && face(pokemon,catalogue)?.effectStatus==='combat-preview' && !room.turn.movesBlocked && !(room.turn.blockedMoveIds||[]).includes(pokemon.instanceId));
  const moves=battleMoves(room,pokemon,catalogue).map((item,index)=>{
    const command=item.condition?.kind==='command';
    const charm=item.effectKind==='discard-other-hand',dew=item.effectKind==='life-dew';
    const supported=command||(item.condition?.kind==='weather-card'&&weatherMoveEffects.has(item.effectKind)&&item.condition.weatherIconsInCondition?.length>0);
    const legalTargetIds=own?(teleport||item.targeting?.kind==='self'?[player.id]:targetsFor(item.targeting?.ignoresDistance===true).filter(id=>!charm||(id!==player.id&&trainer(room,id).hand.length>0))):[];
    return {index,name:item.name,condition:item.condition,printedValue:item.printedValue,effectKind:item.effectKind||null,...(charm?{targeting:'trainer'}:{}),cannotDodge:ignoresReinforcements,ignoresReinforcements,maxTargets:dew?live(room).length:item.targeting?.max||1,legalTargetIds,canUse:Boolean(moveAvailable&&supported&&(!charm||legalTargetIds.length)&&(!command||(!teleportBlocked&&unlocked))&&((pokemon.catalogueId==='shellder'&&battleTraitsEffective(room,pokemon))||item.uses?.unlimited===true||!used.includes(`${pokemon.instanceId}:${item.name.zh}`)))};
  });
  const canCommand=Boolean(move?.condition?.kind==='command'&&moves[0]?.canUse);
  const giveRecipientIds = live(room).filter(p=>p.id!==player.id).map(p=>p.id);
  // A virtual command has no printed sunny weather, so it cannot meet paralysis.
  const giveCommandAvailable = canCommand && pokemon.status!=='paralysis';
  const canGive = own && face(pokemon,catalogue)?.effectStatus==='combat-preview' && pokemon.catalogueId==='growlithe' && battleTraitsEffective(room,pokemon) && !room.turn.justifiedUsed && giveRecipientIds.length>0 && (player.hand.length>1 || (player.hand.length===1 && giveCommandAvailable));
  return { events:eventActions(room,player,own), tools:toolActions(room,player,catalogue,own), canEquip:Boolean(own&&player.hand.some(reviewedItem)), equipSlots:own?['active','reserve'].filter(slot=>player[slot]&&!player[slot].defeated):[], moves, canCommand, canGive:Boolean(canGive), giveCommandAvailable, giveRecipientIds:own?giveRecipientIds:[], canSwitch: Boolean(own && !room.turn.switchUsed && !room.turn.switchBlocked && !player.reserve?.defeated), canTrait: Boolean(face(pokemon,catalogue)?.effectStatus==='combat-preview'&&battleTraitsEffective(room,pokemon)&&!room.pendingBattle && !room.pendingVote && !traitUsed && room.turn.playerId === player.id && ((['bulbasaur','magnemite','rhyhorn'].includes(pokemon.catalogueId) && room.turn.phase === 'play') || (pokemon.catalogueId==='psyduck'&&room.turn.phase==='play'&&!room.turn.swiftSwimUsed) || (pokemon.catalogueId==='staryu'&&room.turn.phase==='draw'&&!room.turnStart) || (['electabuzz','porygon'].includes(pokemon.catalogueId)&&room.turn.phase==='draw'&&room.turn.drawRemaining>0&&room.turn.drawStarted===false&&!room.turnStart) || (['squirtle','exeggcute'].includes(pokemon.catalogueId) && room.turn.phase === 'end'))), ...(pokemon.catalogueId==='porygon'?{trait:{kind:'download',name:{zh:'下载',en:'Download'}}}:pokemon.catalogueId==='electabuzz'?{trait:{kind:'vital-spirit',name:{zh:'干劲',en:'Vital Spirit'}}}:pokemon.catalogueId==='staryu'?{trait:{kind:'illuminate',name:{zh:'发光',en:'Illuminate'}}}:pokemon.catalogueId==='rhyhorn'?{trait:{kind:'reckless',name:{zh:'舍身',en:'Reckless'},maxHpLoss:Number.MAX_SAFE_INTEGER-(pokemon.damage||0)}}:pokemon.catalogueId==='magnemite'?{trait:{kind:'analytic',name:{zh:'分析',en:'Analytic'},maxCards:Math.min(player.hand.length,Math.max(0,currentHp(pokemon,catalogue)))}}:pokemon.catalogueId==='exeggcute'?{trait:{kind:'harvest',name:{zh:'收获',en:'Harvest'}}}:{}),legalTargetIds:moves[0]?.legalTargetIds||[], move: move ? { name: move.name, printedValue: move.printedValue, maxTargets:moves[0].maxTargets } : null };
}
export function playBattleMove(room, player, input, ctx) {
  const legal=previewActions(room,player,ctx.catalogue),index=input.moveIndex===undefined?0:input.moveIndex;
  requireRule(Number.isSafeInteger(index)&&index>=0 && legal?.moves?.[index]?.canUse,'MOVE_UNAVAILABLE','This Pokémon cannot use the selected move now.');
  const move=legal.moves[index],command=move.condition.kind==='command';
  requireRule(move.effectKind==='moonlight'?['heal','cure'].includes(input.effectChoice):move.effectKind==='x-scissor'?[undefined,'normal','double-dodge'].includes(input.effectChoice):input.effectChoice===undefined,'INVALID_MOVE_CHOICE','Choose a printed effect of this move only.');
  requireRule(Array.isArray(input.targetIds)&&input.targetIds.length>=1&&input.targetIds.length<=move.maxTargets&&new Set(input.targetIds).size===input.targetIds.length&&input.targetIds.every(id=>move.legalTargetIds.includes(id)),'INVALID_TARGET','Choose legal active Pokémon within range.');
  const selected=player.hand.find(card=>card.id===input.cardId);
  requireRule(selected && (command?selected.kind==='command':move.condition.weatherIconsInCondition.includes(selected.weather)),'INVALID_CARD','Choose one qualifying card from your own hand.');
  requireRule(!command||player.active.status!=='paralysis'||['intense-sun','clear'].includes(selected.weather),'INVALID_CARD','Paralysis permits only sunny-weather command cards.');
  const mayBoost=command&&move.effectKind==='hyper-beam';
  requireRule(mayBoost||input.boostCardId===undefined,'INVALID_CARD','Only Hyper Beam accepts a declaration discard.');
  const boost=input.boostCardId===undefined?null:player.hand.find(card=>card.id===input.boostCardId);
  requireRule(input.boostCardId===undefined||(boost&&boost!==selected),'INVALID_CARD','Choose a different card from your own hand for Hyper Beam.');
  const doubleDodge=move.effectKind==='x-scissor'&&input.effectChoice==='double-dodge';
  requireRule(!doubleDodge||player.active.reinforcements.includes('power'),'INVALID_MOVE_CHOICE','X-Scissor must discard one carried Power marker to require two Dodges.');
  if(doubleDodge)player.active.reinforcements.splice(player.active.reinforcements.indexOf('power'),1);
  if(boost)room.discardPile.push(...player.hand.splice(player.hand.indexOf(boost),1));
  player.hand.splice(player.hand.indexOf(selected),1);
  if(!command)room.discardPile.push(selected);
  beginBattleMove(room,player,input.targetIds,command?selected:null,{...legal,move,damageBoost:boost?1:0,effectChoice:input.effectChoice,dodgesRequired:doubleDodge?2:1},ctx,command);
}
function beginBattleMove(room,player,targetIds,command,legal,ctx,isCommand=true) {
  const source = player.active;
  if(isCommand)room.turn.commandCreatureId = source.instanceId;
  room.turn.usedMoves ??= []; room.turn.usedMoves.push(`${source.instanceId}:${legal.move.name.zh}`);
  room.resolution = { kind: 'move', card: command, virtualCommand:isCommand&&!command, statusMove:!isCommand, moveIndex:legal.move.index??0,effectKind:legal.move.effectKind||null, ignoresReinforcements:source.catalogueId==='dratini'&&source.level>=2, sourceId: source.instanceId, sourcePlayerId: player.id, sourceLevel: source.level, sourceFamily: source.catalogueId, baseDamage: (legal.move.printedValue??0)+(legal.damageBoost||0), powerBoost: isCommand&&!reinforcementsSuppressed(room,source)?beginCommand(source):0, targetIds: [...targetIds], index: 0, damagedIds: [], defenseIds: [] };
  if(legal.effectChoice)room.resolution.effectChoice=legal.effectChoice;
  if(legal.dodgesRequired===2)room.resolution.dodgesRequired=2;
  if(!isCommand)note(room,`弃置一张符合天气的手牌使用${legal.move.name.zh}；目标正在决定响应。`,`One qualifying weather hand card was discarded to use ${legal.move.name.en}; the target is deciding a response.`);
  else note(room, command?'当前玩家使用接招吧！；目标正在决定响应。':'正义之心视为使用接招吧！；目标正在决定响应。', command?'The current trainer used Take this!; the target is deciding a response.':'Justified counted as using Take this!; the target is deciding a response.');
  if(isCommand&&source.catalogueId==='magikarp'&&source.level>=2&&battleTraitsEffective(room,source)) {
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
  note(room,`正义之心向另一名训练家交给了${cards.length}张手牌。`,`Justified gave ${cards.length} hand card(s) to another trainer.`);
  if(all)beginBattleMove(room,player,input.targetIds,null,legal,ctx);
}
function beginRescue(room, targetId, ctx) {
  const index=room.players.findIndex(p=>p.id===room.turn.playerId);
  room.resolution.rescueActors=[...room.players.slice(index),...room.players.slice(0,index)].filter(p=>!p.spectator&&!p.eliminated).map(p=>p.id);
  room.resolution.rescueIndex = 0;
  room.resolution.rescueCreatureId=trainer(room,targetId).active.instanceId;
  room.resolution.rescueActorInstances=Object.fromEntries(room.resolution.rescueActors.map(id=>[id,trainer(room,id).active?.instanceId]));
  note(room, '宝可梦昏厥；从当前回合训练家起依次结算救援。', 'A Pokémon is fainting; rescue starts with the current turn’s trainer.');
  decision(room, 'rescue', room.resolution.rescueActors[0], targetId, ctx);
}
function settleDamage(room, ctx) {
  const resolution = room.resolution;
  const target = creature(room, resolution.targetCreatureId), source = creature(room, resolution.sourceId);
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
    note(room,'守住使此宝可梦保有一枚防御强化指示物。','Protect leaves this Pokémon with one Defense reinforcement.');
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
  if(resolution.effectKind==='double-edge'&&!resolution.doubleEdgeDecided&&!damageImmune(room,target)&&activeOwner(room,source?.instanceId)) {
    decision(room,'double-edge',resolution.sourcePlayerId,trainer(room,resolution.targetIds[resolution.index]).id,ctx);return;
  }
  const printedDamage=resolution.baseDamage+(resolution.doubleEdgeBoost?1:0)+(resolution.effectKind==='reversal'&&currentHp(target,ctx.catalogue)>currentHp(source,ctx.catalogue)?1:0)+(resolution.sourceFamily==='gastly'&&resolution.sourceLevel===3&&target.status?1:0)+(resolution.sourceFamily==='nidoran-m'&&resolution.sourceLevel>=2&&(source.damage||0)===0?1:0);
  const reduction=resolution.dodgeReductions?.[target.instanceId]||0;
  if(reduction>0||hasShedSkin(room,target)||resolution.effectKind==='fury-cutter') {
    const amount=damageImmune(room,target)?0:computeDamage(source,target,printedDamage,ctx.catalogue,damageOptions(room,source,target,{command:true,powerBoost:resolution.powerBoost,reinforcements:!resolution.ignoresReinforcements,receiving:false}));
    if(resolution.effectKind==='fury-cutter'&&amount>0&&activeOwner(room,source.instanceId)) {
      source.reinforcements=source.reinforcements.concat(Array(amount).fill('power'));
      note(room,`连斩在造成伤害时无视上限获得${amount}枚力量强化。`,`Fury Cutter gained ${amount} Power marker(s) at the dealing-damage stage, ignoring the duplicate limit.`);
    }
    resolution.modifierState={targetId:target.instanceId,amount,reduction,remaining:['dodge','defense','multiscale','marvel-scale','shed-skin']};
    return continueDamageModifiers(room,ctx);
  }
  const amount = damageImmune(room,target)?0:computeDamage(source, target, printedDamage, ctx.catalogue, damageOptions(room,source,target,{ command: true, powerBoost: resolution.powerBoost, reinforcements:!resolution.ignoresReinforcements }));
  receiveDamage(room,ctx,amount);
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
  const result = applyDamage(target, amount, ctx.catalogue);
  resolution.actualDamage = amount;
  if (amount > 0) resolution.damagedIds.push(target.instanceId);
  if (amount > 0 && resolution.kind!=='turn-start' && battleReinforcementEffective(room,target, 'defense')) resolution.defenseIds.push(target.instanceId);
  const labels=resolution.kind==='item'?['凸凸头盔','Rocky Helmet']:resolution.kind==='turn-start'?['特殊状态','The special status']:resolution.kind==='event'?[resolution.externalSource?.name.zh||'事件',resolution.externalSource?.name.en||'The event']:['招式','The move'];
  note(room, `${labels[0]}造成${amount}点伤害。`, `${labels[1]} dealt ${amount} damage.`);
  if (result.fainting) beginRescue(room, room.players.find(p=>p.active?.instanceId===target.instanceId).id, ctx);
  else afterDamage(room, ctx);
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
  // Booklet p.11: after-dealing effects precede after-receiving effects.
  if(!resolution.sourceAfterDone) {
    resolution.sourceAfterDone=true;
    if(resolution.kind==='move' && source && !source.defeated) {
      if(resolution.sourceFamily==='bulbasaur') {heal(source,1,ctx.catalogue);if(resolution.sourceLevel===3)drawBattleCards(room,trainer(room,resolution.sourcePlayerId));}
      if(resolution.sourceFamily==='exeggcute'&&resolution.sourceLevel===1)heal(source,1,ctx.catalogue);
      const family=resolution.sourceFamily,level=resolution.sourceLevel;
      if(resolution.effectKind==='rainy-flinch')return startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'flinch',weathers:['rain','thunderstorm'],next:'afterDamage'},resolution.sourcePlayerId);
      if(resolution.effectKind==='sunny-paralysis')return startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'paralysis',weathers:['intense-sun','clear'],next:'afterDamage'},resolution.sourcePlayerId);
      if(['remove-speed-after-damage','freeze-dry'].includes(resolution.effectKind)&&activeOwner(room,target.instanceId))target.reinforcements=resolution.effectKind==='freeze-dry'?[]:target.reinforcements.filter(marker=>marker!=='speed');
      if(family==='porygon'&&resolution.effectKind==='tri-attack')return startJudgment(room,ctx,{kind:'tri-attack',targetId:target.instanceId},resolution.sourcePlayerId);
      if(resolution.effectKind==='pay-day') {
        decision(room,'pay-day',resolution.sourcePlayerId,resolution.sourcePlayerId,ctx);Object.assign(room.pendingBattle,{trait:'pay-day',canTrait:true});return;
      }
      if(resolution.effectKind==='flinch-after-damage'&&resolution.sourceFamily!=='magikarp')return applyStatus(room,ctx,target,'flinch','afterDamage');
      if(((family==='psyduck'&&level<=2)||(family==='diglett'&&level>=2)||resolution.effectKind==='reinforcement-after-damage')&&activeOwner(room,target.instanceId)) {
        const markers=[...new Set(target.reinforcements||[])];
        if(markers.length) {
          resolution.markerTargetId=target.instanceId;decision(room,'reinforcement',resolution.sourcePlayerId,activeOwner(room,target.instanceId).id,ctx);
          Object.assign(room.pendingBattle,{reinforcements:markers,timing:'after-damage'});return;
        }
      }
      if(family==='shellder' && level===2 && trainer(room,resolution.sourcePlayerId).hand.length) {
        decision(room,'cycle',resolution.sourcePlayerId,resolution.sourcePlayerId,ctx);return;
      }
      if(family==='shellder' && level===3)return startJudgment(room,ctx,{kind:'icicle-spear',ownerId:resolution.sourcePlayerId},resolution.sourcePlayerId);
      if(resolution.effectKind==='paralysis-judgment'&&['electabuzz','tauros','porygon'].includes(family))return startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'paralysis',weathers:family==='tauros'?['intense-sun','clear']:['thunderstorm'],next:'afterDamage'},resolution.sourcePlayerId);
      const statusJudgment=(family==='charmander'||family==='vulpix'||(family==='growlithe'&&level>=2))?['burn','intense-sun']:['pikachu','magnemite'].includes(family)?['paralysis','thunderstorm']:family==='gastly'&&level===1?['paralysis','rain']:family==='abra'&&level>=2?['confusion','intense-sun']:family==='psyduck'&&level===3?['confusion','rain']:(family==='slowpoke'&&level===2)||(family==='pidgey'&&level===3)||(family==='magikarp'&&level===2)?['flinch','thunderstorm']:family==='sandshrew'&&level===1||family==='grimer'&&level>=2||family==='weedle'&&level<=2?['poison','rain']:null;
      if(statusJudgment)return startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:statusJudgment[0],weather:statusJudgment[1],...((['grimer','psyduck'].includes(family)&&level===3)||(family==='gastly'&&level===1)?{weathers:['rain','thunderstorm']}:{}),next:'afterDamage'},resolution.sourcePlayerId);
      if(family==='gastly'&&level===2) {
        const targetOwner=activeOwner(room,target.instanceId);
        return startJudgment(room,ctx,{kind:'shadow-ball',targetOwnerId:targetOwner?.id,sourcePlayerId:resolution.sourcePlayerId},resolution.sourcePlayerId);
      }
      if((family==='exeggcute'&&level===3)||(family==='staryu'&&level>=2))return startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'confusion',weather:'intense-sun',next:'afterDamage'},resolution.sourcePlayerId);
      if(family==='koffing'&&level>=2)return startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'poison',weather:'rain',next:'afterDamage'},resolution.sourcePlayerId);
      if(resolution.sourceFamily==='machop' && resolution.sourceLevel===3)return applyStatus(room,ctx,target,'confusion','afterDamage');
      if(resolution.sourceFamily==='sandshrew') {
        if(resolution.sourceLevel>=2) {
          const targetPlayer=trainer(room,resolution.targetIds[resolution.index]);
          if(targetPlayer.hand.length) {
            resolution.handChoiceIds=shuffled(targetPlayer.hand.map(card=>card.id));
            decision(room,'hand',resolution.sourcePlayerId,targetPlayer.id,ctx);
            Object.assign(room.pendingBattle,{effect:resolution.sourceLevel===2?'discard':'take',choiceCount:targetPlayer.hand.length});
            return;
          }
        }
      }
    }
  }
  if(!resolution.staticDone) {
    resolution.staticDone=true;resolution.receivingEffects=[];
    const targetOwner=room.players.find(p=>p.active?.instanceId===target?.instanceId&&!p.eliminated),sourceOwner=source?activeOwner(room,source.instanceId):null;
    if(targetOwner&&!target.defeated) {
      const traits=battleTraitsEffective(room,target);
      if(traits&&target.catalogueId==='cubone'&&targetOwner.hand.length)resolution.receivingEffects.push('battle-armor');
      if(traits&&target.catalogueId==='lapras')resolution.receivingEffects.push('water-absorb');
      if(traits&&target.catalogueId==='pikachu'&&sourceOwner&&!source.defeated)resolution.receivingEffects.push('static');
      if(traits&&target.catalogueId==='nidoran-m'&&sourceOwner&&!source.defeated)resolution.receivingEffects.push('poison-point');
      if(traits&&target.catalogueId==='abra'&&resolution.card&&['command','event'].includes(resolution.card.kind)&&!resolution.cardClaimedBy)resolution.receivingEffects.push('synchronize');
      if(traits&&target.catalogueId==='slowpoke'&&room.turn.playerId!==targetOwner.id)resolution.receivingEffects.push('oblivious');
      if(traits&&target.catalogueId==='gastly'&&target.level===3&&sourceOwner?.hand.length&&sourceOwner.id!==targetOwner.id)resolution.receivingEffects.push('cursed-body');
      if(helmetEffective(room,target)&&sourceOwner&&!source.defeated){resolution.receivingEffects.push('rocky-helmet');resolution.helmetCardId=target.item.id;}
    }
  }
  continueReceiving(room,ctx);
}
function nextSettlement(room, ctx) {
  room.pendingBattle = null;
  if (['turn-start','item'].includes(room.resolution.kind)) return finishResolution(room, ctx);
  const resolution=room.resolution;
  if(resolution.effectKind==='double-edge'&&resolution.doubleEdgeBoost&&resolution.actualDamage>0&&!resolution.recoilDone) {
    resolution.recoilDone=true;
    const owner=activeOwner(room,resolution.sourceId),source=creature(room,resolution.sourceId);
    if(owner&&currentHp(source,ctx.catalogue)>0) {
      room.resolutionStack??=[];room.resolutionStack.push(resolution);
      room.resolution={kind:'hp-loss',card:null,sourceId:null,sourcePlayerId:owner.id,targetCreatureId:source.instanceId,targetIds:[owner.id],index:0,damagedIds:[],defenseIds:[],actualDamage:0};
      source.damage=(source.damage||0)+1;
      note(room,'舍身冲撞的伤害结算结束，原伤害来源失去1点体力；这不是伤害。','After Double-Edge’s damage settlement, the original damage source lost 1 HP; this is not damage.');
      if(currentHp(source,ctx.catalogue)<=0)return beginRescue(room,owner.id,ctx);
      return afterDamage(room,ctx);
    }
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
  pokemon.defeated = true; pokemon.status = null; pokemon.reinforcements = []; if(pokemon.item)room.discardPile.push(pokemon.item);delete pokemon.item;
  const source = creature(room, resolution.sourceId);
  if (source && source.instanceId !== pokemon.instanceId) {
    if(room.drawPile.length+room.discardPile.length)drawBattleCards(room,trainer(room,resolution.sourcePlayerId));
    else note(room,'击倒奖励没有当前可摸取的牌；结算继续。','No card is currently available for the defeat reward; resolution continues.');
  }
  const deployed=Boolean(player.reserve&&!player.reserve.defeated);
  if (deployed) {
    const reserve = player.reserve; reserve.revealed = true; pokemon.revealed = true;
    player.active = reserve; player.reserve = pokemon;
    note(room, '备战宝可梦强制登场；不消耗普通交替。', 'The reserve was deployed; this does not consume ordinary switching.');
  } else {
    player.eliminated = true; room.discardPile.push(...player.hand); player.hand = [];
    note(room, '一名训练家退场并公开身份。', 'A trainer was eliminated and revealed their identity.');
  }
  const result = evaluateVictory(room.players);
  if (result) {
    for(const pending of [room.resolution,...(room.resolutionStack||[])])cleanResolution(room,pending);room.resolution=null;room.pendingBattle=null;delete room.resolutionStack;delete room.judgment;delete room.statusEvent;delete room.protectionWindow;delete room.turnStart;delete room.switchEvent;delete room.entryEvent;delete room.drawChoice;delete room.initialBattleEntries; room.result = { ...result, completedAt: ctx.now(), developmentFixture: true };
    room.status = 'finished'; room.turn = null;
    note(room, '胜利条件已达成，所有身份与剩余手牌公开。', 'A victory condition was met; all identities and remaining hands are revealed.');
    return;
  }
  if(deployed)return beginBattleEntries(room,[player],ctx,{kind:'damage'});
  afterDamage(room, ctx);
}
export function respondBattle(room,player,input,ctx) {
  const pending=room.pendingBattle;
  requireRule(pending && input.decisionId===pending.id,'STALE_DECISION','Refresh the pending decision.');
  requireRule(pending.actorId===player.id && !player.spectator && !player.eliminated,'NOT_YOUR_DECISION','This response belongs to another trainer.');
  requireRule(pending.kind==='distribute'||input.allocations===undefined,'INVALID_RESPONSE','This decision does not distribute cards.');
  requireRule(pending.kind==='exile'||input.handIndices===undefined,'INVALID_RESPONSE','This decision does not select multiple hand slots.');
  requireRule(['shed-skin','sweet-kiss'].includes(pending.kind)||input.cardIds===undefined,'INVALID_RESPONSE','This decision does not select hand cards.');
  requireRule(['cute-charm','neutralizing-gas','intimidate'].includes(pending.kind)||input.targetId===undefined,'INVALID_RESPONSE','This decision does not choose a target.');
  requireRule(pending.kind==='forewarn-order'||(input.topOrder===undefined&&input.bottomOrder===undefined),'INVALID_RESPONSE','Only Forewarn chooses the deck top and bottom.');
  requireRule(pending.kind==='download'||input.targetIds===undefined,'INVALID_RESPONSE','Only Download chooses multiple trainers.');
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
    if(window.mode==='cure-status')target.status=null;
    room.discardPile.push(card);
    note(room,window.mode==='cancel-event'?'急冻鸟的庇护抵消了事件对此目标的效果。':'急冻鸟的庇护恢复了目标刚获得的特殊状态。',window.mode==='cancel-event'?'Articuno’s Protection canceled the event for this target.':'Articuno’s Protection cured the target’s newly applied status.');
    return finishProtectionWindow(room,ctx,true);
  }
  if(pending.kind==='event-hand') {
    requireRule(Object.keys(input).every(key=>['id','revision','type','decisionId','choice','handIndex'].includes(key))&&input.choice==='card'&&Number.isSafeInteger(input.handIndex),'INVALID_RESPONSE','Choose one hidden hand-card slot.');
    const resolution=room.resolution,owner=trainer(room,pending.targetId),target=owner?.active;
    requireRule(resolution?.kind==='event'&&resolution.eventType==='mr-mime-trick'&&resolution.eventEffect==='hand'&&resolution.actorPlayerId===player.id&&player.active?.instanceId===resolution.actorCreatureId&&owner&&!owner.eliminated&&target&&!target.defeated&&target.instanceId===resolution.targetInstances[owner.id],'STALE_DECISION','The event participants changed.');
    const ids=resolution.handChoiceIds||[];
    requireRule(input.handIndex>=0&&input.handIndex<ids.length,'INVALID_RESPONSE','Choose an available hidden slot.');
    const index=owner.hand.findIndex(card=>card.id===ids[input.handIndex]);
    requireRule(index>=0,'STALE_DECISION','The selected hand card changed.');
    gainBattleCards(room,player,owner.hand.splice(index,1),{reason:'take'});delete resolution.handChoiceIds;
    note(room,'魔墙人偶的戏法获得目标训练家的一张手牌。','Mr. Mime’s Trick took one card from the target trainer’s hand.');
    return nextSettlement(room,ctx);
  }
  if(['event-dodge','event-command','mew-blessing'].includes(pending.kind)) {
    const resolution=room.resolution,target=player.active;
    requireRule(resolution?.kind==='event'&&resolution.targetIds[resolution.index]===player.id&&target&&!target.defeated&&currentHp(target,ctx.catalogue)>0&&target.instanceId===resolution.targetInstances[player.id]&&target.instanceId===pending.targetCreatureId,'STALE_DECISION','The event target changed.');
    requireRule(Object.keys(input).every(key=>['id','revision','type','decisionId','choice',...(['event-dodge','event-command'].includes(pending.kind)?['cardId']:[])].includes(key)),'INVALID_RESPONSE','This event does not accept extra response fields.');
    if(pending.kind==='mew-blessing') {
      requireRule(['heal','evolve'].includes(input.choice)&&(input.choice!=='evolve'||target.level<3),'INVALID_RESPONSE','Choose healing or an available level increase.');
      if(input.choice==='heal')heal(target,2,ctx.catalogue);else target.level++;
      note(room,input.choice==='heal'?'梦幻的祝福回复目标至多2点体力。':'梦幻的祝福令目标升1级。',input.choice==='heal'?"Mew’s Blessing restored up to 2 HP.":"Mew’s Blessing raised the target by one level.");
      return nextSettlement(room,ctx);
    }
    const responseKind=pending.kind==='event-command'?'command':'dodge';
    requireRule(['pass',responseKind].includes(input.choice)&&(input.choice!=='pass'||input.cardId===undefined),'INVALID_RESPONSE','Play the required actual card response, or pass without a card.');
    if(input.choice===responseKind) {
      const index=player.hand.findIndex(card=>card.id===input.cardId&&card.kind===responseKind);
      requireRule(typeof input.cardId==='string'&&index>=0,'INVALID_CARD','Choose an actual required response card from your hand.');
      room.discardPile.push(...player.hand.splice(index,1));
      note(room,responseKind==='command'?'打出接招吧！抵消火焰鸟对此目标的伤害。':'打出快躲开！抵消超梦对此目标的伤害。',responseKind==='command'?'A played command response canceled Moltres’s damage to this target.':'A played Dodge response canceled Mewtwo’s damage to this target.');
      return nextSettlement(room,ctx);
    }
    room.pendingBattle=null;return settleEventDamage(room,ctx);
  }
  if(pending.kind==='rescue') {
    requireRule(Object.keys(input).every(key=>['id','revision','type','decisionId','choice','cardId'].includes(key))&&['pass','potion','healer'].includes(input.choice)&&(input.choice!=='pass'||input.cardId===undefined),'INVALID_RESPONSE','Use one Potion or Healer card, or pass without extra fields.');
    const resolution=room.resolution,owner=trainer(room,pending.targetId),target=owner?.active;
    requireRule(resolution&&resolution.rescueActors?.[resolution.rescueIndex]===player.id&&target&&!target.defeated&&target.instanceId===(resolution.rescueCreatureId??resolution.targetCreatureId)&&currentHp(target,ctx.catalogue)<=0&&(!resolution.rescueActorInstances||resolution.rescueActorInstances[player.id]===player.active?.instanceId),'STALE_DECISION','The fainting Pokémon or rescue actor changed.');
    if(input.choice==='pass') {
      resolution.rescueIndex++;
      if(resolution.rescueIndex<resolution.rescueActors.length)decision(room,'rescue',resolution.rescueActors[resolution.rescueIndex],pending.targetId,ctx);
      else {room.pendingBattle=null;defeat(room,pending.targetId,ctx);}
      return;
    }
    requireRule(!rescueOwnerOnly(room)||player.id===pending.targetId,'POTION_RESTRICTED','Only the fainting Pokémon’s trainer may use Potion during this move.');
    const index=player.hand.findIndex(card=>card.id===input.cardId),card=player.hand[index];
    requireRule(typeof input.cardId==='string'&&index>=0&&(input.choice==='potion'?isPotionCard(card):hasHealer(room,player)&&['intense-sun','clear'].includes(card.weather)),'INVALID_CARD','Choose an actual Potion pair, or one sunny own hand card with active Healer.');
    player.hand.splice(index,1);room.discardPile.push(card);
    const result=heal(target,2,ctx.catalogue);
    note(room,input.choice==='healer'?'治愈之心将一张晴天手牌当伤药，昏厥目标回复2点体力。':'伤药令昏厥目标回复2点体力；整张组合道具牌已弃置。',input.choice==='healer'?'Healer used one sunny hand card as Potion; the fainting target restored 2 HP.':'Potion restored 2 HP to the fainting target; the entire split card was discarded.');
    if(result.hp>=1) {
      room.pendingBattle=null;delete resolution.rescueActors;delete resolution.rescueIndex;delete resolution.rescueCreatureId;delete resolution.rescueActorInstances;
      note(room,'救援成功；立即继续原结算。','Rescue succeeded; the original settlement resumes immediately.');
      return afterDamage(room,ctx);
    }
    // Same trainer may use any number of actual cards before passing. Each use
    // creates a fresh saved decision, so stale responses cannot heal twice.
    decision(room,'rescue',player.id,pending.targetId,ctx);return;
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
    if(!source.hand.length)return finishPressureChoice(room,ctx,true);
    decision(room,'pressure-payment',source.id,target.id,ctx);return;
  }
  if(['download','download-hand'].includes(pending.kind)) {
    const choice=room.drawChoice;
    requireRule(choice?.kind==='download'&&choice.playerId===player.id&&choice.pokemonId===player.active.instanceId&&room.turn.playerId===player.id&&room.turn.phase==='draw'&&player.active.catalogueId==='porygon'&&battleTraitsEffective(room,player.active),'STALE_DECISION','The Download actor changed.');
    requireRule(input.cardId===undefined&&input.order===undefined&&input.reinforcement===undefined&&input.effect===undefined,'INVALID_RESPONSE','Use the Download controls only.');
    if(pending.kind==='download') {
      const ids=input.targetIds;
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
        if(room.drawPile.length<4&&room.discardPile.length){room.drawPile=[...shuffled(room.discardPile),...room.drawPile];room.discardPile=[];}
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
        if(!player.active.reinforcements.includes('defense'))player.active.reinforcements.push('defense');
        // The booklet removes even a newly gained Defense at this damaging card's end.
        if(resolution.kind!=='turn-start')resolution.defenseIds.push(player.active.instanceId);
        note(room,'战斗盔甲弃置一张手牌，获得一枚防御强化（不叠加）。','Battle Armor discarded one card and gained one Defense reinforcement, without stacking.');
      }else if(kind==='bonemerang') {
        resolution.settlementCount=2;
        note(room,'骨头回力镖弃置一张手牌，将再结算一次。','Bonemerang discarded one card and will settle once more.');
      }else {
        if(!room.turn.suppressedTraitPlayerIds.includes(input.targetId))room.turn.suppressedTraitPlayerIds.push(input.targetId);
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
  requireRule(input.effect===undefined,'INVALID_RESPONSE','This decision does not choose an effect.');
  if(pending.kind==='pay-day') {
    requireRule(['trait','pass'].includes(input.choice)&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined,'INVALID_RESPONSE','Inspect Pay Day cards or pass.');
    if(input.choice==='trait') {
      if(room.drawPile.length<2&&room.discardPile.length){room.drawPile=[...shuffled(room.discardPile),...room.drawPile];room.discardPile=[];}
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
      note(room,'咒术之躯获得了伤害来源训练家的一张手牌。','Cursed Body took one hand card from the damage source’s trainer.');
    }else requireRule(input.handIndex===undefined,'INVALID_RESPONSE','Passing does not choose a hand-card slot.');
    delete room.resolution.handChoiceIds;room.pendingBattle=null;afterDamage(room,ctx);return;
  }
  if(pending.kind==='scales') {
    requireRule(['trait','pass'].includes(input.choice)&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined,'INVALID_RESPONSE','Use Marvel Scale or pass.');
    const resolution=room.resolution;
    requireRule(player.active.instanceId===resolution.targetCreatureId&&player.active.catalogueId==='dratini'&&battleTraitsEffective(room,player.active)&&player.active.level<=2&&player.active.status&&!player.active.defeated&&resolution.incomingDamage>1,'STALE_DECISION','The incoming damage changed.');
    const amount=resolution.incomingDamage-(input.choice==='trait'?1:0);
    room.pendingBattle=null;
    if(resolution.modifierState){resolution.modifierState.amount=amount;delete resolution.incomingDamage;continueDamageModifiers(room,ctx);}else commitDamage(room,ctx,amount);
    return;
  }
  if(pending.kind==='defiant') {
    if(room.resolution?.kind==='event') {
      const resolution=room.resolution;
      requireRule(Object.keys(input).every(key=>['id','revision','type','decisionId','choice'].includes(key)),'INVALID_RESPONSE','Defiant accepts only use or pass.');
      requireRule(resolution.eventType==='mr-mime-trick'&&resolution.eventEffect==='item'&&player.active?.instanceId===resolution.targetInstances[player.id]&&!player.active.defeated&&player.active.catalogueId==='mankey'&&(input.choice!=='trait'||battleTraitsEffective(room,player.active)),'STALE_DECISION','The item-loss recipient changed.');
    }
    requireRule(['trait','pass'].includes(input.choice)&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined,'INVALID_RESPONSE','Use Defiant or pass.');
    if(input.choice==='trait'){drawBattleCards(room,player,2);room.turn.noHandLimitIds??=[];if(!room.turn.noHandLimitIds.includes(player.id))room.turn.noHandLimitIds.push(player.id);note(room,'不服输摸两张牌，本回合没有手牌上限。','Defiant drew two cards and removed this trainer’s hand limit for the current turn.');}
    room.pendingBattle=null;
    if(room.resolution?.kind==='event'&&room.resolution.eventType==='mr-mime-trick')return nextSettlement(room,ctx);
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
      note(room,'日照替换判定牌，并获得刚被替换的牌。','Drought replaced the judgment and obtained the displaced card.');
    }else requireRule(input.cardId===undefined,'INVALID_RESPONSE','Passing does not submit a card.');
    judgment.index++;room.pendingBattle=null;advanceJudgment(room,ctx);return;
  }
  if(pending.kind==='reinforcement') {
    requireRule(input.choice==='reinforcement' && input.cardId===undefined && input.handIndex===undefined && input.order===undefined && pending.reinforcements.includes(input.reinforcement),'INVALID_RESPONSE','Choose one target reinforcement marker.');
    const target=trainer(room,pending.targetId)?.active;
    requireRule(target?.instanceId===room.resolution.markerTargetId && target.reinforcements.includes(input.reinforcement),'STALE_DECISION','The target reinforcement changed.');
    target.reinforcements.splice(target.reinforcements.indexOf(input.reinforcement),1);
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
      if(room.drawPile.length<3 && room.discardPile.length) {
        room.drawPile=[...shuffled(room.discardPile),...room.drawPile];room.discardPile=[];
      }
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
      note(room,'同步获得了造成此次伤害的牌。','Synchronize obtained the card that caused this damage.');
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
    requireRule(['pass','dodge','trait'].includes(input.choice),'INVALID_RESPONSE','Choose a defense or pass.');
    if(input.choice==='trait') {
      requireRule(pending.canTrait && !pending.traitAttempted && canSandVeil(room,player),'TRAIT_UNAVAILABLE','Sand Veil is unavailable for this settlement.');
      pending.traitAttempted=true;pending.canTrait=false;
      const defense=structuredClone(pending);
      if(defense.clock){if(defense.clock.deadlineAt!==null)defense.clock.remainingMs=Math.max(0,defense.clock.deadlineAt-ctx.now());defense.clock.deadlineAt=null;}
      startJudgment(room,ctx,{kind:'sand-veil',defense},player.id);
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
      if(pending.dodgeReducesDamage) {
        pending.damageReduction=reduceMoveDamage(room,room.resolution.targetCreatureId);
        note(room,'锐利目光将快躲开！改为此招式对该宝可梦的伤害减1，持续到整个招式结束。','Keen Eye changed Dodge! into one damage reduction for this Pokémon until the whole move ends.');return;
      }
      if(pending.dodgesRequired===2&&++pending.dodgesPlayed<2){note(room,'十字剪已收到一次躲闪，仍需要另一次才能抵消。','X-Scissor received one Dodge; another is required to cancel this settlement.');return;}
      note(room,'快躲开！抵消了本次结算。','Dodge! canceled this settlement.');nextSettlement(room,ctx);
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
    room.turn.traitsUsed??=[];room.turn.traitsUsed.push(player.active.instanceId);
    const selected=new Set(ids),cards=player.hand.filter(card=>selected.has(card.id));
    player.hand=player.hand.filter(card=>!selected.has(card.id));room.discardPile.push(...cards);
    drawBattleCards(room,player,cards.length,'analytic');
    note(room,`分析弃置${cards.length}张手牌，然后摸取等量的牌。`,`Analytic discarded ${cards.length} hand card(s), then drew the same number.`);return;
  }
  requireRule(input.cardIds===undefined,'INVALID_INPUT','This trait does not choose hand cards.');
  room.turn.traitsUsed ??= []; room.turn.traitsUsed.push(player.active.instanceId);
  if(player.active.catalogueId==='porygon') {
    room.turn.drawStarted=true;
    room.drawChoice={kind:'download',playerId:player.id,pokemonId:player.active.instanceId};
    const targets=live(room).filter(target=>target.id!==player.id&&target.hand.length).map(target=>target.id);
    decision(room,'download',player.id,player.id,ctx);Object.assign(room.pendingBattle,{legalTargetIds:targets,maxTargets:Math.min(2,targets.length)});return;
  }
  if(player.active.catalogueId==='electabuzz') {
    room.turn.drawStarted=true;
    if(room.drawPile.length<3&&room.discardPile.length){room.drawPile=[...shuffled(room.discardPile),...room.drawPile];room.discardPile=[];}
    const ids=room.drawPile.slice(-3).reverse().map(card=>card.id);
    if(!ids.length){room.turn.drawRemaining=0;room.turn.phase='play';return;}
    room.drawChoice={playerId:player.id,pokemonId:player.active.instanceId,cardIds:ids};
    decision(room,'vital-spirit',player.id,player.id,ctx);room.pendingBattle.requiredCards=Math.min(2,ids.length);return;
  }
  if(player.active.catalogueId==='staryu') {
    if(room.drawPile.length+room.discardPile.length)drawBattleCards(room,player,1,'illuminate');
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
  if(room.initialBattleEntries) {
    const players=room.initialBattleEntries.map(id=>trainer(room,id));delete room.initialBattleEntries;
    return beginBattleEntries(room,players,ctx,{kind:'turn',playerId:player.id});
  }
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
  const remaining=[...(player.exiledCards?.length?['return-cards']:[]),...(['flinch','sleep','confusion','poison'].includes(player.active.status)?['status']:[]),...(player.active.catalogueId==='koffing'?['neutralizing-gas']:[])];
  const index=room.players.findIndex(p=>p.id===player.id),actors=[player,...[...room.players.slice(index+1),...room.players.slice(0,index)].filter(p=>!p.spectator&&!p.eliminated&&p.active?.catalogueId==='koffing'&&!p.active.defeated)];
  if(remaining.length||actors.length>1||player.active.catalogueId==='jynx'){room.turnStart={playerId:player.id,pokemonId:player.active.instanceId,remaining,actorIds:actors.map(p=>p.id),actorInstances:Object.fromEntries(actors.map(p=>[p.id,p.active.instanceId])),index:0};continueTurnStart(room,ctx);}
}
function returnExiledCards(room,player) {
  const cards=player.exiledCards||[];player.exiledCards=[];
  gainBattleCards(room,player,cards,{reason:'return'});
  if(player.eliminated){room.discardPile.push(...player.hand);player.hand=[];}
  note(room,`${cards.length}张移出游戏的牌返回该训练家的手牌。`,`${cards.length} removed card(s) returned to that trainer’s hand.`);
}
function continueTurnStart(room,ctx) {
  const start=room.turnStart;if(!start)return;
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
    const damage = status === 'confusion' ? computeDamage(pokemon, pokemon, 1, ctx.catalogue, damageOptions(room,pokemon,pokemon,{ command: false,receiving:!hasShedSkin(room,pokemon) })) : 1;
    room.resolution = { kind: 'turn-start', targetCreatureId: pokemon.instanceId, sourceId: status === 'confusion' ? pokemon.instanceId : null, sourcePlayerId: status === 'confusion' ? player.id : null, damagedIds: [], defenseIds: [], actualDamage: 0 };
    if(status==='poison')return startPoisonTouch(room,ctx,{kind:'poison',targetId:pokemon.instanceId,damage:1});
    receiveDamage(room,ctx,damage);
    return;
  }
  continueTurnStart(room,ctx);
}
export function publicBattlePokemon(pokemon, catalogue, room) {
  if (!pokemon) return null;
  return { catalogueId: pokemon.catalogueId, level: pokemon.level, hp: currentHp(pokemon, catalogue), maxHp: maxHp(pokemon, catalogue), status: pokemon.status, damageProtected:Boolean(room&&damageImmune(room,pokemon)),traitsSuppressed:!pokemon.defeated&&!battleTraitsEffective(room,pokemon),reinforcementsSuppressed:Boolean(room&&reinforcementsSuppressed(room,pokemon)), ...(pokemon.item?{item:publicItem(pokemon.item),itemSuppressed:!itemEffective(room,pokemon),...(gluttonyReplacesItem(room,pokemon)?{itemEffectReplacement:'gluttony'}:{})}:{}), defeated: Boolean(pokemon.defeated), reinforcements: [...(pokemon.reinforcements || [])] };
}
