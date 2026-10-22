'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib } = require('./helpers');
const MAK = loadLib('core', 'pm');

test('pmLoader: only addresses of MiAulario (the actions come from the pages); a path is of MiAulario', async () => {
  const asked = [];
  const load = MAK.pmLoader(async (u) => { asked.push(u); return { ok: false, status: 500 }; });
  await assert.rejects(load('https://evil.example/collect', { method: 'POST' }), (e) => e.code === 'pm.url');
  await assert.rejects(load('javascript:alert(1)'), (e) => e.code === 'pm.url');
  await assert.rejects(load('/portal/tool/T/compose'), (e) => e.code === 'pm.http');
  assert.deepEqual(asked, ['https://miaulario.unavarra.es/portal/tool/T/compose'], 'no request to another site');
  // A request without an answer ends (a timeout): the window does not stay busy.
  let init = null;
  const timed = MAK.pmLoader(async (u, i) => { init = i; throw new Error('aborted'); });
  await assert.rejects(timed('/portal/tool/T/compose'), (e) => e.code === 'pm.network');
  assert.ok(init.signal instanceof AbortSignal, 'with a time limit');
});

// Snapshots with the same form names as the real "Correo interno" (Messages tool of Sakai).
const TOOL = 'https://miaulario.unavarra.es/portal/tool/T';
const PICKER = `${TOOL}/sakai.filepicker.helper`;
const button = (n, label) => ({ name: `compose:j_id_jsp_1_${n}`, tag: 'input', type: 'submit', value: label, label });
function composeSnap({ labels = ['Añadir adjuntos', 'Enviar', 'Vista preliminar', 'Guardar borrador', 'Cancelar'], subject = '', text = '', error = '', noSubject = false, ids = '' } = {}) {
  const controls = [
    { name: 'compose', type: 'hidden', value: 'compose' },
    { name: 'compose:list1', tag: 'select', type: 'select-multiple', options: [
      { value: `${ids}all`, label: 'Todos los participantes', selected: false },
      { value: `${ids}role-1`, label: 'Rol Instructor', selected: false },
      { value: `${ids}u-me`, label: 'Chareca , Nicolas (chareca.1)', selected: false },
      { value: `${ids}u-2`, label: 'GARCIA LOPEZ, ANA (agarcia)', selected: false }
    ] },
    { name: 'compose:bcc_toggle', type: 'checkbox', value: 'on', checked: false },
    { name: 'compose:list2', tag: 'select', type: 'select-multiple', options: [{ value: 'u-2', label: 'GARCIA LOPEZ, ANA (agarcia)', selected: false }] },
    { name: 'compose:send_email_out', type: 'checkbox', value: 'on', checked: true },
    { name: 'compose:read_receipt', type: 'checkbox', value: 'on', checked: false },
    { name: 'compose:openDate', type: 'text', value: '' },
    { name: 'compose:viewlist', tag: 'select', type: 'select-one', options: [{ value: 'normal', label: 'Normal', selected: true }, { value: 'high', label: 'Alta', selected: false }] },
    noSubject ? null : { name: 'compose:subject', type: 'text', value: subject },
    { name: 'ckeditor-autosave-context', type: 'hidden', value: 'messages_compose' },
    { name: 'compose:pvt_message_body_inputRichText', tag: 'textarea', type: 'textarea', value: '' },
    ...labels.map((l, i) => button(90 + i, l)),
    { name: 'javax.faces.ViewState', type: 'hidden', value: 'STATE' }
  ].filter(Boolean);
  return { kind: 'compose', url: `${TOOL}/compose`, action: `${TOOL}/compose`, controls, text, error };
}
const homeSnap = () => ({ kind: 'home', url: `${TOOL}/privateMsg/pvtMsgHpView`, action: `${TOOL}/privateMsg/pvtMsgHpView`, composeLink: 'msgForum:composeMessage',
  controls: [{ name: 'msgForum', type: 'hidden', value: 'msgForum' }, { name: 'msgForum:mainOrHp', type: 'hidden', value: 'hp' }, { name: 'javax.faces.ViewState', type: 'hidden', value: 'HOME' }] });
