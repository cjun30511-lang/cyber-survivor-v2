/**
 * Projectile.js - 玩家技能弹道与物理范围判定类
 * 包含：圣符飞矢 (TalismanProjectile)、玄火爆裂 (FireballProjectile) 和 圣光力场 (ShieldProjectile)
 */
import { GameState } from '../state/GameState.js';
import { RolePresentationConfig } from '../config/RolePresentationConfig.js';

// ============================================================================
// 1. 圣符飞矢 (净化单体弹道，依据不同化身角色特化为挥砍、跟踪、穿透或常规子弹)
// ============================================================================
export class TalismanProjectile extends Phaser.Physics.Arcade.Sprite {
    /**
     * @param {Phaser.Scene} scene 场景
     * @param {number} x 起始X
     * @param {number} y 起始Y
     * @param {number} vx X轴物理速度分量
     * @param {number} vy Y轴物理速度分量
     * @param {number} angle 飞行旋转角度
     * @param {number} damage 基础伤害值
     */
    constructor(scene, x, y, vx, vy, angle, damage) {
        // 根据玩家选中的角色化身动态加载纹理与大小
        const roleKey = (GameState.run && GameState.run.roleId) || GameState.meta.selectedRole || 'nun';
        const roleCfg = RolePresentationConfig.roles[roleKey];
        let texture = roleCfg ? roleCfg.projectileTexture : 'casterBullet';
        let tint = roleCfg ? roleCfg.themeColor : 0x00ffff;
        let scale = roleCfg ? roleCfg.projectileScale : 1.1;
        const pendingAsyncEvents = [];

        // A. 驱魔骑士 (Melee Sweep) 重载 - 3阶段重斩 combo 控制
        if (roleKey === 'exorcist') {
            const combo = scene.player ? (scene.player.exorcistCombo || 0) : 0;
            let heavySpeed = 220;

            if (combo === 0) {
                scale = 1.2;
                damage = Math.floor(damage * 1.3);
                heavySpeed = 240;
            } else if (combo === 1) {
                scale = 1.35;
                damage = Math.floor(damage * 1.5);
                heavySpeed = 240;
            } else {
                // Combo 3: 终极重落劈裂地爆发
                scale = 1.75;
                damage = Math.floor(damage * 2.2);
                heavySpeed = 160; // 终极劈砍前行稍慢，体积浩大且可读

                // 3阶段重落劈斩：延迟 100ms 触发黄金爆散和镜头大地震
                pendingAsyncEvents.push(scene.time.delayedCall(100, () => {
                    if (this.active && scene) {
                        scene.cameras.main.shake(120, 0.008);
                        if (scene.fireParticles) {
                            scene.fireParticles.emitParticleAt(this.x, this.y, 10, 0xe5a93c);
                        }
                    }
                }));
            }

            vx = Math.cos(angle) * heavySpeed;
            vy = Math.sin(angle) * heavySpeed;
        }

        // B. 影刃猎手 (Piercing Shadow Dagger) 重载
        if (roleKey === 'hunter') {
            scale = 1.0;
            const fastSpeed = 900; // 高速刺击
            vx = Math.cos(angle) * fastSpeed;
            vy = Math.sin(angle) * fastSpeed;
        }

        const nunMagicVariants = ['a', 'b', 'c', 'd'];
        const magicVariant = roleKey === 'nun'
            ? Phaser.Utils.Array.GetRandom(nunMagicVariants)
            : (roleKey === 'hunter' ? 'c' : (roleKey === 'necromancer' ? 'b' : 'a'));

        if (roleKey === 'nun') {
            texture = `talisman_proj_${magicVariant}`;
            scale = 0.52;
            const rangedSpeed = 640;
            vx = Math.cos(angle) * rangedSpeed;
            vy = Math.sin(angle) * rangedSpeed;
        } else if (roleKey === 'necromancer') {
            texture = 'talisman_proj_b';
            scale = 0.72;
        } else if (roleKey === 'hunter') {
            texture = 'talisman_proj_c';
            scale = 0.68;
        }

        super(scene, x, y, texture);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        // 播放高清 Variant 图集自旋/游走帧动画!
        if (roleKey === 'nun' || roleKey === 'necromancer' || roleKey === 'hunter') {
            this.play(`talisman_proj_${magicVariant}_anim`, true);
        }

        this.damage = damage;
        this.setDepth(8);
        if (roleKey !== 'nun') {
            this.setTint(tint);
        }
        this.setScale(scale);
        this.setAlpha(1);
        this.baseProjectileScale = scale;
        this.roleKey = roleKey;
        this.magicVariant = magicVariant;
        this.themeColor = tint;
        this.trailPoints = [];
        this.trailGraphics = null;
        this.homingSpeed = roleKey === 'nun' ? 640 : 0;

        if (roleKey === 'nun') {
            this.trailGraphics = scene.add.graphics().setDepth(9);
            this.setBlendMode(Phaser.BlendModes.ADD);
        }

        // 影刃猎手专属属性：穿透数及受击历史，防多帧物理重叠判定Bug
        if (roleKey === 'hunter') {
            this.pierceCount = 3;
            this.hitEnemies = new Set();
        }

        // 骑士圣光斩需要和挥动轨迹方向垂直对齐以形成扇形挥击感
        if (roleKey === 'exorcist') {
            this.rotation = angle + Math.PI / 2;
        } else {
            this.rotation = angle;
        }

        this.setVelocity(vx, vy);

        this.exploded = false;
        this.asyncEvents = pendingAsyncEvents;
        this.destroyed = false;

        // 产生飞行的专属流光拖尾 (Ghost/Mist/Spark Trail)
        const isExorcist = roleKey === 'exorcist';
        const isNun = roleKey === 'nun';

        this.trailTimer = scene.time.addEvent({
            delay: isNun ? 24 : (isExorcist ? 30 : 40),
            loop: true,
            callback: () => {
                if (!this.active || !this.scene || !this.body) return;
                if (this.scene.isTransitioningOut) return;
                if (this.scene.fireParticles) {
                    if (isNun) {
                        // 修女符箓拖尾：稀疏纸灰和骨白余光，避免低质橙色火星糊屏。
                        const travelAngle = Math.atan2(this.body.velocity.y, this.body.velocity.x);
                        for (let k = 0; k < 1; k++) {
                            const emitAngle = travelAngle + Math.PI + Phaser.Math.FloatBetween(-0.12, 0.12);
                            const pSpeed = Phaser.Math.FloatBetween(36, 78);
                            const pColor = Math.random() > 0.5 ? 0xf2efe2 : 0x7a1c1c;
                            const pScale = Phaser.Math.FloatBetween(0.24, 0.42);

                            const p = this.scene.add.sprite(this.x, this.y, 'fireParticle');
                            p.setDepth(12);
                            p.setScale(pScale);
                            p.setTint(pColor);

                            this.scene.physics.add.existing(p);
                            p.body.setVelocity(Math.cos(emitAngle) * pSpeed, Math.sin(emitAngle) * pSpeed);
                            p.body.setDrag(150);

                            this.scene.tweens.add({
                                targets: p,
                                alpha: 0,
                                scaleX: 0.05,
                                scaleY: 0.05,
                                duration: Phaser.Math.Between(140, 220),
                                onComplete: () => p.destroy()
                            });
                        }
                    } else if (isExorcist) {
                        // 驱魔骑士专属：短寿命、轻扇形、小体积、低亮度的黄金拖尾
                        const travelAngle = Math.atan2(this.body.velocity.y, this.body.velocity.x);
                        for (let k = 0; k < 3; k++) {
                            const emitAngle = travelAngle + Math.PI + Phaser.Math.FloatBetween(-0.2, 0.2);
                            const pSpeed = Phaser.Math.FloatBetween(40, 90);
                            const pX = this.x + Phaser.Math.FloatBetween(-12, 12);
                            const pY = this.y + Phaser.Math.FloatBetween(-12, 12);

                            const p = this.scene.add.sprite(pX, pY, 'fireParticle');
                            p.setDepth(12);
                            p.setScale(Phaser.Math.FloatBetween(0.4, 0.65));
                            p.setAlpha(Phaser.Math.FloatBetween(0.4, 0.7));
                            p.setTint(0xe5a93c); // 黄金

                            this.scene.physics.add.existing(p);
                            p.body.setVelocity(Math.cos(emitAngle) * pSpeed, Math.sin(emitAngle) * pSpeed);
                            p.body.setDrag(160);

                            this.scene.tweens.add({
                                targets: p,
                                alpha: 0,
                                scaleX: 0.05,
                                scaleY: 0.05,
                                duration: Phaser.Math.Between(120, 220),
                                onComplete: () => p.destroy()
                            });
                        }
                    } else {
                        this.scene.fireParticles.emitParticleAt(this.x, this.y, 1, this.themeColor);
                    }
                }
            }
        });

        // 销毁回收延时：驱魔骑士重斩Combo 3存在460ms，其余段存在360ms，其余子弹 3000ms
        const combo = (roleKey === 'exorcist' && scene.player) ? (scene.player.exorcistCombo || 0) : 0;
        const lifespan = roleKey === 'exorcist' ? (combo === 2 ? 460 : 360) : (roleKey === 'nun' ? 1600 : 3000);
        this.asyncEvents.push(this.scene.time.delayedCall(lifespan, () => {
            if (this.destroyed || this.scene?.isTransitioningOut) return;
            if (this.active) {
                this.destroy();
            }
        }));
    }

