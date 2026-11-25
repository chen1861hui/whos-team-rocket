import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoomStore } from '../server/store.js';
import { maxHp } from '../server/battle-rules.js';
import { tourTimeoutChoice } from '../server/combat.js';
import { aiActions, publicAiTable } from '../server/ai-players.js';
import { VIRIDIAN_GYM } from '../public/match-mode.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json',import.meta.url),'utf8'));

function match(t,count,{controlled=true,gymGuard=false,rocketPartners=false,rocketInfiltration=false,
  contentPack,weatherLab,autoJudgment,responseSeconds=0,now=()=>1_000_000}={}) {
  const dataDir = mkdtempSync(join(tmpdir(),'rocket-viridian-'));
  t.after(()=>rmSync(dataDir,{recursive:true,force:true}));
  const options = {dataDir,catalogue,now};
  let store = new RoomStore(options);
  const host = store.create({nickname:'Host'});
  const room = ()=>store.rooms.get(host.code);
  const view = seat=>store.view(host.code,seat.token).view;
  let sequence = 0;
  const act = (seat,type,fields={})=>store.action(host.code,seat.token,{id:'viridian-'+(++sequence),
    revision:room().revision,type,...fields}).view;
  const settings = fields=>act(host,'settings',{arena:'fire',turnSeconds:0,responseSeconds,contentPack,weatherLab,autoJudgment,
    autoDraw:true,identityScenario:VIRIDIAN_GYM,gymGuard,rocketPartners,rocketInfiltration,...fields});
  settings();
  const seats = [host,...Array.from({length:count-1},(_,index)=>store.join(host.code,{nickname:'Trainer '+(index+2)}))];
  const watcher = store.join(host.code,{nickname:'Observer',spectator:true});
  const byId = id=>seats.find(seat=>seat.playerId===id);
  const player = id=>room().players.find(seat=>seat.id===id);
  const passAll = ()=>{
    while(room().pendingBattle){
      const pending = room().pendingBattle;
      act(byId(pending.actorId),'respondBattle',{decisionId:pending.id,choice:'pass'});
    }
  };
  const start = ()=>{
    for(const seat of seats) act(seat,'ready',{ready:true});
    return act(host,'startBattlePreview');
  };
  const draft = ()=>{
    const dealt = [];
    for(const seat of seats){
      if(controlled) player(seat.playerId).candidateDeal = [
        seat.playerId===room().scenario.viridian.proxyId?'squirtle':'bulbasaur',
        'pikachu','clefairy','geodude','onix',
      ];
      let drawn;
      for(let i=0;i<5;i++) drawn = act(seat,'drawPokemon');
      const candidates = drawn.self.candidates;
      assert.equal(new Set(candidates).size,5);
      dealt.push(...candidates);
      const ordered = candidates.toSorted((a,b)=>Number(['tauros','jynx','koffing'].includes(a))-
        Number(['tauros','jynx','koffing'].includes(b)));
      act(seat,'selectPokemon',{activeId:ordered[0],reserveId:ordered[1]});
    }
    return dealt;
  };
  function end() {
    passAll();
    const who = byId(room().turn.playerId);
    while(room().turn.drawRemaining) act(who,'draw');
    let state = act(who,'finishPlay');
    while(state.turn.phase==='discard') state=act(who,'discard',{cardId:state.self.hand[0].id});
    act(who,'endTurn');
  }
  function takeCommand(actor) {
    const held = actor.hand.find(card=>card.kind==='command');
    if(held) return held;
    const piles = [room().drawPile,room().discardPile,...room().players.map(player=>player.hand)];
    const source = piles.find(pile=>pile.some(card=>card.kind==='command'));
    assert.ok(source, 'A physical command must be available.');
    const [card] = source.splice(source.findIndex(card=>card.kind==='command'),1);
    actor.hand.push(card);
    return card;
  }
  function knockout(targetId){
    passAll();
    const target = player(targetId);
    target.active.damage = maxHp(target.active,catalogue)-1;
    target.reserve.defeated = true;
    const actor = player(room().turn.playerId);
    const card = takeCommand(actor);
    act(byId(actor.id),'attack',{cardId:card.id,moveIndex:0,targetIds:[targetId]});
    passAll();
  }
  function acknowledge(){ for(const seat of seats) act(seat,'acknowledgeIdentity'); }
  return {host,seats,watcher,byId,player,room,view,act,settings,start,acknowledge,draft,end,knockout,takeCommand,passAll,
    join: nickname=>store.join(host.code,{nickname}),restart(){store=new RoomStore(options);}};
}

