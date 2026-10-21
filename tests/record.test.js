'use strict';
// The official grades of the Expediente of SIGMA (lib/record.js, background.js): what the background keeps,
// who can send it, the average and the rank, and the reading in a background tab or a small window.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, loadBackground } = require('./helpers');
const MAK = loadLib('core', 'record');

const row = (o) => Object.assign({ year: '2025/26-1', code: '240101', name: 'Matemáticas I', credits: 6, group: '1', call: 'Enero', callText: '1', grade: 'NOTABLE', mark: 7.5,
  kind: 'Básica', course: '1', term: '1', notes: '' }, o);

test('cleanRecord: only the fields, short texts, numbers or null; no rows without a code', () => {
  const r = MAK.cleanRecord({ rows: [row({ mark: '7.5', name: 'x'.repeat(500), extra: 'no' }), { code: '' }, null], credits: [{ kind: 'Obligatoria', passed: 30, pending: 'a', min: 90 }, {}] });
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].mark, null, 'a text is not a number');
  assert.equal(r.rows[0].name.length, 160);
  assert.equal('extra' in r.rows[0], false);
  assert.deepEqual(r.credits, [{ kind: 'Obligatoria', passed: 30, pending: null, min: 90 }]);
  assert.equal(MAK.cleanRecord({}), null);
  assert.equal(MAK.cleanRecord({ rows: Array.from({ length: 500 }, (_, i) => row({ code: String(i) })) }).rows.length, 300);
});

test('mergeRecord: a smaller table ("Año actual") keeps the other rows; the new grade of the same call wins', () => {
  const kept = { rows: [row({ code: 'A', grade: '' , mark: null }), row({ code: 'B', year: '2024/25-2' })], credits: [{ kind: 'Total', passed: 60, pending: 0, min: 240 }] };
  const next = { rows: [row({ code: 'A', grade: 'SOBRESALIENTE', mark: 9.2 }), row({ code: 'A', call: 'Junio', grade: 'APROBADO', mark: 5 })], credits: [] };
  const m = MAK.mergeRecord(kept, next);
  assert.deepEqual(m.rows.map((r) => `${r.code} ${r.call} ${r.grade}`), ['A Enero SOBRESALIENTE', 'B Enero NOTABLE', 'A Junio APROBADO']);
  assert.deepEqual(m.credits, kept.credits, 'no new credits: the kept ones');
  assert.deepEqual(MAK.mergeRecord(null, next).rows.length, 2);
});

const SIGMA = { id: 'ext-id', tab: { id: 1 }, frameId: 0, url: 'https://academicos.unavarra.es/exps-war/Controlador/?apl=x' };
const MIAULARIO = { id: 'ext-id', tab: { id: 1 }, frameId: 0, url: 'https://miaulario.unavarra.es/portal' };
const OTHER = { id: 'ext-id', tab: { id: 1 }, frameId: 0, url: 'https://evil.example/exps-war' };

test('the background keeps the grades only from SIGMA, and only with rows', async () => {
  const bg = loadBackground();
  const record = { rows: [row()], credits: [] };
  assert.equal(await bg.send({ type: 'recordSave', record }, MIAULARIO), null, 'a page of MiAulario cannot send it');
  assert.equal(await bg.send({ type: 'recordSave', record }, OTHER), null, 'another site cannot send it');
  assert.deepEqual(await bg.send({ type: 'recordSave', record: { rows: [] } }, SIGMA), { error: 'record.empty' });
  assert.deepEqual(await bg.send({ type: 'recordSave', record }, SIGMA), { ok: true });
  const { record: kept } = await bg.ext.storage.local.get('record');
  assert.equal(kept.rows[0].grade, 'NOTABLE');
  assert.ok(kept.at > 0);
  assert.ok(bg.MAK.DATA_KEYS.includes('record'), 'a logout removes them');
  assert.equal(await bg.send({ type: 'recordTab', sigma: true }, SIGMA), false, 'no reading: the script does not follow links');
});

test('recordSummary: the passed subjects with a number, weighted by credits, the best mark of each; the rank and the next one', () => {
  const sum = MAK.recordSummary({ rows: [
    row({ code: 'A', credits: 6, mark: 4 }), row({ code: 'A', credits: 6, call: 'Junio', mark: 6 }), // failed, then passed: 6
    row({ code: 'B', credits: 12, mark: 9 }),
    row({ code: 'C', credits: 6, mark: 10, notes: 'Anulada' }), // annulled: no
    row({ code: 'D', credits: 6, mark: null, grade: 'APTO' }), // no number: no
    row({ code: 'E', credits: null, mark: 8 }) // no credits: no
  ] });
  assert.deepEqual([sum.count, sum.credits, sum.average], [2, 18, 8]); // (6·6 + 12·9) / 18
  assert.deepEqual([sum.rank.id, sum.next.id, sum.need], ['platinum', 'diamond', 0.5]);
  const top = MAK.recordSummary({ rows: [row({ mark: 9.75 })] });
  assert.deepEqual([top.rank.id, top.next, top.need], ['legend', null, 0]);
  assert.equal(MAK.recordSummary({ rows: [row({ mark: 6.999 })] }).rank.id, 'gold', 'the rank of the average that the user sees: 7,00');
  assert.equal(MAK.recordSummary({ rows: [row({ mark: 3 })] }), null, 'nothing passed');
  assert.equal(MAK.recordSummary(null), null);
});

