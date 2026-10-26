// Aulario Plus: the banner "new since your last visit" inside a MiAulario site.
// The banner is in a closed shadow root: the styles of the page do not change it, and it does
// not change the page. All the texts go in with textContent (MAK.h). Links are http(s) only.
(function (root) {
  'use strict';
  const MAK = root.MAK;
  const HOST_ID = 'mak-news-host';

  // The look comes from the theme (lib/themes.js, MAK.themedStyle) and MAK.BOX_CSS.
  const CSS = () => `${MAK.BOX_CSS()}
    :host { margin: 0 0 12px; }
    .head .title { flex: none; min-width: 0; }
    .summary { color: inherit; opacity: 0.8; font-size: 0.9em; }
    .spacer { flex: 1; }
    button.close { font: inherit; font-size: 20px; line-height: 1; border: 0; background: none; color: inherit; cursor: pointer; padding: 0 4px; }
    .list { margin-top: 2px; display: grid; gap: 10px; }
    h3 { font-family: var(--ap-font-head); font-weight: var(--ap-head-weight); font-style: var(--ap-head-style); font-size: calc(14px * var(--ap-head-zoom)); margin: 0 0 3px; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 2px 0; }
    .tag { font-size: 11px; border-radius: var(--ap-radius-sm); padding: 0 6px; margin-left: 6px; background: var(--ap-green-bg); color: var(--ap-green); }
    .tag.updated { background: var(--ap-blue-bg); color: var(--ap-blue); }
    li .meta { margin-left: 4px; }
    .compact .summary { display: none; }
    .head:has(+ .list:not([hidden])) .summary { display: none; } /* the open list says it */
  `;

  // Put a host element at the top of the main content, below the breadcrumb.
  // Put a box at the top of the content of the page (after the breadcrumb). Also for content-guide.js.
  function insertAtTop(host) {
    const main = document.querySelector('main#content') || document.querySelector('main');
    if (!main) return false;
    const crumb = main.querySelector(':scope > .portal-header-breadcrumb');
    if (crumb) crumb.after(host);
    else main.prepend(host);
    return true;
  }
  MAK.insertAtTop = insertAtTop;

  // "Mi sitio": a block "Aulario Plus" at the top of the first column of the page, above the first block
  // ("Mensaje del día") and to the left of the calendar; the boxes of the extension go in its body (their
  // hosts have the class "in-block": no frame of their own). The blocks of MiAulario do not change (the
  // user can edit the text of "Mostrar información de Mi Sitio"). The block has the place of the blocks of
  // MiAulario, but the look of the theme of the extension (its frame, and a head with the logo), so that
  // it does not look like a part of MiAulario. The arrow of the head folds the block; it stays folded when
  // the page opens again. The block shows only with a box in it. A site has no block: its boxes are at
  // the top of the content. Result: the body of the block, or null (no block on the page).
  // The triangle in the top right corner widens the block to the full width of the page, above the two
  // columns (in a full row of its own, the calendar below it); a second click puts it back in the column.
  // It stays wide when the page opens again. A page with one column has no triangle.
  // The block is in the page (not in a shadow root): all its rules start with #mak-block, and
  // MAK.themedStyle puts the variables of the theme on #mak-block.
  const scoped = (css) => css.replace(/\.mak-(fold|logo)/g, '#mak-block .mak-$1');
  const BLOCK_CSS = () => `
    /* !important: the themes of MiAulario give the blocks a background color with !important. */
    #mak-block { box-sizing: border-box; margin: 0 0 18px; padding: 0; color: var(--ap-fg); background: var(--ap-win-bg) !important;
      border: var(--ap-bw) solid var(--ap-edge); border-radius: var(--ap-radius); box-shadow: var(--ap-shadow);
      -webkit-backdrop-filter: var(--ap-blur); backdrop-filter: var(--ap-blur); }
    #mak-block[hidden], #mak-block > #mak-block-body[hidden] { display: none !important; }
    #mak-block > #mak-block-body { padding: 8px 14px 10px; background: var(--ap-pane-bg) !important; }
    #mak-block > .mak-head { position: relative; overflow: hidden; display: flex; align-items: center; gap: 10px; margin: 0; padding: 10px 14px;
      font: var(--ap-weight) calc(14px * var(--ap-zoom))/1.4 var(--ap-font); background: var(--ap-head-bg); color: var(--ap-head-fg);
      border: 0; border-bottom: var(--ap-head-line); border-top-left-radius: calc(var(--ap-radius) - var(--ap-bw)); border-top-right-radius: calc(var(--ap-radius) - var(--ap-bw)); }
    #mak-block.mak-closed > .mak-head { border-bottom: 0; border-radius: calc(var(--ap-radius) - var(--ap-bw)); }
    #mak-block .mak-logo { width: 28px; height: 28px; flex: none; }
    #mak-block .mak-title { flex: 0 1 auto; margin: 0 auto 0 0; padding: 0 0 var(--ap-title-pad); border: 0; color: inherit; background: var(--ap-title-deco);
      font-family: var(--ap-font-head); font-weight: var(--ap-head-weight); font-style: var(--ap-head-style); letter-spacing: var(--ap-head-spacing);
      font-size: calc(19px * var(--ap-head-zoom)); line-height: 1.15; text-transform: none; }
    ${scoped(MAK.FOLD_CSS)}
    ${scoped(MAK.LOGO_CSS)}
    /* The row of the columns is a flex row: a full line of its own. */
    #mak-block-wide { flex: 0 0 100% !important; width: 100% !important; max-width: 100% !important; }
    #mak-block-wide[hidden] { display: none !important; }
    #mak-block .mak-widen { position: absolute; top: 0; right: 0; width: 20px; height: 20px; margin: 0; padding: 0; border: 0; border-radius: 0; cursor: pointer;
      background: var(--ap-head-fg); opacity: 0.45; clip-path: polygon(0 0, 100% 0, 100% 100%); box-shadow: none; transition: opacity 0.15s ease; }
    #mak-block .mak-widen:hover, #mak-block .mak-widen:focus-visible { opacity: 0.9; }
    #mak-block .mak-widen:focus-visible { outline: 2px solid var(--ap-head-fg); outline-offset: -4px; }
    #mak-block .mak-head .mak-fold { width: var(--ap-head-btn-size); height: var(--ap-head-btn-size); color: var(--ap-head-btn-fg); background: var(--ap-head-btn-bg); border-color: var(--ap-head-btn-edge); transition-duration: 0.3s; }
    #mak-block .mak-head .mak-fold:hover, #mak-block .mak-head .mak-fold:focus-visible { color: var(--ap-head-btn-solid); filter: none; box-shadow: inset 0 0 0 40px var(--ap-head-btn-fg); }
    /* The button that arranges the parts (arrange): as the arrow, lit while its panel is open. */
    #mak-block .mak-head .mak-organize { flex: none; display: inline-flex; align-items: center; justify-content: center; width: var(--ap-head-btn-size); height: var(--ap-head-btn-size);
      margin: 0; padding: 0; cursor: pointer; color: var(--ap-head-btn-fg); background: var(--ap-head-btn-bg); border: var(--ap-bw-sm) solid var(--ap-head-btn-edge);
      border-radius: var(--ap-radius-sm); box-shadow: var(--ap-shadow-sm); transition: box-shadow 0.3s ease, color 0.3s ease; }
    #mak-block .mak-head .mak-organize:hover, #mak-block .mak-head .mak-organize:focus-visible, #mak-block .mak-head .mak-organize[aria-expanded="true"] {
      color: var(--ap-head-btn-solid); box-shadow: inset 0 0 0 40px var(--ap-head-btn-fg); }
    #mak-block .mak-head .mak-organize:focus-visible { outline: 2px solid var(--ap-head-fg); outline-offset: 2px; }
    #mak-block .mak-head .mak-organize svg { width: 18px; height: 18px; }
    #mak-layout-host[hidden] { display: none !important; }
    /* The parts in the order of the user (data-slot) and in the shape of the user (data-shape, data-count: arrange). With
       little width (half a screen, a phone, the block in its column) always one below the other. */
    #mak-block { container: mak-block / inline-size; }
    #mak-block > #mak-block-body:not([hidden]) { display: grid; grid-template-columns: minmax(0, 1fr); column-gap: 16px; align-items: start; }
    /* A part that the user took out; all the parts until the setting is read (no part out comes and goes). */
    #mak-block-body > [data-off], #mak-block-body:not([data-shape]) > * { display: none !important; }
    #mak-block-body > [data-slot="1"] { order: 1; }
    #mak-block-body > [data-slot="2"] { order: 2; }
    #mak-block-body > [data-slot="3"] { order: 3; }
    @container mak-block (min-width: 1300px) {
      #mak-block > #mak-block-body[data-shape="cols"][data-count="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @container mak-block (min-width: 1000px) {
      #mak-block > #mak-block-body[data-count="2"]:not([data-shape="rows"]) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      #mak-block > #mak-block-body[data-shape="left"][data-count="3"], #mak-block > #mak-block-body[data-shape="right"][data-count="3"] {
        grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: auto 1fr; }
      #mak-block-body[data-shape="left"][data-count="3"] > [data-slot="1"] { grid-column: 1; grid-row: 1 / span 2; }
      #mak-block-body[data-shape="left"][data-count="3"] > [data-slot="2"] { grid-column: 2; grid-row: 1; }
      #mak-block-body[data-shape="left"][data-count="3"] > [data-slot="3"] { grid-column: 2; grid-row: 2; }
      #mak-block-body[data-shape="right"][data-count="3"] > [data-slot="1"] { grid-column: 1; grid-row: 1; }
      #mak-block-body[data-shape="right"][data-count="3"] > [data-slot="2"] { grid-column: 1; grid-row: 2; }
      #mak-block-body[data-shape="right"][data-count="3"] > [data-slot="3"] { grid-column: 2; grid-row: 1 / span 2; }
    }
  `;
  // The panel of arrange: the shapes (a small drawing of each one, no text) and a map of the parts in the shape (a part
  // dragged to another place, or two parts clicked one after the other: they swap; ✕ takes a part out, + puts it back).
  const ARRANGE_CSS = () => `${MAK.BOX_CSS()}
    :host(.in-block) { margin: 0; }
    .pan { font: var(--ap-weight) calc(14px * var(--ap-zoom))/1.45 var(--ap-font); color: var(--ap-fg); padding: 12px 14px; background: var(--ap-pane-bg);
      border-bottom: var(--ap-bw-sm) solid var(--ap-line); display: grid; gap: 10px; }
    .top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .acts { display: flex; gap: 8px; }
    .top strong { margin-right: auto; font-family: var(--ap-font-head); font-weight: var(--ap-head-weight); font-style: var(--ap-head-style); font-size: calc(15px * var(--ap-head-zoom)); }
    .shapes { display: flex; flex-wrap: wrap; gap: 8px; }
    .shape { display: inline-flex; align-items: center; padding: 6px 8px; cursor: pointer; color: var(--ap-btn-fg); background: var(--ap-btn-bg);
      border: var(--ap-bw-sm) solid var(--ap-btn-edge); border-radius: var(--ap-radius-sm); }
    .shape[aria-checked="true"] { color: var(--ap-primary-fg); background: var(--ap-primary-bg); border-color: var(--ap-primary-edge); }
    .shape:focus-visible, .slot:focus-visible, .drop:focus-visible { outline: 2px solid var(--ap-fg); outline-offset: 2px; }
    .mini, .map { display: grid; grid-template-columns: minmax(0, 1fr); }
    .mini { flex: none; width: 34px; height: 24px; gap: 2px; }
    .mini > i { min-height: 0; border-radius: 2px; background: currentColor; opacity: 0.55; }
    .map { position: relative; gap: 8px; max-width: 640px; } /* relative: the offsets of a part (homes) */
    .pan { container-type: inline-size; }
    .parts { display: contents; } /* drawn again at each change; the status after it stays (a live region) */
    [data-count="3"][data-shape="cols"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    [data-count="3"][data-shape="left"], [data-count="3"][data-shape="right"], [data-count="2"]:not([data-shape="rows"]) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    [data-count="3"][data-shape="left"] > [data-slot="1"] { grid-column: 1; grid-row: 1 / span 2; }
    [data-count="3"][data-shape="right"] > [data-slot="1"] { grid-column: 1; grid-row: 1; }
    [data-count="3"][data-shape="right"] > [data-slot="2"] { grid-column: 1; grid-row: 2; }
    [data-count="3"][data-shape="right"] > [data-slot="3"] { grid-column: 2; grid-row: 1 / span 2; }
    .cell { position: relative; min-width: 0; display: grid; }
    .slot { min-width: 0; overflow-wrap: anywhere; min-height: 46px; padding: 8px 32px; cursor: grab; touch-action: none; user-select: none; font: inherit; font-weight: 700; text-align: center; color: var(--ap-fg);
      background: var(--ap-item-bg); border: var(--ap-bw-sm) dashed var(--ap-muted); border-radius: var(--ap-radius-box); transition: background-color 0.2s, border-color 0.2s; }
    @container (max-width: 480px) { .slot { padding: 30px 4px 8px; font-size: 0.82em; } } /* a phone: the name below the ✕, whole */
    .slot:hover, .slot[aria-pressed="true"] { border-style: solid; border-color: var(--ap-accent); background: var(--ap-accent-soft); }
    /* The part in a drag: above the others, lifted, under the pointer. */
    .cell.drag { z-index: 2; transition: none; will-change: transform; } /* at once under the pointer (the themes move a transform slowly) */
    .drag > .slot { cursor: grabbing; border-style: solid; border-color: var(--ap-accent); box-shadow: var(--ap-shadow-pop);
      background: color-mix(in srgb, var(--ap-accent) 16%, var(--ap-solid)); } /* opaque: the part below does not show through */
    /* ✕ of a part: at its top right. */
    .drop { position: absolute; top: 5px; right: 5px; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; cursor: pointer;
      color: var(--ap-muted); background: var(--ap-surface); border: var(--ap-bw-sm) solid var(--ap-line); border-radius: 50%; }
    .drop:hover { color: var(--ap-red); border-color: currentColor; }
    .drop svg, .back svg { width: 14px; height: 14px; }
    .gone { display: flex; flex-wrap: wrap; gap: 8px; }
    .back { display: inline-flex; align-items: center; gap: 6px; }
    .btn { padding: 5px 12px; cursor: pointer; font: inherit; font-size: 0.93em; color: var(--ap-btn-fg); background: var(--ap-btn-bg); border: var(--ap-bw-sm) solid var(--ap-btn-edge); border-radius: var(--ap-radius-sm); }
    .btn.primary { color: var(--ap-primary-fg); background: var(--ap-primary-bg); border-color: var(--ap-primary-edge); }
    .btn:focus-visible { outline: 2px solid var(--ap-fg); outline-offset: 2px; }
    p { margin: 0; }
  `;
  const hostOf = (k) => document.getElementById(MAK.MYSITE_HOSTS[k].host);
  const partName = (k) => MAK.t(MAK.MYSITE_HOSTS[k].title);

  // The parts of the block (body) in the order and the shape of the setting mysiteLayout (MAK.cleanLayout): each host
  // its place among the parts shown on the page (data-slot; a part taken out: data-off), the body the shape and their
  // number (BLOCK_CSS). button: opens the panel that changes them; each change is saved at once (setMySiteLayout), and
  // comes back from the settings (also from another tab, or an import). Result: the panel (between the head and the body).
  function arrange(body, button) {
    const h = MAK.h;
    const ext = root.browser || root.chrome;
    let layout = MAK.cleanLayout(null);
    let picked = null; // a part clicked first: the next click swaps it
    let drag = null;
    let loaded = false; // the setting is read: then the body has its shape (BLOCK_CSS shows the parts)
    const place = () => {
      const shown = layout.order.filter((k) => {
        const el = hostOf(k);
        if (!el || el.parentElement !== body) return false;
        const off = layout.hidden.includes(k);
        el.toggleAttribute('data-off', off);
        if (off) delete el.dataset.slot;
        return !off;
      });
      shown.forEach((k, i) => { hostOf(k).dataset.slot = String(i + 1); });
      if (!loaded) return;
      body.dataset.shape = layout.shape;
      body.dataset.count = String(shown.length);
    };
    // A part that comes later (its data): its place, and the panel (open) with it.
    new MutationObserver(() => {
      place();
      if (!host.hidden) draw();
    }).observe(body, { childList: true });
    const host = h('div', { attrs: { id: 'mak-layout-host' } });
    host.classList.add('in-block');
    host.hidden = true;
    const shadow = host.attachShadow({ mode: 'closed' });
    const parts = h('div', { class: 'parts' });
    const status = h('p', { class: 'meta', attrs: { role: 'status' } });
    const pan = h('div', { class: 'pan', attrs: { role: 'region', 'aria-label': MAK.t('layout.title') } }, parts, status);
    shadow.append(MAK.themedStyle(ARRANGE_CSS()), pan);
    // The panel again only for another layout (not for the echo of a save or another setting: a drag or a slide goes on).
    const set = (next, save) => {
      const clean = MAK.cleanLayout(next);
      const same = JSON.stringify(clean) === JSON.stringify(layout);
      layout = clean;
      place();
      if (save || !same) draw();
      if (save) MAK.safeCall(() => ext.runtime.sendMessage({ type: 'setMySiteLayout', layout }), null);
    };
    // The parts shown: not taken out, and on this page (a user without guides has no box of the guides).
    const shownParts = () => layout.order.filter((k) => !layout.hidden.includes(k) && hostOf(k) && hostOf(k).parentElement === body);
    // A new order of the parts shown, the others (out, or not on this page) at their places in the order.
    const withShown = (shown) => {
      const next = shown[Symbol.iterator]();
      return layout.order.map((k) => (shown.includes(k) ? next.next().value : k));
    };
    const swap = (a, b) => {
      const order = layout.order.slice();
      const [i, j] = [order.indexOf(a), order.indexOf(b)];
      [order[i], order[j]] = [order[j], order[i]];
      status.textContent = MAK.t('layout.swapped', { a: partName(a), b: partName(b) });
      set(Object.assign({}, layout, { order }), true);
    };
    // Take a part out (on: false) or put it back.
    const show = (k, on) => {
      if (picked === k) picked = null;
      status.textContent = MAK.t(on ? 'layout.added' : 'layout.removed', { name: partName(k) });
      set(Object.assign({}, layout, { hidden: on ? layout.hidden.filter((x) => x !== k) : [...layout.hidden, k] }), true);
    };
    // The places of parts in the map without their moves (a transform): their offsets in the map.
    const homes = (cells) => new Map(cells.map((c) => [c, { left: c.offsetLeft, top: c.offsetTop, w: c.offsetWidth, h: c.offsetHeight }]));
    const put = (c, i) => {
      c.dataset.slot = String(i + 1);
      c.style.order = String(i + 1);
    };
    // Parts from where they were seen (before: part -> its box) to their places now, with a short slide.
    const slide = (cells, before) => {
      if (MAK.calmMotion()) return;
      for (const c of cells) {
        const a = before.get(c.dataset.part);
        const b = c.getBoundingClientRect();
        if (a && Math.abs(a.left - b.left) + Math.abs(a.top - b.top) > 1) {
          c.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)' });
        }
      }
    };
    const boxes = (cells) => new Map(cells.map((c) => [c.dataset.part, c.getBoundingClientRect()]));
    // A part in the map: its button (drag it, or click it) and ✕ (not on the last part shown).
    const cell = (k, i, removable) => {
      const b = h('button', { class: 'slot', attrs: { type: 'button', 'aria-pressed': String(picked === k) }, data: { key: `part:${k}` }, text: partName(k) });
      // A drag: the part follows the pointer at once (no transition, its own layer: .cell.drag), held where it was taken.
      // When the pointer is over the place of another part, it takes that place and the others make room (they slide to
      // the places of the new order); a part that becomes smaller keeps the pointer on it. The drop keeps the order that
      // the user sees (also out of the parts); a cancelled drag goes back. The places (homes) are measured only when the
      // order changes, not at each move.
      b.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const c = b.parentElement;
        const m = c.parentElement.getBoundingClientRect();
        drag = { k, cell: c, x: e.clientX, y: e.clientY, gx: e.clientX - m.left - c.offsetLeft, gy: e.clientY - m.top - c.offsetTop, order: shownParts(), moved: false };
        try { b.setPointerCapture(e.pointerId); } catch {} // a pen or a touch that ended
      });
      b.addEventListener('pointermove', (e) => {
        const d = drag;
        if (!d) return;
        if (!d.moved) {
          if (Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 6) return;
          d.moved = true;
          d.cells = [...pan.querySelectorAll('.cell')];
          for (const a of d.cell.getAnimations()) a.cancel(); // a slide of before would hold it
          d.cell.classList.add('drag');
          d.homes = homes(d.cells);
        }
        const m = d.cell.parentElement.getBoundingClientRect();
        const [px, py] = [e.clientX - m.left, e.clientY - m.top]; // the pointer, in the map
        const over = d.cells.find((c) => {
          const r = c !== d.cell && d.homes.get(c);
          return r && px >= r.left && px < r.left + r.w && py >= r.top && py < r.top + r.h;
        });
        if (over) {
          const others = d.cells.filter((c) => c !== d.cell);
          const before = boxes(others);
          for (const c of others) for (const a of c.getAnimations()) a.cancel();
          const to = d.order.indexOf(over.dataset.part);
          d.order = d.order.filter((p) => p !== d.k);
          d.order.splice(to, 0, d.k);
          for (const c of d.cells) put(c, d.order.indexOf(c.dataset.part));
          d.homes = homes(d.cells);
          const own = d.homes.get(d.cell);
          [d.gx, d.gy] = [Math.min(d.gx, own.w - 4), Math.min(d.gy, own.h - 4)];
          slide(others, before);
        }
        const home = d.homes.get(d.cell);
        d.cell.style.transform = `translate(${px - d.gx - home.left}px, ${py - d.gy - home.top}px)`;
      });
      const end = (e) => {
        const d = drag;
        drag = null;
        if (!d || !d.moved) return; // a click (no move): the click below
        const before = boxes([...pan.querySelectorAll('.cell')]);
        if (e.type === 'pointerup' && d.order.join() !== shownParts().join()) {
          status.textContent = MAK.t('layout.moved', { name: partName(d.k), n: d.order.indexOf(d.k) + 1 });
          set(Object.assign({}, layout, { order: withShown(d.order) }), true);
        } else draw();
        slide([...pan.querySelectorAll('.cell')], before); // the part from where it was let go to its place
      };
      b.addEventListener('pointerup', end);
      b.addEventListener('pointercancel', end);
      b.addEventListener('click', () => {
        if (picked && picked !== k) {
          const first = picked;
          picked = null;
          swap(first, k);
          return;
        }
        picked = picked === k ? null : k;
        status.textContent = picked ? MAK.t('layout.picked', { name: partName(k) }) : '';
        draw();
      });
      const name = MAK.t('layout.remove', { name: partName(k) });
      const c = h('div', { class: 'cell', data: { part: k } }, b, removable
        ? h('button', { class: 'drop', data: { key: `toggle:${k}` }, attrs: { type: 'button', title: name, 'aria-label': name }, on: { click: () => show(k, false) } }, MAK.icon('x'))
        : null);
      put(c, i);
      return c;
    };
    const close = () => {
      MAK.fold(host, false);
      picked = null;
      button.setAttribute('aria-expanded', 'false');
      button.focus();
    };
    // The panel again; the focus stays on the same button (data-key; ✕ and + of a part: the same key).
    function draw() {
      drag = null; // its part goes (the button of its pointer too): a drag never goes on in new parts
      const focused = shadow.activeElement && shadow.activeElement.dataset.key;
      const shown = shownParts();
      const n = String(shown.length);
      // Two parts: one below the other or side by side (the other shapes are the same then). One part: no shape.
      const shapes = shown.length === 3 ? MAK.MYSITE_SHAPES : shown.length === 2 ? ['rows', 'cols'] : [];
      const checked = (sh) => sh === layout.shape || (shapes.length === 2 && sh === 'cols' && layout.shape !== 'rows');
      const shape = (sh) => h('button', { class: 'shape', data: { key: `shape:${sh}` },
        attrs: { type: 'button', role: 'radio', 'aria-checked': String(checked(sh)), title: MAK.t(`layout.${sh}`), 'aria-label': MAK.t(`layout.${sh}`) },
        on: { click: () => set(Object.assign({}, layout, { shape: sh }), true) } },
        h('span', { class: 'mini', data: { shape: sh, count: n }, attrs: { 'aria-hidden': 'true' } }, shown.map((k, i) => h('i', { data: { slot: String(i + 1) } }))));
      const back = (k) => {
        const name = MAK.t('layout.add', { name: partName(k) });
        return h('button', { class: 'btn back', data: { key: `toggle:${k}` }, attrs: { type: 'button', title: name, 'aria-label': name }, on: { click: () => show(k, true) } },
          MAK.icon('plus'), h('span', { text: partName(k) }));
      };
      MAK.fill(parts,
        h('div', { class: 'top' }, h('strong', { text: MAK.t('layout.title') }),
          h('span', { class: 'acts' },
            h('button', { class: 'btn', data: { key: 'reset' }, attrs: { type: 'button' }, text: MAK.t('layout.reset'), on: { click: () => set(null, true) } }),
            h('button', { class: 'btn primary', attrs: { type: 'button' }, text: MAK.t('layout.done'), on: { click: close } }))),
        shapes.length ? h('div', { class: 'shapes', attrs: { role: 'radiogroup', 'aria-label': MAK.t('layout.shape') } }, shapes.map(shape)) : null,
        h('p', { class: 'meta', text: MAK.t('layout.help') }),
        h('div', { class: 'map', data: { shape: layout.shape, count: n } }, shown.map((k, i) => cell(k, i, shown.length > 1))),
        layout.hidden.length ? h('div', { class: 'gone', attrs: { role: 'group', 'aria-label': MAK.t('layout.gone') } }, layout.order.filter((k) => layout.hidden.includes(k)).map(back)) : null,
        h('p', { class: 'meta', text: MAK.t('layout.narrow') }));
      const again = focused && pan.querySelector(`[data-key="${focused}"]`);
      if (again) again.focus();
    }
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      if (open) {
        status.textContent = '';
        draw();
      }
      MAK.fold(host, open);
      button.setAttribute('aria-expanded', String(open));
    });
    host.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') close();
    });
    draw();
    place();
    MAK.safeCall(() => ext.storage.local.get('settings'), null)
      .then((d) => {
        loaded = true;
        set(MAK.withDefaults(d && d.settings).mysiteLayout, false);
      })
      .catch(() => {});
    MAK.safeCall(() => ext.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.settings && MAK.extensionAlive()) set(MAK.withDefaults(changes.settings.newValue).mysiteLayout, false);
    }), null);
    return host;
  }

  const BLOCK_CLOSED = 'mak-mysite-closed';
  const BLOCK_WIDE = 'mak-mysite-wide';

  // The column of an element: its ancestor next to another column with blocks of MiAulario (the
  // calendar). Null: a page with one column.
  function columnOf(el) {
    for (; el.parentElement && el.parentElement !== document.body; el = el.parentElement) {
      if ([...el.parentElement.children].some((c) => c !== el && c.querySelector('.Mrphs-container'))) return el;
    }
    return null;
  }

  MAK.mySiteSlot = function () {
    const made = document.getElementById('mak-block-body');
    if (made) return made;
    const main = document.querySelector('main#content') || document.querySelector('main') || document;
    // The first block with a title: in the first column, at the top ("Mensaje del día").
    const titled = [...main.querySelectorAll('.Mrphs-container')].find((c) => c.querySelector('.Mrphs-toolTitleNav'));
    const anchor = main.querySelector('.Mrphs-sakai-motd') || titled || main.querySelector('.Mrphs-container');
    if (!anchor) return null;
    const h = MAK.h;
    if (!document.getElementById('mak-block-style')) {
      const style = MAK.themedStyle(BLOCK_CSS(), { scope: '#mak-block' });
      style.id = 'mak-block-style';
      (document.head || document.documentElement).append(style);
    }
    let closed = false;
    let wide = false;
    const column = columnOf(anchor);
    try {
      closed = localStorage.getItem(BLOCK_CLOSED) === '1';
      wide = !!column && localStorage.getItem(BLOCK_WIDE) === '1';
    } catch {}
    const body = h('div', { class: 'Mrphs-toolBody Mrphs-toolBody--aulario-plus', attrs: { id: 'mak-block-body' } });
    const block = h('div', { class: 'Mrphs-container Mrphs-aulario-plus', attrs: { id: 'mak-block', role: 'region', 'aria-labelledby': 'mak-block-title' } });
    const draw = () => {
      body.hidden = closed;
      block.classList.toggle('mak-closed', closed);
    };
    const fold = MAK.foldButton(!closed, { open: MAK.t('block.open'), close: MAK.t('block.close') }, (open) => {
      closed = !open;
      if (open) block.classList.remove('mak-closed');
      else if (organize.getAttribute('aria-expanded') === 'true') organize.click(); // the panel of arrange folds too
      MAK.fold(body, open, () => block.classList.toggle('mak-closed', closed)); // the head loses its line after the fold
      MAK.uiSave(BLOCK_CLOSED, closed);
    });
    fold.setAttribute('aria-controls', 'mak-block-body');
    // The wide block: in a column of the row of its own, with the classes (and the margins) of the column.
    const wrap = column ? h('div', { class: column.className, attrs: { id: 'mak-block-wide' } }) : null;
    const widen = column ? h('button', { class: 'mak-widen', attrs: { type: 'button' }, on: { click: () => {
      wide = !wide;
      place();
      MAK.uiSave(BLOCK_WIDE, wide);
    } } }) : null;
    const place = () => {
      if (wide) {
        wrap.append(block);
        column.parentElement.prepend(wrap);
      } else {
        anchor.before(block);
        if (wrap) wrap.remove();
      }
      if (!widen) return;
      const label = MAK.t(wide ? 'block.narrow' : 'block.wide');
      widen.setAttribute('aria-pressed', String(wide));
      widen.setAttribute('aria-label', label);
      widen.title = label;
    };
    const organize = h('button', { class: 'mak-organize', attrs: { type: 'button', title: MAK.t('layout.open'), 'aria-label': MAK.t('layout.open'), 'aria-expanded': 'false', 'aria-controls': 'mak-layout-host' } }, MAK.icon('layout'));
    block.append(
      h('div', { class: 'mak-head' },
        MAK.logo(),
        h('h2', { class: 'mak-title', text: MAK.brandName(), title: MAK.t('block.tagHelp'), attrs: { id: 'mak-block-title' } }),
        organize,
        fold,
        widen),
      arrange(body, organize),
      body);
    draw();
    // Only with a box in it.
    const fill = () => {
      block.hidden = !body.childElementCount;
      if (wrap) wrap.hidden = block.hidden;
    };
    new MutationObserver(fill).observe(body, { childList: true });
    fill();
    place();
    return body;
  };

  function group(titleKey, items, render) {
    if (!items.length) return null;
    return MAK.h('div', null, MAK.h('h3', { text: MAK.t(titleKey) }), MAK.h('ul', null, items.map(render)));
  }

  // A question in a window over the page, in the theme of the extension: the buttons no ("Cancelar", with the
  // focus; null: none) and yes. Escape, the ✕ or a click outside the window: no. body: a text, or elements.
  // Result: a promise of true or false. One window at a time: the next one opens when the one before it closes.
  let last = null; // the answer of the last window, while it is open
  function askWindow(...args) {
    const shown = last ? last.then(() => openWindow(...args)) : openWindow(...args);
    last = shown;
    shown.then(() => { if (last === shown) last = null; });
    return shown;
  }
  function openWindow(title, body, yes, noText = MAK.t('zip.cancel')) {
    return new Promise((resolve) => {
      const h = MAK.h;
      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'closed' });
      const style = MAK.themedStyle(`${MAK.WIN_CSS()}
        .win { width: min(440px, calc(100vw - 32px)); }
        .row { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 14px; }
        ${MAK.LINK_CSS}
        ${MAK.RANK_CSS || ''}`);
      // The window shrinks away, the dark around it fades, then the answer (the next window opens after it).
      let answered = false;
      let stop = null;
      const answer = (v) => () => {
        if (answered) return;
        answered = true;
        if (stop) stop();
        if (backdrop.animate && !MAK.calmMotion()) backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
        MAK.popOut(win, () => { host.remove(); resolve(v); });
      };
      const no = noText === null ? null : h('button', { class: 'btn', attrs: { type: 'button' }, text: noText, on: { click: answer(false) } });
      const ok = h('button', { class: 'btn primary', attrs: { type: 'button' }, text: yes, on: { click: answer(true) } });
      const win = h('div', { class: 'win', attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title } },
        h('header', null, h('h2', { text: title }), h('button', { class: 'x', text: '✕', attrs: { type: 'button', title: MAK.t('mail.close'), 'aria-label': MAK.t('mail.close') }, on: { click: answer(false) } })),
        typeof body === 'string' ? h('p', { text: body }) : h('div', null, body),
        h('div', { class: 'row' }, no, ok));
      const backdrop = h('div', { class: 'backdrop' }, win);
      backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) answer(false)(); });
      // The keys stay in the window: the page (the shortcuts of MiAulario) does not get them.
      backdrop.addEventListener('keydown', (e) => e.stopPropagation());
      shadow.append(style, backdrop);
      document.documentElement.append(host);
      stop = MAK.escCloses(win, answer(false));
      if (backdrop.animate && !MAK.calmMotion()) backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      MAK.popIn(win, 'center 30%');
      (no || ok).focus();
    });
  }
  MAK.askWindow = askWindow;

  // Small buttons above the Resources tool ("Download all (ZIP)"; in "Mi sitio" also "Delete all").
  // buttons: [{ text, title, onClick(ui) }]. ui.say(text): a short message next to the buttons;
  // ui.ask(title, text, yes): a question in a window (a promise of true or false).
  MAK.showResourceButtons = function (buttons) {
    if (document.getElementById('mak-zip-host')) return;
    const host = document.createElement('div');
    host.id = 'mak-zip-host';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = MAK.themedStyle(`:host { all: initial; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0 0 10px; }
      .note { font: var(--ap-weight) calc(13px * var(--ap-zoom))/1.4 var(--ap-font); color: var(--ap-muted); } ${MAK.EXT_BUTTON_CSS}`);
    const note = MAK.h('span', { class: 'note', attrs: { role: 'status' } });
    const ui = { say: (text) => { note.textContent = text; }, ask: askWindow };
    shadow.append(style, ...buttons.map((b) => MAK.h('button', { class: MAK.extButtonClass('btn'), attrs: { type: 'button', title: b.title }, text: b.text, on: { click: () => b.onClick(ui) } })), note);
    insertAtTop(host);
  };

  function removeNewsBanner() {
    const old = document.getElementById(HOST_ID);
    if (old) old.remove();
  }

  // result: the answer of the "visit" message. compact: a short line (later pages of the same visit).
  MAK.showNewsBanner = function ({ siteId, result, compact }) {
    removeNewsBanner();
    const news = result && result.news;
    if (!news || !news.total) return false;
    const key = `mak-news-dismissed:${siteId}:${result.since}`;
    try {
      if (sessionStorage.getItem(key)) return false;
    } catch {}

    const h = MAK.h;
    const host = document.createElement('div');
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = MAK.themedStyle(CSS(), { photo: 'news' }); // the photo of the novelties (a theme with photos)

    const list = h(
      'div',
      { class: 'list', hidden: compact || news.total > 6 },
      // All is new here: a tag only for a file that changed.
      group('news.groupFiles', news.files, (f) => h('li', null, MAK.link(f.url, f.title), f.label === 'new' ? null : h('span', { class: 'tag updated', text: MAK.t('news.tagUpdated') }))),
      group('news.groupAnnouncements', news.announcements, (a) => h('li', null, MAK.link(a.url, a.title), h('span', { class: 'meta', text: MAK.formatDate(a.time) }))),
      group('news.groupDeliveries', news.deliveries, (d) => h('li', null, MAK.link(d.url, d.title), d.due ? h('span', { class: 'meta', text: MAK.t('news.due', { date: MAK.formatDate(d.due) }) }) : null)),
      group('news.groupDates', news.dateChanges || [], (d) => h('li', null, MAK.link(d.url, d.title), h('span', { class: 'meta', text: MAK.dateMove(d.from, d.to) }))),
      group('news.groupFeedback', news.feedback || [], (d) => h('li', null, MAK.link(d.url, d.title))),
      group('news.groupForums', news.forums, (f) => h('li', null, MAK.link(f.url, f.title), h('span', { class: 'meta', text: MAK.t('news.forumDelta', { n: f.delta }) }))),
      group('news.groupGrades', news.grades || [], (g) => h('li', null, MAK.link(g.url, g.title), h('span', { class: 'meta', text: MAK.t('news.graded', { date: MAK.formatDate(g.time) }) })))
    );
    const title = compact
      ? MAK.t('news.chip', { n: news.total })
      : result.firstVisit
        ? MAK.t('news.titleFirst')
        : MAK.t('news.title', { date: new Intl.DateTimeFormat(MAK.locale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(result.since).replace(/,/g, '') });
    // The arrow shows the list (the title too), as in the other boxes of the extension.
    const toggle = MAK.foldButton(!list.hidden, { open: MAK.t('fold.open', { name: title }), close: MAK.t('fold.close', { name: title }) }, (open) => {
      MAK.fold(list, open);
    });
    const close = h('button', {
      class: 'close',
      attrs: { type: 'button', 'aria-label': MAK.t('news.close'), title: MAK.t('news.close') },
      text: '×',
      on: {
        click: () => {
          try { sessionStorage.setItem(key, '1'); } catch {}
          host.remove();
        }
      }
    });
    const box = h(
      'div',
      { class: `box banner${compact ? ' compact' : ''}`, attrs: { role: 'region', 'aria-label': title } },
      h(
        'div',
        { class: 'head' },
        h('span', { class: 'title', text: title, on: { click: () => toggle.click() } }),
        h('span', { class: 'summary', text: MAK.newsSummary(news) }),
        h('span', { class: 'spacer' }),
        toggle,
        close
      ),
      list
    );
    shadow.append(style, box);
    return insertAtTop(host);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
