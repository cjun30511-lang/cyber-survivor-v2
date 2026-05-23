/**
 * RolePresentationConfig.js - 4个角色的战斗身份、属性配置与表现常数
 */
export const RolePresentationConfig = {
    roles: {
        exorcist: {
            id: 'exorcist',
            name: '驱魔骑士',
            title: '† 圣光烈焰·驱魔骑士 †',
            desc: '手持神圣耀斑重剑的圣殿骑士。\n贴脸金光大范围圣光斩/旋风斩。\n近身缠斗固若金汤，站场稳重厚实。',
            themeColor: 0xe5a93c,
            textColor: '#e5a93c',
            tint: 0xe5a93c,
            projectileTexture: 'slash_gold', // 黄金圣光斩
            projectileScale: 1.5,
            
            // 初始技能等级
            skills: {
                talisman: 1, // 圣光近战斩
                fireball: 0,
                shield: 1,   // 周身自旋力场
                magnet: 1
            },
            
            // 基础属性调整
            baseHpMax: 150,       // 极厚生命
            baseSpeed: 160,       // 速度偏慢
            damageMultiplier: 1.25 // 较高的斩击系数
        },
        nun: {
            id: 'nun',
            name: '圣裁修女',
            title: '✠ 银白圣裁·骨白修会 ✠',
            desc: '身披银白与骨白层叠修会长袍的惩戒修女。\n主输出为从圣杖射出的连续圣焰法球。\n中远距离定点击杀，强调冷冽圣性轮廓与审判爆裂感。',
            themeColor: 0xf0e7d7,
            textColor: '#fbf6ee',
            tint: 0xf1eadc,
            projectileTexture: 'nun_fireball',
            projectileScale: 1.0,
            
            skills: {
                talisman: 1,
                fireball: 0,
                shield: 0,
                magnet: 1
            },
            
            baseHpMax: 90,
            baseSpeed: 220,
            damageMultiplier: 1.55 // 恐怖爆发
        },
        necromancer: {
            id: 'necromancer',
            name: '死灵学徒',
            title: '☠ 幽邃之火·死灵术士 ☠',
            desc: '役使蓝绿怨魂与诅咒亡灵的禁忌学者。\n主输出诅咒导弹，自动追踪与持续咬杀。\n魂力磁铁天生极大，吞噬全场经验！',
            themeColor: 0x00ffff,
            textColor: '#00ffff',
            tint: 0x00ffff,
            projectileTexture: 'ghost_teal', // 幽蓝追魂弹
            projectileScale: 1.15,
            
            skills: {
                talisman: 1,
                fireball: 0,
                shield: 0,
                magnet: 2 // 磁铁天生 2 级
            },
            
            baseHpMax: 80,
            baseSpeed: 170,
            damageMultiplier: 1.1
        },
        hunter: {
            id: 'hunter',
            name: '影刃猎手',
            title: '⚡ 疾风暗影·影刃猎手 ⚡',
            desc: '穿行于寒色残影中的高机动冷血刺客。\n主输出穿透影刃，高爆高速收割魔物。\n极致移速配合高速影袭，脆快灵活！',
            themeColor: 0x9d00ff,
            textColor: '#9d00ff',
            tint: 0x9d00ff,
            projectileTexture: 'shadow_dagger', // 紫色影穿刃
            projectileScale: 1.0,
            
            skills: {
                talisman: 1,
                fireball: 0,
                shield: 0,
                magnet: 1
            },
            
            baseHpMax: 100,
            baseSpeed: 230, // 飞一般的感觉
            damageMultiplier: 1.15
        }
    },
    
    // 默认角色
    defaultRole: 'nun'
};

export default RolePresentationConfig;