    /**
     * 修女远程火球命中：明确爆炸。
     */
    impact(tx, ty) {
        if (this.exploded || this.destroyed || this.scene?.isTransitioningOut) return;
        this.exploded = true;
        if (!this.scene) return;

        if (this.scene.soundSynth) {
            this.scene.soundSynth.play('hit');
        }
        this.scene.cameras.main.shake(60, 0.0028);

        // 播放高清 Variant 爆炸/撞击序列帧动画!
        let impKey = null;
        let impTexture = null;
        if (this.roleKey === 'nun') {
            impKey = `talisman_imp_${this.magicVariant}_anim`;
            impTexture = `talisman_imp_${this.magicVariant}`;
        } else if (this.roleKey === 'necromancer') {
            impKey = 'talisman_imp_b_anim';
            impTexture = 'talisman_imp_b';
        } else if (this.roleKey === 'hunter') {
            impKey = 'talisman_imp_c_anim';
            impTexture = 'talisman_imp_c';
        }

        if (impKey && impTexture) {
            const impSprite = this.scene.add.sprite(tx, ty, impTexture);
            impSprite.setDepth(11);
            impSprite.setScale(0.60);
            impSprite.setAlpha(0.92);

            // 注册切场安全清理机制
            const cleanImp = () => { if (impSprite && impSprite.destroy) impSprite.destroy(); };
            this.scene.events.once('shutdown', cleanImp);
            this.scene.events.once('destroy', cleanImp);

            impSprite.play(impKey, true);
            impSprite.once('animationcomplete-' + impKey, () => {
                if (this.scene) {
                    this.scene.events.off('shutdown', cleanImp);
                    this.scene.events.off('destroy', cleanImp);
                }
                impSprite.destroy();
            });
        } else {
            // Fallback impact: use broken slashes/debris instead of circular disks.
            const expG = this.scene.add.graphics();
            expG.setDepth(11);
            const shutdownListener = () => {
                if (expG && expG.destroy) expG.destroy();
            };
            this.scene.events.once('shutdown', shutdownListener);
            this.scene.events.once('destroy', shutdownListener);
            const shardAngles = [-0.9, -0.42, 0.08, 0.55, 1.02, 1.64, 2.35, 2.86];
            this.scene.tweens.add({
                targets: expG,
                alpha: 0,
                duration: 260,
                onUpdate: (tween) => {
                    if (!expG.active) return;
                    const progress = tween.progress;
                    expG.clear();

                    const fade = 1 - progress;
                    const spread = 18 + 54 * progress;
                    expG.lineStyle(5.5, 0xf2efe2, 0.9 * fade);
                    expG.lineBetween(tx - 18 * fade, ty - 4, tx + 22 * fade, ty + 5);
                    expG.lineStyle(3.2, 0x9a1f1f, 0.7 * fade);
                    expG.lineBetween(tx - 6, ty - 18 * fade, tx + 8, ty + 19 * fade);

                    shardAngles.forEach((angle, index) => {
                        const dist = spread + (index % 3) * 7;
                        const x = tx + Math.cos(angle) * dist;
                        const y = ty + Math.sin(angle) * dist;
                        const len = 8 + (index % 2) * 5;
                        expG.lineStyle(index % 2 ? 2.5 : 1.8, index % 2 ? 0xd9c38a : 0xd7d7d2, 0.75 * fade);
                        expG.lineBetween(
                            x - Math.cos(angle) * len,
                            y - Math.sin(angle) * len,
                            x + Math.cos(angle) * len,
                            y + Math.sin(angle) * len
                        );
                    });
                },
                onComplete: () => {
                    if (this.scene) {
                        this.scene.events.off('shutdown', shutdownListener);
                        this.scene.events.off('destroy', shutdownListener);
                    }
                    expG.destroy();
                }
            });
        }

        if (this.scene.fireParticles) {
            for (let i = 0; i < 5; i++) {
                this.scene.fireParticles.emitParticleAt(tx, ty, 1, Math.random() > 0.5 ? 0xf2efe2 : 0x8a1c1c);
            }
        }
    }

