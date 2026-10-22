'use strict';
// The history of the tasks and the exams (lib/history.js, background.js): the panel "Tareas" of MiAulario (also of
// the sites of other years), the submission of each task, and a history that only grows.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, loadBackground, fakeFetch, response } = require('./helpers');
const MAK = loadLib('core', 'api', 'history');

const D = 86400000;
const NOW = Date.UTC(2026, 9, 21, 10);
// As /api/users/me/tasks (Sakai 23).
const task = (o) => Object.assign({ userTaskId: 1, taskId: 1, siteId: '2025_0_240610_1_G', siteTitle: '25_0_240610_1_G APRENDIZAJE AUTOMÁTICO', description: 'Práctica 1',
  reference: '/assignment/a/2025_0_240610_1_G/a1', system: true, complete: null, starts: NOW - 400 * D, due: NOW - 380 * D, priority: 3,
  url: 'https://miaulario.unavarra.es/portal/directtool/x?assignmentId=a1', taskAssignedTo: 'u' }, o);
const RAW = [
  task(),
  task({ reference: '/samigo/2025_0_240610_1_G/141817', description: 'Examen práctico - Parcial II', complete: true, due: NOW - 309 * D }),
  task({ reference: '/samigo/0ca3f5ec-8823/150034', siteId: '0ca3f5ec-8823', siteTitle: 'Test 360º', description: 'Test', due: NOW + 29 * D }),
  task({ reference: '/gbassignment/2025_0_240610_1_G/7', description: 'Nota de clase' }),
  task({ reference: '/calendar/calendar/2025_0_240610_1_G/main/e1', description: 'Evento' }),
  task({ reference: '/lessonbuilder/item/9', description: 'Contenido' })
];
// As /direct/assignment/item/{id}.json: the assignment and the submission of the user.
const item = (sub, o) => Object.assign({ id: 'a1', context: '2025_0_240610_1_G', title: 'Práctica 1', dueTime: { epochSecond: (NOW - 380 * D) / 1000 }, submissions: sub ? [sub] : [] }, o);
const SENT = { submitted: true, draft: false, userSubmission: true, dateSubmittedEpochSeconds: (NOW - 381 * D) / 1000, late: false, returned: true, graded: true, grade: '8,5',
  feedbackComment: '<p>Bien hecho</p>', submittedAttachments: [{ name: 'p1.ipynb', url: 'https://miaulario.unavarra.es/access/content/attachment/2025_0_240610_1_G/Assignments/u/p1.ipynb', size: 2048, type: 'x' }] };

test('cleanHistoryItems: the tasks and the exams of the panel, not its events of the calendar, the Gradebook or Lessons', () => {
  const items = MAK.cleanHistoryItems(RAW);
  assert.deepEqual(items.map((x) => `${x.kind}:${x.id}:${x.siteId}`), ['task:a1:2025_0_240610_1_G', 'exam:141817:2025_0_240610_1_G', 'exam:150034:0ca3f5ec-8823']);
  assert.deepEqual([items[0].title, items[0].complete, items[1].complete], ['Práctica 1', false, true]);
  assert.equal(MAK.cleanHistoryItems([task({ url: 'javascript:alert(1)' })])[0].url, null, 'only an address of MiAulario');
  assert.deepEqual(MAK.cleanHistoryItems(null), []);
});

test('historyDetail: the submission of the user (date, late, files) and the correction only when it is returned', () => {
  const d = MAK.historyDetail(item(SENT), NOW);
  assert.deepEqual([d.submitted, d.date, d.late, d.files.map((f) => f.name), d.feedback.grade, d.feedback.comment, d.returned], [true, NOW - 381 * D, false, ['p1.ipynb'], '8,5', 'Bien hecho', true]);
  const hidden = MAK.historyDetail(item(Object.assign({}, SENT, { returned: false })), NOW);
  assert.equal(hidden.feedback, null, 'not returned: no grade yet');
  const pledge = MAK.historyDetail(item({ submitted: true, draft: false, userSubmission: false }), NOW);
  assert.deepEqual([pledge.submitted, pledge.date, pledge.files], [false, null, []], 'a submission that the user did not make (the honor pledge)');
  assert.equal(MAK.historyDetail(item(Object.assign({}, SENT, { late: true })), NOW).late, true);
  assert.equal(MAK.historyDetail(item(null), NOW).submitted, false);
});

test('mergeHistory: an item that MiAulario removed stays; the new fields over the old ones, the submission stays', () => {
  const first = MAK.mergeHistory(null, MAK.cleanHistoryItems(RAW), NOW - D);
  first.items['/assignment/a/2025_0_240610_1_G/a1'].detail = { submitted: true };
  const next = MAK.mergeHistory(first, MAK.cleanHistoryItems([task({ description: 'Práctica 1 (v2)' })]), NOW);
  assert.equal(Object.keys(next.items).length, 3, 'the exams that are not in the panel any more stay');
  assert.deepEqual([next.at, next.items['/assignment/a/2025_0_240610_1_G/a1'].title, next.items['/assignment/a/2025_0_240610_1_G/a1'].detail], [NOW, 'Práctica 1 (v2)', { submitted: true }]);
});

