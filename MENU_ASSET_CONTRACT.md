# Menu Asset Contract

Scope split:
- Codex owns menu structure, scene logic, asset slots, runtime errors, and mobile screenshot validation.
- Antigravity owns the commercial-grade bone-white nun menu art and final visual quality.

## Required Texture Slots

All assets are optional during development. If a slot is `null`, `MenuScene` uses a simple code placeholder and keeps the menu functional.

| Texture key | Target file | Size | Purpose |
| --- | --- | --- | --- |
| `menu_hero_bg` | `assets_generated/menu/menu_hero_bg.png` | 720x1280 | Full-screen commercial menu background. |
| `menu_nun_keyart` | `assets_generated/menu/menu_nun_keyart.png` | 768x768 transparent PNG | Bone-white nun main key art for the first menu tab. |
| `menu_logo_plate` | `assets_generated/menu/menu_logo_plate.png` | 616x146 transparent PNG | Title/logo plate behind `圣裁修女`. |
| `menu_cta_frame` | `assets_generated/menu/menu_cta_frame.png` | 472x104 transparent PNG | Start button frame behind `开始净化`. |

## Integration Rule

When Antigravity delivers assets:
1. Put files under `assets_generated/menu/`.
2. Set the matching keys in `assets/AssetManifest.js` from `null` to placeholders.
3. Add placeholder-to-file mappings in `build.py`.
4. Run `python3 build.py`.
5. Verify only with a 720x1280 mobile screenshot.

## Acceptance

- Menu opens on mobile viewport without JS errors.
- The first screen clearly reads as a commercial bone-white nun menu, not a generic multi-role lobby.
- Start button enters `BattleScene`.
- `成长` and `军械` tabs still update `GameState` and `EquipmentService`.
