// Aulario Plus: the theme of the popup and of the tools page before the first paint. The settings come
// later (popup.js, tools.js); until then, the last theme and mode that this browser used (localStorage).
(function () {
  'use strict';
  let id = null;
  let scheme = null;
  try {
    id = localStorage.getItem('mak.theme');
    scheme = localStorage.getItem('mak.scheme');
  } catch {}
  MAK.applyPageTheme(document, id, null, scheme);
})();
