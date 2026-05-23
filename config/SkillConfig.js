/**
 * SkillConfig.js - 局内主动与被动技能参数配置
 */
export const SkillConfig = {
    // 1. 圣符飞矢 (基础弹道技能，自动寻找最近敌人)
    talisman: {
        baseCooldown: 1500,
        baseDamage: 18,
        speed: 450,
        levels: {
            1: { count: 1, damageMult: 1.0, cooldownMult: 1.0, desc: '自动发射一枚净化符箭，寻找最近的魔物' },
            2: { count: 2, damageMult: 1.1, cooldownMult: 0.9, desc: '符箭数量增加至 2，冷却轻微缩短' },
            3: { count: 3, damageMult: 1.2, cooldownMult: 0.8, desc: '符箭数量增加至 3，伤害和速度提升' },
            4: { count: 4, damageMult: 1.4, cooldownMult: 0.7, desc: '符箭数量增加至 4，释放速度极快' }
        }
    },

    // 2. 玄火爆裂 (范围杀伤技能，在随机敌人脚下引发巨大火球爆炸)
    fireball: {
        baseCooldown: 3200,
        baseDamage: 40,
        baseRadius: 90,
        levels: {
            1: { active: true, damageMult: 1.0, radiusMult: 1.0, desc: '引燃地狱火球，在随机敌人脚下造成范围玄火爆炸' },
            2: { active: true, damageMult: 1.25, radiusMult: 1.15, desc: '火球体积增大，伤害增加 25%' },
            3: { active: true, damageMult: 1.5, radiusMult: 1.3, desc: '爆炸范围显著扩大，伤害大幅提升' },
            4: { active: true, damageMult: 1.8, radiusMult: 1.5, desc: '熔岩审判：火球引发双重重叠余震爆炸' }
        }
    },

    // 3. 圣光力场 (环绕被动技能，持续对贴身魔物造成灼烧并提供反弹)
    shield: {
        baseDamage: 15,
        baseRadius: 70,
        levels: {
            1: { active: true, damageMult: 1.0, radiusMult: 1.0, desc: '在周身凝聚旋转的金色驱魔屏障，伤害接触的怪物' },
            2: { active: true, damageMult: 1.2, radiusMult: 1.2, desc: '屏障范围扩大，伤害提升' },
            3: { active: true, damageMult: 1.4, radiusMult: 1.35, desc: '力场高速旋转，并略微降低怪物受击移速' },
            4: { active: true, damageMult: 1.7, radiusMult: 1.5, desc: '神圣金环：巨大力场几乎阻挡任何魔物贴身' }
        }
    },

    // 4. 奈非天磁铁 (被动磁力范围，吸附经验和金币)
    magnet: {
        levels: {
            1: { range: 120, desc: '魂力磁铁：拾取半径设定为 120 像素' },
            2: { range: 180, desc: '魂力磁铁：拾取半径增大至 180 像素' },
            3: { range: 260, desc: '魂力磁铁：拾取半径增大至 260 像素' },
            4: { range: 450, desc: '引力奇点：几乎能吸附全屏范围内的掉落晶体' }
        }
    }
};

export default SkillConfig;
