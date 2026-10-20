'use strict';
// The background part of the shortcuts of "Mi sitio": the public pages of the degrees, the exam
// calendars (with the optional permission for www2.unavarra.es) and the degree of the user.
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { loadBackground, response } = require('./helpers');

const CONTENT = { id: 'ext-id', tab: { id: 1 }, frameId: 0, url: 'https://miaulario.unavarra.es/portal' };
const BASE = 'https://www.unavarra.es/sites/grados/informatica-y-telecomunicacion/ingenieria-informatica';
const PDF_URL = 'https://www2.unavarra.es/gesadj/CyD1/ETSIIT/Examenes/Grados/Otono/240_otono.pdf';

// An exam calendar with two rows (the structure of the ETSIIIT calendar).
function calendarPdf() {
  const content = Buffer.from('BT [(240504)-1027(AN\\301LISIS)-13989(07/01/2027)-568(16:00)-18230(22/01/2027)-1126(12:00)]TJ ET\nBT [(240701)-1027(GESTI\\323N)-13989(22/12/2026)-568(12:00)-18230(21/01/2027)-1126(08:00)]TJ ET', 'latin1');
  const body = zlib.deflateSync(content);
  return Buffer.concat([Buffer.from(`%PDF-1.6\n1 0 obj\r<</Length ${body.length}/Filter/FlateDecode>>stream\r\n`, 'latin1'), body, Buffer.from('\r\nendstream\rendobj\r%%EOF', 'latin1')]);
}

function setup() {
  const calls = [];
  const fetch = async (url) => {
    calls.push(String(url));
    if (String(url) === PDF_URL) {
      const bytes = calendarPdf();
      return Object.assign(response(''), { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) });
    }
    return response('<html><body>page</body></html>', { type: 'text/html' });
  };
  const bg = loadBackground({ fetch });
  return { bg, calls, send: (msg) => bg.send(msg, CONTENT) };
}

test('fetchDegreePage: only the list of degrees and the page "Evaluación" of a degree', async () => {
  const { send, calls } = setup();
  assert.deepEqual(await send({ type: 'fetchDegreePage', url: 'https://www.unavarra.es/sites/grados/home.html' }), { html: '<html><body>page</body></html>' });
  assert.ok((await send({ type: 'fetchDegreePage', url: `${BASE}/evaluacion.html` })).html);
  for (const url of [`${BASE}/plan-de-estudios.html`, 'https://evil.example/sites/grados/a/b/evaluacion.html', 'https://www.unavarra.es/sites/grados/a/evaluacion.html', 'https://miaulario.unavarra.es/portal']) {
    assert.deepEqual(await send({ type: 'fetchDegreePage', url }), { error: 'degree.url' }, url);
  }
  assert.equal(calls.length, 2);
});

test('examRows: no permission for www2.unavarra.es: an error and no request', async () => {
  const { send, calls } = setup();
  assert.deepEqual(await send({ type: 'examRows', url: PDF_URL }), { error: 'exams.permission' });
  assert.deepEqual(await send({ type: 'examRows', url: 'https://evil.example/x.pdf' }), { error: 'exams.url' });
  assert.equal(calls.length, 0);
});

test('examRows: with the permission, the rows of the calendar; the second time from the storage', async () => {
  const { bg, send, calls } = setup();
  await bg.ext.permissions.request({ origins: ['https://www2.unavarra.es/*'] });
  const r = await send({ type: 'examRows', url: PDF_URL });
  assert.deepEqual(r.rows.map((x) => [x.code, x.name, new Date(x.final).getDate(), new Date(x.recovery).getDate()]), [['240504', 'ANÁLISIS', 7, 22], ['240701', 'GESTIÓN', 22, 21]]);
  const again = await send({ type: 'examRows', url: PDF_URL });
  assert.deepEqual(again, r);
  assert.equal(calls.length, 1, 'read again only after 1 day');
});

test('saveDegree and setDegree: the stored degree, and the degree that the user selects', async () => {
  const { bg, send } = setup();
  assert.deepEqual(await send({ type: 'saveDegree', degree: { base: 'https://evil.example/x' } }), { ok: false });
  await send({ type: 'saveDegree', degree: { base: BASE, name: 'Grado en Ingeniería Informática', plan: '240', periods: [], pdfs: [{ text: 'Exámenes Otoño', url: PDF_URL, season: 'autumn' }] }, list: [{ name: 'Grado en Derecho', base: 'https://www.unavarra.es/sites/grados/juridicas/derecho' }, { name: 'x', base: 'bad' }] });
  const d = await bg.ext.storage.local.get(['degree', 'degreeList']);
  assert.equal(d.degree.base, BASE);
  assert.ok(d.degree.at);
  assert.deepEqual(d.degreeList.list, [{ name: 'Grado en Derecho', base: 'https://www.unavarra.es/sites/grados/juridicas/derecho' }]);

  assert.deepEqual(await send({ type: 'setDegree', base: 'https://www.unavarra.es/sites/grados/juridicas/derecho' }), { ok: true });
  const after = await bg.ext.storage.local.get(['degree', 'settings']);
  assert.equal(after.settings.degree, 'https://www.unavarra.es/sites/grados/juridicas/derecho');
  assert.equal(after.degree, undefined, 'the degree is read again');
  assert.deepEqual(await send({ type: 'setDegree', base: 'https://evil.example/x' }), { ok: false });
  assert.deepEqual(await send({ type: 'setDegree', base: '' }), { ok: true });
  assert.equal((await bg.ext.storage.local.get('settings')).settings.degree, '');
});

test('setForwardEmail: only a correct address stays in the settings', async () => {
  const { bg, send } = setup();
  assert.deepEqual(await send({ type: 'setForwardEmail', email: 'yo@example.org' }), { ok: true });
  assert.equal((await bg.ext.storage.local.get('settings')).settings.forwardEmail, 'yo@example.org');
  assert.deepEqual(await send({ type: 'setForwardEmail', email: 'no <valid>' }), { ok: false });
  assert.equal((await bg.ext.storage.local.get('settings')).settings.forwardEmail, '');
});

test('setGuideGrades: the grades of the calculator of a known site; an empty object removes them', async () => {
  const bg = loadBackground({ local: { sites: [{ id: 'S1', title: 'SSI' }] } });
  const send = (msg) => bg.send(msg, CONTENT);
  assert.deepEqual(await send({ type: 'setGuideGrades', siteId: 'S1', grades: { Examen: 6, Malo: 20 } }), { ok: true });
  assert.deepEqual((await bg.ext.storage.local.get('settings')).settings.guideGrades, { S1: { Examen: 6 } });
  assert.deepEqual(await send({ type: 'setGuideGrades', siteId: 'other', grades: { Examen: 6 } }), { ok: false }, 'unknown site');
  await send({ type: 'setGuideGrades', siteId: 'S1', grades: {} });
  assert.deepEqual((await bg.ext.storage.local.get('settings')).settings.guideGrades, {});
});
