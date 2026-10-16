// MiAulario Keep-Alive: grades. New grades (from /api/users/me/grades) and the grade calculator
// (from the Gradebook page of a site).
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  // "8,5", "8.5", "85%", " 10 " -> number. "-", "", letters -> null.
  MAK.parseNumber = function (text) {
    const s = String(text === null || text === undefined ? '' : text).replace(/\s+/g, '');
    const m = /^(-?\d+(?:[.,]\d+)?)%?$/.exec(s);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
  };

  // ---- New grades ------------------------------------------------------------

  // Keep "gradedAt" for each item: the time when the extension saw its grade for the first time
  // (or saw a different grade). 0 for the grades of the first fetch (baseline). null if no grade.
  // Return the new list and the items that got a new grade now.
  MAK.mergeGrades = function (prev, list, now, baseline) {
    const old = new Map((prev || []).map((g) => [g.id, g]));
    const same = (a, b) => {
      const x = MAK.parseNumber(a);
      const y = MAK.parseNumber(b);
      return x !== null && y !== null ? x === y : a === b;
    };
    const changed = [];
    const out = list.map((g) => {
      const p = old.get(g.id);
      let gradedAt;
      if (!g.graded) gradedAt = null;
      else if (baseline) gradedAt = 0;
      else if (!p || !p.graded || !same(p.score, g.score)) gradedAt = now;
      else gradedAt = typeof p.gradedAt === 'number' ? p.gradedAt : 0;
      const item = Object.assign({}, g, { gradedAt });
      if (gradedAt === now && !baseline) changed.push(item);
      return item;
    });
    return { list: out, changed };
  };

  // The grades that the user did not see: a grade that came after the last visit of the Grades tab.
  MAK.unseenGrades = function (grades, seenAt, hidden) {
    const hide = hidden || new Set();
    return (grades || []).filter((g) => g.gradedAt && g.gradedAt > (seenAt || 0) && !hide.has(g.siteId));
  };

  // ---- Calculator ----------------------------------------------------------------
  // All grades of the calculator are fractions (0..1). The popup shows them on a scale of 10.

  MAK.DEFAULT_TARGET = 5;
  const clean = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const isPercent = (text) => /%\s*$/.test(String(text || ''));
  const sum = (list, f) => list.reduce((n, x) => n + f(x), 0);

  // Read the summary table of the Gradebook page of a student (Sakai GradebookNG). This is the only
  // part that uses the DOM. It reads textContent only and returns flat rows.
  MAK.extractGradebookRows = function (doc) {
    const rows = [];
    for (const tr of doc.querySelectorAll('tr.gb-summary-category-row, tr.gb-summary-grade-row')) {
      const q = (sel) => clean(tr.querySelector(sel));
      if (tr.classList.contains('gb-summary-category-row')) {
        rows.push({ type: 'category', name: q('.gb-summary-category-name'), weightText: q('.gb-summary-category-weight'), gradeText: q('.gb-summary-category-grade') });
      } else {
        rows.push({ type: 'item', name: q('.gb-summary-grade-title'), rawText: q('.gb-summary-grade-score-raw'), outOfText: q('.gb-summary-grade-score-outof'), counted: !tr.querySelector('.gb-flag-not-counted') });
      }
    }
    const course = doc.querySelector('.gb-summary-course-grade-value');
    return { rows, courseGradeText: clean(course), found: rows.length > 0 || !!course };
  };

  // Rows -> categories with items. Each item has a key for the simulator.
  // Weighted mode if a category has a weight more than 0. Then a category without weight does not count.
  // The items that do not count, or that have no number, go to "unused".
  MAK.buildGradebook = function (data) {
    const all = [];
    const unused = [];
    let cur = null;
    let n = 0;
    for (const r of (data && data.rows) || []) {
      if (r.type === 'category') {
        cur = { name: r.name || '', weight: MAK.parseNumber(r.weightText), gradeText: r.gradeText || '', items: [] };
        all.push(cur);
        continue;
      }
      const raw = String(r.rawText || '').trim();
      const blank = raw === '' || /^[-–—]$/.test(raw);
      let max = MAK.parseNumber(String(r.outOfText || '').replace(/^\s*\//, ''));
      let score = blank ? null : MAK.parseNumber(raw);
      if (score !== null && isPercent(raw)) {
        max = max > 0 ? max : 100;
        score = (score / 100) * max;
      }
      const item = { key: `i${n++}`, name: r.name || '', score, max };
      if (r.counted === false) unused.push(Object.assign(item, { reason: 'notCounted' }));
      else if (!(max > 0) || (!blank && score === null)) unused.push(Object.assign(item, { reason: 'noNumber' }));
      else {
        if (!cur) all.push((cur = { name: '', weight: null, gradeText: '', items: [] }));
        cur.items.push(item);
      }
    }
    const weighted = all.some((c) => c.weight > 0);
    const categories = [];
    for (const c of all) {
      if (weighted && !(c.weight > 0)) for (const i of c.items) unused.push(Object.assign(i, { reason: 'noWeight' }));
      else if (c.items.length) categories.push(c);
    }
    return { weighted, categories, unused, courseGradeText: (data && data.courseGradeText) || '' };
  };

  // The simulator: grades that the user writes for the items without a grade (from 0 to the maximum).
  MAK.applyWhatIf = function (book, values) {
    const v = values || {};
    const categories = book.categories.map((c) =>
      Object.assign({}, c, {
        items: c.items.map((i) => {
          const x = i.score === null && Object.prototype.hasOwnProperty.call(v, i.key) ? MAK.parseNumber(v[i.key]) : null;
          return x === null ? i : Object.assign({}, i, { score: Math.min(i.max, Math.max(0, x)), whatIf: true });
        })
      })
    );
    return Object.assign({}, book, { categories });
  };

  // The final grade is linear: final = a + b * x, where x is the fraction that the student gets in
  // all the items without a grade. b is also the part of the final grade that is not graded yet.
  // "current" is the grade of the graded items only (null if nothing is graded).
  // Weighted: W is the sum of the weights of the categories with items, so the weights do not
  // have to make 100.
  MAK.gradeModel = function (book) {
    const parts = book.categories.map((c) => {
      const max = sum(c.items, (i) => i.max);
      const gradedMax = sum(c.items, (i) => (i.score === null ? 0 : i.max));
      return { c, max, gradedMax, got: sum(c.items, (i) => i.score || 0) };
    });
    const out = { a: 0, b: 0, current: null };
    if (book.weighted) {
      const W = sum(parts, (p) => p.c.weight);
      const graded = parts.filter((p) => p.gradedMax > 0);
      const Wg = sum(graded, (p) => p.c.weight);
      if (W > 0) {
        out.a = sum(parts, (p) => (p.c.weight / W) * (p.got / p.max));
        out.b = sum(parts, (p) => (p.c.weight / W) * ((p.max - p.gradedMax) / p.max));
      }
      if (Wg > 0) out.current = sum(graded, (p) => p.c.weight * (p.got / p.gradedMax)) / Wg;
    } else {
      const M = sum(parts, (p) => p.max);
      const G = sum(parts, (p) => p.gradedMax);
      const got = sum(parts, (p) => p.got);
      if (M > 0) {
        out.a = got / M;
        out.b = (M - G) / M;
      }
      if (G > 0) out.current = got / G;
    }
    out.categories = parts.map((p) => ({ name: p.c.name, weight: p.c.weight, gradeText: p.c.gradeText, own: p.gradedMax > 0 ? p.got / p.gradedMax : null }));
    return out;
  };

  // The average (0..10) that the student needs in the items without a grade to get the target (0..10).
  // The value goes up to 2 decimals, never down.
  MAK.neededAverage = function (model, target) {
    const min = model.a * 10;
    const max = (model.a + model.b) * 10;
    if (!(model.b > 1e-9)) return { state: 'nothingLeft', min, max };
    const x = (target / 10 - model.a) / model.b;
    if (x <= 0) return { state: 'reached', min, max };
    if (x > 1 + 1e-9) return { state: 'impossible', min, max };
    return { state: 'needed', value: Math.min(10, Math.ceil(x * 1000 - 1e-6) / 100), min, max };
  };

  // Compare with the grades that MiAulario shows. A difference of more than 1 point (of 10) tells
  // that the site uses rules that the page does not show (for example, drop the lowest grade).
  MAK.gradebookMismatch = function (book, model) {
    const official = (text, scaleOf10) => {
      const n = MAK.parseNumber(text);
      if (n === null) return null;
      if (isPercent(text)) return n / 100;
      return scaleOf10 && n <= 10 ? n / 10 : null;
    };
    for (const c of model.categories) {
      const o = official(c.gradeText, false);
      if (o !== null && c.own !== null && Math.abs(o - c.own) > 0.1) return true;
    }
    const course = official(book.courseGradeText, true);
    return course !== null && model.current !== null && Math.abs(course - model.current) > 0.1;
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
