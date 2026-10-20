'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { loadLib } = require('./helpers');
const F = require('./fixtures/miaulario');
const MAK = loadLib('core', 'store', 'api', 'i18n', 'zip');

const bytes = (s) => new TextEncoder().encode(s);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mak-zip-'));
const writeZip = (dir, parts) => {
  const file = path.join(dir, 'test.zip');
  fs.writeFileSync(file, Buffer.concat(parts.map((p) => Buffer.from(p))));
  return file;
};
// Read the archive with Python's zipfile: test the CRCs, and return the names and the contents.
function pythonRead(file) {
  const script = 'import json,sys,zipfile\nz=zipfile.ZipFile(sys.argv[1])\nbad=z.testzip()\nprint(json.dumps({"bad":bad,"names":z.namelist(),"files":{n:z.read(n).decode("utf-8","replace") for n in z.namelist() if not n.endswith("/")}}))';
  return JSON.parse(execFileSync('python3', ['-I', '-c', script, file]).toString());
}
// Extract with bsdtar (the same UTF-8 handling as Finder, Windows Explorer and 7-Zip). On macOS,
// "tar" is bsdtar. On Linux, "tar" is GNU tar, which does not read ZIP files: use "bsdtar", or
// else Python's zipfile, which also reads the UTF-8 flag.
function extract(file, to) {
  for (const cmd of ['bsdtar', 'tar']) {
    try {
      const version = execFileSync(cmd, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
      if (/bsdtar/.test(version)) return execFileSync(cmd, ['-xf', file, '-C', to]);
    } catch {}
  }
  return execFileSync('python3', ['-I', '-c', 'import sys,zipfile\nzipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', file, to]);
}

test('crc32 with known values', () => {
  assert.equal(MAK.crc32(bytes('123456789')), 0xcbf43926);
  assert.equal(MAK.crc32(new Uint8Array(0)), 0);
  assert.equal(MAK.crc32(bytes('The quick brown fox jumps over the lazy dog')), 0x414fa339);
});

test('the ZIP is valid for Python zipfile and unzip, with UTF-8 names, folders and an empty file', () => {
  const zip = MAK.createZip();
  const binary = new Uint8Array(256 * 1024).map((_, i) => (i * 7919) % 256);
  zip.addDir('Matemáticas', Date.UTC(2026, 9, 1));
  zip.addDir('Matemáticas/Prácticas vacía');
  zip.addFile('Matemáticas/Tema 1 – Integrales.pdf', binary, Date.UTC(2026, 9, 2, 10, 30));
  zip.addFile('Matemáticas/ñandú €.txt', bytes('hola ñandú €\n'));
  zip.addFile('Matemáticas/empty.txt', new Uint8Array(0));
  assert.equal(zip.count, 5);
  const dir = tmp();
  const file = writeZip(dir, zip.finish());
  const r = pythonRead(file);
  assert.equal(r.bad, null, 'all CRCs are correct');
  assert.deepEqual(r.names, ['Matemáticas/', 'Matemáticas/Prácticas vacía/', 'Matemáticas/Tema 1 – Integrales.pdf', 'Matemáticas/ñandú €.txt', 'Matemáticas/empty.txt']);
  assert.equal(r.files['Matemáticas/ñandú €.txt'], 'hola ñandú €\n');
  const out = execFileSync('unzip', ['-t', file]).toString();
  assert.match(out, /No errors detected/);
  // The old unzip 6.0 of macOS ignores the UTF-8 flag, so it is not used to extract.
  fs.mkdirSync(path.join(dir, 'x'));
  extract(file, path.join(dir, 'x'));
  const extracted = fs.readFileSync(path.join(dir, 'x', 'Matemáticas', 'Tema 1 – Integrales.pdf'));
  assert.ok(Buffer.from(binary).equals(extracted));
  assert.ok(fs.statSync(path.join(dir, 'x', 'Matemáticas', 'Prácticas vacía')).isDirectory());
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the ZIP stops at its limits', () => {
  const few = MAK.createZip({ maxEntries: 2 });
  few.addFile('a', bytes('a'));
  few.addFile('b', bytes('b'));
  assert.equal(few.count, 2);
  assert.throws(() => few.addFile('c', bytes('c')), /zip-too-many-entries/);
  // The limit counts the local header, the data and the central header of each entry.
  const exact = MAK.createZip({ maxBytes: 30 + 1 + 10 + 46 + 1 + 22 });
  exact.addFile('a', new Uint8Array(10));
  assert.throws(() => exact.addFile('b', new Uint8Array(0)), /zip-too-big/);
  const small = MAK.createZip({ maxBytes: 200 });
  assert.throws(() => small.addFile('big', new Uint8Array(300)), /zip-too-big/);
});

test('safeFileName: Windows, macOS and Linux', () => {
  assert.equal(MAK.safeFileName('a/b\\c:d*e?f"g<h>i|j'), 'a_b_c_d_e_f_g_h_i_j');
  assert.equal(MAK.safeFileName('..'), '_');
  assert.equal(MAK.safeFileName('.'), '_');
  assert.equal(MAK.safeFileName(''), '_');
  assert.equal(MAK.safeFileName('name. . '), 'name');
  assert.equal(MAK.safeFileName('CON'), '_CON');
  assert.equal(MAK.safeFileName('lpt1.txt'), '_lpt1.txt');
  assert.equal(MAK.safeFileName('console.txt'), 'console.txt');
  assert.equal(MAK.safeFileName('tab\there\u0001'), 'tab_here_');
  const long = MAK.safeFileName(`${'x'.repeat(300)}.pdf`);
  assert.equal(long.length, 150);
  assert.ok(long.endsWith('.pdf'));
});

test('names that differ only in the case get a number', () => {
  const unique = MAK.createNamer();
  assert.equal(unique('root', 'Notes.pdf'), 'Notes.pdf');
  assert.equal(unique('root', 'notes.PDF'), 'notes (2).PDF');
  assert.equal(unique('root', 'NOTES.pdf'), 'NOTES (3).pdf');
  assert.equal(unique('root/other', 'Notes.pdf'), 'Notes.pdf');
  assert.equal(unique('root', 'README'), 'README');
  assert.equal(unique('root', 'readme'), 'readme (2)');
});

test('resourceSegments decodes the path and rejects other paths', () => {
  const base = `https://miaulario.unavarra.es/access/content/group/${F.MATH}/`;
  assert.deepEqual(MAK.resourceSegments(`${base}Pr%C3%A1cticas/Tema%201.pdf`, F.MATH), ['Prácticas', 'Tema 1.pdf']);
  assert.deepEqual(MAK.resourceSegments(`${base}a%2F..%2Fb/x`, F.MATH), ['a_.._b', 'x'], 'an encoded slash does not make a new folder');
  assert.equal(MAK.resourceSegments(`${base}%2E%2E/x`, F.MATH), null, 'the URL parser resolves %2E%2E: the path leaves the site, so it is rejected');
  assert.equal(MAK.resourceSegments('https://miaulario.unavarra.es/access/content/group/other/x', F.MATH), null);
  assert.equal(MAK.resourceSegments('not a url', F.MATH), null);
});

test('linkFile: only http(s), and the URL and the title are escaped', () => {
  const html = MAK.linkFile('<b>Sim</b>', 'https://example.org/a?x=1&y="2"');
  assert.match(html, /url=https:\/\/example\.org\/a\?x=1&amp;y=%222%22/);
  assert.match(html, /<title>&lt;b&gt;Sim&lt;\/b&gt;<\/title>/);
  assert.equal(MAK.linkFile('x', 'javascript:alert(1)'), null);
});

test('buildSiteZip: folders, files, links, empty folders and errors', async () => {
  MAK.setLang('es');
  const items = F.resources(F.MATH).map((r) => MAK.trimResource(r, F.MATH)).filter(Boolean);
  items.push(MAK.trimResource({ url: `https://miaulario.unavarra.es/access/content/group/${F.MATH}/Apuntes/Protegido.pdf`, title: 'Protegido.pdf', type: 'application/pdf', size: 5, modifiedDate: F.sakaiDate(F.NOW), copyrightAlert: true }, F.MATH));
  items.push(MAK.trimResource({ url: `https://miaulario.unavarra.es/access/content/group/${F.MATH}/Apuntes/Perdido.pdf`, title: 'Perdido.pdf', type: 'application/pdf', size: 5, modifiedDate: F.sakaiDate(F.NOW) }, F.MATH));
  const fetched = [];
  const fetchFile = async (url) => {
    fetched.push(url);
    if (url.endsWith('Protegido.pdf')) return { ok: true, status: 200, url, type: 'text/html; charset=UTF-8', data: bytes('<html>accept</html>') };
    if (url.endsWith('Perdido.pdf')) return { ok: false, status: 404, url, type: 'text/html', data: null };
    return { ok: true, status: 200, url, type: 'application/pdf', data: bytes(`PDF ${url}`) };
  };
  const progress = [];
  const r = await MAK.buildSiteZip({ items, siteId: F.MATH, siteTitle: 'Matemáticas I', fetchFile, onProgress: (p) => progress.push(p.index), t: MAK.t, now: F.NOW });
  assert.equal(r.files, 4, '3 PDF files and 1 link');
  assert.equal(r.errors.length, 2);
  assert.ok(!fetched.some((u) => u.includes('Simulador')), 'a link is not downloaded');
  const dir = tmp();
  const z = pythonRead(writeZip(dir, r.parts));
  assert.equal(z.bad, null);
  assert.deepEqual(z.names.filter((n) => n.endsWith('/')).sort(), ['Matemáticas I/', 'Matemáticas I/Apuntes/', 'Matemáticas I/Enlaces/', 'Matemáticas I/Prácticas/', 'Matemáticas I/Vacía/']);
  assert.ok(z.names.includes('Matemáticas I/Apuntes/Tema 2 - Integrales.pdf'));
  assert.ok(z.names.includes('Matemáticas I/Prácticas/Enunciado.pdf'));
  assert.match(z.files['Matemáticas I/Enlaces/Simulador.html'], /url=https:\/\/example\.org\/simulator/);
  const errors = z.files['Matemáticas I/_errores.txt'];
  assert.match(errors, /Apuntes\/Protegido\.pdf: hay que aceptar los derechos de autor en MiAulario/);
  assert.match(errors, /Apuntes\/Perdido\.pdf: error HTTP 404/);
  assert.equal(progress[progress.length - 1], items.filter((x) => !x.folder).length);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('buildSiteZip: a folder in a folder with a new name ("practicas (2)") stays in it', async () => {
  const base = `https://miaulario.unavarra.es/access/content/group/${F.CS}`;
  const folder = (p) => ({ url: `${base}/${p}/`, title: p.split('/').pop(), type: 'collection', size: 0, modified: F.NOW, folder: true, link: null, copyright: false });
  const items = [folder('Practicas'), folder('practicas'), folder('practicas/sub'),
    { url: `${base}/practicas/sub/a.pdf`, title: 'a.pdf', type: 'application/pdf', size: 1, modified: F.NOW, folder: false, link: null, copyright: false }];
  const r = await MAK.buildSiteZip({ items, siteId: F.CS, siteTitle: 'CS', fetchFile: async (url) => ({ ok: true, status: 200, url, type: 'application/pdf', data: bytes('x') }), t: MAK.t, now: F.NOW });
  const dir = tmp();
  const z = pythonRead(writeZip(dir, r.parts));
  assert.ok(z.names.includes('CS/practicas (2)/sub/a.pdf'), z.names.join(' | '));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('buildSiteZip: two folders whose names become the same ("Tema 1: Intro", "Tema 1? Intro") keep their own files', async () => {
  const base = `https://miaulario.unavarra.es/access/content/group/${F.CS}`;
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
  const folder = (p) => ({ url: `${base}/${enc(p)}/`, title: p.split('/').pop(), type: 'collection', size: 0, modified: F.NOW, folder: true, link: null, copyright: false });
  const file = (p) => ({ url: `${base}/${enc(p)}`, title: p.split('/').pop(), type: 'application/pdf', size: 1, modified: F.NOW, folder: false, link: null, copyright: false });
  const items = [folder('Tema 1: Intro'), folder('Tema 1? Intro'), folder('Tema 1: Intro/sub'), file('Tema 1: Intro/sub/a.pdf'), file('Tema 1: Intro/b.pdf'), file('Tema 1? Intro/c.pdf')];
  const r = await MAK.buildSiteZip({ items, siteId: F.CS, siteTitle: 'CS', fetchFile: async (url) => ({ ok: true, status: 200, url, type: 'application/pdf', data: bytes('x') }), t: MAK.t, now: F.NOW });
  const dir = tmp();
  const z = pythonRead(writeZip(dir, r.parts));
  const files = z.names.filter((n) => !n.endsWith('/')).sort();
  assert.deepEqual(files, ['CS/Tema 1_ Intro (2)/c.pdf', 'CS/Tema 1_ Intro/b.pdf', 'CS/Tema 1_ Intro/sub/a.pdf']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('buildSiteZip: a redirect out of the content area is an error; cancel stops the job', async () => {
  const items = [MAK.trimResource({ url: `https://miaulario.unavarra.es/access/content/group/${F.CS}/a.pdf`, title: 'a.pdf', type: 'application/pdf', size: 1, modifiedDate: F.sakaiDate(F.NOW) }, F.CS)];
  const r = await MAK.buildSiteZip({ items, siteId: F.CS, siteTitle: 'CS', fetchFile: async () => ({ ok: true, status: 200, url: 'https://miaulario.unavarra.es/portal/login', type: 'application/pdf', data: bytes('x') }), t: MAK.t });
  assert.equal(r.files, 0);
  assert.match(r.errors[0], /la descarga salió de MiAulario/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(MAK.buildSiteZip({ items, siteId: F.CS, siteTitle: 'CS', fetchFile: async () => ({}), signal: controller.signal, t: MAK.t }), /aborted/);
});

test('formatSize', () => {
  assert.equal(MAK.formatSize(512, 'es-ES'), '512 B');
  assert.equal(MAK.formatSize(17.7 * 1024 * 1024, 'es-ES'), '17,7 MB');
  assert.equal(MAK.formatSize(17.7 * 1024 * 1024, 'en-GB'), '17.7 MB');
});

test('openZip: a content script opens the tools page for a known site only', async () => {
  const { loadBackground, fakeFetch } = require('./helpers');
  const bg = loadBackground({ fetch: fakeFetch(F.routes()) });
  await bg.send({ type: 'syncNow' });
  const CONTENT = { id: 'ext-id', tab: { id: 1 }, frameId: 0, url: `https://miaulario.unavarra.es/portal/site/${F.MATH}` };
  assert.deepEqual(await bg.send({ type: 'openZip', siteId: F.MATH }, CONTENT), { ok: true });
  assert.equal(bg.ext._tabs[0].url, `chrome-extension://ext-id/tools.html?zip=${F.MATH}`);
  assert.deepEqual(await bg.send({ type: 'openZip', siteId: 'evil"><script>' }, CONTENT), { ok: false });
  assert.equal(bg.ext._tabs.length, 1);
});