test('Viridian Gym validates the lineup and keeps the Leader private through an eight-trainer draft',t=>{
  const small = match(t,4);
  assert.throws(()=>small.start(),{code:'INVALID_VIRIDIAN_SIZE'});
  const f = match(t,8,{controlled:false});
  assert.throws(()=>f.join('Ninth trainer'),{code:'ROOM_FULL'});
  assert.throws(()=>f.settings({matchMode:'teams'}),{code:'INVALID_SETTINGS'});
  assert.throws(()=>f.settings({identityScenario:'standard'}),{code:'TOO_MANY_TRAINERS'});
  f.start();
  const {proxyId} = f.room().scenario.viridian;
  const leader = f.room().players.find(seat=>seat.role==='leader');
  assert.equal(f.view(f.byId(leader.id)).self.role,'leader');
  assert.equal(f.view(f.watcher).players.find(seat=>seat.id===leader.id).role,null);
  assert.equal(f.view(f.watcher).players.filter(seat=>seat.role).length,1);
  assert.equal(f.view(f.watcher).players.find(seat=>seat.id===proxyId).role,'gym');
  assert.equal(f.room().players.filter(seat=>seat.role==='gym').length,2);
  assert.equal(f.room().players[0].id,proxyId);
  f.acknowledge();
  f.restart();
  assert.equal(f.view(f.watcher).players.find(seat=>seat.id===leader.id).role,null);
  const dealt = f.draft();
  assert.equal(new Set(dealt).size,40);
  f.passAll();
  const watched = f.view(f.watcher);
  assert.equal(watched.turn.playerId,proxyId);
  assert.equal(watched.scenario.viridian.round,1);
  assert.equal(f.player(proxyId).active.level,2);
  assert.equal(f.player(proxyId).reserve.hpBonus,1);
  assert.equal(f.player(leader.id).active.level,1);
  assert.equal(f.player(leader.id).active.hpBonus,0);
  assert.equal(watched.players.find(seat=>seat.id===leader.id).role,null);
  assert.equal(publicAiTable(f.room(),catalogue).find(seat=>seat.id===leader.id).role,null);
});

test('Viridian Gym publishes a clue only after payment and reveals the Leader at the start of round three',t=>{
  const f = match(t,5);
  f.start(); f.acknowledge(); f.draft(); f.passAll();
  const {proxyId} = f.room().scenario.viridian;
  const leaderId = f.room().players.find(seat=>seat.role==='leader').id;
  const proxy = f.byId(proxyId);
  const publicView = ()=>f.view(f.watcher);
  const watchRole = id=>publicView().players.find(seat=>seat.id===id).role;
  const choose = (choice,effect)=>f.act(proxy,'respondBattle',{decisionId:f.room().pendingBattle.id,choice,
    ...(effect===undefined?{}:{effect})});
  const opened = f.act(proxy,'tourAction',{action:'viridian-investigate'});
  assert.ok(opened.pendingBattle.options.some(option=>option.value===leaderId));
  assert.equal(publicView().pendingBattle.options,undefined);
  choose('choose',leaderId);
  const handBefore = f.view(proxy).self.hand.length;
  choose('pass');
  assert.deepEqual(publicView().scenario.viridian.clues,{});
  assert.equal(f.view(proxy).self.hand.length,handBefore);
  f.act(proxy,'tourAction',{action:'viridian-investigate'});
  choose('choose',leaderId);
  f.restart();
  const payment = f.view(proxy).pendingBattle.options[0].value;
  choose('choose',payment);
  assert.equal(f.view(proxy).self.hand.length,handBefore-1);
  assert.ok(f.room().discardPile.some(card=>card.id===payment));
  assert.equal(publicView().scenario.viridian.clues[leaderId],false);
  assert.equal(watchRole(leaderId),null);
  assert.throws(()=>f.act(proxy,'tourAction',{action:'viridian-investigate'}),{code:'ACTION_UNAVAILABLE'});
  for(let i=0;i<5;i++) f.end();
  assert.equal(publicView().scenario.viridian.round,2);
  assert.equal(watchRole(leaderId),null);
  for(let i=0;i<5;i++) f.end();
  assert.equal(publicView().scenario.viridian.round,3);
  assert.equal(watchRole(leaderId),'leader');
  assert.equal(publicView().visualEvents.filter(event=>event.kind==='identity-reveal'&&event.targetIds.includes(leaderId)).length,1);
  assert.ok(!f.view(proxy).self.battle.tourActions.some(action=>action.kind==='viridian-investigate'));
});

