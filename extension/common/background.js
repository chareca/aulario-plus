// MiAulario Keep-Alive: background script (service worker in Chromium, event page in Firefox).
//
// 1. At a random interval of 3 to 10 minutes (in steps of 1 second), the script sends
//    GET /direct/session/current.json without "?auto=true". Sakai records this request
//    as activity and sets the inactivity timer (60 minutes) to zero.
// 2. The script changes the session cookies (SAKAISESSIONID, SERVERID, idpsession)
//    into persistent cookies. Then the cookies stay after you close the browser.
// 3. If you log out, the script pauses and removes these cookies. The script starts
//    again when you log in manually.

// Shared scripts. Chromium loads them here. Firefox loads them from the manifest.
// Keep this list the same as "background.scripts" in manifest.firefox.json.
if (typeof importScripts === 'function') {
  importScripts('lib/core.js', 'lib/store.js', 'lib/api.js', 'lib/grades.js', 'lib/sync.js', 'lib/i18n.js', 'lib/due.js', 'lib/inbox.js', 'lib/news.js');
}

const ext = globalThis.browser ?? globalThis.chrome;
const store = MAK.createStore(ext.storage.local);
const courseApi = MAK.createApi({ fetch: (url, init) => fetch(url, init) });
const sync = MAK.createSync({ api: courseApi, store, lockArea: ext.storage.session || null, onNewGrades: (list) => notifyNewGrades(list) });

const SESSION_URL = 'https://miaulario.unavarra.es/direct/session/current.json';
// The popup asks for a sync when the data is older than this.
const SYNC_FRESH_MS = 2 * MAK.MINUTE;
const PING_ALARM = 'miaulario-ping';
// Random interval between pings, in seconds. With the longest interval (10 minutes),
// 6 pings occur in the 60 minutes of inactivity that Sakai accepts.
const PING_MIN_SECONDS = 3 * 60;
const PING_MAX_SECONDS = 10 * 60;
const PERSIST_DAYS = 30;

// The cookies of the session, with the same flags that the server sets.
const COOKIE_SPECS = {
  'miaulario.unavarra.es': {
    url: 'https://miaulario.unavarra.es/',
    names: {
      SAKAISESSIONID: { path: '/', secure: true, httpOnly: true, sameSite: 'no_restriction' },
      SERVERID: { path: '/', secure: false, httpOnly: false, sameSite: 'lax' }
    }
  },
  'sso.unavarra.es': {
    url: 'https://sso.unavarra.es/',
    names: {
      idpsession: { path: '/', secure: true, httpOnly: true, sameSite: 'no_restriction', domain: 'sso.unavarra.es' }
    }
  }
};

async function getState() {
  const d = await ext.storage.local.get(['paused', 'autoLogin']);
  return { paused: !!d.paused, autoLogin: d.autoLogin !== false };
}

// The keep-alive request: without "auto=true", so Sakai records it as activity.
async function ping() {
  const { paused } = await getState();
  if (paused) {
    // The extension is paused after a manual logout. Only read the session (with "auto=true",
    // it does not reset the timer). If the user logged in again, continue.
    const session = await courseApi.session().catch(() => null);
    if (!session || !session.userId) return null;
    await store.set({ paused: false });
  }
  const last = { time: Date.now(), ok: false, status: 0, loggedIn: null };
  try {
    const r = await fetch(SESSION_URL, { cache: 'no-store', credentials: 'include' });
    const s = await r.json().catch(() => null);
    Object.assign(last, { status: r.status, ok: r.ok, loggedIn: !!(s && s.userId) });
  } catch (e) {
    last.error = String(e);
  }
  await store.set({ last });
  return last;
}

// ---- Persistent cookies ------------------------------------------------------

function specFor(cookie) {
  const spec = COOKIE_SPECS[cookie.domain.replace(/^\./, '')];
  const conf = spec && spec.names[cookie.name];
  return conf ? { url: spec.url, conf } : null;
}

