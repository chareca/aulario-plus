// Aulario Plus: storage keys, default values and one write queue.
// Only the background script writes. Other parts read and send messages.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

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
      examCalendar: false // the calendar of the exams in Mi sitio and in the sites (MAK.examCalendar)
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
      hiddenSites: Array.isArray(s.hiddenSites) ? [...new Set(s.hiddenSites.filter((x) => typeof x === 'string'))].slice(0, 500) : [],
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
      examCalendar: 'examCalendar' in s ? !!s.examCalendar : d.examCalendar
    };
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
  // The keys of the user that stay after a logout and go when a different user logs in: the official grades and the
  // history of the tasks and the exams (lib/history.js).
  MAK.USER_KEYS = [...MAK.RECORD_KEYS, 'history'];
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
