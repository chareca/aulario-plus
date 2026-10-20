'use strict';
// The client of Send. The tests decrypt with the crypto module of Node (an other implementation),
// with the same steps as the download page of Send.
const test = require('node:test');
const assert = require('node:assert/strict');
const { hkdfSync, pbkdf2Sync, createDecipheriv } = require('node:crypto');
const { loadLib } = require('./helpers');
const { response, eceDecrypt } = require('./helpers');
const MAK = loadLib('core', 'i18n', 'store', 'zip', 'send');

const SERVER = 'https://send.example';
const RS = 64 * 1024;
const CHUNK = RS - 17;

// Bytes that a test can know: 1, 2, 3, ...
const counter = () => {
  let n = 0;
  return (len) => Uint8Array.from({ length: len }, () => ++n % 256);
};
const bytes = (len) => Uint8Array.from({ length: len }, (_, i) => (i * 7 + 3) % 251);

async function collect(gen) {
  const parts = [];
  for await (const p of gen) parts.push(p);
  return Buffer.concat(parts);
}

// A WebSocket for the tests. "server(ws, message)" answers, as the Send server.
function fakeSocket(server, { failOpen = false } = {}) {
  const sockets = [];
  class FakeWs {
    constructor(url) {
      this.url = url;
      this.sent = [];
      this.listeners = {};
      this.readyState = 0;
      this.bufferedAmount = 0;
      sockets.push(this);
      setTimeout(() => {
        if (failOpen) return this.close();
        this.readyState = 1;
        this.emit('open');
      });
    }
    addEventListener(type, f) {
      (this.listeners[type] = this.listeners[type] || []).push(f);
    }
    emit(type, data) {
      for (const f of this.listeners[type] || []) f({ data });
    }
    reply(obj) {
      setTimeout(() => this.emit('message', JSON.stringify(obj)));
    }
    send(m) {
      this.sent.push(typeof m === 'string' ? m : Buffer.from(m));
      server(this, m);
    }
    close() {
      if (this.readyState === 3) return;
      this.readyState = 3;
      this.emit('close');
    }
  }
  return { FakeWs, sockets };
}

// The normal Send server: the answer with the address, then {ok: true} after the byte 0.
const normalServer = (ws, m) => {
  if (typeof m === 'string') ws.reply({ url: `${SERVER}/download/0123456789abcdef/`, id: '0123456789abcdef', ownerToken: 'owner1' });
  else if (m.length === 1 && m[0] === 0) ws.reply({ ok: true });
};
const streamOf = (ws) => Buffer.concat(ws.sent.slice(1, -1));

test('b64url: no "+", "/" or "=", and the reverse gives the same bytes', () => {
  for (const len of [0, 1, 2, 3, 16, 64]) {
    const b = Uint8Array.from({ length: len }, (_, i) => (i * 61 + 250) % 256);
    const s = MAK.b64url(b);
    assert.doesNotMatch(s, /[+/=]/);
    assert.deepEqual([...MAK.fromB64url(s)], [...b]);
  }
  assert.equal(MAK.b64url(new Uint8Array(16)).length, 22, 'a key of 16 bytes has 22 characters');
});

test('the keys are the same as HKDF-SHA-256 of Node (metadata, authentication)', async () => {
  const secret = bytes(16);
  const { metaKey, authKey } = await MAK.sendKeys(secret);
  assert.deepEqual(Buffer.from(metaKey), Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), 'metadata', 16)));
  assert.deepEqual(Buffer.from(authKey), Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), 'authentication', 64)));
});

test('the metadata decrypt with AES-128-GCM and an IV of zeros', async () => {
  const { metaKey } = await MAK.sendKeys(bytes(16));
  const enc = Buffer.from(await MAK.sendMetadata(metaKey, { name: 'Tema 1.pdf', size: 1234, type: 'application/pdf' }));
  const d = createDecipheriv('aes-128-gcm', Buffer.from(metaKey), Buffer.alloc(12));
  d.setAuthTag(enc.subarray(enc.length - 16));
  const json = JSON.parse(Buffer.concat([d.update(enc.subarray(0, enc.length - 16)), d.final()]).toString());
  assert.deepEqual(json, { name: 'Tema 1.pdf', size: 1234, type: 'application/pdf', manifest: { files: [{ name: 'Tema 1.pdf', size: 1234, type: 'application/pdf' }] } });
});

