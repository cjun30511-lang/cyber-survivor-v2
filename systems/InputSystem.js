/**
 * InputSystem.js - 键盘与移动端虚拟摇杆手势混合输入分发系统
 * 彻底解耦控制端细节，输出统一的速度分量矢量
 */
import { PlayerConfig } from '../config/PlayerConfig.js';
import { GameState } from '../state/GameState.js';

export class InputSystem {
    /**
     * @param {Phaser.Scene} scene 绑定的战斗场景
     */
    constructor(scene) {
        this.scene = scene;
        this.enabled = true;

        // 1. 初始化键盘映射
        this.cursors = scene.input.keyboard.createCursorKeys();
        
        this.keys = scene.input.keyboard.addKeys({
            W: Phaser.Input.Keyboard.KeyCodes.W,
            A: Phaser.Input.Keyboard.KeyCodes.A,
            S: Phaser.Input.Keyboard.KeyCodes.S,
            D: Phaser.Input.Keyboard.KeyCodes.D,
            SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE
        });

        // 2. 外部手势摇杆引用 (将在 UI 层被实例化并挂载)
        this.virtualJoystick = null;
    }

    /**
     * 设置外部虚拟摇杆实例引用
     * @param {VirtualJoystick} joystick
     */
    setJoystick(joystick) {
        this.virtualJoystick = joystick;
    }

    /**
     * 获取当前心跳帧合并后的混合速度向量
     * @param {number} time 当前时间
     * @returns {Object} { vx, vy, isSpaceDown }
     */
    getInputState(time) {
        let vx = 0;
        let vy = 0;
        let isSpaceDown = false;

        // 仅在游戏正常进行、未阵亡时计算输入
        if (!this.enabled || !GameState.run || GameState.run.isGameOver) {
            return { vx, vy, isSpaceDown };
        }

        // 1. 物理键盘读取
        const speed = GameState.run.speed;

        if (this.keys.A.isDown || this.cursors.left.isDown) {
            vx = -speed;
        } else if (this.keys.D.isDown || this.cursors.right.isDown) {
            vx = speed;
        }

        if (this.keys.W.isDown || this.cursors.up.isDown) {
            vy = -speed;
        } else if (this.keys.S.isDown || this.cursors.down.isDown) {
            vy = speed;
        }

        // 斜向移动时的等速率物理归一化 (防斜跑移速飞快 Bug)
        if (vx !== 0 && vy !== 0) {
            vx *= 0.7071;
            vy *= 0.7071;
        }

        // 判定空格键冲刺
        if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
            isSpaceDown = true;
        }

        // 2. 融合虚拟摇杆输入 (若玩家正在使用触碰摇杆，则覆盖/合并键盘速度)
        if (this.virtualJoystick && this.virtualJoystick.active) {
            const joyVector = this.virtualJoystick.getForceVector();
            if (joyVector.force > 0) {
                // 根据摇杆倾斜百分比计算实际速度
                vx = joyVector.x * speed;
                vy = joyVector.y * speed;
            }
            
            // 融合冲刺按钮触碰状态
            if (this.virtualJoystick.isDashPressed) {
                isSpaceDown = true;
                this.virtualJoystick.clearDashPress(); // 消费此次点击状态
            }
        }

        return { vx, vy, isSpaceDown };
    }
}

export default InputSystem;
