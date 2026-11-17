'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBackground, fakeFetch, response } = require('./helpers');
const F = require('./fixtures/miaulario');

const CONTENT = (o = {}) => Object.assign({ id: 'ext-id', tab: { id: 1 }, frameId: 0, url: 'https://miaulario.unavarra.es/portal/site/x' }, o);

test('the popup can read the status', async () => {
  const bg = loadBackground();
  const status = await bg.send({ type: 'getStatus' });
  assert.equal(status.paused, false);
  assert.equal(status.autoLogin, true);
});

test('a content script can send only the messages that it is permitted to send', async () => {
  const bg = loadBackground();
  assert.ok(await bg.send({ type: 'getStatus' }, CONTENT()));
  assert.equal(await bg.send({ type: 'pause' }, CONTENT()), null);
  assert.equal(bg.ext.storage.local.data.paused, undefined);
  assert.deepEqual(await bg.send({ type: 'pause' }), { ok: true });
  assert.equal(bg.ext.storage.local.data.paused, 'user');
});

test('the calendar button of MiAulario saves only its setting; the other settings stay closed to a content script', async () => {
  const bg = loadBackground();
  assert.equal(await bg.send({ type: 'setSettings', patch: { examCalendar: true } }, CONTENT()), null);
  assert.deepEqual(await bg.send({ type: 'setExamCalendar', on: true }, CONTENT()), { ok: true });
  assert.equal(bg.ext.storage.local.data.settings.examCalendar, true);
  await bg.send({ type: 'setExamCalendar', on: false, lang: 'en', hiddenSites: ['x'] }, CONTENT());
  const s = bg.ext.storage.local.data.settings;
  assert.deepEqual([s.examCalendar, s.lang === 'en', s.hiddenSites.length], [false, false, 0], 'nothing else of the message');
});

test('the order of the parts of Mi sitio: only its setting, checked', async () => {
  const bg = loadBackground();
  const got = await bg.send({ type: 'setMySiteLayout', layout: { order: ['hours', 'evil', 'hours', 'exams'], shape: 'left', hidden: ['exams', 'evil'] }, lang: 'en' }, CONTENT());
  assert.deepEqual(got, { ok: true, layout: { order: ['hours', 'exams', 'guides'], shape: 'left', hidden: ['exams'] } });
  const s = bg.ext.storage.local.data.settings;
  assert.deepEqual([s.mysiteLayout, s.lang === 'en'], [got.layout, false]);
  await bg.send({ type: 'setMySiteLayout', layout: { order: 'x', shape: 'grid' } }, CONTENT());
  assert.deepEqual(bg.ext.storage.local.data.settings.mysiteLayout, { order: ['exams', 'guides', 'hours'], shape: 'rows', hidden: [] }, 'a wrong value: the usual one');
});

test('"Pausar" stays until "Reanudar": a ping only reads the session (no keep-alive), and a new login does not continue it', async () => {
  const log = [];
  const bg = loadBackground({ fetch: fakeFetch(F.routes(), log), local: { paused: 'user' }, keepMethod: 'ping' });
  assert.equal((await bg.send({ type: 'pingNow' })).loggedIn, true, 'the state of the session for the popup');
  assert.equal(bg.ext.storage.local.data.paused, 'user');
  assert.ok(log.length && log.every((x) => x.url.includes('auto=true')), 'no keep-alive request');
  // A logout and a new login do not end it either.
  await bg.send({ type: 'logout' }, CONTENT({ url: 'https://miaulario.unavarra.es/portal' }));
  assert.equal(bg.ext.storage.local.data.paused, 'user');
  await bg.send({ type: 'pingNow' });
  assert.equal(bg.ext.storage.local.data.paused, 'user');
  await bg.send({ type: 'resume' });
  assert.equal(bg.ext.storage.local.data.paused, false);
});

