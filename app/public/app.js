import {coastalSeatLayout, pokemonLevelScale, seatLayout} from './battlefield-layout.js';
import {playCardFace} from './play-card-face.js';
import {pokemonTypes, typeIconPath} from './pokemon-types.js';
import {civilianProfiles} from './trainer-profiles.js';
import {createGameAudio, musicTracks} from './game-audio.js';
import {roleName,statusName,weatherLabel,attackDialog,moveChoiceDialog,eventDialog,toolDialog,toolChoiceEnabled,vitalSpiritDialog,downloadDialog,giftCardsDialog,equipItemDialog,lightBallDialog,analyticDialog,recklessDialog,decisionPanel,resultPanel} from './combat-ui.js';
const $ = (selector, root = document) => root.querySelector(selector);
const root = $('#app');
const strings = {
  homeEdition:['Master Edition','大师版'],
  homeTitleFirst:['Who’s Team','谁是'],
  homeTitleLast:['Rocket?','火箭队？'],
  homePremise:['Battle with two Pokémon and figure out who’s working for Team Rocket.','带上两只宝可梦展开对战，找出潜伏的火箭队成员。'],
  homePlayers:['3–6 trainers','3–6 位训练家'],
  trainerCamera:['Trainer view','训练家视角'],
  blaine:['Blaine','夏伯'], misty:['Misty','小霞'], erika:['Erika','莉佳'],
  judgmentFace:['Judgment card','判定牌'],
  lineup: ['Trainer lineup', '训练家阵容'],
  matchSettings: ['Timers & automation', '计时与自动操作'],
  dossier: ['Private identity file', '私密身份档案'],
  partnerLineup: ['Your lineup', '你的阵容'],
  battleReport: ['Match report', '对局报告'],
  homeModes:['How to enter the table','进入牌桌的方式'],
  homeHost:['Host','创建'],
  homeJoin:['Join','加入'],
  homeWatch:['Watch','观战'],
  homeHostTitle:['Start a table','开启牌桌'],
  homeJoinTitle:['Join a table','加入牌桌'],
  homeWatchTitle:['Watch a table','旁观牌局'],
  homeHostHelp:['Create a room and share its code with your friends.','创建房间，然后将房间代码分享给好友。'],
  homeJoinHelp:['Enter the six-character code from your host.','输入房主分享的六位房间代码。'],
  homeWatchHelp:['Enter a room code to watch the match as a spectator.','输入房间代码，以观众身份旁观。'],
  homeWatchAction:['Watch match','开始观战'],
  lobbySettings:['Match settings','对局设置'],
  gymLabel:['Gym','道馆'],
  copyShort:['Copy','复制'],
  leaveTab:['Leave session','退出会话'],
  startBattlePreview:['Start game','开始游戏'], combatPreview:['COMBAT PREVIEW · TEST DECK','战斗预览 · 测试牌库'],
  combatFixture:['3–6 ready trainers. View your identity first, then draw five different Pokémon and choose two.','需3–6位训练家准备。先查看自己的身份，再摸取五个不同宝可梦并选择两只。'],
  deckProfile:['Game deck','游戏牌库'], deckRetail:['Master Edition · 108 cards','原版大师版 · 108 张'],
  autoDraw:['Auto draw','自动摸牌'],
  autoJudgment:['Auto reveal judgments','自动翻开判定牌'],
  automationHelp:['Auto draw handles ordinary turn draws and waits when a draw ability is available. Auto reveal flips the judgment card immediately. Abilities that can replace a judgment still get a response.','自动摸牌处理回合摸牌，有可用的摸牌特性时等待选择。自动判定会立即翻开判定牌，能替换判定的特性仍可响应。'],
  combatPick:['Draw five Pokémon, then choose your active and reserve partners. The Gym Leader starts active at Lv.2; other trainers and all reserves at Lv.1.','摸取五张宝可梦后，选择出场与备战搭档。馆主出场为2级，其他训练家及所有备战为1级。'],
  combatPickTitle:['Five Pokémon. Choose two.','五个候选，选择两只。'],
  equipItem:['Equip item','携带持有物'], itemSuppressed:['suppressed','失效'], reserveItem:['Held item (inactive in reserve)','持有物（备战中不生效）'],
  weatherMove:['Use Will-O-Wisp','使用磷火'],
  giveCards:['Justified · give cards','正义之心 · 交给手牌'],
  playMove:['Use move','使用招式'], useTrait:['Use optional trait','发动可选特性'], responsePending:['Resolve the current response first.','请先处理当前响应。'],
  combatPlayHelp:['Use a move, activate a trait, switch, or finish playing.','可使用招式、发动特性、交替或完成出牌阶段。'],
  clockResponse:['Paused · response in progress','暂停 · 正在响应'], yourRole:['Your identity','你的身份'], eliminated:['Eliminated','已退场'],
  previewEffects:['Effects supported in combat.','战斗中支持此效果。'],
  brand: ['ROCKET TABLE', '火箭牌桌'], edition: ['MASTER EDITION', '大师版'],
  catalogue: ['Pokédex', '宝可梦图鉴'], rules: ['Game flow', '游戏流程'],
  language: ['Language', '语言'], graphics: ['Rich graphics', '丰富视觉效果'], motion: ['Reduce motion', '减少动态效果'],
  personalSettings: ['Settings', '设置'], visualSettings: ['Display', '画面'],
  music: ['Background music', '背景音乐'], musicVolume: ['Music volume', '音乐音量'], musicTrack: ['Music track', '音乐曲目'],
  soundEffects: ['Sound effects', '声效'], effectsVolume: ['Sound-effect volume', '声效音量'], previewSound: ['Test sound', '试听声效'],
  musicAuto: ['Follow the scene', '随场景切换'], musicTitle: ['Title Screen', '标题画面'], musicGym: ['Pokémon Gym', '宝可梦道馆'],
  musicBattle: ['Gym Leader Battle', '道馆馆主对战'], musicRocket: ['Rocket Hideout', '火箭队基地'],
  foundation: ['A real table. A foundation in progress.', '真实联机牌桌 · 规则持续完善中'],
  foundationBody: ['Create a room for Pokémon combat with the 108-card Master Edition deck, or watch as a spectator.', '使用 108 张原版大师版牌库对战，或作为观众观看。'],
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
  arenaTitle: ['Choose a Gym', '选择属性道馆'],
  fire: ['Fire Gym','火属性道馆'], fireDesc: ['A cracked basalt platform above flowing lava.','熔岩环绕的裂纹玄武岩战台。'],
  water: ['Water Gym','水属性道馆'], waterDesc: ['Ripple tiles and cascades in a rocky basin.','水纹石板、岩池与层叠落水。'],
  grass: ['Grass Gym','草属性道馆'], grassDesc: ['A woodland clearing edged with moss and wildflowers.','苔石和野花围绕的林间空地。'],
  revealIdentity: ['Flip your identity card','翻开身份牌'], identityPublic: ['Public identity','公开身份'],
  revealRole: ['Reveal identity','主动公开身份'],
  revealRoleConfirm: ['Everyone at the table will see your identity for the rest of this match.','牌桌上的所有人都会看到你的身份，直到本局结束。'],
  revealPokemon: ['Open Poké Ball','打开精灵球'], selectionRevealHelp: ['Open each Poké Ball, then tap a Pokémon to read its moves and abilities.','依次打开精灵球，点击宝可梦查看招式与特性。'],
  deckPile: ['Draw pile','牌堆'],
  openSeat: ['Open seat','空位'],
  seatLabel: ['Seat','席位'],
  takeSeat: ['Take this seat','坐这里'],
  seatChangeHelp: ['Choose any open seat before the match. Moving clears your ready status.','开局前可以选择任意空位，换座后需重新准备。'],
  seatTaken: ['That seat was taken. Choose another open seat.','这个席位已被占用，请选择其他空位。'],
  trainersReady: ['Ready to play','已准备'], responseNow: ['Your response','轮到你响应'], responseDetails: ['Response details','响应详情'],
  battleLastPlay: ['Latest activity','最新动态'], stadium: ['Sunrise Stadium', '晨光竞技场'], gym: ['Neon Gym', '霓虹道馆'], floating: ['Sky Islands', '浮空群岛'],
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
  publicReserve: ['Revealed reserve', '已公开备战'], faintingPokemon: ['Fainting', '昏厥'], defeatedPokemon: ['Defeated', '失去战斗能力'], switchUnavailable: ['Switching needs an active and reserve partner.', '交替需要出场与备战搭档。'],
  identity:['Your identity','你的身份'], identityStep:['1 · Identities','1 · 分配身份'], pokemonStep:['2 · Pokémon selection','2 · 选择宝可梦'], identityTitle:['Discover your identity','查看你的身份'], identityHelp:['Everyone views their identity before any Pokémon are drawn. Only the Gym Leader is public.','所有人查看身份后才会摸取宝可梦，仅道馆馆主身份公开。'], identitySeen:['I’ve seen my identity','我已查看身份'], identityWaiting:['Waiting for the other trainers to view their identities.','等待其他训练家查看身份。'], identityProgress:['Identities viewed','已查看身份'], drawPokemon:['Draw one Pokémon','摸取一张宝可梦'], drawPokemonFirst:['Draw all five before choosing','先摸齐五张再选择'], cardsDrawn:['Pokémon drawn','已摸取宝可梦'], unseenCandidate:['Undrawn Pokémon','未摸取宝可梦'], selectionProgress:['Partners locked','已确认搭档'], effectsPending:['Battle effects pending','战斗效果待实现'],
  hoverPokemonHint:['Moves & abilities','招式与特性'], levelPreviewHelp:['Click a level for full details','点击等级卡查看完整详情'], inspectLevel:['View details','查看详情'],
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
  search: ['Search Pokémon', '搜索宝可梦'], noResults: ['No matching Pokémon.', '没有匹配的宝可梦。'], abilityPending: ['Ability text pending verification', '技能文本待核实'],
  allTypes: ['All types','全部属性'], backToDex: ['Back to list','返回图鉴列表'],
  navLabel: ['Game information','游戏资讯'],
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
  visualPreview: ['6-SEAT VISUAL PREVIEW', '六人场地视觉预览'],
  previewNotice: ['Layout preview · no match is running', '场地布局预览 · 未运行对局'],
  tableCamera: ['Table view', '桌面视角'], overheadCamera: ['Overhead', '俯视视角'],
  arenaMenu: ['Table menu', '牌桌菜单'],
  fallbackView: ['2D field · 3D unavailable or disabled', '二维场地 · 三维不可用或已关闭'],
  previewCard: ['CARD SLOT', '手牌位置'], previewPlayer: ['Player', '玩家'],
};
// Pin preferences per tab so another player's tab cannot change them on reload.
for (const [key, fallback] of [['language', 'en'], ['motion', 'false'], ['graphics', 'true'],
  ['music', 'false'], ['musicVolume', '0.35'], ['track', 'auto'], ['effects', 'true'], ['effectsVolume', '0.65']]) {
  const name = `rocket.${key}`;
  if (sessionStorage.getItem(name) === null) sessionStorage.setItem(name, localStorage.getItem(name) ?? fallback);
}
const savePreference = (key, value) => { sessionStorage.setItem(key, value); localStorage.setItem(key, value); };
let language = sessionStorage.getItem('rocket.language') === 'zh' ? 'zh' : 'en';
let reducedMotion = sessionStorage.getItem('rocket.motion') === 'true';
let richGraphics = sessionStorage.getItem('rocket.graphics') !== 'false';
const savedVolume = (key, fallback) => {
  const value = Number(sessionStorage.getItem(`rocket.${key}`));
  return Number.isFinite(value) ? Math.min(1,Math.max(0,value)) : fallback;
};
const audioPrefs = {
  music:sessionStorage.getItem('rocket.music') === 'true', effects:sessionStorage.getItem('rocket.effects') !== 'false',
  musicVolume:savedVolume('musicVolume',.35), effectsVolume:savedVolume('effectsVolume',.65),
  track:sessionStorage.getItem('rocket.track'),
};
const gameAudio = createGameAudio(()=>audioPrefs);
function setAudioPreference(key,value) {
  audioPrefs[key] = value;
  savePreference(`rocket.${key}`,value);
  gameAudio.sync();
}
const t = key => strings[key]?.[language === 'zh' ? 1 : 0] ?? key;
const localized = value => typeof value === 'string' ? value : (value?.[language] || value?.en || value?.zh || '—');
let catalogue = [];
let dexQuery = '', dexType = '', dexFocus = null;
let session = null;
try { const saved = JSON.parse(sessionStorage.getItem('rocket.session') || 'null'); if (saved?.code && saved?.token) session = saved; } catch { sessionStorage.removeItem('rocket.session'); }
let identityFaceShown = false, revealedCandidate = null, arrivingHandCards = [], enteringArena = false, leaderPortrait = null;
let drawCeremony = 'sealed', drawCeremonyTimer, inspectedCandidate = null, inspectedLevel = 1;
let coastalHandExpanded = false;
let revealVictory = false, victorySoundTimer;
const gymThemes = ['fire', 'water', 'grass'];
let view = null, busy = false, pollRunning = false, connected = true, errorKey = '', errorCode = '', noticeKey = '', selected = [], settingsDraft = null, signature = '', dialogKind = null, terminalReason = '';
let credentialVisible = false, dialogReturnFocus = null;
const entryDraft = { nickname: '', code: '' };
let clockSample = null, clockAnnouncement = '', phaseAnnouncement = '', turnTimerDefault = 60, turnLiveRegion = null;
const previewOptions = new URLSearchParams(location.search);
const fullPreviewMotion = previewOptions.get('motion') === 'on';
let scenePreview = previewOptions.has('preview'), previewTheme = 'fire', cameraMode = 'table', battlefield = null;
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
function partnerImage(pokemon) {
  const entry = pokemon && catalogueEntry(pokemon.catalogueId);
  const art = entry?.levels?.find(face=>face.level===pokemon.level)?.portraitImage?.url || entry?.portraitImage?.url;
  return art ? el('img',{class:'arena-partner-image',src:art,alt:'',draggable:false}) : null;
}
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
function askConfirmation(messageKey, onConfirm, detail = null, title = 'confirmationTitle', confirm = 'confirmAction') {
  // A DOM dialog keeps room polling alive while the player considers an action.
  const dialog = el('dialog', {class:`info-dialog confirmation-dialog${view?.status==='lobby'?' lobby-confirmation':''}`, 'aria-label':t(title)},
    el('h2', {}, t(title)), el('p', {}, t(messageKey)), detail ? el('p', {}, detail) : null);
  const cancel = button('cancelAction', () => dialog.close(), 'button secondary');
  dialog.append(el('div', {class:'action-row'}, cancel, button(confirm, () => { dialog.close(); onConfirm(); }, confirm === 'leaveTab' ? 'button danger' : 'button primary')));
  dialog.addEventListener('close', () => dialog.remove(), {once:true});
  document.body.append(dialog); dialog.showModal(); cancel.focus();
}
function confirmPartnerSwitch() {
  const code = view.code, number = view.turn.number, reserve = view.self.reserve;
  if (!reserve) return;
  const portrait = (pokemon,key)=>el('div',{class:'arena-confirm-partner'},partnerImage(pokemon),
    el('small',{},t(key)),pokemon?el('strong',{},partnerName(pokemon.catalogueId,pokemon.level)):null);
  const panel = el('section',{class:'arena-prompt arena-switch-prompt',tabindex:-1,'aria-label':t('switchPokemon')},
    el('h2',{},t('switchPokemon')),
    el('div',{class:'arena-switch-line'},portrait(ownPlayer()?.active,'active'),el('span',{'aria-hidden':'true'},'⇄'),portrait(reserve,'reserve')),
    el('p',{},language==='zh'?'交替成功后，备战搭档将公开。沙穴可能要求弃牌。':'A successful switch reveals your reserve. Arena Trap may require a discard.'),
    el('div',{class:'action-row'},
      button('cancelAction',()=>closeArenaPrompt(),'button secondary'),
      button('switchPokemon',()=>{
        if (view?.code!==code||view.turn?.number!==number||!myTurn()||turnPhase()!=='play'||view.turn.switchUsed) return;
        closeArenaPrompt(false);
        action('switchPokemon');
      },'button primary',false,{id:'confirm-arena-switch'})));
  openArenaPrompt(panel);
}
function confirmTurnEnd() {
  const active = ownPlayer()?.active;
  const code = view.code, number = view.turn.number;
  const next = active?.level < 3 ? {...active,level:active.level+1} : null;
  const choice = el('input',{type:'checkbox',id:'end-level-up'});
  openArenaPrompt(el('section',{class:'arena-prompt arena-end-prompt',tabindex:-1,'aria-label':t('endTurn')},
    el('h2',{},t('endTurn')),el('p',{},t('endTurnConfirm')),
    next?el('label',{class:'arena-level-choice',title:t('levelUpHelp')},choice,partnerImage(next),
      el('span',{},el('strong',{},t('levelUpChoice')),el('small',{},`${partnerName(next.catalogueId,next.level)} · Lv. ${active.level} → ${next.level}`))):null,
    el('div',{class:'action-row'},button('cancelAction',()=>closeArenaPrompt(),'button secondary'),
      button('endTurn',()=>{
        if (view?.code!==code||view.turn?.number!==number||!myTurn()||turnPhase()!=='end') return;
        closeArenaPrompt(false);
        action('endTurn',{levelUp:Boolean(next&&choice.checked)});
      },'button primary',false,{id:'confirm-arena-end'}))));
}
function applyPreferences() {
  document.documentElement.lang = language === 'zh' ? 'zh-Hans' : 'en';
  document.documentElement.classList.toggle('preview-full-motion', fullPreviewMotion && !reducedMotion);
  document.body.classList.toggle('reduce-motion', reducedMotion);
  document.body.classList.toggle('simple-graphics', !richGraphics);
  document.body.classList.toggle('battle-view', scenePreview || ['identity','setup','playing','finished'].includes(view?.status));
  document.body.classList.toggle('setup-view', ['identity','setup'].includes(view?.status));
  document.body.classList.toggle('lobby-view', view?.status==='lobby');
  document.title = language === 'zh' ? '谁是火箭队？' : 'Who’s Team Rocket?';
}
function shell() {
  const home = root.classList.contains('landing-page');
  root.replaceChildren();
  const languageSelect = el('select', { id: 'language', 'aria-label': t('language'), onchange: event => { language = event.target.value; savePreference('rocket.language', language); signature = ''; render(); } },
    el('option', { value: 'en', selected: language === 'en' }, 'English'), el('option', { value: 'zh', selected: language === 'zh' }, '中文'));
  const settingsMenu = el('button',{id:'personal-settings-button',type:'button',class:'button subtle settings-trigger',
    'aria-label':t('personalSettings'),'aria-haspopup':'dialog',title:t('personalSettings'),
    onclick:()=>openSystemDialog('preferences','personal-settings-button')},el('img',{src:'/system-art/settings.svg',alt:'',width:20,height:20}));
  root.append(el('header', { class: 'site-header' }, el('div', { class: 'brand' }, el('img', { class: 'brand-insignia', src:'/system-art/rocket-mark.svg', alt:'', width:38, height:38 }), el('div', {}, el('strong', {}, t('brand')), home ? null : el('small', {}, t('edition')))),
    el('nav', { class: 'header-actions', 'aria-label': t('navLabel') },
      button('catalogue', () => openSystemDialog('catalogue','open-pokedex'), 'button subtle small', false, {id:'open-pokedex','aria-haspopup':'dialog'}),
      button('rules', () => openSystemDialog('rules','open-game-flow'), 'button subtle small', false, {id:'open-game-flow','aria-haspopup':'dialog'}), languageSelect, settingsMenu)));
  if (!home) root.append(el('div', { class: 'foundation-strip' }, el('span', { class: 'pulse-dot', 'aria-hidden': true }), el('div', {}, el('strong', {}, t('foundation')), el('span', {}, t('foundationBody')))));
  root.append(el('div', { id: 'messages', 'aria-live': 'polite' }), el('main', { id: 'main' }));
  root.append(el('footer', { class: 'footer' }, el('span', {}, t(home ? 'brand' : 'edition')), el('span', {}, t(home ? 'homeEdition' : 'assetCopy'))));
  const dialog = el('dialog', { id: 'info-dialog', class: 'info-dialog' });
  dialog.addEventListener('close',event=>{
    if (event.currentTarget !== $('#info-dialog') || event.currentTarget.open) return;
    const wasSettings = dialogKind === 'lobby-settings';
    const returnId = dialogReturnFocus;
    dialogKind = null;
    dialogReturnFocus = null;
    if (wasSettings) { settingsDraft = null; render(); }
    else renderMessages();
    if (returnId) document.getElementById(returnId)?.focus();
  });
  root.append(dialog);
}
function preference(key, checked, change, id = null) {
  return el('label', { class: 'check-label' }, el('input', { id, type: 'checkbox', checked, onchange: e => change(e.target.checked) }), t(key));
}
function personalSettingsPanel() {
  function volume(key) {
    const id = `preferences-${key}`;
    const initial = Math.round(audioPrefs[key]*100);
    const output = el('output',{for:id},`${initial}%`);
    return el('label',{class:'audio-range',for:id},el('span',{},t(key),output),
      el('input',{id,type:'range',min:0,max:100,value:initial,oninput:event=>{
        const value = event.target.valueAsNumber;
        output.textContent = `${value}%`;
        setAudioPreference(key,value/100);
      }}));
  }
  const labels = {auto:'musicAuto',title:'musicTitle',gym:'musicGym',battle:'musicBattle',rocket:'musicRocket'};
  const track = el('select',{id:'preferences-track',onchange:event=>setAudioPreference('track',event.target.value)},
    ['auto',...Object.keys(musicTracks)].map(key=>el('option',{value:key},t(labels[key]))));
  track.value = Object.hasOwn(musicTracks,audioPrefs.track) ? audioPrefs.track : 'auto';
  const sample = button('previewSound',()=>gameAudio.preview(),'button secondary',!audioPrefs.effects,{id:'preferences-sound-preview'});
  return el('div',{class:'personal-settings'},
    el('fieldset',{},el('legend',{},t('music')),
      preference('music',audioPrefs.music,value=>setAudioPreference('music',value),'preferences-music'),
      el('label',{class:'field',for:track.id},el('span',{},t('musicTrack')),track),volume('musicVolume')),
    el('fieldset',{},el('legend',{},t('soundEffects')),
      preference('soundEffects',audioPrefs.effects,value=>{setAudioPreference('effects',value); sample.disabled = !value;},'preferences-effects'),
      volume('effectsVolume'),sample),
    el('fieldset',{class:'personal-display-settings'},el('legend',{},t('visualSettings')),
      preference('graphics',richGraphics,value=>{richGraphics=value;savePreference('rocket.graphics',value);render();},'preferences-graphics'),
      preference('motion',reducedMotion,value=>{reducedMotion=value;savePreference('rocket.motion',value);render();},'preferences-motion')));
}
function preserveFocus(work) {
  const focused = document.activeElement;
  const id = focused?.id;
  const start = focused?.selectionStart, end = focused?.selectionEnd;
  work();
  if (id) { const target = document.getElementById(id); if (target && !target.disabled) { target.focus({ preventScroll: true }); if (typeof start === 'number' && target.setSelectionRange) { try { target.setSelectionRange(start, end); } catch {} } } }
}
function render() {
  const previousDialog = $('#info-dialog');
  const activeDialog = previousDialog?.open ? dialogKind : null;
  const dialogScroll = activeDialog ? previousDialog.scrollTop : 0;
  const dialogFocus = activeDialog ? document.activeElement?.id : null;
  const oldPrep = $('.match-prep');
  const prepScroll = oldPrep?.scrollTop || 0;
  const oldTable = $('.match-table');
  const tableScroll = oldTable?.scrollTop || 0;
  const handScroll = $('.match-table .hand-cards')?.scrollLeft || 0;
  const openMenus = [...root.querySelectorAll('details[id][open]')].map(menu => menu.id);
  if (!scenePreview && !['identity','setup','playing','finished'].includes(view?.status)) { battlefield?.dispose(); battlefield = null; }
  preserveFocus(() => {
    root.classList.toggle('landing-page', !session && !scenePreview && view?.status !== 'closed');
    applyPreferences(); shell(); renderMessages();
    if (scenePreview) renderBattlePreview();
    else if (view?.status === 'closed') renderRoom();
    else if (!session) renderEntry();
    else if (!view) $('#main').append(el('div', { class: 'loading panel' }, el('span', { class: 'spinner' }), t('syncing')), recoveryPanel());
    else renderRoom();
  });
  const nextPrep = $('.match-prep');
  if (oldPrep && nextPrep && oldPrep.className===nextPrep.className) nextPrep.scrollTop=prepScroll;
  const nextTable = $('.match-table');
  if (oldTable && nextTable) {
    nextTable.scrollTop=tableScroll;
    const hand=$('.hand-cards',nextTable);
    if(hand) hand.scrollLeft=handScroll;
  }
  const dialogStillAvailable = activeDialog &&
    (activeDialog !== 'lobby-settings' || view?.status === 'lobby') &&
    (!activeDialog.startsWith('entry:') || root.classList.contains('landing-page'));
  if (dialogStillAvailable) {
    openDialog(activeDialog);
  } else if (activeDialog) {
    dialogKind = null;
    dialogReturnFocus = null;
  }
  for (const id of openMenus) document.getElementById(id)?.setAttribute('open', '');
  if (dialogFocus) document.getElementById(dialogFocus)?.focus({preventScroll:true});
  if (dialogScroll) $('#info-dialog').scrollTop = dialogScroll;
  gameAudio.setScene(scenePreview || view?.status==='playing' ? 'battle' : ['lobby','setup','identity','finished'].includes(view?.status) ? 'gym' : 'title');
  if (!richGraphics || !$('.leader-model')) { leaderPortrait?.dispose(); leaderPortrait = null; }
  if (enteringArena) {
    const arena = $('.world-host');
    if (arena && motionAllowed()) arena.animate([{opacity:0,scale:'1.05'},{opacity:1,scale:'1'}],{duration:560,easing:'cubic-bezier(.17,.72,.32,1)'});
    enteringArena = false;
  }
  if (!richGraphics || !$('.match-stage .world-host')) animateHandDeal();
  updateTurnClock();
}
function renderMessages() {
  const messages = $('#messages');
  const dialogMessages = $('dialog[open] #system-dialog-messages');
  if (!messages) return;
  messages.replaceChildren();
  dialogMessages?.replaceChildren();
  if (errorKey) (dialogMessages || messages).append(el('div', { class: 'message error', role: 'alert' }, el('span', {}, t(errorKey), errorCode ? ` (${errorCode})` : ''), button('close', () => { errorKey = ''; errorCode = ''; renderMessages(); }, 'text-button')));
  if (noticeKey) $('#messages').append(el('div', { class: 'message notice', role: 'status' }, t(noticeKey)));
}
function inputField(key, id, options = {}) {
  return el('label', { class: 'field', for: id }, el('span', {}, t(key)), el('input', { id, name: id, ...options }));
}
function renderEntry() {
  const actions = [['create','homeHost'],['join','homeJoin'],['watch','homeWatch']];
  const title = `${t('homeTitleFirst')}${language==='zh'?'':' '}${t('homeTitleLast')}`;
  const titleLines = language==='zh' ? [title] : [t('homeTitleFirst'),t('homeTitleLast')];
  $('#main').append(el('section', {class:'rocket-cover','aria-labelledby':'home-title'},
    el('h1', {id:'home-title','aria-label':title},
      titleLines.map(line=>el('span',{'data-face':line,'aria-hidden':true},line))),
    el('div', {class:'rocket-entry-actions',role:'group','aria-label':t('homeModes')}, actions.map(([mode,key])=>
      button(key,()=>openSystemDialog(`entry:${mode}`,`home-mode-${mode}`),`button ${mode==='create'?'primary':'secondary'}`,false,{id:`home-mode-${mode}`}))),
    recoveryEntry()));
}
function entryDialogContent(mode) {
  const modes = {
    create: ['homeHost', 'homeHostTitle', 'homeHostHelp', 'create'],
    join: ['homeJoin', 'homeJoinTitle', 'homeJoinHelp', 'join'],
    watch: ['homeWatch', 'homeWatchTitle', 'homeWatchHelp', 'homeWatchAction'],
  };
  const [,heading,help,submit] = modes[mode];
  const nickname = inputField('nickname', 'nickname', {
    value: entryDraft.nickname, placeholder: t('nickPlaceholder'), maxlength: 24, autocomplete: 'nickname', required: true,
    oninput: event => { entryDraft.nickname = event.target.value; },
  });
  const code = mode === 'create' ? null : inputField('roomCode', 'room-code', {
    value: entryDraft.code, placeholder: 'ABC123', maxlength: 6, autocomplete: 'off', autocapitalize: 'characters', spellcheck: false,
    required: true,
    oninput: event => { entryDraft.code = event.target.value; },
  });
  const entryForm = el('form', { class:'system-form', 'aria-describedby': 'home-entry-help', onsubmit: event => {
    event.preventDefault();
    connect(mode);
  } }, el('p',{id:'home-entry-help'},t(help)),nickname,code,el('button',{type:'submit',class:'button primary',disabled:busy},t(submit)));
  return [t(heading),entryForm];
}
function recoveryEntry() {
  const form = el('form', { class: 'recovery-form', onsubmit: e => { e.preventDefault(); recover(); } }, inputField('roomCode', 'recover-code', { required: true, autocomplete: 'off', maxlength: 12 }), inputField('credential', 'recover-token', { type: 'password', required: true, autocomplete: 'off', spellcheck: false }), el('button', { class: 'button secondary', type: 'submit', disabled: busy }, t('recover')));
  return el('details', { id:'home-recovery', class: 'panel recovery-entry' }, el('summary', {}, t('recoverTitle')), el('p', { class: 'muted' }, t('recoverCopy')), form);
}
function creature(className = '') {
  return el('div', { class: `creature ${className}`, 'aria-hidden': true }, el('div', { class: 'creature-ear left' }), el('div', { class: 'creature-ear right' }), el('div', { class: 'creature-body' }, el('span', { class: 'eye left' }), el('span', { class: 'eye right' }), el('span', { class: 'creature-cheek left' }), el('span', { class: 'creature-cheek right' })), el('div', { class: 'creature-tail' }));
}
let arenaPrompt = null;
let arenaJudgment = null, arenaJudgmentTimer;
const arenaJudgmentQueue = [];
let arenaEvent = null, arenaEventTimer;
let arenaTraitEvent = null, arenaTraitTimer;
let arenaCues = [];
let arenaEffect = null;
let arenaEffectTimer;
function syncArenaPrompt() {
  const stage = $('.match-stage');
  if (!stage) return;
  const prompt = arenaPrompt;
  const responseTargets = [...stage.querySelectorAll('.arena-has-response [data-arena-seat]')];
  const ids = prompt?.targets?.() ?? responseTargets.map(button=>button.dataset.arenaSeat);
  const marked = prompt?.selected?.() ?? responseTargets.filter(button=>button.getAttribute('aria-pressed')==='true').map(button=>button.dataset.arenaSeat);
  const slots = prompt?.targetSlots?.();
  const reserveSelected = prompt?.selectedSlot?.()==='reserve';
  const aiming = Boolean(prompt?.targets || responseTargets.length);
  stage.classList.toggle('arena-prompt-open',Boolean(prompt));
  stage.classList.toggle('arena-response-aiming',responseTargets.length>0);
  if (stage.closest('.theme-water')) {
    stage.classList.toggle('coastal-field-prompt',Boolean(prompt?.targets));
    for (const control of stage.querySelectorAll('.match-tray,.arena-quick-actions')) control.inert = Boolean(prompt);
    const cue = $('.coastal-cue',stage);
    if (cue) {
      cue.textContent = prompt?.targets
        ? [prompt.panel.querySelector('h2')?.textContent,language==='zh'?'选择目标':'Choose target'].filter(Boolean).join(' · ')
        : cue.dataset.restingCue;
      cue.hidden = !cue.textContent;
    }
  }
  if (prompt && prompt.panel.parentNode!==stage) stage.append(prompt.panel);
  const field = $('.world-host',stage);
  field.classList.toggle('world-aiming',aiming);
  const aimPanel = prompt?.targets ? prompt.panel : responseTargets.length ? $('.arena-has-response',stage) : null;
  const aimBottom = aimPanel ? aimPanel.offsetHeight+43 : 0;
  field.style.setProperty('--aim-bottom',`${Math.max(105,aimBottom)}px`);
  for (const target of field.querySelectorAll('[data-target-seat]')) {
    const id = target.dataset.targetSeat;
    const slot = target.dataset.targetSlot;
    target.hidden = !(prompt?.onTarget || responseTargets.length) || (slots
      ? !slots.some(option=>option.targetId===id && (option.slot==='reserve')===Boolean(slot))
      : Boolean(slot) || !ids.includes(id));
    target.disabled = !prompt && Boolean(responseTargets.find(button=>button.dataset.arenaSeat===id)?.disabled);
    target.setAttribute('aria-pressed',String(marked.includes(id) &&
      (!slots || reserveSelected===Boolean(slot))));
  }
  for (const element of field.querySelectorAll('[data-seat-id],[data-sprite-id]')) {
    const id = element.dataset.seatId ?? element.dataset.spriteId;
    element.classList.toggle('world-eligible',ids.includes(id));
    element.classList.toggle('world-targeted',marked.includes(id));
    const details = element.querySelector('.pokemon-name-button');
    if (details) details.disabled = aiming;
  }
  battlefield?.targeting(aiming ? ids : null,marked,aimBottom);
}
function closeArenaPrompt(restoreFocus = true) {
  if (!arenaPrompt) return;
  const {panel,trigger} = arenaPrompt;
  arenaPrompt = null;
  panel.remove();
  syncArenaPrompt();
  if (restoreFocus && trigger?.isConnected) trigger.focus({preventScroll:true});
}
function openArenaPrompt(panel, options = {}) {
  const trigger = arenaPrompt?.trigger ?? document.activeElement;
  closeArenaPrompt(false);
  arenaPrompt = {panel,trigger,revision:view.revision,...options};
  syncArenaPrompt();
  const firstTarget = options.onTarget && $('.world-target:not([hidden])');
  (firstTarget || panel).focus({preventScroll:true});
}
document.addEventListener('keydown',event=>{
  if (event.key==='Escape' && arenaPrompt && !document.querySelector('dialog[open]')) {
    event.preventDefault();
    closeArenaPrompt();
  }
});
window.addEventListener('resize',()=>{ if (arenaPrompt) syncArenaPrompt(); });
function combatKit() { return {getView:()=>view,language,localized,partnerName,partnerImage,action,openArenaPrompt,closeArenaPrompt,syncArenaPrompt,get busy(){return busy;}}; }
function gymTypeIcon(theme) {
  return gymThemes.includes(theme) ? typeIcon(theme) : '★';
}
function victoryScene(result, theme) {
  const winners = seated().filter(player=>result.winnerIds.includes(player.id));
  const title = result.winner==='rocket' ? (language==='zh'?'火箭队胜利':'Team Rocket wins') : result.winner==='challengers'
    ? (language==='zh'?'挑战者胜利':'Challengers win') : (language==='zh'?'道馆阵营胜利':'Gym team wins');
  const mark = result.winner==='rocket' ? el('img',{src:'/system-art/rocket-mark.svg',alt:''}) :
    result.winner==='challengers' ? '✦' : gymTypeIcon(theme);
  const overlay = el('div',{class:'victory-scene','data-winner':result.winner},
    el('div',{class:'victory-rays','aria-hidden':'true'}),
    el('div',{class:'victory-sparks','aria-hidden':'true'},Array.from({length:18},(_,index)=>{
      const spark = el('i');
      spark.style.setProperty('--angle',`${index*20}deg`);
      spark.style.setProperty('--distance',`${80+(index*37)%94}px`);
      spark.style.setProperty('--delay',`${(index%6)*35}ms`);
      return spark;
    })),
    el('div',{class:'victory-banner'},el('span',{class:'victory-emblem','aria-hidden':'true'},mark),
      el('strong',{},title),el('span',{class:'victory-winners'},winners.map(player=>player.nickname).join(' · '))));
  function play(delay=0) {
    clearTimeout(victorySoundTimer);
    overlay.classList.remove('victory-playing');
    if (!motionAllowed()) return;
    overlay.style.setProperty('--victory-delay',`${delay}ms`);
    // Restart the CSS animation when the same result is replayed.
    void overlay.offsetWidth;
    overlay.classList.add('victory-playing');
    victorySoundTimer = setTimeout(()=>{
      if (overlay.isConnected) gameAudio.victory(result.winner);
    },delay+200);
  }
  if (revealVictory) {
    revealVictory = false;
    play(richGraphics ? 1000 : 220);
  }
  return {overlay,play};
}
function renderRoom() {
  if (view.status === 'lobby') { renderLobby(); return; }
  if (['identity','setup'].includes(view.status)) { renderArenaSetup(); return; }
  if (view.status === 'finished') {
    const main = $('#main'), theme = view.settings.arena;
    const victory = view.result ? victoryScene(view.result,theme) : null;
    main.classList.add('match-finished', `theme-${theme}`);
    main.append(el('header', {class:'result-ribbon'},
      el('span', {class:'venue-mark','aria-hidden':'true'}, gymTypeIcon(theme)),
      el('div', {}, el('strong', {}, t('battleReport')), el('small', {}, `${t(theme)} · ${t('room')} ${view.code}`)),
      victory && motionAllowed() ? el('button',{type:'button',class:'button subtle victory-replay',onclick:()=>{
        victory.overlay.parentElement?.scrollIntoView({block:'nearest'});
        victory.play();
      }},language==='zh'?'重播胜利动画':'Replay victory') : null),
      el('div',{class:'result-arena'},worldPanel(seated(),view.selfId,null,theme),victory?.overlay),
      resultPanel(view,combatKit()));
    return;
  }
  if (view.status === 'playing') { renderBattleRoom(); return; }
  const status = tag(t(view.status), `status-${view.status}`);
  const connectionTag = el('span', { class: `connection ${connected ? '' : 'interrupted'}` }, el('i', { 'aria-hidden': true }), t(view.status === 'closed' ? 'sessionEnded' : connected ? 'connection' : 'reconnecting'));
  $('#main').append(el('section', { class: 'room-heading' }, el('div', {}, el('div', { class: 'eyebrow' }, t('room')), el('div', { class: 'room-title-line' }, el('h1', { class: 'room-code' }, view.code), status, button('copyCode', () => copyText(view.code), 'button subtle small'))), el('div', { class: 'room-presence' }, connectionTag, el('span', { class: 'muted' }, ownPlayer()?.nickname || '', ' · ', t(view.self.spectator ? 'spectatorLabel' : 'you')))));
  if (view.status === 'closed') {
    $('#main').append(el('section', { class: 'panel closed-state' }, el('div', { class: 'closed-icon' }, '◈'), el('h2', {}, t(terminalReason === 'expired' ? 'expired' : 'closed')), el('p', {}, t(terminalReason === 'expired' ? 'expiredCopy' : 'closedCopy')), el('p', { class: 'muted' }, t('endReason')), button('newAdventure', clearSession, 'button primary')));
    return;
  }
}
function renderLobby() {
  const players = seated();
  const watchers = view.players.filter(player=>player.spectator);
  const ready = players.filter(player=>player.connected && player.ready).length;
  const seats = el('ul',{class:'checkin-seats'});
  for (let number=1; number<=6; number++) {
    const player = players.find(entry=>entry.seatNumber===number);
    const state = player ? !player.connected ? 'offline' : player.ready ? 'ready' : 'notReady' : 'openSeat';
    const initial = Array.from(player?.nickname.trim() || '')[0];
    const portrait = civilianProfiles.includes(player?.trainerAvatar)
      ? el('img',{src:`/system-art/${player.trainerAvatar}.webp`,alt:'',onerror:event=>event.currentTarget.remove()}) : null;
    const seatLabel = `${t('seatLabel')} ${number}`;
    const content = [el('span',{class:'checkin-seat-number','aria-label':seatLabel},String(number).padStart(2,'0')),
      el('span',{class:'checkin-emblem','aria-hidden':true},player ? [el('span',{},initial),portrait] : el('i',{class:'seat-ball'})),
      el('span',{class:'checkin-seat-copy'},el('strong',{},player?.nickname || t(view.self.spectator?'openSeat':'takeSeat')),
        player ? el('span',{class:'checkin-state'},t(state)) : null,
        player?.id===view.ownerId || player?.id===view.selfId ? el('small',{},[player.id===view.ownerId?t('owner'):null,player.id===view.selfId?t('you'):null].filter(Boolean).join(' · ')) : null)];
    const seatClass = `checkin-seat ${state}${player?.id===view.selfId?' checkin-self':''}`;
    seats.append(!player && !view.self.spectator
      ? el('li',{class:'checkin-open-slot'},el('button',{id:`choose-seat-${number}`,type:'button',class:seatClass,
        disabled:busy,'aria-label':`${t('takeSeat')} · ${seatLabel}`,onclick:async()=>{
          if (await action('chooseSeat',{seatNumber:number})) $(`#checkin-seat-${number}`)?.focus({preventScroll:true});
        }},content))
      : el('li',{class:seatClass,id:`checkin-seat-${number}`,tabindex:player?.id===view.selfId?-1:null},content));
  }
  const leave = button('leaveTab',()=>askConfirmation('leaveConfirm',clearSession,null,'leaveTab','leaveTab'),'button lobby-exit',false,{id:'lobby-exit'});
  $('#main').append(el('section',{class:'checkin','aria-labelledby':'checkin-title'},
    el('header',{class:'checkin-header'},
      el('div',{class:'checkin-room'},el('div',{},el('span',{},t('roomCode')),el('h1',{id:'checkin-title'},view.code)),
        button('copyShort',()=>copyText(view.code),'button secondary',false,{'aria-label':t('copyCode')})),
      el('span',{class:`connection ${connected?'':'interrupted'}`},el('i',{'aria-hidden':true}),t(connected?'connection':'reconnecting'),view.self.spectator?` · ${t('spectatorLabel')}`:null)),
    view.pendingVote ? votePanel() : null,
    el('div',{class:'checkin-roster'},
      el('div',{class:'checkin-roster-heading'},el('h2',{},t('lineup')),el('span',{},`${ready} / ${players.length} · ${t('trainersReady')}`)),
      seats,view.self.spectator ? null : el('p',{class:'checkin-seat-hint'},t('seatChangeHelp'))),
    el('div',{class:'checkin-controls'},
      el('div',{class:'checkin-config'},el('div',{},el('span',{},t('gymLabel')),el('strong',{},gymThemes.includes(view.settings.arena)?gymTypeIcon(view.settings.arena):null,t(view.settings.arena))),
        el('div',{},el('span',{},t('deckProfile')),el('strong',{},t('deckRetail'))),
        button('lobbySettings',()=>openSystemDialog('lobby-settings','open-lobby-settings'),'button secondary',false,{id:'open-lobby-settings'})),
      view.self.spectator ? null : lobbyLaunch()),
    el('p',{class:'checkin-hint'},t(view.self.spectator?'watchCopy':'startHelp')),
    el('footer',{class:'checkin-footer'},el('span',{},`${t('spectators')} · ${watchers.length}`,watchers.length?` · ${watchers.map(player=>player.nickname).join(' · ')}`:null),leave)),
    el('details',{id:'lobby-utilities',class:'checkin-utilities'},el('summary',{},t('control')),
      el('div',{class:'room-sidebar'},logPanel(),recoveryPanel(),isOwner()?controlPanel():null)));
}
function crewPanel() {
  const players = seated();
  const list = el('div', { class: 'crew-list' });
  for (const player of players) {
    const state = view.status === 'setup' ? (player.setupComplete ? 'chosen' : 'choosing') : (view.turn?.playerId === player.id ? 'theirTurn' : null);
    const role = view.status==='identity'
      ? (player.role==='leader' && player.identityAcknowledged ? 'leader' : null)
      : (player.id===view.selfId?view.self.role:player.role);
    list.append(el('div', { class: `crew-row ${player.id === view.selfId ? 'self' : ''}` }, el('div', { class: 'avatar', 'aria-hidden': true }, Array.from(player.nickname || '?')[0]),
      el('div', { class: 'crew-person' }, el('strong', {}, player.nickname, player.id === view.selfId ? ` · ${t('you')}` : ''), el('span', { class: player.connected ? 'muted' : 'offline-label' }, !player.connected ? t('offline') : state ? t(state) : `${player.handCount} ${t('cards')}`), view.gameMode === 'combat-preview' ? el('span',{},roleName(role,language),player.eliminated?` · ${t('eliminated')}`:'') : null, player.reserve ? el('span', {class:'revealed-reserve'}, `${t('publicReserve')}: ${partnerName(player.reserve.catalogueId,player.reserve.level)} · ${player.reserve.level}`) : null), player.id === view.ownerId ? tag(t('owner'), 'owner-tag') : null));
  }
  const watchers = view.players.filter(p => p.spectator);
  return el('section', { class: 'panel crew-panel' }, el('div', { class: 'section-heading' }, el('h2', {}, t('crew')), tag(`${players.length} / 6`)), list,
    el('div', { class: 'spectator-list' }, el('span', {}, t('spectators'), ` · ${watchers.length}`), watchers.length ? el('span', { class: 'muted' }, watchers.map(p => p.nickname).join(' · ')) : null));
}
function lobbyPanel() {
  const panel = el('section', { class: 'lobby-panel checkin-settings' }, el('h3', {}, t('arenaTitle')));
  if (!settingsDraft) settingsDraft = { ...view.settings };
  const settings = isOwner() ? settingsDraft : view.settings;
  const arenas = el('div', { class: 'checkin-gyms', role:'group', 'aria-label':t('arenaTitle') });
  const options = gymThemes.includes(view.settings.arena) ? gymThemes : [...gymThemes, view.settings.arena];
  for (const arena of options) arenas.append(el('button', { id: `arena-${arena}`, type: 'button', class: 'checkin-gym', disabled: busy || !isOwner(), 'aria-pressed': settings.arena === arena, onclick: () => { settingsDraft.arena = arena; render(); } }, el('span', {'aria-hidden':true},gymTypeIcon(arena)),el('strong',{},t(arena))));
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
  const advanced = el('details',{id:'lobby-settings',class:'lobby-settings'},el('summary',{},t('matchSettings')),
    timers, el('p', { class: 'inline-note' }, t('timerHelp')));
  for (const [key, defaultValue] of [['autoDraw', false], ['autoJudgment', true]]) {
    const toggle = preference(key, settings[key] ?? defaultValue, enabled => {
      settingsDraft[key] = enabled;
      render();
    });
    const input = $('input', toggle);
    input.id = key;
    input.disabled = busy || !isOwner();
    advanced.append(toggle);
  }
  advanced.append(el('p', { class: 'inline-note' }, t('automationHelp')));
  panel.append(advanced);
  if (settings.arena !== view.settings.arena) panel.append(el('p',{class:'inline-note'},language==='zh'?'保存设置以使用此道馆。':'Save settings to use this Gym.'));
  if (isOwner()) panel.append(button('saveSettings', saveSettings, 'button primary checkin-save',false,{id:'save-lobby-settings'}));
  return panel;
}
function lobbyLaunch() {
  const settings = (isOwner() && settingsDraft) || view.settings;
  const automationChanged = (settings.autoDraw ?? false) !== (view.settings.autoDraw ?? false) ||
    (settings.autoJudgment ?? true) !== (view.settings.autoJudgment ?? true);
  const allReady = seated().length >= 3 && seated().length <= 6 && seated().every(p => p.ready && p.connected);
  const launch = el('div', { class: 'launch-row' });
  if (!view.self.spectator) launch.append(button(ownPlayer()?.ready ? 'unready' : 'readyButton', () => action('ready', { ready: !ownPlayer()?.ready }), ownPlayer()?.ready ? 'button secondary' : 'button primary'));
  // The player-facing start follows identity → five private draws → partner choice.
  if (isOwner()) launch.append(button('startBattlePreview',()=>{
    const code = view.code, arena = view.settings.arena;
    askConfirmation('combatFixture',()=>{
      if(view?.code===code&&view.status==='lobby'&&view.settings.arena===arena)action('startBattlePreview');
    }, t('deckRetail'));
  },'button primary',!allReady||settings.arena!==view.settings.arena||automationChanged));
  return launch;
}
function renderArenaSetup() {
  const main=$('#main'), identity=view.status==='identity';
  const count=seated().filter(p=>identity?p.identityAcknowledged:p.setupComplete).length;
  main.classList.add('match-prep',`theme-${view.settings.arena}`,identity?'prep-identity':'prep-selection');
  main.append(el('div',{class:'prep-toolbar'},
    el('span',{class:'prep-room'},`${t('room')} ${view.code}`),
    el('span',{class:'prep-step'},t(identity?'identityStep':'pokemonStep')),
    el('details',{id:'prep-menu',class:'battle-menu prep-menu'},el('summary',{},t('arenaMenu')),el('div',{class:'battle-menu-body'},crewPanel(),logPanel(),recoveryPanel(),isOwner()?controlPanel():null))));
  const arena = el('div',{class:'prep-battlefield','aria-hidden':'true'},
    worldPanel([],view.selfId,null,view.settings.arena));
  main.prepend(arena);
  main.append(identity ? identityReveal(count) : selectionPanel(count));
  if(view.pendingVote) main.append(el('div',{class:'world-vote'},votePanel()));
}
function gymLeaderPortrait(theme, index) {
  const model=el('span',{class:'leader-model','data-mode':'flat','aria-hidden':'true'},el('span',{class:'leader-model-fallback'},gymTypeIcon(theme)));
  if(richGraphics) queueMicrotask(async()=>{
    try {
      const {createBattlefield}=await import('./battlefield.js');
      if(!model.isConnected || !richGraphics)return;
      leaderPortrait??=createBattlefield();
      leaderPortrait.mount(model,{theme,portraitIndex:index,players:[],reducedMotion:!motionAllowed()});
    } catch { leaderPortrait?.dispose(); leaderPortrait=null; model.dataset.mode='flat'; }
  });
  return model;
}
function identityReveal(count) {
  const spectator = view.self.spectator, acknowledged = view.self.identityAcknowledged;
  const shown = identityFaceShown || acknowledged;
  const leader = view.self.role === 'leader', theme = view.settings.arena;
  const leaderCharacter = {fire:'blaine',water:'misty',grass:'erika'}[theme] || 'blaine';
  const publicLeader = seated().find(p=>p.role==='leader' && p.identityAcknowledged);
  const announcement = publicLeader ? el('div',{class:'leader-announcement'},
    !leader ? gymLeaderPortrait(theme,seated().indexOf(publicLeader)) : null,
    el('span',{},publicLeader.nickname, ' · ', roleName('leader',language))) : null;
  const progress = el('div',{class:'reveal-progress',role:'status'},
    el('span',{},`${t('identityProgress')} · ${count} / ${seated().length}`),
    el('span',{class:'identity-progress-lights','aria-hidden':'true'},
      seated().map((_,index)=>el('i',{'data-viewed':index<count?'true':null}))));
  const briefing = el('div',{class:'identity-briefing'},
    el('div',{class:'reveal-kicker'},t(spectator?'spectatorLabel':'dossier')),
    el('h1',{id:'identity-heading'},t('identityTitle')),el('p',{},t('identityHelp')));
  const panel = el('section',{class:`arena-identity role-ceremony reveal-${theme}`,'aria-labelledby':'identity-heading'},briefing);
  if (spectator) briefing.append(el('p',{},t('identityWaiting')));
  if(announcement) briefing.append(announcement);
  if (spectator) { panel.append(progress); return panel; }
  const insignia = {gym:'⬡',challenger:'✦',rocket:'R'};
  const face = () => el('div',{class:`identity-face ${leader?'identity-leader':view.self.role==='rocket'?'identity-rocket':''}`,'data-revealed-role':view.self.role},
    el('small',{},t(leader?'identityPublic':'privateBadge')),
    leader?gymLeaderPortrait(theme,seated().findIndex(player=>player.id===view.selfId)):el('span',{class:'identity-emblem','aria-hidden':'true'},insignia[view.self.role]||'◆'),
    el('strong',{},roleName(view.self.role,language)),
    leader ? el('span',{class:'leader-character-name'},t(leaderCharacter)) : null);
  const confirm = () => button('identitySeen',()=>action('acknowledgeIdentity'),'button primary',Boolean(view.pendingVote),{id:'acknowledge-identity'});
  const stage = el('div',{class:'identity-stage'});
  const footer = el('div',{class:'identity-footer'});
  if (shown) {
    stage.append(face());
    footer.append(acknowledged?el('p',{},t('identityWaiting')):confirm());
  } else {
    stage.append(el('button',{id:'flip-identity',type:'button',class:'identity-back',disabled:busy||Boolean(view.pendingVote),onclick:()=>{
      identityFaceShown = true;
      const revealed = face();
      const outgoing = stage.firstElementChild;
      const animate = motionAllowed();
      if (animate) {
        outgoing.inert = true;
        outgoing.classList.add('identity-outgoing');
        outgoing.animate([{transform:'rotateY(0deg)'},{transform:'rotateY(90deg) scale(.91)',opacity:0}],{duration:165,fill:'forwards'}).onfinish = () => outgoing.remove();
        stage.append(revealed);
      } else stage.replaceChildren(revealed);
      const next = confirm();
      footer.replaceChildren(next);
      next.focus({preventScroll:true});
      if (animate) revealed.animate([{transform:'rotateY(-90deg) scale(.91)',opacity:.45},{transform:'rotateY(0deg) scale(1)',opacity:1}],{duration:305,delay:165,fill:'backwards',easing:'cubic-bezier(.15,.8,.3,1)'});
    }},el('small',{},language==='zh'?'加密身份档案':'SEALED DOSSIER'),
    el('span',{class:'identity-back-mark','aria-hidden':'true'},'✦'),el('strong',{},t('revealIdentity'))));
  }
  panel.append(el('div',{class:'identity-dossier'},stage,footer),progress);
  return panel;
}
const pokemonTypeNames = {
  normal:['Normal','一般'], fighting:['Fighting','格斗'], flying:['Flying','飞行'], poison:['Poison','毒'],
  ground:['Ground','地面'], rock:['Rock','岩石'], bug:['Bug','虫'], ghost:['Ghost','幽灵'],
  steel:['Steel','钢'], fire:['Fire','火'], water:['Water','水'], grass:['Grass','草'],
  electric:['Electric','电'], psychic:['Psychic','超能力'], ice:['Ice','冰'], dragon:['Dragon','龙'],
  dark:['Dark','恶'], fairy:['Fairy','妖精'],
};
const typeName = type => pokemonTypeNames[type]?.[language==='zh'?1:0] || (language==='zh'?'未知':'Unknown');
function typeIcon(type) {
  const src = typeIconPath(type);
  return src ? el('img',{class:'pokemon-type-icon',src,alt:'',width:60,height:60}) : null;
}
const typeBadge = type => el('span',{class:'draft-type','data-type':type},typeIcon(type),typeName(type));
function pokemonTypeIcon(active, preferredType) {
  const types = pokemonTypes(active?.catalogueId,active?.level);
  const type = types.includes(preferredType) ? preferredType : types[0] || 'normal';
  return typeIcon(type);
}

