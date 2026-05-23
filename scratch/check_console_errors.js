#!/usr/bin/env node
const targetUrl = 'http://127.0.0.1:8000/cyber_exorcist_standalone.html';

async function fetchJson(url) {
  const res = await fetch(url);
  return res.json();
}

async function resolvePageWsUrl() {
  const targets = await fetchJson('http://127.0.0.1:9222/json');
  const pageTarget = targets.find(target => target.type === 'page') || targets[0];
  return pageTarget.webSocketDebuggerUrl;
}

async function main() {
  const wsUrl = await resolvePageWsUrl();
  const ws = new WebSocket(wsUrl);
  let id = 0;

  function send(method, params = {}) {
    ws.send(JSON.stringify({ id: ++id, method, params }));
  }

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value || JSON.stringify(a));
      console.log(`[Browser Console] [${msg.params.type}]`, ...args);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('❌ [Browser Exception]', msg.params.exceptionDetails);
    }
  };

  await new Promise((resolve) => ws.onopen = resolve);
  send('Runtime.enable');
  send('Page.enable');
  send('Network.enable');
  send('Network.setCacheDisabled', { cacheDisabled: true });
  
  console.log(`🌐 Navigating to standalone page to capture log: ${targetUrl}`);
  send('Page.navigate', { url: targetUrl });

  setTimeout(() => {
    console.log('⏰ Diagnostic finished, closing socket.');
    ws.close();
    process.exit(0);
  }, 5000);
}

main().catch(console.error);
