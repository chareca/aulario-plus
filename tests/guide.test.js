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
  for (const [a, b] of yes) assert.ok(MAK.activityMatches(a, b), `${a} ~ ${b}`);
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
