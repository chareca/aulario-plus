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

const EMAILS = `The following assessment submission was recorded by MiAulario/NireIkasgelategia:

    Site Title          : 23_0_240107_1_G FÍSICA
    Assessment          : I1.2
    Student             : Nicolas Chareca  (chareca.165075)
    Submission ID       : 1175359
    Submitted Date      : Mon Oct 09 09:36:21 CEST 2023
    Confirmation Number : 1175359-115388-0437d018-1ade-44eb-9e61-49e186cb9ae6-1696836981837
    Assessment Due Date : 2023-oct.-09 10:00 a. m.
    Site ID             : 2023_0_240107_1_G

The following assessment submission was recorded by MiAulario/NireIkasgelategia:

    Site Title          : 25_0_240610_1_G APRENDIZAJE AUTOMÁTICO
    Assessment          : Examen práctico - Parcial II
    Submission ID       : 1542353
    Submitted Date      : Tue Dec 16 18:19:16 CET 2025
    Confirmation Number : 1542353-141817-0437d018-1ade-44eb-9e61-49e186cb9ae6-1765905556901
    Assessment Due Date : 2025-dic-16 07:00 p. m.
    Site ID             : 2025_0_240610_1_G`;

test('parseSubmissionEmails: the confirmation emails that the user pastes, as exams with their dates', () => {
  const items = MAK.parseSubmissionEmails(EMAILS);
  assert.deepEqual(items.map((x) => `${x.kind}:${x.ref}`), ['exam:/samigo/2023_0_240107_1_G/115388', 'exam:/samigo/2025_0_240610_1_G/141817']);
  const fis = items[0];
  assert.deepEqual([fis.title, fis.siteTitle, fis.complete, fis.source], ['I1.2', '23_0_240107_1_G FÍSICA', true, 'email']);
  assert.equal(new Date(fis.due).getFullYear(), 2023);
  assert.equal(new Date(fis.detail.date).getHours(), 9, 'submitted at 09:36');
  assert.equal(MAK.academicYear(fis), '2023/24');
  assert.equal(MAK.historyStatus(fis, Date.now()), 'sent');
  // p. m.: 07:00 p. m. is 19:00.
  assert.equal(new Date(items[1].due).getHours(), 19);
  assert.equal(MAK.parseSubmissionEmails('nothing here').length, 0);
  assert.equal(MAK.parseSubmissionEmails('').length, 0);
});

test('the background imports the pasted emails and keeps them with the panel history (does not duplicate)', async () => {
  const bg = loadBackground({ fetch: fakeFetch({ '/api/users/me/tasks': { tasks: RAW }, '/direct/assignment/item/a1.json': item(SENT) }), now: NOW });
  await bg.send({ type: 'historyRefresh' });
  const r = await bg.send({ type: 'historyImport', text: EMAILS });
  assert.deepEqual([r.ok, r.total, r.added], [true, 2, 1], 'the 2023 exam is new; the 2025 one was already in the panel: no duplicate');
  const { history } = await bg.ext.storage.local.get('history');
  assert.ok(history.items['/samigo/2023_0_240107_1_G/115388'], 'the 2023 exam is in the history');
  // The exam of 2025 was already in the panel (RAW): the import does not add it twice.
  const again = await bg.send({ type: 'historyImport', text: EMAILS });
  assert.equal(again.added, 0, 'nothing new the second time');
  assert.deepEqual(await bg.send({ type: 'historyImport', text: 'no emails' }), { ok: true, added: 0, total: 0 });
});
