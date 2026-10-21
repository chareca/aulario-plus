// Aulario Plus: background script (service worker in Chromium, event page in Firefox).
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
  importScripts('lib/core.js', 'lib/store.js', 'lib/names.js', 'lib/api.js', 'lib/grades.js', 'lib/sync.js', 'lib/i18n.js', 'lib/due.js', 'lib/inbox.js', 'lib/news.js', 'lib/search.js', 'lib/zip.js', 'lib/send.js', 'lib/guide.js', 'lib/pdftext.js', 'lib/degree.js', 'lib/record.js', 'lib/history.js');
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

// The session cookies of each host. The extension copies their attributes (domain, path, flags)
// from the cookie that the server sets.
const COOKIE_HOSTS = {
  'miaulario.unavarra.es': ['SAKAISESSIONID', 'SERVERID'],
  'sso.unavarra.es': ['idpsession']
};
const SESSION_HOST = 'miaulario.unavarra.es';
// Wait this time without a change of a cookie before the extension writes it again.
const SETTLE_MS = 1500;

// The optional permission to read the exam calendars of www2.unavarra.es.
async function hasExamPermission() {
  try {
    return await ext.permissions.contains(MAK.EXAMS_PERMISSION);
  } catch {
    return false;
  }
}
// When the user gives the permission, the pages of MiAulario read the calendars (storage event).
if (ext.permissions && ext.permissions.onAdded) {
  ext.permissions.onAdded.addListener((p) => {
    if ((p.origins || []).some((o) => o.startsWith(MAK.EXAMS_ORIGIN))) store.set({ examsGranted: Date.now() }).catch(() => {});
  });
}

// ---- The Expediente of SIGMA (lib/record.js) ----------------------------------------------------
// With the optional permission for MiUPNA and SIGMA, a script (content-record.js, injected at each load of
// their pages) reads the grades when the user opens the Expediente, and every 3 days a tab in the
// background (not the active tab) does the way of a click: MiUPNA → "Consulta tu Expediente" → "Año
// actual" → "Expediente completo"; then it closes. The login of the UPNA goes on alone only with its
// session: if it asks for the password, the tab closes and the extension waits. "Abrir expediente" (the
// popup, or the rank in MiAulario): the same in a small window, which waits for the user to log in; then
// the page where the user was shows the average and the rank.
const RECORD_ALARM = 'sigma-record';
const RECORD_END_ALARM = 'sigma-record-end'; // the longest time of a reading
const RECORD_FILES = ['lib/core.js', 'lib/record.js', 'content-record.js'];
const RECORD_MS = 3 * MAK.DAY; // a new reading after this time
const RECORD_RETRY_MS = 12 * MAK.HOUR; // after a reading that did not end
const RECORD_TAB_MS = 90 * 1000; // the longest time of the tab of a reading in the background
const RECORD_SHOWN_MS = 5 * MAK.MINUTE; // and of a visible tab ("Leer ahora"): time to log in
const SSO_ORIGIN = 'https://sso.unavarra.es';
const runArea = ext.storage.session || ext.storage.local; // the tab of the reading that is open

async function hasRecordPermission() {
  try {
    return await ext.permissions.contains(MAK.RECORD_PERMISSION);
  } catch {
    return false;
  }
}

// The pages of MiUPNA and SIGMA where the script goes (an optional host cannot have a content script in the manifest).
const recordPage = (url) => String(url || '').startsWith(`${MAK.SIGMA_ORIGIN}/`) || String(url || '').startsWith(`${MAK.PORTAL_ORIGIN}/group/estudiantes/`);
function injectRecord(tabId) {
  if (!ext.scripting) return Promise.resolve();
  return Promise.resolve(ext.scripting.executeScript({ target: { tabId, allFrames: true }, files: RECORD_FILES })).catch(() => {});
}

// The reading that is open: { tabId, at, shown, from (the tab that shows the result), followed (it went to "Expediente completo") }.
const recordRun = async () => (await runArea.get('recordRun')).recordRun || null;
const runLimit = (run) => (run.shown ? RECORD_SHOWN_MS : RECORD_TAB_MS);
// The end of a reading: its tab (or window) closes. error: '' (the grades came), 'login', 'time' or 'empty'.
async function endRecordRun(error) {
  const run = await recordRun();
  await runArea.remove('recordRun');
  if (run) await Promise.resolve(ext.tabs.remove(run.tabId)).catch(() => {});
  if (error) await store.set({ recordTry: { at: Date.now(), error } });
  return run;
}
async function endStaleRun() {
  const run = await recordRun();
  if (run && Date.now() - run.at >= runLimit(run)) await endRecordRun('time');
}

