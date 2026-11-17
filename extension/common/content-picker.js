// Aulario Plus: the selector of sections (the top frame of MiAulario), as the picker of an ad blocker.
// "Eliminar secciones" in the settings of the popup starts it in this tab (the background: "pickSections"). The
// section under the pointer has a frame; a click on it asks, and then the section goes from all the sites and does not
// come back (the setting hiddenSections: content-early.js hides it; a part of the block of Mi sitio: mysiteLayout.hidden,
// as its ✕ in the organizer). A bar at the bottom (the titles of the sections are at the top) has the same sections in a list, for the keyboard, and "Salir"; Escape
// ends it too. The sections: the blocks of MiAulario (not a block that is alone on its page: it is the page) and the
// boxes of Aulario Plus. "Recuperar secciones eliminadas" in the settings brings them back.
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const h = MAK.h;
  const t = MAK.t;
  const send = (msg) => MAK.safeCall(() => ext.runtime.sendMessage(msg), null);
  const shown = (el) => !!el && el.getClientRects().length > 0;
  let end = null; // the selector is on: this ends it

  // The sections of the page that can go, a part before the block around it: { el, title, key or part }.
  function candidates() {
    const out = [];
    const tools = MAK.toolBlocks().filter(shown); // the last block on the screen stays
    if (tools.length > 1) for (const el of tools) out.push({ el, key: MAK.toolKey(el), title: MAK.toolTitle(el) });
    const block = document.getElementById('mak-block');
    if (shown(block)) {
      const parts = Object.entries(MAK.MYSITE_HOSTS).map(([part, x]) => ({ el: document.getElementById(x.host), part, title: t(x.title) })).filter((x) => shown(x.el) && block.contains(x.el));
      if (parts.length > 1) out.push(...parts); // the last part stays: the whole block goes
      out.push({ el: block, key: 'mak:block', title: t('pick.block') });
    }
    const guide = document.querySelector(MAK.MAK_SECTIONS.guide);
    if (shown(guide)) out.push({ el: guide, key: 'mak:guide', title: t('guide.title') });
    const news = document.querySelector(MAK.MAK_SECTIONS.news);
    if (shown(news)) out.push({ el: news, key: 'mak:news', title: t('news.titleFirst') });
    return out;
  }

  async function start() {
    if (end) return;
    const { settings } = (await MAK.safeCall(() => ext.storage.local.get('settings'), null)) || {};
    if (end) return;
    MAK.setLang(MAK.withDefaults(settings).lang);
    const host = document.createElement('div');
    host.id = 'mak-picker-host';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = MAK.themedStyle(`:host { all: initial; }
      .bar { position: fixed; z-index: 2147482000; bottom: 14px; left: 50%; transform: translateX(-50%); box-sizing: border-box; max-width: calc(100vw - 20px);
        display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center; padding: 10px 14px;
        font: var(--ap-weight) calc(14px * var(--ap-zoom))/1.4 var(--ap-font); color: var(--ap-fg); background: var(--ap-solid);
        border: var(--ap-bw) solid var(--ap-line); border-radius: var(--ap-radius); box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35); }
      .bar strong { font-weight: 700; }
      .bar select { font: inherit; max-width: 260px; padding: 4px 6px; color: var(--ap-fg); background: var(--ap-surface); border: var(--ap-bw-sm) solid var(--ap-line); border-radius: var(--ap-radius-sm); }
      .bar select:focus-visible { outline: 2px solid var(--ap-fg); outline-offset: 2px; }
      .note { flex-basis: 100%; text-align: center; color: var(--ap-muted); }
      .note:empty { display: none; }
      .frame { position: fixed; z-index: 2147481999; box-sizing: border-box; pointer-events: none; border: 3px solid var(--ap-accent); border-radius: 4px;
        background: color-mix(in srgb, var(--ap-accent) 18%, transparent); }
      ${MAK.EXT_BUTTON_CSS}`);
    const frame = h('div', { class: 'frame', attrs: { hidden: '' } });
    const list = h('select', { attrs: { 'aria-label': t('pick.list') } });
    const note = h('span', { class: 'note', attrs: { role: 'status' } });
    const removeIt = h('button', { class: MAK.extButtonClass('btn'), attrs: { type: 'button' }, text: t('pick.remove') });
    const exit = h('button', { class: MAK.extButtonClass('btn'), attrs: { type: 'button' }, text: t('pick.exit') });
    const bar = h('div', { class: 'bar', attrs: { role: 'region', 'aria-label': t('pick.title') } }, h('strong', { text: t('pick.title') }), list, removeIt, exit, note);
    shadow.append(style, frame, bar);
    // The pointer says that a click selects (the page has no rule for it: one of its own, while the selector is on).
    // A block with a page inside (an iframe, as "Contenido web"): the pointer and the click stay in this page.
    const cursor = h('style', { text: 'html, html * { cursor: crosshair !important; } iframe { pointer-events: none !important; }' });

    let found = []; // the sections now
    let current = null; // the one with the frame
    let asking = false; // the question is open: the page works as usual
    const mark = (c) => {
      current = c || null;
      const r = current && current.el.getBoundingClientRect();
      frame.hidden = !r || asking;
      if (r) Object.assign(frame.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      if (current) list.selectedIndex = found.indexOf(current);
    };
    const fill = () => {
      found = candidates();
      MAK.fill(list, found.map((c) => h('option', { text: c.title })));
      list.hidden = removeIt.hidden = !found.length;
      if (!found.length) note.textContent = t('pick.none');
      mark(found.find((c) => current && c.el === current.el) || null);
      if (!current) list.selectedIndex = -1;
    };
    const under = (target) => (target instanceof Node && found.find((c) => c.el.contains(target))) || null;

    async function remove(c) {
      asking = true;
      mark(c);
      const yes = await MAK.askWindow(t('pick.askTitle', { name: c.title }), t(c.key && c.key.startsWith('tool:') ? 'pick.askTool' : 'pick.askBox'), t('pick.remove'));
      asking = false;
      if (!end) return;
      if (yes) {
        let ok;
        ok = await send(c.part ? { type: 'hideSection', part: c.part } : { type: 'hideSection', key: c.key, title: c.title });
        note.textContent = t(ok && ok.ok ? 'pick.done' : 'pick.error', { name: c.title });
        await new Promise((r) => setTimeout(r, 250)); // the page takes the new setting (content-early.js, content-banner.js)
        if (!end) return;
        current = null;
      }
      fill();
    }

    // Another window of Aulario Plus over the page (askWindow: a notice, a question) works as usual.
    const ours = (target) => host.contains(target) || (target instanceof Element && !!target.closest('[data-mak-overlay]'));
    const onMove = (e) => { if (!asking && !ours(e.target)) mark(under(e.target)); };
    // A press on a section selects: the page gets none of it (no link opens, also with the middle button; no menu).
    const swallow = (e) => {
      if (asking || ours(e.target) || !under(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const onClick = (e) => {
      if (asking || ours(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const c = under(e.target);
      if (c) remove(c);
    };
    const PRESS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'auxclick', 'contextmenu', 'dblclick'];
    const onKey = (e) => {
      if (e.key !== 'Escape' || asking || document.querySelector('[data-mak-overlay]')) return;
      e.stopImmediatePropagation();
      end();
    };
    const onScroll = () => mark(current);
    list.addEventListener('change', () => {
      mark(found[list.selectedIndex]);
      if (current) current.el.scrollIntoView({ block: 'center' });
    });
    removeIt.addEventListener('click', () => { if (!asking && found[list.selectedIndex]) remove(found[list.selectedIndex]); });
    exit.addEventListener('click', () => end());

    end = () => {
      end = null;
      document.removeEventListener('mousemove', onMove, true);
      removeEventListener('click', onClick, true);
      for (const type of PRESS) removeEventListener(type, swallow, true);
      document.removeEventListener('keydown', onKey, true);
      removeEventListener('scroll', onScroll, true);
      removeEventListener('resize', onScroll);
      cursor.remove();
      host.remove();
    };
    document.addEventListener('mousemove', onMove, true);
    // On the window, in the capture: before the listeners of the page.
    addEventListener('click', onClick, true);
    for (const type of PRESS) addEventListener(type, swallow, true);
    document.addEventListener('keydown', onKey, true);
    addEventListener('scroll', onScroll, true);
    addEventListener('resize', onScroll);
    document.documentElement.append(host);
    document.head.append(cursor);
    fill();
    exit.focus();
  }

  ext.runtime.onMessage.addListener((msg, sender, reply) => {
    if (!msg || msg.type !== 'pickSections') return;
    start();
    reply(true);
  });
  // A tab that "Eliminar secciones" opened: content.js starts the selector when the page has a session (after its
  // automatic login, not on the way to it).
  MAK.startPicker = start;
})();
