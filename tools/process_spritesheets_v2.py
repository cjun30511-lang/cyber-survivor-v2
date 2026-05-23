#!/usr/bin/env python3
"""
Spritesheet Processor V2 - Uses connected component labeling for reliable
frame detection from AI-generated sprite images.
"""

from PIL import Image
import numpy as np
from collections import defaultdict
import os

FRAME_SIZE = 128
OUTPUT_DIR = '/Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2/assets_generated/nun'
ARTIFACT_DIR = '/Users/shenjun8676/.gemini/antigravity/brain/dae1de1e-74a6-46a7-944b-bdfb2b33c3a4'


def detect_background_color(img_array):
    """Detect if background is predominantly black or white."""
    h, w = img_array.shape[:2]
    # Sample border pixels
    border_pixels = np.concatenate([
        img_array[0, :, :3],      # top row
        img_array[-1, :, :3],     # bottom row
        img_array[:, 0, :3],      # left col
        img_array[:, -1, :3],     # right col
    ])
    avg_brightness = np.mean(border_pixels)
    return 'white' if avg_brightness > 128 else 'black'


def create_content_mask(img_array, bg_type):
    """Create a binary mask of pixels that contain character content."""
    if img_array.shape[2] == 4:
        alpha = img_array[:, :, 3]
        if bg_type == 'black':
            # For black bg with alpha, use both alpha and brightness
            brightness = np.mean(img_array[:, :, :3], axis=2)
            mask = (alpha > 15) & (brightness > 10)
        else:
            mask = alpha > 15
    else:
        brightness = np.mean(img_array[:, :, :3], axis=2)
        if bg_type == 'white':
            mask = brightness < 230
        else:
            mask = brightness > 20
    return mask


def find_frames_cc(mask, min_area=500, expected_count=None):
    """
    Find individual character frames using a simple flood-fill connected 
    component approach with morphological operations for robustness.
    """
    from scipy import ndimage
    
    # Dilate mask slightly to connect nearby pixels (e.g., staff above head)
    struct = np.ones((5, 5))
    dilated = ndimage.binary_dilation(mask, structure=struct, iterations=3)
    
    # Label connected components
    labeled, num_features = ndimage.label(dilated)
    
    if num_features == 0:
        return []
    
    # Get bounding boxes from the ORIGINAL mask (not dilated)
    # but use the dilated labels for grouping
    bboxes = []
    for i in range(1, num_features + 1):
        component_mask = labeled == i
        # Use original mask within this component area to get tight bbox
        content_in_component = mask & component_mask
        
        rows = np.any(content_in_component, axis=1)
        cols = np.any(content_in_component, axis=0)
        
        if not np.any(rows) or not np.any(cols):
            continue
        
        r_min = np.argmax(rows)
        r_max = len(rows) - np.argmax(rows[::-1])
        c_min = np.argmax(cols)
        c_max = len(cols) - np.argmax(cols[::-1])
        
        area = np.sum(content_in_component)
        
        if area >= min_area:
            bboxes.append({
                'x1': c_min, 'y1': r_min,
                'x2': c_max, 'y2': r_max,
                'area': area,
                'w': c_max - c_min,
                'h': r_max - r_min
            })
    
    # Sort by position: left-to-right, top-to-bottom
    # Group by approximate rows first
    if bboxes:
        bboxes.sort(key=lambda b: b['y1'])
        
        # Group into rows (bboxes with similar y positions)
        rows = []
        current_row = [bboxes[0]]
        for b in bboxes[1:]:
            # If the vertical center is within 40% of the height of the first item
            ref_center = (current_row[0]['y1'] + current_row[0]['y2']) / 2
            b_center = (b['y1'] + b['y2']) / 2
            threshold = max(current_row[0]['h'], b['h']) * 0.4
            
            if abs(b_center - ref_center) < threshold:
                current_row.append(b)
            else:
                rows.append(current_row)
                current_row = [b]
        rows.append(current_row)
        
        # Sort each row left-to-right
        sorted_bboxes = []
        for row in rows:
            row.sort(key=lambda b: b['x1'])
            sorted_bboxes.extend(row)
        bboxes = sorted_bboxes
    
    # Filter tiny components (noise) - keep only those with area > median * 0.1
    if len(bboxes) > 1:
        median_area = np.median([b['area'] for b in bboxes])
        bboxes = [b for b in bboxes if b['area'] > median_area * 0.1]
    
    return [(b['x1'], b['y1'], b['x2'], b['y2']) for b in bboxes]


