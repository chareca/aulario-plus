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
