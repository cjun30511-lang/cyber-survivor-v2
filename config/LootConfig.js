/**
 * LootConfig.js - 局内怪物死亡掉落物配置
 */
export const LootConfig = {
    // 掉落物理参数
    pickupDistance: 25,         // 判定被玩家吃到的像素距离
    baseMagnetRange: 120,       // 磁铁开始吸附的最小距离
    magnetSpeed: 380,           // 掉落物飞向玩家的初始物理速度

    // 掉落物品类型及其属性配置
    types: {
        xp_gem: {
            name: '经验晶体',
            texture: 'xpOrb',
            color: 0x00ffff,        // 幽蓝光效
            baseValue: 10,
            scale: 0.12
        },
        gold_bag: {
            name: '金币袋',
            texture: 'goldCoin',
            color: 0xffd700,        // 金色流光
            baseValue: 5,
            scale: 0.15
        },
        potion: {
            name: '生命药水',
            texture: 'potion',
            color: 0xff0055,        // 血红光效
            baseValue: 20,          // 回复 20% 最大生命值
            scale: 0.14
        },
        equipment: {
            name: '神兵装备',
            texture: 'casterBullet',
            color: 0xe5a93c,        // 传奇金光
            baseValue: 1,
            scale: 0.25
        }
    },

    // 不同敌人种类的掉落概率表
    enemyLootTables: {
        skeleton: [
            { type: 'xp_gem', chance: 0.85, value: 10 },
            { type: 'gold_bag', chance: 0.12, value: 1 },
            { type: 'potion', chance: 0.03, value: 15 }
        ],
        ghost: [
            { type: 'xp_gem', chance: 0.70, value: 20 },
            { type: 'gold_bag', chance: 0.25, value: 2 },
            { type: 'potion', chance: 0.05, value: 20 },
            { type: 'equipment', chance: 0.05, value: 1 }
        ],
        tank: [
            { type: 'xp_gem', chance: 0.50, value: 50 },
            { type: 'gold_bag', chance: 0.40, value: 5 },
            { type: 'potion', chance: 0.10, value: 30 },
            { type: 'equipment', chance: 0.15, value: 1 }
        ],
        boss: [
            { type: 'xp_gem', chance: 0.00, value: 0 }, // Boss 不掉小经验
            { type: 'gold_bag', chance: 1.00, value: 50 }, // 100% 掉落大金币
            { type: 'potion', chance: 1.00, value: 100 }, // 100% 掉落全满回复药水
            { type: 'equipment', chance: 1.00, value: 1 }  // 100% 掉落装备
        ]
    }
};

export default LootConfig;
