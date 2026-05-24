#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const targetUrl = process.env.GAME_URL || 'http://127.0.0.1:8000/cyber_exorcist_standalone.html?screenshot=true';
const artifactDir = process.env.ARTIFACT_DIR || '/Users/shenjun8676/.gemini/antigravity/brain/dae1de1e-74a6-46a7-944b-bdfb2b33c3a4';
const bossKeys = ['boss', 'boss_frost', 'boss_plague', 'boss_void', 'boss_furnace', 'boss_drowned', 'boss_blood', 'boss_bone'];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.json();
}

async function createFreshPageTarget(url) {
  const res = await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT'
  });
  if (!res.ok) {
    throw new Error(`Failed to create fresh DevTools target: ${res.status}`);
  }
  const target = await res.json();
  if (!target?.webSocketDebuggerUrl) {
    throw new Error('Fresh DevTools target did not expose a webSocketDebuggerUrl');
  }
  return target.webSocketDebuggerUrl;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🤖 Connecting to headless Chrome via CDP...');
  const wsUrl = await createFreshPageTarget('about:blank');
  console.log(`🔌 WS URL: ${wsUrl}`);

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
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(msg.error);
      else p.resolve(msg.result);
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  console.log('✅ Connected to WebSocket debugging server!');

  // Enable CDP features
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 720,
    height: 1280,
    deviceScaleFactor: 1,
    mobile: true
  });
  await send('Emulation.setVisibleSize', { width: 720, height: 1280 });

  console.log(`🌐 Navigating to stand-alone client: ${targetUrl}`);
  await send('Page.navigate', { url: targetUrl });

  // 1. Wait for BootScene asset preloading and menu scene transition
  console.log('⏳ Waiting 6 seconds for game asset preloading and menu loading...');
  await delay(6000);

  // Take Screenshot 1: Lobby Menu Page (Full)
  console.log('📸 Capturing Screenshot 1: Lobby Character Select Menu Page (Full)...');
  const sc1 = await send('Page.captureScreenshot', { format: 'png' });
  const sc1Path = path.join(artifactDir, 'real_menu_lobby.png');
  fs.writeFileSync(sc1Path, Buffer.from(sc1.data, 'base64'));
  console.log(`💾 Saved Menu Screenshot: ${sc1Path}`);

  // Take Screenshot 2: Lobby Character Showcase Close-up (Cathedral Archway & Stats Codex Card area)
  console.log('📸 Capturing Screenshot 2: Lobby Altar & Stats Codex Card Close-up...');
  const sc2 = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 90, y: 275, width: 540, height: 680, scale: 1 }
  });
  const sc2Path = path.join(artifactDir, 'real_menu_showcase.png');
  fs.writeFileSync(sc2Path, Buffer.from(sc2.data, 'base64'));
  console.log(`💾 Saved Lobby Showcase Screenshot: ${sc2Path}`);

  // 2. Transition into Battle Scene
  console.log('🎮 Transitioning into Battle Scene...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.game && window.game.scene && window.game.scene.keys.MenuScene) {
        window.game.scene.keys.MenuScene.requestSceneChange('BattleScene');
        return 'SUCCESS';
      }
      return 'FAILED';
    })()`,
    returnByValue: true
  });

  console.log('⏳ Waiting 3 seconds for Battle Scene initialization...');
  await delay(3000);

  // Take Screenshot 3: Player Alone in Combat (showing dense tile texture grid and new scale)
  console.log('📸 Capturing Screenshot 3: Player Alone in Dungeon Battle Scene...');
  const sc3 = await send('Page.captureScreenshot', { format: 'png' });
  const sc3Path = path.join(artifactDir, 'real_player_combat.png');
  fs.writeFileSync(sc3Path, Buffer.from(sc3.data, 'base64'));
  console.log(`💾 Saved Player Combat Screenshot: ${sc3Path}`);

  // 3. Spawn small monsters (skeleton & ghost) right in front of the player, and freeze them!
  console.log('👾 Spawning and freezing small monsters (Skeleton & Ghost)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const scene = window.game.scene.keys.BattleScene;
      if (!scene) return 'NO_BATTLE';

      // Clear existing enemies
      scene.enemiesGroup.clear(true, true);

      const px = scene.player.x;
      const py = scene.player.y;

      const sk = new SkeletonMelee(scene, px + 120, py - 40);
      const gh = new GhostCaster(scene, px - 110, py + 30);

      scene.enemiesGroup.add(sk);
      scene.enemiesGroup.add(gh);

      // Freeze them in place for perfect screen captures
      scene.enemiesGroup.getChildren().forEach(enemy => {
        enemy.speed = 0;
        if (enemy.body) enemy.body.setVelocity(0, 0);
        enemy.update = () => {};
        enemy.updateVisuals = () => {};
      });

      return 'SPAWNED_SMALL';
    })()`,
    returnByValue: true
  });

  await delay(1000);

  // Take Screenshot 4: Player + Skeleton + Ghost on the same screen (checking relative scale proportions)
  console.log('📸 Capturing Screenshot 4: Player + Small Mobs (Skeleton & Ghost)...');
  const sc4 = await send('Page.captureScreenshot', { format: 'png' });
  const sc4Path = path.join(artifactDir, 'real_monsters_small.png');
  fs.writeFileSync(sc4Path, Buffer.from(sc4.data, 'base64'));
  console.log(`💾 Saved Small Monsters Screenshot: ${sc4Path}`);

  // 4. Clear small monsters, spawn heavy tank and demon boss right in front of the player, and freeze them!
  console.log('👹 Spawning and freezing heavy monsters (Iron Tank & Demon Boss)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const scene = window.game.scene.keys.BattleScene;
      if (!scene) return 'NO_BATTLE';

      // Clear existing enemies
      scene.enemiesGroup.clear(true, true);

      const px = scene.player.x;
      const py = scene.player.y;

      const tk = new IronTank(scene, px + 180, py + 20);
      const bs = new BossDemon(scene, px, py - 180);

      scene.enemiesGroup.add(tk);
      scene.enemiesGroup.add(bs);

      // Freeze them in place
      scene.enemiesGroup.getChildren().forEach(enemy => {
        enemy.speed = 0;
        if (enemy.body) enemy.body.setVelocity(0, 0);
        enemy.update = () => {};
        enemy.updateVisuals = () => {};
      });

      return 'SPAWNED_HEAVY';
    })()`,
    returnByValue: true
  });

  await delay(1000);

  // Take Screenshot 5: Player + Iron Tank + Demon Boss on the same screen (checking giant proportions and presence)
  console.log('📸 Capturing Screenshot 5: Player + Heavy Monsters (Iron Tank & Demon Boss)...');
  const sc5 = await send('Page.captureScreenshot', { format: 'png' });
  const sc5Path = path.join(artifactDir, 'real_monsters_heavy.png');
  fs.writeFileSync(sc5Path, Buffer.from(sc5.data, 'base64'));
  console.log(`💾 Saved Heavy Monsters Screenshot: ${sc5Path}`);

  // 5. Spawn all 8 bosses as a compact roster check.
  console.log('👑 Spawning all 8 Boss variants for roster screenshot...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const scene = window.game.scene.keys.BattleScene;
      if (!scene) return 'NO_BATTLE';

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

      const bossKeys = ${JSON.stringify(bossKeys)};
      const px = scene.player.x;
      const py = scene.player.y;
      const startX = px - 270;
      const startY = py - 330;

      bossKeys.forEach((key, index) => {
        const bx = startX + (index % 4) * 180;
        const by = startY + Math.floor(index / 4) * 260;
        const boss = new BossDemon(scene, bx, by, key);
        boss.speed = 0;
        if (boss.body) boss.body.setVelocity(0, 0);
        boss.update = () => {};
        scene.enemiesGroup.add(boss);
      });

      return 'SPAWNED_BOSS_ROSTER';
    })()`,
    returnByValue: true
  });

  await delay(1000);

  console.log('📸 Capturing Screenshot 6: 8 Boss Roster...');
  const scBossRoster = await send('Page.captureScreenshot', { format: 'png' });
  const scBossRosterPath = path.join(artifactDir, 'real_boss_roster.png');
  fs.writeFileSync(scBossRosterPath, Buffer.from(scBossRoster.data, 'base64'));
  console.log(`💾 Saved Boss Roster Screenshot: ${scBossRosterPath}`);

  // 6. Force all 8 Bosses to cast once so telegraphs and projectile styles are visible.
  console.log('🧪 Triggering all 8 Boss skills for VFX screenshot...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const scene = window.game.scene.keys.BattleScene;
      if (!scene) return 'NO_BATTLE';
      scene.enemiesGroup.getChildren().forEach(enemy => {
        if (enemy instanceof BossDemon) {
          enemy.castBossSkill(scene.player);
        }
      });
      return 'CAST_BOSS_SKILLS';
    })()`,
    returnByValue: true
  });

  await delay(520);

  console.log('📸 Capturing Screenshot 7: 8 Boss Skill Telegraphs...');
  const scBossSkills = await send('Page.captureScreenshot', { format: 'png' });
  const scBossSkillsPath = path.join(artifactDir, 'real_boss_skills.png');
  fs.writeFileSync(scBossSkillsPath, Buffer.from(scBossSkills.data, 'base64'));
  console.log(`💾 Saved Boss Skill Screenshot: ${scBossSkillsPath}`);

  await send('Runtime.evaluate', {
    expression: `(() => {
      const scene = window.game.scene.keys.BattleScene;
      if (!scene) return 'NO_BATTLE';
      scene.player.isInvincible = false;
      scene.player.hp = 90;
      if (GameState.run) {
        GameState.run.hpMax = 90;
        GameState.run.hp = 90;
        GameState.run.isGameOver = false;
      }
      scene.combatSystem.lastPlayerHurtTime = 0;
      return 'RESTORED_PLAYER_FOR_CHAOS';
    })()`,
    returnByValue: true
  });

  // 7. Spawn chaotic battle scene (mixed mobs + projectile fireworks) - do not freeze to let action particles fly!
  console.log('💥 Spawning chaotic battle scene (mixed mobs + projectile fireworks)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const scene = window.game.scene.keys.BattleScene;
      if (!scene) return 'NO_BATTLE';

      // Clear existing enemies
      scene.enemiesGroup.clear(true, true);

      const px = scene.player.x;
      const py = scene.player.y;

      // 1. Spawning a high-density circle of small skeletons and ghosts
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

      // 2. Spawning 4 tanks in four diagonal directions
      const diagonals = [
        {dx: -220, dy: -220}, {dx: 220, dy: -220},
        {dx: -220, dy: 220}, {dx: 220, dy: 220}
      ];
      diagonals.forEach(d => {
        const tk = new IronTank(scene, px + d.dx, py + d.dy);
        scene.enemiesGroup.add(tk);
      });

      // 3. Spawning 1 Boss Demon at the top center
      const bs = new BossDemon(scene, px, py - 280);
      scene.enemiesGroup.add(bs);

      // 4. Force player to trigger multiple projectile bursts (talisman + fireball) in different directions
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const speed = 450;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const proj = new TalismanProjectile(scene, px, py - 10, vx, vy, angle, 20);
        scene.skillSystem.projectilesGroup.add(proj);
        scene.fireParticles.emitParticleAt(px + Math.cos(angle)*60, py + Math.sin(angle)*60, 4);
      }

      return 'SPAWNED_CHAOS';
    })()`,
    returnByValue: true
  });

  // Wait 400ms for particles and projectiles to spread naturally
  await delay(400);

  // Take Screenshot 8: Chaotic Battle Scene (Chaos & Readability)
  console.log('📸 Capturing Screenshot 8: Chaotic Battle Scene (Chaos & Readability)...');
  const sc6 = await send('Page.captureScreenshot', { format: 'png' });
  const sc6Path = path.join(artifactDir, 'real_combat_chaos.png');
  fs.writeFileSync(sc6Path, Buffer.from(sc6.data, 'base64'));
  console.log(`💾 Saved Chaos Battle Screenshot: ${sc6Path}`);

  console.log('🎉 All 8 high-fidelity screenshots taken successfully!');
  ws.close();
}

main().catch(err => {
  console.error('❌ Error executing capture_screenshots.js:', err);
  process.exit(1);
});
