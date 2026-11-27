# 关都与城都巡回首包实现记录

2026-11-19，工作分支 `codex/expansion-content`，起点 `b4759ef`。

## 入口与范围

房主在大厅「对局设置 → 内容包」选择「关都与城都巡回 · 46 组」并保存。原版身份局与公开组队局都可选择本包。组队局支持 2–30 之间的偶数，允许真人和 AI 混坐，随机或按座位分队。

每套 108 张原版牌加 24 张拓展，合计 132 张，四种印刷天气各 33 张。28–30 人组队混两套，共 264 张。每个物理牌有独立 ID。候选池从 40 组到 46 组，每组有 Lv.1–3 牌面。全桌候选不足时沿用大房间的分批洗入规则，每人仍取得五个不同候选。

本包实现 12 种牌、6 组宝可梦、3 个通用行动。原型及《三国杀》参考见 [拓展清单](./GAME-EXPANSION-CATALOG.md)。新增内容在独立的 [数据模块](./app/public/expansion-content.js) 维护，状态和结算走现有房间服务器。

## 本次采用的牌面

每种两张。分栏牌使用一栏后弃整张。

| 牌名 | 实际规则 |
| --- | --- |
| 好伤药／力量强化剂 | 自己存活后备回复 1 点；或自己的出战获得一枚尚未持有的力量强化。 |
| 宝可装置／宝可梦图鉴 | 弃另一张手牌摸一张；或私看顶两张并选择置顶顺序。两张图鉴牌的过程对其他训练家和观众保密。 |
| 宝可梦交替／进化香薰 | 消耗普通换位，成功后换下者回复 1 点；或公开自己的后备，将本回合结束时的升级选择指向该实例。 |
| 能量回收／樱子果 | 取回一张与这张实体牌同天气的已弃道具；或解除自己存活搭档的麻痹。治疗或解除后备状态会公开该后备，与原道具处理一致。 |
| 守住招式学习器 | 每个全局回合、每个出战实例一次，在可躲闪的防御窗判定。晴天视为一次躲闪；失败恢复原防御窗口，仍可用手牌响应。适用锐利目光、十字剪和原判定替换。 |
| 讲究围巾 | 指挥招式的座次距离可达 2。本回合锁定该宝可梦首次实际使用的指挥招式，仍保留招式自身次数及同训练家仅一个指挥搭档的限制。 |
| 脱出按键 | 因招式实际受伤时记录。整张招式及救援结束后，仍是原携带者出战且有合法后备时，可弃掉按键换入自己的后备。 |
| 红牌 | 同样在整张招式结算后处理。原受击者、原攻击者都仍是出战且攻击者有合法后备时，可弃红牌令原攻击者换下。 |
| 西尔佛公司的补给 | 对自己使用事件，摸至多两张现有牌。先过急冻鸟窗口。 |
| 火箭队搜查 | 获得距离内其他训练家的一张服务器随机选择的手牌。手牌内容仅参与双方看见。 |
| 宝可梦中心的巡诊 | 从自己开始逐目标回复原出战 1 点。每个目标先过急冻鸟抵消，原目标已换下或出局则跳过。 |
| 大木博士的赠礼 | 对距离内其他训练家使用事件，生效后私选并转交 1–2 张牌，给两张时自己的原出战回复 1 点。可在交完第一张后结束。 |

## 宝可梦体力与招式

本次补定的体力和效果均为自制。Lv.2–3 同名形态继续保留两个等级牌面。

| 组别 | Lv.1／2／3 体力 | 实际特性 | 实际招式 |
| --- | --- | --- | --- |
| 伊布 → 月亮伊布 | 3／4／5 | 普通换位时，转交一枚速度强化给没有该强化的换入搭档。 | 电光一闪基础伤害 1／2／2。Lv.2 起可弃雨天牌用月光，为自己回复 2 点或解除状态。 |
| 波克比 → 波克基古 → 波克基斯 | 3／3／4 | 普通换入后给自己存活后备回复 1 点，每全局回合一次。 | 撞击 1／1，空气斩 2。Lv.2 起生命水滴可弃晴朗或暴雨牌，回复至多两个合法目标各 1 点。 |
| 咩利羊 → 茸茸羊 → 电龙 | 3／4／4 | 每全局回合第一次以雷雨牌支付天气招式后，获得一枚尚未持有的速度强化。 | 电击 1／2，Lv.3 放电基础伤害 2，最多两个合法目标。充电使用雷雨手牌，给自己防御强化。 |
| 木守宫 → 森林蜥蜴 → 蜥蜴王 | 3／4／4 | 体力不高于上限一半时，招式伤害加 1。 | 拍击 1／2，叶刃 2。Lv.2 起急速折返可弃晴天牌，基础伤害 1，结束时可走原换位流程。 |
| 小锯鳄 → 蓝鳄 → 大力鳄 | 3／4／5 | 体力不高于上限一半时，招式伤害加 1。 | 水枪 1／2，咬碎 2。咬碎造成伤害后，目标选择弃持有物或承受额外 1 点。Lv.2 起守住可弃雨天牌，给自己防御强化。 |
| 熊宝宝 → 圈圈熊 → 月月熊 | 3／4／5 | 出牌阶段一次，弃一张手牌，取回一件同天气的已弃持有物。 | 劈开 1／2，突飞猛扑 3。突飞猛扑整张招式结束时，自己仍出战且有手牌则弃一张。 |

## 通用行动

- **训练家备战。** 出牌阶段一次，一张手牌置底，再摸一张。
- **培育后备。** 结束阶段弃一张手牌，令存活后备升一级。本回合的常规结束升级机会已用，随后结束回合。
- **戏法交接。** 本回合普通换位后，在出牌阶段弃一张手牌交换自己两个搭档的持有物，可一方为空。每次普通换位后的交接机会限用一次。失去原出战持有物涉及不服输时走既有可选响应。

进化香薰、培育后备与常规结束升级共用一次机会。拥有香薰标记时，结束确认显示所选搭档；该实例已经失去战斗能力时无法给它升级。

## 结算与恢复裁定

1. 新事件沿用原急冻鸟的逐目标窗口。攻击沿用原招式来源、减伤、状态、濒死救援、击倒、强制后备登场与胜负。
2. 红牌与按键在整张招式收尾处理，按当前训练家起的座次排序，多个相同携带者条目按受击顺序。同一招式，每位训练家至多执行一次本包的后置换位。每次都重新检查原出战实例、物品实例和合法后备，失败跳过，成功才弃物。
3. 后置换位执行现有沙穴、持有物、不服输及登场特性流程。回合已经限制换位时，本包后置换位也需遵守该限制。强制后备登场及胜利结算优先于本包收尾。
4. 待选手牌、图鉴暂存牌、原目标实例及收尾队列写入房间保存。刷新或重连继续原决策。其他玩家、观众的视图仅含允许看见的选项与牌面。
5. AI 具有新道具、持有物、事件、主动行动和响应选择。普通及困难 AI 的服务端决策仍只依赖允许看见的信息。

## 素材

