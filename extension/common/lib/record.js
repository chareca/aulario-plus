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
    .mak-rank { display: inline-flex; align-items: center; gap: 6px; padding: 2px 11px 2px 4px; border-radius: 999px; white-space: nowrap;
      font-weight: 700; color: var(--ap-fg); background: var(--ap-surface); border: 2px solid var(--rank); }
    .mak-rank .rank-badge { flex: none; width: 2.6em; height: 1.15em; margin: -0.1em 0; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3)); }
    .mak-rank.new { box-shadow: 0 0 0 3px color-mix(in srgb, var(--rank) 40%, transparent); }
    .rank-hero { display: flex; align-items: center; gap: 14px; margin: 4px 0 12px; }
    .rank-hero .rank-badge { flex: none; width: 132px; height: 58px; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35)); }
    .rank-hero strong { display: block; font-size: 1.45em; line-height: 1.15; }
    .rank-gain { margin: 10px 0; padding: 8px 12px; border-radius: var(--ap-radius-sm); background: var(--ap-green-bg); }
    .rank-gain p { margin: 2px 0; }
    .rank-gain strong { color: var(--ap-green); }
    .rank-bar { height: 8px; margin: 4px 0 2px; border-radius: 4px; background: var(--ap-line); overflow: hidden; }
    .rank-bar > span { display: block; height: 100%; border-radius: 4px; background: var(--ap-green); }
    .stage { margin: 12px 0 0; font-style: italic; }
  `;
  // The insignia of each rank (SVG, viewBox 0 0 100 44), in the style of the ranks of a game: plates with more
  // and more ornaments. Grey and silver plates with chevrons, blue plates with gold laurels and stars, black plates
  // with a gold edge and gold emblems (a seal, an eagle, wings and a globe with a cap of graduation).
  const grad = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  // The camouflage of a plate: soft patches (the same on each plate of a kind).
  const CAMO = [[18, 12, 14, 7, -20], [46, 32, 18, 8, 15], [78, 14, 15, 6, 25], [64, 36, 10, 5, -10], [30, 34, 9, 5, 30], [88, 33, 8, 6, 0], [8, 32, 7, 6, 0], [55, 9, 9, 4, -5]];
  const camo = (color, op) => `<g fill="${color}" opacity="${op}">${CAMO.map(([x, y, rx, ry, a]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${a} ${x} ${y})"/>`).join('')}</g>`;
  const PLATES = {
    grey: { a: '#5e646b', b: '#2b2f34', edge: '#aeb6bd', camo: ['#ffffff', 0.07] },
    silver: { a: '#7b828a', b: '#3a3f45', edge: '#e6ebef', camo: ['#ffffff', 0.08] },
    blue: { a: '#5d92c9', b: '#2a5585', edge: '#d9e7f5', camo: ['#0d2a4d', 0.18] },
    black: { a: '#2b2d33', b: '#0b0c0f', edge: '#e9b949', camo: ['#ffffff', 0.04] }
  };
  const plate = (k, kind) => {
    const p = PLATES[kind];
    return `<defs>${grad(`${k}p`, p.a, p.b)}<clipPath id="${k}clip"><rect x="2" y="2" width="96" height="40" rx="5"/></clipPath></defs>
      <rect x="2" y="2" width="96" height="40" rx="5" fill="url(#${k}p)"/>
      <g clip-path="url(#${k}clip)">${camo(...p.camo)}</g>
      <rect x="2" y="2" width="96" height="40" rx="5" fill="none" stroke="${p.edge}" stroke-width="2.4"/>
      ${kind === 'black' ? `<rect x="5" y="5" width="90" height="34" rx="3" fill="none" stroke="${p.edge}" stroke-opacity="0.45" stroke-width="0.9"/>` : ''}`;
  };
  // A gold (or another metal) fill for the emblems.
  const metal = (k, name, a, b) => `<defs>${grad(`${k}${name}`, a, b)}</defs>`;
  const GOLD = (k) => metal(k, 'g', '#fff4b0', '#d79b00');
  const g = (k) => `url(#${k}g)`;
  const INK = '#4a3300';
  // A chevron to the right, at x (its point at x + 15).
  const chevron = (x) => `M${x} 10 H${x + 7} L${x + 15} 22 L${x + 7} 34 H${x} L${x + 8} 22 Z`;
  const STAR = (cx, cy, r) => `M${Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.45 : r;
    return `${(cx + d * Math.cos(a)).toFixed(1)} ${(cy + d * Math.sin(a)).toFixed(1)}`;
  }).join(' L')} Z`;
  const star = (k, cx, cy, r) => `<path d="${STAR(cx, cy, r)}" fill="${g(k)}" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round"/>`;
  // A laurel on the left of the center (cx), and the same one mirrored: a branch from the bottom, near the center,
  // up the side (open at the top), with leaves along it. rx: its distance from the center.
  const laurel = (k, cx, rx = 15, ry = 14) => {
    const at = (a) => [cx + Math.cos(a) * rx, 22 - Math.sin(a) * ry];
    const from = Math.PI * 1.36;
    const to = Math.PI * 0.76;
    const leaves = [];
    for (let i = 0; i < 6; i++) {
      const a = from + ((to - from) * i) / 5;
      const [x, y] = at(a);
      // The leaf along the branch, a little out of it.
      const deg = (-a * 180) / Math.PI - 90 + 25;
      leaves.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="3.4" ry="1.6" transform="rotate(${deg.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
    }
    const [x0, y0] = at(from);
    const [x1, y1] = at(to);
    const stem = `<path d="M${x0.toFixed(1)} ${(y0 + 2).toFixed(1)} A${rx} ${ry} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${INK}" stroke-width="2.4"/><path d="M${x0.toFixed(1)} ${(y0 + 2).toFixed(1)} A${rx} ${ry} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${g(k)}" stroke-width="1.2"/>`;
    const side = `${stem}<g fill="${g(k)}" stroke="${INK}" stroke-width="0.6">${leaves.join('')}</g>`;
    return `${side}<g transform="translate(${2 * cx} 0) scale(-1 1)">${side}</g>`;
  };
  // The wings of the plates of the top (to the left of x; mirrored around the center).
  const WING = 'M38 20 C30 12 18 9 6 12 C12 14 16 15 19 17 C12 17 8 19 5 22 C12 22 17 22 21 23.5 C15 25 12 27 10 30 C17 28 23 27.5 29 27.5 C31 25 34 22 38 20 Z';
  const wing = (k) => `<g fill="${g(k)}" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round"><path d="${WING}"/><path d="${WING}" transform="translate(100 0) scale(-1 1)"/></g>`;

  const BADGES = {
    // One chevron (S1), bronze on grey.
    bronze: (k) => `${plate(k, 'grey')}${metal(k, 'b', '#ffd9b0', '#a8642c')}
      <path d="${chevron(43)}" fill="url(#${k}b)" stroke="#2a1606" stroke-width="1.2" stroke-linejoin="round"/>`,
    // Four chevrons and a bracket (SE), silver.
    silver: (k) => `${plate(k, 'silver')}${metal(k, 's', '#ffffff', '#a3adb6')}
      <g fill="url(#${k}s)" stroke="#20252b" stroke-width="1.1" stroke-linejoin="round">
        <path d="M30 9 C24 15 24 29 30 35 L33 35 C28.5 29 28.5 15 33 9 Z"/>
        <path d="${chevron(36)}"/><path d="${chevron(46)}"/><path d="${chevron(56)}"/><path d="${chevron(66)}"/></g>`,
    // Laurels and one star (GN1).
    gold: (k) => `${plate(k, 'blue')}${GOLD(k)}${laurel(k, 50, 14)}${star(k, 50, 22, 7)}`,
    // Laurels and three stars (GN3).
    platinum: (k) => `${plate(k, 'blue')}${GOLD(k)}${laurel(k, 50, 21)}${star(k, 40, 23, 5)}${star(k, 50, 21, 6)}${star(k, 60, 23, 5)}`,
    // Laurels and a diamond in a ring (MG).
    diamond: (k) => `${plate(k, 'blue')}${GOLD(k)}${laurel(k, 50, 18, 15)}${metal(k, 'd', '#e8f6ff', '#3d8bff')}
      <circle cx="50" cy="22" r="11" fill="none" stroke="${g(k)}" stroke-width="2.6"/><circle cx="50" cy="22" r="11" fill="none" stroke="${INK}" stroke-width="0.6"/>
      <path d="M43 19 L46.5 14 H53.5 L57 19 L50 30 Z" fill="url(#${k}d)" stroke="#0a2a66" stroke-width="1" stroke-linejoin="round"/>
      <path d="M43 19 H57 M46.5 14 L48 19 L50 30 M53.5 14 L52 19 L50 30" fill="none" stroke="#0a2a66" stroke-opacity="0.6" stroke-width="0.6"/>`,
    // A star in a seal (DMG).
    master: (k) => {
      const seal = Array.from({ length: 32 }, (_, i) => {
        const a = (i * Math.PI) / 16;
        const r = i % 2 ? 11.5 : 13.5;
        return `${(50 + r * Math.cos(a)).toFixed(1)} ${(22 + r * Math.sin(a)).toFixed(1)}`;
      }).join(' L');
      return `${plate(k, 'black')}${GOLD(k)}<path d="M${seal} Z" fill="none" stroke="${g(k)}" stroke-width="1.8" stroke-linejoin="round"/>
        <circle cx="50" cy="22" r="9" fill="#14161b" stroke="${g(k)}" stroke-width="1.2"/>${star(k, 50, 22.5, 8)}
        ${star(k, 22, 22, 3)}${star(k, 78, 22, 3)}`;
    },
    // An eagle with its wings up, its head to the side, and stars (LE).
    grandmaster: (k) => {
      const WING_UP = 'M47.5 21 C43 17 36 11 29 3.5 C29.5 7 30.5 9.5 32 11.5 C28 10.5 25 10.5 22.5 11.5 C26.5 14.5 30.5 16 34 17 C30 17.5 27 18.5 25 20.5 C30 21.5 35 21.5 39 22 C40.5 24.5 43.5 26.5 47.5 26.5 Z';
      return `${plate(k, 'black')}${GOLD(k)}
      <g fill="${g(k)}" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round">
        <path d="${WING_UP}"/><path d="${WING_UP}" transform="translate(100 0) scale(-1 1)"/>
        <path d="M47 32.5 L44.5 39 L48.5 37 L50 40.5 L51.5 37 L55.5 39 L53 32.5 Z"/>
        <path d="M50 14.5 C53.5 14.5 55 17.5 55 20.5 C55 26.5 53.5 31 50 35 C46.5 31 45 26.5 45 20.5 C45 17.5 46.5 14.5 50 14.5 Z"/>
        <path d="M49.5 7 C52.5 7 54.5 9 54.8 11.3 L59 12.8 L54.6 14.4 C53.6 16.2 51.8 17 49.6 17 C46.8 17 45 15 45 12.2 C45 9.2 47 7 49.5 7 Z"/></g>
      <circle cx="51.6" cy="11.2" r="1.1" fill="#14161b"/>${star(k, 20, 25, 3.2)}${star(k, 80, 25, 3.2)}${star(k, 13, 25, 2.2)}${star(k, 87, 25, 2.2)}`;
    },
    // Wings, a globe with a cap of graduation, and stars (GE).
    legend: (k) => `${plate(k, 'black')}${GOLD(k)}<defs><radialGradient id="${k}e" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#9ff5ff"/><stop offset="1" stop-color="#127a8a"/></radialGradient></defs>
      ${wing(k)}
      <circle cx="50" cy="23" r="9.5" fill="url(#${k}e)" stroke="${g(k)}" stroke-width="2"/>
      <path d="M40.5 23 H59.5 M50 13.5 C45 17 45 29 50 32.5 C55 29 55 17 50 13.5 M42 18 H58 M42 28 H58" fill="none" stroke="#0b4752" stroke-width="0.8" opacity="0.8"/>
      <path d="M41 13 L50 9 L59 13 L50 17 Z" fill="${g(k)}" stroke="${INK}" stroke-width="0.8" stroke-linejoin="round"/>
      <path d="M45 15 V18 C48 20 52 20 55 18 V15" fill="${g(k)}" stroke="${INK}" stroke-width="0.8"/>
      <path d="M57 13.8 V18.5" stroke="${INK}" stroke-width="0.8"/><circle cx="57" cy="19" r="1" fill="${g(k)}" stroke="${INK}" stroke-width="0.5"/>
      ${star(k, 14, 34, 2.6)}${star(k, 22, 36.5, 2.2)}${star(k, 86, 34, 2.6)}${star(k, 78, 36.5, 2.2)}`
  };
  // The badge of a rank: an <svg> (the ids of its gradients have the rank: the same badge twice in a page is the same).
  MAK.rankBadge = function (id) {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 44" class="rank-badge" aria-hidden="true">${BADGES[id](`mak-${id}-`)}</svg>`.replace(/>\s+</g, '><');
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
