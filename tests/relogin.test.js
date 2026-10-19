'use strict';
// content.js on a MiAulario page without a session: the automatic login, and the repair of the
// session cookies when a login of the last minutes did not give a session.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const COMMON = path.join(__dirname, '..', 'extension', 'common');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'extension', 'manifest.chromium.json'), 'utf8'));
const group = manifest.content_scripts.find((g) => g.js.includes('content.js'));
const SAML = '/sakai-login-tool/container/saml/login';
const LOGIN_KEY = 'aulario-plus-last-relogin';
const REPAIR_KEY = 'aulario-plus-last-repair';

async function run({ loggedIn = false, paused = false, autoLogin = true, storage = {}, pathname = '/portal' } = {}) {
  const assigned = [];
  const messages = [];
  const session = new Map(Object.entries(storage).map(([k, v]) => [k, String(v)]));
  const noop = () => {};
  const sandbox = {
    console, URL, URLSearchParams, setTimeout, clearTimeout, Date, Promise,
    location: { pathname, search: '', href: `https://miaulario.unavarra.es${pathname}`, origin: 'https://miaulario.unavarra.es', assign: (u) => { assigned.push(u); messages.push('navigate'); } },
    sessionStorage: { getItem: (k) => (session.has(k) ? session.get(k) : null), setItem: (k, v) => session.set(k, String(v)) },
    localStorage: { getItem: () => null, setItem: noop },
    document: { addEventListener: noop, visibilityState: 'hidden', title: '', querySelector: () => null, querySelectorAll: () => [], documentElement: { classList: { contains: () => false } } },
    addEventListener: noop,
    fetch: async () => ({ ok: true, json: async () => ({ userId: loggedIn ? 'user-1' : null }) }),
    chrome: {
      runtime: {
        id: 'ext-id',
        getURL: (p) => `chrome-extension://ext-id/${p}`,
        sendMessage: async (msg) => {
          messages.push(msg.type);
          if (msg.type === 'getStatus') return { paused, autoLogin, nextPing: null };
          if (msg.type === 'repairSession') return { ok: true };
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
  for (const file of group.js.filter((f) => f.startsWith('lib/') || f === 'content.js')) vm.runInContext(fs.readFileSync(path.join(COMMON, file), 'utf8'), sandbox, { filename: file });
  await new Promise((r) => setTimeout(r, 20));
  return { assigned, messages, session };
}

test('no session and no recent login: the automatic login opens the SAML login', async () => {
  const r = await run();
  assert.deepEqual(r.assigned, [SAML]);
  assert.ok(!r.messages.includes('repairSession'));
  assert.ok(r.session.get(LOGIN_KEY), 'the time of the login is recorded');
});

test('a session: no login', async () => {
  const r = await run({ loggedIn: true });
  assert.deepEqual(r.assigned, []);
});

test('a login of the last 2 minutes without a session: repair the cookies, then log in again', async () => {
  const r = await run({ storage: { [LOGIN_KEY]: Date.now() - 30000 } });
  assert.ok(r.messages.includes('repairSession'));
  assert.ok(r.messages.indexOf('repairSession') < r.messages.indexOf('navigate'), 'the repair ends before the login opens');
  assert.deepEqual(r.assigned, [SAML]);
  assert.ok(r.session.get(REPAIR_KEY));
});

test('only one repair in 10 minutes: no loop', async () => {
  const r = await run({ storage: { [LOGIN_KEY]: Date.now() - 30000, [REPAIR_KEY]: Date.now() - 60000 } });
  assert.ok(!r.messages.includes('repairSession'));
  assert.deepEqual(r.assigned, []);
});

test('paused after a logout: no automatic login, but a login of the user that failed is repaired', async () => {
  const idle = await run({ paused: true });
  assert.deepEqual(idle.assigned, [], 'no automatic login');
  const clicked = await run({ paused: true, storage: { [LOGIN_KEY]: Date.now() - 10000 } });
  assert.ok(clicked.messages.includes('repairSession'));
  assert.deepEqual(clicked.assigned, [SAML]);
});

test('automatic login off: no login, but the repair after a login of the user', async () => {
  const idle = await run({ autoLogin: false });
  assert.deepEqual(idle.assigned, []);
  const clicked = await run({ autoLogin: false, storage: { [LOGIN_KEY]: Date.now() - 10000 } });
  assert.deepEqual(clicked.assigned, [SAML]);
});

test('the login pages are not changed', async () => {
  const r = await run({ pathname: '/sakai-login-tool/container/saml/login' });
  assert.deepEqual(r.assigned, []);
  assert.deepEqual(r.messages, []);
});
