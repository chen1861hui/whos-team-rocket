## Nidoran and Diglett — 2026-10-30 (current)

**442/442 tests pass. Combat supports 24 groups / 72 faces**, adding Nidoran♂/Nidorino/Nidoking and Diglett/Diglett/Dugtrio. Poison Point uses the original damage source and a non-intense-sun judgment. Double Kick resolves twice through the shared repeated-hit flow. Uninjured Horn Attack/Megahorn gain1 damage. Arena Trap pauses ordinary/effect switching for optional discard-or-cancel responses. Bulldoze/Earthquake remove one marker after positive damage; Earthquake supports two targets.

GitHub repository: https://github.com/chen1861hui/whos-team-rocket.git. This batch is developed on codex/nidoran-diglett from9f900f1. Preserve the accepted arena, native cards, centered level hover and identity-first unique setup. Production remains six command/six Dodge per seat, all intense sun, with no invented retail quantities. All24 reviewed groups execute;16 groups remain. See gameplay-milestone-19.md and reviewed-nidoran-diglett.md/json. Older counts and no-Git statements below are historical.

## Caterpie and Weedle — 2026-10-29 (current)

**385/385 tests pass. Combat supports 20 groups / 60 faces**, adding Caterpie/Metapod/Butterfree and Weedle/Kakuna/Beedrill. Shield Dust blocks new statuses; Shed Skin discards selected own hand cards before HP loss. Compound Eyes filters other trainers’ actual intense-sun Dodges. Butterfree has rainy Whirlwind and sunny Sleep Powder. Beedrill’s Sniper removes trainer and move range limits. Fury Attack publicly reveals four actual cards and resolves one hit plus one per sunny card, with marker cleanup after the whole card.

All 20 effect-reviewed groups execute; **20 remain**. Preserve the accepted arena, native cards, centered three-level hover and identity-first unique setup. Production stays six command/six Dodge per seat, all intense sun, with no items or guessed quantities. Sources and catalogue copies verified. See gameplay-milestone-17.md and reviewed-caterpie-weedle.md/json. Full pending Gastly/Magikarp transcripts are saved in pending-gastly-magikarp.md; they need root visual signoff and implementation. Earlier counts below are historical.

## Pidgey and Magnemite — 2026-10-29 (current)

**344/344 tests pass. Combat supports 18 groups / 54 faces**, adding Pidgey/Pidgeotto/Pidgeot and Magnemite/Magnemite/Magneton. Keen Eye changes other trainers’ real or Sand Veil Dodges into cumulative whole-move damage reduction. Receiving modifiers can be ordered by the target trainer. Analytic exchanges selected real hand cards up to current HP once per Pokémon instance/Play. Air Slash and electric commands use thunderstorm judgments; Thunder Wave discards a rainy hand card and applies paralysis unless judgment is intense sun.

All 18 effect-reviewed groups execute; **22 groups remain**. Source/public catalogue copies match, all six face hashes verified. Preserve accepted arena geometry, native cards, centered three-level hover and identity-first unique selection. Production remains six command/six Dodge per seat, all intense sun, no held items or invented quantities. See gameplay-milestone-16.md and reviewed-bird-magnet.md/json. Caterpie/Weedle source notes are saved for the next batch; no rediscovery is needed. Earlier counts below are historical.

# Foundation contract — 2026-10-26

## Future Sight / Synchronize / effect-switch contract — 2026-10-28 (current)

`respondBattle` adds optional `choice:'trait'|'pass'` for `kind:'foresee'` or `kind:'synchronize'`, and mandatory `kind:'reorder',choice:'order',order:[indices]`. Future Sight opens at move use, before any target defense. Opt-in inspects up to3 available cards; if short, shuffled discard is placed under the existing top cards first, with no invented cards if the total pool is smaller. The cards stay in the draw pile and counts do not drop. Only the actor receives `pendingBattle.cards` with index/name/weather/kind; private IDs stay in `resolution.scryCardIds`. Committing an exact permutation (next draw first) changes only those top cards, then opens normal defense. Empty inspection goes directly to defense. Mandatory reorder expiry pauses, while optional inspection expiry passes. Mapping/order survive persistence and exact retries; malformed/stale/unauthorized inputs reject before mutation.

