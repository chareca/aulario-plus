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
  assert.equal(MAK.currentSeason(new Date(2027, 2, 1).getTime()), 'spring');
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
