/**
 * LootSystem.js - 独立掉落与拾取成长控制系统
 * 驱动经验晶体、金币袋、回复药水的物理吸附，并管理局内 XP 升级经验线
 */
import { LootConfig } from '../config/LootConfig.js';
import { SkillConfig } from '../config/SkillConfig.js';
import { PlayerConfig } from '../config/PlayerConfig.js';
import { GameState } from '../state/GameState.js';
import { SoundSynth } from '../utils/SoundSynth.js';

export class LootSystem {
    /**
     * @param {Phaser.Scene} scene 场景
     */
    constructor(scene) {
        this.scene = scene;
        this.destroyed = false;

        // 1. 初始化掉落物物理组
        this.lootsGroup = scene.physics.add.group();
        scene.lootsGroup = this.lootsGroup; // 共享引用

        // 2. 注册监听怪物死亡派发的掉落请求
        scene.events.on('spawn_loot', this.onSpawnLoot, this);

        // 3. 配置物理重叠拾取碰撞
        scene.physics.add.overlap(
            scene.player,
            this.lootsGroup,
            this.collectLoot,
            null,
            this
        );
    }

    /**
     * 响应怪物死亡事件，根据其 LootTable 掉落物品
     */
    onSpawnLoot(data) {
        if (this.destroyed || !this.scene || !this.scene.physics || !this.scene.sys?.isActive() || this.scene.isTransitioningOut) return;
        const { x, y, enemyKey } = data;
        const lootTable = LootConfig.enemyLootTables[enemyKey];
        if (!lootTable) return;

        // 轮询随机概率，可能有多个物品掉落 (比如 Boss 掉落金币+血瓶)
        lootTable.forEach(entry => {
            if (Math.random() < entry.chance) {
                this.createLootItem(x, y, entry.type, entry.value);
            }
        });
    }

    /**
     * 在指定坐标生成掉落物实体
     */
    createLootItem(x, y, type, value) {
        if (this.destroyed || !this.scene || !this.scene.physics || !this.scene.physics.add || !this.scene.sys?.isActive() || this.scene.isTransitioningOut) return null;
        if (!this.lootsGroup || !this.lootsGroup.active || !this.lootsGroup.children || typeof this.lootsGroup.add !== 'function') return null;
        const typeCfg = LootConfig.types[type];
        if (!typeCfg) return null;

        // 根据类型映射高精度 Canvas 动态纹理
        let tex = 'casterBullet';
        if (type === 'xp_gem') tex = 'xpOrb';
        else if (type === 'gold_bag') tex = 'coin';
        else if (type === 'potion') tex = 'fireball';
        else if (type === 'equipment') tex = 'talisman';

        // 创建物理 Sprite 并提深至 7 保证在怪堆上显现
        let loot = null;
        try {
            loot = this.scene.physics.add.sprite(x, y, tex);
        } catch {
            return null;
        }
        if (!loot || !loot.active) return null;
        loot.setDepth(7);
        
        // 绑定数据属性
        loot.lootType = type;
        
        // 如果是装备，则在生成时随机决定装备库中具体的配置ID
        if (type === 'equipment') {
            if (window.EquipmentService) {
                loot.lootValue = window.EquipmentService.rollEquipmentDrop();
            } else {
                loot.lootValue = 'goth_ring';
            }
            loot.setTint(0xe5a93c); // 暗金传说高光
            loot.setScale(1.2);

            // 动态绘制 Diablo 金色冲天圣光大光柱
            const beam = this.scene.add.graphics();
            beam.setDepth(6); // 略低于掉落物本体但浮于地表
            loot.lootBeam = beam;

            loot.on('destroy', () => {
                if (beam && beam.active) {
                    beam.destroy();
                }
            });

            // 发送埋点
            if (window.PlatformAdapter) {
                window.PlatformAdapter.trackEvent('equipment_drop', { itemId: loot.lootValue });
            }
        } else {
            loot.lootValue = value;
            loot.setTint(typeCfg.color);
            loot.setScale(typeCfg.scale || 1.0); // 使用高精缩放
        }
        
        loot.baseScale = loot.scaleX;
        loot.isAttracted = false; // 是否已进入吸附力场

        // 随机轻微爆散物理位移，产生掉落喷溅感
        const spawnAngle = Math.random() * Math.PI * 2;
        const spawnForce = Phaser.Math.Between(50, 110);
        loot.setVelocity(Math.cos(spawnAngle) * spawnForce, Math.sin(spawnAngle) * spawnForce);
        loot.setDrag(150); // 很快在地上摩擦减速静止

        try {
            if (!this.destroyed && this.lootsGroup && this.lootsGroup.active && this.lootsGroup.children) {
                this.lootsGroup.add(loot);
            } else {
                loot.destroy();
                return null;
            }
        } catch {
            try { loot.destroy(); } catch {}
            return null;
        }
        return loot;
    }

