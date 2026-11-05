> Implementation checkpoint — 2026-11-05: both events now execute in combat preview. See gameplay-milestone-31.md for final contracts, corrections,1,055 tests and browser evidence. Retail quantities/engineEligible remain gated; original source review follows.

# Mewtwo and Mew event source review — 2026-11-04

Root's earlier visual readings and an independent Sol re-view agree on the complete event text below. The independent pass viewed the preserved O03 sheet and the saved Master Edition Bilibili frames at approximately24:16 and24:23, and recomputed all three hashes. No browsing, downloads, new discovery, engine, UI or catalogue edits. `reviewed-mew-events.json` separates exact Chinese, working English, printed fields and recommended implementation policies. This is source review; executable state is established by the later implementation checkpoint, not by this document alone.

| Source | Saved original | SHA-256 | Evidence |
|---|---|---|---|
| O03 | `research-assets/user-older-edition-2026-11-04/share_d5d99ad9094dafd0a484315a59b80816.png` | `71dc0eb1e4dee2ed352e891055b8fd13f4590162cb64d6e1bd4267fd67cdb4b2` | User-described older sheet;1440×1920, encoded WebP despite extension; complete paragraphs |
| BV1juYi6UEkv, ~24:16 | `research-assets/bilibili-BV1juYi6UEkv/frame-24m16s-mewtwo.jpg` | `8589397655730f674f8205a20f4f4a3407f8a30448fd7d050e0cef149684e46a` | Master Edition Mewtwo face; observed media1455.775618s |
| BV1juYi6UEkv, ~24:23 | `research-assets/bilibili-BV1juYi6UEkv/frame-24m23s-mew.jpg` | `f558ab0516631746f209aae2ec9f7a0c5a19d41c235bc46de835c91fd4eb9479` | Master Edition Mew face; observed media1462.998302s |

Source URL: https://www.bilibili.com/video/BV1juYi6UEkv/ . The two saved player screenshots corroborate the sheet's wording and icons; player controls partly overlap Mewtwo's bottom line, so the sheet supplies the complete exact paragraph. These are samples, not continuous viewing or a physical-copy inventory. The existing older-sheet and video ledgers remain unchanged. Reading crop coordinates from original top-left: O03 Mewtwo x1155–1405/y900–1025, Mew x1165–1410/y1260–1405; video Mewtwo x530–767/y554–623, Mew x565–784/y518–613. Independent crops stayed in memory.

Both faces print 事件 and the clear-weather sun/cloud icon. No command icon, additional payment numeral, Pokémon level/HP or physical-copy quantity is printed. Weather is the actual card's clear weather, not a judgment or extra payment requirement. English names are working UI translations. The correct Chinese title is 超梦的威压; older project references to 威胁 were transcription errors, not an established edition difference.

**超梦的威压 / Mewtwo's Threat**, exact Chinese with normalized line breaks:

> 在你的出牌阶段对所有其他训练家的出战宝可梦使用。从你的下一位训练家开始，按行动顺序结算。除非目标宝可梦对应的训练家打出一张【快躲开！】，否则目标宝可梦受到超梦造成的2点伤害。

Working English: During your Play phase, use on all other trainers' active Pokémon. Starting with the trainer after you, resolve in action order. Unless each target Pokémon's trainer plays one Dodge!, that target receives2 damage caused by Mewtwo.

The printed scope includes every other trainer's active, including distant trainers, and excludes self and reserves. Start with the next trainer in the normal action order. It expressly assigns each targeted active's trainer the response; no general third-trainer Dodge permission is added. A response costs one actual card. Without the required response, the event deals2 damage; it is not HP loss. The source is Mewtwo, not the using trainer's active Pokémon.

**梦幻的祝福 / Mew's Blessing**, exact Chinese with normalized line breaks:

> 在你的出牌阶段对所有训练家的出战宝可梦使用。从你开始，按行动顺序结算。目标宝可梦对应的训练家选择一项：
> 1.该宝可梦回复2点体力；
> 2.该宝可梦升1级。

Working English: During your Play phase, use on all trainers' active Pokémon. Starting with you, resolve in action order. Each target Pokémon's trainer chooses one: that Pokémon recovers2 HP; or that Pokémon rises one level. The Chinese says 选择一项, with no added 需.

This includes self and distant trainers, and excludes reserves. The target's trainer chooses, not the event's user choosing for everyone. There is no printed Dodge response, status cure, drawing, reserve effect or optional decline. Neither event has a distance restriction. Booklet06 p07's distance rule is conditional; it must not silently limit these explicit all-trainer scopes to neighbors.

## Recommended bounded policies

The following are implementation interpretations or consequences of combining the face with the accepted booklet. They are not additional printed clauses.

