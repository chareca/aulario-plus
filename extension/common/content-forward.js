// Aulario Plus: forward the internal mail ("Correo interno") of the sites to an email address of
// the user. The button "Reenviar correo interno a mi correo" of "Mi sitio" (content-shortcuts.js)
// opens a window: the address, then each site with "Forward" and "Stop", and the same for all the
// sites. The extension changes the option "Forward messages automatically" of the Settings page of
// each site (lib/pm.js), the same as the user; "Stop" sets the option "Default" again. Nothing is
// sent. The steps start only after a click: the Messages tool keeps its state in the session.
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const h = MAK.h;
  const t = (k, p) => MAK.t(k, p);
  const send = (msg) => MAK.safeCall(() => ext.runtime.sendMessage(msg), null);

  const CSS = `
    :host { all: initial; }
    .backdrop { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: flex-start; justify-content: center;
      padding-top: 6vh; background: rgba(0, 0, 0, 0.35); }
    .win { width: min(600px, calc(100vw - 32px)); max-height: calc(100vh - 12vh); overflow: auto; box-sizing: border-box; padding: 14px 18px;
      font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1d2327; background: #fff;
      border-radius: 10px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3); }
    .dark .win { color: #e8ecee; background: #1e2a28; }
    header { display: flex; align-items: center; gap: 8px; }
    h2 { flex: 1; margin: 0; font-size: 16px; }
    button.x { font: inherit; font-size: 18px; line-height: 1; background: none; border: 0; padding: 2px 6px; cursor: pointer; color: inherit; }
    .meta { color: #5f6b73; font-size: 12px; } .dark .meta { color: #9aa6ad; }
    .help { margin: 6px 0 10px; }
    input[type=email] { font: inherit; box-sizing: border-box; width: 100%; padding: 7px 10px; border: 1px solid #b9c9c5; border-radius: 6px;
      background: #fff; color: inherit; }
    .dark input[type=email] { background: #15201e; border-color: #3a524d; }
    .all { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 13px; }
    td { padding: 6px 4px; border-top: 1px solid #e1e8e6; vertical-align: middle; }
    .dark td { border-color: #2e4440; }
    td.name { font-weight: 600; overflow-wrap: anywhere; }
    td.state { font-size: 12px; color: #5f6b73; } .dark td.state { color: #9aa6ad; }
    td.state.ok { color: #137333; } .dark td.state.ok { color: #81c995; }
    td.state.bad { color: #c5221f; } .dark td.state.bad { color: #f28b82; }
    td.acts { white-space: nowrap; text-align: right; }
    td.acts button + button { margin-left: 6px; }
    button.plain { font: inherit; font-size: 13px; background: none; border: 1px solid #b9c9c5; border-radius: 6px; padding: 3px 10px; cursor: pointer; color: inherit; }
    .dark button.plain { border-color: #3a524d; }
    button:disabled { opacity: 0.55; cursor: default; }
    .status { margin: 8px 0 0; font-size: 13px; min-height: 1.4em; }
    .status.error { color: #c5221f; } .dark .status.error { color: #f28b82; }
    ${MAK.EXT_BUTTON_CSS}
    .mak-btn { padding: 5px 12px; }
  `;

  let open = null;

  // The sites with an internal mail, without the hidden sites: [{ id, name, placement }].
  async function mailSites() {
    const raw = (await MAK.safeCall(() => ext.storage.local.get(['pages', 'sites', 'settings']), null)) || {};
    const settings = MAK.withDefaults(raw.settings);
    const hidden = MAK.hiddenEverywhere(settings);
    const sites = (raw.sites || [])
      .filter((s) => !MAK.isSpecialSite(s.id) && !hidden.has(s.id))
      .map((s) => {
        const tool = raw.pages && raw.pages[s.id] && raw.pages[s.id].tools['sakai.messages'];
        return tool && tool.placement ? { id: s.id, name: MAK.siteName(s, settings), placement: tool.placement } : null;
      })
      .filter(Boolean);
    return { sites, settings };
  }

  MAK.openForwardWindow = async function () {
    if (open) return;
    const { sites, settings } = await mailSites();
    MAK.setLang(settings.lang);
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    let busy = false;
    const close = () => {
      if (busy) return;
      host.remove();
      open = null;
    };

    const email = h('input', { attrs: { type: 'email', autocomplete: 'email', placeholder: t('fwd.placeholder'), 'aria-label': t('fwd.label'), value: settings.forwardEmail || '' } });
    const status = h('p', { class: 'status', attrs: { role: 'status' } });
    const say = (text, error) => {
      status.textContent = text || '';
      status.className = `status${error ? ' error' : ''}`;
    };
    const allOn = h('button', { class: MAK.extButtonClass('btn'), attrs: { type: 'button' }, text: t('fwd.allForward', { n: sites.length }) });
    const allOff = h('button', { class: 'plain', attrs: { type: 'button' }, text: t('fwd.allStop', { n: sites.length }) });
    const rows = sites.map((s) => {
      const state = h('td', { class: 'state' });
      const on = h('button', { class: MAK.extButtonClass('btn'), attrs: { type: 'button', 'aria-label': `${t('fwd.forward')}: ${s.name}` }, text: t('fwd.forward') });
      const off = h('button', { class: 'plain', attrs: { type: 'button', 'aria-label': `${t('fwd.remove')}: ${s.name}` }, text: t('fwd.remove') });
      return { site: s, state, on, off, tr: h('tr', null, h('td', { class: 'name', text: s.name }), state, h('td', { class: 'acts' }, on, off)) };
    });
    const buttons = [allOn, allOff, ...rows.flatMap((r) => [r.on, r.off])];

    // Change the forward of the sites, one after the other. mode: "yes" (to the address) or "default".
    async function run(list, mode) {
      const address = email.value.trim();
      if (mode === 'yes' && !MAK.isEmail(address)) {
        say(t('fwd.badEmail'), true);
        email.focus();
        return;
      }
      busy = true;
      buttons.forEach((b) => { b.disabled = true; });
      if (mode === 'yes') send({ type: 'setForwardEmail', email: address });
      const pm = MAK.createPm({ load: MAK.pmLoader((u, i) => fetch(u, i)) });
      let ok = 0;
      for (const [i, r] of list.entries()) {
        say(list.length > 1 ? t('fwd.working', { done: i + 1, n: list.length }) : t('short.loading'));
        r.state.className = 'state';
        r.state.textContent = '…';
        try {
          await pm.setForward(r.site.placement, { mode, email: address });
          ok++;
          r.state.className = 'state ok';
          r.state.textContent = mode === 'yes' ? t('fwd.siteYes', { email: address }) : t('fwd.siteNo');
        } catch (e) {
          r.state.className = 'state bad';
          r.state.textContent = MAK.mailError(e);
        }
      }
      if (list.length > 1) say(ok ? t(mode === 'yes' ? 'fwd.doneAll' : 'fwd.stoppedAll', { ok, n: list.length, email: address }) : t('fwd.failed'), !ok);
      else say('');
      busy = false;
      buttons.forEach((b) => { b.disabled = false; });
    }
    allOn.addEventListener('click', () => run(rows, 'yes'));
    allOff.addEventListener('click', () => run(rows, 'default'));
    for (const r of rows) {
      r.on.addEventListener('click', () => run([r], 'yes'));
      r.off.addEventListener('click', () => run([r], 'default'));
    }

    const win = h('div', { class: 'win', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': t('fwd.title') } },
      h('header', null, h('h2', { text: `📨 ${t('fwd.title')}` }), h('button', { class: 'x', text: '✕', attrs: { type: 'button', title: t('mail.close'), 'aria-label': t('mail.close') }, on: { click: close } })),
      h('p', { class: 'help meta', text: t('fwd.help') }),
      email,
      h('div', { class: 'all' }, allOn, allOff),
      sites.length ? h('table', null, h('tbody', null, rows.map((r) => r.tr))) : h('p', { class: 'meta', text: t('fwd.noSites') }),
      status);
    const backdrop = h('div', { class: `backdrop${MAK.isDarkPage() ? ' dark' : ''}` }, win);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
    // The keys stay in the window: the page (the shortcuts of MiAulario) does not get them.
    backdrop.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') close();
    });
    shadow.append(style, backdrop);
    document.documentElement.append(host);
    open = host;
    email.focus();
  };
})();
