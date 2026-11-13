import test from 'node:test';
import assert from 'node:assert/strict';
import {coastalSeatLayout,coastalStationLayout,seatLayout} from '../public/battlefield-layout.js';

test('two to six seats stay unique, evenly spaced and within the stage radius', () => {
  for(let count=2;count<=6;count++) {
    const players=Array.from({length:count},(_,i)=>({id:`p${i}`}));
    const layout=seatLayout(players,'p0');
    assert.equal(new Set(layout.map(p=>`${p.x},${p.z}`)).size,count);
    for(const seat of layout) assert.ok(Math.abs(Math.hypot(seat.x,seat.z)-7.2)<1e-9);
    assert.equal(layout[0].x,0); assert.equal(layout[0].z,7.2);
  }
});

test('rotating for a player preserves cyclic seating and does not mutate public records', () => {
  const players=Array.from({length:6},(_,i)=>Object.freeze({id:`p${i}`}));
  const copy=JSON.stringify(players);
  const layout=seatLayout(players,'p4');
  assert.equal(layout.find(p=>p.id==='p4').slot,0);
  assert.equal(layout.find(p=>p.id==='p5').slot,1);
  assert.equal(layout.find(p=>p.id==='p0').slot,2);
  assert.equal(JSON.stringify(players),copy);
  assert.deepEqual(seatLayout(players,'spectator'),seatLayout(players,undefined));
});

test('the water gym uses room order with the leader opposite the widest seat', () => {
  for (let count=2;count<=6;count++) {
    for (let leader=0;leader<count;leader++) {
      const players=Array.from({length:count},(_,index)=>({id:`p${index}`,leader:index===leader}));
      const seats=coastalSeatLayout(players);
      assert.deepEqual(seats.map(seat=>seat.id),players.map(player=>player.id));
      assert.ok(Math.abs(seats[leader].x)<1e-9 && seats[leader].z<0);
      for (const [index,seat] of seats.entries()) {
        const next=seats[(index+1)%count];
        const step=(next.angle-seat.angle+Math.PI*2)%(Math.PI*2);
        const expected = count===6 ? [42,60,78,78,60,42][(index-leader+count)%count] : 360/count;
        assert.ok(Math.abs(step*180/Math.PI-expected)<1e-9);
        assert.ok(Math.abs(Math.hypot(seat.x,seat.z)-7.35)<1e-9);
      }
    }
  }
});

test('each water gym player sees the same uneven layout anchored at their own seat', () => {
  const players=Array.from({length:6},(_,index)=>({id:`p${index}`,leader:index===3}));
  for (const [viewer,player] of players.entries()) {
    const seats=coastalSeatLayout(players,player.id);
    const clockwise=seats.slice(viewer).concat(seats.slice(0,viewer));
    assert.deepEqual(clockwise.map(seat=>Math.round(seat.angle*180/Math.PI)),[0,78,138,180,222,282]);
    assert.deepEqual(seats.map(seat=>seat.id),players.map(seat=>seat.id));
  }
});

test('the leader and trainer stations stay attached to the arcade as Pokémon seats reflow', () => {
  const players=Array.from({length:6},(_,index)=>({id:`p${index}`,leader:index===3}));
  const original=coastalStationLayout(players);
  assert.deepEqual([...original.stations].filter(([,station])=>station.rear).map(([id])=>id),['p3']);

  for (const viewer of [...players.map(player=>player.id),'spectator']) {
    const {sceneryAngle,stations}=coastalStationLayout(players,viewer);
    for (const [id,station] of stations) {
      assert.ok(Math.abs(station.angle-sceneryAngle-original.stations.get(id).angle)<1e-9);
    }
    assert.ok(Math.abs(stations.get('p3').angle-sceneryAngle-Math.PI)<1e-9);
  }

  const sideView=coastalStationLayout(players,'p1');
  const reflowedLeader=coastalSeatLayout(players,'p1').find(seat=>seat.id==='p3');
  assert.ok(Math.abs(reflowedLeader.angle-sideView.stations.get('p3').angle)>.1);
});
