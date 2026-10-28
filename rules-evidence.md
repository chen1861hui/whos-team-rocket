# Rules evidence and remaining verification

## Current combat milestone — 2026-10-27

**56 tests pass**. A playable **Start combat preview** mode now runs command attacks, target selection, Dodge/pass, HP and starter traits, ordered rescue passes, forced deployment, hidden identities, elimination, real victory and final disclosure in the accepted arena. Three trainers plus a Chinese spectator completed a 13-turn UI-only scenario through Challenger victory. See `gameplay-milestone-4.md` for exact scope/evidence and the explicit test-deck/three-candidate setup. This is not the complete retail deck or roster.

The supplied command/dodge faces were already present and have **no body paragraphs**; `reviewed-playcard-spec.md` corrects the old missing-face blocker. Seven supplied originals are now preserved under `research-assets/provided-previews/`. Potion ordinary heal 2 is visible; complete rescue text is physically obscured. Target-trainer Dodge eligibility is recorded as an interpretation. No need to reconfirm the supplied booklet as the rules basis.

Non-Astra acquisition saved all80 signed observed URLs and one new photo: **54 card photos saved, 26 observed paths missing**. The supported 20-second media call took795 seconds; avoid further unbounded calls. All70 source images (54+9+7) decode and have distinct hashes. Detailed records remain in the asset acquisition checkpoint.

## Current reviewed rules/card slice — 2026-10-27

`reviewed-combat-spec.md` adds Chinese transcriptions, separate English translations, image SHA-256s, nine reviewed Pokémon faces and explicit engine gates. Root independently checked the six card photos and booklet originals. Corrections now recorded: the command limit selects one Pokémon identity per trainer/Play, not one command card; non-command moves discard **one** card meeting their requirement; 快躲开！ cancels one settlement. Printed default distance eligibility includes yourself and adjacent trainers/their active Pokémon, subject to each card's restrictions.

Booklet p.1 says 108 game cards; 80 physical Pokémon cards in 40 groups (one double-sided nonfinal plus one single-sided final per group). This is a source component total, not a verified per-card manifest, and is unrelated to the gallery counter's 80 items. Ordinary switching is now enabled from pp.5/8/11 and tested; combat remains unavailable. Latest acquisition coverage is recorded in the asset directory checkpoint.

## New printed sources — 2026-10-27

The older video ledger below is superseded where readable printed wording conflicts:

- **S05:** user-supplied Douyin Pokémon-card gallery, canonical `https://www.douyin.com/note/7684572630280187855`. Counter shows 80 images, not a verified card count. 53 image assets are saved so far; acquisition of the rest was interrupted by a subagent usage limit. See `douyin-card-source.md` and its asset manifest.
- **S06:** user-supplied photographed rulebook, canonical `https://www.rednote.com/discovery/item/6a97c38c0000000026015ccf`. All nine gallery photos are saved; they show continuous printed booklet pages 01–12 plus covers. See `xiaohongshu-rulebook-source.md` for page-linked readings and `research-assets/xiaohongshu-rulebook/manifest.json` for files. The exact printing remains unidentified, but the printed wording is now available for implementation evidence.
- Root independently checked printed pages 5, 6, 7, 8, 9, 10 and 11. Page 5 explicitly permits (does not require) one active-partner level increase at turn end below level 3. Page 8 preserves existing injury markers and status on level change. This optional level choice is implemented; other handlers remain pending.
- Important corrections to the old video notes: rescue starts with the current turn's trainer; reinforcement forbids duplicate tokens of the same type, not all combinations of different types; the red command-move symbol is distinct from weather symbols. Preserve these distinctions in subsequent effects work.

Asset acquisition and printed-rule review are separate from a complete playable deck. Still needed: a mapped card inventory, reviewed exact effect text/icons, physical quantities and interactions, plus implementation/tests of those effects.

Updated 2026-10-25. This is a research ledger, not an approved retail rules specification.

## Source S01: user-provided walkthrough