test('Viridian Gym reveals the true Leader as soon as the acting leader is eliminated',t=>{
  const f = match(t,5);
  f.start(); f.acknowledge(); f.draft(); f.end();
  const {proxyId} = f.room().scenario.viridian;
  f.knockout(proxyId);
  const watched = f.view(f.watcher);
  assert.equal(watched.status,'playing');
  assert.equal(watched.scenario.viridian.round,1);
  assert.equal(watched.scenario.viridian.leaderRevealed,true);
  assert.ok(watched.players.some(seat=>seat.role==='leader'&&!seat.eliminated));
  assert.ok(watched.players.some(seat=>seat.id===proxyId&&seat.eliminated));
  for(let i=0;i<8;i++) f.end();
  assert.equal(f.view(f.watcher).visualEvents.filter(event=>event.kind==='identity-reveal').length,1);
});

test('Viridian Gym can settle on a hidden Leader knockout and preserves the scenario setting for a rematch',t=>{
  const f = match(t,5);
  f.start(); f.acknowledge(); f.draft(); f.passAll();
  const trainers = f.room().players.filter(seat=>!seat.spectator);
  const leaderIndex = trainers.findIndex(seat=>seat.role==='leader');
  const neighborIndex = leaderIndex===trainers.length-1 ? leaderIndex-1 : leaderIndex+1;
  for(let i=0;i<neighborIndex;i++) f.end();
  const leaderId = trainers[leaderIndex].id;
  assert.equal(f.view(f.watcher).players.find(seat=>seat.id===leaderId).role,null);
  f.knockout(leaderId);
  const ended = f.view(f.watcher);
  assert.equal(ended.status,'finished');
  assert.equal(ended.result.winner,'challengers');
  assert.equal(ended.result.winnerIds.length,2);
  assert.equal(ended.scenario.viridian.leaderRevealed,true);
  const lobby = f.act(f.host,'returnToLobby');
  assert.equal(lobby.status,'lobby');
  assert.equal(lobby.settings.identityScenario,VIRIDIAN_GYM);
  assert.equal(lobby.scenario?.viridian,undefined);
  const replay=f.start();
  assert.equal(replay.scenario.viridian.round,0);
  assert.deepEqual(replay.scenario.viridian.clues,{});
});

test('Gym Guard is optional, public from setup and assigned to the other Gym Trainer when present',t=>{
  const standard = match(t,5);
  assert.throws(()=>standard.settings({identityScenario:'standard',gymGuard:true}),{code:'INVALID_SETTINGS'});
  assert.throws(()=>standard.settings({gymGuard:'true'}),{code:'INVALID_SETTINGS'});
  standard.start();
  assert.equal(standard.view(standard.watcher).scenario.viridian.guard,undefined);
  const large = match(t,8,{gymGuard:true});
  large.start();
  const watched = large.view(large.watcher);
  const {guard,proxyId} = watched.scenario.viridian;
  assert.notEqual(guard.playerId,proxyId);
  assert.equal(guard.used,false);
  assert.deepEqual(watched.players.filter(player=>player.role).map(player=>player.id).sort(),
    [guard.playerId,proxyId].sort());
  assert.ok(watched.players.filter(player=>player.role).every(player=>player.role==='gym'));
});

