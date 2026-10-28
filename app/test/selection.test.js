import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RoomStore} from '../server/store.js';

const catalogue=JSON.parse(readFileSync(new URL('../content/catalogue.json',import.meta.url),'utf8'));
function game(t,count=6,content=catalogue,mode='startBattlePreview') {
  const root=fileURLToPath(new URL('../.data/',import.meta.url));mkdirSync(root,{recursive:true});
  const dir=mkdtempSync(join(root,'selection-test-'));
  t.after(()=>{if(resolve(dirname(dir))!==resolve(root))throw Error('Unexpected test directory');rmSync(dir,{recursive:true,force:true});});
  const now=()=>1_000_000,store=new RoomStore({dataDir:dir,catalogue:content,now});
  const owner=store.create({nickname:'Owner'});
  const seats=[owner,...Array.from({length:count-1},(_,i)=>store.join(owner.code,{nickname:`Seat ${i+2}`}))];
  const observer=store.join(owner.code,{nickname:'Observer',spectator:true});let serial=0;
  const room=()=>store.rooms.get(owner.code);
  const view=who=>store.view(owner.code,who.token).view;
  const act=(who,type,payload={})=>store.action(owner.code,who.token,{id:`pick-${++serial}`,revision:room().revision,type,...payload}).view;
  for(const seat of seats)act(seat,'ready',{ready:true});
  const start=()=>act(owner,mode),identities=()=>{for(const seat of seats)act(seat,'acknowledgeIdentity');};
  return{store,dir,owner,seats,observer,room,view,act,start,identities,now};
}
function rejects(fn,code){assert.throws(fn,e=>e.code===code);}

test('identities are assigned and acknowledged before any Pokémon candidate is dealt or drawn',t=>{
  const f=game(t);const first=f.start();
  assert.equal(first.status,'identity');assert.ok(first.self.role);assert.deepEqual(first.self.candidates,[]);
  assert.equal(f.room().pokemonDeck,undefined);
  const roles=new Map(f.room().players.filter(p=>!p.spectator).map(p=>[p.id,p.role]));
  for(const seat of f.seats){const view=f.view(seat);assert.deepEqual(view.self.candidates,[]);assert.equal(view.self.pokemonDrawRemaining,0);assert.equal(view.players.filter(p=>p.role).length,1);assert.equal(view.players.find(p=>p.role).role,'leader');}
  rejects(()=>f.act(f.owner,'drawPokemon'),'WRONG_PHASE');
  rejects(()=>f.act(f.owner,'selectPokemon',{activeId:'bulbasaur',reserveId:'squirtle'}),'WRONG_PHASE');
  rejects(()=>f.act(f.observer,'acknowledgeIdentity'),'SPECTATOR_ONLY_VIEW');
  for(const seat of f.seats.slice(0,-1)){f.act(seat,'acknowledgeIdentity');assert.equal(f.room().status,'identity');}
  assert.ok(f.room().players.every(p=>!p.candidateDeal?.length));
  f.act(f.seats.at(-1),'acknowledgeIdentity');
  assert.equal(f.room().status,'setup');
  assert.deepEqual(new Map(f.room().players.filter(p=>!p.spectator).map(p=>[p.id,p.role])),roles);
  assert.ok(f.seats.every(s=>f.view(s).self.pokemonDrawRemaining===5));
});

