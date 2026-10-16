'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, memoryArea, fakeFetch } = require('./helpers');
const F = require('./fixtures/miaulario');
const MAK = loadLib('core', 'store', 'api', 'grades', 'sync');

const item = (id, score, extra) => Object.assign({ id: String(id), siteId: 's', siteTitle: 'S', name: `Item ${id}`, score, graded: score !== '', url: null }, extra);

test('parseNumber: comma, dot, percent; no number gives null', () => {
  assert.equal(MAK.parseNumber('8,5'), 8.5);
  assert.equal(MAK.parseNumber(' 8.50 '), 8.5);
  assert.equal(MAK.parseNumber('85%'), 85);
  assert.equal(MAK.parseNumber('10'), 10);
  for (const bad of ['-', '', null, undefined, 'A', 'Excused', '8/10']) assert.equal(MAK.parseNumber(bad), null);
});

test('trimGrade: the item of a teacher role is not a grade of the user', () => {
  const g = F.GRADES.map(MAK.trimGrade);
  assert.equal(g[4], null, 'canGrade: true');
  assert.deepEqual(g[0], { id: '501', siteId: F.MATH, siteTitle: 'Mathematics I', name: 'Problem set 1', score: '7,5', graded: true, url: `https://miaulario.unavarra.es/portal/directtool/${F.MATH}-tool-6` });
  assert.equal(g[1].graded, false);
  assert.equal(MAK.trimGrade({ id: 1, score: '  ', notGradedYet: false }).graded, false, 'an empty score is not a grade');
});

test('mergeGrades: the first fetch is the baseline (no new grades)', () => {
  const r = MAK.mergeGrades(undefined, [item(1, '7'), item(2, '')], 1000, true);
  assert.deepEqual(r.list.map((g) => g.gradedAt), [0, null]);
  assert.deepEqual(r.changed, []);
});

test('mergeGrades: a new grade, a changed grade, the same grade, a removed grade, a new item', () => {
  const prev = MAK.mergeGrades(undefined, [item(1, '7'), item(2, ''), item(3, '8.5'), item(4, '6')], 1000, true).list;
  const r = MAK.mergeGrades(prev, [item(1, '7,0'), item(2, '9'), item(3, '8'), item(4, ''), item(5, '5')], 2000, false);
  const by = Object.fromEntries(r.list.map((g) => [g.id, g.gradedAt]));
  assert.deepEqual(by, { 1: 0, 2: 2000, 3: 2000, 4: null, 5: 2000 });
  assert.deepEqual(r.changed.map((g) => g.id), ['2', '3', '5']);
  // A deleted item goes away; the next fetch keeps gradedAt.
  const again = MAK.mergeGrades(r.list, [item(2, '9')], 3000, false);
  assert.deepEqual(again.list.map((g) => [g.id, g.gradedAt]), [['2', 2000]]);
  assert.deepEqual(again.changed, []);
});

test('mergeGrades: a text grade that changes is new; the same text is not', () => {
  const prev = MAK.mergeGrades(undefined, [item(1, 'Aprobado')], 1, true).list;
  assert.equal(MAK.mergeGrades(prev, [item(1, 'Aprobado')], 2, false).changed.length, 0);
  assert.equal(MAK.mergeGrades(prev, [item(1, 'Notable')], 2, false).changed.length, 1);
});

test('the sync stores the grades and calls onNewGrades only after the baseline', async () => {
  const area = memoryArea();
  const routes = F.routes();
  const clock = { t: F.NOW };
  const calls = [];
  const sync = MAK.createSync({ api: MAK.createApi({ fetch: fakeFetch(routes) }), store: MAK.createStore(area), now: () => clock.t, pauseMs: 0, onNewGrades: async (list) => calls.push(list.map((g) => g.id)) });
  await sync.run({ force: true });
  assert.equal(area.data.grades.length, 4, 'the teacher-role item is left out');
  assert.equal(area.data.grades.find((g) => g.id === '501').gradedAt, 0);
  assert.deepEqual(calls, []);
  routes['/api/users/me/grades'] = { grades: F.GRADES.map((g) => (g.id === 503 ? Object.assign({}, g, { score: '9', notGradedYet: false }) : g)) };
  clock.t += 20 * MAK.MINUTE;
  await sync.run();
  assert.deepEqual(calls, [['503']]);
  assert.equal(area.data.grades.find((g) => g.id === '503').gradedAt, clock.t);
});
