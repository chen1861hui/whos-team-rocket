# Milestone22 — Rhyhorn HP loss and reviewed Chansey

Implementation commit9ee833f pushed to origin/codex/rhyhorn-chansey. Review: https://github.com/chen1861hui/whos-team-rocket/compare/main...codex/rhyhorn-chansey . No PR or merge created.

Rhyhorn can exchange a chosen amount of HP for real cards once per Pokémon instance/Play phase. Its native confirmation shows current HP, validates the integer, and warns when the choice causes fainting. Lethal choices resolve rescue, deployment and victory before a saved draw continuation. HP loss never enters damage modifiers, after-damage traits or damage-source rewards. Rock Throw/Rock Slide/Stone Edge pay actual commands and deal1/2/3 with normal defense. The rescue projection carries the printed owner-only Potion permission through nested effects.

Chansey’s exact three faces now appear in the native field guide and level modal with Healer, Charm, Life Dew and Double-Edge. The visible dependency notice explains that Potion’s covered rescue clause prevents complete execution. No Potion amount, retail quantity, partial Chansey attack or reserve-healing scope was guessed. See `reviewed-rhyhorn-chansey.md/json`.

**603/603 tests pass:** 553 baseline plus50 independent cases in `app/test/rhyhorn-chansey.test.js`. Cases cover real cards and finite supply, numeric safety, zero/over-current/lethal loss, once-use and trait suppression, damage bypass, reserve Pickup, no defeat reward for HP loss, elimination/immediate result, private draws, clocks/votes/disconnect, restart/exact retries, all rock moves and nested rescue restriction. Syntax/whitespace checks pass. All six source hashes match; source/public catalogue copies match; roster flags agree at29 supported groups/87 faces and30 effect-reviewed groups/90 faces.

Browser QA used isolated4174 room data outside Git, established through legal ready/identity/five-draw/two-choice/mandatory-draw setup. Four clients: source, target, third trainer and spectator. Checked HP5→3 and hand4→6; all5HP choice→three rescue passes→injured Squirtle reserve at2/3HP and hand4→9; Stone Edge caused3damage and target HP1→−2 before rescue; bilingual owner-only notice, native Chansey level3/reference gate, negative-value validation and wider readable numeric input. No inspected client warnings/errors. Main4173 restarted on current engine with existing saved rooms retained; QA server stopped after checks. No downloads or arena geometry/theme/camera/model changes; centered hover and identity-first setup preserved.

Evidence: `reckless-choice-preview.jpg`, `reckless-deployment-preview.jpg`, `rock-rescue-preview.jpg`, `chansey-reference-preview.jpg`. The HP input width was corrected after visual review. Screenshots were visually inspected.

Branch `codex/rhyhorn-chansey` starts from `9aa0bba` and retains all previous batches. No merge, hosting or repeated unavailable PR access attempt. Production remains six command/six Dodge per seat, all intense sun, without Potion/items or invented retail quantities.

Next source-order pair: Kangaskhan and Staryu, using existing S05 files `b72df440c83a1fa2.webp`, `ce3da1b1d2033d35.webp`, `b3d70427fb229ee1.webp`, `4c4ca1eb3c341f5f.webp`. Do not reacquire. Chansey is reviewed and blocked only from execution pending its dependency and documented targeting/timing policies.
