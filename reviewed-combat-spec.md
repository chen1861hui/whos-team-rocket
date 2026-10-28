## Keen Eye clarification — 2026-10-29

The historical “one defense per settlement” shorthand is superseded for Keen Eye. Ordinary Dodge cancels a single settlement and closes the window. Keen Eye changes other trainers’ Dodge to damage−1 through the whole move; the surviving window permits further real Dodges before resolution. This repeat-window policy, receiving timing and original-target binding are explicit interpretations, not extra printed face text. Same-owner receiving modifier order follows booklet08. See reviewed-bird-magnet.md.

# Reviewed combat source specification / 已核对战斗来源规范

## Current implementation/source correction — 2026-10-27

The command/dodge missing-face gate below is superseded: the supplied original poster shows their complete art/name/weather-only faces, with no body paragraphs. Their booklet-defined effects are now implemented in the labelled combat preview. See `reviewed-playcard-spec.md` and `gameplay-milestone-4.md`. Nine starter faces have `effectStatus:'combat-preview'`, `engineScope:'combat-preview-only'`; production `engineEligible:false` remains until complete content/deck support. Current engine resolves damage, source traits, defense/pass, rescue passes, deployment and role victory. Potion's rescue clause, other cards/quantities and response-owner evidence remain narrow gaps; unidentified printing is provenance rather than a request to reconfirm the supplied rules basis. Older unavailable/missing-face paragraphs below are the initial review record, not current blockers.

## Integration review note — root

Root independently viewed all six listed card photographs plus booklet images 03/05/06/07/08. The nine HP/trait/move readings and icon distinctions were checked against those originals. Public reference catalogue copies now include these nine faces with per-face hashes, separate English translation status, unavailable effects and `engineEligible:false`; no combat mechanic was enabled. This supersedes the initial authoring note below that no existing catalogue/public file had changed. Original preview poster provenance is retained separately from the per-face photograph provenance.

Review date: 2026-10-27. Scope: the next command-move / 快躲开！ slice, its dependencies, and nine photographed Pokémon faces. This document is a review artifact, **not permission to enable playable combat content**. No existing catalogue, engine or public file was changed.

The photographed Chinese booklet is the current source basis. Its exact printing is unidentified, and compatibility with the separate Douyin card photographs is not proven. English wording below is a working translation, not printed English card text. Chinese quotations preserve words and numbers; line breaks are normalized. Square-bracket icon labels are editorial substitutions for pictured symbols, never invented printed words or costs.

## Provenance and independently viewed images

Rulebook: https://www.rednote.com/discovery/item/6a97c38c0000000026015ccf — 马小虾玩桌游. Files under `research-assets/xiaohongshu-rulebook/`. The gallery/page mapping is from its existing manifest. SHA-256 was computed directly from each local file during this review.

| Evidence ID | File | Printed pages | SHA-256 |
|---|---|---|---|
| R03 | 03-components.webp | 01 | da8366b58b213b0074a9c27baf334ea6c8cf36d859ebc577939908233f67c6e2 |
| R05 | 05-turn-flow.webp | 04–05 | dc3ad4db40d69923d82b0158fb68a1c1c7a08c7a6853c1b6d0bfe084f092fe5b |
| R06 | 06-rescue-basics.webp | 06–07 | 46d2c939704f84ad87bce58f9ba19d6bb4ba3df77e94b6ae162bdb3fff38e2f1 |
| R07 | 07-targets-cards.webp | 08–09 | 0c3df4526577355eeb0cf30751fa253f59cd59355bc794ba618084362ddd3847 |
| R08 | 08-timing-damage-status.webp | 10–11 | 242ae7f516b5a4310445b1c4bf1b1c6b6323630ab8337a641a7e7608aa6a61f2 |

Card gallery: https://www.douyin.com/note/7684572630280187855 — 猪皮拌年糕. Files under `research-assets/douyin-7684572630280187855/`. The first six **observedAssetOrdinal** entries were viewed directly. These ordinals are not carousel positions. `imageIndex` remains unknown in this review; no independent carousel-index claim is made. Individual source attribution remains probable, as recorded in the existing manifest. Local hashes establish file identity, not edition authenticity.