function startDrawCeremony() {
  if (drawCeremony!=='sealed' || busy || view.pendingVote) return;
  drawCeremony = motionAllowed() ? 'charging' : 'ready';
  render();
  if (drawCeremony==='ready') {
    $('#draw-pokemon')?.focus({preventScroll:true});
    return;
  }
  drawCeremonyTimer = setTimeout(()=>{
    drawCeremony = 'ready';
    render();
    $('#draw-pokemon')?.focus({preventScroll:true});
  },1350);
}

function draftBall(open = false) {
  return el('span',{class:`draft-ball${open?' draft-cradle':''}`,'aria-hidden':'true'},
    el('span',{class:'draft-ball-top'}),el('span',{class:'draft-ball-bottom'}),el('span',{class:'draft-ball-lock'}));
}

function selectionPanel(count) {
  const own = ownPlayer();
  const candidates = view.self.candidates;
  const remaining = view.self.pokemonDrawRemaining || 0;
  const expected = view.scenario?.candidateCount || 5;
  const progress = el('p',{class:'draft-progress',role:'status'},`${t('selectionProgress')} · ${count} / ${seated().length}`);
  const title = el('header',{class:'draft-heading'},
    el('small',{},t(view.settings.arena)),el('h1',{},t('combatPickTitle')),progress);
  if (view.self.spectator || own?.setupComplete) {
    return el('section',{class:'arena-draft draft-waiting'},title,
      el('div',{class:'draft-waiting-message'},el('h2',{},t(view.self.spectator?'watch':'waitingPick')),
        el('p',{},t(view.self.spectator?'watchCopy':'waitingPickCopy')),own?.setupComplete?privateReserve():null));
  }

  selected = selected.filter(id=>candidates.includes(id));
  if (!candidates.includes(inspectedCandidate)) {
    inspectedCandidate = candidates.at(-1) ?? null;
    inspectedLevel = 1;
  }
  const ceremony = candidates.length ? 'ready' : drawCeremony;
  const tray = el('div',{class:'draft-ball-tray'});
  const roster = el('div',{class:'draft-roster-list',role:'group','aria-label':t('partnerLineup')});
  const details = el('aside',{class:'draft-details','aria-label':t('inspectPokemon')});

  function inspect(id) {
    if (inspectedCandidate===id) return;
    inspectedCandidate = id;
    inspectedLevel = 1;
    paintDetails();
  }

  function inspectButton(id,attributes,...content) {
    return el('button',{type:'button','data-candidate':id,...attributes,
      onclick:()=>inspect(id),onfocus:()=>inspect(id),
      onpointerenter:event=>{if(event.pointerType==='mouse')inspect(id);}},...content);
  }

  function paintDetails() {
    const entry = catalogueEntry(inspectedCandidate);
    if (!entry) return;
    for (const control of [...roster.children,...tray.children]) {
      const candidate = control.dataset.candidate;
      if (candidate) control.setAttribute('aria-pressed',String(candidate===entry.id));
    }
    const index = selected.indexOf(entry.id);
    const assign = button(index<0?'choose':index===0?'active':'reserve',()=>{
      selected = index<0 ? [...selected,entry.id] : selected.filter(id=>id!==entry.id);
      render();
    },index<0?'button primary':'button secondary',remaining>0||(index<0&&selected.length>=2)||Boolean(view.pendingVote),
    {id:'assign-draft-partner','aria-pressed':index>=0,
      title:index>=0?(language==='zh'?'取消选择这只宝可梦':'Remove this Pokémon from your lineup'):null});
    details.replaceChildren(
      el('div',{class:'draft-detail-heading'},el('div',{},el('small',{},t('inspectPokemon')),el('h2',{},partnerName(entry.id,inspectedLevel))),
        el('div',{class:'draft-type-row'},pokemonTypes(entry.id,inspectedLevel).map(typeBadge))),
      el('div',{class:'draft-detail-body'},pokemonDetails(entry,inspectedLevel,{
        prefix:'draft-level',compact:true,
        selectLevel:level=>{
          inspectedLevel = level;
          paintDetails();
          document.getElementById(`draft-level-tab-${level}`)?.focus({preventScroll:true});
        },
      })),
      el('div',{class:'draft-detail-actions'},assign));
  }

  const arena = el('div',{class:'draft-center','data-ceremony':ceremony},
    el('div',{class:'draft-portal','aria-hidden':'true'},el('i'),el('i'),el('i')));
  if (ceremony==='sealed') {
    const summonLabel = language==='zh'?'召唤五颗精灵球':'Summon five Poké Balls';
    arena.append(el('div',{class:'draft-summon'},
      el('button',{id:'start-draw-ceremony',type:'button',class:'draft-summon-button','aria-label':summonLabel,
        disabled:busy||Boolean(view.pendingVote),onclick:startDrawCeremony},draftBall(),el('strong',{},summonLabel)),
      el('p',{},language==='zh'?'触碰光阵，召唤你的候选搭档。':'Activate the ring to summon your candidates.')));
  } else {
    for (let index=0;index<expected;index++) {
      const id = candidates[index];
      const number = String(index+1).padStart(2,'0');
      let tile;
      if (id) {
        const entry = catalogueEntry(id), picked = selected.indexOf(id);
        tile = inspectButton(id,{id:`candidate-${id}`,class:`draft-slot draft-revealed ${id===revealedCandidate?'draft-arriving':''}`,
          'aria-label':`${partnerName(id)} · ${t('inspectPokemon')}`},
          el('span',{class:'draft-slot-number'},number),
          el('span',{class:'draft-slot-art'},draftBall(true),
            entry?.portraitImage?.url?el('img',{src:entry.portraitImage.url,alt:'',draggable:false}):null),
          el('strong',{},partnerName(id)),picked>=0?el('small',{class:'draft-slot-pick'},t(picked===0?'active':'reserve')):null);
        roster.append(inspectButton(id,{id:`draft-wheel-${id}`,class:'draft-wheel-option'},
          entry?.portraitImage?.url?el('img',{src:entry.portraitImage.url,alt:'',draggable:false}):null,
          el('span',{},el('strong',{},partnerName(id)),picked>=0?el('small',{},t(picked===0?'active':'reserve')):typeBadge(pokemonTypes(id)[0]))));
      } else {
        const next = ceremony==='ready' && index===candidates.length && remaining>0;
        const type = view.self.candidateTypeHints?.[index-candidates.length];
        tile = el(next?'button':'div',{class:`draft-slot draft-unopened ${next?'draft-next':''}`,
          ...(next?{type:'button',id:'draw-pokemon',disabled:busy||Boolean(view.pendingVote),onclick:()=>action('drawPokemon'),
            'aria-label':`${t('revealPokemon')} ${index+1} / ${expected} · ${typeName(type)}`}:{}),
          'data-type':type},el('span',{class:'draft-slot-number'},number),draftBall(),typeBadge(type),
          next?el('small',{class:'draft-open-label'},t('revealPokemon')):null);
      }
      tile.style.setProperty('--draw-index',index);
      tray.append(tile);
    }
    arena.append(tray,el('p',{class:'draft-draw-count','aria-live':'polite'},
      ceremony==='charging'?(language==='zh'?'光阵正在聚能':'The ring is charging')
        : remaining>0?`${candidates.length} / ${expected} · ${t('cardsDrawn')}`
        : (language==='zh'?'选择出场与后备搭档':'Choose an active Pokémon and a reserve')));
  }
  revealedCandidate = null;
  paintDetails();

  let lastWheel = 0;
  roster.addEventListener('wheel',event=>{
    if (candidates.length<2 || !event.deltaY || event.ctrlKey) return;
    event.preventDefault();
    const now = performance.now();
    if (now-lastWheel<135) return;
    lastWheel = now;
    const next = Math.max(0,Math.min(candidates.length-1,candidates.indexOf(inspectedCandidate)+Math.sign(event.deltaY)));
    inspect(candidates[next]);
    roster.children[next]?.scrollIntoView({block:'nearest',inline:'nearest'});
  },{passive:false});

  const left = el('aside',{class:'draft-wheel','aria-label':t('partnerLineup')},
    el('h2',{},t('partnerLineup')),
    el('p',{class:'draft-wheel-hint'},language==='zh'?'滚轮切换候选':'Scroll to browse candidates'),roster,
    el('div',{class:'draft-picks'},['active','reserve'].map((slot,index)=>
      el('div',{},el('small',{},t(slot)),el('strong',{},selected[index]?partnerName(selected[index]):'—')))),
    button('confirmPick',()=>action('selectPokemon',{activeId:selected[0],reserveId:selected[1]}),'button primary',
      selected.length!==2||remaining>0||Boolean(view.pendingVote),{id:'confirm-partners'}));
  return el('section',{class:`arena-draft ${candidates.length?'draft-inspecting':''}`},title,left,arena,details);
}
const statusKinds = new Set(['burn','flinch','sleep','confusion','paralysis','poison']);
const reinforcementArt = {power:'x-attack.png',defense:'x-defense.png',speed:'x-speed.png'};
const passiveTraitStyles = {blaze:'fire',guts:'fighting',multiscale:'guard',gluttony:'grass',
  chlorophyll:'grass','swift-swim':'water',oblivious:'guard',sniper:'aura','early-bird':'guard'};
