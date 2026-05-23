#!/usr/bin/env python3
import os
import numpy as np
from PIL import Image

FRAME_SIZE = 128
OUTPUT_DIR = '/Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2/assets_generated/nun'
ARTIFACT_DIR = '/Users/shenjun8676/.gemini/antigravity/brain/dae1de1e-74a6-46a7-944b-bdfb2b33c3a4'

# Unified global scaling to prevent scaling pops/jitter between states
GLOBAL_SCALE = 0.209

def find_latest(prefix):
    matching = [f for f in os.listdir(ARTIFACT_DIR) if f.startswith(prefix) and f.endswith('.png')]
    if not matching:
        return None
    matching.sort()
    return os.path.join(ARTIFACT_DIR, matching[-1])

def make_transparent_with_antialias(img):
    """Convert white background to transparent with smooth anti-aliasing."""
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    data = np.array(img)
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    
    # Calculate brightness
    brightness = (r.astype(float) + g.astype(float) + b.astype(float)) / 3.0
    
    # Create mask for white background
    # Smooth transition between brightness 240 (opaque) and 253 (fully transparent)
    data[brightness > 253, 3] = 0
    
    transitional = (brightness > 240) & (brightness <= 253)
    factor = (253.0 - brightness[transitional]) / 13.0 # 0.0 to 1.0
    data[transitional, 3] = (data[transitional, 3] * factor).astype(np.uint8)
    
    return Image.fromarray(data)

def find_content_bbox(img_rgba):
    """Find the bounding box of non-transparent content."""
    data = np.array(img_rgba)
    alpha = data[:,:,3]
    non_zero = np.where(alpha > 10)
    if len(non_zero[0]) == 0 or len(non_zero[1]) == 0:
        return None
    ymin, ymax = np.min(non_zero[0]), np.max(non_zero[0])
    xmin, xmax = np.min(non_zero[1]), np.max(non_zero[1])
    return (xmin, ymin, xmax + 1, ymax + 1)

