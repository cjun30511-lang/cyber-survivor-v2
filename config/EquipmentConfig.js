/**
 * EquipmentConfig.js - 局外持久化装备属性及升级消耗配置
 */
export const EquipmentConfig = {
    // 局外装备槽位原型定义
    slots: {
        WEAPON: '武器',
        AMULET: '护身符',
        BOOTS: '战靴',
        RING: '指环'
    },

    // 装备库详细数据
    items: {
        angel_rune: {
            id: 'angel_rune',
            name: '大天使符石',
            slot: 'AMULET',
            desc: '灌注大天使圣光的护身石，提升初始生命上限。',
            baseMaxHp: 20,            // 生命上限加成 (+20)
            levelUpHp: 10,            // 每级提升生命 (+10)
            goldCostBase: 50,         // 初始升级消耗金币
            goldCostMult: 1.5         // 升级消耗递增倍数
        },
        devil_blade: {
            id: 'devil_blade',
            name: '恶魔刺骨刃',
            slot: 'WEAPON',
            desc: '带有深渊咒怨的刺刃，加持初始物理伤害。',
            baseDamageMultiplier: 0.15, // 伤害增益 (+15%)
            levelUpDamage: 0.05,       // 每级提升伤害 (+5%)
            goldCostBase: 60,
            goldCostMult: 1.6
        },
        shadow_boots: {
            id: 'shadow_boots',
            name: '影流风暴靴',
            slot: 'BOOTS',
            desc: '散发幽蓝影雾的轻软战靴，额外增幅移速。',
            baseSpeedMultiplier: 0.08,  // 移速增益 (+8%)
            levelUpSpeed: 0.03,        // 每级提升移速 (+3%)
            goldCostBase: 40,
            goldCostMult: 1.4
        },
        goth_ring: {
            id: 'goth_ring',
            name: '古墓黯金戒',
            slot: 'RING',
            desc: '散发古墓幽光的黄铜戒，加持初始生命与攻击伤害。',
            baseMaxHp: 10,              // 生命上限加成 (+10)
            baseDamageMultiplier: 0.05, // 伤害增益 (+5%)
            levelUpHp: 5,               // 每级提升生命 (+5)
            levelUpDamage: 0.02,        // 每级提升伤害 (+2%)
            goldCostBase: 50,
            goldCostMult: 1.5
        }
    }
};

// 挂载到 window 以便在非 ES6 单页运行中供 LootSystem 等访问
window.EquipmentConfig = EquipmentConfig;

export default EquipmentConfig;
