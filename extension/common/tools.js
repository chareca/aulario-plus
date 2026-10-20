// Aulario Plus: the tools page (a tab of the extension).
//   tools.html?zip=<siteId>   download all the files of a site as one ZIP
//   tools.html?ics=1          export the deliveries and the calendar events as an .ics file
//   tools.html?check=1        the MiAulario checks (diagnostic); "&auto=1" starts them at once
//   tools.html?perm=exams     the permission to read the exam calendars (www2.unavarra.es)
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
  const data = r.ok && !/text\/html/i.test(type) ? new Uint8Array(await r.arrayBuffer()) : null;
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

// ---- Welcome and changes ----------------------------------------------------------------

// tools.html?welcome: after the install. What the extension does, the first steps, why it asks for
// each permission, the privacy, and the links of help.
function helpLinks() {
  const version = ext.runtime.getManifest ? ext.runtime.getManifest().version : '';
  const browser = MAK.browserName(navigator.userAgent, !!navigator.brave);
  const lang = MAK.getLang();
  const a = (text, href) => MAK.h('a', { class: 'btn', text, href });
  return MAK.h('div', { class: 'row help-links' },
    a(`🐞 ${t('help.bug')}`, MAK.issueUrl({ kind: 'bug', version, browser, lang })),
    a(`💡 ${t('help.idea')}`, MAK.issueUrl({ kind: 'idea', version, browser, lang })),
    a(`☕ ${t('help.coffee')}`, MAK.COFFEE_URL),
    a(`</> ${t('help.code')}`, MAK.REPO_URL));
}

function runWelcome() {
  const h = MAK.h;
  const box = $('welcome');
  box.hidden = false;
  $('title').textContent = t('welcome.title');
  document.title = t('welcome.title');
  const list = (keys, tag = 'ul') => h(tag, null, keys.map((k) => h('li', { text: t(k) })));
  const perms = [
    ['welcome.permMia', 'welcome.permMiaWhy'],
    ['welcome.permSso', 'welcome.permSsoWhy'],
    ['welcome.permWeb', 'welcome.permWebWhy'],
    ['welcome.permNotes', 'welcome.permNotesWhy'],
    ['welcome.permExams', 'welcome.permExamsWhy'],
    ['welcome.permSend', 'welcome.permSendWhy']
  ];
  MAK.fill(box,
    h('p', { text: t('welcome.intro') }),
    h('h2', { text: t('welcome.start') }),
    list(['welcome.step1', 'welcome.step2', 'welcome.step3', 'welcome.step4'], 'ol'),
    h('div', { class: 'row' }, h('a', { class: 'btn primary', text: t('welcome.open'), href: `${MAK.BASE}/portal` })),
    h('h2', { text: t('welcome.does') }),
    list(['welcome.f1', 'welcome.f2', 'welcome.f3', 'welcome.f4', 'welcome.f5', 'welcome.f6']),
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
    MAK.CHANGES.map((c) => [h('h2', { text: t('whatsnew.version', { version: c.version }) }), h('ul', null, (c[lang] || c.es).map((x) => h('li', { text: x })))]),
    h('p', null, h('a', { text: t('whatsnew.all'), href: `${MAK.REPO_URL}/releases` })),
    h('h2', { text: t('help.section') }),
    helpLinks());
}

async function init() {
  const store = await ext.storage.local.get(['settings', 'sites', 'pages', 'assignments']);
  store.sites = MAK.namedSites(store.sites, MAK.withDefaults(store.settings));
  const { settings, sites } = store;
  MAK.setLang(MAK.withDefaults(settings).lang);
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
  }
}

init();
