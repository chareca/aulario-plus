'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, loadBackground, fakeFetch } = require('./helpers');
const F = require('./fixtures/miaulario');
const MAK = loadLib('core', 'store', 'api', 'due', 'inbox', 'news');

const { MINUTE, HOUR, DAY } = MAK;
const pages = Object.fromEntries(F.SITES.map((s) => [s.id, MAK.trimPages(F.pages(s.id), F.NOW)]));
const file = (siteId, name, modified, seen) => ({ url: `https://miaulario.unavarra.es/access/content/group/${siteId}/${name}`, title: name, type: 'application/pdf', size: 1, modified, seen, folder: false, link: null });

test('recordVisit: first visit, same visit, new visit after 30 minutes', () => {
  const T0 = F.NOW;
  let r = MAK.recordVisit({}, 'a', T0, T0 - DAY);
  assert.deepEqual([r.isNew, r.since], [true, T0 - DAY]);
  r = MAK.recordVisit(r.visits, 'a', T0 + 10 * MINUTE, 0);
  assert.deepEqual([r.isNew, r.since], [false, T0 - DAY], 'same visit: the banner keeps the same reference');
  r = MAK.recordVisit(r.visits, 'a', T0 + 50 * MINUTE, 0);
  assert.deepEqual([r.isNew, r.since], [true, T0 + 10 * MINUTE], 'a new visit starts after 30 minutes without pages');
  assert.deepEqual(r.visits.a, { previous: T0 + 10 * MINUTE, last: T0 + 50 * MINUTE });
});

test('the user scenario: 3 days in Mathematics; a file comes to Computer Science', () => {
  const install = F.NOW;
  const day = (n, h = 10) => install + n * DAY + (h - 10) * HOUR;
  // Mathematics only, three days in a row.
  let visits = {};
  for (const n of [1, 2, 3]) visits = MAK.recordVisit(visits, F.MATH, day(n), install).visits;
  // On day 2 at 11:00 a teacher adds a file to Computer Science. The sync sees it at 11:10.
  const newFile = file(F.CS, 'Practica-5.pdf', day(2, 11), day(2, 11) + 10 * MINUTE);
  const oldFile = file(F.CS, 'Tema-1.pdf', install - 30 * DAY, 0);
  const d = {
    sites: F.SITES,
    meta: { installedAt: install },
    visits,
    pages,
    [`res:${F.CS}`]: { items: [oldFile, newFile] },
    [`res:${F.MATH}`]: { items: [file(F.MATH, 'Apuntes.pdf', install - 10 * DAY, 0)] }
  };
  // Day 3: the popup lists Computer Science (never visited) with the new file, and not Mathematics.
  const news = MAK.buildNews(d, day(3, 12));
  assert.deepEqual(news.map((x) => x.siteId), [F.CS]);
  assert.equal(news[0].visited, false);
  assert.deepEqual(news[0].files.map((f) => f.title), ['Practica-5.pdf']);
  // Day 4: in Mathematics the banner does not show the file of Computer Science.
  const inMath = MAK.recordVisit(visits, F.MATH, day(4), install);
  const mathNews = MAK.newSince({ siteId: F.MATH, since: inMath.since, resources: d[`res:${F.MATH}`], pages, now: day(4) });
  assert.equal(mathNews.total, 0);
  // Day 4: the first visit of Computer Science shows the file in the banner.
  const inCs = MAK.recordVisit(inMath.visits, F.CS, day(4, 11), install);
  assert.equal(inCs.isNew, true);
  const csNews = MAK.newSince({ siteId: F.CS, since: inCs.since, resources: d[`res:${F.CS}`], pages, now: day(4, 11) });
  assert.deepEqual(csNews.files.map((f) => [f.title, f.label]), [['Practica-5.pdf', 'new']]);
  // After the visit, the popup does not list Computer Science.
  assert.equal(MAK.buildNews(Object.assign({}, d, { visits: inCs.visits }), day(4, 12)).length, 0);
});

test('a changed file is "updated"; a file that came later is "new"', () => {
  const since = F.NOW;
  const items = [file(F.CS, 'changed.pdf', since + HOUR, 0), file(F.CS, 'added.pdf', since + HOUR, since + HOUR), file(F.CS, 'old.pdf', since - HOUR, 0), { url: 'x/', folder: true, modified: since + HOUR, seen: 0 }];
  const n = MAK.newSince({ siteId: F.CS, since, resources: { items }, pages, now: since + 2 * HOUR });
  assert.deepEqual(n.files.map((f) => [f.title, f.label]).sort(), [['added.pdf', 'new'], ['changed.pdf', 'updated']]);
});

