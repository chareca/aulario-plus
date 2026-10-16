'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, loadBackground } = require('./helpers');
const F = require('./fixtures/miaulario');
const MAK = loadLib('core', 'store', 'sync', 'i18n', 'due');

const trimmed = F.ASSIGNMENTS.map(MAK.trimAssignment);
const pages = Object.fromEntries(F.SITES.map((s) => [s.id, MAK.trimPages(F.pages(s.id), F.NOW)]));
const build = (o = {}) => MAK.buildDue(Object.assign({ assignments: trimmed, sites: F.SITES, pages, hidden: new Set(), now: F.NOW }, o));
const ids = (list) => list.map((x) => x.id);

test('each delivery is in the correct group', () => {
  const { groups } = build();
  assert.deepEqual(ids(groups.late), ['asg-late']);
  assert.deepEqual(ids(groups.pending), ['asg-red', 'asg-orange', 'asg-new', 'asg-paper', 'asg-draft']);
  assert.deepEqual(ids(groups.action), ['asg-returned']);
  assert.deepEqual(ids(groups.submitted), ['asg-submitted']);
  assert.deepEqual(ids(groups.closed), ['asg-closed']);
});

test('urgency colors, and no color for deliveries on paper', () => {
  const { groups } = build();
  const u = Object.fromEntries([...groups.late, ...groups.pending].map((x) => [x.id, x.urgency]));
  assert.deepEqual(u, { 'asg-late': 'overdue', 'asg-red': 'red', 'asg-orange': 'orange', 'asg-new': 'yellow', 'asg-paper': null, 'asg-draft': 'green' });
});

test('a draft is not a submission', () => {
  assert.equal(MAK.deliveryState(trimmed.find((a) => a.id === 'asg-draft'), F.NOW), 'pending');
});

test('the state changes with the time', () => {
  const a = trimmed.find((x) => x.id === 'asg-red');
  assert.equal(MAK.deliveryState(a, F.NOW), 'pending');
  assert.equal(MAK.deliveryState(a, a.due + 1), 'closed', 'due time = close time: closed after the due time');
  const late = trimmed.find((x) => x.id === 'asg-late');
  assert.equal(MAK.deliveryState(late, late.close + 1), 'closed');
  const paper = trimmed.find((x) => x.id === 'asg-paper');
  assert.equal(MAK.deliveryState(Object.assign({}, paper, { close: null }), paper.due + 1), 'closed', 'paper: never late');
});

test('the badge counts: late and due in 72 hours, not submitted, not on paper', () => {
  const r = build();
  assert.equal(r.soon, 3); // late, red, orange
  assert.equal(r.urgent, true);
  const calm = build({ now: F.NOW - 30 * F.D });
  assert.equal(calm.soon, 0);
  assert.equal(calm.urgent, false);
});

test('hidden sites are not in the list', () => {
  const { groups } = build({ hidden: new Set([F.CS]) });
  const all = Object.values(groups).flat();
  assert.ok(all.length > 0);
  assert.ok(!all.some((x) => x.siteId === F.CS));
});

test('links go to the delivery in MiAulario', () => {
  const x = build().groups.late[0];
  assert.equal(x.url, `https://miaulario.unavarra.es/portal/directtool/${F.CS}-tool-3?assignmentId=asg-late&panel=Main&sakai_action=doView_submission`);
  assert.equal(MAK.deliveryUrl({ id: 'z', siteId: 'no-pages' }, pages), 'https://miaulario.unavarra.es/portal/site/no-pages');
});

test('countdown text in Spanish (default) and in English', () => {
  MAK.setLang('es');
  assert.equal(MAK.countdownText(F.NOW + 2 * F.D + 3 * F.H, F.NOW), 'quedan 2d 03h 00m');
  assert.equal(MAK.countdownText(F.NOW - 90 * 60000, F.NOW), 'vencida hace 1h 30m');
  assert.equal(MAK.countdownText(null, F.NOW), 'Sin fecha límite');
  MAK.setLang('en');
  assert.equal(MAK.countdownText(F.NOW + 2 * F.D + 3 * F.H, F.NOW), 'in 2d 03h 00m');
  assert.equal(MAK.countdownText(F.NOW - 90 * 60000, F.NOW), 'late by 1h 30m');
  assert.equal(MAK.countdownText(null, F.NOW), 'No due date');
  MAK.setLang('es');
});

test('setSettings accepts only known keys and correct values', async () => {
  const bg = loadBackground();
  const s = await bg.send({ type: 'setSettings', patch: { syncEnabled: 0, badge: { forums: 'yes', evil: true }, hiddenSites: ['a', 'a', 5, 'b'], hiddenMode: 'nowhere', other: 1 } });
  assert.equal(s.syncEnabled, false);
  assert.equal(s.badge.forums, true);
  assert.equal(s.badge.evil, undefined);
  assert.deepEqual(s.hiddenSites, ['a', 'b']);
  assert.equal(s.hiddenMode, 'everywhere');
  assert.equal(s.other, undefined);
  assert.equal(s.lang, 'es');
  assert.equal((await bg.send({ type: 'setSettings', patch: { lang: 'en' } })).lang, 'en');
  assert.equal((await bg.send({ type: 'setSettings', patch: { lang: 'de' } })).lang, 'en', 'unknown language: no change');
  assert.equal(await bg.send({ type: 'setSettings', patch: { syncEnabled: true } }, { id: 'ext-id', tab: { id: 1 }, frameId: 0, url: 'https://miaulario.unavarra.es/' }), null, 'a content script cannot change the settings');
});
