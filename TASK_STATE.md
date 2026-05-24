# Cyber Survivor V2 Task State

Updated: 2026-05-24 12:55 CST

## Goal

Continue the content-expansion and root-cause art pass for `cyber_survivor_v2`.

Do not keep patching the old transparent-looking Boss / Iron Tank problem at runtime. The current direction is:

- Keep original detail where it helps.
- Do not restore the fake vector/blocky Boss or armor version.
- Do not add a runtime brown backing board behind enemies.
- Add solid body/matte support only during exported asset generation.
- If Iron Tank still reads too dark or blurry after this pass, the next step is redrawing the source image, not adding more runtime hacks.

## Required Scope

- Expand normal enemy pool with: `ghoul`, `cultist`, `imp`, `wraith`, `brute`.
- Expand Boss pool with: `boss`, `boss_frost`, `boss_plague`, `boss_void`.
- Add 8 map base/overlay pairs and switch them by `GameState.run.mapIndex`.
- Keep map backgrounds low-saturation, low-brightness, and low-contrast enough that the player, red Boss, blue ghost, and metal armor remain readable.
- Keep the ranged `nun` sample as the default gameplay focus.
- Rebuild and publish standalone desktop HTML after integration.

## Current Findings

- `build.py` and `AssetManifest.js` already contain placeholders/references for new enemy, Boss, and map assets.
- `tools/rebuild_core_hd_assets.py` currently regenerates only the old 3 normal enemies, 1 Boss, and VFX. It does not yet create the new content pool or 8 maps.
- `BootScene.js` currently loads/registers only skeleton, ghost, iron tank, and demon boss animation groups.
- `BattleScene.js` currently uses `lava_tile` / `ground_overlay`; it does not yet select `map_base_N` / `map_overlay_N`.
- `WaveConfig.js`, `EnemyConfig.js`, and `SpawnSystem.js` have partial content-pool changes but need final validation against loaded assets and animation names.

## Agent Boundaries

Main controller:

- Owns this state file, final integration, build, screenshots, and acceptance.
- Reviews all worker output before final delivery.

assets-agent:

- May edit only `tools/rebuild_core_hd_assets.py`.
- May generate or update files under `assets_generated/enemies_hd/`, `assets_generated/dungeon/`, `assets_generated/vfx_hd/`, and `scratch/runtime_acceptance/`.
- Must not edit runtime JS config or scene files.

runtime-agent:

- May edit only `assets/AssetManifest.js`, `scenes/BootScene.js`, and `scenes/BattleScene.js`.
- Must load/register all new enemy/Boss/map textures and switch maps by `GameState.run.mapIndex`.
- Must not edit asset-generation Python or spawn/config files.

spawn-agent:

- May edit only `config/EnemyConfig.js`, `config/WaveConfig.js`, `systems/SpawnSystem.js`, and `entities/BossDemon.js`.
- Must keep config keys, animation prefixes, and Boss selection aligned with the runtime texture names.
- Must not edit asset-generation Python or Boot/Battle scene files.

verify-agent:

- Should run validation only after integration is ready.
- May read any file and run build/screenshot/check scripts.
- Should not edit production files unless explicitly assigned a narrow fix.

## Agent Status

| Chinese name | Tool agent | Agent id | Responsibility | Status |
| --- | --- | --- | --- | --- |
| 主控智能体 | Codex main | current thread | Task state, coordination, integration, build, screenshots, final acceptance | in progress |
| 资产智能体 | Lagrange | 019e565f-fc04-7d30-a432-29aecde6d58a | Asset generator and generated PNG pools | completed |
| 运行时智能体 | Euler | 019e5660-159c-7e93-ab55-3b75abdf048f | AssetManifest/BootScene/BattleScene runtime wiring | completed |
| 刷怪智能体 | Jason | 019e5660-303b-7512-bcd5-eaa5c0065b48 | Enemy/Boss config, wave weights, SpawnSystem, BossDemon variant behavior | completed |
| 验收智能体 | not spawned | n/a | Build/runtime screenshot/console validation | handled by main controller for this pass |

