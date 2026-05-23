# In-Game HD Asset Contract

Scope split:
- Codex owns runtime integration, animation timing, hitbox alignment, skill logic, build deployment, and 720x1280 mobile screenshot validation.
- Antigravity owns the final high-resolution in-game art quality: characters, monsters, animation sheets, attack VFX variants, and upgrade-skill VFX concepts.

## Goal

Upgrade the game from prototype-looking assets to a commercial dark gothic mobile action look. The first target is visual credibility in live battle: sharper protagonist, sharper monsters, smoother motion, stronger attack feedback, no green boxes, no cheap trails, no low-resolution enlargement.

## Art Direction

- Main character direction: bone-white / silver-white nun, not pink. Replace any pink cloth impression with layered silver-white, pearl-gray, bone-white, dull steel, dark charcoal lining, and restrained old-gold religious trim.
- Mood: cold sacred judgment, gothic exorcism, ash, bone, iron, candle smoke, restrained blood-fire accents.
- Avoid: cartoon candy colors, neon green, plastic glow, cute/anime chibi proportions, generic AI fantasy clutter, blurry edge halos, text baked into images.
- Silhouette priority: the player must read clearly at phone size on dark dungeon floors and in enemy clusters.

## Required Player Asset Pack

Target folder:
- `assets_generated/nun_hd/`

Required files:
- `nun_hd_idle_sheet.png`
- `nun_hd_run_sheet.png`
- `nun_hd_cast_windup_sheet.png`
- `nun_hd_cast_release_sheet.png`
- `nun_hd_cast_recovery_sheet.png`
- `nun_hd_hit_sheet.png`
- `nun_hd_death_sheet.png`
- `nun_hd_portrait_transparent.png`
- `nun_hd_readme.md`

Technical requirements:
- PNG with alpha, transparent background.
- Suggested source frame: 256x256 per frame minimum. 384x384 is preferred if edge quality stays clean.
- Same canvas size and same foot anchor across all frames.
- Top-down / three-quarter top-down battle readability. Do not make it a front-facing portrait pasted into gameplay.
- No black box, no generated text, no frame numbers, no shadow baked into the transparent sprite unless it is subtle and consistent.
- Deliver both full-resolution sheet and, if needed, a downsampled 128/192 preview only for quick tests. Runtime should use the HD sheet.

Animation requirements:
- Idle: 6 to 8 frames, subtle breathing, cloth settling, sacred ember flicker.
- Run: 8 to 12 frames, clear foot cadence, robe movement, no smear trail baked into the body.
- Cast windup: 6 to 8 frames, arm/staff draw-back, halo/sigil energy gathering.
- Cast release: 4 to 6 frames, strong snap pose, readable projectile origin.
- Cast recovery: 4 to 6 frames, return to combat stance.
- Hit: 3 to 5 frames, sharp impact recoil without looking comedic.
- Death: 8 to 12 frames, collapse/dissolve suitable for dark exorcist tone.

Acceptance for player:
- At 720x1280 phone screenshot, the nun reads as silver-white/bone-white, not pink.
- In motion, the robe and pose changes feel animated, not a static cutout sliding around.
- At gameplay scale, face/body details are not mushy and edges are not pixelated.

## Required Monster HD Pack

Target folder:
- `assets_generated/enemies_hd/`

Current enemy roles to replace:
- Skeleton melee: fast low-tier swarm enemy.
- Ghost caster: ranged spectral enemy.
- Iron tank / knight: large heavy enemy.
- Boss demon: elite/boss silhouette.

Required files:
- `skeleton_hd_walk_sheet.png`
- `skeleton_hd_attack_sheet.png`
- `skeleton_hd_hit_sheet.png`
- `skeleton_hd_death_sheet.png`
- `ghost_caster_hd_float_sheet.png`
- `ghost_caster_hd_cast_sheet.png`
- `ghost_caster_hd_death_sheet.png`
- `iron_tank_hd_walk_sheet.png`
- `iron_tank_hd_attack_sheet.png`
- `iron_tank_hd_hit_sheet.png`
- `iron_tank_hd_death_sheet.png`
- `boss_demon_hd_idle_sheet.png`
- `boss_demon_hd_attack_sheet.png`
- `boss_demon_hd_hit_sheet.png`
- `boss_demon_hd_death_sheet.png`
- `enemies_hd_readme.md`

Technical requirements:
- PNG with alpha, transparent background.
- Suggested source frame: 192x192 per frame minimum for normal monsters, 384x384 per frame minimum for boss.
- Consistent anchor point per enemy type.
- Strong silhouettes that differ at phone scale: skeleton thin/jagged, ghost smoky/floating, tank broad/heavy, boss massive/ritual.
- No baked UI, text, green debug color, or fake rectangular shadows.

Acceptance for monsters:
- A screenshot with 8 to 12 enemies must still show type differences immediately.
- Monsters cannot look like blurry stickers scaled from thumbnails.
- Death and hit reactions need readable impact without blocking gameplay.

## Required VFX Variant Pack

Target folder:
- `assets_generated/vfx_hd/`

