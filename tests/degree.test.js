'use strict';
// The degree of the user and the exam calendar: lib/pdftext.js and the parts of lib/degree.js
// without a DOM (tests/browser/degree-dom.test.js has the pages).
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { loadLib } = require('./helpers');
const MAK = loadLib('core', 'pdftext', 'degree');

// A small PDF: each stream is { content, dict, plain }. "plain": not compressed.
function pdf(streams) {
  const parts = [Buffer.from('%PDF-1.6\n%\xe2\xe3\n', 'latin1')];
  streams.forEach((s, i) => {
    const body = s.plain ? Buffer.from(s.content, 'latin1') : zlib.deflateSync(Buffer.from(s.content, 'latin1'));
    parts.push(Buffer.from(`${i + 1} 0 obj\r<</Length ${body.length}${s.plain ? '' : '/Filter/FlateDecode'}${s.dict || ''}>>stream\r\n`, 'latin1'), body, Buffer.from('\r\nendstream\rendobj\r', 'latin1'));
  });
  parts.push(Buffer.from('trailer\n%%EOF\n', 'latin1'));
  return Buffer.concat(parts);
}

// The rows as the exam calendar of the ETSIIIT: one TJ for each row, with kerning in the names and
// large moves between the columns. A row with special letters comes in parts.
const CALENDAR = [
  'BT /TT2 1 Tf 0 18 -18 0 28.98 148.01 Tm (999 Grado en Computer Science)Tj ET',
  'BT 0 13.98 -13.98 0 62.04 688.01 Tm (Curso 2026-2027)Tj ET',
  'q 0 85.98 -42 0 53.04 40.011 cm /Im1 Do Q',
  'BT /TT4 1 Tf [(999101)-1027.8(MA)77.5(T)5(E)1(M\\301T)5(I)-.2(CAS I)-13989.2(1)76(1/01/2027)-568.8(08:00)-18230(23/01/2027)-1126.2(08:00)]TJ ET',
  'BT [(999301)]TJ ET BT [(A)]TJ ET BT [(LGORITMI)]TJ ET BT [(A)]TJ ET',
  'BT [(18/12/2026)-568.8(16:00)-18230(18/01/2027)-1126.2(12:00)]TJ ET',
  'BT (999504 SISTEMAS \\(EST\\) \\\\ A)Tj ET',
  'BT [(07/01/2027)-568.8(16:00)-300(A12)-18230(22/01/2027)-1126.2(12:00)]TJ ET'
].join('\n');

test('pdftext: the lines of the text operators of the compressed content streams', async () => {
  const file = pdf([
    { content: '<</Type/Catalog>>', plain: true },
    { content: 'BT (in an image)Tj ET', dict: '/Subtype/Image/Width 4/Height 4' },
    { content: 'BT (not compressed)Tj ET', plain: true },
    { content: CALENDAR }
  ]);
  const lines = await MAK.pdfTextLines(file);
  assert.deepEqual(lines, [
    '999 Grado en Computer Science',
    'Curso 2026-2027',
    '999101 MATEMÁTICAS I 11/01/2027 08:00 23/01/2027 08:00',
    '999301', 'A', 'LGORITMI', 'A',
    '18/12/2026 16:00 18/01/2027 12:00',
    '999504 SISTEMAS (EST) \\ A',
    '07/01/2027 16:00 A12 22/01/2027 12:00'
  ]);
});

test('pdftext: not a PDF, a damaged stream or hex text: no error, no text', async () => {
  assert.deepEqual(await MAK.pdfTextLines(Buffer.from('<html>no</html>')), []);
  const broken = pdf([{ content: 'BT (x)Tj ET' }]);
  broken[broken.indexOf('stream\r\n') + 9] ^= 0xff; // the compressed data is not correct now
  assert.deepEqual(await MAK.pdfTextLines(broken), []);
  assert.deepEqual(await MAK.pdfTextLines(pdf([{ content: 'BT [<00410042>]TJ ET' }])), [], 'hex strings need the font: no text');
});

