// Aulario Plus: a pencil next to the name of each site in MiAulario: in the sidebar, and in the
// page header for the site of the page. The pencil opens a small editor: the user writes a name of
// choice for the site, or goes back to the automatic name. content-early.js shows the new name.
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const PENCIL = 'mak-name-pencil';
  const where = MAK.parsePortalPath(location.pathname);
  const pageSite = where && where.siteId && !MAK.isSpecialSite(where.siteId) ? where.siteId : null;
  const h = MAK.h;

  const PENCIL_CSS = `
    :host { all: initial; color: inherit; display: inline-flex; align-items: center; flex: none; margin-left: 4px; }
    button { font: 15px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: inherit; cursor: pointer; border: 0;
      background: none; opacity: 0.55; padding: 3px 5px; border-radius: 4px; }
    button:hover, button:focus-visible { opacity: 1; background: rgba(127, 127, 127, 0.18); }
  `;
  const EDITOR_CSS = `
    :host { all: initial; }
    .pop { position: fixed; z-index: 2147483000; width: 340px; box-sizing: border-box; padding: 10px;
      font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1d2327; background: #fff;
      border: 1px solid #c9d2d6; border-radius: 8px; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18); }
    .pop[hidden] { display: none; }
    .pop.dark { color: #e8ecee; background: #1e2a28; border-color: #2e4440; }
    label { display: block; font-size: 12px; color: #5f6b73; margin-bottom: 4px; overflow-wrap: anywhere; }
    .dark label { color: #9aa6ad; }
    input { box-sizing: border-box; width: 100%; font: inherit; padding: 5px 8px; border-radius: 6px; border: 1px solid #10524e;
      color: inherit; background: transparent; }
    .row { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
    button { font: inherit; font-size: 13px; cursor: pointer; border-radius: 6px; padding: 4px 10px; border: 1px solid #c9d2d6;
      background: transparent; color: inherit; }
    button.save { background: #10524e; border-color: #10524e; color: #fff; }
    .dark button.save { background: #4fd1a5; border-color: #4fd1a5; color: #0b1a17; }
  `;

  let settings = null;
  let sites = new Map(); // id -> stored site (full title)
  const nameOf = (siteId) => (sites.has(siteId) ? MAK.siteName(sites.get(siteId), settings) : siteId);

  // ---- The editor: one for all the pencils, at a fixed place next to the pencil ----

  let editor = null;
  function getEditor() {
    if (editor) return editor;
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = EDITOR_CSS;
    const label = h('label');
    const input = h('input', { attrs: { type: 'text', maxlength: 40, 'aria-label': MAK.t('names.edit') } });
    let siteId = null;
    let anchor = null; // the pencil that opened the editor
    const close = () => {
      if (pop.hidden) return;
      pop.hidden = true;
      siteId = null;
    };
    const save = async (value) => {
      const id = siteId;
      close();
      await MAK.safeCall(() => ext.runtime.sendMessage({ type: 'renameSite', siteId: id, name: value }), null);
    };
    const pop = h(
      'div',
      { class: 'pop', hidden: true, attrs: { role: 'dialog', 'aria-label': MAK.t('names.edit') } },
      label,
      input,
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'save', text: MAK.t('names.save'), attrs: { type: 'button' }, on: { click: () => save(input.value) } }),
        h('button', { text: MAK.t('names.auto'), attrs: { type: 'button', title: MAK.t('names.autoHelp') }, on: { click: () => save('') } }),
        h('button', { text: MAK.t('names.cancel'), attrs: { type: 'button' }, on: { click: close } })
      )
    );
    // The keys and clicks stay in the editor: the page does not get them.
    pop.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        save(input.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });
    pop.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('mousedown', (e) => {
      const path = e.composedPath();
      if (!path.includes(host) && !path.includes(anchor)) close();
    }, true);
    window.addEventListener('resize', close);
    shadow.append(style, pop);
    document.documentElement.append(host);

    editor = {
      toggle(id, pencil) {
        if (!pop.hidden && siteId === id) return close();
        siteId = id;
        anchor = pencil;
        pop.className = `pop${MAK.isDarkPage() ? ' dark' : ''}`;
        label.textContent = MAK.t('names.editSite', { site: nameOf(id) });
        input.value = nameOf(id);
        pop.hidden = false;
        // Below the pencil, or above it if there is no space below.
        const r = pencil.getBoundingClientRect();
        const left = Math.min(Math.max(8, r.left - 8), window.innerWidth - pop.offsetWidth - 8);
        const below = r.bottom + 6;
        const top = below + pop.offsetHeight > window.innerHeight - 8 ? Math.max(8, r.top - 6 - pop.offsetHeight) : below;
        pop.style.left = `${Math.max(8, left)}px`;
        pop.style.top = `${top}px`;
        input.focus();
        input.select();
      }
    };
    return editor;
  }

  // ---- The pencils -------------------------------------------------------------

  function makePencil(siteId) {
    const host = document.createElement('span');
    host.className = PENCIL;
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = PENCIL_CSS;
    const pen = h('button', {
      text: '✎',
      attrs: { type: 'button', title: MAK.t('names.edit'), 'aria-label': MAK.t('names.edit') },
      on: {
        click: (e) => {
          // The click does not open the site or the list of tools of the sidebar.
          e.preventDefault();
          e.stopPropagation();
          getEditor().toggle(siteId, host);
        }
      }
    });
    shadow.append(style, pen);
    return host;
  }

  function addPencils() {
    if (!settings) return;
    if (pageSite && sites.has(pageSite)) {
      for (const box of document.querySelectorAll('.portal-header-site-title')) {
        if (!box.querySelector(`.${PENCIL}`)) box.append(makePencil(pageSite));
      }
    }
    for (const li of document.querySelectorAll('li.site-list-item[data-site]')) {
      const id = li.getAttribute('data-site');
      const link = li.querySelector('a.sidebar-site-title');
      if (!sites.has(id) || !link) continue;
      const next = link.nextElementSibling;
      if (!(next && next.classList.contains(PENCIL))) link.after(makePencil(id));
    }
  }

  // MiAulario can draw the sidebar again (for example, when you pin a site).
  let timer = null;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(addPencils, 150);
  }).observe(document.documentElement, { childList: true, subtree: true });

  let raw = { settings: null, sites: [] }; // the stored values
  function apply(next) {
    raw = Object.assign({}, raw, next);
    settings = MAK.withDefaults(raw.settings);
    sites = new Map((raw.sites || []).map((s) => [s.id, s]));
    MAK.setLang(settings.lang);
    addPencils();
  }
  MAK.safeCall(() => ext.storage.local.get(['settings', 'sites']), null).then((d) => apply({ settings: d && d.settings, sites: (d && d.sites) || [] }));
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(changes.settings || changes.sites)) return;
    const next = {};
    if (changes.settings) next.settings = changes.settings.newValue;
    if (changes.sites) next.sites = changes.sites.newValue || [];
    apply(next);
  });
})();
