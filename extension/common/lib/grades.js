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

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
