/**
 * CharacterPresentationSystem.js - 角色表现与接地视觉呈现系统
 * 模块化管理角色六大状态机表现、前倾角度计算、重心起伏、起步与停步的挤压拉伸（Squash & Stretch）动效、武器插值及脚底特色足迹粒子
 */
import { GameState } from '../state/GameState.js';
import { RolePresentationConfig } from '../config/RolePresentationConfig.js';
import { PlayerConfig } from '../config/PlayerConfig.js';
import { SoundSynth } from '../utils/SoundSynth.js';

export class CharacterPresentationSystem {
    /**
     * @param {Player} player 挂载的玩家物理实体
     */
    constructor(player) {
        this.player = player;
        this.scene = player.scene;

        // 1. 初始化呈现状态层
        this.state = 'idle'; // 'idle' | 'move' | 'dash' | 'attack' | 'hit' | 'dead'
        this.lastIsMoving = false;
        
        // 2. 基础配置参数同步
        this.roleKey = (GameState.run && GameState.run.roleId) || GameState.meta.selectedRole || 'nun';
        this.roleCfg = RolePresentationConfig.roles[this.roleKey] || RolePresentationConfig.roles.nun;
        this.themeColor = this.roleCfg.themeColor;
        this.weaponScale = 1.0;
        this.isAttacking = false;
        this.destroyed = false;
        this.asyncEvents = [];
        this.recoilOffset = { x: 0, y: 0 };
        this.combatGlowUntil = 0;

        // 3. 构建接地脚底阴影 (半透明黑椭圆，固定在脚底，不随上下起伏)
        this.shadow = this.scene.add.graphics();
        this.shadow.fillStyle(0x000000, 0.45);
        this.shadow.fillEllipse(0, 0, 58, 20);
        this.shadow.setDepth(9); // Player Shadow depth 9

        // 4. 构建武器渲染精灵
        this.weapon = this.scene.add.sprite(this.player.x, this.player.y, `weapon_${this.roleKey}`);
        this.weapon.setDepth(11); // Player (10) < Weapon (11)

        // 根据武器类型微调锚点和比例 (大幅调大武器，匹配翻倍的角色尺寸)
        if (this.roleKey === 'exorcist') {
            this.weapon.setOrigin(0.5, 0.85); // 黄金重剑护手剑格
            this.weaponScale = 1.85;
        } else if (this.roleKey === 'nun') {
            this.weapon.setOrigin(0.5, 0.9);
            this.weaponScale = 1.08;
        } else if (this.roleKey === 'necromancer') {
            this.weapon.setOrigin(0.5, 0.5);  // 死灵法典中心浮空
            this.weaponScale = 1.7;
        } else if (this.roleKey === 'hunter') {
            this.weapon.setOrigin(0.5, 0.85); // 影刺匕首握柄
            this.weaponScale = 1.8;
        }
        this.weapon.setScale(this.weaponScale);

        // 设置玩家化身颜色染
        this.applyRoleVisual();

        // 5. 构建魔能连接线专属容器 (Depth 9，位于角色投影上方，角色下方)
        this.magicEffects = this.scene.add.graphics();
        this.magicEffects.setDepth(9);

        // 6. 血焰修女专属：底盘高亮魔法光环
        if (this.roleKey === 'nun') {
            this.halo = this.scene.add.graphics();
            this.halo.setDepth(9); // 位于人物下方
        }

        // 7. 主角专属：高可读性背光微芒 (Backlight Glow)，使角色剪影从暗黑战场及魔物堆叠中完美脱颖而出
        this.backlight = this.scene.add.graphics();
        this.backlight.setDepth(9.5); // 位于法阵 (9) 上方，角色身躯 (10) 下方
    }

    trackEvent(event) {
        if (event) this.asyncEvents.push(event);
        return event;
    }

    safeDelayedCall(delay, callback) {
        if (!this.scene || this.destroyed) return null;
        return this.trackEvent(this.scene.time.delayedCall(delay, () => {
            if (this.destroyed || !this.scene || !this.player || !this.player.active) return;
            callback();
        }));
    }

    clearAsyncEvents() {
        this.asyncEvents.forEach(event => {
            if (event && event.destroy) event.destroy();
            else if (event && event.remove) event.remove(false);
        });
        this.asyncEvents = [];
    }

    applyRoleVisual() {
        if (!this.player) return;
        if (this.roleCfg && this.roleCfg.tint !== null && this.roleCfg.tint !== undefined) {
            this.player.setTint(this.roleCfg.tint);
            this.player.setAlpha(1);
            return;
        }
        this.player.clearTint();
        this.player.setAlpha(1);
    }

