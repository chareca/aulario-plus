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

  // The look comes from the theme (lib/themes.js, MAK.themedStyle) and MAK.BOX_CSS.
  const CSS = () => `${MAK.BOX_CSS()}
    ${MAK.SEMESTERS_CSS}
    /* The exams on the full width; below them, the row of the actions. */
    .tiles { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; container-type: inline-size; }
    .tile { min-width: 0; padding: 12px 14px; background: var(--ap-surface); border: var(--ap-bw-sm) solid var(--ap-line); border-radius: var(--ap-radius); }
    .tile h4 { margin: 0 0 8px; font-size: calc(16px * var(--ap-head-zoom)); line-height: 1.2; }
    .tile h4 .meta { font-family: var(--ap-font); font-style: normal; font-weight: 400; letter-spacing: normal; font-size: 0.8em; }
    .period { margin: 2px 0; }
    /* The next exam of the user: the day in large, the subject, and the days to it. */
    .next-exam { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; margin: 0 0 12px; padding: 12px 14px;
      background: var(--ap-accent-soft); border-radius: var(--ap-radius); }
    .next-exam .day { flex: none; text-align: center; font-family: var(--ap-font-head); font-weight: var(--ap-head-weight); font-style: var(--ap-head-style);
      letter-spacing: var(--ap-head-spacing); font-size: calc(40px * var(--ap-head-zoom)); line-height: 0.9; }
    .next-exam .day small { display: block; font-size: 0.4em; letter-spacing: normal; margin-top: 2px; }
    .next-exam .what { flex: 1; min-width: 160px; display: flex; flex-direction: column; gap: 1px; }
    .next-exam .what .name { font-weight: 800; font-size: 1.08em; line-height: 1.2; }
    .next-exam .count { font-size: var(--ap-count-size); }
    /* One small card for each subject, in columns: the name and the countdown, then the two dates. */
    .exams { list-style: none; margin: 4px 0 8px; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px; }
    .exams li { min-width: 0; padding: 7px 9px; background: var(--ap-item-bg); border: var(--ap-bw-sm) solid var(--ap-line); border-radius: var(--ap-radius-box); }
    .exams .top { display: flex; gap: 6px; align-items: flex-start; }
    .exams .name { flex: 1; min-width: 0; font-weight: 700; font-size: 0.93em; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow-wrap: anywhere; }
    .exams .count { font-size: calc(var(--ap-count-size) * 0.78); }
    .exams .when { font-size: 0.86em; line-height: 1.4; color: var(--ap-muted); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .exams .when b { font-weight: 700; color: var(--ap-fg); }
    .exams .when.past { opacity: 0.55; text-decoration: line-through; }
    .exams .calc-need { font-size: 0.86em; font-weight: 700; color: var(--ap-fg); margin-top: 3px; }
    .exams .calc-need.low { color: var(--ap-red); }
    .exams .calc-need.ok { color: var(--ap-green); }
    .links { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 10px; }
    .note { font-size: 0.93em; margin: 6px 0; }
    /* The actions in one row below the exams: buttons of the theme, the same height. */
    .actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; align-items: stretch; }
    a.action, button.action { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 10px 14px; text-align: center;
      font: 700 1em/1.25 var(--ap-font); text-decoration: none; cursor: pointer; color: var(--ap-primary-fg); background: var(--ap-primary-bg);
      border: var(--ap-bw-sm) solid var(--ap-primary-edge); border-radius: var(--ap-radius-sm); box-shadow: var(--ap-shadow-sm); }
    a.action:hover, button.action:hover, a.action:focus-visible, button.action:focus-visible { filter: brightness(0.95); }
    a.action:focus-visible, button.action:focus-visible { outline: 2px solid var(--ap-fg); outline-offset: 2px; }
    .action .mak-arrow { width: 0.85em; height: 0.85em; flex: none; transition: transform 0.15s ease; }
    .action:hover .mak-arrow, .action:focus-visible .mak-arrow { transform: translate(1px, -2px); }
    @media (prefers-reduced-motion: reduce) { .action .mak-arrow { transition: none; } }
    .degree { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .degree select { font-size: 0.93em; max-width: 100%; }
    .mak-btn { padding: 4px 12px; }
  `;

  // ---- The box -------------------------------------------------------------------------

  let content = null;
  function box() {
    if (content) return content;
    const host = document.createElement('div');
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = MAK.themedStyle(CSS());
    content = h('div', { class: 'tiles' });
    const title = t('short.title');
    // In the block "Aulario Plus" of "Mi sitio" (MAK.mySiteSlot), first, without a title: the block has the
    // title and the arrow. Else above the course guides, below the banner of new items, or at the top of the
    // content, with a title and an arrow that folds the box (it stays folded when the page opens again).
    const slot = MAK.mySiteSlot();
    let head = null;
    if (!slot) {
      let hidden = false;
      try { hidden = localStorage.getItem(`${HOST_ID}:hidden`) === '1'; } catch {}
      content.hidden = hidden;
      const toggle = MAK.foldButton(!hidden, { open: t('fold.open', { name: title }), close: t('fold.close', { name: title }) }, (open) => {
        content.hidden = !open;
        try { localStorage.setItem(`${HOST_ID}:hidden`, open ? '0' : '1'); } catch {}
      });
      head = h('div', { class: 'head' }, h('strong', { class: 'title', text: title, on: { click: () => toggle.click() } }), toggle);
    }
    shadow.append(style, h('div', { class: 'box', attrs: { role: 'region', 'aria-label': title } }, head, content));
    const guide = document.getElementById(GUIDE_ID);
    const banner = document.getElementById(BANNER_ID);
    if (slot) {
      host.classList.add('in-block');
      slot.prepend(host);
    } else if (guide) guide.before(host);
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
    // The degree: the one that the user selected, else the degree of the plan code of the guides,
    // else the degree with the name of the guides.
    let base = chosen || MAK.degreeOfPlan(plan);
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

  // The periods of the exams of a semester: "Finales: … · Recuperación: …".
  function periodLine(p) {
    const parts = [p.finals ? `${t('short.finals')} ${MAK.shortPeriod(p.finals)}` : null, p.recovery ? `${t('short.recovery')} ${MAK.shortPeriod(p.recovery)}` : null].filter(Boolean);
    return parts.length ? h('div', { class: 'period', text: parts.join(' · ') }) : null;
  }

  // The days to a date (0 = today), and "hoy", "mañana", "en 12 días", "pasado".
  const daysTo = (ms, now) => {
    const start = (x) => new Date(new Date(x).toDateString()).getTime();
    return Math.round((start(ms) - start(now)) / DAY);
  };
  const countdown = (days) => (days < 0 ? t('short.done') : days === 0 ? t('short.today') : days === 1 ? t('short.tomorrow') : t('short.inDays', { n: days }));

  // The calculator of the guide (content-calc.js) for the exam of a subject: the grade that the user
  // needs in it, with the grades and weights that the user wrote. Null without grades of the user or
  // without an exam in the guide. { text, cls }.
  const fmtGrade = (n) => (Math.round(n * 100) / 100).toLocaleString(MAK.locale(), { maximumFractionDigits: 2 });
  function examNeed(siteId, guides, settings) {
    const g = guides.find((x) => x.siteId === siteId);
    const grades = settings.guideGrades[siteId];
    if (!g || !g.guide.evaluation || !grades || !Object.keys(grades).length) return null;
    const c = MAK.guideCalc(g.guide.evaluation.rows, grades, settings.guideWeights[siteId]);
    if (!c.total) return null;
    if (c.complete) return { text: t('short.calcFinal', { n: fmtGrade(c.final) }), cls: c.passed ? 'ok' : 'low' };
    const exam = c.rows.find((r) => r.weight > 0 && r.grade === null && MAK.activityKind(r.activity) === 'exam');
    if (!exam) return null;
    if (!c.reachable) return { text: t('short.calcNo'), cls: 'low' };
    return { text: t('short.calcNeed', { n: fmtGrade(Math.min(10, exam.plan)) }), cls: exam.plan > 7 ? 'low' : '' };
  }

  function examList(mine, sites, now, need) {
    const siteName = (id) => {
      const s = (sites || []).find((x) => x.id === id);
      return s ? MAK.publicSiteName(s) : '';
    };
    const today = new Date(new Date(now).toDateString()).getTime(); // the same "from today" as nextExam and MAK.myExams
    return h('ul', { class: 'exams' }, mine.map((r) => {
      const next = [r.final, r.recovery].filter((x) => x && x >= today).sort((a, b) => a - b)[0];
      const days = next ? daysTo(next, now) : -1;
      const name = siteName(r.siteId) || r.name;
      const line = (label, ms, room) => {
        if (!ms) return null;
        const text = `${MAK.formatDate(ms)}${room ? ` · ${room}` : ''}`;
        return h('div', { class: `when${ms < today ? ' past' : ''}`, title: `${label}: ${text}` }, h('b', { text: label }), ` ${text}`);
      };
      const near = days >= 0 && days <= 2 ? 'hot' : days >= 0 && days <= 7 ? 'soon' : '';
      return h('li', { class: near === 'hot' ? 'now' : near },
        h('div', { class: 'top' }, h('span', { class: 'name', text: name, title: name }), h('span', { class: `count ${near}`, text: countdown(days) })),
        line(t('short.final'), r.final, r.finalRoom),
        line(t('short.rec'), r.recovery, r.recoveryRoom),
        ((n) => (n ? h('div', { class: `calc-need ${n.cls}`, title: t('short.calcHelp') }, n.text) : null))(need ? need(r.siteId) : null));
    }));
  }

  // The next exam of the user (a final or a recovery, from today): the days to it in large, the subject,
  // and its date. Null without a next exam.
  function nextExam(mine, sites, now) {
    const today = new Date(new Date(now).toDateString()).getTime();
    let best = null;
    for (const r of mine) {
      for (const [ms, room, kind] of [[r.final, r.finalRoom, 'final'], [r.recovery, r.recoveryRoom, 'rec']]) {
        if (ms && ms >= today && (!best || ms < best.ms)) best = { ms, room, kind, r };
      }
    }
    if (!best) return null;
    const s = (sites || []).find((x) => x.id === best.r.siteId);
    const name = (s && MAK.publicSiteName(s)) || best.r.name;
    const days = daysTo(best.ms, now);
    // The date is on the right: here only the weekday and the time ("Final · martes, 12:00").
    const day = new Intl.DateTimeFormat(MAK.locale(), { weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(best.ms);
    const when = [t(best.kind === 'final' ? 'short.final' : 'short.rec'), day, best.room].filter(Boolean).join(' · ');
    return h('div', { class: 'next-exam' },
      h('div', { class: 'day' }, days ? [String(days), h('small', { text: t('short.days', { n: days }) })] : t('short.today')),
      h('div', { class: 'what' }, h('span', { class: 'meta', text: t('short.next') }), h('span', { class: 'name', text: name }), h('span', { class: 'meta', text: when })),
      h('span', { class: `count${days <= 2 ? ' hot' : days <= 7 ? ' soon' : ''}`, text: MAK.formatDay(best.ms) }));
  }

  // The dates of the subjects of the user, from the exam calendars of the degree: { mine (each
  // with its semester: the one of its calendar), note (a message instead of the dates) }.
  async function examData(degree, guides, now, show) {
    const pdfs = (degree.pdfs || []).filter((p) => !p.season || show(p.season));
    if (!pdfs.length) return { mine: [], note: null };
    const rows = [];
    let permission = false;
    let failed = 0;
    for (const p of pdfs) {
      const r = await send({ type: 'examRows', url: p.url });
      if (r && Array.isArray(r.rows)) rows.push(...r.rows.map((x) => Object.assign({}, x, { season: p.season || null })));
      else if (r && r.error === 'exams.permission') permission = true;
      else failed++;
    }
    if (permission) {
      const ask = h('button', { class: MAK.extButtonClass('btn'), attrs: { type: 'button' }, text: t('short.showDates') });
      ask.addEventListener('click', () => send({ type: 'openExamPermission' }));
      return { mine: [], note: h('div', null, h('p', { class: 'note meta', text: t('short.permHelp') }), ask) };
    }
    if (!rows.length) return { mine: [], note: h('p', { class: 'note meta', text: t(failed ? 'short.readError' : 'short.noRows') }) };
    const season = new Map(guides.map((g) => [g.guide.code, MAK.guideSeason(g.guide)]));
    const subjects = guides.map((g) => ({ code: g.guide.code, siteId: g.siteId }));
    const mine = MAK.myExams(rows, subjects, now).map((r) => Object.assign(r, { season: r.season || season.get(r.code) || MAK.currentSeason(now) }));
    return { mine: mine.filter((r) => show(r.season)), note: mine.length ? null : h('p', { class: 'note meta', text: t('short.noneMine') }) };
  }

  // The parts of the two semesters: the periods and the dates of the user (MAK.semesterSections).
  function examSections(degree, ex, sites, now, need) {
    const parts = {};
    for (const season of ['autumn', 'spring']) {
      const period = (degree.periods || []).find((p) => p.season === season);
      const mine = ex.mine.filter((r) => r.season === season);
      if (!period && !mine.length) continue;
      parts[season] = {
        body: [period ? periodLine(period) : null, mine.length ? examList(mine, sites, now, need) : null]
      };
    }
    return MAK.semesterSections({ key: 'exams', now, parts, title: (s) => t(`short.semester.${s}`) });
  }

  // "Tu carrera: … · Cambiar": a list of all the degrees to select another one.
  function degreeLine(degree, data, settings, list) {
    const line = h('div', { class: 'degree meta' }, degree.name || '–');
    const change = h('button', { class: 'plain', attrs: { type: 'button' }, text: t('short.change') });
    change.addEventListener('click', async () => {
      change.disabled = true;
      const all = list && list.length ? list : await degreeList(data);
      line.replaceChildren(select(all, settings.degree));
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

  // An action of the row below the exams: a link that opens a page in a new tab (MAK.h adds
  // target="_blank"), with an arrow. help: the tooltip.
  function actionLink(url, text, help) {
    const arrow = MAK.icon('arrow');
    arrow.classList.add('mak-arrow');
    return h('a', { class: 'action', href: url, title: help || undefined }, h('span', { class: 'go', text }), arrow);
  }

  function recordAction() {
    return actionLink(MAK.EXPEDIENTE_URL, t('short.recordGo'), t('short.recordHelp'));
  }

  // The forward of the internal mail of the sites to an email address (content-forward.js).
  function mailAction() {
    const open = h('button', { class: 'action', title: t('short.mailHelp'), attrs: { type: 'button', 'aria-haspopup': 'dialog' } }, h('span', { class: 'go', text: t('short.mailGo') }));
    open.addEventListener('click', () => { if (MAK.openForwardWindow) MAK.openForwardWindow(); });
    return open;
  }

  // The notes of the degree in Wuolah, at the year of the user (two links for a double degree).
  // links: MAK.wuolahLinks, or null while the degree is not known (a link to Wuolah without the degree).
  function wuolahActions(links) {
    // "Apuntes en Wuolah"; for a double degree, "Wuolah · ADE" and "Wuolah · Derecho". The address has
    // the year, but Wuolah can show another year when the user is logged in, so the text does not show it.
    const label = (w) => (w.name && links.length > 1 ? t('short.wuolahOf', { name: w.name }) : t('short.wuolahGo'));
    return (links || MAK.wuolahLinks('', null)).map((w) => actionLink(w.url, label(w), t('short.wuolahNote')));
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
    // The guides of the sites that the user did not hide (the old subjects are often hidden).
    const hidden = MAK.hiddenEverywhere(settings);
    const guides = MAK.lastYearGuides(Object.entries(data.guides || {}).map(([siteId, v]) => ({ siteId, guide: v && v.guide })).filter((g) => g.guide && g.guide.url && !hidden.has(g.siteId)), data.sites);
    const now = Date.now();
    const examTile = h('section', { class: 'tile' }, h('h4', { text: t('short.exams') }), h('p', { class: 'meta', text: t('short.loading') }));
    const actions = h('div', { class: 'actions' });
    const drawActions = (wuolah) => MAK.fill(actions, recordAction(), wuolahActions(wuolah), mailAction());
    drawActions(null);
    MAK.fill(box(), examTile, actions);
    noGuides = !guides.length && !settings.degree;
    if (noGuides) {
      examTile.remove();
      return;
    }
    const degree = await findDegree(data, guides.map((g) => g.guide), settings).catch(() => null);
    drawActions(MAK.wuolahLinks(degree && degree.base, MAK.studyYear(guides.map((g) => g.guide))));
    if (!degree || !degree.base) {
      const list = (degree && degree.list) || [];
      MAK.fill(examTile, h('h4', { text: t('short.exams') }), list.length ? h('div', { class: 'degree' }, h('span', { class: 'note', text: t('short.noDegree') }), select(list, settings.degree)) : h('p', { class: 'note meta', text: t('short.pageError') }));
      return;
    }
    // From 25 January the first semester is gone (its exams are past).
    const show = (season) => MAK.currentSeason(now) !== 'spring' || season !== 'autumn';
    const pdfLinks = (degree.pdfs || []).filter((p) => !p.season || show(p.season))
      .map((p) => MAK.link(p.url, p.season && !/oto|prim/i.test(p.text) ? `${p.text} (${seasonName(p.season)})` : p.text));
    const place = h('div', { class: 'mine' }, h('p', { class: 'meta', text: t('short.loading') }));
    MAK.fill(examTile,
      h('h4', { text: t('short.exams') }),
      degree.error ? h('p', { class: 'note meta', text: t('short.pageError') }) : null,
      place,
      h('div', { class: 'links' }, pdfLinks, MAK.link(MAK.evaluationUrl(degree.base), t('short.evaluation'))),
      degreeLine(degree, data, settings, degree.list));
    const ex = await examData(degree, guides, now, show).catch(() => ({ mine: [], note: h('p', { class: 'note meta', text: t('short.readError') }) }));
    const sections = examSections(degree, ex, data.sites, now, (siteId) => examNeed(siteId, guides, settings));
    const next = nextExam(ex.mine, data.sites, now);
    if (sections || ex.note) MAK.fill(place, next, sections, ex.note);
    else place.remove();
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
