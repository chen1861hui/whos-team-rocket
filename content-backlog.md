# Content and rules backlog

## Current combat milestone — 2026-10-27

**56 tests pass**. A playable **Start combat preview** mode now runs command attacks, target selection, Dodge/pass, HP and starter traits, ordered rescue passes, forced deployment, hidden identities, elimination, real victory and final disclosure in the accepted arena. Three trainers plus a Chinese spectator completed a 13-turn UI-only scenario through Challenger victory. See `gameplay-milestone-4.md` for exact scope/evidence and the explicit test-deck/three-candidate setup. This is not the complete retail deck or roster.

The supplied command/dodge faces were already present and have **no body paragraphs**; `reviewed-playcard-spec.md` corrects the old missing-face blocker. Seven supplied originals are now preserved under `research-assets/provided-previews/`. Potion ordinary heal 2 is visible; complete rescue text is physically obscured. Target-trainer Dodge eligibility is recorded as an interpretation. No need to reconfirm the supplied booklet as the rules basis.

Non-Astra acquisition saved all80 signed observed URLs and one new photo: **54 card photos saved, 26 observed paths missing**. The supported 20-second media call took795 seconds; avoid further unbounded calls. All70 source images (54+9+7) decode and have distinct hashes. Detailed records remain in the asset acquisition checkpoint.

## Latest reviewed subset — 2026-10-27

Nine faces from six saved photographs have been transcribed and independently reviewed: Bulbasaur, Charmander and Squirtle, each Lv.1–3. Both catalogue copies include HP, trait/move text, command markers, printed numerals, working English, file hashes and unresolved symbols. Their effects remain unavailable / `engineEligible:false`, and quantities remain null. The other 54 preview faces retain their draft/null text. `reviewed-combat-spec.md` records exact evidence and combat gates.

The photographed booklet p.1 states 108 game cards and 80 physical Pokémon cards arranged as 40 groups, each with a double-sided nonfinal card and single-sided final card (120 level faces). These component totals do not verify any per-face quantity/weather distribution or identify gallery positions. The independent 80-item Douyin gallery count remains a different observation. Initial switch and optional level-up rules are implemented; the older table's unresolved evolution/switching claims are historical.

Update 2026-10-27: a photographed printed rulebook is now available in all nine gallery images (booklet pp.01–12 plus covers), and 53 files from an 80-image Pokémon-card gallery are saved. See `xiaohongshu-rulebook-source.md` and `douyin-card-source.md`. The older table below remains a record of the earlier gaps; several now have source-supported answers awaiting engine implementation. Optional end-turn level-up is implemented from printed pp.5/8. The full card acquisition/transcription and final deck quantities are still incomplete. Do not treat 80 gallery positions as 80 distinct cards.

This milestone is a local multiplayer foundation. The catalogue is a public reference to the seven supplied preview posters. It is not an approved retail deck manifest or a rules-complete game specification.

## What is available

`app/content/catalogue.json` and `app/public/catalogue.json` contain identical public-safe data, with `schemaVersion: 1`:

- 21 Pokémon preview rows, each with the three displayed level faces, their draft names and draft HP. Repeated species at different levels are preserved literally.
- All 63 faces carry `evidenceStatus: "preview-unverified"`, `hpStatus: "draft"`, `abilityText: null` and `effectStatus: "unavailable"`.
- HP for Mankey, Clefairy and Vulpix was spot-checked against original-resolution previews: 3/3/4, 3/4/4 and 3/3/4. That check does not establish retail values. Other HP remains a preliminary transcription.
- Mankey's level-three display name uses 火暴猴 / Primeape. The preview glyph is still ambiguous between 暴 and 爆; the entry's bilingual evidence note preserves that uncertainty.
- 15 play-card preview panels live in `playCardPreviews`, separate from Pokémon entries and any engine deck. Every one has `engineEligible: false`, unavailable effects and an unknown deck quantity. The candy and medicine-canister cards retain `splitEffect: true`; their headings and effects remain unresolved. Helmet and provisional 光粉 headings also remain unresolved, so their `name` is `null` and bilingual descriptive labels identify them.
- Artwork is an explicit placeholder with a null URL. English labels support the interface; they do not establish printed text from an English edition.

The source of this transcription is [preview-roster-v1.md](preview-roster-v1.md). Each row retains its original poster filename. The files contain no credentials, room state, private selections, remote artwork URLs or hidden game information.

## Preview source coverage

| Original poster filename | Pokémon rows | Play-card panels |
|---|---:|---:|
| mmexport1793009383237.jpg.jpeg | 3 | 2 |
| mmexport1793008989807.jpg.jpeg | 3 | 2 |
| mmexport1793009022050.jpg.jpeg | 3 | 2 |
| mmexport1793008971679.jpg.jpeg | 3 | 2 |
| mmexport1793009377934.jpg.jpeg | 3 | 2 |
| mmexport1793008928244.jpg.jpeg | 3 | 3 |
| mmexport1793008962926.jpg.jpeg | 3 | 2 |

