/**
 * Player.js - 玩家（驱魔修士）实体
 * 封装控制、残影、冲刺、形变动效、受击颤抖及局内升级成长逻辑
 * 视觉表现全权委托给 CharacterPresentationSystem
 */
import { PlayerConfig } from '../config/PlayerConfig.js';
import { GameState } from '../state/GameState.js';
import { SoundSynth } from '../utils/SoundSynth.js';
import { RolePresentationConfig } from '../config/RolePresentationConfig.js';
import { CharacterPresentationSystem } from '../systems/CharacterPresentationSystem.js';

export class Player extends Phaser.Physics.Arcade.Sprite {
    /**
     * @param {Phaser.Scene} scene 挂载的战斗场景
     * @param {number} x 初始X
     * @param {number} y 初始Y
     */
    constructor(scene, x, y) {
        super(scene, x, y, 'player_idle');

        // 1. 注册到场景与物理引擎中
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // 2. 运动物理参数配置
        this.setCollideWorldBounds(true);
        this.setDepth(10);
        this.setDrag(1000);
        this.setScale(PlayerConfig.baseScale);
        
        // 3. 校正高清原画的物理碰撞包围盒 (居中缩小，防偏心判定)
        this.setBodySize(PlayerConfig.hitboxWidth, PlayerConfig.hitboxHeight, true);
        this.setDisplayOrigin(this.width / 2, this.height / 2);

        // 启动初始动画
        this.play('player_idle_anim');

        // 4. 局内临时属性同步
        this.syncState();

        // 5. 特效依赖
        this.fireParticles = scene.fireParticles; // 用于尘埃尾迹

        // 6. 实例化独立表现系统 (Presenter)，托管所有视觉/阴影/武器/动效
        this.presenter = new CharacterPresentationSystem(this);

        // 7. 驱魔人重斩 Combo 计数器
        this.exorcistCombo = 0;
        this.dashEndTimer = null;
        this.invincibleTimer = null;
    }

    /**
     * 同步全局 GameState 中的单局玩家属性到物理实体上
     */
    syncState() {
        if (!GameState.run) return;
        this.maxHp = GameState.run.hpMax;
        this.hp = GameState.run.hp;
        this.speed = GameState.run.speed;
        this.damageMultiplier = GameState.run.damageMultiplier;
        this.isDashing = GameState.run.isDashing;
        this.isInvincible = GameState.run.isInvincible;
        
        this.lastDashTime = 0;
        this.dashCooldown = PlayerConfig.dash.cooldown;
        this.dashDuration = PlayerConfig.dash.duration;
        this.dashSpeedMultiplier = PlayerConfig.dash.speedMultiplier;

        // 根据选中的化身角色应用独特的视觉染色
        const roleKey = (GameState.run && GameState.run.roleId) || GameState.meta.selectedRole || 'nun';
        const roleCfg = RolePresentationConfig.roles[roleKey];
        if (roleCfg) {
            this.setTint(roleCfg.tint);
            this.setAlpha(1);
            this.themeColor = roleCfg.themeColor;
        } else {
            this.clearTint();
            this.setAlpha(1);
            this.themeColor = 0xffffff;
        }
    }

    /**
     * 播放攻击/施法表现：委托给呈现系统
     * @param {number} angle 投射物发射的角度 (弧度)
     */
    playAttackAnimation(angle) {
        if (this.presenter) {
            this.presenter.playAttackAnimation(angle);
        }
    }

    /**
     * 玩家心跳更新 (处理移动、姿态与粒子)
     * @param {number} time 当前毫秒级运行时间
     * @param {Object} inputState 当前混合输入状态 ({vx, vy, isSpaceDown})
     */
    update(time, inputState) {
        if (!GameState.run || GameState.run.isGameOver) return;

        // 如果在冲刺中，接管常规移动控制
        if (this.isDashing) {
            GameState.run.isDashing = true;
            return;
        }

        let { vx, vy, isSpaceDown } = inputState;

        // 引入平滑惯性曲线 (Linear Interpolation Lerp) 替换生硬起步/停步
        const accel = 0.34;
        const decel = 0.38;
        const currentVx = this.body.velocity.x;
        const currentVy = this.body.velocity.y;

        let newVx = vx === 0 ? Phaser.Math.Linear(currentVx, 0, decel) : Phaser.Math.Linear(currentVx, vx, accel);
        let newVy = vy === 0 ? Phaser.Math.Linear(currentVy, 0, decel) : Phaser.Math.Linear(currentVy, vy, accel);

        this.setVelocity(newVx, newVy);

        // 朝向物理翻转
        if (vx !== 0) {
            this.setFlipX(vx < 0);
        }

        // 行走与姿态视觉呈现委托给 Presenter
        if (this.presenter) {
            this.presenter.update(time, 16.67, newVx, newVy);
        }

        // 2. 判定触发冲刺闪避
        if (isSpaceDown && time - this.lastDashTime > this.dashCooldown) {
            this.triggerDash(time, vx, vy);
        }
    }

