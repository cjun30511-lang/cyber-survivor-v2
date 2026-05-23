/**
 * BattleScene.js - 核心战斗场景生命周期协调器
 * 完全符合解耦原则，不保留长篇碰撞/AI判定方法，仅负责装配子系统并分发生命周期心跳
 */
import { Player } from '../entities/Player.js';
import { InputSystem } from '../systems/InputSystem.js';
import { SpawnSystem } from '../systems/SpawnSystem.js';
import { SkillSystem } from '../systems/SkillSystem.js';
import { LootSystem } from '../systems/LootSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { HUD } from '../ui/HUD.js';
import { VirtualJoystick } from '../ui/VirtualJoystick.js';
import { LevelUpMenu } from '../ui/LevelUpMenu.js';
import { DamageTextPool } from '../utils/DamageTextPool.js';
import { SoundSynth } from '../utils/SoundSynth.js';
import { GameState } from '../state/GameState.js';

export class BattleScene extends Phaser.Scene {
    constructor() {
        super('BattleScene');
    }

    init() {
        // Replay flow should never depend on another scene having already rebuilt run state.
        GameState.endSceneTransition();
        if (!GameState.run) {
            GameState.startRun();
        }
    }

    create() {
        const w = 720;
        const h = 1280;
        this.isTransitioningOut = false;
        this._shuttingDown = false;
        this._exitStarted = false;
        this._sceneChangeLocked = false;
        this._reviveModal = null;
        this._pendingReviveRequestId = null;
        this.sys.events.once('shutdown', this.shutdown, this);
        this.sys.events.once('destroy', this.shutdown, this);

        // 1. 初始化 Web Audio 音效及伤害飘字池 (GC 绝缘)
        this.soundSynth = SoundSynth;
        this.dmgTextPool = new DamageTextPool(this);

        // 2. 物理图层及平铺无限熔岩背景
        // 绑定 tileSprite 在玩家视角正中心，update 中随移动偏移，达成零开销无限地图
        this.background = this.add.tileSprite(w / 2, h / 2, w, h, 'lava_tile')
            .setDepth(0)
            .setAlpha(0.92)
            .setTint(0xe7d8c0)
            .setScrollFactor(0)
            .setTileScale(0.38); // 进一步压缩地砖视觉尺寸，让主角与怪物重新回到可读的世界尺度
        this.gridOverlay = this.add.tileSprite(w / 2, h / 2, w, h, 'ground_overlay')
            .setDepth(1)
            .setAlpha(0.46)
            .setBlendMode(Phaser.BlendModes.SCREEN)
            .setTint(0xff7744)
            .setScrollFactor(0)
            .setTileScale(0.38); // 叠层纹理同步缩小，避免角色像贴在超大砖块上的纸片

        // 3. 静态血迹贴刻 RenderTexture 层 (零对象永久地表血溅)
        this.bloodLayer = this.add.renderTexture(0, 0, 3000, 3000).setDepth(2).setOrigin(0.5);
        this.bloodLayer.setPosition(360, 640);

        // 4. 初始化基础物理实体 Group
        this.enemiesGroup = this.physics.add.group();
        this.casterBullets = this.physics.add.group();

        // 5. 内存中构建轻量化爆散粒子发射器
        this.initParticleGroups();

        // 6. 实例化玩家修士实体
        this.player = new Player(this, w / 2, h / 2);

        // 7. 摄像机跟踪玩家，锁紧黄金视区
        this.cameras.main.setBounds(-1000, -1000, 2720, 3280);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.physics.world.setBounds(-1000, -1000, 2720, 3280);

        // 8. 系统组装 (Systems Integration)
        this.inputSystem = new InputSystem(this);
        this.spawnSystem = new SpawnSystem(this);
        this.skillSystem = new SkillSystem(this);
        this.lootSystem = new LootSystem(this);
        this.combatSystem = new CombatSystem(this);

        // 9. UI 控制器与加点菜单装配
        this.hud = new HUD(this);
        this.joystick = new VirtualJoystick(this);
        this.levelUpMenu = new LevelUpMenu(this);

        // 绑定手势至输入系统
        this.inputSystem.setJoystick(this.joystick);

        // 10. 注册修士死亡与首领阵亡监听
        this.events.once('player_died', this.onPlayerDied, this);
        this.events.once('boss_killed', this.onBossKilled, this);

        // 11. 确保战斗场景中不显示广告横幅
        if (window.PlatformAdapter) {
            window.PlatformAdapter.hideBanner();
            window.PlatformAdapter.trackEvent('enter_battle', { stage: 'Battle' });
        }
    }

