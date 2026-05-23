import os
import math
import sys

def main():
    print("🎨 启动角色动作序列帧离线生成程序...")
    try:
        from PIL import Image, ImageChops
    except ImportError:
        print("⚠️ 未检测到 PIL 库，正在尝试使用 pip 安装 Pillow...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
        from PIL import Image, ImageChops

    base_dir = '/Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2'
    source_path = os.path.join(base_dir, 'assets_generated/nun/nun_topdown_ingame_transparent.png')
    
    if not os.path.exists(source_path):
        print(f"❌ 找不到基础材质: {source_path}")
        return

    # 1. 打开基础材质
    img = Image.open(source_path).convert("RGBA")
    
    # 2. 自动裁剪透明边界以获得最小包围盒
    bg = Image.new("RGBA", img.size, (0, 0, 0, 0))
    diff = ImageChops.difference(img, bg)
    bbox = diff.getbbox()
    if not bbox:
        print("❌ 错误: 材质完全透明！")
        return
        
    # 给裁剪边界留出一点点 padding
    padding = 12
    min_x = max(0, bbox[0] - padding)
    min_y = max(0, bbox[1] - padding)
    max_x = min(img.width, bbox[2] + padding)
    max_y = min(img.height, bbox[3] + padding)
    
    trimmed_img = img.crop((min_x, min_y, max_x, max_y))
    w, h = trimmed_img.size
    print(f"✂️ 材质已裁剪: {img.size} -> {trimmed_img.size}")

    # 计算缩放比例：将角色高度缩放为 84 像素以在 128x128 帧中获得完美显示大小
    target_h = 84
    scale = target_h / h
    target_w = int(w * scale)
    scaled_img = trimmed_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    tw, th = scaled_img.size
    print(f"📐 缩放后帧尺寸: {tw}x{th}")

    def create_spritesheet(filename, frame_count, draw_frame_fn):
        sheet_w = 128 * frame_count
        sheet_h = 128
        sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

        for i in range(frame_count):
            frame = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
            draw_frame_fn(frame, i, tw, th, scaled_img)
            sheet.paste(frame, (i * 128, 0))
            
        out_path = os.path.join(base_dir, f'assets_generated/nun/{filename}')
        sheet.save(out_path, "PNG")
        print(f"✅ 已成功输出物理序列帧材质: {out_path} ({sheet_w}x{sheet_h})")

    # 1. Idle Spritesheet (6帧) - 呼吸起伏与上下浮动
    def draw_idle(frame, i, tw, th, char):
        phase = (i / 6.0) * math.pi * 2.0
        bob_y = int(math.sin(phase) * 2.0)
        scale_x = 1.0 + math.sin(phase) * 0.015
        scale_y = 1.0 - math.sin(phase) * 0.015
        
        # 呼吸缩放
        rw, rh = int(tw * scale_x), int(th * scale_y)
        resized_char = char.resize((rw, rh), Image.Resampling.LANCZOS)
        
        # 居中对齐底座 (64, 100)
        px = 64 - rw // 2
        py = 100 - rh + bob_y
        frame.paste(resized_char, (px, py), resized_char)

    create_spritesheet("nun_idle.png", 6, draw_idle)

    # 2. Run Spritesheet (8帧) - 身体前倾，双倍步频颠簸，下肢正弦 Skew 剪切模拟踏步
    def draw_run(frame, i, tw, th, char):
        phase = (i / 8.0) * math.pi * 2.0
        bob_y = int(math.sin(phase * 2.0) * 2.5) # 双倍步频颠簸
        
        # 身体前倾：旋转 6 度
        rotated_char = char.rotate(6, Image.Resampling.BICUBIC, expand=True)
        rcw, rch = rotated_char.size
        
        # 分割上下半身，下肢进行剪切
        # 裙摆高度约为角色的底部 25% 区域
        skirt_h = int(rch * 0.25)
        body_h = rch - skirt_h
        
        body = rotated_char.crop((0, 0, rcw, body_h))
        skirt = rotated_char.crop((0, body_h, rcw, rch))
        
        # 对裙摆下肢应用水平剪切剪切 (Horizontal Skew)
        skew_val = math.sin(phase) * 0.14
        # PIL transform 仿射矩阵: a, b, c, d, e, f -> x' = ax + by + c, y' = dx + ey + f
        # 水平剪切: x' = x + skew_val * y
        matrix = (1, skew_val, 0, 0, 1, 0)
        skewed_skirt = skirt.transform(
            (int(rcw + abs(skew_val) * skirt_h), skirt_h),
            Image.Transform.AFFINE,
            matrix,
            Image.Resampling.BICUBIC
        )
        
        # 重新组合上下半身
        merged = Image.new("RGBA", (max(rcw, skewed_skirt.width), rch), (0, 0, 0, 0))
        merged.paste(body, (0, 0), body)
        merged.paste(skewed_skirt, (0, body_h), skewed_skirt)
        
        # 缩放到目标大小
        mw = int(merged.width * (target_h / rch))
        mh = target_h
        final_char = merged.resize((mw, mh), Image.Resampling.LANCZOS)
        
        px = 64 - mw // 2
        py = 100 - mh + bob_y
        frame.paste(final_char, (px, py), final_char)

    create_spritesheet("nun_run.png", 8, draw_run)

    # 3. Cast Windup (4帧) - 升空蓄力，纵向拉伸
    def draw_cast_windup(frame, i, tw, th, char):
        p = i / 3.0
        scale_x = 1.0 - p * 0.08
        scale_y = 1.0 + p * 0.15
        bob_y = int(-p * 8.0)
        
        rw, rh = int(tw * scale_x), int(th * scale_y)
        resized_char = char.resize((rw, rh), Image.Resampling.LANCZOS)
        
        px = 64 - rw // 2
        py = 100 - rh + bob_y
        frame.paste(resized_char, (px, py), resized_char)

    create_spritesheet("nun_cast_windup.png", 4, draw_cast_windup)

    # 4. Cast Release (3帧) - 重力下砸压扁，开火反冲
    def draw_cast_release(frame, i, tw, th, char):
        p = i / 2.0
        scale_x = 1.2 - p * 0.1
        scale_y = 0.75 + p * 0.15
        bob_y = int(6.0 - p * 4.0)
        
        rw, rh = int(tw * scale_x), int(th * scale_y)
        resized_char = char.resize((rw, rh), Image.Resampling.LANCZOS)
        
        px = 64 - rw // 2
        py = 100 - rh + bob_y
        frame.paste(resized_char, (px, py), resized_char)

    create_spritesheet("nun_cast_release.png", 3, draw_cast_release)

    # 5. Cast Recovery (4帧) - 渐进恢复平稳
    def draw_cast_recovery(frame, i, tw, th, char):
        p = i / 3.0
        scale_x = 1.1 - p * 0.1
        scale_y = 0.9 + p * 0.1
        bob_y = int(2.0 - p * 2.0)
        
        rw, rh = int(tw * scale_x), int(th * scale_y)
        resized_char = char.resize((rw, rh), Image.Resampling.LANCZOS)
        
        px = 64 - rw // 2
        py = 100 - rh + bob_y
        frame.paste(resized_char, (px, py), resized_char)

    create_spritesheet("nun_cast_recovery.png", 4, draw_cast_recovery)

    # 6. Hit (3帧) - 后仰受击
    def draw_hit(frame, i, tw, th, char):
        if i == 0:
            rotated = char.rotate(-12, Image.Resampling.BICUBIC, expand=True)
            rw, rh = int(rotated.width * 1.15), int(rotated.height * 0.85)
            resized = rotated.resize((rw, rh), Image.Resampling.LANCZOS)
        elif i == 1:
            rotated = char.rotate(-6, Image.Resampling.BICUBIC, expand=True)
            rw, rh = int(rotated.width * 1.05), int(rotated.height * 0.95)
            resized = rotated.resize((rw, rh), Image.Resampling.LANCZOS)
        else:
            rw, rh = tw, th
            resized = char
            
        px = 64 - rw // 2
        py = 100 - rh
        frame.paste(resized, (px, py), resized)

    create_spritesheet("nun_hit.png", 3, draw_hit)

    # 7. Death (10帧) - 颤抖后拉伸渐隐化雾
    def draw_death(frame, i, tw, th, char):
        if i < 3:
            shiver_x = int((i % 2 * 2 - 1) * 2)
            shiver_y = int(((i // 2) % 2 * 2 - 1) * 2)
            px = 64 - tw // 2 + shiver_x
            py = 100 - th + shiver_y
            frame.paste(char, (px, py), char)
        else:
            p = (i - 3) / 7.0
            scale_x = 1.0 - p * 0.3
            scale_y = 1.0 + p * 0.6
            bob_y = int(-p * 30.0)
            alpha = int((1.0 - p) * 255)
            
            rw, rh = int(tw * scale_x), int(th * scale_y)
            resized = char.resize((rw, rh), Image.Resampling.LANCZOS)
            
            # 渐隐处理
            r, g, b, a = resized.split()
            a = a.point(lambda x: int(x * (1.0 - p)))
            resized_alpha = Image.merge("RGBA", (r, g, b, a))
            
            px = 64 - rw // 2
            py = 100 - rh + bob_y
            frame.paste(resized_alpha, (px, py), resized_alpha)

    create_spritesheet("nun_death.png", 10, draw_death)
    print("🎉 角色动作序列帧离线生成完毕！")

if __name__ == '__main__':
    main()
