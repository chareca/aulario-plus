// MiAulario Keep-Alive: storage keys, default values and one write queue.
// Only the background script writes. Other parts read and send messages.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  MAK.defaultSettings = function () {
    return {
      syncEnabled: true,
      badge: { enabled: true, deliveries: true, announcements: true, messages: true, forums: false },
      hiddenSites: [],
      hiddenMode: 'everywhere', // 'everywhere' or 'sidebar'
      lang: 'es' // 'es' (default) or 'en'
    };
  };

  // Merge the saved settings with the default values.
  MAK.withDefaults = function (saved) {
    const d = MAK.defaultSettings();
    const s = saved && typeof saved === 'object' ? saved : {};
    return {
      syncEnabled: s.syncEnabled !== false,
      badge: Object.assign(d.badge, s.badge || {}),
      hiddenSites: Array.isArray(s.hiddenSites) ? s.hiddenSites.filter((x) => typeof x === 'string') : [],
      hiddenMode: s.hiddenMode === 'sidebar' ? 'sidebar' : 'everywhere',
      lang: s.lang === 'en' ? 'en' : 'es'
    };
  };

  // Sites that the extension must not show (if the user selected "everywhere").
  MAK.hiddenEverywhere = function (settings) {
    return new Set(settings.hiddenMode === 'everywhere' ? settings.hiddenSites : []);
  };

  // Keys that contain course data or reading state. The extension removes them
  // when the user logs out or when a different user logs in.
  MAK.DATA_KEYS = [
    'sites', 'pages', 'assignments', 'announcements', 'notifications', 'synoptic', 'forums',
    'firstSeen', 'visits', 'forumSnap', 'readAnn', 'pendingMarkViewed', 'last', 'log'
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
