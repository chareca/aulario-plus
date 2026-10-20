// Aulario Plus: the banner "new since your last visit" inside a MiAulario site.
// The banner is in a closed shadow root: the styles of the page do not change it, and it does
// not change the page. All the texts go in with textContent (MAK.h). Links are http(s) only.
(function (root) {
  'use strict';
  const MAK = root.MAK;
  const HOST_ID = 'mak-news-host';

  const CSS = `
    :host { all: initial; display: block; margin: 0 0 12px; }
    .box { font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1d2327; background: #f3f8f7;
      border: 1px solid #cfe3df; border-left: 4px solid #10524e; border-radius: 8px; padding: 10px 12px; }
    .box.dark { color: #e8ecee; background: #1e2a28; border-color: #2e4440; border-left-color: #4fd1a5; }
    .head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .title { font-weight: 700; cursor: pointer; }
    .since, .summary { color: #5f6b73; }
    .dark .since, .dark .summary { color: #9aa6ad; }
    .spacer { flex: 1; }
    button { font: inherit; cursor: pointer; border: 1px solid #cfd8dc; background: transparent; color: inherit; border-radius: 6px; padding: 2px 10px; }
    .dark button { border-color: #3a4a47; }
    button.close { border: 0; font-size: 18px; line-height: 1; padding: 0 4px; }
    ${MAK.EXT_BUTTON_CSS}
    .mak-btn { padding: 2px 12px; }
    .list { margin-top: 8px; display: grid; gap: 8px; }
    .list[hidden] { display: none; }
    h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; margin: 0 0 3px; color: #5f6b73; }
    .dark h3 { color: #9aa6ad; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 2px 0; }
    ${MAK.LINK_CSS}
    .tag { font-size: 11px; border-radius: 9px; padding: 0 6px; margin-left: 6px; background: #e6f4ea; color: #137333; }
    .tag.updated { background: #e8f0fe; color: #1a5fb4; }
    .dark .tag { background: #1e3326; color: #81c995; }
    .dark .tag.updated { background: #1c2b41; color: #8ab4f8; }
    .meta { color: #5f6b73; font-size: 12px; margin-left: 4px; }
    .dark .meta { color: #9aa6ad; }
    .compact .summary { display: none; }
    ${MAK.FOLD_CSS}
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

  // The block "Aulario Plus": the boxes of the extension go in its body. It has the place and the
  // margins of the blocks of MiAulario, but its own head (the green of the extension, the logo and the
  // tag "Extensión"), so that it does not look like a part of MiAulario. The arrow of the head folds
  // the block; it stays folded when the page opens again. The block shows only with a box in it.
  // - "Mi sitio" (MAK.mySiteSlot): at the top of the first column of the page, above the first block
  //   ("Mensaje del día") and to the left of the calendar. The blocks of MiAulario do not change (the
  //   user can edit the text of "Mostrar información de Mi Sitio").
  // - A site (MAK.siteSlot): at the top of the content, below the breadcrumb.
  // Result: the body of the block, or null (no place for it on the page).
  const BLOCK_CSS = `
    #mak-block[hidden], #mak-block > #mak-block-body[hidden] { display: none !important; }
    #mak-block > .mak-head { display: flex; align-items: center; gap: 10px; margin: 0; padding: 10px 14px;
      background: #10524e; color: #fff; border-radius: 8px 8px 0 0; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    #mak-block.mak-closed > .mak-head { border-radius: 8px; }
    #mak-block.mak-site { margin: 0 0 14px; }
    #mak-block.mak-site > #mak-block-body { padding: 12px 0 0; }
    #mak-block .mak-logo { width: 26px; height: 26px; flex: none; }
    #mak-block .mak-title { flex: 1; margin: 0; padding: 0; border: 0; font: 600 17px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #fff; }
    #mak-block .mak-tag { flex: none; font: 500 11px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #0b3b38; background: #9ff0d0;
      border-radius: 10px; padding: 2px 8px; cursor: default; }
    ${MAK.FOLD_CSS.replace(/\.mak-fold/g, '#mak-block .mak-head .mak-fold')}
    #mak-block .mak-head .mak-fold, #mak-block .mak-head .mak-fold.dark { border-color: rgba(255, 255, 255, 0.35); color: #fff; }
    #mak-block .mak-head .mak-fold:hover, #mak-block .mak-head .mak-fold:focus-visible { background: rgba(255, 255, 255, 0.15); }
    #mak-block .mak-head .mak-fold:focus-visible { outline: 2px solid #9ff0d0; outline-offset: 2px; }
  `;
  const BLOCK_CLOSED = { mine: 'mak-mysite-closed', site: 'mak-site-closed' };

  function blockSlot(kind) {
    const made = document.getElementById('mak-block-body');
    if (made) return made;
    const main = document.querySelector('main#content') || document.querySelector('main');
    let place;
    if (kind === 'mine') {
      // The first block with a title: in the first column, at the top ("Mensaje del día").
      const scope = main || document;
      const titled = [...scope.querySelectorAll('.Mrphs-container')].find((c) => c.querySelector('.Mrphs-toolTitleNav'));
      const anchor = scope.querySelector('.Mrphs-sakai-motd') || titled || scope.querySelector('.Mrphs-container');
      if (!anchor) return null;
      place = (block) => anchor.before(block);
    } else {
      if (!main) return null;
      place = (block) => insertAtTop(block);
    }
    const h = MAK.h;
    if (!document.getElementById('mak-block-style')) (document.head || document.documentElement).append(h('style', { attrs: { id: 'mak-block-style' }, text: BLOCK_CSS }));
    let closed = false;
    try { closed = localStorage.getItem(BLOCK_CLOSED[kind]) === '1'; } catch {}
    const body = h('div', { class: 'Mrphs-toolBody Mrphs-toolBody--aulario-plus', attrs: { id: 'mak-block-body' } });
    const block = h('div', { class: `Mrphs-container Mrphs-aulario-plus mak-${kind}`, attrs: { id: 'mak-block', role: 'region', 'aria-labelledby': 'mak-block-title' } });
    const draw = () => {
      body.hidden = closed;
      block.classList.toggle('mak-closed', closed);
    };
    const fold = MAK.foldButton(!closed, { open: MAK.t('block.open'), close: MAK.t('block.close') }, (open) => {
      closed = !open;
      draw();
      try { localStorage.setItem(BLOCK_CLOSED[kind], closed ? '1' : '0'); } catch {}
    });
    fold.setAttribute('aria-controls', 'mak-block-body');
    block.append(
      h('div', { class: 'mak-head' },
        MAK.logo(),
        h('h2', { class: 'mak-title', text: 'Aulario Plus', attrs: { id: 'mak-block-title' } }),
        h('span', { class: 'mak-tag', text: MAK.t('block.tag'), title: MAK.t('block.tagHelp') }),
        fold),
      body);
    draw();
    // Only with a box in it (for example, the box of new items goes away with its ×).
    const fill = () => { block.hidden = !body.childElementCount; };
    new MutationObserver(fill).observe(body, { childList: true });
    fill();
    place(block);
    return body;
  }
  MAK.mySiteSlot = () => blockSlot('mine');
  MAK.siteSlot = () => blockSlot('site');

  function group(titleKey, items, render) {
    if (!items.length) return null;
    return MAK.h('div', null, MAK.h('h3', { text: MAK.t(titleKey) }), MAK.h('ul', null, items.map(render)));
  }

  // A small button above the Resources tool: "Download all (ZIP)".
  MAK.showZipButton = function (onClick) {
    if (document.getElementById('mak-zip-host')) return;
    const host = document.createElement('div');
    host.id = 'mak-zip-host';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `:host { all: initial; display: block; margin: 0 0 10px; } ${MAK.EXT_BUTTON_CSS}`;
    const btn = MAK.h('button', { class: MAK.extButtonClass('btn'), attrs: { type: 'button' }, text: `📦 ${MAK.t('zip.button')}`, on: { click: onClick } });
    shadow.append(style, btn);
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
    const style = document.createElement('style');
    style.textContent = CSS;

    const list = h(
      'div',
      { class: 'list', hidden: compact || news.total > 6 },
      group('news.groupFiles', news.files, (f) => h('li', null, MAK.link(f.url, f.title), h('span', { class: `tag ${f.label}`, text: MAK.t(f.label === 'new' ? 'news.tagNew' : 'news.tagUpdated') }))),
      group('news.groupAnnouncements', news.announcements, (a) => h('li', null, MAK.link(a.url, a.title), h('span', { class: 'meta', text: MAK.formatDate(a.time) }))),
      group('news.groupDeliveries', news.deliveries, (d) => h('li', null, MAK.link(d.url, d.title), d.due ? h('span', { class: 'meta', text: MAK.t('news.due', { date: MAK.formatDate(d.due) }) }) : null)),
      group('news.groupDates', news.dateChanges || [], (d) => h('li', null, MAK.link(d.url, d.title), h('span', { class: 'meta', text: MAK.dateMove(d.from, d.to) }))),
      group('news.groupForums', news.forums, (f) => h('li', null, MAK.link(f.url, f.title), h('span', { class: 'meta', text: MAK.t('news.forumDelta', { n: f.delta }) }))),
      group('news.groupGrades', news.grades || [], (g) => h('li', null, MAK.link(g.url, g.title), h('span', { class: 'meta', text: MAK.t('news.graded', { date: MAK.formatDate(g.time) }) })))
    );
    const title = compact
      ? MAK.t('news.chip', { n: news.total })
      : MAK.t(result.firstVisit ? 'news.titleFirst' : 'news.title');
    // The arrow shows the list (the title too), as in the other boxes of the extension.
    const toggle = MAK.foldButton(!list.hidden, { open: MAK.t('fold.open', { name: title }), close: MAK.t('fold.close', { name: title }) }, (open) => {
      list.hidden = !open;
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
      { class: `box${MAK.isDarkPage() ? ' dark' : ''}${compact ? ' compact' : ''}`, attrs: { role: 'region', 'aria-label': title } },
      h(
        'div',
        { class: 'head' },
        h('span', { class: 'title', text: `🆕 ${title}`, on: { click: () => toggle.click() } }),
        compact || result.firstVisit ? null : h('span', { class: 'since', text: `(${MAK.formatDate(result.since)})` }),
        h('span', { class: 'summary', text: MAK.newsSummary(news) }),
        h('span', { class: 'spacer' }),
        toggle,
        close
      ),
      list
    );
    shadow.append(style, box);
    // In the block "Aulario Plus" of the site, first.
    const slot = MAK.siteSlot();
    if (!slot) return insertAtTop(host);
    slot.prepend(host);
    return true;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
