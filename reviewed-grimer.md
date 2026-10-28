# Grimer / Muk effect review — 2026-10-28

Root and an independent Sol 6.1 High reviewer viewed the saved originals. Full bilingual records, face positions and source SHA-256 hashes are in reviewed-grimer.json. English is a working UI translation; bracketed weather labels transcribe printed icons. The print edition and physical quantities remain unidentified.

Sources in research-assets/douyin-7684572630280187855/: 46f7a756255255d2.webp (Lv1 whole), bb30feae53e3cae4.webp (Lv2 left, Lv3 right). Printed names/HP: 臭泥3 / 臭泥4 / 臭臭泥5. Classification: 干扰型.

All three levels, 毒手:

当一只宝可梦陷入特殊状态时，你可以令其改为陷入“中毒”状态，当一只宝可梦的“中毒”状态效果被触发时，你可以令伤害值改为2点。

Global wording 一只宝可梦 is not limited to self, an adjacent partner, the damage source or the current move target. There is no printed per-turn cap. Only an active, living Grimer's trait functions. It does not allow a trainer to act through a reserve, defeated Pokémon, eliminated player or spectator.

- Lv1 command 拍击, damage1. No additional paragraph.
- Lv2 command 污泥炸弹, damage2. 当此宝可梦因此招式而造成伤害后，你进行一次判定，若结果为[暴雨]，目标宝可梦陷入“中毒”状态。
- Lv3 command 剧毒, damage2. 当此宝可梦因此招式而造成伤害后，你进行一次判定，若结果为“雨天”（[暴雨]/[雷雨]），目标宝可梦陷入“中毒”状态。

Lv2 accepts heavy rain only; Lv3 accepts heavy rain or thunderstorm. Both require positive damage caused by this move, and use the final judgment after Drought. A tiny Poison icon beside the value does not replace the written judgment condition. No damage means no after-damage judgment. A fainted original target's replacement does not inherit the status.

## Booklet timing and status rules

Saved booklet08-timing-damage-status.webp, pages10–11, establishes current-trainer-first counterclockwise simultaneous ordering, one special status at a time, and source changes → receiving changes → HP/rescue → source after-damage → receiving after-damage. Existing status prevents entry into another status; Poison Touch does not bypass that restriction or overwrite an established status.

Booklet09-reference.webp, page12, says Poison causes 1 source-free damage at the poisoned trainer's turn start. Poison Touch sets that event's base to2 rather than adding2 or assigning a Grimer as its source. Defense, Multiscale and optional Marvel Scale still apply as receiving modifiers. Source-based bonuses, Static targeting a damage source, Helmet retaliation and attacker defeat rewards have no invented source to use.

Defense's damage cap and its discard trigger are separate: the booklet discards Defense at the end of a resolving card if it caused damage to the holder. Poison and turn-start Confusion have no resolving card, so their damage can be capped while the marker persists. A nested actual item event retains its own ordinary card-event marker lifecycle.

## Explicit procedure interpretations

The printed face does not provide a UI queue or interruption protocol. The implementation creates one persisted status event before application, capturing active Grimer instances in current-trainer-first seat order. Passing moves to the next eligible captured actor. The original status is committed once after all pass; accepting changes the pending status to Poison and commits once. This does not create another status-entry event or recursively trigger Poison Touch.

An initial would-be Poison application skips Poison-to-Poison choices, and the first acceptance ends the replacement/setter queue. Further identical choices have no cost, use cap or activation side effect in the reviewed content and cannot change the result. This is an outcome-preserving engine procedure, not extra printed card text. Revisit pruning if later reviewed content introduces consequential ability-activation triggers.

The same captured queue handles Poison ticks before receiving modifiers or HP loss. First acceptance sets base2 once; all passes keep base1. No damage or status is committed while the optional response is pending. Actor instances are revalidated before responding; the original active target instance is retained. Optional response expiry passes; disconnects and closing votes pause. Restart and exact retry preserve the event and apply once. Closing/reset/completion clears the private state.