    /**
     * 掉落物理磁力更新心跳
     * @param {number} time 当前时间
     * @param {Player} player 玩家实例
     */
    update(time, player) {
        if (!GameState.run || GameState.run.isGameOver || !player || !player.active) return;

        // 1. 获取玩家磁铁等级，计算吸附半径
        const magLvl = GameState.run.skills.magnet || 1;
        const magnetRange = SkillConfig.magnet.levels[magLvl]?.range || LootConfig.baseMagnetRange;

        // 2. 遍历掉落物，计算距离吸附
        this.lootsGroup.getChildren().forEach(loot => {
            if (!loot.active) return;

            // 2.1 如果是装备类型，动态描绘冲天渐变发光柱 (Diablo Style)
            if (loot.lootBeam && loot.lootBeam.active) {
                const g = loot.lootBeam;
                g.clear();
                if (loot.visible) {
                    const pulse = Math.sin(time * 0.005) * 0.15 + 0.85;
                    const alpha = Math.sin(time * 0.003) * 0.1 + 0.7;
                    const bx = loot.x;
                    const by = loot.y;
                    const bHeight = 160;

                    // Layer 1: 橙金色外侧光带
                    g.fillStyle(0xe5a93c, 0.25 * alpha);
                    g.beginPath();
                    g.moveTo(bx - 12 * pulse, by);
                    g.lineTo(bx - 6 * pulse, by - bHeight);
                    g.lineTo(bx + 6 * pulse, by - bHeight);
                    g.lineTo(bx + 12 * pulse, by);
                    g.closePath();
                    g.fillPath();

                    // Layer 2: 极白炽热内侧光芯
                    g.fillStyle(0xffffff, 0.65 * alpha);
                    g.beginPath();
                    g.moveTo(bx - 4 * pulse, by);
                    g.lineTo(bx - 2 * pulse, by - bHeight);
                    g.lineTo(bx + 2 * pulse, by - bHeight);
                    g.lineTo(bx + 4 * pulse, by);
                    g.closePath();
                    g.fillPath();

                    // Layer 3: 脚底金色光晕
                    g.fillStyle(0xe5a93c, 0.35 * alpha);
                    g.fillEllipse(bx, by, 22 * pulse, 6 * pulse);

                    // Layer 4: 4个旋转的金色矢量指示刻度弧 (Sleek vector chest base arcs)
                    g.lineStyle(1.5, 0xe5a93c, 0.45 * alpha);
                    const rotAngle = time * 0.0015;
                    const radius = 24 * pulse;
                    for (let i = 0; i < 4; i++) {
                        const startArc = rotAngle + i * Math.PI / 2 - 0.25;
                        const endArc = rotAngle + i * Math.PI / 2 + 0.25;
                        g.beginPath();
                        g.arc(bx, by, radius, startArc, endArc);
                        g.strokePath();
                    }
                }
            }

            const dx = player.x - loot.x;
            const dy = player.y - loot.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // 判定是否进入磁吸范围
            if (dist < magnetRange || loot.isAttracted) {
                loot.isAttracted = true; // 一旦吸上，不死不休
                
                // 还原物理渲染锚点和基本比例
                loot.setDisplayOrigin(loot.width / 2, loot.height / 2);
                loot.setScale(loot.baseScale || 1.0);

                // 物理加速平滑飞向玩家 (距离越近，飞得越快，产生极佳的“嗖”声手感)
                const angle = Phaser.Math.Angle.Between(loot.x, loot.y, player.x, player.y);
                const currentSpeed = LootConfig.magnetSpeed + (50000 / (dist + 50)); // 距离越近，引力奇点加速度越大
                
                loot.setVelocity(Math.cos(angle) * currentSpeed, Math.sin(angle) * currentSpeed);
                loot.setDrag(0); // 撤销地面拖拽力
            } else {
                // 地面静止或爆散漂移时，应用轻量级形变浮空动效 (S&S Pulse & Bobbing)
                const uniqueSeed = (loot.x * 0.05 + loot.y * 0.05);
                const bobOffset = Math.sin(time * 0.005 + uniqueSeed) * 4;
                loot.setDisplayOrigin(loot.width / 2, loot.height / 2 + bobOffset);

                const scalePulse = Math.sin(time * 0.007 + uniqueSeed) * 0.08 + 1.0;
                loot.setScale((loot.baseScale || 1.0) * scalePulse);
            }
        });
    }

