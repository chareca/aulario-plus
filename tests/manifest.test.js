'use strict';
// Make sure that the two manifests, the importScripts list and the HTML pages agree.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, COMMON } = require('./helpers');

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const chromium = readJson('extension/manifest.chromium.json');
const firefox = readJson('extension/manifest.firefox.json');

function importScriptsList() {
  const src = fs.readFileSync(path.join(COMMON, 'background.js'), 'utf8');
  const m = /importScripts\(([^)]*)\)/.exec(src);
  assert.ok(m, 'background.js must call importScripts');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

test('both manifests have the same version, name and permissions', () => {
  assert.equal(chromium.version, firefox.version);
  assert.equal(chromium.name, firefox.name);
  assert.deepEqual(chromium.permissions, firefox.permissions);
  assert.deepEqual(chromium.host_permissions, firefox.host_permissions);
  assert.deepEqual(chromium.content_scripts, firefox.content_scripts);
});

test('the Chromium importScripts list is the same as the Firefox background scripts', () => {
  const scripts = firefox.background.scripts;
  assert.equal(scripts[scripts.length - 1], 'background.js');
  assert.deepEqual(importScriptsList(), scripts.slice(0, -1));
  assert.equal(chromium.background.service_worker, 'background.js');
});

test('all the files that the manifests and pages refer to exist', () => {
  const files = new Set([...firefox.background.scripts, ...importScriptsList()]);
  for (const cs of chromium.content_scripts) for (const f of cs.js) files.add(f);
  for (const page of ['popup.html', 'tools.html']) {
    const p = path.join(COMMON, page);
    if (!fs.existsSync(p)) continue;
    for (const m of fs.readFileSync(p, 'utf8').matchAll(/<script src="([^"]+)"/g)) files.add(m[1]);
  }
  for (const f of files) assert.ok(fs.existsSync(path.join(COMMON, f)), `missing file: ${f}`);
});

test('a content script loads the shared core before the files that use it', () => {
  for (const cs of chromium.content_scripts) {
    const usesLib = cs.js.some((f) => f !== 'lib/core.js');
    if (usesLib && cs.js.some((f) => f.startsWith('lib/') || f.startsWith('content'))) {
      if (cs.js.includes('lib/core.js')) assert.equal(cs.js[0], 'lib/core.js');
    }
  }
});

test('the optional host permissions are the Send servers, the shorteners and the exam calendars of the code, and nothing more', () => {
  const MAK = require('./helpers').loadLib('core', 'store', 'send', 'degree');
  const expected = MAK.SEND_SERVERS.map((s) => `${s}/*`).concat(MAK.SHORTENERS, MAK.EXAMS_PERMISSION.origins).sort();
  assert.deepEqual([...chromium.optional_host_permissions].sort(), expected);
  assert.deepEqual([...firefox.optional_host_permissions].sort(), expected);
});

test('Firefox: a fixed add-on id and the declaration of the data that goes out of the extension', () => {
  const gecko = firefox.browser_specific_settings.gecko;
  assert.match(gecko.id, /^[a-zA-Z0-9-._]*@[a-zA-Z0-9-._]+$/);
  assert.notEqual(gecko.id, 'aulario-plus@local');
  assert.deepEqual(gecko.data_collection_permissions, { required: ['none'], optional: ['websiteContent'] });
  assert.ok(Number(gecko.strict_min_version) >= 140);
});