Synchronize opens after positive damage's source effects and only for the surviving active Abra with an eligible causing command/event still available. `resolution.cardClaimedBy` records the single physical transfer. Final settlement discards only an unclaimed causing card. No source card is fabricated for poison/confusion. Receiving abilities do not transfer to a replacement reserve.

Teleport is a command move with no printed damage numeral and self-only targets. A normal Dodge can cancel it. On settlement draw1, then switch to a living reserve without changing `turn.switchUsed`; the command-user identity remains the original Abra. It cannot bypass a trainer's explicit switch prohibition while a living reserve exists. Existing switch state/removal/reveal rules apply.

Slowpoke's positive outside-own-turn damage sets `turn.damageImmunityIds`; later damage to that same instance is0 for the rest of that turn, suppressing after-damage effects/judgments. New turns clear protection. Public active Pokémon add `damageProtected`; this does not prevent HP-loss effects or invent reserve damage immunity. The current preview damage paths respect it; future event/item damage must use the same turn-aware damage gate.

## Expanded Pokémon response contract — 2026-10-28 (current)

`respondBattle` accepts `decisionId,choice,cardId?,handIndex?` inside the normal validated/idempotent envelope. Defense allows pass, actual Dodge, or `choice:'trait'` when public `canTrait` enables Sand Veil. Sand Veil requires no held item and allows one judgment per settlement. Success in intense-sun/clear ends only that settlement; failure marks attempted, keeps the same ID and response clock, and permits a real Dodge or pass. Static opens a separate optional `kind:'static'` decision after the source's after-damage effects, owned by the damaged active Pikachu's trainer. Trait or pass is accepted with no card/index payload; a judgment other than intense sun paralyzes the actual source if eligible. Rescues remain pass-only in this deck.

SandshrewLv.2/Lv.3 positive-damage effects open `kind:'hand'`, actor=source trainer, target=affected Pokémon's trainer, `effect:'discard'|'take'`, `choiceCount`. Only `choice:'card',handIndex` is legal; no pass or cardId. A shuffled persisted private ID mapping makes each blind slot stable. `publicBattleDecision` projects `{index}` choices only to the actor; if actor owns the targeted hand, name/weather/kind are also visible. Spectators and other trainers receive counts only. Resolution resumes after the source effect without repeating damage, judgment or command payment. Timer expiry sets mandatory pause rather than choosing. Invalid indices/payloads/stale slots fail before mutation; exact retries spend/transfer once. No new held items or card quantities are inferred.

## Identity and shared Pokémon setup contract — 2026-10-28 (current)

This extension supersedes the fixed-three combat setup below. `startBattlePreview` (labelled Start game in the UI) requires the owner and 3–6 ready seats, validates capacity for five unique groups per seat, assigns roles, then enters `status:'identity'`. `acknowledgeIdentity` accepts only the action envelope and is seated-player-only. Only after every trainer acknowledges does the server reserve five disjoint groups per trainer and enter `status:'setup'`. `drawPokemon` reveals exactly one reserved candidate to its owner per accepted click. A sixth draw fails; exact retries do not draw again. Undrawn queues and unused deck order are never projected.

`selectPokemon {activeId,reserveId}` requires all five drawn, two distinct own candidates and no prior selection. Unchosen three return to the unused shared pool; all candidate allocations were reserved before anyone could return cards, so later draws cannot repeat them. All trainers finishing starts the existing combat-preview turn engine. Opponents' selected actives remain concealed until this common transition; reserves stay private until revealed by existing rules. Own locked partners remain visible to self. Public setup fields are acknowledgement and draw counts only; self receives own role, revealed candidates and `pokemonDrawRemaining`. Match cleanup clears all queues/deck/acknowledgements. Saved state preserves reservations and draws across restart.