test('announcements and deliveries: own site only, late publication counts, not open yet does not', () => {
  const since = F.NOW;
  const announcements = [
    { id: 'a1', uuid: 'u1', siteId: F.CS, title: 'New', created: since + HOUR, seen: since + HOUR },
    { id: 'a2', uuid: 'u2', siteId: F.CS, title: 'Old date, seen later', created: since - 5 * DAY, seen: since + HOUR },
    { id: 'a3', uuid: 'u3', siteId: F.MATH, title: 'Other site', created: since + HOUR, seen: since + HOUR }
  ];
  const assignments = [
    { id: 'd1', siteId: F.CS, title: 'Released late', created: since - 20 * DAY, open: since - 20 * DAY, seen: since + HOUR, due: since + DAY },
    { id: 'd2', siteId: F.CS, title: 'Opens tomorrow', created: since + HOUR, open: since + DAY, seen: since + HOUR, due: since + 2 * DAY },
    { id: 'd3', siteId: F.CS, title: 'Old', created: since - DAY, open: since - DAY, seen: 0 }
  ];
  const n = MAK.newSince({ siteId: F.CS, since, announcements, assignments, pages, now: since + 2 * HOUR });
  assert.deepEqual(n.announcements.map((a) => a.title).sort(), ['New', 'Old date, seen later']);
  assert.deepEqual(n.deliveries.map((d) => d.title), ['Released late']);
  assert.match(n.announcements[0].url, /^https:\/\/miaulario\.unavarra\.es\/portal\/site\/[^/]+\/tool\/[^?]+\?itemReference=/);
  assert.equal(n.total, 3);
});

test('grades: only the grades of the site that came after the visit; the baseline grades are not new', () => {
  const since = F.NOW;
  const grades = [
    { id: '1', siteId: F.CS, name: 'Lab 1', score: '9', graded: true, gradedAt: since + HOUR, url: 'https://miaulario.unavarra.es/portal/directtool/x' },
    { id: '2', siteId: F.CS, name: 'Lab 0', score: '7', graded: true, gradedAt: 0 },
    { id: '3', siteId: F.CS, name: 'Before', score: '7', graded: true, gradedAt: since - HOUR },
    { id: '4', siteId: F.MATH, name: 'Other site', score: '5', graded: true, gradedAt: since + HOUR },
    { id: '5', siteId: F.CS, name: 'Not graded', score: '', graded: false, gradedAt: null }
  ];
  const n = MAK.newSince({ siteId: F.CS, since, grades, pages, now: since + 2 * HOUR });
  assert.deepEqual(n.grades, [{ id: '1', title: 'Lab 1', url: grades[0].url, time: since + HOUR }]);
  assert.ok(!JSON.stringify(n.grades).includes('"9"'), 'the grade is not in the banner items');
  assert.equal(n.total, 1);
  assert.deepEqual(MAK.newSince({ siteId: F.CS, since, pages, now: since }).grades, [], 'no grades: the popup list');
});

test('forums: new posts since the snapshot; no snapshot means no forum news', () => {
  const forums = { topics: [{ id: '71', title: 'Lab 3', total: 9 }, { id: '72', title: 'Exam', total: 8 }, { id: '73', title: 'New topic', total: 2 }] };
  const n = MAK.newSince({ siteId: F.CS, since: F.NOW, forums, forumBase: { 71: 7, 72: 8 }, pages, now: F.NOW });
  assert.deepEqual(n.forums.map((f) => [f.title, f.delta]), [['Lab 3', 2], ['New topic', 2]]);
  assert.equal(n.total, 4);
  assert.equal(MAK.newSince({ siteId: F.CS, since: F.NOW, forums, forumBase: null, pages, now: F.NOW }).total, 0);
  // Snapshot shift: a new visit moves "last" to "previous".
  let snap = MAK.shiftForumSnap({}, F.CS, { 71: 7 });
  snap = MAK.shiftForumSnap(snap, F.CS, { 71: 9 });
  assert.deepEqual(snap[F.CS], { previous: { 71: 7 }, last: { 71: 9 } });
});

