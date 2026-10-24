// Aulario Plus: the popup. The same page opens in a tab with "?view=tab".
// The popup reads the storage and sends messages. Only the background script writes.
const ext = globalThis.browser ?? globalThis.chrome;
const { h, fill, t } = MAK;
const ORIGINS = ['https://miaulario.unavarra.es/*', 'https://sso.unavarra.es/*', 'https://www.unavarra.es/*'];
const MAX_INACTIVE_MIN = 60;
const $ = (id) => document.getElementById(id);
const send = (msg) => Promise.resolve(ext.runtime.sendMessage(msg)).catch(() => null);
const WIDE = new URLSearchParams(location.search).get('view') === 'tab';
// After opening another tab: the popup closes, the tab of the extension (WIDE) stays.
const closePopup = () => { if (!WIDE) window.close(); };

let S = {}; // copy of storage.local
let status = null; // keep-alive status from the background
let syncing = false;
let flash = null; // { text, until }: a short message in the header
let lastRender = 0;
let pendingRender = false;
const ui = { query: '', searchSel: 0, searchList: [], editSite: null, dueWeek: null, dueSite: '', inbox: { type: '', siteId: '', unreadOnly: false, query: '' }, openAnn: new Set(), gradesSeenAt: null, calc: null };
// The popup reads only the Gradebook page (for the calculator). All other data comes from the storage.
const courseApi = MAK.createApi({ fetch: (u, i) => fetch(u, i) });

const settings = () => MAK.withDefaults(S.settings);
// The style of the text links (lib/ui.js), with the colors of the popup.
document.head.append(h('style', { text: MAK.LINK_CSS + MAK.LOGO_CSS + MAK.RANK_CSS }));
const hiddenSet = () => MAK.hiddenEverywhere(settings());
// The sites with the names to show (short names or names from the user). Made again only when
// the sites or the settings change.
let named = { sites: null, settings: null, list: [] };
function namedSites() {
  if (named.sites !== S.sites || named.settings !== S.settings) named = { sites: S.sites, settings: S.settings, list: MAK.namedSites(S.sites, settings()) };
  return named.list;
}
const siteOf = (id) => namedSites().find((s) => s.id === id) || null;
const siteTitle = (id) => (siteOf(id) || {}).title || id;
const withNames = () => Object.assign({}, S, { sites: namedSites() });

// ---- Panels ------------------------------------------------------------------

const panels = {
  home: { render: renderHome },
  due: { render: renderDue },
  inbox: { render: renderInbox },
  new: { render: renderNew, open: openNew },
  grades: { render: renderGrades, open: openGrades },
  sites: { render: renderSites },
  settings: { render: renderSettings }
};
let current = 'home';

function selectTab(name) {
  if (!panels[name]) name = 'home';
  current = name;
  if (ui.query) setQuery('');
  for (const btn of document.querySelectorAll('nav.tabs [role="tab"]')) {
    btn.setAttribute('aria-selected', String(btn.dataset.tab === name));
  }
  for (const key of Object.keys(panels)) $(`tab-${key}`).hidden = key !== name || !!ui.query;
  if (panels[name].open) panels[name].open();
  renderCurrent();
}

function renderCurrent() {
  lastRender = Date.now();
  pendingRender = false;
  // The open lists stay open: the same title (without its count, which a sync can change) and the same
  // place among the lists with that title (three corrections are three "Comentario del profesor").
  const panel = $(`tab-${current}`);
  const keyed = () => {
    const seen = new Map();
    return [...panel.querySelectorAll('details > summary')].map((s) => {
      const text = s.textContent.replace(/\s*\(\d+\)\s*$/, '');
      const n = seen.get(text) || 0;
      seen.set(text, n + 1);
      return [`${n} ${text}`, s.parentElement];
    });
  };
  const open = new Set(keyed().filter(([, d]) => d.open).map(([k]) => k));
  // The button under the pointer is a new one: it takes the hover at once, without the slow change of its colors
  // (else they come again: a flicker). Until the browser gives it the hover (mouseover) and draws it, or a moment.
  const go = MAK.holdStill(panel);
  panel.addEventListener('mouseover', go, { once: true });
  setTimeout(go, 300);
  panels[current].render(panel);
  if (open.size) for (const [k, d] of keyed()) if (open.has(k)) d.open = true;
  updateTabCounts();
  if (ui.query) renderSearch();
  tick();
}

function setCount(id, n) {
  const el = $(id);
  if (!el) return;
  el.hidden = !n;
  el.textContent = n > 99 ? '99+' : String(n || '');
}

function updateTabCounts() {
  const ok = S.meta && S.meta.lastSync && settings().syncEnabled;
  setCount('count-inbox', ok ? inboxModel().counts.total : 0);
  setCount('count-new', ok ? MAK.buildNews(withNames(), Date.now()).reduce((n, x) => n + x.total, 0) : 0);
  // While the Grades tab is open, its count stays at the value of the moment when it opened.
  setCount('count-grades', ok && current !== 'grades' ? MAK.unseenGrades(S.grades, S.gradesSeenAt, hiddenSet()).length : 0);
}

// Do not draw the panel again while the user types or selects in it.
function userIsInPanel() {
  const a = document.activeElement;
  return !!(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && a.type !== 'checkbox' && a.closest('[role="tabpanel"]'));
}

let renderTimer = null;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderHeader();
    if (userIsInPanel()) pendingRender = true;
    else renderCurrent();
  }, 120);
}
document.addEventListener('focusout', () => { if (pendingRender) setTimeout(() => { if (!userIsInPanel()) renderCurrent(); }, 0); });

// ---- Search --------------------------------------------------------------------
// While the search box has text, the results replace the panel (a fuzzy finder, lib/search.js). The
// index is made again only when the stored data changes.

const SEARCH_KEY = MAK.searchKey();
let searchIndex = null;

function setQuery(value) {
  ui.query = value;
  ui.searchSel = 0;
  if ($('search').value !== value) $('search').value = value;
  $(`tab-${current}`).hidden = !!value.trim();
  renderSearch();
}

function renderSearch() {
  const el = $('search-results');
  const q = ui.query.trim();
  el.hidden = !q;
  if (!q) return;
  if (!searchIndex) searchIndex = MAK.buildSearchIndex(S, settings());
  const list = MAK.searchIndex(searchIndex, q, 30);
  const groups = MAK.searchGroups(list);
  ui.searchList = groups.flatMap(([, l]) => l);
  ui.searchSel = Math.max(0, Math.min(ui.searchSel, ui.searchList.length - 1));
  if (!ui.searchList.length) return fill(el, emptyBox(t('search.none', { q })));
  let i = 0;
  fill(
    el,
    groups.map(([type, l]) => [
      h('h2', { class: 'group', text: t(`search.type.${type}`) }),
      l.map((x) => {
        const n = i++;
        return h(
          'a',
          { class: `result${n === ui.searchSel ? ' sel' : ''}`, href: x.url, data: { n } },
          h('span', { class: 'title' }, MAK.marked(x.title, x.hl)),
          h('span', { class: 'meta' }, MAK.searchMeta(x))
        );
      })
    ])
  );
  markSearchSel();
}

// The selected result: its mark, and in view.
function markSearchSel() {
  const el = $('search-results');
  for (const a of el.querySelectorAll('.result')) a.classList.toggle('sel', Number(a.dataset.n) === ui.searchSel);
  const sel = el.querySelector('.result.sel');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

function setupSearch() {
  const box = $('search');
  box.addEventListener('input', () => setQuery(box.value));
  // Up and down: the arrows, and on macOS also Ctrl+P and Ctrl+N. The end of the list goes to the start.
  const MAC = MAK.isMac();
  box.addEventListener('keydown', (e) => {
    const ctrl = MAC && e.ctrlKey && !e.metaKey && !e.altKey;
    const key = e.key.toLowerCase();
    const step = e.key === 'ArrowDown' || (ctrl && key === 'n') ? 1 : e.key === 'ArrowUp' || (ctrl && key === 'p') ? -1 : 0;
    if (step && ui.query.trim()) {
      e.preventDefault();
      const n = ui.searchList.length;
      if (n) ui.searchSel = (ui.searchSel + step + n) % n;
      markSearchSel(); // the same results: only the mark moves (not the search again, at each key)
    } else if (e.key === 'Enter') {
      const x = ui.searchList[ui.searchSel];
      if (x) ext.tabs.create({ url: x.url });
    } else if (e.key === 'Escape' && ui.query) {
      e.preventDefault();
      setQuery('');
    }
  });
  // "/" or Ctrl+K (⌘K) puts the focus in the search box.
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '');
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      box.focus();
      box.select();
    }
  });
}

// ---- Header ------------------------------------------------------------------

function renderHeader() {
  const now = Date.now();
  const meta = S.meta || {};
  const last = S.last || null;
  // The state of the session in words (a problem: underlined, in the color of the theme).
  const line = $('status');
  line.className = 'status-line';
  let headline;
  if (S.paused) { line.classList.add('warn'); headline = t('status.paused'); }
  else if (last && last.loggedIn) headline = t('status.connected');
  else if (last) { line.classList.add('bad'); headline = t(last.error ? 'status.networkError' : 'status.notLoggedIn'); }
  else headline = t('status.noPing');
  $('headline').textContent = headline;

  let sub;
  if (flash && flash.until > now) sub = flash.text;
  else if (!settings().syncEnabled) sub = t('sub.syncOff');
  else if (syncing) sub = t('sub.updating');
  else if (meta.lastSync) sub = t('sub.lastSync', { ago: MAK.ago(meta.lastSync, now) }) + (meta.stale && Object.keys(meta.stale).length ? t('sub.stale') : '');
  else sub = t('sub.noData');
  $('subline').textContent = sub;
}

