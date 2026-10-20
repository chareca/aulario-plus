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
  // The block is in the page (not in a shadow root): all its rules start with #mak-block, and
  // MAK.themedStyle puts the variables of the theme on #mak-block.
  const scoped = (css) => css.replace(/\.mak-(fold|logo)/g, '#mak-block .mak-$1');
  const BLOCK_CSS = () => `
    /* !important: the themes of MiAulario give the blocks a background color with !important. */
    #mak-block { box-sizing: border-box; margin: 0 0 18px; padding: 0; color: var(--ap-fg); background: var(--ap-win-bg) !important;
      border: var(--ap-bw) solid var(--ap-edge); border-radius: var(--ap-radius); box-shadow: var(--ap-shadow);
      -webkit-backdrop-filter: var(--ap-blur); backdrop-filter: var(--ap-blur); }
    #mak-block[hidden], #mak-block > #mak-block-body[hidden] { display: none !important; }
    #mak-block > #mak-block-body { padding: 8px 14px 10px; background: transparent !important; }
    #mak-block > .mak-head { display: flex; align-items: center; gap: 10px; margin: 0; padding: 10px 14px;
      font: var(--ap-weight) calc(14px * var(--ap-zoom))/1.4 var(--ap-font); background: var(--ap-head-bg); color: var(--ap-head-fg);
      border: 0; border-bottom: var(--ap-head-line); border-top-left-radius: calc(var(--ap-radius) - var(--ap-bw)); border-top-right-radius: calc(var(--ap-radius) - var(--ap-bw)); }
    #mak-block.mak-closed > .mak-head { border-bottom: 0; border-radius: calc(var(--ap-radius) - var(--ap-bw)); }
    #mak-block .mak-logo { width: 28px; height: 28px; flex: none; }
    #mak-block .mak-title { flex: 0 1 auto; margin: 0 auto 0 0; padding: 0 0 var(--ap-title-pad); border: 0; color: inherit; background: var(--ap-title-deco);
      font-family: var(--ap-font-head); font-weight: var(--ap-head-weight); font-style: var(--ap-head-style); letter-spacing: var(--ap-head-spacing);
      font-size: calc(19px * var(--ap-head-zoom)); line-height: 1.15; text-transform: none; }
    ${scoped(MAK.FOLD_CSS)}
    ${scoped(MAK.LOGO_CSS)}
    #mak-block .mak-head .mak-fold { width: var(--ap-head-btn-size); height: var(--ap-head-btn-size); color: var(--ap-head-btn-fg); background: var(--ap-head-btn-bg); border-color: var(--ap-head-btn-edge); }
  `;
  const BLOCK_CLOSED = 'mak-mysite-closed';

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
    try { closed = localStorage.getItem(BLOCK_CLOSED) === '1'; } catch {}
    const body = h('div', { class: 'Mrphs-toolBody Mrphs-toolBody--aulario-plus', attrs: { id: 'mak-block-body' } });
    const block = h('div', { class: 'Mrphs-container Mrphs-aulario-plus', attrs: { id: 'mak-block', role: 'region', 'aria-labelledby': 'mak-block-title' } });
    const draw = () => {
      body.hidden = closed;
      block.classList.toggle('mak-closed', closed);
    };
    const fold = MAK.foldButton(!closed, { open: MAK.t('block.open'), close: MAK.t('block.close') }, (open) => {
      closed = !open;
      draw();
      try { localStorage.setItem(BLOCK_CLOSED, closed ? '1' : '0'); } catch {}
    });
    fold.setAttribute('aria-controls', 'mak-block-body');
    block.append(
      h('div', { class: 'mak-head' },
        MAK.logo(),
        h('h2', { class: 'mak-title', text: 'Aulario Plus', title: MAK.t('block.tagHelp'), attrs: { id: 'mak-block-title' } }),
        fold),
      body);
    draw();
    // Only with a box in it.
    const fill = () => { block.hidden = !body.childElementCount; };
    new MutationObserver(fill).observe(body, { childList: true });
    fill();
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
    const style = MAK.themedStyle(`:host { all: initial; display: block; margin: 0 0 10px; } ${MAK.EXT_BUTTON_CSS}`);
    const btn = MAK.h('button', { class: MAK.extButtonClass('btn'), attrs: { type: 'button' }, text: MAK.t('zip.button'), on: { click: onClick } });
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
    const style = MAK.themedStyle(CSS());

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
