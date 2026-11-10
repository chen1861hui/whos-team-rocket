import { randomUUID } from 'node:crypto';
import { retailCounts, retailWeathers } from './retail-deck-counts.js';

export const BASIC_DECK = 'basic';
export const REVIEWED_DECK = 'reviewed';
export const RETAIL_DECK = 'retail';
export const isDeckProfile = profile => [BASIC_DECK, REVIEWED_DECK, RETAIL_DECK].includes(profile);

const basicWeather = Array(6).fill('intense-sun');
const reviewedCommandWeather = ['intense-sun', 'intense-sun', 'intense-sun', 'clear', 'clear', 'rain', 'rain', 'thunderstorm'];
const reviewedDodgeWeather = ['intense-sun', 'intense-sun', 'clear', 'clear', 'rain', 'thunderstorm'];
const toolPairs = [
  { toolType: 'potion-full-heal', name: { zh: '伤药 / 万灵药', en: 'Potion / Full Heal' }, weather: ['clear', 'intense-sun'] },
  { toolType: 'potion-revive', name: { zh: '伤药 / 活力碎片', en: 'Potion / Revive' }, weather: ['clear', 'clear'] },
  { toolType: 'rare-candy-nugget', name: { zh: '神奇糖果 / 金珠', en: 'Rare Candy / Nugget' }, weather: ['clear', 'clear'] },
  { toolType: 'defense-speed', name: { zh: '防御强化 / 速度强化', en: 'Defense Boost / Speed Boost' }, weather: ['rain', 'rain'] },
  { toolType: 'power-speed', name: { zh: '力量强化 / 速度强化', en: 'Power Boost / Speed Boost' }, weather: ['clear', 'rain'] },
];
const eventTypes = ['mewtwo-threat', 'mew-blessing', 'rival-challenge', 'berry-harvest', 'farfetchd-prank',
  'moltres-trial', 'zapdos-punishment', 'articuno-protection', 'jigglypuff-performance', 'mr-mime-trick'];
const itemTypes = ['rocky-helmet', 'leftovers', 'poison-barb', 'bright-powder', 'kings-rock', 'flame-orb',
  'life-orb', 'blunder-policy', 'muscle-band', 'light-ball', 'quick-claw'];
const names = { command: { zh: '接招吧！', en: 'Take this!' }, dodge: { zh: '快躲开！', en: 'Dodge!' } };

function countedWeather(key) {
  return retailWeathers.flatMap((weather, index) => Array(retailCounts[key][index]).fill(weather));
}

export function playtestDeckPlan(profile, seats, catalogue) {
  if (!isDeckProfile(profile)) return null;
  const retail = profile === RETAIL_DECK;
  const reviewed = profile !== BASIC_DECK;
  const commands = retail ? countedWeather('command') : reviewed ? reviewedCommandWeather : basicWeather;
  const dodges = retail ? countedWeather('dodge') : reviewed ? reviewedDodgeWeather : basicWeather;
  const commandAndDodge = [...commands.map(weather => ({ kind: 'command', weather, name: names.command })),
    ...dodges.map(weather => ({ kind: 'dodge', weather, name: names.dodge }))];
  const extras = [];
  if (reviewed) {
    for (const { toolType, name, weather } of toolPairs) {
      for (const variant of retail ? countedWeather(toolType) : weather) extras.push({ kind: 'tool', toolType, name, weather: variant });
    }
    for (const eventType of eventTypes) {
      const entry = catalogue.playCardPreviews?.find(card => card.eventType === eventType && card.effectStatus === 'combat-preview');
      if (!entry?.name?.en || !entry.name.zh || (!retail && !entry.observedWeather?.[0])) return null;
      for (const weather of retail ? countedWeather(eventType) : [entry.observedWeather[0]]) {
        extras.push({ kind: 'event', eventType, name: entry.name, weather });
      }
    }
    for (const itemType of itemTypes) {
      const entry = catalogue.heldItems?.find(card => card.id === itemType && card.effectStatus === 'combat-preview');
      if (!entry?.name?.en || !entry.name.zh || (!retail && !entry.weather)) return null;
      for (const weather of retail ? countedWeather(itemType) : [entry.weather]) {
        extras.push({ kind: 'held-item', itemType, name: entry.name, weather });
      }
    }
  }
  const cards = [...(retail ? commandAndDodge : Array.from({ length: seats }, () => commandAndDodge).flat()), ...extras];
  return {
    cards,
    summary: {
      deckProfile: profile,
      ...(retail ? {} : { cardsPerSeat: commandAndDodge.length, commandPerSeat: commands.length, dodgePerSeat: dodges.length }),
      deckCardCount: cards.length, extraCardCount: extras.length,
      articunoReactions: extras.some(card => card.eventType === 'articuno-protection'),
    },
  };
}

export function makePlaytestCards(plan) {
  return plan.cards.map(({ name, ...fields }) => ({ id: randomUUID(), ...fields, name: { ...name }, fixture: plan.summary.deckProfile !== RETAIL_DECK }));
}
