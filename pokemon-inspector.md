# Pokémon inspector

## Centered hover preview — 2026-10-28 (current)

The three-level hover preview now stays centered in the viewport for every candidate. CSS centering adapts to resizing; the heading identifies the hovered Pokémon. This supersedes the earlier placement above each card. Verified left, right and center candidates all produce three cards centered at the viewport midpoint (975 × 956 browser). Card clicks and level clicks still open the detail modal; Choose remains separate.

## Three-card Pokémon hover preview — 2026-10-28 (current)

Updated interaction per user: hovering a drawn Pokémon card reveals three separate native level cards above the tray, with the matching form art/name, printed level/HP and reviewed ability preview (or pending label). Clicking the main card opens its detail modal; clicking a preview level opens that exact level. Partner choice is now a separate **Choose / Active partner / Private reserve** footer button. Do not revert card clicks to immediately choosing a partner. The old Levels & abilities overlay button is superseded. Active/reserve name links and Field guide inspection remain.

Keyboard focus also shows the three-card comparison; Escape dismisses it and Enter opens details. Preview positioning clamps to viewport edges. A short close delay and an invisible pointer bridge let users move from the original card into the three-level preview. Only one preview exists at a time. Modal interaction and inspection do not select a partner; actual choice retains the five-draw requirement and exactly-two limits. No game rules or hidden-information projection changed.

Verified native card click and preview Lv.3 click open the correct modal; the separate footer selects Abra without opening a modal. Keyboard-focus previews for leftmost, center and rightmost candidates each showed exactly three cards inside the 1280×720 viewport, with loaded portraits and preserved selection. This browser API has no mouse-hover method, so preview display checks used its equivalent focus entry point; native pointer transition during preview-level click was checked and stabilized. **62 regression tests pass**, module syntax passes. Evidence: `pokemon-hover-levels-preview.jpg`. Pending ability text remains pending; all art stays standalone, with no photographed card display.

## Pokémon level/ability inspector — 2026-10-28 (current)

Click **Levels & abilities** below a drawn Pokémon card, or inspect a Pokémon from the Field guide. In matches, active Pokémon names and your own reserve name also open details at their current level. The arena-styled modal has three level tabs showing the printed form names/HP, matching standalone form art, reviewed trait/ability text, moves, costs/printed values and explicit pending/source uncertainty. Inspection is separate from selection and never changes a chosen partner or sends a gameplay action. Arrow keys, Home/End and selected-tab ARIA work; close restores focus to the invoking card/name.

Only the three starter groups currently have reviewed ability/move text and executable effects. The other 37 retain pending labels. All 120 name/HP faces now have matched standalone form artwork (81 unique species, 40 preserved base files + 41 new transparent PNGs acquired by a non-Astra Sol worker). Exact catalogue-name-to-species checks, source URLs and hashes are in `research-assets/pokemon-form-art.json`; public `levels[].portraitImage` is only presentation data. New form routes use an explicit 41-dex allowlist; unknown forms and research-manifest routes return 404. No photographed card display was reintroduced.

Verified: all 120 manifest face names/paths/hashes, 81 live PNG routes, mirrored catalogues, module syntax and **62 passing regression tests**. UI checks covered Abra→Kadabra→Alakazam, reviewed Charizard Blaze/Fire Blast text, English/Chinese level tabs, arrow/End keys, evolved artwork loading, active/reserve entry points, preserved Abra selection after close and restored focus. No inspected console warnings/errors. Evidence: `pokemon-levels-abilities-preview.jpg`. Accepted arena and game rules remain unchanged.

