// MiAulario Keep-Alive: one function for each MiAulario endpoint.
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

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