新增宝可梦使用 PokeAPI 公共素材库的官方插画。道具使用该库的物品图标；宝可装置、图鉴和进化香薰分别用地图、雷达和香薰图标表达用途。支持逐形态加载 3D 模型。对应的 GLB 文件在位时使用模型，缺失的形态在原有场景内显示插画。 [素材仓库](https://github.com/PokeAPI/sprites)

- 原版 89 个出战及事件模型和首包 16 个形态统一使用用户提供的《X／Y》模型与贴图。保留原版待机、倒地及已有招式动作并重新绑定骨架。伊布使用《Let's Go》动作，月亮伊布、波克比、熊宝宝和圈圈熊使用重绑的《阿尔宙斯》动作。首包其余 11 个形态在缺少匹配片段时使用战场程序动作。
- 普通月月熊（#0901）使用用户提供的《宝可梦传说 阿尔宙斯》模型，原素材内部编号为 `pm1007_00_00`，含 64 根骨骼、贴图、待机、物理攻击、特殊攻击和倒地动作。 [官方图鉴](https://www.pokemon.com/us/pokedex/ursaluna)
- 首轮浏览器检查验证了贴图文件可读取，预览对照随后发现《X／Y》的材质 UV 转换被忽略。修正版根据 BCH 材质的原始缩放、偏移和采样模式重新映射全套模型，并转换到 glTF 的纵向贴图坐标。月月熊的颜色从源分层材质重新烘焙。
- 细节修正使用源模型的固定顶点属性和骨骼索引重新导出《X／Y》整套模型。伊布和皮卡丘的嘴部权重随头骨移动。木守宫的左右瞳孔使用原始虹膜与眼睑遮罩。鬼斯的《X／Y》本体结合原有战场的两层半透明烟雾，烟雾随本体骨骼移动。

## 原版等级对应的 3D 形态

沿用牌面的三个等级。每个等级通过 `app/public/pokemon-models/forms.json` 选择战场模型，模型总览也读取这份对应表，牌面名称、技能、体力和结算规则继续由原目录提供。前进化用于 Lv.1，后续进化用于 Lv.3。只有两段的家族在余下等级沿用相同形态。

| 牌组 | Lv.1 | Lv.2 | Lv.3 |
| --- | --- | --- | --- |
| 皮卡丘 | 皮丘 | 皮卡丘 | 雷丘 |
| 皮皮 | 皮宝宝 | 皮皮 | 皮可西 |
| 小磁怪 | 小磁怪 | 三合一磁怪 | 自爆磁怪 |
| 独角犀牛 | 独角犀牛 | 钻角犀兽 | 超甲狂犀 |
| 吉利蛋 | 小福蛋 | 吉利蛋 | 幸福蛋 |
| 飞天螳螂 | 飞天螳螂 | 飞天螳螂 | 巨钳螳螂 |
| 迷唇姐 | 迷唇娃 | 迷唇姐 | 迷唇姐 |
| 电击兽 | 电击怪 | 电击兽 | 电击魔兽 |
| 多边兽 | 多边兽 | 多边兽Ⅱ | 多边兽乙型 |
| 卡比兽 | 小卡比兽 | 卡比兽 | 卡比兽 |

飞天螳螂这次采用巨钳螳螂路线。呆呆兽继续使用呆壳兽路线。事件宝可梦沿用各自的事件模型。新增 13 个形态使用用户提供的《X／Y》模型、贴图和骨架，由战场提供程序动作。 [宝可梦官方图鉴](https://www.pokemon.com/pokedex/) · [飞天螳螂的进化分支](https://www.pokemon.com/us/pokedex/0123)

## 实际验证

- 完整测试 1302 项通过，0 失败，0 跳过。包含原版与组队 1281 项，以及 21 项首包定向测试。最后清理后再运行受影响的 AI 与首包 47 项测试，全部通过。 [完整日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/full-tests.log) · [最终定向日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/final-focused.log)
- 正常 HTTP 建房入口，8 人随机组队首包局，1 个由测试脚本操作的真人席位加 7 个 AI，25 回合由 B 队获胜并返回大厅。
- 正常 HTTP 建房入口，4 人身份首包局，1 个由测试脚本操作的真人席位加 3 个 AI，92 回合由火箭队获胜并返回大厅。
- 正常 HTTP 建房入口，4 人原版身份局，1 个由测试脚本操作的真人席位加 3 个 AI，22 回合由挑战者获胜并返回大厅。
- 正常 HTTP 建房入口，30 人首包组队局，1 个由测试脚本操作的真人席位加 29 个 AI，117 回合由 B 队获胜并返回大厅。使用 264 张牌。
- 上述整局使用真实发牌和合法行动，没有预设击倒或胜利。定向测试通过合法开局后设置特定战斗条件，以覆盖低概率边界。
- Chrome 实际界面从建房、选择内容包、加入 AI、确认队伍、五候选与选搭档进入对战。在 390 px 宽页面上实际使用训练家备战、宝可梦图鉴，刷新后继续图鉴选择，再查看月亮伊布的 Lv.3 牌面，图片与按钮均可使用。
- 浏览器验证时发现新响应面板被三维画布拦截点击，已接入原有响应面板样式并实际点击复验。检查 59 个图片入口均返回成功，包含 17 张新增宝可梦形态插画，未发现缺图。
- 3D 加载支持逐形态降级。曾用临时模型验证个别素材缺失时，房间中其他宝可梦继续使用 3D。写入分支后从实际模型路由检查 106 个 GLB，均通过 Chrome 加载、蒙皮及贴图验证。动作抽样检查 95 段待机、92 段倒地、17 段特殊攻击及 13 段物理攻击，未发现包围盒异常。四人首包测试房间同时渲染月月熊、伊布、小火龙和皮卡丘，月月熊四个片段均产生骨骼位移。
- 模型转换期间重跑完整自动化测试，1302 项全部通过。安装后再跑 53 项原版基础流程、战场布局和首包测试，全部通过。正常 HTTP 入口重走 4 人原版身份局（47 回合）及 8 人首包随机组队局（34 回合），均结算并回到大厅。
- 贴图修正后逐项复核《X／Y》105 个 GLB 的 829 处贴图绑定，贴图名、UV 和采样模式与转换源一致。Chrome 从实际房间加载版本 14 的资产并复测全部 106 个模型。近景将伊布、波克比、咩利羊、木守宫、小锯鳄和月月熊与插画及上一版并排对照。53 项定向回归通过，新的 4 人原版身份局（87 回合）和 8 人首包组队局（74 回合）均完成结算并返回大厅。 [贴图对照](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/texture-comparison.png)
- 版本 15 重新核对 105 个《X／Y》模型、833 个子网格的源数据。Chrome 验证伊布 29 个嘴部顶点和皮卡丘 72 个嘴部顶点的权重与源数据吻合，木守宫双眼都加载了遮罩，鬼斯两层烟雾在待机采样期间保持在同一骨骼上。实际房间加载四个 3D 模型，106 个 GLB 批量检查及 53 项定向回归均通过。4 人原版身份局（67 回合）和 8 人首包组队局（25 回合）均结算并返回大厅。 [细节近景](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/model-detail-check.png)
- 版本 15 的全量双视角总览覆盖原版 89 个模型和首包 17 个形态。瓦斯弹和双弹瓦斯当时显示为偏厚的烟雾外壳。 [原版 1](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/pokemon-all-1.png) · [原版 2](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/pokemon-all-2.png) · [原版 3](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/pokemon-all-3.png) · [首包](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/pokemon-all-4.png)

- 版本 16 对照了 38 个模型，重新处理虹膜与眼睑、火焰、气体、紫色污泥、翼面、爪面、耳面、下巴和裙摆。火焰与烟雾使用网页材质近似。 [火焰、烟雾及表面](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/v16-details-1.png) · [眼部 1](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/v16-details-2.png) · [眼部 2](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/v16-details-3.png)
- Chrome 从实际静态路由加载 119 个 GLB，验证均有蒙皮和贴图。95 段待机、92 段倒地、17 段特殊攻击和 13 段物理攻击的包围盒抽样通过。四人战场使用两张神奇糖果，将同一个 `pikachu` 牌组从 Lv.1 依次升到 Lv.2 和 Lv.3，浏览器分别加载皮丘、皮卡丘和雷丘。四个席位均保持 3D 显示。 [119 个 GLB 的检查结果](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/verify-v16-all.result.log) · [房间实测](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/verify-v16-arena.result.log)
- 版本 16 完整自动化回归 1302 项通过，0 失败，0 跳过。正常 HTTP 建房后，4 人原版身份局在 18 回合结算，8 人首包随机组队局在 24 回合结算，两局均返回大厅。 [回归日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/v16-full-tests.log)
- 版本 16 总览覆盖原版 89 个模型、首包 17 个和前进化与后续进化 13 个。 [原版 1](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/v16-pokemon-all-1.png) · [原版 2](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/v16-pokemon-all-2.png) · [原版 3](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/v16-pokemon-all-3.png) · [首包](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/v16-pokemon-all-4.png) · [13 个新增形态](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/v16-pokemon-all-5.png)

## 火焰鸟与幽灵烟雾的动画细修

- 火焰鸟平滑了 14 根翼骨，翼尖稍晚跟上翼根，翼缘火焰有独立起伏。火焰鸟的试炼使用《X／Y》模型的翼骨做扑翼动作。鬼斯的两层半透明雾各自卷动，出招时扩张，倒地时逐渐收拢。耿鬼的「祸不单行」降低了波环的亮度，紫雾沿出招路线漂移、散开。 [待机动态对照](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/moltres-gastly-motion.gif) · [耿鬼招式预览](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/gengar-hex-mist.png)
- Chrome 四人房实测了火焰鸟的试炼和耿鬼出招。火焰鸟左翼尖同一采样间隔的最大转角从 20.5° 降到 5.8°，事件翼骨旋转生效，双翼火焰和鬼斯双层烟雾的关键帧衔接无跳变。耿鬼的紫雾在释放期分批成形、移动并在招式结束时散尽。 [模型和事件验证](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/verify-v17-motion.result.log) · [祸不单行验证](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/verify-v17-hex-final.result.log)
- 全部 1302 项回归测试通过，紫雾调整后再跑 75 项定向检查也全部通过。正常房间入口重走 4 人原版身份局和 8 人首包随机组队局，分别在 55 和 47 回合完成结算并返回大厅。 [完整测试日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/v17-full-tests.log)

## 魔墙人偶眼睛与卡比兽下巴

- 版本 18 将魔墙人偶的原始虹膜和眼睑遮罩合入眼面贴图，正面和斜视均由同一层眼面渲染。卡比兽的嘴部恢复与脸部一致的《X／Y》底色，并按相同位置的参考顶点校正头部、嘴部和邻接颈部的法线。 [双视角前后对照](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/v18-face-comparison.png)
- Chrome 在四人原版房间验证了 Lv.2 卡比兽，以及使用「魔墙人偶的戏法」时加载的新模型。抽样比较两只宝可梦的 5 段既有动作，眼面和嘴部蒙皮顶点的位置与修正前相同。97 项定向测试全部通过。正常入口开出的 4 人原版身份局和 8 人首包组队局分别在 45 和 82 回合完成结算并返回大厅。 [原版房间实测](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/verify-v18-faces-final.result.log) · [回归日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/v18-regression.log)

## 耿鬼原作动作、火焰柔边与鬼斯烟雾

- 版本 19 核对《X／Y》压缩包中耿鬼的两个 BCH 条目，分别为带蒙皮的本体和阴影。长舌网格由原舌骨驱动，这次从常规战场形态中隐藏。保留正常嘴部与骨架，以《Let's Go》提供的两段待机、物理攻击、特殊攻击补足循环和招式。动作对齐 43 个同名关节。
- 火焰鸟的双翼、头顶和尾部火焰随视角柔化透明边缘。鬼斯的两片旧雾网格换成跟随躯干的一团体积烟雾，内部卷动，烟团外侧逐渐散开。减少动态效果时固定烟雾相位。 [三处动态对照](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/v19-pokemon-motion-comparison.gif)
- Chrome 原版房间确认「火焰鸟的试炼」显示新版火焰，「祸不单行」触发耿鬼原作特殊攻击骨骼片段。预览检查火焰四片、烟雾动态与减少动态效果下的静止状态。1302 项全量测试通过，最终材质调整后 75 项定向测试通过。4 人原版身份局（36 回合）和 8 人首包组队局（29 回合）均结算并返回大厅。 [火焰与烟雾验证](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/verify-v19-fog-flame-final.result.log) · [耿鬼实战验证](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/verify-v19-cast.result.log)

## 火焰鸟翼后缘火焰与耿鬼舌头

- 参考《X／Y》同版图，将火焰沿火焰鸟翼后缘收窄，分出金黄色火根和橙红火尖。保留四片原火焰网格、骨架和动作，火尖有持续变化。参考地址返回 403，改用 Pokémon Database 的同版正面图。 [参考图](https://pokemondatabase.com/pokemon/moltres/sprites/) · [动态对照](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/v20-moltres-gengar-comparison.gif)
- 恢复耿鬼源模型里的舌网格，将四根舌骨的根部放到下颚下。舌头在张嘴时可见，特殊攻击时舌尖上卷。原有待机、倒地、物理攻击和特殊攻击的其余 504 条动画轨完全一致。 [舌头和火焰对照](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/v20-moltres-gengar-comparison.png)
- Chrome 全量加载 119 个模型，核验 219 段内置动画、27,705 条动画轨和 1,095 个姿势采样，未发现无效关键帧或包围盒异常。Chrome 房间确认「祸不单行」仍使用原作特殊攻击，「火焰鸟的试炼」播放扑翼并渲染新版火焰。1302 项全量测试通过，4 人原版局（82 回合）和 8 人首包组队局（65 回合）均结算并返回大厅。 [动画检查](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/verify-v20-all.confirmed.log) · [耿鬼实战](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/verify-v20-cast.confirmed.log) · [火焰鸟实战](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/verify-v20-visuals.result.log)

## 耿鬼口腔与火焰鸟源贴图修正

- 根据《X／Y》源材质解码，耿鬼口前遮罩最终透明度为零。隐藏该遮罩和额外伸舌网格后，原模型张嘴时露出口腔的红色和单一粉色舌面。
- 火焰鸟恢复 13 个内层遮罩网格和 4 个火焰表面，按源材质的 UV、三张遮罩图及调色值烘焙火焰贴图。翼部遮罩文件只有空白帧，网页用《X／Y》本体随附的对应网格近似其覆盖范围。 [前后动图](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/v23-moltres-gengar-textures.gif)
- Chrome 实战验证「祸不单行」继续播放原作特殊攻击，「火焰鸟的试炼」加载新版火焰。两只模型的骨架和动画轨输入、输出与上一版逐项一致。全量加载 119 个模型并抽样 219 段已有动画，75 项定向回归通过。4 人原版局（18 回合）及 8 人首包组队局（48 回合）均结算并返回大厅。 [耿鬼实战](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/verify-v23-cast.final.log) · [火焰鸟实战](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/verify-v23-trial.final.log) · [全量动画检查](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/verify-v22-all.final.log)

## 待定内容

- 猴怪／火暴猴沿用原版等级模型。弃世猴（#0979）保留给未来明确采用它的分支玩法，当前拓展无需补该模型。

- 新数值需要真人多人试玩评估，尤其是图鉴与补牌频率、低体力伤害奖励、同时启用多种升级入口。
- 公开职业、身份变体及后续内容包继续按拓展清单规划。

## 丰缘天气研究 · 第一批可试玩内容

房主可在大厅的「内容包」选择「丰缘天气研究」或「巡回＋天气研究」。两者都支持原有身份与组队入口，组队仍可按座位或随机分队，也可加入 AI。

| 内容包 | 每套游戏牌 | 可选宝可梦组 | 四种印刷天气各几张 |
| --- | ---: | ---: | ---: |
| 原版 | 108 | 40 | 27 |
| 关都与城都巡回 | 132 | 46 | 33 |
| 丰缘天气研究 | 116 | 41 | 29 |
| 巡回＋天气研究 | 140 | 47 | 35 |

### 本次裁定

- **大晴天、求雨。** 各增加两张即时事件。对自己使用，沿用《谁是火箭队》的「急冻鸟的庇护」事件反制。事件成功才改变全场天气，新天气覆盖前一种天气。每轮按天气生效时的存活训练家人数计算，之后有人退场也沿用该计数。回合开始时检查到期。
- **炽热岩石、潮湿岩石。** 各增加两张持有物。事件结算时，使用者的出战搭档有效携带对应岩石，则持续两轮。岩石继续携带，之后交替或失去持有物也沿用已经确定的到期回合。
- **气象观测。** 自己的出牌阶段用一张同天气的实体牌支付有伤害数值的对应属性招式后，可以把另一张手牌放到牌堆底，换取顶牌。晴天对应火，雨天对应水。即使招式被闪避，仍可观测。每个自己的回合最多结算一次，牌堆与弃牌都空时不可用。
- **飘浮泡泡。** Lv.1–3 的体力上限分别为 3、4、4。撞击以「接招吧！」使用，伤害值为 1、2、2。「天气预报」按场上天气切换外形和火／水图标。气象球在普通形态消耗一张任意印刷天气的手牌，基础伤害为 1。太阳或雨水形态的气象球要支付对应天气牌，基础伤害为 2。气象球可被「快躲开！」闪避，正常进入伤害和救援窗口。特性被压制时恢复普通形态。换形沿用当前等级、体力和已经发动的招式记录。
- **原作来源。** 《宝可梦》的同名天气招式、天气岩石、天气预报和气象球提供原型。持续回合数、伤害数值与观测是桌游裁定。《三国杀》的无懈可击和观星分别提供事件响应、调整牌序的机制参考。桌游实现沿用急冻鸟反制窗口，将观星式牌序操作化为一次手牌置底换顶。 [飘浮泡泡官方图鉴](https://www.pokemon.com/us/pokedex/castform) · [天气岩石官方指南](https://diamondpearl.pokemon.com/en-gb/trainersguide/grandunderground/) · [《三国杀》卡牌总览](https://guozhan.sanguosha.com/)
- **模型。** 普通、太阳和雨水形态均使用本地《X／Y》骨骼模型与对应贴图。三种形态采用网页的浮动、出招与受击动作，图鉴缩略图也由相同模型渲染。原版卡面印刷天气继续作为招式费用和判定依据，场上天气显示在对战标题栏。

### 验证

- 全量 Node 回归 1305 项通过。新增定向覆盖四种牌库的牌数与天气分布、天气反制／覆盖／到期、重启恢复、飘浮泡泡形态、费用、伤害与每回合观测上限。
- 普通 HTTP 房间入口实测四人原版身份局、四人丰缘身份局、八人随机组队混用局。分别完成胜负结算，并执行返回大厅。每局均为一名玩家席位与其余 AI 席位。
- Chromium 实战页面加载普通、太阳和雨水三种 GLB，从同一个房间分别出牌切换大晴天和求雨。天气提示与贴图预览核对通过。 [浏览器记录](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-browser.log) · [三个 3D 形态](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/castform-3d-forms.png)
- 首批结束时待定的是冰雹、雪云形态、丰缘包其余九种卡、五组宝可梦和剩余行动。真人试玩继续观察覆盖已有天气的收益、岩石占用持有物栏以及混用后的牌库比例。


### 耿鬼与火焰鸟模型复核

- 耿鬼以《X／Y》原模型的单一口腔舌面校色，保留紫色脸部和牙齿的贴图像素。压暗口腔，调整舌面色阶，保留既有动作轨。Chromium 原版房间验证「祸不单行」仍使用原作的特殊攻击动画。
- 火焰鸟把翼焰集中到翼后缘，保留原材质遮罩和扑翼轨道，以透明渐变处理火尖，动态时火尖随时间变化。Chromium 原版房间验证「火焰鸟的试炼」加载新效果。 [实战与扑翼取样](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/v25-moltres-gengar-textures.png)
- 浏览器加载检查覆盖 122 个 3D 模型。现有的 219 段内置动画与 27,705 条动画轨均已抽查，无效轨数为零。 [耿鬼实战](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/verify-v25-gengar.log) · [火焰鸟实战](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/verify-v25-moltres.log) · [模型加载与动画检查](C:/Users/pc/Documents/ChatGPT/Game/outputs/tour-models/verify-v25-audit.log)

### 飘浮泡泡天气形态材质复核

- 对照宝可梦官方设定图和第六世代游戏截图。太阳形态的红橙色脸位于黄色光晕内，眼周为连贯的浅黄色。雨水形态的蓝色水滴内是蓝色脸与连贯的浅蓝眼周。 [宝可梦官方形态图与游戏截图](https://www.pokemon.jp/special/forme/zukan02/zukan2-15.html)
- 首次导出时，太阳和雨水 GLB 把光学遮罩作为普通颜色层绘制，挡住了实际脸部。修订版去掉错误覆盖层，恢复太阳形态黄橙渐变光晕与雨水形态蓝色水滴，保留对应骨骼和原有姿态。替换了两套模型与由它们渲染的缩略图。
- Chromium 3D 实战在同一房间依序加载普通、太阳和雨水模型。两种天气形态的浮动和出招关节变化均通过检查，24 项原版与扩展定向测试通过。 [修正对照](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/castform-corrected-comparison.png) · [3D 房间验证](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/castform-corrected-room.log)


## 丰缘天气研究 · 冰雹与雪云形态

- 「冰雹」和「冰冷岩石」各两张。冰雹事件的印刷天气为晴朗和雷雨，冰冷岩石为烈日和暴雨。丰缘牌库增至 120 张，混用增至 144 张，四种印刷天气分别各 30 张和 36 张。
- 冰雹覆盖场上现有天气，持续一轮。使用者的出战搭档有效携带冰冷岩石时持续两轮。时长按生效时的存活席位计算，急冻鸟可在事件结算前反制。
- 飘浮泡泡在冰雹期间显示雪云形态和冰属性。气象球支付晴朗或雷雨手牌，基础伤害 2。以对应牌支付冰系伤害招式后可触发「气象观测」。本作以换形、气象球和观测体现冰雹效果。沙暴及已规划的其他卡和宝可梦仍待实现。
- 特性中文名使用官方译名「阴晴不定」。雪云形态来自本地《X／Y》骨骼模型和贴图，网页驱动浮动和出招动作。卡面与规则取材于宝可梦的冰雹与冰冷岩石，沿用原桌游与《三国杀》无懈可击相近的反制窗口，以及借鉴观星的观测动作。 [官方形态图及实机截图](https://www.pokemon.jp/special/forme/zukan02/zukan2-15.html) · [冰冷岩石官方说明](https://diamondpearl.pokemon.com/en-gb/trainersguide/grandunderground/)
- Chromium 同一场房间测试先后结算大晴天、求雨和冰雹，并加载对应 3D 形态。四席下，装备冰冷岩石后冰雹显示八回合，冰系气象球正确显示费用和伤害。方向和动作检查确认雪云形态有浮动及头部出招动作。 [四形态预览](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/castform-four-forms.png) · [3D 房间日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/castform-hail-room.log)
- 四人原版身份局、四人丰缘身份局、八人随机组队混用局经正式房间 API 从开局走到胜负结算并返回大厅，每局除一个训练家席位外均为 AI。原版组队终局测试现在使用固定候选，以便稳定复验最后一次击倒。

- 雪云形态在浏览器房间用雷雨手牌发动气象球，实际造成 2 点伤害，随后置底一张牌并摸一张，气象观测结束。 [出招与观测日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/castform-hail-attack.log)
- 最终全量回归 1,306 项通过。另以混用内容包按座位开了 30 席组队局，29 个 AI 席位参加，正常结算后返回大厅。 [全量回归日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-hail-final.log) · [30 席房间日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hail-playthrough-30-tour-hoenn.log)


## 丰缘天气研究 · 延时事件

丰缘牌库增至 124 张，关都城都混用增至 148 张。雷公的打雷和卡比兽堵路各两张，两种卡合计四种印刷天气各一张。原版大厅的牌库为 108 张。

| 新卡 | 本作实际裁定 | 原作来源 |
| --- | --- | --- |
| 雷公的打雷 | 挂到相邻的另一名训练家席位。其下回合摸牌前判定，雷雨对当时出战搭档造成 1 点事件伤害。正常结算减伤、救援及胜负，判定完成后弃置事件。 | 借《三国杀》闪电的延时判定窗口，宝可梦题材取自雷公的电系和打雷。 [闪电](https://guozhan.sanguosha.com/a/kapaiyilan/youxipai/jinnanpai/2013/0128/111.html) · [雷公官方图鉴](https://www.pokemon.com/br/pokedex/raikou) |
| 卡比兽堵路 | 挂到任意另一名训练家席位。目标下回合摸牌前判定，判定非晴朗时，本回合发起普通交替须额外弃一张手牌，巡回道具发起的普通交替也适用。可在选择费用时放弃这次交替。费用支付后，受到沙穴阻止时沿用原版交替费用处理。 | 借《三国杀》乐不思蜀的延时限制结构，宝可梦题材取自关都道路上睡着的卡比兽。 [乐不思蜀](https://guozhan.sanguosha.com/a/kapaiyilan/youxipai/jinnanpai/2013/0128/112.html) · [宝可梦官方关都回顾](https://www.pokemon.com/es/noticias/celebra-25-anos-de-pokemon-con-los-mejores-momentos-de-kanto) |

- 挂有两种延时事件时，按放置顺序判定，然后进入现有回合开始流程。每个席位同名最多挂一张。急冻鸟在放置时反制，判定继续使用原有手动／自动翻牌和六尾日照窗口。无可用判定牌时跳过该效果。训练家退场时弃置仍挂在其席位的事件。
- 席位公开显示两种延时图标，点击可读各自规则。已经挂起的事件、等待揭牌的判定和普通交替付牌都沿用房间持久化。保留原先天气模块和未完成的七种计划卡。
- Chromium 3D 房间挂上两张事件并手动判定。在摸牌前看到雷公扣除 1 点体力，堵路触发，随后付一张手牌完成交替。 [实战截图与步骤](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-delayed-browser.log)
- 全量回归 1,308 项通过，定向覆盖两张新卡、放置反制、同名限额、重启、判定时序与交替费用。四人原版身份局、四人丰缘身份局和八人随机组队混用局均使用正式房间 API 与 AI 开局、结算并返回大厅。 [测试日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-delayed-full.log)


## 丰缘天气研究 · 预知未来与拉鲁拉丝进化组

- **预知未来。** 四种印刷天气各一张，丰缘合计 128 张，混用合计 152 张。日照等原有替换机会结束后，从判定者开始按座位顺序邀请有条件的训练家响应。先选预知未来，再另选一张与最终展示牌同天气的手牌。两张支付牌同时弃置，当前判定牌置底并翻出新的判定牌。每次判定只成功一次，费用选择前可放弃。牌堆与弃牌区都缺少可翻牌时跳过该事件窗口。
- **拉鲁拉丝 → 奇鲁莉安 → 沙奈朵。** 丰缘候选池 42 组，混用池 48 组。各级体力 3、4、5。前两级使用念力，基础伤害为 1、2，三级使用精神强念，基础伤害为 2。二级起解锁光墙，支付烈日或晴朗手牌给自己一枚防御强化。「同步」沿用本桌游的凯西裁定，出战时因实体指挥或事件受伤后可以取得该牌。
- **参考。** 预知未来借鉴《三国杀》司马懿的改判窗口，并采用宝可梦图鉴里沙奈朵预见未来的设定。两张手牌费用、置底方式、次数和第三级体力为桌游裁定。 [司马懿鬼才](https://www.sanguosha.com/news/20140318_6743_5540) · [沙奈朵官方图鉴](https://www.pokemon.com/uk/pokedex/gardevoir)
- **3D 资产。** 三阶段使用本地《X／Y》模型、骨骼与贴图，重定向《宝可梦传说 阿尔宙斯》的 12 段待机、物理攻击、特殊攻击和倒地动作。在沙奈朵裙摆保留动作的同时缩小跨版本骨骼偏移，每段动作均抽样确认包围盒与轨道有效。 [三阶段 3D 预览](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/ralts-3d-line.png)
- **验证。** 全量回归 1,310 项通过。新增测试覆盖日照先于预知未来、额外同天气费用、每次判定只成功一次、他人眼中的费用选项、等待付牌时重启恢复和进化组的同步。四人原版身份局、四人丰缘身份局和八人随机混用局均用正常入口与 AI 开局、结算并返回大厅。 [完整测试日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-future-full.log)

- **浏览器与大组队实测。** 同一间 3D 房间通过神奇糖果依次加载三种进化模型，沙奈朵的精神强念播放原作特殊攻击动作。对手在雷公判定里通过两次界面选牌支付预知未来和另一张雷雨牌，判定翻为晴朗，体力保持。30 席按座位混用局由 29 个 AI 补位，在 103 回合结束并返回大厅。首次模拟到达脚本的运行时限，复跑已结算。 [3D 房间验证](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-future-browser.log) · [30 席验证](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/future-playthrough-30-tour-hoenn-final.log)


## 丰缘天气研究 · 木子果、万能伞与阿勃梭鲁

| 内容包 | 实体牌 | 候选组 | 每种印刷天气 |
| --- | ---: | ---: | ---: |
| 原版 | 108 | 40 | 27 |
| 关都与城都巡回 | 132 | 46 | 33 |
| 丰缘天气研究 | 132 | 43 | 33 |
| 巡回＋天气研究 | 156 | 49 | 39 |

- **木子果／万能伞。** 一张分栏牌只选一个效果，四种印刷天气各加入一张。木子果解除使用者存活后备当前的异常状态。万能伞可给自己的一个存活搭档，同一搭档最多一个伞效，交替时跟随搭档。在使用者下回合开始前，太阳、雨水或雪云形态的气象球首次命中该搭档时减去天气增加的 1 点伤害，随后移除伞效。普通形态、完整闪避和伤害免疫保留伞效，击倒清除伞效。使用这两栏道具均保留尚未公开的后备身份。
- **阿勃梭鲁。** Lv.1–3 体力为 3、4、4，三个等级使用同一只阿勃梭鲁的模型。劈开在 Lv.1、Lv.2 的基础伤害为 1、2，Lv.3 解锁基础伤害 2 的暗袭要害，均用「接招吧！」。Lv.2 起可支付烈日或晴朗手牌使用剑舞，获得一枚可叠加的力量强化。「灾祸预感」每个自己的出牌阶段限一次，发动时锁定次数，私下只看顶牌的印刷天气。Lv.2 起可置底这张牌，Lv.3 保留雷雨可补一枚速度强化。放弃时保持原牌序；牌堆只剩一张可用牌时可保留，不能置底。
- **原作来源。** 「灾祸预感」借鉴诸葛亮「观星」的看顶牌与置底，主题取自阿勃梭鲁感知灾难的图鉴设定。木子果沿用宝可梦的解异常用途。万能伞取材于《剑／盾》的隔绝天气道具，分栏牌的一次性抵消、冰雹适用、受益对象和到期时间是本作的桌游裁定。 [三国杀·诸葛亮](https://guozhan.sanguosha.com/a/kapaiyilan/wujiangpai/shu/2013/0126/51.html) · [宝可梦官方图鉴·阿勃梭鲁](https://www.pokemon.com/us/pokedex/0359) · [宝可梦卡牌官方勘误·木子果](https://assets.pokemon.com/assets/cms2/pdf/trading-card-game/tcg-errata-06232023-en.pdf)
- **资产。** 阿勃梭鲁使用本地《X／Y》档案中的模型、骨骼和贴图，同一模型渲染图鉴缩略图。网页按骨骼驱动待机、攻击、受击、闪避与倒地。劈开和暗袭要害使用独立的战场光效与合成音效。 [四种姿势预览](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/absol-3d.png)
- **待定。** 实人试玩观察万能伞在飘浮泡泡出场较少时的使用率，以及阿勃梭鲁的升级收益。沙暴和清单其余条目继续留在后续批次。
- **浏览器验证。** Chromium 通过房间按钮执行预判并取得速度强化，另一席看不到选项。随后用分栏牌启用万能伞并看到状态标记。实战发动暗袭要害后观察到对应光效和 2 点伤害。待机、攻击、受击和闪避的每个抽样姿势均有骨骼变化。 [预判与道具日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/absol-ui-final.log) · [暗袭要害日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/absol-attack.log)
- **房间实测。** 一名玩家席位加其余 AI，四人原版身份局 64 回合、四人丰缘身份局 61 回合、八人随机混用组队局 47 回合。三场均经普通 HTTP 房间入口开局，完成胜负结算并回到大厅。 [原版](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/absol-e2e-base.log) · [丰缘](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/absol-e2e-hoenn-weather.log) · [混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/absol-e2e-tour-hoenn.log)
- **自动回归。** 1,313 项通过，失败与跳过均为零。定向测试覆盖后备隐私与解异常、普通气象球和完整闪避保留伞效、冰雹气象球只造成 1 点伤害、伞效到期、各级预判以及重启后继续选择。旧延时与改判测试已适应随机发到额外「预知未来」的情况。 [全量日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/absol-full-final.log)


## 丰缘天气研究 · 沙暴与沙沙岩石

| 内容包 | 实体牌 | 候选组 | 每种印刷天气 |
| --- | ---: | ---: | ---: |
| 原版 | 108 | 40 | 27 |
| 关都与城都巡回 | 132 | 46 | 33 |
| 丰缘天气研究 | 136 | 43 | 34 |
| 巡回＋天气研究 | 160 | 49 | 40 |

- **沙暴。** 两张即时事件分别印烈日和雷雨。对自己打出，沿用急冻鸟的庇护，结算成功后覆盖现有天气。从打出当回合算起，按生效时存活席位数持续一轮。每个训练家在自己的回合末先结算原版回复，再由沙暴对该席出战造成 1 点环境伤害。岩石、地面或钢属性免疫，双属性取任一，后备不受影响。照常进行受伤、救援、补位和胜负结算。天气伤害没有攻击者，击倒不会给任何人奖励。
- **沙沙岩石。** 两张持有物分别印晴朗与暴雨。设置沙暴时，若使用者出战的沙沙岩石有效，持续时长锁定为两轮。之后交替或遗失岩石沿用已确定的到期回合。
- **气象球与观测。** 沙暴中飘浮泡泡显示既有普通 3D 模型。特性有效时，气象球变为岩石系，支付烈日或雷雨手牌，基础伤害为 2。以同样天气牌发动岩石或地面系伤害招式后可进行一次气象观测，沿用已有置底一张、摸一张的流程。万能伞仍适用气象球的天气增伤裁定。
- **来源与改编。** 岩石、地面、钢的免疫与天气增幅取材于宝可梦主系列。飘浮泡泡的四形态沿用原作，气象球属性和自身形态分别结算。牌数、回合末 1 点伤害、双轮延长和气象观测采用桌游裁定。事件窗口沿用本作急冻鸟的庇护，观测继续借鉴《三国杀》观星。 [宝可梦官方沙暴说明](https://swordshield.pokemon.com/en-au/pokemon-galar-region/sandaconda/) · [飘浮泡泡官方形态图鉴](https://www.pokemon.jp/special/forme/zukan02/zukan2-15.html) · [气象球](https://bulbapedia.bulbagarden.net/wiki/Weather_Ball_%28move%29) · [沙沙岩石](https://bulbapedia.bulbagarden.net/wiki/Smooth_Rock) · [三国杀·观星](https://guozhan.sanguosha.com/a/kapaiyilan/wujiangpai/shu/2013/0126/51.html)
- **待定。** 真人试玩观察大桌里每席 1 点环境伤害的累积压力，以及沙沙岩石延长至两轮的收益。烈空坐的气闸、光之黏土等继续保留在拓展清单。
- **浏览器验证。** 四席草系道馆先显示雨水形态；携带沙沙岩石后用界面打出沙暴，显示八回合并切回普通模型。实测岩石气象球命中造成 2 点伤害，随后完成观测，回合末飘浮泡泡受到 1 点沙暴伤害。 [实战截图](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-sand-weather-ball.png) · [浏览器日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-sand-ui.log)
- **房间实测。** 四人原版身份局、四人丰缘身份局、八人随机混用组队局和 30 人按座位混用组队局经普通 HTTP 入口开局，均完成胜负并回到大厅。30 席含 29 个 AI，58 回合结算。 [原版](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/sand-play-4-base.log) · [丰缘](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/sand-play-4-hoenn-weather.log) · [八席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/sand-play-8-tour-hoenn.log) · [30 席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/sand-play-30-tour-hoenn.log)
- **自动回归。** 1,316 项通过，零失败或跳过。定向验证覆盖四种印刷天气的平衡、天气覆盖与到期、属性免疫、后备免受伤害、岩石气象球的费用和观测、沙暴导致的救援与重连，以及计时结束触发沙暴直接分出胜负。 [全量测试日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-sand-final.log)


## 丰缘天气研究 · 烈空坐的气闸与光之黏土

| 内容包 | 实体牌 | 候选组 | 每种印刷天气 |
| --- | ---: | ---: | ---: |
| 原版 | 108 | 40 | 27 |
| 关都与城都巡回 | 132 | 46 | 33 |
| 丰缘天气研究 | 140 | 43 | 35 |
| 巡回＋天气研究 | 164 | 49 | 41 |

- **烈空坐的气闸。** 两张响应事件分别印烈日与暴雨。天气强化的气象球通过闪避窗口并即将对出战搭档结算伤害时，目标训练家可打出自己手中的一张气闸，抵消本次气象球增加的 1 点天气伤害。支付过的印刷天气、场上天气、气象球属性与观测资格均按原先结算。伤害免疫和已有的万能伞优先处理。每次气象球只开放一次响应，候选手牌只向目标训练家显示。
- **光之黏土。** 两张持有物分别印晴朗和雷雨。防御强化实际将超过 1 的伤害降至 1 时，记录当时携带的黏土。整张牌结算结束时若搭档还在出战、强化仍在且原持有物仍可用，允许弃置原有道具，保留该强化一次。延长后的强化按照原有规则参与下一次耗用它的伤害结算，最迟在该训练家下回合开始时清除。交替、击倒和弃置强化沿用原规则清除标记。保留的同一枚强化只可延长一次。
- **来源与改编。** 烈空坐原作的气闸抑制天气效果，桌游取用这一题材和《三国杀》无懈可击的生效前响应窗口，限定为目标席取消单次气象球增伤。原作光之黏土延长光墙、反射壁，本作借用已有防御强化表示屏障，弃物换取一次额外保护。 [宝可梦官方图鉴·烈空坐](https://www.pokemon.com/us/pokedex/0384) · [宝可梦官方道具指南](https://diamondpearl.pokemon.com/en-gb/trainersguide/grandunderground/) · [三国杀·无懈可击](https://guozhan.sanguosha.com/a/kapaiyilan/youxipai/jinnanpai/2013/0128/99.html)
- **待定。** 真人试玩观察气闸作为专用响应的持有成本，以及光之黏土和防御牌的搭配频率。强力香草、合力指挥与紧急撤退保留在后续清单。
- **自动回归。** 1,319 项通过。定向测试覆盖气闸选项的私密性、场上天气与观测保留、普通气象球、躲闪、万能伞、放弃响应，以及黏土实际减伤的触发条件、放弃后保留持有物、重连续选、续用消耗与到期。 [全量测试日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-air-clay-full.log)
- **房间实测。** 四人原版身份局、四人丰缘身份局、八人随机混用组队局和 30 人按座位混用组队局都经普通 HTTP 入口完成胜负并返回大厅。30 席含 29 个 AI，114 回合结算。 [原版](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/air-clay-play-4-base.log) · [丰缘](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/air-clay-play-4-hoenn-weather.log) · [八席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/air-clay-play-8-tour-hoenn.log) · [30 席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/air-clay-play-30-tour-hoenn.log)
- **浏览器验证。** 在四席 3D 道馆，目标席实际打出气闸，把雨水气象球从 2 点降到 1 点，场上雨天继续生效，对手看不到响应牌选项。之后防御强化将撞击降至 1 点，通过界面弃置光之黏土并查看延长的防御图标。 [气闸响应](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-air-lock-room.png) · [光之黏土响应](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-light-clay-room.png) · [浏览器日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-air-clay-fire-ui.log)


## 丰缘天气研究 · 强力香草、合力指挥与紧急撤退

| 内容包 | 实体牌 | 候选组 | 每种印刷天气 |
| --- | ---: | ---: | ---: |
| 原版 | 108 | 40 | 27 |
| 关都与城都巡回 | 132 | 46 | 33 |
| 丰缘天气研究 | 148 | 43 | 37 |
| 巡回＋天气研究 | 172 | 49 | 43 |

- **强力香草。** 两张持有物，分别印烈日和暴雨。单目标伤害招式被完整闪避时可弃置携带的香草与另两张手牌，对原出战搭档结算 1 点招式伤害。按现有规则处理受伤和救援，原招式的伤害数值与攻击者的后续招式效果不随之生效。多目标招式及骨头回力镖没有这个窗口。守住等视为闪避的效果造成完整闪避时，也可触发香草。
- **接招吧！·合力指挥。** 两张指挥牌，分别印晴朗与雷雨。可作为一张普通指挥支付，也可在自己的出牌阶段另弃两张印刷天气彼此不同的手牌，使伤害指挥招式选择一个超出原目标上限的合法目标。目标逐一结算，原有距离、次数、麻痹天气和指挥宝可梦限制照常生效。支付牌与破坏光线的额外弃牌分别计算。
- **快躲开！·紧急撤退。** 四种印刷天气各一张。作为完成当前闪避的实体牌使用时，记录出战与后备，到整张招式结束时询问是否交替。强力香草造成伤害时，先结算伤害及救援，原搭档仍在出战时才可撤退。撤退成功占用自己的下次普通交替，结算受沙穴等现有交替限制影响。用作事件响应或只提供一部分闪避时，按普通快躲开结算。
- **原作与改编。** 强力香草借宝可梦主系列让蓄力招式立即发动的题材，触发时机借鉴贯石斧，桌游采用 1 点固定基础伤害。合力指挥以丈八蛇矛的双牌支付为参考，用于增加合法目标。紧急撤退参考宝可梦卡牌的出战与后备交换，将普通交替机会移到下回合作为代价。 [宝可梦官方对战回顾](https://www.pokemon.com/uk/play-pokemon/internationals/2019/oceania/vgc-recap-gabby-snyder) · [《三国杀》装备牌](https://guozhan.sanguosha.com/a/kapaiyilan/youxipai/zhuangbeipai/) · [宝可梦卡牌官方规则](https://assets.pokemon.com/assets/cms2/pdf/trading-card-game/rulebook/swsh8_rulebook_en.pdf)
- **待定。** 丰缘清单的 17 种牌已接入房间。真人试玩观察合力指挥三张牌的支付成本、香草用于补最后 1 点伤害的收益和紧急撤退在大桌上的触发频率。宝可梦与独立行动部分继续按清单推进。
- **房间实测。** 四人原版身份局、四人丰缘身份局、八人随机混用组队局及 30 人按座位混用组队局均走普通 HTTP 入口，正常完成胜负并回到大厅。30 席含 29 个 AI，80 回合结算。 [原版](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/combat-cards-play-4-base.log) · [丰缘](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/combat-cards-play-4-hoenn-weather.log) · [八席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/combat-cards-play-8-tour-hoenn.log) · [30 席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/combat-cards-play-30-tour-hoenn.log)
- **浏览器验证。** 同一间四席火系道馆内，界面选择两张不同天气的费用牌和两个目标，实际各造成 2 点伤害。随后单目标气象球被紧急撤退闪避，攻方用界面弃置强力香草及两张牌，原出战受到 1 点伤害，守方确认换入皮卡丘。 [合力指挥](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-coordinated-command-room.png) · [强力香草](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-power-herb-room.png) · [紧急撤退](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-emergency-retreat-room.png) · [浏览器日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-combat-cards-ui-final.log)
- **自动回归。** 1,322 项通过，零失败或跳过。新增用例验证合力指挥的不同天气费用与目标顺序、强力香草的实体支付与伤害时点、紧急撤退等待整张招式、重连、沙穴阻止与下一回合交替额度。旧气闸和万能伞用例明确使用普通快躲开，紧急撤退的新增窗口由专门用例覆盖。 [全量测试日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-combat-cards-final.log)


## 丰缘天气研究 · 小果然与果然翁

丰缘候选池增至 44 组，巡回混用池增至 50 组。各自牌库为 148 张与 172 张。原版为 40 组、108 张。

| 等级 | 宝可梦 | 体力 | 招式与应对 |
| --- | --- | ---: | --- |
| Lv.1 | 小果然 | 3 | 挣扎消耗一张指挥牌，基础伤害 1。受指挥伤害后可用双倍奉还。 |
| Lv.2 | 果然翁 | 4 | 挣扎基础伤害 2。支付烈日或晴朗手牌发动神秘守护，获得一枚防御强化。加入镜面反射。 |
| Lv.3 | 果然翁 | 5 | 挣扎与神秘守护费用相同。反击伤害等于本次承受的伤害，最多 2 点。 |

- **蓄势反击。** 受到另一只出战搭档造成的招式伤害，且完成救援后原搭档仍留场时，才可向原伤害来源响应。双倍奉还对应实体指挥或虚拟指挥招式，另弃一张烈日或晴朗牌。镜面反射对应天气手牌发动的伤害招式，另弃一张暴雨或雷雨牌。Lv.1、Lv.2 的反击伤害为 1。费用选项只向使用者显示，每个训练家回合同一只宝可梦最多成功反击一次。反击走减伤、救援和击倒流程，完成后恢复原招式结算。环境、事件和反击本身没有新的蓄势反击窗口。
- **来源与改编。** 宝可梦原作区分物理、特殊伤害，本作以指挥招式与天气招式对应这两个反击窗口。借鉴《三国杀》司马懿「反馈」在受伤后对原伤害来源生效的结构。挣扎作为桌游的主动攻击，神秘守护表示为防御强化，弃牌、伤害上限与每回合限制均为本作裁定。 [小果然官方图鉴](https://www.pokemon.com/us/pokedex/0360) · [果然翁招式资料](https://www.smogon.com/dex/sm/pokemon/wobbuffet/) · [《三国杀》司马懿](https://guozhan.sanguosha.com/a/kapaiyilan/wujiangpai/wei/2013/0126/34.html)
- **3D 素材。** 小果然和果然翁使用本地《X／Y》模型、贴图及骨骼，图鉴头像由同一模型渲染。网页驱动待机、出招、受击和闪避，测试取样两只的四种姿势并检查果然翁双臂待机位置。 [模型动作预览](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-wobbuffet-3d.png) · [模型检查](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-wobbuffet-models-final.log)
- **浏览器验证。** 四席 3D 房间里，小果然以晴朗手牌对指挥招式完成 1 点反击。正常回合结束升到 Lv.2 后加载果然翁模型。受到雨水气象球的 2 点伤害后，果然翁以雷雨手牌回敬 1 点。 [镜面反射实战](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-wobbuffet-mirror-room.png) · [浏览器验证](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-wobbuffet-ui.log)
- **房间实测。** 四人原版身份局、四人丰缘身份局、八人随机混用组队局和 30 人按座位混用组队局均经普通 HTTP 入口与 AI 完成胜负并返回大厅。30 席含 29 个 AI，84 回合结算。 [原版](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/wobbuffet-play-4-base.log) · [丰缘](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/wobbuffet-play-4-hoenn-weather.log) · [八席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/wobbuffet-play-8-tour-hoenn.log) · [30 席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/wobbuffet-play-30-tour-hoenn.log)
- **待定。** 真人试玩观察 Lv.3 的两点上限和神秘守护的取舍。谜拟丘的画皮裁定和对应的骨骼模型、贴图等待素材补齐。索罗亚、土居忍士分支和独立行动继续保留在清单。
- **自动回归。** 1,325 项通过，零失败或跳过。专项覆盖原版与拓展候选池、费用与私密选项、重连后继续出牌、镜面反射等级限制、救援后反击、反击击倒后恢复原招式。 [全量测试日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-wobbuffet-final.log)


## 丰缘天气研究 · 土居忍士进化分支

丰缘候选池增至 45 组，混用候选池增至 51 组。牌库分别为 148 张和 172 张，原版为 40 组、108 张。

| 等级与路线 | 体力 | 招式 |
| --- | ---: | --- |
| Lv.1 土居忍士 | 3 | 指挥发动抓，基础伤害 1。 |
| Lv.2 土居忍士 | 4 | 指挥发动抓，基础伤害 1。 |
| Lv.3 铁面忍者 | 5 | 急速折返与十字剪的基础伤害均为 2。急速折返结算后可交替。 |
| Lv.3 脱壳忍者 | 1 | 指挥发动影子偷袭，基础伤害 1。 |

- **进化裁定。** 土居忍士在 Lv.3 进化为铁面忍者。Lv.2 土居忍士满体力且在自己的回合结束选择升至 Lv.3 时，可改选脱壳忍者。该选择改变同一只搭档的牌面，沿用原本席位、状态及持有物。固定体力上限为 1，原有额外体力不转入。常规升级与 AI 默认保留铁面忍者。神奇糖果等直接升级沿用常规路线。脱壳忍者展示在图鉴和分支选择里，开局候选仍以土居忍士为组。
- **战斗特性草案。** 土居忍士的「复眼」可借鉴《三国杀》马超压制闪避的机制。建议 1、2 级各自显示同一效果。自己的回合第一次使用「抓」时，可以额外弃一张手牌，令目标需要两张「快躲开！」。铁面忍者的「加速」建议参考马术调整距离。自己回合的第一个伤害招式距离上限加 1。两项触发条件待确认。 [土居忍士官方图鉴](https://dex.pokemon.cn/play/pokedex/0290) · [铁面忍者官方图鉴](https://dex.pokemon.cn/play/pokedex/0291) · [《三国杀》马超](https://www.sanguosha.com/hero/6)
- **神奇守护。** 特性有效时，挡下火、飞行、岩石、幽灵、恶以外的伤害招式，跳过该目标的闪避窗口。气象球按场上实际属性判断，大晴天和沙暴时能命中，普通、雨水和雪云时受阻。事件、环境、异常和反击伤害沿用既有结算，特性压制时仍可被普通招式命中。
- **来源与改编。** 原作在土居忍士进化时可额外产生脱壳忍者。本作沿用每位训练家两只搭档的结构，将它作为 Lv.3 的分支选择。保留原作神奇守护的五项弱点，按本作的招式与非招式伤害管线结算。 [脱壳忍者官方图鉴](https://www.pokemon.com/br/pokedex/shedinja) · [铁面忍者与脱壳忍者的官方卡牌示例](https://www.pokemon.com/uk/pokemon-tcg/pokemon-cards/series/sm8/30/)
- **模型。** 三阶段使用本地《X／Y》骨骼、网格与贴图。铁面忍者采用原模型的展开翼面，前后翅屈伸由网页驱动。脱壳忍者应用漂浮与身体反应，保留壳翼形状。头像从同一 GLB 渲染。 [三阶段动作预览](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-nincada-3d.png) · [模型检查](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-nincada-models.log)
- **浏览器与回归。** 3D 房间依次加载三个模型，实际用回合末界面选择脱壳忍者，确认其满体力为 1。撞击触发免伤，火属性气象球命中后进入救援并换入后备。1,329 项自动测试全部通过，包含岩石气象球、地面伤害、沙暴、特性压制和重连。 [升级界面](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-nincada-branch-room.png) · [浏览器日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-nincada-ui.log) · [测试日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-nincada-full.log)
- **房间实测。** 四人原版身份、四人丰缘身份、八人随机混用组队与 30 人按座位混用组队均经普通入口加入 AI，完成胜负并返回大厅。30 席含 29 个 AI，86 回合结算。 [原版](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/nincada-play-4-base.log) · [丰缘](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/nincada-play-4-hoenn-weather.log) · [八席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/nincada-play-8-tour-hoenn.log) · [30 席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/nincada-play-30-tour-hoenn.log)
- **2026-11-27 进化路线回归。** Chromium 房间验证 Lv.1 升到 Lv.2 仍是土居忍士，图鉴的第二级显示土居忍士，第三级显示铁面忍者。两场丰缘房间分别从回合末界面选择铁面忍者和脱壳忍者，确认等级、体力和 3D 模型。四席原版身份局含三个 AI，43 回合结算并返回大厅。全量 1,390 项自动测试通过。
- **待定。** 真人试玩重点观察混用牌桌上的弱点招式密度、一点体力的取舍与大桌收尾速度。索罗亚、谜拟丘与独立行动继续保留在清单。


## 丰缘天气研究 · 索罗亚进化组

丰缘候选池增至 46 组，混用候选池增至 52 组。牌库仍为 148 张和 172 张，原版为 40 组、108 张。

| 等级 | 体力 | 招式 |
| --- | ---: | --- |
| Lv.1 索罗亚 | 3 | 指挥发动抓，基础伤害 1。 |
| Lv.2 索罗亚克 | 4 | 指挥发动暗袭要害，基础伤害 2。 |
| Lv.3 索罗亚克 | 4 | 保留暗袭要害，加入基础伤害 2 的暗黑爆破。 |

- **幻觉。** 开局或交替登场时，若特性有效且后备存活，向其他席位和旁观者展示后备当时的模型和等级。主人可查看真身和可用招式。实际体力、异常和持有物公开，已公开的交替信息仍可用于推断。合法出招、受到正数伤害、换出或特性被压制时解除伪装。完整闪避会保留伪装，升级后也可继续维持伪装。
- **私藏诱饵。** Lv.2 起在自己的出牌阶段、仍处于伪装中时，可私下标记一张非指挥手牌。标记时牌留在手里，其他席位只看到训练家正在选择。标记牌可弃置一次以支付伤害指挥招式，沿用该招式的目标、天气与额外费用规则。费用结算后牌进入弃牌堆，按虚拟指挥结算。揭示真身后仍可用已标记的牌，换出会清除标记，牌已离手时无法支付。AI 使用可见的对手牌面评估攻击，并可标记和支付诱饵。
- **来源与改编。** 宝可梦主系列的幻觉模仿队尾同伴，本作用唯一后备作为伪装，并在主动出招前揭示。私藏诱饵借鉴《三国杀》于吉「蛊惑」以手牌代用的设计，改为本人私下标记，由服务器处理结算。 [宝可梦官方图鉴·索罗亚克](https://www.pokemon.com/br/pokedex/zoroark) · [《三国杀》于吉](https://www.sanguosha.com/news/20161026_8184_0611)
- **模型与浏览器。** 两只宝可梦使用本地《X／Y》模型的网格、贴图和骨骼。待机、出招、受击、闪避用网页骨骼驱动；四个动作逐一检查了骨骼变化和轮廓。四席 3D 房间实测对手和旁观者均看到皮卡丘，主人通过神奇糖果升至 Lv.3、标记真实闪避牌、选择暗黑爆破和目标。旁观者无法取得选项，确认出招后揭示索罗亚克，结算 2 点伤害。 [动作预览](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-zorua-3d.png) · [实战截图](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-zorua-decoy-room.png) · [浏览器日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-zorua-ui.log)
- **自动回归与房间实测。** 1,332 项自动测试全部通过。包括开局和切换登场的视角、重连、虚拟指挥、闪避与实际受伤。四人原版身份局、四人丰缘身份局、八人随机混用组队局、30 人按座位混用组队局均从普通入口加入 AI，完成结算并返回大厅。30 人局含 29 个 AI，79 回合结算。 [全量测试](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-zorua-full.log) · [原版](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/zorua-play-4-base.log) · [丰缘](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/zorua-play-4-hoenn-weather.log) · [八席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/zorua-play-8-tour-hoenn.log) · [30 席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/zorua-play-30-tour-hoenn.log)
- **待定。** 真人试玩观察实际公开体力对伪装的影响，以及私藏诱饵对手牌周转和进攻频率的影响。谜拟丘的骨骼模型和画皮、独立行动仍在清单。


## 关都与城都巡回 · 训练家对视与拼尽全力

本批在「关都与城都巡回」及混用包增加两个出牌阶段行动，身份局和组队局均可使用。两个行动都沿用正常房间入口与响应面板。原版和单独丰缘包沿用各自的行动，牌库和宝可梦候选数维持现有设置。

- **训练家对视。** 每个自己的回合限发起一次。选择另一位仍在场且有手牌的训练家，发起者先暗选一张，对方再暗选一张。第一张仍算在发起人的手牌内，旁观者拿不到选项，对方也看不到已提交的牌。双方提交后在同次结算公开并弃置两张牌，按印刷天气「雷雨 ＞ 暴雨 ＞ 烈日 ＞ 晴朗」排序，胜者摸一张，同天气时双方都无奖励。发起者提交前可取消；计时开启时，发起者超时取消，对方超时由服务端从他的可选手牌随机代选。断线期间沿用房间暂停规则，重连后继续暗选。
- **拼尽全力。** 每位训练家每局一次。出战搭档体力至少为 2，且有两张牌可摸时，出牌阶段可确认支付 1 点体力再摸两张。费用按体力扣减，跳过招式减伤、受伤特性和救援。取消或确认超时不消耗次数，普通换位或升级也不刷新次数。新一局重置。
- **来源与改编。** 训练家对视用路线上的对战邀请做题材，借用《三国杀》拼点的暗选与一起亮牌，以四种印刷天气代替点数。拼尽全力是短时特训，参考标准黄盖的「苦肉」用体力换手牌，加上每局一次和最低体力条件。 [宝可梦官方·对视发起对战](https://legends.pokemon.com/en-us/gameplay) · [《三国杀》拼点](https://diy.sanguosha.com/course/) · [《三国杀》黄盖](https://www.sanguosha.com/hero/11)
- **实战验证。** 四席 3D 浏览器房间先支付 1 点体力摸两张，再分别从两席选择暴雨讲究围巾与雷雨木子果／万能伞，验证第二席和观众在结算前看不到第一张、两张同时公开、雷雨获胜摸牌。原版四席身份、巡回四席身份、八席随机混用组队和 30 席按座位混用组队均从普通 HTTP 入口带 AI 完成结算并返回大厅。30 席场含 29 个 AI，63 回合内完成 12 次对视和 25 次拼尽全力。 [3D 暗选](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/tour-showdown-pick-room.png) · [3D 亮牌](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/tour-showdown-reveal-room.png) · [浏览器日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/tour-showdown-ui.log) · [原版房间](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/showdown-play-4-base.log) · [巡回房间](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/showdown-play-4-kanto-johto.log) · [八席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/showdown-play-8-tour-hoenn.log) · [30 席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/showdown-play-30-tour-hoenn.log)
- **自动回归。** 1,336 项全部通过。专项测试覆盖暗选隐私、重连、超时代选、平局、体力费用和内容包开关。首次全量回归发现旧测试把随机获得幻觉的搭档改成飘浮泡泡时留下了伪装状态，已修正测试夹具并重新运行。 [全量测试日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/tour-showdown-full-final.log)
- **待定。** 真人试玩观察对视的发起频率、无距离限制对大桌的影响和两张牌的消耗；观察两点体力时发动拼尽全力的收益。谜拟丘「画皮」仍待本地第七世代两种形态的骨骼模型和贴图。


## 丰缘天气研究 · 谜拟丘与画皮

谜拟丘加入丰缘天气研究和混用包。丰缘候选池 47 组，混用候选池 53 组。实体牌库仍分别为 148 张和 172 张，原版维持 40 组、108 张。

| 等级 | 体力 | 招式 |
| --- | ---: | --- |
| Lv.1 谜拟丘 | 3 | 指挥发动影子偷袭，基础伤害 1。 |
| Lv.2 谜拟丘 | 4 | 指挥发动暗影爪，基础伤害 2。 |
| Lv.3 谜拟丘 | 4 | 保留暗影爪，加入基础伤害 2 的嬉闹。可主动解除画皮。 |

- **画皮。** 完整闪避后仍保留。另一位训练家的伤害招式通过闪避结算并将造成正数伤害时，画皮抵消这一次伤害和依赖本次伤害触发的附带效果，模型变为现形。多段招式后面的段数正常继续。纯状态招式、事件、天气、反击及异常伤害照原来的路径处理。特性被压制时照常受伤，压制解除后仍可用未消耗的画皮。现形随该个体换位、升级和重连保留。
- **主动解除。** Lv.3 在自己的出牌阶段且特性有效时，可确认消耗画皮来获得一枚力量强化。已有力量强化时暂不可用，取消不消耗画皮。该强化按原流程支付给下一次指挥攻击。AI 可在达到击倒阈值时主动解除，也可攻击仍带画皮的对手。
- **来源与改编。** 对照《太阳／月亮》时代吸收一次攻击并倒下布偶头的主题，采用不扣体力的画皮。清单借《三国杀》八卦阵参考一次进攻结算中的防护时机，桌游不需要翻判定牌。主动解除换力量是本作的取舍。 [宝可梦《太阳／月亮》官方资料](https://www.pokemon.co.jp/ex/sun_moon/pokemon/160719_06.html) · [谜拟丘图鉴](https://www.pokemon.cn/play/pokedex/0778) · [《三国杀》八卦阵](https://guozhan.sanguosha.com/a/kapaiyilan/youxipai/zhuangbeipai/2013/0128/124.html)
- **3D 素材。** 两种形态共用《太阳／月亮》的战斗网格、原作布套贴图和 91 根骨骼，分别绑定化形和现形的原版战斗动作。校正骨骼基准轴、贴图镜像平移和纵轴后，逐一检查了布套眼睛、黑色耳尖、木尾、垂下的头部及待机、出招、受击。纯招式特效网格由本项目的招式特效处理。 [动作总览](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-mimikyu-3d.png) · [导出日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-mimikyu-native-export.log) · [动作检查](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-mimikyu-models.log)
- **3D 实战。** 从四席房间选将进入，化形模型首次被火花击中时挡下伤害与伤害后的异常，旁观者看见现形且体力仍是 3。下一轮再用火花，确认体力降为 2，仍维持现形。 [化形](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-mimikyu-intact-room.png) · [现形](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-mimikyu-busted-room.png) · [浏览器日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-mimikyu-ui.log)
- **房间回归。** 四人原版身份局、四人丰缘身份局、八人随机混用组队和 30 人按座位混用组队均经 HTTP 普通入口加入 AI，完成结算并返回大厅。30 人房间有 29 个 AI，80 回合结算。 [原版](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/mimikyu-play-4-base.log) · [丰缘](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/mimikyu-play-4-hoenn-weather.log) · [八席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/mimikyu-play-8-tour-hoenn.log) · [30 席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/mimikyu-play-30-tour-hoenn.log)
- 另开一局让谜拟丘首发的四人丰缘身份局。带 3 个 AI，93 回合结束，实际触发一次被动画皮与一次主动解除，并回到大厅。 [谜拟丘首发实测](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/mimikyu-play-featured.log)
- **自动回归。** 1,340 项全部通过，涵盖画皮挡伤、完整闪避、沙暴、特性压制、重连与换位。 [测试日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-mimikyu-full-release.log)
- **待定。** 真人试玩观察首次吸收在不同人数桌上的价值，以及 Lv.3 主动解除换力量的使用频率。


## 关都与城都巡回 · 看我嘛

「关都与城都巡回」和混用包的公开组队局启用此响应。同队训练家可以替队友承接对方的单体伤害招式。身份局、原版与单独丰缘包照各自流程结算。

- **合法范围。** 招式必须只允许指定一个目标，该次指定也只有一名目标。沿用宣告时的攻击范围、指定限制和原本合法目标。候选承接方须仍在场、出战搭档有正数体力、自身有手牌，且属于目标阵营。攻击者与目标同队时不开放响应。招式可指定多名目标时，即使这次只指定一名，也不开放。
- **响应顺序。** 在迷人之躯等原目标指定完成后、压迫感与普通防御之前，从被指定队友的下一席起询问仍合法的同队训练家。费用选项仅对当前响应者显示。放弃或响应超时便询问下一位。成功者弃置一张手牌，随后替换招式目标，继续对新目标结算防御、伤害及附带效果。整张招式只接受一次承接，单目标多段招式后续段也指向承接席。
- **来源与改编。** 《三国杀》大乔的流离用弃牌改变「杀」的目标。宝可梦双打的看我嘛让队友吸引单体攻击。本作由在射程内的同队训练家自愿支付手牌，沿用既有响应和伤害流程。 [《三国杀》界大乔](https://sanguosha.com/news/20141128_6555_1611) · [宝可梦官方双打资料](https://www.pokemon.com/uk/features/series-3-and-4-gigantamax-pokemon-in-vgc-gigantamax-gengar-lapras-coalossal-and-more)
- **3D 实战。** 四席混用房间用小火龙向 1 点体力的杰尼龟发动火花，另一席使用谜拟丘选牌并承接。旁观视图无法查看选牌选项，新的防御窗口属于谜拟丘。放弃闪避后画皮吸收攻击，杰尼龟保持 1 点体力，谜拟丘保持 3 点体力并现形。 [响应选择](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/tour-follow-me-choice.png) · [现形结算](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/tour-follow-me-settled.png) · [浏览器日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/tour-follow-me-ui.log)
- **房间回归。** 四席原版身份、四席巡回身份、八席随机混用组队与 30 席按座位混用组队均从普通入口加入 AI、结算并返回大厅。30 席含 29 个 AI，69 回合中完成 12 次成功承接。 [原版](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/follow-me-play-4-base.log) · [巡回身份](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/follow-me-play-4-kanto-johto.log) · [八席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/follow-me-play-8-tour-hoenn.log) · [30 席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/follow-me-play-30-tour-hoenn.log)
- **自动回归。** 1,343 项全部通过，覆盖范围、身份局和内容包开关、单体限制、私密费用、重连、超时、AI 响应与替换后的防御。旧卡牌专项按正常流程让队友放弃可选承接，继续验证原卡牌效果。 [测试日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/tour-follow-me-full-final.log)
- **待定。** 真人试玩观察大桌连续询问的节奏，以及有免伤、减伤或完整闪避能力的队友承接时的收益。


## 关都与城都巡回 · 夜间观察

「关都与城都巡回」和混用包在身份局和组队局提供「公开图鉴调查」。使用「宝可装置／宝可梦图鉴」选择图鉴效果后，照常私看并整理牌堆顶两张牌。可用的牌只剩一张时可整理这一张。

- **公开图鉴调查。** 同一出牌阶段，刚选为第一张的牌仍是当前顶牌时，可以主动公开它的牌名、牌类和印刷天气。第二张与实体牌编号仍属私密，牌序维持整理时的结果。目前顶牌为另一张时，公开选项会隐藏。公开每回合限一次，重连保留当回合的合法选项。
- **夜间观察。** 公开调查后，完成正常弃牌，在回合收尾自动摸一张当前顶牌。这张牌可以带进下一回合。奖励在回合结束的沙暴伤害前结算。牌堆及弃牌堆都空时跳过。未公开的图鉴整理没有回合末奖励。既有补牌特性继续按原流程处理。
- **来源与改编。** 借鉴貂蝉「闭月」的结束阶段补牌，并用夜间生态调查和图鉴报告解释公开条件。 [《三国杀》貂蝉](https://www.sanguosha.com/hero/24) · [宝可梦官方《Pokémon Sleep》介绍](https://www.pokemon.com/us/app/pokemon-sleep/)
- **3D 实战。** 四席混用房间从手牌使用宝可梦图鉴，私下交换顶两张并公开选中的「接招吧！」暴雨牌。旁观确认另一张未公开；完成弃牌后持有 4 张，结束回合摸到该顶牌，下一回合手牌为 5 张。 [调查公开](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/tour-night-survey-room.png) · [结束回合](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/tour-night-end-room.png) · [浏览器日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/tour-night-ui.log)
- **房间回归。** 四席原版身份、四席巡回身份、八席随机混用组队和 30 席按座位混用组队均从普通入口带 AI 完成胜负并返回大厅。巡回四席和混用八席各完成 2 次公开调查与补牌；30 席含 29 个 AI，65 回合内完成 3 次。 [原版](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/night-final-play-4-base.log) · [巡回](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/night-final-play-4-kanto-johto.log) · [八席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/night-final-play-8-tour-hoenn.log) · [30 席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/night-final-play-30-tour-hoenn.log)
- **自动回归。** 1,346 项全部通过。覆盖秘密排序、公开顶牌、旧顶牌失效、AI 选择、弃牌后获得奖励、重连与沙暴救援期间的单次结算。 [测试日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/tour-night-full-final.log)
- **待定。** 真人试玩观察公开顶牌给对手的情报价值，以及玩家在回合末保留额外一张牌的实际收益。


## 满金市广播塔争夺战

大厅将玩法选为「组队对战」，再把组队场景设为「满金市广播塔争夺战」。沿用普通组队的 2–30 个偶数席位、AI、随机分队与按座位交替。可搭配任意现有牌包与地图。清单初稿的 4–12 人范围按现有组队容量扩展。

- **广播塔联络。** 自己的出牌阶段限一次。先暗选一张手牌，再选印刷天气不同的第二张。两张一起弃置后，己队增加 1 情报点。确认第二张前可放弃，响应超时也按放弃处理。两步之间重连可继续选牌。第一张仍在手中，未提交第二张时不计分。其他席位可见当前响应和比分，费用选项及牌面仅向响应者显示。
- **胜利。** 两队开局各 0 点，先到 4 点立即获胜。淘汰对方全队仍可获胜。沿用组队胜者名单和战报，阵营内已退场者也算本队获胜。桌面和战报公开两队进度，战报注明胜因。返回大厅保留房间场景设定，再开一局从 0–0 起算。
- **来源与改编。** 满金市广播塔取材于火箭队利用电台试图联络坂木的剧情。淘汰胜利沿用原组队规则，与《三国杀》国战消灭其他势力的方向相近。以两张印刷天气不同的牌换情报点、四点胜利是本作设计。 [宝可梦官方城都回顾](https://www.pokemon.com/es/noticias-pokemon/celebra-25-anos-de-pokemon-con-los-mejores-momentos-de-johto) · [《三国杀》国战胜负规则](https://guozhan.sanguosha.com/game_rule/settlement.html)
- **3D 实战。** 四席从普通大厅选择广播塔场景，打开两步联络窗，验证第一张待提交且旁观者无法读取，确认第二张后公开得分。经四次联络在四位训练家均存活时以 4–0 结算，胜因及比分保留在战报，随后返回大厅。 [大厅设置](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/radio-tower-lobby.png) · [联络预览](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/radio-tower-contact.png) · [战报预览](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/radio-tower-victory.png) · [浏览器日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/radio-tower-ui-final.log)
- **房间回归。** 从普通入口带 AI 完成 2 人按座位、8 人随机、30 人按座位广播塔组队场，比分均为 4–3，分别在第 13、7、7 回合结算。30 人含 29 个 AI。四人原版身份局和八人普通混用组队局也经正常入口完成胜负并返回大厅。 [2 人广播塔](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/radio-play-2-radio.log) · [8 人广播塔](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/radio-play-8-radio.log) · [30 人广播塔](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/radio-play-30-radio.log) · [原版](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/radio-play-4-classic.log) · [普通组队](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/radio-play-8-standard.log)
- **自动回归。** 1,350 项全部通过。专项覆盖场景与房间容量、私密计分、天气限制、重连、情报胜利、淘汰胜利和再开一局。 [全量测试日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/radio-tower-full-final.log)
- **待定。** 真人试玩观察四点门槛在大桌的节奏，以及首发阵营与后发阵营的得分机会。


## 丰缘天气研究所

大厅选择「丰缘天气研究」或「混用」牌包后即可勾选。身份局和组队局均可使用，默认关闭。组队可同时选择满金市广播塔争夺战。独立记录预报轮次与当前结果，返回大厅时清除战局数据并保留房间选项。

- **每轮判定。** 开局部署完成后，首位训练家在摸牌前判定。此后行动顺序每次绕回开局顺序的前端时判定一次。若首座已淘汰，由该轮第一位存活的训练家判定。沿用自动翻开、手动翻开、六尾的日照和沙奈朵的预知未来。采用最终牌面。烈日对应大晴天，暴雨对应求雨，雷雨对应冰雹，晴朗或没有可判定的牌时维持常态。沙暴仍由原有事件触发。
- **同场天气。** 天气事件的效果优先，持续时间与天气岩石照常计算。事件到期后恢复当轮有效预报。飘浮泡泡的天气形态、气象球和气象观测按当前有效天气计算。3D 换形保留模型原有朝向，用「阴晴不定」提示。
- **来源与改编。** 参考《三国杀》国战在摸牌前处理判定的时序，取材于丰缘的天气研究和飘浮泡泡随天气换形。全桌每轮共用一次判定、牌面与天气的映射、预报与事件的优先级均为本作规则。 [《三国杀》国战回合流程](https://guozhan.sanguosha.com/game_rule/game.html) · [飘浮泡泡官方图鉴](https://www.pokemon.com/us/pokedex/0351)
- **浏览器验证。** 经大厅设置进入四席组队，使用桌面牌堆手动翻开判定。旁观视图同步显示冰雹，飘浮泡泡从普通形态切至雪云形态。验证换形提示、模型加载与动画结束后完整悬浮。 [大厅设置](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-weather-lab-lobby.png) · [雪云形态](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-weather-lab-snow.png) · [浏览器日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-weather-lab-ui.log)
- **房间实战。** 四人原版身份局第 65 回合结算。四人丰缘身份局用手动判定，第 30 回合结算，共判定八轮。八人随机混用组队同时启用广播塔，第 6 回合以 4–2 情报胜利结算。30 人按座位混用组队含 29 个 AI，第 92 回合淘汰结算，共判定八轮。四组都从正常房间入口开局并在结算后返回大厅。 [房间日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-weather-lab-room.log)
- **自动回归。** 1,354 项全部通过。专项验证包限制、默认关闭、重启后继续手动判定、判定替换、开局席淘汰后的轮次、气象球伤害和天气岩石到期后恢复预报。 [全量测试日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/hoenn-weather-lab-full.log)
- **待定。** 真人试玩观察大桌单轮天气的体感时长、预报遇上天气事件的频率，以及冰雹改判的实际收益。



## 常磐道馆·谁是真馆主

大厅选择身份玩法，在「身份场景」选「常磐道馆·谁是真馆主」。支持 5–8 席和 AI，沿用当前地图、牌包和可用的丰缘天气研究所。五至八席的身份构成依次为 1/1/2/1、1/1/3/1、1/2/3/1、1/2/4/1（馆主／道馆训练家／挑战者／火箭队）。

- **开局。** 从道馆训练家中随机选一名公开为代理馆主，由其先手，再沿座次行动。所有训练家确认私有身份后，从共用宝可梦牌库各摸五只。代理馆主的出战从 Lv.2 开始，出战和后备各增加 1 点体力上限。真馆主的搭档按普通 Lv.1 开局，揭示时也不补等级或体力。
- **公开查验。** 真馆主揭示前，每位训练家可在出牌阶段至多成功一次。先选择一个仍在场、身份未亮且未查验过的其他席位，再选择一张手牌弃置。全桌只收到目标是否为挑战者的结果。确认付款前可以取消，超时放弃。旁观者看不到待提交的选项。AI 只根据公开线索和自己的身份作决定。
- **揭示与胜负。** 代理馆主正式退场或第三轮开始时，真馆主亮牌。首座出局后，后续轮次照样从下一位存活训练家展开。若真馆主先退场，直接亮牌并按原版身份胜负判定，代理馆主退场本身不触发胜负。正常胜负成立时公开身份与手牌。返回大厅保留场景设定，再开局重新分配。
- **来源与改编。** 参考《三国杀》「忠胆英杰」明忠公开先手、暗主在明忠退场后亮牌。常磐道馆取材于坂木担任馆主的关都设定。第三轮自动亮牌、公开查验、不同人数配表和搭档加成是《谁是火箭队》的改编。 [《三国杀》忠胆英杰官方规则](https://sanguosha.com/news/20151020_9798_4319) · [宝可梦官方常磐道馆介绍](https://www.pokemon.com/uk/news/test-your-team-rocket-knowledge-with-this-quiz)
- **浏览器验证。** 经普通大厅选择场景并开八席，确认第一阶段只公开代理馆主、实战加载八只 3D 宝可梦。实际点击公开查验与付款后，旁观者收到「并非挑战者」线索，目标身份仍隐藏。第 17 回合进入第三轮时亮出真馆主。 [八席预览](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/viridian-eight-trainers.png) · [第三轮揭示](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/viridian-round-three.png) · [浏览器日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/viridian-ui.log)
- **正常房间结算。** 四席原版含 3 个 AI，第 52 回合道馆阵营获胜。五席常磐原版牌包含 4 个 AI，第 11 回合揭示，第 33 回合道馆阵营获胜。八席常磐混用牌包与天气研究所含 7 个 AI，完成 5 次查验，第 17 回合揭示，第 26 回合挑战者获胜。三桌均通过正常房间入口并在结算后返回大厅。 [原版](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/viridian-play-classic.log) · [五席](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/viridian-play-five.log) · [八席](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/viridian-play-eight.log)
- **自动回归。** 1,358 项全部通过。专项覆盖八席共用牌库、旁观与 AI 视角保密、重连续选、单次付款、第三轮及代理出局两种揭示时机、隐藏期间的胜负与重开。 [全量测试日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/viridian-full.log)
- **待定。** 真人试玩观察开局加成、第三轮揭示节奏和公开线索在五席与八席的价值。



## 房间规则书与道馆护卫

游戏上方的「规则书」按房间保存的玩法、分队、场景和牌包显示中英文规则。包含原版身份、练习对决、组队、广播塔和常磐道馆的开局、出招与结算，并在选用时显示天气研究所、看我嘛或道馆护卫。大厅按设置和席位算牌库张数，对局中使用开局快照。可独立阅读 [《谁是火箭队》规则书](./GAME-RULEBOOK.md)。

- **护卫任命。** 房主选择常磐道馆后可勾选「道馆护卫」，默认关闭。有两名道馆训练家时，由代理以外的一位公开担任护卫。只有一名时代理兼任。护卫状态公开显示，返回大厅保留选项，再开时重新指派。
- **承接裁定。** 真馆主已亮牌且仍出战时，护卫可在防御前承接伤害型单目标招式。护卫必须仍在场、符合原招式的范围与目标限制。接受后消耗每局一次机会，无需弃牌，招式的防御、伤害和救援均以护卫为目标。放弃、超时或不符合资格时不耗次数。真馆主未亮牌期间不开护卫提示。
- **来源与改编。** 参考《三国杀》护驾的同阵营保护和流离的目标转移，以及宝可梦「看我嘛」引开攻击的玩法。以道馆训练家身份提供每局一次承接是本作改编。 [《三国杀》护驾](https://www.sanguosha.com/news/20161101_5213_3118) · [《三国杀》流离](https://www.sanguosha.com/hero/13) · [宝可梦官方双打战术](https://www.pokemon.com/uk/strategy/rock-your-toughest-foes-with-lycanroc)
- **房间结算。** 四席原版含 3 个 AI，第 42 回合道馆阵营获胜。五席常磐含 4 个 AI，第 18 回合挑战者获胜。八席常磐混用含 7 个 AI，同时启用天气研究所，道馆护卫成功发动，第 65 回合道馆阵营获胜。三场均从正常入口开局并在结算后回到大厅。 [原版回放日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/gym-guard-classic.log) · [五席](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/gym-guard-five.log) · [八席](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/gym-guard-eight.log)
- **验证。** 全量 1,362 项通过。专项覆盖正确载入规则、公开任命、隐藏馆主、超时放弃、范围限制、重连继续响应、次数和换目标。浏览器验证原版、广播塔与常磐道馆之间的规则切换、中英文和窄屏显示，并在五席 3D 房间实际点选承接，确认招式转向护卫且无手牌费用。 [全量日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/gym-guard-full.log) · [规则书](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/rulebook-viridian-zh.png) · [护卫响应](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/gym-guard-prompt.png) · [浏览器日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/gym-guard-rulebook-ui.log)
- **待定。** 真人试玩观察五、六席代理兼任的强度，以及七、八席公开第二名道馆训练家后对查验和胜率的影响。



## 常磐道馆 · 武藏与小次郎

在常磐道馆的房间设置中可勾选「武藏与小次郎」，默认关闭。支持 5–8 席及 AI，可与道馆护卫和丰缘天气研究所同时启用。

- **身份配置。** 用第二名火箭队成员替换一名挑战者。五至八席的身份构成依次为 1/1/1/2、1/1/2/2、1/2/2/2、1/2/3/2（馆主／道馆训练家／挑战者／火箭队）。两个代号随机分配，选搭档与开局体力照常。
- **保密。** 两位火箭队成员可在私有身份档案或实战桌面菜单查看对方昵称及代号。重连继续可见。旁观者、其他角色和公开 AI 数据按原有亮牌规则读取。对局结束后战报公开两人的代号。再次开局重新分配。
- **胜负。** 若真馆主退场，且至少有一位火箭队成员存活、在场者全部属于火箭队，武藏与小次郎共享胜利，即使其中一位已退场。若真馆主退场时还有其他阵营留场，挑战者获胜。道馆阵营沿用原有胜利条件。游戏内所选玩法规则书和 [独立规则书](./GAME-RULEBOOK.md) 均含对应规则。
- **来源与改编。** 取材于《Let’s Go》中武藏和小次郎组队行动，参考《三国杀》2v2 的同队共享胜利。将互认设为私密信息，并与馆主退场条件结合，是本作改编。 [宝可梦官方关都设定](https://pokemonletsgo.pokemon.com/en-us/kanto-region/) · [《三国杀》官方玩法](https://www.sanguosha.com/mode?id=3)
- **正常房间结算。** 四席原版含 3 个 AI，第 33 回合火箭队单人获胜。五席常磐第 18 回合道馆阵营获胜。六席含 5 个 AI，第 47 回合武藏与小次郎双人获胜。七席及启用护卫和天气研究所的八席在第 17、19 回合分别由挑战者获胜。每桌经正常入口开局并在结算后返回大厅。 [原版](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/rocket-partners-classic.log) · [五席](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/rocket-partners-five.log) · [六席与七席](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/rocket-partners-ai-extra.log) · [八席](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/rocket-partners-eight.log)
- **实际验证。** 1,365 项自动测试通过。专项覆盖互认、旁观与公开 AI 保密、只公开已亮牌的代号、AI 避免将私密搭档选作攻击目标、两人留场和一人退场两种共享胜利、挑战者胜利与再开局。浏览器经大厅选择变体，实测私密档案与实战菜单、规则书和最后一击后的双人战报。 [全量日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/rocket-partners-full.log) · [私密身份](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/rocket-partners-private.png) · [双人战报](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/rocket-partners-victory.png) · [浏览器日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/rocket-partners-ui.log)
- **待定。** 真人试玩观察五席仅有一名挑战者时的平衡，以及火箭队在馆主身份公开前合作会暴露多少信息。



## 常磐道馆 · 火箭队潜伏者

大厅选择常磐道馆后勾选「火箭队潜伏者」，默认关闭，允许 5–8 席与 AI。单独开启时，把原身份表的一名挑战者换成潜伏者。同时启用「武藏与小次郎」时需 6–8 席，以保留至少一名挑战者。可叠加道馆护卫和丰缘天气研究所。

- **时机与隐私。** 潜伏者起始独立，可在私有身份档案查看自己。第二轮开始时，若仍在场，由该玩家在第一位训练家摸牌前选择阵营。启用天气研究所时先完成天气判定。全桌看到谁正在表态，只有潜伏者能提交选项。提交后角色及阵营立即公开，整局固定。响应超时默认独立，已退场则跳过，重连保留未完成的选择。
- **胜负。** 真馆主退场时，若唯一留场的是独立潜伏者，则该训练家单独获胜。若留场者全部属于火箭队且至少存活一人，火箭队全员共享胜利，包含已加入的潜伏者与已退场队员。其余真馆主退场的结果归挑战者。真馆主存活且所有敌对身份退场则道馆获胜。游戏内规则书和 [独立规则书](./GAME-RULEBOOK.md) 随选项展示对应分支。
- **来源与改编。** 借《三国杀》内奸独存的胜利条件，取材于动画里火箭队的乔装行动。第二轮公开选边及结算时的阵营归属是本作设计。 [《三国杀》官方胜负规则](https://www.sanguosha.com/faq.html) · [宝可梦官方火箭队乔装专题](https://www.pokemon.com/uk/pokemon-news/team-rocket-dons-numerous-disguises-on-pokemon-tv)
- **房间结算。** 四席原版含 3 个 AI，第 40 回合道馆阵营获胜。五席潜伏者房含 4 个 AI，潜伏者加入火箭队，第 22 回合道馆阵营获胜。八席混用启用武藏与小次郎、护卫和天气研究所，含 7 个 AI，第 44 回合火箭队获胜，战报列出三名共享胜者。三局均从正常入口开局并在结算后返回大厅。 [原版](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/infiltrator-classic.log) · [五席](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/infiltrator-five.log) · [八席](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/infiltrator-eight.log)
- **实际验证。** 1,371 项自动测试通过。专项覆盖配置、保密、天气判定先后、重连、响应超时、提前退场及两条胜利路线。浏览器通过普通大厅启用潜伏者，实测五席 3D 对战在第 6 回合出现第二轮选项，并经最后一击获得独立胜利。 [自动测试](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/infiltrator-full.log) · [公开表态预览](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/infiltrator-pledge.png) · [独立胜利](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/infiltrator-victory.png) · [浏览器日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/infiltrator-ui.log)
- **待定。** 真人试玩观察第二轮选边时机和独立路线的实际收益。



## 公开职业 · 乔伊、小刚与大木博士

房主可在对局设置勾选「公开职业」，默认关闭。身份、组队和已实现的场景皆可使用。玩家可在确认搭档时选择一项职业，多人可选同一职业。职业从确认时公开，隐藏身份、手牌和后备仍按现有权限显示。AI 可选择职业。结算后保留房间选项，职业下一局重新选择。

- **乔伊。** 每局一次，在轮到自己响应救援时，弃置出战或已公开后备的一件持有物，目标回复 1 点体力。原有仅允许昏厥方救援的限制适用。体力仍为 0 或以下时，可继续用其他合法救援牌。出战猴怪失去持有物时保留「不服输」的响应，随后继续救援。
- **小刚。** 只有成功执行普通交替的训练家，才能在当回合的结束阶段照料存活受伤的后备，回复 1 点体力。该回合限一次。受限制而未完成的交替或先前紧急撤退占掉的普通交替次数不会提供机会。
- **大木博士。** 每局一次，在出牌阶段登记并公开存活后备，随后私下查看牌堆顶至多两张。仅可调整这两张的顺序。放弃或超时保持牌序，登记仍算已用；无可翻看的牌时不提供入口。牌面和选项只在使用者的视图里出现，旁观日志只记录登记。可重连继续，且登记独立于巡回包的公开图鉴调查。
- **来源与改编。** 乔伊参考华佗「急救」的救援时机，改为消耗公开持有物。小刚借「仁德」的支援收益，改为交替后的后备照料。大木博士参考诸葛亮「观星」和宝可梦图鉴登记，改为公开后备与私下排序。 [华佗](https://www.sanguosha.com/hero/22) · [刘备](https://www.sanguosha.com/hero/1) · [诸葛亮](https://www.sanguosha.com/hero/4) · [乔伊与宝可梦中心](https://www.pokemon.com/us/animation/seasons/19/episode-3-a-giga-battle-with-mega-results) · [关都设定](https://pokemonletsgo.pokemon.com/en-au/kanto-region/)
- **浏览器验证。** 四席 3D 房间从大厅启用，查看所选规则书，在正常确认搭档界面选择大木博士。实地完成顶牌排序、交替后照料以及弃持有物救援。核对旁观者只能看到登记后的后备，乔伊回复 1 点后原伤害结算继续。 [选择职业](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/professions-draft.png) · [图鉴登记](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/professions-oak.png) · [乔伊救援](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/professions-joy.png) · [浏览器日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/professions-ui.log)
- **正常房间结算。** 四席原版第 19 回合道馆阵营获胜。四席组队第 34 回合 B 队获胜，三项职业各触发一次。八席常磐混用牌包与现有场景选项，第 14 回合挑战者获胜，登记两次、照料两次、救援一次。均从正常入口开局并在结算后返回大厅。 [原版](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/professions-classic.log) · [组队](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/professions-teams.log) · [八席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/professions-eight.log)
- **自动验证。** 1,377 项测试通过。新增专项覆盖设置和重复选择、旁观隐私、成功交替及换位债务、登记顺序和重连、救援限制和不服输续接。 [测试日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/professions-full.log)
- **待定。** 真人试玩观察乔伊消耗持有物的收益、小刚的连续照料和大木博士公开后备的代价。

## 公开职业 · 乔装火箭队员、捕虫少年、驯鸟师、气象研究员与帅哥

大厅「公开职业」已提供八项职业，可与支持的身份、组队及场景同用。每位训练家在确认搭档时选一项或跳过。可重复选择。职业随搭档确认公开，阵营继续按原流程分配。相邻按仍在场的训练家计算，不受距离强化或加速道具影响。

- **乔装火箭队员 · 暗号交换。** 出牌阶段先选有手牌的相邻训练家，再选一张自己手牌。前两步可放弃且不计次数。提议发出即用掉本局一次机会，只公开天气。对方即使没有同天气牌也可拒绝，超时则自动拒绝。若同意，两张实体手牌同时交换。各自只看自己的牌，不公开两张牌的名称。机制借刘备「仁德」的手牌流动，改为天气匹配和双方同意。题材参考武藏与小次郎的乔装。 [仁德](https://www.sanguosha.com/hero/1) · [火箭队乔装专题](https://www.pokemon.com/uk/pokemon-news/team-rocket-dons-numerous-disguises-on-pokemon-tv)
- **捕虫少年 · 捕虫大会奖品。** 虫系搭档完成登场后，可从弃牌堆获得一张道具。可匹配当前等级任一招式的天气费用。仅有指挥招式时，改为匹配本人持有的一张指挥牌天气。用的是现有弃牌，公开记录拿到的道具。拿取后本局用完，放弃保留本局机会并继续原登场结算。借曹植「落英」的弃牌获取思路与城都捕虫大会的奖品题材。 [落英](https://www.sanguosha.com/hero/151) · [宝可梦官方城都指南](https://www.pokemon.com/uk/features/a-visitors-guide-to-johto)
- **驯鸟师 · 驯鸟补给。** 自己成功普通交替后，出牌阶段每局可为自己摸一张。该次换入的飞行系搭档仍出战时，可改给一名相邻训练家。作为招式后果或紧急撤退的交替不提供机会。借孙权「制衡」的补牌思路，搭配宝可梦集换式卡牌的驯鸟师换位题材。 [制衡](https://www.sanguosha.com/hero/8) · [驯鸟师](https://www.pokemon.com/uk/pokemon-tcg/pokemon-cards/series/swsh3/159/)
- **丰缘气象研究员 · 预报修订。** 每轮本人第一次有牌判定时，若有手牌且至少两张牌可翻判，只有研究员能私下看到顶牌天气。弃一张手牌可将原顶牌移至牌堆底，随后翻下一张。放弃或超时按原顶牌翻判。关闭自动翻判时，点击翻判后先处理预报修订。公共判定翻开后，日照、预知未来仍按原顺序处理。首个正常翻判机会无手牌或第二张牌时，下一次判定要等下一轮才重新可用。借司马懿「鬼才」的判定介入，加入丰缘天气研究题材。 [鬼才](https://www.sanguosha.com/news/20161025_9476_5517) · [宝可梦动画天气研究所场景](https://www.pokemon.com/us/animation/seasons/7/episode-43-unfair-weather-friends)
- **国际警察「帅哥」 · 现场问询。** 每局一次，出牌阶段指定相邻训练家。由该训练家公开自己选的一张手牌天气，或回答有无携带持有物的存活后备。后备名称及具体持有物均保持原可见范围。已经发出问询就计为已用。无手牌时只能回答后备线索，超时默认该项。参考国战「知己知彼」与国际警察追查火箭队的设定。 [知己知彼](https://guozhan.sanguosha.com/a/kapaiyilan/youxipai/jinnanpai/2013/0128/105.html) · [宝可梦世代第 2 集](https://www.youtube.com/watch?v=yeX5GzN03AU)
- **实际房间结算。** 四席原版含 3 个 AI，第 17 回合道馆阵营获胜。随机分队八席混用含 7 个 AI 和丰缘天气研究所，第 53 回合 A 队获胜，实际触发暗号提议、修订和问询。八席常磐混用含 7 个 AI、天气研究所、道馆护卫、武藏与小次郎和潜伏者，第 44 回合道馆阵营获胜。两桌八席八项职业均有人选择，三桌均通过正常房间入口开局并结算返回大厅。 [四席原版](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/professions-second-classic.log) · [随机八席](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/professions-second-eight.log) · [常磐八席](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/professions-second-viridian.log)
- **浏览器验证。** 六席组队 3D 牌桌经大厅启用职业，在规则书中看到八项职业，在选搭档时确认乔装火箭队员。用固定的候选搭档与测试用牌，通过正常操作完成交换、分享补给、捕虫奖品、预报修订和问询。核对六个 3D 模型加载、对方和旁观者的可见信息，浏览器无脚本错误。 [暗号交换](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/professions-second-trade.png) · [预报修订](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/professions-second-forecast.png) · [浏览器记录](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/professions-second-ui.log)
- **自动验证。** 1,382 项自动测试通过。新增五项专项覆盖同天气交换和拒绝、调查线索保密、相邻位置、虫系费用匹配、手动翻判与日照先后、重连，以及每轮重置。 [全量测试](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/professions-second-full.log)
- **待定。** 真人试玩观察捕虫少年不同队伍的触发率、乔装交易的接受率，以及每轮一次的研究员是否在天气研究所组合中偏强。

## 愤怒之湖 · 红色暴鲤龙

从大厅「组队场景」选择。合作席为 2–6 个，真人或 AI 均可。开局自动加入一个独立的首领 AI，玩家回到大厅时移除首领席。其余组队模式保留原人数规则。

- **火箭队电波。** 挑战者在出牌阶段确认弃置两张不同印刷天气手牌，永久关闭电波。装置开启时，首领在自己回合的首个伤害招式增加 1 点基础伤害。两个阶段都可参战或选择不关电波，不需要额外先手流程。
- **首领阶段。** 2 级首领使用攀瀑，体力上限为 4 加挑战者人数的两倍。第一段耗尽，进入 3 级狂暴，刷新体力与状态，改用破坏光线，体力上限再加 2，从下一次行动起基础摸牌加一张。原伤害结算保留对已击倒阶段的引用，后续效果不会追到新阶段。挑战者伤害招式与首领招式可无视距离指定对方。首领没有后备也不参与作为目标的濒死救援。第二段耗尽则挑战者全队胜利，全体挑战者退场则首领获胜。
- **3D 与改编。** 复用现有暴鲤龙模型、骨骼与动作，单独生成红色两张身体贴图。湖水、岩岸、信号塔由简单几何体组成，装置灯色与启停、狂暴状态联动。棋盘机制借《三国杀》虎牢关的多人协力首领结构，剧情题材借城都愤怒之湖和火箭队电波。本作的费用、攻击范围和体力阶段为桌游规则。 [虎牢关](https://www.sanguosha.com/news/20190515_5818_5310) · [宝可梦官方城都回顾](https://www.pokemon.com/us/news/celebrate-25-years-of-pokemon-with-memorable-moments-from-the-johto-region)
- **实际房间。** 两席挑战者加首领，第 44 回合挑战者胜利。六席挑战者加首领启用混用牌包和公开职业，第 24 回合挑战者胜利。两桌均已关闭装置并打完两个阶段，结算后回到大厅。 [两席](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/final-scenarios-lake2.log) · [六席混用](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/final-scenarios-lake6.log)
- **待定。** 真人试玩观察不同人数下的两段体力、关闭电波成本及首领第二阶段的压制力。当前 AI 采用现有的战术和反应框架。

## 西尔佛公司 · 大师球争夺

从大厅「组队场景」选择。支持 6 或 12 席，包括 AI。考虑此前的偶数要求，保留同时能平分为三队的两种人数。可按座位 A、B、C 循环分队，也可随机平均分队，阵营公开。

- **争夺与守点。** 出牌阶段弃两张不同印刷天气手牌占领。确认第二张前可取消，手牌未扣。占领方自己不能刷新，换队占领则从新发起席重新计算。任一队守到回合顺序下一次回到或经过发起席即胜。发起者单独退场不影响计时。占领方全队退场则大师球恢复无主。淘汰其余队伍同样获胜，整队共享胜利。
- **3D 与改编。** 使用实验大厅、中央大师球展示台和三队辨色灯。当前占领方同时以文字显示。保留现有座次和镜头，十二席的 3D 座圈加宽。参考《三国杀》国战的多势力淘汰结构，西尔佛公司和大师球为关都题材，弃两张牌的费用和守一圈为本作改编。 [国战胜负](https://guozhan.sanguosha.com/game_rule/settlement.html) · [关都与火箭队](https://pokemonletsgo.pokemon.com/en-us/kanto-region/) · [大师球](https://diamondpearl.pokemon.com/en-us/trainersguide/fundamentals/battling/)
- **实际房间。** 六席按座位分队，第 26 回合 C 队守球获胜。十二席随机分队启用混用牌包和职业，第 31 回合 A 队守球获胜。两局均正常返回大厅。同期四席原版第 47 回合由道馆方获胜，也正常返回大厅。 [六席](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/final-scenarios-silph6.log) · [十二席](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/final-scenarios-silph12.log) · [四席原版](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/final-scenarios-classic.log)
- **待定。** 真人试玩观察十二席中占领过于频繁或保有时间过长的情况，以及 UI 在不同设备的帧率。

- **原版及专项回归。** 1,386 项自动测试通过。专项覆盖两阶段连续伤害结算、装置增伤和取消付费、挑战失败结算、跨距离攻击、随机与按位分队、占领继承与重连、发起座被跳过以及胜利后返回大厅。 [全量日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/final-scenarios-full.log)
- **浏览器。** 两个场景均经普通大厅开启，游戏内规则书显示对应条目。愤怒之湖加载 3 个 3D 宝可梦模型并实测关闭电波、换阶段和击败首领。西尔佛加载 12 个 3D 模型，实测占领、回合剩余、俯视切换、430 像素窄屏与守满胜利。测试使用固定搭档和测试手牌，全部付费与结算通过实际房间接口。 [愤怒之湖](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/final-scenarios-lake.png) · [暴鲤龙阶段二](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/final-scenarios-lake-phase2.png) · [西尔佛公司](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/final-scenarios-silph.png) · [十二席俯视](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/final-scenarios-silph-overhead.png) · [浏览器日志](C:/Users/pc/Documents/ChatGPT/Game/outputs/expansion-dev/final-scenarios-ui.log)

## 合并前验收 · 2026-11-25

- 在含草系道馆森林庭院的主分支基线上验收。完整 Node 测试 1,386 项通过。
- 浏览器用正常房间入口完成 17 局并返回大厅。覆盖四种内容配置、身份与练习、随机及按位分队、30 席混合牌包、满金市广播塔、常磐道馆及其变体、愤怒之湖和西尔佛公司的两种席位设置。大房间通过紧凑座位视图完成整局。
- 浏览器重新装载 137 个宝可梦模型及 22 个训练家模型，抽检动作并核对蒙皮及动画关键帧。原版与巡回实战分别确认十万伏特、水枪及对应受击动作和伤害结算。
- 补绑的战斗动作、修正过的翅膀和手臂权重、烟雾、火焰、眼睛及脸部修复记录在 [模型来源](app/public/pokemon-models/SOURCE.md)。本轮复验使用 AI 与脚本操作测试席，真人多人平衡继续按玩法条目记录。
