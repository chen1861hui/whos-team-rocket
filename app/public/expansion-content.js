export const TOUR_PACK = 'kanto-johto';
export const HOENN_PACK = 'hoenn-weather';
export const MIXED_PACK = 'tour-hoenn';
export const contentPacks = ['base', TOUR_PACK, HOENN_PACK, MIXED_PACK];
export const hasPack = (selection, pack) => selection === pack ||
  (selection === MIXED_PACK && (pack === TOUR_PACK || pack === HOENN_PACK));
export const tourName = { zh: '关都与城都巡回', en: 'Kanto & Johto Tour' };
const text = (zh, en) => ({ zh, en });

export const tourTools = [
  { toolType: 'tour-medicine-power', name: text('好伤药 / 力量强化剂', 'Super Potion / X Attack'), weather: ['intense-sun', 'clear'],
    choices: [
      { effect: 'tour-heal', name: text('好伤药', 'Super Potion'), description: text('自己的存活后备回复1点。', 'Restore 1 HP to your living reserve.') },
      { effect: 'tour-power', name: text('力量强化剂', 'X Attack'), description: text('自己出战获得一枚力量强化。', 'Give your active one Power marker.') },
    ] },
  { toolType: 'tour-gear-dex', name: text('宝可装置 / 宝可梦图鉴', 'Pokégear / Pokédex'), weather: ['rain', 'thunderstorm'],
    choices: [
      { effect: 'tour-gear', name: text('宝可装置', 'Pokégear'), description: text('弃另一张手牌，摸一张。', 'Discard another hand card and draw one.') },
      { effect: 'tour-dex', name: text('宝可梦图鉴', 'Pokédex'), description: text('私看牌堆顶两张并排序。可公开所选顶牌，回合结束时通过夜间观察摸一张。', 'Privately arrange the top two cards. You may publish the chosen top card to draw one with Night Observation at turn end.') },
    ] },
  { toolType: 'tour-switch-incense', name: text('宝可梦交替 / 进化香薰', 'Switch / Evolution Incense'), weather: ['intense-sun', 'rain'],
    choices: [
      { effect: 'tour-switch', name: text('宝可梦交替', 'Switch'), description: text('消耗普通换位，成功后换下者回复1点。', 'Use your ordinary switch; heal the outgoing partner by 1 HP on success.') },
      { effect: 'tour-incense', name: text('进化香薰', 'Evolution Incense'), description: text('公开后备，结束时将本回合升级机会给它。', 'Reveal your reserve and allocate your end-turn level-up to it.') },
    ] },
  { toolType: 'tour-recycle-berry', name: text('能量回收 / 樱子果', 'Energy Retrieval / Cheri Berry'), weather: ['clear', 'thunderstorm'],
    choices: [
      { effect: 'tour-recycle', name: text('能量回收', 'Energy Retrieval'), description: text('取回一张同天气的已弃道具。', 'Retrieve a discarded tool with the same weather.') },
      { effect: 'tour-berry', name: text('樱子果', 'Cheri Berry'), description: text('解除自己出战或后备的麻痹。', 'Cure Paralysis on either of your partners.') },
    ] },
];
export const tourItems = [
  { itemType: 'tour-protect', name: text('守住招式学习器', 'Protect TM'), weather: ['intense-sun', 'clear'],
    description: text('每个训练家回合一次，防御时判定，晴天视为一次躲闪，失败可继续响应。', 'Once per global turn, judge during defense. Sunny counts as one Dodge; a failed judgment keeps defense open.') },
  { itemType: 'tour-scarf', name: text('讲究围巾', 'Choice Scarf'), weather: ['rain', 'thunderstorm'],
    description: text('指挥招式距离为2；本回合锁定首次使用的指挥招式。', 'Command moves reach distance 2. Lock to the first command move used this global turn.') },
  { itemType: 'tour-eject', name: text('脱出按键', 'Eject Button'), weather: ['intense-sun', 'rain'],
    description: text('受到招式伤害后，整张招式结束时可弃物换入自己的后备。', 'After taking move damage, discard at whole-move end to switch in your reserve.') },
  { itemType: 'tour-red-card', name: text('红牌', 'Red Card'), weather: ['clear', 'thunderstorm'],
    description: text('受到招式伤害后，整张招式结束时可弃物令原攻击者换入后备。', 'After taking move damage, discard at whole-move end to switch the original attacker to their reserve.') },
];
export const tourEvents = {
  'tour-supply': { targeting: 'single', name: text('西尔佛公司的补给', 'Silph Co. Supplies'), weather: ['intense-sun', 'clear'],
    description: text('对自己使用，摸两张。可被急冻鸟对该目标抵消。', 'Target yourself and draw two. Articuno can cancel this effect.') },
  'tour-search': { targeting: 'single', name: text('火箭队搜查', 'Rocket Search'), weather: ['rain', 'thunderstorm'],
    description: text('获得相邻其他训练家的一张随机手牌。', 'Take one random hand card from another trainer in range.') },
  'tour-clinic': { name: text('宝可梦中心的巡诊', 'Pokémon Center Rounds'), weather: ['intense-sun', 'rain'],
    description: text('从自己开始依次令每名训练家的原出战回复1点。', 'Starting with you, restore 1 HP to each original active partner.') },
  'tour-gift': { targeting: 'single', name: text('大木博士的赠礼', 'Professor Oak’s Gift'), weather: ['clear', 'thunderstorm'],
    description: text('给相邻训练家一或两张手牌，给两张则自己的原出战回复1点。', 'Give an adjacent trainer one or two cards. Giving two restores 1 HP to your original active.') },
};
export function tourCards() {
  return [
    ...tourTools.flatMap(({ choices, weather, ...card }) => weather.map(value => ({ kind: 'tool', ...card, weather: value }))),
    ...tourItems.flatMap(({ description, weather, ...card }) => weather.map(value => ({ kind: 'held-item', ...card, weather: value }))),
    ...Object.entries(tourEvents).flatMap(([eventType, { weather, targeting, description, ...card }]) =>
      weather.map(value => ({ kind: 'event', eventType, ...card, weather: value }))),
  ].map(card => ({ ...card, expansionPack: TOUR_PACK }));
}
export const hoennName = text('丰缘天气研究', 'Hoenn Weather Research');
export const mixedName = text('巡回＋天气研究', 'Tour + Weather Research');
export const labWeatherByPrint = { 'intense-sun':'sun', clear:null, rain:'rain', thunderstorm:'hail' };
export const fieldWeathers = {
  sun: { name: text('大晴天', 'Sunny Day'), itemType: 'heat-rock', icons: ['intense-sun', 'clear'], moveFamily: 'fire' },
  rain: { name: text('求雨', 'Rain Dance'), itemType: 'damp-rock', icons: ['rain', 'thunderstorm'], moveFamily: 'water' },
  hail: { name: text('冰雹', 'Hail'), itemType: 'icy-rock', icons: ['clear', 'thunderstorm'], moveFamily: 'ice' },
  sand: { name: text('沙暴', 'Sandstorm'), itemType: 'smooth-rock', icons: ['intense-sun', 'thunderstorm'], moveFamily: 'stone' },
};
export const hoennTools = [
  { toolType: 'hoenn-berry-umbrella', name: text('木子果 / 万能伞', 'Lum Berry / Utility Umbrella'),
    weather: ['intense-sun', 'clear', 'rain', 'thunderstorm'],
    choices: [
      { effect: 'hoenn-lum', name: text('木子果', 'Lum Berry'),
        description: text('解除自己一只存活后备的异常状态。', 'Cure the status of your living reserve.') },
      { effect: 'hoenn-umbrella', name: text('万能伞', 'Utility Umbrella'),
        description: text('保护自己一只搭档。在你下回合开始前，抵消它首次被气象球命中时由天气增加的 1 点伤害。', 'Protect one of your partners. Until your next turn, cancel the +1 damage from the weather on the first Weather Ball that hits it.') },
    ] },
];
export const lightClay = {
  itemType: 'light-clay', name: text('光之黏土', 'Light Clay'), weather: ['clear', 'thunderstorm'],
  description: text('携带者的防御强化实际降低伤害后，整张牌结算完可弃置此物，保留该防御强化一次，至你的下回合开始。', 'After the holder’s Defense marker reduces damage, discard this item at whole-card end to keep that marker for one more settlement, until your next turn starts.'),
};
export const coordinatedCommand = {
  kind:'command', variant:'coordinated-command', name:text('接招吧！·合力指挥','Take this! · Coordinated Command'),
  weather:['clear','thunderstorm'],
  description:text('可当普通指挥使用。发动伤害招式时，可另弃两张不同天气手牌，增加一个合法目标。','Use as a regular command. When declaring a damaging command move, you may discard two other cards of different weather for one extra legal target.'),
};
export const emergencyRetreat = {
  kind:'dodge', variant:'emergency-retreat', name:text('快躲开！·紧急撤退','Dodge! · Emergency Retreat'),
  weather:['intense-sun','clear','rain','thunderstorm'],
  description:text('打出并成功抵消一次招式结算后，可在整张招式结束时交替。成功交替占用你的下次普通交替。','Once this card cancels a move settlement, you may switch after the whole move. A successful switch uses your ordinary switch on your next turn.'),
};
export const powerHerb = {
  itemType:'power-herb', name:text('强力香草','Power Herb'), weather:['intense-sun','rain'],
  description:text('你的单目标伤害招式被完全闪避后，可弃此物和两张手牌，改为对原目标造成 1 点招式伤害。','When your damaging single-target move is fully dodged, discard this item and two hand cards to deal 1 move damage to the original target.'),
};
export const canCoordinateCommand = (move,card) => card?.kind === 'command' && card.variant === coordinatedCommand.variant &&
  move?.condition.kind === 'command' && move.printedValue > 0 && move.legalTargetIds.length > move.maxTargets;
