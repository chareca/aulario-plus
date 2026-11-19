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

  await test('a subject: a calendar of two months stays in its box at every width; side by side when both fit (the table gives up its room)', async (open) => {
    const tab = await open('tools.html');
    await prepare(tab, {}, {});
    await tab.evaluate('window.__old = true');
    await tab.navigate(url('site.html?open'));
    if (!(await browser.waitFor(tab, "!window.__old && document.readyState === 'complete' && !!window.MAK"))) throw new Error('site.html did not load');
    const got = await run(tab, `
      const host = await until(() => { const e = document.getElementById('mak-guide-host'); return e && e.shadowRoot && e.shadowRoot.querySelector('.guide-flow > .cal-wrap') && e; }, 'the guide');
      const s = host.shadowRoot;
      const at = (y, m, d, hh) => new Date(y, m, d, hh).getTime();
      const days = MAK.examDays([{ siteId: 'gp', name: 'GP', final: at(2026, 11, 22, 12), recovery: at(2027, 0, 21, 8), finalRoom: '', recoveryRoom: '' }], (r) => r.name);
      const place = s.querySelector('.guide-flow > .cal-wrap');
      place.hidden = false;
      MAK.fill(place, MAK.examCalendar(days, { focus: 'gp' }));
      const out = [];
      const sides = [];
      for (let w = 900; w <= 1700; w += 20) {
        host.style.width = w + 'px';
        const box = s.querySelector('.box');
        const cs = getComputedStyle(box);
        const inner = box.getBoundingClientRect().right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
        if (Math.max(...[...s.querySelectorAll('.cal-day')].map((d) => d.getBoundingClientRect().right)) > inner + 0.5) out.push(w);
        const tops = [...s.querySelectorAll('.cal-month')].map((m) => m.getBoundingClientRect().top);
        if (Math.abs(tops[0] - tops[1]) < 2) sides.push(w);
      }
      return { out, sides };
    `);
    assert.deepEqual(got.out, [], 'the widths where a day goes out of the box');
    assert.ok([1200, 1440, 1700].every((w) => got.sides.includes(w)), `side by side next to the guide from 1200 px: ${got.sides}`);
  });

  await test('Mi sitio: a drag in the panel moves the part under the pointer, the others make room before the drop; a drag only out of the parts changes nothing', async (open) => {
    const tab = await open('tools.html');
    await prepare(tab, {}, {});
    await tab.evaluate('window.__old = true');
    await tab.navigate(url('site.html?mine&seed&open'));
    if (!(await browser.waitFor(tab, "!window.__old && document.readyState === 'complete' && !!window.MAK"))) throw new Error('site.html did not load');
    const got = await run(tab, `
      await until(() => { const b = document.getElementById('mak-block-body'); return b && b.dataset.count === '3'; }, 'the three parts');
      document.querySelector('#mak-block .mak-organize').click();
      await new Promise((r) => setTimeout(r, 400));
      const s = document.getElementById('mak-layout-host').shadowRoot;
      const cell = (k) => s.querySelector('.cell[data-part="' + k + '"]');
      const slots = () => ['exams', 'guides', 'hours'].map((k) => cell(k).dataset.slot).join('');
      const at = (k) => { const r = cell(k).getBoundingClientRect(); return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }; };
      const fire = (el, type, p) => el.dispatchEvent(new PointerEvent(type, Object.assign({ bubbles: true, button: 0, pointerId: 7 }, p)));
      const order = async () => String((await chrome.storage.local.get('settings')).settings?.mysiteLayout?.order); // none before the first save
      const first = slots();
      let b = cell('exams').querySelector('.slot');
      const [from, to] = [at('exams'), at('hours')];
      fire(b, 'pointerdown', from);
      fire(b, 'pointermove', { clientX: from.clientX + 20, clientY: from.clientY + 20 });
      fire(b, 'pointermove', to);
      // At once under the pointer: no transition (the one of the themes for a transform made it trail behind the mouse).
      const still = getComputedStyle(cell('exams')).transitionDuration.split(',').every((d) => parseFloat(d) === 0);
      const during = [slots(), cell('exams').classList.contains('drag'), still];
      fire(b, 'pointerup', to);
      const saved = await until(async () => (await order()) === 'guides,hours,exams' && 'guides,hours,exams', 'the new order saved');
      // The first click after a drop picks a part (before: a flag of the drag ate it).
      cell('guides').querySelector('.slot').click();
      const picked = cell('guides').querySelector('.slot').getAttribute('aria-pressed');
      cell('guides').querySelector('.slot').click(); // and again: not picked
      b = cell('guides').querySelector('.slot');
      const g = at('guides');
      fire(b, 'pointerdown', g);
      fire(b, 'pointermove', { clientX: g.clientX + 900, clientY: g.clientY + 900 });
      fire(b, 'pointerup', { clientX: g.clientX + 900, clientY: g.clientY + 900 });
      await new Promise((r) => setTimeout(r, 300));
      return { first, during, saved, picked, out: [await order(), slots()] };
    `);
    assert.deepEqual(got, { first: '123', during: ['312', true, true], saved: 'guides,hours,exams', picked: 'true', out: ['guides,hours,exams', '312'] });
  });

  await test('Mi sitio: the button "Recursos" opens the files of the user in this tab, first in its row', async (open) => {
    const tab = await open('tools.html');
    await prepare(tab, {}, {});
    await tab.evaluate('window.__old = true');
    await tab.navigate(url('site.html?mine&seed&open'));
    if (!(await browser.waitFor(tab, "!window.__old && document.readyState === 'complete' && !!window.MAK && !!window.chrome"))) throw new Error('site.html did not load');
    const got = await run(tab, `
      const row = () => document.getElementById('mak-shortcuts-host') && document.getElementById('mak-shortcuts-host').shadowRoot.querySelector('.actions');
      await until(() => row() && row().querySelector('a[href*="~user-1"]'), 'the button');
      const a = row().querySelector('.action');
      return [a.textContent, a.getAttribute('href'), a.getAttribute('target'), row().querySelectorAll('a[href*="~user-1"]').length];
    `);
    assert.deepEqual(got, ['Recursos', 'https://miaulario.unavarra.es/portal/site/~user-1/page/p1', null, 1]);
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

  await test('the selector of sections: a click removes a block of MiAulario or a box of Aulario Plus after the question, the page does not get the click, and it stays removed', async (open) => {
    const tab = await open('tools.html');
    const page = async () => {
      await tab.evaluate('window.__old = true');
      await tab.navigate(url('site.html?mine&seed&open'));
      if (!(await browser.waitFor(tab, "!window.__old && document.readyState === 'complete' && !!window.MAK && !!window.chrome"))) throw new Error('site.html did not load');
    };
    await prepare(tab, {}, {});
    await page();
    // The helpers of the page stay in window.__p between the steps; a click of the user goes through the browser.
    const HELP = `
      const bar = () => document.getElementById('mak-picker-host') && document.getElementById('mak-picker-host').shadowRoot;
      const titles = () => [...bar().querySelectorAll('select option')].map((o) => o.textContent);
      const gone = (el) => getComputedStyle(el).display === 'none';
      const question = () => [...document.documentElement.children].map((x) => x.shadowRoot && x.shadowRoot.querySelector('[role=alertdialog]')).find(Boolean);
      const answer = async (yes) => {
        const win = await until(question, 'the question');
        const asked = win.getAttribute('aria-label');
        win.querySelector(yes ? '.btn.primary' : '.btn:not(.primary)').click();
        await until(() => !document.documentElement.contains(win.getRootNode().host), 'the question gone');
        return asked;
      };
      const center = (el) => { el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + Math.min(r.height / 2, 40))]; };
    `;
    const clickAt = async (expr) => { const [x, y] = await run(tab, `${HELP} return center(${expr});`); await tab.mouseClick(x, y); };
    const start = await run(tab, `${HELP}
      await until(() => { const b = document.getElementById('mak-block-body'); return b && b.dataset.count === '3'; }, 'the three parts');
      // The window of the new hours of the library (the notice of today) opens first: closed, the questions can open.
      for (let i = 0; i < 40 && !question(); i++) await sleep(50);
      while (question()) { question().querySelector('.btn.primary').click(); await sleep(400); }
      const calendar = document.querySelector('.Mrphs-sakai-summary-calendar');
      window.__p = { clicks: 0 };
      calendar.addEventListener('click', () => window.__p.clicks++);
      await ext.runtime.sendMessage({ type: 'pickSections' });
      await until(() => bar() && titles().length, 'the selector');
      // A click of a script of the page chooses nothing.
      calendar.querySelector('.Mrphs-toolBody').click();
      await sleep(300);
      window.__p.clicks = 0; // that click reaches the page, as a script of the page can do: only the clicks of the user count
      return { first: titles(), scripted: !!question() };
    `);
    // "Cancelar" keeps it; then "Eliminar". The page gets none of these clicks.
    await clickAt("document.querySelector('.Mrphs-sakai-summary-calendar .Mrphs-toolBody')");
    const asked = await run(tab, `${HELP} const asked = await answer(false); window.__p.kept = !gone(document.querySelector('.Mrphs-sakai-summary-calendar')); return asked;`);
    await clickAt("document.querySelector('.Mrphs-sakai-summary-calendar .Mrphs-toolBody')");
    const left = await run(tab, `${HELP}
      await answer(true);
      await until(() => gone(document.querySelector('.Mrphs-sakai-summary-calendar')) && !titles().includes('Calendario'), 'the calendar gone');
      // The list of the bar, for the keyboard: a part of the block of Mi sitio.
      const list = bar().querySelector('select');
      list.selectedIndex = titles().indexOf('Horarios');
      list.dispatchEvent(new Event('change'));
      [...bar().querySelectorAll('button')].find((b) => b.textContent === 'Eliminar').click();
      await answer(true);
      await until(() => gone(document.getElementById('mak-library-host')) && !titles().includes('Horarios'), 'the hours gone');
      // The only block of MiAulario left on the screen: not in the list (it is the page). Then the whole block of Aulario Plus.
      return titles();
    `);
    await clickAt("document.getElementById('mak-block').querySelector('.mak-head')");
    const got = await run(tab, `${HELP}
      await answer(true);
      await until(() => gone(document.getElementById('mak-block')), 'the block gone');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const s = (await ext.storage.local.get('settings')).settings;
      return { clicks: window.__p.clicks, kept: window.__p.kept, off: !document.getElementById('mak-picker-host'), keys: s.hiddenSections.map((x) => x.key), hidden: s.mysiteLayout.hidden, copy: localStorage.getItem('mak.sections') };
    `);
    Object.assign(got, { first: start.first, asked, left });
    assert.equal(start.scripted, false, 'a click of a script of the page opens no question');
    assert.deepEqual(got.first, ['Mostrar información de Mi Sitio', 'Calendario', 'Exámenes finales', 'Guías docentes', 'Horarios', 'Bloque de Aulario Plus']);
    assert.deepEqual([got.asked, got.kept, got.clicks, got.off], ['¿Eliminar «Calendario»?', true, 0, true]);
    assert.deepEqual(got.left, ['Exámenes finales', 'Guías docentes', 'Bloque de Aulario Plus']);
    assert.deepEqual([got.keys, got.hidden], [['tool:Mrphs-sakai-summary-calendar|calendario', 'mak:block'], ['hours']]);
    assert.ok(got.copy.includes('summary-calendar'), 'the copy of the list in the page');
    // The next page: removed from its first moment (the copy of the page), and the settings keep it.
    await tab.evaluate(`localStorage.setItem('mak-harness-seed', JSON.stringify({ settings: ${JSON.stringify({ hiddenSections: [{ key: 'tool:Mrphs-sakai-summary-calendar|calendario', title: 'Calendario' }] })} }))`);
    await page();
    const again = await run(tab, `
      await until(() => document.getElementById('mak-block'), 'the block');
      const gone = (el) => getComputedStyle(el).display === 'none';
      return [gone(document.querySelector('.Mrphs-sakai-summary-calendar')), gone(document.querySelector('.Mrphs-sakai-iframe-myworkspace')), gone(document.getElementById('mak-block'))];
    `);
    assert.deepEqual(again, [true, false, false]);
    // Its two blocks removed (each one in another page): the page never goes empty, both stay.
    await tab.evaluate(`localStorage.setItem('mak-harness-seed', JSON.stringify({ settings: ${JSON.stringify({ hiddenSections: [{ key: 'tool:Mrphs-sakai-summary-calendar|calendario', title: 'Calendario' }, { key: 'tool:Mrphs-sakai-iframe-myworkspace|mostrar información de mi sitio', title: 'Mostrar información de Mi Sitio' }] })} }))`);
    await page();
    const both = await run(tab, `
      await until(() => document.getElementById('mak-block'), 'the block');
      await new Promise((r) => setTimeout(r, 200));
      const gone = (el) => getComputedStyle(el).display === 'none';
      return [gone(document.querySelector('.Mrphs-sakai-summary-calendar')), gone(document.querySelector('.Mrphs-sakai-iframe-myworkspace'))];
    `);
    assert.deepEqual(both, [false, false]);
  });

  await test('the popup: "Recuperar secciones eliminadas" lists them; ✕ brings one back, "Restaurar original" all of them', async (open) => {
    const tab = await open('popup.html');
    const seed = { settings: { hiddenSections: [{ key: 'tool:Mrphs-sakai-summary-calendar|calendario', title: 'Calendario' }, { key: 'mak:guide', title: 'Evaluación' }], mysiteLayout: { order: ['exams', 'guides', 'hours'], shape: 'rows', hidden: ['hours'] } } };
    await tab.evaluate(`localStorage.setItem('mak-harness-seed', JSON.stringify(${JSON.stringify(seed)}))`);
    await tab.evaluate('window.__old = true');
    await tab.navigate(url('popup.html?seed&tab=settings'));
    if (!(await browser.waitFor(tab, "!window.__old && document.readyState === 'complete'"))) throw new Error('popup.html did not load');
    const got = await run(tab, `
      const saved = async () => { const s = (await ext.storage.local.get('settings')).settings; return [s.hiddenSections.map((x) => x.title), s.mysiteLayout.hidden]; };
      (await until(() => document.getElementById('cat-mysite'), 'the categories')).click();
      const restore = await until(() => document.getElementById('sections-restore'), 'the settings');
      const label = restore.textContent;
      restore.click();
      const rows = () => [...document.querySelectorAll('.dialog .removed li')].map((li) => li.querySelector('span').textContent);
      await until(() => rows().length === 3, 'the list');
      const first = rows();
      const x = document.querySelector('.dialog .removed button');
      const name = x.getAttribute('aria-label');
      x.click();
      await until(async () => (await saved())[1].length === 0, 'the hours back');
      const one = [rows(), await saved(), document.activeElement.getAttribute('aria-label')];
      [...document.querySelectorAll('.dialog .row button')].find((b) => b.textContent === 'Restaurar original').click();
      await until(async () => (await saved())[0].length === 0, 'all back');
      await until(() => !document.querySelector('.dialog') && document.getElementById('sections-restore').textContent.includes('(0)'), 'the window gone');
      return { label, first, name, one };
    `);
    assert.equal(got.label, 'Recuperar secciones eliminadas (3)');
    assert.deepEqual(got.first, ['Horarios · Aulario Plus', 'Calendario · MiAulario', 'Evaluación · Aulario Plus']);
    assert.equal(got.name, 'Recuperar «Horarios»');
    assert.deepEqual(got.one, [['Calendario · MiAulario', 'Evaluación · Aulario Plus'], [['Calendario', 'Evaluación'], []], 'Recuperar «Calendario»']);
  });

  await test('the popup: Ajustes is a grid of categories; a tile opens its settings, and "Ajustes" (the button or the tab) goes back', async (open) => {
    const tab = await open('popup.html');
    const got = await run(tab, `
      await until(() => document.getElementById('tabbtn-settings'), 'the tabs');
      document.getElementById('tabbtn-settings').click();
      const tiles = () => [...document.querySelectorAll('#tab-settings .cat')];
      await until(() => tiles().length, 'the categories');
      const names = tiles().map((b) => b.querySelector('strong').textContent);
      const wide = tiles().filter((b) => getComputedStyle(b).gridColumnStart === '1' && getComputedStyle(b).gridColumnEnd === '-1').map((b) => b.id);
      const columns = getComputedStyle(document.querySelector('.cats')).gridTemplateColumns.split(' ').length;
      const values = tiles().filter((b) => b.querySelector('small')).length;
      const none = document.querySelectorAll('#tab-settings .section').length;
      document.getElementById('cat-lang').click();
      await until(() => document.getElementById('settings-back'), 'the language');
      const inside = [document.querySelectorAll('#tab-settings .section').length, tiles().length, document.querySelector('.cat-head strong').textContent, document.activeElement.id];
      // A change of a setting draws the popup again: the category stays open.
      document.querySelector('#tab-settings select').value = 'en';
      document.querySelector('#tab-settings select').dispatchEvent(new Event('change', { bubbles: true }));
      await until(() => document.querySelector('.cat-head strong') && document.querySelector('.cat-head strong').textContent === 'Language', 'the language in English');
      document.querySelector('#tab-settings select').value = 'es';
      document.querySelector('#tab-settings select').dispatchEvent(new Event('change', { bubbles: true }));
      await until(() => document.querySelector('.cat-head strong') && document.querySelector('.cat-head strong').textContent === 'Idioma', 'Spanish again');
      document.getElementById('settings-back').click();
      await until(() => tiles().length, 'the grid again');
      const back = document.activeElement.id;
      document.getElementById('cat-danger').click();
      await until(() => document.getElementById('settings-back'), 'the danger zone');
      document.getElementById('tabbtn-settings').click();
      await until(() => tiles().length, 'the grid by the tab');
      return { names, wide, columns, values, none, inside, back };
    `);
    assert.deepEqual(got.names, ['Tema', 'Sesión', 'Avisos', 'Datos', 'Ubicación', 'Notas oficiales', 'Buscador', 'Correo', 'Idioma', 'Copia', 'Ayuda', 'Borrar todo']);
    assert.deepEqual([got.wide, got.columns, got.none], [['cat-help', 'cat-danger'], 2, 0]);
    assert.ok(got.values >= 10, `${got.values} tiles with a value`);
    assert.deepEqual(got.inside, [1, 0, 'Idioma', 'settings-back']);
    assert.equal(got.back, 'cat-lang');
  });

  await test('the popup: the method that keeps the session in Ajustes; Inicio says how', async (open) => {
    const tab = await open('popup.html');
    const got = await run(tab, `
      const line = () => document.querySelector('#home-session small').textContent;
      await until(() => document.getElementById('tabbtn-home'), 'the tabs');
      document.getElementById('tabbtn-home').click(); // the popup remembers the tab of the test before
      await until(() => document.querySelector('#home-session') && document.querySelector('.power.on'), 'a session in Inicio');
      const power = document.querySelector('.power');
      const tools = [...document.querySelectorAll('.tools-row .tool')].map((b) => b.textContent);
      const toolRows = new Set([...document.querySelectorAll('.tools-row .tool')].map((b) => Math.round(b.getBoundingClientRect().top))).size;
      const first = [line(), power.getAttribute('aria-disabled'), power.getAttribute('aria-pressed')];
      const session = async () => {
        document.getElementById('tabbtn-settings').click();
        (await until(() => document.getElementById('cat-session'), 'the categories')).click();
        return until(() => document.getElementById('ka-method'), 'the settings of the session');
      };
      await session();
      const options = [...document.getElementById('ka-method').options].map((o) => o.value + (o.selected ? '*' : ''));
      const choose = async (m) => {
        const sel = document.getElementById('ka-method');
        sel.value = m;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        await until(async () => ((await ext.storage.local.get('settings')).settings || {}).keepMethod === m, m);
        document.getElementById('tabbtn-home').click();
        await until(() => document.querySelector('#home-session small'), 'Inicio');
        await new Promise((r) => setTimeout(r, 150));
        const text = line();
        await session();
        await until(() => document.getElementById('ka-method').value === m, 'the settings again');
        return text;
      };
      return { first, options, tools, toolRows, none: await choose('none'), ping: await choose('ping'), left: !!document.getElementById('ka-left') };
    `);
    assert.deepEqual(got.first, ['Pulsa por ti «Mantenme activo» en MiAulario', null, 'true']);
    assert.deepEqual(got.options, ['button*', 'ping', 'both', 'none']);
    assert.deepEqual([got.tools, got.toolRows], [['Abrir MiAulario', 'Editar MiAulario', 'Historial', 'Novedades', 'Ayuda', 'Reportar un problema'], 2], 'the tools of Inicio: two rows of three');
    assert.equal(got.none, 'No se mantiene la sesión');
    assert.match(got.ping, /^Próximo ping en \d+:\d\d$/);
    assert.equal(got.left, true);
  });

  return results;
}
