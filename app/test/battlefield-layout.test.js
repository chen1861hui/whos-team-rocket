import test from 'node:test';
import assert from 'node:assert/strict';
import {seatLayout} from '../public/battlefield-layout.js';

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
