#!/usr/bin/env node
const targetUrl = 'http://127.0.0.1:8000/cyber_exorcist_standalone.html';
const bossKeys = ['boss', 'boss_frost', 'boss_plague', 'boss_void', 'boss_furnace', 'boss_drowned', 'boss_blood', 'boss_bone'];

async function fetchJson(url) {
  const res = await fetch(url);
  return res.json();
}

async function resolvePageWsUrl() {
  const targets = await fetchJson('http://127.0.0.1:9222/json');
  const pageTarget = targets.find(target => target.type === 'page') || targets[0];
  return pageTarget.webSocketDebuggerUrl;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🤖 Connecting to headless Chrome via CDP...');
  const wsUrl = await resolvePageWsUrl();
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();

  function send(method, params = {}) {
    const msgId = ++id;
    ws.send(JSON.stringify({ id: msgId, method, params }));
    return new Promise((resolve, reject) => pending.set(msgId, { resolve, reject }));
  }

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);

    // Log runtime exception events
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('❌ GLOBAL EXCEPTION:', JSON.stringify(msg.params.exceptionDetails, null, 2));
    }

    // Log console API calls
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value !== undefined ? a.value : JSON.stringify(a));
      console.log(`[Console ${msg.params.type.toUpperCase()}]`, ...args);
    }

    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(msg.error);
      else p.resolve(msg.result);
    }
  };

  await new Promise((resolve) => ws.onopen = resolve);
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Console.enable');

  console.log(`🌐 Navigating to standalone page: ${targetUrl}`);
  await send('Page.navigate', { url: targetUrl });

  console.log('⏳ Waiting 6 seconds for preloading and MenuScene...');
  await delay(6000);

  // Check if window.game exists
  console.log('🔍 Checking if game object exists...');
  let res = await send('Runtime.evaluate', { expression: '!!window.game', returnByValue: true });
  console.log('Game exists result:', res.result.value);

  // Helper to run evaluate and check exceptionDetails
  async function runEval(label, code) {
    console.log(`\n▶️ Running evaluation: ${label}...`);
    const evalRes = await send('Runtime.evaluate', { expression: code, returnByValue: true });
    if (evalRes.exceptionDetails) {
      console.error(`❌ Exception in ${label}:`, JSON.stringify(evalRes.exceptionDetails, null, 2));
    } else {
      console.log(`✅ Success for ${label}:`, evalRes.result.value);
    }
    return evalRes;
  }

  // 1. Transition to BattleScene
  await runEval('Transition to BattleScene', `(() => {
    if (window.game && window.game.scene && window.game.scene.keys.MenuScene) {
      window.game.scene.keys.MenuScene.requestSceneChange('BattleScene');
      return 'SUCCESS';
    }
    return 'FAILED';
  })()`);

  console.log('⏳ Waiting 3 seconds for BattleScene initialization...');
  await delay(3000);

  // Check active scene
  await runEval('Get Active Scenes', `(() => {
    return window.game.scene.getScenes(true).map(s => s.sys.settings.key);
  })()`);

  // Check if player is present
  await runEval('Check Player and Scene Status', `(() => {
    const scene = window.game.scene.keys.BattleScene;
    if (!scene) return 'NO_BATTLE_SCENE';
    return {
      hasPlayer: !!scene.player,
      hasEnemiesGroup: !!scene.enemiesGroup,
      playerX: scene.player ? scene.player.x : null,
      playerY: scene.player ? scene.player.y : null
    };
  })()`);

  // 2. Spawning and freezing small monsters
  await runEval('Spawn small monsters', `(() => {
    const scene = window.game.scene.keys.BattleScene;
    if (!scene) return 'NO_BATTLE';

    scene.enemiesGroup.clear(true, true);

    const px = scene.player.x;
    const py = scene.player.y;

    const sk = new SkeletonMelee(scene, px + 120, py - 40);
    const gh = new GhostCaster(scene, px - 110, py + 30);

    scene.enemiesGroup.add(sk);
    scene.enemiesGroup.add(gh);

    scene.enemiesGroup.getChildren().forEach(enemy => {
      enemy.speed = 0;
      if (enemy.body) enemy.body.setVelocity(0, 0);
      enemy.update = () => {};
      enemy.updateVisuals = () => {};
    });

    return 'SPAWNED_SMALL_SUCCESS';
  })()`);

  // 3. Spawning heavy monsters
  await runEval('Spawn heavy monsters', `(() => {
    const scene = window.game.scene.keys.BattleScene;
    if (!scene) return 'NO_BATTLE';

    scene.enemiesGroup.clear(true, true);

    const px = scene.player.x;
    const py = scene.player.y;

    const tk = new IronTank(scene, px + 180, py + 20);
    const bs = new BossDemon(scene, px, py - 180);

    scene.enemiesGroup.add(tk);
    scene.enemiesGroup.add(bs);

    scene.enemiesGroup.getChildren().forEach(enemy => {
      enemy.speed = 0;
      if (enemy.body) enemy.body.setVelocity(0, 0);
      enemy.update = () => {};
      enemy.updateVisuals = () => {};
    });

    return 'SPAWNED_HEAVY_SUCCESS';
  })()`);

  // 4. Verify every boss key, animation, and skill pattern can run.
  await runEval('Spawn all boss variants and cast skills', `(() => {
    const scene = window.game.scene.keys.BattleScene;
    if (!scene) return 'NO_BATTLE';

    const bossKeys = ${JSON.stringify(bossKeys)};
    scene.enemiesGroup.clear(true, true);
    scene.casterBullets.clear(true, true);
    scene.player.isInvincible = true;
    scene.player.hp = 9999;
    if (GameState.run) {
      GameState.run.hpMax = 9999;
      GameState.run.hp = 9999;
      GameState.run.isGameOver = false;
    }
    scene.combatSystem.lastPlayerHurtTime = Number.MAX_SAFE_INTEGER;

    const missing = [];
    const spawned = [];
    const px = scene.player.x;
    const py = scene.player.y;
    const startX = px - 270;
    const startY = py - 230;

    bossKeys.forEach((key, index) => {
      const config = EnemyConfig[key];
      const prefix = config?.animPrefix;
      ['idle', 'attack', 'hit', 'death'].forEach(action => {
        const textureKey = action === 'idle' ? config?.texture : \`\${prefix}_\${action}\`;
        const animKey = \`\${prefix}_\${action}_anim\`;
        if (!textureKey || !scene.textures.exists(textureKey)) missing.push(\`texture:\${key}:\${action}\`);
        if (!scene.anims.exists(animKey)) missing.push(\`anim:\${key}:\${action}\`);
      });

      const bx = startX + (index % 4) * 180;
      const by = startY + Math.floor(index / 4) * 220;
      const boss = new BossDemon(scene, bx, by, key);
      boss.speed = 0;
      if (boss.body) boss.body.setVelocity(0, 0);
      scene.enemiesGroup.add(boss);
      spawned.push({ key, skillPattern: boss.skillPattern, animPrefix: boss.animPrefix });
      boss.castBossSkill(scene.player);
    });

    return {
      spawned,
      missing,
      bulletCount: scene.casterBullets.getChildren().length
    };
  })()`);

  console.log('⏳ Waiting 1 second for boss skill delayed releases...');
  await delay(1000);

  await runEval('Check boss skill release count', `(() => {
    const scene = window.game.scene.keys.BattleScene;
    if (!scene) return 'NO_BATTLE';
    return {
      enemies: scene.enemiesGroup.getChildren().length,
      bullets: scene.casterBullets.getChildren().length,
      activeBossKeys: scene.enemiesGroup.getChildren().filter(enemy => enemy.isBoss).map(enemy => enemy.configKey)
    };
  })()`);

  // 5. Chaotic battle scene
  await runEval('Spawn chaos scene', `(() => {
    const scene = window.game.scene.keys.BattleScene;
    if (!scene) return 'NO_BATTLE';

    scene.enemiesGroup.clear(true, true);

    const px = scene.player.x;
    const py = scene.player.y;

    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const dist = 140 + Math.random() * 150;
      const ex = px + Math.cos(angle) * dist;
      const ey = py + Math.sin(angle) * dist;
      const sk = new SkeletonMelee(scene, ex, ey);
      scene.enemiesGroup.add(sk);
    }

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + 0.2;
      const dist = 240 + Math.random() * 100;
      const ex = px + Math.cos(angle) * dist;
      const ey = py + Math.sin(angle) * dist;
      const gh = new GhostCaster(scene, ex, ey);
      scene.enemiesGroup.add(gh);
    }

    const diagonals = [
      {dx: -220, dy: -220}, {dx: 220, dy: -220},
      {dx: -220, dy: 220}, {dx: 220, dy: 220}
    ];
    diagonals.forEach(d => {
      const tk = new IronTank(scene, px + d.dx, py + d.dy);
      scene.enemiesGroup.add(tk);
    });

    const bs = new BossDemon(scene, px, py - 280);
    scene.enemiesGroup.add(bs);

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = 450;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const proj = new TalismanProjectile(scene, px, py - 10, vx, vy, angle, 20);
      scene.skillSystem.projectilesGroup.add(proj);
      scene.fireParticles.emitParticleAt(px + Math.cos(angle)*60, py + Math.sin(angle)*60, 4);
    }

    return 'SPAWNED_CHAOS_SUCCESS';
  })()`);

  console.log('\n🏁 Diagnostic finished, closing.');
  ws.close();
  process.exit(0);
}

main().catch(console.error);
