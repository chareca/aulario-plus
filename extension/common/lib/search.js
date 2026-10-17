// Aulario Plus: the search in all the sites. The index has one entry for each site, page (tool),
// delivery, calendar event, file, announcement, grade item and forum topic. It uses only the
// stored data: the search sends no requests.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  MAK.SEARCH_TYPES = ['site', 'tool', 'delivery', 'event', 'file', 'announcement', 'grade', 'forum'];
  const RANK = Object.fromEntries(MAK.SEARCH_TYPES.map((type, i) => [type, i]));
  const CONTENT = '/access/content/group/';
  // The words of a text, without case and accents: "Tema 2 - Integrales.pdf" -> tema, 2, integrales, pdf.
  const tokens = (text) => MAK.normalizeText(text).split(/[^a-z0-9]+/).filter(Boolean);

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
      e.titleWords = tokens(title);
      e.words = [...new Set(tokens([title, site.title, site.fullTitle, e.meta, e.extra].join(' ')))];
      out.push(e);
    };
    for (const s of sites) {
      add('site', s.id, s.title, MAK.siteUrl(s.id), { meta: s.fullTitle !== s.title ? s.fullTitle : '' });
      for (const p of (pages[s.id] && pages[s.id].nav) || []) add('tool', s.id, p.title, p.url);
      const res = d[MAK.resourceKey(s.id)];
      for (const r of (res && res.items) || []) if (!r.folder) add('file', s.id, r.title, r.link || r.url, { meta: folderOf(r.url, s.id), time: r.modified || 0 });
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

  // The entries where each word of the query is the start of a word (case and accents are not
  // important): "inf rec" finds the tool "Recursos" of "Informática". The best first: a word at
  // the start of the title, then in the title; then sites and tools before the other types;
  // then the newest.
  MAK.searchIndex = function (index, query, limit) {
    const words = tokens(query);
    if (!words.length) return [];
    const starts = (list, w) => list.some((x) => x.startsWith(w));
    const hits = [];
    for (const e of index) {
      if (!words.every((w) => starts(e.words, w))) continue;
      let score = 0;
      for (const w of words) {
        if (e.titleWords[0] && e.titleWords[0].startsWith(w)) score += 3;
        else if (starts(e.titleWords, w)) score += 2;
      }
      hits.push([score, e]);
    }
    hits.sort((a, b) => b[0] - a[0] || RANK[a[1].type] - RANK[b[1].type] || b[1].time - a[1].time);
    return hits.slice(0, limit || 30).map(([, e]) => ({ type: e.type, siteId: e.siteId, site: e.site, title: e.title, url: e.url, meta: e.meta, time: e.time }));
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
