// Aulario Plus: a pencil next to the name of each site in MiAulario: in the sidebar, and in the
// page header for the site of the page. The pencil opens a small editor: the user writes a name of
// choice for the site, or goes back to the automatic name. content-early.js shows the new name.
// Next to the pencil, the button ✉ "Write to a teacher" (sites with the internal mail): the user
// selects a teacher, and the internal mail of the site opens with this recipient. The user writes
// the message and sends it in MiAulario.
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const PENCIL = 'mak-name-pencil';
  const ENVELOPE = 'mak-teacher-button';
  const where = MAK.parsePortalPath(location.pathname);
  const pageSite = where && where.siteId && !MAK.isSpecialSite(where.siteId) ? where.siteId : null;
  const h = MAK.h;

  // The buttons ✎ and ✉ have the color of the extension (MAK.EXT_BUTTON_CSS).
  const PENCIL_CSS = `
    :host { all: initial; color: inherit; display: inline-flex; align-items: center; align-self: center; vertical-align: middle; flex: none; margin-left: 4px; }
    ${MAK.EXT_BUTTON_CSS}
  `;
  // In the page header, only on a narrow screen (a phone): MiAulario shows the sidebar from 768 px,
  // and the sidebar has the same buttons.
  const HEADER_CSS = `${PENCIL_CSS}
    :host { display: none; }
    @media (max-width: 767.98px) { :host { display: inline-flex; } }
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

  const PICKER_CSS = `${EDITOR_CSS}
    .pop { width: 360px; max-height: min(480px, calc(100vh - 16px)); overflow: auto; }
    header { display: flex; align-items: baseline; gap: 6px; margin-bottom: 6px; }
    h2 { font-size: 14px; margin: 0; flex: 1; }
    button.x { border: 0; font-size: 16px; line-height: 1; padding: 2px 6px; }
    h3 { font-size: 12px; font-weight: 600; margin: 10px 0 4px; color: #5f6b73; }
    .dark h3 { color: #9aa6ad; }
    .people { display: flex; flex-direction: column; gap: 4px; }
    .people button { text-align: left; width: 100%; }
    .people button:hover, .people button:focus-visible { border-color: #10524e; }
    .person { display: flex; gap: 6px; align-items: center; }
    .person button { flex: 1; }
    ${MAK.LINK_CSS}
    .person .mak-link { font-size: 12px; white-space: nowrap; }
    .tag { font-size: 11px; margin-left: 6px; padding: 0 6px; border-radius: 9px; background: #e6f4ea; color: #137333; white-space: nowrap; }
    .dark .tag { background: #1e3326; color: #81c995; }
    .help, .status { font-size: 12px; color: #5f6b73; margin: 8px 0 0; }
    .dark .help, .dark .status { color: #9aa6ad; }
    .status.error { color: #c5221f; } .dark .status.error { color: #f28b82; }
    input[type=search] { margin-bottom: 4px; border-color: #c9d2d6; }
  `;

  let settings = null;
  let pages = {}; // id -> stored pages (the tools of the site)
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

  // ---- "Write to a teacher": one window for all the buttons ✉ -------------------------

  const mailTool = (siteId) => {
    const tool = pages[siteId] && pages[siteId].tools && pages[siteId].tools['sakai.messages'];
    return tool && tool.placement && MAK.safeSiteUrl(tool.page) ? tool : null;
  };
  let picker = null;
  function getPicker() {
    if (picker) return picker;
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = PICKER_CSS;
    const title = h('h2');
    const list = h('div');
    const status = h('p', { class: 'status', attrs: { role: 'status' } });
    let anchor = null;
    let run = 0; // a new opening makes the old answers useless
    let busy = false;
    const close = () => {
      if (busy) return;
      pop.hidden = true;
      run++;
    };
    const pop = h(
      'div',
      { class: 'pop', hidden: true, attrs: { role: 'dialog', 'aria-label': MAK.t('teach.button') } },
      h('header', null, title, h('button', { class: 'x', text: '✕', attrs: { type: 'button', 'aria-label': MAK.t('mail.close') }, on: { click: close } })),
      list,
      status,
      h('p', { class: 'help', text: MAK.t('teach.help') })
    );
    pop.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') close();
    });
    pop.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('mousedown', (e) => {
      const path = e.composedPath();
      if (!pop.hidden && !path.includes(host) && !path.includes(anchor)) close();
    }, true);
    shadow.append(style, pop);
    document.documentElement.append(host);
    const say = (text, error) => {
      status.className = `status${error ? ' error' : ''}`;
      status.textContent = text || '';
    };

    // The person is the recipient of a new message in the internal mail of the site. MiAulario
    // keeps the prepared form, and its page opens with it. Nothing is sent.
    async function write(siteId, tool, pm, compose, person, me, buttons) {
      busy = true;
      for (const b of buttons) b.disabled = true;
      say(MAK.t('teach.preparing', { name: person.name }));
      // The text: "Hola <first name>," an empty line, "Saludos," and the first name of the user.
      const body = MAK.teacherMessage(person.label, me && me.label);
      const data = { to: [{ value: person.value, label: person.label }], subject: '', body, emailCopy: true, files: [] };
      try {
        try {
          await pm.prepare(compose, data, { open: true });
        } catch (e) {
          // MiAulario sometimes fails one time: a new compose form, one more time.
          if (!['pm.noPicker', 'pm.http', 'pm.network', 'pm.recipientGone'].includes(e && e.code)) throw e;
          await pm.prepare(await pm.open(tool.placement), data, { open: true });
        }
        location.assign(MAK.safeSiteUrl(tool.page));
      } catch (e) {
        busy = false;
        for (const b of buttons) b.disabled = false;
        say(MAK.mailError(e), true);
      }
    }

    function draw(siteId, tool, pm, compose, groups, me, guide) {
      const buttons = [];
      // With the course guide: the responsible teacher first, and the link to the office hours.
      const withGuide = (list) => list
        .map((p) => {
          const g = guide ? MAK.guideTeacher(guide, p.label) : null;
          return Object.assign({}, p, { resp: !!(g && g.resp), tutorias: (g && g.tutorias) || null });
        })
        .sort((a, b) => Number(b.resp) - Number(a.resp));
      const personRow = (p) => {
        const b = h('button', { attrs: { type: 'button' }, on: { click: () => write(siteId, tool, pm, compose, p, me, buttons) } },
          p.eid ? `${p.name} (${p.eid})` : p.name,
          p.resp ? h('span', { class: 'tag', text: MAK.t('teach.responsible') }) : null);
        buttons.push(b);
        return h('div', { class: 'person' }, b, p.tutorias ? MAK.link(p.tutorias, MAK.t('guide.officeHours'), { attrs: { title: MAK.t('teach.officeHoursHelp') } }) : null);
      };
      const parts = groups.map((g) => {
        const people = h('div', { class: 'people' }, withGuide(g.people).map(personRow));
        let search = null;
        if (g.people.length > 12) {
          search = h('input', { attrs: { type: 'search', placeholder: MAK.t('teach.search'), 'aria-label': MAK.t('teach.search') }, on: { input: () => {
            for (const b of people.children) b.hidden = !MAK.matchesQuery(b.textContent, search.value);
          } } });
        }
        const head = h('h3', { text: `${MAK.t(`teach.group.${g.key}`)} (${g.people.length})` });
        // Many other teaching staff (sites of a degree): closed, to open if necessary.
        if (g.key === 'assistant' && groups.length > 1) return h('details', null, h('summary', null, head), search, people);
        return [head, search, people];
      });
      MAK.fill(list, groups.length ? parts : h('p', { class: 'status', text: MAK.t('teach.none') }));
      say('');
      if (buttons[0]) buttons[0].focus();
    }

    picker = {
      async toggle(siteId, button) {
        if (!pop.hidden && anchor === button) return close();
        const tool = mailTool(siteId);
        if (!tool || busy) return;
        const mine = ++run;
        anchor = button;
        pop.className = `pop${MAK.isDarkPage() ? ' dark' : ''}`;
        title.textContent = `✉ ${MAK.t('teach.title', { site: nameOf(siteId) })}`;
        MAK.fill(list);
        say(MAK.t('teach.loading'));
        pop.hidden = false;
        const r = button.getBoundingClientRect();
        pop.style.left = `${Math.max(8, Math.min(r.left - 8, window.innerWidth - pop.offsetWidth - 8))}px`;
        pop.style.top = `${Math.max(8, r.bottom + 6 + pop.offsetHeight > window.innerHeight - 8 ? r.top - 6 - pop.offsetHeight : r.bottom + 6)}px`;
        try {
          const pm = MAK.createPm({ load: MAK.pmLoader((u, i) => fetch(u, i)) });
          const myEid = (await (await fetch('/direct/session/current.json?auto=true', { credentials: 'include' })).json()).userEid;
          const send = (m) => MAK.safeCall(() => ext.runtime.sendMessage(m), null);
          const data = (await MAK.safeCall(() => ext.storage.local.get(['pages', 'guides']), null)) || {};
          const [{ compose, groups, me }, guide] = await Promise.all([
            MAK.loadTeachers({ siteId, placement: tool.placement, pm, myEid, doFetch: (u, i) => fetch(u, i) }),
            MAK.pageGuide(siteId, data, send).catch(() => null)
          ]);
          if (mine === run) draw(siteId, tool, pm, compose, groups, me, guide);
        } catch (e) {
          if (mine === run) say(MAK.mailError(e), true);
        }
      }
    };
    return picker;
  }

  function makeEnvelope(siteId, inHeader) {
    const host = document.createElement('span');
    host.className = ENVELOPE;
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = inHeader ? HEADER_CSS : PENCIL_CSS;
    const btn = h('button', {
      class: MAK.extButtonClass('icon'),
      attrs: { type: 'button', title: MAK.t('teach.button'), 'aria-label': `${MAK.t('teach.button')}: ${nameOf(siteId)}` },
      on: {
        click: (e) => {
          e.preventDefault();
          e.stopPropagation();
          getPicker().toggle(siteId, host);
        }
      }
    }, MAK.icon('mail'));
    shadow.append(style, btn);
    return host;
  }

  // The button ✉ after the pencil, for a site with the internal mail.
  function addEnvelope(pencil, siteId, inHeader) {
    const next = pencil.nextElementSibling;
    const has = next && next.classList.contains(ENVELOPE);
    if (mailTool(siteId) && !has) pencil.after(makeEnvelope(siteId, inHeader));
    else if (!mailTool(siteId) && has) next.remove();
  }

  // ---- The pencils -------------------------------------------------------------

  function makePencil(siteId, inHeader) {
    const host = document.createElement('span');
    host.className = PENCIL;
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = inHeader ? HEADER_CSS : PENCIL_CSS;
    const pen = h('button', {
      class: MAK.extButtonClass('icon'),
      attrs: { type: 'button', title: MAK.t('names.edit'), 'aria-label': MAK.t('names.edit') },
      on: {
        click: (e) => {
          // The click does not open the site or the list of tools of the sidebar.
          e.preventDefault();
          e.stopPropagation();
          getEditor().toggle(siteId, host);
        }
      }
    }, MAK.icon('pencil'));
    shadow.append(style, pen);
    return host;
  }

  function addPencils() {
    if (!settings) return;
    if (pageSite && sites.has(pageSite)) {
      for (const box of document.querySelectorAll('.portal-header-site-title')) {
        if (!box.querySelector(`.${PENCIL}`)) box.append(makePencil(pageSite, true));
        addEnvelope(box.querySelector(`.${PENCIL}`), pageSite, true);
      }
    }
    for (const li of document.querySelectorAll('li.site-list-item[data-site]')) {
      const id = li.getAttribute('data-site');
      const link = li.querySelector('a.sidebar-site-title');
      if (!sites.has(id) || !link) continue;
      const next = link.nextElementSibling;
      if (!(next && next.classList.contains(PENCIL))) link.after(makePencil(id));
      addEnvelope(link.nextElementSibling, id);
    }
  }

  // MiAulario can draw the sidebar again (for example, when you pin a site).
  let timer = null;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(addPencils, 150);
  }).observe(document.documentElement, { childList: true, subtree: true });

  let raw = { settings: null, sites: [], pages: {} }; // the stored values
  function apply(next) {
    raw = Object.assign({}, raw, next);
    settings = MAK.withDefaults(raw.settings);
    sites = new Map((raw.sites || []).map((s) => [s.id, s]));
    pages = raw.pages || {};
    MAK.setLang(settings.lang);
    addPencils();
  }
  MAK.safeCall(() => ext.storage.local.get(['settings', 'sites', 'pages']), null).then((d) => apply({ settings: d && d.settings, sites: (d && d.sites) || [], pages: (d && d.pages) || {} }));
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(changes.settings || changes.sites || changes.pages)) return;
    const next = {};
    if (changes.settings) next.settings = changes.settings.newValue;
    if (changes.sites) next.sites = changes.sites.newValue || [];
    if (changes.pages) next.pages = changes.pages.newValue || {};
    apply(next);
  });
})();
