/**
 * SoundSynth.js - Web Audio API 纯代码低延迟声音合成器
 * 免除一切外部音频资产载入失败或本地 file:// 协议下的跨域阻碍 (CORS-free & Server-free)
 */
export const SoundSynth = {
    ctx: null,
    muted: false,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    setMuted(muted) {
        this.muted = !!muted;
    },

    /**
     * 播放合成音效
     * @param {string} type 音效类型 ('laser' | 'explosion' | 'coin' | 'hit' | 'levelUp' | 'gameOver' | 'click')
     */
    play(type) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        
        // 避让浏览器的用户交互交互锁限制
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const now = this.ctx.currentTime;

        switch (type) {
            case 'laser': { // 弹道发射声：快速下行扫频
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(850, now);
                osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.12);
                break;
            }
            case 'explosion': { // 范围爆炸声：低通白噪音混合
                const bufferSize = this.ctx.sampleRate * 0.35;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(900, now);
                filter.frequency.exponentialRampToValueAtTime(10, now + 0.35);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);

                noise.start(now);
                noise.stop(now + 0.35);
                break;
            }
            case 'coin': { // 金币/收集品捡起：双频高透水晶和弦
                const osc1 = this.ctx.createOscillator();
                const osc2 = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc1.type = 'sine';
                osc2.type = 'sine';
                osc1.frequency.setValueAtTime(987.77, now); // B5
                osc1.frequency.setValueAtTime(1318.51, now + 0.08); // E6
                osc2.frequency.setValueAtTime(1567.98, now); // G6
                osc2.frequency.setValueAtTime(1959.98, now + 0.08); // B6

                gain.gain.setValueAtTime(0.08, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.22);

                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(this.ctx.destination);

                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + 0.22);
                osc2.stop(now + 0.22);
                break;
            }
            case 'hit': { // 打击感爆裂声：极短锯齿波刺破音
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.linearRampToValueAtTime(40, now + 0.06);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.06);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.06);
                break;
            }
            case 'levelUp': { // 觉醒升级声：C大调七音阶串联上升琶音
                const freqs = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
                freqs.forEach((f, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(f, now + idx * 0.05);
                    gain.gain.setValueAtTime(0.08, now + idx * 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.05 + 0.18);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(now + idx * 0.05);
                    osc.stop(now + idx * 0.05 + 0.18);
                });
                break;
            }
            case 'gameOver': { // 玩家阵亡哨音：长行程低落滑音
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(360, now);
                osc.frequency.linearRampToValueAtTime(50, now + 0.7);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.7);
                break;
            }
            case 'click': { // 界面按钮点击：清脆短促高频音
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.linearRampToValueAtTime(1200, now + 0.05);
                gain.gain.setValueAtTime(0.07, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.05);
                break;
            }
        }
    }
};

// 绑定到 window，确保打包后其它非模块文件也能无感访问
window.SoundSynth = SoundSynth;

export default SoundSynth;
