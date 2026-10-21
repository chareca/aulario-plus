// Aulario Plus: confetti on the page of confirmation of a submission (lib/celebrate.js), if the setting
// "confetti" is on. It runs in each frame of MiAulario; the confetti covers the page of the tab (the top
// frame, when it is of MiAulario too). A submission fires once in a tab (sessionStorage).
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const found = MAK.submissionKind(document);
  if (!found || typeof window.confetti !== 'function' || typeof window.confetti.create !== 'function') return;
  try {
    const key = `mak-confetti:${found.key}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {}
  Promise.resolve(ext.storage.local.get('settings'))
    .catch(() => ({}))
    .then((d) => {
      if (!MAK.withDefaults(d && d.settings).confetti) return;
      let doc = document;
      try {
        if (window.top !== window && window.top.document.body) doc = window.top.document;
      } catch {}
      MAK.celebrate(found.kind, window.confetti.create, doc);
    });
})();