def process_sheet(prefix, output_name, rows, cols, expected_frames, is_idle=False, has_labels=False):
    path = find_latest(prefix)
    if not path:
        print(f"❌ Missing: {prefix}")
        return False
    
    print(f"\nProcessing {prefix} -> {output_name} (Using GLOBAL_SCALE={GLOBAL_SCALE})...")
    img = Image.open(path)
    img_rgba = make_transparent_with_antialias(img)
    w, h = img.size
    
    cell_w = w / cols
    cell_h = h / rows
    
    frames_data = []
    
    # Customized extraction for cast release sheet to get the best frames
    if prefix == 'nun_cast_release_v2':
        # Frame 1: Top-Left cell (row 0, col 0)
        # Frame 2: Top-Right cell (row 0, col 1)
        # Frame 3: Bottom row spanning horizontally (row 2, y1=682 to 1024, x1=0 to 1024)
        cells_to_extract = [
            (img_rgba.crop((0, 0, 512, 341)), 512, 341, False), # F1
            (img_rgba.crop((512, 0, 1024, 341)), 512, 341, False), # F2
            (img_rgba.crop((0, 682, 1024, 1024)), 1024, 342, False) # F3 (with fire explosion!)
        ]
        
        for idx, (cell, cw, ch, is_id) in enumerate(cells_to_extract):
            bbox = find_content_bbox(cell)
            if not bbox:
                continue
            bw = bbox[2] - bbox[0]
            bh = bbox[3] - bbox[1]
            cx = bbox[0] + bw / 2
            cy = bbox[1] + bh / 2
            
            frames_data.append({
                'cell': cell,
                'bbox': bbox,
                'bw': bw,
                'bh': bh,
                'cx': cx,
                'cy': cy,
                'cell_w': cw,
                'cell_h': ch,
                'is_idle': False
            })
    else:
        # Standard extraction
        for r in range(rows):
            for c in range(cols):
                if len(frames_data) >= expected_frames:
                    break
                    
                x1 = int(c * cell_w)
                y1 = int(r * cell_h)
                x2 = int((c + 1) * cell_w)
                y2 = int((r + 1) * cell_h)
                
                cell = img_rgba.crop((x1, y1, x2, y2))
                
                # Exclude labels if the image has text at top/bottom
                if is_idle:
                    cy1 = int(cell_h * 0.12)
                    cy2 = int(cell_h * 0.82)
                    cell_cropped = cell.crop((0, cy1, int(cell_w), cy2))
                    bbox = find_content_bbox(cell_cropped)
                    if bbox:
                        bbox = (bbox[0], bbox[1] + cy1, bbox[2], bbox[3] + cy1)
                elif has_labels:
                    # Exclude labels at the bottom 18% of each cell height
                    cy2 = int(cell_h * 0.82)
                    cell_cropped = cell.crop((0, 0, int(cell_w), cy2))
                    bbox = find_content_bbox(cell_cropped)
                else:
                    bbox = find_content_bbox(cell)
                    
                if not bbox:
                    print(f"  Empty cell at row {r}, col {c} - skipping")
                    continue
                    
                bw = bbox[2] - bbox[0]
                bh = bbox[3] - bbox[1]
                cx = bbox[0] + bw / 2
                cy = bbox[1] + bh / 2
                
                frames_data.append({
                    'cell': cell,
                    'bbox': bbox,
                    'bw': bw,
                    'bh': bh,
                    'cx': cx,
                    'cy': cy,
                    'cell_w': cell_w,
                    'cell_h': cell_h,
                    'is_idle': is_idle
                })
            
    # Find max dimensions across all frames in this sheet to crop uniformly
    max_w = max(f['bw'] for f in frames_data)
    max_h = max(f['bh'] for f in frames_data)
    
    # Crop box dimensions
    crop_size_w = max_w + 24
    crop_size_h = max_h + 24
    
    # Scale uniformly based on the global scale factor
    rw = int(crop_size_w * GLOBAL_SCALE)
    rh = int(crop_size_h * GLOBAL_SCALE)
    
    print(f"  Max size: {max_w}x{max_h}, uniform crop: {crop_size_w}x{crop_size_h} -> scaled to {rw}x{rh}")
    
    strip = Image.new('RGBA', (FRAME_SIZE * expected_frames, FRAME_SIZE), (0,0,0,0))
    
    for i, fd in enumerate(frames_data):
        cell = fd['cell']
        cx, cy = fd['cx'], fd['cy']
        cw = fd['cell_w']
        ch = fd['cell_h']
        is_id = fd['is_idle']
        
        # For idle: we align using cell_h / 2 as cy to preserve vertical floating motion!
        if is_id:
            cy_align = ch / 2.0
        else:
            cy_align = cy
            
        x1 = int(cx - crop_size_w / 2)
        y1 = int(cy_align - crop_size_h / 2)
        x2 = x1 + crop_size_w
        y2 = y1 + crop_size_h
        
        pad_left = max(0, -x1)
        pad_top = max(0, -y1)
        pad_right = max(0, x2 - int(cw))
        pad_bottom = max(0, y2 - int(ch))
        
        char_crop = cell.crop((max(0, x1), max(0, y1), min(int(cw), x2), min(int(ch), y2)))
        
        if pad_left > 0 or pad_top > 0 or pad_right > 0 or pad_bottom > 0:
            padded_char = Image.new('RGBA', (crop_size_w, crop_size_h), (0,0,0,0))
            padded_char.paste(char_crop, (pad_left, pad_top))
            char_crop = padded_char
            
        char_resized = char_crop.resize((rw, rh), Image.Resampling.LANCZOS)
        
        px = (FRAME_SIZE - rw) // 2
        # Ground anchoring near bottom center (e.g. Y=104)
        py = FRAME_SIZE - rh - int(FRAME_SIZE * 0.05)
        
        strip.paste(char_resized, (i * FRAME_SIZE + px, py), char_resized)
        
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, output_name)
    strip.save(out_path, 'PNG')
    print(f"  ✅ Saved: {out_path} ({strip.width}x{strip.height})")
    return True

def main():
    sheets = [
        ('nun_idle_v2', 'nun_idle.png', 2, 3, 6, True, False),       # 6 frames
        ('nun_run_v2', 'nun_run.png', 4, 2, 8, False, False),         # 8 frames
        ('nun_cast_windup_v2', 'nun_cast_windup.png', 2, 2, 4, False, False),   # 4 frames
        ('nun_cast_release_v2', 'nun_cast_release.png', 3, 2, 3, False, False), # 3 frames
        ('nun_cast_recovery_v2', 'nun_cast_recovery.png', 2, 4, 4, False, False), # 4 frames
        
        # Supplementary action sheets (run_start, run_stop)
        ('nun_run_start_v2', 'nun_run_start.png', 2, 2, 4, False, True),  # 4 frames with labels
        ('nun_run_stop_v2', 'nun_run_stop.png', 2, 2, 4, False, True)     # 4 frames with labels
    ]
    
    success_count = 0
    for prefix, name, rows, cols, expected, is_idle, has_labels in sheets:
        if process_sheet(prefix, name, rows, cols, expected, is_idle, has_labels):
            success_count += 1
            
    print(f"\nDone: {success_count} / {len(sheets)} processed successfully!")

if __name__ == '__main__':
    main()
