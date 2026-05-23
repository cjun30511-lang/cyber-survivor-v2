/**
 * SaveService.js - 本地存档与持久化管理服务
 */
import { PlatformAdapter } from '../platform/PlatformAdapter.js';

export const SaveService = {
    storageKey: 'cyber_exorcist_save_v2',

    /**
     * 持久化保存数据
     * @param {Object} data 待存储的 JSON 结构
     */
    save(data) {
        try {
            const raw = JSON.stringify(data);
            localStorage.setItem(this.storageKey, raw);
            
            // 协同云端存档进行双重备份，避免本地清理导致数据丢失
            PlatformAdapter.saveProgress(data);
            console.log('[SaveService] 存档成功写入 LocalStorage');
            return true;
        } catch (e) {
            console.error('[SaveService] 写入本地存档失败:', e);
            return false;
        }
    },

    /**
     * 读取持久化存档
     * @returns {Object|null} 存档结构
     */
    load() {
        try {
            // 优先检查本地缓存
            const raw = localStorage.getItem(this.storageKey);
            if (raw) {
                console.log('[SaveService] 成功从 LocalStorage 读取存档');
                return JSON.parse(raw);
            }
            
            // 本地为空时，兜底从平台端拉取云备份
            const cloudData = PlatformAdapter.loadProgress();
            if (cloudData) {
                console.log('[SaveService] 从平台云端成功拉回备用存档');
                return cloudData;
            }
        } catch (e) {
            console.error('[SaveService] 读取存档失败:', e);
        }
        return null;
    },

    /**
     * 强行清空本地所有进度数据 (调试专用)
     */
    clear() {
        try {
            localStorage.removeItem(this.storageKey);
            console.log('[SaveService] 存档已清空');
            return true;
        } catch (e) {
            return false;
        }
    }
};

// 挂载至 window 全局以便调试或打包后直接调用
window.SaveService = SaveService;

export default SaveService;