test('Gym Guard cannot expose a hidden Leader and accepts a legal single-target interception only once',t=>{
  const f = match(t,5,{gymGuard:true});
  f.start();f.acknowledge();f.draft();f.passAll();
  const state=()=>f.room().scenario.viridian;
  const {guard,proxyId}=state();
  assert.equal(guard.playerId,proxyId);
  const seats=f.room().players.filter(player=>!player.spectator);
  const leaderIndex=seats.findIndex(player=>player.role==='leader');
  const leaderId=seats[leaderIndex].id;
  const sourceId=seats.find((player,index)=>[2,3].includes(index) &&
    Math.min(Math.abs(index-leaderIndex),seats.length-Math.abs(index-leaderIndex))===1).id;
  const source=f.byId(sourceId), protector=f.byId(guard.playerId);
  function reach(round){
    while(state().round<round||f.room().turn.playerId!==sourceId) f.end();
    f.passAll();
  }
  function attack(speed){
    const actor=f.player(sourceId);
    actor.active.reinforcements=speed?['speed']:[];
    const cardId=f.takeCommand(actor).id;
    return f.act(source,'attack',{cardId,moveIndex:0,targetIds:[leaderId]});
  }
  function decline(expectedTarget){
    assert.equal(f.room().pendingBattle.kind,'defense');
    assert.equal(f.room().pendingBattle.targetId,expectedTarget);
    f.passAll();
  }
  function respond(choice,effect){
    return f.act(protector,'respondBattle',{decisionId:f.room().pendingBattle.id,choice,...(effect?{effect}:{})});
  }
  reach(1);
  attack(true);
  decline(leaderId);
  assert.equal(state().leaderRevealed,false);
  assert.equal(state().guard.used,false);
  reach(3);
  attack(false);
  decline(leaderId);
  assert.equal(state().guard.used,false);
  f.player(leaderId).active.damage=0;
  reach(4);
  attack(true);
  assert.equal(f.room().pendingBattle.actorId,guard.playerId);
  assert.deepEqual(tourTimeoutChoice(f.room().pendingBattle),{choice:'pass'});
  respond('pass');
  decline(leaderId);
  assert.equal(state().guard.used,false);

  reach(5);
  const leaderDamage=f.player(leaderId).active.damage;
  attack(true);
  const guardHand=f.view(protector).self.hand.length;
  const pendingId=f.room().pendingBattle.id;
  assert.equal(f.view(f.watcher).pendingBattle.options,undefined);
  f.restart();
  assert.equal(f.room().pendingBattle.id,pendingId);
  assert.equal(state().guard.used,false);
  respond('choose','guard');
  assert.equal(f.room().pendingBattle.targetId,guard.playerId);
  assert.equal(f.view(protector).self.hand.length,guardHand);
  assert.equal(state().guard.used,true);
  decline(guard.playerId);
  assert.equal(f.player(leaderId).active.damage,leaderDamage);
  assert.equal(f.player(guard.playerId).active.damage,1);

  reach(6);
  attack(true);
  decline(leaderId);
  assert.equal(state().guard.used,true);
});

