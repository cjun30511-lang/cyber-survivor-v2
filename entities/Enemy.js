/**
 * Enemy.js - 敌人基类
 * 抽象并实现魔物的通用属性、AI寻路、受击白闪、受力物理颤抖、死亡爆发与地表血迹驻留机制
 */
import { EnemyConfig } from '../config/EnemyConfig.js';
import { GameState } from '../state/GameState.js';
import { SoundSynth } from '../utils/SoundSynth.js';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
    /**
     * @param {Phaser.Scene} scene 挂载的战斗场景
     * @param {number} x 初始X
     * @param {number} y 初始Y
     * @param {string} texture 材质纹理名 (如 'skeleton_bug')
     * @param {string} configKey 对应的配置主键 ('skeleton' | 'ghost' | 'tank' | 'boss')
     */
    constructor(scene, x, y, texture, configKey) {
        super(scene, x, y, texture);

        // 1. 获取配置属性
        this.configKey = configKey;
        const config = EnemyConfig[configKey];
        if (!config) {
            console.error(`[Enemy] 无法为 ${configKey} 找到对应的 EnemyConfig 配置！`);
        }

        this.maxHp = config ? config.maxHp : 20;
        this.hp = this.maxHp;
        this.speed = config ? config.speed : 80;
        this.damage = config ? config.damage : 10;
        this.xpReward = config ? config.xpReward : 15;
        this.goldReward = config ? config.goldReward : 1;
        this.isBoss = Boolean(config?.isBoss) || configKey.startsWith('boss');
        this.isTank = Boolean(config?.isTank) || configKey === 'tank';
        this.isCaster = Boolean(config?.isCaster) || configKey === 'ghost';
        this.animPrefix = config?.animPrefix || configKey;

        // 2. 物理与渲染设定
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setDepth(6);
        this.baseScale = config ? config.scale : 0.2;
        this.setScale(this.baseScale);
        this.floorRing = null;
        this.solidBacking = null;

        // 5. 精英与首领脚底识别环 (低对比度、低饱和度，绝不抢戏)
        if (this.isBoss || this.isTank) {
            this.floorRing = scene.add.graphics();
            this.floorRing.setDepth(4); // 处于怪堆 (6) 与地表 (2) 之间

            const radius = this.isBoss ? 45 : 25;
            const ringColor = this.isBoss ? 0x8a1c1c : 0x481e5c; // 暗红 (Boss) / 暗紫 (Tank)
            const ringAlpha = this.isBoss ? 0.35 : 0.28;

            // 绘制外圈
            this.floorRing.lineStyle(1.5, ringColor, ringAlpha);
            this.floorRing.strokeCircle(0, 0, radius);

            // 绘制内同心圆
            this.floorRing.lineStyle(1.0, ringColor, ringAlpha * 0.7);
            this.floorRing.strokeCircle(0, 0, radius * 0.7);

            // 绘制 4 个极其细微的刻度十字
            this.floorRing.beginPath();
            for (let i = 0; i < 4; i++) {
                const ang = i * Math.PI / 2;
                this.floorRing.moveTo(Math.cos(ang) * (radius - 4), Math.sin(ang) * (radius - 4));
                this.floorRing.lineTo(Math.cos(ang) * (radius + 2), Math.sin(ang) * (radius + 2));
            }
            this.floorRing.strokePath();
        }

        // 3. 碰撞体包围盒校准
        if (config) {
            this.setBodySize(config.hitboxWidth, config.hitboxHeight, true);
        }

        // 4. 受击颤抖与击退状态变量
        this.isKnockedBack = false;
        this.knockbackTime = 0;
        this.knockbackDuration = 150; // 击退僵直 150ms
        this.asyncEvents = [];
        this.hitFlashUntil = 0;
        this.movePhase = Math.random() * Math.PI * 2;
        this.lastVelocityAngle = 0;
        this.visualLift = 0;

        // 6. Spawn animation for small monsters
        if (!this.isTank && !this.isBoss) {
            this.isSpawning = true;
            this.setScale(0);
            this.setAlpha(0);

            this.scene.tweens.add({
                targets: this,
                scaleX: this.baseScale,
                scaleY: this.baseScale,
                alpha: 1,
                angle: 360,
                duration: 250,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    this.isSpawning = false;
                    this.setAlpha(1);
                    this.setScale(this.baseScale);
                    this.setAngle(0);
                }
            });

            // Foot dust/soil particles when spawning:
            for (let i = 0; i < 4; i++) {
                this.scene.time.delayedCall(Phaser.Math.Between(0, 200), () => {
                    if (!this.active || !this.scene?.fireParticles) return;
                    this.scene.fireParticles.emitParticleAt(this.x + Phaser.Math.Between(-10, 10), this.y + (this.body ? this.body.height / 2 : this.height / 2), 1, 0x8a7f72);
                });
            }
        }
    }

    /**
     * 魔物AI与心跳判定
     * @param {number} time 当前毫秒级游戏时间
     * @param {Player} player 玩家实例引用
     */
    update(time, player) {
        if (!this.active || !player || !player.active || GameState.run?.isGameOver) {
            this.setVelocity(0, 0);
            return;
        }

        if (this.isSpawning) {
            this.setVelocity(0, 0);
            return;
        }

        // 稳定更新脚底识别环位置和旋转 (即使被击退或僵直也要保证锚定)
        if (this.floorRing && this.floorRing.active) {
            this.floorRing.setPosition(this.x, this.y + (this.body ? this.body.height / 2 : this.height / 2) - 4);
            this.floorRing.setAngle(time * 0.04); // rotate slowly
        }

        // 如果处于击退僵直期，暂时阻断 AI 追踪
        if (this.isKnockedBack) {
            if (time > this.knockbackTime) {
                this.isKnockedBack = false;
            } else {
                return;
            }
        }

        // 基础 AI：直线狂热奔向玩家
        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        const pressure = Phaser.Math.Clamp((dist - 36) / 180, 0.3, 1);

        // 速度倾角或缩放微动 (小兵呼吸感)
        this.setFlipX(player.x < this.x);
        this.lastVelocityAngle = angle;

        this.setVelocity(Math.cos(angle) * this.speed * pressure, Math.sin(angle) * this.speed * pressure);

        this.updateVisuals(time, player);
    }

    /**
     * 视觉表现心跳更新
     */
    updateVisuals(time, player) {
        if (this.isSpawning || !this.active || this.hp <= 0) return;

        const vx = this.body ? this.body.velocity.x : 0;
        const vy = this.body ? this.body.velocity.y : 0;
        const speedSq = vx * vx + vy * vy;
        const isMoving = speedSq > 10;

        // 朝向水平翻转
        this.setFlipX(player.x < this.x);

        // 如果是幽灵，有 controlled float 悬浮慢动，其余地面单位无任何漂移，死锁 foot anchor
        if (this.isCaster) {
            const floatVal = Math.sin(time * 0.005 + this.movePhase);
            const bobY = floatVal * 4.5;
            this.setDisplayOrigin(this.width / 2, this.height / 2 + bobY);
        } else {
            this.setDisplayOrigin(this.width / 2, this.height / 2);
            this.setAngle(0);
        }

        // 如果正在播放受击或死亡动画，不要覆盖
        if (this.anims.currentAnim?.key) {
            if (this.anims.currentAnim.key.endsWith('_death_anim') || this.anims.currentAnim.key.endsWith('_hit_anim')) {
                this.syncSolidBacking();
                return;
            }
        }

        const walkKey = this.isBoss ? `${this.animPrefix}_idle_anim` : (this.isCaster ? `${this.animPrefix}_float_anim` : `${this.animPrefix}_walk_anim`);
        if (this.anims.currentAnim?.key !== walkKey) {
            this.play(walkKey, true);
        }

        // 走动时脚底灰尘
        if (isMoving && time % 20 === 0 && this.scene.fireParticles) {
            this.scene.fireParticles.emitParticleAt(this.x, this.y + (this.body ? this.body.height / 2 : this.height / 2), 1, 0x8a7f72);
        }
        this.syncSolidBacking();
    }

    syncSolidBacking() {
        if (!this.solidBacking || !this.solidBacking.active) return;
        this.solidBacking.setPosition(this.x, this.y);
        this.solidBacking.setScale(this.scaleX * (this.isBoss ? 1.01 : 1.015), this.scaleY * (this.isBoss ? 1.01 : 1.015));
        this.solidBacking.setAngle(this.angle);
        this.solidBacking.setFlipX(this.flipX);
        this.solidBacking.setVisible(this.visible && this.alpha > 0 && this.hp > 0);
        this.solidBacking.setAlpha(this.alpha * (this.isBoss ? 0.92 : 0.82));
        this.solidBacking.setDisplayOrigin(this.displayOriginX, this.displayOriginY);
        if (this.frame?.name !== undefined) {
            this.solidBacking.setFrame(this.frame.name);
        }
    }

    /**
     * 敌人受击击退
     * @param {number} angle 击退物理方向夹角
     * @param {number} force 击退力度
     */
    applyKnockback(angle, force = 280) {
        if (this.isBoss) return; // Boss 免疫常规击退

        this.isKnockedBack = true;
        this.knockbackTime = this.scene.time.now + this.knockbackDuration;
        this.setVelocity(Math.cos(angle) * force, Math.sin(angle) * force);
    }

    /**
     * 敌人承受伤害判定
     * @param {number} damage 基础伤害值
     * @param {boolean} isCrit 是否暴击
     * @param {number} angle 击退角度
     */
    takeDamage(damage, isCrit, angle = null) {
        if (!this.active || this.scene?.isTransitioningOut || this.hp <= 0) return;

        this.hp -= damage;
        this.hitFlashUntil = this.scene.time.now + (isCrit ? 180 : 120);

        // 1. 浮空飘字
        const fontColor = isCrit ? '#e5a93c' : '#ff1a1a';
        const label = isCrit ? `💥 -${damage}!` : `-${damage}`;
        const fontSize = isCrit ? 24 : 16;
        if (this.scene.dmgTextPool) {
            this.scene.dmgTextPool.showText(this.x, this.y - 20, label, fontColor, fontSize, isCrit);
        }

        // 2. 受击红闪 / 白闪
        const isMinor = (!this.isBoss && !this.isTank);
        const flashColor = isMinor ? 0xff2222 : 0xffffff;
        const flashDuration = isCrit ? 90 : 60;

        this.setTintFill(flashColor);
        this.asyncEvents.push(this.scene.time.delayedCall(flashDuration, () => {
            if (this.active) {
                this.clearTint();
                if (this.isBoss) {
                    this.setTint(0xff3333);
                }
            }
        }));

        // 3. 播放受击序列帧动画 (幽灵除外)
        if (!this.isCaster && this.hp > 0) {
            const hitAnimKey = `${this.animPrefix}_hit_anim`;
            this.play(hitAnimKey, true);
        }

        // 4. 顿步或击退
        if (this.isTank && this.active && this.body) {
            this.setVelocity(0, 0);
            const originalMoves = this.body.moves;
            this.body.moves = false;
            this.isKnockedBack = true;
            this.knockbackTime = this.scene.time.now + 80;

            const localStiffEvent = this.scene.time.delayedCall(80, () => {
                if (this.active && this.body) {
                    this.body.moves = originalMoves;
                    this.isKnockedBack = false;
                }
            });
            this.asyncEvents.push(localStiffEvent);
        } else {
            if (angle !== null) {
                this.applyKnockback(angle, isCrit ? 360 : 300);
            }
        }

        // 5. 尘屑与金属火花
        if (this.scene.fireParticles) {
            if (this.isTank) {
                const baseSparkAngle = (angle !== null) ? angle : Math.random() * Math.PI * 2;
                for (let i = 0; i < 10; i++) {
                    const pAngle = baseSparkAngle + Phaser.Math.FloatBetween(-0.5, 0.5);
                    const pSpeed = Phaser.Math.FloatBetween(120, 240);

                    const spark = this.scene.add.graphics();
                    spark.fillStyle(0xffaa00, 1);
                    spark.fillRect(-2, -2, 4, 4);
                    spark.setPosition(this.x, this.y);
                    spark.setDepth(12);
                    this.scene.physics.add.existing(spark);
                    spark.body.setVelocity(Math.cos(pAngle) * pSpeed, Math.sin(pAngle) * pSpeed);
                    spark.body.setDrag(100);

                    const cleanSpark = () => { if (spark && spark.destroy) spark.destroy(); };
                    this.scene.events.once('shutdown', cleanSpark);
                    this.scene.events.once('destroy', cleanSpark);

                    this.scene.tweens.add({
                        targets: spark,
                        alpha: 0,
                        scaleX: 0.1,
                        scaleY: 0.1,
                        duration: Phaser.Math.Between(200, 400),
                        onComplete: () => {
                            if (this.scene) {
                                this.scene.events.off('shutdown', cleanSpark);
                                this.scene.events.off('destroy', cleanSpark);
                            }
                            spark.destroy();
                        }
                    });
                }
            } else {
                const sparkColor = isCrit ? 0xe5a93c : 0xffffff;
                const sparkCount = isCrit ? 6 : 3;
                this.scene.fireParticles.emitParticleAt(this.x, this.y, sparkCount, sparkColor);
            }
        }

        if (this.isTank) {
            this.scene.cameras.main.shake(80, 0.004);
        } else if (this.isBoss) {
            this.scene.cameras.main.shake(100, 0.007);
        }

        if (Math.random() < 0.3) {
            SoundSynth.play('hit');
        }

        if (isCrit) {
            this.scene.events.emit('crit_hit');
        }

        if (this.hp <= 0) {
            this.die();
        }
    }

    /**
     * 魔物彻底净化超度
     */
    die() {
        if (!this.active) return;
        const ex = this.x;
        const ey = this.y;
        const scene = this.scene;

        if (!scene || scene.isTransitioningOut || !scene.sys?.isActive()) {
            this.destroy();
            return;
        }

        // 瞬间关闭物理引擎 body 碰撞与移动，防止死尸战力拉满或碰撞主角
        if (this.body) {
            this.body.enable = false;
            this.setVelocity(0, 0);
        }

        SoundSynth.play('hit');

        // 1. 战地血溅地表持久化驻留机制 (RenderTexture 合并绘制)
        if (scene.bloodLayer) {
            const bloodSprite = scene.add.graphics();
            // 地表血迹加深暗红与暗紫：低饱和、偏干涸，不抢掉落物可见性 (Alpha降为0.45)
            bloodSprite.fillStyle(this.isBoss ? 0x2b0404 : (this.isTank ? 0x190320 : 0x2c0606), 0.45);
            const bRad = this.isBoss ? 45 : (this.isTank ? 25 : 12);
            bloodSprite.fillCircle(0, 0, bRad);

            // 溅射细节水滴
            for (let i = 0; i < 5; i++) {
                const spAngle = Math.random() * Math.PI * 2;
                const spDist = Math.random() * bRad * 1.8;
                const spSize = Math.random() * (bRad * 0.3) + 1.5;
                bloodSprite.fillCircle(Math.cos(spAngle) * spDist, Math.sin(spAngle) * spDist, spSize);
            }

            scene.bloodLayer.draw(bloodSprite, ex, ey);
            bloodSprite.destroy(); // 绘制完毕立即销毁
        }

        // 2. 环形气浪爆散死亡冲击波 (VFX 仪式感)
        const wave = scene.add.graphics();
        const roleKey = (GameState.run && GameState.run.roleId) || GameState.meta.selectedRole || 'exorcist';
        const waveColor = roleKey === 'nun' ? 0xff1a1a : (this.isBoss ? 0x8a0000 : (this.isTank ? 0x4a0e4e : (this.isCaster ? 0xb8860b : 0xcfc5b3)));
        wave.lineStyle(2.5, waveColor, 1);
        wave.strokeCircle(0, 0, 10);
        wave.setPosition(ex, ey);
        wave.setDepth(5);

        // 统一注册场景销毁/切场清理机制，杜绝孤儿/残留 Graphics
        const cleanWave = () => {
            if (wave && wave.destroy) wave.destroy();
        };
        scene.events.once('shutdown', cleanWave);
        scene.events.once('destroy', cleanWave);

        scene.tweens.add({
            targets: wave,
            scaleX: this.isBoss ? 8.5 : 3.5,
            scaleY: this.isBoss ? 8.5 : 3.5,
            alpha: 0,
            duration: 320,
            onComplete: () => {
                if (scene && scene.events) {
                    scene.events.off('shutdown', cleanWave);
                    scene.events.off('destroy', cleanWave);
                }
                wave.destroy();
            }
        });

        // 3. 爆发爆散物理微粒
        if (scene.deathParticles) {
            scene.deathParticles.emitParticleAt(ex, ey, 8);
        }
        if (scene.binaryParticles0 && scene.binaryParticles1) {
            scene.binaryParticles0.emitParticleAt(ex, ey, 3);
            scene.binaryParticles1.emitParticleAt(ex, ey, 3);
        }

        // 4. 统计累加与首领超度特化
        if (GameState.run) {
            GameState.run.score += this.isBoss ? 2000 : (this.isTank ? 250 : 100);
            GameState.run.kills++;
        }

        // 如果是首领，触发壮烈的净化大爆炸 (全屏白金闪烁 + 镜头大地震 + 30颗圣光粒子喷薄)
        if (this.isBoss) {
            scene.cameras.main.shake(300, 0.02);

            const flash = scene.add.graphics();
            flash.fillStyle(0xffffff, 1);
            flash.fillRect(0, 0, 720, 1280);
            flash.setScrollFactor(0);
            flash.setDepth(99);

            // 统一注册场景销毁/切场清理机制，杜绝孤儿/残留 Graphics
            const cleanFlash = () => {
                if (flash && flash.destroy) flash.destroy();
            };
            scene.events.once('shutdown', cleanFlash);
            scene.events.once('destroy', cleanFlash);

            scene.tweens.add({
                targets: flash,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    if (scene && scene.events) {
                        scene.events.off('shutdown', cleanFlash);
                        scene.events.off('destroy', cleanFlash);
                    }
                    flash.destroy();
                }
            });

            if (scene.fireParticles) {
                scene.fireParticles.emitParticleAt(ex, ey, 30, 0xe5a93c);
            }
            scene.events.emit('boss_killed');
        }

        // 5. 分发掉落物请求至场景
        if (!scene.isTransitioningOut && scene.sys?.isActive()) {
            scene.events.emit('spawn_loot', { x: ex, y: ey, enemyKey: this.configKey });
        }

        // 6. 播放实际死亡序列帧动画并销毁
        const animKey = `${this.animPrefix}_death_anim`;
        this.play(animKey, true);

        this.once('animationcomplete-' + animKey, () => {
            this.destroy();
        });
    }

    destroy(fromScene) {
        if (this.asyncEvents) {
            this.asyncEvents.forEach(event => event?.destroy?.());
            this.asyncEvents = [];
        }
        if (this.floorRing) {
            this.floorRing.destroy();
            this.floorRing = null;
        }
        if (this.solidBacking) {
            this.solidBacking.destroy();
            this.solidBacking = null;
        }
        super.destroy(fromScene);
    }
}

export default Enemy;
