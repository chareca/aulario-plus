'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBackground, fakeFetch } = require('./helpers');
const F = require('./fixtures/miaulario');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function synced(local) {
  const bg = loadBackground({ fetch: fakeFetch(F.make(Date.now()).routes()), local });
  await bg.send({ type: 'syncNow' });
  await wait(450); // the badge waits 300 ms to group the changes
  return bg;
}

test('after a sync the badge shows the deliveries due soon and the unread items', async () => {
  const bg = await synced();
  // 3 deliveries (late, < 24 h, < 72 h) + 3 unread announcements + 3 unread messages. Forums are off by default.
  assert.equal(bg.ext._badge.text, '9');
  assert.equal(bg.ext._badge.color, '#c5221f', 'red: a delivery is late');
  assert.equal(bg.ext._badge.title, 'MiAulario: 3 entregas pronto · 6 sin leer · 0 notas nuevas');
});

test('the settings change the badge at once', async () => {
  const bg = await synced();
  await bg.send({ type: 'setSettings', patch: { badge: { forums: true } } });
  await wait(450);
  assert.equal(bg.ext._badge.text, '14', '+5 unread forum posts');
  await bg.send({ type: 'setSettings', patch: { badge: { deliveries: false, forums: false } } });
  await wait(450);
  assert.equal(bg.ext._badge.text, '6');
  assert.equal(bg.ext._badge.color, '#1a5fb4', 'blue: the deliveries are not counted');
  await bg.send({ type: 'setSettings', patch: { lang: 'en' } });
  await wait(450);
  assert.equal(bg.ext._badge.title, 'MiAulario: 0 deliveries soon · 6 unread · 0 new grades');
  await bg.send({ type: 'setSettings', patch: { badge: { enabled: false } } });
  await wait(450);
  assert.equal(bg.ext._badge.text, '');
  assert.equal(bg.ext._badge.title, 'MiAulario Keep-Alive');
});

test('reading an announcement lowers the number', async () => {
  const bg = await synced();
  await bg.send({ type: 'markAnnRead', ids: [`${F.PHYS}:main:ann-3`] });
  await wait(450);
  assert.equal(bg.ext._badge.text, '8');
});

test('computeBadge: no data, sync off, and more than 99 items', async () => {
  const bg = loadBackground();
  const MAK = bg.MAK;
  const now = Date.now();
  assert.equal(MAK.computeBadge({}, now).text, '');
  assert.equal(MAK.computeBadge({ meta: { lastSync: now }, settings: { syncEnabled: false } }, now).text, '');
  const many = MAK.computeBadge({ meta: { lastSync: now }, synoptic: [{ siteId: 's', messages: 150, forums: 0 }], sites: [{ id: 's', title: 'S' }] }, now);
  assert.equal(many.text, '99+');
  assert.equal(MAK.computeBadge({ meta: { lastSync: now } }, now).text, '', 'nothing to show');
});

test('computeBadge: new grades count until the user opens the Grades tab', () => {
  const bg = loadBackground();
  const MAK = bg.MAK;
  const now = Date.now();
  const d = {
    meta: { lastSync: now },
    sites: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }],
    grades: [
      { id: '1', siteId: 'a', graded: true, gradedAt: now - 1000 },
      { id: '2', siteId: 'b', graded: true, gradedAt: now - 1000 },
      { id: '3', siteId: 'a', graded: true, gradedAt: 0 },
      { id: '4', siteId: 'a', graded: false, gradedAt: null }
    ]
  };
  assert.equal(MAK.computeBadge(d, now).grades, 2, 'the baseline grades (gradedAt 0) are not new');
  assert.equal(MAK.computeBadge(Object.assign({}, d, { gradesSeenAt: now - 500 }), now).grades, 0);
  assert.equal(MAK.computeBadge(Object.assign({}, d, { settings: { hiddenSites: ['b'] } }), now).grades, 1, 'hidden site');
  assert.equal(MAK.computeBadge(Object.assign({}, d, { settings: { badge: { grades: false } } }), now).grades, 0);
});

test('markGradesSeen keeps the time when the user opened the Grades tab', async () => {
  const bg = loadBackground();
  const before = Date.now();
  assert.deepEqual(await bg.send({ type: 'markGradesSeen' }), { ok: true });
  const { gradesSeenAt } = await bg.ext.storage.local.get('gradesSeenAt');
  assert.ok(gradesSeenAt >= before);
});