test('mark as seen: nothing is new, also in the banner of the current visit', () => {
  const v = MAK.markSeen({ [F.CS]: { previous: F.NOW - DAY, last: F.NOW } }, F.CS, F.NOW + MINUTE);
  const r = MAK.recordVisit(v, F.CS, F.NOW + 2 * MINUTE, 0);
  assert.equal(r.isNew, false);
  assert.equal(r.since, F.NOW + MINUTE);
});

test('hidden sites ("everywhere") are not in the popup list', () => {
  const d = { sites: F.SITES, meta: { installedAt: F.NOW }, settings: { hiddenSites: [F.CS] }, [`res:${F.CS}`]: { items: [file(F.CS, 'x.pdf', F.NOW + HOUR, F.NOW + HOUR)] } };
  assert.equal(MAK.buildNews(d, F.NOW + 2 * HOUR).length, 0);
  d.settings.hiddenMode = 'sidebar';
  assert.equal(MAK.buildNews(d, F.NOW + 2 * HOUR).length, 1);
});

test('background: the visit message records the visit, gets fresh data and answers with the banner items', async () => {
  const clock = { t: F.NOW };
  const routes = F.routes();
  const log = [];
  const bg = loadBackground({ fetch: fakeFetch(routes, log), now: () => clock.t });
  await bg.send({ type: 'syncNow' });
  const CONTENT = { id: 'ext-id', tab: { id: 1 }, frameId: 0, url: `https://miaulario.unavarra.es/portal/site/${F.CS}` };

  // First visit: nothing is new (all items existed at the install).
  clock.t += HOUR;
  let r = await bg.send({ type: 'visit', siteId: F.CS }, CONTENT);
  assert.equal(r.isNew, true);
  assert.equal(r.firstVisit, true);
  assert.equal(r.news.total, 0);
  assert.equal(r.lang, 'es');

  // A teacher adds a file and 2 forum posts. The next visit (2 hours later) gets fresh data.
  const extra = { url: `https://miaulario.unavarra.es/access/content/group/${F.CS}/Apuntes/Tema%203.pdf`, title: 'Tema 3.pdf', type: 'application/pdf', size: 9, modifiedDate: F.sakaiDate(clock.t + HOUR) };
  routes[`/direct/content/site/${F.CS}.json`] = { content_collection: F.resources(F.CS).concat(extra) };
  routes[`/direct/forums/site/${F.CS}/forum/7.json`] = { id: 7, topics: [{ id: 71, title: 'Questions about lab 3', readMessages: 4, totalMessages: 9 }, { id: 72, title: 'Exam doubts', readMessages: 6, totalMessages: 8 }] };
  routes['/api/users/me/grades'] = { grades: F.GRADES.map((g) => (g.id === 503 ? Object.assign({}, g, { score: '9', notGradedYet: false }) : g)) };
  clock.t += 2 * HOUR;
  log.length = 0;
  r = await bg.send({ type: 'visit', siteId: F.CS }, CONTENT);
  assert.ok(log.some((l) => l.url.includes(`/content/site/${F.CS}`)), 'fresh files at the start of the visit');
  assert.equal(r.isNew, true);
  assert.equal(r.firstVisit, false);
  assert.deepEqual(r.news.files.map((f) => [f.title, f.label]), [['Tema 3.pdf', 'new']]);
  assert.deepEqual(r.news.forums.map((f) => [f.title, f.delta]), [['Questions about lab 3', 2]]);
  assert.deepEqual(r.news.grades.map((g) => g.title), ['Lab report 1'], 'a new grade of this site');

  // The next page of the same visit: no new requests, the same items (for the short line).
  clock.t += 5 * MINUTE;
  log.length = 0;
  r = await bg.send({ type: 'visit', siteId: F.CS }, CONTENT);
  assert.equal(r.isNew, false);
  assert.equal(r.news.files.length, 1);
  assert.ok(!log.some((l) => l.url.includes('/content/site/')));

  // Mark as seen in the popup: the banner of this visit has nothing.
  await bg.send({ type: 'markSiteSeen', siteId: F.CS });
  clock.t += MINUTE;
  r = await bg.send({ type: 'visit', siteId: F.CS }, CONTENT);
  assert.equal(r.news.total, 0);

  // Unknown or special sites are rejected.
  assert.equal(await bg.send({ type: 'visit', siteId: '~user' }, CONTENT), null);
  assert.equal(await bg.send({ type: 'visit', siteId: 'unknown' }, CONTENT), null);
});