const pickerSnap = (attached) => ({ kind: 'picker', url: `${PICKER}/tool`,
  item: { action: PICKER, controls: [{ name: 'sakai_action', type: 'hidden', value: 'doAttachitem' }, { name: 'itemId', type: 'hidden', value: '' }, { name: 'sakai_csrf_token', type: 'hidden', value: 'CSRF' }] },
  attach: { action: PICKER, controls: [{ name: 'source', type: 'hidden', value: '0' }, { name: 'sakai_action', type: 'hidden', value: '' }, { name: 'upload', type: 'file', value: '' }, { name: 'add_url', type: 'button', value: 'Añadir' }, { name: 'sakai_csrf_token', type: 'hidden', value: 'CSRF' }] },
  continueUrl: `${PICKER}?sakai_action=doAddattachments`, cancelUrl: `${PICKER}?sakai_action=doCancel`, text: attached.join(' ') });

// A fake MiAulario: it answers like the real tool and records each request.
function fakeServer(o = {}) {
  const log = [];
  const state = { subject: '', attached: [], forms: 0 };
  // "newIds": new values in the list "To" for each new compose form, as MiAulario does.
  const compose = (more) => composeSnap(Object.assign({}, o.compose, o.newIds ? { ids: `f${state.forms}-` } : {}, more));
  const entries = (b) => (b ? [...b.entries()] : []);
  async function load(url, init = {}) {
    const body = init.body || null;
    const e = entries(body);
    log.push({ url, method: init.method || 'GET', body: e, multipart: typeof FormData !== 'undefined' && body instanceof FormData });
    const has = (name, value) => e.some(([k, v]) => k === name && (value === undefined || v === value));
    if (!init.method) return o.home || homeSnap();
    if (url.endsWith('/pvtMsgHpView')) {
      state.forms++;
      return compose();
    }
    if (url === `${TOOL}/compose`) {
      const btn = e.find(([k]) => k.startsWith('compose:j_id_jsp_1_'));
      if (btn && /Añadir|Add|Eranskin/i.test(btn[1])) {
        state.subject = (e.find(([k]) => k === 'compose:subject') || [])[1] || '';
        return o.noPicker ? { kind: 'other' } : pickerSnap(state.attached);
      }
      if (btn && /^(Enviar|Send|Bidali)$/.test(btn[1])) {
        // "sendGateway": MiAulario saved the message, but the answer is an error of the gateway.
        if (o.sendGateway) throw Object.assign(new Error('504'), { code: 'pm.http' });
        if (o.sendOther) return { kind: 'other' };
        return o.sendFails ? composeSnap({ error: 'Debe seleccionar un destinatario' }) : homeSnap();
      }
      return homeSnap(); // Cancel
    }
    if (url === PICKER && has('sakai_action', 'doAttachitem')) {
      const id = (e.find(([k]) => k === 'itemId') || [])[1];
      if (!o.dropAttach && id.split('/').pop() !== o.drop) state.attached.push(id.split('/').pop());
      return pickerSnap(state.attached);
    }
    if (url.startsWith(`${PICKER}?sakai_action=`)) return compose({ subject: o.loseSubject ? '' : state.subject, text: state.attached.join(' ') });
    return { kind: 'other' };
  }
  return { load, log, state };
}
const DATA = { to: ['u-me'], subject: '[Aulario Plus] Tema 1.pdf', body: '<p>x</p>', emailCopy: true, files: [{ itemId: '/group/S/Apuntes/Tema 1.pdf', title: 'Tema 1.pdf' }, { itemId: '/group/S/b.pdf', title: 'b.pdf' }] };

test('open: the inbox, then the link "Compose" with the hidden fields of the form', async () => {
  const s = fakeServer();
  const compose = await MAK.createPm({ load: s.load }).open('T');
  assert.equal(s.log[0].url, `${TOOL}/privateMsg/pvtMsgHpView`);
  assert.deepEqual(s.log[1].body, [['msgForum', 'msgForum'], ['msgForum:mainOrHp', 'hp'], ['javax.faces.ViewState', 'HOME'], ['msgForum:composeMessage', 'msgForum:composeMessage']]);
  assert.equal(compose.buttons.send.label, 'Enviar');
  assert.equal(compose.fields.to.name, 'compose:list1');
});