// ---- Home: the main menu -------------------------------------------------------
// The things that the user needs most, in one place: the session (pause and resume), four switches,
// the counters of the lists (each one opens its tab), and links to MiAulario and to the help. The session
// has a large power button, as in uBlock Origin.
const clockText = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// The state of the session for the menu: a class (on, off, bad, wait), a title and a line below it.
function sessionState(now) {
  const last = S.last || null;
  // Keeping the session is off for now (MAK.KEEP_SESSION): the line says it, not the next ping.
  const keep = MAK.KEEP_SESSION;
  if (S.paused) return { cls: 'off', title: t('status.paused'), line: t(keep ? 'home.pausedHelp' : 'home.pausedOff') };
  if (!last) return { cls: 'wait', title: t('status.noPing'), line: keep ? '' : t('home.keepOff') };
  if (!last.loggedIn) return { cls: 'bad', title: t(last.error ? 'status.networkError' : 'status.notLoggedIn'), line: t(keep ? 'home.loginHelp' : 'home.keepOff') };
  if (!keep) return { cls: 'on', title: t('status.connected'), line: t('home.keepOff') };
  const next = status && status.nextPing ? Math.max(0, Math.round((status.nextPing - now) / 1000)) : null;
  return { cls: 'on', title: t('home.active'), line: next === null ? '' : t('home.nextPing', { t: clockText(next) }) };
}

// Every second: only the texts of the session (the menu is drawn again when the data changes).
function updateHomeSession(now) {
  const box = $('home-session');
  if (!box) return;
  const st = sessionState(now);
  box.querySelector('strong').textContent = st.title;
  box.querySelector('small').textContent = st.line;
}

// The counters of the lists: [{ tab, n, label, sub, hot }]; n is null without data.
function homeCounters(now) {
  const ok = S.meta && S.meta.lastSync && settings().syncEnabled;
  const d = ok ? MAK.dueSummary(MAK.buildDue({ assignments: S.assignments, sites: namedSites(), pages: S.pages, hidden: hiddenSet(), now }).groups, now) : null;
  return [
    { tab: 'due', n: d ? d.todo : null, label: t('home.due'),
      sub: d && d.late ? t('home.late', { n: d.late }) : d && d.week ? t('home.week', { n: d.week }) : '', hot: !!(d && d.late) },
    { tab: 'inbox', n: ok ? inboxModel().counts.total : null, label: t('home.unread') },
    { tab: 'new', n: ok ? MAK.buildNews(withNames(), now).reduce((n, x) => n + x.total, 0) : null, label: t('tab.new') },
    { tab: 'grades', n: ok ? MAK.unseenGrades(S.grades, S.gradesSeenAt, hiddenSet()).length : null, label: t('home.grades') }
  ];
}

// A quick switch: its drawing and its name; the color tells on or off, the tooltip tells it in words.
// on: true or false (a switch), null (the mode, with three values).
function homeSwitch(icon, name, on, title, onClick) {
  const attrs = { type: 'button', title };
  if (on !== null) attrs['aria-pressed'] = String(on);
  return h('button', { class: 'switch', attrs, on: { click: onClick } }, MAK.icon(icon), h('span', { class: 'name', text: name }));
}

function renderHome(el) {
  const now = Date.now();
  // All the data was deleted (the "Danger zone"): the extension does nothing until the user starts it again.
  if (S.paused === 'reset') {
    fill(el, h('div', { class: 'home' }, h('div', { class: 'notice reset' },
      h('strong', { text: t('reset.title') }), h('p', { text: t('reset.text') }),
      h('button', { class: 'btn primary', text: t('reset.start'), attrs: { type: 'button' }, on: { click: () => send({ type: 'resume' }) } }))));
    return;
  }
  const s = settings();
  const st = sessionState(now);
  const said = (name, v) => `${name}: ${t(v ? 'home.on' : 'home.off')}`;
  const set = (patch) => () => send({ type: 'setSettings', patch });
  const session = h('div', { class: 'session', attrs: { id: 'home-session' } }, h('strong', { text: st.title }), h('small', { text: st.line }));
  // Keeping the session off for now (MAK.KEEP_SESSION): the button is grey, does nothing, and its tooltip says why.
  const keep = MAK.KEEP_SESSION;
  const top = h('div', { class: 'home-top' },
    h('button', { class: `power ${st.cls}`, attrs: { type: 'button', 'aria-pressed': keep ? String(!S.paused) : undefined, 'aria-disabled': keep ? undefined : 'true', 'aria-label': t('set.keepAlive'),
      title: t(!keep ? 'home.powerOff' : S.paused ? 'set.resume' : 'set.pause') }, on: keep ? { click: togglePause } : null }, MAK.icon('power')),
    session);
  const switches = h('div', { class: 'switches' },
    homeSwitch('bell', t('home.swGrades'), s.notifyGrades, said(t('home.swGrades'), s.notifyGrades), set({ notifyGrades: !s.notifyGrades })),
    homeSwitch('clock', t('home.swDue'), s.notifyDue, said(t('home.swDue'), s.notifyDue), set({ notifyDue: !s.notifyDue })),
    // The mode: light or dark, the other one of the mode on the screen ("auto" only in the settings).
    homeSwitch('mode', t(`theme.mode.${s.colorMode}`), null, `${t('theme.mode')}: ${t(`theme.mode.${s.colorMode}`)}`, set({ colorMode: darkNow() ? 'light' : 'dark' })),
    homeSwitch('sync', t('home.swSync'), s.syncEnabled, said(t('home.swSync'), s.syncEnabled), set({ syncEnabled: !s.syncEnabled })));
  const counters = h('div', { class: 'counters' }, homeCounters(now).map((c) => h('button', { class: 'counter', attrs: { type: 'button' }, on: { click: () => selectTab(c.tab) } },
    h('span', { class: 'n', text: c.n === null ? '–' : c.n > 99 ? '99+' : String(c.n) }),
    h('span', { class: 'label', text: c.label }),
    c.sub ? h('span', { class: `sub${c.hot ? ' hot' : ''}`, text: c.sub }) : null)));
  const link = (icon, text, url) => h('button', { class: 'tool', attrs: { type: 'button' }, on: { click: () => { ext.tabs.create({ url }); closePopup(); } } }, MAK.icon(icon), h('span', { text }));
  const tools = h('div', { class: 'tools-row' },
    link('school', t('welcome.open'), `${MAK.BASE}/portal`),
    link('history', t('home.history'), ext.runtime.getURL('tools.html?history')),
    link('news', t('help.news'), ext.runtime.getURL('tools.html?news')),
    link('help', t('home.help'), ext.runtime.getURL('tools.html?welcome')),
    link('bug', t('help.bug'), issueUrl('bug')));
  const none = MAK.dataPaused(S.paused) ? null : noDataMessage('what.home');
  fill(el, h('div', { class: 'home' }, top, switches, counters, none, tools));
}

// ---- Shared parts ------------------------------------------------------------

function emptyBox(text) {
  return h('div', { class: 'empty', text });
}

// A message when there is no course data to show, or null.
function noDataMessage(whatKey) {
  const meta = S.meta || {};
  const what = t(whatKey);
  if (!settings().syncEnabled) return emptyBox(t('empty.syncOff', { what }));
  if (!meta.lastSync) {
    if (MAK.dataPaused(S.paused)) return emptyBox(t('empty.paused'));
    if (meta.loggedIn === false) return emptyBox(t('empty.login', { what }));
    return emptyBox(t('empty.noData'));
  }
  return null;
}

function siteSelect(siteIds, value, onChange) {
  return h(
    'select',
    { attrs: { 'aria-label': t('site.label') }, on: { change: (e) => onChange(e.target.value) } },
    h('option', { attrs: { value: '' }, text: t('site.all') }),
    siteIds.map((id) => h('option', { attrs: { value: id, selected: id === value }, text: siteTitle(id) }))
  );
}

// ---- Due ---------------------------------------------------------------------

function openIcs() {
  ext.tabs.create({ url: ext.runtime.getURL('tools.html?ics=1') });
}

const DATE_CHANGE_DAYS = 7; // the mark "Date changed" stays for 7 days

// The correction of a returned delivery: the comment of the teacher and the files.
function feedbackDetails(f) {
  if (!f.comment && !f.files.length) return null;
  return h('details', { class: 'feedback' },
    h('summary', { text: t('due.feedback') }),
    f.comment ? h('p', { class: 'small fb-comment', text: f.comment }) : null,
    f.files.length ? h('ul', { class: 'small' }, f.files.map((x) => h('li', null, MAK.link(x.url, x.name)))) : null);
}

function deliveryRow(x, now) {
  const cls = ['item', `s-${x.state}`];
  if (x.urgency) cls.push(`u-${x.urgency}`);
  let side;
  if (x.feedback) side = h('span', { class: 'tag ok', text: x.feedback.grade ? t('due.tagGraded', { grade: x.feedback.grade }) : t('due.tagReturned') });
  else if (x.state === 'submitted') side = h('span', { class: 'tag ok', text: t('due.tagSubmitted') });
  else if (x.state === 'closed') side = h('span', { class: 'tag', text: t('due.tagClosed') });
  else if (x.offline) side = h('span', { class: 'tag', text: t('due.tagOffline') });
  else side = h('span', { class: 'countdown', data: { due: x.due || '' }, text: MAK.countdownText(x.due, now) });
  return h(
    'div',
    { class: cls.join(' ') },
    h(
      'div',
      { class: 'body' },
      h('a', { class: 'title', href: x.url, text: x.title }),
      h(
        'div',
        { class: 'meta' },
        `${x.siteTitle} · ${x.due ? MAK.formatDate(x.due) : t('due.noDate')}`,
        x.dueChange && now - x.dueChange.at < DATE_CHANGE_DAYS * MAK.DAY ? [' ', h('span', { class: 'tag info', text: t('due.tagMoved'), title: t('due.movedFrom', { date: MAK.formatDate(x.dueChange.from) }) })] : null
      ),
      x.feedback ? feedbackDetails(x.feedback) : null
    ),
    h('div', { class: 'side' }, side)
  );
}

// ---- Week view (above the deliveries) -----------------------------------------
// ui.dueWeek: the index of the selected week, or null for all.

