// Aulario Plus: the tools page (a tab of the extension).
//   tools.html?zip=<siteId>   download all the files of a site as one ZIP
//   tools.html?ics=1          export the deliveries and the calendar events as an .ics file
//   tools.html?check=1        the MiAulario checks (diagnostic); "&auto=1" starts them at once
//   tools.html?perm=exams     the permission to read the exam calendars (www2.unavarra.es)
//   tools.html?history        the history of the tasks and the exams of the user (lib/history.js)
// A tab is used (not the popup) because the popup closes when it loses the focus.
const ext = globalThis.browser ?? globalThis.chrome;
const { t } = MAK;
const $ = (id) => document.getElementById(id);

// Save the parts as a file. The link must be in the page; the URL is removed after 60 seconds.
function saveFile(parts, type, name) {
  const url = URL.createObjectURL(new Blob(parts, { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.hidden = true;
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 60000);
}

// ---- ZIP of the files of one site ---------------------------------------------

async function fetchFile(url, signal) {
  const r = await fetch(url, { credentials: 'include', cache: 'no-store', signal });
  const type = r.headers.get('content-type') || '';
  // Also an HTML page: buildSiteZip rejects the login page and the copyright page, and keeps an HTML file.
  const data = r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
  return { ok: r.ok, status: r.status, url: r.url || url, type, data };
}

async function runZip(siteId, site) {
  const status = $('zip-status');
  const warning = $('zip-warning');
  const start = $('zip-start');
  const cancel = $('zip-cancel');
  const bar = $('zip-progress');
  $('zip').hidden = false;
  $('title').textContent = t('zip.title', { site: site.title });
  document.title = t('zip.title', { site: site.title });
  status.textContent = t('zip.reading');

  let items;
  try {
    const api = MAK.createApi({ fetch: (u, i) => fetch(u, i) });
    items = (await api.resources(siteId)).map((r) => MAK.trimResource(r, siteId)).filter(Boolean);
  } catch {
    status.textContent = t('zip.loginNeeded');
    return;
  }
  const files = items.filter((x) => !x.folder && !x.link);
  const links = items.filter((x) => x.link);
  const folders = items.filter((x) => x.folder);
  const total = files.reduce((n, f) => n + (f.size || 0), 0);
  const size = MAK.formatSize(total, MAK.locale());
  if (!files.length && !links.length) {
    status.textContent = t('zip.empty');
    return;
  }
  status.textContent = [
    t('zip.files', { n: files.length, size }),
    links.length ? t('zip.links', { n: links.length }) : null,
    folders.length ? t('zip.folders', { n: folders.length }) : null
  ].filter(Boolean).join(' · ');
  if (total > MAK.ZIP_LIMIT_BYTES) {
    warning.textContent = t('zip.tooBig', { size });
    warning.hidden = false;
    return;
  }
  if (total > MAK.ZIP_WARN_BYTES) {
    warning.textContent = t('zip.big', { size });
    warning.hidden = false;
  }

  const name = MAK.safeFileName(t('zip.fileName', { site: site.title, date: MAK.ymd(Date.now()) }));
  start.textContent = t('zip.start');
  cancel.textContent = t('zip.cancel');
  start.hidden = false;

  start.onclick = async () => {
    const controller = new AbortController();
    start.hidden = true;
    cancel.hidden = false;
    bar.hidden = false;
    bar.value = 0;
    cancel.onclick = () => controller.abort();
    try {
      const result = await MAK.buildSiteZip({
        items,
        siteId,
        siteTitle: site.title,
        fetchFile,
        signal: controller.signal,
        t,
        onProgress: ({ index, total: n, name: file }) => {
          bar.max = n;
          bar.value = index;
          status.textContent = t('zip.progress', { i: index, n, name: file });
        }
      });
      status.textContent = t('zip.building');
      saveFile(result.parts, 'application/zip', name);
      status.textContent = t('zip.done', { n: result.files, name });
      if (result.errors.length) {
        warning.textContent = t('zip.errors', { n: result.errors.length, file: t('zip.errorsFile') });
        warning.hidden = false;
      }
    } catch (e) {
      status.textContent = e && e.message === 'aborted' ? t('zip.cancelled') : `${t('zip.err.network')}: ${e && e.message}`;
    }
    cancel.hidden = true;
    bar.hidden = true;
    start.textContent = t('zip.again');
    start.hidden = false;
  };
}

// ---- Export to a calendar (.ics) -----------------------------------------------

async function runIcs(store) {
  const { h, fill } = MAK;
  const settings = MAK.withDefaults(store.settings);
  const box = $('ics');
  box.hidden = false;
  $('title').textContent = t('ics.title');
  document.title = t('ics.title');
  const deliveries = h('input', { attrs: { type: 'checkbox', checked: true } });
  const pending = h('input', { attrs: { type: 'radio', name: 'mode', value: 'pending', checked: true } });
  const all = h('input', { attrs: { type: 'radio', name: 'mode', value: 'all' } });
  const events = h('input', { attrs: { type: 'checkbox', checked: true } });
  const status = h('p', { class: 'status', attrs: { role: 'status' } });
  const help = h('p', { class: 'meta', hidden: true });
  const create = h('button', { class: 'btn primary', text: t('ics.create') });
  fill(
    box,
    h('label', { class: 'check' }, deliveries, h('span', { text: t('ics.deliveries') })),
    h('div', { class: 'indent' }, h('label', { class: 'radio' }, pending, h('span', { text: t('ics.pendingOnly') })), h('label', { class: 'radio' }, all, h('span', { text: t('ics.allDeliveries') }))),
    h('label', { class: 'check' }, events, h('span', { text: t('ics.events') })),
    h('div', { class: 'row' }, create),
    status,
    help
  );
  deliveries.addEventListener('change', () => { pending.disabled = all.disabled = !deliveries.checked; });

  create.addEventListener('click', async () => {
    create.disabled = true;
    help.hidden = true;
    const now = Date.now();
    const hidden = MAK.hiddenEverywhere(settings);
    let list = [];
    if (deliveries.checked) {
      const g = MAK.buildDue({ assignments: store.assignments, sites: store.sites, pages: store.pages, hidden, now }).groups;
      list = all.checked ? [...g.late, ...g.pending, ...g.action, ...g.submitted, ...g.closed] : [...g.late, ...g.pending, ...g.action];
    }
    let evs = [];
    if (events.checked) {
      status.textContent = t('ics.reading');
      try {
        const api = MAK.createApi({ fetch: (u, i) => fetch(u, i) });
        const names = new Map(store.sites.map((s) => [s.id, s.title]));
        evs = (await api.calendar(MAK.ymd(now - 30 * MAK.DAY), MAK.ymd(now + 365 * MAK.DAY)))
          .map(MAK.trimEvent)
          .filter((e) => !hidden.has(e.siteId))
          .map((e) => Object.assign(e, { siteTitle: names.get(e.siteId) || e.siteTitle }));
      } catch {
        status.textContent = t('ics.error');
        create.disabled = false;
        return;
      }
    }
    const { text, count } = MAK.buildIcs({ deliveries: list, events: evs, now, t });
    if (!count) {
      status.textContent = t('ics.nothing');
      create.disabled = false;
      return;
    }
    const name = t('ics.fileName', { date: MAK.ymd(Date.now()) });
    saveFile([text], 'text/calendar;charset=utf-8', name);
    status.textContent = t('ics.done', { n: count, name });
    help.textContent = `${t('ics.help')} ${t('ics.snapshot')}`;
    help.hidden = false;
    create.disabled = false;
  });
}

// ---- Start ---------------------------------------------------------------------

// ---- MiAulario checks (diagnostic) ---------------------------------------------------
// window.__checkResults and window.__checksDone are for tests/live/run.mjs.

function runChecks(auto) {
  const { h, fill } = MAK;
  const box = $('checks');
  box.hidden = false;
  $('title').textContent = t('diag.title');
  document.title = t('diag.title');
  const list = h('ul', { class: 'checks' });
  const summary = h('p', { class: 'status', attrs: { role: 'status' } });
  const start = h('button', { class: 'btn primary', text: t('diag.start'), attrs: { type: 'button' } });
  const copy = h('button', { class: 'btn', text: t('diag.copy'), attrs: { type: 'button' }, hidden: true });
  let report = '';
  fill(box, h('p', { class: 'meta', text: t('diag.intro') }), h('div', { class: 'row' }, start, copy), summary, list);
  const getDoc = async (path) => {
    const r = await fetch(MAK.BASE + path, { credentials: 'include', cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return new DOMParser().parseFromString(await r.text(), 'text/html');
  };
  async function go() {
    start.disabled = true;
    copy.hidden = true;
    summary.textContent = t('diag.running');
    const rows = new Map();
    fill(list, MAK.CHECKS.map((c) => {
      const li = h('li', { class: 'pending' }, h('span', { class: 'mark', text: '…' }), h('strong', { text: t(`check.${c.id}`) }), h('span', { class: 'meta' }));
      rows.set(c.id, li);
      return li;
    }));
    const ctx = { api: MAK.createApi({ fetch: (u, i) => fetch(u, i) }), now: Date.now(), getDoc, pm: MAK.createPm({ load: MAK.pmLoader((u, i) => fetch(u, i)) }) };
    const results = await MAK.runChecks(ctx, {
      onResult: (r) => {
        const li = rows.get(r.id);
        li.className = r.ok === true ? 'ok' : r.ok === false ? 'bad' : 'skip';
        li.firstChild.textContent = r.ok === true ? '✓' : r.ok === false ? '✗' : '–';
        li.lastChild.textContent = r.detail;
      }
    });
    const failed = results.filter((r) => r.ok === false).length;
    summary.textContent = failed ? t('diag.failed', { n: failed }) : t('diag.allOk', { n: results.length });
    const version = ext.runtime.getManifest ? ext.runtime.getManifest().version : '?';
    report = MAK.checksReport(results, { version, date: new Date().toISOString().slice(0, 16).replace('T', ' ') });
    copy.hidden = false;
    start.disabled = false;
    window.__checkResults = results;
    window.__checksDone = true;
  }
  start.addEventListener('click', go);
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(report);
      copy.textContent = t('diag.copied');
      setTimeout(() => { copy.textContent = t('diag.copy'); }, 1500);
    } catch {}
  });
  if (auto) go();
}

// The optional permission for the exam calendars. Only a page of the extension can ask for it
// (not a content script), and only after a click.
async function runExamPermission() {
  const box = $('perm');
  box.hidden = false;
  $('title').textContent = t('perm.examsTitle');
  const status = MAK.h('p', { class: 'status', attrs: { role: 'status' } });
  const grant = MAK.h('button', { class: 'btn primary', text: t('perm.examsGrant'), attrs: { type: 'button' } });
  const done = (ok) => {
    status.textContent = t(ok ? 'perm.examsDone' : 'perm.examsDenied');
    grant.hidden = ok;
  };
  grant.addEventListener('click', async () => {
    let ok = false;
    try {
      ok = await ext.permissions.request(MAK.EXAMS_PERMISSION);
    } catch {}
    done(ok);
  });
  MAK.fill(box, MAK.h('p', { text: t('perm.examsHelp') }), MAK.h('div', { class: 'row' }, grant), status);
  try {
    if (await ext.permissions.contains(MAK.EXAMS_PERMISSION)) done(true);
  } catch {}
}

// ---- Import the settings ---------------------------------------------------------------

// tools.html?import: a file of "Exportar mi configuración" in place of the settings (a page, not the popup: the popup
// closes when the window of the files opens). The file is checked (MAK.configImport), then a question with how many
// settings change, and only "Importar" changes them (the background checks them again).
async function runImport() {
  const { h, fill } = MAK;
  const box = $('import');
  box.hidden = false;
  $('title').textContent = t('config.importTitle');
  document.title = t('config.importTitle');
  const file = h('input', { attrs: { type: 'file', accept: '.json,application/json', 'aria-label': t('config.importPick') } });
  const ask = h('div', { hidden: true });
  const status = h('p', { class: 'status', attrs: { role: 'status' } });
  const reset = () => {
    fill(ask);
    ask.hidden = true;
  };
  file.addEventListener('change', async () => {
    reset();
    status.textContent = '';
    const f = file.files && file.files[0];
    const got = f && f.size <= 1e6 ? MAK.configImport(await f.text().catch(() => '')) : null;
    if (!got) {
      status.textContent = t('config.importBad');
      return;
    }
    const cur = await ext.storage.local.get(['settings', 'pageUi', 'sitePhotos']);
    const n = MAK.configChanges(cur, MAK.configMerge(cur, got.file));
    if (!n) {
      status.textContent = t('config.importSame');
      return;
    }
    const no = h('button', { class: 'btn', text: t('config.importNo'), attrs: { type: 'button' } });
    const yes = h('button', { class: 'btn primary', text: t('config.importYes'), attrs: { type: 'button' } });
    no.addEventListener('click', () => {
      reset();
      file.value = '';
    });
    yes.addEventListener('click', async () => {
      yes.disabled = no.disabled = true;
      const r = await MAK.safeCall(() => ext.runtime.sendMessage({ type: 'importSettings', file: got.file }), null);
      reset();
      status.textContent = t(r && r.ok ? 'config.importDone' : 'config.importError');
    });
    const date = got.exported ? MAK.formatDate(Date.parse(got.exported)) : '?';
    fill(ask, h('p', { text: t('config.importAsk', { n, date, version: got.version || '?' }) }), h('div', { class: 'row' }, no, yes));
    ask.hidden = false;
    no.focus();
  });
  fill(box, h('p', { text: t('config.importHelp') }), file, ask, status);
}

// ---- Welcome and changes ----------------------------------------------------------------

// tools.html?welcome: after the install. What the extension does, the first steps, why it asks for
// each permission, the privacy, and the links of help.
function helpLinks() {
  const version = ext.runtime.getManifest ? ext.runtime.getManifest().version : '';
  const browser = MAK.browserName(navigator.userAgent, !!navigator.brave);
  const lang = MAK.getLang();
  const a = (text, href) => MAK.h('a', { class: 'btn', text, href });
  return MAK.h('div', { class: 'row help-links' },
    a(t('help.bug'), MAK.issueUrl({ kind: 'bug', version, browser, lang })),
    a(t('help.idea'), MAK.issueUrl({ kind: 'idea', version, browser, lang })),
    a(t('help.coffee'), MAK.COFFEE_URL),
    a(t('help.code'), MAK.REPO_URL));
}

function runWelcome() {
  const h = MAK.h;
  const box = $('welcome');
  box.hidden = false;
  $('title').textContent = t('welcome.title');
  document.title = t('welcome.title');
  const list = (keys, tag = 'ul') => h(tag, null, keys.map((k) => h('li', { text: t(k, { key: MAK.searchKey() }) })));
  const perms = [
    ['welcome.permMia', 'welcome.permMiaWhy'],
    ['welcome.permSso', 'welcome.permSsoWhy'],
    ['welcome.permWeb', 'welcome.permWebWhy'],
    ['welcome.permNotes', 'welcome.permNotesWhy'],
    ['welcome.permExams', 'welcome.permExamsWhy'],
    ['welcome.permSend', 'welcome.permSendWhy'],
    ['welcome.permSigma', 'welcome.permSigmaWhy']
  ];
  MAK.fill(box,
    h('p', { text: t('welcome.intro') }),
    h('h2', { text: t('welcome.start') }),
    list(['welcome.step1', 'welcome.step2', 'welcome.step3', 'welcome.step4'], 'ol'),
    h('div', { class: 'row' }, h('a', { class: 'btn primary', text: t('welcome.open'), href: `${MAK.BASE}/portal` })),
    h('h2', { text: t('welcome.does') }),
    list(['welcome.f1', 'welcome.f2', 'welcome.f3', 'welcome.f4', 'welcome.f5', 'welcome.f6', 'welcome.f7', 'welcome.f8', 'welcome.f9', 'welcome.f10']),
    h('h2', { text: t('welcome.perms') }),
    h('dl', { class: 'perm' }, perms.map(([k, why]) => [h('dt', { text: t(k) }), h('dd', { text: t(why) })])),
    h('h2', { text: t('privacy.title') }),
    h('p', null, t('welcome.privacy'), ' ', h('a', { text: t('welcome.privacyLink'), href: MAK.PRIVACY_URL })),
    h('p', { class: 'meta', text: t('welcome.notOfficial') }),
    h('h2', { text: t('help.section') }),
    helpLinks());
}

// tools.html?news: the changes of the versions (MAK.CHANGES), the newest first.
function runNews() {
  const h = MAK.h;
  const box = $('welcome');
  box.hidden = false;
  $('title').textContent = t('whatsnew.title');
  document.title = t('whatsnew.title');
  const lang = MAK.getLang();
  MAK.fill(box,
    MAK.CHANGES.map((c) => [h('h2', { text: t('whatsnew.version', { version: c.version }) }), h('ul', null, (c[lang] || c.es).map((x) => h('li', { text: x.replace('{key}', MAK.searchKey()) })))]),
    h('p', null, h('a', { text: t('whatsnew.all'), href: `${MAK.REPO_URL}/releases` })),
    h('h2', { text: t('help.section') }),
    helpLinks());
}

// ---- The history of the tasks and the exams ---------------------------------------------------------
// The kept history at once, then a new reading (the background script; the page draws it again when it changes).
// By academic year, then by subject; a task with its state, its submission, its grade, the comment of the
// teacher and the files of the user; an exam with its state. A filter: all, the tasks, the exams.
async function runHistory() {
  const h = MAK.h;
  const box = $('history');
  box.hidden = false;
  $('title').textContent = t('history.title');
  document.title = t('history.title');
  const status = h('p', { class: 'status meta', attrs: { role: 'status' } });
  const refresh = h('button', { class: 'btn', attrs: { type: 'button' }, text: t('history.refresh') });
  // The filters, at the right of the summary: the type, the academic year and the subject (these two from the data).
  const option = (value, text) => h('option', { attrs: { value }, text });
  const kind = h('select', { attrs: { 'aria-label': t('history.filter') } }, ['all', 'task', 'exam'].map((k) => option(k, t(`history.show.${k}`))));
  const year = h('select', { attrs: { 'aria-label': t('history.filterYear') } });
  const subject = h('select', { attrs: { 'aria-label': t('history.filterSubject') } });
  const setOptions = (sel, all, values) => {
    const keep = sel.value;
    MAK.fill(sel, option('', all), values.map(([value, text]) => option(value, text)));
    sel.value = values.some(([value]) => value === keep) ? keep : '';
  };
  const summary = h('p', { class: 'history-summary' });
  // What is older than the update of MiAulario to Sakai 25 cannot come back (RESEARCH.md): the notice says it.
  const before = h('p', { class: 'notice history-before' });
  const list = h('div', { class: 'history' });
  // One button for all the subjects: "Expandir todo" when all of them are closed, else "Colapsar todo".
  const fold = h('button', { class: 'btn', attrs: { type: 'button' } });
  const subjectBoxes = () => [...list.querySelectorAll('details.history-card')];
  const foldLabel = () => {
    const boxes = subjectBoxes();
    fold.hidden = !boxes.length;
    fold.textContent = t(boxes.some((d) => d.open) ? 'history.collapseAll' : 'history.expandAll');
  };
  fold.addEventListener('click', () => {
    const open = !subjectBoxes().some((d) => d.open);
    for (const d of subjectBoxes()) d.open = open;
    foldLabel();
  });
  // The cards that the user opened: they stay open in a new drawing (the reading of MiAulario, a filter).
  const openKeys = new Set();
  list.addEventListener('toggle', (e) => { // "toggle" does not bubble: in the capture
    const d = e.target;
    if (d.matches && d.matches('details.history-card')) {
      if (d.open) openKeys.add(d.dataset.key);
      else openKeys.delete(d.dataset.key);
    }
    foldLabel();
  }, true);
  MAK.fill(box, h('p', { class: 'meta', text: t('history.help') }), before,
    h('div', { class: 'history-head' }, summary, h('div', { class: 'history-bar' }, kind, year, subject, refresh, fold)), status, list);

  const when = (ms) => (ms ? MAK.formatDate(ms) : '–');
  const STATE = { submitted: 'ok', late: 'warn', missed: 'bad', pending: 'info', unknown: '', sent: 'ok', noRecord: '' };
  let data = {};
  function draw() {
    const now = Date.now();
    const items = Object.values((data.history && data.history.items) || {});
    const grades = MAK.officialGrades(data.record);
    const mine = new Set((data.sites || []).map((s) => s.id)); // the sites of the user now: a link to the item
    const tasks = items.filter((it) => it.kind === 'task');
    const exams = items.filter((it) => it.kind === 'exam');
    // The first item that MiAulario kept for this user: the earliest start of the panel "Tareas".
    const first = Math.min(...items.map((it) => it.starts || Infinity));
    const firstDay = Number.isFinite(first) ? new Date(first).toLocaleDateString(MAK.locale(), { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    before.textContent = [t('history.before'), firstDay ? t('history.firstSaved', { date: firstDay }) : null, t(data.record ? 'history.beforeGrades' : 'history.noRecord')].filter(Boolean).join(' ');
    summary.textContent = items.length || grades.length ? [
      items.length ? t('history.tasks', { n: tasks.length, submitted: tasks.filter((it) => ['submitted', 'late'].includes(MAK.historyStatus(it, now))).length }) : null,
      items.length ? t('history.exams', { n: exams.length, sent: exams.filter((it) => it.complete).length }) : null,
      grades.length ? t('history.officialCount', { n: grades.length }) : null
    ].filter(Boolean).join(' · ') : '';
    // By year and by subject: a subject of MiAulario and of SIGMA are one by the code of the subject
    // ("2025_0_240610_1_G" in MiAulario, "240610" in SIGMA); a site without it, by its name.
    const codeOf = (siteId) => (/^\d{4}_\d+_(\d+)_/.exec(siteId || '') || [])[1] || null;
    const years = new Map();
    const names = new Map(); // all the subjects of all the years, for the filter
    const subjectOf = (y, key, name) => {
      if (!years.has(y)) years.set(y, new Map());
      const subjects = years.get(y);
      if (!subjects.has(key)) subjects.set(key, { name, items: [], grade: null });
      if (!names.has(key)) names.set(key, name);
      return subjects.get(key);
    };
    for (const it of items) {
      if (kind.value !== 'all' && it.kind !== kind.value) continue;
      const name = MAK.shortTitle(it.siteTitle || it.siteId);
      subjectOf(MAK.academicYear(it), codeOf(it.siteId) || name, name).items.push(it);
    }
    // The official grades: all of them with "Todo"; with a filter of the type, only next to the subjects that it shows.
    for (const g of grades) {
      const s = kind.value === 'all' ? subjectOf(g.year, g.code, MAK.shortTitle(g.name)) : years.has(g.year) && years.get(g.year).get(g.code);
      if (s) s.grade = g;
    }
    setOptions(year, t('history.allYears'), [...years.keys()].sort().reverse().map((y) => [y, t('history.year', { year: y })]));
    setOptions(subject, t('history.allSubjects'), [...names].sort(([, a], [, b]) => a.localeCompare(b, 'es')));
    if (!years.size) {
      MAK.fill(list, data.history ? h('p', { class: 'empty', text: t('history.empty') }) : null);
      foldLabel();
      return;
    }
    const word = (s) => s.charAt(0).toLocaleUpperCase('es') + s.slice(1).toLocaleLowerCase('es');
    const gradeText = (g) => [g.grade ? word(g.grade) : null, g.mark !== null ? g.mark.toLocaleString(MAK.locale()) : null].filter(Boolean).join(' ');
    const official = (g) => h('p', { class: 'history-official meta' },
      h('strong', { text: t('history.official') }), ' ',
      [gradeText(g), g.call || null, g.credits !== null ? t('history.credits', { n: g.credits.toLocaleString(MAK.locale()) }) : null].filter(Boolean).join(' · '));
    // A row as a line of a list of invoices: the type, the date, the title, the submission, the grade, the state and
    // the buttons (the files and the comment of the teacher below it; the item in MiAulario).
    const cell = (cls, main, label) => h('div', { class: `history-cell ${cls}` }, h('strong', { text: main }), h('span', { class: 'history-label', text: label }));
    const row = (it) => {
      const state = MAK.historyStatus(it, now);
      const d = it.detail || {};
      const f = d.feedback || {};
      const link = it.url && mine.has(it.siteId) ? it.url : null;
      const files = d.files && d.files.length ? h('p', { class: 'history-files' }, h('strong', { text: t('history.files') }), ' ', d.files.map((x, i) => [i ? ' · ' : '', h('a', { href: x.url, text: x.name })])) : null;
      const comment = f.comment ? h('div', null, h('strong', { text: t('history.comment') }), h('p', { class: 'history-comment', text: f.comment })) : null;
      const more = files || comment ? h('div', { class: 'history-more', hidden: true }, files, comment) : null;
      const toggle = more ? h('button', { class: 'history-icon', attrs: { type: 'button', 'aria-expanded': 'false', title: t('history.more'), 'aria-label': t('history.more') } }, MAK.icon('chevron')) : null;
      if (toggle) toggle.addEventListener('click', () => {
        more.hidden = !more.hidden;
        toggle.setAttribute('aria-expanded', String(!more.hidden));
      });
      return h('li', { class: 'history-row' },
        h('span', { class: 'history-kind', text: t(it.kind === 'task' ? 'history.task' : 'history.exam') }),
        cell('due', when(it.due), t('history.dueLabel')),
        h('div', { class: 'history-cell name' }, link ? h('a', { class: 'history-title', href: link, text: it.title }) : h('span', { class: 'history-title', text: it.title })),
        cell('sent', d.date ? when(d.date) : '–', t('history.sentLabel')),
        cell('grade', f.grade || '–', t('history.gradeLabel')),
        h('span', { class: `history-pill ${STATE[state]}`, text: t(`history.state.${state}`) }),
        h('div', { class: 'history-actions' }, toggle,
          link ? h('a', { class: 'history-icon', href: link, title: t('history.open'), attrs: { 'aria-label': t('history.open') } }, MAK.icon('arrow')) : null),
        more);
    };
    const shownYears = [...years.keys()].filter((y) => !year.value || y === year.value).sort().reverse();
    MAK.fill(list, shownYears.map((y) => {
      const subjects = [...years.get(y).entries()].filter(([key]) => !subject.value || key === subject.value);
      if (!subjects.length) return null;
      return h('section', { class: 'history-year' },
        h('h2', { text: t('history.year', { year: y }) }),
        subjects.sort(([, a], [, b]) => a.name.localeCompare(b.name, 'es')).map(([key, s]) => {
          const its = s.items.sort((a, b) => (b.due || b.starts || 0) - (a.due || a.starts || 0));
          const g = s.grade;
          return h('details', { class: 'history-card', attrs: { 'data-key': `${y}|${key}`, open: openKeys.has(`${y}|${key}`) } },
            h('summary', null,
              h('span', { class: 'history-card-name', text: s.name }),
              its.length ? h('span', { class: 'history-count', text: t('history.count', { n: its.length }) }) : null,
              g ? h('span', { class: `history-pill ${g.passed ? 'ok' : /no presentad/i.test(g.grade) ? '' : 'bad'}`, text: gradeText(g) }) : null,
              h('span', { class: 'history-chevron' }, MAK.icon('chevron'))),
            g ? official(g) : null,
            its.length ? h('ul', { class: 'history-rows' }, its.map(row)) : null);
        }));
    }));
    if (!list.querySelector('.history-card')) MAK.fill(list, h('p', { class: 'empty', text: t('history.none') }));
    foldLabel();
  }
  async function load() {
    data = await ext.storage.local.get(['history', 'sites', 'record']);
    status.textContent = data.history ? t('history.updated', { ago: MAK.ago(data.history.at, Date.now()) }) : '';
    draw();
  }
  async function update() {
    refresh.disabled = true;
    status.textContent = t('history.reading');
    const r = await Promise.resolve(ext.runtime.sendMessage({ type: 'historyRefresh' })).catch(() => null);
    refresh.disabled = false;
    await load();
    if (!r || r.error) status.textContent = t((r && r.error) || 'history.network');
  }
  for (const sel of [kind, year, subject]) sel.addEventListener('change', draw);
  refresh.addEventListener('click', update);
  await load();
  update();
}

async function init() {
  const store = await ext.storage.local.get(['settings', 'sites', 'pages', 'assignments', 'sakaiMode']);
  store.sites = MAK.namedSites(store.sites, MAK.withDefaults(store.settings));
  const { settings, sites } = store;
  MAK.setLang(MAK.withDefaults(settings).lang);
  const prefs = MAK.withDefaults(settings);
  const theme = MAK.applyPageTheme(document, prefs.theme, null, MAK.pageScheme(prefs.colorMode, store.sakaiMode));
  try {
    localStorage.setItem('mak.theme', theme.id);
    localStorage.setItem('mak.scheme', theme.scheme);
  } catch {}
  MAK.applyI18n(document);
  const params = new URLSearchParams(location.search);
  const siteId = params.get('zip');
  if (siteId !== null) {
    const site = (sites || []).find((s) => s.id === siteId);
    if (!site) {
      $('zip').hidden = false;
      $('zip-status').textContent = t('zip.noSite');
      return;
    }
    await runZip(siteId, site);
  } else if (params.has('ics')) {
    await runIcs(store);
  } else if (params.has('check')) {
    runChecks(params.has('auto'));
  } else if (params.has('welcome')) {
    runWelcome();
  } else if (params.has('news')) {
    runNews();
  } else if (params.get('perm') === 'exams') {
    await runExamPermission();
  } else if (params.has('history')) {
    await runHistory();
  } else if (params.has('import')) {
    await runImport();
  }
}

init();
