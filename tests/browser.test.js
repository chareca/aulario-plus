'use strict';
// The tests that need a real DOM run in a headless Chromium (tests/browser/run.mjs) and in Firefox (tests/browser/firefox).
// Without a Chromium browser (for example in the CI of GitHub), they are skipped.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('browser tests: the readers of the MiAulario pages', (t) => {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'browser', 'run.mjs')], { encoding: 'utf8', timeout: 120000 });
  if (r.status === 2) return t.skip('no Chromium browser');
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
});

// The same tests in the engine of Firefox (tests/browser/firefox/run.mjs): skipped without its playwright-core and its Firefox.
test('browser tests in Firefox', (t) => {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'browser', 'firefox', 'run.mjs')], { encoding: 'utf8', timeout: 240000 });
  if (r.status === 2) return t.skip(r.stdout.trim());
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
});
