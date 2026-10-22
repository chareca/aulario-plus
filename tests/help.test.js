'use strict';
// Help and support (lib/help.js): an issue on GitHub with the version and the browser, the changes
// of the versions, and the welcome page and the notice of the changes (background.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, loadBackground } = require('./helpers');
const MAK = loadLib('core', 'i18n', 'help');

test('browserName: the browser and the system, nothing else', () => {
  assert.equal(MAK.browserName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'), 'Chrome 142 · macOS');
  assert.equal(MAK.browserName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0'), 'Edge 142 · Windows');
  assert.equal(MAK.browserName('Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0'), 'Firefox 142 · Linux');
  assert.equal(MAK.browserName('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/141.0.0.0 Safari/537.36', true), 'Brave 141 · Windows');
});

test('issueUrl: a problem or an idea on GitHub, with the version, the browser and the language', () => {
  MAK.setLang('es');
  const u = new URL(MAK.issueUrl({ kind: 'bug', version: '1.6.4', browser: 'Chrome 142 · macOS', lang: 'es' }));
  assert.equal(u.origin + u.pathname, 'https://github.com/chareca/aulario-plus/issues/new');
  assert.equal(u.searchParams.get('labels'), 'bug');
  assert.match(u.searchParams.get('body'), /\*\*Qué pasó\*\*[\s\S]*Aulario Plus 1\.6\.4 · Chrome 142 · macOS · es$/);
  assert.equal(new URL(MAK.issueUrl({ kind: 'idea', version: '1', browser: 'x', lang: 'en' })).searchParams.get('labels'), 'enhancement');
  assert.ok(MAK.CHANGES.every((c) => /^\d+\.\d+\.\d+$/.test(c.version) && c.es.length === c.en.length), 'the same changes in both languages');
  assert.equal(MAK.changesOf('1.6.4').version, '1.6.4');
  // The newest version: its news in one short line in both languages (the window over MiAulario after the update).
  const { short } = MAK.CHANGES[0];
  assert.ok(short && ['es', 'en'].every((l) => typeof short[l] === 'string' && short[l].trim() && !/\n/.test(short[l]) && short[l].length <= 160), 'the line of the news of the newest version');
  assert.equal(MAK.changesOf('0.0.1'), null);
});

test('install: the welcome page; update: the notice of the changes, until the popup closes it', async () => {
  const bg = loadBackground({});
  for (const f of bg.ext._listeners.installed) f({ reason: 'install' });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(bg.ext._tabs.some((x) => x.url === 'chrome-extension://ext-id/tools.html?welcome'));
  for (const f of bg.ext._listeners.installed) f({ reason: 'update', previousVersion: '1.6.3' });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal((await bg.ext.storage.local.get('whatsNew')).whatsNew, '9.9.9', 'the version of the manifest');
  assert.deepEqual(await bg.send({ type: 'dismissWhatsNew' }), { ok: true });
  assert.equal((await bg.ext.storage.local.get('whatsNew')).whatsNew, undefined);
  for (const f of bg.ext._listeners.installed) f({ reason: 'update', previousVersion: '9.9.9' });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal((await bg.ext.storage.local.get('whatsNew')).whatsNew, undefined, 'a reload of the same version: no notice');
});
