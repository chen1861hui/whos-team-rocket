# Douyin card-photo source audit

## Completed local acquisition and selection review — 2026-10-28 (current)

All **80 distinct observed gallery photos** are saved and hashed. The final 26 downloads used a non-Astra Sol worker with bounded direct transfers from already observed signed URLs; the previous 54 files were preserved. Do not repeat discovery or hanging media bundles. The manifest/checkpoint and `direct-transfer-results-20261027.json` record results. Actual carousel positions remain null except prior checked evidence; DOM ordinals are not confirmed slide numbers.

`reviewed-selection-roster.md` and `app/content/selection-roster.json` document visually reviewed name/level/HP for all 40 groups / 120 faces. This does not certify untranscribed effects, quantities or printing. Forty cropped public selection thumbnails derive from these photographs; full originals remain research-only. Only the three starter groups have executable combat effects. Older acquisition gaps below are superseded.

## Latest bounded acquisition and source review — 2026-10-27

Non-Astra Sol worker saved `acquisition-observations.json` and `acquisition-checkpoint.md` in the asset directory. It observed 80 distinct rendered photo URL paths; 53 match existing manifest paths and 27 remain unsaved. Only position 10 is confirmed against the visible counter and slide geometry; candidate DOM ordinals are not verified carousel indexes. **No new image download completed.** Existing 53 WebPs and manifest were preserved. Bundle stalled ~711 seconds; follow-up normal media download failed when the worker browser became unavailable. Root independently checked all 53 URL matches and distinct hashes. See the saved checkpoint for bounded resumption, rather than repeating inventory discovery or a hanging bundle.

Separately, six saved photos were transcribed and independently reviewed for nine Bulbasaur/Charmander/Squirtle faces. `reviewed-combat-spec.md` provides Chinese text, working English, hashes and uncertainty. Those nine faces are now reference data in both catalogue copies, with effects unavailable / `engineEligible:false` and unknown quantities. Gallery acquisition does not certify edition, card counts or playable eligibility. Historical descriptions below record the earlier inspection.

## Resolved source

- User short link: https://v.douyin.com/UJspw6Zv6KU/
- Resolved canonical page: https://www.douyin.com/note/7684572630280187855
- Title/caption: 展示《宝可梦 谁是火箭队》里的宝可梦牌。#宝可梦 #宝可梦谁是火箭队 #三国杀 看看有啥熟悉的技能（狗头）
- Creator: 猪皮拌年糕 (page displayed 2,200 followers and 117.1K likes at access time)
- Published: 2026-09-12 17:06:33, as displayed on the page.
- Format: Douyin note presenting a numbered, automatically advancing still-photo carousel. The in-player counter showed `1 / 80` through `9 / 80`; playback could be paused. No login was needed to view the card photos. Comments and following showed a login gate; no login or bypass was attempted.

## What the “80” establishes

`80` is the page's carousel-item count. It does not establish 80 distinct card faces, 80 physical cards, or a complete retail-deck manifest. A single displayed photo can contain more than one face: the directly observed `8 / 80` image shows Caterpie Lv.2 and Butterfree Lv.3 side by side. Separate downloaded page assets also contain pairs of level faces. The 80 claim must therefore be recorded as “80 carousel items,” with distinct card count and completeness left unverified.

The Douyin page title and the reviewed samples describe/show Pokémon cards. I reviewed the visible `7 / 80` and `8 / 80` screens and eight bundled image assets. These samples contain Pokémon faces only; I did not find a rule sheet, role card, trainer/action-card face, or other reference sheet in those samples. I have not inspected all 80 carousel items, so this does not establish that the full carousel is Pokémon-only.

## Legible mechanics and reading limits

### Directly observed at carousel item 8 / 80

The photograph contains these readable card faces:

