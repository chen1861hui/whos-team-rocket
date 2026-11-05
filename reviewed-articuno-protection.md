# Articuno’s Protection / 急冻鸟的庇护

The preserved older-edition O03 sheet gives the complete wording. The visible text on the supplied P06 Master Edition poster corroborates it, and both show heavy rain. The source review records file hashes and which text is covered on P06. See [legendary-bird source review](reviewed-legendary-bird-events.md) and its [machine-readable record](reviewed-legendary-bird-events.json).

> 你选择一项：
> 1.当一张事件牌的效果对一个目标生效前，抵消此事件牌对该目标的效果；
> 2.当一只宝可梦陷入特殊状态后，恢复其特殊状态。

Play one physical Articuno card in response to either timing point. Before an event affects a target, the card cancels the effect for that target. After a Pokémon gains a special status, the card cures the newly applied status. The face prints no self-only, range, or reaction-weather restriction. The card has no ordinary Play action.

The engine opens the cancellation window before the original target's response, judgment, or effect. It advances past the canceled slot and preserves the rest of the event. The cure window follows the final successful status application, including any Poison Touch replacement. Prevented and failed attempts do not open it. Curing resumes the original effect and removes only that status.

In a scenario with the public `articunoReactions` capability enabled, every live trainer gets the same opportunity in seat order from the current trainer, regardless of hand contents. The current responder alone sees eligible cards and can play one, pass, or time out. The first successful reaction closes that window. The game does not open a counter-reaction against that Articuno card; this is a digital timing policy for an interaction the supplied sources do not specify. Original targets and the parent effect stay pinned through responses. The ordinary test deck leaves this capability off; the retail copy and weather distribution remain unverified.