async function persist(cookie) {
  const match = specFor(cookie);
  if (!match || cookie.expirationDate) return; // The cookie is persistent already, or it is not a session cookie.
  const { url, conf } = match;
  const details = {
    url,
    name: cookie.name,
    value: cookie.value,
    path: conf.path,
    secure: conf.secure,
    httpOnly: conf.httpOnly,
    sameSite: conf.sameSite,
    expirationDate: Math.floor(Date.now() / 1000) + PERSIST_DAYS * 86400
  };
  if (conf.domain) details.domain = conf.domain;
  if (cookie.storeId) details.storeId = cookie.storeId;
  try { await ext.cookies.set(details); } catch {}
}

async function clearPersisted() {
  for (const spec of Object.values(COOKIE_SPECS)) {
    for (const name of Object.keys(spec.names)) {
      try { await ext.cookies.remove({ url: spec.url, name }); } catch {}
    }
  }
}

ext.cookies.onChanged.addListener(async ({ cookie, removed }) => {
  if (removed || !specFor(cookie)) return;
  const { paused } = await getState();
  if (!paused) persist(cookie);
});

// At install or at browser start, change the cookies that exist into persistent cookies.
async function persistExisting() {
  const { paused } = await getState();
  if (paused) return;
  for (const spec of Object.values(COOKIE_SPECS)) {
    for (const name of Object.keys(spec.names)) {
      try {
        const c = await ext.cookies.get({ url: spec.url, name });
        if (c) await persist(c);
      } catch {}
    }
  }
}

// ---- Read state of announcements ----------------------------------------------

const MAX_IDS = 500;
const validIds = (ids) => (Array.isArray(ids) ? ids.filter((x) => typeof x === 'string' && x.length < 300).slice(0, MAX_IDS) : []);

async function knownSite(siteId) {
  const { sites } = await store.get('sites');
  return typeof siteId === 'string' && !MAK.isSpecialSite(siteId) && (sites || []).some((s) => s.id === siteId);
}

// Record the announcements as read in the extension only.
async function setAnnRead(ids) {
  const now = Date.now();
  await store.update('readAnn', (r) => {
    const out = Object.assign({}, r);
    for (const id of ids) out[id] = now;
    return out;
  });
}

// Mark announcements as read in the extension. Then tell MiAulario (the bell) for the sites
// where no unread announcement is left.
async function markAnnouncementsRead(ids) {
  if (!ids.length) return { ok: true, marked: 0 };
  await setAnnRead(ids);
  const { announcements } = await store.get('announcements');
  const siteIds = [...new Set((announcements || []).filter((a) => ids.includes(a.id)).map((a) => a.siteId))];
  await pushReadToServer(siteIds);
  return { ok: true, marked: ids.length };
}

// MiAulario can mark announcements as viewed only for a whole site and tool.
// If the request fails, keep it: a MiAulario page sends it later (same origin).
async function pushReadToServer(siteIds) {
  const d = await store.get(['announcements', 'notifications', 'readAnn']);
  for (const siteId of MAK.sitesToMarkViewed(d, siteIds)) {
    let ok = false;
    try {
      ok = await courseApi.markViewed(siteId, MAK.ANN_TOOL);
    } catch {
      ok = false;
    }
    if (ok) await markNotificationsViewed(siteId, MAK.ANN_TOOL);
    else await queuePending(siteId, MAK.ANN_TOOL);
  }
}

// Keep a "mark as viewed" request for later (one for each site and tool, 50 at most).
async function queuePending(siteId, toolId) {
  await store.update('pendingMarkViewed', (list) => {
    const rest = (list || []).filter((x) => x.siteId !== siteId || x.toolId !== toolId);
    return rest.concat({ siteId, toolId }).slice(-50);
  });
}

