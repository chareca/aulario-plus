// Aulario Plus: the theme of the parts of the extension in MiAulario (lib/themes.js). It reads the theme
// and the mode (light, dark, or as MiAulario) of the settings, loads the fonts of the theme in the page,
// and draws the styles of the parts again (MAK.refreshThemedStyles) when one of them changes: another
// theme or mode in the settings, the theme of MiAulario, or the setting of the system. It also tells the
// background the theme of MiAulario, for the popup (colorMode "auto").
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const url = (file) => ext.runtime.getURL(`fonts/${file}`);
  let dark = null; // the mode of the last drawing

  function redraw(force) {
    const now = MAK.isDarkPage();
    if (!force && now === dark) return;
    dark = now;
    MAK.refreshThemedStyles();
  }

  function apply(saved) {
    const s = MAK.withDefaults(saved);
    MAK.themeId = MAK.theme(s.theme).id;
    MAK.colorMode = s.colorMode;
    const title = document.getElementById('mak-block-title');
    if (title) title.textContent = MAK.brandName();
    MAK.loadPageFonts(MAK.themeId, url).catch(() => {});
    redraw(true);
  }

  // The theme of MiAulario: the class of <html> ("sakaiUserTheme-dark", "-light"), else the system.
  let reported = null;
  function report() {
    const c = document.documentElement.classList;
    const mode = c.contains('sakaiUserTheme-dark') ? 'dark' : c.contains('sakaiUserTheme-light') ? 'light' : 'system';
    if (mode === reported || !MAK.extensionAlive()) return;
    reported = mode;
    MAK.safeCall(() => ext.runtime.sendMessage({ type: 'pageMode', mode }), null);
  }

  MAK.safeCall(() => ext.storage.local.get('settings'), null).then((d) => apply(d && d.settings));
  ext.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings && MAK.extensionAlive()) apply(changes.settings.newValue);
  });
  report();
  new MutationObserver(() => {
    report();
    redraw(false);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => redraw(false));
})();
