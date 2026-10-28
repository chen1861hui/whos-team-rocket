# Reviewed Pokémon batch 3: Abra, Machop and Slowpoke

## Root integration review — 2026-10-28

Root independently viewed all6 originals and agrees with the nine face readings. Six Abra/Slowpoke faces now execute in the labelled combat preview; Machop remains reference-only. Teleport has no printed numeral; it is not a zero-damage attack. The receiving Synchronize/Oblivious triggers require actual positive damage and a surviving active source of that ability. Future Sight resolves at move-use before defense; a digital indexed permutation implements its private reorder, with available-card short-pool handling documented in the contract. Full original quantities and right-side symbol meanings remain unknown.

Review date: 2026-10-28. Exactly three groups, nine faces and six saved original photographs. All six originals were directly viewed with tools.view_image and their SHA-256 hashes verified against app/content/selection-roster.json. This is a single source transcription review, not an independent second signoff. Source-only artifact; no engine, UI, catalogue, tests or original asset changed. Every face remains engineEligible: false in this artifact.

Chinese text below preserves visible words/numerals with line breaks normalized. Bracketed [烈日] and [雷雨] editorially substitute visible full-sun and thunderstorm icons. English is working translation; the printing remains unidentified. Right-side spiral/face-like heading icons are recorded as unresolved symbols, not inferred costs or automatic effects.

All nine moves show the red/yellow command marker before their names. Under reviewed-playcard-spec.md this requires one 接招吧！, with no weather-card payment. Default: once per Pokémon/move per Play phase; one command-using Pokémon identity per trainer/Play phase unless overridden. No trait here prints a once-per-phase/turn cap. No move here increases the target count beyond one; Teleport explicitly self-targets. Other moves retain booklet distance/active/reserve targeting rules.

## Provenance

| Face | Saved file | SHA-256 |
|---|---|---|
| 凯西 Lv.1 / whole | research-assets/douyin-7684572630280187855/8aa8f78fb2454b3c.webp | be6501be97dd9e2d155c2d6e7f92801f882e4d0756011951b1f82aba1031ee72 |
| 勇基拉 Lv.2 / left | research-assets/douyin-7684572630280187855/fd4244524a22cb33.webp | 330a7cf98e5006c30d2e03d255fa6c578ea242603a611ba0f963713548b92581 |
| 胡地 Lv.3 / right | research-assets/douyin-7684572630280187855/fd4244524a22cb33.webp | 330a7cf98e5006c30d2e03d255fa6c578ea242603a611ba0f963713548b92581 |
| 腕力 Lv.1 / whole | research-assets/douyin-7684572630280187855/a84a204806c6aaea.webp | d886ccfcd2365c7df28b2356d991296d52ac01f191f483a859f1484fa78267e9 |
| 豪力 Lv.2 / left | research-assets/douyin-7684572630280187855/e14644a3470dab05.webp | 2abf68b08f63bcfe6bed408431489ad5bb8c2ba46c0b1abf011c9723711cd590 |
| 怪力 Lv.3 / right | research-assets/douyin-7684572630280187855/e14644a3470dab05.webp | 2abf68b08f63bcfe6bed408431489ad5bb8c2ba46c0b1abf011c9723711cd590 |
| 呆呆兽 Lv.1 / whole | research-assets/douyin-7684572630280187855/b280570639f39edd.webp | 5fba4f27c085acf024e320caff04c03b5bcc250ce8ca68c7131e756eb01ae3d2 |
| 呆呆兽 Lv.2 / left | research-assets/douyin-7684572630280187855/ce76e230919194cf.webp | 172e72b14f8a823078bd30fce1d0716d7c4f50188a4a4aa6f18681c6de3873b7 |
| 呆壳兽 Lv.3 / right | research-assets/douyin-7684572630280187855/ce76e230919194cf.webp | 172e72b14f8a823078bd30fce1d0716d7c4f50188a4a4aa6f18681c6de3873b7 |

## 凯西 / Abra

**Trait 同步 / Synchronize**

> 当此宝可梦受到伤害后，你可以获得造成此伤害的事件牌或【接招吧！】。

After this Pokémon receives damage, you may obtain the event card or Take this! that caused that damage.

Timing: after-receiving-damage. Optional: yes. No explicit per-phase/turn cap is printed.

### 凯西 / Abra Lv.1 — HP 3, 攻击型

**瞬间移动 / Teleport** — COMMAND; printed numeral **none**.

> 此招式指定此宝可梦为目标。你摸一张牌，然后若你的备战宝可梦未失去战斗能力，你进行交替，此交替不计入次数限制。

This move targets this Pokémon. Draw one card; then, if your reserve Pokémon has not fainted, switch. This switch does not count toward the switch limit.

Timing: on-move-use. Target: The face explicitly specifies this Pokémon as its target.

Uncertainty: 同步 card-zone/retrieval conflicts and shared damage-causing card across multiple targets are not settled by this photographed face; retain exact source-card identity and accepted general timing rules.

