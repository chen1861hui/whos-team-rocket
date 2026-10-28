# Xiaohongshu rulebook source review

## Continuation review — 2026-10-27

Original images 03/05/06/07/08 were independently rechecked for the next rules slice; see `reviewed-combat-spec.md` for exact Chinese and hashes. Page 1 states 108 game cards and 80 physical Pokémon cards in 40 groups, each with one double-sided nonfinal card and one single-sided final card. This yields 120 level faces but does not give per-game-card quantities/weather. Ordinary switching (pp.5/8/11) is now implemented in the fixture game; all combat card effects remain unavailable. Exact printing uncertainty persists.

Reviewed 2026-10-27. This is source evidence, not an adopted engine specification.

## Source identity and completeness

- User link: [xhslink short URL](https://xhslink.com/o/1bIKrTCTOXW)
- Canonical public note: [宝可梦谁是火箭队 桌游规则书](https://www.rednote.com/discovery/item/6a97c38c0000000026015ccf)
- Author shown on the note: 马小虾玩桌游.
- Note date shown: **Sep 2**; the page does not display a year. Do not infer one from the share URL.
- The note title is **宝可梦谁是火箭队 桌游规则书**. The page shows a nine-image gallery (1/9 through 9/9). I opened and inspected every image. Together the photos show the cover/outer cover and continuous printed pages 01–12, including the final reference chart. The numbered booklet pages appear complete and the key setup, turn, combat, rescue, status, and victory text is readable at original resolution.
- This is a photographed printed booklet credited inside to The Pokémon Company. No edition number, print date, or explicit retail/production status is visible. Treat it as strong printed-rule evidence, but **do not claim its exact printing is the selected retail edition**.
- There are no video captions involved. The note metadata and comments are not printed rules; one author comment says “宠物（武将）进化、道具（锦囊）两个效果选一执行,” which is not used as mechanics evidence.

## Saved gallery assets

All nine observed gallery images were acquired through the page's normal image download control and saved outside `app/public/`. The filename mapping below uses the actual displayed gallery order and observed image URLs. One pageAssets bundle attempt failed for most files; normal browser media downloads succeeded for all nine. A machine-readable copy of this mapping is in [manifest.json](research-assets/xiaohongshu-rulebook/manifest.json); it records no missing gallery images.

| Image index | Local image | Printed coverage / visible content | Observed original URL |
|---:|---|---|---|
| 1 | [01-cover.webp](research-assets/xiaohongshu-rulebook/01-cover.webp) | Standalone front-cover scan | `https://sns-web-i10.rednotecdn.com/202610271849/607abdeb85dd86ff52eac67997126641/notes_pre_post/1040g3k8324jr86pi0o705pfnqu41hqbjqa2304o!nd_dft_wlteh_webp_3` |
| 2 | [02-outer-cover.webp](research-assets/xiaohongshu-rulebook/02-outer-cover.webp) | Open outer cover; game premise and printed page 01 (components) | `https://sns-web-i10.rednotecdn.com/202610271849/37860707eebbd60c7f542718fd251f38/note_pre_post_uhdr/1040g3r8324jsqeggna705pfnqu41hqbj1f9c0gg!nd_dft_wgth_webp_3` |
| 3 | [03-components.webp](research-assets/xiaohongshu-rulebook/03-components.webp) | Printed page 01 (game components) | `https://sns-web-i10.rednotecdn.com/202610271849/d2604ddd7b798f3d376a4473fee478e7/note_pre_post_uhdr/1040g3r8324jsqeggna7g5pfnqu41hqbj0aijbe0!nd_dft_wgth_webp_3` |
| 4 | [04-setup.webp](research-assets/xiaohongshu-rulebook/04-setup.webp) | Printed pages 02–03 (roles, objectives, Pokémon selection, HP, starting hand, game start) | `https://sns-web-i10.rednotecdn.com/202610271849/87a8b76b9a2ed0f77a9c8b71f3abaf3a/note_pre_post_uhdr/1040g3r8324jsqeggna805pfnqu41hqbjl354450!nd_dft_wgth_webp_3` |
| 5 | [05-turn-flow.webp](research-assets/xiaohongshu-rulebook/05-turn-flow.webp) | Printed pages 04–05 (table layout, five phases, turn end) | `https://sns-web-i10.rednotecdn.com/202610271849/d31149c0524f03e75259e18428c0a0fb/note_pre_post_uhdr/1040g3r8324jsqeggna8g5pfnqu41hqbja2go13o!nd_dft_wgth_webp_3` |
| 6 | [06-rescue-basics.webp](research-assets/xiaohongshu-rulebook/06-rescue-basics.webp) | Printed pages 06–07 (fainting/rescue, loss of battle ability, game end, zones, Pokémon fields, distance) | `https://sns-web-i10.rednotecdn.com/202610271849/8b4e0278e417f3cfcafccfd77c0a0b7f/note_pre_post_uhdr/1040g3r8324jsqeggna905pfnqu41hqbjc1tlgig!nd_dft_wgth_webp_3` |
| 7 | [07-targets-cards.webp](research-assets/xiaohongshu-rulebook/07-targets-cards.webp) | Printed pages 08–09 (moves, targets, evolution, reserves, game-card types and operations) | `https://sns-web-i10.rednotecdn.com/202610271849/ecc985384e52221c51b3cb7b7ee71da7/note_pre_post_uhdr/1040g3r8324jsqeggna9g5pfnqu41hqbj02mlmmg!nd_dft_wgth_webp_3` |
| 8 | [08-timing-damage-status.webp](research-assets/xiaohongshu-rulebook/08-timing-damage-status.webp) | Printed pages 10–11 (simultaneous timing, damage, reinforcement and special statuses) | `https://sns-web-i10.rednotecdn.com/202610271849/a4572952768053558d63d73d721959e3/note_pre_post_uhdr/1040g3r8324jsqeggnaa05pfnqu41hqbj64f8820!nd_dft_wgth_webp_3` |
| 9 | [09-reference.webp](research-assets/xiaohongshu-rulebook/09-reference.webp) | Printed page 12 (status icon reference, credits, Lv1→Lv3 Pokémon chart) | `https://sns-web-i10.rednotecdn.com/202610271849/81cd0d94485b5c54f4532434691259ca/note_pre_post_uhdr/1040g3r8324jsqeggnaag5pfnqu41hqbjolb6ct0!nd_dft_wgth_webp_3` |

## Printed mechanics transcribed from the photographed pages

The statements below come from the printed booklet pages visible in the local image refs above. They are distinct from the note's caption/comments and from the prototype videos in `rules-evidence.md` and `video-review-S04.md`.

### Setup, roles, and victory

- **Player counts and roles (printed p.02, image 04):** 3 players = 1 Gym Leader, 0 Gym Trainers, 1 Challenger, 1 Rocket Grunt; 4 = 1/1/1/1; 5 = 1/1/2/1; 6 = 1/1/3/1. The rulebook says 5–6 players are the best experience.
- Each player randomly receives one identity card. The Gym Leader reveals theirs; other identities stay face down. The Gym Leader takes seat 1 and the other trainers are arranged counterclockwise.
- **Objectives (printed p.02, image 04):** Gym Leader wins by making all Challengers and Rocket Grunts leave. Gym Trainers share the Gym Leader's win condition. Challengers win if the Gym Leader leaves. Rocket Grunt wins if, when the Gym Leader leaves, the Rocket Grunt is the sole trainer who has not already left besides the Gym Leader. A match ends once an outcome is met.
- **Pokémon selection (printed p.02–03, image 04):** shuffle the Lv.3 Pokémon faces down, deal five candidates to each trainer, and secretly choose two. Put one in the front slot as the active Pokémon and one behind it as reserve. After everyone chooses, reveal active Pokémon simultaneously and locate its corresponding lower-level form: the Gym Leader puts the Lv.2 form on the active Pokémon; other trainers put Lv.1. Reserve stays hidden. Remaining Pokémon cards are shuffled into the Pokémon deck. The booklet's diagrams show leader active at Lv.2 and other active Pokémon at Lv.1.
- At 5–6 players, each of the Gym Leader's two Pokémon receives **+1 maximum HP**; the additional HP marker is represented on the corresponding Pokémon card. At game start, injury markers are set aside; they are added for damage and removed for healing.
- Shuffle the game-card deck and deal each trainer **four cards** face down as their starting hand. Put remaining cards centrally as the draw pile. The Gym Leader's turn starts the game; all trainers take one turn in order to complete a round, then a new round starts from the Gym Leader.
- **End conditions (printed p.06, image 06):** if the Gym Leader leaves, Rocket Grunt wins only if it is the only other trainer still in; otherwise Challengers win. If all Challengers and Rocket Grunt have left, Gym Leader and Gym Trainers win.

### Turn phases, move limits, and targeting

- **Five phases (printed p.05, image 05):** Preparation → Draw → Play → Discard → End, then Turn End. Some traits can trigger in Preparation and End. Draw two cards in Draw. In Discard, if hand size exceeds the limit (normally four), discard one card per excess card until at or below the limit.
- In Play, the trainer may use cards, use moves, trigger some traits, and switch active/reserve **once**. These actions have no required order. Card use is unlimited unless text says otherwise. Unless a card says otherwise, a trainer has only one active Pokémon that can use 【接招吧！】 in a Play phase. Each Pokémon may use each of its moves only once per Play phase unless a rule says otherwise. Used cards go to the discard pile unless their text says otherwise.
- **Move cost/target (printed p.08, image 07):** moves bearing the printed red symbol are used by playing 【接招吧！】; the booklet associates that symbol with 【接招吧！】, not with a weather type. Other moves are used by discarding **one** hand card meeting the requirement, usually one or two allowed weather types; this wording does not require discarding two cards for two weather icons. Every move requires a target unless its text says otherwise; by default, choose one Pokémon within the move user's distance limit.
- Distance is based on seat positions. The printed p.07 text and diagram permit yourself and adjacent trainers, and those trainers’ active Pokémon, when a distance limit applies; they do not print a general numerical distance formula. When a trainer leaves, they and their Pokémon no longer occupy a seat, so distance is recalculated around the remaining seats. Under a distance limit, only eligible trainers and their active Pokémon can be selected.
- The Pokémon card diagram on printed p.07 labels its fields, including HP limit, level, Pokémon type, traits/effects, move name, move-use condition, and move effect.

### Evolution, damage carryover, switching, and reserve rules

- **Evolution is optional in the printed rulebook:** at Turn End, “如果出战宝可梦的等级不是3级，则可以令此宝可梦提升一个等级” (printed p.05, image 05). Thus the booklet says a Pokémon below Lv.3 **may** gain one level. This resolves the S01/S04 video conflict in favor of the photographed printed wording; S04's presenter later calls it mandatory.
- The evolution section (printed p.08, image 07) says leveling does not change that Pokémon's reinforcement markers or special status. When the level raises its HP limit, current HP rises by the same amount, so its lost HP does not change and the injury-marker count need not be adjusted. In other words, leveling does not heal existing damage.
- The turn-flow supplement says switching swaps active and reserve and moves their attached items/markers with them (printed p.05, image 05). **Specific exceptions apply:** a reinforcement marker is discarded when an active Pokémon becomes reserve (printed p.11, image 08); reserve Pokémon's carried items and moves/traits do not function, and reserve-zone special statuses do not take effect (printed p.08 and p.11, images 07–08). A reserve Pokémon is normally face down; when it becomes a target or becomes active, reveal it and locate its Lv.1 form (printed p.08, image 07). Some item/event cards may affect reserve Pokémon.
- The active/reserve zones hold the Pokémon and its attached state. A Pokémon can hold a carried item; reserve-held items do not function. Do not treat every token identically: the manual's general switching note is qualified by the explicit reinforcement-discard rule.

### Rescue, knockout, and status

- A Pokémon at **0 HP or lower** enters Fainting and immediately starts rescue settlement (printed p.06, image 06). Starting with the trainer whose turn is being resolved, ask trainers counterclockwise whether to use 【伤药】. A trainer who chooses to use it may use any number, then questioning continues. Settlement ends if the Pokémon returns to at least 1 HP (it leaves Fainting and can continue fighting) or every trainer still in play has been asked and its HP is still below 1.
- When a Pokémon loses battle ability, remove items, reinforcement markers and special-status markers in its Pokémon zone. If it lost ability because of damage dealt by another Pokémon, that Pokémon's trainer draws one card. If it has a reserve that has not lost ability, swap reserve into active and place the defeated Pokémon in reserve, **without triggering the ordinary switching operation**. If both Pokémon have lost battle ability, the trainer leaves, discards their hand, and reveals their identity.
- A Pokémon cannot have two reinforcement markers of the same type at once unless a card says otherwise. When active becomes reserve, its reinforcement markers are discarded. Special-status effects apply to active-zone Pokémon; reserve-zone special statuses have no effect. A Pokémon already in one special status cannot enter another unless stated otherwise (printed p.11, image 08).
- Printed status icons on p.12 include 灼伤 (burn), 畏缩 (flinch), 睡眠 (sleep), 混乱 (confusion), 麻痹 (paralysis), and 中毒 (poison) (image 09). 昏厥 (fainting) is a separate battle state, not a status icon. Status durations/effects are described on p.11 (image 08).

## Evidence limits

- The image set is complete for the booklet pages numbered 01–12 and is readable enough to resolve the key pending rules above. The original photos have perspective, glare and a center fold, so some fine print (especially effect examples and the small p.12 species chart) may need a cleaner scan before verbatim card/catalogue entry.
- This source does not establish the edition/print run or whether these pages exactly match the copy ultimately selected for the product. It contains printed rules, not the full card faces, card quantities by type, errata, or every card's effect text.
- Treat the printed booklet wording as authoritative for resolving the current video conflict only after the project selects this booklet's edition. Keep provenance to this note and these image/page references.