test('historyNeedsDetail, historyStatus and academicYear', () => {
  const it = (o) => Object.assign({ kind: 'task', due: NOW - 10 * D }, o);
  assert.equal(MAK.historyNeedsDetail(it({}), NOW), true, 'no submission read yet');
  assert.equal(MAK.historyNeedsDetail(it({ detail: { returned: true } }), NOW), false, 'returned: final');
  assert.equal(MAK.historyNeedsDetail(it({ detail: { returned: false } }), NOW), true, 'not returned, recent');
  assert.equal(MAK.historyNeedsDetail(it({ due: NOW - 200 * D, detail: { returned: false } }), NOW), false, 'not returned, 200 days ago');
  assert.equal(MAK.historyNeedsDetail({ kind: 'exam' }, NOW), false);
  const st = (o) => MAK.historyStatus(it(o), NOW);
  assert.deepEqual([st({ detail: { submitted: true } }), st({ detail: { submitted: true, late: true } }), st({ detail: { submitted: false } }), st({ due: NOW + D, detail: { submitted: false } }), st({})],
    ['submitted', 'late', 'missed', 'pending', 'unknown']);
  assert.deepEqual([MAK.historyStatus({ kind: 'exam', complete: true }, NOW), MAK.historyStatus({ kind: 'exam', due: NOW + D }, NOW), MAK.historyStatus({ kind: 'exam', due: NOW - D }, NOW)], ['sent', 'pending', 'noRecord']);
  assert.deepEqual([MAK.academicYear({ siteId: '2025_0_240610_1_G' }), MAK.academicYear({ siteId: 'uuid', due: Date.UTC(2026, 9, 6) }), MAK.academicYear({ siteId: 'uuid', due: Date.UTC(2026, 3, 6) })],
    ['2025/26', '2026/27', '2025/26']);
});

test('the background: reads the panel and the submission of each task; later only what can still change; without a session, a message', async () => {
  const log = [];
  let tasks = RAW;
  const fetch = fakeFetch({
    '/direct/session/current.json': { userId: 'u' },
    '/api/users/me/tasks': () => ({ tasks, canAddTask: true }),
    '/direct/assignment/item/a1.json': item(SENT),
    '/direct/assignment/item/a2.json': item(null, { id: 'a2' })
  }, log);
  const bg = loadBackground({ fetch, now: NOW });
  assert.deepEqual(await bg.send({ type: 'historyRefresh' }), { ok: true, items: 3 });
  const { history } = await bg.ext.storage.local.get('history');
  assert.equal(history.items['/assignment/a/2025_0_240610_1_G/a1'].detail.feedback.grade, '8,5');
  assert.ok(!bg.MAK.DATA_KEYS.includes('history') && bg.MAK.USER_KEYS.includes('history'), 'it stays after a logout; another user removes it');
  // A new task of now: its submission is read; the returned one of before is not read again.
  tasks = RAW.concat(task({ reference: '/assignment/a/2026_0_240702_1_G/a2', siteId: '2026_0_240702_1_G', due: NOW + 5 * D }));
  log.length = 0;
  assert.deepEqual(await bg.send({ type: 'historyRefresh' }), { ok: true, items: 4 });
  assert.deepEqual(log.map((x) => x.key).filter((k) => k.startsWith('/direct/assignment/item/')), ['/direct/assignment/item/a2.json']);
  tasks = null;
  const login = loadBackground({ fetch: fakeFetch({ '/api/users/me/tasks': fakeFetch.raw(response('<html>login</html>', { type: 'text/html' })) }), now: NOW });
  assert.deepEqual(await login.send({ type: 'historyRefresh' }), { error: 'history.login' });
});

test('the history is not read while paused or empty, or without a session; another user: the data of the old one goes first', async () => {
  const log = [];
  const routes = { '/direct/session/current.json': { userId: 'u' }, '/api/users/me/tasks': { tasks: RAW } };
  const reset = loadBackground({ fetch: fakeFetch(routes, log), now: NOW, local: { paused: 'reset' } });
  assert.deepEqual(await reset.send({ type: 'historyRefresh' }), { error: 'history.paused' });
  assert.equal(reset.ext.storage.local.data.history, undefined);
  assert.equal(log.length, 0, 'no request');
  // "Pausar" only stops keeping the session: the history is read.
  const user = loadBackground({ fetch: fakeFetch(Object.assign({}, routes, { '/direct/assignment/item/a1.json': item(SENT) })), now: NOW, local: { paused: 'user' } });
  assert.ok((await user.send({ type: 'historyRefresh' })).ok);
  // Logged out (the pause of a logout) and still without a session: the login.
  const out = loadBackground({ fetch: fakeFetch({ '/direct/session/current.json': { userId: null } }), now: NOW, local: { paused: true } });
  assert.deepEqual(await out.send({ type: 'historyRefresh' }), { error: 'history.login' });
  // The kept history is of user "a"; "u" logged in: it goes, then the history of "u".
  const other = loadBackground({ fetch: fakeFetch(Object.assign({}, routes, { '/direct/assignment/item/a1.json': item(SENT) })), now: NOW,
    local: { meta: { userId: 'a' }, history: { at: 1, items: { '/assignment/a/x/old': { ref: '/assignment/a/x/old', kind: 'task', title: 'Of user a' } } } } });
  const r = await other.send({ type: 'historyRefresh' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(other.ext.storage.local.data.history.items['/assignment/a/x/old'], undefined, 'nothing of the other user');
});
