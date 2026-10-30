## Nidoran and Diglett — 2026-10-30 (current)

**442/442 tests pass. Combat supports 24 groups / 72 faces**, adding Nidoran♂/Nidorino/Nidoking and Diglett/Diglett/Dugtrio. Poison Point uses the original damage source and a non-intense-sun judgment. Double Kick resolves twice through the shared repeated-hit flow. Uninjured Horn Attack/Megahorn gain1 damage. Arena Trap pauses ordinary/effect switching for optional discard-or-cancel responses. Bulldoze/Earthquake remove one marker after positive damage; Earthquake supports two targets.

GitHub repository: https://github.com/chen1861hui/whos-team-rocket.git. This batch is developed on codex/nidoran-diglett from9f900f1. Preserve the accepted arena, native cards, centered level hover and identity-first unique setup. Production remains six command/six Dodge per seat, all intense sun, with no invented retail quantities. All24 reviewed groups execute;16 groups remain. See gameplay-milestone-19.md and reviewed-nidoran-diglett.md/json. Older counts and no-Git statements below are historical.

## Caterpie and Weedle — 2026-10-29 (current)

**385/385 tests pass. Combat supports 20 groups / 60 faces**, adding Caterpie/Metapod/Butterfree and Weedle/Kakuna/Beedrill. Shield Dust blocks new statuses; Shed Skin discards selected own hand cards before HP loss. Compound Eyes filters other trainers’ actual intense-sun Dodges. Butterfree has rainy Whirlwind and sunny Sleep Powder. Beedrill’s Sniper removes trainer and move range limits. Fury Attack publicly reveals four actual cards and resolves one hit plus one per sunny card, with marker cleanup after the whole card.

All 20 effect-reviewed groups execute; **20 remain**. Preserve the accepted arena, native cards, centered three-level hover and identity-first unique setup. Production stays six command/six Dodge per seat, all intense sun, with no items or guessed quantities. Sources and catalogue copies verified. See gameplay-milestone-17.md and reviewed-caterpie-weedle.md/json. Full pending Gastly/Magikarp transcripts are saved in pending-gastly-magikarp.md; they need root visual signoff and implementation. Earlier counts below are historical.

## Pidgey and Magnemite — 2026-10-29 (current)

**344/344 tests pass. Combat supports 18 groups / 54 faces**, adding Pidgey/Pidgeotto/Pidgeot and Magnemite/Magnemite/Magneton. Keen Eye changes other trainers’ real or Sand Veil Dodges into cumulative whole-move damage reduction. Receiving modifiers can be ordered by the target trainer. Analytic exchanges selected real hand cards up to current HP once per Pokémon instance/Play. Air Slash and electric commands use thunderstorm judgments; Thunder Wave discards a rainy hand card and applies paralysis unless judgment is intense sun.

All 18 effect-reviewed groups execute; **22 groups remain**. Source/public catalogue copies match, all six face hashes verified. Preserve accepted arena geometry, native cards, centered three-level hover and identity-first unique selection. Production remains six command/six Dodge per seat, all intense sun, no held items or invented quantities. See gameplay-milestone-16.md and reviewed-bird-magnet.md/json. Caterpie/Weedle source notes are saved for the next batch; no rediscovery is needed. Earlier counts below are historical.

# Team Rocket web

A local multiplayer adaptation of《宝可梦：谁是火箭队？》in progress. Project: `C:\src\team-rocket-web`.

## Run locally

Requires Node22+. From the app folder:

```powershell
cd C:\src\team-rocket-web\app
npm.cmd ci
npm.cmd start
```

Open http://127.0.0.1:4173 in separate tabs/profiles for players. Create a room, join by nickname/code, ready3–6 trainers, then Start game. Credentials are private per-tab; use the recovery flow to restore a seat. Spectators may join by code. No public hosting/tunnel has been configured.

## Current flow

1. View identities first; only the Gym Leader is public. Every seated trainer acknowledges before Pokémon are dealt.
2. Each trainer draws five cards, one click at a time, from the shared shuffled40-group deck, with no repeats between players. Choose an active and private reserve after all five are drawn.
3. Hover/focus a Pokémon card to compare three level cards centered on screen. Click the main card or a level card for full details; use the separate Choose footer to select partners. Active/reserve names and Field guide also open details. Cards use native arena styling and standalone artwork, never photographed card faces.
4. All trainers confirming starts draw→play→discard→end. Commands, Dodge, supported abilities, switching, optional level-up, rescue passes, reserve deployment and role results are automated within the supported slice. Required choices stay with the entitled player.

