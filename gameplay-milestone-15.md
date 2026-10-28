# Gameplay milestone15 — Meowth and shared card gains

2026-10-28. **310/310 tests pass. Combat supports16 groups /48 faces.** Meowth/Meowth/Persian now has its full reviewed effects.24 groups still need complete effects. The original108-card distribution and full random-roster game remain incomplete.

All actual hand additions now pass through the shared gain machinery. Pickup adds one mandatory card outside the trainer's own Draw phase, once per Pokémon instance/global turn, including turn-begin returned cards. Protect pays one sunny card to gain Defense on its user. Pay Day privately inspects and distributes actual top cards; Persian adds Limber and a separately usable Fake Out command. Exact source text, provenance and narrow interpretations are in reviewed-meowth.md/json.

## Verification

- 32 independent Sol tests cover all faces, Protect's self target/weather/payment/markers, Pickup's gain sources/phase/turn/instance limits, multi-card batching, exhaustion/recycling, returned cards, Pay Day reservations/short decks/batched gains/recipients/privacy/strict validation, restart/retry/clocks, Fake Out/Grimer, and Limber/evolution. Full310-test suite passes. A read-only source/engine audit found no blocker.
- Browser fixtures used three separate4174 rooms after legal unique setup, then explicit effect seeds. Meowth Pay Day dealt2 to Slowbro (5/5→3/5), inspected heavy-rain Take this! and clear Dodge!, and selected itself for both. Both selections survived changing Chinese to English. Only the actor saw the reserved faces; target and spectator had0 distribution cards, spectator0 hand cards. Commit changed hand3→6: two reserved cards plus one Pickup bonus.
- Protect's confirmation offered only its own Pokémon. A sunny Dodge was discarded, defense passed, and the native arena label showed Power · Defense with unchanged3/3 HP. Power remained carried; the marker display now makes existing public reinforcement state visible, including inactive labels under paralysis.
- Persian command cards showed both Pay Day and Fake Out. After using Fake Out on Slowbro, the target showed4/5 HP, Flinch and its separate Oblivious protection. Fake Out disabled while Pay Day remained available on the remaining real command. All six inspected gameplay clients had0 warning/error logs.
- Main4173 was restarted with the tested engine; its native Persian3 inspector shows Limber and both command moves. Source/public catalogue bytes match; selection flags and metadata agree on16 groups/48 faces, plus one reviewed item. Source/booklet hashes match local originals.

Evidence: pay-day-distribution-preview.jpg, pickup-hand-preview.jpg, protect-defense-preview.jpg, persian-command-moves-preview.jpg, persian-levels-preview.jpg. Temporary QA clients/server/data were cleaned; main4173 remains available with production rooms untouched. Arena geometry/themes/cameras, centered hover, standalone artwork and identity-first unique setup remain preserved.

## Protocol and limits

gainBattleCards(room,player,cards,{reason}) receives actual card objects; drawBattleCards(room,player,count,reason) draws the base batch then invokes it. turn.pickupUsedIds prevents recursive/repeated use and resets each global turn. Pay Day reserves actual cards in private resolution.distributionCards. Public distribute choices reveal indexed stubs only to the actor. response allocations must cover every index once with a living recipient, including self/repeats. All transfers commit before current-turn-first Pickup bonuses.

Limber-before-Grimer, per-instance Pickup and exhausted-bonus behavior are explicitly documented procedures. No photographed cards, retail quantities, free commands or generic reinforcement acquisition were invented. Production remains six command/six Dodge per seat, all intense sun, with no items until quantities/weather are established.

The previously recorded Grimer/Psyduck/Meowth queue is complete. Next choose another bounded unsupported group from the saved roster/photos, or reviewed game-card effects. All80 gallery assets are already local; no gallery rediscovery is needed. Hosting, remote play, models and audio remain later work.
