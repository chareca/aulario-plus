// Aulario Plus: the popup. The same page opens in a tab with "?view=tab".
// The popup reads the storage and sends messages. Only the background script writes.
const ext = globalThis.browser ?? globalThis.chrome;
const { h, fill, t } = MAK;
const ORIGINS = ['https://miaulario.unavarra.es/*', 'https://sso.unavarra.es/*', 'https://www.unavarra.es/*'];
const MAX_INACTIVE_MIN = 60;
const $ = (id) => document.getElementById(id);
const send = (msg) => Promise.resolve(ext.runtime.sendMessage(msg)).catch(() => null);
const WIDE = new URLSearchParams(location.search).get('view') === 'tab';

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
document.head.append(h('style', { text: MAK.LINK_CSS }));
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
  due: { render: renderDue },
  inbox: { render: renderInbox },
  new: { render: renderNew, open: openNew },
  grades: { render: renderGrades, open: openGrades },
  sites: { render: renderSites },
  settings: { render: renderSettings }
};
let current = 'due';

function selectTab(name) {
  if (!panels[name]) name = 'due';
  current = name;
  if (ui.query) setQuery('');
  for (const btn of document.querySelectorAll('nav.tabs [role="tab"]')) {
    btn.setAttribute('aria-selected', String(btn.dataset.tab === name));
  }
  for (const key of Object.keys(panels)) $(`tab-${key}`).hidden = key !== name || !!ui.query;
  try { localStorage.setItem('mak.tab', name); } catch {}
  if (panels[name].open) panels[name].open();
  renderCurrent();
}

function renderCurrent() {
  lastRender = Date.now();
  pendingRender = false;
  panels[current].render($(`tab-${current}`));
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
// While the search box has text, the results replace the panel. The index is made again only
// when the stored data changes.

const SEARCH_KEY = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl+K';
let searchIndex = null;

function setQuery(value) {
  ui.query = value;
  ui.searchSel = 0;
  if ($('search').value !== value) $('search').value = value;
  $(`tab-${current}`).hidden = !!value.trim();
  renderSearch();
}

function resultMeta(x) {
  if (x.type === 'delivery' || x.type === 'event' || x.type === 'announcement') return x.time ? MAK.formatDate(x.time) : '';
  if (x.type === 'file' || x.type === 'forum' || x.type === 'site') return x.meta;
  return '';
}

function renderSearch() {
  const el = $('search-results');
  const q = ui.query.trim();
  el.hidden = !q;
  if (!q) return;
  if (!searchIndex) searchIndex = MAK.buildSearchIndex(S, settings());
  const list = MAK.searchIndex(searchIndex, q, 30);
  // The groups in the order of their best result.
  const groups = [...new Set(list.map((x) => x.type))].map((type) => [type, list.filter((x) => x.type === type)]);
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
          h('span', { class: 'title', text: x.title }),
          h('span', { class: 'meta', text: [x.type === 'site' ? null : x.site, resultMeta(x)].filter(Boolean).join(' · ') })
        );
      })
    ])
  );
  const sel = el.querySelector('.result.sel');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

