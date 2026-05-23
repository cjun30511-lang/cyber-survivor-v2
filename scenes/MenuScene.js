import { GameState } from '../state/GameState.js';
import { SoundSynth } from '../utils/SoundSynth.js';
import { EquipmentConfig } from '../config/EquipmentConfig.js';
import { RolePresentationConfig } from '../config/RolePresentationConfig.js';

const MENU_ASSET_SLOTS = {
    heroBg: 'menu_hero_bg',
    nunKeyart: 'menu_nun_keyart',
    logoPlate: 'menu_logo_plate',
    ctaFrame: 'menu_cta_frame'
};

export class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
        this.activeTab = 'roles';
        this.tabButtons = {};
        this.roleElements = [];
        this.talentElements = [];
        this.equipmentElements = [];
        this.talentTextButtons = [];
        this.isLeavingScene = false;
    }

    create() {
        this.isLeavingScene = false;
        GameState.endSceneTransition();
        GameState.meta.selectedRole = 'nun';
        GameState.saveMeta();

        if (window.PlatformAdapter) {
            window.PlatformAdapter.showBanner();
            window.PlatformAdapter.trackEvent('enter_battle', { stage: 'Lobby' });
        }

        this.drawBackground();
        this.drawHeader();
        this.drawTabs();
        this.drawContentShell();
        this.drawStartButtonShell();

        this.renderRolesTab();
        this.renderTalentsTab();
        this.renderEquipmentTab();
        this.switchTab('roles');
        this.updateUI();
    }

    drawBackground() {
        const w = 720;
        const h = 1280;

        this.add.rectangle(w / 2, h / 2, w, h, 0x09070a).setDepth(0);
        if (this.hasMenuAsset(MENU_ASSET_SLOTS.heroBg)) {
            this.add.image(w / 2, h / 2, MENU_ASSET_SLOTS.heroBg).setDisplaySize(w, h).setDepth(0.1);
        } else {
            this.add.tileSprite(w / 2, h / 2, w, h, 'lava_tile').setTint(0xc7d0db).setAlpha(0.15).setDepth(0.1);
            this.add.tileSprite(w / 2, h / 2, w, h, 'ground_overlay').setTint(0xf1eee7).setAlpha(0.08).setDepth(0.2);
        }

        const vignette = this.add.graphics().setDepth(0.3);
        vignette.fillGradientStyle(0x060507, 0x060507, 0x151117, 0x151117, 0.9, 0.9, 0.55, 0.55);
        vignette.fillRect(0, 0, w, h);

        const chapel = this.add.graphics().setDepth(0.4);
        chapel.fillStyle(0x0e0a0d, 0.66);
        chapel.fillRect(0, 0, 90, h);
        chapel.fillRect(w - 90, 0, 90, h);
        chapel.lineStyle(1, 0xeee4d3, 0.08);
        for (let x = 120; x <= 600; x += 120) {
            chapel.lineBetween(x, 118, x - 60, 680);
            chapel.lineBetween(x, 118, x + 60, 680);
        }

        const mist = this.add.graphics().setDepth(0.5);
        mist.fillStyle(0xf3eee4, 0.04);
        mist.fillEllipse(360, 228, 520, 170);
        mist.fillStyle(0xffffff, 0.035);
        mist.fillEllipse(360, 610, 610, 420);
        mist.fillStyle(0xb21f24, 0.055);
        mist.fillEllipse(360, 1010, 600, 230);
    }

    drawHeader() {
        const w = 720;

        const topBar = this.add.graphics().setDepth(1);
        topBar.fillStyle(0x100d11, 0.82);
        topBar.fillRoundedRect(24, 24, 672, 74, 24);
        topBar.lineStyle(1, 0xf1e8d9, 0.16);
        topBar.strokeRoundedRect(24, 24, 672, 74, 24);

        this.topScoreText = this.add.text(52, 61, '', {
            fontFamily: 'Cinzel, serif',
            fontSize: '16px',
            color: '#d7d0c4',
            fontWeight: 'bold'
        }).setOrigin(0, 0.5).setDepth(2);

        this.topGoldText = this.add.text(668, 61, '', {
            fontFamily: 'Cinzel, serif',
            fontSize: '16px',
            color: '#efe1b6',
            fontWeight: 'bold'
        }).setOrigin(1, 0.5).setDepth(2);

        if (this.hasMenuAsset(MENU_ASSET_SLOTS.logoPlate)) {
            this.add.image(w / 2, 191, MENU_ASSET_SLOTS.logoPlate).setDisplaySize(616, 146).setDepth(1.2);
        }

        const crest = this.add.graphics().setDepth(1.25);
        crest.fillStyle(0x120d10, 0.96);
        crest.fillRoundedRect(52, 118, 616, 146, 32);
        crest.fillStyle(0xf2eee5, 0.04);
        crest.fillRoundedRect(70, 136, 580, 42, 20);
        crest.lineStyle(2.5, 0xe7decf, 0.36);
        crest.strokeRoundedRect(52, 118, 616, 146, 32);
        crest.lineStyle(1.2, 0x6f6365, 0.45);
        crest.strokeRoundedRect(68, 134, 584, 112, 24);
        crest.lineStyle(1, 0xfaf8f1, 0.1);
        crest.lineBetween(130, 192, 590, 192);

        this.add.text(w / 2, 160, '骨 白 修 会', {
            fontFamily: 'Cinzel, serif',
            fontSize: '18px',
            color: '#cbc2b2',
            letterSpacing: 10
        }).setOrigin(0.5).setDepth(2);

        this.add.text(w / 2, 205, '圣裁修女', {
            fontFamily: 'Cinzel, serif',
            fontSize: '42px',
            color: '#fbf7ef',
            fontWeight: 'bold',
            stroke: '#161015',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(2);

        this.add.text(w / 2, 239, 'BONE-WHITE SANCTUM', {
            fontFamily: 'Spectral, serif',
            fontSize: '14px',
            color: '#a99d96',
            letterSpacing: 6,
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(2);
    }

    drawTabs() {
        const labels = [
            ['roles', '主视觉'],
            ['talents', '成长'],
            ['equipment', '军械']
        ];

        this.tabUnderline = this.add.graphics().setDepth(3);

        labels.forEach(([key, label], index) => {
            const x = 170 + index * 190;
            const bg = this.add.graphics().setDepth(2.5);
            const text = this.add.text(x, 309, label, {
                fontFamily: 'Cinzel, serif',
                fontSize: '20px',
                color: '#7f7672',
                fontWeight: 'bold'
            }).setOrigin(0.5).setDepth(3);
            const hit = this.add.zone(x, 309, 150, 48).setOrigin(0.5).setDepth(4).setInteractive({ useHandCursor: true });

            this.drawTabButton(bg, x, false);
            hit.on('pointerdown', () => {
                SoundSynth.play('coin');
                this.switchTab(key);
            });

            this.tabButtons[key] = { bg, text, hit, x };
        });
    }

    drawTabButton(graphics, x, active) {
        graphics.clear();
        graphics.fillStyle(active ? 0xebe3d5 : 0x181318, active ? 0.16 : 0.75);
        graphics.fillRoundedRect(x - 70, 284, 140, 48, 18);
        graphics.lineStyle(active ? 1.5 : 1, active ? 0xf5eee4 : 0x584f50, active ? 0.55 : 0.35);
        graphics.strokeRoundedRect(x - 70, 284, 140, 48, 18);
    }

    drawContentShell() {
        this.contentShell = this.add.graphics().setDepth(1.1);
        this.contentShell.fillStyle(0x0c080b, 0.82);
        this.contentShell.fillRoundedRect(32, 354, 656, 708, 16);
        this.contentShell.fillStyle(0x171016, 0.92);
        this.contentShell.fillRoundedRect(52, 374, 616, 668, 12);
        this.contentShell.lineStyle(1, 0xf1e7d8, 0.16);
        this.contentShell.strokeRoundedRect(32, 354, 656, 708, 16);
        this.contentShell.lineStyle(1, 0x6b1018, 0.22);
        this.contentShell.lineBetween(88, 394, 632, 394);
        this.contentShell.lineBetween(88, 1012, 632, 1012);
    }

    drawStartButtonShell() {
        const w = 720;

        this.startButtonBg = this.add.graphics().setDepth(2);
        this.drawStartButton(false);

        const startBtnText = this.add.text(w / 2, 1103, '开始净化', {
            fontFamily: 'Cinzel, serif',
            fontSize: '34px',
            color: '#fffdf8',
            fontWeight: 'bold',
            stroke: '#160f13',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(3);

        const startSubText = this.add.text(w / 2, 1140, 'Purify the breach with the bone-white covenant', {
            fontFamily: 'Spectral, serif',
            fontSize: '13px',
            color: '#e6dbc6',
            fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(3);

        this.tweens.add({
            targets: [startBtnText, startSubText],
            alpha: 0.82,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const startHitZone = this.add.zone(w / 2, 1120, 472, 108).setOrigin(0.5).setDepth(4).setInteractive({ useHandCursor: true });
        startHitZone.on('pointerover', () => {
            this.drawStartButton(true);
            startBtnText.setScale(1.02);
            startSubText.setColor('#fff7ea');
            SoundSynth.play('coin');
        });
        startHitZone.on('pointerout', () => {
            this.drawStartButton(false);
            startBtnText.setScale(1);
            startSubText.setColor('#e6dbc6');
        });
        startHitZone.on('pointerdown', () => {
            SoundSynth.play('laser');
            if (window.PlatformAdapter) {
                window.PlatformAdapter.hideBanner();
            }
            this.requestSceneChange('BattleScene', () => {
                GameState.startRun();
            });
        });
    }

    drawStartButton(hover) {
        const g = this.startButtonBg;
        g.clear();

        const x = 124;
        const y = 1068;
        const width = 472;
        const height = 104;

        if (this.hasMenuAsset(MENU_ASSET_SLOTS.ctaFrame)) {
            if (!this.ctaFrameImage) {
                this.ctaFrameImage = this.add.image(360, 1120, MENU_ASSET_SLOTS.ctaFrame).setDisplaySize(width, height).setDepth(2.05);
            }
            this.ctaFrameImage.setTint(hover ? 0xffffff : 0xf1e8d8).setAlpha(hover ? 1 : 0.92);
            return;
        }

        g.fillStyle(hover ? 0xf5ede0 : 0xefe5d7, hover ? 0.14 : 0.08);
        g.fillRoundedRect(x - 8, y - 8, width + 16, height + 16, 34);
        g.fillStyle(hover ? 0x1f171c : 0x151015, 0.98);
        g.fillRoundedRect(x, y, width, height, 28);
        g.fillStyle(hover ? 0x7f1017 : 0x590d13, 0.9);
        g.fillRoundedRect(x + 10, y + 10, width - 20, 34, 18);
        g.fillStyle(hover ? 0xf2eee8 : 0xe9dfd1, hover ? 0.2 : 0.12);
        g.fillRoundedRect(x + 10, y + 48, width - 20, 46, 18);
        g.lineStyle(2, hover ? 0xffffff : 0xf3e8d8, hover ? 0.72 : 0.48);
        g.strokeRoundedRect(x, y, width, height, 28);
        g.lineStyle(1, 0x6b5f5e, 0.48);
        g.strokeRoundedRect(x + 8, y + 8, width - 16, height - 16, 22);
    }

    switchTab(tabName) {
        this.activeTab = tabName;

        Object.entries(this.tabButtons).forEach(([key, button]) => {
            const active = key === tabName;
            this.drawTabButton(button.bg, button.x, active);
            button.text.setColor(active ? '#f4ede3' : '#7f7672');
            button.text.setScale(active ? 1.05 : 1);
        });

        const targetX = this.tabButtons[tabName].x;
        if (this.currentUnderlineX === undefined) {
            this.currentUnderlineX = targetX;
        }

        this.tweens.killTweensOf(this);
        this.tweens.add({
            targets: this,
            currentUnderlineX: targetX,
            duration: 220,
            ease: 'Cubic.easeOut',
            onUpdate: () => {
                this.tabUnderline.clear();
                this.tabUnderline.lineStyle(2, 0xf3ede4, 0.9);
                this.tabUnderline.lineBetween(this.currentUnderlineX - 42, 340, this.currentUnderlineX + 42, 340);
            }
        });

        this.roleElements.forEach((el) => {
            if (el.setVisible) el.setVisible(tabName === 'roles');
            if (el.input) el.input.enabled = (tabName === 'roles');
        });
        this.talentElements.forEach((el) => {
            if (el.setVisible) el.setVisible(tabName === 'talents');
            if (el.input) el.input.enabled = (tabName === 'talents');
        });
        this.equipmentElements.forEach((el) => {
            if (el.setVisible) el.setVisible(tabName === 'equipment');
            if (el.input) el.input.enabled = (tabName === 'equipment');
        });

        if (tabName === 'roles') this.renderRolesTab();
        if (tabName === 'talents') this.renderTalentsTab();
        if (tabName === 'equipment') this.renderEquipmentTab();
    }

    renderRolesTab() {
        this.roleElements.forEach((el) => el.destroy());
        this.roleElements = [];
        if (this.activeTab !== 'roles') return;

        const role = RolePresentationConfig.roles.nun;
        const panel = this.add.graphics().setDepth(2.2);
        panel.fillStyle(0x080507, 0.72);
        panel.fillRoundedRect(64, 392, 592, 596, 12);
        panel.fillStyle(0xf4f0e7, 0.045);
        panel.fillRoundedRect(84, 412, 552, 64, 8);
        panel.fillStyle(0x020102, 0.72);
        panel.fillRoundedRect(82, 500, 556, 288, 8);
        panel.fillStyle(0x120d12, 0.92);
        panel.fillRoundedRect(84, 802, 552, 170, 8);
        panel.lineStyle(1.2, 0xf0e7d7, 0.14);
        panel.strokeRoundedRect(64, 392, 592, 596, 12);
        this.roleElements.push(panel);

        const rune = this.add.graphics().setDepth(2.3);
        rune.lineStyle(1.5, 0xf0e7d7, 0.18);
        rune.strokeCircle(360, 642, 138);
        rune.strokeCircle(360, 642, 190);
        rune.lineStyle(1, 0xbdb1a0, 0.11);
        rune.lineBetween(186, 642, 534, 642);
        rune.lineBetween(360, 474, 360, 792);
        rune.lineStyle(2, 0x761018, 0.28);
        rune.lineBetween(220, 780, 500, 780);
        this.roleElements.push(rune);

        this.addRoleText(108, 428, 'CURRENT VESSEL', '11px', '#9f958c', 0);
        this.addRoleText(108, 455, '圣裁修女', '28px', '#faf6ef', 0);
        this.addRoleText(612, 452, '已锁定', '16px', '#f2e7d2', 1, 0.5);

        this.previewBacklight = this.add.graphics().setDepth(2.5);
        this.roleElements.push(this.previewBacklight);

        const keyartTexture = this.hasMenuAsset(MENU_ASSET_SLOTS.nunKeyart) ? MENU_ASSET_SLOTS.nunKeyart : 'nun_portrait';
        this.previewSprite = this.add.sprite(360, 620, keyartTexture).setDepth(3);
        if (keyartTexture === MENU_ASSET_SLOTS.nunKeyart) {
            this.previewSprite.setDisplaySize(400, 400);
        } else {
            this.previewSprite.setScale(0.39);
        }
        this.roleElements.push(this.previewSprite);

        const previewTween = {
            targets: this.previewSprite,
            y: 612,
            duration: 2200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        };
        if (keyartTexture === MENU_ASSET_SLOTS.nunKeyart) {
            previewTween.displayWidth = 410;
            previewTween.displayHeight = 410;
        } else {
            previewTween.scaleX = 0.4;
            previewTween.scaleY = 0.4;
        }
        this.tweens.add(previewTween);

        this.addRoleText(360, 820, '骨白修会审判官', '32px', '#fdf8f2', 0.5);
        this.addRoleText(360, 854, role.title, '14px', '#d8cec0', 0.5);

        const blurb = '远程圣焰法球压制，优先完成单角色商业样板。';
        this.addRoleText(360, 890, blurb, '13px', '#bdb4ab', 0.5, 0.5, { align: 'center', lineSpacing: 7, wordWrap: { width: 460 } });

        const stats = [
            ['生命', `${role.baseHpMax}`, '#f7b6b6'],
            ['伤害', `x${role.damageMultiplier.toFixed(2)}`, '#efe0c2'],
            ['速度', `${role.baseSpeed}`, '#dbe7f7']
        ];
        stats.forEach(([label, value, color], index) => {
            const x = 104 + index * 184;
            const card = this.add.graphics().setDepth(2.4);
            card.fillStyle(0x171218, 0.95);
            card.fillRoundedRect(x, 924, 166, 58, 8);
            card.fillStyle(0xf5f1ea, 0.035);
            card.fillRoundedRect(x + 8, 932, 150, 16, 8);
            card.lineStyle(1, 0xf0e7d7, 0.12);
            card.strokeRoundedRect(x, 924, 166, 58, 8);
            this.roleElements.push(card);

            this.addRoleText(x + 20, 941, label, '12px', '#a89e96', 0);
            this.addRoleText(x + 20, 969, value, '19px', color, 0);
        });
    }

    addRoleText(x, y, text, fontSize, color, originX = 0.5, originY = 0.5, extra = {}) {
        const label = this.add.text(x, y, text, {
            fontFamily: extra.fontFamily || 'Spectral, serif',
            fontSize,
            color,
            fontStyle: extra.fontStyle,
            fontWeight: extra.fontWeight || (parseInt(fontSize, 10) >= 20 ? 'bold' : 'normal'),
            align: extra.align,
            lineSpacing: extra.lineSpacing,
            wordWrap: extra.wordWrap
        }).setOrigin(originX, originY).setDepth(3);
        this.roleElements.push(label);
        return label;
    }

    hasMenuAsset(textureKey) {
        return this.textures.exists(textureKey) && this.textures.get(textureKey).key !== '__MISSING';
    }

    renderTalentsTab() {
        this.talentTextButtons = [];
        this.talentElements.forEach((el) => el.destroy());
        this.talentElements = [];
        if (this.activeTab !== 'talents') return;

        const title = this.add.text(360, 418, 'Bone-white growth route', {
            fontFamily: 'Cinzel, serif',
            fontSize: '28px',
            color: '#f5efe6',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(2.5);
        this.talentElements.push(title);

        const subtitle = this.add.text(360, 456, '只保留修女的三条永久成长线，菜单逻辑收缩为可实机验证的最小闭环。', {
            fontFamily: 'Spectral, serif',
            fontSize: '15px',
            color: '#b8afa7',
            align: 'center',
            wordWrap: { width: 520 }
        }).setOrigin(0.5).setDepth(2.5);
        this.talentElements.push(subtitle);

        this.createTalentButton('damage', '审判火力', '圣焰法球伤害每级 +10%', 584);
        this.createTalentButton('maxHp', '骨白庇护', '生命上限每级 +10', 736);
        this.createTalentButton('speed', '修会疾行', '移动速度每级 +5%', 888);
    }

    createTalentButton(talentId, title, desc, y) {
        const cx = 360;
        const width = 540;
        const height = 118;

        const bg = this.add.graphics().setDepth(2.4);
        const drawCard = (hover) => {
            bg.clear();
            bg.fillStyle(hover ? 0x1f171c : 0x151117, 0.97);
            bg.fillRoundedRect(cx - width / 2, y - height / 2, width, height, 22);
            bg.fillStyle(hover ? 0xf1ebe0 : 0xf1ebe0, hover ? 0.08 : 0.04);
            bg.fillRoundedRect(cx - width / 2 + 10, y - height / 2 + 10, width - 20, 28, 12);
            bg.lineStyle(1.2, hover ? 0xf8f4ec : 0xf0e7d7, hover ? 0.3 : 0.15);
            bg.strokeRoundedRect(cx - width / 2, y - height / 2, width, height, 22);
        };
        drawCard(false);
        this.talentElements.push(bg);

        const titleLabel = this.add.text(cx - 228, y - 26, title, {
            fontFamily: 'Cinzel, serif',
            fontSize: '24px',
            color: '#fbf7ef',
            fontWeight: 'bold'
        }).setDepth(3);
        const descLabel = this.add.text(cx - 228, y + 10, desc, {
            fontFamily: 'Spectral, serif',
            fontSize: '14px',
            color: '#b5aca2'
        }).setDepth(3);
        const costLabel = this.add.text(cx + 226, y + 22, '', {
            fontFamily: 'Cinzel, serif',
            fontSize: '16px',
            color: '#efe1b6',
            fontWeight: 'bold'
        }).setOrigin(1, 0.5).setDepth(3);

        this.talentElements.push(titleLabel, descLabel, costLabel);
        this.talentTextButtons.push({ talentId, titlePrefix: title, textLabel: titleLabel, costLabel });

        const hit = this.add.zone(cx, y, width, height).setOrigin(0.5).setDepth(4).setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => {
            drawCard(true);
            titleLabel.setScale(1.02);
            SoundSynth.play('coin');
        });
        hit.on('pointerout', () => {
            drawCard(false);
            titleLabel.setScale(1);
        });
        hit.on('pointerdown', () => {
            const cost = this.calculateTalentCost(talentId);
            const success = GameState.upgradeTalent(talentId, cost);
            if (success) {
                SoundSynth.play('laser');
                this.cameras.main.flash(90, 245, 239, 232, 0.2);
                this.updateUI();
            } else {
                this.cameras.main.flash(90, 150, 36, 44, 0.22);
            }
        });

        this.talentElements.push(hit);
    }

    renderEquipmentTab() {
        this.equipmentElements.forEach((el) => el.destroy());
        this.equipmentElements = [];
        if (this.activeTab !== 'equipment') return;

        const inventory = GameState.meta.inventory || [];
        const slots = ['WEAPON', 'AMULET', 'BOOTS', 'RING'];
        const slotNames = {
            WEAPON: '主武器',
            AMULET: '护符',
            BOOTS: '战靴',
            RING: '戒指'
        };

        const title = this.add.text(360, 418, 'Sanctum loadout', {
            fontFamily: 'Cinzel, serif',
            fontSize: '28px',
            color: '#f5efe6',
            fontWeight: 'bold'
        }).setOrigin(0.5).setDepth(2.5);
        const subtitle = this.add.text(360, 456, '修女路线只展示当前可穿戴军械，避免把菜单做成冗长仓库。', {
            fontFamily: 'Spectral, serif',
            fontSize: '15px',
            color: '#b8afa7',
            align: 'center',
            wordWrap: { width: 520 }
        }).setOrigin(0.5).setDepth(2.5);
        this.equipmentElements.push(title, subtitle);

        slots.forEach((slotKey, index) => {
            const x = 116 + index * 148;
            const equippedInstId = GameState.meta.equipped[slotKey];
            const equippedInst = inventory.find((item) => item.instanceId === equippedInstId);
            const cfg = equippedInst ? EquipmentConfig.items[equippedInst.id] : null;

            const card = this.add.graphics().setDepth(2.4);
            card.fillStyle(0x161118, 0.96);
            card.fillRoundedRect(x, 534, 124, 136, 22);
            card.fillStyle(cfg ? 0xf5eee4 : 0xf5eee4, cfg ? 0.08 : 0.03);
            card.fillRoundedRect(x + 10, 544, 104, 34, 14);
            card.lineStyle(1, 0xf0e7d7, cfg ? 0.2 : 0.1);
            card.strokeRoundedRect(x, 534, 124, 136, 22);
            this.equipmentElements.push(card);

            const slotLabel = this.add.text(x + 62, 560, slotNames[slotKey], {
                fontFamily: 'Cinzel, serif',
                fontSize: '15px',
                color: '#d3cbc0',
                fontWeight: 'bold'
            }).setOrigin(0.5).setDepth(3);
            const itemLabel = this.add.text(x + 62, 616, cfg ? cfg.name : '未装备', {
                fontFamily: 'Spectral, serif',
                fontSize: '14px',
                color: cfg ? '#fbf7ef' : '#8f8780',
                align: 'center',
                wordWrap: { width: 88 }
            }).setOrigin(0.5).setDepth(3);
            const levelLabel = this.add.text(x + 62, 650, cfg ? `Lv.${equippedInst.level}` : '点击下方穿戴', {
                fontFamily: 'Spectral, serif',
                fontSize: '12px',
                color: cfg ? '#e8dcc4' : '#7d756f'
            }).setOrigin(0.5).setDepth(3);
            this.equipmentElements.push(slotLabel, itemLabel, levelLabel);
        });

        const shownItems = inventory.slice(0, 4);
        shownItems.forEach((inst, index) => {
            const y = 752 + index * 86;
            const cfg = EquipmentConfig.items[inst.id];
            if (!cfg) return;
            const isEquipped = Object.values(GameState.meta.equipped).includes(inst.instanceId);

            const bg = this.add.graphics().setDepth(2.4);
            const drawRow = (hover) => {
                bg.clear();
                bg.fillStyle(hover ? 0x1e171d : 0x151117, 0.97);
                bg.fillRoundedRect(80, y - 34, 560, 68, 20);
                bg.lineStyle(1, hover ? 0xf5eee4 : 0xf0e7d7, hover ? 0.28 : 0.12);
                bg.strokeRoundedRect(80, y - 34, 560, 68, 20);
            };
            drawRow(false);
            this.equipmentElements.push(bg);

            const statParts = [];
            if (cfg.baseMaxHp) statParts.push(`生命 +${cfg.baseMaxHp + (inst.level - 1) * (cfg.levelUpHp || 0)}`);
            if (cfg.baseDamageMultiplier) statParts.push(`攻击 +${Math.round((cfg.baseDamageMultiplier + (inst.level - 1) * (cfg.levelUpDamage || 0)) * 100)}%`);
            if (cfg.baseSpeedMultiplier) statParts.push(`移速 +${Math.round((cfg.baseSpeedMultiplier + (inst.level - 1) * (cfg.levelUpSpeed || 0)) * 100)}%`);

            const nameLabel = this.add.text(108, y - 10, `${cfg.name}  Lv.${inst.level}`, {
                fontFamily: 'Cinzel, serif',
                fontSize: '18px',
                color: '#fbf7ef',
                fontWeight: 'bold'
            }).setDepth(3);
            const statLabel = this.add.text(108, y + 14, statParts.join('  '), {
                fontFamily: 'Spectral, serif',
                fontSize: '12px',
                color: '#aca39b'
            }).setDepth(3);
            const actionLabel = this.add.text(610, y, isEquipped ? '已穿戴' : '点击装备', {
                fontFamily: 'Spectral, serif',
                fontSize: '13px',
                color: isEquipped ? '#efe1b6' : '#d3cbc0'
            }).setOrigin(1, 0.5).setDepth(3);
            this.equipmentElements.push(nameLabel, statLabel, actionLabel);

            if (!isEquipped) {
                const hit = this.add.zone(360, y, 560, 68).setOrigin(0.5).setDepth(4).setInteractive({ useHandCursor: true });
                hit.on('pointerover', () => {
                    drawRow(true);
                    SoundSynth.play('coin');
                });
                hit.on('pointerout', () => drawRow(false));
                hit.on('pointerdown', () => {
                    if (window.EquipmentService) {
                        window.EquipmentService.equipItem(inst.instanceId);
                        SoundSynth.play('laser');
                        this.renderEquipmentTab();
                        this.updateUI();
                    }
                });
                this.equipmentElements.push(hit);
            }
        });
    }

    calculateTalentCost(talentId) {
        const level = GameState.meta.talents[talentId] || 0;
        return 10 + level * 20;
    }

    updateUI() {
        const meta = GameState.meta;
        this.topScoreText?.setText(`历史最高 ${meta.highScore}`);
        this.topGoldText?.setText(`金币 ${meta.gold}`);

        this.talentTextButtons.forEach((button) => {
            const level = meta.talents[button.talentId] || 0;
            const cost = this.calculateTalentCost(button.talentId);
            button.textLabel.setText(`${button.titlePrefix}  Lv.${level}`);
            button.costLabel.setText(`升级 ${cost} 金币`);
            button.costLabel.setColor(meta.gold >= cost ? '#efe1b6' : '#7d756f');
        });
    }

    update(time) {
        if (this.activeTab !== 'roles' || !this.previewSprite?.active) return;

        const px = this.previewSprite.x;
        const py = this.previewSprite.y;
        const pulse = 1 + Math.sin(time * 0.004) * 0.08;

        this.previewBacklight.clear();
        this.previewBacklight.fillStyle(0xf0e7d7, 0.06);
        this.previewBacklight.fillEllipse(px, py - 16, 258 * pulse, 292 * pulse);
        this.previewBacklight.fillStyle(0xffffff, 0.05);
        this.previewBacklight.fillEllipse(px, py - 16, 164 * pulse, 184 * pulse);
    }

    requestSceneChange(sceneKey, beforeStart = null, data = undefined) {
        if (this.isLeavingScene) return;
        if (!GameState.beginSceneTransition(sceneKey)) return;
        this.isLeavingScene = true;

        try {
            if (beforeStart) beforeStart();
            this.scene.start(sceneKey, data);
        } catch (error) {
            this.isLeavingScene = false;
            GameState.endSceneTransition(sceneKey);
            throw error;
        }
    }
}

export default MenuScene;
