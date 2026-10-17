// A small client of the Chrome DevTools Protocol for the browser tests and the live checks.
// It needs no packages: Node 22+ has WebSocket and fetch.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

// A Chromium browser that can load an unpacked extension: CHROME_PATH, the Chrome for Testing
// of Playwright, or Chromium. Null if there is none.
export function findChrome() {
  if (process.env.CHROME_PATH) return existsSync(process.env.CHROME_PATH) ? process.env.CHROME_PATH : null;
  const found = [];
  for (const dir of [join(homedir(), 'Library/Caches/ms-playwright'), join(homedir(), '.cache/ms-playwright')]) {
    if (!existsSync(dir)) continue;
    for (const v of readdirSync(dir).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
      found.push(
        join(dir, v, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
        join(dir, v, 'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
        join(dir, v, 'chrome-linux64/chrome'),
        join(dir, v, 'chrome-linux/chrome')
      );
    }
  }
  found.push('/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  return found.find((p) => existsSync(p)) || null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Start the browser and connect to it. "profile": a folder for a profile that stays (the live
// checks); else a new empty profile.
export async function launch({ chrome, headless = true, profile, extension, args = [] }) {
  const userDir = profile || mkdtempSync(join(tmpdir(), 'aulario-test-'));
  // A profile that stays keeps the port file of the last run: remove it, then wait for the new one.
  rmSync(join(userDir, 'DevToolsActivePort'), { force: true });
  const flags = [
    `--user-data-dir=${userDir}`, '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
    '--use-mock-keychain', '--password-store=basic', '--allow-file-access-from-files', ...args
  ];
  if (headless) flags.push('--headless=new');
  if (extension) flags.push(`--load-extension=${extension}`, `--disable-extensions-except=${extension}`);
  const proc = spawn(chrome, flags, { stdio: 'ignore' });
  let port = null;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    try {
      port = readFileSync(join(userDir, 'DevToolsActivePort'), 'utf8').split('\n')[0];
    } catch {}
  }
  if (!port) {
    proc.kill();
    throw new Error('The browser did not start');
  }
  let ws;
  try {
    const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });
  } catch (e) {
    proc.kill(); // no browser stays open after an error
    throw new Error(`No connection to the browser: ${e.message}`);
  }
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else for (const f of listeners) f(msg);
  });
  const call = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
      ws.send(JSON.stringify({ id: n, method, params, sessionId }));
    });
  // A new tab, with a session to send commands to it.
  async function openTab(url) {
    const { targetId } = await call('Target.createTarget', { url });
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
    await call('Runtime.enable', {}, sessionId);
    const evaluate = async (expression) => {
      const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
      return r.result.value;
    };
    const navigate = (to) => call('Page.navigate', { url: to }, sessionId);
    return { targetId, sessionId, evaluate, navigate };
  }
  // Wait until the expression is true in the tab.
  async function waitFor(tab, expression, ms = 15000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      try {
        if (await tab.evaluate(expression)) return true;
      } catch {}
      await sleep(200);
    }
    return false;
  }
  const close = () => {
    try { ws.close(); } catch {}
    proc.kill();
  };
  return { call, openTab, waitFor, close, on: (f) => listeners.push(f) };
}
