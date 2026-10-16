'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, memoryArea, fakeFetch, response, loadBackground } = require('./helpers');
const F = require('./fixtures/miaulario');
const MAK = loadLib('core', 'store', 'api', 'grades', 'sync');

function setup({ routes = F.routes(), local = {}, now = F.NOW } = {}) {
  const area = memoryArea(local);
  const log = [];
  const clock = { t: now };
  const store = MAK.createStore(area);
  const api = MAK.createApi({ fetch: fakeFetch(routes, log) });
  const sync = MAK.createSync({ api, store, lockArea: memoryArea(), now: () => clock.t, pauseMs: 0 });
  return { area, log, clock, store, sync, routes };
}

test('the first sync stores trimmed data and marks all items as old (seen = 0)', async () => {
  const s = setup();
  const r = await s.sync.run({ force: true });
  assert.equal(r.full, true);
  assert.deepEqual(r.errors, []);
  const d = s.area.data;
  assert.equal(d.sites.length, 4);
  assert.equal(d.pages[F.CS].tools['sakai.resources'].placement, `${F.CS}-tool-2`);
  assert.equal(d.pages[F.CS].pageTools[`${F.CS}-page-1`][0], 'sakai.announcements');
  const late = d.assignments.find((a) => a.id === 'asg-late');
  assert.equal(late.due, F.NOW - 2 * F.H);
  assert.equal(late.sub.submitted, false);
  assert.equal(d.assignments.find((a) => a.id === 'asg-submitted').sub.submitted, true);
  assert.equal(d.assignments.find((a) => a.id === 'asg-draft').sub.submitted, false);
  assert.ok(d.assignments.every((a) => a.seen === 0));
  const ann = d.announcements.find((a) => a.uuid === 'ann-1');
  assert.equal(ann.text, 'The exam is in room A 12.\n\nBring your ID & a pen.');
  assert.ok(d.announcements.every((a) => a.seen === 0));
  assert.equal(d.notifications.length, 3);
  assert.deepEqual(d.synoptic.find((x) => x.siteId === F.CS), { siteId: F.CS, messages: 2, forums: 5 });
  assert.equal(d.forums[F.CS].topics.length, 2);
  assert.equal(d.forums[F.CS].topics[0].total - d.forums[F.CS].topics[0].read, 3);
  const files = d[`res:${F.MATH}`].items;
  assert.ok(!files.some((f) => f.url.endsWith(`/group/${F.MATH}/`)), 'the root folder is not an item');
  assert.equal(files.find((f) => f.type === 'text/url').link, 'https://example.org/simulator');
  assert.ok(files.every((f) => f.seen === 0));
  assert.equal(d.meta.userId, 'user-1');
  assert.ok(d.meta.lastSync && d.meta.lastFullSync);
});

test('all GET requests use auto=true', async () => {
  const s = setup();
  await s.sync.run({ force: true });
  assert.ok(s.log.length > 10);
  for (const l of s.log) assert.match(l.url, /auto=true/);
});

test('the sync waits 15 minutes, and 1 hour after 12 hours without use', async () => {
  const s = setup();
  await s.sync.run({ force: true });
  s.clock.t += 10 * MAK.MINUTE;
  assert.deepEqual(await s.sync.run(), { skipped: 'not-due' });
  s.clock.t += 6 * MAK.MINUTE;
  assert.equal((await s.sync.run()).full, false);
  await s.sync.touch();
  s.clock.t += 13 * MAK.HOUR;
  await s.sync.run(); // due (more than 15 minutes)
  s.clock.t += 20 * MAK.MINUTE;
  assert.deepEqual(await s.sync.run(), { skipped: 'not-due' }, 'idle: wait 1 hour');
  s.clock.t += 45 * MAK.MINUTE;
  assert.ok((await s.sync.run()).steps);
});

test('no request when the extension is paused or the sync is off', async () => {
  const s = setup({ local: { paused: true } });
  assert.deepEqual(await s.sync.run({ force: true }), { skipped: 'paused' });
  const s2 = setup({ local: { settings: { syncEnabled: false } } });
  assert.deepEqual(await s2.sync.run({ force: true }), { skipped: 'disabled' });
  assert.equal(s.log.length + s2.log.length, 0);
});

