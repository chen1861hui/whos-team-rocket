import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoomStore } from '../server/store.js';
import { evaluateVictory, maxHp } from '../server/battle-rules.js';
import { playBattleMove, respondBattle } from '../server/combat.js';
import { buildRulebook } from '../public/rulebook.js';

const catalogue=JSON.parse(readFileSync(new URL('../content/catalogue.json',import.meta.url),'utf8'));

function table(t,scenario,count,assignment='seat'){
  const dataDir=mkdtempSync(join(tmpdir(),'rocket-objectives-'));
  t.after(()=>rmSync(dataDir,{recursive:true,force:true}));
  const options={dataDir,catalogue,scheduleAi:()=>null,now:()=>1_000_000};
  let store=new RoomStore(options), serial=0;
  const host=store.create({nickname:'First'});
  const room=()=>store.rooms.get(host.code);
  const view=(seat=host)=>store.view(host.code,seat.token).view;
  const act=(seat,type,args={})=>store.action(host.code,seat.token,{id:'objective-'+(++serial),revision:room().revision,type,...args}).view;
  act(host,'settings',{arena:'grass',turnSeconds:0,responseSeconds:0,autoDraw:true,matchMode:'teams',teamScenario:scenario,teamAssignment:assignment});
  const seats=[host,...Array.from({length:count-1},(_,index)=>store.join(host.code,{nickname:'Trainer '+(index+2)}))];
  const observer=store.join(host.code,{nickname:'Observer',spectator:true});
  const byId=id=>seats.find(seat=>seat.playerId===id);
  const turn=()=>byId(room().turn.playerId);
  const player=seat=>room().players.find(entry=>entry.id===seat.playerId);
  const boss=()=>room().players.find(player=>player.raidBoss);
  const take=predicate=>{
    const piles=[room().drawPile,room().discardPile,...room().players.map(player=>player.hand)];
    const pile=piles.find(pile=>pile.some(predicate));
    assert.ok(pile,'A physical card should be available');
    return pile.splice(pile.findIndex(predicate),1)[0];
  };
  const resolve=(choice,effect)=>{
    const pending=room().pendingBattle;
    const args={decisionId:pending.id,choice,...(effect?{effect}:{})};
    const seat=byId(pending.actorId);
    if(seat)act(seat,'respondBattle',args);
    else respondBattle(room(),boss(),args,store.battleContext());
  };
  function play(){
    for(const seat of seats)act(seat,'ready',{ready:true});
    act(host,'startBattlePreview');
    for(const seat of seats)act(seat,'acknowledgeIdentity');
    for(const seat of seats){
      player(seat).candidateDeal=['gastly','bulbasaur','clefairy','geodude','onix'];
      for(let i=0;i<5;i++)act(seat,'drawPokemon');
      act(seat,'selectPokemon',{activeId:'gastly',reserveId:'clefairy'});
    }
    while(room().turn.drawRemaining)act(turn(),'draw');
  }
  function pay(who,action,{cancel=false}={}){
    const chosen=take(card=>card.weather==='clear'), other=take(card=>card.weather==='rain');
    player(who).hand.push(chosen,other);
    act(who,'tourAction',{action});
    resolve('choose',chosen.id);
    if(cancel)resolve('pass');
    else resolve('choose',other.id);
    return [chosen,other];
  }
  function end(who=turn()){
    while(room().turn.drawRemaining)act(who,'draw');
    let result=act(who,'finishPlay');
    while(result.turn.phase==='discard')result=act(who,'discard',{cardId:result.self.hand[0].id});
    return act(who,'endTurn');
  }
  return {host,room,seats,observer,view,act,turn,player,boss,take,resolve,play,pay,end,
    ctx:()=>store.battleContext(),restart(){store=new RoomStore(options);}};
}