def find_frames_grid(img_array, mask, expected_count):
    """
    Fallback: divide the image into a grid based on expected count.
    Try common grid arrangements that match the expected frame count.
    """
    h, w = img_array.shape[:2]
    
    # Try common arrangements
    arrangements = []
    for cols in range(1, expected_count + 1):
        if expected_count % cols == 0:
            rows = expected_count // cols
            arrangements.append((rows, cols))
    
    # Prefer arrangements closer to square
    arrangements.sort(key=lambda rc: abs(rc[0] - rc[1]))
    
    for rows, cols in arrangements:
        cell_w = w // cols
        cell_h = h // rows
        
        frames = []
        for r in range(rows):
            for c in range(cols):
                x1 = c * cell_w
                y1 = r * cell_h
                x2 = (c + 1) * cell_w
                y2 = (r + 1) * cell_h
                
                # Check if cell has content
                cell_mask = mask[y1:y2, x1:x2]
                if np.sum(cell_mask) > 100:
                    # Find tight bbox within cell
                    rows_with = np.any(cell_mask, axis=1)
                    cols_with = np.any(cell_mask, axis=0)
                    if np.any(rows_with) and np.any(cols_with):
                        cr_min = np.argmax(rows_with)
                        cr_max = len(rows_with) - np.argmax(rows_with[::-1])
                        cc_min = np.argmax(cols_with)
                        cc_max = len(cols_with) - np.argmax(cols_with[::-1])
                        frames.append((x1 + cc_min, y1 + cr_min, x1 + cc_max, y1 + cr_max))
        
        if len(frames) >= expected_count:
            return frames[:expected_count]
    
    return []


def ensure_rgba_transparent(img):
    """Convert image to RGBA with proper background removal."""
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    data = np.array(img)
    bg_type = detect_background_color(data)
    
    if bg_type == 'white':
        # Make white/near-white pixels transparent
        brightness = np.mean(data[:, :, :3], axis=2)
        white_mask = brightness > 240
        data[white_mask, 3] = 0
        # Smooth transition for near-white
        near_white = (brightness > 200) & (~white_mask)
        data[near_white, 3] = ((255 - brightness[near_white]) * 3).clip(0, 255).astype(np.uint8)
        img = Image.fromarray(data)
    
    return img, bg_type


def extract_frame_to_cell(source_img, bbox, cell_size=FRAME_SIZE, padding_pct=0.04):
    """Extract a frame and center it in a cell_size x cell_size cell."""
    x1, y1, x2, y2 = bbox
    frame = source_img.crop((x1, y1, x2, y2))
    
    fw, fh = frame.size
    
    # Scale to fit within cell with padding
    usable_size = int(cell_size * (1.0 - padding_pct * 2))
    scale = min(usable_size / fw, usable_size / fh)
    
    new_w = max(1, int(fw * scale))
    new_h = max(1, int(fh * scale))
    frame_scaled = frame.resize((new_w, new_h), Image.LANCZOS)
    
    # Create transparent cell
    cell = Image.new('RGBA', (cell_size, cell_size), (0, 0, 0, 0))
    
    # Center horizontally, anchor toward bottom
    paste_x = (cell_size - new_w) // 2
    paste_y = cell_size - new_h - int(cell_size * 0.04)
    
    cell.paste(frame_scaled, (paste_x, paste_y), frame_scaled if frame_scaled.mode == 'RGBA' else None)
    
    return cell


