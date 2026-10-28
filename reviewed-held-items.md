# Reviewed held-item rules — 2026-10-28

Parent and an independent Sol reviewer inspected the saved booklet pages 8–11, P05 poster and both Mankey originals. Existing R05/R06 and reviewed-combat-spec.md establish Play timing, defeat and rescue. No discovery, downloads or original-file edits occurred. Hashes are in reviewed-held-items.json.

## Exact source and implementation

P05 Rocky Helmet / 凸凸头盔 shows thunderstorm weather and: 携带此持有物的宝可梦受到伤害后，其对伤害来源造成1点伤害。 After the holder receives damage, it deals 1 damage to the damage source. There is no judgment or optional clause. This is damage, not HP loss; a source-free event has no invented Pokémon target. Reserve items do not take effect.

Booklet p.9 permits held-item use on an own active or reserve Pokémon. The real card enters that Pokémon zone, not discard. One item is allowed; a new item replaces/discards the old. Switching and evolution preserve items; reserve effects remain inactive. Defeat discards the held item before deployment/reward cleanup. There is no source-backed generic release action.

Mankey's Defiant says: 当此宝可梦失去所携带的持有物后，你可以摸两张牌，然后本回合你没有手牌上限。 The optional package draws two, then removes the trainer's hand limit for the current global turn. Declining grants neither. No cap is printed across separate losses. Suppression, switching and evolution are not actual item loss.

Printed p.10 lets the same trainer choose the order of simultaneous effects. Thus Static/Synchronize/Oblivious and Helmet are ordered by the holder, after the source's earlier after-dealing stage. Each Helmet retaliation is a separate damage event with captured identities and item channel. Damage modifiers, rescue, defeat, nested responses and immediate victory still apply. A defeated holder cannot retaliate through a newly deployed reserve.

## Explicit interpretation boundaries

The implementation uses a saved resolution stack and effect queue; these are software procedures, not printed APIs. Final damage-trigger completion is the boundary used for Defense consumption on an item damage event. Defiant is not offered after a Pokémon has already lost battle ability and discarded its item: the photographed rules do not separately enumerate this edge, so it is recorded as an interpretation of inactive/defeated effects. Item suppression lasts through the full parent move, including nested events, and retains physical ownership.

Only this pictured Helmet face/weather is reviewed. Its retail count and complete weather distribution remain unknown. Catalogue quantity stays null; the production deck remains command/Dodge only. Deterministic item fixtures prove behavior without claiming original quantities. Other covered item paragraphs were not inferred.
