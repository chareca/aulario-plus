// Aulario Plus: the official grades of the user, from the Expediente of SIGMA (academicos.unavarra.es).
// The user turns it on in the settings (an optional permission for MiUPNA and SIGMA). Then the extension
// reads the table "Expediente completo" when the user opens it, and every few days in a tab in the
// background: MiUPNA (portal.unavarra.es; the login of the UPNA with its session, no password) → the link
// of "Consulta tu Expediente" (with a pass of the portal that the extension never keeps) → SIGMA →
// "Expediente completo". The grades stay in the browser.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  MAK.PORTAL_ORIGIN = 'https://portal.unavarra.es';
  MAK.SIGMA_ORIGIN = 'https://academicos.unavarra.es';
  MAK.RECORD_PERMISSION = { origins: [`${MAK.PORTAL_ORIGIN}/*`, `${MAK.SIGMA_ORIGIN}/*`] };
  // The page of MiUPNA with the link to the Expediente (the start of the reading in the background).
  MAK.RECORD_START = `${MAK.PORTAL_ORIGIN}/group/estudiantes/servicios-sigma`;

  const words = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const num = (s) => {
    const n = Number(words(s).replace(',', '.'));
    return words(s) && Number.isFinite(n) ? n : null;
  };
  const sigmaUrl = (u, base) => {
    try {
      const url = new URL(u, base);
      return url.origin === MAK.SIGMA_ORIGIN ? url.href : null;
    } catch {
      return null;
    }
  };

  // The columns of "Expediente completo", by the text of their head (SIGMA in Spanish).
  const COLS = { year: 'año académ.', code: 'código', name: 'descripción', credits: 'cr.', group: 'gr.', call: 'convocatoria', callText: 'descripción convocatoria',
    grade: 'calificación', mark: 'c.n.', kind: 'tipo asig.', course: 'cur.', term: 'sem.', notes: 'observaciones' };
  const heads = (table) => [...((table && table.rows[0] && table.rows[0].cells) || [])].map((c) => words(c.textContent).toLowerCase());

  // The table "Expediente completo" (table#table1) and the credits of each kind of subject: { rows, credits }, or null.
  MAK.parseRecord = function (doc) {
    const table = doc.querySelector('table#table1');
    const head = heads(table);
    const at = Object.fromEntries(Object.entries(COLS).map(([k, h]) => [k, head.indexOf(h)]));
    if (at.code < 0 || at.grade < 0) return null;
    const rows = [];
    for (const tr of [...table.rows].slice(1)) {
      const cell = (k) => (at[k] >= 0 && tr.cells[at[k]] ? words(tr.cells[at[k]].textContent) : '');
      if (!cell('code')) continue;
      rows.push({ year: cell('year'), code: cell('code'), name: cell('name'), credits: num(cell('credits')), group: cell('group'), call: cell('call'),
        callText: cell('callText'), grade: cell('grade'), mark: num(cell('mark')), kind: cell('kind'), course: cell('course'), term: cell('term'), notes: cell('notes') });
    }
    const sum = [...doc.querySelectorAll('table')].find((t) => heads(t).includes('superados'));
    const credits = sum ? [...sum.rows].slice(1).map((tr) => [...tr.cells].map((c) => words(c.textContent)))
      .filter((c) => c[0]).map((c) => ({ kind: c[0], passed: num(c[1]), pending: num(c[2]), min: num(c[3]) })) : [];
    return { rows, credits };
  };

  // Is this the view "Expediente completo" (the bar "Mi expediente > Expediente completo")? The first view of SIGMA is "Año actual".
  MAK.recordComplete = (doc) => /mi expediente\s*>\s*expediente completo/i.test(words(doc.body && doc.body.textContent));

  // MiUPNA: the address of "Consulta tu Expediente" (onclick="parent.open('…aplDestino=EXPS…')"), or null.
  MAK.recordEntry = function (doc) {
    for (const el of doc.querySelectorAll('[onclick*="aplDestino=EXPS"]')) {
      const m = /open\(\s*'([^']+)'/.exec(el.getAttribute('onclick'));
      const url = m && sigmaUrl(m[1].replace(/&amp;/g, '&'), doc.baseURI);
      if (url) return url;
    }
    return null;
  };

  // SIGMA: the link "Expediente completo" of its menu, or null.
  MAK.recordMenuLink = function (doc) {
    const a = [...doc.querySelectorAll('a[href]')].find((x) => words(x.textContent).toLowerCase() === 'expediente completo');
    return a ? sigmaUrl(a.getAttribute('href'), doc.baseURI) : null;
  };

  // The kept record and a new table: the rows of both, the new one first for the same year, subject and call
  // (another table of the Expediente, "Año actual", has only some rows). The credits: the new ones, if any.
  MAK.mergeRecord = function (kept, next) {
    const key = (r) => `${r.year}|${r.code}|${r.call}`;
    const rows = new Map(((kept && kept.rows) || []).map((r) => [key(r), r]));
    for (const r of next.rows) rows.set(key(r), r);
    return { rows: [...rows.values()], credits: next.credits.length ? next.credits : (kept && kept.credits) || [] };
  };

  // The record that the background script keeps: only these fields, short texts, numbers or null.
  MAK.cleanRecord = function (raw) {
    if (!raw || !Array.isArray(raw.rows)) return null;
    const text = (v) => String(v == null ? '' : v).slice(0, 160);
    const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const rows = raw.rows.slice(0, 300).filter((r) => r && r.code).map((r) => ({
      year: text(r.year), code: text(r.code), name: text(r.name), credits: n(r.credits), group: text(r.group), call: text(r.call), callText: text(r.callText),
      grade: text(r.grade), mark: n(r.mark), kind: text(r.kind), course: text(r.course), term: text(r.term), notes: text(r.notes)
    }));
    const credits = (Array.isArray(raw.credits) ? raw.credits : []).slice(0, 20).filter((c) => c && c.kind)
      .map((c) => ({ kind: text(c.kind), passed: n(c.passed), pending: n(c.pending), min: n(c.min) }));
    return { rows, credits };
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
