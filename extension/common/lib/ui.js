// Aulario Plus: small DOM helpers for the popup, the tools page and the banner.
// The helpers put text with textContent only. They never use innerHTML.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  // Make an element.
  // props: class, text, title, href (http/https only), attrs {}, data {}, on {event: fn}, hidden.
  MAK.h = function (tag, props, ...children) {
    const el = document.createElement(tag);
    const p = props || {};
    if (p.class) el.className = p.class;
    if (p.text !== undefined && p.text !== null) el.textContent = String(p.text);
    if (p.title) el.title = String(p.title);
    if (p.hidden) el.hidden = true;
    if (p.href) {
      const safe = MAK.safeHttpUrl(p.href);
      if (safe) {
        el.setAttribute('href', safe);
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    }
    for (const [k, v] of Object.entries(p.attrs || {})) if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v === true ? '' : String(v));
    for (const [k, v] of Object.entries(p.data || {})) el.dataset[k] = String(v);
    for (const [k, fn] of Object.entries(p.on || {})) el.addEventListener(k, fn);
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  };

  // A text with some parts in <mark> (the parts of a search result that match the query).
  // ranges: [[start, end], …] in order, without overlaps.
  MAK.marked = function (text, ranges) {
    const s = String(text || '');
    const out = [];
    let at = 0;
    for (const [start, end] of ranges || []) {
      if (start < at || end <= start || end > s.length) continue;
      if (start > at) out.push(s.slice(at, start));
      out.push(MAK.h('mark', { text: s.slice(start, end) }));
      at = end;
    }
    if (at < s.length) out.push(s.slice(at));
    return out;
  };

  // The buttons that the extension adds to the pages of MiAulario: the main button of the theme
  // (lib/themes.js), so the user sees which buttons are of the extension. ".mak-btn": a button with text.
  // ".mak-icon": a button with one drawn symbol (pencil, mail), a little larger. The styles must have the
  // variables of the theme (MAK.themedStyle).
  MAK.EXT_BUTTON_CSS = `
    .mak-btn, .mak-icon { cursor: pointer; opacity: 1; color: var(--ap-primary-fg); background: var(--ap-primary-bg);
      border: var(--ap-bw-sm) solid var(--ap-primary-edge); border-radius: var(--ap-radius-sm); box-shadow: var(--ap-shadow-sm); }
    .mak-btn { font: 700 calc(14px * var(--ap-zoom))/1.4 var(--ap-font); padding: 5px 12px; }
    .mak-icon { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: 30px; height: 26px; padding: 0; line-height: 0; }
    .mak-icon svg { width: 17px; height: 17px; display: block; }
    .mak-btn:hover, .mak-btn:focus-visible, .mak-icon:hover, .mak-icon:focus-visible { filter: brightness(0.93); }
    .mak-btn:focus-visible, .mak-icon:focus-visible { outline: 2px solid var(--ap-fg); outline-offset: 2px; }
    .mak-btn:disabled, .mak-icon:disabled { opacity: 0.5; cursor: default; }
  `;
  MAK.extButtonClass = (kind) => `mak-${kind}`;

  // The keys of the search for the system of the user: ⌘K on macOS, Ctrl+K on Windows and Linux.
  MAK.isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  MAK.searchKey = () => (MAK.isMac() ? '⌘K' : 'Ctrl+K');

  // Drawn icons (SVG, the color of the text): the same size and place in all the systems, which a
  // character such as ✉ does not give. name: 'pencil', 'mail', 'chevron' (an arrow down) or 'arrow'
  // (up and to the right: a link), 'calc' (a calculator). The class "ap-icon-<name>" lets a theme put
  // its own drawing (lib/themes.js, ICON_CSS).
  const ICONS = {
    pencil: [['path', { d: 'M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z' }], ['path', { d: 'M13.5 7l3.5 3.5' }]],
    mail: [['rect', { x: 3, y: 5.5, width: 18, height: 13, rx: 2 }], ['path', { d: 'M3.5 7l8.5 6 8.5-6' }]],
    chevron: [['path', { d: 'M6 9l6 6 6-6' }]],
    layout: [['rect', { x: 3.5, y: 4.5, width: 17, height: 15, rx: 2 }], ['path', { d: 'M10 4.5v15M10 12h10.5' }]], // the parts of the block of Mi sitio
    history: [['path', { d: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3' }], ['path', { d: 'M4.5 4.5V8.5H8.5' }], ['path', { d: 'M12 8v4.2l2.8 1.8' }]],
    calendar: [['rect', { x: 4, y: 5.5, width: 16, height: 14.5, rx: 2 }], ['path', { d: 'M4 10h16' }], ['path', { d: 'M8.5 3.5v4' }], ['path', { d: 'M15.5 3.5v4' }]],
    calc: [['rect', { x: 5, y: 3, width: 14, height: 18, rx: 2 }], ['path', { d: 'M8 7h8' }], ['path', { d: 'M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18h.01M12 18h.01M15.5 18h.01' }]],
    arrow: [['path', { d: 'M7 17L17 7' }], ['path', { d: 'M8 7h9v9' }]],
    // The main menu of the popup (Inicio)
    home: [['path', { d: 'M3.5 11.5L12 4.5l8.5 7' }], ['path', { d: 'M6 9.8V19.5h4.5v-5.5h3v5.5H18V9.8' }]],
    power: [['path', { d: 'M12 3.5v8' }], ['path', { d: 'M7.4 6.6A7.5 7.5 0 1 0 16.6 6.6' }]],
    bell: [['path', { d: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z' }], ['path', { d: 'M10 20.5a2 2 0 0 0 4 0' }]],
    clock: [['circle', { cx: 12, cy: 13, r: 7.5 }], ['path', { d: 'M12 9v4l2.5 2.5' }], ['path', { d: 'M4 6.5L7 4M20 6.5L17 4' }]],
    mode: [['circle', { cx: 12, cy: 12, r: 8 }], ['path', { d: 'M12 4a8 8 0 0 1 0 16z', fill: 'currentColor' }]],
    sync: [['path', { d: 'M19.5 10A8 8 0 0 0 5.6 7.2L4 9' }], ['path', { d: 'M4 4.5V9h4.5' }], ['path', { d: 'M4.5 14a8 8 0 0 0 13.9 2.8L20 15' }], ['path', { d: 'M20 19.5V15h-4.5' }]],
    school: [['path', { d: 'M2.5 9.5L12 5l9.5 4.5L12 14z' }], ['path', { d: 'M6.5 11.6v4.2c0 1.5 2.5 2.9 5.5 2.9s5.5-1.4 5.5-2.9v-4.2' }], ['path', { d: 'M21.5 9.5v5' }]],
    news: [['path', { d: 'M11 3.5l1.9 5.3 5.3 1.9-5.3 1.9L11 17.9l-1.9-5.3-5.3-1.9 5.3-1.9z' }], ['path', { d: 'M18.5 15v5M16 17.5h5' }]],
    help: [['circle', { cx: 12, cy: 12, r: 8.5 }], ['path', { d: 'M9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.6v.3' }], ['path', { d: 'M12 16.8h.01' }]],
    bug: [['rect', { x: 8, y: 8, width: 8, height: 11.5, rx: 4 }], ['path', { d: 'M12 11v8.5M8 12.5H4.5M19.5 12.5H16M8 16.5l-3 1.5M16 16.5l3 1.5M9 9L6.5 6.5M15 9l2.5-2.5' }]],
    // "Horarios" in Mi sitio (content-library.js): the library, the gym (and the sports facilities), the pool
    check: [['path', { d: 'M5.5 12.5l4.2 4.2L18.5 8' }]],
    x: [['path', { d: 'M7 7l10 10M17 7L7 17' }]],
    book: [['path', { d: 'M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z' }], ['path', { d: 'M12 6.5v13' }]],
    coffee: [['path', { d: 'M5 9.5h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z' }], ['path', { d: 'M16 11h1.5a2.5 2.5 0 0 1 0 5H16' }], ['path', { d: 'M8.5 3.5c-.7 1 .7 1.6 0 2.8M12 3.5c-.7 1 .7 1.6 0 2.8' }]],
    dumbbell: [['path', { d: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11' }]],
    pool: [['circle', { cx: 16.5, cy: 5.5, r: 1.8 }], ['path', { d: 'M4.5 12l5-3.5 3.5 3 3-2' }], ['path', { d: 'M3 15.5c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0' }],
      ['path', { d: 'M3 19.5c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0' }]]
  };
  MAK.icon = function (name) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    for (const [k, v] of Object.entries({ class: `ap-icon ap-icon-${name}`, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
    for (const [tag, attrs] of ICONS[name] || []) {
      const el = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
      svg.append(el);
    }
    return svg;
  };

  // The logo of the extension (the icon of the toolbar: a ring and a dot on a square). MAK.LOGO_CSS gives it
  // the colors of the theme.
  MAK.logo = function () {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    for (const [k, v] of Object.entries({ viewBox: '0 0 26 26', 'aria-hidden': 'true', class: 'mak-logo' })) svg.setAttribute(k, v);
    for (const [tag, attrs] of [
      ['rect', { class: 'lg-bg', width: 26, height: 26, rx: 6, fill: '#0b3b38' }],
      ['circle', { class: 'lg-ring', cx: 13, cy: 13, r: 8, fill: 'none', stroke: '#6fe0b8', 'stroke-width': 2.6 }],
      ['circle', { class: 'lg-dot', cx: 13, cy: 13, r: 3.6, fill: '#e9fbf5' }]
    ]) {
      const el = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
      svg.append(el);
    }
    return svg;
  };

  MAK.LOGO_CSS = `
    .mak-logo .lg-bg { fill: var(--ap-logo-bg); }
    .mak-logo .lg-ring { stroke: var(--ap-logo-ring); }
    .mak-logo .lg-dot { fill: var(--ap-logo-dot); }
  `;

  // ---- The two semesters ("Mi sitio": the final exams and the course guides) --------------
  // A part for each semester, with an arrow that folds it. The semester of the date is open; the
  // other one is folded and below it (its state stays when the page opens again). Both open: two
  // columns, with enough space. From 25 January (MAK.currentSeason) the first semester is gone.
  // Put MAK.SEMESTERS_CSS and MAK.FOLD_CSS in the styles of the shadow root.
  MAK.SEMESTERS_CSS = `
    .sems-wrap { container-type: inline-size; }
    .sems { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; align-items: start; }
    @container (min-width: 560px) { .sems.two { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
    .sem { min-width: 0; border: var(--ap-bw-sm) solid var(--ap-line); border-radius: var(--ap-radius-box); padding: 6px 10px; }
    .sem-head { display: flex; align-items: center; gap: 8px; }
    .sem-head .sem-title { flex: 1; min-width: 0; font-weight: 700; cursor: pointer; font-family: var(--ap-font-head); font-style: var(--ap-head-style);
      font-size: calc(14px * var(--ap-head-zoom)); }
    .sem-head .sem-title .meta { font-weight: 400; }
    .sem-body { margin-top: 4px; }
    .sem-body[hidden] { display: none; }
    .sem .mak-fold { width: 26px; height: 26px; }
  `;
  // key: the name of the part ("exams", "guides"). parts: { autumn, spring }, each { body }
  // (null: no part). Result: the element, or null without a part.
  MAK.semesterSections = function ({ key, now, parts, title }) {
    const current = MAK.currentSeason(now);
    const order = current === 'spring' ? ['spring'] : ['autumn', 'spring'];
    const list = order.filter((s) => parts[s]);
    if (!list.length) return null;
    const sems = MAK.h('div', { class: 'sems' });
    const layout = () => sems.classList.toggle('two', sems.querySelectorAll('.sem.open').length > 1);
    for (const season of list) {
      const store = `mak-sem:${key}:${season}`;
      let open = season === current;
      try {
        const v = localStorage.getItem(store);
        if (v !== null && season !== current) open = v === '1';
      } catch {}
      const body = MAK.h('div', { class: 'sem-body', hidden: !open }, parts[season].body);
      const sem = MAK.h('section', { class: `sem ${open ? 'open' : 'closed'}` });
      const label = title(season);
      const fold = MAK.foldButton(open, { open: MAK.t('fold.open', { name: label }), close: MAK.t('fold.close', { name: label }) }, (o) => {
        sem.classList.toggle('open', o);
        sem.classList.toggle('closed', !o);
        MAK.uiSave(store, o);
        // Two open semesters side by side: at once when one opens, after the fold when one closes.
        if (o) layout();
        MAK.fold(body, o, o ? null : layout);
      });
      sem.append(MAK.h('div', { class: 'sem-head' }, MAK.h('span', { class: 'sem-title', text: label, on: { click: () => fold.click() } }), fold), body);
      sems.append(sem);
    }
    layout();
    return MAK.h('div', { class: 'sems-wrap' }, sems);
  };

  // ---- The calendar of the exams (Mi sitio: each semester; the home page of a site: its subject) ----
  // The months of the exams, from Monday to Sunday: the finals in the color of the exams of the guides, the
  // recoveries in another one. A day of an exam has a tooltip (on hover and on focus): the subject, the kind and
  // the date; it stays inside the calendar (the sidebar of MiAulario covers what goes out of the box). focus:
  // the site of a subject; then the days of the other subjects are grey, without a tooltip.

  // The exams as days: [{ ms, kind: 'final' | 'rec', room, siteId, name }]. mine: MAK.myExams; nameOf(row).
  MAK.examDays = (mine, nameOf) => mine.flatMap((r) => [['final', r.final, r.finalRoom], ['rec', r.recovery, r.recoveryRoom]]
    .filter(([, ms]) => ms).map(([kind, ms, room]) => ({ ms, kind, room: room || '', siteId: r.siteId, name: nameOf(r) })));

  // The weeks of a month, Monday first: [[null, 1, 2, …], …] (null: a day of another month).
  MAK.monthWeeks = function (year, month) {
    const first = (new Date(year, month, 1).getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
    while (cells.length % 7) cells.push(null);
    return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  };

  MAK.EXAM_CAL_CSS = `
    .cal-wrap { margin: 10px 0 4px; }
    /* The months side by side, smaller with less space (down to 150 px each); one below the other only without room for two. */
    .cal-months { display: flex; flex-wrap: wrap; justify-content: space-around; gap: 14px 22px; }
    .cal-month { flex: 1 1 150px; min-width: 0; max-width: 242px; }
    .cal-title { font-weight: 700; margin: 0 0 6px; }
    .cal-title::first-letter { text-transform: uppercase; }
    .cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 32px)); gap: 3px; }
    .cal-wd { text-align: center; font-size: 11px; font-weight: 700; color: var(--ap-muted); }
    .cal-day { position: relative; aspect-ratio: 8 / 7; display: flex; align-items: center; justify-content: center; border-radius: var(--ap-radius-sm);
      font-size: 12.5px; font-variant-numeric: tabular-nums; }
    .cal-day.out { visibility: hidden; }
    .cal-day.today { box-shadow: inset 0 0 0 2px var(--ap-fg); }
    .cal-day.final { background: var(--ap-k-exam); color: var(--ap-k-exam-fg); font-weight: 800; }
    .cal-day.rec { background: var(--ap-k-participation); color: var(--ap-k-participation-fg); font-weight: 800; }
    .cal-day.final.rec { background: linear-gradient(135deg, var(--ap-k-exam) 50%, var(--ap-k-participation) 50%); }
    .cal-day.dim { opacity: 0.35; filter: grayscale(0.6); font-weight: 400; }
    .cal.focus .cal-day[data-tip]:not(.dim) { box-shadow: 0 0 0 2px var(--ap-surface), 0 0 0 4px var(--ap-fg); z-index: 1; }
    .cal { position: relative; }
    .cal-tip { position: absolute; z-index: 3; width: max-content; max-width: min(260px, 100%); white-space: pre-line; text-align: left;
      padding: 6px 9px; border-radius: var(--ap-radius-sm); font: 600 12px/1.35 var(--ap-font);
      color: var(--ap-surface); background: var(--ap-fg); box-shadow: var(--ap-shadow-sm); pointer-events: none; }
    .cal-day[data-tip]:focus-visible { outline: 2px solid var(--ap-fg); outline-offset: 2px; }
    .cal-legend { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 14px; margin-top: 8px; font-size: 0.86em; }
    .cal-key { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
    .cal-key.final { background: var(--ap-k-exam); }
    .cal-key.rec { background: var(--ap-k-participation); }
    .cal-toggle { display: inline-flex; align-items: center; gap: 5px; }
    .cal-toggle svg { width: 16px; height: 16px; }
    .cal-toggle[aria-pressed="false"] { color: var(--ap-btn-fg); background: var(--ap-btn-bg); border-color: var(--ap-btn-edge); }
    .cal-toggle[aria-pressed="true"] { color: var(--ap-primary-fg); background: var(--ap-primary-bg); border-color: var(--ap-primary-edge); }
  `;

  // The cards of the exams of "Mi sitio" (content-shortcuts.js) in .exams-row .exams.
  MAK.EXAM_ROWS_CSS = `
    /* The cards in rows of 3; the last row never has one card alone: 5 = 3 + 2, 4 = 2 + 2, 7 = 3 + 2 + 2, 1 = the full width.
       A grid of 6: a card takes 2 columns, in a row of 2 it takes 3. Less space (the width of the list itself): rows of 2,
       an odd last card on the full width; a column: one card a row. */
    .exams-row .exams { grid-template-columns: repeat(6, minmax(0, 1fr)); margin: 0; container-type: inline-size; }
    .exams-row .exams li { grid-column: span 2; }
    .exams-row .exams li:nth-last-child(2):nth-child(3n+1), .exams-row .exams li:nth-last-child(1):nth-child(3n+2),
    .exams-row .exams li:nth-last-child(4):nth-child(3n+1), .exams-row .exams li:nth-last-child(3):nth-child(3n+2),
    .exams-row .exams li:nth-last-child(2):nth-child(3n), .exams-row .exams li:nth-last-child(1):nth-child(3n+1) { grid-column: span 3; }
    .exams-row .exams li:only-child:nth-child(n) { grid-column: 1 / -1; }
    @container (max-width: 760px) {
      .exams-row .exams li:nth-child(n):nth-last-child(n) { grid-column: span 3; }
      .exams-row .exams li:nth-child(odd):nth-last-child(1) { grid-column: 1 / -1; } }
    @container (max-width: 460px) { .exams-row .exams li:nth-child(n):nth-last-child(n) { grid-column: 1 / -1; } }
  `;

  // The calendar: days (MAK.examDays), the months of the days (of the focus: its exams). null without a day.
  MAK.examCalendar = function (days, { focus, now } = {}) {
    const h = MAK.h;
    const keyOf = (ms) => new Date(ms).toDateString();
    const months = [...new Set((focus ? days.filter((d) => d.siteId === focus) : days).map((d) => {
      const x = new Date(d.ms);
      return x.getFullYear() * 12 + x.getMonth();
    }))].sort((a, b) => a - b);
    if (!months.length) return null;
    const byDay = new Map();
    for (const d of days) byDay.set(keyOf(d.ms), (byDay.get(keyOf(d.ms)) || []).concat(d));
    const today = keyOf(now ?? Date.now());
    const weekday = new Intl.DateTimeFormat(MAK.locale(), { weekday: 'narrow' });
    const weekdays = Array.from({ length: 7 }, (_, i) => weekday.format(new Date(2024, 0, 1 + i))); // 1 January 2024: a Monday
    const kindName = (k) => MAK.t(k === 'final' ? 'cal.final' : 'cal.rec');
    const cell = (year, month, day) => {
      if (!day) return h('span', { class: 'cal-day out' });
      const key = new Date(year, month, day).toDateString();
      const list = byDay.get(key) || [];
      const mine = focus ? list.filter((d) => d.siteId === focus) : list;
      const shown = mine.length ? mine : list; // the days of the other subjects: grey, with their tooltip
      const cls = ['cal-day', ...new Set(shown.map((d) => d.kind)), !mine.length && list.length ? 'dim' : '', key === today ? 'today' : ''];
      if (!shown.length) return h('span', { class: cls.filter(Boolean).join(' '), text: String(day) });
      const tip = shown.map((d) => `${d.name} · ${kindName(d.kind)} · ${MAK.formatDate(d.ms)}${d.room ? ` · ${d.room}` : ''}`).join('\n');
      return h('span', { class: cls.filter(Boolean).join(' '), text: String(day), data: { tip }, attrs: { tabindex: '0', 'aria-label': `${day}: ${tip}` } });
    };
    const month = (k) => {
      const [year, m] = [Math.floor(k / 12), k % 12];
      const title = new Intl.DateTimeFormat(MAK.locale(), { month: 'long', year: 'numeric' }).format(new Date(year, m, 1));
      return h('div', { class: 'cal-month' }, h('div', { class: 'cal-title', text: title }),
        h('div', { class: 'cal-grid', attrs: { 'aria-label': title } }, weekdays.map((w) => h('span', { class: 'cal-wd', text: w, attrs: { 'aria-hidden': 'true' } })),
          MAK.monthWeeks(year, m).flat().map((day) => cell(year, m, day))));
    };
    const tip = h('div', { class: 'cal-tip', hidden: true, attrs: { 'aria-hidden': 'true' } });
    const cal = h('div', { class: `cal${focus ? ' focus' : ''}` }, h('div', { class: 'cal-months' }, months.map(month)),
      h('div', { class: 'cal-legend meta' }, h('span', null, h('span', { class: 'cal-key final' }), kindName('final')), h('span', null, h('span', { class: 'cal-key rec' }), kindName('rec'))), tip);
    // The tooltip above the day, moved to the side when it would go out of the calendar.
    const show = (e) => {
      const day = e.target instanceof Element ? e.target.closest('.cal-day[data-tip]') : null;
      tip.hidden = !day;
      if (!day) return;
      tip.textContent = day.dataset.tip;
      const box = cal.getBoundingClientRect();
      const r = day.getBoundingClientRect();
      tip.style.left = `${Math.max(0, Math.min(box.width - tip.offsetWidth, r.left - box.left + (r.width - tip.offsetWidth) / 2))}px`;
      tip.style.top = `${r.top - box.top - tip.offsetHeight - 6}px`;
    };
    const hide = () => { tip.hidden = true; };
    cal.addEventListener('mouseover', show);
    cal.addEventListener('focusin', show);
    cal.addEventListener('mouseleave', hide);
    cal.addEventListener('focusout', hide);
    return cal;
  };

  // The button that shows or hides the calendars (the setting "examCalendar": the same in Mi sitio and in the
  // sites). wraps: the elements of the calendars; save(on). icon: only the icon (the head of a box).
  MAK.calendarButton = function (on, wraps, save, icon) {
    const label = MAK.t('cal.button');
    const b = MAK.h('button', { class: `${icon ? 'mak-fold' : MAK.extButtonClass('btn')} cal-toggle`, attrs: { type: 'button', 'aria-pressed': String(!!on), title: MAK.t('cal.help'), 'aria-label': label } },
      MAK.icon('calendar'), icon ? null : MAK.h('span', { text: label }));
    b.addEventListener('click', () => {
      on = !on;
      b.setAttribute('aria-pressed', String(on));
      for (const w of wraps) w.hidden = !on;
      save(on);
    });
    return b;
  };

  // The arrow that folds a box of the extension (the block "Aulario Plus" of "Mi sitio" and the boxes in
  // it): only the arrow, down when the box is open and to the right when it is folded. Put
  // MAK.FOLD_CSS in the styles of the shadow root.
  MAK.FOLD_CSS = `
    .mak-fold { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; margin: 0; padding: 0; cursor: pointer;
      color: var(--ap-btn-fg); background: var(--ap-btn-bg); border: var(--ap-bw-sm) solid var(--ap-btn-edge); border-radius: var(--ap-radius-sm); box-shadow: var(--ap-shadow-sm); }
    .mak-fold:hover, .mak-fold:focus-visible { filter: brightness(0.94); }
    .mak-fold:focus-visible { outline: 2px solid var(--ap-fg); outline-offset: 2px; }
    .mak-fold svg { width: 18px; height: 18px; transition: transform 0.15s ease; }
    .mak-fold[aria-expanded="false"] svg { transform: rotate(-90deg); }
    @media (prefers-reduced-motion: reduce) { .mak-fold svg { transition: none; } }
  `;
  // A part of the block "Aulario Plus" of "Mi sitio" ("Exámenes finales", "Guías docentes", "Horarios"): a tile with its
  // own frame and background (the look of ".tile" in each theme), and a head with its title and its buttons.
  MAK.TILE_CSS = `
    .tiles { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; container-type: inline-size; }
    .tile { min-width: 0; padding: 12px 14px; background: var(--ap-surface); border: var(--ap-bw-sm) solid var(--ap-line); border-radius: var(--ap-radius); }
    .tile h4 { margin: 0 0 8px; font-size: calc(16px * var(--ap-head-zoom)); line-height: 1.2; }
    .tile h4 .meta { font-family: var(--ap-font); font-style: normal; font-weight: 400; letter-spacing: normal; font-size: 0.8em; }
    /* The head: the title on the left, the arrow always at the top right, the other buttons (or tags) between them; with
       little room, the other buttons on a row of their own below. */
    .tile-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-areas: "title extra fold"; align-items: start; gap: 8px; }
    .tile-head > h4 { grid-area: title; min-width: 0; min-height: 30px; display: flex; align-items: center; margin: 0; cursor: pointer; }
    .tile-head > .mak-fold { grid-area: fold; }
    .tile-head + * { margin-top: 10px; }
    .tile-head > .actions { grid-area: extra; display: flex; flex-flow: row wrap; justify-content: flex-end; gap: 6px; align-items: center; align-content: center; min-height: 30px;
      margin: 0; padding: 0; background: none; border: 0; box-shadow: none; }
    .tile-head > .actions:empty { display: none; }
    @container (max-width: 560px) {
      .tile-head { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "title fold" "extra extra"; }
      .tile-head > .actions { justify-content: flex-start; }
    }
  `;
  // A tile that folds: its title, its content, the state at the start (open), onToggle(open) after each click, and
  // other buttons (or tags) for the head, before the arrow.
  MAK.foldTile = function (title, content, open, onToggle, extra) {
    const toggle = MAK.foldButton(open, { open: MAK.t('fold.open', { name: title }), close: MAK.t('fold.close', { name: title }) }, (o) => {
      MAK.fold(content, o);
      onToggle(o);
    });
    content.hidden = !open;
    return MAK.h('section', { class: 'tile' },
      MAK.h('div', { class: 'tile-head' }, MAK.h('h4', { text: title, on: { click: () => toggle.click() } }), MAK.h('div', { class: 'actions' }, extra || null), toggle),
      content);
  };

  // Fold or unfold an element (its "hidden") with a short animation of its height, padding, margins and opacity; done()
  // when it ends. The browser runs it (no script at each frame), and it ends cancelled (nothing stays). A new call during
  // an animation goes back from where it is. At once with reduced motion, out of the screen, or when the element is not
  // shown (a folded parent).
  const folds = new WeakMap();
  // The system asks for reduced motion: no animation.
  MAK.calmMotion = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const frameOf = (el) => {
    const cs = getComputedStyle(el);
    return { height: `${el.getBoundingClientRect().height}px`, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, marginTop: cs.marginTop, marginBottom: cs.marginBottom, opacity: cs.opacity };
  };
  const SHUT = { height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px', opacity: '0' };
  MAK.fold = function (el, open, done) {
    const running = folds.get(el);
    const now = running ? frameOf(el) : null;
    if (running) running.cancel();
    folds.delete(el);
    const end = () => {
      el.hidden = !open;
      el.style.overflow = '';
      el.style.boxSizing = '';
      if (done) done();
    };
    const already = !running && el.hidden === !open; // nothing to move
    el.hidden = false;
    const full = frameOf(el);
    // Out of the screen nobody sees it move: at once (no work for the browser).
    const box = el.getBoundingClientRect();
    const away = box.bottom < 0 || box.top > (root.innerHeight || 0);
    if (already || away || typeof el.animate !== 'function' || MAK.calmMotion() || !parseFloat(full.height)) return end();
    el.style.overflow = 'hidden';
    el.style.boxSizing = 'border-box';
    const anim = el.animate([now || (open ? SHUT : full), open ? full : SHUT],
      { duration: open ? 240 : 190, easing: open ? 'cubic-bezier(0.2, 0.7, 0.3, 1)' : 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' });
    folds.set(el, anim);
    anim.onfinish = () => {
      folds.delete(el);
      end();
      anim.cancel();
    };
  };

  // The <details> of a page (the popup, tools.html) or of a shadow root: they open and close with an animation of their
  // height (from the height of their summary), as MAK.fold. At once with reduced motion.
  MAK.animateDetails = function (doc = document) {
    const running = new WeakMap();
    doc.addEventListener('click', (e) => {
      const summary = e.target.closest && e.target.closest('summary');
      const d = summary && summary.parentElement;
      if (!d || d.tagName !== 'DETAILS' || d.firstElementChild !== summary || typeof d.animate !== 'function') return;
      if (MAK.calmMotion()) return;
      e.preventDefault();
      const cs = getComputedStyle(d);
      const shut = `${summary.getBoundingClientRect().height + ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((n, k) => n + (parseFloat(cs[k]) || 0), 0)}px`;
      const before = running.get(d);
      const now = before ? `${d.getBoundingClientRect().height}px` : null;
      if (before) before.cancel();
      const open = before ? !before.opening : !d.open;
      d.open = true;
      const full = `${d.getBoundingClientRect().height}px`;
      d.style.overflow = 'hidden';
      d.style.boxSizing = 'border-box';
      const anim = d.animate([{ height: now || (open ? shut : full) }, { height: open ? full : shut }],
        { duration: open ? 240 : 190, easing: open ? 'cubic-bezier(0.2, 0.7, 0.3, 1)' : 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' });
      anim.opening = open;
      running.set(d, anim);
      anim.onfinish = () => {
        running.delete(d);
        d.open = open;
        d.style.overflow = '';
        d.style.boxSizing = '';
        anim.cancel();
      };
    });
  };

  // A small window (next to its button, or over the page) comes with a bounce and goes with a short shrink: only transform
  // and opacity, which the browser moves without drawing the page again. at: where it grows from ("12px 0", default the
  // center). popOut calls done() at its end (then the window is hidden or removed); a popIn during it brings it back.
  // At once with reduced motion.
  const pops = new WeakMap();
  MAK.popIn = function (el, at) {
    const out = pops.get(el);
    if (out) out.cancel();
    pops.delete(el);
    if (typeof el.animate !== 'function' || MAK.calmMotion()) return;
    el.style.transformOrigin = at || '';
    el.animate([{ transform: 'scale(0.86)', opacity: 0 }, { transform: 'scale(1.04)', opacity: 1, offset: 0.55 }, { transform: 'scale(0.99)', offset: 0.8 }, { transform: 'none', opacity: 1 }],
      { duration: 360, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' });
  };
  MAK.popOut = function (el, done) {
    if (pops.has(el)) return; // already going
    if (typeof el.animate !== 'function' || MAK.calmMotion()) return done();
    const anim = el.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(1.03)', opacity: 1, offset: 0.3 }, { transform: 'scale(0.86)', opacity: 0 }],
      { duration: 200, easing: 'cubic-bezier(0.4, 0, 0.7, 0.2)', fill: 'forwards' });
    pops.set(el, anim);
    anim.onfinish = () => {
      pops.delete(el);
      done();
      anim.cancel();
    };
  };

  // A button with the arrow. open: the state at the start. labels: { open, close }, the texts for the
  // screen readers and the tooltip. onToggle(open) after each click.
  MAK.foldButton = function (open, labels, onToggle) {
    let state = !!open;
    const b = MAK.h('button', { class: 'mak-fold', attrs: { type: 'button' } }, MAK.icon('chevron'));
    const draw = () => {
      const label = state ? labels.close : labels.open;
      b.setAttribute('aria-expanded', String(state));
      b.setAttribute('aria-label', label);
      b.title = label;
    };
    b.addEventListener('click', () => {
      state = !state;
      draw();
      onToggle(state);
    });
    draw();
    return b;
  };

  // A text link of the extension: the text and a small arrow (the link opens in a new tab). On hover,
  // the text is underlined and the arrow moves up a little. Put MAK.LINK_CSS in the styles of each
  // shadow root (and of the popup) with these links. The color: --ap-link of the theme.
  MAK.LINK_CSS = `
    .mak-link { color: var(--ap-link, #1a5fb4); text-decoration: none; cursor: pointer; }
    .mak-link .mak-arrow { display: inline-block; width: 0.8em; height: 0.8em; margin-left: 0.2em; vertical-align: -0.05em; transition: transform 0.15s ease; }
    .mak-link .t { text-decoration: underline; text-decoration-color: transparent; text-underline-offset: 2px; }
    .mak-link:hover .t, .mak-link:focus-visible .t { text-decoration-color: currentColor; }
    .mak-link:hover .mak-arrow, .mak-link:focus-visible .mak-arrow { transform: translate(1px, -2px); }
    @media (prefers-reduced-motion: reduce) { .mak-link .mak-arrow { transition: none; } }
  `;
  MAK.link = function (href, text, props) {
    const p = props || {};
    const arrow = MAK.icon('arrow');
    arrow.classList.add('mak-arrow');
    return MAK.h('a', Object.assign({}, p, { href, class: ['mak-link', p.class].filter(Boolean).join(' ') }), MAK.h('span', { class: 't', text }), arrow);
  };

  // True if the parts of the extension in the page are dark: the setting colorMode of the user
  // (MAK.colorMode, content-theme.js), else the theme of MiAulario (the Sakai setting, or the system setting).
  MAK.isDarkPage = function () {
    if (MAK.colorMode === 'dark') return true;
    if (MAK.colorMode === 'light') return false;
    const c = document.documentElement.classList;
    if (c.contains('sakaiUserTheme-dark')) return true;
    if (c.contains('sakaiUserTheme-light')) return false;
    return !!(root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches);
  };

  // ---- The parts of the extension in MiAulario (shadow roots with MAK.themedStyle) ----------------
  // A box at the top of a page or in the block "Aulario Plus" of "Mi sitio" (the host has the class
  // "in-block": then the box has no frame, the block is the frame). The title of the box: ".head .title".
  // A countdown or a small tag: ".count" (".soon", ".hot", ".ok").
  MAK.BOX_CSS = () => `
    :host { all: initial; display: block; margin: 0 0 14px; }
    :host(.in-block) { margin: 0 0 4px; }
    [hidden] { display: none !important; } /* the arrows: the rules with "display" must not show it */
    * { box-sizing: border-box; }
    .box { font: var(--ap-weight) calc(14px * var(--ap-zoom))/1.45 var(--ap-font); color: var(--ap-fg); background: var(--ap-win-bg);
      border: var(--ap-bw) solid var(--ap-edge); border-radius: var(--ap-radius); box-shadow: var(--ap-shadow); padding: 12px 14px;
      -webkit-backdrop-filter: var(--ap-blur); backdrop-filter: var(--ap-blur); }
    :host(.in-block) .box { background: transparent; border: 0; border-radius: 0; box-shadow: none; padding: 6px 0;
      -webkit-backdrop-filter: none; backdrop-filter: none; }
    .head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    /* The head of a box: a band in the colors of the head of the theme (not in the block: the block has one). */
    .box > .head { margin: -12px -14px 10px; padding: 9px 14px; background: var(--ap-head-bg); color: var(--ap-head-fg); border-bottom: var(--ap-head-line);
      border-top-left-radius: calc(var(--ap-radius) - var(--ap-bw)); border-top-right-radius: calc(var(--ap-radius) - var(--ap-bw)); }
    .box > .head:last-child, .box > .head:has(+ [hidden]) { margin-bottom: -12px; border-bottom: 0; border-radius: calc(var(--ap-radius) - var(--ap-bw)); }
    :host(.in-block) .box > .head { margin: 0 0 8px; padding: 0; background: none; color: inherit; border: 0; border-radius: 0; }
    .head .title { flex: 0 1 auto; margin-right: auto; cursor: pointer; font-family: var(--ap-font-head); font-weight: var(--ap-head-weight);
      font-style: var(--ap-head-style); letter-spacing: var(--ap-head-spacing); font-size: calc(17px * var(--ap-head-zoom)); line-height: 1.2;
      padding-bottom: var(--ap-title-pad); background: var(--ap-title-deco); }
    .box > .head .mak-fold { width: var(--ap-head-btn-size); height: var(--ap-head-btn-size); color: var(--ap-head-btn-fg); background: var(--ap-head-btn-bg); border-color: var(--ap-head-btn-edge); }
    :host(.in-block) .box > .head .mak-fold { width: 30px; height: 30px; color: var(--ap-btn-fg); background: var(--ap-btn-bg); border-color: var(--ap-btn-edge); }
    h4, h5 { font-family: var(--ap-font-head); font-weight: var(--ap-head-weight); font-style: var(--ap-head-style); letter-spacing: var(--ap-head-spacing); }
    .meta { color: var(--ap-muted); font-size: 0.86em; }
    a { color: var(--ap-link); }
    mark { background: var(--ap-mark-bg); color: var(--ap-mark-fg); }
    button.plain { font: inherit; font-size: 0.9em; background: none; border: 0; padding: 0; cursor: pointer; color: var(--ap-link); text-decoration: underline; text-decoration-color: transparent; text-underline-offset: 2px; }
    button.plain:hover, button.plain:focus-visible { text-decoration-color: currentColor; }
    select, input { font: inherit; color: var(--ap-input-fg); background: var(--ap-input-bg); border: var(--ap-bw-sm) solid var(--ap-input-edge);
      border-radius: var(--ap-input-radius); box-shadow: var(--ap-input-shadow); padding: 4px 8px; }
    .count { display: inline-block; flex: none; white-space: nowrap; line-height: 1.2; font-variant-numeric: tabular-nums;
      font-family: var(--ap-count-font); font-size: calc(var(--ap-count-size) * 0.9); font-weight: var(--ap-count-weight); font-style: var(--ap-count-style);
      padding: var(--ap-count-pad); background: var(--ap-count-bg); color: var(--ap-count-fg); border-radius: var(--ap-count-radius);
      box-shadow: var(--ap-count-shadow); text-shadow: var(--ap-count-glow); transform: var(--ap-count-turn); }
    .count.soon { background: var(--ap-count-soon-bg); color: var(--ap-count-soon-fg); }
    .count.hot { background: var(--ap-count-hot-bg); color: var(--ap-count-hot-fg); border-color: var(--ap-count-hot-edge); }
    .count.ok { background: var(--ap-count-ok-bg); color: var(--ap-count-ok-fg); border-color: var(--ap-count-ok-edge); }
    ${MAK.EXT_BUTTON_CSS}
    ${MAK.LINK_CSS}
    ${MAK.FOLD_CSS}
    ${MAK.LOGO_CSS}
  `;

  // Escape closes a window (as Cancel) also when the focus is not in it: after a click on its text, or when its field
  // loses the focus. One listener on the document while the window is in the page; win hidden: closed.
  // Result: stop(), the end of the listener (else it ends at the first key after the window is gone).
  MAK.escCloses = function (win, close) {
    const stop = () => document.removeEventListener('keydown', key, true);
    const key = (e) => {
      if (!win.isConnected) stop();
      else if (e.key === 'Escape' && !win.hidden) {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', key, true);
    return stop;
  };

  // A window over the page (the calculator, the forward of the mail, the message to a teacher...):
  // .backdrop > .win > header (h2, button.x), then the content.
  MAK.WIN_CSS = () => `
    :host { all: initial; }
    [hidden] { display: none !important; }
    * { box-sizing: border-box; }
    .backdrop { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: flex-start; justify-content: center;
      padding-top: 6vh; background: var(--ap-backdrop); }
    .win { width: min(620px, calc(100vw - 32px)); max-height: 88vh; overflow: auto; padding: 0 18px 16px;
      font: var(--ap-weight) calc(14px * var(--ap-zoom))/1.45 var(--ap-font); color: var(--ap-fg); background: var(--ap-win-bg);
      border: var(--ap-bw) solid var(--ap-edge); border-radius: var(--ap-radius); box-shadow: var(--ap-shadow-pop);
      -webkit-backdrop-filter: var(--ap-blur); backdrop-filter: var(--ap-blur); }
    .win > header { display: flex; align-items: center; gap: 8px; margin: 0 -18px 12px; padding: 11px 18px;
      background: var(--ap-win-head-bg); color: var(--ap-win-head-fg); border-bottom: var(--ap-head-line); }
    .win > header h2 { flex: 0 1 auto; margin: 0 auto 0 0; font-family: var(--ap-font-head); font-weight: var(--ap-head-weight); font-style: var(--ap-head-style);
      letter-spacing: var(--ap-head-spacing); font-size: calc(17px * var(--ap-head-zoom)); line-height: 1.2; padding-bottom: var(--ap-title-pad); background: var(--ap-title-deco); }
    .win > header button.plain, .win > header button.btn { color: var(--ap-head-btn-fg); background: var(--ap-head-btn-bg); border-color: var(--ap-head-btn-edge); }
    button.x { font: inherit; font-size: 18px; line-height: 1; background: none; border: 0; padding: 2px 6px; cursor: pointer; color: inherit; box-shadow: none; }
    .meta, .muted, .help { color: var(--ap-muted); font-size: 0.86em; }
    a { color: var(--ap-link); }
    table { width: 100%; border-collapse: collapse; font-size: 0.93em; }
    th { text-align: left; font-size: 0.86em; font-weight: 700; color: var(--ap-muted); padding: 4px; }
    td { padding: 6px 4px; border-top: 1px solid var(--ap-line); vertical-align: middle; }
    input, textarea, select { font: inherit; color: var(--ap-input-fg); background: var(--ap-input-bg); border: var(--ap-bw-sm) solid var(--ap-input-edge);
      border-radius: var(--ap-input-radius); box-shadow: var(--ap-input-shadow); padding: 5px 8px; }
    input[type=checkbox], input[type=radio] { box-shadow: none; accent-color: var(--ap-fg); }
    button.plain, button.btn { font: inherit; font-size: 0.93em; cursor: pointer; padding: 4px 12px; color: var(--ap-btn-fg); background: var(--ap-btn-bg);
      border: var(--ap-bw-sm) solid var(--ap-btn-edge); border-radius: var(--ap-radius-sm); box-shadow: var(--ap-shadow-sm); }
    button.primary { color: var(--ap-primary-fg); background: var(--ap-primary-bg); border-color: var(--ap-primary-edge); font-weight: 700; }
    button:disabled { opacity: 0.55; cursor: default; }
    button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible, a:focus-visible { outline: 2px solid var(--ap-fg); outline-offset: 2px; }
    .status { min-height: 1.4em; margin-top: 10px; font-size: 0.93em; }
    .status.error, .low, .bad { color: var(--ap-red); }
    .status.ok, .ok { color: var(--ap-green); }
    ${MAK.EXT_BUTTON_CSS}
    ${MAK.LINK_CSS}
  `;

  // Replace all the children of an element.
  MAK.fill = function (el, ...children) {
    el.replaceChildren();
    for (const c of children.flat(Infinity)) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return el;
  };

  // Date formats for the selected language (es-ES or en-GB).
  const formats = {};
  function format(kind) {
    const locale = MAK.locale();
    const key = `${locale}|${kind}`;
    if (!formats[key]) {
      const opts = kind === 'long'
        ? { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'short' };
      formats[key] = new Intl.DateTimeFormat(locale, opts);
    }
    return formats[key];
  }

  // "vie, 16 oct, 23:55" or "Fri 16 Oct, 23:55"
  MAK.formatDate = function (ms) {
    return ms ? format('long').format(ms) : '';
  };

  // "hace 3 min" or "3 min ago"; older than one day: "16 oct"
  MAK.ago = function (ms, now) {
    if (!ms) return '';
    const s = Math.max(0, Math.round((now - ms) / 1000));
    if (s < 60) return MAK.t('ago.s', { n: s });
    if (s < 3600) return MAK.t('ago.min', { n: Math.round(s / 60) });
    if (s < 86400) return MAK.t('ago.h', { n: Math.round(s / 3600) });
    return format('short').format(ms);
  };

  // "3 archivos · 1 anuncio · 2 mensajes de foro · 1 entrega"
  MAK.newsSummary = function (news) {
    const parts = [];
    if (news.files.length) parts.push(MAK.t('news.files', { n: news.files.length }));
    if (news.announcements.length) parts.push(MAK.t('news.announcements', { n: news.announcements.length }));
    if (news.deliveries.length) parts.push(MAK.t('news.deliveries', { n: news.deliveries.length }));
    if (news.dateChanges && news.dateChanges.length) parts.push(MAK.t('news.dateChanges', { n: news.dateChanges.length }));
    if (news.feedback && news.feedback.length) parts.push(MAK.t('news.feedback', { n: news.feedback.length }));
    if (news.grades && news.grades.length) parts.push(MAK.t('news.grades', { n: news.grades.length }));
    const posts = news.forums.reduce((n, f) => n + f.delta, 0);
    if (posts) parts.push(MAK.t('news.forumPosts', { n: posts }));
    return parts.join(' · ');
  };

  // "3 nov" or "3 Nov".
  MAK.formatDay = function (ms) {
    return ms ? format('short').format(ms) : '';
  };

  // "1 día", "3 horas", "5 minutos".
  MAK.durationText = function (seconds) {
    if (seconds >= 86400 && seconds % 86400 === 0) return MAK.t('dur.days', { n: seconds / 86400 });
    if (seconds >= 3600 && seconds % 3600 === 0) return MAK.t('dur.hours', { n: seconds / 3600 });
    return MAK.t('dur.minutes', { n: Math.round(seconds / 60) });
  };

  // The results of a search (lib/search.js) in groups, in the order of their best result: [[type, results]].
  // The popup and the search palette in MiAulario (content-search.js).
  MAK.searchGroups = (results) => [...new Set(results.map((x) => x.type))].map((type) => [type, results.filter((x) => x.type === type)]);
  // The second line of a result: its site (not for a site), then a date (a delivery, an event, an
  // announcement) or its meta (none for a tool or a grade). The children of an element (MAK.h).
  MAK.searchMeta = function (x) {
    const more = /^(delivery|event|announcement)$/.test(x.type) && x.time ? MAK.formatDate(x.time) : x.type === 'tool' || x.type === 'grade' ? null : x.meta;
    const site = x.type === 'site' ? [] : MAK.marked(x.site, x.siteHl);
    return [site, site.length && more ? ' · ' : null, more];
  };

  // "20 oct → 25 oct": a delivery with a new due date.
  MAK.dateMove = function (from, to) {
    return MAK.t('news.dateMove', { from: MAK.formatDate(from), to: to ? MAK.formatDate(to) : MAK.t('due.noDate') });
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