`pokemon-deal.js` owns crypto Fisher–Yates shuffling and disjoint allocation. The legacy foundation start remains a test API only and now also allocates five without repeats. Selection/name/HP eligibility does not imply implemented effects. Unsupported attackers and defensive targets fail closed. See `gameplay-milestone-5.md` and `app/test/selection.test.js`.

## Combat-preview extension — 2026-10-27 (current)

The authoritative contract now includes `startBattlePreview` (owner, 3–6 ready seats), `attack {cardId,targetIds}`, `respondBattle {decisionId,choice:'pass'|'dodge',cardId?}`, `useTrait`, and `returnToLobby` after `status:'finished'`. See `gameplay-milestone-4.md`. This separate development scenario openly uses three reviewed groups and 6 command/6 dodge test cards per seat; these are not asserted retail setup/quantities.

Battle views add `gameMode:'combat-preview'`, public `scenario`, `pendingBattle`, deck/discard counts and `result`. Active/revealed Pokémon expose identity, level, HP/maxHP, status/defeat and public reinforcement only. Self receives its own role and server-computed legal actions; unknown opponent roles, hands/reserves and deck order stay private. On a real completed result only, all player roles/hands/reserves disclose. `pendingBattle` has public decision ID/actor/target/type/clock, never opponent holdings. Turn pauses with `pausedReason:'response'`; response clocks are now enforced and recover across restart. Exact retries remain idempotent. Foundation rooms keep their original behavior.

## Switching extension — 2026-10-27 (current)

This and the turn-engine extension below supersede the historical foundation boundaries.

- `switchPokemon` accepts only the normal action envelope. It requires the acting seated trainer, Play, both partners, no closing vote and an unused ordinary switch. It swaps existing Pokémon records, clears outgoing reinforcement, reveals the incoming partner and retains outgoing public knowledge. It does not consume a hand card or reset the clock.
- Public `turn.switchUsed` is false at each new turn and defaults false for legacy saves. It persists through retries/reconnect/restart.
- Public `players[].reserve` is absent for unrevealed reserves; revealed reserves expose only `{catalogueId,level}`. Active projections explicitly allowlist those same two fields. Private self reserve state remains authorized only for its own player.
- End-turn level-up follows the active partner after switching. Expiry never switches automatically. Match closure clears reveal state. Combat/status/defeat handlers remain unavailable; this slice operates in the existing fixture game.
- Nine photo-reviewed faces are available as public reference text with provenance and `engineEligible:false`, and are mirrored between catalogue copies. No playable effects or deck quantities were inferred.

See `gameplay-milestone-3.md` and `reviewed-combat-spec.md` for exact source pages, tests, limitations and next combat gates.

## Turn-engine extension — 2026-10-27

This extension supersedes the legacy turn/timer details below. The arena renderer now uses Three.js; server state remains independent of rendering.

Projected `turn` adds `phase: 'draw' | 'play' | 'discard' | 'end'` and `clock: null | { remainingMs, deadlineAt, pausedReason, expired }`. `deadlineAt` is an epoch-millisecond deadline while running and null while paused. `pausedReason` is null, `disconnected`, `vote` or `mandatory`. The public view also carries `serverNow` for client countdown synchronization. It is not a client-controlled source of authority.

- The second entitled draw enters `play`.
- `finishPlay` is legal only for the current player during `play`; it enters `discard` if the hand exceeds four, otherwise `end`.
- Excess discards are legal only during `discard`. The last required discard enters `end`.
- `endTurn {levelUp?: boolean}` is legal only during `end`, after all required choices. Default false; true raises the active partner exactly one level, rejecting requests above level 3. The photographed rulebook page 5 supplies optional wording. Reserve/state fields stay unchanged; damage and other ending effects are not implemented. Automatic timeout passes without level-up. Other ending triggers and victory remain pending.
- A configured turn clock runs on the server, pauses for a disconnected required player or closing vote, and preserves a saved remainder across restart. At expiry it skips optional play, waits for mandatory draw/discard choices and advances after those choices resolve.
- Automatic clock transitions never refresh `lastActionAt`. Exact action retries remain idempotent. A timeout that changes the revision can require the client to refresh before resubmitting a new action.
- Response seconds remain a stored preference until actual response windows are implemented. The client displays this limitation.

