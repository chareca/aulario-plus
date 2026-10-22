// Aulario Plus: the names of the sites. A short name without the code and without the capital
// letters ("26_0_240504_1 ANÁLISIS DE DATOS" -> "Análisis de Datos"), or a name from the user.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  const CODE = /^\d+(?:_[0-9A-Za-z]+)+\s+/; // "26_0_240701_1_G "
  const MINOR = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'lo', 'y', 'e', 'o', 'u', 'a', 'al', 'en', 'con', 'por', 'para', 'sin']);
  const ROMAN = /^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)$/;
  const VOWEL = /[AEIOUÁÉÍÓÚÜ]/i;
  const lower = (s) => s.toLocaleLowerCase('es');

  function word(w, first) {
    if (/\d/.test(w)) return w;
    const low = lower(w);
    if (!first && MINOR.has(low)) return low;
    if (ROMAN.test(w)) return w;
    if (w.length > 1 && !VOWEL.test(w)) return w; // an acronym: SQL, TFG
    return low.replace(/\p{L}/u, (c) => c.toLocaleUpperCase('es'));
  }

  // The title without the code at the start ("26_0_240504_1 ").
  MAK.withoutCode = function (title) {
    const full = String(title || '').replace(/\s+/g, ' ').trim();
    return full.replace(CODE, '') || full;
  };

  // The title without the code. A title in capital letters only gets the capitalization of a
  // Spanish title. A title with small letters stays the same.
  MAK.shortTitle = function (title) {
    const rest = MAK.withoutCode(title);
    if (rest !== rest.toLocaleUpperCase('es')) return rest;
    let first = true;
    return rest
      .split(' ')
      .map((w) => {
        const out = w.split(/([-/])/).map((part, i) => (i % 2 ? part : word(part, first && i === 0))).join('');
        first = false;
        return out;
      })
      .join(' ');
  };

  // The name that the extension shows: the name from the user, or the short name, or the title.
  MAK.siteName = function (site, settings) {
    const s = settings || {};
    const nick = s.nicknames && s.nicknames[site.id];
    if (nick) return nick;
    return s.shortNames === false ? site.title : MAK.shortTitle(site.title) || site.title;
  };

  // The name for other persons (the subject and the text of a message, the name of a shared file):
  // never the name from the user, because the other person does not know it. The clean name of the
  // site ("Complejidad y Computabilidad"), or the title of MiAulario.
  MAK.publicSiteName = function (site) {
    return MAK.shortTitle(site.title) || site.title;
  };

  // A copy of the sites with the name to show in "title", and the original title in "fullTitle".
  MAK.namedSites = function (sites, settings) {
    return (sites || []).map((x) => Object.assign({}, x, { title: MAK.siteName(x, settings), fullTitle: x.title }));
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;

  // The photos of the subjects (a theme with photos: Vía Láctea has MAK.SITE_PHOTOS of them). kept: { siteId: n }, the
  // photos given before: a subject keeps its photo (also when its semester ends, or a new subject comes). The new
  // subjects: the newest year first, the first semester before the second, then by name; each one takes the photo least
  // used in its semester, then the least used of all. So a year gets 1–5 in the first semester and 6–10 in the second,
  // and a semester has no photo twice (with up to 10 subjects in it). Only the sites of subjects (2026_0_240504_1).
  MAK.SITE_PHOTOS = 10;
  MAK.assignSitePhotos = function (sites, kept, count = MAK.SITE_PHOTOS) {
    const termOf = (id) => {
      const m = /^(\d{4})_\d+_(\d{6})/.exec(String(id));
      if (!m) return null;
      const n = Number(m[2][3]); // the semester in the code (as MAK.guideSeason): odd the first, even the second
      return { year: Number(m[1]), term: n >= 1 && n <= 8 ? (n % 2 ? 0 : 1) : 2 };
    };
    const map = Object.assign({}, kept);
    const all = new Array(count).fill(0);
    const byTerm = [0, 1, 2].map(() => new Array(count).fill(0));
    for (const [id, n] of Object.entries(map)) {
      const t = termOf(id);
      if (t && n >= 0 && n < count) { all[n]++; byTerm[t.term][n]++; }
    }
    const fresh = (Array.isArray(sites) ? sites : [])
      .filter((s) => s && !Object.hasOwn(map, String(s.id)) && termOf(s.id))
      .map((s) => Object.assign({ id: String(s.id), title: String(s.title || '') }, termOf(s.id)))
      .sort((a, b) => b.year - a.year || a.term - b.term || a.title.localeCompare(b.title, 'es') || (a.id < b.id ? -1 : 1));
    for (const c of fresh) {
      const own = byTerm[c.term];
      let best = 0;
      for (let i = 1; i < count; i++) if (own[i] < own[best] || (own[i] === own[best] && all[i] < all[best])) best = i;
      own[best]++;
      all[best]++;
      map[c.id] = best;
    }
    return map;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