- **绿毛虫 Lv.2**, HP 4, 干扰型. 特性 **蛹皮**: “当此宝可梦受到伤害时，你可以弃置任意数量的手牌，每弃置一张，此伤害值-1。” 招式 heading **撞击**, printed value 1; no additional effect text is visible.
- **巴大蝶 Lv.3**, HP 4, 干扰型. 特性 **复眼**: “其他训练家无法使用 [sun/weather icon] 的【快躲开！】抵消此宝可梦的招式。” Two move headings are visible: **吹飞** and **催眠粉**. The first move says it is not subject to distance limits and lets the player exchange the target's active Pokémon with its corresponding reserve. The second shows a judgment and a sleep-status effect. Exact icon conditions and some small move symbols/text need a larger, direct image review before mechanical use.

The card photo is clear enough to use for transcription, but its resolution/angle and printed symbols make some details uncertain. Preserve the bracketed icon uncertainty and do not encode these effects yet.

### Additional photos from the observed page assets

I used the page's observed `pageAssets` inventory and bundle function; I did not guess or enumerate asset URLs. Fifty-three image assets whose URLs were tagged `aweme_images` were observed and downloaded. All 53 also carry `biz_tag=aweme_images` and `s=PackSourceEnum_AWEME_DETAIL`, consistent with post-detail image assets. Eight bundled photos reviewed so far all show card faces matching the note. Recommended entries visible in the page DOM were unrelated video cards; their cover assets use different URL patterns. This is evidence against recommendation-image contamination, but I did not individually inspect all 53 images or save each DOM source node, so attribution is probable, not certified, for each file.

Their observed-asset ordinal is retained, but `imageIndex` is null in the manifest because the asset inventory does not associate an asset ID with the page's `1–80` counter. All 53 downloaded photos are in [research-assets/douyin-7684572630280187855](research-assets/douyin-7684572630280187855), with original URLs, download status, and attribution note in its `manifest.json`. The photos are WebP copies of what the page exposed, not original retail scans; signed source URLs may expire.

Sampled images (asset ordinal; carousel index not mapped) show:

- **妙蛙种子 Lv.1** (HP 3, 防御型): 特性 **叶绿素** permits one judgment per play phase, with distance-limit effects for the remainder of the turn if its result is 晴天; 招式 **寄生种子** restores 1 HP after dealing damage. The two small weather icons are not transcribed as rules here.
- **妙蛙草 Lv.2 / 妙蛙花 Lv.3**: both show 特性 **叶绿素**. The Lv.2 move **超级吸取** heals 1 HP after dealing damage; the Lv.3 move **终极吸取** heals 1 HP and draws one card after dealing damage.
- **穿山鼠 Lv.2 / 穿山王 Lv.3**: their **沙隐** abilities refer to using 【快躲开！】 when no held item is present and a sunny judgment; move text includes discarding a target trainer's hand card after damage. This supports the card face text but still needs review against an official selected edition.
- **瓦斯弹 Lv.2 / 双弹瓦斯 Lv.3**: **化学变化气体** allows discarding a hand card at a trainer's turn start to disable Pokémon abilities until that trainer's turn ends; moves **污泥炸弹** and **污泥波** apply 中毒 after a rain judgment. This demonstrates that the image set can expose exact Pokémon text, but does not validate timing, icons, or edition.
- **小火龙 Lv.1** and **卡咪龟 Lv.2 / 水箭龟 Lv.3** are also legible in sampled images. They show additional attack and held-item effects.

These photos are card-face evidence only. Creator, edition, prototype-versus-retail status, card quantities, completeness, and official corrections are not established by this post. Treat transcriptions as source-attributed leads and keep all unverified fields out of the playable engine. This aligns with the edition/evidence gate in [rules-evidence.md](rules-evidence.md) and [content-backlog.md](content-backlog.md).

## Access gaps

- The text-only web opener could not resolve the short link; a normal browser navigation resolved it. No CAPTCHA, login, or hidden-state request was used.
- One pageAssets inventory observed 53 probable post-detail photo assets, not all 80 carousel positions. A second inventory after advancing normally from 8/80 to 9/80 remained at 53. We did not claim full coverage and did not attempt to fetch unobserved media.
- The pageAssets inventory did not expose the relationship between each saved asset and an individual `1–80` carousel position. That is why `imageIndex` is deliberately null rather than inferred from filenames or asset order.
- Some icons and compact move text in carousel item 8 remain uncertain. Review original visible images/cards at larger resolution before promoting any effects.
