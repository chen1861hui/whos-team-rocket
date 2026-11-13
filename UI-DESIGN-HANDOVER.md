# Who’s Team Rocket? — UI design handover

## Current handoff · November 13, 2026

- [Gameplay and rule verification](GAMEPLAY-VERIFICATION-HANDOVER.md) covers the current playable baseline and the manual verification queue.
- [Fire and Grass Gym modeling](GYM-MODELING-HANDOVER.md) is the starting point for the separate modeling session. Review Fire first, then Grass.
- The Water Gym is the accepted visual reference. The home, lobby, opening, Pokédex, game flow, results and battle presentation have been updated. The notes below record the earlier UI handoff. The current lobby uses the 108-card Master Edition deck automatically.

## Earlier UI handoff

## Next phase after Water Gym approval

The user approved the Water Gym on November 13, 2026. Continue in the existing `C:/src/team-rocket-web` checkout on `codex/ui-flow`. The approved version includes modified and untracked files in this checkout. Review `git status --short --branch` before working from another checkout.

1. Start with the system screens. Suggested review order is Home (Host, Join, Watch), Lobby (room code, seats, readiness and settings), Identity and the five Poké Ball selection flow, then the Pokédex and results. Use the approved Water Gym as the reference for hierarchy, typography, deep blue panels and restrained gold accents. Review desktop and narrow layouts in both languages.
2. After the system screens are approved, redesign the Fire Gym and then the Grass Gym. Give each its own scenery and atmosphere, using the established battle controls, fixed-seat presentation, and visual feedback.

The [Water Gym handover](<C:/Users/pc/Documents/ChatGPT/Game/COASTAL-ARENA-HANDOVER/README.md>) contains the original composition references. The current [judgment reveal](<C:/src/team-rocket-web/output/playwright/coastal-arena/judgment-reveal/manual-judgment.webm>) and [event effects](<C:/src/team-rocket-web/output/playwright/coastal-arena/event-remake/mewtwo.webm>) show the approved direction in play.

Prepared November 10, 2026. Start in `C:/src/team-rocket-web` on `codex/ui-flow`. HEAD is `c86ef79` (counted Master Edition deck). The UI work is in the working tree, so resume in this checkout and read `git status --short --branch` and `git diff` before editing. If your session has a separate checkout, carry over the working-tree changes first. The existing [gameplay handover](HANDOVER-PROMPT.md) covers the rules, sources and earlier card work.

## Design brief

The user wants a substantial Pokémon-style redesign across screens. They explicitly rejected an earlier pass that carried over the same layout and changed mostly colors. Translate the references into screen structure, hierarchy, card interaction and match feedback. Show the user what changed visually before calling the next design pass complete.

