## Articuno’s Protection — 2026-11-05 (current)

**1,189 tests passed** (1,141 baseline plus 48 Articuno cases). Articuno can cancel an event for one original target or cure a newly applied special status. Both modes have bilingual response controls. The active responder alone sees their eligible cards; the original effect resumes after the reaction.

Project: `C:/src/team-rocket-web`, application in `app/`. Review branch: `codex/articuno-protection`, based on `3f380e4`. The accepted arena, native cards, and identity-first Pokémon setup remain intact. The default command/Dodge test deck stays unchanged; Articuno is verified with actual cards in an isolated scenario that publicly enables the reaction rules. Retail deck quantities and weather distribution are still unverified.

See [milestone 34](gameplay-milestone-34.md) and the [Articuno specification](reviewed-articuno-protection.md). Next: implement the remaining source-backed events (Rival’s Challenge, Berry Harvest, and Farfetch’d’s Prank), then reinforcement tools, remaining held items, and Revive. Use the saved sources and keep earlier checkpoints as history.

## Moltres and Zapdos events — 2026-11-05 (historical)

**1,141/1,141 tests pass** (1,099 baseline +42 independent cases). Moltres's Trial / 火焰鸟的试炼 resolves other original actives in next-trainer-first order: play one actual command response or receive2 from external Moltres. Zapdos's Punishment / 闪电鸟的惩戒 judges all original actives from next trainer through user last; final thunderstorm deals current target-level damage from external Zapdos. Shared receiving effects/rescue/Synchronize, strict payloads and bilingual native controls remain. All40 Pokémon groups/120 faces and6 event types execute in combat preview.

Project C:\src\team-rocket-web, app app/. Branch codex/legendary-bird-events fromc8b2aed. Review: https://github.com/chen1861hui/whos-team-rocket/compare/main...codex/legendary-bird-events . Main4173 restarted with current code/saved rooms retained; isolated QA4174 stopped. No PR/merge/hosting. Accepted arena/native cards/centered hover/identity-first unique setup preserved. No CSS, asset downloads or production deck changes.

Read gameplay-milestone-33.md and reviewed-legendary-bird-events.md/json. Articuno's Protection is fully source-reviewed and reference-only: implement its shared before-one-event-target cancellation and after-actual-status-gain cure windows coherently across all applicable effects. Do not request the source again, create an ordinary Play cure or infer a counter-counter rule from other games. Retail quantity/weather gates remain false; production still six command/six Dodge per seat, all intense sun. Next: Articuno reaction pipeline, then other remaining events, reinforcement tools, held items and Revive. Earlier checkpoints below are historical.

## Jigglypuff and Mr. Mime events — 2026-11-05 (historical)

**1,099/1,099 tests pass** (1,055 baseline +44 independent cases). Jigglypuff's Performance targets one active, makes its trainer judge, and applies Sleep on a real result other than thunderstorm through Drought/status-immunity/Poison Touch rules. Mr. Mime's Trick targets another active within card range and obtains one hidden hand card OR its actual held item into hand, including Pickup and item-loss Defiant. Native single-target/effect dialogs retain bilingual drafts; private card selection shows only shuffled backs. All40 Pokémon groups/120 faces remain supported;4 event types now execute in combat preview.

Project C:\src\team-rocket-web, app app/. Branch codex/jigglypuff-mime-events from806cc63. Review: https://github.com/chen1861hui/whos-team-rocket/compare/main...codex/jigglypuff-mime-events . Main4173 restarted with current code/saved rooms retained; isolated QA4174 stopped. No PR/merge/hosting. Accepted arena/native cards/centered hover/setup preserved; no CSS, downloads or production deck changes.

Read gameplay-milestone-32.md and reviewed-jigglypuff-mime.md/json. Master Jiggly explicitly prints active; older O03 omits 出战, a recorded wording difference. Both have no printed Dodge response; Early Bird blocks targeting unless suppressed. Chlorophyll now grants its printed trainer card-range permission as well as instance move range, including switching and legacy saved grants. Retail quantity/weather gates remain false; production still six command/six Dodge per seat, all intense sun, with cards tested in isolated real-card fixtures. Next: saved legendary-bird events, other remaining events, reinforcement tools, held items and Revive. Retail name/pairing × weather counts remain unverified. Do not repeat source discovery or request the supplied collection again. Earlier checkpoints below are historical.

## Mewtwo and Mew events — 2026-11-05 (historical)

**1,055/1,055 tests pass** (1,010 baseline +45 independent event cases). Mewtwo's Threat / 超梦的威压 targets every other original active in next-trainer-first order, accepts an actual Dodge response or deals2 from external Mewtwo, and preserves receiving effects/rescue/Synchronize. Mew's Blessing / 梦幻的祝福 resolves all original actives self-first; each target trainer must choose capped heal2 or +1level belowLv3. Both have native bilingual confirmation, ordered targets and response controls. All40 Pokémon groups/120 faces remain combat-preview supported.

Project C:\src\team-rocket-web, app app/. Branch codex/mew-events from58a4050. Review: https://github.com/chen1861hui/whos-team-rocket/compare/main...codex/mew-events . Main4173 runs current code with saved rooms retained; isolated QA4174 stopped. Accepted arena/native cards/centered hover/identity-first unique setup preserved. No CSS, downloads, production deck quantities or weather distribution changes. No PR/merge/hosting or repeated unavailable PR access attempt.

Read gameplay-milestone-31.md and reviewed-mew-events.md/json. O03 plus saved Master video24:16/24:23 resolve the old P03 source gap; pending-mewtwo-threat.md is historical. Actual-Dodge-only event response and original-active capture are explicit conservative policies, not additional printed clauses. Mew heal remains legal at fullHP; Lv3 gets heal only. Retail engineEligible gates remain false. Production still uses six command/six Dodge per seat, all intense sun; these events are verified using isolated real-card fixtures. Next cards: remaining saved events (including Jigglypuff/Mr. Mime and the legendary birds), reinforcement tools, remaining held items and Revive. Verify each paragraph and integrate coherent tested slices without repeating discovery. Retail name/pairing × weather copy counts remain the concrete manifest gap. Earlier checkpoints below are historical.

## Potion rescue and Chansey — 2026-11-04 (historical)

**1,010/1,010 tests pass. All 40 reviewed Pokémon groups / 120 faces now execute in combat preview.** Potion restores2 to an injured living active/reserve during Play, or to the original fainting active during rescue. Both Potion/Full Heal and Potion/Revive physical pairings are recognized; Revive itself remains unimplemented. Chansey has active Healer (including self-rescue at0HP), Charm, Life Dew and Lv3 Double-Edge. Negative HP, repeated cards by the same rescue actor, immediate recovery atHP>=1, Gas and nested Rhyhorn restrictions are covered.

Project C:\src\team-rocket-web, app app/. Branch codex/potion-chansey from5309fc8 includes the older-edition and Bilibili source commits. Review: https://github.com/chen1861hui/whos-team-rocket/compare/main...codex/potion-chansey . Main4173 restarted with current code and saved rooms retained; isolated QA4174 stopped. No PR/merge/hosting. Preserve accepted arena, native cards, centered hover and identity-first shared unique setup. No CSS, new asset downloads or production deck changes.

