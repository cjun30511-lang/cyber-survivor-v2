/**
 * PlayerConfig.js - 玩家初始属性与运动参数配置
 */
export const PlayerConfig = {
    // 基础属性
    baseMaxHp: 100,
    baseSpeed: 180,
    baseScale: 0.45,
    hitboxWidth: 24,
    hitboxHeight: 48,

    // 闪避冲刺参数
    dash: {
        cooldown: 1000,          // 冲刺冷却时间 (ms)
        duration: 150,           // 冲刺持续时间 (ms)
        speedMultiplier: 3.5,    // 冲刺速度倍率
        invincibleDuration: 250   // 冲刺无敌帧时间 (ms)
    },

    // 局内升级经验升级曲线基数
    xpFormula: {
        baseXp: 100,             // 1级升2级所需经验
        multiplier: 1.35         // 每升一级所需经验递增倍率
    }
};

export default PlayerConfig;
