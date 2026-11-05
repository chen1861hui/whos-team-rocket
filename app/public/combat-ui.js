const words = {
  leader:['Gym Leader','道馆馆主'], gym:['Gym Trainer','道馆训练家'], challenger:['Challenger','挑战者'], rocket:['Rocket Grunt','火箭队手下'], hidden:['Hidden identity','隐藏身份'],
  burn:['Burn','灼伤'], flinch:['Flinch','畏缩'], sleep:['Sleep','睡眠'], confusion:['Confusion','混乱'], paralysis:['Paralysis','麻痹'], poison:['Poison','中毒'],
};
const say = (language, en, zh) => language === 'zh' ? zh : en;
export const roleName = (role, language) => words[role || 'hidden']?.[language === 'zh' ? 1 : 0] || role;
export const statusName = (status, language) => words[status]?.[language === 'zh' ? 1 : 0] || '';
function node(tag, attrs = {}, ...children) {
  const result = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'onclick') result.addEventListener('click', value);
    else if (key === 'class') result.className = value;
    else if (key === 'disabled') result.disabled = value;
    else result.setAttribute(key, value);
  }
  for (const child of children.flat()) if (child !== null && child !== undefined) result.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return result;
}
export function moveChoiceDialog(card,kit) {
  const initial=kit.getView(),language=kit.language,turnNumber=initial.turn?.number;
  const applicable=move=>move.condition?.kind==='command'?card.kind==='command':move.condition?.kind==='weather-card'&&move.condition.weatherIconsInCondition.includes(card.weather);
  const usable=(move,current)=>move.canUse&&!(move.condition?.kind==='command'&&current.players.find(player=>player.id===current.selfId)?.active?.status==='paralysis'&&!['intense-sun','clear'].includes(card.weather));
  const moves=(initial.self.battle?.moves||[]).filter(applicable);
  const dialog=node('dialog',{class:'info-dialog confirmation-dialog','aria-labelledby':'move-choice-title'},
    node('h2',{id:'move-choice-title'},say(language,'Choose move','选择招式')),
    node('p',{},`${kit.localized(card.name)} · ${weatherLabel(card.weather,language)}`));
  const selector=node('select',{id:'move-choice-select','aria-label':say(language,'Move to use with this card','使用此牌的招式')},node('option',{value:''},say(language,'Choose a move','请选择招式')));
  for(const move of moves)selector.append(node('option',{value:String(move.index),disabled:!usable(move,initial)},kit.localized(move.name)));
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-move-choice',disabled:true},say(language,'Choose targets','选择目标'));
  selector.addEventListener('change',()=>{confirm.disabled=selector.value===''||kit.busy||Boolean(kit.getView().pendingVote);});
  confirm.addEventListener('click',()=>{
    if(selector.value==='')return;
    const moveIndex=Number(selector.value),chosen=moves.find(move=>move.index===moveIndex),current=kit.getView(),move=current.self.battle?.moves?.[moveIndex];
    dialog.close();
    if(current.code!==initial.code||current.selfId!==initial.selfId||current.turn?.number!==turnNumber||kit.busy||current.pendingVote||!current.self.hand.some(item=>item.id===card.id)||!chosen||!move||JSON.stringify(move.name)!==JSON.stringify(chosen.name)||!applicable(move)||!usable(move,current))return;
    attackDialog(card,kit,moveIndex);
  });
  const cancel=node('button',{type:'button',class:'button secondary',onclick:()=>dialog.close()},say(language,'Cancel','取消'));
  dialog.append(node('label',{class:'attack-target',for:'move-choice-select'},node('strong',{},say(language,'Available moves','可选招式')),selector),node('div',{class:'action-row'},cancel,confirm));
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();selector.focus();
}
export function eventDialog(card,kit) {
  const initial=kit.getView(),language=kit.language,code=initial.code,selfId=initial.selfId,turnNumber=initial.turn?.number,cardId=card.id,eventType=card.eventType;
  const descriptor=current=>current?.self?.battle?.events?.find(event=>event.eventType===eventType);
  const event=descriptor(initial);
  if(card.kind!=='event'||!event)return;
  if(event.targeting==='single')return targetedEventDialog(card,kit);
  const targetIds=[...(event.targetIds||[])];
  const order=node('ol',{id:'event-target-order','aria-label':say(language,'Public target order','公开目标顺序')});
  for(const id of targetIds){
    const player=initial.players.find(player=>player.id===id),pokemon=player?.active;
    order.append(node('li',{},`${player?.nickname||'—'}${pokemon?` · ${kit.partnerName(pokemon.catalogueId,pokemon.level)}`:''}`));
  }
  const dialog=node('dialog',{class:'info-dialog confirmation-dialog','aria-labelledby':'event-title'},
    node('h2',{id:'event-title'},kit.localized(event.name)),node('p',{},kit.localized(event.description)),
    node('strong',{},say(language,'Targets resolve in this order','目标按此顺序结算')),order,
    node('p',{class:'muted'},say(language,'Confirming uses and spends this one physical event card. Each target resolves separately.','确认后使用并消耗这一张实体事件牌，各目标分别结算。')));
  const cancel=node('button',{type:'button',class:'button secondary',id:'cancel-event',onclick:()=>dialog.close()},say(language,'Cancel','取消'));
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-event',disabled:kit.busy||!event.canUse||Boolean(initial.pendingVote)||Boolean(initial.pendingBattle),onclick:()=>{
    const current=kit.getView(),legal=descriptor(current),held=current?.self?.hand?.find(item=>item.id===cardId&&item.kind==='event'&&item.eventType===eventType);
    dialog.close();
    if(current?.code!==code||current.selfId!==selfId||current.turn?.number!==turnNumber||current.status!=='playing'||current.turn?.playerId!==selfId||current.turn?.phase!=='play'||current.self.spectator||current.players.find(player=>player.id===selfId)?.eliminated||kit.busy||current.pendingVote||current.pendingBattle||!held||!legal?.canUse||JSON.stringify(legal.targetIds||[])!==JSON.stringify(targetIds))return;
    kit.action('useEvent',{cardId});
  }},say(language,'Use event · spend card','使用事件 · 消耗此牌'));
  dialog.append(node('div',{class:'action-row'},cancel,confirm));dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();cancel.focus();
}
function targetedEventDialog(card,kit) {
  const initial=kit.getView(),language=kit.language,code=initial.code,selfId=initial.selfId,turnNumber=initial.turn?.number,cardId=card.id,eventType=card.eventType;
  const descriptor=current=>current?.self?.battle?.events?.find(event=>event.eventType===eventType),event=descriptor(initial),split=Boolean(event.choices);
  const draft=privateDecisionDraft({kind:'event',id:`${turnNumber}:${cardId}:${eventType}`},kit,()=>({effect:'',targetId:'',targetFace:null}));
  const targetIsTrainer=()=>eventType==='rival-challenge'||eventType==='farfetchd-prank'&&draft.effect==='hand';
  const enabled=choice=>Boolean(choice?.targetIds?.length);
  const legalTargets=current=>{
    const legal=descriptor(current);
    return split?(legal?.choices?.find(choice=>choice.effect===draft.effect)?.targetIds||[]):legal?.targetIds||[];
  };
  const publicFace=(current,id)=>{
    const pokemon=current.players.find(player=>player.id===id)?.active;
    return pokemon?JSON.stringify([pokemon.instanceId??null,pokemon.catalogueId,pokemon.level]):null;
  };
  if(split&&!event.choices?.some(choice=>choice.effect===draft.effect&&enabled(choice))){draft.effect='';draft.targetId='';draft.targetFace=null;}
  const dialog=node('dialog',{class:'info-dialog confirmation-dialog','aria-labelledby':'event-title'},
    node('h2',{id:'event-title'},kit.localized(event.name)),node('p',{},kit.localized(event.description)));
  const effects=split?node('select',{id:'event-effect','aria-label':say(language,'Event effect','事件效果'),disabled:kit.busy||Boolean(initial.pendingVote)},node('option',{value:''},say(language,'Choose one effect','请选择一种效果'))):null;
  if(effects){
    for(const choice of event.choices||[])effects.append(node('option',{value:choice.effect,disabled:!enabled(choice)},`${kit.localized(choice.name)}${enabled(choice)?'':say(language,' · unavailable',' · 不可用')}`));
    effects.value=draft.effect;
    dialog.append(node('label',{class:'attack-target',for:'event-effect'},node('strong',{},say(language,'Effect','效果')),effects));
  }
  const targets=node('select',{id:'event-target','aria-label':say(language,'Event target','事件目标')});
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-event',disabled:true},say(language,'Use event · spend card','使用事件 · 消耗此牌'));
  const update=()=>{
    const current=kit.getView(),legal=descriptor(current);
    confirm.disabled=kit.busy||Boolean(current?.pendingVote)||Boolean(current?.pendingBattle)||!legal?.canUse||!legalTargets(current).includes(draft.targetId)||publicFace(current,draft.targetId)!==draft.targetFace;
  };
  const populateTargets=()=>{
    const current=kit.getView(),ids=legalTargets(current);
    if(!ids.includes(draft.targetId)||publicFace(current,draft.targetId)!==draft.targetFace){draft.targetId='';draft.targetFace=null;}
    targets.replaceChildren(node('option',{value:''},targetIsTrainer()?say(language,'Choose a trainer','请选择训练家'):say(language,'Choose an active Pokémon','请选择出战宝可梦')));
    for(const id of ids){
      const player=current.players.find(player=>player.id===id),pokemon=player?.active;
      targets.append(node('option',{value:id},`${player?.nickname||'—'} · ${pokemon?kit.partnerName(pokemon.catalogueId,pokemon.level):'—'}`));
    }
    targets.value=draft.targetId;targets.disabled=kit.busy||Boolean(current?.pendingVote)||Boolean(current?.pendingBattle)||!ids.length;update();
  };
  effects?.addEventListener('change',()=>{draft.effect=effects.value;draft.targetId='';draft.targetFace=null;populateTargets();});
  targets.addEventListener('change',()=>{draft.targetId=targets.value;draft.targetFace=publicFace(kit.getView(),draft.targetId);update();});
  confirm.addEventListener('click',()=>{
    const current=kit.getView(),legal=descriptor(current),held=current?.self?.hand?.find(item=>item.id===cardId&&item.kind==='event'&&item.eventType===eventType),effect=draft.effect,targetId=draft.targetId;
    dialog.close();
    if(current?.code!==code||current.selfId!==selfId||current.turn?.number!==turnNumber||current.status!=='playing'||current.turn?.playerId!==selfId||current.turn?.phase!=='play'||current.self.spectator||current.players.find(player=>player.id===selfId)?.eliminated||kit.busy||current.pendingVote||current.pendingBattle||!held||legal?.targeting!=='single'||!legal.canUse||!legalTargets(current).includes(targetId)||publicFace(current,targetId)!==draft.targetFace)return;
    if(split&&!legal.choices?.some(choice=>choice.effect===effect&&enabled(choice)))return;
    kit.action('useEvent',{cardId,targetId,...(split?{effect}:{})});
  });
  const cancel=node('button',{type:'button',class:'button secondary',id:'cancel-event',onclick:()=>dialog.close()},say(language,'Cancel','取消'));
  const help={
    'mr-mime-trick':say(language,'Take the selected card into your hand. A taken held item is not equipped automatically.','所获得的牌加入你的手牌，获得的持有物不会自动携带。'),
    'jigglypuff-performance':say(language,'The target trainer judges. This event does not ask for a Dodge response.','目标训练家进行判定，此事件不要求躲闪响应。')
  }[eventType];
  dialog.append(node('label',{class:'attack-target',for:'event-target'},node('strong',{},say(language,'Target','目标')),targets),
    ...(help?[node('p',{class:'muted'},help)]:[]),
    node('p',{class:'muted'},say(language,'Confirming consumes this one physical event card.','确认后消耗这一张实体事件牌。')),node('div',{class:'action-row'},cancel,confirm));
  populateTargets();dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();(effects||targets).focus();
}
export const toolChoiceEnabled=choice=>Boolean(choice?.targets?.length&&!choice.unavailableReason);
export function toolDialog(card,kit) {
  const initial=kit.getView(),language=kit.language,turnNumber=initial.turn?.number,code=initial.code,selfId=initial.selfId,cardId=card.id,toolType=card.toolType;
  const descriptor=current=>current?.self?.battle?.tools?.find(tool=>tool.toolType===toolType);
  const enabled=toolChoiceEnabled;
  const tool=descriptor(initial);
  if(card.kind!=='tool'||!tool)return;
  const draft=privateDecisionDraft({kind:'tool',id:`${turnNumber}:${cardId}`},kit,()=>({effect:'',targetKey:''}));
  if(!tool.choices.some(choice=>choice.effect===draft.effect&&enabled(choice))){draft.effect='';draft.targetKey='';}
  const key=target=>JSON.stringify([target.targetId,target.slot??null]);
  const dialog=node('dialog',{class:'info-dialog confirmation-dialog','aria-labelledby':'tool-title'},
    node('h2',{id:'tool-title'},say(language,'Choose one tool effect','选择一种道具效果')),
    node('p',{},`${kit.localized(card.name)} · ${weatherLabel(card.weather,language)}`));
  for(const choice of tool.choices)dialog.append(node('article',{},node('strong',{},kit.localized(choice.name)),
    choice.description?node('p',{},kit.localized(choice.description)):null,
    choice.unavailableReason?node('p',{class:'muted'},`${say(language,'Unavailable:','不可用：')} ${kit.localized(choice.unavailableReason)}`):null));
  const effects=node('select',{id:'tool-effect','aria-label':say(language,'Tool effect','道具效果'),disabled:kit.busy||Boolean(initial.pendingVote)},node('option',{value:''},say(language,'Choose one effect','请选择一种效果')));
  for(const choice of tool.choices)effects.append(node('option',{value:choice.effect,disabled:!enabled(choice)},`${kit.localized(choice.name)}${enabled(choice)?'':say(language,' · unavailable',' · 不可用')}`));
  effects.value=draft.effect;
  const targets=node('select',{id:'tool-target','aria-label':say(language,'Tool target','道具目标')});
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-tool',disabled:true},say(language,'Use effect · spend whole card','使用效果 · 消耗整张牌'));
  const targetLabel=(target,current,choice)=>{
    const player=current.players.find(player=>player.id===target.targetId);
    if(choice.targeting==='trainer')return player?.nickname||'—';
    const pokemon=target.slot==='active'?player?.active:target.targetId===current.selfId?current.self.reserve:player?.reserve;
    const slot=say(language,target.slot==='active'?'Active':'Reserve',target.slot==='active'?'出场':'备战');
    return `${player?.nickname||'—'} · ${slot} · ${pokemon?kit.partnerName(pokemon.catalogueId,pokemon.level):say(language,'Hidden Pokémon','未公开宝可梦')}`;
  };
  const update=()=>{
    const current=kit.getView(),choice=descriptor(current)?.choices.find(choice=>choice.effect===draft.effect);
    const blocked=kit.busy||Boolean(current?.pendingVote)||Boolean(current?.pendingBattle);
    confirm.disabled=blocked||!enabled(choice)||!choice.targets.some(target=>key(target)===draft.targetKey);
  };
  const populateTargets=()=>{
    const current=kit.getView(),choice=descriptor(current)?.choices.find(choice=>choice.effect===draft.effect),legal=enabled(choice)?choice.targets:[];
    if(!legal.some(target=>key(target)===draft.targetKey))draft.targetKey='';
    targets.replaceChildren(node('option',{value:''},choice?.targeting==='trainer'?say(language,'Choose a trainer','请选择训练家'):say(language,'Choose a Pokémon','请选择宝可梦')));
    for(const target of legal)targets.append(node('option',{value:key(target)},targetLabel(target,current,choice)));
    targets.value=draft.targetKey;targets.disabled=kit.busy||Boolean(current?.pendingVote)||Boolean(current?.pendingBattle)||!legal.length;update();
  };
  effects.addEventListener('change',()=>{draft.effect=effects.value;draft.targetKey='';populateTargets();});
  targets.addEventListener('change',()=>{draft.targetKey=targets.value;update();});
  confirm.addEventListener('click',()=>{
    const current=kit.getView(),choice=descriptor(current)?.choices.find(choice=>choice.effect===draft.effect),target=choice?.targets.find(target=>key(target)===draft.targetKey);
    const held=current?.self?.hand?.find(item=>item.id===cardId&&item.kind==='tool'&&item.toolType===toolType);
    dialog.close();
    if(current?.code!==code||current.selfId!==selfId||current.turn?.number!==turnNumber||current.status!=='playing'||current.turn?.playerId!==current.selfId||current.turn?.phase!=='play'||current.self.spectator||current.players.find(player=>player.id===current.selfId)?.eliminated||kit.busy||current.pendingVote||current.pendingBattle||!held||!enabled(choice)||!target)return;
    kit.action('useTool',{cardId,effect:choice.effect,targetId:target.targetId,...(choice.targeting==='trainer'?{}:{slot:target.slot})});
  });
  const cancel=node('button',{type:'button',class:'button secondary',id:'cancel-tool',onclick:()=>dialog.close()},say(language,'Cancel','取消'));
  dialog.append(node('label',{class:'attack-target',for:'tool-effect'},node('strong',{},say(language,'Effect','效果')),effects),
    node('label',{class:'attack-target',for:'tool-target'},node('strong',{},say(language,'Target','目标')),targets),
    node('p',{class:'muted'},say(language,'Choose only one half. Confirming consumes this entire physical card, including its other half.','只能选择其中一种道具。确认后消耗整张实体牌，另一半也会一同离开你的手牌。')),
    node('div',{class:'action-row'},cancel,confirm));
  populateTargets();dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();effects.focus();
}
export function vitalSpiritDialog(kit) {
  const initial=kit.getView(),language=kit.language,turnNumber=initial.turn?.number;
  const dialog=node('dialog',{class:'info-dialog confirmation-dialog','aria-labelledby':'vital-spirit-title'},
    node('h2',{id:'vital-spirit-title'},say(language,'Vital Spirit · replace Draw','干劲 · 替代摸牌阶段')),
    node('p',{},say(language,'Before drawing normally, you may replace your entire ordinary Draw phase: privately view up to 3 top cards, take 2, and return the rest to the top. If fewer than 2 cards are available, take all available cards.','正常摸牌前，可以替代整个通常摸牌阶段：私下观看牌堆顶至多3张牌，获得其中2张，其余放回牌堆顶。可用牌不足2张时，获得全部可用牌。')),
    node('p',{class:'muted'},say(language,'Vital Spirit still takes 2 cards when Flinch reduces your ordinary draw. After viewing, you must complete the card choice. Canceling here leaves ordinary Draw available.','即使畏缩令通常摸牌数减少，干劲仍选择2张牌。观看后必须完成选牌。此处取消则仍可正常摸牌。')));
  const cancel=node('button',{type:'button',class:'button secondary',onclick:()=>dialog.close()},say(language,'Keep ordinary Draw','保留通常摸牌'));
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-vital-spirit',disabled:kit.busy||Boolean(initial.pendingVote),onclick:()=>{
    const current=kit.getView();dialog.close();
    if(current.code===initial.code&&current.selfId===initial.selfId&&current.turn?.number===turnNumber&&current.self.battle?.canTrait&&current.self.battle.trait?.kind==='vital-spirit'&&!kit.busy&&!current.pendingVote)kit.action('useTrait');
  }},say(language,'Replace Draw · view cards','替代摸牌 · 观看牌'));
  dialog.append(node('div',{class:'action-row'},cancel,confirm));dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();cancel.focus();
}
export function downloadDialog(kit) {
  const initial=kit.getView(),language=kit.language,turnNumber=initial.turn?.number;
  const dialog=node('dialog',{class:'info-dialog confirmation-dialog','aria-labelledby':'download-title'},
    node('h2',{id:'download-title'},say(language,'Download · replace Draw','下载 · 替代摸牌阶段')),
    node('p',{},say(language,'Before drawing normally, you may replace your entire ordinary Draw phase by taking one hand card from each of up to two other trainers. Other trainers’ card faces stay hidden while you choose.','正常摸牌前，可以替代整个通常摸牌阶段，获得至多两名其他训练家的各一张手牌。选择时，其他训练家的手牌保持背面。')),
    node('p',{class:'muted'},say(language,'Confirming uses Download instead of your ordinary draws. Canceling here keeps ordinary Draw available.','确认后发动下载，替代通常摸牌。此处取消则仍可正常摸牌。')));
  const cancel=node('button',{type:'button',class:'button secondary',onclick:()=>dialog.close()},say(language,'Keep ordinary Draw','保留通常摸牌'));
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-download',disabled:kit.busy||Boolean(initial.pendingVote),onclick:()=>{
    const current=kit.getView();dialog.close();
    if(current.code===initial.code&&current.selfId===initial.selfId&&current.turn?.number===turnNumber&&current.self.battle?.canTrait&&current.self.battle.trait?.kind==='download'&&!kit.busy&&!current.pendingVote)kit.action('useTrait');
  }},say(language,'Replace Draw · choose trainers','替代摸牌 · 选择训练家'));
  dialog.append(node('div',{class:'action-row'},cancel,confirm));dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();cancel.focus();
}
export function attackDialog(card, kit, moveIndex=0) {
  const initial = kit.getView(), battle = initial.self.battle, choice=battle.moves?.[moveIndex], legal=choice?{move:choice,legalTargetIds:choice.legalTargetIds}:battle, turnNumber = initial.turn.number,code=initial.code,selfId=initial.selfId;
  const language = kit.language, selected = new Set();
  const dialog = node('dialog', {class:'info-dialog confirmation-dialog'},
    node('h2', {}, say(language,'Choose move targets','选择招式目标')),
    node('p', {}, `${kit.localized(legal.move.name)} · ${say(language,'Choose up to','最多选择')} ${legal.move.maxTargets}`));
  const confirm = node('button', {type:'button',class:'button primary',disabled:true},say(language,'Commit move','确认招式'));
  let boostCardId='',effectChoice=legal.move.effectKind==='moonlight'?'heal':undefined;
  for (const id of legal.legalTargetIds) {
    const player = initial.players.find(p => p.id === id);
    const input = node('input',{type:legal.move.maxTargets === 1?'radio':'checkbox',name:'attack-target',value:id});
    input.addEventListener('change', () => {
      if (legal.move.maxTargets === 1) selected.clear();
      if (input.checked) selected.add(id); else selected.delete(id);
      confirm.disabled = kit.busy||Boolean(kit.getView().pendingVote)||selected.size < 1 || selected.size > legal.move.maxTargets;
    });
    dialog.append(node('label',{class:'attack-target check-label'},input,legal.move.targeting==='trainer'?player.nickname:`${player.nickname} · ${kit.partnerName(player.active.catalogueId,player.active.level)} · ${player.active.hp}/${player.active.maxHp} HP`));
  }
  dialog.append(node('p',{class:'muted'},legal.move.condition?.kind==='weather-card'?say(language,'Committing discards this hand card to meet the move’s weather requirement. The selected trainer gets a response window.','确认后弃置这张手牌以满足招式的天气要求，所选目标的训练家将获得响应机会。'):say(language,'Committing spends this command card. The selected trainer gets a response window.','确认后消耗这张指令牌，所选目标的训练家将获得响应机会。')));
  if(legal.move.effectKind==='moonlight') {
    const selector=node('select',{'aria-label':say(language,'Moonlight effect','月光效果')},node('option',{value:'heal'},say(language,'Restore 2 HP','回复2点体力')),node('option',{value:'cure'},say(language,'Clear special status','恢复特殊状态')));
    selector.addEventListener('change',()=>{effectChoice=selector.value;});
    dialog.append(node('label',{class:'attack-target'},node('strong',{},say(language,'Choose Moonlight effect','选择月光效果')),selector));
  }
  if(legal.move.effectKind==='hyper-beam') {
    const hasMoxie=initial.players.find(player=>player.id===initial.selfId)?.active?.catalogueId==='magikarp';
    const selector=node('select',{'aria-label':say(language,'Optional Hyper Beam discard','破坏光线可选弃牌')},node('option',{value:''},say(language,'Do not boost','不追加弃牌')));
    for(const option of initial.self.hand.filter(item=>item.id!==card.id))selector.append(node('option',{value:option.id},`${kit.localized(option.name)} · ${weatherLabel(option.weather,language)}`));
    selector.addEventListener('change',()=>{boostCardId=selector.value;});
    dialog.append(node('label',{class:'attack-target'},node('strong',{},say(language,'Hyper Beam declaration','破坏光线声明')),selector),node('p',{class:'muted'},hasMoxie?say(language,'Optionally discard one different hand card now for +1 damage. Moxie draws only after this choice.','现在可以额外弃置一张不同的手牌，使伤害+1；自信过度在此选择之后才摸牌。'):say(language,'Optionally discard one different hand card now for +1 damage. Burn and other damage modifiers still apply.','现在可以额外弃置一张不同的手牌，使伤害+1。灼伤及其他伤害修正仍然生效。')));
  }
  if(legal.move.effectKind==='x-scissor') {
    const active=initial.players.find(player=>player.id===initial.selfId)?.active;
    if(active?.reinforcements?.includes('power')) {
      const selector=node('select',{id:'x-scissor-payment','aria-label':say(language,'Optional X-Scissor Power payment','十字剪可选力量强化支付')},
        node('option',{value:''},say(language,'Standard Dodge requirement','通常躲闪条件')),
        node('option',{value:'double-dodge'},say(language,'Discard 1 Power · require 2 Dodges','弃置1枚力量强化 · 需要2张快躲开！')));
      selector.addEventListener('change',()=>{effectChoice=selector.value||undefined;});
      dialog.append(node('label',{class:'attack-target'},node('strong',{},say(language,'X-Scissor declaration','十字剪声明')),selector));
    }
    dialog.append(node('p',{class:'muted'},say(language,'Remaining effective Power markers increase this move’s damage. You may discard one physical Power marker on declaration to require two Dodges in this settlement. Under Paralysis, markers give no damage bonus but can still pay this cost.','其余生效的力量强化增加此招式伤害。声明时可弃置一枚实际持有的力量强化，使本次结算需要两张快躲开！。麻痹时强化不提供伤害加成，但仍可支付此费用。')));
  }
  if(legal.move.cannotDodge)dialog.append(node('p',{class:'muted'},say(language,'Reinforcement markers do not affect this move. Dodge cannot cancel it.','此招式不受强化指示物影响，且不可被快躲开！抵消。')));
  const cancel = node('button',{type:'button',class:'button secondary',onclick:()=>dialog.close()},say(language,'Cancel','取消'));
  confirm.addEventListener('click', () => {
    const current = kit.getView(),currentChoice=current.self.battle?.moves?.[moveIndex],currentMove=currentChoice||current.self.battle?.move,currentTargets=currentChoice?.legalTargetIds||current.self.battle?.legalTargetIds||[];
    dialog.close();
    if (current.code !== code || current.selfId!==selfId || current.turn?.number !== turnNumber || !(currentChoice?.canUse??current.self.battle?.canCommand) || !current.self.hand.some(c=>c.id===card.id)||!currentMove||selected.size<1||selected.size>currentMove.maxTargets||[...selected].some(id=>!currentTargets.includes(id))||kit.busy||current.pendingVote||current.pendingBattle) return;
    kit.action('attack',{cardId:card.id,targetIds:[...selected],...(moveIndex?{moveIndex}:{}),...(boostCardId?{boostCardId}:{}),...(effectChoice?{effectChoice}:{})});
  });
  dialog.append(node('div',{class:'action-row'},cancel,confirm));
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  document.body.append(dialog); dialog.showModal(); cancel.focus();
}
export function equipItemDialog(card,kit) {
  const initial=kit.getView(),language=kit.language,turn=initial.turn.number;
  const equipment=initial.self.battle?.equipItems?.find(item=>item.itemType===card.itemType);
  if(!equipment)return;
  const active=initial.players.find(p=>p.id===initial.selfId).active;
  const dialog=node('dialog',{class:'info-dialog confirmation-dialog','aria-labelledby':'equip-title'},
    node('h2',{id:'equip-title'},say(language,'Equip item','携带持有物'),` · ${kit.localized(card.name)}`),
    node('p',{},kit.localized(equipment.description)),
    node('p',{class:'muted'},say(language,'Held items take effect while the holder is active.','持有物在携带者出战时生效。')));
  let selected=null;
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-equip',disabled:true},say(language,'Equip item','携带持有物'));
  for(const slot of initial.self.battle.equipSlots) {
    const pokemon=slot==='active'?active:initial.self.reserve;
    const input=node('input',{type:'radio',name:'equip-slot',value:slot});
    input.addEventListener('change',()=>{selected=slot;confirm.disabled=false;});
    dialog.append(node('label',{class:'check-label attack-target'},input,`${say(language,slot==='active'?'Active':'Reserve',slot==='active'?'出场':'备战')} · ${kit.partnerName(pokemon.catalogueId,pokemon.level)}${pokemon.item?` · ${say(language,'replaces current item','替换现有持有物')}`:''}`));
  }
  dialog.append(node('p',{class:'muted'},say(language,'Confirming moves this card from your hand to the chosen Pokémon. An existing item is discarded.','确认后将此牌从手牌移至所选宝可梦区；原有持有物将被弃置。')));
  const cancel=node('button',{type:'button',class:'button secondary',onclick:()=>dialog.close()},say(language,'Cancel','取消'));
  confirm.addEventListener('click',()=>{
    dialog.close();
    const current=kit.getView();
    if(current?.code===initial.code&&current.selfId===initial.selfId&&current.turn?.number===turn&&!kit.busy&&
      current.self.battle?.canEquip&&current.self.battle.equipSlots.includes(selected)&&
      current.self.hand.some(held=>held.id===card.id&&held.kind==='held-item'&&held.itemType===card.itemType)) {
      kit.action('equipItem',{cardId:card.id,slot:selected});
    }
  });
  dialog.append(node('div',{class:'action-row'},cancel,confirm));dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();cancel.focus();
}
export function recklessDialog(kit) {
  const initial=kit.getView(),language=kit.language,turn=initial.turn.number,pokemon=initial.players.find(player=>player.id===initial.selfId).active;
  const dialog=node('dialog',{class:'info-dialog confirmation-dialog','aria-labelledby':'reckless-title'},node('h2',{id:'reckless-title'},say(language,'Reckless · trade HP for cards','舍身 · 失去体力并摸牌')),
    node('p',{},say(language,`Current HP: ${pokemon.hp}/${pokemon.maxHp}. Choose HP to lose, then draw that many cards. This uses Reckless once this Play phase.`,`当前体力：${pokemon.hp}/${pokemon.maxHp}。选择失去的体力，然后摸取等量的牌。本出牌阶段此宝可梦的舍身限一次。`)));
  const input=node('input',{type:'number',id:'reckless-hp-loss',min:'0',max:String(initial.self.battle.trait.maxHpLoss),step:'1',value:'1','aria-label':say(language,'HP to lose','失去体力点数')});
  const consequence=node('p',{class:'muted','aria-live':'polite'}),confirm=node('button',{type:'button',class:'button primary',id:'confirm-reckless'},say(language,'Lose HP and draw','失去体力并摸牌'));
  const update=()=>{
    const loss=input.valueAsNumber,valid=Number.isSafeInteger(loss)&&loss>=0&&loss<=initial.self.battle.trait.maxHpLoss;
    confirm.disabled=!valid;
    consequence.textContent=!valid?say(language,'Enter a nonnegative whole number.','请输入非负整数。'):loss>=pokemon.hp?say(language,'This will cause fainting and rescue before drawing. With no rescue, your reserve must deploy; if you leave the game, you draw no cards.','这将先进入昏厥救援。未获救时备战宝可梦登场；若你退场，则不再摸牌。'):say(language,`After this choice: ${pokemon.hp-loss} HP. Only available real cards can be drawn. Choosing zero still uses this ability.`,`选择后剩余体力：${pokemon.hp-loss}。仅摸取实际可用的牌。选择零点仍消耗本次特性。`);
  };
  input.addEventListener('input',update);
  const cancel=node('button',{type:'button',class:'button secondary',onclick:()=>dialog.close()},say(language,'Cancel','取消'));
  confirm.addEventListener('click',()=>{
    const loss=input.valueAsNumber,current=kit.getView();
    if(!Number.isSafeInteger(loss)||loss<0||loss>initial.self.battle.trait.maxHpLoss)return;
    dialog.close();
    if(current.code===initial.code&&current.turn?.number===turn&&current.self.battle?.canTrait&&current.self.battle.trait?.kind==='reckless'&&current.players.find(player=>player.id===current.selfId)?.active.catalogueId===pokemon.catalogueId)kit.action('useTrait',{hpLoss:loss});
  });
  dialog.append(node('label',{class:'attack-target'},node('strong',{},say(language,'HP to lose','失去体力点数')),input),consequence,node('div',{class:'action-row'},cancel,confirm));
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});update();document.body.append(dialog);dialog.showModal();input.focus();
}
export function analyticDialog(kit) {
  const initial=kit.getView(),language=kit.language,turn=initial.turn.number,max=initial.self.battle.trait.maxCards,selected=new Set();
  const dialog=node('dialog',{class:'info-dialog confirmation-dialog analytic-dialog','aria-labelledby':'analytic-title'},node('h2',{id:'analytic-title'},say(language,'Analytic · exchange hand cards','分析 · 更换手牌')),
    node('p',{},say(language,`Choose up to ${max} hand cards, limited by your Pokémon’s current HP. Discard them, then draw the same number.`,`选择至多${max}张手牌，上限按宝可梦当前体力计算。先弃置，再摸取等量的牌。`)));
  const cards=node('fieldset',{class:'gift-card-list'},node('legend',{},say(language,'Choose your cards','选择你的手牌')));
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-analytic'},say(language,'Confirm exchange','确认更换'));
  const update=()=>{confirm.disabled=selected.size>max||kit.busy||Boolean(kit.getView().pendingVote);confirm.textContent=`${say(language,'Exchange','更换')} (${selected.size} / ${max})`;};
  for(const card of initial.self.hand) {
    const input=node('input',{type:'checkbox',name:'analytic-card',value:card.id});
    input.addEventListener('change',()=>{if(input.checked)selected.add(card.id);else selected.delete(card.id);update();});
    cards.append(node('label',{class:'check-label gift-card-option'},input,node('span',{},node('strong',{},kit.localized(card.name)),node('small',{},weatherLabel(card.weather,language)))));
  }
  const cancel=node('button',{type:'button',class:'button secondary',onclick:()=>dialog.close()},say(language,'Cancel','取消'));
  confirm.addEventListener('click',()=>{
    dialog.close();const current=kit.getView();
    if(current.code===initial.code&&current.turn?.number===turn&&current.self.battle?.canTrait&&current.self.battle.trait?.kind==='analytic'&&[...selected].every(id=>current.self.hand.some(card=>card.id===id)))kit.action('useTrait',{cardIds:[...selected]});
  });
  dialog.append(cards,node('p',{class:'muted'},say(language,'Confirming uses Analytic for this Pokémon this play phase, even if you choose zero cards.','确认会消耗此宝可梦本出牌阶段的分析次数，即使选择零张牌。')),node('div',{class:'action-row'},cancel,confirm));
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});update();document.body.append(dialog);dialog.showModal();cancel.focus();
}

