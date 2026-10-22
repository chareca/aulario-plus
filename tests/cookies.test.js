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

test('keeping the session off (MAK.KEEP_SESSION): no persistent copy; at an update, the old copies become session cookies', async () => {
  const bg = loadBackground({ web: fastTimers });
  assert.equal(bg.MAK.KEEP_SESSION, false, 'off in lib/core.js');
  const { server, named, put } = withJar(bg);
  const later = Date.now() / 1000 + 9 * 86400;
  server('SERVERID', 'h31');
  put({ name: 'SAKAISESSIONID', value: 'old', domain: 'miaulario.unavarra.es', hostOnly: true, path: '/', secure: true, httpOnly: true, expirationDate: later });
  put({ name: 'idpsession', value: 'sso', domain: '.sso.unavarra.es', hostOnly: false, path: '/', secure: true, httpOnly: true, expirationDate: later });
  await wait(30);
  assert.equal(named('SERVERID')[0].expirationDate, undefined, 'the cookie of the server stays a session cookie');
  for (const f of bg.ext._listeners.installed) f({ reason: 'update', previousVersion: '1.6.5' });
  await wait(80);
  assert.deepEqual(named('SAKAISESSIONID').map((c) => [c.value, c.hostOnly, c.expirationDate]), [['old', true, undefined]]);
  assert.deepEqual(named('idpsession').map((c) => [c.value, c.domain, c.expirationDate]), [['sso', '.sso.unavarra.es', undefined]]);
});

const { fakeFetch } = require('./helpers');
const F = require('./fixtures/miaulario');
const later = () => Date.now() / 1000 + 1e6;
// A background with the session kept, a cookie jar, and the requests (a session with or without a user).
function kept({ user = 'user-1', local } = {}) {
  const log = [];
  const routes = F.routes();
  routes['/direct/session/current.json'] = { userId: user, userEid: user ? 'eid' : null };
  const bg = loadBackground({ keepSession: true, fetch: fakeFetch(routes, log), local });
  return Object.assign({ bg, log, keepAlive: () => log.filter((x) => x.url.includes('/direct/session/current.json') && !x.url.includes('auto=true')).length }, withJar(bg));
}

test('a login writes no cookie: the extension does not touch the cookies while they change', async () => {
  const { bg, server, named } = kept();
  let sets = 0;
  const set = bg.ext.cookies.set;
  bg.ext.cookies.set = async (d) => { sets++; return set(d); };
  server('SAKAISESSIONID', 'A-anonymous');
  server('JSESSIONID', 'login', { path: '/sakai-login-tool' });
  server('idpsession', 'sso-1', { domain: '.sso.unavarra.es', hostOnly: false });
  server('SAKAISESSIONID', 'B-logged-in');
  await wait(30);
  assert.equal(sets, 0);
  assert.deepEqual(named('SAKAISESSIONID').map((c) => [c.value, c.expirationDate]), [['B-logged-in', undefined]]);
});

test('a ping that sees the user: the cookies of MiAulario become persistent (path "/", attributes of the server, secure); never the SSO session', async () => {
  const { bg, server, named, put, keepAlive } = kept();
  server('SAKAISESSIONID', 'S1');
  server('SERVERID', 'h31', { secure: false, httpOnly: false, sameSite: 'lax' });
  put({ name: 'SAKAISESSIONID', value: 'other-path', domain: 'miaulario.unavarra.es', hostOnly: true, path: '/portal', secure: true, httpOnly: true });
  server('idpsession', 'sso-1', { domain: '.sso.unavarra.es', hostOnly: false });
  assert.equal((await bg.send({ type: 'pingNow' })).loggedIn, true);
  assert.equal(keepAlive(), 1, 'the keep-alive request');
  const [main, other] = ['/', '/portal'].map((path) => named('SAKAISESSIONID').find((c) => c.path === path));
  assert.deepEqual([main.value, main.hostOnly, main.secure, main.httpOnly, main.sameSite], ['S1', true, true, true, 'no_restriction']);
  assert.ok(main.expirationDate > Date.now() / 1000 + 29 * 86400, 'persistent for 30 days');
  assert.deepEqual([other.value, other.expirationDate], ['other-path', undefined], 'a copy of another path is not touched');
  const [node] = named('SERVERID');
  assert.deepEqual([node.value, node.secure, node.httpOnly, node.sameSite], ['h31', true, false, 'lax']);
  assert.ok(node.expirationDate);
  assert.equal(named('idpsession')[0].expirationDate, undefined, 'the SSO session is not kept');
  // Each ping with the user moves the date: the cookie does not end during a session.
  put(Object.assign({}, main, { expirationDate: Date.now() / 1000 + 3600 }));
  await bg.send({ type: 'pingNow' });
  assert.ok(named('SAKAISESSIONID').find((c) => c.path === '/').expirationDate > Date.now() / 1000 + 29 * 86400);
});

