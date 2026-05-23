# 血焰骑士 (Blood Knight) 资产说明文档

## 1. 交付文件清单
本目录包含以下 5 张图片，已全部验证为标准无损 PNG 编码格式：

*   `knight_portrait.png` (1024 × 1024)
    *   **用途**：主立绘资源，用于精英怪/Boss亮相立绘、怪物图鉴或剧情展示。
    *   **格式**：无透明通道（RGB），带破败礼拜堂大理石拱门背景。
*   `knight_portrait_transparent.png` (1024 × 1024)
    *   **用途**：UI 头像、Boss血条头像或悬浮展示。
    *   **格式**：带透明通道（RGBA），已通过算法剔除深暗背景。
*   `knight_topdown_ingame.png` (1024 × 1024)
    *   **用途**：局内单体动作精灵主资源，俯视战斗视角。
    *   **格式**：无透明通道（RGB），默认带纯黑背景。
*   `knight_topdown_ingame_transparent.png` (1024 × 1024)
    *   **用途**：可以直接接入游戏的局内敌人精灵贴图。
    *   **格式**：带透明通道（RGBA），已剥离黑底，保留熏黑钢甲、破碎披风与焦黑熔岩巨剑。
*   `knight_topdown_ingame_transparent_thumb.png` (128 × 128)
    *   **用途**：轻量级缩略精灵，适合低物理尺寸敌人测试。
    *   **格式**：带透明通道（RGBA），完全从最新版 `knight_topdown_ingame_transparent.png` 降采样导出，视觉内容保持绝对一致。

## 2. 视角与风格规格
*   **视角描述**：正统 2D 俯视（Top-down / Overhead）战斗视角。展示被血焰污染的堕落铁甲骑士，可看清其双角面盔顶部、左肩甲和向右斜指的锯齿状重刃。
*   **色调定位**：煤黑板甲、暗红披风，重剑刃口带有流淌的火山裂纹发热光环，具备极宽的战斗受击与物理占据判定轮廓。

## 3. 接入说明
*   **直接接入文件**：`knight_topdown_ingame_transparent.png`（高清版）或 `knight_topdown_ingame_transparent_thumb.png`（轻量版）。
*   在引擎内直接作为 `Enemy` 纹理加载，已通过算法将暗色边缘渐变羽化提纯，无多余黑底残留。