    /**
     * 玩家吃掉掉落物结算
     */
    collectLoot(player, loot) {
        if (this.destroyed || !this.scene || !this.scene.sys?.isActive()) return;
        if (!loot.active || !GameState.run) return;

        const type = loot.lootType;
        const val = loot.lootValue;

        // 1. 发声
        SoundSynth.play('coin');

        // 2. 根据掉落物品种类，执行单局运行时数据增加
        let label = '';
        let color = '#ffffff';

        switch (type) {
            case 'xp_gem':
                GameState.run.xp += val;
                label = `+${val} XP`;
                color = '#00ffff';
                this.checkLevelUp(); // 判定升级
                break;
                
            case 'gold_bag':
                GameState.run.goldEarned += val;
                label = `+${val} 金币`;
                color = '#e5a93c';
                break;
                
            case 'potion':
                // 回复血瓶 % 最大生命
                player.heal(val); // 比如 val = 20 代表恢复最大生命值的 20%
                label = `+${val}% 圣体回复`;
                color = '#ff1a1a';
                break;

            case 'equipment':
                const eqId = val || 'goth_ring';
                if (!GameState.run.equipmentDrops) {
                    GameState.run.equipmentDrops = [];
                }
                GameState.run.equipmentDrops.push(eqId);

                let eqName = '神兵装备';
                if (window.EquipmentConfig && window.EquipmentConfig.items[eqId]) {
                    eqName = window.EquipmentConfig.items[eqId].name;
                }
                label = `💍 拾获 [${eqName}]`;
                color = '#e5a93c'; // 传奇暗金

                if (window.PlatformAdapter) {
                    window.PlatformAdapter.trackEvent('loot_pickup', { itemId: eqId });
                }
                break;
        }

        // 3. 在吃到的位置产生数字浮空飘字
        if (this.scene.dmgTextPool) {
            this.scene.dmgTextPool.showText(loot.x, loot.y - 10, label, color, 14, false);
        }

        // 3.5 拾取微粒爆裂 (附带对应掉落物色系火尘飞溅)
        if (this.scene.fireParticles) {
            const sparkleColor = type === 'equipment' ? 0xe5a93c : (type === 'xp_gem' ? 0x00ffff : (type === 'gold_bag' ? 0xffd700 : 0xff1a1a));
            this.scene.fireParticles.emitParticleAt(player.x, player.y, type === 'equipment' ? 14 : 6, sparkleColor);
        }

        // 4. 回收物理实体
        loot.destroy();
    }

    /**
     * 局内玩家经验升级判定曲线
     */
    checkLevelUp() {
        if (this.destroyed || !this.scene || !this.scene.sys?.isActive()) return;
        if (!GameState.run) return;

        let run = GameState.run;
        while (run.xp >= run.xpNeeded) {
            run.xp -= run.xpNeeded;
            run.level++;
            
            // 下一级经验升级基数乘以 1.35 指数递增
            run.xpNeeded = Math.floor(run.xpNeeded * PlayerConfig.xpFormula.multiplier);

            // 升级金币加成奖励 (金币 +20)
            run.goldEarned += 10;

            // 派发全局升级事件，BattleScene 接收后会呼叫 LevelUpMenu
            this.scene.events.emit('player_levelup');
        }
    }

    /**
     * 销毁清理事件绑定，防内存泄露
     */
    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.scene?.events?.off('spawn_loot', this.onSpawnLoot, this);
        try {
            if (this.scene && this.scene.lootsGroup === this.lootsGroup) {
                this.scene.lootsGroup = null;
            }
        } catch {}
        try {
            const entries = this.lootsGroup?.children?.entries;
            if (Array.isArray(entries)) {
                [...entries].forEach(loot => loot?.destroy?.());
            }
        } catch {}
        try {
            this.lootsGroup?.destroy?.();
        } catch {}
        this.lootsGroup = null;
        this.scene = null;
    }
}

export default LootSystem;
