import {seatLayout} from './battlefield-layout.js';
import {roleName,statusName,weatherLabel,attackDialog,giftCardsDialog,equipItemDialog,analyticDialog,decisionPanel,resultPanel} from './combat-ui.js';
const $ = (selector, root = document) => root.querySelector(selector);
const root = $('#app');
const strings = {
  startBattlePreview:['Start game','开始游戏'], combatPreview:['COMBAT PREVIEW · TEST DECK','战斗预览 · 测试牌库'],
  combatFixture:['3–6 ready trainers. Identities first, then draw 5 different Pokémon each and keep 2. No Pokémon repeats between players. Test deck: 6 command and 6 dodge cards per seat, all intense sun. These are development quantities; Potion and other game cards are pending.','需3–6位训练家准备。先分配身份，再每人摸取五个不同宝可梦，选择两个。所有玩家之间不重复。每席测试牌库为6张接招吧！及6张快躲开！，天气均为烈日。这是开发测试数量，伤药及其他游戏牌尚未加入。'],
  combatPick:['Draw five Pokémon, then choose your active and reserve partners. The Gym Leader starts active at Lv.2; other trainers and all reserves at Lv.1.','摸取五张宝可梦后，选择出场与备战搭档。馆主出场为2级，其他训练家及所有备战为1级。'],
  combatPickTitle:['Five Pokémon. Choose two.','五个候选，选择两只。'],
  equipItem:['Equip item','携带持有物'], itemSuppressed:['suppressed','失效'], reserveItem:['Held item (inactive in reserve)','持有物（备战中不生效）'],
  weatherMove:['Use Will-O-Wisp','使用磷火'],
  giveCards:['Justified · give cards','正义之心 · 交给手牌'],
  playMove:['Use move','使用招式'], useTrait:['Use optional trait','发动可选特性'], responsePending:['Resolve the current response first.','请先处理当前响应。'],
  combatPlayHelp:['Use a move, activate a trait, switch, or finish playing.','可使用招式、发动特性、交替或完成出牌阶段。'],
  clockResponse:['Paused · response in progress','暂停 · 正在响应'], yourRole:['Your identity','你的身份'], eliminated:['Eliminated','已退场'],
  previewEffects:['Effects supported in combat preview; full deck pending.','战斗预览支持此效果；完整牌库待补齐。'],
  brand: ['ROCKET TABLE', '火箭牌桌'], edition: ['MULTIPLAYER FOUNDATION', '多人游戏基础版'],
  catalogue: ['Field guide', '宝可梦图鉴'], rules: ['How this build works', '本版本说明'],
  language: ['Language', '语言'], graphics: ['Rich graphics', '丰富视觉效果'], motion: ['Reduce motion', '减少动态效果'],
  foundation: ['A real table. A foundation in progress.', '真实联机牌桌 · 规则持续完善中'],
  foundationBody: ['Rooms and a Pokémon combat preview are live, including responses, HP, identities and results. The preview uses an explicitly labelled test deck; the full card set is still in progress.', '已支持房间及已复核搭档战斗预览，包括响应、体力、身份与胜负。预览使用明确标注的测试牌库，完整卡牌仍在实现中。'],
  headline: ['WHO’S TEAM ROCKET?', '谁是火箭队？'],
  intro: ['Invite your friends. Choose your partners. Take your place in the arena.', '邀请好友，选择搭档，在竞技场中就位。'],
  local: ['LOCAL MULTIPLAYER PLAYTEST', '本地多人联机测试'], nickname: ['Trainer nickname', '训练家昵称'],
  nickPlaceholder: ['How should we call you?', '怎么称呼你？'], create: ['Create a room', '创建房间'],
  joinTitle: ['Already have an invitation?', '已有房间邀请？'], roomCode: ['Room code', '房间代码'], join: ['Join table', '加入牌桌'],
  spectator: ['Join as a spectator', '以观众身份加入'], spectatorLabel: ['Spectator', '观众'],
  recoverTitle: ['Return to your seat', '恢复你的席位'], recoverCopy: ['Use the private credential saved from this seat. A nickname cannot recover a seat.', '使用此席位的私密恢复凭据。仅凭昵称无法恢复席位。'],
  credential: ['Private recovery credential', '私密恢复凭据'], recover: ['Recover seat', '恢复席位'],
  room: ['ROOM', '房间'], owner: ['Host', '房主'], you: ['You', '你'], lobby: ['Lobby', '准备大厅'], setup: ['Choose partners', '选择搭档'], playing: ['At the table', '对局进行中'], closed: ['Room closed', '房间已关闭'],
  copyCode: ['Copy room code', '复制房间代码'], copied: ['Copied', '已复制'], copyUnavailable: ['Copy unavailable. Select and copy the code manually.', '无法自动复制，请手动选择并复制代码。'],
  connection: ['Connected', '已连接'], reconnecting: ['Connection interrupted · retrying', '连接中断 · 正在重试'], syncing: ['Syncing table…', '正在同步牌桌…'],
  privacy: ['Keep your seat safe', '保管好你的席位'], privacyText: ['This tab keeps your credential in session storage. Anyone with it can control your seat. Save it privately to recover after closing this tab.', '本标签页在会话存储中保存凭据。持有此凭据的人可以控制你的席位。如需关闭标签页后恢复，请私下保存。'],
  reveal: ['Show private credential', '显示私密凭据'], hide: ['Hide credential', '隐藏凭据'], copyCredential: ['Copy private credential', '复制私密凭据'],
  disconnect: ['Leave this tab’s session', '退出此标签页会话'], disconnectHelp: ['This clears only this tab’s credential; it does not remove your seat. Save recovery details first.', '此操作只清除此标签页的凭据，不会移除席位。请先保存恢复信息。'],
  leaveConfirm: ['Clear this tab’s saved session? Your seat remains in the room. Make sure you saved the private recovery credential.', '清除此标签页保存的会话？房间内的席位仍将保留。请确认已保存私密恢复凭据。'],
  crew: ['The crew', '训练家们'], seats: ['testing seats', '个测试席位'], testing: ['For 3–6 trainers. View identities first, then draw five Pokémon each and choose two.', '供3–6位训练家游玩。先查看身份，再每人摸取五张宝可梦，选择两只。'],
  ready: ['Ready', '已准备'], notReady: ['Getting ready', '准备中'], readyButton: ['I’m ready', '准备好了'], unready: ['Cancel ready', '取消准备'],
  start: ['Start partner selection', '开始选择搭档'], startHelp: ['The host can start when 3–6 seated players are ready.', '当3–6位入座玩家全部准备后，房主可以开始。'],
  watch: ['Watch the table come together.', '一起等待牌桌就绪。'], watchCopy: ['Spectators can follow public activity. Candidates, hands and unrevealed reserves stay private. Previously revealed reserves remain public.', '观众可以查看公开进度。候选、手牌与未公开备战身份保持私密；已公开的备战搭档仍公开。'],
  arenaTitle: ['Set the scene', '选择对战场景'], stadium: ['Sunrise Stadium', '晨光竞技场'], gym: ['Neon Gym', '霓虹道馆'], floating: ['Sky Islands', '浮空群岛'],
  stadiumDesc: ['Open skies. Big-table energy.', '开阔天空，热血开场。'], gymDesc: ['Electric lights. Focused play.', '霓虹灯光，专注对局。'], floatingDesc: ['Clouds below. Adventure ahead.', '云海在下，冒险在前。'],
  turnTimer: ['Turn timer (seconds)', '回合计时（秒）'], turnTimerEnabled: ['Enable turn timer', '开启回合计时'], responseTimer: ['Response timer (combat preview)', '响应计时（战斗预览）'], timerHelp: ['Turn timer: 0 = off, or 5–600 seconds. It pauses for an offline acting player or a closing vote. Response timing applies to combat-preview decisions.', '回合计时：0 为关闭，或设为 5–600 秒。行动玩家离线或进行结束投票时暂停。响应计时用于战斗预览中的响应选择。'],
  saveSettings: ['Save room settings', '保存房间设置'], saved: ['Room settings saved.', '房间设置已保存。'],
  pickEyebrow: ['PRIVATE PARTNER SELECTION', '私密搭档选择'], pickTitle: ['Five possibilities. Two partners.', '五个候选，两位搭档。'],
  pickCopy: ['Choose an active partner first, then a private reserve. Your selection stays private until confirmed.', '先选出场搭档，再选私密后备。确认前，你的选择保持私密。'],
  fixture: ['Provisional setup fixture: 5 choices, keep 2 at level 1. Candidates may repeat across players; real deck quantities are not asserted.', '临时设置流程：5 选 2，均为 1 级。不同玩家的候选可能重复，不代表正式牌库数量。'],
  switchPokemon: ['Switch partners', '交替搭档'], switchUsed: ['Switch used', '已交替'],
  switchConfirm: ['Attempt to switch active and reserve partners? A completed switch reveals the incoming partner and uses your one ordinary switch this play phase. Arena Trap may require a hand-card discard or cancel the switch.', '尝试交替出场与备战搭档？交替成功后，新出场搭档将公开，并用掉本出牌阶段的一次普通交替。沙穴可能要求弃置手牌，否则取消交替。'],
  switchHelp: ['Switch once this play phase, or finish playing. Card effects remain unavailable.', '本出牌阶段可交替一次，或完成出牌阶段。卡牌效果仍不可用。'],
  switchUsedHelp: ['Ordinary switching is used. Finish playing to continue.', '本阶段已进行普通交替，可完成出牌阶段继续。'],
  publicReserve: ['Revealed reserve', '已公开备战'], switchUnavailable: ['Switching needs an active and reserve partner.', '交替需要出场与备战搭档。'],
  identity:['Your identity','你的身份'], identityStep:['1 · Identities','1 · 分配身份'], pokemonStep:['2 · Pokémon selection','2 · 选择宝可梦'], identityTitle:['Discover your identity','查看你的身份'], identityHelp:['Everyone views their identity before any Pokémon are drawn. Only the Gym Leader is public.','所有人查看身份后才会摸取宝可梦，仅道馆馆主身份公开。'], identitySeen:['I’ve seen my identity','我已查看身份'], identityWaiting:['Waiting for the other trainers to view their identities.','等待其他训练家查看身份。'], identityProgress:['Identities viewed','已查看身份'], drawPokemon:['Draw one Pokémon','摸取一张宝可梦'], drawPokemonFirst:['Draw all five before choosing','先摸齐五张再选择'], cardsDrawn:['Pokémon drawn','已摸取宝可梦'], unseenCandidate:['Undrawn Pokémon','未摸取宝可梦'], selectionProgress:['Partners locked','已确认搭档'], effectsPending:['Battle effects pending','战斗效果待实现'],
  hoverPokemonHint:['Hover for levels · Click for details','悬停看等级 · 点击看详情'], levelPreviewHelp:['Click a level for full details','点击等级卡查看完整详情'], inspectLevel:['View details','查看详情'],
  inspectPokemon:['Levels & abilities','等级与技能'], traitLabel:['Ability','特性'], movesLabel:['Moves','招式'], movesPending:['Move text has not been reviewed yet.','招式文本尚待复核。'], evolutionLine:['Evolution line','进化路线'], abilityHelp:['Choose a level to view its form, HP, ability and moves.','选择等级，查看形态、体力、特性与招式。'],
  damageProtected:['Protected this turn','本回合伤害免疫'],
  active: ['Active partner', '出场搭档'], reserve: ['Private reserve', '私密后备'], choose: ['Choose', '选择'], selected: ['Selected', '已选择'],
  confirmPick: ['Confirm my two partners', '确认两位搭档'], clearPick: ['Clear selection', '清空选择'],
  waitingPick: ['Your partners are locked in.', '你的搭档已确认。'], waitingPickCopy: ['Waiting for the rest of the crew to choose their partners.', '正在等待其他玩家完成选择。'], chosen: ['Partners chosen', '已选择搭档'], choosing: ['Choosing partners', '正在选择搭档'],
  round: ['TURN', '回合'], currentTurn: ['Your turn', '轮到你了'], theirTurn: ['At the controls', '当前行动玩家'],
  turnFlow: ['Draw → play → discard → end', '摸牌 → 出牌 → 弃牌 → 结束'],
  phaseDraw: ['Draw', '摸牌'], phasePlay: ['Play', '出牌'], phaseDiscard: ['Discard', '弃牌'], phaseEnd: ['End', '结束'],
  finishPlay: ['Finish playing', '完成出牌阶段'], playHelp: ['Card effects are unavailable. Finish playing to continue to discards or turn end.', '卡牌效果尚不可用。完成出牌阶段后，继续弃牌或结束回合。'],
  clockLabel: ['Turn clock', '回合时钟'], clockOff: ['Timer off', '计时已关闭'], clockRunning: ['Remaining', '剩余'], clockDisconnected: ['Paused · acting player offline', '暂停 · 行动玩家离线'], clockVote: ['Paused · closing vote', '暂停 · 结束投票'], clockMandatory: ['Time expired · complete required draws or discards', '时间已到 · 请完成必须的摸牌或弃牌'], clockExpired: ['Time expired · server is resolving the turn', '时间已到 · 服务器正在处理回合'], clockSync: ['Awaiting server time check', '等待服务器确认时间'], clockWarning: ['Ten seconds or less remain in your turn.', '你的回合剩余时间不足十秒。'],
  draw: ['Draw one card', '摸一张牌'], drawsLeft: ['draws remaining', '次摸牌剩余'], endTurn: ['End my turn', '结束我的回合'],
  endTurnConfirm: ['End your turn and pass play to the next seated player?', '结束你的回合并交给下一位入座玩家？'],
  levelUpChoice: ['Level up my active partner', '让我的出场搭档升一级'],
  levelUpHelp: ['Optional, once at turn end, up to level 3. Existing injuries/status remain. An expired turn passes without levelling up.', '可在回合结束时选择升一级，最高3级，保留已有伤害与状态。计时到期直接结束，不自动升级。'],
  levelMax: ['This partner is already at level 3.', '此搭档已达到 3 级。'],
  handTitle: ['Your private hand', '你的私密手牌'], handFixture: ['Hand cards are unplayable placeholders. Card effects are not implemented.', '手牌均为不可打出的占位牌，卡牌效果尚未实现。'],
  discard: ['Discard', '弃牌'], drawFirst: ['Draw two cards, then finish the play phase before discarding.', '摸两张牌，然后完成出牌阶段，才可弃牌。'], trim: ['Discard down to 4 cards to complete the discard phase.', '弃至 4 张手牌，完成弃牌阶段。'], turnReady: ['Required actions are complete. Confirm to end your turn.', '必须操作已完成，请确认结束回合。'],
  waitTurn: ['Your hand is private. Wait for your turn to draw.', '你的手牌保持私密，请等待自己的回合。'], cards: ['cards', '张牌'], level: ['LV.', '等级'], hp: ['HP', '生命'], unknownHp: ['HP unverified', '生命值待核实'],
  placeholder: ['PROJECTION PLACEHOLDER', '投影占位图'], assetCopy: ['3D arena · character assets pending', '3D 竞技场 · 角色素材待补充'],
  reserveHidden: ['Reserve stays private', '后备身份保持私密'], noActive: ['Partner projection pending', '等待搭档投影'],
  log: ['Table activity', '牌桌动态'], logEmpty: ['Your story starts here.', '故事从这里开始。'],
  control: ['Room controls', '房间管理'], endGame: ['Request return to lobby', '申请返回大厅'], endRoom: ['Request room closure', '申请关闭房间'],
  endRoomLobby: ['Close room', '关闭房间'], endRoomConfirm: ['Close this room? In the lobby this closes immediately; during play every connected seated player must approve. Closed rooms cannot be recovered.', '关闭此房间？大厅中会立即关闭；对局中需所有在线入座玩家同意。已关闭的房间无法恢复。'],
  endGameConfirm: ['Request a return to the lobby? All connected seated players must approve. Current private game data will be cleared; no winner is declared.', '申请返回大厅？需要所有在线入座玩家同意。当前私密对局数据将清除，不判定赢家。'],
  voteGame: ['Return to the lobby?', '返回准备大厅？'], voteRoom: ['Close this room?', '关闭此房间？'],
  voteCopy: ['Every required connected seated player must approve. Rejecting cancels this request.', '需要所有指定在线入座玩家同意。拒绝将取消此次申请。'],
  approved: ['Approved', '已同意'], awaiting: ['Awaiting response', '等待回应'], approve: ['Approve request', '同意申请'], reject: ['Reject request', '拒绝申请'], voteWaiting: ['Waiting for the remaining players.', '等待其他玩家回应。'],
  closedCopy: ['This room has closed. Its credentials can no longer be used to join or recover.', '此房间已关闭，原有凭据无法再用于加入或恢复。'], newAdventure: ['Back to entry', '返回入口'],
  referenceOnly: ['Reference only · effects unavailable in play', '仅供参考 · 对局效果尚不可用'], commandCost: ['Use 1 Take this! card', '使用1张【接招吧！】'], printedValue: ['Printed value', '印刷数值'],
  guideTitle: ['Partner field guide', '搭档图鉴'], guideCopy: ['Public reference catalogue. Unknown rules stay unknown; no ability text is invented.', '公开资料图鉴。未核实的规则保留未知，不编造技能文本。'],
  search: ['Search partners', '搜索搭档'], noResults: ['No matching partners.', '没有匹配的搭档。'], evidence: ['Evidence status', '证据状态'], abilityPending: ['Ability text pending verification', '技能文本待核实'],
  rulesTitle: ['A playable foundation, with clear boundaries.', '可联机体验的基础版，范围清晰。'],
  rules1: ['Live now: private rooms, host settings, readiness, private 5-to-2 selection, spectator views, drawing, hand-limit discards, turn order, unanimous end votes and recovery credentials.', '现已支持：私密房间、房主设置、准备状态、私密 5 选 2、观众视角、摸牌、手牌上限弃牌、回合顺序、全员结束投票与凭据恢复。'],
  rules2: ['Combat preview supports Bulbasaur, Charmander, Squirtle, Pikachu, Sandshrew, Abra, Machop, Growlithe, Vulpix, Mankey and Slowpoke: command/Dodge responses, HP, reviewed abilities, rescue passes, deployment and role-based results. Other Pokémon effects, Potion and the full game-card deck remain in progress.', '战斗预览支持妙蛙种子、小火龙、杰尼龟、皮卡丘、穿山鼠、凯西、腕力、卡蒂狗、六尾、猴怪及呆呆兽十一组搭档：指令与躲闪响应、体力、已复核特性、救援放弃、强制登场及身份胜负。其他宝可梦效果、伤药及完整游戏牌库仍在开发中。'],
  rules3: ['View identities first, then draw five different Pokémon each from one shuffled 40-group deck and choose two. No candidates repeat between trainers. The Gym Leader starts active at level 2; other active partners and all reserves start at level 1.', '先查看身份，再从同一洗匀的40组宝可梦牌库中每人摸取五个不同候选并选择两只。所有训练家之间不重复。馆主出场为2级，其他出场及所有备战为1级。'],
  rules4: ['Draw two cards, finish playing, discard down to four, then confirm turn end. You may raise the active partner one level at turn end, up to level 3. Ordinary switching is once per Play phase and reveals the incoming partner. Optional ability responses may be passed; a required hand-card choice waits for its owner even after the timer expires.', '摸两张牌、完成出牌阶段、弃至四张手牌后确认结束。回合结束时可让出场搭档升一级，最高3级。每个出牌阶段可普通交替一次，新出场搭档会公开。可选特性响应可以放弃；必须的手牌选择即使计时结束也会等待本人完成。'],
  rules5: ['Rooms expire after 7 hours without accepted actions. Polling does not extend room life. Offline turns cannot be skipped; host control transfers after the disconnect grace period.', '连续 7 小时没有有效操作，房间将过期。轮询不会延长房间寿命。离线玩家的回合无法跳过，房主离线超过宽限期后将转移房主权限。'],
  rules6: ['The optional turn timer is enforced by the server. Expiry ends the turn after required draws and excess-card discards are complete. It pauses while the acting player is offline or a closing vote is open. Response timing is active in combat preview; music remains pending. Keep recovery credentials private.', '可选回合计时由服务器执行。时间到后，完成必须的摸牌与超出上限的弃牌，回合即会自动结束。行动玩家离线或进行结束投票时暂停。响应计时已用于战斗预览，音乐待实现。请妥善保管恢复凭据。'],
  close: ['Close', '关闭'], busy: ['Working…', '处理中…'], genericError: ['The action could not be completed. Please try again.', '操作未完成，请重试。'],
  stale: ['The table changed. It has been refreshed; review it before acting again.', '牌桌状态已更新，现已刷新，请确认后再操作。'],
  networkError: ['Could not reach the room service. Your local selection is preserved; retry when connected.', '无法连接房间服务。你的本地选择已保留，请连接后重试。'],
  invalidInput: ['Enter a nickname and room code where required.', '请输入昵称，以及所需的房间代码。'], timerInvalid: ['Timers must be 0 or a whole number from 5 to 600.', '计时必须为 0，或 5 至 600 的整数。'],
  recoveryRequired: ['Enter the room code and private recovery credential.', '请输入房间代码及私密恢复凭据。'],
  offline: ['Offline', '离线'], joined: ['Seat connected.', '席位已连接。'], endReason: ['This is a foundation playtest; no combat outcome is recorded.', '这是基础版测试，不会记录战斗胜负。'],
  spectators: ['Spectators', '观众'], none: ['None yet', '暂无'], privateBadge: ['ONLY YOU CAN SEE THIS', '仅你可见'],
  errorsHint: ['Check the current room state and try again.', '请确认当前房间状态后重试。'],
  expired: ['Room expired', '房间已过期'], expiredCopy: ['This room expired after seven hours without a player action. Start a new room to continue.', '此房间因连续七小时没有玩家操作而过期，请创建新房间。'],
  sessionEnded: ['Session ended', '会话已结束'],
  unauthorized: ['The recovery credential is invalid for this room.', '恢复凭据不属于此房间或已失效。'],
  roomMissing: ['Room not found or expired. Check the room code.', '房间不存在或已过期，请检查房间代码。'],
  roomFull: ['This development room has no available seats.', '此开发版房间没有可用席位。'],
  gameStarted: ['The session has started. You can join as a spectator.', '对局已开始，可以以观众身份加入。'],
  notReadyError: ['At least two seated players must be ready before starting.', '至少需要两位入座玩家全部准备后才能开始。'],
  drawExhausted: ['Both draws are complete. Continue with the current phase.', '已完成两次摸牌，请继续当前阶段。'],
  wrongPhase: ['This action is unavailable in the current phase. Review the refreshed table.', '当前阶段无法进行此操作，请查看更新后的牌桌。'],
  wrongTurn: ['Wait for your turn before taking this action.', '请等待自己的回合再进行此操作。'],
  turnIncomplete: ['Complete the draw, play and required discard phases first.', '请先完成摸牌、出牌与必须的弃牌阶段。'],
  votePending: ['Resolve the closing vote before continuing.', '请先处理结束申请，再继续对局。'],
  invalidSelection: ['Choose two different partners from your own candidates.', '请从自己的候选中选择两位不同搭档。'],
  ownerOnly: ['Only the current room owner can do this.', '仅当前房主可以执行此操作。'],
  confirmAction: ['Confirm', '确认'], cancelAction: ['Cancel', '取消'], confirmationTitle: ['Confirm action', '确认操作'],
  previewBattlefield: ['Preview the battlefield', '预览对战场地'], visualPreview: ['6-SEAT VISUAL PREVIEW', '六人场地视觉预览'],
  previewNotice: ['Layout preview · no match is running', '场地布局预览 · 未运行对局'],
  tableCamera: ['Table view', '桌面视角'], overheadCamera: ['Overhead', '俯视视角'],
  arenaMenu: ['Table menu', '牌桌菜单'], worldPlaceholder: ['Pokémon model slots · assets pending', '宝可梦模型位置 · 素材待补充'],
  fallbackView: ['2D field · 3D unavailable or disabled', '二维场地 · 三维不可用或已关闭'],
  previewCard: ['CARD SLOT', '手牌位置'], previewPlayer: ['Player', '玩家'],
};
// Pin preferences per tab so another player's tab cannot change them on reload.
for (const [key, fallback] of [['language', 'en'], ['motion', 'false'], ['graphics', 'true']]) {
  const name = `rocket.${key}`;
  if (sessionStorage.getItem(name) === null) sessionStorage.setItem(name, localStorage.getItem(name) ?? fallback);
}
const savePreference = (key, value) => { sessionStorage.setItem(key, value); localStorage.setItem(key, value); };
let language = sessionStorage.getItem('rocket.language') === 'zh' ? 'zh' : 'en';
let reducedMotion = sessionStorage.getItem('rocket.motion') === 'true';
let richGraphics = sessionStorage.getItem('rocket.graphics') !== 'false';
const t = key => strings[key]?.[language === 'zh' ? 1 : 0] ?? key;
const localized = value => typeof value === 'string' ? value : (value?.[language] || value?.en || value?.zh || '—');
let catalogue = [];
let session = null;
try { const saved = JSON.parse(sessionStorage.getItem('rocket.session') || 'null'); if (saved?.code && saved?.token) session = saved; } catch { sessionStorage.removeItem('rocket.session'); }
let view = null, busy = false, pollRunning = false, connected = true, errorKey = '', errorCode = '', noticeKey = '', selected = [], settingsDraft = null, signature = '', dialogKind = null, terminalReason = '';
let credentialVisible = false, dialogReturnFocus = null;
let clockSample = null, clockAnnouncement = '', phaseAnnouncement = '', turnTimerDefault = 60, turnLiveRegion = null;
let scenePreview = new URLSearchParams(location.search).has('preview'), previewTheme = 'stadium', cameraMode = 'table', battlefield = null;
const el = (tag, attributes = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || (value === false && !key.startsWith('aria-'))) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'disabled' || key === 'checked' || key === 'selected') node[key] = Boolean(value);
    else node.setAttribute(key, key.startsWith('aria-') ? String(value) : value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) if (child !== null && child !== undefined && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
};
const button = (key, handler, className = 'button', disabled = false, attrs = {}) => el('button', { type: 'button', class: className, disabled: busy || disabled, onclick: handler, ...attrs }, t(key));
const tag = (text, className = '') => el('span', { class: `tag ${className}` }, text);
const catalogueEntry = id => catalogue.find(item => item.id === id);
const partnerName = (id, level = 1) => {
  const entry = catalogueEntry(id);
  return localized(entry?.levels?.find(face => face.level === level)?.name || entry?.name || id);
};
const isOwner = () => view?.ownerId === view?.selfId;
const seated = () => view?.players.filter(p => !p.spectator) || [];
const ownPlayer = () => view?.players.find(p => p.id === view.selfId);
const myTurn = () => view?.status === 'playing' && !view.pendingVote && !view.pendingBattle && !ownPlayer()?.eliminated && view.turn?.playerId === view.selfId && !view.self.spectator;
const ownHandLimit=()=>view?.gameMode==='combat-preview'&&view.self.handLimit===null?Infinity:view?.self?.handLimit??4;
const turnPhases = ['draw', 'play', 'discard', 'end'];
function turnPhase() {
  if (turnPhases.includes(view?.turn?.phase)) return view.turn.phase;
  // Old rooms may not yet have explicit phases. Preserve their existing flow.
  return view?.turn?.drawRemaining > 0 ? 'draw' : (view?.self?.hand?.length > ownHandLimit() ? 'discard' : 'end');
}
function phaseHint() {
  if (view.pendingVote) return t('votePending');
  if (view.pendingBattle) return t('responsePending');
  if (view.self.spectator) return t('watchCopy');
  if (!myTurn()) return t('waitTurn');
  if (view.gameMode === 'combat-preview' && turnPhase() === 'play') return t('combatPlayHelp');
  return turnPhase() === 'draw' ? `${view.turn.drawRemaining} ${t('drawsLeft')}` : t({play:view.turn.switchUsed?'switchUsedHelp':'switchHelp',discard:'trim',end:'turnReady'}[turnPhase()]);
}
function announceTurn(text) {
  if (!turnLiveRegion) {
    turnLiveRegion = el('div', {class:'turn-live-region', role:'status', 'aria-live':'polite', 'aria-atomic':'true'});
    document.body.append(turnLiveRegion);
  }
  turnLiveRegion.textContent = text;
}
function phaseStrip() {
  const phase = turnPhase();
  return el('div', {class:'turn-status'}, el('ol', {class:'phase-strip', 'aria-label':t('turnFlow')},
    ...turnPhases.map((item, index) => el('li', {class:item === phase ? 'current-phase' : index < turnPhases.indexOf(phase) ? 'completed-phase' : '', 'aria-current':item === phase ? 'step' : null}, el('span', {'aria-hidden':'true'}, String(index + 1)), t(`phase${item[0].toUpperCase()}${item.slice(1)}`)))),
    el('div', {class:'turn-clock', 'aria-label':t('clockLabel')}, el('span', {class:'clock-time', 'aria-live':'off'}), el('span', {class:'clock-state'})));
}
function sampleTurnClock(next) {
  const clock = next.turn?.clock;
  if (next.status !== 'playing' || !clock) { clockSample = null; return; }
  const running = Number.isFinite(clock.deadlineAt) && !clock.expired && !clock.pausedReason;
  const remainingMs = running && Number.isFinite(next.serverNow) ? Math.max(0, clock.deadlineAt - next.serverNow) : Math.max(0, Number(clock.remainingMs) || 0);
  clockSample = {at:performance.now(), remainingMs, running};
}
function updateTurnClock() {
  if (scenePreview || view?.status !== 'playing') {
    if (turnLiveRegion) turnLiveRegion.textContent = '';
    clockAnnouncement = ''; phaseAnnouncement = '';
    return;
  }
  const node = $('.turn-clock');
  if (!node) return;
  const clock = view.turn?.clock;
  const remainingMs = clockSample ? Math.max(0, clockSample.remainingMs - (clockSample.running ? performance.now() - clockSample.at : 0)) : 0;
  const seconds = Math.ceil(remainingMs / 1000);
  let state = 'clockOff';
  if (clock) {
    if (clock.pausedReason === 'vote') state = 'clockVote';
    else if (clock.expired || clock.pausedReason === 'mandatory') state = ['draw','discard'].includes(turnPhase()) ? 'clockMandatory' : 'clockExpired';
    else if (clock.pausedReason === 'response') state = 'clockResponse';
    else if (clock.pausedReason === 'disconnected') state = 'clockDisconnected';
    else state = seconds > 0 ? 'clockRunning' : 'clockSync';
  }
  const warning = Boolean(clock && clockSample?.running && seconds > 0 && seconds <= 10 && myTurn() && connected);
  node.classList.toggle('clock-warning', warning);
  node.classList.toggle('clock-paused', Boolean(clock?.pausedReason));
  node.classList.toggle('clock-expired', Boolean(clock?.expired));
  const time = clock ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,'0')}` : '◷';
  if ($('.clock-time',node).textContent !== time) $('.clock-time',node).textContent = time;
  if ($('.clock-state',node).textContent !== t(state)) $('.clock-state',node).textContent = t(state);
  const turnKey = `${view.code}:${view.turn?.number}:${view.turn?.playerId}`;
  const phaseKey = `${turnKey}:${turnPhase()}:${Boolean(view.turn?.switchUsed)}:${view.pendingBattle?.id || ''}:${language}`;
  if (phaseAnnouncement !== phaseKey) { phaseAnnouncement = phaseKey; announceTurn(`${t(`phase${turnPhase()[0].toUpperCase()}${turnPhase().slice(1)}`)}. ${phaseHint()}`); }
  const announcement = `${turnKey}:${state}:${warning}:${language}`;
  if (clockAnnouncement !== announcement) {
    clockAnnouncement = announcement;
    if (warning || (clock && state !== 'clockRunning')) announceTurn(warning ? t('clockWarning') : t(state));
  }
}
function askConfirmation(messageKey, onConfirm) {
  // A DOM dialog keeps room polling alive while the player considers an action.
  const dialog = el('dialog', {class:'info-dialog confirmation-dialog', 'aria-label':t('confirmationTitle')},
    el('h2', {}, t('confirmationTitle')), el('p', {}, t(messageKey)));
  const cancel = button('cancelAction', () => dialog.close(), 'button secondary');
  dialog.append(el('div', {class:'action-row'}, cancel, button('confirmAction', () => { dialog.close(); onConfirm(); }, 'button primary')));
  dialog.addEventListener('close', () => dialog.remove(), {once:true});
  document.body.append(dialog); dialog.showModal(); cancel.focus();
}
function confirmPartnerSwitch() {
  const code = view.code, number = view.turn.number;
  askConfirmation('switchConfirm', () => {
    // An open confirmation must not become permission for a later turn.
    if (view?.code !== code || view.turn?.number !== number || !myTurn() || turnPhase() !== 'play' || view.turn.switchUsed) {
      showError({code:'STALE_REVISION'}); return;
    }
    action('switchPokemon');
  });
}
function confirmTurnEnd() {
  const active = ownPlayer()?.active;
  const choice = el('input', {type:'checkbox', id:'end-level-up'});
  const dialog = el('dialog', {class:'info-dialog confirmation-dialog', 'aria-label':t('confirmationTitle')},
    el('h2', {}, t('endTurn')), el('p', {}, t('endTurnConfirm')));
  if (active && active.level < 3) {
    dialog.append(el('label', {class:'check-label'}, choice, `${t('levelUpChoice')} · ${t('level')} ${active.level + 1} ${partnerName(active.catalogueId, active.level + 1)}`), el('p', {class:'muted'}, t('levelUpHelp')));
  } else dialog.append(el('p', {class:'muted'}, t('levelMax')));
  const cancel = button('cancelAction', () => dialog.close(), 'button secondary');
  dialog.append(el('div', {class:'action-row'}, cancel, button('confirmAction', () => {
    const levelUp = Boolean(active && active.level < 3 && choice.checked);
    dialog.close(); action('endTurn', {levelUp});
  }, 'button primary')));
  dialog.addEventListener('close', () => dialog.remove(), {once:true});
  document.body.append(dialog); dialog.showModal(); cancel.focus();
}
function applyPreferences() {
  document.documentElement.lang = language === 'zh' ? 'zh-Hans' : 'en';
  document.body.classList.toggle('reduce-motion', reducedMotion);
  document.body.classList.toggle('simple-graphics', !richGraphics);
  document.body.classList.toggle('battle-view', scenePreview || ['identity','setup','playing','finished'].includes(view?.status));
  document.body.classList.toggle('setup-view', ['identity','setup'].includes(view?.status));
  document.title = language === 'zh' ? '火箭牌桌 · 多人基础版' : 'Rocket Table · Multiplayer Foundation';
}
function shell() {
  root.replaceChildren();
  const languageSelect = el('select', { id: 'language', 'aria-label': t('language'), onchange: event => { language = event.target.value; savePreference('rocket.language', language); signature = ''; render(); if (dialogKind) openDialog(dialogKind); } },
    el('option', { value: 'en', selected: language === 'en' }, 'English'), el('option', { value: 'zh', selected: language === 'zh' }, '中文'));
  const settingsMenu = el('details', { class: 'preferences' }, el('summary', { 'aria-label': t('graphics') }, '☷'),
    el('div', { class: 'preferences-menu' }, preference('graphics', richGraphics, value => { richGraphics = value; savePreference('rocket.graphics', value); render(); }), preference('motion', reducedMotion, value => { reducedMotion = value; savePreference('rocket.motion', value); render(); })));
  root.append(el('header', { class: 'site-header' }, el('div', { class: 'brand' }, el('span', { class: 'brand-mark', 'aria-hidden': true }, 'R'), el('div', {}, el('strong', {}, t('brand')), el('small', {}, t('edition')))),
    el('nav', { class: 'header-actions', 'aria-label': t('rules') }, button('catalogue', () => openDialog('catalogue'), 'button subtle small'), button('rules', () => openDialog('rules'), 'button subtle small'), languageSelect, settingsMenu)));
  root.append(el('div', { class: 'foundation-strip' }, el('span', { class: 'pulse-dot', 'aria-hidden': true }), el('div', {}, el('strong', {}, t('foundation')), el('span', {}, t('foundationBody')))));
  root.append(el('div', { id: 'messages', 'aria-live': 'polite' }), el('main', { id: 'main' }));
  root.append(el('footer', { class: 'footer' }, el('span', {}, t('edition')), el('span', {}, '◈ ', t('assetCopy'))));
  const dialog = el('dialog', { id: 'info-dialog', class: 'info-dialog', onclose: () => { dialogKind = null; const returnId=dialogReturnFocus; dialogReturnFocus=null; if(returnId) document.getElementById(returnId)?.focus(); } });
  root.append(dialog);
}
function preference(key, checked, change) {
  return el('label', { class: 'check-label' }, el('input', { type: 'checkbox', checked, onchange: e => change(e.target.checked) }), t(key));
}
function preserveFocus(work) {
  const focused = document.activeElement;
  const id = focused?.id;
  const start = focused?.selectionStart, end = focused?.selectionEnd;
  work();
  if (id) { const target = document.getElementById(id); if (target && !target.disabled) { target.focus({ preventScroll: true }); if (typeof start === 'number' && target.setSelectionRange) { try { target.setSelectionRange(start, end); } catch {} } } }
}
function render() {
  const activeDialog = dialogKind;
  if (!scenePreview && !['identity','setup','playing','finished'].includes(view?.status)) { battlefield?.dispose(); battlefield = null; }
  preserveFocus(() => {
    applyPreferences(); shell(); renderMessages();
    if (scenePreview) renderBattlePreview();
    else if (view?.status === 'closed') renderRoom();
    else if (!session) renderEntry();
    else if (!view) $('#main').append(el('div', { class: 'loading panel' }, el('span', { class: 'spinner' }), t('syncing')), recoveryPanel());
    else renderRoom();
  });
  if (activeDialog) openDialog(activeDialog);
  updateTurnClock();
}
function renderMessages() {
  $('#messages').replaceChildren();
  if (errorKey) $('#messages').append(el('div', { class: 'message error', role: 'alert' }, el('span', {}, t(errorKey), errorCode ? ` (${errorCode})` : ''), button('close', () => { errorKey = ''; errorCode = ''; renderMessages(); }, 'text-button')));
  if (noticeKey) $('#messages').append(el('div', { class: 'message notice', role: 'status' }, t(noticeKey)));
}
function inputField(key, id, options = {}) {
  return el('label', { class: 'field', for: id }, el('span', {}, t(key)), el('input', { id, name: id, ...options }));
}
function renderEntry() {
  const nickname = inputField('nickname', 'nickname', { placeholder: t('nickPlaceholder'), maxlength: 24, autocomplete: 'nickname', required: true });
  const code = inputField('roomCode', 'room-code', { placeholder: 'ABC123', maxlength: 12, autocomplete: 'off', autocapitalize: 'characters', class: 'code-input' });
  const entryForm = el('form', { class: 'panel entry-form', onsubmit: event => { event.preventDefault(); connect('create'); } },
    el('div', { class: 'panel-eyebrow' }, t('local')), el('h2', {}, t('create')), nickname,
    el('button', { type: 'submit', class: 'button primary wide', disabled: busy }, t(busy ? 'busy' : 'create')), el('div', { class: 'or-rule' }, t('joinTitle')), code,
    preference('spectator', false, () => {}));
  const spectatorCheckbox = $('input[type="checkbox"]', entryForm); spectatorCheckbox.id = 'join-spectator';
  entryForm.append(button('join', () => connect('join'), 'button secondary wide'));
  const hero = el('section', { class: 'entry-hero' }, el('div', { class: 'hero-copy' }, el('div', { class: 'eyebrow' }, '01 / ', t('local')), el('h1', {}, t('headline')), el('p', {}, t('intro')), el('div', { class: 'hero-stats' }, el('div', {}, el('strong', {}, '2–6'), el('span', {}, t('seats'))), el('div', {}, el('strong', {}, '5 → 2'), el('span', {}, t('choose'))), el('div', {}, el('strong', {}, 'EN / 中'), el('span', {}, t('language'))))),
    el('div', { class: 'hero-art', 'aria-hidden': true }, el('div', { class: 'orbit orbit-one' }), el('div', { class: 'orbit orbit-two' }), el('div', { class: 'hero-spark spark-one' }, '✦'), el('div', { class: 'hero-spark spark-two' }, '✧'), creature('hero-creature'), el('div', { class: 'hero-platform' }), el('span', { class: 'art-label' }, t('placeholder'))));
  hero.append(button('previewBattlefield', () => { scenePreview = true; render(); }, 'button arena-preview-button'));
  $('#main').append(el('div', { class: 'entry-grid' }, hero, entryForm), el('p', { class: 'testing-note' }, t('testing')), recoveryEntry());
}
function recoveryEntry() {
  const form = el('form', { class: 'recovery-form', onsubmit: e => { e.preventDefault(); recover(); } }, inputField('roomCode', 'recover-code', { required: true, autocomplete: 'off', maxlength: 12 }), inputField('credential', 'recover-token', { type: 'password', required: true, autocomplete: 'off', spellcheck: false }), el('button', { class: 'button secondary', type: 'submit', disabled: busy }, t('recover')));
  return el('details', { class: 'panel recovery-entry' }, el('summary', {}, t('recoverTitle')), el('p', { class: 'muted' }, t('recoverCopy')), form);
}
function creature(className = '') {
  return el('div', { class: `creature ${className}`, 'aria-hidden': true }, el('div', { class: 'creature-ear left' }), el('div', { class: 'creature-ear right' }), el('div', { class: 'creature-body' }, el('span', { class: 'eye left' }), el('span', { class: 'eye right' }), el('span', { class: 'creature-cheek left' }), el('span', { class: 'creature-cheek right' })), el('div', { class: 'creature-tail' }));
}
function combatKit() { return {getView:()=>view,language,localized,partnerName,action,busy}; }
function renderRoom() {
  if (['identity','setup'].includes(view.status)) { renderArenaSetup(); return; }
  if (view.status === 'finished') { $('#main').append(worldPanel(seated(),view.selfId,null,view.settings.arena),resultPanel(view,combatKit())); return; }
  if (view.status === 'playing') { renderBattleRoom(); return; }
  const status = tag(t(view.status), `status-${view.status}`);
  const connectionTag = el('span', { class: `connection ${connected ? '' : 'interrupted'}` }, el('i', { 'aria-hidden': true }), t(view.status === 'closed' ? 'sessionEnded' : connected ? 'connection' : 'reconnecting'));
  $('#main').append(el('section', { class: 'room-heading' }, el('div', {}, el('div', { class: 'eyebrow' }, t('room')), el('div', { class: 'room-title-line' }, el('h1', { class: 'room-code' }, view.code), status, button('copyCode', () => copyText(view.code), 'button subtle small'))), el('div', { class: 'room-presence' }, connectionTag, el('span', { class: 'muted' }, ownPlayer()?.nickname || '', ' · ', t(view.self.spectator ? 'spectatorLabel' : 'you')))));
  if (view.status === 'closed') {
    $('#main').append(el('section', { class: 'panel closed-state' }, el('div', { class: 'closed-icon' }, '◈'), el('h2', {}, t(terminalReason === 'expired' ? 'expired' : 'closed')), el('p', {}, t(terminalReason === 'expired' ? 'expiredCopy' : 'closedCopy')), el('p', { class: 'muted' }, t('endReason')), button('newAdventure', clearSession, 'button primary')));
    return;
  }
  if (view.pendingVote) $('#main').append(votePanel());
  const layout = el('div', { class: 'room-layout' });
  const primary = el('div', { class: 'room-primary' });
  if (view.status === 'lobby') primary.append(lobbyPanel());
  if (view.status === 'setup') primary.append(selectionPanel());
  const side = el('aside', { class: 'room-sidebar' }, crewPanel(), logPanel(), recoveryPanel());
  if (isOwner()) side.append(controlPanel());
  layout.append(primary, side); $('#main').append(layout);
}
function crewPanel() {
  const players = seated();
  const list = el('div', { class: 'crew-list' });
  for (const player of players) {
    const state = view.status === 'lobby' ? (player.ready ? 'ready' : 'notReady') : (view.status === 'setup' ? (player.setupComplete ? 'chosen' : 'choosing') : (view.turn?.playerId === player.id ? 'theirTurn' : null));
    list.append(el('div', { class: `crew-row ${player.id === view.selfId ? 'self' : ''}` }, el('div', { class: 'avatar', 'aria-hidden': true }, Array.from(player.nickname || '?')[0]),
      el('div', { class: 'crew-person' }, el('strong', {}, player.nickname, player.id === view.selfId ? ` · ${t('you')}` : ''), el('span', { class: player.connected ? 'muted' : 'offline-label' }, !player.connected ? t('offline') : state ? t(state) : `${player.handCount} ${t('cards')}`), view.gameMode === 'combat-preview' ? el('span',{},roleName(player.id===view.selfId?view.self.role:player.role,language),player.eliminated?` · ${t('eliminated')}`:'') : null, player.reserve ? el('span', {class:'revealed-reserve'}, `${t('publicReserve')}: ${partnerName(player.reserve.catalogueId,player.reserve.level)} · ${player.reserve.level}`) : null), player.id === view.ownerId ? tag(t('owner'), 'owner-tag') : null));
  }
  const watchers = view.players.filter(p => p.spectator);
  return el('section', { class: 'panel crew-panel' }, el('div', { class: 'section-heading' }, el('h2', {}, t('crew')), tag(`${players.length} / 6`)), list, el('div', { class: 'spectator-list' }, el('span', {}, t('spectators'), ` · ${watchers.length}`), watchers.length ? el('span', { class: 'muted' }, watchers.map(p => p.nickname).join(' · ')) : null));
}
function lobbyPanel() {
  const panel = el('section', { class: 'panel lobby-panel' }, el('div', { class: 'eyebrow' }, '02 / ', t('lobby')), el('h2', { class: 'large-heading' }, t(view.self.spectator ? 'watch' : 'arenaTitle')), el('p', { class: 'muted' }, t(view.self.spectator ? 'watchCopy' : 'startHelp')));
  if (!settingsDraft) settingsDraft = { ...view.settings };
  const settings = isOwner() ? settingsDraft : view.settings;
  const arenas = el('div', { class: 'arena-options' });
  for (const [index, arena] of ['stadium', 'gym', 'floating'].entries()) arenas.append(el('button', { id: `arena-${arena}`, type: 'button', class: `arena-option theme-${arena} ${settings.arena === arena ? 'selected' : ''}`, disabled: busy || !isOwner(), 'aria-pressed': settings.arena === arena, onclick: () => { settingsDraft.arena = arena; render(); } }, el('div', { class: 'arena-thumbnail', 'aria-hidden': true }, el('span', { class: 'mini-orb' }), el('span', { class: 'mini-platform' })), el('span', { class: 'arena-number' }, `0${index + 1}`), el('strong', {}, t(arena)), el('span', {}, t(`${arena}Desc`)), settings.arena === arena ? el('span', { class: 'selected-tick', 'aria-hidden': true }, '✓') : null));
  panel.append(arenas);
  const timers = el('div', { class: 'timer-grid' });
  const turnEnabled = Number(settings.turnSeconds) > 0;
  const turnToggle = preference('turnTimerEnabled', turnEnabled, enabled => {
    if (Number(settingsDraft.turnSeconds) >= 5) turnTimerDefault = Number(settingsDraft.turnSeconds);
    settingsDraft.turnSeconds = enabled ? turnTimerDefault : 0; render();
  });
  $('input', turnToggle).disabled = busy || !isOwner();
  timers.append(el('div', {class:'turn-timer-setting'}, turnToggle, inputField('turnTimer', 'turnSeconds', {type:'number', value:settings.turnSeconds, min:5, max:600, step:1, disabled:busy || !isOwner() || !turnEnabled, oninput:event => { settingsDraft.turnSeconds = event.target.value; }})),
    inputField('responseTimer', 'responseSeconds', {type:'number', value:settings.responseSeconds, min:0, max:600, step:1, disabled:busy || !isOwner(), oninput:event => { settingsDraft.responseSeconds = event.target.value; }}));
  panel.append(timers, el('p', { class: 'inline-note' }, '◷ ', t('timerHelp')));
  if (isOwner()) panel.append(button('saveSettings', saveSettings, 'button secondary'));
  const allReady = seated().length >= 2 && seated().length <= 6 && seated().every(p => p.ready);
  const launch = el('div', { class: 'launch-row' });
  if (!view.self.spectator) launch.append(button(ownPlayer()?.ready ? 'unready' : 'readyButton', () => action('ready', { ready: !ownPlayer()?.ready }), ownPlayer()?.ready ? 'button secondary' : 'button primary'));
  // The player-facing start follows identity → five private draws → partner choice.
  if (isOwner()) launch.append(button('startBattlePreview',()=>askConfirmation('combatFixture',()=>action('startBattlePreview')),'button primary',!allReady||seated().length<3));
  panel.append(launch, el('p', { class: 'testing-note compact' }, t('combatFixture')), el('p', { class: 'testing-note compact' }, t('testing')));
  return panel;
}
function renderArenaSetup() {
  const main=$('#main'), identity=view.status==='identity';
  const count=seated().filter(p=>identity?p.identityAcknowledged:p.setupComplete).length;
  main.append(worldPanel(seated(),view.selfId,null,view.settings.arena));
  main.append(el('div',{class:'battle-hud'},el('div',{},el('span',{class:'hud-kicker'},`${t('room')} ${view.code} / ${t(identity?'identityStep':'pokemonStep')}`),el('h1',{},t(identity?'identityTitle':'combatPickTitle')),el('p',{class:'setup-progress'},`${t(identity?'identityProgress':'selectionProgress')} · ${count} / ${seated().length}`)),tag(t(connected?'connection':'reconnecting'))));
  main.append(cameraControls(),el('details',{class:'battle-menu'},el('summary',{},t('arenaMenu')),el('div',{class:'battle-menu-body'},crewPanel(),logPanel(),recoveryPanel(),isOwner()?controlPanel():null)));
  if (identity) {
    const panel=el('section',{class:'arena-identity'},el('h2',{},t('identityTitle')),el('p',{},t('identityHelp')));
    if (!view.self.spectator) panel.append(el('div',{class:'identity-card'},el('small',{},t('privateBadge')),el('strong',{},roleName(view.self.role,language))),view.self.identityAcknowledged?el('p',{},t('identityWaiting')):button('identitySeen',()=>action('acknowledgeIdentity'),'button primary',Boolean(view.pendingVote),{id:'acknowledge-identity'}));
    else panel.append(el('p',{},t('identityWaiting')));
    main.append(panel);
  } else main.append(selectionPanel());
  if(view.pendingVote) main.append(el('div',{class:'world-vote'},votePanel()));
}
function selectionPanel() {
  if (view.self.spectator) return el('section', { class: 'panel spectator-panel arena-selection' }, creature('small-creature'), el('div', { class: 'eyebrow' }, t('spectatorLabel')), el('h2', {}, t('watch')), el('p', { class: 'muted' }, t('watchCopy')));
  if (ownPlayer()?.setupComplete) return el('section', { class: 'panel selection-panel waiting arena-selection' }, creature('small-creature'), el('h2', {}, t('waitingPick')), el('p', { class: 'muted' }, t('waitingPickCopy')), privateReserve());
  selected = selected.filter(id => view.self.candidates.includes(id));
  const cards = el('div', { class: 'candidate-grid' });
  const remaining=view.self.pokemonDrawRemaining || 0;
  const expected=view.scenario?.candidateCount || 5;
  for (const [index, id] of view.self.candidates.entries()) {
    const position = selected.indexOf(id);
    const entry = catalogueEntry(id);
    const hpTrack = el('div', { class:'candidate-hp-track', 'aria-label':t('hp') });
    for (const face of entry?.levels || []) hpTrack.append(el('span', {class:'candidate-hp-step'}, el('small', {}, `${t('level')} ${face.level}`), el('strong', {}, `${face.hp} ♥`)));
    const choosePartner=()=>{selected=position>=0?selected.filter(item=>item!==id):[...selected,id];render();};
    const card=el('button', {id:`candidate-${id}`,type:'button',class:`partner-card candidate-card hue-${index%5} ${position>=0?'picked':''}`,'aria-haspopup':'dialog','aria-label':`${partnerName(id)} · ${t('inspectPokemon')}`,onclick:()=>openPokemonDetails(id,1,`candidate-${id}`)},
      el('div', {class:'card-topline'},el('span',{class:'candidate-number','aria-hidden':'true'},String(index+1).padStart(2,'0')),el('span',{class:'candidate-form'},`${t('level')} 1`),el('span',{class:'candidate-check','aria-hidden':'true'},position>=0?'✓':'○')),
      el('strong',{class:'partner-name'},partnerName(id)),
      el('div',{class:'card-projection'},el('span',{class:'portrait-orbit','aria-hidden':'true'}),entry?.portraitImage?.url?el('img',{src:entry.portraitImage.url,alt:partnerName(id),loading:'eager',draggable:false}):creature()),
      hpTrack,el('span',{class:'candidate-details-space'},t('hoverPokemonHint')),el('span',{class:'pick-role','aria-hidden':'true'},'\u00a0'));
    const choose=el('button',{type:'button',id:`choose-${id}`,class:`candidate-choose ${position>=0?'chosen-partner':''}`,'aria-pressed':position>=0,disabled:busy||Boolean(view.pendingVote)||remaining>0||(selected.length>=2&&position<0),onclick:choosePartner},position===0?`① ${t('active')}`:position===1?`② ${t('reserve')}`:`+ ${t('choose')}`);
    const tile=el('article',{class:'candidate-tile',onpointerenter:event=>showPokemonHover(id,event.currentTarget),onpointerleave:event=>schedulePokemonHoverHide(event.currentTarget,'pointer'),onfocusin:event=>showPokemonHover(id,event.currentTarget),onfocusout:event=>{if(!event.currentTarget.contains(event.relatedTarget))schedulePokemonHoverHide(event.currentTarget,'focus');},onkeydown:event=>{if(event.key==='Escape'){hidePokemonHover(event.currentTarget);event.stopPropagation();}}},card,choose);
    cards.append(tile);

  }
  for(let index=view.self.candidates.length;index<expected;index++) cards.append(el('article',{class:'pokemon-card-back','aria-label':t('unseenCandidate')},el('span',{'aria-hidden':'true'},'?'),el('small',{},t('unseenCandidate'))));
  return el('section', { class: 'panel selection-panel arena-selection' }, el('div', { class: 'eyebrow' }, '03 / ', t('pickEyebrow')), el('h2', { class: 'large-heading' }, t(view.gameMode==='combat-preview'?'combatPickTitle':'pickTitle')), el('p', { class: 'muted' }, t(view.gameMode==='combat-preview'?'combatPick':'pickCopy')), view.self.role ? tag(`${t('yourRole')}: ${roleName(view.self.role,language)}`) : null, tag(t('privateBadge'), 'private-tag'),
    remaining>0?el('div',{class:'candidate-draw'},button('drawPokemon',()=>action('drawPokemon'),'button primary',Boolean(view.pendingVote),{id:'draw-pokemon'}),el('span',{},`${view.self.candidates.length} / ${expected} · ${t('cardsDrawn')}`),el('small',{},t('drawPokemonFirst'))):null, cards,
    el('div', { class: 'selection-summary' }, el('div', {}, el('span', {}, `① ${t('active')}`), el('strong', {}, selected[0] ? partnerName(selected[0]) : '—')), el('div', {}, el('span', {}, `② ${t('reserve')}`), el('strong', {}, selected[1] ? partnerName(selected[1]) : '—'))),
    el('div', { class: 'action-row' }, button('confirmPick', () => action('selectPokemon', { activeId: selected[0], reserveId: selected[1] }), 'button primary', selected.length !== 2 || remaining>0 || Boolean(view.pendingVote)), button('clearPick', () => { selected = []; render(); }, 'button subtle', !selected.length)), el('p', { class: 'inline-note' }, t(view.gameMode==='combat-preview'?'combatFixture':'fixture')));
}
function worldPanel(players, viewerId, turnId, theme) {
  const host=el('section', {class:`world-host world-${theme}`, 'data-mode':'flat', 'aria-label':t(theme)});
  const labels=el('div',{class:'world-labels'});
  const layout=seatLayout(players,viewerId);
  for(const [index,player] of players.entries()) {
    const position=layout[index], own=player.id===viewerId;
    const label=el('article',{class:`world-seat ${player.id===turnId?'world-active':''} ${own?'world-self':''}`, 'data-seat-id':player.id},
      el('div',{class:'world-seat-top'},el('strong',{},player.nickname),el('span',{},own?t('you'):`${String(index+1).padStart(2,'0')}`)),
      el('div',{class:'world-seat-bottom'},el('span',{title:player.reserve?`${t('publicReserve')}: ${partnerName(player.reserve.catalogueId,player.reserve.level)} · ${player.reserve.level}`:player.active?`${t('level')} ${player.active.level}`:null},player.active?el('button',{type:'button',class:'pokemon-name-button',id:`active-details-${player.id}`,title:t('inspectPokemon'),onclick:()=>openPokemonDetails(player.active.catalogueId,player.active.level,`active-details-${player.id}`)},`${partnerName(player.active.catalogueId,player.active.level)} · ${player.active.level}`):view.status==='identity'?roleName(player.id===view.selfId?view.self.role:player.role,language):view.status==='setup'?t(player.setupComplete?'chosen':'choosing'):t('noActive')),el('small',{},view.status==='setup'?`${player.candidateDrawCount ?? 0} / 5`:view.status==='identity'?(player.identityAcknowledged?'✓':'—'):`${player.handCount} ${t('cards')}`)));
    label.style.left=`${50+Math.sin(position.angle)*34}%`; label.style.top=`${49+Math.cos(position.angle)*33}%`;
    if(player.active?.item)label.append(el('small',{class:'world-held-item'},localized(player.active.item.name),player.active.itemSuppressed?` · ${t('itemSuppressed')}`:''));
    if(player.active?.reinforcements?.length) {
      const names={power:language==='zh'?'力量强化':'Power',defense:language==='zh'?'防御强化':'Defense',speed:language==='zh'?'速度强化':'Speed'};
      label.append(el('small',{class:'world-reinforcements'},player.active.reinforcements.map(kind=>names[kind]||kind).join(' · '),player.active.status==='paralysis'?(language==='zh'?' · 不生效':' · inactive'):''));
    }
    if (Number.isFinite(player.active?.hp)) label.append(el('div',{class:'world-health'},`${player.active.hp}/${player.active.maxHp} HP`,player.active.status?` · ${statusName(player.active.status,language)}`:'',player.active.damageProtected?` · ${t('damageProtected')}`:'',player.eliminated?` · ${t('eliminated')}`:''));
    labels.append(label);
  }
  host.append(el('div',{class:'flat-field','aria-hidden':'true'},el('div',{class:'field-centre'})),labels,
    el('span',{class:'renderer-status'},t('fallbackView')),el('span',{class:'model-note'},t('worldPlaceholder')));
  if(richGraphics) queueMicrotask(async()=>{
    try {
      const {createBattlefield}=await import('./battlefield.js');
      if(!host.isConnected || !richGraphics)return;
      battlefield??=createBattlefield();
      battlefield.mount(host,{players:players.map(p=>({id:p.id})),viewerId,turnId,theme,camera:cameraMode,reducedMotion});
    } catch { host.dataset.mode='flat'; host.dataset.reason='webgl'; battlefield?.dispose(); battlefield=null; }
  });
  else { battlefield?.dispose(); battlefield=null; }
  return host;
}
function cameraControls() {
  return el('div',{class:'camera-controls'},button('tableCamera',()=>{cameraMode='table';render();},`button ${cameraMode==='table'?'selected':''}`),button('overheadCamera',()=>{cameraMode='overhead';render();},`button ${cameraMode==='overhead'?'selected':''}`));
}
function renderBattleRoom() {
  const current=view.players.find(p=>p.id===view.turn?.playerId);
  const main=$('#main');
  main.append(worldPanel(seated(),view.selfId,view.turn?.playerId,view.settings.arena));
  main.append(el('div',{class:'battle-hud'},el('div',{},el('span',{class:'hud-kicker'},`${t('room')} ${view.code} / ${t('round')} ${view.turn?.number}${view.gameMode==='combat-preview'?` · ${t('combatPreview')}`:''}`),el('h1',{},myTurn()?t('currentTurn'):`${current?.nickname||'—'} · ${t('theirTurn')}`),phaseStrip()),tag(t(connected?'connection':'reconnecting'))));
  main.append(cameraControls());
  const menu=el('details',{class:'battle-menu'},el('summary',{},t('arenaMenu')),el('div',{class:'battle-menu-body'},crewPanel(),logPanel(),recoveryPanel(),isOwner()?controlPanel():null));
  main.append(menu);
  if(view.pendingBattle) main.append(decisionPanel(view,combatKit()));
  if(view.pendingVote) main.append(el('div',{class:'world-vote'},votePanel()));
  if(view.self.spectator) main.append(el('div',{class:'spectator-caption'},t('watchCopy')));
  else {
    main.append(handPanel());
    main.append(el('div',{class:'battle-actions'},el('p',{},phaseHint()),
      view.self.battle?.canGive ? button('giveCards',()=>giftCardsDialog(combatKit()),'button secondary trait-control') : null,
      view.self.battle?.canTrait ? (view.self.battle.trait?.kind==='analytic'?el('button',{type:'button',class:'button secondary trait-control',disabled:busy||Boolean(view.pendingVote),onclick:()=>analyticDialog(combatKit())},language==='zh'?'发动分析':'Use Analytic'):view.self.battle.trait?.kind==='harvest'?el('button',{type:'button',class:'button secondary trait-control',disabled:busy||Boolean(view.pendingVote),onclick:()=>action('useTrait')},language==='zh'?'发动收获':'Use Harvest'):button('useTrait',()=>action('useTrait'),'button secondary trait-control')) : null,
      turnPhase() === 'play' ? button(view.turn.switchUsed?'switchUsed':'switchPokemon',confirmPartnerSwitch,'button secondary switch-control',!myTurn()||view.turn.switchUsed||!view.self.reserve||(view.gameMode==='combat-preview'&&!view.self.battle?.canSwitch)) : null,
      turnPhase() === 'play' ? button('finishPlay',()=>action('finishPlay'),'button primary',!myTurn()) : button('draw',()=>action('draw'),'button primary',!myTurn()||turnPhase()!=='draw'||view.turn.drawRemaining<=0),
      button('endTurn',confirmTurnEnd,'button secondary',!myTurn()||turnPhase()!=='end')));
  }
}
function renderBattlePreview() {
  const ids=['pikachu','charmander','squirtle','bulbasaur','vulpix','mankey'];
  const players=ids.map((id,i)=>({id:`preview-${i}`,nickname:i===0?t('you'):`${t('previewPlayer')} ${i+1}`,handCount:4,active:{catalogueId:id,level:1}}));
  $('#main').append(worldPanel(players,'preview-0','preview-0',previewTheme),
    el('div',{class:'battle-hud'},el('div',{},el('span',{class:'hud-kicker'},t('visualPreview')),el('h1',{},t(previewTheme))),button('newAdventure',()=>{scenePreview=false;render();},'button secondary')),
    cameraControls(),el('div',{class:'preview-themes'},...['stadium','gym','floating'].map(theme=>button(theme,()=>{previewTheme=theme;render();},`button ${previewTheme===theme?'selected':''}`))),
    el('div',{class:'preview-hand'},...Array.from({length:4},(_,i)=>el('div',{class:'preview-slot'},el('small',{},`0${i+1}`),el('span',{},t('previewCard'))))),
    el('p',{class:'preview-caption'},t('previewNotice')));
}
function privateReserve() {
  const revealed = Boolean(ownPlayer()?.reserve);
  return el('div', { class: 'reserve-box' }, el('span', { class: 'private-lock', 'aria-hidden': true }, '◇'), el('div', {}, el('small', {}, t(revealed?'publicReserve':'reserve')), view.self.reserve ? el('button',{type:'button',id:'reserve-details',class:'pokemon-name-button',title:t('inspectPokemon'),onclick:()=>openPokemonDetails(view.self.reserve.catalogueId,view.self.reserve.level,'reserve-details')},`${partnerName(view.self.reserve.catalogueId, view.self.reserve.level)} · ${view.self.reserve.level}`) : el('strong',{},'—'),view.self.reserve?.item?el('small',{},`${t('reserveItem')}: ${localized(view.self.reserve.item.name)}`):null), tag(t(revealed?'publicReserve':'privateBadge'), 'private-tag'));
}
function handPanel() {
  const canDiscard = myTurn() && turnPhase() === 'discard' && view.self.hand.length > ownHandLimit();
  const cards = el('div', { class: 'hand-cards' });
  for (const [index, card] of view.self.hand.entries()) {
    const commandMoves=(view.self.battle?.moves||[]).filter(move=>move.condition?.kind==='command');
    const use=card.kind==='command'?commandMoves.map(move=>{
      const blocked=!move.canUse||(ownPlayer()?.active?.status==='paralysis'&&!['intense-sun','clear'].includes(card.weather));
      return commandMoves.length===1?button('playMove',()=>attackDialog(card,combatKit(),move.index),'button card-play',blocked):el('button',{type:'button',class:'button card-play',disabled:busy||blocked,onclick:()=>attackDialog(card,combatKit(),move.index)},`${language==='zh'?'使用':'Use '}${localized(move.name)}`);
    }):null;
    const weatherUses=(view.self.battle?.moves||[]).filter(move=>move.condition?.kind==='weather-card'&&move.condition.weatherIconsInCondition.includes(card.weather)).map(move=>el('button',{type:'button',class:'button card-play',disabled:busy||!move.canUse,onclick:()=>attackDialog(card,combatKit(),move.index)},`${language==='zh'?'使用':'Use '}${localized(move.name)}`));
    cards.append(el('article', { class: 'hand-card' }, el('div', { class: 'hand-card-symbol', 'aria-hidden': true }, card.kind==='dodge'?'◇':'✦'), el('span', { class: 'hand-card-number' }, String(index + 1).padStart(2, '0')), el('strong', {}, localized(card.name)), card.kind==='held-item'&&card.itemType==='rocky-helmet'?button('equipItem',()=>equipItemDialog(card,combatKit()),'button card-play',!view.self.battle?.canEquip):null, card.weather?el('small',{class:'hand-card-weather'},weatherLabel(card.weather,language)):null, use, weatherUses, button('discard', () => action('discard', { cardId: card.id }), 'button card-discard', !canDiscard, { id: `discard-${card.id}` })));
  }
  return el('section', { class: 'panel hand-panel' }, el('div', { class: 'section-heading' }, el('h2', {}, t('handTitle')), view.self.role ? el('small',{class:'own-role'},`${t('yourRole')}: ${roleName(view.self.role,language)}`) : null, tag(`${view.self.hand.length} / ${ownHandLimit()===Infinity?'∞':ownHandLimit()}`, view.self.hand.length > ownHandLimit() ? 'warning-tag' : 'private-tag'),view.self.exiledCount?el('small',{class:'exiled-count'},`${language==='zh'?'暂时移出':'Removed'}: ${view.self.exiledCount}`):null), el('p', { class: 'muted' }, t(view.gameMode==='combat-preview'?'combatPreview':'handFixture')), cards, el('p', { class: `hand-hint ${canDiscard ? 'warning-text' : ''}` }, phaseHint()), privateReserve());
}
function logPanel() {
  const list = el('ol', { class: 'activity-list' });
  for (const item of view.log.slice(-8).reverse()) list.append(el('li', {}, el('span', { class: 'log-dot', 'aria-hidden': true }), el('span', {}, localized(item.text))));
  if (!view.log.length) list.append(el('li', { class: 'muted' }, t('logEmpty')));
  return el('section', { class: 'panel log-panel' }, el('h2', {}, t('log')), list);
}
function recoveryPanel() {
  const tokenInput = el('input', { id: 'private-credential', type: credentialVisible ? 'text' : 'password', value: session?.token || '', readonly: true, autocomplete: 'off', spellcheck: false, 'aria-label': t('credential') });
  const details = el('details', { class: 'panel recovery-panel' }, el('summary', {}, t('privacy')), el('p', { class: 'muted' }, t('privacyText')), el('label', { class: 'field' }, el('span', {}, t('roomCode')), el('input', { readonly: true, value: session?.code || '', 'aria-label': t('roomCode') })), tokenInput,
    el('div', { class: 'recovery-buttons' }, button(credentialVisible ? 'hide' : 'reveal', () => { credentialVisible = !credentialVisible; tokenInput.type = credentialVisible ? 'text' : 'password'; const toggle = $('.reveal-button', details); toggle.textContent = t(credentialVisible ? 'hide' : 'reveal'); }, 'text-button reveal-button'), button('copyCredential', () => copyText(session.token), 'text-button')),
    el('p', { class: 'muted small-copy' }, t('disconnectHelp')), button('disconnect', () => askConfirmation('leaveConfirm', clearSession), 'text-button danger-text'));
  return details;
}
function controlPanel() {
  const voting = !!view.pendingVote;
  return el('section', { class: 'panel control-panel' }, el('h2', {}, t('control')), view.status !== 'lobby' ? button('endGame', () => askConfirmation('endGameConfirm', () => action('requestEndGame')), 'button subtle wide', voting) : null, button(view.status === 'lobby' ? 'endRoomLobby' : 'endRoom', () => askConfirmation('endRoomConfirm', () => action('requestEndRoom')), 'button danger wide', voting));
}
function votePanel() {
  const vote = view.pendingVote;
  const required = vote.requiredIds.includes(view.selfId);
  const approved = vote.approvedIds.includes(view.selfId);
  return el('section', { class: 'panel vote-panel', role: 'region', 'aria-label': t(vote.kind === 'endGame' ? 'voteGame' : 'voteRoom') }, el('div', {}, el('div', { class: 'eyebrow' }, t('control')), el('h2', {}, t(vote.kind === 'endGame' ? 'voteGame' : 'voteRoom')), el('p', {}, t('voteCopy')), el('div', { class: 'vote-members' }, vote.requiredIds.map(id => tag(`${view.players.find(p => p.id === id)?.nickname || '—'} · ${t(vote.approvedIds.includes(id) ? 'approved' : 'awaiting')}`, vote.approvedIds.includes(id) ? 'private-tag' : '')))),
    required ? el('div', { class: 'action-row' }, button(approved ? 'approved' : 'approve', () => action('approveEnd'), 'button primary', approved), button('reject', () => action('rejectEnd'), 'button secondary')) : el('p', { class: 'muted' }, t('voteWaiting')));
}
const hoverCloseTimers=new WeakMap();
function schedulePokemonHoverHide(tile,reason) {
  clearTimeout(hoverCloseTimers.get(tile));
  hoverCloseTimers.set(tile,setTimeout(()=>{if(reason==='pointer'?!tile.matches(':hover'):!tile.contains(document.activeElement))hidePokemonHover(tile);},180));
}
function hidePokemonHover(tile) {
  clearTimeout(hoverCloseTimers.get(tile));
  const preview=tile?.querySelector('.pokemon-hover-preview');
  if(preview){preview.classList.remove('pokemon-hover-preview');preview.remove();}
}
function showPokemonHover(id,tile) {
  clearTimeout(hoverCloseTimers.get(tile));
  if(document.querySelector('dialog[open]')||tile.querySelector('.pokemon-hover-preview'))return;
  const entry=catalogueEntry(id);if(!entry)return;
  // One visible preview; all content comes from the already public reference data.
  document.querySelectorAll('.pokemon-hover-preview').forEach(node=>hidePokemonHover(node.parentElement));
  const preview=el('section',{class:'pokemon-hover-preview',onpointerenter:()=>clearTimeout(hoverCloseTimers.get(tile)),role:'group','aria-label':`${partnerName(id)} · ${t('evolutionLine')}`},
    el('div',{class:'hover-preview-heading'},el('strong',{},`${partnerName(id)} · ${t('evolutionLine')}`),el('small',{},t('levelPreviewHelp'))),
    el('div',{class:'hover-level-grid'},...entry.levels.map(face=>el('button',{type:'button',id:`hover-${id}-${face.level}`,class:'hover-level-card','aria-haspopup':'dialog',onclick:()=>{hidePokemonHover(tile);openPokemonDetails(id,face.level,`candidate-${id}`);}},
      el('div',{class:'hover-level-top'},el('small',{},`${t('level')} ${face.level}`),el('strong',{},`${face.hp} ♥`)),
      el('strong',{class:'hover-form-name'},localized(face.name)),
      el('img',{src:face.portraitImage?.url||entry.portraitImage?.url,alt:localized(face.name),draggable:false}),
      el('strong',{class:'hover-trait-name'},face.traitName?localized(face.traitName):t('traitLabel')),
      el('p',{class:'hover-ability-copy'},face.abilityText?localized(face.abilityText):t('abilityPending')),
      el('span',{class:'hover-level-details'},t('inspectLevel'))
    ))));
  tile.append(preview);

}
function openPokemonDetails(id, level=1, returnId=null) {
  if (!catalogueEntry(id)) return;
  dialogReturnFocus=returnId;
  openDialog(`pokemon:${id}:${level}`);
}
function moveCostText(move) {
  if(move.condition?.kind==='command')return t('commandCost');
  if(move.condition?.kind==='weather-card' && move.condition.weatherIconsInCondition?.every(weather=>['intense-sun','clear'].includes(weather)))return language==='zh'?'弃置1张晴天天气手牌（烈日或晴朗）':'Discard 1 sunny-weather hand card (intense sun or clear)';
  if(move.condition?.kind==='weather-card' && move.condition.weatherIconsInCondition?.every(weather=>['rain','thunderstorm'].includes(weather)))return language==='zh'?'弃置1张雨天天气手牌（暴雨或雷雨）':'Discard 1 rainy-weather hand card (heavy rain or thunderstorm)';
  return language==='zh'?'招式条件待复核':'Move condition pending review';
}
function pokemonDetails(entry, selectedLevel) {
  const face=entry.levels.find(item=>item.level===selectedLevel)||entry.levels[0];
  const tabs=el('div',{class:'pokemon-level-tabs',role:'tablist','aria-label':t('evolutionLine')});
  for(const item of entry.levels) tabs.append(el('button',{type:'button',role:'tab',id:`pokemon-tab-${item.level}`,'aria-selected':item.level===face.level,'aria-controls':'pokemon-level-panel',tabindex:item.level===face.level?0:-1,onclick:()=>{openDialog(`pokemon:${entry.id}:${item.level}`); document.getElementById(`pokemon-tab-${item.level}`)?.focus();},onkeydown:event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault(); const levels=entry.levels.map(f=>f.level),index=levels.indexOf(item.level);
    const next=event.key==='Home'?levels[0]:event.key==='End'?levels.at(-1):levels[(index+(event.key==='ArrowRight'?1:-1)+levels.length)%levels.length];
    openDialog(`pokemon:${entry.id}:${next}`);document.getElementById(`pokemon-tab-${next}`)?.focus();
  }},el('small',{},`${t('level')} ${item.level}`),el('strong',{},localized(item.name)),el('span',{},`${item.hp} ${t('hp')}`)));
  const portrait=face.portraitImage?.url||(face.level===1?entry.portraitImage?.url:null);
  const panel=el('section',{class:'pokemon-level-panel',id:'pokemon-level-panel',role:'tabpanel','aria-labelledby':`pokemon-tab-${face.level}`},
    el('div',{class:'pokemon-form-heading'},el('div',{},el('small',{},`${t('level')} ${face.level}`),el('h3',{},localized(face.name))),el('strong',{class:'pokemon-hp-badge'},`${face.hp} ♥ ${t('hp')}`)),
    portrait?el('div',{class:'pokemon-detail-portrait'},el('img',{src:portrait,alt:localized(face.name)})):null,
    el('section',{class:'pokemon-ability-section'},el('small',{class:'pokemon-section-label'},t('traitLabel')),el('h4',{},face.traitName?localized(face.traitName):t('abilityPending')),face.abilityText?el('p',{},localized(face.abilityText)):null),
    el('section',{class:'pokemon-moves-section'},el('small',{class:'pokemon-section-label'},t('movesLabel')),
      ...(face.moves?.length?face.moves.map(move=>el('article',{class:'pokemon-move'},el('div',{class:'pokemon-move-heading'},el('h4',{},localized(move.name)),move.printedValue!=null?tag(`${t('printedValue')} ${move.printedValue}`):null),
        el('small',{},moveCostText(move)),
        el('p',{},move.effectParagraphStatus==='none-printed'?(language==='zh'?'此招式没有额外的效果段落。':'No additional printed effect.'):move.effectText?localized(move.effectText):t('movesPending')),
        ...(move.unresolvedSymbols||[]).map(symbol=>el('p',{class:'pokemon-uncertainty'},localized(symbol)))
      )):[el('p',{class:'muted'},t('movesPending'))])),
    el('p',{class:'pokemon-effect-status'},t(face.effectStatus==='combat-preview'?'previewEffects':'effectsPending')));
  return [el('p',{class:'pokemon-detail-help'},t('abilityHelp')),tabs,panel];
}
function openDialog(kind) {
  const dialog = $('#info-dialog');
  dialogKind = kind;
  const detailMatch=/^pokemon:([a-z0-9-]+):([1-3])$/.exec(kind);
  const detailEntry=detailMatch?catalogueEntry(detailMatch[1]):null;
  dialog.classList.toggle('pokemon-dialog',Boolean(detailEntry));
  const closeButton = button('close', () => dialog.close(), 'button subtle small');
  dialog.replaceChildren(el('div', { class: 'dialog-heading' }, el('div', {}, el('div', { class: 'eyebrow' }, t('brand')), el('h2', {}, detailEntry?localized(detailEntry.name):t(kind === 'catalogue' ? 'guideTitle' : 'rulesTitle'))), closeButton));
  if(detailEntry) dialog.append(...pokemonDetails(detailEntry,Number(detailMatch[2])));
  else if (kind === 'rules') dialog.append(el('div', { class: 'rules-content' }, ...['rules1', 'rules2', 'rules3', 'rules4', 'rules5', 'rules6'].map((key, index) => el('section', {}, el('span', { class: 'rule-number' }, String(index + 1).padStart(2, '0')), el('p', {}, t(key))))));
  else {
    const search = el('input', { type: 'search', id: 'catalogue-search', placeholder: t('search'), 'aria-label': t('search') });
    const results = el('div', { class: 'catalogue-results' });
    const renderResults = () => {
      const query = search.value.trim().toLocaleLowerCase();
      const filtered = catalogue.filter(entry => `${entry.id} ${localized(entry.name)} ${entry.name?.en || ''} ${entry.name?.zh || ''}`.toLocaleLowerCase().includes(query));
      results.replaceChildren(...filtered.map(entry => el('article', { class: 'catalogue-entry' }, el('h3', {}, localized(entry.name)),button('inspectPokemon',()=>openPokemonDetails(entry.id),'button subtle small'), ...entry.levels.map(level => el('div', { class: 'catalogue-level' }, el('strong', {}, `${t('level')} ${level.level} · ${localized(level.name)}`), el('span', {}, level.hp != null ? `${level.hp} ${t('hp')}` : t('unknownHp')), el('small', {}, `${t('evidence')}: ${evidenceText(level.evidenceStatus)}`), el('p', {}, level.abilityText ? `${localized(level.traitName)}: ${localized(level.abilityText)}` : t('abilityPending')), ...(level.moves || []).map(move => el('div', {class:'reference-move'}, el('strong', {}, localized(move.name)), el('small', {}, `${moveCostText(move)} · ${t('printedValue')}: ${move.printedValue ?? '—'}`), move.effectText ? el('p', {}, localized(move.effectText)) : null, ...(move.unresolvedSymbols || []).map(symbol => el('p', {class:'muted'}, localized(symbol))))), level.engineEligible === false ? el('small', {}, t(level.effectStatus==='combat-preview'?'previewEffects':'referenceOnly')) : null)))));
      if (!filtered.length) results.append(el('p', { class: 'muted' }, t('noResults')));
    };
    search.addEventListener('input', renderResults); renderResults();
    dialog.append(el('p', { class: 'muted' }, t('guideCopy')), search, results);
  }
  if (!dialog.open) dialog.showModal();
  closeButton.focus();
}
function evidenceText(status) {
  if (typeof status === 'object') return localized(status);
  const labels = { verified: ['Verified', '已核实'], partial: ['Partially verified', '部分核实'], pending: ['Pending verification', '待核实'], unverified: ['Unverified', '未核实'], 'source-backed': ['Source-backed', '有来源支持'], 'name-hp-only': ['Name / HP only', '仅名称及生命值'], 'partial-evidence': ['Partial evidence', '部分证据'], 'pending-verification': ['Pending verification', '待核实'] };
  return labels[status]?.[language === 'zh' ? 1 : 0] || (language === 'zh' ? '证据待整理' : 'Evidence review pending');
}
async function api(path, { method = 'GET', body, token = session?.token } = {}) {
  let response;
  try { response = await fetch(path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); }
  catch { throw { network: true }; }
  let data;
  try { data = await response.json(); } catch { throw { status: response.status, code: 'INVALID_RESPONSE' }; }
  if (!response.ok) throw { status: response.status, code: typeof data.code === 'string' ? data.code : undefined };
  return data;
}
function setView(next, force = false) {
  if (!next || typeof next !== 'object') throw { code: 'INVALID_RESPONSE' };
  if (view?.code === next.code && next.revision < view.revision) return;
  if (view?.status !== next.status) { selected = []; settingsDraft = null; }
  if (view?.settings && JSON.stringify(view.settings) !== JSON.stringify(next.settings)) settingsDraft = null;
  view = next;
  sampleTurnClock(next);
  const {serverNow, ...stableView} = view;
  if (stableView.turn?.clock?.deadlineAt != null) {
    const {remainingMs, ...stableClock} = stableView.turn.clock;
    stableView.turn = {...stableView.turn, clock:stableClock};
  }
  const nextSignature = JSON.stringify({ view:stableView, language, busy, connected });
  if (nextSignature !== signature || force) { signature = nextSignature; render(); }
  else updateTurnClock();
}
function showError(error) {
  const mapped = { POKEMON_DRAW_EXHAUSTED:'drawPokemonFirst', CANDIDATE_DRAW_INCOMPLETE:'drawPokemonFirst', IDENTITY_ALREADY_SEEN:'identityWaiting', CONTENT_UNAVAILABLE:'genericError', RESPONSE_PENDING:'responsePending', STALE_DECISION:'stale', NOT_YOUR_DECISION:'wrongTurn', MOVE_UNAVAILABLE:'wrongPhase', INVALID_TARGET:'invalidSelection', TRAIT_UNAVAILABLE:'wrongPhase', WRONG_MODE:'wrongPhase', INVALID_RESPONSE:'invalidInput', INVALID_CARD:'invalidInput', SWITCH_USED:'switchUsedHelp', SWITCH_UNAVAILABLE:'switchUnavailable', STALE_REVISION: 'stale', UNAUTHORIZED: 'unauthorized', ROOM_NOT_FOUND: 'roomMissing', ROOM_CLOSED: 'closedCopy', ROOM_FULL: 'roomFull', GAME_STARTED: 'gameStarted', NOT_READY: 'notReadyError', DRAW_EXHAUSTED: 'drawExhausted', NOT_YOUR_TURN: 'wrongTurn', WRONG_PHASE:'wrongPhase', INVALID_PHASE:'wrongPhase', TURN_INCOMPLETE: 'turnIncomplete', VOTE_PENDING: 'votePending', INVALID_SELECTION: 'invalidSelection', OWNER_ONLY: 'ownerOnly', INVALID_SETTINGS: 'timerInvalid', INVALID_NICKNAME: 'invalidInput' };
  errorKey = error.network ? 'networkError' : mapped[error.code] || 'genericError';
  errorCode = error.code && /^[A-Z0-9_]{1,60}$/i.test(error.code) ? error.code : '';
  noticeKey = ''; renderMessages();
}
async function connect(mode) {
  if (busy) return;
  const nickname = $('#nickname').value.trim();
  const code = $('#room-code').value.trim().toUpperCase();
  if (!nickname || (mode === 'join' && !code)) { errorKey = 'invalidInput'; renderMessages(); return; }
  const spectator = $('#join-spectator').checked;
  busy = true; errorKey = ''; noticeKey = ''; setBusy();
  try {
    const data = await api(mode === 'create' ? '/api/rooms' : `/api/rooms/${encodeURIComponent(code)}/join`, { method: 'POST', body: { nickname, ...(mode === 'join' ? { spectator } : {}) }, token: null });
    if (!data.token || !data.code || !data.view) throw { code: 'INVALID_RESPONSE' };
    session = { code: data.code, token: data.token, playerId: data.playerId }; sessionStorage.setItem('rocket.session', JSON.stringify(session));
    busy = false; connected = true; setView(data.view, true);
  } catch (error) { busy = false; setBusy(); showError(error); }
}
async function recover() {
  if (busy) return;
  const code = $('#recover-code').value.trim().toUpperCase(), token = $('#recover-token').value.trim();
  if (!code || !token) { errorKey = 'recoveryRequired'; renderMessages(); return; }
  busy = true; setBusy();
  try {
    const data = await api(`/api/rooms/${encodeURIComponent(code)}`, { token });
    session = { code: data.view.code, token, playerId: data.view.selfId }; sessionStorage.setItem('rocket.session', JSON.stringify(session));
    busy = false; connected = true; errorKey = ''; noticeKey = 'joined'; setView(data.view, true);
  } catch (error) { busy = false; setBusy(); showError(error); }
}
function setBusy() {
  // Keep typed entry and recovery fields intact during requests.
  root.querySelectorAll('button').forEach(node => { if (busy) { node.dataset.wasDisabled = String(node.disabled); node.disabled = true; } else if ('wasDisabled' in node.dataset) { node.disabled = node.dataset.wasDisabled === 'true'; delete node.dataset.wasDisabled; } });
  root.setAttribute('aria-busy', String(busy));
}
async function action(type, payload = {}) {
  if (busy || !view || !session) return;
  busy = true; errorKey = ''; noticeKey = ''; setBusy(); renderMessages();
  try {
    const data = await api(`/api/rooms/${encodeURIComponent(session.code)}/actions`, { method: 'POST', body: { id: crypto.randomUUID(), revision: view.revision, type, ...payload } });
    busy = false; connected = true;
    if (type === 'settings') { settingsDraft = null; noticeKey = 'saved'; }
    setView(data.view, true);
  } catch (error) {
    busy = false; setBusy(); showError(error);
    // A failed mutation is never replayed automatically, especially after a lost response.
    await poll(true);
  }
}
async function poll(force = false) {
  if (scenePreview || !session || busy || pollRunning || (view?.status === 'closed' && !force)) return;
  const polledSession = session;
  pollRunning = true;
  try { const data = await api(`/api/rooms/${encodeURIComponent(session.code)}`); if (session !== polledSession) return; const wasOffline = !connected; connected = true; setView(data.view, force || wasOffline); }
  catch (error) {
    if (session !== polledSession) return;
    if (['ROOM_CLOSED', 'ROOM_NOT_FOUND'].includes(error.code)) {
      terminalReason = error.code === 'ROOM_NOT_FOUND' ? 'expired' : 'closed';
      const code = session.code;
      sessionStorage.removeItem('rocket.session'); session = null;
      selected = []; settingsDraft = null; credentialVisible = false; errorKey = ''; errorCode = ''; noticeKey = '';
      view = {code, revision: view?.revision || 0, status: 'closed', players: [], self: {spectator:false, hand:[], candidates:[], reserve:null}};
      connected = true; render(); return;
    }
    if (error.code === 'UNAUTHORIZED') {
      sessionStorage.removeItem('rocket.session'); session = null; view = null; credentialVisible = false; selected = [];
      render(); showError(error); return;
    }
    const changed = connected; connected = false;
    if (!view) { showError(error); if (changed) render(); }
    else if (changed) render();
  } finally { pollRunning = false; }
}
async function saveSettings() {
  const next = { arena: settingsDraft.arena, turnSeconds: Number(settingsDraft.turnSeconds), responseSeconds: Number(settingsDraft.responseSeconds) };
  if ([next.turnSeconds, next.responseSeconds].some(value => !Number.isInteger(value) || (value !== 0 && (value < 5 || value > 600)))) { errorKey = 'timerInvalid'; renderMessages(); return; }
  await action('settings', next);
}
function clearSession() {
  sessionStorage.removeItem('rocket.session'); session = null; view = null; selected = []; settingsDraft = null; signature = ''; errorKey = ''; noticeKey = ''; credentialVisible = false; terminalReason = ''; clockSample = null; clockAnnouncement = ''; phaseAnnouncement = ''; if (turnLiveRegion) turnLiveRegion.textContent = ''; render();
}
async function copyText(value) {
  try { await navigator.clipboard.writeText(value); noticeKey = 'copied'; errorKey = ''; }
  catch { noticeKey = 'copyUnavailable'; }
  renderMessages();
}
render();
fetch('/catalogue.json', { cache: 'no-store' }).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(data => { catalogue = Array.isArray(data.entries) ? data.entries : []; if (scenePreview || view || dialogKind === 'catalogue') render(); }).catch(() => {});
if (session) poll(true);
setInterval(() => poll(), 1500);
// Update only the clock text and warning styling; the arena remains mounted.
setInterval(updateTurnClock, 200);
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
