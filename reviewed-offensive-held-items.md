# King’s Rock and Flame Orb

The supplied older item sheet O06 shows the full paragraphs, King’s Rock with a thunderstorm icon, and Flame Orb with an intense-sun icon. The recorded Master Edition viewing also observed a thunderstorm King’s Rock around 23:30. The O06 original is `research-assets/user-older-edition-2026-11-04/share_33ea1aae55bf09c2a708ecde60b1e38b.png`, SHA-256 `38da1271a818c3dca1556f0046b9e3675ba44b0f54eac4ec6f34c0a227ebd845`.

**King’s Rock** triggers when the holder’s move deals positive damage. It applies Flinch to the original target through the common status rules. **Flame Orb** triggers when the holder deals positive damage. A final intense-sun or clear judgment applies Burn to the original target. Damage with a Pokémon source can trigger Flame Orb even if the damage came from an event such as Rival’s Challenge. A replacement Pokémon never inherits the defeated Pokémon’s status effect.

The booklet’s simultaneous effect rule lets the source trainer order a move’s effect and the held item’s effect if both trigger. The chosen effect settles before the other, then the receiver’s effects begin. The existing one-status rule means this order can change the result. Drought can replace Flame Orb’s judgment. Shield Dust, Poison Touch, and Articuno still apply through the shared status pipeline. Equipment and loss follow the previously reviewed held-item rules.

The order prompt has no default selection. The engine tracks completion for each damage settlement and resumes the current effect after a judgment or a status response. The default preview deck remains the command and Dodge fixture. Tests supply actual held-item cards in isolated rooms. Retail quantities and weather distribution remain unverified.

Browser QA used three trainers and a spectator. A trainer equipped Flame Orb and chose it before Thunder Shock’s move effect. A clear judgment applied Burn. In a separate round the trainer equipped King’s Rock and applied Flinch after Scratch. The spectator could see the source order prompt while only the attacker received its controls.