function setupSearch() {
  const box = $('search');
  box.addEventListener('input', () => setQuery(box.value));
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      ui.searchSel += e.key === 'ArrowDown' ? 1 : -1;
      renderSearch();
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
  const dot = $('dot');
  dot.className = 'dot';
  let headline;
  if (S.paused) { dot.classList.add('warn'); headline = t('status.paused'); }
  else if (last && last.loggedIn) { dot.classList.add('ok'); headline = t('status.connected'); }
  else if (last) { dot.classList.add('bad'); headline = t(last.error ? 'status.networkError' : 'status.notLoggedIn'); }
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
    if (S.paused) return emptyBox(t('empty.paused'));
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

function deliveryRow(x, now) {
  const cls = ['item', `s-${x.state}`];
  if (x.urgency) cls.push(`u-${x.urgency}`);
  let side;
  if (x.state === 'submitted') side = h('span', { class: 'tag ok', text: t('due.tagSubmitted') });
  else if (x.state === 'closed') side = h('span', { class: 'tag', text: t('due.tagClosed') });
  else if (x.offline) side = h('span', { class: 'tag', text: t('due.tagOffline') });
  else side = h('span', { class: 'countdown', data: { due: x.due || '' }, text: MAK.countdownText(x.due, now) });
  return h(
    'div',
    { class: cls.join(' ') },
    h('span', { class: 'bar' }),
    h(
      'div',
      { class: 'body' },
      h('a', { class: 'title', href: x.url, text: x.title }),
      h(
        'div',
        { class: 'meta' },
        `${x.siteTitle} · ${x.due ? MAK.formatDate(x.due) : t('due.noDate')}`,
        x.dueChange && now - x.dueChange.at < DATE_CHANGE_DAYS * MAK.DAY ? [' ', h('span', { class: 'tag info', text: t('due.tagMoved'), title: t('due.movedFrom', { date: MAK.formatDate(x.dueChange.from) }) })] : null
      )
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
  if (!all.length && !(S.events || []).length) return fill(el, emptyBox(t('due.none')));
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

function toggleAnnouncement(x) {
  if (ui.openAnn.has(x.id)) ui.openAnn.delete(x.id);
  else {
    ui.openAnn.add(x.id);
    if (x.unread) send({ type: 'markAnnRead', ids: [x.id] });
  }
  renderInboxList();
}

function inboxRow(x) {
  if (x.type === 'announcement') {
    const open = ui.openAnn.has(x.id);
    return h(
      'div',
      { class: `item ${x.unread ? 'unread' : 'read'}` },
      h('span', { class: 'bar' }),
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
              null,
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
    h('span', { class: 'bar' }),
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
function siteGuide(siteId) {
  return MAK.loadGuide({
    tool: S.pages && S.pages[siteId] && S.pages[siteId].guide,
    stored: S.guides && S.guides[siteId],
    now: Date.now(),
    fetchMia: async (path) => (await fetch(new URL(path, MAK.BASE).href, { credentials: 'include' })).text(),
    fetchGuide: async (url) => {
      const r = await send({ type: 'fetchGuide', url });
      if (!r || !r.html) throw new Error((r && r.error) || 'guide.network');
      return r.html;
    },
    parse: (html) => new DOMParser().parseFromString(html, 'text/html'),
    save: (guide) => send({ type: 'saveGuide', siteId, guide })
  });
}

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
function forwardGuide() {
  const copyBtn = h('button', { class: 'btn', text: t('fwd.copy'), attrs: { type: 'button' } });
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(MAK.MAIL_MARK);
      copyBtn.textContent = t('fwd.copied');
      setTimeout(() => { copyBtn.textContent = t('fwd.copy'); }, 1500);
    } catch {}
  });
  return h(
    'div',
    { class: 'section' },
    h('h2', { text: t('fwd.section') }),
    h('p', { class: 'small', text: t('fwd.text') }),
    h('details', null, h('summary', { text: t('fwd.steps') }), h('p', { class: 'small', text: t('fwd.gmail') }), h('p', { class: 'small', text: t('fwd.outlook') }), h('p', { class: 'small meta', text: t('fwd.share') })),
    h('div', { class: 'row' }, copyBtn)
  );
}

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

function checkbox(label, help, checked, onChange) {
  const input = h('input', { attrs: { type: 'checkbox', checked }, on: { change: (e) => onChange(e.target.checked) } });
  return h('label', { class: 'check' }, input, h('span', null, label, help ? h('small', { text: help }) : null));
}

function renderSettings(el) {
  const s = settings();
  fill(
    el,
    h(
      'div',
      { class: 'section' },
      h('h2', { text: t('set.keepAlive') }),
      h(
        'dl',
        { class: 'kv' },
        h('dt', { text: t('set.session') }), h('dd', { attrs: { id: 'ka-session' }, text: '–' }),
        h('dt', { text: t('set.lastPing') }), h('dd', { attrs: { id: 'ka-last' }, text: '–' }),
        h('dt', { text: t('set.timeLeft') }), h('dd', { attrs: { id: 'ka-left' }, text: '–' }),
        h('dt', { text: t('set.nextPing') }), h('dd', { attrs: { id: 'ka-next' }, text: '–' })
      ),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn', attrs: { id: 'ka-ping' }, text: t('set.pingNow'), on: { click: pingNow } }),
        h('button', { class: 'btn', attrs: { id: 'ka-toggle' }, text: t(S.paused ? 'set.resume' : 'set.pause'), on: { click: togglePause } })
      ),
      checkbox(t('set.autoLogin'), null, S.autoLogin !== false, (v) => send({ type: 'setAutoLogin', value: v }))
    ),
    h(
      'div',
      { class: 'section' },
      h('h2', { text: t('set.courseData') }),
      checkbox(t('set.sync'), t('set.syncHelp'), s.syncEnabled, (v) => send({ type: 'setSettings', patch: { syncEnabled: v } })),
      checkbox(t('set.notifyGrades'), t('set.notifyGradesHelp'), s.notifyGrades, (v) => send({ type: 'setSettings', patch: { notifyGrades: v } }))
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
      h('h2', { text: t('names.section') }),
      checkbox(t('names.short'), t('names.shortHelp'), s.shortNames, (v) => send({ type: 'setSettings', patch: { shortNames: v } }))
    ),
    h(
      'div',
      { class: 'section' },
      h('h2', { text: t('search.section') }),
      checkbox(t('search.shortcut', { key: SEARCH_KEY }), t('search.shortcutHelp'), s.searchShortcut, (v) => send({ type: 'setSettings', patch: { searchShortcut: v } }))
    ),
    teacherSection(),
    linksSection(),
    forwardGuide(),
    h(
      'div',
      { class: 'section' },
      h('h2', { text: t('diag.title') }),
      h('p', { class: 'small', text: t('diag.help') }),
      h('div', { class: 'row' }, h('button', { class: 'btn', text: t('diag.open'), attrs: { type: 'button' }, on: { click: () => { ext.tabs.create({ url: ext.runtime.getURL('tools.html?check=1') }); window.close(); } } }))
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
      { class: 'section', attrs: { id: 'privacy' } },
      h('h2', { text: t('privacy.title') }),
      ['privacy.text1', 'privacy.text2', 'privacy.text3', 'privacy.text4'].map((k) => h('p', { class: 'small', text: t(k) }))
    )
  );
  updateKeepAlive(Date.now());
}

// The ping data comes from the storage (always current). Only the next alarm comes from the background.
function updateKeepAlive(now) {
  if (!$('ka-session')) return;
  const paused = !!S.paused;
  const last = S.last || null;
  $('ka-session').textContent = paused ? t('status.paused') : !last ? '–' : t(last.loggedIn ? 'ka.active' : last.error ? 'status.networkError' : 'ka.loggedOut');
  $('ka-last').textContent = last ? `${MAK.ago(last.time, now)} (${last.status || '–'})` : '–';
  $('ka-left').textContent = last && last.loggedIn ? `~${Math.max(0, MAX_INACTIVE_MIN - Math.round((now - last.time) / 60000))} min` : '–';
  if (status && status.nextPing && !paused) {
    const s = Math.max(0, Math.round((status.nextPing - now) / 1000));
    $('ka-next').textContent = t('ka.in', { t: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` });
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
  if (WIDE) {
    document.body.classList.add('wide');
    $('openTab').hidden = true;
  }
  S = await ext.storage.local.get(null);
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
    if ('settings' in changes && settings().lang !== MAK.getLang()) {
      // A new language: draw everything again now, also if a field has the focus.
      applyLanguage();
      renderHeader();
      renderCurrent();
      return;
    }
    scheduleRender();
  });
  for (const btn of document.querySelectorAll('nav.tabs [role="tab"]')) btn.addEventListener('click', () => selectTab(btn.dataset.tab));
  $('refresh').addEventListener('click', refresh);
  setupSearch();
  $('privacyLink').addEventListener('click', () => {
    selectTab('settings');
    const el = $('privacy');
    if (el) el.scrollIntoView({ block: 'start' });
  });
  $('openTab').addEventListener('click', () => {
    ext.tabs.create({ url: ext.runtime.getURL('popup.html?view=tab') });
    window.close();
  });
  $('grant').addEventListener('click', async () => {
    await ext.permissions.request({ origins: ORIGINS });
    await send({ type: 'resume' });
    checkPermissions();
  });
  let tab = 'due';
  try { tab = localStorage.getItem('mak.tab') || 'due'; } catch {}
  const asked = new URLSearchParams(location.search).get('tab');
  if (asked && panels[asked]) tab = asked;
  renderHeader();
  selectTab(tab);
  checkPermissions();
  refreshStatus();
  send({ type: 'touch' });
  setInterval(tick, 1000);
}

init();