test('the records decrypt for each size (one byte, one record, records and some bytes)', async () => {
  const secret = bytes(16);
  for (const len of [1, 100, CHUNK - 1, CHUNK, CHUNK + 1, 3 * CHUNK + 5]) {
    const data = bytes(len);
    const enc = await collect(MAK.sendRecords(secret, data, Uint8Array.from({ length: 16 }, (_, i) => i)));
    assert.deepEqual(eceDecrypt(secret, enc), Buffer.from(data), `size ${len}`);
  }
});

test('upload: the first message, the records, the byte 0 and the link with the key after "#"', async () => {
  const { FakeWs, sockets } = fakeSocket(normalServer);
  const data = bytes(2 * CHUNK + 10);
  const progress = [];
  const r = await MAK.sendUpload({ server: SERVER, data, name: 'a.pdf', type: 'application/pdf', downloads: 1, seconds: 86400, WebSocketImpl: FakeWs, random: counter(), onProgress: (n) => progress.push(n) });
  const ws = sockets[0];
  assert.equal(ws.url, 'wss://send.example/api/ws');
  const first = JSON.parse(ws.sent[0]);
  assert.equal(first.timeLimit, 86400);
  assert.equal(first.dlimit, 1);
  const secret = Uint8Array.from({ length: 16 }, (_, i) => i + 1); // the first 16 bytes of counter()
  assert.equal(first.authorization, `send-v1 ${MAK.b64url(new Uint8Array(hkdfSync('sha256', secret, Buffer.alloc(0), 'authentication', 64)))}`);
  assert.deepEqual([...ws.sent.at(-1)], [0]);
  assert.equal(r.link, `${SERVER}/download/0123456789abcdef/#${MAK.b64url(secret)}`);
  assert.equal(r.id, '0123456789abcdef');
  assert.equal(r.ownerToken, 'owner1');
  assert.deepEqual(eceDecrypt(MAK.fromB64url(r.link.split('#')[1]), streamOf(ws)), Buffer.from(data));
  assert.equal(progress.at(-1), data.length);
  assert.equal(ws.readyState, 3, 'the socket is closed');
});

test('upload: the errors of the server have names', async () => {
  const rejecting = fakeSocket((ws, m) => typeof m === 'string' && ws.reply({ error: 400 }));
  await assert.rejects(MAK.sendUpload({ server: SERVER, data: bytes(10), name: 'a', downloads: 99, seconds: 1, WebSocketImpl: rejecting.FakeWs }), { code: 'send.rejected' });
  const tooBig = fakeSocket((ws, m) => (typeof m === 'string' ? normalServer(ws, m) : m.length === 1 && ws.reply({ error: 413 })));
  await assert.rejects(MAK.sendUpload({ server: SERVER, data: bytes(10), name: 'a', downloads: 1, seconds: 1, WebSocketImpl: tooBig.FakeWs }), { code: 'send.tooBig' });
  const closed = fakeSocket(normalServer, { failOpen: true });
  await assert.rejects(MAK.sendUpload({ server: SERVER, data: bytes(10), name: 'a', downloads: 1, seconds: 1, WebSocketImpl: closed.FakeWs }), { code: 'send.network' });
  const hangUp = fakeSocket((ws, m) => (typeof m === 'string' ? normalServer(ws, m) : m.length === 1 && setTimeout(() => ws.close())));
  await assert.rejects(MAK.sendUpload({ server: SERVER, data: bytes(10), name: 'a', downloads: 1, seconds: 1, WebSocketImpl: hangUp.FakeWs }), { code: 'send.rejected' });
});

test('password: 8 easy characters, and the bytes that give a bias are not used', () => {
  const chars = MAK.SEND_PASSWORD_CHARS;
  assert.equal(chars.length, 31);
  assert.doesNotMatch(chars, /[il0o1]/);
  for (let i = 0; i < 50; i++) assert.match(MAK.makePassword(), /^[a-hjkmnp-z2-9]{8}$/);
  // 248 = 31 * 8: the bytes 248 to 255 are not used.
  const p = MAK.makePassword(() => Uint8Array.from([255, 248, 0, 1, 2, 3, 4, 5, 6, 30, 31, 32, 33, 34, 35, 36]));
  assert.equal(p, `${chars.slice(0, 7)}${chars[30]}`);
});

