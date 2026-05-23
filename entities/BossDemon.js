/**
 * BossDemon.js - 关卡终极首领实体 (Demon Boss V2)
 * 具备物理霸体，定时朝周围发射散射型魔法弹，逻辑结构清晰，便于扩展
 * 新增脚底反自旋转的暗红金色深渊五芒召唤阵 (Depth 5)
 */
import { Enemy } from './Enemy.js';
import { EnemyConfig } from '../config/EnemyConfig.js';

export class BossDemon extends Enemy {
    /**
     * @param {Phaser.Scene} scene 场景
     * @param {number} x X坐标
     * @param {number} y Y坐标
     */
    constructor(scene, x, y) {
        super(scene, x, y, 'boss', 'boss');

        // 终极 Boss 专属设定
        this.setTint(0xff3333); // 威严暗红光芒
        this.lastShootTime = 0;
        this.shootCooldown = EnemyConfig.boss.bulletScatterCooldown || 4000;
        this.asyncEvents = [];
        this.castWindupUntil = 0;
        
        // 免疫常规物理击退
        this.knockbackDuration = 0;

        // 初始化脚底反向自旋转的暗红金色深渊五芒召唤阵 (Depth 5)
        this.floorRing = this.scene.add.graphics().setDepth(5);
        this.floorAngle = 0;
        
        const crimson = 0xff1a1a;
        const gold = 0xe5a93c;
        
        // 绘制双层同心圆 (radius 65 & 52)
        this.floorRing.lineStyle(2.0, crimson, 0.42);
        this.floorRing.strokeCircle(0, 0, 65);
        this.floorRing.lineStyle(1.0, gold, 0.28);
        this.floorRing.strokeCircle(0, 0, 52);
        
        // 绘制五芒召唤星盘
        this.floorRing.lineStyle(1.0, crimson, 0.22);
        const points = [];
        for (let i = 0; i < 5; i++) {
            const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
            points.push({
                x: Math.cos(angle) * 50,
                y: Math.sin(angle) * 50
            });
        }
        this.floorRing.beginPath();
        this.floorRing.moveTo(points[0].x, points[0].y);
        this.floorRing.lineTo(points[2].x, points[2].y);
        this.floorRing.lineTo(points[4].x, points[4].y);
        this.floorRing.lineTo(points[1].x, points[1].y);
        this.floorRing.lineTo(points[3].x, points[3].y);
        this.floorRing.closePath();
        this.floorRing.strokePath();

        // 绘制 8 个外侧精致的金色刻度 ticks
        this.floorRing.lineStyle(1.5, gold, 0.32);
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const x1 = Math.cos(angle) * 55;
            const y1 = Math.sin(angle) * 55;
            const x2 = Math.cos(angle) * 61;
            const y2 = Math.sin(angle) * 61;
            this.floorRing.lineBetween(x1, y1, x2, y2);
        }
    }

    /**
     * 覆写击退判定：首领免疫任何击退
     */
    applyKnockback(angle, force) {
        // 首领拥有绝对霸体，物理上不产生位移
    }

    /**
     * 首领心跳更新：重写 AI 追踪与射击判定，同步更新脚底召唤阵
     */
    update(time, player) {
        if (!this.active || !player || !player.active) {
            this.setVelocity(0, 0);
            return;
        }

        // 常规追击 AI
        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        const isCasting = time < this.castWindupUntil;
        const pressure = Phaser.Math.Clamp((dist - 110) / 260, 0.18, 1);
        this.setFlipX(player.x < this.x);
        this.lastVelocityAngle = angle;
        this.setVelocity(
            Math.cos(angle) * this.speed * (isCasting ? 0.16 : pressure),
            Math.sin(angle) * this.speed * (isCasting ? 0.16 : pressure)
        );
        this.setScale(this.baseScale * (1.0 + Math.sin(time * 0.01) * 0.03), this.baseScale * (1.0 - Math.sin(time * 0.01) * 0.02));
        this.setAngle(Math.sin(time * 0.006) * 3.5);

        // 同步并反自旋转更新脚底法阵
        if (this.floorRing) {
            this.floorRing.setPosition(this.x, this.y);
            this.floorAngle -= 0.008; // 反向徐徐自转
            this.floorRing.setRotation(this.floorAngle);
            
            // 稍强的呼吸起伏动效
            const pulse = 1 + Math.sin(time * 0.004) * 0.06;
            this.floorRing.setScale(pulse);
        }

        // 定时发射散射飞弹
        if (time - this.lastShootTime > this.shootCooldown) {
            this.lastShootTime = time;
            this.castWindupUntil = time + 420;
            this.fireScatter(player);
        }
    }

    /**
     * 向玩家方向散射 5 向火球弹幕
     */
    fireScatter(player) {
        if (!this.scene || !this.scene.casterBullets || this.scene.isTransitioningOut) return;

        // 瞬间蓄力闪光
        this.setTintFill(0xffffff);
        this.scene.cameras.main.shake(90, 0.004);
        this.scene.tweens.add({
            targets: this,
            scaleX: this.baseScale * 0.9,
            scaleY: this.baseScale * 1.14,
            duration: 180,
            yoyo: true,
            ease: 'Sine.easeInOut'
        });
        this.asyncEvents.push(this.scene.time.delayedCall(150, () => {
            if (this.active) {
                this.clearTint();
                this.setTint(0xff3333); // 恢复暗红发光
            }
        }));

        const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const bulletSpeed = 220;
        const spreadAngles = [-0.4, -0.2, 0, 0.2, 0.4]; // 5个散射弧度

        spreadAngles.forEach(offset => {
            const finalAngle = baseAngle + offset;
            
            // 创建 Boss 子弹 (复用法师法球材质，但染红)
            const bullet = this.scene.physics.add.sprite(this.x, this.y, 'casterBullet');
            bullet.setDepth(8);
            bullet.setTint(0xff1a1a); // 血红色法球
            bullet.setScale(1.2);     // 体积更大
            
            this.scene.casterBullets.add(bullet);
            
            bullet.setVelocity(Math.cos(finalAngle) * bulletSpeed, Math.sin(finalAngle) * bulletSpeed);
            bullet.rotation = finalAngle;

            // 5秒后自动销毁
            this.asyncEvents.push(this.scene.time.delayedCall(5000, () => {
                if (bullet && bullet.active) bullet.destroy();
            }));
        });

        // 播放散射声效
        if (this.scene.soundSynth) {
            this.scene.soundSynth.play('laser');
        }
    }

    destroy(fromScene) {
        if (this.asyncEvents) {
            this.asyncEvents.forEach(event => event?.destroy?.());
            this.asyncEvents = [];
        }
        super.destroy(fromScene);
    }
}

export default BossDemon;