const loadClass = (n) => (n >= 5 ? 'high' : n >= 3 ? 'mid' : n >= 1 ? 'low' : 'none');

function weekLabel(w, i) {
  if (i === 0) return t('weeks.this');
  if (i === 1) return t('weeks.next');
  return MAK.formatDay(w.start);
}

function weekStrip(weeks) {
  const max = Math.max(1, ...weeks.map((w) => w.total));
  return h(
    'div',
    { class: 'weeks', attrs: { role: 'group', 'aria-label': t('weeks.label') } },
    weeks.map((w, i) => {
      const bar = h('span', { class: 'bar' });
      bar.style.height = `${w.total ? Math.max(12, Math.round((w.total / max) * 100)) : 6}%`;
      return h(
        'button',
        {
          class: `week load-${loadClass(w.total)}${ui.dueWeek === i ? ' on' : ''}`,
          attrs: { type: 'button', 'aria-pressed': String(ui.dueWeek === i), title: `${t('weeks.of', { date: MAK.formatDay(w.start) })}: ${t('weeks.tip', { d: w.deliveries.length, e: w.events.length })}` },
          on: { click: () => { ui.dueWeek = ui.dueWeek === i ? null : i; renderCurrent(); } }
        },
        h('span', { class: 'n', text: String(w.total) }),
        h('span', { class: 'track' }, bar),
        h('span', { class: 'label', text: weekLabel(w, i) })
      );
    })
  );
}

function eventRow(e) {
  const url = MAK.toolUrl(S.pages, e.siteId, 'sakai.schedule');
  return h(
    'div',
    { class: 'event-row' },
    h('span', { class: 'when', text: MAK.formatDate(e.start) }),
    h('div', { class: 'body' }, url ? MAK.link(url, e.title) : h('span', { text: e.title }), h('div', { class: 'meta', text: e.siteTitle }))
  );
}

function weekDetail(w, i) {
  return [
    h(
      'div',
      { class: 'week-head' },
      h('strong', { text: `${weekLabel(w, i)} · ${t('weeks.of', { date: MAK.formatDay(w.start) })}` }),
      h('button', { class: 'link-btn', text: t('weeks.clear'), on: { click: () => { ui.dueWeek = null; renderCurrent(); } } })
    ),
    w.events.length ? [h('h2', { class: 'group', text: `${t('weeks.events')} (${w.events.length})` }), w.events.map(eventRow)] : null,
    w.total ? null : emptyBox(t('weeks.nothing'))
  ];
}

function renderDue(el) {
  const now = Date.now();
  const none = noDataMessage('what.deliveries');
  if (none) return fill(el, none);
  const model = MAK.buildDue({ assignments: S.assignments, sites: namedSites(), pages: S.pages, hidden: hiddenSet(), now });
  const g = model.groups;
  const all = [...g.late, ...g.pending, ...g.action, ...g.submitted, ...g.closed];
  if (!all.length && !(S.events || []).some((e) => !MAK.isOfficeHours(e))) return fill(el, emptyBox(t('due.none')));
  const siteIds = [...new Set(all.map((x) => x.siteId))];
  if (ui.dueSite && !siteIds.includes(ui.dueSite)) ui.dueSite = '';
  const bySite = (list) => list.filter((x) => !ui.dueSite || x.siteId === ui.dueSite);
  const weeks = MAK.buildWeeks({ deliveries: bySite([...g.late, ...g.pending, ...g.action]), events: bySite(S.events || []), sites: namedSites(), hidden: hiddenSet(), now });
  const week = ui.dueWeek === null ? null : weeks[ui.dueWeek];
  const keep = (list) => bySite(list).filter((x) => !week || (x.due >= week.start && x.due < week.end));
  const group = (title, list) => (list.length ? [h('h2', { class: 'group', text: `${title} (${list.length})` }), list.map((x) => deliveryRow(x, now))] : null);
  const folded = (title, list) => (list.length ? h('details', null, h('summary', { text: `${title} (${list.length})` }), list.map((x) => deliveryRow(x, now))) : null);
  const open = [...keep(g.late), ...keep(g.pending), ...keep(g.action)];
  fill(
    el,
    h('div', { class: 'toolbar' }, siteSelect(siteIds, ui.dueSite, (v) => { ui.dueSite = v; renderCurrent(); }), h('button', { class: 'link-btn', text: t('ics.button'), on: { click: openIcs } })),
    weekStrip(weeks),
    week ? weekDetail(week, ui.dueWeek) : null,
    open.length || week ? null : emptyBox(t('due.nothing')),
    group(t('due.late'), keep(g.late)),
    group(t('due.todo'), keep(g.pending)),
    group(t('due.returned'), keep(g.action)),
    folded(t('due.submitted'), keep(g.submitted)),
    folded(t('due.closed'), keep(g.closed).slice(0, 30))
  );
}

// ---- Inbox -------------------------------------------------------------------

function inboxModel() {
  return MAK.buildInbox({
    announcements: S.announcements,
    notifications: S.notifications,
    readAnn: S.readAnn,
    synoptic: S.synoptic,
    forums: S.forums,
    sites: namedSites(),
    pages: S.pages,
    hidden: hiddenSet()
  });
}

// An announcement opens and closes with the animation of MAK.fold (its text below its title).
function toggleAnnouncement(x) {
  const body = () => document.querySelector(`[data-ann="${CSS.escape(String(x.id))}"]`);
  if (ui.openAnn.has(x.id)) {
    ui.openAnn.delete(x.id);
    return body() ? MAK.fold(body(), false, renderInboxList) : renderInboxList();
  }
  ui.openAnn.add(x.id);
  if (x.unread) send({ type: 'markAnnRead', ids: [x.id] });
  renderInboxList();
  const opened = body();
  if (opened) {
    opened.hidden = true;
    MAK.fold(opened, true);
  }
}

function inboxRow(x) {
  if (x.type === 'announcement') {
    const open = ui.openAnn.has(x.id);
    return h(
      'div',
      { class: `item ${x.unread ? 'unread' : 'read'}` },
      h(
        'div',
        { class: 'body' },
        h(
          'button',
          { class: 'title-btn', attrs: { 'aria-expanded': String(open) }, on: { click: () => toggleAnnouncement(x) } },
          x.unread ? h('span', { class: 'unread-dot', title: t('inbox.unread'), attrs: { 'aria-label': t('inbox.unread') } }) : null,
          x.title
        ),
        h('div', { class: 'meta', text: [x.siteTitle, MAK.formatDate(x.date), x.author].filter(Boolean).join(' · ') }),
        open
          ? h(
              'div',
              { data: { ann: String(x.id) } },
              x.text ? h('p', { class: 'ann-text', text: x.text }) : null,
              x.attachments.length
                ? h('div', { class: 'links' }, h('span', { class: 'meta', text: t('inbox.attachments') }), x.attachments.map((f) => MAK.link(f.url, f.name)))
                : null,
              h('div', { class: 'links' }, MAK.link(x.url, t('inbox.open')))
            )
          : null
      )
    );
  }
  const title = x.type === 'messages' ? t('inbox.messages', { n: x.count }) : x.title || t('inbox.forumSite', { n: x.count });
  const meta = x.type === 'forum' && x.title ? [x.forum, x.siteTitle].filter(Boolean).join(' · ') : x.siteTitle;
  return h(
    'div',
    { class: 'item unread' },
    h('div', { class: 'body' }, h('a', { class: 'title', href: x.url, text: title }), h('div', { class: 'meta', text: meta })),
    x.type === 'forum' && x.title ? h('div', { class: 'side' }, h('span', { class: 'tag info', text: t('inbox.unreadTag', { n: x.count }) })) : null
  );
}

// Draw only the list, so that the search field keeps the focus.
function renderInboxList() {
  const list = $('inbox-list');
  if (!list) return;
  const model = inboxModel();
  const items = MAK.filterInbox(model.items, ui.inbox);
  fill(list, items.length ? items.slice(0, 200).map(inboxRow) : h('div', { class: 'empty', text: t(model.items.length ? 'inbox.noResults' : 'inbox.empty') }));
  updateTabCounts();
}

function renderInbox(el) {
  const none = noDataMessage('what.inbox');
  if (none) return fill(el, none);
  const model = inboxModel();
  const c = model.counts;
  const siteIds = [...new Set(model.items.map((x) => x.siteId))];
  if (ui.inbox.siteId && !siteIds.includes(ui.inbox.siteId)) ui.inbox.siteId = '';
  const chip = (type, key, n) =>
    h(
      'button',
      { attrs: { type: 'button', 'aria-pressed': String(ui.inbox.type === type) }, on: { click: () => { ui.inbox.type = type; renderCurrent(); } } },
      t(key),
      n ? h('span', { class: 'n', text: String(n) }) : null
    );
  fill(
    el,
    h(
      'div',
      { class: 'toolbar chips' },
      chip('', 'inbox.type.all', c.total),
      chip('announcement', 'inbox.type.announcement', c.announcements),
      chip('messages', 'inbox.type.messages', c.messages),
      chip('forum', 'inbox.type.forum', c.forums)
    ),
    h(
      'div',
      { class: 'toolbar' },
      h('input', {
        attrs: { type: 'search', placeholder: t('inbox.search'), 'aria-label': t('inbox.search'), value: ui.inbox.query },
        on: { input: (e) => { ui.inbox.query = e.target.value; renderInboxList(); } }
      }),
      siteSelect(siteIds, ui.inbox.siteId, (v) => { ui.inbox.siteId = v; renderInboxList(); })
    ),
    h(
      'div',
      { class: 'toolbar' },
      h('label', { class: 'check' }, h('input', { attrs: { type: 'checkbox', checked: ui.inbox.unreadOnly }, on: { change: (e) => { ui.inbox.unreadOnly = e.target.checked; renderInboxList(); } } }), t('inbox.unreadOnly')),
      c.announcements ? h('button', { class: 'link-btn', text: t('inbox.markAllRead'), on: { click: () => send({ type: 'markAllAnnRead', siteId: ui.inbox.siteId }) } }) : null
    ),
    h('div', { attrs: { id: 'inbox-list' } })
  );
  renderInboxList();
}