- Use one physical event card from the actor's own hand during their Play phase; keep it outside draw/discard circulation through the whole queue and any nested effects. Settle it once at final cleanup unless a legitimate card claim has already transferred it. Do not invent event quantities/weather variants or add them to the production deck from these samples.
- Capture the ordered trainers and original active Pokémon instances when the event begins. Skip eliminated trainers and original targets that are defeated or no longer active; a later reserve must not inherit its predecessor's event slot. Preserve the queue, actors, original card and continuation across private decisions, disconnect/restart and nested rescue. Immediate victory terminates the remaining queue under the shared victory rule. This capture policy is not spelled out by either paragraph.
- Mewtwo's printed 打出 is distinct from 使用 in booklet07 p09. Conservative response policy: accept one actual Dodge card, or decline/expire into damage. Do not automatically offer Levitate's use-as-Dodge conversion or Sand Veil's counts-as-using-Dodge judgment, because their reviewed wording grants 使用 rather than 打出. This restriction is a chosen literal policy; the sources do not explicitly enumerate those interactions. Likewise Lock-On's ban on 使用 Dodge, Compound Eyes' move/use restriction, and Keen Eye's move-Dodge replacement do not automatically govern this event's played response. Do not treat the event as a normal move-defense window.
- Pressure/Cute Charm react to command targeting, and Power/command-user/move-use limits concern command or move use; neither event invokes them. Burn's move-damage cap does not make Mewtwo damage1. Early Bird names only Jigglypuff's Performance and Mr. Mime's Trick, so it gives no immunity to these events. Gas still suppresses actual target traits, but it does not suppress a printed event effect.
- Mew's heal option is legal at full HP: the face has no injured-target condition. Apply the ordinary cap, producing a zero-heal result when full. This is an explicit interpretation of an unrestricted heal option, consistent with the existing healing helper. Offer evolution only below level3 under the booklet's level limit; never create level4. A level3 target still resolves the heal option, including a harmless no-op at full HP. Keeping a one-option mandatory choice or automatically resolving that sole heal are UI policies, not different printed effects. Do not skip all full-health targets or force a below-level3 target to evolve merely because its heal would be zero.
- Mew's evolution preserves the Pokémon instance, injury-marker count, status, reinforcements, held item and turn restrictions under booklet07 p08. HP follows the maximum-HP difference. It is not entry and does not spend the separate optional turn-end evolution. Healing is not damage, does not cure status and does not run receiving-damage hooks. There is no normal move-Dodge response to Mew.

## External Mewtwo damage contract

Booklet08 p10 permits a damage source belonging to no trainer, explicitly including Mewtwo's event. Represent external Mewtwo as a sourced event channel with no player owner. A null owner is not permission to relabel it source-free or substitute the event actor's active. Do not apply that active's Power, Burn, Blaze/Guts or other source-move modifiers, target it with retaliation, grant it defeat rewards, or remove its markers because it allegedly attacked.

Run the target's ordinary receiving pipeline: damage immunity already granted to that target, Defense, effective Multiscale, Shed Skin payments and Marvel Scale where applicable; then HP loss from damage, shared fainting/Potion/Healer rescue, defeat/deployment and immediate victory. Continue after-damage effects only for the original surviving target. Defense cleanup belongs to the event card's end, not each target's response window. Battle Armor's newly gained Defense follows the existing same-card cleanup rule. Water Absorb still judges after positive event damage, including after rescue. Oblivious still grants its outside-own-turn protection. Gas and item suppression retain their normal scopes.

Synchronize can claim the actual damaging event card after damage, subject to the existing one-card/one-claim boundary. Preserve original event ownership and queue even if the card moves into a target's hand before remaining targets finish; later cleanup must not discard or duplicate it again. A later Synchronize must not obtain a second copy. Normal gain/Pickup handling applies to a real claim.

Source-dependent effects need a distinct external-source check. Static/Poison Point status, Rocky Helmet retaliation and Cursed Body's source-trainer hand gain must not be redirected to the event actor or an unrelated active. The photographed sources do not establish an off-board Mewtwo HP/status object, a trainer hand for it, or a useful target for those effects; conservative policy skips those unavailable external-recipient interactions. This is narrower than disabling all after-receiving hooks: Water Absorb, Battle Armor, Synchronize and Oblivious remain meaningful.

## Superseded source gap and remaining limits

`pending-mewtwo-threat.md` remains a historical record of the original P03's tiny/covered pixels. Its acquisition/transcription blocker is superseded by O03's complete text and these Master Edition saved frames. Do not ask for those already-preserved sources again or treat the old overlap as a current implementation blocker. The current-P03 covered pixels themselves remain covered; corroborating sources supply text rather than restoring missing image detail.

Neither the complete older sheet nor two saved video frames establishes every physical card-name/pairing × weather copy count. Existing Master Edition total108 game cards is separate from a verified per-card manifest. Retail `engineEligible` gates and the development deck remain separate decisions. This review supplies no additional edition-switch permission and rewrites no source-ledger history.