| Evidence ID / observed ordinal | File | Visible faces / location | SHA-256 |
|---|---|---|---|
| D01 / 1 | 3e8e9215541293f2.webp | 妙蛙种子 Lv.1, whole face | 7441ea6eb5182b63310c66ce7d3bb5f4a61e0093ac5ed39042e7174a4b045d5a |
| D02 / 2 | f93f4ddbd5eaa174.webp | 妙蛙草 Lv.2 left; 妙蛙花 Lv.3 right | ca543caac727172c9010db263cb6a8059d6e9f4e8001f4263573964d21c814bf |
| D03 / 3 | 1fe3571035e312b6.webp | 小火龙 Lv.1, whole face | dea42fd7edfdc907244db16105a4419dc48d0ae0d2c95bf97549d4fa6c9e09b8 |
| D04 / 4 | 7eaec309be7319cf.webp | 卡咪龟 Lv.2 left; 水箭龟 Lv.3 right | 91a0747d348970a1859f5aaf59e0ad30f3211d13dab99bfbf40e18a60162cfb6 |
| D05 / 5 | cc3ea6ca8c274bfa.webp | 火恐龙 Lv.2 left; 喷火龙 Lv.3 right | b8080a34b58e9978a098a4b0e2704fa39cb6571ee44dba12f564fe0485bd49bf |
| D06 / 6 | 39437d37719487f3.webp | 杰尼龟 Lv.1, whole face | cb4d9f58c66d2575f54b445e0135edab1f1cf006c2e1f98b260263e51bb58813 |

## Printed rule text and English interpretation

### Command marker, cost, limits and targets

**R07 p.08 招式, Chinese transcription:**

> 宝可梦的招式根据使用条件的不同分为两种：带有[COMMAND]符号的招式和其他招式。
>
> 带有[COMMAND]符号的招式的使用条件是使用一张【接招吧！】。在通过使用【接招吧！】使用带有[COMMAND]符号的招式后，根据该招式对目标的要求选定此【接招吧！】的目标。
>
> 其他招式的使用条件是弃置一张符合要求的手牌，这个要求通常是一种或两种天气。
>
> 所有招式都需要指定目标，如果一个招式的描述中没有特别写明可指定的目标，则默认需要指定一只在使用此招式的宝可梦距离限制范围内的宝可梦为目标。
>
> 在没有特别说明的情况下，每个招式在每个出牌阶段内只能使用一次。

**English:** The red rectangle containing a yellow burst is a command marker. It requires **using one 接招吧！ card**, with that move's targeting requirements determining the command card's targets. It is not a weather icon. Other moves require **discarding one hand card** meeting the requirement, usually one or two allowed weather types; two weather symbols do not establish a two-card cost. Default targeting is one Pokémon within the user's distance limit. Each move is usable once per Play phase unless overridden.

**R05 p.05, Chinese transcription:**

> 使用牌没有数量限制，但若无特殊说明，你在每个出牌阶段内只有一只宝可梦能使用【接招吧！】。
>
> 若无特殊说明，每个出牌阶段内，你的宝可梦的每个招式只能施放一次。

**English / engine consequence:** Normal card use is unlimited. The command restriction identifies **one Pokémon per trainer per Play phase**; it does not say that the trainer can use only one command card. Track the Pokémon identity that has used 接招吧！ and each Pokémon/move use independently. Switching does not create a fresh allowance. A Pokémon with two different eligible command moves must not be rejected merely by an invented one-attack-per-trainer counter. These nine reviewed faces each show one command move, but other faces may differ.

**R06 p.07 距离限制, Chinese transcription:**

> 在距离限制下，你将只能选择你或与你相邻的训练家，以及这些训练家的出战宝可梦作为目标（见右图图示）。

**English / engine consequence:** Under the default distance limit, eligible trainers are yourself and adjacent trainers, and eligible Pokémon are their active Pokémon. The p.07 diagram excludes more distant seats. R07 p.08 says trainers who leave and their Pokémon no longer occupy a position. Recompute adjacency among remaining seats. Do not invent a separate Pokémon-card range numeral or assume every attack excludes self. A full command-card face could add targeting restrictions; that remains a gate. The photos support adjacency, not an independently specified generic numerical shortest-distance formula.

### Response unit and successful-use settlement

**R07 p.08, Chinese transcription:**

