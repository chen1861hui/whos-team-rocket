# Kangaskhan and Staryu source review — 2026-10-31

Root and an independent non-Astra reader inspected the four existing S05 photographs. Exact Chinese, working English, HP/classification, move icons and source SHA-256 hashes are saved for all six faces in `reviewed-kangaskhan-staryu.json`. No downloads. The printing remains unidentified.

| Group / level | Name | HP | Class | Trait | Command move / damage |
|---|---|---:|---|---|---|
| Kangaskhan1 | 袋兽 | 3 | 攻击型 | 早起 / Early Bird | 击掌奇袭 / Fake Out1 |
| Kangaskhan2 | 袋兽 | 4 | 攻击型 | Early Bird | 舍身冲撞 / Double-Edge2 |
| Kangaskhan3 | 袋兽 | 5 | 攻击型 | Early Bird | 绝处逢生 / Reversal3 |
| Staryu1 | 海星星 | 3 | 平衡型 | 发光 / Illuminate | 水枪 / Water Gun2 |
| Staryu2 | 海星星 | 3 | 平衡型 | Illuminate | 念力 / Confusion2 |
| Staryu3 | 宝石海星 | 4 | 平衡型 | Illuminate | 幻象光线 / Psybeam2, up to2 targets |

Sources in `research-assets/douyin-7684572630280187855/`: Kangaskhan1 `b72df440c83a1fa2.webp`; Kangaskhan2/3 left/right `ce3da1b1d2033d35.webp`; Staryu1 `b3d70427fb229ee1.webp`; Staryu2/3 left/right `4c4ca1eb3c341f5f.webp`. English labels are translations, not evidence of English printing. Bracketed weather labels replace printed icons. Every move uses one command; there are no weather payments or unresolved icons. Water Gun has no extra paragraph.

Early Bird excludes only 【胖丁的表演】 and 【魔墙人偶的戏法】 as targets. It is not general Sleep, Flinch or Confusion immunity. `battleEventTargetAllowed(room,pokemon,eventNameZh)` encodes this exact-name permission for an active, undefeated, unsuppressed Kangaskhan. Reserves and suppressed traits do not protect. The query does not enable either unreviewed event card, reconstruct their effects, or add them to the deck; their future action pipeline must call it before payment/target commitment.

Fake Out applies Flinch directly after positive actual move damage through the existing status/replacement pipeline. Its blue icon identifies Flinch, not an extra fee. No first-turn-only restriction is printed.

Double-Edge optionally increases the damage value by1 when dealing damage. After that damage settlement ends, its original damage source loses1HP. The choice belongs after unsuccessful defense and before source/receiving damage modifiers. Recoil waits for after-dealing/after-receiving effects, including nested Helmet and rescue, and occurs before command cleanup. HP loss follows booklet08 p10: it bypasses damage modifiers, source/receiving traits, items and damage-source rewards, but still causes immediate fainting and normal deployment/victory.

Explicit digital policies for edges not resolved by the face:

- No boost offer after a canceled settlement or known Oblivious damage immunity. If receiving changes reduce the boosted damage to0, no recoil. A positive reduced result, including Defense1, still causes recoil.
- Burn may prevent the chosen increase; choosing the optional chain still costs the later1HP when positive damage occurred. The UI explains that damage modifiers still apply. No recoil after passing.
- Preserve the original source instance. If it is already defeated or no longer active after receiving effects, skip recoil rather than charging an incoming reserve. This matches the conservative source-departure policy already used for repeated hits. Immediate victory stops and cleans every continuation.
- Capture the boost once per settlement; persist `doubleEdgeDecided`, `doubleEdgeBoost` and `recoilDone` so retries, restarts and nested responses cannot repeat either effect.

Reversal adds1 when the target’s current HP is strictly greater than the source’s current HP at damage settlement. Include injuries and HP bonuses; equal HP grants nothing. This is mandatory move text and remains effective under Gas. Apply the resulting base through Burn, Power and receiving modifiers normally.

Illuminate optionally draws one extra real card during the trainer’s Draw phase. The face has no explicit once phrase; once per Pokémon instance/Draw phase is the recorded interpretation of “one extra card.” The user may activate it before the first or between mandatory draws. It draws immediately through shared gains without changing `drawRemaining`, preserving Flinch’s base reduction. Once the final mandatory draw transitions to Play, the Draw-phase option is over. Own Draw gains do not trigger Pickup. Suppression prevents activation. Finite exhaustion spends the optional use but invents no card. Mandatory draws retain their established strict supply validation.

Staryu2 and Starmie3 judge after positive damage; only the single intense-sun icon succeeds, not clear weather. Psybeam independently resolves defense/damage/judgment for up to two in-range active targets. The gray spiral is Confusion; existing one-status, Shield Dust, Poison Touch and Drought rules apply. Gas disables Illuminate but leaves move judgments, Reversal and Double-Edge effective.

All six faces execute within the development combat preview and retain full-retail `engineEligible:false`. Counts:31 supported groups/93 faces,32 effect-reviewed groups/96 faces. Chansey remains reviewed reference-only pending Potion rescue text; eight groups still need source effect review. Source/public catalogue copies match and existing roster `supportedEffects` flags total31.
