const commands = {
  command: ['rusted-sword', 'Use a command move.', '发动需要指挥的招式。'],
  dodge: ['rusted-shield', 'Dodge when asked to respond.', '需要响应时打出，闪避攻击。'],
};

const tools = {
  'potion-full-heal': [['potion', 'full-heal'], 'Heal 2 HP or cure status.', '回复 2 点体力，或解除特殊状态。'],
  'potion-revive': [['potion', 'revive'], 'Heal 2 HP or revive at 2 HP.', '回复 2 点体力，或以 2 点体力复活。'],
  'rare-candy-nugget': [['rare-candy', 'nugget'], 'Raise a level or let a trainer draw 2.', '升 1 级，或令一名训练家摸 2 张牌。'],
  'defense-speed': [['x-defense', 'x-speed'], 'Give an active Pokémon Defense or Speed.', '给一只出战宝可梦防御或速度强化。'],
  'power-speed': [['x-attack', 'x-speed'], 'Give an active Pokémon Power or Speed.', '给一只出战宝可梦力量或速度强化。'],
};

const events = {
  'mewtwo-threat': ['mewtwo', 'Each other active takes 2 damage unless its trainer Dodges.', '其他出战宝可梦受到 2 点伤害，除非训练家打出快躲开。'],
  'mew-blessing': ['mew', 'Each active Pokémon heals 2 HP or gains a level.', '每只出战宝可梦回复 2 点体力或升 1 级。'],
  'rival-challenge': ['rival.svg', 'Trade commands with a rival. Last to play deals 2.', '与对手轮流打出接招吧，最后打出者造成 2 点伤害。'],
  'berry-harvest': ['oran-berry', 'Each trainer takes one card from a shared reveal.', '每名训练家从公开的牌中选取 1 张。'],
  'farfetchd-prank': ['farfetchd', 'Discard a hand card, held item or boost marker.', '弃置一张对手手牌、一件持有物或一枚强化。'],
  'moltres-trial': ['moltres', 'Each other active takes 2 damage unless its trainer plays a command.', '其他出战宝可梦受到 2 点伤害，除非训练家打出接招吧。'],
  'zapdos-punishment': ['zapdos', 'Judge for each active. Thunderstorm deals its level in damage.', '各自判定，雷雨时受到等同自身等级的伤害。'],
  'articuno-protection': ['articuno', 'React to cancel an event on one target or cure a new status.', '响应时抵消事件对一个目标的效果，或解除新状态。'],
  'jigglypuff-performance': ['jigglypuff', 'Judge. The target sleeps unless it’s a thunderstorm.', '目标判定，若不是雷雨则陷入睡眠。'],
  'mr-mime-trick': ['mr-mime', 'Take a hand card or held item from a target in range.', '从范围内的目标取得一张手牌或一件持有物。'],
};

const items = {
  'rocky-helmet': ['rocky-helmet', 'After taking damage, deal 1 back to the source.', '受到伤害后，回敬伤害来源 1 点伤害。'],
  leftovers: ['leftovers', 'The holder heals 1 HP at your turn end.', '你的回合结束时，携带者回复 1 点体力。'],
  'poison-barb': ['poison-barb', 'After taking damage, poison the source.', '受到伤害后，令伤害来源中毒。'],
  'bright-powder': ['bright-powder', 'When asked to Dodge, judge. Sunny weather counts as Dodge.', '需要快躲开时可判定，晴天视为快躲开。'],
  'kings-rock': ['kings-rock', 'Damaging moves make the target flinch.', '招式造成伤害后，令目标畏缩。'],
  'flame-orb': ['flame-orb', 'After dealing damage, judge. Sunny weather burns the target.', '造成伤害后判定，晴天令目标灼伤。'],
  'life-orb': ['life-orb', 'Add 1 damage at the cost of 1 HP after settlement.', '可令伤害加 1，结算后自身失去 1 点体力。'],
  'blunder-policy': ['blunder-policy', 'Discard 2 cards to resolve a dodged move.', '可弃 2 张手牌，使被快躲开抵消的招式生效。'],
  'muscle-band': ['muscle-band', 'Use 2 hand cards as one command.', '可将 2 张手牌当 1 张接招吧使用。'],
  'light-ball': ['light-ball', 'Discard the item during Play to paralyze a Pokémon.', '出牌时可弃置此物，使一只宝可梦麻痹。'],
  'quick-claw': ['quick-claw', 'Ignore distance. Use sunny commands at opponents’ turn start.', '无视距离，对手回合开始时可使用晴天接招吧。'],
};

const artFiles = art => [art].flat().map(name => name.endsWith('.svg') ? name : `${name}.png`);

export const playCardArtFiles = [...new Set([commands, tools, events, items]
  .flatMap(group => Object.values(group).flatMap(([art]) => artFiles(art))))];

const categoryNames = {
  command: ['Command', '指挥'],
  dodge: ['Response', '响应'],
  tool: ['Tool · choose one', '道具 · 二选一'],
  event: ['Event', '事件'],
  'held-item': ['Held item', '持有物'],
};

export function playCardFace(card, language) {
  const labels = categoryNames[card.kind];
  const face = card.kind === 'tool' ? tools[card.toolType]
    : card.kind === 'event' ? events[card.eventType]
    : card.kind === 'held-item' ? items[card.itemType]
    : commands[card.kind];
  if (!face) return {art:[], category:labels?.[language === 'zh' ? 1 : 0]};
  const [art, english, chinese] = face;
  return {art:artFiles(art), category:labels[language === 'zh' ? 1 : 0], brief:language === 'zh' ? chinese : english};
}
