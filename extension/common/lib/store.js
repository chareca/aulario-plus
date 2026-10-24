// Aulario Plus: storage keys, default values and one write queue.
// Only the background script writes. Other parts read and send messages.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  // A key never changes its meaning or its type: files of «Exportar mi configuración» of other versions keep their
  // keys (MAK.configMerge takes a key only with the type of its default). A new meaning: a new key.
  MAK.defaultSettings = function () {
    return {
      syncEnabled: true,
      notifyGrades: true, // a system notification for a new grade
      notifyDue: true, // system notifications before a delivery that is not submitted
      dueOffsets: [1440, 60], // the minutes before the due time of these notifications (1 to 3)
      badge: { enabled: true, deliveries: true, announcements: true, messages: true, forums: false, grades: true },
      hiddenSites: [],
      hiddenMode: 'everywhere', // 'everywhere' or 'sidebar'
      lang: 'es', // 'es' (default) or 'en'
      targets: {}, // the target grade (0..10) of the calculator for each site
      searchShortcut: true, // Ctrl+K (⌘K) opens the search in MiAulario
      shortNames: true, // show "Análisis de Datos" for "26_0_240504_1 ANÁLISIS DE DATOS"
      nicknames: {}, // a name from the user for each site
      // Download links without a MiAulario login (Send). The user must enable them.
      links: { enabled: false, server: MAK.SEND_DEFAULT_SERVER, mode: 'password', downloads: 1, seconds: 86400 },
      degree: '', // the degree that the user selected (its base address), or '': the degree of the guides
      guideGrades: {}, // the grades of the calculator of each site: { siteId: { activity: 0..10 } }
      guideWeights: {}, // the weights that the user changed: { siteId: { activity: 0..100 } }
      forwardEmail: '', // the last address for the forward of the internal mail (content-forward.js)
      // The template of a message to a teacher (lib/teachers.js); an empty body is the default text.
      teacherSubject: '',
      teacherBody: '',
      theme: '', // the id of a theme (lib/themes.js); '' or an unknown id: the default theme
      colorMode: 'auto', // 'auto' (the light or dark theme of MiAulario, else of the system), 'light' or 'dark'
      confetti: true, // confetti after a submission of a task or an exam (lib/celebrate.js)
      rankBar: true, // the rank of the degree (lib/record.js) in the bar of MiAulario
      examCalendar: false, // the calendar of the exams in Mi sitio and in the sites (MAK.examCalendar)
      libraryCampus: 'arrosadia', // the library of "Horarios de la biblioteca" in Mi sitio (lib/library.js): arrosadia, salud or tudela
      mysiteLayout: MAK.cleanLayout(null) // the parts of the block "Aulario Plus" of Mi sitio (content-banner.js): MAK.cleanLayout
    };
  };

  MAK.SEND_DEFAULT_SERVER = 'https://send.vis.ee';
  // The Send servers that the user can select (the host permissions of the manifest name them).
  MAK.SEND_SERVERS = ['https://send.vis.ee', 'https://send.artemislena.eu', 'https://send.monks.tools'];
  MAK.LINK_MODES = ['key', 'password', 'long'];

  // The origin of a known Send server, or null.
  MAK.sendServerOrigin = function (v) {
    try {
      const origin = new URL(String(v).trim()).origin;
      return MAK.SEND_SERVERS.includes(origin) ? origin : null;
    } catch {
      return null;
    }
  };

  function cleanLinks(l, d) {
    const s = l && typeof l === 'object' && !Array.isArray(l) ? l : {};
    const int = (v, min, max, def) => (Number.isInteger(v) && v >= min && v <= max ? v : def);
    return {
      enabled: 'enabled' in s ? !!s.enabled : d.enabled,
      server: MAK.sendServerOrigin(s.server) || d.server,
      mode: MAK.LINK_MODES.includes(s.mode) ? s.mode : d.mode,
      downloads: int(s.downloads, 1, 1000, d.downloads),
      seconds: int(s.seconds, 60, 365 * 86400, d.seconds)
    };
  }

  // A name from the user: one line, no control or invisible characters, at most 40 characters.
  MAK.cleanName = function (v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40)
      .trim();
  };

  // A text of the user (the template of a message to a teacher): no control or invisible characters,
  // line breaks only if `lines`, at most `max` characters.
  MAK.cleanText = function (v, max, lines) {
    if (typeof v !== 'string') return '';
    const text = v
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, ' ')
      .slice(0, max);
    if (!lines) return text.replace(/\s+/g, ' ').trim();
    return text.replace(/ +$/gm, '').replace(/\s+$/, '');
  };

  // The grades (0..10) or the weights (0..100) of the calculator: at most 200 sites and 30 activities.
  function cleanGuideGrades(v, max = 10) {
    const out = {};
    if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
    for (const [site, grades] of Object.entries(v).slice(0, 200)) {
      if (site.length >= 300 || !grades || typeof grades !== 'object' || Array.isArray(grades)) continue;
      const g = {};
      for (const [k, n] of Object.entries(grades).slice(0, 30)) {
        if (k && k.length <= 200 && typeof n === 'number' && n >= 0 && n <= max) g[k] = n;
      }
      if (Object.keys(g).length) out[site] = g;
    }
    return out;
  }

  // The minutes before a due time for the reminders: 1 to 3 different times of the list, the
  // earliest first.
  const OFFSETS = [15, 30, 60, 120, 180, 360, 720, 1440, 2880, 4320, 10080];
  function cleanOffsets(v, def) {
    const list = Array.isArray(v) ? [...new Set(v.filter((m) => OFFSETS.includes(m)))].sort((a, b) => b - a).slice(0, 3) : [];
    return list.length ? list : def.slice();
  }

  const MAX_NICKNAMES = 200;
  function cleanNicknames(n) {
    const out = {};
    if (!n || typeof n !== 'object' || Array.isArray(n)) return out;
    for (const [k, v] of Object.entries(n)) {
      if (Object.keys(out).length >= MAX_NICKNAMES) break;
      const name = typeof v === 'string' && k.length < 300 ? MAK.cleanName(v) : '';
      if (name) out[k] = name;
    }
    return out;
  }

  const MAX_TARGETS = 200;
  function cleanTargets(t) {
    const out = {};
    if (!t || typeof t !== 'object' || Array.isArray(t)) return out;
    for (const [k, v] of Object.entries(t)) {
      if (Object.keys(out).length >= MAX_TARGETS) break;
      if (k.length < 300 && typeof v === 'number' && v >= 0 && v <= 10) out[k] = v;
    }
    return out;
  }

  // The only check of the settings: known keys only, correct types, and the default value
  // for a value that is missing or not correct.
  MAK.withDefaults = function (saved) {
    const d = MAK.defaultSettings();
    const s = saved && typeof saved === 'object' ? saved : {};
    const b = s.badge && typeof s.badge === 'object' ? s.badge : {};
    const badge = {};
    for (const k of Object.keys(d.badge)) badge[k] = k in b ? !!b[k] : d.badge[k];
    return {
      syncEnabled: 'syncEnabled' in s ? !!s.syncEnabled : d.syncEnabled,
      notifyGrades: 'notifyGrades' in s ? !!s.notifyGrades : d.notifyGrades,
      notifyDue: 'notifyDue' in s ? !!s.notifyDue : d.notifyDue,
      dueOffsets: cleanOffsets(s.dueOffsets, d.dueOffsets),
      badge,
      hiddenSites: Array.isArray(s.hiddenSites) ? [...new Set(s.hiddenSites.filter((x) => typeof x === 'string' && x.length < 300))].slice(0, 500) : [],
      hiddenMode: s.hiddenMode === 'sidebar' ? 'sidebar' : 'everywhere',
      lang: s.lang === 'en' ? 'en' : 'es',
      targets: cleanTargets(s.targets),
      searchShortcut: 'searchShortcut' in s ? !!s.searchShortcut : d.searchShortcut,
      shortNames: 'shortNames' in s ? !!s.shortNames : d.shortNames,
      nicknames: cleanNicknames(s.nicknames),
      links: cleanLinks(s.links, d.links),
      guideGrades: cleanGuideGrades(s.guideGrades),
      guideWeights: cleanGuideGrades(s.guideWeights, 100),
      degree: typeof s.degree === 'string' && /^https:\/\/www\.unavarra\.es\/sites\/grados\/[a-z0-9-]+\/[a-z0-9-]+$/.test(s.degree) ? s.degree : '',
      forwardEmail: typeof s.forwardEmail === 'string' && s.forwardEmail.length <= 200 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(s.forwardEmail) ? s.forwardEmail : '',
      teacherSubject: MAK.cleanText(s.teacherSubject, 200, false),
      teacherBody: MAK.cleanText(s.teacherBody, 3000, true),
      theme: typeof s.theme === 'string' && /^[a-z0-9-]{1,32}$/.test(s.theme) ? s.theme : '',
      colorMode: s.colorMode === 'light' || s.colorMode === 'dark' ? s.colorMode : 'auto',
      confetti: 'confetti' in s ? !!s.confetti : d.confetti,
      rankBar: 'rankBar' in s ? !!s.rankBar : d.rankBar,
      examCalendar: 'examCalendar' in s ? !!s.examCalendar : d.examCalendar,
      libraryCampus: ['arrosadia', 'salud', 'tudela'].includes(s.libraryCampus) ? s.libraryCampus : d.libraryCampus,
      mysiteLayout: MAK.cleanLayout(s.mysiteLayout)
    };
  };

  // The parts of the block "Aulario Plus" of Mi sitio: { order: all the parts (the missing ones after the others, in
  // their usual order), shape: 'rows' (one below the other), 'cols' (three columns), 'left' (the first one on the left of
  // the other two) or 'right' (the last one on the right of the other two) }.
  // Each part: the id of its host (the box of its content script, in the block: class "in-block") and the key of its
  // title. A new part of the block: a line here, so it is in the order of the user and in "Exportar mi configuración"
  // (tests/store.test.js checks that every box in the block is here). More than three parts: their shapes in BLOCK_CSS
  // of content-banner.js (else one below the other) and another name for "Tres columnas".
  MAK.MYSITE_HOSTS = {
    exams: { host: 'mak-shortcuts-host', title: 'short.exams' }, // content-shortcuts.js
    guides: { host: 'mak-guide-host', title: 'guide.allTitle' }, // content-guide.js
    hours: { host: 'mak-library-host', title: 'lib.title' } // content-library.js
  };
  MAK.MYSITE_PARTS = Object.keys(MAK.MYSITE_HOSTS);
  MAK.MYSITE_SHAPES = ['rows', 'cols', 'left', 'right'];
  MAK.cleanLayout = function (v) {
    const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    const order = Array.isArray(o.order) ? o.order.filter((k, i, all) => MAK.MYSITE_PARTS.includes(k) && all.indexOf(k) === i) : [];
    return { order: [...order, ...MAK.MYSITE_PARTS.filter((k) => !order.includes(k))], shape: MAK.MYSITE_SHAPES.includes(o.shape) ? o.shape : 'rows' };
  };

  // ---- "Tu configuración": a file with the settings, the open or closed boxes of Mi sitio and the photos of the
  // subjects. Export: the popup. Import: tools.html?import (a question first), then the background (importSettings).

  // The open or closed boxes of Mi sitio: { "mak-…": '1' | '0' } (MAK.uiSave), at most 500.
  const UI_KEY = /^mak-[\w:.~-]{1,200}$/;
  MAK.cleanUi = function (v) {
    const out = {};
    if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
    for (const [k, x] of Object.entries(v).slice(-500)) if (UI_KEY.test(k) && (x === '1' || x === '0')) out[k] = x;
    return out;
  };
  // The photo of each subject (MAK.assignSitePhotos): { siteId: 0..9 }, at most 500.
  MAK.cleanPhotos = function (v) {
    const out = {};
    if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
    const count = MAK.SITE_PHOTOS || 10;
    for (const [k, n] of Object.entries(v).slice(-500)) if (/^[\w~!.-]{1,100}$/.test(k) && Number.isInteger(n) && n >= 0 && n < count) out[k] = n;
    return out;
  };

  // A value of a file: a text without invisible or control characters (the line breaks stay), in one Unicode form,
  // without spaces at the ends; objects and lists cleaned inside (4 levels, 1000 items), without the keys that change
  // an object (__proto__…). null: not a value of JSON data.
  function cleanValue(v, depth = 0) {
    if (typeof v === 'string') return v.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g, '').trim();
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'boolean') return v;
    if (depth >= 4 || !v || typeof v !== 'object') return null;
    if (Array.isArray(v)) return v.slice(0, 1000).map((x) => cleanValue(x, depth + 1)).filter((x) => x !== null);
    const out = {};
    for (const [k, x] of Object.entries(v).slice(0, 1000)) {
      const key = cleanValue(k);
      if (!key || key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      const c = cleanValue(x, depth + 1);
      if (c !== null) out[key] = c;
    }
    return out;
  }
  const kindOf = (v) => (Array.isArray(v) ? 'list' : v === null ? 'null' : typeof v);
  // The keys of def that given has with the same type ("sí/no" only true or false, a list only a list…).
  const sameKind = (given, def) => Object.fromEntries(Object.keys(def).filter((k) => given && Object.hasOwn(given, k) && kindOf(given[k]) === kindOf(def[k])).map((k) => [k, given[k]]));

  // The file: { app, version, exported, settings, ui, sitePhotos }. data: the storage ({ settings, pageUi, sitePhotos }).
  MAK.configExport = (data, version, now) => ({
    app: 'Aulario Plus', version: String(version || ''), exported: now.toISOString(),
    settings: MAK.withDefaults(data && data.settings), ui: MAK.cleanUi(data && data.pageUi), sitePhotos: MAK.cleanPhotos(data && data.sitePhotos)
  });
  // Its name, with the date of the user: "aulario-plus-config-22-10-2026.json".
  MAK.configFileName = (now) => `aulario-plus-config-${[now.getDate(), now.getMonth() + 1].map((n) => String(n).padStart(2, '0')).join('-')}-${now.getFullYear()}.json`;
  // The text of a file -> { file: its parts, version, exported }, or null: not a file of Aulario Plus (another file, a
  // broken one, a big one). Its name does not count. MAK.configMerge checks its values.
  MAK.configImport = function (text) {
    try {
      if (typeof text !== 'string' || text.length > 1e6) return null;
      const o = JSON.parse(text.replace(/^\ufeff/, ''));
      if (!o || typeof o !== 'object' || cleanValue(o.app) !== 'Aulario Plus' || !o.settings || typeof o.settings !== 'object' || Array.isArray(o.settings)) return null;
      const version = typeof o.version === 'string' ? cleanValue(o.version).slice(0, 20) : '';
      const exported = typeof o.exported === 'string' && !Number.isNaN(Date.parse(o.exported)) ? o.exported : '';
      // Only the known values, cleaned: the message to the background is small and has no deep data.
      const settings = sameKind(cleanValue(o.settings), MAK.defaultSettings());
      // A theme that this version does not have (an older or newer one): the current theme stays. MAK.themeIds: the
      // pages (lib/themes.js), where the file is read.
      if (MAK.themeIds && settings.theme && !MAK.themeIds().includes(settings.theme)) delete settings.theme;
      return { file: { settings, ui: MAK.cleanUi(cleanValue(o.ui)), sitePhotos: MAK.cleanPhotos(cleanValue(o.sitePhotos)) }, version, exported };
    } catch {
      return null;
    }
  };
  // The storage after an import (the page shows how many change; the background writes it in one step). Only the known
  // settings of the file, cleaned, with the right type (also inside the badge and the links); a setting that is not in
  // the file, or not right, keeps its current value; then MAK.withDefaults checks each value. The boxes and the photos
  // of the file over the current ones. cur: { settings, pageUi, sitePhotos }; file: MAK.configImport(...).file.
  MAK.configMerge = function (cur, file) {
    const c = cur || {};
    const f = file && typeof file === 'object' ? file : {};
    const base = MAK.withDefaults(c.settings);
    const d = MAK.defaultSettings();
    const given = sameKind(cleanValue(f.settings), d);
    for (const k of ['badge', 'links']) if (given[k]) given[k] = Object.assign({}, base[k], sameKind(given[k], d[k]));
    return {
      settings: MAK.withDefaults(Object.assign({}, base, given)),
      pageUi: MAK.cleanUi(Object.assign({}, MAK.cleanUi(c.pageUi), MAK.cleanUi(cleanValue(f.ui)))),
      sitePhotos: MAK.cleanPhotos(Object.assign({}, MAK.cleanPhotos(c.sitePhotos), MAK.cleanPhotos(cleanValue(f.sitePhotos))))
    };
  };
  // How many values change from cur (the storage) to next (MAK.configMerge).
  MAK.configChanges = function (cur, next) {
    const diff = (a, b) => Object.keys(Object.assign({}, a, b)).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).length;
    const c = cur || {};
    return diff(MAK.withDefaults(c.settings), next.settings) + diff(MAK.cleanUi(c.pageUi), next.pageUi) + diff(MAK.cleanPhotos(c.sitePhotos), next.sitePhotos);
  };

  // Sites that the extension must not show (if the user selected "everywhere").
  MAK.hiddenEverywhere = function (settings) {
    return new Set(settings.hiddenMode === 'everywhere' ? settings.hiddenSites : []);
  };

  // CSS that hides sites in the sidebar, in the "all sites" view and in the favorites organizer.
  // The site that is open never hides.
  MAK.hideSitesCss = function (ids, currentSiteId) {
    const esc = (s) => String(s).replace(/[^a-zA-Z0-9_~!.-]/g, (c) => `\\${c.codePointAt(0).toString(16)} `);
    const selectors = [];
    for (const id of ids || []) {
      if (typeof id !== 'string' || !id || id === currentSiteId) continue;
      const v = esc(id);
      selectors.push(`li.site-list-item[data-site="${v}"]`, `li.fav-sites-entry:has(> [data-site-id="${v}"])`, `li.organize-favorite-item[data-site-id="${v}"]`);
    }
    return selectors.length ? `${selectors.join(',\n')} { display: none !important; }` : '';
  };

  // Keys that contain course data or reading state. The extension removes them
  // when the user logs out or when a different user logs in.
  MAK.DATA_KEYS = [
    'sites', 'pages', 'assignments', 'announcements', 'notifications', 'synoptic', 'forums',
    'visits', 'forumSnap', 'readAnn', 'pendingMarkViewed', 'grades', 'gradesSeenAt', 'events', 'guides', 'degree', 'exams', 'dueNotified', 'lessons', 'last', 'log' // "log": v1.1 data
  ];
  // The official grades of SIGMA (lib/record.js): they stay after a logout (the same user comes back: a new
  // reading needs the Expediente again), and they go when a different user logs in (lib/sync.js).
  MAK.RECORD_KEYS = ['record', 'recordTry', 'recordSeen'];
  // The keys of the user that stay after a logout and go when a different user logs in: the official grades, the
  // history of the tasks and the exams (lib/history.js), and the photo of each subject (MAK.assignSitePhotos).
  MAK.USER_KEYS = [...MAK.RECORD_KEYS, 'history', 'sitePhotos'];
  MAK.RESOURCE_PREFIX = 'res:';

  MAK.resourceKey = function (siteId) {
    return MAK.RESOURCE_PREFIX + siteId;
  };

  // A store with one queue. Each write waits for the previous write. A key is written
  // only if its value changed.
  MAK.createStore = function (area) {
    let queue = Promise.resolve();

    function enqueue(task) {
      const run = queue.then(task);
      queue = run.catch(() => {});
      return run;
    }

    async function writeChanged(values) {
      const keys = Object.keys(values);
      if (!keys.length) return;
      const current = await area.get(keys);
      const changed = {};
      for (const k of keys) {
        if (JSON.stringify(current[k]) !== JSON.stringify(values[k])) changed[k] = values[k];
      }
      if (Object.keys(changed).length) await area.set(changed);
    }

    return {
      get: (keys) => area.get(keys),
      set: (values) => enqueue(() => writeChanged(values)),
      remove: (keys) => enqueue(() => area.remove(keys)),
      // Read one key, change it with fn, and write it. fn can return a promise.
      update: (key, fn) =>
        enqueue(async () => {
          const cur = (await area.get(key))[key];
          const next = await fn(cur);
          if (next !== undefined) await writeChanged({ [key]: next });
          return next === undefined ? cur : next;
        }),
      // Run several reads and writes as one step.
      transaction: (fn) => enqueue(() => fn({ get: (k) => area.get(k), set: writeChanged, remove: (k) => area.remove(k) }))
    };
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
