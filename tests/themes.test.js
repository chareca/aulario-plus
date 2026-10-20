'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadLib, COMMON, ROOT } = require('./helpers');
const MAK = loadLib('core', 'store', 'themes');

const read = (f) => fs.readFileSync(path.join(COMMON, f), 'utf8');

test('each theme: a unique id, a name and a text in Spanish and English, light and dark values, its CSS', () => {
  const ids = MAK.themeIds();
  assert.deepEqual(ids, ['bloques', 'plastilina', 'eterea', 'cromo', 'cuaderno']);
  assert.equal(new Set(ids).size, ids.length);
  for (const th of MAK.THEMES) {
    assert.match(th.id, /^[a-z0-9-]{1,32}$/, th.id);
    for (const lang of ['es', 'en']) {
      assert.ok(th.name[lang] && th.name[lang].trim(), `${th.id}: name ${lang}`);
      assert.ok(th.about[lang] && th.about[lang].trim(), `${th.id}: about ${lang}`);
    }
    assert.equal(typeof th.light, 'object');
    assert.equal(typeof th.dark, 'object');
    assert.equal(typeof th.css, 'string');
  }
  assert.ok(ids.includes(MAK.DEFAULT_THEME));
});

test('a theme sets only the variables of the list (no typo), with a value', () => {
  const known = new Set(MAK.THEME_VARS);
  for (const th of MAK.THEMES) {
    for (const mode of ['light', 'dark']) {
      for (const [k, v] of Object.entries(th[mode])) {
        assert.ok(known.has(k), `${th.id}.${mode}: unknown variable ${k}`);
        assert.ok(typeof v === 'string' && v.trim(), `${th.id}.${mode}.${k}`);
      }
    }
  }
});