test('recipients: everybody, the roles and each person; "me" is the person with the user id', () => {
  const r = MAK.pmRecipients(MAK.pmCompose(composeSnap()), 'chareca.1');
  assert.deepEqual(r.map((x) => [x.value, x.kind, x.me]), [['all', 'all', false], ['role-1', 'group', false], ['u-me', 'person', true], ['u-2', 'person', false]]);
});

test('prepare: the fields and "Add attachments", one doAttachitem for each file, then "Continue"', async () => {
  const s = fakeServer();
  const pm = MAK.createPm({ load: s.load });
  const ready = await pm.prepare(await pm.open('T'), DATA);
  const fill = s.log[2];
  assert.equal(fill.url, `${TOOL}/compose`);
  const get = (n) => fill.body.filter(([k]) => k === n).map(([, v]) => v);
  assert.deepEqual(get('compose:list1'), ['u-me']);
  assert.deepEqual(get('compose:subject'), [DATA.subject]);
  assert.deepEqual(get('compose:pvt_message_body_inputRichText'), ['<p>x</p>']);
  assert.deepEqual(get('compose:send_email_out'), ['on']);
  assert.deepEqual(get('compose:viewlist'), ['normal'], 'the other fields keep their values');
  assert.deepEqual(get('compose:list2'), [], 'no hidden copies');
  assert.deepEqual(get('compose:bcc_toggle'), []);
  assert.deepEqual(get('javax.faces.ViewState'), ['STATE']);
  assert.deepEqual(get('compose:j_id_jsp_1_90'), ['Añadir adjuntos'], 'only the button "Add attachments"');
  assert.deepEqual(get('compose:j_id_jsp_1_91'), [], 'never "Send" here');
  const attaches = s.log.filter((l) => l.url === PICKER);
  assert.equal(attaches.length, 2);
  assert.ok(attaches.every((l) => l.multipart));
  assert.deepEqual(attaches.map((l) => l.body.find(([k]) => k === 'itemId')[1]), DATA.files.map((f) => f.itemId));
  assert.ok(attaches.every((l) => l.body.some(([k, v]) => k === 'sakai_csrf_token' && v === 'CSRF')));
  assert.equal(s.log.at(-1).url, `${PICKER}?sakai_action=doAddattachments`);
  assert.ok(!s.log.at(-1).body.some(([k]) => k === 'upload' || k === 'add_url'), 'no file field, no button');
  assert.equal(ready.fields.subject.value, DATA.subject);
});

test('prepare without files: "Cancel" in the attachment page keeps the fields', async () => {
  const s = fakeServer();
  const pm = MAK.createPm({ load: s.load });
  await pm.prepare(await pm.open('T'), Object.assign({}, DATA, { files: [] }));
  assert.equal(s.log.at(-1).url, `${PICKER}?sakai_action=doCancel`);
});

test('send: the button "Send" with the data; the inbox means sent; the form again means an error', async () => {
  const s = fakeServer();
  const pm = MAK.createPm({ load: s.load });
  const ready = await pm.prepare(await pm.open('T'), DATA);
  assert.equal(await pm.send(ready, DATA), true);
  const last = s.log.at(-1).body;
  assert.ok(last.some(([k, v]) => k === 'compose:j_id_jsp_1_91' && v === 'Enviar'));
  assert.ok(!last.some(([k]) => k === 'compose:j_id_jsp_1_90'), 'only one button');

  const bad = fakeServer({ sendFails: true });
  const pm2 = MAK.createPm({ load: bad.load });
  await assert.rejects(pm2.send(await pm2.open('T'), DATA), (e) => e.code === 'pm.notSent' && /destinatario/.test(e.message));
  // An error after the post, or another page: maybe sent (MiAulario saves the message first).
  for (const o of [{ sendGateway: true }, { sendOther: true }]) {
    const odd = MAK.createPm({ load: fakeServer(o).load });
    await assert.rejects(odd.send(await odd.open('T'), DATA), { code: 'pm.sendUnknown' });
  }
});