test('password: the upload key is PBKDF2 of the full link, as the download page of Send', async () => {
  const link = `${SERVER}/download/0123456789abcdef/#AAECAwQFBgcICQoLDA0ODw`;
  const key = await MAK.sendPasswordKey('k7m2x9qp', link);
  assert.deepEqual(Buffer.from(key), pbkdf2Sync('k7m2x9qp', link, 100, 64, 'sha256'));
  const calls = [];
  const doFetch = async (url, init) => (calls.push({ url, init }), { ok: true, status: 200 });
  await MAK.sendSetPassword({ server: SERVER, id: '0123456789abcdef', ownerToken: 'owner1', link, password: 'k7m2x9qp' }, doFetch);
  assert.equal(calls[0].url, `${SERVER}/api/password/0123456789abcdef`);
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { owner_token: 'owner1', auth: MAK.b64url(key) });
  await assert.rejects(MAK.sendSetPassword({ server: SERVER, id: 'x', ownerToken: 'o', link, password: 'p' }, async () => ({ ok: false, status: 401 })), { code: 'send.password' });
});

// A shortener service for the tests: "ok" lists the hosts that answer.
function shorteners(ok, asked = []) {
  const short = { 'is.gd': 'https://is.gd/AbC12x\n', 'spoo.me': 'http://spoo.me/Sp00x', 'tinyurl.com': 'https://tinyurl.com/2avxjnvp' };
  return async (url, init = {}) => {
    const host = new URL(url).host;
    const sent = host === 'spoo.me' ? new URLSearchParams(init.body).get('url') : new URL(url).searchParams.get('url');
    asked.push({ host, sent, method: init.method || 'GET' });
    if (!ok.includes(host)) return { ok: true, text: async () => 'Error, database insert failed', json: async () => ({ error: 'x' }) };
    return { ok: true, text: async () => short[host], json: async () => ({ short_url: short[host] }) };
  };
}

test('short link: the shortener never gets the key, unless the file has a password', async () => {
  const link = `${SERVER}/download/0123456789abcdef/#AAECAwQFBgcICQoLDA0ODw`;
  const asked = [];
  assert.equal(await MAK.shortLink(link, shorteners(['is.gd'], asked)), 'https://is.gd/AbC12x#AAECAwQFBgcICQoLDA0ODw');
  assert.deepEqual(asked, [{ host: 'is.gd', sent: `${SERVER}/download/0123456789abcdef/`, method: 'GET' }]);
  asked.length = 0;
  assert.equal(await MAK.shortLink(link, shorteners(['is.gd'], asked), { whole: true }), 'https://is.gd/AbC12x');
  assert.equal(asked[0].sent, link);
});

test('short link: the next shortener if one fails; TinyURL only for a full link (it loses the "#")', async () => {
  const link = `${SERVER}/download/0123456789abcdef/#KEY`;
  let asked = [];
  assert.equal(await MAK.shortLink(link, shorteners(['spoo.me'], asked)), 'https://spoo.me/Sp00x#KEY', 'spoo.me, with https');
  assert.deepEqual(asked.map((a) => [a.host, a.method, a.sent]), [['is.gd', 'GET', `${SERVER}/download/0123456789abcdef/`], ['spoo.me', 'POST', `${SERVER}/download/0123456789abcdef/`]]);
  asked = [];
  assert.equal(await MAK.shortLink(link, shorteners(['tinyurl.com'], asked)), link, 'no TinyURL for a key after "#"');
  assert.deepEqual(asked.map((a) => a.host), ['is.gd', 'spoo.me']);
  asked = [];
  assert.equal(await MAK.shortLink(link, shorteners(['tinyurl.com'], asked), { whole: true }), 'https://tinyurl.com/2avxjnvp');
  assert.deepEqual(asked.map((a) => a.host), ['is.gd', 'spoo.me', 'tinyurl.com']);
  assert.equal(await MAK.shortLink(link, shorteners([]), { whole: true }), link, 'all fail: the long link');
  assert.equal(await MAK.shortLink(link, async () => { throw new Error('offline'); }), link);
  assert.equal(await MAK.shortLink(link, async () => ({ ok: true, text: async () => 'https://evil.example/x' })), link, 'an answer of a different host is not used');
  assert.equal(await MAK.shortLink('https://no-key.example/x', shorteners(['is.gd'])), 'https://no-key.example/x');
});

