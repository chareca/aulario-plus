'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, fakeFetch, response } = require('./helpers');
const F = require('./fixtures/miaulario');
const MAK = loadLib('core', 'api');

test('each GET adds auto=true and sends the cookies', async () => {
  const log = [];
  let init;
  const fetch = fakeFetch(F.routes(), log);
  const api = MAK.createApi({ fetch: async (u, i) => { init = i; return fetch(u, i); } });
  const list = await api.assignments();
  assert.equal(list.length, F.ASSIGNMENTS.length);
  assert.match(log[0].url, /\/direct\/assignment\/my\.json\?auto=true$/);
  assert.equal(init.credentials, 'include');
  await api.announcements(30, 7);
  assert.match(log[1].url, /user\.json\?n=30&d=7&auto=true$/);
});

test('the API finds the array in all the response shapes', async () => {
  const api = MAK.createApi({ fetch: fakeFetch(F.routes()) });
  assert.equal((await api.notifications()).length, F.NOTIFICATIONS.length); // plain array
  assert.equal((await api.pages(F.CS)).length, 6); // plain array
  assert.equal((await api.forums(F.CS)).length, 1); // forums_collection
  assert.equal((await api.sites()).length, F.SITES.length);
  const detail = await api.forum(F.CS, 7);
  assert.equal(detail.topics.length, 2);
});

test('the API rejects HTML, bad shapes and HTTP errors', async () => {
  const routes = {
    '/direct/site.json': fakeFetch.raw(response('<html>login</html>', { type: 'text/html' })),
    '/direct/assignment/my.json': { entityPrefix: 'assignment' },
    '/direct/synopticmsgcntritem.json': fakeFetch.raw(response({}, { status: 503 })),
    '/direct/announcement/user.json': fakeFetch.raw(response({}, { status: 403 }))
  };
  const api = MAK.createApi({ fetch: fakeFetch(routes) });
  await assert.rejects(api.sites(), (e) => e.kind === 'not-json');
  await assert.rejects(api.assignments(), (e) => e.kind === 'shape');
  await assert.rejects(api.synoptic(), (e) => e.kind === 'http' && e.status === 503 && e.retryLater);
  await assert.rejects(api.announcements(1, 1), (e) => e.status === 403 && !e.retryLater);
  const offline = MAK.createApi({ fetch: async () => { throw new TypeError('offline'); } });
  await assert.rejects(offline.session(), (e) => e.kind === 'network');
});

test('markViewed sends a POST without auto=true', async () => {
  const log = [];
  const api = MAK.createApi({ fetch: fakeFetch({ '/api/users/me/notifications/markViewed': { ok: true } }, log) });
  assert.equal(await api.markViewed(F.CS, 'sakai.announcements'), true);
  assert.equal(log[0].method, 'POST');
  assert.doesNotMatch(log[0].url, /auto=true/);
  assert.match(log[0].url, /siteId=2026_0_100002_1_G&toolId=sakai\.announcements$/);
});
