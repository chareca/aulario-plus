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

test('htmlToText removes tags and scripts and decodes entities', () => {
  const html = '<p>Hola&nbsp;<b>mundo</b> &amp; m&aacute;s</p><script>alert(1)</script><style>p{}</style>' +
    '<ul><li>Uno</li><li>Dos</li></ul>L&iacute;nea<br>nueva &#8364; &#x41; &unknown;<!-- c -->';
  assert.equal(MAK.htmlToText(html), 'Hola mundo & más\n\n- Uno\n- Dos\nLínea\nnueva € A &unknown;');
  assert.equal(MAK.htmlToText(''), '');
  assert.equal(MAK.htmlToText(null), '');
  assert.equal(MAK.htmlToText('&#0; &#xD800; ok'), 'ok');
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
  const at = (path) => ({ url: `https://miaulario.unavarra.es/access/content${path}` });
  const items = [
    at('/user/0a1b-2c/'),
    at('/user/0a1b-2c/AyDS/'),
    at('/user/0a1b-2c/AyDS/tema%201.pdf'),
    at('/user/0a1b-2c/Ingenieria%20del%20Conocimiento/'),
    at('/user/0a1b-2c/pr%C3%A1ctica1.sql'),
    at('/user/0a1b-2c/AyDS/'),
    at('/user/other/x.pdf'),
    { url: 'https://evil.example/access/content/user/0a1b-2c/y.pdf' },
    null
  ];
  assert.deepEqual(MAK.driveTopIds(items, root), ['/user/0a1b-2c/AyDS/', '/user/0a1b-2c/Ingenieria del Conocimiento/', '/user/0a1b-2c/práctica1.sql'],
    'only the first level, each one once, the names decoded; not the root, other users or other servers');
  assert.deepEqual(MAK.driveTopIds(undefined, root), []);
});
