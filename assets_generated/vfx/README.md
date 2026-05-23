# 血焰 VFX 贴图包 (Blood Flame VFX Sheet) 资产说明文档

## 1. 交付文件清单
本目录包含以下 3 张图片，已全部验证为标准无损 PNG 编码格式：

*   `blood_flame_vfx_sheet.png` (1024 × 1024)
    *   **用途**：正式 VFX 拼图版底图册，自带纯黑背景。
    *   **格式**：无透明通道（RGB），已清空所有文字、线条与数字标注，包含无字纯净版爆裂、弹尾、流体球和十字魔法印记。
*   `blood_flame_vfx_sheet_transparent.png` (1024 × 1024)
    *   **用途**：可以直接接入游戏进行加算混合（ADD）的高能发光图册。
    *   **格式**：带透明通道（RGBA），已通过算法剔除纯黑底色，将光晕及粒子散射亮度精准映射为 Alpha 通道。
*   `blood_flame_vfx_sheet_transparent_thumb.png` (128 × 128)
    *   **用途**：微缩透明图册，适合低内存测试或小比例粒子源粒子纹理。
    *   **格式**：带透明通道（RGBA），完全从最新版 `blood_flame_vfx_sheet_transparent.png` 降采样导出，保持最新版无字内容。

## 2. 图集切片区域参考
在游戏引擎中，可对 `blood_flame_vfx_sheet_transparent.png` 进行以下坐标切片以读取特定特效资产：
1.  **Explosion Burst (爆裂)**：左上区域 `[x: 0, y: 0, width: 512, height: 256]`。
2.  **Bullet Trail (弹道拖尾)**：右上区域 `[x: 512, y: 0, width: 512, height: 320]`。
3.  **Spell Orb (火球核)**：中段区域 `[x: 0, y: 320, width: 1024, height: 180]`。
4.  **Holy Corrupt Blast (十字爆炸)**：下段偏上 `[x: 0, y: 500, width: 1024, height: 180]`。
5.  **Sparks & Embers (小粒子火屑)**：左下区域 `[x: 0, y: 680, width: 400, height: 344]`。
6.  **Casting Sigil (仪式魔纹阵)**：右下区域 `[x: 400, y: 680, width: 624, height: 344]`。

## 3. 接入说明
*   **直接接入文件**：`blood_flame_vfx_sheet_transparent.png` 或 `blood_flame_vfx_sheet_transparent_thumb.png`。
*   在引擎内进行图片切片分割后，特效渲染节点推荐设置混合模式为加算 `ADD` 或 `SCREEN`。发光部分会被自然点亮，无任何文字或黑边污染。
