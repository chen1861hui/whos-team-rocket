import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoomStore } from '../server/store.js';
import { tourTimeoutChoice } from '../server/combat.js';
import { maxHp } from '../server/battle-rules.js';
import { aiActions } from '../server/ai-players.js';
import { trainerProfessionIds } from '../public/trainer-professions.js';
import { buildRulebook } from '../public/rulebook.js';

const catalogue=JSON.parse(readFileSync(new URL('../content/catalogue.json',import.meta.url),'utf8'));

function match(t, {enabled=true,play=true,mode='teams',reserves=[],autoJudgment=true,jobs=['joy','brock','oak',''],lineup=['bulbasaur','squirtle','rhyhorn','pikachu']}={}) {
  const dataDir=mkdtempSync(join(tmpdir(),'rocket-profession-'));
  t.after(()=>rmSync(dataDir,{recursive:true,force:true}));
  const options={dataDir,catalogue,now:()=>1_000_000};
  let store=new RoomStore(options), serial=0;
  const host=store.create({nickname:'Host'});
  const seats=[host,...['Brendan','May','Trace'].map(nickname=>store.join(host.code,{nickname}))];
  const watcher=store.join(host.code,{nickname:'Spectator',spectator:true});
  const room=()=>store.rooms.get(host.code);
  const view=(seat=host)=>store.view(host.code,seat.token).view;
  const act=(seat,type,fields={})=>store.action(host.code,seat.token,{
    id:'profession-'+(++serial),revision:room().revision,type,...fields,
  }).view;
  const byId=id=>seats.find(seat=>seat.playerId===id);
  const player=seat=>room().players.find(player=>player.id===seat.playerId);
  const turn=()=>byId(room().turn.playerId);
  function respond(choice,fields={}){
    const pending=room().pendingBattle;
    return act(byId(pending.actorId),'respondBattle',{decisionId:pending.id,choice,...fields});
  }
  function passAll(){ while(room().pendingBattle)respond('pass'); }
  function take(predicate){
    const piles=[room().drawPile,room().discardPile,...room().players.map(player=>player.hand)];
    const pile=piles.find(pile=>pile.some(predicate));
    assert.ok(pile,'A physical card must be available');
    return pile.splice(pile.findIndex(predicate),1)[0];
  }
  function attack(target){
    const who=turn(), card=take(e=>e.kind==='command');
    player(who).hand.push(card);
    act(who,'attack',{cardId:card.id,moveIndex:0,targetIds:[target.playerId]});
  }
  function equip(who,slot,type){
    const card=take(e=>e.itemType===type);
    player(who).hand.push(card);
    act(who,'equipItem',{cardId:card.id,slot});
    return card;
  }
  function drawCandidates(who,position){
    player(who).candidateDeal=[lineup[position],reserves[position]??'clefairy','geodude','onix','abra'];
    for(let i=0;i<5;i++) act(who,'drawPokemon');
  }
  function lockPartners(who,position,profession){
    return act(who,'selectPokemon',{activeId:lineup[position],reserveId:reserves[position]??'clefairy',...(profession?{profession}:{})});
  }
  function finishPlay(){
    const who=turn();
    while(room().turn.drawRemaining)act(who,'draw');
    let result=act(who,'finishPlay');
    while(result.turn.phase==='discard')result=act(who,'discard',{cardId:result.self.hand[0].id});
  }
  const settings=(value=enabled)=>act(host,'settings',{arena:'fire',turnSeconds:0,responseSeconds:0,autoDraw:true,autoJudgment,matchMode:mode,trainerProfessions:value});
  settings();
  for(const seat of seats) act(seat,'ready',{ready:true});
  act(host,'startBattlePreview');
  for(const seat of seats) act(seat,'acknowledgeIdentity');
  const positions=room().players.filter(player=>!player.spectator).map(player=>byId(player.id));
  if(play){
    for(const [position,seat] of positions.entries()){
      drawCandidates(seat,position);
      lockPartners(seat,position,enabled?jobs[position]:null);
    }
    passAll();
    while(room().turn.drawRemaining)act(turn(),'draw');
  }
  return {act,view,host,seats,watcher,byId,positions,turn,room,player,respond,passAll,take,equip,attack,drawCandidates,lockPartners,finishPlay,
    restart(){store=new RoomStore(options);}};
}

