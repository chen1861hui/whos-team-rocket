// Standard species types from PokéAPI. Used as visual metadata.
const speciesTypes = {
  "charmander":["fire", "fire", "fire,flying"],
  "bulbasaur":"grass,poison",
  "squirtle":"water",
  "grimer":"poison",
  "shellder":["water", "water", "water,ice"],
  "gastly":"ghost,poison",
  "caterpie":["bug", "bug", "bug,flying"],
  "weedle":"bug,poison",
  "pidgey":"normal,flying",
  "sandshrew":"ground",
  "pikachu":"electric",
  "abra":"psychic",
  "psyduck":"water",
  "meowth":"normal",
  "machop":"fighting",
  "slowpoke":"water,psychic",
  "magikarp":["water", "water,flying", "water,flying"],
  "dratini":["dragon", "dragon", "dragon,flying"],
  "mankey":"fighting",
  "clefairy":"fairy",
  "vulpix":"fire",
  "nidoran-m":["poison", "poison", "poison,ground"],
  "diglett":"ground",
  "growlithe":"fire",
  "magnemite":"electric,steel",
  "exeggcute":"grass,psychic",
  "cubone":"ground",
  "koffing":"poison",
  "rhyhorn":"ground,rock",
  "chansey":"normal",
  "kangaskhan":"normal",
  "staryu":["water", "water", "water,psychic"],
  "scyther":"bug,flying",
  "jynx":"ice,psychic",
  "electabuzz":"electric",
  "tauros":"normal",
  "lapras":"water,ice",
  "porygon":"normal",
  "aerodactyl":"rock,flying",
  "snorlax":"normal",
};

export function pokemonTypes(id, level = 1) {
  const types = Object.hasOwn(speciesTypes, id) ? speciesTypes[id] : null;
  return (Array.isArray(types) ? types[level - 1] : types)?.split(',') ?? [];
}

// Original Let's Go type symbols, distributed by PokeAPI/sprites.
const iconTypes = [
  'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel',
  'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy',
];
export const pokemonTypeIconPaths = iconTypes.map(type => typeIconPath(type));

export function typeIconPath(type) {
  return iconTypes.includes(type) ? `/pokemon-type-icons/${type}.png` : null;
}
