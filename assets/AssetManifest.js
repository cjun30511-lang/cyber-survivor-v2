/**
 * AssetManifest.js - 游戏高清手绘美术材质 Base64 资产清单
 * 采用 Base64 在线内嵌，彻底免除 file:// 协议本地运行时无法加载外部图片的 CORS 痛点
 */
export const AssetManifest = {
    // 玩家 5大状态真实序列帧 spritesheets (384x384 per frame)
    player_idle: '__PLAYER_IDLE_B64__',
    player_run: '__PLAYER_RUN_B64__',
    player_run_start: '__PLAYER_RUN_START_B64__',
    player_run_stop: '__PLAYER_RUN_STOP_B64__',
    player_cast_windup: '__PLAYER_CAST_WINDUP_B64__',
    player_cast_release: '__PLAYER_CAST_RELEASE_B64__',
    player_cast_recovery: '__PLAYER_CAST_RECOVERY_B64__',
    player_hit: '__PLAYER_HIT_B64__',
    player_death: '__PLAYER_DEATH_B64__',
    nun_portrait: '__NUN_PORTRAIT_B64__',

    // 枯骨步兵 (Skeleton Melee) walk/attack/hit/death (192x192 per frame)
    skeleton_walk: '__SKELETON_WALK_B64__',
    skeleton_attack: '__SKELETON_ATTACK_B64__',
    skeleton_hit: '__SKELETON_HIT_B64__',
    skeleton_death: '__SKELETON_DEATH_B64__',

    // 幽蓝祭司 (Ghost Caster) float/cast/death (192x192 per frame)
    ghost_float: '__GHOST_FLOAT_B64__',
    ghost_cast: '__GHOST_CAST_B64__',
    ghost_death: '__GHOST_DEATH_B64__',

    // 铁壁重装 (Iron Tank) walk/attack/hit/death (192x192 per frame)
    iron_tank_walk: '__IRON_TANK_WALK_B64__',
    iron_tank_attack: '__IRON_TANK_ATTACK_B64__',
    iron_tank_hit: '__IRON_TANK_HIT_B64__',
    iron_tank_death: '__IRON_TANK_DEATH_B64__',

    ghoul_walk: '__GHOUL_WALK_B64__',
    ghoul_attack: '__GHOUL_ATTACK_B64__',
    ghoul_hit: '__GHOUL_HIT_B64__',
    ghoul_death: '__GHOUL_DEATH_B64__',
    cultist_walk: '__CULTIST_WALK_B64__',
    cultist_attack: '__CULTIST_ATTACK_B64__',
    cultist_hit: '__CULTIST_HIT_B64__',
    cultist_death: '__CULTIST_DEATH_B64__',
    imp_walk: '__IMP_WALK_B64__',
    imp_attack: '__IMP_ATTACK_B64__',
    imp_hit: '__IMP_HIT_B64__',
    imp_death: '__IMP_DEATH_B64__',
    wraith_walk: '__WRAITH_WALK_B64__',
    wraith_attack: '__WRAITH_ATTACK_B64__',
    wraith_hit: '__WRAITH_HIT_B64__',
    wraith_death: '__WRAITH_DEATH_B64__',
    brute_walk: '__BRUTE_WALK_B64__',
    brute_attack: '__BRUTE_ATTACK_B64__',
    brute_hit: '__BRUTE_HIT_B64__',
    brute_death: '__BRUTE_DEATH_B64__',

    // 恶魔首领 (Boss Demon) idle/attack/hit/death (384x384 per frame)
    boss_demon_idle: '__BOSS_DEMON_IDLE_B64__',
    boss_demon_attack: '__BOSS_DEMON_ATTACK_B64__',
    boss_demon_hit: '__BOSS_DEMON_HIT_B64__',
    boss_demon_death: '__BOSS_DEMON_DEATH_B64__',
    boss_frost_idle: '__BOSS_FROST_IDLE_B64__',
    boss_frost_attack: '__BOSS_FROST_ATTACK_B64__',
    boss_frost_hit: '__BOSS_FROST_HIT_B64__',
    boss_frost_death: '__BOSS_FROST_DEATH_B64__',
    boss_plague_idle: '__BOSS_PLAGUE_IDLE_B64__',
    boss_plague_attack: '__BOSS_PLAGUE_ATTACK_B64__',
    boss_plague_hit: '__BOSS_PLAGUE_HIT_B64__',
    boss_plague_death: '__BOSS_PLAGUE_DEATH_B64__',
    boss_void_idle: '__BOSS_VOID_IDLE_B64__',
    boss_void_attack: '__BOSS_VOID_ATTACK_B64__',
    boss_void_hit: '__BOSS_VOID_HIT_B64__',
    boss_void_death: '__BOSS_VOID_DEATH_B64__',

    // 圣符飞矢 (Talisman) A/B/C/D 四版弹道与命中 (256x256 per frame)
    talisman_proj_a: '__TALISMAN_PROJ_A_B64__',
    talisman_proj_b: '__TALISMAN_PROJ_B_B64__',
    talisman_proj_c: '__TALISMAN_PROJ_C_B64__',
    talisman_proj_d: '__TALISMAN_PROJ_D_B64__',
    talisman_imp_a: '__TALISMAN_IMP_A_B64__',
    talisman_imp_b: '__TALISMAN_IMP_B_B64__',
    talisman_imp_c: '__TALISMAN_IMP_C_B64__',
    talisman_imp_d: '__TALISMAN_IMP_D_B64__',

    // 玄火爆裂 (Fireball) Lv1 - Lv4 升级图集 (384x384 per frame)
    fireball_unlock: '__FIREBALL_UNLOCK_B64__',
    fireball_lv2: '__FIREBALL_LV2_B64__',
    fireball_lv3: '__FIREBALL_LV3_B64__',
    fireball_lv4_ultimate: '__FIREBALL_LV4_ULT_B64__',

    // 圣光力场 (Shield) Lv1 - Lv4 升级图集 (384x384 per frame)
    shield_unlock_loop: '__SHIELD_UNLOCK_LOOP_B64__',
    shield_lv2_loop: '__SHIELD_LV2_LOOP_B64__',
    shield_lv3_loop: '__SHIELD_LV3_LOOP_B64__',
    shield_lv4_loop: '__SHIELD_LV4_LOOP_B64__',

    // 其他特效 (192x192 or 384x384 per frame)
    magnet_trail: '__MAGNET_TRAIL_B64__',
    level_up_burst: '__LEVEL_UP_BURST_B64__',

    // 地表平铺地砖 (冷却的赛博熔岩格)
    lava_tile: '__LAVA_TILE_B64__',

    // 地牢裂隙覆盖层
    ground_overlay: '__GROUND_OVERLAY_B64__',
    map_base_0: '__MAP_BASE_0_B64__',
    map_overlay_0: '__MAP_OVERLAY_0_B64__',
    map_base_1: '__MAP_BASE_1_B64__',
    map_overlay_1: '__MAP_OVERLAY_1_B64__',
    map_base_2: '__MAP_BASE_2_B64__',
    map_overlay_2: '__MAP_OVERLAY_2_B64__',
    map_base_3: '__MAP_BASE_3_B64__',
    map_overlay_3: '__MAP_OVERLAY_3_B64__',
    map_base_4: '__MAP_BASE_4_B64__',
    map_overlay_4: '__MAP_OVERLAY_4_B64__',
    map_base_5: '__MAP_BASE_5_B64__',
    map_overlay_5: '__MAP_OVERLAY_5_B64__',
    map_base_6: '__MAP_BASE_6_B64__',
    map_overlay_6: '__MAP_OVERLAY_6_B64__',
    map_base_7: '__MAP_BASE_7_B64__',
    map_overlay_7: '__MAP_OVERLAY_7_B64__',

    // Legacy support fields (mapped to the new ones to avoid engine breaking changes)
    skeleton_bug: '__SKELETON_WALK_B64__',
    ghost_caster: '__GHOST_FLOAT_B64__',
    iron_tank: '__IRON_TANK_WALK_B64__',
    boss: '__BOSS_DEMON_IDLE_B64__',
    blood_flame_vfx: '__FIREBALL_UNLOCK_B64__',

    // 菜单主视觉
    menu_hero_bg: null,
    menu_nun_keyart: null,
    menu_logo_plate: null,
    menu_cta_frame: null
};

export default AssetManifest;