test('pdftext: an indirect length ("/Length 41 0 R") reads up to "endstream"; a "zip bomb" stream is skipped', async () => {
  const one = pdf([{ content: 'BT (indirect length)Tj ET' }]);
  const indirect = Buffer.from(one.toString('latin1').replace(/\/Length \d+/, '/Length 41 0 R'), 'latin1'); // not 4
  assert.deepEqual(await MAK.pdfTextLines(indirect), ['indirect length']);
  // 30 MB of text in a small stream: more than the limit of one stream, no line of it. The next stream is still read.
  const bomb = zlib.deflateSync(Buffer.from('BT (x)Tj ET\n'.repeat(2500000), 'latin1'));
  const file = pdf([{ content: 'BT (after)Tj ET' }]);
  const at = file.indexOf('1 0 obj');
  const head = Buffer.from(`9 0 obj\r<</Length ${bomb.length}/Filter/FlateDecode>>stream\r\n`, 'latin1');
  const t0 = Date.now();
  assert.deepEqual(await MAK.pdfTextLines(Buffer.concat([file.subarray(0, at), head, bomb, Buffer.from('\r\nendstream\rendobj\r', 'latin1'), file.subarray(at)])), ['after']);
  assert.ok(Date.now() - t0 < 3000);
});

test('exam rows: code, name, final and recovery; the parts of a row join; other lines go', async () => {
  const rows = MAK.parseExamRows(await MAK.pdfTextLines(pdf([{ content: CALENDAR }])));
  const at = (d, t) => { const [D, M, Y] = d.split('/').map(Number); const [h, m] = t.split(':').map(Number); return new Date(Y, M - 1, D, h, m).getTime(); };
  assert.deepEqual(rows, [
    { code: '999101', name: 'MATEMÁTICAS I', final: at('11/01/2027', '08:00'), finalRoom: '', recovery: at('23/01/2027', '08:00'), recoveryRoom: '' },
    { code: '999301', name: 'ALGORITMIA', final: at('18/12/2026', '16:00'), finalRoom: '', recovery: at('18/01/2027', '12:00'), recoveryRoom: '' },
    { code: '999504', name: 'SISTEMAS (EST) \\ A', final: at('07/01/2027', '16:00'), finalRoom: 'A12', recovery: at('22/01/2027', '12:00'), recoveryRoom: '' }
  ]);
});

test('exam rows: a calendar as a grid of days (code without dates) gives no rows', () => {
  const lines = ['HORA ASIGNATURA Hora ASIGNATURA', '351103 HISTORIA DEL DERECHO', '351505 DERECHO PROCESAL PENAL', 'Hora ASIGNATURA'];
  assert.deepEqual(MAK.parseExamRows(lines), []);
  assert.deepEqual(MAK.parseExamRows(null), []);
});

test('my exams: only the subjects of the guides, the next exam first', () => {
  const day = (d) => new Date(2026, 11, d, 9).getTime();
  const rows = [
    { code: '1', final: day(20), recovery: day(30) },
    { code: '2', final: day(10), recovery: day(25) }, // the final is past: the recovery counts
    { code: '3', final: day(15), recovery: null },
    { code: '4', final: day(12), recovery: null } // not a subject of the user
  ];
  const now = day(12);
  const mine = MAK.myExams(rows, [{ code: '1', siteId: 'a' }, { code: '2', siteId: 'b' }, { code: '3', siteId: 'c' }, { code: '', siteId: 'x' }], now);
  assert.deepEqual(mine.map((r) => [r.code, r.siteId]), [['3', 'c'], ['1', 'a'], ['2', 'b']]);
});