See reviewed-potion-chansey.md and gameplay-milestone-30.md. O03 and the Master Edition video22:10 now confirm Potion rescue2; do not request those sources again. Life Dew uses an explicit conservative policy: active Pokémon only, at least one target; its printed any-number wording does not explicitly resolve reserve/zero targets. Retail engineEligible gates remain false; production stays six command/six Dodge per seat, all intense sun. Physical card/weather quantities remain unverified. Next: implement the already-preserved Mewtwo/Mew events using reviewed-older-edition-supplement.md and bilibili-BV1juYi6UEkv-source.md; replace obsolete covered-text uncertainty in pending-mewtwo-threat.md before implementation. Earlier checkpoints below are historical.

## Nugget and trainer-targeted tools — 2026-11-04 (historical)

**965/965 tests pass** (925 baseline +40 independent Nugget cases). Nugget now lets any living trainer, including self or a distant trainer, draw2 through the shared actual-card gain/Pickup path. Both Rare Candy/Nugget alternatives are executable; choosing one consumes the entire physical split card once. Its trainer-only native selector sends no Pokémon slot and preserves bilingual cancel/reopen drafts. Accepted arena/native cards/centered hover/identity-first unique setup remain preserved; no CSS/assets/deck changes.

Project C:\src\team-rocket-web, application app/. Branch codex/nugget from3ce3fad retains prior work. Review: https://github.com/chen1861hui/whos-team-rocket/compare/main...codex/nugget . Main4173 runs current code with saved rooms retained; isolated QA4174 stopped. No PR/merge/hosting or repeated unavailable PR-access attempt. Combat remains39 supported Pokémon groups/117 faces; all40 groups/120 faces reviewed. Chansey still depends on Potion's covered rescue wording. Production remains six command/six Dodge per seat, all intense sun; tools are exercised through isolated real-card fixtures until retail quantities/weather distribution are verified.

See gameplay-milestone-29.md and reviewed-split-tools.md. Nugget targets one trainer and draws cards; its physical card is discarded after resolution, not given to that trainer. Potion alone stays gated in the two reviewed physical tool pairs. Next: event-card handling, starting with the saved Mewtwo's Threat source queue; narrow transcription uncertainty stays explicit in pending-mewtwo-threat.md. Do not repeat acquisition or Pokémon discovery. Earlier counts below are historical.

### Current Nugget contracts

useTool {cardId,effect:'nugget',targetId} omits slot entirely. Descriptor targeting:'trainer', targets:[{targetId}] permits living trainers including self/distant and excludes spectators/eliminated seats. Any active/reserve/null slot is rejected atomically; existing Full Heal/Rare Candy Pokémon targets remain unchanged. Common Play/authority/pending vote/decision/revision/exact retry guards remain. No Pokémon identity/state/reveal, command/move allowance, Power or ordinary Draw count is changed.

The actual Rare Candy/Nugget card leaves the actor's hand before the effect. It stays outside draw/discard circulation until the base two-card batch AND any immediate Pickup complete, then goes to discard once with its identity, weather and alternative metadata retained. It cannot supply its own ordinary or Pickup draw. Use shared drawBattleCards reason nugget with min(2, actual draw+discard supply): finite0/1 consumes the card and supplies0/1 without a fabricated card or refund. This shortage behavior is an explicit existing effect-draw policy, not printed extra Nugget text. Logs report actual base count.

The base batch lands before normal once-per-instance/global-turn MeowthLv1/2 Pickup. Self-target during Play qualifies; reserve/Lv3/defeated/Gas/used-trigger exclusions remain. No gain0 means no trigger; an exhausted bonus spends its trigger while preserving the base gain. No immediate hand-limit discard outside the ordinary Discard phase. Generic weather payment/discard of this pair does not activate Nugget. Private drawn identities remain recipient-only.

965 tests pass, including40new and50existing split-tool cases; two old expectations were updated for enabled Nugget and rejected old slot payload. No engine defects or fixture corrections were needed. Independent code audit checked actual-card conservation and0–4 supply across ordinary/self-Meowth recipients. Three browser clients checked distant2+Pickup1, self2+Pickup1, exactly2supply with no recycled tool bonus, Candy→Nugget target reset, Chinese→English cancel/reopen draft and spectator privacy; all warning/error logs empty. Evidence: nugget-choice-preview.jpg, nugget-pickup-preview.jpg, nugget-self-preview.jpg. QA data/scripts and synthetic credentials remain outside Git.

## Full Heal and Rare Candy — 2026-11-04 (historical)

**925/925 tests pass** (875 baseline +50 independent split-tool tests). Full Heal cures a legal active/reserve status; Rare Candy raises any living trainer's level1/2 active by one, preserving injuries/status/markers/held item and existing turn restrictions. Both readable tool faces have no distance restriction. They use one actual physical split card: choosing either half consumes the entire pair once. Native bilingual confirmation shows both halves, exact legal targets and unavailable-effect reasons. Accepted arena/native cards/centered hover/setup remain preserved; no CSS or asset downloads.

Project C:\src\team-rocket-web, application app/. Branch codex/split-tools from cf80b68 retains prior work. Review: https://github.com/chen1861hui/whos-team-rocket/compare/main...codex/split-tools . Main4173 runs current code with saved rooms retained; isolated QA4174 stopped. No PR/merge/hosting or repeated unavailable PR-access attempt. Combat remains39 executable Pokémon groups/117 faces; all40 groups/120 faces reviewed. Chansey alone remains reference-only pending Potion's covered rescue wording. Production remains the explicitly labeled six command/six Dodge per seat, all intense sun; the new tool effects are tested using isolated real-card fixtures, not added with invented retail quantities.

See gameplay-milestone-28.md and reviewed-split-tools.md. P02/R06/R07 source hashes rechecked; mirrored catalogues unchanged and byte-identical. Source review corrected the provisional Nugget wording: it targets ONE TRAINER to draw2, with no transfer and no 'other' restriction. Nugget is now source-reviewed but unimplemented; Potion's full targeting/rescue words remain physically covered. Earlier counts below are historical.

### Current split-tool contracts

Actual cards use kind:'tool', toolType:'potion-full-heal' or 'rare-candy-nugget', one physical id/weather/name/zone. useTool {cardId,effect:'full-heal'|'rare-candy',targetId:trainerId,slot:'active'|'reserve'} is strict, own unblocked Play only; common authority/revision/retry/vote/response guards apply. Both matching physical halves leave hand together and enter discard once. Other weather payments/hand discards move the same physical card without executing a tool effect. No command/move/Power allowance, Dodge/Pressure window or damage/status-gain trigger is created.

self.battle.tools contains only recognized pairs actually held, with both alternative names/descriptions, unavailableReason where applicable, and safe targets:[{targetId,slot}]. Full Heal requires a living statused target; own/revealed reserves are allowed and remain reserve. Successful reserve targeting sets revealed under booklet07p08. Candidate generation skips an opposing unrevealed reserve BEFORE reading its status/identity: no supported source currently statuses one before it has been active/revealed. A future event that can status hidden reserves MUST extend privacy-safe target/reveal handling first. This is an implementation reachability bound, not a printed self-only/visible-only tool restriction.

