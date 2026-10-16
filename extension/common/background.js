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
  importScripts('lib/core.js', 'lib/store.js', 'lib/api.js');
}

const api = globalThis.browser ?? globalThis.chrome;

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
  const d = await api.storage.local.get(['paused', 'autoLogin', 'last', 'log']);
  return {
    paused: !!d.paused,
    autoLogin: d.autoLogin !== false,
    last: d.last || null,
    log: d.log || []
  };
}

async function record(entry) {
  const { log } = await getState();
  log.push(entry);
  await api.storage.local.set({ last: entry, log: log.slice(-LOG_MAX) });
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
      await api.storage.local.set({ paused: false });
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
  try { await api.cookies.set(details); } catch {}
}

async function clearPersisted() {
  for (const spec of Object.values(COOKIE_SPECS)) {
    for (const name of Object.keys(spec.names)) {
      try { await api.cookies.remove({ url: spec.url, name }); } catch {}
    }
  }
}

api.cookies.onChanged.addListener(async ({ cookie, removed }) => {
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
        const c = await api.cookies.get({ url: spec.url, name });
        if (c) await persist(c);
      } catch {}
    }
  }
}

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg && msg.type) {
      case 'getStatus': {
        const s = await getState();
        const alarm = await api.alarms.get(PING_ALARM);
        sendResponse({ paused: s.paused, autoLogin: s.autoLogin, last: s.last, log: s.log.slice(-10), nextPing: alarm ? alarm.scheduledTime : null });
        break;
      }
      case 'pingNow':
        sendResponse(await ping());
        break;
      case 'pause':
        await api.storage.local.set({ paused: true });
        sendResponse({ ok: true });
        break;
      case 'resume':
        await api.storage.local.set({ paused: false });
        await persistExisting();
        sendResponse(await ping());
        break;
      case 'setAutoLogin':
        await api.storage.local.set({ autoLogin: !!msg.value });
        sendResponse({ ok: true });
        break;
      case 'logout':
        await api.storage.local.set({ paused: true });
        await clearPersisted();
        sendResponse({ ok: true });
        break;
      case 'relogin':
        await record({ time: Date.now(), relogin: true });
        sendResponse({ ok: true });
        break;
      default:
        sendResponse(null);
    }
  })();
  return true; // The response is asynchronous.
});

function randomDelaySeconds() {
  return PING_MIN_SECONDS + Math.floor(Math.random() * (PING_MAX_SECONDS - PING_MIN_SECONDS + 1));
}

async function scheduleNext() {
  await api.alarms.create(PING_ALARM, { when: Date.now() + randomDelaySeconds() * 1000 });
}

api.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== PING_ALARM) return;
  // First, set the next alarm. If the worker stops during the ping, the sequence continues.
  await scheduleNext();
  await ping();
});

async function boot() {
  const existing = await api.alarms.get(PING_ALARM);
  // If there is no alarm (the browser started) or the alarm is the periodic alarm of v1.0, set a random alarm.
  if (!existing || existing.periodInMinutes) await scheduleNext();
  await persistExisting();
  await ping();
}

api.runtime.onInstalled.addListener(boot);
api.runtime.onStartup.addListener(boot);