See `gameplay-milestone-2.md` for rationale and `foundation-validation.md` for verified behavior. The following sections retain the initial milestone contract as historical context.

User authorizes implementation with missing content left as placeholders. This milestone is a locally runnable multiplayer foundation, not a full rules-complete game or hosted release. No guessed abilities, game outcomes or official player counts. A development session supports 2–6 seats explicitly for testing; retail limits remain evidence-dependent.

## Ownership

- Root: integration, roadmap, README, validation and review.
- Server agent: `app/server/`, `app/test/`, `app/package.json`, `app/.gitignore`. Node ESM built-ins, no dependencies.
- UI agent: `app/public/index.html`, `app/public/app.js`, `app/public/styles.css`. Plain ES modules/CSS; no build dependencies.
- Content agent: `app/content/catalogue.json`, `app/public/catalogue.json` (same public-safe content), `content-backlog.md`. No ability invention; no remote assets.

## HTTP contract

`POST /api/rooms {nickname}` or `POST /api/rooms/:code/join {nickname,spectator:false}` returns `{code,token,playerId,view}`. Token is a bearer credential, generated by server. Spectators get their own credential. Nickname alone is never recovery. `GET /api/rooms/:code` with `Authorization: Bearer <token>` returns `{view}`; use 1.5-second polling. `POST /api/rooms/:code/actions` with same bearer and `{id,revision,type,...payload}` returns `{view}`. Action ids deduplicate; stale revisions fail 409 with `{error,code}`. Errors `{error,code}`; never expose raw errors/paths/secrets. `GET /api/health` returns `{ok:true}`.

View shape (only this projected state leaves the service):

```
{code,revision,status:'lobby'|'setup'|'playing'|'closed',ownerId,selfId,
 settings:{arena:'stadium'|'gym'|'floating',turnSeconds:0,responseSeconds:0},
 players:[{id,nickname,ready,connected,spectator,handCount,active:null|{catalogueId,level},reserveCount,setupComplete}],
 self:{spectator,hand:[{id,kind:'placeholder',name:{zh,en}}],candidates:[catalogueId],reserve:null|{catalogueId,level}},
 turn:null|{playerId,drawRemaining,number},
 log:[{id,text:{zh,en}}],
 pendingVote:null|{kind:'endGame'|'endRoom',requestedBy,approvedIds,requiredIds},
 lastActionAt,expiresAt,
 foundation:true}
```

Never send opponents' candidates/hands/reserve IDs, credentials, deck order or private roles. No roles in this foundation: role/winner rules are pending. Content catalogue is public reference, but no secret selections in responses.

Actions:
- `ready {ready:boolean}` lobby player only
- `settings {arena,turnSeconds,responseSeconds}` owner lobby only; 0 disables, allowed durations5–600. Timers saved/displayed only for milestone1; UI clearly marks enforcement pending.
- `start` owner, >=2 and <=6 players all ready. Deal 5 unique candidates per player from catalogue; repeats across players permitted only as explicitly marked foundation fixture (not real deck quantities). No deck-quantity assertion.
- `selectPokemon {activeId,reserveId}` choose2distinct own candidates, basic level1; when all selected enter playing, each gets4 unplayable placeholder hand cards, first seatedplayer acts, drawRemaining2. These are provisional S04-based setup fixtures, not final identity rules.
- `draw` current player, exactly1 and consumes entitlement. Append placeholder fixture card. Reject excess draws; no action-card effects implemented.
- `discard {cardId}` own turn, after drawing; if above4 permits discard until4. No arbitrary discard otherwise.
- `endTurn` own turn after mandatory draws and <=4 cards; cycle next player, resetdraw2. NO evolution yet: known timing contradictions remain explicitly pending. Public log must disclose no private card IDs.
- `requestEndGame` / `requestEndRoom` owner. During setup/playing creates unanimous connected seated-player vote; owner autoapproves. Lobby endRoom closes immediately. `approveEnd` / `rejectEnd`. EndGame returns to lobby and clears game private data without revealing. Closed rooms reject future joins/recovery.

