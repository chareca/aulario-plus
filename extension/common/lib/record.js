// Aulario Plus: the official grades of the user, from the Expediente of SIGMA (academicos.unavarra.es).
// The user turns it on in the settings (an optional permission for MiUPNA and SIGMA). Then the extension
// reads the table "Expediente completo" when the user opens it, and every few days in a tab in the
// background: MiUPNA (portal.unavarra.es; the login of the UPNA with its session, no password) → the link
// of "Consulta tu Expediente" (with a pass of the portal that the extension never keeps) → SIGMA →
// "Expediente completo". The grades stay in the browser. Their average gives a rank (MAK.recordSummary).
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

  // The ranks of the average, from 5 (the average of passed subjects is never lower). Their names: i18n "rank.<id>".
  MAK.RANKS = [
    { id: 'bronze', min: 5, color: '#b0703a' },
    { id: 'silver', min: 6, color: '#8a96a3' },
    { id: 'gold', min: 7, color: '#c9971c' },
    { id: 'platinum', min: 8, color: '#2a9d8f' },
    { id: 'diamond', min: 8.5, color: '#3a7bd5' },
    { id: 'master', min: 9, color: '#8e44ad' },
    { id: 'legend', min: 9.5, color: '#d6336c' }
  ];

  // The passed subjects: the best row of each code with a pass (a mark from 5, or a grade in words such as
  // "APTO" or "Reconocida"); an annulled one is not.
  const PASS_RE = /aprobad|notable|sobresaliente|matr[ií]cula|apto|reconocid|convalidad|adaptad/i;
  const FAIL_RE = /no apto|suspens|no presentad/i;
  const passes = (r) => !/anulad/i.test(r.notes) && (r.mark !== null ? r.mark >= 5 : PASS_RE.test(r.grade) && !FAIL_RE.test(r.grade));
  function passedRows(record) {
    const best = new Map();
    for (const r of (record && record.rows) || []) {
      if (!passes(r)) continue;
      const kept = best.get(r.code);
      if (!kept || (kept.mark ?? -1) < (r.mark ?? -1)) best.set(r.code, r);
    }
    return [...best.values()];
  }
  const rankAt = (average) => MAK.RANKS.findLastIndex((k) => average >= k.min);

  // The average of the record, as the official one: the passed subjects with a number, each one with the
  // weight of its credits. And its rank. { count, credits, points (Σ mark · credits), average (2 decimals), rank }, or null.
  MAK.recordSummary = function (record) {
    const rows = passedRows(record).filter((r) => r.mark !== null && r.credits > 0);
    const credits = rows.reduce((a, r) => a + r.credits, 0);
    if (!credits) return null;
    const points = rows.reduce((a, r) => a + r.mark * r.credits, 0);
    const average = Math.round((points / credits) * 100) / 100;
    return { count: rows.length, credits, points, average, rank: MAK.RANKS[Math.max(rankAt(average), 0)] };
  };

  // The credits of the degree: { passed, total } from the table of credits of SIGMA (its row "Total", else the
  // sum of its kinds, not the other totals: "Total créditos reconocidos", "Total créditos matriculados"; total:
  // the minimum credits), else { passed, total: null } from the passed subjects; or null.
  MAK.recordProgress = function (record) {
    const table = (record && record.credits) || [];
    const total = table.find((c) => /^total$/i.test(c.kind));
    const kinds = total ? [total] : table.filter((c) => !/^total/i.test(c.kind));
    const add = (k) => kinds.reduce((a, c) => a + (c[k] || 0), 0);
    if (add('min') > 0) return { passed: add('passed'), total: add('min') };
    const passed = passedRows(record).reduce((a, r) => a + (r.credits || 0), 0);
    return passed ? { passed, total: null } : null;
  };

  // The part of the degree that the user has done (MAK.recordProgress with a total): one of five stages, for a
  // message that fits it (i18n "record.stage<Id>"), or the end. { id, pct (down: 99 % is not the end), left }, or null.
  const STAGES = [[20, 'Start'], [45, 'Early'], [65, 'Half'], [90, 'Late'], [100, 'Last']];
  MAK.recordStage = function (progress) {
    if (!progress || !progress.total) return null;
    if (progress.passed >= progress.total) return { id: 'Done', pct: 100, left: 0 };
    const pct = Math.floor((progress.passed / progress.total) * 100);
    return { id: STAGES.find(([max]) => pct < max)[1], pct, left: progress.total - progress.passed };
  };

  // What the user saw of the record (after a window with the rank): the passed subjects and the average.
  MAK.recordSeenOf = function (record) {
    const sum = MAK.recordSummary(record);
    return { codes: passedRows(record).map((r) => r.code), average: sum ? sum.average : null };
  };
  // What went up since then: the new passed subjects, the average if it is higher (from: the old one), the rank
  // if it is higher. Never what went down. null: nothing new, or nothing seen yet (the first reading).
  MAK.recordGain = function (record, seen) {
    if (!seen || !Array.isArray(seen.codes)) return null;
    const sum = MAK.recordSummary(record);
    const subjects = passedRows(record).filter((r) => !seen.codes.includes(r.code)).map((r) => ({ name: r.name, credits: r.credits }));
    const from = sum && typeof seen.average === 'number' && sum.average > seen.average ? seen.average : null;
    const rankUp = from !== null && rankAt(sum.average) > rankAt(from) ? sum.rank : null;
    return subjects.length || from !== null ? { subjects, from, rankUp } : null;
  };

  // The rank and the average in a page (the popup, MiAulario; with lib/ui.js and lib/i18n.js): a pill in the
  // color of the rank (short: only its name, for the bar of MiAulario), and the content of a window.
  MAK.RANK_CSS = `
    .mak-rank { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px 2px 8px; border-radius: 999px; white-space: nowrap;
      font-weight: 700; color: var(--ap-fg); background: var(--ap-surface); border: 2px solid var(--rank); }
    .mak-rank::before { content: ''; flex: none; width: 9px; height: 9px; border-radius: 50%; background: var(--rank); }
    .mak-rank.new { box-shadow: 0 0 0 3px color-mix(in srgb, var(--rank) 40%, transparent); }
    .rank-big { margin: 4px 0 12px; font-size: 1.25em; }
    .rank-gain { margin: 10px 0; padding: 8px 12px; border-radius: var(--ap-radius-sm); background: var(--ap-green-bg); }
    .rank-gain p { margin: 2px 0; }
    .rank-gain strong { color: var(--ap-green); }
    .rank-bar { height: 8px; margin: 4px 0 2px; border-radius: 4px; background: var(--ap-line); overflow: hidden; }
    .rank-bar > span { display: block; height: 100%; border-radius: 4px; background: var(--ap-green); }
    .stage { margin: 10px 0 0; font-style: italic; }
  `;
  const avgText = (n) => n.toLocaleString(MAK.locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rankName = (k) => MAK.t(`rank.${k.id}`);
  MAK.rankPill = (sum, tag, short) => MAK.h(tag || 'span', { class: 'mak-rank', attrs: { style: `--rank: ${sum.rank.color}` } }, short ? rankName(sum.rank) : `${rankName(sum.rank)} · ${avgText(sum.average)}`);
  MAK.rankLine = (sum) => MAK.t('record.summary', { n: sum.count, avg: avgText(sum.average), rank: rankName(sum.rank) });
  // The content of a window: the rank, what went up since seen, the credits of the degree and a message for
  // that part of the degree (also with lib/names.js: the names of SIGMA are in capital letters).
  MAK.rankView = function (record, seen) {
    const h = MAK.h;
    const sum = MAK.recordSummary(record);
    if (!sum) return [];
    const gain = MAK.recordGain(record, seen);
    const progress = MAK.recordProgress(record);
    const stage = MAK.recordStage(progress);
    const shown = gain ? gain.subjects.slice(0, 5) : [];
    return [
      h('p', { class: 'rank-big' }, MAK.rankPill(sum)),
      h('p', { text: MAK.rankLine(sum) }),
      gain ? h('div', { class: 'rank-gain' },
        gain.rankUp ? h('p', null, h('strong', { text: MAK.t('record.newRank', { rank: rankName(gain.rankUp) }) })) : null,
        gain.from !== null ? h('p', { text: MAK.t('record.up', { from: avgText(gain.from), to: avgText(sum.average) }) }) : null,
        shown.map((x) => h('p', { text: MAK.t(x.credits ? 'record.passed' : 'record.passedNoCredits', { name: MAK.shortTitle(x.name), credits: x.credits }) })),
        gain.subjects.length > shown.length ? h('p', { text: MAK.t('record.passedMore', { n: gain.subjects.length - shown.length }) }) : null) : null,
      progress ? h('p', { class: 'meta', text: progress.total ? MAK.t('record.progress', { passed: progress.passed, total: progress.total }) : MAK.t('record.progressPassed', { passed: progress.passed }) }) : null,
      progress && progress.total ? h('div', { class: 'rank-bar' }, h('span', { attrs: { style: `width: ${Math.min(100, Math.round((progress.passed / progress.total) * 100))}%` } })) : null,
      stage ? h('p', { class: 'stage', text: MAK.t(`record.stage${stage.id}`, { pct: stage.pct, left: stage.left, n: stage.left }) }) : null
    ];
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