export function giftCardsDialog(kit) {
  const initial=kit.getView(),legal=initial.self.battle,turnNumber=initial.turn.number,language=kit.language;
  const selected=new Set(),targets=new Set(),targetInputs=[];
  const dialog=node('dialog',{class:'info-dialog confirmation-dialog gift-dialog','aria-labelledby':'gift-title'},
    node('h2',{id:'gift-title'},say(language,'Justified · give cards','正义之心 · 交给手牌')),
    node('p',{},say(language,'Once during your play phase, give one or more hand cards to one other trainer.','你的出牌阶段限一次，将一张或多张手牌交给另一名训练家。')));
  const cards=node('fieldset',{class:'gift-card-list'},node('legend',{},say(language,'Choose your cards','选择你的手牌')));
  const recipient=node('select',{id:'gift-recipient'},node('option',{value:''},say(language,'Choose a trainer','选择训练家')));
  for(const id of legal.giveRecipientIds)recipient.append(node('option',{value:id},initial.players.find(p=>p.id===id).nickname));
  const targetSection=node('fieldset',{class:'gift-targets'},node('legend',{},say(language,'Your all-hand gift uses a move','交出全部手牌后使用招式')),
    node('p',{},`${kit.localized(legal.move.name)} · ${say(language,'Choose up to','最多选择')} ${legal.move.maxTargets}`));
  for(const id of legal.legalTargetIds) {
    const p=initial.players.find(p=>p.id===id),input=node('input',{type:legal.move.maxTargets===1?'radio':'checkbox',name:'gift-target',value:id});
    input.addEventListener('change',()=>{if(legal.move.maxTargets===1)targets.clear();if(input.checked)targets.add(id);else targets.delete(id);update();});
    targetInputs.push(input);targetSection.append(node('label',{class:'check-label'},input,`${p.nickname} · ${kit.partnerName(p.active.catalogueId,p.active.level)} · ${p.active.hp}/${p.active.maxHp} HP`));
  }
  const hint=node('p',{class:'gift-hint','aria-live':'polite'});
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-gift',disabled:true},say(language,'Confirm gift','确认交给'));
  function update() {
    const all=selected.size===initial.self.hand.length;
    targetSection.hidden=!all||!legal.giveCommandAvailable;
    if(!all){targets.clear();targetInputs.forEach(input=>input.checked=false);}
    hint.textContent=all?(legal.giveCommandAvailable?say(language,'Giving your entire hand also commits this command move. Choose its targets before confirming.','交出全部手牌同时确认使用此指令招式，请先选择目标。'):say(language,'The command move is unavailable. Keep at least one card to make a partial gift.','当前无法使用指令招式，请保留至少一张手牌以交给部分手牌。')):say(language,'A partial gift does not use a move. The selected cards become the recipient’s private hand.','交给部分手牌不会使用招式，所选牌将进入接收者的私密手牌。');
    confirm.disabled=kit.busy||Boolean(initial.pendingVote)||selected.size===0||!recipient.value||(all&&(!legal.giveCommandAvailable||targets.size<1||targets.size>legal.move.maxTargets));
  }
  for(const card of initial.self.hand) {
    const input=node('input',{type:'checkbox',name:'gift-card',value:card.id});
    input.addEventListener('change',()=>{if(input.checked)selected.add(card.id);else selected.delete(card.id);update();});
    cards.append(node('label',{class:'check-label gift-card-option'},input,node('span',{},node('strong',{},kit.localized(card.name)),node('small',{},weatherLabel(card.weather,language)))));
  }
  recipient.addEventListener('change',update);
  const cancel=node('button',{type:'button',class:'button secondary',onclick:()=>dialog.close()},say(language,'Cancel','取消'));
  confirm.addEventListener('click',()=>{
    const current=kit.getView(),all=selected.size===initial.self.hand.length;
    dialog.close();
    if(current.code!==initial.code||current.turn?.number!==turnNumber||!current.self.battle?.canGive||!current.self.hand.every(card=>initial.self.hand.some(old=>old.id===card.id))||current.self.hand.length!==initial.self.hand.length)return;
    kit.action('giveCards',{cardIds:[...selected],recipientId:recipient.value,...(all?{targetIds:[...targets]}:{})});
  });
  dialog.append(cards,node('label',{class:'field',for:'gift-recipient'},say(language,'Give to','交给'),recipient),hint,targetSection,
    node('p',{class:'muted'},say(language,'Confirming transfers the cards and uses Justified for this play phase.','确认后交给所选手牌，并消耗本出牌阶段的正义之心次数。')),
    node('div',{class:'action-row'},cancel,confirm));
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});update();
  document.body.append(dialog);dialog.showModal();cancel.focus();
}