test('a ping that sees a session without a user (it ended, as after a sleep): no keep-alive, and the old persistent copies become session cookies', async () => {
  const { bg, put, named, keepAlive } = kept({ user: null });
  put({ name: 'SAKAISESSIONID', value: 'dead', domain: 'miaulario.unavarra.es', hostOnly: true, path: '/', secure: true, httpOnly: true, expirationDate: later() });
  put({ name: 'SERVERID', value: 'h31', domain: 'miaulario.unavarra.es', hostOnly: true, path: '/', expirationDate: later() });
  assert.equal((await bg.send({ type: 'pingNow' })).loggedIn, false);
  assert.equal(keepAlive(), 0, 'a session without a user is not kept alive');
  assert.deepEqual(named('SAKAISESSIONID').map((c) => [c.value, c.expirationDate]), [['dead', undefined]]);
  assert.equal(named('SERVERID')[0].expirationDate, undefined);
});

test('"Pausar", or a logout: the session ends with the browser (the cookies stay, as session cookies, for the logout of MiAulario)', async () => {
  for (const type of ['pause', 'logout']) {
    const { bg, put, named } = kept();
    put({ name: 'SAKAISESSIONID', value: 'A', domain: 'miaulario.unavarra.es', hostOnly: true, path: '/', expirationDate: later() });
    put({ name: 'idpsession', value: 'sso', domain: '.sso.unavarra.es', hostOnly: false, path: '/', expirationDate: later() });
    await bg.send({ type }, type === 'logout' ? CONTENT : undefined);
    assert.deepEqual([...named('SAKAISESSIONID'), ...named('idpsession')].map((c) => [c.value, c.expirationDate]), [['A', undefined], ['sso', undefined]], type);
    assert.equal((await bg.ext.storage.local.get('paused')).paused, type === 'logout' ? true : 'user');
  }
});

test('the end of the pause of a logout (a new login): the session cookies are persistent again', async () => {
  const { bg, server, named } = kept({ local: { paused: true } });
  server('SAKAISESSIONID', 'NEW');
  assert.equal(named('SAKAISESSIONID')[0].expirationDate, undefined, 'paused: a session cookie');
  assert.ok(await bg.send({ type: 'pingNow' }));
  assert.equal((await bg.ext.storage.local.get('paused')).paused, false);
  assert.ok(named('SAKAISESSIONID')[0].expirationDate > Date.now() / 1000 + 86400, 'persistent');
});

test('at an update with the session kept: the persistent copy of the SSO session of an older version becomes a session cookie', async () => {
  const { bg, put, named } = kept();
  put({ name: 'idpsession', value: 'sso', domain: '.sso.unavarra.es', hostOnly: false, path: '/', secure: true, httpOnly: true, expirationDate: later() });
  for (const f of bg.ext._listeners.installed) await f({ reason: 'update', previousVersion: '1.6.6' });
  await wait(30);
  assert.equal(named('idpsession')[0].expirationDate, undefined);
});