test('Rocket Partners is a Viridian option and exposes aliases only to the pair until revealed',t=>{
  const f = match(t,5,{rocketPartners:true});
  assert.throws(()=>f.settings({identityScenario:'standard',rocketPartners:true}),{code:'INVALID_SETTINGS'});
  assert.throws(()=>f.settings({rocketPartners:'true'}),{code:'INVALID_SETTINGS'});
  f.start();
  const rockets = f.room().players.filter(player=>player.role==='rocket');
  assert.deepEqual(rockets.map(player=>player.rocketAlias).sort(),['james','jessie']);
  assert.equal(f.room().players.filter(player=>player.role==='challenger').length,1);
  const outsider = f.byId(f.room().players.find(player=>player.role==='challenger').id);
  const watch = ()=>f.view(f.watcher);
  for(const seat of [outsider,f.watcher]){
    const view=f.view(seat);
    assert.equal(view.self.rocketPartner,undefined);
    assert.equal(view.self.rocketAlias,undefined);
    assert.ok(view.players.every(player=>!player.rocketAlias));
    assert.ok(view.players.every(player=>player.role!=='rocket'));
  }
  for(const player of rockets){
    const partner=rockets.find(other=>other.id!==player.id);
    const view=f.view(f.byId(player.id));
    assert.equal(view.self.rocketAlias,player.rocketAlias);
    assert.deepEqual(view.self.rocketPartner,{id:partner.id,nickname:partner.nickname,alias:partner.rocketAlias});
    assert.equal(view.players.find(other=>other.id===partner.id).role,null);
  }
  f.restart();
  assert.equal(f.view(f.byId(rockets[0].id)).self.rocketPartner.id,rockets[1].id);
  f.acknowledge(); f.draft(); f.passAll();
  assert.ok(publicAiTable(f.room(),catalogue).every(seat=>seat.role!=='rocket'&&seat.rocketPartner===undefined));
  while(f.room().turn.playerId!==rockets[0].id) f.end();
  f.act(f.byId(rockets[0].id),'revealRole');
  assert.equal(watch().players.find(player=>player.id===rockets[0].id).rocketAlias,rockets[0].rocketAlias);
  assert.equal(watch().players.find(player=>player.id===rockets[1].id).rocketAlias,undefined);
});

test('Rocket Partners AI spares its hidden partner and both identities win when only Rocket survives', t=>{
  for(const partnerAlive of [true,false]){
    const f = match(t,5,{rocketPartners:true});
    f.start();f.acknowledge();f.draft();f.passAll();
    const room=f.room();
    const leader=room.players.find(seat=>seat.role==='leader');
    const [source,partner]=room.players.filter(seat=>seat.role==='rocket');
    while(f.room().scenario.viridian.round<3||f.room().turn.playerId!==source.id) f.end();
    for(const seat of f.room().players.filter(seat=>!seat.spectator&&seat.role!=='leader'&&seat.id!==source.id)){
      if(seat.id!==partner.id||!partnerAlive) seat.eliminated=true;
    }
    const actor=f.player(source.id);
    actor.active.reinforcements.push('speed');
    const leaderNow=f.player(leader.id);
    leaderNow.reserve.defeated=true;
    leaderNow.active.damage=maxHp(leaderNow.active,catalogue)-1;
    const card=f.takeCommand(actor);
    const targeted=aiActions(f.room(),actor,catalogue).filter(action=>action.type==='attack');
    assert.ok(targeted.some(action=>action.targetIds.includes(leader.id)));
    assert.ok(targeted.every(action=>!action.targetIds.includes(partner.id)));
    f.act(f.byId(actor.id),'attack',{cardId:card.id,moveIndex:0,targetIds:[leader.id]});
    f.passAll();
    const result=f.view(f.watcher);
    assert.equal(result.status,'finished');
    assert.equal(result.result.winner,'rocket');
    assert.deepEqual(result.result.winnerIds.toSorted(),[source.id,partner.id].sort());
    assert.deepEqual(result.players.filter(player=>player.rocketAlias).map(player=>player.rocketAlias).sort(),['james','jessie']);
    const lobby=f.act(f.host,'returnToLobby');
    assert.equal(lobby.settings.rocketPartners,true);
    assert.ok(lobby.players.every(player=>player.rocketAlias===undefined));
    assert.ok(f.room().players.every(player=>player.rocketAlias===undefined));
  }
});

test('Rocket Partners still awards the Challengers if a non-Rocket opponent outlives the Leader',t=>{
  const f=match(t,5,{rocketPartners:true});
  f.start();f.acknowledge();f.draft();f.passAll();
  const trainers=f.room().players.filter(player=>!player.spectator);
  const leaderIndex=trainers.findIndex(player=>player.role==='leader');
  const neighborIndex=leaderIndex===trainers.length-1?leaderIndex-1:leaderIndex+1;
  for(let i=0;i<neighborIndex;i++) f.end();
  const leaderId=trainers[leaderIndex].id;
  f.knockout(leaderId);
  const ended=f.view(f.watcher);
  assert.equal(ended.status,'finished');
  assert.equal(ended.result.winner,'challengers');
  assert.equal(ended.result.winnerIds.length,1);
});