test('one automatic login at a time for all the tabs, none in the 3 minutes after a login, and none during a login of the user', async () => {
  const bg = loadBackground();
  const tabs = await Promise.all([1, 2, 3].map((id) => bg.send({ type: 'loginStart' }, CONTENT({ tab: { id } }))));
  assert.deepEqual(tabs.filter(Boolean), [{ ok: true }], 'several tabs at once: one login');
  assert.equal(await bg.send({ type: 'loginStart' }, CONTENT()), null, 'that login gave no session: no second login (no loop)');
  const later = loadBackground();
  assert.deepEqual(await later.send({ type: 'loginStart', user: true }, CONTENT()), { ok: true }, 'a click of the user on a login link');
  assert.equal(await later.send({ type: 'loginStart' }, CONTENT({ tab: { id: 2 } })), null, 'no automatic login during it');
  const area = later.ext.storage.session || later.ext.storage.local;
  await area.set({ loginAt: Date.now() - 4 * 60000 });
  assert.deepEqual(await later.send({ type: 'loginStart' }, CONTENT()), { ok: true }, 'after 3 minutes, again');
});

test('messages from other origins, other frames, other extensions or with an unknown type are rejected', async () => {
  const bg = loadBackground();
  assert.equal(await bg.send({ type: 'getStatus' }, CONTENT({ url: 'https://evil.example/' })), null);
  assert.equal(await bg.send({ type: 'getStatus' }, CONTENT({ frameId: 3 })), null);
  assert.equal(await bg.send({ type: 'getStatus' }, CONTENT({ id: 'other-ext' })), null);
  assert.equal(await bg.send({ type: 'toString' }), null);
  assert.equal(await bg.send({ type: '__proto__' }), null);
  assert.equal(await bg.send(null), null);
});

test('a message without a tab and without an address of the extension is rejected (fail closed)', async () => {
  const bg = loadBackground();
  assert.equal(await bg.send({ type: 'pause' }, { id: 'ext-id' }), null);
  assert.equal(await bg.send({ type: 'pause' }, { id: 'ext-id', url: 'https://miaulario.unavarra.es/portal' }), null);
  assert.equal(bg.ext.storage.local.data.paused, undefined);
  assert.equal((await bg.send({ type: 'pendingMarkViewedDone', siteId: 'x'.repeat(201), toolId: 't', ok: false }, CONTENT())).ok, false, 'a long id');
});

test('"Danger zone": wipeAll deletes all the data, the alarms, the notifications and the optional permissions; then nothing until "resume"', async () => {
  const bg = loadBackground({ local: { settings: { lang: 'en' }, history: { at: 1, items: {} }, record: { rows: [] }, sites: [{ id: 'x' }], paused: false } });
  bg.ext.runtime.getManifest = () => ({ version: '9.9.9', optional_host_permissions: ['https://www2.unavarra.es/*', 'https://academicos.unavarra.es/*'] });
  await bg.ext.permissions.request({ origins: ['https://www2.unavarra.es/*', 'https://academicos.unavarra.es/*'] });
  await bg.ext.alarms.create('miaulario-ping', { when: Date.now() + 60000 });
  await bg.ext.notifications.create('grade-1', {});
  await bg.ext.storage.session.set({ lock: 1, recordRun: { tabId: 7, at: Date.now(), shown: false } }); // a reading of SIGMA is open
  assert.equal(await bg.send({ type: 'wipeAll' }, CONTENT()), null, 'not from a page of MiAulario');
  assert.deepEqual(await bg.send({ type: 'wipeAll' }), { ok: true });
  assert.deepEqual(bg.ext.storage.local.data, { paused: 'reset' });
  assert.deepEqual([bg.ext._alarms.size, bg.ext._notes.size, bg.ext._granted.size, Object.keys(bg.ext.storage.session.data).length], [0, 0, 0, 0]);
  assert.deepEqual(bg.ext._tabs.removed, [7], 'the tab of the reading closes');
  await bg.ext.permissions.request({ origins: ['https://www2.unavarra.es/*', 'https://academicos.unavarra.es/*'] });
  assert.deepEqual(await bg.send({ type: 'recordOpen' }), { error: 'record.paused' }, 'no reading of SIGMA while empty');
  // Empty until the user starts again: no message of the pages, no ping, no alarm at a start of the browser.
  assert.equal(await bg.send({ type: 'getStatus' }, CONTENT()), null);
  assert.equal(await bg.send({ type: 'pingNow' }), null);
  // The popup opens (touch) and shows the grades: nothing is kept.
  await bg.send({ type: 'touch' });
  await bg.send({ type: 'markGradesSeen' });
  assert.deepEqual(bg.ext.storage.local.data, { paused: 'reset' }, 'only the mark of the reset');
  for (const f of bg.ext._listeners.startup) await f();
  assert.equal(bg.ext._alarms.size, 0);
  assert.deepEqual(await bg.send({ type: 'resume' }), { ok: true });
  assert.equal(bg.ext.storage.local.data.paused, false);
  assert.ok(bg.ext._alarms.get('miaulario-ping'), 'the alarms again');
  assert.ok(await bg.send({ type: 'getStatus' }, CONTENT()));
});

