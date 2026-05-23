import base64
import os
import re

# 项目基础目录与构建输出目标
base_dir = '/Users/shenjun8676/.gemini/antigravity/scratch/cyber_survivor_v2'
# 严格按依赖关系拼接的 JS 模块列表
js_files = [
    'config/GameConfig.js',
    'config/EnemyConfig.js',
    'config/PlayerConfig.js',
    'config/RolePresentationConfig.js',
    'config/SkillConfig.js',
    'config/WaveConfig.js',
    'config/LootConfig.js',
    'config/EquipmentConfig.js',
    'config/UIConfig.js',
    'state/GameState.js',
    'platform/PlatformAdapter.js',
    'services/SaveService.js',
    'services/EquipmentService.js',
    'utils/SoundSynth.js',
    'utils/DamageTextPool.js',
    'assets/AssetManifest.js',
    'entities/Enemy.js',
    'entities/SkeletonMelee.js',
    'entities/GhostCaster.js',
    'entities/IronTank.js',
    'entities/BossDemon.js',
    'entities/Projectile.js',
    'systems/CharacterPresentationSystem.js',
    'entities/Player.js',
    'systems/InputSystem.js',
    'systems/SpawnSystem.js',
    'systems/SkillSystem.js',
    'systems/LootSystem.js',
    'systems/CombatSystem.js',
    'ui/HUD.js',
    'ui/VirtualJoystick.js',
    'ui/LevelUpMenu.js',
    'scenes/BootScene.js',
    'scenes/MenuScene.js',
    'scenes/BattleScene.js',
    'scenes/ResultScene.js',
    'main.js'
]

# Base64 资产的占位符替换字典
assets = {
    '__PLAYER_IDLE_B64__': 'assets_generated/nun/nun_idle.png',
    '__PLAYER_RUN_B64__': 'assets_generated/nun/nun_run.png',
    '__PLAYER_RUN_START_B64__': 'assets_generated/nun/nun_run_start.png',
    '__PLAYER_RUN_STOP_B64__': 'assets_generated/nun/nun_run_stop.png',
    '__PLAYER_CAST_WINDUP_B64__': 'assets_generated/nun/nun_cast_windup.png',
    '__PLAYER_CAST_RELEASE_B64__': 'assets_generated/nun/nun_cast_release.png',
    '__PLAYER_CAST_RECOVERY_B64__': 'assets_generated/nun/nun_cast_recovery.png',
    '__PLAYER_HIT_B64__': 'assets_generated/nun/nun_hit.png',
    '__PLAYER_DEATH_B64__': 'assets_generated/nun/nun_death.png',
    '__NUN_PORTRAIT_B64__': 'assets_generated/nun/nun_portrait_transparent.png',
    '__ENEMY_BUG_B64__': '../cyber_survivor/skeleton_new_processed.png.b64.txt',
    '__ENEMY_TANK_B64__': 'assets_generated/knight/knight_topdown_ingame_transparent.png',
    '__ENEMY_CASTER_B64__': '../cyber_survivor/ghost_caster_processed.png.b64.txt',
    '__LAVA_TILE_B64__': 'assets_generated/dungeon/dungeon_base_tile.png',
    '__GROUND_OVERLAY_B64__': 'assets_generated/dungeon/dungeon_overlay_tile_transparent.png',
    '__BLOOD_FLAME_VFX_B64__': 'assets_generated/vfx/blood_flame_vfx_sheet_transparent.png',
    '__BOSS_B64__': '../cyber_survivor/boss_new_processed.png.b64.txt',
}

# Standalone 输出的 HTML 物理路径
html_targets = [
    os.path.join(base_dir, 'cyber_exorcist_standalone.html'),
    os.path.join(base_dir, 'index.html'), # 覆盖原 index.html，实现本地双击即玩
    '/Users/shenjun8676/Desktop/赛博驱魔人.html'
]

def clean_js_module_syntax(content):
    """
    清洗 ES6 Module 语法：
    1. 移除所有的 import 语句
    2. 将 export default X / export class X / export const X 替换为常规声明，使之能作为平铺脚本执行
    """
    # 移除 import 语句
    content = re.sub(r'^\s*import\s+[^;\n]+;?\s*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^\s*import\s*\{[^}]*\}\s*from\s+[^;\n]+;?\s*$', '', content, flags=re.MULTILINE)
    
    # 移除 export default X
    content = re.sub(r'^\s*export\s+default\s+[^;\n]+;?\s*$', '', content, flags=re.MULTILINE)
    
    # 转换 export class / const / let 为普通定义
    content = re.sub(r'^\s*export\s+(class|const|let|var|function)\s+', r'\1 ', content, flags=re.MULTILINE)
    
    # 清理行尾多余的 export { X } 或者 export X
    content = re.sub(r'^\s*export\s*\{[^}]*\};?\s*$', '', content, flags=re.MULTILINE)
    
    return content

