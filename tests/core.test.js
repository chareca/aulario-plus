'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib } = require('./helpers');
const MAK = loadLib('core');

test('toMs reads all the date formats of Sakai', () => {
  assert.equal(MAK.toMs(1760608800000), 1760608800000);
  assert.equal(MAK.toMs(1792413197.123), 1792413197123, 'an Instant in seconds (the bell of MiAulario)');
  assert.equal(MAK.toMs(1792413197), 1792413197000);
  assert.equal(MAK.toMs({ epochSecond: 1760608800, nano: 500000000 }), 1760608800500);
  assert.equal(MAK.toMs({ time: 1760608800000 }), 1760608800000);
  assert.equal(MAK.toMs('20261016100000123'), Date.UTC(2026, 9, 16, 10, 0, 0, 123));
  assert.equal(MAK.toMs('2026-10-16T10:00:00Z'), Date.UTC(2026, 9, 16, 10, 0, 0));
  for (const bad of [null, undefined, '', 'tomorrow', {}, NaN, { epochSecond: 'x' }]) assert.equal(MAK.toMs(bad), null);
});

test('toMs reads the 17-digit Sakai date as UTC on both sides of a daylight saving change', () => {
  // Spain changes the clock on 2026-10-25. The value must not depend on the local time zone.
  assert.equal(MAK.toMs('20261024230000000'), Date.UTC(2026, 9, 24, 23));
  assert.equal(MAK.toMs('20261025230000000'), Date.UTC(2026, 9, 25, 23));
  assert.equal(MAK.toMs('20260329010000000') - MAK.toMs('20260328010000000'), 24 * 3600 * 1000);
});

test('formatDuration and urgency', () => {
  const { MINUTE, HOUR, DAY } = MAK;
  assert.equal(MAK.formatDuration(2 * DAY + 4 * HOUR + 12 * MINUTE), '2d 04h 12m');
  assert.equal(MAK.formatDuration(4 * HOUR + 5 * MINUTE), '4h 05m');
  assert.equal(MAK.formatDuration(12 * MINUTE + 30 * 1000), '12m 30s');
  assert.equal(MAK.formatDuration(-3 * HOUR), '3h 00m');
  assert.equal(MAK.urgency(-1), 'overdue');
  assert.equal(MAK.urgency(23 * HOUR), 'red');
  assert.equal(MAK.urgency(2 * DAY), 'orange');
  assert.equal(MAK.urgency(5 * DAY), 'yellow');
  assert.equal(MAK.urgency(8 * DAY), 'green');
});

test('dropStorageKeys: only the keys of Aulario Plus, in the localStorage and the sessionStorage of the page', () => {
  const area = (o) => Object.assign(Object.create({ removeItem(k) { delete this[k]; } }), o);
  globalThis.localStorage = area({ 'mak-guide-host:open:x': '1', 'mak.theme': 'comic', 'mak-sem:exams:autumn': '0', 'sakai-sidebar': 'x' });
  globalThis.sessionStorage = area({ 'aulario-plus-last-relogin': '1', 'mak-confetti:a': '1', other: '2' });
  try {
    MAK.dropStorageKeys();
    assert.deepEqual([Object.keys(globalThis.localStorage), Object.keys(globalThis.sessionStorage)], [['sakai-sidebar'], ['other']], 'the keys of MiAulario stay');
  } finally {
    delete globalThis.localStorage;
    delete globalThis.sessionStorage;
  }
  MAK.dropStorageKeys(); // no storage (the service worker): no error
});

test('htmlToText removes tags and scripts and decodes entities', () => {
  const html = '<p>Hola&nbsp;<b>mundo</b> &amp; m&aacute;s</p><script>alert(1)</script><style>p{}</style>' +
    '<ul><li>Uno</li><li>Dos</li></ul>L&iacute;nea<br>nueva &#8364; &#x41; &unknown;<!-- c -->';
  assert.equal(MAK.htmlToText(html), 'Hola mundo & más\n\n- Uno\n- Dos\nLínea\nnueva € A &unknown;');
  assert.equal(MAK.htmlToText(''), '');
  assert.equal(MAK.htmlToText(null), '');
  assert.equal(MAK.htmlToText('&#0; &#xD800; ok'), 'ok');
});

