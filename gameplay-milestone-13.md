# Gameplay milestone13 — Grimer and global Poison Touch

2026-10-28. **248/248 tests pass. Combat supports14 groups /42 faces.** Grimer/Grimer/Muk is now executable with its full reviewed trait and moves. The remaining26 groups still lack complete effects. Full random-roster play and the original108-card distribution remain incomplete.

Poison Touch can globally replace a newly entering special status with Poison, respecting the existing one-status restriction. Saved response procedures capture current-turn-first active Grimer instances, preserve the original target and resume the interrupted status/damage continuation once. The same trait can set a turn-start Poison tick's base to2 before Defense/Multiscale/Marvel Scale. Source-free damage never acquires a fictional damage source, command, retaliation target or defeat reward.

Lv1 Pound deals1 with no extra paragraph. Lv2 Sludge Bomb deals2 and poisons after a heavy-rain judgment; Lv3 Toxic deals2 and poisons after either rainy weather. Both use persistent Drought judgments and actual positive-damage conditions. Details, exact text, provenance and queue interpretations are in reviewed-grimer.md/json.

The rulebook check also corrects Defense's lifecycle for turn-start status damage: it may cap the damage, but persists because there is no resolving card. A focused Confusion/Blaze/Defense regression accompanies the Poison cases. Ordinary damaging cards/items retain their existing end-of-card marker handling.

## Protocol

room.statusEvent is private persisted state: kind:'status'|'poison', targetId (original Pokémon instance), actorIds, actorInstances, index, and status/next or damage. pendingBattle.kind='poison-touch' exposes actor/target trainer IDs, mode, trait:'poison-touch', canTrait:true and the pending public status or base damage only. Internal actor lists, instance mappings and continuations are never projected. respondBattle accepts only trait/pass without extra payload fields, from the current eligible actor.

Initial Poison-to-Poison choices and further setters after first acceptance are omitted as outcome-neutral procedures, explicitly distinguished from printed rules. There is no per-turn cap across distinct events. Status setters never recursively create another event. All existing status callers use this shared procedure: post-damage weather effects, Static, Dynamic Punch and Will-O-Wisp.

## Verification

-27 new independent Sol tests cover all3 faces, weather distinctions, actual damage/Dodge conditions, original fainted targets, all status callers, current-turn ordering, captured actor identity, reserve/defeat/spectator exclusions, no turn cap, no-op pruning, poison receiving modifiers, Defense persistence, source-free rescue/deployment, authority/privacy, strict payloads, clocks/votes/disconnects, restart/exact retry and closure cleanup. Full248-test suite passes.
- Browser QA used an isolated4174 fixture after legal identity/draw/selection setup. Machamp's Dynamic Punch hit a Defense-bearing Venusaur for1. While Confusion was pending, only the remote Muk trainer received Change to Poison; Venusaur displayed4/5 HP with no prematurely applied status. Accepting produced Poison rather than Confusion. The spectator had0 trait controls and0 hand cards.
- On Venusaur's next turn, the Poison Touch damage window showed4/5 HP unchanged. Muk accepted base2; Venusaur then showed2/5 HP and resumed its draw phase. Chinese status replacement and English poison-damage controls were verified. All4 gameplay clients had0 warning/error logs. No production room or randomness was seeded.
- Main4173 was restarted with the new rules. Its native Grimer/Muk level inspector shows reviewed HP, Poison Touch, Sludge Bomb/Toxic weather conditions and standalone art. The accepted arena, native cards, centered hover and identity-first unique selection flow were preserved.
- Source/public catalogues are byte-identical; selection flags align with14 supported groups,42 reviewed effect faces and1 reviewed item. All Grimer and booklet source hashes match local originals.

Evidence: poison-touch-status-preview.jpg, poison-touch-damage-preview.jpg, muk-levels-preview.jpg. Temporary QA tabs/server/data were cleaned after verification; the main preview remains available at http://127.0.0.1:4173/.

Production deck stays six command/six Dodge per seat, all intense sun, with no items until actual quantities/weather are verified. Remaining priorities: complete more Pokémon effects (Psyduck/Meowth notes are already saved), reviewed game-card effects/distribution, then broader multiplayer/hosting/models/audio work.
