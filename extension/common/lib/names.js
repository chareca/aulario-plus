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

  // The title without the code at the start. A title in capital letters only gets the
  // capitalization of a Spanish title. A title with small letters stays the same.
  MAK.shortTitle = function (title) {
    const full = String(title || '').replace(/\s+/g, ' ').trim();
    const rest = full.replace(CODE, '') || full;
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

  // A copy of the sites with the name to show in "title", and the original title in "fullTitle".
  MAK.namedSites = function (sites, settings) {
    return (sites || []).map((x) => Object.assign({}, x, { title: MAK.siteName(x, settings), fullTitle: x.title }));
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
