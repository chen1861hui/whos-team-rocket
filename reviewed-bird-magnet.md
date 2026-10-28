# Reviewed Pidgey and Magnemite faces

Reviewed 2026-10-29 against saved S05 photographs, independently transcribed/audited by Sol and visually checked by root. Edition unidentified; English names/text are working UI translations. Exact Chinese paragraphs, source filenames, SHA256 hashes and positions are in reviewed-bird-magnet.json, duplicated as effect provenance in the catalogue. Photos are research-only; the app uses redesigned native cards and standalone art.

Pidgey Lv1 HP3, Pidgeotto Lv2 HP4, Pidgeot Lv3 HP4; all Offensive/Keen Eye. Tackle1, Wing Attack2, Air Slash3, each one command and default maximum one active target. Air Slash judges thunderstorm only after actual positive damage, then applies Flinch through original-instance/status replacement rules.

Magnemite Lv1/Lv2 HP3, Magneton Lv3 HP4; all Disruptive/Analytic. During own Play, once per active Pokémon instance, discard 0 through current-HP distinct own hand cards, then draw that many. Hand size also bounds selection. Validation precedes mutation; discard precedes shared equal drawing. Zero activation spends the use as an explicit policy. Evolution/switching retains instance use. No judgment, move use or command-user lock is spent.

Thunder Shock Lv1/2 damage1 and Thunderbolt Lv3 damage2 cost one command; positive damage judges thunderstorm for Paralysis. Thunder Wave index1 Lv2/3 discards one actual heavy-rain OR thunderstorm hand card of any kind, has no damage numeral and judges NOT intense sun for Paralysis. Clear therefore succeeds. Normal Dodge/Sand Veil can cancel it. Independent move use; no Power consumption or command lock. Existing Drought, Poison Touch, Limber, rescue and original-instance routing remain authoritative.

## Keen Eye interpretations and timing

The face explicitly affects OTHER trainers’ Dodges and lasts through the entire move. Source-owner self-defense retains ordinary cancellation. Real Dodge consumes a real own Dodge; successful Sand Veil counts as a Dodge and adds one reduction without inventing a physical card/weather. Failed Sand Veil adds none. Repeat actual Dodges are allowed while the same response window survives. Booklet07 cancels one settlement per ordinary Dodge and does not impose one card per surviving window. The older combat-spec shorthand “one defense per settlement” describes the ordinary cancellation flow, not a cap under Keen Eye.

The face does not print a damage-timing tag. Treating Dodge reduction as receiving-damage modification and binding it to the original target instance are explicit interpretations. Booklet08 allows one trainer to order simultaneous owned effects. Source modifiers run first; pending damage-order lets target order Dodge reduction, Defense, Multiscale and optional Marvel Scale when consequential. Marvel Scale retains its printed damage>1/status gate. Zero ends damage and suppresses source/receiving after-damage effects. Defense stays unless positive card damage occurred. Nested Rocky Helmet uses a separate damage channel and never inherits move reduction.

Preserving the same defense ID/deadline across reductions, restoring an already-attempted Sand Veil window without another attempt, and zero-card Analytic consuming its once limit are explicit engine policies. The private resolution map/queue persists across reconnect/restart/exact retries and is cleared with its parent move. Public decisions expose only effect names, current damage and accumulated reduction. Mandatory damage-order expiry waits for its owner; votes/offline pause follow existing rules.

## Validation

34 new independent tests; complete suite344/344. Covers all six faces, cumulative actual/virtual Dodge, source/receiving modifier orders, zero damage, nested items, judgment replacement, status replacement/immunity, current HP, actual-card conservation, recycling, zero activation, instance locks, authority/privacy, stale/forged inputs, timing, persistence and exact retries. Independent final source audit found no blockers.

Three browser clients at isolated4174: Analytic3/4HP caps at3; fourth selection disables commit; exchange3 leaves4 actual hand cards and removes activation. Two Dodges reduce Air Slash3 to1, target3→2HP. Dragonite receiving order shows Dodge/Defense/Multiscale; Multiscale then Dodge gives0 and retains Defense. English/Chinese checked; spectator has no private hand/response buttons. All inspected warning/error logs empty. Analytic card-name contrast corrected and screenshot rechecked. Production deck unchanged.

