/**
 * ResultScene.js - 局内结算与战绩统计场景
 * 承载单局结算流：调用 GameState.endRun 固化金币与得分数据，展示极具仪式感的哥特凯旋/败亡与战利品结算界面
 */
import { GameState } from '../state/GameState.js';
import { SoundSynth } from '../utils/SoundSynth.js';
import { EquipmentConfig } from '../config/EquipmentConfig.js';

export class ResultScene extends Phaser.Scene {
    constructor() {
        super('ResultScene');
        this.isLeavingScene = false;
    }

    /**
     * Phaser 生命周期接收 BattleScene 传入的战斗结果
     * @param {Object} data 战斗结果参数 { victory: boolean }
     */
    init(data) {
        this.isLeavingScene = false;
        GameState.endSceneTransition();
        this.victory = data ? !!data.victory : false;
        
        // 1. 调用状态管理器固化金币和高分，固化装备，返回局内数据快照
        this.summary = GameState.endRun(this.victory) || {
            level: 1,
            kills: 0,
            goldEarned: 0,
            score: 0,
            elapsedTime: 0,
            lootedGear: []
        };

        // 2. 统计埋点上报：run_end
        if (window.PlatformAdapter) {
            window.PlatformAdapter.trackEvent('run_end', {
                victory: this.victory ? 1 : 0,
                score: this.summary.score,
                kills: this.summary.kills,
                gold: this.summary.goldEarned,
                level: this.summary.level,
                time: this.summary.elapsedTime,
                lootedCount: this.summary.lootedGear ? this.summary.lootedGear.length : 0
            });
        }
    }

    create() {
        const w = 720;
        const h = 1280;

        // 3. 平铺熔岩微弱背景
        this.add.tileSprite(w / 2, h / 2, w, h, 'lava_tile').setAlpha(0.22).setTint(0xd4c3aa).setDepth(0);

        // 4. 黑色高强度遮罩渐变
        const overlay = this.add.graphics();
        overlay.fillStyle(0x080404, 0.9);
        overlay.fillRect(0, 0, w, h);
        overlay.setDepth(1);

        // 5. 凯旋/败亡大字特效
        const titleY = 220;
        const titleText = this.victory ? '驱 魔 凯 旋' : '功 败 垂 成';
        const titleColor = this.victory ? '#e5a93c' : '#ff1a1a'; // 胜利金色，失败血红
        const subtitleText = this.victory ? 'VICTORY SANCTUARY' : 'DEFEATED IN DARKNESS';

        const mainTitle = this.add.text(w / 2, titleY, titleText, {
            fontFamily: 'Cinzel, serif',
            fontSize: '64px',
            fontWeight: '900',
            color: titleColor,
            stroke: '#000000',
            strokeThickness: 8,
            shadow: { offsetX: 3, offsetY: 3, color: '#000000', blur: 10, fill: true }
        }).setOrigin(0.5).setDepth(2).setScale(0.8);

        this.add.text(w / 2, titleY + 60, subtitleText, {
            fontFamily: 'Cinzel, serif',
            fontSize: '16px',
            color: this.victory ? '#a69076' : '#8a0000',
            letterSpacing: 4
        }).setOrigin(0.5).setDepth(2);

        // 主标题缓动放大登场
        this.tweens.add({
            targets: mainTitle,
            scaleX: 1.0,
            scaleY: 1.0,
            duration: 800,
            ease: 'Back.easeOut'
        });

        // 6. 战绩详情面板 (Y = 340)
        this.drawStatsPanel(w, h);

        // 7. 战利品结算展示 (Y = 760)
        this.drawLootPanel(w, h);

        // 8. 底部双通道大键 (再起风云 / 返回酒馆)
        this.createActionButtons(w, h);

        // 播放结算声效
        SoundSynth.play(this.victory ? 'laser' : 'hit');

        // 展示底部广告横幅
        if (window.PlatformAdapter) {
            window.PlatformAdapter.showBanner();
        }
    }

