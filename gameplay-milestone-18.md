# Gastly and Magikarp gameplay milestone — 2026-10-29

The combat preview now supports 22 reviewed Pokémon groups / 66 level faces. Gastly, Haunter and Gengar implement Levitate, Lick, Shadow Ball, Cursed Body and Hex. Magikarp and both Gyarados levels implement Rattled, Splash, Moxie, Waterfall and Hyper Beam.

Levitate converts a real rainy hand card into Dodge while retaining its identity and weather for Keen Eye and Compound Eyes. Shadow Ball and Cursed Body reuse private indexed hand choices. Hyper Beam validates and discards its optional boost card before Moxie draws; Rattled skips only the discard phase and does not change the four-card hand limit.

The native UI exposes rainy Levitate responses, face-down Cursed Body choices and Hyper Beam's optional declaration discard. The accepted arena and centered three-level inspector are unchanged. Both catalogue copies are byte-identical and all 398 automated tests pass.
