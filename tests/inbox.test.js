'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, loadBackground, fakeFetch, response } = require('./helpers');
const F = require('./fixtures/miaulario');
const MAK = loadLib('core', 'store', 'api', 'inbox');

const announcements = F.ANNOUNCEMENTS.map(MAK.trimAnnouncement);
const notifications = F.NOTIFICATIONS.map(MAK.trimNotification);
const synoptic = F.SYNOPTIC.map((x) => ({ siteId: x.siteId, messages: x.newMessagesCount, forums: x.newForumCount }));
const pages = Object.fromEntries(F.SITES.map((s) => [s.id, MAK.trimPages(F.pages(s.id), F.NOW)]));
const forums = { [F.CS]: { at: F.NOW, topics: [{ id: '71', forumId: '7', forum: 'General', title: 'Questions about lab 3', read: 4, total: 7, modified: F.NOW - 5 * F.H }, { id: '72', forumId: '7', forum: 'General', title: 'Exam doubts', read: 8, total: 8 }] } };
const base = { announcements, notifications, readAnn: {}, synoptic, forums, sites: F.SITES, pages, hidden: new Set() };
const build = (o = {}) => MAK.buildInbox(Object.assign({}, base, o));
const unreadIds = (m) => m.items.filter((x) => x.type === 'announcement' && x.unread).map((x) => x.id.split(':').pop());

test('the read state comes from the bell; an announcement without a notification is unread', () => {
  const m = build();
  // ann-1: notification not viewed -> unread. ann-2: viewed -> read. ann-3 and ann-4: no notification -> unread.
  assert.deepEqual(unreadIds(m).sort(), ['ann-1', 'ann-3', 'ann-4']);
});

test('an announcement read in the extension is read', () => {
  const m = build({ readAnn: { [`${F.CS}:main:ann-1`]: F.NOW } });
  assert.deepEqual(unreadIds(m).sort(), ['ann-3', 'ann-4']);
});

test('messages, forum topics and counts', () => {
  const m = build();
  assert.deepEqual(m.counts, { announcements: 3, messages: 3, forums: 3, total: 9 });
  const types = m.items.map((x) => x.type);
  assert.deepEqual(types.slice(0, 3), ['messages', 'messages', 'forum'], 'messages and forums come first');
  const forum = m.items.find((x) => x.type === 'forum');
  assert.equal(forum.title, 'Questions about lab 3');
  assert.equal(forum.count, 3);
  assert.equal(forum.url, `https://miaulario.unavarra.es/portal/site/${F.CS}/page/${F.CS}-page-4`);
  assert.equal(m.items.find((x) => x.type === 'messages' && x.siteId === F.CS).url, `https://miaulario.unavarra.es/portal/site/${F.CS}/page/${F.CS}-page-5`);
});

test('forum counts of MiAulario are used when the topics are not known', () => {
  const m = build({ forums: {} });
  const forum = m.items.find((x) => x.type === 'forum');
  assert.equal(forum.title, null);
  assert.equal(forum.count, 5);
});

test('announcement links open the announcement in MiAulario', () => {
  const x = build().items.find((i) => i.id === `${F.CS}:main:ann-1`);
  const u = new URL(x.url);
  assert.equal(u.pathname, `/portal/directtool/${F.CS}-tool-1`);
  assert.equal(u.searchParams.get('itemReference'), `/announcement/msg/${F.CS}/main/ann-1`);
  assert.equal(u.searchParams.get('sakai_action'), 'doShowmetadata');
});

test('filters: type, site, unread only and search without accents', () => {
  const items = build().items;
  assert.equal(MAK.filterInbox(items, { type: 'messages' }).length, 2);
  assert.ok(MAK.filterInbox(items, { siteId: F.MATH }).every((x) => x.siteId === F.MATH));
  assert.ok(MAK.filterInbox(items, { unreadOnly: true }).every((x) => x.unread));
  assert.deepEqual(MAK.filterInbox(items, { query: 'RECUPERACION' }).map((x) => x.title), ['Clase de recuperación']);
  assert.deepEqual(MAK.filterInbox(items, { query: 'room exam' }).map((x) => x.title), ['Exam room changed']);
  assert.equal(MAK.filterInbox(items, { query: 'zzz' }).length, 0);
});

test('hidden sites are not in the inbox', () => {
  const m = build({ hidden: new Set([F.CS]) });
  assert.ok(!m.items.some((x) => x.siteId === F.CS));
  assert.equal(m.counts.messages, 1);
});

test('sitesToMarkViewed: only sites with no unread announcement and a bell notification that is not viewed', () => {
  const d = { announcements, notifications, readAnn: {} };
  assert.deepEqual(MAK.sitesToMarkViewed(d, [F.CS]), [], 'ann-1 is still unread');
  d.readAnn = { [`${F.CS}:main:ann-1`]: 1 };
  assert.deepEqual(MAK.sitesToMarkViewed(d, [F.CS, F.MATH]), [F.CS], 'MATH: its notification is viewed already');
});