// shown: a small window, which the user sees ("Abrir expediente"), else a tab in the background.
// from: the tab that shows the average and the rank at the end (MiAulario), or null.
async function refreshRecord(shown, from) {
  if (!(await hasRecordPermission())) return { error: 'record.permission' };
  const run = await recordRun();
  if (run && Date.now() - run.at < runLimit(run)) { // a reading is open: show its window
    if (shown && run.windowId) await Promise.resolve(ext.windows.update(run.windowId, { focused: true })).catch(() => {});
    return { ok: true };
  }
  if (run) await endRecordRun('time');
  await store.set({ recordTry: { at: Date.now(), error: '' } });
  let tabId, windowId;
  if (shown) {
    const size = { width: 640, height: 720 };
    const over = await Promise.resolve(ext.windows.getLastFocused()).catch(() => null);
    const place = over && over.width ? { left: Math.max(0, Math.round(over.left + (over.width - size.width) / 2)), top: Math.max(0, Math.round(over.top + (over.height - size.height) / 2)) } : {};
    const win = await ext.windows.create({ url: MAK.RECORD_START, type: 'popup', ...size, ...place });
    [tabId, windowId] = [win.tabs[0].id, win.id];
  } else {
    tabId = (await ext.tabs.create({ url: MAK.RECORD_START, active: false })).id;
  }
  const next = { tabId, windowId, at: Date.now(), shown: !!shown, from: from ?? null, followed: false };
  await runArea.set({ recordRun: next });
  await ext.alarms.create(RECORD_END_ALARM, { delayInMinutes: runLimit(next) / MAK.MINUTE });
  return { ok: true };
}

// "Abrir expediente": the pages of SIGMA that are open now, and a reading in a small window. from: as above.
async function readRecordNow(from) {
  if (!(await hasRecordPermission())) return { error: 'record.permission' };
  const open = await Promise.resolve(ext.tabs.query({ url: `${MAK.SIGMA_ORIGIN}/*` })).catch(() => []);
  for (const t of open || []) await injectRecord(t.id);
  return refreshRecord(true, from);
}

// The end of a reading in a window: the tab where the user was (MiAulario) shows the average and the rank.
// Another page: the popup shows them (Chrome opens it; else at its next opening).
async function showRecordDone(run) {
  const shown = run.from !== null && (await Promise.resolve(ext.tabs.sendMessage(run.from, { type: 'recordDone' })).catch(() => false));
  if (shown) return Promise.resolve(ext.tabs.update(run.from, { active: true })).catch(() => {});
  await runArea.set({ recordNews: true });
  if (ext.action.openPopup) await Promise.resolve(ext.action.openPopup()).catch(() => {});
}

// Every 6 hours: a reading if the grades are older than 3 days. Not when the user is logged out or paused.
async function recordDue() {
  await endStaleRun();
  if (!(await hasRecordPermission())) return;
  const d = await store.get(['record', 'recordTry', 'paused']);
  const now = Date.now();
  if (d.paused || (d.record && now - d.record.at < RECORD_MS) || (d.recordTry && now - d.recordTry.at < RECORD_RETRY_MS)) return;
  await refreshRecord();
}

// A page of MiUPNA or SIGMA that loaded: the script, with the permission. The tab of a reading in the
// background on the login of the UPNA: with a session it goes on at once (a form that sends itself). If
// it stays, the login asks for the password: close the tab (a visible tab waits for the user).
if (ext.tabs && ext.tabs.onUpdated) {
  ext.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status !== 'complete' || !tab) return;
    if (recordPage(tab.url)) {
      hasRecordPermission().then((ok) => (ok ? injectRecord(tabId) : null)).catch(() => {});
      return;
    }
    if (!String(tab.url || '').startsWith(`${SSO_ORIGIN}/`)) return;
    recordRun().then((run) => {
      if (!run || run.tabId !== tabId || run.shown) return;
      setTimeout(async () => {
        const now = await Promise.resolve(ext.tabs.get(tabId)).catch(() => null);
        if (now && String(now.url || '').startsWith(`${SSO_ORIGIN}/`)) await endRecordRun('login');
      }, 6000);
    }).catch(() => {});
  });
  // The user closed the window of a reading: no reading is open.
  ext.tabs.onRemoved.addListener((tabId) => {
    recordRun().then((run) => (run && run.tabId === tabId ? runArea.remove('recordRun') : null)).catch(() => {});
  });
}

// ---- The history of the tasks and the exams (lib/history.js) ----------------------------------------
// The panel "Tareas" of MiAulario, and the submission of each task that can still change. One reading at a time.
let historyRunning = null;
function refreshHistory() {
  if (historyRunning) return historyRunning;
  historyRunning = (async () => {
    let raw;
    try {
      raw = await courseApi.tasks();
    } catch (e) {
      // Without a session MiAulario answers with the page of the login.
      return { error: e && (e.kind === 'not-json' || e.status === 401 || e.status === 403) ? 'history.login' : 'history.network' };
    }
    const now = Date.now();
    const { history } = await store.get('history');
    const next = MAK.mergeHistory(history, MAK.cleanHistoryItems(raw), now);
    const todo = Object.values(next.items).filter((it) => MAK.historyNeedsDetail(it, now));
    for (let i = 0; i < todo.length; i += 4) {
      await Promise.all(todo.slice(i, i + 4).map(async (it) => {
        try {
          it.detail = MAK.historyDetail(await courseApi.assignment(it.id), now);
        } catch {} // the next reading tries again
      }));
    }
    await store.set({ history: next });
    return { ok: true, items: Object.keys(next.items).length };
  })().finally(() => { historyRunning = null; });
  return historyRunning;
}