### 勇基拉 / Kadabra Lv.2 — HP 3, 攻击型

**念力 / Confusion** — COMMAND; printed numeral **2**.

> 当此宝可梦因此招式而造成伤害后，你进行一次判定，若结果为[烈日]，目标宝可梦陷入“混乱”状态。

After this Pokémon deals damage with this move, make a judgment. If the result is intense sun, the target Pokémon becomes confused.

Timing: after-dealing-damage. Target: One Pokémon within this Pokémon's distance restriction; command active/reserve and self/adjacent rules come from reviewed-playcard-spec.md and reviewed-combat-spec.md. The face itself has no additional target restriction.

Visible heading symbol: gray square with white spiral. Visible appearance is recorded. Its semantic role at this heading position is not independently established; do not add a cost, automatic status, damage element, immunity or resistance.

Uncertainty: 同步 card-zone/retrieval conflicts and shared damage-causing card across multiple targets are not settled by this photographed face; retain exact source-card identity and accepted general timing rules.

### 胡地 / Alakazam Lv.3 — HP 4, 攻击型

**精神强念 / Psychic** — COMMAND; printed numeral **3**.

> 当此宝可梦因此招式而造成伤害后，你进行一次判定，若结果为[烈日]，目标宝可梦陷入“混乱”状态。

After this Pokémon deals damage with this move, make a judgment. If the result is intense sun, the target Pokémon becomes confused.

Timing: after-dealing-damage. Target: One Pokémon within this Pokémon's distance restriction; command active/reserve and self/adjacent rules come from reviewed-playcard-spec.md and reviewed-combat-spec.md. The face itself has no additional target restriction.

Visible heading symbol: gray square with white spiral. Visible appearance is recorded. Its semantic role at this heading position is not independently established; do not add a cost, automatic status, damage element, immunity or resistance.

Uncertainty: 同步 card-zone/retrieval conflicts and shared damage-causing card across multiple targets are not settled by this photographed face; retain exact source-card identity and accepted general timing rules.

## 腕力 / Machop

**Trait 毅力 / Guts**

> 此宝可梦即使处于“灼伤”状态，其招式的伤害也不会因“灼伤”而减少。当此宝可梦造成伤害时，若此宝可梦处于特殊状态，此伤害值+1。

Even while this Pokémon is burned, the damage of its moves is not reduced by burn. When this Pokémon deals damage, if it has a special status, that damage is increased by 1.

Timing: continuous-burn-reduction-exception-and-when-dealing-damage. Optional: no. No explicit per-phase/turn cap is printed.

### 腕力 / Machop Lv.1 — HP 3, 攻击型

**碎岩 / Rock Smash** — COMMAND; printed numeral **1**.

> 当此招式被使用时，你弃置目标宝可梦的一枚强化指示物。

When this move is used, discard one reinforcement marker from the target Pokémon.

Timing: on-move-use. Target: One Pokémon within this Pokémon's distance restriction; command active/reserve and self/adjacent rules come from reviewed-playcard-spec.md and reviewed-combat-spec.md. The face itself has no additional target restriction.

Uncertainty: The face orders one target reinforcement marker discarded at move use, but does not independently specify marker choice, no-marker handling or defense ordering. Do not make the effect contingent on damage.

### 豪力 / Machoke Lv.2 — HP 4, 攻击型

**劈瓦 / Brick Break** — COMMAND; printed numeral **2**.

> 当此招式被使用时，你弃置目标宝可梦的一枚强化指示物。

When this move is used, discard one reinforcement marker from the target Pokémon.

Timing: on-move-use. Target: One Pokémon within this Pokémon's distance restriction; command active/reserve and self/adjacent rules come from reviewed-playcard-spec.md and reviewed-combat-spec.md. The face itself has no additional target restriction.

Uncertainty: The face orders one target reinforcement marker discarded at move use, but does not independently specify marker choice, no-marker handling or defense ordering. Do not make the effect contingent on damage.

### 怪力 / Machamp Lv.3 — HP 5, 攻击型

**爆裂拳 / Dynamic Punch** — COMMAND; printed numeral **3**.

> 当此宝可梦因此招式而造成伤害后，目标宝可梦陷入“混乱”状态。

After this Pokémon deals damage with this move, the target Pokémon becomes confused.

Timing: after-dealing-damage. Target: One Pokémon within this Pokémon's distance restriction; command active/reserve and self/adjacent rules come from reviewed-playcard-spec.md and reviewed-combat-spec.md. The face itself has no additional target restriction.

Visible heading symbol: gray square with white spiral. Visible appearance is recorded. Its semantic role at this heading position is not independently established; do not add a cost, automatic status, damage element, immunity or resistance.

## 呆呆兽 / Slowpoke

**Trait 迟钝 / Oblivious**

> 当此宝可梦于你的回合外受到伤害后，直到当前训练家的回合结束，此宝可梦不会再受到伤害。

After this Pokémon receives damage outside your turn, this Pokémon cannot receive further damage until the current trainer’s turn ends.