[蒸蒸日上！宝可梦也解锁三国杀模式了？](https://www.bilibili.com/video/BV1UjK66LE2J/) — 吃蛋挞的折棒, displayed publication date 2026-07-20, duration 14:42.

Authenticated browser playback beyond the preview works after the user signed in manually. Read visible Chinese captions and sampled video frames. Captions contain recognition errors; they are not verbatim card text. The video explicitly says it uses early prototype samples and the final physical product takes precedence. Every observation below is therefore PROTOTYPE-SUPPORTED, not RETAIL-VERIFIED. Time ranges are approximate navigation references.

| Topic | Observation | Time | Remaining uncertainty |
|---|---|---|---|
| Identities | Gym Leader reveals their identity and occupies the starting seat; other roles remain concealed | 11:05–11:15 | Retail role mix at each player count; turn direction |
| Pokémon selection | Five candidates, keep two; locate matching lower-level forms when not using double sleeves | 11:18–11:37 | Candidate-deck composition, duplicate families, selection order, treatment of unused candidates |
| Starting levels | Gym Leader starts at level 2; others at level 1 | 11:39–11:48 | Mode/edition applicability, any additional HP benefit |
| Active/reserve | One active Pokémon and one initially concealed reserve; lower forms of reserve can be located when first revealed | 11:51–12:03 | Reveal triggers, what remains public after switching back, reserve status/HP handling |
| Turn phases | Preparation, draw, play, discard, ending; no separate 三国杀-style judgement phase | 12:16–12:25 | Complete trigger ordering and interruptions within each phase |
| Draw | Draw two cards in the ordinary draw phase | 12:40–12:43 | Replacement effects, deck exhaustion, initial hand count |
| Play | Play cards, use moves/abilities, and switch active/reserve | 12:43–12:58 | Costs, per-turn limits, target range, response priority |
| Forced deployment | Deploy reserve when active Pokémon is knocked out; distinct from voluntary switching | 13:12–13:19 | Rescue timing, damage overflow, inherited effects, no surviving reserve |
| Level increase | At the end of one's own turn, active Pokémon below level 3 may increase one level | 13:22–13:41 | Optionality in retail text, healing/damage carryover, level versus species evolution, timing against other end effects |
| Elimination | Trainer exits when both Pokémon are knocked out; role cards define victory | 13:51–14:01 | Rescue, simultaneous elimination, victory priority, reward/penalty effects |
| Promo | Narrator mentions different artwork on a promotional card | About 10:45 | Whether all mechanical values and deck quantities match |

The initial-hand passage was not captured clearly enough to record a number. Do not substitute the Japanese edition's count. A screenshot around 13:09 shows a Gym Leader victory statement, but the complete role set has not been transcribed.

## Source S02: official-unboxing listing

[全新宝可梦主题桌游《宝可梦：谁是火箭队？》官方开箱](https://www.bilibili.com/video/BV1szNQ6KEi2/) — 新物集App, displayed 2026-07-14, duration 03:08. Interactive browser access succeeded on 2026-10-25. A frame around 01:36 visibly carries an initial-prototype/final-product disclaimer. Despite the title, this does not establish final retail text. No complete catalogue was extracted from it.

## Source S04: second user-provided rules video

Targeted review completed 2026-10-26; see [video-review-S04.md](video-review-S04.md) for reviewed intervals, handoff provenance and remaining gaps. This is not a complete review of every card shown. New video-supported findings include four initial hand cards, discarding to four, the switching reinforcement correction, and a presenter correction describing level-up as mandatory. Preserve the conflict with S01's tentative optional wording until authoritative text resolves it. The closing reserve/status exception remains ambiguous.

[【谁是火箭队】开箱及规则介绍视频～](https://www.bilibili.com/video/BV1R9tW6hEY3/) — EkoLee0102, displayed 2026-08-31, duration 29:39. Browser playback and Chinese AI captions accessible. Page labels it personal views/reference. Sampled sections only; not yet reviewed in full.

- About 05:09: creator concludes the unboxing section, then the video continues into rules coverage.
- About 09:44: tabletop active/reserve demonstration with an edited on-screen correction saying reinforcement tokens must be discarded. Surrounding trigger has not been verified, so this is a pointer for review, not an adopted switching/evolution rule.
- About 15:07: close-up of 梦幻的祝福 and other physical game cards, alongside role cards/table layout. Promising for transcribing individual effects, but no full text or quantity verified from this sample.
- About 24:21: a clearly visible edited turn-flow list reads 回合开始 → 准备阶段 → 摸牌阶段 → 出牌阶段 → 弃牌阶段 → 结束阶段 → 回合结束, alongside a tabletop example. This corroborates the five internal phases described in S01 and adds explicit start/end boundaries in the presenter's diagram. Trigger semantics and optional actions still require the surrounding explanation and retail text.
- Useful source for step-by-step flow and card demonstrations. Must compare spoken explanation, edited corrections and printed card/manual text. Exact edition, completeness of card coverage and retail authority remain unverified; a later upload date alone does not prove retail accuracy.

## What this changes in the product plan

- Treat active and reserve as separate slots, with reveal history and distinct level/state fields.
- Conceal an unrevealed opposing reserve's model, name, thumbnail, tooltip and loaded asset identifiers from unauthorized clients. Render a generic covered slot.
- Local selection must support inspecting all available levels before committing, subject to the retail setup rule.
- Level increase needs its own decision/resolution event. Do not assume every level increase changes species or triggers the same model transformation.
- One-card draw clicks represent individual authorized draws within a rules-defined batch. They must not create extra draws.
- End Turn confirmation precedes required discard/ending decisions where applicable; it must not skip evolution or mandatory effects.
- Ordinary switching and forced deployment must be different rule actions, even if they share animation assets.

## Retail verification blockers

New source material: seven user-provided Chinese preview posters, inventoried in [chinese-preview-evidence.md](chinese-preview-evidence.md). They show63 Pokémon panels and15 play-card panels. Initial compressed copies were197/314px wide; user then provided789/790px originals, making names, levels, HP and many text passages readable. The labels establish Lv1/Lv2 as opposite sides of card1 and Lv3 as card2 front. Several headers identify the 大师版 presale campaign. This substantially improves catalogue evidence but does not yet close quantity, every-effect or final-retail-wording gaps.

1. Exact Chinese retail edition and edition-specific official player counts/modes. Secondary pages disagree about Pokémon-card counts; Japanese material is a separate edition.
2. Complete manual, including role distribution, initial hands, seating and turn order, selection sequence, attack limits, range and distance.
3. All role cards, Pokémon forms, HP, abilities/moves and play cards, with quantities and all printed icons. Physical card count is not necessarily the number of distinct Pokémon families or game entities.
4. Response windows, priority/pass rules, simultaneous triggers, rescue and victory precedence.
5. Status and reinforcement timing, stacking, duration, switching and evolution interactions; held-item restrictions.
6. Deck exhaustion and reshuffle, hidden/private/public zones, discard access and any information-changing effects.
7. Corrections/errata and promo mechanics. Do not import familiar 三国杀 rules or assume Pokémon video-game type matchups apply.

## Source quality checks

- Additional source inspected: https://www.bilibili.com/video/BV17jgn6EEU8/, 谁是火箭队？规则速讲加实况, 晖耀晴天, displayed 2026-08-13, duration 53:27. Contains physical play and a printed reference sheet, but edition is unverified and the sheet is not legible enough in inspected frames for transcription. Captions lag during buffering/seeking; do not promote the sampled snippets into exact timed rule evidence. It suggests a player-count-dependent leader setup benefit that should be checked against the retail manual. No new retail rule was confirmed.

- Wiki and retailer counts are discovery leads, not a merged deck manifest.
- A secondary article at https://post.smzdm.com/p/ak8dlmg4/ has a purported six-player role column totaling seven people. Reject that table as implementation data.
- Only observations made on S01 with its 14:42 duration belong in this ledger. Samples from an accidentally autoplayed related match were discarded.
- No complete card set, full retail rulebook, or final translated catalogue has been acquired.

## How to close the rules gate

For each rule or card entry record source URL/file, edition, page/card number or video timestamp, exact mechanical reading, reviewer status, and any conflicting source. Transcribe values and icons separately from artwork. Resolve conflicts against the selected retail manual/card text or official correction. After the catalogue is complete, walk through setup, normal attack/response, switching, level increase, rescue/elimination, and each victory outcome before calling the engine specification ready.
