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

        if (roleKey === 'nun') {
            // 修女主攻击改成真正的远程火球。
            texture = 'fireball';
            scale = 0.9;
            const rangedSpeed = 640;
            vx = Math.cos(angle) * rangedSpeed;
            vy = Math.sin(angle) * rangedSpeed;
        }

        super(scene, x, y, texture);
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.damage = damage;
        this.setDepth(8);
        this.setTint(tint);
        this.setScale(scale);
        this.setAlpha(0.98);
        this.baseProjectileScale = scale;
        this.roleKey = roleKey;
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
            delay: isNun ? 16 : (isExorcist ? 30 : 40),
            loop: true,
            callback: () => {
                if (!this.active || !this.scene || !this.body) return;
                if (this.scene.isTransitioningOut) return;
                if (this.scene.fireParticles) {
                    if (isNun) {
                        // 血焰修女专属：极其密集的双流光粒子，向后扇形抛洒，带阻尼 (短寿命180-260ms，快速释放回收)
                        const travelAngle = Math.atan2(this.body.velocity.y, this.body.velocity.x);
                        for (let k = 0; k < 2; k++) {
                            const emitAngle = travelAngle + Math.PI + Phaser.Math.FloatBetween(-0.12, 0.12);
                            const pSpeed = Phaser.Math.FloatBetween(50, 100);
                            const pColor = Math.random() > 0.5 ? 0xffaa00 : 0xff1a1a;
                            const pScale = Phaser.Math.FloatBetween(0.4, 0.7);

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
                                duration: Phaser.Math.Between(180, 260),
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
        const expG = this.scene.add.graphics();
        expG.setDepth(11);
        const shutdownListener = () => {
            if (expG && expG.destroy) expG.destroy();
        };
        this.scene.events.once('shutdown', shutdownListener);
        this.scene.events.once('destroy', shutdownListener);
        const maxRadius = 86;
        this.scene.tweens.add({
            targets: expG,
            alpha: 0,
            duration: 260,
            onUpdate: (tween) => {
                if (!expG.active) return;
                const progress = tween.progress;
                expG.clear();

                expG.fillStyle(0xff2a00, (1 - progress) * 0.48);
                expG.fillCircle(tx, ty, maxRadius * progress);
                expG.lineStyle(5.5, 0xff1a1a, 1 - progress);
                expG.strokeCircle(tx, ty, maxRadius * progress);
                expG.lineStyle(3.2, 0xffcc66, 0.9 - progress * 0.7);
                expG.strokeCircle(tx, ty, maxRadius * 0.62 * progress);
                expG.fillStyle(0xffffff, Math.max(0, 0.95 - progress * 1.15));
                expG.fillCircle(tx, ty, 28 * (1 - progress * 0.7));
            },
            onComplete: () => {
                if (this.scene) {
                    this.scene.events.off('shutdown', shutdownListener);
                    this.scene.events.off('destroy', shutdownListener);
                }
                expG.destroy();
            }
        });
        if (this.scene.fireParticles) {
            for (let i = 0; i < 20; i++) {
                this.scene.fireParticles.emitParticleAt(tx, ty, 1, Math.random() > 0.5 ? 0xff1a1a : 0xffaa00);
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
                    this.trailGraphics.lineStyle(7 * alpha, 0x3a1208, 0.18 * alpha);
                    this.trailGraphics.lineBetween(prev.x, prev.y, curr.x, curr.y);
                    this.trailGraphics.lineStyle(2.8 * alpha, 0xf0b35d, 0.62 * alpha);
                    this.trailGraphics.lineBetween(prev.x, prev.y, curr.x, curr.y);
                }
                this.trailGraphics.fillStyle(0xff6a22, 0.16);
                this.trailGraphics.fillCircle(this.x, this.y, 13);
                this.trailGraphics.fillStyle(0xfff0c2, 0.2);
                this.trailGraphics.fillCircle(this.x - 3, this.y - 3, 4);
            }

            if (this.scene.fireParticles && time % 5 === 0) {
                this.scene.fireParticles.emitParticleAt(this.x, this.y, 1, Math.random() > 0.5 ? 0xffaa00 : 0xff3300);
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
     */
    constructor(scene, tx, ty, damage, radius) {
        super(scene, tx, ty, 'casterBullet');
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.damage = damage;
        this.radius = radius;
        this.setDepth(4); // 处于地表
        
        this.setVisible(false);
        this.body.setEnable(false); // 蓄力期间没有伤害碰撞
        this.asyncEvents = [];
        this.destroyed = false;

        // 1. 绘制蓄力法阵提示
        const targetRing = scene.add.graphics();
        targetRing.lineStyle(2, 0xff5500, 0.4);
        targetRing.strokeCircle(tx, ty, radius);
        targetRing.fillStyle(0xff1a1a, 0.1);
        targetRing.fillCircle(tx, ty, 5);
        targetRing.setDepth(3);

        // 统一注册场景销毁/切场清理机制，杜绝孤儿/残留 Graphics
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
            x: tx * (1 - 1/1.5), // 校准缩放位移
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
        
        // 瞬间将材质染成炫目红火
        this.setTint(0xff1a1a);
        this.setScale(0.2); // 从极小瞬间爆开

        // 播放爆炸 Web Audio 音效
        if (this.scene.soundSynth) {
            this.scene.soundSynth.play('hit');
        }

        // 2. 绘制双层血色魔纹法阵与三道渐隐冲击波
        const explodeCircle = this.scene.add.graphics();
        explodeCircle.setDepth(5);
        
        // 绘制双层血红法阵印记
        explodeCircle.lineStyle(3, 0xff1a1a, 0.85);
        explodeCircle.strokeCircle(tx, ty, this.radius);
        explodeCircle.lineStyle(1.5, 0xff5500, 0.65);
        explodeCircle.strokeCircle(tx, ty, this.radius * 0.7);
        
        // 画个象征性的八角星或十字魔纹在里面
        explodeCircle.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const rx = tx + Math.cos(angle) * this.radius;
            const ry = ty + Math.sin(angle) * this.radius;
            explodeCircle.moveTo(tx, ty);
            explodeCircle.lineTo(rx, ry);
        }
        explodeCircle.strokePath();
        
        // 统一注册场景销毁/切场清理机制，杜绝孤儿/残留 Graphics
        const cleanExplodeCircle = () => {
            if (explodeCircle && explodeCircle.destroy) explodeCircle.destroy();
        };
        this.scene.events.once('shutdown', cleanExplodeCircle);
        this.scene.events.once('destroy', cleanExplodeCircle);

        // 让这个法阵微弱旋转并淡出
        this.scene.tweens.add({
            targets: explodeCircle,
            alpha: 0,
            angle: 45, // 旋转45度
            duration: 350,
            onComplete: () => {
                if (this.scene) {
                    this.scene.events.off('shutdown', cleanExplodeCircle);
                    this.scene.events.off('destroy', cleanExplodeCircle);
                }
                explodeCircle.destroy();
            }
        });

        // 产生 3 道迅速向外扩散的余震波环
        for (let r = 1; r <= 3; r++) {
            const shockwave = this.scene.add.graphics();
            shockwave.setDepth(5);
            shockwave.lineStyle(2.5, 0xff3300, 0.95);
            shockwave.strokeCircle(tx, ty, this.radius * 0.2);
            
            // 统一注册场景销毁/切场清理机制，杜绝孤儿/残留 Graphics
            const cleanShockwave = () => {
                if (shockwave && shockwave.destroy) shockwave.destroy();
            };
            this.scene.events.once('shutdown', cleanShockwave);
            this.scene.events.once('destroy', cleanShockwave);

            this.scene.tweens.add({
                targets: shockwave,
                scaleX: 2.2 + r * 0.5,
                scaleY: 2.2 + r * 0.5,
                alpha: 0,
                x: tx * (1 - (2.2 + r * 0.5)), // 修正缩放中心
                y: ty * (1 - (2.2 + r * 0.5)),
                duration: 200 + r * 100, // 逐个淡出
                onComplete: () => {
                    if (this.scene) {
                        this.scene.events.off('shutdown', cleanShockwave);
                        this.scene.events.off('destroy', cleanShockwave);
                    }
                    shockwave.destroy();
                }
            });
        }

        // 喷发 15 个猩红/橙色火花粒子
        if (this.scene.fireParticles) {
            this.scene.fireParticles.emitParticleAt(tx, ty, 15, 0xff3300);
        }

        // 4. 0.15秒后伤害帧结束，销毁投射物
        this.asyncEvents = this.asyncEvents || [];
        this.asyncEvents.push(this.scene.time.delayedCall(150, () => {
            if (this.active && !this.destroyed) this.destroy();
        }));
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
        super(scene, player.x, player.y, 'shield');
        
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
        
        // 适当调整力场贴图大小
        this.setScale(0.18);
        
        // 记录对不同怪物的独立伤害 Tick CD，防单帧超高额秒杀
        this.damagedEnemiesCooldown = new Map(); // Map<enemyId -> timestamp>

        // 物理包围盒缩小
        this.setCircle(35);
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
