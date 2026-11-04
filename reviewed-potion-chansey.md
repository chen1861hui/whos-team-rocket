# Reviewed Potion rescue and Chansey implementation

2026-11-04. Implementation branch codex/potion-chansey, base5309fc8. This supersedes the covered-Potion gate in reviewed-rhyhorn-chansey.md/json and reviewed-split-tools.md. Original source transcriptions remain attributable to their review dates.

## Sources and limits

Potion's full text is readable on both physical pairings in user older-edition image O03, research-assets/user-older-edition-2026-11-04/share_d5d99ad9094dafd0a484315a59b80816.png (SHA25671dc0eb1e4dee2ed352e891055b8fd13f4590162cb64d6e1bd4267fd67cdb4b2). Its ordinary injured active OR reserve heal2 and fainting-settlement heal2 are corroborated by Master Edition playback near22:10 in bilibili-BV1juYi6UEkv-source.md. There is no self-only or distance clause. Original booklet remains the rules basis; older-printing provenance remains explicit.

Chansey originals: research-assets/douyin-7684572630280187855/ede6e13c73ae2b6e.webp (Lv1; SHA256ede6e13c73ae2b6e151d23f58067349f2b2e1acfdf91bb56360b215cc48a0730) and d03c99a886622585.webp (Lv2/3; SHA256d03c99a886622585ed3e4e539c8f47a1c09cc142306e7d96d4014fffc606d826). Root re-viewed both; independent source reader/engine auditor cross-checked the contracts. Source photographs are references, never gameplay card faces.

## Potion and rescue contract

During Play, useTool {cardId,effect:'potion',targetId,slot} selects an injured living active or a legally visible reserve, any living trainer, without distance. Own hidden reserve is revealed when targeted; opposing hidden reserve details are not exposed. Heal2 caps at maxHP. Zero/negative HP cannot use ordinary healing to bypass rescue. Actual toolType must be potion-full-heal or potion-revive: no standalone synthetic Potion kind. Choosing either executable half consumes the entire physical pair once. Full Heal is unchanged; Revive is explicitly unavailable.

During fainting, respondBattle {decisionId,choice:'potion'|'healer',cardId} consumes one real eligible own card and heals the original active2. Negative HP is preserved: -2→0→2 needs two cards. At0 or below the SAME trainer receives a fresh decision ID and fresh response clock and can spend more cards or pass. Recovery atHP>=1 stops rescue immediately and continues the original settlement; no formal defeat/deployment or additional rescue actor occurs. All pass follows existing defeat processing. Queue remains current-turn-trainer first, in seating order. Actor and fainting Pokémon instances are pinned; legacy saved rescue decisions lacking the new private pins retain compatibility.

Rhyhorn's owner-only permission is checked across the current resolution and parent stack, so physical Potion and Healer stay restricted through nested Helmet/recoil/rescue. Healing is not damage or card gain and does not consume Power or trigger damage rewards. Exact retries, stale decision/revision/instance rejection, vote blocking, response timers and saved-room restart keep existing authority/atomicity contracts. Response shape rejects unrelated fields and pass-with-card payloads. Loading an existing battle upgrades potionSupported metadata without resetting rooms or injecting cards.

Only the current rescue actor receives own Potion/Healer card stubs. Observers and other trainers see public HP, acting trainer and the printed restriction, never eligibility derived from another hand. Public canUsePotion expresses permission, not card ownership. Bilingual native controls preserve a selection across polling/language changes for the same decision, then clear it on the fresh decision after each payment.

## Chansey contract

All three levels use Healer: during a rescue while asked, discard one intense-sun OR clear hand card as Potion. Any card kind qualifies for that weather conversion. It requires active, effective Chansey; a reserve, formally defeated instance, eliminated trainer or Gas-suppressed trait cannot convert cards. The active Chansey currently fainting at0/negative HP is still effective until formal defeat and can rescue itself. It cannot convert sunny cards during ordinary Play.

Lv1 HP3 and Lv2 HP4 have rainy Charm: discard one rain/thunderstorm hand card as move payment, select one OTHER trainer with a hand in normal move range, offer the existing defense response, then privately choose one shuffled card back to discard. No Pokémon damage or damage effects. Trainer labels omit Pokémon slots. The server remains authoritative if a target hand/instance changes.

Lv2/Lv3 Life Dew discards one intense-sun/clear hand card, ignores distance and heals each selected living active1 through separate normal response settlements. Healing does not consume reinforcement markers or cause damage hooks. Explicit implementation policy: ACTIVE ONLY and AT LEAST ONE target. The card says any number of Pokémon but does not explicitly name reserves; booklet R07's reserve prohibition explicitly concerns command cards, so it is not claimed as a printed blanket ban on all non-command moves. Zero targets are not explicitly granted. Preserve this narrow conservative interpretation until a specific clarification supports expanding it.

Lv3 HP5 uses command Double-Edge damage2 with the already-shared optional +1 boost. Source HP loss/recoil follows receiving effects and rescue; it remains HP loss, not damage. Existing Kangaskhan rules and all shared defenses/modifiers continue unchanged.

## Coverage and remaining work

40/40 reviewed groups and120/120 faces are combat-preview supported. Source/public catalogue bytes match; selection roster enables Chansey. Retail engineEligible/quantity/weather gates remain false. Production deck remains six command plus six Dodge per trainer, all intense sun. Tools use isolated actual-card fixtures until retail counts are verified. Events/items/Revive and complete retail deck are separate unfinished work.

1,010 tests pass (965 baseline +45 independently authored Potion/Chansey cases). Existing unsupported-roster guard tests now inject explicitly synthetic unsupported catalogue fixtures, retaining rejection coverage after all real groups became supported. Tests cover both physical pairings, ordinary/reserve healing, repeated negative rescue, all Chansey levels, Gas, nested Rhyhorn, Helmet/Double-Edge/Reckless, exact retries/restarts/clocks/votes/privacy and invalid inputs. Independent read-only engine audit found no concrete defect.

Browser QA used four trainers plus spectator on isolated4174 after legal readiness→identity→five unique draws→choose2→mandatoryDraw, then controlled fixture seeding. Actual UI verified -2→0→2 with same actor/fresh selection, language draft persistence and observer privacy; Chansey self-Healer0→2 with rainy card excluded; Life Dew self+distant target +1 each with Power retained; Charm one hidden-card discard and no HP change; Potion/Revive ordinary own-reserve use with whole-card consumption and reserve reveal. Double-Edge boost/recoil coverage in this batch is automated/independent engine audit, not a new browser run. Four clients' warning/error logs were empty. Evidence: potion-rescue-preview.jpg, chansey-healer-preview.jpg, chansey-life-dew-preview.jpg. Scripts, synthetic seat credentials and private QA rooms stay outside Git.
