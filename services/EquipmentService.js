/**
 * EquipmentService.js - 装备系统核心服务
 * 提供装备属性计算、穿戴/卸下、掉落生成、词条等局外核心逻辑
 */
import { EquipmentConfig } from '../config/EquipmentConfig.js';
import { GameState } from '../state/GameState.js';

export const EquipmentService = {
    /**
     * 计算当前穿戴装备叠加给玩家的开局属性
     * @returns {Object} 属性加成集合
     */
    getEquippedStats() {
        const stats = {
            maxHp: 0,
            damageMultiplier: 0,
            speedMultiplier: 0
        };

        const equipped = GameState.meta.equipped || {};
        const inventory = GameState.meta.inventory || [];

        // 遍历每个穿戴槽位
        Object.keys(equipped).forEach(slot => {
            const instanceId = equipped[slot];
            if (!instanceId) return;

            // 在库存中查找对应的实例
            const inst = inventory.find(i => i.instanceId === instanceId);
            if (!inst) return;

            // 获取配置定义
            const cfg = EquipmentConfig.items[inst.id];
            if (!cfg) return;

            const lvl = inst.level || 1;

            // 1. 生命上限加成
            if (cfg.baseMaxHp) {
                stats.maxHp += cfg.baseMaxHp + (lvl - 1) * (cfg.levelUpHp || 0);
            }
            // 2. 伤害加成
            if (cfg.baseDamageMultiplier) {
                stats.damageMultiplier += cfg.baseDamageMultiplier + (lvl - 1) * (cfg.levelUpDamage || 0);
            }
            // 3. 移速加成
            if (cfg.baseSpeedMultiplier) {
                stats.speedMultiplier += cfg.baseSpeedMultiplier + (lvl - 1) * (cfg.levelUpSpeed || 0);
            }
        });

        return stats;
    },

    /**
     * 穿戴一件装备到对应槽位
     * @param {string} instanceId 装备的唯一实例 ID
     * @returns {boolean} 是否穿戴成功
     */
    equipItem(instanceId) {
        const inventory = GameState.meta.inventory || [];
        const inst = inventory.find(i => i.instanceId === instanceId);
        if (!inst) return false;

        const cfg = EquipmentConfig.items[inst.id];
        if (!cfg) return false;

        const slot = cfg.slot;
        if (!GameState.meta.equipped) {
            GameState.meta.equipped = {};
        }

        // 把这个槽位当前穿戴的 instance 卸下 (直接替换)
        GameState.meta.equipped[slot] = instanceId;
        GameState.saveMeta();
        return true;
    },

    /**
     * 卸下指定槽位的装备
     * @param {string} slot 槽位名 WEAPON / AMULET / BOOTS / RING
     * @returns {boolean} 是否卸下成功
     */
    unequipSlot(slot) {
        if (GameState.meta.equipped && GameState.meta.equipped[slot]) {
            GameState.meta.equipped[slot] = null;
            GameState.saveMeta();
            return true;
        }
        return false;
    },

    /**
     * 随机生成一件装备掉落
     * @returns {string} 随机的装备 ID (如 'goth_ring')
     */
    rollEquipmentDrop() {
        const itemIds = Object.keys(EquipmentConfig.items);
        if (itemIds.length === 0) return null;
        const randIdx = Math.floor(Math.random() * itemIds.length);
        return itemIds[randIdx];
    },

    /**
     * 将一件新的装备实例加入玩家的库存
     * @param {string} itemId 装备配置 ID
     * @returns {Object} 生成的装备实例
     */
    addEquipmentToInventory(itemId) {
        const cfg = EquipmentConfig.items[itemId];
        if (!cfg) return null;

        const instanceId = 'eq_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        const newInst = {
            instanceId,
            id: itemId,
            level: 1
        };

        if (!GameState.meta.inventory) {
            GameState.meta.inventory = [];
        }
        GameState.meta.inventory.push(newInst);
        GameState.saveMeta();
        return newInst;
    }
};

// 挂载到 window 以便在非 ES6 单页运行中顺利调用
window.EquipmentService = EquipmentService;
export default EquipmentService;
