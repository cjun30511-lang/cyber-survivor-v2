/**
 * IronTank.js - 重装坚体魔物（铁壁重装）
 * 封装高额生命值、慢移速寻路，以及重装霸体（受击物理击退抗性减半）核心特性
 * 新增脚底深紫色自旋转恶魔魔纹环 (Depth 5)
 */
import { Enemy } from './Enemy.js';
import { GameState } from '../state/GameState.js';

export class IronTank extends Enemy {
    /**
     * @param {Phaser.Scene} scene 场景
     * @param {number} x X坐标
     * @param {number} y Y坐标
     */
    constructor(scene, x, y) {
        super(scene, x, y, 'iron_tank', 'tank');

        // 销毁 Enemy 构造函数中创建的默认 floorRing，防止内存泄漏和 (0,0) 位置 of 孤儿 Graphics
        if (this.floorRing) {
            this.floorRing.destroy();
        }

        // 陨铁下砸 Spawn
        this.isSpawning = true;
        const targetY = y;
        this.y = targetY - 150; // 从上方 -150px 坠落
        this.setAlpha(0);

        this.scene.tweens.add({
            targets: this,
            y: targetY,
            alpha: 1,
            duration: 300,
            ease: 'Quad.easeIn',
            onComplete: () => {
                this.isSpawning = false;
                this.y = targetY;

                // 落地瞬间引发强烈的相机抖动
                if (this.scene && this.scene.cameras && this.scene.cameras.main) {
                    this.scene.cameras.main.shake(150, 0.008);
                }

                // 爆开一大圈向外扫荡的黄色灰尘扩震圈
                if (this.scene) {
                    const spawnWave = this.scene.add.graphics();
                    spawnWave.setDepth(4);
                    const footY = this.y + (this.body ? this.body.height / 2 : this.height / 2) - 4;
                    spawnWave.setPosition(this.x, footY);
                    
                    const cleanSpawnWave = () => { if (spawnWave && spawnWave.destroy) spawnWave.destroy(); };
                    this.scene.events.once('shutdown', cleanSpawnWave);
                    this.scene.events.once('destroy', cleanSpawnWave);

                    this.scene.tweens.add({
                        targets: spawnWave,
                        alpha: 0,
                        duration: 400,
                        onUpdate: (tween) => {
                            if (!spawnWave.active) return;
                            spawnWave.clear();
                            const radius = 45 * tween.progress;
                            spawnWave.lineStyle(2.5, 0xe5a93c, 0.7 * (1.0 - tween.progress));
                            spawnWave.strokeCircle(0, 0, radius);
                        },
                        onComplete: () => {
                            if (this.scene) {
                                this.scene.events.off('shutdown', cleanSpawnWave);
                                this.scene.events.off('destroy', cleanSpawnWave);
                            }
                            spawnWave.destroy();
                        }
                    });

                    // 飞溅黄色火尘粒子
                    if (this.scene.fireParticles) {
                        this.scene.fireParticles.emitParticleAt(this.x, footY, 8, 0xe5a93c);
                    }
                }
            }
        });

        // 初始化脚底自旋转深紫色恶魔魔纹环
        this.floorRing = this.scene.add.graphics().setDepth(5);
        this.floorAngle = 0;
        this.lastFootstepTime = 0;
        
        const ringColor = 0xa04ef6; // 幽雅深紫 (Amethyst Purple)
        // 绘制精细的同心圆和八角刻度 ticks
        this.floorRing.lineStyle(1.5, ringColor, 0.45);
        this.floorRing.strokeCircle(0, 0, 35);
        
        this.floorRing.lineStyle(1.0, ringColor, 0.28);
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const x1 = Math.cos(angle) * 26;
            const y1 = Math.sin(angle) * 26;
            const x2 = Math.cos(angle) * 31;
            const y2 = Math.sin(angle) * 31;
            this.floorRing.lineBetween(x1, y1, x2, y2);
        }
    }

    /**
     * 重写心跳：同步脚底法阵位置与自旋转呼吸动效，并实现重装骑士行走稳重感表现
     */
    update(time, player) {
        if (!this.active || !player || !player.active || GameState.run?.isGameOver) {
            this.setVelocity(0, 0);
            return;
        }

        if (this.isSpawning) {
            this.setVelocity(0, 0);
            if (this.floorRing && this.floorRing.active) {
                this.floorRing.setPosition(this.x, this.y + (this.body ? this.body.height / 2 : this.height / 2) - 4);
            }
            return;
        }

        super.update(time, player);

        // 1. 同板同步脚底法阵位置与自旋转呼吸动效
        if (this.floorRing && this.floorRing.active) {
            this.floorRing.setPosition(this.x, this.y + (this.body ? this.body.height / 2 : this.height / 2) - 4);
            this.floorAngle += 0.012; // 自转速度
            this.floorRing.setRotation(this.floorAngle);
            
            // 优雅的 scale 呼吸脉冲
            const pulse = 1 + Math.sin(time * 0.005) * 0.05;
            this.floorRing.setScale(pulse);
        }

        // 2. 重装怪行走表现分层：步伐直立无倾角，慢速正弦呼吸起伏
        this.setAngle(0); // 稳重且无前倾
        const bob = Math.sin(time * 0.005) * 1.8; // 慢速正弦步履下坠呼吸
        this.setDisplayOrigin(this.width / 2, this.height / 2 + bob);

        // 3. 每隔 800ms 踏地产生扩张尘土气浪圈，距玩家较近时产生轻微相机震动
        const isMoving = this.body && (Math.abs(this.body.velocity.x) > 1 || Math.abs(this.body.velocity.y) > 1);
        if (isMoving && !this.isKnockedBack) {
            if (!this.lastFootstepTime) {
                this.lastFootstepTime = time;
            }
            if (time - this.lastFootstepTime >= 800) {
                this.lastFootstepTime = time;

                // 产生向外扩展的溅射圆形尘土气浪 (350ms 内渐隐消失，高安全性)
                const footstepWave = this.scene.add.graphics();
                footstepWave.setDepth(4); // 处于地面上，怪堆下
                const footY = this.y + (this.body ? this.body.height / 2 : this.height / 2) - 4;
                footstepWave.setPosition(this.x, footY);

                const cleanup = () => {
                    if (footstepWave && footstepWave.destroy) footstepWave.destroy();
                };
                this.scene.events.once('shutdown', cleanup);
                this.scene.events.once('destroy', cleanup);

                this.scene.tweens.add({
                    targets: footstepWave,
                    alpha: 0,
                    duration: 350,
                    onUpdate: (tween) => {
                        if (!footstepWave.active) return;
                        footstepWave.clear();
                        const radius = 28 * tween.progress;
                        // 尘灰色圆环 (向外极速扩张的灰黑色尘土震波圆环)
                        footstepWave.lineStyle(1.8, 0x333333, 0.6 * (1 - tween.progress));
                        footstepWave.strokeCircle(0, 0, radius);
                    },
                    onComplete: () => {
                        if (this.scene) {
                            this.scene.events.off('shutdown', cleanup);
                            this.scene.events.off('destroy', cleanup);
                        }
                        footstepWave.destroy();
                    }
                });

                // 距玩家较近时产生轻微相机震动 (220px内)
                const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                if (dist < 220) {
                    this.scene.cameras.main.shake(100, 0.002);
                }
            }
        }
    }

    /**
     * 重写击退：重装铁甲享有 60% 物理霸体抗性，击退距离大幅缩短
     * @param {number} angle 击退角度
     * @param {number} force 击退力度
     */
    applyKnockback(angle, force = 280) {
        // 重甲坦克阻力极强，击退力量削弱为原来的 40%
        const resistForce = force * 0.4;
        
        this.isKnockedBack = true;
        this.knockbackTime = this.scene.time.now + this.knockbackDuration;
        this.setVelocity(Math.cos(angle) * resistForce, Math.sin(angle) * resistForce);
    }
}

export default IronTank;