Rare Candy requires living activeLv1/2; it changes level alone. HP follows existing maxHP minus unchanged injury count; no on-entry event, reserve swap, allowance reset or spending of optional turn-end evolution. Full Heal changes status alone, so existing Sleep/Confusion whole-turn restrictions and lost Flinch draws remain; curing Paralysis restores marker effectiveness but leaves independent Gas/protection state. Tools remain usable under Gas, Paralysis, Sleep/Confusion locks and exhausted Pokémon move/trait counters.

925 tests =875 baseline +50 new, no baseline edits. Three browser clients checked distant revealed-reserve cure, Aerodactyl1→2 preserving injury1/Burn (2/3→3/4HP), own Snorlax Paralysis cure at unchanged3/4HP with Power/Speed restored under Gas, entire pair consumption, English→Chinese cancel/reopen draft retention and spectator privacy. All three warning/error logs empty. Independent source and code audits found no concrete defects. Four saved evidence images in milestone28. QA scripts, data and synthetic credentials stay outside Git; main4173 saved rooms retained.

Next priorities: implement now-reviewed Nugget draw2 through the shared physical tool and card-gain/Pickup pipeline; review remaining saved play-card paragraphs. Resolve Potion only from actual unobscured evidence; ordinary heal2 does not establish rescue amount/permissions or unblock Chansey. Full retail card quantities/weather distribution remain unverified; do not invent them or repeat acquisition/Pokémon source discovery.

## Aerodactyl and Snorlax — 2026-11-04 (historical)

**875/875 tests pass. Combat supports 39 groups / 117 faces; all 40 groups / 120 faces have reviewed effects.** Aerodactyl has Pressure's two private discard choices, rainy Bite Flinch and optional boosted Hyper Beam. Snorlax replaces its held item's effect with Gluttony's own-turn-end healing, has rainy Bite and sunny Body Slam. Chansey alone remains reviewed reference-only pending Potion's covered rescue wording; the Pokémon source-review queue is complete.

Project: C:\src\team-rocket-web, app app/. Branch codex/aerodactyl-snorlax from 1c85e0c retains prior work. Repository: https://github.com/chen1861hui/whos-team-rocket.git . Main4173 runs current code with saved rooms retained; isolated QA4174 stopped. Preserve the accepted arena, native cards, centered hover and identity-first shared unique setup. Production stays six command/six Dodge per seat, all intense sun; no invented retail quantities/items/events/Potion. No merge, hosting or repeated unavailable PR-access attempt. See gameplay-milestone-27.md and reviewed-aerodactyl-snorlax.md/json. Earlier counts below are historical.

## Lapras and Porygon — 2026-11-03 (historical)

**824/824 tests pass. Combat supports 37 groups / 111 faces; effects reviewed for 38 groups / 114 faces.** Lapras has mandatory Water Absorb weather judgments after receiving damage, Ice Shard/Ice Beam Speed removal and Freeze-Dry's temporary target reinforcement suppression followed by removal after damage. Porygon has private Download instead of ordinary Draw, single-judgment Tri Attack and sunny Lock-On preventing actual/virtual Dodge for the current global turn. Chansey remains reviewed reference-only pending Potion's covered rescue text.

Project: C:\src\team-rocket-web, app app/. Branch codex/lapras-porygon from 52c730c retains prior work. Repository: https://github.com/chen1861hui/whos-team-rocket.git . Main4173 runs current code with saved rooms retained; isolated QA4174 stopped. Preserve the accepted arena, native cards, centered hover and identity-first shared unique setup. Production stays six command/six Dodge per seat, all intense sun; no invented retail quantities/items/events/Potion. No merge, hosting or repeated unavailable PR-access attempt. See gameplay-milestone-26.md and reviewed-lapras-porygon.md/json. Earlier counts below are historical.

## Electabuzz and Tauros — 2026-11-02 (historical)

**773/773 tests pass. Combat supports 35 groups / 105 faces; effects reviewed for 36 groups / 108 faces.** Electabuzz has sleep immunity, a private whole-Draw replacement that chooses two actual top cards from three, and thunderstorm paralysis commands including two-target Electroweb. Tauros has mandatory Intimidate on initial entry, successful switching and forced deployment, sunny Body Slam paralysis, and two-target Earthquake reinforcement removal. Chansey remains reviewed reference-only pending Potion's covered rescue text.

Project: C:\src\team-rocket-web, app app/. Branch codex/electabuzz-tauros from a2653d8 retains prior work. Repository: https://github.com/chen1861hui/whos-team-rocket.git . Main4173 restarted with saved rooms retained; isolated QA4174 stopped. Preserve the accepted arena, native cards, centered hover and identity-first shared unique setup. Production stays six command/six Dodge per seat, all intense sun; no invented retail quantities/items/events/Potion. No merge, hosting or repeated unavailable PR-access attempt. See gameplay-milestone-25.md and reviewed-electabuzz-tauros.md/json. Earlier counts below are historical.

## Scyther and Jynx — 2026-11-02 (historical)

**716/716 tests pass. Combat supports33 groups /99 faces; effects reviewed for34 groups /102 faces.** Scyther has Technician inheritance, stacked Power, Fury Cutter’s dealing-stage grant, X-Scissor’s same-settlement two-Dodge requirement and optional U-turn switching after whole-move cleanup. Jynx has private Preparation-phase Forewarn top/bottom arrangement, non-damaging Sweet Kiss discard/draw and sunny Light Screen Defense. Chansey remains reviewed reference-only pending Potion’s covered rescue text.

Branch codex/scyther-jynx from2f9952e retains all prior work. Repo https://github.com/chen1861hui/whos-team-rocket.git . No merge/hosting/repeated PR-access attempt. Preserve accepted arena/native cards/centered hover/identity-first shared unique setup. Production stays six command/six Dodge per seat, all intense sun; no invented retail quantities/items/events/Potion. See gameplay-milestone-24.md and reviewed-scyther-jynx.md/json. Earlier counts below are historical.

## Kangaskhan and Staryu — 2026-10-31 (historical)

**654/654 tests pass. Combat supports31 groups /93 faces; effects reviewed for32 groups /96 faces.** Kangaskhan has Fake Out Flinch, optional Double-Edge boost with source HP loss after receiving effects, Reversal’s strict current-HP comparison and exact Early Bird named-event permissions. Staryu/Starmie have optional Illuminate during Draw, Water Gun, intense-sun Confusion judgment and two-target Psybeam. Chansey remains reviewed reference-only pending Potion’s covered rescue text.

Branch codex/kangaskhan-staryu from219c71f retains all prior work. Repo https://github.com/chen1861hui/whos-team-rocket.git . No merge/hosting/repeated PR-access attempt. Preserve accepted arena/native cards/centered hover/identity-first shared unique setup. Production stays six command/six Dodge per seat, all intense sun; no items/Potion/events or invented quantities. See gameplay-milestone-23.md and reviewed-kangaskhan-staryu.md/json. Earlier counts below are historical.

