/**
 * BossDemon.js - 关卡终极首领实体 (Demon Boss V2)
 * 具备物理霸体，定时朝周围发射散射型魔法弹，逻辑结构清晰，便于扩展
 * 新增脚底反自旋转的暗红深渊裂痕印记 (Depth 5)
 */
import { Enemy } from './Enemy.js';
import { EnemyConfig } from '../config/EnemyConfig.js';

export class BossDemon extends Enemy {
    /**
     * @param {Phaser.Scene} scene 场景
     * @param {number} x X坐标
     * @param {number} y Y坐标
     */
    constructor(scene, x, y, bossKey = 'boss') {
        const config = EnemyConfig[bossKey] || EnemyConfig.boss;
        super(scene, x, y, config.texture, bossKey);

        this.variantConfig = config;
        this.spriteTint = config.spriteTint ?? null;
        this.ritualTint = config.ritualTint ?? 0xff1a1a;
        this.ritualAccent = config.ritualAccent ?? 0x5b0f12;
        this.bulletTint = config.bulletTint ?? this.ritualTint;
        this.applyVariantTint();
        this.lastShootTime = 0;
        this.shootCooldown = config.bulletScatterCooldown || 4000;
        this.asyncEvents = [];
        this.castWindupUntil = 0;

        // 免疫常规物理击退
        this.knockbackDuration = 0;

        if (this.floorRing) {
            this.floorRing.destroy();
        }

        // 初始化脚底反向自旋转的暗红深渊裂痕印记，避免金色圆盘抢戏。
        this.floorRing = this.scene.add.graphics().setDepth(5);
        this.floorAngle = 0;

        // 破碎五芒印记，不再绘制同心圆或金色刻度。
        this.floorRing.lineStyle(2.0, this.ritualTint, 0.32);
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
        this.floorRing.strokePath();

        this.floorRing.lineStyle(1.2, this.ritualAccent, 0.28);
        for (let i = 0; i < 5; i++) {
            const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
            const x1 = Math.cos(angle) * 22;
            const y1 = Math.sin(angle) * 22;
            const x2 = Math.cos(angle) * 64;
            const y2 = Math.sin(angle) * 64;
            this.floorRing.lineBetween(x1, y1, x2, y2);
        }

        // 外沿只保留断裂短划，避免读成完整圆盘。
        this.floorRing.lineStyle(1.5, this.ritualTint, 0.22);
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const tangent = angle + Math.PI / 2;
            const cx = Math.cos(angle) * 58;
            const cy = Math.sin(angle) * 58;
            const x1 = cx - Math.cos(tangent) * 5;
            const y1 = cy - Math.sin(tangent) * 5;
            const x2 = cx + Math.cos(tangent) * 5;
            const y2 = cy + Math.sin(tangent) * 5;
            this.floorRing.lineBetween(x1, y1, x2, y2);
        }
    }

    applyVariantTint() {
        this.clearTint();
        if (this.spriteTint !== null && this.spriteTint !== undefined) {
            this.setTint(this.spriteTint);
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
        this.syncSolidBacking();

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
        if (!this.scene || !this.scene.casterBullets || this.scene.isTransitioningOut || this.hp <= 0) return;

        // 播放魔王施法击打动画
        this.play(`${this.animPrefix}_attack_anim`, true);

        // 瞬间高闪蓄力
        this.setTintFill(0xffffff);
        this.scene.cameras.main.shake(90, 0.004);

        this.asyncEvents.push(this.scene.time.delayedCall(180, () => {
            if (this.active && this.hp > 0) {
                this.applyVariantTint();
            }
        }));

        // 在第 3 帧左右 (也就是 300ms) 爆发释放散射火球，完美契合蓄力前摆释放节奏
        this.asyncEvents.push(this.scene.time.delayedCall(300, () => {
            if (!this.active || !this.scene || this.scene.isTransitioningOut || this.hp <= 0) return;

            const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            const bulletSpeed = 220;
            const spreadAngles = [-0.4, -0.2, 0, 0.2, 0.4]; // 5个散射弧度

            spreadAngles.forEach(offset => {
                const finalAngle = baseAngle + offset;

                // 创建 Boss 子弹 (复用法师法球材质，但染红)
                const bullet = this.scene.physics.add.sprite(this.x, this.y, 'casterBullet');
                bullet.setDepth(8);
                bullet.setTint(this.bulletTint);
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
        }));
    }

    takeDamage(damage, isCrit, angle = null) {
        super.takeDamage(damage, isCrit, angle);

        if (!this.scene?.time || this.hp <= 0) return;
        const restoreDelay = isCrit ? 100 : 70;
        this.asyncEvents.push(this.scene.time.delayedCall(restoreDelay, () => {
            if (this.active && this.hp > 0) {
                this.applyVariantTint();
            }
        }));
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