test('htmlToText: no tag comes back from the parts of a removed one; a script without its end goes to the end; linear time', () => {
  assert.equal(MAK.htmlToText('a<!<!--x-->--><scr<script>x</script>ipt>alert(1)</script> b'), 'aalert(1) b', 'plain text, no "<"');
  assert.equal(MAK.htmlToText('<p>Hola</p><script>never ends'), 'Hola');
  assert.equal(MAK.htmlToText('<html><head><meta charset=utf-8><body><p>Examen el lunes</p>'), 'Examen el lunes', '"</head>" is optional in HTML');
  assert.equal(MAK.htmlToText('<head><title>T</title></head><p>Texto</p>'), 'Texto');
  assert.equal(MAK.htmlToText('nota <b>bien</b>: 3 < 4'), 'nota bien: 3 < 4', 'a "<" after the last tag stays');
  // A post of a forum with many "<" without an end (anybody of the site writes one): no "regular expression DoS".
  for (const evil of ['<a'.repeat(100000), '<li'.repeat(100000), '<script'.repeat(50000), '<!--'.repeat(50000), `${'<p '.repeat(50000)}>${'<'.repeat(50000)}`]) {
    const t0 = Date.now();
    MAK.htmlToText(evil);
    assert.ok(Date.now() - t0 < 500, `${evil.slice(0, 8)}…: ${Date.now() - t0} ms`);
  }
});

test('search ignores case and accents', () => {
  assert.equal(MAK.normalizeText('Recuperación ÁRBOL'), 'recuperacion arbol');
  assert.ok(MAK.matchesQuery('Clase de recuperación', 'RECUPERACION clase'));
  assert.ok(!MAK.matchesQuery('Clase de recuperación', 'examen'));
  assert.ok(MAK.matchesQuery('anything', '   '));
});

test('safe URLs: only http and https, and only MiAulario for site links', () => {
  assert.equal(MAK.safeHttpUrl('https://example.org/a'), 'https://example.org/a');
  assert.equal(MAK.safeHttpUrl('javascript:alert(1)'), null);
  assert.equal(MAK.safeHttpUrl('file:///etc/passwd'), null);
  assert.equal(MAK.safeHttpUrl('not a url'), null);
  assert.equal(MAK.safeSiteUrl('/portal/site/x'), 'https://miaulario.unavarra.es/portal/site/x');
  assert.equal(MAK.safeSiteUrl('https://evil.example/portal'), null);
  assert.equal(MAK.safeSiteUrl('https://miaulario.unavarra.es.evil.example/'), null);
});

test('parsePortalPath finds the site, the page and the direct tool', () => {
  assert.deepEqual(MAK.parsePortalPath('/portal/site/2026_0_1_G'), { siteId: '2026_0_1_G', pageOrTool: null });
  assert.deepEqual(MAK.parsePortalPath('/portal/site/2026_0_1_G/page/p-1'), { siteId: '2026_0_1_G', pageOrTool: 'p-1' });
  assert.deepEqual(MAK.parsePortalPath('/portal/site/a%20b/page-reset/p-2'), { siteId: 'a b', pageOrTool: 'p-2' });
  assert.deepEqual(MAK.parsePortalPath('/portal/directtool/abc-123'), { placement: 'abc-123' });
  assert.equal(MAK.parsePortalPath('/portal'), null);
  assert.equal(MAK.parsePortalPath('/portal/site/%E0%A4%A'), null);
  assert.ok(MAK.isSpecialSite('~user'));
  assert.ok(MAK.isSpecialSite('!gateway'));
  assert.ok(!MAK.isSpecialSite('2026_0_1_G'));
});

test('toolUrl: the page of the tool, or the site', () => {
  const pages = { s1: { tools: { 'sakai.forums': { page: 'https://miaulario.unavarra.es/portal/site/s1/page/p4' }, 'sakai.bad': { page: 'https://evil.example/x' } } } };
  assert.equal(MAK.toolUrl(pages, 's1', 'sakai.forums'), 'https://miaulario.unavarra.es/portal/site/s1/page/p4');
  assert.equal(MAK.toolUrl(pages, 's1', 'sakai.bad'), 'https://miaulario.unavarra.es/portal/site/s1', 'a page outside MiAulario is not used');
  assert.equal(MAK.toolUrl(pages, 's2', 'sakai.forums'), 'https://miaulario.unavarra.es/portal/site/s2');
  assert.equal(MAK.toolUrl(null, 's 3', 'x'), 'https://miaulario.unavarra.es/portal/site/s%203');
});

