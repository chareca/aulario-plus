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

test('"Pausar" stays until "Reanudar": a ping only reads the session (no keep-alive), and a new login does not continue it', async () => {
  const log = [];
  const bg = loadBackground({ fetch: fakeFetch(F.routes(), log), local: { paused: 'user' }, keepSession: true });
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
  const bg = loadBackground({ fetch, keepSession: true });
  const before = Date.now();
  await bg.fireAlarm('miaulario-ping');
  const alarm = bg.ext._alarms.get('miaulario-ping');
  const delay = (alarm.scheduledTime - before) / 1000;
  assert.ok(delay >= 180 && delay <= 601, `delay ${delay}`);
  assert.equal(pings, 1);
  assert.equal(bg.ext.storage.local.data.last.loggedIn, true);
  assert.equal(bg.ext.storage.local.data.last.status, 200);
});

test('keeping the session off (MAK.KEEP_SESSION): the ping only reads the session; the notice of MiAulario once', async () => {
  const log = [];
  const bg = loadBackground({ fetch: fakeFetch(F.routes(), log) });
  assert.equal(bg.MAK.KEEP_SESSION, false, 'off in lib/core.js');
  await bg.fireAlarm('miaulario-ping');
  const reads = log.filter((x) => x.url.includes('/direct/session/current.json'));
  assert.ok(reads.length && reads.every((x) => x.url.includes('auto=true')), 'no request without auto=true: Sakai records no activity');
  assert.equal(bg.ext.storage.local.data.last.loggedIn, true, 'the state of the session for the popup');
  const shown = await Promise.all([1, 2].map(() => bg.send({ type: 'keepOffNotice' }, CONTENT())));
  assert.deepEqual(shown.map((r) => r.show).sort(), [false, true], 'two tabs at once: one window');
  assert.equal((await bg.send({ type: 'keepOffNotice' }, CONTENT())).show, false, 'only once');
  assert.equal((await loadBackground({ keepSession: true }).send({ type: 'keepOffNotice' }, CONTENT())).show, false, 'with the session kept: no notice');
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
  const bg = loadBackground({ fetch: fakeFetch(F.routes(), log), local: { paused: true }, keepSession: true });
  assert.ok(await bg.send({ type: 'pingNow' }));
  assert.equal(bg.ext.storage.local.data.paused, false);
  assert.ok(log[0].url.includes('auto=true'), 'first a read without activity');
  assert.ok(!log[1].url.includes('auto=true'), 'then the keep-alive ping');
  const status = await bg.send({ type: 'getStatus' });
  assert.deepEqual(Object.keys(status).sort(), ['autoLogin', 'nextPing', 'paused']);
});
