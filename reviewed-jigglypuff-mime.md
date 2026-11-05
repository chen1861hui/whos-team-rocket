> Root signoff and implementation — 2026-11-05: both events execute in combat preview;1,099 tests pass. See gameplay-milestone-32.md for final contracts, Chlorophyll card-range correction and browser evidence. The source review below distinguishes the two printings; retail quantities stay gated.

# Jigglypuff and Mr. Mime event source review — 2026-11-05

Independent re-view of the already-preserved older O03 sheet and Master Edition video screenshots. No discovery, browsing, downloads, engine/UI/tests/catalogue changes. Root signoff and executable status are separate from this source record. Reading-only enlargements were saved outside Git; they add no pixels or source evidence. The JSON separates exact Chinese, icon notation, printing differences and recommended policies. English names are working UI translations.

| Source | Preserved file | SHA-256 |
|---|---|---|
| O03 | `research-assets/user-older-edition-2026-11-04/share_d5d99ad9094dafd0a484315a59b80816.png` | `71dc0eb1e4dee2ed352e891055b8fd13f4590162cb64d6e1bd4267fd67cdb4b2` |
| BV-jiggly | `research-assets/bilibili-BV1juYi6UEkv/frame-20m40s-jigglypuff.jpg` | `497067b27f413b6ed1b6a2f938bdf6a79739017e15961eac2f04576a43ba12a7` |
| BV-mime | `research-assets/bilibili-BV1juYi6UEkv/frame-21m30s-mr-mime.jpg` | `b9dd43ad4bd8b2b6f55b512d03a30e37d725b92d0a47bb3073525119032561d6` |
| R06 | `research-assets/xiaohongshu-rulebook/06-rescue-basics.webp` | `46d2c939704f84ad87bce58f9ba19d6bb4ba3df77e94b6ae162bdb3fff38e2f1` |
| R07 | `research-assets/xiaohongshu-rulebook/07-targets-cards.webp` | `0c3df4526577355eeb0cf30751fa253f59cd59355bc794ba618084362ddd3847` |

The source video is https://www.bilibili.com/video/BV1juYi6UEkv/ . The Jigglypuff frame is approximately20:40, captured by the earlier Sol reader and independently viewed by root; no clock appears and no exact media time is reconstructed. The Mr. Mime frame visibly shows21:31; its manifest records observed media1290.349292s. Saved samples do not establish continuous viewing, card copies or a retail manifest. O03 remains explicitly user-described older printing. Weather differences can be card variants and do not alone prove mechanical printing differences.

## Jigglypuff’s Performance / 胖丁的表演

Master face, line breaks normalized and printed weather icon named editorially:

> 在你的出牌阶段对一只出战宝可梦使用。目标宝可梦对应的训练家进行一次判定，若结果不为[雷雨]，目标宝可梦陷入“睡眠”状态。

`[雷雨]` denotes the printed dark cloud/yellow lightning icon; those bracketed Chinese characters are not printed words. The Master event card itself has a heavy-rain weather icon. Its body test is NOT thunderstorm; do not confuse printed card weather with judgment condition.

Older O03 prints:

> 在你的出牌阶段对一只宝可梦使用。目标宝可梦对应的训练家进行一次判定，若结果不为[雷雨]，目标宝可梦陷入“睡眠”状态。

O03's target phrase omits 出战. This is a concrete visible wording difference: preserve it rather than silently asserting exact textual identity. The Master face supplies active-only permission for the current implementation; the older noun alone is not a reason to enable reserve targets. O03 card weather is clear. Both paragraphs agree on the target trainer making one judgment and conditional Sleep. Neither prints a Dodge response, additional hand payment or damage.

Working English: During your Play phase, use on one active Pokémon. Its trainer judges once. If the result is not thunderstorm, the target becomes Asleep.

The Master face has no other-target or distance clause. Booklet06 p07 makes distance conditional and explicitly lists Mr. Mime and most moves as examples; booklet07 p08's default-range clause concerns moves. Recommended policy: Jigglypuff can choose self or any distant active; its event is not a default Pokémon move. Effective Early Bird remains a specific target prohibition.

Judgment precedes status application. Existing status, Shield Dust and Vital Spirit do not print cannot-be-target language for this card and should not erase the instructed judgment. Use the shared judgment replacement/status pipeline, including Drought, one-status rule, effective Shield Dust/Vital Spirit and Poison Touch replacement. A finite empty deck gives no result, so not-thunderstorm is not satisfied. No after-damage hooks or Synchronize claim arise from non-damaging Sleep itself.

## Mr. Mime’s Trick / 魔墙人偶的戏法

The Master frame gives the complete paragraph, agreeing with O03's readable body:

> 在你的出牌阶段你选择一只在你的出战宝可梦的距离限制范围内的其他出战宝可梦并选择一项：1.获得其对应训练家的一张手牌；2.获得其携带的持有物。

Working English: During your Play phase, choose another active Pokémon within the distance limit of your active Pokémon, then choose: obtain one card from its trainer's hand; or obtain its held item.

The event user chooses the target and alternative. The target is another ACTIVE Pokémon, not self or a reserve; its corresponding trainer supplies the hand card or its active supplies the held item. The card explicitly uses the user's active distance limit. It does not instruct a weather judgment, a reveal of the whole hand, discarding a card, giving a new item, or automatically equipping the obtained item. It prints no Dodge/defense response. Master observed weather is intense sun; O03 observed weather is thunderstorm. These are actual-card weather variants, not conditional effect costs.

Recommended policy: expose hand-card choice as shuffled backs because only hand count is public; transfer the one selected real card with its identity/weather/metadata through shared gain handling. Taking the held item transfers the actual item to the user's hand, removes it from the target active and invokes meaningful held-item-loss hooks such as Mankey's Defiant; it does not discard the item or equip it on the user's Pokémon. Any eligible Pickup on gain remains shared behavior. Choose the hand alternative only with a real hand card available, and item alternative only with a held item; excluding an empty-both target is a conservative legality policy, not an added printed phrase.

Only source-backed range effects that apply to an event/card should modify its range. Do not automatically reuse restrictions or bonuses explicitly limited to Pokémon moves or command cards. Pin the original active target to avoid accidentally taking a newly deployed reserve's item after nested effects.

## Shared named target protection and limits

Reviewed active Kangaskhan's Early Bird says it cannot become the target of 胖丁的表演 and 魔墙人偶的戏法. Respect that before event commitment; a suppressed trait (Gas) loses the protection, and a reserve does not supply an active trait. This is a prohibition on targeting, separate from Sleep immunity and separate from all other events.

One actual event card is used once during Play. Keep physical identity, authority/retry/reconnect/vote rules and hidden-card privacy. Do not invent deck copies or weather distribution from the photographed stacks. This review enables no retail manifest, gameplay deck, engine effect or source photograph UI.
