// The readers of the "Correo interno" pages (MAK.pmSnapshot), with the synthetic pages.
(function () {
  'use strict';
  const F = window.PM_FIXTURES;
  const snap = (html, url = 'x') => MAK.pmSnapshot(parse(html), url);

  test('pm: the inbox has the form and the link "Compose"', () => {
    const s = snap(F.HOME);
    assert.equal(s.kind, 'home');
    assert.equal(s.composeLink, 'msgForum:composeMessage');
    assert.equal(s.action, `${F.TOOL}/privateMsg/pvtMsgHpView`);
    assert.deepEqual(s.controls.filter((c) => c.type === 'hidden').map((c) => c.name), ['msgForum', 'msgForum:mainOrHp', 'javax.faces.ViewState']);
  });

  test('pm: the compose form gives the fields, the recipients and the buttons', () => {
    const c = MAK.pmCompose(snap(F.COMPOSE()));
    assert.deepEqual([c.fields.to.name, c.fields.subject.name, c.fields.body.name, c.fields.copy.name], ['compose:list1', 'compose:subject', 'compose:pvt_message_body_inputRichText', 'compose:send_email_out']);
    assert.equal(c.fields.copy.checked, true, 'the copy by email is on by default');
    assert.deepEqual([c.buttons.attach.label, c.buttons.send.label, c.buttons.cancel.label], ['Añadir adjuntos', 'Enviar', 'Cancelar']);
    const viewlist = c.snap.controls.find((x) => x.name === 'compose:viewlist');
    assert.deepEqual(viewlist.options.filter((o) => o.selected).map((o) => o.value), ['3']);
    const r = MAK.pmRecipients(c, 'chareca.1');
    assert.deepEqual(r.map((x) => x.kind), ['all', 'group', 'group', 'person', 'person']);
    assert.deepEqual(r.filter((x) => x.me).map((x) => x.value), ['u-me']);
  });

  test('pm: a prepared form keeps the subject, the recipient and the attached files', () => {
    const c = MAK.pmCompose(snap(F.COMPOSE({ subject: 'Hola', selected: true, attached: ['Tema 1.pdf'] })));
    assert.equal(c.fields.subject.value, 'Hola');
    assert.deepEqual(c.fields.to.options.filter((o) => o.selected).map((o) => o.value), ['u-me']);
    assert.ok(c.snap.text.includes('Tema 1.pdf'));
  });

  test('pm: an error of MiAulario in the form is in the snapshot', () => {
    assert.equal(snap(F.COMPOSE({ error: 'Debe seleccionar un destinatario' })).error, 'Debe seleccionar un destinatario');
  });

  test('pm: the attachment page gives the two forms and the addresses of "Continue" and "Cancel"', () => {
    const s = snap(F.PICKER_PAGE(['Tema 1.pdf']));
    assert.equal(s.kind, 'picker');
    assert.deepEqual(s.item.controls.map((c) => c.name), ['sakai_action', 'itemId', 'sakai_csrf_token']);
    assert.equal(s.continueUrl, `${F.PICKER}?sakai_action=doAddattachments`);
    assert.equal(s.cancelUrl, `${F.PICKER}?sakai_action=doCancel`);
    assert.ok(s.attach.controls.some((c) => c.name === 'upload' && c.type === 'file'));
  });

  test('pm: a login page or another page is "other"', () => {
    assert.equal(snap(F.LOGIN).kind, 'other');
    assert.equal(snap('<p>x</p>').kind, 'other');
  });

  // The readers and the flow together, with a fake server that answers with the synthetic pages.
  test('pm: open, prepare with a file, send', async () => {
    const state = { subject: '', attached: [] };
    const log = [];
    const load = async (url, init = {}) => {
      const body = init.body ? [...init.body.entries()] : [];
      log.push(url);
      const v = (n) => (body.find(([k]) => k === n) || [])[1];
      let html = F.LOGIN;
      if (!init.method) html = F.HOME;
      else if (url.endsWith('/pvtMsgHpView')) html = F.COMPOSE();
      else if (url === `${F.TOOL}/compose` && v('compose:j_id_jsp_1863517013_94')) { state.subject = v('compose:subject'); html = F.PICKER_PAGE(state.attached); }
      else if (url === `${F.TOOL}/compose` && v('compose:j_id_jsp_1863517013_121')) html = F.HOME;
      else if (url === F.PICKER && v('sakai_action') === 'doAttachitem') { state.attached.push(v('itemId').split('/').pop()); html = F.PICKER_PAGE(state.attached); }
      else if (url.startsWith(`${F.PICKER}?sakai_action=`)) html = F.COMPOSE({ subject: state.subject, selected: true, attached: state.attached });
      return MAK.pmSnapshot(parse(html), url);
    };
    const pm = MAK.createPm({ load });
    const data = { to: ['u-me'], subject: '[Aulario Plus] Tema 1.pdf', body: MAK.pmBodyHtml('Hola'), emailCopy: true, files: [{ itemId: '/group/S/Tema 1.pdf', title: 'Tema 1.pdf' }] };
    const ready = await pm.prepare(await pm.open('T'), data);
    assert.equal(ready.fields.subject.value, data.subject);
    assert.equal(await pm.send(ready, data), true);
    assert.deepEqual(log.map((u) => u.replace(F.TOOL, '')), ['/privateMsg/pvtMsgHpView', '/privateMsg/pvtMsgHpView', '/compose', '/sakai.filepicker.helper', '/sakai.filepicker.helper?sakai_action=doAddattachments', '/compose']);
  });
})();

