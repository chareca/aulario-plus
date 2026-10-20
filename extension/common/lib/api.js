// Aulario Plus: one function for each MiAulario endpoint, and the functions that trim
// the data of these endpoints.
// Each GET adds "auto=true". Sakai then does not record the request as user activity.
// Only the keep-alive ping records activity. One exception: the portal ignores "auto=true" for the
// Gradebook page. The popup reads that page only when the user clicks "Calculate".
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

    async function getHtml(path) {
      const sep = path.includes('?') ? '&' : '?';
      const res = await request(path + sep + 'auto=true');
      const type = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
      if (!/html/i.test(type)) throw new ApiError('not-html', path, res.status);
      return res.text();
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
      grades: () => getJson('/api/users/me/grades', 'grades'),
      // The pages of the tool Lessons ("Contenidos") of a site, and the tree of one page.
      lessons: (siteId) => getJson(`/direct/lessons/site/${enc(siteId)}.json`, 'lessons_collection'),
      lesson: (id) => getJson(`/direct/lessons/lesson/${enc(id)}.json`),
      // The Gradebook page of a site (HTML), for the grade calculator. This request is user activity.
      gradebook: (placement) => getHtml(`/portal/tool/${enc(placement)}`),
      // Mark the notifications of one tool in one site as viewed (the bell in MiAulario).
      markViewed: async (siteId, toolId) => {
        await request(`/api/users/me/notifications/markViewed?siteId=${enc(siteId)}&toolId=${enc(toolId)}`, { method: 'POST' });
        return true;
      }
    };
  };

  // ---- Trim the API data -----------------------------------------------------
  // Keep only the fields that the extension uses, with safe types and safe URLs.

  // Sakai also makes submissions that the student did not make: "submitted" without
  // "userSubmission". It makes one when the student accepts the honor pledge ("Cláusula de veracidad
  // aceptada": the task is open, nothing is sent), one for each student of a task without an online
  // submission (to give the grades), and one for a grade without a submission. Only a submission of
  // the student counts as "submitted". Without the field "userSubmission" (an old submission),
  // "submitted" counts.
  const byStudent = (s) => s && s.userSubmission !== false;

  function summarizeSubmissions(subs) {
    const list = Array.isArray(subs) ? subs : [];
    const mine = list.find((s) => s && s.userSubmission) || list[0] || {};
    return {
      submitted: list.some((s) => byStudent(s) && s.submitted && !s.draft),
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

  // home: the id of the first page ("Inicio"). guide: the page "Guía docente" (a "Web content"
  // tool with the public guide of the UPNA, lib/guide.js).
  MAK.trimPages = function (pages, at) {
    const out = { at, tools: {}, pageTools: {}, placements: {}, nav: [], home: null, guide: null };
    for (const p of Array.isArray(pages) ? pages : []) {
      const pageUrl = MAK.safeSiteUrl(p.url);
      if (pageUrl && p.title) out.nav.push({ title: String(p.title), url: pageUrl }); // the menu of the site, for the search
      if (out.home === null && p.id) out.home = String(p.id);
      const ids = [];
      for (const t of Array.isArray(p.tools) ? p.tools : []) {
        if (!t || !t.toolId) continue;
        ids.push(t.toolId);
        if (t.id) out.placements[t.id] = t.toolId;
        if (!out.tools[t.toolId]) out.tools[t.toolId] = { page: pageUrl, placement: t.id || null };
        if (!out.guide && t.id && t.toolId === 'sakai.iframe' && /gu[ií]a\s*docente|teaching\s*guide|irakaskuntza[-\s]*gida/i.test(`${p.title || ''} ${t.title || ''}`)) out.guide = { page: pageUrl, placement: String(t.id) };
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

  // ---- Lessons ("Contenidos") -------------------------------------------------------
  // The search finds the parts of the pages of Lessons: the subpages, the files and links, and the
  // titles and links in the text blocks (many teachers put all the material in text blocks: "Tema 1",
  // a link to the PDF). Each part: { title, url (null: the page of the tool), path, kind }.
  const LESSON = { RESOURCE: 1, PAGE: 2, TEXT: 5, URL: 6, MULTIMEDIA: 7 };
  const MAX_LESSON_ITEMS = 300;
  const oneLine = (html) => MAK.htmlToText(html).replace(/\s+/g, ' ').trim().slice(0, 150);

  // The titles and the links of a text block, in their order.
  function textParts(html) {
    const out = [];
    const re = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1\s*>|<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a\s*>/gi;
    for (let m; (m = re.exec(String(html || '')));) {
      if (m[1]) out.push({ heading: oneLine(m[2]) });
      else out.push({ href: MAK.htmlToText(m[3] !== undefined ? m[3] : m[4]).trim(), text: oneLine(m[5]) });
    }
    return out;
  }

  // An address of a link: http(s), or a path of MiAulario.
  function lessonUrl(href) {
    const s = String(href || '').trim();
    if (s.startsWith('/')) return MAK.safeSiteUrl(MAK.BASE + s);
    return MAK.safeHttpUrl(s);
  }

  // The parts of the tree of a page of Lessons (/direct/lessons/lesson/{id}). title: the name of the
  // page in the list of the site.
  MAK.trimLessonTree = function (tree, title) {
    const out = [];
    const add = (part) => { if (out.length < MAX_LESSON_ITEMS && part.title) out.push(part); };
    const walk = (node, path) => {
      let heading = '';
      for (const it of (node && Array.isArray(node.contentsList) ? node.contentsList : [])) {
        if (!it || typeof it !== 'object') continue;
        const where = [path, heading].filter(Boolean).join(' › ');
        const name = String(it.name || '').trim().slice(0, 150);
        if (it.type === LESSON.PAGE) {
          add({ title: name, url: null, path, kind: 'page' });
          walk(it, [path, name].filter(Boolean).join(' › '));
        } else if (it.type === LESSON.TEXT) {
          for (const p of textParts(it.html)) {
            if (p.heading) {
              heading = p.heading;
              add({ title: heading, url: null, path, kind: 'heading' });
            } else {
              const url = lessonUrl(p.href);
              if (url) add({ title: p.text || url, url, path: [path, heading].filter(Boolean).join(' › '), kind: 'link' });
            }
          }
        } else if (it.type === LESSON.RESOURCE || it.type === LESSON.URL || it.type === LESSON.MULTIMEDIA) {
          const id = String(it.sakaiId || '');
          const url = lessonUrl(it.url) || (/^\/(group|user)\//.test(id) ? MAK.safeSiteUrl(`${MAK.BASE}/access/content${id.split('/').map(encodeURIComponent).join('/')}`) : null);
          add({ title: name, url, path: where, kind: 'link' });
        } else if (name) {
          add({ title: name, url: null, path: where, kind: 'item' });
        }
      }
    };
    walk(tree, String(title || '').trim().slice(0, 150));
    return out;
  };

  MAK.trimSite = function (s) {
    return { id: String(s.id), title: String(s.title || s.id), type: String(s.type || '') };
  };

  // A calendar event (/direct/calendar/my.json).
  MAK.trimEvent = function (e) {
    return {
      id: String(e.eventId || e.id || ''),
      title: String(e.title || ''),
      text: MAK.htmlToText(e.description).slice(0, 1000),
      type: String(e.type || ''),
      start: MAK.toMs(e.firstTime),
      duration: Number(e.duration) || 0,
      siteId: String(e.siteId || ''),
      siteTitle: String(e.siteName || ''),
      assignmentId: e.assignmentId ? String(e.assignmentId) : null
    };
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

  // A grade item of the user. An item where the user can grade (a teacher role) is not a grade
  // of the user: return null.
  MAK.trimGrade = function (g) {
    if (!g || g.canGrade) return null;
    const score = String(g.score === null || g.score === undefined ? '' : g.score).trim();
    return {
      id: String(g.id),
      siteId: String(g.siteId || ''),
      siteTitle: String(g.siteTitle || ''),
      name: String(g.name || ''),
      score,
      graded: !g.notGradedYet && score !== '',
      url: MAK.safeSiteUrl(g.url)
    };
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
