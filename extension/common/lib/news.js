// MiAulario Keep-Alive: "new since your last visit", for each site separately.
//
// visits[siteId] = { last, previous }
//   last:     the time of the last page of the site that the user opened
//   previous: the time of the visit before the current visit
// A new visit starts if more than 30 minutes passed after "last".
// The popup shows the items newer than "last". The banner in the site shows the items newer
// than "previous" (the items that came after the previous visit).
// Before the first visit of a site, the reference time is the install time.
//
// forumSnap[siteId] = { last: {topicId: total}, previous: {topicId: total} }
// The total number of posts of each topic at the start of the last and the previous visit.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  MAK.VISIT_GAP_MS = 30 * MAK.MINUTE;

  // Record one page of a site. Return the new visits object, whether a new visit started,
  // and the reference time for the banner.
  MAK.recordVisit = function (visits, siteId, now, baseline) {
    const all = Object.assign({}, visits);
    const v = all[siteId];
    let isNew;
    let since;
    if (!v) {
      isNew = true;
      since = baseline;
      all[siteId] = { previous: baseline, last: now };
    } else if (now - v.last > MAK.VISIT_GAP_MS) {
      isNew = true;
      since = v.last;
      all[siteId] = { previous: v.last, last: now };
    } else {
      isNew = false;
      since = v.previous;
      all[siteId] = { previous: v.previous, last: now };
    }
    return { visits: all, isNew, since };
  };

  // The user marks a site as seen: nothing before now is new, also in the banner of this visit.
  MAK.markSeen = function (visits, siteId, now) {
    return Object.assign({}, visits, { [siteId]: { previous: now, last: now } });
  };

  // Totals of the forum topics of a site.
  MAK.forumTotals = function (forumsOfSite) {
    const out = {};
    for (const tp of (forumsOfSite && forumsOfSite.topics) || []) out[tp.id] = tp.total || 0;
    return out;
  };

  // Shift the forum snapshot at the start of a new visit.
  MAK.shiftForumSnap = function (snap, siteId, totals) {
    const cur = (snap && snap[siteId]) || {};
    return Object.assign({}, snap, { [siteId]: { previous: cur.last || totals, last: totals } });
  };

  const newer = (serverTime, seen) => Math.max(serverTime || 0, seen || 0);

  // The items of one site that are newer than "since".
  // forumBase: {topicId: total} at the reference time, or null (then no forum news).
  MAK.newSince = function ({ siteId, since, resources, announcements, assignments, forums, forumBase, pages, now }) {
    const out = { files: [], announcements: [], deliveries: [], forums: [], total: 0 };
    const ref = since || 0;

    for (const r of (resources && resources.items) || []) {
      if (r.folder) continue;
      const time = newer(r.modified, r.seen);
      if (time <= ref) continue;
      out.files.push({ title: r.title, url: r.link || r.url, time, label: r.seen > ref ? 'new' : 'updated' });
    }

    for (const a of announcements || []) {
      if (a.siteId !== siteId) continue;
      const time = newer(a.created, a.seen);
      if (time <= ref) continue;
      out.announcements.push({ id: a.id, title: a.title, url: MAK.announcementUrl(a, pages, null), time });
    }

    for (const a of assignments || []) {
      if (a.siteId !== siteId) continue;
      if (a.open && a.open > now) continue; // not open yet
      const time = newer(Math.max(a.created || 0, a.open || 0), a.seen);
      if (time <= ref) continue;
      out.deliveries.push({ id: a.id, title: a.title, url: MAK.deliveryUrl(a, pages), due: a.due, time });
    }

    if (forumBase) {
      const forumUrl = MAK.toolUrl(pages, siteId, 'sakai.forums');
      for (const tp of (forums && forums.topics) || []) {
        const before = Object.prototype.hasOwnProperty.call(forumBase, tp.id) ? forumBase[tp.id] : 0;
        const delta = (tp.total || 0) - before;
        if (delta > 0) out.forums.push({ id: tp.id, title: tp.title, delta, url: forumUrl });
      }
    }

    const byTime = (x, y) => y.time - x.time;
    out.files.sort(byTime);
    out.announcements.sort(byTime);
    out.deliveries.sort(byTime);
    out.total = out.files.length + out.announcements.length + out.deliveries.length + out.forums.reduce((n, f) => n + f.delta, 0);
    return out;
  };

  // "New since the last visit" for all the visible sites, for the popup. Sites without news are left out.
  MAK.buildNews = function (d, now) {
    const settings = MAK.withDefaults(d.settings);
    const hidden = MAK.hiddenEverywhere(settings);
    const baseline = (d.meta && d.meta.installedAt) || now;
    const out = [];
    for (const s of d.sites || []) {
      if (hidden.has(s.id)) continue;
      const v = (d.visits || {})[s.id];
      const since = v ? v.last : baseline;
      const snap = (d.forumSnap || {})[s.id];
      const news = MAK.newSince({
        siteId: s.id,
        since,
        resources: d[MAK.resourceKey(s.id)],
        announcements: d.announcements,
        assignments: d.assignments,
        forums: (d.forums || {})[s.id],
        forumBase: snap ? snap.last : null,
        pages: d.pages,
        now
      });
      if (news.total) out.push(Object.assign({ siteId: s.id, siteTitle: s.title, since, visited: !!v }, news));
    }
    out.sort((x, y) => y.total - x.total);
    return out;
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