## Rhyhorn and reviewed Chansey — 2026-10-31 (historical)

**603/603 tests pass. Combat supports29 groups /87 faces; effects reviewed for30 groups /90 faces.** Rhyhorn’s Reckless loses chosen HP, resolves fainting first if needed, then draws actual cards for its surviving trainer. HP loss bypasses damage effects. Rock Throw/Rock Slide/Stone Edge deal1/2/3 and preserve their owner-only Potion permission through nested resolution. Chansey’s three complete source-reviewed faces are reference-only because Healer depends on Potion’s still-covered rescue clause; its readable ordinary heal2 does not establish rescue healing.

Branch codex/rhyhorn-chansey from9aa0bba retains all prior work. Repo https://github.com/chen1861hui/whos-team-rocket.git . No merge/hosting/repeated PR-access attempt. Preserve accepted arena/native cards/centered hover/identity-first shared unique setup. Production stays six command/six Dodge per seat, all intense sun; no Potion/items or invented retail quantities. See gameplay-milestone-22.md and reviewed-rhyhorn-chansey.md/json. Earlier counts below are historical.

## Cubone and Koffing — 2026-10-31 (historical)

**553/553 tests pass. Combat supports 28 groups / 84 faces**, adding Cubone/Cubone/Marowak and Koffing/Koffing/Weezing. Battle Armor discards a real card after damage to gain Defense. Bone Rush allows repeated paid command uses; Bonemerang offers one paid extra settlement after the first finishes. Neutralizing Gas suppresses all Pokémon traits of a chosen trainer until the current turn ends, including after reserve switching. Sludge Bomb and two-target Sludge Wave poison only on heavy-rain judgment after positive damage.

Branch codex/cubone-koffing from f7d217c retains the previous batches. Repository: https://github.com/chen1861hui/whos-team-rocket.git. No PR or merge; the documented integration403/browser-sign-in limit remains, with no repeated attempt. Preserve the accepted arena, native cards, centered three-level hover and identity-first unique setup. Production remains six command/six Dodge per seat, all intense sun; full retail quantities are unverified. All28 reviewed groups execute;12 remain. See gameplay-milestone-21.md and reviewed-cubone-koffing.md/json. Earlier counts below are historical.

## Clefairy and Exeggcute — 2026-10-30 (historical)

**492/492 tests pass. Combat supports 26 groups / 78 faces**, adding Clefairy/Clefairy/Clefable and Exeggcute/Exeggcute/Exeggutor. Cute Charm redirects a command target with one real intense-sun hand card before defense. Moonlight chooses heal2 or cure; Helping Hand draws2 through shared card gains. Harvest optionally draws1 in End after Discard. Leech Seed heals its source after damage, Seed Bomb deals2, and Psychic deals3 with intense-sun confusion judgment. Empty judgments now continue without inventing a weather result.

GitHub: https://github.com/chen1861hui/whos-team-rocket.git. Branch codex/clefairy-exeggcute from1a5b1f3, retaining the previous Nidoran/Diglett work. No merge. PR creation remains unavailable under the documented GitHub integration403/sign-in limitation; no repeat attempt this batch. Preserve the accepted arena, native cards, centered three-level hover and identity-first unique setup. Production remains six command/six Dodge per seat, all intense sun, with no invented retail quantities. All26 reviewed groups execute;14 groups remain. See gameplay-milestone-20.md and reviewed-clefairy-exeggcute.md/json. Older counts below are historical.

## Nidoran and Diglett — 2026-10-30 (historical)

**442/442 tests pass. Combat supports 24 groups / 72 faces**, adding Nidoran♂/Nidorino/Nidoking and Diglett/Diglett/Dugtrio. Poison Point uses the original damage source and a non-intense-sun judgment. Double Kick resolves twice through the shared repeated-hit flow. Uninjured Horn Attack/Megahorn gain1 damage. Arena Trap pauses ordinary/effect switching for optional discard-or-cancel responses. Bulldoze/Earthquake remove one marker after positive damage; Earthquake supports two targets.

GitHub repository: https://github.com/chen1861hui/whos-team-rocket.git. This batch is developed on codex/nidoran-diglett from9f900f1. Preserve the accepted arena, native cards, centered level hover and identity-first unique setup. Production remains six command/six Dodge per seat, all intense sun, with no invented retail quantities. All24 reviewed groups execute;16 groups remain. See gameplay-milestone-19.md and reviewed-nidoran-diglett.md/json. Older counts and no-Git statements below are historical.

## Caterpie and Weedle — 2026-10-29 (current)

**385/385 tests pass. Combat supports 20 groups / 60 faces**, adding Caterpie/Metapod/Butterfree and Weedle/Kakuna/Beedrill. Shield Dust blocks new statuses; Shed Skin discards selected own hand cards before HP loss. Compound Eyes filters other trainers’ actual intense-sun Dodges. Butterfree has rainy Whirlwind and sunny Sleep Powder. Beedrill’s Sniper removes trainer and move range limits. Fury Attack publicly reveals four actual cards and resolves one hit plus one per sunny card, with marker cleanup after the whole card.

All 20 effect-reviewed groups execute; **20 remain**. Preserve the accepted arena, native cards, centered three-level hover and identity-first unique setup. Production stays six command/six Dodge per seat, all intense sun, with no items or guessed quantities. Sources and catalogue copies verified. See gameplay-milestone-17.md and reviewed-caterpie-weedle.md/json. Full pending Gastly/Magikarp transcripts are saved in pending-gastly-magikarp.md; they need root visual signoff and implementation. Earlier counts below are historical.

## Pidgey and Magnemite — 2026-10-29 (current)

**344/344 tests pass. Combat supports 18 groups / 54 faces**, adding Pidgey/Pidgeotto/Pidgeot and Magnemite/Magnemite/Magneton. Keen Eye changes other trainers’ real or Sand Veil Dodges into cumulative whole-move damage reduction. Receiving modifiers can be ordered by the target trainer. Analytic exchanges selected real hand cards up to current HP once per Pokémon instance/Play. Air Slash and electric commands use thunderstorm judgments; Thunder Wave discards a rainy hand card and applies paralysis unless judgment is intense sun.

All 18 effect-reviewed groups execute; **22 groups remain**. Source/public catalogue copies match, all six face hashes verified. Preserve accepted arena geometry, native cards, centered three-level hover and identity-first unique selection. Production remains six command/six Dodge per seat, all intense sun, no held items or invented quantities. See gameplay-milestone-16.md and reviewed-bird-magnet.md/json. Caterpie/Weedle source notes are saved for the next batch; no rediscovery is needed. Earlier counts below are historical.

# Foundation contract — 2026-10-26

## Future Sight / Synchronize / effect-switch contract — 2026-10-28 (current)

