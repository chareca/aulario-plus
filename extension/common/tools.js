// Aulario Plus: the tools page (a tab of the extension).
//   tools.html?zip=<siteId>   download all the files of a site as one ZIP
//   tools.html?ics=1          export the deliveries and the calendar events as an .ics file
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
  }
}

init();
