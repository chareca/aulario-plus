'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, memoryArea, fakeFetch } = require('./helpers');
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

test('the start of each word: a tool of a site, a file, no match inside a word', async () => {
  const d = await synced();
  assert.deepEqual(find(d, 'comp rec').map((x) => [x.type, x.title, x.site]), [['tool', 'Recursos', 'Computer Science']]);
  const tema = find(d, 'tema');
  assert.ok(tema.length && tema.every((x) => x.type === 'file'), 'files only');
  assert.equal(tema[0].title, 'Tema 2 - Integrales.pdf', 'the best first');
  assert.equal(tema[0].meta, 'Apuntes', 'the folder');
  assert.equal(find(d, 'ematic').length, 0, 'not inside a word');
  assert.deepEqual(find(d, 'INTEGRÁLES').map((x) => x.title).slice(0, 1), ['Tema 2 - Integrales.pdf'], 'no case, no accents');
  assert.deepEqual(find(d, '   '), []);
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
  assert.deepEqual(Object.keys(r).sort(), ['meta', 'site', 'siteId', 'time', 'title', 'type', 'url'], 'only the fields to show');
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
