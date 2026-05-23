/**
 * VirtualJoystick.js - 移动端多指触碰虚拟摇杆及冷却大键
 * 提供动态点击呼出物理底盘，及右下角冲刺按键的“扇形扫频 (Radial Sweep)”CD指示器
 */
import { UIConfig } from '../config/UIConfig.js';
import { GameState } from '../state/GameState.js';

export class VirtualJoystick {
    /**
     * @param {Phaser.Scene} scene 场景
     */
    constructor(scene) {
        this.scene = scene;
        this.layout = UIConfig.getMobileControlLayout(scene.scale.width, scene.scale.height);

        // 1. 摇杆控制状态
        this.active = false;
        this.baseX = this.layout.joystickBaseX;
        this.baseY = this.layout.joystickBaseY;
        this.forceX = 0; // 物理拉伸比 (-1.0 - 1.0)
        this.forceY = 0;

        // 冲刺键点击状态
        this.isDashPressed = false;

        // 2. 初始化画布绘制器
        this.joystickGraphics = scene.add.graphics().setScrollFactor(0);
        this.joystickGraphics.setDepth(18);

        this.dashButtonGraphics = scene.add.graphics().setScrollFactor(0);
        this.dashButtonGraphics.setDepth(18);

        // 3. 注册触控事件监听 (支持移动端多点触控)
        scene.input.addPointer(2); // 启用双指并发
        
        scene.input.on('pointerdown', this.onPointerDown, this);
        scene.input.on('pointermove', this.onPointerMove, this);
        scene.input.on('pointerup', this.onPointerUp, this);
        scene.scale.on('resize', this.onResize, this);

        // 4. 绘制静态初始态的冲刺大键
        this.drawDashButton(0);
    }

    onResize(gameSize) {
        this.layout = UIConfig.getMobileControlLayout(gameSize.width, gameSize.height);
        if (!this.active) {
            this.baseX = this.layout.joystickBaseX;
            this.baseY = this.layout.joystickBaseY;
        }
        this.drawDashButton(0);
    }

    /**
     * 获取当前摇杆的物理受力向量
     */
    getForceVector() {
        return {
            x: this.forceX,
            y: this.forceY,
            force: Math.sqrt(this.forceX * this.forceX + this.forceY * this.forceY)
        };
    }

    /**
     * 消费/清空冲刺点击触发状态
     */
    clearDashPress() {
        this.isDashPressed = false;
    }

    /**
     * 点触落下事件 (摇杆/按键区分)
     */
    onPointerDown(pointer) {
        if (this.destroyed || this.scene?.isTransitioningOut) return;
        if (!GameState.run || GameState.run.isGameOver) return;

        // A. 判定是否击中右下角冲刺键热区 (x: 580, y: 1170, radius: 48)
        const db = UIConfig.dashButton;
        const dashX = this.layout.dashX;
        const dashY = this.layout.dashY;
        const dx = pointer.x - dashX;
        const dy = pointer.y - dashY;
        const distToDash = Math.sqrt(dx * dx + dy * dy);

        if (distToDash < db.radius * 1.5) { // 稍微扩大点击热区，提升容错
            pointer.isDashTrigger = true; // 绑定标记，防摇杆干扰
            this.isDashPressed = true;
            return;
        }

        // B. 判定是否点击屏幕下半部分的虚拟摇杆热区 (y > 600)
        if (pointer.y > this.layout.activeZoneY) {
            pointer.isJoystickTrigger = true;
            this.active = true;
            
            const minX = UIConfig.joystick.circleRadius + 20;
            const maxX = this.scene.scale.width - UIConfig.joystick.circleRadius - 20;
            const maxY = this.scene.scale.height - 56;
            const minY = this.layout.activeZoneY + 24;
            this.baseX = Phaser.Math.Clamp(pointer.x, minX, maxX);
            this.baseY = Phaser.Math.Clamp(pointer.y, minY, maxY);

            this.drawJoystick(this.baseX, this.baseY, this.baseX, this.baseY);
        }
    }

    /**
     * 点触拖拽事件
     */
    onPointerMove(pointer) {
        if (this.destroyed || this.scene?.isTransitioningOut) return;
        if (!this.active || !pointer.isJoystickTrigger) return;

        const cfg = UIConfig.joystick;
        const dx = pointer.x - this.baseX;
        const dy = pointer.y - this.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let knobX = pointer.x;
        let knobY = pointer.y;

        if (dist > cfg.circleRadius) {
            // 摇杆出界，进行物理圆周截断
            knobX = this.baseX + (dx / dist) * cfg.circleRadius;
            knobY = this.baseY + (dy / dist) * cfg.circleRadius;
            this.forceX = dx / dist;
            this.forceY = dy / dist;
        } else {
            // 正常拉伸
            this.forceX = dist > 5 ? dx / cfg.circleRadius : 0;
            this.forceY = dist > 5 ? dy / cfg.circleRadius : 0;
        }

        // 重新绘制底盘与移动红轴
        this.drawJoystick(this.baseX, this.baseY, knobX, knobY);
    }

