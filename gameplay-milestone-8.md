# Gameplay milestone8 — Machop /2026-10-28

## Result and boundary

Combat preview supports8groups/24faces and111 regression tests pass. Added Machop, Machoke and Machamp from the already reviewed three faces. All40groups/120faces still have name/HP/art coverage;32groups lack complete executable effects.9groups/27faces have reviewed effect text. Mankey remains reference-only. The test deck/arena/setup are unchanged. No claim of full retail gameplay or remote hosting.

## Rules and timing

Root directly viewed saved originals a84a204806c6aaea.webp and e14644a3470dab05.webp again, matching reviewed-pokemon-batch-3.json hashes. Chinese text establishes Guts, printed damage1/2/3, Lv1/Lv2 target reinforcement discard when the move is used, Lv3 confusion after damage without judgment.

Guts bypasses burn's move-damage restriction and contributes exactly1 when statused. It does not clear burn or ignore target Defense, paralysis or ordinary move-use restrictions. Source-side changes happen before the receiving Defense cap.

Implementation interpretation: the source text says YOU discard one target marker. The move user therefore explicitly chooses the marker; absence of markers is a no-op, not a target prohibition. Use-time removal occurs after command payment/source Power consumption and before Dodge/defense. This follows printed use-time wording and booklet Power timing; the photographs do not spell out every UI procedure. Once accepted, the target's range is not revalidated after marker removal. Suppressed markers remain removable. Exactly one stored marker is removed; this is not hand-card loss, held-item loss or a reinforcement-creation action.

Current move-use dispatcher only enables this for MachopLv1/2's single target. Future MankeyLv3 requires a per-target choice queue and complete held-item-loss/no-hand-limit effects before enabling. No partial Mankey implementation.

## Protocol/UI

Mandatory reinforcement choice contains public decisionID/actorID/targetID, clock and unique marker strings. Actor is the move user. Only actor has Power/Defense/Speed buttons; Chinese 力量/防御/速度. No Pass or Dodge before removal. Submit choice:'reinforcement',reinforcement:<kind> through respondBattle. Validate marker presence and the original target instance. Reject unrelated fields and nonmatching choices atomically. Transition to a fresh target defense decision after removing one marker. Timerexpiry waits; no automatic marker selection. Persistence, retries, offline/vote pauses follow other mandatory choices.

UI uses the existing response panel within the accepted stadium; no geometry/camera/style redesign. Existing centered three-card hover, click details/separate Choose remain intact. Native form art stays in use. Minor Field guide formatting shows an em dash for an unnumbered move rather than raw null.

## Validation

- npm.cmd test:111passed/0failed.19 independent Sol cases in app/test/machop-pokemon.test.js cover marker type/level/status matrices, no markers/single marker, exact-one removal, self-target Power timing, Dodge persistence, defense cap, authority/privacy, invalid/stale/extra fields, retries/restart, timers/offline/votes, six-seat range and Guts/Dynamic Punch. Existing92tests continue passing.
- Edited JS modules parse. Catalogue copies match byte-for-byte;8groups/24faces enabled,9groups/27faces effect-reviewed. Source hashes preserved.
- Isolated4174 fixtures completed legal identity/draw/choose setup, then seeded species/levels/status/markers/deck expressly for coverage. Production4173 rooms/randomness untouched.
- Browser five clients: source/target/spectator for Brick Break and source/target for Dynamic Punch. Source sees3 marker buttons; target/spectator wait; spectator has0 handcards/0 reserve controls. English/Chinese marker panel checked. Burned Machoke removes Defense before response, target passes and takes3damage, remains1/4HP. Burn persists. Burned Machamp with target Defense goes directly to defense; target passes, receives1damage then confusion, remains3/4HP. No warnings/errors in five inspected clients.
- Evidence screenshots: machop-reinforcement-preview.jpg, machop-reinforcement-zh-preview.jpg, machop-guts-damage-preview.jpg, machamp-confusion-preview.jpg. Main Field guide confirms Machop data and supported labels.

Original deck quantities/weather, other game cards, full Potion rescue, remaining32groups and public hosting remain pending. Production uses6command/6Dodge per seat all intense sun. Reinforcement marker fixtures exercise existing sourced marker semantics; no general marker acquisition was added.
