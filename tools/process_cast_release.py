#!/usr/bin/env python3
"""
Manual frame extraction for the cast_release image which has overlapping characters.
The image layout (1024x1024, black bg):
- Row 1 (y:0-340): Two characters - one upper-left and one middle-right with big fire blast
- Row 2 (y:340-682): Connected to row1 via fire, ignore  
- Row 3 (y:682-1024): Four standing poses in a row

We'll use: top-left character, then 3 of the bottom row characters (showing release sequence).
Actually for a release anim, we need:
F1: Staff extended (top left character)
F2: Staff thrusting with fire (middle character body only)
F3: Standing after release (bottom row, last pose)
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


def find_latest(prefix):
    matching = [f for f in os.listdir(ARTIFACT_DIR) if f.startswith(prefix) and f.endswith('.png')]
    matching.sort()
    return os.path.join(ARTIFACT_DIR, matching[-1]) if matching else None


def main():
    path = find_latest('nun_cast_release_v2')
    if not path:
        print("Cast release image not found!")
        return
    
    img = Image.open(path)
    img = make_rgba(img)
    
    # Manual bounding boxes for the 3 best frames:
    # F1: Top-left character with staff extended (pre-blast)
    #     approx x:12-300, y:92-340
    # F2: Middle character thrusting staff with fire blast (clip just the character body)
    #     approx x:280-560, y:320-680
    # F3: Bottom-right character after cast (lowered staff with sparks)
    #     approx x:760-1005, y:680-1000
    
    bboxes = [
        (12, 92, 300, 340),     # F1: Staff pointing, pre-blast
        (280, 320, 560, 680),   # F2: Mid-thrust, casting 
        (760, 680, 1005, 1000), # F3: After release, standing
    ]
    
    strip = Image.new('RGBA', (FRAME_SIZE * 3, FRAME_SIZE), (0, 0, 0, 0))
    for i, bbox in enumerate(bboxes):
        print(f"  Frame {i+1}: ({bbox[0]},{bbox[1]})-({bbox[2]},{bbox[3]})")
        cell = extract_to_cell(img, bbox)
        strip.paste(cell, (i * FRAME_SIZE, 0))
    
    out = os.path.join(OUTPUT_DIR, 'nun_cast_release.png')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    strip.save(out, 'PNG')
    print(f"  ✅ {out}")


if __name__ == '__main__':
    main()