Server persistence: write room state atomically to `app/.data/` (ignored); credentials stored privately. 7-hour inactivity expiry based on accepted user actions, NOT polls/heartbeats. Track connection via poll timestamp, owner-transfer after disconnect grace; required disconnected turns cannot be skipped. Bind localhost default. Static public/ only; never expose content/server/.data. Bound request size and validate all action inputs.

## UI contract

Polished desktop battle arena with cheerful Pokémon colors, dark navy panels, warm yellow accents; CSS perspective cards/flips, persistent abstract creature silhouettes/projection pedestals as clearly labeled asset placeholders. No pretend 3D model or copyrighted asset downloads. Entry → lobby → private pick5keep2 → arena; spectator views; bilingual personal preferences; legal button states; endturn and endroom confirmation; catalogue dialog and evidence-aware rules help. Owner arena selector, personal graphics/reducedmotion controls; all display copy bilingual. Store credential per tab/session to support multi-client testing; explicit private recovery credential workflow. Display foundation banner explaining missing combat/evolution/win logic. No fake multiplayer, fake responses or simulated winners.

## Machop reinforcement extension — 2026-10-28

Mandatory pendingBattle.kind:'reinforcement' adds public reinforcements:['power'|'defense'|'speed'] with unique values. actorId is the move user, targetId is the trainer whose active marker is removed. respondBattle accepts {decisionId,choice:'reinforcement',reinforcement:<kind>} and no cardId/handIndex/order. Exactly one current target marker is removed after validating original active instance; then defense opens. No-marker use skips this decision. The chosen marker remains discarded if the later move settlement is Dodged. Source Power is consumed at command use first. No pass/automatic timeout choice. Recovery, retries, offline/vote pauses and stale validation match other mandatory decisions. This enables only MachopLv1/2 single-target use-time removal; future multi-target effects require an ordered use-time queue.

## Growlithe extension — 2026-10-28

giveCards {cardIds:[ownrealIDs],recipientId:otherlivingtrainer,targetIds?:[commandtargetIDs]} is ownPlay/Justified-only, once per trainerPlay. Require1ormoredistinctheldcards. No targetIds on partial gift; all-hand gift requires an available move and legal1–maxTargets target list before any mutation. Exactcards transfer privately; publiccountonly. All-hand gift starts resolution.virtualCommand:true,card:null through common command settlement, preserves sourcePower/movelocks, and cannot create a Synchronize-eligible physicalcard. Recipient can use receivedcards immediately for responses. Paralysis prevents weatherlessvirtualcommands; partialsharing remains legal if1card stays. self.battle adds canGive,giveCommandAvailable,giveRecipientIds. room.turn.justifiedUsed resets at newtrainerturn and persists across switching/restart. Spectators/otherplayers get no new hand disclosures.

## Vulpix judgment/multiple-move extension — 2026-10-28

attack adds optionalmoveIndex(default0,strictinteger). self.battle.moves contains indexedname/condition/value/canUse/legalTargetIds/maxTargets; legacycanCommand/move fields retained. VulpixLv2/3index1 paysoneactualsunnycard ofanykind todiscard beforedefense; tracksseparatemovelock andnocmduser/Power. No damage, burnunlessfinaljudgmentheavyrain.

room.judgment isprivate persistedcard/actorIDs+instances/index/continuation/judgeID. pendingBattle.kind=judgment publicly reveals judgmentCard:{name,weather,kind} withoutID. Onlyactorgets replacementCards ownsunnycardIDs/labels. respondBattle acceptschoice:replace,cardId orpass. Actualcurrentcardgoestoactor; replacementbecomescurrent; finalcarddiscardsafterallresponses. AllactiveVulpix getwindowregardlessholdings. Current-turn-firstresponseorder, onceeach peroriginalreveal/norecursiveplayedreplacement are documentedinterpretations. Optionalexpiry/offline/votes/restart/retries followexistingcontract. SandVeilresumessameoriginaldefenseID/attemptflags/remainingclock afterfailedfinaljudgment. Clearinggame/resolution clearsjudgment. No privatecontinuation/actororder/physicaljudgmentID projected.