> 招式成功使用会进入结算流程。一个招式对一个目标产生效果即为一次结算。例如，一部分招式因为有多个目标，所以会分别结算一次；还有一部分技能可能需要对同一个目标结算多次，每一次结算都会产生相同的效果。
>
> 【快躲开！】可以用来抵消任意招式，但每张【快躲开！】只能抵消一次结算（如招式“二连踢”会结算两次，需要依次使用两张【快躲开！】）。

**English:** A successful move enters settlement. One move affecting one target constitutes one settlement; multiple targets settle separately, and some moves settle against the same target multiple times. 快躲开！ can cancel any move, but each card cancels **one settlement**. Double Kick's two settlements require two successive responses. Do not model a single defense as automatically canceling all targets/hits.

**Implementation interpretation, not a quotation:** Represent the move use separately from its ordered settlements. Open a response decision for the applicable settlement, accept a response or pass, and then settle that unit. The exact full-face response eligibility/timing text is still missing. Do not make holding 快躲开！ publicly observable by creating windows only when the target has one. Successful-use costs/limits, effect ordering, retry safety and disconnected-player pausing need to survive pending decisions.

### Weather, card use and judgment

**R07 p.09 verified labels:** 雷雨 (thunderstorm), 暴雨 (heavy rain), 晴朗 (partly sunny / clear), 烈日 (intense sun). 雷雨 + 暴雨 are **雨天**; 晴朗 + 烈日 are **晴天**. The weather is in a game card's upper-left corner. These labels are different from the command marker and the red square with white flames used for 灼伤.

**R07 p.09:** The four game-card types are 指令牌, 道具牌, 事件牌, 持有物牌. Commands include 接招吧！ and 快躲开！. One-shot tool cards usually combine two tools, and only one is chosen when using the card. A Pokémon can carry only one held item; a new item replaces/discards the old. Held items may be used on one's own active or reserve.

**R07 p.09 / R08 p.10, wording excerpts:**

> 使用：使用一张牌即执行该牌的效果，使用持有物牌的效果即宝可梦携带此持有物（不会进入弃牌堆）。
>
> 打出：为响应某张牌或触发某些特性而消耗牌。被打出的牌不会执行该牌的效果，且会在结算完成后被置入弃牌堆。
>
> 判定：亮出牌堆顶的一张牌，并根据其牌面信息执行对应的效果。

**English:** Using executes the card's effect; playing a card in response consumes it without independently executing its normal effect, and discards it after resolution. A judgment reveals the top draw-pile card and uses its face information. This requires real weather-tagged draw-pile cards, a defined reveal/discard lifecycle and deck refill handling. A random invented weather roll is not equivalent.

### Damage, rescue and defeat dependencies

**R08 pp.10–11 verified wording/order:** 失去体力 does not trigger or receive effects related to 造成伤害 / 受到伤害. A damage event includes 伤害来源、受伤宝可梦、伤害渠道和伤害值. The source is the Pokémon that deals the damage, which can belong to a different trainer than the card user. For a Pokémon move, the channel is the card used to perform it (接招吧！ in the printed example).

Printed flow: **造成伤害时 → 受到伤害时 → 扣减体力 → 造成伤害后 → 受到伤害后**. Modify damage before HP deduction. If the damage value becomes 0 or less, terminate the damage settlement and treat it as no damage. After HP deduction, resolve fainting/rescue if applicable **before continuing the after-damage stages**. Whether a Pokémon has suffered damage is distinct from whether its current HP is below its maximum.

**R06 p.06 昏厥结算, Chinese transcription:**

> 当一只宝可梦的体力值被扣减至0点及以下时，该宝可梦进入昏厥状态。
>
> 当一只宝可梦进入昏厥状态时，立即开始其昏厥结算：
>
> 从当前执行回合的训练家开始，按逆时针顺序依次询问每名训练家是否使用【伤药】，选择使用的训练家可以使用任意张【伤药】，然后继续询问下一位训练家。

The printed termination bullets say settlement ends when HP returns to at least 1, allowing continued battle; or all trainers still in play have been asked and HP remains below 1, causing loss of battle ability. **English / engine:** begin at the current turn's trainer, not automatically the attacker or injured trainer. The current responder can use any number of potions. Stop as soon as the rescue threshold is met; do not continue asking everyone after recovery. Preserve HP below zero: the printed threshold is at least 1, so clamping HP to zero before rescue changes how many heals are required. Exact 伤药 amount/target/combined-tool face text remains missing here.

