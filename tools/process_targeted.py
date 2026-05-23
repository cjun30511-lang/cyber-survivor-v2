#!/usr/bin/env python3
"""
Targeted processor for specific problematic source images.
Handles the black-background and multi-row cases with custom detection.
"""

from PIL import Image
import numpy as np
import os

FRAME_SIZE = 128
OUTPUT_DIR = '/Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2/assets_generated/nun'
ARTIFACT_DIR = '/Users/shenjun8676/.gemini/antigravity/brain/dae1de1e-74a6-46a7-944b-bdfb2b33c3a4'


def make_rgba(img):
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    data = np.array(img)
    # Check if white bg
    borders = np.concatenate([data[0,:,:3], data[-1,:,:3], data[:,0,:3], data[:,-1,:3]])
    if np.mean(borders) > 128:
        brightness = np.mean(data[:,:,:3], axis=2)
        data[brightness > 240, 3] = 0
        near = (brightness > 200) & (brightness <= 240)
        data[near, 3] = ((255 - brightness[near]) * 3).clip(0, 255).astype(np.uint8)
        img = Image.fromarray(data)
    return img


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


def build_strip(img, bboxes, expected, output_path):
    while len(bboxes) < expected:
        bboxes.append(bboxes[-1])
    bboxes = bboxes[:expected]
    
    strip = Image.new('RGBA', (FRAME_SIZE * expected, FRAME_SIZE), (0,0,0,0))
    for i, bbox in enumerate(bboxes):
        cell = extract_to_cell(img, bbox)
        strip.paste(cell, (i * FRAME_SIZE, 0))
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    strip.save(output_path, 'PNG')
    print(f"  ✅ {output_path}")


def find_content_bboxes_by_columns(data, min_col_content=50, min_gap=15, min_bbox_size=40):
    """Find characters by looking for content columns, then splitting by gaps."""
    if data.shape[2] == 4:
        alpha = data[:,:,3]
    else:
        alpha = np.mean(data[:,:,:3], axis=2)
    
    h, w = alpha.shape
    
    # For black bg: pixels are content if they have significant brightness or alpha
    brightness = np.mean(data[:,:,:3], axis=2)
    mask = (alpha > 20) & (brightness > 15)
    
    # Column projection
    col_proj = np.sum(mask, axis=0)
    col_active = col_proj > min_col_content
    
    # Find column segments
    segs = []
    in_seg = False
    start = 0
    for i in range(w):
        if col_active[i] and not in_seg:
            start = i
            in_seg = True
        elif not col_active[i] and in_seg:
            segs.append((start, i))
            in_seg = False
    if in_seg:
        segs.append((start, w))
    
    # Merge very close segments
    if segs:
        merged = [segs[0]]
        for s in segs[1:]:
            if s[0] - merged[-1][1] < min_gap:
                merged[-1] = (merged[-1][0], s[1])
            else:
                merged.append(s)
        segs = merged
    
    # For each column segment, find the vertical extent
    bboxes = []
    for cs, ce in segs:
        if ce - cs < min_bbox_size:
            continue
        col_mask = mask[:, cs:ce]
        rows_active = np.any(col_mask, axis=1)
        if not np.any(rows_active):
            continue
        rs = np.argmax(rows_active)
        re = h - np.argmax(rows_active[::-1])
        if re - rs < min_bbox_size:
            continue
        bboxes.append((cs, rs, ce, re))
    
    return bboxes


def find_content_bboxes_by_rows_then_cols(data, min_content=30, min_gap=10, min_size=40):
    """Find characters row by row, then columns within each row."""
    brightness = np.mean(data[:,:,:3], axis=2)
    if data.shape[2] == 4:
        mask = (data[:,:,3] > 15) & (brightness > 10)
    else:
        mask = brightness > 20
    
    h, w = mask.shape
    
    # Find row bands
    row_proj = np.sum(mask, axis=1)
    row_active = row_proj > min_content
    
    row_segs = []
    in_seg = False
    start = 0
    for i in range(h):
        if row_active[i] and not in_seg:
            start = i
            in_seg = True
        elif not row_active[i] and in_seg:
            row_segs.append((start, i))
            in_seg = False
    if in_seg:
        row_segs.append((start, h))
    
    # Merge close row segs
    if row_segs:
        merged = [row_segs[0]]
        for s in row_segs[1:]:
            if s[0] - merged[-1][1] < min_gap:
                merged[-1] = (merged[-1][0], s[1])
            else:
                merged.append(s)
        row_segs = merged
    
    # For each row band, find column segments
    all_bboxes = []
    for rs, re in row_segs:
        if re - rs < min_size:
            continue
        band = mask[rs:re, :]
        col_proj = np.sum(band, axis=0)
        col_active = col_proj > max(3, (re-rs) * 0.02)
        
        col_segs = []
        in_seg = False
        start = 0
        for i in range(w):
            if col_active[i] and not in_seg:
                start = i
                in_seg = True
            elif not col_active[i] and in_seg:
                col_segs.append((start, i))
                in_seg = False
        if in_seg:
            col_segs.append((start, w))
        
        # Merge close
        if col_segs:
            merged = [col_segs[0]]
            for s in col_segs[1:]:
                if s[0] - merged[-1][1] < min_gap:
                    merged[-1] = (merged[-1][0], s[1])
                else:
                    merged.append(s)
            col_segs = merged
        
        for cs, ce in col_segs:
            if ce - cs < min_size:
                continue
            # Tight bbox
            cell_mask = mask[rs:re, cs:ce]
            rows_c = np.any(cell_mask, axis=1)
            cols_c = np.any(cell_mask, axis=0)
            if not np.any(rows_c) or not np.any(cols_c):
                continue
            r1 = rs + np.argmax(rows_c)
            r2 = rs + len(rows_c) - np.argmax(rows_c[::-1])
            c1 = cs + np.argmax(cols_c)
            c2 = cs + len(cols_c) - np.argmax(cols_c[::-1])
            if c2-c1 >= min_size and r2-r1 >= min_size:
                all_bboxes.append((c1, r1, c2, r2))
    
    return all_bboxes


