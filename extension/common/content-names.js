// Aulario Plus: a pencil next to the name of the site in the page header of MiAulario.
// The user writes a name of choice for the site, or goes back to the automatic name.
// content-early.js shows the new name on the page when the settings change.
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const HOST_CLASS = 'mak-name-pencil';
  const where = MAK.parsePortalPath(location.pathname);
  const siteId = where && where.siteId;
  if (!siteId || MAK.isSpecialSite(siteId)) return;

  const CSS = `
    :host { all: initial; display: inline-block; position: relative; vertical-align: middle; margin-left: 6px; }
    .pen { font: 14px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; cursor: pointer; border: 0; background: none;
      color: inherit; opacity: 0.6; padding: 2px 4px; border-radius: 4px; }
    .pen:hover, .pen:focus-visible { opacity: 1; background: rgba(127, 127, 127, 0.15); }
    .pop { position: absolute; top: calc(100% + 6px); left: 0; z-index: 2147483000; width: 340px; box-sizing: border-box;
      font: 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1d2327; background: #fff;
      border: 1px solid #c9d2d6; border-radius: 8px; padding: 10px; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18); }
    .pop[hidden] { display: none; }
    .dark .pop { color: #e8ecee; background: #1e2a28; border-color: #2e4440; }
    label { display: block; font-size: 12px; color: #5f6b73; margin-bottom: 4px; }
    .dark label { color: #9aa6ad; }
    input { box-sizing: border-box; width: 100%; font: inherit; padding: 5px 8px; border-radius: 6px; border: 1px solid #10524e;
      color: inherit; background: transparent; }
    .row { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
    button.btn { font: inherit; font-size: 13px; cursor: pointer; border-radius: 6px; padding: 4px 10px; border: 1px solid #c9d2d6;
      background: transparent; color: inherit; }
    button.save { background: #10524e; border-color: #10524e; color: #fff; }
    .dark button.save { background: #4fd1a5; border-color: #4fd1a5; color: #0b1a17; }
  `;

  function makePencil(site, settings) {
    const h = MAK.h;
    const host = document.createElement('span');
    host.className = HOST_CLASS;
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    const name = () => MAK.siteName(site, settings());
    const input = h('input', { attrs: { type: 'text', maxlength: 40, 'aria-label': MAK.t('names.edit') } });
    const pop = h('div', { class: 'pop', hidden: true, attrs: { role: 'dialog', 'aria-label': MAK.t('names.edit') } });
    const pen = h('button', { class: 'pen', text: '✎', attrs: { type: 'button', title: MAK.t('names.edit'), 'aria-expanded': 'false' } });
    const box = h('span', null, pen, pop);

    const close = () => {
      pop.hidden = true;
      pen.setAttribute('aria-expanded', 'false');
    };
    const save = async (value) => {
      close();
      await MAK.safeCall(() => ext.runtime.sendMessage({ type: 'renameSite', siteId, name: value }), null);
    };
    MAK.fill(pop, [
      h('label', { text: MAK.t('names.editSite', { site: name() }) }),
      input,
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn save', text: MAK.t('names.save'), attrs: { type: 'button' }, on: { click: () => save(input.value) } }),
        h('button', { class: 'btn', text: MAK.t('names.auto'), attrs: { type: 'button', title: MAK.t('names.autoHelp') }, on: { click: () => save('') } }),
        h('button', { class: 'btn', text: MAK.t('names.cancel'), attrs: { type: 'button' }, on: { click: close } })
      )
    ]);
    pen.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!pop.hidden) return close();
      box.className = MAK.isDarkPage() ? 'dark' : '';
      pop.querySelector('label').textContent = MAK.t('names.editSite', { site: name() });
      input.value = name();
      pop.hidden = false;
      pen.setAttribute('aria-expanded', 'true');
      input.focus();
      input.select();
    });
    // The keys stay in the editor: the page does not get them.
    pop.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        save(input.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
        pen.focus();
      }
    });
    pop.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', (e) => { if (!e.composedPath().includes(host)) close(); });
    shadow.append(style, box);
    return host;
  }

  // Add the pencils when the site is known (also when the first sync comes after the page).
  let current = null;
  let added = false;
  function setup(sites) {
    const site = (sites || []).find((s) => s.id === siteId);
    if (added || !site || !current) return;
    added = true;
    MAK.setLang(current.lang);
    for (const title of document.querySelectorAll('.portal-header-site-title')) {
      if (!title.querySelector(`.${HOST_CLASS}`)) title.append(makePencil(site, () => current));
    }
  }

  MAK.safeCall(() => ext.storage.local.get(['settings', 'sites']), null)
    .then((d) => {
      current = MAK.withDefaults(d && d.settings);
      setup(d && d.sites);
    })
    .catch(() => {});
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.settings) current = MAK.withDefaults(changes.settings.newValue);
    if (changes.sites) setup(changes.sites.newValue);
  });
})();
