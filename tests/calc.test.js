'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, loadBackground } = require('./helpers');
const MAK = loadLib('core', 'store', 'grades');

const cat = (name, weightText, gradeText = '-') => ({ type: 'category', name, weightText, gradeText });
const it = (name, rawText, outOfText = '/10', counted = true) => ({ type: 'item', name, rawText, outOfText, counted });
const book = (rows, courseGradeText = '-') => MAK.buildGradebook({ rows, courseGradeText });
const near = (actual, expected, msg) => assert.ok(Math.abs(actual - expected) < 1e-9, `${msg || ''} ${actual} != ${expected}`);

test('points: current grade, the linear model and the needed average', () => {
  const b = book([it('A', '7'), it('B', '8,0'), it('C', '-', '/20')]);
  assert.equal(b.weighted, false);
  const m = MAK.gradeModel(b);
  near(m.current, 0.75);
  near(m.a, 15 / 40);
  near(m.b, 0.5);
  const n = MAK.neededAverage(m, 5);
  assert.equal(n.state, 'needed');
  assert.equal(n.value, 2.5);
  near(n.min, 3.75);
  near(n.max, 8.75);
});

test('weighted: the weights of the categories; the weights do not have to make 100', () => {
  const rows = (w1, w2) => [cat('Theory', w1), it('Exam 1', '6'), it('Final', '-'), cat('Labs', w2), it('Lab 1', '9'), it('Lab 2', '–')];
  for (const [w1, w2] of [['60%', '40%'], ['30 %', '20%']]) {
    const b = book(rows(w1, w2));
    assert.equal(b.weighted, true);
    const m = MAK.gradeModel(b);
    near(m.current, 0.72, `${w1}/${w2} current`);
    near(m.a, 0.36);
    near(m.b, 0.5);
    assert.equal(MAK.neededAverage(m, 5).value, 2.8);
  }
});

test('weighted: an empty category and a category without weight do not count', () => {
  const b = book([cat('Theory', '50%'), it('Exam', '8'), cat('Project', '30%'), cat('Extra', '0%'), it('Quiz', '2'), it('Not counted', '1', '/10', false)]);
  assert.deepEqual(b.categories.map((c) => c.name), ['Theory']);
  assert.deepEqual(b.unused.map((i) => [i.name, i.reason]).sort(), [['Not counted', 'notCounted'], ['Quiz', 'noWeight']]);
  const m = MAK.gradeModel(b);
  near(m.current, 0.8);
  assert.equal(MAK.neededAverage(m, 5).state, 'nothingLeft');
  near(MAK.neededAverage(m, 5).min, 8);
});

test('items without a number: no maximum, a letter grade; a percent without maximum counts of 100', () => {
  const b = book([it('No max', '5', ''), it('Letter', 'A'), it('Percent', '85%', ''), it('Zero max', '0', '/0')]);
  assert.deepEqual(b.unused.map((i) => [i.name, i.reason]), [['No max', 'noNumber'], ['Letter', 'noNumber'], ['Zero max', 'noNumber']]);
  assert.deepEqual(b.categories[0].items.map((i) => [i.score, i.max]), [[85, 100]]);
  near(MAK.gradeModel(b).current, 0.85);
});

test('nothing graded, target reached, target not possible, and no items', () => {
  let m = MAK.gradeModel(book([it('A', '-'), it('B', '-')]));
  assert.equal(m.current, null);
  assert.equal(MAK.neededAverage(m, 5).value, 5);
  m = MAK.gradeModel(book([it('A', '10'), it('B', '-')]));
  assert.equal(MAK.neededAverage(m, 5).state, 'reached');
  m = MAK.gradeModel(book([it('A', '1'), it('B', '-')]));
  const n = MAK.neededAverage(m, 6);
  assert.equal(n.state, 'impossible');
  near(n.max, 5.5);
  m = MAK.gradeModel(book([]));
  assert.equal(m.current, null);
  assert.equal(MAK.neededAverage(m, 5).state, 'nothingLeft');
});

test('the needed average goes up to 2 decimals, never down', () => {
  assert.equal(MAK.neededAverage({ a: 0, b: 0.8 }, 5).value, 6.25);
  assert.equal(MAK.neededAverage({ a: 0, b: 0.3 }, 2).value, 6.67);
  assert.equal(MAK.neededAverage({ a: 0.1, b: 0.3 }, 4).value, 10);
});

test('simulator: values only for items without a grade, from 0 to the maximum, with the same functions', () => {
  const b = book([it('A', '6'), it('B', '-'), it('C', '-', '/5'), it('D', '-')]);
  const keys = b.categories[0].items.map((i) => i.key);
  const sim = MAK.applyWhatIf(b, { [keys[0]]: '1', [keys[1]]: '15', [keys[2]]: '-3', [keys[3]]: 'abc' });
  assert.deepEqual(sim.categories[0].items.map((i) => i.score), [6, 10, 0, null], 'graded item stays, clamp to 10, clamp to 0, invalid text');
  assert.equal(b.categories[0].items[1].score, null, 'the real book does not change');
  const m = MAK.gradeModel(sim);
  near(m.current, 16 / 25);
  near(m.b, 10 / 35);
});

test('mismatch: a category or the course grade differs by more than 1 point', () => {
  const rows = (g) => [cat('Theory', '100%', g), it('Exam', '6')];
  const check = (b) => MAK.gradebookMismatch(b, MAK.gradeModel(b));
  assert.equal(check(book(rows('62%'))), false);
  assert.equal(check(book(rows('90%'))), true);
  assert.equal(check(book(rows('-'), '6,5')), false);
  assert.equal(check(book(rows('-'), '9')), true);
  assert.equal(check(book(rows('-'), 'Notable')), false, 'not a number: no check');
  assert.equal(check(book(rows('-'), '75%')), true);
});

test('targets: numbers from 0 to 10 only, and at most 200 sites', () => {
  const t = MAK.withDefaults({ targets: { a: 7, b: 11, c: -1, d: '5', e: NaN, f: 0 } }).targets;
  assert.deepEqual({ ...t }, { a: 7, f: 0 });
  const many = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`s${i}`, 5]));
  assert.equal(Object.keys(MAK.withDefaults({ targets: many }).targets).length, 200);
  assert.deepEqual({ ...MAK.withDefaults({ targets: [5] }).targets }, {});
});

test('background: setSettings merges the targets; null removes one', async () => {
  const bg = loadBackground();
  await bg.send({ type: 'setSettings', patch: { targets: { a: 7 } } });
  let s = await bg.send({ type: 'setSettings', patch: { targets: { b: 6.5 } } });
  assert.deepEqual(s.targets, { a: 7, b: 6.5 });
  s = await bg.send({ type: 'setSettings', patch: { targets: { a: null } } });
  assert.deepEqual(s.targets, { b: 6.5 });
  assert.equal(s.badge.grades, true, 'the other settings stay');
});