export const weatherLabel=(value,language)=>({'intense-sun':say(language,'Intense sun','烈日'),clear:say(language,'Clear','晴朗'),rain:say(language,'Heavy rain','暴雨'),thunderstorm:say(language,'Thunderstorm','雷雨')}[value]||'');
let deckOrderDraft={id:null,order:[]};
let exileDraft={id:null,indices:[]};
let distributionDraft={id:null,recipients:{}};
const privateDecisionDrafts=new Map();
function privateDecisionDraft(pending,kit,create) {
  const view=kit.getView(),key=`${view.code}:${view.selfId}:${pending.kind}:${pending.id}`;
  if(!privateDecisionDrafts.has(key))privateDecisionDrafts.set(key,create());
  if(privateDecisionDrafts.size>16)privateDecisionDrafts.delete(privateDecisionDrafts.keys().next().value);
  return privateDecisionDrafts.get(key);
}
function distributionControls(pending,kit) {
  if(distributionDraft.id!==pending.id)distributionDraft={id:pending.id,recipients:{}};
  const language=kit.language,view=kit.getView(),cards=pending.cards||[],grid=node('div',{class:'distribution-grid'});
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-distribution'},say(language,'Distribute cards','分配牌'));
  const update=()=>{confirm.disabled=kit.busy||Boolean(view.pendingVote)||!cards.every(card=>pending.recipientIds.includes(distributionDraft.recipients[card.index]));};
  for(const card of cards) {
    const select=node('select',{id:`recipient-${card.index}`,'aria-label':say(language,`Recipient for card ${card.index+1}`,`第${card.index+1}张牌的接收者`),disabled:kit.busy||Boolean(view.pendingVote)},node('option',{value:''},say(language,'Choose a trainer','选择训练家')));
    for(const id of pending.recipientIds)select.append(node('option',{value:id},view.players.find(p=>p.id===id).nickname));
    select.value=distributionDraft.recipients[card.index]||'';
    select.addEventListener('change',()=>{distributionDraft.recipients[card.index]=select.value;update();});
    grid.append(node('label',{class:'distribution-card'},node('small',{},`${say(language,'Card','牌')} ${card.index+1}`),node('strong',{},kit.localized(card.name)),node('small',{},weatherLabel(card.weather,language)),select));
  }
  confirm.addEventListener('click',()=>kit.action('respondBattle',{decisionId:pending.id,choice:'distribute',allocations:cards.map(card=>({index:card.index,recipientId:distributionDraft.recipients[card.index]}))}));
  update();return [grid,node('div',{class:'action-row'},confirm)];
}
let charmDraft={id:null,cardId:'',targetId:''};
const paidEffectDrafts=new Map();
function paidEffectControls(pending,kit) {
  if(!paidEffectDrafts.has(pending.id))paidEffectDrafts.set(pending.id,{cardId:'',targetId:''});
  const paidEffectDraft=paidEffectDrafts.get(pending.id);
  if(paidEffectDrafts.size>16)paidEffectDrafts.delete(paidEffectDrafts.keys().next().value);
  const language=kit.language,view=kit.getView(),cards=pending.paymentCards||[],gas=pending.kind==='neutralizing-gas';
  const names={'battle-armor':['Battle Armor','战斗盔甲'],bonemerang:['Bonemerang','骨头回力镖'],'neutralizing-gas':['Neutralizing Gas','化学变化气体']},name=say(language,...names[pending.kind]);
  if(!cards.some(card=>card.id===paidEffectDraft.cardId))paidEffectDraft.cardId='';
  if(gas&&!pending.legalTargetIds.includes(paidEffectDraft.targetId))paidEffectDraft.targetId='';
  const payment=node('select',{'aria-label':`${name} ${say(language,'payment','弃牌')}`},node('option',{value:''},say(language,'Choose a hand card','选择一张手牌')));
  for(const card of cards)payment.append(node('option',{value:card.id},`${kit.localized(card.name)} · ${weatherLabel(card.weather,language)}`));
  payment.value=paidEffectDraft.cardId;
  const controls=node('div',{class:'charm-controls paid-effect-controls'},node('label',{},say(language,'Discard card','弃置手牌'),payment));
  let target;
  if(gas) {
    target=node('select',{'aria-label':say(language,'Suppress trainer traits','特性失效的训练家')},node('option',{value:''},say(language,'Choose a trainer','选择训练家')));
    for(const id of pending.legalTargetIds)target.append(node('option',{value:id},view.players.find(p=>p.id===id).nickname));
    target.value=paidEffectDraft.targetId;
    controls.append(node('label',{},say(language,'Trainer','训练家'),target));
    target.addEventListener('change',()=>{paidEffectDraft.targetId=target.value;update();});
  }
  const choice=gas?'suppress':pending.kind==='bonemerang'?'repeat':'armor';
  const label=gas?['Discard and suppress','弃牌并令特性失效']:pending.kind==='bonemerang'?['Discard and repeat','弃牌并再次结算']:['Discard and gain Defense','弃牌并获得防御强化'];
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-paid-effect',onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice,cardId:paidEffectDraft.cardId,...(gas?{targetId:paidEffectDraft.targetId}:{})})},say(language,...label));
  const update=()=>{confirm.disabled=kit.busy||Boolean(kit.getView().pendingVote)||!paidEffectDraft.cardId||(gas&&!paidEffectDraft.targetId);};
  payment.addEventListener('change',()=>{paidEffectDraft.cardId=payment.value;update();});
  const pass=node('button',{type:'button',class:'button secondary',id:'response-pass',disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'pass'})},say(language,'Pass effect','放弃本次效果'));
  update();return [controls,node('div',{class:'action-row'},confirm,pass)];
}
function charmControls(pending,kit) {
  if(charmDraft.id!==pending.id)charmDraft={id:pending.id,cardId:'',targetId:''};
  const language=kit.language,cards=pending.paymentCards||[],view=kit.getView();
  if(!cards.some(card=>card.id===charmDraft.cardId))charmDraft.cardId='';
  if(!pending.legalTargetIds.includes(charmDraft.targetId))charmDraft.targetId='';
  const payment=node('select',{'aria-label':say(language,'Cute Charm payment','迷人之躯弃牌')},node('option',{value:''},say(language,'Choose an intense-sun card','选择一张烈日手牌')));
  for(const card of cards)payment.append(node('option',{value:card.id},`${kit.localized(card.name)} · ${weatherLabel(card.weather,language)}`));
  payment.value=charmDraft.cardId;
  const target=node('select',{'aria-label':say(language,'Redirect target','转移目标')},node('option',{value:''},say(language,'Choose a new target','选择新的目标')));
  for(const id of pending.legalTargetIds){const player=view.players.find(player=>player.id===id);target.append(node('option',{value:id},`${player.nickname} · ${kit.partnerName(player.active.catalogueId,player.active.level)}`));}
  target.value=charmDraft.targetId;
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-charm'},say(language,'Discard and redirect','弃牌并转移'));
  const update=()=>{confirm.disabled=kit.busy||Boolean(kit.getView().pendingVote)||!charmDraft.cardId||!charmDraft.targetId;};
  payment.addEventListener('change',()=>{charmDraft.cardId=payment.value;update();});target.addEventListener('change',()=>{charmDraft.targetId=target.value;update();});
  confirm.addEventListener('click',()=>kit.action('respondBattle',{decisionId:pending.id,choice:'redirect',cardId:charmDraft.cardId,targetId:charmDraft.targetId}));
  const pass=node('button',{type:'button',class:'button secondary',id:'response-pass',disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'pass'})},say(language,'Keep the target','不转移目标'));
  update();return [node('div',{class:'charm-controls'},node('label',{},say(language,'Discard card','弃置手牌'),payment),node('label',{},say(language,'New target','新目标'),target)),node('div',{class:'action-row'},confirm,pass)];
}
let shedDraft={id:null,cardIds:[]};
function shedControls(pending,kit) {
  if(shedDraft.id!==pending.id)shedDraft={id:pending.id,cardIds:[]};
  const cards=pending.cards||[],language=kit.language,buttons=[],grid=node('div',{class:'shed-card-grid'});
  shedDraft.cardIds=shedDraft.cardIds.filter(id=>cards.some(card=>card.id===id));
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-shed'});
  const update=()=>{
    const blocked=kit.busy||Boolean(kit.getView().pendingVote);
    for(const [card,button] of buttons){button.setAttribute('aria-pressed',String(shedDraft.cardIds.includes(card.id)));button.disabled=blocked;}
    confirm.disabled=blocked;confirm.textContent=say(language,`Discard ${shedDraft.cardIds.length} · damage ${Math.max(0,pending.damage-shedDraft.cardIds.length)}`,`弃置${shedDraft.cardIds.length}张 · 伤害${Math.max(0,pending.damage-shedDraft.cardIds.length)}`);
  };
  for(const card of cards) {
    const button=node('button',{type:'button',class:'button shed-card-choice',id:`shed-card-${card.id}`,'aria-pressed':'false',onclick:()=>{const index=shedDraft.cardIds.indexOf(card.id);if(index>=0)shedDraft.cardIds.splice(index,1);else shedDraft.cardIds.push(card.id);update();}},`${kit.localized(card.name)} · ${weatherLabel(card.weather,language)}`);
    buttons.push([card,button]);grid.append(button);
  }
  confirm.addEventListener('click',()=>kit.action('respondBattle',{decisionId:pending.id,choice:'shed',cardIds:[...shedDraft.cardIds]}));
  const pass=node('button',{type:'button',class:'button secondary',id:'response-pass',disabled:kit.busy||Boolean(kit.getView().pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'pass'})},say(language,'Keep hand · take damage','保留手牌 · 承受伤害'));
  update();return [grid,node('div',{class:'action-row'},confirm,pass)];
}
function blunderPolicyControls(pending,kit,view) {
  const {language}=kit;
  const draft=privateDecisionDraft(pending,kit,()=>({cardIds:[]}));
  const cards=pending.paymentCards||[];
  draft.cardIds=draft.cardIds.filter(id=>cards.some(card=>card.id===id));
  const grid=node('div',{class:'shed-card-grid'}),buttons=[];
  const currentDecision=()=>{
    const current=kit.getView(),decision=current?.pendingBattle;
    return current?.code===view.code&&current.selfId===view.selfId&&!kit.busy&&!current.pendingVote&&
      decision?.id===pending.id&&decision.kind==='blunder-policy'&&decision.actorId===view.selfId?decision:null;
  };
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-blunder-policy',onclick:()=>{
    const current=currentDecision();
    if(draft.cardIds.length===2&&draft.cardIds.every(id=>current?.paymentCards?.some(card=>card.id===id))) {
      kit.action('respondBattle',{decisionId:pending.id,choice:'discard',cardIds:[...draft.cardIds]});
    }
  }});
  const update=()=>{
    const blocked=!currentDecision();
    for(const [id,button] of buttons) {
      const selected=draft.cardIds.includes(id);
      button.setAttribute('aria-pressed',String(selected));
      button.disabled=blocked||(!selected&&draft.cardIds.length===2);
    }
    confirm.disabled=blocked||draft.cardIds.length!==2;
    confirm.textContent=say(language,`Discard and resolve (${draft.cardIds.length}/2)`,`弃置并结算（${draft.cardIds.length}/2）`);
  };
  for(const card of cards) {
    const button=node('button',{type:'button',class:'button shed-card-choice',id:`blunder-card-${card.id}`,onclick:()=>{
      if(!currentDecision())return;
      if(draft.cardIds.includes(card.id))draft.cardIds=draft.cardIds.filter(id=>id!==card.id);
      else if(draft.cardIds.length<2)draft.cardIds.push(card.id);
      update();
    }},`${kit.localized(card.name)} · ${weatherLabel(card.weather,language)}`);
    buttons.push([card.id,button]);grid.append(button);
  }
  const pass=node('button',{type:'button',class:'button secondary',id:'response-pass',disabled:!currentDecision(),onclick:()=>{
    if(currentDecision())kit.action('respondBattle',{decisionId:pending.id,choice:'pass'});
  }},say(language,'Accept the Dodge','接受躲闪结果'));
  update();
  return [grid,node('div',{class:'action-row'},confirm,pass)];
}
function exileControls(pending,kit) {
  if(exileDraft.id!==pending.id)exileDraft={id:pending.id,indices:[]};
  const language=kit.language,grid=node('div',{class:'hand-choice-grid'}),buttons=[];
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-exile'},say(language,'Remove selected cards','移出所选牌'));
  const update=()=>{
    const blocked=kit.busy||Boolean(kit.getView().pendingVote);
    for(const [index,button] of buttons) {
      const selected=exileDraft.indices.includes(index);
      button.setAttribute('aria-pressed',String(selected));button.disabled=blocked||(!selected&&exileDraft.indices.length>=pending.maxCards);
    }
    confirm.disabled=blocked;
    confirm.textContent=`${say(language,'Remove selected cards','移出所选牌')} (${exileDraft.indices.length} / ${pending.maxCards})`;
  };
  for(const choice of pending.choices||[]) {
    const label=choice.name?`${kit.localized(choice.name)} · ${weatherLabel(choice.weather,language)}`:say(language,`Face-down card ${choice.index+1}`,`背面手牌 ${choice.index+1}`);
    const button=node('button',{type:'button',class:'button exile-card-choice',id:`exile-card-${choice.index}`,'aria-pressed':'false',onclick:()=>{
      const index=exileDraft.indices.indexOf(choice.index);
      if(index>=0)exileDraft.indices.splice(index,1);else if(exileDraft.indices.length<pending.maxCards)exileDraft.indices.push(choice.index);
      update();
    }},label);buttons.push([choice.index,button]);grid.append(button);
  }
  confirm.addEventListener('click',()=>kit.action('respondBattle',{decisionId:pending.id,choice:'exile',handIndices:[...exileDraft.indices]}));
  const pass=node('button',{type:'button',class:'button secondary',id:'response-pass',disabled:kit.busy||Boolean(kit.getView().pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'pass'})},say(language,'Leave hand unchanged','不移出手牌'));
  update();return [grid,node('div',{class:'action-row'},confirm,pass)];
}
function deckOrderControls(pending,kit) {
  if(deckOrderDraft.id!==pending.id)deckOrderDraft={id:pending.id,order:[]};
  const cards=pending.cards||[],language=kit.language,grid=node('div',{class:'deck-order-grid'}),buttons=[];
  const confirm=node('button',{type:'button',class:'button primary',id:'response-order',disabled:true},say(language,'Confirm deck order','确认牌堆顺序'));
  const update=()=>{
    for(const [card,button,badge] of buttons) {
      const index=deckOrderDraft.order.indexOf(card.index);
      button.setAttribute('aria-pressed',String(index>=0));badge.textContent=index<0?'—':String(index+1);
    }
    confirm.disabled=kit.busy||Boolean(pendingVote)||deckOrderDraft.order.length!==cards.length;
  };
  const pendingVote=kit.getView().pendingVote;
  for(const card of cards) {
    const badge=node('span',{class:'order-sequence','aria-hidden':'true'},'—');
    const button=node('button',{type:'button',class:'deck-order-card',id:`order-card-${card.index}`,'aria-pressed':'false',disabled:kit.busy||Boolean(pendingVote),onclick:()=>{
      const index=deckOrderDraft.order.indexOf(card.index);
      deckOrderDraft.order=index<0?[...deckOrderDraft.order,card.index]:deckOrderDraft.order.filter(value=>value!==card.index);update();
    }},badge,node('strong',{},kit.localized(card.name)),node('small',{},weatherLabel(card.weather,language)));
    buttons.push([card,button,badge]);grid.append(button);
  }
  confirm.addEventListener('click',()=>kit.action('respondBattle',{decisionId:pending.id,choice:'order',order:[...deckOrderDraft.order]}));
  const clear=node('button',{type:'button',class:'button secondary',id:'clear-order',disabled:kit.busy||Boolean(pendingVote),onclick:()=>{deckOrderDraft.order=[];update();}},say(language,'Clear order','清空顺序'));
  update();return [grid,node('div',{class:'action-row'},confirm,clear)];
}
function forewarnOrderControls(pending,kit) {
  const draft=privateDecisionDraft(pending,kit,()=>({topOrder:[],bottomOrder:[],destination:'top'}));
  const cards=pending.cards||[],language=kit.language,indices=new Set(cards.map(card=>card.index));
  draft.topOrder=draft.topOrder.filter(index=>indices.has(index));
  draft.bottomOrder=draft.bottomOrder.filter(index=>indices.has(index)&&!draft.topOrder.includes(index));
  const destination=node('fieldset',{class:'action-row forewarn-destination'},node('legend',{},say(language,'Place clicked cards on','点击牌后放到')));
  for(const value of ['top','bottom']) {
    const input=node('input',{type:'radio',name:`forewarn-destination-${pending.id}`,value,disabled:kit.busy||Boolean(kit.getView().pendingVote)});
    input.checked=draft.destination===value;
    input.addEventListener('change',()=>{if(input.checked)draft.destination=value;});
    destination.append(node('label',{class:'check-label'},input,say(language,value==='top'?'Top of deck':'Bottom of deck',value==='top'?'牌堆顶':'牌堆底')));
  }
  const grid=node('div',{class:'deck-order-grid forewarn-grid'}),buttons=[];
  const summary=node('p',{'aria-live':'polite',class:'muted'});
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-forewarn-order'},say(language,'Confirm top and bottom order','确认牌堆顶与底顺序'));
  const update=()=>{
    const blocked=kit.busy||Boolean(kit.getView().pendingVote);
    for(const [card,button,badge] of buttons) {
      const top=draft.topOrder.indexOf(card.index),bottom=draft.bottomOrder.indexOf(card.index),placed=top>=0||bottom>=0;
      const position=top>=0?say(language,`Top ${top+1}`,`堆顶第${top+1}张`):bottom>=0?say(language,`Bottom ${bottom+1}`,`堆底第${bottom+1}张`):say(language,'Unassigned','未放置');
      button.disabled=blocked;button.setAttribute('aria-pressed',String(placed));
      button.setAttribute('aria-label',`${kit.localized(card.name)} · ${weatherLabel(card.weather,language)} · ${position}`);
      badge.textContent=top>=0?`T${top+1}`:bottom>=0?`B${bottom+1}`:'—';
    }
    summary.textContent=say(language,`Top: ${draft.topOrder.length} · Bottom: ${draft.bottomOrder.length} · Unassigned: ${cards.length-draft.topOrder.length-draft.bottomOrder.length}`,`堆顶：${draft.topOrder.length}张 · 堆底：${draft.bottomOrder.length}张 · 未放置：${cards.length-draft.topOrder.length-draft.bottomOrder.length}张`);
    confirm.disabled=blocked||draft.topOrder.length+draft.bottomOrder.length!==cards.length;
  };
  for(const card of cards) {
    const badge=node('span',{class:'order-sequence','aria-hidden':'true'},'—');
    const button=node('button',{type:'button',class:'deck-order-card',id:`forewarn-card-${card.index}`,'aria-pressed':'false',onclick:()=>{
      const order=draft.destination==='top'?'topOrder':'bottomOrder',already=draft[order].includes(card.index);
      draft.topOrder=draft.topOrder.filter(index=>index!==card.index);draft.bottomOrder=draft.bottomOrder.filter(index=>index!==card.index);
      if(!already)draft[order].push(card.index);
      update();
    }},badge,node('strong',{},kit.localized(card.name)),node('small',{},weatherLabel(card.weather,language)));
    buttons.push([card,button,badge]);grid.append(button);
  }
  confirm.addEventListener('click',()=>kit.action('respondBattle',{decisionId:pending.id,choice:'order',topOrder:[...draft.topOrder],bottomOrder:[...draft.bottomOrder]}));
  const clear=node('button',{type:'button',class:'button secondary',id:'clear-forewarn-order',disabled:kit.busy||Boolean(kit.getView().pendingVote),onclick:()=>{draft.topOrder=[];draft.bottomOrder=[];update();}},say(language,'Clear placement','清空放置'));
  update();return [destination,node('p',{class:'muted'},say(language,'Choose a destination, then click cards in order. Click a card again at the same destination to unassign it; choose the other destination and click to move it. T1 is drawn next. B1 is drawn after the untouched middle of the deck. Every card must be placed; viewing cannot be canceled.','先选择放置位置，再依次点击牌。同一位置再次点击可取消放置；选择另一位置后点击可移动。T1最先摸取，B1在未查看的中间牌全部摸完后摸取。必须放置所有牌，观看后不可放弃。')),grid,summary,node('div',{class:'action-row'},confirm,clear)];
}
function sweetKissControls(pending,kit) {
  const draft=privateDecisionDraft(pending,kit,()=>({cardIds:[]})),cards=pending.cards||[],language=kit.language,required=pending.requiredCards;
  draft.cardIds=draft.cardIds.filter(id=>cards.some(card=>card.id===id));
  const grid=node('div',{class:'shed-card-grid'}),buttons=[];
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-sweet-kiss'});
  const update=()=>{
    const blocked=kit.busy||Boolean(kit.getView().pendingVote);
    for(const [card,button] of buttons) {
      const selected=draft.cardIds.includes(card.id);
      button.setAttribute('aria-pressed',String(selected));button.disabled=blocked||(!selected&&draft.cardIds.length>=required);
    }
    confirm.disabled=blocked||draft.cardIds.length!==required;
    confirm.textContent=say(language,`Discard selected (${draft.cardIds.length}/${required}), then draw 2`,`弃置所选牌（${draft.cardIds.length}/${required}），然后摸2张`);
  };
  for(const card of cards) {
    const button=node('button',{type:'button',class:'button shed-card-choice',id:`sweet-kiss-card-${card.id}`,'aria-pressed':'false',onclick:()=>{
      const index=draft.cardIds.indexOf(card.id);if(index>=0)draft.cardIds.splice(index,1);else if(draft.cardIds.length<required)draft.cardIds.push(card.id);update();
    }},`${kit.localized(card.name)} · ${weatherLabel(card.weather,language)}`);
    buttons.push([card,button]);grid.append(button);
  }
  confirm.addEventListener('click',()=>kit.action('respondBattle',{decisionId:pending.id,choice:'discard',cardIds:[...draft.cardIds]}));
  update();return [grid,node('div',{class:'action-row'},confirm)];
}
function vitalSpiritControls(pending,kit) {
  const draft=privateDecisionDraft(pending,kit,()=>({order:[]})),cards=pending.cards||[],language=kit.language,required=pending.requiredCards;
  draft.order=draft.order.filter(index=>cards.some(card=>card.index===index));
  const grid=node('div',{class:'deck-order-grid'}),buttons=[];
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-vital-spirit-cards'});
  const update=()=>{
    const blocked=kit.busy||Boolean(kit.getView().pendingVote);
    for(const [card,button,badge] of buttons) {
      const index=draft.order.indexOf(card.index),selected=index>=0;
      button.setAttribute('aria-pressed',String(selected));button.disabled=blocked||(!selected&&draft.order.length>=required);
      badge.textContent=selected?String(index+1):'—';
      button.setAttribute('aria-label',`${kit.localized(card.name)} · ${weatherLabel(card.weather,language)} · ${selected?say(language,`Gain ${index+1}`,`第${index+1}张获得`):say(language,'Not selected','未选择')}`);
    }
    confirm.disabled=blocked||draft.order.length!==required;
    confirm.textContent=say(language,`Gain selected cards (${draft.order.length}/${required})`,`获得所选牌（${draft.order.length}/${required}）`);
  };
  for(const card of cards) {
    const badge=node('span',{class:'order-sequence','aria-hidden':'true'},'—');
    const button=node('button',{type:'button',class:'deck-order-card',id:`vital-spirit-card-${card.index}`,'aria-pressed':'false',onclick:()=>{
      const index=draft.order.indexOf(card.index);if(index>=0)draft.order.splice(index,1);else if(draft.order.length<required)draft.order.push(card.index);update();
    }},badge,node('strong',{},kit.localized(card.name)),node('small',{},weatherLabel(card.weather,language)));
    buttons.push([card,button,badge]);grid.append(button);
  }
  confirm.addEventListener('click',()=>kit.action('respondBattle',{decisionId:pending.id,choice:'gain',order:[...draft.order]}));
  const clear=node('button',{type:'button',class:'button secondary',id:'clear-vital-spirit-cards',disabled:kit.busy||Boolean(kit.getView().pendingVote),onclick:()=>{draft.order=[];update();}},say(language,'Clear selection','清空选择'));
  update();return [grid,node('p',{class:'muted'},say(language,'Click cards in the order you want to gain them. Click a selected card again to deselect it. Unselected cards return to the top of the deck.','按希望获得的顺序点击牌。再次点击已选牌可取消选择。未选的牌放回牌堆顶。')),node('div',{class:'action-row'},confirm,clear)];
}
function downloadControls(pending,kit) {
  const draft=privateDecisionDraft(pending,kit,()=>({targetIds:[]})),view=kit.getView(),language=kit.language,legal=pending.legalTargetIds||[],max=pending.maxTargets??0;
  draft.targetIds=draft.targetIds.filter(id=>legal.includes(id)).slice(0,max);
  const grid=node('div',{class:'hand-choice-grid'}),buttons=[];
  const summary=node('p',{class:'muted','aria-live':'polite'});
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-download-targets'});
  const update=()=>{
    const blocked=kit.busy||Boolean(kit.getView().pendingVote);
    for(const [id,button] of buttons) {
      const selected=draft.targetIds.includes(id);
      button.setAttribute('aria-pressed',String(selected));button.disabled=blocked||(!selected&&draft.targetIds.length>=max);
    }
    summary.textContent=say(language,`Selected trainers: ${draft.targetIds.length}/${max}. Selecting none still replaces your whole Draw phase.`,`已选择训练家：${draft.targetIds.length}/${max}。即使不选择训练家，也会替代整个摸牌阶段。`);
    confirm.disabled=blocked;
    confirm.textContent=draft.targetIds.length?say(language,'Confirm trainers · choose hand cards','确认训练家 · 选择手牌'):say(language,'Finish replacement without taking cards','不获得手牌并完成替代摸牌');
  };
  for(const id of legal) {
    const player=view.players.find(player=>player.id===id);
    const button=node('button',{type:'button',class:'button exile-card-choice download-target-choice',id:`download-target-${id}`,'aria-pressed':'false',onclick:()=>{
      const index=draft.targetIds.indexOf(id);if(index>=0)draft.targetIds.splice(index,1);else if(draft.targetIds.length<max)draft.targetIds.push(id);update();
    }},player?.nickname||'—');
    buttons.push([id,button]);grid.append(button);
  }
  confirm.addEventListener('click',()=>kit.action('respondBattle',{decisionId:pending.id,choice:'targets',targetIds:[...draft.targetIds]}));
  const clear=node('button',{type:'button',class:'button secondary',id:'clear-download-targets',disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>{draft.targetIds=[];update();}},say(language,'Clear selection','清空选择'));
  update();return [grid,summary,node('div',{class:'action-row'},confirm,clear)];
}
function eventResponseControls(pending,kit) {
  const view=kit.getView(),language=kit.language,code=view.code,selfId=view.selfId,decisionId=pending.id,kind=pending.kind;
  const currentDecision=()=>{
    const current=kit.getView(),decision=current?.pendingBattle;
    return current?.code===code&&current.selfId===selfId&&current.status==='playing'&&!current.self.spectator&&!current.players.find(player=>player.id===selfId)?.eliminated&&!current.pendingVote&&!kit.busy&&decision?.id===decisionId&&decision.kind===kind&&decision.actorId===selfId?decision:null;
  };
  const row=node('div',{class:'action-row'}),blocked=kit.busy||Boolean(view.pendingVote);
  if(['event-dodge','event-command','rival-command'].includes(kind)){
    const responseKind=kind==='event-dodge'?'dodge':'command';
    for(const card of view.self.hand.filter(card=>card.kind===responseKind)){
      const cardId=card.id;
      row.append(node('button',{type:'button',class:'button primary',id:`${kind}-${cardId}`,disabled:blocked,onclick:()=>{
        if(currentDecision()&&kit.getView().self.hand.some(held=>held.id===cardId&&held.kind===responseKind))kit.action('respondBattle',{decisionId,choice:responseKind,cardId});
      }},responseKind==='command'?say(language,'Play Take this! as response','打出接招吧！响应'):say(language,'Play Dodge! as response','打出快躲开！响应'),` · ${weatherLabel(card.weather,language)}`));
    }
    row.append(node('button',{type:'button',class:'button secondary',id:'response-pass',disabled:blocked,onclick:()=>{if(currentDecision())kit.action('respondBattle',{decisionId,choice:'pass'});}},kind==='rival-command'?say(language,'Pass · end duel','放弃响应 · 结束挑战'):say(language,'Pass · resolve event damage','放弃响应 · 结算事件伤害')));
  }else if(kind==='event-hand'){
    row.className='hand-choice-grid';
    for(const choice of pending.choices||[])row.append(node('button',{type:'button',class:'button blind-hand-choice',id:`event-hand-${choice.index}`,disabled:blocked,onclick:()=>{
      if(currentDecision()?.choices?.some(latest=>latest.index===choice.index))kit.action('respondBattle',{decisionId,choice:'card',handIndex:choice.index});
    }},pending.eventName?.zh==='大葱鸭的恶作剧'?say(language,`Discard face-down card ${choice.index+1}`,`弃置背面手牌 ${choice.index+1}`):say(language,`Take face-down card ${choice.index+1}`,`获得背面手牌 ${choice.index+1}`)));
  }else{
    for(const choice of ['heal','evolve'].filter(choice=>pending.choices?.includes(choice)))row.append(node('button',{type:'button',class:'button primary',id:`mew-blessing-${choice}`,disabled:blocked,onclick:()=>{
      if(currentDecision()?.choices?.includes(choice))kit.action('respondBattle',{decisionId,choice});
    }},choice==='heal'?say(language,'Restore up to 2 HP','回复至多2点体力'):say(language,'Raise one level','提升一级')));
  }
  return [row];
}
function berryHarvestCards(pending,kit,view) {
  const {language}=kit;
  const canPick=pending.kind==='berry-pick'&&pending.actorId===view.selfId&&!view.self.spectator;
  const row=node('div',{class:'fury-reveal-grid','aria-label':say(language,'Berry Harvest cards','树果大丰收亮牌')});
  for(const card of pending.berryCards) {
    const label=node('strong',{},kit.localized(card.name));
    const weather=node('small',{},weatherLabel(card.weather,language));
    if(!canPick) {
      row.append(node('div',{class:'fury-revealed-card'},label,weather));
      continue;
    }
    row.append(node('button',{type:'button',class:'button fury-revealed-card',id:`berry-pick-${card.index}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>{
      const current=kit.getView(),decision=current?.pendingBattle;
      if(current?.code!==view.code||current.selfId!==view.selfId||current.status!=='playing'||current.pendingVote||kit.busy||decision?.kind!=='berry-pick'||decision.id!==pending.id||decision.actorId!==view.selfId||!decision.berryCards?.some(available=>available.index===card.index))return;
      kit.action('respondBattle',{decisionId:pending.id,choice:'card',handIndex:card.index});
    }},label,weather));
  }
  return row;
}
function articunoControls(pending,kit) {
  const {language}=kit,{code,selfId,pendingVote}=kit.getView(),{id:decisionId,mode}=pending;
  const row=node('div',{class:'action-row'}),blocked=kit.busy||Boolean(pendingVote);
  const currentView=()=>{
    const current=kit.getView(),decision=current?.pendingBattle;
    if(current?.code!==code||current.selfId!==selfId||current.status!=='playing'||current.self.spectator||
      current.players.find(player=>player.id===selfId)?.eliminated||current.pendingVote||kit.busy||
      decision?.kind!=='articuno'||decision.id!==decisionId||decision.mode!==mode||decision.actorId!==selfId)return null;
    return current;
  };
  for(const card of pending.protectionCards||[]){
    const cardId=card.id;
    row.append(node('button',{type:'button',class:'button primary',id:`articuno-${cardId}`,disabled:blocked,onclick:()=>{
      const current=currentView();
      if(current?.pendingBattle.protectionCards?.some(available=>available.id===cardId)&&
        current.self.hand.some(held=>held.id===cardId&&held.kind==='event'&&held.eventType==='articuno-protection')){
        kit.action('respondBattle',{decisionId,choice:'protect',cardId});
      }
    }},kit.localized(card.name),` · ${weatherLabel(card.weather,language)}`));
  }
  row.append(node('button',{type:'button',class:'button secondary',id:'response-pass',disabled:blocked,onclick:()=>{
    if(currentView())kit.action('respondBattle',{decisionId,choice:'pass'});
  }},say(language,'Pass protection','放弃庇护')));
  return row;
}
function rescueControls(pending,kit) {
  const draft=privateDecisionDraft(pending,kit,()=>({optionKey:''})),language=kit.language,view=kit.getView(),code=view.code,selfId=view.selfId,decisionId=pending.id;
  const key=option=>JSON.stringify([option.choice,option.card.id]);
  const options=pending.canUsePotion?[...(pending.potionCards||[]).map(card=>({choice:'potion',card})),...(pending.healerCards||[]).map(card=>({choice:'healer',card}))]:[];
  if(!options.some(option=>key(option)===draft.optionKey))draft.optionKey='';
  const payment=node('select',{id:'rescue-card','aria-label':say(language,'Potion or Healer rescue card','伤药或治愈之心救援用牌')},node('option',{value:''},say(language,'Choose Potion or a Healer card','选择伤药或治愈之心用牌')));
  for(const option of options)payment.append(node('option',{value:key(option)},`${option.choice==='potion'?say(language,'Potion · whole tool card','伤药 · 整张道具牌'):say(language,'Healer · discard as Potion','治愈之心 · 弃牌视为伤药')} · ${kit.localized(option.card.name)} · ${weatherLabel(option.card.weather,language)}`));
  payment.value=draft.optionKey;
  const currentDecision=()=>{
    const current=kit.getView(),decision=current?.pendingBattle;
    return current?.code===code&&current.selfId===selfId&&current.status==='playing'&&!current.self.spectator&&!current.pendingVote&&!kit.busy&&decision?.kind==='rescue'&&decision.id===decisionId&&decision.actorId===selfId?decision:null;
  };
  const submit=()=>{
    const decision=currentDecision(),option=options.find(option=>key(option)===draft.optionKey);
    if(!decision?.canUsePotion||!option)return;
    const cards=option.choice==='potion'?decision.potionCards:decision.healerCards;
    if(!cards?.some(card=>card.id===option.card.id))return;
    kit.action('respondBattle',{decisionId,choice:option.choice,cardId:option.card.id});
  };
  const confirm=node('button',{type:'button',class:'button primary',id:'confirm-rescue',onclick:submit},say(language,'Restore 2 HP','回复2点体力'));
  const update=()=>{
    const blocked=kit.busy||Boolean(kit.getView().pendingVote);
    payment.disabled=blocked||!options.length;confirm.disabled=blocked||!pending.canUsePotion||!options.some(option=>key(option)===draft.optionKey);
  };
  payment.addEventListener('change',()=>{draft.optionKey=payment.value;update();});
  const pass=node('button',{type:'button',class:'button secondary',id:'response-pass',disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>{if(currentDecision())kit.action('respondBattle',{decisionId,choice:'pass'});}},say(language,'Pass rescue · ask the next trainer','放弃救援 · 询问下一位训练家'));
  const help=!pending.canUsePotion?say(language,'You cannot use Potion during this restricted rescue settlement. You may pass.','本次受限的救援结算中，你不能使用伤药。可以放弃救援。'):!options.length?say(language,'Your hand has no available Potion or eligible Healer card. You may pass.','你的手牌中没有可用的伤药或符合治愈之心的牌。可以放弃救援。'):say(language,'Potion spends the whole physical tool card, including its other half. Healer discards the selected sunny hand card as Potion. Both restore 2 HP to the fainting Pokémon.','伤药会消耗整张实体道具牌，包括另一半；治愈之心弃置所选晴天手牌，视为使用伤药。两种方式均为昏厥宝可梦回复2点体力。');
  update();return [node('p',{class:'muted'},help),node('div',{class:'charm-controls paid-effect-controls'},node('label',{for:'rescue-card'},say(language,'Your rescue card','你的救援用牌'),payment)),node('div',{class:'action-row'},confirm,pass)];
}
function pressureControls(pending,kit) {
  const draft=privateDecisionDraft(pending,kit,()=>({cardId:''})),language=kit.language,view=kit.getView(),cards=pending.paymentCards||[],sourcePayment=pending.kind==='pressure-payment';
  if(!cards.some(card=>card.id===draft.cardId))draft.cardId='';
  const payment=node('select',{id:`${pending.kind}-card`,'aria-label':say(language,'Pressure · choose your discard','压迫感 · 选择自己的弃牌'),disabled:kit.busy||Boolean(view.pendingVote)},node('option',{value:''},say(language,'Choose one of your hand cards','选择自己的一张手牌')));
  for(const card of cards)payment.append(node('option',{value:card.id},`${kit.localized(card.name)} · ${weatherLabel(card.weather,language)}`));
  payment.value=draft.cardId;
  const confirm=node('button',{type:'button',class:'button primary',id:`confirm-${pending.kind}`,onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'discard',cardId:draft.cardId})},sourcePayment?say(language,'Discard · keep the move effective','弃牌 · 保持招式有效'):say(language,'Discard · use Pressure','弃牌 · 发动压迫感'));
  const update=()=>{confirm.disabled=kit.busy||Boolean(kit.getView().pendingVote)||!draft.cardId;};
  payment.addEventListener('change',()=>{draft.cardId=payment.value;update();});
  const pass=node('button',{type:'button',class:'button secondary',id:'response-pass',disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'pass'})},sourcePayment?say(language,'Do not discard · move ineffective on original target','不弃牌 · 招式对原目标无效'):say(language,'Pass Pressure · keep my hand','放弃压迫感 · 保留手牌'));
  update();return [node('div',{class:'charm-controls paid-effect-controls'},node('label',{},say(language,'Your discard','自己的弃牌'),payment)),node('div',{class:'action-row'},confirm,pass)];
}
export function decisionPanel(view,kit) {
  const pending=view.pendingBattle;if(!pending)return null;
  const language=kit.language,actor=view.players.find(p=>p.id===pending.actorId),target=view.players.find(p=>p.id===pending.targetId);
  const titles={'poison-touch':['Poison Touch · optional ability','毒手 · 可选特性'],cycle:['Spike Cannon · cycle a card','尖刺加农炮 · 交换手牌'],scales:['Marvel Scale · reduce damage','神奇鳞片 · 减少伤害'],effects:['Choose effect order','选择效果结算顺序'],defiant:['Defiant · optional ability','不服输 · 可选特性'],judgment:['Drought · replace judgment','日照 · 替换判定'],defense:['Respond to the move','响应招式'],static:['Static · optional ability','静电 · 可选特性'],synchronize:['Synchronize · optional ability','同步 · 可选特性'],'cursed-body':['Cursed Body · optional ability','咒术之躯 · 可选特性'],foresee:['Future Sight','预知未来'],reorder:['Choose the deck order','选择牌堆顺序'],reinforcement:['Remove a reinforcement','弃置强化指示物'],hand:['Choose a hand card','选择一张手牌'],rescue:['Rescue settlement','昏厥救援结算']};
  Object.assign(titles,{'battle-armor':['Battle Armor · gain Defense','战斗盔甲 · 获得防御强化'],bonemerang:['Bonemerang · one more settlement','骨头回力镖 · 再次结算'],'neutralizing-gas':['Neutralizing Gas · suppress traits','化学变化气体 · 特性失效'],'cute-charm':['Cute Charm · redirect the move','迷人之躯 · 转移招式'],'arena-trap':['Arena Trap · interrupt switch','沙穴 · 响应交替'],'switch-payment':['Arena Trap · pay or cancel switch','沙穴 · 弃牌或取消交替'],'poison-point':['Poison Point · optional ability','毒刺 · 可选特性']});
  Object.assign(titles,{'u-turn':['U-turn · optional move switch','急速折返 · 招式可选交替'],forewarn:['Forewarn · optional Prep ability','预知梦 · 准备阶段可选特性'],'forewarn-order':['Forewarn · arrange top and bottom','预知梦 · 调整牌堆顶与底'],'sweet-kiss':['Sweet Kiss · discard, then draw','天使之吻 · 弃牌后摸牌']});
  Object.assign(titles,{'vital-spirit':['Vital Spirit · choose cards to gain','干劲 · 选择获得的牌'],intimidate:['Intimidate · choose a trainer','威吓 · 选择训练家'],'intimidate-hand':['Intimidate · discard a hand card','威吓 · 弃置一张手牌']});
  Object.assign(titles,{download:['Download · choose other trainers','下载 · 选择其他训练家'],'download-hand':['Download · take a hand card','下载 · 获得一张手牌']});
  Object.assign(titles,{pressure:['Pressure · optional discard','压迫感 · 可选弃牌'],'pressure-payment':['Pressure · discard or let protection apply','压迫感 · 弃牌或让保护生效']});
  Object.assign(titles,{'event-command':['Moltres’s Trial · play a response','火焰鸟的试炼 · 打出响应'],'event-hand':['Mr. Mime’s Trick · choose a hand card','魔墙人偶的戏法 · 选择手牌'],'event-dodge':['Mewtwo’s Threat · play a response','超梦的威压 · 打出响应'],'mew-blessing':['Mew’s Blessing · choose an effect','梦幻的祝福 · 选择效果']});
  titles['rival-command']=['Rival’s Challenge · play a command','劲敌的挑战 · 打出接招吧！'];
  titles['berry-pick']=['Berry Harvest · choose a card','树果大丰收 · 选择一张牌'];
  titles['source-effect-order']=['Choose which attack effect resolves first','选择造成伤害后的结算顺序'];
  titles['life-orb']=['Life Orb · optional boost','生命宝珠 · 可选增伤'];
  titles['blunder-policy']=['Blunder Policy · discard to resolve','打空保险 · 弃牌后结算'];
  if(pending.kind==='event-hand'&&pending.eventName?.zh==='大葱鸭的恶作剧')titles['event-hand']=['Farfetch’d’s Prank · discard a hand card','大葱鸭的恶作剧 · 弃置手牌'];
  if(pending.kind==='articuno')titles.articuno=pending.mode==='cancel-event'
    ?['Articuno’s Protection · cancel event effect','急冻鸟的庇护 · 抵消事件效果']
    :['Articuno’s Protection · cure new status','急冻鸟的庇护 · 解除新状态'];
  const title=pending.kind==='double-edge'?['Double-Edge · optional boost','舍身冲撞 · 可选增伤']:pending.kind==='shed-skin'?['Shed Skin · discard to reduce damage','蜕皮 · 弃牌减少伤害']:pending.kind==='damage-order'?['Choose damage modifier order','选择伤害修正顺序']:pending.kind==='pay-day'?['Pay Day · inspect and give cards','聚宝功 · 观看并分配牌']:pending.kind==='distribute'?['Distribute Pay Day cards','分配聚宝功的牌']:pending.kind==='exile'?['Disable · remove hand cards','定身法 · 移出手牌']:pending.kind==='turn-start-order'?['Choose turn-start order','选择回合开始的结算顺序']:titles[pending.kind]||titles.rescue;
  const panel=node('section',{class:`combat-decision ${['hand','intimidate-hand','download','download-hand'].includes(pending.kind)?'hand-choice-decision':['reorder','forewarn-order','sweet-kiss','vital-spirit'].includes(pending.kind)?'deck-reorder-decision':pending.kind==='judgment'?'judgment-decision':''}`,'aria-label':say(language,'Pending response','等待响应')},node('h2',{},say(language,...title)),node('p',{},`${actor?.nickname||'—'} · ${say(language,'deciding for','正在处理')} ${target?.nickname||'—'}`));
  if(pending.kind==='articuno'){
    const subject=pending.mode==='cancel-event'?kit.localized(pending.eventName):statusName(pending.status,language);
    const help=pending.mode==='cancel-event'
      ?say(language,'Articuno can cancel this event’s effect on the indicated target only.','急冻鸟的庇护仅抵消此事件对指定目标的效果。')
      :say(language,'Articuno can remove the status the indicated Pokémon just gained.','急冻鸟的庇护可以解除指定宝可梦刚陷入的特殊状态。');
    panel.append(node('p',{},[subject,help].filter(Boolean).join(' · ')));
  }
  if(pending.kind==='event-hand')panel.append(node('p',{},pending.eventName?.zh==='大葱鸭的恶作剧'?say(language,'Choose one face-down card to discard.','选择并弃置一张背面手牌。'):say(language,'Choose one face-down card to take into your hand. Its face stays private until you receive it. This required choice cannot be passed.','选择一张背面手牌加入你的手牌，获得前牌面保持隐藏。此选择必须完成，不可放弃。')));
  if(pending.kind==='rival-command')panel.append(node('p',{},say(language,'Play one command from your hand or pass. If a command was played, the last player to respond deals 2 base damage with their active Pokémon.','打出一张接招吧！或放弃。若有人打出过此牌，最后打出的一方以其出战宝可梦造成2点基础伤害。')));
  if(pending.berryCards?.length)panel.append(berryHarvestCards(pending,kit,view));
  if(pending.kind==='event-command')panel.append(node('p',{},`${pending.eventName?`${kit.localized(pending.eventName)} · `:''}${say(language,'Damage source:','伤害来源：')} ${kit.localized(pending.source?.name)||say(language,'Moltres','火焰鸟')} · ${say(language,`Incoming damage: ${pending.damage}`,`将受到${pending.damage}点伤害`)}`),node('p',{},say(language,'Play one actual Take this! card as a response. This does not use a Pokémon move or spend Power. Paralysis weather restrictions and used move allowances do not block this response.','打出手牌中一张实际的接招吧！响应。此操作不使用宝可梦招式，也不消耗力量强化；麻痹的天气限制及已用招式次数不影响此响应。')));
  if(pending.kind==='event-dodge')panel.append(node('p',{},`${pending.eventName?`${kit.localized(pending.eventName)} · `:''}${say(language,'Damage source:','伤害来源：')} ${kit.localized(pending.source?.name)||say(language,'Mewtwo','超梦')} · ${say(language,`Incoming damage: ${pending.damage}`,`将受到${pending.damage}点伤害`)}`),node('p',{},say(language,'Respond by playing an actual Dodge! card from your hand. Sand Veil and Levitate do not provide this response; move Dodge restrictions do not stop it.','打出手牌中一张实际的快躲开！响应。沙隐与飘浮不提供本响应，招式的躲闪限制不影响此响应。')));
  if(pending.kind==='mew-blessing')panel.append(node('p',{},say(language,'Choose healing or, when offered, a level increase. Healing is capped at maximum HP and may be chosen even at full HP. This required choice cannot be passed.','选择回复体力，或在提供该选项时提升等级。回复不超过体力上限，即使体力已满也可选择回复。此选择必须完成，不可放弃。')),node('p',{class:'muted'},say(language,'Leveling up preserves injuries, status, held items and reinforcement. It does not refresh this turn’s used actions.','升级保留已有伤害、特殊状态、持有物及强化指示物，不会刷新本回合已用的操作次数。')));
  if(pending.kind==='pressure')panel.append(node('p',{},say(language,'Your Pokémon became a Take this! target. You may discard one of your hand cards. The command’s user must then also discard one card, or that command’s whole move becomes ineffective against your originally targeted Pokémon. Other targets remain affected. Passing here gives no Pressure protection.','你的宝可梦成为接招吧！的目标。可以弃置自己的一张手牌，然后该指令的使用者也须弃置一张手牌，否则此次指令使用的整个招式对原本被指定的这只宝可梦无效。其他目标仍受影响。此处放弃则不获得压迫感的保护。')));
  if(pending.kind==='pressure-payment')panel.append(node('p',{},say(language,'Pressure’s owner has already discarded a card. You may discard one of your own hand cards to keep the command move effective against that originally targeted Pokémon. If you do not, the whole move is ineffective only against that Pokémon; other targets are unaffected by this protection. Paid costs are not refunded.','压迫感的持有者已弃置一张手牌。你可以弃置自己的一张手牌，使指令招式对原本被指定的那只宝可梦保持有效。若不弃牌，整个招式仅对该宝可梦无效，其他目标不受此保护影响。已支付的费用不会退还。')));
  if(pending.kind==='download')panel.append(node('p',{},pending.actorId===view.selfId&&!view.self.spectator?say(language,`Choose up to ${pending.maxTargets} other trainers to take one hand card from each. Distance does not restrict this choice. Download replaces your entire ordinary Draw phase, even if Flinch would reduce your ordinary draws. You must finish this replacement now.`,`选择至多${pending.maxTargets}名其他训练家，获得其各一张手牌。此选择不受距离限制。下载替代整个通常摸牌阶段，畏缩减少通常摸牌数也不改变此效果。发动后必须完成替代摸牌。`):say(language,'The indicated trainer is privately choosing other trainers for Download, replacing their ordinary Draw phase.','指定训练家正在通过下载私下选择其他训练家，以替代通常摸牌阶段。')));
  if(pending.kind==='download-hand')panel.append(node('p',{},pending.actorId===view.selfId&&!view.self.spectator?say(language,'Choose one face-down hand card to take from this trainer. Its face stays hidden while choosing. Selected cards are reserved privately and gained together after every choice is complete. This choice cannot be passed.','选择并获得这位训练家的一张背面手牌。选择时牌面保持隐藏。所选牌暂时私下保留，全部选完后一起获得。此选择不可放弃。'):say(language,'The indicated trainer is privately choosing a face-down hand card for Download.','指定训练家正在通过下载私下选择一张背面手牌。')));
  if(pending.kind==='vital-spirit')panel.append(node('p',{},pending.actorId===view.selfId&&!view.self.spectator?say(language,`Choose exactly ${pending.requiredCards} cards to gain. This replaces your entire ordinary Draw phase. The choice is mandatory now that you have viewed the cards; only you can see their faces.`,`选择恰好${pending.requiredCards}张牌获得。此效果替代整个通常摸牌阶段。观看后必须完成选择；仅你能看到牌面。`):say(language,'The indicated trainer is privately choosing cards with Vital Spirit, replacing their ordinary Draw phase.','指定训练家正在通过干劲私下选择获得的牌，以替代通常摸牌阶段。')));
  if(pending.kind==='intimidate')panel.append(node('p',{},say(language,'Tauros entered play. Choose one living trainer with hand cards, including yourself, then choose one of that trainer’s hand cards to discard. This ability is mandatory.','肯泰罗登场。必须选择一名有手牌的存活训练家（可以是自己），然后选择其一张手牌弃置。此特性必须结算。')));
  if(pending.kind==='intimidate-hand')panel.append(node('p',{},pending.actorId===view.selfId&&!view.self.spectator?say(language,'Choose one hand card to discard. Another trainer’s card faces stay hidden; your own card faces are visible. This choice cannot be passed.','选择并弃置一张手牌。其他训练家的手牌保持背面；自己的手牌可见。此选择不可放弃。'):say(language,'The indicated trainer is choosing one hand card to discard for Intimidate. Card choices stay private.','指定训练家正在为威吓选择弃置一张手牌；选牌保持私密。')));
  if(pending.kind==='u-turn')panel.append(node('p',{},say(language,'The whole move has finished. You may switch this move’s source with its reserve. Arena Trap still applies. This move effect does not spend the ordinary switch allowance.','整个招式已结束。你可以将此招式的来源与其备战宝可梦交替。沙穴仍然适用。此招式效果不消耗通常交替次数。')));
  if(pending.kind==='forewarn')panel.append(node('p',{},say(language,'During Prep, you may privately view up to four top cards, then place every viewed card on the top or bottom in your chosen order. You may pass before viewing; afterward the placement is mandatory.','准备阶段，你可以私下观看牌堆顶至多四张牌，然后将所有观看的牌按所选顺序放回堆顶或堆底。观看前可以放弃，观看后必须完成放置。')));
  if(pending.kind==='forewarn-order')panel.append(node('p',{},pending.actorId===view.selfId&&!view.self.spectator?say(language,'Only you can see these cards. Arrange every card on the top or bottom of the deck.','仅你能看到这些牌。请将每张牌放到牌堆顶或牌堆底。'):say(language,'The indicated trainer is privately arranging the viewed cards on the top and bottom of the deck.','指定训练家正在私下安排所观看的牌放回牌堆顶与底的顺序。')));
  if(pending.kind==='sweet-kiss')panel.append(node('p',{},pending.actorId===view.selfId&&!view.self.spectator?say(language,`Discard exactly ${pending.requiredCards} hand cards, then draw 2. With fewer than two cards, discard your entire hand. This choice is mandatory.`,`必须弃置恰好${pending.requiredCards}张手牌，然后摸2张。手牌不足两张时弃置全部手牌。此选择不可放弃。`):say(language,'The target trainer must privately choose hand cards to discard, then draw 2.','目标训练家必须私下选择手牌弃置，然后摸2张。')));
  if(pending.kind==='double-edge')panel.append(node('p',{},say(language,'Before damage modifiers, you may add 1 damage. If this settlement deals damage, its original source loses 1 HP after receiving effects finish. Burn and other damage modifiers still apply.','伤害修正前，可以令伤害+1。若本次结算造成伤害，受到伤害后的效果结算完毕后，原伤害来源失去1点体力。灼伤等伤害修正仍生效。')));
  if(pending.kind==='life-orb')panel.append(node('p',{},say(language,`Damage before the target’s modifiers: ${pending.damage}. Boost by 1 and lose 1 HP after this settlement.`,`目标修正前的伤害值：${pending.damage}。可令伤害加1，并在本次结算后失去1点体力。`)));
  if(pending.kind==='blunder-policy')panel.append(node('p',{},say(language,'The defender completed a Dodge. You may discard two cards from your hand to resolve this hit.','对方已完成躲闪。你可以弃置两张手牌，使本次结算生效。')));
  if(['effects','source-effect-order'].includes(pending.kind))panel.append(node('p',{},say(language,'These effects triggered together. Choose which one resolves next.','这些效果在同一时机触发，请选择下一个结算的效果。')));
  if(pending.kind==='damage-order')panel.append(node('p',{},say(language,`Current damage: ${pending.damage}. Choose which receiving-damage effect resolves next. Damage reduced to zero ends this settlement.`,`当前伤害值：${pending.damage}。请选择下一个结算的受到伤害时效果。伤害减至零时，本次伤害结算终止。`)));
  if(pending.kind==='shed-skin')panel.append(node('p',{},say(language,`Incoming damage: ${pending.damage}. You may discard any number of hand cards; each reduces this damage by 1.`,`本次伤害值：${pending.damage}。可以弃置任意数量的手牌，每张使本次伤害减1。`)));
  if(pending.kind==='cute-charm')panel.append(node('p',{},say(language,'Before the move continues, you may discard one intense-sun hand card to redirect this target. The command user and other already chosen targets cannot be selected.','招式继续前，你可以弃置一张烈日手牌并转移此目标。不能选择指令使用者或其他已被指定的目标。')));
  if(pending.kind==='battle-armor')panel.append(node('p',{},say(language,'After receiving damage, discard one hand card to gain Defense. It can protect against later hits, then is discarded when this damaging card ends. No duplicate marker is added.','受到伤害后，可弃置一张手牌获得防御强化。可抵御后续结算；此伤害牌结算完毕后弃置。相同指示物不叠加。')));
  if(pending.kind==='bonemerang')panel.append(node('p',{},say(language,'The first settlement is complete. You may discard one hand card to resolve this move once more against the same Pokémon.','首次结算已结束。可以弃置一张手牌，使此招式对同一只宝可梦再结算一次。')));
  if(pending.kind==='neutralizing-gas')panel.append(node('p',{},say(language,'Discard one hand card to suppress all Pokémon traits of one trainer, including reserves, until this turn ends. Moves, status, items and reinforcement markers remain in effect.','可弃置一张手牌，使一名训练家的所有宝可梦（含备战）特性失效至当前回合结束。招式、特殊状态、持有物及强化指示物仍生效。')));
  if(pending.kind==='rescue'&&pending.potionRestrictedToOwner)panel.append(node('p',{},say(language,'During this rock move, only the fainting Pokémon’s own trainer may use Potion. This also applies during nested effects.','此岩石招式结算期间，只有昏厥宝可梦对应的训练家可以使用伤药；嵌套效果结算期间亦如此。')));
  if(pending.kind==='rescue'&&Number.isFinite(target?.active?.hp))panel.append(node('p',{class:'rescue-hp'},say(language,`Fainting Pokémon: ${target.active.hp}/${target.active.maxHp} HP. Recovery requires at least 1 HP.`,`昏厥宝可梦：${target.active.hp}/${target.active.maxHp}点体力。必须回复至至少1点体力才能恢复。`)));
  if(pending.kind==='arena-trap')panel.append(node('p',{},say(language,'You may require the switching trainer to discard one hand card. If they cannot or decline, this switch is canceled.','你可以令交替的训练家弃置一张手牌。若其无法弃置或拒绝，本次交替取消。')));
  if(pending.kind==='switch-payment')panel.append(node('p',{},say(language,'Discard one hand card to continue the switch, or cancel. Cards already paid to earlier trappers stay discarded.','弃置一张手牌以继续交替，或取消。之前因其他沙穴而弃置的牌不会退还。')));
  if(pending.kind==='poison-point')panel.append(node('p',{},say(language,'After receiving damage, you may judge. Any result other than intense sun Poisons the original damage source.','受到伤害后，你可以进行判定。结果不为烈日时，原伤害来源陷入中毒。')));
  if(pending.settlementCount) {
    const name=pending.settlementMove?kit.localized(pending.settlementMove):say(language,'Fury Attack','乱击');
    panel.append(node('p',{class:'fury-hit-count'},say(language,`${name} · settlement ${pending.settlementNumber} of ${pending.settlementCount}`,`${name} · 第${pending.settlementNumber}/${pending.settlementCount}次结算`)));
    if(pending.revealedCards) {
      const revealed=node('div',{class:'fury-reveal-grid','aria-label':say(language,'Publicly revealed cards','公开亮出的牌')});
      for(const card of pending.revealedCards)revealed.append(node('div',{class:'fury-revealed-card'},node('strong',{},kit.localized(card.name)),node('small',{},weatherLabel(card.weather,language))));
      panel.append(revealed,node('p',{class:'muted'},say(language,'Each sunny card adds one settlement. These are revealed cards, not judgments; they enter discard when the move finishes.','每张晴天牌增加一次结算。这是亮牌，不是判定；招式结束时置入弃牌堆。')));
    }
  }
  if(pending.kind==='defense'&&!pending.cannotDodge&&pending.blockedDodgeWeathers?.includes('intense-sun'))panel.append(node('p',{},say(language,'Compound Eyes prevents intense-sun Dodge cards. Other Dodge weather and successful Sand Veil can still cancel this settlement.','复眼使烈日天气的快躲开！不可用。其他天气的躲闪牌及成功的沙隐仍可抵消本次结算。')));
  if(pending.kind==='defense'&&!pending.cannotDodge&&pending.dodgeReducesDamage)panel.append(node('p',{},say(language,`Keen Eye changes your Dodge into damage −1 for this whole move. Applied reduction: ${pending.damageReduction}. You may use another Dodge or resolve damage.`,`锐利目光使你的快躲开！改为本次整个招式伤害减1。已累积减伤：${pending.damageReduction}。可以继续躲闪或结算伤害。`)));
  if(pending.kind==='defense'&&!pending.cannotDodge&&pending.dodgesRequired===2)panel.append(node('p',{},say(language,`X-Scissor requires 2 Dodges in this same settlement. Played: ${pending.dodgesPlayed||0}/2. The first Dodge keeps this response window open; passing after only one does not cancel the move and full damage continues through its damage modifiers.`,`十字剪需要在本次同一结算中使用2张快躲开！。已使用：${pending.dodgesPlayed||0}/2。第一张躲闪后响应窗口继续；仅使用一张后放弃不会抵消招式，完整伤害仍按伤害修正规则结算。`)));
  if(pending.kind==='pay-day')panel.append(node('p',{},say(language,'You may privately inspect the top two available cards, then give each to any living trainer, including yourself. After inspecting, you must assign every card.','你可以私下观看牌堆顶至多两张可用的牌，然后将每张牌交给任意存活训练家，包括自己。观看后必须完成所有牌的分配。')));
  if(pending.kind==='distribute')panel.append(node('p',{},say(language,'Only you can see these cards. Choose a recipient for each; the same trainer may receive both.','仅你能看到这些牌。请为每张牌选择接收者，同一训练家可以接收两张。')));
  if(pending.kind==='exile')panel.append(node('p',{},say(language,`Choose up to ${pending.maxCards} hand cards. They cannot be used or inspected while removed and return when this trainer’s next turn begins.`,`选择至多${pending.maxCards}张手牌。移出期间不能使用或查看，直到该训练家的下次回合开始时返回。`)));
  if(pending.kind==='turn-start-order')panel.append(node('p',{},say(language,'Returning removed cards and your special status trigger together. Choose which resolves first; the other follows.','移出牌返回与特殊状态同时在回合开始时触发。请选择先结算哪项，另一项随后结算。')));
  if(pending.kind==='poison-touch')panel.append(node('p',{},pending.mode==='poison'?say(language,'Poison is about to deal 1 source-free damage. You may set its base damage to 2; receiving effects still apply.','中毒即将造成1点无来源伤害。你可以将基础伤害改为2点，受到伤害时的效果仍然生效。'):say(language,`Pending status: ${statusName(pending.status,language)}. You may change this status to Poison before it takes effect.`,`即将陷入${statusName(pending.status,language)}。你可以在其生效前将此状态改为中毒。`)));
  if(pending.kind==='cycle')panel.append(node('p',{},say(language,'You may discard one hand card, then draw one card. Only you can see the choices.','你可以弃置一张手牌，然后摸一张牌。仅你能看到可选手牌。')));
  if(pending.kind==='scales')panel.append(node('p',{},say(language,`Incoming damage: ${pending.damage}. You may reduce it by 1 before losing HP.`,`将受到${pending.damage}点伤害。你可以在扣减体力前令伤害值减1。`)));
  if(pending.kind==='defense'&&pending.cannotDodge)panel.append(node('p',{},pending.dodgeBlockedBy==='lock-on'?say(language,'Lock-On prevents the originally targeted Pokémon from using Dodge for this global turn, including virtual Dodges. Reinforcement markers still affect this move normally. Continue the settlement.','锁定使原本被指定的宝可梦在本全局回合无法使用快躲开！，也无法使用视为快躲开！的效果。强化指示物仍正常影响此招式，请继续结算。'):say(language,'This move ignores reinforcement markers. Dodge and Sand Veil cannot cancel it. Continue to resolve the damage.','此招式不受强化指示物影响。快躲开！与沙隐无法抵消此招式，请继续结算伤害。')));
  if(pending.kind==='defiant')panel.append(node('p',{},say(language,'You may draw two cards, then have no hand limit for the current turn. Passing grants neither effect.','你可以摸两张牌，然后本回合没有手牌上限。放弃则两项效果均不结算。')));
  if(pending.kind==='judgment')panel.append(node('p',{},say(language,'Revealed judgment:','已翻开的判定牌：'),` ${kit.localized(pending.judgmentCard.name)} · ${weatherLabel(pending.judgmentCard.weather,language)}`),node('p',{},say(language,'You may replace this judgment with one sunny-weather hand card and take the displaced card.','可打出一张晴天天气手牌替换判定，并获得被替换的牌。')));
  if(pending.kind==='static')panel.append(node('p',{},say(language,'After receiving damage, you may make a judgment. A result other than intense sun paralyzes the damage source.','受到伤害后，你可以进行一次判定。结果不为烈日时，伤害来源陷入麻痹。')));
  if(pending.kind==='synchronize')panel.append(node('p',{},say(language,'You may obtain the card that caused this damage.','你可以获得造成此次伤害的牌。'),pending.card?` ${kit.localized(pending.card.name)}`:''));
  if(pending.kind==='cursed-body')panel.append(node('p',{},say(language,"After receiving damage, you may take one random-position card from the source trainer's hand. Card faces remain private.",'受到伤害后，你可以获得伤害来源训练家的一张随机位置手牌；牌面保持隐藏。')));
  if(pending.kind==='cursed-body')panel.append(node('p',{},say(language,"You may take one face-down card from the damage source trainer's hand.",'你可以获得伤害来源训练家的一张背面手牌。')));
  if(pending.kind==='foresee')panel.append(node('p',{},say(language,'You may privately view the top three cards and put them back in any order before the move continues.','招式继续结算前，你可以私下查看牌堆顶三张牌，并按任意顺序放回牌堆顶。')));
  if(pending.kind==='reorder')panel.append(node('p',{},pending.actorId===view.selfId&&!view.self.spectator?say(language,'Click every card in the order you want. Number 1 will be drawn next. Only you can see these cards.','按期望顺序依次点击所有牌。第1张将最先被摸取，仅你能看到这些牌。'):say(language,'The indicated trainer is privately choosing the order of the top cards.','指定训练家正在私下调整牌堆顶的顺序。')));
  if(pending.kind==='reinforcement')panel.append(node('p',{},pending.timing==='after-damage'?say(language,'After dealing damage, this move removes one reinforcement from the original target. Choose the marker to discard.','此招式造成伤害后，弃置原目标的一枚强化指示物。请选择要弃置的指示物。'):say(language,'The move removes one target reinforcement before defense. Choose the marker to discard.','招式在防御响应前弃置目标的一枚强化指示物。请选择要弃置的指示物。')));
  if(pending.kind==='hand')panel.append(node('p',{},say(language,pending.effect==='take'?"Choose one card to take from this trainer's hand.":"Choose one card to discard from this trainer's hand.",pending.effect==='take'?'选择并获得这位训练家的一张手牌。':'选择并弃置这位训练家的一张手牌。')));
  if(pending.clock) {
    const clock=pending.clock,seconds=Math.ceil((clock.deadlineAt?Math.max(0,clock.deadlineAt-view.serverNow):clock.remainingMs)/1000);
    panel.append(node('p',{class:'response-clock'},clock.pausedReason==='mandatory'?say(language,'Time expired · complete this choice to continue','时间已到 · 请完成当前选择以继续'):clock.pausedReason?say(language,'Paused · waiting for connection or vote','暂停 · 等待连接或表决'):`${seconds}s`));
  }
  if(pending.actorId===view.selfId && !view.self.spectator && pending.kind!=='berry-pick') {
    if(['event-dodge','event-command','mew-blessing','event-hand','rival-command'].includes(pending.kind))panel.append(...eventResponseControls(pending,kit));
    else if(pending.kind==='articuno')panel.append(articunoControls(pending,kit));
    else if(pending.kind==='rescue')panel.append(...rescueControls(pending,kit));
    else if(['pressure','pressure-payment'].includes(pending.kind))panel.append(...pressureControls(pending,kit));
    else if(['battle-armor','bonemerang','neutralizing-gas'].includes(pending.kind))panel.append(...paidEffectControls(pending,kit));
    else if(pending.kind==='cute-charm')panel.append(...charmControls(pending,kit));
    else if(pending.kind==='shed-skin')panel.append(...shedControls(pending,kit));
    else if(pending.kind==='blunder-policy')panel.append(...blunderPolicyControls(pending,kit,view));
    else if(pending.kind==='distribute')panel.append(...distributionControls(pending,kit));
    else if(pending.kind==='exile')panel.append(...exileControls(pending,kit));
    else if(pending.kind==='reorder')panel.append(...deckOrderControls(pending,kit));
    else if(pending.kind==='forewarn-order')panel.append(...forewarnOrderControls(pending,kit));
    else if(pending.kind==='sweet-kiss')panel.append(...sweetKissControls(pending,kit));
    else if(pending.kind==='vital-spirit')panel.append(...vitalSpiritControls(pending,kit));
    else if(pending.kind==='download')panel.append(...downloadControls(pending,kit));
    else {
      const row=node('div',{class:['hand','intimidate-hand','download-hand'].includes(pending.kind)?'hand-choice-grid':'action-row'});
      if(pending.kind==='download-hand') {
        for(const choice of pending.choices||[])row.append(node('button',{type:'button',class:'button blind-hand-choice',id:`download-hand-${choice.index}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'card',handIndex:choice.index})},say(language,`Take face-down card ${choice.index+1}`,`获得背面手牌 ${choice.index+1}`)));
      }else if(pending.kind==='intimidate') {
        for(const id of pending.legalTargetIds||[]) {
          const player=view.players.find(player=>player.id===id);
          row.append(node('button',{type:'button',class:'button primary',id:`intimidate-target-${id}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'target',targetId:id})},`${player?.nickname||'—'}${id===view.selfId?say(language,' · you',' · 你'):''}`));
        }
      }else if(pending.kind==='intimidate-hand') {
        for(const choice of pending.choices||[]) {
          const label=choice.name?`${kit.localized(choice.name)} · ${weatherLabel(choice.weather,language)}`:say(language,`Face-down card ${choice.index+1}`,`背面手牌 ${choice.index+1}`);
          row.append(node('button',{type:'button',class:`button ${choice.name?'known-hand-choice':'blind-hand-choice'}`,id:`intimidate-hand-${choice.index}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'card',handIndex:choice.index})},label));
        }
      }else if(pending.kind==='u-turn') {
        row.append(node('button',{type:'button',class:'button primary',id:'u-turn-switch',disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'switch'})},say(language,'Use U-turn switch','执行急速折返交替')),
          node('button',{type:'button',class:'button secondary',id:'response-pass',disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'pass'})},say(language,'Keep active Pokémon','保持出场宝可梦')));
      }else if(pending.kind==='forewarn') {
        row.append(node('button',{type:'button',class:'button primary',id:'forewarn-view',disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'trait'})},say(language,'View top cards privately','私下观看牌堆顶')),
          node('button',{type:'button',class:'button secondary',id:'response-pass',disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'pass'})},say(language,'Pass Forewarn','放弃预知梦')));
      }else if(['double-edge','life-orb'].includes(pending.kind)) {
        row.append(node('button',{type:'button',class:'button primary',id:`${pending.kind}-boost`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'boost'})},say(language,'Boost damage, then lose 1 HP','伤害+1，之后失去1点体力')),
          node('button',{type:'button',class:'button secondary',id:'response-pass',disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'pass'})},say(language,'Keep base damage','保持原伤害')));
      }else if(pending.kind==='damage-order')for(const effect of pending.effects) {
        const names={dodge:[`Dodge reduction −${pending.damageReduction}`,`躲闪减伤 −${pending.damageReduction}`],defense:['Defense · cap at 1','防御强化 · 伤害改为1'],multiscale:['Multiscale · cap at 1','多重鳞片 · 伤害改为1'],'marvel-scale':['Marvel Scale · optional reduction','神奇鳞片 · 可选减伤'],'shed-skin':['Shed Skin · discard to reduce','蜕皮 · 弃牌减伤']};
        row.append(node('button',{type:'button',class:'button primary',id:`damage-${effect}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'damage-effect',effect})},say(language,...names[effect])));
      }else if(pending.kind==='turn-start-order')for(const effect of pending.effects) {
        const names={'return-cards':['Return removed cards','返回移出的牌'],status:['Resolve special status','结算特殊状态'],'neutralizing-gas':['Neutralizing Gas','化学变化气体']};
        row.append(node('button',{type:'button',class:'button primary',id:`start-${effect}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'start-effect',effect})},say(language,...names[effect])));
      }else if(pending.kind==='source-effect-order')for(const effect of pending.effects) {
        const names={move:['Move effect','招式效果'],'kings-rock':['King’s Rock','王者之证'],'flame-orb':['Flame Orb','火焰宝珠']};
        row.append(node('button',{type:'button',class:'button primary effect-choice',id:`source-effect-${effect}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>{
          const current=kit.getView(),decision=current?.pendingBattle;
          if(current?.code===view.code&&current.selfId===view.selfId&&!current.pendingVote&&!kit.busy&&
            decision?.kind==='source-effect-order'&&decision.id===pending.id&&decision.actorId===view.selfId&&decision.effects.includes(effect)) {
            kit.action('respondBattle',{decisionId:pending.id,choice:'effect',effect});
          }
        }},say(language,...names[effect])));
      }else if(pending.kind==='effects')for(const effect of pending.effects) {
        const names={'battle-armor':['Battle Armor','战斗盔甲'],static:['Static','静电'],'poison-point':['Poison Point','毒刺'],synchronize:['Synchronize','同步'],'cursed-body':['Cursed Body','咒术之躯'],oblivious:['Oblivious','迟钝'],'water-absorb':['Water Absorb · mandatory judgment','储水 · 必须判定'],'rocky-helmet':['Rocky Helmet','凸凸头盔'],'poison-barb':['Poison Barb','毒针']};
        row.append(node('button',{type:'button',class:'button primary effect-choice',id:`effect-${effect}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'effect',effect})},say(language,...names[effect])));
      }else if(pending.kind==='reinforcement')for(const kind of pending.reinforcements||[]) {
        const names={power:['Power','力量'],defense:['Defense','防御'],speed:['Speed','速度']};
        row.append(node('button',{type:'button',class:'button primary',id:`remove-${kind}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'reinforcement',reinforcement:kind})},say(language,...names[kind])));
      }else if(pending.kind==='hand')for(const choice of pending.choices||[]) {
        const weather=weatherLabel(choice.weather,language),label=choice.name?`${kit.localized(choice.name)}${weather?` · ${weather}`:''}`:say(language,`Face-down card ${choice.index+1}`,`背面手牌 ${choice.index+1}`);
        row.append(node('button',{type:'button',class:`button ${choice.name?'known-hand-choice':'blind-hand-choice'}`,id:`hand-choice-${choice.index}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'card',handIndex:choice.index})},label));
      }else if(pending.kind==='switch-payment') {
        for(const card of pending.cards||[])row.append(node('button',{type:'button',class:'button primary switch-payment-card',id:`switch-discard-${card.id}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'discard',cardId:card.id})},`${say(language,'Discard','弃置')} ${kit.localized(card.name)} · ${weatherLabel(card.weather,language)}`));
        row.append(node('button',{type:'button',class:'button secondary',id:'response-pass',disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'pass'})},say(language,'Cancel switch','取消交替')));
      }else if(pending.kind==='cursed-body') {
        for(const choice of pending.choices||[])row.append(node('button',{type:'button',class:'button blind-hand-choice',id:`cursed-choice-${choice.index}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'trait',handIndex:choice.index})},say(language,`Take face-down card ${choice.index+1}`,`获得背面手牌 ${choice.index+1}`)));
        row.append(node('button',{type:'button',class:'button secondary',id:'response-pass',disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'pass'})},say(language,'Pass response','放弃响应')));
      }else {
        const traitNames={'pay-day':['Inspect top cards','观看牌堆顶'],'poison-touch':pending.mode==='poison'?['Set Poison damage to 2','中毒基础伤害改为2']:['Change to Poison','改为中毒'],'marvel-scale':['Reduce damage by 1','伤害减1'],defiant:['Use Defiant','发动不服输'],static:['Use Static','发动静电'],'sand-veil':['Use Sand Veil','发动沙隐'],synchronize:['Use Synchronize','发动同步'],'future-sight':['View the top cards','查看牌堆顶']};
        Object.assign(traitNames,{'poison-point':['Use Poison Point','发动毒刺'],'arena-trap':['Require discard','要求弃牌']});
        if(pending.canTrait&&!pending.cannotDodge)row.append(node('button',{type:'button',class:'button primary',id:'response-trait',disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'trait'})},say(language,...traitNames[pending.trait])));
        if(pending.kind==='judgment')for(const card of pending.replacementCards||[])row.append(node('button',{type:'button',class:'button primary judgment-replacement',id:`replace-${card.id}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'replace',cardId:card.id})},say(language,'Replace with','替换为'),` ${kit.localized(card.name)} · ${weatherLabel(card.weather,language)}`));
        if(pending.kind==='cycle')for(const card of pending.cards||[])row.append(node('button',{type:'button',class:'button primary cycle-card',id:`cycle-${card.id}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'cycle',cardId:card.id})},say(language,'Discard','弃置'),` ${kit.localized(card.name)} · ${weatherLabel(card.weather,language)}`));
        if(pending.kind==='defense'&&!pending.cannotDodge) {
          if(pending.canBrightPowder)row.append(node('button',{type:'button',class:'button primary',id:'response-bright-powder',disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>{
            const current=kit.getView(),defense=current?.pendingBattle;
            if(current?.code===view.code&&current.selfId===view.selfId&&!kit.busy&&!current.pendingVote&&
              defense?.kind==='defense'&&defense.id===pending.id&&defense.actorId===view.selfId&&defense.canBrightPowder) {
              kit.action('respondBattle',{decisionId:pending.id,choice:'bright-powder'});
            }
          }},say(language,'Use Bright Powder','发动光粉')));
          const active=view.players.find(player=>player.id===view.selfId)?.active,levitate=active?.catalogueId==='gastly'&&active.level<=2;
          for(const card of view.self.hand.filter(c=>(c.kind==='dodge'||(levitate&&['rain','thunderstorm'].includes(c.weather)))&&!pending.blockedDodgeWeathers?.includes(c.weather)))row.append(node('button',{type:'button',class:'button primary',id:`respond-${card.id}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'dodge',cardId:card.id})},levitate&&card.kind!=='dodge'?say(language,'Levitate as Dodge','飘浮视为快躲开！'):say(language,'Use Dodge!','打出快躲开！'),` · ${weatherLabel(card.weather,language)}`));
        }
        row.append(node('button',{type:'button',class:'button secondary',id:'response-pass',disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'pass'})},pending.kind==='arena-trap'?say(language,'Allow switch','允许交替'):pending.kind==='defense'&&pending.dodgeReducesDamage?say(language,'Resolve damage','结算伤害'):pending.kind==='defense'&&pending.cannotDodge?say(language,'Continue settlement','继续结算'):say(language,'Pass response','放弃响应')));
      }
      panel.append(row);
    }
    if(pending.kind==='defense' && pending.canTrait&&!pending.cannotDodge)panel.append(node('p',{class:'muted'},say(language,'Sand Veil: with no held item, judge once for this settlement. Intense sun or clear counts as one Dodge! If it fails, you may still use a Dodge card.','沙隐：未携带持有物时，本次结算可判定一次。烈日或晴朗视为使用一张快躲开！；失败后仍可打出躲闪牌。')));
    if(pending.kind==='defense'&&pending.canBrightPowder)panel.append(node('p',{class:'muted'},say(language,'Bright Powder judges once for this settlement. Intense sun or clear counts as one Dodge.','本次结算可用光粉判定一次。烈日或晴朗视为使用一张快躲开！')));
  }else if(pending.actorId!==view.selfId||view.self.spectator)panel.append(node('p',{class:'muted'},say(language,'Waiting for the indicated trainer.','正在等待指定训练家。')));
  if(pending.kind==='rescue')panel.append(node('p',{class:'muted'},say(language,'Each Potion restores 2 HP. While being asked, a trainer may use more cards if HP is still 0 or below, or pass to the next trainer. Rescue stops immediately at 1 HP or above.','每次伤药回复2点体力。被询问的训练家在体力仍为0或以下时，可以继续使用牌，或放弃并询问下一位训练家。体力达到1点或以上时立即结束救援。')));
  return panel;
}
export function resultPanel(view, kit) {
  const language=kit.language;
  const title = view.result?.winner==='rocket'?roleName('rocket',language):view.result?.winner==='challengers'?roleName('challenger',language):say(language,'Gym Leader and Gym Trainers','道馆馆主与道馆训练家');
  const panel=node('section',{class:'combat-result'},node('h1',{},`${title} · ${say(language,'Victory','胜利')}`),node('p',{},say(language,'Combat preview result · test deck. All identities, hands and reserve partners are now public.','战斗预览结果 · 使用测试牌库。所有身份、手牌与备战搭档现已公开。')));
  for (const player of view.players.filter(p=>!p.spectator)) panel.append(node('article',{},
    node('h2',{},`${player.nickname} · ${roleName(player.role,language)}${view.result?.winnerIds.includes(player.id)?' ★':''}`),
    node('p',{},`${say(language,'Active','出场')}: ${kit.partnerName(player.active.catalogueId,player.active.level)} · ${say(language,'Reserve','备战')}: ${kit.partnerName(player.reserve.catalogueId,player.reserve.level)}`),
    node('p',{},`${say(language,'Hand','手牌')}: ${player.hand.map(c=>kit.localized(c.name)).join(' / ') || '—'}`),
    player.exiledCount?node('p',{},`${say(language,'Removed cards','移出的牌')}: ${player.exiledCount}`):null));
  if (view.ownerId===view.selfId) panel.append(node('button',{type:'button',class:'button primary',onclick:()=>kit.action('returnToLobby')},say(language,'Return to lobby / rematch','返回大厅 / 再来一局')));
  else panel.append(node('p',{},say(language,'Waiting for the host to return to the lobby.','等待房主返回大厅。')));
  return panel;
}
