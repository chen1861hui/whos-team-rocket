# Japanese edition source check — 2026-10-26

## Finding

The official Japanese site currently offers a useful public how-to summary, but no downloadable complete rulebook/manual or complete card list was located. It says the retail box includes one printed `取扱説明書` (instruction manual), one `かんたんガイド`, and six `手元ガイド` cards; this confirms those materials exist in the box, not that their full contents are published online. The website's how-to content points players to the included guides for turn flow and recommended Pokémon by role, so the page itself is not a complete substitute for the manual.

The product is scheduled for 2026-11-12, after this check date. The Japanese edition is therefore useful as an official rules-design comparison and a future lead for resolving ambiguities, but cannot close the Chinese retail-edition verification gaps. It is a distinct edition and its component counts/rules must not be copied into the Chinese specification.

## Primary official source

- [Official Japanese product page](https://www.pokemon.co.jp/ex/omaroke/) — live as of 2026-10-26; page names product, release date and components.
- Public how-to on that page covers: role draw/reveal; choosing one Pokémon from two dealt cards (basic rules summary); four-card starting hand; leader's opening draw of two; counterclockwise turns; basic starting level 3/green-heart HP; fainting/rescue via `キズぐすり`; and high-level victory conditions.
- It directs readers to the included `手元ガイド` for turn sequence and `かんたんガイド` for role/Pokémon recommendations. This is affirmative evidence that the web how-to omits implementation detail.
- Official box contents: 60 Pokémon cards, 108 play cards, 6 role cards, 6 hand guides, 1 instruction manual, 1 quick guide, 4 sheets of markers, and 30 sleeves. These are total component counts only; the page does not name or enumerate every card or its text.
- The page's linked `howtoplay_img_*` illustrations are explanatory images, not a linked PDF. Browser source lookup found no rulebook download link. Official site search for the Japanese product/manual/card-list terms surfaced the same official page, not a manual or catalogue.

## Completeness and comparison value

### Direct card-showcase audit — 2026-10-26

Inspected the rendered page and its DOM-backed image elements. The two scrolling card rows contain 48 image instances but only 23 distinct image URLs; the rows repeat images to create continuous scrolling. There are also four separate role-card illustrations elsewhere. The showcased images mix Pokémon and play cards, so 23 is NOT a Pokémon roster count. Example visible cards include Gyarados, Golduck, Persian, Nugget and attack/dodge commands. No complete card-by-card quantity list or all-forms index is provided by these rows; the product's 60/108/6 counts are physical component totals, not counts of distinct designs. Thus the website supplies useful individual card-face references, but not a verified exhaustive card/deck catalogue. Do not enumerate guessed image filenames to manufacture missing coverage.

| Material | Available publicly from official Japanese source? | Complete? | Can settle Chinese edition? |
|---|---|---|---|
| Basic public rules overview | Yes, on product page | No; delegates details to in-box guides/manual | Comparison/reference only |
| Retail Japanese manual | Confirmed as a box component; no public downloadable copy located | Not accessible in this check | No; separate edition, but may help identify analogous concepts once acquired |
| Full Japanese Pokémon/play/role card catalogue | No catalogue found; page only gives aggregate counts and some visual examples | No | No |
| Japanese correction/FAQ/card database | No product-specific one found in official search | No evidence of one | No |

The public page confirms a 4–6 player product, while the Chinese materials in the project concern another edition. Even matching names or mechanics would need card-by-card confirmation: do not infer identical role distribution, Pokémon/card pool, action timing, or counts.

## Sources and search trail

- Primary page opened directly: https://www.pokemon.co.jp/ex/omaroke/
- Focused official-domain queries: `site:pokemon.co.jp/ex/omaroke お前、もしかしてロケット団？ ルール PDF`; `site:pokemon.co.jp/ex/omaroke カード一覧`; and searches for the exact product title with `取扱説明書`, `カード 60枚 プレイカード 108 一覧`, and Pokémon Center Online.
- Search results returned the official product page and secondary preview/unboxing coverage, but no official PDF/catalogue endpoint. Secondary previews are not treated as official manual/card evidence.

## Recommendation for rules gate

Keep every Chinese retail blocker listed in `rules-evidence.md`. Use the Japanese page only to inform comparison questions. Recheck the official page after the Japanese release (2026-11-12) for a newly published manual/FAQ; otherwise, a physical copy or official confirmation would be needed to inspect the included manual and all 174 cards. This is a research finding, not legal advice.
