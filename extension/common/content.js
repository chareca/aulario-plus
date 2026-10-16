// MiAulario Keep-Alive: content script for miaulario.unavarra.es (top frame only).
//
// - If you open MiAulario and the Sakai session is not active, the script sends you to
//   the SAML login. If the SSO session is active, you come back logged in. If not, the
//   login form of sso.unavarra.es opens. The password manager of the browser can fill it.
// - If you click "Log out", the script tells the background script to pause.
// - If you open the Announcements tool of a site, the script tells the background script.
//   MiAulario marks these announcements as viewed, and the extension does the same.
// - The script sends the "mark as viewed" requests that the background script could not send.
// - In the Resources tool, the script adds the button "Download all (ZIP)".
// - On each page of a site, the script records the visit. At the start of a new visit, it shows
//   the banner "new since your last visit". On the next pages of the same visit, a short line.

(async () => {
  const ext = globalThis.browser ?? globalThis.chrome;
  // Firefox: content.fetch sends the request as the page. Chromium: fetch does this.
  const pageFetch = globalThis.content && typeof globalThis.content.fetch === 'function' ? globalThis.content.fetch.bind(globalThis.content) : fetch;
  const SAML_LOGIN = '/sakai-login-tool/container/saml/login';
  const LOGOUT_RE = /\/portal\/logout|\/sakai-login-tool\/container\/saml\/logout/i;
  const THROTTLE_MS = 2 * 60 * 1000;
  const THROTTLE_KEY = 'miaulario-keepalive-last-relogin';

  const send = (msg) => Promise.resolve(ext.runtime.sendMessage(msg)).catch(() => null);

  // Manual logout: the background script pauses and removes the persistent cookies.
  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element && e.target.closest('a[href]');
    if (a && LOGOUT_RE.test(a.href)) send({ type: 'logout' });
  }, true);

  // Do not change the login pages or the logout pages.
  if (/\/(xlogin|relogin|logout)|\/sakai-login-tool\//i.test(location.pathname)) return;

  // Return true if the script sends the user to the login page.
  async function reloginIfNeeded() {
    const status = await send({ type: 'getStatus' });
    if (!status || status.paused || !status.autoLogin) return false;
    let loggedIn;
    try {
      // "auto=true": this request only reads the session. Sakai does not record it as activity.
      const s = await pageFetch('/direct/session/current.json?auto=true', { cache: 'no-store', credentials: 'include' }).then((r) => r.json());
      loggedIn = !!s.userId;
    } catch {
      return false;
    }
    if (loggedIn) return false;
    // Prevent a loop if the SSO sends you back to the portal without a session.
    let last = 0;
    try { last = Number(sessionStorage.getItem(THROTTLE_KEY) || 0); } catch {}
    if (Date.now() - last < THROTTLE_MS) return false;
    try { sessionStorage.setItem(THROTTLE_KEY, String(Date.now())); } catch {}
    await send({ type: 'relogin' });
    location.assign(SAML_LOGIN);
    return true;
  }

  // Find the site and the tools of this page with the stored pages of each site.
  async function currentTool() {
    const where = MAK.parsePortalPath(location.pathname);
    if (!where) return null;
    const { pages } = await ext.storage.local.get('pages');
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
      const { settings } = await ext.storage.local.get('settings');
      MAK.setLang(settings && settings.lang === 'en' ? 'en' : 'es');
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
  window.addEventListener('pageshow', (e) => { if (e.persisted) reportVisit('return'); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reportVisit('return'); });
})();
