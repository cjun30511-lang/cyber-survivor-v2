#!/usr/bin/env python3
"""
Final Spritesheet Processor - Uses the best detection method for each image type.
For white-background grids: column/row projection (v1 method - works great for well-separated sprites)
For black-background packed images: grid subdivision with smart content detection
"""

from PIL import Image
import numpy as np
import os

FRAME_SIZE = 128
OUTPUT_DIR = '/Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2/assets_generated/nun'
ARTIFACT_DIR = '/Users/shenjun8676/.gemini/antigravity/brain/dae1de1e-74a6-46a7-944b-bdfb2b33c3a4'


def detect_bg(data):
    h, w = data.shape[:2]
    borders = np.concatenate([data[0,:,:3], data[-1,:,:3], data[:, 0,:3], data[:,-1,:3]])
    return 'white' if np.mean(borders) > 128 else 'black'


def make_rgba(img):
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    data = np.array(img)
    bg = detect_bg(data)
    if bg == 'white':
        brightness = np.mean(data[:,:,:3], axis=2)
        data[brightness > 240, 3] = 0
        near = (brightness > 200) & (brightness <= 240)
        data[near, 3] = ((255 - brightness[near]) * 3).clip(0, 255).astype(np.uint8)
        img = Image.fromarray(data)
    return img, bg


def find_segments(active, min_size=30, min_gap=8):
    """Find runs of True values, merge close ones."""
    segs = []
    in_seg = False
    start = 0
    for i, v in enumerate(active):
        if v and not in_seg:
            start = i
            in_seg = True
        elif not v and in_seg:
            if i - start >= min_size:
                segs.append((start, i))
            in_seg = False
    if in_seg and len(active) - start >= min_size:
        segs.append((start, len(active)))
    # Merge close segments
    if len(segs) > 1:
        merged = [segs[0]]
        for s in segs[1:]:
            if s[0] - merged[-1][1] < min_gap:
                merged[-1] = (merged[-1][0], s[1])
            else:
                merged.append(s)
        segs = merged
    return segs


def find_frames_projection(img_array, bg, min_frame_size=40):
    """V1 method: column/row projection to find grid cells."""
    if img_array.shape[2] == 4:
        alpha = img_array[:,:,3]
    else:
        alpha = np.mean(img_array[:,:,:3], axis=2).astype(np.uint8)
    
    h, w = alpha.shape
    
    if bg == 'white':
        brightness = np.mean(img_array[:,:,:3], axis=2)
        mask = brightness < 220
    else:
        mask = alpha > 20
    
    col_proj = np.sum(mask, axis=0)
    row_proj = np.sum(mask, axis=1)
    
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


def find_frames_grid_smart(img_array, bg, expected, min_frame_size=30):
    """Grid subdivision with smart content cropping."""
    h, w = img_array.shape[:2]
    
    if bg == 'white':
        brightness = np.mean(img_array[:,:,:3], axis=2)
        mask = brightness < 220
    else:
        mask = img_array[:,:,3] > 15 if img_array.shape[2] == 4 else np.mean(img_array[:,:,:3], axis=2) > 20
    
    # Try grid arrangements
    arrangements = []
    for cols in range(1, expected + 1):
        if expected % cols == 0:
            rows = expected // cols
            arrangements.append((rows, cols))
    arrangements.sort(key=lambda rc: abs(rc[0] - rc[1]))
    
    for rows, cols in arrangements:
        cw = w // cols
        ch = h // rows
        
        frames = []
        for r in range(rows):
            for c in range(cols):
                x1, y1 = c * cw, r * ch
                x2, y2 = (c+1) * cw, (r+1) * ch
                
                cell_mask = mask[y1:y2, x1:x2]
                if np.sum(cell_mask) < 100:
                    continue
                
                rows_c = np.any(cell_mask, axis=1)
                cols_c = np.any(cell_mask, axis=0)
                if not np.any(rows_c) or not np.any(cols_c):
                    continue
                
                cr1 = y1 + np.argmax(rows_c)
                cr2 = y1 + len(rows_c) - np.argmax(rows_c[::-1])
                cc1 = x1 + np.argmax(cols_c)
                cc2 = x1 + len(cols_c) - np.argmax(cols_c[::-1])
                
                fw = cc2 - cc1
                fh = cr2 - cr1
                if fw >= min_frame_size and fh >= min_frame_size:
                    frames.append((cc1, cr1, cc2, cr2))
        
        if len(frames) >= expected:
            return frames[:expected]
    
    return []


