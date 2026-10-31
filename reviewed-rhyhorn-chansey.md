# Rhyhorn and Chansey source review — 2026-10-31

Root and an independent non-Astra source reader viewed the four existing S05 photographs. Exact Chinese, working English, HP, classification, command/weather icons, source filenames and SHA-256 hashes for all six faces are in `reviewed-rhyhorn-chansey.json`. No asset was downloaded. The printing remains unidentified.

| Group | Level/name | HP | Class | Trait | Moves |
|---|---|---:|---|---|---|
| Rhyhorn | 1 独角犀牛 | 3 | 攻击型 | 舍身 / Reckless | 落石 / Rock Throw, command, damage1 |
| Rhyhorn | 2 独角犀牛 | 4 | 攻击型 | 舍身 / Reckless | 岩崩 / Rock Slide, command, damage2 |
| Rhyhorn | 3 钻角犀兽 | 5 | 攻击型 | 舍身 / Reckless | 尖石攻击 / Stone Edge, command, damage3 |
| Chansey | 1 吉利蛋 | 3 | 支援型 | 治愈之心 / Healer | 撒娇 / Charm, rainy card, no printed damage |
| Chansey | 2 吉利蛋 | 4 | 支援型 | 治愈之心 / Healer | Charm; 生命水滴 / Life Dew, sunny card, no printed damage |
| Chansey | 3 吉利蛋 | 5 | 支援型 | 治愈之心 / Healer | 舍身冲撞 / Double-Edge, command, damage2; Life Dew |

Rhyhorn Lv1 source `37aa792489c5744b.webp`; Lv2/3 left/right `2ce6114721e23bda.webp`. Chansey Lv1 `ede6e13c73ae2b6e.webp`; Lv2/3 left/right `d03c99a886622585.webp`. All reside in `research-assets/douyin-7684572630280187855/`. Weather labels in brackets replace printed icons; they are not extra text printed on the cards.

Reckless is optional once during the trainer’s Play: this Pokémon loses a chosen amount of HP, then its trainer draws that amount. Booklet08 p10 explicitly separates HP loss from damage. Burn, Blaze, Guts, Defense, immunity, Shed Skin, Marvel Scale, damage-source/receiving traits and Helmet cannot modify or trigger from this loss. Booklet06 p06 still requires immediate fainting/rescue at HP<=0, deployment, elimination and victory.

All three rock moves print the same restriction: during the move’s resolution, only the trainer of the fainting Pokémon can use Potion. This is move text and survives trait suppression. The unresolved parent move includes nested Helmet damage; each rescue uses its current fainting Pokémon’s owner. Cleanup ends the restriction. This scope is an explicit reading of the printed timing, tested through saved resolution stacks.

Preview policies, separately from the source:

- The card prints no HP-loss upper bound. Accept a nonnegative safe integer whose addition to stored injuries remains safe, including loss beyond current HP. Zero spends the once-use. No current-HP cap or minimum1 is invented. These numeric/zero interpretations are recorded for later source refinement.
- Complete fainting first, then draw for the original trainer if still playing, even when a reserve replaced Rhyhorn. An eliminated trainer or immediate game result draws nothing. The face’s “then” and booklet’s exited-trainer rule inform this continuation policy.
- Draw only available actual cards under the existing finite-supply policy. The cost is never refunded for exhaustion. Shared gains allow a newly active Meowth’s Pickup after the full base batch.
- The once allowance follows the Pokémon instance through switching and evolution. Gas prevents new Reckless activation; the rock move restriction remains.
- Potion remains absent/unexecutable because its rescue clause is physically covered in the provided photograph. Rescue projection `canUsePotion` describes permission only, not card availability or an implemented healing action. It is false for other trainers during a rock move; rescue passes retain the established current-turn-first sequence.

Chansey’s Healer converts one actual sunny card (intense sun OR clear) into Potion during fainting settlement. The readable ordinary Potion heal2 does not establish its covered rescue amount. Therefore all three Chansey faces remain reference-only, including their moves: no partial generic command is enabled.

Charm costs one rainy card (heavy rain OR thunderstorm) and discards one other trainer’s hand card. Life Dew costs one sunny card, ignores distance, allows any number of Pokémon targets and heals each1; whether reserve targets are included needs separate review before implementation. Double-Edge optionally adds1 when dealing move damage, then the original damage source loses1HP after that damage settlement. Future work must preserve the optional damage timing, source instance and HP-loss distinction; zero-damage/aborted-settlement recoil needs an explicit policy. None of these pending choices is silently resolved by the reference catalogue.

All three Rhyhorn faces execute in combat preview, retaining full-retail `engineEligible:false`. Chansey’s three faces and all its moves remain `reference-only` with a visible dependency notice. Catalogue copies are byte-identical: 29 supported groups/87 faces; 30 effect-reviewed groups/90 faces. Ten groups still need source effect review; Chansey additionally waits for verified Potion rescue support.
