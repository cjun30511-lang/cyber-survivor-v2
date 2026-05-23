# 地牢战斗背景 (Dungeon Ground Tiles) 资产说明文档

## 1. 交付文件清单
本目录包含以下 5 张图片，已全部验证为标准无损 PNG 编码格式：

*   `dungeon_base_tile.png` (1024 × 1024)
    *   **用途**：底层铺设石板。
    *   **格式**：无透明通道（RGB），包含无缝拼接的暗灰色破损大石板，带少量焦炭灰烬与干涸血迹，支持双向（X和Y轴）无限平铺。
*   `dungeon_base_tile_thumb.png` (128 × 128)
    *   **用途**：微缩底层平铺贴图或低内存环境测试底图。
    *   **格式**：无透明通道（RGB），完全从最新版 `dungeon_base_tile.png` 降采样导出，具备完全一致的平铺衔接线。
*   `dungeon_overlay_tile.png` (1024 × 1024)
    *   **用途**：仪式魔纹覆盖底图，自带纯黑背景底。
    *   **格式**：无透明通道（RGB），用于地表细节覆盖，支持无缝双向平铺。
*   `dungeon_overlay_tile_transparent.png` (1024 × 1024)
    *   **用途**：可以直接接入游戏用于发光混合的 Overlay 覆盖层。
    *   **格式**：带透明通道（RGBA），已通过算法剥离纯黑底色，将熔岩裂痕和仪式魔纹的发光渐变亮度提取为 Alpha 通道。
*   `dungeon_overlay_tile_thumb.png` (128 × 128)
    *   **用途**：微缩覆盖贴图或低分辨率粒子发生器背景贴图。
    *   **格式**：带透明通道（RGBA），完全从最新版 `dungeon_overlay_tile_transparent.png` 降采样导出。

## 2. 设计与拼接规格
*   **拼接定义**：双向无缝循环图（Seamless Repeatable Tile）。边缘像素过渡已做无缝平滑对齐，拼接时无任何视觉割裂或明显拼接线。
*   **对比设计**：全地表采用超低对比的暗灰与灰黑色调，防止背景细节抢占主角、怪物与亮色弹幕的战斗可读性。

## 3. 接入说明
*   **直接接入文件**：`dungeon_base_tile.png` 作为场景最底层 `tileSprite` ；`dungeon_overlay_tile_transparent.png` 叠加其上，混合模式设置为 `Screen`（滤色），透明度设在 `0.45` 左右，即可展现具有呼吸闪烁感的熔岩裂隙地表。
