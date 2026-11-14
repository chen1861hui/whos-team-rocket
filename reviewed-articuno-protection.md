# Articuno’s Protection / 急冻鸟的庇护

The preserved older-edition O03 sheet gives the complete wording. The visible text on the supplied P06 Master Edition poster corroborates it, and both show heavy rain. The source review records file hashes and which text is covered on P06. See [legendary-bird source review](reviewed-legendary-bird-events.md) and its [machine-readable record](reviewed-legendary-bird-events.json).

> 你选择一项：
> 1.当一张事件牌的效果对一个目标生效前，抵消此事件牌对该目标的效果；
> 2.当一只宝可梦陷入特殊状态后，恢复其特殊状态。

Play one physical Articuno card in response to either timing point. Before an event affects a target, the card cancels the effect for that target. After a Pokémon gains a special status, the card cures the newly applied status. The face prints no self-only, range, or reaction-weather restriction. The card has no ordinary Play action.

The engine opens the cancellation window before the original target's response, judgment, or effect. It advances past the canceled slot and preserves the rest of the event. The cure window follows the final successful status application, including any Poison Touch replacement. Prevented and failed attempts do not open it. Curing resumes the original effect and removes only that status.

When `articunoReactions` is enabled, the engine asks only live trainers who hold the card, in seat order starting from the current trainer. Each asked trainer can play it, pass, or time out. Other players can see who is responding, and only the current responder sees their eligible cards. For Berry Harvest, the user confirmed that another Articuno can counter the previous one. Each card is spent immediately, and the next counter window follows the same seat order, excluding the player who just played. An odd number of protections cancels the current target's pick, and an even number restores it. Other events and status cures resolve after the first protection. Original targets and the parent effect stay pinned through responses. The ordinary test deck leaves this capability off.
