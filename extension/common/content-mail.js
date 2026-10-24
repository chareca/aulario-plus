// Aulario Plus: "Send by mail" in the Resources tool of MiAulario.
// - A button ✉ next to each file of the list.
// - A bar when the user selects files: "Send by mail" and "Send them to me".
// Both open the mail window (lib/mail-ui.js). The files go as attachments of the internal mail
// of the site: the server attaches a copy, nothing is downloaded. If the user enabled the download
// links, the background makes a link without a login (Send) for the message.
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const where = MAK.parsePortalPath(location.pathname);
  const siteId = where && where.siteId && !MAK.isSpecialSite(where.siteId) ? where.siteId : null;
  if (!siteId) return;
  const h = MAK.h;
  const BUTTON = 'mak-mail-button';
  const MAX_SHARE_BYTES = 25 * 1024 * 1024;
  const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  let mailTool = null; // { placement, page }
  let siteName = siteId; // the name for the user (it can be a name from the user)
  let publicName = siteId; // the name for the recipients (MAK.publicSiteName)
  let linkSettings = null; // settings.links

  // A download link without a login: the background gets the files, encrypts them and uploads them.
  async function makeLink(files) {
    const r = await MAK.safeCall(() => ext.runtime.sendMessage({ type: 'makeLink', siteId, name: publicName, files: files.map((f) => ({ itemId: f.itemId })) }), null);
    if (r && r.link) return r;
    const code = (r && r.error) || 'send.network';
    throw Object.assign(new Error(r && r.detail ? `${code}: ${r.detail}` : code), { code });
  }

  // The files of the list: the checkbox has the id of the resource ("/group/<site>/<path>").
  function fileRows() {
    const out = [];
    for (const cb of document.querySelectorAll('input[type=checkbox][name="selectedMembers"]')) {
      if (!cb.value || cb.value.endsWith('/')) continue; // a folder
      const row = cb.closest('tr');
      const cell = row && row.querySelector('td.title');
      // Only a file of MiAulario: the window reads it with the session.
      const link = cell && [...cell.querySelectorAll('a[href]')].find((a) => MAK.safeSiteUrl(a.href) && new URL(a.href).pathname.startsWith('/access/content/') && oneLine(a.textContent));
      if (!link) continue;
      out.push({ cb, cell, link, itemId: cb.value, title: oneLine(link.textContent), url: link.href });
    }
    return out;
  }

  // ---- The window ----------------------------------------------------------------

  let open = null; // the host of the window, while it is open
  function shareFiles(files) {
    if (!(navigator.canShare && navigator.share)) return null;
    try {
      if (!navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })) return null;
    } catch {
      return null;
    }
    // The files go to the memory of the page, never to Downloads. stop(): the window closed.
    const stopper = new AbortController();
    return {
      stop: () => stopper.abort(),
      files: (async () => {
        let total = 0;
        const out = [];
        for (const f of files) {
          const r = await fetch(f.url, { credentials: 'include', signal: stopper.signal });
          if (!r.ok) throw new Error(String(r.status));
          if (total + Number(r.headers.get('content-length') || 0) > MAX_SHARE_BYTES) throw Object.assign(new Error('tooBig'), { code: 'tooBig' });
          const blob = await r.blob();
          total += blob.size;
          if (total > MAX_SHARE_BYTES) throw Object.assign(new Error('tooBig'), { code: 'tooBig' });
          out.push(new File([blob], f.title, { type: blob.type || 'application/octet-stream' }));
        }
        return out;
      })()
    };
  }

  function openWindow(files, mode) {
    if (open || !mailTool) return;
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = MAK.themedStyle(MAK.MAIL_CSS());
    const into = h('div');
    const backdrop = h('div', { class: 'backdrop' }, into);
    let view = null;
    const share = shareFiles(files);
    let stopEsc = null;
    const close = () => {
      if (share) share.stop(); // the files for "Share" are not needed any more
      if (stopEsc) stopEsc();
      host.remove();
      open = null;
    };
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop && !(view && view.isBusy())) close(); });
    // The keys stay in the window: the page does not get them.
    backdrop.addEventListener('keydown', (e) => e.stopPropagation());
    shadow.append(style, backdrop);
    document.documentElement.append(host);
    stopEsc = MAK.escCloses(backdrop, () => !(view && view.isBusy()) && close());
    open = host;
    view = MAK.mailWindow(into, {
      site: { name: siteName, fullName: publicName },
      files,
      mode,
      placement: mailTool.placement,
      pm: MAK.createPm({ load: MAK.pmLoader((u, i) => fetch(u, i)) }),
      myEid: async () => (await (await fetch('/direct/session/current.json?auto=true', { credentials: 'include' })).json()).userEid,
      openTool: () => MAK.safeCall(() => ext.runtime.sendMessage({ type: 'openMailTool', siteId }), null),
      share,
      links: linkSettings && linkSettings.enabled
        ? { mode: linkSettings.mode, downloads: linkSettings.downloads, seconds: linkSettings.seconds, make: () => makeLink(files) }
        : null,
      onClose: close
    });
  }

  // ---- The buttons and the bar -----------------------------------------------------

  function buttonFor(file) {
    const host = document.createElement('span');
    host.className = BUTTON;
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = MAK.themedStyle(`:host { all: initial; color: inherit; display: inline-flex; margin-left: 6px; vertical-align: middle; } ${MAK.EXT_BUTTON_CSS}`);
    const btn = h('button', { class: MAK.extButtonClass('icon'), attrs: { type: 'button', title: MAK.t('mail.button'), 'aria-label': `${MAK.t('mail.button')}: ${file.title}` } }, MAK.icon('mail'));
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openWindow([file], 'me');
    });
    shadow.append(style, btn);
    return host;
  }

  let bar = null;
  function drawBar() {
    const chosen = fileRows().filter((f) => f.cb.checked);
    if (!chosen.length) {
      if (bar) bar.host.remove();
      bar = null;
      return;
    }
    if (!bar) {
      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'closed' });
      const style = MAK.themedStyle(`:host { all: initial; } .bar { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 2147482999;
        display: flex; gap: 10px; align-items: center; padding: 8px 12px; font: var(--ap-weight) calc(14px * var(--ap-zoom))/1.4 var(--ap-font);
        color: var(--ap-fg); background: var(--ap-win-bg); border: var(--ap-bw) solid var(--ap-edge); border-radius: var(--ap-radius); box-shadow: var(--ap-shadow-pop);
        -webkit-backdrop-filter: var(--ap-blur); backdrop-filter: var(--ap-blur); }
        ${MAK.EXT_BUTTON_CSS} .mak-btn { white-space: nowrap; padding: 5px 10px; }`);
      const text = h('span');
      const send = h('button', { class: MAK.extButtonClass('btn'), attrs: { type: 'button' } });
      const me = h('button', { class: MAK.extButtonClass('btn'), attrs: { type: 'button' } });
      const box = h('div', { class: 'bar', attrs: { role: 'region', 'aria-label': MAK.t('mail.title') } }, text, send, me);
      shadow.append(style, box);
      document.documentElement.append(host);
      bar = { host, box, text, send, me };
      send.addEventListener('click', () => openWindow(fileRows().filter((f) => f.cb.checked), 'others'));
      me.addEventListener('click', () => openWindow(fileRows().filter((f) => f.cb.checked), 'me'));
    }
    bar.box.className = 'bar';
    bar.text.textContent = MAK.t('mail.bar', { n: chosen.length });
    bar.send.textContent = MAK.t('mail.barSend');
    bar.me.textContent = MAK.t('mail.barMe', { n: chosen.length });
  }

  function addButtons() {
    if (!mailTool) return;
    for (const f of fileRows()) if (!f.cell.querySelector(`.${BUTTON}`)) f.link.after(buttonFor(f));
    drawBar();
  }

  // The selection: the checkboxes of the files and "select all".
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el && el.type === 'checkbox' && (el.name === 'selectedMembers' || el.name === 'selectall')) setTimeout(drawBar, 0);
  }, true);

  let timer = null;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(addButtons, 200);
  }).observe(document.documentElement, { childList: true, subtree: true });

  // The internal mail of the site, its name and the language. Also when the first sync comes later.
  const raw = {};
  function setup(next) {
    Object.assign(raw, next);
    const tool = raw.pages && raw.pages[siteId] && raw.pages[siteId].tools['sakai.messages'];
    if (!tool || !tool.placement) return; // this site has no internal mail
    const settings = MAK.withDefaults(raw.settings);
    MAK.setLang(settings.lang);
    const site = (raw.sites || []).find((s) => s.id === siteId);
    siteName = site ? MAK.siteName(site, settings) : siteId;
    publicName = site ? MAK.publicSiteName(site) : siteId;
    linkSettings = settings.links;
    mailTool = { placement: tool.placement };
    addButtons();
  }
  MAK.safeCall(() => ext.storage.local.get(['pages', 'sites', 'settings']), null).then((d) => setup(d || {}));
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const next = {};
    for (const k of ['pages', 'sites', 'settings']) if (changes[k]) next[k] = changes[k].newValue;
    if (Object.keys(next).length) setup(next);
  });
})();
