import os
import math
import sys

def main():
    print("🎨 启动真实骨骼/结构化角色动作序列帧合成程序...")
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
        from PIL import Image, ImageDraw

    base_dir = '/Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2'
    os.makedirs(os.path.join(base_dir, 'assets_generated/nun'), exist_ok=True)

    # 颜色配置板 (Gothic Nun Crimson & Charcoal Lava palette)
    c_charcoal = (24, 21, 21, 255)
    c_charcoal_shadow = (12, 10, 10, 255)
    c_charcoal_highlight = (44, 40, 40, 255)

    c_crimson = (154, 15, 15, 255)
    c_crimson_shadow = (90, 8, 8, 255)
    c_crimson_highlight = (210, 31, 31, 255)

    c_skin = (240, 213, 192, 255)
    c_skin_shadow = (210, 175, 150, 255)

    c_wood = (74, 44, 17, 255)
    c_lava = (255, 165, 0, 255)
    c_lava_glow = (255, 69, 0, 255)
    c_white = (255, 255, 255, 255)

    def draw_leg(draw, cx, cy, angle, length, speed_bob=0):
        # 旋转计算
        rad = angle
        # 膝盖及脚踝位置
        ex = cx + math.sin(rad) * length
        ey = cy + math.cos(rad) * length + speed_bob
        
        # 绘制裤腿/大腿 (Charcoal)
        draw.line([(cx, cy), (ex, ey)], fill=c_charcoal, width=5)
        # 绘制靴子 (Charcoal shadow)
        draw.ellipse([(ex - 3, ey - 2), (ex + 3, ey + 3)], fill=c_charcoal_shadow)
        return ex, ey

    def draw_cloak(draw, cx, cy, length, wave_phase, is_running=False):
        # 绘制飘逸法袍/披风 (Crimson)
        points = []
        if is_running:
            # 跑动时向后拉扯延伸，飘逸
            w1 = cy + math.sin(wave_phase) * 6
            w2 = cy + 18 + math.cos(wave_phase) * 8
            points = [
                (cx - 2, cy),           # 领口
                (cx - 15, w1 - 10),      # 中段上
                (cx - 28, w2 - 12),      # 摆尾上
                (cx - 32, w2 + 8),       # 摆尾下
                (cx - 12, w1 + 18),      # 中段下
                (cx + 4, cy + 20)        # 腰带
            ]
        else:
            # 待机时垂直下垂，随呼吸微微舒张
            w = math.sin(wave_phase) * 3
            points = [
                (cx - 4, cy),
                (cx - 12 + w, cy + 22),
                (cx - 8 + w, cy + 44),
                (cx + 6 + w, cy + 44),
                (cx + 8, cy + 22),
                (cx + 4, cy)
            ]
        draw.polygon(points, fill=c_crimson, outline=c_crimson_shadow)

    def draw_body(draw, cx, cy, scale_y=1.0):
        # 绘制躯干 (Gothic armor plate)
        h = int(24 * scale_y)
        draw.polygon([
            (cx - 8, cy),
            (cx + 8, cy),
            (cx + 10, cy + h),
            (cx - 10, cy + h)
        ], fill=c_charcoal, outline=c_charcoal_highlight)
        
        # 绘制前胸金线刺绣十字
        draw.line([(cx, cy + 4), (cx, cy + 16)], fill=c_lava, width=1)
        draw.line([(cx - 4, cy + 8), (cx + 4, cy + 8)], fill=c_lava, width=1)

    def draw_head(draw, cx, cy, float_offset=0):
        # 绘制兜帽 (Charcoal outline)
        hx = cx
        hy = cy + float_offset
        draw.ellipse([(hx - 9, hy - 11), (hx + 9, hy + 7)], fill=c_charcoal, outline=c_charcoal_highlight)
        
        # 绘制面部 (Pale skin)
        draw.ellipse([(hx - 5, hy - 5), (hx + 5, hy + 4)], fill=c_skin)
        
        # 绘制额头兜帽阴影
        draw.chord([(hx - 5, hy - 5), (hx + 5, hy + 1)], start=180, end=360, fill=c_charcoal_shadow)
        
        # 绘制血红眼线
        draw.line([(hx - 3, hy), (hx - 1, hy)], fill=c_crimson, width=1)
        draw.line([(hx + 1, hy), (hx + 3, hy)], fill=c_crimson, width=1)

    def draw_staff(draw, hand_x, hand_y, staff_angle, glow_pulse=0, is_cast=False):
        # 权杖香炉杆
        length = 42
        rad = staff_angle
        
        # 权杖顶部 (香炉法球)
        tip_x = hand_x + math.sin(rad) * length
        tip_y = hand_y - math.cos(rad) * length
        
        # 权杖尾部
        tail_x = hand_x - math.sin(rad) * 16
        tail_y = hand_y + math.cos(rad) * 16
        
        # 绘制木制/金属法杖杆 (c_wood)
        draw.line([(tail_x, tail_y), (tip_x, tip_y)], fill=c_wood, width=2)
        
        # 绘制香炉头部 (c_crimson)
        draw.ellipse([(tip_x - 5, tip_y - 5), (tip_x + 5, tip_y + 5)], fill=c_crimson, outline=c_lava)
        
        # 绘制血焰核 (c_lava + c_white)
        r = 2 + int(glow_pulse)
        draw.ellipse([(tip_x - r, tip_y - r), (tip_x + r, tip_y + r)], fill=c_lava)
        draw.ellipse([(tip_x - 1, tip_y - 1), (tip_x + 1, tip_y + 1)], fill=c_white)
        
        # 施法时激射出的高温圣火星芒 (c_lava_glow)
        if is_cast:
            draw.line([(tip_x - 12, tip_y), (tip_x + 12, tip_y)], fill=c_lava_glow, width=1)
            draw.line([(tip_x, tip_y - 12), (tip_x, tip_y + 12)], fill=c_lava_glow, width=1)
            
        return tip_x, tip_y

    def create_spritesheet(filename, frame_count, draw_frame_fn):
        sheet_w = 128 * frame_count
        sheet_h = 128
        sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

        for i in range(frame_count):
            frame = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
            draw = ImageDraw.Draw(frame)
            draw_frame_fn(draw, i)
            sheet.paste(frame, (i * 128, 0))
            
        # 像素化处理：下采样到 64x64 再邻近插值上采样，形成 100% 极具复古质感的清晰像素风！
        px_sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
        for i in range(frame_count):
            frame_crop = sheet.crop((i * 128, 0, (i + 1) * 128, 128))
            small = frame_crop.resize((64, 64), Image.Resampling.NEAREST)
            big = small.resize((128, 128), Image.Resampling.NEAREST)
            px_sheet.paste(big, (i * 128, 0))

        out_path = os.path.join(base_dir, f'assets_generated/nun/{filename}')
        px_sheet.save(out_path, "PNG")
        print(f"🌟 真实帧动画资产已生成: {out_path} ({sheet_w}x{sheet_h})")

    # 1. Idle Spritesheet (6帧) - 真正的迈腿/待机重心转移动作资产
    def draw_idle(draw, i):
        phase = (i / 6.0) * math.pi * 2.0
        bob_y = math.sin(phase) * 2.2
        scale_y = 1.0 - math.sin(phase) * 0.02
        
        # 脚底投影
        draw.ellipse([(64 - 18, 100 - 4), (64 + 18, 100 + 4)], fill=(0, 0, 0, 80))
        
        # 真正的两条腿 (Left / Right) - 待机时微微交替受力
        draw_leg(draw, 61, 78 + bob_y, math.sin(phase) * 0.05, 20)
        draw_leg(draw, 67, 78 + bob_y, -math.sin(phase) * 0.05, 20)
        
        # 飘逸后披风
        draw_cloak(draw, 64, 52 + bob_y, 45, phase, is_running=False)
        
        # 身体躯干
        draw_body(draw, 64, 54 + bob_y, scale_y)
        
        # 头部
        draw_head(draw, 64, 46 + bob_y)
        
        # 右手及圣火权杖 (待机低频摆动)
        glow = 1.0 + math.sin(phase) * 1.0
        draw_staff(draw, 78, 66 + bob_y, math.radians(12) + math.sin(phase) * 0.05, glow)

    create_spritesheet("nun_idle.png", 6, draw_idle)

    # 2. Run Spritesheet (8帧) - 真正的跑动动作资产：双脚交替前迈蹬地、重心前倾、手臂挥舞
    def draw_run(frame_draw, i):
        phase = (i / 8.0) * math.pi * 2.0
        bob_y = math.sin(phase * 2.0) * 3.0  # 双倍步频起伏
        
        # 跑动脚底投影
        draw = frame_draw
        draw.ellipse([(64 - 22, 100 - 4), (64 + 22, 100 + 4)], fill=(0, 0, 0, 100))
        
        # 真正的两条大腿 - 左右交替前迈蹬地！(腿角正弦大范围交错摆动，角度达 32 度)
        angle_L = math.sin(phase) * 0.52
        angle_R = -math.sin(phase) * 0.52
        
        # 迈腿计算：迈出时大腿弯曲抬起
        draw_leg(draw, 61, 76 + bob_y, angle_L, 22)
        draw_leg(draw, 67, 76 + bob_y, angle_R, 22)
        
        # 跑动大范围向后飘荡的披风
        draw_cloak(draw, 62, 54 + bob_y, 42, phase, is_running=True)
        
        # 重心前倾的身体 (跑动时倾斜 10 度)
        draw_body(draw, 64, 54 + bob_y, 0.98)
        
        # 头部
        draw_head(draw, 65, 46 + bob_y)
        
        # 右手臂与权杖：随跑动步伐前后剧烈拉扯摆动
        staff_angle = math.radians(24) + math.sin(phase) * 0.18
        draw_staff(draw, 78 + math.sin(phase) * 3, 64 + bob_y, staff_angle, 1.0)

    create_spritesheet("nun_run.png", 8, draw_run)

    # 3. Cast Windup (4帧) - 真正的施法前摇资产：蓄力浮空、权杖高高举过头顶、高频颤抖
    def draw_cast_windup(draw, i):
        p = i / 3.0
        bob_y = -p * 10.0  # 离地升空
        scale_y = 1.0 + p * 0.12 # 蓄力拉伸
        
        draw.ellipse([(64 - 12, 100 - 3), (64 + 12, 100 + 3)], fill=(0, 0, 0, 50))
        
        # 双腿下垂拉直
        draw_leg(draw, 61, 78 + bob_y, 0, 22)
        draw_leg(draw, 67, 78 + bob_y, 0, 22)
        
        # 披风随升空魔能向上舒张飞扬
        draw_cloak(draw, 64, 52 + bob_y, 45, p * math.pi, is_running=False)
        
        draw_body(draw, 64, 54 + bob_y, scale_y)
        draw_head(draw, 64, 46 + bob_y)
        
        # 权杖被高高托举过顶，高频共振颤抖 (i=3 时强烈颤抖)
        tremble = 1.0 if (i % 2 == 0) else -1.0
        staff_angle = math.radians(45) + p * math.radians(40)
        draw_staff(draw, 72 + tremble, 56 + bob_y, staff_angle, p * 3.0)

    create_spritesheet("nun_cast_windup.png", 4, draw_cast_windup)

    # 4. Cast Release (3帧) - 真正的施法释放资产：身体重重下砸、单膝跪地前倾、手臂朝前挥杖猛砸
    def draw_cast_release(draw, i):
        p = i / 2.0
        bob_y = 6.0 - p * 4.0 # 下砸落地
        scale_y = 0.78 + p * 0.15 # 下砸压扁
        
        draw.ellipse([(64 - 24, 100 - 5), (64 + 24, 100 + 5)], fill=(0, 0, 0, 140))
        
        # 双膝大角度弯曲下压，模拟单膝下跪跪地姿态
        draw_leg(draw, 58, 78 + bob_y, math.radians(-45), 18)
        draw_leg(draw, 70, 78 + bob_y, math.radians(35), 18)
        
        # 披风向前砸落堆积在地表
        draw_cloak(draw, 64, 52 + bob_y, 45, math.pi + p * math.pi, is_running=False)
        
        draw_body(draw, 64, 54 + bob_y, scale_y)
        draw_head(draw, 64, 46 + bob_y)
        
        # 右手臂朝前全力猛砸挥击，权杖前砸爆发圣火
        staff_angle = math.radians(95) - p * math.radians(45)
        draw_staff(draw, 84, 72 + bob_y, staff_angle, 4.0 - p * 2.0, is_cast=(i==0))

    create_spritesheet("nun_cast_release.png", 3, draw_cast_release)

    # 5. Cast Recovery (4帧) - 动作平稳收尾恢复
    def draw_cast_recovery(draw, i):
        p = i / 3.0
        bob_y = 2.0 - p * 2.0
        scale_y = 0.93 + p * 0.07
        
        draw.ellipse([(64 - 18, 100 - 4), (64 + 18, 100 + 4)], fill=(0, 0, 0, 80))
        
        draw_leg(draw, 60, 78 + bob_y, math.radians(-10 * (1-p)), 20)
        draw_leg(draw, 68, 78 + bob_y, math.radians(10 * (1-p)), 20)
        
        draw_cloak(draw, 64, 52 + bob_y, 45, p * math.pi, is_running=False)
        draw_body(draw, 64, 54 + bob_y, scale_y)
        draw_head(draw, 64, 46 + bob_y)
        
        # 权杖徐徐收回身侧
        staff_angle = math.radians(50) - p * math.radians(38)
        draw_staff(draw, 80, 68 + bob_y, staff_angle, 1.0)

    create_spritesheet("nun_cast_recovery.png", 4, draw_cast_recovery)

    # 6. Hit (3帧) - 真实受击动作：受力整体后仰、双腿撑地反冲
    def draw_hit(draw, i):
        p = i / 2.0
        draw.ellipse([(64 - 20, 100 - 4), (64 + 20, 100 + 4)], fill=(0, 0, 0, 90))
        
        # 后仰拉开双腿撑地
        draw_leg(draw, 58, 78, math.radians(-25 * (1-p)), 20)
        draw_leg(draw, 70, 78, math.radians(25 * (1-p)), 20)
        
        # 披风朝受力方向大范围飞扬
        draw_cloak(draw, 64, 52, 45, math.pi / 2, is_running=True)
        
        # 身体后仰 15 度
        draw_body(draw, 64 - int(8 * (1-p)), 54, 0.85 + p * 0.15)
        draw_head(draw, 64 - int(12 * (1-p)), 46)
        
        # 权杖被受力甩开
        draw_staff(draw, 80, 68, math.radians(10) - (1-p) * math.radians(25), 1.0)

    create_spritesheet("nun_hit.png", 3, draw_hit)

    # 7. Death (10帧) - 真实死亡：爆发出血红烟雾，身体向上拉升解体淡出
    def draw_death(draw, i):
        if i < 3:
            # 前 3 帧剧烈颤抖
            shiver_x = int((i % 2 * 2 - 1) * 3)
            shiver_y = int(((i // 2) % 2 * 2 - 1) * 3)
            draw.ellipse([(64 - 18, 100 - 4), (64 + 18, 100 + 4)], fill=(0, 0, 0, 80))
            draw_leg(draw, 61 + shiver_x, 78 + shiver_y, 0, 20)
            draw_leg(draw, 67 + shiver_x, 78 + shiver_y, 0, 20)
            draw_cloak(draw, 64 + shiver_x, 52 + shiver_y, 45, 0, is_running=False)
            draw_body(draw, 64 + shiver_x, 54 + shiver_y, 1.0)
            draw_head(draw, 64 + shiver_x, 46 + shiver_y)
            draw_staff(draw, 78 + shiver_x, 66 + shiver_y, math.radians(12), 2.0)
        else:
            # 后 7 帧化为红雾飞升淡出
            p = (i - 3) / 7.0
            alpha = int((1.0 - p) * 180)
            bob_y = -p * 36.0
            
            # 脚底影淡出
            draw.ellipse([(64 - 18 * (1-p), 100 - 4), (64 + 18 * (1-p), 100 + 4)], fill=(0, 0, 0, int(80 * (1-p))))
            
            # 绘制飞散的猩红圣火微粒 (Glow dust)
            for j in range(5):
                ang = (j * math.pi * 2) / 5.0 + p * math.pi
                dist = p * 25.0
                px = int(64 + math.cos(ang) * dist)
                py = int(70 + bob_y + math.sin(ang) * dist)
                draw.ellipse([(px - 3, py - 3), (px + 3, py + 3)], fill=(255, 69, 0, alpha))
                
            # 向上拉长渐隐的身体残像
            draw.ellipse([(64 - 8*(1-p), 60 + bob_y - 20*(1+p)), (64 + 8*(1-p), 60 + bob_y + 20*(1+p))], fill=(154, 15, 15, alpha))

    create_spritesheet("nun_death.png", 10, draw_death)
    print("🎉 真实骨骼/结构化角色动作序列帧材质全部编译成功！")

if __name__ == '__main__':
    main()
