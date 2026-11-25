const text = (zh,en) => ({zh,en});

export const trainerProfessions = {
  joy: {
    name:text('乔伊','Nurse Joy'),
    rule:text('每局一次。自己响应救援时，弃一件己方宝可梦已公开的持有物，为昏厥目标回复 1 点体力。遵守本次救援的限制。',
      'Once per match, while responding to rescue, discard one of your Pokémon’s public held items to restore 1 HP to the fainting target. Follow the current rescue restrictions.'),
  },
  brock: {
    name:text('小刚','Brock'),
    action:text('照料后备','Care for Reserve'),
    rule:text('本回合成功进行普通交替后，结束阶段可为仍存活且受伤的后备回复 1 点体力。自己的回合限一次。',
      'After succeeding at an ordinary switch this turn, you may restore 1 HP to your living, injured reserve in the End phase. Once on your turn.'),
  },
  oak: {
    name:text('大木博士','Professor Oak'),
    action:text('图鉴登记','Pokédex Registration'),
    rule:text('每局一次。出牌阶段公开登记自己的存活后备，私下看牌堆顶至多两张，可交换两张牌的顺序。放弃排序时维持原顺序。',
      'Once per match during Play, publicly register your living reserve, then privately inspect up to two top cards. You may swap their order or leave them as they are.'),
  },
  disguise: {
    name:text('乔装火箭队员','Disguised Rocket Grunt'),
    action:text('暗号交换','Trade by Password'),
    rule:text('每局一次。出牌阶段向有手牌的相邻训练家公开一张自己手牌的天气。对方可选一张同天气手牌与之交换，或拒绝。交换的牌面保持私密。',
      'Once per match during Play, offer a hand card to a neighbor with cards. Reveal its weather only. They may trade a matching-weather hand card or decline. Card faces stay private.'),
  },
  bugcatcher: {
    name:text('捕虫少年','Bug Catcher'),
    action:text('捕虫大会奖品','Bug-Catching Prize'),
    rule:text('每局一次，自己的虫系搭档登场时，可从弃牌堆取一张道具。道具天气须与该搭档的招式费用匹配。仅有指挥招式时，改为匹配自己手中的一张指挥牌天气。',
      'Once per match when your Bug-type partner enters, you may take a discarded Item whose weather appears in its move costs. If it only has command moves, match the weather of a command card in your hand.'),
  },
  birdkeeper: {
    name:text('驯鸟师','Bird Keeper'),
    action:text('驯鸟补给','Bird Keeper’s Supply'),
    rule:text('每局一次。成功普通交替后，可在当回合出牌阶段摸一张。换入的搭档仍在出战且具有飞行属性时，也可改让一名相邻训练家摸。',
      'Once per match during Play after a successful ordinary switch, draw one card. If the switched-in partner is still active and Flying-type, you may let a neighbor draw instead.'),
  },
  researcher: {
    name:text('丰缘气象研究员','Hoenn Weather Researcher'),
    action:text('预报修订','Forecast Revision'),
    rule:text('每轮第一次由自己进行判定时，若至少有两张牌可供翻判且自己有手牌，可在翻牌前私看顶牌天气。弃一张手牌可将顶牌置底，然后照常翻判。放弃则照常翻判。',
      'Before your first judgment each round, if two cards are available and you have a hand card, privately check the top card’s weather. Discard a hand card to put the top card on the bottom, or pass to flip as usual.'),
  },
  looker: {
    name:text('国际警察「帅哥」','International Police Looker'),
    action:text('现场问询','Field Inquiry'),
    rule:text('每局一次。出牌阶段询问一名相邻训练家，由对方选择公开一张自己手牌的天气，或说明存活后备是否有持有物。超时默认回答后备是否有持有物。',
      'Once per match during Play, question a neighbor. They reveal the weather of one hand card or say whether their living reserve has a held item. On timeout they answer about the item.'),
  },
};
export const trainerProfessionIds = Object.keys(trainerProfessions);
