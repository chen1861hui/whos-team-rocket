# Gameplay milestone 11 — Held items and Mankey

Date: 2026-10-28. **192 tests pass. Combat supports 11 groups / 33 faces.** All currently effect-reviewed Pokémon groups execute; 29 groups still need effects. One held item, Rocky Helmet, is implemented. The production deck remains six command/six Dodge per seat, all intense sun, with no held items until inventory/weather data is established. No retail counts were invented.

## Changes

Equipment moves a real Helmet from hand to an own undefeated active or reserve partner. A replaced real item enters discard once. There is no generic unequip action. Switching/evolution preserve items; reserve effects are inactive. Public item stubs expose type/name/weather, not physical IDs or hidden opposing reserves.

Active Mankey replacement offers optional Defiant. Acceptance draws two before granting a trainer hand-limit exemption for the current global turn; passing grants neither. The exemption survives switching but resets on the next global turn. Store timers and discard/end-turn rules share handLimit, and the UI shows ∞. Reserve replacement, suppression and defeat do not offer Defiant; the defeat edge is an explicit interpretation in reviewed-held-items.md.

Primeape's Close Combat targets up to two Pokémon and removes one chosen reinforcement from each marked target before the first defense. Mankey Lv.2 also uses this use-time queue; Lv.1 Scratch remains printed damage 2 with no extra paragraph. Source Power is consumed before marker choices; no general marker acquisition is invented.

Rocky Helmet creates actual item damage from the holder to the original source, without a Dodge or judgment. Saved parent resolutions allow recursive Helmet, trait choices, Drought, rescue and defeat to resume with captured identities. Damage modifiers apply by channel: burn limits moves, while Blaze/Guts can alter item damage. Immediate victory cleans every pending continuation and card zone. Source-free poison acquires no invented target; confusion can cause self-retaliation.

When receiving effects trigger together, the holder chooses the next effect. This permits Oblivious before Helmet or Helmet before Oblivious and preserves optional Static/Synchronize choices. Single effects run directly. Mandatory ordering waits on timeout and survives disconnect/vote/restart/retry. Squirtle Lv.2/3 suppression covers the full move, including targets, judgments and nested damage, without discarding items or triggering Defiant; a suppressed carried item still blocks Sand Veil.

Native bilingual controls confirm equipment/replacement, display active items and inactive own reserve items, expose Defiant and effect-order choices, and honor unlimited-hand turns. Arena geometry, themes, cameras, centered hover cards, click details/separate Choose and standalone artwork remain intact.

## Validation

- Full suite: 192 passed, zero failed, including 30 independent Sol tests in app/test/mankey-items.test.js. Coverage includes authority, exact card conservation, privacy, retries/restart, clocks/votes, hand-limit reset, use-time target ordering, suppression, defeat, cyclic retaliation, restart during nested rescue and a mixed Helmet → Static → Drought → defeat continuation.
- Parent and independent Sol inspected original held-item/Mankey/rulebook material. Reviewed source hashes are preserved. Source/public catalogues match with 11 supported groups/33 faces and one reviewed item. Edited JavaScript parses.
- Isolated 4174 browser fixtures completed legal identity/draw/choose setup, then explicitly seeded items/species/deck. Main rooms and production deal/randomness were untouched. Item fixture quantities are not retail claims.
- Equipment/Defiant: Primeape replaced an active Helmet, accepted two draws, equipped the remaining Helmet to reserve and reached End with six cards and 6 / ∞; End turn was enabled. Reserve item was labelled inactive.
- Chinese effect order: Slowbro received 1 damage, then chose Oblivious before Helmet. Retaliation damaged Machop to 2/3 HP; its returning Helmet hit became zero, leaving Slowbro at 4/5 HP with protection. Spectator had zero effect controls and hand cards.
- Primeape selected two targets and completed both reinforcement choices before any defense; all HP remained unchanged during those choices. Five inspected gameplay clients had zero warnings/errors.
- Images: held-item-equip-preview.jpg, defiant-hand-limit-preview.jpg and held-item-effect-order-preview.jpg.

Remaining work: 29 Pokémon groups, more game cards/items and complete Potion rescue, original 108-card quantities/weather, hosting/remote testing, models and audio. Reviewed source text does not establish unknown inventory or covered effects.
