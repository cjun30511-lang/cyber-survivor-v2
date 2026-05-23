/**
 * CombatSystem.js - 伤害碰撞、暴击顿帧与战斗计算系统
 * 纯粹承载战斗重叠物理交互：投射物击中魔物、魔物啃咬玩家、暴击物理颤抖与震屏
 */
import { PlayerConfig } from '../config/PlayerConfig.js';
import { GameState } from '../state/GameState.js';
import { TalismanProjectile, FireballProjectile } from '../entities/Projectile.js';

export class CombatSystem {
    /**
     * @param {Phaser.Scene} scene 场景
     */
    constructor(scene) {
        this.scene = scene;

        // 注册暴击监听事件，以便在暴击时震屏与物理顿帧 (Hitstop)
        this.scene.events.on('crit_hit', this.triggerCritJuice, this);

        // 记录玩家受咬的内置 Tick 冷却 (防止每帧扣血秒死，间隔 400ms)
        this.lastPlayerHurtTime = 0;
        this.hurtCooldown = 400; 

        // 安全且防抖的物理顿帧 (Hitstop) 计时器与截止时间戳
        this.hitstopEndTime = 0;
        this.hitstopTimer = null;

        // 注册物理判定 overlaps
        this.initCollisionOverlaps();
    }

    /**
     * 初始化 Phaser Arcade Overlap 物理重叠重合探测
     */
    initCollisionOverlaps() {
        const scene = this.scene;

        // 1. 玩家飞矢/火球与怪物碰撞
        scene.physics.add.overlap(
            scene.projectilesGroup,
            scene.enemiesGroup,
            this.handleProjectileHit,
            null,
            this
        );

        // 2. 环绕圣光屏障与怪物接触
        scene.physics.add.overlap(
            scene.shieldsGroup,
            scene.enemiesGroup,
            this.handleShieldHit,
            null,
            this
        );

        // 3. 怪物身体撕咬玩家 (怪物 -> 玩家)
        scene.physics.add.overlap(
            scene.player,
            scene.enemiesGroup,
            this.handleEnemyBitePlayer,
            null,
            this
        );

        // 4. 远程法术子弹击中玩家 (法球 -> 玩家)
        scene.physics.add.overlap(
            scene.player,
            scene.casterBullets,
            this.handleBulletHitPlayer,
            null,
            this
        );
    }

    /**
     * 心跳更新 (当前无须多余计算，物理系统均由 Arcade 事件回调驱动)
     */
    update(time, player) {}

    /**
     * 玩家投射物与怪物接触回调
     */
    handleProjectileHit(projectile, enemy) {
        if (this.scene?.isTransitioningOut) return;
        if (!projectile.active || !enemy.active) return;

        // 火球在未引爆前不造成伤害 (由其 enableBody 控制，但保险起见还是校验一下)
        if (projectile instanceof FireballProjectile && !projectile.body.enable) {
            return;
        }

        // 影刃猎手专属穿透与防重复判定
        if (projectile.roleKey === 'hunter') {
            if (projectile.hitEnemies.has(enemy)) {
                return;
            }
            projectile.hitEnemies.add(enemy);
        }

        // 计算物理受力击退角 (从弹道指向怪物的推力夹角)
        const angle = Phaser.Math.Angle.Between(projectile.x, projectile.y, enemy.x, enemy.y);

        // 判定暴击概率 (初始 15% 暴击率)
        const isCrit = Math.random() < 0.15;
        const finalDamage = isCrit ? Math.floor(projectile.damage * 1.7) : projectile.damage;

        // 怪物承受伤害与击退
        enemy.takeDamage(finalDamage, isCrit, angle);
        if (this.scene.player?.presenter) {
            this.scene.player.presenter.onAttackResolved(angle, isCrit);
        }
        this.spawnHitBurst(enemy.x, enemy.y, angle, isCrit, projectile.roleKey);

        // 驱魔骑士常规轻量 25ms hitstop，提供清晰“砍中”的打击滞留反馈
        if (projectile.roleKey === 'exorcist') {
            this.triggerHitstop(25);
        }

        // 销毁或穿透处理
        if (projectile instanceof TalismanProjectile) {
            if (projectile.roleKey === 'nun') {
                projectile.impact(enemy.x, enemy.y);
                projectile.destroy();
            } else if (projectile.roleKey === 'hunter') {
                projectile.pierceCount--;
                if (projectile.pierceCount <= 0) {
                    projectile.destroy();
                }
            } else {
                projectile.destroy();
            }
        }
    }

