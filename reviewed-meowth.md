# Meowth / Persian review — 2026-10-28

Root and an independent Sol6.1 High reviewer inspected saved originals 1d0ff1e50e0588f3.webp (Lv1 whole) and e1eccf176c187faf.webp (Lv2 left/Lv3 right), in research-assets/douyin-7684572630280187855/. HP3/3/4, classification支援型. Full bilingual faces, positions and SHA-256 hashes are in reviewed-meowth.json. English is a working UI translation. Edition and physical quantities remain unidentified.

Lv1/Lv2 捡拾:

在每个回合内限一次，当你于你的摸牌阶段外得到牌后，你摸一张牌。

Mandatory after an actual hand gain outside the trainer's own Draw phase, once in each global trainer turn. It includes gains during another trainer's turn. Setup does not trigger it. Turn-begin card return occurs before the ordinary Draw phase and does trigger it, even though the store initially labels the new turn phase draw while start effects are pending.

The engine centralizes actual gains from effect draws, gifts, theft, judgment-card gains/replacements, Synchronize, Pay Day and returned cards. Family-exclusive effects do not currently give one Pokémon two traits, but their gain paths still use the shared handler. An empty batch is not a gain. Pickup's own draw cannot retrigger it. Reserve/defeated/inactive/eliminated/spectator Pokémon do not supply this trait.

Lv1 守住, one sunny-category hand-card discard, no damage value:

此招式指定此宝可梦为目标。若此宝可梦没有“防御强化”指示物，其获得一枚“防御强化”指示物。

Booklet07 p08 establishes one matching-weather hand card of any kind as payment. Protect targets only its user and gains one Defense if none is carried; paralysis does not allow duplicate carried markers. It has the ordinary per-move limit and ordinary Dodge settlement, no damage, Power consumption or command-user lock. The accepted target-owner response procedure remains the existing documented interpretation.

Lv2/Lv3 聚宝功, command, damage2:

当此宝可梦因此招式而造成伤害后，你可以观看牌堆顶的两张牌，然后将这些牌分别交给任意名训练家。

Printed 任意名 permits self and the same recipient for both cards; it does not say 任意一名 or require distinct trainers. The optional inspection follows positive move damage/rescue and precedes target after-receiving effects. Once inspection is accepted, all inspected cards must be distributed. Pass before looking leaves the top cards unchanged. Zero/prevented/canceled damage gives no inspection.

Lv3 柔软:

此宝可梦不会陷入“麻痹”状态。

Lv3 击掌奇袭, command, damage1:

当此宝可梦因此招式而造成伤害后，目标宝可梦陷入“畏缩”状态。

Fake Out applies Flinch directly after positive damage, using the one-status and Grimer replacement procedure. It has no judgment or unstated first-turn requirement. Pay Day and Fake Out each have an independent once-per-move limit while sharing the same command-user Pokémon instance restriction. Each pays a real command card. Limber prevents new Paralysis; evolution does not invent a cure for an already carried status.

## Explicit engine interpretations

Pickup's attached-trait limit belongs to the Pokémon instance per global turn. Switching/evolving the same instance does not refresh it; a distinct instance owns its own limit. The photos do not print a shared cross-instance trainer limit. Usage is spent before the bonus draw to prevent recursion. If the finite available draw/discard supply is empty, the mandatory bonus produces no fictional card, spends its trigger and preserves the original gain. This exhaustion policy is a bounded development procedure; original retail quantities remain unverified. Existing base effect draws retain their strict count/empty-deck validation.

Booklet08 defines viewing as examining faces then returning cards to the original region. Pay Day privately reserves the inspected actual two-card bundle under the resolving effect until distribution. This is resolution bookkeeping, not the printed out-of-game zone. Both deliveries commit before receiving Pickup bonuses; different trainers' bonuses follow the established current-turn-first counterclockwise seat order. A bonus cannot steal a still-pending inspected card. Short-deck handling reshuffles discard beneath any existing top cards and uses only available actual cards. No fake card is created.

Only the inspector receives card labels/indexes; physical IDs remain private. Recipient selections and the reserved bundle survive clock polling, restart and exact retry. Inspecting creates a mandatory allocation choice, with no later pass or automatic recipient selection. Optional look expiry passes; required allocation expiry waits, and offline/votes pause.

Limber is checked before Grimer's status-replacement window, consistent with the existing status-eligibility gate: a Pokémon that cannot enter Paralysis creates no Paralysis-entry event. The reviewed photos do not explicitly establish immunity-versus-replacement priority; early immunity gating is the engine's interpretation, not a printed priority rule. It does not prevent unrelated statuses or clear existing Paralysis on level-up.
