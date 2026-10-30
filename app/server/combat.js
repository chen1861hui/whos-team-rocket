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
  delete room.judgment;delete room.resolutionStack;delete room.statusEvent;delete room.turnStart;delete room.switchEvent;
  room.gameMode = 'combat-preview'; room.result = null; room.pendingBattle = null; room.resolution = null; room.status = 'identity';
  room.scenario = { name: 'reviewed-roster', developmentFixture: true, candidateCount: 5, pokemonPoolCount: battleSelectionIds(catalogue).length, cardsPerSeat: 12, commandPerSeat: 6, dodgePerSeat: 6, potionSupported: false };
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
  if(reason==='setup'||!room.turn||room.status!=='playing'||ownDraw||player.spectator||player.eliminated||!pokemon||pokemon.defeated||pokemon.catalogueId!=='meowth'||pokemon.level>=3)return;
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
  const card=topCard(room),seats=live(room),start=seats.findIndex(p=>p.id===room.turn.playerId);
  const ordered=[...seats.slice(start),...seats.slice(0,start)].filter(p=>p.active?.catalogueId==='vulpix'&&!p.active.defeated);
  room.judgment={card,actorIds:ordered.map(p=>p.id),actorInstances:Object.fromEntries(ordered.map(p=>[p.id,p.active.instanceId])),index:0,continuation,judgeId};
  const names={'intense-sun':['烈日','intense sun'],clear:['晴朗','clear'],rain:['暴雨','heavy rain'],thunderstorm:['雷雨','thunderstorm']}[card.weather];
  note(room,`判定展示一张牌，天气为${names[0]}；判定结果等待生效。`,`A judgment revealed ${names[1]}; its result is pending.`);
  advanceJudgment(room,ctx);
}
function advanceJudgment(room,ctx) {
  const judgment=room.judgment;
  while(judgment.index<judgment.actorIds.length) {
    const actor=trainer(room,judgment.actorIds[judgment.index]);
    if(actor && !actor.eliminated && !actor.active.defeated && actor.active.catalogueId==='vulpix' && actor.active.instanceId===judgment.actorInstances[actor.id]) {
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
        note(room,'沙隐视为使用一张快躲开！并抵消本次结算。','Sand Veil counted as one Dodge! and canceled this settlement.');
        return nextSettlement(room,ctx);
      }
      next.defense.damageReduction=reduceMoveDamage(room,room.resolution.targetCreatureId);
      note(room,'沙隐视为使用一张快躲开！，锐利目光将其改为此招式伤害减1。','Sand Veil counted as one Dodge!; Keen Eye changed it to one damage reduction for this move.');
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
      if(next.family==='bulbasaur' && ['intense-sun','clear'].includes(weather))room.turn.rangeCreatureId=next.sourceId;
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
  return reviewedItem(pokemon?.item)&&![room.resolution,...(room.resolutionStack||[])].some(resolution=>resolution?.suppressedItemIds?.includes(pokemon.instanceId));
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
  if(old && input.slot==='active' && pokemon.catalogueId==='mankey') {
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
  const owner=room.players.find(p=>p.active?.instanceId===target?.instanceId&&!p.eliminated),sourceOwner=room.players.find(p=>p.active?.instanceId===source?.instanceId&&!p.eliminated);
  if(!owner||target.defeated)return continueReceiving(room,ctx);
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
  if(effect==='rocky-helmet' && sourceOwner && !source.defeated && itemEffective(room,target) && target.item.id===resolution.helmetCardId) {
    room.resolutionStack??=[];room.resolutionStack.push(resolution);
    room.resolution={kind:'item',card:null,channelCard:target.item,sourceId:target.instanceId,sourcePlayerId:owner.id,targetCreatureId:source.instanceId,targetIds:[sourceOwner.id],index:0,damagedIds:[],defenseIds:[],actualDamage:0};
    const amount=room.turn.damageImmunityIds?.includes(source.instanceId)?0:computeDamage(target,source,1,ctx.catalogue,{command:false,channel:'item',receiving:!hasShedSkin(source)});
    receiveDamage(room,ctx,amount);
    return;
  }
  continueReceiving(room,ctx);
}
function cleanResolution(room,resolution) {
  if(resolution.card&&!resolution.cardClaimedBy)room.discardPile.push(resolution.card);
  if(resolution.revealedCards?.length){room.discardPile.push(...resolution.revealedCards);delete resolution.revealedCards;}
  if(resolution.distributionCards?.length){room.drawPile.push(...[...resolution.distributionCards].reverse());delete resolution.distributionCards;}
  for(const id of new Set(resolution.defenseIds||[])) {
    const pokemon=creature(room,id);if(pokemon)pokemon.reinforcements=(pokemon.reinforcements||[]).filter(kind=>kind!=='defense');
  }
}

function canSandVeil(player) {
  return Boolean(player?.active && !player.active.defeated && player.active.catalogueId==='sandshrew' && !player.active.item);
}
const hasShedSkin=pokemon=>['caterpie','weedle'].includes(pokemon?.catalogueId)&&pokemon.level===2&&!pokemon.defeated;
function activeOwner(room,instanceId) {
  return live(room).find(player=>player.active?.instanceId===instanceId&&!player.active.defeated);
}
function switchStillValid(room,event,ctx) {
  const player=trainer(room,event.playerId);
  return player&&!player.eliminated&&player.active?.instanceId===event.activeId&&player.reserve?.instanceId===event.reserveId&&!player.active.defeated&&!player.reserve.defeated&&currentHp(player.active,ctx.catalogue)>0&&currentHp(player.reserve,ctx.catalogue)>0;
}
function finishBattleSwitch(room,ctx,success) {
  const event=room.switchEvent,player=trainer(room,event.playerId);
  const valid=switchStillValid(room,event,ctx);
  delete room.switchEvent;room.pendingBattle=null;
  if(success&&valid) {
    ordinarySwitch(player,ctx.catalogue);player.reserve.revealed=true;
    if(event.kind==='ordinary')room.turn.switchUsed=true;
    note(room,'出战与备战宝可梦已交替。','The active and reserve Pokémon switched.');
  }else note(room,'本次交替未完成，已经支付的费用不退还。','The switch did not complete; any cards already paid remain discarded.');
  if(event.kind!=='ordinary')return nextSettlement(room,ctx);
}
function advanceBattleSwitch(room,ctx) {
  const event=room.switchEvent;
  if(!switchStillValid(room,event,ctx))return finishBattleSwitch(room,ctx,false);
  while(event.index<event.actorIds.length) {
    const actor=trainer(room,event.actorIds[event.index]);
    if(actor&&!actor.eliminated&&actor.active?.instanceId===event.actorInstances[actor.id]&&actor.active.catalogueId==='diglett'&&!actor.active.defeated&&currentHp(actor.active,ctx.catalogue)>0) {
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
  const actors=[...room.players.slice(start),...room.players.slice(0,start)].filter(actor=>!actor.spectator&&!actor.eliminated&&actor.active?.catalogueId==='diglett'&&!actor.active.defeated&&currentHp(actor.active,ctx.catalogue)>0&&eligibleTargetIds(room.players,actor.id).includes(player.id));
  room.switchEvent={kind,playerId:player.id,activeId:player.active?.instanceId??null,reserveId:player.reserve?.instanceId??null,actorIds:actors.map(actor=>actor.id),actorInstances:Object.fromEntries(actors.map(actor=>[actor.id,actor.active.instanceId])),index:0};
  advanceBattleSwitch(room,ctx);
}
function resumeStatusContinuation(room,ctx,next) {
  return next==='settlement'?nextSettlement(room,ctx):afterDamage(room,ctx);
}
function applyStatus(room,ctx,pokemon,status,next='afterDamage') {
  // One-status restriction precedes replacement. Never redirect to a reserve
  // deployed after the original target fainted.
  if(!pokemon || !activeOwner(room,pokemon.instanceId) || pokemon.status)return resumeStatusContinuation(room,ctx,next);
  if(['caterpie','weedle'].includes(pokemon.catalogueId)&&pokemon.level===1) {
    note(room,'鳞粉阻止此宝可梦陷入特殊状态。','Shield Dust prevented this Pokémon from gaining a special status.');
    return resumeStatusContinuation(room,ctx,next);
  }
  if(status==='paralysis'&&pokemon.catalogueId==='meowth'&&pokemon.level===3) {
    note(room,'柔软阻止此宝可梦陷入麻痹。','Limber prevented this Pokémon from becoming Paralyzed.');
    return resumeStatusContinuation(room,ctx,next);
  }
  startPoisonTouch(room,ctx,{kind:'status',targetId:pokemon.instanceId,status,next});
}
function startPoisonTouch(room,ctx,event) {
  requireRule(!room.statusEvent,'STATUS_PENDING','Finish the current status effect first.');
  const start=Math.max(0,room.players.findIndex(player=>player.id===room.turn.playerId));
  const ordered=[...room.players.slice(start),...room.players.slice(0,start)].filter(player=>!player.spectator&&!player.eliminated&&player.active?.catalogueId==='grimer'&&!player.active.defeated&&currentHp(player.active,ctx.catalogue)>0);
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
    if(actor&&!actor.eliminated&&actor.active?.instanceId===event.actorInstances[actor.id]&&actor.active.catalogueId==='grimer'&&!actor.active.defeated&&currentHp(actor.active,ctx.catalogue)>0) {
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
    }
    return resumeStatusContinuation(room,ctx,event.next);
  }
  if(!owner || owner.active.status!=='poison')return finishResolution(room,ctx);
  // Poison has no damage source or resolving card, but receiving modifiers
  // still apply before the shared optional Marvel Scale / HP pipeline.
  const amount=computeDamage(null,owner.active,event.damage,ctx.catalogue,{command:false,channel:'status',receiving:!hasShedSkin(owner.active)});
  receiveDamage(room,ctx,amount);
}
export function publicBattleDecision(room,self) {
  if(!room.pendingBattle)return null;
  const pending=structuredClone(room.pendingBattle);
  const repeated=[room.resolution,...(room.resolutionStack||[])].find(resolution=>resolution?.settlementCount!==undefined);
  if(repeated) {
    Object.assign(pending,{settlementNumber:repeated.settlementIndex+1,settlementCount:repeated.settlementCount});
    if(repeated.revealedCards)pending.revealedCards=repeated.revealedCards.map(({name,weather,kind})=>({name,weather,kind}));
    if(repeated.effectKind==='double-kick')pending.settlementMove={zh:'二连踢',en:'Double Kick'};
  }
  if(pending.kind==='switch-payment'&&pending.actorId===self.id)pending.cards=self.hand.map(({id,name,weather,kind})=>({id,name,weather,kind}));
  if(pending.kind==='shed-skin'&&pending.actorId===self.id)pending.cards=self.hand.map(({id,name,weather,kind})=>({id,name,weather,kind}));
  if(pending.kind==='distribute'&&pending.actorId===self.id)pending.cards=(room.resolution.distributionCards||[]).map(({name,weather,kind},index)=>({index,name,weather,kind}));
  if(pending.kind==='cycle' && pending.actorId===self.id)pending.cards=self.hand.map(({id,name,weather,kind})=>({id,name,weather,kind}));
  if(pending.kind==='judgment' && pending.actorId===self.id)pending.replacementCards=self.hand.filter(card=>['intense-sun','clear'].includes(card.weather)).map(({id,name,weather,kind})=>({id,name,weather,kind}));
  if(['hand','exile','cursed-body'].includes(pending.kind) && pending.actorId===self.id) {
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
  return pending;
}
// Move-use effects finish before the first target receives a defense window.
function openMoveUse(room, ctx) {
  const resolution = room.resolution;
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
  if (resolution.index >= resolution.targetIds.length) return finishResolution(room, ctx);
  const target = trainer(room, resolution.targetIds[resolution.index]);
  if(resolution.settlementCount!==undefined&&(!activeOwner(room,resolution.sourceId)||!activeOwner(room,resolution.originalTargetId)||target.active.instanceId!==resolution.originalTargetId||currentHp(creature(room,resolution.sourceId),ctx.catalogue)<=0||currentHp(target.active,ctx.catalogue)<=0))return finishResolution(room,ctx);
  if (target.eliminated || target.active.defeated) { resolution.index++; return openDefense(room, ctx); }
  resolution.targetCreatureId = target.active.instanceId;
  delete resolution.incomingDamage;delete resolution.modifierState;
  resolution.sourceAfterDone=false; resolution.staticDone=false; delete resolution.receivingEffects;delete resolution.helmetCardId; resolution.actualDamage=0; delete resolution.handChoiceIds;
  decision(room, 'defense', target.id, target.id, ctx);
  room.pendingBattle.cannotDodge=Boolean(resolution.ignoresReinforcements);
  room.pendingBattle.canTrait=!room.pendingBattle.cannotDodge && canSandVeil(target) && room.drawPile.length+room.discardPile.length>0;
  if(room.pendingBattle.canTrait)room.pendingBattle.trait='sand-veil';
  if(resolution.sourceFamily==='caterpie'&&resolution.sourceLevel===3&&resolution.sourcePlayerId!==target.id)room.pendingBattle.blockedDodgeWeathers=['intense-sun'];
  if(resolution.settlementCount!==undefined)Object.assign(room.pendingBattle,{settlementNumber:resolution.settlementIndex+1,settlementCount:resolution.settlementCount});
  if(resolution.sourceFamily==='pidgey'&&resolution.sourcePlayerId!==target.id) {
    room.pendingBattle.dodgeReducesDamage=true;room.pendingBattle.damageReduction=resolution.dodgeReductions?.[target.active.instanceId]||0;
  }
}
function reduceMoveDamage(room,targetId) {
  room.resolution.dodgeReductions??={};
  return room.resolution.dodgeReductions[targetId]=(room.resolution.dodgeReductions[targetId]||0)+1;
}
const hasSniper=player=>!player.spectator&&!player.eliminated&&player.active?.catalogueId==='weedle'&&player.active.level===3&&!player.active.defeated;
export const cardDistanceIgnored=(room,player)=>room.turn?.cardRangePlayerId===player.id||hasSniper(player);
const weatherMoveEffects=new Set(['burn-judgment','temporary-hand-exile','self-defense','paralysis-judgment','forced-switch','sleep-judgment']);
export function previewActions(room, player, catalogue) {
  if (room.status !== 'playing' || player.spectator || player.eliminated || !player.active) return null;
  const own = room.turn?.playerId === player.id && room.turn.phase === 'play' && !room.pendingBattle && !room.pendingVote;
  const pokemon = player.active;
  const used = room.turn?.usedMoves || [];
  const move = face(pokemon, catalogue)?.moves?.[0];
  const unlocked = !room.turn.commandCreatureId || room.turn.commandCreatureId === pokemon.instanceId;
  const ignoresReinforcements=pokemon.catalogueId==='dratini' && pokemon.level>=2;
  const targetsFor=ignoreDistance=>eligibleTargetIds(room.players,player.id,{ignoreDistance:ignoreDistance||hasSniper(player)||room.turn.rangeCreatureId===pokemon.instanceId||room.turn.swiftSwimCreatureIds?.includes(pokemon.instanceId)||(!ignoresReinforcements&&reinforcementEffective(pokemon,'speed'))}).filter(id=>face(trainer(room,id).active,catalogue)?.effectStatus==='combat-preview');
  const traitUsed = (room.turn.traitsUsed || []).includes(pokemon.instanceId);
  const teleport=pokemon.catalogueId==='abra' && pokemon.level===1;
  const teleportBlocked=teleport && room.turn.switchBlocked && player.reserve && !player.reserve.defeated;
  const moveAvailable=Boolean(own && face(pokemon,catalogue)?.effectStatus==='combat-preview' && !room.turn.movesBlocked && !(room.turn.blockedMoveIds||[]).includes(pokemon.instanceId));
  const moves=(face(pokemon,catalogue)?.moves||[]).map((item,index)=>{
    const command=item.condition?.kind==='command';
    const supported=command||(item.condition?.kind==='weather-card'&&weatherMoveEffects.has(item.effectKind)&&item.condition.weatherIconsInCondition?.length>0);
    return {index,name:item.name,condition:item.condition,printedValue:item.printedValue,effectKind:item.effectKind||null,cannotDodge:ignoresReinforcements,ignoresReinforcements,maxTargets:item.targeting?.max||1,legalTargetIds:own?(teleport||item.targeting?.kind==='self'?[player.id]:targetsFor(item.targeting?.ignoresDistance===true)):[],canUse:Boolean(moveAvailable&&supported&&(!command||(!teleportBlocked&&unlocked))&&(pokemon.catalogueId==='shellder'||!used.includes(`${pokemon.instanceId}:${item.name.zh}`)))};
  });
  const canCommand=Boolean(move?.condition?.kind==='command'&&moves[0]?.canUse);
  const giveRecipientIds = live(room).filter(p=>p.id!==player.id).map(p=>p.id);
  // A virtual command has no printed sunny weather, so it cannot meet paralysis.
  const giveCommandAvailable = canCommand && pokemon.status!=='paralysis';
  const canGive = own && face(pokemon,catalogue)?.effectStatus==='combat-preview' && pokemon.catalogueId==='growlithe' && !room.turn.justifiedUsed && giveRecipientIds.length>0 && (player.hand.length>1 || (player.hand.length===1 && giveCommandAvailable));
  return { canEquip:Boolean(own&&player.hand.some(reviewedItem)), equipSlots:own?['active','reserve'].filter(slot=>player[slot]&&!player[slot].defeated):[], moves, canCommand, canGive:Boolean(canGive), giveCommandAvailable, giveRecipientIds:own?giveRecipientIds:[], canSwitch: Boolean(own && !room.turn.switchUsed && !room.turn.switchBlocked && !player.reserve?.defeated), canTrait: Boolean(!room.pendingBattle && !room.pendingVote && !traitUsed && room.turn.playerId === player.id && ((['bulbasaur','magnemite'].includes(pokemon.catalogueId) && room.turn.phase === 'play') || (pokemon.catalogueId==='psyduck'&&room.turn.phase==='play'&&!room.turn.swiftSwimUsed) || (pokemon.catalogueId === 'squirtle' && room.turn.phase === 'end'))), ...(pokemon.catalogueId==='magnemite'?{trait:{kind:'analytic',name:{zh:'分析',en:'Analytic'},maxCards:Math.min(player.hand.length,Math.max(0,currentHp(pokemon,catalogue)))}}:{}),legalTargetIds:moves[0]?.legalTargetIds||[], move: move ? { name: move.name, printedValue: move.printedValue, maxTargets:moves[0].maxTargets } : null };
}
export function playBattleMove(room, player, input, ctx) {
  const legal=previewActions(room,player,ctx.catalogue),index=input.moveIndex===undefined?0:input.moveIndex;
  requireRule(Number.isSafeInteger(index)&&index>=0 && legal?.moves?.[index]?.canUse,'MOVE_UNAVAILABLE','This Pokémon cannot use the selected move now.');
  const move=legal.moves[index],command=move.condition.kind==='command';
  requireRule(Array.isArray(input.targetIds)&&input.targetIds.length>=1&&input.targetIds.length<=move.maxTargets&&new Set(input.targetIds).size===input.targetIds.length&&input.targetIds.every(id=>move.legalTargetIds.includes(id)),'INVALID_TARGET','Choose legal active Pokémon within range.');
  const selected=player.hand.find(card=>card.id===input.cardId);
  requireRule(selected && (command?selected.kind==='command':move.condition.weatherIconsInCondition.includes(selected.weather)),'INVALID_CARD','Choose one qualifying card from your own hand.');
  requireRule(!command||player.active.status!=='paralysis'||['intense-sun','clear'].includes(selected.weather),'INVALID_CARD','Paralysis permits only sunny-weather command cards.');
  const mayBoost=command&&player.active.catalogueId==='magikarp'&&player.active.level===3;
  requireRule(mayBoost||input.boostCardId===undefined,'INVALID_CARD','Only Hyper Beam accepts a declaration discard.');
  const boost=input.boostCardId===undefined?null:player.hand.find(card=>card.id===input.boostCardId);
  requireRule(input.boostCardId===undefined||(boost&&boost!==selected),'INVALID_CARD','Choose a different card from your own hand for Hyper Beam.');
  if(boost)room.discardPile.push(...player.hand.splice(player.hand.indexOf(boost),1));
  player.hand.splice(player.hand.indexOf(selected),1);
  if(!command)room.discardPile.push(selected);
  beginBattleMove(room,player,input.targetIds,command?selected:null,{...legal,move,damageBoost:boost?1:0},ctx,command);
}
function beginBattleMove(room,player,targetIds,command,legal,ctx,isCommand=true) {
  const source = player.active;
  if(isCommand)room.turn.commandCreatureId = source.instanceId;
  room.turn.usedMoves ??= []; room.turn.usedMoves.push(`${source.instanceId}:${legal.move.name.zh}`);
  room.resolution = { kind: 'move', card: command, virtualCommand:isCommand&&!command, statusMove:!isCommand, moveIndex:legal.move.index??0,effectKind:legal.move.effectKind||null, ignoresReinforcements:source.catalogueId==='dratini'&&source.level>=2, sourceId: source.instanceId, sourcePlayerId: player.id, sourceLevel: source.level, sourceFamily: source.catalogueId, baseDamage: (legal.move.printedValue??0)+(legal.damageBoost||0), powerBoost: isCommand?beginCommand(source):0, targetIds: [...targetIds], index: 0, damagedIds: [], defenseIds: [] };
  if(!isCommand)note(room,`弃置一张符合天气的手牌使用${legal.move.name.zh}；目标正在决定响应。`,`One qualifying weather hand card was discarded to use ${legal.move.name.en}; the target is deciding a response.`);
  else note(room, command?'当前玩家使用接招吧！；目标正在决定响应。':'正义之心视为使用接招吧！；目标正在决定响应。', command?'The current trainer used Take this!; the target is deciding a response.':'Justified counted as using Take this!; the target is deciding a response.');
  if(isCommand&&source.catalogueId==='magikarp'&&source.level>=2) {
    if(room.drawPile.length+room.discardPile.length)drawBattleCards(room,player,1,'moxie');
    else note(room,'自信过度已触发，但当前没有可摸取的牌。','Moxie triggered, but no card is currently available to draw.');
  }
  if(source.catalogueId==='slowpoke' && source.level===3) {
    decision(room,'foresee',player.id,player.id,ctx);
    Object.assign(room.pendingBattle,{trait:'future-sight',canTrait:true});
  }else openMoveUse(room,ctx);
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
  note(room, '宝可梦昏厥；从当前回合训练家起依次结算救援。', 'A Pokémon is fainting; rescue starts with the current turn’s trainer.');
  decision(room, 'rescue', room.resolution.rescueActors[0], targetId, ctx);
}
function settleDamage(room, ctx) {
  const resolution = room.resolution;
  const target = creature(room, resolution.targetCreatureId), source = creature(room, resolution.sourceId);
  if(resolution.effectKind==='forced-switch') {
    const owner=activeOwner(room,target.instanceId),reserve=owner?.reserve;
    if(reserve&&!reserve.defeated&&currentHp(reserve,ctx.catalogue)>0) {
      return requestBattleSwitch(room,owner,'whirlwind',ctx);
    }else note(room,'目标没有可以登场的备战搭档，吹飞未调换位置。','Whirlwind did not swap partners because the target has no living reserve.');
    return nextSettlement(room,ctx);
  }
  if(resolution.sourceFamily==='magikarp'&&resolution.sourceLevel===1)return nextSettlement(room,ctx);
  if(resolution.effectKind==='sleep-judgment')return startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'sleep',weather:'thunderstorm',comparison:'not',next:'settlement'},resolution.sourcePlayerId);
  if(resolution.effectKind==='paralysis-judgment')return startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:'paralysis',weather:'intense-sun',comparison:'not',next:'settlement'},resolution.sourcePlayerId);
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
  const printedDamage=resolution.baseDamage+(resolution.sourceFamily==='gastly'&&resolution.sourceLevel===3&&target.status?1:0)+(resolution.sourceFamily==='nidoran-m'&&resolution.sourceLevel>=2&&(source.damage||0)===0?1:0);
  const reduction=resolution.dodgeReductions?.[target.instanceId]||0;
  if(reduction>0||hasShedSkin(target)) {
    const amount=room.turn.damageImmunityIds?.includes(target.instanceId)?0:computeDamage(source,target,printedDamage,ctx.catalogue,{command:true,powerBoost:resolution.powerBoost,reinforcements:!resolution.ignoresReinforcements,receiving:false});
    resolution.modifierState={targetId:target.instanceId,amount,reduction,remaining:['dodge','defense','multiscale','marvel-scale','shed-skin']};
    return continueDamageModifiers(room,ctx);
  }
  const amount = room.turn.damageImmunityIds?.includes(target.instanceId)?0:computeDamage(source, target, printedDamage, ctx.catalogue, { command: true, powerBoost: resolution.powerBoost, reinforcements:!resolution.ignoresReinforcements });
  receiveDamage(room,ctx,amount);
}
function continueDamageModifiers(room,ctx) {
  const resolution=room.resolution,state=resolution.modifierState,target=creature(room,state.targetId),owner=activeOwner(room,state.targetId);
  if(!owner){delete resolution.modifierState;return nextSettlement(room,ctx);}
  const eligible=effect=>{
    if(state.amount<=0)return false;
    if(effect==='dodge')return state.reduction>0;
    if(effect==='shed-skin')return hasShedSkin(target)&&owner.hand.length>0;
    if(state.amount<=1)return false;
    if(effect==='defense')return !resolution.ignoresReinforcements&&reinforcementEffective(target,'defense');
    if(effect==='multiscale')return target.catalogueId==='dratini'&&target.level===3&&(target.damage||0)===0;
    return effect==='marvel-scale'&&target.catalogueId==='dratini'&&target.level<=2&&Boolean(target.status);
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
  if(hasShedSkin(target)) {
    resolution.modifierState={targetId:target.instanceId,amount,reduction:0,remaining:['defense','shed-skin']};return continueDamageModifiers(room,ctx);
  }
  if(amount>1 && target.catalogueId==='dratini' && target.level<=2 && target.status && !target.defeated) {
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
  if (amount > 0 && resolution.kind!=='turn-start' && reinforcementEffective(target, 'defense')) resolution.defenseIds.push(target.instanceId);
  const labels=resolution.kind==='item'?['凸凸头盔','Rocky Helmet']:resolution.kind==='turn-start'?['特殊状态','The special status']:['招式','The move'];
  note(room, `${labels[0]}造成${amount}点伤害。`, `${labels[1]} dealt ${amount} damage.`);
  if (result.fainting) beginRescue(room, room.players.find(p=>p.active?.instanceId===target.instanceId).id, ctx);
  else afterDamage(room, ctx);
}
function afterDamage(room,ctx) {
  const resolution=room.resolution;
  if(resolution.actualDamage<=0)return nextSettlement(room,ctx);
  const source=creature(room,resolution.sourceId),target=creature(room,resolution.targetCreatureId);
  // Booklet p.11: after-dealing effects precede after-receiving effects.
  if(!resolution.sourceAfterDone) {
    resolution.sourceAfterDone=true;
    if(resolution.kind==='move' && source && !source.defeated) {
      if(resolution.sourceFamily==='bulbasaur') {heal(source,1,ctx.catalogue);if(resolution.sourceLevel===3)drawBattleCards(room,trainer(room,resolution.sourcePlayerId));}
      const family=resolution.sourceFamily,level=resolution.sourceLevel;
      if(resolution.effectKind==='pay-day') {
        decision(room,'pay-day',resolution.sourcePlayerId,resolution.sourcePlayerId,ctx);Object.assign(room.pendingBattle,{trait:'pay-day',canTrait:true});return;
      }
      if(resolution.effectKind==='flinch-after-damage'&&resolution.sourceFamily!=='magikarp')return applyStatus(room,ctx,target,'flinch','afterDamage');
      if(((family==='psyduck'&&level<=2)||(family==='diglett'&&level>=2))&&activeOwner(room,target.instanceId)) {
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
      const statusJudgment=(family==='charmander'||family==='vulpix'||(family==='growlithe'&&level>=2))?['burn','intense-sun']:['pikachu','magnemite'].includes(family)?['paralysis','thunderstorm']:family==='gastly'&&level===1?['paralysis','rain']:family==='abra'&&level>=2?['confusion','intense-sun']:family==='psyduck'&&level===3?['confusion','rain']:(family==='slowpoke'&&level===2)||(family==='pidgey'&&level===3)||(family==='magikarp'&&level===2)?['flinch','thunderstorm']:family==='sandshrew'&&level===1||family==='grimer'&&level>=2||family==='weedle'&&level<=2?['poison','rain']:null;
      if(statusJudgment)return startJudgment(room,ctx,{kind:'status',targetId:target.instanceId,status:statusJudgment[0],weather:statusJudgment[1],...((['grimer','psyduck'].includes(family)&&level===3)||(family==='gastly'&&level===1)?{weathers:['rain','thunderstorm']}:{}),next:'afterDamage'},resolution.sourcePlayerId);
      if(family==='gastly'&&level===2) {
        const targetOwner=activeOwner(room,target.instanceId);
        return startJudgment(room,ctx,{kind:'shadow-ball',targetOwnerId:targetOwner?.id,sourcePlayerId:resolution.sourcePlayerId},resolution.sourcePlayerId);
      }
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
    const targetOwner=room.players.find(p=>p.active?.instanceId===target?.instanceId&&!p.eliminated),sourceOwner=room.players.find(p=>p.active?.instanceId===source?.instanceId&&!p.eliminated);
    if(targetOwner&&!target.defeated) {
      if(target.catalogueId==='pikachu'&&sourceOwner&&!source.defeated)resolution.receivingEffects.push('static');
      if(target.catalogueId==='nidoran-m'&&sourceOwner&&!source.defeated)resolution.receivingEffects.push('poison-point');
      if(target.catalogueId==='abra'&&resolution.card&&['command','event'].includes(resolution.card.kind)&&!resolution.cardClaimedBy)resolution.receivingEffects.push('synchronize');
      if(target.catalogueId==='slowpoke'&&room.turn.playerId!==targetOwner.id)resolution.receivingEffects.push('oblivious');
      if(target.catalogueId==='gastly'&&target.level===3&&sourceOwner?.hand.length&&sourceOwner.id!==targetOwner.id)resolution.receivingEffects.push('cursed-body');
      if(itemEffective(room,target)&&sourceOwner&&!source.defeated){resolution.receivingEffects.push('rocky-helmet');resolution.helmetCardId=target.item.id;}
    }
  }
  continueReceiving(room,ctx);
}
function nextSettlement(room, ctx) {
  room.pendingBattle = null;
  if (['turn-start','item'].includes(room.resolution.kind)) return finishResolution(room, ctx);
  if(room.resolution.settlementCount!==undefined) {
    room.resolution.settlementIndex++;
    if(room.resolution.settlementIndex<room.resolution.settlementCount)return openDefense(room,ctx);
  }
  room.resolution.index++; openDefense(room, ctx);
}
function finishResolution(room,ctx) {
  cleanResolution(room,room.resolution);room.pendingBattle=null;delete room.judgment;delete room.statusEvent;
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
  if (player.reserve && !player.reserve.defeated) {
    const reserve = player.reserve; reserve.revealed = true; pokemon.revealed = true;
    player.active = reserve; player.reserve = pokemon;
    note(room, '备战宝可梦强制登场；不消耗普通交替。', 'The reserve was deployed; this does not consume ordinary switching.');
  } else {
    player.eliminated = true; room.discardPile.push(...player.hand); player.hand = [];
    note(room, '一名训练家退场并公开身份。', 'A trainer was eliminated and revealed their identity.');
  }
  const result = evaluateVictory(room.players);
  if (result) {
    for(const pending of [room.resolution,...(room.resolutionStack||[])])cleanResolution(room,pending);room.resolution=null;room.pendingBattle=null;delete room.resolutionStack;delete room.judgment;delete room.statusEvent;delete room.turnStart;delete room.switchEvent; room.result = { ...result, completedAt: ctx.now(), developmentFixture: true };
    room.status = 'finished'; room.turn = null;
    note(room, '胜利条件已达成，所有身份与剩余手牌公开。', 'A victory condition was met; all identities and remaining hands are revealed.');
    return;
  }
  afterDamage(room, ctx);
}
export function respondBattle(room,player,input,ctx) {
  const pending=room.pendingBattle;
  requireRule(pending && input.decisionId===pending.id,'STALE_DECISION','Refresh the pending decision.');
  requireRule(pending.actorId===player.id && !player.spectator && !player.eliminated,'NOT_YOUR_DECISION','This response belongs to another trainer.');
  requireRule(pending.kind==='distribute'||input.allocations===undefined,'INVALID_RESPONSE','This decision does not distribute cards.');
  requireRule(pending.kind==='exile'||input.handIndices===undefined,'INVALID_RESPONSE','This decision does not select multiple hand slots.');
  requireRule(pending.kind==='shed-skin'||input.cardIds===undefined,'INVALID_RESPONSE','This decision does not select hand cards.');
  if(pending.kind==='arena-trap') {
    requireRule(['trait','pass'].includes(input.choice)&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined&&input.effect===undefined,'INVALID_RESPONSE','Use Arena Trap or allow this switch.');
    const event=room.switchEvent;
    requireRule(event&&switchStillValid(room,event,ctx)&&event.actorIds[event.index]===player.id&&event.actorInstances[player.id]===player.active.instanceId&&player.active.catalogueId==='diglett'&&!player.active.defeated,'STALE_DECISION','The switch or trapper changed.');
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
    requireRule(state&&state.targetId===player.active.instanceId&&hasShedSkin(player.active),'STALE_DECISION','The Shed Skin Pokémon changed.');
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
    requireRule(room.turnStart?.playerId===player.id&&room.turnStart.remaining.includes(input.effect),'STALE_DECISION','The turn-start effects changed.');
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
    requireRule(event&&event.actorIds[event.index]===player.id&&event.actorInstances[player.id]===player.active?.instanceId&&player.active.catalogueId==='grimer'&&!player.active.defeated&&currentHp(player.active,ctx.catalogue)>0,'STALE_DECISION','The Poison Touch responder changed.');
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
    requireRule(player.active.instanceId===resolution.targetCreatureId&&player.active.catalogueId==='dratini'&&player.active.level<=2&&player.active.status&&!player.active.defeated&&resolution.incomingDamage>1,'STALE_DECISION','The incoming damage changed.');
    const amount=resolution.incomingDamage-(input.choice==='trait'?1:0);
    room.pendingBattle=null;
    if(resolution.modifierState){resolution.modifierState.amount=amount;delete resolution.incomingDamage;continueDamageModifiers(room,ctx);}else commitDamage(room,ctx,amount);
    return;
  }
  if(pending.kind==='defiant') {
    requireRule(['trait','pass'].includes(input.choice)&&input.cardId===undefined&&input.handIndex===undefined&&input.order===undefined&&input.reinforcement===undefined,'INVALID_RESPONSE','Use Defiant or pass.');
    if(input.choice==='trait'){drawBattleCards(room,player,2);room.turn.noHandLimitIds??=[];if(!room.turn.noHandLimitIds.includes(player.id))room.turn.noHandLimitIds.push(player.id);note(room,'不服输摸两张牌，本回合没有手牌上限。','Defiant drew two cards and removed this trainer’s hand limit for the current turn.');}
    room.pendingBattle=null;return;
  }
  if(pending.kind==='judgment') {
    requireRule(input.reinforcement===undefined&&input.order===undefined&&input.handIndex===undefined,'INVALID_RESPONSE','This judgment only accepts replacement or pass.');
    const judgment=room.judgment;
    requireRule(judgment && judgment.actorIds[judgment.index]===player.id && judgment.actorInstances[player.id]===player.active.instanceId && player.active.catalogueId==='vulpix' && !player.active.defeated,'STALE_DECISION','The judgment responder changed.');
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
      requireRule(pending.canTrait && !pending.traitAttempted && canSandVeil(player),'TRAIT_UNAVAILABLE','Sand Veil is unavailable for this settlement.');
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
      const levitate=player.active?.catalogueId==='gastly'&&player.active.level<=2&&!player.active.defeated&&['rain','thunderstorm'].includes(response?.weather);
      requireRule(responseIndex>=0&&(response.kind==='dodge'||levitate),'INVALID_CARD','Choose Dodge! or a rainy hand card with Levitate.');
      requireRule(!pending.blockedDodgeWeathers?.includes(response.weather),'INVALID_CARD','Compound Eyes prevents an intense-sun Dodge against this move.');
      player.hand.splice(responseIndex,1);room.discardPile.push(response);
      if(pending.dodgeReducesDamage) {
        pending.damageReduction=reduceMoveDamage(room,room.resolution.targetCreatureId);
        note(room,'锐利目光将快躲开！改为此招式对该宝可梦的伤害减1，持续到整个招式结束。','Keen Eye changed Dodge! into one damage reduction for this Pokémon until the whole move ends.');return;
      }
      note(room,'快躲开！抵消了本次结算。','Dodge! canceled this settlement.');nextSettlement(room,ctx);
    }else settleDamage(room,ctx);
    return;
  }
  requireRule(pending.kind==='rescue' && input.choice==='pass','INVALID_RESPONSE','Choose a supported rescue response.');
  // Potion is not in this development deck: its obscured rescue text is not guessed.
  const resolution=room.resolution;resolution.rescueIndex++;
  if(resolution.rescueIndex<resolution.rescueActors.length)decision(room,'rescue',resolution.rescueActors[resolution.rescueIndex],pending.targetId,ctx);
  else defeat(room,pending.targetId,ctx);
}
export function useBattleTrait(room, player, ctx,input={}) {
  requireRule(previewActions(room, player, ctx.catalogue)?.canTrait, 'TRAIT_UNAVAILABLE', 'This optional trait is unavailable now.');
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
  if(player.active.catalogueId==='psyduck')room.turn.swiftSwimUsed=true;
  startJudgment(room,ctx,{kind:'trait',sourceId:player.active.instanceId,family:player.active.catalogueId,ownerId:player.id},player.id);
}
export function beginBattleTurn(room, player, ctx) {
  room.turn.noHandLimitIds=[];
  room.turn.justifiedUsed = false;
  room.turn.pickupUsedIds=[];
  room.turn.swiftSwimUsed=false;room.turn.cardRangePlayerId=null;room.turn.swiftSwimCreatureIds=[];
  room.turn.usedMoves = []; room.turn.traitsUsed = []; room.turn.commandCreatureId = null; room.turn.rangeCreatureId = null;
  room.turn.movesBlocked = false; room.turn.switchBlocked = false;
  room.turn.blockedMoveIds = []; room.turn.damageImmunityIds = [];
  delete room.turnStart;
  const remaining=[...(player.exiledCards?.length?['return-cards']:[]),...(['flinch','sleep','confusion','poison'].includes(player.active.status)?['status']:[])];
  if(remaining.length){room.turnStart={playerId:player.id,pokemonId:player.active.instanceId,remaining};continueTurnStart(room,ctx);}
}
function returnExiledCards(room,player) {
  const cards=player.exiledCards||[];player.exiledCards=[];
  gainBattleCards(room,player,cards,{reason:'return'});
  if(player.eliminated){room.discardPile.push(...player.hand);player.hand=[];}
  note(room,`${cards.length}张移出游戏的牌返回该训练家的手牌。`,`${cards.length} removed card(s) returned to that trainer’s hand.`);
}
function continueTurnStart(room,ctx) {
  const start=room.turnStart;if(!start)return;
  const player=trainer(room,start.playerId);
  if(!start.remaining.length){delete room.turnStart;room.pendingBattle=null;return;}
  if(player.eliminated) {
    if(start.remaining.includes('return-cards'))returnExiledCards(room,player);
    delete room.turnStart;room.pendingBattle=null;return;
  }
  if(start.remaining.length>1) {
    decision(room,'turn-start-order',player.id,player.id,ctx);room.pendingBattle.effects=[...start.remaining];return;
  }
  runTurnStartEffect(room,start.remaining[0],ctx);
}
function runTurnStartEffect(room,effect,ctx) {
  const start=room.turnStart,player=trainer(room,start.playerId);
  start.remaining.splice(start.remaining.indexOf(effect),1);
  if(effect==='return-cards'){returnExiledCards(room,player);return continueTurnStart(room,ctx);}
  const pokemon=creature(room,start.pokemonId);
  if(!pokemon||player.active.instanceId!==pokemon.instanceId||pokemon.defeated)return continueTurnStart(room,ctx);
  const status = pokemon.status;
  if (status === 'flinch') { player.active.status = null; room.turn.drawRemaining = 1; }
  if (status === 'sleep') { player.active.status = null; room.turn.blockedMoveIds.push(player.active.instanceId); room.turn.switchBlocked = true; }
  if (status === 'confusion') { player.active.status = null; room.turn.blockedMoveIds.push(player.active.instanceId); }
  if (status === 'poison' || status === 'confusion') {
    const damage = status === 'confusion' ? computeDamage(pokemon, pokemon, 1, ctx.catalogue, { command: false,receiving:!hasShedSkin(pokemon) }) : 1;
    room.resolution = { kind: 'turn-start', targetCreatureId: pokemon.instanceId, sourceId: status === 'confusion' ? pokemon.instanceId : null, sourcePlayerId: status === 'confusion' ? player.id : null, damagedIds: [], defenseIds: [], actualDamage: 0 };
    if(status==='poison')return startPoisonTouch(room,ctx,{kind:'poison',targetId:pokemon.instanceId,damage:1});
    receiveDamage(room,ctx,damage);
    return;
  }
  continueTurnStart(room,ctx);
}
export function publicBattlePokemon(pokemon, catalogue, room) {
  if (!pokemon) return null;
  return { catalogueId: pokemon.catalogueId, level: pokemon.level, hp: currentHp(pokemon, catalogue), maxHp: maxHp(pokemon, catalogue), status: pokemon.status, damageProtected:Boolean(room?.turn?.damageImmunityIds?.includes(pokemon.instanceId)), ...(pokemon.item?{item:publicItem(pokemon.item),itemSuppressed:!itemEffective(room,pokemon)}:{}), defeated: Boolean(pokemon.defeated), reinforcements: [...(pokemon.reinforcements || [])] };
}