test('my exams: not the subjects of an old year, not the rows of an old calendar', () => {
  const sites = [{ id: 'new', title: '26_0_240702_1 PROCESADORES' }, { id: 'old', title: '25_0_240101_1 CÁLCULO' }, { id: 'x', title: 'Coordinación' }];
  const guides = [{ siteId: 'new' }, { siteId: 'old' }, { siteId: 'x' }];
  assert.deepEqual(MAK.lastYearGuides(guides, sites).map((g) => g.siteId), ['new', 'x']);
  assert.deepEqual(MAK.lastYearGuides([{ siteId: 'x' }], sites).map((g) => g.siteId), ['x'], 'no year: all');
  const at = (y, m, d) => new Date(y, m - 1, d, 9).getTime();
  const rows = [{ code: '1', final: at(2026, 6, 10), recovery: at(2026, 7, 1) }, { code: '2', final: at(2026, 12, 15), recovery: null }];
  const mine = MAK.myExams(rows, [{ code: '1', siteId: 'a' }, { code: '2', siteId: 'b' }], at(2026, 9, 20));
  assert.deepEqual(mine.map((r) => r.code), ['2'], 'June and July 2026 are of the last academic year in September');
  assert.deepEqual(MAK.myExams(rows, [{ code: '1', siteId: 'a' }], at(2026, 7, 2)).map((r) => r.code), ['1'], 'in July: this academic year');
});

test('my exams: the day after a final, its recovery is the next date (from the start of today)', () => {
  const at = (d, hour) => new Date(2027, 0, d, hour).getTime();
  const rows = [{ code: '1', final: at(11, 16), recovery: at(31, 9) }, { code: '2', final: at(20, 9), recovery: null }];
  const mine = MAK.myExams(rows, [{ code: '1', siteId: 'a' }, { code: '2', siteId: 'b' }], at(12, 10));
  assert.deepEqual(mine.map((r) => r.code), ['2', '1'], 'the final of yesterday at 16:00 is past');
});

test('the degree: the name of the guide line, the plan code of most guides', () => {
  assert.equal(MAK.degreeName('Graduado o Graduada en Ingeniería Informática por la Universidad Pública de Navarra'), 'Ingeniería Informática');
  assert.equal(MAK.degreeName('Graduada en Derecho por la Universidad Pública de Navarra'), 'Derecho');
  assert.equal(MAK.degreeName('Máster Universitario en X'), '');
  const g = (plan, degree) => ({ url: `https://www.unavarra.es/ficha-asignaturaDOA/?languageId=100000&codPlan=${plan}&codAsig=${plan}101&anio=2026`, degree });
  const guides = [g('240', ''), g('240', 'Graduado o Graduada en Ingeniería Informática por la Universidad Pública de Navarra'), g('250', 'Graduado o Graduada en Otra por la Universidad Pública de Navarra'), { url: 'bad' }];
  assert.equal(MAK.degreePlan(guides), '240');
  assert.equal(MAK.degreeOfGuides(guides, '240'), 'Ingeniería Informática');
  assert.equal(MAK.degreeOfGuides(guides, '999'), '');
  assert.equal(MAK.degreePlan([]), '');
});

test('the addresses: degree pages of www.unavarra.es, PDF files of www2.unavarra.es', () => {
  const B = 'https://www.unavarra.es/sites/grados/juridicas/derecho';
  assert.equal(MAK.degreeBase('/sites/grados/juridicas/derecho.html'), B);
  assert.equal(MAK.degreeBase('/sites/grados/juridicas/derecho/presentacion.html'), B);
  assert.equal(MAK.degreeBase('https://evil.example/sites/grados/juridicas/derecho.html'), null);
  assert.equal(MAK.degreeBase('/sites/grados/juridicas.html'), null, 'an area is not a degree');
  assert.equal(MAK.isDegreeBase(B), true);
  assert.equal(MAK.isDegreeBase(`${B}/evaluacion`), false);
  assert.equal(MAK.evaluationUrl(B), `${B}/evaluacion.html`);
  assert.equal(MAK.examPdfUrl('http://www2.unavarra.es/gesadj/x/240_otono.pdf'), 'https://www2.unavarra.es/gesadj/x/240_otono.pdf', 'https');
  assert.equal(MAK.examPdfUrl('https://www2.unavarra.es/gesadj/x/page.html'), null);
  assert.equal(MAK.examPdfUrl('https://evil.example/x.pdf'), null);
  assert.equal(MAK.examPdfUrl('https://user:pw@www2.unavarra.es/x.pdf'), null);
});

