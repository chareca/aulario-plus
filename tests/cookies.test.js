'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBackground } = require('./helpers');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A cookie jar for the mock browser: set() changes the jar and sends the events, as Chrome does.
function withJar(bg) {
  const jar = new Map();
  const emit = (cookie, removed) => bg.ext._listeners.cookies.forEach((f) => f({ cookie: Object.assign({}, cookie), removed }));
  const setCookie = (c) => {
    const old = jar.get(c.name);
    if (old) emit(old, true);
    jar.set(c.name, c);
    emit(c, false);
  };
  bg.ext.cookies.get = async ({ name }) => (jar.has(name) ? Object.assign({}, jar.get(name)) : null);
  bg.ext.cookies.set = async (d) => setCookie({ name: d.name, value: d.value, domain: 'miaulario.unavarra.es', expirationDate: d.expirationDate });
  return { jar, server: (value) => setCookie({ name: 'SAKAISESSIONID', value, domain: 'miaulario.unavarra.es' }) };
}

test('login: a late event of the old session cookie does not replace the new session', async () => {
  const bg = loadBackground();
  const { jar, server } = withJar(bg);
  server('A-anonymous');
  await wait(20);
  assert.equal(jar.get('SAKAISESSIONID').value, 'A-anonymous');
  assert.ok(jar.get('SAKAISESSIONID').expirationDate, 'the session cookie is now persistent');

  // The login: MiAulario sets the new session (B). Then an old event of A comes late.
  server('B-logged-in');
  bg.ext._listeners.cookies.forEach((f) => f({ cookie: { name: 'SAKAISESSIONID', value: 'A-anonymous', domain: 'miaulario.unavarra.es' }, removed: false }));
  await wait(30);
  assert.equal(jar.get('SAKAISESSIONID').value, 'B-logged-in', 'the new session stays');
  assert.ok(jar.get('SAKAISESSIONID').expirationDate, 'and it is persistent');
});

test('a persistent cookie, another cookie or a pause: no change', async () => {
  const bg = loadBackground();
  const { jar } = withJar(bg);
  let sets = 0;
  const set = bg.ext.cookies.set;
  bg.ext.cookies.set = async (d) => { sets++; return set(d); };
  const fire = (cookie) => bg.ext._listeners.cookies.forEach((f) => f({ cookie, removed: false }));
  jar.set('SAKAISESSIONID', { name: 'SAKAISESSIONID', value: 'X', domain: 'miaulario.unavarra.es', expirationDate: 9e9 });
  fire(jar.get('SAKAISESSIONID'));
  fire({ name: 'OTHER', value: 'Y', domain: 'miaulario.unavarra.es' });
  await wait(20);
  assert.equal(sets, 0);
  await bg.ext.storage.local.set({ paused: true });
  jar.set('SAKAISESSIONID', { name: 'SAKAISESSIONID', value: 'Z', domain: 'miaulario.unavarra.es' });
  fire(jar.get('SAKAISESSIONID'));
  await wait(20);
  assert.equal(sets, 0, 'paused after a logout');
});