test('six players draw 30 globally unique candidates; choose exactly two from their own five',t=>{
  const f=game(t);f.start();f.identities();const all=[];
  const hidden=f.view(f.observer);
  assert.deepEqual(hidden.self.candidates,[]);assert.equal(hidden.pokemonDeck,undefined);
  assert.ok(hidden.players.every(p=>p.candidateDeal===undefined&&p.candidates===undefined));
  for(const seat of f.seats){
    for(let n=0;n<5;n++){const v=f.act(seat,'drawPokemon');assert.equal(v.self.candidates.length,n+1);assert.equal(v.self.pokemonDrawRemaining,4-n);}
    const picks=f.view(seat).self.candidates;all.push(...picks);assert.equal(new Set(picks).size,5);
    rejects(()=>f.act(seat,'drawPokemon'),'POKEMON_DRAW_EXHAUSTED');
    rejects(()=>f.act(seat,'selectPokemon',{activeId:picks[0],reserveId:picks[0]}),'INVALID_SELECTION');
  }
  assert.equal(all.length,30);assert.equal(new Set(all).size,30);
  assert.equal(f.room().pokemonDeck.length,10);
  const other=f.view(f.seats[1]).self.candidates;
  rejects(()=>f.act(f.owner,'selectPokemon',{activeId:other[0],reserveId:other[1]}),'INVALID_SELECTION');
  for(const [i,seat]of f.seats.entries()){
    const picks=f.view(seat).self.candidates;f.act(seat,'selectPokemon',{activeId:picks[0],reserveId:picks[1]});
    if(i<5){assert.equal(f.room().status,'setup');assert.equal(f.view(f.observer).players.find(p=>p.id===seat.playerId).active,null);}
  }
  assert.equal(f.room().status,'playing');
  const chosen=f.room().players.filter(p=>!p.spectator).flatMap(p=>[p.active.catalogueId,p.reserve.catalogueId]);
  assert.equal(new Set(chosen).size,12);assert.equal(f.room().pokemonDeck.length,28);
  assert.equal(new Set([...chosen,...f.room().pokemonDeck]).size,40);
  assert.ok(f.view(f.observer).players.every(p=>p.reserve===undefined));
});

test('candidate draws cannot be skipped, forged, doubled by retries, or rerolled by reconnect/restart',t=>{
  const f=game(t,3);f.start();f.identities();
  const reserved=[...f.room().players.find(p=>p.id===f.owner.playerId).candidateDeal];
  const input={id:'one-candidate',revision:f.room().revision,type:'drawPokemon'};
  const first=f.store.action(f.owner.code,f.owner.token,input).view;
  const retry=f.store.action(f.owner.code,f.owner.token,input).view;
  assert.deepEqual(retry,first);assert.deepEqual(first.self.candidates,[reserved[0]]);
  f.act(f.owner,'drawPokemon');
  rejects(()=>f.act(f.owner,'selectPokemon',{activeId:reserved[0],reserveId:reserved[1]}),'CANDIDATE_DRAW_INCOMPLETE');
  const restored=new RoomStore({dataDir:f.dir,catalogue,now:f.now});
  const recovered=restored.view(f.owner.code,f.owner.token).view;
  assert.deepEqual(recovered.self.candidates,reserved.slice(0,2));assert.equal(recovered.self.pokemonDrawRemaining,3);
  assert.deepEqual(restored.rooms.get(f.owner.code).players.find(p=>p.id===f.owner.playerId).candidateDeal,reserved.slice(2));
  assert.equal(recovered.self.identityAcknowledged,true);
  rejects(()=>restored.action(f.owner.code,f.owner.token,{id:'forged-draw',revision:recovered.revision,type:'drawPokemon',catalogueId:'bulbasaur'}),'INVALID_INPUT');
  assert.deepEqual(restored.view(f.owner.code,f.owner.token).view.self.candidates,reserved.slice(0,2));
});

test('deals vary between matches and insufficient decks fail before identity assignment',t=>{
  const deals=[];
  for(let i=0;i<4;i++){const f=game(t,6);f.start();f.identities();deals.push(f.room().players.filter(p=>!p.spectator).flatMap(p=>p.candidateDeal).join(','));}
  assert.ok(new Set(deals).size>1);
  const f=game(t,6,{entries:catalogue.entries.slice(0,29)});const before=f.view(f.owner);
  rejects(()=>f.start(),'CONTENT_UNAVAILABLE');
  assert.equal(f.room().status,'lobby');assert.equal(f.room().revision,before.revision);
  assert.ok(f.room().players.every(p=>p.role===undefined));
});

test('legacy turn-test setup also deals without repeats across all six players',t=>{
  const f=game(t,6,catalogue,'start');f.start();
  const deals=f.seats.flatMap(s=>f.view(s).self.candidates);
  assert.equal(deals.length,30);assert.equal(new Set(deals).size,30);
});
