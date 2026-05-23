/**
 * DamageTextPool.js - 飘字池组件
 * 高度缓存 Text 对象以完全隔绝战斗时频繁生成销毁带来的 GC 卡顿
 */
export class DamageTextPool {
    constructor(scene) {
        this.scene = scene;
        this.pool = [];
    }

    /**
     * 展现伤害飘字
     * @param {number} x X坐标
     * @param {number} y Y坐标
     * @param {string} textString 伤害值文本
     * @param {string} color 十六进制颜色代码值 (如 '#ff1a1a')
     * @param {number} fontSize 字体大小 (如 22)
     * @param {boolean} isCrit 是否为暴击
     */
    showText(x, y, textString, color, fontSize, isCrit = false) {
        let textObj = this.pool.find(item => !item.active);

        if (!textObj) {
            textObj = this.scene.add.text(0, 0, '', {
                fontFamily: 'Spectral, Cinzel, serif',
                fontWeight: 'bold',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5).setDepth(99);
            this.pool.push(textObj);
        }

        textObj.setActive(true).setVisible(true);
        textObj.setPosition(x, y);
        textObj.setText(textString);
        textObj.setColor(color);
        textObj.setFontSize(fontSize);
        textObj.setAlpha(1.0);
        textObj.setScale(isCrit ? 1.45 : 1.0);

        const startX = x;
        const startY = y;
        const randomX = Phaser.Math.Between(-35, 35);
        const bounceY = startY - Phaser.Math.Between(45, 60);

        if (isCrit) {
            // 暴击飘字：先剧烈膨胀缩放，再向外弹开并弹性淡出
            this.scene.tweens.add({
                targets: textObj,
                scale: 1.7,
                duration: 80,
                yoyo: true,
                repeat: 1,
                onComplete: () => {
                    this.scene.tweens.add({
                        targets: textObj,
                        x: startX + randomX * 1.4,
                        y: bounceY - 15,
                        alpha: 0,
                        scale: 0.9,
                        duration: 650,
                        ease: 'Back.easeIn',
                        onComplete: () => {
                            textObj.setActive(false).setVisible(false);
                        }
                    });
                }
            });
        } else {
            // 普通伤害飘字：经典的抛物线上扬并淡出
            this.scene.tweens.add({
                targets: textObj,
                x: startX + randomX,
                y: bounceY,
                alpha: 0,
                scale: 0.75,
                duration: 480,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    textObj.setActive(false).setVisible(false);
                }
            });
        }
    }
}

export default DamageTextPool;
