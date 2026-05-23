/**
 * SpawnSystem.js - 怪物波次生成及首领降临控制系统
 * 根据 WaveConfig 节奏在屏幕外围平滑产生怪物，实施同屏上限防卡顿控制
 */
import { WaveConfig } from '../config/WaveConfig.js';
import { SkeletonMelee } from '../entities/SkeletonMelee.js';
import { GhostCaster } from '../entities/GhostCaster.js';
import { IronTank } from '../entities/IronTank.js';
import { BossDemon } from '../entities/BossDemon.js';
import { GameState } from '../state/GameState.js';

export class SpawnSystem {
    /**
     * @param {Phaser.Scene} scene 场景
     */
    constructor(scene) {
        this.scene = scene;
        this.destroyed = false;
        this.activeTweens = new Set();
        this.spawnInterval = WaveConfig.spawnInterval || 1200;
        
        // 标记首领是否已经生成过，防止高频重复产生
        this.bossSpawned = false;

        // 引入局内高精度物理时间累加器，杜绝因暂停（升级、复活弹窗）导致的时间跳跃与刷怪漂移
        this.accumulatedTimeMs = 0;
        this.lastSpawnTimeMs = 0;
    }

    /**
     * 刷怪心跳更新
     * @param {number} time 当前游戏时间
     * @param {number} delta 间隔
     * @param {Player} player 玩家实例
     */
    update(time, delta, player) {
        if (this.destroyed || this.scene?.isTransitioningOut) return;
        if (!GameState.run || GameState.run.isGameOver || !player || !player.active) return;

        // 若物理世界处于暂停状态（例如升级卡牌三选一、复活弹层等），直接截断，不累加时间
        if (this.scene.physics.world.isPaused) {
            return;
        }

        this.accumulatedTimeMs += delta;
        const elapsedSec = Math.floor(this.accumulatedTimeMs / 1000);
        GameState.run.elapsedTime = elapsedSec;

        // 1. 终极首领降临判定 (达到 60 秒且未生成)
        if (elapsedSec >= WaveConfig.bossSpawnTime) {
            if (!this.bossSpawned) {
                this.bossSpawned = true;
                this.spawnBoss(player);
            }
            return; // 首领战开启后，停止刷新常规杂鱼小兵
        }

        // 2. 常规波次时间驱动怪物产生
        if (this.accumulatedTimeMs - this.lastSpawnTimeMs > this.spawnInterval) {
            this.lastSpawnTimeMs = this.accumulatedTimeMs;

            // 检查当前屏幕怪物总数，如果超过同屏上限则暂时挂起，保证 60 帧性能
            const currentEnemies = this.scene.enemiesGroup.getLength();
            if (currentEnemies >= WaveConfig.maxEnemiesOnScreen) {
                return;
            }

            // 获取当前时间戳所属波次阶段
            const stage = this.getCurrentStage(elapsedSec);
            if (stage) {
                // 每次产出数量
                const count = stage.spawnCount || 2;
                for (let i = 0; i < count; i++) {
                    this.spawnSingleEnemy(player, stage.weights);
                }
            }
        }
    }

    /**
     * 获取当前的波次阶段配置
     * @param {number} elapsedSec 本局已生存时间
     */
    getCurrentStage(elapsedSec) {
        for (let stage of WaveConfig.stages) {
            if (elapsedSec >= stage.start && elapsedSec < stage.end) {
                return stage;
            }
        }
        // 如果时间溢出但还未到 Boss 刷出，默认采用最后一个阶段
        return WaveConfig.stages[WaveConfig.stages.length - 1];
    }

