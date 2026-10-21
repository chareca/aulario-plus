// Aulario Plus: content script at document_start.
// 1. Hide the sites that the user selected, before the page shows them (no flash).
// 2. Show the names of the sites (short names or names from the user) in place of the full titles.
// Both change at once when the settings change.
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const STYLE_ID = 'mak-hide-sites';

  function currentSite() {
    const where = MAK.parsePortalPath(location.pathname);
    return where && where.siteId ? where.siteId : null;
  }

  function hideSites(settings) {
    const css = MAK.hideSitesCss(settings.hiddenSites, currentSite());
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

  // ---- Names of the sites ------------------------------------------------------
  // MiAulario shows a site in three forms:
  // - The full title, for example in the page header and in the tab title.
  // - The title without the code ("ANÁLISIS DE DATOS"), for example in the sidebar.
  // - Other text in an element with the full title in its "title" attribute.
  // Only the text of a text node changes. "done" keeps the original text of each changed node,
  // so that a new setting can change it again or undo it. The text of fields, editors and
  // scripts does not change, and a title inside a longer text changes only in its full form.
  const SKIP = 'script, style, textarea, noscript, [contenteditable]';
  const MIN_TEXT = 6;
  const done = new WeakMap(); // text node -> { base, shown }
  const oneLine = (s) => s.replace(/\s+/g, ' ').trim();
  let pairs = []; // [full title, name], the longest title first
  let byFull = new Map(); // full title -> name
  let byRest = new Map(); // title without the code -> name

  function rename(text, node) {
    const key = oneLine(text);
    const keep = (name) => text.match(/^\s*/)[0] + name + text.match(/\s*$/)[0];
    for (let el = node.parentElement, i = 0; el && i < 2; el = el.parentElement, i++) {
      const title = el.getAttribute('title');
      if (title && byFull.has(title) && oneLine(el.textContent) === oneLine(node.data)) return keep(byFull.get(title));
    }
    if (byRest.has(key)) return keep(byRest.get(key));
    let out = text;
    for (const [full, name] of pairs) if (out.includes(full)) out = out.split(full).join(name);
    // A title that MiAulario cuts: "26_0_240504_1 ANÁLISIS DE APLI..."
    const cut = out.length <= 300 && /^(\s*)(\S[\s\S]{11,}?)(?:\.\.\.|…)(\s*)$/.exec(out);
    if (cut) {
      const hit = pairs.find(([full]) => full.startsWith(cut[2]));
      if (hit) out = cut[1] + hit[1] + cut[3];
    }
    return out;
  }

  function renameNode(node) {
    const entry = done.get(node);
    if (entry && node.data !== entry.shown) done.delete(node); // the page changed the text
    const base = done.has(node) ? entry.base : node.data;
    if (!done.has(node) && (!pairs.length || base.length < MIN_TEXT)) return;
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP)) return;
    const shown = pairs.length ? rename(base, node) : base;
    if (shown !== base) {
      done.set(node, { base, shown });
      if (node.data !== shown) node.data = shown;
    } else if (done.has(node)) {
      done.delete(node);
      node.data = base;
    }
  }

  function renameTree(root) {
    if (root.nodeType === Node.TEXT_NODE) return renameNode(root);
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) renameNode(n);
  }

  function setNames(sites, settings) {
    const named = MAK.namedSites(sites, settings).filter((s) => s.fullTitle && s.title !== s.fullTitle);
    pairs = named.map((s) => [s.fullTitle, s.title]).sort((a, b) => b[0].length - a[0].length);
    byFull = new Map(pairs);
    byRest = new Map();
    for (const s of named) {
      const rest = oneLine(MAK.withoutCode(s.fullTitle));
      if (rest.length >= MIN_TEXT && rest !== oneLine(s.fullTitle)) byRest.set(rest, s.title);
    }
    renameTree(document);
  }

  new MutationObserver((records) => {
    if (!pairs.length) return;
    for (const r of records) {
      if (r.type === 'characterData') renameNode(r.target);
      else for (const n of r.addedNodes) renameTree(n);
    }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  // ---- Settings ------------------------------------------------------------------

  const state = { settings: MAK.withDefaults(null), sites: [] };
  function apply() {
    hideSites(state.settings);
    setNames(state.sites, state.settings);
  }

  MAK.safeCall(() => ext.storage.local.get(['settings', 'sites', 'paused']), null)
    .then((d) => {
      // All the data was deleted (the "Danger zone"): also the keys of the extension in this page.
      if (d && d.paused === 'reset') MAK.dropStorageKeys();
      state.settings = MAK.withDefaults(d && d.settings);
      state.sites = (d && d.sites) || [];
      apply();
    })
    .catch(() => {});
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(changes.settings || changes.sites)) return;
    if (changes.settings) state.settings = MAK.withDefaults(changes.settings.newValue);
    if (changes.sites) state.sites = changes.sites.newValue || [];
    apply();
  });
})();