export const hoennItems = [
  powerHerb,
  lightClay,
  { itemType: 'smooth-rock', name: text('沙沙岩石', 'Smooth Rock'), weather: ['clear', 'rain'],
    description: text('你的出战有效携带时，你打出的「沙暴」持续两轮。', 'While held by your active, your Sandstorm lasts two rounds.') },
  { itemType: 'heat-rock', name: text('炽热岩石', 'Heat Rock'), weather: ['intense-sun', 'rain'],
    description: text('你的出战携带时，你打出的「大晴天」持续两轮。', 'While held by your active, your Sunny Day lasts two rounds.') },
  { itemType: 'damp-rock', name: text('潮湿岩石', 'Damp Rock'), weather: ['clear', 'thunderstorm'],
    description: text('你的出战携带时，你打出的「求雨」持续两轮。', 'While held by your active, your Rain Dance lasts two rounds.') },
  { itemType: 'icy-rock', name: text('冰冷岩石', 'Icy Rock'), weather: ['intense-sun', 'rain'],
    description: text('你的出战携带时，你打出的「冰雹」持续两轮。', 'While held by your active, your Hail lasts two rounds.') },
];
export const hoennDelayedEvents = {
  'hoenn-raikou': { delayed: true, adjacent: true, targeting: 'single', name: text('雷公的打雷', 'Raikou’s Thunder'), weather: ['intense-sun', 'thunderstorm'],
    description: text('挂在相邻的另一名训练家席位。其下回合摸牌前判定，雷雨使当时的出战宝可梦受到 1 点事件伤害。', 'Place at an adjacent opponent or ally’s seat. Before their next draw, judge. Thunderstorm deals 1 event damage to their active Pokémon.') },
  'hoenn-roadblock': { delayed: true, targeting: 'single', name: text('卡比兽堵路', 'Snorlax Roadblock'), weather: ['clear', 'rain'],
    description: text('挂在另一名训练家席位。其下回合摸牌前判定，若结果不为晴朗，本回合发起普通交替时须额外弃一张手牌。', 'Place at another trainer’s seat. Before their next draw, judge. A result other than Clear costs them an extra hand card to attempt an ordinary switch this turn.') },
};
export const futureSightEvent = {
  response: true, name: text('沙奈朵的预知未来', 'Gardevoir’s Future Sight'),
  weather: ['intense-sun', 'clear', 'rain', 'thunderstorm'],
  description: text('日照等改判后、判定生效前打出。另弃一张与当前判定同天气的手牌，将判定牌置底，再翻一张。每次判定限成功一次。', 'After Drought and before the judgment resolves, play this and discard a different card that matches the revealed weather. Put the revealed card on the bottom and reveal a new one. Once per judgment.'),
};
export const airLockEvent = {
  response: true, name: text('烈空坐的气闸', 'Rayquaza’s Air Lock'), weather: ['intense-sun', 'rain'],
  description: text('自己的出战被天气强化的气象球命中后、伤害结算前可打出，抵消此次天气增加的 1 点伤害。', 'Play after a weather-boosted Weather Ball hits your active, before damage. Cancel its +1 weather bonus.'),
};
export const hoennEvents = {
  'hoenn-air-lock': airLockEvent,
  ...hoennDelayedEvents,
  'hoenn-future-sight': futureSightEvent,
  'hoenn-sun': { field: 'sun', targeting: 'single', name: fieldWeathers.sun.name, weather: fieldWeathers.sun.icons,
    description: text('对自己使用，设置全场大晴天一轮。可被急冻鸟抵消。', 'Target yourself to set sunny field weather for one round. Articuno can cancel it.') },
  'hoenn-rain': { field: 'rain', targeting: 'single', name: fieldWeathers.rain.name, weather: fieldWeathers.rain.icons,
    description: text('对自己使用，设置全场降雨一轮。可被急冻鸟抵消。', 'Target yourself to set rainy field weather for one round. Articuno can cancel it.') },
  'hoenn-sand': { field: 'sand', targeting: 'single', name: fieldWeathers.sand.name, weather: fieldWeathers.sand.icons,
    description: text('建立一轮沙暴。每个训练家回合结束时，岩石、地面、钢属性以外的出战搭档受 1 点伤害。以烈日或雷雨牌支付岩石或地面系伤害招式后可气象观测。', 'Set Sandstorm for one round. At each trainer’s turn end, their active takes 1 damage unless it is Rock, Ground or Steel. Damaging Rock or Ground moves paid with Intense Sun or Thunderstorm enable Weather Observation.') },
  'hoenn-hail': { field: 'hail', targeting: 'single', name: fieldWeathers.hail.name, weather: fieldWeathers.hail.icons,
    description: text('对自己使用，设置全场冰雹一轮。以晴朗或雷雨手牌发动冰系伤害招式后，可进行气象观测。可被急冻鸟抵消。', 'Set hail field weather for one round. A damaging Ice move paid with Clear or Thunderstorm enables Weather Observation. Articuno can cancel Hail.') },
};
export function expansionCards(selection) {
  const cards = hasPack(selection, TOUR_PACK) ? tourCards() : [];
  if (!hasPack(selection, HOENN_PACK)) return cards;
  return cards.concat(
    [coordinatedCommand,emergencyRetreat].flatMap(({ description, weather, ...card }) =>
      weather.map(value => ({ ...card, weather:value, expansionPack:HOENN_PACK }))),
    hoennTools.flatMap(({ choices, weather, ...card }) =>
      weather.map(value => ({ kind: 'tool', ...card, weather: value, expansionPack: HOENN_PACK }))),
    hoennItems.flatMap(({ description, weather, ...card }) =>
      weather.map(value => ({ kind: 'held-item', ...card, weather: value, expansionPack: HOENN_PACK }))),
    Object.entries(hoennEvents).flatMap(([eventType, { name, weather }]) =>
      weather.map(value => ({ kind: 'event', eventType, name, weather: value, expansionPack: HOENN_PACK }))),
  );
}
const command = { kind: 'command', count: 1, cardName: text('接招吧！', 'Take this!') };
const weather = icons => ({ kind: 'weather-card', count: 1, weatherIconsInCondition: icons });
const move = (zh, en, damage, effectKind, condition = command, targeting) => ({
  name: text(zh, en), printedValue: damage, condition, effectKind,
  effectText: text(
    ({ moonlight: '选择回复2点体力或解除状态。', 'life-dew': '每个目标回复1点。', 'u-turn': '招式结束可交替，不占普通次数。', 'tour-crunch': '伤害后目标可弃持有物免受额外1点伤害。', 'light-screen': '获得一枚防御强化。' })[effectKind] || (damage ? '依次对合法目标结算招式伤害。' : '获得对应强化。'),
    ({ moonlight: 'Choose to heal 2 HP or cure status.', 'life-dew': 'Heal each target by 1 HP.', 'u-turn': 'May switch after the move without using ordinary switching.', 'tour-crunch': 'After damage, the target may discard its item to prevent 1 extra damage.', 'light-screen': 'Gain one Defense marker.' })[effectKind] || (damage ? 'Resolve move damage on each legal target.' : 'Gain the matching reinforcement.')),
  effectStatus: 'combat-preview', ...(targeting ? { targeting } : {}),
});
export const tourPokemon = [
  { id: 'tour-eevee', forms: [133, 197, 197], names: [['伊布','Eevee'],['月亮伊布','Umbreon'],['月亮伊布','Umbreon']], hp: [3,4,5],
    traitName: text('接力', 'Relay'), trait: text('普通换位时，可把一枚速度强化交给未有该强化的换入搭档。', 'Ordinary switching transfers one Speed marker to an incoming partner without Speed.'),
    moves: level => [move('电光一闪','Quick Attack',level===1?1:2), ...(level>=2?[move('月光','Moonlight',0,'moonlight',weather(['rain','thunderstorm']),{kind:'self'})]:[])] },
  { id: 'tour-togepi', forms: [175,176,468], names: [['波克比','Togepi'],['波克基古','Togetic'],['波克基斯','Togekiss']], hp:[3,3,4],
    traitName:text('接应','Welcome'),trait:text('普通换入时，若存活后备受伤，为其回复1点。每个训练家回合一次。','Once per global turn, after switching in normally, heal your injured living reserve by 1 HP.'),
    moves:level=>[move(level===3?'空气斩':'撞击',level===3?'Air Slash':'Tackle',level===3?2:1), ...(level>=2?[move('生命水滴','Life Dew',0,'life-dew',weather(['clear','rain']),{max:2})]:[])] },
  { id:'tour-mareep',forms:[179,180,181],names:[['咩利羊','Mareep'],['茸茸羊','Flaaffy'],['电龙','Ampharos']],hp:[3,4,4],
    traitName:text('充能','Charge'),trait:text('每回合第一次弃雷雨牌发动天气招式后，获得速度强化。','Gain Speed after your first thunderstorm weather-move payment each global turn.'),
    moves:level=>[move(level===3?'放电':'电击',level===3?'Discharge':'Thunder Shock',level===1?1:2,undefined,command,{max:level===3?2:1}),move('充电','Charge',0,'light-screen',weather(['thunderstorm']),{kind:'self'})] },
  { id:'tour-treecko',forms:[252,253,254],names:[['木守宫','Treecko'],['森林蜥蜴','Grovyle'],['蜥蜴王','Sceptile']],hp:[3,4,4],
    traitName:text('茂盛','Overgrow'),trait:text('体力不高于上限一半时，招式伤害加1。','Moves deal +1 damage while at or below half HP.'),
    moves:level=>[move(level===3?'叶刃':'拍击',level===3?'Leaf Blade':'Pound',level===1?1:2), ...(level>=2?[move('急速折返','U-turn',1,'u-turn',weather(['intense-sun','clear']))]:[])] },
  { id:'tour-totodile',forms:[158,159,160],names:[['小锯鳄','Totodile'],['蓝鳄','Croconaw'],['大力鳄','Feraligatr']],hp:[3,4,5],
    traitName:text('激流','Torrent'),trait:text('体力不高于上限一半时，招式伤害加1。','Moves deal +1 damage while at or below half HP.'),
    moves:level=>[move(level===3?'咬碎':'水枪',level===3?'Crunch':'Water Gun',level===1?1:2,level===3?'tour-crunch':undefined), ...(level>=2?[move('守住','Protect',0,'self-defense',weather(['rain','thunderstorm']),{kind:'self'})]:[])] },
  { id:'tour-teddiursa',forms:[216,217,901],names:[['熊宝宝','Teddiursa'],['圈圈熊','Ursaring'],['月月熊','Ursaluna']],hp:[3,4,5],
    traitName:text('捡拾','Pickup'),trait:text('回合出牌阶段一次，可弃一张手牌回收一件同天气的已弃持有物。','Once during Play, discard a hand card to retrieve a discarded held item with the same weather.'),
    moves:level=>[move(level===3?'突飞猛扑':'劈开',level===3?'Headlong Rush':'Slash',level===3?3:level,level===3?'tour-rush':undefined)] },
];
const castform = {
  id: 'hoenn-castform', forms: [351, 351, 351], names: Array(3).fill(['飘浮泡泡', 'Castform']), hp: [3, 4, 4],
  traitName: text('阴晴不定', 'Forecast'),
  trait: text('大晴天、降雨和冰雹使飘浮泡泡换形。沙暴中它保持普通形态，气象球变为岩石系。', 'Sun, rain and hail change Castform’s form. In sand, Castform stays normal and Weather Ball becomes Rock-type.'),
  moves: level => [
    move('撞击', 'Tackle', level === 1 ? 1 : 2),
    { ...move('气象球', 'Weather Ball', 1, 'hoenn-weather-ball', weather([...fieldWeathers.sun.icons, ...fieldWeathers.rain.icons])),
      effectText: text('无适用天气时造成1点伤害。场上天气使气象球改为对应属性，支付对应天气牌并造成2点伤害。', 'Deal 1 damage with no applicable weather. Field weather changes the move’s type, requires matching payment and raises its damage to 2.') },
  ],
};
const ralts = {
  id: 'hoenn-ralts', forms: [280, 281, 282],
  names: [['拉鲁拉丝','Ralts'], ['奇鲁莉安','Kirlia'], ['沙奈朵','Gardevoir']], hp: [3,4,5],
  traitName: text('同步','Synchronize'),
  trait: text('出战时因实体指挥或事件牌受到伤害后，可取得结算中的那张牌。', 'After taking damage while active, you may take the physical command or event card that caused it.'),
  moves: level => [
    level === 3 ? move('精神强念','Psychic',2) : move('念力','Confusion',level),
    ...(level >= 2 ? [move('光墙','Light Screen',0,'light-screen',weather(['intense-sun','clear']),{kind:'self'})] : []),
  ],
};
const absol = {
  id: 'hoenn-absol', forms: [359, 359, 359], names: Array(3).fill(['阿勃梭鲁', 'Absol']), hp: [3, 4, 4],
  traitName: text('灾祸预感', 'Disaster Sense'),
  traitByLevel: [
    text('自己的出牌阶段限一次，私下查看牌堆顶一张牌的印刷天气。',
      'Once during your Play phase, privately check the printed weather of the top card.'),
    text('自己的出牌阶段限一次，私下查看牌堆顶一张牌的印刷天气。你可将该牌置于牌堆底。',
      'Once during your Play phase, privately check the printed weather of the top card. You may put that card on the bottom of the deck.'),
    text('自己的出牌阶段限一次，私下查看牌堆顶一张牌的印刷天气。你可将该牌置底。若保留雷雨牌且尚无速度强化，获得一枚速度强化。',
      'Once during your Play phase, privately check the printed weather of the top card. You may put it on the bottom. If you keep a Thunderstorm card on top and have no Speed marker, gain one.'),
  ],
  moves: level => [
    level === 3 ? move('暗袭要害', 'Night Slash', 2) : move('劈开', 'Slash', level),
    ...(level >= 2 ? [{
      ...move('剑舞', 'Swords Dance', 0, 'swords-dance', weather(['intense-sun', 'clear']), {kind:'self'}),
      effectText: text('获得一枚力量强化，可叠加。', 'Gain one Power marker. It may stack.'),
    }] : []),
  ],
};
export const counterMoves = {
  command: {name:text('双倍奉还','Counter'),weather:['intense-sun','clear']},
  weather: {name:text('镜面反射','Mirror Coat'),weather:['rain','thunderstorm']},
};
const wobbuffet = {
  id:'hoenn-wobbuffet', forms:[360,202,202], names:[['小果然','Wynaut'],['果然翁','Wobbuffet'],['果然翁','Wobbuffet']], hp:[3,4,5],
  traitName:text('蓄势反击','Ready to Counter'),
  traitByLevel: [
    text('受到其他出场搭档的指挥招式伤害，且双方仍留场时，可弃一张烈日或晴朗手牌发动双倍奉还，对原招式来源造成 1 点基础伤害。每个训练家回合限成功反击一次。',
      'After taking damage from another active Pokémon’s command move, if both Pokémon stay in battle, discard one Intense Sun or Clear card to use Counter against the original attacker for 1 base damage. One successful counter per trainer turn.'),
    text('受到其他出场搭档的招式伤害，且双方仍留场时，可以反击。受指挥招式伤害，弃一张烈日或晴朗手牌发动双倍奉还。受天气招式伤害，弃一张暴雨或雷雨手牌发动镜面反射。两种反击都对原招式来源造成 1 点基础伤害，共享每个训练家回合限成功反击一次的限制。',
      'After taking move damage from another active Pokémon, if both Pokémon stay in battle, you may strike back. Discard one Intense Sun or Clear card to use Counter after a command move, or one Rain or Thunderstorm card to use Mirror Coat after a weather move. Either deals 1 base damage to the original attacker. The two responses share one successful counter per trainer turn.'),
    text('受到其他出场搭档的招式伤害，且双方仍留场时，可以反击。受指挥招式伤害，弃一张烈日或晴朗手牌发动双倍奉还。受天气招式伤害，弃一张暴雨或雷雨手牌发动镜面反射。反击对原招式来源造成等同于本次实际所受伤害的基础伤害，最多 2 点。两种反击共享每个训练家回合限成功反击一次的限制。',
      'After taking move damage from another active Pokémon, if both Pokémon stay in battle, you may strike back. Discard one Intense Sun or Clear card to use Counter after a command move, or one Rain or Thunderstorm card to use Mirror Coat after a weather move. The base damage to the original attacker equals the actual damage taken, up to 2. The two responses share one successful counter per trainer turn.'),
  ],
  moves:level=>[
    move('挣扎','Struggle',level===1?1:2),
    ...(level>=2?[{
      ...move('神秘守护','Safeguard',0,'self-defense',weather(['intense-sun','clear']),{kind:'self'}),
      effectText:text('获得一枚防御强化。','Gain one Defense marker.'),
    }]:[]),
  ],
};
export const SHEDINJA_ID = 'hoenn-shedinja';
const nincada = {
  id:'hoenn-nincada', forms:[290,290,291], names:[['土居忍士','Nincada'],['土居忍士','Nincada'],['铁面忍者','Ninjask']], hp:[3,4,5],
  evolutionByLevel: [
    text('在 3 级进化为铁面忍者或脱壳忍者。', 'Evolves into Ninjask or Shedinja at Lv. 3.'),
    text('升到 3 级时进化为铁面忍者。满体力时，在自己的回合结束选择升到 3 级，也可进化为脱壳忍者。',
      'Evolves into Ninjask at Lv. 3. If at full HP when levelling up at the end of your own turn, you may choose Shedinja instead.'),
  ],
  moves:level=>level<3 ? [move('抓','Scratch',1)] : [
    move('十字剪','X-Scissor',2,'x-scissor'),
    move('急速折返','U-turn',2,'u-turn'),
  ],
};
const shedinja = {
  id:SHEDINJA_ID, forms:[292,292,292], names:Array(3).fill(['脱壳忍者','Shedinja']), hp:[1,1,1], selectionEligible:false,
  traitName:text('神奇守护','Wonder Guard'),
  trait:text('免疫火、飞行、岩石、幽灵和恶属性之外的伤害招式。事件、天气和异常的伤害照常结算。','Prevents damage from moves other than Fire, Flying, Rock, Ghost and Dark. Damage from events, weather and statuses resolves normally.'),
  moves:()=>[move('影子偷袭','Shadow Sneak',1)],
};
const illusion = text('登场时伪装成存活的后备，至出招、受伤、换出或特性被压制。',
  'On entry, disguise as a living reserve until using a move, taking damage, switching out or losing the ability.');
