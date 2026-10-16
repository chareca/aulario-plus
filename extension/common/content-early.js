// Aulario Plus: content script at document_start. Hide the sites that the user selected,
// before the page shows them (no flash). The style changes at once when the settings change.
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const STYLE_ID = 'mak-hide-sites';

  function currentSite() {
    const where = MAK.parsePortalPath(location.pathname);
    return where && where.siteId ? where.siteId : null;
  }

  function apply(saved) {
    const css = MAK.hideSitesCss(MAK.withDefaults(saved).hiddenSites, currentSite());
    let el = document.getElementById(STYLE_ID);
    if (!css) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      (document.head || document.documentElement).append(el);
    }
    el.textContent = css;
  }

  Promise.resolve(ext.storage.local.get('settings')).then((d) => apply(d && d.settings)).catch(() => {});
  ext.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) apply(changes.settings.newValue);
  });
})();