    /**
     * 旋转屏障与怪物重叠回调 (每 500ms 一跳判定)
     */
    handleShieldHit(shield, enemy) {
        if (this.scene?.isTransitioningOut) return;
        if (!shield.active || !enemy.active) return;

        const time = this.scene.time.now;
        const enemyId = enemy.name || `${enemy.x}_${enemy.y}_${enemy.hp}`; // 临时唯一标识

        if (shield.canDamage(enemyId, time)) {
            // 力场物理击退较小，推开角度为“玩家指向怪物的方向”
            const angle = Phaser.Math.Angle.Between(shield.player.x, shield.player.y, enemy.x, enemy.y);
            
            const isCrit = Math.random() < 0.12; // 力场略低暴击
            const finalDamage = isCrit ? Math.floor(shield.damage * 1.7) : shield.damage;

            // 承受伤害与微弱击退 (力度 120)
            enemy.takeDamage(finalDamage, isCrit, angle);
            this.spawnHitBurst(enemy.x, enemy.y, angle, isCrit, 'shield');
            
            // 暴击给个受击火花
            if (isCrit && this.scene.fireParticles) {
                this.scene.fireParticles.emitParticleAt(enemy.x, enemy.y, 2);
            }
        }
    }

    /**
     * 怪物撕咬玩家回调
     */
    handleEnemyBitePlayer(player, enemy) {
        if (this.scene?.isTransitioningOut) return;
        if (!player.active || !enemy.active || GameState.run?.isGameOver) return;

        const time = this.scene.time.now;
        if (time - this.lastPlayerHurtTime > this.hurtCooldown) {
            this.lastPlayerHurtTime = time;

            // 扣除玩家血量，并触发红闪受击
            const hurtSuccess = player.takeDamage(enemy.damage, enemy.x, enemy.y);
            
            // 玩家受创时触发屏幕微弱泛红与颤抖
            if (hurtSuccess) {
                this.scene.cameras.main.shake(120, 0.008);
                this.spawnPlayerPainBurst(player.x, player.y, enemy.x, enemy.y, enemy.isBoss ? 0xff5533 : 0xff1a1a);
            }
        }
    }

    /**
     * 远程巫师火球子弹击中玩家
     */
    handleBulletHitPlayer(player, bullet) {
        if (this.scene?.isTransitioningOut) return;
        if (!player.active || !bullet.active || GameState.run?.isGameOver) return;

        // 销毁远程子弹实体
        const bx = bullet.x;
        const by = bullet.y;
        bullet.destroy();

        // 默认承受 12 点伤害
        const dmg = 12;
        const hurtSuccess = player.takeDamage(dmg, bx, by);
        
        if (hurtSuccess) {
            this.scene.cameras.main.shake(120, 0.008);
            this.spawnPlayerPainBurst(player.x, player.y, bx, by, 0x66ccff);
        }
    }

