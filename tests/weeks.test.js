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
