'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, loadBackground, fakeFetch } = require('./helpers');
const F = require('./fixtures/miaulario');
const MAK = loadLib('core', 'store', 'names');

test('shortTitle: the real titles of the UPNA', () => {
  assert.equal(MAK.shortTitle('26_0_240504_1 ANÁLISIS DE APLICACIONES EMPRESARIALES'), 'Análisis de Aplicaciones Empresariales');
  assert.equal(MAK.shortTitle('26_0_240701_1_G GESTIÓN DE PROYECTOS INFORMÁTICOS I'), 'Gestión de Proyectos Informáticos I');
  assert.equal(MAK.shortTitle('26_0_240802_1_G COMPLEJIDAD Y COMPUTABILIDAD'), 'Complejidad y Computabilidad');
});

test('shortTitle: small words, Roman numbers, acronyms, hyphens, numbers; small letters stay', () => {
  assert.equal(MAK.shortTitle('26_0_1_1 BASES DE DATOS (SQL) II'), 'Bases de Datos (SQL) II');
  assert.equal(MAK.shortTitle('TFG - TRABAJO FIN DE GRADO'), 'TFG - Trabajo Fin de Grado');
  assert.equal(MAK.shortTitle('INGLÉS B1 PARA INGENIERÍA'), 'Inglés B1 para Ingeniería');
  assert.equal(MAK.shortTitle('26_0_9_1 TEORÍA-PRÁCTICA DE LA EMPRESA'), 'Teoría-Práctica de la Empresa');
  assert.equal(MAK.shortTitle('Y OTRAS COSAS'), 'Y Otras Cosas', 'the first word is never small');
  assert.equal(MAK.shortTitle('Coordinación del Grado en Informática'), 'Coordinación del Grado en Informática');
  assert.equal(MAK.shortTitle('26_0_240504_1 Análisis de datos'), 'Análisis de datos', 'only the code goes');
  assert.equal(MAK.shortTitle('26_0_1_1'), '26_0_1_1', 'only a code: no change');
  assert.equal(MAK.shortTitle('  MUCHOS   ESPACIOS  '), 'Muchos Espacios');
});

test('siteName and namedSites: the name from the user, then the short name, then the title', () => {
  const site = { id: 's1', title: '26_0_240504_1 ANÁLISIS DE APLICACIONES EMPRESARIALES', type: 'course' };
  const s = (o) => MAK.withDefaults(o);
  assert.equal(MAK.siteName(site, s({})), 'Análisis de Aplicaciones Empresariales');
  assert.equal(MAK.siteName(site, s({ nicknames: { s1: 'AAE' } })), 'AAE');
  assert.equal(MAK.siteName(site, s({ shortNames: false })), site.title);
  assert.equal(MAK.siteName(site, s({ shortNames: false, nicknames: { s1: 'AAE' } })), 'AAE', 'the name from the user stays');
  const [x] = MAK.namedSites([site], s({ nicknames: { s1: 'AAE' } }));
  assert.deepEqual(x, { id: 's1', title: 'AAE', fullTitle: site.title, type: 'course' });
  assert.equal(site.title, '26_0_240504_1 ANÁLISIS DE APLICACIONES EMPRESARIALES', 'the stored site does not change');
});

test('nicknames: one line, no invisible characters, 40 characters at most, 200 sites at most', () => {
  const n = MAK.withDefaults({ nicknames: { a: '  AAE\n', b: '', c: null, d: 5, e: 'x'.repeat(60), f: 'A​B‮C' } }).nicknames;
  assert.deepEqual({ ...n }, { a: 'AAE', e: 'x'.repeat(40), f: 'A B C' });
  const many = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`s${i}`, 'N']));
  assert.equal(Object.keys(MAK.withDefaults({ nicknames: many }).nicknames).length, 200);
  assert.equal(MAK.withDefaults({}).shortNames, true);
});

test('background: setSettings merges the names; null removes one; the grade notification uses the name', async () => {
  const data = F.make(Date.now());
  const routes = data.routes();
  const bg = loadBackground({ fetch: fakeFetch(routes) });
  await bg.send({ type: 'syncNow' });
  await bg.send({ type: 'setSettings', patch: { nicknames: { [F.CS]: 'CS' } } });
  let s = await bg.send({ type: 'setSettings', patch: { nicknames: { [F.MATH]: 'Mates' } } });
  assert.deepEqual(s.nicknames, { [F.CS]: 'CS', [F.MATH]: 'Mates' });
  s = await bg.send({ type: 'setSettings', patch: { nicknames: { [F.MATH]: null } } });
  assert.deepEqual(s.nicknames, { [F.CS]: 'CS' });
  routes['/api/users/me/grades'] = { grades: F.GRADES.map((g) => (g.id === 503 ? Object.assign({}, g, { score: '9', notGradedYet: false }) : g)) };
  await bg.send({ type: 'syncNow' });
  assert.equal(bg.ext._notes.get('grade:503').title, 'Nota nueva · CS');
});

