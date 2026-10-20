'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, loadBackground, memoryArea, fakeFetch } = require('./helpers');
const F = require('./fixtures/miaulario');
const MAK = loadLib('core', 'store', 'names', 'api', 'grades', 'sync', 'due', 'inbox', 'search');

async function synced() {
  const area = memoryArea();
  const sync = MAK.createSync({ api: MAK.createApi({ fetch: fakeFetch(F.routes()) }), store: MAK.createStore(area), now: () => F.NOW, pauseMs: 0 });
  await sync.run({ force: true, full: true });
  return area.data;
}
const find = (d, q, settings) => MAK.searchIndex(MAK.buildSearchIndex(d, MAK.withDefaults(settings)), q, 30);

test('trimPages keeps the menu of the site (title and url of each page)', () => {
  const p = MAK.trimPages(F.pages(F.CS), F.NOW);
  assert.deepEqual(p.nav.slice(0, 3).map((x) => x.title), ['Inicio', 'Anuncios', 'Recursos']);
  assert.match(p.nav[2].url, /^https:\/\/miaulario\.unavarra\.es\/portal\/site\//);
});

test('the start of each word: a tool of a site, a file; inside a word only in the second pass', async () => {
  const d = await synced();
  assert.deepEqual(find(d, 'comp rec').map((x) => [x.type, x.title, x.site]), [['tool', 'Recursos', 'Computer Science']]);
  const tema = find(d, 'tema');
  assert.ok(tema.length && tema.every((x) => x.type === 'file'), 'files only');
  assert.equal(tema[0].title, 'Tema 2 - Integrales.pdf', 'the best first');
  assert.equal(tema[0].meta, 'Apuntes', 'the folder');
  const inside = find(d, 'ematic');
  assert.deepEqual([inside[0].type, inside[0].title, inside[0].hl], ['site', 'Mathematics I', [[4, 10]]], 'inside a word: the second pass (no result in the first)');
  assert.deepEqual(find(d, 'INTEGRÁLES').map((x) => x.title).slice(0, 1), ['Tema 2 - Integrales.pdf'], 'no case, no accents');
  assert.deepEqual(find(d, '   ').map((x) => x.title), ['Mathematics I', 'Computer Science', 'Physics', 'Degree Coordination'], 'a blank query: the sites');
});

test('all the types; deliveries with the due date; hidden sites and names from the user', async () => {
  const d = await synced();
  const types = new Set(find(d, 'lab').map((x) => x.type));
  assert.ok(types.has('delivery') && types.has('announcement'), [...types].join());
  assert.ok(find(d, 'exam').some((x) => x.type === 'event'));
  const lab3 = find(d, 'lab report 3').find((x) => x.type === 'delivery');
  assert.equal(lab3.time, d.assignments.find((a) => a.id === 'asg-red').due);
  assert.equal(find(d, 'comp rec', { hiddenSites: [F.CS] }).length, 0, 'hidden everywhere');
  assert.equal(find(d, 'comp rec', { hiddenSites: [F.CS], hiddenMode: 'sidebar' }).length, 1, 'hidden in the sidebar only');
  assert.deepEqual(find(d, 'cs rec', { nicknames: { [F.CS]: 'CS' } }).map((x) => [x.title, x.site]), [['Recursos', 'CS']]);
  assert.ok(find(d, 'computer', { nicknames: { [F.CS]: 'CS' } }).some((x) => x.type === 'site'), 'the full title also works');
  const r = find(d, 'tema')[0];
  assert.deepEqual(Object.keys(r).sort(), ['hl', 'meta', 'site', 'siteHl', 'siteId', 'time', 'title', 'type', 'url'], 'only the fields to show');
});

test('the sync gets again the pages that have no menu (data of version 1.3)', async () => {
  const area = memoryArea();
  const log = [];
  const clock = { t: F.NOW };
  const sync = MAK.createSync({ api: MAK.createApi({ fetch: fakeFetch(F.routes(), log) }), store: MAK.createStore(area), now: () => clock.t, pauseMs: 0 });
  await sync.run({ force: true });
  const pages = area.data.pages;
  for (const id of Object.keys(pages)) delete pages[id].nav;
  log.length = 0;
  clock.t += 20 * MAK.MINUTE;
  await sync.run();
  assert.equal(log.filter((l) => /\/pages\.json/.test(l.url)).length, F.SITES.length);
  assert.ok(Object.values(area.data.pages).every((p) => Array.isArray(p.nav)));
});

test('background: the search message for the palette in MiAulario; the index follows the data', async () => {
  const bg = loadBackground({ fetch: fakeFetch(F.routes()) });
  await bg.send({ type: 'syncNow', full: true });
  const CONTENT = { id: 'ext-id', tab: { id: 1 }, frameId: 0, url: `https://miaulario.unavarra.es/portal/site/${F.CS}` };
  let r = await bg.send({ type: 'search', query: 'comp rec' }, CONTENT);
  assert.deepEqual(r.results.map((x) => [x.type, x.title, x.site]), [['tool', 'Recursos', 'Computer Science']]);
  await bg.send({ type: 'renameSite', siteId: F.CS, name: 'CS' });
  r = await bg.send({ type: 'search', query: 'cs rec' }, CONTENT);
  assert.deepEqual(r.results.map((x) => x.site), ['CS'], 'a new index after a change of the settings');
  assert.deepEqual((await bg.send({ type: 'search', query: '' }, CONTENT)).results.map((x) => x.type), ['site', 'site', 'site', 'site'], 'an empty query: the sites');
  assert.equal((await bg.send({ type: 'search', query: 42 }, CONTENT)).results.length, 4, 'not a text: an empty query');
  r = await bg.send({ type: 'search', query: 'a'.repeat(5000) }, CONTENT);
  assert.deepEqual(r.results, [], 'a long query is cut');
  assert.equal(await bg.send({ type: 'search', query: 'lab' }, Object.assign({}, CONTENT, { url: 'https://evil.example/' })), null, 'other origin');
  assert.ok((await bg.send({ type: 'search', query: 'lab' }, CONTENT)).results.length <= 20);
  assert.equal(MAK.withDefaults({}).searchShortcut, true);
  assert.equal(MAK.withDefaults({ searchShortcut: false }).searchShortcut, false);
});

// ---- The fuzzy finder ------------------------------------------------------------------------

const BASE = 'https://miaulario.unavarra.es';
function fuzzyIndex() {
  const raw = [
    ['P', '26_0_240701_1 PROCESADORES DEL LENGUAJE'],
    ['A', '26_0_240504_1 ANÁLISIS DE DATOS'],
    ['S', '26_0_240302_1 SEGURIDAD EN SISTEMAS INFORMÁTICOS'],
    ['G', '26_0_240105_1 PROGRAMACIÓN']
  ];
  const d = { sites: raw.map(([id, title]) => ({ id, title })), pages: {} };
  for (const [id] of raw) {
    d.pages[id] = { tools: {}, nav: ['Inicio', 'Recursos', 'Anuncios', 'Tareas'].map((t) => ({ title: t, url: `${BASE}/portal/site/${id}/page/${t}` })) };
  }
  d[MAK.resourceKey('A')] = { at: 1, items: [
    { title: 'Tema 2 - Integrales.pdf', url: `${BASE}/access/content/group/A/Apuntes/Tema%202%20-%20Integrales.pdf`, modified: 2 },
    { title: 'Práctica 3 - Regresión lineal.ipynb', url: `${BASE}/access/content/group/A/Pr%C3%A1cticas/Pr%C3%A1ctica%203.ipynb`, modified: 1 }
  ] };
  return MAK.buildSearchIndex(d, MAK.withDefaults({}));
}
const q = (query) => MAK.searchIndex(fuzzyIndex(), query, 30);
const top = (query) => {
  const r = q(query)[0];
  return r && [r.type, r.site, r.title];
};

test('fuzzy: the letters in order, each group at the start of a word; the matched parts', () => {
  const pdl = q('pdl')[0];
  assert.deepEqual([pdl.type, pdl.title, pdl.hl], ['site', 'Procesadores del Lenguaje', [[0, 1], [13, 14], [17, 18]]], 'initials');
  assert.deepEqual(top('ssi'), ['site', 'Seguridad en Sistemas Informáticos', 'Seguridad en Sistemas Informáticos']);
  assert.deepEqual(top('proc len'), ['site', 'Procesadores del Lenguaje', 'Procesadores del Lenguaje']);
  assert.deepEqual(top('ANALISIS'), ['site', 'Análisis de Datos', 'Análisis de Datos'], 'no case, no accents');
  assert.deepEqual(q('ANALISIS')[0].hl, [[0, 8]], 'the parts in the original text (with the accent)');
  const rec = q('an dat rec')[0];
  assert.deepEqual([rec.type, rec.site, rec.title, rec.hl, rec.siteHl], ['tool', 'Análisis de Datos', 'Recursos', [[0, 3]], [[0, 2], [12, 15]]], 'a word for the site, a word for the title');
  const one = q('andatrec')[0];
  assert.deepEqual([one.type, one.site, one.title, one.hl, one.siteHl], ['tool', 'Análisis de Datos', 'Recursos', [[0, 3]], [[0, 2], [12, 15]]], 'one word over the site and the title');
  assert.deepEqual(q('rec').slice(0, 4).map((x) => [x.type, x.title]), Array(4).fill(['tool', 'Recursos']), 'the tools of all the sites first');
  assert.deepEqual(top('240701'), ['site', 'Procesadores del Lenguaje', 'Procesadores del Lenguaje'], 'the code in the full name of the site');
  assert.deepEqual(q('tema 2').map((x) => x.title), ['Tema 2 - Integrales.pdf']);
});

test('fuzzy: a word inside a word and errors only when the first pass finds nothing', () => {
  assert.deepEqual(top('integarles'), ['file', 'Análisis de Datos', 'Tema 2 - Integrales.pdf'], 'two letters swapped');
  assert.deepEqual(q('integarles')[0].hl, [[9, 19]], 'the word with the error');
  assert.deepEqual(top('prgramacion'), ['site', 'Programación', 'Programación'], 'one letter less');
  assert.deepEqual(top('lenguje'), ['site', 'Procesadores del Lenguaje', 'Procesadores del Lenguaje'], 'one letter less, inside the name');
  assert.deepEqual(top('grales'), ['file', 'Análisis de Datos', 'Tema 2 - Integrales.pdf'], 'the end of a word');
  assert.deepEqual(q('xyzw'), [], 'no match');
  assert.ok(q('ces').length, 'inside "Procesadores": second pass');
  assert.equal(q('rec').some((x) => x.title === 'Práctica 3 - Regresión lineal.ipynb'), false, 'no scattered letters ("r…e…c")');
  assert.equal(q('tema').length, 1, 'a result: no second pass ("sisTEMAs")');
});

test('fuzzy: "\'" for the exact text, "!" to remove, and the empty query gives the sites', () => {
  assert.deepEqual(q("'tema 2").map((x) => x.title), ['Tema 2 - Integrales.pdf']);
  assert.deepEqual(q("'ntegra").map((x) => [x.title, x.hl]), [['Tema 2 - Integrales.pdf', [[10, 16]]]], 'exact: also inside a word');
  assert.deepEqual(q('an dat !tema !practica !anuncios !tareas !inicio').map((x) => [x.type, x.title]), [['site', 'Análisis de Datos'], ['tool', 'Recursos']]);
  assert.deepEqual(q('!tema'), [], 'only words to remove: nothing');
  assert.deepEqual(q('').map((x) => [x.type, x.title, x.hl]), [
    ['site', 'Procesadores del Lenguaje', []], ['site', 'Análisis de Datos', []], ['site', 'Seguridad en Sistemas Informáticos', []], ['site', 'Programación', []]
  ]);
  assert.deepEqual(q('--'), []);
});

test('fuzzy: a large index is fast', () => {
  const index = fuzzyIndex();
  const big = [];
  for (let i = 0; i < 400; i++) for (const e of index) big.push(Object.assign({}, e, { title: `${e.title} ${i}` }));
  const t0 = process.hrtime.bigint();
  for (const query of ['p', 'pdl', 'an dat rec', 'integarles', 'xyzw', 'tema 2 integ']) MAK.searchIndex(big, query, 30);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 1500, `${big.length} entries, 6 searches: ${ms.toFixed(0)} ms`);
});

