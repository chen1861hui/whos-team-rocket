# 谁是火箭队 web game — discovery

Status: interviewing; implementation has not started.

## Confirmed user intent

- Plan a web version of 谁是火箭队 for later implementation.
- Include some 3D animation.
- Interview the user thoroughly about game modes, visual style, structure, assets, rules, and flows.
- Resolve decisions and ambiguities before declaring the plan ready.
- Confirmed game: 宝可梦：谁是火箭队？. User does not own a physical copy; source discovery is the assistant's responsibility.
- Exact original tabletop rules, HP, abilities, damage, and card quantities; entire original roster/deck required. User explicitly clarified that redesign permission applies only to card appearance. Target the most complete verifiable original retail edition, including evolution cards. Exact edition and promo inclusion remain unresolved.
- Private game for friends playing remotely on separate devices.
- Desktop target with independent per-player Simplified Chinese / English selection. Translate menus, cards, abilities, tooltips, and rules references.
- Master Duel / Duel Links inspired battle arena with cheerful Pokémon adventure styling and holographic Pokémon presentation.
- Prefer 3D cards and animated Pokémon; user explicitly accepts 3D Pokémon where available and 2D for the remainder.
- Redesigned readable card layout preferred to physical-card reproduction.
- First release: hosted internet play on Vercel or another suitable free platform. Local/WLAN/device hosting deferred until later. No paid subscription authorized; provider remains unselected.
- Website handles game rules and effect resolution; players make choices and draw ONE card per click. Drawing must remain constrained by the rule-defined entitlement.
- Support drag-and-drop card play with few confirmation dialogs. Releasing on a legal target commits immediately if all required choices are complete; otherwise collect those choices before commitment. Invalid drops cancel. Confirm ending the personal turn and other important actions; exact important-action list remains open.
- Separate configurable turn and response timers in lobby, both disabled by default. Confirmed presets when enabled: 60 seconds per turn and 20 seconds per response. Pause the turn clock during another player's response and blocking animations. User explicitly confirmed these after the earlier ambiguous "pl" reply.
- Timer expiry policy accepted: optional response auto-passes; turn ends after mandatory actions are resolved; unfinished mandatory choices pause and request input; disconnection pauses the required decision and its timer. Detailed nested-response timing still needs design.
- Last 10 seconds play Pokémon low-HP music for the acting player only. Background music and effects, with separate Music / Effects / Timer-warning volume controls, are confirmed. Exact track/source remains unselected.
- Preserve a disconnected player's seat/hand and pause when their decision is required. User expects disconnects to be rare. Transfer room management to a connected player when the owner disconnects, keeping the disconnected seat reserved. Permanent departure and room lifetime remain to be specified.
- "End the round" clarified as end of one's personal turn. Undo follows an official rule if one exists; otherwise only uncommitted selection/drag can be cancelled. Played/drawn cards are final. An official takeback rule has not been found.
- Eliminated players watch public state only; surviving hands and unrevealed identities remain hidden until match end. Spectators may join immediately with the room code, including mid-match; no owner approval required. Spectator limit remains a technical design choice.
- Full-color Pokémon remain visible and idle in the arena. Short attack/move animations and a larger evolution presentation. Mixed 3D/2D coverage accepted.
- Room owner selects the shared arena in the lobby from outdoor stadium, indoor gym, and floating fantasy arena.
- Support ordinary laptops and gaming PCs. Confirmed independent Auto / Low / Medium / High graphics and reduced-motion controls. Low uses 2D Pokémon and simpler effects; higher settings use available 3D assets with identical gameplay.
- User has played twice; group expertise is not established.
- Usually 4+ players, supporting officially allowed counts of the selected edition. Do not hard-code a range until verified.
- Nickname and private room link/code, without accounts. External Discord for conversation.
- One room at a time for friends in Malaysia and Singapore.
- User remembers receiving five Pokémon and keeping two, starting basic and evolving during play. They tentatively remember evolution after finishing a round. Treat this as a firsthand recollection requiring verification, not an authoritative rules specification.
- Include additional official beginner/simplified modes if verified, alongside the intended two-Pokémon evolution mode.
- Help scope: hover/enlarge cards, explain abilities/statuses, highlight legal targets, show current phase, searchable card/rules reference, and a complete rules guide. No guided practice/tutorial needed currently.
- Room controls accepted: owner changes settings before play, starts after everyone is ready, manages spectators, and can request ending an abandoned match. Details of the end-match request remain to be defined.
- End screen: winning side and full reveal of identities, remaining hands and reserve Pokémon after a completed match; then rematch with the same group or return to lobby. No statistics/history/replay requested.
- Public action log confirmed: played cards, targets, damage, statuses and evolution; protect private draw contents and all other unrevealed information.
- User selected A for response presentation: all rules-eligible responders receive a Respond/Pass window even without a suitable card. Do not auto-skip based on hidden holdings. Enabled response timers may still auto-pass on expiry. Official eligibility and response order remain governed by the verified rules.

