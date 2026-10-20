// Aulario Plus: the table of the assessment of the course guide ("Guía docente", lib/guide.js).
// - On the home page ("Inicio") of a site with a guide: the table of that site.
// - On the home page of "Mi sitio" (the workspace of the user, or /portal): one short card for each
//   site with a guide (the name, the responsible teacher and the weights). The arrow of a card shows
//   the table. Not on the page /portal without a session (the page of the login).
// The guides are stored for 7 days. The box is in a closed shadow root (the page cannot change it).
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const HOST_ID = 'mak-guide-host';
  const BANNER_ID = 'mak-news-host'; // content-banner.js
  const SHORTCUTS_ID = 'mak-shortcuts-host'; // content-shortcuts.js
  const where = MAK.parsePortalPath(location.pathname);
  const onRoot = /^\/portal\/?$/.test(location.pathname);
  const mySite = onRoot || !!(where && where.siteId && where.siteId.startsWith('~'));
  const siteId = where && where.siteId && !MAK.isSpecialSite(where.siteId) ? where.siteId : null;
  if (!mySite && !siteId) return;
  const h = MAK.h;
  const send = (msg) => MAK.safeCall(() => ext.runtime.sendMessage(msg), null);
  // Firefox: content.fetch sends the request as the page. Chromium: fetch does this.
  const pageFetch = globalThis.content && typeof globalThis.content.fetch === 'function' ? globalThis.content.fetch.bind(globalThis.content) : fetch;

  // The look comes from the theme (lib/themes.js, MAK.themedStyle) and MAK.BOX_CSS.
  const CSS = () => `${MAK.BOX_CSS()}
    ${MAK.SEMESTERS_CSS}
    .content { max-width: 1400px; }
    .content.one { max-width: 900px; }
    /* "Mi sitio": one card for each site, in 1, 2 or 3 columns. */
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 430px), 1fr)); gap: 12px; margin-top: 4px; align-items: start; }
    .guide-card { min-width: 0; padding: 10px 12px; background: var(--ap-surface); border: var(--ap-bw-sm) solid var(--ap-line); border-radius: var(--ap-radius); }
    .guide-card h4 { margin: 0; font-size: calc(15px * var(--ap-head-zoom)); line-height: 1.25; flex: 1; min-width: 0; cursor: pointer; }
    .guide-card h4 .meta { font-family: var(--ap-font); font-style: normal; font-weight: 400; letter-spacing: normal; font-size: 0.75em; }
    .card-head { display: flex; align-items: flex-start; gap: 8px; }
    .card-head .mak-icon { flex: none; width: 30px; height: 26px; }
    .card-head .arrow svg { transition: transform 0.15s; }
    .guide-card.open .card-head .arrow svg { transform: rotate(180deg); }
    .more { margin-top: 2px; }
    /* The weights as one bar: one part for each kind of activity, with its name and weight. */
    .bar.weights { display: flex; gap: 2px; height: 24px; border-radius: var(--ap-radius-sm); overflow: hidden; margin: 8px 0 4px; }
    .bar.weights span { display: flex; align-items: center; min-width: 0; padding: 0 7px; font-size: 11.5px; font-weight: 700;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* The same color for a kind in all the sites (the variables of the theme); the dot of a row has it too. */
    .k-exam { background: var(--ap-k-exam); color: var(--ap-k-exam-fg); }
    .k-practice { background: var(--ap-k-practice); color: var(--ap-k-practice-fg); }
    .k-work { background: var(--ap-k-work); color: var(--ap-k-work-fg); }
    .k-participation { background: var(--ap-k-participation); color: var(--ap-k-participation-fg); }
    .k-presentation { background: var(--ap-k-presentation); color: var(--ap-k-presentation-fg); }
    .k-other { background: var(--ap-k-other); color: var(--ap-k-other-fg); }
    .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; vertical-align: 0; border: 1px solid var(--ap-line); }
    /* Columns of a fixed width: the activity, the weight next to it, then the other columns. */
    table { border-collapse: collapse; width: 100%; table-layout: fixed; margin: 6px 0 4px; font-size: 0.93em; }
    col.a { width: 40%; } col.w { width: 4.2em; }
    th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--ap-line); vertical-align: top; overflow-wrap: anywhere; }
    th { font-size: 0.86em; color: var(--ap-muted); font-weight: 700; }
    td.w, th.w { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    tr.total td { font-weight: 700; border-bottom: 0; }
    details { margin-top: 6px; } summary { cursor: pointer; }
    .notes p { margin: 4px 0; font-size: 0.93em; }
    .teacher { margin-top: 2px; }
    .mak-btn { padding: 2px 12px; }
  `;

  // The same form for all the guides: "60" -> "60 %", "NO" -> "No", "sí" -> "Sí".
  const percent = (r) => (typeof r.weight === 'number' ? `${r.weight.toLocaleString(MAK.locale())} %` : r.weightText || '–');
  const tidy = (v) => {
    const s = String(v || '').trim();
    if (!s) return '–';
    if (/^\p{Lu}{2,4}$/u.test(s)) return s.charAt(0) + s.slice(1).toLocaleLowerCase('es'); // "NO" -> "No"; "N/A" stays
    return s.charAt(0).toLocaleUpperCase('es') + s.slice(1);
  };
  // A long text of a cell: the start, and all the text in the tooltip (the card stays short).
  const LONG = 90;
  const cell = (text, kind) => {
    const short = text.length > LONG ? `${text.slice(0, LONG).replace(/\s+\S*$/, '')}…` : text;
    return h('td', text.length > LONG ? { title: text } : null, kind ? h('span', { class: `dot k-${kind}`, title: MAK.t(`guide.kind.${kind}`) }) : null, short);
  };

  // The weights as one bar: one part for each kind of activity (exam, practice, work, ...), with
  // its name and its weight. The tooltip has the activities of the part.
  function weightBar(rows) {
    const parts = MAK.weightsByKind(rows);
    const total = parts.reduce((n, p) => n + p.weight, 0);
    if (!total) return null;
    const label = (p) => `${MAK.t(`guide.kind.${p.kind}`)} ${p.weight.toLocaleString(MAK.locale())} %`;
    return h('div', { class: 'bar weights', attrs: { role: 'img', 'aria-label': parts.map(label).join(', ') } },
      parts.map((p) => {
        const part = h('span', { class: `k-${p.kind}`, text: label(p), title: `${label(p)}\n${p.names.map((n) => `• ${n}`).join('\n')}` });
        // The width with the CSSOM: a "style" attribute can be blocked by the CSP of the page.
        part.style.flex = `${p.weight} 1 0`;
        return part;
      }));
  }

  // The table of one guide.
  function assessment(guide) {
    const rows = guide.evaluation.rows;
    if (!rows.length) return h('p', { class: 'meta', text: MAK.t('guide.noTable') });
    const has = (k) => rows.some((r) => r[k]);
    const cols = [['recoverable', 'guide.recoverable'], ['minimum', 'guide.minimum'], ['attendance', 'guide.attendance']].filter(([k]) => has(k));
    const total = rows.reduce((n, r) => n + (r.weight || 0), 0);
    return [
      h(
        'table',
        null,
        h('colgroup', null, h('col', { class: 'a' }), h('col', { class: 'w' }), cols.map(() => h('col'))),
        h('thead', null, h('tr', null, h('th', { text: MAK.t('guide.activity') }), h('th', { class: 'w', text: MAK.t('guide.weight') }), cols.map(([, key]) => h('th', { text: MAK.t(key) })))),
        h(
          'tbody',
          null,
          rows.map((r) => h('tr', null, cell(r.activity, MAK.activityKind(r.activity)), h('td', { class: 'w', text: percent(r) }), cols.map(([k]) => cell(tidy(r[k]))))),
          // The total only when it is not 100 % (then the calculation uses that total).
          total > 0 && Math.abs(total - 100) > 0.01 ? h('tr', { class: 'total' }, h('td', { text: MAK.t('guide.total') }), h('td', { class: 'w', text: `${total.toLocaleString(MAK.locale())} %` }), cols.map(() => h('td'))) : null
        )
      )
    ];
  }

  // The responsible teachers ("Ana García López · Tutorías"), with the link to the office hours.
  const teachers = (guide) =>
    guide.teachers.filter((t) => t.resp).map((t) => {
      const n = MAK.personParts(t.name);
      return h('div', { class: 'teacher meta', title: MAK.t('guide.responsible') }, [n.first, n.last].filter(Boolean).join(' '), t.tutorias ? [' · ', MAK.link(t.tutorias, MAK.t('guide.officeHours'))] : null);
    });

  // The table, the rules of the assessment and the link to the full guide.
  const details = (guide) => {
    const notes = MAK.guideNotes(guide);
    return [
      assessment(guide),
      notes.length ? h('details', { class: 'notes' }, h('summary', { class: 'meta', text: MAK.t('guide.notes', { n: notes.length }) }), notes.map((n) => h('p', { text: n }))) : null,
      guide.url ? h('div', { class: 'meta' }, MAK.link(guide.url, MAK.t('guide.full'))) : null
    ];
  };

  // The button of the calculator (content-calc.js): only for a guide with weights. outline: the look
  // of the arrow of a box (the head of the box of a site), else the look of the arrow of a card.
  function calcButton(site, name, rows, outline) {
    if (!rows.some((r) => r.weight > 0) || !MAK.openGuideCalc) return null;
    const label = MAK.t('gcalc.open', { site: name });
    return h('button', {
      class: outline ? 'mak-fold' : MAK.extButtonClass('icon'),
      attrs: { type: 'button', title: label, 'aria-label': label, 'aria-haspopup': 'dialog' },
      on: { click: () => MAK.openGuideCalc({ site: { id: site.id, name }, rows }) }
    }, MAK.icon('calc'));
  }

  // The home page of a site: all the guide (the table has the weights: no bar).
  const guideBody = (guide) => [teachers(guide), details(guide)];

  // "Mi sitio": a short card (the name, the responsible teacher and the weights). The arrow shows
  // the rest. The card stays open or closed when the page opens again.
  function guideCard(site, guide) {
    const rows = guide.evaluation.rows;
    const name = MAK.publicSiteName(site);
    const key = `${HOST_ID}:open:${site.id}`;
    let open = false;
    try { open = localStorage.getItem(key) === '1'; } catch {}
    const more = h('div', { class: 'more' }, details(guide));
    const arrow = h('button', { class: `${MAK.extButtonClass('icon')} arrow`, attrs: { type: 'button' } }, MAK.icon('chevron'));
    const card = h(
      'section',
      { class: 'guide-card' },
      h('div', { class: 'card-head' }, h('h4', { text: name }), calcButton(site, name, rows), arrow),
      teachers(guide),
      weightBar(rows),
      more
    );
    const draw = () => {
      more.hidden = !open;
      card.classList.toggle('open', open);
      const label = MAK.t(open ? 'guide.close' : 'guide.open', { site: name });
      arrow.setAttribute('aria-expanded', String(open));
      arrow.setAttribute('aria-label', label);
      arrow.title = label;
    };
    const flip = () => {
      open = !open;
      draw();
      try { localStorage.setItem(key, open ? '1' : '0'); } catch {}
    };
    arrow.addEventListener('click', flip);
    card.querySelector('h4').addEventListener('click', flip);
    draw();
    return card;
  }

  // extra: a button for the head, before the arrow.
  function show(title, body, extra) {
    const old = document.getElementById(HOST_ID);
    if (old) old.remove();
    const host = document.createElement('div');
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = MAK.themedStyle(CSS());
    const content = h('div', { class: `content${mySite ? '' : ' one'}` }, body);
    let hidden = false;
    try { hidden = localStorage.getItem(`${HOST_ID}:${mySite ? 'mine' : siteId}`) === '1'; } catch {}
    content.hidden = hidden;
    // The arrow folds the box (the title too); the box stays folded when the page opens again.
    const toggle = MAK.foldButton(!hidden, { open: MAK.t('fold.open', { name: title }), close: MAK.t('fold.close', { name: title }) }, (open) => {
      content.hidden = !open;
      try { localStorage.setItem(`${HOST_ID}:${mySite ? 'mine' : siteId}`, open ? '0' : '1'); } catch {}
    });
    const name = h('strong', { class: 'title', text: title, on: { click: () => toggle.click() } });
    shadow.append(style, h('div', { class: 'box', attrs: { role: 'region', 'aria-label': title } }, h('div', { class: 'head' }, name, extra || null, toggle), content));
    // "Mi sitio": in the block "Aulario Plus" (MAK.mySiteSlot), after the shortcuts. Else below the
    // shortcuts (content-shortcuts.js) or the banner of new items, or at the top of the content.
    const slot = mySite ? MAK.mySiteSlot() : null;
    const shortcuts = document.getElementById(SHORTCUTS_ID);
    const above = shortcuts || document.getElementById(BANNER_ID);
    if (slot) host.classList.add('in-block');
    if (shortcuts && slot && slot.contains(shortcuts)) shortcuts.after(host);
    else if (slot) slot.append(host);
    else if (above) above.after(host);
    else MAK.insertAtTop(host);
  }

  const guideOf = (id, data) => MAK.pageGuide(id, data, send);

  async function run() {
    const data = (await MAK.safeCall(() => ext.storage.local.get(['pages', 'sites', 'settings', 'guides']), null)) || {};
    const settings = MAK.withDefaults(data.settings);
    MAK.setLang(settings.lang);
    const sites = data.sites || [];
    if (siteId) {
      const p = data.pages && data.pages[siteId];
      // Only the home page of the site: /portal/site/<id> or its first page.
      if (!p || !p.guide || (where.pageOrTool && where.pageOrTool !== p.home)) return;
      const guide = await guideOf(siteId, data).catch(() => null);
      const site = sites.find((s) => s.id === siteId) || { id: siteId, title: siteId };
      if (guide) show(MAK.t('guide.title'), guideBody(guide), calcButton(site, MAK.publicSiteName(site), guide.evaluation.rows, true));
      return;
    }
    // "Mi sitio": only its home page.
    if (where && where.pageOrTool && !/^(inicio|home|overview|hasiera)$/i.test(document.title.split(':').pop().trim())) return;
    // /portal without a session is the page of the login: no course data there.
    if (onRoot) {
      const s = await pageFetch('/direct/session/current.json?auto=true', { cache: 'no-store', credentials: 'include' }).then((r) => r.json()).catch(() => null);
      if (!s || !s.userId) return;
    }
    const hidden = MAK.hiddenEverywhere(settings);
    const list = sites.filter((s) => !hidden.has(s.id) && data.pages && data.pages[s.id] && data.pages[s.id].guide);
    if (!list.length) return;
    // A part for each semester (MAK.semesterSections): the semester of the guide; a subject of the
    // whole year, or without a semester, is in the semester of the date. From 25 January the
    // subjects of the first semester are gone.
    const now = Date.now();
    const current = MAK.currentSeason(now);
    const cards = { autumn: [], spring: [] };
    for (const s of list) {
      const guide = await guideOf(s.id, data).catch(() => null);
      if (guide) cards[MAK.guideSeason(guide) || current].push(guideCard(s, guide));
    }
    const parts = {};
    for (const season of ['autumn', 'spring']) if (cards[season].length) parts[season] = { body: h('div', { class: 'grid' }, cards[season]) };
    const sections = MAK.semesterSections({ key: 'guides', now, parts, title: (season) => MAK.t(`short.semester.${season}`) });
    if (sections) show(MAK.t('guide.allTitle'), sections);
  }

  // The sync can store the pages of the sites after the page loads (the first sync after an update):
  // draw again then. A site page: only if there is no box yet. "Mi sitio": each time (more sites).
  let timer = null;
  let running = run();
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.pages || !MAK.extensionAlive()) return;
    if (siteId && document.getElementById(HOST_ID)) return;
    clearTimeout(timer);
    timer = setTimeout(() => { running = running.then(run, run); }, 1500);
  });
})();
