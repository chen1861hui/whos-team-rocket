> Implementation checkpoint — 2026-11-05: all three legendary-bird cards execute in combat preview. Articuno is a reaction-only card; see [milestone 34](gameplay-milestone-34.md) and [its implementation specification](reviewed-articuno-protection.md). The source review below is historical.

# Legendary-bird event source review — 2026-11-05

Independent re-view of the saved older O03 sheet, supplied P06 preview poster and accepted booklet R07/R08. No discovery, browsing, downloads, engine/UI/catalogue/test changes. Root visual signoff and executable state remain separate. Reading crops/enlargements stayed outside Git and add no source evidence. English names are working UI translations. The JSON supplies exact source text and clearly separated recommended policies.

| Source | Preserved file | SHA-256 |
|---|---|---|
| O03 | `research-assets/user-older-edition-2026-11-04/share_d5d99ad9094dafd0a484315a59b80816.png` | `71dc0eb1e4dee2ed352e891055b8fd13f4590162cb64d6e1bd4267fd67cdb4b2` |
| P06 | `research-assets/provided-previews/mmexport1793008928244.jpg.jpeg` | `5817cb32f58f4bb42814d3f5895e48810e025a9c85eac771b940d775caa332e6` |
| R07 | `research-assets/xiaohongshu-rulebook/07-targets-cards.webp` | `0c3df4526577355eeb0cf30751fa253f59cd59355bc794ba618084362ddd3847` |
| R08 | `research-assets/xiaohongshu-rulebook/08-timing-damage-status.webp` | `242ae7f516b5a4310445b1c4bf1b1c6b6323630ab8337a641a7e7608aa6a61f2` |

O03 is1440×1920 encoded WebP despite its.png extension, explicitly user-described older printing. P06 is790×3669 JPEG; its Master Edition preview poster has an unobscured Moltres paragraph but overlaps left portions of Zapdos/Articuno. O03 supplies complete unobscured text for those paragraphs, rather than recovering P06’s covered pixels. Weather icons agree in these sources: Moltres intense sun, Zapdos thunderstorm, Articuno heavy rain. Neither face prints a deck quantity. Displayed stacks do not establish a retail manifest. No additional Master video frames were acquired or claimed as reviewed in this task.

Reading crop bounds from original top-left: O03 Moltres x50–290/y880–1000, Articuno x330–574/y880–1000, Zapdos x605–855/y880–1000; P06 all three body regions x90–770/y2930–3190. Crops were only enlarged for reading, outside the repository. Full originals were viewed first.

## Moltres’s Trial / 火焰鸟的试炼

Exact Chinese, normalized line breaks:

> 在你的出牌阶段对所有其他训练家的出战宝可梦使用。从你的下一位训练家开始，按行动顺序结算。除非目标宝可梦对应的训练家打出一张【接招吧！】，否则目标宝可梦受到火焰鸟造成的2点伤害。

During Play, use on all OTHER trainers’ actives, beginning with the next trainer and following action order. Each affected trainer plays one Take this! response or that original active receives2 damage caused by Moltres. It is an event, not a Pokémon move. There is no printed distance clause or Dodge requirement. The physical card’s weather is intense sun; response Take this! weather is not constrained by this face.

The paragraph says 打出, distinct from 使用 in bookletR07 p09. Conservative policy: accept an actual own command card response without executing a Pokémon move; do not silently offer virtual use-as-command conversions. Spending the response does not consume Power, use a move, lock a command-using Pokémon or trigger command-on-use/command-target traits. Burn/Paralysis restrictions concerning use of moves/commands do not automatically alter the played response. Keep this literal response policy explicit rather than presenting it as an exhaustive printed interaction ruling.

## Zapdos’s Punishment / 闪电鸟的惩戒

Exact Chinese with printed weather icon named editorially:

> 在你的出牌阶段对所有训练家的出战宝可梦使用。从你的下一位训练家开始，按行动顺序结算。目标宝可梦对应的训练家进行一次判定，若结果为[雷雨]，令目标宝可梦受到闪电鸟造成的伤害，伤害值等同于该宝可梦的等级。

`[雷雨]` denotes the dark cloud/yellow lightning icon; the bracketed word is not literal printed text. During Play, use on ALL trainers’ actives, including self. Start with the NEXT trainer and follow action order, placing the user LAST in the complete circuit. This differs from Mew’s self-first order. Each target trainer judges; on a final thunderstorm result, the target receives damage from external Zapdos equal to that Pokémon’s level. No printed Dodge/command response, status application or distance restriction. The card’s own thunderstorm weather is not the judgment result.

Use the shared Drought replacement procedure; no available judgment card means no result and no damage. The face does not specify a separate level snapshot rule. Using the original still-active target’s current level after its final judgment is an explicit bounded timing policy, not additional exact text. Replaced/defeated original targets must not redirect damage to a new reserve.

## Articuno’s Protection / 急冻鸟的庇护

Exact complete O03 text:

> 你选择一项：
> 1.当一张事件牌的效果对一个目标生效前，抵消此事件牌对该目标的效果；
> 2.当一只宝可梦陷入特殊状态后，恢复其特殊状态。

Choose one: BEFORE one event card’s effect takes effect on ONE target, cancel that event card’s effect on that target; or AFTER one Pokémon gains a special status, cure its special status. This is not a general ordinary-Play Full Heal. The first branch does not cancel every target of a global event. The second concerns actual newly gained status, not an immune/prevented attempt; replacement procedures must identify the final applied status first. The face does not print self-only, distance or weather conditions. P06’s visible fragments agree, while its covered left characters remain covered.

Articuno’s text is sufficiently readable for source review. It remains reviewed but unimplemented by this record because executing it coherently requires shared before-event-target and after-final-status-applied windows across existing events/status sources, actual-card payment, privacy-safe queues, interruption/restart/vote/timer handling and documented continuation. It must not be enabled only for a convenient subset of current effects while silently omitting its other legal windows.

The face and the viewed booklet pages do not explicitly define counter-counter chains, whether an Articuno response itself opens another Articuno target window, or how a queue reopens after cancellation. Do not fill those details from familiar 三国杀 conventions. A bounded digital policy may be documented by implementation; keep it separate from printed permission. BookletR08 p10’s current-turn-first counterclockwise ordering is a basis for simultaneous trainers’ opportunities, not a complete printed reaction-stack specification. No request for the already-supplied card image is needed.

## Shared integration recommendations and limits

Moltres/Zapdos are named external damage sources with no trainer owner, as supported by bookletR08 p10’s pictured examples. Preserve that attribution: no event-user offense/Power/Burn/Blaze/Guts, invented retaliation target or defeat reward. Keep ordinary receiving modifiers/traits, Potion/Healer rescue, defeat/deployment and immediate victory. Early Bird protects only against its two named Jigglypuff/Mr. Mime events; it grants no legendary-bird immunity.

Capture event-use target order and original active instances; skip eliminated/replaced/defeated queued targets, never a new active inheriting an old slot. Hold the actual event outside draw/discard circulation through all target settlements and nested effects; Synchronize may claim that one card once without duplicating or ending the remaining event wave. Whole-card Defense cleanup remains shared. These continuation/capture/card-conservation details are implementation policies combined with existing accepted mechanics, not additional printed paragraphs.

No physical per-name/pairing × weather copy table is established. Retail engineEligible and production deck gates remain closed. This source review enables a grounded Moltres/Zapdos implementation plan while retaining Articuno’s broader reaction machinery as explicit unfinished work.
