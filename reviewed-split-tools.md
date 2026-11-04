> 2026-11-04 implementation update: Potion rescue and all Chansey faces are now executable in combat preview. See reviewed-potion-chansey.md. Earlier covered-text/reference-only gates below describe the original review checkpoint; Revive and retail deck quantities remain unimplemented/unverified.

# Full Heal, Rare Candy and physical split tools — 2026-11-04

Root and an independent Sol reader rechecked the already-saved P02 poster and booklet06/07 originals. No discovery, downloads or source-image edits. Enlarged reading crops were generated only in memory. This record distinguishes printed effects from implementation and privacy policies. The printing remains unidentified; working English is not English-printing evidence.

| Evidence | Saved original | SHA-256 |
|---|---|---|
| P02, 790×4046 | `research-assets/provided-previews/mmexport1793008989807.jpg.jpeg` | `c6631cca3dc6a24dc9a9272d3604a2a04bcb2856bd78a675871bcb3dedf11b9c` |
| R06, printed p06–07 | `research-assets/xiaohongshu-rulebook/06-rescue-basics.webp` | `46d2c939704f84ad87bce58f9ba19d6bb4ba3df77e94b6ae162bdb3fff38e2f1` |
| R07, printed p08–09 | `research-assets/xiaohongshu-rulebook/07-targets-cards.webp` | `0c3df4526577355eeb0cf30751fa253f59cd59355bc794ba618084362ddd3847` |

The hashes were recomputed from local bytes. P02's split-tool reading region is approximately x155–620, y2830–3095 in the original, measured from the top-left. The poster shows one physical Potion/Full Heal card and one physical Rare Candy/Nugget card, each with clear-weather sun/cloud icon and 道具 bottom bar. It establishes these pictured faces, not physical deck quantities or a complete weather distribution.

Full Heal / 万灵药 reads exactly:

> 在你的出牌阶段对一只处于特殊状态的出战或备战宝可梦使用。恢复目标宝可梦的特殊状态。

Working English: During your Play phase, use on one active or reserve Pokémon that has a special status. Cure the target Pokémon's special status. The text uses 恢复 and does not restore HP. It does not say your Pokémon, other trainer or adjacent trainer. The eligible zone is explicitly active OR reserve. It does not grant status immunity, prevent a later status, or undo an already resolved turn-start consequence after its status marker was removed. Removing a status does not trigger Poison Touch's status-gain replacement. Any subsequent marker effectiveness follows the ordinary status rules.

Rare Candy / 神奇糖果 reads exactly:

> 在你的出牌阶段对一只不处于等级3的出战宝可梦使用，目标宝可梦提升一个等级。

Working English: During your Play phase, use on one active Pokémon that is not level3; raise that Pokémon by one level. Any living trainer's active Pokémon may be chosen, including self. Reserve Pokémon and level3 Pokémon are excluded. Booklet07 p08 says evolution preserves reinforcement, special status and the injury-marker count; the HP change follows the maximum-HP difference. It also preserves a physical held item. Evolution is not reserve entry and does not trigger an on-entry trait such as Intimidate. This tool's Play-phase level increase does not spend the separately offered turn-end evolution.

Booklet06 p07 says exactly:

> 各训练家的出战宝可梦与出战宝可梦之间有距离，有些操作会受到距离限制（如使用【魔墙人偶的戏法】和使用大部分招式）。
>
> 在距离限制下，你将只能选择你或与你相邻的训练家，以及这些训练家的出战宝可梦作为目标（见右图图示）。

This defines what a distance restriction does when an operation has one. It does not impose a distance restriction on every game card. Booklet07 p08's default single-target/in-range clause explicitly concerns moves. Full Heal and Rare Candy have no printed distance condition, so both use all living trainers without an added adjacency requirement. Full Heal's explicit reserve permission governs its target zone. No Speed, Chlorophyll or Sniper grant is needed to reach a distant legal target with these tools.

Booklet07 p08 says that when a face-down reserve becomes a card's target or becomes active, it must be revealed immediately and its corresponding level1 form found. A successful Full Heal on a face-down reserve therefore reveals that Pokémon; the card does not permit its identity to stay hidden after legal targeting. The private identity/status must remain hidden before that event. Revealing a reserve as a tool target is not entry: it remains reserve, and its trait, moves and held-item effects remain inactive. Cure the stored reserve status rather than treating its inactivity as absence of a status.

Current engine boundary: all supported status sources affect active Pokémon, and every switch permanently reveals the incoming reserve. Consequently an opposing unrevealed reserve cannot currently have a reachable special status. Candidate generation may omit opposing unrevealed reserves WITHOUT reading their status or catalogue identity. It must permit the actor's own valid reserve and any revealed valid opposing reserve; a legal own hidden-reserve fixture is revealed on use under the same booklet rule. This omission is a bounded consequence of current reachable state, not a printed Full Heal prohibition on hidden opposing reserves.

