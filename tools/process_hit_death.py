#!/usr/bin/env python3
"""Process hit and death spritesheets."""

from PIL import Image
import numpy as np
import os

FRAME_SIZE = 128
OUTPUT_DIR = '/Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2/assets_generated/nun'
ARTIFACT_DIR = '/Users/shenjun8676/.gemini/antigravity/brain/dae1de1e-74a6-46a7-944b-bdfb2b33c3a4'


def find_latest(prefix):
    matching = [f for f in os.listdir(ARTIFACT_DIR) if f.startswith(prefix) and f.endswith('.png')]
    matching.sort()
    return os.path.join(ARTIFACT_DIR, matching[-1]) if matching else None


def make_rgba(img):
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    data = np.array(img)
    borders = np.concatenate([data[0,:,:3], data[-1,:,:3], data[:,0,:3], data[:,-1,:3]])
    if np.mean(borders) > 128:
        brightness = np.mean(data[:,:,:3], axis=2)
        data[brightness > 240, 3] = 0
        near = (brightness > 200) & (brightness <= 240)
        data[near, 3] = ((255 - brightness[near]) * 3).clip(0, 255).astype(np.uint8)
        img = Image.fromarray(data)
    return img


def find_segments(active, min_size=30, min_gap=8):
    segs = []
    in_seg = False
    start = 0
    for i, v in enumerate(active):
        if v and not in_seg:
            start = i; in_seg = True
        elif not v and in_seg:
            if i - start >= min_size: segs.append((start, i))
            in_seg = False
    if in_seg and len(active) - start >= min_size:
        segs.append((start, len(active)))
    if segs:
        merged = [segs[0]]
        for s in segs[1:]:
            if s[0] - merged[-1][1] < min_gap:
                merged[-1] = (merged[-1][0], s[1])
            else:
                merged.append(s)
        segs = merged
    return segs


def find_frames_projection(data, min_frame_size=40):
    brightness = np.mean(data[:,:,:3], axis=2)
    mask = brightness < 220
    
    col_proj = np.sum(mask, axis=0)
    row_proj = np.sum(mask, axis=1)
    
    h, w = mask.shape
    col_thresh = max(3, h * 0.015)
    row_thresh = max(3, w * 0.015)
    
    col_segs = find_segments(col_proj > col_thresh, min_size=min_frame_size)
    row_segs = find_segments(row_proj > row_thresh, min_size=min_frame_size)
    
    if not col_segs or not row_segs:
        return []
    
    frames = []
    for rs, re in row_segs:
        for cs, ce in col_segs:
            cell_mask = mask[rs:re, cs:ce]
            if np.sum(cell_mask) < min_frame_size * min_frame_size * 0.03:
                continue
            rows_c = np.any(cell_mask, axis=1)
            cols_c = np.any(cell_mask, axis=0)
            if not np.any(rows_c) or not np.any(cols_c):
                continue
            r1 = rs + np.argmax(rows_c)
            r2 = rs + len(rows_c) - np.argmax(rows_c[::-1])
            c1 = cs + np.argmax(cols_c)
            c2 = cs + len(cols_c) - np.argmax(cols_c[::-1])
            if c2-c1 >= min_frame_size and r2-r1 >= min_frame_size:
                frames.append((c1, r1, c2, r2))
    
    frames.sort(key=lambda f: (f[1], f[0]))
    return frames


def extract_to_cell(src, bbox, size=FRAME_SIZE, pad=0.03):
    x1, y1, x2, y2 = bbox
    frame = src.crop((x1, y1, x2, y2))
    fw, fh = frame.size
    usable = int(size * (1.0 - pad * 2))
    scale = min(usable / fw, usable / fh)
    nw, nh = max(1, int(fw * scale)), max(1, int(fh * scale))
    frame = frame.resize((nw, nh), Image.LANCZOS)
    cell = Image.new('RGBA', (size, size), (0,0,0,0))
    px = (size - nw) // 2
    py = size - nh - int(size * 0.04)
    cell.paste(frame, (px, py), frame if frame.mode == 'RGBA' else None)
    return cell


def process_sheet(prefix, output_name, expected):
    path = find_latest(prefix)
    if not path:
        print(f"⚠️ {prefix} not found")
        return False
    
    img = Image.open(path)
    img = make_rgba(img)
    data = np.array(img)
    
    frames = find_frames_projection(data)
    print(f"  {prefix}: {len(frames)} frames detected")
    
    while len(frames) < expected:
        frames.append(frames[-1] if frames else (0, 0, 128, 128))
    frames = frames[:expected]
    
    strip = Image.new('RGBA', (FRAME_SIZE * expected, FRAME_SIZE), (0,0,0,0))
    for i, bbox in enumerate(frames):
        cell = extract_to_cell(img, bbox)
        strip.paste(cell, (i * FRAME_SIZE, 0))
    
    out = os.path.join(OUTPUT_DIR, output_name)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    strip.save(out, 'PNG')
    print(f"  ✅ {out}")
    return True


if __name__ == '__main__':
    process_sheet('nun_hit_v2', 'nun_hit.png', 3)
    process_sheet('nun_death_v2', 'nun_death.png', 6)
