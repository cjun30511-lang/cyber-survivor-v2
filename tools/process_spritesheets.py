#!/usr/bin/env python3
"""
Spritesheet Processor - Extract individual character frames from AI-generated
sprite sheets and repackage them into proper 128x128 horizontal strip format
for Phaser consumption.

The AI generates images in grid layouts (2x3, 3x4, etc.) with varying sizes.
This script:
1. Detects individual character frames by finding connected opaque regions
2. Extracts and crops each frame
3. Scales and centers each frame into a 128x128 cell
4. Composites all frames into a single horizontal strip PNG
"""

from PIL import Image
import numpy as np
import os
import sys

FRAME_SIZE = 128
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'assets_generated', 'nun')

def find_frames(img_array, alpha_threshold=20, min_frame_size=40):
    """
    Find individual character frames in a sprite sheet by detecting
    connected regions of opaque pixels.
    
    Uses a simple approach: scan columns/rows to find gaps between characters.
    """
    # Get alpha channel
    if img_array.shape[2] == 4:
        alpha = img_array[:, :, 3]
    else:
        # No alpha - use brightness to distinguish from background
        gray = np.mean(img_array[:, :, :3], axis=2)
        # For white/light backgrounds, look for dark pixels (the character)
        bg_brightness = np.mean([
            np.mean(gray[0, :]),  # top row
            np.mean(gray[-1, :]),  # bottom row
            np.mean(gray[:, 0]),  # left col
            np.mean(gray[:, -1])  # right col
        ])
        if bg_brightness > 128:
            # Light background - invert so characters become "opaque"
            alpha = (255 - gray).astype(np.uint8)
            alpha_threshold = 60
        else:
            # Dark background
            alpha = gray.astype(np.uint8)
            alpha_threshold = 30
    
    h, w = alpha.shape
    
    # Binary mask of "has content"
    mask = alpha > alpha_threshold
    
    # Find horizontal projection (how many opaque pixels per column)
    col_projection = np.sum(mask, axis=0)
    
    # Find vertical projection (how many opaque pixels per row) 
    row_projection = np.sum(mask, axis=1)
    
    # Find column gaps (regions with no/very few opaque pixels)
    col_threshold = max(2, h * 0.01)
    col_active = col_projection > col_threshold
    
    # Find row gaps
    row_threshold = max(2, w * 0.01)
    row_active = row_projection > row_threshold
    
    # Find column segments (runs of active columns)
    col_segments = find_segments(col_active, min_size=min_frame_size)
    
    # Find row segments
    row_segments = find_segments(row_active, min_size=min_frame_size)
    
    if not col_segments or not row_segments:
        print(f"  Warning: Could not detect frame grid. col_segments={len(col_segments)}, row_segments={len(row_segments)}")
        return []
    
    print(f"  Detected grid: {len(col_segments)} columns x {len(row_segments)} rows")
    
    # Each cell in the grid is a potential frame
    frames = []
    for row_start, row_end in row_segments:
        for col_start, col_end in col_segments:
            # Check if this cell actually has content
            cell_alpha = alpha[row_start:row_end, col_start:col_end]
            if np.sum(cell_alpha > alpha_threshold) < min_frame_size * min_frame_size * 0.05:
                continue
            
            # Find tight bounding box within this cell
            cell_mask = cell_alpha > alpha_threshold
            rows_with_content = np.any(cell_mask, axis=1)
            cols_with_content = np.any(cell_mask, axis=0)
            
            if not np.any(rows_with_content) or not np.any(cols_with_content):
                continue
            
            r_start = np.argmax(rows_with_content)
            r_end = len(rows_with_content) - np.argmax(rows_with_content[::-1])
            c_start = np.argmax(cols_with_content)
            c_end = len(cols_with_content) - np.argmax(cols_with_content[::-1])
            
            # Map back to global coordinates
            bbox = (
                col_start + c_start,
                row_start + r_start,
                col_start + c_end,
                row_start + r_end
            )
            
            frame_w = bbox[2] - bbox[0]
            frame_h = bbox[3] - bbox[1]
            
            if frame_w >= min_frame_size and frame_h >= min_frame_size:
                frames.append(bbox)
    
    # Sort frames: top-to-bottom, left-to-right
    frames.sort(key=lambda f: (f[1], f[0]))
    
    print(f"  Found {len(frames)} valid frames")
    return frames