test('"Borrar todos los datos" wins over a ping that waits for MiAulario, and a deletion cut by the end of the browser ends at the next start', async () => {
  let release;
  const slow = new Promise((r) => { release = r; });
  const routes = F.routes();
  const session = routes['/direct/session/current.json'];
  routes['/direct/session/current.json'] = async (...a) => { await slow; return typeof session === 'function' ? session(...a) : session; };
  const bg = loadBackground({ fetch: fakeFetch(routes), local: { paused: true, sites: [{ id: 'x' }] } });
  const ping = bg.send({ type: 'pingNow' }); // a logout: the ping sees if the user logged in again, and waits
  assert.deepEqual(await bg.send({ type: 'wipeAll' }), { ok: true });
  release();
  assert.equal(await ping, null);
  assert.deepEqual(bg.ext.storage.local.data, { paused: 'reset' }, 'no "paused: false" and no "last" after the deletion');
  // The browser closed in the middle of a deletion: the next start removes what is left, not the settings that the
  // user changed in the popup after the deletion.
  const next = loadBackground({ local: { paused: 'reset', sites: [{ id: 'x' }], history: { at: 1, items: {} }, settings: { lang: 'en' } } });
  for (const f of next.ext._listeners.startup) await f();
  assert.deepEqual(next.ext.storage.local.data, { paused: 'reset', settings: { lang: 'en' } });
});

test('"Importar mi configuración": all or nothing, checked again here; not from a page of MiAulario. The copy of the boxes of Mi sitio', async () => {
  const local = { settings: { theme: 'cromo', teacherBody: 'Un saludo', nicknames: { a: 'A' } }, pageUi: { 'mak-mysite-wide': '1' }, sitePhotos: { s1: 1 } };
  const bg = loadBackground({ local: JSON.parse(JSON.stringify(local)) });
  const file = { settings: { theme: 'galaxia', nicknames: { c: 'C' }, colorMode: 'nope', notifyDue: 'no' }, ui: { 'mak-mysite-closed': '1' }, sitePhotos: { s2: 2 } };
  assert.equal(await bg.send({ type: 'importSettings', file }, CONTENT()), null, 'not from a page of MiAulario');
  for (const bad of [null, [], 'x']) assert.deepEqual(await bg.send({ type: 'importSettings', file: bad }), { ok: false });
  assert.deepEqual([bg.ext.storage.local.data.settings, bg.ext.storage.local.data.pageUi], [local.settings, local.pageUi], 'nothing changed');
  assert.deepEqual(await bg.send({ type: 'importSettings', file }), { ok: true });
  const d = bg.ext.storage.local.data;
  assert.deepEqual([d.settings.theme, d.settings.nicknames, d.settings.colorMode, d.settings.notifyDue, d.settings.teacherBody], ['galaxia', { c: 'C' }, 'auto', true, 'Un saludo']);
  assert.deepEqual([d.pageUi, d.sitePhotos, typeof d.pageUiImport], [{ 'mak-mysite-wide': '1', 'mak-mysite-closed': '1' }, { s1: 1, s2: 2 }, 'number'], 'the pages of MiAulario take the boxes');
  // The copy of the boxes: from the pages of MiAulario, only the right keys and values.
  assert.deepEqual(await bg.send({ type: 'saveUi', states: { 'mak-sem:exams:autumn': '0', evil: '1', 'mak-x': 'yes' } }, CONTENT()), { ok: true });
  assert.deepEqual(bg.ext.storage.local.data.pageUi, { 'mak-mysite-wide': '1', 'mak-mysite-closed': '1', 'mak-sem:exams:autumn': '0' });
  assert.deepEqual(await bg.send({ type: 'saveUi', states: { evil: '1' } }, CONTENT()), { ok: false });
});