    /**
     * 绘制哥特半透明战绩面板并逐条展现数据
     */
    drawStatsPanel(w, h) {
        const cx = w / 2;
        const panelY = 340;
        const panelWidth = 540;
        const panelHeight = 390;

        const panel = this.add.graphics();
        panel.lineStyle(1.5, this.victory ? 0xe5a93c : 0x8a0000, 0.6);
        panel.strokeRect(cx - panelWidth / 2, panelY, panelWidth, panelHeight);
        panel.fillStyle(0x110808, 0.85);
        panel.fillRect(cx - panelWidth / 2 + 1, panelY + 1, panelWidth - 2, panelHeight - 2);
        panel.setDepth(2);

        // 计算生存时间格式
        const mins = Math.floor(this.summary.elapsedTime / 60);
        const secs = this.summary.elapsedTime % 60;
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        // 战绩指标
        const stats = [
            { icon: '⏳', label: '开局生存时间', val: timeStr, color: '#cfc5b3' },
            { icon: '⚔️', label: '净化超度魔物', val: `${this.summary.kills} 骸`, color: '#cfc5b3' },
            { icon: '🪙', label: '本局斩获金币', val: `+ ${this.summary.goldEarned} 🪙`, color: '#e5a93c' },
            { icon: '⭐', label: '修士最终等级', val: `LV. ${this.summary.level}`, color: '#00ffff' },
            { icon: '🏆', label: '最终圣殿积分', val: `${this.summary.score} PTS`, color: '#ff1a1a' }
        ];

        let startY = panelY + 35;
        const spacing = 68;

        stats.forEach((item, index) => {
            // 左侧描述
            const labelText = this.add.text(cx - 220, startY, `${item.icon} ${item.label}`, {
                fontFamily: 'Spectral, serif',
                fontSize: '18px',
                color: '#8c7e6c'
            }).setDepth(3).setAlpha(0);

            // 右侧数值
            const valText = this.add.text(cx + 220, startY, item.val, {
                fontFamily: 'Spectral, serif',
                fontSize: '20px',
                color: item.color,
                fontWeight: 'bold'
            }).setOrigin(1, 0).setDepth(3).setAlpha(0);

            // 分割横线
            let line = null;
            if (index < stats.length - 1) {
                line = this.add.graphics();
                line.lineStyle(1, 0xffffff, 0.04);
                line.lineBetween(cx - 220, startY + 42, cx + 220, startY + 42);
                line.setDepth(3).setAlpha(0);
            }

            // 逐条阶梯式渐显，增强仪式感
            this.tweens.add({
                targets: [labelText, valText],
                alpha: 1,
                x: { start: cx - 250, to: cx - 220 },
                delay: index * 120,
                duration: 350,
                ease: 'Power2.easeOut'
            });

            if (line) {
                this.tweens.add({
                    targets: line,
                    alpha: 1,
                    delay: index * 120 + 80,
                    duration: 250
                });
            }

            startY += spacing;
        });
    }

    /**
     * 绘制本局装备战利品收获面板
     */
    drawLootPanel(w, h) {
        const cx = w / 2;
        const lootY = 750;
        const panelWidth = 540;
        const panelHeight = 120;

        // 1. 战利品标题
        this.add.text(cx, lootY, '🎁 本局获得的战利品 (LOOTED GEAR)', {
            fontFamily: 'Cinzel, serif',
            fontSize: '14px',
            color: '#cfc5b3'
        }).setOrigin(0.5).setDepth(2);

        // 2. 战利品边框框体 (金虚线框)
        const lootBox = this.add.graphics();
        lootBox.lineStyle(1.5, 0xe5a93c, 0.5);
        lootBox.strokeRect(cx - panelWidth / 2, lootY + 15, panelWidth, panelHeight);
        lootBox.fillStyle(0x1a0d0d, 0.75);
        lootBox.fillRect(cx - panelWidth / 2 + 1, lootY + 16, panelWidth - 2, panelHeight - 2);
        lootBox.setDepth(2);

        const lootedGear = this.summary.lootedGear || [];

        if (lootedGear.length === 0) {
            // 没有获得装备
            const noLootText = this.add.text(cx, lootY + 75, '本局未掉落神兵利器，继续努力超度魔物吧！', {
                fontFamily: 'Spectral, serif',
                fontSize: '15px',
                color: '#666666'
            }).setOrigin(0.5).setDepth(3);
            
            // 缓动闪烁
            this.tweens.add({
                targets: noLootText,
                alpha: 0.5,
                duration: 1000,
                yoyo: true,
                loop: -1
            });
        } else {
            // 绘制横向排列的装备小卡片
            const cardW = 140;
            const cardH = 75;
            const cardY = lootY + 75;
            const total = lootedGear.length;
            const spacingX = 160;

            lootedGear.forEach((inst, idx) => {
                // 如果一局掉了很多，限制只展示前3个防界面溢出
                if (idx >= 3) return;

                const cfg = EquipmentConfig.items[inst.id];
                if (!cfg) return;

                const sx = cx + (idx - (total - 1) / 2) * spacingX;

                // 装备卡小边框
                const card = this.add.graphics().setDepth(3);
                card.lineStyle(1, 0xe5a93c, 0.85);
                card.fillStyle(0x351d1d, 0.9);
                card.strokeRect(sx - cardW/2, cardY - cardH/2, cardW, cardH);
                card.fillRect(sx - cardW/2 + 1, cardY - cardH/2 + 1, cardW - 2, cardH - 2);

                // 小图标和名字
                const slotIcons = { WEAPON: '⚔️', AMULET: '🛡️', BOOTS: '⚡', RING: '💍' };
                const icon = slotIcons[cfg.slot] || '🛡️';

                this.add.text(sx, cardY - 18, `${icon} ${cfg.name}`, {
                    fontFamily: 'Spectral, serif',
                    fontSize: '13px',
                    color: '#e5a93c',
                    fontWeight: 'bold'
                }).setOrigin(0.5).setDepth(4);

                this.add.text(sx, cardY + 6, `已存入持久库存`, {
                    fontFamily: 'Spectral, serif',
                    fontSize: '11px',
                    color: '#8c7e6c'
                }).setOrigin(0.5).setDepth(4);

                this.add.text(sx, cardY + 20, `Lv.${inst.level}`, {
                    fontFamily: 'Cinzel, serif',
                    fontSize: '11px',
                    color: '#cfc5b3'
                }).setOrigin(0.5).setDepth(4);

                // 卡片生成缩放与发光微缩动画
                card.setAlpha(0);
                this.tweens.add({
                    targets: card,
                    alpha: 1,
                    duration: 400,
                    delay: idx * 200,
                    ease: 'Power2.easeOut'
                });
            });
        }
    }