    /**
     * 每帧更新：实现死灵术士幽蓝导弹的自动索敌平滑曲线追踪
     */
    preUpdate(time, delta) {
        if (super.preUpdate) {
            super.preUpdate(time, delta);
        }

        if (this.active && this.body && this.roleKey === 'nun') {
            let target = null;
            let minDist = 520;
            if (this.scene && this.scene.enemiesGroup) {
                this.scene.enemiesGroup.getChildren().forEach(enemy => {
                    if (!enemy.active) return;
                    const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
                    if (dist < minDist) {
                        minDist = dist;
                        target = enemy;
                    }
                });
            }

            let velocityAngle = Math.atan2(this.body.velocity.y, this.body.velocity.x);
            if (target) {
                const targetAngle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
                velocityAngle = Phaser.Math.Angle.RotateTo(velocityAngle, targetAngle, 0.12);
                this.body.setVelocity(
                    Math.cos(velocityAngle) * this.homingSpeed,
                    Math.sin(velocityAngle) * this.homingSpeed
                );
            }

            this.rotation += 0.16;
            const pulse = 1 + Math.sin(time * 0.035) * 0.08;
            this.setScale(this.baseProjectileScale * pulse);
            this.trailPoints.push({ x: this.x, y: this.y });
            if (this.trailPoints.length > 10) {
                this.trailPoints.shift();
            }
            if (this.trailGraphics && this.trailGraphics.active) {
                this.trailGraphics.clear();
                for (let i = 1; i < this.trailPoints.length; i++) {
                    const prev = this.trailPoints[i - 1];
                    const curr = this.trailPoints[i];
                    const alpha = i / this.trailPoints.length;
                    this.trailGraphics.lineStyle(8 * alpha, 0x16110c, 0.16 * alpha);
                    this.trailGraphics.lineBetween(prev.x, prev.y, curr.x, curr.y);
                    this.trailGraphics.lineStyle(3.2 * alpha, 0xf2e6c9, 0.70 * alpha);
                    this.trailGraphics.lineBetween(prev.x, prev.y, curr.x, curr.y);
                }
                const travelAngle = Math.atan2(this.body.velocity.y, this.body.velocity.x);
                const tailAngle = travelAngle + Math.PI;
                const sideAngle = travelAngle + Math.PI / 2;
                const tail = 18;
                const side = 5;
                this.trailGraphics.fillStyle(0xf2e6c9, 0.24);
                this.trailGraphics.fillTriangle(
                    this.x + Math.cos(sideAngle) * side,
                    this.y + Math.sin(sideAngle) * side,
                    this.x + Math.cos(tailAngle) * tail,
                    this.y + Math.sin(tailAngle) * tail,
                    this.x - Math.cos(sideAngle) * side,
                    this.y - Math.sin(sideAngle) * side
                );
            }

            if (this.scene.fireParticles && Math.random() < 0.12) {
                this.scene.fireParticles.emitParticleAt(this.x, this.y, 1, Math.random() > 0.5 ? 0xf2efe2 : 0x7a1c1c);
            }
        }

        if (this.active && this.body && !this.scene?.isTransitioningOut && this.roleKey === 'necromancer') {
            let nearest = null;
            let minDist = 450; // 索敌半径 450 像素

            if (this.scene && this.scene.enemiesGroup) {
                this.scene.enemiesGroup.getChildren().forEach(enemy => {
                    if (enemy.active) {
                        const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
                        if (dist < minDist) {
                            minDist = dist;
                            nearest = enemy;
                        }
                    }
                });
            }

            if (nearest) {
                const targetAngle = Phaser.Math.Angle.Between(this.x, this.y, nearest.x, nearest.y);

                // 角度平滑弧形插值 (每帧限偏转 0.08 弧度)
                this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, targetAngle, 0.08);

                // 依据新角度重设速度
                const missileSpeed = 380;
                this.body.setVelocity(
                    Math.cos(this.rotation) * missileSpeed,
                    Math.sin(this.rotation) * missileSpeed
                );
            }
        }
    }

    preDestroy() {
        this.destroyed = true;
        if (this.trailGraphics) {
            this.trailGraphics.destroy();
            this.trailGraphics = null;
        }
        if (this.trailTimer) {
            this.trailTimer.destroy();
        }
        if (this.asyncEvents) {
            this.asyncEvents.forEach(event => { if (event && event.destroy) event.destroy(); });
            this.asyncEvents = [];
        }
        super.preDestroy();
    }
}