    spawnHitBurst(x, y, angle, isCrit, sourceType) {
        if (!this.scene || this.scene.isTransitioningOut) return;

        const slash = this.scene.add.graphics();
        slash.setDepth(13);
        const spread = isCrit ? 30 : 20;
        const length = sourceType === 'exorcist' ? 42 : 28;
        this.scene.tweens.add({
            targets: slash,
            alpha: 0,
            duration: isCrit ? 180 : 120,
            onUpdate: tween => {
                if (!slash.active) return;
                const p = tween.progress;
                slash.clear();
                slash.lineStyle(isCrit ? 5 : 3, isCrit ? 0xffd36b : 0xffffff, 1 - p);
                slash.beginPath();
                slash.moveTo(x - Math.cos(angle) * (length * 0.2 + p * spread), y - Math.sin(angle) * (length * 0.2 + p * spread));
                slash.lineTo(x + Math.cos(angle) * (length + p * spread), y + Math.sin(angle) * (length + p * spread));
                slash.strokePath();
                slash.lineStyle(2, sourceType === 'nun' ? 0xff6633 : 0xff1a1a, 0.8 - p * 0.6);
                slash.strokeCircle(x, y, 6 + p * (isCrit ? 22 : 12));
            },
            onComplete: () => slash.destroy()
        });
    }

    spawnPlayerPainBurst(x, y, sourceX, sourceY, tint) {
        if (!this.scene || this.scene.isTransitioningOut) return;
        const angle = Phaser.Math.Angle.Between(sourceX, sourceY, x, y);
        for (let i = 0; i < 4; i++) {
            const shard = this.scene.add.rectangle(x, y, 10, 3, tint, 0.95);
            shard.setDepth(13);
            this.scene.physics.add.existing(shard);
            const shardAngle = angle + Phaser.Math.FloatBetween(-0.55, 0.55);
            const speed = Phaser.Math.Between(120, 220);
            shard.body.setVelocity(Math.cos(shardAngle) * speed, Math.sin(shardAngle) * speed);
            shard.body.setDrag(220);
            this.scene.tweens.add({
                targets: shard,
                alpha: 0,
                scaleX: 0.1,
                scaleY: 0.1,
                duration: 220,
                onComplete: () => shard.destroy()
            });
        }
    }

    /**
     * 安全且防重叠冲突的物理顿帧 (Hitstop) 控制器
     * 仅在当前帧没有更长的顿帧时执行，保证不卡顿、不引入输入延迟或致命JS报错
     * @param {number} duration 顿帧持续毫秒数
     */
    triggerHitstop(duration) {
        if (!this.scene || this.scene.isTransitioningOut || !this.scene.physics || !this.scene.physics.world) return;
        
        const now = this.scene.time.now;
        const targetEndTime = now + duration;
        
        // 如果当前已经有一个更晚结束的顿帧在运行，则忽略较短的顿帧，避免重叠冲突
        if (targetEndTime <= this.hitstopEndTime) {
            return;
        }
        
        this.hitstopEndTime = targetEndTime;
        
        // 挂起物理 tick 触发
        this.scene.physics.world.pause();
        
        if (this.hitstopTimer) {
            this.hitstopTimer.destroy();
        }
        
        this.hitstopTimer = this.scene.time.delayedCall(duration, () => {
            if (this.scene && !this.scene.isTransitioningOut && this.scene.physics && this.scene.physics.world) {
                this.scene.physics.world.resume();
            }
            this.hitstopTimer = null;
        });
    }

    /**
     * 暴击视觉与物理打击感渲染 (Juice VFX)
     * 包括：安全顿帧 (Hitstop) 85ms 与 黄金震屏
     */
    triggerCritJuice() {
        // 1. 黄金镜头震动 (高强震屏，极强打击感)
        this.scene.cameras.main.shake(150, 0.015);

        // 2. 调用安全顿帧，避免重叠覆盖报错
        this.triggerHitstop(85);
    }

    /**
     * 清除事件绑定
     */
    destroy() {
        if (this.hitstopTimer) {
            this.hitstopTimer.destroy();
            this.hitstopTimer = null;
        }
        this.scene.events.off('crit_hit', this.triggerCritJuice, this);
    }
}

export default CombatSystem;