test('recipients of an older form: found again by their text in the new form (MiAulario makes new values)', async () => {
  const s = fakeServer({ newIds: true });
  const pm = MAK.createPm({ load: s.load });
  const first = await pm.open('T');
  const me = MAK.pmRecipients(first, 'chareca.1').find((p) => p.me);
  assert.equal(me.value, 'f1-u-me');
  const data = Object.assign({}, DATA, { to: [{ value: me.value, label: me.label }] });
  const ready = await pm.prepare(await pm.open('T'), data);
  const list1 = (entry) => entry.body.filter(([k]) => k === 'compose:list1').map(([, v]) => v);
  assert.deepEqual(list1(s.log.find((l) => l.url === `${TOOL}/compose` && l.body.some(([k, v]) => /Añadir/.test(v)))), ['f2-u-me'], 'the value of the new form');
  await pm.send(ready, data);
  assert.deepEqual(list1(s.log.at(-1)), ['f2-u-me']);
  // A value of this form still works; an unknown person is an error with the name.
  const c = await pm.open('T');
  await pm.prepare(c, Object.assign({}, DATA, { to: ['f3-u-2'] }));
  await assert.rejects(pm.prepare(await pm.open('T'), Object.assign({}, DATA, { to: [{ value: 'x', label: 'NADIE, Persona (nadie)' }] })), (e) => e.code === 'pm.recipientGone' && /NADIE/.test(e.message));
});

test('prepare with "open": a recipient without a subject (the user writes it in MiAulario)', async () => {
  const s = fakeServer();
  const pm = MAK.createPm({ load: s.load });
  const data = { to: ['u-2'], subject: '', body: '', emailCopy: true, files: [] };
  await assert.rejects(pm.prepare(await pm.open('T'), data), { code: 'pm.noSubject' });
  const ready = await pm.prepare(await pm.open('T'), data, { open: true });
  assert.equal(ready.fields.subject.value, '');
  const fill = s.log.filter((l) => l.url === `${TOOL}/compose` && l.body.some(([, v]) => /Añadir/.test(v))).at(-1);
  assert.deepEqual(fill.body.filter(([k]) => k === 'compose:list1').map(([, v]) => v), ['u-2']);
  assert.equal(s.log.at(-1).url, `${PICKER}?sakai_action=doCancel`, 'no files: "Cancel" in the attachment page keeps the fields');
});

test('cancel: the button "Cancel", without recipients', async () => {
  const s = fakeServer();
  const pm = MAK.createPm({ load: s.load });
  assert.equal(await pm.cancel(await pm.open('T')), true);
  const last = s.log.at(-1).body;
  assert.ok(last.some(([k, v]) => k === 'compose:j_id_jsp_1_94' && v === 'Cancelar'));
  assert.ok(!last.some(([k]) => k === 'compose:list1'));
});

