# Milestone28 — physical split tools, Full Heal and Rare Candy

2026-11-04 · branch codex/split-tools · based on cf80b68.

## Full Heal and Rare Candy — 2026-11-04 (current)

**925/925 tests pass** (875 baseline +50 independent split-tool tests). Full Heal cures a legal active/reserve status; Rare Candy raises any living trainer's level1/2 active by one, preserving injuries/status/markers/held item and existing turn restrictions. Both readable tool faces have no distance restriction. They use one actual physical split card: choosing either half consumes the entire pair once. Native bilingual confirmation shows both halves, exact legal targets and unavailable-effect reasons. Accepted arena/native cards/centered hover/setup remain preserved; no CSS or asset downloads.

Project C:\src\team-rocket-web, application app/. Branch codex/split-tools from cf80b68 retains prior work. Review: https://github.com/chen1861hui/whos-team-rocket/compare/main...codex/split-tools . Main4173 runs current code with saved rooms retained; isolated QA4174 stopped. No PR/merge/hosting or repeated unavailable PR-access attempt. Combat remains39 executable Pokémon groups/117 faces; all40 groups/120 faces reviewed. Chansey alone remains reference-only pending Potion's covered rescue wording. Production remains the explicitly labeled six command/six Dodge per seat, all intense sun; the new tool effects are tested using isolated real-card fixtures, not added with invented retail quantities.

See gameplay-milestone-28.md and reviewed-split-tools.md. P02/R06/R07 source hashes rechecked; mirrored catalogues unchanged and byte-identical. Source review corrected the provisional Nugget wording: it targets ONE TRAINER to draw2, with no transfer and no 'other' restriction. Nugget is now source-reviewed but unimplemented; Potion's full targeting/rescue words remain physically covered. Earlier counts below are historical.

### Current split-tool contracts

Actual cards use kind:'tool', toolType:'potion-full-heal' or 'rare-candy-nugget', one physical id/weather/name/zone. useTool {cardId,effect:'full-heal'|'rare-candy',targetId:trainerId,slot:'active'|'reserve'} is strict, own unblocked Play only; common authority/revision/retry/vote/response guards apply. Both matching physical halves leave hand together and enter discard once. Other weather payments/hand discards move the same physical card without executing a tool effect. No command/move/Power allowance, Dodge/Pressure window or damage/status-gain trigger is created.

self.battle.tools contains only recognized pairs actually held, with both alternative names/descriptions, unavailableReason where applicable, and safe targets:[{targetId,slot}]. Full Heal requires a living statused target; own/revealed reserves are allowed and remain reserve. Successful reserve targeting sets revealed under booklet07p08. Candidate generation skips an opposing unrevealed reserve BEFORE reading its status/identity: no supported source currently statuses one before it has been active/revealed. A future event that can status hidden reserves MUST extend privacy-safe target/reveal handling first. This is an implementation reachability bound, not a printed self-only/visible-only tool restriction.

Rare Candy requires living activeLv1/2; it changes level alone. HP follows existing maxHP minus unchanged injury count; no on-entry event, reserve swap, allowance reset or spending of optional turn-end evolution. Full Heal changes status alone, so existing Sleep/Confusion whole-turn restrictions and lost Flinch draws remain; curing Paralysis restores marker effectiveness but leaves independent Gas/protection state. Tools remain usable under Gas, Paralysis, Sleep/Confusion locks and exhausted Pokémon move/trait counters.

925 tests =875 baseline +50 new, no baseline edits. Three browser clients checked distant revealed-reserve cure, Aerodactyl1→2 preserving injury1/Burn (2/3→3/4HP), own Snorlax Paralysis cure at unchanged3/4HP with Power/Speed restored under Gas, entire pair consumption, English→Chinese cancel/reopen draft retention and spectator privacy. All three warning/error logs empty. Independent source and code audits found no concrete defects. Four saved evidence images in milestone28. QA scripts, data and synthetic credentials stay outside Git; main4173 saved rooms retained.

Next priorities: implement now-reviewed Nugget draw2 through the shared physical tool and card-gain/Pickup pipeline; review remaining saved play-card paragraphs. Resolve Potion only from actual unobscured evidence; ordinary heal2 does not establish rescue amount/permissions or unblock Chansey. Full retail card quantities/weather distribution remain unverified; do not invent them or repeat acquisition/Pokémon source discovery.

Evidence:

- split-tool-choice-preview.jpg: Chinese Rare Candy half selected, distant active target retained from English draft, Nugget exact readable description with unimplemented gate.
- rare-candy-result-preview.jpg: distant Aerodactyl level2, 3/4HP and Burn retained; both actual split cards have left the source hand after the earlier reserve cure.
- full-heal-choice-preview.jpg: Chinese Full Heal selected, Potion physically-covered gate and entire-card warning.
- full-heal-result-preview.jpg: source Snorlax3/4HP, Paralysis removed and both reinforcement markers effective; Gas remains.

Validation: npm.cmd test →925 pass/0 fail in27.7s; all five changed JS files pass node --check; git diff --check clean. Source P02/R06/R07 hashes match, public/source catalogues byte-match. No CSS/data/catalogue/deck/arena changes. Focused browser QA used an isolated four-trainer fixture plus spectator on4174, after legal identity→five unique draws→choose2→mandatory Draw. No live-room data was seeded or reset. The fixture deliberately carries status/injury/markers/used allowances/Gas so the tool effects are observable; it is not retail deck composition. Main4173 health returns ok:true.

An initial independent restart test compared pre-reconnect presence0 against an authorized retry refreshing presence. The test now reconnects before its retry checkpoint and asserts entire-room idempotency. Engine code was unchanged for this fixture correction.
