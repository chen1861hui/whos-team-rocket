import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RoomStore} from '../server/store.js';
import {civilianProfiles,gymLeaderProfiles} from '../public/trainer-profiles.js';

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

test('host and guests can claim open seats, retain ownership, and start in clockwise seat order',t=>{
  const f=game(t,3);
  const [,guest,third]=f.seats;
  assert.deepEqual(f.seats.map(seat=>seat.view.players.find(player=>player.id===seat.playerId).seatNumber),[1,2,3]);
  rejects(()=>f.act(f.observer,'chooseSeat',{seatNumber:6}),'SPECTATOR_ONLY_VIEW');
  rejects(()=>f.act(guest,'chooseSeat',{seatNumber:1}),'SEAT_TAKEN');
  rejects(()=>f.act(guest,'chooseSeat',{seatNumber:'6'}),'INVALID_SEAT');
  const revision=f.room().revision;
  f.act(f.owner,'chooseSeat',{seatNumber:6});
  rejects(()=>f.store.action(f.owner.code,guest.token,{id:'racing-seat',revision,type:'chooseSeat',seatNumber:6}),'SEAT_TAKEN');
  f.store.action(f.owner.code,guest.token,{id:'freed-seat',revision,type:'chooseSeat',seatNumber:1});
  const view=f.view(f.observer);
  assert.equal(view.ownerId,f.owner.playerId);
  assert.deepEqual(view.players.filter(p=>!p.spectator).map(p=>[p.seatNumber,p.ready]),[[6,false],[1,false],[3,true]]);
  const restored=new RoomStore({dataDir:f.dir,catalogue,now:f.now});
  assert.deepEqual(restored.view(f.owner.code,f.owner.token).view.players.filter(p=>!p.spectator).map(p=>p.seatNumber),[6,1,3]);
  rejects(()=>f.start(),'NOT_READY');
  f.act(f.owner,'ready',{ready:true});
  f.act(guest,'ready',{ready:true});
  f.start();
  rejects(()=>f.act(third,'chooseSeat',{seatNumber:4}),'WRONG_PHASE');
  const order=f.room().players.filter(p=>!p.spectator).map(p=>p.seatNumber);
  assert.deepEqual([...order,...order].slice(order.indexOf(1),order.indexOf(1)+3),[1,3,6]);
  assert.equal(f.room().players[0].role,'leader');
  assert.equal(f.room().scenario.deckCardCount,108);
});

test('simultaneous ready requests from different seats all apply without overwriting newer choices', t => {
  const f = game(t, 5);
  for (const seat of f.seats) f.act(seat, 'ready', { ready: false });
  const revision = f.view(f.owner).revision;
  const setReady = (seat, id, ready = true) => f.store.action(f.owner.code, seat.token, { id, revision, type: 'ready', ready });

  for (const [index, seat] of f.seats.entries()) setReady(seat, `concurrent-ready-${index}`);
  assert.ok(f.view(f.observer).players.filter(player => !player.spectator).every(player => player.ready));
  rejects(() => setReady(f.owner, 'old-unready', false), 'STALE_REVISION');
  rejects(() => setReady(f.observer, 'observer-ready'), 'SPECTATOR_ONLY_VIEW');
  assert.equal(f.start().status, 'identity');
  rejects(() => setReady(f.seats[1], 'ready-after-start'), 'STALE_REVISION');
});

test('a ready request from before a seat change cannot restore readiness', t => {
  const f = game(t, 3);
  const revision = f.view(f.owner).revision;
  f.act(f.owner, 'chooseSeat', { seatNumber: 6 });
  rejects(() => f.store.action(f.owner.code, f.owner.token, { id: 'old-seat-ready', revision, type: 'ready', ready: true }), 'STALE_REVISION');
  assert.equal(f.view(f.owner).players.find(player => player.id === f.owner.playerId).ready, false);
});

