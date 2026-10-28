# Gameplay milestone 3: ordinary switching and reviewed reference faces

Implemented and checked 2026-10-27. The accepted Three.js arena renderer, seating, cameras and themes are unchanged. Only the existing action tray gains a compact switching control. Combat remains unavailable.

## Source review

Root viewed original rulebook images 03, 05, 06, 07 and 08, and independently reviewed the six card photographs used for the nine-face transcription in `reviewed-combat-spec.md`. Chinese source text, English working translations, hashes, icon uncertainties and engine gates stay distinct. The booklet's exact printing and its compatibility with the Douyin photographs remain unidentified.

| Rule | Source reading | Implementation |
|---|---|---|
| Ordinary switching | Image 05 / printed p.5: “进行交替（限一次）”; Play actions have no required order | Current trainer only, during Play, once per phase; no hand-card cost |
| Zone transfer | Image 05 / p.5 supplement and image 06 / p.7: switch the two Pokémon zones and their attached state | Swap existing creature records; preserve levels, injuries, statuses and items if present |
| Reinforcement exception | Image 08 / p.11: “当一只出战宝可梦变成备战宝可梦，其强化指示物会被弃置。” | Clear outgoing `reinforcements`; do not clear all creature state |
| Reveal | Image 07 / p.8: an unrevealed reserve becoming active is revealed and its Lv.1 form found | Reveal the incoming partner. Initial fixture reserve is already stored internally at Lv.1 |
| Previously revealed reserve | No instruction to conceal an already revealed outgoing Pokémon again | Preserve public knowledge through a `revealed` flag; disclose only its public identity/level |
| Once-per-phase allowance | p.5 gives one ordinary switch in Play | `turn.switchUsed` survives refresh/retry/restart and resets on a new turn |

Reserve traits/moves/items/status effects remain inactive according to pp.8/11. This slice transfers existing state but does not enable these missing handlers, HP changes, defeat or sleep restrictions. Current fixtures cannot acquire those effects. Future combat must check defeated partners and turn-start sleep restrictions before ordinary switching; forced deployment is a different operation and must not consume this allowance.

## API and privacy

`switchPokemon` takes only the normal `{id, revision, type}` envelope. The server rejects payload-selected creatures, levels, limits or phase edits. It validates actor, phase, available partners, closure vote and use limit before committing. Costs/choices cannot be supplied by a client.

`turn.switchUsed: boolean` defaults false for legacy saves. Public `players[].reserve` is absent until that creature has been revealed; when present it contains only `{catalogueId, level}`. Public active Pokémon use the same explicit allowlist. Opponent hands, candidates, unrevealed reserve identities, credentials and future internal creature data remain excluded. Own private reserve state stays in the authorized self view.

The switch log announces the operation without dumping private data. The crew menu exposes revealed reserve identity/level to players and spectators, including late joiners. Confirmation warns that switching reveals the incoming partner. A confirmation from an earlier turn cannot commit a switch in a later turn. UI copy and source reference text support Chinese/English independently.

The existing turn clock keeps its deadline across a switch. Expiry never chooses a switch, and switching is rejected after expiry closes Play. End-turn level-up applies to whichever partner is active after switching. End Game clears the match's reveal state with the other game state.

## Reviewed catalogue subset

Three stable rows (Bulbasaur, Charmander and Squirtle) now contain nine photo-reviewed level faces with HP, trait names/text, move headings, command conditions, printed numerals, extra text and per-face filename/hash provenance. The field guide displays that information. Source/public catalogue copies are byte-identical. All these effects remain `unavailable` / `engineEligible:false`; physical quantities remain null. Other 54 preview faces stay draft. Source photos remain outside public assets.

The red/white flame symbol beside the fire-line numerals is recorded as unresolved. It is not an extra cost or automatic burn. Working English labels are translations, not evidence of an English printing.

## Validation actually completed

- 27 automated tests passed. Six new switching scenarios cover once-per-phase reset, reveal/late spectators, illegal actors/phases/payloads/votes, state transfer, retry/stale/restart/offline recovery, expiry and post-switch level-up. Seeded marker/item/status fields test transfer semantics only; users cannot obtain those effects yet.
- Three real browser clients: English trainer, Chinese trainer and English spectator. Canceling confirmation left state unchanged. Confirmed switching revealed Mankey and publicly retained Bulbasaur as reserve; the unswitched opponent's Dratini stayed hidden. Refresh retained the used switch and private hand.
- Completed required discards and optionally raised switched-in Mankey to Lv.2; Bulbasaur remained Lv.1 and turn passed. The Chinese trainer then switched Charmander to Dratini with Chinese confirmation and controls.
- Final inspected browser warning/error logs were empty. Syntax checks passed. Reference guide showed reviewed text and explicit unavailability.
- `gameplay-switch-preview.jpg` records the Chinese trainer's switch in the accepted stadium. No new hosted/network outage, physical HP/status or full-match validation is claimed.

## Next source-dependent slice

Use `reviewed-combat-spec.md` for command-user identity locks, per-creature/per-move limits, one matching weather-card payment for other moves, one defense per settlement, damage ordering and current-turn-first rescue. Full readable 接招吧！ / 快躲开！ / 伤药 faces and game-card weather/quantity inventory remain needed. None of the nine reviewed Pokémon lines is a generic ability-free attack fixture. Do not enable a guessed command/defense/potion deck or a damage engine with undefined lethal outcomes.