    /**
     * 程序化构建四种粒子发生器，支持多重爆爆感 (†字、☠字、火花、碎肉)
     */
    initParticleGroups() {
        // A. 碎火花粒子 (修士跑尘与爆火球)
        this.fireParticles = this.createParticleEmitter('fireParticle', 0.9, 140, { min: 250, max: 400 });
        
        // B. 爆血碎肉粒子 (杂鱼阵亡)
        this.deathParticles = this.createParticleEmitter('particle', 1.0, 180, { min: 300, max: 500 });

        // C. 十字死纹粒子 (Demon † 阵亡)
        this.binaryParticles0 = this.createParticleEmitter('particle_0', 1.2, 100, { min: 400, max: 700 });

        // D. 骷髅死纹粒子 (Demon ☠ 阵亡)
        this.binaryParticles1 = this.createParticleEmitter('particle_1', 1.2, 100, { min: 400, max: 700 });
    }

    /**
     * 高性能粒子虚拟 Emitter 构造器 (纯 Tween 回收，防 Phaser 粒子内存溢出)
     */
    createParticleEmitter(texture, scale, baseSpeed, lifespanRange) {
        const group = this.add.group();
        
        group.emitParticleAt = (x, y, count, tint = null) => {
            for (let i = 0; i < count; i++) {
                if (!this.scene || !this.scene.isActive('BattleScene')) return;

                const p = this.add.sprite(x, y, texture);
                p.setDepth(12);
                p.setScale(scale * Phaser.Math.FloatBetween(0.85, 1.25));
                p.setAlpha(Phaser.Math.FloatBetween(0.7, 1.0));
                if (tint !== null) {
                    p.setTint(tint);
                }

                this.physics.add.existing(p);
                const angle = Math.random() * Math.PI * 2;
                const speed = Phaser.Math.FloatBetween(baseSpeed * 0.4, baseSpeed);
                
                p.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
                p.body.setDrag(180); // 地面摩擦力

                this.tweens.add({
                    targets: p,
                    alpha: 0,
                    scaleX: scale * 0.1,
                    scaleY: scale * 0.1,
                    duration: Phaser.Math.Between(lifespanRange.min, lifespanRange.max),
                    onComplete: () => p.destroy()
                });
            }
        };

        return group;
    }

    /**
     * 场景心跳：仅做坐标同步与子系统驱动
     */
    update(time, delta) {
        if (this._shuttingDown || this.isTransitioningOut || !this.player?.active) return;

        // 🌟 升级菜单打开时，核心战斗逻辑与时间计数完全暂停！
        // 挂起敌人更新、伤害判定、玩家施法驱动、波次生成、及局内时间计时，关闭菜单后复原
        if (this.levelUpMenu && this.levelUpMenu.isOpen) {
            return;
        }

        // 1. 固定屏幕底图，仅滚动纹理偏移，并锁死与世界坐标的 1:1 物理位移，解决“滑行感”的视觉错觉
        const cam = this.cameras.main;
        this.background.tilePositionX = cam.scrollX;
        this.background.tilePositionY = cam.scrollY;
        this.gridOverlay.tilePositionX = cam.scrollX; // 彻底消灭 1.03 差速引起的滑步漂移，百分之百与物理背景及实体层锁死
        this.gridOverlay.tilePositionY = cam.scrollY;

        // 2. 收集输入并驱动玩家物理实体姿态
        const inputState = this.inputSystem.getInputState(time);
        this.player.update(time, inputState);

        // 3. 驱动核心逻辑系统 (怪物波次、施法计时、重力磁吸物理)
        this.spawnSystem.update(time, delta, this.player);
        this.skillSystem.update(time, this.player);
        this.lootSystem.update(time, this.player);
        
        // 4. 驱动 UI 刷新与虚拟雷电扫频 CD
        this.hud.update(time);
        this.joystick.update(time);

        // 5. 对怪群执行 update (处理远程幽灵停步施法及 Boss 散射弹幕)
        this.enemiesGroup.getChildren().forEach(enemy => {
            if (enemy.active) {
                enemy.update(time, this.player);
            }
        });
    }