    /**
     * 呈现系统帧同步更新，接管行走前倾、重心起伏、武器悬浮、脚底尘埃
     * @param {number} time 当前游戏运行的绝对时间
     * @param {number} delta 帧差时间
     * @param {number} vx 当前帧物理速度X
     * @param {number} vy 当前帧物理速度Y
     */
    update(time, delta, vx, vy) {
        if (this.destroyed || this.scene?.isTransitioningOut) {
            return;
        }
        if (!GameState.run || GameState.run.isGameOver || this.state === 'dead') {
            return;
        }

        const isNun = this.roleKey === 'nun';
        const speedSq = vx * vx + vy * vy;
        const isMoving = speedSq > 10;
        const recoilX = this.recoilOffset.x || 0;
        const recoilY = this.recoilOffset.y || 0;

        // A. 稳定更新脚底投影位置和反相位/波纹表现
        if (this.shadow) {
            this.shadow.setPosition(this.player.x + recoilX * 0.18, this.player.y + 28 + recoilY * 0.12);
            if (this.player.visible) {
                if (this.state === 'cast_windup') {
                    // 阴影缩窄至原先的 40%，Alpha 降至 0.18
                    this.shadow.setScale(0.4, 0.4);
                    this.shadow.setAlpha(0.18);
                } else if (this.state === 'cast_release') {
                    // 阴影在脚底瞬间拉大并加黑（Alpha 0.6）
                    this.shadow.setScale(1.4, 1.4);
                    this.shadow.setAlpha(0.6);
                } else if (this.state === 'move') {
                    // 奔跑时脚底黑影椭圆横向拉长、纵向变扁，并随着步频频率产生高频波纹脉冲
                    const wavePulse = 1.0 + Math.sin(time * 0.016) * 0.08;
                    this.shadow.setScale(1.25 * wavePulse, 0.75 * wavePulse);
                    this.shadow.setAlpha(0.45);
                } else {
                    // idle: 逆向浮空/反相位阴影：身体浮至最高点时变小变淡，沉至最低点时变大变浓
                    const floatVal = Math.sin(time * 0.005); // -1 to 1
                    const shadowScale = 0.975 - floatVal * 0.125;
                    const shadowAlpha = 0.40 - floatVal * 0.15;
                    this.shadow.setScale(shadowScale);
                    this.shadow.setAlpha(shadowAlpha);
                }
            } else {
                this.shadow.setAlpha(0);
            }
        }

        // B. 武器位置与姿态同步 (非攻击/施法时)
        if (this.weapon && this.weapon.active) {
            this.weapon.setAlpha(this.player.visible ? 1 : 0);
            if (!this.isAttacking) {
                if (isNun) {
                    // 计算移动引起的惯性偏移 (向速度相反方向偏移，表现物理滞后阻力感)
                    let moveLagX = 0;
                    let moveLagY = 0;
                    if (isMoving) {
                        const speed = Math.sqrt(speedSq);
                        moveLagX = (-vx / speed) * 10;
                        moveLagY = (-vy / speed) * 6;
                    }
                    // 悬浮权杖极低频在身侧划椭圆 8 字轨（time * 0.003）
                    const orbitX = (this.player.flipX ? -34 : 34) + Math.cos(time * 0.003) * 5.5 + moveLagX * 0.6;
                    const orbitY = -18 + Math.sin(time * 0.006) * 5.5 + moveLagY * 0.5;
                    this.weapon.setPosition(this.player.x + orbitX + recoilX * 0.16, this.player.y + orbitY + recoilY * 0.16);
                    this.weapon.setFlipX(this.player.flipX);
                    
                    // 武器角度随正弦波呈现微弱摆动
                    const angleBreathing = Math.sin(time * 0.005) * 6;
                    this.weapon.setAngle(this.player.flipX ? -15 + angleBreathing : 15 + angleBreathing);
                    this.weapon.setScale(this.weaponScale * (1.0 + Math.sin(time * 0.004) * 0.05));
                } else {
                    const wBob = Math.sin(time * 0.012) * 2.2;
                    let targetX = this.player.x;
                    let targetY = this.player.y + 4 + wBob;
                    
                    const angleBreathing = Math.sin(time * 0.006) * 4;
                    let targetAngle = 12 + angleBreathing;
                    
                    if (this.player.flipX) {
                        this.weapon.setFlipX(true);
                        targetAngle = -12 + angleBreathing;
                        targetX -= 8;
                    } else {
                        this.weapon.setFlipX(false);
                        targetX += 8;
                    }
                    this.weapon.setPosition(targetX + recoilX * 0.2, targetY + recoilY * 0.2);
                    this.weapon.setAngle(targetAngle);
                    this.weapon.setScale(this.weaponScale);
                }
            } else {
                // 攻击/施法状态下，武器的具体坐标由状态分支在 update 或是 playAttackAnimation 控制
                if (this.state === 'cast_windup') {
                    // 权杖高托至头顶，高频共振颤抖 (Math.sin(time*0.06)*2px)
                    const trembleX = Math.sin(time * 0.06) * 2;
                    const trembleY = Math.cos(time * 0.06) * 2;
                    this.weapon.setPosition(this.player.x + trembleX, this.player.y - 40 + trembleY);
                    this.weapon.setAngle(this.player.flipX ? -25 : 25);
                    this.weapon.setScale(this.weaponScale * 1.35);
                    this.weapon.setFlipX(this.player.flipX);
                } else if (this.state === 'cast_release') {
                    // 权杖极速前砸，爆发性前倾
                    const isFlip = this.player.flipX;
                    const targetAngleDeg = this.targetAttackAngle !== undefined ? Phaser.Math.RadToDeg(this.targetAttackAngle) : (isFlip ? 180 : 0);
                    const blastAngle = targetAngleDeg + (isFlip ? -35 : 35);
                    this.weapon.setAngle(blastAngle);
                    this.weapon.setScale(this.weaponScale * 1.4);
                    this.weapon.setPosition(this.player.x + (isFlip ? -25 : 25), this.player.y + 12);
                    this.weapon.setFlipX(isFlip);
                }
            }
        }

        // C. 如果在冲刺 Dash 表现中，跳过行走/待机表现
        if (this.state === 'dash') {
            return;
        }

        // D. 动作状态机切换与原生序列帧播放同步
        if (this.state !== 'cast_windup' && this.state !== 'cast_release' && this.state !== 'cast_recovery' && this.state !== 'hit') {
            if (isNun) {
                if (isMoving && this.state !== 'move') {
                    this.state = 'move';
                    this.player.off('animationcomplete-player_run_start_anim');
                    this.player.off('animationcomplete-player_run_stop_anim');
                    this.player.play('player_run_anim', true);
                } else if (!isMoving && this.state !== 'idle') {
                    this.state = 'idle';
                    this.player.off('animationcomplete-player_run_start_anim');
                    this.player.off('animationcomplete-player_run_stop_anim');
                    this.player.play('player_idle_anim', true);
                }
            } else {
                // 其他非修女角色保持经典直接切换
                if (isMoving && !this.lastIsMoving) {
                    this.state = 'move';
                } else if (!isMoving && this.lastIsMoving) {
                    this.state = 'idle';
                }
            }
            this.lastIsMoving = isMoving;
        }

        // E. 核心姿态控制与粒子
        if (this.state === 'cast_windup' || this.state === 'cast_release' || this.state === 'cast_recovery') {
            // 施法动作完全由 playAttackAnimation 状态机驱动，不在此覆盖 Angle
        } else if (this.state === 'move') {
            // 行走姿态朝向与粒子
            if (vx !== 0) {
                const newFlip = vx < 0;
                if (this.player.flipX !== newFlip) {
                    this.player.setFlipX(newFlip);
                }
            }
            
            if (isNun) {
                // 修女新逐帧资产本身已具备完美的 15 度身体前倾动作，无需任何程序化前倾补偿！
                this.player.setAngle(0);
                this.player.setDisplayOrigin(64, 64);
                if (!this.scaleTweenActive) {
                    this.player.setScale(PlayerConfig.baseScale, PlayerConfig.baseScale);
                }
            } else {
                // 跑动：程序化前倾 8.5 度，强化其他角色的前冲动能与速度感
                this.player.setAngle(this.player.flipX ? -8.5 : 8.5);

                // 跑动：程序化 Y 轴高频颠簸起伏与果冻拉伸 (完美同步步频周期)
                if (!this.scaleTweenActive) {
                    const runBob = Math.sin(time * 0.018) * 1.6;
                    this.player.setDisplayOrigin(64, 64 + runBob);
                    
                    const runSquash = 1.0 + Math.sin(time * 0.018) * 0.015;
                    this.player.setScale(PlayerConfig.baseScale * (2.0 - runSquash), PlayerConfig.baseScale * runSquash);
                } else {
                    this.player.setDisplayOrigin(64, 64);
                }
            }

            // 播放移动帧动画
            if (this.player.anims.currentAnim?.key !== 'player_run_anim') {
                this.player.play('player_run_anim', true);
            }

            // 行走脚底尘埃/修女冷色圣辉拖尾粒子发射
            if (isNun && time % 8 === 0 && this.scene.fireParticles) {
                const speed = Math.sqrt(speedSq);
                const dx = -vx / speed;
                const dy = -vy / speed;
                const emitX = this.player.x + dx * 6 + Phaser.Math.Between(-3, 3);
                const emitY = this.player.y + 36 + dy * 2 + Phaser.Math.Between(-3, 3);
                const pColor = Math.random() > 0.5 ? 0xf5efe3 : 0xd8d1c4;

                const p = this.scene.add.sprite(emitX, emitY, 'fireParticle');
                p.setDepth(9); 
                p.setScale(Phaser.Math.FloatBetween(0.45, 0.75));
                p.setTint(pColor);

                this.scene.physics.add.existing(p);
                p.body.setVelocity(
                    dx * Phaser.Math.FloatBetween(40, 80) + Phaser.Math.FloatBetween(-10, 10),
                    dy * Phaser.Math.FloatBetween(40, 80) + Phaser.Math.FloatBetween(-10, 10)
                );
                p.body.setDrag(150);

                this.scene.tweens.add({
                    targets: p,
                    alpha: 0,
                    scaleX: 0.05,
                    scaleY: 0.05,
                    duration: Phaser.Math.Between(200, 400),
                    onComplete: () => p.destroy()
                });
            } else if (!isNun) {
                const particleInterval = 12;
                if (time % particleInterval === 0 && this.scene.fireParticles) {
                    this.scene.fireParticles.emitParticleAt(this.player.x, this.player.y + 36, 1, this.themeColor);
                }
            }
        } else {
            // 待机姿态播放
            this.player.setAngle(0);
            if (this.player.anims.currentAnim?.key !== 'player_idle_anim') {
                this.player.play('player_idle_anim', true);
            }

            if (isNun) {
                // 修女新待机资产本身已具备精美呼吸和上下悬浮起伏，直接使用原图比例和原点
                this.player.setDisplayOrigin(64, 64);
                if (!this.scaleTweenActive) {
                    this.player.setScale(PlayerConfig.baseScale, PlayerConfig.baseScale);
                }
            } else {
                // 待机：程序化低频悬浮呼吸微动 (Y轴浮空 5.5px，配合阴影反相位收放，达成其他角色的超感悬浮漂浮感)
                if (!this.scaleTweenActive) {
                    const floatVal = Math.sin(time * 0.005);
                    const bobY = floatVal * 5.5; // 离地悬浮微晃 5.5px
                    this.player.setDisplayOrigin(64, 64 + bobY);
                    
                    // 待机呼吸微弱缩放
                    this.player.setScale(PlayerConfig.baseScale * (1.0 - floatVal * 0.02), PlayerConfig.baseScale * (1.0 + floatVal * 0.03));
                } else {
                    this.player.setDisplayOrigin(64, 64);
                }
            }

            // 修女待机时脚底偶尔浮现微弱骨白火星
            if (isNun && time % 35 === 0 && this.scene.fireParticles) {
                this.scene.fireParticles.emitParticleAt(this.player.x + Phaser.Math.Between(-10, 10), this.player.y + 36, 1, 0xece5d8);
            }
        }

        // G. 血焰修女专属：连结“修女身体”与“浮空法器核心”的魔能等离子焰链 (Tether) - 缩细至 1.0 像素细纹，降低透明度
        if (this.magicEffects && isNun && this.weapon && this.weapon.active) {
            this.magicEffects.clear();
            if (this.player.visible) {
                const startX = this.player.x + (this.player.flipX ? -15 : 15);
                const startY = this.player.y - 4;
                const endX = this.weapon.x;
                const endY = this.weapon.y - 24; // 权杖香炉聚能核心处

                const midX = (startX + endX) / 2 + Math.sin(time * 0.018) * 6.5;
                const midY = (startY + endY) / 2 + Math.cos(time * 0.018) * 6.5;

                const tetherCurve = new Phaser.Curves.QuadraticBezier(
                    new Phaser.Math.Vector2(startX, startY),
                    new Phaser.Math.Vector2(midX, midY),
                    new Phaser.Math.Vector2(endX, endY)
                );
                const tetherPoints = tetherCurve.getPoints(16);

                // 冷银主链线
                this.magicEffects.lineStyle(1.0, 0xe9e1d4, 0.24 + Math.sin(time * 0.02) * 0.04);
                this.magicEffects.strokePoints(tetherPoints, false, false);

                // 象牙白核心线
                this.magicEffects.lineStyle(0.6, 0xf7f2ea, 0.34);
                this.magicEffects.strokePoints(tetherPoints, false, false);
            }
        }

        if (this.combatGlowUntil > time && this.magicEffects && this.player.visible) {
            const progress = Phaser.Math.Clamp((this.combatGlowUntil - time) / 180, 0, 1);
            this.magicEffects.lineStyle(1.5, this.themeColor, progress * 0.18);
            this.magicEffects.strokeCircle(this.player.x, this.player.y - 6, 24 + (1 - progress) * 12);
        }

        // H. 血焰修女专属：底盘魔法光环实时绘制 - 降权为暗黑色调地毯图章，不干扰肢体轮廓
        if (this.halo && this.halo.active && this.roleKey === 'nun') {
            this.halo.clear();
            if (this.player.visible) {
                const hx = this.player.x;
                const hy = this.player.y + 36;
                const floatVal = Math.sin(time * 0.005);
                const radius = 28 + floatVal * 2;
                
                this.halo.lineStyle(1.0, 0xece3d5, 0.16 + Math.sin(time * 0.01) * 0.03);
                this.halo.strokeCircle(hx, hy, radius);
                
                this.halo.lineStyle(1.0, 0xcfc5b3, 0.12);
                this.halo.strokeCircle(hx, hy, radius * 0.68);
                
                this.halo.fillStyle(0xe7dece, 0.08);
                this.halo.lineStyle(1.0, 0xf6efe4, 0.12);
                const angleOffset = time * 0.0012;
                for (let i = 0; i < 4; i++) {
                    const ang = angleOffset + (i * Math.PI) / 2;
                    const dx = hx + Math.cos(ang) * radius;
                    const dy = hy + Math.sin(ang) * radius;
                    
                    const rx1 = hx + Math.cos(ang) * (radius * 1.02);
                    const ry1 = hy + Math.sin(ang) * (radius * 1.02);
                    const rx2 = hx + Math.cos(ang + Math.PI / 4) * (radius * 0.22);
                    const ry2 = hy + Math.sin(ang + Math.PI / 4) * (radius * 0.22);
                    const rx3 = hx + Math.cos(ang - Math.PI / 4) * (radius * 0.22);
                    const ry3 = hy + Math.sin(ang - Math.PI / 4) * (radius * 0.22);
                    
                    const petalCurveA = new Phaser.Curves.QuadraticBezier(
                        new Phaser.Math.Vector2(hx, hy),
                        new Phaser.Math.Vector2(rx2, ry2),
                        new Phaser.Math.Vector2(rx1, ry1)
                    );
                    const petalCurveB = new Phaser.Curves.QuadraticBezier(
                        new Phaser.Math.Vector2(rx1, ry1),
                        new Phaser.Math.Vector2(rx3, ry3),
                        new Phaser.Math.Vector2(hx, hy)
                    );
                    const petalPoints = petalCurveA.getPoints(8).concat(petalCurveB.getPoints(8).slice(1));
                    this.halo.strokePoints(petalPoints, true, true);
                    this.halo.fillPoints(petalPoints, true, true);

                    this.halo.fillCircle(dx, dy, 1.0);
                }
            }
        }

        // I. 主角高可读性专属：绘制高亮角色剪影背光微发光 - 调整为极薄极淡轮廓光 (Rim Light)，仅提升黑白剪影对比，绝不溢出遮盖
        if (this.backlight && this.backlight.active) {
            this.backlight.clear();
            if (this.player.visible) {
                const bx = this.player.x;
                const by = this.player.y - 12; // 略微向上偏移至躯干中心
                
                // 压缩背光物理半径 (38px 降至 20px)
                const glowPulse = 1.0 + Math.sin(time * 0.006) * 0.12;
                const baseRadius = 20 * glowPulse;
                
                const glowColor = this.themeColor || 0xffaa00;
                
                // 外层极其稀薄边缘光
                this.backlight.fillStyle(glowColor, 0.02);
                this.backlight.fillCircle(bx, by, baseRadius * 1.4);
                
                // 内层微芒核心
                this.backlight.fillStyle(glowColor, 0.05);
                this.backlight.fillCircle(bx, by, baseRadius * 0.85);
            }
        }
    }