Use these Chinese names for future control requests:

- "资产智能体": asset generation and image pools.
- "运行时智能体": resource loading, animations, map rendering.
- "刷怪智能体": enemy/Boss gameplay config and spawn flow.
- "验收智能体": build, screenshot, console, and visual-readability checks.

## Completed This Pass

- `tools/rebuild_core_hd_assets.py` now exports the expanded content pool.
- Generated normal enemy sheets for `ghoul`, `cultist`, `imp`, `wraith`, and `brute`.
- Generated Boss variant sheets for `boss_frost`, `boss_plague`, and `boss_void`.
- Generated `map_base_0..7.png` and `map_overlay_0..7.png`.
- `BootScene.js` loads and registers all new enemy, Boss, VFX, and map textures.
- `BootScene.js` creates animations for the new normal enemies and all four Boss prefixes.
- `BattleScene.js` selects `map_base_N` / `map_overlay_N` using `GameState.run.mapIndex`, with legacy fallback.
- `EnemyConfig.js`, `WaveConfig.js`, `SpawnSystem.js`, and `BossDemon.js` align enemy keys, weights, Boss pool, and Boss visual variants.
- `python3 build.py` published:
  - `/Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2/cyber_exorcist_standalone.html`
  - `/Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2/index.html`
  - `/Users/shenjun8676/Desktop/赛博驱魔人.html`

## Verification Results

- `python3 tools/rebuild_core_hd_assets.py`: passed.
- `python3 build.py`: passed.
- `node --check` on changed runtime/config files: passed.
- Asset existence/dimension check: passed for all 48 requested new normal/Boss/map files.
- Runtime CDP check: passed; all new textures and animations exist.
- Runtime spawn check: passed; `ghoul`, `cultist`, `imp`, `wraith`, `brute`, `boss`, `boss_frost`, `boss_plague`, and `boss_void` instantiated without console errors or missing-animation logs.
- Screenshot capture script: passed; 6 screenshots written to `scratch/runtime_acceptance/`.
- Additional new-content screenshot: `scratch/runtime_acceptance/multiagent_new_content_verify.png`.

## Remaining Risks

- New enemy and Boss variants are procedural/recolored/detail-composited assets, not fully hand-redrawn source illustrations.
- Iron Tank is more stable than before but may still read slightly dark because the source material has weak value separation; if that remains unacceptable, redraw the source rather than adding runtime patches.
- Map backgrounds are deliberately dark/subdued for readability. If future art raises unit brightness, map values may need another pass.

## Acceptance Commands

Run from `/Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2`:

```bash
python3 tools/rebuild_core_hd_assets.py
python3 build.py
```

Then run screenshot/runtime checks that verify:

- No missing asset file during build.
- No missing texture/animation error in browser console.
- New normal enemies can spawn without animation crashes.
- Boss pool can pick all four Boss keys without animation crashes.
- Map backgrounds render and do not visually overpower characters or enemies.

## Current Visual Constraint

Visual thesis: dark gothic cyber-survivor combat with restrained matte floors and high-readability silhouettes. Backgrounds must support combat clarity, not compete with units or VFX.

## Quality Asset Sprint 1

Status: source accepted and first sheet integration completed

Primary targets:

- Iron Tank source art.
- Demon Boss source art.

Goal:

- Replace the weak source-level readability for Iron Tank and Demon Boss with stronger, non-vector, non-blocky, opaque, detailed source artwork.
- Preserve the dark gothic survivor style, but raise silhouette clarity, value separation, armor/body material read, and animation usefulness.
- This sprint is not about adding more content keys. It is about making the two most important enemies look commercially credible.

Non-goals:

- Do not expand more enemy types in this sprint.
- Do not solve quality by recoloring existing Bosses.
- Do not add runtime enemy backing boards.
- Do not call procedural tint/scale variants "final art".

Quality gate:

- Source art must not look like a simple color swap.
- Iron Tank must read clearly against dark maps at gameplay scale.
- Demon Boss must have a strong unique silhouette, readable head/chest/arms, and visible material detail.
- Animation sheets must have meaningful pose variation, not only scale/rotate/tint.
- Runtime screenshots must prove readability with the nun, low-dark maps, VFX, and HUD present.

Quality sprint agents:

| Chinese name | Planned responsibility | Status |
| --- | --- | --- |
| 美术导演智能体 | Define visual target sheets and failure criteria for Iron Tank and Demon Boss | pending |
| 源图资产智能体 | Create or prepare high-quality source images for the two targets | pending |
| 动画切帧智能体 | Convert source art into action sheets with meaningful frame differences | pending |
| 验收智能体 | Check image quality, animation readability, runtime screenshots, and console/build health | pending |

Active quality sprint agents:

| Chinese name | Tool agent | Agent id | Status |
| --- | --- | --- | --- |
| 美术导演智能体 | Kepler | 019e566f-0537-7260-944b-069e4c1e42ef | running |
| 动画切帧智能体 | Bernoulli | 019e566f-21a1-7191-9c0f-46d5cbca8b80 | running |
| 验收智能体 | Dalton | 019e566f-3cd1-7002-9113-622dcd93dc11 | running |
| 源图资产智能体 | not spawned yet | n/a | pending director/animation specs |

### Quality Asset Sprint 1 Planning Results

- 美术导演智能体: completed. It defined Iron Tank as a heavy opaque gunmetal armored tank with readable head/chest/weapon highlights, and Demon Boss as a unique ritual demon warlord with a clear horned head, molten chest core, massive arms, and non-recolor silhouette.
- 动画切帧智能体: completed. It confirmed current Iron Tank/Boss actions still rely too much on `attack_from()` / `death_from()` mechanical transforms and specified real pose requirements for walk/idle, attack, hit, and death.
- 验收智能体: completed. It defined required build/runtime checks and new QA output paths: `qa_iron_tank_contact.png`, `qa_demon_boss_contact.png`, `qa_iron_tank_frame_diff.png`, `qa_demon_boss_frame_diff.png`, and `qa_map_readability_grid.png`.

Immediate next step:

- Start 源图资产智能体 for only two high-quality source targets: Iron Tank and Demon Boss.
- Save source outputs under `scratch/generated_art_v2/quality_sprint_1/`.
- Do not edit runtime code until source quality is accepted.

### Quality Asset Sprint 1 Source Agent

| Chinese name | Tool agent | Agent id | Status | Output paths | Last note |
| --- | --- | --- | --- | --- | --- |
| 源图资产智能体 | Hubble | 019e5672-4cf6-7841-8d9d-9cfb961c1f9b | completed | `scratch/generated_art_v2/quality_sprint_1/`; `scratch/runtime_acceptance/quality_sprint_1_source_review.md` | Generated source candidates with built-in imagegen; good quality but more heroic three-quarter than strict top-down/isometric |

Source candidate outputs:

- Iron Tank: `scratch/generated_art_v2/quality_sprint_1/iron_tank_source_candidate_01.png`
- Demon Boss rejected: `scratch/generated_art_v2/quality_sprint_1/boss_demon_source_candidate_01.png`
- Demon Boss accepted: `scratch/generated_art_v2/quality_sprint_1/boss_demon_source_candidate_02.png`
- Source review: `scratch/runtime_acceptance/quality_sprint_1_source_review.md`

### Quality Asset Sprint 1 Implementation Result