    /**
     * 创建底部交互控制按钮组
     */
    createActionButtons(w, h) {
        const cx = w / 2;
        const btnY = 980;
        const btnWidth = 480;
        const btnHeight = 80;

        // --- A. 再起风云 (重新战斗) ---
        const retryBg = this.add.graphics().setDepth(2);
        this.drawButtonGlow(retryBg, cx, btnY, btnWidth, btnHeight, false, '#8a0000');

        const retryText = this.add.text(cx, btnY, '再 起 风 云', {
            fontFamily: 'Cinzel, serif',
            fontSize: '24px',
            color: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(3);

        const retryHit = this.add.zone(cx, btnY, btnWidth, btnHeight).setOrigin(0.5).setDepth(4).setInteractive({ useHandCursor: true });

        retryHit.on('pointerover', () => {
            this.drawButtonGlow(retryBg, cx, btnY, btnWidth, btnHeight, true, '#ff1a1a');
            retryText.setScale(1.05).setTint(0xffd700);
            SoundSynth.play('coin');
        });

        retryHit.on('pointerout', () => {
            this.drawButtonGlow(retryBg, cx, btnY, btnWidth, btnHeight, false, '#8a0000');
            retryText.setScale(1.0).clearTint();
        });

        retryHit.on('pointerdown', () => {
            SoundSynth.play('laser');
            if (window.PlatformAdapter) {
                window.PlatformAdapter.hideBanner();
                window.PlatformAdapter.trackEvent('result_continue', { action: 'retry' });
            }
            // 初始化单局状态并重启 BattleScene
            this.requestSceneChange('BattleScene', () => {
                GameState.startRun();
            });
        });


        // --- B. 返回酒馆 (MenuScene 进行局外成长) ---
        const lobbyY = btnY + 110;
        const lobbyBg = this.add.graphics().setDepth(2);
        this.drawButtonGlow(lobbyBg, cx, lobbyY, btnWidth, btnHeight, false, '#8c7e6c');

        const lobbyText = this.add.text(cx, lobbyY, '返 回 酒 馆', {
            fontFamily: 'Cinzel, serif',
            fontSize: '24px',
            color: '#cfc5b3',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(3);

        const lobbyHit = this.add.zone(cx, lobbyY, btnWidth, btnHeight).setOrigin(0.5).setDepth(4).setInteractive({ useHandCursor: true });

        lobbyHit.on('pointerover', () => {
            this.drawButtonGlow(lobbyBg, cx, lobbyY, btnWidth, btnHeight, true, '#e5a93c');
            lobbyText.setScale(1.05).setTint(0xffd700).setColor('#ffffff');
            SoundSynth.play('coin');
        });

        lobbyHit.on('pointerout', () => {
            this.drawButtonGlow(lobbyBg, cx, lobbyY, btnWidth, btnHeight, false, '#8c7e6c');
            lobbyText.setScale(1.0).clearTint().setColor('#cfc5b3');
        });

        lobbyHit.on('pointerdown', () => {
            SoundSynth.play('laser');
            if (window.PlatformAdapter) {
                window.PlatformAdapter.hideBanner();
                window.PlatformAdapter.trackEvent('result_continue', { action: 'lobby' });
            }
            // 直接回主菜单
            this.requestSceneChange('MenuScene');
        });
    }

    requestSceneChange(sceneKey, beforeStart = null, data = undefined) {
        if (this.isLeavingScene) return;
        if (!GameState.beginSceneTransition(sceneKey)) return;
        this.isLeavingScene = true;

        try {
            if (beforeStart) beforeStart();
            this.scene.start(sceneKey, data);
        } catch (error) {
            this.isLeavingScene = false;
            GameState.endSceneTransition(sceneKey);
            throw error;
        }
    }

    /**
     * 辅助绘制高亮/普通按钮发光边框
     */
    drawButtonGlow(g, x, y, width, height, hover, colorStr) {
        g.clear();
        const baseColor = hover ? 0xffffff : 0x000000;
        const lineColor = hover ? (colorStr === '#ff1a1a' ? 0xff1a1a : 0xe5a93c) : (colorStr === '#8a0000' ? 0x8a0000 : 0x443a32);

        g.lineStyle(2, lineColor, hover ? 1.0 : 0.65);
        g.strokeRect(x - width / 2, y - height / 2, width, height);

        g.fillStyle(hover ? 0x2d0b0b : 0x140e0e, 0.9);
        g.fillRect(x - width / 2 + 2, y - height / 2 + 2, width - 4, height - 4);
    }
}

export default ResultScene;
