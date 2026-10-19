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
// The synthetic pages of the internal mail (also used by the browser tests).
fs.copyFileSync(path.join(__dirname, '..', 'browser', 'fixtures-pm.js'), path.join(OUT, 'fixtures-pm.js'));

const data = F.make(Date.now());
// Titles in the form of the UPNA (code + capital letters), as in the real MiAulario.
const UPNA_TITLES = { [F.MATH]: '26_0_100001_1_G MATEMÁTICAS I', [F.CS]: '26_0_100002_1_G INFORMÁTICA Y PROGRAMACIÓN' };
for (const s of data.SITES) if (UPNA_TITLES[s.id]) s.title = UPNA_TITLES[s.id];
const routes = data.routes();
const withoutCode = (t) => t.replace(/^\d+(?:_[0-9A-Za-z]+)+\s+/, '');
const csTitle = data.SITES.find((s) => s.id === F.CS).title;
// File bodies for the ZIP tests: each file URL answers with a small text.
for (const site of data.SITES) {
  for (const r of data.resources(site.id)) {
    if (r.type !== 'collection' && r.type !== 'text/url') {
      routes[new URL(r.url).pathname] = { __file: `Synthetic content of ${decodeURIComponent(new URL(r.url).pathname)}\n`, type: r.type };
    }
  }
}

// The members of the site of site.html, for "Write to a teacher": the person of the fake compose
// form is a teacher.
routes[`/direct/site/${F.CS}/memberships.json`] = { membership_collection: [{ userEid: 'agarcia', memberRole: 'Instructor' }, { userEid: 'chareca.1', memberRole: 'Student' }] };

// The course guides: the page of the tool "Guía docente" has an iframe with the public guide.
const GUIDE = { window: {} };
require('node:vm').runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'browser', 'fixtures-guide.js'), 'utf8'), GUIDE);
for (const site of [F.MATH, F.CS]) {
  routes[`/portal/tool/${site}-tool-7`] = { __file: '<html><body><iframe src="https://www.unavarra.es/ficha-asignaturaDOA/?languageId=100000&amp;codPlan=240&amp;codAsig=240999&amp;anio=2026"></iframe></body></html>', type: 'text/html; charset=UTF-8' };
}
routes['/ficha-asignaturaDOA/'] = { __file: GUIDE.window.GUIDE_HTML, type: 'text/html; charset=utf-8' };
// A second guide with long texts and values without "%", as some real guides (Mathematics).
routes['/portal/tool/' + F.MATH + '-tool-7'] = { __file: '<html><body><iframe src="https://www.unavarra.es/ficha-asignaturaDOA/?languageId=100000&amp;codPlan=240&amp;codAsig=240998&amp;anio=2026"></iframe></body></html>', type: 'text/html; charset=UTF-8' };
routes['/ficha-asignaturaDOA/?languageId=100000&codPlan=240&codAsig=240998&anio=2026'] = { __file: GUIDE.window.GUIDE_HTML
  .replace('<td>Examen teórico-práctico</td><td>60%</td><td>Sí, en el examen de recuperación</td><td>5 sobre 10</td>', '<td>Trabajo en grupo en el que se aplican los conocimientos adquiridos para construir un compilador</td><td>60</td><td>Recuperable mediante una prueba de laboratorio en la que el alumno corregirá los defectos que el profesor le señale</td><td>Nota mínima para que pondere en la calificación: 4,5 sobre 10</td>')
  .replace('<td>30 %</td><td>No</td><td>No</td>', '<td>30</td><td>NO</td><td>N/A</td>').replace('Código: 240999', 'Código: 240998'), type: 'text/html; charset=utf-8' };

// The shortcuts of "Mi sitio": the list of degrees, the page "Evaluación" of the degree of the guides
// (Computer Science) and its exam calendar (a small PDF with the two subjects of the guides).
const DEGREE = { window: {} };
require('node:vm').runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'browser', 'fixtures-degree.js'), 'utf8'), DEGREE);
routes['/sites/grados/home.html'] = { __file: DEGREE.window.DEGREE_LIST_HTML.replace('</ul>', '<li><a href="/sites/grados/informatica-y-telecomunicacion/computer-science.html">Grado en Computer Science</a></li></ul>'), type: 'text/html; charset=utf-8' };
routes['/sites/grados/informatica-y-telecomunicacion/computer-science/evaluacion.html'] = { __file: DEGREE.window.EVALUATION_INF_HTML, type: 'text/html; charset=utf-8' };
{
  const rows = 'BT [(240998)-1027(MATEM\\301TICAS I)-13989(17/12/2026)-568(08:00)-18230(19/01/2027)-1126(08:00)]TJ ET\nBT [(240999)-1027(COMPUTER SCIENCE)-13989(11/01/2027)-568(16:00)-18230(22/01/2027)-1126(12:00)]TJ ET';
  const body = require('node:zlib').deflateSync(Buffer.from(rows, 'latin1'));
  const pdf = Buffer.concat([Buffer.from(`%PDF-1.6\n1 0 obj\r<</Length ${body.length}/Filter/FlateDecode>>stream\r\n`, 'latin1'), body, Buffer.from('\r\nendstream\rendobj\r%%EOF', 'latin1')]);
  routes['/gesadj/CyD1/ETSIIT/Examenes/Grados/Otono/999_otono.pdf'] = { __bytes: pdf.toString('base64'), type: 'application/pdf' };
}