`respondBattle` adds optional `choice:'trait'|'pass'` for `kind:'foresee'` or `kind:'synchronize'`, and mandatory `kind:'reorder',choice:'order',order:[indices]`. Future Sight opens at move use, before any target defense. Opt-in inspects up to3 available cards; if short, shuffled discard is placed under the existing top cards first, with no invented cards if the total pool is smaller. The cards stay in the draw pile and counts do not drop. Only the actor receives `pendingBattle.cards` with index/name/weather/kind; private IDs stay in `resolution.scryCardIds`. Committing an exact permutation (next draw first) changes only those top cards, then opens normal defense. Empty inspection goes directly to defense. Mandatory reorder expiry pauses, while optional inspection expiry passes. Mapping/order survive persistence and exact retries; malformed/stale/unauthorized inputs reject before mutation.

Synchronize opens after positive damage's source effects and only for the surviving active Abra with an eligible causing command/event still available. `resolution.cardClaimedBy` records the single physical transfer. Final settlement discards only an unclaimed causing card. No source card is fabricated for poison/confusion. Receiving abilities do not transfer to a replacement reserve.

Teleport is a command move with no printed damage numeral and self-only targets. A normal Dodge can cancel it. On settlement draw1, then switch to a living reserve without changing `turn.switchUsed`; the command-user identity remains the original Abra. It cannot bypass a trainer's explicit switch prohibition while a living reserve exists. Existing switch state/removal/reveal rules apply.

Slowpoke's positive outside-own-turn damage sets `turn.damageImmunityIds`; later damage to that same instance is0 for the rest of that turn, suppressing after-damage effects/judgments. New turns clear protection. Public active Pokémon add `damageProtected`; this does not prevent HP-loss effects or invent reserve damage immunity. The current preview damage paths respect it; future event/item damage must use the same turn-aware damage gate.

## Expanded Pokémon response contract — 2026-10-28 (current)

`respondBattle` accepts `decisionId,choice,cardId?,handIndex?` inside the normal validated/idempotent envelope. Defense allows pass, actual Dodge, or `choice:'trait'` when public `canTrait` enables Sand Veil. Sand Veil requires no held item and allows one judgment per settlement. Success in intense-sun/clear ends only that settlement; failure marks attempted, keeps the same ID and response clock, and permits a real Dodge or pass. Static opens a separate optional `kind:'static'` decision after the source's after-damage effects, owned by the damaged active Pikachu's trainer. Trait or pass is accepted with no card/index payload; a judgment other than intense sun paralyzes the actual source if eligible. Rescues remain pass-only in this deck.

SandshrewLv.2/Lv.3 positive-damage effects open `kind:'hand'`, actor=source trainer, target=affected Pokémon's trainer, `effect:'discard'|'take'`, `choiceCount`. Only `choice:'card',handIndex` is legal; no pass or cardId. A shuffled persisted private ID mapping makes each blind slot stable. `publicBattleDecision` projects `{index}` choices only to the actor; if actor owns the targeted hand, name/weather/kind are also visible. Spectators and other trainers receive counts only. Resolution resumes after the source effect without repeating damage, judgment or command payment. Timer expiry sets mandatory pause rather than choosing. Invalid indices/payloads/stale slots fail before mutation; exact retries spend/transfer once. No new held items or card quantities are inferred.

## Identity and shared Pokémon setup contract — 2026-10-28 (current)

This extension supersedes the fixed-three combat setup below. `startBattlePreview` (labelled Start game in the UI) requires the owner and 3–6 ready seats, validates capacity for five unique groups per seat, assigns roles, then enters `status:'identity'`. `acknowledgeIdentity` accepts only the action envelope and is seated-player-only. Only after every trainer acknowledges does the server reserve five disjoint groups per trainer and enter `status:'setup'`. `drawPokemon` reveals exactly one reserved candidate to its owner per accepted click. A sixth draw fails; exact retries do not draw again. Undrawn queues and unused deck order are never projected.

`selectPokemon {activeId,reserveId}` requires all five drawn, two distinct own candidates and no prior selection. Unchosen three return to the unused shared pool; all candidate allocations were reserved before anyone could return cards, so later draws cannot repeat them. All trainers finishing starts the existing combat-preview turn engine. Opponents' selected actives remain concealed until this common transition; reserves stay private until revealed by existing rules. Own locked partners remain visible to self. Public setup fields are acknowledgement and draw counts only; self receives own role, revealed candidates and `pokemonDrawRemaining`. Match cleanup clears all queues/deck/acknowledgements. Saved state preserves reservations and draws across restart.

`pokemon-deal.js` owns crypto Fisher–Yates shuffling and disjoint allocation. The legacy foundation start remains a test API only and now also allocates five without repeats. Selection/name/HP eligibility does not imply implemented effects. Unsupported attackers and defensive targets fail closed. See `gameplay-milestone-5.md` and `app/test/selection.test.js`.

## Combat-preview extension — 2026-10-27 (current)

The authoritative contract now includes `startBattlePreview` (owner, 3–6 ready seats), `attack {cardId,targetIds}`, `respondBattle {decisionId,choice:'pass'|'dodge',cardId?}`, `useTrait`, and `returnToLobby` after `status:'finished'`. See `gameplay-milestone-4.md`. This separate development scenario openly uses three reviewed groups and 6 command/6 dodge test cards per seat; these are not asserted retail setup/quantities.

Battle views add `gameMode:'combat-preview'`, public `scenario`, `pendingBattle`, deck/discard counts and `result`. Active/revealed Pokémon expose identity, level, HP/maxHP, status/defeat and public reinforcement only. Self receives its own role and server-computed legal actions; unknown opponent roles, hands/reserves and deck order stay private. On a real completed result only, all player roles/hands/reserves disclose. `pendingBattle` has public decision ID/actor/target/type/clock, never opponent holdings. Turn pauses with `pausedReason:'response'`; response clocks are now enforced and recover across restart. Exact retries remain idempotent. Foundation rooms keep their original behavior.

## Switching extension — 2026-10-27 (current)

This and the turn-engine extension below supersede the historical foundation boundaries.

- `switchPokemon` accepts only the normal action envelope. It requires the acting seated trainer, Play, both partners, no closing vote and an unused ordinary switch. It swaps existing Pokémon records, clears outgoing reinforcement, reveals the incoming partner and retains outgoing public knowledge. It does not consume a hand card or reset the clock.
- Public `turn.switchUsed` is false at each new turn and defaults false for legacy saves. It persists through retries/reconnect/restart.
- Public `players[].reserve` is absent for unrevealed reserves; revealed reserves expose only `{catalogueId,level}`. Active projections explicitly allowlist those same two fields. Private self reserve state remains authorized only for its own player.
- End-turn level-up follows the active partner after switching. Expiry never switches automatically. Match closure clears reveal state. Combat/status/defeat handlers remain unavailable; this slice operates in the existing fixture game.
- Nine photo-reviewed faces are available as public reference text with provenance and `engineEligible:false`, and are mirrored between catalogue copies. No playable effects or deck quantities were inferred.

See `gameplay-milestone-3.md` and `reviewed-combat-spec.md` for exact source pages, tests, limitations and next combat gates.

## Turn-engine extension — 2026-10-27

This extension supersedes the legacy turn/timer details below. The arena renderer now uses Three.js; server state remains independent of rendering.