test('Lake of Rage preselects a separate boss, makes it attackable at range, and clears its seat when finished',t=>{
  const f=table(t,'lake-rage',6);
  f.play();
  const id=f.boss().id;
  assert.equal(f.room().scenario.lake.challengers,6);
  assert.equal(f.boss().reserve,null);
  assert.equal(f.boss().active.level,2);
  assert.equal(f.view(f.observer).players.find(seat=>seat.id===id).active.raidColor,'red');
  // The second acting trainer is not adjacent to the boss.
  f.end();
  let who=f.turn();
  assert.ok(f.view(who).self.battle.moves[0].legalTargetIds.includes(id));
  const [first,second]=f.pay(who,'lake-shutoff',{cancel:true});
  assert.equal(f.room().scenario.lake.transmitter,true);
  assert.ok(f.player(who).hand.some(card=>card.id===first.id));
  assert.ok(f.player(who).hand.some(card=>card.id===second.id));
  const paid=f.pay(who,'lake-shutoff');
  assert.equal(f.room().scenario.lake.transmitter,false);
  assert.ok(paid.every(cost=>f.room().discardPile.some(card=>card.id===cost.id)));

  for(const phase of [1,2]){
    who=f.turn();
    const previous=f.boss().active.instanceId;
    f.boss().active.damage=maxHp(f.boss().active,catalogue)-1;
    const command=f.take(card=>card.kind==='command');
    f.player(who).hand.push(command);
    f.act(who,'attack',{cardId:command.id,targetIds:[id]});
    while(f.room().pendingBattle){
      assert.notEqual(f.room().pendingBattle.kind,'rescue');
      f.resolve('pass');
    }
    if(phase===1){
      assert.equal(f.room().scenario.lake.phase,2);
      assert.notEqual(f.boss().active.instanceId,previous);
      assert.equal(f.boss().active.damage,0);
      assert.equal(f.boss().active.status,null);
      f.end();
    }
  }
  assert.equal(f.view().result.reason,'boss-defeated');
  assert.equal(f.view().result.winnerIds.length,6);
  assert.ok(f.act(f.host,'returnToLobby').players.every(seat=>!seat.raidBoss));
});

test('the lake transmitter increases the boss’s opening damage and the cooperative side can lose',t=>{
  const f=table(t,'lake-rage',2);
  f.play();
  f.end();
  f.end();
  assert.equal(f.room().turn.playerId,f.boss().id);
  const target=f.room().players.find(player=>player.role==='team-a');
  assert.equal(f.room().turn.phase,'play');
  target.active.damage=maxHp(target.active,catalogue)-1;
  target.reserve.defeated=true;
  f.room().players.find(player=>player.role==='team-a' && player!==target).eliminated=true;
  const card=f.take(card=>card.kind==='command');
  f.boss().hand.push(card);
  playBattleMove(f.room(),f.boss(),{cardId:card.id,targetIds:[target.id]},f.ctx());
  assert.equal(f.room().resolution.baseDamage,3);
  while(f.room().pendingBattle)f.resolve('pass');
  assert.equal(f.view().result.reason,'raid-failed');
  assert.deepEqual(f.view().result.winnerIds,[f.boss().id]);
});

test('Silph Co. assigns three equal teams and refuses unsupported seat counts',t=>{
  for(const [count,assignment] of [[6,'seat'],[12,'random']]){
    const f=table(t,'silph-control',count,assignment);
    f.play();
    assert.ok(['team-a','team-b','team-c'].every(role=>f.room().players.filter(player=>player.role===role).length===count/3));
    if(assignment==='seat')assert.deepEqual(f.room().players.filter(player=>!player.spectator)
      .sort((a,b)=>a.seatNumber-b.seatNumber).map(player=>player.role),['team-a','team-b','team-c','team-a','team-b','team-c']);
    assert.ok(buildRulebook(f.room().settings).sections.some(section=>section.id==='silph'));
    assert.ok(!buildRulebook(f.room().settings).sections.some(section=>section.id==='lake'));
  }
  const invalid=table(t,'silph-control',8);
  assert.throws(()=>invalid.play(),{code:'INVALID_TEAM_SIZE'});
});

test('Silph control survives reconnect, restarts on takeover and settles when its claiming seat is passed',t=>{
  const f=table(t,'silph-control',6);
  f.play();
  const first=f.turn();
  f.pay(first,'silph-claim');
  const firstTeam=f.player(first).role;
  assert.equal(f.view(f.observer).scenario.silph.control.team,firstTeam);
  assert.throws(()=>f.act(first,'tourAction',{action:'silph-claim'}),{code:'ACTION_UNAVAILABLE'});
  f.end(first);
  const rival=f.turn();
  assert.notEqual(f.player(rival).role,firstTeam);
  f.pay(rival,'silph-claim');
  const rivalTeam=f.player(rival).role;
  f.restart();
  assert.deepEqual(f.view(f.observer).scenario.silph.control,{team:rivalTeam,anchorId:rival.playerId});
  // A knocked-out claimant is skipped, but their surviving team keeps their claim.
  f.player(rival).eliminated=true;
  f.view(f.observer);
  for(let index=0;index<4;index++){
    assert.equal(f.room().status,'playing');
    f.end();
  }
  assert.equal(f.room().status,'playing');
  assert.equal(f.turn().playerId,first.playerId);
  f.end();
  const result=f.view().result;
  assert.equal(result.reason,'master-ball');
  assert.equal(result.winner,rivalTeam);
  assert.ok(result.winnerIds.includes(rival.playerId));
  const survivors=f.room().players.map(seat=>({...seat,eliminated:seat.role!=='team-c'}));
  assert.equal(evaluateVictory(survivors,'teams',f.room().settings).winner,'team-c');
});