def find_segments(active_array, min_size=20, min_gap=5):
    """Find runs of True values in an array, with minimum gap for merging."""
    segments = []
    in_segment = False
    start = 0
    
    for i, val in enumerate(active_array):
        if val and not in_segment:
            start = i
            in_segment = True
        elif not val and in_segment:
            if i - start >= min_size:
                segments.append((start, i))
            in_segment = False
    
    if in_segment and len(active_array) - start >= min_size:
        segments.append((start, len(active_array)))
    
    # Merge segments that are very close together
    if len(segments) > 1:
        merged = [segments[0]]
        for seg in segments[1:]:
            if seg[0] - merged[-1][1] < min_gap:
                merged[-1] = (merged[-1][0], seg[1])
            else:
                merged.append(seg)
        segments = merged
    
    return segments


def extract_frame_to_cell(source_img, bbox, cell_size=FRAME_SIZE, padding_pct=0.05):
    """
    Extract a frame from the source image and center it in a cell_size x cell_size cell.
    The character is scaled to fill most of the cell while maintaining aspect ratio.
    """
    x1, y1, x2, y2 = bbox
    frame = source_img.crop((x1, y1, x2, y2))
    
    fw, fh = frame.size
    
    # Calculate scale to fit within cell with padding
    usable_size = int(cell_size * (1.0 - padding_pct * 2))
    scale = min(usable_size / fw, usable_size / fh)
    
    # Scale frame
    new_w = max(1, int(fw * scale))
    new_h = max(1, int(fh * scale))
    frame_scaled = frame.resize((new_w, new_h), Image.LANCZOS)
    
    # Create transparent cell
    cell = Image.new('RGBA', (cell_size, cell_size), (0, 0, 0, 0))
    
    # Center horizontally, anchor toward bottom (for top-down game, feet should be consistent)
    paste_x = (cell_size - new_w) // 2
    paste_y = cell_size - new_h - int(cell_size * 0.05)  # 5% from bottom
    
    cell.paste(frame_scaled, (paste_x, paste_y), frame_scaled if frame_scaled.mode == 'RGBA' else None)
    
    return cell


def ensure_rgba(img):
    """Convert image to RGBA, handling white backgrounds."""
    if img.mode == 'RGBA':
        return img
    
    img = img.convert('RGBA')
    data = np.array(img)
    
    # Detect if background is white/light
    corners = [
        data[0, 0, :3],
        data[0, -1, :3],
        data[-1, 0, :3],
        data[-1, -1, :3],
    ]
    avg_corner = np.mean(corners, axis=0)
    
    if avg_corner.mean() > 200:
        # White background - make it transparent
        # Use a threshold on brightness
        brightness = np.mean(data[:, :, :3], axis=2)
        # Make near-white pixels transparent
        white_mask = brightness > 240
        data[white_mask, 3] = 0
        
        # Also reduce alpha for near-white pixels (anti-alias smoothing)
        near_white_mask = (brightness > 200) & (~white_mask)
        data[near_white_mask, 3] = ((255 - brightness[near_white_mask]) * 2).clip(0, 255).astype(np.uint8)
        
        img = Image.fromarray(data)
    
    return img


