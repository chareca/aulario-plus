'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBackground } = require('./helpers');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// The extension waits 1500 ms without a change before it writes a cookie: 5 ms in the tests.
const fastTimers = { setTimeout: (f, ms) => setTimeout(f, ms === 1500 ? 5 : ms) };
const CONTENT = { id: 'ext-id', tab: { id: 1 }, frameId: 0, url: 'https://miaulario.unavarra.es/portal' };

// A cookie jar as in Chrome: a cookie is one name, domain, path and host-only flag. set() with the
// same cookie replaces it, set() with an expiration date in the past removes it, and each change
// sends the events (removed with a cause, then inserted).
function withJar(bg) {
  const jar = [];
  const emit = (cookie, removed, cause) => bg.ext._listeners.cookies.forEach((f) => f({ cookie: Object.assign({}, cookie), removed, cause }));
  const same = (a, b) => a.name === b.name && a.domain === b.domain && a.path === b.path && a.hostOnly === b.hostOnly;
  const put = (c, cause = 'explicit') => {
    const i = jar.findIndex((x) => same(x, c));
    if (i >= 0) emit(jar.splice(i, 1)[0], true, c.expirationDate && c.expirationDate < Date.now() / 1000 ? 'expired_overwrite' : 'overwrite');
    if (c.expirationDate && c.expirationDate < Date.now() / 1000) return;
    jar.push(c);
    emit(c, false, cause);
  };
  // A cookie of the server: a session cookie (no expiration date), host-only if no domain is given.
  const server = (name, value, o = {}) =>
    put(Object.assign({ name, value, domain: 'miaulario.unavarra.es', hostOnly: true, path: '/', secure: true, httpOnly: true, sameSite: 'no_restriction' }, o));
  bg.ext.cookies.getAll = async ({ domain, name }) =>
    jar.filter((c) => c.name === name && (c.domain.replace(/^\./, '') === domain || c.domain.endsWith(`.${domain}`))).map((c) => Object.assign({}, c));
  bg.ext.cookies.set = async (d) => {
    const host = new URL(d.url).hostname;
    put({
      name: d.name, value: d.value, domain: d.domain ? `.${d.domain.replace(/^\./, '')}` : host, hostOnly: !d.domain, path: d.path || '/',
      secure: !!d.secure, httpOnly: !!d.httpOnly, sameSite: d.sameSite, expirationDate: d.expirationDate
    });
  };
  const named = (name) => jar.filter((c) => c.name === name);
  return { jar, server, named, put };
}

test('login: after the changes stop, the extension writes the cookie that the browser has', async () => {
  const bg = loadBackground({ web: fastTimers });
  const { server, named } = withJar(bg);
  server('SAKAISESSIONID', 'A-anonymous');
  server('SAKAISESSIONID', 'B-logged-in');
  // A late event of the old session.
  bg.ext._listeners.cookies.forEach((f) => f({ cookie: { name: 'SAKAISESSIONID', value: 'A-anonymous', domain: 'miaulario.unavarra.es', hostOnly: true, path: '/' }, removed: false }));
  await wait(40);
  const list = named('SAKAISESSIONID');
  assert.equal(list.length, 1);
  assert.equal(list[0].value, 'B-logged-in', 'the new session stays');
  assert.ok(list[0].expirationDate > Date.now() / 1000 + 86400, 'and it is persistent');
  assert.equal(list[0].hostOnly, true, 'a host-only cookie stays host-only');
});

test('login: a change of the server during the write is not lost', async () => {
  const bg = loadBackground({ web: fastTimers });
  const { server, named } = withJar(bg);
  const set = bg.ext.cookies.set;
  let raced = false;
  bg.ext.cookies.set = async (d) => {
    // The server sets the logged-in session after the read and before the write of the old value.
    if (!raced && d.value === 'A-anonymous' && d.expirationDate > 2) {
      raced = true;
      server('SAKAISESSIONID', 'B-logged-in');
    }
    return set(d);
  };
  server('SAKAISESSIONID', 'A-anonymous');
  await wait(60);
  assert.ok(raced);
  const list = named('SAKAISESSIONID');
  assert.equal(list.length, 1);
  assert.equal(list[0].value, 'B-logged-in');
  assert.ok(list[0].expirationDate, 'persistent');
});

test('an old copy with other attributes is removed: the browser sends one session cookie', async () => {
  const bg = loadBackground({ web: fastTimers });
  const { server, named, put } = withJar(bg);
  // An old persistent copy (host-only), and the new cookie of the server as a domain cookie.
  put({ name: 'SAKAISESSIONID', value: 'OLD', domain: 'miaulario.unavarra.es', hostOnly: true, path: '/', secure: true, httpOnly: true, expirationDate: Date.now() / 1000 + 1e6 });
  server('SAKAISESSIONID', 'NEW', { domain: '.miaulario.unavarra.es', hostOnly: false });
  await wait(40);
  const list = named('SAKAISESSIONID');
  assert.equal(list.length, 1, 'one copy');
  assert.equal(list[0].value, 'NEW');
  assert.equal(list[0].domain, '.miaulario.unavarra.es', 'the form of the server cookie');
  assert.ok(list[0].expirationDate);
});