test('the reading: in the background (every 3 days) or in a small window ("Abrir expediente"); it ends after "Expediente completo"', async () => {
  const bg = loadBackground();
  assert.deepEqual(await bg.send({ type: 'recordOpen' }), { error: 'record.permission' }, 'nothing without the permission');
  await bg.fireAlarm('sigma-record');
  assert.equal(bg.ext._tabs.length, 0);
  await bg.ext.permissions.request(bg.MAK.RECORD_PERMISSION);
  await bg.fireAlarm('sigma-record');
  assert.deepEqual(JSON.parse(JSON.stringify(bg.ext._tabs.at(-1))), { url: 'https://portal.unavarra.es/group/estudiantes/servicios-sigma', active: false }, 'in the background');
  assert.ok(bg.ext._alarms.get('sigma-record-end'), 'an alarm ends it (a timer dies with the worker)');
  const tab = { id: bg.ext._tabs.length };
  const inTab = Object.assign({}, SIGMA, { tab });
  const portal = Object.assign({}, inTab, { url: 'https://portal.unavarra.es/group/estudiantes/servicios-sigma' });
  assert.equal(await bg.send({ type: 'recordTab', sigma: false }, portal), true, 'MiUPNA: to SIGMA');
  assert.equal(await bg.send({ type: 'recordTab', sigma: true }, Object.assign({}, SIGMA, { tab: { id: 99 } })), false, 'another tab of the user');
  assert.deepEqual(await bg.send({ type: 'recordSave', record: { rows: [row()], credits: [] } }, inTab), { ok: true });
  assert.equal(bg.ext._tabs.removed, undefined, '"Año actual": the tab goes on');
  assert.equal(await bg.send({ type: 'recordTab', sigma: true }, inTab), true, 'to "Expediente completo"');
  assert.equal(await bg.send({ type: 'recordTab', sigma: true }, inTab), false, 'once: SIGMA has the same address for every view');
  assert.deepEqual(await bg.send({ type: 'recordSave', record: { rows: [row({ code: 'B' })], credits: [] } }, Object.assign({}, inTab, { frameId: 3 })), { ok: true });
  assert.deepEqual([...bg.ext._tabs.removed], [tab.id], 'its table (also in a frame): the tab closes');
  assert.equal((await bg.ext.storage.local.get('record')).record.rows.length, 2);
  await bg.fireAlarm('sigma-record');
  assert.equal(bg.ext._tabs.length, 1, 'read now: no other reading for 3 days');

  // "Abrir expediente" on the rank in MiAulario: a small window; at the end, the result in that tab.
  const shown = [];
  bg.ext._tabs.receivers = { 7: (msg) => shown.push(msg.type) && true };
  assert.deepEqual(await bg.send({ type: 'recordOpen' }, Object.assign({}, MIAULARIO, { tab: { id: 7 } })), { ok: true });
  const win = bg.ext._tabs.at(-1);
  assert.deepEqual([win.window, win.type, win.url, win.width, win.left], [true, 'popup', 'https://portal.unavarra.es/group/estudiantes/servicios-sigma', 640, 400], 'centered');
  const inWin = Object.assign({}, SIGMA, { tab: { id: bg.ext._tabs.length } });
  assert.deepEqual(await bg.send({ type: 'recordOpen' }, Object.assign({}, MIAULARIO, { tab: { id: 7 } })), { ok: true });
  assert.equal(bg.ext._tabs.length, 2, 'a second click: the same window');
  assert.equal(await bg.send({ type: 'recordTab', sigma: true }, inWin), true);
  await bg.send({ type: 'recordSave', record: { rows: [row({ code: 'C' })], credits: [] } }, inWin);
  assert.deepEqual([bg.ext._tabs.removed.at(-1), shown], [inWin.tab.id, ['recordDone']], 'the window closes; the tab of MiAulario shows the result');

  // From the popup, with another site in the active tab: the popup shows the result.
  assert.deepEqual(await bg.send({ type: 'recordOpen' }), { ok: true });
  const inWin2 = Object.assign({}, SIGMA, { tab: { id: bg.ext._tabs.length } });
  await bg.send({ type: 'recordTab', sigma: true }, inWin2);
  await bg.send({ type: 'recordSave', record: { rows: [row({ code: 'D' })], credits: [] } }, inWin2);
  assert.equal(bg.ext._badge.popups, 1, 'the popup opens');
  assert.equal((await bg.ext.storage.session.get('recordNews')).recordNews, true);

  assert.deepEqual(await bg.send({ type: 'recordOff' }), { ok: true });
  assert.deepEqual(JSON.parse(JSON.stringify(await bg.ext.storage.local.get(['record', 'recordTry']))), {}, 'turned off: the grades go');
});
