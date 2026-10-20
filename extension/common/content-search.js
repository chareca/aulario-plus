// Aulario Plus: the search palette in MiAulario. Ctrl+K (⌘K on macOS) opens it, and closes it.
// The background script searches the stored data (a fuzzy finder, lib/search.js). The palette is in
// a closed shadow root. Without a query it shows the sites. The shortcut does not operate in a text
// field or in an editor: there, Ctrl+K adds a link.
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const DATE_TYPES = new Set(['delivery', 'event', 'announcement']);
  const h = MAK.h;

  // The look comes from the theme (lib/themes.js, MAK.themedStyle).
  const CSS = () => `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .backdrop { position: fixed; inset: 0; z-index: 2147483000; display: flex; justify-content: center; align-items: flex-start;
      padding-top: 12vh; background: var(--ap-backdrop); font: var(--ap-weight) calc(14px * var(--ap-zoom))/1.4 var(--ap-font); }
    .panel { width: min(640px, calc(100vw - 32px)); max-height: 70vh; display: flex; flex-direction: column; overflow: hidden;
      color: var(--ap-fg); background: var(--ap-win-bg); border: var(--ap-bw) solid var(--ap-edge); border-radius: var(--ap-radius); box-shadow: var(--ap-shadow-pop);
      -webkit-backdrop-filter: var(--ap-blur); backdrop-filter: var(--ap-blur); }
    input { font-family: var(--ap-font-head); font-weight: var(--ap-head-weight); font-style: var(--ap-head-style); letter-spacing: var(--ap-head-spacing);
      font-size: calc(20px * var(--ap-head-zoom)); padding: 12px 16px; border: 0; border-bottom: var(--ap-head-line); outline: none;
      color: inherit; background: transparent; caret-color: var(--ap-red); }
    input::placeholder { color: var(--ap-muted); opacity: 0.8; }
    .list { overflow: auto; padding: 2px 8px 8px; }
    h3 { font-family: var(--ap-font-head); font-weight: var(--ap-head-weight); font-style: var(--ap-head-style); font-size: calc(13px * var(--ap-head-zoom));
      color: var(--ap-muted); margin: 10px 8px 4px; }
    a.item { display: block; padding: 7px 10px; border-radius: var(--ap-radius-box); color: inherit; text-decoration: none; }
    a.item.sel { background: var(--ap-surface2); }
    .title { display: block; font-weight: 700; overflow-wrap: anywhere; }
    .meta { display: block; font-size: 0.86em; color: var(--ap-muted); }
    mark { background: var(--ap-mark-bg); color: var(--ap-mark-fg); }
    .empty { padding: 14px; color: var(--ap-muted); }
    .tip { padding: 8px 8px 0; font-size: 0.86em; color: var(--ap-muted); }
    .foot { font-size: 0.8em; color: var(--ap-muted); padding: 7px 14px; border-top: var(--ap-item-sep); }
  `;

  let enabled = true;
  let host = null; // the palette, while it is open
  let before = null; // the element with the focus before the palette

  function typing(e) {
    const el = e.composedPath()[0];
    return !!el && el.nodeType === 1 && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  }

  function close() {
    if (!host) return;
    host.remove();
    host = null;
    if (before && before.focus) before.focus();
  }

  function go(url, newTab) {
    const safe = MAK.safeHttpUrl(url);
    if (!safe) return;
    close();
    if (newTab || new URL(safe).origin !== location.origin) window.open(safe, '_blank', 'noopener');
    else location.assign(safe);
  }

  function open() {
    if (host) return;
    before = document.activeElement;
    host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = MAK.themedStyle(CSS());
    const input = h('input', { attrs: { type: 'search', placeholder: MAK.t('palette.label'), 'aria-label': MAK.t('palette.label'), autocomplete: 'off', spellcheck: 'false' } });
    const list = h('div', { class: 'list', attrs: { role: 'listbox', 'aria-label': MAK.t('palette.label') } });
    const panel = h(
      'div',
      { class: 'panel', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': MAK.t('palette.label') } },
      input,
      list,
      h('div', { class: 'foot', text: MAK.t('palette.keys', { mod: MAC ? '⌘' : 'Ctrl' }) })
    );
    const backdrop = h('div', { class: 'backdrop' }, panel);
    let results = [];
    let sel = 0;
    let ask = 0;
    let mouse = null; // the last position of the mouse

    function draw() {
      const empty = !input.value.trim();
      if (!results.length) return MAK.fill(list, h('div', { class: 'empty', text: empty ? MAK.t('palette.hint') : MAK.t('search.none', { q: input.value.trim() }) }));
      const order = [...new Set(results.map((x) => x.type))]; // the groups in the order of their best result
      const shown = order.flatMap((type) => results.filter((x) => x.type === type));
      results = shown;
      sel = Math.max(0, Math.min(sel, shown.length - 1));
      let i = 0;
      MAK.fill(
        list,
        empty ? h('div', { class: 'tip', text: MAK.t('palette.hint') }) : null,
        order.map((type) => [
          h('h3', { text: MAK.t(`search.type.${type}`) }),
          shown
            .filter((x) => x.type === type)
            .map((x) => {
              const n = i++;
              const more = DATE_TYPES.has(x.type) && x.time ? MAK.formatDate(x.time) : x.type === 'tool' || x.type === 'grade' ? null : x.meta;
              const site = x.type === 'site' ? [] : MAK.marked(x.site, x.siteHl);
              return h(
                'a',
                {
                  class: `item${n === sel ? ' sel' : ''}`,
                  attrs: { role: 'option', 'aria-selected': String(n === sel), href: MAK.safeHttpUrl(x.url) || '#' },
                  on: {
                    click: (e) => { e.preventDefault(); go(x.url, e.ctrlKey || e.metaKey); },
                    // The mouse selects only when it moves. The browser also sends "mousemove" when the
                    // list scrolls under the mouse, at the same position: that does not select.
                    mousemove: (e) => {
                      const at = `${e.clientX},${e.clientY}`;
                      const moved = mouse !== null && mouse !== at;
                      mouse = at;
                      if (moved && sel !== n) select(n, false);
                    }
                  }
                },
                h('span', { class: 'title' }, MAK.marked(x.title, x.hl)),
                h('span', { class: 'meta' }, site, site.length && more ? ' · ' : null, more)
              );
            })
        ])
      );
      const s = list.querySelector('.sel');
      if (s) s.scrollIntoView({ block: 'nearest' });
    }

    // Select a result. From the last result, "down" goes to the first, and "up" from the first goes
    // to the last.
    function select(n, scroll) {
      if (!results.length) return;
      sel = (n + results.length) % results.length;
      list.querySelectorAll('a.item').forEach((a, i) => {
        a.classList.toggle('sel', i === sel);
        a.setAttribute('aria-selected', String(i === sel));
      });
      const s = list.querySelector('.sel');
      if (s && scroll) s.scrollIntoView({ block: 'nearest' });
    }

    async function search() {
      const id = ++ask;
      const r = await MAK.safeCall(() => ext.runtime.sendMessage({ type: 'search', query: input.value }), null);
      if (id !== ask || !host) return; // an older answer
      results = (r && r.results) || [];
      sel = 0;
      draw();
    }

    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(search, 80);
    });
    // The keys stay in the palette: the page does not get them. Up and down: the arrows, and on macOS
    // also Ctrl+P and Ctrl+N (as in fzf and in the terminal; on Windows and Linux, Chrome does not
    // give Ctrl+N to the page). Page Up and Page Down: 5 results.
    panel.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const ctrl = MAC && e.ctrlKey && !e.metaKey && !e.altKey;
      const key = e.key.toLowerCase();
      const step = e.key === 'ArrowDown' || (ctrl && key === 'n') ? 1 : e.key === 'ArrowUp' || (ctrl && key === 'p') ? -1 : e.key === 'PageDown' ? 5 : e.key === 'PageUp' ? -5 : 0;
      if (e.key === 'Escape' || (key === 'k' && (MAC ? e.metaKey : e.ctrlKey))) {
        e.preventDefault();
        close();
      } else if (step) {
        e.preventDefault();
        const n = sel + step;
        // Page Up and Page Down stop at the ends.
        select(Math.abs(step) > 1 ? Math.max(0, Math.min(n, results.length - 1)) : n, true);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[sel]) go(results[sel].url, e.ctrlKey || e.metaKey);
      }
    });
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
    shadow.append(style, backdrop);
    document.documentElement.append(host);
    draw();
    input.focus();
    search(); // the sites
  }

  document.addEventListener(
    'keydown',
    (e) => {
      if (!enabled || e.key.toLowerCase() !== 'k' || !(MAC ? e.metaKey : e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (!MAK.extensionAlive()) return; // the extension was reloaded: the browser gets the shortcut
      if (host || typing(e)) return;
      e.preventDefault();
      e.stopPropagation();
      open();
    },
    true
  );

  function apply(saved) {
    const s = MAK.withDefaults(saved);
    enabled = s.searchShortcut;
    MAK.setLang(s.lang);
    if (!enabled) close();
  }
  MAK.safeCall(() => ext.storage.local.get('settings'), null).then((d) => apply(d && d.settings));
  ext.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) apply(changes.settings.newValue);
  });
})();
