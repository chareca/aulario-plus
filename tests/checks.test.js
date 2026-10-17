'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, fakeFetch } = require('./helpers');
const F = require('./fixtures/miaulario');
const MAK = loadLib('core', 'store', 'api', 'grades', 'pm', 'checks');

const ctx = (routes) => ({ api: MAK.createApi({ fetch: fakeFetch(routes) }), now: F.NOW, getDoc: async () => { throw new Error('no DOM in Node'); }, pm: null });

test('the API checks pass with data in the form of MiAulario', async () => {
  const r = await MAK.runChecks(ctx(F.routes()), { areas: ['api'] });
  assert.deepEqual(r.filter((x) => x.ok !== true).map((x) => [x.id, x.detail]), []);
  assert.deepEqual(r.map((x) => x.id), ['session', 'sites', 'pages', 'assignments', 'announcements', 'notifications', 'synoptic', 'forums', 'resources', 'calendar', 'grades']);
  assert.match(r.find((x) => x.id === 'pages').detail, /pages, \d+ tools in the test site/);
});

test('a changed field fails only its check, and tells the field', async () => {
  const routes = F.routes();
  routes['/direct/assignment/my.json'] = { assignment_collection: F.ASSIGNMENTS.map(({ dueTime, ...rest }) => rest) };
  const r = await MAK.runChecks(ctx(routes), { areas: ['api'] });
  const bad = r.filter((x) => x.ok === false);
  assert.deepEqual(bad.map((x) => x.id), ['assignments']);
  assert.match(bad[0].detail, /dueTime/);
});

test('an empty list passes, but tells that the fields were not checked', async () => {
  const routes = F.routes();
  routes['/direct/calendar/my.json'] = { calendar_collection: [] };
  const r = (await MAK.runChecks(ctx(routes), { areas: ['api'] })).find((x) => x.id === 'calendar');
  assert.equal(r.ok, true);
  assert.match(r.detail, /^0 events \(the fields were not checked\)$/);
});

test('without a session: the first check fails and the checks after it are skipped', async () => {
  const routes = F.routes();
  routes['/direct/session/current.json'] = { userId: null };
  const r = await MAK.runChecks(ctx(routes), { areas: ['api'] });
  assert.equal(r[0].ok, false);
  assert.match(r[0].detail, /log in/);
  assert.ok(r.slice(1).every((x) => x.ok === null && /skipped/.test(x.detail)));
});

test('an API error (not JSON, HTTP 500) is a failed check with its code', async () => {
  const routes = F.routes();
  routes['/api/users/me/grades'] = fakeFetch.raw({ ok: false, status: 500, headers: { get: () => 'text/html' }, text: async () => '' });
  const r = (await MAK.runChecks(ctx(routes), { areas: ['api'] })).find((x) => x.id === 'grades');
  assert.equal(r.ok, false);
  assert.match(r.detail, /500/);
});

test('the report has the results and no personal data', async () => {
  const r = await MAK.runChecks(ctx(F.routes()), { areas: ['api'] });
  const text = MAK.checksReport(r, { version: '1.5.0', date: '2026-10-17' });
  assert.match(text, /^Aulario Plus 1\.5\.0 · MiAulario checks · 2026-10-17\n11\/11 without errors\n✓ session: active session/);
  for (const s of F.SITES) assert.ok(!text.includes(s.title), 'no site names');
  assert.ok(!text.includes('chareca'), 'no user ids');
});
