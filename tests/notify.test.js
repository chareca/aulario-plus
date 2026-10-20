'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBackground, fakeFetch } = require('./helpers');
const F = require('./fixtures/miaulario');

const GRADES = '/api/users/me/grades';
const graded = (ids, score = '9') => ({ grades: F.GRADES.map((g) => (ids.includes(g.id) ? Object.assign({}, g, { score, notGradedYet: false }) : g)) });

// A background with the first sync done (the baseline: no notifications). The reminders before
// the deliveries are off, except for their own tests (local: {}).
async function baseline(local = { settings: { notifyDue: false } }) {
  const data = F.make(Date.now());
  const routes = data.routes();
  const bg = loadBackground({ fetch: fakeFetch(routes), local });
  await bg.send({ type: 'syncNow' });
  assert.equal([...bg.ext._notes.keys()].filter((k) => k.startsWith('grade')).length, 0, 'no notification for the grades of the first sync');
  return { bg, routes, data };
}

test('a new grade shows one notification without the grade; a click opens the item; logout removes it', async () => {
  const { bg, routes, data } = await baseline();
  routes[GRADES] = graded([503], '8,25');
  await bg.send({ type: 'syncNow' });
  assert.deepEqual([...bg.ext._notes.keys()], ['grade:503']);
  const note = bg.ext._notes.get('grade:503');
  assert.equal(note.title, `Nota nueva · ${data.SITES.find((s) => s.id === F.CS).title}`);
  assert.equal(note.message, 'Lab report 1');
  assert.ok(!JSON.stringify(note).includes('8,25'), 'the grade is not in the notification');
  assert.equal(note.iconUrl, 'chrome-extension://ext-id/icons/icon128.png');

  for (const f of bg.ext._listeners.noteClick) f('grade:503');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(bg.ext._tabs.at(-1).url, `https://miaulario.unavarra.es${F.GRADES.find((g) => g.id === 503).url}`);
  assert.equal(bg.ext._notes.size, 0, 'the click removes the notification');

  routes[GRADES] = graded([503, 504]);
  await bg.send({ type: 'syncNow' });
  assert.equal(bg.ext._notes.size, 2, '503 changed (8,25 -> 9) and 504 is new');
  await bg.send({ type: 'logout' }, { id: bg.ext.runtime.id, url: 'https://miaulario.unavarra.es/portal', tab: { id: 1 }, frameId: 0 });
  assert.equal(bg.ext._notes.size, 0);
});

test('4 or more new grades show one summary that opens the Grades tab', async () => {
  const { bg, routes } = await baseline();
  routes[GRADES] = graded([501, 502, 503, 504], '6');
  await bg.send({ type: 'syncNow' });
  assert.deepEqual([...bg.ext._notes.keys()], ['grades']);
  assert.equal(bg.ext._notes.get('grades').title, '4 notas nuevas');
  for (const f of bg.ext._listeners.noteClick) f('grades');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(bg.ext._tabs.at(-1).url, 'chrome-extension://ext-id/popup.html?view=tab&tab=grades');
});

test('no notification for a hidden site or when the setting is off', async () => {
  const { bg, routes } = await baseline();
  await bg.send({ type: 'setSettings', patch: { hiddenSites: [F.CS] } });
  routes[GRADES] = graded([503]);
  await bg.send({ type: 'syncNow' });
  assert.equal(bg.ext._notes.size, 0, 'hidden site');
  await bg.send({ type: 'setSettings', patch: { hiddenSites: [], notifyGrades: false } });
  routes[GRADES] = graded([503, 504]);
  await bg.send({ type: 'syncNow' });
  assert.equal(bg.ext._notes.size, 0, 'setting off');
});

test('a click after a restart of the background reads the URL from the storage', async () => {
  const item = { id: '77', siteId: F.MATH, siteTitle: 'M', name: 'Exam', score: '5', graded: true, url: 'https://miaulario.unavarra.es/portal/directtool/x-tool-6', gradedAt: 1 };
  const bg = loadBackground({ local: { grades: [item, Object.assign({}, item, { id: '78', url: 'https://evil.example/x' })] } });
  for (const f of bg.ext._listeners.noteClick) f('grade:77');
  for (const f of bg.ext._listeners.noteClick) f('grade:78');
  for (const f of bg.ext._listeners.noteClick) f('other');
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(bg.ext._tabs.map((x) => x.url), [item.url, `https://miaulario.unavarra.es/portal/site/${F.MATH}`]);
});

// ---- The reminder 1 hour before a delivery ---------------------------------------