test('an extension page in a tab is a page, not a content script', async () => {
  const bg = loadBackground();
  const sender = { id: 'ext-id', tab: { id: 9 }, frameId: 0, url: 'chrome-extension://ext-id/tools.html' };
  assert.deepEqual(await bg.send({ type: 'pause' }, sender), { ok: true });
});

test('the ping alarm sets the next random alarm and records the ping', async () => {
  let pings = 0;
  const fetch = fakeFetch({
    // Only a request without auto=true is a keep-alive ping. The sync reads the session with auto=true.
    '/direct/session/current.json': (url) => {
      if (!url.includes('auto=true')) pings++;
      return { userId: 'user-1', maxInactiveInterval: 3600 };
    }
  });
  const bg = loadBackground({ fetch, keepMethod: 'ping' });
  const before = Date.now();
  await bg.fireAlarm('miaulario-ping');
  const alarm = bg.ext._alarms.get('miaulario-ping');
  const delay = (alarm.scheduledTime - before) / 1000;
  assert.ok(delay >= 180 && delay <= 601, `delay ${delay}`);
  assert.equal(pings, 1);
  assert.equal(bg.ext.storage.local.data.last.loggedIn, true);
  assert.equal(bg.ext.storage.local.data.last.status, 200);
});

test('the method that keeps the session: with the button (the default) or none, the ping only reads the session; the request of the button only with its method', async () => {
  const keepAlives = (log) => log.filter((x) => x.url.includes('/direct/session/current.json') && !x.url.includes('auto=true')).length;
  const at = (keepMethod, local) => {
    const log = [];
    return { log, bg: loadBackground({ fetch: fakeFetch(F.routes(), log), keepMethod, local }) };
  };
  const usual = at();
  assert.equal(usual.bg.MAK.defaultSettings().keepMethod, 'button');
  await usual.bg.fireAlarm('miaulario-ping');
  assert.equal(keepAlives(usual.log), 0, 'no request without auto=true: the button of MiAulario keeps the session');
  assert.equal(usual.bg.ext.storage.local.data.last.loggedIn, true, 'the state of the session for the popup');
  // content.js saw the warning without its button: the request from the background.
  assert.deepEqual(await usual.bg.send({ type: 'keepAlive' }, CONTENT()), { ok: true });
  assert.equal(keepAlives(usual.log), 1);
  for (const [keepMethod, local, pings, asked] of [['both', {}, 1, true], ['ping', {}, 1, false], ['none', {}, 0, false], ['button', { paused: 'user' }, 0, false]]) {
    const { bg, log } = at(keepMethod, local);
    await bg.send({ type: 'pingNow' });
    assert.equal(keepAlives(log), pings, `${keepMethod}: the ping`);
    assert.equal((await bg.send({ type: 'keepAlive' }, CONTENT())).ok, asked, `${keepMethod} ${JSON.stringify(local)}: the request of the button`);
  }
  // The setting changes: the new method at once, not at the next alarm.
  await usual.bg.send({ type: 'setSettings', patch: { keepMethod: 'ping' } });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(keepAlives(usual.log), 2);
  assert.equal((await usual.bg.send({ type: 'setSettings', patch: { keepMethod: 'x' } })).keepMethod, 'button', 'a wrong value: the default');
});

