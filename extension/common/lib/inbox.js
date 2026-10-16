// MiAulario Keep-Alive: the unified inbox model.
// Announcements: the read state comes from the bell notifications of MiAulario ("viewed")
// and from the local read list of the extension. An announcement without a notification
// is unread until the user reads it.
// Messages and forums: MiAulario gives only the unread counts (per site and per topic).
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  MAK.ANN_TOOL = 'sakai.announcements';

  // Map: announcement uuid -> its notification. The ref is "/announcement/msg/{site}/{channel}/{uuid}".
  MAK.annNotifications = function (notifications) {
    const map = new Map();
    for (const n of notifications || []) {
      if (!n || !String(n.event).startsWith('annc')) continue;
      const uuid = String(n.ref || '').split('/').pop();
      if (uuid) map.set(uuid, n);
    }
    return map;
  };

  MAK.isAnnUnread = function (a, readAnn, notifByUuid) {
    if (readAnn && readAnn[a.id]) return false;
    const n = notifByUuid && notifByUuid.get(a.uuid);
    return n ? !n.viewed : true;
  };

  // Link to one announcement. Use the direct link of the tool, then the notification link.
  MAK.announcementUrl = function (a, pages, notif) {
    const tool = pages && pages[a.siteId] && pages[a.siteId].tools[MAK.ANN_TOOL];
    if (tool && tool.placement) {
      const q = new URLSearchParams({ itemReference: `/announcement/msg/${a.siteId}/${a.channel || 'main'}/${a.uuid}`, sakai_action: 'doShowmetadata' });
      return MAK.safeSiteUrl(`/portal/directtool/${encodeURIComponent(tool.placement)}?${q}`);
    }
    return (notif && MAK.safeSiteUrl(notif.url)) || (tool && MAK.safeSiteUrl(tool.page)) || MAK.siteUrl(a.siteId);
  };

  function toolUrl(pages, siteId, toolId) {
    const tool = pages && pages[siteId] && pages[siteId].tools[toolId];
    return (tool && MAK.safeSiteUrl(tool.page)) || MAK.siteUrl(siteId);
  }

  // All the inbox items, newest first. Counts are for the unread items.
  MAK.buildInbox = function ({ announcements, notifications, readAnn, synoptic, forums, sites, pages, hidden }) {
    const hide = hidden || new Set();
    const titles = new Map((sites || []).map((s) => [s.id, s.title]));
    const notif = MAK.annNotifications(notifications);
    const items = [];
    const counts = { announcements: 0, messages: 0, forums: 0, total: 0 };

    for (const a of announcements || []) {
      if (hide.has(a.siteId)) continue;
      const unread = MAK.isAnnUnread(a, readAnn, notif);
      if (unread) counts.announcements++;
      items.push({
        type: 'announcement',
        key: `ann:${a.id}`,
        id: a.id,
        siteId: a.siteId,
        siteTitle: titles.get(a.siteId) || a.siteTitle || a.siteId,
        title: a.title,
        text: a.text,
        author: a.author,
        date: a.created,
        attachments: a.attachments || [],
        unread,
        url: MAK.announcementUrl(a, pages, notif.get(a.uuid))
      });
    }

    for (const x of synoptic || []) {
      if (hide.has(x.siteId) || !x.messages) continue;
      counts.messages += x.messages;
      items.push({
        type: 'messages',
        key: `msg:${x.siteId}`,
        siteId: x.siteId,
        siteTitle: titles.get(x.siteId) || x.siteId,
        count: x.messages,
        unread: true,
        date: null,
        url: toolUrl(pages, x.siteId, 'sakai.messages')
      });
    }

    // Forums: one item for each topic with unread posts. If the topics are not known,
    // one item for the site with the count of MiAulario.
    const topicSites = new Set();
    for (const [siteId, f] of Object.entries(forums || {})) {
      if (hide.has(siteId)) continue;
      topicSites.add(siteId);
      for (const tp of f.topics || []) {
        const n = Math.max(0, (tp.total || 0) - (tp.read || 0));
        if (!n) continue;
        counts.forums += n;
        items.push({
          type: 'forum',
          key: `forum:${siteId}:${tp.id}`,
          siteId,
          siteTitle: titles.get(siteId) || siteId,
          title: tp.title,
          forum: tp.forum,
          count: n,
          unread: true,
          date: tp.modified,
          url: toolUrl(pages, siteId, 'sakai.forums')
        });
      }
    }
    for (const x of synoptic || []) {
      if (hide.has(x.siteId) || !x.forums || topicSites.has(x.siteId)) continue;
      counts.forums += x.forums;
      items.push({
        type: 'forum',
        key: `forum:${x.siteId}`,
        siteId: x.siteId,
        siteTitle: titles.get(x.siteId) || x.siteId,
        title: null,
        count: x.forums,
        unread: true,
        date: null,
        url: toolUrl(pages, x.siteId, 'sakai.forums')
      });
    }

    counts.total = counts.announcements + counts.messages + counts.forums;
    // Messages and forums first (they need an action), then the newest items.
    const rank = { messages: 0, forum: 1, announcement: 2 };
    items.sort((x, y) => (rank[x.type] - rank[y.type]) || (y.date || 0) - (x.date || 0));
    return { items, counts };
  };

  // Filter: type ('' = all), siteId ('' = all), unreadOnly, query (no case, no accents).
  MAK.filterInbox = function (items, f) {
    const o = f || {};
    return items.filter((x) => {
      if (o.type && x.type !== o.type) return false;
      if (o.siteId && x.siteId !== o.siteId) return false;
      if (o.unreadOnly && !x.unread) return false;
      if (o.query) return MAK.matchesQuery([x.title, x.text, x.siteTitle, x.author, x.forum].filter(Boolean).join(' '), o.query);
      return true;
    });
  };

  // Sites where the extension must tell MiAulario that the announcements are read: no unread
  // announcement is left in the extension, and MiAulario has an announcement notification that is not viewed.
  MAK.sitesToMarkViewed = function ({ announcements, notifications, readAnn }, siteIds) {
    const notif = MAK.annNotifications(notifications);
    const out = [];
    for (const siteId of siteIds) {
      const left = (announcements || []).some((a) => a.siteId === siteId && MAK.isAnnUnread(a, readAnn, notif));
      const unviewed = (notifications || []).some((n) => n.siteId === siteId && n.tool === MAK.ANN_TOOL && !n.viewed);
      if (!left && unviewed) out.push(siteId);
    }
    return out;
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