test('optional public professions lock with partners without revealing another identity or reserve',t=>{
  const disabled=match(t,{enabled:false,play:false});
  disabled.drawCandidates(disabled.positions[0],0);
  assert.throws(()=>disabled.lockPartners(disabled.positions[0],0,'joy'),{code:'INVALID_PROFESSION'});
  const f=match(t,{mode:'identity',play:false});
  const first=f.positions[1], second=f.positions[2];
  f.drawCandidates(first,1);
  assert.throws(()=>f.lockPartners(first,1,'constructor'),{code:'INVALID_PROFESSION'});
  f.lockPartners(first,1,'oak');
  const spectator=f.view(f.watcher).players.find(seat=>seat.id===first.playerId);
  assert.equal(spectator.profession,'oak');
  assert.equal(spectator.role,null);
  assert.equal(spectator.reserve,undefined);
  assert.throws(()=>f.lockPartners(first,1,'joy'),{code:'ALREADY_SELECTED'});
  f.drawCandidates(second,2);
  const [aiSelection]=aiActions(f.room(),f.player(second),catalogue);
  assert.equal(aiSelection.profession,trainerProfessionIds[f.player(second).seatNumber-1]);
  f.lockPartners(second,2,'oak');
  assert.equal(f.view(f.watcher).players.filter(seat=>seat.profession==='oak').length,2);
  f.restart();
  assert.equal(f.view(f.watcher).players.find(seat=>seat.id===first.playerId).profession,'oak');
  const book=buildRulebook({trainerProfessions:true});
  assert.equal(book.sections.find(rule=>rule.id==='professions').steps.length,8);
  assert.ok(!buildRulebook().sections.some(rule=>rule.id==='professions'));
});

test('Brock’s care follows a successful ordinary switch and heals one HP only once in the End phase',t=>{
  const f=match(t,{jobs:['brock']});
  const who=f.turn();
  f.player(who).active.damage=2;
  const outgoing=f.player(who).active.instanceId;
  assert.throws(()=>f.act(who,'tourAction',{action:'brock-care'}),{code:'ACTION_UNAVAILABLE'});
  f.act(who,'switchPokemon');
  f.passAll();
  assert.equal(f.player(who).reserve.instanceId,outgoing);
  assert.equal(f.player(who).reserve.damage,2);
  f.finishPlay();
  const [aiChoice]=aiActions(f.room(),f.player(who),catalogue);
  assert.equal(aiChoice.action,'brock-care');
  f.act(who,'tourAction',{action:'brock-care'});
  assert.equal(f.player(who).reserve.damage,1);
  assert.throws(()=>f.act(who,'tourAction',{action:'brock-care'}),{code:'ACTION_UNAVAILABLE'});
  f.act(who,'endTurn');
  assert.notEqual(f.turn().playerId,who.playerId);

  const debt=match(t,{jobs:['brock']});
  debt.room().turn.switchUsed=true;
  debt.player(debt.turn()).reserve.damage=1;
  debt.finishPlay();
  assert.throws(()=>debt.act(debt.turn(),'tourAction',{action:'brock-care'}),{code:'ACTION_UNAVAILABLE'});
});

test('Professor Oak registers a public reserve and only the actor can privately reorder the saved top cards',t=>{
  for(const mode of ['swap','pass']){
    const f=match(t,{jobs:['oak']});
    const who=f.turn(),top=f.room().drawPile.slice(-2).reverse();
    assert.equal(f.view(f.watcher).players.find(player=>player.id===who.playerId).reserve,undefined);
    f.act(who,'tourAction',{action:'oak-register'});
    const publicView=f.view(f.watcher);
    assert.equal(publicView.players.find(player=>player.id===who.playerId).reserve.catalogueId,'clefairy');
    assert.equal(publicView.pendingBattle.options,undefined);
    assert.equal(publicView.pendingBattle.continuation,undefined);
    assert.equal(publicView.log.at(-1).tourCard,undefined);
    assert.deepEqual(f.view(who).pendingBattle.options.map(option=>option.card.id),top.map(card=>card.id));
    f.restart();
    if(mode==='swap')f.respond('choose',{effect:top[1].id});
    else f.respond('pass');
    assert.deepEqual(f.room().drawPile.slice(-2).reverse().map(card=>card.id),
      (mode==='swap'?top.toReversed():top).map(card=>card.id));
    assert.equal(f.view(who).players.find(player=>player.id===who.playerId).professionUsed,true);
    assert.throws(()=>f.act(who,'tourAction',{action:'oak-register'}),{code:'ACTION_UNAVAILABLE'});
  }
});

