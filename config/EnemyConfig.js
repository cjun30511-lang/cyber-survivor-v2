/**
 * EnemyConfig.js - 魔物与 Boss 的初始战斗属性配置
 */
export const EnemyConfig = {
    // 1. 枯骨步兵 (近战小骷髅)
    skeleton: {
        texture: 'skeleton_bug',
        maxHp: 22,
        speed: 75,
        damage: 10,
        xpReward: 15,
        scale: 0.19,
        hitboxWidth: 28,      // 精准物理碰撞包围盒，彻底杜绝空气碰撞
        hitboxHeight: 28,
        goldReward: 1
    },

    // 2. 幽蓝祭司 (幽灵法师 - 远程)
    ghost: {
        texture: 'ghost_caster',
        maxHp: 38,
        speed: 60,
        damage: 15,
        xpReward: 30,
        scale: 0.21,
        hitboxWidth: 32,      // 匹配浮空祭司纤细体态的有效碰撞盒
        hitboxHeight: 45,
        shootCooldown: 3000,
        bulletSpeed: 200,
        bulletDamage: 12,
        goldReward: 2
    },

    // 3. 铁壁重装 (重装魔物 - 坦克)
    tank: {
        texture: 'iron_tank',
        maxHp: 80,
        speed: 45,
        damage: 25,
        xpReward: 60,
        scale: 0.225,
        hitboxWidth: 48,      // 进一步收物理足迹，避免压住主角活动空间
        hitboxHeight: 58,
        goldReward: 5
    },

    // 4. 数字巨灵 (终极 Boss V2)
    boss: {
        texture: 'boss',
        maxHp: 1500,
        speed: 85,
        damage: 35,
        xpReward: 1000,
        scale: 0.145,
        hitboxWidth: 72,      // 继续压缩碰撞范围，使首领压迫感来自体态而不是空气墙
        hitboxHeight: 84,
        goldReward: 50,
        bulletScatterCooldown: 4000,
        circleNovaCooldown: 7000
    }
};

export default EnemyConfig;