test('the news of a new version: one window over MiAulario after the update (not after an install), with its line, once; the bar of the popup goes with it', async () => {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const updated = (local) => {
    const bg = loadBackground({ local });
    bg.ext.runtime.getManifest = () => ({ version: '1.6.7' });
    return bg;
  };
  const bg = updated({});
  for (const f of bg.ext._listeners.installed) await f({ reason: 'update', previousVersion: '1.6.6' });
  await tick();
  assert.equal(bg.ext.storage.local.data.whatsNew, '1.6.7');
  const two = await Promise.all([1, 2].map(() => bg.send({ type: 'pageNotice' }, CONTENT())));
  const shown = two.filter((r) => r.kind);
  assert.equal(shown.length, 1, 'two tabs at once: one window');
  assert.deepEqual([shown[0].kind, shown[0].version, shown[0].text], ['release', '1.6.7', bg.MAK.changesOf('1.6.7').short.es]);
  assert.equal(bg.ext.storage.local.data.whatsNew, undefined, 'seen: the bar of the popup goes too');
  assert.equal((await bg.send({ type: 'pageNotice' }, CONTENT())).kind, undefined, 'only once');
  assert.deepEqual(await bg.send({ type: 'openNews' }, CONTENT()), { ok: true });
  assert.equal(bg.ext._tabs.at(-1).url, 'chrome-extension://ext-id/tools.html?news', '"Ver todas las novedades"');
  // An install: the welcome page, no window of news.
  const fresh = updated({});
  for (const f of fresh.ext._listeners.installed) await f({ reason: 'install' });
  await tick();
  assert.deepEqual([(await fresh.send({ type: 'pageNotice' }, CONTENT())).kind, (await fresh.send({ type: 'pageNotice' }, CONTENT())).kind], [undefined, undefined]);
});

test('the popup reads the session when it opens and with ↻, not only at the next alarm', async () => {
  const routes = F.routes();
  const session = routes['/direct/session/current.json'];
  const loggedOut = () => fakeFetch.raw(response('<html>login</html>', { type: 'text/html' }));
  routes['/direct/session/current.json'] = loggedOut;
  const bg = loadBackground({ fetch: fakeFetch(routes) });
  await bg.send({ type: 'pingNow' }); // the ping of the install, before the login
  assert.equal(bg.ext.storage.local.data.last.loggedIn, false);
  routes['/direct/session/current.json'] = session; // the user logs in
  await bg.send({ type: 'touch' });
  assert.equal(bg.ext.storage.local.data.last.loggedIn, true, 'the popup opens: no "Sin sesión"');
  routes['/direct/session/current.json'] = loggedOut; // the session ends
  await bg.send({ type: 'syncNow' });
  assert.equal(bg.ext.storage.local.data.last.loggedIn, false, 'the button ↻');
});

test('a paused extension resumes when the user logs in again, and only then pings', async () => {
  const log = [];
  const bg = loadBackground({ fetch: fakeFetch(F.routes(), log), local: { paused: true }, keepMethod: 'ping' });
  assert.ok(await bg.send({ type: 'pingNow' }));
  assert.equal(bg.ext.storage.local.data.paused, false);
  assert.ok(log[0].url.includes('auto=true'), 'first a read without activity');
  assert.ok(!log[1].url.includes('auto=true'), 'then the keep-alive ping');
  const status = await bg.send({ type: 'getStatus' });
  assert.deepEqual(Object.keys(status).sort(), ['autoLogin', 'nextPing', 'paused']);
});

