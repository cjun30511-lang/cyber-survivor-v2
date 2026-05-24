#!/usr/bin/env python3
"""Rebuild core runtime HD character sheets from clean generated sources."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ROOT = Path("/Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2")
SRC = ROOT / "scratch/generated_art_v2"
QUALITY_SRC = SRC / "quality_sprint_1"
ENEMIES = ROOT / "assets_generated/enemies_hd"
VFX = ROOT / "assets_generated/vfx_hd"
DUNGEON = ROOT / "assets_generated/dungeon"
QA_DIR = ROOT / "scratch/runtime_acceptance"
PREVIEW = QA_DIR / "runtime_preview_contact.png"
IRON_TANK_QUALITY_SOURCE = QUALITY_SRC / "iron_tank_source_candidate_01.png"
BOSS_DEMON_QUALITY_SOURCE = QUALITY_SRC / "boss_demon_source_candidate_02.png"
MAP_SPRINT_SOURCE = SRC / "map_sprint_1" / "map_source_contact_02_accepted_distinct.png"


def remove_black_backdrop(cell: Image.Image) -> Image.Image:
    data = np.array(cell.convert("RGBA"))
    brightness = data[..., :3].mean(axis=2)
    data[brightness < 18, 3] = 0
    edge = (brightness >= 18) & (brightness < 36)
    data[edge, 3] = (data[edge, 3] * ((brightness[edge] - 18) / 18)).astype(np.uint8)
    return Image.fromarray(data)


def content_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    alpha = np.array(img)[..., 3]
    ys, xs = np.where(alpha > 14)
    if len(xs) == 0:
        raise RuntimeError("empty frame after background removal")
    return int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)


def extract_horizontal_frames(path: Path, frame_count: int) -> list[Image.Image]:
    image = Image.open(path).convert("RGBA")
    cell_w = image.width / frame_count
    frames: list[Image.Image] = []

    for index in range(frame_count):
        left = int(round(index * cell_w))
        right = int(round((index + 1) * cell_w))
        cell = image.crop((left, 0, right, image.height))
        clean = remove_black_backdrop(cell)
        frames.append(clean.crop(content_bbox(clean)))

    return frames


def tint(frame: Image.Image, color: tuple[int, int, int], strength: float) -> Image.Image:
    base = frame.convert("RGBA")
    overlay = Image.new("RGBA", base.size, (*color, 0))
    alpha = np.array(base)[..., 3]
    overlay_data = np.array(overlay)
    overlay_data[..., 3] = (alpha * strength).astype(np.uint8)
    overlay = Image.fromarray(overlay_data)
    return Image.alpha_composite(base, overlay)


def fade(frame: Image.Image, factor: float) -> Image.Image:
    data = np.array(frame.convert("RGBA"))
    data[..., 3] = (data[..., 3] * factor).astype(np.uint8)
    return Image.fromarray(data)


def transform(frame: Image.Image, *, scale_x: float = 1.0, scale_y: float = 1.0, rotate: float = 0.0) -> Image.Image:
    width = max(1, int(frame.width * scale_x))
    height = max(1, int(frame.height * scale_y))
    out = frame.resize((width, height), Image.Resampling.LANCZOS)
    if rotate:
        out = out.rotate(rotate, expand=True, resample=Image.Resampling.BICUBIC)
    return out


def polish_frame(frame: Image.Image) -> Image.Image:
    sharpened = frame.filter(ImageFilter.UnsharpMask(radius=0.65, percent=82, threshold=3))
    return ImageEnhance.Contrast(sharpened).enhance(1.04)


def solidify_alpha(frame: Image.Image) -> Image.Image:
    data = np.array(frame.convert("RGBA"))
    alpha = data[..., 3].astype(np.float32)
    visible = alpha > 6
    solid = alpha >= 48
    data[..., 3] = np.where(solid, 255, np.clip(alpha * 3.2, 0, 255)).astype(np.uint8)
    data[..., 3] = np.where(visible, data[..., 3], 0).astype(np.uint8)
    return Image.fromarray(data)


def add_body_matte(
    frame: Image.Image,
    color: tuple[int, int, int],
    *,
    opacity: int = 255,
    expand: int = 11,
    fill_interior: bool = False,
) -> Image.Image:
    base = frame.convert("RGBA")
    mask = base.getchannel("A").point(lambda value: 255 if value > 8 else 0)
    # Close small transparent gaps inside AI-cutout monsters so the body reads as solid in-game.
    matte_mask = mask.filter(ImageFilter.MaxFilter(expand)).filter(ImageFilter.MinFilter(max(3, expand - 2)))
    if fill_interior:
        mask_np = np.array(mask) > 0
        row_fill = np.zeros_like(mask_np)
        for y in range(mask_np.shape[0]):
            xs = np.where(mask_np[y])[0]
            if len(xs) >= 10:
                row_fill[y, xs.min(): xs.max() + 1] = True
        col_fill = np.zeros_like(mask_np)
        for x in range(mask_np.shape[1]):
            ys = np.where(mask_np[:, x])[0]
            if len(ys) >= 10:
                col_fill[ys.min(): ys.max() + 1, x] = True
        interior = row_fill & col_fill
        interior_img = Image.fromarray(interior.astype(np.uint8) * 255)
        matte_mask = Image.fromarray(np.maximum(np.array(matte_mask), np.array(interior_img)))
    matte_alpha = (np.array(matte_mask).astype(np.float32) * (opacity / 255.0)).astype(np.uint8)
    matte = Image.new("RGBA", base.size, (*color, 0))
    matte_data = np.array(matte)
    matte_data[..., 3] = matte_alpha
    return Image.alpha_composite(Image.fromarray(matte_data), base)


def enemy_matte_color(out_path: Path) -> tuple[int, int, int]:
    name = out_path.stem
    if "ghost" in name:
        return 8, 24, 38
    if "wraith" in name:
        return 10, 12, 28
    if "frost" in name:
        return 12, 31, 34
    if "plague" in name:
        return 22, 34, 18
    if "void" in name:
        return 15, 10, 28
    if "boss" in name:
        return 58, 3, 8
    if "iron_tank" in name:
        return 54, 42, 32
    if "brute" in name:
        return 40, 34, 30
    if "cultist" in name:
        return 24, 16, 28
    if "imp" in name:
        return 40, 14, 12
    if "ghoul" in name:
        return 20, 28, 20
    return 26, 22, 18


def make_sheet(
    frames: list[Image.Image],
    frame_w: int,
    frame_h: int,
    pad_bottom: int,
    out_path: Path,
    *,
    solid_alpha: bool = True,
    body_matte: bool = False,
    matte_color: tuple[int, int, int] = (26, 22, 18),
    fill_interior: bool = False,
) -> None:
    max_w = max(frame.width for frame in frames)
    max_h = max(frame.height for frame in frames)
    scale = min(int(frame_w * 0.88) / max_w, int(frame_h * 0.88) / max_h)
    sheet = Image.new("RGBA", (frame_w * len(frames), frame_h), (0, 0, 0, 0))

    for index, frame in enumerate(frames):
        width = max(1, int(frame.width * scale))
        height = max(1, int(frame.height * scale))
        resized = polish_frame(frame.resize((width, height), Image.Resampling.LANCZOS))
        if solid_alpha:
            resized = solidify_alpha(resized)
        if body_matte:
            resized = add_body_matte(resized, matte_color, fill_interior=fill_interior)
        x = index * frame_w + (frame_w - width) // 2
        y = frame_h - height - pad_bottom
        sheet.alpha_composite(resized, (x, y))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)


def cycle(frames: list[Image.Image], count: int) -> list[Image.Image]:
    return [frames[index % len(frames)] for index in range(count)]


def attack_from(frames: list[Image.Image], count: int) -> list[Image.Image]:
    picked = cycle(frames[1::2] or frames, count)
    result = []
    for index, frame in enumerate(picked):
        sx = 1.0 + 0.04 * index
        result.append(transform(frame, scale_x=sx, scale_y=1.0))
    return result


def hit_from(
    frames: list[Image.Image],
    count: int,
    color: tuple[int, int, int] = (180, 36, 28),
) -> list[Image.Image]:
    picked = cycle(frames, count)
    return [tint(frame, color, 0.20 + index * 0.06) for index, frame in enumerate(picked)]


def death_from(frames: list[Image.Image], count: int) -> list[Image.Image]:
    seed = frames[-1]
    result = []
    for index in range(count):
        factor = max(0.12, 1.0 - index / max(1, count - 1))
        squish = 1.0 - 0.35 * (index / max(1, count - 1))
        result.append(fade(transform(seed, scale_y=squish, rotate=index * 2.0), factor))
    return result


def cast_from(frames: list[Image.Image], count: int) -> list[Image.Image]:
    picked = cycle(frames, count)
    return [tint(frame, (224, 196, 118), 0.12 + index * 0.04) for index, frame in enumerate(picked)]


def make_preview(paths: list[Path]) -> None:
    cells = []
    for path in paths:
        image = Image.open(path).convert("RGBA")
        bg = Image.new("RGBA", image.size, (32, 32, 32, 255))
        bg.alpha_composite(image)
        bg.thumbnail((320, 130), Image.Resampling.LANCZOS)
        cell = Image.new("RGBA", (340, 158), (22, 22, 22, 255))
        cell.alpha_composite(bg, ((340 - bg.width) // 2, 8))
        cells.append(cell)

    cols = 2
    rows = (len(cells) + cols - 1) // cols
    contact = Image.new("RGBA", (cols * 340, rows * 158), (14, 14, 14, 255))
    for index, cell in enumerate(cells):
        contact.alpha_composite(cell, ((index % cols) * 340, (index // cols) * 158))
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    contact.save(PREVIEW)


def make_attack_vfx_preview() -> None:
    out_dir = ROOT / "scratch/runtime_acceptance"
    out_dir.mkdir(parents=True, exist_ok=True)
    variants = ["a", "b", "c", "d"]
    rows: list[Image.Image] = []
    gif_frames: list[Image.Image] = []

    for variant in variants:
        proj = Image.open(VFX / f"talisman_projectile_variant_{variant}_sheet.png").convert("RGBA")
        imp = Image.open(VFX / f"talisman_impact_variant_{variant}_sheet.png").convert("RGBA")
        row = Image.new("RGBA", (max(proj.width, imp.width), 540), (18, 18, 18, 255))
        bg_proj = Image.new("RGBA", proj.size, (28, 28, 28, 255))
        bg_proj.alpha_composite(proj)
        bg_imp = Image.new("RGBA", imp.size, (28, 28, 28, 255))
        bg_imp.alpha_composite(imp)
        row.alpha_composite(bg_proj, (0, 0))
        row.alpha_composite(bg_imp, (0, 280))
        rows.append(row)

        frame_count = max(proj.width // 256, imp.width // 256)
        for index in range(frame_count):
            frame = Image.new("RGBA", (560, 280), (20, 20, 20, 255))
            p_index = min(index, proj.width // 256 - 1)
            i_index = min(index, imp.width // 256 - 1)
            p = proj.crop((p_index * 256, 0, p_index * 256 + 256, 256))
            im = imp.crop((i_index * 256, 0, i_index * 256 + 256, 256))
            frame.alpha_composite(p, (32, 12))
            frame.alpha_composite(im, (280, 12))
            gif_frames.append(frame.convert("P", palette=Image.Palette.ADAPTIVE))

    contact = Image.new("RGBA", (max(row.width for row in rows), len(rows) * 540), (12, 12, 12, 255))
    for index, row in enumerate(rows):
        contact.alpha_composite(row, (0, index * 540))
    contact.save(out_dir / "attack_vfx_contact.png")
    if gif_frames:
        gif_frames[0].save(
            out_dir / "attack_vfx_anim.gif",
            save_all=True,
            append_images=gif_frames[1:],
            duration=42,
            loop=0,
            optimize=False,
        )


def aa_canvas(size: int, factor: int = 3) -> tuple[Image.Image, ImageDraw.ImageDraw, int]:
    canvas = Image.new("RGBA", (size * factor, size * factor), (0, 0, 0, 0))
    return canvas, ImageDraw.Draw(canvas), factor


def finish_aa(canvas: Image.Image, size: int) -> Image.Image:
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def paste_center(sheet: Image.Image, frame: Image.Image, index: int, frame_size: int) -> None:
    sheet.alpha_composite(frame, (index * frame_size, 0))


def draw_glow_line(draw: ImageDraw.ImageDraw, points, color, width: int, glow: int = 3) -> None:
    r, g, b, a = color
    for step in range(glow, 0, -1):
        draw.line(points, fill=(r, g, b, int(a * 0.12)), width=width + step * 5, joint="curve")
    draw.line(points, fill=color, width=width, joint="curve")


def crop_visible(img: Image.Image, pad: int = 10) -> Image.Image:
    left, top, right, bottom = content_bbox(img)
    return img.crop((
        max(0, left - pad),
        max(0, top - pad),
        min(img.width, right + pad),
        min(img.height, bottom + pad),
    ))


def load_chroma_cutout(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    data = np.array(image)
    rgb = data[..., :3].astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    strongest_other = np.maximum(r, b)
    green_score = g - strongest_other
    green = (g > 54) & (green_score > 22) & (g > strongest_other * 1.12)
    data[green, 3] = 0

    edge = (data[..., 3] > 0) & (g > 44) & (green_score > 8) & (g > strongest_other * 1.06)
    edge_factor = np.clip((22 - green_score) / 14, 0.0, 1.0)
    data[..., 3] = np.where(edge, (data[..., 3].astype(np.float32) * edge_factor).astype(np.uint8), data[..., 3])

    visible = data[..., 3] > 0
    spill = visible & (g > strongest_other + 4)
    data[..., 1] = np.where(
        spill,
        np.minimum(data[..., 1], np.maximum(data[..., 0], data[..., 2]) + 4),
        data[..., 1],
    ).astype(np.uint8)
    # Fully cleared chroma pixels must not keep green RGB, otherwise later
    # rotate/resize passes can bleed green into newly opaque edge pixels.
    transparent = data[..., 3] == 0
    data[transparent, :3] = (0, 0, 0)
    return crop_visible(Image.fromarray(data), 18)


def rel_box(frame: Image.Image, box: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    w, h = frame.size
    return (
        int(w * box[0]),
        int(h * box[1]),
        int(w * box[2]),
        int(h * box[3]),
    )


def soften_alpha(frame: Image.Image, radius: float = 1.2) -> Image.Image:
    base = frame.convert("RGBA")
    alpha = base.getchannel("A").filter(ImageFilter.GaussianBlur(radius))
    base.putalpha(alpha)
    return base


def reduce_region_alpha(base: Image.Image, box: tuple[int, int, int, int], factor: float) -> Image.Image:
    data = np.array(base.convert("RGBA"))
    left, top, right, bottom = box
    data[top:bottom, left:right, 3] = (data[top:bottom, left:right, 3].astype(np.float32) * factor).astype(np.uint8)
    return Image.fromarray(data)


def overlay_region(
    canvas: Image.Image,
    source: Image.Image,
    box: tuple[int, int, int, int],
    *,
    offset: tuple[int, int] = (0, 0),
    rotate: float = 0.0,
    scale_x: float = 1.0,
    scale_y: float = 1.0,
) -> None:
    left, top, right, bottom = box
    part = soften_alpha(source.crop(box))
    part = transform(part, scale_x=scale_x, scale_y=scale_y, rotate=rotate)
    x = left + (right - left - part.width) // 2 + offset[0]
    y = top + (bottom - top - part.height) // 2 + offset[1]
    canvas.alpha_composite(part, (x, y))


def compose_segment_pose(
    source: Image.Image,
    regions: list[dict],
    *,
    body_scale_x: float = 1.0,
    body_scale_y: float = 1.0,
    body_rotate: float = 0.0,
    body_offset: tuple[int, int] = (0, 0),
) -> Image.Image:
    canvas = source.convert("RGBA")
    resolved = []
    for region in regions:
        box = rel_box(source, region["box"])
        resolved.append((region, box))
        canvas = reduce_region_alpha(canvas, box, region.get("fade", 0.28))
    for region, box in resolved:
        overlay_region(
            canvas,
            source,
            box,
            offset=region.get("offset", (0, 0)),
            rotate=region.get("rotate", 0.0),
            scale_x=region.get("scale_x", 1.0),
            scale_y=region.get("scale_y", 1.0),
        )

    posed = transform(canvas, scale_x=body_scale_x, scale_y=body_scale_y, rotate=body_rotate)
    out = Image.new("RGBA", (posed.width + 96, posed.height + 96), (0, 0, 0, 0))
    out.alpha_composite(posed, ((out.width - posed.width) // 2 + body_offset[0], (out.height - posed.height) // 2 + body_offset[1]))
    return crop_visible(out, 18)


def draw_energy_burst(
    frame: Image.Image,
    origin: tuple[float, float],
    *,
    color: tuple[int, int, int],
    progress: float,
    length: int,
) -> Image.Image:
    out = frame.copy()
    draw = ImageDraw.Draw(out, "RGBA")
    x = int(frame.width * origin[0])
    y = int(frame.height * origin[1])
    alpha = int(230 * max(0.08, 1.0 - progress * 0.58))
    for step in range(4):
        radius = int((10 + step * 7 + progress * 18))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), outline=(*color, max(18, alpha - step * 38)), width=max(2, 6 - step))
    draw.line((x, y, x - length, y + int(length * 0.32)), fill=(*color, alpha), width=7)
    draw.line((x + 3, y - 4, x - int(length * 0.72), y - int(length * 0.12)), fill=(255, 220, 128, int(alpha * 0.55)), width=3)
    return out


def add_sparks(frame: Image.Image, seed: int, color: tuple[int, int, int], count: int = 18) -> Image.Image:
    out = frame.copy()
    draw = ImageDraw.Draw(out, "RGBA")
    rng = np.random.default_rng(seed)
    alpha = np.array(frame.getchannel("A"))
    ys, xs = np.where(alpha > 40)
    if len(xs) == 0:
        return out
    for _ in range(count):
        idx = int(rng.integers(0, len(xs)))
        x, y = int(xs[idx]), int(ys[idx])
        dx = int(rng.uniform(-24, 25))
        dy = int(rng.uniform(-18, 19))
        draw.line((x, y, x + dx, y + dy), fill=(*color, int(rng.integers(92, 190))), width=int(rng.integers(1, 4)))
    return out


def build_source_walk_frames(source: Image.Image, kind: str, count: int) -> list[Image.Image]:
    frames = []
    for index in range(count):
        angle = index / count * np.pi * 2
        phase = np.sin(angle)
        sway = np.cos(angle)
        step = int(phase * source.height * 0.018)
        if kind == "tank":
            regions = [
                {"box": (0.00, 0.36, 0.46, 0.98), "offset": (int(-6 + phase * 9 + sway * 3), int(8 + step + sway * 2)), "rotate": -2.0 + phase * 2.2 + sway * 0.5, "fade": 0.36},
                {"box": (0.61, 0.30, 1.00, 0.80), "offset": (int(phase * -7 + sway * 2), int(-step * 0.6 - sway * 2)), "rotate": phase * -1.5 + sway * 0.4, "fade": 0.42},
                {"box": (0.26, 0.63, 0.55, 1.00), "offset": (int(phase * -5 + sway * 2), step), "fade": 0.46},
                {"box": (0.50, 0.61, 0.82, 1.00), "offset": (int(phase * 5 - sway * 2), -step), "fade": 0.46},
            ]
            frame = compose_segment_pose(source, regions, body_scale_y=1.0 - abs(phase) * 0.008, body_rotate=phase * 0.45 + sway * 0.12)
        else:
            regions = [
                {"box": (0.00, 0.34, 0.40, 0.78), "offset": (int(phase * -10 + sway * 4), int(5 + step + sway * 3)), "rotate": phase * 2.0 + sway * 0.7, "fade": 0.34},
                {"box": (0.60, 0.30, 1.00, 0.96), "offset": (int(phase * 10 - sway * 4), int(-2 - step - sway * 3)), "rotate": phase * -2.0 - sway * 0.7, "fade": 0.34},
                {"box": (0.26, 0.63, 0.53, 1.00), "offset": (int(phase * -5 + sway * 2), step), "fade": 0.46},
                {"box": (0.50, 0.63, 0.82, 1.00), "offset": (int(phase * 6 - sway * 2), -step), "fade": 0.46},
            ]
            frame = compose_segment_pose(source, regions, body_scale_y=1.0 + phase * 0.006, body_rotate=phase * 0.35 + sway * 0.18)
        frames.append(frame)
    return frames


def build_source_attack_frames(source: Image.Image, kind: str, count: int) -> list[Image.Image]:
    frames = []
    for index in range(count):
        progress = index / max(1, count - 1)
        strike = np.sin(progress * np.pi)
        if kind == "tank":
            regions = [
                {"box": (0.00, 0.36, 0.47, 1.00), "offset": (int(-34 * strike), int(26 * strike)), "rotate": -8.0 * strike, "scale_x": 1.06, "scale_y": 1.03, "fade": 0.18},
                {"box": (0.58, 0.28, 1.00, 0.80), "offset": (int(12 * strike), int(-10 * strike)), "rotate": 3.2 * strike, "fade": 0.42},
            ]
            frame = compose_segment_pose(source, regions, body_rotate=1.2 * strike, body_offset=(int(10 * strike), int(-3 * strike)))
            if progress > 0.30:
                frame = draw_energy_burst(frame, (0.14, 0.82), color=(255, 118, 32), progress=progress, length=58)
        else:
            regions = [
                {"box": (0.00, 0.33, 0.42, 0.82), "offset": (int(-30 * strike), int(20 * strike)), "rotate": -7.0 * strike, "scale_x": 1.05, "fade": 0.18},
                {"box": (0.59, 0.29, 1.00, 0.98), "offset": (int(32 * strike), int(24 * strike)), "rotate": 8.0 * strike, "scale_x": 1.06, "fade": 0.18},
            ]
            frame = compose_segment_pose(source, regions, body_scale_x=1.0 + strike * 0.018, body_scale_y=1.0 - strike * 0.012)
            frame = draw_energy_burst(frame, (0.50, 0.46), color=(255, 66, 28), progress=progress, length=0)
            if progress > 0.35:
                frame = add_sparks(frame, 5300 + index, (255, 86, 34), 12)
        frames.append(frame)
    return frames


def build_source_hit_frames(source: Image.Image, kind: str, count: int) -> list[Image.Image]:
    frames = []
    hit_color = (255, 76, 36) if kind == "boss" else (255, 138, 52)
    for index in range(count):
        recoil = (index + 1) / count
        frame = compose_segment_pose(
            source,
            [
                {"box": (0.00, 0.36, 0.45, 0.95), "offset": (int(-8 * recoil), int(6 * recoil)), "fade": 0.44},
                {"box": (0.60, 0.32, 1.00, 0.94), "offset": (int(7 * recoil), int(-5 * recoil)), "fade": 0.44},
            ],
            body_rotate=-1.4 * recoil,
            body_offset=(int(-9 * recoil), 0),
        )
        frame = tint(frame, hit_color, 0.14 + index * 0.08)
        frame = add_sparks(frame, 6100 + index + (50 if kind == "boss" else 0), hit_color, 14)
        frames.append(frame)
    return frames


def build_source_death_frames(source: Image.Image, kind: str, count: int) -> list[Image.Image]:
    regions = [
        (0.00, 0.22, 0.42, 0.82),
        (0.58, 0.22, 1.00, 0.96),
        (0.24, 0.02, 0.72, 0.50),
        (0.28, 0.42, 0.74, 0.86),
        (0.22, 0.66, 0.54, 1.00),
        (0.48, 0.66, 0.82, 1.00),
    ]
    frames = []
    for index in range(count):
        progress = index / max(1, count - 1)
        canvas = Image.new("RGBA", (source.width + 160, source.height + 180), (0, 0, 0, 0))
        rng = np.random.default_rng(7200 + index + (80 if kind == "boss" else 0))
        for ridx, region in enumerate(regions):
            box = rel_box(source, region)
            part = soften_alpha(source.crop(box), 1.0)
            part = fade(part, max(0.08, 1.0 - progress * 0.92))
            part = transform(
                part,
                scale_x=1.0 - progress * 0.10,
                scale_y=1.0 - progress * (0.18 if ridx >= 4 else 0.08),
                rotate=(ridx - 2.5) * progress * (5.0 if kind == "boss" else 3.0),
            )
            dx = int((ridx - 2.5) * progress * 18 + rng.uniform(-3, 4))
            dy = int(progress * (38 + ridx * 7) + rng.uniform(-2, 4))
            left, top, right, bottom = box
            canvas.alpha_composite(part, (80 + left + dx, 40 + top + dy))
        collapsed = crop_visible(canvas, 18)
        collapsed = add_sparks(collapsed, 7800 + index, (255, 82, 32) if kind == "boss" else (238, 128, 44), 10)
        frames.append(collapsed)
    return frames


def load_quality_enemy_sources() -> tuple[list[Image.Image], list[Image.Image], list[Image.Image], list[Image.Image]]:
    tank_source = color_grade_frame(
        load_chroma_cutout(IRON_TANK_QUALITY_SOURCE),
        tint_color=(88, 72, 52),
        tint_strength=0.05,
        brightness=1.08,
        contrast=1.08,
        saturation=0.94,
    )
    boss_source = color_grade_frame(
        load_chroma_cutout(BOSS_DEMON_QUALITY_SOURCE),
        tint_color=(98, 6, 8),
        tint_strength=0.04,
        brightness=1.04,
        contrast=1.05,
        saturation=0.96,
    )
    tank_walk = build_source_walk_frames(tank_source, "tank", 8)
    boss_idle = build_source_walk_frames(boss_source, "boss", 6)
    return tank_source, boss_source, tank_walk, boss_idle


def draw_poly(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], fill, outline=None, width: int = 1) -> None:
    draw.polygon([(int(x), int(y)) for x, y in points], fill=fill)
    if outline:
        draw.line([(int(x), int(y)) for x, y in points + [points[0]]], fill=outline, width=width, joint="curve")


def make_iron_tank_frame(index: int, count: int) -> Image.Image:
    size = 288
    canvas, draw, s = aa_canvas(size, 3)
    cx = size * s // 2
    phase = np.sin(index / count * np.pi * 2)
    step = phase * 7 * s

    shadow = (12, 10, 8, 255)
    metal_dark = (40, 34, 28, 255)
    metal_mid = (93, 78, 60, 255)
    metal_hi = (185, 154, 108, 245)
    ember = (210, 52, 32, 245)

    # Fully opaque armored mass. The silhouette is intentionally filled, not a cutout.
    draw.ellipse((cx - 70 * s, 42 * s, cx + 70 * s, 204 * s), fill=shadow)
    draw.rounded_rectangle((cx - 54 * s, 60 * s, cx + 54 * s, 170 * s), radius=18 * s, fill=metal_dark, outline=metal_mid, width=4 * s)
    draw.rounded_rectangle((cx - 38 * s, 82 * s, cx + 38 * s, 166 * s), radius=10 * s, fill=(58, 48, 38, 255), outline=metal_hi, width=2 * s)

    # Shoulders and helmet.
    draw.ellipse((cx - 92 * s, 66 * s, cx - 30 * s, 126 * s), fill=metal_dark, outline=metal_mid, width=4 * s)
    draw.ellipse((cx + 30 * s, 66 * s, cx + 92 * s, 126 * s), fill=metal_dark, outline=metal_mid, width=4 * s)
    draw.rounded_rectangle((cx - 35 * s, 28 * s, cx + 35 * s, 84 * s), radius=13 * s, fill=(34, 29, 25, 255), outline=metal_hi, width=3 * s)
    draw.polygon([(cx - 28 * s, 44 * s), (cx, 58 * s), (cx + 28 * s, 44 * s), (cx + 22 * s, 70 * s), (cx - 22 * s, 70 * s)], fill=(25, 20, 17, 255))
    draw.ellipse((cx - 17 * s, 55 * s, cx - 8 * s, 64 * s), fill=ember)
    draw.ellipse((cx + 8 * s, 55 * s, cx + 17 * s, 64 * s), fill=ember)

    # Legs.
    draw.rounded_rectangle((cx - 44 * s, 154 * s + step, cx - 12 * s, 228 * s + step), radius=10 * s, fill=metal_dark, outline=metal_mid, width=3 * s)
    draw.rounded_rectangle((cx + 12 * s, 154 * s - step, cx + 44 * s, 228 * s - step), radius=10 * s, fill=metal_dark, outline=metal_mid, width=3 * s)
    draw.rounded_rectangle((cx - 60 * s, 218 * s + step, cx - 8 * s, 244 * s + step), radius=8 * s, fill=(28, 24, 21, 255), outline=metal_mid, width=3 * s)
    draw.rounded_rectangle((cx + 8 * s, 218 * s - step, cx + 60 * s, 244 * s - step), radius=8 * s, fill=(28, 24, 21, 255), outline=metal_mid, width=3 * s)

    # Arms and hammer. Big, solid shapes read clearly at gameplay scale.
    left_arm = [(cx - 70 * s, 108 * s), (cx - 116 * s, 152 * s), (cx - 102 * s, 178 * s), (cx - 58 * s, 138 * s)]
    right_arm = [(cx + 70 * s, 108 * s), (cx + 118 * s, 150 * s), (cx + 104 * s, 178 * s), (cx + 58 * s, 138 * s)]
    draw_poly(draw, left_arm, metal_dark, metal_mid, 3 * s)
    draw_poly(draw, right_arm, metal_dark, metal_mid, 3 * s)
    draw.line((cx + 84 * s, 148 * s, cx + 136 * s, 206 * s), fill=(95, 72, 50, 255), width=9 * s)
    draw.rounded_rectangle((cx + 120 * s, 190 * s, cx + 176 * s, 232 * s), radius=8 * s, fill=(38, 33, 30, 255), outline=metal_hi, width=3 * s)

    # Plate highlights.
    for off in (-24, 0, 24):
        draw.line((cx + off * s, 90 * s, cx + off * s, 158 * s), fill=metal_hi, width=2 * s)
    draw.arc((cx - 48 * s, 66 * s, cx + 48 * s, 150 * s), 205, 335, fill=(220, 180, 112, 155), width=2 * s)

    return crop_visible(finish_aa(canvas, size), 8)


def make_boss_demon_frame(index: int, count: int) -> Image.Image:
    size = 420
    canvas, draw, s = aa_canvas(size, 3)
    cx = size * s // 2
    phase = np.sin(index / count * np.pi * 2)
    breathe = phase * 5 * s

    shadow = (24, 2, 5, 255)
    red_dark = (70, 5, 10, 255)
    red_mid = (130, 20, 20, 255)
    bone = (196, 142, 98, 245)
    flame = (255, 63, 28, 245)

    # Cloak and body are solid opaque shapes, deliberately avoiding internal transparent holes.
    draw_poly(draw, [
        (cx - 104 * s, 92 * s), (cx - 150 * s, 170 * s), (cx - 134 * s, 300 * s),
        (cx - 66 * s, 356 * s), (cx, 334 * s), (cx + 66 * s, 356 * s),
        (cx + 134 * s, 300 * s), (cx + 150 * s, 170 * s), (cx + 104 * s, 92 * s),
    ], shadow, None)
    draw.ellipse((cx - 72 * s, 80 * s, cx + 72 * s, 246 * s), fill=red_dark, outline=red_mid, width=5 * s)
    draw_poly(draw, [
        (cx - 54 * s, 120 * s), (cx - 82 * s, 260 * s), (cx, 324 * s),
        (cx + 82 * s, 260 * s), (cx + 54 * s, 120 * s),
    ], (90, 5, 12, 255), (168, 28, 24, 235), 3 * s)

    # Head, horns, shoulders.
    draw.ellipse((cx - 48 * s, 38 * s, cx + 48 * s, 112 * s), fill=(50, 6, 8, 255), outline=bone, width=3 * s)
    draw_poly(draw, [(cx - 34 * s, 54 * s), (cx - 92 * s, 4 * s), (cx - 56 * s, 70 * s)], bone, (72, 38, 28, 255), 2 * s)
    draw_poly(draw, [(cx + 34 * s, 54 * s), (cx + 92 * s, 4 * s), (cx + 56 * s, 70 * s)], bone, (72, 38, 28, 255), 2 * s)
    draw.ellipse((cx - 116 * s, 82 * s, cx - 32 * s, 156 * s), fill=(62, 8, 10, 255), outline=bone, width=4 * s)
    draw.ellipse((cx + 32 * s, 82 * s, cx + 116 * s, 156 * s), fill=(62, 8, 10, 255), outline=bone, width=4 * s)

    # Arms and claws.
    draw_poly(draw, [(cx - 104 * s, 142 * s), (cx - 174 * s, 214 * s), (cx - 154 * s, 252 * s), (cx - 82 * s, 190 * s)], red_dark, red_mid, 4 * s)
    draw_poly(draw, [(cx + 104 * s, 142 * s), (cx + 174 * s, 214 * s), (cx + 154 * s, 252 * s), (cx + 82 * s, 190 * s)], red_dark, red_mid, 4 * s)
    for side in (-1, 1):
        hand_x = cx + side * 164 * s
        hand_y = 240 * s
        for claw in range(3):
            draw.line((hand_x, hand_y, hand_x + side * (18 + claw * 6) * s, hand_y + (claw - 1) * 10 * s), fill=bone, width=3 * s)

    # Legs and feet.
    draw.rounded_rectangle((cx - 62 * s, 276 * s + breathe, cx - 18 * s, 366 * s + breathe), radius=12 * s, fill=red_dark, outline=red_mid, width=3 * s)
    draw.rounded_rectangle((cx + 18 * s, 276 * s - breathe, cx + 62 * s, 366 * s - breathe), radius=12 * s, fill=red_dark, outline=red_mid, width=3 * s)
    draw.polygon([(cx - 64 * s, 358 * s + breathe), (cx - 12 * s, 358 * s + breathe), (cx - 42 * s, 394 * s + breathe)], fill=(35, 4, 5, 255), outline=red_mid)
    draw.polygon([(cx + 64 * s, 358 * s - breathe), (cx + 12 * s, 358 * s - breathe), (cx + 42 * s, 394 * s - breathe)], fill=(35, 4, 5, 255), outline=red_mid)

    # Chest flame and armor lines.
    draw_glow_line(draw, [(cx, 104 * s), (cx, 240 * s)], (*flame[:3], 220), 4 * s, 3)
    draw.polygon([(cx, 136 * s), (cx - 18 * s, 178 * s), (cx, 210 * s), (cx + 18 * s, 178 * s)], fill=(255, 78, 24, 220))
    draw.line((cx - 44 * s, 128 * s, cx + 44 * s, 128 * s), fill=bone, width=2 * s)
    draw.line((cx - 34 * s, 166 * s, cx + 34 * s, 166 * s), fill=(228, 92, 42, 180), width=2 * s)
    draw.ellipse((cx - 13 * s, 70 * s, cx - 4 * s, 79 * s), fill=flame)
    draw.ellipse((cx + 4 * s, 70 * s, cx + 13 * s, 79 * s), fill=flame)

    return crop_visible(finish_aa(canvas, size), 8)


def make_iron_tank_frames(count: int) -> list[Image.Image]:
    return [make_iron_tank_frame(index, count) for index in range(count)]


def make_boss_demon_frames(count: int) -> list[Image.Image]:
    return [make_boss_demon_frame(index, count) for index in range(count)]


def composite_detail_on_base(base: Image.Image, detail: Image.Image, detail_strength: float = 0.92) -> Image.Image:
    base = base.convert("RGBA")
    detail = solidify_alpha(polish_frame(detail.convert("RGBA")))

    scale = min(base.width * 0.96 / detail.width, base.height * 0.96 / detail.height)
    detail = detail.resize((max(1, int(detail.width * scale)), max(1, int(detail.height * scale))), Image.Resampling.LANCZOS)
    detail_data = np.array(detail)
    detail_data[..., 3] = (detail_data[..., 3].astype(np.float32) * detail_strength).clip(0, 255).astype(np.uint8)
    detail = Image.fromarray(detail_data)

    canvas = Image.new("RGBA", base.size, (0, 0, 0, 0))
    canvas.alpha_composite(base, (0, 0))
    x = (base.width - detail.width) // 2
    y = base.height - detail.height
    canvas.alpha_composite(detail, (x, y))
    return crop_visible(canvas, 8)


def hybridize_frames(base_frames: list[Image.Image], detail_frames: list[Image.Image]) -> list[Image.Image]:
    return [
        composite_detail_on_base(base, detail_frames[index % len(detail_frames)])
        for index, base in enumerate(base_frames)
    ]


def make_talisman_card(
    frame_size: int,
    angle: float,
    palette: tuple[tuple[int, int, int], tuple[int, int, int]],
    phase: float = 0.0,
) -> Image.Image:
    canvas, draw, s = aa_canvas(frame_size)
    cx = cy = frame_size * s // 2

    # Layered comet ribbon: readable motion without becoming a circular glow blob.
    for offset, alpha, width in ((78, 34, 3), (54, 64, 3), (30, 108, 2)):
        curve = int(np.sin(phase * np.pi * 2 + offset * 0.03) * 8 * s)
        draw_glow_line(
            draw,
            [(cx - offset * s, cy + curve), (cx - 36 * s, cy - curve // 2), (cx - 12 * s, cy)],
            (palette[1][0], palette[1][1], palette[1][2], alpha),
            width * s,
            2,
        )

    card = Image.new("RGBA", (46 * s, 82 * s), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle((6 * s, 5 * s, 40 * s, 77 * s), radius=5 * s, fill=(222, 215, 196, 230))
    cd.rounded_rectangle((6 * s, 5 * s, 40 * s, 77 * s), radius=5 * s, outline=(*palette[1], 238), width=2 * s)
    cd.rectangle((10 * s, 11 * s, 36 * s, 71 * s), outline=(54, 43, 34, 92), width=s)
    cd.line((23 * s, 17 * s, 23 * s, 66 * s), fill=(*palette[0], 226), width=2 * s)
    cd.line((15 * s, 33 * s, 31 * s, 33 * s), fill=(*palette[0], 218), width=2 * s)
    cd.line((17 * s, 49 * s, 29 * s, 49 * s), fill=(*palette[1], 196), width=2 * s)
    cd.arc((12 * s, 20 * s, 34 * s, 56 * s), 232, 492, fill=(*palette[0], 158), width=2 * s)
    cd.polygon([(23 * s, 61 * s), (28 * s, 69 * s), (18 * s, 69 * s)], fill=(*palette[1], 204))
    rotated = card.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    canvas.alpha_composite(rotated, (cx - rotated.width // 2, cy - rotated.height // 2))
    return finish_aa(canvas, frame_size)


def make_impact_frame(frame_size: int, progress: float, palette: tuple[tuple[int, int, int], tuple[int, int, int]]) -> Image.Image:
    canvas, draw, s = aa_canvas(frame_size)
    cx = cy = frame_size * s // 2
    radius = int((11 + progress * 46) * s)
    alpha = int(185 * (1 - progress))
    core, accent = palette

    # Broken seal ring plus short fracture strokes. The center stays open so the
    # effect reads as a hit spark, not a flat disk or UI icon.
    for segment in range(10):
        start = segment * 36 + progress * 34
        end = start + 14
        draw.arc(
            (cx - radius, cy - radius, cx + radius, cy + radius),
            start,
            end,
            fill=(*accent, max(18, int(alpha * 0.72))),
            width=max(1 * s, int((3.2 - progress * 1.2) * s)),
        )

    ray_len = int((22 + progress * 42) * s)
    for angle in (0, 45, 90, 135):
        rad = np.deg2rad(angle)
        dx = int(np.cos(rad) * ray_len)
        dy = int(np.sin(rad) * ray_len)
        inner = int(7 * s)
        draw_glow_line(
            draw,
            [
                (cx + int(np.cos(rad) * inner), cy + int(np.sin(rad) * inner)),
                (cx + dx, cy + dy),
            ],
            (*core, max(18, int(alpha * 0.78))),
            max(1 * s, int(1.5 * s)),
            1,
        )
        draw_glow_line(
            draw,
            [
                (cx - int(np.cos(rad) * inner), cy - int(np.sin(rad) * inner)),
                (cx - dx, cy - dy),
            ],
            (*core, max(18, int(alpha * 0.78))),
            max(1 * s, int(1.5 * s)),
            1,
        )

    rng = np.random.default_rng(int(progress * 1000) + palette[0][0])
    for _ in range(18):
        spark_angle = rng.uniform(0, np.pi * 2)
        spark_dist = rng.uniform(18, 64) * (0.65 + progress * 0.5) * s
        x = cx + int(np.cos(spark_angle) * spark_dist)
        y = cy + int(np.sin(spark_angle) * spark_dist)
        length = int(rng.uniform(3, 8) * s)
        dx = int(np.cos(spark_angle) * length)
        dy = int(np.sin(spark_angle) * length)
        draw.line((x, y, x + dx, y + dy), fill=(*accent, max(18, int(alpha * 0.55))), width=max(1, s))

    inner = int((6 + progress * 8) * s)
    draw.ellipse((cx - inner, cy - inner, cx + inner, cy + inner), outline=(*core, max(24, int(alpha * 0.72))), width=max(1, s))
    return finish_aa(canvas.filter(ImageFilter.GaussianBlur(0.15 * s)), frame_size)


def make_shard_impact_frame(frame_size: int, progress: float, palette: tuple[tuple[int, int, int], tuple[int, int, int]]) -> Image.Image:
    canvas, draw, s = aa_canvas(frame_size)
    cx = cy = frame_size * s // 2
    core, accent = palette
    alpha = int(245 * (1 - progress * 0.92))
    rng = np.random.default_rng(900 + int(progress * 1000) + accent[0])

    if progress < 0.18:
        flash = 1 - progress / 0.18
        draw_glow_line(draw, [(cx - 58 * s, cy - 4 * s), (cx + 62 * s, cy + 6 * s)], (*core, int(168 * flash)), 3 * s, 2)
        draw_glow_line(draw, [(cx - 9 * s, cy - 48 * s), (cx + 12 * s, cy + 50 * s)], (*accent, int(104 * flash)), 2 * s, 1)

    # Broad slash ribbons give a commercial hit-read without drawing a disk.
    for slash in range(3):
        base = -38 + slash * 31 + progress * 18
        rad = np.deg2rad(base)
        length = int((38 + progress * 72 + slash * 8) * s)
        side = int((4.2 - progress * 2.4) * s)
        ox = int(np.cos(rad + np.pi / 2) * side)
        oy = int(np.sin(rad + np.pi / 2) * side)
        x1 = cx - int(np.cos(rad) * length)
        y1 = cy - int(np.sin(rad) * length)
        x2 = cx + int(np.cos(rad) * length)
        y2 = cy + int(np.sin(rad) * length)
        draw.line((x1, y1, x2, y2), fill=(*core, max(16, int(alpha * 0.56))), width=max(1, int((1.8 - progress * 0.45) * s)))

    # Impact is paper/sigil debris, not a circle. This prevents the old coin/disk read.
    for shard in range(30):
        angle = rng.uniform(0, np.pi * 2)
        dist = rng.uniform(8, 82) * (0.45 + progress * 0.95) * s
        x = cx + int(np.cos(angle) * dist)
        y = cy + int(np.sin(angle) * dist)
        length = rng.uniform(5, 22) * (1 - progress * 0.25) * s
        width = rng.uniform(0.9, 2.7) * s
        dx = np.cos(angle) * length
        dy = np.sin(angle) * length
        nx = -np.sin(angle) * width
        ny = np.cos(angle) * width
        color = accent if shard % 3 else core
        draw.polygon(
            [
                (x - dx * 0.35 + nx, y - dy * 0.35 + ny),
                (x + dx, y + dy),
                (x - dx * 0.35 - nx, y - dy * 0.35 - ny),
            ],
            fill=(*color, max(16, int(alpha * rng.uniform(0.35, 0.88)))),
        )

    for angle in (-72, -38, -12, 18, 47, 76):
        rad = np.deg2rad(angle + progress * 12)
        inner = int((5 + progress * 4) * s)
        outer = int((42 + progress * 54) * s)
        draw_glow_line(
            draw,
            [
                (cx + int(np.cos(rad) * inner), cy + int(np.sin(rad) * inner)),
                (cx + int(np.cos(rad) * outer), cy + int(np.sin(rad) * outer)),
            ],
            (*core, max(16, int(alpha * 0.62))),
            max(1, int(1.5 * s)),
            1,
        )

    if progress < 0.72:
        sigil = int((13 + progress * 13) * s)
        draw.line((cx - sigil, cy, cx + sigil, cy), fill=(*accent, max(22, int(alpha * 0.52))), width=max(1, s))
        draw.line((cx, cy - sigil, cx, cy + sigil), fill=(*accent, max(22, int(alpha * 0.52))), width=max(1, s))
        draw.line((cx - sigil // 2, cy - sigil // 2, cx + sigil // 2, cy + sigil // 2), fill=(64, 36, 22, max(16, int(alpha * 0.36))), width=max(1, s))

    return finish_aa(canvas.filter(ImageFilter.GaussianBlur(0.045 * s)), frame_size)


def make_fireball_frame(frame_size: int, progress: float, level_scale: float) -> Image.Image:
    canvas, draw, s = aa_canvas(frame_size)
    cx = cy = frame_size * s // 2
    radius = int((22 + progress * 72) * level_scale * s)
    alpha = int(235 * (1 - progress * 0.78))

    for ring, color in enumerate(((255, 48, 18), (255, 140, 42), (255, 225, 132))):
        r = max(2 * s, radius - ring * 15 * s)
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(*color, max(20, alpha - ring * 45)), width=max(2 * s, int((8 - ring * 2) * s)))

    for spoke in range(12):
        rad = np.deg2rad(spoke * 30 + progress * 40)
        inner = int(radius * 0.25)
        outer = int(radius * (0.86 + 0.08 * np.sin(spoke)))
        draw.line(
            (
                cx + int(np.cos(rad) * inner),
                cy + int(np.sin(rad) * inner),
                cx + int(np.cos(rad) * outer),
                cy + int(np.sin(rad) * outer),
            ),
            fill=(255, 96, 26, max(18, int(alpha * 0.72))),
            width=max(1 * s, int(3 * s * (1 - progress * 0.45))),
        )

    core = int(max(4, (18 - progress * 10) * level_scale) * s)
    draw.ellipse((cx - core, cy - core, cx + core, cy + core), fill=(255, 238, 172, max(20, int(alpha * 0.7))))
    return finish_aa(canvas.filter(ImageFilter.GaussianBlur(0.18 * s)), frame_size)


def make_shield_frame(frame_size: int, phase: float, level_scale: float) -> Image.Image:
    canvas, draw, s = aa_canvas(frame_size)
    cx = cy = frame_size * s // 2
    radius = int(118 * level_scale * s)
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=(226, 184, 96, 210), width=5 * s)
    draw.ellipse((cx - int(radius * 0.72), cy - int(radius * 0.72), cx + int(radius * 0.72), cy + int(radius * 0.72)), outline=(236, 230, 214, 86), width=2 * s)
    for mark in range(8):
        rad = np.deg2rad(mark * 45 + phase)
        x = cx + int(np.cos(rad) * radius)
        y = cy + int(np.sin(rad) * radius)
        draw.line((x, y, cx + int(np.cos(rad) * (radius - 18 * s)), cy + int(np.sin(rad) * (radius - 18 * s))), fill=(255, 239, 190, 185), width=2 * s)
    return finish_aa(canvas, frame_size)


def color_grade_frame(
    frame: Image.Image,
    *,
    tint_color: tuple[int, int, int],
    tint_strength: float,
    brightness: float = 1.0,
    contrast: float = 1.0,
    saturation: float = 1.0,
    alpha_scale: float = 1.0,
) -> Image.Image:
    base = frame.convert("RGBA")
    alpha = base.getchannel("A")
    rgb = base.convert("RGB")
    rgb = ImageEnhance.Color(rgb).enhance(saturation)
    rgb = ImageEnhance.Brightness(rgb).enhance(brightness)
    rgb = ImageEnhance.Contrast(rgb).enhance(contrast)
    graded = Image.merge("RGBA", (*rgb.split(), alpha))
    if tint_strength > 0:
        graded = tint(graded, tint_color, tint_strength)
    if alpha_scale != 1.0:
        data = np.array(graded)
        data[..., 3] = np.clip(data[..., 3].astype(np.float32) * alpha_scale, 0, 255).astype(np.uint8)
        graded = Image.fromarray(data)
    return graded


def add_variant_marks(
    frame: Image.Image,
    *,
    color: tuple[int, int, int],
    seed: int,
    mark_count: int,
    alpha: int,
) -> Image.Image:
    base = frame.convert("RGBA")
    bbox = content_bbox(base)
    out = base.copy()
    draw = ImageDraw.Draw(out)
    rng = np.random.default_rng(seed)
    left, top, right, bottom = bbox
    width = max(1, right - left)
    height = max(1, bottom - top)
    for _ in range(mark_count):
        x = int(rng.uniform(left + width * 0.28, right - width * 0.28))
        y = int(rng.uniform(top + height * 0.20, bottom - height * 0.22))
        line = int(rng.uniform(width * 0.10, width * 0.22))
        draw.line((x - line // 2, y, x + line // 2, y + int(rng.uniform(-5, 6))), fill=(*color, alpha), width=max(1, width // 38))
    return out


def build_normal_enemy_walks(
    skeleton: list[Image.Image],
    ghost: list[Image.Image],
    tank: list[Image.Image],
    boss: list[Image.Image],
) -> dict[str, list[Image.Image]]:
    specs = {
        "ghoul": {
            "source": skeleton,
            "tint": (78, 120, 70),
            "strength": 0.22,
            "brightness": 0.82,
            "contrast": 0.98,
            "saturation": 0.78,
            "scale_x": 1.10,
            "scale_y": 0.98,
            "mark": (112, 148, 96),
        },
        "cultist": {
            "source": skeleton,
            "tint": (92, 48, 116),
            "strength": 0.30,
            "brightness": 0.74,
            "contrast": 1.02,
            "saturation": 0.70,
            "scale_x": 0.94,
            "scale_y": 1.08,
            "mark": (154, 122, 174),
        },
        "imp": {
            "source": skeleton,
            "tint": (132, 46, 36),
            "strength": 0.24,
            "brightness": 0.86,
            "contrast": 1.02,
            "saturation": 0.78,
            "scale_x": 0.84,
            "scale_y": 0.82,
            "mark": (190, 82, 58),
        },
        "wraith": {
            "source": ghost,
            "tint": (88, 82, 148),
            "strength": 0.28,
            "brightness": 0.70,
            "contrast": 0.92,
            "saturation": 0.72,
            "scale_x": 1.00,
            "scale_y": 1.12,
            "alpha": 0.92,
            "mark": (142, 134, 190),
        },
        "brute": {
            "source": tank,
            "tint": (118, 100, 82),
            "strength": 0.20,
            "brightness": 0.86,
            "contrast": 1.06,
            "saturation": 0.74,
            "scale_x": 1.18,
            "scale_y": 1.05,
            "mark": (156, 134, 106),
        },
    }
    walks: dict[str, list[Image.Image]] = {}
    for name, spec in specs.items():
        frames = []
        source = cycle(spec["source"], 8)
        for index, frame in enumerate(source):
            phase = np.sin(index / 8 * np.pi * 2)
            graded = color_grade_frame(
                frame,
                tint_color=spec["tint"],
                tint_strength=spec["strength"],
                brightness=spec["brightness"],
                contrast=spec["contrast"],
                saturation=spec["saturation"],
                alpha_scale=spec.get("alpha", 1.0),
            )
            moved = transform(
                graded,
                scale_x=spec["scale_x"] * (1.0 + phase * 0.015),
                scale_y=spec["scale_y"] * (1.0 - phase * 0.010),
                rotate=phase * (1.8 if name != "brute" else 0.8),
            )
            frames.append(add_variant_marks(moved, color=spec["mark"], seed=1000 + index + len(name) * 17, mark_count=3, alpha=78))
        walks[name] = frames
    return walks


def build_boss_variant_idles(boss: list[Image.Image]) -> dict[str, list[Image.Image]]:
    specs = {
        "boss_frost": ((82, 178, 190), 0.32, 0.82, 0.95, 0.68, (138, 218, 224)),
        "boss_plague": ((96, 132, 62), 0.34, 0.76, 0.92, 0.72, (154, 178, 88)),
        "boss_void": ((70, 54, 126), 0.38, 0.66, 1.00, 0.76, (138, 104, 190)),
    }
    variants: dict[str, list[Image.Image]] = {}
    for name, (color, strength, brightness, contrast, saturation, mark_color) in specs.items():
        frames = []
        for index, frame in enumerate(cycle(boss, 6)):
            phase = np.sin(index / 6 * np.pi * 2)
            graded = color_grade_frame(
                frame,
                tint_color=color,
                tint_strength=strength,
                brightness=brightness + phase * 0.018,
                contrast=contrast,
                saturation=saturation,
            )
            moved = transform(graded, scale_x=1.0 + phase * 0.012, scale_y=1.0 - phase * 0.010, rotate=phase * 0.8)
            frames.append(add_variant_marks(moved, color=mark_color, seed=2200 + index + len(name) * 31, mark_count=5, alpha=96))
        variants[name] = frames
    return variants


def make_art_dungeon_map_pair(index: int, size: int = 1024) -> tuple[Image.Image, Image.Image]:
    atlas = Image.open(MAP_SPRINT_SOURCE).convert("RGB")
    columns = 4
    rows = 2
    if index < 0 or index >= columns * rows:
        raise ValueError(f"map index out of atlas range: {index}")

    cell_w = atlas.width // columns
    cell_h = atlas.height // rows
    col = index % columns
    row = index // columns
    margin_x = max(2, int(cell_w * 0.012))
    margin_y = max(2, int(cell_h * 0.012))
    cell = atlas.crop((
        col * cell_w + margin_x,
        row * cell_h + margin_y,
        (col + 1) * cell_w - margin_x,
        (row + 1) * cell_h - margin_y,
    ))
    base = ImageOps.fit(cell, (size, size), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5)).convert("RGBA")
    base = ImageEnhance.Brightness(base).enhance(1.14)
    base = ImageEnhance.Contrast(base).enhance(1.08)
    base = ImageEnhance.Color(base).enhance(1.06)

    gray = base.convert("L")
    edges = gray.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(0.35))
    edge_np = np.array(edges)
    alpha = np.clip((edge_np.astype(np.float32) - 24) * 1.25, 0, 42).astype(np.uint8)
    overlay_np = np.zeros((size, size, 4), dtype=np.uint8)
    overlay_np[..., 0] = 190
    overlay_np[..., 1] = 188
    overlay_np[..., 2] = 176
    overlay_np[..., 3] = alpha
    overlay = Image.fromarray(overlay_np, "RGBA")
    return base, overlay


def make_dungeon_map_pair(index: int, size: int = 1024) -> tuple[Image.Image, Image.Image]:
    if MAP_SPRINT_SOURCE.exists():
        return make_art_dungeon_map_pair(index, size)

    rng = np.random.default_rng(5000 + index * 97)
    palettes = [
        ((42, 45, 40), (68, 73, 62)),
        ((38, 45, 54), (61, 72, 84)),
        ((47, 39, 55), (74, 61, 86)),
        ((38, 51, 45), (62, 82, 70)),
        ((52, 45, 38), (86, 70, 56)),
        ((35, 50, 58), (58, 78, 88)),
        ((50, 38, 54), (82, 58, 86)),
        ((40, 52, 42), (67, 84, 62)),
    ]
    low, high = palettes[index % len(palettes)]
    coarse = rng.normal(0, 1, (64, 64))
    coarse = (coarse - coarse.min()) / (coarse.max() - coarse.min())
    noise = Image.fromarray((coarse * 255).astype(np.uint8)).resize((size, size), Image.Resampling.BICUBIC)
    noise_np = np.array(noise).astype(np.float32) / 255.0

    base_np = np.zeros((size, size, 3), dtype=np.uint8)
    for channel in range(3):
        value = low[channel] + (high[channel] - low[channel]) * noise_np
        base_np[..., channel] = np.clip(value, 0, 255).astype(np.uint8)
    base = Image.fromarray(base_np)
    base = ImageEnhance.Color(base).enhance(0.68)
    base = ImageEnhance.Contrast(base).enhance(0.96)
    base = ImageEnhance.Brightness(base).enhance(1.08)

    draw = ImageDraw.Draw(base, "RGBA")
    tile = 128
    for x in range(0, size + tile, tile):
        jitter = int(rng.integers(-8, 9))
        draw.line((x + jitter, 0, x + jitter, size), fill=(118, 118, 108, 34), width=2)
    for y in range(0, size + tile, tile):
        jitter = int(rng.integers(-8, 9))
        draw.line((0, y + jitter, size, y + jitter), fill=(14, 15, 14, 44), width=2)

    landmark_colors = [
        (114, 128, 98),
        (86, 118, 134),
        (116, 86, 136),
        (78, 126, 92),
        (132, 104, 74),
        (72, 118, 136),
        (132, 78, 130),
        (94, 126, 78),
    ]
    accent = landmark_colors[index % len(landmark_colors)]
    for _ in range(5):
        cx = int(rng.integers(80, size - 80))
        cy = int(rng.integers(80, size - 80))
        rw = int(rng.integers(60, 150))
        rh = int(rng.integers(18, 44))
        rot = rng.uniform(-0.8, 0.8)
        pts = []
        for px, py in [(-rw, -rh), (rw, -rh), (rw, rh), (-rw, rh)]:
            x = cx + int(np.cos(rot) * px - np.sin(rot) * py)
            y = cy + int(np.sin(rot) * px + np.cos(rot) * py)
            pts.append((x, y))
        draw.polygon(pts, fill=(*accent, 26))
        draw.line(pts + [pts[0]], fill=(*accent, 44), width=2)

    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay, "RGBA")
    for _ in range(22):
        x = int(rng.integers(40, size - 40))
        y = int(rng.integers(40, size - 40))
        length = int(rng.integers(70, 210))
        angle = rng.uniform(0, np.pi * 2)
        points = []
        for step in range(5):
            d = length * step / 4
            px = x + int(np.cos(angle) * d + rng.normal(0, 9))
            py = y + int(np.sin(angle) * d + rng.normal(0, 9))
            points.append((px, py))
        od.line(points, fill=(*accent, int(rng.integers(40, 72))), width=int(rng.integers(1, 3)), joint="curve")
    for _ in range(36):
        x = int(rng.integers(0, size))
        y = int(rng.integers(0, size))
        r = int(rng.integers(2, 8))
        shade = int(rng.integers(66, 96))
        od.ellipse((x - r, y - r, x + r, y + r), fill=(shade, shade + 2, shade, int(rng.integers(24, 44))))

    overlay = overlay.filter(ImageFilter.GaussianBlur(0.35))
    return base, overlay


def rebuild_dungeon_maps() -> list[Path]:
    DUNGEON.mkdir(parents=True, exist_ok=True)
    outputs: list[Path] = []
    for index in range(8):
        base, overlay = make_dungeon_map_pair(index)
        base_out = DUNGEON / f"map_base_{index}.png"
        overlay_out = DUNGEON / f"map_overlay_{index}.png"
        base.save(base_out)
        overlay.save(overlay_out)
        outputs.extend([base_out, overlay_out])
    return outputs


def rebuild_vfx_assets() -> list[Path]:
    VFX.mkdir(parents=True, exist_ok=True)
    outputs: list[Path] = []
    palettes = {
        "a": ((238, 232, 216), (202, 158, 74)),
        "b": ((196, 246, 255), (46, 188, 210)),
        "c": ((224, 216, 238), (130, 58, 214)),
        "d": ((255, 226, 226), (154, 24, 32)),
    }

    talisman_size = 256
    projectile_frames = 8
    impact_frames = 10

    for variant, palette in palettes.items():
        proj = Image.new("RGBA", (talisman_size * projectile_frames, talisman_size), (0, 0, 0, 0))
        for index in range(projectile_frames):
            phase = index / projectile_frames
            angle = -24 + index * 13
            paste_center(proj, make_talisman_card(talisman_size, angle, palette, phase), index, talisman_size)
        out = VFX / f"talisman_projectile_variant_{variant}_sheet.png"
        proj.save(out)
        outputs.append(out)

        imp = Image.new("RGBA", (talisman_size * impact_frames, talisman_size), (0, 0, 0, 0))
        for index in range(impact_frames):
            paste_center(imp, make_shard_impact_frame(talisman_size, index / (impact_frames - 1), palette), index, talisman_size)
        out = VFX / f"talisman_impact_variant_{variant}_sheet.png"
        imp.save(out)
        outputs.append(out)

    for name, scale in (("unlock", 1.0), ("lv2", 1.15), ("lv3", 1.32), ("lv4_ultimate", 1.55)):
        sheet = Image.new("RGBA", (384 * 4, 384), (0, 0, 0, 0))
        for index in range(4):
            paste_center(sheet, make_fireball_frame(384, index / 3, scale), index, 384)
        out = VFX / f"fireball_{name}_sheet.png"
        sheet.save(out)
        outputs.append(out)

    for name, scale in (("unlock_loop", 0.72), ("lv2_loop", 0.82), ("lv3_loop", 0.92), ("lv4_loop", 1.02)):
        sheet = Image.new("RGBA", (384 * 4, 384), (0, 0, 0, 0))
        for index in range(4):
            paste_center(sheet, make_shield_frame(384, index * 22.5, scale), index, 384)
        out = VFX / f"shield_{name}_sheet.png"
        sheet.save(out)
        outputs.append(out)

    trail = Image.new("RGBA", (192 * 4, 192), (0, 0, 0, 0))
    for index in range(4):
        canvas, draw, s = aa_canvas(192)
        points = []
        for x in range(22, 170, 4):
            y = 96 + int(np.sin(x * 0.10 + index * 0.8) * 13)
            points.append((x * s, y * s))
        draw_glow_line(draw, points, (112, 238, 255, 170), 2 * s, 2)
        paste_center(trail, finish_aa(canvas, 192), index, 192)
    out = VFX / "magnet_pickup_trail_sheet.png"
    trail.save(out)
    outputs.append(out)

    level = Image.new("RGBA", (384 * 4, 384), (0, 0, 0, 0))
    for index in range(4):
        canvas, draw, s = aa_canvas(384)
        alpha = 210 - index * 38
        draw_glow_line(draw, [(192 * s, 34 * s), (192 * s, 350 * s)], (255, 236, 172, alpha), 5 * s, 5)
        for arm in range(4):
            rad = np.deg2rad(arm * 90 + index * 18)
            draw.line((192 * s, 192 * s, 192 * s + int(np.cos(rad) * 112 * s), 192 * s + int(np.sin(rad) * 112 * s)), fill=(226, 184, 96, int(alpha * 0.7)), width=3 * s)
        paste_center(level, finish_aa(canvas, 384), index, 384)
    out = VFX / "level_up_burst_sheet.png"
    level.save(out)
    outputs.append(out)

    return outputs


def sheet_frame(path: Path, index: int, frame_w: int, frame_h: int) -> Image.Image:
    sheet = Image.open(path).convert("RGBA")
    max_index = max(0, sheet.width // frame_w - 1)
    index = min(index, max_index)
    return sheet.crop((index * frame_w, 0, index * frame_w + frame_w, frame_h))


def dark_cell(frame: Image.Image, size: tuple[int, int], label: str = "") -> Image.Image:
    cell = Image.new("RGBA", size, (18, 18, 18, 255))
    preview = frame.copy()
    bg = Image.new("RGBA", preview.size, (30, 30, 30, 255))
    bg.alpha_composite(preview)
    bg.thumbnail((size[0] - 24, size[1] - 34), Image.Resampling.LANCZOS)
    cell.alpha_composite(bg, ((size[0] - bg.width) // 2, 8))
    if label:
        draw = ImageDraw.Draw(cell)
        draw.text((10, size[1] - 20), label, fill=(184, 184, 176, 255))
    return cell


def save_contact(paths: list[tuple[str, Path, int, int]], out_path: Path, cols: int = 2) -> None:
    cell_size = (360, 170)
    rows = (len(paths) + cols - 1) // cols
    contact = Image.new("RGBA", (cols * cell_size[0], rows * cell_size[1]), (10, 10, 10, 255))
    for index, (label, path, frame_w, frame_h) in enumerate(paths):
        sheet = Image.open(path).convert("RGBA")
        frames = max(1, sheet.width // frame_w)
        strip = Image.new("RGBA", (frame_w * min(frames, 6), frame_h), (0, 0, 0, 0))
        for frame_index in range(min(frames, 6)):
            strip.alpha_composite(sheet_frame(path, frame_index, frame_w, frame_h), (frame_index * frame_w, 0))
        cell = dark_cell(strip, cell_size, label)
        contact.alpha_composite(cell, ((index % cols) * cell_size[0], (index // cols) * cell_size[1]))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    contact.save(out_path)


def save_frame_diff(path: Path, out_path: Path, frame_w: int, frame_h: int, label: str) -> None:
    sheet = Image.open(path).convert("RGBA")
    frames = max(1, sheet.width // frame_w)
    cols = max(1, frames - 1)
    cell_size = (180, 180)
    contact = Image.new("RGBA", (cols * cell_size[0], cell_size[1]), (10, 10, 10, 255))
    for index in range(cols):
        a = np.array(sheet_frame(path, index, frame_w, frame_h).convert("RGBA")).astype(np.int16)
        b = np.array(sheet_frame(path, index + 1, frame_w, frame_h).convert("RGBA")).astype(np.int16)
        diff = np.abs(a[..., :3] - b[..., :3]).sum(axis=2)
        alpha_diff = np.abs(a[..., 3] - b[..., 3])
        intensity = np.clip(diff / 3 + alpha_diff, 0, 255).astype(np.uint8)
        diff_img = np.zeros((frame_h, frame_w, 4), dtype=np.uint8)
        diff_img[..., 0] = intensity
        diff_img[..., 1] = np.clip(intensity * 0.55, 0, 255)
        diff_img[..., 3] = np.where(intensity > 10, 255, 0).astype(np.uint8)
        cell = dark_cell(Image.fromarray(diff_img), cell_size, f"{label} {index}>{index + 1}")
        contact.alpha_composite(cell, (index * cell_size[0], 0))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    contact.save(out_path)


def save_map_readability_grid() -> Path:
    out_path = QA_DIR / "qa_map_readability_grid.png"
    cell_w, cell_h = 360, 240
    contact = Image.new("RGBA", (cell_w * 4, cell_h * 2), (10, 10, 10, 255))
    tank = sheet_frame(ENEMIES / "iron_tank_hd_walk_sheet.png", 0, 256, 256)
    boss = sheet_frame(ENEMIES / "boss_demon_hd_idle_sheet.png", 0, 384, 384)
    nun = sheet_frame(ROOT / "assets_generated/nun_hd/nun_hd_run_sheet.png", 0, 256, 256)
    for index in range(8):
        base = Image.open(DUNGEON / f"map_base_{index}.png").convert("RGBA").resize((cell_w, cell_h), Image.Resampling.BICUBIC)
        overlay = Image.open(DUNGEON / f"map_overlay_{index}.png").convert("RGBA").resize((cell_w, cell_h), Image.Resampling.BICUBIC)
        base.alpha_composite(overlay)
        for sprite, target_h, pos in (
            (nun, 86, (122, 118)),
            (tank, 92, (38, 116)),
            (boss, 132, (210, 78)),
        ):
            item = crop_visible(sprite, 3)
            scale = target_h / item.height
            item = item.resize((max(1, int(item.width * scale)), target_h), Image.Resampling.LANCZOS)
            base.alpha_composite(item, pos)
        draw = ImageDraw.Draw(base)
        draw.text((8, 8), f"map {index}", fill=(196, 196, 188, 255))
        contact.alpha_composite(base, ((index % 4) * cell_w, (index // 4) * cell_h))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    contact.save(out_path)
    return out_path


def make_quality_sprint_qa() -> list[Path]:
    outputs = [
        QA_DIR / "qa_iron_tank_contact.png",
        QA_DIR / "qa_demon_boss_contact.png",
        QA_DIR / "qa_iron_tank_frame_diff.png",
        QA_DIR / "qa_demon_boss_frame_diff.png",
    ]
    save_contact(
        [
            ("iron walk", ENEMIES / "iron_tank_hd_walk_sheet.png", 256, 256),
            ("iron attack", ENEMIES / "iron_tank_hd_attack_sheet.png", 256, 256),
            ("iron hit", ENEMIES / "iron_tank_hd_hit_sheet.png", 256, 256),
            ("iron death", ENEMIES / "iron_tank_hd_death_sheet.png", 256, 256),
        ],
        outputs[0],
    )
    save_contact(
        [
            ("boss idle", ENEMIES / "boss_demon_hd_idle_sheet.png", 384, 384),
            ("boss attack", ENEMIES / "boss_demon_hd_attack_sheet.png", 384, 384),
            ("boss hit", ENEMIES / "boss_demon_hd_hit_sheet.png", 384, 384),
            ("boss death", ENEMIES / "boss_demon_hd_death_sheet.png", 384, 384),
        ],
        outputs[1],
    )
    save_frame_diff(ENEMIES / "iron_tank_hd_walk_sheet.png", outputs[2], 256, 256, "iron")
    save_frame_diff(ENEMIES / "boss_demon_hd_idle_sheet.png", outputs[3], 384, 384, "boss")
    outputs.append(save_map_readability_grid())
    return outputs


def main() -> None:
    skeleton = extract_horizontal_frames(SRC / "skeleton_walk_source_v2.png", 8)
    ghost = extract_horizontal_frames(SRC / "ghost_float_source_v2.png", 6)
    tank_source, boss_source, tank, boss = load_quality_enemy_sources()
    normal_enemy_walks = build_normal_enemy_walks(skeleton, ghost, tank, boss)
    boss_variant_idles = build_boss_variant_idles(boss)

    outputs: list[Path] = []

    tasks = [
        (skeleton, 256, 256, 16, ENEMIES / "skeleton_hd_walk_sheet.png"),
        (attack_from(skeleton, 4), 256, 256, 16, ENEMIES / "skeleton_hd_attack_sheet.png"),
        (hit_from(skeleton, 3), 256, 256, 16, ENEMIES / "skeleton_hd_hit_sheet.png"),
        (death_from(skeleton, 8), 256, 256, 16, ENEMIES / "skeleton_hd_death_sheet.png"),
        (ghost, 256, 256, 16, ENEMIES / "ghost_caster_hd_float_sheet.png"),
        (cast_from(ghost, 6), 256, 256, 16, ENEMIES / "ghost_caster_hd_cast_sheet.png"),
        (death_from(ghost, 8), 256, 256, 16, ENEMIES / "ghost_caster_hd_death_sheet.png"),
        (tank, 256, 256, 16, ENEMIES / "iron_tank_hd_walk_sheet.png"),
        (build_source_attack_frames(tank_source, "tank", 4), 256, 256, 16, ENEMIES / "iron_tank_hd_attack_sheet.png"),
        (build_source_hit_frames(tank_source, "tank", 3), 256, 256, 16, ENEMIES / "iron_tank_hd_hit_sheet.png"),
        (build_source_death_frames(tank_source, "tank", 8), 256, 256, 16, ENEMIES / "iron_tank_hd_death_sheet.png"),
        (boss, 384, 384, 20, ENEMIES / "boss_demon_hd_idle_sheet.png"),
        (build_source_attack_frames(boss_source, "boss", 6), 384, 384, 20, ENEMIES / "boss_demon_hd_attack_sheet.png"),
        (build_source_hit_frames(boss_source, "boss", 4), 384, 384, 20, ENEMIES / "boss_demon_hd_hit_sheet.png"),
        (build_source_death_frames(boss_source, "boss", 10), 384, 384, 20, ENEMIES / "boss_demon_hd_death_sheet.png"),
    ]
    for name, walk_frames in normal_enemy_walks.items():
        tasks.extend([
            (walk_frames, 256, 256, 16, ENEMIES / f"{name}_hd_walk_sheet.png"),
            (attack_from(walk_frames, 4), 256, 256, 16, ENEMIES / f"{name}_hd_attack_sheet.png"),
            (hit_from(walk_frames, 3), 256, 256, 16, ENEMIES / f"{name}_hd_hit_sheet.png"),
            (death_from(walk_frames, 8), 256, 256, 16, ENEMIES / f"{name}_hd_death_sheet.png"),
        ])
    for name, idle_frames in boss_variant_idles.items():
        tasks.extend([
            (idle_frames, 384, 384, 20, ENEMIES / f"{name}_hd_idle_sheet.png"),
            (attack_from(idle_frames, 6), 384, 384, 20, ENEMIES / f"{name}_hd_attack_sheet.png"),
            (hit_from(idle_frames, 4), 384, 384, 20, ENEMIES / f"{name}_hd_hit_sheet.png"),
            (death_from(idle_frames, 10), 384, 384, 20, ENEMIES / f"{name}_hd_death_sheet.png"),
        ])

    for frames, frame_w, frame_h, pad_bottom, out_path in tasks:
        is_death = "death" in out_path.stem
        is_enemy = out_path.parent == ENEMIES
        make_sheet(
            frames,
            frame_w,
            frame_h,
            pad_bottom,
            out_path,
            solid_alpha=not is_death,
            body_matte=is_enemy and not is_death,
            matte_color=enemy_matte_color(out_path),
            fill_interior=is_enemy and not is_death and "iron_tank" in out_path.stem,
        )
        outputs.append(out_path)
        print(f"rebuilt {out_path.relative_to(ROOT)}")

    for out_path in rebuild_vfx_assets():
        outputs.append(out_path)
        print(f"rebuilt {out_path.relative_to(ROOT)}")

    for out_path in rebuild_dungeon_maps():
        outputs.append(out_path)
        print(f"rebuilt {out_path.relative_to(ROOT)}")

    make_preview(outputs)
    make_attack_vfx_preview()
    print(f"preview {PREVIEW.relative_to(ROOT)}")
    for out_path in make_quality_sprint_qa():
        print(f"qa {out_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
