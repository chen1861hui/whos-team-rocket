# Reviewed supplied play-card faces and remaining statuses — 2026-10-27

## Independent integration review

Root independently inspected original command/dodge and split-tools regions and booklet photos04/06/07/08/09. Confirmed the art-only command/dodge faces and the physically covered Potion text. Command/dodge effects and the reviewed starter traits now run in the explicit development combat preview. That preview contains no Potion; full rescue healing is not fabricated. Target-owner Dodge response is recorded as an interpretation. See `gameplay-milestone-4.md` for executable scope/tests and `combat-result-preview.jpg` for a real browser result.

This review uses the seven **already supplied originals**, copied byte-for-byte into `research-assets/provided-previews/`. The photographed Chinese booklet remains the accepted rules basis. This document corrects the old assertion that full command/dodge faces were absent: those faces are present, and **they have no effect body text to transcribe**. Their mechanics come from the booklet. Preview status is provenance, not an additional requirement to obtain a different retail edition before implementing the accepted booklet rules.

Scope: one visual review, including enlarged crops made only for reading. Independent second review is recorded by the parent milestone, not claimed here. Quantities are unknown unless printed; a pictured instance is not a deck count. No quantities are printed on these pictured game-card faces.

## Original-source inventory

All paths below are relative to `research-assets/provided-previews/`; source was the same basename under `C:/Users/pc/Downloads/`. Only these seven explicit originals were accessed/copied; no Downloads inventory was used.

| ID | File | Pixels | SHA-256 |
|---|---|---|---|
| P01 | mmexport1793009383237.jpg.jpeg | 790×4027 | 7c67f3ed10e165f82bd4234b12a9ea7c7b52e2989b602071190be4826a36836a |
| P02 | mmexport1793008989807.jpg.jpeg | 790×4046 | c6631cca3dc6a24dc9a9272d3604a2a04bcb2856bd78a675871bcb3dedf11b9c |
| P03 | mmexport1793009022050.jpg.jpeg | 790×4046 | b6c4ec18d05a635711f103b48b26220e13679247f8b0b88bf0e911144ee61915 |
| P04 | mmexport1793008971679.jpg.jpeg | 790×4046 | 42182fb5b0cd8cadaeafada2bd4502f6a527b003bd6b93e139b0e687aa2d6b50 |
| P05 | mmexport1793009377934.jpg.jpeg | 790×3953 | ed60ea847178b7da1338cd6ef27cd5b2de7ba6b1cc6b368361ec28d7f61b99c7 |
| P06 | mmexport1793008928244.jpg.jpeg | 790×3669 | 5817cb32f58f4bb42814d3f5895e48810e025a9c85eac771b940d775caa332e6 |
| P07 | mmexport1793008962926.jpg.jpeg | 789×2707 | 9c3255bb9d75a32e61e037135c3e279c7e2bba136a6776794c79a8bc60e3225f |

Rulebook originals in `research-assets/xiaohongshu-rulebook/`:

| ID | File / printed pages | SHA-256 |
|---|---|---|
| R05 | 05-turn-flow.webp / 04–05 | dc3ad4db40d69923d82b0158fb68a1c1c7a08c7a6853c1b6d0bfe084f092fe5b |
| R06 | 06-rescue-basics.webp / 06–07 | 46d2c939704f84ad87bce58f9ba19d6bb4ba3df77e94b6ae162bdb3fff38e2f1 |
| R07 | 07-targets-cards.webp / 08–09 | 0c3df4526577355eeb0cf30751fa253f59cd59355bc794ba618084362ddd3847 |
| R08 | 08-timing-damage-status.webp / 10–11 | 242ae7f516b5a4310445b1c4bf1b1c6b6323630ab8337a641a7e7608aa6a61f2 |
| R09 | 09-reference.webp / 12 | ca4080c37b59cee3781a51efa32df4c9295c05d56d1314b77242b574bb5db877 |

## 接招吧！ / Command: Take This! — P01

**Complete visible face:** title `接招吧！`, Pikachu/hand illustration; upper-left orange full sun = **烈日**; upper-right red square/yellow burst = command marker. There is **no printed rules paragraph, target line, quantity numeral or extra timing text** on this face. Do not invent a missing paragraph or call the upper-right command marker weather. P01 supplies one depicted weather variant only; other variants/physical quantities remain unknown.

**Booklet text, R07 p08:**

> 带有[COMMAND]符号的招式的使用条件是使用一张【接招吧！】。在通过使用【接招吧！】使用带有[COMMAND]符号的招式后，根据该招式对目标的要求来选定此【接招吧！】的目标。

`[COMMAND]` represents the printed red/yellow icon, not literal text. English: Use one Take This! to perform a command-marked move, and choose the command card's target according to that move's target requirements. Default move target is one Pokémon within the moving Pokémon's distance restriction when the move has no special target text (same page). R07 p09 says reserve Pokémon cannot use or be targets of command cards. R05 p05 allows only one Pokémon per trainer to use Take This! in a Play phase unless overridden, and each Pokémon's each move once in that phase unless overridden. **This is not a trainer-wide one-command-card limit.** A card without an effect paragraph is still fully defined by the booklet and selected Pokémon move.

