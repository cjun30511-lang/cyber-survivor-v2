#!/usr/bin/env node
const targetUrl = process.argv[2] || 'http://127.0.0.1:8000/cyber_exorcist_standalone.html?v=verify';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.json();
}

async function resolvePageWsUrl() {
  const targets = await fetchJson('http://127.0.0.1:9222/json');
  const pageTarget = targets.find(target => target.type === 'page') || targets[0];
  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error('No DevTools page target found on :9222');
  }
  return pageTarget.webSocketDebuggerUrl;
}

async function main() {
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
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(msg.error);
      else p.resolve(msg.result);
    }
  };

  const expr = `(() => {
    window.__lastReplayResult = 'PENDING';
    window.__codexErrors = [];
    if (!window.__codexErrorHookInstalled) {
      window.__codexErrorHookInstalled = true;
      window.__codexPushErr = (...args) => window.__codexErrors.push(args.map(a => {
        try { return typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); }
      }).join(' '));
      window.addEventListener('error', e => window.__codexPushErr('window.error', e.message, e.filename, e.lineno));
      window.addEventListener('unhandledrejection', e => window.__codexPushErr('unhandledrejection', e.reason && (e.reason.stack || e.reason.message || String(e.reason))));
      const oldErr = console.error.bind(console);
      console.error = (...args) => { window.__codexPushErr('console.error', ...args); oldErr(...args); };
    }
    const wait = (fn, timeout = 12000) => new Promise((resolve, reject) => {
      const start = performance.now();
      const tick = () => {
        let v = null;
        try { v = fn(); } catch {}
        if (v) return resolve(v);
        if (performance.now() - start > timeout) return reject(new Error('wait timeout'));
        setTimeout(tick, 100);
      };
      tick();
    });
    const getSceneManager = () => window.game && window.game.scene ? window.game.scene : null;
    const getFatalBannerText = () => {
      const el = document.getElementById('debug-error-banner');
      return el ? el.textContent : '';
    };
    const getSceneInstance = (key) => {
      const manager = getSceneManager();
      const scene = manager && manager.keys ? manager.keys[key] : null;
      if (!scene || typeof scene.scene?.isActive !== 'function') return null;
      return scene.scene.isActive() ? scene : null;
    };
    const getBattle = () => getSceneInstance('BattleScene');
    const getResult = () => getSceneInstance('ResultScene');
    (async () => {
      const runs = [];
      for (let run = 1; run <= 3; run++) {
        const before = window.__codexErrors.length;
        const sceneManager = await wait(() => {
          const manager = getSceneManager();
          if (manager && typeof manager.start === 'function') return manager;
          const fatalText = getFatalBannerText();
          if (fatalText) {
            throw new Error('Boot failed: ' + fatalText.slice(0, 600));
          }
          return null;
        }, 20000);
        sceneManager.start('BattleScene');
        const battle = await wait(getBattle);
        await new Promise(r => setTimeout(r, 2500));
        battle.requestSceneChange('ResultScene', { victory: false });
        await wait(getResult);
        await new Promise(r => setTimeout(r, 1500));
        runs.push({ run, newErrors: window.__codexErrors.slice(before) });
      }
      window.__lastReplayResult = JSON.stringify({ ok: window.__codexErrors.length === 0, errors: window.__codexErrors, runs });
    })().catch(err => {
      window.__lastReplayResult = 'ERR:' + (err && (err.stack || err.message) || String(err));
    });
    return 'STARTED';
  })()`;

  await new Promise((resolve, reject) => {
    ws.onopen = async () => {
      try {
        await send('Page.enable');
        await send('Runtime.enable');
        await send('Page.navigate', { url: targetUrl });
        await new Promise(r => setTimeout(r, 3000));
        await send('Runtime.evaluate', { expression: expr, returnByValue: true });
        for (let i = 0; i < 40; i++) {
          const r = await send('Runtime.evaluate', { expression: 'window.__lastReplayResult', returnByValue: true });
          const v = r.result.value;
          if (v && v !== 'PENDING') {
            console.log(v);
            ws.close();
            resolve();
            return;
          }
          await new Promise(res => setTimeout(res, 1000));
        }
        console.log('ERR:timeout waiting for replay result');
        ws.close();
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    ws.onerror = reject;
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