## Held items and Mankey extension — 2026-10-28

equipItem {cardId,slot:'active'|'reserve'} moves one reviewed held-item card from own hand to an own undefeated slot during Play. Replacement discards the old actual card. Active Mankey loss opens optional kind:'defiant'; trait draws two then grants current-turn no-limit, pass grants neither. self.handLimit is 4 or null; shared handLimit returns 4/Infinity for store checks. room.turn.noHandLimitIds resets each global turn. No generic unequip.

Public item stubs contain itemType/name/weather, never physical IDs or hidden reserve records. Squirtle suppression captures target instance IDs for the entire move and nested contexts; ownership is retained. room.resolutionStack is private persisted parent damage state. Helmet creates item-channel damage and full nested rescue/defeat handling. Same-holder simultaneous effects open mandatory kind:'effects', effects:[names], respond choice:'effect',effect:<name>. No pass/automatic ordering. Immediate victory/reset clears stack and judgments while conserving cards. Mankey Lv.3 queues reinforcement choices for each marked target before first defense.


## Shellder and Dratini extension — 2026-10-28

Shellder bypasses per-move count only. pending kind:'cycle' exposes own cards only to its actor; choice:'cycle',cardId discards then draws, pass does neither. Final Icicle Spear rainy judgment card is gained by continuation owner after all Drought responders; it is never also discarded or replaced by a fresh draw.

receiveDamage/commitDamage share saved pre-HP decisions across move/item/turn-start channels. Optional kind:'scales', trait:'marvel-scale' has public incoming damage; trait subtracts1 from saved resolution.incomingDamage, pass keeps original amount. Mandatory Multiscale caps positive damage at1 while uninjured in computeDamage. No zero-damage creation. Exact instances, restart, retry, clocks and nested parent events retain their authority/privacy guarantees.

Dragon Rage/Meteor snapshot ignoresReinforcements:true; computeDamage reinforcements:false suppresses Power bonus/Defense cap and move legality ignores Speed. Ordinary marker consumption remains (documented interpretation). pending defense cannotDodge:true disables actual/virtual Dodge, with an explanatory Continue control. Draco has at most2 distinct targets with independent settlements; indexed and legacy limits agree. Source traits/burn remain effective.


## Grimer contracts — latest

Grimer all3 levels execute. Pound1 blank; Sludge Bomb2 afterpositive damage heavy-rain-only judgment poisons; Toxic2 accepts rain OR thunderstorm. All judgments use existing persistent Drought machinery and preserve original target instances after rescue/deployment. Shared applyStatus now routes every supported status caller through Poison Touch; existing status or inactive/defeated original target prevents a new status, without overwriting or redirecting to a reserve.

Private room.statusEvent stores kind:'status'|'poison', targetId (Pokémon instance), actorIds, actorInstances, index, status/next or damage. Captured active/living Grimer respond in current-trainer-first full-seat order. pending kind:'poison-touch' has actorId/targetId trainer IDs, mode, trait:'poison-touch', canTrait:true and pending public status/base damage; internal capture/continuations stay hidden. respondBattle trait/pass only, strict payload/authority/instance validation. Optional expiry passes; offline/votes pause; restart/retry commits once. No per-turn cap across distinct events.

Status application waits for the queue. All pass keeps original status; first accept changes it to Poison. Initial Poison-to-Poison choices and further setters after first acceptance are omitted as outcome-neutral policy, explicitly NOT additional printed text; revisit if future content adds ability-activation side effects. Committing directly never recursively creates another replacement event. Source after-damage/receiving effects resume exactly once.

Poison tick starts a base1 source-free event before any HP loss. First accept setsbase2 (not additive); all pass keeps1. computeDamage(null,target,base,{command:false,channel:'status'}) applies receiving Defense/Multiscale before optional Marvel Scale/HP/rescue. No source means no fictional Static/Helmet target or attacker reward. Turn-start Poison/Confusion may be capped by Defense but DO NOT consume it: the booklet's discard trigger requires damage from a resolving card. Other move/item/virtual-command marker lifecycles remain. Setup/completion/victory/closing reset clears statusEvent.

