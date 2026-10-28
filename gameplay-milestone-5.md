# Gameplay milestone 5 — arena identities and shared Pokémon selection

Date: 2026-10-28. Implements the user's requested identity-before-selection order and five random non-repeating Pokémon candidates in the accepted arena.

## Behavior and evidence

- Owner starts with 3–6 ready trainers. Everyone views/acknowledges their own identity; only Leader is public. No candidates are dealt before this barrier completes.
- A crypto-shuffled shared 40-group deck reserves five different groups per trainer. One click reveals one card; all five are required before selection. Choose exactly two: active first, reserve second. Unchosen groups return to the shared unused pool. Global reservations prevent repeats even if another trainer has already confirmed.
- Identity and selection render with the accepted battlefield, themes, cameras and local-seat placement. Five supplied-photo thumbnails and bilingual names/HP appear in a private bottom tray. Selected roles are marked on cards; confirmation remains in the arena while waiting for others.
- Spectators and opponents see draw/acknowledgement progress only, not candidates, future cards, deck order or another trainer's locked choices. Everyone confirming reveals active partners and starts the existing turn engine; unrevealed reserves remain private.
- Forty groups and 120 printed name/HP faces reviewed in `selection-roster.json`; 40 thumbnail derivatives explicitly allowlisted. Only starter effects execute. Other groups show pending effects, and attacks/defensive targets using them are unavailable.

## Verification

`npm.cmd test`: **62 passed, 0 failed**. New scenarios cover six seats / 30 disjoint candidate draws, all five required, invalid and cross-player choices, all-acknowledged barrier, private projections, one-click idempotence, restart preservation, different deals, insufficient content before role mutation, legacy no-repeat setup and fail-closed unsupported effects. Prior combat scenarios seed supported starter creatures explicitly after exercising valid setup; they do not represent random roster combat coverage.

Actual UI clients: Arena One (English), Arena Two (Chinese), Arena Three (English), Arena Watch (spectator). Room DM537F assigned Leader to Arena Two. Before the final acknowledgement no card control appeared. Arena One refreshed after Sandshrew/Staryu/Scyther were drawn and retained those three plus two backs. Final groups were One: Sandshrew/Staryu/Scyther/Charmander/Weedle; Two: Growlithe/Cubone/Nidoran male/Gastly/Squirtle; Three: Pidgey/Magnemite/Meowth/Jynx/Psyduck. All 15 were distinct and all photo images loaded. Spectator saw zero candidate cards and no Sandshrew/Staryu after One locked choices. Confirming all three reached turn 1 with public actives and private reserves. Checked trainer console warning/error lists were empty. No new full battle or remote/mobile playtest is claimed. Screenshot review at 1280×720 found and corrected clipped labels; another check corrected a duplicate translation key.

Evidence: `identity-arena-preview.jpg`, `pokemon-selection-arena-preview.jpg`. Server/client modules pass syntax checks. Both catalogue copies are byte-identical. All 120 face provenance hashes match, all 40 selection thumbnails decode, and all 96 research images decode with distinct byte hashes (80 gallery + 9 booklet + 7 supplied posters). Existing combat deck quantities remain development fixtures and random full-roster matches are not yet a complete playable rules slice.

## Card presentation update — 2026-10-28 (current)

User correction: do not display the photographed Pokémon cards directly. Selection now uses native HTML/CSS cards matching the accepted arena: cream/green surfaces, rust selection borders, standalone transparent base-form Pokémon portraits, readable names, three level/HP cells and active/reserve markers. The 40 standalone art assets came from the PokeAPI sprites official-artwork directory through a non-Astra Sol worker; exact URLs/hashes/dimensions are in `research-assets/pokemon-art-manifest.json`. This is presentation only; printed HP, identity-first order, shared unique deals and confirmation/privacy rules stay unchanged. Future source cards should likewise be presented through the game UI rather than full card-photo thumbnails.

`portraitImage` replaces `selectionImage` in mirrored catalogues. Only the 40 explicit PNG routes are allowlisted. Old photo derivatives are no longer referenced or served; research originals remain preserved. Verified all 40 PNG endpoints and an old card-photo 404, plus 62 passing regression tests. Actual arena browser review at 1280×720 checked all five portraits, names/HP, selection highlights and English/Chinese with no card overflow or console warnings/errors. Evidence: `pokemon-card-redesign-preview.jpg`; the previous selection screenshot is historical.

