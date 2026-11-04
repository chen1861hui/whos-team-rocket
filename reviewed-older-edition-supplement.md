# User-supplied older-edition supplement — 2026-11-04

The user supplied ten images and identified them as an older version, asking whether they provide enough evidence to continue. They materially improve the available card evidence. All ten originals are preserved byte-for-byte under `research-assets/user-older-edition-2026-11-04/`; `manifest.json` records user image order, explicit supplied paths, SHA-256, byte size, decoded dimensions and actual file format. Their `.png` filenames do not establish their encoded format (O03 is WebP). Original bytes are retained. No source photographs are added to application routes or gameplay presentation.

The existing photographed booklet remains the current rules basis. This supplement establishes readable OLD-PRINTING card text and can fill documented source gaps; it does not prove the two printings identical or replace already-established newer rules. No gameplay code, deck quantities or Pokémon statistics change in this source-review checkpoint. Last tested implementation remains965 passing tests on `e85890a`.

O03 is user image3, `share_d5d99ad9094dafd0a484315a59b80816.png`, 1440×1920, SHA-256 `71dc0eb1e4dee2ed352e891055b8fd13f4590162cb64d6e1bd4267fd67cdb4b2`. Root and an independent reader inspected its tool/event faces. Reading crops are outside the repository; enlargement adds no source detail.

Potion / 伤药 appears on TWO separate physical pairings: Potion/Full Heal and Potion/Revive (活力碎片). Both printed Potion halves give the same ordinary/rescue text. Normalized line breaks:

> 你选择一项：
> 1.在你的出牌阶段对一只已受伤的出战或备战宝可梦使用，目标宝可梦回复2点体力；
> 2.在一只宝可梦昏厥结算中对其使用，目标宝可梦回复2点体力。

Working English: Choose one: during your Play phase, heal an injured active OR reserve Pokémon2HP; or during a Pokémon's fainting resolution, use on that Pokémon to heal2HP. Neither clause says your Pokémon. This establishes the formerly covered rescue amount for this older printing. The ordinary target explicitly includes reserve: retain that provenance rather than treating earlier current-P02's incomplete visible active-target fragments as a complete exclusion of reserves. Current P02 itself remains physically overlapped; the new image supplies independent older-card evidence, not recovered hidden pixels in P02. A later implementation should cite this supplement for those added clauses and retain the booklet's existing rescue order/termination and reserve-reveal rules. Do not collapse the two physical pairings into one card identity.

Full Heal / 万灵药, Rare Candy / 神奇糖果 and Nugget / 金珠 have compatible wording/mechanics with the currently reviewed P02 halves. Root's focused O03 Full Heal crop confirms **特殊状态** in both places, matching current P02; an initial independent reading of 异常状态 was incorrect and is not an edition difference. Candy remains active belowLv3→+1level; Nugget remains one trainer draws2, with no giving/other-trainer clause. No copies/weather distribution follows from matching effect text.

O03 event text, working English names retained as translations:

**超梦的威压 / Mewtwo's Threat**, clear-weather event:

> 在你的出牌阶段对所有其他训练家的出战宝可梦使用。从你的下一位训练家开始，按行动顺序结算。除非目标宝可梦对应的训练家打出一张【快躲开！】，否则目标宝可梦受到超梦造成的2点伤害。

Use during Play on every other trainer's active Pokémon, in action order starting with the next trainer. Unless that target's trainer plays one Dodge, it receives2 damage caused by Mewtwo. Root also rechecked the CURRENT P03 title crop: it prints **超梦的威压** too. Earlier project records saying 威胁 were a transcription mistake, not established edition variation. The older full paragraph supports the current P03's readable scope/damage and resolves the older image's ordering text. Current P03's own tiny wording remains separately bounded in its source record. External Mewtwo source, event response permissions, actual-card ownership and nested damage/rescue remain implementation work.

**梦幻的祝福 / Mew's Blessing**, clear-weather event:

> 在你的出牌阶段对所有训练家的出战宝可梦使用。从你开始，按行动顺序结算。目标宝可梦对应的训练家选择一项：
> 1.该宝可梦回复2点体力；
> 2.该宝可梦升1级。

Use during Play on all trainers' active Pokémon, starting with self in action order; each target's trainer chooses heal2 or raise1level. This establishes the older full chooser/choices; the current P03 overlap did not independently establish those covered words. Level3/full-health choice legality and exact event response/damage machinery must be handled deliberately during implementation rather than inferred from the photograph's presence.

Other value: O03/O06 expose additional event, reinforcement-tool and held-item faces that were missing or overlapped in earlier posters; O05 supplies identity-card faces, O09 status/reinforcement references, O10 pictured tokens, and O02/O07/O08 additional Pokémon face references. These inventories are not a claim that every paragraph has been independently transcribed or implemented. Existing Pokémon reviews/statistics stay authoritative until a concrete discrepancy is checked.

**Remaining actual gap:** no printed per-card copy counts or complete weather-variant quantity table is established by these ten photos. Offset stacks, repeated display cards, photographed tokens and advertising layouts cannot be counted as the retail deck manifest. The exact older printing/date is also not identified. There is enough source material to continue card/rescue development without another general rulebook/card request; keep these narrow quantity/printing limits explicit.