test('Rocket Infiltrator is optional and preserves a Challenger seat when both variants are selected',t=>{
  const five = match(t,5,{rocketInfiltration:true,rocketPartners:true});
  assert.throws(()=>five.start(),{code:'INVALID_VIRIDIAN_SIZE'});
  assert.throws(()=>five.settings({identityScenario:'standard',rocketPartners:false,rocketInfiltration:true}),{code:'INVALID_SETTINGS'});
  const disabled = match(t,5);
  disabled.start();
  assert.ok(disabled.room().players.every(player=>player.role!=='infiltrator'));
  const six = match(t,6,{rocketInfiltration:true,rocketPartners:true});
  six.start();
  const roles = six.room().players.map(player=>player.role);
  assert.equal(roles.filter(role=>role==='infiltrator').length,1);
  assert.equal(roles.filter(role=>role==='challenger').length,1);
  assert.equal(roles.filter(role=>role==='rocket').length,2);
});

test('Rocket Infiltrator decides after the second forecast, stays private until the plot, and joins permanently',t=>{
  const f=match(t,6,{rocketInfiltration:true,rocketPartners:true,contentPack:'hoenn-weather',weatherLab:true,autoJudgment:false});
  f.start(); f.acknowledge(); f.draft();
  const actor=f.room().players.find(player=>player.role==='infiltrator');
  const actorSeat=f.byId(actor.id);
  const watched=()=>f.view(f.watcher);
  assert.equal(watched().players.find(player=>player.id===actor.id).role,null);
  assert.equal(watched().scenario.viridian.infiltrator,undefined);
  assert.equal(f.view(actorSeat).self.role,'infiltrator');
  assert.ok(!publicAiTable(f.room(),catalogue).some(seat=>seat.role==='infiltrator'));
  function revealForecast(){
    const pending=f.room().pendingBattle;
    assert.equal(pending.kind,'reveal-judgment');
    f.act(f.byId(pending.actorId),'respondBattle',{decisionId:pending.id,choice:'reveal'});
    while(f.room().pendingBattle?.continuation?.kind==='future-sight-event') {
      const p=f.room().pendingBattle;
      f.act(f.byId(p.actorId),'respondBattle',{decisionId:p.id,choice:'pass'});
    }
  }
  revealForecast();
  for(let i=0;i<6;i++){
    if(f.room().turn.playerId===actor.id) {
      assert.throws(()=>f.act(actorSeat,'revealRole'),{code:'INFILTRATOR_AWAITS_PLEDGE'});
    }
    f.end();
  }
  assert.equal(watched().scenario.viridian.round,2);
  assert.equal(watched().pendingBattle.kind,'reveal-judgment');
  revealForecast();
  const pending=f.room().pendingBattle;
  assert.equal(pending.actorId,actor.id);
  assert.equal(pending.continuation.kind,'rocket-pledge');
  assert.equal(watched().pendingBattle.options,undefined);
  assert.equal(watched().scenario.viridian.infiltrator,undefined);
  assert.equal(watched().players.find(player=>player.id===actor.id).role,null);
  const own=f.view(actorSeat).pendingBattle;
  assert.deepEqual(own.options.map(option=>option.value),['independent','rocket']);
  const turnSeat=f.byId(f.room().turn.playerId);
  assert.throws(()=>f.act(turnSeat,'draw'),{code:'RESPONSE_PENDING'});
  assert.throws(()=>f.act(actorSeat,'respondBattle',{decisionId:pending.id,choice:'pass'}),{code:'INVALID_RESPONSE'});
  f.restart();
  assert.equal(f.view(actorSeat).pendingBattle.id,pending.id);
  const [choice]=aiActions(f.room(),f.player(actor.id),catalogue);
  assert.equal(choice.effect,'rocket');
  f.act(actorSeat,'respondBattle',{decisionId:pending.id,choice:'choose',effect:'rocket'});
  const joined=watched();
  assert.deepEqual(joined.scenario.viridian.infiltrator,{playerId:actor.id,choice:'rocket'});
  assert.equal(joined.players.find(player=>player.id===actor.id).role,'rocket');
  assert.equal(f.view(actorSeat).self.rocketPartner,undefined);
  assert.equal(joined.scenario.weatherLab.round,2);
  assert.equal(joined.turn.phase,'play');
  assert.equal(joined.pendingBattle,null);
  assert.throws(()=>f.act(actorSeat,'respondBattle',{decisionId:pending.id,choice:'choose',effect:'independent'}),{code:'STALE_DECISION'});
  assert.equal(watched().scenario.viridian.infiltrator.choice,'rocket');
});

