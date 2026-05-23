import os
import base64
from PIL import Image
from io import BytesIO

base_dir = '/Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2'

def check_b64_dimensions(b64_path):
    if not os.path.exists(b64_path):
        # try relative to base_dir
        b64_path = os.path.join(base_dir, b64_path)
    if not os.path.exists(b64_path):
        print(f"File not found: {b64_path}")
        return
    with open(b64_path, 'r') as f:
        data = f.read().strip()
    if data.startswith('data:image/'):
        data = data.split(',', 1)[1]
    img_data = base64.b64decode(data)
    img = Image.open(BytesIO(img_data))
    print(f"{os.path.basename(b64_path)}: {img.size[0]}x{img.size[1]} px")

def check_png_dimensions(png_path):
    if not os.path.exists(png_path):
        png_path = os.path.join(base_dir, png_path)
    if not os.path.exists(png_path):
        print(f"File not found: {png_path}")
        return
    img = Image.open(png_path)
    print(f"{os.path.basename(png_path)}: {img.size[0]}x{img.size[1]} px")

print("Checking enemy and player asset dimensions:")
check_b64_dimensions('../cyber_survivor/skeleton_new_processed.png.b64.txt')
check_b64_dimensions('../cyber_survivor/ghost_caster_processed.png.b64.txt')
check_b64_dimensions('../cyber_survivor/boss_new_processed.png.b64.txt')
check_png_dimensions('assets_generated/knight/knight_topdown_ingame_transparent.png')
check_png_dimensions('assets_generated/nun/nun_idle.png')
check_png_dimensions('assets_generated/nun/nun_run.png')
