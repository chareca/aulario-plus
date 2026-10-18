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
    table { border-collapse: collapse; width: 100%; margin: 8px 0 4px; font-size: 13px; }
    th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid #d6e3e0; vertical-align: top; }
    .dark th, .dark td { border-color: #2e4440; }
    th { font-size: 12px; color: #5f6b73; font-weight: 600; } .dark th { color: #9aa6ad; }
    td.w, th.w { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    tr.total td { font-weight: 600; border-bottom: 0; }
    details { margin-top: 6px; } summary { cursor: pointer; }
    details.site { border-top: 1px solid #d6e3e0; padding-top: 6px; } .dark details.site { border-color: #2e4440; }
    details.site > summary { font-weight: 600; }
    .notes p { margin: 4px 0; font-size: 13px; }
    .teacher { margin-top: 2px; }
    ${MAK.EXT_BUTTON_CSS}
    .mak-btn { padding: 2px 12px; }
  `;

  // The table of one guide.
  function assessment(guide) {
    const rows = guide.evaluation.rows;
    if (!rows.length) return h('p', { class: 'meta', text: MAK.t('guide.noTable') });
    const has = (k) => rows.some((r) => r[k]);
    const cols = [['recoverable', 'guide.recoverable'], ['minimum', 'guide.minimum'], ['attendance', 'guide.attendance']].filter(([k]) => has(k));
    const total = rows.reduce((n, r) => n + (r.weight || 0), 0);
    return h(
      'table',
      null,
      h('thead', null, h('tr', null, h('th', { text: MAK.t('guide.activity') }), h('th', { class: 'w', text: MAK.t('guide.weight') }), cols.map(([, key]) => h('th', { text: MAK.t(key) })))),
      h(
        'tbody',
        null,
        rows.map((r) => h('tr', null, h('td', { text: r.activity }), h('td', { class: 'w', text: r.weightText || '–' }), cols.map(([k]) => h('td', { text: r[k] || '–' })))),
        total > 0 ? h('tr', { class: 'total' }, h('td', { text: MAK.t('guide.total') }), h('td', { class: 'w', text: `${total.toLocaleString(MAK.locale())} %` }), cols.map(() => h('td'))) : null
      )
    );
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
    const content = h('div', null, body);
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
      parts.push(h('details', { class: 'site', attrs: { open: true } }, h('summary', null, MAK.publicSiteName(s), total ? h('span', { class: 'meta', text: ` · ${guide.evaluation.rows.length} ${MAK.t('guide.activities')}` }) : null), guideBody(guide)));
    }
    if (parts.length) show(MAK.t('guide.allTitle'), parts);
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
