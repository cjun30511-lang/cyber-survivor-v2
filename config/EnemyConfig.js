/**
 * EnemyConfig.js - 魔物与 Boss 的初始战斗属性配置
 */
export const EnemyConfig = {
    // 1. 枯骨步兵 (近战小骷髅)
    skeleton: {
        texture: 'skeleton_walk',
        animPrefix: 'skeleton',
        maxHp: 22,
        speed: 75,
        damage: 10,
        xpReward: 15,
        scale: 0.46,
        hitboxWidth: 28,      // 精准物理碰撞包围盒，彻底杜绝空气碰撞
        hitboxHeight: 28,
        goldReward: 1
    },

    // 2. 幽蓝祭司 (幽灵法师 - 远程)
    ghost: {
        texture: 'ghost_float',
        animPrefix: 'ghost',
        isCaster: true,
        maxHp: 38,
        speed: 60,
        damage: 15,
        xpReward: 30,
        scale: 0.48,
        hitboxWidth: 32,      // 匹配浮空祭司纤细体态的有效碰撞盒
        hitboxHeight: 45,
        shootCooldown: 3000,
        bulletSpeed: 200,
        bulletDamage: 12,
        goldReward: 2
    },

    // 3. 铁壁重装 (重装魔物 - 坦克)
    tank: {
        texture: 'iron_tank_walk',
        animPrefix: 'iron_tank',
        isTank: true,
        maxHp: 80,
        speed: 45,
        damage: 25,
        xpReward: 60,
        scale: 0.84,
        hitboxWidth: 48,      // 进一步收物理足迹，避免压住主角活动空间
        hitboxHeight: 58,
        goldReward: 5
    },

    ghoul: {
        texture: 'ghoul_walk',
        animPrefix: 'ghoul',
        maxHp: 30,
        speed: 82,
        damage: 12,
        xpReward: 20,
        scale: 0.46,
        hitboxWidth: 30,
        hitboxHeight: 34,
        goldReward: 1
    },

    cultist: {
        texture: 'cultist_walk',
        animPrefix: 'cultist',
        maxHp: 46,
        speed: 68,
        damage: 16,
        xpReward: 34,
        scale: 0.47,
        hitboxWidth: 32,
        hitboxHeight: 42,
        goldReward: 2
    },

    imp: {
        texture: 'imp_walk',
        animPrefix: 'imp',
        maxHp: 24,
        speed: 115,
        damage: 13,
        xpReward: 24,
        scale: 0.36,
        hitboxWidth: 26,
        hitboxHeight: 28,
        goldReward: 2
    },

    wraith: {
        texture: 'wraith_walk',
        animPrefix: 'wraith',
        maxHp: 42,
        speed: 78,
        damage: 18,
        xpReward: 40,
        scale: 0.47,
        hitboxWidth: 30,
        hitboxHeight: 42,
        goldReward: 3
    },

    brute: {
        texture: 'brute_walk',
        animPrefix: 'brute',
        isTank: true,
        maxHp: 115,
        speed: 42,
        damage: 30,
        xpReward: 76,
        scale: 0.78,
        hitboxWidth: 52,
        hitboxHeight: 62,
        goldReward: 6
    },

    // Boss 组：每关从这些首领中选择
    boss: {
        texture: 'boss_demon_idle',
        animPrefix: 'boss_demon',
        isBoss: true,
        spriteTint: 0xff3333,
        ritualTint: 0xff1a1a,
        ritualAccent: 0x5b0f12,
        bulletTint: 0xff1a1a,
        maxHp: 1500,
        speed: 85,
        damage: 35,
        xpReward: 1000,
        scale: 1.24,
        hitboxWidth: 72,      // 继续压缩碰撞范围，使首领压迫感来自体态而不是空气墙
        hitboxHeight: 84,
        goldReward: 50,
        skillPattern: 'scatter',
        bulletScatterCooldown: 4000,
        circleNovaCooldown: 7000
    },

    boss_frost: {
        texture: 'boss_frost_idle',
        animPrefix: 'boss_frost',
        isBoss: true,
        spriteTint: null,
        ritualTint: 0x9bdcff,
        ritualAccent: 0x2f6f92,
        bulletTint: 0x9bdcff,
        maxHp: 1350,
        speed: 78,
        damage: 32,
        xpReward: 1000,
        scale: 1.18,
        hitboxWidth: 74,
        hitboxHeight: 86,
        goldReward: 50,
        skillPattern: 'frostRing',
        bulletScatterCooldown: 3600,
        circleNovaCooldown: 7200
    },

    boss_plague: {
        texture: 'boss_plague_idle',
        animPrefix: 'boss_plague',
        isBoss: true,
        spriteTint: null,
        ritualTint: 0x9fcb55,
        ritualAccent: 0x3d5f22,
        bulletTint: 0x9fcb55,
        maxHp: 1650,
        speed: 70,
        damage: 38,
        xpReward: 1000,
        scale: 1.20,
        hitboxWidth: 78,
        hitboxHeight: 88,
        goldReward: 55,
        skillPattern: 'plagueCloud',
        bulletScatterCooldown: 4300,
        circleNovaCooldown: 6500
    },

    boss_void: {
        texture: 'boss_void_idle',
        animPrefix: 'boss_void',
        isBoss: true,
        spriteTint: null,
        ritualTint: 0x8f68ff,
        ritualAccent: 0x32204f,
        bulletTint: 0x8f68ff,
        maxHp: 1800,
        speed: 66,
        damage: 42,
        xpReward: 1000,
        scale: 1.24,
        hitboxWidth: 80,
        hitboxHeight: 90,
        goldReward: 60,
        skillPattern: 'voidSpiral',
        bulletScatterCooldown: 3900,
        circleNovaCooldown: 6000
    },

    boss_furnace: {
        texture: 'boss_furnace_idle',
        animPrefix: 'boss_furnace',
        isBoss: true,
        spriteTint: null,
        ritualTint: 0xff7a1a,
        ritualAccent: 0x64210f,
        bulletTint: 0xff7a1a,
        maxHp: 1700,
        speed: 72,
        damage: 40,
        xpReward: 1000,
        scale: 1.20,
        hitboxWidth: 80,
        hitboxHeight: 90,
        goldReward: 58,
        skillPattern: 'furnaceLines',
        bulletScatterCooldown: 4200,
        circleNovaCooldown: 6400
    },

    boss_drowned: {
        texture: 'boss_drowned_idle',
        animPrefix: 'boss_drowned',
        isBoss: true,
        spriteTint: null,
        ritualTint: 0x46c6d7,
        ritualAccent: 0x174e5b,
        bulletTint: 0x46c6d7,
        maxHp: 1550,
        speed: 80,
        damage: 34,
        xpReward: 1000,
        scale: 1.17,
        hitboxWidth: 76,
        hitboxHeight: 88,
        goldReward: 54,
        skillPattern: 'drownedWave',
        bulletScatterCooldown: 3500,
        circleNovaCooldown: 7000
    },

    boss_blood: {
        texture: 'boss_blood_idle',
        animPrefix: 'boss_blood',
        isBoss: true,
        spriteTint: null,
        ritualTint: 0xd51e38,
        ritualAccent: 0x5e0d1c,
        bulletTint: 0xff3150,
        maxHp: 1750,
        speed: 76,
        damage: 44,
        xpReward: 1000,
        scale: 1.21,
        hitboxWidth: 80,
        hitboxHeight: 90,
        goldReward: 62,
        skillPattern: 'bloodCross',
        bulletScatterCooldown: 3800,
        circleNovaCooldown: 6200
    },

    boss_bone: {
        texture: 'boss_bone_idle',
        animPrefix: 'boss_bone',
        isBoss: true,
        spriteTint: null,
        ritualTint: 0xd7c79a,
        ritualAccent: 0x6a5a38,
        bulletTint: 0xe6d6ad,
        maxHp: 1900,
        speed: 62,
        damage: 46,
        xpReward: 1000,
        scale: 1.23,
        hitboxWidth: 82,
        hitboxHeight: 92,
        goldReward: 65,
        skillPattern: 'boneBarrage',
        bulletScatterCooldown: 4600,
        circleNovaCooldown: 5800
    }
};

export default EnemyConfig;
