// Aulario Plus: storage keys, default values and one write queue.
// Only the background script writes. Other parts read and send messages.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  MAK.defaultSettings = function () {
    return {
      syncEnabled: true,
      notifyGrades: true, // a system notification for a new grade
      badge: { enabled: true, deliveries: true, announcements: true, messages: true, forums: false, grades: true },
      hiddenSites: [],
      hiddenMode: 'everywhere', // 'everywhere' or 'sidebar'
      lang: 'es', // 'es' (default) or 'en'
      targets: {}, // the target grade (0..10) of the calculator for each site
      searchShortcut: true, // Ctrl+K (⌘K) opens the search in MiAulario
      shortNames: true, // show "Análisis de Datos" for "26_0_240504_1 ANÁLISIS DE DATOS"
      nicknames: {} // a name from the user for each site
    };
  };

  // A name from the user: one line, no control or invisible characters, at most 40 characters.
  MAK.cleanName = function (v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40)
      .trim();
  };

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
      badge,
      hiddenSites: Array.isArray(s.hiddenSites) ? [...new Set(s.hiddenSites.filter((x) => typeof x === 'string'))].slice(0, 500) : [],
      hiddenMode: s.hiddenMode === 'sidebar' ? 'sidebar' : 'everywhere',
      lang: s.lang === 'en' ? 'en' : 'es',
      targets: cleanTargets(s.targets),
      searchShortcut: 'searchShortcut' in s ? !!s.searchShortcut : d.searchShortcut,
      shortNames: 'shortNames' in s ? !!s.shortNames : d.shortNames,
      nicknames: cleanNicknames(s.nicknames)
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
    'visits', 'forumSnap', 'readAnn', 'pendingMarkViewed', 'grades', 'gradesSeenAt', 'events', 'last', 'log' // "log": v1.1 data
  ];
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
