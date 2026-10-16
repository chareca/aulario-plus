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
  assert.equal(bg.ext.storage.local.data.paused, true);
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

test('an extension page in a tab is a page, not a content script', async () => {
  const bg = loadBackground();
  const sender = { id: 'ext-id', tab: { id: 9 }, frameId: 0, url: 'chrome-extension://ext-id/tools.html' };
  assert.deepEqual(await bg.send({ type: 'pause' }, sender), { ok: true });
});

test('the ping alarm sets the next random alarm and records the ping', async () => {
  let pings = 0;
  const fetch = fakeFetch({
    '/direct/session/current.json': () => { pings++; return { userId: 'user-1', maxInactiveInterval: 3600 }; }
  });
  const bg = loadBackground({ fetch });
  const before = Date.now();
  await bg.fireAlarm('miaulario-ping');
  const alarm = bg.ext._alarms.get('miaulario-ping');
  const delay = (alarm.scheduledTime - before) / 1000;
  assert.ok(delay >= 180 && delay <= 601, `delay ${delay}`);
  assert.equal(pings, 1);
  assert.equal(bg.ext.storage.local.data.last.loggedIn, true);
  assert.equal(bg.ext.storage.local.data.log.length, 1);
});

test('the log keeps the last 50 entries when pings occur at the same time', async () => {
  const fetch = fakeFetch(F.routes());
  const bg = loadBackground({ fetch });
  await Promise.all(Array.from({ length: 60 }, () => bg.send({ type: 'pingNow' })));
  assert.equal(bg.ext.storage.local.data.log.length, 50);
});
