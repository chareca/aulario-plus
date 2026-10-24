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
  // The editor of a name and the list of the teachers: small windows next to the button, in the look of
  // the theme (lib/themes.js, MAK.themedStyle).
  const EDITOR_CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .pop { position: fixed; z-index: 2147483000; width: 340px; padding: 12px;
      font: var(--ap-weight) calc(14px * var(--ap-zoom))/1.4 var(--ap-font); color: var(--ap-fg); background: var(--ap-win-bg);
      border: var(--ap-bw) solid var(--ap-edge); border-radius: var(--ap-radius); box-shadow: var(--ap-shadow-pop);
      -webkit-backdrop-filter: var(--ap-blur); backdrop-filter: var(--ap-blur); }
    .pop[hidden] { display: none; }
    label { display: block; font-size: 0.86em; color: var(--ap-muted); margin-bottom: 4px; overflow-wrap: anywhere; }
    input { width: 100%; font: inherit; padding: 5px 8px; color: var(--ap-input-fg); background: var(--ap-input-bg); border: var(--ap-bw-sm) solid var(--ap-input-edge);
      border-radius: var(--ap-input-radius); box-shadow: var(--ap-input-shadow); }
    .row { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
    button { font: inherit; font-size: 0.93em; cursor: pointer; padding: 4px 10px; color: var(--ap-btn-fg); background: var(--ap-btn-bg);
      border: var(--ap-bw-sm) solid var(--ap-btn-edge); border-radius: var(--ap-radius-sm); box-shadow: var(--ap-shadow-sm); }
    button.save { color: var(--ap-primary-fg); background: var(--ap-primary-bg); border-color: var(--ap-primary-edge); font-weight: 700; }
    button:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid var(--ap-fg); outline-offset: 2px; }
  `;

  const PICKER_CSS = `${EDITOR_CSS}
    .pop { width: 360px; max-height: min(480px, calc(100vh - 16px)); overflow: auto; }
    header { display: flex; align-items: baseline; gap: 6px; margin-bottom: 6px; }
    h2 { font-family: var(--ap-font-head); font-weight: var(--ap-head-weight); font-style: var(--ap-head-style); letter-spacing: var(--ap-head-spacing);
      font-size: calc(15px * var(--ap-head-zoom)); margin: 0; flex: 1; }
    button.x { border: 0; background: none; box-shadow: none; font-size: 16px; line-height: 1; padding: 2px 6px; color: inherit; }
    h3 { font-size: 0.86em; font-weight: 700; margin: 10px 0 4px; color: var(--ap-muted); }
    .people { display: flex; flex-direction: column; gap: 4px; }
    .people button { text-align: left; width: 100%; }
    .person { display: flex; gap: 6px; align-items: center; }
    .person button { flex: 1; }
    ${MAK.LINK_CSS}
    .person .mak-link { font-size: 0.86em; white-space: nowrap; }
    .tag { font-size: 0.8em; margin-left: 6px; padding: 0 6px; border-radius: var(--ap-radius-sm); background: var(--ap-green-bg); color: var(--ap-green); white-space: nowrap; }
    .help, .status { font-size: 0.86em; color: var(--ap-muted); margin: 8px 0 0; }
    .status.error { color: var(--ap-red); }
    input[type=search] { margin-bottom: 4px; }
  `;

  let settings = null;
  let pages = {}; // id -> stored pages (the tools of the site)
  let sites = new Map(); // id -> stored site (full title)
  const nameOf = (siteId) => (sites.has(siteId) ? MAK.siteName(sites.get(siteId), settings) : siteId);

  // A click outside the window closes it (not on its button: the button opens and closes it), also a click in an iframe
  // of the page (the tools of MiAulario, as «Mensaje del día»): the page gets no click from an iframe, only the blur of
  // its window. anchor(): the button that opened the window.
  function closeOutside(pop, host, anchor, close) {
    document.addEventListener('mousedown', (e) => {
      const path = e.composedPath();
      if (!pop.hidden && !path.includes(host) && !path.includes(anchor())) close();
    }, true);
    window.addEventListener('blur', () => setTimeout(() => {
      if (!pop.hidden && document.activeElement instanceof HTMLIFrameElement) close();
    }));
  }

  // ---- The editor: one for all the pencils, at a fixed place next to the pencil ----

  let editor = null;
  function getEditor() {
    if (editor) return editor;
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = MAK.themedStyle(EDITOR_CSS);
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
      }
    });
    pop.addEventListener('click', (e) => e.stopPropagation());
    closeOutside(pop, host, () => anchor, close);
    window.addEventListener('resize', close);
    shadow.append(style, pop);
    document.documentElement.append(host);
    MAK.escCloses(pop, close);

    editor = {
      toggle(id, pencil) {
        if (!pop.hidden && siteId === id) return close();
        siteId = id;
        anchor = pencil;
        pop.className = 'pop';
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
    MAK.animateDetails(shadow); // the other teaching staff
    const style = MAK.themedStyle(PICKER_CSS);
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
    pop.addEventListener('keydown', (e) => e.stopPropagation());
    pop.addEventListener('click', (e) => e.stopPropagation());
    closeOutside(pop, host, () => anchor, close);
    shadow.append(style, pop);
    document.documentElement.append(host);
    MAK.escCloses(pop, close);
    // Below the button, always inside the window: near an edge, it touches that edge (8 px). Again at
    // each change of size: the list of the teachers comes after the opening and makes the window taller.
    const place = () => {
      if (pop.hidden || !anchor) return;
      const r = anchor.getBoundingClientRect();
      pop.style.left = `${Math.max(8, Math.min(r.left - 8, window.innerWidth - pop.offsetWidth - 8))}px`;
      pop.style.top = `${Math.max(8, Math.min(r.bottom + 6, window.innerHeight - pop.offsetHeight - 8))}px`;
    };
    new ResizeObserver(place).observe(pop);
    window.addEventListener('resize', place);
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
      // The text: the template of the user (Settings), or "Hola <first name>," an empty line, "Saludos,"
      // and the first name of the user.
      const { subject, body } = MAK.teacherMail({ teacher: person.label, me: me && me.label, course: nameOf(siteId), settings });
      const data = { to: [{ value: person.value, label: person.label }], subject, body, emailCopy: true, files: [] };
      try {
        try {
          await pm.prepare(compose, data, { open: true });
        } catch (e) {
          // MiAulario sometimes fails one time: a new compose form, one more time.
          if (!['pm.noPicker', 'pm.http', 'pm.network', 'pm.recipientGone'].includes(e && e.code)) throw e;
          await pm.prepare(await pm.open(tool.placement), data, { open: true });
        }
        location.assign(MAK.safeSiteUrl(tool.page) || MAK.siteUrl(siteId));
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
        pop.className = 'pop';
        title.textContent = MAK.t('teach.title', { site: nameOf(siteId) });
        MAK.fill(list);
        say(MAK.t('teach.loading'));
        pop.hidden = false;
        place();
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
    const style = MAK.themedStyle(inHeader ? HEADER_CSS : PENCIL_CSS);
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
    const style = MAK.themedStyle(inHeader ? HEADER_CSS : PENCIL_CSS);
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
