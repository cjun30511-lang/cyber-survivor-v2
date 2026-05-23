# Cyber Survivor / 赛博驱魔人 - Session Handoff (2026-05-22)

## Current state
- Project path: `/Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2`
- Main standalone target:
  - `/Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2/cyber_exorcist_standalone.html`
  - `/Users/shenjun8676/Desktop/赛博驱魔人.html`
- Local test server used:
  - `cd /Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2`
  - `python3 -m http.server 8000`
  - `http://localhost:8000/cyber_exorcist_standalone.html?v=<timestamp>`

## Product judgment
Current version is still a code-level prototype, not a commercial-quality app/game prototype.
Main problems:
1. Stability is not solved. Second-run / replay flow still crashes.
2. Character motion still feels like floating stickers.
3. Combat space and readability are weak.
4. Background / VFX / UI still do not reach product quality.
5. Pure code-driven polish has hit a ceiling; formal art assets are needed.

## Most recent confirmed runtime issue
The latest recurring crash happens on replay / second run.
Observed error under `http://` testing:
- `Uncaught TypeError: Cannot read properties of undefined (reading 'set')`
- Stack points into:
  - Phaser internal `add`
  - `LootSystem.createLootItem`
  - `LootSystem.onSpawnLoot`
  - enemy death chain / projectile hit chain
Interpretation: loot generation is still firing during or after scene transition / teardown on replay.
This is the most important unresolved bug.

## Important code direction already chosen
- Default sample role should be `nun` (blood-flame ranged caster), not the melee knight.
- Do not continue broad multi-role polish.
- First finish:
  1. stability
  2. one good ranged combat sample
  3. then visual/product polish

## What should happen next
### Priority 1: stability
Fix replay / second-run crash completely before any more polish.
Acceptance:
- start battle
- die or finish
- replay
- repeat 3 times
- 60s runtime each
- zero JS errors

### Priority 2: asset pipeline plan
Do not keep relying only on procedural visuals.
Need a mixed asset plan:
- AI-generated core character and key VFX assets
- Possibly bought base packs for dungeon/UI/VFX support
- Then integrate selected assets into game

### Priority 3: first asset batch
Generate only a minimal first batch:
1. Blood-flame nun key art / character presentation
2. Exorcist knight key art
3. Skeleton grunt / elite / boss concept sheets
4. Dungeon background / foreground mood plates
5. Blood-flame circle / projectile / explosion sheets

## Constraints / collaboration rules
- Keep tasks narrow.
- One core goal per turn.
- Do not accept long self-congratulatory status messages.
- Validate by screenshots and actual runtime, not by system descriptions.
- Do not ask the user to repeatedly test obviously unstable builds.

## Suggested next-thread opener
Use this in the next Codex thread:

"Continue from `/Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2/SESSION_HANDOFF_2026-05-22.md`.
First, solve the replay / second-run crash in `LootSystem.createLootItem` / battle teardown.
Do not do any new polish until the game can replay 3 times without JS errors.
After stability is solved, prepare the first AI asset generation spec for the blood-flame nun, knight, dungeon background, and blood-flame VFX."
