# Gameplay milestone9 — Growlithe /2026-10-28

## Result

9combat-supportedgroups/27faces;133regressiontests pass. GrowlitheLv1/Lv2/ArcanineLv3 are fully integrated within the development slice.11groups/33faces have readable effect text, including newly reviewed Vulpix which remains reference-only.31of40groups lack complete executable effects. This does not make the random40-group setup or original108-card deck a complete playable game.

## Source review

Sol transcribed6faces/8moves from4existing saved photos in reviewed-pokemon-batch-4.json/.md. Root independently viewed all4 originals, confirming Chinese text, HP, move numerals, weather comparisons, ability optionality and source hashes. GrowlitheLv1FireFang2 has no extra paragraph; Lv2Flamethrower2 has afterpositive-damage intense-sun burn; Lv3HeatWave2 targets up to2 in range, with the same afterdamage judgment for each settlement. Red flame heading symbols stay unresolved; no additional costs/elements inferred.

Justified 正义之心 exact supplied wording: 在你的出牌阶段限一次，你可以将任意张手牌交给一名其他训练家，然后若你因此失去了所有的手牌，你视为使用一张【接招吧！】。

## Implementation and interpretations

- Choose1ormore distinct real hand cards, of any kind/weather, and one other living trainer. Recipient is not distance-limited by the trait text; any resulting command move retains normal range/target restrictions. Transferred cards preserve exact identity/metadata and enter recipient private hand. Public log gives a count, no card names/IDs.
- Partial gift spends Justified once per trainer Play, consumes no move/command/Power, and has no target list. Giving the whole hand atomically commits current Pokémon's command move and its explicitly chosen targets. Server validates the entire action before transferring anything.
- Virtual command uses card:null,virtualCommand:true; no physical command or weather is manufactured, no unrelated card discarded. It consumes normal move/one-command-Pokémon locks and source Power. Existing defense, damage/status/rescue/deployment/results run normally. Recipient can use a just-received Dodge. Synchronize has no fictional card to obtain.
- Once-per-Play flag persists through switching/retries/restart; resets on new trainer turn. Action is ownPlay only, no pending responses/votes/spectators. Dead/self/unknown recipients, duplicate/foreign/empty card lists and excess/malformed/missing targets reject atomically.
- Explicit conservative interpretations beyond verbatim text: require at least1 actual card, so an alreadyempty hand cannot produce a free command. Whole-hand donation is unavailable if the consequential command is illegal (usedmove, differentcommandusinginstance, sleep/confusion lock etc.), rather than transferring cards then silently skipping it. Partial donation remains allowed when at least1card stays. Because virtual commands have no printed sunny weather, paralysis cannot meet its weather restriction for all-hand donation; partial donation still accepts anyweather. These avoid invented weather or skipped source consequences and are not represented as extra printed clauses.

## Interface

New native gift dialog shows own card names/weather, recipient selection, and targets only when giving all. Entire-hand target commitment is explicit before final confirmation. Selections survive normal polling; Cancel sends no action. Browser QA found and fixed low contrast/overlong spacing; final6card/2target dialog fits1280×720. English/Chinese labels, zero-card and missingrecipient/target disabled states are present. Existing arena geometry/themes/cameras, centered3levelhover, cardclickdetails/separateChoose and standalone form art remain intact.

Vulpix reference text now includes Drought and both moves where printed; sunny-card cost is shown separately from command cost in inspector/Fieldguide. Its effects remain unavailable until interruptible global judgment replacement, replacement-card zones/priority, and sunny-paid non-command moves are implemented. Drought must affect all judgment callers, not just Vulpix attacks; do not enable an ability-free Ember. Unsupported/mixed-roster rooms remain incomplete development scenarios.

## Validation and evidence

- npm.cmd test:133pass/0fail.22 independent Sol cases in app/test/growlithe-pokemon.test.js cover printed moves/independentburnjudgments/zero/Dodge/protection, partial/whole gifts, exactcardzones, no fictionalSynchronize, receivedDodge, six-seatdistance, authority/privacy, malformed/stale fields, move/status restrictions, retry/restart/switch phase limits and resetonnextturn. Existing111tests stillpass.
- Server and client JS parse; identical source/public catalogues; enabled9/27 and effectreview11/33; all6newface sourcehashes match.
- Isolated4174 fixtures firstcompleted legal identity/draw/choose setup, then explicitly seeded species/levels/cards. Main4173 rooms and productiondeal/randomness unchanged.
- Browser5gameplayclients: Arcanine/source, recipient, secondtarget, observer, plus ChineseGrowlithe/source. Sourcegaveall6cards: hand6→0; recipient4→10. Newly receivedDodge canceled firsttarget settlement; that target stayed4/4HP andhand10→9. Secondtargetpassed:2damage/burn,2/4HP. Spectator0handcards/0reservecontrols.
- Chinesepartialgift selected clearcommand andthunderstormDodge:source6→4, recipient4→6, noresponse/move, abilitygonebutnormalcommandstillenabled. All5clients had0warnings/errors. Mainpreview Fieldguide checked Vulpixcosts/pendinglabels and Arcaninesupportedtext/art.
- Images: justified-gift-preview.jpg, justified-gift-zh-preview.jpg, heat-wave-settlement-preview.jpg.

No new assets downloaded. Original108-card counts/weather, held-item lifecycle/Mankey, remainingPokémon, completePotionrescue and hosting remain pending. The development deck remains6command/6Dodgeperseat,allintensesun.
