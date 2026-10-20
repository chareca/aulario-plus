// Aulario Plus: download links with Send (the open-source fork of Firefox Send, timvisee/send).
// - The extension encrypts the file before the upload (AES-GCM, the "aes128gcm" record format of
//   Send v3). The server keeps only encrypted data, and it cannot read the name of the file.
// - The key is in the link, after "#". A browser never sends that part to a server.
// - The link works for the number of downloads and the time that the user selects.
// - Two forms of short link:
//   - "key": the shortener (is.gd or spoo.me) gets only the part of the link before "#". The key stays after
//     "#" in the short link (about 43 characters).
//   - "password": the shortener gets the full link, but the Send server gives the encrypted file
//     only with a password (8 characters). The shortener has the key but not the file; the Send
//     server has the file but not the key. The link has about 20 characters.
// Protocol: WebSocket "/api/ws" -> JSON {fileMetadata, authorization, timeLimit, dlimit} -> the
// server answers {url, id, ownerToken} -> the encrypted records -> one byte 0 -> {ok: true}.
// Password: POST "/api/password/{id}" {owner_token, auth}. "auth" is PBKDF2(password, salt = the
// full link, 100 iterations, SHA-256), the same as the download page of Send.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  MAK.SEND_RECORD = 64 * 1024; // the record size of Send
  const TAG = 16;
  const encoder = new TextEncoder();
  const subtle = () => root.crypto.subtle;

  class SendError extends Error {
    constructor(code, detail) {
      super(detail ? `${code}: ${detail}` : code);
      this.code = code;
    }
  }
  MAK.SendError = SendError;

  // Base64 for URLs, without "=" (the same as Send).
  MAK.b64url = function (bytes) {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  MAK.fromB64url = function (str) {
    const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(s + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
  };

  async function hkdf(ikm, salt, info, bytes) {
    const base = await subtle().importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode(info) }, base, bytes * 8));
  }
  const aesKey = (raw, usages) => subtle().importKey('raw', raw, 'AES-GCM', false, usages);

  // The keys of Send v3 from the secret (16 bytes): the metadata key and the upload key.
  MAK.sendKeys = async function (secret) {
    const none = new Uint8Array(0);
    return {
      metaKey: await hkdf(secret, none, 'metadata', 16),
      authKey: await hkdf(secret, none, 'authentication', 64) // an HMAC-SHA-256 key of one block
    };
  };

  // The encrypted metadata: name, size, type (AES-GCM, IV of 12 zero bytes, as Send).
  MAK.sendMetadata = async function (metaKey, { name, size, type }) {
    const json = JSON.stringify({ name, size, type: type || 'application/octet-stream', manifest: { files: [{ name, size, type: type || 'application/octet-stream' }] } });
    return new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: new Uint8Array(12), tagLength: 128 }, await aesKey(metaKey, ['encrypt']), encoder.encode(json)));
  };

  // The content in the "aes128gcm" format: a header of 21 bytes (salt, record size, 0), then records
  // of 64 KiB. Each record: the data, then 1 (a normal record) or 2 (the last record).
  MAK.sendRecords = async function* (secret, data, salt) {
    const header = new Uint8Array(21);
    header.set(salt, 0);
    new DataView(header.buffer).setUint32(16, MAK.SEND_RECORD);
    yield header;
    const key = await aesKey(await hkdf(secret, salt, 'Content-Encoding: aes128gcm\0', 16), ['encrypt']);
    const nonceBase = await hkdf(secret, salt, 'Content-Encoding: nonce\0', 12);
    const chunk = MAK.SEND_RECORD - TAG - 1;
    for (let seq = 0, off = 0; ; seq++, off += chunk) {
      const part = data.subarray(off, off + chunk);
      const last = off + chunk >= data.length;
      const plain = new Uint8Array(part.length + 1);
      plain.set(part);
      plain[part.length] = last ? 2 : 1;
      const nonce = nonceBase.slice();
      const view = new DataView(nonce.buffer);
      view.setUint32(8, (view.getUint32(8) ^ seq) >>> 0);
      yield new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, plain));
      if (last) return;
    }
  };

  // The messages of a WebSocket, one after the other.
  function messages(ws) {
    const queue = [];
    const waiting = [];
    const push = (m) => (waiting.length ? waiting.shift()(m) : queue.push(m));
    ws.addEventListener('message', (e) => {
      try {
        push(JSON.parse(e.data));
      } catch {
        push({ error: 'not-json' });
      }
    });
    ws.addEventListener('close', () => push({ error: 'closed' }));
    ws.addEventListener('error', () => push({ error: 'network' }));
    return () => new Promise((resolve) => (queue.length ? resolve(queue.shift()) : waiting.push(resolve)));
  }

  // Upload one file. The result: { link (with the key after "#"), id, ownerToken }.
  MAK.sendUpload = async function ({ server, data, name, type, downloads, seconds, WebSocketImpl, random, onProgress }) {
    const Ws = WebSocketImpl || root.WebSocket;
    const rand = random || ((n) => root.crypto.getRandomValues(new Uint8Array(n)));
    const secret = rand(16);
    const { metaKey, authKey } = await MAK.sendKeys(secret);
    const metadata = await MAK.sendMetadata(metaKey, { name, size: data.length, type });
    const url = new URL('/api/ws', server);
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
    const ws = new Ws(url.href);
    ws.binaryType = 'arraybuffer';
    const next = messages(ws);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', () => reject(new SendError('send.network')));
      ws.addEventListener('close', () => reject(new SendError('send.network')));
    });
    try {
      ws.send(JSON.stringify({ fileMetadata: MAK.b64url(metadata), authorization: `send-v1 ${MAK.b64url(authKey)}`, timeLimit: seconds, dlimit: downloads }));
      const info = await next();
      if (info.error || !info.url) throw new SendError(info.error === 413 ? 'send.tooBig' : 'send.rejected', String(info.error || 'no url'));
      let sent = 0;
      for await (const record of MAK.sendRecords(secret, data, rand(16))) {
        ws.send(record);
        sent += record.length;
        if (onProgress) onProgress(Math.min(sent, data.length), data.length);
        while (ws.bufferedAmount > MAK.SEND_RECORD * 2 && ws.readyState === 1) await new Promise((r) => setTimeout(r, 20));
      }
      ws.send(new Uint8Array([0])); // the end of the file
      const done = await next();
      if (done.error) throw new SendError(done.error === 413 ? 'send.tooBig' : 'send.rejected', String(done.error));
      return { link: `${info.url}#${MAK.b64url(secret)}`, id: info.id, ownerToken: info.ownerToken };
    } finally {
      try { ws.close(); } catch {}
    }
  };

  // The limits of a Send server (from "/config"), or null.
  MAK.sendConfig = async function (server, doFetch) {
    try {
      const r = await doFetch(new URL('/config', server).href, { cache: 'no-store' });
      const c = r.ok ? await r.json() : null;
      if (!c || !c.LIMITS || !c.DEFAULTS) return null;
      return {
        maxSize: Number(c.LIMITS.MAX_FILE_SIZE) || 0,
        downloads: (c.DEFAULTS.DOWNLOAD_COUNTS || []).map(Number).filter((n) => n > 0),
        seconds: (c.DEFAULTS.EXPIRE_TIMES_SECONDS || []).map(Number).filter((n) => n > 0)
      };
    } catch {
      return null;
    }
  };

  // A password of 8 characters, easy to type: lowercase letters and digits, without i, l, o, 0, 1.
  MAK.SEND_PASSWORD_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
  MAK.makePassword = function (random) {
    const rand = random || ((n) => root.crypto.getRandomValues(new Uint8Array(n)));
    const chars = MAK.SEND_PASSWORD_CHARS;
    const limit = 256 - (256 % chars.length); // no bias: discard the bytes from this value
    let out = '';
    while (out.length < 8) for (const b of rand(16)) if (b < limit && out.length < 8) out += chars[b % chars.length];
    return out;
  };

  // The upload key that a password gives (the same as Send: PBKDF2, the full link as salt).
  MAK.sendPasswordKey = async function (password, link) {
    const base = await subtle().importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', salt: encoder.encode(link), iterations: 100, hash: 'SHA-256' }, base, 512));
  };

  // Put a password on an uploaded file. After this, the download page of Send asks for it.
  MAK.sendSetPassword = async function ({ server, id, ownerToken, link, password }, doFetch) {
    const auth = MAK.b64url(await MAK.sendPasswordKey(password, link));
    let r;
    try {
      r = await doFetch(new URL(`/api/password/${encodeURIComponent(id)}`, server).href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_token: ownerToken, auth })
      });
    } catch {
      throw new SendError('send.network');
    }
    if (!r.ok) throw new SendError('send.password', String(r.status));
  };

  // The shorteners, in order. None needs an API key. If one does not answer (is.gd sometimes cannot
  // add new links), the next one makes the link. "keepsHash": the browser keeps the "#" part of the
  // short link after the redirect (tested; TinyURL loses it, so it is only for a full link).
  const form = (u) => ({ method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: `url=${encodeURIComponent(u)}` });
  MAK.SHORTENER_APIS = [
    { host: 'is.gd', keepsHash: true, request: (u) => [`https://is.gd/create.php?format=simple&url=${encodeURIComponent(u)}`, {}], read: (r) => r.text(), answer: /^https:\/\/is\.gd\/[\w-]+$/ },
    { host: 'spoo.me', keepsHash: true, request: (u) => ['https://spoo.me/', form(u)], read: async (r) => String((await r.json()).short_url || '').replace(/^http:\/\//, 'https://'), answer: /^https:\/\/spoo\.me\/[\w-]+$/ },
    { host: 'tinyurl.com', keepsHash: false, request: (u) => [`https://tinyurl.com/api-create.php?url=${encodeURIComponent(u)}`, {}], read: (r) => r.text(), answer: /^https:\/\/tinyurl\.com\/[\w-]+$/ }
  ];
  MAK.SHORTENERS = MAK.SHORTENER_APIS.map((s) => `https://${s.host}/*`);

  // A shorter link. "whole": false shortens only the part before "#" (the shortener never gets the
  // key); true shortens all the link (only for a file with a password). If no shortener answers,
  // the long link stays.
  MAK.shortLink = async function (link, doFetch, { whole = false } = {}) {
    const at = link.indexOf('#');
    if (at < 0 && !whole) return link;
    const base = whole || at < 0 ? link : link.slice(0, at);
    const key = whole || at < 0 ? '' : link.slice(at);
    for (const s of MAK.SHORTENER_APIS) {
      if (key && !s.keepsHash) continue;
      try {
        const [url, init] = s.request(base);
        const r = await doFetch(url, Object.assign({ cache: 'no-store', credentials: 'omit' }, init));
        const short = String(await s.read(r)).trim();
        if (r.ok && s.answer.test(short)) return short + key;
      } catch {}
    }
    return link;
  };

  // ---- The files of MiAulario for a link ----------------------------------------------

  MAK.LINK_MAX_FILES = 50;
  MAK.LINK_MAX_BYTES = 250 * 1024 * 1024; // the memory of the browser, not the limit of the server

  // The host permissions that the links need: the Send server, and the shorteners if the mode uses them.
  MAK.linkOrigins = function (links) {
    return [`${links.server}/*`].concat(links.mode === 'long' ? [] : MAK.SHORTENERS);
  };

  // Firefox: the consent to send "website content" out of the extension (the encrypted files of a
  // link). The manifest has it in data_collection_permissions.optional. Firefox does not accept it
  // in the same request as the host permissions, so the popup asks for it with a different click.
  MAK.LINK_DATA = { data_collection: ['websiteContent'] };
  MAK.isFirefox = () => !!(root.browser && root.browser.runtime && typeof root.browser.runtime.getBrowserInfo === 'function');
  // What the browser gives for the links: { origins, data }.
  MAK.linkPermissions = async function (perms, links) {
    const out = { origins: false, data: true };
    try {
      out.origins = !!(await perms.contains({ origins: MAK.linkOrigins(links) }));
    } catch {}
    if (MAK.isFirefox()) {
      try {
        out.data = !!(await perms.contains(MAK.LINK_DATA));
      } catch {
        out.data = true; // a version of Firefox without the data consent
      }
    }
    return out;
  };

  // The files of a request: only resources of the site, without folders. [{ itemId, url, name }].
  MAK.linkFiles = function (list, siteId) {
    const prefix = `/group/${siteId}/`;
    const out = [];
    for (const f of Array.isArray(list) ? list.slice(0, MAK.LINK_MAX_FILES) : []) {
      const id = f && typeof f.itemId === 'string' ? f.itemId : '';
      if (!id.startsWith(prefix) || id.endsWith('/') || id.length > 1000 || id.split('/').includes('..')) continue;
      const path = id.split('/').map((s) => encodeURIComponent(s)).join('/');
      out.push({ itemId: id, url: `${MAK.BASE}/access/content${path}`, name: MAK.safeFileName(id.slice(id.lastIndexOf('/') + 1)) });
    }
    return out;
  };

  // Get the files from MiAulario. One file: the file. More files: one ZIP file ("name".zip).
  // fetchFile(url) -> a Response. The result: { data (Uint8Array), name, type }.
  MAK.linkPayload = async function ({ files, name, fetchFile }) {
    const got = [];
    let total = 0;
    for (const f of files) {
      let r;
      try {
        r = await fetchFile(f.url);
      } catch {
        throw new SendError('send.file', f.name);
      }
      const finalPath = r.url ? new URL(r.url).pathname : '/access/content/';
      const type = (r.headers && r.headers.get('content-type')) || '';
      if (!r.ok || !finalPath.startsWith('/access/content/')) throw new SendError('send.file', f.name);
      // An HTML page for a file that is not HTML: the login page or the copyright page.
      if (/text\/html/i.test(type) && !/\.html?$/i.test(f.name)) throw new SendError('send.fileHtml', f.name);
      // The size of the answer first: a file of 900 MB does not go to the memory to be too big.
      if (total + Number((r.headers && r.headers.get('content-length')) || 0) > MAK.LINK_MAX_BYTES) throw new SendError('send.tooBig');
      const data = new Uint8Array(await r.arrayBuffer());
      total += data.length;
      if (total > MAK.LINK_MAX_BYTES) throw new SendError('send.tooBig');
      got.push({ name: f.name, data, type: type.split(';')[0].trim() });
    }
    if (got.length === 1) return { data: got[0].data, name: got[0].name, type: got[0].type || 'application/octet-stream' };
    const zip = MAK.createZip();
    const unique = MAK.createNamer();
    for (const g of got) zip.addFile(unique('', g.name), g.data, Date.now());
    const parts = zip.finish();
    const data = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
      data.set(p, at);
      at += p.length;
    }
    return { data, name: MAK.safeFileName(`${name || 'MiAulario'}.zip`), type: 'application/zip' };
  };

  // All the steps: the upload, then the password (mode "password"), then the short link.
  // mode: "key" (the key stays after "#"), "password" or "long" (no shortener).
  // The result: { link, password (or null), downloads, expires (ms) }.
  MAK.sendLink = async function ({ server, data, name, type, downloads, seconds, mode = 'key', doFetch, onProgress, WebSocketImpl, random, now = Date.now() }) {
    const up = await MAK.sendUpload({ server, data, name, type, downloads, seconds, WebSocketImpl, random, onProgress });
    let password = null;
    if (mode === 'password') {
      password = MAK.makePassword(random);
      try {
        await MAK.sendSetPassword({ server, id: up.id, ownerToken: up.ownerToken, link: up.link, password }, doFetch);
      } catch (e) {
        // No file without its password stays on the server.
        doFetch(new URL(`/api/delete/${encodeURIComponent(up.id)}`, server).href, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner_token: up.ownerToken })
        }).catch(() => {});
        throw e;
      }
    }
    const link = mode === 'long' ? up.link : await MAK.shortLink(up.link, doFetch, { whole: mode === 'password' });
    return { link, password, downloads, expires: now + seconds * 1000 };
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