    /**
     * 依据波次权重，在玩家视口边缘外产生一个怪物
     * @param {Player} player
     * @param {Object} weights 怪物权重字典
     */
    spawnSingleEnemy(player, weights) {
        if (this.destroyed || this.scene?.isTransitioningOut) return;
        // 依据权重随机选择一个怪物 Key
        const enemyKey = this.chooseWeightedEnemy(weights);
        if (!enemyKey) return;

        // 核心算法：在玩家视口外的一圈圆环上随机算一个坐标点 (750 像素外，防止突兀出生在玩家脸上)
        const spawnDistance = 750;
        const randomAngle = Math.random() * Math.PI * 2;
        const spawnX = player.x + Math.cos(randomAngle) * spawnDistance;
        const spawnY = player.y + Math.sin(randomAngle) * spawnDistance;

        let enemyInstance = null;

        // 物理实例化子类实体
        switch (enemyKey) {
            case 'skeleton':
                enemyInstance = new SkeletonMelee(this.scene, spawnX, spawnY);
                break;
            case 'ghost':
                enemyInstance = new GhostCaster(this.scene, spawnX, spawnY);
                break;
            case 'tank':
                enemyInstance = new IronTank(this.scene, spawnX, spawnY);
                break;
        }

        if (enemyInstance) {
            this.scene.enemiesGroup.add(enemyInstance);
        }
    }

    /**
     * 根据权重字典，以加权轮盘赌算法随机产出怪物种类
     */
    chooseWeightedEnemy(weights) {
        const rand = Math.random();
        let cumulative = 0;
        for (let [key, val] of Object.entries(weights)) {
            cumulative += val;
            if (rand < cumulative) return key;
        }
        return 'skeleton'; // 兜底返回骷髅小兵
    }

    /**
     * 终极首领暗黑降临戏剧性流程
     */
    spawnBoss(player) {
        if (this.destroyed || this.scene?.isTransitioningOut) return;
        // 1. 触发震撼的天黑法阵特效 (屏幕一瞬间变暗)
        const darkenOverlay = this.scene.add.graphics();
        darkenOverlay.fillStyle(0x000000, 0.7);
        darkenOverlay.fillRect(player.x - 600, player.y - 1000, 1200, 2000);
        darkenOverlay.setDepth(2); // 居于熔岩地表上方，实体下方

        // 渐变缓动，渲染巨灵出世的气势
        const darkenTween = this.scene.tweens.add({
            targets: darkenOverlay,
            alpha: { start: 0, to: 0.7 },
            duration: 800,
            onComplete: () => this.activeTweens.delete(darkenTween)
        });
        this.activeTweens.add(darkenTween);

        // 2. 召唤法阵扩散 (金色法线)
        const ritualCircle = this.scene.add.graphics();
        ritualCircle.lineStyle(3, 0xff0033, 0.8);
        const bx = player.x;
        const by = player.y - 280; // 生成在玩家正上方中距
        ritualCircle.strokeCircle(bx, by, 100);
        ritualCircle.setDepth(5);

        const ritualTween = this.scene.tweens.add({
            targets: ritualCircle,
            scaleX: 0.1,
            scaleY: 0.1,
            x: bx * 0.9,
            y: by * 0.9,
            duration: 1000,
            yoyo: false,
            onComplete: () => {
                this.activeTweens.delete(ritualTween);
                if (this.destroyed || this.scene?.isTransitioningOut) {
                    ritualCircle.destroy();
                    darkenOverlay.destroy();
                    return;
                }
                ritualCircle.destroy();
                darkenOverlay.destroy();
                
                // 3. 产生震屏与 Boss 实体
                this.scene.cameras.main.shake(200, 0.015);
                const boss = new BossDemon(this.scene, bx, by);
                this.scene.enemiesGroup.add(boss);

                // 播放 Boss 出场警告气浪
                const wave = this.scene.add.graphics();
                wave.lineStyle(4, 0xff0000, 1);
                wave.strokeCircle(0, 0, 10);
                wave.setPosition(bx, by);
                wave.setDepth(5);
                const waveTween = this.scene.tweens.add({
                    targets: wave,
                    scaleX: 12.0,
                    scaleY: 12.0,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        this.activeTweens.delete(waveTween);
                        wave.destroy();
                    }
                });
                this.activeTweens.add(waveTween);
            }
        });
        this.activeTweens.add(ritualTween);
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.activeTweens.forEach(tween => tween?.remove?.());
        this.activeTweens.clear();
        this.bossSpawned = true;
        this.scene = null;
    }
}

export default SpawnSystem;