248/248 tests pass, including27 independent Grimer/status-timing cases. Browser QA in isolated4174 room verified remote Muk replacing Confusion before entry, then4/5→2/5 HP only after Poisonbase2 choice. Chinese/English controls, spectator0controls/0hand,4clients0warnings/errors. Main4173 native Muk3 inspector verified. Evidence poison-touch-status-preview.jpg, poison-touch-damage-preview.jpg, muk-levels-preview.jpg. Main server restarted, temporary QA cleaned.



## Psyduck and shared moves — latest

Psyduck all3 faces execute HP3/4/4: Bubble1 Lv1/2 mandatory after-damage marker removal (pending reinforcement timing:'after-damage'), Water Pulse2 Lv3 rainy confusion, Disable index1 Lv2/3. Original target instances remain captured; no removal/status transfers to an incoming reserve. Source after-damage choices precede receiving effects.

Swift Swim useTrait has no payload, onceownPlay; final rain OR thunderstorm grants room.turn.cardRangePlayerId and room.turn.swiftSwimCreatureIds. Export cardDistanceIgnored(room,player) for trainer-card target queries. Only the granting instance receives move range; switching neither transfers that permission nor removes trainer permission. room.turn.swiftSwimUsed prevents another use that Play; all reset next global turn. Other card target-type and command-user/use limits remain.

previewActions.moves derives indexed command/weather availability and target counts from reviewed data. Weather conditions use weatherIconsInCondition, allowed effectKind burn-judgment / temporary-hand-exile; unknown kinds fail closed. Vulpix descriptor and Surf targeting.max2 are migrated data with unchanged behavior. Optional resolution.effectKind is null for normal commands to stay JSON-stable on restart. Legacy first-command projection remains. Weather moves discard one matching-weather real card of ANYkind before defense, no Power/command-user lock; paralysis only restricts actually used command cards. Wisp retains sunny burn behavior. Disable accepts rainy, no damage or receiving effects, ordinary Dodge/Sand Veil.

Disable uncanceled settlement opens optional kind:'exile', source actor, target trainer, maxCards=min2/hand length. Stable private resolution.handChoiceIds maps shuffled slots; public choices ONLYactor, face-down {index} for other hand or own labeled stubs without IDs. respond choice:'exile',handIndices:[0..2 distinct safeint slots] OR pass with noindices. Whole selection validates before mutation; expiry pass chooses0. Empty hand auto-finishes paid move. handIndices forbidden on other decisions.

Actual cards live in PRIVATE player.exiledCards, outside hand/limits/payment/deck/discard. Public battle players/self expose exiledCount only, never removed faces/IDs even to owner; no inspection operation. Noncombat projection is unchanged. Eliminated trainers retain exiles until reset unless an already-triggered return remains; result shows counts only. Setup/closing/rematch clear zones.

At nextownturn beginning, PRIVATE room.turnStart {playerId,pokemonId,remaining:['return-cards','status']} captures return plus flinch/sleep/confusion/poison effects as applicable. Both → mandatory pending kind:'turn-start-order',effects names only; respond choice:'start-effect',effect:'return-cards'|'status', no pass. Single effects execute automatically. Selection is consumed before execution. Root finishResolution resumes remaining start effects after Grimer/scales/rescue/nested Helmet continuations. Return restores actual cards before ordinary draws; if status eliminates trainer without victory, pending return completes then ordinary eliminated-hand discard. Immediate victory stops queue and retains exile zone until reset. Mandatory start-order expiry waits; offline/votes pause.

Future Meowth gain hooks must distinguish TURN-BEGIN restoration from ordinary Draw phase: store initializes turn.phase='draw' before start effects, but mandatory draws have not begun. Use gain reasons/pending start context rather than phase alone for Pickup. Current card-return operation is not an extra ordinary draw.

