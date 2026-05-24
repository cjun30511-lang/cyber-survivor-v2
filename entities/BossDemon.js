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
        this.skillPattern = config.skillPattern || 'scatter';
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
            this.castBossSkill(player);
        }
    }

    castBossSkill(player) {
        switch (this.skillPattern) {
            case 'frostRing':
                this.fireFrostRing(player);
                break;
            case 'plagueCloud':
                this.firePlagueCloud(player);
                break;
            case 'voidSpiral':
                this.fireVoidSpiral(player);
                break;
            case 'furnaceLines':
                this.fireFurnaceLines(player);
                break;
            case 'drownedWave':
                this.fireDrownedWave(player);
                break;
            case 'bloodCross':
                this.fireBloodCross(player);
                break;
            case 'boneBarrage':
                this.fireBoneBarrage(player);
                break;
            case 'scatter':
            default:
                this.fireScatter(player);
                break;
        }
    }

    startCastFlash(duration = 180, shake = 0.004) {
        this.play(`${this.animPrefix}_attack_anim`, true);
        this.setTintFill(0xffffff);
        this.scene.cameras.main.shake(90, shake);
        this.asyncEvents.push(this.scene.time.delayedCall(duration, () => {
            if (this.active && this.hp > 0) {
                this.applyVariantTint();
            }
        }));
    }

    spawnBossBullet(x, y, angle, speed, options = {}) {
        if (!this.scene || !this.scene.casterBullets) return null;
        const bullet = this.scene.physics.add.sprite(x, y, 'casterBullet');
        bullet.setDepth(options.depth ?? 8);
        bullet.setTint(options.tint ?? this.bulletTint);
        bullet.setScale(options.scale ?? 1.2);
        bullet.rotation = angle;
        bullet.bossPattern = this.skillPattern;
        bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.scene.casterBullets.add(bullet);
        this.asyncEvents.push(this.scene.time.delayedCall(options.life ?? 5000, () => {
            if (bullet && bullet.active) bullet.destroy();
        }));
        return bullet;
    }

    drawTelegraph(drawFn, duration = 520) {
        if (!this.scene || this.scene.isTransitioningOut) return null;
        const graphic = this.scene.add.graphics().setDepth(6);
        drawFn(graphic);
        this.scene.tweens.add({
            targets: graphic,
            alpha: 0,
            duration,
            ease: 'Quad.easeOut',
            onComplete: () => graphic.destroy()
        });
        return graphic;
    }

    playSkillSound() {
        if (this.scene.soundSynth) {
            this.scene.soundSynth.play('laser');
        }
    }

    /**
     * 向玩家方向散射 5 向火球弹幕
     */
    fireScatter(player) {
        if (!this.scene || !this.scene.casterBullets || this.scene.isTransitioningOut || this.hp <= 0) return;

        this.startCastFlash();

        // 在第 3 帧左右 (也就是 300ms) 爆发释放散射火球，完美契合蓄力前摆释放节奏
        this.asyncEvents.push(this.scene.time.delayedCall(300, () => {
            if (!this.active || !this.scene || this.scene.isTransitioningOut || this.hp <= 0) return;

            const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            const bulletSpeed = 220;
            const spreadAngles = [-0.4, -0.2, 0, 0.2, 0.4]; // 5个散射弧度

            spreadAngles.forEach(offset => {
                this.spawnBossBullet(this.x, this.y, baseAngle + offset, bulletSpeed, { scale: 1.2 });
            });

            this.playSkillSound();
        }));
    }

    fireFrostRing(player) {
        if (!this.scene || this.scene.isTransitioningOut || this.hp <= 0) return;
        this.startCastFlash(210, 0.003);
        this.drawTelegraph((g) => {
            g.lineStyle(3, this.ritualTint, 0.54);
            g.strokeCircle(this.x, this.y, 132);
            g.lineStyle(1, 0xe8fbff, 0.72);
            g.strokeCircle(this.x, this.y, 92);
        }, 620);
        this.asyncEvents.push(this.scene.time.delayedCall(340, () => {
            if (!this.active || this.hp <= 0) return;
            for (let i = 0; i < 14; i++) {
                const angle = (i / 14) * Math.PI * 2;
                this.spawnBossBullet(this.x, this.y, angle, 165, { tint: 0xbdf5ff, scale: 1.05, life: 5600 });
            }
            this.playSkillSound();
        }));
    }

    firePlagueCloud(player) {
        if (!this.scene || this.scene.isTransitioningOut || this.hp <= 0) return;
        this.startCastFlash(190, 0.003);
        const targetX = player.x;
        const targetY = player.y;
        this.drawTelegraph((g) => {
            g.fillStyle(this.ritualTint, 0.12);
            g.fillCircle(targetX, targetY, 96);
            g.lineStyle(2, this.ritualTint, 0.64);
            g.strokeCircle(targetX, targetY, 96);
            g.lineStyle(1, 0xd2ff86, 0.72);
            g.strokeCircle(targetX, targetY, 56);
        }, 700);
        this.asyncEvents.push(this.scene.time.delayedCall(420, () => {
            if (!this.active || this.hp <= 0) return;
            for (let i = 0; i < 9; i++) {
                const angle = (i / 9) * Math.PI * 2;
                const px = targetX + Math.cos(angle) * 34;
                const py = targetY + Math.sin(angle) * 34;
                this.spawnBossBullet(px, py, angle, 78, { tint: 0x9fcb55, scale: 0.92, life: 3400 });
            }
            this.playSkillSound();
        }));
    }

    fireVoidSpiral(player) {
        if (!this.scene || this.scene.isTransitioningOut || this.hp <= 0) return;
        this.startCastFlash(180, 0.004);
        this.drawTelegraph((g) => {
            for (let i = 0; i < 4; i++) {
                g.lineStyle(2, this.ritualTint, 0.42);
                g.beginPath();
                for (let step = 0; step < 28; step++) {
                    const t = step / 27;
                    const angle = i * Math.PI / 2 + t * Math.PI * 1.4;
                    const r = 24 + t * 150;
                    const x = this.x + Math.cos(angle) * r;
                    const y = this.y + Math.sin(angle) * r;
                    if (step === 0) g.moveTo(x, y);
                    else g.lineTo(x, y);
                }
                g.strokePath();
            }
        }, 620);
        this.asyncEvents.push(this.scene.time.delayedCall(300, () => {
            if (!this.active || this.hp <= 0) return;
            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2 + 0.38;
                this.spawnBossBullet(this.x, this.y, angle, 205 + (i % 3) * 18, { tint: 0xaa7cff, scale: 1.0, life: 5200 });
            }
            this.playSkillSound();
        }));
    }

    fireFurnaceLines(player) {
        if (!this.scene || this.scene.isTransitioningOut || this.hp <= 0) return;
        this.startCastFlash(180, 0.005);
        const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const offsets = [-0.32, 0, 0.32];
        this.drawTelegraph((g) => {
            offsets.forEach(offset => {
                const angle = baseAngle + offset;
                const endX = this.x + Math.cos(angle) * 520;
                const endY = this.y + Math.sin(angle) * 520;
                g.lineStyle(18, 0x2b0d04, 0.26);
                g.lineBetween(this.x, this.y, endX, endY);
                g.lineStyle(5, this.ritualTint, 0.7);
                g.lineBetween(this.x, this.y, endX, endY);
            });
        }, 620);
        this.asyncEvents.push(this.scene.time.delayedCall(360, () => {
            if (!this.active || this.hp <= 0) return;
            offsets.forEach(offset => this.spawnBossBullet(this.x, this.y, baseAngle + offset, 310, { tint: 0xff7a1a, scale: 1.38, life: 3600 }));
            this.playSkillSound();
        }));
    }

    fireDrownedWave(player) {
        if (!this.scene || this.scene.isTransitioningOut || this.hp <= 0) return;
        this.startCastFlash(170, 0.003);
        const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        this.drawTelegraph((g) => {
            for (let i = -2; i <= 2; i++) {
                const angle = baseAngle + i * 0.18;
                g.lineStyle(3, this.ritualTint, 0.44);
                g.lineBetween(this.x, this.y, this.x + Math.cos(angle) * 420, this.y + Math.sin(angle) * 420);
            }
        }, 560);
        this.asyncEvents.push(this.scene.time.delayedCall(260, () => {
            if (!this.active || this.hp <= 0) return;
            for (let row = -2; row <= 2; row++) {
                const angle = baseAngle + row * 0.18;
                for (let step = 0; step < 3; step++) {
                    const sx = this.x + Math.cos(angle + Math.PI / 2) * row * 18;
                    const sy = this.y + Math.sin(angle + Math.PI / 2) * row * 18;
                    this.spawnBossBullet(sx, sy, angle, 190 + step * 28, { tint: 0x6be7f2, scale: 0.92, life: 4200 });
                }
            }
            this.playSkillSound();
        }));
    }

    fireBloodCross(player) {
        if (!this.scene || this.scene.isTransitioningOut || this.hp <= 0) return;
        this.startCastFlash(190, 0.005);
        this.drawTelegraph((g) => {
            const dirs = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
            dirs.forEach(angle => {
                g.lineStyle(22, 0x2a0509, 0.30);
                g.lineBetween(this.x, this.y, this.x + Math.cos(angle) * 420, this.y + Math.sin(angle) * 420);
                g.lineStyle(5, this.ritualTint, 0.78);
                g.lineBetween(this.x, this.y, this.x + Math.cos(angle) * 420, this.y + Math.sin(angle) * 420);
            });
        }, 640);
        this.asyncEvents.push(this.scene.time.delayedCall(360, () => {
            if (!this.active || this.hp <= 0) return;
            [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(angle => {
                this.spawnBossBullet(this.x, this.y, angle, 285, { tint: 0xff3150, scale: 1.32, life: 4200 });
            });
            this.playSkillSound();
        }));
    }

    fireBoneBarrage(player) {
        if (!this.scene || this.scene.isTransitioningOut || this.hp <= 0) return;
        this.startCastFlash(210, 0.004);
        const targetX = player.x;
        const targetY = player.y;
        const marks = [];
        for (let i = 0; i < 7; i++) {
            const angle = (i / 7) * Math.PI * 2;
            const radius = i === 0 ? 0 : 92 + (i % 2) * 42;
            marks.push({
                x: targetX + Math.cos(angle) * radius,
                y: targetY + Math.sin(angle) * radius
            });
        }
        this.drawTelegraph((g) => {
            marks.forEach(mark => {
                g.lineStyle(2, this.ritualTint, 0.68);
                g.strokeCircle(mark.x, mark.y, 24);
                g.lineStyle(1, 0xf5e6bd, 0.82);
                g.lineBetween(mark.x - 18, mark.y, mark.x + 18, mark.y);
                g.lineBetween(mark.x, mark.y - 18, mark.x, mark.y + 18);
            });
        }, 720);
        this.asyncEvents.push(this.scene.time.delayedCall(430, () => {
            if (!this.active || this.hp <= 0) return;
            marks.forEach((mark, index) => {
                const angle = Phaser.Math.Angle.Between(mark.x, mark.y - 90, mark.x, mark.y);
                this.spawnBossBullet(mark.x, mark.y - 90, angle, 230, { tint: 0xe6d6ad, scale: 1.1 + (index % 2) * 0.16, life: 2400 });
            });
            this.playSkillSound();
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
