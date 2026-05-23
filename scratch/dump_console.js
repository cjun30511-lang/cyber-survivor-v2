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
    
    // Log exception details
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('❌ Browser Exception:', JSON.stringify(msg.params.exceptionDetails, null, 2));
    }
    
    // Log Console API calls
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value !== undefined ? a.value : JSON.stringify(a));
      console.log(`[Console ${msg.params.type.toUpperCase()}]`, ...args);
    }
    
    // Log.entryAdded
    if (msg.method === 'Log.entryAdded') {
      console.log('[Log Entry]', msg.params.entry);
    }
  };

  await new Promise((resolve) => ws.onopen = resolve);
  
  // Enable all diagnostic domains
  send('Runtime.enable');
  send('Log.enable');
  send('Console.enable');
  send('Page.enable');
  
  console.log(`🌐 Navigating to standalone page: ${targetUrl}`);
  send('Page.navigate', { url: targetUrl });

  // Wait 6 seconds
  setTimeout(async () => {
    console.log('⏰ Waiting completed. Evaluating page status...');
    
    // Evaluate document.body.innerText
    send('Runtime.evaluate', {
      expression: 'document.body.innerText',
      returnByValue: true
    });
    
    // Evaluate window.game existence
    send('Runtime.evaluate', {
      expression: '!!window.game',
      returnByValue: true
    });
  }, 6000);

  // Close and exit after 8 seconds
  setTimeout(() => {
    console.log('🏁 Diagnostic finished, closing.');
    ws.close();
    process.exit(0);
  }, 8000);
}

main().catch(console.error);