test('libraryHours: the hours of the library of the campus of the settings, kept for 12 hours; after an error, the last ones', async () => {
  const L = require('./fixtures/library');
  const routes = L.routes();
  let up = true;
  const asked = [];
  const fetch = async (url) => {
    asked.push(String(url));
    const body = routes[String(url)];
    if (!up || body === undefined) return new Response('no', { status: up ? 404 : 503 });
    return new Response(body, { status: 200 });
  };
  const bg = loadBackground({ fetch, local: { settings: { libraryCampus: 'tudela' } } });
  const first = await bg.send({ type: 'libraryHours' }, CONTENT());
  assert.deepEqual([first.data.campus, first.data.page.lines[0], first.error], ['tudela', 'Lunes a viernes: 8:00 a 21:00 horas.', undefined]);
  assert.ok(asked.length && asked.every((u) => u.startsWith('https://www.unavarra.es/')), 'only the website of the UPNA');
  const n = asked.length;
  assert.equal((await bg.send({ type: 'libraryHours' }, CONTENT())).data.at, first.data.at, 'kept');
  assert.equal(asked.length, n, 'no request while it is kept');
  // Another campus: read again. The website does not answer: the last hours of that campus, with the error.
  await bg.ext.storage.local.set({ settings: Object.assign({}, (await bg.ext.storage.local.get('settings')).settings, { libraryCampus: 'salud' }) });
  const salud = await bg.send({ type: 'libraryHours' }, CONTENT());
  assert.equal(salud.data.campus, 'salud');
  up = false;
  await bg.ext.storage.local.set({ library: Object.assign({}, salud.data, { at: Date.now() - 13 * 3600000 }) });
  const stale = await bg.send({ type: 'libraryHours' }, CONTENT());
  assert.deepEqual([stale.data.campus, stale.error], ['salud', 'library.network']);
  await bg.ext.storage.local.set({ settings: { libraryCampus: 'arrosadia' } });
  assert.deepEqual(await bg.send({ type: 'libraryHours' }, CONTENT()), { error: 'library.network', fresh: [] }, 'no hours of another campus');
});

test('libraryHours: another campus during a reading: the slow reading of the campus before does not replace the new one', async () => {
  const routes = require('./fixtures/library').routes();
  let release;
  const gate = new Promise((r) => { release = r; });
  const fetch = async (url) => {
    if (/Campus\+de\+Tudela/.test(String(url))) await gate; // the reading of Tudela waits on its page
    return routes[String(url)] === undefined ? new Response('no', { status: 404 }) : new Response(routes[String(url)], { status: 200 });
  };
  const bg = loadBackground({ fetch, local: { settings: { libraryCampus: 'tudela' } } });
  const tudela = bg.send({ type: 'libraryHours' }, CONTENT());
  await new Promise((r) => setTimeout(r, 20));
  await bg.ext.storage.local.set({ settings: { libraryCampus: 'salud' } });
  assert.equal((await bg.send({ type: 'libraryHours' }, CONTENT())).data.campus, 'salud');
  release();
  assert.equal((await tudela).data.campus, 'tudela', 'the tab that asked for Tudela gets it');
  assert.equal((await bg.ext.storage.local.get('library')).library.campus, 'salud', 'kept: the campus of the settings');
});

test('libraryHours: the notices that a campus did not show yet, once each (also two tabs at once)', async () => {
  const routes = require('./fixtures/library').routes();
  const fetch = async (url) => (routes[String(url)] === undefined ? new Response('no', { status: 404 }) : new Response(routes[String(url)], { status: 200 }));
  const bg = loadBackground({ fetch, local: { settings: { libraryCampus: 'salud' } } });
  const [a, b] = await Promise.all([bg.send({ type: 'libraryHours' }, CONTENT()), bg.send({ type: 'libraryHours' }, CONTENT())]);
  const urls = a.data.notices.map((n) => n.url);
  assert.ok(urls.length, 'the fixture has a notice for Salud now');
  assert.deepEqual([[...a.fresh, ...b.fresh].sort(), (await bg.send({ type: 'libraryHours' }, CONTENT())).fresh], [urls.sort(), []]);
  assert.deepEqual((await bg.ext.storage.local.get('librarySeen')).librarySeen, urls.map((u) => `salud:${u}`));
});

test('libraryHours: hours kept by an older version (without the sports) are read again at once', async () => {
  const routes = require('./fixtures/library').routes();
  const fetch = async (url) => (routes[String(url)] === undefined ? new Response('no', { status: 404 }) : new Response(routes[String(url)], { status: 200 }));
  const old = { at: Date.now(), campus: 'arrosadia', page: { url: 'x', lines: ['Lunes a viernes: 8:00 a 21:00 horas.'], week: [] }, notices: [] };
  const bg = loadBackground({ fetch, local: { library: old } });
  const got = await bg.send({ type: 'libraryHours' }, CONTENT());
  assert.deepEqual([got.data.v, !!got.data.sports, got.data.sports.pool.lines.length], [bg.MAK.LIBRARY_FORM, true, 3]);
});

