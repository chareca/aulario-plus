'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadLib, COMMON, ROOT } = require('./helpers');
const MAK = loadLib('core', 'store', 'i18n');

test('Spanish and English have the same keys and no empty texts', () => {
  const es = Object.keys(MAK.STRINGS.es).sort();
  const en = Object.keys(MAK.STRINGS.en).sort();
  assert.deepEqual(es, en);
  for (const lang of ['es', 'en']) {
    for (const [k, v] of Object.entries(MAK.STRINGS[lang])) assert.ok(typeof v === 'string' && v.trim(), `${lang}.${k} is empty`);
  }
});

test('the placeholders are the same in both languages', () => {
  const names = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const k of Object.keys(MAK.STRINGS.es)) assert.equal(names(MAK.STRINGS.es[k]), names(MAK.STRINGS.en[k]), k);
});

test('Spanish is the default language; English is an option', () => {
  assert.equal(MAK.defaultSettings().lang, 'es');
  assert.equal(MAK.withDefaults({ lang: 'fr' }).lang, 'es');
  assert.equal(MAK.withDefaults({ lang: 'en' }).lang, 'en');
  assert.equal(MAK.setLang('xx'), 'es');
  assert.equal(MAK.t('tab.due'), 'Entregas');
  MAK.setLang('en');
  assert.equal(MAK.t('tab.due'), 'Due');
  assert.equal(MAK.locale(), 'en-GB');
  MAK.setLang('es');
  assert.equal(MAK.locale(), 'es-ES');
});

test('t() puts the values in the text and uses the key if the text is missing', () => {
  MAK.setLang('es');
  assert.equal(MAK.t('due.in', { d: '2d 04h 00m' }), 'quedan 2d 04h 00m');
  assert.equal(MAK.t('ago.min', { n: 3 }), 'hace 3 min');
  assert.equal(MAK.t('due.in'), 'quedan {d}');
  assert.equal(MAK.t('no.such.key'), 'no.such.key');
});

test('each __MSG_name__ of the manifests exists in all the _locales', () => {
  for (const name of ['chromium', 'firefox']) {
    const raw = fs.readFileSync(path.join(ROOT, 'extension', `manifest.${name}.json`), 'utf8');
    const manifest = JSON.parse(raw);
    assert.equal(manifest.default_locale, 'es');
    const keys = [...raw.matchAll(/__MSG_(\w+)__/g)].map((m) => m[1]);
    assert.ok(keys.length >= 2);
    for (const locale of fs.readdirSync(path.join(COMMON, '_locales'))) {
      const messages = JSON.parse(fs.readFileSync(path.join(COMMON, '_locales', locale, 'messages.json'), 'utf8'));
      for (const k of keys) assert.ok(messages[k] && messages[k].message, `${locale}: ${k}`);
      assert.ok(messages.extDescription.message.length <= 132, `${locale}: the description is too long`);
    }
  }
});
