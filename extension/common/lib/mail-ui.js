// Aulario Plus: the window "Send as an internal message". It opens in MiAulario, from the Resources
// tool, in a closed shadow root. It always offers:
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
    // An error without its own text: the code and the detail (for a report).
    return text === key ? MAK.t('mail.error', { code: detail ? `${code}: ${detail.slice(0, 200)}` : code }) : text;
  };

  // The window of a message (the look of the theme: lib/themes.js, MAK.themedStyle, MAK.WIN_CSS).
  MAK.MAIL_CSS = () => `${MAK.WIN_CSS()}
    .mail { width: min(520px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow: auto; padding: 0 16px 14px;
      font: var(--ap-weight) calc(14px * var(--ap-zoom))/1.45 var(--ap-font); color: var(--ap-fg); background: var(--ap-win-bg);
      border: var(--ap-bw) solid var(--ap-edge); border-radius: var(--ap-radius); box-shadow: var(--ap-shadow-pop);
      -webkit-backdrop-filter: var(--ap-blur); backdrop-filter: var(--ap-blur); }
    .mail > header { display: flex; align-items: baseline; gap: 8px; margin: 0 -16px 10px; padding: 10px 16px;
      background: var(--ap-win-head-bg); color: var(--ap-win-head-fg); border-bottom: var(--ap-head-line); }
    .mail > header h2 { margin: 0 auto 0 0; font-family: var(--ap-font-head); font-weight: var(--ap-head-weight); font-style: var(--ap-head-style);
      letter-spacing: var(--ap-head-spacing); font-size: calc(17px * var(--ap-head-zoom)); padding-bottom: var(--ap-title-pad); background: var(--ap-title-deco); }
    .mail > header .muted { color: inherit; opacity: 0.8; }
    ul.files { margin: 0 0 10px; padding-left: 18px; max-height: 110px; overflow: auto; }
    .modes { display: flex; gap: 14px; margin: 6px 0 8px; }
    .people { border: var(--ap-bw-sm) solid var(--ap-line); border-radius: var(--ap-radius-box); padding: 6px; margin-bottom: 8px; }
    .people .list { max-height: 160px; overflow: auto; margin-top: 6px; }
    .people label { display: flex; gap: 6px; align-items: center; padding: 2px 0; }
    label.field { display: block; margin: 8px 0 2px; font-weight: 700; font-size: 0.93em; }
    input[type=text], input[type=search], textarea { width: 100%; }
    textarea { min-height: 90px; resize: vertical; }
    .check { display: flex; gap: 6px; align-items: center; margin: 8px 0; font-size: 0.93em; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    button { font: inherit; cursor: pointer; padding: 6px 12px; color: var(--ap-btn-fg); background: var(--ap-btn-bg);
      border: var(--ap-bw-sm) solid var(--ap-btn-edge); border-radius: var(--ap-radius-sm); box-shadow: var(--ap-shadow-sm); }
    button.primary { color: var(--ap-primary-fg); background: var(--ap-primary-bg); border-color: var(--ap-primary-edge); font-weight: 700; }
    button.x { border: 0; background: none; box-shadow: none; font-size: 18px; line-height: 1; padding: 2px 6px; color: inherit; }
    .linkbox { margin-top: 10px; padding: 8px; border-radius: var(--ap-radius-box); background: var(--ap-surface2); }
    .linkrow { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; }
    .linkrow input { flex: 1; min-width: 0; }
    code { font: 600 14px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.04em; }
    .confirm { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; padding: 8px; border-radius: var(--ap-radius-box); background: var(--ap-surface2); }
  `;

  // Draw the window in "into" (an element). opts:
  //   site: { id, name (the name for the user), fullName (the name for the recipients) },
  //   files: [{ itemId, title, url }], placement: the id of the mail tool,
  //   pm: the engine (MAK.createPm), myEid: () => Promise<user id>, openTool: () => Promise,
  //   mode: 'me' | 'others', share: { files: Promise<File[]> } or null, onClose: () => void,
  //   links: { mode, downloads, seconds, make: () => Promise<link> } or null (download links of Send).
  MAK.mailWindow = function (into, opts) {
    const { h, t } = MAK;
    const files = opts.files || [];
    const st = { mode: opts.mode || (files.length ? 'me' : 'others'), chosen: new Set(), people: null, me: null, busy: false, confirm: false, edited: { subject: false, body: false } };
    // The subject and the text go to other persons: the full name of the site, not the name from the user.
    const defaults = () => MAK.mailDefaults({ files, site: opts.site.fullName || opts.site.name, toMe: st.mode === 'me' });

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
    // MiAulario sometimes fails one time (an error 500, or the compose form again). The window
    // tries one more time, but only in the first steps: before a file is attached. Preparing never
    // sends, and "Send" is never repeated.
    const RETRY = ['pm.http', 'pm.network', 'pm.noHome', 'pm.noCompose', 'pm.noPicker'];
    const pause = () => new Promise((r) => setTimeout(r, opts.retryMs === undefined ? 1000 : opts.retryMs));
    async function openCompose() {
      try {
        return await opts.pm.open(opts.placement);
      } catch (e) {
        if (!RETRY.includes(e && e.code)) throw e;
        await pause();
        return opts.pm.open(opts.placement);
      }
    }
    async function prepareCompose(d) {
      try {
        return await opts.pm.prepare(await openCompose(), d);
      } catch (e) {
        if (!(e && e.code === 'pm.noPicker')) throw e;
        await pause();
        return opts.pm.prepare(await openCompose(), d);
      }
    }

    const loading = Promise.resolve()
      .then(async () => {
        const [compose, eid] = await Promise.all([openCompose(), opts.myEid()]);
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
      // The recipients with their text: the engine finds them again in the new compose form.
      const person = (p) => ({ value: p.value, label: p.label });
      let to;
      if (st.mode === 'me') {
        if (!st.me) throw Object.assign(new Error('noMe'), { code: 'noMe' });
        to = [person(st.me)];
      } else to = st.people.filter((p) => st.chosen.has(p.value)).map(person);
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
    // After "pm.sendUnknown" (the message may be sent), "Send now" stays off: no second message.
    const lock = (on) => { st.busy = on; for (const b of buttons) b.disabled = on || (b === sendBtn && st.maybeSent); };
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
          d.body = MAK.pmBodyHtml(body.value); // only the link is new: the recipients stay the ones of the confirmation
        }
        say(t(kind === 'send' ? 'mail.sending' : 'mail.preparing'));
        const ready = await prepareCompose(d);
        if (kind === 'send') {
          await opts.pm.send(ready, d);
          say(t('mail.sent', { n: d.to.length }), 'ok');
        } else {
          await opts.openTool();
          say(t('mail.opened'), 'ok');
        }
        setTimeout(() => opts.onClose && opts.onClose(), 1800);
      } catch (e) {
        if (e && e.code === 'pm.sendUnknown') st.maybeSent = true;
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
        h('span', { text: st.confirm }),
        h('button', { class: 'primary', text: t('mail.confirmYes'), attrs: { type: 'button' }, on: { click: () => { st.confirm = false; drawConfirm(); run('send'); } } }),
        h('button', { text: t('mail.no'), attrs: { type: 'button' }, on: { click: () => { st.confirm = false; drawConfirm(); } } })
      );
    }

    const openBtn = h('button', { text: t('mail.open'), attrs: { type: 'button', title: t('mail.openHelp') }, on: { click: () => run('open') } });
    const sendBtn = h('button', { class: 'primary', text: t('mail.sendNow'), attrs: { type: 'button' }, on: { click: () => {
      // A confirmation: a copy to the email of the user with files, or a group or all the participants.
      st.confirm = false;
      const chosen = st.mode === 'others' ? (st.people || []).filter((p) => st.chosen.has(p.value)) : [];
      if (st.mode === 'me' && files.length) st.confirm = t('mail.confirmMe', { files: t('mail.files', { n: files.length }) });
      else if (chosen.some((p) => p.kind !== 'person')) st.confirm = t('mail.confirmGroup', { list: chosen.map((p) => p.label).join(', ') });
      if (st.confirm) return drawConfirm();
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
      h('header', null, h('h2', { text: t('mail.title') }), h('span', { class: 'muted', text: opts.site.name }), close),
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
