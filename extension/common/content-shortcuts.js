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
  const EXAMS_FOLDED = `${HOST_ID}:exams`; // '1': the tile "Exámenes finales" is folded
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
    /* The exams on the full width, with the actions as small buttons in their head. */
    ${MAK.TILE_CSS}
    .period { margin: 2px 0; }
    /* The next exam of the user: the day in large, the subject, and the days to it. */
    .next-exam { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin: 0 0 10px; padding: 8px 12px;
      background: var(--ap-accent-soft); border-radius: var(--ap-radius); }
    .next-exam .day { flex: none; text-align: center; font-family: var(--ap-font-head); font-weight: var(--ap-head-weight); font-style: var(--ap-head-style);
      letter-spacing: var(--ap-head-spacing); font-size: calc(30px * var(--ap-head-zoom)); line-height: 0.9; }
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
    /* The actions: small buttons of the theme in the head of the exams (alone, without guides: a row). */
    .actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
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
    /* The buttons in the head of the tile (MAK.foldTile): the title never shrinks under them. */
    .tile-head > h4 { white-space: nowrap; }
    .tile-head .actions .actions { gap: 6px; margin: 0; padding: 0; background: none; border: 0; box-shadow: none; flex-direction: row; justify-content: inherit; }
    /* Small, also over the rules of a theme for each button (:nth-child): the theme keeps its colors. */
    .tile-head .actions .action:nth-child(n) { min-height: 0; padding: 4px 12px; font-size: 0.86em; transform: none; }
    /* The cards of the exams and the calendar side by side (the calendar shown, enough width); else the calendar below,
       with its months side by side. */
    .exams-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-items: start; }
    .exams-row:has(> .cal-wrap:not([hidden])) { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }
    @container (max-width: 860px) { .exams-row:has(> .cal-wrap:not([hidden])) { grid-template-columns: minmax(0, 1fr); } }
    ${MAK.EXAM_ROWS_CSS}
    .exams-row .cal-wrap { margin: 0; }
    ${MAK.EXAM_CAL_CSS}
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
        MAK.fold(content, open);
        MAK.uiSave(`${HOST_ID}:hidden`, !open); // '1': folded
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

  // The name of the subject of an exam: the short name of its site, else the name of the calendar.
  const siteName = (sites, r) => {
    const s = (sites || []).find((x) => x.id === r.siteId);
    return (s && MAK.publicSiteName(s)) || r.name;
  };

  let photos = {}; // the photo of each subject: { siteId: n } (MAK.assignSitePhotos)

  function examList(mine, sites, now, need) {
    const today = new Date(new Date(now).toDateString()).getTime(); // the same "from today" as nextExam and MAK.myExams
    return h('ul', { class: 'exams' }, mine.map((r) => {
      const next = [r.final, r.recovery].filter((x) => x && x >= today).sort((a, b) => a - b)[0];
      const days = next ? daysTo(next, now) : -1;
      const name = siteName(sites, r);
      const line = (label, ms, room) => {
        if (!ms) return null;
        const text = `${MAK.formatDate(ms)}${room ? ` · ${room}` : ''}`;
        return h('div', { class: `when${ms < today ? ' past' : ''}`, title: `${label}: ${text}` }, h('b', { text: label }), ` ${text}`);
      };
      const near = days >= 0 && days <= 2 ? 'hot' : days >= 0 && days <= 7 ? 'soon' : '';
      const photo = photos[r.siteId]; // the number of the photo of the subject (a theme with photos draws its planet)
      return h('li', { class: near === 'hot' ? 'now' : near, data: Number.isInteger(photo) ? { photo: String(photo) } : null },
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
    const name = siteName(sites, best.r);
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
    if (!(degree.pdfs || []).some((p) => !p.season || show(p.season))) return { mine: [], note: null };
    const ex = await MAK.loadMyExams({ degree, guides, now, send, show });
    if (ex.permission) {
      const ask = h('button', { class: MAK.extButtonClass('btn'), attrs: { type: 'button' }, text: t('short.showDates') });
      ask.addEventListener('click', () => send({ type: 'openExamPermission' }));
      return { mine: [], note: h('div', null, h('p', { class: 'note meta', text: t('short.permHelp') }), ask) };
    }
    if (!ex.read) return { mine: [], note: h('p', { class: 'note meta', text: t(ex.failed ? 'short.readError' : 'short.noRows') }) };
    return { mine: ex.mine, note: ex.mine.length ? null : h('p', { class: 'note meta', text: t('short.noneMine') }) };
  }

  // The parts of the two semesters: the periods, the dates of the user and the calendar of its exams
  // (MAK.semesterSections). cals: the calendars go in this list (the button shows or hides them).
  function examSections(degree, ex, sites, now, need, cals, calOn) {
    const parts = {};
    for (const season of ['autumn', 'spring']) {
      const period = (degree.periods || []).find((p) => p.season === season);
      const mine = ex.mine.filter((r) => r.season === season);
      if (!period && !mine.length) continue;
      const cal = MAK.examCalendar(MAK.examDays(mine, (r) => siteName(sites, r)), { now });
      if (cal) cals.push(h('div', { class: 'cal-wrap', hidden: !calOn }, cal));
      const list = mine.length ? examList(mine, sites, now, need) : null;
      parts[season] = { body: [period ? periodLine(period) : null, list || cal ? h('div', { class: 'exams-row' }, list, cal ? cals[cals.length - 1] : null) : null] };
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
    const data = (await MAK.safeCall(() => ext.storage.local.get(['guides', 'sites', 'settings', 'degree', 'degreeList', 'sitePhotos']), null)) || {};
    photos = data.sitePhotos && typeof data.sitePhotos === 'object' ? data.sitePhotos : {};
    const settings = MAK.withDefaults(data.settings);
    MAK.setLang(settings.lang);
    const guides = MAK.userGuides(data, MAK.hiddenEverywhere(settings));
    const now = Date.now();
    const actions = h('div', { class: 'actions' });
    const drawActions = (wuolah) => MAK.fill(actions, recordAction(), wuolahActions(wuolah), mailAction());
    drawActions(null);
    // The tile folds as the guides and the hours (its arrow, its title); it stays folded when the page opens again.
    const calendar = h('span', { class: 'actions' });
    const body = h('div', null, h('p', { class: 'meta', text: t('short.loading') }));
    let folded = false;
    try { folded = localStorage.getItem(EXAMS_FOLDED) === '1'; } catch {}
    const examTile = MAK.foldTile(t('short.exams'), body, !folded, (open) => MAK.uiSave(EXAMS_FOLDED, !open), [actions, calendar]);
    noGuides = !guides.length && !settings.degree;
    // Without guides (no degree): only the actions.
    if (noGuides) {
      MAK.fill(box(), actions);
      return;
    }
    MAK.fill(box(), examTile);
    const degree = await findDegree(data, guides.map((g) => g.guide), settings).catch(() => null);
    drawActions(MAK.wuolahLinks(degree && degree.base, MAK.studyYear(guides.map((g) => g.guide))));
    if (!degree || !degree.base) {
      const list = (degree && degree.list) || [];
      MAK.fill(body, list.length ? h('div', { class: 'degree' }, h('span', { class: 'note', text: t('short.noDegree') }), select(list, settings.degree)) : h('p', { class: 'note meta', text: t('short.pageError') }));
      return;
    }
    // From 25 January the first semester is gone (its exams are past).
    const show = (season) => MAK.currentSeason(now) !== 'spring' || season !== 'autumn';
    const pdfLinks = (degree.pdfs || []).filter((p) => !p.season || show(p.season))
      .map((p) => MAK.link(p.url, p.season && !/oto|prim/i.test(p.text) ? `${p.text} (${seasonName(p.season)})` : p.text));
    const place = h('div', { class: 'mine' }, h('p', { class: 'meta', text: t('short.loading') }));
    MAK.fill(body,
      degree.error ? h('p', { class: 'note meta', text: t('short.pageError') }) : null,
      place,
      h('div', { class: 'links' }, pdfLinks, MAK.link(MAK.evaluationUrl(degree.base), t('short.evaluation'))),
      degreeLine(degree, data, settings, degree.list));
    const ex = await examData(degree, guides, now, show).catch(() => ({ mine: [], note: h('p', { class: 'note meta', text: t('short.readError') }) }));
    const cals = [];
    const sections = examSections(degree, ex, data.sites, now, (siteId) => examNeed(siteId, guides, settings), cals, settings.examCalendar);
    if (cals.length) calendar.append(MAK.calendarButton(settings.examCalendar, cals, (on) => send({ type: 'setExamCalendar', on })));
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
    if (area !== 'local' || !MAK.extensionAlive() || !(changes.examsGranted || changes.sitePhotos || (changes.guides && (noGuides || !document.getElementById(HOST_ID))))) return;
    clearTimeout(timer);
    timer = setTimeout(run, 500);
  });
})();