- Accepted `iron_tank_source_candidate_01.png`: strong readable top-down/isometric-ish armored tank source, enough material detail and silhouette separation for sprite generation.
- Rejected `boss_demon_source_candidate_01.png`: strong illustration but too frontal/portrait-like and too cluttered for directional/action slicing.
- Generated and accepted `boss_demon_source_candidate_02.png`: stricter top-down/isometric boss source with readable head, shoulders, arms, feet, and molten chest core.
- Updated `tools/rebuild_core_hd_assets.py` to load the accepted quality sprint source images directly instead of the old weak source sheets for Iron Tank and Demon Boss.
- Added source-driven segmented posing for Iron Tank walk/attack/hit/death and Demon Boss idle/attack/hit/death.
- Kept runtime output paths unchanged:
  - `assets_generated/enemies_hd/iron_tank_hd_{walk,attack,hit,death}_sheet.png`
  - `assets_generated/enemies_hd/boss_demon_hd_{idle,attack,hit,death}_sheet.png`
- Added QA exports:
  - `scratch/runtime_acceptance/qa_iron_tank_contact.png`
  - `scratch/runtime_acceptance/qa_demon_boss_contact.png`
  - `scratch/runtime_acceptance/qa_iron_tank_frame_diff.png`
  - `scratch/runtime_acceptance/qa_demon_boss_frame_diff.png`
  - `scratch/runtime_acceptance/qa_map_readability_grid.png`
- Fixed chroma-key edge bleed by clearing RGB on transparent green-screen pixels before rotation/resizing.
- Disabled Boss interior fill matte to avoid a generated backing-board look; Iron Tank keeps interior fill support for solid armor readability.

Verification:

- `python3 tools/rebuild_core_hd_assets.py`: passed.
- `python3 build.py`: passed and republished `cyber_exorcist_standalone.html`, `index.html`, and `/Users/shenjun8676/Desktop/赛博驱魔人.html`.
- `python3 -m py_compile tools/rebuild_core_hd_assets.py`: passed.
- Runtime CDP check at `http://127.0.0.1:8024/cyber_exorcist_standalone.html?screenshot=true`: Phaser loaded; error banner returned `NO BANNER`.
- Screenshot capture passed; six browser screenshots written to `scratch/runtime_acceptance/quality_sprint_1_browser/`.
- Visual spot-check: `real_monsters_heavy.png` and `real_combat_chaos.png` show Iron Tank and Demon Boss readable against dark maps with nun, enemies, VFX, and HUD present.

Remaining risks:

- Animation is still source-derived 2.5D segmented posing from single illustrations, not true hand-authored multi-pose art.
- Demon Boss is much stronger than the rejected source, but still visually large/dominant in chaotic scenes; future tuning may reduce boss runtime scale or author true attack/death pose art.
- Iron Tank is now clear and detailed, but its animation still depends on segmented weapon/limb offsets rather than bespoke painted frames.

Next safe handoff point:

- Continue with a new short thread for final polish only if needed.
- Start by checking `scratch/runtime_acceptance/quality_sprint_1_browser/real_monsters_heavy.png`, `real_combat_chaos.png`, `qa_iron_tank_contact.png`, and `qa_demon_boss_contact.png`.
- If accepting this sprint, move on to scale/combat readability tuning or true multi-pose redraws; do not add runtime backing boards or procedural recolor-only quality claims.

### 2026-05-24 中文补充：GitHub 同步整理与 scale 收口

- 已按交接要求先执行 `git status --short --branch`，确认 Quality Asset Sprint 1、内容池扩展、运行时接线、生成资产、QA 证据和一次性 scratch/debug 文件混在同一工作树中。
- 提交边界应保留：运行时代码和配置、`tools/rebuild_core_hd_assets.py`、`build.py`、`TASK_STATE.md`、`SESSION_HANDOFF_2026-05-24.md`、运行时 sheet、地图资源、Quality Sprint 1 源图、正式 QA 证据和最新浏览器截图。
- 暂不提交：`scratch/*inspect*/` 小图目录、`scratch/debug_*`、`scratch/check_*`、`scratch/inspect_*`、`scratch/test_*`、临时切片试验脚本，除非后续确认它们进入正式资产管线。
- 视觉复查旧截图后，Iron Tank 通过；Demon Boss 过大。已只调运行时 Boss 系列 scale：
  - `boss`: `1.17` -> `0.96`
  - `boss_frost`: `1.12` -> `0.92`
  - `boss_plague`: `1.15` -> `0.94`
  - `boss_void`: `1.18` -> `0.96`
