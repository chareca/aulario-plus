// The tests that need whole pages of the extension: the pages of tests/harness/out (node tests/harness/make.js),
// with the mock extension API and the real background script in the same page. Each test opens its own tab. The pages
// need http (site.html changes its address to the one of a site of MiAulario): a small server on this computer only.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, sep } from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };

// In the page: pick(name, text) gives the file to the input of tools.html?import and waits for the answer of the page.
const KIT = `
  const ext = window.chrome;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, what) => {
    for (let i = 0; i < 100; i++) { const v = await fn(); if (v) return v; await sleep(50); }
    throw new Error('the page did not show ' + what);
  };
  const button = (key) => [...document.querySelectorAll('#import button')].find((b) => b.textContent === MAK.t(key));
  const status = () => document.querySelector('#import .status').textContent;
  const texts = () => [...document.querySelectorAll('#import p:not(.status)')].slice(1).map((p) => p.textContent);
  async function pick(name, text) {
    const input = document.querySelector('#import input[type=file]');
    const dt = new DataTransfer();
    dt.items.add(new File([text], name));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
    await until(() => status() || button('config.importYes'), 'an answer');
    return { texts: texts(), status: status() };
  }
  async function importIt() {
    button('config.importYes').click();
    await until(status, 'the end of the import');
    return status();
  }
  // The first sync of the background (the harness has sites) gives each subject a photo: the tests that compare the
  // storage wait for it.
  const synced = () => until(async () => (await ext.storage.local.get('sitePhotos')).sitePhotos, 'the first sync of the background');
  // The keys of an import (the background writes other ones by itself).
  const all = async () => JSON.stringify(await ext.storage.local.get(['settings', 'pageUi', 'sitePhotos', 'pageUiImport']));
`;

