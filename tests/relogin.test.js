'use strict';
// content.js on a MiAulario page without a session: the automatic login, one at a time for all the tabs
// (the background grants it with "loginStart"), and no second login after a login without a session.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const COMMON = path.join(__dirname, '..', 'extension', 'common');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'extension', 'manifest.chromium.json'), 'utf8'));
const group = manifest.content_scripts.find((g) => g.js.includes('content.js'));
const SAML = '/sakai-login-tool/container/saml/login';

async function run({ loggedIn = false, paused = false, autoLogin = true, granted = true, storage = {}, pathname = '/portal', keepSession = true, notice = false } = {}) {
  const assigned = [];
  const messages = [];
  const session = new Map(Object.entries(storage).map(([k, v]) => [k, String(v)]));
  const noop = () => {};
  const sandbox = {
    console, URL, URLSearchParams, setTimeout, clearTimeout, Date, Promise,
    location: { pathname, search: '', href: `https://miaulario.unavarra.es${pathname}`, origin: 'https://miaulario.unavarra.es', assign: (u) => { assigned.push(u); messages.push('navigate'); } },
    sessionStorage: { getItem: (k) => (session.has(k) ? session.get(k) : null), setItem: (k, v) => session.set(k, String(v)) },
    localStorage: { getItem: () => null, setItem: noop },
    document: { addEventListener: noop, visibilityState: 'hidden', title: '', getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], documentElement: { classList: { contains: () => false } } },
    addEventListener: noop,
    fetch: async () => ({ ok: true, json: async () => ({ userId: loggedIn ? 'user-1' : null }) }),
    chrome: {
      runtime: {
        id: 'ext-id',
        getURL: (p) => `chrome-extension://ext-id/${p}`,
        sendMessage: async (msg) => {
          messages.push(msg.type);
          if (msg.type === 'getStatus') return { paused, autoLogin, nextPing: null };
          if (msg.type === 'loginStart') return granted ? { ok: true } : null;
          if (msg.type === 'keepOffNotice') return { show: notice, lang: 'es' };
          return null;
        }
      },
      storage: { local: { get: async () => ({}) }, onChanged: { addListener: noop } }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // The shared scripts of the group, then content.js (the other content scripts need a real DOM).
  const asked = [];
  for (const file of group.js.filter((f) => f.startsWith('lib/') || f === 'content.js')) {
    if (file === 'content.js') {
      sandbox.MAK.KEEP_SESSION = keepSession;
      sandbox.MAK.askWindow = (...args) => asked.push(args); // content-banner.js (it needs a real DOM)
    }
    vm.runInContext(fs.readFileSync(path.join(COMMON, file), 'utf8'), sandbox, { filename: file });
  }
  await new Promise((r) => setTimeout(r, 20));
  return { assigned, messages, session, asked };
}

test('no session: the background grants the login, then the SAML login opens', async () => {
  const r = await run();
  assert.deepEqual(r.assigned, [SAML]);
  assert.ok(r.messages.indexOf('loginStart') < r.messages.indexOf('navigate'));
});

test('a session: no login', async () => {
  const r = await run({ loggedIn: true });
  assert.deepEqual(r.assigned, []);
  assert.ok(!r.messages.includes('loginStart'));
});

test('another tab logs in, or a login of the last minutes gave no session: no login (no loop, no second login)', async () => {
  const r = await run({ granted: false });
  assert.deepEqual(r.assigned, []);
  assert.ok(!r.messages.includes('repairSession'), 'nothing removes the cookies');
});

test('paused (after a logout, or by the user) or automatic login off: no login', async () => {
  for (const o of [{ paused: true }, { paused: 'user' }, { autoLogin: false }]) {
    const r = await run(o);
    assert.deepEqual(r.assigned, [], JSON.stringify(o));
    assert.ok(!r.messages.includes('loginStart'));
  }
});

test('keeping the session off (MAK.KEEP_SESSION): no automatic login; the notice of the background once', async () => {
  const off = await run({ keepSession: false });
  assert.deepEqual(off.assigned, []);
  assert.ok(!off.messages.includes('loginStart') && !off.messages.includes('getStatus'));
  assert.deepEqual(off.asked, [], 'the background says that the user saw it');
  const first = await run({ keepSession: false, notice: true, loggedIn: true });
  assert.equal(first.asked.length, 1);
  assert.deepEqual([first.asked[0][0], first.asked[0][3]], ['Mantener la sesión, desactivado por ahora', null], 'one button');
  const on = await run({ notice: true });
  assert.ok(!on.messages.includes('keepOffNotice'), 'with the session kept: no notice');
});

test('the login pages are not changed', async () => {
  const r = await run({ pathname: '/sakai-login-tool/container/saml/login' });
  assert.deepEqual(r.assigned, []);
  assert.deepEqual(r.messages, []);
});