test('background: renameSite from the popup or from MiAulario; the automatic name removes the name', async () => {
  const bg = loadBackground({ fetch: fakeFetch(F.routes()) });
  await bg.send({ type: 'syncNow' });
  const CONTENT = { id: 'ext-id', tab: { id: 1 }, frameId: 0, url: `https://miaulario.unavarra.es/portal/site/${F.CS}` };
  const nick = async () => (await bg.ext.storage.local.get('settings')).settings.nicknames;
  assert.deepEqual(await bg.send({ type: 'renameSite', siteId: F.CS, name: '  IyP\n' }, CONTENT), { ok: true, name: 'IyP' });
  assert.deepEqual({ ...(await nick()) }, { [F.CS]: 'IyP' });
  assert.deepEqual(await bg.send({ type: 'renameSite', siteId: F.CS, name: 'Computer Science' }), { ok: true, name: 'Computer Science' });
  assert.deepEqual({ ...(await nick()) }, {}, 'the automatic name: no name from the user');
  await bg.send({ type: 'renameSite', siteId: F.CS, name: 'x'.repeat(80) });
  assert.equal((await nick())[F.CS].length, 40);
  await bg.send({ type: 'renameSite', siteId: F.CS, name: '' });
  assert.deepEqual({ ...(await nick()) }, {});
  assert.equal(await bg.send({ type: 'renameSite', siteId: 'unknown', name: 'X' }, CONTENT), null);
  assert.equal(await bg.send({ type: 'renameSite', siteId: '~user', name: 'X' }, CONTENT), null);
  assert.equal(await bg.send({ type: 'renameSite', siteId: F.CS, name: 'X' }, Object.assign({}, CONTENT, { frameId: 2 })), null, 'not from a frame');
});

test('publicSiteName: the name for other persons is never the name from the user', () => {
  const site = { id: 'S', title: '26_0_240802_1_G COMPLEJIDAD Y COMPUTABILIDAD' };
  const settings = MAK.withDefaults({ nicknames: { S: 'CyC' }, shortNames: false });
  assert.equal(MAK.siteName(site, settings), 'CyC', 'the user sees the name from the user');
  assert.equal(MAK.publicSiteName(site), 'Complejidad y Computabilidad', 'the recipients see the full name');
  assert.equal(MAK.publicSiteName({ id: 'X', title: 'Coordinación' }), 'Coordinación');
});

test('the photo of each subject (Vía Láctea): a year gets 1–5 in the first semester and 6–10 in the second; a subject keeps its photo', async () => {
  const s = (code, title, year = 2026) => ({ id: `${year}_0_${code}_1`, title, type: 'course' });
  const autumn = [s('240501', 'Procesadores'), s('240503', 'Seguridad'), s('240505', 'Gestión'), s('240507', 'Análisis'), s('240509', 'Complejidad')];
  const spring = [s('240602', 'Redes'), s('240604', 'Inteligencia'), s('240606', 'Bases'), s('240608', 'Web'), s('240610', 'Trabajo')];
  const year = MAK.assignSitePhotos([...spring, { id: 'comunidad-etsiiit', title: 'Comunidad', type: 'project' }, ...autumn], {});
  const of = (list) => list.map((x) => year[x.id]);
  assert.deepEqual(of(autumn), [3, 4, 2, 0, 1], 'the first semester: 1–5, by name');
  assert.deepEqual(of(spring), [7, 6, 5, 9, 8], 'the second semester: 6–10');
  assert.equal(year['comunidad-etsiiit'], undefined, 'a community: no photo');
  // The first semester ends (its sites go), a subject comes in February: the others keep their photos.
  const later = MAK.assignSitePhotos([...spring, s('240612', 'Álgebra')], year);
  assert.deepEqual(of(spring).concat(of(autumn)), spring.concat(autumn).map((x) => later[x.id]));
  assert.ok(!of(spring).includes(later[s('240612').id]), 'no photo twice in the second semester');
  // The next year: the first semester takes the photos of the second semester of before, not twice in one semester.
  const next = ['240701', '240703', '240705', '240707', '240709', '240711'].map((c, i) => s(c, `Nueva ${i}`, 2027));
  const map = MAK.assignSitePhotos(next, later);
  const got = next.map((x) => map[x.id]);
  assert.equal(new Set(got.slice(0, 6)).size, 6, 'six subjects of one semester: six photos');
  assert.deepEqual(got.slice(0, 4).sort(), [5, 6, 7, 8], 'first the photos that the first semester did not have');
});

test('the photos of the subjects: the background gives them when the sites come, they stay after a logout', async () => {
  const bg = loadBackground({ fetch: fakeFetch(F.routes()) });
  await bg.ext.storage.local.set({ sites: [{ id: '2026_0_240501_1', title: 'A', type: 'course' }, { id: '2026_0_240602_1', title: 'B', type: 'course' }] });
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(bg.ext.storage.local.data.sitePhotos, { '2026_0_240501_1': 0, '2026_0_240602_1': 1 });
  assert.ok(!bg.MAK.DATA_KEYS.includes('sitePhotos') && bg.MAK.USER_KEYS.includes('sitePhotos'), 'a logout keeps them; another user removes them');
});

test('the photos of the subjects: also at an update, when the sites that are kept do not change', async () => {
  const sites = [{ id: '2026_0_240501_1', title: 'A', type: 'course' }, { id: '2026_0_240602_1', title: 'B', type: 'course' }];
  const bg = loadBackground({ fetch: fakeFetch({}), local: { sites, sitePhotos: { '2026_0_240602_1': 7 } } }); // no answer: the sync keeps the sites
  for (const f of bg.ext._listeners.installed) await f({ reason: 'update', previousVersion: '1.6.6' });
  assert.deepEqual(bg.ext.storage.local.data.sitePhotos, { '2026_0_240602_1': 7, '2026_0_240501_1': 0 }, 'a photo for the subject without one; the other keeps its photo');
});
