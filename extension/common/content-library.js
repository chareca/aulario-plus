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
    .hr-chips { display: inline-flex; flex-wrap: wrap; gap: 6px; }
    .hr-chip { display: inline-flex; align-items: center; gap: 4px; }
    .hr-chip svg { width: 14px; height: 14px; }
    .hr-date { margin: 0 0 8px; }
    .hr-date::first-letter { text-transform: uppercase; }
    /* The cards: one below the other; with room, the three in a row, or the library (with a calendar) on the left and the
       sports on its right, one below the other. */
    .hr-cards { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; align-items: start; }
    .hr-side { display: contents; }
    @container (min-width: 700px) {
      .hr-cards { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .hr-cards.with-cal { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
      .hr-cards.with-cal > .hr-side { display: flex; flex-direction: column; gap: 10px; }
    }
    .hr-card { min-width: 0; padding: 10px 12px; background: var(--ap-item-bg); border: var(--ap-bw-sm) solid var(--ap-line); border-radius: var(--ap-radius-box); }
    .hr-top { display: flex; align-items: center; gap: 10px; margin: 0 0 8px; }
    .hr-ico { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%;
      color: var(--ap-accent); background: var(--ap-accent-soft); }
    .hr-ico svg { width: 21px; height: 21px; }
    .hr-top h5 { margin: 0; font-size: 1.02em; line-height: 1.25; }
    .hr-now { margin: 0 0 6px; }
    .hr-now b { font-size: 1.12em; }
    .hr-usual { margin: 0; padding-left: 18px; }
    .hr-notice { margin: 10px 0 0; padding: 8px 0 0; border-top: var(--ap-bw-sm) solid var(--ap-line); }
    .hr-notice h6 { margin: 0; font-size: 1em; line-height: 1.3; }
    .hr-block { margin: 6px 0 0; }
    .hr-block p { margin: 0; }
    .hr-links { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; }
    .cal-day.special, .cal-key.special { background: color-mix(in srgb, var(--ap-green) 34%, transparent); font-weight: 800; }
    .cal-day.closed, .cal-key.closed { background: color-mix(in srgb, var(--ap-red) 26%, transparent); }
    .cal-day.closed { color: var(--ap-muted); text-decoration: line-through; }
    .cal-key.usual { box-shadow: inset 0 0 0 1px var(--ap-muted); }
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
  // no color), with its hours on hover; the legend.
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
        const kind = !l || (usual && !usual.closed && !l.closed && usual.hours === l.hours) ? 'usual' : l.closed ? 'closed' : 'special';
        const shown = l || usual;
        if (kind !== 'usual') used.set(`${kind}:${l.hours}`, { kind, text: hoursText(l) });
        const tip = `${longDate(date)}: ${shown ? hoursText(shown) : '?'}`;
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
    n.blocks.map((b) => h('div', { class: 'hr-block' }, b.head ? h('strong', { text: b.head }) : null, b.lines.map((l) => h('p', { text: l })))),
    h('div', { class: 'hr-links' }, MAK.link(n.url, t('lib.notice')), n.pdf ? MAK.link(n.pdf, t('lib.pdf')) : null));

  // A card: its icon, its title and where, the hours of today, the usual ones, and more (notices, links).
  function card({ icon, title, place, today, lines, more }) {
    return h('section', { class: 'hr-card' },
      h('div', { class: 'hr-top' }, h('span', { class: 'hr-ico' }, MAK.icon(icon)), h('div', null, h('h5', { text: title }), place ? h('div', { class: 'meta', text: place }) : null)),
      today ? h('p', { class: 'hr-now' }, `${t('lib.now')}: `, h('b', { text: hoursText(today) }), today.usual ? h('span', { class: 'meta', text: ` (${t('lib.usualDay')})` }) : null) : null,
      lines && lines.length ? h('ul', { class: 'hr-usual' }, lines.map((l) => h('li', { text: l }))) : null,
      more);
  }

  function draw(res) {
    const p = frame();
    if (!p) return;
    const data = res && res.data;
    const now = Date.now();
    if (!data) {
      MAK.fill(p.chips);
      MAK.fill(p.content, h('p', { text: t('lib.error') }), h('div', { class: 'hr-links' }, MAK.link(MAK.LIBRARY_BOARD, t('lib.board')), MAK.link(MAK.SPORTS_HOURS, t('lib.sportsPage'))));
      return;
    }
    const sports = data.sports || {};
    const parts = [
      { icon: 'book', name: t('lib.libraryTitle'), today: MAK.libraryToday(data, now) },
      { icon: 'dumbbell', name: t('lib.access'), today: sports.access ? MAK.weekToday(sports.access.week, now) : null },
      { icon: 'pool', name: t('lib.pool'), today: sports.pool ? MAK.weekToday(sports.pool.week, now) : null }
    ];
    // The head: the hours of today of the three, with their icon.
    MAK.fill(p.chips, parts.filter((x) => x.today).map((x) => h('span', { class: `count hr-chip${x.today.closed ? ' hot' : ''}`,
      title: t('lib.chip', { name: x.name, hours: hoursText(x.today) }), attrs: { 'aria-label': t('lib.chip', { name: x.name, hours: hoursText(x.today) }) } }, MAK.icon(x.icon), hoursText(x.today))));
    const week = data.page ? data.page.week : null;
    const library = card({
      icon: 'book', title: t('lib.libraryTitle'), place: t('lib.campusOf', { campus: t(`lib.campus.${data.campus}`) }), today: parts[0].today,
      lines: data.page ? data.page.lines : null,
      more: [
        data.page ? null : h('p', { text: t('lib.libraryError') }),
        data.notices.map((n) => notice(n, week, now)),
        h('div', { class: 'hr-links' }, data.page ? MAK.link(data.page.url, t('lib.page')) : null, MAK.link(MAK.LIBRARY_BOARD, t('lib.board'))),
        h('p', { class: 'meta', text: t('lib.campusHint') })
      ]
    });
    const sportsLink = h('div', { class: 'hr-links' }, MAK.link(MAK.SPORTS_HOURS, t('lib.sportsPage')));
    const sportsCards = data.sports
      ? [['access', 'dumbbell'], ['pool', 'pool']].filter(([k]) => sports[k]).map(([k, icon]) => card({ icon, title: t(`lib.${k}`), place: t('lib.sportsPlace'), today: parts[k === 'access' ? 1 : 2].today, lines: sports[k].lines, more: sportsLink.cloneNode(true) }))
      : [card({ icon: 'dumbbell', title: t('lib.sports'), more: [h('p', { text: t('lib.sportsError') }), sportsLink] })];
    MAK.fill(p.content,
      res.error ? h('p', { class: 'meta', text: t('lib.stale', { date: MAK.formatDate(data.at) }) }) : null,
      h('p', { class: 'hr-date meta', text: longDate(now) }),
      h('div', { class: `hr-cards${data.notices.some((n) => n.cal) ? ' with-cal' : ''}` }, library, h('div', { class: 'hr-side' }, sportsCards)));
  }

  async function run() {
    const data = (await MAK.safeCall(() => ext.storage.local.get(['settings']), null)) || {};
    MAK.setLang(MAK.withDefaults(data.settings).lang);
    draw(await send({ type: 'libraryHours' }));
  }
  run();
  // Another campus in the settings: read it again.
  ext.storage.onChanged.addListener((changes, area) => {
    const s = area === 'local' && changes.settings;
    if (!s || !MAK.extensionAlive() || MAK.withDefaults(s.newValue).libraryCampus === MAK.withDefaults(s.oldValue).libraryCampus) return;
    run();
  });
})();