| Reference | Apply it to this game |
|---|---|
| [Pokémon: Let’s Go, Pikachu! battle screen](https://interfaceingame.com/screenshots/pokemon-lets-go-pikachu-fight/) | Make Pokémon, HP and level easy to read. Give each decision a clear prompt and a strong primary action. |
| [Legends of Runeterra opponent-turn screen](https://interfaceingame.com/screenshots/legends-of-runeterra-mobile-enemy-turn/) | Put the arena, deck and hand in distinct places. Give turn ownership and reactions a consistent location. Adapt the layout to 3–6 trainers. |
| [Super Mario Party lobby](https://interfaceingame.com/games/super-mario-party/) | Use large trainer seats with clear ready and open states. Make the room code easy to find and copy. |
| [Andor espionage interfaces on HUDS+GUIS](https://www.hudsandguis.com/home/2026/andor-s2) | Use a dark dossier and red Rocket treatment for identity reveals. Carry the same typography and controls into the brighter screens. |

The title screen should remain a simple entry point with **Host**, **Join** and **Watch**. The user requested removal of the Battlefield Preview and Quick Match Guide from that page. The game supports English and Chinese. Retain reduced motion and the graphics fallback while evaluating new interactions.

## What is in the current draft

- **Lobby:** Gym choices are beside the ready and open trainer seats on desktop. The host can choose Fire, Water or Grass and save the choice. Fire has cracked basalt above a lava basin, Water has ripple tiles and cascades, and Grass has a woodland clearing edged with moss and wildflowers.
- **Opening:** Identity and partner selection take place over the 3D arena. A player flips a sealed identity card and then confirms. The Gym Leader card shows the theme’s 3D trainer and becomes public on confirmation. The player activates a ring to summon five private Poké Balls with primary type hints, then opens each ball individually. Pokémon stay in the opened slots as 3D models, with illustrations as a fallback. The left roster supports mouse-wheel browsing. The right panel shows levels, HP, abilities, and moves without opening a dialog. The game waits for every trainer to lock in one active Pokémon and one reserve.
- **Battle:** The 3D arena fills the match viewport. The turn progress stays on the left, and the draw and judgment pile sits to the right of the hand. Hand cards show their localized deck names, pixel art, weather, and a short effect summary. The Play phase adds two round controls for switching and finishing play. The switch icon uses the private reserve’s level. The camera follows move targets, and the defender gets their response controls. Pokémon grow at each card level, collapse while awaiting rescue, and leave the arena after a knockout. A surviving reserve enters by Poké Ball.
- **Art choices:** The arena uses textured 3D Pokémon and ten trainer models from [Pokémon: Let’s Go, Pikachu! / Eevee!](https://models.spriters-resource.com/nintendo_switch/pokemonletsgopikachueevee/). The trainer rigs have authored idle, command, brace, and defeat clips. The first public Growlithe or Chansey partner assigns Officer Jenny or Nurse Joy for the rest of the match. Their models came from the downloaded LGPE trainer archive and Nurse Joy ZIP, respectively.

## Where to work

| File | UI responsibility |
|---|---|
| `app/public/app.js` | Home, lobby, role flip, Pokémon selection, battle layout, trainer and hand trays, localization, and deal animation |
| `app/public/styles.css` | Base styles, home screen and shared colors and panel tokens |
| `app/public/battlefield.css` | Lobby, match opening, arena HUD, responsive layout and battle card styles. Contains older rules and later overrides, so check computed styles when changing layouts. |
| `app/public/battlefield.js` | 3D gym scenery, trainer models, leader portraits, cameras and projected seat positions |
| `app/public/battlefield-terrain.js` | Fire, Water and Grass terrain, with themed floor markings and ambient animation |
| `app/public/trainer-models/` | Ten skinned trainer GLBs with embedded textures and animation clips |
| `app/public/combat-ui.js` | Card and move dialogs, eligible-target highlights, response controls and results |
| `app/public/play-card-face.js` | Bilingual hand card summaries and artwork mappings. Pokémon and item sprites come from [PokéAPI Sprites](https://github.com/PokeAPI/sprites). |
| `app/server/store.js` and `app/test/selection.test.js` | Gym setting and public Gym Leader reveal timing. Preserve server authority, private hands, hidden roles and private reserves. |

## Preview and review

The local preview was running and healthy at [127.0.0.1:4178](http://127.0.0.1:4178/) at handover. If it has stopped, start it with Node 22 or later and these PowerShell commands. Use `npm.cmd ci` first if dependencies are missing.

```powershell
Set-Location 'C:/src/team-rocket-web/app'
$env:PORT = '4178'
npm.cmd start
```

Use three or more separate browser sessions to play a real match. Host a room, save the gym and deck settings, join from the other sessions, ready all seats, then start. Choose **Master Edition (108 cards)** in lobby settings for the retail deck. The basic deck is useful for reproducing a command and Dodge exchange.

The working draft passed 1,226 automated tests. Browser checks covered all three gyms through the opening and first draw, mobile Pokémon selection, and a six-seat match through draw, target selection and defender response. For further changes, repeat the affected flows in English and Chinese, at desktop and phone widths, including a spectator view. Check six-seat label spacing when items and statuses are present, and ensure response controls remain reachable above the hand.

### Latest screenshots

- [Lobby](<C:/Users/pc/Documents/ChatGPT/Game/outputs/match-table-redesign/lobby.png>)
- [Desktop battle](<C:/Users/pc/Documents/ChatGPT/Game/outputs/match-table-redesign/battle-desktop.png>)
- [Choose a target](<C:/Users/pc/Documents/ChatGPT/Game/outputs/match-table-redesign/choose-target.png>)
- [Mobile response](<C:/Users/pc/Documents/ChatGPT/Game/outputs/match-table-redesign/response-mobile.png>)
- [Fire Gym Leader reveal](<C:/Users/pc/Documents/ChatGPT/Game/outputs/gym-redesign/identity-fire.png>) and [Pokémon selection](<C:/Users/pc/Documents/ChatGPT/Game/outputs/gym-redesign/selection-mobile.png>)

The screenshots in `gym-redesign` predate the newest battle layout. Review the lobby, battle, and defender’s response together before making the next design decision. If the user wants a different direction, show contrasting layout sketches first so they can choose how the information and actions should be arranged.