- 重新运行 `python3 build.py` 后，最新截图已写入 `scratch/runtime_acceptance/quality_sprint_1_browser/`。
- 最新视觉结论：Demon Boss 仍然有首领压迫感，但不再吞掉上半场战斗信息；Iron Tank 保持清晰。Quality Asset Sprint 1 可以收口进入 GitHub 同步，不需要继续缩放。
- 验证通过：
  - `python3 -m py_compile tools/rebuild_core_hd_assets.py`
  - `node --check` 覆盖本轮改动的运行时、配置、场景、系统和 scratch 验证脚本
  - `python3 build.py`
  - `node scratch/capture_screenshots.js`
  - `node scratch/diagnose_evaluations.js`

### 2026-05-24 中文补充：手机截图反馈后的地图与比例修正

- 用户手机截图反馈：主角身后有碎片残影、施法点仍像小火柴光点、Boss 比人物还小、8 张高质量地图未看到、画面比例需要继续调整。
- 本轮按多智能体分工收口第一步：
  - 主控智能体：拆分验收标准和提交边界。
  - 美术导演智能体：确认手机端比例标准，Boss 应明显大于主角和重装怪，地图必须是不同空间语言而不是调色。
  - 运行接线/验收智能体：定位主角残影、法器发射点、Boss scale、地图过黑/程序化的问题。
- 已接入高质量地图源图：
  - 已接受源图：`scratch/generated_art_v2/map_sprint_1/map_source_contact_02_accepted_distinct.png`
  - 已保留但拒绝：`scratch/generated_art_v2/map_sprint_1/map_source_contact_01_rejected_similar.png`
  - `tools/rebuild_core_hd_assets.py` 现在优先从已接受的 8 图联系图切出 `map_base_0..7.png` 和 `map_overlay_0..7.png`，程序化地图只作为源图缺失时的兜底。
- 已保留 Boss 源图候选用于下一步动作帧：
  - `scratch/generated_art_v2/boss_sprint_1/boss_source_contact_01_accepted.png`
- 已处理当前手机截图里最明显的表现问题：
  - 去掉主角常驻脚下火花/残影类表现，减少身后碎片感。
  - 统一施法发射点到手杖/法器尖端，放大符咒弹体并减少“小火柴光点”读感。
  - Boss scale 从上一轮收缩值恢复到首领层级；最新运行截图中 Boss 已明显大于主角和 Iron Tank，不再继续放大。
  - 高质量地图叠层透明度下调，避免把源图又盖黑。
- 已重新构建：
  - `python3 -m py_compile tools/rebuild_core_hd_assets.py`
  - `python3 tools/rebuild_core_hd_assets.py`
  - `python3 build.py`
- 已重新生成手机比例运行截图：
  - `scratch/runtime_acceptance/current_mobile/real_monsters_heavy.png`
  - `scratch/runtime_acceptance/current_mobile/real_combat_chaos.png`
  - `scratch/runtime_acceptance/current_mobile/real_player_combat.png`
- 最新视觉结论：
  - 地图方向已纠正为高质量源图资产，8 张图在 QA 联系图中能区分为教堂、机械工坊、墓园、水渠、熔炉、虚空裂隙、瘟疫庭院、冰殿。
  - Boss 当前比例已经足够大；继续 scale tune 的收益低，风险是遮挡战场。
  - 下一步应进入 Boss 动作帧完善和技能差异化，而不是继续调比例或只换颜色。
