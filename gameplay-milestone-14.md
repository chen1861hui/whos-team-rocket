# Gameplay milestone14 — Psyduck and shared move handling

2026-10-28. **278/278 tests pass. Combat supports15 groups /45 faces.** Psyduck/Psyduck/Golduck now has its full reviewed effects.25 groups still need complete effects. Full random-roster play and original108-card distribution remain incomplete.

Swift Swim makes a rainy judgment for current-turn trainer-card range and the current Pokémon instance's move range. Bubble deals1 and removes a marker after damage, before receiving effects. Water Pulse deals2 and makes a rainy confusion judgment through Drought/Grimer. Disable discards one rainy card of any kind, then can temporarily remove0–2 hand cards until that trainer's next turn begins. Printed text/provenance and narrow procedural conventions are in reviewed-psyduck.md/json.

Indexed command/weather move eligibility, matching-weather payment and target counts now share data-based handling. Existing Vulpix Wisp and Squirtle Surf use the same reviewed descriptors/counts. Unknown handlers and unsupported groups still fail closed. A separate private exile zone, stable slot mapping and turn-start queue support future effects without exposing removed faces or inventing cards.

## Verification

- 30 independent Sol tests cover all3 faces, rainy distinctions, command/weather payment and locks, Bubble timing/original instances, Swift Swim trainer versus instance permissions across switches, actor-only nonce slots,0/1/2 removals, full-zone conservation, return/exclusion rules, all four start statuses, nested Grimer/scales/Helmet/rescue, elimination/victory, restart/exact retry, clocks, disconnect and votes. The older unsupported-content guard now selects a currently unsupported group rather than assuming Psyduck remains unsupported.
- Full278-test suite passes. The shared refactor was repaired to preserve JSON-stable optional resolution fields and unchanged noncombat foundation projections; saved Marvel Scale/nested item equality tests pass. Source/public catalogue bytes match; roster flags and metadata agree on15 groups/45 faces, plus one reviewed item.
- Isolated four-seat4174 browser fixture completed legal setup before effect seeds. Swift Swim changed target choices from3 to4 and enabled the opposite Raichu. Bubble dealt1 (4/4→3/4), then the source chose Speed removal before the target's Static window. Disable remained usable after that command and paid a real rainy event fixture.
- Disable offered four face-down slots only to the acting trainer. Two selections survived switching UI language, unselected slots disabled at the limit, and the confirmation moved two cards. Target hand count became2 with Removed:2 and no exiled-face controls. Spectator had0 choices/0 hand cards.
- At target Slowbro's next turn start, its owner saw Return removed cards / Resolve special status. Choosing Poison first changed5/5→4/5 HP, then restored the same two cards for a four-card hand before either ordinary draw; Removed count cleared. All four gameplay clients had0 warning/error logs. Main4173 native Golduck inspector shows both moves and the correct rainy cost.

Evidence: swift-swim-range-preview.jpg, bubble-after-damage-preview.jpg, disable-hand-choice-preview.jpg, disable-removed-count-preview.jpg, turn-start-order-preview.jpg, golduck-levels-preview.jpg. Temporary QA clients/server/data were cleaned; main4173 remains available with saved production rooms untouched. Accepted arena geometry/themes/cameras, centered level hover, native art and identity-first unique selection remain preserved.

The production deck remains six command/six Dodge per seat, all intense sun, with no items or invented retail quantities. Weather/card-kind UI fixtures do not change that deck. Next: Meowth's central gain trigger/distribution and other complete Pokémon groups or reviewed game-card effects. Hosting, models/audio and remote play remain later.

Selected-slot hover/focus contrast was corrected and rechecked in a separate real Disable fixture. Both selected slots retained dark green backgrounds and cream labels under the pointer; the client had zero warnings/errors. The selection screenshot was refreshed after this fix.
