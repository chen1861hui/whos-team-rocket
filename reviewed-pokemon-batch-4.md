# Reviewed Pokémon batch 4 — Shellder and Dratini

Reviewed 2026-10-28 against four saved originals, independently viewed by root and Sol 6.1 High. Six faces are now enabled in the combat preview. English is a working UI translation; bracketed weather labels transcribe icons. The print edition and physical deck quantities remain unknown. Exact provenance paths, face positions, SHA-256 hashes and bilingual face records are in reviewed-pokemon-batch-4.json.

## Shellder / Shellder / Cloyster

Sources: research-assets/douyin-7684572630280187855/90856a0dfd9c6673.webp (Lv1 whole), 3e502b35e3a11c0a.webp (Lv2 left, Lv3 right). Printed HP: 3 / 3 / 4. Classification: 攻击型.

All levels, 连续攻击: 此宝可梦使用招式不受次数限制。

- Lv1 撞击, one command, damage 1. No further paragraph.
- Lv2 尖刺加农炮, one command, damage 2. 当此宝可梦因此招式而造成伤害后，你可以弃置一张手牌，然后你摸一张牌。
- Lv3 冰锥, one command, damage 2. 当此宝可梦因此招式而造成伤害后，你进行一次判定，若结果为“雨天”（[暴雨]/[雷雨]），你获得此判定牌。

Skill Link overrides the per-move use count. The booklet's one command-using Pokémon instance, actual command payment, range, paralysis, sleep/confusion blocking and ordinary switch limits still apply. Spike Cannon optionally discards one actual hand card before drawing one; empty hand gives no free draw. It resolves after rescue and before target after-receiving effects. Icicle Spear obtains the actual final rainy judgment card after every Drought responder. A sunny final card enters discard. It does not draw a substitute or duplicate a displaced card.

## Dratini / Dragonair / Dragonite

Sources: research-assets/douyin-7684572630280187855/404de94e118f7ab2.webp (Lv1 whole), da4a1cc732bae99a.webp (Lv2 left, Lv3 right). Printed HP: 3 / 3 / 4. Classification: 平衡型.

Lv1/2 神奇鳞片: 当此宝可梦受到伤害时，若此宝可梦处于特殊状态且此伤害值大于1点，你可以令此伤害值-1。

Lv3 多重鳞片: 当此宝可梦受到伤害时，若此宝可梦未受伤，你令此伤害值改为1点。

- Lv1 龙卷风, one command, damage 1. No further paragraph.
- Lv2 龙之怒, one command, damage 2. 此招式无法被强化指示物影响。此招式不可被【快躲开！】抵消。
- Lv3 流星群, one command, damage 2. 此招式可以指定至多两只在此宝可梦的距离限制范围内的宝可梦为目标。此招式无法被强化指示物影响。此招式不可被【快躲开！】抵消。

Marvel Scale is optional and offered before HP subtraction only with a special status and incoming damage above 1. Multiscale is mandatory, using current injuries equal to zero; healing back to full restores its condition. Both apply to item damage as well as moves. Multiscale never turns zero/prevented damage into damage. Source changes precede receiving changes; an ordinary Defense cap leaves no relevant Marvel Scale reduction choice.

Dragon Rage and Draco Meteor ignore Speed's distance benefit, Power's bonus and Defense's cap. Burn and Pokémon abilities still apply. Actual Dodge and Sand Veil's virtual Dodge are disallowed; a public Continue settlement window explains the restriction. Draco Meteor has one independent settlement per chosen target, at most two distinct targets within ordinary distance.

## Explicit interpretation: marker lifecycle

The face says the move cannot be affected by reinforcements. It does not explicitly exempt marker discard triggers. Root and independent reviewer read booklet photo 08, pages 10–11: Power discards on command-driven move use, then grants its damage bonus; Defense separately discards after a card finishes if its holder received damage from it. Therefore Power still discards while its bonus is suppressed, and Defense still discards at whole-card completion after actual damage while its cap is suppressed. Speed retains its usual persistence. This lifecycle is an implementation interpretation combining the sources, not an additional printed sentence on the Pokémon face.

The same source photo states damage timing: source changes → receiving changes → subtract HP/rescue → source after-damage → receiving after-damage. Saved scales decisions and nested Helmet damage preserve that sequence. There is no generic damage-reduction action or new retail card quantity.
