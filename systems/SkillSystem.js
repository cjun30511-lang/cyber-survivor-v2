/**
 * SkillSystem.js - 玩家局内自动施法管理系统
 * 依据 SkillConfig 配置，自动判定冷却、索敌，产生飞矢、爆炸火球与环绕力场
 */
import { SkillConfig } from '../config/SkillConfig.js';
import { TalismanProjectile, FireballProjectile, ShieldProjectile } from '../entities/Projectile.js';
import { GameState } from '../state/GameState.js';

export class SkillSystem {
    /**
     * @param {Phaser.Scene} scene 场景
     */
    constructor(scene) {
        this.scene = scene;
        this.destroyed = false;
        this.pendingEvents = new Set();

        // 1. 初始化技能物理组
        this.projectilesGroup = scene.physics.add.group();
        this.shieldsGroup = scene.physics.add.group();

        // 共享引用，便于 CombatSystem 使用
        scene.projectilesGroup = this.projectilesGroup;
        scene.shieldsGroup = this.shieldsGroup;

        // 2. 施法计时记录 (ms)
        this.lastTalismanTime = 0;
        this.lastFireballTime = 0;

        this.currentShieldLevel = 0; // 用于监测护盾升级重构
    }

    /**
     * 自动施法心跳更新
     * @param {number} time 当前毫秒时间
     * @param {Player} player 玩家实例
     */
    update(time, player) {
        if (this.destroyed || this.scene?.isTransitioningOut) return;
        if (!GameState.run || GameState.run.isGameOver || !player || !player.active) return;
        if (this.scene.physics.world.isPaused) return; // 🌟 物理世界暂停时阻断一切自动施法心跳

        // 1. 圣符飞矢自动施法
        const talLvl = GameState.run.skills.talisman || 0;
        if (talLvl > 0) {
            const talCfg = SkillConfig.talisman;
            const cd = talCfg.baseCooldown * (talCfg.levels[talLvl]?.cooldownMult || 1.0);

            if (time - this.lastTalismanTime > cd) {
                if (this.castTalisman(player, talLvl)) {
                    this.lastTalismanTime = time;
                }
            }
        }

        // 2. 玄火爆裂自动施法
        const fireLvl = GameState.run.skills.fireball || 0;
        if (fireLvl > 0) {
            const fireCfg = SkillConfig.fireball;
            const cd = fireCfg.baseCooldown;

            if (time - this.lastFireballTime > cd) {
                if (this.castFireball(player, fireLvl)) {
                    this.lastFireballTime = time;
                }
            }
        }

        // 3. 圣光力场环绕体数维护
        const shieldLvl = GameState.run.skills.shield || 0;
        if (shieldLvl !== this.currentShieldLevel) {
            this.currentShieldLevel = shieldLvl;
            this.rebuildShields(player, shieldLvl);
        }

        // 4. 力场物理位置自旋计算更新
        this.shieldsGroup.getChildren().forEach(shield => {
            if (shield.active) {
                shield.update(time);
            }
        });
    }

