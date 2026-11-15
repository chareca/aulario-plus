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

async function run({ loggedIn = false, paused = false, autoLogin = true, granted = true, storage = {}, pathname = '/portal', search = '', notice = null, local = {}, warning = null } = {}) {
  const assigned = [];
  const messages = [];
  const session = new Map(Object.entries(storage).map(([k, v]) => [k, String(v)]));
  const noop = () => {};
  // The warning of the end of the session: "warning" is its box (null: none); the observer of the body, by hand.
  const observers = [];
  const page = { warning };
  const sandbox = {
    console, URL, URLSearchParams, setTimeout, clearTimeout, Date, Promise,
    location: { pathname, search, href: `https://miaulario.unavarra.es${pathname}`, origin: 'https://miaulario.unavarra.es', assign: (u) => { assigned.push(u); messages.push('navigate'); } },
    sessionStorage: { getItem: (k) => (session.has(k) ? session.get(k) : null), setItem: (k, v) => session.set(k, String(v)) },
    localStorage: { getItem: () => null, setItem: noop },
    document: { addEventListener: noop, visibilityState: 'hidden', title: '', body: {}, getElementById: (id) => (id === 'timeout_alert_body' ? page.warning : null), querySelector: () => null, querySelectorAll: () => [], documentElement: { classList: { contains: () => false } } },
    addEventListener: noop,
    MutationObserver: class { constructor(f) { observers.push(f); } observe() {} },
    fetch: async () => ({ ok: true, json: async () => ({ userId: loggedIn ? 'user-1' : null }) }),
    chrome: {
      runtime: {
        id: 'ext-id',
        getURL: (p) => `chrome-extension://ext-id/${p}`,
        sendMessage: async (msg) => {
          messages.push(msg.type);
          if (msg.type === 'getStatus') return { paused, autoLogin, nextPing: null };
          if (msg.type === 'loginStart') return granted ? { ok: true } : null;
          if (msg.type === 'pageNotice') return Object.assign({ lang: 'es' }, notice);
          return null;
        }
      },
      storage: { local: { get: async () => local }, onChanged: { addListener: noop } }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // The shared scripts of the group, then content.js (the other content scripts need a real DOM).
  const asked = [];
  for (const file of group.js.filter((f) => f.startsWith('lib/') || f === 'content.js')) {
    if (file === 'content.js') {
      sandbox.MAK.askWindow = (...args) => asked.push(args); // content-banner.js (it needs a real DOM)
    }
    vm.runInContext(fs.readFileSync(path.join(COMMON, file), 'utf8'), sandbox, { filename: file });
  }
  await new Promise((r) => setTimeout(r, 20));
  // The portal adds a warning to the body: the observers run.
  const warn = async (box) => {
    page.warning = box;
    for (const f of observers) f();
    await new Promise((r) => setTimeout(r, 10));
  };
  return { assigned, messages, session, asked, warn };
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

test('the news of a new version: the window that the background gives', async () => {
  assert.deepEqual((await run({ loggedIn: true })).asked, [], 'no news: no window');
  // Its line, a button to all the news and "Cerrar".
  const news = await run({ notice: { kind: 'release', version: '1.6.7', text: 'Dos temas nuevos.' }, loggedIn: true });
  assert.deepEqual(news.asked, [['Novedades de la versión 1.6.7', 'Dos temas nuevos.', 'Ver todas las novedades', 'Cerrar']]);
});

// The box of the warning of MiAulario: its button "Mantenme activo" (or none), and the clicks on it.
const warningBox = (withButton = true) => {
  const box = { clicks: 0, isConnected: true };
  box.querySelector = (sel) => (withButton && sel === '[onclick*="keep_session_alive"]' ? { click: () => box.clicks++ } : null);
  return box;
};

test('the warning "your session ends in 10 minutes": the script presses its button, each warning once', async () => {
  const r = await run({ loggedIn: true });
  const first = warningBox();
  await r.warn(first);
  await r.warn(first); // another change of the body: the same warning
  assert.equal(first.clicks, 1);
  const second = warningBox();
  await r.warn(second);
  assert.equal(second.clicks, 1, 'the next warning, 50 minutes later');
  assert.ok(!r.messages.includes('keepAlive'), 'the button sends the request');
  // A warning that is there when the page loads, and one without the button: the background sends the request.
  const there = warningBox();
  await run({ loggedIn: true, warning: there });
  assert.equal(there.clicks, 1);
  const bare = await run({ loggedIn: true });
  await bare.warn(warningBox(false));
  assert.equal(bare.messages.filter((m) => m === 'keepAlive').length, 1);
});

test('the warning stays for the user: the ping alone, no method, after "Pausar" or a logout', async () => {
  for (const local of [{ settings: { keepMethod: 'ping' } }, { settings: { keepMethod: 'none' } }, { paused: 'user' }, { paused: true }]) {
    const r = await run({ loggedIn: true, local });
    const box = warningBox();
    await r.warn(box);
    assert.equal(box.clicks, 0, JSON.stringify(local));
    assert.ok(!r.messages.includes('keepAlive'));
  }
  const both = await run({ loggedIn: true, local: { settings: { keepMethod: 'both' } } });
  const box = warningBox();
  await both.warn(box);
  assert.equal(box.clicks, 1, 'the ping and the button');
});

test('the page "your account does not exist" (avisosso.html?user=desconocido): the background clears the cookies, then the portal; not twice', async () => {
  const r = await run({ pathname: '/avisosso.html', search: '?user=desconocido' });
  assert.deepEqual(r.assigned, ['/portal'], 'the portal first: it gives new cookies, and its automatic login logs in');
  assert.deepEqual(r.messages, ['loginStart', 'navigate'], 'nothing else on that page');
  const again = await run({ pathname: '/avisosso.html', search: '?user=desconocido', granted: false });
  assert.deepEqual(again.assigned, [], 'a repair of the last minutes: the page stays (no loop)');
  const other = await run({ pathname: '/avisosso.html', search: '?user=otro', loggedIn: true });
  assert.ok(!other.messages.includes('loginStart'), 'another notice of that page: nothing');
});

test('the login pages are not changed', async () => {
  const r = await run({ pathname: '/sakai-login-tool/container/saml/login' });
  assert.deepEqual(r.assigned, []);
  assert.deepEqual(r.messages, []);
});