test('a logged-out session keeps the old data', async () => {
  const s = setup();
  await s.sync.run({ force: true });
  const before = JSON.stringify(s.area.data.announcements);
  s.routes['/direct/session/current.json'] = fakeFetch.raw(response('<html>login</html>', { type: 'text/html' }));
  s.clock.t += MAK.HOUR;
  assert.deepEqual(await s.sync.run({ force: true }), { skipped: 'logged-out' });
  assert.equal(JSON.stringify(s.area.data.announcements), before);
  assert.equal(s.area.data.meta.loggedIn, false);
});

test('an HTML answer from one endpoint keeps the old data and marks it stale', async () => {
  const s = setup();
  await s.sync.run({ force: true });
  const before = s.area.data.announcements.length;
  s.routes['/direct/announcement/user.json'] = fakeFetch.raw(response('<html></html>', { type: 'text/html' }));
  s.clock.t += 5 * MAK.HOUR;
  const r = await s.sync.run({ force: true });
  assert.ok(r.errors.includes('announcements'));
  assert.equal(s.area.data.announcements.length, before);
  assert.ok(s.area.data.meta.stale.announcements);
});

test('a server error stops the sync and waits longer each time', async () => {
  const s = setup();
  s.routes['/direct/assignment/my.json'] = fakeFetch.raw(response({}, { status: 503 }));
  const r = await s.sync.run({ force: true });
  assert.equal(r.backoff, F.NOW + 2 * MAK.MINUTE);
  assert.equal(s.area.data.meta.backoffStep, 1);
  assert.equal(s.area.data.synoptic, undefined, 'the steps after the error did not run');
  s.clock.t += 20 * MAK.MINUTE;
  await s.sync.run({ force: true });
  assert.equal(s.area.data.meta.backoffStep, 2);
  s.clock.t += MAK.MINUTE;
  assert.deepEqual(await s.sync.run(), { skipped: 'backoff' });
  assert.deepEqual(await s.sync.run({ force: true }), { skipped: 'backoff' }, 'a manual refresh also waits');
});

test('mergeAnnouncements: a full fetch replaces; a small fetch adds and changes; old items go', () => {
  const D = MAK.DAY;
  const prev = [{ id: 'a', title: 'A', created: 10 * D }, { id: 'b', title: 'B', created: 2 * D }];
  const small = [{ id: 'b', title: 'B2', created: 2 * D }, { id: 'c', title: 'C', created: 12 * D }];
  assert.deepEqual(MAK.mergeAnnouncements(prev, small, false, 0).map((x) => `${x.id}:${x.title}`), ['c:C', 'a:A', 'b:B2']);
  assert.deepEqual(MAK.mergeAnnouncements(prev, small, true, 0).map((x) => x.id), ['c', 'b']);
  assert.deepEqual(MAK.mergeAnnouncements(prev, small, false, 5 * D).map((x) => x.id), ['c', 'a']);
});

test('a different user removes all the data of the previous user', async () => {
  const s = setup({ local: { settings: { hiddenSites: [F.COORD] }, readAnn: { x: 1 } } });
  await s.sync.run({ force: true });
  s.routes['/direct/session/current.json'] = { userId: 'user-2' };
  s.clock.t += MAK.HOUR;
  const r = await s.sync.run({ force: true });
  assert.equal(r.full, true, 'a new user gets a full sync');
  assert.equal(s.area.data.meta.userId, 'user-2');
  assert.deepEqual(s.area.data.readAnn || {}, {});
  assert.ok(s.area.data.announcements.every((a) => a.seen === 0), 'the data of the new user is the baseline');
  assert.deepEqual(s.area.data.settings, { hiddenSites: [F.COORD] }, 'settings stay');
});