    /**
     * 释放圣符飞矢
     */
    castTalisman(player, level) {
        const talCfg = SkillConfig.talisman;
        const baseDmg = talCfg.baseDamage;
        const lvlCfg = talCfg.levels[level];
        const damage = Math.floor(baseDmg * (lvlCfg.damageMult || 1.0) * GameState.run.damageMultiplier);

        // 符矢发射枚数 (1级1枚，2级2枚，依此类推)
        const count = lvlCfg.count || 1;
        const lockOnRange = talCfg.range || 450;

        // 索敌：从场景怪群组中寻找最近的怪物
        const nearestEnemies = this.getNearestEnemies(player, count);
        if (nearestEnemies.length === 0) return false;

        // 仅打进入有效索敌范围的怪，避免隔很远提前起手
        const dist = Phaser.Math.Distance.BetweenPoints(player, nearestEnemies[0]);
        if (dist > lockOnRange) return false;

        let primaryAngle = Phaser.Math.Angle.Between(player.x, player.y, nearestEnemies[0].x, nearestEnemies[0].y);

        const roleKey = (GameState.run && GameState.run.roleId) || GameState.meta.selectedRole || 'exorcist';

        // 投射物发射逻辑（修女走独立的远程法术发射链）
        const launchProjectiles = () => {
            if (this.destroyed || this.scene?.isTransitioningOut) return;
            if (this.scene?.levelUpMenu?.isOpen || this.scene?.isGameplayPaused) return;
            if (!player || !player.active || !this.scene || !this.projectilesGroup || !this.projectilesGroup.scene) return;

            // 120ms后重新进行一次索敌，保证弹道极其精准对准当前方向的怪
            const freshEnemies = this.getNearestEnemies(player, count);

            // 前摇期间目标消失或走出范围时允许取消本次攻击
            if (freshEnemies.length === 0 || Phaser.Math.Distance.BetweenPoints(player, freshEnemies[0]) > lockOnRange) {
                if (player.presenter) {
                    player.presenter.isAttacking = false;
                    const vx = player.body ? player.body.velocity.x : 0;
                    const vy = player.body ? player.body.velocity.y : 0;
                    const speedSq = vx * vx + vy * vy;
                    const currentlyMoving = speedSq > 10;

                    player.presenter.state = currentlyMoving ? 'move' : 'idle';
                    player.presenter.lastIsMoving = currentlyMoving;
                    player.play(currentlyMoving ? 'player_run_anim' : 'player_idle_anim', true);
                }
                return;
            }

            // 计算主射击物理角度
            let mainAngle = player.flipX ? Math.PI : 0;
            if (freshEnemies[0]) {
                mainAngle = Phaser.Math.Angle.Between(player.x, player.y, freshEnemies[0].x, freshEnemies[0].y);
            } else if (nearestEnemies[0]) {
                mainAngle = Phaser.Math.Angle.Between(player.x, player.y, nearestEnemies[0].x, nearestEnemies[0].y);
            }

            for (let i = 0; i < count; i++) {
                let targetEnemy = freshEnemies[i] || nearestEnemies[i];
                let angle = mainAngle;
                const spreadAngle = (i - (count - 1) / 2) * 0.16;

                if (roleKey === 'nun' && count > 1) {
                    angle = mainAngle + spreadAngle;
                } else if (targetEnemy && targetEnemy.active) {
                    angle = Phaser.Math.Angle.Between(player.x, player.y, targetEnemy.x, targetEnemy.y);
                } else if (count > 1) {
                    angle = mainAngle + (i - (count - 1) / 2) * 0.25;
                }

                const speed = talCfg.speed || 450;
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed;
                let spawnX = player.x;
                let spawnY = player.y - 10;

                if (roleKey === 'nun' && player.presenter?.getSpellMuzzlePoint) {
                    // 修女必须从法器枪口真正发射，而不是从角色中心冒出。
                    const muzzle = player.presenter.getSpellMuzzlePoint(angle, 46);
                    const spreadOffset = (i - (count - 1) / 2) * 18;
                    const sideAngle = angle + Math.PI / 2;
                    spawnX = muzzle.x + Math.cos(sideAngle) * spreadOffset;
                    spawnY = muzzle.y + Math.sin(sideAngle) * spreadOffset;
                }

                // 产生物理符矢/血焰爆裂弹
                const proj = new TalismanProjectile(
                    this.scene,
                    spawnX,
                    spawnY,
                    vx,
                    vy,
                    angle,
                    damage
                );
                this.projectilesGroup.add(proj);
            }

            // 在出手瞬间，将法器角度强制旋转到射击方向（斜指前方）达成100%视觉重合
            if (roleKey === 'nun' && player.presenter && player.presenter.weapon && player.presenter.weapon.active) {
                const targetDeg = Phaser.Math.RadToDeg(mainAngle);
                const isFlip = player.flipX;
                const blastAngle = targetDeg + (isFlip ? -25 : 25);
                player.presenter.weapon.setAngle(blastAngle);
            }

            // 播放法器枪口焰和爆散火花 (在出手瞬间使用实际物理夹角)
            if (roleKey === 'nun' && player.presenter && player.presenter.playReleaseBlast) {
                player.presenter.playReleaseBlast(mainAngle);
            }

            // 播放施法音效 (在出手瞬间)
            if (this.scene.soundSynth) {
                this.scene.soundSynth.play('laser');
            }
        };

        if (roleKey === 'nun') {
            // 修女：明确的远程法术前摇，然后从法器枪口发射。
            if (player.playAttackAnimation) {
                player.playAttackAnimation(primaryAngle);
            }
            const launchEvent = this.scene.time.delayedCall(120, () => {
                this.pendingEvents.delete(launchEvent);
                launchProjectiles();
            });
            this.pendingEvents.add(launchEvent);
        } else {
            // 其余角色：无前摇，直接发射并播放挥砍/吟唱动作
            if (player.playAttackAnimation) {
                if (roleKey === 'exorcist') {
                    player.exorcistCombo = ((player.exorcistCombo || 0) + 1) % 3;
                }
                player.playAttackAnimation(primaryAngle);
            }
            launchProjectiles();
        }

        return true;
    }

