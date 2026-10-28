import { randomInt } from 'node:crypto';

// Shuffle one shared Pokémon-group deck. Reserve disjoint private deals before
// independent draw clicks, so neither request order nor reconnect can duplicate a group.
export function shufflePokemon(ids) {
  const pool = [...new Set(ids)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}
export function dealPokemon(players, ids, { revealImmediately = false } = {}) {
  const pool = shufflePokemon(ids);
  if (pool.length < players.length * 5) throw new RangeError('Five unique Pokémon per player require a sufficiently large shared deck.');
  for (const player of players) {
    const deal = pool.splice(0, 5);
    player.candidates = revealImmediately ? deal : [];
    player.candidateDeal = revealImmediately ? [] : deal;
  }
  return pool;
}
