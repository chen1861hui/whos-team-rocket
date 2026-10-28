# S04 review handoff — interrupted before final report

Source: https://www.bilibili.com/video/BV1R9tW6hEY3/ — 【谁是火箭队】开箱及规则介绍视频～, EkoLee0102, displayed 2026-08-31, 29:39.

The first reviewer was stopped at the user's request to use a lower-cost model. The final review file has NOT yet been written. Findings below are its messages to the parent from continuous playback/captions and screenshots. Do not claim the replacement reviewer independently reverified them. No definitive retail edition or complete card catalogue established.

## Evidence already collected — do not repeat these sections

- Parent: 05:53–07:03 identities secret except leader; leader and trainer share victory against challengers/Rocket, including eliminated trainer; Rocket described as last survivor; challengers defeat leader. Exact simultaneous-victory priority unresolved.
- Reviewer, 07:07–08:22: random five Pokémon candidates, choose two; both level 1 facedown then reveal one; four initial hand cards. Leader gets +1 maximum HP marker on each Pokémon and level 1→2. Exact player-count applicability not stated in reviewed segment; must check manual.
- Reviewer, 09:12–09:46: play phase permits cards, a move, abilities and switching. Reserve revealed when switched in. Spoken claim that tokens/statuses follow Pokémon is corrected by overlay at09:42: reinforcement tokens must be discarded. Screenshot established that this correction concerns switching. Other statuses not enumerated; do not generalize.
- Reviewer, 10:00–12:34: each Pokémon can hold one item; replacement displaces prior item; both Pokémon may each hold an item. Adjacent-seat distance=1; eliminated seats removed from distance. Preserve stated mechanics separately from presenter's 三国杀 analogies.
- Parent sample15:07: close-up 梦幻的祝福 plus other physical cards; not transcribed or quantity-verified.
- Reviewer, 20:31–23:15: some moves cost a discarded card with a matching weather symbol. Demonstration uses one Pokémon's move, switches once during own turn, then uses incoming Pokémon's move. 接招吧 normally once per turn, with explicit card exceptions possible. Aggregate move limits/color semantics remain uncertain.
- Reviewer, 23:21–23:49: switching does not reset 接招吧 limit.
- Parent frame24:21: on-screen flow 回合开始 → 准备阶段 → 摸牌阶段 → 出牌阶段 → 弃牌阶段 → 结束阶段 → 回合结束.
- Reviewer, 24:31–25:28: discard hand down to FOUR, independent of HP/Pokémon state; <=4 no discard. Ending phase resolves relevant abilities; at turn end active Pokémon below level3 levels up. Presenter corrects optional wording at25:13 to mandatory. Conflict with earlier S01 tentative optional wording; retain conflict until manual/card evidence resolves it.
- Reviewer, 26:11–28:21: damage markers reaching/exceeding HP triggers rescue. Starting affected player then counterclockwise; lower markers below HP to save. Failed rescue flips Pokémon and forces reserve deployment. Both unavailable => player leaves, potentially ending match. Exact available rescue cards/chain ordering/victory priority still unverified.
- Reviewer, 28:03–28:19: only ONE reinforcement marker per Pokémon; new reinforcement replaces prior. Presenter begins another explicit correction immediately afterward. This is the MAIN remaining video interval to inspect (about28:19–29:39).

## What the replacement reviewer should finish

1. Inspect the closing correction from~28:19 to end; pause before end to avoid unrelated autoplay. Record exact subject, caveats and timestamp, not a full transcript.
2. Write video-review-S04.md with source metadata, reviewed intervals, concise rule/evidence table, contradictions, gaps and implementation implications.
3. Say most evidence was handed off, which closing interval you personally reviewed, and that middle card-showcase coverage remains incomplete. Do not claim full29-minute review.
4. Keep game data unchanged; no invented retail confirmation, catalogue quantities or generalization from 三国杀.

## Browser method and access

Each subagent has its own IAB inventory; parent's tab may not appear. Creating a hidden IAB tab at the exact source URL retained authenticated cookies for first reviewer. Do not use unrelated native Chrome. Use CUA APIs only, no hidden state/endpoints or download workaround.

Chinese AI caption DOM: .bili-subtitle-x-subtitle-panel-text. Timeline: .bpx-player-progress-area; seek using its current bounding rectangle and duration1779. Video currentTime/readyState/paused are permitted read-only DOM properties. Seeking can leave stale frames/captions while buffering, so check continuous playback when readyState4. Speed2x is useful. A bounded loop can wait for caption text change using locator.filter({hasNotText:lastCaption}).waitFor({state:'visible',timeoutMs:5000}), then read changed caption/currentTime. Keep calls <=40 seconds and pause between sections. Read screenshots for edited corrections, which may contradict spoken captions. Do not retain/reproduce a full transcript.
