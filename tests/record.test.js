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
  assert.ok(!bg.MAK.DATA_KEYS.includes('record') && bg.MAK.RECORD_KEYS.includes('record'), 'not with the course data');
  await bg.send({ type: 'logout' }, MIAULARIO);
  assert.ok((await bg.ext.storage.local.get('record')).record, 'a logout keeps them (the same user comes back; another user: sync.test.js)');
  assert.equal(await bg.send({ type: 'recordTab', sigma: true }, SIGMA), false, 'no reading: the script does not follow links');
});

const CREDITS = [{ kind: 'Formación básica', passed: 60, pending: 0, min: 60 }, { kind: 'Obligatoria', passed: 96, pending: 12, min: 168 }, { kind: 'Trabajo fin de Grado', passed: 0, pending: 0, min: 12 }];
// As SIGMA: after "Total", two other totals.
const OTHERS = [{ kind: 'Total créditos reconocidos', passed: 6, pending: null, min: null }, { kind: 'Total créditos matriculados', passed: 168, pending: null, min: 240 }];

test('recordSummary: the credits of the degree (the row "Total" of SIGMA, else its kinds), the rank by its part, the stage', () => {
  const sum = MAK.recordSummary({ rows: [], credits: [...CREDITS, { kind: 'Total', passed: 156, pending: 12, min: 240 }, ...OTHERS] });
  assert.deepEqual(JSON.parse(JSON.stringify(sum)), { passed: 156, total: 240, pct: 65, left: 84, rank: MAK.RANKS[4], stage: 'Late' });
  assert.equal(MAK.recordSummary({ rows: [], credits: [...CREDITS, ...OTHERS] }).total, 240, 'no row "Total": the kinds, not the other totals');
  const at = (passed) => MAK.recordSummary({ rows: [], credits: [{ kind: 'Total', passed, min: 240 }] });
  assert.deepEqual([0, 36, 72, 108, 144, 180, 216].map((p) => at(p).rank.id), ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'legend'], 'every 15 %');
  assert.deepEqual([12, 60, 120, 180, 228].map((p) => at(p).stage), ['Start', 'Early', 'Half', 'Late', 'Last'], '5, 25, 50, 75 and 95 %');
  assert.deepEqual([at(239).pct, at(239).stage, at(239).left], [99, 'Last', 1], '99,6 %: not the end');
  assert.deepEqual([at(246).pct, at(246).stage, at(246).left, at(246).rank.id], [100, 'Done', 0, 'legend'], 'more optional credits than the minimum');
  assert.equal(MAK.recordSummary({ rows: [row()], credits: [] }), null, 'no table of credits: no rank');
  assert.equal(MAK.recordSummary(null), null);
});

test('stageText: three messages for each stage, another one each day; all in Spanish and English', () => {
  const M = loadLib('core', 'i18n', 'names', 'record');
  const sum = (passed) => M.recordSummary({ rows: [], credits: [{ kind: 'Total', passed, min: 240 }] });
  const days = [0, 1, 2, 3].map((d) => M.stageText(sum(120), d * M.DAY));
  assert.equal(new Set(days.slice(0, 3)).size, 3, 'three days, three messages');
  assert.equal(days[3], days[0], 'then again');
  for (const lang of ['es', 'en']) {
    for (const id of ['Start', 'Early', 'Half', 'Late', 'Last']) for (const n of [1, 2, 3]) assert.ok(M.STRINGS[lang][`record.stage${id}${n}`], `${lang}: record.stage${id}${n}`);
    assert.ok(M.STRINGS[lang]['record.stageDone']);
  }
  assert.match(M.stageText(sum(239), 0), /1 crédito\b/, 'one credit left: not "1 créditos"');
  assert.doesNotMatch(M.stageText(sum(0), 0), /0 %/, 'the start: no "0 %"');
});

test('recordGain: only what went up since the user saw it (new passed subjects, a higher rank)', () => {
  const credits = (passed) => [{ kind: 'Total', passed, min: 240 }];
  const before = { rows: [row({ code: 'A', mark: 6.8 }), row({ code: 'B', mark: 4 })], credits: credits(66) };
  const seen = MAK.recordSeenOf(before);
  assert.deepEqual(seen, { codes: ['A'], pct: 27 });
  assert.equal(MAK.recordGain(before, null), null, 'the first reading: nothing is news');
  assert.equal(MAK.recordGain(before, seen), null, 'nothing new');
  const up = MAK.recordGain({ rows: [...before.rows, row({ code: 'B', call: 'Junio', mark: 8, name: 'Redes' })], credits: credits(72) }, seen);
  assert.deepEqual(JSON.parse(JSON.stringify(up)), { subjects: [{ name: 'Redes', credits: 6 }], rankUp: MAK.RANKS[2] }, 'B passed in June: 30 %, Oro');
  const same = MAK.recordGain({ rows: [...before.rows, row({ code: 'C', mark: 5, name: 'Física' })], credits: credits(66) }, seen);
  assert.deepEqual(JSON.parse(JSON.stringify(same)), { subjects: [{ name: 'Física', credits: 6 }], rankUp: null });
  assert.equal(MAK.recordGain(before, { codes: ['A'], average: 6.8 }), null, 'a seen state of a version before (an average, no part): no rank up');
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