The posters promote a 大师版 presale campaign. Edition and final printing are not confirmed. Their Lv1/Lv2/Lv3 faces do not establish three separate physical cards, three distinct species, family quantities or complete-deck contents. The first poster's layout differs; its level positions were read from the visible level labels.

## Rules that remain pending

Use [rules-evidence.md](rules-evidence.md) and [video-review-S04.md](video-review-S04.md) as evidence ledgers. Video observations and presenter corrections must remain distinguished from selected-edition printed rules.

| Area | Evidence still needed before enabling it |
|---|---|
| Edition and players | Exact retail edition, official supported player counts and modes, complete component list, role mix at each count and all victory text. The foundation's 2–6 seats are a development fixture. |
| Setup | Candidate-deck composition and quantities, selection order, unused candidates, duplicates, seating and turn direction, leader benefits, initial levels and initial hands. Five candidates, two selected and four placeholder hand cards are provisional foundation fixtures. |
| Phases and draws | Exact trigger ordering, phase boundaries, replacement effects, draw sources, deck exhaustion, reshuffle and information access. Two ordinary draws have video support but are not a complete draw specification. |
| Combat and responses | All printed attacks, costs, attack limits, targets, range, distance, response windows, passes, priority and simultaneous triggers. No attack/response effects are currently available. |
| Pokémon levels | Printed level-increase rule, mandatory versus optional wording, timing, damage/healing carryover, status interaction and whether a level change changes species. S01/S04 wording conflicts remain unresolved; end turn must not silently assert an evolution rule. |
| Active and reserve | Voluntary switching versus forced deployment, costs, per-turn limits, reveal history, concealed data, HP/status persistence and the reinforcement correction's exact scope. |
| Damage and elimination | Prevention, rescue, damage overflow, simultaneous knockouts, no surviving reserve, trainer elimination, victory precedence and role-based rewards or penalties. |
| Status and items | Every status/reinforcement icon and effect, duration, stacking, clearing, switching/evolution interactions and held-item restrictions. |
| Every card | Exact names, all text, values, icons, quantities, split-effect headings, role text, errata and any promo differences. |

The optional turn timer follows the user-requested digital timeout policy in `gameplay-milestone-2.md`; response timing remains pending. Placeholder hands are unplayable fixtures. They must never be described as a verified action deck. No winners or combat outcomes should be inferred from incomplete rules.

## Replacing placeholders safely

1. Choose and record the exact retail edition first. Obtain a complete legible manual, all card faces, quantities and any official corrections for that edition. Keep preview and prototype material as separately attributed evidence.
2. For each changed field, record source filename or URL, page/card number or timestamp, edition, exact reading, reviewer status and conflicts. Transcribe text and icons separately from artwork. Do not replace missing text with familiar Pokémon or 三国杀 mechanics.
3. Preserve existing English base-species IDs (`charmander`, `grimer`, etc.) as catalogue keys. Do not merge repeated level names or derive a form from a conventional evolution chain. Record a compatibility decision if verified material requires a structural schema change.
4. Resolve the 火[暴/爆]猴 glyph and unresolved play-card headings against clear printed evidence. Keep null values and uncertainty notes until the relevant field has actually been verified. An English UI translation must remain distinguishable from official printed English text.
5. Promote evidence status only for the fields checked; do not make an entire row or edition retail-verified from one HP spot check. Retain provenance when a draft value changes. Add structured verified ability/effect definitions only after exact text and timing have been reviewed.
6. Build a separate verified deck manifest containing physical quantities and face relationships. Do not infer it from 21 rows, 63 faces or 15 pictured play-card panels. Only explicitly approved, verified mechanics can enter the engine's playable deck.
7. Replace artwork URLs only with approved local assets and an asset/licensing inventory. Keep generic silhouettes for hidden reserves; their names, models, thumbnails and asset identifiers must not be sent to unauthorized clients.
8. Update both catalogue copies together and confirm byte equality. Static serving must expose only the public copy; future private material belongs outside `public/` and must not be copied blindly.
9. Validate the engine against complete setup, ordinary attack/response, switching, level change, rescue/elimination and every victory outcome before claiming full playability. Record remaining contradictions rather than choosing convenient behavior.

## Acceptance checklist for the next content milestone

- [ ] Selected retail edition and supported player counts documented with authoritative sources.
- [ ] Complete manual and component/card manifest available, including physical face relationships and quantities.
- [ ] Every Pokémon name, HP, icon and ability transcribed and independently reviewed field by field.
- [ ] Primeape glyph and all four unresolved play-card names/headings resolved with clear evidence.
- [ ] Both split-effect cards have separately verified headings, effects and activation conditions.
- [ ] All role, action, item, status and reinforcement text captured with provenance.
- [ ] Setup, draw/discard, switching, level timing, response priority, rescue and victory contradictions resolved.
- [ ] Verified effects modeled separately from display labels, with meaningful rule scenarios checked.
- [ ] Approved assets mapped to public catalogue IDs without leaking concealed choices.
- [ ] Public and source catalogues validated together, with no private state or credentials included.
- [ ] Product copy reviewed so unavailable mechanics and remaining evidence gaps remain visible.
