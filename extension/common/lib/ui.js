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

  // The look of the buttons that the extension adds to the pages of MiAulario: the color of the
  // extension (teal, the same as "Download all (ZIP)"), so the user sees which buttons are of the
  // extension. ".mak-btn": a button with text. ".mak-icon": a button with one symbol (✎, ✉), a little
  // larger. ".dark": for the dark theme of the page (MAK.extButtonClass adds it).
  MAK.EXT_BUTTON_CSS = `
    .mak-btn, .mak-icon { cursor: pointer; border-radius: 6px; border: 1px solid #10524e; background: #10524e; color: #fff; opacity: 1; }
    .mak-btn { font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; padding: 5px 12px; }
    .mak-icon { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: 30px; height: 26px; padding: 0; line-height: 0; }
    .mak-icon svg { width: 17px; height: 17px; display: block; }
    .mak-btn:hover, .mak-btn:focus-visible, .mak-icon:hover, .mak-icon:focus-visible { background: #0b3d3a; border-color: #0b3d3a; }
    .mak-btn.dark, .mak-icon.dark { border-color: #4fd1a5; background: #4fd1a5; color: #0b1a17; }
    .mak-btn.dark:hover, .mak-btn.dark:focus-visible, .mak-icon.dark:hover, .mak-icon.dark:focus-visible { border-color: #7fe0bf; background: #7fe0bf; }
    .mak-btn:disabled, .mak-icon:disabled { opacity: 0.5; cursor: default; }
  `;
  MAK.extButtonClass = (kind) => `mak-${kind}${MAK.isDarkPage() ? ' dark' : ''}`;

  // Drawn icons (SVG, the color of the text): the same size and place in all the systems, which a
  // character such as ✉ does not give. name: 'pencil', 'mail', 'chevron' (an arrow down) or 'arrow'
  // (up and to the right: a link).
  const ICONS = {
    pencil: [['path', { d: 'M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z' }], ['path', { d: 'M13.5 7l3.5 3.5' }]],
    mail: [['rect', { x: 3, y: 5.5, width: 18, height: 13, rx: 2 }], ['path', { d: 'M3.5 7l8.5 6 8.5-6' }]],
    chevron: [['path', { d: 'M6 9l6 6 6-6' }]],
    arrow: [['path', { d: 'M7 17L17 7' }], ['path', { d: 'M8 7h9v9' }]]
  };
  MAK.icon = function (name) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
    for (const [tag, attrs] of ICONS[name] || []) {
      const el = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
      svg.append(el);
    }
    return svg;
  };

  // A text link of the extension: the text and a small arrow (the link opens in a new tab). On hover,
  // the text is underlined and the arrow moves up a little. Put MAK.LINK_CSS in the styles of each
  // shadow root (and of the popup) with these links. --mak-link changes the color.
  MAK.LINK_CSS = `
    .mak-link { color: var(--mak-link, #1a5fb4); text-decoration: none; cursor: pointer; }
    .dark .mak-link { color: var(--mak-link-dark, #8ab4f8); }
    .mak-link .mak-arrow { display: inline-block; width: 0.8em; height: 0.8em; margin-left: 0.2em; vertical-align: -0.05em; transition: transform 0.15s ease; }
    .mak-link:hover .t, .mak-link:focus-visible .t { text-decoration: underline; text-underline-offset: 2px; }
    .mak-link:hover .mak-arrow, .mak-link:focus-visible .mak-arrow { transform: translate(1px, -2px); }
    @media (prefers-reduced-motion: reduce) { .mak-link .mak-arrow { transition: none; } }
  `;
  MAK.link = function (href, text, props) {
    const p = props || {};
    const arrow = MAK.icon('arrow');
    arrow.setAttribute('class', 'mak-arrow');
    return MAK.h('a', Object.assign({}, p, { href, class: ['mak-link', p.class].filter(Boolean).join(' ') }), MAK.h('span', { class: 't', text }), arrow);
  };

  // True if the MiAulario page uses the dark theme (the Sakai setting, or the system setting).
  MAK.isDarkPage = function () {
    const c = document.documentElement.classList;
    if (c.contains('sakaiUserTheme-dark')) return true;
    if (c.contains('sakaiUserTheme-light')) return false;
    return !!(root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches);
  };

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
