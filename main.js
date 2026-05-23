/**
 * main.js - Phaser 3 游戏核心入口点
 * 组装基础物理底座配置、挂载场景并启动引擎
 */
import { GameConfig } from './config/GameConfig.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { ResultScene } from './scenes/ResultScene.js';

// 将所有模块化的场景加载进 Phaser 的全局配置
const finalConfig = {
    ...GameConfig,
    scene: [BootScene, MenuScene, BattleScene, ResultScene]
};

// 实例化游戏，挂载至 index.html 预留的 #game-container 容器
window.game = new Phaser.Game(finalConfig);
