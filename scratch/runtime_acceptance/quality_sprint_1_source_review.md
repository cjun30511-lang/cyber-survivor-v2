# Quality Sprint 1 Source Review

Status: completed

Generated with: built-in imagegen

Workspace outputs:

- `scratch/generated_art_v2/quality_sprint_1/iron_tank_source_candidate_01.png`
- `scratch/generated_art_v2/quality_sprint_1/boss_demon_source_candidate_01.png`

Original generated files:

- Iron Tank: `/Users/shenjun8676/.codex/generated_images/019e5672-4cf6-7841-8d9d-9cfb961c1f9b/ig_0e52e712b643c2a6016a1208dcc04c8195b10e47a2b6c2bcd6.png`
- Demon Boss: `/Users/shenjun8676/.codex/generated_images/019e5672-4cf6-7841-8d9d-9cfb961c1f9b/ig_0e52e712b643c2a6016a120932948081959ccd9b7155792b94.png`

Post-processing:

- Copied the selected generated PNGs into the sprint output directory.
- Normalized obvious green-screen background pixels in the workspace copies to exact `#00ff00`.
- Did not create transparent cutouts.
- Did not edit runtime code, config, existing generated assets, or `tools/rebuild_core_hd_assets.py`.

## Iron Tank

Path: `scratch/generated_art_v2/quality_sprint_1/iron_tank_source_candidate_01.png`

Dimensions: 1254 x 1254

Prompt:

```text
Use case: stylized-concept
Asset type: source art for a mobile survivor game enemy sprite, later to be cut into animation frames
Primary request: Iron Tank high-quality source image, top-down three-quarter / isometric mobile survivor enemy sprite.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background only. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, lighting variation, border, UI, text, watermark, backdrop panel, or shadow plate. Do not use #00ff00 anywhere in the subject.
Subject: a heavy opaque gunmetal iron tank enemy, dark gothic cyber-survivor style. Bulky armored humanoid tank silhouette with clear head/helmet, broad chest plate, heavy shoulder armor, reinforced gauntlets, thick boots or treads-like lower armor, and a compact brutal weapon integrated into one arm. Strong readable silhouette at small gameplay scale, clear value separation between helmet, chest, arms, weapon, and legs. Detailed hand-painted / high-end game concept sprite look, non-vector, non-blocky, non-procedural. Matte gunmetal, scratched steel, rivets, glowing small cyan-orange reactor accents, grime, edge highlights, battle damage.
Composition: single full-body character centered with generous padding, facing slightly down/right in top-down three-quarter/isometric perspective, orthographic game sprite feel. Keep all limbs visible and separated enough for later frame cutting. Crisp opaque edges, no transparency needed.
Negative constraints: no text, no letters, no numbers, no UI, no logo, no props detached from the character, no scene, no floor, no cast shadow, no contact shadow, no backing board, no simple geometric vector blocks, no flat recolor, no rotated/scaled existing asset look, no cute toy style, no photorealistic background.
```

Self-review:

- Meets source draft gate for opaque body mass, armor material read, value separation, and non-vector detail.
- Strong improvement candidate over the weak previous Iron Tank readability.
- Head, chest, shoulders, weapon arm, and legs are readable enough for downstream slicing.

Risks:

- Perspective is closer to heroic three-quarter than strict top-down/isometric.
- Large weapon arm and broad shoulders may need careful scale normalization in runtime sheets.
- Bottom-left weapon silhouette has limited padding; downstream crop should avoid aggressive trimming.

## Demon Boss

Path: `scratch/generated_art_v2/quality_sprint_1/boss_demon_source_candidate_01.png`

Dimensions: 1024 x 1536

Prompt:

```text
Use case: stylized-concept
Asset type: source art for a mobile survivor game boss sprite, later to be cut into animation frames
Primary request: Demon Boss high-quality source image, top-down three-quarter / isometric mobile survivor boss sprite.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background only. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, lighting variation, border, UI, text, watermark, backdrop panel, or shadow plate. Do not use #00ff00 anywhere in the subject.
Subject: a unique ritual demon warlord boss for a dark gothic cyber-survivor game. Massive horned head, readable snarling face or mask, molten ember chest core, huge asymmetrical arms and clawed hands, heavy ritual armor plates, charred black-red flesh, bone spikes, iron chains embedded into armor, occult metal details, glowing orange-red internal cracks. Strong non-recolor silhouette clearly different from a normal enemy, readable head/chest/arms at gameplay scale, high material detail, opaque body mass, painterly high-end game sprite concept art, not vector and not blocky.
Composition: single full-body boss character centered with generous padding, facing slightly down/right in top-down three-quarter/isometric perspective, orthographic game sprite feel. Keep horns, arms, torso, claws, and legs visible and separated enough for later animation frame cutting. Crisp opaque edges, no transparency needed.
Negative constraints: no text, no letters, no numbers, no UI, no logo, no scene, no floor, no cast shadow, no contact shadow, no backing board, no simple geometric vector blocks, no flat recolor, no simple palette swap, no rotated/scaled existing asset look, no cute toy style, no photorealistic background.
```

Self-review:

- Meets source draft gate for unique silhouette, horned head, molten chest core, massive arms, armor/flesh material contrast, and non-recolor identity.
- Strong art-directable boss candidate with enough detail for a commercial-quality first slicing pass.
- Clear center mass and high-contrast facial/chest focal points should help gameplay readability after scale tuning.

Risks:

- Perspective is more frontal than true top-down/isometric.
- Very high detail may need simplification or contrast grouping when reduced to gameplay scale.
- Tall 1024 x 1536 source needs controlled downscale/crop before spritesheet generation.