test('identities are assigned and acknowledged before any Pokémon candidate is dealt or drawn',t=>{
  const f=game(t);const first=f.start();
  assert.equal(first.status,'identity');assert.ok(first.self.role);assert.deepEqual(first.self.candidates,[]);
  assert.equal(f.room().pokemonDeck,undefined);
  const roles=new Map(f.room().players.filter(p=>!p.spectator).map(p=>[p.id,p.role]));
  const disguises = f.view(f.observer).players.filter(p=>!p.spectator).map(p=>p.trainerAvatar);
  assert.equal(new Set(disguises).size,6);
  assert.ok(disguises.every(profile=>civilianProfiles.includes(profile)));
  for(const seat of [...f.seats,f.observer]){
    const view=f.view(seat);assert.deepEqual(view.self.candidates,[]);assert.equal(view.self.pokemonDrawRemaining,0);
    assert.ok(view.players.every(p=>!p.role));
    assert.deepEqual(view.players.filter(p=>!p.spectator).map(p=>p.id),[...roles.keys()].sort());
    assert.deepEqual(view.players.filter(p=>!p.spectator).map(p=>p.trainerAvatar),disguises);
  }
  rejects(()=>f.act(f.owner,'drawPokemon'),'WRONG_PHASE');
  rejects(()=>f.act(f.owner,'selectPokemon',{activeId:'bulbasaur',reserveId:'squirtle'}),'WRONG_PHASE');
  rejects(()=>f.act(f.observer,'acknowledgeIdentity'),'SPECTATOR_ONLY_VIEW');
  const leader=f.seats.find(seat=>f.view(seat).self.role==='leader');
  f.act(leader,'acknowledgeIdentity');
  assert.deepEqual(f.view(f.observer).players.filter(p=>p.role).map(p=>p.role),['leader']);
  const leaderModel = gymLeaderProfiles[f.room().settings.arena] ?? gymLeaderProfiles.fire;
  assert.equal(f.view(f.observer).players.find(p=>p.id===leader.playerId).trainerAvatar,leaderModel);
  const others=f.seats.filter(seat=>seat!==leader);
  for(const seat of others.slice(0,-1)){f.act(seat,'acknowledgeIdentity');assert.equal(f.room().status,'identity');}
  assert.ok(f.room().players.every(p=>!p.candidateDeal?.length));
  f.act(others.at(-1),'acknowledgeIdentity');
  assert.equal(f.room().status,'setup');
  assert.deepEqual(new Map(f.room().players.filter(p=>!p.spectator).map(p=>[p.id,p.role])),roles);
  assert.ok(f.seats.every(s=>f.view(s).self.pokemonDrawRemaining===5));
  assert.equal(f.view(f.observer).self.candidateTypeHints,undefined);
});

test('different players can confirm identities and open or select partners from the same room revision', t => {
  const f = game(t, 3);
  const [host, guest, third] = f.seats;
  const at = (who, revision, type, payload = {}) => f.act(who, type, { revision, ...payload });
  const identity = f.start().revision;
  for (const who of f.seats) at(who, identity, 'acknowledgeIdentity');
  assert.equal(f.view(f.observer).status, 'setup');

  for (let count = 0; count < 4; count++) f.act(host, 'drawPokemon');
  const shared = f.view(host).revision;
  at(host, shared, 'drawPokemon');
  at(guest, shared, 'drawPokemon');
  rejects(() => at(guest, shared, 'drawPokemon'), 'STALE_REVISION');
  assert.equal(f.view(guest).self.candidates.length, 1);

  const picks = who => {
    const [activeId, reserveId] = f.view(who).self.candidates;
    return { activeId, reserveId };
  };
  const beforeConfirm = f.view(host).revision;
  at(host, beforeConfirm, 'selectPokemon', picks(host));
  at(guest, beforeConfirm, 'drawPokemon');
  assert.equal(f.view(guest).self.candidates.length, 2);
  assert.ok(f.view(f.observer).players.every(player => !player.active && !player.reserve));

  for (const [who, remaining] of [[guest, 3], [third, 5]]) {
    for (let count = 0; count < remaining; count++) f.act(who, 'drawPokemon');
  }
  const confirmation = f.view(guest).revision;
  at(guest, confirmation, 'selectPokemon', picks(guest));
  const result = at(third, confirmation, 'selectPokemon', picks(third));
  assert.equal(result.status, 'playing');
  assert.ok(result.players.filter(player => !player.spectator).every(player => player.handCount === 4));
  rejects(() => at(third, confirmation, 'drawPokemon'), 'STALE_REVISION');
});

test('six players draw 30 globally unique candidates; choose exactly two from their own five',t=>{
  const f=game(t);f.start();f.identities();const all=[];
  const hidden=f.view(f.observer);
  assert.deepEqual(hidden.self.candidates,[]);assert.equal(hidden.pokemonDeck,undefined);
  assert.ok(hidden.players.every(p=>p.candidateDeal===undefined&&p.candidates===undefined));
  for(const seat of f.seats){
    const hints=f.view(seat).self.candidateTypeHints;
    assert.equal(hints.length,5);
    assert.ok(hints.every(type=>typeof type==='string'));
    assert.ok(f.view(seat).players.every(player=>player.candidateTypeHints===undefined));
    for(let n=0;n<5;n++){
      const v=f.act(seat,'drawPokemon');
      assert.equal(v.self.candidates.length,n+1);
      assert.equal(v.self.pokemonDrawRemaining,4-n);
      assert.deepEqual(v.self.candidateTypeHints,hints.slice(n+1));
    }
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