test('the semester of a date, and the stored form of the degree', () => {
  assert.equal(MAK.currentSeason(new Date(2026, 9, 19).getTime()), 'autumn');
  assert.equal(MAK.currentSeason(new Date(2027, 0, 20).getTime()), 'autumn', 'January: the recovery exams of autumn');
  assert.equal(MAK.currentSeason(new Date(2027, 0, 24, 23, 59).getTime()), 'autumn', 'to 24 January');
  assert.equal(MAK.currentSeason(new Date(2027, 0, 25, 0, 0).getTime()), 'spring', 'the classes of spring start on 25 January');
  assert.equal(MAK.currentSeason(new Date(2027, 2, 1).getTime()), 'spring');
  assert.equal(MAK.currentSeason(new Date(2027, 6, 31).getTime()), 'spring');
  assert.equal(MAK.currentSeason(new Date(2027, 7, 1).getTime()), 'autumn');
  const d = MAK.cleanDegree({
    base: 'https://www.unavarra.es/sites/grados/juridicas/derecho', name: 'Grado en Derecho', plan: '351', extra: 1,
    periods: [{ season: 'autumn', finals: 'x', recovery: 'y' }, { season: 'winter', finals: 'z' }],
    pdfs: [{ text: 'Exámenes', url: 'https://www2.unavarra.es/a.pdf', season: 'spring' }, { text: 'x', url: 'https://evil.example/a.pdf' }]
  });
  assert.deepEqual(d, {
    base: 'https://www.unavarra.es/sites/grados/juridicas/derecho', name: 'Grado en Derecho', plan: '351',
    periods: [{ season: 'autumn', finals: 'x', recovery: 'y' }], pdfs: [{ text: 'Exámenes', url: 'https://www2.unavarra.es/a.pdf', season: 'spring' }]
  });
  assert.equal(MAK.cleanDegree({ base: 'https://evil.example/x' }), null);
});

test('Wuolah: the community of the degree at the year of the user; two for a double degree', () => {
  const B = 'https://www.unavarra.es/sites/grados/';
  assert.deepEqual(MAK.wuolahLinks(`${B}informatica-y-telecomunicacion/ingenieria-informatica`, 4), [
    { url: 'https://wuolah.com/upna-escuela-tecnica-superior-ingenieria-industria/grado-ingenieria-informatica?course=4', name: 'Ingeniería Informática', year: 4 }
  ]);
  assert.deepEqual(MAK.wuolahLinks(`${B}economia-y-empresa/doble-ade-derecho`, 2).map((w) => w.url), [
    'https://wuolah.com/upna-facultad-ciencias-economicas-empresariales/grado-administracion-direccion-empresas?course=2',
    'https://wuolah.com/upna-facultad-ciencias-juridicas/grado-derecho?course=2'
  ]);
  assert.equal(MAK.wuolahLinks(`${B}informatica-y-telecomunicacion/internacional-informatica`, 1)[0].name, 'Ingeniería Informática', 'an international program: its degree');
  assert.equal(MAK.wuolahLinks(`${B}ciencias/biotecnologia`, null)[0].url, 'https://wuolah.com/upna-escuela-tecnica-superior-ingenieria-agronomic/grado-biotecnologia-2', 'no year: all the years');
  assert.deepEqual(MAK.wuolahLinks(`${B}salud/medicina`, 3), [{ url: 'https://wuolah.com/university/universidad-publica-de-navarra/grado-universitario-es', name: '', year: null }], 'no community: the degrees of the UPNA');
  assert.deepEqual(MAK.wuolahLinks('https://evil.example/x', 2).map((w) => w.name), ['']);
  for (const ids of Object.values(MAK.WUOLAH)) assert.ok(ids.length >= 1 && ids.length <= 2);
});

