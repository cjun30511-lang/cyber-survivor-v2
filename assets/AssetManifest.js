/**
 * AssetManifest.js - 游戏高清手绘美术材质 Base64 资产清单
 * 采用 Base64 在线内嵌，彻底免除 file:// 协议本地运行时无法加载外部图片的 CORS 痛点
 * 注意：.b64.txt 资源文件已自带 data:image/png;base64, 前缀，此处不可重复添加
 */
export const AssetManifest = {
    // 玩家 5大状态真实序列帧 spritesheets
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
    
    // 杂鱼魔物 (近战枯骨步兵)
    skeleton_bug: '__ENEMY_BUG_B64__',
    
    // 远程魔物 (幽灵祭司)
    ghost_caster: '__ENEMY_CASTER_B64__',
    
    // 重装魔物 (铁壁坦克)
    iron_tank: '__ENEMY_TANK_B64__',
    
    // 地表平铺地砖 (冷却的赛博熔岩格)
    lava_tile: '__LAVA_TILE_B64__',

    // 地牢裂隙覆盖层
    ground_overlay: '__GROUND_OVERLAY_B64__',

    // 血焰特效图集
    blood_flame_vfx: '__BLOOD_FLAME_VFX_B64__',
    
    // 关卡首领 (Demon Boss V2 终极巨灵)
    boss: '__BOSS_B64__',

    // 菜单商业主视觉可选插槽，由反重力产出后再接入。
    // 保持 null 时，菜单使用代码占位结构，避免 Codex 越界定稿美术。
    menu_hero_bg: null,
    menu_nun_keyart: null,
    menu_logo_plate: null,
    menu_cta_frame: null
};

export default AssetManifest;