**R06 p.06 loss-of-battle-ability sequence:** discard held item, reinforcement and special-status markers in that Pokémon zone; if another Pokémon's damage caused the defeat, that damage source's trainer draws one card; if a living reserve exists, immediately deploy it and move the defeated Pokémon to reserve, without counting as ordinary switching; if both Pokémon are defeated, the trainer leaves, discards their whole hand and reveals identity. A trainer with only one undefeated Pokémon cannot perform ordinary switching. The damage-source reward is not automatically awarded to the user of every damage card.

**R06 p.06 immediate end conditions:** if the Gym Leader leaves and the only other remaining trainer is Rocket Grunt, Rocket wins; otherwise Challengers win when the Leader leaves. If all Challengers and Rocket Grunt leave, Leader and Gym Trainers win. A damage-capable engine needs authoritative identities, elimination, forced deployment and immediate result handling before a complete playable game can be claimed. Exact nested resolution interruption after a victory is not separately specified by these excerpts.

**R08 p.10 simultaneous timing:** different trainers settle counterclockwise starting at the current turn's trainer unless stated otherwise; one trainer orders their own simultaneous effects.

### Reinforcement and status needed by combat

**R08 p.11:** no two identical reinforcement markers on one Pokémon unless overridden. Reinforcement is discarded when active becomes reserve. Speed reinforcement removes distance limits for the trainer's card use and that Pokémon's moves. Defense reinforcement sets received damage above 1 to 1, and is discarded after a card finishes if the Pokémon suffered damage from that card. Power reinforcement is discarded when the Pokémon uses a move through 接招吧！, then adds 1 damage when that Pokémon deals damage until that card's use ends.

Only active-zone special statuses take effect; reserve statuses remain inactive. A Pokémon already in one special status cannot acquire another unless overridden. Relevant visible p.11 entries: 灼伤 prevents increases to damage dealt by that Pokémon's moves and changes damage above 1 to 1; 畏缩 discards at that trainer's turn start and reduces that turn's draw count by 1; 睡眠 discards at turn start, then prevents moves and switching in that turn's Play phase. Full other-status rules are outside this bounded review. Do not confuse 畏缩 (flinch), 昏厥 (fainting), and 失去战斗能力 (defeated).

## Nine card-face transcriptions / 九张牌面

Numbers in the HP column are the printed heart value (maximum HP). The role labels 防御型 / 攻击型 / 平衡型 are card classifications, not elemental Pokémon types. All nine moves show the same [COMMAND] icon. Their burst numerals are recorded separately from extra printed effects; no weather payment appears beside these move headings.

| Source / face | Chinese name | Working English name | Level | HP | Printed class | Trait | Command move | Printed burst numeral |
|---|---|---|---:|---:|---|---|---|---:|
| D01 whole | 妙蛙种子 | Bulbasaur | 1 | 3 | 防御型 | 叶绿素 | 寄生种子 | 1 |
| D02 left | 妙蛙草 | Ivysaur | 2 | 4 | 防御型 | 叶绿素 | 超级吸取 | 2 |
| D02 right | 妙蛙花 | Venusaur | 3 | 5 | 防御型 | 叶绿素 | 终极吸取 | 2 |
| D03 whole | 小火龙 | Charmander | 1 | 3 | 攻击型 | 猛火 | 火花 | 1 |
| D05 left | 火恐龙 | Charmeleon | 2 | 4 | 攻击型 | 猛火 | 喷射火焰 | 2 |
| D05 right | 喷火龙 | Charizard | 3 | 4 | 攻击型 | 猛火 | 大字爆炎 | 3 |
| D06 whole | 杰尼龟 | Squirtle | 1 | 3 | 平衡型 | 雨盘 | 水枪 | 2 |
| D04 left | 卡咪龟 | Wartortle | 2 | 4 | 平衡型 | 雨盘 | 水流尾 | 2 |
| D04 right | 水箭龟 | Blastoise | 3 | 4 | 平衡型 | 雨盘 | 冲浪 | 2 |

### 妙蛙种子 / 妙蛙草 / 妙蛙花 — D01, D02

**Shared trait 叶绿素, Chinese transcription:**

> 在你的出牌阶段限一次，你可以进行一次判定。本回合若你因此特性而判定的结果为“晴天”（[烈日]/[晴朗]），你使用牌不受距离限制，此宝可梦使用招式也不受距离限制。

