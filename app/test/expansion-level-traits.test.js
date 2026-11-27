import test from 'node:test';
import assert from 'node:assert/strict';
import { expansionCatalogue } from '../public/expansion-content.js';
import { pokemonTypes } from '../public/pokemon-types.js';

const catalogue = expansionCatalogue({entries:[],mimikyuAvailable:true});
const descriptions = id => catalogue.entries.find(entry=>entry.id===id).levels.map(level=>level.abilityText);

test('Wynaut and Wobbuffet get the counter options and damage of each level',()=>{
  const [wynaut,wobbuffet,final] = descriptions('hoenn-wobbuffet');
  assert.match(wynaut.en,/Counter.*1 base damage/);
  assert.doesNotMatch(wynaut.en,/Mirror Coat/);
  assert.doesNotMatch(wynaut.zh,/镜面反射/);
  assert.match(wobbuffet.en,/Mirror Coat.*1 base damage/);
  assert.match(wobbuffet.zh,/镜面反射.*1 点基础伤害/);
  assert.match(final.en,/Mirror Coat.*actual damage taken, up to 2/);
  assert.match(final.zh,/镜面反射.*最多 2 点/);
});

test('the catalogue uses the current level for other abilities that unlock effects',()=>{
  const [absol,absol2,absol3] = descriptions('hoenn-absol');
  assert.doesNotMatch(absol.en,/bottom/);
  assert.match(absol2.en,/bottom/);
  assert.doesNotMatch(absol2.en,/Speed/);
  assert.match(absol3.en,/Thunderstorm.*Speed/);

  const [zorua,zoroark,zoroark3] = descriptions('hoenn-zorua');
  assert.doesNotMatch(zorua.en,/mark one/);
  assert.match(zoroark.en,/mark one non-command card/);
  assert.deepEqual(zoroark,zoroark3);

  const [mimikyu,mimikyu2,mimikyu3] = descriptions('hoenn-mimikyu');
  assert.deepEqual(mimikyu,mimikyu2);
  assert.doesNotMatch(mimikyu.en,/Power marker/);
  assert.match(mimikyu3.en,/Power marker/);
});

test('Nincada displays both evolution routes separately from battle abilities',()=>{
  const levels=catalogue.entries.find(entry=>entry.id==='hoenn-nincada').levels;
  assert.deepEqual(levels.map(level=>level.name.en),['Nincada','Nincada','Ninjask']);
  assert.match(levels[0].evolutionText.en,/Ninjask or Shedinja/);
  assert.match(levels[1].evolutionText.en,/full HP.*Shedinja/);
  assert.equal(levels[2].evolutionText,undefined);
  assert.deepEqual(levels.map(level=>level.traitName.en),['Compound Eyes','Compound Eyes','Speed Boost']);
  assert.match(levels[0].abilityText.en,/discard one extra hand card.*two Dodges/);
  assert.deepEqual(levels[1].abilityText,levels[0].abilityText);
  assert.match(levels[2].abilityText.en,/first damaging move has [+]1 range/);
  assert.deepEqual(pokemonTypes('hoenn-nincada',2),['bug','ground']);
  assert.deepEqual(pokemonTypes('hoenn-nincada',3),['bug','flying']);
});

test('expansion battle abilities have bilingual text, including shared abilities',()=>{
  for(const entry of catalogue.entries)for(const level of entry.levels){
    assert.ok(level.abilityText?.en?.trim(), `${entry.id} Lv. ${level.level}: missing English ability`);
    assert.ok(level.abilityText?.zh?.trim(), `${entry.id} Lv. ${level.level}: missing Chinese ability`);
  }
  const [first,second,third] = descriptions('tour-treecko');
  assert.deepEqual(first,second);
  assert.deepEqual(second,third);
});
