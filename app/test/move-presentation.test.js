import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { battleCueSpacing, moveEffects, moveRecipe, moveReleaseDuration } from '../public/battlefield-effect-recipes.js';
import { recordedMoves } from '../public/game-audio.js';

test('the playable catalogue has a presentation for every move and the audio manifest matches the bundled recordings', () => {
  const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json', import.meta.url), 'utf8'));
  const names = new Set(catalogue.entries.filter(entry => entry.selectionEligible).flatMap(entry =>
    entry.levels.flatMap(level => level.moves.map(move => move.name.en))));
  assert.deepEqual(new Set(moveEffects.map(move => move.name)), names);
  const signatures = [...names].map(name => moveRecipe(name).signature);
  assert.ok(signatures.every(Boolean));
  assert.equal(new Set(signatures).size, names.size);
  assert.deepEqual(moveEffects.map(move => move.key).filter(key => !recordedMoves.includes(key)), ['life-dew']);
  const audio = new URL('../public/audio/moves/', import.meta.url);
  assert.deepEqual(readdirSync(audio).filter(file=>file.endsWith('.mp3')).sort(), recordedMoves.map(key=>key+'.mp3').sort());
  for (const key of recordedMoves) assert.ok(readFileSync(new URL(key+'.mp3', audio)).length > 1024, key);
});

test('move releases lead into hit or dodge during the same animation', () => {
  for (const move of moveEffects) {
    const attack = {kind:'attack', name:{en:move.name}};
    const release = {...attack,release:true};
    const delay = battleCueSpacing(release,{kind:'hit'});
    assert.equal(battleCueSpacing({...attack,telegraph:true},release),0);
    assert.equal(battleCueSpacing(release,{kind:'dodge'}),delay);
    assert.ok(delay>0 && delay<moveReleaseDuration,move.name);
  }
});