// ---- New since the last visit ------------------------------------------------

// The files of all sites update every 4 hours. On this tab, update them if they are older than 1 hour.
function openNew() {
  const meta = S.meta || {};
  if (settings().syncEnabled && meta.lastSync && Date.now() - (meta.lastFullSync || 0) > MAK.HOUR) {
    syncing = true;
    renderHeader();
    send({ type: 'syncNow', full: true }).then(() => { syncing = false; renderHeader(); });
  }
}

function newsGroup(titleKey, items, render) {
  return items.length ? [h('h2', { class: 'group', text: t(titleKey) }), h('ul', null, items.map(render))] : null;
}

function newsCard(x) {
  return h(
    'div',
    { class: 'card' },
    h(
      'div',
      { class: 'head' },
      siteNameEditor(x.siteId, true),
      h('span', { class: 'meta', text: x.visited ? t('news.since', { date: MAK.formatDate(x.since) }) : t('news.neverVisited') })
    ),
    h(
      'details',
      null,
      h('summary', { text: MAK.newsSummary(x) }),
      newsGroup('news.groupFiles', x.files, (f) => h('li', null, MAK.link(f.url, f.title), ' ', h('span', { class: `tag ${f.label === 'new' ? 'new' : 'info'}`, text: t(f.label === 'new' ? 'news.tagNew' : 'news.tagUpdated') }))),
      newsGroup('news.groupAnnouncements', x.announcements, (a) => h('li', null, MAK.link(a.url, a.title), ' ', h('span', { class: 'meta', text: MAK.formatDate(a.time) }))),
      newsGroup('news.groupDeliveries', x.deliveries, (d) => h('li', null, MAK.link(d.url, d.title), d.due ? [' ', h('span', { class: 'meta', text: t('news.due', { date: MAK.formatDate(d.due) }) })] : null)),
      newsGroup('news.groupDates', x.dateChanges || [], (d) => h('li', null, MAK.link(d.url, d.title), ' ', h('span', { class: 'meta', text: MAK.dateMove(d.from, d.to) }))),
      newsGroup('news.groupFeedback', x.feedback || [], (d) => h('li', null, MAK.link(d.url, d.title))),
      newsGroup('news.groupForums', x.forums, (f) => h('li', null, MAK.link(f.url, f.title), ' ', h('span', { class: 'meta', text: t('news.forumDelta', { n: f.delta }) })))
    ),
    h('div', { class: 'row' }, h('button', { class: 'link-btn', text: t('news.markSeen'), on: { click: () => send({ type: 'markSiteSeen', siteId: x.siteId }) } }))
  );
}

function renderNew(el) {
  const none = noDataMessage('what.news');
  if (none) return fill(el, none);
  const list = MAK.buildNews(withNames(), Date.now());
  if (!list.length) return fill(el, emptyBox(t('news.empty')));
  fill(
    el,
    h('div', { class: 'toolbar' }, h('button', { class: 'link-btn', text: t('news.markAllSeen'), on: { click: () => send({ type: 'markSiteSeen' }) } })),
    list.map(newsCard)
  );
}

// ---- Grades ------------------------------------------------------------------

// Keep the "seen" time of the moment when the tab opened, so that the marks stay visible.
function openGrades() {
  ui.gradesSeenAt = S.gradesSeenAt || 0;
  send({ type: 'markGradesSeen' });
}

function gradeRow(g) {
  const isNew = g.gradedAt && g.gradedAt > ui.gradesSeenAt;
  return h(
    'div',
    { class: 'grade-row' },
    h('a', { class: 'name', href: g.url || MAK.siteUrl(g.siteId), text: g.name }),
    isNew ? h('span', { class: 'tag ok', text: t('grades.new') }) : null,
    h('span', { class: `score${g.graded ? '' : ' none'}`, text: g.graded ? g.score : t('grades.notGraded') })
  );
}

function gradesCard(siteId, list) {
  const open = ui.calc && ui.calc.siteId === siteId;
  return h(
    'div',
    { class: 'card', data: { site: siteId } },
    h(
      'div',
      { class: 'head' },
      siteNameEditor(siteId, true),
      gradebookPlacement(siteId) ? h('button', { class: 'link-btn', attrs: { 'aria-expanded': String(!!open) }, text: t(open ? 'calc.close' : 'calc.open'), on: { click: () => toggleCalc(siteId) } }) : null
    ),
    list.map(gradeRow),
    open ? calcPanel(siteId) : null
  );
}

// ---- Grade calculator ----------------------------------------------------------
// ui.calc = { siteId, status: 'loading' | 'error' | 'ready', book, guideBook, useGuide, values, simOpen }.
// guideBook: the same grades with the weights of the course guide (lib/guide.js). Nothing is stored.

const GRADEBOOK_TOOL = 'sakai.gradebookng';
const num = (n) => n.toLocaleString(MAK.locale(), { maximumFractionDigits: 2 });
const targetOf = (siteId) => (typeof settings().targets[siteId] === 'number' ? settings().targets[siteId] : MAK.DEFAULT_TARGET);

function gradebookPlacement(siteId) {
  const tool = S.pages && S.pages[siteId] && S.pages[siteId].tools[GRADEBOOK_TOOL];
  return tool ? tool.placement : null;
}

async function toggleCalc(siteId) {
  if (ui.calc && ui.calc.siteId === siteId) {
    ui.calc = null;
    return renderCurrent();
  }
  const calc = (ui.calc = { siteId, status: 'loading', book: null, guideBook: null, useGuide: false, values: {}, simOpen: false });
  renderCurrent();
  try {
    const [html, guide] = await Promise.all([courseApi.gradebook(gradebookPlacement(siteId)), siteGuide(siteId).catch(() => null)]);
    const data = MAK.extractGradebookRows(new DOMParser().parseFromString(html, 'text/html'));
    if (!data.found) throw new Error('no gradebook');
    calc.book = MAK.buildGradebook(data);
    calc.guideBook = guide ? MAK.guideBook(guide, calc.book) : null;
    // The weights of the guide by default if the gradebook has no weights of its own.
    calc.useGuide = !!calc.guideBook && !calc.book.weighted;
    calc.status = 'ready';
  } catch {
    calc.status = 'error';
  }
  if (ui.calc === calc) renderCurrent();
}

// The course guide of a site: the stored one, or read it again (the page of MiAulario and the
// public page of the UPNA). The background script stores it.
const siteGuide = (siteId) => MAK.pageGuide(siteId, S, send);

// How the grades of MiAulario go to the activities of the guide, with the minimum grades.
function guideMap(book) {
  return h(
    'details',
    { class: 'calc-guide' },
    h('summary', { text: t('calc.guideMap') }),
    Math.round(book.total) !== 100 ? h('div', { class: 'meta', text: t('calc.guideTotal', { total: num(book.total) }) }) : null,
    h('ul', null, book.categories.map((c) => {
      const graded = c.items.filter((i) => i.score !== null && !i.placeholder);
      const own = graded.length ? (graded.reduce((n, i) => n + i.score, 0) / graded.reduce((n, i) => n + i.max, 0)) * 10 : null;
      const min = MAK.guideMinimum(c.minimum);
      const below = min !== null && own !== null && own < min - 1e-9;
      return h('li', null,
        h('strong', { text: `${c.name} · ${num(c.weight)} %` }),
        h('div', { class: 'meta', text: c.matched ? c.items.map((i) => i.name).join(', ') : t('calc.noMatch') }),
        below ? h('div', { class: 'calc-min', text: t('calc.belowMin', { grade: num(own), min: num(min) }) }) : null);
    }))
  );
}

function setTarget(siteId, text) {
  const v = MAK.parseNumber(text);
  const value = v === null ? null : Math.min(10, Math.max(0, v));
  send({ type: 'setSettings', patch: { targets: { [siteId]: value === MAK.DEFAULT_TARGET ? null : value } } }).then(() => {
    if (!userIsInPanel()) renderCurrent();
  });
}

function calcResult(book, values, target) {
  const simulated = Object.values(values).some((v) => MAK.parseNumber(v) !== null);
  const model = MAK.gradeModel(MAK.applyWhatIf(book, values));
  const need = MAK.neededAverage(model, target);
  const text = {
    needed: () => t('calc.needed', { value: num(need.value), left: num(model.b * 100), target: num(target) }),
    reached: () => t('calc.reached', { target: num(target) }),
    impossible: () => t('calc.impossible', { target: num(target), max: num(need.max) }),
    nothingLeft: () => t('calc.nothingLeft', { final: num(need.min) })
  }[need.state]();
  return [
    h('div', { class: 'calc-now' }, h('span', { text: t(simulated ? 'calc.simulated' : 'calc.current') }), h('strong', { text: model.current === null ? '–' : num(model.current * 10) })),
    h('div', { class: `calc-need ${need.state}`, text }),
    need.state === 'nothingLeft' ? null : h('div', { class: 'meta', text: t('calc.range', { min: num(need.min), max: num(need.max) }) })
  ];
}

function simulator(book, values, update) {
  const open = book.categories.filter((c) => c.items.some((i) => i.score === null));
  if (!open.length) return null;
  const clear = () => {
    for (const k of Object.keys(values)) delete values[k];
    renderCurrent();
  };
  return h(
    'details',
    { class: 'calc-sim', attrs: { open: ui.calc.simOpen }, on: { toggle: (e) => { ui.calc.simOpen = e.target.open; } } },
    h('summary', { text: t('calc.simulator') }),
    h('div', { class: 'meta', text: t('calc.simHelp') }),
    open.map((c) => [
      c.name ? h('div', { class: 'calc-cat', text: c.weight > 0 ? `${c.name} · ${num(c.weight)} %` : c.name }) : null,
      c.items
        .filter((i) => i.score === null)
        .map((i) =>
          h(
            'label',
            { class: 'calc-item' },
            h('span', { class: 'name', text: i.name }),
            h('input', { attrs: { type: 'text', inputmode: 'decimal', value: values[i.key] || '', placeholder: '–', 'aria-label': i.name }, on: { input: (e) => { values[i.key] = e.target.value; update(); } } }),
            h('span', { class: 'meta', text: `/ ${num(i.max)}` })
          )
        )
    ]),
    Object.keys(values).length ? h('button', { class: 'link-btn', text: t('calc.clear'), on: { click: clear } }) : null
  );
}

