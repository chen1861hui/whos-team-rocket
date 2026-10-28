# Web game flow draft

Status: planning only. Product decisions below do not substitute for the original rules. Read discovery.md for sources, decisions, and unresolved requirements.

## Intended first-release experience

A private desktop game for one remote friend group in Malaysia/Singapore, using nicknames and room codes. The rules engine controls legal actions and resolves effects. Players communicate on Discord. Each player independently selects English or Simplified Chinese for the whole interface and game text.

Hosted internet play comes first. Local/WLAN hosting is deferred. Include additional official modes if source verification supports them.

## Screen sequence

1. Entry: language, nickname, create room, join by code/link.
2. Lobby: player seats, readiness, rules/edition summary, optional separate turn/response timers, owner-selected shared arena, spectator access. Owner starts after everyone is ready and verified setup requirements are satisfied.
3. Private setup: identity assignment and Pokémon selection according to the chosen edition. Five candidates/keep two is supported by the prototype walkthrough; retail verification remains required. Never expose another player's private choices.
4. Arena: own hand at the bottom, opponents around the arena, visible full-color Pokémon, draw pile, discard access, current phase, pending decision, and game log. Exact arrangement and public fields need a visual review and rules verification.
5. Resolution: play via drag-and-drop or a click-based alternative; select targets/choices as required; resolve only at the correct response and effect boundaries. Dramatic effects follow committed game outcomes.
6. Result: after a completed match, show winning side and reveal all identities, remaining hands and reserve Pokémon. Offer rematch with the same group or return to lobby. Statistics/history/replay are outside the currently requested scope. Revealing all after a completed match does not authorize premature disclosure during a pending abandonment vote.

## Interaction contracts

- One draw click reveals one card to its entitled recipient. Stop accepting draws when the current draw allowance is exhausted. What happens if a timed player fails to complete mandatory draws is unresolved.
- Dragging a card away from hand is a preview. Releasing on a legal target immediately commits if no required choices remain. If additional choices are required, collect them before commitment and allow cancellation until then. Invalid drops cancel without spending a card. Played cards cannot be taken back under the accepted default policy.
- Use few confirmations; ending the personal turn requires one. Other high-impact actions are not yet enumerated.
- Reaction windows follow original rules. Separate optional turn and response timers are configurable in the lobby, both off by default. Confirmed presets: 60 seconds per turn and 20 seconds per response. Pause the turn clock during another player's response and blocking animations.
- Optional responses auto-pass on expiry. A timed-out turn ends after mandatory actions resolve; outstanding mandatory selections pause for input rather than making choices for the player.
- Background music and effects are accepted, with independent Music / Effects / Timer-warning volume and mute controls. Low-HP music warns only the acting player during their final ten seconds. Exact track/source remains unselected; the user's "ok" did not identify a track. Proposed mix: temporarily lower background music during a warning, restore it when the decision completes. Short timer behavior remains to be specified.
- Follow an official takeback rule if verified; otherwise allow cancellation only before action commitment. Drawn/played cards are final. The user's end-of-round terminology means end of the personal turn.

## Visibility and spectators

- Display public state and only the local player's entitled private information.
- Spectators and eliminated players do not receive surviving private hands or unrevealed identities during the match.
- Allow spectators to join immediately with the code, including mid-match, without owner approval. Owner can remove spectators. Maximum count is not yet set.
- Seat administration must not automatically grant access to secret game information.
- Public action log is confirmed: played cards, targets, damage, statuses and level/evolution events. Log only information made public by the rules; never expose private draws, hidden selections or secret deck inspection. A private draw may be logged as a count if the rules make that count public.
- Response-window presentation is confirmed: every rules-eligible responder receives an explicit Respond/Pass window even when they hold no legal response. Do not auto-skip based on hidden card holdings. Legal response choices remain disabled when unavailable; Pass remains available for optional responses. The optional response timer still auto-passes on expiry. This does not create eligibility or permission to pass a mandatory decision where the rules provide none. Public prompts must not disclose whether a legal response exists in the player's hand.

## Interruption flow

- Disconnected seats retain their hand and identity.
- Pause when a disconnected player's input becomes necessary; do not silently pass or surrender for them.
- Reopening in the same browser restores the private seat using a saved seat credential. A private recovery code allows switching devices; nickname alone cannot reclaim a seat. User accepted this without an owner-approval step. Only one active controller per seat (implementation default).
- Disconnection pauses the required decision and its countdown.
- Transfer room-management authority to a connected player when the owner disconnects; retain the original seat for reconnection.
- No replacement players mid-match in v1. Owner can request End Game; all remaining connected players must agree. Abandonment declares no winner and returns everyone to the same lobby.
- Separate End Room control closes the room, invalidates its join/recovery codes and returns participants to entry. Proposed application of accepted abandonment policy: during a match require the same connected-player agreement; in the lobby owner confirms closure directly. Spectators cannot vote.
- User requests room removal after seven hours with no action/game, replacing the suggested one-hour policy. Operational interpretation for review: seven hours without meaningful player activity in the lobby or match, including a stalled game; presence, network heartbeats, animations and automated timer events do not reset it. A real game action resets the inactivity deadline. This is not a seven-hour maximum match duration.
- Room state must survive everyone disconnecting until its inactivity deadline. Closing the last browser does not immediately end the room. Expiry or End Room prevents later recovery; notify participants before a manual close.

## Visual direction

- Master Duel / Duel Links inspired battle arena, cheerful Pokémon tone. Fixed seating with the player's hand below; all opponents remain visible. Brief attack focus is confirmed.
- Prototype source has a concealed reserve: show a generic covered slot until disclosure is authorized. Persistent Pokémon models apply only to visible Pokémon; do not expose an opposing hidden reserve through assets or tooltips.
- Full-color idle Pokémon stay visible; use animated 3D assets where suitable, and a consistent 2D fallback elsewhere.
- Brief attack and movement effects; a larger evolution moment.
- Redesigned readable bilingual cards with original game values and effects preserved.
- Owner selects a shared outdoor stadium, indoor gym, or floating fantasy arena theme in the lobby.
- Mixed ordinary laptops and gaming PCs are expected. Independent Auto / Low / Medium / High settings and a separate reduced-motion option are confirmed. Low uses 2D Pokémon and simpler effects; higher settings use available 3D models. Rendering choices never change gameplay or information visibility. Animation duration, effects intensity and audio details remain to be settled.

## Readiness dependencies

Help should provide enlarged cards, ability/status explanations, legal-target feedback, phase indication, searchable references, and a complete rules guide. A guided tutorial is not required in the current scope.

The complete selected-edition rulebook, card catalogue, effect text, component quantities, visibility rules, evolution timing, reaction order, status behavior, and victory precedence must be verified before the game engine can be specified as complete. No production implementation has begun.
