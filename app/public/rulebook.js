import { trainerProfessionIds, trainerProfessions } from './trainer-professions.js';
import { expansionCards, hasPack, HOENN_PACK, MIXED_PACK, TOUR_PACK, hoennName, mixedName, tourName } from './expansion-content.js';
import {
  IDENTITY_CAPACITY, RADIO_GOAL, RADIO_TOWER, LAKE_RAGE, SILPH_CONTROL, isLakeRaid, isSilphControl, ROOM_CAPACITY, VIRIDIAN_GYM, VIRIDIAN_MAX, viridianMinimum,
  VIRIDIAN_REVEAL_ROUND, INFILTRATOR_ROUND,
} from './match-mode.js';

const text = (en, zh) => ({en, zh});
const packNames = {
  base:text('Original','原版'),
  [TOUR_PACK]:tourName,
  [HOENN_PACK]:hoennName,
  [MIXED_PACK]:mixedName,
};

const phases = [
  [text('Draw','摸牌'),text('Resolve turn-start effects, then draw two cards. Use the deck if automatic drawing is off.','先结算回合开始效果，再摸两张牌。关闭自动摸牌时，点击牌堆。')],
  [text('Play','出牌'),text('Use moves, play cards, or make one ordinary switch. Follow the printed costs, target limits and timing.','使用招式、打出卡牌，或普通交替一次。费用、目标范围和时机以牌面为准。')],
  [text('Discard','弃牌'),text('Normally discard down to four hand cards.','通常将手牌弃至四张以内。')],
  [text('End','结束'),text('You may raise your active partner by one level, up to level 3. Effects that let the reserve level up share this chance.','可让出战搭档升一级，最高 3 级。允许后备升级的效果共用这次机会。')],
];

const identityVictory = [
  [text('Gym side','道馆阵营'),text('Win if the Gym Leader survives and all Challengers and Rocket members are eliminated.','馆主仍在场，且挑战者与火箭队成员全部退场时，道馆阵营获胜。')],
  [text('Challengers','挑战者'),text('Win when the Gym Leader is eliminated, unless a Rocket member is the sole survivor.','馆主退场时，挑战者获胜。若火箭队成员是唯一留场者，则由火箭队获胜。')],
  [text('Team Rocket','火箭队'),text('Win if the Gym Leader is eliminated and the Rocket member is the sole survivor.','馆主退场且火箭队成员是唯一留场者时，火箭队获胜。')],
];

const radioRules = {
  id:'radio',title:text('Radio Contact','广播塔联络'),copy:text(
    'Once during your play phase, select two hand cards with different printed weather. Discard both together to give your team one intelligence point. You can pass before paying, and both teams can see the scores.',
    '自己出牌阶段限一次。选两张印刷天气不同的手牌，一起弃置，为本队获得 1 情报点。确认付款前可以放弃，两队比分公开。'),
};

const investigation = [text('Public Investigation','公开查验'),text(
  'Before the true Leader is revealed, each trainer can investigate once per match during play. Choose another living, unrevealed trainer who has not been investigated, then discard one card to report to the table whether they are a Challenger. Passing before payment keeps the card and the opportunity.',
  '真馆主亮牌前，每位训练家在出牌阶段每局可成功查验一次。选一名仍在场、尚未亮牌且未被查验的其他训练家，再弃一张手牌，向全桌公开目标是否为挑战者。付款前放弃可保留手牌和机会。')];

const guardRule = [text('Gym Guard','道馆护卫'),text(
  'The guard is public from setup. With two Gym Trainers, the other Gym Trainer becomes the guard. With one, the Acting Gym Leader also serves as guard. After the true Leader is revealed, the guard can take one damaging single-target move per match if still a legal target. They defend and take damage normally. Accepting spends the use without discarding a card; passing leaves it available.',
  '护卫开局公开。有两名道馆训练家时，由代理馆主以外的一人担任；只有一名时由代理馆主兼任。真馆主亮牌后，若护卫本身符合招式的目标限制，每局可替真馆主承接一次造成伤害的单目标招式，并照常防御和受伤。接受消耗次数，无需弃牌。放弃保留机会。')];