async function markNotificationsViewed(siteId, toolId) {
  await store.update('notifications', (list) => (list || []).map((n) => (n.siteId === siteId && n.tool === toolId ? Object.assign({}, n, { viewed: true }) : n)));
}

// ---- Badge on the toolbar icon -------------------------------------------------

const BADGE_KEYS = ['settings', 'meta', 'assignments', 'announcements', 'notifications', 'readAnn', 'synoptic', 'forums', 'sites', 'pages', 'grades', 'gradesSeenAt'];
const BADGE_RED = '#c5221f';
const BADGE_BLUE = '#1a5fb4';

// The number: deliveries not submitted that are late or due in 72 hours or less, plus the
// unread items of the selected kinds. Red if a delivery is late or due in less than 24 hours.
MAK.computeBadge = function (d, now) {
  const s = MAK.withDefaults(d.settings);
  if (!s.badge.enabled || !s.syncEnabled || !(d.meta && d.meta.lastSync)) return { text: '', color: BADGE_BLUE, soon: 0, unread: 0, grades: 0 };
  const hidden = MAK.hiddenEverywhere(s);
  let soon = 0;
  let urgent = false;
  if (s.badge.deliveries) {
    const due = MAK.buildDue({ assignments: d.assignments, sites: d.sites, pages: d.pages, hidden, now });
    soon = due.soon;
    urgent = due.urgent;
  }
  const c = MAK.buildInbox({ announcements: d.announcements, notifications: d.notifications, readAnn: d.readAnn, synoptic: d.synoptic, forums: d.forums, sites: d.sites, pages: d.pages, hidden }).counts;
  const unread = (s.badge.announcements ? c.announcements : 0) + (s.badge.messages ? c.messages : 0) + (s.badge.forums ? c.forums : 0);
  const grades = s.badge.grades ? MAK.unseenGrades(d.grades, d.gradesSeenAt, hidden).length : 0;
  const n = soon + unread + grades;
  return { text: n ? (n > 99 ? '99+' : String(n)) : '', color: urgent ? BADGE_RED : BADGE_BLUE, soon, unread, grades };
};

async function updateBadge() {
  const d = await store.get(BADGE_KEYS);
  const b = MAK.computeBadge(d, Date.now());
  MAK.setLang(MAK.withDefaults(d.settings).lang);
  try {
    await ext.action.setBadgeText({ text: b.text });
    await ext.action.setBadgeBackgroundColor({ color: b.color });
    if (ext.action.setBadgeTextColor) await ext.action.setBadgeTextColor({ color: '#ffffff' });
    await ext.action.setTitle({ title: b.text ? MAK.t('badge.title', { due: b.soon, unread: b.unread, grades: b.grades }) : MAK.t('app.title') });
  } catch {}
}

// ---- System notifications for new grades --------------------------------------

const GRADE_NOTE = 'grade:'; // one item: "grade:<id>"
const GRADES_NOTE = 'grades'; // a summary of 4 or more items
const GRADE_NOTE_MAX = 3;
const isGradeNote = (id) => id === GRADES_NOTE || id.startsWith(GRADE_NOTE);

// The notification shows the site and the item, but not the grade (other persons can see the screen).
async function notifyNewGrades(changed) {
  if (!ext.notifications) return;
  const { settings } = await store.get('settings');
  const s = MAK.withDefaults(settings);
  if (!s.notifyGrades) return;
  const hidden = MAK.hiddenEverywhere(s);
  const list = changed.filter((g) => !hidden.has(g.siteId));
  if (!list.length) return;
  MAK.setLang(s.lang);
  const notes =
    list.length <= GRADE_NOTE_MAX
      ? list.map((g) => [GRADE_NOTE + g.id, MAK.t('note.grade', { site: g.siteTitle }), g.name || MAK.t('tab.grades')])
      : [[GRADES_NOTE, MAK.t('note.grades', { n: list.length }), [...new Set(list.map((g) => g.siteTitle))].join(' · ')]];
  const iconUrl = ext.runtime.getURL('icons/icon128.png');
  for (const [id, title, message] of notes) {
    try {
      await ext.notifications.create(id, { type: 'basic', iconUrl, title, message });
    } catch {}
  }
}

