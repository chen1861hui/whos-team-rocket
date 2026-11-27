import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoomStore } from '../server/store.js';
import { battleSelectionIds, previewActions } from '../server/combat.js';
import { aiActions } from '../server/ai-players.js';
import { maxHp } from '../server/battle-rules.js';
import { TOUR_PACK, HOENN_PACK, MIXED_PACK, tourPokemon, tourCards } from '../public/expansion-content.js';
import { RADIO_TOWER } from '../public/match-mode.js';
const base = JSON.parse(readFileSync(new URL('../content/catalogue.json',import.meta.url),'utf8'));

function fixture(t, {count=4, pack=TOUR_PACK, play=true, responseSeconds=0, mimikyuAvailable=false, lineups, mode='teams', teamScenario, weatherLab, autoJudgment, manualFollowMe=false, now=()=>1_000_000}={}) {
  const dir = mkdtempSync(join(tmpdir(),'tour-test-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  let store = new RoomStore({dataDir:dir,catalogue:{...base,mimikyuAvailable},now});
  const host=store.create({nickname:'Host'});
  let serial=0;
  const apply=(who,type,fields)=>store.action(host.code,who.token,{id:'tour-'+(++serial),revision:room().revision,type,...fields}).view;
  function act(who,type,fields={}) {
    const result=apply(who,type,fields);
    if (manualFollowMe || room().pendingBattle?.continuation?.kind!=='follow-me') return result;
    // Existing card tests let eligible allies decline this optional team response.
    while (room().pendingBattle?.continuation?.kind==='follow-me') {
      const {actorId,id}=room().pendingBattle;
      apply(byId(actorId),'respondBattle',{decisionId:id,choice:'pass'});
    }
    return store.view(host.code,who.token).view;
  }
  const room=()=>store.rooms.get(host.code);
  act(host,'settings',{arena:'fire',turnSeconds:0,responseSeconds,matchMode:mode,contentPack:pack,weatherLab,autoJudgment,...(teamScenario?{teamScenario}:{}),...(lineups?{teamAssignment:'seat'}:{})});
  const seats=[host,...Array.from({length:count-1},(_,i)=>store.join(host.code,{nickname:'Trainer '+(i+1)}))];
  act(host,'settings',{arena:'fire',turnSeconds:0,responseSeconds,matchMode:mode,contentPack:pack,weatherLab,autoJudgment,...(teamScenario?{teamScenario}:{}),...(lineups?{teamAssignment:'seat'}:{})});
  seats.forEach(who=>act(who,'ready',{ready:true}));
  act(host,'startBattlePreview');
  const byId=id=>seats.find(who=>who.playerId===id);
  if(play) {
    seats.forEach(who=>act(who,'acknowledgeIdentity'));
    for(const who of seats) {
      const position = room().players.findIndex(player=>player.id===who.playerId);
      if (lineups) room().players[position].candidateDeal = [lineups[position],'pikachu','clefairy','geodude','onix'];
      for(let i=0;i<5;i++)act(who,'drawPokemon');
      const candidates=store.view(host.code,who.token).view.self.candidates;
      const avoid=['tauros','koffing','jynx'];
      const picks=candidates.toSorted((a,b)=>Number(avoid.includes(a))-Number(avoid.includes(b)));
      act(who,'selectPokemon',{activeId:lineups?.[position] ?? picks[0],reserveId:lineups ? 'pikachu' : picks[1]});
    }
    if (!lineups) for(const p of room().players) {
      p.active.catalogueId='tour-treecko';p.active.level=1;p.active.hpBonus=0;p.active.damage=0;
      delete p.active.hoennIllusion;
      p.reserve.catalogueId='tour-totodile';p.reserve.level=1;p.reserve.damage=0;p.reserve.hpBonus=0;
    }
    while(room().pendingBattle)pass();
    while(room().turn.drawRemaining)act(byId(room().turn.playerId),'draw');
  }
  const view=(who=host)=>store.view(host.code,who.token).view;
  const player=who=>room().players.find(p=>p.id===who.playerId);
  const turn=()=>byId(room().turn.playerId);
  function pass() {
    const pending=room().pendingBattle;
    return act(byId(pending.actorId),'respondBattle',{decisionId:pending.id,choice:'pass'});
  }
  const choose=value=>{
    const pending=room().pendingBattle;
    return act(byId(pending.actorId),'respondBattle',{decisionId:pending.id,choice:'choose',effect:value});
  };
  function take(who,predicate) {
    const piles=[room().drawPile,room().discardPile,...room().players.map(p=>p.hand)];
    for(const pile of piles) {
      const i=pile.findIndex(predicate);
      if(i<0)continue;
      const [card]=pile.splice(i,1);
      player(who).hand.push(card);
      return card;
    }
    throw new Error('No physical card matches');
  }
  const tool=(who,kind,effect,slot='active')=>{
    const card=take(who,c=>c.toolType===kind);
    return act(who,'useTool',{cardId:card.id,effect,targetId:who.playerId,slot});
  };
  const equip=(who,type)=>{const card=take(who,c=>c.itemType===type);act(turn(),'equipItem',{cardId:card.id,slot:'active'});return card;};
  const attach=(who,type)=>{
    const card=take(who,c=>c.itemType===type);
    player(who).hand.splice(player(who).hand.indexOf(card),1);
    player(who).active.item=card;
    return card;
  };
  const attack=(target,index=0)=>{
    const card=take(turn(),c=>c.kind==='command');
    return act(turn(),'attack',{cardId:card.id,moveIndex:index,targetIds:[target.playerId]});
  };
  return {act,room,host,seats,byId,view,player,turn,pass,choose,take,tool,equip,attach,attack,spectate:()=>store.join(host.code,{nickname:"Observer",spectator:true}),
    catalogue:()=>store.catalogue, restart(){store=new RoomStore({dataDir:dir,catalogue:{...base,mimikyuAvailable},now});}};
}

test('tour pack uses 132 physical cards, four balanced weathers, and six homebrew groups only when enabled', t=>{
  for(const pack of ['base',TOUR_PACK]) {
    const f=fixture(t,{pack});
    assert.equal(battleSelectionIds(f.catalogue(),pack).length,pack==='base'?40:46);
    const cards=[...f.room().drawPile,...f.room().discardPile,...f.room().players.flatMap(p=>p.hand)];
    assert.equal(cards.length,pack==='base'?108:132);
    assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
    for(const weather of ['intense-sun','clear','rain','thunderstorm'])assert.equal(cards.filter(c=>c.weather===weather).length,pack==='base'?27:33);
    assert.equal(tourCards().length,24);
  }
  const large=fixture(t,{count:30,play:false});
  assert.equal(large.room().scenario.deckCardCount,264);
  large.restart();
  assert.equal(large.view().settings.contentPack,TOUR_PACK);
});

test('tour split medicine and berry respect living reserves and reject invalid use atomically', t=>{
  const f=fixture(t),who=f.turn(),p=f.player(who);
  p.reserve.damage=2;
  f.tool(who,'tour-medicine-power','tour-heal','reserve');
  assert.equal(f.player(who).reserve.damage,1);
  f.player(who).reserve.status='paralysis';
  f.tool(who,'tour-recycle-berry','tour-berry','reserve');
  assert.equal(f.player(who).reserve.status,null);
  f.tool(who,'tour-medicine-power','tour-power');
  assert.ok(f.player(who).active.reinforcements.includes('power'));
  const card=f.take(who,c=>c.toolType==='tour-recycle-berry');
  const before=JSON.stringify(f.room());
  assert.throws(()=>f.act(who,'useTool',{cardId:card.id,effect:'tour-berry',targetId:who.playerId,slot:'active'}),{code:'INVALID_TARGET'});
  assert.equal(JSON.stringify(f.room()),before);
});

test('Pokédex hides inspected cards from other trainers and survives restart with the chosen top order', t=>{
  const f=fixture(t),who=f.turn(),other=f.seats.find(s=>s!==who);
  f.tool(who,'tour-gear-dex','tour-dex');
  const mine=f.view(who).pendingBattle,hidden=f.view(other).pendingBattle;
  assert.ok(mine.options[0].card.id);
  assert.equal(hidden.options,undefined);
  assert.equal(mine.continuation,undefined);
  const chosen=mine.options.at(-1).value;
  f.restart();f.choose(chosen);
  assert.equal(f.room().drawPile.at(-1).id,chosen);
  assert.equal(f.room().expansionTool,undefined);
});

test('Pokégear discards another card and retrieves only same-weather discarded tools', t=>{
  const f=fixture(t),who=f.turn();
  f.tool(who,'tour-gear-dex','tour-gear');
  const discarded=f.room().pendingBattle.options.find(option=>option.card.kind==='tool') || f.room().pendingBattle.options[0];
  const before=f.player(who).hand.length;
  f.choose(discarded.value);
  assert.equal(f.player(who).hand.length,before);
  const recycle=f.take(who,c=>c.toolType==='tour-recycle-berry');
  const match=f.room().discardPile.find(c=>c.kind==='tool'&&c.weather===recycle.weather);
  if(!match) {
    const seed=f.take(who,c=>c.kind==='tool'&&c.weather===recycle.weather&&c.id!==recycle.id);
    f.player(who).hand.splice(f.player(who).hand.indexOf(seed),1);f.room().discardPile.push(seed);
  }
  f.act(who,'useTool',{cardId:recycle.id,effect:'tour-recycle',targetId:who.playerId,slot:'active'});
  assert.ok(f.view(who).pendingBattle.options.every(option=>option.card.weather===recycle.weather));
  f.choose(f.room().pendingBattle.options[0].value);
  assert.equal(f.room().expansionTool,undefined);
});

test('Switch heals the outgoing partner, transfers Eevee Speed, and Trick swaps held items', t=>{
  const f=fixture(t),who=f.turn();
  const p=f.player(who);p.active.catalogueId='tour-eevee';p.active.damage=1;p.active.reinforcements=['speed'];
  const old=p.active.instanceId;const item=f.attach(who,'tour-scarf');
  f.tool(who,'tour-switch-incense','tour-switch');
  const swapped=f.player(who);
  assert.equal(swapped.reserve.instanceId,old);
  assert.equal(swapped.reserve.damage,0);
  assert.deepEqual(swapped.active.reinforcements,['speed']);
  assert.equal(f.room().turn.switchUsed,true);
  assert.ok(aiActions(f.room(),f.player(who),f.catalogue()).some(action=>action.type==='tourAction'&&action.action==='handoff'));
  f.act(who,'tourAction',{action:'handoff'});
  f.choose(f.room().pendingBattle.options[0].value);
  assert.equal(f.player(who).active.item.id,item.id);
  assert.equal(f.player(who).reserve.item,undefined);
});

test('Incense and Train Reserve share the end-turn level-up opportunity', t=>{
  const f=fixture(t),who=f.turn();
  f.tool(who,'tour-switch-incense','tour-incense','reserve');
  f.act(who,'finishPlay');
  while(f.room().turn.phase==='discard')f.act(who,'discard',{cardId:f.player(who).hand[0].id});
  const reserveId=f.player(who).reserve.instanceId;
  f.act(who,'tourAction',{action:'train'});f.choose(f.room().pendingBattle.options[0].value);
  assert.equal(f.player(who).reserve.level,2);
  assert.equal(f.player(who).reserve.instanceId,reserveId);
  assert.throws(()=>f.act(who,'endTurn',{levelUp:true}),{code:'LEVEL_CAP'});
  f.act(who,'endTurn',{levelUp:false});
});

test('Silph supplies and Rocket Search use the original event protection and conserve cards', t=>{
  const f=fixture(t),who=f.turn(),target=f.seats.find(s=>s!==who && f.room().players.findIndex(p=>p.id===s.playerId)===((f.room().players.findIndex(p=>p.id===who.playerId)+1)%4));
  let card=f.take(who,c=>c.eventType==='tour-supply');
  const before=f.player(who).hand.length;
  f.act(who,'useEvent',{cardId:card.id,targetId:who.playerId});
  while(f.room().pendingBattle)f.pass();
  assert.equal(f.player(who).hand.length,before+1);
  card=f.take(who,c=>c.eventType==='tour-search');
  const count=f.player(target).hand.length;
  f.act(who,'useEvent',{cardId:card.id,targetId:target.playerId});
  while(f.room().pendingBattle)f.pass();
  assert.equal(f.player(target).hand.length,count-1);
  assert.ok(f.view(target).players.filter(p=>p.id!==target.playerId).every(p=>p.hand===undefined));
});

test('Oak gift chooses real private cards and heals only after giving two', t=>{
  const f=fixture(t),who=f.turn(),target=f.room().players[(f.room().players.findIndex(p=>p.id===who.playerId)+1)%4];
  f.player(who).active.damage=1;
  const card=f.take(who,c=>c.eventType==='tour-gift');
  f.act(who,'useEvent',{cardId:card.id,targetId:target.id});
  while(f.room().pendingBattle?.kind==='articuno')f.pass();
  const initial=f.room().players.find(p=>p.id===target.id).hand.length;
  f.choose(f.room().pendingBattle.options[0].value);
  assert.equal(f.player(who).active.damage,1);
  f.restart();
  f.choose(f.room().pendingBattle.options.find(option=>option.card).value);
  assert.equal(f.room().players.find(p=>p.id===target.id).hand.length,initial+2);
  assert.equal(f.player(who).active.damage,0);
  assert.equal(f.room().resolution,null);
});

test('clinic resolves all targets separately and Articuno cancels only one', t=>{
  const f=fixture(t),who=f.turn();
  for(const p of f.room().players)p.active.damage=1;
  const articuno=f.take(who,c=>c.eventType==='articuno-protection');
  const event=f.take(who,c=>c.eventType==='tour-clinic');
  f.act(who,'useEvent',{cardId:event.id});
  assert.equal(f.room().pendingBattle.kind,'articuno');
  const decision=f.room().pendingBattle;
  f.act(f.byId(decision.actorId),'respondBattle',{decisionId:decision.id,choice:'protect',cardId:articuno.id});
  while(f.room().pendingBattle)f.pass();
  assert.equal(f.player(who).active.damage,1);
  assert.ok(f.room().players.filter(p=>p.id!==who.playerId).every(p=>p.active.damage===0));
});

test('Protect TM failure restores the same defense, is once per global turn, and sunny judgment dodges', t=>{
  for(const sunny of [false,true]) {
    const f=fixture(t),who=f.turn(),target=f.byId(f.room().players[(f.room().players.findIndex(p=>p.id===who.playerId)+1)%4].id);
    f.attach(target,'tour-protect');
    const judge=f.take(who,c=>sunny?c.weather==='clear':c.weather==='rain');
    f.player(who).hand.splice(f.player(who).hand.indexOf(judge),1);f.room().drawPile.push(judge);
    f.attack(target);
    const original=f.room().pendingBattle.id;
    f.act(target,'respondBattle',{decisionId:original,choice:'tour-protect'});
    if(sunny) assert.equal(f.room().resolution,null);
    else {
      assert.equal(f.room().pendingBattle.id,original);
      assert.equal(f.room().pendingBattle.canTourProtect,false);
      assert.throws(()=>f.act(target,'respondBattle',{decisionId:original,choice:'tour-protect'}),{code:'ITEM_UNAVAILABLE'});
      f.pass();
    }
  }
});

test('Choice Scarf extends command range to two and locks the first command move', t=>{
  const f=fixture(t,{count:6}),who=f.turn();
  f.player(who).active.catalogueId='scyther';f.player(who).active.level=3;
  const far=f.room().players[(f.room().players.findIndex(p=>p.id===who.playerId)+2)%6].id;
  assert.ok(!f.view(who).self.battle.moves[0].legalTargetIds.includes(far));
  f.equip(who,'tour-scarf');
  assert.ok(f.view(who).self.battle.moves[0].legalTargetIds.includes(far));
  f.attack(f.byId(far));
  while(f.room().pendingBattle)f.pass();
  assert.ok(f.view(who).self.battle.moves.filter(move=>move.condition.kind==='command'&&move.index!==0).every(move=>!move.canUse));
});

test('Eject Button and Red Card resolve only after the whole move and recover after restart', t=>{
  for(const type of ['tour-eject','tour-red-card']) {
    const f=fixture(t),who=f.turn(),target=f.byId(f.room().players[(f.room().players.findIndex(p=>p.id===who.playerId)+1)%4].id);
    const switching=type==='tour-eject'?target:who;
    const old=f.player(switching).active.instanceId;
    f.attach(target,type);
    f.attack(target);
    assert.equal(f.room().pendingBattle.kind,'defense');f.pass();
    assert.equal(f.room().pendingBattle.kind,'expansion');
    assert.equal(f.player(switching).active.instanceId,old);
    f.restart();f.choose('switch');
    assert.notEqual(f.player(switching).active.instanceId,old);
    assert.equal(f.room().tourAfterSwitches,undefined);
    assert.equal(f.room().resolution,null);
  }
});

test('six new groups have legal level faces and weather moves use the normal entry point', t=>{
  for(const pokemon of tourPokemon) {
    const f=fixture(t),who=f.turn();
    for(const level of [1,2,3]) {
      const active=f.player(who).active;active.catalogueId=pokemon.id;active.level=level;active.damage=0;
      assert.ok(maxHp(active,f.catalogue())>0);
      assert.ok(previewActions(f.room(),f.player(who),f.catalogue()).moves.some(move=>move.canUse));
    }
  }
});

test('Mareep weather payment charges Speed through the normal move entry', t=>{
  const f=fixture(t),who=f.turn();
  f.player(who).active.catalogueId='tour-mareep';
  const card=f.take(who,c=>c.weather==='thunderstorm');
  f.act(who,'attack',{cardId:card.id,moveIndex:1,targetIds:[who.playerId]});
  f.pass();
  assert.ok(f.player(who).active.reinforcements.includes('speed'));
  assert.ok(f.player(who).active.reinforcements.includes('defense'));
});


test('low-HP Overgrow adds damage and Ursaluna discards one card at whole-move end', t=>{
  for(const id of ['tour-treecko','tour-teddiursa']) {
    const f=fixture(t),who=f.turn(),target=f.byId(f.room().players[(f.room().players.findIndex(p=>p.id===who.playerId)+1)%4].id);
    const source=f.player(who).active;
    source.catalogueId=id;
    source.level=id==='tour-treecko'?1:3;
    if(id==='tour-treecko')source.damage=2;
    f.player(target).active.hpBonus=5;
    f.attack(target);
    const cards=f.player(who).hand.length;
    f.pass();
    assert.equal(f.player(target).active.damage,id==='tour-treecko'?2:3);
    assert.equal(f.player(who).hand.length,cards-(id==='tour-teddiursa'?1:0));
  }
});

test('Crunch resolves its item-or-extra-damage choice after ordinary damage', t=>{
  for(const effect of ['discard','damage']) {
    const f=fixture(t),who=f.turn(),target=f.byId(f.room().players[(f.room().players.findIndex(p=>p.id===who.playerId)+1)%4].id);
    f.player(who).active.catalogueId='tour-totodile';f.player(who).active.level=3;
    f.player(target).active.hpBonus=5;
    const item=f.attach(target,'tour-scarf');
    f.attack(target);f.pass();
    assert.equal(f.player(target).active.damage,2);
    assert.equal(f.room().pendingBattle.kind,'expansion');
    f.choose(effect);
    assert.equal(f.player(target).active.damage,effect==='discard'?2:3);
    if(effect==='discard')assert.ok(f.room().discardPile.some(card=>card.id===item.id));
    assert.equal(f.room().resolution,null);
  }
});

test('defeated item holders deploy reserves before Eject Button can activate', t=>{
  const f=fixture(t),who=f.turn(),target=f.byId(f.room().players[(f.room().players.findIndex(p=>p.id===who.playerId)+1)%4].id);
  const old=f.player(target).active.instanceId;
  f.player(target).active.damage=2;
  const item=f.attach(target,'tour-eject');
  f.attack(target);
  while(f.room().pendingBattle)f.pass();
  assert.notEqual(f.player(target).active.instanceId,old);
  assert.equal(f.player(target).reserve.defeated,true);
  assert.ok(f.room().discardPile.some(card=>card.id===item.id));
  assert.equal(f.room().tourAfterSwitches,undefined);
  assert.equal(f.room().resolution,null);
});

test('Prepare is once per turn and another trainer cannot respond to its private payment', t=>{
  const f=fixture(t),who=f.turn(),other=f.seats.find(seat=>seat!==who);
  f.act(who,'tourAction',{action:'prepare'});
  const pending=f.room().pendingBattle;
  assert.throws(()=>f.act(other,'respondBattle',{decisionId:pending.id,choice:'choose',effect:pending.options[0].value}),{code:'NOT_YOUR_DECISION'});
  const count=f.player(who).hand.length;
  f.choose(pending.options[0].value);
  assert.equal(f.player(who).hand.length,count);
  assert.ok(!f.view(who).self.battle.tourActions.some(action=>action.kind==='prepare'));
});

test('Tour switch can be canceled at Arena Trap without healing or consuming the ordinary switch', t=>{
  const f=fixture(t),who=f.turn();
  const trap=f.room().players[(f.room().players.findIndex(p=>p.id===who.playerId)+1)%4];
  trap.active.catalogueId='diglett';
  f.player(who).active.damage=1;
  const old=f.player(who).active.instanceId;
  f.tool(who,'tour-switch-incense','tour-switch');
  let pending=f.room().pendingBattle;
  assert.equal(pending.kind,'arena-trap');
  f.act(f.byId(pending.actorId),'respondBattle',{decisionId:pending.id,choice:'trait'});
  pending=f.room().pendingBattle;
  assert.equal(pending.kind,'switch-payment');
  f.pass();
  assert.equal(f.player(who).active.instanceId,old);
  assert.equal(f.player(who).active.damage,1);
  assert.equal(f.room().turn.switchUsed,false);
  assert.equal(f.room().expansionTool,undefined);
});


test('two Energy Retrieval copies expose targets for their own printed weather', t=>{
  const f=fixture(t),who=f.turn();
  const clear=f.take(who,c=>c.toolType==='tour-recycle-berry'&&c.weather==='clear');
  const storm=f.take(who,c=>c.toolType==='tour-recycle-berry'&&c.weather==='thunderstorm');
  f.room().drawPile.push(...f.room().discardPile);f.room().discardPile=[];
  const seed=f.take(who,c=>c.kind==='tool'&&c.weather==='clear'&&c.id!==clear.id);
  f.player(who).hand.splice(f.player(who).hand.indexOf(seed),1);f.room().discardPile.push(seed);
  const choices=f.view(who).self.battle.tools.filter(tool=>tool.toolType==='tour-recycle-berry');
  assert.equal(choices.find(tool=>tool.cardId===clear.id).choices.find(choice=>choice.effect==='tour-recycle').targets.length,1);
  assert.equal(choices.find(tool=>tool.cardId===storm.id).choices.find(choice=>choice.effect==='tour-recycle').targets.length,0);
  assert.throws(()=>f.act(who,'useTool',{cardId:storm.id,effect:'tour-recycle',targetId:who.playerId,slot:'active'}),{code:'INVALID_TARGET'});
});

test('an immediate team victory ends before any queued Red Card switch', t=>{
  const f=fixture(t,{count:2}),who=f.turn(),target=f.seats.find(seat=>seat!==who);
  f.player(target).active.damage=2;f.player(target).reserve.defeated=true;
  f.attach(target,'tour-red-card');
  f.attack(target);
  while(f.room().pendingBattle)f.pass();
  assert.equal(f.room().status,'finished');
  assert.equal(f.room().tourAfterSwitches,undefined);
  assert.equal(f.room().resolution,null);
  const cards=[...f.room().drawPile,...f.room().discardPile,...f.room().players.flatMap(player=>[
    ...player.hand,...[player.active?.item,player.reserve?.item].filter(Boolean)])];
  assert.equal(cards.length,132);
  assert.equal(new Set(cards.map(card=>card.id)).size,132);
});


test('weather pack and mixed play have balanced physical cards and distinct rosters', t=>{
  for (const [pack, groups, total] of [['base',40,108], [HOENN_PACK,46,148], [MIXED_PACK,52,172]]) {
    const f = fixture(t,{pack});
    const pool = battleSelectionIds(f.catalogue(),pack);
    assert.equal(pool.length,groups);
    assert.equal(pool.includes('hoenn-castform'),pack!=='base');
    assert.equal(pool.includes('tour-togepi'),pack===MIXED_PACK);
    const cards=[...f.room().drawPile,...f.room().discardPile,...f.room().players.flatMap(player=>player.hand)];
    assert.equal(cards.length,total);
    assert.equal(new Set(cards.map(card=>card.id)).size,total);
    for (const weather of ['intense-sun','clear','rain','thunderstorm']) {
      assert.equal(cards.filter(card=>card.weather===weather).length,total/4);
    }
  }
});

function openWeatherInstitute(t, count=4, extra={}) {
  const f = fixture(t,{count,pack:HOENN_PACK,play:false,weatherLab:true,autoJudgment:false,...extra});
  const lineup = ['hoenn-castform','squirtle','bulbasaur','rhyhorn'];
  f.seats.forEach(who=>f.act(who,'acknowledgeIdentity'));
  f.room().players.map(player=>player.id).forEach((id,index)=>{
    const who = f.byId(id);
    f.player(who).candidateDeal = [lineup[index],'pikachu','clefairy','geodude','onix'];
    for(let i=0;i<5;i++) f.act(who,'drawPokemon');
    f.act(who,'selectPokemon',{activeId:lineup[index],reserveId:'pikachu'});
  });
  return f;
}

function revealForecast(f, weather) {
  const who = f.turn(), pending = f.room().pendingBattle;
  assert.equal(pending.kind,'reveal-judgment');
  assert.equal(pending.actorId,who.playerId);
  const card = f.take(who,c=>c.weather===weather);
  const hand = f.player(who).hand;
  hand.splice(hand.indexOf(card),1);
  f.room().drawPile.push(card);
  f.act(who,'respondBattle',{decisionId:pending.id,choice:'reveal'});
  while(f.room().pendingBattle) f.pass();
  assert.ok(f.room().discardPile.some(discard=>discard.id===card.id));
  return card;
}

function endForecastTurn(f) {
  const who = f.turn();
  while(f.room().turn.drawRemaining) f.act(who,'draw');
  f.act(who,'finishPlay');
  while(f.room().turn.phase==='discard') f.act(who,'discard',{cardId:f.player(who).hand[0].id});
  f.act(who,'endTurn');
}

test('Weather Institute is opt-in and only available with Hoenn packs',t=>{
  assert.throws(()=>fixture(t,{pack:'base',weatherLab:true,play:false}),{code:'INVALID_SETTINGS'});
  assert.throws(()=>fixture(t,{pack:HOENN_PACK,weatherLab:'true',play:false}),{code:'INVALID_SETTINGS'});
  for(const pack of ['base',HOENN_PACK,MIXED_PACK]) {
    const f = fixture(t,{pack});
    assert.equal(f.view().settings.weatherLab,undefined);
    assert.equal(f.view().scenario.weatherLab,undefined);
    assert.equal(f.view().fieldWeather,undefined);
  }
  const f = openWeatherInstitute(t,4,{pack:MIXED_PACK,teamScenario:RADIO_TOWER});
  assert.ok(f.view().scenario.radio);
  assert.deepEqual(f.view().scenario.weatherLab,{round:1,forecast:null});
});

test('Weather Institute opens one judgment per round and keeps advancing after the first trainer is eliminated',t=>{
  const f = openWeatherInstitute(t);
  const [first,second] = f.room().players.map(player=>f.byId(player.id));
  const judgment = f.view(first).pendingBattle.id;
  assert.equal(f.view(first).turn.phase,'draw');
  assert.equal(f.view().fieldWeather,undefined);
  assert.throws(()=>f.act(first,'draw'),{code:'RESPONSE_PENDING'});
  f.restart();
  assert.equal(f.view(first).pendingBattle.id,judgment);
  revealForecast(f,'thunderstorm');
  const publicView = f.view(f.spectate());
  assert.deepEqual(publicView.fieldWeather,{kind:'hail',source:'weather-lab'});
  assert.equal(publicView.players.find(player=>player.id===first.playerId).active.fieldForm,'hail');
  while(f.room().turn.drawRemaining) f.act(first,'draw');
  const move = f.view(first).self.battle.moves[1];
  const target = f.byId(move.legalTargetIds[0]);
  const payment = f.take(first,card=>card.weather==='thunderstorm');
  f.act(first,'attack',{cardId:payment.id,moveIndex:move.index,targetIds:[target.playerId]});
  while(f.room().pendingBattle) f.pass();
  assert.equal(f.player(target).active.damage,2);
  endForecastTurn(f);
  assert.equal(f.room().pendingBattle,null);
  assert.equal(f.view().fieldWeather.kind,'hail');
  f.player(first).eliminated = true;
  for(let i=0;i<3;i++) endForecastTurn(f);
  assert.equal(f.turn().playerId,second.playerId);
  assert.deepEqual(f.view().scenario.weatherLab,{round:2,forecast:null});
  revealForecast(f,'clear');
  assert.equal(f.view().fieldWeather,undefined);
  assert.equal(f.room().log.filter(entry=>entry.text.en.startsWith('Weather Institute forecast for round ')).length,2);
});

test('Weather Institute uses the final judgment after Drought and Future Sight',t=>{
  const f = openWeatherInstitute(t,2);
  const first = f.turn(), second = f.byId(f.room().players[1].id);
  f.player(second).active.catalogueId = 'vulpix';
  const drought = f.take(second,card=>card.weather==='clear');
  const sight = f.take(first,card=>card.eventType==='hoenn-future-sight');
  const fee = f.take(first,card=>card.weather==='clear'&&card.id!==drought.id);
  const original = f.take(first,card=>card.weather==='intense-sun');
  const replacement = f.take(first,card=>card.weather==='rain');
  for(const card of [replacement,original]) {
    const hand = f.player(first).hand;
    hand.splice(hand.indexOf(card),1);
    f.room().drawPile.push(card);
  }
  const respond = (who,choice,fields={})=>f.act(who,'respondBattle',{decisionId:f.room().pendingBattle.id,choice,...fields});
  respond(first,'reveal');
  assert.equal(f.room().pendingBattle.judgmentCard.weather,'intense-sun');
  respond(second,'replace',{cardId:drought.id});
  assert.equal(f.view(first).pendingBattle.judgmentCard.weather,'clear');
  respond(first,'choose',{effect:sight.id});
  respond(first,'choose',{effect:fee.id});
  assert.deepEqual(f.view().fieldWeather,{kind:'rain',source:'weather-lab'});
  assert.ok(f.room().discardPile.some(card=>card.id===replacement.id));
  assert.equal(f.room().turn.drawRemaining,2);
});

test('Weather Institute restores the current forecast when a rock-extended event expires',t=>{
  const f = openWeatherInstitute(t,2);
  revealForecast(f,'intense-sun');
  assert.deepEqual(f.view().fieldWeather,{kind:'sun',source:'weather-lab'});
  endForecastTurn(f);
  const actor = f.turn();
  while(f.room().turn.drawRemaining) f.act(actor,'draw');
  f.attach(actor,'damp-rock');
  const rain = f.take(actor,card=>card.eventType==='hoenn-rain');
  f.act(actor,'useEvent',{cardId:rain.id,targetId:actor.playerId});
  while(f.room().pendingBattle) f.pass();
  assert.deepEqual(f.view().fieldWeather,{kind:'rain',turnsRemaining:4});
  endForecastTurn(f);
  revealForecast(f,'rain');
  assert.deepEqual(f.view().scenario.weatherLab,{round:2,forecast:'rain'});
  endForecastTurn(f);
  endForecastTurn(f);
  revealForecast(f,'thunderstorm');
  assert.deepEqual(f.view().scenario.weatherLab,{round:3,forecast:'hail'});
  assert.deepEqual(f.view().fieldWeather,{kind:'rain',turnsRemaining:1});
  endForecastTurn(f);
  assert.equal(f.room().turn.number,6);
  assert.deepEqual(f.view().fieldWeather,{kind:'hail',source:'weather-lab'});
});

test('field weather checks equipped rocks, supports Articuno and persists until the scheduled turn', t=>{
  const f=fixture(t,{pack:HOENN_PACK}), actor=f.turn();
  const event=type=>f.take(actor,card=>card.eventType===type);
  const cast=card=>f.act(actor,'useEvent',{cardId:card.id,targetId:actor.playerId});
  const passAll=()=>{while (f.room().pendingBattle) f.pass();};
  const nextTurn=()=>{
    const current=f.turn();
    f.act(current,'finishPlay');
    while(f.room().turn.phase==='discard') f.act(current,'discard',{cardId:f.player(current).hand[0].id});
    f.act(current,'endTurn');
    passAll();
    while(f.room().turn.drawRemaining) f.act(f.turn(),'draw');
  };
  f.equip(actor,'heat-rock');
  cast(event('hoenn-sun'));
  passAll();
  assert.deepEqual(f.view().fieldWeather,{kind:'sun',turnsRemaining:8});
  f.restart();
  assert.deepEqual(f.view().fieldWeather,{kind:'sun',turnsRemaining:8});

  const shield=f.take(actor,card=>card.eventType==='articuno-protection');
  cast(event('hoenn-rain'));
  assert.equal(f.room().pendingBattle.kind,'articuno');
  assert.equal(f.room().pendingBattle.actorId,actor.playerId);
  f.act(actor,'respondBattle',{decisionId:f.room().pendingBattle.id,choice:'protect',cardId:shield.id});
  passAll();
  assert.deepEqual(f.view().fieldWeather,{kind:'sun',turnsRemaining:8});
  cast(event('hoenn-rain'));
  passAll();
  assert.deepEqual(f.view().fieldWeather,{kind:'rain',turnsRemaining:4});
  nextTurn();
  assert.equal(f.view().fieldWeather.turnsRemaining,3);
  nextTurn();
  nextTurn();
  nextTurn();
  assert.equal(f.view().fieldWeather,undefined);
});

test('Forecast changes the public model and Weather Ball pays printed weather and deals damage', t=>{
  const f=fixture(t,{pack:MIXED_PACK}), actor=f.turn();
  const passAll=()=>{while (f.room().pendingBattle) f.pass();};
  const moves=()=>f.view(actor).self.battle.moves;
  const publicActive=()=>f.view().players.find(player=>player.id===actor.playerId).active;
  f.player(actor).active.catalogueId='hoenn-castform';
  assert.equal(publicActive().fieldForm,undefined);
  assert.equal(moves()[1].printedValue,1);
  const sun=f.take(actor,card=>card.eventType==='hoenn-sun');
  f.act(actor,'useEvent',{cardId:sun.id,targetId:actor.playerId});
  passAll();
  assert.equal(publicActive().fieldForm,'sun');
  f.room().turn.suppressedTraitPlayerIds=[actor.playerId];
  assert.equal(publicActive().fieldForm,undefined);
  assert.equal(moves()[1].printedValue,1);
  f.room().turn.suppressedTraitPlayerIds=[];
  const move=moves()[1], target=f.byId(move.legalTargetIds[0]);
  const wrong=f.take(actor,card=>card.weather==='rain');
  const right=f.take(actor,card=>card.weather==='clear');
  assert.equal(move.printedValue,2);
  assert.deepEqual(move.condition.weatherIconsInCondition,['intense-sun','clear']);
  const attack=card=>f.act(actor,'attack',{cardId:card.id,moveIndex:move.index,targetIds:[target.playerId]});
  assert.throws(()=>attack(wrong),{code:'INVALID_CARD'});
  attack(right);
  assert.equal(f.room().pendingBattle.kind,'defense');
  f.pass();
  passAll();
  assert.equal(f.player(target).active.damage,2);
  assert.equal(f.player(target).active.status,null);
  assert.equal(moves()[1].canUse,false);
  assert.ok(f.view(actor).self.battle.tourActions.some(action=>action.kind==='observe'));
  f.act(actor,'tourAction',{action:'observe'});
  f.choose(wrong.id);
  assert.equal(f.room().drawPile[0].id,wrong.id);
  assert.ok(!f.view(actor).self.battle.tourActions.some(action=>action.kind==='observe'));
});


test('Hail and Icy Rock enable snowy Castform, ice Weather Ball and one observation', t=>{
  const f=fixture(t,{pack:HOENN_PACK}), actor=f.turn();
  const openBattle=()=>{while(f.room().pendingBattle)f.pass();};
  const self=()=>f.view(actor).players.find(seat=>seat.id===actor.playerId).active;
  const playHail=()=>{
    const event=f.take(actor,card=>card.eventType==='hoenn-hail');
    f.act(actor,'useEvent',{cardId:event.id,targetId:actor.playerId});
    openBattle();
  };
  f.player(actor).active.catalogueId='hoenn-castform';
  playHail();
  assert.deepEqual(f.view().fieldWeather,{kind:'hail',turnsRemaining:4});
  assert.equal(self().fieldForm,'hail');
  const rock=f.equip(actor,'icy-rock');
  playHail();
  assert.deepEqual(f.view().fieldWeather,{kind:'hail',turnsRemaining:8});
  assert.equal(f.player(actor).active.item.id,rock.id);
  assert.ok(!f.view(actor).self.battle.tourActions.some(action=>action.kind==='observe'));

  const move=f.view(actor).self.battle.moves[1];
  assert.equal(move.printedValue,2);
  assert.deepEqual(move.condition.weatherIconsInCondition,['clear','thunderstorm']);
  const target=f.byId(move.legalTargetIds[0]);
  const invalid=f.take(actor,card=>card.weather==='intense-sun');
  const valid=f.take(actor,card=>card.weather==='thunderstorm');
  const attack=card=>f.act(actor,'attack',{cardId:card.id,moveIndex:move.index,targetIds:[target.playerId]});
  assert.throws(()=>attack(invalid),{code:'INVALID_CARD'});
  attack(valid);
  assert.equal(f.room().resolution.weatherBallForm,'hail');
  openBattle();
  assert.equal(f.player(target).active.damage,2);
  assert.ok(f.view(actor).self.battle.tourActions.some(action=>action.kind==='observe'));
  f.act(actor,'tourAction',{action:'observe'});
  f.choose(invalid.id);
  assert.equal(f.room().drawPile[0].id,invalid.id);
  assert.ok(!f.view(actor).self.battle.tourActions.some(action=>action.kind==='observe'));

  const rain=f.take(actor,card=>card.eventType==='hoenn-rain');
  f.act(actor,'useEvent',{cardId:rain.id,targetId:actor.playerId});
  openBattle();
  assert.deepEqual(f.view().fieldWeather,{kind:'rain',turnsRemaining:4});
  assert.equal(self().fieldForm,'rain');
});


test('delayed events remain on a trainer after restart, judge in placement order, then charge ordinary switching', t=>{
  const f=fixture(t,{pack:MIXED_PACK}), actor=f.turn(), target=f.byId(f.room().players[1].id);
  const play=(type, targetId=target.playerId)=>{
    const card=f.take(actor,row=>row.eventType===type);
    f.act(actor,'useEvent',{cardId:card.id,targetId});
    while(f.room().pendingBattle)f.pass();
    return card;
  };
  f.room().settings.autoJudgment=false;
  const thunder=play('hoenn-raikou');
  const roadblock=play('hoenn-roadblock');
  const second=f.take(actor,row=>row.eventType==='hoenn-raikou');
  assert.throws(()=>f.act(actor,'useEvent',{cardId:second.id,targetId:target.playerId}),{code:'INVALID_TARGET'});
  assert.deepEqual(f.view(actor).players.find(seat=>seat.id===target.playerId).delayedEvents.map(card=>card.eventType),
    ['hoenn-raikou','hoenn-roadblock']);
  f.restart();
  assert.deepEqual(f.player(target).delayedEvents.map(card=>card.id),[thunder.id,roadblock.id]);

  const forcedJudgments=[
    f.take(actor,row=>row.weather==='rain'),
    f.take(actor,row=>row.weather==='thunderstorm'),
  ];
  for(const card of forcedJudgments) {
    f.player(actor).hand.splice(f.player(actor).hand.indexOf(card),1);
    f.room().drawPile.push(card);
  }
  f.act(actor,'finishPlay');
  while(f.room().turn.phase==='discard')f.act(actor,'discard',{cardId:f.player(actor).hand[0].id});
  f.act(actor,'endTurn');
  assert.equal(f.turn().playerId,target.playerId);
  assert.equal(f.room().turn.drawRemaining,2);
  assert.equal(f.room().pendingBattle.kind,'reveal-judgment');
  assert.equal(f.room().resolution.card.id,thunder.id);
  f.restart();
  const reveal=()=>{
    f.act(target,'respondBattle',{decisionId:f.room().pendingBattle.id,choice:'reveal'});
    while (f.room().pendingBattle?.continuation?.kind === 'future-sight-event') f.pass();
  };
  reveal();
  assert.equal(f.player(target).active.damage,1);
  assert.equal(f.room().resolution.card.id,roadblock.id);
  assert.equal(f.room().turn.drawRemaining,2);
  reveal();
  assert.equal(f.room().turn.hoennRoadblocked,true);
  assert.equal(f.player(target).delayedEvents.length,0);
  for(const card of [thunder,roadblock,...forcedJudgments])assert.equal(f.room().discardPile.filter(row=>row.id===card.id).length,1);

  while(f.room().turn.drawRemaining)f.act(target,'draw');
  const outgoing=f.player(target).active.instanceId;
  const incoming=f.player(target).reserve.instanceId;
  f.act(target,'switchPokemon');
  assert.equal(f.room().pendingBattle.kind,'expansion');
  assert.equal(f.view(actor).pendingBattle.options,undefined);
  assert.equal(f.player(target).active.instanceId,outgoing);
  f.pass();
  assert.equal(f.room().turn.switchUsed,false);
  f.act(target,'switchPokemon');
  const cost=f.player(target).hand[0].id;
  f.choose(cost);
  assert.equal(f.room().discardPile.filter(row=>row.id===cost).length,1);
  assert.equal(f.player(target).active.instanceId,incoming);
  assert.equal(f.room().turn.switchUsed,true);
});

test('Articuno can cancel a delayed event on placement', t=>{
  const f=fixture(t,{pack:HOENN_PACK}), actor=f.turn(), target=f.byId(f.room().players[1].id);
  const event=f.take(actor,row=>row.eventType==='hoenn-raikou');
  const shield=f.take(target,row=>row.eventType==='articuno-protection');
  f.act(actor,'useEvent',{cardId:event.id,targetId:target.playerId});
  while(f.room().pendingBattle.actorId!==target.playerId)f.pass();
  f.act(target,'respondBattle',{decisionId:f.room().pendingBattle.id,choice:'protect',cardId:shield.id});
  assert.equal(f.room().pendingBattle,null);
  assert.ok(!f.player(target).delayedEvents?.length);
  assert.ok(f.room().discardPile.some(row=>row.id===event.id));
});


test('Future Sight follows Drought, uses a separate matching payment, and redraws only once', t=>{
  const f=fixture(t,{pack:HOENN_PACK}), attacker=f.turn(), target=f.byId(f.room().players[1].id);
  const delayed=f.take(attacker,card=>card.eventType==='hoenn-raikou');
  const sight=f.take(target,card=>card.eventType==='hoenn-future-sight');
  const rival=f.byId(f.room().players[2].id);
  const other=f.take(rival,card=>card.eventType==='hoenn-future-sight');
  f.take(rival,card=>card.weather==='thunderstorm' && card.kind==='command');
  const drought=f.take(target,card=>card.weather==='clear' && card.kind==='command');
  const fee=f.take(target,card=>card.id!==drought.id&&card.weather==='clear'&&card.kind==='command');
  const initial=f.take(attacker,card=>card.weather==='intense-sun'&&card.kind==='command');
  const final=f.take(attacker,card=>card.weather==='thunderstorm'&&card.kind==='command');
  f.room().settings.autoJudgment=false;
  f.player(target).active.catalogueId='vulpix';
  f.act(attacker,'useEvent',{cardId:delayed.id,targetId:target.playerId});
  while(f.room().pendingBattle)f.pass();

  for(const card of [final,initial]) {
    f.player(attacker).hand.splice(f.player(attacker).hand.indexOf(card),1);
    f.room().drawPile.push(card);
  }
  f.act(attacker,'finishPlay');
  while(f.room().turn.phase==='discard')f.act(attacker,'discard',{cardId:f.player(attacker).hand[0].id});
  f.act(attacker,'endTurn');
  const respond=(who,choice,fields={})=>f.act(who,'respondBattle',{decisionId:f.room().pendingBattle.id,choice,...fields});
  respond(target,'reveal');
  assert.equal(f.room().pendingBattle.kind,'judgment');
  respond(target,'replace',{cardId:drought.id});
  assert.ok(f.player(target).hand.some(card=>card.id===initial.id));
  assert.equal(f.room().pendingBattle.judgmentCard.weather,'clear');
  assert.ok(f.view(target).pendingBattle.options.some(item=>item.value===sight.id));
  assert.equal(f.view(rival).pendingBattle.options,undefined);
  respond(target,'choose',{effect:sight.id});
  f.restart();
  assert.ok(f.player(target).hand.some(card=>card.id===sight.id));
  assert.throws(()=>respond(target,'choose',{effect:sight.id}),{code:'INVALID_RESPONSE'});
  respond(target,'choose',{effect:fee.id});
  assert.equal(f.room().pendingBattle,null);
  assert.equal(f.player(target).active.damage,1);
  assert.equal(f.room().drawPile[0].id,drought.id);
  for(const used of [sight,fee,final]) {
    assert.equal(f.room().discardPile.filter(card=>card.id===used.id).length,1);
  }
  assert.ok(f.player(rival).hand.some(card=>card.id===other.id));
  assert.equal(f.room().turn.drawRemaining,2);
});

test('the Ralts line starts in Hoenn and reuses Synchronize for damage from a played command', t=>{
  const f=fixture(t,{pack:HOENN_PACK}), source=f.turn(), target=f.byId(f.room().players[1].id);
  const entry=f.catalogue().entries.find(row=>row.id==='hoenn-ralts');
  assert.deepEqual(entry.levels.map(row=>row.name.en),['Ralts','Kirlia','Gardevoir']);
  assert.deepEqual(entry.levels.map(row=>row.portraitImage.dex),[280,281,282]);
  assert.deepEqual(entry.levels.map(row=>row.hp),[3,4,5]);
  assert.ok(!battleSelectionIds(f.catalogue(),'base').includes(entry.id));
  f.player(target).active.catalogueId=entry.id;
  const command=f.take(source,card=>card.kind==='command');
  f.act(source,'attack',{cardId:command.id,targetIds:[target.playerId]});
  assert.equal(f.room().pendingBattle.kind,'defense');
  f.pass();
  assert.equal(f.room().pendingBattle.kind,'synchronize');
  f.act(target,'respondBattle',{decisionId:f.room().pendingBattle.id,choice:'trait'});
  assert.ok(f.player(target).hand.some(card=>card.id===command.id));
  assert.ok(!f.room().discardPile.some(card=>card.id===command.id));
});

test('Lum Berry cures only its own living reserve and the other face preserves a hidden reserve', t=>{
  const f=fixture(t,{pack:HOENN_PACK}), actor=f.turn();
  const other=f.seats.find(seat=>seat!==actor);
  f.player(actor).reserve.revealed=false;
  f.player(actor).reserve.status='poison';
  f.player(actor).active.status='burn';
  const berry=f.take(actor,card=>card.toolType==='hoenn-berry-umbrella');
  const use=(target,slot)=>f.act(actor,'useTool',{cardId:berry.id,effect:'hoenn-lum',targetId:target.playerId,slot});
  assert.throws(()=>use(other,'reserve'),{code:'INVALID_TARGET'});
  assert.throws(()=>use(actor,'active'),{code:'INVALID_TARGET'});
  use(actor,'reserve');
  assert.equal(f.player(actor).reserve.status,null);
  assert.equal(f.player(actor).active.status,'burn');
  assert.equal(f.player(actor).reserve.revealed,false);
  assert.equal(f.room().discardPile.filter(card=>card.id===berry.id).length,1);
  f.tool(actor,'hoenn-berry-umbrella','hoenn-umbrella','reserve');
  assert.equal(f.player(actor).reserve.hoennUmbrella,true);
  assert.equal(f.player(actor).reserve.revealed,false);
  assert.equal(f.view(actor).self.reserve.hoennUmbrella,true);
  const hidden=f.view(other).players.find(seat=>seat.id===actor.playerId).reserve;
  assert.equal(hidden?.hoennUmbrella,undefined);
});

test('Utility Umbrella lasts through opposing turns, withstands a dodge and cancels only the weather bonus on hit', t=>{
  const f=fixture(t,{pack:HOENN_PACK}), owner=f.turn();
  const other=f.byId(f.room().players[1].id);
  const passAll=()=>{while(f.room().pendingBattle)f.pass();};
  const advance=()=>{
    const actor=f.turn();
    f.act(actor,'finishPlay');
    while(f.room().turn.phase==='discard') f.act(actor,'discard',{cardId:f.player(actor).hand[0].id});
    f.act(actor,'endTurn');
    passAll();
    while(f.room().turn.drawRemaining) f.act(f.turn(),'draw');
  };
  f.tool(owner,'hoenn-berry-umbrella','hoenn-umbrella');
  f.tool(owner,'hoenn-berry-umbrella','hoenn-umbrella','reserve');
  advance();
  assert.equal(f.turn(),other);
  assert.equal(f.player(owner).active.hoennUmbrella,true);
  f.player(other).active.catalogueId='hoenn-castform';
  const ball=()=> {
    const fee=f.take(other,card=>card.weather==='clear');
    f.act(other,'attack',{cardId:fee.id,moveIndex:1,targetIds:[owner.playerId]});
    assert.equal(f.room().pendingBattle.kind,'defense');
  };
  ball();
  passAll();
  assert.equal(f.player(owner).active.damage,1);
  assert.equal(f.player(owner).active.hoennUmbrella,true);
  advance();
  const third=f.turn();
  const fourth=f.byId(f.room().players[3].id);
  const hail=f.take(third,card=>card.eventType==='hoenn-hail');
  f.act(third,'useEvent',{cardId:hail.id,targetId:third.playerId});
  passAll();
  advance();
  assert.equal(f.turn(),fourth);
  f.player(fourth).active.catalogueId='hoenn-castform';
  const fee=f.take(fourth,card=>card.weather==='clear');
  const dodge=f.take(owner,card=>card.kind==='dodge'&&!card.variant);
  f.act(fourth,'attack',{cardId:fee.id,moveIndex:1,targetIds:[owner.playerId]});
  f.act(owner,'respondBattle',{decisionId:f.room().pendingBattle.id,choice:'dodge',cardId:dodge.id});
  passAll();
  assert.equal(f.player(owner).active.damage,1);
  assert.equal(f.player(owner).active.hoennUmbrella,true);
  advance();
  assert.equal(f.turn(),owner);
  assert.equal(f.player(owner).active.hoennUmbrella,undefined);
  assert.equal(f.player(owner).reserve.hoennUmbrella,undefined);
  f.player(owner).active.damage=0;
  f.tool(owner,'hoenn-berry-umbrella','hoenn-umbrella');
  advance();
  ball();
  passAll();
  assert.equal(f.player(owner).active.damage,1);
  assert.equal(f.player(owner).active.hoennUmbrella,undefined);
  assert.equal(f.player(owner).reserve.hoennUmbrella,undefined);
});

test('Absol privately inspects only printed weather, offers level-based choices and persists its one-use limit', t=>{
  for (const level of [1,2,3]) {
    const f=fixture(t,{pack:HOENN_PACK}), actor=f.turn();
    const other=f.seats.find(seat=>seat!==actor);
    const active=f.player(actor).active;
    active.catalogueId='hoenn-absol';
    active.level=level;
    const entry=f.catalogue().entries.find(row=>row.id===active.catalogueId);
    assert.deepEqual(entry.levels.map(row=>row.portraitImage.dex),[359,359,359]);
    assert.ok(!battleSelectionIds(f.catalogue(),'base').includes(entry.id));
    const top=f.take(actor,card=>card.weather==='thunderstorm');
    f.player(actor).hand=f.player(actor).hand.filter(card=>card.id!==top.id);
    f.room().drawPile.push(top);
    const oldTop=f.room().drawPile.at(-2).id;
    assert.ok(aiActions(f.room(),f.player(actor),f.catalogue()).some(action=>action.action==='forecast'));
    f.act(actor,'tourAction',{action:'forecast'});
    const choices=f.view(actor).pendingBattle.options;
    assert.match(choices[0].label.zh,/雷雨/);
    assert.ok(choices.every(option=>!option.card && !JSON.stringify(option).includes(top.id)));
    assert.equal(f.view(other).pendingBattle.options,undefined);
    assert.equal(f.view(other).pendingBattle.continuation,undefined);
    assert.deepEqual(choices.map(option=>option.value),level===1?['keep']:['keep','bottom']);
    f.restart();
    f.choose(level===2?'bottom':'keep');
    assert.equal(f.room().drawPile.at(-1).id,level===2?oldTop:top.id);
    if(level===2) assert.equal(f.room().drawPile[0].id,top.id);
    assert.equal(f.player(actor).active.reinforcements.includes('speed'),level===3);
    assert.throws(()=>f.act(actor,'tourAction',{action:'forecast'}),{code:'ACTION_UNAVAILABLE'});
  }
});

test('Sandstorm preserves normal Castform, enables Rock Weather Ball and wears down only exposed actives at turn end', t=>{
  const f=fixture(t,{pack:HOENN_PACK}), actor=f.turn();
  const [target,steel,ground]=f.room().players.slice(1,4).map(seat=>f.byId(seat.id));
  Object.assign(f.player(actor).active,{catalogueId:'hoenn-castform',level:2});
  Object.assign(f.player(target).active,{catalogueId:'squirtle',level:2});
  f.player(steel).active.catalogueId='magnemite';
  f.player(ground).active.catalogueId='sandshrew';
  const getActive=(who)=>f.view().players.find(seat=>seat.id===who.playerId).active;
  const cast=(eventType)=>{
    const event=f.take(actor,card=>card.eventType===eventType);
    f.act(actor,'useEvent',{cardId:event.id,targetId:actor.playerId});
    while(f.room().pendingBattle) f.pass();
  };
  const end=()=>{
    const current=f.turn();
    f.act(current,'finishPlay');
    while(f.room().turn.phase==='discard') f.act(current,'discard',{cardId:f.player(current).hand[0].id});
    f.act(current,'endTurn');
    assert.equal(f.room().pendingBattle,null);
    while(f.room().turn.drawRemaining) f.act(f.turn(),'draw');
  };
  cast('hoenn-rain');
  assert.equal(getActive(actor).fieldForm,'rain');
  f.equip(actor,'smooth-rock');
  cast('hoenn-sand');
  assert.deepEqual(f.view().fieldWeather,{kind:'sand',turnsRemaining:8});
  assert.equal(getActive(actor).fieldForm,undefined);
  const ball=f.view(actor).self.battle.moves.find(move=>move.effectKind==='hoenn-weather-ball');
  assert.equal(ball.printedValue,2);
  assert.deepEqual(ball.condition.weatherIconsInCondition,['intense-sun','thunderstorm']);
  const wrong=f.take(actor,card=>card.weather==='clear');
  const right=f.take(actor,card=>card.weather==='thunderstorm');
  const attack=card=>f.act(actor,'attack',{cardId:card.id,moveIndex:ball.index,targetIds:[target.playerId]});
  assert.throws(()=>attack(wrong),{code:'INVALID_CARD'});
  attack(right);
  assert.equal(f.room().resolution.weatherBallForm,'sand');
  while(f.room().pendingBattle) f.pass();
  assert.equal(f.player(target).active.damage,2);
  assert.ok(f.view(actor).self.battle.tourActions.some(action=>action.kind==='observe'));
  f.act(actor,'tourAction',{action:'observe'});
  f.choose(wrong.id);
  assert.equal(f.room().drawPile[0].id,wrong.id);
  const reserves=f.room().players.map(player=>player.reserve.damage);
  end();
  assert.equal(f.player(actor).active.damage,1);
  end();
  assert.equal(f.player(target).active.damage,3);
  end();
  end();
  assert.equal(f.player(steel).active.damage,0);
  assert.equal(f.player(ground).active.damage,0);
  assert.deepEqual(f.room().players.map(player=>player.reserve.damage),reserves);
  assert.equal(getActive(actor).fieldForm,undefined);
  assert.equal(f.view().fieldWeather.turnsRemaining,4);
});

test('Sandstorm expiry and rescue resume exactly once after reload with no attacker reward', t=>{
  const f=fixture(t,{pack:MIXED_PACK}), actor=f.turn();
  const next=f.byId(f.room().players[1].id);
  const owner=f.player(actor);
  owner.active.catalogueId='pikachu';
  owner.active.damage=maxHp(owner.active,f.catalogue())-1;
  const outgoing=owner.active.instanceId, incoming=owner.reserve.instanceId;
  const sand=f.take(actor,card=>card.eventType==='hoenn-sand');
  f.act(actor,'useEvent',{cardId:sand.id,targetId:actor.playerId});
  while(f.room().pendingBattle)f.pass();
  assert.deepEqual(f.view().fieldWeather,{kind:'sand',turnsRemaining:4});
  f.act(actor,'finishPlay');
  while(f.room().turn.phase==='discard') f.act(actor,'discard',{cardId:f.player(actor).hand[0].id});
  f.act(actor,'endTurn');
  assert.equal(f.room().turn.playerId,actor.playerId);
  assert.equal(f.room().turn.awaitingEndSettlement,true);
  assert.equal(f.room().pendingBattle.kind,'rescue');
  const cards=f.room().drawPile.length;
  const decision=f.room().pendingBattle.id;
  f.restart();
  assert.equal(f.room().pendingBattle.id,decision);
  while(f.room().pendingBattle) f.pass();
  assert.equal(f.turn(),next);
  assert.equal(f.room().turn.awaitingEndSettlement,undefined);
  assert.equal(f.player(actor).active.instanceId,incoming);
  assert.equal(f.player(actor).reserve.instanceId,outgoing);
  assert.equal(f.player(actor).active.damage,0);
  assert.equal(f.player(actor).reserve.defeated,true);
  assert.equal(f.room().drawPile.length,cards);
  for(let i=0;i<3;i++) {
    const current=f.turn();
    while(f.room().turn.drawRemaining) f.act(current,'draw');
    f.act(current,'finishPlay');
    while(f.room().turn.phase==='discard') f.act(current,'discard',{cardId:f.player(current).hand[0].id});
    f.act(current,'endTurn');
    while(f.room().pendingBattle) f.pass();
  }
  assert.equal(f.turn(),actor);
  assert.equal(f.view().fieldWeather,undefined);
});

test('Sandstorm triggered by the turn clock can end the game during rescue', t=>{
  const f=fixture(t,{pack:HOENN_PACK}), actor=f.turn();
  const owner=f.player(actor);
  const ally=f.room().players.find(seat=>seat.id!==owner.id&&seat.role===owner.role);
  ally.eliminated=true;
  owner.active.damage=maxHp(owner.active,f.catalogue())-1;
  owner.reserve.defeated=true;
  const opponents=f.room().players.filter(seat=>seat.role!==owner.role);
  const sand=f.take(actor,card=>card.eventType==='hoenn-sand');
  f.act(actor,'useEvent',{cardId:sand.id,targetId:actor.playerId});
  while(f.room().pendingBattle)f.pass();
  f.act(actor,'finishPlay');
  while(f.room().turn.phase==='discard')f.act(actor,'discard',{cardId:f.player(actor).hand[0].id});
  f.room().turn.clock={remainingMs:1,deadlineAt:999_999,pausedReason:null,expired:false};
  const due=f.view(actor);
  assert.equal(due.pendingBattle.kind,'rescue');
  assert.equal(due.turn.clock.pausedReason,'response');
  while(f.room().pendingBattle) f.pass();
  assert.equal(f.room().status,'finished');
  assert.equal(f.room().turn,null);
  assert.equal(f.room().fieldWeather,undefined);
  assert.deepEqual(f.room().result.winnerIds.toSorted(),opponents.map(seat=>seat.id).toSorted());
});

test('Air Lock is a private defending response after a weather hit and leaves its weather intact', t=>{
  const f=fixture(t,{pack:HOENN_PACK}), attacker=f.turn(), defender=f.byId(f.room().players[1].id);
  Object.assign(f.player(attacker).active,{catalogueId:'hoenn-castform',level:2});
  f.player(defender).active.level=2;
  const counter=f.take(defender,card=>card.eventType==='hoenn-air-lock');
  const sun=f.take(attacker,card=>card.eventType==='hoenn-sun');
  f.act(attacker,'useEvent',{cardId:sun.id,targetId:attacker.playerId});
  while(f.room().pendingBattle) f.pass();
  const fee=f.take(attacker,card=>card.weather==='clear');
  f.act(attacker,'attack',{cardId:fee.id,moveIndex:1,targetIds:[defender.playerId]});
  assert.equal(f.room().pendingBattle.kind,'defense');
  f.pass();
  assert.equal(f.room().pendingBattle.continuation.kind,'air-lock');
  assert.equal(f.player(defender).active.damage,0);
  assert.ok(f.view(defender).pendingBattle.options.some(option=>option.value===counter.id));
  assert.equal(f.view(attacker).pendingBattle.options,undefined);
  f.restart();
  f.choose(counter.id);
  assert.equal(f.room().pendingBattle,null);
  assert.equal(f.player(defender).active.damage,1);
  assert.equal(f.room().discardPile.filter(card=>card.id===counter.id).length,1);
  assert.equal(f.view(attacker).fieldWeather.kind,'sun');
  assert.equal(f.view(attacker).players.find(seat=>seat.id===attacker.playerId).active.fieldForm,'sun');
  assert.ok(f.view(attacker).self.battle.tourActions.some(action=>action.kind==='observe'));
});

test('normal, dodged and umbrella-protected Weather Ball do not open the Air Lock response', t=>{
  for (const context of ['normal','dodge','umbrella','pass']) {
    const f=fixture(t,{pack:HOENN_PACK}), attacker=f.turn(), defender=f.byId(f.room().players[1].id);
    Object.assign(f.player(attacker).active,{catalogueId:'hoenn-castform',level:2});
    f.player(defender).active.level=2;
    const response=f.take(defender,card=>card.eventType==='hoenn-air-lock');
    if(context!=='normal') {
      const rain=f.take(attacker,card=>card.eventType==='hoenn-rain');
      f.act(attacker,'useEvent',{cardId:rain.id,targetId:attacker.playerId});
      while(f.room().pendingBattle) f.pass();
    }
    if(context==='umbrella') f.player(defender).active.hoennUmbrella=true;
    const fee=f.take(attacker,card=>card.weather==='rain');
    const dodge=f.take(defender,card=>card.kind==='dodge'&&!card.variant);
    f.act(attacker,'attack',{cardId:fee.id,moveIndex:1,targetIds:[defender.playerId]});
    if(context==='dodge') f.act(defender,'respondBattle',{decisionId:f.room().pendingBattle.id,choice:'dodge',cardId:dodge.id});
    else f.pass();
    if(context==='pass') {
      assert.equal(f.room().pendingBattle.continuation.kind,'air-lock');
      f.pass();
    }
    assert.equal(f.room().pendingBattle,null);
    assert.equal(f.player(defender).active.damage,context==='dodge'?0:context==='pass'?2:1);
    assert.ok(f.player(defender).hand.some(card=>card.id===response.id));
    assert.equal(f.player(defender).active.hoennUmbrella,undefined);
  }
});

test('Light Clay spends the physical held item after a reduction and expires or is consumed once', t=>{
  for (const context of ['used','expired','declined','no-reduction']) {
    const f=fixture(t,{pack:HOENN_PACK}), attacker=f.turn(), defender=f.byId(f.room().players[1].id);
    Object.assign(f.player(attacker).active,{catalogueId:'hoenn-castform',level:context==='no-reduction'?1:2});
    f.player(defender).active.level=2;
    const clay=f.attach(defender,'light-clay');
    f.player(defender).active.reinforcements.push('defense');
    const rain=f.take(attacker,card=>card.eventType==='hoenn-rain');
    f.act(attacker,'useEvent',{cardId:rain.id,targetId:attacker.playerId});
    while(f.room().pendingBattle) f.pass();
    f.attack(defender);
    f.pass();
    if(context==='no-reduction') {
      assert.equal(f.room().pendingBattle,null);
      assert.equal(f.player(defender).active.item.id,clay.id);
      continue;
    }
    assert.equal(f.player(defender).active.damage,1);
    assert.equal(f.room().pendingBattle.continuation.kind,'light-clay');
    assert.equal(f.view(attacker).pendingBattle.options,undefined);
    if(context==='declined') {
      f.pass();
      assert.equal(f.player(defender).active.item.id,clay.id);
      assert.ok(!f.player(defender).active.reinforcements.includes('defense'));
      continue;
    }
    f.restart();
    f.choose('retain');
    assert.equal(f.player(defender).active.hoennClayDefense,true);
    assert.equal(f.player(defender).active.item,undefined);
    assert.equal(f.room().discardPile.filter(card=>card.id===clay.id).length,1);
    if(context==='used') {
      const fee=f.take(attacker,card=>card.weather==='rain');
      f.act(attacker,'attack',{cardId:fee.id,moveIndex:1,targetIds:[defender.playerId]});
      f.pass();
      while(f.room().pendingBattle?.continuation?.kind==='air-lock') f.pass();
      assert.equal(f.player(defender).active.damage,2);
    } else {
      f.act(attacker,'finishPlay');
      while(f.room().turn.phase==='discard') f.act(attacker,'discard',{cardId:f.player(attacker).hand[0].id});
      f.act(attacker,'endTurn');
      assert.equal(f.turn(),defender);
      assert.equal(f.player(defender).active.damage,1);
    }
    assert.equal(f.room().pendingBattle,null);
    assert.equal(f.player(defender).active.hoennClayDefense,undefined);
    assert.ok(!f.player(defender).active.reinforcements.includes('defense'));
  }
});

test('Coordinated Command pays distinct weather to expand an attack, then Emergency Retreat waits for all targets',t=>{
  const f=fixture(t,{pack:HOENN_PACK}),a=f.turn(),p=f.room().players;
  const b=f.byId(p[1].id),c=f.byId(p.at(-1).id);
  const original=f.player(b).active.instanceId, incoming=f.player(b).reserve.instanceId;
  const card=f.take(a,row=>row.variant==='coordinated-command');
  const first=f.take(a,row=>row.weather==='rain'&&row.id!==card.id);
  const second=f.take(a,row=>row.weather==='clear'&&row.id!==card.id);
  const third=f.take(a,row=>row.weather==='rain'&&row.id!==first.id);
  const dodge=f.take(b,row=>row.variant==='emergency-retreat');
  f.attach(a,'power-herb');
  const attack=(fees,targets)=>f.act(a,'attack',{cardId:card.id,targetIds:targets.map(x=>x.playerId),coordinationCardIds:fees.map(x=>x.id)});
  assert.throws(()=>attack([first,third],[b,c]),{code:'INVALID_CARD'});
  assert.throws(()=>attack([card,first],[b,c]),{code:'INVALID_CARD'});
  assert.throws(()=>attack([first,second],[b]),{code:'INVALID_TARGET'});
  attack([first,second],[b,c]);
  f.act(b,'respondBattle',{decisionId:f.room().pendingBattle.id,choice:'dodge',cardId:dodge.id});
  assert.equal(f.room().pendingBattle.actorId,c.playerId);
  assert.equal(f.room().pendingBattle.kind,'defense');
  assert.equal(f.player(b).active.instanceId,original);
  f.pass();
  assert.equal(f.room().pendingBattle.continuation.kind,'emergency-retreat');
  assert.equal(f.player(c).active.damage,1);
  f.restart();
  f.choose('switch');
  assert.equal(f.player(b).active.instanceId,incoming);
  assert.equal(f.player(b).emergencyRetreatDebt,true);
  for(const spent of [card,first,second,dodge]) assert.equal(f.room().discardPile.filter(row=>row.id===spent.id).length,1);
  f.act(a,'finishPlay');
  while(f.room().turn.phase==='discard')f.act(a,'discard',{cardId:f.player(a).hand[0].id});
  f.act(a,'endTurn');
  assert.equal(f.turn(),b);
  assert.equal(f.room().turn.switchUsed,true);
  assert.equal(f.player(b).emergencyRetreatDebt,undefined);
  while(f.room().turn.drawRemaining)f.act(b,'draw');
  assert.equal(f.view(b).self.battle.canSwitch,false);
});

test('Power Herb is paid before Emergency Retreat and deals just one damage to the original active',t=>{
  const f=fixture(t,{pack:MIXED_PACK}),a=f.turn(),b=f.byId(f.room().players[1].id);
  f.player(a).active.level=2;
  const herb=f.attach(a,'power-herb');
  const retreat=f.take(b,row=>row.variant==='emergency-retreat');
  const first=f.take(a,row=>row.weather==='rain');
  const second=f.take(a,row=>row.weather==='clear');
  f.attack(b);
  f.act(b,'respondBattle',{decisionId:f.room().pendingBattle.id,choice:'dodge',cardId:retreat.id});
  assert.equal(f.room().pendingBattle.kind,'power-herb');
  assert.equal(f.view(b).pendingBattle.paymentCards,undefined);
  assert.equal(f.player(b).active.damage,0);
  f.restart();
  const pay=cardIds=>f.act(a,'respondBattle',{decisionId:f.room().pendingBattle.id,choice:'discard',cardIds});
  assert.throws(()=>pay([first.id,first.id]),{code:'INVALID_RESPONSE'});
  pay([first.id,second.id]);
  assert.equal(f.player(b).active.damage,1);
  assert.equal(f.room().pendingBattle.continuation.kind,'emergency-retreat');
  f.choose('switch');
  assert.equal(f.player(b).reserve.damage,1);
  assert.equal(f.player(b).active.damage,0);
  assert.equal(f.player(a).active.item,undefined);
  for(const spent of [herb,first,second,retreat])assert.equal(f.room().discardPile.filter(row=>row.id===spent.id).length,1);
});

test('Emergency Retreat passes or Arena Trap blocks without charging the ordinary switch',t=>{
  for(const mode of ['declined','trapped']) {
    const f=fixture(t,{pack:HOENN_PACK}),a=f.turn(),b=f.byId(f.room().players[1].id);
    const original=f.player(b).active.instanceId;
    if(mode==='trapped')f.player(a).active.catalogueId='diglett';
    const retreat=f.take(b,row=>row.variant==='emergency-retreat');
    f.attack(b);
    f.act(b,'respondBattle',{decisionId:f.room().pendingBattle.id,choice:'dodge',cardId:retreat.id});
    if(mode==='trapped') {
      f.choose('switch');
      assert.equal(f.room().pendingBattle.kind,'arena-trap');
      const trap=f.room().pendingBattle;
      f.act(a,'respondBattle',{decisionId:trap.id,choice:'trait'});
      if(f.room().pendingBattle?.kind==='switch-payment')f.pass();
    } else f.pass();
    assert.equal(f.room().pendingBattle,null);
    assert.equal(f.player(b).active.instanceId,original);
    assert.equal(f.player(b).emergencyRetreatDebt,undefined);
  }
});

test('Wynaut only counters command damage, with a private payment that survives reload',t=>{
  const f=fixture(t,{pack:HOENN_PACK}),a=f.turn(),b=f.byId(f.room().players[1].id);
  const entry=f.catalogue().entries.find(row=>row.id==='hoenn-wobbuffet');
  assert.deepEqual(entry.levels.map(level=>level.portraitImage.dex),[360,202,202]);
  assert.deepEqual(entry.levels.map(level=>level.hp),[3,4,5]);
  assert.ok(!battleSelectionIds(f.catalogue(),'base').includes(entry.id));
  f.player(b).active.catalogueId=entry.id;
  const fee=f.take(b,card=>card.weather==='clear'), invalid=f.take(b,card=>card.weather==='rain');
  const attack=()=> {
    const card=f.take(a,card=>card.kind==='command');
    f.act(a,'attack',{cardId:card.id,targetIds:[b.playerId]});
    f.pass();
    return card;
  };
  const used=attack();
  assert.equal(f.view(b).pendingBattle.title.en,'Counter');
  assert.equal(f.view(a).pendingBattle.options,undefined);
  assert.ok(f.view(b).pendingBattle.options.some(row=>row.value===fee.id));
  assert.throws(()=>f.choose(invalid.id),{code:'INVALID_RESPONSE'});
  const pending=f.room().pendingBattle.id;
  f.restart();
  assert.equal(f.room().pendingBattle.id,pending);
  f.choose(fee.id);
  assert.equal(f.player(a).active.damage,1);
  assert.equal(f.player(b).active.damage,1);
  assert.equal(f.room().pendingBattle,null);
  assert.equal(f.room().resolution,null);
  assert.deepEqual(f.room().turn.wobbuffetCounterIds,[f.player(b).active.instanceId]);
  for(const card of [used,fee])assert.equal(f.room().discardPile.filter(row=>row.id===card.id).length,1);
});

test('only evolved Wobbuffet answers weather attacks with Mirror Coat',t=>{
  for(const level of [1,2,3]){
    const f=fixture(t,{pack:MIXED_PACK}),a=f.turn(),b=f.byId(f.room().players[1].id);
    Object.assign(f.player(a).active,{catalogueId:'hoenn-castform',level:2});
    Object.assign(f.player(b).active,{catalogueId:'hoenn-wobbuffet',level});
    const wanted=f.take(b,card=>card.weather==='thunderstorm');
    const sunny=f.take(b,card=>card.weather==='clear');
    const sun=f.take(a,card=>card.eventType==='hoenn-sun');
    f.act(a,'useEvent',{cardId:sun.id,targetId:a.playerId});
    while(f.room().pendingBattle)f.pass();
    const payment=f.take(a,card=>card.weather==='intense-sun');
    f.act(a,'attack',{cardId:payment.id,moveIndex:1,targetIds:[b.playerId]});
    f.pass();
    if(f.room().pendingBattle?.continuation?.kind==='air-lock')f.pass();
    assert.equal(f.player(b).active.damage,2);
    if(level===1)assert.equal(f.room().pendingBattle,null);
    else {
      assert.equal(f.view(b).pendingBattle.title.en,'Mirror Coat');
      assert.throws(()=>f.choose(sunny.id),{code:'INVALID_RESPONSE'});
      f.choose(wanted.id);
    }
    assert.equal(f.player(a).active.damage,level-1);
    assert.equal(f.room().pendingBattle,null);
    assert.equal(f.room().resolution,null);
  }
});

test('Wobbuffet counters only after rescue, and a counter knockout resumes the original move',t=>{
  const f=fixture(t,{pack:HOENN_PACK}),a=f.turn(),b=f.byId(f.room().players[1].id);
  Object.assign(f.player(a).active,{catalogueId:'hoenn-wobbuffet',level:2,damage:3});
  Object.assign(f.player(b).active,{catalogueId:'hoenn-wobbuffet',level:3,damage:4});
  const potion=f.take(b,card=>card.toolType==='potion-full-heal');
  const sunny=f.take(b,card=>card.weather==='intense-sun'&&card!==potion);
  const spare=f.player(a).reserve.instanceId;
  f.attack(b);
  f.pass();
  assert.equal(f.room().pendingBattle.kind,'rescue');
  while(f.room().pendingBattle.actorId!==b.playerId)f.pass();
  f.act(b,'respondBattle',{decisionId:f.room().pendingBattle.id,choice:'potion',cardId:potion.id});
  assert.equal(f.view(b).pendingBattle.title.en,'Counter');
  f.choose(sunny.id);
  assert.equal(f.room().pendingBattle.kind,'rescue');
  assert.equal(f.room().pendingBattle.targetId,a.playerId);
  while(f.room().pendingBattle)f.pass();
  assert.equal(f.player(a).reserve.defeated,true);
  assert.equal(f.player(a).active.instanceId,spare);
  assert.equal(f.room().resolution,null);
  assert.equal(f.room().resolutionStack,undefined);
});

test('an undamaged Lv. 2 Nincada can pick Shedinja at turn end and keep only one HP',t=>{
  const f=fixture(t,{pack:HOENN_PACK}),who=f.turn();
  const group=f.catalogue().entries.find(entry=>entry.id==='hoenn-nincada');
  assert.deepEqual(group.levels.map(level=>level.portraitImage.dex),[290,290,291]);
  assert.deepEqual(group.levels.map(level=>level.name.en),['Nincada','Nincada','Ninjask']);
  assert.ok(battleSelectionIds(f.catalogue(),HOENN_PACK).includes(group.id));
  assert.ok(!battleSelectionIds(f.catalogue(),HOENN_PACK).includes('hoenn-shedinja'));
  assert.ok(!battleSelectionIds(f.catalogue(),'base').includes(group.id));
  const current=f.player(who).active;
  current.catalogueId=group.id;
  current.hpBonus=1;
  const endPhase=()=>{
    const seat=f.turn();
    while(f.room().turn.drawRemaining) f.act(seat,'draw');
    f.act(seat,'finishPlay');
    while(f.room().turn.phase==='discard')f.act(seat,'discard',{cardId:f.player(seat).hand[0].id});
  };
  endPhase();
  const become=()=>f.act(who,'endTurn',{levelUp:true,evolution:'hoenn-shedinja'});
  assert.throws(become,{code:'INVALID_EVOLUTION'});
  f.act(who,'endTurn',{levelUp:true});
  assert.equal(f.player(who).active.level,2);
  while(f.turn()!==who){
    endPhase();
    f.act(f.turn(),'endTurn');
  }
  endPhase();
  assert.equal(f.view(who).self.battle.shedinjaEvolution,true);
  f.player(who).active.damage=1;
  assert.equal(f.view(who).self.battle.shedinjaEvolution,undefined);
  assert.throws(become,{code:'INVALID_EVOLUTION'});
  f.player(who).active.damage=0;
  become();
  f.restart();
  const shell=f.player(who).active;
  assert.equal(shell.catalogueId,'hoenn-shedinja');
  assert.equal(shell.level,3);
  assert.equal(shell.instanceId,current.instanceId);
  assert.equal(maxHp(shell,f.catalogue()),1);
  assert.equal(f.room().players.length,4);
});

test('Lv. 2 Nincada learns U-turn on taking the Ninjask branch at Lv. 3',t=>{
  const f=fixture(t,{pack:MIXED_PACK}),who=f.turn(),other=f.byId(f.room().players[1].id);
  const current=f.player(who).active, incoming=f.player(who).reserve;
  Object.assign(current,{catalogueId:'hoenn-nincada',level:2});
  assert.deepEqual(f.view(who).self.battle.moves.map(move=>move.name.en),['Scratch']);
  function finish(seat,levelUp=false){
    while(f.room().turn.drawRemaining)f.act(seat,'draw');
    f.act(seat,'finishPlay');
    while(f.room().turn.phase==='discard')f.act(seat,'discard',{cardId:f.player(seat).hand[0].id});
    f.act(seat,'endTurn',{levelUp});
  }
  finish(who,true);
  assert.equal(f.player(who).active.level,3);
  assert.equal(f.player(who).active.instanceId,current.instanceId);
  assert.equal(f.player(who).reserve.instanceId,incoming.instanceId);
  while(f.turn()!==who)finish(f.turn());
  while(f.room().turn.drawRemaining)f.act(who,'draw');
  const uturn=f.view(who).self.battle.moves.find(move=>move.name.en==='U-turn');
  assert.ok(uturn);
  f.attack(other,uturn.index);
  assert.equal(f.room().resolution.moveName.en,'U-turn');
  f.pass();
  assert.equal(f.room().pendingBattle.kind,'u-turn');
  f.act(who,'respondBattle',{decisionId:f.room().pendingBattle.id,choice:'pass'});
  assert.equal(f.player(who).active.instanceId,current.instanceId);
});

test('Compound Eyes at both levels pays a separate card and requires two successful Dodges',t=>{
  for (const level of [1,2]) {
    const f=fixture(t,{pack:HOENN_PACK}),attacker=f.turn(),defender=f.byId(f.room().players[1].id);
    Object.assign(f.player(attacker).active,{catalogueId:'hoenn-nincada',level});
    const command=f.take(attacker,card=>card.kind==='command');
    const fee=f.take(attacker,card=>card.kind==='tool');
    const dodge=f.take(defender,card=>card.kind==='dodge'&&!card.variant);
    const second=f.take(defender,card=>card.kind==='dodge'&&!card.variant&&card.id!==dodge.id);
    const attack={cardId:command.id,targetIds:[defender.playerId]};
    const before=JSON.stringify(f.room());
    assert.throws(()=>f.act(attacker,'attack',{...attack,boostCardId:command.id}),{code:'INVALID_CARD'});
    assert.equal(JSON.stringify(f.room()),before);
    assert.equal(f.view(attacker).self.battle.moves[0].compoundEyes,true);
    f.act(attacker,'attack',{...attack,boostCardId:fee.id});
    assert.equal(f.room().resolution.baseDamage,1);
    assert.ok(f.room().discardPile.some(card=>card.id===fee.id));
    const decisionId=f.room().pendingBattle.id;
    f.act(defender,'respondBattle',{decisionId,choice:'dodge',cardId:dodge.id});
    assert.equal(f.room().pendingBattle.id,decisionId);
    assert.equal(f.view(defender).pendingBattle.dodgesPlayed,1);
    assert.equal(f.view(defender).pendingBattle.doubleDodgeMove.en,'Scratch');
    f.restart();
    assert.equal(f.room().pendingBattle.dodgesPlayed,1);
    if (level===1) f.act(defender,'respondBattle',{decisionId,choice:'dodge',cardId:second.id});
    else f.pass();
    assert.equal(f.room().pendingBattle,null);
    assert.equal(f.player(defender).active.damage,level===1?0:1);
    assert.equal(f.view(attacker).self.battle.moves[0].compoundEyes,undefined);
  }
});

test('Compound Eyes is optional, and trait suppression disallows an extra discard atomically',t=>{
  for (const suppressed of [false,true]) {
    const f=fixture(t,{pack:HOENN_PACK}),attacker=f.turn(),defender=f.byId(f.room().players[1].id);
    Object.assign(f.player(attacker).active,{catalogueId:'hoenn-nincada',level:2});
    if (suppressed) f.room().turn.suppressedTraitPlayerIds=[attacker.playerId];
    const command=f.take(attacker,card=>card.kind==='command');
    const fee=f.take(attacker,card=>card.kind==='tool');
    const dodge=f.take(defender,card=>card.kind==='dodge'&&!card.variant);
    const attack={cardId:command.id,targetIds:[defender.playerId]};
    if (suppressed) {
      const before=JSON.stringify(f.room());
      assert.throws(()=>f.act(attacker,'attack',{...attack,boostCardId:fee.id}),{code:'INVALID_CARD'});
      assert.equal(JSON.stringify(f.room()),before);
    }
    f.act(attacker,'attack',attack);
    assert.equal(f.room().pendingBattle.dodgesRequired,undefined);
    f.act(defender,'respondBattle',{decisionId:f.room().pendingBattle.id,choice:'dodge',cardId:dodge.id});
    assert.equal(f.room().pendingBattle,null);
    assert.equal(f.player(defender).active.damage,0);
    assert.ok(f.player(attacker).hand.some(card=>card.id===fee.id));
  }
});

test('Speed Boost grants exactly one extra seat to the first damaging move, even when it is dodged',t=>{
  const f=fixture(t,{pack:HOENN_PACK,count:6}),attacker=f.turn();
  const distant=f.byId(f.room().players[2].id),tooFar=f.byId(f.room().players[3].id);
  Object.assign(f.player(attacker).active,{catalogueId:'hoenn-nincada',level:3});
  f.room().turn.suppressedTraitPlayerIds=[attacker.playerId];
  assert.ok(!f.view(attacker).self.battle.moves[0].legalTargetIds.includes(distant.playerId));
  delete f.room().turn.suppressedTraitPlayerIds;
  const command=f.take(attacker,card=>card.kind==='command');
  const nextCommand=f.take(attacker,card=>card.kind==='command'&&card.id!==command.id);
  const dodge=f.take(distant,card=>card.kind==='dodge'&&!card.variant);
  let moves=f.view(attacker).self.battle.moves;
  assert.equal(moves[0].speedBoost,true);
  assert.ok(moves[0].legalTargetIds.includes(distant.playerId));
  assert.ok(!moves[0].legalTargetIds.includes(tooFar.playerId));
  assert.throws(()=>f.act(attacker,'attack',{cardId:command.id,targetIds:[tooFar.playerId]}),{code:'INVALID_TARGET'});
  f.act(attacker,'attack',{cardId:command.id,targetIds:[distant.playerId]});
  f.act(distant,'respondBattle',{decisionId:f.room().pendingBattle.id,choice:'dodge',cardId:dodge.id});
  assert.equal(f.player(distant).active.damage,0);
  f.restart();
  moves=f.view(attacker).self.battle.moves;
  assert.equal(moves[1].speedBoost,undefined);
  assert.ok(!moves[1].legalTargetIds.includes(distant.playerId));
  assert.throws(()=>f.act(attacker,'attack',{moveIndex:1,cardId:nextCommand.id,targetIds:[distant.playerId]}),{code:'INVALID_TARGET'});
  const advance=seat=>{
    while(f.room().turn.drawRemaining)f.act(seat,'draw');
    f.act(seat,'finishPlay');
    while(f.room().turn.phase==='discard')f.act(seat,'discard',{cardId:f.player(seat).hand[0].id});
    f.act(seat,'endTurn');
  };
  advance(attacker);
  while(f.turn()!==attacker)advance(f.turn());
  while(f.room().turn.drawRemaining)f.act(attacker,'draw');
  assert.ok(f.view(attacker).self.battle.moves[1].legalTargetIds.includes(distant.playerId));
});

test('Wonder Guard blocks ordinary and Ground move damage, while sandy Weather Ball reaches rescue',t=>{
  const f=fixture(t,{pack:HOENN_PACK}),a=f.turn(),b=f.byId(f.room().players[1].id);
  Object.assign(f.player(a).active,{catalogueId:'hoenn-castform',level:2});
  Object.assign(f.player(b).active,{catalogueId:'hoenn-shedinja',level:3});
  f.attack(b);
  assert.equal(f.room().pendingBattle,null);
  assert.equal(f.player(b).active.damage,0);
  assert.ok(f.room().log.some(note=>note.text.en.includes('Wonder Guard blocked')));
  Object.assign(f.player(a).active,{catalogueId:'diglett',level:3});
  const quake=f.view(a).self.battle.moves.find(m=>m.name.en==='Earthquake');
  assert.ok(quake);
  f.attack(b,quake.index);
  assert.equal(f.room().pendingBattle,null);
  assert.equal(f.player(b).active.damage,0);
  f.player(a).active.catalogueId='hoenn-castform';
  const sand=f.take(a,card=>card.eventType==='hoenn-sand');
  f.act(a,'useEvent',{cardId:sand.id,targetId:a.playerId});
  while(f.room().pendingBattle)f.pass();
  const card=f.take(a,row=>row.weather==='thunderstorm');
  f.act(a,'attack',{cardId:card.id,moveIndex:1,targetIds:[b.playerId]});
  assert.equal(f.room().pendingBattle.kind,'defense');
  f.pass();
  if(f.room().pendingBattle?.continuation?.kind==='air-lock')f.pass();
  assert.equal(f.room().pendingBattle.kind,'rescue');
  assert.equal(f.room().pendingBattle.targetId,b.playerId);
  while(f.room().pendingBattle)f.pass();
  assert.equal(f.player(b).reserve.defeated,true);
});

test('Wonder Guard leaves sand damage and ability suppression in the normal rescue flow',t=>{
  for(const source of ['sand','suppressed']){
    const f=fixture(t,{pack:HOENN_PACK}),a=f.turn(),b=f.byId(f.room().players[1].id);
    Object.assign(f.player(b).active,{catalogueId:'hoenn-shedinja',level:3});
    if(source==='suppressed'){
      f.room().turn.suppressedTraitPlayerIds=[b.playerId];
      f.attack(b);
      assert.equal(f.room().pendingBattle.kind,'defense');
      f.pass();
    }else{
      const sand=f.take(a,card=>card.eventType==='hoenn-sand');
      f.act(a,'useEvent',{cardId:sand.id,targetId:a.playerId});
      while(f.room().pendingBattle)f.pass();
      const end=who=>{
        while(f.room().turn.drawRemaining)f.act(who,'draw');
        f.act(who,'finishPlay');
        while(f.room().turn.phase==='discard')f.act(who,'discard',{cardId:f.player(who).hand[0].id});
        f.act(who,'endTurn');
      };
      end(a);
      end(b);
    }
    assert.equal(f.room().pendingBattle.kind,'rescue');
    assert.equal(f.room().pendingBattle.targetId,b.playerId);
    while(f.room().pendingBattle)f.pass();
    assert.ok(f.player(b).reserve.defeated);
  }
});

test('Zorua opens in genuine setup with an owner-only view and a living reserve disguise for observers',t=>{
  const f=fixture(t,{pack:HOENN_PACK,play:false});
  for(const seat of f.seats)f.act(seat,'acknowledgeIdentity');
  const order=f.room().players.map(player=>player.id);
  const owner=f.byId(order[0]),observer=f.byId(order[1]);
  for(const who of f.seats){
    const index=order.indexOf(who.playerId);
    const lead=['hoenn-zorua','squirtle','rhyhorn','bulbasaur'][index];
    f.player(who).candidateDeal=[lead,'pikachu','charmander','clefairy','geodude'];
    for(let i=0;i<5;i++)f.act(who,'drawPokemon');
    f.act(who,'selectPokemon',{activeId:lead,reserveId:'pikachu'});
  }
  const actual=f.view(owner).players.find(p=>p.id===owner.playerId);
  const outside=f.view(observer).players.find(p=>p.id===owner.playerId);
  assert.equal(actual.active.catalogueId,'hoenn-zorua');
  assert.equal(actual.active.illusionActive,true);
  assert.equal(outside.active.catalogueId,'pikachu');
  assert.equal(outside.active.hp,actual.active.hp);
  assert.equal(outside.active.illusionActive,undefined);
  assert.equal(outside.reserve,undefined);
  f.restart();
  assert.equal(f.view(observer).players.find(p=>p.id===owner.playerId).active.catalogueId,'pikachu');
});

test('Zoroark can mark one private decoy after switching in and use it as a virtual command on reveal',t=>{
  const f=fixture(t,{pack:MIXED_PACK}),owner=f.turn(),observer=f.byId(f.room().players[1].id);
  Object.assign(f.player(owner).reserve,{catalogueId:'hoenn-zorua',level:2});
  f.act(owner,'switchPokemon');
  const visible=()=>f.view(observer).players.find(p=>p.id===owner.playerId).active;
  assert.equal(visible().catalogueId,'tour-treecko');
  assert.equal(visible().level,1);
  const decoy=f.take(owner,c=>c.kind==='dodge'&&c.weather==='clear');
  const command=f.take(owner,c=>c.kind==='command');
  f.act(owner,'tourAction',{action:'illusion-decoy'});
  assert.ok(f.view(owner).pendingBattle.options.some(c=>c.value===decoy.id));
  assert.equal(f.view(observer).pendingBattle.options,undefined);
  assert.equal(f.view(observer).pendingBattle.continuation,undefined);
  assert.equal(f.view(observer).pendingBattle.title.en,'Trainer is choosing');
  assert.throws(()=>f.choose(command.id),{code:'INVALID_RESPONSE'});
  f.choose(decoy.id);
  f.restart();
  assert.equal(f.view(owner).self.battle.illusionDecoyId,decoy.id);
  assert.equal(visible().catalogueId,'tour-treecko');
  assert.throws(()=>f.act(owner,'tourAction',{action:'illusion-decoy'}),{code:'ACTION_UNAVAILABLE'});
  f.act(owner,'attack',{cardId:decoy.id,targetIds:[observer.playerId]});
  assert.equal(visible().catalogueId,'hoenn-zorua');
  assert.equal(visible().level,2);
  assert.equal(f.room().resolution.card,null);
  assert.equal(f.room().resolution.virtualCommand,true);
  f.pass();
  assert.equal(f.player(observer).active.damage,2);
  assert.equal(f.view(owner).self.battle.illusionDecoyId,undefined);
  assert.equal(f.room().discardPile.filter(card=>card.id===decoy.id).length,1);
});

test('a dodge leaves Illusion intact and positive damage ends it',t=>{
  const f=fixture(t,{pack:HOENN_PACK}),owner=f.turn(),other=f.byId(f.room().players[1].id);
  f.player(owner).reserve.catalogueId='hoenn-zorua';
  f.act(owner,'switchPokemon');
  const shown=()=>f.view(other).players.find(p=>p.id===owner.playerId).active.catalogueId;
  assert.equal(shown(),'tour-treecko');
  f.act(owner,'finishPlay');
  while(f.room().turn.phase==='discard')f.act(owner,'discard',{cardId:f.player(owner).hand[0].id});
  f.act(owner,'endTurn');
  while(f.room().turn.drawRemaining)f.act(other,'draw');
  Object.assign(f.player(other).active,{catalogueId:'hoenn-castform',level:2});
  const dodge=f.take(owner,card=>card.kind==='dodge'&&!card.variant);
  f.attack(owner);
  f.act(owner,'respondBattle',{decisionId:f.room().pendingBattle.id,choice:'dodge',cardId:dodge.id});
  assert.equal(shown(),'tour-treecko');
  const fee=f.take(other,card=>card.weather==='rain');
  f.act(other,'attack',{cardId:fee.id,moveIndex:1,targetIds:[owner.playerId]});
  f.pass();
  assert.equal(shown(),'hoenn-zorua');
  assert.equal(f.player(owner).active.damage,1);
});


test('Trainer Showdown keeps both picks private through restart and reveals them in one settlement', t => {
  const f = fixture(t,{pack:MIXED_PACK}), source = f.turn();
  const [target,other] = f.seats.filter(seat=>seat!==source);
  const spectator = f.spectate();
  const committed = f.take(source,card=>card.weather==='rain');
  const reply = f.take(target,card=>card.weather==='thunderstorm');
  f.player(target).hand = [reply];
  f.player(other).hand = [];
  const sourceCount = f.player(source).hand.length;

  f.act(source,'tourAction',{action:'showdown'});
  assert.ok(!f.view(source).pendingBattle.options.some(option=>[source.playerId,other.playerId,spectator.playerId].includes(option.value)));
  f.choose(target.playerId);
  assert.throws(()=>f.act(target,'respondBattle',{decisionId:f.room().pendingBattle.id,choice:'choose',effect:reply.id}));
  f.choose(committed.id);
  assert.equal(f.player(source).hand.length,sourceCount);
  assert.ok(!f.room().discardPile.includes(committed));
  for (const viewer of [source,target,other,spectator]) {
    const view = f.view(viewer);
    assert.equal(view.pendingBattle.continuation,undefined);
    assert.ok(!JSON.stringify(view.pendingBattle).includes(committed.id));
    assert.equal(Boolean(view.pendingBattle.options),viewer===target);
    assert.ok(!view.log.some(entry=>entry.text.en.includes('revealed '+committed.name.en)));
  }
  f.restart();
  assert.equal(f.view(target).pendingBattle.options[0].value,reply.id);
  assert.equal(f.view(target).pendingBattle.allowPass,false);
  assert.deepEqual(aiActions(f.room(),f.player(target),f.catalogue())[0],{
    type:'respondBattle',decisionId:f.room().pendingBattle.id,choice:'choose',effect:reply.id,
  });
  f.choose(reply.id);
  assert.equal(f.room().pendingBattle,null);
  assert.equal(f.player(source).hand.length,sourceCount-1);
  assert.equal(f.player(target).hand.length,1);
  assert.deepEqual(f.room().discardPile.slice(-2).map(card=>card.id),[committed.id,reply.id]);
  const result = f.view(spectator).log.at(-1).text.en;
  assert.ok(result.includes(committed.name.en) && result.includes(reply.name.en));
  assert.ok(result.endsWith(f.player(target).nickname+' won and drew one card.'));
  assert.throws(()=>f.act(source,'tourAction',{action:'showdown'}),{code:'ACTION_UNAVAILABLE'});
});

test('Trainer Showdown can be canceled before committing and a tied pair is discarded without a reward', t => {
  const f = fixture(t), source = f.turn();
  const target = f.seats.find(seat=>seat!==source);
  const first = f.take(source,card=>card.weather==='clear');
  const second = f.take(target,card=>card.weather==='clear');
  f.act(source,'tourAction',{action:'showdown'});
  f.choose(target.playerId);
  f.pass();
  assert.ok(f.player(source).hand.some(card=>card.id===first.id));
  f.act(source,'tourAction',{action:'showdown'});
  f.choose(target.playerId);
  f.choose(first.id);
  const sourceCount = f.player(source).hand.length;
  const targetCount = f.player(target).hand.length;
  f.choose(second.id);
  assert.equal(f.player(source).hand.length,sourceCount-1);
  assert.equal(f.player(target).hand.length,targetCount-1);
  assert.match(f.view(source).log.at(-1).text.en,/Draw\.$/);
});

test('Trainer Showdown cancels optional choices on timeout and settles an already committed pair', t => {
  let now = 1_000_000;
  const f = fixture(t,{responseSeconds:5,now:()=>now}), source = f.turn();
  const target = f.seats.find(seat=>seat!==source);
  const first = f.take(source,card=>card.weather==='intense-sun');
  const weaker = f.take(target,card=>card.weather==='clear');
  f.room().discardPile.push(...f.player(target).hand.filter(card=>card!==weaker));
  f.player(target).hand = [weaker];
  f.act(source,'tourAction',{action:'showdown'});
  now += 5_100;
  assert.equal(f.view(source).pendingBattle,null);
  f.act(source,'tourAction',{action:'showdown'});
  f.choose(target.playerId);
  f.choose(first.id);
  f.view(target);
  now += 5_100;
  const view = f.view(target);
  assert.equal(view.pendingBattle,null);
  assert.ok(view.log.at(-1).text.en.endsWith(f.player(source).nickname+' won and drew one card.'));
});

test('Go All Out spends 1 actual HP for two cards, once per trainer per match, and stays in tour packs', t => {
  for (const pack of ['base',HOENN_PACK,TOUR_PACK,MIXED_PACK]) {
    const f = fixture(t,{pack}), source = f.turn();
    const available = action => f.view(source).self.battle.tourActions.some(entry=>entry.kind===action);
    const enabled = [TOUR_PACK,MIXED_PACK].includes(pack);
    assert.equal(available('all-out'),enabled);
    assert.equal(available('showdown'),enabled);
    if (!enabled) {
      for (const action of ['all-out','showdown']) assert.throws(()=>f.act(source,'tourAction',{action}),{code:'ACTION_UNAVAILABLE'});
      continue;
    }
    const start = f.view(source).players.find(player=>player.id===source.playerId).active.hp;
    f.player(source).active.damage = start-1;
    assert.equal(available('all-out'),false);
    f.player(source).active.damage = start-2;
    f.player(source).active.reinforcements.push('defense');
    f.act(source,'tourAction',{action:'all-out'});
    f.pass();
    const before = f.player(source).hand.length;
    f.act(source,'tourAction',{action:'all-out'});
    f.choose('pay');
    assert.equal(f.player(source).hand.length,before+2);
    assert.equal(f.view(source).players.find(player=>player.id===source.playerId).active.hp,1);
    assert.deepEqual(f.player(source).active.reinforcements,['defense']);
    assert.equal(f.room().resolution,null);
    assert.match(f.view(source).log.at(-1).text.en,/paid 1 HP/);
    f.restart();
    f.player(source).active.damage = 0;
    assert.equal(available('all-out'),false);
    assert.throws(()=>f.act(source,'tourAction',{action:'all-out'}),{code:'ACTION_UNAVAILABLE'});
  }
});

test('Mimikyu enters the Hoenn pool only when both visual forms can be supplied', t => {
  for (const available of [false,true]) {
    const f = fixture(t,{pack:HOENN_PACK,play:false,mimikyuAvailable:available});
    const catalogue = f.catalogue();
    assert.equal(battleSelectionIds(catalogue,HOENN_PACK).includes('hoenn-mimikyu'),available);
    assert.equal(battleSelectionIds(catalogue,MIXED_PACK).includes('hoenn-mimikyu'),available);
    assert.ok(!battleSelectionIds(catalogue,'base').includes('hoenn-mimikyu'));
  }
});

test('a full Dodge keeps Disguise, its first real hit skips damage and its secondary, then stays Busted across reload', t => {
  const f = fixture(t,{pack:HOENN_PACK,mimikyuAvailable:true,lineups:['charmander','hoenn-mimikyu','rhyhorn','bulbasaur']});
  const source = f.turn(), target = f.byId(f.room().players.find(seat=>seat.active.catalogueId==='hoenn-mimikyu').id);
  const shown = viewer => f.view(viewer).players.find(seat=>seat.id===target.playerId).active;
  const dodge = f.take(target,card=>card.kind==='dodge' && !card.variant);
  const attack = () => {
    f.room().turn.usedMoves = [];
    const command = f.take(source,card=>card.kind==='command' && !card.variant);
    f.act(source,'attack',{cardId:command.id,moveIndex:0,targetIds:[target.playerId]});
  };
  attack();
  f.act(target,'respondBattle',{decisionId:f.room().pendingBattle.id,choice:'dodge',cardId:dodge.id});
  assert.equal(shown(source).fieldForm,undefined);
  assert.equal(shown(source).hp,3);
  attack();
  const top = f.room().drawPile.at(-1).id;
  f.pass();
  assert.equal(f.room().pendingBattle,null);
  assert.equal(f.room().drawPile.at(-1).id,top);
  assert.equal(shown(source).hp,3);
  assert.equal(shown(source).status,null);
  assert.equal(shown(source).fieldForm,'busted');
  assert.ok(f.view(source).visualEvents.some(event=>event.kind==='ability'&&event.name.en==='Disguise'));
  f.restart();
  assert.equal(shown(source).fieldForm,'busted');
  attack();
  f.pass();
  assert.equal(shown(source).hp,2);
  assert.equal(shown(source).fieldForm,'busted');
});

test('trait suppression and field damage leave Disguise available for another move', t => {
  const f = fixture(t,{pack:HOENN_PACK,mimikyuAvailable:true,lineups:['squirtle','hoenn-mimikyu','rhyhorn','bulbasaur']});
  const target = f.byId(f.room().players.find(seat=>seat.active.catalogueId==='hoenn-mimikyu').id);
  f.room().turn.suppressedTraitPlayerIds=[target.playerId];
  f.attack(target);
  f.pass();
  assert.equal(f.player(target).active.damage,2);
  assert.equal(f.player(target).active.disguiseSpent,undefined);
  f.room().turn.suppressedTraitPlayerIds=[];
  f.room().turn.usedMoves=[];
  f.attack(target);
  f.pass();
  assert.equal(f.player(target).active.damage,2);
  assert.equal(f.player(target).active.disguiseSpent,true);

  const sandRoom = fixture(t,{pack:HOENN_PACK,mimikyuAvailable:true,lineups:['hoenn-mimikyu','squirtle','rhyhorn','bulbasaur']});
  const source = sandRoom.turn();
  const sand = sandRoom.take(source,card=>card.eventType==='hoenn-sand');
  sandRoom.act(source,'useEvent',{cardId:sand.id,targetId:source.playerId});
  while(sandRoom.room().pendingBattle) sandRoom.pass();
  sandRoom.act(source,'finishPlay');
  while(sandRoom.room().turn.phase==='discard') sandRoom.act(source,'discard',{cardId:sandRoom.player(source).hand[0].id});
  sandRoom.act(source,'endTurn');
  assert.equal(sandRoom.player(source).active.damage,1);
  assert.equal(sandRoom.player(source).active.disguiseSpent,undefined);
});

test('Lv.3 Mimikyu can give up its intact Disguise for one Power marker and the spent form stays when it switches out', t => {
  const f = fixture(t,{pack:MIXED_PACK,mimikyuAvailable:true}), owner = f.turn();
  const other = f.seats.find(seat=>seat!==owner);
  const id = f.player(owner).active.instanceId;
  Object.assign(f.player(owner).active,{catalogueId:'hoenn-mimikyu',level:2,damage:0});
  const available = () => f.view(owner).self.battle.tourActions.some(action=>action.kind==='shed-disguise');
  assert.equal(available(),false);
  f.player(owner).active.level=3;
  assert.equal(available(),true);
  f.act(owner,'tourAction',{action:'shed-disguise'});
  f.pass();
  assert.equal(available(),true);
  f.act(owner,'tourAction',{action:'shed-disguise'});
  f.choose('power');
  assert.equal(available(),false);
  assert.deepEqual(f.player(owner).active.reinforcements,['power']);
  assert.equal(f.view(other).players.find(player=>player.id===owner.playerId).active.fieldForm,'busted');
  f.player(owner).reserve.catalogueId='hoenn-zorua';
  f.act(owner,'switchPokemon');
  assert.equal(f.player(owner).reserve.instanceId,id);
  assert.equal(f.player(owner).reserve.disguiseSpent,true);
  const cover = f.view(other).players.find(player=>player.id===owner.playerId).active;
  assert.equal(cover.catalogueId,'hoenn-mimikyu');
  assert.equal(cover.fieldForm,'busted');
});


test('Follow Me privately pays one hand card and moves the original defense and damage to an eligible teammate', t => {
  const f=fixture(t,{manualFollowMe:true,pack:TOUR_PACK,lineups:['tour-treecko','squirtle','bulbasaur','rhyhorn']});
  const [source,target,,guard]=f.room().players.map(player=>f.byId(player.id));
  const spectator=f.spectate();
  f.player(target).active.damage=maxHp(f.player(target).active,f.catalogue())-1;
  const targetDamage=f.player(target).active.damage;
  const fee=f.take(guard,c=>c.kind==='held-item');
  const feeCount=f.player(guard).hand.length;
  f.attack(target);
  const offer=f.view(guard).pendingBattle;
  assert.equal(offer.title.en,'Follow Me');
  assert.equal(offer.targetId,target.playerId);
  assert.equal(offer.actorId,guard.playerId);
  assert.ok(offer.options.some(option=>option.value===fee.id));
  for (const viewer of [source,target,spectator]) {
    assert.equal(f.view(viewer).pendingBattle.options,undefined);
    assert.equal(f.view(viewer).pendingBattle.continuation,undefined);
  }
  assert.throws(()=>f.act(target,'respondBattle',{decisionId:offer.id,choice:'choose',effect:fee.id}),{code:'NOT_YOUR_DECISION'});
  f.restart();
  assert.equal(aiActions(f.room(),f.player(guard),f.catalogue())[0].choice,'choose');
  f.choose(fee.id);
  assert.equal(f.room().pendingBattle.kind,'defense');
  assert.equal(f.room().pendingBattle.targetId,guard.playerId);
  assert.equal(f.player(guard).hand.length,feeCount-1);
  assert.equal(f.room().discardPile.at(-1).id,fee.id);
  f.pass();
  assert.equal(f.player(target).active.damage,targetDamage);
  assert.equal(f.player(guard).active.damage,1);
  assert.ok(f.view(spectator).visualEvents.some(event=>event.kind==='attack'&&event.release&&event.targetIds[0]===guard.playerId));
});

test('Follow Me passes on expiry and excludes teammates outside the original attack range', t => {
  let now=1_000_000;
  const f=fixture(t,{manualFollowMe:true,pack:TOUR_PACK,responseSeconds:5,now:()=>now,
    lineups:['tour-treecko','squirtle','bulbasaur','rhyhorn']});
  const [source,target,,guard]=f.room().players.map(player=>f.byId(player.id));
  const count=f.player(guard).hand.length;
  f.attack(target);
  f.view(guard);
  now+=5_100;
  assert.equal(f.view(guard).pendingBattle.kind,'defense');
  assert.equal(f.room().pendingBattle.actorId,target.playerId);
  assert.equal(f.player(guard).hand.length,count);

  const six=fixture(t,{manualFollowMe:true,count:6,pack:TOUR_PACK,
    lineups:['tour-treecko','squirtle','bulbasaur','rhyhorn','charmander','diglett']});
  const [,victim,,,,inRange]=six.room().players.map(player=>six.byId(player.id));
  six.room().discardPile.push(...six.player(inRange).hand);
  six.player(inRange).hand=[];
  six.attack(victim);
  assert.equal(six.room().pendingBattle.kind,'defense');
  assert.equal(six.room().pendingBattle.actorId,victim.playerId);
});

test('Follow Me stays in enabled content and requires a move designed for one target', t => {
  for (const [pack,mode] of [['base','teams'],[HOENN_PACK,'teams'],[TOUR_PACK,'identity']]) {
    const f=fixture(t,{manualFollowMe:true,pack,mode,lineups:['charmander','squirtle','bulbasaur','rhyhorn']});
    const target=f.byId(f.room().players[1].id);
    f.attack(target);
    assert.equal(f.room().pendingBattle.kind,'defense');
    assert.equal(f.room().pendingBattle.actorId,target.playerId);
  }
  const f=fixture(t,{manualFollowMe:true,pack:MIXED_PACK,lineups:['squirtle','rhyhorn','bulbasaur','charmander']});
  const source=f.turn();
  f.player(source).active.level=3;
  const surf=f.view(source).self.battle.moves.find(move=>move.name.en==='Surf');
  assert.ok(surf.maxTargets>1);
  f.attack(f.byId(f.room().players[1].id),surf.index);
  assert.equal(f.room().pendingBattle.kind,'defense');
});


test('Pokédex Survey reveals only the chosen top card and earns one post-discard Night Observation draw', t=>{
  const f=fixture(t,{pack:TOUR_PACK,lineups:['tour-treecko','squirtle','bulbasaur','rhyhorn']}), owner=f.turn();
  const observer=f.spectate();
  const tool=f.take(owner,card=>card.toolType==='tour-gear-dex');
  const priorities=aiActions(f.room(),f.player(owner),f.catalogue());
  const dex=priorities.findIndex(action=>action.cardId===tool.id && action.effect==='tour-dex');
  const gear=priorities.findIndex(action=>action.cardId===tool.id && action.effect==='tour-gear');
  assert.ok(dex>=0 && gear>dex);
  f.act(owner,'useTool',{cardId:tool.id,effect:'tour-dex',targetId:owner.playerId,slot:'active'});
  const [first,second]=f.view(owner).pendingBattle.options;
  f.choose(second.value);
  assert.equal(f.room().drawPile.at(-1).id,second.value);
  assert.ok(!JSON.stringify(f.view(observer)).includes(second.value));
  assert.ok(!f.view(observer).log.some(entry=>entry.tourCard));
  f.restart();
  assert.ok(f.view(owner).self.battle.tourActions.some(action=>action.kind==='publish-survey'));
  assert.ok(aiActions(f.room(),f.player(owner),f.catalogue()).some(action=>action.action==='publish-survey'));
  f.act(owner,'tourAction',{action:'publish-survey'});
  const published=f.view(observer).log.at(-1);
  assert.equal(published.tourCard.weather,second.card.weather);
  assert.deepEqual(published.tourCard.name,second.card.name);
  assert.ok(!JSON.stringify(published).includes(first.value) && !JSON.stringify(published).includes(second.value));
  assert.equal(f.room().drawPile.at(-2).id,first.value);
  assert.equal(f.room().drawPile.at(-1).id,second.value);
  assert.throws(()=>f.act(owner,'tourAction',{action:'publish-survey'}),{code:'ACTION_UNAVAILABLE'});
  f.act(owner,'finishPlay');
  while(f.room().turn.phase==='discard')f.act(owner,'discard',{cardId:f.player(owner).hand[0].id});
  const hand=f.player(owner).hand.length;
  f.restart();
  assert.equal(f.view(owner).turn.tourNightObservation,true);
  f.act(owner,'endTurn');
  assert.equal(f.player(owner).hand.length,hand+1);
  assert.ok(f.player(owner).hand.some(card=>card.id===second.value));
  assert.equal(f.view().turn.tourNightObservation,undefined);
});

test('a private Pokédex ordering and an obsolete top card cannot earn Night Observation', t=>{
  for (const changed of [false,true]) {
    const f=fixture(t,{pack:TOUR_PACK,lineups:['tour-treecko','squirtle','bulbasaur','rhyhorn']}), owner=f.turn();
    f.tool(owner,'tour-gear-dex','tour-dex');
    const top=f.view(owner).pendingBattle.options[0].value;
    f.choose(top);
    if (changed) {
      f.act(owner,'tourAction',{action:'prepare'});
      f.choose(f.player(owner).hand[0].id);
      assert.ok(f.player(owner).hand.some(card=>card.id===top));
      assert.throws(()=>f.act(owner,'tourAction',{action:'publish-survey'}),{code:'ACTION_UNAVAILABLE'});
    }
    f.act(owner,'finishPlay');
    while(f.room().turn.phase==='discard')f.act(owner,'discard',{cardId:f.player(owner).hand[0].id});
    const hand=f.player(owner).hand.length;
    f.act(owner,'endTurn');
    assert.equal(f.player(owner).hand.length,hand);
    assert.ok(!f.view().log.some(entry=>entry.text.en.includes('Night Observation')));
  }
});

test('Night Observation resolves once before end-turn sand damage and survives the rescue interruption', t=>{
  const f=fixture(t,{pack:MIXED_PACK,lineups:['tour-treecko','squirtle','bulbasaur','rhyhorn']}), owner=f.turn();
  f.player(owner).active.damage=maxHp(f.player(owner).active,f.catalogue())-1;
  const sand=f.take(owner,card=>card.eventType==='hoenn-sand');
  f.act(owner,'useEvent',{cardId:sand.id,targetId:owner.playerId});
  while(f.room().pendingBattle)f.pass();
  f.tool(owner,'tour-gear-dex','tour-dex');
  f.choose(f.view(owner).pendingBattle.options[0].value);
  f.act(owner,'tourAction',{action:'publish-survey'});
  f.act(owner,'finishPlay');
  while(f.room().turn.phase==='discard')f.act(owner,'discard',{cardId:f.player(owner).hand[0].id});
  const hand=f.player(owner).hand.length;
  f.act(owner,'endTurn');
  assert.equal(f.player(owner).hand.length,hand+1);
  assert.equal(f.room().pendingBattle.kind,'rescue');
  f.restart();
  while(f.room().pendingBattle)f.pass();
  assert.equal(f.player(owner).hand.length,hand+1);
  assert.equal(f.view().log.filter(entry=>entry.text.en.startsWith('Night Observation let')).length,1);
});

test('the radio scenario requires teams and starts with a public 0–0 score at both seat limits', t=>{
  assert.throws(()=>fixture(t,{play:false,mode:'identity',teamScenario:RADIO_TOWER}),{code:'INVALID_SETTINGS'});
  assert.throws(()=>fixture(t,{play:false,teamScenario:'missing'}),{code:'INVALID_SETTINGS'});
  for (const count of [2,30]) {
    const f=fixture(t,{count,pack:'base',play:false,teamScenario:RADIO_TOWER});
    assert.equal(f.view().settings.teamScenario,RADIO_TOWER);
    assert.deepEqual(f.view().scenario.radio,{goal:4,scores:{'team-a':0,'team-b':0}});
  }
  assert.equal(fixture(t,{play:false}).view().scenario.radio,undefined);
});

test('Radio Contact keeps either first pick private and atomically charges two different printed weathers', t=>{
  const f=fixture(t,{pack:'base',teamScenario:RADIO_TOWER,lineups:['charmander','squirtle','bulbasaur','rhyhorn']});
  const owner=f.turn(), spectator=f.spectate(), role=f.player(owner).role;
  const first=f.take(owner,card=>card.weather==='clear');
  const invalid=f.take(owner,card=>card.weather==='clear'&&card.id!==first.id);
  const second=f.take(owner,card=>card.weather==='thunderstorm');
  const count=f.player(owner).hand.length;
  const available=()=>f.view(owner).self.battle.tourActions.some(action=>action.kind==='radio-contact');
  f.act(owner,'tourAction',{action:'radio-contact'});
  f.choose(first.id);
  assert.ok(!f.view(owner).pendingBattle.options.some(option=>option.value===invalid.id || option.value===first.id));
  assert.equal(f.view(spectator).pendingBattle.options,undefined);
  assert.equal(f.view(spectator).pendingBattle.continuation,undefined);
  assert.equal(f.view(spectator).scenario.radio.scores[role],0);
  assert.equal(f.player(owner).hand.length,count);
  assert.throws(()=>f.choose(invalid.id),{code:'INVALID_RESPONSE'});
  f.pass();
  assert.ok(available());
  f.act(owner,'tourAction',{action:'radio-contact'});
  f.choose(first.id);
  f.restart();
  const decision=aiActions(f.room(),f.player(owner),f.catalogue())[0];
  assert.ok(f.view(owner).pendingBattle.options.some(option=>option.value===decision.effect));
  f.choose(second.id);
  assert.equal(f.player(owner).hand.length,count-2);
  assert.deepEqual(f.room().discardPile.slice(-2).map(card=>card.id),[first.id,second.id]);
  assert.equal(f.view(spectator).scenario.radio.scores[role],1);
  assert.equal(available(),false);
});

test('four real Radio Contacts win immediately and a rematch starts with fresh intelligence scores', t=>{
  const f=fixture(t,{count:2,pack:'base',teamScenario:RADIO_TOWER,lineups:['charmander','squirtle']});
  const owner=f.turn(), role=f.player(owner).role;
  const other=f.seats.find(seat=>seat!==owner);
  function finish(who) {
    while(f.room().turn.drawRemaining) f.act(who,'draw');
    f.act(who,'finishPlay');
    while(f.room().turn.phase==='discard') f.act(who,'discard',{cardId:f.player(who).hand[0].id});
    f.act(who,'endTurn');
  }
  for(let point=1;point<=4;point++){
    while(f.room().turn.drawRemaining) f.act(owner,'draw');
    const first=f.take(owner,card=>card.weather==='clear'), second=f.take(owner,card=>card.weather==='rain');
    f.act(owner,'tourAction',{action:'radio-contact'});
    f.choose(first.id);
    f.choose(second.id);
    assert.equal(f.view().scenario.radio.scores[role],point);
    if(point<4){finish(owner);finish(other);}
  }
  assert.equal(f.view().status,'finished');
  assert.equal(f.view().result.reason,'intelligence');
  assert.deepEqual(f.view().result.winnerIds,[owner.playerId]);
  assert.equal(f.player(other).eliminated,false);
  assert.equal(f.view().pendingBattle,null);
  f.act(f.host,'returnToLobby');
  assert.equal(f.view().settings.teamScenario,RADIO_TOWER);
  assert.equal(f.view().scenario,undefined);
  for(const seat of f.seats) f.act(seat,'ready',{ready:true});
  f.act(f.host,'startBattlePreview');
  assert.deepEqual(f.view().scenario.radio.scores,{'team-a':0,'team-b':0});
});

test('knocking out the opposing team still finishes a radio match without reaching four points', t=>{
  const f=fixture(t,{count:2,pack:'base',teamScenario:RADIO_TOWER,lineups:['charmander','squirtle']});
  const owner=f.turn(), opponent=f.seats.find(seat=>seat!==owner);
  const foe=f.player(opponent);
  foe.active.damage=maxHp(foe.active,f.catalogue())-1;
  foe.reserve.defeated=true;
  f.attack(opponent);
  while(f.room().pendingBattle) f.pass();
  assert.equal(f.view().status,'finished');
  assert.equal(f.view().result.reason,'elimination');
  assert.deepEqual(f.view().result.winnerIds,[owner.playerId]);
  assert.deepEqual(f.view().scenario.radio.scores,{'team-a':0,'team-b':0});
});