// ---- Lessons ("Contenidos") ----------------------------------------------------------

// The tree of a page of Lessons, as the Contenidos of SSI: text blocks with titles and links.
const SSI_TREE = { contentsList: [
  { type: 5, name: '', html: '<h1>Pagina de entrega de flags</h1><ul><li><p><a href="http://10.6.31.60">Enlace</a></p></li></ul><h1>Recursos adicionales:</h1><ul><li><a href="https://www.tlm.unavarra.es/~santi/SSI/libro/libro.pdf">Libro</a></li></ul>' },
  { type: 5, name: '', html: '<h1 style="text-align:center">Septiembre</h1>' },
  { type: 5, name: '', html: '<h2>Mi&eacute;rcoles d&iacute;a 9</h2><p>Teoria 15:00 - 17:00</p><ul><li><a href="https://www.tlm.unavarra.es/~santi/SSI/transparencias/tema1.0.pdf">Criptograf&iacute;a (Parte 1)</a></li><li><a href="javascript:alert(1)">mal</a></li></ul>' },
  { type: 2, name: 'Prácticas', contentsList: [{ type: 1, name: 'Enunciado práctica 2.pdf', sakaiId: '/group/S/Lessons/práctica 2.pdf', url: '' }] }
] };

test('trimLessonTree: the titles and the links of the text blocks, the subpages and the files, with their place', () => {
  const parts = MAK.trimLessonTree(SSI_TREE, 'Contenidos');
  assert.deepEqual(parts.map((p) => [p.kind, p.title, p.path, p.url]), [
    ['heading', 'Pagina de entrega de flags', 'Contenidos', null],
    ['link', 'Enlace', 'Contenidos › Pagina de entrega de flags', 'http://10.6.31.60/'],
    ['heading', 'Recursos adicionales:', 'Contenidos', null],
    ['link', 'Libro', 'Contenidos › Recursos adicionales:', 'https://www.tlm.unavarra.es/~santi/SSI/libro/libro.pdf'],
    ['heading', 'Septiembre', 'Contenidos', null],
    ['heading', 'Miércoles día 9', 'Contenidos', null],
    ['link', 'Criptografía (Parte 1)', 'Contenidos › Miércoles día 9', 'https://www.tlm.unavarra.es/~santi/SSI/transparencias/tema1.0.pdf'],
    ['page', 'Prácticas', 'Contenidos', null],
    ['link', 'Enunciado práctica 2.pdf', 'Contenidos › Prácticas', 'https://miaulario.unavarra.es/access/content/group/S/Lessons/pr%C3%A1ctica%202.pdf']
  ], 'no javascript: link');
  assert.deepEqual(MAK.trimLessonTree(null, 'x'), []);
});

