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

  // The look comes from the theme (lib/themes.js, MAK.themedStyle) and MAK.WIN_CSS.
  const CSS = () => `${MAK.WIN_CSS()}
    .win { width: min(600px, calc(100vw - 32px)); max-height: calc(100vh - 12vh); }
    .help { margin: 0 0 10px; }
    input[type=email] { width: 100%; padding: 7px 10px; }
    .all { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 6px; }
    table { margin-top: 6px; }
    td.name { font-weight: 700; overflow-wrap: anywhere; }
    td.state { font-size: 0.86em; color: var(--ap-muted); }
    td.state.ok { color: var(--ap-green); }
    td.state.bad { color: var(--ap-red); }
    td.acts { white-space: nowrap; text-align: right; }
    td.acts button + button { margin-left: 6px; }
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
    const style = MAK.themedStyle(CSS());
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
      h('header', null, h('h2', { text: t('fwd.title') }), h('button', { class: 'x', text: '✕', attrs: { type: 'button', title: t('mail.close'), 'aria-label': t('mail.close') }, on: { click: close } })),
      h('p', { class: 'help meta', text: t('fwd.help') }),
      email,
      h('div', { class: 'all' }, allOn, allOff),
      sites.length ? h('table', null, h('tbody', null, rows.map((r) => r.tr))) : h('p', { class: 'meta', text: t('fwd.noSites') }),
      status);
    const backdrop = h('div', { class: 'backdrop' }, win);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
    // The keys stay in the window: the page (the shortcuts of MiAulario) does not get them.
    backdrop.addEventListener('keydown', (e) => e.stopPropagation());
    shadow.append(style, backdrop);
    document.documentElement.append(host);
    MAK.escCloses(win, close);
    open = host;
    email.focus();
  };
})();
