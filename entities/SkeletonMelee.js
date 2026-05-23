/**
 * SkeletonMelee.js - 近战小兵（枯骨步兵）魔物
 */
import { Enemy } from './Enemy.js';

export class SkeletonMelee extends Enemy {
    /**
     * @param {Phaser.Scene} scene 场景
     * @param {number} x X坐标
     * @param {number} y Y坐标
     */
    constructor(scene, x, y) {
        super(scene, x, y, 'skeleton_bug', 'skeleton');
    }
}

export default SkeletonMelee;
