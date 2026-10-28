# Gameplay milestone 12 — Shellder and Dratini

2026-10-28. Combat now supports 13 groups / 39 faces. All 221 tests pass, including 29 new independent Sol tests in app/test/shell-dragon.test.js. There are 27 groups still missing complete effects. Full random-roster matches and the original 108-card distribution remain incomplete.

Shellder's Skill Link permits repeated moves with separate real command payments while retaining the command-user instance lock. Lv2 Spike Cannon offers a private discard-then-draw after positive damage. Lv3 Cloyster gains the actual final rainy judgment card after all Drought exchanges. Exact face text and provenance are in reviewed-pokemon-batch-4.md/json.

Dratini and Dragonair offer optional Marvel Scale before HP loss when statused and incoming damage exceeds 1. Dragonite's compulsory Multiscale caps positive damage while uninjured, including nested item damage. A common receive/commit pipeline now handles move, item and turn-start damage. Its saved amount belongs to the original Pokémon instance and resumes once after restart/retry.

Dragon Rage and two-target Draco Meteor ignore reinforcement range/bonus/cap and reject actual or virtual Dodge. Ordinary Power-on-use and Defense-after-card consumption remain; this lifecycle interpretation is explicitly documented. Source abilities and burn remain effective. Existing source-before-receiver effects, rescue, nested Helmet chains, immediate victory and hidden-card boundaries retain regression coverage.

## Verification

- Full regression: 221/221 pass. New 29 cases cover all six faces, repeated use versus switching/payment/status restrictions, private cycling, exact retries/restarts, optional timers/votes/disconnections, final judgment identity through multiple Drought responders, two-target sequencing, marker lifecycle, scales, source modifiers, self damage and saved nested Helmet continuations. Unsupported groups still fail closed.
- Browser QA used two isolated 4174 rooms after legal identity/draw/selection setup and explicit effect fixtures. No production rooms or deck randomness were seeded. Dragonair stayed 3/3 HP while offered incoming 2, accepted a reduction, then showed 2/3 HP. Cannon alone saw four private cycle choices; the other seat saw zero. Cycling left another command usable in the same Play phase.
- Chinese Draco Meteor confirmation offered two targets. The itemless Sandshrew defender held a Dodge but had zero Dodge and Sand Veil controls; Continue applied 2 damage despite Defense. The second full-HP Dragonite received 1 and ended 3/4 HP. All five gameplay clients had zero warning/error logs.
- The main 4173 field guide shows reviewed Dragonite Multiscale/Draco Meteor on its native level card with standalone art. The accepted arena, centered three-card hover, identity-first deal and partner-selection flow were preserved.
- Source/public catalogues match; all six effect-provenance hashes match local originals. Metadata: 13 supported/reviewed groups, 39 reviewed effect faces, one reviewed held item. All 40 groups/120 identity/HP faces remain selectable with matched artwork.

Evidence: marvel-scale-preview.jpg, spike-cannon-preview.jpg, draco-meteor-preview.jpg, dragonite-levels-preview.jpg. Main preview: http://127.0.0.1:4173/. Temporary QA server/data were cleaned after verification; the main preview tab is retained and the unmarked test tabs are temporary. Saved production rooms remain untouched.

## Remaining priorities

Continue complete source-backed Pokémon groups or independently reviewed game cards. Pending notes for already-inspected Grimer, Psyduck and Meowth are saved in pending-pokemon-review-notes.md; no gallery rediscovery is needed. Game-card quantities/weather distribution and Potion rescue wording remain unverified. Production still uses six command/six Dodge per seat, all intense sun, with no items. Hosting, cross-region play, models and audio remain later work.