test('the year of the user: the year of most guides; else from the subject codes; else null', () => {
  const g = (code, course) => ({ url: `https://www.unavarra.es/ficha-asignaturaDOA/?languageId=100000&codPlan=240&codAsig=${code}&anio=2026`, code, course });
  assert.equal(MAK.studyYear([g('240504', ''), g('240701', '4'), g('240702', '4'), g('240301', '2')]), 4, 'the optional subject has no year');
  assert.equal(MAK.studyYear([g('240301', '2'), g('240702', '4')]), 4, 'the same count: the higher year');
  assert.equal(MAK.studyYear([g('240504', ''), g('240301', ''), g('240302', '')]), 2, 'no year in the guides: the semester in the code (2403xx: year 2)');
  assert.equal(MAK.studyYear([{ code: '12', course: '' }, null]), null);
  assert.equal(MAK.studyYear([]), null);
});

test('the year of the user: only the guides of the last academic year count', () => {
  const g = (code, course, anio) => ({ url: `https://www.unavarra.es/ficha-asignaturaDOA/?languageId=100000&codPlan=240&codAsig=${code}&anio=${anio}`, code, course });
  const old = ['240101', '240103', '240106', '240107'].map((c) => g(c, '1', 2023)); // the sites of the first year, still in the list
  assert.equal(MAK.studyYear([...old, g('240702', '4', 2026), g('240703', '4', 2026)]), 4);
  assert.equal(MAK.studyYear([...old.map((x) => Object.assign({}, x, { course: '' })), g('240702', '', 2026)]), 4, 'also with the codes');
});

test('exam rows: a date cut in two lines, and the end of the name on the line of the dates', () => {
  const at = (d, t) => { const [D, M, Y] = d.split('/').map(Number); const [h, m] = t.split(':').map(Number); return new Date(Y, M - 1, D, h, m).getTime(); };
  const rows = MAK.parseExamRows([
    '240206 MATEMÁTICAS II 28/05/', '2027 08:00 10/06/2027 08:00',
    '240506 SISTEMAS INTELIGENTES. APLIC', 'ACIONES 28/05/2027 16:00 15/06/2027 12:00',
    'DE 17/05/2027 08:00 07/06/2027 16:00' // a part without its code: not a row
  ]);
  assert.deepEqual(rows.map((r) => [r.code, r.name, r.final, r.recovery]), [
    ['240206', 'MATEMÁTICAS II', at('28/05/2027', '08:00'), at('10/06/2027', '08:00')],
    ['240506', 'SISTEMAS INTELIGENTES. APLICACIONES', at('28/05/2027', '16:00'), at('15/06/2027', '12:00')]
  ]);
});

test('exam rows: fewer than 80 % of the codes with a row: no rows (a grid gives wrong dates)', () => {
  const lines = ['351103 HISTORIA DEL DERECHO', '---', '351303 HECHO RELIGIOSO Y DERECHO', '---', '14/10/2026 10:00 20/10/2026 10:00', '351505 DERECHO PROCESAL PENAL', '351706 DERECHO PENAL ECONÓMICO', '351881 DERECHO DEL CONSUMO'];
  assert.deepEqual(MAK.parseExamRows(lines), []);
});

test('the degree of a plan code: every plan of the table, once', () => {
  assert.equal(MAK.degreeOfPlan('240'), 'https://www.unavarra.es/sites/grados/informatica-y-telecomunicacion/ingenieria-informatica');
  assert.equal(MAK.degreeOfPlan('247'), 'https://www.unavarra.es/sites/grados/informatica-y-telecomunicacion/doble-biomedica-telecomunicacion');
  assert.equal(MAK.degreeOfPlan('999'), null);
  assert.equal(MAK.degreeOfPlan('constructor'), null);
  for (const key of Object.values(MAK.PLAN_DEGREES)) assert.ok(MAK.isDegreeBase(`https://www.unavarra.es/sites/grados/${key}`), key);
  for (const key of Object.keys(MAK.WUOLAH)) assert.ok(Object.values(MAK.PLAN_DEGREES).includes(key), `the Wuolah degree ${key} has a plan`);
});

