// Aulario Plus: the part "Horarios" of "Mi sitio", below the course guides, folded at the start: a card with an icon for
// the library of the campus of the user (the setting "libraryCampus", in the settings of the popup: the hours of today,
// the usual ones and the notices of its board with other hours, with their calendar), for the sports facilities and the
// gym, and for the pool. The hours of today of the three also in its head. The background reads them (libraryHours,
// lib/library.js). The part is in a closed shadow root.
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const HOST_ID = 'mak-library-host';
  const OPEN = `${HOST_ID}:open`; // '1': open (the part starts folded)
  const where = MAK.parsePortalPath(location.pathname);
  const onRoot = /^\/portal\/?$/.test(location.pathname);
  if (!(onRoot || (where && where.siteId && where.siteId.startsWith('~')))) return;
  const h = MAK.h;
  const t = (k, p) => MAK.t(k, p);
  const send = (msg) => MAK.safeCall(() => ext.runtime.sendMessage(msg), null);

  const CSS = () => `${MAK.BOX_CSS()}
    ${MAK.LINK_CSS}
    ${MAK.EXAM_CAL_CSS}
    ${MAK.TILE_CSS}
    .hr-chips { display: inline-flex; flex-wrap: wrap; justify-content: inherit; gap: 6px 10px; }
    .hr-chip { display: inline-flex; align-items: center; gap: 4px; }
    .hr-chip svg { width: 14px; height: 14px; }
    .hr-date { margin: 0 0 8px; }
    .hr-date::first-letter { text-transform: uppercase; }
    /* The cards: one below the other; with some room, two in a row (an odd last one on the full width); with more room,
       all in a row. With a notice of the library (a long card): the library on the left and the others on its right, one
       below the other, as high as it. */
    .hr-cards { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
    .hr-side { display: contents; }
    @container (min-width: 560px) {
      .hr-cards:not(.with-cal) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .hr-cards:not(.with-cal) .hr-card.last-odd { grid-column: 1 / -1; }
    }
    @container (min-width: 1400px) {
      .hr-cards:not(.with-cal) { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
      .hr-cards:not(.with-cal) .hr-card.last-odd { grid-column: auto; }
    }
    @container (min-width: 700px) {
      .hr-cards.with-cal { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
      .hr-cards.with-cal > .hr-side { display: flex; flex-direction: column; gap: 10px; }
      .hr-cards.with-cal > .hr-side > .hr-card { flex: 1 1 auto; }
    }
    .hr-card { min-width: 0; display: flex; container-type: inline-size; padding: 10px 12px; background: var(--ap-item-bg); border: var(--ap-bw-sm) solid var(--ap-line); border-radius: var(--ap-radius-box); }
    /* The card: its name, and open or closed at the top right; a narrow card (four in a row, a phone): open or closed at
       its bottom left, below the hours (the cards of a row as high as the highest one: all at the same height). */
    .hr-in { flex: 1 1 auto; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto 1fr; grid-template-areas: "id state" "body body"; gap: 8px 10px; }
    .hr-id { grid-area: id; min-width: 0; display: flex; align-items: center; gap: 10px; } /* the icon stays with its title */
    .hr-body { grid-area: body; min-width: 0; }
    @container (max-width: 400px) {
      .hr-in { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 1fr auto; grid-template-areas: "id" "body" "state"; }
      .hr-in > .hr-state { justify-self: start; align-self: end; margin: 2px 0 0; }
    }
    /* Open or closed now: a round check (white on green) or cross (white on red), and the text in that color. */
    .hr-state { grid-area: state; align-self: center; display: inline-flex; align-items: center; gap: 7px; }
    .hr-say { display: flex; flex-direction: column; line-height: 1.2; }
    .hr-say small { font-size: 0.86em; font-weight: 600; }
    .hr-state.open { color: var(--ap-green); }
    .hr-state.shut { color: var(--ap-red); }
    .hr-dot { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; color: #ffffff; }
    .hr-state.open .hr-dot { background: #1f9d55; }
    .hr-state.shut .hr-dot { background: #d93d3d; }
    .hr-dot svg { width: 15px; height: 15px; stroke-width: 3; }
    .hr-ico { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%;
      color: var(--ap-accent); background: var(--ap-accent-soft); }
    .hr-ico svg { width: 21px; height: 21px; }
    .hr-id h5 { margin: 0; font-size: 1.02em; line-height: 1.25; }
    .hr-now { margin: 0 0 6px; }
    .hr-now b { font-size: 1.12em; }
    .hr-usual { margin: 0; padding-left: 18px; }
    .hr-nw { white-space: nowrap; } /* a time is never cut */
    .hr-notice { margin: 10px 0 0; padding: 8px 0 0; border-top: var(--ap-bw-sm) solid var(--ap-line); }
    .hr-notice h6 { margin: 0; font-size: 1em; line-height: 1.3; }
    .hr-block { margin: 6px 0 0; }
    .hr-block p { margin: 0; }
    .hr-links { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; }
    .cal-day.special, .cal-key.special { background: color-mix(in srgb, var(--ap-green) 34%, transparent); font-weight: 800; }
    .cal-day.closed, .cal-key.closed { background: color-mix(in srgb, var(--ap-red) 26%, transparent); }
    .cal-day.closed { color: var(--ap-muted); text-decoration: line-through; }
    .cal-key.usual { box-shadow: inset 0 0 0 1px var(--ap-muted); }
    /* A day whose hours the reader does not know (the color of an "aula"): striped. */
    .cal-day.unknown, .cal-key.unknown { background: repeating-linear-gradient(135deg, transparent 0 3px, color-mix(in srgb, var(--ap-muted) 35%, transparent) 3px 5px); }
  `;

  const longDate = (ms) => new Intl.DateTimeFormat(MAK.locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(ms);
  const hoursText = (x) => (x.closed ? t('lib.closed') : x.hours);

  // The part: a tile in the block "Aulario Plus" of "Mi sitio" (MAK.mySiteSlot), last (content-guide.js puts the guides
  // before it).
  let part = null;
  function frame() {
    if (part) return part;
    const slot = MAK.mySiteSlot();
    if (!slot) return null;
    const host = document.createElement('div');
    host.id = HOST_ID;
    host.classList.add('in-block');
    const shadow = host.attachShadow({ mode: 'closed' });
    let open = false;
    try { open = localStorage.getItem(OPEN) === '1'; } catch {}
    const content = h('div');
    const chips = h('span', { class: 'hr-chips' });
    shadow.append(MAK.themedStyle(CSS()), h('div', { class: 'box', attrs: { role: 'region', 'aria-label': t('lib.title') } },
      h('div', { class: 'tiles' }, MAK.foldTile(t('lib.title'), content, open, (o) => MAK.uiSave(OPEN, o), chips))));
    slot.append(host);
    part = { content, chips };
    return part;
  }

  // The months of a calendar from this one on: each day in the color of its hours (the usual hours of its day of the week:
  // no color; not known: striped), with its hours on hover; the legend.
  function calendar(cal, week, now) {
    const current = new Date(now).getFullYear() * 12 + new Date(now).getMonth();
    const months = cal.months.filter((x) => x.y * 12 + x.m >= current);
    if (!months.length) return null;
    const narrow = new Intl.DateTimeFormat(MAK.locale(), { weekday: 'narrow' });
    const weekdays = Array.from({ length: 7 }, (_, i) => narrow.format(new Date(2024, 0, 1 + i))); // 1 January 2024: a Monday
    const today = new Date(now).toDateString();
    const used = new Map();
    const month = (x) => {
      const title = new Intl.DateTimeFormat(MAK.locale(), { month: 'long', year: 'numeric' }).format(new Date(x.y, x.m, 1));
      const cells = MAK.monthWeeks(x.y, x.m).flat().map((day) => {
        if (!day) return h('span', { class: 'cal-day out' });
        const date = new Date(x.y, x.m, day);
        const usual = week && week[date.getDay()];
        const l = cal.legend[x.days[day - 1]];
        const unknown = x.days[day - 1] === -2;
        const kind = unknown ? 'unknown' : !l || l.usual || (usual && !usual.closed && !l.closed && usual.hours === l.hours) ? 'usual' : l.closed ? 'closed' : 'special';
        const shown = unknown ? null : l && !l.usual ? l : usual;
        if (kind !== 'usual') used.set(`${kind}:${unknown ? '' : l.hours}`, { kind, text: unknown ? t('lib.seePdf') : hoursText(l) });
        const tip = `${longDate(date)}: ${shown ? hoursText(shown) : unknown ? t('lib.seePdf') : '?'}`;
        return h('span', { class: ['cal-day', kind === 'usual' ? '' : kind, date.toDateString() === today ? 'today' : ''].filter(Boolean).join(' '), text: String(day), attrs: { title: tip, 'aria-label': tip } });
      });
      return h('div', { class: 'cal-month' }, h('div', { class: 'cal-title', text: title }),
        h('div', { class: 'cal-grid', attrs: { 'aria-label': title } }, weekdays.map((w) => h('span', { class: 'cal-wd', text: w, attrs: { 'aria-hidden': 'true' } })), cells));
    };
    const shown = months.map(month);
    const key = (kind, text) => h('span', null, h('span', { class: `cal-key ${kind}` }), text);
    return h('div', { class: 'cal-wrap' }, h('div', { class: 'cal' }, h('div', { class: 'cal-months' }, shown),
      h('div', { class: 'cal-legend meta' }, [...used.values()].map((u) => key(u.kind, u.text)), key('usual', t('lib.usual')))));
  }

  const notice = (n, week, now) => h('div', { class: 'hr-notice' },
    h('h6', { text: n.title }),
    h('div', { class: 'meta', text: t('lib.published', { date: MAK.formatDay(n.date) }) }),
    n.cal ? calendar(n.cal, week, now) : null,
    n.blocks.map((b) => h('div', { class: 'hr-block' }, b.head ? h('strong', { text: b.head }) : null, b.lines.map((l) => h('p', { text: MAK.shortDays(l) })))),
    h('div', { class: 'hr-links' }, MAK.link(n.url, t('lib.notice')), n.pdf ? MAK.link(n.pdf, t('lib.pdf')) : null));

  // The hours of today in the head: "9:00–22:00"; closed: "sábados cerrado" (also the usual hours of the day of the week),
  // "verano cerrado" (a notice of the summer, Easter or Christmas) or "hoy cerrado" (another notice).
  function chipText(today, now) {
    if (!today.closed) return today.hours;
    if (!today.usual) {
      const reason = MAK.closedReason(today.notice);
      return reason ? t('lib.closedFor', { reason: t(`lib.reason.${reason}`) }) : t('lib.closedToday');
    }
    const day = new Intl.DateTimeFormat(MAK.locale(), { weekday: 'long' }).format(now);
    return t('lib.closedOn', { days: /s$/i.test(day) ? day : `${day}s` });
  }

  // Open now (until when) or closed (when it opens), in two lines: "Abierto" / "hasta las 22:00", "Cerrado" / "abre el
  // lunes a las 8:00".
  const time = (ms) => new Intl.DateTimeFormat(MAK.locale(), { hour: 'numeric', minute: '2-digit' }).format(ms);
  function stateText(st, now) {
    if (st.open) return [t('lib.open'), t('lib.until', { time: time(st.at) })];
    if (!st.at) return [t('lib.closed'), ''];
    const day = (ms) => new Date(new Date(ms).toDateString()).getTime();
    const days = Math.round((day(st.at) - day(now)) / MAK.DAY);
    if (days === 0) return [t('lib.closed'), t('lib.opensToday', { time: time(st.at) })];
    if (days === 1) return [t('lib.closed'), t('lib.opensTomorrow', { time: time(st.at) })];
    const when = new Intl.DateTimeFormat(MAK.locale(), days < 7 ? { weekday: 'long' } : { day: 'numeric', month: 'long' }).format(st.at);
    return [t('lib.closed'), t('lib.opensOn', { day: when, time: time(st.at) })];
  }
  function stateMark(st, now) {
    if (!st) return null;
    const [word, detail] = stateText(st, now);
    return h('div', { class: `hr-state ${st.open ? 'open' : 'shut'}`, attrs: { 'aria-label': detail ? `${word}, ${detail}` : word } },
      h('span', { class: 'hr-dot' }, MAK.icon(st.open ? 'check' : 'x')),
      h('span', { class: 'hr-say', attrs: { 'aria-hidden': 'true' } }, h('b', { text: word }), detail ? h('small', { text: detail }) : null));
  }

  // A card: its icon, its title and where, open or closed now, the hours of today, the usual ones, and more (notices).
  function card({ icon, title, place, state, today, note, lines, more, now }) {
    return h('section', { class: 'hr-card' }, h('div', { class: 'hr-in' },
      h('div', { class: 'hr-id' }, h('span', { class: 'hr-ico' }, MAK.icon(icon)), h('div', null, h('h5', { text: title }), place ? h('div', { class: 'meta', text: place }) : null)),
      stateMark(state, now),
      h('div', { class: 'hr-body' },
        today ? h('p', { class: 'hr-now' }, `${t('lib.now')}: `, h('b', { text: hoursText(today) }), h('span', { class: 'meta', text: ` (${note || t(today.usual ? 'lib.usualDay' : 'lib.specialDay')})` })) : null,
        lines && lines.length ? h('ul', { class: 'hr-usual' }, lines.map((l) => (typeof l === 'string' ? h('li', { text: MAK.shortDays(l) }) : l))) : null,
        more)));
  }

  function draw(res) {
    const p = frame();
    if (!p) return;
    const data = res && res.data;
    const now = Date.now();
    if (!data) {
      MAK.fill(p.chips);
      MAK.fill(p.content, h('p', { text: t('lib.error') }));
      return;
    }
    const sports = data.sports || {};
    const places = data.food ? data.food.places : [];
    const dayOf = {
      library: (ms) => MAK.libraryDay(data, ms),
      access: (ms) => MAK.weekToday(sports.access && sports.access.week, ms),
      pool: (ms) => MAK.weekToday(sports.pool && sports.pool.week, ms),
      food: (ms) => MAK.foodDay(places, ms)
    };
    // The cafeterias: also after the holidays of the summer.
    const parts = [['library', 'book'], ['access', 'dumbbell'], ['pool', 'pool'], ['food', 'coffee']].map(([k, icon]) => ({ k, icon, today: dayOf[k](now), state: MAK.openState(dayOf[k], now, k === 'food' ? 75 : 14) }));
    // The head: the hours of today of each one (green: open now; red: closed now), or one word when the three are closed today.
    const known = parts.filter((x) => x.today);
    MAK.fill(p.chips, known.length === parts.length && known.every((x) => x.today.closed)
      ? h('span', { class: 'count hot', text: t('lib.allClosed') })
      : known.map((x) => h('span', { class: `count hr-chip${x.state && x.state.open ? ' ok' : ' hot'}` }, MAK.icon(x.icon),
        `${t(`lib.short.${x.k}`)} · ${chipText(x.today, now)}`)));
    const week = data.page ? data.page.week : null;
    const notices = MAK.visibleNotices(data, now);
    const library = card({
      icon: 'book', title: t('lib.libraryTitle'), place: t('lib.campusOf', { campus: t(`lib.campus.${data.campus}`) }), state: parts[0].state, today: parts[0].today, now,
      lines: data.page ? data.page.lines : null,
      more: [data.page ? null : h('p', { text: t('lib.libraryError') }), notices.map((n) => notice(n, week, now))]
    });
    const sportsCards = data.sports
      ? [parts[1], parts[2]].filter((x) => sports[x.k]).map((x) => card({ icon: x.icon, title: t(`lib.${x.k}`), place: t('lib.sportsPlace'), state: x.state, today: x.today, now, lines: sports[x.k].lines }))
      : [card({ icon: 'dumbbell', title: t('lib.sports'), more: h('p', { text: t('lib.sportsError') }) })];
    // The cafeterias and the dining hall of the campus: the hours of today of each one (the period: course, holidays,
    // weekend).
    const period = MAK.foodPeriod(now);
    const placeName = (p) => (/comedor/i.test(p.name) ? t('lib.dining') : p.name.replace(/^cafeter[ií]a\s+/i, ''));
    const nw = (text) => h('span', { class: 'hr-nw', text });
    const placeLine = (p) => {
      const x = p[period];
      return h('li', null, `${placeName(p)}: `, !x ? '?' : x.closed ? t('lib.closed').toLowerCase()
        : [nw(x.hours), x.extra && p.extra ? [' · ', nw(`${t(`lib.extra.${p.extra}`)} ${x.extra}`)] : null]);
    };
    const foodCard = !data.food
      ? card({ icon: 'coffee', title: t('lib.food'), more: h('p', { text: t('lib.foodError') }) })
      : places.length
        ? card({ icon: 'coffee', title: t('lib.food'), place: t('lib.campusOf', { campus: t(`lib.campus.${data.campus}`) }), state: parts[3].state, today: parts[3].today, now,
          note: t(`lib.period.${period}`), lines: places.map(placeLine) })
        : null;
    const side = [...sportsCards, foodCard].filter(Boolean);
    const all = [library, ...side];
    if (all.length % 2) all.at(-1).classList.add('last-odd'); // two columns: the last one alone on the full width
    MAK.fill(p.content,
      res.error ? h('p', { class: 'meta', text: t('lib.stale', { date: MAK.formatDate(data.at) }) }) : null,
      h('p', { class: 'hr-date meta', text: longDate(now) }),
      h('div', { class: `hr-cards${notices.length ? ' with-cal' : ''}` }, library, h('div', { class: 'hr-side' }, side)));
  }

  // The days of a notice in short (MAK.noticeSummary), a line for each group: "Fines de semana y festivos, 18 de abril–14
  // de junio: 9:00–22:45", "6–10 de julio: Cerrado", "13 y 14 de julio: 9:00–13:00".
  function summaryLines(data, n) {
    const groups = MAK.noticeSummary(data, n);
    if (!groups.length) return [h('p', { text: t('lib.sum.none') })];
    const locale = MAK.locale();
    const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' });
    const list = (items) => new Intl.ListFormat(locale, { type: 'conjunction' }).format(items);
    const span = (g) => date.formatRange(g.days[0], g.days.at(-1));
    // "24, 25 y 31 de diciembre y 1 de enero" ("December 24, 25 and 31 and January 1"): the month once.
    const days = (all) => {
      const months = [];
      for (const ms of all) {
        const d = new Date(ms);
        const last = months.at(-1);
        if (last && last[0].getMonth() === d.getMonth()) last.push(d);
        else months.push([d]);
      }
      return list(months.map((m) => {
        const full = /^\d/.test(date.format(m[0])); // the day before the month (es), or after it (en)
        return list(m.map((d, i) => ((full ? i === m.length - 1 : i === 0) ? date.format(d) : String(d.getDate()))));
      }));
    };
    const week = (wds) => {
      const key = [...wds].sort().join('');
      if (key === '06') return t('lib.sum.weekends');
      if (key === '12345') return t('lib.sum.weekdays');
      if (wds.length === 7) return t('lib.sum.everyDay');
      const name = new Intl.DateTimeFormat(locale, { weekday: 'long' });
      const names = list([1, 2, 3, 4, 5, 6, 0].filter((wd) => wds.includes(wd)).map((wd) => name.format(new Date(2024, 0, wd || 7)).replace(/([^s])$/, '$1s')));
      return names.charAt(0).toUpperCase() + names.slice(1);
    };
    const what = (g) => (g.form === 'list' ? days(g.days)
      : g.form === 'run' ? span(g)
        : g.form === 'week' ? `${g.extra ? t('lib.sum.holidays', { days: week(g.weekdays) }) : week(g.weekdays)}, ${span(g)}`
          : `${t('lib.sum.some', { n: g.days.length })}, ${span(g)}`);
    const lines = groups.slice(0, 5).map((g) => h('li', { text: `${what(g)}: ${g.value ? hoursText(g.value) : t('lib.sum.unknown')}` }));
    return [h('ul', null, lines), groups.length > 5 ? h('p', { text: t('lib.sum.more') }) : null];
  }

  // A window for the notices of the hours that this campus did not show yet (libraryHours: fresh, once each): their
  // title, their days in short and a link to each one.
  function announce(data, fresh) {
    const list = (data.notices || []).filter((n) => fresh.includes(n.url));
    if (!list.length || !MAK.askWindow) return;
    MAK.askWindow(t(list.length > 1 ? 'lib.news.titleMany' : 'lib.news.title'),
      list.map((n) => h('div', null, h('p', null, h('b', { text: n.title })), summaryLines(data, n), MAK.link(n.url, t('lib.notice')))),
      t('lib.news.ok'), null);
  }

  async function run() {
    const data = (await MAK.safeCall(() => ext.storage.local.get(['settings']), null)) || {};
    MAK.setLang(MAK.withDefaults(data.settings).lang);
    if (!frame()) return; // no block on this page: nothing is asked (a new notice keeps its window for later)
    const res = await send({ type: 'libraryHours' });
    draw(res);
    if (res && res.data && Array.isArray(res.fresh) && res.fresh.length) announce(res.data, res.fresh);
  }
  run();
  // Another campus in the settings: read it again.
  ext.storage.onChanged.addListener((changes, area) => {
    const s = area === 'local' && changes.settings;
    if (!s || !MAK.extensionAlive() || MAK.withDefaults(s.newValue).libraryCampus === MAK.withDefaults(s.oldValue).libraryCampus) return;
    run();
  });
})();
