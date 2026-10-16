// MiAulario Keep-Alive: one function for each MiAulario endpoint, and the functions that trim
// the data of these endpoints.
// Each GET adds "auto=true". Sakai then does not record the request as user activity.
// Only the keep-alive ping records activity.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  class ApiError extends Error {
    constructor(kind, path, status) {
      super(`${kind} ${status || ''} ${path}`.trim());
      this.kind = kind; // 'http', 'network', 'not-json', 'shape'
      this.path = path;
      this.status = status || 0;
    }
    // True if the server is busy or has a problem. Then the sync waits longer.
    get retryLater() {
      return this.status === 429 || this.status >= 500;
    }
  }
  MAK.ApiError = ApiError;

  // Find the array in a response. Sakai uses "<name>_collection" or a plain array.
  function pickArray(data, key) {
    if (Array.isArray(data)) return data;
    if (data && key && Array.isArray(data[key])) return data[key];
    if (data && typeof data === 'object') {
      const arr = Object.values(data).find(Array.isArray);
      if (arr) return arr;
    }
    return null;
  }
  MAK.pickArray = pickArray;

  const enc = encodeURIComponent;

  MAK.createApi = function (options) {
    const doFetch = options.fetch;
    const base = options.base || MAK.BASE;

    async function request(path, init) {
      let res;
      try {
        res = await doFetch(base + path, Object.assign({ credentials: 'include', cache: 'no-store' }, init));
      } catch (e) {
        throw new ApiError('network', path);
      }
      if (!res.ok) throw new ApiError('http', path, res.status);
      return res;
    }

    async function getJson(path, arrayKey) {
      const sep = path.includes('?') ? '&' : '?';
      const res = await request(path + sep + 'auto=true');
      const type = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
      if (!/json/i.test(type)) throw new ApiError('not-json', path, res.status);
      let data;
      try { data = await res.json(); } catch { throw new ApiError('not-json', path, res.status); }
      if (arrayKey === undefined) return data;
      const arr = pickArray(data, arrayKey);
      if (!arr) throw new ApiError('shape', path, res.status);
      return arr;
    }

    return {
      session: () => getJson('/direct/session/current.json'),
      sites: () => getJson('/direct/site.json?_limit=200', 'site_collection'),
      pages: (siteId) => getJson(`/direct/site/${enc(siteId)}/pages.json`, null),
      assignments: () => getJson('/direct/assignment/my.json', 'assignment_collection'),
      announcements: (n, days) => getJson(`/direct/announcement/user.json?n=${n}&d=${days}`, 'announcement_collection'),
      notifications: () => getJson('/api/users/me/notifications', null),
      synoptic: () => getJson('/direct/synopticmsgcntritem.json', 'synopticmsgcntritem_collection'),
      forums: (siteId) => getJson(`/direct/forums/site/${enc(siteId)}.json`, 'forums_collection'),
      forum: (siteId, forumId) => getJson(`/direct/forums/site/${enc(siteId)}/forum/${enc(forumId)}.json`),
      resources: (siteId) => getJson(`/direct/content/site/${enc(siteId)}.json`, 'content_collection'),
      calendar: (fromYmd, toYmd) => getJson(`/direct/calendar/my.json?firstDate=${fromYmd}&lastDate=${toYmd}`, 'calendar_collection'),
      // Mark the notifications of one tool in one site as viewed (the bell in MiAulario).
      markViewed: async (siteId, toolId) => {
        await request(`/api/users/me/notifications/markViewed?siteId=${enc(siteId)}&toolId=${enc(toolId)}`, { method: 'POST' });
        return true;
      }
    };
  };

  // ---- Trim the API data -----------------------------------------------------
  // Keep only the fields that the extension uses, with safe types and safe URLs.

  function summarizeSubmissions(subs) {
    const list = Array.isArray(subs) ? subs : [];
    const mine = list.find((s) => s && s.userSubmission) || list[0] || {};
    return {
      submitted: list.some((s) => s && s.submitted && !s.draft),
      draft: list.some((s) => s && s.draft),
      returned: list.some((s) => s && s.returned),
      graded: list.some((s) => s && s.graded),
      canSubmit: typeof mine.canSubmit === 'boolean' ? mine.canSubmit : null
    };
  }

  MAK.trimAssignment = function (a) {
    return {
      id: String(a.id),
      siteId: String(a.context || ''),
      title: String(a.title || ''),
      type: String(a.submissionType || ''),
      status: String(a.status || ''),
      open: MAK.toMs(a.openTime),
      due: MAK.toMs(a.dueTime),
      close: MAK.toMs(a.closeTime),
      created: MAK.toMs(a.timeCreated),
      sub: summarizeSubmissions(a.submissions)
    };
  };

  MAK.trimAnnouncement = function (a) {
    const attachments = (Array.isArray(a.attachments) ? a.attachments : [])
      .map((x) => ({ name: String((x && x.name) || 'file'), url: MAK.safeSiteUrl(x && x.url) }))
      .filter((x) => x.url)
      .slice(0, 10);
    return {
      id: String(a.id),
      uuid: String(a.announcementId || String(a.id).split(':').pop()),
      channel: String(a.channel || 'main'),
      siteId: String(a.siteId || ''),
      siteTitle: String(a.siteTitle || ''),
      title: String(a.title || ''),
      author: String(a.createdByDisplayName || ''),
      created: MAK.toMs(a.createdOn),
      text: MAK.htmlToText(a.body).slice(0, 2000),
      attachments
    };
  };

  MAK.trimNotification = function (n) {
    return {
      id: n.id,
      event: String(n.event || ''),
      ref: String(n.ref || ''),
      viewed: !!n.viewed,
      siteId: String(n.siteId || ''),
      tool: String(n.tool || ''),
      url: MAK.safeSiteUrl(n.url),
      date: MAK.toMs(n.eventDate),
      title: String(n.title || '')
    };
  };

  MAK.trimPages = function (pages, at) {
    const out = { at, tools: {}, pageTools: {}, placements: {} };
    for (const p of Array.isArray(pages) ? pages : []) {
      const pageUrl = MAK.safeSiteUrl(p.url);
      const ids = [];
      for (const t of Array.isArray(p.tools) ? p.tools : []) {
        if (!t || !t.toolId) continue;
        ids.push(t.toolId);
        if (t.id) out.placements[t.id] = t.toolId;
        if (!out.tools[t.toolId]) out.tools[t.toolId] = { page: pageUrl, placement: t.id || null };
      }
      if (p.id) out.pageTools[p.id] = ids;
    }
    return out;
  };

  const CONTENT_PREFIX = '/access/content/group/';

  MAK.trimResource = function (r, siteId) {
    const url = MAK.safeSiteUrl(r.url);
    if (!url) return null;
    const path = new URL(url).pathname;
    const base = CONTENT_PREFIX + encodeURIComponent(siteId) + '/';
    if (!path.startsWith(CONTENT_PREFIX) || path === base || path === CONTENT_PREFIX + siteId + '/') return null;
    const folder = r.type === 'collection';
    return {
      url,
      title: String(r.title || ''),
      type: String(r.type || ''),
      size: Number(r.size) || 0,
      modified: MAK.toMs(r.modifiedDate),
      folder,
      link: r.type === 'text/url' ? MAK.safeHttpUrl(r.webLinkUrl) : null,
      copyright: !!r.copyrightAlert // MiAulario asks to accept a copyright notice before the download
    };
  };

  MAK.trimSite = function (s) {
    return { id: String(s.id), title: String(s.title || s.id), type: String(s.type || '') };
  };

  MAK.trimSynoptic = function (x) {
    return { siteId: String(x.siteId || ''), messages: Number(x.newMessagesCount) || 0, forums: Number(x.newForumCount) || 0 };
  };

  MAK.trimTopic = function (tp, forum) {
    return {
      id: String(tp.id),
      forumId: String(forum.id),
      forum: String(forum.title || ''),
      title: String(tp.title || ''),
      read: Number(tp.readMessages) || 0,
      total: Number(tp.totalMessages) || 0,
      modified: MAK.toMs(tp.modifiedDate)
    };
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