function unusedList(book) {
  if (!book.unused.length) return null;
  return h(
    'details',
    { class: 'calc-unused' },
    h('summary', { text: t('calc.unused', { n: book.unused.length }) }),
    h('ul', null, book.unused.map((i) => h('li', null, `${i.name} `, h('span', { class: 'meta', text: t(`calc.reason.${i.reason}`) }))))
  );
}

function calcPanel(siteId) {
  const c = ui.calc;
  if (c.status === 'loading') return h('div', { class: 'calc meta', text: t('calc.loading') });
  if (c.status === 'error') return h('div', { class: 'calc' }, h('div', { class: 'notice', text: t('calc.error') }));
  const book = c.useGuide && c.guideBook ? c.guideBook : c.book;
  const official = /\d/.test(book.courseGradeText) ? h('div', { class: 'meta', text: t('calc.official', { grade: book.courseGradeText }) }) : null;
  // The weights: of the course guide, or of the gradebook of MiAulario.
  const source = c.guideBook
    ? h('div', { class: 'calc-row chips' },
      h('span', { class: 'meta', text: t('calc.source') }),
      h('button', { attrs: { type: 'button', 'aria-pressed': String(!!c.useGuide) }, text: t('calc.fromGuide'), on: { click: () => { c.useGuide = true; renderCurrent(); } } }),
      h('button', { attrs: { type: 'button', 'aria-pressed': String(!c.useGuide) }, text: t('calc.fromBook'), on: { click: () => { c.useGuide = false; renderCurrent(); } } }))
    : null;
  if (!book.categories.length) return h('div', { class: 'calc' }, source, h('div', { class: 'meta', text: t('calc.noItems') }), official, unusedList(book));
  const target = targetOf(siteId);
  const result = h('div', { class: 'calc-result' });
  const update = () => fill(result, calcResult(book, c.values, target));
  update();
  return h(
    'div',
    { class: 'calc' },
    source,
    !book.fromGuide && MAK.gradebookMismatch(book, MAK.gradeModel(book)) ? h('div', { class: 'notice', text: t('calc.mismatch') }) : null,
    h(
      'label',
      { class: 'calc-row' },
      h('span', { text: t('calc.target') }),
      h('input', { attrs: { type: 'text', inputmode: 'decimal', value: num(target) }, on: { change: (e) => setTarget(siteId, e.target.value) } }),
      h('span', { class: 'meta', text: t('calc.of10') }),
      h('span', { class: 'meta mode', text: t(book.fromGuide ? 'calc.byGuide' : book.weighted ? 'calc.weighted' : 'calc.points') })
    ),
    result,
    book.fromGuide ? guideMap(book) : null,
    official,
    simulator(book, c.values, update),
    unusedList(book),
    h('div', { class: 'meta', text: t('calc.estimate') })
  );
}

function renderGrades(el) {
  const none = noDataMessage('what.grades');
  if (none) return fill(el, none);
  const hidden = hiddenSet();
  const bySite = new Map();
  for (const g of S.grades || []) {
    if (hidden.has(g.siteId)) continue;
    if (!bySite.has(g.siteId)) bySite.set(g.siteId, []);
    bySite.get(g.siteId).push(g);
  }
  if (!bySite.size) return fill(el, emptyBox(t('grades.none')));
  const order = (S.sites || []).map((s) => s.id).filter((id) => bySite.has(id));
  for (const id of bySite.keys()) if (!order.includes(id)) order.push(id);
  fill(el, order.map((id) => gradesCard(id, bySite.get(id))));
}

// ---- Sites -------------------------------------------------------------------

function siteActions(site) {
  const tools = S.pages && S.pages[site.id] && S.pages[site.id].tools;
  if (!tools || !tools['sakai.resources']) return [];
  return h('button', {
    class: 'link-btn',
    text: t('zip.button'),
    on: { click: () => send({ type: 'openZip', siteId: site.id }) }
  });
}

// ---- Site names ----------------------------------------------------------------
// ui.editSite: the site whose name the user edits now. An empty name, or the automatic name,
// removes the name from the user.

function autoName(siteId) {
  const site = siteOf(siteId);
  if (!site) return siteId;
  return MAK.siteName({ id: siteId, title: site.fullTitle }, Object.assign({}, settings(), { nicknames: {} }));
}

function saveName(siteId, value) {
  ui.editSite = null;
  send({ type: 'renameSite', siteId, name: value }).then(() => renderCurrent());
}

// The name of a site (a link or text) with a pencil. While the user edits it: a text field.
function siteNameEditor(siteId, asLink) {
  if (ui.editSite === siteId) {
    let done = false;
    const input = h('input', {
      class: 'name-input',
      attrs: { type: 'text', maxlength: 40, value: siteTitle(siteId), placeholder: autoName(siteId), 'aria-label': t('names.editSite', { site: siteTitle(siteId) }) },
      on: {
        keydown: (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            done = true;
            saveName(siteId, input.value);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            done = true;
            ui.editSite = null;
            renderCurrent();
          }
        },
        blur: () => {
          if (!done) saveName(siteId, input.value);
          done = true;
        }
      }
    });
    setTimeout(() => { input.focus(); input.select(); }, 0);
    return input;
  }
  const name = siteTitle(siteId);
  return h(
    'span',
    { class: 'site-name' },
    asLink ? h('a', { href: MAK.siteUrl(siteId), text: name }) : h('span', { text: name }),
    h('button', { class: 'pencil', text: '✎', attrs: { type: 'button', title: t('names.edit'), 'aria-label': t('names.editSite', { site: name }) }, on: { click: () => { ui.editSite = siteId; renderCurrent(); } } })
  );
}

function renderSites(el) {
  const sites = namedSites();
  if (!Array.isArray(sites) || !sites.length) return fill(el, noDataMessage('what.sites') || emptyBox(t('empty.noData')));
  const s = settings();
  const hidden = new Set(s.hiddenSites);
  const setHidden = (id, on) => {
    const next = new Set(hidden);
    if (on) next.add(id);
    else next.delete(id);
    send({ type: 'setSettings', patch: { hiddenSites: [...next] } });
  };
  const radio = (value, label) =>
    h('label', { class: 'radio' }, h('input', { attrs: { type: 'radio', name: 'hiddenMode', value, checked: s.hiddenMode === value }, on: { change: () => send({ type: 'setSettings', patch: { hiddenMode: value } }) } }), h('span', { text: t(label) }));
  const typeKey = (type) => `sites.type.${type}`;
  fill(
    el,
    h('div', { class: 'section' }, h('h2', { text: t('sites.mode') }), radio('sidebar', 'sites.modeSidebar'), radio('everywhere', 'sites.modeEverywhere'), h('p', { class: 'small meta', text: `${t('sites.help')} ${t('sites.native')}` })),
    h(
      'div',
      { class: 'section' },
      h('h2', { text: t('sites.list') }),
      sites.map((site) =>
        h(
          'div',
          { class: `site-row${hidden.has(site.id) ? ' hidden-site' : ''}` },
          h(
            'div',
            { class: 'name' },
            h('div', null, siteNameEditor(site.id, false)),
            h('div', { class: 'meta', text: [site.fullTitle !== site.title ? site.fullTitle : null, MAK.STRINGS.es[typeKey(site.type)] ? t(typeKey(site.type)) : site.type].filter(Boolean).join(' · ') }),
            settings().nicknames[site.id] ? h('button', { class: 'link-btn', text: t('names.auto'), attrs: { title: t('names.autoHelp') }, on: { click: () => send({ type: 'renameSite', siteId: site.id, name: '' }) } }) : null
          ),
          siteActions(site),
          h('label', null, h('input', { attrs: { type: 'checkbox', checked: hidden.has(site.id) }, on: { change: (e) => setHidden(site.id, e.target.checked) } }), t('sites.hide'))
        )
      )
    )
  );
}

// ---- Settings ----------------------------------------------------------------