The game currently has upgradeable skills, not one fixed attack forever. Current skill pool:
- `talisman`: basic auto projectile, starts unlocked for nun.
- `fireball`: unlockable area explosion, levels 1 to 4.
- `shield`: unlockable orbit/forcefield, levels 1 to 4.
- `magnet`: passive pickup range; needs subtle pickup/absorb VFX, not a combat explosion.

For selection, Antigravity should deliver multiple visual directions for core attack VFX:
- `talisman_projectile_variant_a_sheet.png`: silver-white holy bullet / paper sigil.
- `talisman_projectile_variant_b_sheet.png`: bone flame orb with thin sacred trail.
- `talisman_projectile_variant_c_sheet.png`: cross-shaped shard / needle of judgment.
- `talisman_impact_variant_a_sheet.png`
- `talisman_impact_variant_b_sheet.png`
- `talisman_impact_variant_c_sheet.png`

Skill upgrade VFX:
- `fireball_unlock_sheet.png`: small corrupt holy blast.
- `fireball_lv2_sheet.png`: larger ring and ember burst.
- `fireball_lv3_sheet.png`: stronger shockwave and ground scorch.
- `fireball_lv4_ultimate_sheet.png`: double/echo blast, clearly more powerful.
- `shield_unlock_loop_sheet.png`: small rotating holy ring.
- `shield_lv2_loop_sheet.png`: wider ring, stronger runes.
- `shield_lv3_loop_sheet.png`: faster ring, impact sparks on contact.
- `shield_lv4_loop_sheet.png`: large readable forcefield, not screen-cluttering.
- `magnet_pickup_trail_sheet.png`: subtle soul/coin pull line.
- `level_up_burst_sheet.png`: silver-white/gold ascension burst for level-up moment.

VFX technical requirements:
- PNG with alpha, transparent background.
- Provide each VFX as sprite sheet, not a single static image.
- Use additive/screen-friendly glow but keep alpha clean.
- Do not bake black backgrounds into transparent deliverables.
- Keep effects readable on a dark stone floor and in enemy clusters.
- Avoid full-screen flashes that hide enemies, joystick, HP, or upgrade choices.

VFX acceptance:
- We can test at least 3 talisman projectile/impact versions and choose one.
- Level 4 skills must look clearly stronger than unlock level, but still playable.
- No cheap thick orange circles as the final look; use layered glow, smoke, sparks, symbols, and timing.

## Upgrade Design Notes

Current gameplay supports skill unlocks and upgrades through a three-choice level-up menu. It is not a single fixed skill forever.

Current skill progression:
- `talisman`: Lv1 to Lv4, projectile count and damage scale up.
- `fireball`: Lv0 locked, then Lv1 to Lv4, explosion size and damage scale up.
- `shield`: Lv0 locked, then Lv1 to Lv4, radius and damage scale up.
- `magnet`: Lv1 to Lv4, pickup radius scales up.

Art implication:
- Every active combat skill needs visual escalation across levels.
- Passive magnet still needs a tasteful pickup/absorb effect.
- Level-up itself should have a premium silver-white/gold burst to make progression feel rewarding.

## Codex Integration Slots

Codex will wire these into:
- `assets/AssetManifest.js`
- `build.py`
- `systems/CharacterPresentationSystem.js`
- `entities/Projectile.js`
- `entities/Enemy.js`
- `systems/SkillSystem.js`
- `ui/LevelUpMenu.js`

Keep filenames stable. If Antigravity changes names, update this contract before generating.

## Mobile Validation Standard

All acceptance is based on phone screenshots or captures, not desktop preview only:
- 720x1280 menu-to-battle start.
- 720x1280 player running for 5 seconds.
- 720x1280 combat with 8+ monsters.
- 720x1280 projectile impact.
- 720x1280 level-up selection.
- 720x1280 upgraded skill Lv4 effect.

Pass criteria:
- No green boxes or missing texture placeholders.
- No visible low-resolution enlargement on protagonist or monsters.
- No afterimage smear that looks like accidental ghosting.
- Player remains readable in combat.
- Effects feel powerful but do not block gameplay.

## Priority Order

1. Silver-white HD nun gameplay sheets.
2. HD skeleton and ghost caster sheets.
3. Talisman projectile and impact VFX variants A/B/C.
4. Fireball upgrade VFX Lv1-Lv4.
5. Shield loop VFX Lv1-Lv4.
6. Iron tank and boss demon HD sheets.
7. Magnet pickup trail and level-up burst.

## Direct Prompt For Antigravity

Create commercial-grade 2D top-down gothic mobile game assets for `cyber_survivor_v2`. The protagonist is a silver-white / bone-white exorcist nun, not pink. Produce transparent PNG sprite sheets with consistent anchors and clean alpha. Prioritize gameplay readability at 720x1280 phone size. Replace prototype-looking low-resolution character, monster, and attack effects with high-resolution, smooth animation assets. Provide multiple talisman projectile and impact variants for selection, and include upgraded VFX versions for fireball, shield, magnet pickup, and level-up burst. Keep the tone cold sacred gothic: silver-white cloth, pearl gray, dull steel, bone, charcoal, old-gold trim, restrained blood-fire accents. Avoid cartoon, neon green, blurry AI halos, baked text, black boxes, and low-quality sticker looks.