Projected `turn` adds `phase: 'draw' | 'play' | 'discard' | 'end'` and `clock: null | { remainingMs, deadlineAt, pausedReason, expired }`. `deadlineAt` is an epoch-millisecond deadline while running and null while paused. `pausedReason` is null, `disconnected`, `vote` or `mandatory`. The public view also carries `serverNow` for client countdown synchronization. It is not a client-controlled source of authority.

- The second entitled draw enters `play`.
- `finishPlay` is legal only for the current player during `play`; it enters `discard` if the hand exceeds four, otherwise `end`.
- Excess discards are legal only during `discard`. The last required discard enters `end`.
- `endTurn {levelUp?: boolean}` is legal only during `end`, after all required choices. Default false; true raises the active partner exactly one level, rejecting requests above level 3. The photographed rulebook page 5 supplies optional wording. Reserve/state fields stay unchanged; damage and other ending effects are not implemented. Automatic timeout passes without level-up. Other ending triggers and victory remain pending.
- A configured turn clock runs on the server, pauses for a disconnected required player or closing vote, and preserves a saved remainder across restart. At expiry it skips optional play, waits for mandatory draw/discard choices and advances after those choices resolve.
- Automatic clock transitions never refresh `lastActionAt`. Exact action retries remain idempotent. A timeout that changes the revision can require the client to refresh before resubmitting a new action.
- Response seconds remain a stored preference until actual response windows are implemented. The client displays this limitation.

See `gameplay-milestone-2.md` for rationale and `foundation-validation.md` for verified behavior. The following sections retain the initial milestone contract as historical context.

User authorizes implementation with missing content left as placeholders. This milestone is a locally runnable multiplayer foundation, not a full rules-complete game or hosted release. No guessed abilities, game outcomes or official player counts. A development session supports 2–6 seats explicitly for testing; retail limits remain evidence-dependent.

## Ownership

- Root: integration, roadmap, README, validation and review.
- Server agent: `app/server/`, `app/test/`, `app/package.json`, `app/.gitignore`. Node ESM built-ins, no dependencies.
- UI agent: `app/public/index.html`, `app/public/app.js`, `app/public/styles.css`. Plain ES modules/CSS; no build dependencies.
- Content agent: `app/content/catalogue.json`, `app/public/catalogue.json` (same public-safe content), `content-backlog.md`. No ability invention; no remote assets.

## HTTP contract

`POST /api/rooms {nickname}` or `POST /api/rooms/:code/join {nickname,spectator:false}` returns `{code,token,playerId,view}`. Token is a bearer credential, generated by server. Spectators get their own credential. Nickname alone is never recovery. `GET /api/rooms/:code` with `Authorization: Bearer <token>` returns `{view}`; use 1.5-second polling. `POST /api/rooms/:code/actions` with same bearer and `{id,revision,type,...payload}` returns `{view}`. Action ids deduplicate; stale revisions fail 409 with `{error,code}`. Errors `{error,code}`; never expose raw errors/paths/secrets. `GET /api/health` returns `{ok:true}`.

View shape (only this projected state leaves the service):

```
{code,revision,status:'lobby'|'setup'|'playing'|'closed',ownerId,selfId,
 settings:{arena:'stadium'|'gym'|'floating',turnSeconds:0,responseSeconds:0},
 players:[{id,nickname,ready,connected,spectator,handCount,active:null|{catalogueId,level},reserveCount,setupComplete}],
 self:{spectator,hand:[{id,kind:'placeholder',name:{zh,en}}],candidates:[catalogueId],reserve:null|{catalogueId,level}},
 turn:null|{playerId,drawRemaining,number},
 log:[{id,text:{zh,en}}],
 pendingVote:null|{kind:'endGame'|'endRoom',requestedBy,approvedIds,requiredIds},
 lastActionAt,expiresAt,
 foundation:true}
```

Never send opponents' candidates/hands/reserve IDs, credentials, deck order or private roles. No roles in this foundation: role/winner rules are pending. Content catalogue is public reference, but no secret selections in responses.

Actions:
- `ready {ready:boolean}` lobby player only
- `settings {arena,turnSeconds,responseSeconds}` owner lobby only; 0 disables, allowed durations5–600. Timers saved/displayed only for milestone1; UI clearly marks enforcement pending.
- `start` owner, >=2 and <=6 players all ready. Deal 5 unique candidates per player from catalogue; repeats across players permitted only as explicitly marked foundation fixture (not real deck quantities). No deck-quantity assertion.
- `selectPokemon {activeId,reserveId}` choose2distinct own candidates, basic level1; when all selected enter playing, each gets4 unplayable placeholder hand cards, first seatedplayer acts, drawRemaining2. These are provisional S04-based setup fixtures, not final identity rules.
- `draw` current player, exactly1 and consumes entitlement. Append placeholder fixture card. Reject excess draws; no action-card effects implemented.
- `discard {cardId}` own turn, after drawing; if above4 permits discard until4. No arbitrary discard otherwise.
- `endTurn` own turn after mandatory draws and <=4 cards; cycle next player, resetdraw2. NO evolution yet: known timing contradictions remain explicitly pending. Public log must disclose no private card IDs.
- `requestEndGame` / `requestEndRoom` owner. During setup/playing creates unanimous connected seated-player vote; owner autoapproves. Lobby endRoom closes immediately. `approveEnd` / `rejectEnd`. EndGame returns to lobby and clears game private data without revealing. Closed rooms reject future joins/recovery.

Server persistence: write room state atomically to `app/.data/` (ignored); credentials stored privately. 7-hour inactivity expiry based on accepted user actions, NOT polls/heartbeats. Track connection via poll timestamp, owner-transfer after disconnect grace; required disconnected turns cannot be skipped. Bind localhost default. Static public/ only; never expose content/server/.data. Bound request size and validate all action inputs.

## UI contract

Polished desktop battle arena with cheerful Pokémon colors, dark navy panels, warm yellow accents; CSS perspective cards/flips, persistent abstract creature silhouettes/projection pedestals as clearly labeled asset placeholders. No pretend 3D model or copyrighted asset downloads. Entry → lobby → private pick5keep2 → arena; spectator views; bilingual personal preferences; legal button states; endturn and endroom confirmation; catalogue dialog and evidence-aware rules help. Owner arena selector, personal graphics/reducedmotion controls; all display copy bilingual. Store credential per tab/session to support multi-client testing; explicit private recovery credential workflow. Display foundation banner explaining missing combat/evolution/win logic. No fake multiplayer, fake responses or simulated winners.

## Machop reinforcement extension — 2026-10-28

Mandatory pendingBattle.kind:'reinforcement' adds public reinforcements:['power'|'defense'|'speed'] with unique values. actorId is the move user, targetId is the trainer whose active marker is removed. respondBattle accepts {decisionId,choice:'reinforcement',reinforcement:<kind>} and no cardId/handIndex/order. Exactly one current target marker is removed after validating original active instance; then defense opens. No-marker use skips this decision. The chosen marker remains discarded if the later move settlement is Dodged. Source Power is consumed at command use first. No pass/automatic timeout choice. Recovery, retries, offline/vote pauses and stale validation match other mandatory decisions. This enables only MachopLv1/2 single-target use-time removal; future multi-target effects require an ordered use-time queue.