    /**
     * 在随机敌人脚下召唤玄火爆炸
     */
    castFireball(player, level) {
        const fireCfg = SkillConfig.fireball;
        const baseDmg = fireCfg.baseDamage;
        const baseRad = fireCfg.baseRadius;
        const lvlCfg = fireCfg.levels[level];

        const damage = Math.floor(baseDmg * (lvlCfg.damageMult || 1.0) * GameState.run.damageMultiplier);
        const radius = baseRad * (lvlCfg.radiusMult || 1.0);

        // 仅在场上存在有效魔物时才允许释放范围技，避免无目标空放
        const enemies = this.scene.enemiesGroup.getChildren().filter(enemy => enemy.active);
        if (enemies.length === 0) return false;

        const randomEnemy = Phaser.Utils.Array.GetRandom(enemies);
        if (!randomEnemy) return false;
        const tx = randomEnemy.x;
        const ty = randomEnemy.y;

        // 产生范围引爆器
        const fireProj = new FireballProjectile(this.scene, tx, ty, damage, radius, level);
        this.projectilesGroup.add(fireProj);

        // 触发角色施法动作
        if (player.playAttackAnimation) {
            const angle = Phaser.Math.Angle.Between(player.x, player.y, tx, ty);
            player.playAttackAnimation(angle);
        }

        return true;
    }

    /**
     * 重建环绕圣光屏障 (升级时或开局时触发)
     */
    rebuildShields(player, level) {
        // 清空老屏障
        this.shieldsGroup.clear(true, true);
        if (level <= 0) return;

        const shCfg = SkillConfig.shield;
        const lvlCfg = shCfg.levels[level];

        const damage = Math.floor(shCfg.baseDamage * (lvlCfg.damageMult || 1.0) * GameState.run.damageMultiplier);
        const radius = shCfg.baseRadius * (lvlCfg.radiusMult || 1.0);

        // 屏障数等于当前护盾等级 (比如 1级1颗旋转，2级2颗对称，3级3颗，4级4颗)
        const shieldCount = level;

        for (let i = 0; i < shieldCount; i++) {
            const shieldItem = new ShieldProjectile(
                this.scene,
                player,
                i,
                shieldCount,
                radius,
                damage
            );
            this.shieldsGroup.add(shieldItem);
        }
    }

    /**
     * 索敌辅助：排序寻找最近的 N 个怪物
     */
    getNearestEnemies(player, count) {
        const enemies = this.scene.enemiesGroup.getChildren().filter(e => e.active);
        if (enemies.length === 0) return [];

        // 按距离升序排列
        enemies.sort((a, b) => {
            const distA = Phaser.Math.Distance.BetweenPoints(player, a);
            const distB = Phaser.Math.Distance.BetweenPoints(player, b);
            return distA - distB;
        });

        return enemies.slice(0, count);
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.pendingEvents.forEach(event => event?.remove?.(false));
        this.pendingEvents.clear();

        const destroyChildren = group => {
            const entries = group?.children?.entries;
            if (!Array.isArray(entries)) return;
            const children = [...entries];
            children.forEach(child => child?.destroy?.());
        };
        destroyChildren(this.shieldsGroup);
        destroyChildren(this.projectilesGroup);

        if (this.scene) {
            if (this.scene.projectilesGroup === this.projectilesGroup) this.scene.projectilesGroup = null;
            if (this.scene.shieldsGroup === this.shieldsGroup) this.scene.shieldsGroup = null;
        }
        try { this.shieldsGroup?.destroy?.(); } catch {}
        try { this.projectilesGroup?.destroy?.(); } catch {}
        this.shieldsGroup = null;
        this.projectilesGroup = null;
        this.scene = null;
    }
}

export default SkillSystem;
