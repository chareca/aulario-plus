// Aulario Plus: the official grades of the user, from the Expediente of SIGMA (academicos.unavarra.es).
// The user turns it on in the settings (an optional permission for MiUPNA and SIGMA). Then the extension
// reads the table "Expediente completo" when the user opens it, and every few days in a tab in the
// background: MiUPNA (portal.unavarra.es; the login of the UPNA with its session, no password) → the link
// of "Consulta tu Expediente" (with a pass of the portal that the extension never keeps) → SIGMA →
// "Expediente completo". The grades stay in the browser. The part of the credits of the degree that the user
// passed gives a rank (MAK.recordSummary).
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

  // The ranks of the degree: one for each eighth of its credits, so one for each term of a degree of 240 credits
  // (6 credits a subject, 30 a term, 60 a year). Their names: i18n "rank.<id>".
  MAK.RANKS = [
    { id: 'bronze', light: '#e2a26b', color: '#b0703a', dark: '#6e3f17' },
    { id: 'silver', light: '#dfe5eb', color: '#8a96a3', dark: '#4a5561' },
    { id: 'gold', light: '#ffe08a', color: '#c9971c', dark: '#7a5600' },
    { id: 'platinum', light: '#9fe8dc', color: '#2a9d8f', dark: '#145a51' },
    { id: 'diamond', light: '#a9cdff', color: '#3a7bd5', dark: '#1b4a8f' },
    { id: 'master', light: '#d7a8f0', color: '#8e44ad', dark: '#4f1f66' },
    { id: 'grandmaster', light: '#ffb48a', color: '#c2410c', dark: '#6e2306' },
    { id: 'legend', light: '#ff9fc1', color: '#d6336c', dark: '#7a1239' }
  ];
  const rankAt = (passed, total) => Math.min(MAK.RANKS.length - 1, Math.floor((passed * MAK.RANKS.length) / total));
  const rankIndex = (id) => MAK.RANKS.findIndex((k) => k.id === id);
  const SUBJECT_CREDITS = 6; // most subjects of the UPNA: the credits to the next rank in subjects
  // The stages of the degree, for a message that fits each one (i18n "record.stage<Id><1-3>"), and the end.
  const STAGES = [[20, 'Start'], [45, 'Early'], [65, 'Half'], [90, 'Late'], [100, 'Last']];

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

  // The credits of the degree, from the table of credits of SIGMA (its row "Total", else the sum of its kinds,
  // not the other totals: "Total créditos reconocidos", "Total créditos matriculados"; total: the minimum
  // credits), and the rank and the stage of the user. { passed, total, pct (down: 99 % is not the end), left,
  // rank, stage, next: { rank, credits, subjects } (the next rank), reach: the rank with the enrolled credits that
  // are not passed yet (a user who is behind, or who enrolled in more than 30 credits), if it is higher }, or
  // null without the table.
  MAK.recordSummary = function (record) {
    const table = (record && record.credits) || [];
    const row = table.find((c) => /^total$/i.test(c.kind));
    const kinds = row ? [row] : table.filter((c) => !/^total/i.test(c.kind));
    const add = (k) => kinds.reduce((a, c) => a + (c[k] || 0), 0);
    const total = add('min');
    if (!(total > 0)) return null;
    const passed = add('passed');
    const done = passed >= total;
    const pct = done ? 100 : Math.floor((passed / total) * 100);
    const at = rankAt(passed, total);
    const credits = Math.ceil(((at + 1) * total) / MAK.RANKS.length) - passed; // to the next rank
    const reach = rankAt(passed + add('pending'), total);
    return { passed, total, pct, left: done ? 0 : total - passed, rank: MAK.RANKS[at], stage: done ? 'Done' : STAGES.find(([max]) => pct < max)[1],
      next: MAK.RANKS[at + 1] ? { rank: MAK.RANKS[at + 1], credits, subjects: Math.ceil(credits / SUBJECT_CREDITS) } : null,
      reach: reach > at ? { rank: MAK.RANKS[reach], credits: add('pending') } : null };
  };

  // What the user saw of the record (after a window with the rank): the passed subjects and the rank.
  MAK.recordSeenOf = function (record) {
    const sum = MAK.recordSummary(record);
    return { codes: passedRows(record).map((r) => r.code), rank: sum ? sum.rank.id : null };
  };
  // What went up since then: the new passed subjects, and the rank if it is higher. null: nothing new, or nothing
  // seen yet (the first reading).
  MAK.recordGain = function (record, seen) {
    if (!seen || !Array.isArray(seen.codes)) return null;
    const sum = MAK.recordSummary(record);
    const subjects = passedRows(record).filter((r) => !seen.codes.includes(r.code)).map((r) => ({ name: r.name, credits: r.credits }));
    const rankUp = sum && rankIndex(seen.rank) >= 0 && rankIndex(sum.rank.id) > rankIndex(seen.rank) ? sum.rank : null;
    return subjects.length || rankUp ? { subjects, rankUp } : null;
  };

  // The rank in a page (the popup, MiAulario; with lib/ui.js and lib/i18n.js): a pill in the color of the rank
  // (short: only its name, for the bar of MiAulario), and the content of a window.
  MAK.RANK_CSS = `
    .mak-rank { display: inline-flex; align-items: center; gap: 6px; padding: 2px 11px 2px 4px; border-radius: 999px; white-space: nowrap;
      font-weight: 700; color: var(--ap-fg); background: var(--ap-surface); border: 2px solid var(--rank); }
    .mak-rank .rank-badge { flex: none; width: 1.45em; height: 1.45em; margin: -0.25em 0; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3)); }
    .mak-rank.new { box-shadow: 0 0 0 3px color-mix(in srgb, var(--rank) 40%, transparent); }
    .rank-hero { display: flex; align-items: center; gap: 14px; margin: 4px 0 12px; }
    .rank-hero .rank-badge { flex: none; width: 64px; height: 64px; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35)); }
    .rank-hero strong { display: block; font-size: 1.45em; line-height: 1.15; }
    .rank-gain { margin: 10px 0; padding: 8px 12px; border-radius: var(--ap-radius-sm); background: var(--ap-green-bg); }
    .rank-gain p { margin: 2px 0; }
    .rank-gain strong { color: var(--ap-green); }
    .rank-bar { height: 8px; margin: 4px 0 2px; border-radius: 4px; background: var(--ap-line); overflow: hidden; }
    .rank-bar > span { display: block; height: 100%; border-radius: 4px; background: var(--ap-green); }
    .stage { margin: 12px 0 0; font-style: italic; }
  `;
  // The gem of each rank (SVG, viewBox 0 0 64 64): a faceted stone with more sides for a higher rank (a triangle, a
  // rhombus, a pentagon, a hexagon, a cut diamond, stars of 6 and 8 points), in the colors of the rank (light, base,
  // dark); a sparkle from Oro, a halo for Leyenda.
  const grad = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const ring = (n, r, rot = -90, cy = 32) => Array.from({ length: n }, (_, i) => {
    const a = ((rot + (i * 360) / n) * Math.PI) / 180;
    return [32 + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  const starRing = (n, r, inner) => Array.from({ length: n * 2 }, (_, i) => {
    const a = ((-90 + (i * 180) / n) * Math.PI) / 180;
    const d = i % 2 ? inner : r;
    return [32 + d * Math.cos(a), 32 + d * Math.sin(a)];
  });
  const poly = (p) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const SPARKLE = '<path d="M17 11 l1.6 -4 l1.6 4 l4 1.6 l-4 1.6 l-1.6 4 l-1.6 -4 l-4 -1.6 Z" fill="#ffffff"/>';
  const SHAPES = { bronze: ring(3, 28, -90, 36), silver: ring(4, 28), gold: ring(5, 27), platinum: ring(6, 27), master: starRing(6, 28, 17), grandmaster: starRing(8, 29, 17), legend: starRing(8, 27, 16) };
  function gem(k, i) {
    const { id, light, color, dark } = MAK.RANKS[i];
    if (id === 'diamond') {
      return `<defs>${grad(`${k}f`, light, color)}</defs>
        <polygon points="12,24 22,10 42,10 52,24 32,56" fill="url(#${k}f)" stroke="${dark}" stroke-width="2.5" stroke-linejoin="round"/>
        <polygon points="22,10 27,24 12,24" fill="#ffffff" fill-opacity="0.55"/><polygon points="32,10 37,24 27,24" fill="#ffffff" fill-opacity="0.3"/>
        <polygon points="12,24 52,24 32,56" fill="${dark}" fill-opacity="0.12"/>
        <path d="M12 24 H52 M22 10 L27 24 L32 56 M42 10 L37 24 L32 56 M27 24 L32 10 L37 24" fill="none" stroke="${dark}" stroke-opacity="0.5" stroke-width="1.2"/>${SPARKLE}`;
    }
    const p = SHAPES[id];
    const c = id === 'bronze' ? [32, 38] : [32, 32];
    // The facets: a triangle from the center to each side, light and dark in turn (the top ones lighter).
    const facets = p.map((v, j) => `<polygon points="${poly([c, v, p[(j + 1) % p.length]])}" ${j % 2 ? `fill="${dark}" fill-opacity="0.18"` : `fill="#ffffff" fill-opacity="${j === 0 ? 0.45 : 0.18}"`}/>`).join('');
    const halo = id === 'legend'
      ? `<circle cx="32" cy="32" r="31" fill="none" stroke="${color}" stroke-opacity="0.35" stroke-width="2"/>${ring(12, 31).map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.4" fill="${color}"/>`).join('')}`
      : '';
    return `<defs>${grad(`${k}f`, light, color)}</defs>${halo}<polygon points="${poly(p)}" fill="url(#${k}f)"/>${facets}
      <polygon points="${poly(p)}" fill="none" stroke="${dark}" stroke-width="2.5" stroke-linejoin="round"/>${i >= 5 ? '<circle cx="32" cy="32" r="5" fill="#ffffff" fill-opacity="0.8"/>' : ''}${i >= 2 ? SPARKLE : ''}`;
  }
  // The badge of a rank: an <svg> (the ids of its gradients have the rank: the same badge twice in a page is the same).
  MAK.rankBadge = function (id) {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" overflow="visible" class="rank-badge" aria-hidden="true">${gem(`mak-${id}-`, MAK.RANKS.findIndex((k) => k.id === id))}</svg>`.replace(/>\s+</g, '><');
    return document.importNode(new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement, true);
  };
  const rankName = (k) => MAK.t(`rank.${k.id}`);
  MAK.rankPill = (sum, tag, short) => MAK.h(tag || 'span', { class: 'mak-rank', attrs: { style: `--rank: ${sum.rank.color}` } }, MAK.rankBadge(sum.rank.id),
    short ? rankName(sum.rank) : `${rankName(sum.rank)} · ${MAK.t('record.pct', { pct: sum.pct })}`);
  MAK.rankLine = (sum) => MAK.t('record.progress', { passed: sum.passed, total: sum.total });
  // The message of the stage of the degree: one of its three, another one each day (the end: one).
  MAK.stageText = (sum, now) => MAK.t(sum.stage === 'Done' ? 'record.stageDone' : `record.stage${sum.stage}${(Math.floor((now ?? Date.now()) / MAK.DAY) % 3) + 1}`,
    { pct: sum.pct, passed: sum.passed, left: sum.left, n: sum.left });
  // The content of a window: the rank, the credits of the degree, the next rank, the rank with what the user is
  // enrolled in, what went up since seen, and the message of the stage (also with lib/names.js: the names of
  // SIGMA are in capital letters).
  MAK.rankView = function (record, seen) {
    const h = MAK.h;
    const sum = MAK.recordSummary(record);
    if (!sum) return [];
    const gain = MAK.recordGain(record, seen);
    const shown = gain ? gain.subjects.slice(0, 5) : [];
    return [
      h('div', { class: 'rank-hero' }, MAK.rankBadge(sum.rank.id), h('div', null, h('strong', { text: rankName(sum.rank) }), h('span', { class: 'meta', text: MAK.t('record.pct', { pct: sum.pct }) }))),
      h('p', { class: 'meta', text: MAK.rankLine(sum) }),
      h('div', { class: 'rank-bar' }, h('span', { attrs: { style: `width: ${sum.pct}%` } })),
      sum.next ? h('p', { class: 'meta', text: MAK.t('record.next', { rank: rankName(sum.next.rank), n: sum.next.subjects, credits: sum.next.credits }) }) : null,
      sum.reach ? h('p', { class: 'meta', text: MAK.t('record.reach', { rank: rankName(sum.reach.rank), credits: sum.reach.credits }) }) : null,
      gain ? h('div', { class: 'rank-gain' },
        gain.rankUp ? h('p', null, h('strong', { text: MAK.t('record.newRank', { rank: rankName(gain.rankUp) }) })) : null,
        shown.map((x) => h('p', { text: MAK.t(x.credits ? 'record.passed' : 'record.passedNoCredits', { name: MAK.shortTitle(x.name), credits: x.credits }) })),
        gain.subjects.length > shown.length ? h('p', { text: MAK.t('record.passedMore', { n: gain.subjects.length - shown.length }) }) : null) : null,
      h('p', { class: 'stage', text: MAK.stageText(sum) })
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
