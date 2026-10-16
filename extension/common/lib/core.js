// MiAulario Keep-Alive: shared helpers without browser dependencies.
// All shared files attach to globalThis.MAK. Node tests load them with require().
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  MAK.BASE = 'https://miaulario.unavarra.es';
  MAK.HOST = 'miaulario.unavarra.es';
  MAK.MINUTE = 60 * 1000;
  MAK.HOUR = 60 * MAK.MINUTE;
  MAK.DAY = 24 * MAK.HOUR;

  // ---- Dates ---------------------------------------------------------------

  // Change the date formats of Sakai into milliseconds. Return null if the value is not a date.
  // Formats: number (ms), {epochSecond, nano}, {time}, 'yyyyMMddHHmmssSSS' (UTC), ISO string.
  MAK.toMs = function (value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'object') {
      if (typeof value.epochSecond === 'number') return value.epochSecond * 1000 + Math.floor((value.nano || 0) / 1e6);
      if (typeof value.time === 'number') return value.time;
      return null;
    }
    if (typeof value === 'string') {
      const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})$/.exec(value);
      if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +m[7]);
      const t = Date.parse(value);
      return Number.isNaN(t) ? null : t;
    }
    return null;
  };

  // Format a duration as "2d 04h 12m", "4h 12m" or "12m 30s".
  MAK.formatDuration = function (ms) {
    const s = Math.max(0, Math.floor(Math.abs(ms) / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const p = (n) => String(n).padStart(2, '0');
    if (d > 0) return `${d}d ${p(h)}h ${p(m)}m`;
    if (h > 0) return `${h}h ${p(m)}m`;
    return `${m}m ${p(sec)}s`;
  };

  // Urgency class for a time that remains.
  MAK.urgency = function (msLeft) {
    if (msLeft < 0) return 'overdue';
    if (msLeft < MAK.DAY) return 'red';
    if (msLeft < 3 * MAK.DAY) return 'orange';
    if (msLeft < 7 * MAK.DAY) return 'yellow';
    return 'green';
  };

  // ---- Text ----------------------------------------------------------------

  const ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
    laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', bull: '•', middot: '·',
    euro: '€', copy: '©', reg: '®', deg: '°', iexcl: '¡', iquest: '¿', ordf: 'ª', ordm: 'º',
    aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í',
    Oacute: 'Ó', Uacute: 'Ú', ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü', ccedil: 'ç', Ccedil: 'Ç',
    agrave: 'à', egrave: 'è', igrave: 'ì', ograve: 'ò', ugrave: 'ù', auml: 'ä', euml: 'ë', iuml: 'ï', ouml: 'ö'
  };

  function decodeEntities(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code) => {
      if (code[0] === '#') {
        const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
      }
      return Object.prototype.hasOwnProperty.call(ENTITIES, code) ? ENTITIES[code] : all;
    });
  }

  // Change HTML into plain text. This function does not use DOMParser, because the
  // Chromium service worker does not have it.
  MAK.htmlToText = function (html) {
    if (!html) return '';
    let s = String(html)
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style|head|title)\b[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n- ')
      .replace(/<\/(p|div|ul|ol|h[1-6]|tr|table|blockquote|section|article)\s*>/gi, '\n')
      .replace(/<(p|div|h[1-6]|tr|table|blockquote|section|article)\b[^>]*>/gi, '\n')
      .replace(/<\/t[dh]\s*>/gi, ' ')
      .replace(/<[^>]*>/g, '');
    s = decodeEntities(s)
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t\f\v ]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n');
    return s.trim();
  };

  // Text for search: no case, no accents.
  MAK.normalizeText = function (s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  };

  // True if all the words of the query are in the text. Case and accents are not important.
  MAK.matchesQuery = function (text, query) {
    const words = MAK.normalizeText(query).split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const hay = MAK.normalizeText(text);
    return words.every((w) => hay.includes(w));
  };

  // ---- URLs and ids --------------------------------------------------------

  // Return the URL only if it is http or https. Else return null.
  MAK.safeHttpUrl = function (u) {
    try {
      const url = new URL(String(u));
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
      return null;
    }
  };

  // Return the URL only if it is a MiAulario URL. A relative path becomes absolute.
  MAK.safeSiteUrl = function (u) {
    try {
      const url = new URL(String(u), MAK.BASE);
      return url.origin === MAK.BASE ? url.href : null;
    } catch {
      return null;
    }
  };

  // Sites of a user ("~...") and special sites ("!...") are not course sites.
  MAK.isSpecialSite = function (id) {
    return !id || id[0] === '~' || id[0] === '!';
  };

  // Find the site id or the tool placement in a portal path.
  MAK.parsePortalPath = function (pathname) {
    let m = /^\/portal\/site\/([^/?#]+)(?:\/(?:page|page-reset|tool|tool-reset)\/([^/?#]+))?/.exec(pathname || '');
    if (m) {
      let siteId;
      try { siteId = decodeURIComponent(m[1]); } catch { return null; }
      return { siteId, pageOrTool: m[2] || null };
    }
    m = /^\/portal\/directtool\/([^/?#]+)/.exec(pathname || '');
    if (m) return { placement: m[1] };
    return null;
  };

  MAK.siteUrl = function (siteId) {
    return `${MAK.BASE}/portal/site/${encodeURIComponent(siteId)}`;
  };

  // The page of a tool in a site (from the stored pages), or the site if the page is not known.
  MAK.toolUrl = function (pages, siteId, toolId) {
    const tool = pages && pages[siteId] && pages[siteId].tools[toolId];
    return (tool && MAK.safeSiteUrl(tool.page)) || MAK.siteUrl(siteId);
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