Before enabling a future event/tool that can place status on an unrevealed opposing reserve, extend this targeting boundary. Do not expose hidden status through a filtered legal-target list, target-dependent can-use flag, highlighted reserve, detailed error or passive projection. The booklet establishes reveal-on-target but does not specify a digital protocol for checking a hidden target's status condition. Such a protocol must be designed and documented before that future source is enabled. This batch invents no blind illegal use, card consumption, refund or free reveal action.

Booklet07 p09 says a split tool combines two tools and only ONE is selected when the card is used. Represent it as one actual card with one physical ID, one weather and one zone, carrying alternative effect metadata. Choosing Full Heal consumes the entire Potion/Full Heal card; choosing Rare Candy consumes the entire Rare Candy/Nugget card. The unchosen half does not remain in hand or become a second card. Other generic transfers, judgments, hand discards and weather payments must also move that same physical card once, with both alternatives staying attached as metadata. Do not manufacture standalone duplicate cards or lose an unavailable half when moving the physical card.

These are trainer-used tools, not Pokémon moves or Take this! commands. Their use does not spend Power, the command-user allowance or a move-use allowance. Paralysis's sunny-command restriction does not prohibit using a tool; Gas does not suppress a tool's printed effect. They do not open a normal Dodge response, trigger Pressure or deal damage. Play timing, actual own-hand card identity and legal target conditions still apply. On use, the physical tool goes to discard under the normal game-card operation; it does not become a held item. Successful retries must not apply the tool twice or duplicate the discard.

Potion remains partially covered. Ordinary healing2 is visible, but full target wording and the rescue clause/amount remain unverified. Enabling Full Heal does not enable the Potion half or resolve Chansey's Healer dependency. Keep that alternative explicitly unavailable and preserve the physical shared card.

The adjacent Nugget / 金珠 paragraph is now read exactly as:

> 在你的出牌阶段对一名训练家使用。目标训练家摸两张牌。

Working English: During your Play phase, use on one trainer. The target trainer draws two cards. Original body region approximately x368–609, y2960–3040. This corrects the older provisional assertion that the card is given to another trainer. The face has no 其他 and no giving clause. No retail quantities are inferred by completing these paragraphs.

Nugget integration supersedes the initial Full Heal/Rare Candy batch's implementation gate: Nugget is now executable in combat preview. Potion remains unavailable for the separate covered-text reason above. The printed target is one trainer, so Nugget permits any living trainer, including self and a distant trainer. It does not target, reveal, heal, evolve or inspect either Pokémon slot. Its API descriptor uses `targeting:'trainer'`, with targets shaped as `{targetId}`, and its use submits `targetId` without a Pokémon `slot`. Full Heal and Rare Candy retain the existing default Pokémon-target descriptor and explicit active/reserve slot. These API fields express the distinct printed target kinds; they are not extra card text.

Use one real Rare Candy/Nugget physical card from the actor's own hand. Remove it from that hand before drawing, retain its complete physical identity and alternative metadata outside the draw/discard circulation while the effect resolves, and discard that same card exactly once after both the draw batch and any immediate Pickup draw complete. The card is not transferred to the target. Booklet07 p09 states that a used card performs its effect, and booklet05 p05 places a used game card into discard after use unless specified otherwise. Holding the resolving card outside circulation is the implementation of that lifecycle, preventing Nugget from refilling the pile with itself during its own effect.

The printed effect draws two cards. Explicit finite-supply policy: draw `min(2, actual available draw-pile plus discard-pile cards)` using the established real-card draw/refill path; if only one or zero cards exist, gain one or zero and still consume the used tool. The unavailable supply produces no fictional card and no automatic rollback/refund. This shortage policy is an implementation interpretation shared with existing effect draws, not a separately printed Nugget exception. The resolving Nugget card is not part of that available supply.

Gain the available ordinary Nugget draws as one batch through the shared card-gain helper, then apply ordinary Pickup rules. A living active Meowth below level3 with effective Pickup may make its normal once-per-global-turn extra draw when the gain occurs outside its own Draw phase. No actual gained card means no Pickup trigger. Gas, reserve inactivity and the existing own-Draw exclusion still apply. Nugget used during the actor's Play phase can trigger that actor's own Pickup when self-targeted; it does not become an own-Draw gain merely because the recipient is the actor. The same used physical tool stays out of the pile until Pickup also finishes, so an exhausted supply cannot recycle it as Pickup's extra card. Repeated use of distinct Nugget cards does not reset the shared Pickup allowance.

Nugget remains a trainer-used tool: it does not spend Power, the command-user allowance or a move-use allowance, and does not open Dodge or Pressure. It remains usable while Pokémon moves are blocked and its printed effect is not suppressed by Gas. The target's gained cards stay private under the normal hand projection. Retry, restart and stale-dialog guards must conserve the used card and apply the draw batch only once. Implementing Nugget does not establish additional physical copies or weather variants for the production deck.