const rocketPair = [text('Jessie and James','武藏与小次郎'),text(
  'Replace one Challenger with a second Rocket member. Jessie and James are randomly assigned and privately know each other from setup. Everyone chooses Pokémon normally. Their identities and aliases remain private until revealed.',
  '用第二名火箭队成员替换一名挑战者。武藏与小次郎随机分配，开局私下互认。每人照常选择宝可梦。两人的身份与代号在亮牌前保密。')];

const rocketPairVictory = [
  identityVictory[0],
  [text('Challengers','挑战者'),text(
    'Win when the true Gym Leader is eliminated unless all remaining trainers belong to Team Rocket.',
    '真馆主退场时，若仍有非火箭队训练家留场，挑战者获胜。')],
  [text('Jessie and James','武藏与小次郎'),text(
    'Win together if the true Gym Leader is eliminated and only Rocket members are still in play. Both partners win even if one has been eliminated.',
    '真馆主退场且场上仅剩火箭队成员时，武藏与小次郎共同获胜。即使其中一人已退场，也共享胜利。')],
];

const infiltratorRule = [text('Rocket Infiltrator','火箭队潜伏者'),text(
  `One Challenger is replaced by an independent infiltrator. If still in play at the start of round ${INFILTRATOR_ROUND}, you must publicly stay independent or join Team Rocket before the first draw. Resolve any forecast first. The choice is final. A response timeout keeps you independent.`,
  `一名挑战者改为独立潜伏者。若第 ${INFILTRATOR_ROUND} 轮开始时仍在场，须在首位训练家摸牌前公开选择保持独立或加入火箭队。启用天气研究所时先结算预报。阵营选择不可更改，响应超时默认独立。`)];

const infiltratorVictory = [
  [text('Gym side','道馆阵营'),text(
    'Win if the true Gym Leader survives and every opposing trainer has been eliminated.',
    '真馆主仍在场且所有敌对训练家退场时，道馆阵营获胜。')],
  [text('Independent infiltrator','独立潜伏者'),text(
    'Win alone if the true Gym Leader is eliminated and you are the sole survivor.',
    '真馆主退场且独立潜伏者是唯一留场者时，由潜伏者独自获胜。')],
  [text('Team Rocket','火箭队'),text(
    'Win if the true Gym Leader is eliminated and only Team Rocket survives. All Rocket members share the result, including anyone who joined and anyone already eliminated.',
    '真馆主退场且场上只剩火箭队时，全体火箭队成员共享胜利，包括已加入的潜伏者及已退场的队员。')],
  [text('Challengers','挑战者'),text(
    'Win when the true Gym Leader is eliminated and neither of the other victory conditions for their defeat is met.',
    '真馆主退场，若独立潜伏者与火箭队均未达成各自的胜利条件，则挑战者获胜。')],
];

const forecast = {
  id:'weather',title:text('Weather Institute','丰缘天气研究所'),
  copy:text(
    'Before the first trainer draws each round, the table makes a judgment. Use the deck to reveal it if automatic judgments are off. The final printed weather sets the forecast. A played weather event takes priority for its normal duration, including any rock extension. The current round’s forecast resumes afterward.',
    '每轮首位训练家摸牌前，全桌作一次判定。关闭自动翻判时由首位训练家点击牌堆。以最终牌面的印刷天气决定预报。主动打出的天气事件优先，按原持续时间和天气岩石结算，到期后恢复本轮预报。'),
  steps:[
    [text('Intense sun','烈日'),text('Set harsh sunlight.','场上变为大晴天。')],
    [text('Heavy rain','暴雨'),text('Set rain.','场上变为求雨。')],
    [text('Thunderstorm','雷雨'),text('Set hail.','场上变为冰雹。')],
    [text('Clear or no card','晴朗或无判定牌'),text('The forecast adds no field weather. Sandstorm can be played as an event.','本轮预报维持常态。沙暴可通过事件打出。')],
  ],
};

