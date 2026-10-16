'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBackground, fakeFetch } = require('./helpers');
const F = require('./fixtures/miaulario');

const GRADES = '/api/users/me/grades';
const graded = (ids, score = '9') => ({ grades: F.GRADES.map((g) => (ids.includes(g.id) ? Object.assign({}, g, { score, notGradedYet: false }) : g)) });

// A background with the first sync done (the baseline: no notifications).
async function baseline(local) {
  const data = F.make(Date.now());
  const routes = data.routes();
  const bg = loadBackground({ fetch: fakeFetch(routes), local });
  await bg.send({ type: 'syncNow' });
  assert.equal(bg.ext._notes.size, 0, 'no notification for the grades of the first sync');
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