// How to receive the messages to me in a different email: a forward filter in the UPNA email.
// Download links without a login (Send). In the same click: save the setting, then ask for the
// host permission (Firefox can close the popup while it asks, and the setting is saved before).
const LINK_DOWNLOADS = [1, 2, 3, 5, 10, 20];
const LINK_SECONDS = [300, 3600, 86400, 259200];
let linkConfig = null; // the limits of the server (GET /config): { server, downloads, seconds }
function linksSection() {
  const l = settings().links;
  const saveLinks = (patch) => send({ type: 'setSettings', patch: { links: patch } });
  const missing = h('p', { class: 'small meta', hidden: true });
  const grant = h('button', { class: 'btn', text: t('link.grant'), attrs: { type: 'button' }, hidden: true });
  // Each request in its own click: Firefox does not accept the data consent with other permissions.
  const askFor = (next) => Promise.resolve(ext.permissions.request({ origins: MAK.linkOrigins(next) })).catch(() => false);
  const askData = () => Promise.resolve(ext.permissions.request(MAK.LINK_DATA)).catch(() => false);
  let lack = null; // 'origins' or 'data': what the button "Give permission" asks for
  function change(patch) {
    const next = Object.assign({}, l, patch);
    saveLinks(patch);
    if (!next.enabled) return;
    askFor(next).then((ok) => {
      if (!ok && patch.enabled) saveLinks({ enabled: false });
      checkLinkPermission(next);
    });
  }
  async function checkLinkPermission(cur) {
    const origins = MAK.linkOrigins(cur);
    const p = cur.enabled ? await MAK.linkPermissions(ext.permissions, cur) : { origins: true, data: true };
    const ok = p.origins && p.data;
    lack = !p.origins ? 'origins' : !p.data ? 'data' : null;
    missing.hidden = grant.hidden = ok;
    missing.textContent = lack === 'data' ? t('link.noData') : t('link.noPermission', { hosts: origins.map((o) => new URL(o.replace('/*', '/')).host).join(', ') });
    if (ok && cur.enabled && (!linkConfig || linkConfig.server !== cur.server)) {
      const c = await MAK.sendConfig(cur.server, (u, i) => fetch(u, i));
      if (c && settings().links.server === cur.server) {
        linkConfig = { server: cur.server, downloads: c.downloads, seconds: c.seconds };
        fillLimits();
      }
    }
  }
  grant.addEventListener('click', () => (lack === 'data' ? askData() : askFor(l)).then(() => checkLinkPermission(l)));

  const select = (label, options, value, onChange) =>
    h('label', { class: 'field-row' }, h('span', { class: 'small', text: label }),
      h('select', { attrs: { disabled: !l.enabled }, on: { change: (e) => onChange(e.target.value) } },
        options.map(([v, text]) => h('option', { attrs: { value: String(v), selected: String(v) === String(value) }, text }))));
  const modes = select(t('link.mode'), [['password', t('link.modePassword')], ['key', t('link.modeKey')], ['long', t('link.modeLong')]], l.mode, (v) => change({ mode: v }));
  const downloads = select(t('link.downloads'), [], l.downloads, (v) => change({ downloads: Number(v) }));
  const expires = select(t('link.expires'), [], l.seconds, (v) => change({ seconds: Number(v) }));
  function fillLimits() {
    const c = linkConfig && linkConfig.server === l.server ? linkConfig : { downloads: LINK_DOWNLOADS, seconds: LINK_SECONDS };
    const list = (values, cur) => [...new Set(values.concat(cur))].sort((a, b) => a - b);
    fill(downloads.querySelector('select'), list(c.downloads, l.downloads).map((n) => h('option', { attrs: { value: String(n), selected: n === l.downloads }, text: String(n) })));
    fill(expires.querySelector('select'), list(c.seconds, l.seconds).map((n) => h('option', { attrs: { value: String(n), selected: n === l.seconds }, text: MAK.durationText(n) })));
  }
  fillLimits();

  // The server: one of the known servers (the manifest has a host permission for each of them).
  const server = select(t('link.server'), MAK.SEND_SERVERS.map((u) => [u, new URL(u).host]), l.server, (v) => change({ server: v }));

  checkLinkPermission(l);
  return h(
    'div',
    { class: 'section', attrs: { id: 'links' } },
    h('h2', { text: t('link.section') }),
    h('p', { class: 'small', text: t('link.sectionHelp') }),
    checkbox(t('link.enable'), t('link.enableHelp'), l.enabled, (v) => change({ enabled: v })),
    h('div', { class: 'indent' }, modes, h('p', { class: 'small meta', text: t(`link.modeHelp.${l.mode}`) }), downloads, expires, server, missing, h('div', { class: 'row' }, grant)),
    h('details', null, h('summary', { text: t('privacy.title') }), h('p', { class: 'small', text: t('link.privacy') }))
  );
}

// The template of the message to a teacher (the button ✉ of the sites in MiAulario, lib/teachers.js).
// It is saved while the user writes. The default text of the language is saved as an empty body,
// so that it follows a change of the language.
function teacherSection() {
  const s = settings();
  const def = MAK.defaultTeacherTemplate();
  const subject = h('input', { attrs: { type: 'text', maxlength: '200', value: s.teacherSubject, placeholder: t('teach.subjectExample', { course: MAK.templateField('course') }) } });
  const body = h('textarea', { attrs: { rows: '7', maxlength: '3000', spellcheck: 'true' } });
  body.value = s.teacherBody || def;
  const status = h('p', { class: 'small meta', attrs: { role: 'status' } });
  let timer = null;
  let last = body; // the field that gets a field name on a click
  const save = () => {
    clearTimeout(timer);
    timer = null;
    const text = body.value.replace(/\r\n?/g, '\n');
    send({ type: 'setSettings', patch: { teacherSubject: subject.value, teacherBody: text.trim() === def.trim() ? '' : text } }).then(() => { status.textContent = t('teach.saved'); });
  };
  const saveLater = () => {
    status.textContent = '';
    clearTimeout(timer);
    timer = setTimeout(save, 500);
  };
  for (const f of [subject, body]) {
    f.addEventListener('input', saveLater);
    f.addEventListener('focus', () => { last = f; });
    f.addEventListener('blur', () => { if (timer) save(); });
  }
  const insert = (text) => {
    const at = last.selectionStart ?? last.value.length;
    last.setRangeText(text, at, last.selectionEnd ?? at, 'end');
    last.focus();
    saveLater();
  };
  // mousedown: the field keeps the focus and the cursor.
  const fields = MAK.TEMPLATE_FIELDS.map((k) => h('button', {
    attrs: { type: 'button', title: t(`teach.field.${k}`) },
    text: MAK.templateField(k),
    on: { mousedown: (e) => e.preventDefault(), click: () => insert(MAK.templateField(k)) }
  }));
  const reset = h('button', { class: 'btn', text: t('teach.reset'), attrs: { type: 'button' }, on: { click: () => { subject.value = ''; body.value = def; save(); } } });
  return h(
    'div',
    { class: 'section template', attrs: { id: 'teacher-template' } },
    h('h2', { text: t('teach.section') }),
    h('p', { class: 'small', text: t('teach.sectionHelp') }),
    h('label', null, h('span', { class: 'small', text: t('teach.subject') }), subject),
    h('label', null, h('span', { class: 'small', text: t('teach.body') }), body),
    h('div', { class: 'chips' }, fields),
    h('p', { class: 'small meta', text: t('teach.fieldsHelp') }),
    h('div', { class: 'row' }, reset),
    status
  );
}

// The times of the reminders before a delivery: 1 to 3, 24 hours and 1 hour by default.
function dueOffsetsField(s) {
  const list = s.dueOffsets.slice();
  const save = (next) => send({ type: 'setSettings', patch: { dueOffsets: next } });
  const rows = list.map((m, i) => h('label', { class: 'field-row' },
    h('span', { class: 'small', text: t('set.dueOffset', { n: i + 1 }) }),
    h('span', { class: 'due-offset' },
      h('select', { attrs: { disabled: !s.notifyDue }, on: { change: (e) => save(list.map((x, j) => (j === i ? Number(e.target.value) : x))) } },
        MAK.DUE_OFFSET_CHOICES.slice().reverse().map((c) => h('option', { attrs: { value: String(c), selected: c === m, disabled: c !== m && list.includes(c) }, text: t('set.dueBefore', { time: MAK.durationText(c * 60) }) }))),
      list.length > 1 ? h('button', { class: 'btn small-btn', text: '✕', attrs: { type: 'button', disabled: !s.notifyDue, title: t('set.dueRemove', { n: i + 1 }), 'aria-label': t('set.dueRemove', { n: i + 1 }) }, on: { click: () => save(list.filter((_, j) => j !== i)) } }) : null)));
  const free = MAK.DUE_OFFSET_CHOICES.filter((c) => !list.includes(c));
  const add = list.length < 3 && free.length
    ? h('div', { class: 'row' }, h('button', { class: 'btn', text: t('set.dueAdd'), attrs: { type: 'button', disabled: !s.notifyDue }, on: { click: () => save(list.concat(free.includes(180) ? 180 : free[0])) } }))
    : null;
  return h('div', { class: 'indent' }, rows, add);
}

// Help and support: the welcome page, the changes, a problem or an idea on GitHub (with the version
// and the browser), and a coffee.
// The official grades of the Expediente of SIGMA (lib/record.js). The permission for MiUPNA and SIGMA:
// only a click in a page of the extension can ask for it. "Activar" and "Leer ahora": first a window that
// says why the Expediente opens; "Abrir expediente" opens it in a small window (the background script).
let recordGranted = false;
function recordSection() {
  const r = S.record;
  const sum = MAK.recordSummary(r);
  const tried = S.recordTry;
  let state = t('record.off');
  if (recordGranted && r) state = sum ? t('record.read', { line: MAK.rankLine(sum), ago: MAK.ago(r.at, Date.now()) }) : t('record.readAt', { ago: MAK.ago(r.at, Date.now()) });
  else if (recordGranted) state = t('record.none');
  if (recordGranted && tried && tried.error === 'login') state += ` ${t('record.login')}`;
  const btn = (text, click) => h('button', { class: 'btn', attrs: { type: 'button' }, text, on: { click } });
  const open = () => dialog(t('record.askTitle'), h('p', { text: t('record.ask') }), [
    { text: t('record.back') },
    { text: t('record.open'), primary: true, click: async () => {
      if (!recordGranted && !(await Promise.resolve(ext.permissions.request(MAK.RECORD_PERMISSION)).catch(() => false))) return;
      recordGranted = true;
      renderCurrent();
      send({ type: 'recordOpen' });
    } }
  ]);
  const stop = async () => {
    await send({ type: 'recordOff' });
    recordGranted = false;
    renderCurrent();
  };
  return h('div', { class: 'section' },
    h('h2', { text: t('record.section') }),
    h('p', { class: 'small', text: t('record.help') }),
    sum && recordGranted ? h('p', null, MAK.rankPill(sum)) : null,
    h('p', { class: 'small', text: state }),
    h('div', { class: 'row' }, recordGranted ? [btn(t('record.refresh'), open), btn(t('record.stop'), stop)] : btn(t('record.start'), open)),
    recordGranted ? checkbox(t('record.bar'), t('record.barHelp'), settings().rankBar, (v) => send({ type: 'setSettings', patch: { rankBar: v } })) : null);
}