    /**
     * 触发翻滚闪避冲刺 (短暂绝对无敌+多重虚影拖尾)
     */
    triggerDash(time, vx, vy) {
        this.isDashing = true;
        this.isInvincible = true;
        this.lastDashTime = time;
        
        if (GameState.run) {
            GameState.run.isDashing = true;
            GameState.run.isInvincible = true;
        }

        SoundSynth.play('laser');

        // 如果没有键盘摇杆输入，朝向当前角色面向冲刺
        if (vx === 0 && vy === 0) {
            const angle = this.flipX ? Math.PI : 0;
            vx = Math.cos(angle) * this.speed;
            vy = Math.sin(angle) * this.speed;
        }

        this.setVelocity(vx * this.dashSpeedMultiplier, vy * this.dashSpeedMultiplier);

        // 冲刺瞬间镜头高频抖动，提升爆发感
        this.scene.cameras.main.shake(120, 0.006);

        // 冲刺视觉呈现委托给 Presenter
        if (this.presenter) {
            this.presenter.triggerDash(vx, vy);
        }

        // 冲刺持续时间结束后恢复常规属性
        if (this.dashEndTimer) this.dashEndTimer.destroy();
        if (this.invincibleTimer) this.invincibleTimer.destroy();

        this.dashEndTimer = this.scene.time.delayedCall(this.dashDuration, () => {
            if (!this.scene || !this.active || this.scene.isTransitioningOut) return;
            this.isDashing = false;
            if (GameState.run) GameState.run.isDashing = false;
            
            // 冲刺无敌帧时间稍微多出一点，保证翻滚容错率
            this.invincibleTimer = this.scene.time.delayedCall(PlayerConfig.dash.invincibleDuration - this.dashDuration, () => {
                if (!this.scene || !this.active || this.scene.isTransitioningOut) return;
                this.isInvincible = false;
                if (GameState.run) GameState.run.isInvincible = false;
            });
        });
    }

    /**
     * 玩家受到伤害
     * @param {number} amount 原始伤害数值
     * @param {number} sourceX 伤害来源X坐标
     * @param {number} sourceY 伤害来源Y坐标
     */
    takeDamage(amount, sourceX = null, sourceY = null) {
        if (this.isInvincible || this.isDashing || !GameState.run || GameState.run.isGameOver) return false;

        // 扣减生命
        GameState.run.hp = Math.max(0, GameState.run.hp - amount);
        this.hp = GameState.run.hp;

        // 播放受击音效
        SoundSynth.play('hit');
        
        // 颤抖与红闪委托给 Presenter
        if (this.presenter) {
            this.presenter.onTakeDamage(sourceX, sourceY);
        }

        if (this.hp <= 0) {
            this.die();
        }
        return true;
    }

    /**
     * 玩家吃血药恢复生命
     * @param {number} percent 恢复生命上限的百分比 (如 20 表示回复 20% HP)
     */
    heal(percent) {
        if (!GameState.run || GameState.run.isGameOver) return;
        const healAmt = Math.floor(GameState.run.hpMax * (percent / 100));
        GameState.run.hp = Math.min(GameState.run.hpMax, GameState.run.hp + healAmt);
        this.hp = GameState.run.hp;
        SoundSynth.play('coin');

        // 绿光治愈呈现委托给 Presenter
        if (this.presenter) {
            this.presenter.onHeal();
        }
    }

    /**
     * 玩家阵亡
     */
    die() {
        if (!GameState.run) return;
        GameState.run.isGameOver = true;
        this.setVelocity(0, 0);

        // 死亡回旋抛飞与灰化委托给 Presenter
        if (this.presenter) {
            this.presenter.onDie();
        }

        // 触发外部 BattleScene 场景的结束分发
        this.scene.events.emit('player_died');
    }

    preDestroy() {
        if (this.dashEndTimer) this.dashEndTimer.destroy();
        if (this.invincibleTimer) this.invincibleTimer.destroy();
        if (this.presenter) {
            this.presenter.destroy();
        }
        super.preDestroy();
    }
}

export default Player;