**Engine-ready:** command card selection/payment, active Pokémon/move/target checks, phase identity/move counters, this depicted weather value. Whether full game deployment is possible depends on implementing actual selected move effects and the existing damage/rescue rules, not obtaining imaginary face text.

## 快躲开！ / Dodge! — P01

**Complete visible face:** title `快躲开！`, Pikachu/hand illustration; upper-left orange full sun = **烈日**. **No rules paragraph, quantity numeral, target line or top-right command marker** is printed. Other physical variants/quantities unknown.

**Booklet text, R07 p08:**

> 【快躲开！】可以用来抵消任意招式，但每张【快躲开！】只能抵消一次结算（如招式“二连踢”会结算两次，需要依次使用两张【快躲开！】）。

English: Dodge! can cancel any move, but each card cancels one settlement. Two successive settlements require two successive dodges. A move against multiple targets has separate settlements. R07 p08 explicitly excludes reserve Pokémon from command-card use/targeting. R08 p10 says when a trainer's active Pokémon uses a command card, that Pokémon also counts as using it.

**Engine-ready:** pending move settlement, consume one dodge per settlement, respect explicit move overrides such as cannot be dodged when separately sourced. The face supplies no extra all-target cancellation, generic counterspell, or response-card gifting ability. **Response-owner boundary:** the inspected pages establish active/reserve command eligibility but do not explicitly say whose trainer may submit the dodge for a targeted settlement. Restricting the window to the affected active trainer is a plausible implementation interpretation, not a direct quotation or independently confirmed rule. The existing S04 review also has no precise dodge-owner evidence. Record this interpretation explicitly if used. Presence of a response window must not reveal a hidden dodge holding.

## P02 split tools: 伤药 / 万灵药 and 神奇糖果 / 金珠

Both depicted physical tool cards have upper-left **晴朗** (orange sun with cloud). `道具` is printed on the bottom bar. R07 p09 explicitly says a split tool combines two tools and **only one is chosen when the card is used**. Consuming a physical split card must remove both choices from the hand. No face quantities are printed.

### 万灵药 / Full Heal

Unobscured right half, Chinese transcription:

> 在你的出牌阶段对一只处于特殊状态的出战或备战宝可梦使用。恢复目标宝可梦的特殊状态。

English: During your Play phase, use on one active or reserve Pokémon that has a special status. Cure the target's special status. The printed text here does **not** say `你的` before the target Pokémon: do not add a self-only restriction. Use R07 default target/distance rules where applicable. This half is readable and implementable with status/target systems.

### 伤药 / Potion — partly physically covered

The heading `伤药` and right edge of its body are visible, but the overlapping candy/gold-nugget card **physically covers the left portion**. Magnification does not recover the covered characters. Readable fragments include `…阶段对一只已受…`, `…出战宝可梦使用。`, `回复2点体力；`, `…可梦昏厥结算中`, `…目标宝可梦…`.

**Definite finding:** an ordinary-use clause explicitly restores **2 HP**, not an assumed 1. The visible ordinary clause references an already injured active Pokémon. Do not present a reconstructed full Chinese paragraph as transcription. The exact full target phrase, conjunction/choice wording and the covered rescue clause/its amount are not recovered by this original alone. The fact that Potion exists and is used for rescue is independently definite from R06 p06. The rescue sequence/stop threshold is fully sourced in `reviewed-combat-spec.md` and R06; that sequence does not by itself establish the covered Potion heal amount.

**Engine boundary:** ordinary heal numeral 2 can be represented as a reviewed field; full Potion behavior needs independent confirmation of the covered parts, rather than silently extrapolating from a familiar card game. This is a narrow physical-overlap uncertainty, not absence of all supplied play-card evidence.

### 神奇糖果 / Rare Candy

Readable left face, Chinese transcription:

> 在你的出牌阶段对一只不处于等级3的出战宝可梦使用，目标宝可梦提升一个等级。

English: During your Play phase, use on one active Pokémon not at level 3; increase its level by one. Apply the booklet's normal level-up preservation of damage, reinforcement and status. The face does not explicitly restrict the target to your own Pokémon.

### 金珠 / Nugget

Readable right half says the card is given to another trainer during your Play phase and that target trainer draws **two cards**. Reading of the complete first sentence is not promoted as exact transcription in this bounded pass. Engine data may retain the definite recipient `一名其他训练家`, transfer, and draw-two fields with transcription review still pending. This is not a claim about physical card quantity.

## Other pictured play-card inventory

Names/weather were read for inventory; this table does **not** promote every body paragraph as implemented effects. Chinese weather labels follow the four labels in R07 p09, distinguishing 烈日 (full sun), 晴朗 (sun/cloud), 暴雨 (dark rain cloud), 雷雨 (dark cloud/lightning).