// A window over the popup: a title, its content and buttons [{ text, primary, click }]. A button closes it,
// and so do Escape and a click outside the window (as "Cancel": no button acts).
function dialog(title, body, buttons) {
  const box = h('div', { class: 'dialog-backdrop' },
    h('div', { class: 'dialog', attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title } },
      h('h2', { text: title }), body,
      h('div', { class: 'row' }, buttons.map((b) => h('button', { class: b.primary ? 'btn primary' : 'btn', attrs: { type: 'button' }, text: b.text,
        on: { click: () => { box.remove(); if (b.click) b.click(); } } })))));
  box.addEventListener('mousedown', (e) => { if (e.target === box) box.remove(); });
  document.body.append(box);
  MAK.escCloses(box, () => box.remove());
  box.querySelector('button').focus();
}

// A reading that the user asked for ended while the active tab was not MiAulario: the result here.
async function showRecordNews() {
  const area = ext.storage.session || ext.storage.local;
  const { recordNews } = await Promise.resolve(area.get('recordNews')).catch(() => ({}));
  const sum = MAK.recordSummary(S.record);
  if (!recordNews || !sum) return;
  await area.remove('recordNews');
  dialog(t('record.doneTitle'), h('div', null, MAK.rankView(S.record, S.recordSeen)), [{ text: t('record.close'), primary: true }]);
  send({ type: 'recordSeen' });
}

// A new issue on GitHub (kind: 'bug' or 'idea'), with the version, the browser and the language.
function issueUrl(kind) {
  const version = ext.runtime.getManifest ? ext.runtime.getManifest().version : '';
  return MAK.issueUrl({ kind, version, browser: MAK.browserName(navigator.userAgent, !!navigator.brave), lang: settings().lang });
}

// The "Danger zone": delete all the data of the extension (background.js, wipeAll), after two confirmations.
// Its step stays when the popup draws the settings again (the deletion changes the storage): 0 the button, 1 and 2
// a question each, 3 the deletion and its result.
const danger = { step: 0, text: '' };
function dangerSection() {
  const box = h('div', { class: 'section danger-zone', attrs: { id: 'danger' } });
  const button = (text, cls, onClick) => h('button', { class: `btn ${cls}`, text, attrs: { type: 'button' }, on: { click: onClick } });
  const go = (step) => {
    danger.step = step;
    if (step === 3) {
      danger.text = t('danger.working');
      MAK.dropStorageKeys(); // the keys of the pages of the extension (the theme)
      send({ type: 'wipeAll' }).then((r) => {
        danger.text = t(r && r.ok ? 'danger.done' : 'danger.error');
        draw();
      });
    }
    draw();
  };
  function draw() {
    const head = [h('h2', { text: t('danger.title') }), h('p', { class: 'small', text: t('danger.help') })];
    if (danger.step === 0) return fill(box, head, button(t('danger.button'), 'danger', () => go(1)));
    if (danger.step === 3) return fill(box, head, h('p', { class: 'small', attrs: { role: 'status' }, text: danger.text }));
    fill(box, head,
      h('p', { class: 'small', attrs: { role: 'alert' }, text: t(danger.step === 1 ? 'danger.confirm1' : 'danger.confirm2') }),
      h('div', { class: 'row' }, button(t('danger.cancel'), '', () => go(0)), button(t(danger.step === 1 ? 'danger.yes1' : 'danger.yes2'), 'danger', () => go(danger.step + 1))));
  }
  draw();
  return box;
}

function helpSection() {
  const open = (url) => () => { ext.tabs.create({ url }); closePopup(); };
  const btn = (text, url) => h('button', { class: 'btn', text, attrs: { type: 'button' }, on: { click: open(url) } });
  return h('div', { class: 'section', attrs: { id: 'help' } },
    h('h2', { text: t('help.section') }),
    h('p', { class: 'small', text: t('help.text') }),
    h('div', { class: 'help-links' },
      btn(t('help.welcome'), ext.runtime.getURL('tools.html?welcome')),
      btn(t('help.news'), ext.runtime.getURL('tools.html?news')),
      btn(t('help.bug'), issueUrl('bug')),
      btn(t('help.idea'), issueUrl('idea')),
      btn(t('help.coffee'), MAK.COFFEE_URL)),
    h('p', { class: 'small meta', text: t('help.coffeeText') }));
}

// After an update to a version with changes (MAK.CHANGES): a notice with a link to the changes.
function renderWhatsNew() {
  const el = $('whatsnew');
  const version = S.whatsNew;
  if (!version || !MAK.changesOf(version)) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  fill(el,
    h('span', { text: t('whatsnew.updated', { version }) }),
    h('button', { class: 'btn primary', text: t('whatsnew.see'), attrs: { type: 'button' }, on: { click: () => {
      send({ type: 'dismissWhatsNew' });
      ext.tabs.create({ url: ext.runtime.getURL('tools.html?news') });
      closePopup();
    } } }),
    h('button', { class: 'x', text: '✕', attrs: { type: 'button', title: t('mail.close'), 'aria-label': t('mail.close') }, on: { click: () => send({ type: 'dismissWhatsNew' }) } }));
}

// ---- Theme -------------------------------------------------------------------
// The theme and the mode (light or dark) of the settings on this page. The mode "auto": the mode of
// MiAulario (sakaiMode, from the content scripts), else the system. The last theme and mode stay in
// localStorage for the first paint of the next time (boot.js).
const currentScheme = () => MAK.pageScheme(settings().colorMode, S.sakaiMode);
const darkNow = () => {
  const scheme = currentScheme();
  return scheme === 'dark' || (scheme === 'system' && !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
};

function applyTheme(id) {
  const r = MAK.applyPageTheme(document, id || settings().theme, null, currentScheme());
  try {
    localStorage.setItem('mak.theme', r.id);
    localStorage.setItem('mak.scheme', r.scheme);
  } catch {}
}

function chooseTheme(id) {
  applyTheme(id);
  send({ type: 'setSettings', patch: { theme: id } });
}

// One card for each theme, drawn with the variables of that theme (lib/themes.js), and the mode.
function themeSection(s) {
  const lang = MAK.getLang();
  const dark = darkNow();
  const current = MAK.theme(s.theme).id;
  const mode = (m) => h('button', {
    attrs: { type: 'button', 'aria-pressed': String(s.colorMode === m) },
    text: t(`theme.mode.${m}`),
    on: { click: () => send({ type: 'setSettings', patch: { colorMode: m } }) }
  });
  return h(
    'div',
    { class: 'section', attrs: { id: 'theme' } },
    h('h2', { text: t('theme.section') }),
    h('div', { class: 'field-row' }, h('span', { text: t('theme.mode') }), h('div', { class: 'chips', attrs: { role: 'group', 'aria-label': t('theme.mode') } }, ['auto', 'light', 'dark'].map(mode))),
    h('p', { class: 'small', text: t('theme.modeHelp') }),
    h(
      'div',
      { class: 'themes', attrs: { role: 'radiogroup', 'aria-label': t('theme.section') } },
      MAK.THEMES.map((th) => {
        const input = h('input', { attrs: { type: 'radio', name: 'theme', value: th.id, checked: th.id === current }, on: { change: () => chooseTheme(th.id) } });
        const card = h(
          'label',
          { class: 'theme-card', data: { theme: th.id } },
          input,
          h('span', { class: 'name', text: MAK.themeName(th, lang) }),
          h('span', { class: 'about', text: MAK.themeAbout(th, lang) }),
          h('span', { class: 'sample' }, h('span', { class: 'countdown', text: t('theme.sampleCount') }), h('span', { class: 'chip', text: t('theme.sampleButton') }))
        );
        for (const [k, v] of Object.entries(MAK.themeValues(th.id, dark))) card.style.setProperty(`--ap-${k}`, v);
        return card;
      })
    ),
    h('p', { class: 'small', text: t('theme.help') }),
    checkbox(t('set.confetti'), t('set.confettiHelp'), s.confetti, (v) => send({ type: 'setSettings', patch: { confetti: v } }))
  );
}

function checkbox(label, help, checked, onChange) {
  const input = h('input', { attrs: { type: 'checkbox', checked }, on: { change: (e) => onChange(e.target.checked) } });
  return h('label', { class: 'check' }, input, h('span', null, label, help ? h('small', { text: help }) : null));
}

function renderSettings(el) {
  const s = settings();
  fill(
    el,
    themeSection(s),
    h(
      'div',
      { class: 'section' },
      h('h2', { text: t('set.keepAlive') }),
      MAK.KEEP_SESSION ? null : h('p', { class: 'notice', text: t('set.keepOff') }),
      h(
        'dl',
        { class: 'kv' },
        h('dt', { text: t('set.session') }), h('dd', { attrs: { id: 'ka-session' }, text: '–' }),
        h('dt', { text: t('set.lastPing') }), h('dd', { attrs: { id: 'ka-last' }, text: '–' }),
        // The time before Sakai ends the session: only while the pings keep it.
        MAK.KEEP_SESSION ? [h('dt', { text: t('set.timeLeft') }), h('dd', { attrs: { id: 'ka-left' }, text: '–' })] : null,
        h('dt', { text: t('set.nextPing') }), h('dd', { attrs: { id: 'ka-next' }, text: '–' })
      ),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn', attrs: { id: 'ka-ping' }, text: t('set.pingNow'), on: { click: pingNow } }),
        h('button', { class: 'btn', attrs: { id: 'ka-toggle' }, text: t(S.paused ? 'set.resume' : 'set.pause'), on: { click: togglePause } })
      ),
      MAK.KEEP_SESSION ? checkbox(t('set.autoLogin'), null, S.autoLogin !== false, (v) => send({ type: 'setAutoLogin', value: v })) : null
    ),
    h(
      'div',
      { class: 'section' },
      h('h2', { text: t('set.courseData') }),
      checkbox(t('set.sync'), t('set.syncHelp'), s.syncEnabled, (v) => send({ type: 'setSettings', patch: { syncEnabled: v } })),
      checkbox(t('set.notifyGrades'), t('set.notifyGradesHelp'), s.notifyGrades, (v) => send({ type: 'setSettings', patch: { notifyGrades: v } })),
      checkbox(t('set.notifyDue'), t('set.notifyDueHelp'), s.notifyDue, (v) => send({ type: 'setSettings', patch: { notifyDue: v } })),
      dueOffsetsField(s)
    ),
    h(
      'div',
      { class: 'section' },
      h('h2', { text: t('set.calendar') }),
      h('button', { class: 'btn', text: t('ics.button'), on: { click: openIcs } })
    ),
    h(
      'div',
      { class: 'section' },
      h('h2', { text: t('lib.section') }),
      h('label', { class: 'field-row' }, h('span', { class: 'small', text: t('lib.campusLabel') }),
        h('select', { on: { change: (e) => send({ type: 'setSettings', patch: { libraryCampus: e.target.value } }) } },
          ['arrosadia', 'salud', 'tudela'].map((c) => h('option', { attrs: { value: c, selected: c === s.libraryCampus }, text: t(`lib.campus.${c}`) })))),
      h('p', { class: 'small', text: t('lib.campusHelp') })
    ),
    h(
      'div',
      { class: 'section' },
      h('h2', { text: t('names.section') }),
      checkbox(t('names.short'), t('names.shortHelp'), s.shortNames, (v) => send({ type: 'setSettings', patch: { shortNames: v } }))
    ),
    h(
      'div',
      { class: 'section' },
      h('h2', { text: t('search.section') }),
      checkbox(t('search.shortcut', { key: SEARCH_KEY }), t('search.shortcutHelp'), s.searchShortcut, (v) => send({ type: 'setSettings', patch: { searchShortcut: v } }))
    ),
    recordSection(),
    teacherSection(),
    linksSection(),
    h(
      'div',
      { class: 'section' },
      h('h2', { text: t('diag.title') }),
      h('p', { class: 'small', text: t('diag.help') }),
      h('div', { class: 'row' }, h('button', { class: 'btn', text: t('diag.open'), attrs: { type: 'button' }, on: { click: () => { ext.tabs.create({ url: ext.runtime.getURL('tools.html?check=1') }); closePopup(); } } }))
    ),
    h(
      'div',
      { class: 'section' },
      h('h2', { text: t('set.badge') }),
      checkbox(t('set.badgeShow'), t('set.badgeHelp'), s.badge.enabled, (v) => send({ type: 'setSettings', patch: { badge: { enabled: v } } })),
      h(
        'div',
        { class: 'indent' },
        [
          ['deliveries', 'set.badgeDeliveries'],
          ['announcements', 'set.badgeAnnouncements'],
          ['messages', 'set.badgeMessages'],
          ['forums', 'set.badgeForums'],
          ['grades', 'set.badgeGrades']
        ].map(([key, label]) => {
          const box = checkbox(t(label), null, s.badge[key], (v) => send({ type: 'setSettings', patch: { badge: { [key]: v } } }));
          if (!s.badge.enabled) box.querySelector('input').disabled = true;
          return box;
        })
      )
    ),
    h(
      'div',
      { class: 'section' },
      h('h2', { text: t('set.language') }),
      h(
        'select',
        { attrs: { 'aria-label': t('set.language') }, on: { change: (e) => send({ type: 'setSettings', patch: { lang: e.target.value } }) } },
        Object.entries(MAK.LANGUAGES).map(([code, name]) => h('option', { attrs: { value: code, selected: code === s.lang, lang: code }, text: name }))
      )
    ),
    h(
      'div',
      { class: 'section' },
      h('h2', { text: t('config.title') }),
      h('p', { class: 'small', text: t('config.help') }),
      h('div', { class: 'row' },
        h('button', { class: 'btn', text: t('config.export'), attrs: { type: 'button' }, on: { click: exportConfig } }),
        // In a page: the popup closes when the window of the files opens.
        h('button', { class: 'btn', text: t('config.import'), attrs: { type: 'button' }, on: { click: () => { ext.tabs.create({ url: ext.runtime.getURL('tools.html?import') }); closePopup(); } } }))
    ),
    helpSection(),
    dangerSection()
  );
  updateKeepAlive(Date.now());
}

