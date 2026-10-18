// Aulario Plus: the table of the assessment of the course guide ("Guía docente", lib/guide.js).
// - On the home page ("Inicio") of a site with a guide: the table of that site.
// - On the home page of "Mi sitio" (the workspace of the user, or /portal): the tables of all the
//   sites with a guide.
// The guides are stored for 7 days. The box is in a closed shadow root (the page cannot change it).
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const HOST_ID = 'mak-guide-host';
  const BANNER_ID = 'mak-news-host'; // content-banner.js
  const where = MAK.parsePortalPath(location.pathname);
  const onRoot = /^\/portal\/?$/.test(location.pathname);
  const mySite = onRoot || !!(where && where.siteId && where.siteId.startsWith('~'));
  const siteId = where && where.siteId && !MAK.isSpecialSite(where.siteId) ? where.siteId : null;
  if (!mySite && !siteId) return;
  const h = MAK.h;
  const send = (msg) => MAK.safeCall(() => ext.runtime.sendMessage(msg), null);

  const CSS = `
    :host { all: initial; display: block; margin: 0 0 12px; }
    .box { font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1d2327; background: #f3f8f7;
      border: 1px solid #d6e3e0; border-left: 4px solid #10524e; border-radius: 8px; padding: 10px 14px; }
    .box.dark { color: #e8ecee; background: #1e2a28; border-color: #2e4440; border-left-color: #4fd1a5; }
    .head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .head strong { flex: 1; min-width: 200px; }
    a { color: #1a5fb4; } .dark a { color: #8ab4f8; }
    .meta { color: #5f6b73; font-size: 12px; } .dark .meta { color: #9aa6ad; }
    .content { max-width: 1400px; }
    .content.one { max-width: 900px; }
    /* "Mi sitio": one card for each site, in 1, 2 or 3 columns. */
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 430px), 1fr)); gap: 10px; margin-top: 8px; }
    .card { border: 1px solid #d6e3e0; border-radius: 8px; padding: 8px 10px; background: rgba(255, 255, 255, 0.55); min-width: 0; }
    .dark .card { border-color: #2e4440; background: rgba(0, 0, 0, 0.18); }
    .card h4 { margin: 0; font-size: 14px; }
    /* The weights as one bar: one part for each activity. */
    .bar { display: flex; height: 7px; border-radius: 4px; overflow: hidden; margin: 6px 0 2px; background: #d6e3e0; }
    .dark .bar { background: #2e4440; }
    .bar span { display: block; height: 100%; border-right: 2px solid #f3f8f7; box-sizing: border-box; }
    .dark .bar span { border-right-color: #1e2a28; }
    .bar span:last-child { border-right: 0; }
    .bar .c0 { background: #10524e; } .bar .c1 { background: #2a8c7f; } .bar .c2 { background: #57b8a6; } .bar .c3 { background: #8fd3c4; }
    .dark .bar .c0 { background: #4fd1a5; } .dark .bar .c1 { background: #37a98a; } .dark .bar .c2 { background: #2b7f6c; } .dark .bar .c3 { background: #9ce6cc; }
    /* Columns of a fixed width: the activity, the weight next to it, then the other columns. */
    table { border-collapse: collapse; width: 100%; table-layout: fixed; margin: 6px 0 4px; font-size: 13px; }
    col.a { width: 40%; } col.w { width: 4.2em; }
    th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #d6e3e0; vertical-align: top; overflow-wrap: anywhere; }
    .dark th, .dark td { border-color: #2e4440; }
    th { font-size: 12px; color: #5f6b73; font-weight: 600; } .dark th { color: #9aa6ad; }
    td.w, th.w { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    tr.total td { font-weight: 600; border-bottom: 0; }
    details { margin-top: 6px; } summary { cursor: pointer; }
    .notes p { margin: 4px 0; font-size: 13px; }
    .teacher { margin-top: 2px; }
    ${MAK.EXT_BUTTON_CSS}
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
  const cell = (text) => (text.length > LONG ? h('td', { text: `${text.slice(0, LONG).replace(/\s+\S*$/, '')}…`, title: text }) : h('td', { text }));

  // The weights of the activities as one bar (the name and the weight in the tooltip).
  function weightBar(rows) {
    const parts = rows.filter((r) => r.weight > 0);
    const total = parts.reduce((n, r) => n + r.weight, 0);
    if (!total) return null;
    return h('div', { class: 'bar', attrs: { role: 'img', 'aria-label': parts.map((r) => `${r.activity}: ${percent(r)}`).join(', ') } },
      parts.map((r, i) => {
        // The width with the CSSOM: a "style" attribute can be blocked by the CSP of the page.
        const part = h('span', { class: `c${i % 4}`, title: `${r.activity}: ${percent(r)}` });
        part.style.width = `${(r.weight / total) * 100}%`;
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
      weightBar(rows),
      h(
        'table',
        null,
        h('colgroup', null, h('col', { class: 'a' }), h('col', { class: 'w' }), cols.map(() => h('col'))),
        h('thead', null, h('tr', null, h('th', { text: MAK.t('guide.activity') }), h('th', { class: 'w', text: MAK.t('guide.weight') }), cols.map(([, key]) => h('th', { text: MAK.t(key) })))),
        h(
          'tbody',
          null,
          rows.map((r) => h('tr', null, cell(r.activity), h('td', { class: 'w', text: percent(r) }), cols.map(([k]) => cell(tidy(r[k]))))),
          total > 0 ? h('tr', { class: 'total' }, h('td', { text: MAK.t('guide.total') }), h('td', { class: 'w', text: `${total.toLocaleString(MAK.locale())} %` }), cols.map(() => h('td'))) : null
        )
      )
    ];
  }

  function guideBody(guide) {
    const resp = guide.teachers.filter((t) => t.resp);
    return [
      resp.map((t) => {
        const n = MAK.personParts(t.name);
        return h('div', { class: 'teacher meta' }, `${MAK.t('guide.responsible')}: ${[n.first, n.last].filter(Boolean).join(' ')}`, t.tutorias ? [' · ', h('a', { href: t.tutorias, text: MAK.t('guide.officeHours') })] : null);
      }),
      assessment(guide),
      guide.evaluation.notes.length
        ? h('details', { class: 'notes' }, h('summary', { class: 'meta', text: MAK.t('guide.notes', { n: guide.evaluation.notes.length }) }), guide.evaluation.notes.map((n) => h('p', { text: n })))
        : null,
      guide.url ? h('div', { class: 'meta' }, h('a', { href: guide.url, text: MAK.t('guide.full') })) : null
    ];
  }

  function show(title, body) {
    const old = document.getElementById(HOST_ID);
    if (old) old.remove();
    const host = document.createElement('div');
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    const content = h('div', { class: `content${mySite ? '' : ' one'}` }, body);
    let hidden = false;
    try { hidden = localStorage.getItem(`${HOST_ID}:${mySite ? 'mine' : siteId}`) === '1'; } catch {}
    content.hidden = hidden;
    const toggle = h('button', { class: MAK.extButtonClass('btn'), attrs: { type: 'button', 'aria-expanded': String(!hidden) }, text: MAK.t(hidden ? 'guide.show' : 'guide.hide') });
    toggle.addEventListener('click', () => {
      content.hidden = !content.hidden;
      toggle.textContent = MAK.t(content.hidden ? 'guide.show' : 'guide.hide');
      toggle.setAttribute('aria-expanded', String(!content.hidden));
      try { localStorage.setItem(`${HOST_ID}:${mySite ? 'mine' : siteId}`, content.hidden ? '1' : '0'); } catch {}
    });
    shadow.append(style, h('div', { class: `box${MAK.isDarkPage() ? ' dark' : ''}`, attrs: { role: 'region', 'aria-label': title } }, h('div', { class: 'head' }, h('strong', { text: `📘 ${title}` }), toggle), content));
    // Below the banner of new items, if there is one; else at the top of the content.
    const banner = document.getElementById(BANNER_ID);
    if (banner) banner.after(host);
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
      if (guide) show(MAK.t('guide.title'), guideBody(guide));
      return;
    }
    // "Mi sitio": only its home page.
    if (where && where.pageOrTool && !/^(inicio|home|overview|hasiera)$/i.test(document.title.split(':').pop().trim())) return;
    const hidden = MAK.hiddenEverywhere(settings);
    const list = sites.filter((s) => !hidden.has(s.id) && data.pages && data.pages[s.id] && data.pages[s.id].guide);
    if (!list.length) return;
    const parts = [];
    for (const s of list) {
      const guide = await guideOf(s.id, data).catch(() => null);
      if (!guide) continue;
      const total = guide.evaluation.rows.reduce((n, r) => n + (r.weight || 0), 0);
      parts.push(h('section', { class: 'card' }, h('h4', null, MAK.publicSiteName(s), total ? h('span', { class: 'meta', text: ` · ${guide.evaluation.rows.length} ${MAK.t('guide.activities')}` }) : null), guideBody(guide)));
    }
    if (parts.length) show(MAK.t('guide.allTitle'), h('div', { class: 'grid' }, parts));
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
