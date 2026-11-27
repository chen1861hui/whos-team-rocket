import { fieldWeathers } from './expansion-content.js';

// Standard species types from PokéAPI.
const speciesTypes = {
  'hoenn-castform':'normal',
  'hoenn-ralts':'psychic,fairy',
  'hoenn-absol':'dark',
  'hoenn-wobbuffet':'psychic',
  'hoenn-nincada':['bug,ground','bug,ground','bug,flying'],
  'hoenn-shedinja':'bug,ghost',
  'hoenn-zorua':'dark',
  'hoenn-mimikyu':'ghost,fairy',
  'tour-eevee':['normal','dark','dark'], 'tour-togepi':['fairy','fairy,flying','fairy,flying'],
  'tour-mareep':'electric', 'tour-treecko':'grass', 'tour-totodile':'water', 'tour-teddiursa':['normal','normal','ground,normal'],
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

export function pokemonTypes(id, level = 1, fieldForm) {
  if (id === 'hoenn-castform' && fieldForm !== 'sand' && fieldWeathers[fieldForm]) return [fieldWeathers[fieldForm].moveFamily];
  const types = Object.hasOwn(speciesTypes, id) ? speciesTypes[id] : null;
  return (Array.isArray(types) ? types[level - 1] : types)?.split(',') ?? [];
}

export function sandstormAffects({ catalogueId, level }) {
  return !pokemonTypes(catalogueId, level).some(type => type === 'rock' || type === 'ground' || type === 'steel');
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
