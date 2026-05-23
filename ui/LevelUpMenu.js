/**
 * LevelUpMenu.js - 局内三选一升级卡牌菜单视图
 * 挂起物理心跳，以哥特金属拉花框渲染三张卡牌升级，实现纯正的肉鸽点选交互
 */
import { SkillConfig } from '../config/SkillConfig.js';
import { UIConfig } from '../config/UIConfig.js';
import { GameState } from '../state/GameState.js';
import { SoundSynth } from '../utils/SoundSynth.js';

export class LevelUpMenu {
    /**
     * @param {Phaser.Scene} scene 战斗场景
     */
    constructor(scene) {
        this.scene = scene;
        this.destroyed = false;
        this.isOpen = false;

        // 维护的所有交互 UI 节点，便于一键清理销毁
        this.containerElements = [];

        // 注册事件监听：当 LootSystem 抛出升级事件时呼叫本界面
        scene.events.on('player_levelup', this.show, this);
    }

    /**
     * 呼出升级界面
     */
    show() {
        if (this.destroyed || this.isOpen || this.scene?.isTransitioningOut) return;
        if (!GameState.run || GameState.run.isGameOver) return;
        this.isOpen = true;
        this.scene.isGameplayPaused = true;

        // 1. 物理暂停，进入时空静止状态
        this.scene.physics.world.pause();
        this.scene.inputSystem && (this.scene.inputSystem.enabled = false);
        SoundSynth.setMuted(true);

        // 3. 全局半透明黑色蒙版
        const popup = UIConfig.popup;
        const overlay = this.scene.add.graphics().setScrollFactor(0);
        overlay.fillStyle(popup.overlayColor, popup.overlayAlpha);
        overlay.fillRect(0, 0, 720, 1280); // 覆盖整个竖屏视区
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, 720, 1280), Phaser.Geom.Rectangle.Contains);
        overlay.setDepth(20);
        this.containerElements.push(overlay);

        // 4. 动态筛选出 3 个不重复的升级候选卡牌
        const options = this.generateUpgradeOptions();

        // 5. 顶部“圣光加冕”古典字样
        const titleStyle = {
            fontFamily: 'Cinzel, serif',
            fontSize: '36px',
            color: '#e5a93c',
            stroke: '#000',
            strokeThickness: 5
        };
        const title = this.scene.add.text(
            popup.centerX,
            240,
            '圣 光 庇 护',
            titleStyle
        ).setOrigin(0.5, 0.5).setDepth(21).setScrollFactor(0);
        this.containerElements.push(title);

        const subTitle = this.scene.add.text(
            popup.centerX,
            290,
            '选择一项驱魔权能升级 (SELECT AN UPGRADE)',
            {
                fontFamily: 'Spectral, serif',
                fontSize: '16px',
                color: '#8c7e6c'
            }
        ).setOrigin(0.5, 0.5).setDepth(21).setScrollFactor(0);
        this.containerElements.push(subTitle);

        // 6. 垂直堆叠渲染三张卡牌 (Y轴：420, 620, 820，契合 720x1280 手机布局)
        const startY = 420;
        const spacing = 190;
        const cardWidth = 540;
        const cardHeight = 150;

        options.forEach((opt, idx) => {
            const cx = popup.centerX;
            const cy = startY + idx * spacing;

            // A. 卡牌底盘容器
            const cardBg = this.scene.add.graphics().setScrollFactor(0);
            cardBg.setDepth(21);
            
            // 绘制金色外边框
            cardBg.lineStyle(2, 0xe5a93c, 0.8);
            cardBg.strokeRect(cx - cardWidth / 2, cy - cardHeight / 2, cardWidth, cardHeight);
            
            // 内部磨砂暗红色渐变填充
            cardBg.fillStyle(0x1a0a0a, 0.95);
            cardBg.fillRect(cx - cardWidth / 2 + 2, cy - cardHeight / 2 + 2, cardWidth - 4, cardHeight - 4);
            
            this.containerElements.push(cardBg);

            // B. 绑定卡牌交互热区
            const hitZone = this.scene.add.zone(cx, cy, cardWidth, cardHeight)
                .setOrigin(0.5, 0.5)
                .setDepth(23)
                .setInteractive({ useHandCursor: true })
                .setScrollFactor(0);
                
            this.containerElements.push(hitZone);

            // C. 编写卡牌内文本 (技能标题、当前等级、技能描述)
            const titleText = this.scene.add.text(
                cx - cardWidth / 2 + 30,
                cy - 45,
                opt.title,
                {
                    fontFamily: 'Spectral, serif',
                    fontSize: '26px',
                    color: opt.color || '#fff',
                    fontWeight: 'bold',
                    stroke: '#000',
                    strokeThickness: 3
                }
            ).setDepth(22).setScrollFactor(0);
            this.containerElements.push(titleText);

            const descText = this.scene.add.text(
                cx - cardWidth / 2 + 30,
                cy + 5,
                opt.desc,
                {
                    fontFamily: 'Spectral, serif',
                    fontSize: '16px',
                    color: '#cfc5b3',
                    wordWrap: { width: cardWidth - 60, useAdvancedWrap: true }
                }
            ).setDepth(22).setScrollFactor(0);
            this.containerElements.push(descText);

            // D. 注册悬浮微拉伸特效与点击消费升级
            hitZone.on('pointerover', () => {
                cardBg.clear();
                cardBg.lineStyle(3.5, 0xffffff, 1.0); // 变白高亮
                cardBg.strokeRect(cx - cardWidth / 2, cy - cardHeight / 2, cardWidth, cardHeight);
                cardBg.fillStyle(0x3a0a0a, 0.98); // 略微加红
                cardBg.fillRect(cx - cardWidth / 2 + 2, cy - cardHeight / 2 + 2, cardWidth - 4, cardHeight - 4);
                
                titleText.setScale(1.05);
            });

            hitZone.on('pointerout', () => {
                cardBg.clear();
                cardBg.lineStyle(2, 0xe5a93c, 0.8);
                cardBg.strokeRect(cx - cardWidth / 2, cy - cardHeight / 2, cardWidth, cardHeight);
                cardBg.fillStyle(0x1a0a0a, 0.95);
                cardBg.fillRect(cx - cardWidth / 2 + 2, cy - cardHeight / 2 + 2, cardWidth - 4, cardHeight - 4);
                
                titleText.setScale(1.0);
            });

            hitZone.on('pointerdown', () => {
                this.executeUpgrade(opt.key);
            });
        });
    }

    /**
     * 生成 3 个不重复的技能加点选项
     * 如果所有可用技能都满了，提供血瓶回满或奖励巨额金币的兜底选项
     */
    generateUpgradeOptions() {
        const pool = [];
        const run = GameState.run;

        // 1. 提取四大技能
        const keys = ['talisman', 'fireball', 'shield', 'magnet'];

        keys.forEach(key => {
            const currentLvl = run.skills[key] || 0;
            const nextLvl = currentLvl + 1;
            
            // 如果还未满 4 级，有资格升级
            if (nextLvl <= 4) {
                let title = '';
                let color = '#fff';

                switch (key) {
                    case 'talisman':
                        title = currentLvl === 0 ? '✨ 圣符飞矢 [解锁]' : `✨ 圣符飞矢 [Lv.${nextLvl}]`;
                        color = '#00ffff';
                        break;
                    case 'fireball':
                        title = currentLvl === 0 ? '🔥 玄火爆裂 [解锁]' : `🔥 玄火爆裂 [Lv.${nextLvl}]`;
                        color = '#ff4d4d';
                        break;
                    case 'shield':
                        title = currentLvl === 0 ? '☀️ 圣光力场 [解锁]' : `☀️ 圣光力场 [Lv.${nextLvl}]`;
                        color = '#e5a93c';
                        break;
                    case 'magnet':
                        title = currentLvl === 0 ? '🧲 引力磁铁 [解锁]' : `🧲 引力磁铁 [Lv.${nextLvl}]`;
                        color = '#a98cff';
                        break;
                }

                pool.push({
                    key: key,
                    title: title,
                    desc: SkillConfig[key].levels[nextLvl].desc,
                    color: color
                });
            }
        });

        // 2. 兜底判定：如果技能全部升满，或者可用数不够 3 项，填充金币奖励和血药回复
        if (pool.length < 3) {
            pool.push({
                key: 'heal_max',
                title: '❤️ 圣愈洗礼 [瞬息回血]',
                desc: '瞬间洗涤圣体，立刻回复 50% 最大生命值。',
                color: '#44ff44'
            });
        }
        if (pool.length < 3) {
            pool.push({
                key: 'gold_bonus',
                title: '💰 黄金馈赠 [意外之财]',
                desc: '大天使遗留的宝藏，立刻加持 150 枚局内金币。',
                color: '#ffd700'
            });
        }

        // 3. 洗牌打乱并仅截取前 3 项返回
        Phaser.Utils.Array.Shuffle(pool);
        return pool.slice(0, 3);
    }

    /**
     * 执行技能升级或奖励结算，并复苏物理世界
     * @param {string} key 升级选项 Key
     */
    executeUpgrade(key) {
        if (this.destroyed || this.scene?.isTransitioningOut) return;
        const run = GameState.run;
        if (!run) return;

        // 1. 应用加点
        if (key === 'heal_max') {
            this.scene.player.heal(50); // 恢复 50% HP
        } else if (key === 'gold_bonus') {
            run.goldEarned += 150;
        } else {
            // 普通技能加点
            run.skills[key] = (run.skills[key] || 0) + 1;
        }

        // 2. 一键清除所有升级菜单的 UI 精灵，释放内存
        this.containerElements.forEach(el => el.destroy());
        this.containerElements = [];
        this.isOpen = false;
        this.scene.isGameplayPaused = false;
        this.scene.inputSystem && (this.scene.inputSystem.enabled = true);

        // 3. 复苏物理世界，重新运转
        this.scene.physics.world.resume();
        SoundSynth.setMuted(false);
    }

    /**
     * 清理注册的监听器
     */
    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.isOpen = false;
        if (this.scene) {
            this.scene.isGameplayPaused = false;
            this.scene.inputSystem && (this.scene.inputSystem.enabled = true);
            SoundSynth.setMuted(false);
        }
        this.scene.events.off('player_levelup', this.show, this);
        this.containerElements.forEach(el => {
            if (el && el.active !== false && el.destroy) el.destroy();
        });
        this.containerElements = [];
    }
}

export default LevelUpMenu;