The accepted3D arena, stadium/gym/floating themes, table/overhead cameras and2D fallback remain intact. Pokémon model slots are still placeholders.

## Supported content and limits

- **Combat:16 groups /48 level faces** — Bulbasaur, Charmander, Squirtle, Pikachu, Sandshrew, Abra, Machop, Growlithe, Vulpix, Mankey, Slowpoke, Shellder, Dratini, Grimer, Psyduck and Meowth. Pikachu has thunderstorm paralysis and optional Static. Sandshrew has Sand Veil, heavy-rain poison and private hand discard/take effects. Abra adds Teleport, Synchronize and confusion; Slowpoke adds turn protection, flinch and private Future Sight ordering. Machop adds Guts, use-time reinforcement removal and guaranteed post-damage confusion. Growlithe adds Justified card sharing and Arcanine’s two-target Heat Wave. Vulpix adds global Drought judgment replacement and sunny-paid Will-O-Wisp. Mankey adds Defiant and two-target reinforcement removal; Rocky Helmet adds equipment and ordered retaliation. Shellder adds unlimited repeated move use, private hand cycling and final rainy judgment-card gain. Dratini adds optional Marvel Scale and mandatory Multiscale; Dragon Rage/Draco Meteor ignore markers and cannot be dodged. Grimer adds global Poison Touch status replacement and source-free Poison damage setting; Sludge Bomb/Toxic use their printed weather conditions. Psyduck adds Swift Swim range, after-damage marker removal, rainy confusion and temporary hand-card exile/return with owner-chosen turn-start ordering. Meowth adds Protect, centralized Pickup and private Pay Day distribution; Persian adds Limber and an independent Fake Out command. See `gameplay-milestone-15.md`.
- **Readable source text:16 groups /48 faces**, all supported in the preview. One held item, Rocky Helmet, is reviewed; other item text and quantities remain pending.
- **Selection:40 groups /120 faces** have reviewed form names and HP. All81 unique species artworks are mapped. Unimplemented effects remain marked pending; unsupported attackers/defenders fail closed. A random full-roster game is not yet a complete playable match.
- The game-card deck is explicitly a development fixture:6 command +6 Dodge per seat, all intense sun. This is not the original108-card distribution. Held items are exercised only in explicit test fixtures; the production deck has no items yet. Other game cards and complete Potion rescue healing remain pending. Printed80 physical Pokémon cards/40groups/120faces are separate from80 saved gallery photos.
- Response timers are optional. Optional responses may pass on expiry. Mandatory hand-card, deck-order, reinforcement, effect-order, turn-start-order and inspected-card distribution choices pause instead of choosing automatically. Offline required players and room votes pause decisions.
- Hands, candidates, undrawn Pokémon, unrevealed reserves and private hand-slot mappings are never projected to unauthorized players/spectators. Real completed results reveal roles/hands/reserves; abandoning returns to lobby without inventing a winner.
- No public hosting, bots, matchmaking, voice/chat, replay, actual Pokémon models or audio yet.

## Validation and sources

`npm.cmd test`: **310 passed**. Tests cover authority/privacy, retry/restart recovery, room lifecycle, identities/setup, clocks, switching/levels, damage/rescue/results and the new source-derived ability scenarios. New UI effects were checked in isolated deterministic local fixtures with English/Chinese clients; no full random-roster or remote playtest is claimed.

The9 supplied booklet photos,80 gallery photos and7 supplied posters stay in `research-assets/`. All names/HP have source hashes; exact effect text and narrow unknowns are in `reviewed-combat-spec.md`, `reviewed-next-pokemon.md`, `reviewed-pokemon-batch-3.md`, `reviewed-pokemon-batch-4.md`, `reviewed-grimer.md`, `reviewed-psyduck.md`, `reviewed-meowth.md` and `reviewed-playcard-spec.md`. Original photos are not public routes. Source/public catalogue JSON files match. See `continuation-checkpoint.md` for next work and `foundation-contract.md` for protocol details.