test('items that appear after the first sync get the time when the extension saw them', async () => {
  const s = setup();
  await s.sync.run({ force: true });
  const routes = s.routes;
  const late = { id: 'asg-x', title: 'Released late', context: F.MATH, openTime: F.epoch(F.NOW - 30 * F.D), timeCreated: F.epoch(F.NOW - 30 * F.D), dueTime: F.epoch(F.NOW + F.D), closeTime: F.epoch(F.NOW + F.D), submissions: [] };
  routes['/direct/assignment/my.json'] = { assignment_collection: F.ASSIGNMENTS.concat(late) };
  s.clock.t += 20 * MAK.MINUTE;
  await s.sync.run();
  const a = s.area.data.assignments.find((x) => x.id === 'asg-x');
  assert.equal(a.seen, F.NOW + 20 * MAK.MINUTE);
  assert.equal(s.area.data.assignments.find((x) => x.id === 'asg-red').seen, 0);
});

test('a routine sync merges the recent announcements and keeps the older ones', async () => {
  const s = setup();
  await s.sync.run({ force: true });
  const n = s.area.data.announcements.length;
  s.routes['/direct/announcement/user.json'] = (url) =>
    /n=30/.test(url)
      ? { announcement_collection: [{ id: `${F.CS}:main:ann-new`, announcementId: 'ann-new', siteId: F.CS, title: 'New', body: 'x', createdOn: F.NOW + 10 * MAK.MINUTE }] }
      : { announcement_collection: [] };
  s.clock.t += 20 * MAK.MINUTE;
  await s.sync.run();
  assert.equal(s.area.data.announcements.length, n + 1);
  assert.equal(s.area.data.announcements[0].uuid, 'ann-new');
  assert.equal(s.area.data.announcements[0].seen, F.NOW + 20 * MAK.MINUTE);
});

test('hidden sites ("everywhere") get no file or forum requests', async () => {
  const s = setup({ local: { settings: { hiddenSites: [F.CS], hiddenMode: 'everywhere' } } });
  await s.sync.run({ force: true });
  assert.ok(!s.log.some((l) => l.url.includes(`/content/site/${F.CS}`)));
  assert.ok(!s.log.some((l) => l.url.includes(`/forums/site/${F.CS}`)));
  assert.equal(s.area.data[`res:${F.CS}`], undefined);
  const s2 = setup({ local: { settings: { hiddenSites: [F.CS], hiddenMode: 'sidebar' } } });
  await s2.sync.run({ force: true });
  assert.ok(s2.area.data[`res:${F.CS}`]);
});

test('a request for one site fetches its files and forums on a routine sync', async () => {
  const s = setup();
  await s.sync.run({ force: true });
  s.clock.t += 20 * MAK.MINUTE;
  s.log.length = 0;
  await s.sync.run({ siteIds: [F.PHYS] });
  assert.ok(s.log.some((l) => l.url.includes(`/content/site/${F.PHYS}`)));
  assert.ok(!s.log.some((l) => l.url.includes(`/content/site/${F.MATH}`)));
});

test('two syncs at the same time run once; a site request waits for the current sync', async () => {
  const s = setup();
  const [a, b] = await Promise.all([s.sync.run({ force: true }), s.sync.run()]);
  assert.equal(a, b);
  const sessions = s.log.filter((l) => l.key.startsWith('/direct/session')).length;
  assert.equal(sessions, 1);
  s.clock.t += 20 * MAK.MINUTE;
  const [c, d] = await Promise.all([s.sync.run(), s.sync.run({ siteIds: [F.PHYS] })]);
  assert.notEqual(c, d);
});

test('the background syncs after the ping alarm and removes the data on logout', async () => {
  const bg = loadBackground({ fetch: fakeFetch(F.routes()) });
  await bg.fireAlarm('miaulario-ping');
  const d = bg.ext.storage.local.data;
  assert.equal(d.sites.length, 4);
  assert.ok(d.meta.lastSync);
  await bg.send({ type: 'logout' }, { id: 'ext-id', tab: { id: 1 }, frameId: 0, url: 'https://miaulario.unavarra.es/portal' });
  assert.equal(bg.ext.storage.local.data.sites, undefined);
  assert.equal(bg.ext.storage.local.data.paused, true);
  assert.ok(bg.ext.storage.local.data.meta.installedAt);
});