// "Exportar mi configuración": a JSON file with all the settings. A data: address, not a blob: a "Save as" window
// closes the popup, and a blob goes with it.
function exportConfig() {
  const now = new Date();
  const json = JSON.stringify(MAK.configExport(S, ext.runtime.getManifest().version, now), null, 2);
  const a = document.createElement('a');
  a.href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
  a.download = MAK.configFileName(now);
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
}

// The ping data comes from the storage (always current). Only the next alarm comes from the background.
function updateKeepAlive(now) {
  if (!$('ka-session')) return;
  const paused = !!S.paused;
  const last = S.last || null;
  $('ka-session').textContent = paused ? t('status.paused') : !last ? '–' : t(last.loggedIn ? 'ka.active' : last.error ? 'status.networkError' : 'ka.loggedOut');
  $('ka-last').textContent = last ? `${MAK.ago(last.time, now)} (${last.status || '–'})` : '–';
  if ($('ka-left')) $('ka-left').textContent = last && last.loggedIn ? `~${Math.max(0, MAX_INACTIVE_MIN - Math.round((now - last.time) / 60000))} min` : '–';
  if (status && status.nextPing && !paused) {
    $('ka-next').textContent = t('ka.in', { t: clockText(Math.max(0, Math.round((status.nextPing - now) / 1000))) });
  } else $('ka-next').textContent = '–';
  $('ka-toggle').textContent = t(paused ? 'set.resume' : 'set.pause');
}

async function refreshStatus() {
  status = await send({ type: 'getStatus' });
  updateKeepAlive(Date.now());
}

async function pingNow() {
  $('ka-ping').disabled = true;
  await send({ type: 'pingNow' });
  $('ka-ping').disabled = false;
  refreshStatus();
}

async function togglePause() {
  await send({ type: S.paused ? 'resume' : 'pause' });
  refreshStatus();
}

// ---- Timer, refresh and start ------------------------------------------------

function tick() {
  const now = Date.now();
  for (const el of document.querySelectorAll('.countdown[data-due]')) {
    const due = Number(el.dataset.due);
    if (due) el.textContent = MAK.countdownText(due, now);
  }
  if (current === 'settings') updateKeepAlive(now);
  if (current === 'home') updateHomeSession(now);
  renderHeader();
  // Draw the panel again every minute, so that the urgency colors change at the correct time.
  if (now - lastRender > 60000 && !userIsInPanel()) renderCurrent();
}


async function refresh() {
  if (syncing) return;
  syncing = true;
  $('refresh').classList.add('spin');
  renderHeader();
  const r = await send({ type: 'syncNow' });
  syncing = false;
  $('refresh').classList.remove('spin');
  if (r && r.skipped && r.skipped !== 'not-due') flash = { text: t(`skip.${r.skipped}`), until: Date.now() + 6000 };
  else if (r && r.errors && r.errors.length) flash = { text: t('skip.someFailed'), until: Date.now() + 6000 };
  renderHeader();
}

async function checkPermissions() {
  try {
    $('perm').hidden = await ext.permissions.contains({ origins: ORIGINS });
  } catch {
    $('perm').hidden = true;
  }
}

// Select the language of the settings (Spanish by default) and translate the fixed texts.
function applyLanguage() {
  MAK.setLang(settings().lang);
  MAK.applyI18n(document);
  $('search').placeholder = t('search.placeholder', { key: SEARCH_KEY });
  $('search').setAttribute('aria-label', t('search.placeholder', { key: SEARCH_KEY }));
}

async function init() {
  MAK.animateDetails();
  if (WIDE) {
    document.body.classList.add('wide');
    $('openTab').hidden = true;
    $('close').hidden = true; // a tab: the browser closes it
  }
  $('tabbtn-home').append(MAK.icon('home'));
  S = await ext.storage.local.get(null);
  applyTheme();
  applyLanguage();
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [k, c] of Object.entries(changes)) {
      if ('newValue' in c) S[k] = c.newValue;
      else delete S[k];
    }
    searchIndex = null;
    // A new ping or a pause changes the time of the next alarm.
    if ('last' in changes || 'paused' in changes) refreshStatus();
    if ('settings' in changes || 'sakaiMode' in changes) applyTheme();
    if ('whatsNew' in changes) renderWhatsNew();
    if ('settings' in changes && settings().lang !== MAK.getLang()) {
      // A new language: draw everything again now, also if a field has the focus.
      applyLanguage();
      renderHeader();
      renderWhatsNew();
      renderCurrent();
      return;
    }
    scheduleRender();
  });
  for (const btn of document.querySelectorAll('nav.tabs [role="tab"]')) btn.addEventListener('click', () => selectTab(btn.dataset.tab));
  $('refresh').addEventListener('click', refresh);
  setupSearch();
  $('privacyLink').addEventListener('click', () => {
    ext.tabs.create({ url: MAK.PRIVACY_URL });
    closePopup();
  });
  $('close').addEventListener('click', () => window.close());
  $('openTab').addEventListener('click', () => {
    ext.tabs.create({ url: ext.runtime.getURL('popup.html?view=tab') });
    window.close();
  });
  $('grant').addEventListener('click', async () => {
    await ext.permissions.request({ origins: ORIGINS });
    await send({ type: 'resume' });
    checkPermissions();
  });
  recordGranted = await Promise.resolve(ext.permissions.contains(MAK.RECORD_PERMISSION)).catch(() => false);
  // The popup opens on the main menu (Inicio), or on the tab of ?tab=.
  const asked = new URLSearchParams(location.search).get('tab');
  renderHeader();
  renderWhatsNew(); // not in renderHeader (every second): its buttons would change under the mouse
  selectTab(asked && panels[asked] ? asked : 'home');
  checkPermissions();
  refreshStatus();
  showRecordNews();
  send({ type: 'touch' });
  setInterval(tick, 1000);
}

init();
