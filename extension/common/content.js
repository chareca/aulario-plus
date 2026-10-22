// Aulario Plus: content script for miaulario.unavarra.es (top frame only).
//
// - If you open MiAulario and the Sakai session is not active, the script sends you to
//   the SAML login. If the SSO session is active, you come back logged in. If not, the
//   login form of sso.unavarra.es opens. The password manager of the browser can fill it.
//   One login at a time for all the tabs, and none in the 3 minutes after a login (background.js):
//   a login that gave no session is not repeated, and the page stays as MiAulario shows it.
// - This only with MAK.KEEP_SESSION (lib/core.js). Without it, a window says once that keeping the
//   session is off for now.
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

  const send = (msg) => MAK.safeCall(() => ext.runtime.sendMessage(msg), null);

  // Manual logout: the background script pauses and removes the persistent cookies.
  // A click on a login link: record the time of the login.
  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element && e.target.closest('a[href]');
    if (a && a.origin === MAK.BASE && LOGOUT_RE.test(a.pathname)) send({ type: 'logout' });
    else if (a && LOGIN_RE.test(a.href)) send({ type: 'loginStart', user: true }); // no automatic login during it
  }, true);

  // Do not change the login pages or the logout pages.
  if (/\/(xlogin|relogin|logout)|\/sakai-login-tool\//i.test(location.pathname)) return;

  // Return true if the script sends the user to the login page.
  async function reloginIfNeeded() {
    if (!MAK.KEEP_SESSION) return false;
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
    if (!(await send({ type: 'loginStart' }))) return false; // another tab logs in, or a login of the last minutes
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
      // Own keys only: the page comes from the address ("__proto__" is not a page).
      const own = (o, k) => (o && Object.hasOwn(o, k) ? o[k] : null);
      const toolIds = own(p.pageTools, where.pageOrTool) || (own(p.placements, where.pageOrTool) ? [p.placements[where.pageOrTool]] : []);
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
    const course = here && here.toolIds.includes('sakai.resources') && !MAK.isSpecialSite(here.siteId);
    const form = document.getElementById('showForm');
    const id = form && form.querySelector('#collectionId');
    const root = id && form.querySelector('#sakai_action') && form.querySelector('#rt_action') ? MAK.driveRoot(id.value) : null;
    if (!course && !root) return;
    const { settings } = await MAK.safeCall(() => ext.storage.local.get('settings'), {});
    MAK.setLang(settings && settings.lang);
    if (course) MAK.showResourceButtons([{ text: MAK.t('zip.button'), onClick: () => send({ type: 'openZip', siteId: here.siteId }) }]);
    else {
      MAK.showResourceButtons([
        { text: MAK.t('zip.button'), title: MAK.t('drive.zipHelp'), onClick: (ui) => driveAction(form, root, 'zipDownload', ui) },
        { text: MAK.t('drive.trash'), title: MAK.t('drive.trashHelp'), onClick: (ui) => driveAction(form, root, 'delete', ui) }
      ]);
    }
  }

  // "Mi sitio" → Recursos: the files of the user, as a personal drive. Download all of them as one ZIP, or
  // send all of them to the trash: the form of the list gets all the files and folders of the first level
  // (also the ones of other pages of the list), and MiAulario asks to confirm. The trash keeps them
  // (Recursos → Papelera); before it, a window of the extension asks too. action: 'zipDownload' or 'delete' (the actions of
  // the list of MiAulario). ui: the messages of the bar (MAK.showResourceButtons).
  async function driveAction(form, root, action, ui) {
    const say = ui.say;
    say(MAK.t('drive.reading'));
    let ids;
    try {
      const r = await pageFetch('/direct/content/my.json', { credentials: 'include', cache: 'no-store' }); // the files of Mi sitio of the user
      if (!r.ok) throw new Error(String(r.status));
      ids = MAK.driveTopIds(((await r.json()) || {}).content_collection, root);
    } catch {
      return say(MAK.t('drive.error'));
    }
    if (!ids.length) return say(MAK.t('drive.empty'));
    say('');
    if (action === 'delete' && !(await ui.ask(MAK.t('drive.confirmTitle'), MAK.t('drive.confirm', { n: ids.length }), MAK.t('drive.confirmYes')))) return;
    for (const box of form.querySelectorAll('input[name="selectedMembers"]')) box.checked = false;
    form.append(...ids.map((value) => MAK.h('input', { attrs: { type: 'hidden', name: 'selectedMembers', value } })));
    form.querySelector('#sakai_action').value = 'doMultiItemDispatch';
    form.querySelector('#rt_action').value = action;
    form.submit();
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

  // A window over the first page of MiAulario, each one once (the background says which one and marks it seen):
  // keeping the session is off for now, or the news of a new version in one line, with a button to all of them.
  async function pageNotice() {
    if (!MAK.askWindow) return;
    const r = await send({ type: 'pageNotice' });
    if (!r || !r.kind) return;
    MAK.setLang(r.lang);
    if (r.kind === 'keepOff') return MAK.askWindow(MAK.t('keepOff.title'), MAK.t('keepOff.text'), MAK.t('keepOff.ok'), null);
    if (await MAK.askWindow(MAK.t('release.title', { version: r.version }), r.text, MAK.t('release.see'), MAK.t('release.close'))) send({ type: 'openNews' });
  }

  if (await reloginIfNeeded()) return;
  pageNotice();
  reportToolVisit();
  flushPendingMarkViewed();
  reportVisit('load');
  // After a reload of the extension, the old script of this tab does nothing more.
  window.addEventListener('pageshow', (e) => { if (e.persisted && MAK.extensionAlive()) reportVisit('return'); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && MAK.extensionAlive()) reportVisit('return'); });
})();