**English:** Once during your Play phase, you may make a judgment. If this trait's judgment this turn yields sunny weather (intense sun or clear), your card use and this Pokémon's moves ignore distance limits. Working trait name: Chlorophyll. The text refers to this turn; do not convert this to an unconditional permanent range bonus.

**寄生种子 / 超级吸取, Chinese transcription (same extra effect on D01 and D02 left):**

> 当此宝可梦因此招式而造成伤害后，回复此宝可梦1点体力。

**English:** After this Pokémon deals damage with this move, restore 1 HP to it. Working move names: Leech Seed / Mega Drain. This requires actual damage and the after-dealing-damage stage, not simply declaring the attack or bypassing a defense.

**终极吸取, D02 right, Chinese transcription:**

> 当此宝可梦因此招式而造成伤害后，回复此宝可梦1点体力，且你摸一张牌。

**English:** After this Pokémon deals damage with this move, restore 1 HP to it and draw one card. Working move name: Giga Drain.

**Eligibility:** readable transcription; unavailable for production combat until command/defense faces, judgments/weather deck, damage/rescue and healing exist. Venusaur also requires triggered draw handling. Switching must not let the same Pokémon repeat a used move or its once-per-Play trait. Whether evolution grants a fresh once-use trait allowance needs an explicit engine policy/source review rather than an identity reset assumption.

### 小火龙 / 火恐龙 / 喷火龙 — D03, D05

**Shared trait 猛火, Chinese transcription:**

> 当此宝可梦造成伤害时，若此宝可梦体力值小于或等于体力上限的一半，此伤害值+2。

**English:** When this Pokémon deals damage, if its HP is at most half its maximum HP, increase this damage by 2. Working trait name: Blaze. Use a mathematical half comparison, not invented rounding. Changes in maximum HP from evolution/leader bonus can affect the threshold.

**Shared extra move effect, Chinese transcription:**

> 当此宝可梦因此招式而造成伤害后，你进行一次判定，若结果为[烈日]，目标宝可梦陷入“灼伤”状态。

**English:** After this Pokémon deals damage with this move, make a judgment; if it is intense sun, the target Pokémon becomes burned. The card shows **one intense-sun icon**, not the two-icon 晴天 group. Working move names: Ember / Flamethrower / Fire Blast. Each of these three move rows also prints a red square with white flames beside its burst numeral. **Uncertainty:** the semantic role of that symbol in this position is not established by these excerpts. Record its appearance and position; do not turn it into an additional payment, automatic burn, or an invented damage-element subsystem. The paragraph explicitly makes burn conditional on the post-damage judgment.

**Eligibility:** readable transcription; additionally requires Blaze timing, judgment, the distinction between a single weather and a weather group, status eligibility and burn damage limits. Not a valid fixture for a generic ability-free 1/2/3 damage attack.

### 杰尼龟 / 卡咪龟 / 水箭龟 — D06, D04

**Shared trait 雨盘, Chinese transcription:**

> 在你的结束阶段，你可以进行一次判定，若结果为“雨天”（[暴雨]/[雷雨]），此宝可梦恢复特殊状态并回复1点体力。

**English:** During your End phase, you may make a judgment. If it yields rainy weather (heavy rain or thunderstorm), this Pokémon recovers from its special status and restores 1 HP. Working trait name: Rain Dish. The printed wording is 恢复特殊状态; the intended recovery translation is recorded separately, not silently rewritten as a Chinese quotation.

**水枪, D06:** No extra effect paragraph is printed beneath the move heading. Working English name: Water Gun. This absence does not remove the printed 雨盘 trait.

**水流尾, D04 left, Chinese transcription:**

> 当此招式被使用时，你令目标宝可梦已携带的持有物失效，直到此招式结算结束。

**English:** When this move is used, disable the target Pokémon's currently carried held item until this move's settlement ends. Working move name: Aqua Tail. This is a use-time effect, not an after-damage trigger.

**冲浪, D04 right, Chinese transcription:**

> 此招式可以指定至多两只在此宝可梦的距离限制范围内的宝可梦为目标。当此招式被使用时，你令所有目标宝可梦已携带的持有物失效，直到此招式结算结束。

