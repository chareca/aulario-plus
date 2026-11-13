// Aulario Plus: content script for miaulario.unavarra.es (top frame only).
//
// - If you open MiAulario and the Sakai session is not active, the background script removes the
//   cookies of MiAulario (the ones of a session that ended break the login) and then the script
//   sends you to the SAML login. If the SSO session is active, you come back logged in. If not, the
//   login form of sso.unavarra.es opens. The password manager of the browser can fill it.
//   One login at a time for all the tabs, and none in the 3 minutes after a login (background.js):
//   a login that gave no session is not repeated, and the page stays as MiAulario shows it.
// - The page "your account does not exist" (avisosso.html?user=desconocido): the cookies of MiAulario go and the
//   SAML login opens again (once in 3 minutes).
// - When MiAulario warns that the session ends in 10 minutes, the script presses the button of the
//   warning (the setting "keepMethod": 'button' or 'both').
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

  // The page "your account does not exist" (avisosso.html?user=desconocido), after a login that went wrong: the
  // background removes the cookies of MiAulario (the ones of the session before break the login), then the login
  // again, which works. Once in the LOGIN_GAP_MS of background.js: a login that ends here again stays here (no loop).
  if (location.pathname === '/avisosso.html' && new URLSearchParams(location.search).get('user') === 'desconocido') {
    if (await send({ type: 'loginStart', repair: true })) location.assign(SAML_LOGIN);
    return;
  }

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
    // Another tab logs in, or a login of the last minutes: no login. Else the background removed the cookies of
    // MiAulario before its answer: the login page opens only after it.
    if (!(await send({ type: 'loginStart' }))) return false;
    location.assign(SAML_LOGIN);
    return true;
  }

  // The warning of MiAulario 10 minutes before the end of the session (#timeout_alert_body, which the portal adds to
  // the body): with the method of the button, the script presses its button "Mantenme activo" (keep_session_alive()
  // of the portal: a request that Sakai counts as activity; the warning goes). A warning without that button: the
  // background sends the request. Each warning once.
  function watchTimeout() {
    let seen = null;
    const check = async () => {
      const box = document.getElementById('timeout_alert_body');
      if (!box || box === seen) return;
      seen = box;
      const d = (await MAK.safeCall(() => ext.storage.local.get(['settings', 'paused']), null)) || {};
      if (d.paused || !MAK.keepsBy(MAK.withDefaults(d.settings).keepMethod, 'button')) return;
      const button = box.querySelector('[onclick*="keep_session_alive"]');
      if (button && box.isConnected) button.click();
      else send({ type: 'keepAlive' });
    };
    new MutationObserver(check).observe(document.body, { childList: true });
    check();
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
        { text: MAK.t('drive.upload'), title: MAK.t('drive.uploadHelp'), big: true, onClick: () => driveUpload(form, id.value) },
        { text: MAK.t('zip.button'), title: MAK.t('drive.zipHelp'), onClick: (ui) => driveAction(form, root, 'zipDownload', ui) },
        { text: MAK.t('drive.trash'), title: MAK.t('drive.trashHelp'), onClick: (ui) => driveAction(form, root, 'delete', ui) }
      ]);
    }
  }

  // "Mi sitio" → Recursos: "Subir archivos", the action "Subir archivo(s)" of the folder on the screen, which MiAulario
  // keeps in its menu "Acciones". Its own link of the list (the first one: the folder of the top); without it, the
  // same action in the form of the list.
  function driveUpload(form, folder) {
    const link = form.querySelector('a[onclick*="fileUpload"]');
    if (link) return link.click();
    const item = form.querySelector('#selectedItemId') || form.appendChild(MAK.h('input', { attrs: { type: 'hidden', name: 'selectedItemId' } }));
    item.value = folder;
    form.querySelector('#sakai_action').value = 'doDispatchAction';
    form.querySelector('#rt_action').value = 'org.sakaiproject.content.types.fileUpload:create';
    form.submit();
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

  // A window over the first page of MiAulario, once (the background says it and marks it seen): the news of a new
  // version in one line, with a button to all of them.
  async function pageNotice() {
    if (!MAK.askWindow) return;
    const r = await send({ type: 'pageNotice' });
    if (!r || !r.kind) return;
    MAK.setLang(r.lang);
    if (await MAK.askWindow(MAK.t('release.title', { version: r.version }), r.text, MAK.t('release.see'), MAK.t('release.close'))) send({ type: 'openNews' });
  }

  if (await reloginIfNeeded()) return;
  watchTimeout();
  pageNotice();
  reportToolVisit();
  flushPendingMarkViewed();
  reportVisit('load');
  // After a reload of the extension, the old script of this tab does nothing more.
  window.addEventListener('pageshow', (e) => { if (e.persisted && MAK.extensionAlive()) reportVisit('return'); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && MAK.extensionAlive()) reportVisit('return'); });
})();
