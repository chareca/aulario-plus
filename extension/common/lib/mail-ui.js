// Aulario Plus: the window "Send by the internal mail". It opens in MiAulario (from the Resources
// tool, in a closed shadow root) and in a page of the extension (quick message). It always offers:
// - "Open the mail": the extension prepares the message in the internal mail of the site, and the
//   tool opens with all the data. The user examines it and sends it.
// - "Send now": the extension sends it. To me: after one confirmation.
// - "Share": the share menu of the system, if the browser has it.
// - A download link without a MiAulario login (Send), if the user enabled it: in the message, or only
//   the link to copy.
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

  // "1 día", "3 horas", "5 minutos".
  MAK.durationText = function (seconds) {
    if (seconds >= 86400 && seconds % 86400 === 0) return MAK.t('dur.days', { n: seconds / 86400 });
    if (seconds >= 3600 && seconds % 3600 === 0) return MAK.t('dur.hours', { n: seconds / 3600 });
    return MAK.t('dur.minutes', { n: Math.round(seconds / 60) });
  };

  // The text of a download link for the message: the link, the password and the limits.
  MAK.linkText = function (r) {
    const date = new Date(r.expires).toLocaleString(MAK.locale(), { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return [
      MAK.t('link.textLink', { link: r.link }),
      r.password ? MAK.t('link.textPassword', { password: r.password }) : null,
      MAK.t('link.textLimits', { n: r.downloads, date })
    ].filter(Boolean).join('\n');
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
    .linkbox { margin-top: 10px; padding: 8px; border-radius: 8px; background: rgba(127, 127, 127, 0.12); }
    .linkrow { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; }
    .linkrow input { flex: 1; min-width: 0; }
    code { font: 600 14px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.04em; }
    .confirm { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; padding: 8px; border-radius: 8px; background: rgba(127, 127, 127, 0.12); }
  `;

  // Draw the window in "into" (an element). opts:
  //   site: { id, name }, files: [{ itemId, title, url }], placement: the id of the mail tool,
  //   pm: the engine (MAK.createPm), myEid: () => Promise<user id>, openTool: () => Promise,
  //   mode: 'me' | 'others', share: { files: Promise<File[]> } or null, onClose: () => void,
  //   links: { mode, downloads, seconds, make: () => Promise<link> } or null (download links of Send).
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
        MAK.fill(peopleList);
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

    // The download link without a login (Send): made once, then in the message or to copy.
    const links = files.length && opts.links ? opts.links : null;
    const linkCheck = links ? h('input', { attrs: { type: 'checkbox', checked: true } }) : null;
    const linkBox = h('div', { class: 'linkbox', hidden: true });
    let made = null;
    async function makeLink() {
      if (made) return made;
      say(t('link.making'));
      made = await links.make();
      drawLinkBox();
      return made;
    }
    function drawLinkBox() {
      linkBox.hidden = !made;
      if (!made) return;
      const copyBtn = h('button', { text: t('link.copy'), attrs: { type: 'button' } });
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(MAK.linkText(made));
          copyBtn.textContent = t('link.copied');
        } catch {}
      });
      MAK.fill(
        linkBox,
        h('div', { class: 'linkrow' },
          h('input', { attrs: { type: 'text', readonly: true, value: made.link, 'aria-label': t('link.label') }, on: { focus: (e) => e.target.select() } }),
          copyBtn),
        made.password ? h('div', null, `${t('link.password')} `, h('code', { text: made.password })) : null,
        h('div', { class: 'help', text: MAK.linkText(made).split('\n').pop() })
      );
    }
    // Put the link in the message (one time).
    function addLinkToBody() {
      if (st.linkAdded) return;
      body.value = `${body.value.trimEnd()}\n\n${MAK.linkText(made)}`;
      st.edited.body = true;
      st.linkAdded = true;
    }

    const buttons = [];
    const lock = (on) => { st.busy = on; for (const b of buttons) b.disabled = on; };
    async function run(kind) {
      if (st.busy) return;
      lock(true);
      try {
        let d = await data();
        if (!d.to.length) throw Object.assign(new Error('pm.noRecipient'), { code: 'pm.noRecipient' });
        if (!d.subject) throw Object.assign(new Error('pm.noSubject'), { code: 'pm.noSubject' });
        if (linkCheck && linkCheck.checked) {
          await makeLink();
          addLinkToBody();
          d = await data();
        }
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
    let linkBtn = null;
    if (links) {
      linkBtn = h('button', { text: t('link.make'), attrs: { type: 'button', title: t('link.makeHelp') }, on: { click: async () => {
        if (st.busy) return;
        lock(true);
        try {
          await makeLink();
          say(t('link.made'), 'ok');
        } catch (e) {
          say(MAK.mailError(e), 'error');
        }
        lock(false);
      } } });
      buttons.push(linkBtn);
    }

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
      links
        ? h('label', { class: 'check' }, linkCheck, h('span', null, t('link.add'), h('br'), h('span', { class: 'help', text: t(links.mode === 'password' ? 'link.addHelpPassword' : 'link.addHelp', { n: links.downloads, time: MAK.durationText(links.seconds) }) })))
        : files.length ? h('p', { class: 'help', text: `${t('mail.linkNote')} ${t('link.hintSettings')}` }) : null,
      h('div', { class: 'actions' }, openBtn, sendBtn, linkBtn, shareBtn),
      linkBox,
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
