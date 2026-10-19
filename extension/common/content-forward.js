// Aulario Plus: forward the internal mail ("Correo interno") of the sites to an email address of
// the user. On the inbox and the Settings page of the Messages tool of a site, a box has the
// address and the buttons: forward this site or all the sites, and stop the forward of this site
// or of all the sites (the option "Por defecto" again). The extension changes the option "Forward
// messages automatically" of the Settings page of each site (lib/pm.js), the same as the user.
// Nothing is sent. The steps start only after a click: the Messages tool keeps its state in the
// session, so a request when the page opens could change a message that the user writes.
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const where = MAK.parsePortalPath(location.pathname);
  const siteId = where && where.siteId && !MAK.isSpecialSite(where.siteId) ? where.siteId : null;
  if (!siteId) return;
  const HOST_ID = 'mak-forward-host';
  const h = MAK.h;
  const t = (k, p) => MAK.t(k, p);
  const send = (msg) => MAK.safeCall(() => ext.runtime.sendMessage(msg), null);

  const CSS = `
    :host { all: initial; display: block; margin: 0 0 12px; }
    .box { font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1d2327; background: #f3f8f7;
      border: 1px solid #d6e3e0; border-left: 4px solid #10524e; border-radius: 8px; padding: 10px 14px; max-width: 900px; }
    .box.dark { color: #e8ecee; background: #1e2a28; border-color: #2e4440; border-left-color: #4fd1a5; }
    .head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .head strong { flex: 1; min-width: 200px; }
    .meta { color: #5f6b73; font-size: 12px; } .dark .meta { color: #9aa6ad; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; }
    input[type=email] { font: inherit; flex: 1 1 240px; min-width: 0; max-width: 360px; padding: 5px 8px; border: 1px solid #b9c9c5; border-radius: 6px;
      background: #fff; color: inherit; }
    .dark input[type=email] { background: #15201e; border-color: #3a524d; }
    .stop { gap: 4px 10px; }
    button.plain { font: inherit; font-size: 13px; background: none; border: 0; padding: 0; cursor: pointer; color: #1a5fb4; }
    .dark button.plain { color: #8ab4f8; }
    button.plain:hover, button.plain:focus-visible { text-decoration: underline; text-underline-offset: 2px; }
    button:disabled { opacity: 0.55; cursor: default; }
    .status { margin: 8px 0 0; font-size: 13px; }
    .status.error { color: #c5221f; } .dark .status.error { color: #f28b82; }
    ul.results { margin: 4px 0 0; padding-left: 18px; font-size: 12px; }
    ul.results .bad { color: #c5221f; } .dark ul.results .bad { color: #f28b82; }
    ${MAK.EXT_BUTTON_CSS}
    .mak-btn { padding: 4px 12px; }
  `;

  const raw = {};
  let host = null;

  // The sites with an internal mail: [{ id, name, placement }]. All: not the hidden sites.
  function mailSites() {
    const settings = MAK.withDefaults(raw.settings);
    const hidden = MAK.hiddenEverywhere(settings);
    return (raw.sites || [])
      .filter((s) => !MAK.isSpecialSite(s.id) && !hidden.has(s.id))
      .map((s) => {
        const tool = raw.pages && raw.pages[s.id] && raw.pages[s.id].tools['sakai.messages'];
        return tool && tool.placement ? { id: s.id, name: MAK.siteName(s, settings), placement: tool.placement } : null;
      })
      .filter(Boolean);
  }

  function draw() {
    const onMessages = document.getElementById('msgForum') || document.getElementById('pvtMsgSettings');
    const tool = raw.pages && raw.pages[siteId] && raw.pages[siteId].tools['sakai.messages'];
    if (!onMessages || !tool || !tool.placement || document.getElementById(HOST_ID)) return;
    const settings = MAK.withDefaults(raw.settings);
    MAK.setLang(settings.lang);
    const all = mailSites();
    const here = all.find((s) => s.id === siteId) || { id: siteId, name: siteId, placement: tool.placement };

    host = document.createElement('div');
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    const email = h('input', { attrs: { type: 'email', autocomplete: 'email', placeholder: t('fwd.placeholder'), 'aria-label': t('fwd.label'), value: settings.forwardEmail || '' } });
    const btn = (key, params, cls) => h('button', { class: cls || MAK.extButtonClass('btn'), attrs: { type: 'button' }, text: t(key, params) });
    const one = btn('fwd.one');
    const every = btn('fwd.all', { n: all.length });
    const stopOne = btn('fwd.stopOne', null, 'plain');
    const stopAll = btn('fwd.stopAll', { n: all.length }, 'plain');
    const status = h('p', { class: 'status', attrs: { role: 'status' } });
    const results = h('ul', { class: 'results' });
    const buttons = [one, every, stopOne, stopAll];
    every.disabled = stopAll.disabled = all.length < 2;

    const say = (text, error) => {
      status.textContent = text || '';
      status.className = `status${error ? ' error' : ''}`;
    };

    // Change the forward of the sites, one after the other. mode: "yes" (to the address) or "default".
    async function run(sites, mode) {
      const address = email.value.trim();
      if (mode === 'yes' && !MAK.isEmail(address)) {
        say(t('fwd.badEmail'), true);
        email.focus();
        return;
      }
      buttons.forEach((b) => { b.disabled = true; });
      results.replaceChildren();
      if (mode === 'yes') send({ type: 'setForwardEmail', email: address });
      const pm = MAK.createPm({ load: MAK.pmLoader((u, i) => fetch(u, i)) });
      let ok = 0;
      for (const [i, s] of sites.entries()) {
        if (sites.length > 1) say(t('fwd.working', { done: i + 1, n: sites.length }));
        try {
          await pm.setForward(s.placement, { mode, email: address });
          ok++;
        } catch (e) {
          results.append(h('li', { class: 'bad', text: t('fwd.siteError', { site: s.name, error: MAK.mailError(e) }) }));
        }
      }
      const done = mode === 'yes'
        ? sites.length > 1 ? t('fwd.doneAll', { ok, n: sites.length, email: address }) : t('fwd.doneOne', { email: address })
        : sites.length > 1 ? t('fwd.stoppedAll', { ok, n: sites.length }) : t('fwd.stoppedOne');
      // The Settings page of this site shows the old value until the page loads again.
      const reload = ok && document.getElementById('pvtMsgSettings') && sites.some((s) => s.id === siteId) ? ` ${t('fwd.reload')}` : '';
      if (sites.length === 1 && !ok) {
        say(results.firstChild ? results.firstChild.textContent : t('fwd.failed'), true);
        results.replaceChildren();
      } else {
        say(ok ? done + reload : t('fwd.failed'), !ok);
      }
      buttons.forEach((b) => { b.disabled = false; });
      every.disabled = stopAll.disabled = all.length < 2;
    }
    one.addEventListener('click', () => run([here], 'yes'));
    every.addEventListener('click', () => run(all, 'yes'));
    stopOne.addEventListener('click', () => run([here], 'default'));
    stopAll.addEventListener('click', () => run(all, 'default'));
    email.addEventListener('keydown', (e) => {
      e.stopPropagation(); // the keys of the page (shortcuts of MiAulario) do not get them
      if (e.key === 'Enter') run([here], 'yes');
    });

    let hidden = false;
    try { hidden = localStorage.getItem(`${HOST_ID}:hidden`) === '1'; } catch {}
    const body = h('div', null,
      h('div', { class: 'row' }, email, one, every),
      h('div', { class: 'row stop meta' }, t('fwd.stop'), stopOne, '·', stopAll),
      status,
      results,
      h('p', { class: 'meta', text: t('fwd.help') }));
    body.hidden = hidden;
    const toggle = h('button', { class: MAK.extButtonClass('btn'), attrs: { type: 'button', 'aria-expanded': String(!hidden) }, text: t(hidden ? 'guide.show' : 'guide.hide') });
    toggle.addEventListener('click', () => {
      body.hidden = !body.hidden;
      toggle.textContent = t(body.hidden ? 'guide.show' : 'guide.hide');
      toggle.setAttribute('aria-expanded', String(!body.hidden));
      try { localStorage.setItem(`${HOST_ID}:hidden`, body.hidden ? '1' : '0'); } catch {}
    });
    shadow.append(style, h('div', { class: `box${MAK.isDarkPage() ? ' dark' : ''}`, attrs: { role: 'region', 'aria-label': t('fwd.title') } },
      h('div', { class: 'head' }, h('strong', { text: `📨 ${t('fwd.title')}` }), toggle), body));
    MAK.insertAtTop(host);
  }

  function setup(next) {
    Object.assign(raw, next);
    draw();
  }
  MAK.safeCall(() => ext.storage.local.get(['pages', 'sites', 'settings']), null).then((d) => setup(d || {}));
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !MAK.extensionAlive()) return;
    const next = {};
    for (const k of ['pages', 'sites']) if (changes[k]) next[k] = changes[k].newValue;
    if (Object.keys(next).length) setup(next);
  });
})();