test('the semester of a subject: the period of its guide, else the digit of its code', () => {
  for (const [period, season] of [['1º S', 'autumn'], ['2º S', 'spring'], ['1er semestre', 'autumn'], ['Segundo semestre', 'spring'], ['Primer cuatrimestre', 'autumn'], ['2nd semester', 'spring'], ['Anual', null], ['', null]]) {
    assert.equal(MAK.periodSeason(period), season, period);
  }
  assert.equal(MAK.guideSeason({ period: '2º S', code: '240703' }), 'spring', 'the period first');
  assert.equal(MAK.guideSeason({ period: '', code: '240703' }), 'autumn', 'the 7th semester');
  assert.equal(MAK.guideSeason({ period: '', code: '240802' }), 'spring', 'the 8th semester');
  assert.equal(MAK.guideSeason({ period: 'Anual', code: '240703' }), null, 'the whole year');
  assert.equal(MAK.guideSeason({ code: 'X1' }), null);
});

test('shortPeriod: the periods of the evaluation page in short', () => {
  assert.equal(MAK.shortPeriod('del 15 al 22 de diciembre y del 7 al 11 de enero'), '15–22 dic y 7–11 ene');
  assert.equal(MAK.shortPeriod('del 17 de mayo al 28 de mayo'), '17–28 may');
  assert.equal(MAK.shortPeriod('del 28 de enero al 3 de febrero'), '28 ene–3 feb');
  assert.equal(MAK.shortPeriod('Del 15 al 23 de Enero'), '15–23 ene');
  assert.equal(MAK.shortPeriod('el 9 de julio'), '9 jul');
  assert.equal(MAK.shortPeriod('semana 20'), 'semana 20', 'another text stays');
  assert.equal(MAK.shortPeriod(''), '');
});

test('loadMyExams: the rows of the calendars of the degree (the background reads them), the subjects of the user; no access', async () => {
  const at = (y, m, d) => new Date(y, m, d, 9).getTime();
  const degree = { pdfs: [{ url: 'https://x/otono.pdf', season: 'autumn' }, { url: 'https://x/primavera.pdf', season: 'spring' }] };
  const guides = [{ siteId: 'a', guide: { code: '1', semester: '1' } }, { siteId: 'b', guide: { code: '2', semester: '2' } }];
  const asked = [];
  const send = async (m) => {
    asked.push(m.url);
    return { rows: m.url.includes('otono') ? [{ code: '1', name: 'A', final: at(2026, 11, 15), recovery: at(2027, 0, 15) }] : [{ code: '2', name: 'B', final: at(2027, 4, 20), recovery: null }] };
  };
  const ex = await MAK.loadMyExams({ degree, guides, now: at(2026, 9, 21), send, show: () => true });
  assert.deepEqual([ex.mine.map((r) => `${r.siteId}:${r.season}`), ex.read, ex.permission], [['a:autumn', 'b:spring'], 2, false]);
  const autumn = await MAK.loadMyExams({ degree, guides, now: at(2026, 9, 21), send, show: (s) => s === 'autumn' });
  assert.deepEqual(autumn.mine.map((r) => r.siteId), ['a'], 'only the semesters to show');
  const no = await MAK.loadMyExams({ degree, guides, now: at(2026, 9, 21), send: async () => ({ error: 'exams.permission' }), show: () => true });
  assert.deepEqual([no.mine, no.permission], [[], true]);
});

test('monthWeeks: the weeks of a month from Monday', () => {
  const M = loadLib('core', 'ui');
  assert.deepEqual(M.monthWeeks(2026, 11)[0], [null, 1, 2, 3, 4, 5, 6], 'December 2026 starts on a Tuesday');
  assert.deepEqual(M.monthWeeks(2027, 0)[0], [null, null, null, null, 1, 2, 3], 'January 2027 starts on a Friday');
  assert.deepEqual(M.monthWeeks(2027, 1).length, 4, 'February 2027: 28 days from a Monday');
  assert.deepEqual(M.monthWeeks(2027, 0).at(-1), [25, 26, 27, 28, 29, 30, 31]);
});
