/**
 * GameState.js - 全局状态机
 * 强制切分 局外持久化状态 (MetaState) 与 局内临时运行时状态 (RunState)
 */
import { PlayerConfig } from '../config/PlayerConfig.js';
import { RolePresentationConfig } from '../config/RolePresentationConfig.js';

export const GameState = {
    // 1. 局外持久化状态 (账号级别，存档保存)
    meta: {
        selectedRole: 'nun', // 当前强制默认选中血焰修女样板
        gold: 0,                // 持有总金币
        highScore: 0,           // 历史最高得分
        // 局外天赋升级等级
        talents: {
            damage: 0,          // 力量觉醒 (每级攻击力 +10%)
            maxHp: 0,           // 圣体加持 (每级生命上限 +10)
            speed: 0            // 迅捷疾行 (每级移速 +5%)
        },
        // 局外装备库存 (预留两个初始装备以便直接测试)
        inventory: [
            { instanceId: 'inst_init_blade', id: 'devil_blade', level: 1 },
            { instanceId: 'inst_init_amulet', id: 'angel_rune', level: 1 }
        ],
        // 当前穿戴装备槽位 (对应 inventory 中的 instanceId)
        equipped: {
            WEAPON: 'inst_init_blade',
            AMULET: null,
            BOOTS: null,
            RING: null
        }
    },

    // 2. 局内临时运行时状态 (单局战斗，开局创建，死后销毁)
    run: null,
    sceneTransitionLock: null,

    beginSceneTransition(targetScene) {
        if (this.sceneTransitionLock) return false;
        this.sceneTransitionLock = targetScene || '__unknown__';
        return true;
    },

    endSceneTransition(targetScene = null) {
        if (!targetScene || this.sceneTransitionLock === targetScene) {
            this.sceneTransitionLock = null;
        }
    },

    /**
     * 初始化/重置单局内运行时数据
     */
    startRun() {
        // 基于 基础玩家属性 + 局外天赋属性加成 计算开局初始值
        const dmgBonus = 1.0 + (this.meta.talents.damage * 0.10);
        const hpBonus = this.meta.talents.maxHp * 10;
        const spdBonus = 1.0 + (this.meta.talents.speed * 0.05);

        // 叠加装备基础属性
        let eqMaxHp = 0;
        let eqDamageMultiplier = 0;
        let eqSpeedMultiplier = 0;

        if (window.EquipmentService) {
            const eqStats = window.EquipmentService.getEquippedStats();
            eqMaxHp = eqStats.maxHp;
            eqDamageMultiplier = eqStats.damageMultiplier;
            eqSpeedMultiplier = eqStats.speedMultiplier;
        }

        // 加载选定角色的基础属性
        const roleId = this.meta.selectedRole || 'nun';
        const roleCfg = RolePresentationConfig.roles[roleId] || RolePresentationConfig.roles.nun;

        const baseHp = roleCfg.baseHpMax || PlayerConfig.baseMaxHp;
        const baseSpeed = roleCfg.baseSpeed || PlayerConfig.baseSpeed;
        const baseDmgMult = roleCfg.damageMultiplier || 1.0;

        const totalMaxHp = baseHp + hpBonus + eqMaxHp;

        this.run = {
            roleId: roleId,
            hpMax: totalMaxHp,
            hp: totalMaxHp,
            speed: baseSpeed * (spdBonus + eqSpeedMultiplier),
            damageMultiplier: baseDmgMult * (dmgBonus + eqDamageMultiplier),

            level: 1,
            xp: 0,
            xpNeeded: PlayerConfig.xpFormula.baseXp,

            // 局内战绩
            score: 0,
            kills: 0,
            goldEarned: 0,
            startTime: Date.now(),
            elapsedTime: 0,     // 秒级计时
            mapIndex: Math.floor(Math.random() * 8),

            // 本局掉落获得的待结算装备 ID 列表 (例如 ['goth_ring'])
            equipmentDrops: [],

            // 加载角色特定的局内初始技能等级
            skills: JSON.parse(JSON.stringify(roleCfg.skills)),

            // 临时状态
            isDashing: false,
            isInvincible: false,
            isGameOver: false,
            reviveUsed: 0
        };
    },

    /**
     * 局内单局结束，把战利品结算保存进局外 MetaState，销毁 Run 临时状态
     * @param {boolean} victory 是否通关
     */
    endRun(victory = false) {
        if (!this.run) return;

        // 1. 金币结算累加到局外总金币
        this.meta.gold += this.run.goldEarned;

        // 2. 最高分判定
        if (this.run.score > this.meta.highScore) {
            this.meta.highScore = this.run.score;
        }

        // 3. 结算掉落的装备，真正存入 meta.inventory
        const lootedGear = [];
        if (this.run.equipmentDrops && this.run.equipmentDrops.length > 0) {
            this.run.equipmentDrops.forEach(itemId => {
                if (window.EquipmentService) {
                    const inst = window.EquipmentService.addEquipmentToInventory(itemId);
                    if (inst) {
                        lootedGear.push(inst);
                    }
                }
            });
        }

        // 4. 数据持久化
        this.saveMeta();

        // 5. 清除临时局内状态，并保留收获明细供 ResultScene 展示
        const runSummary = {
            ...this.run,
            victory,
            lootedGear
        };
        this.run = null;

        return runSummary;
    },

    /**
     * 局外购买/升级天赋
     * @param {string} talentId 天赋ID ('damage' | 'maxHp' | 'speed')
     * @param {number} cost 升级所需的金币消耗
     */
    upgradeTalent(talentId, cost) {
        if (this.meta.gold >= cost && this.meta.talents[talentId] !== undefined) {
            this.meta.gold -= cost;
            this.meta.talents[talentId]++;
            this.saveMeta();
            return true;
        }
        return false;
    },

    /**
     * 保存 Meta 数据到本地存档服务
     */
    saveMeta() {
        if (window.SaveService) {
            window.SaveService.save(this.meta);
        } else {
            localStorage.setItem('cyber_exorcist_meta', JSON.stringify(this.meta));
        }
    },

    /**
     * 从本地存储/平台云端加载 Meta 数据
     */
    loadMeta() {
        let loaded = null;
        if (window.SaveService) {
            loaded = window.SaveService.load();
        } else {
            const raw = localStorage.getItem('cyber_exorcist_meta');
            if (raw) {
                try { loaded = JSON.parse(raw); } catch(e) {}
            }
        }

        if (loaded) {
            // 合并加载的数据，确保老存档向后兼容新字段
            this.meta = {
                ...this.meta,
                ...loaded,
                talents: {
                    ...this.meta.talents,
                    ...(loaded.talents || {})
                },
                equipped: {
                    ...this.meta.equipped,
                    ...(loaded.equipped || {})
                },
                inventory: loaded.inventory || this.meta.inventory || []
            };
        }

        // 当前调试阶段锁定默认样板为远程血焰修女，避免旧存档把流程拉回驱魔骑士。
        if (!RolePresentationConfig.roles[this.meta.selectedRole] || this.meta.selectedRole === 'exorcist') {
            this.meta.selectedRole = 'nun';
        }
    }
};

export default GameState;