async function clearGradeNotes() {
  if (!ext.notifications) return;
  try {
    const all = await ext.notifications.getAll();
    for (const id of Object.keys(all || {})) if (isGradeNote(id)) await ext.notifications.clear(id);
  } catch {}
}

// A click opens the item in MiAulario, or the Grades tab for a summary. The URL comes from the
// storage, because the background script can start again between the notification and the click.
async function openGradeNote(id) {
  if (!isGradeNote(id)) return;
  let url = null;
  if (id === GRADES_NOTE) url = ext.runtime.getURL('popup.html?view=tab&tab=grades');
  else {
    const { grades } = await store.get('grades');
    const g = (grades || []).find((x) => GRADE_NOTE + x.id === id);
    url = g ? MAK.safeSiteUrl(g.url) || MAK.siteUrl(g.siteId) : ext.runtime.getURL('popup.html?view=tab&tab=grades');
  }
  try { await ext.notifications.clear(id); } catch {}
  await ext.tabs.create({ url });
}

if (ext.notifications) ext.notifications.onClicked.addListener((id) => { openGradeNote(id).catch(() => {}); });

// Draw the badge again when the data or the settings change (wait a moment to group the changes).
let badgeTimer = null;
ext.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !Object.keys(changes).some((k) => BADGE_KEYS.includes(k))) return;
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(updateBadge, 300);
});

// ---- Message router ----------------------------------------------------------

// Who sent the message: 'page' (popup or a page of the extension), 'content'
// (content script in the top frame of MiAulario) or null (rejected).
function senderKind(sender) {
  if (!sender || sender.id !== ext.runtime.id) return null;
  const extensionOrigin = ext.runtime.getURL('');
  if (sender.url && sender.url.startsWith(extensionOrigin)) return 'page';
  if (!sender.tab) return 'page';
  if (sender.frameId !== 0) return null;
  try {
    return new URL(sender.url).origin === MAK.BASE ? 'content' : null;
  } catch {
    return null;
  }
}

