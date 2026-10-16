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
  importScripts('lib/core.js', 'lib/store.js', 'lib/api.js', 'lib/sync.js');
}

const ext = globalThis.browser ?? globalThis.chrome;
const store = MAK.createStore(ext.storage.local);
const courseApi = MAK.createApi({ fetch: (url, init) => fetch(url, init) });
const sync = MAK.createSync({ api: courseApi, store, lockArea: ext.storage.session || null });

const SESSION_URL = 'https://miaulario.unavarra.es/direct/session/current.json';
const PING_ALARM = 'miaulario-ping';
// Random interval between pings, in seconds. With the longest interval (10 minutes),
// 6 pings occur in the 60 minutes of inactivity that Sakai accepts.
const PING_MIN_SECONDS = 3 * 60;
const PING_MAX_SECONDS = 10 * 60;
const PERSIST_DAYS = 30;
const LOG_MAX = 50;

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
  const d = await ext.storage.local.get(['paused', 'autoLogin', 'last', 'log']);
  return {
    paused: !!d.paused,
    autoLogin: d.autoLogin !== false,
    last: d.last || null,
    log: d.log || []
  };
}

async function record(entry) {
  await store.update('log', (log) => (log || []).concat(entry).slice(-LOG_MAX));
  await store.set({ last: entry });
}

async function readSession(keepAlive) {
  const url = keepAlive ? SESSION_URL : SESSION_URL + '?auto=true';
  const r = await fetch(url, { cache: 'no-store', credentials: 'include' });
  let s = null;
  try { s = await r.json(); } catch {}
  return { status: r.status, ok: r.ok, loggedIn: !!(s && s.userId), maxInactive: s && s.maxInactiveInterval };
}

async function ping() {
  const state = await getState();

  if (state.paused) {
    // The extension is paused after a manual logout. Only read the session
    // ("auto=true" does not set the timer to zero). If the user logged in again, continue.
    try {
      const peek = await readSession(false);
      if (!peek.loggedIn) return null;
      await store.set({ paused: false });
    } catch {
      return null;
    }
  }

  const entry = { time: Date.now(), ok: false, status: 0, loggedIn: null };
  try {
    Object.assign(entry, await readSession(true));
  } catch (e) {
    entry.error = String(e);
  }
  await record(entry);
  return entry;
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
      return { paused: s.paused, autoLogin: s.autoLogin, last: s.last, log: s.log.slice(-10), nextPing: alarm ? alarm.scheduledTime : null };
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
      return { ok: true };
    }
  },
  // The popup opened: record the use, and sync if the data is older than 2 minutes.
  touch: {
    run: async () => {
      await sync.touch();
      const { meta } = await store.get('meta');
      if (!meta || !meta.lastSync || Date.now() - meta.lastSync > MAK.SYNC_FRESH_MS) {
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
  // Change some settings. Each key is checked; unknown keys are ignored.
  setSettings: {
    run: async (msg) => {
      const patch = msg && msg.patch && typeof msg.patch === 'object' ? msg.patch : {};
      const next = await store.update('settings', (cur) => {
        const s = MAK.withDefaults(cur);
        if ('syncEnabled' in patch) s.syncEnabled = !!patch.syncEnabled;
        if (patch.badge && typeof patch.badge === 'object') {
          for (const k of Object.keys(s.badge)) if (k in patch.badge) s.badge[k] = !!patch.badge[k];
        }
        if (Array.isArray(patch.hiddenSites)) s.hiddenSites = [...new Set(patch.hiddenSites.filter((x) => typeof x === 'string'))].slice(0, 500);
        if (patch.hiddenMode === 'sidebar' || patch.hiddenMode === 'everywhere') s.hiddenMode = patch.hiddenMode;
        if (patch.lang === 'es' || patch.lang === 'en') s.lang = patch.lang;
        return s;
      });
      if (patch.syncEnabled === true) sync.run({ force: true }).catch(() => {});
      return next;
    }
  },
  relogin: {
    content: true,
    run: async () => {
      await record({ time: Date.now(), relogin: true });
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
  await ping();
  await sync.run().catch(() => {});
}

ext.runtime.onInstalled.addListener(boot);
ext.runtime.onStartup.addListener(boot);
