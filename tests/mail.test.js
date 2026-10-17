'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, loadBackground, fakeFetch } = require('./helpers');
const F = require('./fixtures/miaulario');
const MAK = loadLib('core', 'i18n', 'pm', 'mail-ui');

const files = [{ itemId: '/group/S/Tema 1.pdf', title: 'Tema 1.pdf' }, { itemId: '/group/S/b.zip', title: 'b.zip' }];

test('mailDefaults: the mark [Aulario Plus] only in the messages to me; the list of files in the body', () => {
  MAK.setLang('es');
  assert.equal(MAK.mailDefaults({ files: files.slice(0, 1), site: 'AAE', toMe: true }).subject, '[Aulario Plus] Tema 1.pdf');
  assert.equal(MAK.mailDefaults({ files, site: 'AAE', toMe: true }).subject, '[Aulario Plus] 2 archivos de AAE');
  assert.equal(MAK.mailDefaults({ files, site: 'AAE', toMe: false }).subject, '2 archivos de AAE');
  assert.equal(MAK.mailDefaults({ files: [], site: 'AAE', toMe: true }).subject, '[Aulario Plus] AAE');
  assert.equal(MAK.mailDefaults({ files: [], site: 'AAE', toMe: false }).subject, '');
  assert.equal(MAK.mailDefaults({ files, site: 'AAE' }).body, 'Archivos de AAE:\n- Tema 1.pdf\n- b.zip\n\nEnviado con Aulario Plus.');
  MAK.setLang('en');
  assert.equal(MAK.mailDefaults({ files, site: 'AAE', toMe: true }).subject, '[Aulario Plus] 2 files of AAE');
  MAK.setLang('es');
});

test('mailError: a known code has its own text; an unknown code says "Open the mail"', () => {
  MAK.setLang('es');
  assert.equal(MAK.mailError(new MAK.PmError('pm.noSubject')), 'Escribe un asunto.');
  assert.equal(MAK.mailError(new MAK.PmError('pm.notSent', 'Falta el asunto')), 'MiAulario no envió el mensaje: Falta el asunto');
  assert.match(MAK.mailError(new MAK.PmError('pm.noPicker', 'other')), /\(pm\.noPicker\).*Abrir correo/);
  assert.match(MAK.mailError(new Error('x')), /\(error\)/);
});

test('background: openMailTool opens the internal mail of a known site in a new tab', async () => {
  const bg = loadBackground({ fetch: fakeFetch(F.routes()) });
  await bg.send({ type: 'syncNow' });
  const CONTENT = { id: 'ext-id', tab: { id: 1 }, frameId: 0, url: `https://miaulario.unavarra.es/portal/site/${F.CS}` };
  assert.deepEqual(await bg.send({ type: 'openMailTool', siteId: F.CS }, CONTENT), { ok: true });
  assert.equal(bg.ext._tabs.at(-1).url, `https://miaulario.unavarra.es/portal/site/${F.CS}/page/${F.CS}-page-5`);
  assert.deepEqual(await bg.send({ type: 'openMailTool', siteId: 'unknown' }, CONTENT), { ok: false });
  assert.equal(await bg.send({ type: 'openMailTool', siteId: F.CS }, Object.assign({}, CONTENT, { url: 'https://evil.example/' })), null);
});