// ============================================================================
// 2. 玄火爆裂 (定时定位范围大火球爆炸)
// ============================================================================
export class FireballProjectile extends Phaser.Physics.Arcade.Sprite {
    /**
     * @param {Phaser.Scene} scene 场景
     * @param {number} tx 目标点X
     * @param {number} ty 目标点Y
     * @param {number} damage 爆炸伤害值
     * @param {number} radius 爆炸判定半径
     * @param {number} level 玄火技能等级
     */
    constructor(scene, tx, ty, damage, radius, level = 1) {
        let texture = 'fireball_unlock';
        if (level === 2) texture = 'fireball_lv2';
        else if (level === 3) texture = 'fireball_lv3';
        else if (level >= 4) texture = 'fireball_lv4_ultimate';

        super(scene, tx, ty, texture);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.damage = damage;
        this.radius = radius;
        this.level = level;
        this.setDepth(11); // 升级至战斗上层，高能曝光

        this.setVisible(false);
        this.body.setEnable(false); // 蓄力期间没有伤害碰撞
        this.asyncEvents = [];
        this.destroyed = false;

        // 1. 绘制蓄力法阵提示 (哥特猩红收缩法阵)
        const targetRing = scene.add.graphics();
        targetRing.lineStyle(2, 0xff5500, 0.4);
        targetRing.strokeCircle(tx, ty, radius);
        targetRing.fillStyle(0xff1a1a, 0.1);
        targetRing.fillCircle(tx, ty, 5);
        targetRing.setDepth(3);

        const cleanTargetRing = () => {
            if (targetRing && targetRing.destroy) targetRing.destroy();
        };
        scene.events.once('shutdown', cleanTargetRing);
        scene.events.once('destroy', cleanTargetRing);

        // 法阵收缩蓄力动效
        scene.tweens.add({
            targets: targetRing,
            alpha: { start: 0.2, to: 0.9 },
            scaleX: { start: 1.5, to: 1.0 },
            scaleY: { start: 1.5, to: 1.0 },
            x: tx * (1 - 1/1.5),
            y: ty * (1 - 1/1.5),
            duration: 350,
            onComplete: () => {
                if (scene && scene.events) {
                    scene.events.off('shutdown', cleanTargetRing);
                    scene.events.off('destroy', cleanTargetRing);
                }
                targetRing.destroy();
                if (this.active && !this.destroyed && !this.scene?.isTransitioningOut) {
                    this.explode(tx, ty);
                }
            }
        });
    }

