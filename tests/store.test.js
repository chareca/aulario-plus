'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, memoryArea } = require('./helpers');
const MAK = loadLib('core', 'store');

test('withDefaults fills the missing settings and rejects bad values', () => {
  assert.deepEqual(MAK.withDefaults(undefined), MAK.defaultSettings());
  const s = MAK.withDefaults({ syncEnabled: false, badge: { forums: true }, hiddenSites: ['a', 3], hiddenMode: 'x' });
  assert.equal(s.syncEnabled, false);
  assert.equal(s.badge.forums, true);
  assert.equal(s.badge.deliveries, true);
  assert.deepEqual(s.hiddenSites, ['a']);
  assert.equal(s.hiddenMode, 'everywhere');
  assert.deepEqual([...MAK.hiddenEverywhere({ hiddenMode: 'sidebar', hiddenSites: ['a'] })], []);
  assert.deepEqual([...MAK.hiddenEverywhere({ hiddenMode: 'everywhere', hiddenSites: ['a'] })], ['a']);
});

test('the store queue does not lose writes that occur at the same time', async () => {
  const area = memoryArea({ counter: 0 });
  const store = MAK.createStore(area);
  await Promise.all(Array.from({ length: 50 }, () => store.update('counter', async (n) => {
    await new Promise((r) => setTimeout(r, Math.random() * 3));
    return n + 1;
  })));
  assert.equal(area.data.counter, 50);
});

test('the store writes a key only if the value changed', async () => {
  const area = memoryArea({ a: { x: 1 } });
  let writes = 0;
  const set = area.set;
  area.set = async (o) => { writes += Object.keys(o).length; return set(o); };
  const store = MAK.createStore(area);
  await store.set({ a: { x: 1 } });
  assert.equal(writes, 0);
  await store.set({ a: { x: 2 }, b: 1 });
  assert.equal(writes, 2);
  await store.update('a', () => ({ x: 2 }));
  assert.equal(writes, 2);
  assert.deepEqual(await store.update('missing', () => undefined), undefined);
});

test('the queue continues after an error', async () => {
  const store = MAK.createStore(memoryArea({ v: 1 }));
  await assert.rejects(store.update('v', () => { throw new Error('boom'); }));
  assert.equal(await store.update('v', (v) => v + 1), 2);
});
