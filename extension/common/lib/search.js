// Aulario Plus: the search in all the sites (Ctrl+K, ⌘K on macOS, in MiAulario, and the search box
// of the popup). The index has one entry for each site, page (tool), delivery, calendar event, file,
// part of Lessons ("Contenidos"), announcement, grade item and forum topic. It uses only the stored data: the search sends no requests.
//
// The search is a fuzzy finder, like fzf:
// - Each word of the query must match. A word matches the title, or "site / folder / title", if its
//   letters are in the text in the same order: "pdl" finds "Procesadores del Lenguaje", and
//   "comp rec" finds the tool "Recursos" of "Computer Science". The first letter must be at the start
//   of a word. Case and accents are not important.
// - The score is the score of fzf (algorithm V2): letters at the start of a word and letters
//   together give more points; letters far apart give fewer points.
// - If the search finds nothing, a second pass also accepts a word inside a word ("grales" finds
//   "Integrales") and a word with one error, or two errors in a long word ("integarles").
// - "'text": only the exact text. "!text": not the results with this text.
// - Each result has the parts of its title and of its site that match (hl, siteHl), to show them.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  MAK.SEARCH_TYPES = ['site', 'tool', 'delivery', 'event', 'file', 'lesson', 'announcement', 'grade', 'forum'];
  const RANK = Object.fromEntries(MAK.SEARCH_TYPES.map((type, i) => [type, i]));
  const CONTENT = '/access/content/group/';
  // The words of a text, without case and accents: "Tema 2 - Integrales.pdf" -> tema, 2, integrales, pdf.
  const tokens = (text) => MAK.normalizeText(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

  // ---- The score of fzf ------------------------------------------------------------------------

  const SCORE_MATCH = 16;
  const GAP_START = -3;
  const GAP_EXT = -1;
  const BONUS_WHITE = 10; // a letter at the start of the text or after a space
  const BONUS_BOUNDARY = 8; // a letter after another sign ("-", "_", "/", "(")
  const BONUS_NUMBER = 7; // a digit after a letter
  const BONUS_CONSECUTIVE = 4;
  const FIRST_MULT = 2; // the first letter of a word of the query counts two times
  // The weight of each way to match. The title is the best.
  const W_TITLE = 1;
  const W_PATH = 0.75; // "site / folder / title"
  const W_WORDS = 0.5; // the start of a word of the full name of the site or of the text of an item
  const W_INSIDE = 0.6; // second pass: a word inside a word
  const W_TYPO = 0.4; // second pass: a word with errors
  const TYPE_BONUS = { site: 6, tool: 3 };
  const MAX_TEXT = 200;
  const MAX_TERM = 32;

  const WHITE = 0;
  const OTHER = 1;
  const LETTER = 2;
  const DIGIT = 3;
  function classOf(ch) {
    const c = ch.charCodeAt(0);
    if (c >= 97 && c <= 122) return LETTER;
    if (c >= 48 && c <= 57) return DIGIT;
    if (c === 32) return WHITE;
    if (c < 128) return OTHER;
    return /\p{L}/u.test(ch) ? LETTER : /\p{N}/u.test(ch) ? DIGIT : /\s/.test(ch) ? WHITE : OTHER;
  }

  // The bonus of each character of a text (only letters and digits can match).
  function bonusesOf(text) {
    const b = new Int8Array(text.length);
    let prev = WHITE;
    for (let i = 0; i < text.length; i++) {
      const cls = classOf(text[i]);
      if (cls === LETTER || cls === DIGIT) b[i] = prev === WHITE ? BONUS_WHITE : prev === OTHER ? BONUS_BOUNDARY : cls === DIGIT && prev === LETTER ? BONUS_NUMBER : 0;
      prev = cls;
    }
    return b;
  }

  // A text to search in: { text (no case, no accents), b (the bonuses) }.
  function field(value) {
    const text = MAK.normalizeText(value).slice(0, MAX_TEXT);
    return { text, b: bonusesOf(text) };
  }

  // The score of a word of the query that is together in the text, from position `at`.
  const togetherScore = (len, b0) => SCORE_MATCH * len + b0 * FIRST_MULT + (len - 1) * Math.max(BONUS_CONSECUTIVE, b0);

  // The memory of fuzzy(): one buffer for all the calls (the search is synchronous).
  let H = new Int32Array(0);
  let C = new Int32Array(0);
  let F = new Int32Array(MAX_TERM);

  // The best match of the letters of `term` in `f.text`, in the same order: the algorithm V2 of fzf.
  // strict: each group of letters together starts at the start of a word ("pdl" and "proc len" find
  // "Procesadores del Lenguaje"; "ces" does not). Result: { score, pos (the positions in the text,
  // if withPos) } or null.
  function fuzzy(term, f, strict, withPos) {
    const text = f.text;
    const b = f.b;
    const M = term.length;
    const N = text.length;
    if (!M || M > N) return null;
    // The first possible position of each letter. No position: no match.
    for (let i = 0, k = 0; i < M; i++, k++) {
      const c = term[i];
      while (k < N && (text[k] !== c || (i === 0 && strict && !b[k]))) k++;
      if (k >= N) return null;
      F[i] = k;
    }
    let last = N - 1;
    while (text[last] !== term[M - 1]) last--;
    if (H.length < M * N) {
      H = new Int32Array(M * N * 2);
      C = new Int32Array(M * N * 2);
    }
    // The first letter. H: the best score with the letters 0..i up to position j.
    let best = 0;
    let bestJ = -1;
    let prevH = 0;
    let inGap = false;
    for (let j = F[0]; j <= last; j++) {
      if (text[j] === term[0] && (!strict || b[j])) {
        H[j] = SCORE_MATCH + b[j] * FIRST_MULT;
        C[j] = 1;
        inGap = false;
        if (M === 1 && H[j] > best) {
          best = H[j];
          bestJ = j;
        }
      } else {
        H[j] = Math.max(prevH + (inGap ? GAP_EXT : GAP_START), 0);
        C[j] = 0;
        inGap = true;
      }
      prevH = H[j];
    }
    // The other letters.
    for (let i = 1; i < M; i++) {
      const row = i * N;
      const prow = row - N;
      const c = term[i];
      let left = 0;
      inGap = false;
      for (let j = F[i]; j <= last; j++) {
        const s2 = left + (inGap ? GAP_EXT : GAP_START);
        let s1 = 0;
        let cons = 0;
        if (text[j] === c && (!strict || b[j] || C[prow + j - 1] > 0)) {
          s1 = H[prow + j - 1] + SCORE_MATCH;
          let bonus = b[j];
          cons = C[prow + j - 1] + 1;
          if (cons > 1) {
            const fb = b[j - cons + 1];
            // A new word breaks the group of letters together.
            if (bonus >= BONUS_BOUNDARY && bonus > fb) cons = 1;
            else bonus = Math.max(bonus, BONUS_CONSECUTIVE, fb);
          }
          if (s1 + bonus < s2) {
            s1 += b[j];
            cons = 0;
          } else s1 += bonus;
        }
        C[row + j] = cons;
        inGap = s1 < s2;
        const score = Math.max(s1, s2, 0);
        H[row + j] = score;
        left = score;
        if (i === M - 1 && score > best) {
          best = score;
          bestJ = j;
        }
      }
    }
    if (bestJ < 0) return null;
    if (!withPos) return { score: best };
    // Back from the best position: the positions of the letters.
    const pos = [];
    let preferMatch = true;
    for (let i = M - 1, j = bestJ; j >= F[i]; j--) {
      const row = i * N;
      const s = H[row + j];
      const s1 = i > 0 ? H[row - N + j - 1] : 0;
      const s2 = j > F[i] ? H[row + j - 1] : 0;
      const rowI = i;
      if (s > s1 && (s > s2 || (s === s2 && preferMatch))) {
        pos.push(j);
        if (i === 0) break;
        i--;
      }
      // For the next position: stay in a group of letters together.
      const next = rowI < M - 1 && j + 1 >= F[rowI + 1] && j + 1 <= last ? C[row + N + j + 1] : 0;
      preferMatch = C[row + j] > 1 || next > 0;
    }
    return { score: best, pos: pos.reverse() };
  }

  // The exact text: the position (at the start of a word if possible) and its score, or null.
  function together(term, f) {
    let at = -1;
    for (let k = f.text.indexOf(term); k >= 0; k = f.text.indexOf(term, k + 1)) {
      if (at < 0 || (f.b[k] && !f.b[at])) at = k;
      if (f.b[at]) break;
    }
    return at < 0 ? null : { score: togetherScore(term.length, f.b[at]), pos: Array.from({ length: term.length }, (_, i) => at + i) };
  }

  // The number of changes (add, remove or change a letter, or swap two letters) that make `term` the
  // start of `word`, if it is at most `max`; else Infinity.
  function prefixDistance(term, word, max) {
    const m = term.length;
    const n = Math.min(word.length, m + max);
    if (n < m - max) return Infinity;
    let prev2 = null;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= n; j++) {
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (term[i - 1] === word[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && term[i - 1] === word[j - 2] && term[i - 2] === word[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur.push(v);
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return Infinity;
      prev2 = prev;
      prev = cur;
    }
    let best = Infinity;
    for (let j = Math.max(0, m - max); j <= n; j++) best = Math.min(best, prev[j]);
    return best <= max ? best : Infinity;
  }
  const typosAllowed = (term) => (term.length >= 9 ? 2 : term.length >= 5 ? 1 : 0);
  // The letters of a match are together, or with one other letter between them.
  const compact = (pos, term) => pos.length === term.length && pos[pos.length - 1] - pos[0] <= term.length;

  // ---- The query ---------------------------------------------------------------------------------

  // The words of the query: [{ text, exact, not }]. Signs between letters separate words.
  function parseQuery(query) {
    const out = [];
    for (const part of String(query || '').trim().split(/\s+/)) {
      const not = part.startsWith('!');
      const exact = !not && part.startsWith("'");
      const words = tokens(not || exact ? part.slice(1) : part).map((w) => w.slice(0, MAX_TERM));
      if (exact && words.length) out.push({ text: words.join(' '), exact: true, not: false });
      else for (const w of words) out.push({ text: w, exact: false, not });
    }
    return out.slice(0, 8);
  }

  // How a word of the query matches an entry: { score, how } or null. how: 'title', 'path', 'words'
  // or 'typo'. pass2: also a word inside a word, and errors.
  function matchTerm(t, e, pass2) {
    if (t.exact) {
      const a = together(t.text, e.fTitle);
      if (a) return { score: a.score * W_TITLE, how: 'title' };
      const p = together(t.text, e.fPath);
      return p ? { score: p.score * W_PATH, how: 'path' } : null;
    }
    let best = null;
    const take = (score, how) => {
      if (!best || score > best.score) best = { score, how };
    };
    const a = fuzzy(t.text, e.fTitle, true, false);
    if (a) take(a.score * W_TITLE, 'title');
    const p = fuzzy(t.text, e.fPath, true, false);
    if (p) take(p.score * W_PATH, 'path');
    if (t.text.length >= 3 && e.words.some((w) => w.startsWith(t.text))) take(togetherScore(t.text.length, BONUS_WHITE) * W_WORDS, 'words');
    if (best || !pass2) return best;
    // Second pass. A word inside a word, or with one letter more in the text: only with 3 letters
    // or more.
    if (t.text.length >= 3) {
      for (const [f, w, how] of [[e.fTitle, W_TITLE, 'title'], [e.fPath, W_PATH, 'path']]) {
        const r = fuzzy(t.text, f, false, true);
        if (r && compact(r.pos, t.text)) take(r.score * w * W_INSIDE, how);
      }
      if (best) return best;
    }
    const max = typosAllowed(t.text);
    if (!max) return null;
    for (const w of e.typoWords) {
      const d = prefixDistance(t.text, w, max);
      if (d !== Infinity) take(togetherScore(t.text.length, BONUS_WHITE) * W_TYPO - d * SCORE_MATCH, 'typo');
    }
    return best;
  }

  // The score of an entry for the query, and how each word matches: { score, hows } or null.
  function scoreEntry(e, terms, query, pass2) {
    let score = TYPE_BONUS[e.type] || 0;
    const hows = [];
    for (const t of terms) {
      if (t.not) {
        if (e.fPath.text.includes(t.text) || e.words.some((w) => w.startsWith(t.text))) return null;
        hows.push(null);
        continue;
      }
      const m = matchTerm(t, e, pass2);
      if (!m) return null;
      score += m.score;
      hows.push(m.how);
    }
    // The full query at the start of the title, or the full title.
    if (query && e.fTitle.text.startsWith(query)) score += e.fTitle.text.length === query.length ? 40 : 20;
    return { score, hows };
  }

  // ---- The parts that match, to show them ------------------------------------------------------

  // A text without case and accents, with the position of each character in the original text.
  function fold(s) {
    let text = '';
    const at = [];
    for (let i = 0; i < s.length; ) {
      const ch = String.fromCodePoint(s.codePointAt(i));
      const n = MAK.normalizeText(ch);
      for (let k = 0; k < n.length; k++) {
        text += n[k];
        at.push([i, i + ch.length]);
      }
      i += ch.length;
    }
    return { text, b: bonusesOf(text), at };
  }

  // The positions (in the folded text) where a word of the query matches.
  function positionsOf(t, f) {
    if (t.exact) return (together(t.text, f) || {}).pos || [];
    const strict = fuzzy(t.text, f, true, true);
    if (strict) return strict.pos;
    const inside = t.text.length >= 3 ? fuzzy(t.text, f, false, true) : null;
    if (inside && compact(inside.pos, t.text)) return inside.pos;
    // A word with errors: the start of the word, with the length of the word of the query.
    const max = typosAllowed(t.text);
    if (!max) return [];
    for (const m of f.text.matchAll(/[\p{L}\p{N}]+/gu)) {
      if (prefixDistance(t.text, m[0], max) !== Infinity) return Array.from({ length: Math.min(t.text.length, m[0].length) }, (_, i) => m.index + i);
    }
    return [];
  }

  // [[start, end], …] in the original text, from positions in the folded text.
  const rangesOf = (f, positions) => merge(positions.filter((p) => f.at[p]).map((p) => [...f.at[p]]));

  // The parts of the title and of the site that match: { hl, siteHl }. hows: how each word of the
  // query matches (scoreEntry). A word that matches "site / folder / title" can match a part of the
  // site and a part of the title.
  function highlight(e, terms, hows) {
    const title = fold(e.title.slice(0, MAX_TEXT));
    const site = fold(e.type === 'site' ? '' : e.site.slice(0, MAX_TEXT));
    const hl = [];
    const siteHl = [];
    let path = null;
    terms.forEach((t, i) => {
      const how = hows[i];
      if (!how || how === 'words') return;
      if (how === 'path') {
        path = path || fold(e.pathText.slice(0, 2 * MAX_TEXT));
        const titleAt = e.pathText.length - e.title.length;
        for (const [s, end] of rangesOf(path, positionsOf(t, path))) {
          if (end <= e.site.length && e.type !== 'site') siteHl.push([s, end]);
          else if (s >= titleAt) hl.push([s - titleAt, end - titleAt]);
        }
        return;
      }
      const inTitle = positionsOf(t, title);
      if (inTitle.length) hl.push(...rangesOf(title, inTitle));
      else siteHl.push(...rangesOf(site, positionsOf(t, site)));
    });
    return { hl: merge(hl), siteHl: merge(siteHl) };
  }

  // Ranges in order, without overlaps.
  function merge(ranges) {
    const out = [];
    for (const [s, e] of ranges.sort((a, b) => a[0] - b[0])) {
      const last = out[out.length - 1];
      if (last && s <= last[1]) last[1] = Math.max(last[1], e);
      else out.push([s, e]);
    }
    return out;
  }

  // ---- The index ---------------------------------------------------------------------------------

  // "Apuntes / Tema 3" for a file in the folders "Apuntes" and "Tema 3".
  function folderOf(url, siteId) {
    try {
      const path = new URL(url).pathname;
      const base = CONTENT + encodeURIComponent(siteId) + '/';
      if (!path.startsWith(base)) return '';
      const parts = path.slice(base.length).split('/').filter(Boolean);
      return parts
        .slice(0, -1)
        .map((p) => {
          try {
            return decodeURIComponent(p);
          } catch {
            return p;
          }
        })
        .join(' / ');
    } catch {
      return '';
    }
  }

  // d: the stored data. Hidden sites ("everywhere") are not in the index.
  MAK.buildSearchIndex = function (d, settings) {
    const hidden = MAK.hiddenEverywhere(settings);
    const sites = MAK.namedSites(d.sites, settings).filter((s) => !hidden.has(s.id));
    const byId = new Map(sites.map((s) => [s.id, s]));
    const pages = d.pages || {};
    const out = [];
    const add = (type, siteId, title, url, more) => {
      const site = byId.get(siteId);
      if (!site || !title || !url) return;
      const e = Object.assign({ type, siteId, site: site.title, title, url, meta: '', time: 0, extra: '' }, more);
      e.pathText = type === 'site' ? title : [site.title, type === 'file' || type === 'forum' || type === 'lesson' ? e.meta : '', title].filter(Boolean).join(' / ');
      e.fTitle = field(title);
      e.fPath = field(e.pathText);
      // Only the start of these words: the full name of the site ("26_0_240504_1 ANÁLISIS…"), the
      // folder or forum, and the text of an event or an announcement.
      e.words = [...new Set(tokens([site.fullTitle, e.meta, e.extra].join(' ')))];
      e.typoWords = [...new Set(tokens([title, site.title, e.meta].join(' ')))];
      out.push(e);
    };
    for (const s of sites) {
      add('site', s.id, s.title, MAK.siteUrl(s.id), { meta: s.fullTitle !== s.title ? s.fullTitle : '' });
      for (const p of (pages[s.id] && pages[s.id].nav) || []) add('tool', s.id, p.title, p.url);
      const res = d[MAK.resourceKey(s.id)];
      for (const r of (res && res.items) || []) if (!r.folder) add('file', s.id, r.title, r.link || r.url, { meta: folderOf(r.url, s.id), time: r.modified || 0 });
      const lessonsUrl = MAK.toolUrl(pages, s.id, 'sakai.lessonbuildertool');
      for (const it of (d.lessons && d.lessons[s.id] && d.lessons[s.id].items) || []) add('lesson', s.id, it.title, MAK.safeHttpUrl(it.url) || lessonsUrl, { meta: it.path || '' });
      const forumUrl = MAK.toolUrl(pages, s.id, 'sakai.forums');
      for (const tp of (d.forums && d.forums[s.id] && d.forums[s.id].topics) || []) add('forum', s.id, tp.title, forumUrl, { meta: tp.forum || '' });
    }
    for (const a of d.assignments || []) add('delivery', a.siteId, a.title, MAK.deliveryUrl(a, pages), { time: a.due || 0 });
    for (const e of d.events || []) {
      if (!e.assignmentId) add('event', e.siteId, e.title, MAK.toolUrl(pages, e.siteId, 'sakai.schedule'), { time: e.start || 0, extra: e.text || '' });
    }
    for (const a of d.announcements || []) add('announcement', a.siteId, a.title, MAK.announcementUrl(a, pages, null), { time: a.created || 0, extra: (a.text || '').slice(0, 300) });
    for (const g of d.grades || []) add('grade', g.siteId, g.name, g.url || MAK.siteUrl(g.siteId));
    return out;
  };

  const result = (e, terms, hows) => Object.assign({ type: e.type, siteId: e.siteId, site: e.site, title: e.title, url: e.url, meta: e.meta, time: e.time }, highlight(e, terms, hows || []));

  // The best entries for the query (see the top of this file). An empty query gives the sites.
  // The order: the score; then sites and tools before the other types; then the newest; then the
  // shorter title.
  MAK.searchIndex = function (index, query, limit) {
    const max = limit || 30;
    const terms = parseQuery(query);
    if (!terms.length) return String(query || '').trim() ? [] : index.filter((e) => e.type === 'site').slice(0, max).map((e) => result(e, []));
    if (!terms.some((t) => !t.not)) return [];
    const full = terms.filter((t) => !t.not).map((t) => t.text).join(' ');
    const order = (a, b) => b.score - a.score || RANK[a.e.type] - RANK[b.e.type] || b.e.time - a.e.time || a.e.title.length - b.e.title.length;
    const run = (list, pass2) => {
      const hits = [];
      for (const e of list) {
        const s = scoreEntry(e, terms, full, pass2);
        if (s) hits.push(Object.assign(s, { e }));
      }
      return hits.sort(order);
    };
    let hits = run(index, false);
    if (!hits.length) hits = run(index, true);
    return hits.slice(0, max).map((x) => result(x.e, terms, x.hows));
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
