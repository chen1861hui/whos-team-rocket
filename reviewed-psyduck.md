# Psyduck / Golduck review — 2026-10-28

Root and an independent Sol6.1 High reviewer inspected saved originals b5a47d16cbd12a6b.webp (Lv1 whole) and dcce9913ff5e4e91.webp (Lv2 left/Lv3 right), in research-assets/douyin-7684572630280187855/. HP3/4/4; classification干扰型. Full bilingual faces, positions and SHA-256 hashes are in reviewed-psyduck.json. English is a working UI translation; bracketed weather names transcribe icons. Edition and physical quantities remain unidentified.

All levels 悠游自如:

在你的出牌阶段限一次，你可以进行一次判定。本回合若你因此特性而判定的结果为“雨天”（[暴雨]/[雷雨]），你使用牌不受距离限制，此宝可梦使用招式也不受距离限制。

Optional once in the trainer's Play phase. The final heavy-rain OR thunderstorm judgment grants two distinct permissions for this turn: the trainer's cards ignore distance, and this Pokémon instance's moves ignore distance. Switching does not transfer the Pokémon permission to a different partner or clear the trainer permission. Existing target-type, move-use and command-user restrictions still apply. The trainer permission is stored/exported for game-card target queries; no unreviewed retail events or targets are introduced.

Lv1/Lv2 泡沫, one command, damage1:

当此宝可梦因此招式而造成伤害后，你弃置目标宝可梦的一枚强化指示物。

This removal is mandatory if the original target has a marker, after positive damage/rescue and before target after-receiving effects. It is not Mankey's move-use removal. If multiple markers are available, the move user chooses one. A fainted target's incoming reserve never inherits removal. Dodge or prevented damage gives no removal.

Lv3 水之波动, one command, damage2:

当此宝可梦因此招式而造成伤害后，你进行一次判定，若结果为“雨天”（[暴雨]/[雷雨]），目标宝可梦陷入“混乱”状态。

Both rainy weathers qualify after positive move damage. It uses Drought's final judgment, the one-status rule and Grimer's shared replacement procedure. The small confusion icon does not supersede the written condition.

Lv2/Lv3 定身法, boxed heavy-rain/thunderstorm requirement, no damage value:

将目标宝可梦对应的训练家的至多两张手牌移出游戏，直到该训练家的回合开始。

Booklet07 p08 says other moves discard ONE qualifying hand card. Any card kind with either rainy weather qualifies; this is not using a command merely because a command card is discarded. No command-user lock or Power consumption. The move still has its own ordinary use limit and one target settlement. Booklet p08 says Dodge can cancel any move's single settlement; target-owner response timing remains the existing documented interpretation.

## Temporary zone and timing

Disable chooses0–2 actual cards from the target trainer's hand. They remain a separate out-of-game zone, excluded from hand count/limit, payment, card effects, draws and discard recycling. Booklet08 p10 says removed cards default back to the region they left and cannot undergo operations except return. Thus no exiled-face inspection action is supplied, including for the owner; projections expose counts only.

Selection convention: the move user chooses among shuffled private index slots; another trainer's cards are face down, one's own hand is labeled. The source does not specify an exact digital selection/visibility procedure. The server stores a stable mapping, validates the whole selection before mutation, and preserves actual identity through restart/retry. Zero selection/pass and empty-hand no-op are supported. An optional response timeout chooses zero by passing.

Return happens at that trainer's NEXT turn beginning, including self-targeting during the present turn. If a turn-start status also triggers, the owner chooses return versus status first, following booklet08's same-trainer simultaneous-order rule. Return always completes before ordinary draws, but is not forcibly prioritized over status. A status may yield judgments, Grimer/scales/rescue or nested item effects; its saved queue resumes the remaining return once.

Elimination convention: cards removed outside a turn-start return remain in that zone until match reset, since the eliminated trainer receives no next turn. If an already-triggered return remains after status eliminates its trainer without ending the match, it completes automatically, followed by ordinary eliminated-hand discard. Immediate victory ends pending effects first and retains the zone/count until reset. No exile faces are revealed in results. These edge procedures are implementation conventions; the photographed Disable text does not enumerate elimination/result behavior.

## Reused machinery

Indexed move eligibility, weather payment and target counts now read reviewed move data. Vulpix's existing sunny move has effectKind:'burn-judgment'; Disable uses 'temporary-hand-exile'. Unknown weather effect kinds remain unavailable. Squirtle's existing two-target Surf now expresses its accepted target count in the same targeting data. Damage, command locks, Drought, Grimer, reinforcement choices, clocks and the arena remain shared. Old saved Wisp resolutions without the descriptor retain their established behavior.
