'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, memoryArea, fakeFetch } = require('./helpers');
const F = require('./fixtures/miaulario');
const MAK = loadLib('core', 'store', 'api', 'grades', 'sync', 'due');

const { HOUR, DAY, MINUTE } = MAK;

test('ymd and startOfWeek use the local time; the week starts on Monday', () => {
  const sat = new Date(2026, 9, 17, 15, 30).getTime(); // Saturday 17 October 2026
  assert.equal(MAK.ymd(sat), '2026-10-17');
  assert.equal(MAK.startOfWeek(sat), new Date(2026, 9, 12).getTime());
  assert.equal(MAK.startOfWeek(new Date(2026, 9, 12, 0, 0).getTime()), new Date(2026, 9, 12).getTime(), 'Monday 00:00');
  assert.equal(MAK.startOfWeek(new Date(2026, 9, 18, 23, 59).getTime()), new Date(2026, 9, 12).getTime(), 'Sunday 23:59');
  assert.equal(MAK.startOfWeek(new Date(2026, 9, 26, 1).getTime()), new Date(2026, 9, 26).getTime(), 'the week after the change of the time');
});

test('the sync gets the calendar of the week view every 6 hours, from Monday of this week', async () => {
  const area = memoryArea();
  const log = [];
  const clock = { t: F.NOW };
  const sync = MAK.createSync({ api: MAK.createApi({ fetch: fakeFetch(F.routes(), log) }), store: MAK.createStore(area), now: () => clock.t, pauseMs: 0 });
  const calls = () => log.filter((l) => l.url.includes('/direct/calendar/my.json'));
  await sync.run({ force: true });
  assert.equal(calls().length, 1);
  const u = new URL(calls()[0].url);
  assert.equal(u.searchParams.get('firstDate'), MAK.ymd(MAK.startOfWeek(F.NOW)));
  assert.equal(u.searchParams.get('lastDate'), MAK.ymd(MAK.startOfWeek(F.NOW) + 42 * DAY));
  assert.equal(u.searchParams.get('auto'), 'true');
  assert.deepEqual(area.data.events.map((e) => e.id), ['ev-1', 'ev-2', 'ev-3']);
  clock.t += 20 * MINUTE;
  await sync.run();
  assert.equal(calls().length, 1, 'not again after 20 minutes');
  clock.t += 6 * HOUR;
  await sync.run();
  assert.equal(calls().length, 2, 'again after 6 hours');
  assert.ok(MAK.DATA_KEYS.includes('events'), 'logout removes the events');
});

test('buildWeeks: 6 weeks from Monday; open deliveries and events; no events of deliveries; no hidden sites', () => {
  const now = new Date(2026, 9, 17, 12).getTime(); // Saturday
  const mon = new Date(2026, 9, 12).getTime();
  const at = (days, h = 10) => new Date(2026, 9, 12 + days, h).getTime();
  const deliveries = [{ id: 'd1', due: at(6, 23) }, { id: 'd2', due: at(7, 0) }, { id: 'd3', due: at(3) }, { id: 'far', due: at(60) }, { id: 'nodate', due: null }];
  const events = [
    { id: 'e1', siteId: 'a', siteTitle: 'A full', start: at(8), assignmentId: null },
    { id: 'e2', siteId: 'a', siteTitle: 'A full', start: at(9), assignmentId: 'asg' },
    { id: 'e3', siteId: 'hidden', siteTitle: 'H', start: at(9), assignmentId: null },
    { id: 'e4', siteId: 'b', siteTitle: 'B', start: at(41, 23) }
  ];
  const weeks = MAK.buildWeeks({ deliveries, events, sites: [{ id: 'a', title: 'A' }], hidden: new Set(['hidden']), now });
  assert.equal(weeks.length, 6);
  assert.equal(weeks[0].start, mon);
  assert.equal(weeks[1].start, new Date(2026, 9, 19).getTime());
  assert.equal(weeks[2].start, new Date(2026, 9, 26).getTime(), 'Monday after the change of the time');
  assert.deepEqual(weeks[0].deliveries.map((d) => d.id), ['d3', 'd1'], 'Sunday 23:00 is in this week, sorted by date');
  assert.deepEqual(weeks[1].deliveries.map((d) => d.id), ['d2'], 'Monday 00:00 is in the next week');
  assert.deepEqual(weeks[1].events.map((e) => [e.id, e.siteTitle]), [['e1', 'A']], 'the name of the site; no delivery event; no hidden site');
  assert.deepEqual(weeks[5].events.map((e) => e.id), ['e4'], 'the last Sunday');
  assert.deepEqual(weeks.map((w) => w.total), [2, 2, 0, 0, 0, 1]);
});

test('buildWeeks: the office hours (tutorías) are not in the weeks or in their numbers', () => {
  const now = new Date(2026, 9, 14, 12).getTime();
  const at = (h) => new Date(2026, 9, 15, h).getTime();
  const ev = (id, title) => ({ id, siteId: 'a', title, start: at(10), assignmentId: null });
  const events = [ev('t1', 'Tutorias (0 asistentes)'), ev('t2', 'Tutoría; grupo A, aula 3'), ev('t3', '  TUTORÍAS'), ev('k1', 'Tutorial de Git'), ev('k2', 'Examen parcial'), ev('k3', 'Cambio de tutoría')];
  const weeks = MAK.buildWeeks({ deliveries: [], events, sites: [], now });
  assert.deepEqual(weeks[0].events.map((e) => e.id), ['k1', 'k2', 'k3']);
  assert.equal(weeks[0].total, 3);
  assert.equal(MAK.isOfficeHours({}), false);
});
