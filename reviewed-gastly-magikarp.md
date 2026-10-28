# Reviewed Gastly and Magikarp faces — 2026-10-29

Edition remains unidentified. Chinese text is visually transcribed from four saved S05 originals; English is a working UI translation. Names/HP were already reviewed in the selection roster. The engine fields remain `engineEligible: false` because this catalogue flag records full-retail completeness; the six faces are enabled only for the bounded `combat-preview` implementation.

## Gastly family

- **Gastly Lv.1, HP 3 — Levitate / 飘浮.** A heavy-rain or thunderstorm hand card may be used as Dodge. **Lick / 舌舔:** one command card, damage 1; after positive damage, a rainy-group judgment Paralyzes the target.
- **Haunter Lv.2, HP 3 — Levitate / 飘浮.** **Shadow Ball / 暗影球:** one command card, damage 2; after positive damage, a heavy-rain-only judgment discards one card from the target trainer's hand.
- **Gengar Lv.3, HP 4 — Cursed Body / 咒术之躯.** After receiving damage, its trainer may obtain one hand card from the damage source's trainer. **Hex / 祸不单行:** one command card, damage 3, increased by 1 when the target already has a special status.

## Magikarp family

- **Magikarp Lv.1, HP 3 — Rattled / 胆怯.** Skip the trainer's Discard phase. **Splash / 跃起:** one command card; targets itself and nothing happens. No damage numeral is printed.
- **Gyarados Lv.2, HP 4 — Moxie / 自信过度.** After using Take this! and choosing the target, draw one card. **Waterfall / 攀瀑:** one command card, damage 2; after positive damage, a thunderstorm judgment Flinches the target.
- **Gyarados Lv.3, HP 4 — Moxie / 自信过度.** **Hyper Beam / 破坏光线:** one command card, damage 3; when declaring it, optionally discard one hand card to increase this use's damage by 1.

## Provenance and bounded interpretations

| Faces | Saved original | SHA-256 | Position / ordinal |
|---|---|---|---|
| Gastly | `6ac040c2b49bb16b.webp` | `ac8bcd0934c941df0cb428aac376755abdec603c20ec3a33a457a5a50029f40f` | whole / 45 |
| Haunter, Gengar | `c92ef6b729134c2c.webp` | `da6c10968393a5a9bd25abdcd17b258ee634349b9b1c1be1c7a393171ef85924` | left, right / 46 |
| Magikarp | `947078209d187ff7.webp` | `947078209d187ff73c5b8d9a548f8d44a52a2d3c8979a5629392cd1c19d4925b` | whole / 69 |
| Gyarados Lv.2/Lv.3 | `ee7ea946e3c6ca97.webp` | `ee7ea946e3c6ca970a64311c1680f7a95ccf79195c75790a9a27d8e243a52091` | left, right / 70 |

All moves use the booklet-default once-per-Pokémon/move Play-phase limit and default single active target within range unless the face says otherwise. Levitate preserves the physical card's identity/kind/weather. Cursed Body is optional, has no source on source-free status damage, and self-source is treated as an outcome-neutral no-op. Moxie resolves after target selection and before defense. Hyper Beam's optional declaration discard precedes the Moxie draw. Rattled skips phase entry rather than changing the four-card hand limit.