    /**
     * 触发引爆，激活瞬间范围物理重叠判定
     */
    explode(tx, ty) {
        if (!this.scene || !this.body || this.destroyed || this.scene.isTransitioningOut) return;
        this.setVisible(true);
        this.body.setEnable(true);

        // 重设物理碰撞箱大小
        const bodyDiameter = this.radius * 2;
        this.setBodySize(bodyDiameter, bodyDiameter, true);
        this.setCircle(this.radius);

        // 瞬间将材质染成炫目红火并设置正确尺寸
        this.setTint(0xff3300);
        const targetScale = (this.radius * 2.2) / 384;
        this.setScale(0.1);

        // 播放爆炸 Web Audio 音效
        if (this.scene.soundSynth) {
            this.scene.soundSynth.play('hit');
        }

        // 播放专属升级序列帧动画
        const animKey = this.level === 2 ? 'fireball_lv2_anim' : (this.level === 3 ? 'fireball_lv3_anim' : (this.level >= 4 ? 'fireball_lv4_ultimate_anim' : 'fireball_unlock_anim'));
        this.play(animKey, true);

        // 极速向外扩张动效
        this.scene.tweens.add({
            targets: this,
            scaleX: targetScale,
            scaleY: targetScale,
            duration: 150,
            ease: 'Quad.easeOut'
        });

        // 喷发 15 个猩红/橙色火花粒子
        if (this.scene.fireParticles) {
            this.scene.fireParticles.emitParticleAt(tx, ty, 18, 0xff3300);
        }

        // 动画播放完成后，完美销毁
        this.once('animationcomplete-' + animKey, () => {
            if (this.active && !this.destroyed) {
                this.destroy();
            }
        });
    }