test('the link: "key", "password" and "long" modes', async () => {
  const short = async (url, init) => {
    if (url.includes('/api/password/')) return { ok: true, status: 200 };
    return { ok: true, text: async () => 'https://is.gd/AbC12x' };
  };
  const common = { server: SERVER, data: bytes(50), name: 'a.pdf', downloads: 3, seconds: 3600, doFetch: short, now: 1000 };
  const key = await MAK.sendLink({ ...common, WebSocketImpl: fakeSocket(normalServer).FakeWs });
  assert.match(key.link, /^https:\/\/is\.gd\/AbC12x#[\w-]{22}$/);
  assert.equal(key.password, null);
  assert.equal(key.expires, 1000 + 3600 * 1000);
  assert.equal(key.downloads, 3);
  const pwd = await MAK.sendLink({ ...common, mode: 'password', WebSocketImpl: fakeSocket(normalServer).FakeWs });
  assert.equal(pwd.link, 'https://is.gd/AbC12x');
  assert.match(pwd.password, /^[a-hjkmnp-z2-9]{8}$/);
  const long = await MAK.sendLink({ ...common, mode: 'long', doFetch: async () => assert.fail('no shortener'), WebSocketImpl: fakeSocket(normalServer).FakeWs });
  assert.match(long.link, /^https:\/\/send\.example\/download\/0123456789abcdef\/#[\w-]{22}$/);
});

test('the link: if the password fails, the file is deleted', async () => {
  const calls = [];
  const doFetch = async (url, init) => {
    calls.push({ url, body: init && init.body });
    return url.includes('/api/password/') ? { ok: false, status: 500 } : { ok: true, status: 200 };
  };
  await assert.rejects(MAK.sendLink({ server: SERVER, data: bytes(5), name: 'a', downloads: 1, seconds: 60, mode: 'password', doFetch, WebSocketImpl: fakeSocket(normalServer).FakeWs }), { code: 'send.password' });
  assert.equal(calls[1].url, `${SERVER}/api/delete/0123456789abcdef`);
  assert.deepEqual(JSON.parse(calls[1].body), { owner_token: 'owner1' });
});

test('the limits of the server from /config', async () => {
  const body = { LIMITS: { MAX_FILE_SIZE: 2684354560, MAX_DOWNLOADS: 20, MAX_EXPIRE_SECONDS: 259200 }, DEFAULTS: { DOWNLOAD_COUNTS: [1, 2, 3, 5, 10, 20], EXPIRE_TIMES_SECONDS: [300, 3600, 86400, 259200] } };
  const asked = [];
  const ok = async (url) => (asked.push(url), { ok: true, json: async () => body });
  assert.deepEqual(await MAK.sendConfig(SERVER, ok), { maxSize: 2684354560, downloads: [1, 2, 3, 5, 10, 20], seconds: [300, 3600, 86400, 259200] });
  assert.equal(asked[0], `${SERVER}/config`);
  assert.equal(await MAK.sendConfig(SERVER, async () => ({ ok: true, json: async () => ({}) })), null);
  assert.equal(await MAK.sendConfig(SERVER, async () => { throw new Error('offline'); }), null);
});

test('the files of a link: only files of the site, with an address of MiAulario', () => {
  const list = MAK.linkFiles([
    { itemId: '/group/S1/Tema 1.pdf' },
    { itemId: '/group/S1/Prácticas/P#1 (v2).pdf' },
    { itemId: '/group/S1/Carpeta/' },
    { itemId: '/group/S2/Otra.pdf' },
    { itemId: '/group/S1/../S2/x.pdf' },
    { itemId: 42 },
    null
  ], 'S1');
  assert.deepEqual(list, [
    { itemId: '/group/S1/Tema 1.pdf', url: 'https://miaulario.unavarra.es/access/content/group/S1/Tema%201.pdf', name: 'Tema 1.pdf' },
    { itemId: '/group/S1/Prácticas/P#1 (v2).pdf', url: 'https://miaulario.unavarra.es/access/content/group/S1/Pr%C3%A1cticas/P%231%20(v2).pdf', name: 'P#1 (v2).pdf' }
  ]);
  assert.equal(MAK.linkFiles('x', 'S1').length, 0);
  assert.equal(MAK.linkFiles(Array.from({ length: 80 }, (_, i) => ({ itemId: `/group/S1/${i}.pdf` })), 'S1').length, MAK.LINK_MAX_FILES);
});

test('the permissions of a link: the server, and the shorteners only if the mode uses them', () => {
  assert.deepEqual(MAK.linkOrigins({ server: 'https://send.vis.ee', mode: 'password' }), ['https://send.vis.ee/*', 'https://is.gd/*', 'https://spoo.me/*', 'https://tinyurl.com/*']);
  assert.deepEqual(MAK.linkOrigins({ server: 'https://send.vis.ee', mode: 'long' }), ['https://send.vis.ee/*']);
});

const fileResponse = (url, text, type = 'application/pdf') => response(text, { url, type });
test('the payload of a link: one file as it is, more files in one ZIP file', async () => {
  const files = MAK.linkFiles([{ itemId: '/group/S1/a.pdf' }, { itemId: '/group/S1/b.pdf' }, { itemId: '/group/S1/Sub/a.pdf' }], 'S1');
  const fetchFile = async (url) => fileResponse(url, `data of ${decodeURIComponent(new URL(url).pathname)}`);
  const one = await MAK.linkPayload({ files: files.slice(0, 1), name: 'Análisis', fetchFile });
  assert.equal(one.name, 'a.pdf');
  assert.equal(one.type, 'application/pdf');
  assert.equal(Buffer.from(one.data).toString(), 'data of /access/content/group/S1/a.pdf');
  const many = await MAK.linkPayload({ files, name: 'Análisis: Tema/1', fetchFile });
  assert.equal(many.name, 'Análisis_ Tema_1.zip');
  assert.equal(many.type, 'application/zip');
  const zip = Buffer.from(many.data);
  assert.equal(zip.readUInt32LE(0), 0x04034b50, 'a ZIP file');
  const text = zip.toString('latin1');
  for (const name of ['a.pdf', 'b.pdf', 'a (2).pdf']) assert.ok(text.includes(name), name);
  assert.ok(text.includes('data of /access/content/group/S1/Sub/a.pdf'));
});

test('the payload of a link: the login page, the copyright page and errors of MiAulario stop it', async () => {
  const files = MAK.linkFiles([{ itemId: '/group/S1/a.pdf' }], 'S1');
  const run = (fetchFile) => MAK.linkPayload({ files, name: 'x', fetchFile });
  await assert.rejects(run(async () => response('no', { status: 403 })), { code: 'send.file' });
  await assert.rejects(run(async () => fileResponse('https://sso.unavarra.es/login', '<html>', 'text/html')), { code: 'send.file' });
  await assert.rejects(run(async (url) => fileResponse(url, '<html>copyright', 'text/html; charset=utf-8')), { code: 'send.fileHtml', message: /a\.pdf/ });
  await assert.rejects(run(async () => { throw new Error('offline'); }), { code: 'send.file' });
  // A file too big for a link: the size of the answer stops it before its bytes are read.
  const big = fileResponse(MAK.linkFiles([{ itemId: '/group/S1/a.pdf' }], 'S1')[0].url, 'x');
  big.headers = new Headers({ 'content-type': 'video/mp4', 'content-length': String(MAK.LINK_MAX_BYTES + 1) });
  big.arrayBuffer = () => { throw new Error('read the bytes'); };
  await assert.rejects(run(async () => big), { code: 'send.tooBig' });
  const html = MAK.linkFiles([{ itemId: '/group/S1/page.html' }], 'S1');
  assert.equal((await MAK.linkPayload({ files: html, fetchFile: async (url) => fileResponse(url, '<p>x', 'text/html') })).name, 'page.html');
});

test('linkPermissions: the host permissions; in Firefox also the consent for website content', async () => {
  const links = { server: 'https://send.vis.ee', mode: 'password' };
  const asked = [];
  const perms = (granted) => ({ contains: async (q) => (asked.push(q), q.origins ? granted.origins : granted.data) });
  assert.deepEqual(await MAK.linkPermissions(perms({ origins: true, data: false }), links), { origins: true, data: true }, 'Chrome: no data consent');
  assert.deepEqual(asked, [{ origins: MAK.linkOrigins(links) }]);
  globalThis.browser = { runtime: { getBrowserInfo: async () => ({ name: 'Firefox' }) } };
  try {
    assert.deepEqual(await MAK.linkPermissions(perms({ origins: true, data: false }), links), { origins: true, data: false });
    assert.deepEqual(asked.at(-1), { data_collection: ['websiteContent'] });
    const old = { contains: async (q) => { if (q.data_collection) throw new Error('unknown key'); return true; } };
    assert.deepEqual(await MAK.linkPermissions(old, links), { origins: true, data: true }, 'a Firefox without the data consent');
  } finally {
    delete globalThis.browser;
  }
});