def process_sheet(input_path, output_name, expected_frames, cell_size=FRAME_SIZE):
    """Process a single AI-generated sprite image into a horizontal strip."""
    print(f"\n{'='*60}")
    print(f"Processing: {os.path.basename(input_path)} -> {output_name}")
    print(f"Expected frames: {expected_frames}")
    print(f"{'='*60}")
    
    if not os.path.exists(input_path):
        print(f"  ERROR: Input file not found: {input_path}")
        return False
    
    img = Image.open(input_path)
    img, bg_type = ensure_rgba_transparent(img)
    img_array = np.array(img)
    
    print(f"  Source: {img.width}x{img.height}, background: {bg_type}")
    
    # Create content mask
    mask = create_content_mask(img_array, bg_type)
    
    # Try connected component detection first
    try:
        frames = find_frames_cc(mask, min_area=200, expected_count=expected_frames)
        print(f"  CC detection found {len(frames)} frames")
    except ImportError:
        print(f"  scipy not available, falling back to grid detection")
        frames = []
    
    # If CC detection got too few or too many, try grid fallback  
    if len(frames) < expected_frames:
        print(f"  CC found {len(frames)}, trying grid fallback for {expected_frames}")
        grid_frames = find_frames_grid(img_array, mask, expected_frames)
        if len(grid_frames) >= expected_frames:
            frames = grid_frames
            print(f"  Grid detection found {len(frames)} frames")
    
    if len(frames) == 0:
        print(f"  ERROR: No frames detected!")
        return False
    
    # Adjust frame count
    if len(frames) > expected_frames:
        print(f"  Taking first {expected_frames} of {len(frames)} frames")
        frames = frames[:expected_frames]
    elif len(frames) < expected_frames:
        print(f"  Padding {len(frames)} frames to {expected_frames}")
        while len(frames) < expected_frames:
            frames.append(frames[-1])
    
    # Build horizontal strip
    strip_width = cell_size * expected_frames
    strip = Image.new('RGBA', (strip_width, cell_size), (0, 0, 0, 0))
    
    for i, bbox in enumerate(frames):
        bw = bbox[2] - bbox[0]
        bh = bbox[3] - bbox[1]
        print(f"  Frame {i+1}: ({bbox[0]},{bbox[1]})-({bbox[2]},{bbox[3]}) {bw}x{bh}")
        cell = extract_frame_to_cell(img, bbox, cell_size)
        strip.paste(cell, (i * cell_size, 0))
    
    output_path = os.path.join(OUTPUT_DIR, output_name)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    strip.save(output_path, 'PNG')
    
    fsize = os.path.getsize(output_path)
    print(f"  ✅ Saved: {output_path} ({strip_width}x{cell_size}, {fsize} bytes)")
    return True


def find_latest_artifact(prefix):
    """Find the most recent generated image with the given prefix."""
    matching = []
    for fname in os.listdir(ARTIFACT_DIR):
        if fname.startswith(prefix) and fname.endswith('.png'):
            matching.append(os.path.join(ARTIFACT_DIR, fname))
    matching.sort()
    return matching[-1] if matching else None


def main():
    sheets = [
        ('nun_idle_v2', 'nun_idle.png', 6),
        ('nun_run_v2', 'nun_run.png', 8),
        ('nun_cast_windup_v2', 'nun_cast_windup.png', 4),
        ('nun_cast_release_v2', 'nun_cast_release.png', 3),
        ('nun_cast_recovery_v2', 'nun_cast_recovery.png', 4),
        ('nun_hit_v2', 'nun_hit.png', 3),
        ('nun_death_v2', 'nun_death.png', 10),
    ]
    
    ok = 0
    fail = 0
    
    for prefix, output_name, expected in sheets:
        path = find_latest_artifact(prefix)
        if not path:
            print(f"\n⚠️ No image found for '{prefix}', skipping {output_name}")
            fail += 1
            continue
        
        if process_sheet(path, output_name, expected):
            ok += 1
        else:
            fail += 1
    
    print(f"\n{'='*60}")
    print(f"Done: {ok} succeeded, {fail} failed/skipped")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()
