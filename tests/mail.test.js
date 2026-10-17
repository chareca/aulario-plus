'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, loadBackground, fakeFetch } = require('./helpers');
const F = require('./fixtures/miaulario');
const MAK = loadLib('core', 'i18n', 'pm', 'mail-ui');

const files = [{ itemId: '/group/S/Tema 1.pdf', title: 'Tema 1.pdf' }, { itemId: '/group/S/b.zip', title: 'b.zip' }];

test('mailDefaults: the mark [Aulario Plus] only in the messages to me; the list of files in the body', () => {
  MAK.setLang('es');
  assert.equal(MAK.mailDefaults({ files: files.slice(0, 1), site: 'AAE', toMe: true }).subject, '[Aulario Plus] Tema 1.pdf');
  assert.equal(MAK.mailDefaults({ files, site: 'AAE', toMe: true }).subject, '[Aulario Plus] 2 archivos de AAE');
  assert.equal(MAK.mailDefaults({ files, site: 'AAE', toMe: false }).subject, '2 archivos de AAE');
  assert.equal(MAK.mailDefaults({ files: [], site: 'AAE', toMe: true }).subject, '[Aulario Plus] AAE');
  assert.equal(MAK.mailDefaults({ files: [], site: 'AAE', toMe: false }).subject, '');
  assert.equal(MAK.mailDefaults({ files, site: 'AAE' }).body, 'Archivos de AAE:\n- Tema 1.pdf\n- b.zip\n\nEnviado con Aulario Plus.');
  MAK.setLang('en');
  assert.equal(MAK.mailDefaults({ files, site: 'AAE', toMe: true }).subject, '[Aulario Plus] 2 files of AAE');
  MAK.setLang('es');
});

test('mailError: a known code has its own text; an unknown code says "Open the mail"', () => {
  MAK.setLang('es');
  assert.equal(MAK.mailError(new MAK.PmError('pm.noSubject')), 'Escribe un asunto.');
  assert.equal(MAK.mailError(new MAK.PmError('pm.notSent', 'Falta el asunto')), 'MiAulario no envió el mensaje: Falta el asunto');
  assert.match(MAK.mailError(new MAK.PmError('pm.noPicker', 'other')), /\(pm\.noPicker: other\).*Abrir correo/, 'the detail helps a report');
  assert.match(MAK.mailError(new Error('x')), /\(error\)/);
});

test('background: openMailTool opens the internal mail of a known site in a new tab', async () => {
  const bg = loadBackground({ fetch: fakeFetch(F.routes()) });
  await bg.send({ type: 'syncNow' });
  const CONTENT = { id: 'ext-id', tab: { id: 1 }, frameId: 0, url: `https://miaulario.unavarra.es/portal/site/${F.CS}` };
  assert.deepEqual(await bg.send({ type: 'openMailTool', siteId: F.CS }, CONTENT), { ok: true });
  assert.equal(bg.ext._tabs.at(-1).url, `https://miaulario.unavarra.es/portal/site/${F.CS}/page/${F.CS}-page-5`);
  assert.deepEqual(await bg.send({ type: 'openMailTool', siteId: 'unknown' }, CONTENT), { ok: false });
  assert.equal(await bg.send({ type: 'openMailTool', siteId: F.CS }, Object.assign({}, CONTENT, { url: 'https://evil.example/' })), null);
});

// A WebSocket with the answers of a Send server. It keeps the binary frames.
function sendServerSocket(frames) {
  return class FakeWs {
    constructor(url) {
      this.url = url;
      this.listeners = {};
      this.readyState = 0;
      this.bufferedAmount = 0;
      setTimeout(() => { this.readyState = 1; this.emit('open'); });
    }
    addEventListener(type, f) { (this.listeners[type] = this.listeners[type] || []).push(f); }
    emit(type, data) { for (const f of this.listeners[type] || []) f({ data }); }
    send(m) {
      const reply = (o) => setTimeout(() => this.emit('message', JSON.stringify(o)));
      if (typeof m === 'string') return reply({ url: 'https://send.vis.ee/download/0123456789abcdef/', id: '0123456789abcdef', ownerToken: 'owner1' });
      if (m.length === 1 && m[0] === 0) return reply({ ok: true });
      frames.push(Buffer.from(m));
    }
    close() { this.readyState = 3; this.emit('close'); }
  };
}