test('the sync reads the Contenidos of the sites with Lessons (an error 500 gives no parts, not an error); the search finds them', async () => {
  const routes = F.routes();
  const withLessons = (id) => {
    const p = F.pages(id);
    p.push({ id: `${id}-page-9`, title: 'Contenidos', url: `https://miaulario.unavarra.es/portal/site/${id}/page/${id}-page-9`, tools: [{ id: `${id}-tool-9`, toolId: 'sakai.lessonbuildertool', title: 'Contenidos' }] });
    return p;
  };
  routes[`/direct/site/${F.CS}/pages.json`] = withLessons(F.CS);
  routes[`/direct/site/${F.PHYS}/pages.json`] = withLessons(F.PHYS);
  routes[`/direct/lessons/site/${F.CS}.json`] = { lessons_collection: [{ id: 77, lessonTitle: 'Contenidos', hidden: false }] };
  routes['/direct/lessons/lesson/77.json'] = SSI_TREE;
  routes[`/direct/lessons/site/${F.PHYS}.json`] = fakeFetch.raw({ ok: false, status: 500, headers: { get: () => 'text/html' } });
  const area = memoryArea();
  const clock = { t: F.NOW };
  const sync = MAK.createSync({ api: MAK.createApi({ fetch: fakeFetch(routes) }), store: MAK.createStore(area), now: () => clock.t, pauseMs: 0 });
  await sync.run({ force: true });
  // The first sync after an update (not full, no Contenidos stored yet) reads them too.
  delete area.data.lessons;
  clock.t += 20 * MAK.MINUTE;
  const r = await sync.run({ force: true });
  assert.equal(r.full, false);
  assert.ok(!r.backoff, 'no backoff for the error 500');
  assert.equal(area.data.lessons[F.CS].items.length, 9);
  assert.deepEqual(area.data.lessons[F.PHYS].items, [], 'error 500: no parts');
  assert.equal(area.data.meta.stale[`lessons:${F.PHYS}`], undefined, 'not stale');
  const hit = find(area.data, 'cripto')[0];
  assert.deepEqual([hit.type, hit.title, hit.site, hit.meta, hit.url], ['lesson', 'Criptografía (Parte 1)', 'Computer Science', 'Contenidos › Miércoles día 9', 'https://www.tlm.unavarra.es/~santi/SSI/transparencias/tema1.0.pdf']);
  assert.equal(find(area.data, 'septiembre')[0].url, `https://miaulario.unavarra.es/portal/site/${F.CS}/page/${F.CS}-page-9`, 'a title opens the page of Contenidos');
});