def extract_to_cell(src, bbox, size=FRAME_SIZE, pad=0.04):
    """Extract and center a frame in a size x size cell."""
    x1, y1, x2, y2 = bbox
    frame = src.crop((x1, y1, x2, y2))
    fw, fh = frame.size
    
    usable = int(size * (1.0 - pad * 2))
    scale = min(usable / fw, usable / fh)
    nw = max(1, int(fw * scale))
    nh = max(1, int(fh * scale))
    frame = frame.resize((nw, nh), Image.LANCZOS)
    
    cell = Image.new('RGBA', (size, size), (0,0,0,0))
    px = (size - nw) // 2
    py = size - nh - int(size * 0.04)
    cell.paste(frame, (px, py), frame if frame.mode == 'RGBA' else None)
    return cell


def process(input_path, output_name, expected):
    print(f"\n{'='*50}")
    print(f"{os.path.basename(input_path)} -> {output_name} ({expected} frames)")
    
    img = Image.open(input_path)
    img, bg = make_rgba(img)
    data = np.array(img)
    print(f"  {img.width}x{img.height}, bg={bg}")
    
    # Try projection method first (better for well-separated sprites)
    frames = find_frames_projection(data, bg)
    print(f"  Projection: {len(frames)} frames")
    
    # If projection got close to expected, use it
    if abs(len(frames) - expected) <= 2 and len(frames) > 0:
        pass  # use projection results
    else:
        # Try grid fallback
        grid_frames = find_frames_grid_smart(data, bg, expected)
        print(f"  Grid: {len(grid_frames)} frames")
        if len(grid_frames) >= expected:
            frames = grid_frames
        elif len(frames) == 0:
            frames = grid_frames
    
    if not frames:
        print(f"  ERROR: No frames!")
        return False
    
    # Adjust count
    if len(frames) > expected:
        frames = frames[:expected]
    while len(frames) < expected:
        frames.append(frames[-1])
    
    strip = Image.new('RGBA', (FRAME_SIZE * expected, FRAME_SIZE), (0,0,0,0))
    for i, bbox in enumerate(frames):
        w, h = bbox[2]-bbox[0], bbox[3]-bbox[1]
        print(f"  F{i+1}: {w}x{h}")
        cell = extract_to_cell(img, bbox)
        strip.paste(cell, (i * FRAME_SIZE, 0))
    
    out = os.path.join(OUTPUT_DIR, output_name)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    strip.save(out, 'PNG')
    print(f"  ✅ {out} ({FRAME_SIZE*expected}x{FRAME_SIZE})")
    return True


def find_latest(prefix):
    matching = [f for f in os.listdir(ARTIFACT_DIR) if f.startswith(prefix) and f.endswith('.png')]
    matching.sort()
    return os.path.join(ARTIFACT_DIR, matching[-1]) if matching else None


def main():
    sheets = [
        ('nun_idle_v2', 'nun_idle.png', 6),
        ('nun_run_v2', 'nun_run.png', 8),
        ('nun_cast_windup_v2', 'nun_cast_windup.png', 4),
        ('nun_cast_release_v2', 'nun_cast_release.png', 3),
        ('nun_cast_recovery_v2', 'nun_cast_recovery.png', 4),
    ]
    
    ok = fail = 0
    for prefix, name, n in sheets:
        path = find_latest(prefix)
        if not path:
            print(f"\n⚠️ Missing: {prefix}")
            fail += 1
            continue
        if process(path, name, n):
            ok += 1
        else:
            fail += 1
    
    print(f"\nDone: {ok} ok, {fail} fail")


if __name__ == '__main__':
    main()