const ASG = '/direct/assignment/my.json';
// The deliveries of the fixture, with "asg-red" due in `inMs` and maybe submitted.
function dueRoutes(data, routes, inMs, submitted) {
  const now = Date.now();
  routes[ASG] = { assignment_collection: data.ASSIGNMENTS.map((a) => (a.id !== 'asg-red' ? a : Object.assign({}, a, {
    dueTime: data.epoch(now + inMs),
    closeTime: data.epoch(now + inMs),
    submissions: submitted ? [{ submitted: true, userSubmission: true, canSubmit: false }] : a.submissions
  }))) };
}
const settle = () => new Promise((r) => setTimeout(r, 450));

test('a delivery that is not submitted and due in 40 minutes: one notification; a click opens the delivery', async () => {
  const { bg, routes, data } = await baseline({});
  dueRoutes(data, routes, 40 * 60000);
  await bg.send({ type: 'syncNow' });
  await settle();
  const note = bg.ext._notes.get('due:asg-red');
  assert.ok(note, [...bg.ext._notes.keys()].join());
  assert.match(note.title, /^⏰ Vence en (39|40) minutos$/);
  assert.equal(note.message, `Lab report 3\n${data.SITES.find((s) => s.id === F.CS).title}`);
  assert.ok(!bg.ext._notes.has('due:asg-late'), 'not a late delivery');
  assert.ok(!bg.ext._notes.has('due:asg-paper'), 'not a delivery on paper');
  assert.ok(!bg.ext._notes.has('due:asg-submitted'), 'not a submitted delivery');
  // Once: a new sync does not show it again.
  bg.ext._notes.clear();
  await bg.send({ type: 'syncNow', full: true });
  await settle();
  assert.equal(bg.ext._notes.has('due:asg-red'), false, 'one time');
  for (const f of bg.ext._listeners.noteClick) f('due:asg-red');
  await new Promise((r) => setTimeout(r, 20));
  assert.match(bg.ext._tabs.at(-1).url, /assignmentReference=%2Fassignment%2Fa%2F.*asg-red/);
});

test('logout removes the reminders and their alarms', async () => {
  const { bg, routes, data } = await baseline({});
  dueRoutes(data, routes, 5 * 3600000);
  await bg.send({ type: 'syncNow' });
  await settle();
  assert.ok(bg.ext._notes.has('due:asg-red') && bg.ext._alarms.has('due:asg-red'));
  await bg.send({ type: 'logout' }, { id: bg.ext.runtime.id, url: 'https://miaulario.unavarra.es/portal', tab: { id: 1 }, frameId: 0 });
  assert.equal(bg.ext._notes.has('due:asg-red'), false);
  assert.equal([...bg.ext._alarms.keys()].filter((k) => k.startsWith('due:')).length, 0);
});

test('due in 5 hours: the reminder of 24 hours now, and an alarm for the one of 1 hour; no alarm when submitted or off', async () => {
  const { bg, routes, data } = await baseline({});
  dueRoutes(data, routes, 5 * 3600000);
  await bg.send({ type: 'syncNow' });
  await settle();
  assert.equal(bg.ext._notes.get('due:asg-red').title, '⏰ Vence en 5 horas');
  const alarm = bg.ext._alarms.get('due:asg-red');
  assert.ok(alarm, [...bg.ext._alarms.keys()].join());
  const all = (await bg.ext.storage.local.get('assignments')).assignments;
  const due = all.find((a) => a.id === 'asg-red').due;
  assert.equal(alarm.scheduledTime, due - 3600000, 'the next reminder: 1 hour before');
  const orange = all.find((a) => a.id === 'asg-orange').due;
  assert.equal(bg.ext._alarms.get('due:asg-orange').scheduledTime, orange - 24 * 3600000, 'due in 2 days: 24 hours before');
  // Three reminders: also one week before.
  await bg.send({ type: 'setSettings', patch: { dueOffsets: [10080, 1440, 60] } });
  await settle();
  assert.ok(bg.ext._notes.has('due:asg-orange'), 'one week before: now');
  // The user submits it: no alarm.
  dueRoutes(data, routes, 5 * 3600000, true);
  await bg.send({ type: 'syncNow' });
  await settle();
  assert.equal(bg.ext._alarms.has('due:asg-red'), false, 'submitted');
  // The setting off: no alarm at all.
  await bg.send({ type: 'setSettings', patch: { notifyDue: false } });
  await settle();
  assert.equal([...bg.ext._alarms.keys()].filter((k) => k.startsWith('due:')).length, 0);
});
