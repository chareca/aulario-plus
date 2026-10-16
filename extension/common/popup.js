// MiAulario Keep-Alive: the popup. The same page opens in a tab with "?view=tab".
// The popup reads the storage and sends messages. Only the background script writes.
const ext = globalThis.browser ?? globalThis.chrome;
const { h, fill } = MAK;
const ORIGINS = ['https://miaulario.unavarra.es/*', 'https://sso.unavarra.es/*'];
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
const ui = { dueSite: '' };

const settings = () => MAK.withDefaults(S.settings);
const hiddenSet = () => MAK.hiddenEverywhere(settings());
const siteTitle = (id) => ((S.sites || []).find((s) => s.id === id) || {}).title || id;

// ---- Panels ------------------------------------------------------------------

const panels = {
  due: { render: renderDue },
  settings: { render: renderSettings }
};
let current = 'due';

function selectTab(name) {
  if (!panels[name]) name = 'due';
  current = name;
  for (const btn of document.querySelectorAll('nav.tabs [role="tab"]')) {
    btn.setAttribute('aria-selected', String(btn.dataset.tab === name));
  }
  for (const key of Object.keys(panels)) $(`tab-${key}`).hidden = key !== name;
  try { localStorage.setItem('mak.tab', name); } catch {}
  renderCurrent();
}

function renderCurrent() {
  lastRender = Date.now();
  pendingRender = false;
  panels[current].render($(`tab-${current}`));
  tick();
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

// ---- Header ------------------------------------------------------------------

function renderHeader() {
  const now = Date.now();
  const meta = S.meta || {};
  const last = S.last && !S.last.relogin ? S.last : null;
  const dot = $('dot');
  dot.className = 'dot';
  let headline;
  if (S.paused) { dot.classList.add('warn'); headline = 'Paused'; }
  else if (last && last.loggedIn) { dot.classList.add('ok'); headline = 'Connected'; }
  else if (last) { dot.classList.add('bad'); headline = last.error ? 'Network error' : 'Not logged in'; }
  else headline = 'No ping yet';
  $('headline').textContent = headline;

  let sub;
  if (flash && flash.until > now) sub = flash.text;
  else if (!settings().syncEnabled) sub = 'Course data sync is off';
  else if (syncing) sub = 'Update in progress…';
  else if (meta.lastSync) sub = `Course data: ${MAK.ago(meta.lastSync, now)}${meta.stale && Object.keys(meta.stale).length ? ' (some data is old)' : ''}`;
  else sub = 'No course data yet';
  $('subline').textContent = sub;
}

// ---- Shared parts ------------------------------------------------------------

function emptyBox(text) {
  return h('div', { class: 'empty', text });
}

// A message when there is no course data to show, or null.
function noDataMessage(what) {
  const meta = S.meta || {};
  if (!settings().syncEnabled) return emptyBox(`Course data sync is off. Turn it on in Settings to see your ${what}.`);
  if (!meta.lastSync) {
    if (S.paused) return emptyBox('The extension is paused. Resume it in Settings.');
    if (meta.loggedIn === false) return emptyBox(`Log in to MiAulario. Then your ${what} show here.`);
    return emptyBox('No course data yet. Click ↻ to update it.');
  }
  return null;
}

function siteSelect(siteIds, value, onChange) {
  return h(
    'select',
    { attrs: { 'aria-label': 'Site' }, on: { change: (e) => onChange(e.target.value) } },
    h('option', { attrs: { value: '' }, text: 'All sites' }),
    siteIds.map((id) => h('option', { attrs: { value: id, selected: id === value }, text: siteTitle(id) }))
  );
}

// ---- Due ---------------------------------------------------------------------

function deliveryRow(x, now) {
  const cls = ['item', `s-${x.state}`];
  if (x.urgency) cls.push(`u-${x.urgency}`);
  let side;
  if (x.state === 'submitted') side = h('span', { class: 'tag ok', text: 'Submitted' });
  else if (x.state === 'closed') side = h('span', { class: 'tag', text: 'Closed' });
  else if (x.offline) side = h('span', { class: 'tag', text: 'No online submission' });
  else side = h('span', { class: 'countdown', data: { due: x.due || '' }, text: MAK.countdownText(x.due, now) });
  return h(
    'div',
    { class: cls.join(' ') },
    h('span', { class: 'bar' }),
    h(
      'div',
      { class: 'body' },
      h('a', { class: 'title', href: x.url, text: x.title }),
      h('div', { class: 'meta', text: `${x.siteTitle} · ${x.due ? MAK.formatDate(x.due) : 'No due date'}` })
    ),
    h('div', { class: 'side' }, side)
  );
}

function renderDue(el) {
  const now = Date.now();
  const none = noDataMessage('deliveries');
  if (none) return fill(el, none);
  const model = MAK.buildDue({ assignments: S.assignments, sites: S.sites, pages: S.pages, hidden: hiddenSet(), now });
  const g = model.groups;
  const all = [...g.late, ...g.pending, ...g.action, ...g.submitted, ...g.closed];
  if (!all.length) return fill(el, emptyBox('No deliveries.'));
  const siteIds = [...new Set(all.map((x) => x.siteId))];
  if (ui.dueSite && !siteIds.includes(ui.dueSite)) ui.dueSite = '';
  const keep = (list) => list.filter((x) => !ui.dueSite || x.siteId === ui.dueSite);
  const group = (title, list) => (list.length ? [h('h2', { class: 'group', text: `${title} (${list.length})` }), list.map((x) => deliveryRow(x, now))] : null);
  const folded = (title, list) => (list.length ? h('details', null, h('summary', { text: `${title} (${list.length})` }), list.map((x) => deliveryRow(x, now))) : null);
  const open = [...keep(g.late), ...keep(g.pending), ...keep(g.action)];
  fill(
    el,
    h('div', { class: 'toolbar' }, siteSelect(siteIds, ui.dueSite, (v) => { ui.dueSite = v; renderCurrent(); })),
    open.length ? null : emptyBox('Nothing to submit.'),
    group('Late: you can still submit', keep(g.late)),
    group('To do', keep(g.pending)),
    group('Returned: you can submit again', keep(g.action)),
    folded('Submitted', keep(g.submitted)),
    folded('Closed', keep(g.closed).slice(0, 30))
  );
}

// ---- Settings ----------------------------------------------------------------

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
      h('h2', { text: 'Keep-alive' }),
      h(
        'dl',
        { class: 'kv' },
        h('dt', { text: 'Session' }), h('dd', { attrs: { id: 'ka-session' }, text: '–' }),
        h('dt', { text: 'Last ping' }), h('dd', { attrs: { id: 'ka-last' }, text: '–' }),
        h('dt', { text: 'Time left' }), h('dd', { attrs: { id: 'ka-left' }, text: '–' }),
        h('dt', { text: 'Next ping' }), h('dd', { attrs: { id: 'ka-next' }, text: '–' })
      ),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn', attrs: { id: 'ka-ping' }, text: 'Ping now', on: { click: pingNow } }),
        h('button', { class: 'btn', attrs: { id: 'ka-toggle' }, text: S.paused ? 'Resume' : 'Pause', on: { click: togglePause } })
      ),
      checkbox('Open the login page when the session ends', null, S.autoLogin !== false, (v) => send({ type: 'setAutoLogin', value: v }))
    ),
    h(
      'div',
      { class: 'section' },
      h('h2', { text: 'Course data' }),
      checkbox(
        'Sync course data',
        'The extension reads your deliveries, announcements, messages, forums and files from MiAulario. It sends a few requests every 15 minutes. Turn this off to stop these requests.',
        s.syncEnabled,
        (v) => send({ type: 'setSettings', patch: { syncEnabled: v } })
      )
    )
  );
  updateKeepAlive(Date.now());
}