    /**
     * 玩家死亡流程
     */
    onPlayerDied() {
        this.isTransitioningOut = true;
        this.cameras.main.shake(500, 0.02);
        this.cameras.main.flash(500, 138, 0, 0); // 耀目红闪

        // 延时 1.2 秒显示复活窗口或直接进行结算
        this.time.delayedCall(1200, () => {
            const run = GameState.run;
            if (run && (run.reviveUsed === undefined || run.reviveUsed < 1)) {
                this.showReviveModal();
            } else {
                this.requestSceneChange('ResultScene', { victory: false });
            }
        });
    }

    /**
     * 显示复活倒计时弹窗 (Gothic Premium style)
     */
    showReviveModal() {
        if (this._shuttingDown || this._sceneChangeLocked) return;
        const w = 720;
        const h = 1280;

        // 停止物理与输入系统以事实局内暂停
        this.physics.pause();
        this.inputSystem.enabled = false;

        // 创建一个 Phaser Container 挂载弹层
        const modalContainer = this.add.container(0, 0).setDepth(200);

        // 1. 半透明黑色背景遮罩
        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x000000, 0.8);
        backdrop.fillRect(0, 0, w, h);
        backdrop.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
        modalContainer.add(backdrop);

        // 2. 弹窗主面板 (Diablo 黄金暗金属边框)
        const panelW = 540;
        const panelH = 420;
        const px = w / 2;
        const py = h / 2;

        const panel = this.add.graphics();
        panel.lineStyle(2, 0xe5a93c, 0.95);
        panel.fillStyle(0x130d0d, 0.96);
        panel.strokeRect(px - panelW/2, py - panelH/2, panelW, panelH);
        panel.fillRect(px - panelW/2 + 2, py - panelH/2 + 2, panelW - 4, panelH - 4);
        
        // 浮雕红线内衬
        panel.lineStyle(1, 0x8a0000, 0.65);
        panel.strokeRect(px - panelW/2 + 6, py - panelH/2 + 6, panelW - 12, panelH - 12);
        modalContainer.add(panel);