def process_run():
    """Process the run spritesheet - 3 rows of characters in a grid."""
    print("\n== Processing RUN ==")
    path = find_latest('nun_run_v2')
    if not path:
        print("  Not found!")
        return
    
    img = Image.open(path)
    img = make_rgba(img)
    data = np.array(img)
    
    # The run image has 3 rows with ~3-4 characters each
    # Use row-then-column detection
    bboxes = find_content_bboxes_by_rows_then_cols(data)
    print(f"  Found {len(bboxes)} character frames")
    for i, b in enumerate(bboxes):
        print(f"    {i}: ({b[0]},{b[1]})-({b[2]},{b[3]}) {b[2]-b[0]}x{b[3]-b[1]}")
    
    out = os.path.join(OUTPUT_DIR, 'nun_run.png')
    build_strip(img, bboxes, 8, out)


def process_cast_release():
    """Process cast release - black bg, scattered poses."""
    print("\n== Processing CAST RELEASE ==")
    path = find_latest('nun_cast_release_v2')
    if not path:
        print("  Not found!")
        return
    
    img = Image.open(path)
    img = make_rgba(img)
    data = np.array(img)
    
    bboxes = find_content_bboxes_by_rows_then_cols(data, min_content=15, min_gap=15, min_size=30)
    print(f"  Found {len(bboxes)} frames")
    for i, b in enumerate(bboxes):
        print(f"    {i}: ({b[0]},{b[1]})-({b[2]},{b[3]}) {b[2]-b[0]}x{b[3]-b[1]}")
    
    out = os.path.join(OUTPUT_DIR, 'nun_cast_release.png')
    build_strip(img, bboxes, 3, out)


def process_cast_recovery():
    """Process cast recovery - black bg, characters at bottom."""
    print("\n== Processing CAST RECOVERY ==")
    path = find_latest('nun_cast_recovery_v2')
    if not path:
        print("  Not found!")
        return
    
    img = Image.open(path)
    img = make_rgba(img)
    data = np.array(img)
    
    bboxes = find_content_bboxes_by_columns(data, min_col_content=20, min_gap=15, min_bbox_size=30)
    print(f"  Found {len(bboxes)} frames")
    for i, b in enumerate(bboxes):
        print(f"    {i}: ({b[0]},{b[1]})-({b[2]},{b[3]}) {b[2]-b[0]}x{b[3]-b[1]}")
    
    out = os.path.join(OUTPUT_DIR, 'nun_cast_recovery.png')
    build_strip(img, bboxes, 4, out)


def process_cast_windup():
    """Process cast windup - reverse order (image goes large to small, we need small to large)."""
    print("\n== Processing CAST WINDUP ==")
    path = find_latest('nun_cast_windup_v2')
    if not path:
        print("  Not found!")
        return
    
    img = Image.open(path)
    img = make_rgba(img)
    data = np.array(img)
    
    # Use column detection
    bboxes = find_content_bboxes_by_columns(data, min_col_content=30, min_gap=10, min_bbox_size=40)
    print(f"  Found {len(bboxes)} frames")
    
    # Sort by x position (left to right)
    bboxes.sort(key=lambda b: b[0])
    
    # The image shows progression from large (fully extended with energy) to small (crouching)
    # We need: small (crouching) → large (fully extended) for windup animation
    # So reverse the order
    bboxes.reverse()
    
    for i, b in enumerate(bboxes):
        print(f"    {i}: ({b[0]},{b[1]})-({b[2]},{b[3]}) {b[2]-b[0]}x{b[3]-b[1]}")
    
    out = os.path.join(OUTPUT_DIR, 'nun_cast_windup.png')
    build_strip(img, bboxes, 4, out)


def find_latest(prefix):
    matching = [f for f in os.listdir(ARTIFACT_DIR) if f.startswith(prefix) and f.endswith('.png')]
    matching.sort()
    return os.path.join(ARTIFACT_DIR, matching[-1]) if matching else None


if __name__ == '__main__':
    process_run()
    process_cast_release()
    process_cast_recovery()
    process_cast_windup()
    print("\nAll targeted processing done!")
