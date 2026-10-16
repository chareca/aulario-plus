// Make a test copy of the extension pages in tests/harness/out/.
// The copy runs in a normal browser tab: a mock extension API, the real background script
// (in its own function scope) and a fetch function that answers with the synthetic data.
// Usage: node tests/harness/make.js   then open tests/harness/out/popup.html
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const F = require('../fixtures/miaulario');

const ROOT = path.join(__dirname, '..', '..');
const COMMON = path.join(ROOT, 'extension', 'common');
const OUT = path.join(__dirname, 'out');

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(COMMON, OUT, { recursive: true });

const data = F.make(Date.now());
const routes = data.routes();
// File bodies for the ZIP tests: each file URL answers with a small text.
for (const site of data.SITES) {
  for (const r of data.resources(site.id)) {
    if (r.type !== 'collection' && r.type !== 'text/url') {
      routes[new URL(r.url).pathname] = { __file: `Synthetic content of ${decodeURIComponent(new URL(r.url).pathname)}\n`, type: r.type };
    }
  }
}

// The Gradebook pages for the grade calculator.
for (const site of data.SITES) routes[`/portal/tool/${site.id}-tool-6`] = { __file: data.gradebookHtml(site.id), type: 'text/html; charset=UTF-8' };

const background = fs.readFileSync(path.join(COMMON, 'background.js'), 'utf8');
const libs = [.../importScripts\(([^)]*)\)/.exec(background)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

const mock = `// Mock extension API for the test harness. Do not ship this file.
(function () {
  const ROUTES = ${JSON.stringify(routes)};
  const listeners = { message: [], storage: [], installed: [], startup: [], alarm: [] };
  const on = (list) => ({ addListener: (f) => list.push(f), removeListener: () => {} });
  const data = {};
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  function area(store, emit) {
    return {
      get: async (keys) => {
        if (keys === null || keys === undefined) return clone(store);
        const out = {};
        if (typeof keys === 'string') keys = [keys];
        if (Array.isArray(keys)) { for (const k of keys) if (k in store) out[k] = clone(store[k]); return out; }
        for (const [k, d] of Object.entries(keys)) out[k] = k in store ? clone(store[k]) : d;
        return out;
      },
      set: async (obj) => {
        const changes = {};
        for (const [k, v] of Object.entries(obj)) { changes[k] = { oldValue: clone(store[k]), newValue: clone(v) }; store[k] = clone(v); }
        if (emit) setTimeout(() => listeners.storage.forEach((f) => f(changes, 'local')), 0);
      },
      remove: async (keys) => {
        const changes = {};
        for (const k of [].concat(keys)) { if (k in store) { changes[k] = { oldValue: clone(store[k]) }; delete store[k]; } }
        if (emit) setTimeout(() => listeners.storage.forEach((f) => f(changes, 'local')), 0);
      }
    };
  }
  const alarms = new Map();
  window.__requests = [];
  window.__badge = { text: '', color: null };
  window.__tabs = [];
  window.__notes = new Map();
  window.__mockFetch = async (url, init = {}) => {
    const u = new URL(String(url), 'https://miaulario.unavarra.es');
    u.searchParams.delete('auto');
    const key = u.pathname + (u.search || '');
    window.__requests.push({ url: String(url), method: init.method || 'GET' });
    if (init.method === 'POST') return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
    const body = key in ROUTES ? ROUTES[key] : ROUTES[u.pathname];
    if (body === undefined) return new Response('{"error":"not found"}', { status: 404, headers: { 'content-type': 'application/json' } });
    if (body && body.__file) return new Response(body.__file, { status: 200, headers: { 'content-type': body.type } });
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const id = 'harness';
  const ext = {
    runtime: {
      id,
      getURL: (p = '') => new URL(p, location.href).href,
      onMessage: on(listeners.message),
      onInstalled: on(listeners.installed),
      onStartup: on(listeners.startup),
      sendMessage: (msg) => new Promise((resolve) => {
        const sender = { id, url: location.href };
        const keep = listeners.message.some((f) => f(msg, sender, (v) => resolve(clone(v))) === true);
        if (!keep) resolve(undefined);
      })
    },
    storage: { local: area(data, true), session: area({}, false), onChanged: on(listeners.storage) },
    alarms: {
      create: async (name, info) => alarms.set(name, { name, scheduledTime: info.when || Date.now(), periodInMinutes: info.periodInMinutes }),
      get: async (name) => alarms.get(name),
      onAlarm: on(listeners.alarm)
    },
    cookies: { onChanged: on([]), get: async () => null, set: async () => {}, remove: async () => {} },
    action: {
      setBadgeText: async ({ text }) => { window.__badge.text = text; },
      setBadgeBackgroundColor: async ({ color }) => { window.__badge.color = color; },
      setBadgeTextColor: async () => {},
      setTitle: async ({ title }) => { window.__badge.title = title; }
    },
    tabs: { create: async (o) => { window.__tabs.push(o); return { id: window.__tabs.length }; } },
    notifications: {
      create: async (id, o) => { window.__notes.set(id, o); return id; },
      clear: async (id) => window.__notes.delete(id),
      getAll: async () => Object.fromEntries([...window.__notes.keys()].map((k) => [k, true])),
      onClicked: on([])
    },
    permissions: { contains: async () => true, request: async () => true }
  };
  window.chrome = ext;
  window.fetch = window.__mockFetch;
  window.__mock = { ext, listeners, data, alarms, fireAlarm: (name) => Promise.all(listeners.alarm.map((f) => f({ name }))) };
})();
`;
fs.writeFileSync(path.join(OUT, 'mock-ext.js'), mock);