export async function runHarness(browser, out) {
  const server = createServer(async (req, res) => {
    const file = join(out, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    try {
      if (!file.startsWith(out + sep)) throw new Error('outside');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await runTests(browser, `http://127.0.0.1:${server.address().port}/`);
  } finally {
    server.close();
  }
}

async function runTests(browser, base) {
  const results = [];
  const url = (page) => base + page;
  async function open(page) {
    const tab = await browser.openTab(url(page));
    if (!(await browser.waitFor(tab, "document.readyState === 'complete' && !!window.MAK && !!window.chrome"))) throw new Error(`${page} did not load`);
    return tab;
  }
  // body: code of this file only; data: the values for it (CDP arguments, not code).
  const run = (tab, body, data = null) => tab.callFunction(`async (data) => { ${KIT} ${body} }`, data);
  async function test(name, fn) {
    const tabs = [];
    try {
      await fn(async (page) => {
        const tab = await open(page);
        tabs.push(tab);
        return tab;
      });
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, error: String(e && e.message ? e.message : e) });
    } finally {
      for (const tab of tabs) await browser.call('Target.closeTarget', { targetId: tab.targetId }).catch(() => {});
    }
  }

  await test('"Importar mi configuración": a renamed file of another version, with strange values, after the question', async (open) => {
    const tab = await open('tools.html?import');
    const got = await run(tab, `
      await ext.storage.local.set({ settings: MAK.withDefaults({ theme: 'catppuccin', nicknames: { a: 'A' } }), pageUi: { 'mak-mysite-wide': '1' }, sitePhotos: { s1: 1 } });
      const file = '\\ufeff  ' + JSON.stringify({ app: ' Aulario Plus ', version: '9.9.9', exported: '2027-01-02T10:00:00Z', settings: {
        theme: ' galaxia\\u200b ', nicknames: { b: ' Mates\\u202e\\u0007 ' }, confetti: 'false', oldSetting: true, lang: 'fr', ['__proto__']: { polluted: 1 }
      }, ui: { 'mak-mysite-closed': '1', evil: '1' }, sitePhotos: { s2: 4, s3: 99 } }) + '\\n';
      const asked = await pick('mi copia (2).txt', file);
      const done = await importIt();
      const d = await ext.storage.local.get(null);
      return { asked, done, settings: d.settings, pageUi: d.pageUi, photos: [d.sitePhotos.s1, d.sitePhotos.s2, 's3' in d.sitePhotos], mark: typeof d.pageUiImport, polluted: ({}).polluted };
    `);
    assert.match(got.asked.texts[0], /versión 9\.9\.9\)\. Cambia 4 ajustes/, 'the theme, the nicknames, a box and a photo');
    assert.equal(got.asked.texts.length, 1, 'no word about the forward address');
    assert.equal(got.done, 'Hecho: tu configuración está importada.');
    assert.deepEqual([got.settings.theme, got.settings.nicknames, got.settings.confetti, got.settings.lang, 'oldSetting' in got.settings], ['galaxia', { b: 'Mates' }, true, 'es', false]);
    assert.deepEqual([got.pageUi, got.photos, got.mark, got.polluted], [{ 'mak-mysite-wide': '1', 'mak-mysite-closed': '1' }, [1, 4, false], 'number', undefined]);
  });

  await test('"Importar mi configuración": a broken, foreign or too big file changes nothing', async (open) => {
    const tab = await open('tools.html?import');
    const got = await run(tab, `
      await synced();
      await ext.storage.local.set({ settings: MAK.withDefaults({ theme: 'cromo' }), pageUi: { 'mak-mysite-closed': '1' } });
      const before = await all();
      const bad = ['{"app":"Aulario Plus","settings":{"theme":"galaxia"', '', '\\u0089PNG\\r\\n\\u001a', '{"app":"Otra","settings":{}}', '{"app":"Aulario Plus","settings":[1]}',
        '{"app":"Aulario Plus"}', 'null', '[]', JSON.stringify({ app: 'Aulario Plus', settings: { theme: 'galaxia' }, pad: 'x'.repeat(1e6) })];
      const answers = [];
      for (const [i, text] of bad.entries()) answers.push((await pick('file' + i + '.json', text)).status);
      const now = await all();
      return { answers, asked: !!button('config.importYes'), same: before === now || [before, now] };
    `);
    assert.deepEqual(new Set(got.answers), new Set(['Este archivo no es una configuración de Aulario Plus.']), got.answers.join(' | '));
    assert.deepEqual([got.asked, got.same], [false, true]);
  });

  await test('"Importar mi configuración": the question names a new forward address; Cancelar changes nothing', async (open) => {
    const tab = await open('tools.html?import');
    const got = await run(tab, `
      await synced();
      await ext.storage.local.set({ settings: MAK.withDefaults({ forwardEmail: 'yo@unavarra.es' }) });
      const before = await all();
      const other = await pick('a.json', JSON.stringify({ app: 'Aulario Plus', settings: { theme: 'galaxia', forwardEmail: 'malo@evil.com' } }));
      button('config.importNo').click();
      const afterNo = { asked: !!button('config.importYes'), same: before === (await all()) };
      const same = await pick('b.json', JSON.stringify({ app: 'Aulario Plus', settings: { theme: 'galaxia', forwardEmail: 'yo@unavarra.es' } }));
      return { other: other.texts, afterNo, same: same.texts };
    `);
    assert.equal(got.other.length, 2);
    assert.match(got.other[1], /reenviar tu correo de MiAulario a malo@evil\.com/);
    assert.deepEqual(got.afterNo, { asked: false, same: true });
    assert.equal(got.same.length, 1, 'the same address: no word about it');
  });

  await test('"Importar mi configuración": a big or very deep file: a small message to the background, nothing breaks', async (open) => {
    const tab = await open('tools.html?import');
    const got = await run(tab, `
      await ext.storage.local.set({ settings: MAK.withDefaults({}) });
      const sizes = [];
      const send = ext.runtime.sendMessage;
      ext.runtime.sendMessage = (m) => { if (m && m.type === 'importSettings') sizes.push(JSON.stringify(m).length); return send(m); };
      await pick('big.json', JSON.stringify({ app: 'Aulario Plus', settings: { confetti: false, junk: 'x'.repeat(9e5), nicknames: { a: 'y'.repeat(2e4) } } }));
      const done = await importIt();
      const deep = await pick('deep.json', '{"app":"Aulario Plus","settings":{"hiddenSites":' + '['.repeat(4e5) + ']'.repeat(4e5) + '}}');
      const s = (await ext.storage.local.get('settings')).settings;
      return { sizes, done, deep: deep.status, confetti: s.confetti, nickname: s.nicknames.a.length };
    `);
    assert.equal(got.sizes.length, 1);
    assert.ok(got.sizes[0] < 21000, `the message has ${got.sizes[0]} characters`);
    assert.deepEqual([got.done, got.confetti, got.nickname], ['Hecho: tu configuración está importada.', false, 40]);
    assert.equal(got.deep, 'Este archivo tiene los mismos ajustes que ya tienes: no hay nada que cambiar.');
  });

  // Mi sitio (site.html). ?seed: the storage of the extension for the page (localStorage "mak-harness-seed"); the
  // other keys of localStorage are the ones of the page (MiAulario).
  const BLOCK = `
    const block = () => document.getElementById('mak-block');
    const closed = () => block().classList.contains('mak-closed');
    const fold = () => block().querySelector('button[aria-controls="mak-block-body"]').click();
    const copy = async () => (await ext.storage.local.get('pageUi')).pageUi || {};
    await until(block, 'the block of Mi sitio');
  `;
  const prepare = (tab, page, seed) => run(tab, `localStorage.clear();
    for (const [k, v] of Object.entries(data.page)) localStorage.setItem(k, v);
    localStorage.setItem('mak-harness-seed', JSON.stringify(data.seed));`, { page, seed });
  async function load(tab) {
    await tab.evaluate('window.__old = true');
    await tab.navigate(url('site.html?mine&seed'));
    if (!(await browser.waitFor(tab, "!window.__old && document.readyState === 'complete' && !!window.MAK && !!window.chrome"))) throw new Error('site.html did not load');
  }

  await test('Mi sitio: the boxes of before go to the copy of the extension (for the file), and a fold changes the copy', async (open) => {
    const tab = await open('tools.html');
    await prepare(tab, { 'mak-mysite-closed': '1' }, {});
    await load(tab);
    const got = await run(tab, `${BLOCK}
      const first = await until(async () => (await copy())['mak-mysite-closed'], 'the copy');
      const wasClosed = closed();
      fold();
      const after = await until(async () => (await copy())['mak-mysite-closed'] === '0' && '0', 'the new copy');
      return { first, wasClosed, after, page: localStorage.getItem('mak-mysite-closed') };
    `);
    assert.deepEqual(got, { first: '1', wasClosed: true, after: '0', page: '0' });
  });

  await test('Mi sitio: after an import, the next page takes the boxes of the file, only once', async (open) => {
    const tab = await open('tools.html');
    const seed = { pageUi: { 'mak-mysite-closed': '1', 'mak-mysite-wide': '0' }, pageUiImport: 123 };
    await prepare(tab, { 'mak-mysite-closed': '0', 'mak-mysite-wide': '1' }, seed);
    await load(tab);
    const first = await run(tab, `${BLOCK}
      const was = closed();
      fold(); // the user opens it again
      return { was, page: [localStorage.getItem('mak-mysite-closed'), localStorage.getItem('mak-mysite-wide'), localStorage.getItem('mak.ui-import')] };
    `);
    assert.deepEqual(first, { was: true, page: ['0', '0', '123'] }, 'the file wins, then the click of the user');
    // The same import (the same seed) on the next page: the choice of the user stays and goes to the copy.
    await load(tab);
    const next = await run(tab, `${BLOCK}
      const kept = await until(async () => (await copy())['mak-mysite-closed'] === '0' && '0', 'the copy of the choice');
      return { closed: closed(), page: localStorage.getItem('mak-mysite-closed'), kept };
    `);
    assert.deepEqual(next, { closed: false, page: '0', kept: '0' });
  });

  await test('Mi sitio: the box of the hours of the library goes after the guides, with the hours of the notice of today', async (open) => {
    const tab = await open('tools.html');
    await prepare(tab, {}, {});
    await load(tab);
    const got = await run(tab, `
      const slot = await until(() => document.getElementById('mak-block-body'), 'the block');
      await until(() => slot.querySelector('#mak-library-host') && slot.querySelector('#mak-guide-host'), 'the boxes');
      const lib = await until(async () => (await ext.storage.local.get('library')).library, 'the hours');
      return { order: [...slot.children].map((c) => c.id), campus: lib.campus, usual: lib.page.lines, notices: lib.notices.map((n) => [n.title, n.cal ? n.cal.months.length : 0]),
        today: MAK.libraryToday(lib) && MAK.libraryToday(lib).notice, open: localStorage.getItem('mak-library-host:open') };
    `);
    assert.deepEqual(got.order.slice(-2), ['mak-guide-host', 'mak-library-host']);
    assert.deepEqual([got.campus, got.usual.length, got.notices, got.today, got.open], ['arrosadia', 2, [['Horario especial de época de exámenes', 2]], 'Horario especial de época de exámenes', null]);
  });

  await test('Mi sitio: the parts in the order and the shape of the settings (also changed in another tab); one below the other with little width', async (open) => {
    const tab = await open('tools.html');
    await prepare(tab, { 'mak-mysite-wide': '1' }, {});
    await load(tab);
    const got = await run(tab, `
      const body = await until(() => document.getElementById('mak-block-body'), 'the block');
      await until(() => ['mak-shortcuts-host', 'mak-guide-host', 'mak-library-host'].every((id) => body.querySelector(':scope > #' + id)), 'the three parts');
      const slots = () => ['mak-shortcuts-host', 'mak-guide-host', 'mak-library-host'].map((id) => document.getElementById(id).dataset.slot).join('');
      const before = [slots(), body.dataset.shape, body.dataset.count];
      const { settings } = await ext.storage.local.get('settings');
      await ext.storage.local.set({ settings: Object.assign({}, settings, { mysiteLayout: { order: ['hours', 'exams', 'guides'], shape: 'left' } }) });
      await until(() => body.dataset.shape === 'left', 'the new shape');
      const box = (id) => document.getElementById(id).getBoundingClientRect();
      const wide = document.getElementById('mak-block').getBoundingClientRect().width >= 1000;
      const columns = box('mak-library-host').left < box('mak-shortcuts-host').left && Math.abs(box('mak-shortcuts-host').left - box('mak-guide-host').left) < 2 && box('mak-shortcuts-host').top < box('mak-guide-host').top;
      const below = box('mak-library-host').top < box('mak-shortcuts-host').top && box('mak-shortcuts-host').top < box('mak-guide-host').top;
      return { before, after: [slots(), body.dataset.count], placed: wide ? columns : below, button: !!document.querySelector('#mak-block .mak-head .mak-organize[aria-controls="mak-layout-host"]') };
    `);
    assert.deepEqual(got, { before: ['123', 'rows', '3'], after: ['231', '3'], placed: true, button: true });
  });

  await test('Mi sitio: a part taken out is not shown, and "Horarios" out reads nothing; back, it reads its hours', async (open) => {
    const tab = await open('tools.html');
    await prepare(tab, {}, {});
    await load(tab);
    await run(tab, `
      const { settings } = await ext.storage.local.get('settings');
      const layout = { order: ['exams', 'guides', 'hours'], shape: 'cols', hidden: ['hours'] };
      localStorage.setItem('mak-harness-seed', JSON.stringify({ settings: Object.assign({}, settings, { mysiteLayout: layout }) }));
    `);
    await load(tab);
    const got = await run(tab, `
      const body = await until(() => document.getElementById('mak-block-body'), 'the block');
      const lib = await until(() => body.querySelector(':scope > #mak-library-host'), 'the box of the hours');
      await until(() => body.querySelector(':scope > #mak-guide-host') && body.dataset.count === '2', 'the other parts');
      await new Promise((r) => setTimeout(r, 600));
      const out = [lib.hasAttribute('data-off'), getComputedStyle(lib).display, !!(await ext.storage.local.get('library')).library, body.dataset.count];
      const { settings } = await ext.storage.local.get('settings');
      await ext.storage.local.set({ settings: Object.assign({}, settings, { mysiteLayout: Object.assign({}, settings.mysiteLayout, { hidden: [] }) }) });
      const read = await until(async () => (await ext.storage.local.get('library')).library, 'the hours read again');
      return { out, back: [lib.hasAttribute('data-off'), lib.dataset.slot, body.dataset.count, read.campus] };
    `);
    assert.deepEqual(got, { out: [true, 'none', false, '2'], back: [false, '3', '3', 'arrosadia'] });
  });

  await test('Mi sitio: folding the block folds the panel of the sections too', async (open) => {
    const tab = await open('tools.html');
    await prepare(tab, {}, {});
    await load(tab);
    const got = await run(tab, `
      await until(() => document.getElementById('mak-block-body') && document.getElementById('mak-block-body').dataset.shape, 'the block');
      const organize = document.querySelector('#mak-block .mak-organize');
      const panel = document.getElementById('mak-layout-host');
      organize.click();
      const opened = [organize.getAttribute('aria-expanded'), panel.hidden];
      document.querySelector('#mak-block .mak-head .mak-fold').click();
      await until(() => panel.hidden && document.getElementById('mak-block-body').hidden, 'the folds');
      return { opened, after: organize.getAttribute('aria-expanded') };
    `);
    assert.deepEqual(got, { opened: ['true', false], after: 'false' });
  });

  await test('the popup: the tab of before when it opens again within a minute after it closed, else Inicio', async (open) => {
    const tab = await open('popup.html');
    const selected = () => run(tab, `
      await until(() => document.querySelector('nav.tabs [aria-selected="true"]'), 'the tabs');
      return document.querySelector('nav.tabs [aria-selected="true"]').dataset.tab;
    `);
    const go = async (page) => {
      await tab.evaluate('window.__old = true');
      await tab.navigate(url(page));
      if (!(await browser.waitFor(tab, "!window.__old && document.readyState === 'complete'"))) throw new Error(`${page} did not load`);
    };
    // The time of the last tab: a minute ago and more (as if it was so long ago).
    const old = (tab2) => `localStorage.setItem('mak-popup-tab', JSON.stringify({ tab: ${JSON.stringify(tab2)}, at: Date.now() - 61000 }))`;
    await tab.evaluate("localStorage.removeItem('mak-popup-tab')");
    await go('popup.html');
    const first = await selected();
    await run(tab, `document.getElementById('tabbtn-grades').click();`);
    await tab.evaluate(old('grades')); // open on "Notas" for more than a minute: the minute starts when it closes
    await go('popup.html');
    const back = await selected();
    await go('_locales/es/messages.json'); // closed
    await tab.evaluate(old('grades')); // more than a minute ago
    await go('popup.html');
    const late = await selected();
    await tab.evaluate(`localStorage.setItem('mak-popup-tab', JSON.stringify({ tab: '__proto__', at: Date.now() }))`);
    await go('popup.html');
    assert.deepEqual([first, back, late, await selected()], ['home', 'grades', 'home', 'home']);
  });

  await test('the popup: a window acts once, also with a second click while it shrinks', async (open) => {
    const tab = await open('popup.html');
    const got = await run(tab, `
      await until(() => typeof dialog === 'function' && document.body, 'the popup');
      let count = 0;
      dialog('Prueba', document.createElement('p'), [{ text: 'No' }, { text: 'Sí', primary: true, click: () => count++ }]);
      const yes = [...document.querySelectorAll('.dialog button')].find((b) => b.textContent === 'Sí');
      yes.click();
      yes.click();
      await until(() => !document.querySelector('.dialog-backdrop'), 'the window gone');
      return count;
    `);
    assert.equal(got, 1);
  });

  return results;
}
