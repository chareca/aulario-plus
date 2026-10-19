// Aulario Plus: the box "Accesos directos" at the top of "Mi sitio" (above the course guides).
// - Final exams: the periods of the semester, the dates of the subjects of the user (if the exam
//   calendar of the degree has one row for each subject) and the links to the calendars.
// - Academic record: the services of SIGMA in MiUPNA.
// The degree comes from the course guides (lib/degree.js). The user can select another degree.
// More shortcuts: add a tile in tiles(). The box is in a closed shadow root.
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const HOST_ID = 'mak-shortcuts-host';
  const GUIDE_ID = 'mak-guide-host'; // content-guide.js
  const BANNER_ID = 'mak-news-host'; // content-banner.js
  const where = MAK.parsePortalPath(location.pathname);
  const onRoot = /^\/portal\/?$/.test(location.pathname);
  const mySite = onRoot || !!(where && where.siteId && where.siteId.startsWith('~'));
  if (!mySite) return;
  const h = MAK.h;
  const t = (k, p) => MAK.t(k, p);
  const send = (msg) => MAK.safeCall(() => ext.runtime.sendMessage(msg), null);
  // Firefox: content.fetch sends the request as the page. Chromium: fetch does this.
  const pageFetch = globalThis.content && typeof globalThis.content.fetch === 'function' ? globalThis.content.fetch.bind(globalThis.content) : fetch;
  const parse = (html) => new DOMParser().parseFromString(html, 'text/html');
  const DAY = 86400000;

  const CSS = `
    :host { all: initial; display: block; margin: 0 0 12px; }
    .box { font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1d2327; background: #f3f8f7;
      border: 1px solid #d6e3e0; border-left: 4px solid #10524e; border-radius: 8px; padding: 10px 14px; }
    .box.dark { color: #e8ecee; background: #1e2a28; border-color: #2e4440; border-left-color: #4fd1a5; }
    .head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .head strong { flex: 1; min-width: 200px; font-size: 15px; }
    .meta { color: #5f6b73; font-size: 12px; } .dark .meta { color: #9aa6ad; }
    .tiles { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 10px; margin-top: 8px; align-items: start; max-width: 1400px; }
    @media (max-width: 760px) { .tiles { grid-template-columns: minmax(0, 1fr); } }
    .tile { border: 1px solid #d6e3e0; border-radius: 8px; padding: 10px 12px; background: rgba(255, 255, 255, 0.55); min-width: 0; }
    .dark .tile { border-color: #2e4440; background: rgba(0, 0, 0, 0.18); }
    .tile h4 { margin: 0 0 6px; font-size: 15px; }
    .tile h4 .meta { font-weight: 400; }
    .periods { margin: 0 0 8px; }
    .period { margin: 2px 0; }
    .period b { font-weight: 600; }
    .period.other { color: #5f6b73; font-size: 12px; } .dark .period.other { color: #9aa6ad; }
    .exams { list-style: none; margin: 4px 0 8px; padding: 0; display: grid; gap: 6px; }
    .exams li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 10px; padding: 6px 8px; border-radius: 6px; background: rgba(16, 82, 78, 0.06); }
    .dark .exams li { background: rgba(79, 209, 165, 0.08); }
    .exams .name { font-weight: 600; overflow-wrap: anywhere; }
    .exams .when { font-variant-numeric: tabular-nums; }
    .exams .count { font-size: 12px; font-weight: 600; color: #10524e; white-space: nowrap; align-self: center; grid-row: span 2; }
    .dark .exams .count { color: #4fd1a5; }
    .exams .past { opacity: 0.6; }
    h5 { margin: 8px 0 2px; font-size: 12px; font-weight: 600; color: #5f6b73; text-transform: uppercase; letter-spacing: 0.04em; }
    .dark h5 { color: #9aa6ad; }
    .links { display: flex; flex-wrap: wrap; gap: 4px 14px; }
    .note { font-size: 13px; margin: 6px 0; }
    .record .mak-link { font-size: 15px; font-weight: 600; }
    .degree { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .degree select { font: inherit; font-size: 13px; max-width: 100%; }
    button.plain { font: inherit; font-size: 12px; background: none; border: 0; padding: 0; cursor: pointer; color: #1a5fb4; }
    .dark button.plain { color: #8ab4f8; }
    button.plain:hover, button.plain:focus-visible { text-decoration: underline; text-underline-offset: 2px; }
    ${MAK.EXT_BUTTON_CSS}
    ${MAK.LINK_CSS}
    .mak-btn { padding: 3px 12px; }
  `;

  // ---- The box -------------------------------------------------------------------------

  let content = null;
  function box() {
    if (content) return content;
    const host = document.createElement('div');
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    content = h('div', { class: 'tiles' });
    let hidden = false;
    try { hidden = localStorage.getItem(`${HOST_ID}:hidden`) === '1'; } catch {}
    content.hidden = hidden;
    const toggle = h('button', { class: MAK.extButtonClass('btn'), attrs: { type: 'button', 'aria-expanded': String(!hidden) }, text: t(hidden ? 'guide.show' : 'guide.hide') });
    toggle.addEventListener('click', () => {
      content.hidden = !content.hidden;
      toggle.textContent = t(content.hidden ? 'guide.show' : 'guide.hide');
      toggle.setAttribute('aria-expanded', String(!content.hidden));
      try { localStorage.setItem(`${HOST_ID}:hidden`, content.hidden ? '1' : '0'); } catch {}
    });
    const title = t('short.title');
    shadow.append(style, h('div', { class: `box${MAK.isDarkPage() ? ' dark' : ''}`, attrs: { role: 'region', 'aria-label': title } }, h('div', { class: 'head' }, h('strong', { text: `⚡ ${title}` }), toggle), content));
    // Above the course guides; below the banner of new items; else at the top of the content.
    const guide = document.getElementById(GUIDE_ID);
    const banner = document.getElementById(BANNER_ID);
    if (guide) guide.before(host);
    else if (banner) banner.after(host);
    else MAK.insertAtTop(host);
    return content;
  }

  // ---- The degree ----------------------------------------------------------------------

  // The list of degrees: the stored list (7 days), else the public page.
  async function degreeList(data) {
    const kept = data.degreeList;
    if (kept && Array.isArray(kept.list) && kept.list.length && Date.now() - kept.at < MAK.DEGREE_MS) return kept.list;
    const r = await send({ type: 'fetchDegreePage', url: MAK.DEGREE_LIST_URL });
    return r && r.html ? MAK.parseDegreeList(parse(r.html)) : [];
  }

  // The name of the degree in the guides; for the guides stored before version 1.6.2 (no degree
  // line), read the page of one guide again.
  async function nameOfGuides(guides, plan) {
    const name = MAK.degreeOfGuides(guides, plan);
    if (name) return name;
    const g = guides.find((x) => { try { return new URL(x.url).searchParams.get('codPlan') === plan; } catch { return false; } }) || guides[0];
    if (!g || !g.url) return '';
    const r = await send({ type: 'fetchGuide', url: g.url });
    const page = r && r.html ? MAK.parseGuide(parse(r.html), g.url) : null;
    return page ? MAK.degreeName(page.degree) : '';
  }

  // The degree of the user: { base, name, plan, periods, pdfs }, or { list } if it is not known.
  async function findDegree(data, guides, settings) {
    const plan = MAK.degreePlan(guides);
    const chosen = settings.degree;
    const kept = data.degree;
    if (kept && Date.now() - kept.at < MAK.DEGREE_MS && (chosen ? kept.base === chosen : !plan || kept.plan === plan)) return kept;
    const list = await degreeList(data);
    let base = chosen;
    let name = '';
    if (!base) {
      const match = MAK.matchDegree(await nameOfGuides(guides, plan), list);
      if (!match) return { list };
      base = match.base;
      name = match.name;
    }
    const entry = list.find((d) => d.base === base);
    const r = await send({ type: 'fetchDegreePage', url: MAK.evaluationUrl(base) });
    if (!r || !r.html) return { base, name: (entry && entry.name) || name, plan, periods: [], pdfs: [], error: true, list };
    const evaluation = MAK.parseEvaluation(parse(r.html));
    const degree = Object.assign({ base, name: (entry && entry.name) || name, plan }, evaluation);
    await send({ type: 'saveDegree', degree, list });
    return Object.assign({ list }, degree);
  }

  // ---- The tiles -----------------------------------------------------------------------

  const seasonName = (s) => t(`short.season.${s}`);

  function periodsOf(degree, now) {
    if (!degree.periods || !degree.periods.length) return null;
    const current = MAK.currentSeason(now);
    const sorted = [...degree.periods].sort((a, b) => Number(b.season === current) - Number(a.season === current));
    return h('div', { class: 'periods' }, sorted.map((p, i) =>
      h('div', { class: `period${i ? ' other' : ''}` },
        h('b', { text: seasonName(p.season) }),
        p.finals ? [' · ', `${t('short.finals')}: ${p.finals}`] : null,
        p.recovery ? [' · ', `${t('short.recovery')}: ${p.recovery}`] : null)));
  }

  // "hoy", "mañana", "en 12 días", "pasado".
  function countdown(ms, now) {
    const start = (x) => new Date(new Date(x).toDateString()).getTime();
    const days = Math.round((start(ms) - start(now)) / DAY);
    return days < 0 ? t('short.done') : days === 0 ? t('short.today') : days === 1 ? t('short.tomorrow') : t('short.inDays', { n: days });
  }

  function examList(mine, sites, now) {
    const siteName = (id) => {
      const s = (sites || []).find((x) => x.id === id);
      return s ? MAK.publicSiteName(s) : '';
    };
    return h('ul', { class: 'exams' }, mine.map((r) => {
      const next = [r.final, r.recovery].filter((x) => x && x >= now - DAY).sort((a, b) => a - b)[0];
      const line = (label, ms, room) => (ms ? h('div', { class: `when meta${ms < now - DAY ? ' past' : ''}` }, `${label}: ${MAK.formatDate(ms)}${room ? ` · ${room}` : ''}`) : null);
      return h('li', null,
        h('div', { class: 'name', text: siteName(r.siteId) || r.name }),
        h('span', { class: 'count', text: next ? countdown(next, now) : t('short.done') }),
        h('div', null, line(t('short.final'), r.final, r.finalRoom), line(t('short.rec'), r.recovery, r.recoveryRoom)));
    }));
  }

  // The dates of the subjects of the user, from the exam calendars of the degree.
  async function examPart(degree, guides, sites, now) {
    const pdfs = degree.pdfs || [];
    if (!pdfs.length) return null;
    const rows = [];
    let permission = false;
    let failed = 0;
    for (const p of pdfs) {
      const r = await send({ type: 'examRows', url: p.url });
      if (r && Array.isArray(r.rows)) rows.push(...r.rows);
      else if (r && r.error === 'exams.permission') permission = true;
      else failed++;
    }
    if (permission) {
      const ask = h('button', { class: MAK.extButtonClass('btn'), attrs: { type: 'button' }, text: `📅 ${t('short.showDates')}` });
      ask.addEventListener('click', () => send({ type: 'openExamPermission' }));
      return h('div', null, h('p', { class: 'note meta', text: t('short.permHelp') }), ask);
    }
    if (!rows.length) return h('p', { class: 'note meta', text: t(failed ? 'short.readError' : 'short.noRows') });
    const subjects = guides.map((g) => ({ code: g.guide.code, siteId: g.siteId }));
    const mine = MAK.myExams(rows, subjects, now);
    if (!mine.length) return h('p', { class: 'note meta', text: t('short.noneMine') });
    return [h('h5', { text: t('short.myExams') }), examList(mine, sites, now)];
  }

  // "Tu carrera: … · Cambiar": a list of all the degrees to select another one.
  function degreeLine(degree, data, settings, list) {
    const line = h('div', { class: 'degree meta' }, `${t('short.degree')}: ${degree.name || '–'}`);
    const change = h('button', { class: 'plain', attrs: { type: 'button' }, text: t('short.change') });
    change.addEventListener('click', async () => {
      change.disabled = true;
      const all = list && list.length ? list : await degreeList(data);
      line.replaceChildren(`${t('short.degree')}: `, select(all, settings.degree));
    });
    line.append(' · ', change);
    return line;
  }

  function select(list, value) {
    const sel = h('select', { attrs: { 'aria-label': t('short.degree') } },
      h('option', { attrs: { value: '' }, text: t('short.auto') }),
      list.map((d) => h('option', { attrs: { value: d.base }, text: d.name })));
    sel.value = value || '';
    sel.addEventListener('change', async () => {
      sel.disabled = true;
      await send({ type: 'setDegree', base: sel.value });
      run();
    });
    return sel;
  }

  function recordTile() {
    return h('section', { class: 'tile record' },
      h('h4', { text: `🎓 ${t('short.record')}` }),
      MAK.link(MAK.EXPEDIENTE_URL, t('short.recordLink')),
      h('p', { class: 'note meta', text: t('short.recordHelp') }));
  }

  // ---- Run -----------------------------------------------------------------------------

  let running = null;
  let noGuides = false; // the guides come later (the first sync, or content-guide.js)
  async function draw() {
    // "Mi sitio": only its home page, and only with a session (/portal without a session is the login page).
    if (where && where.pageOrTool && !/^(inicio|home|overview|hasiera)$/i.test(document.title.split(':').pop().trim())) return;
    const s = await pageFetch('/direct/session/current.json?auto=true', { cache: 'no-store', credentials: 'include' }).then((r) => r.json()).catch(() => null);
    if (!s || !s.userId) return;
    const data = (await MAK.safeCall(() => ext.storage.local.get(['guides', 'sites', 'settings', 'degree', 'degreeList']), null)) || {};
    const settings = MAK.withDefaults(data.settings);
    MAK.setLang(settings.lang);
    const guides = Object.entries(data.guides || {}).map(([siteId, v]) => ({ siteId, guide: v && v.guide })).filter((g) => g.guide && g.guide.url);
    const now = Date.now();
    const examTile = h('section', { class: 'tile' }, h('h4', { text: `📅 ${t('short.exams')}` }), h('p', { class: 'meta', text: t('short.loading') }));
    MAK.fill(box(), examTile, recordTile());
    noGuides = !guides.length && !settings.degree;
    if (noGuides) {
      examTile.remove();
      return;
    }
    const degree = await findDegree(data, guides.map((g) => g.guide), settings).catch(() => null);
    if (!degree || !degree.base) {
      const list = (degree && degree.list) || [];
      MAK.fill(examTile, h('h4', { text: `📅 ${t('short.exams')}` }), list.length ? h('div', { class: 'degree' }, h('span', { class: 'note', text: t('short.noDegree') }), select(list, settings.degree)) : h('p', { class: 'note meta', text: t('short.pageError') }));
      return;
    }
    const pdfLinks = (degree.pdfs || []).map((p) => MAK.link(p.url, p.season && !/oto|prim/i.test(p.text) ? `${p.text} (${seasonName(p.season)})` : p.text));
    MAK.fill(examTile,
      h('h4', null, `📅 ${t('short.exams')}`, degree.name ? h('span', { class: 'meta', text: ` · ${degree.name}` }) : null),
      degree.error ? h('p', { class: 'note meta', text: t('short.pageError') }) : periodsOf(degree, now),
      h('div', { class: 'mine' }, h('p', { class: 'meta', text: t('short.loading') })),
      h('h5', { text: t('short.calendars') }),
      h('div', { class: 'links' }, pdfLinks, MAK.link(MAK.evaluationUrl(degree.base), t('short.evaluation'))),
      degreeLine(degree, data, settings, degree.list));
    const mine = examTile.querySelector('.mine');
    const part = await examPart(degree, guides, data.sites, now).catch(() => null);
    if (part) MAK.fill(mine, part);
    else mine.remove();
  }
  function run() {
    running = (running || Promise.resolve()).then(draw, draw);
    return running;
  }

  run();
  // The permission for the calendars (tools.html?perm=exams), or new guides after a sync: draw again.
  let timer = null;
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !MAK.extensionAlive() || !(changes.examsGranted || (changes.guides && (noGuides || !document.getElementById(HOST_ID))))) return;
    clearTimeout(timer);
    timer = setTimeout(run, 500);
  });
})();