def normalize_data_uri(data):
    """
    统一 Base64 资产格式，避免把 data URI 前缀重复拼进最终 HTML。
    资产文件目前自带 data:image/png;base64, 前缀，因此这里直接透传；
    如果以后传入裸 base64，则补一个 png data URI 前缀。
    """
    data = data.strip()
    if data.startswith('data:image/'):
        return data
    return f"data:image/png;base64,{data}"

def load_asset_data(asset_ref):
    asset_path = os.path.normpath(os.path.join(base_dir, asset_ref))
    if not os.path.exists(asset_path):
        raise FileNotFoundError(asset_path)

    if asset_path.endswith('.b64.txt'):
        with open(asset_path, 'r', encoding='utf-8') as f:
            return normalize_data_uri(f.read())

    ext = os.path.splitext(asset_path)[1].lower().lstrip('.') or 'png'
    mime = 'jpeg' if ext in ('jpg', 'jpeg') else ext
    with open(asset_path, 'rb') as f:
        encoded = base64.b64encode(f.read()).decode('ascii')
    return f"data:image/{mime};base64,{encoded}"

def build():
    print("==================================================")
    print("🛡️ 《赛博驱魔人》v2 第二轮模块化合并构建开始...")
    print("==================================================")

    compiled_js_blocks = []

    # 1. 按顺序读取并清洗所有 JS 文件
    for relative_path in js_files:
        filepath = os.path.join(base_dir, relative_path)
        if not os.path.exists(filepath):
            print(f"❌ 错误: 找不到关键源文件 {filepath}")
            return False
        
        with open(filepath, 'r', encoding='utf-8') as f:
            raw_content = f.read()
            
        cleaned_content = clean_js_module_syntax(raw_content)
        compiled_js_blocks.append(f"\n// ==========================================\n// SOURCE: {relative_path}\n// ==========================================\n" + cleaned_content)
        print(f"✅ 已加载并清洗 ES6 语法: {relative_path}")

    # 合并成单个庞大 JS 字符串
    full_js = "\n".join(compiled_js_blocks)

    # 2. 从老目录读取真实的 Base64 替换掉所有的占位符
    print("\n📦 正在注入 Base64 手绘材质资源...")
    for placeholder, b64_filename in assets.items():
        try:
            b64_data = load_asset_data(b64_filename)
        except FileNotFoundError as error:
            print(f"❌ 错误: 找不到 Base64 资产文件 {error}")
            return False

        full_js = full_js.replace(placeholder, b64_data)
        print(f"✨ 已内联注入美术材质: {b64_filename} ({len(b64_data)} 字符)")

    # 3. 读取 index.html 模板，清理已有的打包 script，用新打包的 script 替换或插入
    index_template_path = os.path.join(base_dir, 'index.html')
    if not os.path.exists(index_template_path):
        print(f"❌ 错误: 找不到 HTML 模板文件 {index_template_path}")
        return False
        
    with open(index_template_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    # 清理 html_content 中已有的打包 <script> ... </script> 块，防止重复累加
    # 我们的打包 script 都是以 // ========================================== 开头
    html_content = re.sub(r'<script>\s*// ==========================================[\s\S]*?</script>', '', html_content)

    bundled_script_tag = f"<script>\n{full_js}\n</script>"
    
    if "<!-- BUNDLED_SCRIPTS_PLACEHOLDER -->" in html_content:
        standalone_html = html_content.replace("<!-- BUNDLED_SCRIPTS_PLACEHOLDER -->", bundled_script_tag)
    else:
        # 如果没有占位符，默认在 </body> 前插入
        standalone_html = html_content.replace("</body>", f"{bundled_script_tag}\n</body>")

    # 4. 输出打包后的 standalone HTML 文件
    print("\n💾 正在写入 standalone HTML 目标文件...")
    for target_path in html_targets:
        # 确保父目录存在
        target_dir = os.path.dirname(target_path)
        if target_dir and not os.path.exists(target_dir):
            try:
                os.makedirs(target_dir)
            except Exception as e:
                print(f"⚠️ 无法创建目录 {target_dir}: {e}，跳过此文件。")
                continue
                
        try:
            with open(target_path, 'w', encoding='utf-8') as f:
                f.write(standalone_html)
            print(f"🌟 成功发布 Standalone 客户端: {target_path}")
        except Exception as e:
            print(f"⚠️ 写入 {target_path} 失败: {e}")

    print("\n🎉 构建发布流程完美圆满完成！")
    print("==================================================")
    return True

if __name__ == '__main__':
    build()