    preDestroy() {
        this.destroyed = true;
        if (this.asyncEvents) {
            this.asyncEvents.forEach(event => { if (event && event.destroy) event.destroy(); });
            this.asyncEvents = [];
        }
        super.preDestroy();
    }
}

// ============================================================================
// 3. 圣光力场 (玩家周身旋转环，高频贴身伤害，根据角色主题染色)
// ============================================================================
export class ShieldProjectile extends Phaser.Physics.Arcade.Sprite {
    /**
     * @param {Phaser.Scene} scene 场景
     * @param {Player} player 玩家实例
     * @param {number} index 在旋转群中的索引
     * @param {number} totalActive 当前总旋转体数
     * @param {number} distance 环绕半径
     * @param {number} damage 接触每跳伤害
     */
    constructor(scene, player, index, totalActive, distance, damage) {
        // totalActive corresponds to shield count which is equal to current shield level (1, 2, 3, 4)
        const level = totalActive || 1;
        let texture = 'shield_unlock_loop';
        if (level === 2) texture = 'shield_lv2_loop';
        else if (level === 3) texture = 'shield_lv3_loop';
        else if (level >= 4) texture = 'shield_lv4_loop';

        super(scene, player.x, player.y, texture);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.player = player;
        this.index = index;
        this.totalActive = totalActive;
        this.distance = distance;
        this.damage = damage;

        this.setDepth(9);

        // 根据角色契约主题给自旋法环染色
        const roleKey = (GameState.run && GameState.run.roleId) || GameState.meta.selectedRole || 'nun';
        const roleCfg = RolePresentationConfig.roles[roleKey];
        this.themeColor = roleCfg ? roleCfg.themeColor : 0xe5a93c;
        this.setTint(this.themeColor);

        // 适当调整力场贴图大小 (从384x384等比例缩放至适宜大小)
        this.setScale(0.24);

        // 播放高精度循环发光法阵动画
        const animKey = level === 2 ? 'shield_lv2_loop_anim' : (level === 3 ? 'shield_lv3_loop_anim' : (level >= 4 ? 'shield_lv4_loop_anim' : 'shield_unlock_loop_anim'));
        this.play(animKey, true);

        // 记录对不同怪物的独立伤害 Tick CD，防单帧超高额秒杀
        this.damagedEnemiesCooldown = new Map(); // Map<enemyId -> timestamp>

        // 物理包围盒缩小
        this.setCircle(38);
    }

    /**
     * 力场自旋心跳更新，挂载在场景 update 中
     * @param {number} time 当前毫秒时间
     */
    update(time) {
        if (!this.active || !this.player || !this.player.active) {
            this.destroy();
            return;
        }

        // 经典旋转角动力学计算 (2秒自转一圈)
        const rotationSpeed = 0.0035;
        const angleOffset = (this.index / this.totalActive) * Math.PI * 2;
        const currentAngle = time * rotationSpeed + angleOffset;

        const targetX = this.player.x + Math.cos(currentAngle) * this.distance;
        const targetY = this.player.y + Math.sin(currentAngle) * this.distance;

        this.setPosition(targetX, targetY);
        this.rotation = currentAngle;

        // 旋转流光微粒
        if (time % 15 === 0 && this.scene.fireParticles) {
            this.scene.fireParticles.emitParticleAt(this.x, this.y, 1, this.themeColor);
        }

        // 维护受击冷却 Map，防止过期引用造成内存泄漏 (每 2 秒清理一次)
        if (time % 2000 < 20) {
            for (let [enemyId, lastTime] of this.damagedEnemiesCooldown.entries()) {
                if (time - lastTime > 600) {
                    this.damagedEnemiesCooldown.delete(enemyId);
                }
            }
        }
    }

    /**
     * 判定是否能对敌人造成伤害 (0.5秒一跳伤害限制)
     * @param {string} enemyId 敌人唯一标识
     * @param {number} time 当前时间
     */
    canDamage(enemyId, time) {
        const lastDamageTime = this.damagedEnemiesCooldown.get(enemyId) || 0;
        if (time - lastDamageTime > 500) { // 500ms 伤害间隔
            this.damagedEnemiesCooldown.set(enemyId, time);
            return true;
        }
        return false;
    }
}