// The files of the Resources list of site.html (the mail window and the download links).
routes[`/access/content/group/${F.CS}/Pr%C3%A1ctica%202.zip`] = { __file: 'Synthetic content of Práctica 2.zip\n', type: 'application/zip' };

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
    if (body && body.__bytes) return new Response(Uint8Array.from(atob(body.__bytes), (c) => c.charCodeAt(0)), { status: 200, headers: { 'content-type': body.type } });
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
    cookies: { onChanged: on([]), get: async () => null, getAll: async () => [], set: async () => {}, remove: async () => {} },
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
// No real upload in the harness: the download link of Send is a fixed answer after a short time.
fs.writeFileSync(path.join(OUT, 'send-harness.js'), `MAK.sendLink = async (o) => {
  await new Promise((r) => setTimeout(r, 700));
  window.__sendUploads = (window.__sendUploads || []).concat([{ name: o.name, size: o.data.length, mode: o.mode }]);
  return { link: o.mode === 'key' ? 'https://spoo.me/Demo12#nPjepisRUBuN80t_uD5AKA' : 'https://spoo.me/Demo12', password: o.mode === 'password' ? 'k7m2x9qp' : null, downloads: o.downloads, expires: Date.now() + o.seconds * 1000 };
};
`);

for (const page of ['popup.html', 'tools.html']) {
  const file = path.join(OUT, page);
  if (!fs.existsSync(file)) continue;
  const tags = ['mock-ext.js', ...libs, 'bg-harness.js', 'send-harness.js'].map((s) => `<script src="${s}"></script>`).join('\n  ');
  const html = fs.readFileSync(file, 'utf8').replace(/<script src="/, `${tags}\n  <script src="`);
  fs.writeFileSync(file, html);
}
// A page with the same structure as a MiAulario site, to see the banner of new items.
// Open site.html?theme=dark for the dark theme of Sakai.
const siteTags = ['mock-ext.js', ...libs, 'bg-harness.js', 'send-harness.js', 'lib/core.js', 'lib/i18n.js', 'lib/ui.js', 'lib/pm.js', 'lib/teachers.js', 'lib/guide.js', 'lib/degree.js', 'lib/mail-ui.js', 'content-banner.js', 'content-guide.js', 'content-shortcuts.js', 'content-early.js', 'content-names.js', 'content-search.js', 'content-mail.js', 'fixtures-pm.js'].map((s) => `<script src="${s}"></script>`).join('\n');
fs.writeFileSync(path.join(OUT, 'site.html'), `<!doctype html>
<html lang="es" class="Mrphs-html">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base href="/"><title>MiAulario/NireIkasgelategia : ${csTitle} : Inicio</title>
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
    ${data.SITES.map((s) => `<li class="site-list-item" data-site="${s.id}"><div class="site-link-block"><a class="sidebar-site-title" href="#" title="${s.title}">${withoutCode(s.title)}</a></div></li>`).join('')}
  </ul>
</aside>
<main id="content" class="portal-main-content">
  <h1 id="tocontent" style="position:absolute;left:-9999px">Los contenidos empiezan aquí</h1>
  <div class="portal-header-breadcrumb"><div id="header-site-title" class="portal-header-breadcrumb-item portal-header-site-title"><a href="#">${csTitle}</a></div> › Inicio</div>
  <div class="row"><p>Contenido del sitio (simulado).</p>
  <table class="table table-striped table-hover"><tbody>
    <tr><td class="attach"><input type="checkbox" name="selectall"></td><td class="specialLink title">Título</td></tr>
    <tr><td class="attach"><input type="checkbox" name="selectedMembers" value="/group/${F.CS}/Apuntes/"></td><td class="specialLink title"><a href="#">Apuntes</a></td></tr>
    <tr><td class="attach"><input type="checkbox" name="selectedMembers" value="/group/${F.CS}/Apuntes/Tema 1.pdf"></td><td class="specialLink title"><a class="si" href="https://miaulario.unavarra.es/access/content/group/${F.CS}/Apuntes/Tema%201.pdf"></a><a href="https://miaulario.unavarra.es/access/content/group/${F.CS}/Apuntes/Tema%201.pdf">Tema 1.pdf</a></td></tr>
    <tr><td class="attach"><input type="checkbox" name="selectedMembers" value="/group/${F.CS}/Práctica 2.zip"></td><td class="specialLink title"><a href="https://miaulario.unavarra.es/access/content/group/${F.CS}/Pr%C3%A1ctica%202.zip">Práctica 2.zip</a></td></tr>
  </tbody></table></div>
</main>
<script>if (new URLSearchParams(location.search).get('theme') === 'dark') document.documentElement.classList.add('sakaiUserTheme-dark');</script>
<script>history.replaceState(null, '', (new URLSearchParams(location.search).has('mine') ? '/portal' : '/portal/site/${F.CS}') + location.search); // the path of a site (or "Mi sitio" with ?mine), as in MiAulario</script>
${siteTags}
<script>
  // Show the banner: install time 10 days ago, then a visit of Computer Science.
  // A fake engine of the internal mail: the same compose form as the real one, and a log.
  window.__pmLog = [];
  MAK.createPm = function () {
    const compose = () => MAK.pmCompose(MAK.pmSnapshot(new DOMParser().parseFromString(PM_FIXTURES.COMPOSE(), 'text/html'), 'x'));
    return {
      open: async (placement) => { __pmLog.push(['open', placement]); return compose(); },
      prepare: async (c, data) => { __pmLog.push(['prepare', data]); return c; },
      send: async (c, data) => { __pmLog.push(['send', data.to]); return true; },
      cancel: async () => true
    };
  };
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