def process_sheet(input_path, output_name, expected_frames, cell_size=FRAME_SIZE):
    """
    Process a single AI-generated sprite image into a proper horizontal strip.
    
    Args:
        input_path: Path to the AI-generated image
        output_name: Output filename (e.g., 'nun_idle.png')
        expected_frames: Expected number of frames
        cell_size: Size of each frame cell (128x128)
    """
    print(f"\n{'='*60}")
    print(f"Processing: {os.path.basename(input_path)} -> {output_name}")
    print(f"Expected frames: {expected_frames}")
    print(f"{'='*60}")
    
    if not os.path.exists(input_path):
        print(f"  ERROR: Input file not found: {input_path}")
        return False
    
    # Load and convert to RGBA
    img = Image.open(input_path)
    img = ensure_rgba(img)
    img_array = np.array(img)
    
    print(f"  Source image size: {img.width}x{img.height}, mode: {img.mode}")
    
    # Detect frames
    frames = find_frames(img_array)
    
    if len(frames) == 0:
        print(f"  ERROR: No frames detected!")
        return False
    
    # If we got more frames than expected, take the best ones
    # If we got fewer, pad with last frame
    actual_count = min(len(frames), expected_frames)
    
    if len(frames) > expected_frames:
        print(f"  Note: Got {len(frames)} frames, taking first {expected_frames}")
        frames = frames[:expected_frames]
    elif len(frames) < expected_frames:
        print(f"  Note: Got {len(frames)} frames, padding to {expected_frames} by repeating last frame")
        while len(frames) < expected_frames:
            frames.append(frames[-1])
    
    # Extract each frame and build the horizontal strip
    strip_width = cell_size * expected_frames
    strip = Image.new('RGBA', (strip_width, cell_size), (0, 0, 0, 0))
    
    for i, bbox in enumerate(frames):
        print(f"  Frame {i+1}: bbox=({bbox[0]},{bbox[1]})-({bbox[2]},{bbox[3]}), size={bbox[2]-bbox[0]}x{bbox[3]-bbox[1]}")
        cell = extract_frame_to_cell(img, bbox, cell_size)
        strip.paste(cell, (i * cell_size, 0))
    
    # Save output
    output_path = os.path.join(OUTPUT_DIR, output_name)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    strip.save(output_path, 'PNG')
    
    file_size = os.path.getsize(output_path)
    print(f"  ✅ Saved: {output_path} ({strip_width}x{cell_size}, {file_size} bytes)")
    return True


def main():
    """Process all available generated sprite sheets."""
    # Artifact directory where generate_image saves files
    artifact_dir = '/Users/shenjun8676/.gemini/antigravity/brain/dae1de1e-74a6-46a7-944b-bdfb2b33c3a4'
    
    # Map of generated image names to their output specs
    # Format: (glob_pattern_in_artifact_dir, output_name, expected_frames)
    sheets_to_process = [
        ('nun_idle_v2', 'nun_idle.png', 6),
        ('nun_run_v2', 'nun_run.png', 8),
        ('nun_cast_windup_v2', 'nun_cast_windup.png', 4),
        ('nun_cast_release_v2', 'nun_cast_release.png', 3),
        ('nun_cast_recovery_v2', 'nun_cast_recovery.png', 4),
        ('nun_hit_v2', 'nun_hit.png', 3),
        ('nun_death_v2', 'nun_death.png', 10),
    ]
    
    # Find the actual file for each sheet (they have timestamp suffixes)
    success_count = 0
    fail_count = 0
    
    for prefix, output_name, expected_frames in sheets_to_process:
        # Find the generated file
        matching_files = []
        for fname in os.listdir(artifact_dir):
            if fname.startswith(prefix) and fname.endswith('.png'):
                matching_files.append(os.path.join(artifact_dir, fname))
        
        if not matching_files:
            print(f"\n⚠️ No generated image found for '{prefix}', skipping {output_name}")
            fail_count += 1
            continue
        
        # Use the most recent one
        matching_files.sort()
        input_path = matching_files[-1]
        
        if process_sheet(input_path, output_name, expected_frames):
            success_count += 1
        else:
            fail_count += 1
    
    print(f"\n{'='*60}")
    print(f"Processing complete: {success_count} succeeded, {fail_count} failed/skipped")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()
