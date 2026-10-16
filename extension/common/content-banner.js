// MiAulario Keep-Alive: the banner "new since your last visit" inside a MiAulario site.
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
    .list { margin-top: 8px; display: grid; gap: 8px; }
    .list[hidden] { display: none; }
    h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; margin: 0 0 3px; color: #5f6b73; }
    .dark h3 { color: #9aa6ad; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 2px 0; }
    a { color: #1a5fb4; }
    .dark a { color: #8ab4f8; }
    .tag { font-size: 11px; border-radius: 9px; padding: 0 6px; margin-left: 6px; background: #e6f4ea; color: #137333; }
    .tag.updated { background: #e8f0fe; color: #1a5fb4; }
    .dark .tag { background: #1e3326; color: #81c995; }
    .dark .tag.updated { background: #1c2b41; color: #8ab4f8; }
    .meta { color: #5f6b73; font-size: 12px; margin-left: 4px; }
    .dark .meta { color: #9aa6ad; }
    .compact .summary { display: none; }
  `;

  function isDark() {
    const c = document.documentElement.classList;
    if (c.contains('sakaiUserTheme-dark')) return true;
    if (c.contains('sakaiUserTheme-light')) return false;
    return !!(root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function group(titleKey, items, render) {
    if (!items.length) return null;
    return MAK.h('div', null, MAK.h('h3', { text: MAK.t(titleKey) }), MAK.h('ul', null, items.map(render)));
  }

  MAK.removeNewsBanner = function () {
    const old = document.getElementById(HOST_ID);
    if (old) old.remove();
  };

  // result: the answer of the "visit" message. compact: a short line (later pages of the same visit).
  MAK.showNewsBanner = function ({ siteId, result, compact }) {
    MAK.removeNewsBanner();
    const news = result && result.news;
    if (!news || !news.total) return false;
    const key = `mak-news-dismissed:${siteId}:${result.since}`;
    try {
      if (sessionStorage.getItem(key)) return false;
    } catch {}
    const main = document.querySelector('main#content') || document.querySelector('main');
    if (!main) return false;

    const h = MAK.h;
    const host = document.createElement('div');
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;

    const list = h(
      'div',
      { class: 'list', hidden: compact || news.total > 6 },
      group('news.groupFiles', news.files, (f) => h('li', null, h('a', { href: f.url, text: f.title }), h('span', { class: `tag ${f.label}`, text: MAK.t(f.label === 'new' ? 'news.tagNew' : 'news.tagUpdated') }))),
      group('news.groupAnnouncements', news.announcements, (a) => h('li', null, h('a', { href: a.url, text: a.title }), h('span', { class: 'meta', text: MAK.formatDate(a.time) }))),
      group('news.groupDeliveries', news.deliveries, (d) => h('li', null, h('a', { href: d.url, text: d.title }), d.due ? h('span', { class: 'meta', text: MAK.t('news.due', { date: MAK.formatDate(d.due) }) }) : null)),
      group('news.groupForums', news.forums, (f) => h('li', null, h('a', { href: f.url, text: f.title }), h('span', { class: 'meta', text: MAK.t('news.forumDelta', { n: f.delta }) })))
    );
    const toggle = h('button', {
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
      { class: `box${isDark() ? ' dark' : ''}${compact ? ' compact' : ''}`, attrs: { role: 'region', 'aria-label': title } },
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
    const crumb = main.querySelector(':scope > .portal-header-breadcrumb');
    if (crumb) crumb.after(host);
    else main.prepend(host);
    return true;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
