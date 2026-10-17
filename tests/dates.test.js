'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, memoryArea, fakeFetch } = require('./helpers');
const F = require('./fixtures/miaulario');
const MAK = loadLib('core', 'store', 'api', 'grades', 'sync', 'due', 'inbox', 'news');

const { HOUR, DAY } = MAK;
const asg = (id, due, extra) => Object.assign({ id, siteId: 's', title: id, due }, extra);

test('trackDueChanges: a new date, a second new date, back to the first date; no change in the baseline', () => {
  const t0 = 1000;
  let prev = [asg('a', 20 * DAY), asg('b', 30 * DAY), asg('c', null)];
  assert.deepEqual(MAK.trackDueChanges([asg('a', 25 * DAY)], prev, t0, true), [asg('a', 25 * DAY)], 'baseline');
  let list = MAK.trackDueChanges([asg('a', 25 * DAY), asg('b', 30 * DAY), asg('c', 5 * DAY), asg('d', DAY)], prev, t0, false);
  assert.deepEqual(list[0].dueChange, { from: 20 * DAY, at: t0 });
  assert.equal(list[1].dueChange, undefined, 'same date');
  assert.equal(list[2].dueChange, undefined, 'a first date is not a change');
  assert.equal(list[3].dueChange, undefined, 'a new delivery');
  prev = list;
  list = MAK.trackDueChanges([asg('a', 27 * DAY)], prev, t0 + 1, false);
  assert.deepEqual(list[0].dueChange, { from: 20 * DAY, at: t0 + 1 }, 'the first date stays');
  list = MAK.trackDueChanges([asg('a', 27 * DAY)], list, t0 + 2, false);
  assert.deepEqual(list[0].dueChange, { from: 20 * DAY, at: t0 + 1 }, 'no new change');
  list = MAK.trackDueChanges([asg('a', 20 * DAY)], list, t0 + 3, false);
  assert.equal(list[0].dueChange, undefined, 'back to the first date');
});

test('the sync records a new due date; the banner and the deliveries tab show it', async () => {
  const area = memoryArea();
  const routes = F.routes();
  const clock = { t: F.NOW };
  const sync = MAK.createSync({ api: MAK.createApi({ fetch: fakeFetch(routes) }), store: MAK.createStore(area), now: () => clock.t, pauseMs: 0 });
  await sync.run({ force: true });
  const before = area.data.assignments.find((a) => a.id === 'asg-orange').due;
  routes['/direct/assignment/my.json'] = {
    assignment_collection: F.ASSIGNMENTS.map((a) => (a.id === 'asg-orange' ? Object.assign({}, a, { dueTime: F.epoch(F.NOW + 5 * F.D) }) : a))
  };
  clock.t += 20 * MAK.MINUTE;
  await sync.run();
  const moved = area.data.assignments.find((a) => a.id === 'asg-orange');
  assert.deepEqual(moved.dueChange, { from: before, at: clock.t });

  const pages = Object.fromEntries(F.SITES.map((s) => [s.id, MAK.trimPages(F.pages(s.id), F.NOW)]));
  const news = MAK.newSince({ siteId: F.MATH, since: F.NOW, assignments: area.data.assignments, pages, now: clock.t });
  assert.deepEqual(news.dateChanges.map((d) => [d.title, d.from, d.to]), [['Problem set 4', before, F.NOW + 5 * F.D]]);
  assert.equal(news.total, 1);
  assert.equal(MAK.newSince({ siteId: F.MATH, since: clock.t, assignments: area.data.assignments, pages, now: clock.t }).dateChanges.length, 0, 'after the change');
  assert.equal(MAK.newSince({ siteId: F.CS, since: F.NOW, assignments: area.data.assignments, pages, now: clock.t }).dateChanges.length, 0, 'other site');

  const due = MAK.buildDue({ assignments: area.data.assignments, sites: F.SITES, pages, now: clock.t }).groups.pending.find((x) => x.id === 'asg-orange');
  assert.deepEqual(due.dueChange, { from: before, at: clock.t });
});

test('a new delivery is in "deliveries" only, not also in "dateChanges"', () => {
  const since = F.NOW;
  const a = { id: 'n', siteId: F.CS, title: 'New', created: since + HOUR, open: since, seen: since + HOUR, due: since + 3 * DAY, dueChange: { from: since + 2 * DAY, at: since + 2 * HOUR } };
  const n = MAK.newSince({ siteId: F.CS, since, assignments: [a], pages: {}, now: since + 3 * HOUR });
  assert.equal(n.deliveries.length, 1);
  assert.equal(n.dateChanges.length, 0);
  assert.equal(n.total, 1);
});
