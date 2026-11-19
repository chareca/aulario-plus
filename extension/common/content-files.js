// Aulario Plus: the button of the files of each site, next to ✎ and ✉ in the sidebar of MiAulario (also Mi sitio), and
// in the page header of the site of the page on a phone (as ✎ and ✉). A click opens the tool Recursos of the site; the
// mouse on it (or the arrow down) shows the files and folders of its first level: the stored copy at once (the sync of
// the background), then the ones of now. In the list: a click opens a file, or a folder in Recursos; Ctrl+click
// (⌘+click) in a new tab (the browser does it: they are links); Shift+click downloads a file, or a folder as a ZIP (a
// course: the ZIP of the extension; Mi sitio: the ZIP of MiAulario).
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  // Firefox: content.fetch sends the request as the page. Chromium: fetch does this.
  const pageFetch = globalThis.content && typeof globalThis.content.fetch === 'function' ? globalThis.content.fetch.bind(globalThis.content) : fetch;
  const h = MAK.h;
  const t = MAK.t;
  const BUTTON = 'mak-files-button';
  const AFTER = ['mak-name-pencil', 'mak-teacher-button']; // the buttons of content-names.js: this one after them
  const where = MAK.parsePortalPath(location.pathname);
  const pageSite = where && where.siteId && !MAK.isSpecialSite(where.siteId) ? where.siteId : null;
  const send = (msg) => MAK.safeCall(() => ext.runtime.sendMessage(msg), null);
  const mine = (id) => typeof id === 'string' && id.startsWith('~');

  const BUTTON_CSS = `
    :host { all: initial; color: inherit; display: inline-flex; align-items: center; align-self: center; vertical-align: middle; flex: none; margin-left: 4px; }
    ${MAK.EXT_BUTTON_CSS}
    a.mak-icon { text-decoration: none; }
  `;
  // In the page header, only on a narrow screen (a phone): MiAulario shows the sidebar from 768 px.
  const HEADER_CSS = `${BUTTON_CSS}
    :host { display: none; }
    @media (max-width: 767.98px) { :host { display: inline-flex; } }
  `;
  const LIST_CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .pop { position: fixed; z-index: 2147483000; width: 320px; max-height: min(460px, calc(100vh - 16px)); overflow: auto; padding: 10px;
      font: var(--ap-weight) calc(14px * var(--ap-zoom))/1.4 var(--ap-font); color: var(--ap-fg); background: var(--ap-win-bg);
      border: var(--ap-bw) solid var(--ap-edge); border-radius: var(--ap-radius); box-shadow: var(--ap-shadow-pop);
      -webkit-backdrop-filter: var(--ap-blur); backdrop-filter: var(--ap-blur); }
    .pop[hidden] { display: none; }
    h2 { font-family: var(--ap-font-head); font-weight: var(--ap-head-weight); font-style: var(--ap-head-style); letter-spacing: var(--ap-head-spacing);
      font-size: calc(14px * var(--ap-head-zoom)); margin: 0 0 6px; overflow-wrap: anywhere; }
    ul { list-style: none; margin: 0; padding: 0; }
    li a { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: var(--ap-radius-sm); color: var(--ap-link); text-decoration: none; overflow-wrap: anywhere; }
    li a:hover, li a:focus-visible { background: var(--ap-surface2); text-decoration: underline; }
    li a:focus-visible, a.all:focus-visible { outline: 2px solid var(--ap-fg); outline-offset: 1px; }
    li svg { flex: none; width: 17px; height: 17px; }
    li a.folder svg { color: var(--ap-accent); }
    .status, .help { font-size: 0.86em; color: var(--ap-muted); margin: 6px 2px 0; }
    .status:empty { display: none; }
    a.all { display: inline-block; margin: 8px 2px 0; color: var(--ap-link); font-weight: 700; }
  `;
  const MAX_SHOWN = 40;
  const FRESH_MS = MAK.MINUTE; // the files of now: read again after a minute

  let settings = MAK.withDefaults(null);
  let sites = new Map(); // id -> stored site
  let pages = {}; // id -> stored pages
  const nameOf = (id) => (mine(id) ? t('files.mysite') : sites.has(id) ? MAK.siteName(sites.get(id), settings) : id);

  // The address of Recursos of a site: the stored pages of a course; of Mi sitio, its pages (read once).
  const mineTool = new Map();
  function resourcesUrl(id) {
    if (!mine(id)) {
      const tool = pages[id] && pages[id].tools && pages[id].tools['sakai.resources'];
      return Promise.resolve(tool ? MAK.safeSiteUrl(tool.page) : null);
    }
    if (!mineTool.has(id)) {
      mineTool.set(id, pageFetch(`/direct/site/${encodeURIComponent(id)}/pages.json`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((list) => {
          const page = (Array.isArray(list) ? list : []).find((p) => p && (p.tools || []).some((x) => x && x.toolId === 'sakai.resources'));
          return page ? MAK.safeSiteUrl(page.url) : null;
        })
        .catch(() => null));
    }
    return mineTool.get(id);
  }
  // The root of the ids of the resources of a site ("/group/<site>/", "/user/<id>/").
  const rootOf = (id) => (mine(id) ? `/user/${id.slice(1)}/` : `/group/${id}/`);

  // The files of the first level: the stored copy (a course), and the ones of now (read again after FRESH_MS).
  const fresh = new Map(); // id -> { at, items }
  async function storedFiles(id) {
    if (mine(id)) return null;
    const key = MAK.resourceKey(id);
    const d = (await MAK.safeCall(() => ext.storage.local.get(key), null)) || {};
    return d[key] ? MAK.topFiles(d[key].items) : null;
  }
  async function liveFiles(id) {
    const had = fresh.get(id);
    if (had && Date.now() - had.at < FRESH_MS) return had.items;
    const url = mine(id) ? '/direct/content/my.json' : `/direct/content/site/${encodeURIComponent(id)}.json`;
    const r = await pageFetch(url, { credentials: 'include', cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    const items = MAK.topFiles(((await r.json()) || {}).content_collection);
    fresh.set(id, { at: Date.now(), items });
    return items;
  }

  // ---- The list: one for all the buttons -----------------------------------------------------

  let list = null;
  function getList() {
    if (list) return list;
    const host = document.createElement('div');
    host.setAttribute('data-mak-overlay', '');
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = MAK.themedStyle(LIST_CSS);
    const title = h('h2');
    const items = h('ul');
    const status = h('p', { class: 'status', attrs: { role: 'status' } });
    const all = h('a', { class: 'all', text: t('files.open') });
    const help = h('p', { class: 'help' });
    const pop = h('div', { class: 'pop', hidden: true, attrs: { role: 'dialog' } }, title, items, status, all, help);
    shadow.append(style, pop);
    document.documentElement.append(host);
    let anchor = null; // the button of the list on the screen
    let siteId = null;
    let run = 0;
    let timer = null;

    const place = () => {
      if (pop.hidden || !anchor) return;
      const r = anchor.host.getBoundingClientRect();
      const right = r.right + 8 + pop.offsetWidth <= window.innerWidth - 8;
      pop.style.left = `${right ? r.right + 8 : Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8))}px`;
      pop.style.top = `${right ? Math.max(8, Math.min(r.top - 8, window.innerHeight - pop.offsetHeight - 8)) : Math.min(r.bottom + 6, window.innerHeight - pop.offsetHeight - 8)}px`;
    };
    new ResizeObserver(place).observe(pop);
    addEventListener('resize', place);
    addEventListener('scroll', place, true);

    const close = () => {
      clearTimeout(timer);
      if (pop.hidden) return;
      run++;
      pop.hidden = true;
      if (anchor) anchor.link.setAttribute('aria-expanded', 'false');
      anchor = null;
    };
    // The mouse goes from the button to the list (or back): the list stays.
    const later = () => { clearTimeout(timer); timer = setTimeout(close, 300); };
    pop.addEventListener('mouseenter', () => clearTimeout(timer));
    pop.addEventListener('mouseleave', later);
    pop.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const links = [...shadow.querySelectorAll('li a, a.all')];
      const at = links.indexOf(shadow.activeElement);
      if (e.key === 'Escape') { const back = anchor; close(); if (back) back.link.focus(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = links[(at + (e.key === 'ArrowDown' ? 1 : links.length - 1)) % links.length];
        if (next) next.focus();
      }
    });
    pop.addEventListener('focusout', (e) => { if (!e.relatedTarget || !host.contains(e.relatedTarget)) later(); });
    document.addEventListener('mousedown', (e) => { if (!pop.hidden && !e.composedPath().includes(host) && (!anchor || !e.composedPath().includes(anchor.host))) close(); }, true);

    // A row of the list: a link (Ctrl/⌘+click and the middle button: a new tab, by the browser). Shift+click: download.
    function row(x, base) {
      const folder = x.folder;
      const id = folder ? MAK.resourceId(x.url, rootOf(siteId)) : null;
      // A folder: Recursos, which goes to the folder (content.js, "#mak-folder="); without Recursos, its address.
      const href = folder ? (base && id ? `${base}#mak-folder=${encodeURIComponent(id)}` : base || x.url) : x.link || x.url;
      const a = h('a', { class: folder ? 'folder' : 'file', href: href || x.url, title: x.title || x.name }, MAK.icon(folder ? 'folder' : 'file'), h('span', { text: x.title || x.name }));
      if (x.link) a.setAttribute('target', '_blank');
      else { a.removeAttribute('target'); a.removeAttribute('rel'); }
      a.addEventListener('click', (e) => {
        if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return; // the browser: this tab, or a new one
        e.preventDefault();
        if (folder) return zipFolder(x, base);
        if (x.link || x.copyright) return void location.assign(href); // a link, or a file with the notice of MiAulario
        // A link of this page with "download" (the same site: the browser saves it). In the list: Firefox wants it in a page.
        const get = h('a', { href: x.url, attrs: { download: x.name || '' } });
        get.removeAttribute('target');
        items.append(get);
        get.click();
        get.remove();
      });
      return h('li', null, a);
    }
    // Shift + click on a folder: the ZIP of the extension (a course), or the one of MiAulario (Mi sitio: its list).
    function zipFolder(x, base) {
      if (!mine(siteId)) return send({ type: 'openZip', siteId, folder: x.url });
      const id = MAK.resourceId(x.url, rootOf(siteId));
      if (base && id) location.assign(`${base}#mak-zip=${encodeURIComponent(id)}`);
    }

    function draw(files, base) {
      MAK.fill(items, (files || []).slice(0, MAX_SHOWN).map((x) => row(x, base)));
      const more = files ? files.length - MAX_SHOWN : 0;
      status.textContent = files && !files.length ? t('files.empty') : more > 0 ? t('files.more', { n: more }) : '';
    }

    list = {
      open: async (button, id, focus) => {
        clearTimeout(timer);
        if (anchor === button && !pop.hidden) return focus && shadow.querySelector('li a, a.all') && shadow.querySelector('li a, a.all').focus();
        close();
        const me = ++run;
        anchor = button;
        siteId = id;
        button.link.setAttribute('aria-expanded', 'true');
        title.textContent = t('files.title', { site: nameOf(id) });
        pop.setAttribute('aria-label', title.textContent);
        help.textContent = t('files.help', { key: MAK.isMac() ? '⌘' : 'Ctrl' });
        MAK.fill(items);
        status.textContent = t('files.loading');
        const base = await resourcesUrl(id);
        if (me !== run) return;
        all.hidden = !base;
        if (base) all.setAttribute('href', base);
        pop.hidden = false;
        place();
        const stored = await storedFiles(id);
        if (me !== run) return;
        if (stored) draw(stored, base);
        if (focus) (shadow.querySelector('li a') || all).focus();
        try {
          const now = await liveFiles(id);
          if (me !== run) return;
          const had = shadow.activeElement && shadow.activeElement.getAttribute('href');
          draw(now, base);
          const again = had && [...shadow.querySelectorAll('li a')].find((a) => a.getAttribute('href') === had);
          if (again) again.focus();
        } catch {
          if (me === run && !stored) status.textContent = t('files.error');
        }
      },
      later,
      close
    };
    return list;
  }

  // ---- The button ---------------------------------------------------------------------------

  function makeButton(id, inHeader) {
    const host = document.createElement('span');
    host.className = BUTTON;
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = MAK.themedStyle(inHeader ? HEADER_CSS : BUTTON_CSS);
    const label = `${t('files.button')}: ${nameOf(id)}`;
    const link = h('a', { class: MAK.extButtonClass('icon'), attrs: { title: t('files.button'), 'aria-label': label, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' } }, MAK.icon('folder'));
    link.removeAttribute('target');
    const button = { host, link };
    resourcesUrl(id).then((url) => { if (url) link.setAttribute('href', url); else host.hidden = true; });
    let timer = null;
    link.addEventListener('mouseenter', () => { clearTimeout(timer); timer = setTimeout(() => getList().open(button, id, false), 250); });
    link.addEventListener('mouseleave', () => { clearTimeout(timer); if (list) list.later(); });
    // The click: Recursos (the link); the sidebar of MiAulario does not get it.
    link.addEventListener('click', (e) => e.stopPropagation());
    link.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); getList().open(button, id, true); }
      else if (e.key === 'Escape' && list) list.close();
    });
    shadow.append(style, link);
    return host;
  }

  // After the link of the site and its ✎ and ✉ (content-names.js puts them; this one goes after them, also later).
  function placeAfter(start, id, inHeader) {
    let at = start;
    while (at.nextElementSibling && AFTER.some((c) => at.nextElementSibling.classList.contains(c))) at = at.nextElementSibling;
    const own = start.parentElement.querySelector(`:scope > .${BUTTON}`);
    if (own && own.previousElementSibling === at) return; // in its place: nothing changes (no loop of the observer)
    at.after(own || makeButton(id, inHeader));
  }
  const hasFiles = (id) => mine(id) || (sites.has(id) && pages[id] && pages[id].tools && pages[id].tools['sakai.resources']);

  function addButtons() {
    for (const li of document.querySelectorAll('li.site-list-item[data-site]')) {
      const id = li.getAttribute('data-site');
      const link = li.querySelector('a.sidebar-site-title');
      if (link && hasFiles(id)) placeAfter(link, id, false);
    }
    if (pageSite && hasFiles(pageSite)) {
      for (const box of document.querySelectorAll('.portal-header-site-title')) {
        const start = box.querySelector(':scope > a');
        if (start) placeAfter(start, pageSite, true);
      }
    }
  }

  let timer = null;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(addButtons, 200);
  }).observe(document.documentElement, { childList: true, subtree: true });

  function apply(d) {
    if (!d) return;
    if ('settings' in d) settings = MAK.withDefaults(d.settings);
    if ('sites' in d) sites = new Map((d.sites || []).map((s) => [s.id, s]));
    if ('pages' in d) pages = d.pages || {};
    MAK.setLang(settings.lang);
    addButtons();
  }
  MAK.safeCall(() => ext.storage.local.get(['settings', 'sites', 'pages']), null).then(apply);
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(changes.settings || changes.sites || changes.pages)) return;
    const next = {};
    for (const k of ['settings', 'sites', 'pages']) if (changes[k]) next[k] = changes[k].newValue;
    apply(next);
  });
})();
