// MiAulario Keep-Alive: small DOM helpers for the popup, the tools page and the banner.
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

  // Replace all the children of an element.
  MAK.fill = function (el, ...children) {
    el.replaceChildren();
    for (const c of children.flat(Infinity)) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return el;
  };

  // Date formats for the selected language (es-ES or en-GB).
  const formats = {};
  function format(kind) {
    const locale = MAK.locale ? MAK.locale() : 'es-ES';
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

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
