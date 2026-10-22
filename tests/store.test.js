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
  assert.deepEqual(Object.keys(MAK.withDefaults({ badge: { evil: 1, forums: 1 } }).badge), Object.keys(MAK.defaultSettings().badge), 'only the known badge keys');
  assert.deepEqual(MAK.withDefaults({ hiddenSites: ['a', 'a', 'b'] }).hiddenSites, ['a', 'b']);
  assert.deepEqual([...MAK.hiddenEverywhere({ hiddenMode: 'sidebar', hiddenSites: ['a'] })], []);
  assert.deepEqual([...MAK.hiddenEverywhere({ hiddenMode: 'everywhere', hiddenSites: ['a'] })], ['a']);
});

test('"Exportar mi configuración": every setting (a new one by itself), the boxes of Mi sitio, the photos, the version and the date; the name of the file', () => {
  const now = new Date(2026, 9, 5, 9, 30);
  const out = MAK.configExport({ settings: { theme: 'galaxia', nicknames: { s1: 'IP' }, junk: 1 }, pageUi: { 'mak-mysite-closed': '1', other: '1' }, sitePhotos: { '2026_0_1': 3 }, history: { x: 1 } }, '1.6.7', now);
  assert.deepEqual([out.app, out.version, out.exported], ['Aulario Plus', '1.6.7', now.toISOString()]);
  assert.deepEqual(Object.keys(out.settings).sort(), Object.keys(MAK.defaultSettings()).sort(), 'all the settings: a new setting with a default is in the file');
  assert.deepEqual([out.settings.theme, out.settings.nicknames, out.settings.junk], ['galaxia', { s1: 'IP' }, undefined]);
  assert.deepEqual([out.ui, out.sitePhotos, out.history], [{ 'mak-mysite-closed': '1' }, { '2026_0_1': 3 }, undefined], 'the boxes and the photos; no data of the courses');
  assert.equal(MAK.configFileName(now), 'aulario-plus-config-05-10-2026.json');
});

test('"Importar mi configuración": only a file of Aulario Plus, whatever its name; the BOM and the spaces of the editors do not matter', () => {
  const file = JSON.stringify(MAK.configExport({ settings: { theme: 'galaxia' } }, '1.6.7', new Date(2026, 9, 5)));
  const got = MAK.configImport(file);
  assert.deepEqual([got.version, got.file.settings.theme], ['1.6.7', 'galaxia']);
  assert.deepEqual(MAK.configImport(`﻿${file.replace('"Aulario Plus"', '" Aulario Plus "')}\n\n`).file.settings.theme, 'galaxia', 'a BOM, spaces');
  for (const bad of ['', 'no json', '[]', 'null', '1', JSON.stringify({ app: 'Otra', settings: {} }), JSON.stringify({ app: 'Aulario Plus', settings: [] }), JSON.stringify({ app: 'Aulario Plus' }), 'x'.repeat(1e6 + 1)]) {
    assert.equal(MAK.configImport(bad), null, bad.slice(0, 40));
  }
  assert.equal(MAK.configImport(JSON.stringify({ app: 'Aulario Plus', exported: 'ayer', version: 7, settings: {} })).exported, '', 'a date that is not a date');
  // What goes to the background: only the known values with their type, cleaned.
  const sent = MAK.configImport(JSON.stringify({ app: 'Aulario Plus', settings: { theme: ' cromo​', confetti: 'yes', debugMode: true, big: 'x'.repeat(5e5), nicknames: { a: [[[[['A']]]]] } }, ui: { 'mak-a': '1', b: '1' }, sitePhotos: { s: 99 } })).file;
  assert.deepEqual(sent, { settings: { theme: 'cromo', nicknames: { a: [[]] } }, ui: { 'mak-a': '1' }, sitePhotos: {} }, 'at most 4 levels; MAK.withDefaults drops the rest');
});

