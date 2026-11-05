import { randomUUID } from 'node:crypto';

export const BASIC_DECK = 'basic';
export const REVIEWED_DECK = 'reviewed';
export const isDeckProfile = profile => profile === BASIC_DECK || profile === REVIEWED_DECK;

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

// Quantities are for the optional playtest. The retail catalogue has its own gates.
export function playtestDeckPlan(profile, seats, catalogue) {
  if (!isDeckProfile(profile)) return null;
  const reviewed = profile === REVIEWED_DECK;
  const commands = reviewed ? reviewedCommandWeather : basicWeather;
  const dodges = reviewed ? reviewedDodgeWeather : basicWeather;
  const perSeat = [...commands.map(weather => ({ kind: 'command', weather, name: names.command })),
    ...dodges.map(weather => ({ kind: 'dodge', weather, name: names.dodge }))];
  const extras = [];
  if (reviewed) {
    for (const { toolType, name, weather } of toolPairs) {
      for (const variant of weather) extras.push({ kind: 'tool', toolType, name, weather: variant });
    }
    for (const eventType of eventTypes) {
      const entry = catalogue.playCardPreviews?.find(card => card.eventType === eventType && card.effectStatus === 'combat-preview');
      if (!entry?.observedWeather?.[0] || !entry.name?.en || !entry.name?.zh) return null;
      extras.push({ kind: 'event', eventType, name: entry.name, weather: entry.observedWeather[0] });
    }
    for (const itemType of itemTypes) {
      const entry = catalogue.heldItems?.find(card => card.id === itemType && card.effectStatus === 'combat-preview');
      if (!entry?.weather || !entry.name?.en || !entry.name?.zh) return null;
      extras.push({ kind: 'held-item', itemType, name: entry.name, weather: entry.weather });
    }
  }
  return {
    cards: [...Array.from({ length: seats }, () => perSeat).flat(), ...extras],
    summary: {
      deckProfile: profile, cardsPerSeat: perSeat.length, commandPerSeat: commands.length, dodgePerSeat: dodges.length,
      deckCardCount: seats * perSeat.length + extras.length, extraCardCount: extras.length,
      articunoReactions: extras.some(card => card.eventType === 'articuno-protection'),
    },
  };
}

export function makePlaytestCards(plan) {
  return plan.cards.map(({ name, ...fields }) => ({ id: randomUUID(), ...fields, name: { ...name }, fixture: true }));
}
