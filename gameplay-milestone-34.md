# Milestone 34 — Articuno’s Protection

2026-11-05 · `codex/articuno-protection` · base `3f380e4`.

Articuno’s Protection can interrupt any of the six implemented ordinary events before it affects an original target. A successful response skips that target, so a global event still reaches its later targets. The second mode cures an actual new status, after the shared immunity and Poison Touch handling. Neither mode appears as an ordinary Play action. See [the implementation specification](reviewed-articuno-protection.md) for the source wording and response policy.

The server offers responses in seat order regardless of who holds a card. Only the responding trainer gets their own eligible card choices. A successful response consumes one actual card and closes that window. The room keeps its original target and continuation through passes, timeouts, votes, or restart. The default test deck and retail quantity gates are unchanged. The two catalogue mirrors mark the card as reaction-only and executable in combat preview.

The full `npm test` suite passed: 1,189 tests, including 48 new tests across all six ordinary events, all six special statuses, nested effects, privacy, stale actions, card ownership, timers, voting, and restart. Both catalogue mirrors matched byte for byte, and the preserved O03, P06, R07, and R08 source hashes matched their recorded values.

In browser QA with three trainers and a spectator, the English cancellation panel canceled Mew’s Blessing for its first target, and the other two trainers still chose healing. In Chinese, Jigglypuff’s Performance applied Sleep, the cure panel showed the new status, and Articuno resolved the cure and returned the room to Play. The spectator saw both public prompts without response controls. QA used a separate opt-in scenario; the preview arena and card graphics were not changed.

Next: Rival’s Challenge, Berry Harvest, and Farfetch’d’s Prank, then reinforcement tools, remaining held items, and Revive. The retail quantities by card and weather remain open.