## Research leads, not an authoritative rules specification

- The likely source game is 宝可梦：谁是火箭队？, a Pokémon hidden-role board game developed with 游卡.
- Public descriptions mention 道馆馆主, 道馆训练家, 挑战者, 火箭队手下 and Pokémon evolution.
- Secondary sources disagree about component counts. Exact edition, roster, deck composition, and role distribution must be verified from the chosen edition's rulebook and cards.
- Do not import 三国杀 rules based on similarities.

Sources inspected on 2026-10-25:

- Official announcement account: https://weibo.com/pokemoncn
- Product reporting: https://www.ali213.net/news/html/2026-7/1023129.html
- Component overview, incomplete rules: https://wiki.52poke.com/wiki/宝可梦：谁是火箭队？

## Interview sequence

1. Source edition and materials; fidelity; audience; play arrangement; automation; devices; initial visual direction.
2. Verified component inventory, setup, role secrecy, turn phases, action legality, targeting, responses, damage, statuses, evolution, elimination, victory precedence, and disputed interactions.
3. Modes, room lifecycle, joining, seats, readiness, selection, timers, communication, spectators, disconnections, host departure, rematches, and recovery.
4. Screen inventory and per-screen interactions; visual references; layout; 3D scope; camera; animation timing; sound; accessibility and mobile behavior.
5. Asset inventory and provenance; card text/data; art; models; rigs; animations; effects; audio; fonts; missing-asset plan.
6. First release scope and deferred features; technical constraints; hosting; budget; milestones; acceptance criteria.
7. Walk through normal and exceptional complete matches; resolve contradictions; confirm the final specification.

## Intended handoff

- Product specification and explicit release scope.
- Versioned rules and card/component catalogue with sources and unresolved issues.
- Game state model, action/response sequence, information visibility, and victory rules.
- Screen map, user flows, visual brief, and animation specification.
- Asset manifest with source, format, required variants, and readiness.
- Multiplayer and recovery behavior, implementation phases, and acceptance scenarios.

## Readiness gate

Do not claim complete understanding until the source rules and every included card are available or explicitly replaced by agreed custom rules; the user has settled the core play, visual, and scope decisions; and end-to-end scenarios reveal no unresolved implementation-critical ambiguity.

## Open decisions

User supplied an additional 29:39 unboxing/rules demonstration, https://www.bilibili.com/video/BV1R9tW6hEY3/. Sampled visible sections include a turn-phase diagram around 24:21, card close-ups and edited rule corrections. Useful for the flow; not yet reviewed in full or established as the definitive retail source. See source S04 in rules-evidence.md.

Core product direction is confirmed above. No framework, hosting provider, asset source, or exact edition has been selected. Remaining decisions include detailed nested-response behavior, exact low-HP audio source, detailed screen interactions, and performance targets. Room lifecycle choices below supersede earlier unresolved notes; the operational inactivity definition and End Room voting behavior are stated interpretations. Official rules, modes, and complete card/asset inventories still require source verification.

## Room and graphics decisions — round 8

- Same-browser seat recovery and a private recovery code for switching devices are sufficient; no owner-approval recovery step requested.
- No replacement player mid-match in v1. Owner requests abandonment and all remaining connected players agree; return to lobby with no winner.
- User explicitly requested separate End Game and End Room controls. End Game keeps the lobby/group; End Room closes it and invalidates entry/recovery. Applying the accepted agreement rule to End Room during an active match is a proposed consistent default, not a separately answered question.
- User set cleanup to seven hours with no action/game. Interpret as seven hours without meaningful player activity, not a hard seven-hour limit on an actively played match; idle presence/automatic events do not keep a room forever. This interpretation should be visible to the user.
- Independent graphics quality and reduced motion accepted. See flow-draft.md for behavior.

## Authenticated walkthrough update — round 7

- User signed in manually; full 14:42 playback and visible Chinese captions are now accessible. Earlier preview-only access notes below are historical.
- Video contains an early-prototype disclaimer. Prototype observations support five candidates/keep two, active plus concealed reserve, Gym Leader starting level 2 versus others level 1, two-card draw phase, and possible active-Pokémon level increase at end of personal turn. These are not final retail verification.
- See rules-evidence.md for timestamps, limitations and remaining rules blockers, and content-and-assets.md for the catalogue/asset preparation structure.
- User confirmed fixed arena with brief attack focus, player's hand below, all opponents still visible. In the following reply, user confirmed timer presets/pauses and drop-to-play commitment; see confirmed requirements above.
- No complete card catalogue, selected retail edition, verified asset collection, or implementation-ready rules engine specification yet.