test('the selector of sections: a page of MiAulario adds a section to the list; "Eliminar secciones" starts it in a tab of MiAulario, or opens one', async () => {
  const bg = loadBackground();
  const key = 'tool:Mrphs-sakai-summary-calendar|calendario';
  assert.deepEqual(await bg.send({ type: 'hideSection', key, title: 'Calendario' }, CONTENT()), { ok: true });
  assert.deepEqual(await bg.send({ type: 'hideSection', key, title: 'Calendario' }, CONTENT()), { ok: true }, 'twice: once in the list');
  assert.deepEqual(await bg.send({ type: 'hideSection', key: 'x', title: 'x' }, CONTENT()), { ok: false });
  assert.deepEqual(bg.ext.storage.local.data.settings.hiddenSections, [{ key, title: 'Calendario' }]);
  assert.equal(await bg.send({ type: 'pickSections' }, CONTENT()), null, 'only the pages of the extension start it');
  // No tab of MiAulario: a new one, and only its page starts the selector, once.
  assert.deepEqual(await bg.send({ type: 'pickSections' }), { ok: true, opened: true });
  const made = bg.ext._tabs.length;
  assert.equal(bg.ext._tabs.at(-1).url, 'https://miaulario.unavarra.es/portal');
  assert.deepEqual(await bg.send({ type: 'pickPending' }, CONTENT({ tab: { id: made + 5 } })), { ok: false }, 'another tab');
  assert.deepEqual(await bg.send({ type: 'pickPending' }, CONTENT({ tab: { id: made } })), { ok: true });
  assert.deepEqual(await bg.send({ type: 'pickPending' }, CONTENT({ tab: { id: made } })), { ok: false }, 'once');
  // A tab of MiAulario that answers: the selector starts there (the active one first), and no tab opens.
  const asked = [];
  bg.ext.tabs.query = async () => [{ id: 31, active: false }, { id: 32, active: true }];
  bg.ext.tabs.sendMessage = async (id, msg) => { asked.push([id, msg.type]); return true; };
  assert.deepEqual(await bg.send({ type: 'pickSections' }), { ok: true, opened: false });
  assert.deepEqual([asked, bg.ext._tabs.length], [[[32, 'pickSections']], made]);
  // A tab from before an update (no script answers): a new tab.
  bg.ext.tabs.sendMessage = async () => { throw new Error('no receiver'); };
  assert.deepEqual(await bg.send({ type: 'pickSections' }), { ok: true, opened: true });
});

test('an import of the configuration applies its method that keeps the session at once', async () => {
  const log = [];
  const bg = loadBackground({ fetch: fakeFetch(F.routes(), log) });
  await bg.send({ type: 'pingNow' });
  const before = log.length;
  assert.deepEqual(await bg.send({ type: 'importSettings', file: { settings: { keepMethod: 'ping' } } }), { ok: true });
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(log.slice(before).some((x) => x.url.includes('/direct/session/current.json') && !x.url.includes('auto=true')), 'the ping of the new method');
});

test('the selector: a part of the block of Mi sitio goes in its layout in one step; never all the parts, never an unknown one', async () => {
  const bg = loadBackground();
  assert.deepEqual(await bg.send({ type: 'hideSection', part: 'hours' }, CONTENT()), { ok: true });
  assert.deepEqual(await bg.send({ type: 'hideSection', part: 'exams' }, CONTENT()), { ok: true });
  assert.deepEqual(bg.ext.storage.local.data.settings.mysiteLayout.hidden, ['exams', 'hours']);
  assert.deepEqual(await bg.send({ type: 'hideSection', part: 'guides' }, CONTENT()), { ok: false }, 'the last part stays');
  assert.deepEqual(await bg.send({ type: 'hideSection', part: '__proto__' }, CONTENT()), { ok: false });
});
