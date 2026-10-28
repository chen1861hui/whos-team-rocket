import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { roleDeck, maxHp, currentHp, heal, applyDamage, beginCommand, computeDamage, ordinarySwitch, eligibleTargetIds, evaluateVictory } from '../server/battle-rules.js';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));
const pokemon = (catalogueId = 'bulbasaur', level = 1, extra = {}) => ({ catalogueId, level, damage: 0, ...extra });
const player = (id, role, extra = {}) => ({ id, role, spectator: false, active: pokemon(), reserve: pokemon('squirtle'), hand: [], ...extra });

test('booklet p.02 role counts for each supported trainer count', () => {
  assert.deepEqual(roleDeck(3), ['leader', 'challenger', 'rocket']);
  assert.deepEqual(roleDeck(4), ['leader', 'gym', 'challenger', 'rocket']);
  assert.deepEqual(roleDeck(5), ['leader', 'gym', 'challenger', 'challenger', 'rocket']);
  assert.deepEqual(roleDeck(6), ['leader', 'gym', 'challenger', 'challenger', 'challenger', 'rocket']);
  for (const count of [2, 7, 3.5, NaN]) assert.throws(() => roleDeck(count));
});

test('reviewed roster faces use printed HP; missing faces fail closed', () => {
  for (const [id, hps] of [['bulbasaur', [3, 4, 5]], ['charmander', [3, 4, 4]], ['squirtle', [3, 4, 4]]]) {
    hps.forEach((hp, index) => assert.equal(maxHp(pokemon(id, index + 1), catalogue), hp));
  }
  assert.equal(maxHp(pokemon('pikachu'), catalogue), 3);
  assert.equal(maxHp(pokemon('snorlax', 3), catalogue), 6);
  assert.throws(() => maxHp(pokemon('missing'), catalogue), /photo-reviewed/);
  assert.throws(() => maxHp(pokemon('bulbasaur', 4), catalogue), /photo-reviewed/);
  assert.throws(() => maxHp(pokemon('bulbasaur'), { entries: [{ id: 'bulbasaur', levels: [{ level: 1, hp: 99 }] }] }), /photo-reviewed/);
});

test('evolution and leader HP bonus change current HP while preserving injuries and status', () => {
  const creature = pokemon('bulbasaur', 1, { damage: 2, status: 'poison', reinforcements: ['speed'], item: 'held' });
  assert.equal(currentHp(creature, catalogue), 1);
  creature.level = 2;
  assert.equal(currentHp(creature, catalogue), 2);
  creature.hpBonus = 1;
  assert.equal(currentHp(creature, catalogue), 3);
  assert.equal(creature.damage, 2);
  assert.equal(creature.status, 'poison');
  assert.deepEqual(creature.reinforcements, ['speed']);
  assert.equal(creature.item, 'held');
});

test('damage preserves HP below zero; rescue needs enough healing to reach one', () => {
  const target = pokemon('squirtle', 1, { damage: 1, status: 'burn' });
  assert.deepEqual(applyDamage(target, 5, catalogue), { damage: 5, hp: -3, fainting: true });
  assert.equal(target.defeated, undefined);
  assert.deepEqual(heal(target, 3, catalogue), { healed: 3, hp: 0, rescued: false });
  assert.deepEqual(heal(target, 1, catalogue), { healed: 1, hp: 1, rescued: true });
  assert.deepEqual(heal(target, 99, catalogue), { healed: 2, hp: 3, rescued: false });
  assert.equal(target.damage, 0);
  assert.equal(target.status, 'burn');
});

test('Blaze uses mathematical half, including a changed maximum; paralysis does not disable traits', () => {
  const source = pokemon('charmander', 1, { damage: 1 });
  const target = pokemon();
  assert.equal(computeDamage(source, target, 1, catalogue), 1); // 2 > 1.5
  source.damage = 2;
  assert.equal(computeDamage(source, target, 1, catalogue), 3); // 1 <= 1.5
  source.hpBonus = 1;
  source.status = 'paralysis';
  assert.equal(computeDamage(source, target, 1, catalogue), 3); // 2 == 4/2
  source.hpBonus = 2;
  assert.equal(computeDamage(source, target, 1, catalogue), 1); // 3 > 5/2
});

test('power is consumed on command use, remains available for every settlement of that card', () => {
  const source = pokemon('squirtle', 1, { reinforcements: ['speed', 'power'] });
  const powerBoost = beginCommand(source);
  assert.equal(powerBoost, 1);
  assert.deepEqual(source.reinforcements, ['speed']);
  for (let settlement = 0; settlement < 2; settlement++) {
    assert.equal(computeDamage(source, pokemon(), 2, catalogue, { command: true, powerBoost }), 3);
  }
  assert.equal(beginCommand(source), 0);
  assert.equal(computeDamage(source, pokemon(), 2, catalogue), 2);
  const paralyzed = pokemon('squirtle', 1, { status: 'paralysis', reinforcements: ['power'] });
  assert.equal(beginCommand(paralyzed), 0);
  assert.deepEqual(paralyzed.reinforcements, ['power']);
});