| Poster | Face(s) | Observed weather | Body evidence in this pass |
|---|---|---|---|
| P03 | 超梦的威胁 / Mewtwo's Threat | 晴朗 | Unobscured left face; body not fully transcribed here |
| P03 | 梦幻的祝福 / Mew's Blessing | 晴朗 | Left edge of body covered |
| P04 | 劲敌的挑战 / Rival's Challenge | 暴雨 | Unobscured left face; body not fully transcribed here |
| P04 | 树果大丰收 / Berry Harvest | 晴朗 | Left edge of body covered |
| P05 | 凸凸头盔 / Rocky Helmet | 雷雨 | Unobscured left face; body below |
| P05 | 光粉 / Bright Powder | 雷雨 | Left edge of body covered |
| P06 | 火焰鸟的试炼 / Moltres's Trial | 烈日 | Unobscured left face; body not fully transcribed here |
| P06 | 闪电鸟的惩戒 / Zapdos's Punishment | 雷雨 | Left edge of body covered |
| P06 | 急冻鸟的庇护 / Articuno's Protection | 暴雨 | Left edge of body covered |
| P07 | 胖丁的表演 / Jigglypuff's Performance | 晴朗 | Unobscured left face; body not fully transcribed here |
| P07 | 吃剩的东西 / Leftovers | 晴朗 | Left edge of body covered |

P05 凸凸头盔, Chinese:

> 携带此持有物的宝可梦受到伤害后，其对伤害来源造成1点伤害。

English: After the holder suffers damage, it deals 1 damage to the damage source. This is an after-receiving-damage trigger, not HP loss or pre-damage retaliation. The booklet says reserves' held items do not take effect. Damage without a source does not acquire an invented Pokémon target.

## Complete six special statuses from accepted booklet — R08 p11 / R09 p12

Common rule, R08 p11:

> 如果一只宝可梦已经陷入一种特殊状态，则其无法陷入其他特殊状态。
>
> 只有出战宝可梦区的特殊状态会生效，备战宝可梦区的特殊状态不会生效。

English: One special status excludes another unless a separately printed override applies. Only active-zone statuses take effect; reserve statuses remain inactive. The following text uses trainer-relative `你的`, not a global turn clock. `畏缩` is flinch, distinct from `昏厥` fainting and defeated `失去战斗能力`.

| Status | Chinese transcription | English / engine effect |
|---|---|---|
| 灼伤 / Burn | 当此宝可梦使用的招式造成伤害时，此伤害值不能被增加，且若此伤害值大于1，此伤害值改为1。 | Damage from this Pokémon's moves cannot be increased; values above 1 become 1. Does not state every non-move damage source is capped. |
| 畏缩 / Flinch | 在你的回合开始时，弃置此指示物，然后本回合的摸牌阶段你的摸牌数-1。 | At your turn start discard status, then draw one fewer card in that turn's Draw phase. |
| 睡眠 / Sleep | 在你的回合开始时，弃置此指示物，然后本回合的出牌阶段内此宝可梦无法使用招式，且你不能进行交替。 | At your turn start discard status; that Pokémon cannot use moves and you cannot switch during that turn's Play phase. Persist the temporary restriction even though the marker is gone. |
| 混乱 / Confusion | 在你的回合开始时，弃置此指示物，此宝可梦对自己造成1点伤害，然后本回合的出牌阶段内其无法使用招式。 | At your turn start discard status; this Pokémon deals 1 damage to itself, then cannot use moves in that turn's Play phase. This is sourced damage, including normal damage/rescue timing, not generic HP loss. |
| 麻痹 / Paralysis | 此宝可梦强化指示物失效，且你只能使用天气为“晴天”（[烈日]或[晴朗]）的【接招吧！】。 | Its reinforcement markers are inactive, and you may only use sunny-weather Take This! cards (intense sun or clear). `失效` is suppression, not discard. No automatic expiration is printed. |
| 中毒 / Poison | 在你的回合开始时，此宝可梦受到1点无来源伤害。 | At your turn start this Pokémon suffers 1 damage without a source. No automatic expiration is printed; no Pokémon receives an invented source/reward. |

Bracketed weather labels substitute for printed icons in the paralysis quotation. For same-time effects across different trainers use R08 p10 current-turn-first counterclockwise order; a trainer orders their own simultaneous effects. Do not invent further ordering between their simultaneous optional traits and statuses.

## Practical implementation findings

- The full command/dodge face and accepted booklet evidence now support their actual rules; **missing effect text on those faces is not a remaining gate**.
- A response cancels one settlement, while costs and move-use counters belong to the move use. Preserve those through retries, reconnect and separate target settlements.
- All six special statuses now have readable accepted-booklet text. Only active statuses apply. Marker removal and whole-turn consequences are separate state changes.
- Split tools are one physical card with two alternative effects. Potion's visible ordinary heal is 2; Full Heal and Rare Candy have readable effect text. Potion's covered rescue/target words remain a genuine narrow unknown.
- Per-face quantities and weather distribution are still unknown. Do not turn this table's 15 depicted physical play-card panels into a 15-card source deck, do not infer 108-card composition, and do not substitute equal-probability weather rolls for real-card judgments. A source-backed command/response module can still be implemented and tested independently of declaring a complete source deck.

No engine/catalogue files were changed by this review. Source assets stay outside `app/public/`.