export function buildRulebook(settings = {}, context = {}) {
  const teams = settings.matchMode === 'teams';
  const radio = teams && settings.teamScenario === RADIO_TOWER;
  const lake=isLakeRaid(settings), silph=isSilphControl(settings);
  const viridian = !teams && settings.identityScenario === VIRIDIAN_GYM;
  const infiltration = viridian && settings.rocketInfiltration;
  const minimum = viridianMinimum(settings);
  const duel = !teams && !viridian && context.practiceDuel;
  const mode = lake ? LAKE_RAGE : silph ? SILPH_CONTROL : radio ? RADIO_TOWER : teams ? 'teams' : viridian ? VIRIDIAN_GYM : duel ? 'practice-duel' : 'identity';
  const modeName = {
    [LAKE_RAGE]:text('Lake of Rage · Red Gyarados','愤怒之湖·红色暴鲤龙'),
    [SILPH_CONTROL]:text('Silph Co. · Master Ball','西尔佛公司·大师球争夺'),
    [RADIO_TOWER]:text('Goldenrod Radio Tower','满金市广播塔争夺战'),
    [VIRIDIAN_GYM]:text('Viridian Gym · Who’s the Gym Leader?','常磐道馆·谁是真馆主'),
    teams:text('Team battle','组队对战'),
    'practice-duel':text('Practice duel','练习对决'),
    identity:text('Classic identity','原版身份局'),
  }[mode];
  const pack = settings.contentPack;
  const perDeck = 108 + expansionCards(pack).length;
  const copies = teams ? Math.max(1,Math.ceil((context.seatCount ?? 0)*5/perDeck)) : 1;
  const cards = context.deckCardCount ?? perDeck*copies;

  let setup = text(
    `Start with 3–${IDENTITY_CAPACITY} ready trainers, including AI. Confirm identities. The Gym Leader’s role becomes public when confirmed. The Leader takes the first turn; play then follows seat order.`,
    `3–${IDENTITY_CAPACITY} 位训练家全部准备后开局，可加入 AI。所有人确认身份，馆主确认时公开身份。馆主先行动，之后依座次进行。`);
  let openingPartners = text(
    'The Gym Leader starts with a level 2 active partner. In matches of five or more, both of the Leader’s partners gain 1 maximum HP. All other partners start at level 1.',
    '馆主的出战从 2 级开始。五人及以上时，馆主两只搭档的体力上限各加 1。其余搭档从 1 级开始。');
  if (lake) {
    setup=text('Seat 2–6 challengers, including AI. The game adds one Red Gyarados boss. A challenger goes first, then play follows the turn order.',
      '2–6 位挑战者全部准备后开局，可加入 AI。系统额外加入红色暴鲤龙首领。由一名挑战者先行动，再依顺序进行。');
    openingPartners=text('Challengers start at level 1. Red Gyarados starts at level 2 and has a second health bar.',
      '挑战者搭档从 1 级开始。红色暴鲤龙以 2 级登场，拥有两段体力。');
  } else if (silph) {
    setup=text('Seat 6 or 12 trainers, including AI, in three equal public teams. Assign by repeating A, B, C in seat order or by random draw.',
      '6 或 12 位训练家全部准备后开局，可加入 AI。按座位轮流分入 A、B、C 三队，也可随机平均分队。');
    openingPartners=text('All partners start at level 1. Different trainers may draw the same candidate at a large table.',
      '所有搭档从 1 级开始。大型对局中，不同训练家可能摸到相同候选。');
  } else if (teams) {
    setup = settings.teamAssignment === 'random' ? text(
      `Seat an even number of ready trainers (2–${ROOM_CAPACITY}), with AI allowed. Two equal teams are randomized and revealed before partner selection. A randomly chosen trainer takes the first turn.`,
      `2–${ROOM_CAPACITY} 位训练家且为偶数，全部准备后开局，可加入 AI。随机组成两支人数相等的队伍，选搭档前公开。随机决定首位训练家，之后依座次行动。`)
      : text(
        `Seat an even number of ready trainers (2–${ROOM_CAPACITY}), with AI allowed. Alternate seats between two public teams. A randomly chosen trainer takes the first turn, then play follows seat order.`,
        `2–${ROOM_CAPACITY} 位训练家且为偶数，全部准备后开局，可加入 AI。按座位依次交替分成公开的两队。随机决定首位训练家，之后依座次行动。`);
    openingPartners = text('All partners start at level 1. At large tables, different trainers may draw the same candidate.','所有搭档从 1 级开始。大型对局中，不同训练家可能摸到相同候选。');
  } else if (viridian) {
    setup = text(
      `Start with ${minimum}–${VIRIDIAN_MAX} ready trainers, including AI. A randomly appointed Gym Trainer is public and goes first. The true Leader is revealed when the acting leader is eliminated or round ${VIRIDIAN_REVEAL_ROUND} starts. If the true Leader is eliminated first, reveal their role and settle immediately.`,
      `${minimum}–${VIRIDIAN_MAX} 位训练家全部准备后开局，可加入 AI。随机一名道馆训练家公开担任代理馆主并先手。代理退场或第 ${VIRIDIAN_REVEAL_ROUND} 轮开始时，公开真馆主。若真馆主先退场，立即亮牌并结算。`);
    openingPartners = text(
      'The Acting Gym Leader starts with a level 2 active partner and both partners gain 1 maximum HP. The true Leader starts at level 1, like the other trainers. Revealing the role does not alter partner stats.',
      '代理馆主的出战从 2 级开始，两只搭档的体力上限各加 1。真馆主与其他训练家的搭档从 1 级开始，亮牌时数值照旧。');
  } else if (duel) {
    setup = text('One human and one AI play as the Gym Leader and Team Rocket. The Gym Leader takes the first turn.','一名真人与一名 AI 分任馆主与火箭队。馆主先行动。');
  }

  const sections = [
    {id:'setup',title:text('Seats and identities','席位与身份'),copy:setup},
    {id:'partners',title:text('Choose partners','选择搭档'),copy:text(
      `Draw five distinct Pokémon candidates. Choose one active and one private reserve. Each trainer takes four starting cards from the ${cards}-card deck. ${openingPartners.en}`,
      `每人摸五个不同的宝可梦候选，选择一只出战和一只私密后备，再从 ${cards} 张的牌库摸四张起始手牌。${openingPartners.zh}`)},
  ];
  if (viridian) sections.push({
    id:'viridian',title:text('Viridian Gym actions','常磐道馆专用规则'),
    steps:[investigation,...(settings.gymGuard?[guardRule]:[]),...(settings.rocketPartners?[rocketPair]:[]),
      ...(infiltration?[infiltratorRule]:[])],
  });
  if (settings.trainerProfessions) sections.push({
    id:'professions',title:text('Public professions','公开职业'),
    copy:text('Choose up to one profession with your Pokémon. Your choice is public and fixed for the match. Several trainers may choose the same profession.',
      '确认宝可梦时可选择一项职业。选择公开且本局固定，多位训练家可以选择同一职业。'),
    steps:trainerProfessionIds.map(id=>[trainerProfessions[id].name,trainerProfessions[id].rule]),
  });
  if (lake) sections.push({id:'lake',title:text('Transmitter and boss phases','电波装置与首领阶段'),steps:[
    [text('Shut down the transmitter','关闭电波装置'),text('During Play, a challenger can discard two hand cards of different printed weather to switch it off for the rest of the game. While it is on, the first damaging move on the boss’s turn has +1 base damage.',
      '挑战者可在出牌阶段弃置两张印刷天气不同的手牌，永久关闭装置。装置开启时，首领自己回合的首个伤害招式增加 1 点基础伤害。')],
    [text('Two health bars','两段体力'),text('Any challenger can target the boss with a damaging move. The boss also ignores distance. Its first knockout triggers an enraged level-3 phase and resets HP and status. It draws one extra card on its turns in phase 2. The boss has no reserve or rescue window.',
      '挑战者的伤害招式可以无视距离指定首领，首领也无视距离。第一段体力耗尽后，首领进入 3 级狂暴阶段，重置体力与状态。第二阶段自己回合多摸一张牌。首领无后备，也没有救援窗口。')],
  ]});
  if (silph) sections.push({id:'silph',title:text('Master Ball control','大师球占领'),steps:[
    [text('Claim','争夺'),text('During Play, discard two hand cards of different printed weather to claim the Master Ball for your team. You cannot claim it again for your own team while it holds the ball.',
      '出牌阶段弃两张印刷天气不同的手牌，为己方占领大师球。己方正在占领时，不能用这个行动重置进度。')],
    [text('Hold the line','守住一圈'),text('Keep control until turn order returns to or passes the claiming seat. A rival claim replaces both the controlling team and the seat. Control is lost if the entire controlling team is eliminated.',
      '守到行动顺序下一次回到或经过发起争夺的座位。其他队成功争夺会更换占领队伍及发起席。占领方全队退场则失去占领。')],
  ]});
  if (radio) sections.push(radioRules);
  if (settings.weatherLab && hasPack(pack,HOENN_PACK)) sections.push(forecast);
  if (hasPack(pack,HOENN_PACK)) sections.push({
    id:'nincada-evolution',title:text('Nincada evolution','土居忍士的进化'),copy:text(
      'Nincada stays Bug/Ground at levels 1 and 2. It normally evolves into Ninjask at level 3. If a full-HP level 2 Nincada levels up at the end of its trainer’s turn, the trainer may choose Shedinja instead. Shedinja has a maximum of 1 HP.',
      '土居忍士在 1 级和 2 级均为虫／地面，通常升到 3 级时进化为铁面忍者。2 级土居忍士满体力且在自己回合结束时升级，可选择进化成脱壳忍者。脱壳忍者的体力上限为 1。'),
  });
  if (teams && hasPack(pack,TOUR_PACK)) sections.push({
    id:'follow-me',title:text('Follow Me','看我嘛'),copy:text(
      'When an ally is targeted by a damaging single-target move, an eligible teammate may discard one card to take the move if they are in range and otherwise legal. Defense and damage then resolve against the new target.',
      '队友成为伤害型单目标招式的目标时，处于招式范围内且符合其他目标条件的队友可弃一张牌来承接。防御和伤害改由新目标结算。'),
  });

  sections.push(
    {id:'turn',title:text('Take a turn','进行回合'),steps:phases},
    {id:'response',title:text('Respond and resolve','响应与结算'),copy:text(
      'When targeted, choose an available response or pass. At 0 HP or below, resolve rescue. If a partner is knocked out, a surviving reserve takes over; otherwise the trainer is eliminated.',
      '成为目标后，选择可用响应或放弃。体力降至 0 或以下时结算救援。宝可梦被击倒后，存活后备强制登场；无存活后备则训练家退场。')},
  );
  const victory = {id:'victory',title:text('Determine the winner','判定胜负')};
  if (lake) victory.copy=text('The challengers share victory after defeating both phases. Red Gyarados wins if every challenger is eliminated.',
    '挑战者击败首领两个阶段后全队获胜。若所有挑战者都退场，则红色暴鲤龙获胜。');
  else if (silph) victory.copy=text('Win by holding the Master Ball for one full turn rotation or by eliminating both opposing teams. All members of the winning team share victory.',
    '守住大师球一圈，或淘汰其余两支队伍，即可获胜。胜队全员共享胜利。');
  else if (radio) victory.copy = text(
    `Win immediately by reaching ${RADIO_GOAL} intelligence points or eliminating the opposing team. All members of the winning team share the win.`,
    `首先达到 ${RADIO_GOAL} 情报点或淘汰对方全队的一方立即获胜。胜方全队成员共享胜利。`);
  else if (teams) victory.copy = text('Eliminate the entire opposing team to win. All members of the winning team share the win.','淘汰对方全队的一方获胜。胜方全队成员共享胜利。');
  else if (duel) victory.copy = text('The last trainer in play wins.','最后留场的训练家获胜。');
  else if (infiltration) victory.steps = infiltratorVictory;
  else victory.steps = viridian && settings.rocketPartners ? rocketPairVictory : identityVictory;
  sections.push(victory);
  return {mode,modeName,packName:packNames[pack] ?? packNames.base,cards,sections};
}