test('Mi sitio → Recursos: the root of the files of the user, and the files and folders of its first level', () => {
  assert.equal(MAK.driveRoot('/user/0a1b-2c/AyDS/Tema 1/'), '/user/0a1b-2c/');
  assert.equal(MAK.driveRoot('/user/0a1b-2c/'), '/user/0a1b-2c/');
  assert.equal(MAK.driveRoot('/group/2026_0_1_G/'), null, 'a course site: not the files of the user');
  assert.equal(MAK.driveRoot(''), null);
  const root = '/user/0a1b-2c/';
  // The addresses have the user name (nchareca), the ids of the form have the id of the user (0a1b-2c).
  const at = (path) => ({ url: `https://miaulario.unavarra.es/access/content/user/nchareca${path}` });
  const items = [
    at('/'),
    at('/AyDS/'),
    at('/AyDS/tema%201.pdf'),
    at('/Ingenieria%20del%20Conocimiento/'),
    at('/pr%C3%A1ctica1.sql'),
    at('/AyDS/'),
    { url: 'https://miaulario.unavarra.es/access/content/group/2026_0_1_G/x.pdf' },
    { url: 'https://evil.example/access/content/user/nchareca/y.pdf' },
    null
  ];
  assert.deepEqual(MAK.driveTopIds(items, root), ['/user/0a1b-2c/AyDS/', '/user/0a1b-2c/Ingenieria del Conocimiento/', '/user/0a1b-2c/práctica1.sql'],
    'only the first level, each one once, the names decoded, with the id of the root; not the root, a course site or other servers');
  assert.deepEqual(MAK.driveTopIds(undefined, root), []);
});

test('the files of the first level (the button of the files): no deeper, folders first, by name as people read', () => {
  const B = 'https://miaulario.unavarra.es/access/content/group/S/';
  const items = [
    { url: `${B}Tema%2010.pdf`, title: 'Tema 10.pdf', type: 'application/pdf' },
    { url: `${B}Tema%202.pdf`, title: 'Tema 2.pdf', type: 'application/pdf' },
    { url: `${B}Apuntes/`, title: 'Apuntes', type: 'collection' },
    { url: `${B}Apuntes/dentro.pdf`, title: 'dentro.pdf', type: 'application/pdf' },
    { url: `${B}Web`, title: 'Web', type: 'text/url', webLinkUrl: 'javascript:alert(1)' },
    { url: 'https://evil.example/access/content/group/S/x.pdf', title: 'x' },
    { url: B, title: 'S', type: 'collection' },
    null
  ];
  assert.deepEqual(MAK.topFiles(items).map((x) => [x.title, x.folder, x.link]), [['Apuntes', true, null], ['Tema 2.pdf', false, null], ['Tema 10.pdf', false, null], ['Web', false, null]]);
  // The stored copy (MAK.trimResource) and Mi sitio (the address has the name of the user).
  assert.deepEqual(MAK.topFiles([{ url: `${B}Apuntes/`, title: 'Apuntes', folder: true }, { url: 'https://miaulario.unavarra.es/access/content/user/chareca.1/notas.txt', title: 'notas.txt', link: null }]).map((x) => x.title), ['Apuntes', 'notas.txt']);
});

test('the id of a folder for Recursos, and the "#" of the button: only a folder of the same site', () => {
  const url = 'https://miaulario.unavarra.es/access/content/group/S/Pr%C3%A1cticas/';
  assert.equal(MAK.resourceId(url, '/group/S/'), '/group/S/Prácticas/');
  assert.equal(MAK.resourceId(url, '/group/OTHER/'), null);
  assert.equal(MAK.resourceId('https://miaulario.unavarra.es/access/content/user/chareca.1/A/', '/user/0a1b-2c/'), '/user/0a1b-2c/A/', 'Mi sitio: the id of the user, not the name');
  assert.equal(MAK.resourceId('https://miaulario.unavarra.es/access/content/group/S/a/%2E%2E/b/', '/group/S/'), '/group/S/b/', 'the address resolves "..": still in the site');
  assert.equal(MAK.resourceId('https://miaulario.unavarra.es/access/content/group/S/%2E%2E/T/b/', '/group/S/'), null, 'out of the site');
  const hash = (id) => `#mak-folder=${encodeURIComponent(id)}`;
  assert.deepEqual(MAK.filesHash(hash('/group/S/Prácticas/'), '/group/S/'), { action: 'folder', id: '/group/S/Prácticas/' });
  assert.deepEqual(MAK.filesHash(`#mak-zip=${encodeURIComponent('/user/u/A/')}`, '/user/u/'), { action: 'zip', id: '/user/u/A/' });
  for (const bad of [hash('/group/OTHER/A/'), hash('/group/S/'), hash('/group/S/file.pdf'), hash('/group/S/a/../b/'), '#mak-folder=%E0%A4%A', '#mak-other=x', '']) {
    assert.equal(MAK.filesHash(bad, '/group/S/'), null, bad);
  }
  assert.equal(MAK.zipFolder('https://miaulario.unavarra.es/access/content/group/S/Apuntes/', 'S'), 'https://miaulario.unavarra.es/access/content/group/S/Apuntes/');
  for (const bad of ['https://miaulario.unavarra.es/access/content/group/S/', 'https://miaulario.unavarra.es/access/content/group/T/A/', 'https://miaulario.unavarra.es/access/content/group/S/x.pdf', 'https://evil.example/access/content/group/S/A/', 7]) {
    assert.equal(MAK.zipFolder(bad, 'S'), null, String(bad));
  }
});