test('the persistent copy has the attributes of the server cookie, and is always secure (https only)', async () => {
  const bg = loadBackground({ web: fastTimers });
  const { server, named } = withJar(bg);
  server('idpsession', 'sso-1', { domain: '.sso.unavarra.es', hostOnly: false, sameSite: 'no_restriction' });
  server('SERVERID', 'h31', { secure: false, httpOnly: false, sameSite: 'lax' });
  await wait(40);
  const [sso] = named('idpsession');
  assert.deepEqual([sso.domain, sso.hostOnly, sso.path, sso.secure, sso.httpOnly, sso.sameSite], ['.sso.unavarra.es', false, '/', true, true, 'no_restriction']);
  assert.ok(sso.expirationDate);
  const [node] = named('SERVERID');
  assert.deepEqual([node.value, node.domain, node.hostOnly, node.secure, node.httpOnly, node.sameSite], ['h31', 'miaulario.unavarra.es', true, true, false, 'lax']);
  assert.ok(node.expirationDate);
});

test('a persistent cookie, another cookie or a pause: no change', async () => {
  const bg = loadBackground({ web: fastTimers });
  const { put, server } = withJar(bg);
  let sets = 0;
  const set = bg.ext.cookies.set;
  bg.ext.cookies.set = async (d) => { sets++; return set(d); };
  put({ name: 'SAKAISESSIONID', value: 'X', domain: 'miaulario.unavarra.es', hostOnly: true, path: '/', expirationDate: 9e9 });
  server('OTHER', 'Y');
  await wait(30);
  assert.equal(sets, 0);
  await bg.ext.storage.local.set({ paused: true });
  server('SAKAISESSIONID', 'Z');
  await wait(30);
  assert.equal(sets, 0, 'paused after a logout');
});

test('the end of the pause of a logout (a new login): the session cookies are persistent again', async () => {
  const { fakeFetch } = require('./helpers');
  const F = require('./fixtures/miaulario');
  const bg = loadBackground({ web: fastTimers, fetch: fakeFetch(F.routes()), local: { paused: true } });
  const { server, named } = withJar(bg);
  server('SAKAISESSIONID', 'NEW');
  await wait(30);
  assert.equal(named('SAKAISESSIONID')[0].expirationDate, undefined, 'paused: a session cookie');
  assert.ok(await bg.send({ type: 'pingNow' }));
  await wait(40);
  assert.ok(named('SAKAISESSIONID')[0].expirationDate > Date.now() / 1000 + 86400, 'persistent');
});

test('repairSession removes all the copies of the Sakai session and SERVERID, and keeps the SSO session', async () => {
  const bg = loadBackground({ web: fastTimers });
  const { put, named } = withJar(bg);
  const later = Date.now() / 1000 + 1e6;
  put({ name: 'SAKAISESSIONID', value: 'OLD', domain: 'miaulario.unavarra.es', hostOnly: true, path: '/', secure: true, expirationDate: later });
  put({ name: 'SAKAISESSIONID', value: 'NEW', domain: '.miaulario.unavarra.es', hostOnly: false, path: '/', secure: true });
  put({ name: 'SERVERID', value: 'h31', domain: 'miaulario.unavarra.es', hostOnly: true, path: '/', expirationDate: later });
  put({ name: 'idpsession', value: 'sso', domain: '.sso.unavarra.es', hostOnly: false, path: '/', secure: true, expirationDate: later });
  const r = await bg.send({ type: 'repairSession' }, CONTENT);
  assert.deepEqual(r, { ok: true });
  assert.equal(named('SAKAISESSIONID').length, 0);
  assert.equal(named('SERVERID').length, 0);
  assert.equal(named('idpsession').length, 1, 'the SSO session stays: no password at the next login');
  await wait(30);
  assert.equal(named('SAKAISESSIONID').length, 0, 'no write comes back after the repair');
});

test('logout removes all the copies of the session cookies', async () => {
  const bg = loadBackground({ web: fastTimers });
  const { put, named } = withJar(bg);
  const later = Date.now() / 1000 + 1e6;
  put({ name: 'SAKAISESSIONID', value: 'A', domain: 'miaulario.unavarra.es', hostOnly: true, path: '/', expirationDate: later });
  put({ name: 'SAKAISESSIONID', value: 'B', domain: '.miaulario.unavarra.es', hostOnly: false, path: '/', expirationDate: later });
  put({ name: 'idpsession', value: 'sso', domain: '.sso.unavarra.es', hostOnly: false, path: '/', expirationDate: later });
  await bg.send({ type: 'logout' }, CONTENT);
  assert.equal(named('SAKAISESSIONID').length + named('idpsession').length, 0);
  assert.equal((await bg.ext.storage.local.get('paused')).paused, true);
});
