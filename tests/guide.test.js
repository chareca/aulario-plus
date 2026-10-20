'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib } = require('./helpers');
const MAK = loadLib('core', 'grades', 'guide');

const URL_OK = 'https://www.unavarra.es/ficha-asignaturaDOA/?languageId=100000&codPlan=240&codAsig=240504&anio=2026';

test('guideUrl: only the public guide of the UPNA, with the 4 parameters in digits', () => {
  assert.equal(MAK.guideUrl('https://www.unavarra.es/ficha-asignaturaDOA/?languageId=100000&amp;codPlan=240&amp;codAsig=240504&amp;anio=2026'), URL_OK);
  assert.equal(MAK.guideUrl('/ficha-asignaturaDOA?anio=2026&codAsig=240504&codPlan=240&languageId=100000&x=1'), URL_OK, 'relative, other order, other parameters removed');
  assert.equal(MAK.guideUrl('https://evil.example/ficha-asignaturaDOA/?languageId=1&codPlan=2&codAsig=3&anio=4'), null);
  assert.equal(MAK.guideUrl('https://www.unavarra.es/otra/?languageId=1&codPlan=2&codAsig=3&anio=4'), null);
  assert.equal(MAK.guideUrl('https://www.unavarra.es/ficha-asignaturaDOA/?languageId=1&codPlan=2&codAsig=x&anio=4'), null);
});

test('findGuideUrl: the iframe of the page of the tool', () => {
  assert.equal(MAK.findGuideUrl(`<div><iframe title="x" src="${URL_OK.replace(/&/g, '&amp;')}"></iframe></div>`), URL_OK);
  assert.equal(MAK.findGuideUrl('<iframe src="https://zoom.us/j/1"></iframe>'), null);
});

test('guideWeight and guideMinimum: numbers of the table', () => {
  assert.deepEqual(['10%', '35 %', '12,5%', '–', ''].map(MAK.guideWeight), [10, 35, 12.5, null, null]);
  assert.equal(MAK.guideMinimum('5 sobre 10'), 5);
  assert.equal(MAK.guideMinimum('4,5'), 4.5);
  assert.equal(MAK.guideMinimum('2 sobre 4'), 5);
  assert.equal(MAK.guideMinimum('50 %'), 5);
  assert.equal(MAK.guideMinimum('4 (40%)'), 4, 'the percent is not the first number');
  assert.equal(MAK.guideMinimum('Sí, 5 sobre 10 (50%)'), 5);
  assert.equal(MAK.guideMinimum('50% (5 sobre 10)'), 5, 'the percent first');
  assert.equal(MAK.guideMinimum('35% del examen (3,5 sobre 10)'), 3.5);
  assert.equal(MAK.guideMinimum('No'), null);
  assert.equal(MAK.guideMinimum(''), null);
});

test('guideTeacher: the same name with or without accents, case or user name', () => {
  const guide = { teachers: [{ name: 'GARCÍA LÓPEZ, ANA', resp: true, tutorias: 'https://www.unavarra.es/pdi?uid=1' }, { name: 'PÉREZ ARANA, JUAN', resp: false, tutorias: null }] };
  assert.equal(MAK.guideTeacher(guide, 'GARCIA LOPEZ, ANA (agarcia)').resp, true);
  assert.equal(MAK.guideTeacher(guide, 'Perez Arana , Juan (juan.perez)').name, 'PÉREZ ARANA, JUAN');
  assert.equal(MAK.guideTeacher(guide, 'OTRA, PERSONA (x)'), null);
  assert.equal(MAK.guideTeacher(null, 'GARCIA LOPEZ, ANA (agarcia)'), null);
});

test('activityMatches: the same words, a number, or the first word of an activity without a number', () => {
  const yes = [['Entrega 1', 'Entrega 1 - Análisis'], ['Entrega 1', 'entrega1'], ['Prácticas', 'Práctica 2'], ['Examen teórico-práctico', 'Examen teórico-práctico (enero)'], ['Examen', 'Examen final']];
  const no = [['Entrega 1', 'Entrega 2'], ['Entrega 1', 'Entrega 10'], ['Prácticas', 'Examen'], ['Lab', 'Laboratorio 1']];
  for (const [a, b] of yes.concat([['Informes', 'Informe 1'], ['Clases', 'Clase 2'], ['Exámenes', 'Examen 1'], ['Controles', 'Control 2'], ['Fase de diseño', 'Fase 1']])) assert.ok(MAK.activityMatches(a, b), `${a} ~ ${b}`);
  for (const [a, b] of no) assert.ok(!MAK.activityMatches(a, b), `${a} !~ ${b}`);
});