// ---- Background: the two directions of the read state ----------------------

async function syncedBackground(extraRoutes = {}) {
  const log = [];
  const bg = loadBackground({ fetch: fakeFetch(Object.assign(F.routes(), extraRoutes), log) });
  await bg.send({ type: 'syncNow' });
  return { bg, log, data: bg.ext.storage.local.data };
}

const CONTENT = { id: 'ext-id', tab: { id: 1 }, frameId: 0, url: 'https://miaulario.unavarra.es/portal/site/x' };

test('reading the last unread announcement of a site in the extension marks the bell of MiAulario', async () => {
  const { bg, log, data } = await syncedBackground({ '/api/users/me/notifications/markViewed': { ok: true } });
  await bg.send({ type: 'markAnnRead', ids: [`${F.CS}:main:ann-1`] });
  const post = log.find((l) => l.method === 'POST');
  assert.ok(post, 'a POST was sent');
  assert.match(post.url, new RegExp(`siteId=${F.CS}&toolId=sakai\\.announcements`));
  assert.equal(data.notifications.find((n) => n.id === 101).viewed, true);
  assert.ok(data.readAnn[`${F.CS}:main:ann-1`]);
});

test('no POST while the site has other unread announcements', async () => {
  const { bg, log } = await syncedBackground({ '/api/users/me/notifications/markViewed': { ok: true } });
  await bg.send({ type: 'markAnnRead', ids: [`${F.PHYS}:main:ann-3`] });
  assert.ok(!log.some((l) => l.method === 'POST'), 'PHYS has no bell notification for announcements');
});

test('a failed POST is kept, and a MiAulario page sends it later', async () => {
  const { bg, data } = await syncedBackground({ '/api/users/me/notifications/markViewed': fakeFetch.raw(response({}, { status: 403 })) });
  await bg.send({ type: 'markAnnRead', ids: [`${F.CS}:main:ann-1`] });
  assert.deepEqual(data.pendingMarkViewed, [{ siteId: F.CS, toolId: 'sakai.announcements' }]);
  const taken = await bg.send({ type: 'takePendingMarkViewed' }, CONTENT);
  assert.deepEqual(taken, [{ siteId: F.CS, toolId: 'sakai.announcements' }]);
  assert.deepEqual(data.pendingMarkViewed, []);
  await bg.send({ type: 'pendingMarkViewedDone', siteId: F.CS, toolId: 'sakai.announcements', ok: true }, CONTENT);
  assert.equal(data.notifications.find((n) => n.id === 101).viewed, true);
  await bg.send({ type: 'pendingMarkViewedDone', siteId: F.CS, toolId: 'sakai.announcements', ok: false }, CONTENT);
  assert.equal(data.pendingMarkViewed.length, 1, 'a failure goes back to the list');
});

test('opening the Announcements tool in MiAulario marks the announcements of that site as read, also in the bell', async () => {
  // MiAulario does not mark the bell when the tool opens (live test, 2026-10-16). The extension does it.
  const { bg, log, data } = await syncedBackground({ '/api/users/me/notifications/markViewed': { ok: true } });
  await bg.send({ type: 'toolVisit', siteId: F.PHYS, toolId: 'sakai.announcements' }, CONTENT);
  assert.ok(data.readAnn[`${F.PHYS}:main:ann-3`]);
  assert.ok(!data.readAnn[`${F.CS}:main:ann-1`], 'other sites do not change');
  assert.ok(!log.some((l) => l.method === 'POST'), 'PHYS has no bell notification: no POST');
  await bg.send({ type: 'toolVisit', siteId: F.CS, toolId: 'sakai.announcements' }, CONTENT);
  assert.ok(log.some((l) => l.method === 'POST' && l.url.includes(`siteId=${F.CS}`)), 'CS has a bell notification: POST');
  assert.equal(data.notifications.find((n) => n.id === 101).viewed, true);
  assert.deepEqual(await bg.send({ type: 'toolVisit', siteId: 'unknown-site', toolId: 'sakai.announcements' }, CONTENT), { ok: false });
});

test('mark all read: one site, or all sites; content scripts cannot do it', async () => {
  const { bg, data } = await syncedBackground({ '/api/users/me/notifications/markViewed': { ok: true } });
  assert.equal(await bg.send({ type: 'markAllAnnRead' }, CONTENT), null);
  await bg.send({ type: 'markAllAnnRead', siteId: F.COORD });
  assert.deepEqual(Object.keys(data.readAnn), [`${F.COORD}:main:ann-4`]);
  await bg.send({ type: 'markAllAnnRead' });
  assert.equal(Object.keys(data.readAnn).length, announcements.length);
});
