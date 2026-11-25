import { expansionPokemon } from './expansion-content.js';
import { pokemonTypes } from './pokemon-types.js';

// These forms appear on the 3D board while their game cards retain their printed names.
const addedForms = {
  172: { en:'Pichu', zh:'皮丘' },
  173: { en:'Cleffa', zh:'皮宝宝' },
  212: { en:'Scizor', zh:'巨钳螳螂' },
  233: { en:'Porygon2', zh:'多边兽Ⅱ' },
  238: { en:'Smoochum', zh:'迷唇娃' },
  239: { en:'Elekid', zh:'电击怪' },
  242: { en:'Blissey', zh:'幸福蛋' },
  440: { en:'Happiny', zh:'小福蛋' },
  446: { en:'Munchlax', zh:'小卡比兽' },
  462: { en:'Magnezone', zh:'自爆磁怪' },
  464: { en:'Rhyperior', zh:'超甲狂犀' },
  466: { en:'Electivire', zh:'电击魔兽' },
  474: { en:'Porygon-Z', zh:'多边兽乙型' },
};

export const pokedexArtworkDexes = new Set([
  ...Object.keys(addedForms).map(Number),
  ...expansionPokemon.flatMap(pokemon=>pokemon.forms),
]);

export function pokedexForm(entry, level, modelForms) {
  const dex = modelForms[entry.id]?.[level.level-1] ?? level.portraitImage?.dex;
  const printed = level.portraitImage?.dex === dex ? level
    : entry.levels.find(item=>item.portraitImage?.dex === dex);
  return {
    name: addedForms[dex] ?? printed?.name ?? level.name,
    portrait: pokedexArtworkDexes.has(dex) ? `/pokemon-art/pokedex/${dex}.png`
      : printed?.portraitImage?.url ?? level.portraitImage?.url ?? entry.portraitImage?.url,
    types: dex === 212 ? ['bug','steel'] : pokemonTypes(entry.id,level.level),
  };
}