function passiveBattleTrait(player) {
  const active = player.active;
  if (!active || active.hp<=0 || active.defeated || active.traitsSuppressed || player.eliminated) return null;
  if (active.catalogueId==='charmander' && active.hp*2<=active.maxHp && active.status!=='burn') return 'blaze';
  if (active.catalogueId==='machop' && active.status) return 'guts';
  if (active.catalogueId==='dratini' && active.level===3 && active.hp===active.maxHp) return 'multiscale';
  if (active.itemEffectReplacement==='gluttony') return 'gluttony';
  if (active.catalogueId==='weedle' && active.level===3) return 'sniper';
  if (active.catalogueId==='kangaskhan') return 'early-bird';
  if (active.fieldTrait) return active.fieldTrait;
  return null;
}
function readyBattleTrait(player) {
  const passive = passiveBattleTrait(player);
  if (passive) return passiveTraitStyles[passive];
  const active = player.active;
  if (!active || active.hp<=0 || active.defeated || active.traitsSuppressed || player.eliminated) return null;
  const pending = view?.pendingBattle;
  if (pending?.actorId===player.id && !view.pendingVote) {
    if (pending.kind==='poison-point') return 'poison';
    if (pending.kind==='static') return 'electric';
  }
  return null;
}
function reinforcementName(kind) {
  const names = language==='zh' ? {power:'力量强化',defense:'防御强化',speed:'速度强化'}
    : {power:'Power',defense:'Defense',speed:'Speed'};
  return names[kind] || kind;
}
function heldItemSummary(active) {
  const replacement = active.itemEffectReplacement==='gluttony'
    ? (language==='zh'?' · 贪吃鬼替换效果：自身回合结束回复1':' · Gluttony replaces effect: own turn-end heal 1') : '';
  return localized(active.item.name)+replacement+(active.itemSuppressed?` · ${t('itemSuppressed')}`:'');
}
function battleSeatDetails(player) {
  const active = player.active;
  if (!active) return [];
  const details = [];
  if (active.item) details.push(['held-item',heldItemSummary(active)]);
  const markers = active.reinforcements || [];
  if (markers.length) {
    const summary = [...new Set(markers)].map(kind=>{
      const count = markers.filter(marker=>marker===kind).length;
      return reinforcementName(kind)+(count>1?` ×${count}`:'');
    }).join(' · ');
    const inactive = active.status==='paralysis' || active.reinforcementsSuppressed;
    details.push(['reinforcements',summary+(inactive?(language==='zh'?' · 不生效':' · inactive'):'')]);
  }
  if (Number.isFinite(active.hp)) {
    details.push(['health',[
      `${active.hp}/${active.maxHp} HP`,
      active.defeated ? t('defeatedPokemon') : active.hp <= 0 ? t('faintingPokemon') : null,
      active.status ? statusName(active.status,language) : null,
      active.traitsSuppressed ? (language==='zh'?'特性失效':'Traits suppressed') : null,
      active.damageProtected ? t('damageProtected') : null,
      player.eliminated ? t('eliminated') : null,
    ].filter(Boolean).join(' · ')]);
  }
  return details;
}
function battleSeatTokens(player,readyTrait) {
  const active = player.active;
  if (!active) return [];
  const tokens = [];
  const add = (kind,title,glyph,{count=1,inactive=false,art=null,icon=null}={})=>{
    tokens.push(el('span',{class:'world-token','data-token':kind,'data-inactive':inactive?'true':null,title,role:'img','aria-label':title},
      art?el('img',{src:art,alt:'',draggable:false})
        :icon || el('span',{class:'world-token-mark','aria-hidden':'true'},glyph),
      count>1?el('b',{class:'world-token-count','aria-hidden':'true'},count):null));
  };
  if (player.eliminated) add('out',t('eliminated'),'×');
  else if (active.defeated || active.hp<=0) add('out',t(active.defeated?'defeatedPokemon':'faintingPokemon'),'♥');
  if (statusKinds.has(active.status)) {
    add(active.status,statusName(active.status,language),'',{art:`/battle-token-art/${active.status}.png`});
  }
  const markers = active.reinforcements || [];
  const inactive = active.status==='paralysis' || active.reinforcementsSuppressed;
  for (const kind of new Set(markers)) {
    const count = markers.filter(marker=>marker===kind).length;
    const title = reinforcementName(kind)+(count>1?` ×${count}`:'')+(inactive?(language==='zh'?' · 不生效':' · inactive'):'');
    const art = reinforcementArt[kind];
    add(kind,title,'↑',{count,inactive,art:art?`/play-card-art/${art}`:null});
  }
  if (active.item) {
    const art = playCardFace({kind:'held-item',itemType:active.item.itemType},language).art[0];
    add('item',heldItemSummary(active),'◇',{art:art?`/play-card-art/${art}`:null,inactive:active.itemSuppressed});
  }
  if (active.traitsSuppressed) add('suppressed',language==='zh'?'特性失效':'Traits suppressed','⊘');
  if (active.damageProtected) add('protected',t('damageProtected'),'⬟');
  if (readyTrait) {
    const face = catalogueEntry(active.catalogueId)?.levels.find(level=>level.level===active.level);
    if (face?.traitName) add(`trait-${readyTrait}`,`${localized(face.traitName)} · ${language==='zh'?'条件已满足':'Condition met'}`,'',
      {icon:pokemonTypeIcon(active,readyTrait)});
  }
  return tokens;
}
function compactBattleSeat(player,leader,theme) {
  const active = player.active;
  const name = partnerName(active.catalogueId,active.level);
  const health = `${active.hp}/${active.maxHp}`;
  const low = active.hp*3<=active.maxHp;
  const healthFill = el('span');
  healthFill.style.width = `${active.maxHp>0?Math.max(0,Math.min(100,100*active.hp/active.maxHp)):0}%`;
  const id = `active-details-${player.id}`;
  const title = [name,`${player.nickname} · ${player.handCount} ${t('cards')}`,`${t('level')} ${active.level} · ${health} HP`,
    player.role?roleName(player.role,language):null,
    player.reserve?`${t('publicReserve')}: ${partnerName(player.reserve.catalogueId,player.reserve.level)}`:null].filter(Boolean).join(' · ');
  return el('button',{type:'button',id,class:'pokemon-name-button world-compact-badge',title,'aria-label':title,
    onclick:()=>openPokemonDetails(active.catalogueId,active.level,id)},
    el('span',{class:'world-compact-name'},el('strong',{},name),el('small',{},`Lv.${active.level}`)),
    el('span',{class:'world-compact-vitals'},
      el('span',{class:`world-compact-hp${low?' hp-low':''}`},el('span',{'aria-hidden':'true'},'♥'),el('b',{class:'world-hp-value'},health)),
      el('span',{class:'world-compact-trainer'},player.nickname),
      player.role?el('span',{class:'world-compact-role','aria-hidden':'true'},
        leader ? gymTypeIcon(theme) : {gym:'◆',rocket:'R',challenger:'✦'}[player.role]):null),
    el('span',{class:`world-hp-track${low?' hp-low':''}`,'aria-hidden':'true'},healthFill));
}
function worldPanel(players, viewerId, turnId, theme) {
  const host=el('section', {class:`world-host world-${theme}${players.length>=5?' world-crowded':''}`, 'data-mode':'flat', 'aria-label':t(theme)});
  const labels=el('div',{class:'world-labels'});
  const sprites=el('div',{class:'world-sprites','aria-hidden':'true'});
  const targetLayer=el('div',{class:'world-targets'});
  const showLeader = player => player.role==='leader' && (view?.status!=='identity' || player.identityAcknowledged);
  const coastalBattle = theme==='water' && ['playing','finished'].includes(view?.status);
  const layout = coastalBattle
    ? coastalSeatLayout(players.map(player=>({id:player.id,leader:showLeader(player)})),viewerId)
    : seatLayout(players,viewerId);
  for(const [index,player] of players.entries()) {
    const position=layout[index], own=player.id===viewerId;
    const side = Math.sin(position.angle), depth = Math.cos(position.angle);
    const compact=Number.isFinite(player.active?.hp), leader=showLeader(player);
    const responding=view?.status==='playing' && player.id===view.pendingBattle?.actorId;
    const label=el('article',{class:`world-seat ${compact?'world-seat-compact':''} ${player.id===turnId?'world-active':''} ${own?'world-self':''} ${leader?'world-leader':''} ${responding?'world-responding':''}`, 'data-seat-id':player.id, 'data-near-side':depth>.2 && Math.abs(side)>.1?'true':null},
      compact?compactBattleSeat(player,leader,theme):[
      el('div',{class:'world-seat-top'},el('strong',{},player.nickname),el('span',{},showLeader(player)?el('abbr',{title:roleName('leader',language),'aria-label':roleName('leader',language)},gymTypeIcon(theme)):own?t('you'):`${String(index+1).padStart(2,'0')}`)),
      el('div',{class:'world-seat-bottom'},el('span',{title:player.reserve?`${t('publicReserve')}: ${partnerName(player.reserve.catalogueId,player.reserve.level)} · ${player.reserve.level}`:player.active?`${t('level')} ${player.active.level}`:null},player.active?el('button',{type:'button',class:'pokemon-name-button',id:`active-details-${player.id}`,title:t('inspectPokemon'),onclick:()=>openPokemonDetails(player.active.catalogueId,player.active.level,`active-details-${player.id}`)},`${partnerName(player.active.catalogueId,player.active.level)} · ${player.active.level}`):view?.status==='identity'?roleName(leader?'leader':null,language):view?.status==='setup'?t(player.setupComplete?'chosen':'choosing'):t('noActive')),el('small',{},view?.status==='setup'?`${player.candidateDrawCount ?? 0} / 5`:view?.status==='identity'?(player.identityAcknowledged?'✓':'—'):`${player.handCount} ${t('cards')}`))]);
    const flatLeft = `${50+side*34}%`, flatTop = `${57+depth*25}%`;
    label.style.setProperty('--seat-side', Math.abs(side)<.01 ? 0 : Math.sign(side));
    label.style.setProperty('--flat-left', flatLeft);
    label.style.setProperty('--flat-top', flatTop);
    if(!compact && leader)label.append(el('small',{class:'world-leader-title'},roleName('leader',language)));
    const tokens = compact ? battleSeatTokens(player,readyBattleTrait(player)) : [];
    if (tokens.length) label.append(el('div',{class:'world-status-tokens'},tokens));
    const entry=player.active && catalogueEntry(player.active.catalogueId);
    const art=entry?.levels?.find(face=>face.level===player.active.level)?.portraitImage?.url || entry?.portraitImage?.url;
    if(art && !player.eliminated && !player.active?.defeated) {
      const sprite=el('img',{class:'world-sprite','data-sprite-id':player.id,src:art,alt:'',draggable:false});
      sprite.style.setProperty('--flat-left', flatLeft);
      sprite.style.setProperty('--flat-top', flatTop);
      sprite.style.setProperty('--pokemon-scale', pokemonLevelScale(player.active.level));
      sprite.addEventListener('load',()=>battlefield?.refresh(),{once:true});
      sprites.append(sprite);
    }
    labels.append(label);
    if (view?.status==='playing') {
      const targetLabel = player.active ? `${player.nickname} · ${partnerName(player.active.catalogueId,player.active.level)}` : player.nickname;
      const addTarget = (slot, title, content) => {
        const target = el('button',{type:'button',class:slot?'world-target world-target-reserve':'world-target',
          hidden:true,id:`aim-${player.id}${slot?'-reserve':''}`,'data-target-seat':player.id,
          'data-target-slot':slot,'aria-label':title,title,onclick:()=>{
            if (arenaPrompt?.onTarget) { arenaPrompt.onTarget(player.id,slot); return; }
            const choice = host.closest('.match-stage')?.querySelector(`[data-arena-seat="${CSS.escape(player.id)}"]`);
            if (choice && !choice.disabled) {
              choice.click();
              if (!busy) syncArenaPrompt();
            }
          }},content);
        target.style.setProperty('--flat-left',flatLeft);
        target.style.setProperty('--flat-top',flatTop);
        if (slot) target.style.setProperty('--reserve-direction',side>.1?-1:1);
        targetLayer.append(target);
      };
      addTarget(null,targetLabel,el('span',{'aria-hidden':'true',class:'aim-marker'},'✦'));
      const reserve = own ? view.self.reserve : player.reserve;
      if (reserve) addTarget('reserve',`${player.nickname} · ${t('reserve')} · ${partnerName(reserve.catalogueId,reserve.level)}`,
        [partnerImage(reserve),el('small',{},language==='zh'?'备战':'Reserve')]);
    }
  }
  host.append(el('div',{class:'flat-field','aria-hidden':'true'},el('div',{class:'field-centre'})),sprites,labels,targetLayer,
    el('span',{class:'renderer-status'},t('fallbackView')));
  if(richGraphics) queueMicrotask(async()=>{
    try {
      if(!host.isConnected || !richGraphics)return;
      if (!battlefield) {
        const {createBattlefield}=await import('./battlefield.js');
        if(!host.isConnected || !richGraphics)return;
        battlefield??=createBattlefield();
      }
      const stage = host.closest('.match-stage');
      const inBattle = stage || host.closest('.result-arena');
      const pending = view?.pendingBattle;
      const focus = pending?.camera || arenaEffect ||
        (pending?.targetId ? {targetIds:[pending.targetId],sourceId:turnId} : null);
      battlefield.mount(host,{
        players:players.map(p=>{
          const passiveTrait = stage ? passiveBattleTrait(p) : null;
          return {id:p.id,role:p.role,leader:showLeader(p),active:p.eliminated?null:p.active,eliminated:p.eliminated,
            trainerAvatar:p.trainerAvatar,passiveTrait,passiveStyle:passiveTraitStyles[passiveTrait]};
        }),
        roomCode:view?.code, viewerId,turnId,turnNumber:stage ? view.turn?.number : null,
        theme,camera:cameraMode,focus,coastalBattle:Boolean(inBattle && theme==='water'),
        defendingTrainerId:pending?.kind==='defense' ? pending.actorId : null,
        victoryWinners:stage ? null : view?.result?.winnerIds,
        rescuePanel:Boolean(stage && pending?.kind==='rescue' && pending.actorId===view.selfId),
        draftCenter:view?.status==='setup'?$('.draft-center',host.closest('main')):null,
        language, reducedMotion:!motionAllowed(),
        waterMotion:Boolean(inBattle && theme==='water' && !reducedMotion && previewOptions.get('water-motion')==='on'),
        eventTypes:stage ? view.self.hand.filter(card=>card.kind==='event').map(card=>card.eventType) : [],
        activeCardEvent:inBattle ? view.activeCardEvent : null,
        playCue:gameAudio.playBattleCue,
        cues:inBattle ? arenaCues.splice(0) : [],
      });
      if (stage) { syncArenaPrompt(); animateHandDeal(); }
    } catch (error) {
      console.warn('3D battlefield initialization failed',error);
      host.dataset.mode='flat';
      host.dataset.reason=error?.message?.includes('WebGL') ? 'webgl' : 'renderer';
      host.dataset.detail=error?.message || 'Unknown renderer error';
      battlefield?.dispose(); battlefield=null;
      if (host.isConnected) animateHandDeal();
    }
  });
  else { battlefield?.dispose(); battlefield=null; }
  return host;
}
function cameraControls() {
  return el('div',{class:'camera-controls'},button('trainerCamera',()=>{cameraMode='table';render();},`button ${cameraMode==='table'?'selected':''}`),button('overheadCamera',()=>{cameraMode='overhead';render();},`button ${cameraMode==='overhead'?'selected':''}`));
}
function arenaControl(id,label,className,icon,onclick,disabled=false) {
  return el('div',{class:'arena-quick-control'},
    el('button',{type:'button',id,class:`arena-quick-button ${className}`,'aria-label':label,disabled:busy||disabled,onclick},icon),
    el('span',{class:'arena-quick-tooltip','aria-hidden':'true'},label));
}
const traitChoices = {download:downloadDialog,'vital-spirit':vitalSpiritDialog,reckless:recklessDialog,analytic:analyticDialog};
function arenaTraitButton() {
  const battle = view.self.battle;
  if (!battle?.canTrait) return null;
  const active = ownPlayer()?.active;
  const face = catalogueEntry(active?.catalogueId)?.levels.find(level=>level.level===active.level);
  const name = battle.trait?.name || face?.traitName;
  const label = name ? localized(name) : t('useTrait');
  const choose = traitChoices[battle.trait?.kind];
  return el('button',{type:'button',id:'arena-trait',class:'button secondary trait-control',disabled:busy,onclick:()=>{
    if (choose) { choose(combatKit()); return; }
    openArenaPrompt(el('section',{class:'arena-prompt arena-trait-prompt',tabindex:-1,'aria-label':label},
      el('h2',{},partnerImage(active),label),
      face?.abilityText?el('p',{},localized(face.abilityText)):null,
      el('div',{class:'action-row'},button('cancelAction',()=>closeArenaPrompt(),'button secondary'),
        button('useTrait',()=>{
          if (!myTurn() || !view.self.battle?.canTrait) return;
          closeArenaPrompt(false);
          action('useTrait');
        },'button primary',false,{id:'confirm-arena-trait'}))));
  }},partnerImage(active),el('span',{},el('small',{},t('traitLabel')),el('strong',{},label)));
}
function renderBattleRoom() {
  const current=view.players.find(p=>p.id===view.turn?.playerId);
  const main=$('#main');
  const theme=view.settings.arena;
  main.classList.add('battle-live','match-table',`theme-${theme}`);
  const pending = view.pendingBattle;
  const responder = pending && view.players.find(p=>p.id===pending.actorId);
  const canRespond = pending?.actorId===view.selfId && !view.self.spectator;
  const headline = pending ? canRespond?t('responseNow'):(language==='zh'?`等待 ${responder?.nickname||'—'} 响应`:`Waiting for ${responder?.nickname||'—'} to respond`)
    : myTurn()?t('currentTurn'):(language==='zh'?`${current?.nickname||'—'} 的回合`:`${current?.nickname||'—'}’s turn`);
  const menu=el('details',{id:'match-menu',class:'battle-menu'},el('summary',{},t('arenaMenu')),el('div',{class:'battle-menu-body'},!view.self.spectator?trainerTray():null,crewPanel(),logPanel(),recoveryPanel(),isOwner()?controlPanel():null));
  const ribbon=el('header',{class:'match-ribbon'},
    el('div',{class:'venue-mark','aria-hidden':'true'},gymTypeIcon(theme)),
    el('div',{class:'venue-name'},el('h1',{},t(theme)),el('small',{},`${t('room')} ${view.code}${connected?'':` · ${t('reconnecting')}`}`)),
    el('span',{class:'match-round'},`${t('round')} ${view.turn?.number ?? '—'}`),menu);
  const canJudge = canRespond && pending.kind==='reveal-judgment' && !view.pendingVote;
  const canDraw = myTurn() && turnPhase()==='draw' && view.turn.drawRemaining>0;
  const deckAction = canJudge ? () => action('respondBattle',{decisionId:pending.id,choice:'reveal'}) : () => action('draw');
  const deckLabel = canJudge ? (language==='zh'?'翻开判定':'Reveal judgment') : canDraw ? t('draw') : t('deckPile');
  const showDeck = canJudge || (!view.self.spectator && !ownPlayer()?.eliminated && view.turn?.playerId===view.selfId);
  const deck = el('div',{class:'screen-deck','data-hand-deck':''},showDeck ? el('button',{
    class:'table-deck',id:'arena-deck',type:'button',disabled:busy||(!canDraw&&!canJudge),
    'aria-label':deckLabel,'data-judgment':canJudge?'true':null,onclick:deckAction,
  },el('span',{class:'table-deck-back','aria-hidden':'true'},'◉'),
    el('span',{class:'table-deck-caption'},deckLabel,el('b',{},view.drawCount ?? 0))) : null);
  const stage=el('div',{class:'match-stage'},
    worldPanel(seated(),view.selfId,view.turn?.playerId,theme),cameraControls());
  const rail=el('aside',{class:'match-rail match-progress'},
    el('div',{class:`turn-console ${canRespond?'response-console':myTurn()?'active-console':''}`},
      theme==='water'?el('span',{class:'coastal-round'},`${t('round')} ${view.turn?.number ?? '—'}`):null,
      el('h2',{role:'status'},headline),phaseStrip()));
  stage.append(ribbon,rail);
  if (theme==='water') stage.append(el('div',{class:'coastal-cue',hidden:true,'aria-hidden':'true','data-resting-cue':pending?headline:''}));
  main.append(stage);
  if (pending) {
    const response = decisionPanel(view,combatKit());
    if (canJudge) {
      response.querySelector('#reveal-judgment')?.remove();
      response.append(el('p',{},language==='zh'?'点击高亮的牌堆，翻开判定牌。':'Select the highlighted deck to turn over the judgment card.'));
    }
    if (canRespond && response.querySelector('[data-arena-seat]')) response.append(
      el('p',{class:'arena-response-target-hint'},language==='zh'?'点击战场上高亮的训练家。':'Choose the highlighted trainers on the field.'));
    stage.append(el('aside',{class:'match-rail arena-has-response'},
      canRespond?response:el('details',{id:'match-response-details',class:'response-details'},
        el('summary',{id:'response-details-toggle'},t('responseDetails')),response)));
  }
  if(view.pendingVote) main.append(el('div',{class:'world-vote'},votePanel()));
  if(view.self.spectator) {
    if (!pending) rail.append(el('p',{class:'rail-waiting'},t('watchCopy')));
  } else {
    stage.append(el('div',{class:`match-tray${theme==='water' && coastalHandExpanded?' hand-expanded':''}`},handPanel(theme==='water'),deck));
    if (!pending && myTurn() && ['play','end'].includes(turnPhase())) {
      const switchLabel = t(view.turn.switchUsed?'switchUsed':'switchPokemon');
      const tier = view.self.reserve?.level ?? 1;
      const playing = turnPhase()==='play';
      stage.append(el('div',{class:'arena-quick-actions'},
        playing?arenaControl('arena-switch',switchLabel,'switch-control',el('span',{class:'reserve-ball','data-tier':tier,'aria-hidden':'true'}),
          confirmPartnerSwitch,view.turn.switchUsed||!view.self.reserve||(view.gameMode==='combat-preview'&&!view.self.battle?.canSwitch)):null,
        arenaControl('arena-finish',t(playing?'finishPlay':'endTurn'),'arena-finish',el('span',{'aria-hidden':'true'},'✓'),
          playing?()=>{ closeArenaPrompt(false); action('finishPlay'); }:confirmTurnEnd)));
    }
    if (!pending) rail.append(el('div',{class:'battle-actions'},el('p',{},phaseHint()),
      myTurn()?[
      view.self.battle?.lightBallTargets?.length?el('button',{type:'button',id:'use-light-ball',class:'button secondary',disabled:busy,onclick:()=>lightBallDialog(combatKit())},language==='zh'?'使用电气球':'Use Light Ball'):null,
      ...(view.self.battle?.muscleBand?view.self.battle.moves.filter(move=>move.canUse&&move.condition?.kind==='command'&&move.legalTargetIds.length).map(move=>
        el('button',{type:'button',id:`muscle-band-${move.index}`,class:'button secondary',disabled:busy,onclick:()=>attackDialog(null,combatKit(),move.index)},`${language==='zh'?'力量头带':'Muscle Band'} · ${localized(move.name)}`)):[]),
      view.self.battle?.canGive ? button('giveCards',()=>giftCardsDialog(combatKit()),'button secondary trait-control') : null,
      arenaTraitButton(),
      ]:null));
  }
  const latest=view.log.at(-1);
  if(latest && !latest.judgment) stage.append(el('div',{class:'rail-activity'},el('p',{},localized(latest.text))));
  renderArenaJudgment(stage);
  renderArenaEvent(stage);
  syncArenaPrompt();
}
function renderBattlePreview() {
  const ids=['pikachu','charmander','squirtle','bulbasaur','vulpix','mankey'];
  const players=ids.map((id,i)=>({id:`preview-${i}`,nickname:i===0?t('you'):`${t('previewPlayer')} ${i+1}`,role:i===0?'leader':null,handCount:4,active:{catalogueId:id,level:1}}));
  $('#main').append(worldPanel(players,'preview-0','preview-0',previewTheme),
    el('div',{class:'battle-hud'},el('div',{},el('span',{class:'hud-kicker'},t('visualPreview')),el('h1',{},t(previewTheme))),button('newAdventure',()=>{scenePreview=false;render();},'button secondary')),
    cameraControls(),el('div',{class:'preview-themes'},...gymThemes.map(theme=>button(theme,()=>{previewTheme=theme;render();},`button ${previewTheme===theme?'selected':''}`))),
    el('div',{class:'preview-hand'},...Array.from({length:4},(_,i)=>el('div',{class:'preview-slot'},el('small',{},`0${i+1}`),el('span',{},t('previewCard'))))),
    el('p',{class:'preview-caption'},t('previewNotice')));
}
function privateReserve() {
  const publicReserve=ownPlayer()?.reserve;
  const reserve=view.self.reserve;
  const condition=reserve?.defeated?t('defeatedPokemon'):publicReserve?`${publicReserve.hp}/${publicReserve.maxHp} ${t('hp')}`:null;
  return el('div', { class: 'reserve-box' }, el('span', { class: 'private-lock', 'aria-hidden': true }, '◇'),
    el('div', {}, el('small', {}, t(publicReserve?'publicReserve':'reserve')),
      reserve?el('button',{type:'button',id:'reserve-details',class:'pokemon-name-button',title:t('inspectPokemon'),onclick:()=>openPokemonDetails(reserve.catalogueId,reserve.level,'reserve-details')},`${partnerName(reserve.catalogueId,reserve.level)} · ${reserve.level}`):el('strong',{},'—'),
      condition?el('small',{},condition):null,
      reserve?.item?el('small',{},`${t('reserveItem')}: ${localized(reserve.item.name)}`):null),
    tag(t(publicReserve?'publicReserve':'privateBadge'), 'private-tag'));
}
function trainerTray() {
  const player=ownPlayer();
  const canReveal = view.gameMode==='combat-preview' && view.status==='playing' && player && !player.eliminated && !player.role;
  return el('section',{class:'tray-trainer'},
    el('span',{class:'trainer-avatar','aria-hidden':'true'},Array.from(player?.nickname||'?')[0]),
    el('div',{class:'tray-trainer-name'},el('strong',{},player?.nickname||t('you')),
      view.self.role?el('small',{},roleName(view.self.role,language)):null,
      canReveal && myTurn() && turnPhase()==='play' ? button('revealRole',()=>{
        const code = view.code;
        askConfirmation('revealRoleConfirm',()=>{
          if (view?.code===code && myTurn() && turnPhase()==='play' && !ownPlayer()?.role) action('revealRole');
        });
      },'button subtle small',busy) : null),
    privateReserve());
}
function handPanel(coastal = false) {
  const canDiscard = myTurn() && turnPhase() === 'discard' && view.self.hand.length > ownHandLimit();
  const cards = el('div', { class: 'hand-cards', id:coastal?'coastal-hand-cards':null });
  for (const [index, card] of view.self.hand.entries()) {
    const commandMoves=(view.self.battle?.moves||[]).filter(move=>move.condition?.kind==='command');
    const weatherMoves=(view.self.battle?.moves||[]).filter(move=>move.condition?.kind==='weather-card'&&move.condition.weatherIconsInCondition.includes(card.weather));
    const applicableMoves=[...(card.kind==='command'?commandMoves:[]),...weatherMoves];
    const chooseMove=applicableMoves.length>1;
    const canUseMove=move=>move.canUse&&!(move.condition?.kind==='command'&&ownPlayer()?.active?.status==='paralysis'&&!['intense-sun','clear'].includes(card.weather));
    const use=applicableMoves.length ? el('button',{type:'button',class:'button card-play',disabled:busy||!applicableMoves.some(canUseMove),
      onclick:()=>chooseMove?moveChoiceDialog(card,combatKit()):attackDialog(card,combatKit(),applicableMoves[0].index)},
      chooseMove?(language==='zh'?'选择招式':'Choose move'):applicableMoves[0].condition.kind==='command'
        ? t('playMove') : localized(applicableMoves[0].name)):null;
    const tool=card.kind==='tool'?view.self.battle?.tools?.find(tool=>tool.toolType===card.toolType):null;
    const toolUse=tool?el('button',{type:'button',class:'button card-play',id:`use-tool-${card.id}`,disabled:busy||!myTurn()||turnPhase()!=='play'||!tool.choices.some(toolChoiceEnabled),onclick:()=>toolDialog(card,combatKit())},language==='zh'?'使用道具':'Use tool'):null;
    const event=card.kind==='event'?view.self.battle?.events?.find(event=>event.eventType===card.eventType):null;
    const eventUse=event?el('button',{type:'button',class:'button card-play',id:`use-event-${card.id}`,disabled:busy||!myTurn()||turnPhase()!=='play'||!event.canUse,onclick:()=>eventDialog(card,combatKit())},language==='zh'?'使用事件':'Use event'):null;
    const tilt = Math.max(-7, Math.min(7, (index - (view.self.hand.length-1)/2)*2.5));
    const face = playCardFace(card,language);
    const itemUse = card.kind==='held-item' && view.self.battle?.equipItems?.some(item=>item.itemType===card.itemType)
      ? button('equipItem',()=>equipItemDialog(card,combatKit()),'button card-play',!view.self.battle?.canEquip) : null;
    const handCard = el('article',{class:`hand-card hand-kind-${card.kind||'other'}`,'data-card-id':card.id},
      el('div',{class:'hand-card-meta'},
        el('span',{},face.category),
        el('span',{'aria-hidden':'true'},String(index+1).padStart(2,'0'))),
      el('div',{class:`hand-card-art${face.art.length>1?' hand-card-art-split':''}`,'aria-hidden':'true'},
        face.art.map(filename=>el('img',{src:`/play-card-art/${filename}`,alt:'',draggable:false}))),
      el('strong',{},localized(card.name)),
      face.brief ? el('p',{class:'hand-card-brief'},face.brief) : null,
      card.weather ? el('small',{class:'hand-card-weather','data-weather':card.weather},weatherLabel(card.weather,language)) : null,
      el('div',{class:'hand-card-actions'},itemUse,use,toolUse,eventUse,
        button('discard',()=>action('discard',{cardId:card.id}),'button card-discard',!canDiscard,{id:`discard-${card.id}`})));
    handCard.style.setProperty('--hand-tilt',`${tilt}deg`);
    handCard.style.setProperty('--hand-drop',`${Math.abs(tilt)*1.1}px`);
    cards.append(handCard);
  }
  const toggle = coastal ? el('button',{
    type:'button',id:'coastal-hand-toggle',class:'coastal-hand-toggle','aria-expanded':String(coastalHandExpanded),
    'aria-controls':'coastal-hand-cards',onclick:event=>{
      coastalHandExpanded = !coastalHandExpanded;
      event.currentTarget.setAttribute('aria-expanded',String(coastalHandExpanded));
      event.currentTarget.closest('.match-tray').classList.toggle('hand-expanded',coastalHandExpanded);
    },
  },language==='zh'?'牌面详情':'Card details') : null;
  return el('section',{class:'hand-panel','aria-label':t('handTitle')},
    el('div',{class:'section-heading'},
      view.self.exiledCount?el('small',{class:'exiled-count'},`${language==='zh'?'暂时移出':'Removed'}: ${view.self.exiledCount}`):null,toggle),
    cards);
}
function logPanel() {
  const list = el('ol', { class: 'activity-list' });
  for (const item of view.log.slice(-8).reverse()) list.append(el('li', {}, el('span', { class: 'log-dot', 'aria-hidden': true }), el('span', {}, localized(item.text))));
  if (!view.log.length) list.append(el('li', { class: 'muted' }, t('logEmpty')));
  return el('section', { class: 'panel log-panel' }, el('h2', {}, t('log')), list);
}
function recoveryPanel() {
  const tokenInput = el('input', { id: 'private-credential', type: credentialVisible ? 'text' : 'password', value: session?.token || '', readonly: true, autocomplete: 'off', spellcheck: false, 'aria-label': t('credential') });
  const details = el('details', { id:'seat-recovery', class: 'panel recovery-panel' }, el('summary', {}, t('privacy')), el('p', { class: 'muted' }, t('privacyText')), el('label', { class: 'field' }, el('span', {}, t('roomCode')), el('input', { readonly: true, value: session?.code || '', 'aria-label': t('roomCode') })), tokenInput,
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
function pokemonDetails(entry, selectedLevel, {prefix='pokemon',compact=false,selectLevel}={}) {
  const face=entry.levels.find(item=>item.level===selectedLevel)||entry.levels[0];
  const showLevel = selectLevel || (level=>{
    openDialog(`pokemon:${entry.id}:${level}`);
    document.getElementById(`${prefix}-tab-${level}`)?.focus();
  });
  const tabs=el('div',{class:'pokemon-level-tabs',role:'tablist','aria-label':t('evolutionLine')});
  for(const item of entry.levels) tabs.append(el('button',{type:'button',role:'tab',id:`${prefix}-tab-${item.level}`,'aria-selected':item.level===face.level,'aria-controls':`${prefix}-level-panel`,tabindex:item.level===face.level?0:-1,onclick:()=>showLevel(item.level),onkeydown:event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault(); const levels=entry.levels.map(f=>f.level),index=levels.indexOf(item.level);
    const next=event.key==='Home'?levels[0]:event.key==='End'?levels.at(-1):levels[(index+(event.key==='ArrowRight'?1:-1)+levels.length)%levels.length];
    showLevel(next);
  }},el('small',{},`${t('level')} ${item.level}`),el('strong',{},localized(item.name)),el('span',{},`${item.hp} ${t('hp')}`)));
  const portrait=face.portraitImage?.url||(face.level===1?entry.portraitImage?.url:null);
  const panel=el('section',{class:'pokemon-level-panel',id:`${prefix}-level-panel`,role:'tabpanel','aria-labelledby':`${prefix}-tab-${face.level}`},
    el('div',{class:'pokemon-form-heading'},el('div',{},el('small',{},`${t('level')} ${face.level}`),el('h3',{},localized(face.name)),
      compact?null:el('div',{class:'pokemon-detail-types'},pokemonTypes(entry.id,face.level).map(typeBadge))),
      el('strong',{class:'pokemon-hp-badge'},`${face.hp} ♥ ${t('hp')}`)),
    portrait?el('div',{class:'pokemon-detail-portrait'},el('img',{src:portrait,alt:localized(face.name)})):null,
    el('section',{class:'pokemon-ability-section'},el('small',{class:'pokemon-section-label'},t('traitLabel')),el('h4',{},face.traitName?localized(face.traitName):t('abilityPending')),face.abilityText?el('p',{},localized(face.abilityText)):null),
    el('section',{class:'pokemon-moves-section'},el('small',{class:'pokemon-section-label'},t('movesLabel')),
      ...(face.moves?.length?face.moves.map(move=>el('article',{class:'pokemon-move'},el('div',{class:'pokemon-move-heading'},el('h4',{},localized(move.name)),move.printedValue!=null?tag(`${t('printedValue')} ${move.printedValue}`):null),
        el('small',{},moveCostText(move)),
        el('p',{},move.effectParagraphStatus==='none-printed'?(language==='zh'?'此招式没有额外的效果段落。':'No additional printed effect.'):move.effectText?localized(move.effectText):t('movesPending')),
        ...(move.unresolvedSymbols||[]).map(symbol=>el('p',{class:'pokemon-uncertainty'},localized(symbol)))
      )):[el('p',{class:'muted'},t('movesPending'))])),
    el('p',{class:'pokemon-effect-status'},t(face.effectStatus==='combat-preview'?'previewEffects':'effectsPending')),
    face.effectUnavailableReason?el('p',{class:'pokemon-uncertainty'},localized(face.effectUnavailableReason)):null);
  return [compact?null:el('p',{class:'pokemon-detail-help'},t('abilityHelp')),tabs,panel];
}

function pokedexList() {
  const search = el('input',{type:'search',id:'catalogue-search',placeholder:t('search'),'aria-label':t('search'),value:dexQuery});
  const types = [...new Set(catalogue.flatMap(entry=>entry.levels.flatMap(face=>pokemonTypes(entry.id,face.level))))]
    .sort((a,b)=>typeName(a).localeCompare(typeName(b),language));
  const filter = el('select',{id:'catalogue-type','aria-label':t('allTypes')},
    el('option',{value:''},t('allTypes')),types.map(type=>el('option',{value:type},typeName(type))));
  filter.value = dexType;
  const count = el('span',{class:'dex-count',role:'status'});
  const grid = el('div',{class:'dex-grid'});
  function update() {
    dexQuery = search.value;
    dexType = filter.value;
    const query = dexQuery.trim().toLowerCase();
    const entries = catalogue.flatMap(entry=>{
      const face = entry.levels.find(face=>
        [entry.id,...Object.values(face.name)].some(name=>name.toLowerCase().includes(query)) &&
        (!dexType || pokemonTypes(entry.id,face.level).includes(dexType)));
      return face ? [{entry,face}] : [];
    });
    count.textContent = language==='zh' ? `${entries.length} / ${catalogue.length} 组` : `${entries.length} of ${catalogue.length} groups`;
    grid.replaceChildren(...entries.map(({entry,face})=>{
      const portrait = face.portraitImage?.url || entry.portraitImage?.url;
      const badgeTypes = pokemonTypes(entry.id,face.level);
      return el('button',{type:'button',id:`dex-card-${entry.id}`,class:'dex-card','data-type':badgeTypes[0],onclick:()=>{
        dexFocus = entry.id;
        openDialog(`dex:${entry.id}:${face.level}`);
      }},el('span',{class:'dex-card-art'},portrait?el('img',{src:portrait,alt:'',loading:'lazy'}):null),
      el('span',{class:'dex-card-caption'},el('strong',{},localized(face.name)),
        el('span',{class:'dex-types'},badgeTypes.map(typeBadge))));
    }));
    if (!entries.length) grid.append(el('p',{class:'dex-empty'},catalogue.length?t('noResults'):(language==='zh'?'正在加载图鉴…':'Loading Pokédex…')));
  }
  search.addEventListener('input',update);
  filter.addEventListener('change',update);
  update();
  return [el('div',{class:'dex-tools'},search,filter,count),grid];
}

const flowStages = [
  {id:'identity',title:['Reveal identities','揭示身份'],copy:['Reveal and confirm your identity. The Gym Leader is public. The Gym team, Challengers and Team Rocket pursue different victory conditions.','翻开并确认你的身份。馆主身份公开，其余身份保密。道馆阵营、挑战者与火箭队各有不同的胜利条件。']},
  {id:'partners',title:['Choose partners','选择搭档'],copy:['Open five Poké Balls from the shared Pokémon deck. Choose one active partner and one private reserve. The Gym Leader’s active partner starts at level 2. All other partners start at level 1. Everyone draws four starting cards from the 108-card Master Edition deck, then the Gym Leader takes the first turn.','从共用牌库开启五颗精灵球，选择一只出战搭档和一只私密后备。馆主的出战搭档从 2 级开始，其余搭档从 1 级开始。每人从 108 张原版大师版牌库摸四张起始手牌，由馆主先行动。']},
  {id:'turn',title:['Take a turn','进行回合'],steps:[
    [['Draw','摸牌'],['Draw two cards.','摸两张牌。']],
    [['Play','出牌'],['Use moves, play cards or switch partners once.','使用招式、打出卡牌，或普通交替一次。']],
    [['Discard','弃牌'],['Normally keep up to four cards.','通常将手牌弃至四张以内。']],
    [['End','结束'],['You may level up your active partner, up to level 3.','可让出战搭档升一级，最高 3 级。']],
  ]},
  {id:'response',title:['Respond and resolve','响应与结算'],copy:['When targeted, choose an available response, such as Dodge!, or pass. Follow any additional prompts for abilities, judgments or damage. At 0 HP or below, a partner enters rescue. If it is knocked out, the reserve takes over if available.','成为目标后，可使用允许的响应（例如「快躲开！」）或放弃。若触发特性、判定或伤害选择，按提示继续。体力降至 0 或以下会进入救援。若搭档最终被击倒，由仍可出战的后备接替。']},
  {id:'victory',title:['Determine the winner','判定胜负'],steps:[
    [['Gym team','道馆阵营'],['Win when the Leader survives and all Challengers and Rocket members are eliminated.','馆主存活，所有挑战者与火箭队成员出局时获胜。']],
    [['Challengers','挑战者'],['Win when the Leader is eliminated, unless a Rocket member is the only trainer left.','馆主出局时获胜。若场上只剩一名火箭队成员，则由火箭队获胜。']],
    [['Team Rocket','火箭队'],['Win when the Leader is eliminated and a Rocket member is the only trainer left.','馆主出局且场上只剩一名火箭队成员时获胜。']],
  ]},
];

function gameFlow() {
  const copy = pair=>pair[language==='zh'?1:0];
  return el('ol',{class:'game-flow'},flowStages.map((stage,index)=>el('li',{'data-stage':stage.id},
    el('span',{class:'flow-index','aria-hidden':'true'},String(index+1)),
    el('section',{class:'flow-stage'},el('h3',{},copy(stage.title)),stage.copy?el('p',{},copy(stage.copy)):null,
      stage.steps?el('ul',{class:'flow-steps'},stage.steps.map(([title,description])=>el('li',{},el('strong',{},copy(title)),el('p',{},copy(description))))):null))));
}

function openDialog(kind) {
  const dialog = $('#info-dialog');
  dialogKind = kind;
  if (kind.startsWith('entry:') || kind === 'lobby-settings' || kind === 'preferences') {
    const entry = kind.startsWith('entry:');
    const [title, content] = entry ? entryDialogContent(kind.slice(6)) : kind === 'preferences'
      ? [t('personalSettings'),personalSettingsPanel()] : [t('lobbySettings'),lobbyPanel()];
    const closeButton = button('close',()=>dialog.close(),'button secondary',false,{id:'close-system-dialog'});
    dialog.className = `info-dialog system-dialog${kind==='preferences'?' preferences-dialog':''}`;
    dialog.setAttribute('aria-labelledby','system-dialog-title');
    dialog.replaceChildren(el('div',{class:'dialog-heading'},el('h2',{id:'system-dialog-title'},title),closeButton),
      el('div',{id:'system-dialog-messages','aria-live':'polite'}),content);
    if (!dialog.open) dialog.showModal();
    renderMessages();
    // Leave the keyboard closed until a touch user chooses a field.
    if (entry && !matchMedia('(pointer: coarse)').matches && !matchMedia('(max-width: 600px)').matches) $('#nickname').focus();
    return;
  }
  const detailMatch=/^(pokemon|dex):([a-z0-9-]+):([1-3])$/.exec(kind);
  const detailEntry=detailMatch?catalogueEntry(detailMatch[2]):null;
  const inDex = detailMatch?.[1]==='dex';
  const guideClass = kind==='catalogue' ? ' dex-dialog' : inDex ? ' dex-dialog dex-detail' : kind==='rules' ? ' flow-dialog' : '';
  dialog.className = `info-dialog${detailEntry?' pokemon-dialog':''}${guideClass}`;
  dialog.setAttribute('aria-labelledby','info-dialog-title');
  const closeButton = button('close', () => dialog.close(), 'button subtle small',false,{id:'close-info-dialog'});
  const back = inDex ? button('backToDex',()=>{
    openDialog('catalogue');
    document.getElementById(`dex-card-${dexFocus}`)?.focus();
  },'button subtle small',false,{id:'dex-back'}) : null;
  dialog.replaceChildren(el('div',{class:'dialog-heading'},
    el('h2',{id:'info-dialog-title'},detailEntry?localized(detailEntry.name):t(kind==='catalogue'?'catalogue':'rules')),
    el('div',{class:'info-dialog-actions'},back,closeButton)));
  if (detailEntry) {
    const trainer = view?.players.find(player=>`active-details-${player.id}`===dialogReturnFocus && player.active?.catalogueId===detailEntry.id);
    if (trainer) {
      dialog.append(el('div',{class:'pokemon-battle-stats'},el('strong',{},trainer.nickname),
        el('p',{},`${trainer.handCount} ${t('cards')}`),
        ...battleSeatDetails(trainer).map(([,text])=>el('p',{},text))));
    }
    dialog.append(...pokemonDetails(detailEntry,Number(detailMatch[3]),inDex?{selectLevel:level=>{
      openDialog(`dex:${detailEntry.id}:${level}`);
      document.getElementById(`pokemon-tab-${level}`)?.focus();
    }}:{}));
  }
  else if (kind === 'rules') dialog.append(gameFlow());
  else dialog.append(...pokedexList());
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  (back || closeButton).focus();
}
function openSystemDialog(kind, triggerId) {
  dialogReturnFocus = triggerId;
  openDialog(kind);
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
function motionAllowed() {
  return !reducedMotion && (fullPreviewMotion || !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
const judgmentIcons = {'intense-sun':'☀',clear:'☀',rain:'☂',thunderstorm:'ϟ'};
function renderArenaJudgment(stage) {
  if (!stage) return;
  const pending = view?.pendingBattle?.kind==='judgment' ? view.pendingBattle.judgmentCard : null;
  const card = pending || arenaJudgment?.card;
  stage.querySelector('.arena-judgment-reveal')?.remove();
  if (!judgmentIcons[card?.weather]) return;
  const art = playCardFace(card,language).art;
  const face = el('div',{class:'arena-judgment-flipper'},
    el('div',{class:'arena-judgment-back','aria-hidden':'true'},'◉'),
    el('div',{class:'arena-judgment-front','data-result':card.weather},
      el('small',{},t('judgmentFace')),
      el('div',{class:'arena-judgment-art','aria-hidden':'true'},art.length ?
        art.map(file=>el('img',{src:`/play-card-art/${file}`,alt:''})) : '◈'),
      card.name ? el('strong',{},localized(card.name)) : null,
      el('span',{class:'arena-judgment-result'},el('span',{'aria-hidden':'true'},judgmentIcons[card.weather]),
        weatherLabel(card.weather,language))));
  const age = arenaJudgment ? performance.now()-arenaJudgment.started : Infinity;
  if (age<480 && motionAllowed()) {
    face.dataset.flip = 'true';
    face.style.setProperty('--judgment-delay',`-${age}ms`);
  }
  stage.append(el('div',{class:'arena-judgment-reveal',role:'status','aria-atomic':'true'},face));
}
function advanceArenaJudgment() {
  const card = arenaJudgmentQueue.shift();
  arenaJudgment = card ? {card,started:performance.now()} : null;
  if (card) arenaJudgmentTimer = setTimeout(()=>{
    advanceArenaJudgment();
    renderArenaJudgment($('.match-stage'));
  },arenaJudgmentQueue.length ? 1450 : 2400);
}
function showArenaJudgments(cards,pending,replacing) {
  if (pending || replacing) {
    clearTimeout(arenaJudgmentTimer);
    arenaJudgmentQueue.length = 0;
    arenaJudgment = null;
  }
  arenaJudgmentQueue.push(...(pending ? [pending] : cards));
  if (!arenaJudgment) advanceArenaJudgment();
}
function renderArenaEvent(stage) {
  if (!stage) return;
  stage.querySelector('.arena-event-banner')?.remove();
  stage.querySelector('.arena-flat-shield')?.remove();
  stage.querySelector('.world-trait-trigger')?.remove();
  if (arenaTraitEvent) {
    const actor = view.players.find(player=>player.id===arenaTraitEvent.sourceId);
    const badge = actor && stage.querySelector(`.world-seat-compact[data-seat-id="${CSS.escape(actor.id)}"]`);
    if (badge && actor.active) {
      const name = localized(arenaTraitEvent.name);
      badge.append(el('span',{class:'world-trait-trigger',role:'status',title:name},pokemonTypeIcon(actor.active),name));
    }
  }
  const pending = view?.pendingBattle;
  const event = arenaEvent ?? (pending?.kind==='event-hand' ? {effect:pending.eventType,name:pending.eventName} : null);
  if (!event) return;
  if (event.kind==='identity-reveal') {
    stage.append(el('div',{class:'arena-event-banner',role:'status'},el('div',{},
      el('small',{},t('identityPublic')),el('strong',{},`${event.nickname} · ${roleName(event.role,language)}`))));
    return;
  }
  const pokemonAction = event.kind==='attack' && !event.external;
  const actor = pokemonAction ? view.players.find(player=>player.id===event.sourceId) : null;
  const art = !pokemonAction && playCardFace({kind:'event',eventType:event.effect},language).art[0];
  stage.append(el('div',{class:'arena-event-banner',role:'status','data-effect':event.effect},
    art?el('img',{class:'arena-event-icon',src:`/play-card-art/${art}`,alt:''}):partnerImage(actor?.active),
    el('div',{},pokemonAction?el('small',{},language==='zh'?'招式':'Move'):null,
      el('strong',{},localized(event.name)))));
  if (event.action==='shield') {
    const sprite = stage.querySelector(`[data-sprite-id="${CSS.escape(event.targetIds[0])}"]`);
    if (!sprite) return;
    const shield = el('div',{class:'arena-flat-shield','aria-hidden':'true'});
    shield.style.setProperty('--flat-left',sprite.style.getPropertyValue('--flat-left'));
    shield.style.setProperty('--flat-top',sprite.style.getPropertyValue('--flat-top'));
    sprite.parentNode.append(shield);
  }
}
function animateHandDeal() {
  const ids = arrivingHandCards.splice(0);
  const deck = $('[data-hand-deck]');
  if (!ids.length || !deck || !motionAllowed()) return;
  const origin = deck.getBoundingClientRect();
  for (const [index,id] of ids.entries()) {
    const card = document.querySelector(`[data-card-id="${CSS.escape(id)}"]`);
    if (!card || !card.getClientRects().length) continue;
    const target = card.getBoundingClientRect();
    if (target.right<0 || target.left>=innerWidth) continue;
    const dx = origin.x+origin.width/2-target.x-target.width/2;
    const dy = origin.y+origin.height/2-target.y-target.height/2;
    const back = el('div',{class:'deal-flight','aria-hidden':'true'},el('span',{},'◉'));
    Object.assign(back.style,{left:`${target.x}px`,top:`${target.y}px`,width:`${target.width}px`,height:`${target.height}px`});
    document.body.append(back);
    const delay=Math.min(index,5)*80;
    const flight=back.animate([
      {transform:`translate(${dx}px,${dy}px) rotate(-17deg) scale(.26)`,opacity:0},
      {opacity:1,offset:.18},
      {transform:'translate(0,0) rotateY(85deg) scale(1)',opacity:1}
    ],{duration:340,delay,fill:'backwards',easing:'cubic-bezier(.16,.78,.26,1)'});
    flight.onfinish=()=>back.remove();
    card.animate([{opacity:0,transform:'rotateY(-70deg)'},{opacity:1,transform:'rotateY(0)'}],{duration:165,delay:delay+305,fill:'backwards',easing:'ease-out'});
  }
}
function setView(next, force = false) {
  if (!next || typeof next !== 'object') throw { code: 'INVALID_RESPONSE' };
  if (view?.code === next.code && next.revision < view.revision) return;
  const sameSeat = view?.code === next.code && view?.selfId === next.selfId;
  const finishedBattle = sameSeat && view.status==='playing' && next.status==='finished';
  if (finishedBattle) revealVictory = true;
  if (arenaPrompt && (!sameSeat || arenaPrompt.revision!==next.revision)) closeArenaPrompt(false);
  if (!sameSeat || view?.status !== next.status) {
    selected = []; settingsDraft = null; identityFaceShown = false; revealedCandidate = null;
    clearTimeout(drawCeremonyTimer);
    drawCeremony = 'sealed'; inspectedCandidate = null; inspectedLevel = 1;
    arenaJudgment = arenaEffect = arenaEvent = arenaTraitEvent = null;
    arenaJudgmentQueue.length = 0;
    clearTimeout(arenaJudgmentTimer);
    clearTimeout(arenaEventTimer);
    clearTimeout(arenaTraitTimer);
    if (!finishedBattle) arenaCues = [];
    clearTimeout(arenaEffectTimer);
  }
  if (sameSeat && view.status==='playing' && next.status==='playing') {
    const seen = new Set(view.log.map(item=>item.id));
    const judgments = next.log.filter(item=>item.judgment && !seen.has(item.id)).map(item=>item.judgment);
    const effect = next.log.findLast(item=>item.camera && !seen.has(item.id));
    if (effect) {
      arenaEffect = effect.camera;
      clearTimeout(arenaEffectTimer);
      arenaEffectTimer = setTimeout(()=>{ arenaEffect=null; if (view?.status==='playing') render(); },1250);
    }
    if (judgments.length) showArenaJudgments(judgments,
      next.pendingBattle?.kind==='judgment' ? next.pendingBattle.judgmentCard : null,
      view.pendingBattle?.kind==='judgment');
  }
  if (sameSeat && view.status==='playing' && (next.status==='playing' || finishedBattle)) {
    const previousCues = new Set((view.visualEvents || []).map(event=>event.id));
    const cues = (next.visualEvents || []).filter(event=>!previousCues.has(event.id));
    if (richGraphics && $('.world-host')?.dataset.mode==='3d') arenaCues.push(...cues);
    else gameAudio.playCues(cues);
    const trait = cues.findLast(cue=>cue.kind==='ability' && cue.name);
    if (trait && !finishedBattle) {
      arenaTraitEvent = trait;
      clearTimeout(arenaTraitTimer);
      arenaTraitTimer = setTimeout(()=>{
        arenaTraitEvent = null;
        renderArenaEvent($('.match-stage'));
      },2300);
    }
    const revealed = !finishedBattle && next.players.find(player=>player.role && !player.eliminated && !view.players.find(prior=>prior.id===player.id)?.role);
    const event = revealed ? {kind:'identity-reveal',nickname:revealed.nickname,role:revealed.role} :
      cues.findLast(cue=>cue.kind==='event'||cue.kind==='event-action'||cue.external) ||
      cues.findLast(cue=>cue.name && cue.kind==='attack');
    if (event && !finishedBattle) {
      arenaEvent = event;
      clearTimeout(arenaEventTimer);
      arenaEventTimer = setTimeout(()=>{
        arenaEvent = null;
        renderArenaEvent($('.match-stage'));
      },2300);
    }
  }
  if (sameSeat && next.status==='setup' && view.status==='setup' && next.self.candidates.length>view.self.candidates.length) {
    revealedCandidate = inspectedCandidate = next.self.candidates.at(-1);
    inspectedLevel = 1;
  }
  if (sameSeat && view.status==='setup' && next.status==='playing') enteringArena=true;
  if (sameSeat && next.status==='playing' && ['setup','playing'].includes(view.status) && !next.self.spectator) {
    const previous = new Set((view.self.hand||[]).map(card=>card.id));
    arrivingHandCards=next.self.hand.filter(card=>!previous.has(card.id)).map(card=>card.id);
  }
  if (view?.settings && JSON.stringify(view.settings) !== JSON.stringify(next.settings)) settingsDraft = null;
  const fasterPolling = next.status==='playing' && (view?.status!=='playing' || (!view.pendingBattle && next.pendingBattle));
  view = next;
  if (fasterPolling) scheduleRoomPoll();
  if (next.status==='playing') gameAudio.prepareMoves(next.players.flatMap(player=>{
    const active = player.active;
    const face = active && catalogueEntry(active.catalogueId)?.levels.find(item=>item.level===active.level);
    return face?.moves?.map(move=>move.name.en) ?? [];
  }));
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
  errorKey = error.network ? 'networkError' : error.code === 'SEAT_TAKEN' ? 'seatTaken' : mapped[error.code] || 'genericError';
  errorCode = error.code && /^[A-Z0-9_]{1,60}$/i.test(error.code) ? error.code : '';
  noticeKey = ''; renderMessages();
}
async function connect(mode) {
  if (busy) return;
  const nickname = $('#nickname').value.trim();
  const code = $('#room-code')?.value.trim().toUpperCase();
  if (!nickname || (mode !== 'create' && !code)) { errorKey = 'invalidInput'; renderMessages(); return; }
  busy = true; errorKey = ''; errorCode = ''; noticeKey = ''; setBusy(); renderMessages();
  try {
    const data = await api(mode === 'create' ? '/api/rooms' : `/api/rooms/${encodeURIComponent(code)}/join`, { method: 'POST', body: { nickname, ...(mode !== 'create' ? { spectator: mode === 'watch' } : {}) }, token: null });
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
    return true;
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
  const next = { arena: settingsDraft.arena, turnSeconds: Number(settingsDraft.turnSeconds), responseSeconds: Number(settingsDraft.responseSeconds), autoDraw: settingsDraft.autoDraw ?? false, autoJudgment: settingsDraft.autoJudgment ?? true };
  if ([next.turnSeconds, next.responseSeconds].some(value => !Number.isInteger(value) || (value !== 0 && (value < 5 || value > 600)))) { errorKey = 'timerInvalid'; renderMessages(); return; }
  if (await action('settings', next)) $('#info-dialog')?.close();
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
let roomPollTimer;
function scheduleRoomPoll() {
  clearTimeout(roomPollTimer);
  const interval = !document.hidden && view?.status==='playing' ? (view.pendingBattle ? 250 : 500) : 1500;
  roomPollTimer = setTimeout(()=>{
    poll();
    scheduleRoomPoll();
  },interval);
}
scheduleRoomPoll();
// Update only the clock text and warning styling; the arena remains mounted.
setInterval(updateTurnClock, 200);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) poll();
  scheduleRoomPoll();
});
