// The download link in the mail window, and the encryption of Send with the WebCrypto of the browser.
(function () {
  'use strict';
  const until = async (fn, ms = 3000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (fn()) return true;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('timeout');
  };
  const COMPOSE = { fields: { to: { options: [{ value: 'u-all', label: 'Todos los participantes' }, { value: 'u-me', label: 'YO, Test (me1)' }, { value: 'u-2', label: 'OTRA, Ana (ana2)' }] } } };
  const FILES = [{ itemId: '/group/S/Tema 1.pdf', title: 'Tema 1.pdf' }];
  const LINK = { link: 'https://is.gd/AbC12x', password: 'k7m2x9qp', downloads: 1, expires: Date.UTC(2026, 9, 18, 12, 0) };

  function openWindow({ links, mode = 'me', fail = [] } = {}) {
    MAK.setLang('es');
    const into = document.createElement('div');
    document.body.append(into);
    const log = { made: 0, prepared: [], sent: [], opened: 0 };
    // "fail": the errors of the next calls of prepare (then it works).
    const pm = {
      open: async () => COMPOSE,
      prepare: async (c, d) => {
        log.prepared.push(d);
        const code = fail.shift();
        if (code) throw Object.assign(new Error(code), { code });
        return c;
      },
      send: async (c, d) => { log.sent.push(d); },
      cancel: async () => {}
    };
    MAK.mailWindow(into, {
      site: { id: 'S', name: 'Cálculo' }, files: FILES, mode, placement: 'P', pm,
      myEid: async () => 'me1', openTool: async () => { log.opened++; }, share: null, onClose: () => {}, retryMs: 10,
      links: links === null ? null : Object.assign({ mode: 'password', downloads: 1, seconds: 86400, make: async () => (log.made++, LINK) }, links)
    });
    const button = (text) => [...into.querySelectorAll('button')].find((b) => b.textContent === text);
    return { into, log, button, status: () => into.querySelector('.status').textContent, body: () => into.querySelector('textarea').value };
  }

  test('mail window: the link goes into the message before "Send now", one time', async () => {
    const w = openWindow();
    const check = [...w.into.querySelectorAll('label.check')].find((l) => l.textContent.includes(MAK.t('link.add')));
    assert.ok(check && check.querySelector('input').checked, 'the checkbox of the link is on');
    assert.ok(check.textContent.includes('1 descarga') && check.textContent.includes('1 día'), check.textContent);
    w.button(MAK.t('mail.sendNow')).click();
    w.button(MAK.t('mail.confirmYes')).click();
    await until(() => w.log.sent.length === 1);
    assert.equal(w.log.made, 1);
    const html = w.log.sent[0].body;
    assert.ok(html.includes('<a href="https://is.gd/AbC12x">https://is.gd/AbC12x</a>'), html);
    assert.ok(html.includes('Contraseña: k7m2x9qp'), html);
    assert.ok(/1 descarga; caduca el 18\/10\/2026/.test(html), html);
    assert.deepEqual(w.log.sent[0].to, [{ value: 'u-me', label: 'YO, Test (me1)' }], 'the recipient with its text (the engine finds it again in the new form)');
    const box = w.into.querySelector('.linkbox');
    assert.ok(!box.hidden, 'the link stays in the window');
    assert.equal(box.querySelector('input').value, 'https://is.gd/AbC12x');
    assert.equal(box.querySelector('code').textContent, 'k7m2x9qp');
    w.into.remove();
  });

  test('mail window: "Only make the link" makes it one time; "Open the mail" uses it', async () => {
    const w = openWindow();
    w.button(MAK.t('link.make')).click();
    await until(() => w.status() === MAK.t('link.made'));
    assert.equal(w.log.made, 1);
    assert.equal(w.log.prepared.length, 0, 'no message yet');
    assert.ok(!w.body().includes('is.gd'), 'not in the message yet');
    w.button(MAK.t('mail.open')).click();
    await until(() => w.log.opened === 1);
    assert.equal(w.log.made, 1, 'no second upload');
    assert.equal(w.body().split('https://is.gd/AbC12x').length, 2, 'the link is in the message one time');
    w.into.remove();
  });

  test('mail window: an error of the link stops the message, with a clear text', async () => {
    const w = openWindow({ links: { make: async () => { throw Object.assign(new Error('send.permission'), { code: 'send.permission' }); } } });
    w.button(MAK.t('mail.sendNow')).click();
    w.button(MAK.t('mail.confirmYes')).click();
    await until(() => w.status() === MAK.t('mail.error.send.permission'));
    assert.equal(w.log.prepared.length, 0);
    assert.ok(!w.button(MAK.t('mail.sendNow')).disabled, 'the buttons work again');
    w.into.remove();
  });

  test('mail window: without the links, a note tells where to enable them', async () => {
    const w = openWindow({ links: null });
    assert.ok(!w.button(MAK.t('link.make')), 'no link button');
    assert.ok(w.into.textContent.includes(MAK.t('link.hintSettings')));
    w.into.remove();
  });

  test('mail window: a message without files is an internal message, without a copy by email by default', async () => {
    MAK.setLang('es');
    const into = document.createElement('div');
    document.body.append(into);
    MAK.mailWindow(into, { site: { id: 'S', name: 'Cálculo' }, files: [], mode: 'others', placement: 'P', pm: { open: async () => COMPOSE }, myEid: async () => 'me1', openTool: async () => {}, share: null, onClose: () => {} });
    assert.ok(into.querySelector('h2').textContent.includes(MAK.t('mail.titleNew')));
    assert.ok(into.textContent.includes(MAK.t('mail.internalHelp')));
    const copy = [...into.querySelectorAll('label.check')].find((l) => l.textContent.includes(MAK.t('mail.copy'))).querySelector('input');
    assert.equal(copy.checked, false);
    into.remove();
    const w = openWindow();
    assert.equal([...w.into.querySelectorAll('label.check')].find((l) => l.textContent.includes(MAK.t('mail.copy'))).querySelector('input').checked, true, 'with files: on');
    w.into.remove();
  });

  test('mail window: one more try when MiAulario does not show the attachment page; never two sends', async () => {
    const w = openWindow({ links: null, fail: ['pm.noPicker'] });
    w.button(MAK.t('mail.sendNow')).click();
    w.button(MAK.t('mail.confirmYes')).click();
    await until(() => w.log.sent.length === 1);
    assert.equal(w.log.prepared.length, 2, 'prepared two times');
    assert.equal(w.status(), MAK.t('mail.sent', { n: 1 }));
    w.into.remove();
  });

  test('mail window: no second try after a file was attached, or after two errors', async () => {
    let w = openWindow({ links: null, fail: ['pm.noAttach'] });
    w.button(MAK.t('mail.open')).click();
    await until(() => w.status().includes('pm.noAttach') || w.status() === MAK.t('mail.error.pm.noAttach'));
    assert.equal(w.log.prepared.length, 1);
    w.into.remove();
    w = openWindow({ links: null, fail: ['pm.noPicker', 'pm.noPicker'] });
    w.button(MAK.t('mail.open')).click();
    await until(() => w.status().includes('pm.noPicker'));
    assert.equal(w.log.prepared.length, 2);
    assert.equal(w.log.sent.length + w.log.opened, 0);
    w.into.remove();
  });

  // ---- The encryption of Send in the browser -------------------------------------------

  const subtle = crypto.subtle;
  const enc = new TextEncoder();
  async function hkdf(ikm, salt, info, bytes) {
    const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode(info) }, key, bytes * 8));
  }
  // The same steps as the download page of Send (app/ece.js), with the WebCrypto of the browser.
  async function decrypt(secret, data) {
    const salt = data.slice(0, 16);
    const rs = new DataView(data.buffer, data.byteOffset).getUint32(16);
    const key = await subtle.importKey('raw', await hkdf(secret, salt, 'Content-Encoding: aes128gcm\0', 16), 'AES-GCM', false, ['decrypt']);
    const base = await hkdf(secret, salt, 'Content-Encoding: nonce\0', 12);
    const out = [];
    for (let off = 21, seq = 0; off < data.length; off += rs, seq++) {
      const nonce = base.slice();
      const v = new DataView(nonce.buffer);
      v.setUint32(8, (v.getUint32(8) ^ seq) >>> 0);
      const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, data.slice(off, off + rs)));
      let i = plain.length - 1;
      while (plain[i] === 0) i--;
      assert.equal(plain[i], off + rs >= data.length ? 2 : 1, 'the delimiter');
      out.push(plain.slice(0, i));
    }
    const all = new Uint8Array(out.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of out) { all.set(p, at); at += p.length; }
    return all;
  }

  test('send: the records and the metadata decrypt with the WebCrypto of the browser', async () => {
    const secret = crypto.getRandomValues(new Uint8Array(16));
    const data = Uint8Array.from({ length: 3 * 65536 + 123 }, (_, i) => (i * 13) % 256);
    const parts = [];
    for await (const p of MAK.sendRecords(secret, data, crypto.getRandomValues(new Uint8Array(16)))) parts.push(p);
    const stream = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) { stream.set(p, at); at += p.length; }
    const back = await decrypt(secret, stream);
    assert.equal(back.length, data.length);
    assert.ok(back.every((b, i) => b === data[i]), 'the same bytes');
    const { metaKey } = await MAK.sendKeys(secret);
    const meta = await MAK.sendMetadata(metaKey, { name: 'Tema 1.pdf', size: 9, type: 'application/pdf' });
    const key = await subtle.importKey('raw', await hkdf(secret, new Uint8Array(0), 'metadata', 16), 'AES-GCM', false, ['decrypt']);
    const json = JSON.parse(new TextDecoder().decode(await subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(12), tagLength: 128 }, key, meta)));
    assert.equal(json.name, 'Tema 1.pdf');
  });
})();