// A gradebook without weights (points), with items of the activities of the guide.
const book = () => MAK.buildGradebook({ rows: [
  { type: 'item', name: 'Práctica 1', rawText: '8', outOfText: '/10', counted: true },
  { type: 'item', name: 'Práctica 2', rawText: '6', outOfText: '/10', counted: true },
  { type: 'item', name: 'Examen teórico-práctico', rawText: '4', outOfText: '/10', counted: true },
  { type: 'item', name: 'Participación', rawText: '10', outOfText: '/10', counted: true }
], courseGradeText: '' });
const guide = { evaluation: { rows: [
  { activity: 'Examen teórico-práctico', weight: 60, minimum: '5 sobre 10' },
  { activity: 'Prácticas', weight: 30, minimum: 'No' },
  { activity: 'Lab report 1', weight: 10, minimum: '' },
  { activity: 'Asistencia', weight: null, minimum: '' }
] } };

test('guideBook: the activities with a weight are the categories; the matched grades go in them', () => {
  const g = MAK.guideBook(guide, book());
  assert.equal(g.fromGuide, true);
  assert.equal(g.total, 100);
  assert.deepEqual(g.categories.map((c) => [c.name, c.weight, c.items.map((i) => i.name), c.matched]), [
    ['Examen teórico-práctico', 60, ['Examen teórico-práctico'], true],
    ['Prácticas', 30, ['Práctica 1', 'Práctica 2'], true],
    ['Lab report 1', 10, ['Lab report 1'], false]
  ]);
  assert.equal(g.categories[2].items[0].placeholder, true, 'not graded yet: an empty item for the simulator');
  assert.deepEqual(g.unused.map((i) => [i.name, i.reason]), [['Participación', 'notInGuide']]);
  // The model: 60 % * 0.4 + 30 % * 0.7 = 0.45 of the final grade, and 10 % is not graded yet.
  const model = MAK.gradeModel(g);
  assert.ok(Math.abs(model.a - 0.45) < 1e-9, String(model.a));
  assert.ok(Math.abs(model.b - 0.1) < 1e-9, String(model.b));
  assert.ok(Math.abs(model.current - 0.5) < 1e-9, 'the grade of the graded part: 0.45 / 0.9');
  assert.equal(MAK.guideBook({ evaluation: { rows: [{ activity: 'A', weight: null }] } }, book()), null, 'no weights: no guide book');
});

test('cleanGuide: only the known fields, with limits; bad links and weights go', () => {
  const g = MAK.cleanGuide({
    url: URL_OK, code: '240504', name: 'X'.repeat(500), extra: 'no',
    teachers: [{ name: 'A, B', resp: 1, tutorias: 'https://evil.example/x' }, { name: '', resp: true }, { name: 'C, D', tutorias: 'https://www.unavarra.es/pdi?uid=2' }],
    evaluation: { rows: [{ activity: 'Examen', weight: 150 }, { activity: 'Prácticas', weight: 40, minimum: 5 }, { weight: 10 }], notes: ['n1', 7] }
  });
  assert.equal(g.name.length, 200);
  assert.equal('extra' in g, false);
  assert.deepEqual(g.teachers, [{ name: 'A, B', resp: true, tutorias: null }, { name: 'C, D', resp: false, tutorias: 'https://www.unavarra.es/pdi?uid=2' }]);
  assert.deepEqual(g.evaluation.rows.map((r) => [r.activity, r.weight, r.minimum]), [['Examen', null, ''], ['Prácticas', 40, '']]);
  assert.deepEqual(g.evaluation.notes, ['n1']);
  assert.equal(MAK.cleanGuide('x'), null);
});

test('the link "Subir" (back to the top) is not a note, also in a guide that is stored already', () => {
  const g = MAK.cleanGuide({ url: URL_OK, evaluation: { rows: [], notes: ['Regla 1.', 'Subir', ' subir ', 'Volver arriba'] } });
  assert.deepEqual(g.evaluation.notes, ['Regla 1.']);
  const stored = { evaluation: { rows: [], notes: ['Regla 1.', 'Subir', 'Regla 2: subir la nota con la recuperación.'] } };
  assert.deepEqual(MAK.guideNotes(stored), ['Regla 1.', 'Regla 2: subir la nota con la recuperación.'], 'only a line that is only the link');
  assert.deepEqual(MAK.guideNotes(null), []);
});

test('loadGuide: the stored guide while it is recent; else read again and store', async () => {
  const tool = { placement: 'P 1' };
  const calls = [];
  const io = {
    fetchMia: async (p) => (calls.push(p), `<iframe src="${URL_OK}"></iframe>`),
    fetchGuide: async (u) => (calls.push(u), '<html></html>'),
    parse: () => ({ querySelector: () => null, querySelectorAll: () => [] }),
    save: async (g) => calls.push(['save', g])
  };
  const stored = { at: 1000, guide: { name: 'old' } };
  assert.deepEqual(await MAK.loadGuide(Object.assign({ tool, stored, now: 1000 + 60000 }, io)), { name: 'old' });
  assert.equal(calls.length, 0);
  assert.equal(await MAK.loadGuide(Object.assign({ tool, stored, now: 1000 + MAK.GUIDE_MS + 1 }, io)), null, 'not a guide page: null');
  assert.deepEqual(calls, ['/portal/tool/P%201', URL_OK, ['save', null]]);
  assert.equal(await MAK.loadGuide(Object.assign({ tool: null, stored: null, now: 0 }, io)), null, 'no page of the guide');
});