const illusionWithDecoy = text(
  `${illusion.zh}自己出牌时，若仍处于伪装且尚未标记手牌，可私下标记一张非指挥手牌，用它支付一次伤害指挥招式的费用。`,
  `${illusion.en} During your Play phase, while disguised and with no card marked, privately mark one non-command card to pay for one damaging command move.`);
const zorua = {
  id:'hoenn-zorua', forms:[570,571,571], names:[['索罗亚','Zorua'],['索罗亚克','Zoroark'],['索罗亚克','Zoroark']], hp:[3,4,4],
  traitName:text('幻觉','Illusion'),
  traitByLevel:[illusion,illusionWithDecoy,illusionWithDecoy],
  moves:level=>[
    level===1?move('抓','Scratch',1):move('暗袭要害','Night Slash',2),
    ...(level===3?[move('暗黑爆破','Night Daze',2)]:[]),
  ],
};
export const MIMIKYU_ID = 'hoenn-mimikyu';
export const mimikyuModelDexes = [778, '778-busted'];
const disguise = text('挡下第一次会造成伤害的对手招式和这次伤害的附带效果，随后变为现形。',
  'Blocks the first opposing move that would deal damage and its on-damage effects, then changes to Busted Form.');
const mimikyu = {
  id: MIMIKYU_ID, pack: HOENN_PACK, forms: [778,778,778], names: Array(3).fill(['谜拟丘','Mimikyu']), hp: [3,4,4],
  traitName: text('画皮','Disguise'),
  traitByLevel: [
    disguise,
    disguise,
    text(`${disguise.zh}若画皮仍完好且自己尚无力量强化，也可在自己的出牌阶段主动消耗画皮，获得一枚力量强化。`,
      `${disguise.en} During your Play phase, if the disguise is intact and you have no Power marker, you may spend it to gain one.`),
  ],
  moves: level => [
    level === 1 ? move('影子偷袭','Shadow Sneak',1) : move('暗影爪','Shadow Claw',2),
    ...(level === 3 ? [move('嬉闹','Play Rough',2)] : []),
  ],
};
export function expansionBattleFormDex(pokemon) {
  if (pokemon?.catalogueId === 'hoenn-castform' && pokemon.fieldForm) return `351-${pokemon.fieldForm}`;
  if (pokemon?.catalogueId === MIMIKYU_ID && pokemon.fieldForm === 'busted') return mimikyuModelDexes[1];
}
export const expansionPokemon = [
  ...tourPokemon.map(pokemon => ({ ...pokemon, pack: TOUR_PACK })),
  { ...castform, pack: HOENN_PACK },
  { ...ralts, pack: HOENN_PACK },
  { ...absol, pack: HOENN_PACK },
  { ...wobbuffet, pack: HOENN_PACK },
  { ...nincada, pack: HOENN_PACK },
  { ...shedinja, pack: HOENN_PACK },
  { ...zorua, pack: HOENN_PACK },
  mimikyu,
];
export function expansionCatalogue(catalogue) {
  const ids = new Set(catalogue.entries.map(entry => entry.id));
  const entries = expansionPokemon.filter(pokemon => !ids.has(pokemon.id) &&
    (pokemon.id !== MIMIKYU_ID || catalogue.mimikyuAvailable === true)).map(pokemon => ({
    id: pokemon.id, name: text(...pokemon.names[0]), expansionPack: pokemon.pack, selectionEligible: pokemon.selectionEligible !== false,
    evidenceStatus: 'homebrew', effectStatus: 'combat-preview',
    levels: pokemon.names.map((name, index) => ({
      level: index + 1, name: text(...name), hp: pokemon.hp[index], hpStatus: 'homebrew',
      effectStatus: 'combat-preview', evidenceStatus: 'homebrew', traitName: pokemon.traitName,
      abilityText: pokemon.traitByLevel?.[index] ?? pokemon.trait, moves: pokemon.moves(index + 1),
      ...(pokemon.evolutionByLevel?.[index] ? {evolutionText:pokemon.evolutionByLevel[index]} : {}),
      portraitImage: { url: '/pokemon-art/tour/' + pokemon.forms[index] + '.png', dex: pokemon.forms[index] },
    })),
    portraitImage: { url: '/pokemon-art/tour/' + pokemon.forms[0] + '.png' },
  }));
  return { ...catalogue, entries: [...catalogue.entries, ...entries] };
}
export const showdownWeatherRank = { clear: 1, 'intense-sun': 2, rain: 3, thunderstorm: 4 };
export const tourActionNames = {
  showdown: text('训练家对视', 'Trainer Showdown'),
  'follow-me': text('看我嘛', 'Follow Me'),
  'publish-survey': text('公开图鉴调查', 'Publish Pokédex Survey'),
  'radio-contact': text('广播塔联络', 'Radio Contact'),
  'viridian-investigate': text('公开查验', 'Public Investigation'),
  'all-out': text('拼尽全力', 'Go All Out'),
  prepare: text('训练家备战', 'Prepare'),
  observe: text('气象观测', 'Weather Observation'),
  forecast: absol.traitName,
  'illusion-decoy': text('私藏诱饵','Mark a Decoy'),
  'shed-disguise': text('主动解除画皮','Shed Disguise'),
  train: text('培育后备', 'Train Reserve'),
  handoff: text('戏法交接', 'Trick Handoff'),
  pickup: text('捡拾', 'Pickup'),
};
