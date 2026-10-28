# Content and asset preparation plan

## Current combat milestone — 2026-10-27

**56 tests pass**. A playable **Start combat preview** mode now runs command attacks, target selection, Dodge/pass, HP and starter traits, ordered rescue passes, forced deployment, hidden identities, elimination, real victory and final disclosure in the accepted arena. Three trainers plus a Chinese spectator completed a 13-turn UI-only scenario through Challenger victory. See `gameplay-milestone-4.md` for exact scope/evidence and the explicit test-deck/three-candidate setup. This is not the complete retail deck or roster.

The supplied command/dodge faces were already present and have **no body paragraphs**; `reviewed-playcard-spec.md` corrects the old missing-face blocker. Seven supplied originals are now preserved under `research-assets/provided-previews/`. Potion ordinary heal 2 is visible; complete rescue text is physically obscured. Target-trainer Dodge eligibility is recorded as an interpretation. No need to reconfirm the supplied booklet as the rules basis.

Non-Astra acquisition saved all80 signed observed URLs and one new photo: **54 card photos saved, 26 observed paths missing**. The supported 20-second media call took795 seconds; avoid further unbounded calls. All70 source images (54+9+7) decode and have distinct hashes. Detailed records remain in the asset acquisition checkpoint.

Status (2026-10-26): user authorized a placeholder-based foundation. A draft preview catalogue now exists in app/content/catalogue.json, with public copy app/public/catalogue.json, covering 21 Pokémon rows/63 faces and a separate 15-panel play-card preview ledger. Effects and quantities remain explicitly unavailable. No production assets have been selected or complete retail catalogue acquired. See content-backlog.md for remaining work.

## Game content records

Keep original mechanics independent from redesigned presentation and translations. Use stable IDs shared by all languages and render styles.

| Record | Required fields |
|---|---|
| Edition/mode | Source, version, supported counts, role distribution, setup, turn sequence, victory rules, included card IDs and quantities |
| Pokémon family/form | Stable ID, family link, level, species, original HP, printed symbols, abilities, moves/costs/targets, effect references, source evidence |
| Play card | ID, exact deck quantity, category, printed icons, play conditions, target constraints, responses, effect order, discard destination, source evidence |
| Role | ID, quantities by count/mode, initial visibility, setup modifiers, victory condition and precedence |
| Status/boost | ID, application, stacking cap, duration, trigger order, removal, effect on reserve/switching/level change |
| Localization | Simplified Chinese original, English display name and translation, terminology glossary, rules review status |
| Effect | Preconditions, costs, choices, public/private outputs, response window, resolution, follow-up triggers |

Unknown values stay explicitly unknown. No invented balance, generic substitutes, or inferred duplicate counts. A rule engine can only be finalized once these records are complete.

## Visual and audio manifest

| Asset group | Required inventory and fallback |
|---|---|
| Pokémon | Match each actually included form/species to model, rig, idle/attack/hit/faint/evolution support, scale, bounds, size, source and reuse terms. Where unavailable use a consistent 2D standee/sprite presentation with the same public information. |
| Card faces | Redesigned bilingual template, legible type/level/HP/costs, consistent icon set, card backs for every concealed zone, enlarged view. Art remains separate from mechanics. |
| Arenas | Outdoor stadium, indoor gym, floating fantasy; shared seat/platform anchors and camera framing so switching themes does not change controls. |
| Effects | Draw, flip/reveal, target highlight, attack, damage, recovery, status, switch, knockout, level increase, species evolution and victory. No special effect may leak a concealed identity/form. |
| UI | Public role badges, concealed role, statuses, phase/timer indicators, legal-target markers, draw allowance, connection states, scalable Chinese/Latin fonts. |
| Audio | Background music and effects accepted; independent Music / Effects / Timer-warning controls. Low-HP warning track still to be selected. Record provenance, loop points, volume categories and browser playback behavior. Warning is private to the acting player. |

Candidate model collections were found at https://github.com/06wj/pokemon and https://github.com/pokemon-party/3d-pokemon. Repository overviews and both LICENSE files were inspected. They are not an approved asset pack; roster coverage, asset-specific terms, animation quality and browser performance remain unverified. No paid acquisition is authorized.

Research update: the first repository describes 151 regular-form models and 869 animation clips, loaded as GLB files. This is a maintainer claim, not an independently counted or tested inventory. Both repositories have MIT software-license files; the second separately attributes model ownership to Nintendo/Creatures/GAME FREAK. Do not treat the software license as a completed asset-provenance audit. A public repository-tree request failed because the execution environment could not resolve the hostname; no actual model count or download resulted.

## Visual behavior

Confirmed: fixed arena, player's hand at bottom, all opponents remain visible, brief focus on attacking/defending Pokémon. Full-color Pokémon idle when publicly visible; short attacks and a bigger evolution moment. Owner chooses theme. Mixed 3D/2D accepted.

Confirmed: independent Auto / Low / Medium / High graphics and reduced-motion controls. Low uses 2D Pokémon and simpler effects; higher settings use available models, without affecting gameplay.

Design defaults for later review: click-to-play equivalent for dragging; placeholder opponent reserve until revealed; text/icons always readable without relying on animation or color alone. Animation follows committed game outcomes and never makes a strategic choice.

## Readiness checks before full implementation

1. One complete edition/mode data manifest, with every mechanic and quantity verified.
2. Coverage matrix for every included form; no promise of all-3D coverage before this audit.
3. One representative 3D Pokémon and one 2D fallback tested together in a six-seat layout on an ordinary laptop. Test target and hardware still to be agreed.
4. English and Chinese card text fit both hand and enlarged layouts; neither language changes gameplay values.
5. Representative draw, response, switch, level change and knockout interactions reviewed in a visual prototype.
6. Only then finalize implementation estimates and provider/resource budgets.
