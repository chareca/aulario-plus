// Aulario Plus: content script for miaulario.unavarra.es (top frame only).
//
// - If you open MiAulario and the Sakai session is not active, the script sends you to
//   the SAML login. If the SSO session is active, you come back logged in. If not, the
//   login form of sso.unavarra.es opens. The password manager of the browser can fill it.
// - If a login of the last 2 minutes did not give a session, the script asks the background
//   script to remove the session cookies, and opens the login one more time (once in 10 minutes).
// - If you click "Log out", the script tells the background script to pause.
// - If you open the Announcements tool of a site, the script tells the background script.
//   The extension marks these announcements as read, also in the bell of MiAulario.
// - The script sends the "mark as viewed" requests that the background script could not send.
// - In the Resources tool, the script adds the button "Download all (ZIP)".
// - On each page of a site, the script records the visit. At the start of a new visit, it shows
//   the banner "new since your last visit". On the next pages of the same visit, a short line.

(async () => {
  const ext = globalThis.browser ?? globalThis.chrome;
  // Firefox: content.fetch sends the request as the page. Chromium: fetch does this.
  const pageFetch = globalThis.content && typeof globalThis.content.fetch === 'function' ? globalThis.content.fetch.bind(globalThis.content) : fetch;
  const SAML_LOGIN = '/sakai-login-tool/container/saml/login';
  // The paths of the logout links of MiAulario (a link of another site with the same path is not one).
  const LOGOUT_RE = /^\/(portal\/logout|sakai-login-tool\/container\/saml\/logout)/i;
  const LOGIN_RE = /\/portal\/x?login\b|\/portal\/site\/login-|\/sakai-login-tool\/container\/saml\/login/i;
  const THROTTLE_MS = 2 * 60 * 1000;
  const THROTTLE_KEY = 'aulario-plus-last-relogin'; // the last login (of the extension or of the user)
  const REPAIR_MS = 10 * 60 * 1000;
  const REPAIR_KEY = 'aulario-plus-last-repair';
  const since = (key) => {
    let t = 0;
    try { t = Number(sessionStorage.getItem(key) || 0); } catch {}
    return Date.now() - t;
  };
  const mark = (key) => {
    try { sessionStorage.setItem(key, String(Date.now())); } catch {}
  };

  const send = (msg) => MAK.safeCall(() => ext.runtime.sendMessage(msg), null);

  // Manual logout: the background script pauses and removes the persistent cookies.
  // A click on a login link: record the time of the login.
  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element && e.target.closest('a[href]');
    if (a && a.origin === MAK.BASE && LOGOUT_RE.test(a.pathname)) send({ type: 'logout' });
    else if (a && LOGIN_RE.test(a.href)) mark(THROTTLE_KEY);
  }, true);

  // Do not change the login pages or the logout pages.
  if (/\/(xlogin|relogin|logout)|\/sakai-login-tool\//i.test(location.pathname)) return;

  // Return true if the script sends the user to the login page.
  async function reloginIfNeeded() {
    const status = await send({ type: 'getStatus' });
    if (!status) return false;
    let loggedIn;
    try {
      // "auto=true": this request only reads the session. Sakai does not record it as activity.
      const s = await pageFetch('/direct/session/current.json?auto=true', { cache: 'no-store', credentials: 'include' }).then((r) => r.json());
      loggedIn = !!s.userId;
    } catch {
      return false;
    }
    if (loggedIn) return false;
    if (since(THROTTLE_KEY) < THROTTLE_MS) {
      // A login of the last 2 minutes did not give a session: the SSO sent you back without one.
      // An old copy of the session cookie can cause this. Remove the session cookies and log in
      // again, only once in 10 minutes (no loop).
      if (since(REPAIR_KEY) < REPAIR_MS) return false;
      mark(REPAIR_KEY);
      mark(THROTTLE_KEY);
      await send({ type: 'repairSession' });
      location.assign(SAML_LOGIN);
      return true;
    }
    if (status.paused || !status.autoLogin) return false;
    mark(THROTTLE_KEY);
    location.assign(SAML_LOGIN);
    return true;
  }

  // Find the site and the tools of this page with the stored pages of each site.
  async function currentTool() {
    const where = MAK.parsePortalPath(location.pathname);
    if (!where) return null;
    const { pages } = await MAK.safeCall(() => ext.storage.local.get('pages'), {});
    if (!pages) return where.siteId ? { siteId: where.siteId, toolIds: [] } : null;
    if (where.siteId) {
      const p = pages[where.siteId];
      if (!p || !where.pageOrTool) return { siteId: where.siteId, toolIds: [] };
      const toolIds = (p.pageTools && p.pageTools[where.pageOrTool]) || (p.placements && p.placements[where.pageOrTool] ? [p.placements[where.pageOrTool]] : []);
      return { siteId: where.siteId, toolIds };
    }
    for (const [siteId, p] of Object.entries(pages)) {
      if (p.placements && p.placements[where.placement]) return { siteId, toolIds: [p.placements[where.placement]] };
    }
    return null;
  }

  async function reportToolVisit() {
    const here = await currentTool();
    if (here && here.toolIds.includes('sakai.announcements')) send({ type: 'toolVisit', siteId: here.siteId, toolId: 'sakai.announcements' });
    if (here && here.toolIds.includes('sakai.resources') && !MAK.isSpecialSite(here.siteId)) {
      const { settings } = await MAK.safeCall(() => ext.storage.local.get('settings'), {});
      MAK.setLang(settings && settings.lang);
      MAK.showZipButton(() => send({ type: 'openZip', siteId: here.siteId }));
    }
  }

  async function flushPendingMarkViewed() {
    const list = await send({ type: 'takePendingMarkViewed' });
    for (const x of Array.isArray(list) ? list : []) {
      let ok = false;
      try {
        const q = `siteId=${encodeURIComponent(x.siteId)}&toolId=${encodeURIComponent(x.toolId)}`;
        const r = await pageFetch(`/api/users/me/notifications/markViewed?${q}`, { method: 'POST', credentials: 'include' });
        ok = r.ok;
      } catch {}
      await send({ type: 'pendingMarkViewedDone', siteId: x.siteId, toolId: x.toolId, ok });
    }
  }

  // Record the visit of the site. mode 'load': show the banner (or the short line).
  // mode 'return' (the tab is visible again, or the page comes from the back/forward cache):
  // show the banner only if a new visit started.
  async function reportVisit(mode) {
    const here = await currentTool();
    if (!here || MAK.isSpecialSite(here.siteId)) return;
    const r = await send({ type: 'visit', siteId: here.siteId });
    if (!r) return;
    if (mode === 'return' && !r.isNew) return;
    MAK.setLang(r.lang);
    MAK.showNewsBanner({ siteId: here.siteId, result: r, compact: !r.isNew });
  }

  if (await reloginIfNeeded()) return;
  reportToolVisit();
  flushPendingMarkViewed();
  reportVisit('load');
  // After a reload of the extension, the old script of this tab does nothing more.
  window.addEventListener('pageshow', (e) => { if (e.persisted && MAK.extensionAlive()) reportVisit('return'); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && MAK.extensionAlive()) reportVisit('return'); });
})();