    /**
     * 触控抬起事件
     */
    onPointerUp(pointer) {
        if (this.destroyed) return;
        if (pointer.isJoystickTrigger) {
            pointer.isJoystickTrigger = false;
            this.active = false;
            this.forceX = 0;
            this.forceY = 0;
            this.joystickGraphics.clear(); // 渐隐/消失
        }
        if (pointer.isDashTrigger) {
            pointer.isDashTrigger = false;
        }
    }

    /**
     * 绘制动态摇杆
     */
    drawJoystick(bx, by, kx, ky) {
        const cfg = UIConfig.joystick;
        const g = this.joystickGraphics;
        g.clear();

        // 1. 绘制底盘 (银灰金属拉花)
        g.lineStyle(3, 0xcfc5b3, 0.4);
        g.strokeCircle(bx, by, cfg.circleRadius);
        g.fillStyle(0x000000, 0.25);
        g.fillCircle(bx, by, cfg.circleRadius);

        // 2. 绘制移动中纽红轴 (亮红色球体)
        g.lineStyle(2.5, 0xe5a93c, 0.7);
        g.strokeCircle(kx, ky, cfg.stickRadius);
        g.fillStyle(0x8a0000, 0.75); // 暗红
        g.fillCircle(kx, ky, cfg.stickRadius);
    }

    /**
     * 物理大键及其扇形扫频 CD 的渲染心跳
     * @param {number} time
     */
    update(time) {
        if (this.destroyed || this.scene?.isTransitioningOut) return;
        const player = this.scene.player;
        if (!player || !player.active) return;

        // 计算冲刺冷却比例
        const elapsed = time - player.lastDashTime;
        let cdRatio = 0;

        if (elapsed < player.dashCooldown) {
            cdRatio = 1 - (elapsed / player.dashCooldown);
        }

        // 高频更新大键渲染
        this.drawDashButton(cdRatio);
    }

    /**
     * 渲染物理大键与 Radial Sweep
     */
    drawDashButton(cdRatio) {
        const cfg = UIConfig.dashButton;
        const x = this.layout.dashX;
        const y = this.layout.dashY;
        const g = this.dashButtonGraphics;
        g.clear();

        // A. 绘制金底红芯按钮底框
        g.lineStyle(3, cfg.borderColor, 0.9);
        g.strokeCircle(x, y, cfg.radius);
        
        g.fillStyle(cdRatio > 0 ? 0x1f1515 : cfg.color, 0.85); // 冷却中时按钮灰暗
        g.fillCircle(x, y, cfg.radius);

        // B. 绘制雷电冲刺白色符号
        g.lineStyle(2, 0xffffff, 0.95);
        g.beginPath();
        g.moveTo(x + 4, y - 18);
        g.lineTo(x - 12, y + 4);
        g.lineTo(x + 2, y + 4);
        g.lineTo(x - 4, y + 18);
        g.lineTo(x + 12, y - 4);
        g.lineTo(x - 2, y - 4);
        g.closePath();
        g.strokePath();

        // C. 绘制扇形冷却扫频遮罩 (Radial Sweep - 逆时针收缩)
        if (cdRatio > 0) {
            g.fillStyle(0x000000, 0.6); // 黑色半透明冷却覆盖扇面
            g.beginPath();
            g.moveTo(x, y);
            
            // 扇形绘制算法 (-Math.PI/2 代表正上方 12 点钟位置开始)
            g.arc(
                x,
                y,
                cfg.radius - 2,
                -Math.PI / 2,
                -Math.PI / 2 + (cdRatio * Math.PI * 2),
                false
            );
            
            g.lineTo(x, y);
            g.closePath();
            g.fillPath();
        }
    }

    /**
     * 销毁清理事件
     */
    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.scene.input.off('pointerdown', this.onPointerDown, this);
        this.scene.input.off('pointermove', this.onPointerMove, this);
        this.scene.input.off('pointerup', this.onPointerUp, this);
        this.scene.scale.off('resize', this.onResize, this);
        if (this.joystickGraphics && this.joystickGraphics.active !== false) this.joystickGraphics.destroy();
        if (this.dashButtonGraphics && this.dashButtonGraphics.active !== false) this.dashButtonGraphics.destroy();
    }
}

export default VirtualJoystick;