## Research update — round 2

- Found a Bilibili listing titled official unboxing: https://www.bilibili.com/video/BV1szNQ6KEi2/. Search metadata is available, but direct page retrieval failed with HTTP 412. Video and card contents have NOT been inspected.
- Wiki overview lists 80 Pokémon cards and 108 game cards, plus a separate 三地鼠 接招吧！ promo. This is provisional component information, not a verified complete catalogue.
- A 酷乐潮玩 retailer post describes a 先机版 with 48 Pokémon cards and 108 game cards: https://m.weibo.cn/status/5338733219418100. This suggests an edition distinction; do not combine counts into one edition.
- Retail search listings mention 大师版, but no authoritative edition comparison has been obtained.
- Search surfaced a Tabletop Simulator mod listing allegedly including rules at https://www.ttclub.cc/tbmod/p3.html. The opened pagination page no longer contains that listing. Treat as an unverified lead, not acquired source material.
- No complete rulebook, verified full deck list, readable full card set, or usable animation/model asset collection acquired yet. Fidelity and asset completeness remain unresolved dependencies.

## Research update — round 3

- Primary Japanese edition overview: https://www.pokemon.co.jp/ex/omaroke/. It lists 4–6 players, 60 Pokémon cards, and 108 play cards. It explains setup, private roles with a public Gym Leader, choosing a Pokémon, drawing, rescue before elimination, and victory. This is NOT a verified Chinese-edition rules source.
- Japanese previews describe basic and advanced modes: https://www.4gamer.net/games/024/G102471/20261007003/. Mode equivalence with the Chinese retail edition remains unknown.
- Candidate 3D collections discovered: https://github.com/06wj/pokemon and https://github.com/pokemon-party/3d-pokemon. Read repository overviews only; no models acquired, no runtime/animation checks, no complete roster matching or reuse-term verification performed.
- Further Chinese rulebook searches did not produce a complete rulebook or full card catalogue. All prior source-completeness gaps remain open.

## Proposed directions — not yet accepted

- Use mixed 3D/2D Pokémon within a consistent arena presentation; inspect assets before committing model coverage.
- Never silently invent missing card effects or values. Original gameplay fidelity is now explicitly confirmed.
- Enforce legal actions and protect hidden information; define any correction controls separately from ordinary play.
- Investigate free multiplayer hosting only after player region, concurrency, persistence, and billing constraints are understood.

## Research update — round 4

- Targeted Chinese searches for five-card Pokémon selection, keeping two, evolution timing, and the manual did not yield a verifiable primary rules source.
- No new exact setup or evolution rule confirmed. Avoid interpreting the user's uncertain timing recollection as authorization for a house rule.
- Explained possible costs as hosting/storage/traffic, optional custom domain, and optional paid visual/audio assets. Free-hosting and free-asset targets proposed, but hard spending and billing-card constraints are still unanswered.

## Research update — round 5

- Used Context7 and current official documentation to compare Vercel and Cloudflare Durable Objects. See hosting-options.md.
- Current dedicated Vercel documentation supports native WebSockets in public beta on all plans; older search-indexed limits say the opposite. Prefer the current dedicated documentation. Duration limits and external shared state still matter.
- SQLite-backed Cloudflare Durable Objects support the Free plan and WebSockets. A free cloud-hosted room is a viable candidate, subject to end-to-end testing and usage measurement.
- Local WLAN and internet peer hosting are distinct: WLAN requires a reachable local network; remote browser peer hosting requires connection signaling and may require relay infrastructure.

## Research update — round 6: user walkthrough link

- User supplied https://www.bilibili.com/video/BV1UjK66LE2J/ for rules research.
- Web reader could not open it. Interactive browser opened the English-localized page successfully: 14:42, uploader 吃蛋挞的折棒, title displayed as "Thriving! Pokémon has also unlocked the Three Kingdoms Kill mode?".
- Observed a 30-second preview/login prompt and subtitles marked available after login. Only the initial preview was accessible; no full transcript, complete rules, or full card catalogue extracted.
- Attempt to open the sign-in flow was rejected by the browser site-safety policy, which named https://open.weixin.qq.com. This was not an Auto-review rejection or a user-denied permission. No alternate login route or bypass attempted.
- Kept the original walkthrough tab for user handoff and asked the user to sign in manually or choose continued research from other sources. Never request credentials in chat.
- Related page links discovered: gameplay introduction by 卓帅丶 (08:08), https://www.bilibili.com/video/BV1GeNv6vEt9/; gameplay preview by 新物集App (32:43), https://www.bilibili.com/video/BV1oVKG6CEMF/. Contents not yet inspected; account authenticity not independently verified.
- Searches for the three exact video IDs returned no indexed results. No game-rule uncertainty was resolved by this access attempt.