## Growlithe extension — 2026-10-28

giveCards {cardIds:[ownrealIDs],recipientId:otherlivingtrainer,targetIds?:[commandtargetIDs]} is ownPlay/Justified-only, once per trainerPlay. Require1ormoredistinctheldcards. No targetIds on partial gift; all-hand gift requires an available move and legal1–maxTargets target list before any mutation. Exactcards transfer privately; publiccountonly. All-hand gift starts resolution.virtualCommand:true,card:null through common command settlement, preserves sourcePower/movelocks, and cannot create a Synchronize-eligible physicalcard. Recipient can use receivedcards immediately for responses. Paralysis prevents weatherlessvirtualcommands; partialsharing remains legal if1card stays. self.battle adds canGive,giveCommandAvailable,giveRecipientIds. room.turn.justifiedUsed resets at newtrainerturn and persists across switching/restart. Spectators/otherplayers get no new hand disclosures.

## Vulpix judgment/multiple-move extension — 2026-10-28

attack adds optionalmoveIndex(default0,strictinteger). self.battle.moves contains indexedname/condition/value/canUse/legalTargetIds/maxTargets; legacycanCommand/move fields retained. VulpixLv2/3index1 paysoneactualsunnycard ofanykind todiscard beforedefense; tracksseparatemovelock andnocmduser/Power. No damage, burnunlessfinaljudgmentheavyrain.

room.judgment isprivate persistedcard/actorIDs+instances/index/continuation/judgeID. pendingBattle.kind=judgment publicly reveals judgmentCard:{name,weather,kind} withoutID. Onlyactorgets replacementCards ownsunnycardIDs/labels. respondBattle acceptschoice:replace,cardId orpass. Actualcurrentcardgoestoactor; replacementbecomescurrent; finalcarddiscardsafterallresponses. AllactiveVulpix getwindowregardlessholdings. Current-turn-firstresponseorder, onceeach peroriginalreveal/norecursiveplayedreplacement are documentedinterpretations. Optionalexpiry/offline/votes/restart/retries followexistingcontract. SandVeilresumessameoriginaldefenseID/attemptflags/remainingclock afterfailedfinaljudgment. Clearinggame/resolution clearsjudgment. No privatecontinuation/actororder/physicaljudgmentID projected.

## Held items and Mankey extension — 2026-10-28

equipItem {cardId,slot:'active'|'reserve'} moves one reviewed held-item card from own hand to an own undefeated slot during Play. Replacement discards the old actual card. Active Mankey loss opens optional kind:'defiant'; trait draws two then grants current-turn no-limit, pass grants neither. self.handLimit is 4 or null; shared handLimit returns 4/Infinity for store checks. room.turn.noHandLimitIds resets each global turn. No generic unequip.

Public item stubs contain itemType/name/weather, never physical IDs or hidden reserve records. Squirtle suppression captures target instance IDs for the entire move and nested contexts; ownership is retained. room.resolutionStack is private persisted parent damage state. Helmet creates item-channel damage and full nested rescue/defeat handling. Same-holder simultaneous effects open mandatory kind:'effects', effects:[names], respond choice:'effect',effect:<name>. No pass/automatic ordering. Immediate victory/reset clears stack and judgments while conserving cards. Mankey Lv.3 queues reinforcement choices for each marked target before first defense.


## Shellder and Dratini extension — 2026-10-28

Shellder bypasses per-move count only. pending kind:'cycle' exposes own cards only to its actor; choice:'cycle',cardId discards then draws, pass does neither. Final Icicle Spear rainy judgment card is gained by continuation owner after all Drought responders; it is never also discarded or replaced by a fresh draw.

receiveDamage/commitDamage share saved pre-HP decisions across move/item/turn-start channels. Optional kind:'scales', trait:'marvel-scale' has public incoming damage; trait subtracts1 from saved resolution.incomingDamage, pass keeps original amount. Mandatory Multiscale caps positive damage at1 while uninjured in computeDamage. No zero-damage creation. Exact instances, restart, retry, clocks and nested parent events retain their authority/privacy guarantees.

Dragon Rage/Meteor snapshot ignoresReinforcements:true; computeDamage reinforcements:false suppresses Power bonus/Defense cap and move legality ignores Speed. Ordinary marker consumption remains (documented interpretation). pending defense cannotDodge:true disables actual/virtual Dodge, with an explanatory Continue control. Draco has at most2 distinct targets with independent settlements; indexed and legacy limits agree. Source traits/burn remain effective.


## Grimer contracts — latest

Grimer all3 levels execute. Pound1 blank; Sludge Bomb2 afterpositive damage heavy-rain-only judgment poisons; Toxic2 accepts rain OR thunderstorm. All judgments use existing persistent Drought machinery and preserve original target instances after rescue/deployment. Shared applyStatus now routes every supported status caller through Poison Touch; existing status or inactive/defeated original target prevents a new status, without overwriting or redirecting to a reserve.

Private room.statusEvent stores kind:'status'|'poison', targetId (Pokémon instance), actorIds, actorInstances, index, status/next or damage. Captured active/living Grimer respond in current-trainer-first full-seat order. pending kind:'poison-touch' has actorId/targetId trainer IDs, mode, trait:'poison-touch', canTrait:true and pending public status/base damage; internal capture/continuations stay hidden. respondBattle trait/pass only, strict payload/authority/instance validation. Optional expiry passes; offline/votes pause; restart/retry commits once. No per-turn cap across distinct events.

Status application waits for the queue. All pass keeps original status; first accept changes it to Poison. Initial Poison-to-Poison choices and further setters after first acceptance are omitted as outcome-neutral policy, explicitly NOT additional printed text; revisit if future content adds ability-activation side effects. Committing directly never recursively creates another replacement event. Source after-damage/receiving effects resume exactly once.

Poison tick starts a base1 source-free event before any HP loss. First accept setsbase2 (not additive); all pass keeps1. computeDamage(null,target,base,{command:false,channel:'status'}) applies receiving Defense/Multiscale before optional Marvel Scale/HP/rescue. No source means no fictional Static/Helmet target or attacker reward. Turn-start Poison/Confusion may be capped by Defense but DO NOT consume it: the booklet's discard trigger requires damage from a resolving card. Other move/item/virtual-command marker lifecycles remain. Setup/completion/victory/closing reset clears statusEvent.

248/248 tests pass, including27 independent Grimer/status-timing cases. Browser QA in isolated4174 room verified remote Muk replacing Confusion before entry, then4/5→2/5 HP only after Poisonbase2 choice. Chinese/English controls, spectator0controls/0hand,4clients0warnings/errors. Main4173 native Muk3 inspector verified. Evidence poison-touch-status-preview.jpg, poison-touch-damage-preview.jpg, muk-levels-preview.jpg. Main server restarted, temporary QA cleaned.



## Psyduck and shared moves — latest

Psyduck all3 faces execute HP3/4/4: Bubble1 Lv1/2 mandatory after-damage marker removal (pending reinforcement timing:'after-damage'), Water Pulse2 Lv3 rainy confusion, Disable index1 Lv2/3. Original target instances remain captured; no removal/status transfers to an incoming reserve. Source after-damage choices precede receiving effects.

