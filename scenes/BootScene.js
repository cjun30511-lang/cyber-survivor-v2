/**
 * BootScene.js - 启动与资源初始化场景
 * 载入 Base64 美术清单，并在内存中通过 Canvas 动态生成弹道、粒子和屏障材质，规避 CORS 限制
 */
import { AssetManifest } from '../assets/AssetManifest.js';
import { GameState } from '../state/GameState.js';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
        this.progressBar = null;
        this.progressBg = null;
    }

    preload() {
        // 在网页正中间绘制一个简易酷炫的哥特金色进度条。
        // 不再依赖 Phaser Loader 去处理 data URI 图片，避免 standalone file:// 场景卡死。
        const width = 400;
        const height = 16;
        const cx = 360;
        const cy = 640;

        this.progressBg = this.add.graphics();
        this.progressBg.lineStyle(2, 0xe5a93c, 0.7);
        this.progressBg.strokeRect(cx - width / 2, cy - height / 2, width, height);

        this.progressBar = this.add.graphics();
    }

    create() {
        this.loadEmbeddedImages()
            .then(() => {
                this.trimEmbeddedTextures();
                this.recolorNunVisuals();
                this.generateDynamicTextures();
                this.registerPlayerAnimations();
                GameState.loadMeta();
                this.progressBg?.destroy();
                this.progressBar?.destroy();
                this.scene.start('MenuScene');
            })
            .catch((error) => {
                throw new Error(`BootScene embedded image load failed: ${error?.message || error}`);
            });
    }

    updateProgress(value) {
        if (!this.progressBar) return;
        const width = 400;
        const height = 16;
        const cx = 360;
        const cy = 640;

        this.progressBar.clear();
        this.progressBar.fillStyle(0x00ffff, 0.95);
        this.progressBar.fillRect(
            cx - width / 2 + 3,
            cy - height / 2 + 3,
            (width - 6) * value,
            height - 6
        );
    }

    loadEmbeddedImages() {
        const assetEntries = [
            ['player_idle', AssetManifest.player_idle],
            ['player_run', AssetManifest.player_run],
            ['player_run_start', AssetManifest.player_run_start],
            ['player_run_stop', AssetManifest.player_run_stop],
            ['player_cast_windup', AssetManifest.player_cast_windup],
            ['player_cast_release', AssetManifest.player_cast_release],
            ['player_cast_recovery', AssetManifest.player_cast_recovery],
            ['player_hit', AssetManifest.player_hit],
            ['player_death', AssetManifest.player_death],
            ['nun_portrait', AssetManifest.nun_portrait],
            ['skeleton_bug', AssetManifest.skeleton_bug],
            ['ghost_caster', AssetManifest.ghost_caster],
            ['iron_tank', AssetManifest.iron_tank],
            ['lava_tile', AssetManifest.lava_tile],
            ['ground_overlay', AssetManifest.ground_overlay],
            ['blood_flame_vfx', AssetManifest.blood_flame_vfx],
            ['boss', AssetManifest.boss],
            ['menu_hero_bg', AssetManifest.menu_hero_bg],
            ['menu_nun_keyart', AssetManifest.menu_nun_keyart],
            ['menu_logo_plate', AssetManifest.menu_logo_plate],
            ['menu_cta_frame', AssetManifest.menu_cta_frame]
        ].filter(([, src]) => typeof src === 'string' && src.length > 0);

        let loaded = 0;
        const total = assetEntries.length;

        const loadOne = ([key, src]) => new Promise((resolve, reject) => {
            if (this.textures.exists(key)) {
                loaded += 1;
                this.updateProgress(loaded / total);
                resolve();
                return;
            }

            const image = new Image();
            image.onload = () => {
                if (key.startsWith('player_')) {
                    this.textures.addSpriteSheet(key, image, { frameWidth: 128, frameHeight: 128 });
                } else {
                    this.textures.addImage(key, image);
                }
                loaded += 1;
                this.updateProgress(loaded / total);
                resolve();
            };
            image.onerror = () => reject(new Error(`image failed: ${key}`));
            image.src = src;
        });

        return Promise.all(assetEntries.map(loadOne));
    }

    trimEmbeddedTextures() {
        const trimTexture = (key, padding = 0) => {
            const texture = this.textures.get(key);
            const source = texture?.getSourceImage?.();
            if (!source) return;

            const width = source.width;
            const height = source.height;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(source, 0, 0);

            const imageData = ctx.getImageData(0, 0, width, height).data;
            let minX = width;
            let minY = height;
            let maxX = -1;
            let maxY = -1;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const alpha = imageData[(y * width + x) * 4 + 3];
                    if (alpha < 12) continue; // 忽略极其微弱的半透明抗锯齿/噪点边缘，实现强力深层有效区域裁切
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }

            if (maxX < minX || maxY < minY) return;

            minX = Math.max(0, minX - padding);
            minY = Math.max(0, minY - padding);
            maxX = Math.min(width - 1, maxX + padding);
            maxY = Math.min(height - 1, maxY + padding);

            const trimmedWidth = maxX - minX + 1;
            const trimmedHeight = maxY - minY + 1;
            const trimmedCanvas = document.createElement('canvas');
            trimmedCanvas.width = trimmedWidth;
            trimmedCanvas.height = trimmedHeight;
            trimmedCanvas
                .getContext('2d')
                .drawImage(source, minX, minY, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);

            this.textures.remove(key);
            this.textures.addCanvas(key, trimmedCanvas);
        };

        trimTexture('iron_tank', 10);
    }

    recolorNunVisuals() {
        const recolorTexture = (key) => {
            const texture = this.textures.get(key);
            const source = texture?.getSourceImage?.();
            if (!source) return;

            const width = source.width;
            const height = source.height;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(source, 0, 0);

            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];
                if (a < 8) continue;

                const redBias = r - Math.max(g, b);
                const brightness = (r + g + b) / 3;
                if (redBias < 18 || brightness < 24) continue;

                const mix = Phaser.Math.Clamp((redBias - 18) / 90, 0, 0.72);
                data[i] = Math.round(r * (1 - mix) + 236 * mix);
                data[i + 1] = Math.round(g * (1 - mix) + 228 * mix);
                data[i + 2] = Math.round(b * (1 - mix) + 216 * mix);
            }

            ctx.putImageData(imageData, 0, 0);
            this.textures.remove(key);
            if (key.startsWith('player_')) {
                this.textures.addSpriteSheet(key, canvas, { frameWidth: 128, frameHeight: 128 });
            } else {
                this.textures.addCanvas(key, canvas);
            }
        };

        [
            'player_idle',
            'player_run',
            'player_run_start',
            'player_run_stop',
            'player_cast_windup',
            'player_cast_release',
            'player_cast_recovery',
            'player_hit',
            'player_death',
            'nun_portrait'
        ].forEach(recolorTexture);
    }

    registerPlayerAnimations() {
        this.anims.create({
            key: 'player_idle_anim',
            frames: this.anims.generateFrameNumbers('player_idle', { start: 0, end: 5 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: 'player_run_anim',
            frames: this.anims.generateFrameNumbers('player_run', { start: 0, end: 7 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: 'player_run_start_anim',
            frames: this.anims.generateFrameNumbers('player_run_start', { start: 0, end: 3 }),
            frameRate: 15,
            repeat: 0
        });

        this.anims.create({
            key: 'player_run_stop_anim',
            frames: this.anims.generateFrameNumbers('player_run_stop', { start: 0, end: 3 }),
            frameRate: 12,
            repeat: 0
        });

        this.anims.create({
            key: 'player_cast_windup_anim',
            frames: this.anims.generateFrameNumbers('player_cast_windup', { start: 0, end: 3 }),
            frameRate: 15,
            repeat: 0
        });

        this.anims.create({
            key: 'player_cast_release_anim',
            frames: this.anims.generateFrameNumbers('player_cast_release', { start: 0, end: 2 }),
            frameRate: 15,
            repeat: 0
        });

        this.anims.create({
            key: 'player_cast_recovery_anim',
            frames: this.anims.generateFrameNumbers('player_cast_recovery', { start: 0, end: 3 }),
            frameRate: 12,
            repeat: 0
        });

        this.anims.create({
            key: 'player_hit_anim',
            frames: this.anims.generateFrameNumbers('player_hit', { start: 0, end: 2 }),
            frameRate: 15,
            repeat: 0
        });

        this.anims.create({
            key: 'player_death_anim',
            frames: this.anims.generateFrameNumbers('player_death', { start: 0, end: 5 }),
            frameRate: 10,
            repeat: 0
        });
    }

    /**
     * 核心美术生成：内存中绘制高品质发光弹幕、碎片粒子与结界
     */
    generateDynamicTextures() {
        const createTextureFromAtlas = (key, atlasKey, x, y, width, height) => {
            const atlas = this.textures.get(atlasKey);
            const source = atlas?.getSourceImage?.();
            if (!source) return false;

            if (this.textures.exists(key)) {
                this.textures.remove(key);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
            this.textures.addCanvas(key, canvas);
            return true;
        };

        // A. 邪能魔弹 (暗紫色球体 + 鲜红外边)
        if (!createTextureFromAtlas('casterBullet', 'blood_flame_vfx', 512, 0, 128, 48)) {
            let bG = this.make.graphics({ x: 0, y: 0, add: false });
            bG.fillStyle(0x4a0e4e, 1); 
            bG.fillCircle(8, 8, 4); 
            bG.lineStyle(1.5, 0xff1a1a, 0.85); 
            bG.strokeCircle(8, 8, 6); 
            bG.generateTexture('casterBullet', 16, 16);
        }

        // A1. 驱魔骑士：黄金弧光圣光斩 (slash_gold) - 128x128 Premium Golden Crescent
        let sgG = this.make.graphics({ x: 0, y: 0, add: false });
        
        // Outer broad glowing golden halo
        sgG.lineStyle(10, 0xe5a93c, 0.35);
        sgG.beginPath();
        sgG.arc(64, 64, 52, -Math.PI / 2.3, Math.PI / 2.3, false);
        sgG.strokePath();

        // Secondary flame gold inner border
        sgG.lineStyle(5, 0xffaa00, 0.75);
        sgG.beginPath();
        sgG.arc(64, 64, 50, -Math.PI / 2.4, Math.PI / 2.4, false);
        sgG.strokePath();

        // Solid brilliant core with sharp crescent edges
        sgG.fillStyle(0xffffff, 0.95);
        sgG.lineStyle(2, 0xffd700, 1);
        sgG.beginPath();
        // A premium crescent path
        sgG.arc(64, 64, 48, -Math.PI / 2.4, Math.PI / 2.4, false);
        sgG.arc(36, 64, 32, Math.PI / 2.4, -Math.PI / 2.4, true);
        sgG.closePath();
        sgG.fillPath();
        sgG.strokePath();
        
        sgG.generateTexture('slash_gold', 128, 128);


        // A2. 血焰修女：猩红血焰核 (flame_crimson) - 48x48 High Fidelity Plasma Orb
        if (!createTextureFromAtlas('flame_crimson', 'blood_flame_vfx', 0, 320, 128, 128)) {
            let fcG = this.make.graphics({ x: 0, y: 0, add: false });
            fcG.fillStyle(0xffa500, 0.28);
            fcG.fillCircle(24, 24, 22);
            fcG.fillStyle(0xff1a1a, 0.9);
            fcG.fillCircle(24, 24, 15);
            fcG.lineStyle(2, 0xff3300, 0.95);
            fcG.strokeCircle(24, 24, 15);
            fcG.fillStyle(0xffcc00, 0.95);
            fcG.fillCircle(24, 24, 9);
            fcG.fillStyle(0xffffff, 1.0);
            fcG.fillCircle(24, 24, 5);
            fcG.generateTexture('flame_crimson', 48, 48);
        }

        // A2b. 血焰修女：细长远程魔弹 (nun_bolt)
        let nbG = this.make.graphics({ x: 0, y: 0, add: false });
        nbG.fillStyle(0xff2200, 0.2);
        nbG.fillEllipse(18, 10, 28, 14);
        nbG.fillStyle(0xff3300, 0.95);
        nbG.beginPath();
        nbG.moveTo(3, 10);
        nbG.lineTo(18, 2);
        nbG.lineTo(31, 10);
        nbG.lineTo(18, 18);
        nbG.closePath();
        nbG.fillPath();
        nbG.fillStyle(0xffcc66, 0.9);
        nbG.fillEllipse(16, 10, 10, 6);
        nbG.fillStyle(0xffffff, 0.95);
        nbG.fillCircle(11, 10, 3);
        nbG.generateTexture('nun_bolt', 36, 20);

        // A3. 死灵学徒：幽蓝追魂弹 (ghost_teal)
        let gtG = this.make.graphics({ x: 0, y: 0, add: false });
        gtG.fillStyle(0xffffff, 1);
        gtG.fillCircle(12, 10, 6);
        gtG.fillStyle(0x00ffff, 0.9);
        gtG.beginPath();
        gtG.moveTo(6, 10);
        gtG.lineTo(12, 22);
        gtG.lineTo(18, 10);
        gtG.closePath();
        gtG.fillPath();
        gtG.lineStyle(1.5, 0x008080, 1);
        gtG.strokeCircle(12, 10, 6);
        gtG.generateTexture('ghost_teal', 24, 24);

        // A4. 影刃猎手：紫色影穿刃 (shadow_dagger)
        let sdG = this.make.graphics({ x: 0, y: 0, add: false });
        sdG.fillStyle(0x9d00ff, 0.95);
        sdG.beginPath();
        sdG.moveTo(12, 2);
        sdG.lineTo(17, 10);
        sdG.lineTo(13, 22);
        sdG.lineTo(11, 22);
        sdG.lineTo(7, 10);
        sdG.closePath();
        sdG.fillPath();
        sdG.lineStyle(1.5, 0xffffff, 0.85);
        sdG.strokePath();
        sdG.generateTexture('shadow_dagger', 24, 24);


        // B. 白骨碎片 ( Bone Shard - 代替符咒 )
        let tG = this.make.graphics({ x: 0, y: 0, add: false });
        tG.fillStyle(0xcfc5b3, 0.95); 
        tG.beginPath();
        tG.moveTo(8, 0);
        tG.lineTo(14, 8);
        tG.lineTo(10, 24);
        tG.lineTo(6, 24);
        tG.lineTo(2, 8);
        tG.closePath();
        tG.fillPath();
        tG.lineStyle(1.5, 0xffffff, 1);
        tG.strokePath();
        tG.generateTexture('talisman', 16, 24);

        // C. 鲜血新星火球 ( Blood Nova )
        if (!createTextureFromAtlas('fireball', 'blood_flame_vfx', 128, 0, 128, 128)) {
            let fG = this.make.graphics({ x: 0, y: 0, add: false });
            fG.fillStyle(0x8a0000, 1); 
            fG.fillCircle(12, 12, 9); 
            fG.lineStyle(2, 0xff1a1a, 1); 
            fG.strokeCircle(12, 12, 9); 
            fG.generateTexture('fireball', 24, 24);
        }

        // C2. 修女专属：稳定可见的远程血焰火球
        let nfG = this.make.graphics({ x: 0, y: 0, add: false });
        nfG.fillStyle(0xff2200, 0.16);
        nfG.fillCircle(24, 24, 22);
        nfG.fillStyle(0xff3300, 0.95);
        nfG.fillCircle(24, 24, 15);
        nfG.lineStyle(3, 0xffaa00, 0.9);
        nfG.strokeCircle(24, 24, 14);
        nfG.fillStyle(0xffdd88, 0.92);
        nfG.fillCircle(21, 21, 7);
        nfG.fillStyle(0xffffff, 0.95);
        nfG.fillCircle(19, 19, 4);
        nfG.generateTexture('nun_fireball', 48, 48);

        // D. 亡魂余烬 ( Soul Ember - 经验晶石 )
        let xG = this.make.graphics({ x: 0, y: 0, add: false });
        xG.fillStyle(0x00ffff, 1); // 赛博幽蓝
        xG.beginPath(); 
        xG.moveTo(8, 1); 
        xG.lineTo(14, 8); 
        xG.lineTo(8, 15); 
        xG.lineTo(2, 8); 
        xG.closePath();
        xG.fillPath(); 
        xG.generateTexture('xpOrb', 16, 16);

        // E. 铁血古币 ( Iron Coin )
        let cG = this.make.graphics({ x: 0, y: 0, add: false });
        cG.fillStyle(0x8c7e6c, 1); 
        cG.fillCircle(8, 8, 7); 
        cG.lineStyle(1.2, 0xb8860b, 1); 
        cG.strokeCircle(8, 8, 7); 
        cG.fillStyle(0x080606, 1); 
        cG.fillRect(6, 6, 4, 4); // 经典方孔
        cG.generateTexture('coin', 16, 16);

        // F. 神圣结界金盾 ( Sanctuary Shield )
        let sG = this.make.graphics({ x: 0, y: 0, add: false });
        sG.lineStyle(3.5, 0xe5a93c, 0.85); 
        sG.strokeCircle(70, 70, 68); 
        sG.lineStyle(1.5, 0x8a0000, 0.45); 
        sG.strokeCircle(70, 70, 56); 
        sG.generateTexture('shield', 140, 140);

        // G. 溅血碎肉粒子
        let ptG = this.make.graphics({ x: 0, y: 0, add: false });
        ptG.fillStyle(0x8a0000, 1); 
        ptG.fillRect(0, 0, 6, 6);
        ptG.generateTexture('particle', 6, 6);

        // H. 碎骨灰烬粒子
        if (!createTextureFromAtlas('fireParticle', 'blood_flame_vfx', 512, 680, 32, 32)) {
            let fptG = this.make.graphics({ x: 0, y: 0, add: false });
            fptG.fillStyle(0xcfc5b3, 1); 
            fptG.fillRect(0, 0, 4, 4);
            fptG.generateTexture('fireParticle', 4, 4);
        }

        // I. 哥特十字粒子 '†'
        let zeroCanvas = document.createElement('canvas');
        zeroCanvas.width = 16;
        zeroCanvas.height = 16;
        let zeroCtx = zeroCanvas.getContext('2d');
        zeroCtx.fillStyle = '#8a0000';
        zeroCtx.font = 'bold 14px Arial';
        zeroCtx.fillText('†', 4, 13);
        this.textures.addCanvas('particle_0', zeroCanvas);

        // J. 哥特骷髅粒子 '☠'
        let oneCanvas = document.createElement('canvas');
        oneCanvas.width = 16;
        oneCanvas.height = 16;
        let oneCtx = oneCanvas.getContext('2d');
        oneCtx.fillStyle = '#8a0000';
        oneCtx.font = 'bold 12px Arial';
        oneCtx.fillText('☠', 2, 12);
        this.textures.addCanvas('particle_1', oneCanvas);

        // K1. 驱魔骑士：大骑士黄金神圣重剑 (weapon_exorcist, 24x48)
        let wEx = this.make.graphics({ x: 0, y: 0, add: false });
        wEx.fillStyle(0xe5a93c, 1);
        wEx.fillRect(9, 6, 6, 26); // 剑身
        wEx.fillStyle(0xffffff, 0.9);
        wEx.fillRect(11, 6, 2, 26); // 剑脊高光
        wEx.fillStyle(0xd4af37, 1);
        wEx.fillRect(5, 32, 14, 4); // 剑格/护手
        wEx.fillStyle(0x696969, 1);
        wEx.fillRect(11, 36, 2, 8); // 剑柄
        wEx.fillStyle(0xd4af37, 1);
        wEx.fillCircle(12, 45, 3); // 剑首配重
        wEx.generateTexture('weapon_exorcist', 24, 48);

        // K2. 血焰修女：猩红熔岩圣火杖 (weapon_nun, 24x48)
        let wNun = this.make.graphics({ x: 0, y: 0, add: false });
        wNun.fillStyle(0x5c4033, 1);
        wNun.fillRect(11, 16, 2, 28); // 杖柄
        wNun.fillStyle(0x8a0000, 1);
        wNun.fillCircle(12, 10, 7); // 香炉/法球头
        wNun.lineStyle(1.5, 0xff3300, 0.95);
        wNun.strokeCircle(12, 10, 7);
        wNun.fillStyle(0xffa500, 0.9);
        wNun.fillCircle(12, 10, 4); // 内部血焰核心
        wNun.generateTexture('weapon_nun', 24, 48);

        // K3. 死灵学徒：幽蓝符文法典 (weapon_necromancer, 32x32)
        let wNec = this.make.graphics({ x: 0, y: 0, add: false });
        wNec.fillStyle(0x0f172a, 1);
        wNec.fillRect(4, 4, 24, 24); // 封面底板
        wNec.fillStyle(0x00ffff, 0.85);
        wNec.fillRect(6, 6, 20, 20); // 纸页内页
        wNec.fillStyle(0x1e293b, 1);
        wNec.fillRect(15, 4, 2, 24); // 书脊缝
        wNec.fillStyle(0x008080, 0.95);
        wNec.fillRect(9, 10, 4, 8); // 左页符文装饰
        wNec.fillRect(19, 10, 4, 8); // 右页符文装饰
        wNec.lineStyle(1.5, 0x00ffff, 0.8);
        wNec.strokeRect(4, 4, 24, 24);
        wNec.generateTexture('weapon_necromancer', 32, 32);

        // K4. 影刃猎手：紫色影穿刃 (weapon_hunter, 16x32)
        let wHun = this.make.graphics({ x: 0, y: 0, add: false });
        wHun.fillStyle(0x9d00ff, 1);
        wHun.beginPath();
        wHun.moveTo(8, 2);  // 刀尖
        wHun.lineTo(13, 14);
        wHun.lineTo(9, 24); // 刀柄连接点
        wHun.lineTo(7, 24);
        wHun.lineTo(3, 14);
        wHun.closePath();
        wHun.fillPath();
        wHun.fillStyle(0xffffff, 0.85);
        wHun.beginPath();
        wHun.moveTo(8, 3);
        wHun.lineTo(11, 14);
        wHun.lineTo(8, 10);
        wHun.closePath();
        wHun.fillPath(); // 高亮锋刃
        wHun.fillStyle(0x2d3748, 1);
        wHun.fillRect(7, 24, 2, 6); // 匕首握柄
        wHun.fillStyle(0x9d00ff, 1);
        wHun.fillCircle(8, 30, 2.5); // 匕首环
        wHun.generateTexture('weapon_hunter', 16, 32);

        // L. Procedural ground grid texture (ground_grid, 128x128) - Gothic Volcanic Stone Tiles
        let ggG = this.make.graphics({ x: 0, y: 0, add: false });
        
        // Transparent background, only draw details
        
        // 1. Slate tile border lines (dark joints)
        ggG.lineStyle(2.0, 0x060303, 0.95);
        ggG.strokeRect(0, 0, 128, 128);
        
        // 2. Beveled edges for stone depth
        ggG.lineStyle(1.0, 0x2d1712, 0.85); // Slate brown bevel highlights
        ggG.beginPath();
        ggG.moveTo(1, 127);
        ggG.lineTo(1, 1);
        ggG.lineTo(127, 1);
        ggG.strokePath();

        ggG.lineStyle(1.0, 0x040202, 0.95); // Inner shadow bevel
        ggG.beginPath();
        ggG.moveTo(2, 126);
        ggG.lineTo(126, 126);
        ggG.lineTo(126, 2);
        ggG.strokePath();

        // 3. Procedural volcanic cracks (Magma glowing underneath)
        ggG.lineStyle(1.5, 0xff2a00, 0.65); // Outer glow of the magma cracks
        ggG.beginPath();
        // Crack cluster 1
        ggG.moveTo(12, 18);
        ggG.lineTo(24, 30);
        ggG.lineTo(18, 48);
        ggG.lineTo(32, 60);
        // Crack cluster 2
        ggG.moveTo(112, 22);
        ggG.lineTo(95, 38);
        ggG.lineTo(102, 54);
        ggG.lineTo(84, 76);
        // Crack cluster 3
        ggG.moveTo(48, 126);
        ggG.lineTo(56, 110);
        ggG.lineTo(42, 95);
        ggG.lineTo(60, 80);
        ggG.strokePath();

        // Hot glowing cores inside cracks
        ggG.lineStyle(1.0, 0xffaa00, 0.85);
        ggG.beginPath();
        ggG.moveTo(12, 18);
        ggG.lineTo(24, 30);
        ggG.lineTo(18, 48);
        ggG.lineTo(32, 60);
        ggG.moveTo(112, 22);
        ggG.lineTo(95, 38);
        ggG.lineTo(102, 54);
        ggG.lineTo(84, 76);
        ggG.strokePath();

        // 4. Gothic corner markings
        ggG.fillStyle(0x6b1a15, 0.45);
        ggG.fillRect(4, 4, 8, 8);
        ggG.fillRect(116, 4, 8, 8);
        ggG.fillRect(4, 116, 8, 8);
        ggG.fillRect(116, 116, 8, 8);
        
        ggG.generateTexture('ground_grid', 128, 128);
    }
}

export default BootScene;