// Handlers. "content: true" lets content scripts send the message.
const handlers = {
  getStatus: {
    content: true,
    run: async () => {
      const s = await getState();
      const alarm = await ext.alarms.get(PING_ALARM);
      return { paused: s.paused, autoLogin: s.autoLogin, nextPing: alarm ? alarm.scheduledTime : null };
    }
  },
  pingNow: { run: () => ping() },
  pause: {
    run: async () => {
      await store.set({ paused: true });
      return { ok: true };
    }
  },
  resume: {
    run: async () => {
      await store.set({ paused: false });
      await persistExisting();
      return ping();
    }
  },
  setAutoLogin: {
    run: async (msg) => {
      await store.set({ autoLogin: !!msg.value });
      return { ok: true };
    }
  },
  logout: {
    content: true,
    run: async () => {
      await store.set({ paused: true });
      await clearPersisted();
      // The course data stays only while the user is logged in.
      await sync.clearData();
      await clearGradeNotes();
      return { ok: true };
    }
  },
  // The popup opened: record the use, and sync if the data is older than 2 minutes.
  touch: {
    run: async () => {
      await sync.touch();
      const { meta } = await store.get('meta');
      if (!meta || !meta.lastSync || Date.now() - meta.lastSync > SYNC_FRESH_MS) {
        sync.run({ force: true }).catch(() => {});
      }
      return { ok: true };
    }
  },
  syncNow: {
    run: async (msg) => {
      await sync.touch();
      return sync.run({ force: true, full: !!msg.full });
    }
  },
  // Change some settings. MAK.withDefaults checks the result (unknown keys go away).
  setSettings: {
    run: async (msg) => {
      const patch = msg && msg.patch && typeof msg.patch === 'object' ? msg.patch : {};
      const next = await store.update('settings', (cur) => {
        const base = MAK.withDefaults(cur);
        const badge = Object.assign({}, base.badge, patch.badge && typeof patch.badge === 'object' ? patch.badge : {});
        return MAK.withDefaults(Object.assign({}, base, patch, { badge }));
      });
      if (patch.syncEnabled === true) sync.run({ force: true }).catch(() => {});
      return next;
    }
  },
  markAnnRead: { run: (msg) => markAnnouncementsRead(validIds(msg.ids)) },
  // Mark all the announcements as read, or all the announcements of one site.
  markAllAnnRead: {
    run: async (msg) => {
      const { announcements } = await store.get('announcements');
      const siteId = typeof msg.siteId === 'string' ? msg.siteId : '';
      const ids = (announcements || []).filter((a) => !siteId || a.siteId === siteId).map((a) => a.id);
      return markAnnouncementsRead(ids.slice(0, MAX_IDS));
    }
  },
  // A content script tells that the user opened a tool of a site in MiAulario.
  // The Announcements tool: the user can read the announcements of that site there. Mark them
  // as read in the extension, and tell the bell of MiAulario (MiAulario does not do this itself).
  toolVisit: {
    content: true,
    run: async (msg) => {
      if (!(await knownSite(msg.siteId))) return { ok: false };
      if (msg.toolId !== MAK.ANN_TOOL) return { ok: true };
      const { announcements } = await store.get('announcements');
      await setAnnRead((announcements || []).filter((a) => a.siteId === msg.siteId).map((a) => a.id));
      await pushReadToServer([msg.siteId]);
      return { ok: true };
    }
  },
  // A content script tells that the user opened a page of a site. Record the visit. At the start
  // of a new visit, get fresh data for the site. Answer with the items for the banner: the items
  // that came after the previous visit.
  visit: {
    content: true,
    run: async (msg) => {
      const siteId = msg.siteId;
      if (!(await knownSite(siteId))) return null;
      const st = await store.get(['meta', 'settings', 'paused']);
      const settings = MAK.withDefaults(st.settings);
      const now = Date.now();
      const baseline = (st.meta && st.meta.installedAt) || now;
      let info;
      await store.update('visits', (vs) => {
        info = MAK.recordVisit(vs || {}, siteId, now, baseline);
        return info.visits;
      });
      await sync.touch();
      if (MAK.hiddenEverywhere(settings).has(siteId) || !settings.syncEnabled) return { isNew: info.isNew, since: info.since, news: null, lang: settings.lang };
      if (info.isNew && !st.paused) await sync.run({ siteIds: [siteId] }).catch(() => {});
      const key = MAK.resourceKey(siteId);
      const d = await store.get(['announcements', 'assignments', 'forums', 'pages', 'forumSnap', 'grades', key]);
      const snap = (d.forumSnap || {})[siteId];
      const forumsOfSite = (d.forums || {})[siteId];
      const news = MAK.newSince({
        siteId,
        since: info.since,
        resources: d[key],
        announcements: d.announcements,
        assignments: d.assignments,
        forums: forumsOfSite,
        forumBase: snap ? (info.isNew ? snap.last : snap.previous) : null,
        grades: d.grades, // only in the banner: the Grades tab of the popup shows them already
        pages: d.pages,
        now
      });
      if (info.isNew && forumsOfSite) await store.update('forumSnap', (s) => MAK.shiftForumSnap(s, siteId, MAK.forumTotals(forumsOfSite)));
      return { isNew: info.isNew, since: info.since, firstVisit: info.since === baseline, news, lang: settings.lang };
    }
  },
  // Open the tools page that makes the ZIP of the files of a site.
  openZip: {
    content: true,
    run: async (msg) => {
      if (!(await knownSite(msg.siteId))) return { ok: false };
      await ext.tabs.create({ url: ext.runtime.getURL(`tools.html?zip=${encodeURIComponent(msg.siteId)}`) });
      return { ok: true };
    }
  },
  // The user opened the Grades tab: the grades until now are seen.
  markGradesSeen: {
    run: async () => {
      await store.set({ gradesSeenAt: Date.now() });
      return { ok: true };
    }
  },
  // Nothing before now is new in this site (or in all sites).
  markSiteSeen: {
    run: async (msg) => {
      const { sites, forums } = await store.get(['sites', 'forums']);
      const ids = (sites || []).map((s) => s.id).filter((id) => !msg.siteId || id === msg.siteId);
      const now = Date.now();
      await store.update('visits', (vs) => ids.reduce((acc, id) => MAK.markSeen(acc, id, now), vs || {}));
      await store.update('forumSnap', (snap) => {
        const out = Object.assign({}, snap);
        for (const id of ids) {
          const totals = MAK.forumTotals((forums || {})[id]);
          out[id] = { previous: totals, last: totals };
        }
        return out;
      });
      return { ok: true, sites: ids.length };
    }
  },
  // A content script takes the "mark viewed" requests that failed, and sends them from the page.
  takePendingMarkViewed: {
    content: true,
    run: async () => {
      let taken = [];
      await store.update('pendingMarkViewed', (list) => {
        taken = list || [];
        return [];
      });
      return taken;
    }
  },
  pendingMarkViewedDone: {
    content: true,
    run: async (msg) => {
      if (typeof msg.siteId !== 'string' || typeof msg.toolId !== 'string') return { ok: false };
      if (msg.ok) await markNotificationsViewed(msg.siteId, msg.toolId);
      else await queuePending(msg.siteId, msg.toolId);
      return { ok: true };
    }
  }
};

ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const kind = senderKind(sender);
  const handler = msg && typeof msg.type === 'string' && Object.prototype.hasOwnProperty.call(handlers, msg.type) ? handlers[msg.type] : null;
  if (!kind || !handler || (kind === 'content' && !handler.content)) {
    sendResponse(null);
    return false;
  }
  Promise.resolve()
    .then(() => handler.run(msg, sender))
    .then((result) => sendResponse(result === undefined ? null : result))
    .catch((e) => sendResponse({ error: String(e && e.message ? e.message : e) }));
  return true; // The response is asynchronous.
});