test('activityKind: the kind of an activity from its name (the activities of real guides)', () => {
  const cases = {
    exam: ['Examen teórico-práctico', 'Prueba de respuesta larga', 'Prueba escrita que recoja los conceptos adquiridos (examen parcial)', 'Prueba escrita que recoja los conceptos adquiridos', 'Test final'],
    participation: ['Asistencia a sesiones de laboratorio y participación activa en la asignatura. Intervención y aportaciones.', 'Registro del profesor sobre la evolución de las prácticas'],
    practice: ['Entrega de prácticas en tiempo y forma', 'Pruebas e informes de trabajo experimental', 'Prácticas'],
    work: ['Entrega 1', 'Entrega 5', 'Entrega y exposición del proyecto final', 'Elaboración de trabajos y proyectos', 'Trabajo en grupo en el que se aplican los conocimientos adquiridos para construir un compilador', 'Trabajos e informes', 'Lab report 1'.replace('Lab', 'Informe')],
    presentation: ['Presentación oral', 'Defensa pública'],
    other: ['Otros méritos', '']
  };
  for (const [kind, names] of Object.entries(cases)) for (const n of names) assert.equal(MAK.activityKind(n), kind, n);
});

test('weightsByKind: the weights of the same kind together, in the order of the guide', () => {
  const rows = [
    { activity: 'Entrega 1', weight: 10 }, { activity: 'Examen final', weight: 60 }, { activity: 'Entrega 2', weight: 20 },
    { activity: 'Asistencia', weight: 10 }, { activity: 'Sin peso', weight: null }
  ];
  assert.deepEqual(MAK.weightsByKind(rows).map((p) => [p.kind, p.weight, p.names.length]), [['work', 30, 2], ['exam', 60, 1], ['participation', 10, 1]]);
});

// ---- The calculator of a guide ----------------------------------------------------

// The guide of SSI: two activities with a minimum.
const SSI_ROWS = [
  { activity: 'Examen de teoría', weight: 40, minimum: '5 sobre 10' },
  { activity: 'Prácticas', weight: 40, minimum: '4 sobre 10' },
  { activity: 'Trabajo', weight: 20, minimum: 'No' },
  { activity: 'Asistencia', weight: null, minimum: '' }
];
const r2 = (n) => Math.round(n * 100) / 100;

test('parseGrade: 0 to 10, with a comma or a point', () => {
  assert.equal(MAK.parseGrade('6,5'), 6.5);
  assert.equal(MAK.parseGrade(' 10 '), 10);
  assert.equal(MAK.parseGrade('0'), 0);
  for (const bad of ['', '11', '-1', 'abc', '6,5,1', '1e1', null]) assert.equal(MAK.parseGrade(bad), null, String(bad));
});