test('Nurse Joy pays only a public held item, heals 1 HP and continues the original rescue',t=>{
  const f=match(t,{jobs:['joy']});
  const who=f.turn(),target=f.positions[1];
  const publicItem=f.equip(who,'active','leftovers');
  const privateItem=f.equip(who,'reserve','kings-rock');
  f.player(target).active.damage=maxHp(f.player(target).active,catalogue)-1;
  f.attack(target);
  f.respond('pass');
  const rescue=f.view(who).pendingBattle;
  assert.equal(rescue.kind,'rescue');
  assert.equal(rescue.actorId,who.playerId);
  assert.equal(f.view(f.watcher).pendingBattle.joyItems,undefined);
  assert.deepEqual(rescue.joyItems.map(item=>item.id),[publicItem.id]);
  assert.throws(()=>f.respond('joy',{cardId:privateItem.id}),{code:'INVALID_CARD'});
  f.respond('joy',{cardId:publicItem.id});
  assert.equal(f.player(target).active.damage,maxHp(f.player(target).active,catalogue)-1);
  assert.equal(f.player(who).active.item,undefined);
  assert.ok(f.room().discardPile.some(card=>card.id===publicItem.id));
  assert.equal(f.player(who).reserve.item.id,privateItem.id);
  assert.equal(f.player(who).professionUsed,true);
  assert.equal(f.room().pendingBattle,null);
});

test('Joy’s partial rescue can resolve Defiant and then allow an ordinary Potion',t=>{
  const f=match(t,{jobs:['joy'],lineup:['mankey','squirtle','rhyhorn','pikachu']});
  const who=f.turn(),target=f.positions[1];
  const item=f.equip(who,'active','leftovers');
  f.player(target).active.damage=maxHp(f.player(target).active,catalogue)-1;
  f.attack(target);
  f.respond('pass');
  f.respond('joy',{cardId:item.id});
  assert.equal(f.room().pendingBattle.kind,'defiant');
  const handSize=f.player(who).hand.length;
  f.restart();
  f.respond('trait');
  assert.equal(f.player(who).hand.length,handSize+2);
  assert.equal(f.view(who).pendingBattle.kind,'rescue');
  assert.equal(f.view(who).pendingBattle.joyItems,undefined);
  const potion=f.take(card=>card.toolType==='potion-full-heal');
  f.player(who).hand.push(potion);
  f.respond('potion',{cardId:potion.id});
  assert.equal(f.room().pendingBattle,null);
  assert.equal(f.player(target).active.damage,maxHp(f.player(target).active,catalogue)-2);
});

test('Nurse Joy respects the original owner-only rescue rule',t=>{
  const f=match(t,{jobs:['joy'],lineup:['rhyhorn','squirtle','bulbasaur','pikachu']});
  const who=f.turn(), target=f.positions[1];
  const item=f.equip(who,'active','leftovers');
  f.player(target).active.damage=maxHp(f.player(target).active,catalogue)-1;
  f.attack(target);
  f.respond('pass');
  assert.equal(f.view(who).pendingBattle.potionRestrictedToOwner,true);
  assert.equal(f.view(who).pendingBattle.joyItems,undefined);
  assert.throws(()=>f.respond('joy',{cardId:item.id}),{code:'POTION_RESTRICTED'});
  assert.equal(f.player(who).active.item.id,item.id);
});

