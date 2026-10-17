// Aulario Plus: the window "Send by the internal mail". It opens in MiAulario (from the Resources
// tool, in a closed shadow root) and in a page of the extension (quick message). It always offers:
// - "Open the mail": the extension prepares the message in the internal mail of the site, and the
//   tool opens with all the data. The user examines it and sends it.
// - "Send now": the extension sends it. To me: after one confirmation.
// - "Share": the share menu of the system, if the browser has it.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});
  MAK.MAIL_MARK = '[Aulario Plus]'; // in the subject of the messages to me: a filter can forward them

  // The first subject and body of the message.
  MAK.mailDefaults = function ({ files, site, toMe }) {
    const names = (files || []).map((f) => f.title);
    let subject = names.length === 1 ? names[0] : names.length > 1 ? MAK.t('mail.subjectMany', { n: names.length, site }) : '';
    if (toMe) subject = `${MAK.MAIL_MARK} ${subject || site}`;
    const body = names.length ? `${MAK.t('mail.bodyFiles', { site })}\n${names.map((n) => `- ${n}`).join('\n')}\n\n${MAK.t('mail.bodySign')}` : '';
    return { subject: subject.trim(), body };
  };

  // The text of an error of the engine.
  MAK.mailError = function (e) {
    const code = (e && e.code) || 'error';
    const key = `mail.error.${code}`;
    const detail = e && e.message ? e.message.replace(/^[\w.]+:?\s*/, '') : '';
    const text = MAK.t(key, { detail });
    return text === key ? MAK.t('mail.error', { code }) : text;
  };

  MAK.MAIL_CSS = `
    .mail { width: min(520px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow: auto; box-sizing: border-box; padding: 14px 16px;
      font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1d2327; background: #fff;
      border-radius: 10px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3); }
    .dark .mail { color: #e8ecee; background: #1e2a28; }
    header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
    header h2 { font-size: 16px; margin: 0; flex: 1; }
    .muted, .help { color: #5f6b73; font-size: 12px; }
    .dark .muted, .dark .help { color: #9aa6ad; }
    ul.files { margin: 0 0 10px; padding-left: 18px; max-height: 110px; overflow: auto; }
    .modes { display: flex; gap: 14px; margin: 6px 0 8px; }
    .people { border: 1px solid #c9d2d6; border-radius: 8px; padding: 6px; margin-bottom: 8px; }
    .dark .people { border-color: #2e4440; }
    .people .list { max-height: 160px; overflow: auto; margin-top: 6px; }
    .people label { display: flex; gap: 6px; align-items: center; padding: 2px 0; }
    label.field { display: block; margin: 8px 0 2px; font-weight: 600; font-size: 13px; }
    input[type=text], input[type=search], textarea { box-sizing: border-box; width: 100%; font: inherit; padding: 6px 8px;
      border-radius: 6px; border: 1px solid #c9d2d6; color: inherit; background: transparent; }
    .dark input[type=text], .dark input[type=search], .dark textarea { border-color: #3a4a47; }
    textarea { min-height: 90px; resize: vertical; }
    .check { display: flex; gap: 6px; align-items: center; margin: 8px 0; font-size: 13px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    button { font: inherit; cursor: pointer; border-radius: 6px; padding: 6px 12px; border: 1px solid #c9d2d6; background: transparent; color: inherit; }
    button.primary { background: #10524e; border-color: #10524e; color: #fff; }
    .dark button.primary { background: #4fd1a5; border-color: #4fd1a5; color: #0b1a17; }
    button:disabled { opacity: 0.5; cursor: default; }
    button.x { border: 0; font-size: 18px; line-height: 1; padding: 2px 6px; }
    .status { min-height: 1.4em; margin-top: 10px; font-size: 13px; }
    .status.error { color: #c5221f; } .dark .status.error { color: #f28b82; }
    .status.ok { color: #137333; } .dark .status.ok { color: #81c995; }
    [hidden] { display: none !important; }
    .confirm { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; padding: 8px; border-radius: 8px; background: rgba(127, 127, 127, 0.12); }
  `;

  // Draw the window in "into" (an element). opts:
  //   site: { id, name }, files: [{ itemId, title, url }], placement: the id of the mail tool,
  //   pm: the engine (MAK.createPm), myEid: () => Promise<user id>, openTool: () => Promise,
  //   mode: 'me' | 'others', share: { files: Promise<File[]> } or null, onClose: () => void.
  MAK.mailWindow = function (into, opts) {
    const { h, t } = MAK;
    const files = opts.files || [];
    const st = { mode: opts.mode || (files.length ? 'me' : 'others'), chosen: new Set(), people: null, me: null, busy: false, confirm: false, edited: { subject: false, body: false } };
    const defaults = () => MAK.mailDefaults({ files, site: opts.site.name, toMe: st.mode === 'me' });

    const status = h('div', { class: 'status', attrs: { role: 'status' } });
    const say = (text, kind) => {
      status.className = `status${kind ? ` ${kind}` : ''}`;
      status.textContent = text || '';
    };
    const subject = h('input', { attrs: { type: 'text', maxlength: 250 }, on: { input: () => { st.edited.subject = true; } } });
    const body = h('textarea', { on: { input: () => { st.edited.body = true; } } });
    const copy = h('input', { attrs: { type: 'checkbox', checked: true } });
    const fillDefaults = () => {
      const d = defaults();
      if (!st.edited.subject) subject.value = d.subject;
      if (!st.edited.body) body.value = d.body;
    };

    // The recipients: the list of the site, loaded once.
    const search = h('input', { attrs: { type: 'search', placeholder: t('mail.search'), 'aria-label': t('mail.search') }, on: { input: () => drawPeople() } });
    const peopleList = h('div', { class: 'list' });
    const chosenText = h('div', { class: 'muted' });
    const people = h('div', { class: 'people', hidden: true }, search, chosenText, peopleList);
    function drawPeople() {
      if (!st.people) return MAK.fill(peopleList, h('div', { class: 'muted', text: t('mail.loading') }));
      const q = search.value;
      const shown = st.people.filter((p) => !q || MAK.matchesQuery(p.label, q)).slice(0, 80);
      MAK.fill(
        peopleList,
        shown.map((p) =>
          h('label', null,
            h('input', { attrs: { type: 'checkbox', checked: st.chosen.has(p.value) }, on: { change: (e) => { if (e.target.checked) st.chosen.add(p.value); else st.chosen.delete(p.value); drawChosen(); } } }),
            h('span', { text: p.label }))
        )
      );
    }
    const drawChosen = () => { chosenText.textContent = st.chosen.size ? t('mail.chosen', { n: st.chosen.size }) : ''; };
    const loading = Promise.resolve()
      .then(async () => {
        const [compose, eid] = await Promise.all([opts.pm.open(opts.placement), opts.myEid()]);
        const list = MAK.pmRecipients(compose, eid);
        st.me = list.find((p) => p.me) || null;
        st.people = list.filter((p) => !p.me);
        drawPeople();
        return list;
      })
      .catch((e) => {
        say(MAK.mailError(e), 'error');
        throw e;
      });
    loading.catch(() => {});

    const modeRadio = (value, label) =>
      h('label', null,
        h('input', { attrs: { type: 'radio', name: 'mail-mode', value, checked: st.mode === value }, on: { change: () => { st.mode = value; st.confirm = false; people.hidden = value !== 'others'; drawConfirm(); fillDefaults(); } } }),
        ` ${label}`);

    // The data for the engine; null (and a message) if a part is missing.
    async function data() {
      await loading;
      let to;
      if (st.mode === 'me') {
        if (!st.me) throw Object.assign(new Error('noMe'), { code: 'noMe' });
        to = [st.me.value];
      } else to = [...st.chosen];
      return { to, subject: subject.value.trim(), body: MAK.pmBodyHtml(body.value), emailCopy: copy.checked, files: files.map((f) => ({ itemId: f.itemId, title: f.title })) };
    }

    const buttons = [];
    const lock = (on) => { st.busy = on; for (const b of buttons) b.disabled = on; };
    async function run(kind) {
      if (st.busy) return;
      lock(true);
      try {
        const d = await data();
        say(t(kind === 'send' ? 'mail.sending' : 'mail.preparing'));
        const ready = await opts.pm.prepare(await opts.pm.open(opts.placement), d);
        if (kind === 'send') {
          await opts.pm.send(ready, d);
          say(t('mail.sent', { n: d.to.length }), 'ok');
        } else {
          await opts.openTool();
          say(t('mail.opened'), 'ok');
        }
        setTimeout(() => opts.onClose && opts.onClose(), 1800);
      } catch (e) {
        say(MAK.mailError(e), 'error');
        lock(false);
      }
    }

    const confirmBox = h('div', { class: 'confirm', hidden: true });
    function drawConfirm() {
      confirmBox.hidden = !st.confirm;
      if (!st.confirm) return;
      MAK.fill(
        confirmBox,
        h('span', { text: t('mail.confirmMe', { files: t('mail.files', { n: files.length }) }) }),
        h('button', { class: 'primary', text: t('mail.confirmYes'), attrs: { type: 'button' }, on: { click: () => { st.confirm = false; drawConfirm(); run('send'); } } }),
        h('button', { text: t('mail.no'), attrs: { type: 'button' }, on: { click: () => { st.confirm = false; drawConfirm(); } } })
      );
    }

    const openBtn = h('button', { text: t('mail.open'), attrs: { type: 'button', title: t('mail.openHelp') }, on: { click: () => run('open') } });
    const sendBtn = h('button', { class: 'primary', text: t('mail.sendNow'), attrs: { type: 'button' }, on: { click: () => {
      if (st.mode === 'me' && files.length) { st.confirm = true; return drawConfirm(); }
      run('send');
    } } });
    buttons.push(openBtn, sendBtn);

    let shareBtn = null;
    if (opts.share && files.length) {
      shareBtn = h('button', { text: t('mail.share'), attrs: { type: 'button', title: t('mail.shareHelp'), disabled: true } });
      buttons.push(shareBtn);
      let ready = null;
      opts.share.files
        .then((list) => {
          ready = list;
          if (!st.busy) shareBtn.disabled = false;
        })
        .catch((e) => {
          shareBtn.title = e && e.code === 'tooBig' ? t('mail.shareTooBig') : t('mail.shareHelp');
        });
      shareBtn.addEventListener('click', async () => {
        if (!ready) return;
        try {
          await navigator.share({ files: ready, title: subject.value.trim() });
        } catch (e) {
          if (!e || e.name !== 'AbortError') say(MAK.mailError(e), 'error');
        }
      });
    }

    const close = h('button', { class: 'x', text: '✕', attrs: { type: 'button', title: t('mail.close'), 'aria-label': t('mail.close') }, on: { click: () => !st.busy && opts.onClose && opts.onClose() } });
    const win = h(
      'div',
      { class: 'mail', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': t('mail.title') } },
      h('header', null, h('h2', { text: `✉ ${t('mail.title')}` }), h('span', { class: 'muted', text: opts.site.name }), close),
      files.length ? [h('div', { class: 'muted', text: t('mail.files', { n: files.length }) }), h('ul', { class: 'files' }, files.map((f) => h('li', { text: f.title })))] : null,
      h('div', { class: 'modes', attrs: { role: 'radiogroup' } }, modeRadio('me', t('mail.toMe')), modeRadio('others', t('mail.toOthers'))),
      people,
      h('label', { class: 'field', text: t('mail.subject') }),
      subject,
      h('label', { class: 'field', text: t('mail.message') }),
      body,
      h('label', { class: 'check' }, copy, h('span', { text: t('mail.copy') })),
      h('div', { class: 'actions' }, openBtn, sendBtn, shareBtn),
      confirmBox,
      status
    );
    people.hidden = st.mode !== 'others';
    fillDefaults();
    drawPeople();
    MAK.fill(into, win);
    (st.mode === 'others' ? search : subject).focus();
    return { win, isBusy: () => st.busy };
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