// The background script in its own scope, with the mock fetch.
const bg = `(function () {
  const fetch = window.__mockFetch;
${background}
  // Start as the browser does after an install.
  setTimeout(() => window.__mock.listeners.installed.forEach((f) => f({ reason: 'install' })), 0);
})();
`;
fs.writeFileSync(path.join(OUT, 'bg-harness.js'), bg);

for (const page of ['popup.html', 'tools.html']) {
  const file = path.join(OUT, page);
  if (!fs.existsSync(file)) continue;
  const tags = ['mock-ext.js', ...libs, 'bg-harness.js'].map((s) => `<script src="${s}"></script>`).join('\n  ');
  const html = fs.readFileSync(file, 'utf8').replace(/<script src="/, `${tags}\n  <script src="`);
  fs.writeFileSync(file, html);
}
// A page with the same structure as a MiAulario site, to see the banner of new items.
// Open site.html?theme=dark for the dark theme of Sakai.
const siteTags = ['mock-ext.js', ...libs, 'bg-harness.js', 'lib/core.js', 'lib/i18n.js', 'lib/ui.js', 'content-banner.js', 'content-early.js'].map((s) => `<script src="${s}"></script>`).join('\n');
fs.writeFileSync(path.join(OUT, 'site.html'), `<!doctype html>
<html lang="es" class="Mrphs-html">
<head><meta charset="utf-8"><title>Harness: MiAulario site</title>
<style>
  body { margin: 0; font: 15px/1.5 Georgia, serif; background: #fff; color: #222; }
  html.sakaiUserTheme-dark body { background: #121212; color: #ddd; }
  main { padding: 16px 24px; }
  .portal-header-breadcrumb { padding: 6px 0 12px; font: 13px sans-serif; color: #666; }
  .row { border: 1px dashed #aaa; padding: 24px; }
</style></head>
<body>
<aside id="portal-nav-sidebar" style="font:13px sans-serif;border-bottom:1px solid #ccc;padding:6px 24px">
  <ul style="display:flex;gap:16px;list-style:none;margin:0;padding:0">
    ${data.SITES.map((s) => `<li class="site-list-item" data-site="${s.id}">${s.title}</li>`).join('')}
  </ul>
</aside>
<main id="content" class="portal-main-content">
  <h1 id="tocontent" style="position:absolute;left:-9999px">Los contenidos empiezan aquí</h1>
  <div class="portal-header-breadcrumb">Computer Science › Inicio</div>
  <div class="row"><p>Contenido del sitio (simulado).</p></div>
</main>
<script>if (new URLSearchParams(location.search).get('theme') === 'dark') document.documentElement.classList.add('sakaiUserTheme-dark');</script>
${siteTags}
<script>
  // Show the banner: install time 10 days ago, then a visit of Computer Science.
  window.showBanner = async function (siteId, compact) {
    const { meta } = await chrome.storage.local.get('meta');
    await chrome.storage.local.set({ meta: Object.assign({}, meta, { installedAt: Date.now() - 10 * 86400000 }) });
    const r = await chrome.runtime.sendMessage({ type: 'visit', siteId });
    MAK.setLang(r.lang);
    return { shown: MAK.showNewsBanner({ siteId, result: r, compact: !!compact }), total: r.news && r.news.total };
  };
</script>
</body></html>
`);
console.log(`Harness ready: ${path.join(OUT, 'popup.html')} and site.html`);
