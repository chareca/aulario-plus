'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib } = require('./helpers');
const MAK = loadLib('core');

// After a reload or an update of the extension, the content scripts of an open tab stay, but the
// extension API stops: runtime.id is undefined and each call throws "Extension context invalidated".
test('extensionAlive and safeCall: no error when the extension API stopped', async (t) => {
  t.after(() => { delete globalThis.chrome; });
  delete globalThis.chrome;
  assert.equal(MAK.extensionAlive(), false, 'no extension API');
  let called = false;
  assert.equal(await MAK.safeCall(() => { called = true; }, 'fallback'), 'fallback');
  assert.equal(called, false, 'no call when the API stopped');

  globalThis.chrome = { runtime: { id: 'ext-id' } };
  assert.equal(MAK.extensionAlive(), true);
  assert.equal(await MAK.safeCall(async () => 5, null), 5);
  assert.equal(await MAK.safeCall(() => { throw new Error('Extension context invalidated.'); }, null), null, 'an error at once');
  assert.equal(await MAK.safeCall(() => Promise.reject(new Error('Extension context invalidated.')), null), null, 'an error later');

  globalThis.chrome = { runtime: {} };
  assert.equal(MAK.extensionAlive(), false, 'runtime.id is undefined after the reload');
  globalThis.chrome = { get runtime() { throw new Error('Extension context invalidated.'); } };
  assert.equal(MAK.extensionAlive(), false, 'the API throws');
});