// ---- Alarm router ------------------------------------------------------------

function randomDelaySeconds() {
  return PING_MIN_SECONDS + Math.floor(Math.random() * (PING_MAX_SECONDS - PING_MIN_SECONDS + 1));
}

async function scheduleNext() {
  await ext.alarms.create(PING_ALARM, { when: Date.now() + randomDelaySeconds() * 1000 });
}

const alarmHandlers = {
  [PING_ALARM]: async () => {
    // First, set the next alarm. If the worker stops during the ping, the sequence continues.
    await scheduleNext();
    await ping();
    // The sync runs only if it is due (every 15 minutes, or every hour after 12 hours without use).
    await sync.run().catch(() => {});
    // The time changes the deliveries that are due soon.
    await updateBadge();
  }
};

ext.alarms.onAlarm.addListener((alarm) => {
  const run = alarmHandlers[alarm.name];
  if (run) return run(alarm);
});

async function boot() {
  const existing = await ext.alarms.get(PING_ALARM);
  // If there is no alarm (the browser started) or the alarm is the periodic alarm of v1.0, set a random alarm.
  if (!existing || existing.periodInMinutes) await scheduleNext();
  await persistExisting();
  await updateBadge(); // Chrome removes the badge when the browser starts.
  await ping();
  await sync.run().catch(() => {});
}

ext.runtime.onInstalled.addListener(boot);
ext.runtime.onStartup.addListener(boot);
