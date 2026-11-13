# 火系与草系道馆建模交接

建模工作树位于 `C:/src/team-rocket-gyms`，分支 `codex/fire-grass-gyms`，从本次合并后的 `main` 开始。原工作树 `C:/src/team-rocket-web` 留给游戏流程与规则验证。

## 建模顺序

1. **先做火系道馆。** 现有黑色岩台与熔岩是早期草稿。为夏伯设计独立的建筑轮廓、材质层次和光照。可以从火山岩、热裂隙和道馆设施入手，确保暖色场地里招式、模型和受击反馈仍然清楚。
2. **火系确认后再做草系道馆。** 现有林地和苔藓石台是草稿。为莉佳设计独立的景深、植被和地面结构。庭园或温室可作为构图方向，注意遮挡、画面密度和不同镜头下的可读性。

水系道馆已验收。参考它的尺度、材质、景深和镜头层次。火系与草系各自决定建筑、装饰和环境动效。开局身份、精灵球选择、战斗和战报都要能放进各自道馆。玩家不能自行选择训练家模型或立绘，阵营与模型分配沿用现有流程。

## 代码入口

| 位置 | 用途 |
| --- | --- |
| `app/public/battlefield-terrain.js` | `createGymTerrain`，地面、主题环境、光照配合、动效与资源生命周期。优先在这里或独立主题模块实现场景。 |
| `app/public/battlefield.js` | 场景搭建、训练家站台、镜头、投影、宝可梦与训练家动作。火草现用通用席位，水系有独立布局和镜头分支。 |
| `app/public/battlefield-layout.js` | 通用 `seatLayout`，以及水系 `coastalSeatLayout`、`coastalStationLayout`。先核对 3–6 席空间和视角再决定火草是否需要单独布局。 |
| `app/public/battlefield-coast.js`、`battlefield-arcade.js` | 水系建筑与景深的已验收参考。 |
| `app/public/battlefield.css` | 屏幕 HUD、各主题样式、窄屏覆盖。保留卡牌和响应区的可达性。 |
| `app/public/trainer-profiles.js` | 火系夏伯 `blaine`、草系莉佳 `erika`。馆主、阵营及角色的模型已接入。 |
| `app/server/index.js` | 静态资源路径白名单。新增场景模型或纹理时在此登记。 |

## 预览和验收

在建模工作树的 `app/` 运行 `npm.cmd ci`，然后设置 `$env:PORT = '4179'` 并运行 `npm.cmd start`。两个工作树各用自己的 `app/.data`，规则验证继续用 4178。访问 [快速场景预览](http://127.0.0.1:4179/?preview=1&motion=on) 切换主题，初版构图确定后再在大厅开真实房间检查所有状态。

- 每个道馆至少交付桌面和 390 px 窄屏实机，含训练家与俯视视角。检查 3 席和 6 席，覆盖身份揭示、开球、目标选择、响应及战报。
- 测试镜头经过大型结构时的遮挡，招式落点、训练家站台、血条和牌面是否清楚。保留减少动态效果和 2D 回退，回归检查水系道馆。
- 场景提交集中在主题资产、静态资源登记和必要的布局或镜头代码。规则差异在验证工作树记录并修正，避免同时改动同一段结算逻辑。

## 本机参考

- [水系道馆设计和演进记录](<C:/Users/pc/Documents/ChatGPT/Game/COASTAL-ARENA-HANDOVER/README.md>)
- [水系开局实机](C:/src/team-rocket-web/output/playwright/opening-review/opening-desktop.mp4) · [水系对局招式](C:/src/team-rocket-web/output/playwright/all-move-update/battle-moves.mp4) · [训练家动作](C:/src/team-rocket-web/output/playwright/trainer-poses/trainer-poses.mp4)