        // 3. 灵魂断裂大标题 (中世纪哥特风格)
        const title = this.add.text(px, py - 140, '† 灵魂之契断裂 †', {
            fontFamily: 'Cinzel, serif',
            fontSize: '32px',
            color: '#ff1a1a',
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 5,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 4, fill: true }
        }).setOrigin(0.5).setDepth(201);
        modalContainer.add(title);

        const desc = this.add.text(px, py - 60, '驱魔大业未半而中道崩殂！\n是否恭请大天使降临圣光，\n重塑金身，满血重生？', {
            fontFamily: 'Spectral, serif',
            fontSize: '18px',
            color: '#cfc5b3',
            align: 'center',
            lineSpacing: 12
        }).setOrigin(0.5).setDepth(201);
        modalContainer.add(desc);

        // 4. 倒计时秒数
        let secondsLeft = 5;
        const countdownText = this.add.text(px, py + 25, `灵魂消散倒计时: ${secondsLeft} 秒`, {
            fontFamily: 'Spectral, serif',
            fontSize: '17px',
            color: '#e5a93c',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(201);
        modalContainer.add(countdownText);

        // 5. 复活与放弃按钮
        const btnW = 400;
        const btnH = 68;

        const adBtnBg = this.add.graphics();
        const adBtnY = py + 100;
        this.drawModalButtonGlow(adBtnBg, px, adBtnY, btnW, btnH, false, 0xe5a93c);
        modalContainer.add(adBtnBg);

        const adBtnText = this.add.text(px, adBtnY, '📺 唤醒圣光 (观看视频复活)', {
            fontFamily: 'Spectral, serif',
            fontSize: '19px',
            color: '#ffffff',
            fontWeight: 'bold',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(201);
        modalContainer.add(adBtnText);

        const adHit = this.add.zone(px, adBtnY, btnW, btnH).setOrigin(0.5).setInteractive({ useHandCursor: true });
        modalContainer.add(adHit);

        const cancelBtnBg = this.add.graphics();
        const cancelBtnY = py + 175;
        this.drawModalButtonGlow(cancelBtnBg, px, cancelBtnY, btnW, btnH, false, 0x8c7e6c);
        modalContainer.add(cancelBtnBg);

        const cancelBtnText = this.add.text(px, cancelBtnY, '☠ 堕入深渊 (放弃复活)', {
            fontFamily: 'Spectral, serif',
            fontSize: '17px',
            color: '#8c7e6c',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(201);
        modalContainer.add(cancelBtnText);

        const cancelHit = this.add.zone(px, cancelBtnY, btnW, btnH).setOrigin(0.5).setInteractive({ useHandCursor: true });
        modalContainer.add(cancelHit);

        // 倒计时事件
        const countdownTimer = this.time.addEvent({
            delay: 1000,
            callback: () => {
                secondsLeft--;
                if (secondsLeft <= 0) {
                    countdownTimer.remove();
                    this.closeReviveModalAndDie(modalContainer);
                } else {
                    countdownText.setText(`灵魂消散倒计时: ${secondsLeft} 秒`);
                }
            },
            loop: true
        });
        this._reviveModal = { container: modalContainer, countdownTimer, adHit, cancelHit };

        // 悬浮高亮效果
        adHit.on('pointerover', () => {
            this.drawModalButtonGlow(adBtnBg, px, adBtnY, btnW, btnH, true, 0xe5a93c);
            adBtnText.setScale(1.03).setTint(0xffd700);
            SoundSynth.play('coin');
        });
        adHit.on('pointerout', () => {
            this.drawModalButtonGlow(adBtnBg, px, adBtnY, btnW, btnH, false, 0xe5a93c);
            adBtnText.setScale(1.0).clearTint();
        });
        adHit.on('pointerdown', () => {
            countdownTimer.remove();
            adHit.disableInteractive();
            cancelHit.disableInteractive();

            if (window.PlatformAdapter) {
                this._pendingReviveRequestId = window.PlatformAdapter.revivePlayer(success => {
                    if (this._shuttingDown || this._sceneChangeLocked || !this.scene?.isActive('BattleScene')) return;
                    if (success) {
                        this.executeRevive(modalContainer);
                    } else {
                        this.closeReviveModalAndDie(modalContainer);
                    }
                });
            } else {
                this.executeRevive(modalContainer);
            }
        });

        cancelHit.on('pointerover', () => {
            this.drawModalButtonGlow(cancelBtnBg, px, cancelBtnY, btnW, btnH, true, 0x8a0000);
            cancelBtnText.setScale(1.03).setColor('#ff1a1a');
            SoundSynth.play('coin');
        });
        cancelHit.on('pointerout', () => {
            this.drawModalButtonGlow(cancelBtnBg, px, cancelBtnY, btnW, btnH, false, 0x8c7e6c);
            cancelBtnText.setScale(1.0).setColor('#8c7e6c');
        });
        cancelHit.on('pointerdown', () => {
            countdownTimer.remove();
            this.closeReviveModalAndDie(modalContainer);
        });
    }

    drawModalButtonGlow(g, x, y, w, h, hover, lineColor) {
        g.clear();
        g.lineStyle(1.5, hover ? 0xffffff : lineColor, 0.85);
        g.fillStyle(hover ? 0x2a1414 : 0x140e0e, 0.95);
        g.strokeRect(x - w / 2, y - h / 2, w, h);
        g.fillRect(x - w / 2 + 1, y - h / 2 + 1, w - 2, h - 2);
    }

    closeReviveModalAndDie(container) {
        this.clearReviveModal();
        container.destroy();
        this.requestSceneChange('ResultScene', { victory: false });
    }

    executeRevive(container) {
        this.clearReviveModal();
        container.destroy();
        this.isTransitioningOut = false;
        this._exitStarted = false;
        this._sceneChangeLocked = false;
        GameState.endSceneTransition('ResultScene');

        if (GameState.run) {
            GameState.run.reviveUsed = (GameState.run.reviveUsed || 0) + 1;
            GameState.run.isGameOver = false;
            GameState.run.hp = GameState.run.hpMax;
            GameState.run.isInvincible = true;
        }

        // 重新启动物理引擎与输入系统
        this.physics.resume();
        this.inputSystem.enabled = true;

        // 激活并重塑玩家物理实体
        if (this.player) {
            this.player.hp = GameState.run.hpMax;
            this.player.setVisible(true);
            this.player.setScale(1.0);
            this.player.setAngle(0);
            this.player.clearTint();
            
            // 黄金圣光全屏闪耀
            this.cameras.main.flash(800, 229, 169, 60, 0.8);
            if (this.soundSynth) {
                this.soundSynth.play('laser');
            }

            // 发散粒子
            if (this.fireParticles) {
                this.fireParticles.emitParticleAt(this.player.x, this.player.y, 40);
            }

            // 清理身旁 500 像素内所有怪，赐予 9999 神圣伤害超度它们！
            const enemies = [...this.enemiesGroup.getChildren()];
            enemies.forEach(enemy => {
                if (enemy.active) {
                    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
                    if (dist < 500) {
                        enemy.takeDamage(9999, 'holy_explosion');
                    }
                }
            });

            // 给予 3 秒的无敌庇护，加强战斗容错
            this.time.delayedCall(3000, () => {
                if (GameState.run) {
                    GameState.run.isInvincible = false;
                }
            });
        }
    }

    /**
     * 首领阵亡，修士凯旋流程
     */
    onBossKilled() {
        this.isTransitioningOut = true;
        this.beginSceneExit();
        this.cameras.main.flash(1000, 229, 169, 60, 0.8); // 耀目金光
        
        // 播放神圣驱魔完成声效
        if (this.soundSynth) {
            this.soundSynth.play('laser');
        }

        // 延时 2 秒进入结算，供欣赏巨魔灰飞烟灭
        this.time.delayedCall(2000, () => {
            this.requestSceneChange('ResultScene', { victory: true });
        });
    }

    /**
     * 场景切出注销，彻底防止事件监听器多次注册引发泄漏
     */
    shutdown() {
        if (this._shuttingDown) return;
        this._shuttingDown = true;
        this.isTransitioningOut = true;
        this.events.off('player_died', this.onPlayerDied, this);
        this.events.off('boss_killed', this.onBossKilled, this);
        this.sys?.events?.off('shutdown', this.shutdown, this);
        this.sys?.events?.off('destroy', this.shutdown, this);

        this.beginSceneExit();

        const clearGroupChildren = group => {
            const entries = group?.children?.entries;
            if (!Array.isArray(entries)) return;
            [...entries].forEach(child => child?.destroy?.());
        };

        const destroyGroupSafely = group => {
            clearGroupChildren(group);
            try { group?.destroy?.(); } catch {}
        };

        this.spawnSystem?.destroy?.();
        this.skillSystem?.destroy?.();
        this.lootSystem?.destroy?.();
        this.combatSystem?.destroy?.();
        this.joystick?.destroy?.();
        this.hud?.destroy?.();
        this.levelUpMenu?.destroy?.();
        this.player?.destroy?.();
        destroyGroupSafely(this.enemiesGroup);
        destroyGroupSafely(this.casterBullets);
        this.enemiesGroup = null;
        this.casterBullets = null;
        destroyGroupSafely(this.fireParticles);
        destroyGroupSafely(this.deathParticles);
        destroyGroupSafely(this.binaryParticles0);
        destroyGroupSafely(this.binaryParticles1);
        this.fireParticles = null;
        this.deathParticles = null;
        this.binaryParticles0 = null;
        this.binaryParticles1 = null;
        this.inputSystem = null;
        this.spawnSystem = null;
        this.skillSystem = null;
        this.lootSystem = null;
        this.combatSystem = null;
        this.player = null;
    }

    beginSceneExit() {
        if (this._exitStarted) return;
        this._exitStarted = true;
        this.clearReviveModal();

        if (this.inputSystem) {
            this.inputSystem.enabled = false;
        }
        if (this.player?.body) {
            this.player.setVelocity(0, 0);
        }
        if (this.physics?.world) {
            this.physics.world.pause();
        }

        this.tweens?.killAll?.();
        this.time?.removeAllEvents?.();
    }

    clearReviveModal() {
        if (window.PlatformAdapter && this._pendingReviveRequestId != null) {
            try { window.PlatformAdapter.cancelPendingRevive(this._pendingReviveRequestId); } catch {}
        }
        this._pendingReviveRequestId = null;
        if (!this._reviveModal) return;
        try { this._reviveModal.countdownTimer?.remove?.(); } catch {}
        try { this._reviveModal.adHit?.removeAllListeners?.(); } catch {}
        try { this._reviveModal.cancelHit?.removeAllListeners?.(); } catch {}
        this._reviveModal = null;
    }

    requestSceneChange(sceneKey, data) {
        if (this._sceneChangeLocked || this._shuttingDown) return;
        if (!GameState.beginSceneTransition(sceneKey)) return;
        this._sceneChangeLocked = true;
        this.isTransitioningOut = true;
        this.beginSceneExit();

        try {
            this.scene.start(sceneKey, data);
        } catch (error) {
            this._sceneChangeLocked = false;
            GameState.endSceneTransition(sceneKey);
            throw error;
        }
    }
}

export default BattleScene;
