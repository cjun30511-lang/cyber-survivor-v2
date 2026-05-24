/**
 * WaveConfig.js - 怪物波次生成节奏与时间阶段配置
 */
export const WaveConfig = {
    // 基础刷怪间隔 (ms)
    spawnInterval: 1200,

    // 刷怪上限，根据同屏实体数防卡顿性能控制
    maxEnemiesOnScreen: 80,

    // 各时间节点对应的怪物刷新权重配置 (时间单位：秒)
    stages: [
        {
            start: 0,
            end: 15,
            desc: '第一波：骷髅夜行',
            weights: { skeleton: 0.75, ghoul: 0.25 },
            spawnCount: 2 // 每次生成小兵个数
        },
        {
            start: 15,
            end: 30,
            desc: '第二波：幽蓝祭司出现',
            weights: { skeleton: 0.35, ghoul: 0.25, ghost: 0.20, cultist: 0.20 },
            spawnCount: 3
        },
        {
            start: 30,
            end: 45,
            desc: '第三波：铁壁重装夹击',
            weights: { skeleton: 0.22, ghoul: 0.18, ghost: 0.18, cultist: 0.16, imp: 0.16, tank: 0.10 },
            spawnCount: 3
        },
        {
            start: 45,
            end: 60,
            desc: '第四波：魔化狂潮',
            weights: { skeleton: 0.12, ghoul: 0.14, ghost: 0.16, cultist: 0.14, imp: 0.18, wraith: 0.14, tank: 0.07, brute: 0.05 },
            spawnCount: 4
        }
    ],

    // 终极 Boss 剧情刷新时间 (秒)
    bossSpawnTime: 60,
    bossName: '核心·数字巨灵',
    bossPool: ['boss', 'boss_frost', 'boss_plague', 'boss_void']
};

export default WaveConfig;
