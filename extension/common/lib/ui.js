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

  // Drawn icons (SVG, the color of the text): the same size and place in all the systems, which a
  // character such as ✉ does not give. name: 'pencil', 'mail', 'chevron' (an arrow down) or 'arrow'
  // (up and to the right: a link), 'calc' (a calculator). The class "ap-icon-<name>" lets a theme put
  // its own drawing (lib/themes.js, ICON_CSS).
  const ICONS = {
    pencil: [['path', { d: 'M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z' }], ['path', { d: 'M13.5 7l3.5 3.5' }]],
    mail: [['rect', { x: 3, y: 5.5, width: 18, height: 13, rx: 2 }], ['path', { d: 'M3.5 7l8.5 6 8.5-6' }]],
    chevron: [['path', { d: 'M6 9l6 6 6-6' }]],
    calc: [['rect', { x: 5, y: 3, width: 14, height: 18, rx: 2 }], ['path', { d: 'M8 7h8' }], ['path', { d: 'M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18h.01M12 18h.01M15.5 18h.01' }]],
    arrow: [['path', { d: 'M7 17L17 7' }], ['path', { d: 'M8 7h9v9' }]]
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
    .sem.closed .sem-body { display: none; }
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
      const body = MAK.h('div', { class: 'sem-body' }, parts[season].body);
      const sem = MAK.h('section', { class: `sem ${open ? 'open' : 'closed'}` });
      const label = title(season);
      const fold = MAK.foldButton(open, { open: MAK.t('fold.open', { name: label }), close: MAK.t('fold.close', { name: label }) }, (o) => {
        sem.classList.toggle('open', o);
        sem.classList.toggle('closed', !o);
        try { localStorage.setItem(store, o ? '1' : '0'); } catch {}
        layout();
      });
      sem.append(MAK.h('div', { class: 'sem-head' }, MAK.h('span', { class: 'sem-title', text: label, on: { click: () => fold.click() } }), fold), body);
      sems.append(sem);
    }
    layout();
    return MAK.h('div', { class: 'sems-wrap' }, sems);
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
    .mak-link:hover .t, .mak-link:focus-visible .t { text-decoration: underline; text-underline-offset: 2px; }
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
    button.plain { font: inherit; font-size: 0.9em; background: none; border: 0; padding: 0; cursor: pointer; color: var(--ap-link); }
    button.plain:hover, button.plain:focus-visible { text-decoration: underline; text-underline-offset: 2px; }
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
      background: var(--ap-head-bg); color: var(--ap-head-fg); border-bottom: var(--ap-head-line); }
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

  // "20 oct → 25 oct": a delivery with a new due date.
  MAK.dateMove = function (from, to) {
    return MAK.t('news.dateMove', { from: MAK.formatDate(from), to: to ? MAK.formatDate(to) : MAK.t('due.noDate') });
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
