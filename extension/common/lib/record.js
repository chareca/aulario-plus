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
    { id: 'bronze', color: '#b0703a' },
    { id: 'silver', color: '#8a96a3' },
    { id: 'gold', color: '#c9971c' },
    { id: 'platinum', color: '#2a9d8f' },
    { id: 'diamond', color: '#3a7bd5' },
    { id: 'master', color: '#8e44ad' },
    { id: 'grandmaster', color: '#c2410c' },
    { id: 'legend', color: '#d6336c' }
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
    .mak-rank { display: inline-flex; align-items: center; gap: 6px; padding: 2px 11px 2px 5px; border-radius: 999px; white-space: nowrap;
      font-weight: 700; color: var(--ap-fg); background: var(--ap-surface); border: 2px solid var(--rank); }
    .mak-rank .rank-badge { flex: none; width: 1.6em; height: 1.6em; margin: -0.35em 0; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35)); }
    .mak-rank.new { box-shadow: 0 0 0 3px color-mix(in srgb, var(--rank) 40%, transparent); }
    .rank-big { margin: 4px 0 12px; font-size: 1.25em; }
    .rank-gain { margin: 10px 0; padding: 8px 12px; border-radius: var(--ap-radius-sm); background: var(--ap-green-bg); }
    .rank-gain p { margin: 2px 0; }
    .rank-gain strong { color: var(--ap-green); }
    .rank-bar { height: 8px; margin: 4px 0 2px; border-radius: 4px; background: var(--ap-line); overflow: hidden; }
    .rank-bar > span { display: block; height: 100%; border-radius: 4px; background: var(--ap-green); }
    .stage { margin: 12px 0 0; font-style: italic; }
  `;
  // The badge of each rank (SVG, viewBox 0 0 64 64): more ornaments for a higher rank. A shield with one chevron,
  // two, a star, a star in a ring, a diamond, a crown, a crown and wings with a flame, and wings, a crown and a glow.
  const SHIELD = 'M32 5 L53 12.5 V30 C53 43.5 44.5 53.5 32 59.5 C19.5 53.5 11 43.5 11 30 V12.5 Z';
  const INNER = 'M32 10.5 L48 16.3 V30 C48 40.5 41.5 48.5 32 53.5 C22.5 48.5 16 40.5 16 30 V16.3 Z';
  const STAR = (cx, cy, r) => `M${Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.45 : r;
    return `${(cx + d * Math.cos(a)).toFixed(1)} ${(cy + d * Math.sin(a)).toFixed(1)}`;
  }).join(' L')} Z`;
  const grad = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const shield = (k, a, b, edge, rim) => `<defs>${grad(`${k}f`, a, b)}</defs><path d="${SHIELD}" fill="url(#${k}f)" stroke="${edge}" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="${INNER}" fill="none" stroke="${rim}" stroke-opacity="0.55" stroke-width="2"/>`;
  const crown = (k, edge) => `<defs>${grad(`${k}c`, '#fff3b0', '#e8a400')}</defs>
    <path d="M19 17 L23 5 L28 12 L32 3 L36 12 L41 5 L45 17 Z" fill="url(#${k}c)" stroke="${edge}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="32" cy="12.5" r="1.8" fill="#fff"/>`;
  const WING = 'M14 24 C8 21 3 22 1 26 C4 27 6 28 7 30 C3 31 1 34 1 37 C5 36 8 37 9.5 39 C7 41 6.5 44 7.5 46 C10.5 44.5 13 44 15 44.5 Z';
  const WING_BIG = 'M15 21 C9 14 2 13 -1 17 C3 19 5 21 6 23 C1 23 -2 27 -2 31 C3 30 6 31 7.5 33 C3 35 1 39 1.5 43 C5.5 41 9 41 11 42 C9 45 9 49 10.5 51 C13 49 15.5 48 17.5 48 Z';
  const wings = (k, d, a, b, edge) => `<defs>${grad(`${k}w`, a, b)}</defs>
    <g fill="url(#${k}w)" stroke="${edge}" stroke-width="2.2" stroke-linejoin="round"><path d="${d}"/><path d="${d}" transform="translate(64 0) scale(-1 1)"/></g>`;
  const BADGES = {
    bronze: (k) => `${shield(k, '#f2b27c', '#8c4a1c', '#3b1d08', '#ffd9b3')}
      <path d="M21 31 L32 40 L43 31" fill="none" stroke="#fff0dc" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
    silver: (k) => `${shield(k, '#f6f8fb', '#7f8b97', '#262d35', '#ffffff')}
      <g fill="none" stroke="#ffffff" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 26 L32 35 L43 26"/><path d="M21 35 L32 44 L43 35"/></g>
      <g fill="none" stroke="#45505c" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"><path d="M21 26 L32 35 L43 26"/><path d="M21 35 L32 44 L43 35"/></g>`,
    gold: (k) => `${shield(k, '#ffe680', '#c08400', '#4d3200', '#fff6c8')}
      <path d="${STAR(32, 32, 12.5)}" fill="#fffbe6" stroke="#7a5200" stroke-width="2" stroke-linejoin="round"/>`,
    platinum: (k) => `${shield(k, '#c9fbef', '#1d7f70', '#08332d', '#ecfffa')}
      <circle cx="32" cy="32" r="13" fill="none" stroke="#ecfffa" stroke-width="2.4"/>
      <path d="${STAR(32, 32, 10)}" fill="#ffffff" stroke="#0c4d43" stroke-width="1.8" stroke-linejoin="round"/>`,
    diamond: (k) => `<defs>${grad(`${k}f`, '#d6ecff', '#1f5fd6')}${grad(`${k}t`, '#ffffff', '#8cc4ff')}</defs>
      <path d="M14 23 L23 10 H41 L50 23 L32 58 Z" fill="url(#${k}f)" stroke="#0a2766" stroke-width="3.2" stroke-linejoin="round"/>
      <path d="M14 23 H50 M23 10 L27 23 L32 58 M41 10 L37 23 L32 58 M27 23 L32 10 L37 23" fill="none" stroke="#0a2766" stroke-opacity="0.55" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M23 10 L27 23 H14 Z" fill="url(#${k}t)" opacity="0.9"/><path d="M32 10 L37 23 H27 Z" fill="#ffffff" opacity="0.55"/>
      <path d="M16 13 l2 -4 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 Z" fill="#ffffff"/>`,
    master: (k) => `${shield(k, '#dcb8ff', '#5f2595', '#250b40', '#f3e6ff')}
      <path d="${STAR(32, 35, 11)}" fill="#ffffff" stroke="#3a1263" stroke-width="1.8" stroke-linejoin="round"/>${crown(k, '#4a2a00')}`,
    grandmaster: (k) => `${wings(k, WING, '#fff1e0', '#ffb070', '#5a1d00')}${shield(k, '#ffb37a', '#b8370a', '#4a1300', '#ffe3cc')}
      <path d="M32 22 C36 27 40 30 40 36 C40 41 36.5 44.5 32 44.5 C27.5 44.5 24 41 24 36 C24 32 27 30 28 26 C29.5 29 30.5 30 32 30.5 C31.5 27.5 31.5 24.5 32 22 Z" fill="#fff4d6" stroke="#6e1f00" stroke-width="1.8" stroke-linejoin="round"/>
      ${crown(k, '#4a2000')}`,
    legend: (k) => `<defs><radialGradient id="${k}g" cx="0.5" cy="0.5" r="0.5"><stop offset="0.35" stop-color="#ffd43b" stop-opacity="0.65"/><stop offset="1" stop-color="#ff4d8d" stop-opacity="0"/></radialGradient></defs>
      <circle cx="32" cy="32" r="31" fill="url(#${k}g)"/>${wings(k, WING_BIG, '#fffbe0', '#f5b400', '#5c3a00')}${shield(k, '#ff9ccc', '#a0104e', '#3d0420', '#ffe0ef')}
      <path d="${STAR(32, 35, 12)}" fill="#fff6c2" stroke="#7a4b00" stroke-width="1.8" stroke-linejoin="round"/>${crown(k, '#4a2a00')}`
  };
  // The badge of a rank: an <svg> (the ids of its gradients have the rank: the same badge twice in a page is the same).
  MAK.rankBadge = function (id) {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" overflow="visible" class="rank-badge" aria-hidden="true">${BADGES[id](`mak-${id}-`)}</svg>`.replace(/>\s+</g, '><');
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
      h('p', { class: 'rank-big' }, MAK.rankPill(sum)),
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
