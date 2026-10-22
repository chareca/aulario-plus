// Aulario Plus: the engine of the internal mail of MiAulario ("Correo interno"). It is the
// Messages tool of Sakai (sakai.messages). MiAulario has no API to send a message, so the engine
// uses the forms of the tool, the same as a person:
//   inbox -> "Compose" -> fields + "Add attachments" -> attach each file -> "Continue" -> "Send".
// It also changes the forward of the messages of a site to an email address of the user:
//   inbox -> "Settings" -> "Forward messages automatically: Yes" -> address -> "Save settings".
// The files come from the Resources tool of the site: the server attaches a copy, nothing is
// downloaded. The forms are JSF pages. MiAulario can change them, so:
// - The readers (pmSnapshot) turn each page into plain data. Only they use the DOM.
// - The flow (createPm) uses only that data. The tests check both parts.
// - Each problem gives an error with a code (pm.noCompose, ...). The diagnostic page uses them.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  class PmError extends Error {
    constructor(code, detail) {
      super(detail ? `${code}: ${detail}` : code);
      this.code = code;
    }
  }
  MAK.PmError = PmError;

  // The texts of the buttons of the compose form (Spanish, English, Basque).
  MAK.PM_LABELS = {
    attach: /^(añadir adjuntos|add attachments|eranskinak gehitu|gehitu eranskinak)$/i,
    send: /^(enviar|send|bidali)$/i,
    cancel: /^(cancelar|cancel|utzi|ezeztatu)$/i,
    save: /^(guardar configuración|guardar|save settings|save|gorde|ezarpenak gorde)$/i
  };

  const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  // An email address for the forward (Sakai checks it again).
  MAK.isEmail = (v) => typeof v === 'string' && v.length <= 200 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(v);

  // ---- Readers (DOM) ---------------------------------------------------------------

  // The controls of a form. withDisabled: also the disabled controls, with "disabled" (the browser
  // does not send them).
  function controls(form, withDisabled) {
    return [...form.querySelectorAll('input, select, textarea, button')]
      .filter((e) => e.name && (withDisabled || !e.disabled))
      .map((e) => ({
        disabled: !!e.disabled,
        name: e.name,
        tag: e.tagName.toLowerCase(),
        type: (e.type || '').toLowerCase(),
        value: e.tagName === 'SELECT' ? '' : e.value || '',
        label: oneLine(e.value || e.textContent),
        checked: !!e.checked,
        options: e.tagName === 'SELECT' ? [...e.options].map((o) => ({ value: o.value, label: oneLine(o.textContent), selected: o.selected })) : null
      }));
  }

  // One page of the tool -> { kind: 'home' | 'compose' | 'picker' | 'settings' | 'other', ... }.
  MAK.pmSnapshot = function (doc, url) {
    const home = doc.getElementById('msgForum');
    const compose = doc.getElementById('compose');
    const settings = doc.getElementById('pvtMsgSettings');
    const errorOf = (form) => [...form.querySelectorAll('.alertMessage, .sak-banner-error, .messageError, .alert-danger')].map((e) => oneLine(e.textContent)).filter(Boolean).join(' ');
    if (settings) return { kind: 'settings', url, action: settings.getAttribute('action'), controls: controls(settings, true), error: errorOf(settings) };
    const item = doc.getElementById('doattachitem');
    const attach = doc.getElementById('attachForm');
    if (compose) {
      // The text without the fields: the body of the message lists the files, the attached ones are in the text.
      const shown = compose.cloneNode(true);
      for (const el of shown.querySelectorAll('select, textarea, script')) el.remove();
      return { kind: 'compose', url, action: compose.getAttribute('action'), controls: controls(compose), text: oneLine(shown.textContent), error: errorOf(compose) };
    }
    if (item && attach) {
      const continueBtn = doc.querySelector('[name=attachButton], #attachButton');
      const cancelBtn = doc.querySelector('[name=cancelButton], #cancelButton');
      const urlIn = (btn) => {
        const m = btn && /action\s*=\s*'([^']+)'/.exec(btn.getAttribute('onclick') || '');
        return m ? m[1] : null;
      };
      return {
        kind: 'picker',
        url,
        item: { action: item.getAttribute('action'), controls: controls(item) },
        attach: { action: attach.getAttribute('action'), controls: controls(attach) },
        continueUrl: urlIn(continueBtn),
        cancelUrl: urlIn(cancelBtn),
        text: oneLine(doc.body ? doc.body.textContent : '')
      };
    }
    if (home && doc.getElementById('msgForum:composeMessage')) {
      return { kind: 'home', url, action: home.getAttribute('action'), controls: controls(home), composeLink: 'msgForum:composeMessage', settingsLink: doc.getElementById('msgForum:settings') ? 'msgForum:settings' : null };
    }
    return { kind: 'other', url, title: oneLine(doc.title) };
  };

  // load(url, init) -> snapshot, with fetch and DOMParser (content scripts and extension pages).
  MAK.pmLoader = function (doFetch) {
    return async function (url, init) {
      // Only MiAulario: the addresses come from the forms of the pages, and a request carries the session.
      const target = MAK.safeSiteUrl(url);
      if (!target) throw new PmError('pm.url', String(url).slice(0, 100));
      let res;
      try {
        // A request without an answer in 60 s fails (the network went away): the window does not stay busy. A send
        // that fails so is "maybe sent" (pm.sendUnknown): no second send.
        res = await doFetch(target, Object.assign({ credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(60000) }, init));
      } catch {
        throw new PmError('pm.network');
      }
      if (!res.ok) throw new PmError('pm.http', String(res.status));
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      return MAK.pmSnapshot(doc, res.url || target);
    };
  };

  // ---- Flow (no DOM) ---------------------------------------------------------------

  const ends = (suffix) => (c) => c.name === suffix || c.name.endsWith(`:${suffix}`);
  const FIELDS = { to: ends('list1'), subject: ends('subject'), body: ends('pvt_message_body_inputRichText'), copy: ends('send_email_out') };

  // The fields and buttons of a compose page. Error if a part is missing.
  MAK.pmCompose = function (snap) {
    if (!snap || snap.kind !== 'compose') throw new PmError('pm.noCompose', snap && snap.kind);
    const find = (test) => snap.controls.find(test) || null;
    const fields = { to: find(FIELDS.to), subject: find(FIELDS.subject), body: find(FIELDS.body), copy: find(FIELDS.copy) };
    const missing = ['to', 'subject', 'body'].filter((k) => !fields[k]);
    if (missing.length) throw new PmError('pm.noFields', missing.join(', '));
    const submits = snap.controls.filter((c) => c.type === 'submit');
    // By the text of the button. Only if no button has a known text (an unknown language), by
    // its place in the 5 buttons. Never mix the two: a missing "Send" must not become "Preview".
    const known = submits.some((b) => Object.values(MAK.PM_LABELS).some((re) => re.test(b.label)));
    const button = (re, index) => submits.find((b) => re.test(b.label)) || (!known && submits.length === 5 ? submits[index] : null);
    const buttons = { attach: button(MAK.PM_LABELS.attach, 0), send: button(MAK.PM_LABELS.send, 1), cancel: button(MAK.PM_LABELS.cancel, 4) };
    const noButtons = Object.keys(buttons).filter((k) => !buttons[k]);
    if (noButtons.length) throw new PmError('pm.noButtons', noButtons.join(', '));
    return { snap, fields, buttons };
  };

  // The recipients of the "To" list: everybody, the roles or groups, and each person.
  MAK.pmRecipients = function (compose, myEid) {
    return compose.fields.to.options.map((o, i) => {
      const person = /,.*\(([^()]+)\)\s*$/.exec(o.label);
      return { value: o.value, label: o.label, kind: person ? 'person' : i === 0 ? 'all' : 'group', me: !!person && !!myEid && person[1] === myEid };
    });
  };

  // The body of the compose form: the data of the message, and the button that the user "clicks".
  function composeBody(compose, data, button) {
    const out = new URLSearchParams();
    const { fields } = compose;
    for (const c of compose.snap.controls) {
      if (c.type === 'submit' || c.type === 'button' || c.type === 'file') continue;
      if (c === fields.to) data.to.forEach((v) => out.append(c.name, v));
      else if (c === fields.subject) out.append(c.name, data.subject);
      else if (c === fields.body) out.append(c.name, data.body);
      else if (c === fields.copy) { if (data.emailCopy) out.append(c.name, 'on'); }
      else if (c.options) c.options.filter((o) => o.selected).forEach((o) => out.append(c.name, o.value));
      else if (c.type === 'checkbox' || c.type === 'radio') { if (c.checked) out.append(c.name, c.value || 'on'); }
      else out.append(c.name, c.value);
    }
    out.append(button.name, button.value || button.label);
    return out;
  }

  function multipart(form, set) {
    const out = new FormData();
    for (const c of form.controls) if (c.type !== 'file' && c.type !== 'button' && c.type !== 'submit') out.append(c.name, c.value);
    for (const [k, v] of Object.entries(set || {})) out.set(k, v);
    return out;
  }

  // Plain text -> the HTML of the message body.
  MAK.pmBodyHtml = function (text) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    // An "https://" address becomes a link (the copy by email also has a link that works).
    const links = (s) => s.split(/(https:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]])/).map((part, i) => (i % 2 ? `<a href="${esc(part)}">${esc(part)}</a>` : esc(part))).join('');
    return String(text || '')
      .split(/\n{2,}/)
      .map((p) => `<p>${links(p).replace(/\n/g, '<br>')}</p>`)
      .join('');
  };

  // The settings page: the forward of the messages ("yes", "no" or "default"), the address and
  // the button "Save settings". Error if a part is missing.
  MAK.FORWARD_MODES = ['yes', 'no', 'default'];
  MAK.pmSettings = function (snap) {
    if (!snap || snap.kind !== 'settings') throw new PmError('pm.noSettings', snap && snap.kind);
    const radios = snap.controls.filter(ends('fwd_msg')).filter((c) => c.type === 'radio');
    const email = snap.controls.find(ends('fwd_email')) || null;
    const save = snap.controls.find((c) => c.type === 'submit' && MAK.PM_LABELS.save.test(c.label)) || null;
    if (!radios.length || !MAK.FORWARD_MODES.every((m) => radios.some((r) => r.value === m)) || !email) throw new PmError('pm.noForwardFields');
    if (!save) throw new PmError('pm.noButtons', 'save');
    const checked = radios.find((r) => r.checked);
    return { snap, mode: checked ? checked.value : 'default', email: email.value || '', emailEnabled: !email.disabled, fields: { mode: radios[0].name, email }, buttons: { save } };
  };

  // The body of the settings form: the values of the page, with this forward and address. Without a
  // button: the same as the change of the option (the page sends itself).
  function settingsBody(settings, { mode, email }, button) {
    const out = new URLSearchParams();
    for (const c of settings.snap.controls) {
      if (c.type === 'submit' || c.type === 'button' || c.type === 'file') continue;
      if (c.name === settings.fields.mode) { if (c.value === mode) out.append(c.name, c.value); continue; }
      if (c === settings.fields.email) { if (!c.disabled && mode === 'yes') out.append(c.name, email || ''); continue; }
      if (c.disabled) continue;
      if (c.options) c.options.filter((o) => o.selected).forEach((o) => out.append(c.name, o.value));
      else if (c.type === 'checkbox' || c.type === 'radio') { if (c.checked) out.append(c.name, c.value || 'on'); }
      else out.append(c.name, c.value);
    }
    if (button) out.append(button.name, button.value || button.label);
    return out;
  }

  function checkData(data, needSubject = true) {
    if (!data || !Array.isArray(data.to) || !data.to.length) throw new PmError('pm.noRecipient');
    if (needSubject && !String(data.subject || '').trim()) throw new PmError('pm.noSubject');
  }

  // MiAulario gives new values to the list "To" each time it makes the compose form (live test:
  // 75 of 75 values changed, the texts did not). A value of an older form gives the error
  // "compose:list1: Error de validación: el valor no es válido". Thus each recipient ({ value,
  // label } from MAK.pmRecipients, or a value of this form) is found again by its text.
  function resolveTo(compose, to) {
    const options = compose.fields.to.options;
    const byLabel = new Map(options.map((o) => [o.label, o.value]));
    const values = new Set(options.map((o) => o.value));
    return to.map((r) => {
      const label = r && typeof r === 'object' ? r.label : null;
      const value = r && typeof r === 'object' ? r.value : r;
      if (label && byLabel.has(label)) return byLabel.get(label);
      if (values.has(value)) return value;
      throw new PmError(label ? 'pm.recipientGone' : 'pm.noRecipient', label || '');
    });
  }
  const withTo = (compose, data) => Object.assign({}, data, { to: resolveTo(compose, data.to) });

  MAK.createPm = function ({ load }) {
    const post = (url, body) => load(url, { method: 'POST', body });

    // The empty compose form of the tool (placement: the id of the tool in the site).
    async function open(placement) {
      const home = await load(`${MAK.BASE}/portal/tool/${encodeURIComponent(placement)}/privateMsg/pvtMsgHpView`);
      if (home.kind !== 'home') throw new PmError('pm.noHome', home.kind);
      const body = new URLSearchParams();
      for (const c of home.controls) if (c.type === 'hidden') body.append(c.name, c.value);
      body.set(home.composeLink, home.composeLink);
      return MAK.pmCompose(await post(home.action, body));
    }

    // Fill the form and attach the files on the server. The result is the compose form with
    // all the data: "Send" sends it, or the user opens the tool and sees it ready.
    // opts.open: only the recipients are necessary; the user writes the subject in MiAulario.
    async function prepare(compose, given, opts = {}) {
      checkData(given, !opts.open);
      const data = withTo(compose, given);
      const files = data.files || [];
      let pick = await post(compose.snap.action, composeBody(compose, data, compose.buttons.attach));
      // MiAulario can show the compose form again with an error (the text tells why).
      if (pick.kind !== 'picker') throw new PmError('pm.noPicker', pick.kind === 'compose' && pick.error ? `compose: ${pick.error}` : pick.kind);
      for (const f of files) {
        pick = await post(pick.item.action, multipart(pick.item, { itemId: f.itemId }));
        if (pick.kind !== 'picker') throw new PmError('pm.noAttach', f.title);
      }
      // "Continue" with files; "Cancel" without files (the fields stay in both cases).
      const url = files.length
        ? pick.continueUrl || `${pick.attach.action}?sakai_action=doAddattachments`
        : pick.cancelUrl || `${pick.attach.action}?sakai_action=doCancel`;
      const next = MAK.pmCompose(await post(url, multipart(pick.attach)));
      // A file is in the page as many times as the requested names that contain its name: "1.pdf" also is in
      // "Tema 1.pdf", so with both the page has "1.pdf" two times (a failed "1.pdf" is missing).
      const times = (part) => next.snap.text.split(part).length - 1;
      const missing = files.filter((f) => times(f.title) < files.filter((g) => g.title.includes(f.title)).length).map((f) => f.title);
      if (missing.length) throw new PmError('pm.noAttach', missing.join(', '));
      if (next.fields.subject.value.trim() !== String(data.subject).trim()) throw new PmError('pm.lostFields');
      return next;
    }

    // Send the prepared message. MiAulario then shows the inbox. It saves the message before it sends
    // the copies by email (Sakai 23, PrivateMessageManagerImpl.sendPrivateMessage): an error after the
    // post (the network, a gateway, another page) can come after the message was sent ("pm.sendUnknown").
    async function send(compose, given) {
      checkData(given);
      const data = withTo(compose, given);
      const after = await post(compose.snap.action, composeBody(compose, data, compose.buttons.send)).catch((e) => {
        throw new PmError('pm.sendUnknown', (e && e.code) || '');
      });
      if (after.kind === 'compose') throw new PmError('pm.notSent', after.error || '');
      if (after.kind !== 'home') throw new PmError('pm.sendUnknown', after.kind);
      return true;
    }

    // Leave the compose form (nothing is sent).
    async function cancel(compose) {
      const data = { to: [], subject: '', body: '', emailCopy: false };
      const after = await post(compose.snap.action, composeBody(compose, data, compose.buttons.cancel));
      return after.kind === 'home';
    }

    // For the checks of MiAulario: go through the forms up to the attachment page, then cancel
    // the attachment page and the compose form. Nothing is sent and nothing is attached.
    async function inspect(placement, myEid) {
      const compose = await open(placement);
      const recipients = MAK.pmRecipients(compose, myEid);
      const empty = { to: [], subject: '', body: '', emailCopy: false };
      const pick = await post(compose.snap.action, composeBody(compose, empty, compose.buttons.attach));
      if (pick.kind !== 'picker') throw new PmError('pm.noPicker', pick.kind);
      const picker = { item: pick.item.controls.map((c) => c.name), continueUrl: !!pick.continueUrl, cancelUrl: !!pick.cancelUrl };
      const back = MAK.pmCompose(await post(pick.cancelUrl || `${pick.attach.action}?sakai_action=doCancel`, multipart(pick.attach)));
      const closed = await cancel(back);
      return { compose, recipients, picker, closed };
    }

    // The settings page of the internal mail of a site: { mode, email, ... } (MAK.pmSettings).
    async function settings(placement) {
      const home = await load(`${MAK.BASE}/portal/tool/${encodeURIComponent(placement)}/privateMsg/pvtMsgHpView`);
      if (home.kind !== 'home') throw new PmError('pm.noHome', home.kind);
      if (!home.settingsLink) throw new PmError('pm.noSettings', 'link');
      const body = new URLSearchParams();
      for (const c of home.controls) if (c.type === 'hidden') body.append(c.name, c.value);
      body.set(home.settingsLink, home.settingsLink);
      return MAK.pmSettings(await post(home.action, body));
    }

    // Forward the messages of a site to an address ("yes"), or stop it ("default": the option of
    // the site; "no"). The same steps as a person: the address field opens only after the option
    // "Yes" is saved in the page, so first the option, then the address and "Save settings". Then
    // the page is read again to make sure that MiAulario keeps the new value.
    async function setForward(placement, { mode, email }) {
      if (!MAK.FORWARD_MODES.includes(mode)) throw new PmError('pm.forwardMode', String(mode));
      if (mode === 'yes' && !MAK.isEmail(email)) throw new PmError('pm.forwardEmail');
      let page = await settings(placement);
      if (mode === 'yes' && (page.mode !== 'yes' || !page.emailEnabled)) {
        page = MAK.pmSettings(await post(page.snap.action, settingsBody(page, { mode: 'yes' })));
        if (page.mode !== 'yes' || !page.emailEnabled) throw new PmError('pm.forwardNotSaved', 'option');
      }
      const after = await post(page.snap.action, settingsBody(page, { mode, email }, page.buttons.save));
      if (after.kind === 'settings') throw new PmError('pm.forwardRefused', after.error || '');
      const check = await settings(placement);
      if (check.mode !== mode || (mode === 'yes' && check.email.toLowerCase() !== email.toLowerCase())) throw new PmError('pm.forwardNotSaved', check.mode);
      return { mode: check.mode, email: check.email };
    }

    return { open, prepare, send, cancel, inspect, settings, setForward };
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