// The forward of the messages of a site to an email address (Settings of the Messages tool).
(function () {
  'use strict';
  const F = window.PM_FIXTURES;
  const snap = (html, url = 'x') => MAK.pmSnapshot(parse(html), url);

  test('pm settings: the inbox has the link "Settings"; the page gives the option, the address and "Save"', () => {
    assert.equal(snap(F.HOME).settingsLink, 'msgForum:settings');
    const s = MAK.pmSettings(snap(F.SETTINGS()));
    assert.deepEqual([s.mode, s.email, s.emailEnabled, s.fields.mode, s.fields.email.name, s.buttons.save.label], ['default', '', false, 'pvtMsgSettings:fwd_msg', 'pvtMsgSettings:fwd_email', 'Guardar configuración']);
    const on = MAK.pmSettings(snap(F.SETTINGS({ mode: 'yes', email: 'yo@example.org' })));
    assert.deepEqual([on.mode, on.email, on.emailEnabled], ['yes', 'yo@example.org', true]);
    assert.equal(snap(F.SETTINGS({ error: 'Introduzca una dirección válida' })).error, 'Introduzca una dirección válida');
    assert.ok(Object.prototype.hasOwnProperty.call(MAK, 'pmSettings'));
    try { MAK.pmSettings(snap(F.HOME)); assert.ok(false); } catch (e) { assert.equal(e.code, 'pm.noSettings'); }
  });

  // A fake server with the rules of the JSF page: the address is read only if the saved option is
  // "yes"; a change of the option without a button saves only the option; "Save" checks the address.
  function server(start = { mode: 'default', email: '' }) {
    const state = Object.assign({}, start);
    const log = [];
    const load = async (url, init = {}) => {
      const body = init.body ? [...init.body.entries()] : [];
      const v = (n) => (body.find(([k]) => k === n) || [])[1];
      log.push({ url, body });
      let html = F.LOGIN;
      if (url.endsWith('/privateMsg/pvtMsgHpView') && !init.method) html = F.HOME;
      else if (url.endsWith('/privateMsg/pvtMsgHpView') && v('msgForum:settings')) html = F.SETTINGS(state);
      else if (url.endsWith('/privateMsg/pvtMsgSettings')) {
        const mode = v('pvtMsgSettings:fwd_msg') || state.mode;
        const email = state.mode === 'yes' ? v('pvtMsgSettings:fwd_email') : undefined; // disabled: not read
        if (!v('pvtMsgSettings:j_id_jsp_2_20')) {
          state.mode = mode;
          if (mode === 'yes') state.email = ''; // Sakai empties the address when the option becomes "yes"
          html = F.SETTINGS(state);
        } else if (mode === 'yes' && !MAK.isEmail(email || '')) {
          html = F.SETTINGS(Object.assign({}, state, { error: 'Introduzca una dirección de correo electrónico válida' }));
        } else {
          state.mode = mode;
          state.email = mode === 'yes' ? email : '';
          html = F.HOME;
        }
      }
      return MAK.pmSnapshot(parse(html), url);
    };
    return { load, state, log };
  }

  test('pm settings: forward a site to an address: the option, then the address and "Save", then a check', async () => {
    const s = server();
    const pm = MAK.createPm({ load: s.load });
    const r = await pm.setForward('P 1', { mode: 'yes', email: 'yo@example.org' });
    assert.deepEqual(r, { mode: 'yes', email: 'yo@example.org' });
    assert.deepEqual(s.state, { mode: 'yes', email: 'yo@example.org' });
    const posts = s.log.filter((x) => x.url.endsWith('pvtMsgSettings'));
    assert.equal(posts.length, 2, 'the option, then the address with "Save"');
    assert.ok(!posts[0].body.some(([k]) => k === 'pvtMsgSettings:j_id_jsp_2_20'), 'no button: the change of the option');
    assert.ok(posts[1].body.some(([k, v]) => k === 'pvtMsgSettings:fwd_email' && v === 'yo@example.org'));
    assert.ok(posts.every((x) => x.body.some(([k, v]) => k === 'javax.faces.ViewState' && v === 'STATE-SETTINGS')));
  });

  test('pm settings: a new address when the forward is on: one post; stop the forward: "default"', async () => {
    const s = server({ mode: 'yes', email: 'old@example.org' });
    const pm = MAK.createPm({ load: s.load });
    await pm.setForward('P', { mode: 'yes', email: 'new@example.org' });
    assert.equal(s.log.filter((x) => x.url.endsWith('pvtMsgSettings')).length, 1);
    assert.equal(s.state.email, 'new@example.org');
    const off = await pm.setForward('P', { mode: 'default' });
    assert.deepEqual(off, { mode: 'default', email: '' });
  });

  test('pm settings: a refused address and a bad address give an error with a code', async () => {
    const pm = MAK.createPm({ load: server().load });
    await assert.rejects(pm.setForward('P', { mode: 'yes', email: 'no-valid' }), 'pm.forwardEmail');
    const strict = server();
    const refuse = async (url, init) => {
      const r = await strict.load(url, init);
      return r.kind === 'home' && init && init.body && [...init.body.keys()].includes('pvtMsgSettings:j_id_jsp_2_20') ? MAK.pmSnapshot(parse(F.SETTINGS({ mode: 'yes', error: 'No permitido' })), url) : r;
    };
    await assert.rejects(MAK.createPm({ load: refuse }).setForward('P', { mode: 'yes', email: 'yo@example.org' }), 'pm.forwardRefused');
  });
})();
