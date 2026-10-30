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
export function attackDialog(card, kit, moveIndex=0) {
  const initial = kit.getView(), battle = initial.self.battle, choice=battle.moves?.[moveIndex], legal=choice?{move:choice,legalTargetIds:choice.legalTargetIds}:battle, turnNumber = initial.turn.number;
  const language = kit.language, selected = new Set();
  const dialog = node('dialog', {class:'info-dialog confirmation-dialog'},
    node('h2', {}, say(language,'Choose move targets','选择招式目标')),
    node('p', {}, `${kit.localized(legal.move.name)} · ${say(language,'Choose up to','最多选择')} ${legal.move.maxTargets}`));
  const confirm = node('button', {type:'button',class:'button primary',disabled:true},say(language,'Commit move','确认招式'));
  let boostCardId='';
  for (const id of legal.legalTargetIds) {
    const player = initial.players.find(p => p.id === id);
    const input = node('input',{type:legal.move.maxTargets === 1?'radio':'checkbox',name:'attack-target',value:id});
    input.addEventListener('change', () => {
      if (legal.move.maxTargets === 1) selected.clear();
      if (input.checked) selected.add(id); else selected.delete(id);
      confirm.disabled = selected.size < 1 || selected.size > legal.move.maxTargets;
    });
    dialog.append(node('label',{class:'attack-target check-label'},input,`${player.nickname} · ${kit.partnerName(player.active.catalogueId,player.active.level)} · ${player.active.hp}/${player.active.maxHp} HP`));
  }
  dialog.append(node('p',{class:'muted'},legal.move.condition?.kind==='weather-card'?say(language,'Committing discards this hand card to meet the move’s weather requirement. The selected trainer gets a response window.','确认后弃置这张手牌以满足招式的天气要求，所选目标的训练家将获得响应机会。'):say(language,'Committing spends this command card. The selected trainer gets a response window.','确认后消耗这张指令牌，所选目标的训练家将获得响应机会。')));
  if(legal.move.effectKind==='hyper-beam') {
    const selector=node('select',{'aria-label':say(language,'Optional Hyper Beam discard','破坏光线可选弃牌')},node('option',{value:''},say(language,'Do not boost','不追加弃牌')));
    for(const option of initial.self.hand.filter(item=>item.id!==card.id))selector.append(node('option',{value:option.id},`${kit.localized(option.name)} · ${weatherLabel(option.weather,language)}`));
    selector.addEventListener('change',()=>{boostCardId=selector.value;});
    dialog.append(node('label',{class:'attack-target'},node('strong',{},say(language,'Hyper Beam declaration','破坏光线声明')),selector),node('p',{class:'muted'},say(language,'Optionally discard one different hand card now for +1 damage. Moxie draws only after this choice.','现在可以额外弃置一张不同的手牌，使伤害+1；自信过度在此选择之后才摸牌。')));
  }
  if(legal.move.cannotDodge)dialog.append(node('p',{class:'muted'},say(language,'Reinforcement markers do not affect this move. Dodge cannot cancel it.','此招式不受强化指示物影响，且不可被快躲开！抵消。')));
  const cancel = node('button',{type:'button',class:'button secondary',onclick:()=>dialog.close()},say(language,'Cancel','取消'));
  confirm.addEventListener('click', () => {
    const current = kit.getView();
    dialog.close();
    if (current.code !== initial.code || current.turn?.number !== turnNumber || !(current.self.battle?.moves?.[moveIndex]?.canUse??current.self.battle?.canCommand) || !current.self.hand.some(c=>c.id===card.id)) return;
    kit.action('attack',{cardId:card.id,targetIds:[...selected],...(moveIndex?{moveIndex}:{}),...(boostCardId?{boostCardId}:{})});
  });
  dialog.append(node('div',{class:'action-row'},cancel,confirm));
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  document.body.append(dialog); dialog.showModal(); cancel.focus();
}
export function equipItemDialog(card,kit) {
  const initial=kit.getView(),language=kit.language,turn=initial.turn.number;
  const active=initial.players.find(p=>p.id===initial.selfId).active;
  const dialog=node('dialog',{class:'info-dialog confirmation-dialog'},node('h2',{},say(language,'Equip Rocky Helmet','携带凸凸头盔')),
    node('p',{},say(language,'After the active holder receives damage, it deals 1 damage to the damage source. Reserve items are inactive.','出场宝可梦受到伤害后，其对伤害来源造成1点伤害。备战宝可梦的持有物不生效。')));
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
  confirm.addEventListener('click',()=>{dialog.close();const current=kit.getView();if(current.code===initial.code&&current.turn?.number===turn&&current.self.battle?.canEquip&&current.self.hand.some(c=>c.id===card.id))kit.action('equipItem',{cardId:card.id,slot:selected});});
  dialog.append(node('div',{class:'action-row'},cancel,confirm));dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();cancel.focus();
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
export function decisionPanel(view,kit) {
  const pending=view.pendingBattle;if(!pending)return null;
  const language=kit.language,actor=view.players.find(p=>p.id===pending.actorId),target=view.players.find(p=>p.id===pending.targetId);
  const titles={'poison-touch':['Poison Touch · optional ability','毒手 · 可选特性'],cycle:['Spike Cannon · cycle a card','尖刺加农炮 · 交换手牌'],scales:['Marvel Scale · reduce damage','神奇鳞片 · 减少伤害'],effects:['Choose effect order','选择效果结算顺序'],defiant:['Defiant · optional ability','不服输 · 可选特性'],judgment:['Drought · replace judgment','日照 · 替换判定'],defense:['Respond to the move','响应招式'],static:['Static · optional ability','静电 · 可选特性'],synchronize:['Synchronize · optional ability','同步 · 可选特性'],'cursed-body':['Cursed Body · optional ability','咒术之躯 · 可选特性'],foresee:['Future Sight','预知未来'],reorder:['Choose the deck order','选择牌堆顺序'],reinforcement:['Remove a reinforcement','弃置强化指示物'],hand:['Choose a hand card','选择一张手牌'],rescue:['Rescue settlement','昏厥救援结算']};
  Object.assign(titles,{'arena-trap':['Arena Trap · interrupt switch','沙穴 · 响应交替'],'switch-payment':['Arena Trap · pay or cancel switch','沙穴 · 弃牌或取消交替'],'poison-point':['Poison Point · optional ability','毒刺 · 可选特性']});
  const title=pending.kind==='shed-skin'?['Shed Skin · discard to reduce damage','蜕皮 · 弃牌减少伤害']:pending.kind==='damage-order'?['Choose damage modifier order','选择伤害修正顺序']:pending.kind==='pay-day'?['Pay Day · inspect and give cards','聚宝功 · 观看并分配牌']:pending.kind==='distribute'?['Distribute Pay Day cards','分配聚宝功的牌']:pending.kind==='exile'?['Disable · remove hand cards','定身法 · 移出手牌']:pending.kind==='turn-start-order'?['Choose turn-start order','选择回合开始的结算顺序']:titles[pending.kind]||titles.rescue;
  const panel=node('section',{class:`combat-decision ${pending.kind==='hand'?'hand-choice-decision':pending.kind==='reorder'?'deck-reorder-decision':pending.kind==='judgment'?'judgment-decision':''}`,'aria-label':say(language,'Pending response','等待响应')},node('h2',{},say(language,...title)),node('p',{},`${actor?.nickname||'—'} · ${say(language,'deciding for','正在处理')} ${target?.nickname||'—'}`));
  if(pending.kind==='effects')panel.append(node('p',{},say(language,'These effects triggered together. Choose which one resolves next.','这些效果在同一时机触发，请选择下一个结算的效果。')));
  if(pending.kind==='damage-order')panel.append(node('p',{},say(language,`Current damage: ${pending.damage}. Choose which receiving-damage effect resolves next. Damage reduced to zero ends this settlement.`,`当前伤害值：${pending.damage}。请选择下一个结算的受到伤害时效果。伤害减至零时，本次伤害结算终止。`)));
  if(pending.kind==='shed-skin')panel.append(node('p',{},say(language,`Incoming damage: ${pending.damage}. You may discard any number of hand cards; each reduces this damage by 1.`,`本次伤害值：${pending.damage}。可以弃置任意数量的手牌，每张使本次伤害减1。`)));
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
  if(pending.kind==='defense'&&pending.blockedDodgeWeathers?.includes('intense-sun'))panel.append(node('p',{},say(language,'Compound Eyes prevents intense-sun Dodge cards. Other Dodge weather and successful Sand Veil can still cancel this settlement.','复眼使烈日天气的快躲开！不可用。其他天气的躲闪牌及成功的沙隐仍可抵消本次结算。')));
  if(pending.kind==='defense'&&pending.dodgeReducesDamage)panel.append(node('p',{},say(language,`Keen Eye changes your Dodge into damage −1 for this whole move. Applied reduction: ${pending.damageReduction}. You may use another Dodge or resolve damage.`,`锐利目光使你的快躲开！改为本次整个招式伤害减1。已累积减伤：${pending.damageReduction}。可以继续躲闪或结算伤害。`)));
  if(pending.kind==='pay-day')panel.append(node('p',{},say(language,'You may privately inspect the top two available cards, then give each to any living trainer, including yourself. After inspecting, you must assign every card.','你可以私下观看牌堆顶至多两张可用的牌，然后将每张牌交给任意存活训练家，包括自己。观看后必须完成所有牌的分配。')));
  if(pending.kind==='distribute')panel.append(node('p',{},say(language,'Only you can see these cards. Choose a recipient for each; the same trainer may receive both.','仅你能看到这些牌。请为每张牌选择接收者，同一训练家可以接收两张。')));
  if(pending.kind==='exile')panel.append(node('p',{},say(language,`Choose up to ${pending.maxCards} hand cards. They cannot be used or inspected while removed and return when this trainer’s next turn begins.`,`选择至多${pending.maxCards}张手牌。移出期间不能使用或查看，直到该训练家的下次回合开始时返回。`)));
  if(pending.kind==='turn-start-order')panel.append(node('p',{},say(language,'Returning removed cards and your special status trigger together. Choose which resolves first; the other follows.','移出牌返回与特殊状态同时在回合开始时触发。请选择先结算哪项，另一项随后结算。')));
  if(pending.kind==='poison-touch')panel.append(node('p',{},pending.mode==='poison'?say(language,'Poison is about to deal 1 source-free damage. You may set its base damage to 2; receiving effects still apply.','中毒即将造成1点无来源伤害。你可以将基础伤害改为2点，受到伤害时的效果仍然生效。'):say(language,`Pending status: ${statusName(pending.status,language)}. You may change this status to Poison before it takes effect.`,`即将陷入${statusName(pending.status,language)}。你可以在其生效前将此状态改为中毒。`)));
  if(pending.kind==='cycle')panel.append(node('p',{},say(language,'You may discard one hand card, then draw one card. Only you can see the choices.','你可以弃置一张手牌，然后摸一张牌。仅你能看到可选手牌。')));
  if(pending.kind==='scales')panel.append(node('p',{},say(language,`Incoming damage: ${pending.damage}. You may reduce it by 1 before losing HP.`,`将受到${pending.damage}点伤害。你可以在扣减体力前令伤害值减1。`)));
  if(pending.kind==='defense'&&pending.cannotDodge)panel.append(node('p',{},say(language,'This move ignores reinforcement markers. Dodge and Sand Veil cannot cancel it. Continue to resolve the damage.','此招式不受强化指示物影响。快躲开！与沙隐无法抵消此招式，请继续结算伤害。')));
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
  if(pending.actorId===view.selfId && !view.self.spectator) {
    if(pending.kind==='shed-skin')panel.append(...shedControls(pending,kit));
    else if(pending.kind==='distribute')panel.append(...distributionControls(pending,kit));
    else if(pending.kind==='exile')panel.append(...exileControls(pending,kit));
    else if(pending.kind==='reorder')panel.append(...deckOrderControls(pending,kit));
    else {
      const row=node('div',{class:pending.kind==='hand'?'hand-choice-grid':'action-row'});
      if(pending.kind==='damage-order')for(const effect of pending.effects) {
        const names={dodge:[`Dodge reduction −${pending.damageReduction}`,`躲闪减伤 −${pending.damageReduction}`],defense:['Defense · cap at 1','防御强化 · 伤害改为1'],multiscale:['Multiscale · cap at 1','多重鳞片 · 伤害改为1'],'marvel-scale':['Marvel Scale · optional reduction','神奇鳞片 · 可选减伤'],'shed-skin':['Shed Skin · discard to reduce','蜕皮 · 弃牌减伤']};
        row.append(node('button',{type:'button',class:'button primary',id:`damage-${effect}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'damage-effect',effect})},say(language,...names[effect])));
      }else if(pending.kind==='turn-start-order')for(const effect of pending.effects) {
        const names={'return-cards':['Return removed cards','返回移出的牌'],status:['Resolve special status','结算特殊状态']};
        row.append(node('button',{type:'button',class:'button primary',id:`start-${effect}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'start-effect',effect})},say(language,...names[effect])));
      }else if(pending.kind==='effects')for(const effect of pending.effects) {
        const names={static:['Static','静电'],'poison-point':['Poison Point','毒刺'],synchronize:['Synchronize','同步'],'cursed-body':['Cursed Body','咒术之躯'],oblivious:['Oblivious','迟钝'],'rocky-helmet':['Rocky Helmet','凸凸头盔']};
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
        if(pending.canTrait)row.append(node('button',{type:'button',class:'button primary',id:'response-trait',disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'trait'})},say(language,...traitNames[pending.trait])));
        if(pending.kind==='judgment')for(const card of pending.replacementCards||[])row.append(node('button',{type:'button',class:'button primary judgment-replacement',id:`replace-${card.id}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'replace',cardId:card.id})},say(language,'Replace with','替换为'),` ${kit.localized(card.name)} · ${weatherLabel(card.weather,language)}`));
        if(pending.kind==='cycle')for(const card of pending.cards||[])row.append(node('button',{type:'button',class:'button primary cycle-card',id:`cycle-${card.id}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'cycle',cardId:card.id})},say(language,'Discard','弃置'),` ${kit.localized(card.name)} · ${weatherLabel(card.weather,language)}`));
        if(pending.kind==='defense'&&!pending.cannotDodge) {
          const active=view.players.find(player=>player.id===view.selfId)?.active,levitate=active?.catalogueId==='gastly'&&active.level<=2;
          for(const card of view.self.hand.filter(c=>(c.kind==='dodge'||(levitate&&['rain','thunderstorm'].includes(c.weather)))&&!pending.blockedDodgeWeathers?.includes(c.weather)))row.append(node('button',{type:'button',class:'button primary',id:`respond-${card.id}`,disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'dodge',cardId:card.id})},levitate&&card.kind!=='dodge'?say(language,'Levitate as Dodge','飘浮视为快躲开！'):say(language,'Use Dodge!','打出快躲开！'),` · ${weatherLabel(card.weather,language)}`));
        }
        row.append(node('button',{type:'button',class:'button secondary',id:'response-pass',disabled:kit.busy||Boolean(view.pendingVote),onclick:()=>kit.action('respondBattle',{decisionId:pending.id,choice:'pass'})},pending.kind==='arena-trap'?say(language,'Allow switch','允许交替'):pending.kind==='defense'&&pending.dodgeReducesDamage?say(language,'Resolve damage','结算伤害'):pending.kind==='defense'&&pending.cannotDodge?say(language,'Continue settlement','继续结算'):say(language,'Pass response','放弃响应')));
      }
      panel.append(row);
    }
    if(pending.kind==='defense' && pending.canTrait)panel.append(node('p',{class:'muted'},say(language,'Sand Veil: with no held item, judge once for this settlement. Intense sun or clear counts as one Dodge! If it fails, you may still use a Dodge card.','沙隐：未携带持有物时，本次结算可判定一次。烈日或晴朗视为使用一张快躲开！；失败后仍可打出躲闪牌。')));
  }else panel.append(node('p',{class:'muted'},say(language,'Waiting for the indicated trainer.','正在等待指定训练家。')));
  if(pending.kind==='rescue')panel.append(node('p',{class:'muted'},say(language,'Potion is not included in this test deck. Each trainer still receives their own pass decision.','此测试牌库尚未加入伤药，仍按顺序询问每位训练家是否放弃救援。')));
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