test('"Importar mi configuración": a file of an older or newer version, strange values, extra settings; the file wins only with right values', () => {
  const cur = { settings: { theme: 'cromo', notifyDue: false, teacherBody: 'Hola,\n\nUn saludo', nicknames: { a: 'A' }, badge: { grades: false } }, pageUi: { 'mak-mysite-wide': '1' }, sitePhotos: { s1: 1 } };
  const merge = (settings, extra = {}) => MAK.configMerge(cur, MAK.configImport(JSON.stringify(Object.assign({ app: 'Aulario Plus', settings }, extra))).file);
  // An older file: a setting that it does not have keeps the current value; a setting that no longer exists goes.
  const old = merge({ theme: 'galaxia', oldSetting: true });
  assert.deepEqual([old.settings.theme, old.settings.notifyDue, old.settings.teacherBody, 'oldSetting' in old.settings], ['galaxia', false, 'Hola,\n\nUn saludo', false]);
  // A wrong type: ignored (the current value stays), also inside the badge and the links.
  const odd = merge({ notifyDue: 'true', theme: 42, dueOffsets: 'many', badge: { grades: 'yes', messages: false, extra: 1 }, links: { downloads: '9', mode: 'key' }, hiddenSites: [1, 'x', null, 'y'.repeat(300)] });
  assert.deepEqual([odd.settings.notifyDue, odd.settings.theme, odd.settings.dueOffsets], [false, 'cromo', MAK.defaultSettings().dueOffsets]);
  assert.deepEqual([odd.settings.badge.grades, odd.settings.badge.messages, 'extra' in odd.settings.badge], [false, false, false]);
  assert.deepEqual([odd.settings.links.downloads, odd.settings.links.mode, odd.settings.hiddenSites], [MAK.defaultSettings().links.downloads, 'key', ['x']]);
  // Strange characters and spaces: cleaned; values outside the checks: the default (MAK.withDefaults).
  const text = merge({ theme: ' galaxia​ ', nicknames: { ' a ': ' Mates‮\u0007 ' }, teacherBody: 'Hola\r\n​fin\u0000', lang: 'fr', colorMode: 'DARK', degree: 'https://evil.example/' });
  assert.deepEqual([text.settings.theme, text.settings.nicknames, text.settings.teacherBody, text.settings.lang, text.settings.colorMode, text.settings.degree], ['galaxia', { a: 'Mates' }, 'Hola\nfin', 'es', 'auto', '']);
  // The boxes and the photos: only the right ones, over the current ones.
  const ui = merge({}, { ui: { 'mak-mysite-closed': '1', 'mak-x': 'yes', evil: '1' }, sitePhotos: { s2: 4, s3: 99, 'a b': 1 } });
  assert.deepEqual([ui.pageUi, ui.sitePhotos], [{ 'mak-mysite-wide': '1', 'mak-mysite-closed': '1' }, { s1: 1, s2: 4 }]);
  // Keys that change an object, deep lists: nothing breaks, nothing changes outside.
  const proto = MAK.configImport('{"app":"Aulario Plus","settings":{"__proto__":{"notifyDue":true},"nicknames":{"__proto__":"x","constructor":"y","b":"B"}}}');
  const safe = MAK.configMerge(cur, proto.file);
  assert.deepEqual([safe.settings.notifyDue, safe.settings.nicknames, {}.notifyDue], [false, { b: 'B' }, undefined]);
  let deep = '"x"';
  for (let i = 0; i < 5000; i++) deep = `[${deep}]`;
  assert.doesNotThrow(() => MAK.configMerge(cur, MAK.configImport(`{"app":"Aulario Plus","settings":{"hiddenSites":${deep}}}`).file));
  // How many change: 0 with the same values.
  assert.equal(MAK.configChanges(cur, MAK.configMerge(cur, { settings: {} })), 0);
  assert.equal(MAK.configChanges(cur, old), 1, 'the theme');
  // In the pages (lib/themes.js): a theme that this version does not have keeps the current one; '' (the default) is a theme.
  MAK.themeIds = () => ['cromo', 'galaxia'];
  try {
    assert.deepEqual(['nebulosa', 'galaxia​', ''].map((theme) => merge({ theme }).settings.theme), ['cromo', 'galaxia', '']);
  } finally {
    delete MAK.themeIds;
  }
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

test('hideSitesCss hides the sidebar item, the "all sites" entry and the favorites entry', () => {
  const css = MAK.hideSitesCss(['2026_0_1_G', 'open-site'], 'open-site');
  assert.match(css, /li\.site-list-item\[data-site="2026_0_1_G"\]/);
  assert.match(css, /li\.fav-sites-entry:has\(> \[data-site-id="2026_0_1_G"\]\)/);
  assert.match(css, /li\.organize-favorite-item\[data-site-id="2026_0_1_G"\]/);
  assert.doesNotMatch(css, /open-site/, 'the open site never hides');
  assert.match(css, /\{ display: none !important; \}$/);
  assert.equal(MAK.hideSitesCss([], null), '');
  assert.equal(MAK.hideSitesCss(['x'], 'x'), '');
});

test('hideSitesCss escapes characters that could break the CSS', () => {
  const css = MAK.hideSitesCss(['a"] , body{color:red}'], null);
  assert.ok(css.includes('data-site="a\\22 \\5d \\20 \\2c \\20 body\\7b color\\3a red\\7d "'), css);
  assert.equal(css.split('{').length - 1, 1, 'only the final rule has a brace');
  assert.equal((css.match(/"/g) || []).length, 6, 'only the quotes of the 3 attribute selectors');
});

test('the settings of the download links: off by default, and only correct values', () => {
  assert.deepEqual(MAK.withDefaults({}).links, { enabled: false, server: 'https://send.vis.ee', mode: 'password', downloads: 1, seconds: 86400 });
  assert.deepEqual(
    MAK.withDefaults({ links: { enabled: true, server: 'https://send.monks.tools/some/path', mode: 'key', downloads: 5, seconds: 3600, other: 1 } }).links,
    { enabled: true, server: 'https://send.monks.tools', mode: 'key', downloads: 5, seconds: 3600 }
  );
  const bad = MAK.withDefaults({ links: { enabled: 'yes', server: 'http://send.example.org', mode: 'x', downloads: 0, seconds: 1.5 } }).links;
  assert.deepEqual(bad, { enabled: true, server: 'https://send.vis.ee', mode: 'password', downloads: 1, seconds: 86400 });
  // Only the known servers: the manifest has a host permission for each of them.
  for (const server of ['https://send.example.org', 'https://user:pw@send.example.org', 'https://localhost', 'javascript:alert(1)', 42]) {
    assert.equal(MAK.withDefaults({ links: { server } }).links.server, 'https://send.vis.ee', String(server));
  }
  assert.equal(MAK.withDefaults({ links: [] }).links.enabled, false);
});

test('the template of the message to a teacher: empty by default, text only, limited', () => {
  const d = MAK.withDefaults({});
  assert.equal(d.teacherSubject, '');
  assert.equal(d.teacherBody, '');
  const s = MAK.withDefaults({ teacherSubject: '  Consulta\n sobre\u202e {asignatura}  ', teacherBody: 'Hola {profesor},  \r\n\r\n\tUna\u0000 línea\u200b\n\n\n' });
  assert.equal(s.teacherSubject, 'Consulta sobre {asignatura}', 'one line, no invisible characters');
  assert.equal(s.teacherBody, 'Hola {profesor},\n\n Una  línea', 'the line breaks stay; no control characters; no spaces at the end');
  assert.equal(MAK.withDefaults({ teacherSubject: 'x'.repeat(500), teacherBody: 'y'.repeat(5000) }).teacherSubject.length, 200);
  assert.equal(MAK.withDefaults({ teacherBody: 'y'.repeat(5000) }).teacherBody.length, 3000);
  assert.equal(MAK.withDefaults({ teacherBody: 42 }).teacherBody, '');
});

test('the grades of the calculator of the guides: numbers 0 to 10 only', () => {
  assert.deepEqual(MAK.withDefaults({}).guideGrades, {});
  const s = MAK.withDefaults({ guideGrades: { S1: { Examen: 6.5, Malo: 11, Texto: '7' }, S2: 'x', S3: {} } });
  assert.deepEqual(s.guideGrades, { S1: { Examen: 6.5 } });
  assert.deepEqual(MAK.withDefaults({ guideWeights: { S1: { Examen: 55, Malo: 150 } } }).guideWeights, { S1: { Examen: 55 } }, 'weights 0 to 100');
  assert.deepEqual(MAK.withDefaults({}).dueOffsets, [1440, 60], 'reminders: 24 h and 1 h');
  assert.deepEqual(MAK.withDefaults({ dueOffsets: [60, 10080, 60, 7, 1440, 180] }).dueOffsets, [10080, 1440, 180], 'known times, once, the earliest first, at most 3');
  assert.deepEqual(MAK.withDefaults({ dueOffsets: [] }).dueOffsets, [1440, 60]);
});

test('the confetti after a submission: on by default; the user can set it off', () => {
  assert.equal(MAK.defaultSettings().confetti, true);
  assert.equal(MAK.withDefaults({}).confetti, true);
  assert.equal(MAK.withDefaults({ confetti: false }).confetti, false);
  assert.equal(MAK.withDefaults({ confetti: 0 }).confetti, false);
});
