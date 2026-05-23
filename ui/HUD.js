/**
 * HUD.js - 核心战斗局内 HUD 视图层
 * 渲染避让刘海的异形经验条、关卡秒级计时器，及底部金箍暗红生命流体球 (Diablo Style)
 */
import { UIConfig } from '../config/UIConfig.js';
import { GameState } from '../state/GameState.js';

export class HUD {
    /**
     * @param {Phaser.Scene} scene 挂载的场景
     */
    constructor(scene) {
        this.scene = scene;

        // 1. 初始化图形绘制器
        this.xpBarGraphics = scene.add.graphics().setScrollFactor(0);
        this.xpBarGraphics.setDepth(15);

        this.globeBackground = scene.add.graphics().setScrollFactor(0);
        this.globeBackground.setDepth(14);
        
        this.globeFluidGraphics = scene.add.graphics().setScrollFactor(0);
        this.globeFluidGraphics.setDepth(15);
        
        this.globeBorderGraphics = scene.add.graphics().setScrollFactor(0);
        this.globeBorderGraphics.setDepth(16);

        // 2. 物理裁切遮罩：通过 Phaser Mask 机制，让生命流体只在圆球内部平顺起伏
        const gx = UIConfig.healthGlobe.x;
        const gy = UIConfig.healthGlobe.y;
        const grad = UIConfig.healthGlobe.radius;

        // 绘制灰色生命球背景底膜
        this.globeBackground.fillStyle(0x181010, 0.95);
        this.globeBackground.fillCircle(gx, gy, grad);

        // 动态遮罩形状 (半径缩进4像素作为内径)
        const maskShape = scene.make.graphics().setScrollFactor(0);
        maskShape.fillCircle(gx, gy, grad - 4);
        const fluidMask = maskShape.createGeometryMask();
        this.globeFluidGraphics.setMask(fluidMask);

        // 3. 初始化文本标签 (应用 Cinzel 哥特古典英文字体与 Spectral 中文字体)
        this.initLabels();
    }

    /**
     * 初始化各类 HUD 文本 (大小、对齐、金光阴影)
     */
    initLabels() {
        const styleText = {
            fontFamily: 'Spectral, serif',
            fontSize: '22px',
            color: '#cfc5b3', // 骨白色
            stroke: '#000000',
            strokeThickness: 3,
            shadow: { offsetX: 1, offsetY: 2, color: '#000', blur: 3, fill: true }
        };

        const gothicStyle = {
            fontFamily: 'Cinzel, serif',
            fontSize: '24px',
            color: '#e5a93c', // 黄金强调色
            stroke: '#000000',
            strokeThickness: 4,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 4, fill: true }
        };

        // 顶部等级/时间/金币/斩杀/积分
        this.levelLabel = this.scene.add.text(
            UIConfig.labels.levelText.x,
            UIConfig.labels.levelText.y,
            '阶位: 1',
            styleText
        ).setDepth(16).setScrollFactor(0);

        this.coinLabel = this.scene.add.text(
            UIConfig.labels.coinText.x,
            UIConfig.labels.coinText.y,
            '金币: 0',
            styleText
        ).setOrigin(0, 0).setDepth(16).setScrollFactor(0);

        this.timeLabel = this.scene.add.text(
            UIConfig.labels.timeText.x,
            UIConfig.labels.timeText.y,
            '00:00',
            gothicStyle
        ).setOrigin(0.5, 0.5).setDepth(16).setScrollFactor(0);

        this.killLabel = this.scene.add.text(
            UIConfig.labels.killText.x,
            UIConfig.labels.killText.y,
            '斩杀: 0',
            styleText
        ).setOrigin(1, 0).setDepth(16).setScrollFactor(0);