test('a Rocket trade requires consent, keeps both card faces private and preserves physical cards after reconnect',t=>{
  for (const answer of ['trade','decline','no-match']) {
    const f=match(t,{jobs:['disguise']});
    const who=f.turn(), other=f.positions[1], opposite=f.positions[2];
    const offered=f.take(card=>card.kind==='command' && card.weather==='rain');
    const matching=f.take(card=>card.kind==='event' && card.weather==='rain');
    const different=f.take(card=>card.weather==='clear');
    f.player(who).hand.push(offered);
    f.room().discardPile.push(...f.player(other).hand);
    f.player(other).hand=[different];
    if (answer==='no-match') f.room().discardPile.push(matching);
    else f.player(other).hand.push(matching);
    f.act(who,'tourAction',{action:'disguise-trade'});
    assert.throws(()=>f.respond('choose',{effect:opposite.playerId}),{code:'INVALID_RESPONSE'});
    f.respond('choose',{effect:other.playerId});
    f.respond('pass');
    assert.equal(f.player(who).professionUsed,undefined);
    f.act(who,'tourAction',{action:'disguise-trade'});
    f.respond('choose',{effect:other.playerId});
    f.respond('choose',{effect:offered.id});
    const pending=f.view(other).pendingBattle;
    assert.equal(pending.actorId,other.playerId);
    assert.deepEqual(pending.options.map(option=>option.value),answer==='no-match'?['decline']:[matching.id,'decline']);
    for (const seat of [who,f.watcher]) {
      const publicView=f.view(seat);
      assert.match(publicView.pendingBattle.detail.en,/offered a heavy rain card/);
      assert.equal(publicView.pendingBattle.options,undefined);
      assert.equal(publicView.pendingBattle.continuation,undefined);
      assert.equal(publicView.log.at(-1).tourCard,undefined);
    }
    assert.throws(()=>f.respond('choose',{effect:different.id}),{code:'INVALID_RESPONSE'});
    f.restart();
    f.respond('choose',{effect:answer==='trade'?matching.id:'decline'});
    assert.equal(f.player(who).hand.some(card=>card.id===offered.id),answer!=='trade');
    assert.equal(f.player(other).hand.some(card=>card.id===offered.id),answer==='trade');
    assert.equal(f.player(who).hand.some(card=>card.id===matching.id),answer==='trade');
    assert.equal(f.player(who).professionUsed,true);
    assert.throws(()=>f.act(who,'tourAction',{action:'disguise-trade'}),{code:'ACTION_UNAVAILABLE'});
  }
});

test('Looker lets the neighbor choose a weather clue or item presence without exposing a hidden reserve',t=>{
  for (const answer of ['held','weather']) {
    const f=match(t,{jobs:['looker']});
    const who=f.turn(), other=f.positions[1];
    const clue=f.take(card=>card.kind==='command' && card.weather==='rain');
    const item=f.take(card=>card.itemType==='leftovers');
    f.player(other).hand.push(clue);
    f.player(other).reserve.item=item;
    f.act(who,'tourAction',{action:'looker-inquiry'});
    f.respond('choose',{effect:other.playerId});
    assert.equal(f.view(who).pendingBattle.options,undefined);
    assert.equal(f.view(other).pendingBattle.options.find(option=>option.value==='held').card,undefined);
    assert.deepEqual(tourTimeoutChoice(f.room().pendingBattle),{choice:'choose',effect:'held'});
    const [aiChoice]=aiActions(f.room(),f.player(other),catalogue);
    assert.notEqual(aiChoice.effect,'held');
    f.respond('choose',{effect:answer==='held'?'held':clue.id});
    const projected=f.view(f.watcher);
    assert.equal(projected.players.find(player=>player.id===other.playerId).reserve,undefined);
    assert.equal(projected.log.at(-1).tourCard,undefined);
    const result=projected.log.at(-1).text.en;
    assert.match(result,answer==='held'?/holds an item/:/heavy rain weather/);
    assert.ok(!result.includes(clue.name.en) && !result.includes(item.name.en));
    assert.throws(()=>f.act(who,'tourAction',{action:'looker-inquiry'}),{code:'ACTION_UNAVAILABLE'});
  }
});

test('Bird Keeper draws after an ordinary switch and can select a live neighbor only with a Flying partner',t=>{
  for (const [reserve,flying] of [['pidgey',true],['clefairy',false]]) {
    const f=match(t,{jobs:['birdkeeper'],reserves:[reserve]});
    const who=f.turn(), other=f.positions[1], opposite=f.positions[2];
    const recipient=flying?other:who;
    assert.throws(()=>f.act(who,'tourAction',{action:'bird-supply'}),{code:'ACTION_UNAVAILABLE'});
    f.act(who,'switchPokemon');
    f.passAll();
    assert.equal(f.player(who).active.catalogueId,reserve);
    const top=f.room().drawPile.at(-1);
    const before=f.player(recipient).hand.length;
    f.act(who,'tourAction',{action:'bird-supply'});
    if (flying) {
      assert.ok(f.view(who).pendingBattle.options.some(option=>option.value===who.playerId));
      assert.throws(()=>f.respond('choose',{effect:opposite.playerId}),{code:'INVALID_RESPONSE'});
      f.respond('choose',{effect:other.playerId});
    }
    assert.equal(f.player(recipient).hand.length,before+1);
    assert.ok(f.player(recipient).hand.some(card=>card.id===top.id));
    assert.throws(()=>f.act(who,'tourAction',{action:'bird-supply'}),{code:'ACTION_UNAVAILABLE'});
  }
  const debt=match(t,{jobs:['birdkeeper'],reserves:['pidgey']});
  debt.room().turn.switchUsed=true;
  assert.throws(()=>debt.act(debt.turn(),'tourAction',{action:'bird-supply'}),{code:'ACTION_UNAVAILABLE'});
});