**English:** This move may target up to two Pokémon within this Pokémon's distance limit. When used, disable every target's currently carried held item until this move's settlement ends. Working move name: Surf. Each target has its own settlement/defense according to p.08. The exact multi-target order and item reactivation boundary across multiple settlements should be reviewed before implementation; do not invent cancellation of all targets from one 快躲开！.

**Eligibility:** readable transcription; even Squirtle requires optional end-phase judgment/healing/status recovery. Wartortle and Blastoise additionally require temporary held-item suppression and reliable cleanup if defended, fainted, disconnected, or the game ends. Blastoise requires multiple targets and separate response settlements.

## Deck quantities and missing play-card evidence

**R03 p.01 Chinese component text:**

> 宝可梦牌：80张
>
> 40组宝可梦，每一组宝可梦有两张，分别是一张最终形态（单面）和一张非最终形态（双面）。
>
> 游戏牌：108张

**English / evidence boundary:** This booklet describes 40 Pokémon groups, represented by 80 physical Pokémon cards. Its two nonfinal level faces plus final face imply 120 level faces across 40 groups; that face total is arithmetic interpretation, not a claim that all those faces have been acquired. The 108 game-card total is established for this booklet, but **per-card names, quantities and weather distributions are not**. Douyin's 80 carousel items are a separate count and cannot establish physical deck quantities.

Missing or not promoted by this bounded review:

1. A full readable **接招吧！** face: exact printed use timing, legal users/targets, any restrictions, weather corner, and all face variants. The booklet's small illustration establishes existence and category; it is not a reliable full-face transcription here.
2. A full readable **快躲开！** face: exact response wording/timing/user eligibility, weather corner, and variants. Booklet p.08 establishes cancellation of any move's single settlement, not every full-face condition.
3. A full readable **伤药** face, including the other half of any combined tool card: heal amount, target restrictions, ordinary-use and rescue wording, weather corner, and variants. Do not infer +1 from familiar games or from the rescue threshold.
4. Exact physical quantities and weather distribution for all required game-card faces. A photographed single copy proves neither the card's deck count nor a uniform random distribution. An arbitrary reduced command/defense/potion deck would be an explicitly designed variant, not the source deck.
5. A reconciled booklet/card printing basis, all relevant override cards/traits for the chosen slice, and remaining roster faces. This review reads nine faces from three groups only. Existing preview rows/HP values are not promoted by association.

## Engine eligibility gates and review scenarios

**Ready as source requirements:** command marker mapping; one-card other-move payment wording; per-Pokémon per-move phase limits; one command-using Pokémon identity per trainer/phase; default active/self/neighbor target envelope subject to card restrictions; one defense per settlement; damage timing; current-turn-first counterclockwise rescue; defeat cleanup/reward/forced deployment; the nine face transcriptions and observed icon distinctions.

**Not yet eligible for public playable combat:** these nine faces and command/defense/potion card implementations. This is a documentation review, not independent second-review signoff, complete deck validation, or an implementation test result. Missing play-card faces/quantities and unresolved complete dependency support remain explicit gates.

Meaningful future source-derived scenarios:

- A uses a command move, switches to B, and B's command move remains disallowed; switching back cannot reset A's used move. A hypothetical verified second distinct command move on A must not be rejected by an invented trainer-wide single-card counter.
- One allowed weather card pays an other-move cost whose text accepts either of two weather types; do not demand two cards.
- A defense consumes one settlement, preserving the other target/hit settlement. Passing does not expose hidden response holdings.
- No actual damage after reduction/cancellation means no Leech Seed/Giga Drain healing or Fire Blast burn judgment. After lethal damage, rescue/defeat occurs before after-damage effects.
- HP below zero requires enough verified potion healing to reach 1. Rescue starts at the current turn's trainer and stops immediately upon recovery.
- A forced reserve deployment is not ordinary switching; source Pokémon's trainer receives any defeat reward; a trainer with both Pokémon defeated leaves and reveals identity.
- Intense sun triggers the fire line's burn effect; clear weather alone does not. Both qualify for Chlorophyll's sunny-weather check; both rain weather types qualify for Rain Dish.
- End-phase Rain Dish is optional; healing respects maximum HP. Evolution preserves injury amount/status and does not turn a preview HP value into verified content.
- Temporary held-item suppression ends at its reviewed boundary even when response, rescue, defeat or game termination interrupts resolution.

No network assets were acquired or modified in this review. The acquisition worker owns the source manifests; this document intentionally does not change their index/coverage claims.