test('Rocket Infiltrator’s response clock defaults to staying independent and advances the turn',t=>{
  let now=1_000_000;
  const f=match(t,5,{rocketInfiltration:true,responseSeconds:5,now:()=>now});
  f.start();f.acknowledge();f.draft();f.passAll();
  for(let i=0;i<5;i++)f.end();
  const pending=f.room().pendingBattle;
  assert.equal(pending.continuation.kind,'rocket-pledge');
  assert.ok(pending.clock.deadlineAt>now);
  now=pending.clock.deadlineAt+1;
  const settled=f.view(f.byId(pending.actorId));
  assert.equal(settled.pendingBattle,null);
  assert.equal(settled.turn.phase,'play');
  assert.equal(settled.self.role,'infiltrator');
  assert.deepEqual(settled.scenario.viridian.infiltrator,{playerId:pending.actorId,choice:'independent'});
});

test('Rocket Infiltrator skips the declaration if already eliminated',t=>{
  const f=match(t,5,{rocketInfiltration:true});
  f.start();f.acknowledge();f.draft();f.passAll();
  const roster=f.room().players.filter(player=>!player.spectator);
  const targetIndex=roster.findIndex(player=>player.role==='infiltrator');
  const attackerIndex=targetIndex===roster.length-1?targetIndex-1:targetIndex+1;
  for(let i=0;i<attackerIndex;i++) f.end();
  f.knockout(roster[targetIndex].id);
  assert.equal(f.player(roster[targetIndex].id).eliminated,true);
  while(f.room().scenario.viridian.round===1)f.end();
  const watched=f.view(f.watcher);
  assert.equal(watched.scenario.viridian.round,2);
  assert.equal(watched.scenario.viridian.infiltrator,undefined);
  assert.equal(watched.pendingBattle,null);
  assert.equal(watched.turn.phase,'play');
});

test('Rocket Infiltrator wins alone or shares the Rocket victory according to the committed allegiance',t=>{
  for(const choice of ['independent','rocket']){
    const join=choice==='rocket';
    const f=match(t,6,{rocketInfiltration:true,rocketPartners:join});
    f.start();f.acknowledge();f.draft();f.passAll();
    for(let i=0;i<6;i++) f.end();
    const p=f.room().pendingBattle;
    const actor=f.byId(p.actorId);
    f.act(actor,'respondBattle',{decisionId:p.id,choice:'choose',effect:choice});
    while(f.room().turn.playerId!==p.actorId) f.end();
    const leader=f.room().players.find(player=>player.role==='leader');
    for(const seat of f.room().players.filter(seat=>!seat.spectator&&seat.role!=='leader'&&seat.id!==p.actorId)){
      if(!join||seat.role!=='rocket')seat.eliminated=true;
    }
    f.player(p.actorId).active.reinforcements.push('speed');
    f.knockout(leader.id);
    const ended=f.view(f.watcher);
    assert.equal(ended.status,'finished');
    assert.equal(ended.result.winner,join?'rocket':'infiltrator');
    assert.ok(ended.result.winnerIds.includes(p.actorId));
    assert.equal(ended.result.winnerIds.length,join?3:1);
    assert.equal(ended.scenario.viridian.infiltrator.choice,choice);
    const lobby=f.act(f.host,'returnToLobby');
    assert.equal(lobby.settings.rocketInfiltration,true);
    assert.equal(lobby.scenario?.viridian,undefined);
  }
});