test('Bug Catcher recovers a matching physical tool on Bug entry and continuing after pass is optional',t=>{
  for (const pass of [false,true]) {
    const f=match(t,{jobs:['bugcatcher'],reserves:['caterpie']});
    const who=f.turn(), player=f.player(who);
    const command=f.take(card=>card.kind==='command' && card.weather==='rain');
    const tool=f.take(card=>card.kind==='tool' && card.weather==='rain');
    const event=f.take(card=>card.kind==='event' && card.weather==='rain');
    const wrong=f.take(card=>card.kind==='tool' && card.weather==='clear');
    f.room().discardPile.push(tool,event,wrong);
    f.room().drawPile.push(...player.hand);
    player.hand=[command];
    f.act(who,'switchPokemon');
    assert.equal(f.player(who).active.catalogueId,'caterpie');
    assert.deepEqual(f.view(who).pendingBattle.options.map(option=>option.value),[tool.id]);
    assert.equal(f.view(f.watcher).pendingBattle.options,undefined);
    assert.throws(()=>f.respond('choose',{effect:wrong.id}),{code:'INVALID_RESPONSE'});
    const [aiChoice]=aiActions(f.room(),f.player(who),catalogue);
    assert.equal(aiChoice.effect,tool.id);
    if (pass) f.respond('pass');
    else f.respond('choose',{effect:tool.id});
    assert.equal(f.room().pendingBattle,null);
    assert.equal(f.room().entryEvent,undefined);
    assert.equal(f.player(who).hand.some(card=>card.id===tool.id),!pass);
    assert.equal(f.room().discardPile.some(card=>card.id===tool.id),pass);
    assert.equal(Boolean(f.player(who).professionUsed),!pass);
  }
});

test('Forecast Revision runs before the public judgment, keeps the first weather private and resets next table round',t=>{
  for (const manual of [false,true]) {
    const f=match(t,{jobs:['researcher'],lineup:['psyduck','vulpix','rhyhorn','pikachu'],autoJudgment:!manual});
    const who=f.turn(), top=f.take(card=>card.kind==='command' && card.weather==='rain');
    const second=f.take(card=>card.weather==='clear');
    const cost=f.take(card=>card.kind==='dodge');
    f.player(who).hand.push(cost);
    f.room().drawPile.push(second,top);
    f.act(who,'useTrait');
    if (manual) {
      assert.equal(f.view(who).pendingBattle.kind,'reveal-judgment');
      f.respond('reveal');
    }
    const publicView=f.view(f.watcher);
    assert.equal(publicView.pendingBattle.judgmentCard,undefined);
    assert.equal(publicView.pendingBattle.options,undefined);
    assert.equal(publicView.pendingBattle.detail,undefined);
    assert.ok(!JSON.stringify(publicView).includes(top.id));
    const privateDecision=f.view(who).pendingBattle;
    assert.match(privateDecision.detail.en,/heavy rain/);
    assert.equal(privateDecision.privateDetail,undefined);
    assert.ok(privateDecision.options.some(option=>option.value===cost.id));
    f.restart();
    f.respond('choose',{effect:cost.id});
    assert.equal(f.room().drawPile[0].id,top.id);
    assert.ok(f.room().discardPile.some(card=>card.id===cost.id));
    const firstJudgment=f.view(f.watcher).pendingBattle;
    assert.equal(firstJudgment.kind,'judgment');
    assert.equal(firstJudgment.judgmentCard.weather,'clear');
    f.passAll();
    assert.equal(f.player(who).researcherJudged,true);
    f.room().turn.swiftSwimUsed=false;
    f.room().turn.traitsUsed=[];
    f.act(who,'useTrait');
    if (manual) f.respond('reveal');
    assert.equal(f.view(who).pendingBattle.kind,'judgment');
    f.passAll();
    do {
      f.finishPlay();
      f.act(f.turn(),'endTurn');
    } while (f.turn()!==who);
    assert.equal(f.player(who).researcherJudged,undefined);
    const currentTop=f.room().drawPile.at(-1).id;
    f.act(who,'useTrait');
    if (manual) f.respond('reveal');
    assert.match(f.view(who).pendingBattle.detail.en,/The top card is/);
    f.respond('pass');
    assert.equal(f.room().judgment.card.id,currentTop);
    f.passAll();
  }
});
