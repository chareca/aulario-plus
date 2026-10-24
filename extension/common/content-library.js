// Aulario Plus: the box "Horarios de la biblioteca" in "Mi sitio", below the course guides, folded at the start: the
// hours of today (also in its head), the usual hours of the campus of the user (the setting "libraryCampus", in the
// settings of the popup) and the notices of the board of the library with other hours (exams, summer, Easter), with
// their calendar. The background reads them (libraryHours, lib/library.js). The box is in a closed shadow root.
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const HOST_ID = 'mak-library-host';
  const OPEN = `${HOST_ID}:open`; // '1': open (the box starts folded)
  const where = MAK.parsePortalPath(location.pathname);
  const onRoot = /^\/portal\/?$/.test(location.pathname);
  if (!(onRoot || (where && where.siteId && where.siteId.startsWith('~')))) return;
  const h = MAK.h;
  const t = (k, p) => MAK.t(k, p);
  const send = (msg) => MAK.safeCall(() => ext.runtime.sendMessage(msg), null);

  const CSS = () => `${MAK.BOX_CSS()}
    ${MAK.LINK_CSS}
    ${MAK.EXAM_CAL_CSS}
    .head .count { margin: 0 2px; }
    .today { margin: 0 0 8px; font-weight: 700; }
    h4 { margin: 0 0 4px; font-size: calc(15px * var(--ap-head-zoom)); line-height: 1.25; }
    .usual { margin: 0 0 6px; padding-left: 18px; }
    .notice { margin: 10px 0 0; padding: 9px 12px; background: var(--ap-item-bg); border: var(--ap-bw-sm) solid var(--ap-line); border-radius: var(--ap-radius-box); }
    .notice h5 { margin: 0; font-size: 1em; line-height: 1.3; }
    .notice .block { margin: 6px 0 0; }
    .notice .block p { margin: 0; }
    .links { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; }
    .cal-day.special, .cal-key.special { background: color-mix(in srgb, var(--ap-green) 34%, transparent); font-weight: 800; }
    .cal-day.closed, .cal-key.closed { background: color-mix(in srgb, var(--ap-red) 26%, transparent); }
    .cal-day.closed { color: var(--ap-muted); text-decoration: line-through; }
    .cal-key.usual { box-shadow: inset 0 0 0 1px var(--ap-muted); }
  `;

  const longDate = (ms) => new Intl.DateTimeFormat(MAK.locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(ms);
  const hoursText = (x) => (x.closed ? t('lib.closed') : x.hours);

  // The box: in the block "Aulario Plus" of "Mi sitio" (MAK.mySiteSlot), last (content-guide.js puts the guides before it).
  let box = null;
  function frame() {
    if (box) return box;
    const slot = MAK.mySiteSlot();
    if (!slot) return null;
    const host = document.createElement('div');
    host.id = HOST_ID;
    host.classList.add('in-block');
    const shadow = host.attachShadow({ mode: 'closed' });
    const title = t('lib.title');
    let open = false;
    try { open = localStorage.getItem(OPEN) === '1'; } catch {}
    const content = h('div', { class: 'content', hidden: !open });
    const chip = h('span', { class: 'count', hidden: true });
    const toggle = MAK.foldButton(open, { open: t('fold.open', { name: title }), close: t('fold.close', { name: title }) }, (o) => {
      content.hidden = !o;
      MAK.uiSave(OPEN, o);
    });
    shadow.append(MAK.themedStyle(CSS()), h('div', { class: 'box', attrs: { role: 'region', 'aria-label': title } },
      h('div', { class: 'head' }, h('strong', { class: 'title', text: title, on: { click: () => toggle.click() } }), chip, toggle), content));
    slot.append(host);
    box = { content, chip };
    return box;
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

  function notice(n, week, now) {
    return h('section', { class: 'notice' },
      h('h5', { text: n.title }),
      h('div', { class: 'meta', text: t('lib.published', { date: MAK.formatDay(n.date) }) }),
      n.cal ? calendar(n.cal, week, now) : null,
      n.blocks.map((b) => h('div', { class: 'block' }, b.head ? h('strong', { text: b.head }) : null, b.lines.map((l) => h('p', { text: l })))),
      h('div', { class: 'links' }, MAK.link(n.url, t('lib.notice')), n.pdf ? MAK.link(n.pdf, t('lib.pdf')) : null));
  }

  function draw(res) {
    const b = frame();
    if (!b) return;
    const data = res && res.data;
    const now = Date.now();
    const today = data ? MAK.libraryToday(data, now) : null;
    b.chip.hidden = !today;
    if (today) {
      b.chip.textContent = today.closed ? t('lib.todayClosed') : t('lib.today', { hours: today.hours });
      b.chip.className = `count${today.closed ? ' hot' : ''}`;
    }
    if (!data) {
      MAK.fill(b.content, h('p', { text: t('lib.error') }), h('div', { class: 'links' }, MAK.link(MAK.LIBRARY_BOARD, t('lib.board'))));
      return;
    }
    MAK.fill(b.content,
      res.error ? h('p', { class: 'meta', text: t('lib.stale', { date: MAK.formatDate(data.at) }) }) : null,
      today ? h('p', { class: 'today', text: `${t('lib.todayIs', { date: longDate(now) })}: ${hoursText(today)}${today.usual ? ` (${t('lib.usualDay')})` : ''}` }) : null,
      h('h4', { text: t('lib.library', { campus: t(`lib.campus.${data.campus}`) }) }),
      h('ul', { class: 'usual' }, data.page.lines.map((l) => h('li', { text: l }))),
      data.notices.map((n) => notice(n, data.page.week, now)),
      h('div', { class: 'links' }, MAK.link(data.page.url, t('lib.page')), MAK.link(MAK.LIBRARY_BOARD, t('lib.board'))),
      h('p', { class: 'meta', text: t('lib.campusHint') }));
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