// Once a day with the ping, also without the page: the history grows alone. Not after a logout (paused).
async function historyDue() {
  const d = await store.get(['history', 'paused', 'last']);
  if (d.paused || !(d.last && d.last.loggedIn)) return;
  if (!d.history || Date.now() - d.history.at >= MAK.HISTORY_MS) await refreshHistory();
}

async function getState() {
  const d = await ext.storage.local.get(['paused', 'autoLogin']);
  return { paused: !!d.paused, autoLogin: d.autoLogin !== false };
}

// The keep-alive request: without "auto=true", so Sakai records it as activity.
async function ping() {
  const { paused } = await ext.storage.local.get('paused');
  // "Pausar" in the popup ('user'): only "Reanudar" continues.
  if (paused === 'user') return null;
  if (paused) {
    // The extension is paused after a manual logout. Only read the session (with "auto=true",
    // it does not reset the timer). If the user logged in again, continue, as "Reanudar" does.
    const session = await courseApi.session().catch(() => null);
    if (!session || !session.userId) return null;
    await store.set({ paused: false });
    await persistExisting();
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
//
// The server sets the session cookies without an expiration date. The extension writes each one
// again, with the same attributes and an expiration date. At login, MiAulario changes
// SAKAISESSIONID more than one time in a short period. If a write replaces the new (logged-in)
// session with an older value, the page shows "not logged in" after a correct login. So:
// 1. The extension waits until the cookie does not change for SETTLE_MS.
// 2. It reads the cookie that the browser has now, and writes this cookie (not the cookie of the
//    event) with its own domain, path and flags. Thus the write replaces this cookie.
// 3. It removes the other copies of the cookie for the same host (another path, or a host-only
//    cookie and a domain cookie). The browser sends all the copies, and Sakai reads only one.
// 4. If the server set a new value during the write, the write replaced it. Then the extension
//    writes the new value.

const cookieWatch = new Map(); // "store|host|name" -> { seq, cookie, timer, written: { value, seq } }
let cookieSeq = 0;
let cookieQueue = Promise.resolve();
// One cookie job at a time, in the order of the events.
const queueCookie = (job) => (cookieQueue = cookieQueue.then(job).catch(() => {}));

const cookieHost = (c) => String(c.domain || '').replace(/^\./, '');
const isSessionCookie = (c) => (COOKIE_HOSTS[cookieHost(c)] || []).includes(c.name);
const watchKey = (storeId, host, name) => `${storeId || ''}|${host}|${name}`;
const sameCookie = (a, b) => a.domain === b.domain && (a.path || '/') === (b.path || '/') && !!a.hostOnly === !!b.hostOnly;

// The details for cookies.set: the same cookie (domain, path, flags) with this value and expiration.
function cookieDetails(c, host, value, expirationDate) {
  const d = { url: `https://${host}${c.path || '/'}`, name: c.name, value, path: c.path || '/', secure: !!c.secure, httpOnly: !!c.httpOnly, expirationDate };
  if (c.sameSite) d.sameSite = c.sameSite;
  if (!c.hostOnly) d.domain = c.domain;
  if (c.storeId) d.storeId = c.storeId;
  if (c.partitionKey) d.partitionKey = c.partitionKey;
  if (c.firstPartyDomain) d.firstPartyDomain = c.firstPartyDomain; // Firefox with first-party isolation
  return d;
}

// All the copies of a cookie for a host: the host-only cookie and the domain cookie, all paths.
async function cookieCopies(host, name, storeId) {
  try {
    const list = await ext.cookies.getAll(storeId ? { domain: host, name, storeId } : { domain: host, name });
    return (list || []).filter((c) => cookieHost(c) === host);
  } catch {
    return [];
  }
}

// Remove exactly one copy: write the same cookie with an expiration date in the past.
async function dropCookie(c, host) {
  try { await ext.cookies.set(cookieDetails(c, host, '', 1)); } catch {}
}

async function settleCookie(host, name, storeId, round = 0) {
  const key = watchKey(storeId, host, name);
  const watch = cookieWatch.get(key);
  if (watch) clearTimeout(watch.timer);
  if ((await getState()).paused) return;
  const seq = cookieSeq;
  const copies = await cookieCopies(host, name, storeId);
  // The cookie of the server is the copy without an expiration date.
  let target = copies.find((c) => !c.expirationDate);
  if (!target && watch && watch.written && watch.seq > watch.written.seq && watch.cookie.value !== watch.written.value) {
    target = watch.cookie; // the last write replaced a newer value of the server
  }
  if (!target) return;
  for (const c of copies) if (!sameCookie(c, target)) await dropCookie(c, host);
  try {
    await ext.cookies.set(cookieDetails(target, host, target.value, Math.floor(Date.now() / 1000) + PERSIST_DAYS * 86400));
  } catch {}
  const now = cookieWatch.get(key) || { seq: 0 };
  now.written = { value: target.value, seq };
  cookieWatch.set(key, now);
  // The server changed the cookie during the write: do the work again at once.
  if (now.seq > seq && round < 3) await settleCookie(host, name, storeId, round + 1);
}

ext.cookies.onChanged.addListener(({ cookie, removed }) => {
  // A persistent cookie is a write of the extension, or a cookie that is persistent already.
  if (removed || !isSessionCookie(cookie) || cookie.expirationDate) return;
  const host = cookieHost(cookie);
  const key = watchKey(cookie.storeId, host, cookie.name);
  const watch = cookieWatch.get(key) || {};
  clearTimeout(watch.timer);
  Object.assign(watch, { seq: ++cookieSeq, cookie });
  watch.timer = setTimeout(() => queueCookie(() => settleCookie(host, cookie.name, cookie.storeId)), SETTLE_MS);
  cookieWatch.set(key, watch);
});

// Remove all the copies of the cookies of a host (for all the names if "names" is not given).
function dropSessionCookies(hosts, names) {
  return queueCookie(async () => {
    for (const host of hosts) {
      for (const name of names || COOKIE_HOSTS[host]) {
        for (const [key, w] of cookieWatch) if (key.endsWith(`|${host}|${name}`)) { clearTimeout(w.timer); cookieWatch.delete(key); }
        for (const c of await cookieCopies(host, name)) await dropCookie(c, host);
      }
    }
  });
}

const clearPersisted = () => dropSessionCookies(Object.keys(COOKIE_HOSTS));

// At install or at browser start, change the cookies that exist into persistent cookies.
async function persistExisting() {
  for (const [host, names] of Object.entries(COOKIE_HOSTS)) {
    for (const name of names) await queueCookie(() => settleCookie(host, name));
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
  const { settings, sites } = await store.get(['settings', 'sites']);
  const s = MAK.withDefaults(settings);
  if (!s.notifyGrades) return;
  const names = new Map(MAK.namedSites(sites, s).map((x) => [x.id, x.title]));
  const siteOf = (g) => names.get(g.siteId) || g.siteTitle;
  const hidden = MAK.hiddenEverywhere(s);
  const list = changed.filter((g) => !hidden.has(g.siteId));
  if (!list.length) return;
  MAK.setLang(s.lang);
  const notes =
    list.length <= GRADE_NOTE_MAX
      ? list.map((g) => [GRADE_NOTE + g.id, MAK.t('note.grade', { site: siteOf(g) }), g.name || MAK.t('tab.grades')])
      : [[GRADES_NOTE, MAK.t('note.grades', { n: list.length }), [...new Set(list.map(siteOf))].join(' · ')]];
  const iconUrl = ext.runtime.getURL('icons/icon128.png');
  for (const [id, title, message] of notes) {
    try {
      await ext.notifications.create(id, { type: 'basic', iconUrl, title, message });
    } catch {}
  }
}

// At logout: the notifications of the user (grades, reminders). The alarms of the reminders go with the
// deliveries (checkDueSoon, when clearData removes them).
async function clearUserNotes() {
  try {
    if (!ext.notifications) return;
    const all = await ext.notifications.getAll();
    for (const id of Object.keys(all || {})) if (isGradeNote(id) || id.startsWith(DUE_NOTE)) await ext.notifications.clear(id);
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

if (ext.notifications) ext.notifications.onClicked.addListener((id) => {
  openGradeNote(id).catch(() => {});
  openDueNote(id).catch(() => {});
});

// ---- Reminders before a delivery that is not submitted ------------------------------
// 24 hours and 1 hour before by default (settings: notifyDue, dueOffsets; MAK.dueReminders). One
// alarm for each delivery, at the time of its next reminder. The alarm, the end of a sync and a
// change of the settings check the deliveries again: a delivery that the user submitted gives no
// reminder. The notification shows the time left, the delivery and the site; a click opens it.

const DUE_NOTE = 'due:'; // the notification and the alarm: "due:<assignment id>"

async function checkDueReminders() {
  const d = await store.get(['settings', 'assignments', 'sites', 'dueNotified']);
  const s = MAK.withDefaults(d.settings);
  const now = Date.now();
  const r = s.notifyDue && ext.notifications
    ? MAK.dueReminders({ assignments: d.assignments, hidden: MAK.hiddenEverywhere(s), now, notified: d.dueNotified, offsets: s.dueOffsets })
    : { now: [], later: [] };
  const want = new Map(r.later.map((x) => [DUE_NOTE + x.id, x.when]));
  for (const a of (await ext.alarms.getAll()) || []) {
    if (a.name.startsWith(DUE_NOTE) && want.get(a.name) !== a.scheduledTime) await ext.alarms.clear(a.name);
  }
  for (const [name, when] of want) if (!(await ext.alarms.get(name))) await ext.alarms.create(name, { when });
  if (!r.now.length) return;
  MAK.setLang(s.lang);
  const names = new Map(MAK.namedSites(d.sites, s).map((x) => [x.id, x.title]));
  const iconUrl = ext.runtime.getURL('icons/icon128.png');
  for (const { a } of r.now) {
    const title = MAK.t('note.dueIn', { left: MAK.leftText(a.due - now) });
    const message = [a.title, names.get(a.siteId)].filter(Boolean).join('\n');
    try {
      await ext.notifications.create(DUE_NOTE + a.id, { type: 'basic', iconUrl, title, message });
    } catch {}
  }
  // The shown reminders, only of the deliveries that are still in the list.
  const ids = new Set((d.assignments || []).map((a) => a.id));
  await store.update('dueNotified', (cur) => {
    const out = {};
    for (const [k, v] of Object.entries(cur || {})) if (ids.has(k)) out[k] = v;
    for (const { a, sent } of r.now) out[a.id] = { due: a.due, sent };
    return out;
  });
}
let dueTimer = null;
const checkDueSoon = () => {
  clearTimeout(dueTimer);
  dueTimer = setTimeout(() => checkDueReminders().catch(() => {}), 300);
};

// A click opens the delivery in MiAulario.
async function openDueNote(id) {
  if (!id.startsWith(DUE_NOTE)) return;
  const { assignments, pages } = await store.get(['assignments', 'pages']);
  const a = (assignments || []).find((x) => DUE_NOTE + x.id === id);
  try { await ext.notifications.clear(id); } catch {}
  await ext.tabs.create({ url: (a && MAK.deliveryUrl(a, pages)) || ext.runtime.getURL('popup.html?view=tab&tab=due') });
}

// Draw the badge again when the data or the settings change (wait a moment to group the changes).
let badgeTimer = null;
let searchCache = null; // the search index; made again after a change of the data
ext.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') searchCache = null;
  if (area === 'local' && (changes.assignments || changes.settings)) checkDueSoon();
  if (area !== 'local' || !Object.keys(changes).some((k) => BADGE_KEYS.includes(k))) return;
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(updateBadge, 300);
});

// ---- Message router ----------------------------------------------------------

// Who sent the message: 'page' (popup or a page of the extension), 'content'
// (content script in the top frame of MiAulario), 'record' (in a page of MiUPNA or SIGMA) or null (rejected).
function senderKind(sender) {
  if (!sender || sender.id !== ext.runtime.id) return null;
  const extensionOrigin = ext.runtime.getURL('');
  if (sender.url && sender.url.startsWith(extensionOrigin)) return 'page';
  if (!sender.tab) return 'page';
  try {
    const origin = new URL(sender.url).origin;
    if (origin === MAK.PORTAL_ORIGIN || origin === MAK.SIGMA_ORIGIN) return 'record'; // content-record.js, also in a frame
    return sender.frameId === 0 && origin === MAK.BASE ? 'content' : null;
  } catch {
    return null;
  }
}

// Handlers. "content: true" lets content scripts send the message; "record: true", the script of the Expediente.
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
      await store.set({ paused: 'user' }); // not true (a logout): a new login does not continue it
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
  // A login did not give a session (content.js). An old copy of the session cookie can cause this.
  // Remove all the copies of SAKAISESSIONID and SERVERID: the next login makes them again. The SSO
  // session (idpsession) stays, so the login does not ask for the password.
  repairSession: {
    content: true,
    run: async () => {
      await dropSessionCookies([SESSION_HOST]);
      return { ok: true };
    }
  },
  logout: {
    content: true,
    run: async () => {
      await store.update('paused', (p) => (p === 'user' ? p : true)); // "Pausar" stays until "Reanudar"
      await clearPersisted();
      // The course data stays only while the user is logged in. It goes now; then the sync that is
      // running ends (a new one stops: paused) and what it wrote goes too. Now first: if the browser
      // stops the service worker during the wait, no data stays.
      await sync.clearData();
      await sync.run().catch(() => {});
      await sync.clearData();
      await clearUserNotes();
      return { ok: true };
    }
  },
  // The popup opened: record the use, and sync if the data is older than 2 minutes.
  touch: {
    run: async () => {
      await sync.touch();
      const { meta } = await store.get('meta');
      // A last sync in the future: the clock went back. Sync.
      if (!meta || !meta.lastSync || Date.now() - meta.lastSync > SYNC_FRESH_MS || meta.lastSync > Date.now()) {
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
  // "badge", "targets" and "nicknames" merge with the current values. null removes a target or a name.
  setSettings: {
    run: async (msg) => {
      const patch = msg && msg.patch && typeof msg.patch === 'object' ? msg.patch : {};
      const next = await store.update('settings', (cur) => {
        const base = MAK.withDefaults(cur);
        const part = (key) => Object.assign({}, base[key], patch[key] && typeof patch[key] === 'object' ? patch[key] : {});
        return MAK.withDefaults(Object.assign({}, base, patch, { badge: part('badge'), targets: part('targets'), nicknames: part('nicknames'), links: part('links') }));
      });
      if (patch.syncEnabled === true) sync.run({ force: true }).catch(() => {});
      return next;
    }
  },
  // The button of the exam calendar in MiAulario (content-guide.js, content-shortcuts.js): only this setting
  // (setSettings is for the pages of the extension).
  setExamCalendar: {
    content: true,
    run: async (msg) => {
      await store.update('settings', (cur) => MAK.withDefaults(Object.assign({}, MAK.withDefaults(cur), { examCalendar: !!(msg && msg.on) })));
      return { ok: true };
    }
  },
  // The popup: the notice of the changes of the new version is closed.
  // The light or dark theme of MiAulario (content-theme.js): 'dark', 'light' or 'system'. The popup and the
  // pages of the extension follow it with the setting colorMode 'auto'.
  pageMode: {
    content: true,
    run: async (msg) => {
      const mode = ['dark', 'light', 'system'].includes(msg && msg.mode) ? msg.mode : null;
      if (mode) await store.set({ sakaiMode: mode });
      return { ok: !!mode };
    }
  },
  dismissWhatsNew: {
    run: async () => {
      await store.remove('whatsNew');
      return { ok: true };
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
  // "Open the mail": the internal mail of the site in a new tab, with the prepared message.
  openMailTool: {
    content: true,
    run: async (msg) => {
      if (!(await knownSite(msg.siteId))) return { ok: false };
      const { pages } = await store.get('pages');
      const tool = pages && pages[msg.siteId] && pages[msg.siteId].tools['sakai.messages'];
      const url = tool && MAK.safeSiteUrl(tool.page);
      if (!url) return { ok: false };
      await ext.tabs.create({ url });
      return { ok: true };
    }
  },
  // A download link without a MiAulario login (Send): the files of the site, encrypted in the
  // browser, on the Send server of the settings. More than one file: one ZIP file.
  makeLink: {
    content: true,
    run: async (msg) => {
      if (!(await knownSite(msg.siteId))) return { error: 'send.noFiles' };
      const links = MAK.withDefaults((await store.get('settings')).settings).links;
      if (!links.enabled) return { error: 'send.disabled' };
      const granted = await MAK.linkPermissions(ext.permissions, links);
      if (!granted.origins || !granted.data) return { error: 'send.permission' };
      const files = MAK.linkFiles(msg.files, msg.siteId);
      if (!files.length) return { error: 'send.noFiles' };
      try {
        const file = await MAK.linkPayload({ files, name: typeof msg.name === 'string' ? msg.name.slice(0, 100) : '', fetchFile: (url) => fetch(url, { credentials: 'include' }) });
        return await MAK.sendLink({
          server: links.server, mode: links.mode, downloads: links.downloads, seconds: links.seconds,
          data: file.data, name: file.name, type: file.type, doFetch: (url, init) => fetch(url, init)
        });
      } catch (e) {
        return { error: (e && e.code) || 'send.network', detail: e && e.code ? String(e.message || '').replace(/^[\w.]+:?\s*/, '') : '' };
      }
    }
  },
  // The public page of a course guide (www.unavarra.es), for the pages that read it (DOMParser).
  fetchGuide: {
    content: true,
    run: async (msg) => {
      const url = MAK.guideUrl(msg.url);
      if (!url) return { error: 'guide.url' };
      try {
        const r = await fetch(url, { credentials: 'omit', cache: 'no-store' });
        if (!r.ok) return { error: 'guide.http', status: r.status };
        return { html: await r.text() };
      } catch {
        return { error: 'guide.network' };
      }
    }
  },
  // The public pages of the degrees: the list of degrees and the page "Evaluación" of a degree.
  // The content script reads them (DOMParser) and stores the result with saveDegree.
  fetchDegreePage: {
    content: true,
    run: async (msg) => {
      const url = String(msg.url || '');
      const page = '/evaluacion.html';
      if (url !== MAK.DEGREE_LIST_URL && !(url.endsWith(page) && MAK.isDegreeBase(url.slice(0, -page.length)))) return { error: 'degree.url' };
      try {
        const r = await fetch(url, { credentials: 'omit', cache: 'no-store' });
        if (!r.ok) return { error: 'degree.http', status: r.status };
        return { html: await r.text() };
      } catch {
        return { error: 'degree.network' };
      }
    }
  },
  // Store the degree of the user (read in a page), and the list of degrees if it comes too.
  saveDegree: {
    content: true,
    run: async (msg) => {
      const degree = MAK.cleanDegree(msg.degree);
      if (!degree) return { ok: false };
      const patch = { degree: Object.assign({ at: Date.now() }, degree) };
      const list = Array.isArray(msg.list)
        ? msg.list.slice(0, 200).map((d) => ({ name: d && typeof d.name === 'string' ? d.name.slice(0, 200) : '', base: d && d.base })).filter((d) => d.name && MAK.isDegreeBase(d.base))
        : [];
      if (list.length) patch.degreeList = { at: Date.now(), list };
      await store.set(patch);
      return { ok: true };
    }
  },
  // The address for the forward of the internal mail (content-forward.js): only to fill the field
  // the next time. MiAulario keeps the forward itself.
  setForwardEmail: {
    content: true,
    run: async (msg) => {
      const next = await store.update('settings', (cur) => MAK.withDefaults(Object.assign({}, MAK.withDefaults(cur), { forwardEmail: msg.email })));
      return { ok: next.forwardEmail === msg.email };
    }
  },
  // The degree that the user selected in "Mi sitio" ("" = the degree of the guides).
  setDegree: {
    content: true,
    run: async (msg) => {
      const base = msg.base === '' ? '' : MAK.isDegreeBase(msg.base) ? msg.base : null;
      if (base === null) return { ok: false };
      await store.update('settings', (cur) => MAK.withDefaults(Object.assign({}, MAK.withDefaults(cur), { degree: base })));
      await store.remove(['degree']); // read the degree again
      return { ok: true };
    }
  },
  // The exams of an exam calendar (a PDF file on www2.unavarra.es): its rows. The file is read again
  // after 1 day. It needs the optional permission for www2.unavarra.es.
  examRows: {
    content: true,
    run: async (msg) => {
      const url = MAK.examPdfUrl(msg.url);
      if (!url) return { error: 'exams.url' };
      const { exams } = await store.get('exams');
      const kept = exams && exams[url];
      if (kept && Date.now() - kept.at < MAK.EXAMS_MS) return { rows: kept.rows };
      if (!(await hasExamPermission())) return { error: 'exams.permission' };
      try {
        const r = await fetch(url, { credentials: 'omit', cache: 'no-store' });
        if (!r.ok) return { error: 'exams.http', status: r.status };
        if (Number(r.headers.get('content-length')) > 5000000) return { error: 'exams.size' }; // before reading it
        const data = await r.arrayBuffer();
        if (data.byteLength > 5000000) return { error: 'exams.size' };
        const rows = MAK.parseExamRows(await MAK.pdfTextLines(data)).slice(0, 500);
        await store.update('exams', (cur) => {
          const next = Object.fromEntries(Object.entries(cur || {}).filter(([k, v]) => k !== url && v && Date.now() - v.at < MAK.EXAMS_MS).slice(-7));
          next[url] = { at: Date.now(), rows };
          return next;
        });
        return { rows };
      } catch {
        return { error: 'exams.network' };
      }
    }
  },
  // A table of the Expediente in SIGMA. In the tab of a reading, the table after "Expediente completo" ends it.
  recordSave: {
    record: true,
    run: async (msg, sender) => {
      const run = await recordRun();
      const mine = !!(run && sender.tab && run.tabId === sender.tab.id);
      const next = new URL(sender.url).origin === MAK.SIGMA_ORIGIN ? MAK.cleanRecord(msg.record) : null;
      if (!next || !next.rows.length) {
        if (mine) await endRecordRun('empty');
        return { error: 'record.empty' };
      }
      await store.update('record', (cur) => Object.assign(MAK.mergeRecord(cur, next), { at: Date.now() }));
      if (mine && run.followed) {
        await endRecordRun('');
        if (run.shown) await showRecordDone(run);
      }
      return { ok: true };
    }
  },
  // Does this page of the tab of a reading go on? MiUPNA: to SIGMA. SIGMA: once to "Expediente completo".
  recordTab: {
    record: true,
    run: async (msg, sender) => {
      const run = await recordRun();
      if (!run || !sender.tab || run.tabId !== sender.tab.id) return false;
      if (!msg.sigma) return true;
      if (run.followed) return false;
      await runArea.set({ recordRun: Object.assign(run, { followed: true }) });
      return true;
    }
  },
  // "Abrir expediente" in the popup (the user gave the permission, the popup asks for it) or on the rank in
  // MiAulario: the pages of SIGMA that are open now, and a reading in a small window. The popup: the result
  // goes to the active tab. Off: the permission and the grades go.
  recordOpen: {
    content: true,
    run: async (msg, sender) => {
      if (sender.tab) return readRecordNow(sender.tab.id);
      const [active] = await Promise.resolve(ext.tabs.query({ active: true, lastFocusedWindow: true })).catch(() => []);
      return readRecordNow(active ? active.id : null);
    }
  },
  // The page "Historial" (tools.html?history): read the history now.
  historyRefresh: { run: () => refreshHistory() },
  // Import the submission confirmation emails that the user pastes (the exams and tasks of before September 2025).
  historyImport: {
    run: async (msg) => {
      const items = MAK.parseSubmissionEmails(String((msg && msg.text) || ''));
      if (!items.length) return { ok: true, added: 0, total: 0 };
      const { history } = await store.get('history');
      const before = history ? Object.keys(history.items).length : 0;
      const next = MAK.mergeHistory(history, items, Date.now());
      await store.set({ history: next });
      return { ok: true, added: Object.keys(next.items).length - before, total: items.length };
    }
  },
  // The user saw the rank (a window of the popup or of MiAulario): what goes up from now is news.
  recordSeen: {
    content: true,
    run: async () => {
      const { record } = await store.get('record');
      if (record) await store.set({ recordSeen: MAK.recordSeenOf(record) });
      return { ok: true };
    }
  },
  recordOff: {
    run: async () => {
      await Promise.resolve(ext.permissions.remove(MAK.RECORD_PERMISSION)).catch(() => false);
      await endRecordRun('');
      await store.remove(MAK.RECORD_KEYS);
      return { ok: true };
    }
  },
  // The page of the extension that asks for the permission of the exam calendars.
  openExamPermission: {
    content: true,
    run: async () => {
      await ext.tabs.create({ url: ext.runtime.getURL('tools.html?perm=exams') });
      return { ok: true };
    }
  },
  // Store the guide of a site (read in a page). null: the site has no guide (do not ask again soon).
  saveGuide: {
    content: true,
    run: async (msg) => {
      if (!(await knownSite(msg.siteId))) return { ok: false };
      const guide = MAK.cleanGuide(msg.guide);
      await store.update('guides', (cur) => Object.assign({}, cur, { [msg.siteId]: { at: Date.now(), guide } }));
      return { ok: true };
    }
  },
  // The search palette in MiAulario (Ctrl+K). Only the stored data, no requests.
  search: {
    content: true,
    run: async (msg) => {
      const query = typeof msg.query === 'string' ? msg.query.slice(0, 100) : '';
      if (!searchCache) {
        const d = await ext.storage.local.get(null);
        searchCache = MAK.buildSearchIndex(d, MAK.withDefaults(d.settings));
      }
      return { results: MAK.searchIndex(searchCache, query, 20) };
    }
  },
  // A name from the user for a site (the pencil in the popup or in MiAulario). An empty name,
  // or the automatic name, removes the name from the user.
  // The calculator of a guide (content-calc.js): all the grades of one site, and the weights that
  // the user changed (if the message has them). An empty object removes them.
  setGuideGrades: {
    content: true,
    run: async (msg) => {
      if (!(await knownSite(msg.siteId))) return { ok: false };
      const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
      const put = (map, value) => {
        const all = Object.assign({}, map);
        delete all[msg.siteId];
        if (Object.keys(value).length) all[msg.siteId] = value;
        return all;
      };
      await store.update('settings', (cur) => {
        const s = MAK.withDefaults(cur);
        const next = { guideGrades: put(s.guideGrades, obj(msg.grades)) };
        if (msg.weights !== undefined) next.guideWeights = put(s.guideWeights, obj(msg.weights));
        return MAK.withDefaults(Object.assign({}, s, next));
      });
      return { ok: true };
    }
  },
  renameSite: {
    content: true,
    run: async (msg) => {
      if (!(await knownSite(msg.siteId))) return null;
      const { sites } = await store.get('sites');
      const site = sites.find((s) => s.id === msg.siteId);
      const next = await store.update('settings', (cur) => {
        const base = MAK.withDefaults(cur);
        const auto = MAK.siteName(site, Object.assign({}, base, { nicknames: {} }));
        const name = MAK.cleanName(typeof msg.name === 'string' ? msg.name : '');
        const nicknames = Object.assign({}, base.nicknames, { [msg.siteId]: name && name !== auto ? name : null });
        return MAK.withDefaults(Object.assign({}, base, { nicknames }));
      });
      return { ok: true, name: MAK.siteName(site, next) };
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
  // The list stays until a page says that MiAulario took each one: a page that closes in the middle
  // loses none (a "viewed" sent two times does nothing more).
  takePendingMarkViewed: {
    content: true,
    run: async () => (await store.get('pendingMarkViewed')).pendingMarkViewed || []
  },
  pendingMarkViewedDone: {
    content: true,
    run: async (msg) => {
      if (typeof msg.siteId !== 'string' || typeof msg.toolId !== 'string') return { ok: false };
      if (msg.ok) {
        await store.update('pendingMarkViewed', (list) => (list || []).filter((x) => x.siteId !== msg.siteId || x.toolId !== msg.toolId));
        await markNotificationsViewed(msg.siteId, msg.toolId);
      } else await queuePending(msg.siteId, msg.toolId);
      return { ok: true };
    }
  }
};

ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const kind = senderKind(sender);
  const handler = msg && typeof msg.type === 'string' && Object.prototype.hasOwnProperty.call(handlers, msg.type) ? handlers[msg.type] : null;
  if (!kind || !handler || (kind === 'content' && !handler.content) || (kind === 'record' && !handler.record)) {
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
  [RECORD_ALARM]: () => recordDue(),
  [RECORD_END_ALARM]: () => endStaleRun(),
  [PING_ALARM]: async () => {
    // First, set the next alarm. If the worker stops during the ping, the sequence continues.
    await scheduleNext();
    await ping();
    // The sync runs only if it is due (every 15 minutes, or every hour after 12 hours without use).
    await sync.run().catch(() => {});
    // The time changes the deliveries that are due soon.
    await updateBadge();
    await checkDueReminders().catch(() => {});
    await historyDue().catch(() => {});
  }
};

ext.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith(DUE_NOTE)) return checkDueReminders().catch(() => {});
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
  await checkDueReminders().catch(() => {});
  if (!(await ext.alarms.get(RECORD_ALARM))) await ext.alarms.create(RECORD_ALARM, { delayInMinutes: 5, periodInMinutes: 360 });
}

ext.runtime.onInstalled.addListener(boot);
// The welcome page after the install; after an update, the notice of the changes in the popup
// (popup.js, MAK.CHANGES of lib/help.js).
ext.runtime.onInstalled.addListener((details) => {
  const reason = details && details.reason;
  if (reason === 'install') Promise.resolve(ext.tabs.create({ url: ext.runtime.getURL('tools.html?welcome') })).catch(() => {});
  else if (reason === 'update' && ext.runtime.getManifest) {
    const version = ext.runtime.getManifest().version;
    if (details.previousVersion !== version) store.set({ whatsNew: version }).catch(() => {});
  }
});
ext.runtime.onStartup.addListener(boot);
