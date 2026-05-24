/**
 * GhostCaster.js - 远程魔物（幽灵祭司）
 * 封装中距探测、自主追击/持法停步切换、远程魔法弹施法射击逻辑
 */
import { Enemy } from './Enemy.js';
import { EnemyConfig } from '../config/EnemyConfig.js';
import { SoundSynth } from '../utils/SoundSynth.js';

export class GhostCaster extends Enemy {
    /**
     * @param {Phaser.Scene} scene 场景
     * @param {number} x X坐标
     * @param {number} y Y坐标
     */
    constructor(scene, x, y) {
        super(scene, x, y, 'ghost_caster', 'ghost');

        // 独有参数
        this.lastShootTime = 0;
        this.shootCooldown = EnemyConfig.ghost.shootCooldown || 3000;
        this.bulletSpeed = EnemyConfig.ghost.bulletSpeed || 200;
        this.asyncEvents = [];
        this.castWindupUntil = 0;
    }

    /**
     * 幽灵法师的心跳 AI 重写
     * @param {number} time 当前时间
     * @param {Player} player 玩家对象
     */
    update(time, player) {
        if (!this.active || !player || !player.active) {
            this.setVelocity(0, 0);
            return;
        }

        if (this.isSpawning) {
            this.setVelocity(0, 0);
            return;
        }

        // 稳定更新脚底识别环
        if (this.floorRing && this.floorRing.active) {
            this.floorRing.setPosition(this.x, this.y + (this.body ? this.body.height / 2 : this.height / 2) - 4);
            this.floorRing.setAngle(time * 0.04);
        }

        // 击退僵直中
        if (this.isKnockedBack) {
            if (time > this.knockbackTime) {
                this.isKnockedBack = false;
            } else {
                return;
            }
        }

        // 计算与玩家的物理距离
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        this.setFlipX(player.x < this.x);

        // 如果在射程内 (如 300 像素内)，则减速/停步并开始吟唱射击
        if (dist < 300) {
            const trackAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            const isCasting = time < this.castWindupUntil;
            const strafe = Math.sin(time * 0.004 + this.movePhase) * 0.35;
            const moveAngle = trackAngle + strafe;
            this.lastVelocityAngle = moveAngle;
            this.setVelocity(
                Math.cos(moveAngle) * this.speed * (isCasting ? 0.08 : 0.28),
                Math.sin(moveAngle) * this.speed * (isCasting ? 0.08 : 0.28)
            );

            // 吟唱时间判定
            if (time - this.lastShootTime > this.shootCooldown) {
                this.lastShootTime = time;
                this.castWindupUntil = time + 280;
                this.shootBullet(player);
            }
        } else {
            // 正常寻路移动
            const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            this.lastVelocityAngle = angle;
            this.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
        }

        // 调用基类的 updateVisuals
        this.updateVisuals(time, player);
    }

    /**
     * 发射魔法弹
     */
    shootBullet(player) {
        if (!this.scene || !this.scene.casterBullets || this.scene.isTransitioningOut || this.hp <= 0) return;

        // 播放施法动画
        this.play('ghost_cast_anim', true);

        // 瞬间高闪蓄力
        this.setTintFill(0x00ffff);
        this.asyncEvents.push(this.scene.time.delayedCall(120, () => {
            if (this.active && this.hp > 0 && !this.scene?.isTransitioningOut) this.clearTint();
        }));

        // 在第 3 帧左右 (也就是 300ms) 释放弹道，完美匹配施法节奏
        this.asyncEvents.push(this.scene.time.delayedCall(300, () => {
            if (!this.active || !this.scene || this.scene.isTransitioningOut || this.hp <= 0) return;

            // 创建魔法弹
            const bullet = this.scene.physics.add.sprite(this.x, this.y, 'casterBullet');
            bullet.setDepth(8);

            // 魔法弹拖尾微粒子与发光
            bullet.setTint(0x00ffff);
            bullet.setScale(0.85);

            this.scene.casterBullets.add(bullet);

            // 指向玩家的速度向量
            const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            bullet.setVelocity(Math.cos(angle) * this.bulletSpeed, Math.sin(angle) * this.bulletSpeed);
            bullet.rotation = angle;

            // 粒子辅助
            if (this.scene.fireParticles) {
                this.scene.fireParticles.emitParticleAt(this.x, this.y, 4);
            }

            // 5秒后自动回收，防止内存溢出
            this.asyncEvents.push(this.scene.time.delayedCall(5000, () => {
                if (bullet && bullet.active) {
                    bullet.destroy();
                }
            }));
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

export default GhostCaster;