278/278 tests pass including30 independent Psyduck cases. Browser4clients0warnings/errors: Swift range3→4 targets; Bubble1damage before marker choice before Static; Disable source-only2blind slots retained across language render, spectator0choices/0hand; target2hand+2removed; choose Poison first nextturn then exact cards return before draws,5/5→4/5HP and4hand. Main native Golduck3 inspector verified. Six new screenshot filenames in milestone14. Main4173 restarted latest, temporary QA cleaned.



## Meowth and shared gains — latest

Meowth all3 faces execute HP3/3/4. Lv1 Protect index0 has no printed damage value, sunny weather-card condition and effectKind:self-defense; target.kind:self restricts it to its own active. After ordinary uncanceled settlement it gains Defense only if no carried Defense, with no Power consumption/damage/command lock. Public arena reinforcement labels now show Power/Defense/Speed and inactive under Paralysis; no generic acquisition action is added.

Lv1/2 Pickup is mandatory once per Pokémon INSTANCE per global turn. Shared gainBattleCards(room,player,cards,{reason='effect'}) and drawBattleCards(room,player,count=1,reason='effect') cover effect draws/gifts/take/judgment/Drought/Synchronize/Pay Day/exile return. Setupreason skips. Own Draw phase suppresses only when turn.playerId matches, phase=draw and no private turnStart; return at turnbegin DOES trigger. turn.pickupUsedIds is marked before bonus, survives switching/evolution of same instance, resetsnextglobalturn. Empty batch/inactive/reserve/defeated/eliminated/spectator/Lv3 noPickup. Bonus with no available real draw/discard card spends trigger but draws0, preserving original gain; no phantom/deadlock. This exhaustion policy and per-instance scope are documented interpretations. Base draw counts retain strict DECK_EMPTY validation; count2 base batch lands before one bonus.

Pay Day Lv2/3 index0 command2 opens optional kind:pay-day afterpositive damage/rescue and before target receiving effects. canTrait=true,trait:pay-day; trait privately reservesup2actualtopcards in resolution.distributionCards; passleavesdeckunchanged. Shortpile shufflesdiscardunderexistingtop, usesavailablecards only;0autoends. Reservation is effect bookkeeping, NOT exile. Pendingkind:distribute haschoiceCount andrecipientIds; actorONLY gets cards:[{index,name,weather,kind}], noIDs. respondchoice:distribute,allocations:[{index,recipientId}]exactlyeveryreservedcardonce, stricttypes/keys/authority/livingrecipients. Self/samerecipient allowed. NoPassafterview; mandatoryexpirywaits. Stablecards/selections/restart/retry/votes/disconnects preserved. Everydelivery commits before Pickup bonuses in current-turn-first establishedcounterclockwise seatorder; a bonus cannot steal reservedsecondcard. allocationsforbidden onotherdecisions. Cleanup returns unusedreservedbundle todecktop if ever interrupted, preservingactualcards.

PersianLv3 Limberprevents NEWparalysis BEFOREGrimer replacement; existingstatus/evolutionretainrules unchanged. Immunity-versus-replacement priority not printed: earlygate is explicitinterpretation. Otherstatuses stillapply. Fake Out index1 command1 effectKind:flinch-after-damage directly appliesFlinch via sharedGrimer/one-status/originalinstancepipeline, nojudgment orunstatedfirst-turnrestriction. PayDay/FakeOuteachonce, samerealcommanduserinstance. resolution.moveIndex is0default/actualindex andJSONstable. Handcardsrenderallreviewedindexedcommands withnamelabels whenmultiple; normalonecommandUseMove staysunchanged.

310/310tests pass including32independentMeowthcases. Browser6clients0warnings/errors: source-onlyPayDayfaces andself/selfrecipient selections survivedlanguagechange, hand3→6withPickup1; spectator0cards/0hand; ProtectPower+Defense/unchangedHP; FakeOut1damage+Flinch withPayDaystillavailable. MainnativePersian3inspectorverified. Main4173restartedlatest; temporaryQAcleaned. Five new screenshotfilenames in milestone15. Productiondeckunchanged; allsourcehashes/cataloguebyteidentity verified.
