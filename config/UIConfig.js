/**
 * UIConfig.js - 720x1280 黄金手机竖屏下的 HUD 绝对坐标和安全区配置
 */
export const UIConfig = {
    // 1. 顶部避让刘海屏的经验条配置
    xpBar: {
        x: 60,
        y: 70,
        width: 600,
        height: 14,
        color: 0x00ffff,        // 幽蓝赛博流光
        bgColor: 0x151015,
        borderColor: 0xe5a93c   // 黄金拉花包边
    },

    // 2. 状态标签坐标 (阶位、时长、金币、击杀数、积分) - 完全对称双排布局
    labels: {
        levelText: { x: 60, y: 105 },
        coinText: { x: 200, y: 105 },
        timeText: { x: 360, y: 105 }, // 居中
        killText: { x: 660, y: 105 }  // 右侧，靠右对齐
    },

    // 3. 底部虚拟触控控制区配置 (避让苹果/安卓底部系统返回条)
    joystick: {
        circleRadius: 75,
        stickRadius: 35,
        alpha: 0.75,
        // 动态弹出的点击热区范围 (全屏下半部分)
        activeZoneY: 600
    },

    // 4. 底部金属魔物雕花生命球配置 (Y=1170, 避让底部返回栏)
    healthGlobe: {
        x: 360,                 // 底部水平居中
        y: 1170,
        radius: 65,             // 超大金属生命球
        fluidColor: 0x8a0000,   // 暗红血液
        borderColor: 0xe5a93c,  // 立体金环
        shadowColor: 0x000000
    },

    // 5. 底部右侧冲刺大按钮配置
    dashButton: {
        x: 580,                 // 右下角
        y: 1170,
        radius: 48,
        color: 0x8a0000,
        borderColor: 0xe5a93c,
        glowColor: 0xff1a1a
    },

    mobileSafeArea: {
        bottomInset: 188,
        sideInset: 42,
        minBottomInset: 132
    },

    // 6. 全屏半透明黑色蒙版及弹窗中心点配置
    popup: {
        overlayColor: 0x000000,
        overlayAlpha: 0.75,
        centerX: 360,
        centerY: 640
    }
};

UIConfig.getMobileControlLayout = function getMobileControlLayout(width = 720, height = 1280) {
    const safeBottom = Math.max(UIConfig.mobileSafeArea.minBottomInset, UIConfig.mobileSafeArea.bottomInset);
    const leftX = UIConfig.mobileSafeArea.sideInset + UIConfig.joystick.circleRadius + 18;
    const rightX = width - UIConfig.mobileSafeArea.sideInset - UIConfig.dashButton.radius - 18;
    const controlY = height - safeBottom;

    return {
        joystickBaseX: leftX,
        joystickBaseY: controlY,
        dashX: rightX,
        dashY: controlY,
        activeZoneY: Math.max(360, height * 0.42)
    };
};

export default UIConfig;
