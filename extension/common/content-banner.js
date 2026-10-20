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
    .title { font-weight: 700; }
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

  // "Mi sitio": a block "Aulario Plus" just above the block "Mostrar información de Mi Sitio" (the
  // tool sakai.iframe.myworkspace). That block does not change: the user can edit its text. No such
  // block: above the first block of the page. The block has the place and the margins of the blocks of
  // MiAulario, but its own head (the green of the extension, the logo and the tag "Extensión"), so
  // that it does not look like a part of MiAulario. The arrow of the head folds the block; it stays
  // folded when the page opens again. The boxes of the extension go in the body of the block.
  // Result: the body of the new block, or null (no block on the page).
  const BLOCK_CLOSED = 'mak-mysite-closed';
  const BLOCK_CSS = `
    #mak-mysite-block > .mak-head { display: flex; align-items: center; gap: 10px; margin: 0; padding: 10px 14px;
      background: #10524e; color: #fff; border-radius: 8px 8px 0 0; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    #mak-mysite-block.mak-closed > .mak-head { border-radius: 8px; }
    #mak-mysite-block .mak-logo { width: 26px; height: 26px; flex: none; }
    #mak-mysite-block .mak-title { flex: 1; margin: 0; padding: 0; border: 0; font: 600 17px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #fff; }
    #mak-mysite-block .mak-tag { flex: none; font: 500 11px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #0b3b38; background: #9ff0d0;
      border-radius: 10px; padding: 2px 8px; cursor: default; }
    #mak-mysite-block .mak-fold { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; margin: 0;
      padding: 0; border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 6px; background: transparent; color: #fff; cursor: pointer; }
    #mak-mysite-block .mak-fold:hover, #mak-mysite-block .mak-fold:focus-visible { background: rgba(255, 255, 255, 0.15); }
    #mak-mysite-block .mak-fold:focus-visible { outline: 2px solid #9ff0d0; outline-offset: 2px; }
    #mak-mysite-block .mak-fold svg { width: 18px; height: 18px; transition: transform 0.15s ease; }
    #mak-mysite-block.mak-closed .mak-fold svg { transform: rotate(-90deg); }
    #mak-mysite-block > #mak-mysite-body[hidden] { display: none !important; }
    @media (prefers-reduced-motion: reduce) { #mak-mysite-block .mak-fold svg { transition: none; } }
  `;
  MAK.mySiteSlot = function () {
    const made = document.getElementById('mak-mysite-body');
    if (made) return made;
    const titled = (c) => /informaci[oó]n de mi ?sitio|my ?workspace information/i.test(((c.querySelector('.Mrphs-toolTitleNav__title') || {}).textContent) || '');
    const main = document.querySelector('main#content') || document.querySelector('main') || document;
    const welcome = main.querySelector('.Mrphs-sakai-iframe-myworkspace') || [...main.querySelectorAll('.Mrphs-container')].find(titled);
    const anchor = welcome || main.querySelector('.Mrphs-container');
    if (!anchor) return null;
    const h = MAK.h;
    if (!document.getElementById('mak-mysite-style')) (document.head || document.documentElement).append(h('style', { attrs: { id: 'mak-mysite-style' }, text: BLOCK_CSS }));
    let closed = false;
    try { closed = localStorage.getItem(BLOCK_CLOSED) === '1'; } catch {}
    const body = h('div', { class: 'Mrphs-toolBody Mrphs-toolBody--aulario-plus', attrs: { id: 'mak-mysite-body' } });
    const fold = h('button', { class: 'mak-fold', attrs: { type: 'button', 'aria-controls': 'mak-mysite-body' } }, MAK.icon('chevron'));
    const block = h('div', { class: 'Mrphs-container Mrphs-aulario-plus', attrs: { id: 'mak-mysite-block', role: 'region', 'aria-labelledby': 'mak-mysite-title' } },
      h('div', { class: 'mak-head' },
        MAK.logo(),
        h('h2', { class: 'mak-title', text: 'Aulario Plus', attrs: { id: 'mak-mysite-title' } }),
        h('span', { class: 'mak-tag', text: MAK.t('block.tag'), title: MAK.t('block.tagHelp') }),
        fold),
      body);
    const draw = () => {
      body.hidden = closed;
      block.classList.toggle('mak-closed', closed);
      const label = MAK.t(closed ? 'block.open' : 'block.close');
      fold.setAttribute('aria-expanded', String(!closed));
      fold.setAttribute('aria-label', label);
      fold.title = label;
    };
    fold.addEventListener('click', () => {
      closed = !closed;
      draw();
      try { localStorage.setItem(BLOCK_CLOSED, closed ? '1' : '0'); } catch {}
    });
    draw();
    anchor.before(block);
    return body;
  };

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
    const toggle = h('button', {
      class: MAK.extButtonClass('btn'),
      attrs: { type: 'button', 'aria-expanded': String(!list.hidden) },
      text: MAK.t(list.hidden ? 'news.show' : 'news.hide'),
      on: {
        click: () => {
          list.hidden = !list.hidden;
          toggle.textContent = MAK.t(list.hidden ? 'news.show' : 'news.hide');
          toggle.setAttribute('aria-expanded', String(!list.hidden));
        }
      }
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
    const title = compact
      ? MAK.t('news.chip', { n: news.total })
      : MAK.t(result.firstVisit ? 'news.titleFirst' : 'news.title');
    const box = h(
      'div',
      { class: `box${MAK.isDarkPage() ? ' dark' : ''}${compact ? ' compact' : ''}`, attrs: { role: 'region', 'aria-label': title } },
      h(
        'div',
        { class: 'head' },
        h('span', { class: 'title', text: `🆕 ${title}` }),
        compact || result.firstVisit ? null : h('span', { class: 'since', text: `(${MAK.formatDate(result.since)})` }),
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
