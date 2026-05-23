/**
 * PlatformAdapter.js - 平台适配与商业化聚合壳
 * 提供微信小游戏、抖音小游戏、iOS/Android App、H5 聚合平台的统一边界接口
 */
export class PlatformAdapter {
    static reviveRequestSeq = 0;
    /**
     * 展现激励视频广告 (例如：看广告加倍奖励，看广告免费复活)
     * @returns {Promise<boolean>} 是否完整观看了广告
     */
    static showRewardedAd() {
        console.log('[PlatformAdapter] 请求播放激励视频广告...');
        return new Promise((resolve) => {
            // 模拟 1.2 秒广告播放延迟后自动关闭并派发奖励
            setTimeout(() => {
                console.log('[PlatformAdapter] 激励视频播放完毕，触发奖励回调');
                resolve(true);
            }, 1200);
        });
    }

    /**
     * 展现插屏广告 (例如：战斗开始前、战斗结束后、返回主界面瞬间)
     */
    static showInterstitialAd() {
        console.log('[PlatformAdapter] 显示插屏广告');
        // 可在此挂载微信小游戏或 AdMob 插屏拉起逻辑
    }

    /**
     * 核心商业化运营埋点 (支持追踪留存、转化及关键体验数据)
     * @param {string} eventName 埋点事件名 (如 'enter_battle', 'revive_click')
     * @param {Object} params 附加统计属性 (如 { stage: 1, level: 5 })
     */
    static trackEvent(eventName, params = {}) {
        console.log(`[PlatformAdapter 埋点统计] 事件: ${eventName}`, params);
        // 可在此挂载诸如微信友盟埋点、字节跳动分析等 SDK 数据上报
    }

    /**
     * 局外持久化存档云端同步
     * @param {Object} stateData 存档 JSON 结构
     */
    static saveProgress(stateData) {
        console.log('[PlatformAdapter] 准备保存/同步云端进度...', stateData);
        // 如果在微信环境，可调用 wx.getFileSystemManager 或云开发数据库
        return true;
    }

    /**
     * 局外云端进度拉取
     * @returns {Object|null} 存档数据
     */
    static loadProgress() {
        console.log('[PlatformAdapter] 尝试从云端拉取玩家数据');
        return null;
    }

    /**
     * 微信小游戏/App 唤起分享
     * @param {Function} callback 分享成功后的回调
     */
    static shareGame(callback) {
        console.log('[PlatformAdapter] 触发社交分享');
        if (callback) callback(true);
    }

    /**
     * 打开外部充值内购商城
     */
    static openShop() {
        console.log('[PlatformAdapter] 打开内购充值商城界面');
        // 预留微信支付 (wx.requestMidasPayment) 接口通道
    }

    /**
     * 显示底部广告横幅 (Banner Ad)
     */
    static showBanner() {
        console.log('[PlatformAdapter] 显示底部广告横幅 (Banner Ad)');
        let banner = document.getElementById('mock-banner-ad');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'mock-banner-ad';
            banner.style.position = 'fixed';
            banner.style.bottom = '0';
            banner.style.left = '50%';
            banner.style.transform = 'translateX(-50%)';
            banner.style.width = '100%';
            banner.style.maxWidth = '480px';
            banner.style.height = '60px';
            banner.style.backgroundColor = 'rgba(10, 10, 15, 0.95)';
            banner.style.borderTop = '2px solid #e5a93c';
            banner.style.color = '#e5a93c';
            banner.style.display = 'flex';
            banner.style.justifyContent = 'center';
            banner.style.alignItems = 'center';
            banner.style.fontFamily = "'Outfit', 'Microsoft YaHei', sans-serif";
            banner.style.fontSize = '12px';
            banner.style.zIndex = '9999';
            banner.innerHTML = `<div style="display:flex;align-items:center;gap:12px;">
                <span style="background:#e5a93c;color:#111;padding:2px 6px;border-radius:3px;font-weight:bold;font-size:10px;">AD</span>
                <span>🛡️ 暗黑圣器降临！点击预约《赛博驱魔人》正版续作</span>
            </div>`;
            document.body.appendChild(banner);
        } else {
            banner.style.display = 'flex';
        }
    }

    /**
     * 隐藏广告横幅
     */
    static hideBanner() {
        console.log('[PlatformAdapter] 隐藏底部广告横幅');
        const banner = document.getElementById('mock-banner-ad');
        if (banner) {
            banner.style.display = 'none';
        }
    }

    /**
     * 激励视频复活玩家
     * @param {Function} callback 复活成功/失败回调，传入 boolean 标识是否复活
     */
    static revivePlayer(callback) {
        console.log('[PlatformAdapter] 唤起复活广告机制...');
        this.trackEvent('revive_click');
        const requestId = ++this.reviveRequestSeq;
        this.showRewardedAd().then(success => {
            if (requestId !== this.reviveRequestSeq) return;
            if (success) {
                console.log('[PlatformAdapter] 复活奖励核销成功');
                if (callback) callback(true);
            } else {
                if (callback) callback(false);
            }
        });
        return requestId;
    }

    static cancelPendingRevive(requestId = null) {
        if (requestId == null || requestId === this.reviveRequestSeq) {
            this.reviveRequestSeq++;
        }
    }
}

// 挂载至 window 全局，确保 standalone 构建中各场景均可访问
window.PlatformAdapter = PlatformAdapter;

export default PlatformAdapter;
