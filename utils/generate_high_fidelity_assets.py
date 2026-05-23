import os
import math
import sys

def main():
    print("🎨 启动高质量 2.5D 角色动作图集离线渲染引擎...")
    try:
        from PIL import Image, ImageChops, ImageFilter
    except ImportError:
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
        from PIL import Image, ImageChops, ImageFilter

    base_dir = '/Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2'
    source_path = os.path.join(base_dir, 'assets_generated/nun/nun_topdown_ingame_transparent.png')
    
    if not os.path.exists(source_path):
        print(f"❌ 找不到手绘原图: {source_path}")
        return

    # 1. 加载并裁剪手绘原图以获取紧凑包围盒
    img = Image.open(source_path).convert("RGBA")
    bg = Image.new("RGBA", img.size, (0, 0, 0, 0))
    diff = ImageChops.difference(img, bg)
    bbox = diff.getbbox()
    if not bbox:
        print("❌ 错误: 材质完全透明！")
        return
        
    trimmed = img.crop(bbox)
    tw, th = trimmed.size
    print(f"✂️ 成功载入手绘原图，尺寸: {tw}x{th}")

    # 2. 剥离并裁剪高精度图层组件 (Slicing Layers)
    # 头兜帽 (Y: 0% -> 38%)
    head_raw = trimmed.crop((int(tw * 0.15), 0, int(tw * 0.8), int(th * 0.38)))
    # 铠甲躯干 (Y: 32% -> 70%)
    torso_raw = trimmed.crop((int(tw * 0.25), int(th * 0.30), int(tw * 0.72), int(th * 0.70)))
    # 披风裙摆 (Y: 28% -> 85%)
    cloak_raw = trimmed.crop((int(tw * 0.05), int(th * 0.25), int(tw * 0.95), int(th * 0.85)))
    # 双腿靴子 (Y: 68% -> 100%)
    legs_raw = trimmed.crop((int(tw * 0.32), int(th * 0.68), int(tw * 0.68), th))

    # 3. 剥离熔岩圣杖 (Staff) - 并在顶部绘制发光高温核心
    staff_raw = Image.new("RGBA", (100, 200), (0, 0, 0, 0))
    draw_s = Image.new("RGBA", (100, 200), (0, 0, 0, 0))
    from PIL import ImageDraw
    s_draw = ImageDraw.Draw(draw_s)
    # 绘制高保真金属/木制法杖柄 (有黄金/黑铁质感)
    s_draw.line([(50, 200), (50, 45)], fill=(74, 44, 17, 255), width=4)
    s_draw.line([(50, 45), (50, 25)], fill=(154, 15, 15, 255), width=6) # 杖尖香炉扣
    # 绘制外圈高能熔岩光环
    for r in range(15, 1, -2):
        alpha = int((1.0 - r / 15.0) * 160)
        s_draw.ellipse([(50 - r, 30 - r), (50 + r, 30 + r)], fill=(255, 165, 0, alpha))
    # 高温核心
    s_draw.ellipse([(46, 26), (54, 34)], fill=(255, 255, 255, 255))
    staff_raw = Image.alpha_composite(staff_raw, draw_s)

    # 4. 图层大小自适应缩放：将各组件高度规范到 Phaser 局内 84px 显示尺寸
    scale = 84.0 / th
    def scale_layer(img_layer):
        lw, lh = img_layer.size
        return img_layer.resize((int(lw * scale), int(lh * scale)), Image.Resampling.LANCZOS)

    head = scale_layer(head_raw)
    torso = scale_layer(torso_raw)
    cloak = scale_layer(cloak_raw)
    legs = scale_layer(legs_raw)
    staff = staff_raw.resize((int(32 * scale * 1.5), int(64 * scale * 1.5)), Image.Resampling.LANCZOS)

    print("🚀 高解析度手绘动作组件库已就绪，启动动态重组流程...")

    def create_high_fidelity_sheet(filename, frame_count, draw_frame_fn):
        sheet_w = 128 * frame_count
        sheet_h = 128
        sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

        for i in range(frame_count):
            frame = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
            draw_frame_fn(frame, i)
            sheet.paste(frame, (i * 128, 0))

        out_path = os.path.join(base_dir, f'assets_generated/nun/{filename}')
        sheet.save(out_path, "PNG")
        print(f"✨ 高清动作图集已就位: {out_path} ({sheet_w}x{sheet_h})")

    # A. 动作 1：Idle (6帧) - 高清浮空待机，两条腿浮动，披风飘荡
    def draw_idle(frame, i):
        phase = (i / 6.0) * math.pi * 2.0
        bob_y = math.sin(phase) * 2.2
        scale_y = 1.0 - math.sin(phase) * 0.02
        
        # 1. 脚底半透明接地软投影
        draw = ImageDraw.Draw(frame)
        draw.ellipse([(64 - 18, 100 - 3), (64 + 18, 100 + 3)], fill=(0, 0, 0, 75))

        # 2. 绘制双脚 (微幅Y轴浮动)
        frame.alpha_composite(legs, (64 - legs.width // 2, int(100 - legs.height + bob_y * 0.5)))

        # 3. 待机浮动的披风/法袍 (Y轴轻微缩放)
        cw, ch = int(cloak.width), int(cloak.height * scale_y)
        r_cloak = cloak.resize((cw, ch), Image.Resampling.LANCZOS)
        frame.alpha_composite(r_cloak, (64 - cw // 2, int(94 - ch + bob_y)))

        # 4. 躯干
        tw_val, th_val = int(torso.width), int(torso.height * scale_y)
        r_torso = torso.resize((tw_val, th_val), Image.Resampling.LANCZOS)
        frame.alpha_composite(r_torso, (64 - tw_val // 2, int(86 - th_val + bob_y)))

        # 5. 头部
        frame.alpha_composite(head, (64 - head.width // 2, int(52 - head.height + bob_y)))

        # 6. 右侧悬浮圣杖
        r_staff = staff.rotate(int(math.sin(phase) * 6), Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(r_staff, (78 - r_staff.width // 2, int(72 - r_staff.height + bob_y)))

    create_high_fidelity_sheet("nun_idle.png", 6, draw_idle)

    # B. 动作 2：Run (8帧) - 真正的跑动大迈步！双腿前后大范围跨步旋转，披风后摆折叠，前倾10度
    def draw_run(frame, i):
        phase = (i / 8.0) * math.pi * 2.0
        bob_y = math.sin(phase * 2.0) * 3.0  # 双倍步频颠簸
        
        draw = ImageDraw.Draw(frame)
        draw.ellipse([(64 - 22, 100 - 4), (64 + 22, 100 + 4)], fill=(0, 0, 0, 95))

        # 真正的两条腿：正弦大角度交替蹬地摆动！(Leg angles 呈 +-24 度)
        angle_L = math.sin(phase) * 24
        angle_R = -math.sin(phase) * 24
        
        # 旋转并绘制左腿/大腿
        l_leg = legs.rotate(angle_L, Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(l_leg, (60 - l_leg.width // 2, int(98 - l_leg.height + bob_y)))
        
        # 旋转并绘制右腿/大腿
        r_leg = legs.rotate(angle_R, Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(r_leg, (68 - r_leg.width // 2, int(98 - r_leg.height + bob_y)))

        # 跑动向后大摆幅飘荡的披风
        r_cloak = cloak.rotate(10, Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(r_cloak, (52 - r_cloak.width // 2, int(90 - r_cloak.height + bob_y)))

        # 前倾 8 度的铠甲躯干
        r_torso = torso.rotate(8, Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(r_torso, (64 - r_torso.width // 2, int(86 - r_torso.height + bob_y)))

        # 头部
        r_head = head.rotate(4, Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(r_head, (65 - r_head.width // 2, int(54 - r_head.height + bob_y)))

        # 圣杖随跑步前后大范围拉扯摆动
        r_staff = staff.rotate(15 + int(math.sin(phase) * 12), Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(r_staff, (78 + int(math.sin(phase) * 4) - r_staff.width // 2, int(70 - r_staff.height + bob_y)))

    create_high_fidelity_sheet("nun_run.png", 8, draw_run)

    # C. 动作 3：Cast Windup (4帧) - 施法升空蓄力，权杖高举过头顶
    def draw_cast_windup(frame, i):
        p = i / 3.0
        bob_y = -p * 12.0  # 飞升悬空
        scale_y = 1.0 + p * 0.12 # 纵向拉伸
        
        draw = ImageDraw.Draw(frame)
        draw.ellipse([(64 - 12, 100 - 3), (64 + 12, 100 + 3)], fill=(0, 0, 0, 45))

        # 双腿自然下垂拉直
        frame.alpha_composite(legs, (64 - legs.width // 2, int(100 - legs.height + bob_y * 0.6)))

        # 披风随升空魔法气流向上飞舞
        cw, ch = int(cloak.width), int(cloak.height * scale_y)
        r_cloak = cloak.resize((cw, ch), Image.Resampling.LANCZOS)
        frame.alpha_composite(r_cloak, (64 - cw // 2, int(94 - ch + bob_y)))

        # 躯干
        tw_val, th_val = int(torso.width), int(torso.height * scale_y)
        r_torso = torso.resize((tw_val, th_val), Image.Resampling.LANCZOS)
        frame.alpha_composite(r_torso, (64 - tw_val // 2, int(86 - th_val + bob_y)))

        # 头部
        frame.alpha_composite(head, (64 - head.width // 2, int(52 - head.height + bob_y)))

        # 右手臂托举：权杖高高举过头顶 (旋转 65 度，发生蓄力共振颤抖)
        tremble = 1 if (i % 2 == 0) else -1
        r_staff = staff.rotate(35 + int(p * 55) + tremble, Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(r_staff, (72 - r_staff.width // 2, int(56 - r_staff.height + bob_y)))

    create_high_fidelity_sheet("nun_cast_windup.png", 4, draw_cast_windup)

    # D. 动作 4：Cast Release (3帧) - 施法下砸释放，单膝跪地，杖尖前砸
    def draw_cast_release(frame, i):
        p = i / 2.0
        bob_y = 6.0 - p * 4.0 # 瞬间落地砸下
        scale_y = 0.78 + p * 0.15 # 下砸压扁
        
        draw = ImageDraw.Draw(frame)
        draw.ellipse([(64 - 24, 100 - 5), (64 + 24, 100 + 5)], fill=(0, 0, 0, 130))

        # 双腿做单膝大角度弯曲下蹲/下跪支撑姿态
        l_leg = legs.rotate(-35, Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(l_leg, (58 - l_leg.width // 2, int(98 - l_leg.height + bob_y)))
        
        r_leg = legs.rotate(30, Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(r_leg, (70 - r_leg.width // 2, int(98 - r_leg.height + bob_y)))

        # 披风朝前方低垂倾覆
        cw, ch = int(cloak.width), int(cloak.height * scale_y)
        r_cloak = cloak.resize((cw, ch), Image.Resampling.LANCZOS)
        frame.alpha_composite(r_cloak, (64 - cw // 2, int(94 - ch + bob_y)))

        # 躯干
        tw_val, th_val = int(torso.width), int(torso.height * scale_y)
        r_torso = torso.resize((tw_val, th_val), Image.Resampling.LANCZOS)
        frame.alpha_composite(r_torso, (64 - tw_val // 2, int(86 - th_val + bob_y)))

        # 头部
        frame.alpha_composite(head, (64 - head.width // 2, int(52 - head.height + bob_y)))

        # 右手臂全力朝前挥砍：权杖前砸至 95 度，释放高能法术
        r_staff = staff.rotate(95 - int(p * 45), Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(r_staff, (82 - r_staff.width // 2, int(72 - r_staff.height + bob_y)))

    create_high_fidelity_sheet("nun_cast_release.png", 3, draw_cast_release)

    # E. 动作 5：Cast Recovery (4帧) - 施法完美平稳收尾恢复
    def draw_cast_recovery(frame, i):
        p = i / 3.0
        bob_y = 2.0 - p * 2.0
        scale_y = 0.93 + p * 0.07
        
        draw = ImageDraw.Draw(frame)
        draw.ellipse([(64 - 18, 100 - 4), (64 + 18, 100 + 4)], fill=(0, 0, 0, 75))

        # 双膝站立起立恢复
        l_leg = legs.rotate(int(-10 * (1-p)), Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(l_leg, (60 - l_leg.width // 2, int(98 - l_leg.height + bob_y)))
        
        r_leg = legs.rotate(int(10 * (1-p)), Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(r_leg, (68 - r_leg.width // 2, int(98 - r_leg.height + bob_y)))

        cw, ch = int(cloak.width), int(cloak.height * scale_y)
        r_cloak = cloak.resize((cw, ch), Image.Resampling.LANCZOS)
        frame.alpha_composite(r_cloak, (64 - cw // 2, int(94 - ch + bob_y)))

        tw_val, th_val = int(torso.width), int(torso.height * scale_y)
        r_torso = torso.resize((tw_val, th_val), Image.Resampling.LANCZOS)
        frame.alpha_composite(r_torso, (64 - tw_val // 2, int(86 - th_val + bob_y)))

        frame.alpha_composite(head, (64 - head.width // 2, int(52 - head.height + bob_y)))

        # 权杖缓缓放回身侧
        r_staff = staff.rotate(45 - int(p * 33), Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(r_staff, (80 - r_staff.width // 2, int(68 - r_staff.height + bob_y)))

    create_high_fidelity_sheet("nun_cast_recovery.png", 4, draw_cast_recovery)

    # F. 动作 6：Hit (3帧) - 受击受力后摆后仰支撑
    def draw_hit(frame, i):
        p = i / 2.0
        draw = ImageDraw.Draw(frame)
        draw.ellipse([(64 - 20, 100 - 4), (64 + 20, 100 + 4)], fill=(0, 0, 0, 85))

        l_leg = legs.rotate(int(-20 * (1-p)), Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(l_leg, (58 - l_leg.width // 2, 98 - l_leg.height))
        
        r_leg = legs.rotate(int(20 * (1-p)), Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(r_leg, (70 - r_leg.width // 2, 98 - r_leg.height))

        r_cloak = cloak.rotate(-15 * (1-p), Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(r_cloak, (64 - r_cloak.width // 2, 94 - r_cloak.height))

        r_torso = torso.rotate(-12 * (1-p), Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(r_torso, (64 - int(8 * (1-p)) - r_torso.width // 2, 86 - r_torso.height))

        r_head = head.rotate(-10 * (1-p), Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(r_head, (64 - int(12 * (1-p)) - r_head.width // 2, 52 - r_head.height))

        r_staff = staff.rotate(10 - int((1-p) * 20), Image.Resampling.BICUBIC, expand=True)
        frame.alpha_composite(r_staff, (80 - r_staff.width // 2, 68 - r_staff.height))

    create_high_fidelity_sheet("nun_hit.png", 3, draw_hit)

    # G. 动作 7：Death (10帧) - 颤抖，化为猩红上升法术红雾粒子
    def draw_death(frame, i):
        draw = ImageDraw.Draw(frame)
        if i < 3:
            shiver_x = int((i % 2 * 2 - 1) * 3)
            shiver_y = int(((i // 2) % 2 * 2 - 1) * 3)
            draw.ellipse([(64 - 18, 100 - 4), (64 + 18, 100 + 4)], fill=(0, 0, 0, 75))
            
            frame.alpha_composite(legs, (61 + shiver_x - legs.width // 2, 98 - legs.height + shiver_y))
            frame.alpha_composite(cloak, (64 + shiver_x - cloak.width // 2, 94 - cloak.height + shiver_y))
            frame.alpha_composite(torso, (64 + shiver_x - torso.width // 2, 86 - torso.height + shiver_y))
            frame.alpha_composite(head, (64 + shiver_x - head.width // 2, 52 - head.height + shiver_y))
            frame.alpha_composite(staff, (78 + shiver_x - staff.width // 2, 66 - staff.height + shiver_y))
        else:
            p = (i - 3) / 7.0
            alpha = int((1.0 - p) * 180)
            bob_y = -p * 36.0
            
            draw.ellipse([(64 - 18 * (1-p), 100 - 3), (64 + 18 * (1-p), 100 + 3)], fill=(0, 0, 0, int(75 * (1-p))))
            
            # 绘制上升并飞溅的猩红法术圣焰微粒 (Glow sparks)
            for j in range(5):
                ang = (j * math.pi * 2) / 5.0 + p * math.pi
                dist = p * 25.0
                px = int(64 + math.cos(ang) * dist)
                py = int(70 + bob_y + math.sin(ang) * dist)
                draw.ellipse([(px - 3, py - 3), (px + 3, py + 3)], fill=(255, 69, 0, alpha))
                
            # 向上升华拉长的猩红残影 (Glow dissolve)
            overlay = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
            o_draw = ImageDraw.Draw(overlay)
            rx = int(8 * (1-p))
            ry = int(22 * (1+p))
            o_draw.ellipse([(64 - rx, int(60 + bob_y - ry)), (64 + rx, int(60 + bob_y + ry))], fill=(154, 15, 15, alpha))
            frame.alpha_composite(overlay)

    create_high_fidelity_sheet("nun_death.png", 10, draw_death)
    print("🎉 高清 2.5D 手绘原图动作序列帧材质全部编译成功！")

if __name__ == '__main__':
    main()
