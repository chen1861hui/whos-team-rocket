# Scyther and Jynx source review — 2026-11-02

Root and an independent non-Astra reader viewed four saved S05 originals. Exact Chinese, working English, HP/classification, icons and six face hashes are in `reviewed-scyther-jynx.json`. No downloads. Printing remains unidentified.

| Group / level | HP | Class | Trait | Native moves |
|---|---:|---|---|---|
| Scyther1 飞天螳螂 | 3 | 攻击型 | 技术高手 / Technician | 急速折返 / U-turn, command1, damage1 |
| Scyther2 飞天螳螂 | 4 | 攻击型 | Technician | 连斩 / Fury Cutter, command1, damage1; 剑舞 / Swords Dance, sunny card, no damage |
| Scyther3 飞天螳螂 | 4 | 攻击型 | Technician | 十字剪 / X-Scissor, command1, damage3 |
| Jynx1 迷唇姐 | 3 | 支援型 | 预知梦 / Forewarn | 拍击 / Pound, command1, damage1 |
| Jynx2 迷唇姐 | 4 | 支援型 | Forewarn | Pound; 光墙 / Light Screen, sunny card, no damage |
| Jynx3 迷唇姐 | 4 | 支援型 | Forewarn | 天使之吻 / Sweet Kiss, command1, NO damage numeral; Light Screen |

Sources under `research-assets/douyin-7684572630280187855/`: Scyther1 `ecaafd9dc7bb0598.webp`; Scyther2/3 left/right `2b8363ea1b40ef9c.webp`; Jynx1 `65a09eabe1644520.webp`; Jynx2/3 left/right `8bd4f00fac36f980.webp`. Sunny payment means one actual hand card with intense sun OR clear; the icons do not require two cards. Pound has no additional paragraph. No unresolved symbols. English is translation, not English-printing evidence.

Technician permits lower-level MOVES, not lower HP or traits. Native moves appear first; lower faces follow ascending level, preserving their native order. Lv2 indexes: Fury Cutter0, Swords Dance1, U-turn2. Lv3: X-Scissor0, U-turn1, Fury Cutter2, Swords Dance3. Gas removes inherited options but leaves native moves and their text effective. A stale inherited index fails before payment. The existing instance+move-name usage key follows a move through evolution or switching; inheritance does not reset it or the one-command-user restriction.

Booklet08 p11 gives each effective Power marker a discard-on-command trigger and +1 damage until that card ends. Scyther’s moves override the normal identical-marker cap, so all effective carried Power is consumed and its count becomes the saved boost. Paralysis suppresses that trigger and leaves the markers carried. A marker gained after use cannot boost the current card.

Fury Cutter explicitly says 造成伤害时, not 后. Following booklet08’s dealing→receiving→HP order, it gains Power equal to the source-stage damage value after source arithmetic, before Defense/Multiscale/Shed Skin/Marvel Scale. Burn caps that value first. The receiving queue then processes normal reductions. Explicit termination interpretation: keep a resolved grant even if a later receiving modifier reduces damage to0; the booklet states termination/no damage but supplies no rollback rule. Dodge or known damage prevention before the dealing stage grants none. New markers never retroactively increase the captured command boost.

Swords Dance self-targets and gains one Power ignoring the duplicate cap, including while carried markers are inactive. It uses a sunny-weather card, deals no damage and does not consume Power or the command-user allowance.

X-Scissor optionally discards one carried Power on declaration to require two Dodges for this use. Pay it before mandatory Power consumption; only the remainder contributes damage. Policy: a physical inactive Power may pay the explicit move cost under Paralysis because the move says “has”; it still gives no passive damage boost. Two Dodges are two cancellation contributions to ONE settlement, never two damage hits. First contribution preserves the same response ID/clock; a second cancels. Passing/expiry after one leaves the full hit, subject to normal damage modifiers. Real cards, Levitate conversions and one successful Sand Veil contribute through the shared Dodge flow. Failed Sand Veil retains the prior response and counter.

U-turn offers an optional switch after the WHOLE move finishes, including Dodge/zero damage. Card and Defense cleanup runs once before the offer. Bind the original living active source and a living own reserve; do not switch a replacement after source defeat. Arena Trap still applies. This effect neither spends nor resets ordinary switching, sleep’s ordinary-switch block, command-user identity, or move usage. Idempotent cleanup and saved `uTurnOffered` prevent duplicate card discard across response/trap/restart continuations.

Forewarn belongs to Preparation, after ALL global turn-start status/returns/Gas. It is not an alternative ordering choice alongside those effects. At Preparation entry, evaluate the current active Jynx, including a reserve deployed by earlier start-status defeat; suppression prevents activation. Once per Preparation is the explicit interpretation of the singular optional peek; no 限一次 is printed. The engine retains its existing public Draw-phase container while a pending Preparation decision blocks draws; the prompt explicitly names Preparation.

Before viewing, Forewarn may pass/expire. After viewing, every inspected card must be placed; timeout waits. Peek actual available top4, refilling discard below existing top when needed under the established finite-supply policy; empty supply skips the offer. This is private inspection, not reveal/judgment/draw, so Drought/Pickup do not trigger. Store private IDs in `turnStart.forewarnCardIds`; only its actor receives indexed face stubs without IDs/private card metadata. `topOrder` is next draw first. `bottomOrder` is first drawn after the untouched middle; reverse it below the unchanged middle and append reversed top. Both arrays form one exact, disjoint partition. Preserve the original top snapshot, authority, votes, clocks, retries and restart. All-top/all-bottom and short piles remain legal.

Sweet Kiss has no printed damage numeral. After an uncanceled settlement, the target trainer must choose and discard2 actual own hand cards, all if fewer, then draw2 through shared gains. With an empty hand, skip selection and draw directly. Mandatory selection cannot pass or timeout-pick. It remains private to that trainer; the source/spectator sees no selected faces/IDs. Existing finite supply limits the draw to actual available cards; discarded cards may legitimately refill it. Pickup sees the full base gain outside own Draw. There are no damage hooks, status judgments or Power-added damage. A command still triggers the general Power consumption rule.

Light Screen costs one sunny card and grants one Defense only if absent. Default single active/self/in-range targeting and ordinary Dodge remain; it deals no damage and neither consumes Power nor locks the command user. Marker cap, Paralysis inactivity and later damage cleanup follow the existing shared rules.

All six faces execute in combat preview, with full-retail `engineEligible:false`. Counts:33 supported groups/99 faces;34 effect-reviewed groups/102 faces. Chansey remains reviewed reference-only pending Potion rescue text; six groups still need source effect review. Catalogue copies byte-match and existing roster flags total33.