// The ping data comes from the storage (always current). Only the next alarm comes from the background.
function updateKeepAlive(now) {
  if (!$('ka-session')) return;
  const paused = !!S.paused;
  const last = S.last && !S.last.relogin ? S.last : (S.log || []).filter((e) => !e.relogin).pop();
  $('ka-session').textContent = paused ? 'Paused' : !last ? '–' : last.loggedIn ? 'Active' : last.error ? 'Network error' : 'Logged out';
  $('ka-last').textContent = last ? `${MAK.ago(last.time, now)} (${last.status || '–'})` : '–';
  $('ka-left').textContent = last && last.loggedIn ? `~${Math.max(0, MAX_INACTIVE_MIN - Math.round((now - last.time) / 60000))} min` : '–';
  if (status && status.nextPing && !paused) {
    const s = Math.max(0, Math.round((status.nextPing - now) / 1000));
    $('ka-next').textContent = `in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  } else $('ka-next').textContent = '–';
  $('ka-toggle').textContent = paused ? 'Resume' : 'Pause';
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
  const st = await send({ type: 'getStatus' });
  await send({ type: st && st.paused ? 'resume' : 'pause' });
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

const SKIP_TEXT = {
  paused: 'The extension is paused',
  disabled: 'Course data sync is off',
  'logged-out': 'Log in to MiAulario first',
  backoff: 'The server is busy. Do it again later',
  locked: 'An update is in progress'
};

async function refresh() {
  if (syncing) return;
  syncing = true;
  $('refresh').classList.add('spin');
  renderHeader();
  const r = await send({ type: 'syncNow' });
  syncing = false;
  $('refresh').classList.remove('spin');
  if (r && r.skipped && SKIP_TEXT[r.skipped]) flash = { text: SKIP_TEXT[r.skipped], until: Date.now() + 6000 };
  else if (r && r.errors && r.errors.length) flash = { text: 'Some data did not update', until: Date.now() + 6000 };
  renderHeader();
}

async function checkPermissions() {
  try {
    $('perm').hidden = await ext.permissions.contains({ origins: ORIGINS });
  } catch {
    $('perm').hidden = true;
  }
}

async function init() {
  if (WIDE) {
    document.body.classList.add('wide');
    $('openTab').hidden = true;
  }
  S = await ext.storage.local.get(null);
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [k, c] of Object.entries(changes)) {
      if ('newValue' in c) S[k] = c.newValue;
      else delete S[k];
    }
    // A new ping or a pause changes the time of the next alarm.
    if ('last' in changes || 'paused' in changes) refreshStatus();
    scheduleRender();
  });
  for (const btn of document.querySelectorAll('nav.tabs [role="tab"]')) btn.addEventListener('click', () => selectTab(btn.dataset.tab));
  $('refresh').addEventListener('click', refresh);
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
  renderHeader();
  selectTab(tab);
  checkPermissions();
  refreshStatus();
  send({ type: 'touch' });
  setInterval(tick, 1000);
}

init();