test('background: makeLink gets the file of MiAulario, encrypts it, uploads it and gives a short link with a password', async () => {
  const { pbkdf2Sync } = require('node:crypto');
  const { response, eceDecrypt } = require('./helpers');
  const mia = fakeFetch(F.routes());
  const asked = [];
  const fetch = async (url, init) => {
    const u = new URL(url);
    if (u.host === 'is.gd') return asked.push({ url, init }), response('https://is.gd/AbC12x', { type: 'text/plain' });
    if (u.host === 'send.vis.ee') return asked.push({ url, init }), response('OK', { type: 'text/plain' });
    if (decodeURIComponent(u.pathname) === `/access/content/group/${F.CS}/Tema 1.pdf`) return response('%PDF-1.4 the file', { url, type: 'application/pdf' });
    return mia(url, init);
  };
  const frames = [];
  const bg = loadBackground({ fetch, web: { crypto: globalThis.crypto, btoa, atob, WebSocket: sendServerSocket(frames) } });
  await bg.send({ type: 'syncNow' });
  const CONTENT = { id: 'ext-id', tab: { id: 1 }, frameId: 0, url: `https://miaulario.unavarra.es/portal/site/${F.CS}` };
  const msg = { type: 'makeLink', siteId: F.CS, name: 'Cálculo', files: [{ itemId: `/group/${F.CS}/Tema 1.pdf` }] };

  assert.deepEqual(await bg.send(msg, CONTENT), { error: 'send.disabled' }, 'off by default');
  await bg.send({ type: 'setSettings', patch: { links: { enabled: true } } });
  assert.deepEqual(await bg.send(msg, CONTENT), { error: 'send.permission' }, 'no host permission yet');
  await bg.ext.permissions.request({ origins: ['https://send.vis.ee/*', 'https://is.gd/*', 'https://spoo.me/*', 'https://tinyurl.com/*'] });

  const r = await bg.send(msg, CONTENT);
  assert.equal(r.link, 'https://is.gd/AbC12x');
  assert.match(r.password, /^[a-hjkmnp-z2-9]{8}$/);
  assert.equal(r.downloads, 1);
  // First the password, then the shortener gets the full link (with the key: the file has a password).
  assert.equal(new URL(asked[0].url).pathname, '/api/password/0123456789abcdef');
  const long = new URL(asked[1].url).searchParams.get('url');
  assert.match(long, /^https:\/\/send\.vis\.ee\/download\/0123456789abcdef\/#[\w-]{22}$/);
  assert.deepEqual(JSON.parse(asked[0].init.body), { owner_token: 'owner1', auth: pbkdf2Sync(r.password, long, 100, 64, 'sha256').toString('base64url') });
  // The server got only encrypted data, and the key of the link decrypts it.
  const stream = Buffer.concat(frames);
  assert.ok(!stream.includes(Buffer.from('the file')), 'no plain text on the server');
  assert.equal(eceDecrypt(Buffer.from(long.split('#')[1], 'base64url'), stream).toString(), '%PDF-1.4 the file');

  assert.deepEqual(await bg.send({ ...msg, siteId: 'unknown' }, CONTENT), { error: 'send.noFiles' });
  assert.deepEqual(await bg.send({ ...msg, files: [{ itemId: '/group/other-site/x.pdf' }] }, CONTENT), { error: 'send.noFiles' });
  assert.equal(await bg.send(msg, Object.assign({}, CONTENT, { url: 'https://evil.example/' })), null);
});
