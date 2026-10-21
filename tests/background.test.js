'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBackground, fakeFetch } = require('./helpers');
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

test('"Pausar" stays until "Reanudar": a ping does not continue it, not even with a session', async () => {
  const log = [];
  const bg = loadBackground({ fetch: fakeFetch(F.routes(), log), local: { paused: 'user' } });
  assert.equal(await bg.send({ type: 'pingNow' }), null);
  assert.equal(bg.ext.storage.local.data.paused, 'user');
  assert.equal(log.length, 0, 'no request');
  // A logout and a new login do not end it either.
  await bg.send({ type: 'logout' }, CONTENT({ url: 'https://miaulario.unavarra.es/portal' }));
  assert.equal(bg.ext.storage.local.data.paused, 'user');
  assert.equal(await bg.send({ type: 'pingNow' }), null);
  await bg.send({ type: 'resume' });
  assert.equal(bg.ext.storage.local.data.paused, false);
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
