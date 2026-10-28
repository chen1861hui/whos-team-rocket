# Gameplay milestone 10 — Vulpix judgments

Date: 2026-10-28. **162 tests pass. Combat supports 10 groups / 30 faces.** There are 11 groups / 33 faces with reviewed effect text; Mankey remains reference-only. Thirty groups still need complete effects. The accepted arena, setup sequence, centered hover cards and native form artwork remain intact. No assets were downloaded.

## Source and behavior

Vulpix's source is reviewed-pokemon-batch-4.json/.md and the saved originals 3ce12ea7061280d5.webp and de760adc11d0ed85.webp. Root inspected these in the preceding review; a separate Sol audit directly verified both again. Hashes still match. Unresolved flame heading symbols remain observations, without invented costs or elemental rules.

Drought can replace any revealed judgment before the result takes effect. The player supplies one actual sunny hand card and receives the displaced card. Both intense sun and clear qualify; no turn cap is printed. Ember at Lv.1/2 deals 1 and Flamethrower at Lv.3 deals 2, with an intense-sun burn judgment after positive damage. Will-O-Wisp at Lv.2/3 pays one sunny card and has no damage numeral. Its judgment burns unless the result is heavy rain; thunderstorm succeeds.

## Saved judgment flow

startJudgment removes one actual top card and stores its responders, captured Pokémon instances and continuation privately. The public reveal contains name/weather/kind without a physical ID. All active, living Vulpix receive an optional response, even without a sunny card, so the existence of a window does not disclose holdings. Only the current actor receives its own eligible card IDs and labels.

Replacement removes the selected hand card, gives the currently displaced card to the actor and makes the replacement current. The final actual card enters discard after responses, then the original effect resumes. No copies are created and weather is not applied early.

The following are explicit implementation interpretations: current-turn-first seat order follows the general simultaneous-trainer rule; each Vulpix responds once per original reveal; a played replacement does not flip again; later responders receive the currently displaced card; final discard happens at judgment completion. The face does not enumerate every chain/zone/UI procedure. There is no cap across separate judgments. Duplicate-Vulpix test fixtures exercise ordering; the normal shared deck has only one group.

Continuations cover every existing caller: source burn/paralysis/confusion/flinch/poison, Static, Sand Veil, Chlorophyll, Rain Dish and Will-O-Wisp. Instance IDs and completion flags preserve rescue and after-damage ordering. Defeated targets do not transfer effects to incoming reserves. Failed Sand Veil restores its original defense ID, attempted flag and remaining response time; its saved deadline is null during Drought. Optional timeout passes, while offline players and votes pause. Retry/restart preserves the exact actor/card/continuation. Game reset and resolution cleanup clear private judgment state.

## Moves and interface

attack adds optional moveIndex, default 0, with strict validation. self.battle.moves exposes indexed conditions, targeting and structural availability; legacy fields remain. Will-O-Wisp discards exactly one sunny card of any kind before defense. It has a separate move lock, no damage, no Power consumption and no command-user lock. Dodge cancels the settlement while the cost stays paid. It does not trigger after-damage abilities or consume Defense. Existing command moves, including two-target Surf, keep their behavior.

The hand shows weather and qualifying Will-O-Wisp buttons. Target confirmation explains the payment. Drought displays the revealed weather and actor-only replacement choices or Pass. English/Chinese controls were checked. Browser QA found three buttons overflowing a card; compact spacing now keeps all controls inside the original tray. Long judgment panels can scroll. Arena geometry and hover positioning are preserved.

## Validation

- Full suite: 162 passed, zero failed. Twenty-nine independent Sol cases cover costs/indices/locks, weather/status distinctions, every continuation, card conservation, responder order, no recursion/cap, privacy/authority/stale fields, retries/restart/offline/votes/clocks, Heat Wave's separate target windows and nested Sand Veil restart. Previous 133 tests pass. The unsupported-roster regression fixture changed from Vulpix to Psyduck because Vulpix is now supported.
- Edited JavaScript parses. Catalogue copies match byte-for-byte: 10 enabled groups/30 faces and 11 reviewed groups/33 faces. Source hashes match. Raw source JSON remains review-only; public faces are combat-preview-only.
- Isolated browser fixtures completed legal setup before explicitly seeding species, levels, weather and deck. Main 4173 rooms and production randomness were untouched. All five gameplay clients had zero warnings/errors.
- Global Drought: another trainer's Ninetales replaced Venusaur's heavy-rain Chlorophyll judgment with Clear and obtained the actual rain card. Judging trainer/spectator had no replacement buttons; spectator had no hand cards.
- Will-O-Wisp: Ninetales paid one Clear Dodge, reducing its hand from 6 to 5. Raichu passed defense. Chinese Drought replaced heavy rain with Clear; Raichu remained 4/4 HP but became burned, with no Static window. The primary command was still available. Hand controls were measured inside the card after the layout fix.

Evidence: drought-judgment-preview.jpg shows the English Will-O-Wisp judgment after the layout fix; drought-judgment-zh-preview.jpg shows Chinese; will-o-wisp-result-preview.jpg shows the result. The main Field guide confirms all three enabled faces and payment text.

Remaining work includes Mankey/held items, thirty other groups, the full 108-card manifest/weather, other game cards/Potion rescue and hosting. The development deck remains six command/six Dodge per seat, all intense sun.
