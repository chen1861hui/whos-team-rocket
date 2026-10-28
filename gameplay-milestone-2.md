# Gameplay milestone 2: turn phases and optional timing

Scope agreed by continuation of the foundation work, 2026-10-27. Preserve the accepted arena and add a server-owned turn lifecycle. This is still a development fixture, not the complete retail rules engine.

## Turn flow

1. **Draw:** exactly two entitled draws, one click per card.
2. **Play:** a distinct phase reserved for supported cards, moves and switching. No effects are enabled yet because the exact effect definitions and interaction rules remain unverified. The player can finish playing.
3. **Discard:** the player chooses excess cards until four remain. The server never chooses which cards to discard.
4. **End:** the player confirms passing to the next seated player, optionally raising the active partner by one level, capped at level 3. Other end-phase effects remain unavailable.

The phase sequence is supported by S04 around 24:21–25:28 and S01 around 12:16–12:25. These videos are incomplete evidence, so the same provisional starting-hand/draw/hand-limit fixtures remain disclosed. Preparation triggers, final ending triggers and interrupted phases need future verified rules handlers.

The newly supplied photographed rulebook (`xiaohongshu-rulebook-source.md`, image 05 printed page 5) explicitly makes the end-turn level increase optional. Root independently checked this wording. Image 07 printed page 8 says level changes preserve existing damage and status. This milestone changes only the active partner's level and visible form name; damage/status systems are not yet implemented. The reserve stays unchanged. A timeout skips the optional increase, consistent with the chosen digital timer policy.

## Clock policy

The optional clock is a digital convenience requested by the user, not a claimed printed board-game rule. It is off by default. Enabling it starts with 60 seconds; custom values remain 5–600 seconds.

- The server owns the countdown. Client display uses a sampled server time and a monotonic elapsed duration.
- At expiry, optional play closes. Required draws and discard selections remain the player's responsibility. The turn completes automatically once these obligations are resolved.
- A disconnected required player pauses their clock after the existing presence timeout. Reconnection resumes the preserved remaining time.
- A closing vote pauses play and the clock. Rejecting the vote resumes it; approval ends the match/room through the existing voting rules.
- Service restart preserves a saved clock remainder without charging server downtime.
- Clock maintenance and polling do not extend the seven-hour inactivity deadline.
- Response time is still a saved setting: no response window exists yet. Last-ten-second visual emphasis applies to the acting player; the requested low-HP music remains pending.

## Deliberate boundaries

Unverified cards remain unplayable. There is no invented attack damage, target range, defense response, rescue result or winner. Unknown commands remain rejected by the server. Private hand, reserve and credential isolation still apply throughout transitions and timeouts.

Next evidence-dependent slice: exact attack/defense text and legal targets, followed by response ordering, damage/rescue and ending triggers. Each enabled effect needs a cited mechanical definition and scenario tests. The accepted arena layout is not part of that next rules task.

## Validation

Record completed automated and browser checks in `foundation-validation.md`. Cover phase gating, expiry while a mandatory choice remains, disconnect/reconnect, closure votes, restart, duplicate submissions and both language interfaces before marking this milestone complete.
