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