    /**
     * 触发转向瞬间的横向果冻弹跳 (Turn Bounce)
     */
    triggerTurnBounce() {
        if (this.state === 'dead' || this.state === 'dash' || this.isAttacking) return;
        this.scaleTweenActive = true;
        this.scene.tweens.killTweensOf(this.player);
        this.scene.tweens.add({
            targets: this.player,
            scaleX: PlayerConfig.baseScale * 0.82,
            scaleY: PlayerConfig.baseScale * 1.18,
            duration: 80,
            yoyo: true,
            repeat: 0,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.scaleTweenActive = false;
                this.player.setScale(PlayerConfig.baseScale);
            }
        });
    }

    /**
     * 触发起步惯性挤压 Tween (Squash & Stretch)
     */
    triggerStartMoveTween() {
        this.scaleTweenActive = true;
        this.scene.tweens.killTweensOf(this.player);
        this.scene.tweens.add({
            targets: this.player,
            scaleX: PlayerConfig.baseScale * 1.1,
            scaleY: PlayerConfig.baseScale * 0.9,
            duration: 100,
            yoyo: true,
            repeat: 0,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.scaleTweenActive = false;
            }
        });
    }

    /**
     * 触发收步停顿回弹 Tween (Overshoot拉伸)
     */
    triggerStopMoveTween() {
        this.scaleTweenActive = true;
        this.scene.tweens.killTweensOf(this.player);
        this.scene.tweens.add({
            targets: this.player,
            scaleX: PlayerConfig.baseScale * 0.95,
            scaleY: PlayerConfig.baseScale * 1.08,
            duration: 150,
            yoyo: true,
            repeat: 0,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.scaleTweenActive = false;
            }
        });
    }

    /**
     * 触发冲刺闪避视觉效果 (极速方向形变、多重化身专属色残影拖尾)
     */
    triggerDash(vx, vy) {
        const lastState = this.state;
        this.state = 'dash';

        // 冲刺方向极端拉伸形变
        this.scaleTweenActive = true;
        this.scene.tweens.killTweensOf(this.player);
        this.player.setScale(PlayerConfig.baseScale * 1.35, PlayerConfig.baseScale * 0.7);

        // 产生 5 次带有化身专属色彩的渐隐残影拖尾 (Ghost Trails)
        const trailColor = this.themeColor || 0xe5a93c;
        const trailTimer = this.trackEvent(this.scene.time.addEvent({
            delay: 30,
            repeat: 4,
            callback: () => {
                if (!this.player.active || !this.scene) return;
                const ghost = this.scene.add.sprite(this.player.x, this.player.y, 'player');
                ghost.setAlpha(0.45);
                ghost.setTint(trailColor); // 化身主色调残影
                ghost.setFlipX(this.player.flipX);
                ghost.setScale(this.player.scaleX, this.player.scaleY);
                ghost.setDepth(this.player.depth - 1);
                
                this.scene.tweens.add({
                    targets: ghost,
                    alpha: 0,
                    scaleX: 0.05,
                    scaleY: 0.05,
                    duration: 250,
                    onComplete: () => ghost.destroy()
                });
            }
        }));

        // 冲刺结束后恢复常规比例
        this.safeDelayedCall(this.player.dashDuration, () => {
            this.scaleTweenActive = false;
            this.player.setScale(PlayerConfig.baseScale);
            if (this.state === 'dash') {
                this.state = lastState;
            }
            if (trailTimer) trailTimer.destroy();
        });
    }

    /**
     * 播放攻击/施法表现
     */
    playAttackAnimation(angle) {
        if (!this.weapon || !this.weapon.active || this.isAttacking) return;
        this.isAttacking = true;
        this.combatGlowUntil = this.scene.time.now + 160;

        const targetDeg = Phaser.Math.RadToDeg(angle);

        // 攻击动作的身体微形变 (蓄力张力 - 仅非骑士角色使用默认)
        if (this.roleKey !== 'exorcist') {
            this.scaleTweenActive = true;
            this.scene.tweens.killTweensOf(this.player);
            this.scene.tweens.add({
                targets: this.player,
                scaleX: PlayerConfig.baseScale * 0.85,
                scaleY: PlayerConfig.baseScale * 1.15,
                duration: 80,
                yoyo: true,
                repeat: 0,
                onComplete: () => {
                    this.scaleTweenActive = false;
                }
            });
        }

        if (this.roleKey === 'exorcist') {
            const combo = this.player.exorcistCombo || 0;
            this.scaleTweenActive = true;
            this.scene.tweens.killTweensOf(this.player);
            this.scene.tweens.killTweensOf(this.weapon);

            // 根据 combo 决定蓄力与打击角
            let pullbackAngle = 0;
            let strikeEndAngle = 0;
            
            if (combo === 0) {
                // Combo 1: 顺时针弧度挥砍
                pullbackAngle = targetDeg + (this.player.flipX ? 90 : -90);
                strikeEndAngle = targetDeg + (this.player.flipX ? -90 : 90);
            } else if (combo === 1) {
                // Combo 2: 逆时针弧度挥砍
                pullbackAngle = targetDeg + (this.player.flipX ? -90 : 90);
                strikeEndAngle = targetDeg + (this.player.flipX ? 90 : -90);
            } else {
                // Combo 3: 终极重落劈砍
                pullbackAngle = targetDeg - 180;
                strikeEndAngle = targetDeg;
            }

            // 身体蓄力压缩比例 (Combo 3 特别深沉)
            const squashX = combo === 2 ? 0.78 : 0.85;
            const squashY = combo === 2 ? 1.28 : 1.2;
            
            this.player.setScale(PlayerConfig.baseScale * squashX, PlayerConfig.baseScale * squashY);

            // Phase 1: Pullback (蓄力起手 80ms)
            this.scene.tweens.add({
                targets: this.weapon,
                angle: pullbackAngle,
                scaleX: this.weaponScale * (combo === 2 ? 0.8 : 0.85),
                scaleY: this.weaponScale * (combo === 2 ? 0.8 : 0.85),
                duration: 80,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    if (!this.player.active || !this.weapon.active) return;
                    
                    // Phase 2: Strike (急速挥击)
                    // 身体横向拉伸且前倾出击 (Combo 3 拉伸极强)
                    const stretchX = combo === 2 ? 1.35 : 1.22;
                    const stretchY = combo === 2 ? 0.75 : 0.82;
                    this.player.setScale(PlayerConfig.baseScale * stretchX, PlayerConfig.baseScale * stretchY);
                    
                    const tiltAngle = this.player.flipX ? -15 : 15;
                    this.player.setAngle(tiltAngle);

                    this.scene.tweens.add({
                        targets: this.weapon,
                        angle: strikeEndAngle,
                        scaleX: this.weaponScale * (combo === 2 ? 1.8 : 1.4),
                        scaleY: this.weaponScale * (combo === 2 ? 1.8 : 1.4),
                        duration: combo === 2 ? 140 : 100, // 第三段劈下时间稍长
                        ease: 'Sine.easeOut',
                        onComplete: () => {
                            if (!this.player.active || !this.weapon.active) return;

                            // Phase 3: Recovery (收刀回弹)
                            this.player.setScale(PlayerConfig.baseScale, PlayerConfig.baseScale);
                            this.player.setAngle(0);
                            this.scaleTweenActive = false;

                            this.scene.tweens.add({
                                targets: this.weapon,
                                scaleX: this.weaponScale,
                                scaleY: this.weaponScale,
                                duration: combo === 2 ? 220 : 150,
                                ease: 'Quad.easeInOut',
                                onComplete: () => {
                                    this.isAttacking = false;
                                }
                            });
                        }
                    });
                }
            });
        } 
        else if (this.roleKey === 'nun') {
            // 修女 4阶段法术远程战斗样板表现 (A. 蓄力前摇 -> B. 释放瞬间 -> C. 动作恢复)
            this.targetAttackAngle = angle; // 缓存主索敌射击角度
            this.state = 'cast_windup';
            this.scaleTweenActive = true;
            this.scene.tweens.killTweensOf(this.player);
            this.scene.tweens.killTweensOf(this.weapon);

            // 播放蓄力前摇序列帧动画
            this.player.play('player_cast_windup_anim', true);

            const isFlip = this.player.flipX;
            const raiseAngle = isFlip ? -25 : 25;
            const raiseY = this.player.y - 40;

            // 引入极其轻量、有机的 8% 蓄力下沉微缩形变 (Windup Squash)
            this.player.setScale(PlayerConfig.baseScale * 1.04, PlayerConfig.baseScale * 0.92); 
            this.recoilOffset.x = 0;
            this.recoilOffset.y = 0;

            // 1. 向心聚能微粒螺旋涡流：在前摇 120ms 时间窗内产生 8 颗亮金微粒盘旋吸入杖尖
            const wAngleRad = Phaser.Math.DegToRad(raiseAngle);
            const tipX = this.player.x + Math.sin(wAngleRad) * 72;
            const tipY = raiseY - Math.cos(wAngleRad) * 72;

            for (let i = 0; i < 8; i++) {
                const startRadius = Phaser.Math.FloatBetween(45, 90);
                const startAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                const startScale = Phaser.Math.FloatBetween(0.5, 0.9);
                
                const p = this.scene.add.sprite(0, 0, 'fireParticle');
                p.setDepth(12);
                p.setTint(0xffaa00);
                p.setScale(startScale);
                
                const cleanP = () => { if (p && p.destroy) p.destroy(); };
                this.scene.events.once('shutdown', cleanP);
                this.scene.events.once('destroy', cleanP);

                this.scene.tweens.add({
                    targets: p,
                    duration: 120,
                    progress: 0,
                    alpha: { start: 0.1, to: 0.9 },
                    onUpdate: (tw) => {
                        if (!p.active) return;
                        const progress = tw.progress;
                        const currentRadius = startRadius * (1.0 - progress);
                        const currentAngle = startAngle + progress * Math.PI * 2.5; // spiral inwards
                        
                        // Dynamically trace the weapon tip (which may move as player moves!)
                        const curTipX = this.weapon?.active ? this.weapon.x + Math.sin(Phaser.Math.DegToRad(this.weapon.angle)) * 72 : tipX;
                        const curTipY = this.weapon?.active ? this.weapon.y - Math.cos(Phaser.Math.DegToRad(this.weapon.angle)) * 72 : tipY;

                        p.setPosition(
                            curTipX + Math.cos(currentAngle) * currentRadius,
                            curTipY + Math.sin(currentAngle) * currentRadius
                        );
                        p.setScale(startScale * (1.0 - progress * 0.7));
                    },
                    onComplete: () => {
                        if (this.scene) {
                            this.scene.events.off('shutdown', cleanP);
                            this.scene.events.off('destroy', cleanP);
                        }
                        p.destroy();
                    }
                });
            }

            // 2. 绘制脚底收缩的同心法阵环
            const chargeRing = this.scene.add.graphics();
            chargeRing.setDepth(9);
            const chargeGlow = this.scene.add.graphics();
            chargeGlow.setDepth(12);

            const cleanChargeRing = () => { if (chargeRing && chargeRing.destroy) chargeRing.destroy(); };
            const cleanChargeGlow = () => { if (chargeGlow && chargeGlow.destroy) chargeGlow.destroy(); };
            this.scene.events.once('shutdown', cleanChargeRing);
            this.scene.events.once('destroy', cleanChargeRing);
            this.scene.events.once('shutdown', cleanChargeGlow);
            this.scene.events.once('destroy', cleanChargeGlow);

            this.scene.tweens.add({
                targets: chargeRing,
                alpha: { start: 0.8, to: 0.2 },
                duration: 120,
                onUpdate: (tw) => {
                    if (chargeRing.active) {
                        chargeRing.clear();
                        const radius = 30 * (1.0 - tw.progress) + 8;
                        chargeRing.lineStyle(2.0, 0xff1a1a, 0.7);
                        chargeRing.strokeCircle(this.player.x, this.player.y + 36, radius);
                        chargeRing.lineStyle(1.0, 0xffaa00, 0.9);
                        chargeRing.strokeCircle(this.player.x, this.player.y + 36, radius * 0.6);
                    }
                    if (chargeGlow.active) {
                        chargeGlow.clear();
                        const curTipX = this.weapon?.active ? this.weapon.x + Math.sin(Phaser.Math.DegToRad(this.weapon.angle)) * 72 : tipX;
                        const curTipY = this.weapon?.active ? this.weapon.y - Math.cos(Phaser.Math.DegToRad(this.weapon.angle)) * 72 : tipY;
                        const size = 18 * (1.0 - tw.progress) + 4;
                        chargeGlow.fillStyle(0xffaa00, 0.8 * (1.0 - tw.progress));
                        chargeGlow.fillCircle(curTipX, curTipY, size);
                        chargeGlow.lineStyle(1.5, 0xff1a1a, 0.9);
                        chargeGlow.strokeCircle(curTipX, curTipY, size * 0.7);
                    }
                },
                onComplete: () => {
                    if (this.scene) {
                        this.scene.events.off('shutdown', cleanChargeRing);
                        this.scene.events.off('destroy', cleanChargeRing);
                        this.scene.events.off('shutdown', cleanChargeGlow);
                        this.scene.events.off('destroy', cleanChargeGlow);
                    }
                    chargeRing.destroy();
                    chargeGlow.destroy();
                }
            });

            // 120ms 后转入 Phase B: 释放瞬间
            this.safeDelayedCall(120, () => {
                if (!this.player.active || !this.weapon.active) return;
                this.state = 'cast_release';
                this.player.play('player_cast_release_anim', true);

                // 引入极其轻量、有机的 6% 物理伸展形变 (Release Stretch)
                this.player.setScale(PlayerConfig.baseScale * 0.94, PlayerConfig.baseScale * 1.06); 
                this.recoilOffset.x = 0;
                this.recoilOffset.y = 0;

                // 240ms 后转入 Phase C: 恢复阶段
                this.safeDelayedCall(120, () => {
                    if (!this.player.active || !this.weapon.active) return;
                    this.state = 'cast_recovery';
                    this.player.play('player_cast_recovery_anim', true);

                    // 施法收尾：渐变平滑收回物理偏移和角色比例，让动作完美着陆
                    this.scene.tweens.add({
                        targets: this.recoilOffset,
                        x: 0,
                        y: 0,
                        duration: 180,
                        ease: 'Quad.easeOut'
                    });

                    this.scene.tweens.add({
                        targets: this.player,
                        scaleX: PlayerConfig.baseScale,
                        scaleY: PlayerConfig.baseScale,
                        duration: 180,
                        ease: 'Back.easeOut',
                        onComplete: () => {
                            this.scaleTweenActive = false;
                        }
                    });

                    this.scene.tweens.add({
                        targets: this.weapon,
                        scaleX: this.weaponScale,
                        scaleY: this.weaponScale,
                        duration: 140,
                        ease: 'Quad.easeInOut',
                        onComplete: () => {
                            this.isAttacking = false;
                            
                            // 闭环修复：重设状态机
                            if (this.player && this.player.active) {
                                const currentVx = this.player.body ? this.player.body.velocity.x : 0;
                                const currentVy = this.player.body ? this.player.body.velocity.y : 0;
                                const speedSq = currentVx * currentVx + currentVy * currentVy;
                                const currentlyMoving = speedSq > 10;
                                
                                this.state = currentlyMoving ? 'move' : 'idle';
                                this.lastIsMoving = currentlyMoving;
                                
                                this.player.play(currentlyMoving ? 'player_run_anim' : 'player_idle_anim', true);
                            }
                        }
                    });
                });
            });
        }
        else if (this.roleKey === 'necromancer') {
            // 死灵：法典自转飞升膨胀
            this.scene.tweens.add({
                targets: this.weapon,
                y: this.player.y - 20,
                angle: this.weapon.angle + 360,
                scaleX: this.weaponScale * 1.4,
                scaleY: this.weaponScale * 1.4,
                duration: 250,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    this.isAttacking = false;
                    if (this.weapon && this.weapon.active) {
                        this.weapon.setScale(this.weaponScale);
                        this.weapon.setAngle(0);
                    }
                }
            });
        }
        else if (this.roleKey === 'hunter') {
            // 猎手：冷刀尖锐直刺
            const origX = this.weapon.x;
            const origY = this.weapon.y;
            
            this.weapon.setAngle(targetDeg + 90);
            
            const dx = Math.cos(angle) * 16;
            const dy = Math.sin(angle) * 16;
            
            this.scene.tweens.add({
                targets: this.weapon,
                x: origX + dx,
                y: origY + dy,
                scaleY: this.weaponScale * 1.35,
                duration: 80,
                yoyo: true,
                repeat: 0,
                onComplete: () => {
                    this.isAttacking = false;
                    if (this.weapon && this.weapon.active) {
                        this.weapon.setScale(this.weaponScale);
                        this.weapon.setPosition(this.player.x, this.player.y + 4);
                    }
                }
            });
        }
    }

    getSpellMuzzlePoint(fallbackAngle = 0, distance = 34) {
        const shootAngle = this.targetAttackAngle !== undefined ? this.targetAttackAngle : fallbackAngle;
        const baseX = this.weapon?.active ? this.weapon.x : this.player.x;
        const baseY = this.weapon?.active ? this.weapon.y : this.player.y - 10;

        return {
            x: baseX + Math.cos(shootAngle) * distance,
            y: baseY + Math.sin(shootAngle) * distance
        };
    }

    /**
     * 血焰修女专属：施法出手瞬间在法器枪口/权杖头部释放强烈爆点与飞溅星芒
     */
    playReleaseBlast(angle) {
        if (!this.weapon || !this.weapon.active) return;

        // 计算权杖顶端聚能点的绝对屏幕坐标 (翻倍以匹配大权杖)
        const tip = this.getSpellMuzzlePoint(angle, 34);
        const tipX = tip.x;
        const tipY = tip.y;

        // 1. 枪口大爆点法阵 (快速扩散并淡出，包含高能十字星芒与中心白热核)
        const muzzleRing = this.scene.add.graphics();
        muzzleRing.setPosition(tipX, tipY);
        muzzleRing.setDepth(12); // 高于所有实体和子弹层

        // 绘制双色枪口爆发环
        muzzleRing.lineStyle(2.5, 0xffaa00, 1.0);
        muzzleRing.strokeCircle(0, 0, 5);
        muzzleRing.lineStyle(1.0, 0xff1a1a, 0.85);
        muzzleRing.strokeCircle(0, 0, 10);

        // 黄金十字星芒 flare 耀斑线
        muzzleRing.lineStyle(2.0, 0xffdd00, 1.0);
        muzzleRing.beginPath();
        muzzleRing.moveTo(-15, 0);
        muzzleRing.lineTo(15, 0);
        muzzleRing.moveTo(0, -15);
        muzzleRing.lineTo(0, 15);
        muzzleRing.strokePath();

        // 耀眼白热核心
        muzzleRing.fillStyle(0xffffff, 1.0);
        muzzleRing.fillCircle(0, 0, 4);

        // 注册场景销毁/切场清理机制，杜绝孤儿/残留 Graphics
        const cleanMuzzleRing = () => {
            if (muzzleRing && muzzleRing.destroy) muzzleRing.destroy();
        };
        this.scene.events.once('shutdown', cleanMuzzleRing);
        this.scene.events.once('destroy', cleanMuzzleRing);

        this.scene.tweens.add({
            targets: muzzleRing,
            scaleX: 5.0,
            scaleY: 5.0,
            alpha: 0,
            duration: 180,
            ease: 'Quad.easeOut',
            onComplete: () => {
                if (this.scene) {
                    this.scene.events.off('shutdown', cleanMuzzleRing);
                    this.scene.events.off('destroy', cleanMuzzleRing);
                }
                muzzleRing.destroy();
            }
        });

        // 2. 出手爆发粒子锥形喷出 (6 颗带物理速度阻尼的猩红金黄星芒)
        for (let i = 0; i < 6; i++) {
            const pAngle = angle + Phaser.Math.FloatBetween(-0.4, 0.4);
            const pSpeed = Phaser.Math.FloatBetween(80, 160);
            const pScale = Phaser.Math.FloatBetween(0.5, 0.85);
            const pColor = Math.random() > 0.5 ? 0xffaa00 : 0xff1a1a;

            const p = this.scene.add.sprite(tipX, tipY, 'fireParticle');
            p.setDepth(12);
            p.setScale(pScale);
            p.setTint(pColor);

            this.scene.physics.add.existing(p);
            p.body.setVelocity(Math.cos(pAngle) * pSpeed, Math.sin(pAngle) * pSpeed);
            p.body.setDrag(180);

            this.scene.tweens.add({
                targets: p,
                alpha: 0,
                scaleX: 0.05,
                scaleY: 0.05,
                duration: Phaser.Math.Between(150, 300),
                onComplete: () => p.destroy()
            });
        }
    }

    onTakeDamage(sourceX = null, sourceY = null) {
        if (this.state === 'dead') return;

        this.combatGlowUntil = this.scene.time.now + 140;
        this.player.setTint(0xff4444);

        // A. 物理安全受击后抑与位移
        this.scaleTweenActive = true;
        this.scene.tweens.killTweensOf(this.player);

        // 播放受击帧动画
        this.player.play('player_hit_anim', true);

        // 计算后退位移 (12px 物理安全瞬移)
        let pushX = 0;
        let pushY = 0;
        if (sourceX !== null && sourceY !== null) {
            const angle = Phaser.Math.Angle.Between(sourceX, sourceY, this.player.x, this.player.y);
            pushX = Math.cos(angle) * 12;
            pushY = Math.sin(angle) * 12;
            this.recoilOffset.x = Math.cos(angle) * 9;
            this.recoilOffset.y = Math.sin(angle) * 7;
        } else {
            pushX = this.player.flipX ? 12 : -12;
        }

        this.player.x += pushX;
        this.player.y += pushY;

        this.scene.tweens.add({
            targets: this.player,
            duration: 150,
            onComplete: () => {
                this.scaleTweenActive = false;
                this.player.setScale(PlayerConfig.baseScale);
                this.player.setAngle(0);
                // 恢复角色专属 Tint
                this.recoilOffset.x *= 0.15;
                this.recoilOffset.y *= 0.15;
                if (this.state !== 'dead') {
                    this.applyRoleVisual();
                    // 恢复播放移动/待机动画
                    const currentVx = this.player.body ? this.player.body.velocity.x : 0;
                    const currentVy = this.player.body ? this.player.body.velocity.y : 0;
                    const currentlyMoving = (currentVx * currentVx + currentVy * currentVy) > 10;
                    this.player.play(currentlyMoving ? 'player_run_anim' : 'player_idle_anim', true);
                }
            }
        });
    }

    /**
     * 治愈时的绿色闪烁 (Heal feedback)
     */
    onAttackResolved(angle, isCrit = false) {
        if (this.state === 'dead') return;
        const recoil = isCrit ? 10 : 6;
        this.recoilOffset.x = -Math.cos(angle) * recoil;
        this.recoilOffset.y = -Math.sin(angle) * recoil * 0.7;
        this.combatGlowUntil = this.scene.time.now + (isCrit ? 220 : 140);
        this.scene.tweens.add({
            targets: this.recoilOffset,
            x: 0,
            y: 0,
            duration: isCrit ? 180 : 120,
            ease: 'Cubic.easeOut'
        });
    }

    onHeal() {
        if (this.state === 'dead') return;

        this.player.setTint(0x44ff44);
        this.safeDelayedCall(150, () => {
            if (this.state !== 'dead') {
                this.applyRoleVisual();
            }
        });
    }

    /**
     * 死亡视觉呈现：倒地回旋抛散淡出
     */
    onDie() {
        this.state = 'dead';
        this.player.setTint(0x555555); // 灰白化

        // 播放死亡帧动画
        this.player.play('player_death_anim', true);

        // 脚底阴影淡出
        if (this.shadow) {
            this.scene.tweens.add({
                targets: this.shadow,
                alpha: 0,
                duration: 800
            });
        }

        // 身体渐隐隐藏
        this.scene.tweens.add({
            targets: this.player,
            duration: 1000,
            onComplete: () => {
                this.player.setVisible(false);
            }
        });

        // 武器旋转淡出
        if (this.weapon) {
            this.scene.tweens.add({
                targets: this.weapon,
                alpha: 0,
                scaleX: 0.02,
                scaleY: 0.02,
                angle: 180,
                duration: 800
            });
        }
    }

    /**
     * 销毁所有渲染实例
     */
    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.clearAsyncEvents();
        if (this.scene && this.scene.tweens) {
            this.scene.tweens.killTweensOf(this.player);
            this.scene.tweens.killTweensOf(this.weapon);
            this.scene.tweens.killTweensOf(this.shadow);
            if (this.halo) this.scene.tweens.killTweensOf(this.halo);
            if (this.backlight) this.scene.tweens.killTweensOf(this.backlight);
        }

        // These display objects are scene-owned. During player/scene teardown,
        // Phaser will destroy them itself. Manually destroying them here caused
        // repeated Graphics cleanup crashes during scene shutdown.
        [this.shadow, this.weapon, this.magicEffects, this.halo, this.backlight].forEach(obj => {
            if (!obj) return;
            if (obj.setVisible) obj.setVisible(false);
            if (obj.removeAllListeners) obj.removeAllListeners();
        });
    }
}

export default CharacterPresentationSystem;