test('burn prevents Blaze/power increases and caps move damage; defense acts at receiving stage', () => {
  const source = pokemon('charmander', 1, { damage: 2, status: 'burn', reinforcements: ['power'] });
  const powerBoost = beginCommand(source);
  assert.equal(powerBoost, 1); // discarded even though burn prevents its increase
  assert.equal(computeDamage(source, pokemon(), 3, catalogue, { powerBoost }), 1);
  assert.equal(computeDamage(source, pokemon(), 0, catalogue, { powerBoost }), 0);
  source.status = null;
  const target = pokemon('bulbasaur', 1, { reinforcements: ['defense'] });
  assert.equal(computeDamage(source, target, 3, catalogue, { powerBoost }), 1);
  assert.deepEqual(target.reinforcements, ['defense']); // card-end cleanup belongs to caller
  target.status = 'paralysis';
  assert.equal(computeDamage(source, target, 3, catalogue, { powerBoost }), 6);
});

test('ordinary switching preserves creature state and discards only outgoing reinforcement', () => {
  const trainer = player('a', 'leader');
  const outgoing = trainer.active;
  const incoming = trainer.reserve;
  Object.assign(outgoing, { damage: 1, status: 'burn', item: { id: 'item' }, reinforcements: ['speed', 'power'] });
  Object.assign(incoming, { damage: 2, status: 'sleep', reinforcements: ['defense'] });
  ordinarySwitch(trainer, catalogue);
  assert.equal(trainer.active, incoming);
  assert.equal(trainer.reserve, outgoing);
  assert.equal(incoming.revealed, true);
  assert.deepEqual(outgoing.reinforcements, []);
  assert.deepEqual(incoming.reinforcements, ['defense']);
  assert.equal(outgoing.damage, 1);
  assert.equal(outgoing.status, 'burn');
  assert.deepEqual(outgoing.item, { id: 'item' });
  assert.equal(incoming.damage, 2);
  assert.equal(incoming.status, 'sleep');
  outgoing.defeated = true;
  assert.throws(() => ordinarySwitch(trainer, catalogue), /two undefeated/);
});

test('default targets are self and neighboring active zones; eliminated trainers vacate seats', () => {
  const players = ['a', 'b', 'c', 'd', 'e'].map(id => player(id, 'challenger'));
  players.splice(1, 0, player('observer', 'rocket', { spectator: true }));
  assert.deepEqual(eligibleTargetIds(players, 'a'), ['a', 'b', 'e']);
  players.find(row => row.id === 'b').eliminated = true;
  players.find(row => row.id === 'e').eliminated = true;
  assert.deepEqual(eligibleTargetIds(players, 'a'), ['a', 'c', 'd']);
  assert.deepEqual(eligibleTargetIds(players, 'b'), []);
  assert.deepEqual(eligibleTargetIds(players, 'observer'), []);
  assert.deepEqual(eligibleTargetIds(players, 'a', { ignoreDistance: true }), ['a', 'c', 'd']);
  players.find(row => row.id === 'd').active.defeated = true;
  assert.deepEqual(eligibleTargetIds(players, 'a'), ['a', 'c']); // reserve is never substituted
});

test('no victory while living leader still has challengers or Rocket opposition', () => {
  const players = [player('l', 'leader'), player('g', 'gym'), player('c', 'challenger'), player('r', 'rocket')];
  assert.equal(evaluateVictory(players), null);
  players[2].eliminated = true;
  assert.equal(evaluateVictory(players), null);
  players[2].eliminated = false;
  players[3].eliminated = true;
  assert.equal(evaluateVictory(players), null);
  players[2].eliminated = true;
  players[1].eliminated = true;
  assert.deepEqual(evaluateVictory(players), { winner: 'leader-team', winnerIds: ['l', 'g'] });
});

test('leader defeat awards Rocket only when sole survivor, otherwise all challengers win', () => {
  const players = [player('l', 'leader', { eliminated: true }), player('g', 'gym'), player('c1', 'challenger', { eliminated: true }), player('c2', 'challenger'), player('r', 'rocket')];
  const before = structuredClone(players);
  assert.deepEqual(evaluateVictory(players), { winner: 'challengers', winnerIds: ['c1', 'c2'] });
  assert.deepEqual(players, before); // helper never assigns a room result/eliminations
  players[1].eliminated = true;
  players[3].eliminated = true;
  assert.deepEqual(evaluateVictory(players), { winner: 'rocket', winnerIds: ['r'] });
  players[4].eliminated = true;
  assert.deepEqual(evaluateVictory(players), { winner: 'challengers', winnerIds: ['c1', 'c2'] });
});

test('unassigned or spectator roles cannot trigger premature results', () => {
  assert.equal(evaluateVictory([player('a', undefined), player('b', undefined)]), null);
  assert.equal(evaluateVictory([player('c', 'challenger')]), null);
  assert.deepEqual(evaluateVictory([player('l', 'leader'), player('o', 'challenger', { spectator: true })]), { winner: 'leader-team', winnerIds: ['l'] });
});