        // 底部生命值简易数字显示 (叠在生命球正中心)
        this.hpText = this.scene.add.text(
            UIConfig.healthGlobe.x,
            UIConfig.healthGlobe.y,
            '100/100',
            {
                fontFamily: 'Cinzel, serif',
                fontSize: '18px',
                color: '#fff',
                stroke: '#000',
                strokeThickness: 3
            }
        ).setOrigin(0.5, 0.5).setDepth(17).setScrollFactor(0);
    }

    /**
     * HUD 生命周期刷新
     * @param {number} time 当前毫秒时间
     */
    update(time) {
        if (this.destroyed || this.scene?.isTransitioningOut) return;
        if (!GameState.run) return;

        const run = GameState.run;

        // 1. 更新顶部数值标签
        this.levelLabel.setText(`阶位: ${run.level}`);
        this.killLabel.setText(`斩杀: ${run.kills}`);
        this.coinLabel.setText(`金币: ${run.goldEarned}`);
        
        // 格式化时长 (MM:SS)
        const min = String(Math.floor(run.elapsedTime / 60)).padStart(2, '0');
        const sec = String(run.elapsedTime % 60).padStart(2, '0');
        this.timeLabel.setText(`${min}:${sec}`);

        // 更新生命数字
        this.hpText.setText(`${run.hp}/${run.hpMax}`);

        // 2. 重新绘制顶部经验条 (金框拉花包裹)
        this.drawXpBar(run.xp / run.xpNeeded);

        // 3. 动态绘制生命球流体 (Diablo式物理高度剪裁)
        this.drawHealthGlobe(run.hp / run.hpMax);
    }

    /**
     * 绘制经验条
     * @param {number} ratio 经验占比 (0 - 1.0)
     */
    drawXpBar(ratio) {
        const cfg = UIConfig.xpBar;
        const g = this.xpBarGraphics;
        g.clear();

        // 绘制金色细边框
        g.lineStyle(1.5, cfg.borderColor, 0.85);
        g.strokeRect(cfg.x, cfg.y, cfg.width, cfg.height);

        // 绘制暗灰背景底盘
        g.fillStyle(cfg.bgColor, 0.7);
        g.fillRect(cfg.x + 2, cfg.y + 2, cfg.width - 4, cfg.height - 4);

        // 绘制亮蓝色幽能进度条
        if (ratio > 0) {
            g.fillStyle(cfg.color, 0.95);
            g.fillRect(cfg.x + 2, cfg.y + 2, (cfg.width - 4) * Math.min(1, ratio), cfg.height - 4);
        }
    }

    /**
     * 绘制生命流体球
     * @param {number} ratio 血量占比 (0 - 1.0)
     */
    drawHealthGlobe(ratio) {
        const cfg = UIConfig.healthGlobe;
        
        // A. 绘制内部动态血液流体 (裁切遮罩下)
        const fg = this.globeFluidGraphics;
        fg.clear();

        if (ratio > 0) {
            fg.fillStyle(cfg.fluidColor, 0.95);

            // 液体顶部高度 Y 轴物理偏移
            const fluidHeight = cfg.radius * 2 * ratio;
            const topY = cfg.y + cfg.radius - fluidHeight;

            // 绘制填充矩形 (通过遮罩自动约束成圆形水滴)
            fg.fillRect(
                cfg.x - cfg.radius,
                topY,
                cfg.radius * 2,
                fluidHeight
            );

            // 在液面上画一层微泛白光的波浪边，加强质感
            fg.fillStyle(0xff4d4d, 0.35);
            fg.fillRect(
                cfg.x - cfg.radius,
                topY,
                cfg.radius * 2,
                4
            );
        }

        // B. 绘制外圈金色立体金属铁箍 (永远覆在最上面)
        const bg = this.globeBorderGraphics;
        bg.clear();
        
        // 浮雕金箍双圈包边
        bg.lineStyle(4, cfg.borderColor, 1);
        bg.strokeCircle(cfg.x, cfg.y, cfg.radius);
        
        bg.lineStyle(1, 0x000000, 0.7);
        bg.strokeCircle(cfg.x, cfg.y, cfg.radius - 2.5);
    }

    /**
     * 彻底销毁
     */
    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        [
            this.xpBarGraphics,
            this.globeBackground,
            this.globeFluidGraphics,
            this.globeBorderGraphics,
            this.levelLabel,
            this.timeLabel,
            this.killLabel,
            this.coinLabel,
            this.hpText
        ].forEach(el => {
            if (el && el.active !== false && el.destroy) el.destroy();
        });
    }
}

export default HUD;
