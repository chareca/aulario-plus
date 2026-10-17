// Aulario Plus: the search palette in MiAulario. Ctrl+K (⌘K on macOS) opens it.
// The background script searches the stored data. The palette is in a closed shadow root.
// The shortcut does not operate in a text field or in an editor: there, Ctrl+K adds a link.
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const DATE_TYPES = new Set(['delivery', 'event', 'announcement']);
  const h = MAK.h;

  const CSS = `
    :host { all: initial; }
    .backdrop { position: fixed; inset: 0; z-index: 2147483000; display: flex; justify-content: center; align-items: flex-start;
      padding-top: 12vh; background: rgba(0, 0, 0, 0.35); font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    .panel { width: min(640px, calc(100vw - 32px)); max-height: 70vh; display: flex; flex-direction: column; overflow: hidden;
      color: #1d2327; background: #fff; border-radius: 10px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3); }
    .dark .panel { color: #e8ecee; background: #1e2a28; }
    input { font: inherit; font-size: 16px; padding: 12px 14px; border: 0; border-bottom: 1px solid #e3e7ea; outline: none;
      color: inherit; background: transparent; }
    .dark input { border-bottom-color: #2e4440; }
    .list { overflow: auto; padding: 2px 6px 8px; }
    h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #5f6b73; margin: 10px 8px 4px; }
    .dark h3, .dark .meta, .dark .foot, .dark .empty { color: #9aa6ad; }
    a.item { display: block; padding: 6px 8px; border-radius: 6px; color: inherit; text-decoration: none; }
    a.item.sel { background: #e6f4ea; box-shadow: inset 3px 0 0 #10524e; }
    .dark a.item.sel { background: #2a3a37; box-shadow: inset 3px 0 0 #4fd1a5; }
    .title { display: block; font-weight: 600; overflow-wrap: anywhere; }
    .meta { display: block; font-size: 12px; color: #5f6b73; }
    .empty { padding: 14px; color: #5f6b73; }
    .foot { font-size: 11px; color: #5f6b73; padding: 6px 12px; border-top: 1px solid #e3e7ea; }
    .dark .foot { border-top-color: #2e4440; }
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
    const style = document.createElement('style');
    style.textContent = CSS;
    const input = h('input', { attrs: { type: 'search', placeholder: MAK.t('palette.label'), 'aria-label': MAK.t('palette.label'), autocomplete: 'off', spellcheck: 'false' } });
    const list = h('div', { class: 'list', attrs: { role: 'listbox', 'aria-label': MAK.t('palette.label') } });
    const panel = h(
      'div',
      { class: 'panel', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': MAK.t('palette.label') } },
      input,
      list,
      h('div', { class: 'foot', text: MAK.t('palette.keys', { mod: MAC ? '⌘' : 'Ctrl' }) })
    );
    const backdrop = h('div', { class: `backdrop${MAK.isDarkPage() ? ' dark' : ''}` }, panel);
    let results = [];
    let sel = 0;
    let ask = 0;

    function draw() {
      if (!input.value.trim()) return MAK.fill(list, h('div', { class: 'empty', text: MAK.t('palette.hint') }));
      if (!results.length) return MAK.fill(list, h('div', { class: 'empty', text: MAK.t('search.none', { q: input.value.trim() }) }));
      const order = [...new Set(results.map((x) => x.type))]; // the groups in the order of their best result
      const shown = order.flatMap((type) => results.filter((x) => x.type === type));
      results = shown;
      sel = Math.max(0, Math.min(sel, shown.length - 1));
      let i = 0;
      MAK.fill(
        list,
        order.map((type) => [
          h('h3', { text: MAK.t(`search.type.${type}`) }),
          shown
            .filter((x) => x.type === type)
            .map((x) => {
              const n = i++;
              const meta = [x.type === 'site' ? null : x.site, DATE_TYPES.has(x.type) && x.time ? MAK.formatDate(x.time) : x.type === 'tool' || x.type === 'grade' ? null : x.meta];
              return h(
                'a',
                {
                  class: `item${n === sel ? ' sel' : ''}`,
                  attrs: { role: 'option', 'aria-selected': String(n === sel), href: MAK.safeHttpUrl(x.url) || '#' },
                  on: { click: (e) => { e.preventDefault(); go(x.url, e.ctrlKey || e.metaKey); } }
                },
                h('span', { class: 'title', text: x.title }),
                h('span', { class: 'meta', text: meta.filter(Boolean).join(' · ') })
              );
            })
        ])
      );
      const s = list.querySelector('.sel');
      if (s) s.scrollIntoView({ block: 'nearest' });
    }

    async function search() {
      const id = ++ask;
      const r = await Promise.resolve(ext.runtime.sendMessage({ type: 'search', query: input.value })).catch(() => null);
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
    // The keys stay in the palette: the page does not get them.
    panel.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        sel += e.key === 'ArrowDown' ? 1 : -1;
        draw();
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
  }

  document.addEventListener(
    'keydown',
    (e) => {
      if (!enabled || e.key.toLowerCase() !== 'k' || !(MAC ? e.metaKey : e.ctrlKey) || e.altKey || e.shiftKey) return;
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
  Promise.resolve(ext.storage.local.get('settings')).then((d) => apply(d && d.settings)).catch(() => {});
  ext.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) apply(changes.settings.newValue);
  });
})();
