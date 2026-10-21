'use strict';
// The official grades of the Expediente of SIGMA (lib/record.js, background.js): what the background keeps,
// who can send it, and the reading in a background tab.
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
  assert.equal(await bg.send({ type: 'recordTab' }, SIGMA), false, 'no reading in the background: the script does not follow links');
});

test('the reading: in the background (every 3 days) or visible ("Leer ahora"); the tab closes at "Expediente completo"', async () => {
  // The longest time of the tab (90 s) does not run in the test.
  const bg = loadBackground({ web: { setTimeout: (f, ms) => (ms >= 60000 ? 0 : setTimeout(f, ms)) } });
  assert.deepEqual(await bg.send({ type: 'recordRefresh' }), { error: 'record.permission' }, 'nothing without the permission');
  await bg.fireAlarm('sigma-record');
  assert.equal(bg.ext._tabs.length, 0);
  await bg.ext.permissions.request(bg.MAK.RECORD_PERMISSION);
  await bg.fireAlarm('sigma-record');
  assert.deepEqual(JSON.parse(JSON.stringify(bg.ext._tabs.at(-1))), { url: 'https://portal.unavarra.es/group/estudiantes/servicios-sigma', active: false }, 'in the background');
  const tab = { id: bg.ext._tabs.length };
  const inTab = Object.assign({}, SIGMA, { tab });
  assert.equal(await bg.send({ type: 'recordTab' }, inTab), true);
  assert.equal(await bg.send({ type: 'recordTab' }, Object.assign({}, SIGMA, { tab: { id: 99 } })), false, 'another tab of the user');
  assert.equal(await bg.send({ type: 'recordTab' }, Object.assign({}, inTab, { frameId: 3 })), true, 'SIGMA in a frame of the tab');
  assert.deepEqual(await bg.send({ type: 'recordSave', record: { rows: [row()], credits: [] } }, inTab), { ok: true });
  assert.equal(bg.ext._tabs.removed, undefined, '"Año actual": the tab goes on to "Expediente completo"');
  assert.deepEqual(await bg.send({ type: 'recordSave', record: { rows: [row({ code: 'B' })], credits: [] }, complete: true }, inTab), { ok: true });
  assert.deepEqual([...bg.ext._tabs.removed], [tab.id], 'the tab closes');
  assert.equal((await bg.ext.storage.local.get('record')).record.rows.length, 2);
  await bg.fireAlarm('sigma-record');
  assert.equal(bg.ext._tabs.length, 1, 'read now: no other reading for 3 days');
  assert.deepEqual(await bg.send({ type: 'recordRefresh' }), { ok: true });
  assert.equal(bg.ext._tabs.at(-1).active, true, '"Leer ahora": a visible tab');
  assert.deepEqual(await bg.send({ type: 'recordOff' }), { ok: true });
  assert.deepEqual(JSON.parse(JSON.stringify(await bg.ext.storage.local.get(['record', 'recordTry']))), {}, 'turned off: the grades go');
});