test('errors with codes: no inbox, no fields, no buttons, no attachment page, file not attached, lost fields', async () => {
  const pmWith = (o) => MAK.createPm({ load: fakeServer(o).load });
  await assert.rejects(pmWith({ home: { kind: 'other' } }).open('T'), { code: 'pm.noHome' });
  await assert.rejects(pmWith({ compose: { noSubject: true } }).open('T'), { code: 'pm.noFields' });
  await assert.rejects(pmWith({ compose: { labels: ['A', 'B', 'C', 'D'] } }).open('T'), { code: 'pm.noButtons' });
  let pm = pmWith({ noPicker: true });
  await assert.rejects(pm.prepare(await pm.open('T'), DATA), { code: 'pm.noPicker' });
  pm = pmWith({ dropAttach: true });
  await assert.rejects(pm.prepare(await pm.open('T'), DATA), (e) => e.code === 'pm.noAttach' && /Tema 1\.pdf/.test(e.message));
  // One file fails without an error page, and its name is in the name of another file ("1.pdf" in "Tema 1.pdf").
  pm = pmWith({ drop: '1.pdf' });
  const both = Object.assign({}, DATA, { files: [{ itemId: '/group/S/1.pdf', title: '1.pdf' }, { itemId: '/group/S/Apuntes/Tema 1.pdf', title: 'Tema 1.pdf' }] });
  await assert.rejects(pm.prepare(await pm.open('T'), both), (e) => e.code === 'pm.noAttach' && /: 1\.pdf$/.test(e.message));
  pm = pmWith();
  assert.ok(await pm.prepare(await pm.open('T'), both), 'both attached: fine');
  pm = pmWith({ loseSubject: true });
  await assert.rejects(pm.prepare(await pm.open('T'), DATA), { code: 'pm.lostFields' });
  pm = pmWith();
  const c = await pm.open('T');
  await assert.rejects(pm.prepare(c, Object.assign({}, DATA, { to: [] })), { code: 'pm.noRecipient' });
  await assert.rejects(pm.prepare(c, Object.assign({}, DATA, { subject: '  ' })), { code: 'pm.noSubject' });
});

test('buttons in English and Basque; an unknown language uses the place of the 5 buttons', () => {
  for (const labels of [['Add attachments', 'Send', 'Preview', 'Save draft', 'Cancel'], ['Eranskinak gehitu', 'Bidali', 'Aurrebista', 'Gorde zirriborroa', 'Utzi'], ['W', 'X', 'Y', 'Z', 'Q']]) {
    const c = MAK.pmCompose(composeSnap({ labels }));
    assert.deepEqual([c.buttons.attach.label, c.buttons.send.label, c.buttons.cancel.label], [labels[0], labels[1], labels[4]]);
  }
});

test('pmBodyHtml: paragraphs, line breaks and no HTML from the text', () => {
  assert.equal(MAK.pmBodyHtml('Hola <b>\nlínea 2\n\nOtro & más'), '<p>Hola &lt;b&gt;<br>línea 2</p><p>Otro &amp; más</p>');
  assert.equal(
    MAK.pmBodyHtml('Enlace: https://is.gd/AbC12x#k-y_Z.\n"https://a.example/x?b=1&c=2"'),
    '<p>Enlace: <a href="https://is.gd/AbC12x#k-y_Z">https://is.gd/AbC12x#k-y_Z</a>.<br>&quot;<a href="https://a.example/x?b=1&amp;c=2">https://a.example/x?b=1&amp;c=2</a>&quot;</p>'
  );
  assert.equal(MAK.pmBodyHtml('http://no.example y javascript:alert(1)'), '<p>http://no.example y javascript:alert(1)</p>', 'only https addresses become links');
});

test('inspect: up to the attachment page, then cancel and cancel; never "Send"', async () => {
  const s = fakeServer();
  const r = await MAK.createPm({ load: s.load }).inspect('T', 'chareca.1');
  assert.equal(r.recipients.filter((x) => x.me).length, 1);
  assert.deepEqual(r.picker, { item: ['sakai_action', 'itemId', 'sakai_csrf_token'], continueUrl: true, cancelUrl: true });
  assert.equal(r.closed, true);
  const urls = s.log.map((l) => l.url.replace(TOOL, ''));
  assert.deepEqual(urls, ['/privateMsg/pvtMsgHpView', '/privateMsg/pvtMsgHpView', '/compose', '/sakai.filepicker.helper?sakai_action=doCancel', '/compose']);
  assert.ok(!s.log.some((l) => l.body.some(([, v]) => v === 'Enviar')), 'never the button "Send"');
  assert.ok(!s.log.some((l) => l.url.endsWith('/sakai.filepicker.helper')), 'no file is attached');
});

test('a known language without "Send" fails: the place of the buttons is not used', () => {
  assert.throws(() => MAK.pmCompose(composeSnap({ labels: ['Añadir adjuntos', 'Vista preliminar', 'Guardar borrador', 'Otro', 'Cancelar'] })), (e) => e.code === 'pm.noButtons' && /send/.test(e.message));
});
