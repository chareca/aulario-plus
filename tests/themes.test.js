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
  assert.deepEqual(ids, ['miaulario', 'bloques', 'plastilina', 'eterea', 'cromo', 'cuaderno', 'galaxia', 'catppuccin']);
  assert.equal(MAK.DEFAULT_THEME, 'miaulario', 'the default: the look of MiAulario');
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
    const all = [th.css, th.blockCss || '', th.cardCss || '', ...Object.values(th.light), ...Object.values(th.dark)].join('\n');
    assert.doesNotMatch(all, /url\(\s*["']?(https?:)?\/\//i, th.id);
    assert.doesNotMatch(all, /@import|javascript:|expression\(/i, th.id);
  }
});

test('the CSS of a theme for the block of "Mi sitio" (in the page): only rules of the block', () => {
  for (const th of MAK.THEMES) {
    // The selectors: the text before each "{" that is not in a value (the values have no "{").
    for (const rule of (th.blockCss || '').split('}').map((r) => r.trim()).filter(Boolean)) {
      for (const sel of rule.slice(0, rule.indexOf('{')).split(',')) assert.match(sel.trim(), /^#mak-block\b/, `${th.id}: ${sel.trim()}`);
    }
  }
  assert.ok(MAK.theme('cuaderno').blockCss.includes('#mak-block::before'), 'the spiral of Cuaderno');
});

test('the CSS of a theme for its card in the settings: only rules of its card, in the CSS of every page', () => {
  for (const th of MAK.THEMES) {
    for (const rule of (th.cardCss || '').split('}').map((r) => r.trim()).filter(Boolean)) {
      for (const sel of rule.slice(0, rule.indexOf('{')).split(',')) assert.ok(sel.trim().startsWith(`.theme-card[data-theme="${th.id}"]`), `${th.id}: ${sel.trim()}`);
    }
  }
  const xp = MAK.theme('cromo').cardCss;
  assert.ok(xp, 'the card of AulaXP: a window');
  for (const id of MAK.themeIds()) assert.ok(MAK.pageThemeCss(id, (f) => `fonts/${f}`, 'light').includes(xp), `with the theme ${id}`);
});

test('the name in the titles: "AulaXP" with AulaXP, "Vía Aulactea" with Vía Láctea, else "Aulario Plus"', () => {
  assert.equal(MAK.themeName(MAK.theme('cromo'), 'es'), 'AulaXP');
  assert.equal(MAK.brandName(MAK.theme('cromo')), 'AulaXP');
  assert.equal(MAK.brandName(MAK.theme('galaxia')), 'Vía Aulactea');
  assert.equal(MAK.brandName(MAK.theme('catppuccin')), 'Aulappuccin');
  for (const id of ['miaulario', 'bloques', 'plastilina', 'eterea', 'cuaderno']) assert.equal(MAK.brandName(MAK.theme(id)), 'Aulario Plus', id);
  const popup = read('popup.html');
  assert.match(popup, /<title data-brand>Aulario Plus<\/title>/, 'the title of the tab');
  assert.match(popup, /<h1 data-brand>Aulario Plus<\/h1>/);
  assert.match(popup, /<button id="close" class="icon-btn close" data-i18n-title="header\.close"/, 'the X that closes the popup');
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
  assert.match(css, /@font-face \{ font-family: "AP Bangers"; src: url\("fonts\/bangers\.woff2"\) format\("woff2"\); font-weight: 400; font-style: normal; font-display: swap; \}/);
  assert.match(css, /font-family: "AP Comic Neue"; src: url\("fonts\/comic-neue-bold\.woff2"\) format\("woff2"\); font-weight: 700;/, 'one family, a file for each weight');
  assert.match(css, /font-family: "AP Cormorant"; src: url\("fonts\/cormorant-italic\.woff2"\) format\("woff2"\); font-weight: 400 700; font-style: italic;/);
  for (const name of ['chromium', 'firefox']) {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', `manifest.${name}.json`), 'utf8'));
    const war = manifest.web_accessible_resources;
    assert.deepEqual(war, [{ resources: ['fonts/*.woff2', 'img/*.webp'], matches: ['https://miaulario.unavarra.es/*'] }], name);
    const scripts = manifest.content_scripts[1].js;
    assert.ok(scripts.indexOf('lib/themes.js') < scripts.indexOf('content-theme.js'), name);
    assert.ok(scripts.indexOf('content-theme.js') < scripts.indexOf('content-banner.js'), `${name}: the theme before the parts`);
    // Chrome can run this group without the first one (document_start): it has every lib of the first one, before the parts.
    for (const lib of manifest.content_scripts[0].js.filter((f) => f.startsWith('lib/'))) {
      assert.ok(scripts.includes(lib) && scripts.indexOf(lib) < scripts.indexOf('content-theme.js'), `${name}: ${lib} in the group of the parts`);
    }
  }
});

test('the images of a theme: files of the extension (img/), a relative address in its pages, the full one in MiAulario', () => {
  for (const th of MAK.THEMES) {
    for (const v of [...Object.values(th.light), ...Object.values(th.dark)]) {
      for (const [, file] of v.matchAll(/ap-asset:([\w./-]+)/g)) assert.ok(fs.existsSync(path.join(COMMON, file)) && /^img\/[\w.-]+\.webp$/.test(file), `${th.id}: ${file}`);
    }
  }
  assert.match(MAK.themeValues('galaxia', true).page, /url\("img\/galaxia-dark\.webp"\)/);
  // The photos of the subjects and of the novelties (dark and light), and the Earth of the next exam.
  const th = MAK.theme('galaxia');
  assert.equal(th.photos.sites.length, 10, 'MAK.SITE_PHOTOS');
  for (const name of [...th.photos.sites, th.photos.news]) {
    for (const file of [`img/${name}.webp`, `img/${name}-light.webp`]) assert.ok(fs.existsSync(path.join(COMMON, file)), file);
  }
  for (const mode of ['light', 'dark']) assert.match(th.photoBg[mode], /url\("ap-asset:img\/\{photo\}(-light)?\.webp"\)/);
  assert.ok(fs.existsSync(path.join(COMMON, 'img/galaxia-earth.webp')) && th.css.includes('ap-asset:img/galaxia-earth.webp'));
  assert.match(MAK.pageThemeCss('galaxia', (f) => `fonts/${f}`, 'dark'), /url\("img\/galaxia-earth\.webp"\)/, 'the address in a page of the extension');
  // The planets of the cards of the exams: one for each photo number, drawn (data: SVG), nothing from other servers.
  for (let i = 0; i < 10; i++) assert.match(th.css, new RegExp(`\\.exams li\\[data-photo="${i}"\\]::before \\{ background-image: url\\("data:image/svg\\+xml,`), `planet ${i}`);
  assert.match(MAK.themeValues('galaxia', false).page, /url\("img\/galaxia-light\.webp"\)/);
  const before = MAK.assetUrl;
  MAK.assetUrl = (file) => `chrome-extension://ext-id/${file}`; // content-theme.js
  try {
    assert.match(MAK.themeVars('galaxia', true), /--ap-win-bg: [^;]*url\("chrome-extension:\/\/ext-id\/img\/galaxia-dark\.webp"\)/);
  } finally {
    MAK.assetUrl = before;
  }
});

test('the hover of all the buttons: the colors change places, slowly, with one solid color for the text and a good contrast; a theme can keep its own hover', () => {
  const lum = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  for (const th of MAK.THEMES) {
    for (const dark of [false, true]) {
      const v = MAK.themeValues(th.id, dark);
      const color = (k) => {
        let x = v[k];
        for (let i = 0; i < 6; i++) x = x.replace(/var\(--ap-([\w-]+)\)/g, (_, n) => v[n]);
        return x;
      };
      for (const kind of ['btn', 'head-btn', 'primary']) {
        const [fill, text] = [color(`${kind}-fg`), color(`${kind}-solid`)];
        const name = `${th.id} ${dark ? 'dark' : 'light'} ${kind}`;
        assert.match(text, /^#[0-9a-f]{6}$/i, `${name}: one color, without a gradient, an image or transparency`);
        const [a, b] = [lum(fill), lum(text)].sort((x, y) => y - x);
        assert.ok((a + 0.05) / (b + 0.05) >= 4.5, `${name}: ${fill} / ${text}`);
      }
      const css = MAK.hoverCss(th, dark);
      assert.match(css, /transition-duration: 0\.3s/, th.id);
      for (const sel of ['.btn:hover', 'button.x:hover', '.win button.plain:hover', '.icon-btn:hover', '.mak-icon:hover', '.chips button:hover']) assert.ok(css.includes(sel), `${th.id}: ${sel}`);
      assert.doesNotMatch(css, /box-shadow: none, /, 'no "none" in a list of shadows');
      assert.match(css, /button\.x \{ border-radius: var\(--ap-radius-sm\); \}/, 'the ✕ fills with the shape of the buttons, not a square');
    }
  }
  assert.ok(!MAK.hoverCss(MAK.theme('bloques'), false).includes('.actions .action:hover'), 'the bursts of Cómic: their own hover');
  assert.ok(MAK.hoverCss(MAK.theme('miaulario'), false).includes('.actions .action:hover'));
  const page = MAK.pageThemeCss('miaulario', (f) => `fonts/${f}`, 'light');
  assert.match(page, /\.btn\.primary:hover, \.btn\.primary:focus-visible[^{]*\{\s*color: var\(--ap-primary-solid\) !important/, 'over the hover rules of the theme: they do not hide the text');
});

test('the icons of a theme: known names, a drawing of its own, nothing from other servers', () => {
  for (const th of MAK.THEMES) {
    for (const [name, svg] of Object.entries(th.icons || {})) {
      assert.ok(MAK.ICON_NAMES.includes(name), `${th.id}: icon ${name}`);
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24">[\s\S]*<\/svg>$/, `${th.id}: ${name}`);
      assert.doesNotMatch(svg.replace('http://www.w3.org/2000/svg', ''), /https?:|href|<script|on\w+=/i, `${th.id}: ${name}`);
    }
  }
  const css = MAK.themeIconCss(MAK.theme('cuaderno'));
  assert.match(css, /svg\.ap-icon-mail \{ background: url\("data:image\/svg\+xml,%3Csvg/);
  assert.match(css, /svg\.ap-icon-mail > \* \{ display: none; \}/);
  assert.equal(MAK.themeIconCss(MAK.theme('bloques')), '', 'no icons: the lines of MAK.icon');
});

test('the variables of a theme: the values of BASE where the theme has none, the dark ones in the dark mode', () => {
  const light = MAK.themeValues('cromo', false);
  const dark = MAK.themeValues('cromo', true);
  assert.equal(Object.keys(light).length, MAK.THEME_VARS.length);
  assert.equal(light.fg, '#000000');
  assert.equal(dark.fg, '#eef2f8');
  assert.equal(dark['head-bg'], light['head-bg'], 'a light value that the dark mode does not change (the title bar)');
  assert.equal(light['item-gap'], '0px', 'a value of BASE');
  const vars = MAK.themeVars('bloques', false);
  assert.match(vars, /--ap-font-head: "AP Bangers"/);
  assert.match(vars, /--ap-page: url\("data:image\/svg\+xml,[^;]*radial-gradient\(circle, rgba\(205, 150, 60, 0\.12\) 30%, transparent 34%\) 0 0 \/ 7px 7px/, 'the newsprint: its grain and its dots');
  assert.doesNotMatch(vars, /undefined/);
  assert.equal(MAK.theme('').id, MAK.DEFAULT_THEME);
  assert.equal(MAK.theme('no-such-theme').id, MAK.DEFAULT_THEME);
  assert.equal(MAK.themeName(MAK.theme('plastilina'), 'en'), 'Marshmallow');
  assert.equal(MAK.themeName(MAK.theme('plastilina'), 'fr'), 'Malvavisco', 'another language: Spanish');
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

test('the motion: every change on hover or focus takes 0.18 s, none with reduced motion', () => {
  const css = MAK.pageThemeCss('bloques', (f) => `fonts/${f}`, 'light');
  assert.match(css, /\*, \*::before, \*::after \{ transition: color 0\.18s ease, background-color 0\.18s ease/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \*, \*::before, \*::after \{ transition: none !important; \} \}/);
  assert.match(MAK.motionCss('#mak-block'), /^#mak-block \{ transition: /, 'the block in the page: only its elements');
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
