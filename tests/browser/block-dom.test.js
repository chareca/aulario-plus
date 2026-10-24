// The block "Aulario Plus" of "Mi sitio" (content-banner.js): at the top of the first column, with
// its own head (the colors of the theme) and an arrow that folds it. The arrow of the boxes.
(function () {
  'use strict';

  const reset = () => {
    for (const id of ['mak-block', 'mak-test-main']) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
    try {
      localStorage.removeItem('mak-mysite-closed');
      localStorage.removeItem('mak-mysite-wide');
    } catch {}
  };

  // A page "Mi sitio": "Mensaje del día" and "Mostrar información de Mi Sitio" in the first column,
  // the calendar in the second column.
  function mySitePage() {
    reset();
    const main = document.createElement('main');
    main.id = 'mak-test-main';
    const tool = (cls, title) => `<div class="Mrphs-container ${cls}"><nav class="Mrphs-toolTitleNav"><h2 class="Mrphs-toolTitleNav__title">${title}</h2></nav><div class="Mrphs-toolBody">${title}</div></div>`;
    main.innerHTML = `<div class="col1">${tool('Mrphs-sakai-motd', 'Mensaje del día')}${tool('Mrphs-sakai-iframe-myworkspace', 'Mostrar información de Mi Sitio')}</div><div class="col2">${tool('Mrphs-sakai-summary-calendar', 'Calendario')}</div>`;
    document.body.append(main);
    return main;
  }

  test('Mi sitio: the block is at the top of the first column, above "Mensaje del día", with its own head', () => {
    MAK.setLang('es');
    const main = mySitePage();
    const body = MAK.mySiteSlot();
    body.append(document.createElement('div'));
    const block = document.getElementById('mak-block');
    assert.equal(block.parentElement, main.querySelector('.col1'), 'the first column, left of the calendar');
    assert.equal(block.nextElementSibling, main.querySelector('.Mrphs-sakai-motd'), 'above "Mensaje del día"');
    assert.equal(main.querySelector('.Mrphs-sakai-iframe-myworkspace .Mrphs-toolBody').textContent, 'Mostrar información de Mi Sitio', 'the blocks of MiAulario do not change');
    assert.equal(MAK.mySiteSlot(), body, 'one block');
    assert.ok(block.querySelector('.mak-head svg.mak-logo'), 'the logo');
    assert.equal(block.querySelector('h2').textContent, 'Aulario Plus');
    assert.equal(block.querySelector('h2').title, 'Aulario Plus es una extensión de tu navegador. No es de la UPNA.');
    assert.equal(block.querySelector('.Mrphs-toolTitleNav'), null, 'not the head of the blocks of MiAulario');
    const grey = MAK.isDarkPage() ? 'rgb(49, 53, 59)' : 'rgb(227, 228, 229)'; // #31353b, #e3e4e5
    assert.equal(getComputedStyle(block.querySelector('.mak-head')).backgroundColor, grey, 'the head of the theme (MiAulario: the grey of its blocks)');
    assert.equal(getComputedStyle(block).borderRadius, '4px', 'the corners of the blocks of MiAulario');
    const fold = block.querySelector('button.mak-fold');
    assert.equal(fold.textContent, '', 'only the arrow, no word');
    assert.equal(fold.getAttribute('aria-label'), 'Plegar Aulario Plus');
    assert.equal(fold.getAttribute('aria-expanded'), 'true');
    reset();
  });

  test('the arrow folds the block, and it stays folded when the page opens again', async () => {
    mySitePage();
    const body = MAK.mySiteSlot();
    body.append(document.createElement('div'));
    const fold = document.querySelector('#mak-block button.mak-fold');
    fold.click();
    assert.equal(body.hidden, true);
    assert.equal(getComputedStyle(body).display, 'none');
    assert.equal(fold.getAttribute('aria-expanded'), 'false');
    assert.equal(fold.getAttribute('aria-label'), 'Desplegar Aulario Plus');
    await new Promise((r) => setTimeout(r, 250)); // the turn of the arrow (0.15 s)
    assert.equal(getComputedStyle(fold.querySelector('svg')).transform, 'matrix(0, -1, 1, 0, 0, 0)', 'the arrow to the right');
    assert.equal(localStorage.getItem('mak-mysite-closed'), '1');
    // The page opens again.
    document.getElementById('mak-block').remove();
    const again = MAK.mySiteSlot();
    assert.equal(again.hidden, true, 'still folded');
    document.querySelector('#mak-block button.mak-fold').click();
    assert.equal(again.hidden, false, 'the arrow unfolds it');
    assert.equal(localStorage.getItem('mak-mysite-closed'), '0');
    reset();
  });

  test('the triangle in the corner: the block on the full width, above the two columns; again: back in the column; it stays', () => {
    MAK.setLang('es');
    const main = mySitePage();
    const col1 = main.querySelector('.col1');
    MAK.mySiteSlot().append(document.createElement('div'));
    const block = document.getElementById('mak-block');
    const widen = block.querySelector('.mak-head button.mak-widen');
    assert.ok(widen, 'the triangle');
    assert.equal(widen.getAttribute('aria-pressed'), 'false');
    assert.equal(widen.getAttribute('aria-label'), 'Todo el ancho');
    widen.click();
    const wrap = document.getElementById('mak-block-wide');
    assert.equal(block.parentElement, wrap);
    assert.equal(main.firstElementChild, wrap, 'a row of its own, before the columns');
    assert.equal(wrap.className, col1.className, 'the classes (the margins) of the column');
    assert.equal(widen.getAttribute('aria-pressed'), 'true');
    assert.equal(widen.title, 'Volver a la columna');
    assert.equal(localStorage.getItem('mak-mysite-wide'), '1');
    // The page opens again: still wide.
    wrap.remove();
    MAK.mySiteSlot().append(document.createElement('div'));
    assert.equal(document.getElementById('mak-block').parentElement.id, 'mak-block-wide');
    document.querySelector('#mak-block .mak-widen').click();
    assert.equal(document.getElementById('mak-block').nextElementSibling, main.querySelector('.Mrphs-sakai-motd'), 'back above "Mensaje del día"');
    assert.equal(document.getElementById('mak-block-wide'), null);
    assert.equal(localStorage.getItem('mak-mysite-wide'), '0');
    reset();
  });

  test('a page with one column: no triangle', () => {
    reset();
    const main = document.createElement('main');
    main.id = 'mak-test-main';
    main.innerHTML = '<div class="col1"><div class="Mrphs-container Mrphs-sakai-motd"><nav class="Mrphs-toolTitleNav"><h2>Mensaje del día</h2></nav></div></div>';
    document.body.append(main);
    MAK.mySiteSlot().append(document.createElement('div'));
    assert.ok(document.getElementById('mak-block'));
    assert.equal(document.querySelector('#mak-block .mak-widen'), null);
    reset();
  });

  test('the fold button of the boxes: only the arrow, the state for screen readers, a call on each click', () => {
    const calls = [];
    const b = MAK.foldButton(true, { open: 'Desplegar «X»', close: 'Plegar «X»' }, (open) => calls.push(open));
    assert.equal(b.textContent, '');
    assert.equal(b.getAttribute('aria-expanded'), 'true');
    assert.equal(b.title, 'Plegar «X»');
    b.click();
    b.click();
    assert.deepEqual(calls, [false, true]);
    assert.equal(b.getAttribute('aria-label'), 'Plegar «X»');
  });

  test('the semesters: the one of the date open, the other folded below; its state stays; from 25 January only the second; no count', async () => {
    const keys = ['mak-sem:test:autumn', 'mak-sem:test:spring'];
    try { for (const k of keys) localStorage.removeItem(k); } catch {}
    MAK.setLang('es');
    const parts = { autumn: { body: document.createTextNode('A') }, spring: { body: document.createTextNode('B') } };
    const make = (now) => MAK.semesterSections({ key: 'test', now, parts, title: (s) => MAK.t(`short.semester.${s}`) });
    const autumnDay = new Date(2026, 9, 20).getTime();
    let el = make(autumnDay);
    document.body.append(el);
    let sems = [...el.querySelectorAll('.sem')];
    assert.deepEqual(sems.map((x) => [x.querySelector('.sem-title').textContent, x.className]), [['1er semestre', 'sem open'], ['2do semestre', 'sem closed']]);
    assert.equal(el.querySelector('.sems').classList.contains('two'), false, 'one column: the folded one below');
    sems[1].querySelector('.mak-fold').click();
    assert.ok(el.querySelector('.sems').classList.contains('two'), 'both open: two columns');
    assert.equal(localStorage.getItem('mak-sem:test:spring'), '1');
    el.remove();
    el = make(autumnDay);
    assert.equal(el.querySelectorAll('.sem.open').length, 2, 'the open state stays');
    el = make(new Date(2027, 0, 25).getTime());
    assert.deepEqual([...el.querySelectorAll('.sem')].map((x) => [x.querySelector('.sem-title').textContent, x.className]), [['2do semestre', 'sem open']], 'from 25 January: no first semester');
    assert.equal(MAK.semesterSections({ key: 'test', now: autumnDay, parts: {}, title: String }), null);
    try { for (const k of keys) localStorage.removeItem(k); } catch {}
  });

  test('a fold moves its height and then hides; a click during it goes back from where it is; at once with reduced motion', async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const el = document.createElement('div');
    el.append(Object.assign(document.createElement('p'), { style: 'height: 100px; margin: 0' }));
    document.body.append(el);
    MAK.fold(el, false);
    assert.equal(el.hidden, false, 'shown while it folds');
    await wait(90);
    const mid = el.getBoundingClientRect().height;
    assert.ok(mid > 0 && mid < 100, `half folded: ${mid}`);
    MAK.fold(el, true); // back, from there
    assert.ok(Math.abs(el.getBoundingClientRect().height - mid) < 25, 'no jump');
    await wait(450);
    assert.deepEqual([el.hidden, el.getBoundingClientRect().height, el.style.overflow], [false, 100, '']);
    MAK.fold(el, false);
    await wait(450);
    assert.equal(el.hidden, true, 'hidden at the end');
    const real = window.matchMedia;
    window.matchMedia = () => ({ matches: true }); // prefers-reduced-motion
    MAK.fold(el, true);
    window.matchMedia = real;
    assert.deepEqual([el.hidden, el.getBoundingClientRect().height], [false, 100], 'at once');
    el.remove();
  });

  test('a window over the page: Escape closes it as Cancel, also when the focus is not in it; the page does not get the key', async () => {
    const before = document.documentElement.children.length;
    const answer = MAK.askWindow('Borrar', 'Seguro?', 'Sí');
    assert.equal(document.documentElement.children.length, before + 1);
    document.activeElement.blur(); // a click on the text of the window: the focus leaves it
    const page = [];
    const listen = (e) => page.push(e.key);
    document.body.addEventListener('keydown', listen);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(await answer, false);
    assert.equal(document.documentElement.children.length, before, 'closed');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.body.removeEventListener('keydown', listen);
    assert.deepEqual(page, ['Escape'], 'only the second one: the window is gone, and its listener too');
  });

  test('windows one at a time (a new notice of the library and the news of a version): the next one when the first closes', async () => {
    const before = document.documentElement.children.length;
    const first = MAK.askWindow('Uno', 'a', 'Sí');
    const second = MAK.askWindow('Dos', 'b', 'Sí');
    assert.equal(document.documentElement.children.length, before + 1, 'only the first one');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(await first, false);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(document.documentElement.children.length, before + 1, 'then the second one');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(await second, false);
    assert.equal(document.documentElement.children.length, before);
  });
})();