Swift Swim useTrait has no payload, onceownPlay; final rain OR thunderstorm grants room.turn.cardRangePlayerId and room.turn.swiftSwimCreatureIds. Export cardDistanceIgnored(room,player) for trainer-card target queries. Only the granting instance receives move range; switching neither transfers that permission nor removes trainer permission. room.turn.swiftSwimUsed prevents another use that Play; all reset next global turn. Other card target-type and command-user/use limits remain.

previewActions.moves derives indexed command/weather availability and target counts from reviewed data. Weather conditions use weatherIconsInCondition, allowed effectKind burn-judgment / temporary-hand-exile; unknown kinds fail closed. Vulpix descriptor and Surf targeting.max2 are migrated data with unchanged behavior. Optional resolution.effectKind is null for normal commands to stay JSON-stable on restart. Legacy first-command projection remains. Weather moves discard one matching-weather real card of ANYkind before defense, no Power/command-user lock; paralysis only restricts actually used command cards. Wisp retains sunny burn behavior. Disable accepts rainy, no damage or receiving effects, ordinary Dodge/Sand Veil.

Disable uncanceled settlement opens optional kind:'exile', source actor, target trainer, maxCards=min2/hand length. Stable private resolution.handChoiceIds maps shuffled slots; public choices ONLYactor, face-down {index} for other hand or own labeled stubs without IDs. respond choice:'exile',handIndices:[0..2 distinct safeint slots] OR pass with noindices. Whole selection validates before mutation; expiry pass chooses0. Empty hand auto-finishes paid move. handIndices forbidden on other decisions.

Actual cards live in PRIVATE player.exiledCards, outside hand/limits/payment/deck/discard. Public battle players/self expose exiledCount only, never removed faces/IDs even to owner; no inspection operation. Noncombat projection is unchanged. Eliminated trainers retain exiles until reset unless an already-triggered return remains; result shows counts only. Setup/closing/rematch clear zones.

At nextownturn beginning, PRIVATE room.turnStart {playerId,pokemonId,remaining:['return-cards','status']} captures return plus flinch/sleep/confusion/poison effects as applicable. Both → mandatory pending kind:'turn-start-order',effects names only; respond choice:'start-effect',effect:'return-cards'|'status', no pass. Single effects execute automatically. Selection is consumed before execution. Root finishResolution resumes remaining start effects after Grimer/scales/rescue/nested Helmet continuations. Return restores actual cards before ordinary draws; if status eliminates trainer without victory, pending return completes then ordinary eliminated-hand discard. Immediate victory stops queue and retains exile zone until reset. Mandatory start-order expiry waits; offline/votes pause.

Future Meowth gain hooks must distinguish TURN-BEGIN restoration from ordinary Draw phase: store initializes turn.phase='draw' before start effects, but mandatory draws have not begun. Use gain reasons/pending start context rather than phase alone for Pickup. Current card-return operation is not an extra ordinary draw.

278/278 tests pass including30 independent Psyduck cases. Browser4clients0warnings/errors: Swift range3→4 targets; Bubble1damage before marker choice before Static; Disable source-only2blind slots retained across language render, spectator0choices/0hand; target2hand+2removed; choose Poison first nextturn then exact cards return before draws,5/5→4/5HP and4hand. Main native Golduck3 inspector verified. Six new screenshot filenames in milestone14. Main4173 restarted latest, temporary QA cleaned.



## Meowth and shared gains — latest

Meowth all3 faces execute HP3/3/4. Lv1 Protect index0 has no printed damage value, sunny weather-card condition and effectKind:self-defense; target.kind:self restricts it to its own active. After ordinary uncanceled settlement it gains Defense only if no carried Defense, with no Power consumption/damage/command lock. Public arena reinforcement labels now show Power/Defense/Speed and inactive under Paralysis; no generic acquisition action is added.

Lv1/2 Pickup is mandatory once per Pokémon INSTANCE per global turn. Shared gainBattleCards(room,player,cards,{reason='effect'}) and drawBattleCards(room,player,count=1,reason='effect') cover effect draws/gifts/take/judgment/Drought/Synchronize/Pay Day/exile return. Setupreason skips. Own Draw phase suppresses only when turn.playerId matches, phase=draw and no private turnStart; return at turnbegin DOES trigger. turn.pickupUsedIds is marked before bonus, survives switching/evolution of same instance, resetsnextglobalturn. Empty batch/inactive/reserve/defeated/eliminated/spectator/Lv3 noPickup. Bonus with no available real draw/discard card spends trigger but draws0, preserving original gain; no phantom/deadlock. This exhaustion policy and per-instance scope are documented interpretations. Base draw counts retain strict DECK_EMPTY validation; count2 base batch lands before one bonus.

Pay Day Lv2/3 index0 command2 opens optional kind:pay-day afterpositive damage/rescue and before target receiving effects. canTrait=true,trait:pay-day; trait privately reservesup2actualtopcards in resolution.distributionCards; passleavesdeckunchanged. Shortpile shufflesdiscardunderexistingtop, usesavailablecards only;0autoends. Reservation is effect bookkeeping, NOT exile. Pendingkind:distribute haschoiceCount andrecipientIds; actorONLY gets cards:[{index,name,weather,kind}], noIDs. respondchoice:distribute,allocations:[{index,recipientId}]exactlyeveryreservedcardonce, stricttypes/keys/authority/livingrecipients. Self/samerecipient allowed. NoPassafterview; mandatoryexpirywaits. Stablecards/selections/restart/retry/votes/disconnects preserved. Everydelivery commits before Pickup bonuses in current-turn-first establishedcounterclockwise seatorder; a bonus cannot steal reservedsecondcard. allocationsforbidden onotherdecisions. Cleanup returns unusedreservedbundle todecktop if ever interrupted, preservingactualcards.

PersianLv3 Limberprevents NEWparalysis BEFOREGrimer replacement; existingstatus/evolutionretainrules unchanged. Immunity-versus-replacement priority not printed: earlygate is explicitinterpretation. Otherstatuses stillapply. Fake Out index1 command1 effectKind:flinch-after-damage directly appliesFlinch via sharedGrimer/one-status/originalinstancepipeline, nojudgment orunstatedfirst-turnrestriction. PayDay/FakeOuteachonce, samerealcommanduserinstance. resolution.moveIndex is0default/actualindex andJSONstable. Handcardsrenderallreviewedindexedcommands withnamelabels whenmultiple; normalonecommandUseMove staysunchanged.

310/310tests pass including32independentMeowthcases. Browser6clients0warnings/errors: source-onlyPayDayfaces andself/selfrecipient selections survivedlanguagechange, hand3→6withPickup1; spectator0cards/0hand; ProtectPower+Defense/unchangedHP; FakeOut1damage+Flinch withPayDaystillavailable. MainnativePersian3inspectorverified. Main4173restartedlatest; temporaryQAcleaned. Five new screenshotfilenames in milestone15. Productiondeckunchanged; allsourcehashes/cataloguebyteidentity verified.
