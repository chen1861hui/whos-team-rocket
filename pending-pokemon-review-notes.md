## Next pending pair — 2026-10-29

Caterpie/Weedle complete, milestone17 (385tests,20supportedgroups). See pending-gastly-magikarp.md for all6 nextfaces’ exactChinese, workingEnglish, sourcehashes/positions anddependencies. Solviewedexactly4localphotos; rootsecondvisualreviewpending. Do not repeat discovery/download. Historical Caterpie/Weedle notes below are complete implemented source readings.

## Caterpie and Weedle — source readings saved 2026-10-29, not enabled

Pidgey/Magnemite completed in milestone16. Next four photos were independently transcribed by Sol and visually inspected by root; no repeat discovery needed. Research folder: research-assets/douyin-7684572630280187855/. Exact identity/HP provenance/hashes remain in selection-roster.json.

- d3083eca1c028544.webp whole: Caterpie Lv1 HP3 Disruptive, Shield Dust 鳞粉: 此宝可梦不会陷入特殊状态。 Tackle command1 damage1, no paragraph.
- 607245c532f5f96b.webp left: Metapod Lv2 HP4, Shed Skin 蜕皮: 当此宝可梦受到伤害时，你可以弃置任意数量的手牌，每弃置一张，此伤害值-1。 Tackle1. Right: Butterfree Lv3 HP4 Compound Eyes 复眼: 其他训练家无法使用[烈日]的【快躲开！】抵消此宝可梦的招式。 Intense sun ONLY, not clear. Whirlwind 吹飞 costs one rainy-weather card, no damage: 此招式不受距离限制。你令目标出战宝可梦和对应的备战宝可梦调换位置。 Sleep Powder 催眠粉 costs one sunny-weather card, no damage: 你进行一次判定，若结果不为[雷雨]，目标宝可梦陷入“睡眠”状态。
- aebe5753010027b3.webp whole: Weedle Lv1 HP3 Offensive, same Shield Dust. Poison Sting 毒针 command1 damage1; after positive damage, heavy-rain-only judgment causes Poison.
- 4435cba5816a6d22.webp left: Kakuna Lv2 HP4 same Shed Skin and Poison Sting1. Right: Beedrill Lv3 HP4 Sniper 狙击手: 此宝可梦使用招式不受距离限制，你使用牌也不受距离限制。 Fury Attack 乱击 command1 damage1: 当此招式被使用时，你亮出牌堆顶的四张牌，然后其中每有一张“晴天”（[烈日]/[晴朗]）牌，此招式多结算一次。

Dependencies before enabling complete groups: all-status immunity; optional arbitrary-hand discard during incoming modifiers; forced active/reserve swap without ordinary-use cost; trainer-vs-instance range; reveal top4 with source-backed card fate; base1 plus sunny-count extra settlements on one original target and full-move marker cleanup. Review booklet reveal fate and original-target/reserve lifecycle; do not invent them. All remain unavailable until complete.


# Pending Pokémon effect review notes — 2026-10-28

Read-only Sol 6.1 High visual transcription of saved originals. Grimer is now complete (reviewed-grimer.md / gameplay-milestone-13.md). Psyduck is now complete (reviewed-psyduck.md / gameplay-milestone-14.md). Meowth is now complete (reviewed-meowth.md / gameplay-milestone-15.md). All three recorded groups are independently reviewed and executable; the original transcripts below are retained as historical source notes. Read app/content/selection-roster.json for full photo paths, face positions and hashes. No download or gallery discovery is needed.

## Grimer / Grimer / Muk — completed, retained source notes

Photos 46f7a756255255d2.webp (whole) and bb30feae53e3cae4.webp (left/right), in research-assets/douyin-7684572630280187855/.

All levels 毒手: 当一只宝可梦陷入特殊状态时，你可以令其改为陷入“中毒”状态，当一只宝可梦的“中毒”状态效果被触发时，你可以令伤害值改为2点。

Global optional status replacement and poison damage setting; not limited to self or the move target. Requires ordered global responders and explicit status/poison continuations. Lv1 command 拍击 1, no further text. Lv2 command 污泥炸弹 2: after move damage judge, single heavy-rain icon poisons target. Lv3 command 剧毒 2: after move damage judge, rainy category (heavy rain OR thunderstorm) poisons target. Tiny poison icons are printed next to Lv2/3 values; they do not replace the stated judgment condition.

## Psyduck / Psyduck / Golduck — completed, retained source notes

Photos b5a47d16cbd12a6b.webp (whole) and dcce9913ff5e4e91.webp (left/right).

All levels 悠游自如: 在你的出牌阶段限一次，你可以进行一次判定。本回合若你因此特性而判定的结果为“雨天”（[暴雨]/[雷雨]），你使用牌不受距离限制，此宝可梦使用招式也不受距离限制。

Distance permission belongs both to trainer cards and this Pokémon's moves; preserve the distinction across switches. Lv1/2 command 泡沫 1: 当此宝可梦因此招式而造成伤害后，你弃置目标宝可梦的一枚强化指示物。 This is after damage, not Mankey's use-time removal. Lv2/3 rainy-weather-card 定身法, no damage: 将目标宝可梦对应的训练家的至多两张手牌移出游戏，直到该训练家的回合开始。 Needs private selection, a real out-of-game zone and restoration at that trainer's turn start. Lv3 command 水之波动 2: after damage, rainy judgment confuses target.

## Meowth / Meowth / Persian — completed, retained source notes

Photos 1d0ff1e50e0588f3.webp (whole) and e1eccf176c187faf.webp (left/right).

Lv1/2 捡拾: 在每个回合内限一次，当你于你的摸牌阶段外得到牌后，你摸一张牌。 Mandatory gain trigger, once per global turn, including other trainers' turns. Requires centralized gain coverage (draws, gifts, theft, Drought exchange, judgment gain, distribution) and prevention of self-trigger loops.

Lv1 sunny-weather-card 守住, no damage: 此招式指定此宝可梦为目标。若此宝可梦没有“防御强化”指示物，其获得一枚“防御强化”指示物。

Lv2/3 command 聚宝功 2: 当此宝可梦因此招式而造成伤害后，你可以观看牌堆顶的两张牌，然后将这些牌分别交给任意名训练家。 Private top-two view and individual allocation; 任意名训练家 does not require different recipients or exclude self. Lv3 柔软: 此宝可梦不会陷入“麻痹”状态。 Lv3 second command move 击掌奇袭 1: 当此宝可梦因此招式而造成伤害后，目标宝可梦陷入“畏缩”状态。 Requires command secondary-move support and actual paralysis immunity.


