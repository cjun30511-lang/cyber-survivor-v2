/**
 * GameConfig.js - Phaser 3 引擎及物理底座配置
 */
export const GameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 720,
    height: 1280,
    render: {
        antialias: true,
        pixelArt: false,
        roundPixels: false
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    // 自适应缩放设定，确保手机与桌面完美居中
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

export default GameConfig;