test('nothing from other servers: no http address, no @import, no script in the themes', () => {
  for (const th of MAK.THEMES) {
    const all = [th.css, ...Object.values(th.light), ...Object.values(th.dark)].join('\n');
    assert.doesNotMatch(all, /url\(\s*["']?(https?:)?\/\//i, th.id);
    assert.doesNotMatch(all, /@import|javascript:|expression\(/i, th.id);
  }
});

test('the fonts of the themes are files of the extension, with the OFL license', () => {
  const license = read('fonts/OFL.txt');
  assert.match(license, /SIL OPEN FONT LICENSE/);
  for (const th of MAK.THEMES) {
    for (const f of th.fonts) {
      assert.ok(fs.existsSync(path.join(COMMON, 'fonts', f.file)), `${th.id}: fonts/${f.file}`);
      assert.match(f.family, /^AP /, 'a name of our own: no clash with the fonts of MiAulario');
    }
  }
  const css = MAK.fontFaceCss(MAK.THEMES, (f) => `fonts/${f}`);
  assert.match(css, /@font-face \{ font-family: "AP Archivo"; src: url\("fonts\/archivo\.woff2"\) format\("woff2"\); font-weight: 500 900; font-style: normal; font-display: swap; \}/);
  assert.match(css, /font-family: "AP Cormorant"; src: url\("fonts\/cormorant-italic\.woff2"\) format\("woff2"\); font-weight: 400 700; font-style: italic;/);
  for (const name of ['chromium', 'firefox']) {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', `manifest.${name}.json`), 'utf8'));
    const war = manifest.web_accessible_resources;
    assert.deepEqual(war, [{ resources: ['fonts/*.woff2'], matches: ['https://miaulario.unavarra.es/*'] }], name);
    const scripts = manifest.content_scripts[1].js;
    assert.ok(scripts.indexOf('lib/themes.js') < scripts.indexOf('content-theme.js'), name);
    assert.ok(scripts.indexOf('content-theme.js') < scripts.indexOf('content-banner.js'), `${name}: the theme before the parts`);
  }
});

test('the variables of a theme: the values of BASE where the theme has none, the dark ones in the dark mode', () => {
  const light = MAK.themeValues('cromo', false);
  const dark = MAK.themeValues('cromo', true);
  assert.equal(Object.keys(light).length, MAK.THEME_VARS.length);
  assert.equal(light.fg, '#1b2440');
  assert.equal(dark.fg, '#e4ecff');
  assert.equal(dark['count-fg'], '#7fe7ff', 'a light value that the dark mode does not change');
  assert.equal(light['item-gap'], '0px', 'a value of BASE');
  const vars = MAK.themeVars('bloques', false);
  assert.match(vars, /--ap-head-bg: #ffd400;/);
  assert.doesNotMatch(vars, /undefined/);
  assert.equal(MAK.theme('').id, MAK.DEFAULT_THEME);
  assert.equal(MAK.theme('no-such-theme').id, MAK.DEFAULT_THEME);
  assert.equal(MAK.themeName(MAK.theme('cuaderno'), 'en'), 'Notebook');
  assert.equal(MAK.themeName(MAK.theme('cuaderno'), 'fr'), 'Cuaderno');
});

test('the CSS of a page: the fonts, the values of the mode, the CSS of the theme', () => {
  const css = MAK.pageThemeCss('eterea', (f) => `fonts/${f}`, 'system');
  assert.match(css, /^@font-face/);
  assert.match(css, /:root \{ color-scheme: light dark; --ap-font: "AP Manrope"/);
  assert.match(css, /@media \(prefers-color-scheme: dark\) \{ :root \{ [^}]*--ap-fg: #ecebff;/);
  assert.ok(css.includes(MAK.theme('eterea').css));
  const dark = MAK.pageThemeCss('eterea', (f) => `fonts/${f}`, 'dark');
  assert.match(dark, /:root \{ color-scheme: dark; [^}]*--ap-fg: #ecebff;/);
  assert.doesNotMatch(dark, /prefers-color-scheme/, 'a fixed mode: no media query');
  const light = MAK.pageThemeCss('eterea', (f) => `fonts/${f}`, 'light');
  assert.match(light, /:root \{ color-scheme: light; [^}]*--ap-fg: #2a2740;/);
  assert.doesNotMatch(light, /prefers-color-scheme|#ecebff/);
});

test('the mode of the pages of the extension: the setting, else the mode of MiAulario, else the system', () => {
  assert.equal(MAK.pageScheme('dark', 'light'), 'dark');
  assert.equal(MAK.pageScheme('light', 'dark'), 'light');
  assert.equal(MAK.pageScheme('auto', 'dark'), 'dark');
  assert.equal(MAK.pageScheme('auto', 'light'), 'light');
  assert.equal(MAK.pageScheme('auto', 'system'), 'system');
  assert.equal(MAK.pageScheme('auto', undefined), 'system');
  assert.equal(MAK.defaultSettings().colorMode, 'auto');
  assert.equal(MAK.withDefaults({ colorMode: 'dark' }).colorMode, 'dark');
  assert.equal(MAK.withDefaults({ colorMode: 'sepia' }).colorMode, 'auto');
});

test('all the variables in the styles of the extension exist in the themes', () => {
  const known = new Set(MAK.THEME_VARS);
  const files = ['popup.css', ...fs.readdirSync(COMMON).filter((f) => f.endsWith('.js')), ...fs.readdirSync(path.join(COMMON, 'lib')).filter((f) => f.endsWith('.js')).map((f) => `lib/${f}`)];
  const used = new Set();
  for (const f of files) for (const m of read(f).matchAll(/var\(--ap-([a-z0-9-]+)/g)) used.add(`${m[1]}|${f}`);
  for (const u of used) {
    const [name, file] = u.split('|');
    assert.ok(known.has(name), `${file}: --ap-${name} is not a variable of the themes`);
  }
  assert.ok(used.size > 50);
});

test('the setting "theme": an id, else the default theme', () => {
  assert.equal(MAK.defaultSettings().theme, '');
  assert.equal(MAK.withDefaults({}).theme, '');
  assert.equal(MAK.withDefaults({ theme: 'cuaderno' }).theme, 'cuaderno');
  assert.equal(MAK.withDefaults({ theme: 'Bad Theme!' }).theme, '');
  assert.equal(MAK.withDefaults({ theme: 7 }).theme, '');
  assert.equal(MAK.theme(MAK.withDefaults({ theme: 'old-theme' }).theme).id, MAK.DEFAULT_THEME, 'an id that does not exist now: the default');
});

test('the background keeps the mode of MiAulario that a content script tells (for the popup)', async () => {
  const { loadBackground } = require('./helpers');
  const bg = loadBackground({});
  const CONTENT = { id: 'ext-id', tab: { id: 1 }, frameId: 0, url: 'https://miaulario.unavarra.es/portal' };
  assert.deepEqual(await bg.send({ type: 'pageMode', mode: 'dark' }, CONTENT), { ok: true });
  assert.equal((await bg.ext.storage.local.get('sakaiMode')).sakaiMode, 'dark');
  assert.deepEqual(await bg.send({ type: 'pageMode', mode: 'purple' }, CONTENT), { ok: false });
  assert.equal((await bg.ext.storage.local.get('sakaiMode')).sakaiMode, 'dark', 'a bad value does not change it');
  assert.equal(await bg.send({ type: 'pageMode', mode: 'light' }, Object.assign({}, CONTENT, { url: 'https://example.com/' })), null, 'not from another site');
});