Timing: after-receiving-damage-outside-own-trainer-turn. Optional: no. No explicit per-phase/turn cap is printed.

### 呆呆兽 / Slowpoke Lv.1 — HP 3, 防御型

**水枪 / Water Gun** — COMMAND; printed numeral **2**.

No additional effect paragraph is printed. This blank is source evidence, not an unresolved transcription.

Timing: no-additional-effect-paragraph. Target: One Pokémon within this Pokémon's distance restriction; command active/reserve and self/adjacent rules come from reviewed-playcard-spec.md and reviewed-combat-spec.md. The face itself has no additional target restriction.

### 呆呆兽 / Slowpoke Lv.2 — HP 4, 防御型

**意念头锤 / Zen Headbutt** — COMMAND; printed numeral **2**.

> 当此宝可梦因此招式而造成伤害后，你进行一次判定，若结果为[雷雨]，目标宝可梦陷入“畏缩”状态。

After this Pokémon deals damage with this move, make a judgment. If the result is thunderstorm, the target Pokémon becomes flinched.

Timing: after-dealing-damage. Target: One Pokémon within this Pokémon's distance restriction; command active/reserve and self/adjacent rules come from reviewed-playcard-spec.md and reviewed-combat-spec.md. The face itself has no additional target restriction.

Visible heading symbol: blue square with white face-like symbol. Visible appearance is recorded. Its semantic role at this heading position is not independently established; do not add a cost, automatic status, damage element, immunity or resistance.

### 呆壳兽 / Slowbro Lv.3 — HP 5, 防御型

**预知未来 / Future Sight** — COMMAND; printed numeral **2**.

> 当此招式被使用时，你可以观看牌堆顶的三张牌，然后将这些牌以任意顺序置于牌堆顶。

When this move is used, you may look at the top three cards of the deck, then place those cards on top of the deck in any order.

Timing: on-move-use. Target: One Pokémon within this Pokémon's distance restriction; command active/reserve and self/adjacent rules come from reviewed-playcard-spec.md and reviewed-combat-spec.md. The face itself has no additional target restriction.

Uncertainty: The face does not independently establish fewer-than-three-card deck handling, exact private reorder UI procedure, or move-use ordering relative to defense.

## Implementation boundaries

- All nine moves have the command marker before the move name: one 接招吧！ under the reviewed booklet rules. None has a weather-card condition or weather-card payment.
- Printed numerals are separate from conditional damage modifiers and right-side heading symbols. Teleport has no printed numeral; do not invent zero as a printed value.
- 受到伤害 means receives damage, 造成伤害 means deals damage, and neither automatically includes 失去体力 (HP loss). Resolve actual positive damage and existing fainting/rescue ordering before after-damage triggers.
- 同步 is optional after receiving damage and obtains the actual event card or 接招吧！ that caused that damage. It is not a judgment, damage reflection, generic draw, or automatic retrieval of an arbitrary discard. The face alone does not define card-zone conflicts or multi-target shared-card retrieval.
- 瞬间移动 explicitly self-targets: draw first, then switch if reserve is not fainted. The switch does not count toward the switch limit. The face does not waive move-use or command-use limits.
- 毅力 has two continuous clauses: burn does not reduce move damage; while the Pokémon has a special status its caused damage is +1. Do not turn this into burn immunity or +1 per special status.
- 碎岩 and 劈瓦 discard one reinforcement marker from the target when the move is used, not only after damage. Root must establish marker-choice/no-marker procedure and ordering against defense from the accepted rules before enabling this interaction.
- 爆裂拳 causes confusion after actual damage without a judgment. 念力 and 精神强念 instead require a mandatory intense-sun judgment; 意念头锤 requires a mandatory thunderstorm judgment for flinch.
- 迟钝 triggers automatically only after receiving damage outside its trainer’s turn. It prevents further damage until the CURRENT trainer’s turn ends; it neither cancels the first damage nor expressly prevents HP loss.
- 预知未来 optionally privately views the top three cards and returns those cards in any order at move-use time. Do not substitute a draw, reveal, judgment or post-damage effect. Short-deck behavior and interaction order need the accepted general rules.
- No trait paragraph in these nine faces prints a once-per-phase/turn cap. Standard move-use and one-command-Pokémon limits remain applicable unless expressly overridden. No complete retail quantities/weather distribution are established.

Rules references: reviewed-combat-spec.md; reviewed-playcard-spec.md; gameplay-milestone-4.md. Source JSON: reviewed-pokemon-batch-3.json. Original photos were neither rediscovered nor downloaded.

## Machop integration — 2026-10-28

Machop's three faces now execute in combat preview alongside Abra/Slowpoke. Root viewed both Machop originals again; hashes remain matched. Use-time marker choice/no-marker handling and source Power ordering are documented implementation interpretations in gameplay-milestone-8.md. This supersedes the previous reference-only Machop boundary; raw source JSON remains a transcription rather than an eligibility flag.111tests pass;8groups/24faces supported overall.