test('guideCalc: the grade that you need in the rest, with the minimums, and the final grade', () => {
  let c = MAK.guideCalc(SSI_ROWS, {});
  assert.equal(c.rows.length, 4, 'all the activities (one without a weight)');
  assert.equal(c.total, 100);
  assert.equal(c.need, 5, 'nothing yet: 5 in all');
  assert.deepEqual(c.rows.map((r) => r.minimum), [5, 4, null, null]);

  c = MAK.guideCalc(SSI_ROWS, { 'Examen de teoría': 6 });
  // 6 * 0.4 = 2.4; the rest (60 %) needs 2.6 / 0.6 = 4.333, up: 4.34 (4.33 gives 4.998); Prácticas has the minimum 4 (below).
  assert.equal(c.need, 4.34);
  assert.deepEqual(c.rows.map((r) => r.plan === undefined ? null : r2(r.plan)), [null, 4.34, 4.34, null]);
  assert.equal(r2(c.projected), 5);
  assert.equal(c.complete, false);

  c = MAK.guideCalc(SSI_ROWS, { 'Examen de teoría': 7, Trabajo: 9 });
  // 2.8 + 1.8 = 4.6; Prácticas needs 1 (0.4 / 0.4), but its minimum is 4: the plan is 4.
  assert.equal(r2(c.rows[1].plan), 4, 'the minimum is larger than the 1 that is missing');
  assert.equal(c.need, 0, 'no other activity: the minimum gives more than 5');
  assert.equal(r2(c.projected), 6.2);

  c = MAK.guideCalc(SSI_ROWS, { 'Examen de teoría': 1, Prácticas: 1 });
  assert.equal(c.reachable, false, '0.8 + 0.2 * 10 = 2.8 < 5');
  assert.equal(r2(c.projected), 2.8);
  assert.deepEqual(c.rows.map((r) => r.below), [true, true, false, false]);

  c = MAK.guideCalc(SSI_ROWS, { 'Examen de teoría': 6, Prácticas: 7, Trabajo: 3 });
  assert.equal(c.complete, true);
  assert.equal(r2(c.final), 5.8);
  assert.equal(c.passed, true);
  c = MAK.guideCalc(SSI_ROWS, { 'Examen de teoría': 4, Prácticas: 9, Trabajo: 9 });
  assert.equal(r2(c.final), 7);
  assert.equal(c.passed, false, 'the exam is below its minimum');
  assert.equal(MAK.guideCalc([{ activity: 'A', weight: 30 }, { activity: 'B', weight: 30 }], { A: 10 }).need, 0, 'the weights make 60 %: 10 in A gives 5');
  assert.equal(MAK.guideCalc([], {}).total, 0);
  const three = [{ activity: 'A', weight: 10 }, { activity: 'B', weight: 70 }, { activity: 'C', weight: 20 }];
  assert.equal(MAK.guideCalc(three, { A: 1, B: 7 }).need, 0, '0.1 + 4.9 is 5: not 4e-15 (the error of the floats)');
  assert.equal(MAK.guideCalc([{ activity: 'E', weight: 40 }, { activity: 'P', weight: 30 }, { activity: 'Q', weight: 30 }], { E: 6, P: 4.33, Q: 4.33 }).final, 4.99, '4.998 is not a 5');
});

test('guideCalc with the weights of the user; parseWeight', () => {
  assert.equal(MAK.parseWeight('35,5'), 35.5);
  assert.equal(MAK.parseWeight('40 %'), 40);
  for (const bad of ['101', '-5', 'x', '']) assert.equal(MAK.parseWeight(bad), null, bad);
  // The exam 50 %, the practices 50 %, the work 0 % (it does not count), the attendance 0 %.
  const c = MAK.guideCalc(SSI_ROWS, { 'Examen de teoría': 6, Prácticas: 8, Trabajo: 1 }, { 'Examen de teoría': 50, Prácticas: 50, Trabajo: 0 });
  assert.deepEqual(c.rows.map((r) => [r.weight, r.guideWeight]), [[50, 40], [50, 40], [0, 20], [0, 0]]);
  assert.equal(c.total, 100);
  assert.equal(c.complete, true, 'the work has no weight: not necessary');
  assert.equal(r2(c.final), 7);
  assert.equal(MAK.guideCalc(SSI_ROWS, {}, { Asistencia: 10 }).total, 110, 'a weight for an activity without a weight in the guide');
});

test('guideBookGrades: the grades of the gradebook for the activities of the guide, over 10', () => {
  const book = { weighted: false, unused: [], courseGradeText: '', categories: [{ name: '', weight: null, items: [
    { key: 'a', name: 'Examen de teoría', score: 7, max: 10 },
    { key: 'b', name: 'Práctica 1', score: 18, max: 20 },
    { key: 'c', name: 'Práctica 2', score: 6, max: 10 },
    { key: 'd', name: 'Trabajo', score: null, max: 10 }
  ] }] };
  assert.deepEqual(MAK.guideBookGrades(SSI_ROWS, book), { 'Examen de teoría': 7, Prácticas: 8 }, '(18 + 6) / (20 + 10); no grade for the work yet');
  assert.deepEqual(MAK.guideBookGrades(SSI_ROWS, null), {});
  // The same first word: each exam keeps its own item ("Examen parcial" does not take "Examen final").
  const exams = [{ activity: 'Examen parcial', weight: 30 }, { activity: 'Examen final', weight: 50 }, { activity: 'Informes', weight: 20 }];
  const two = { unused: [], categories: [{ items: [{ key: 'p', name: 'Examen parcial', score: 9, max: 10 }, { key: 'f', name: 'Examen final', score: 3, max: 10 }] }] };
  assert.deepEqual(MAK.guideBookGrades(exams, two), { 'Examen parcial': 9, 'Examen final': 3 });
  // A word of an activity inside the item of another one: the first word decides ("Memoria prácticas" is of "Memoria de prácticas").
  const memo = [{ activity: 'Memoria de prácticas', weight: 40 }, { activity: 'Prácticas', weight: 20 }];
  const items = { unused: [], categories: [{ items: [{ key: 'm', name: 'Memoria prácticas', score: 8, max: 10 }, { key: 'p', name: 'Práctica 1', score: 6, max: 10 }] }] };
  assert.deepEqual(MAK.guideBookGrades(memo, items), { 'Memoria de prácticas': 8, Prácticas: 6 });
});
