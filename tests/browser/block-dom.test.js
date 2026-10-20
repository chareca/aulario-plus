// The block "Aulario Plus" of "Mi sitio" (content-banner.js): at the top of the first column, with
// its own head and an arrow that folds it. The arrow of the boxes.
(function () {
  'use strict';

  const reset = () => {
    for (const id of ['mak-block', 'mak-test-main']) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
    try { localStorage.removeItem('mak-mysite-closed'); } catch {}
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
    assert.equal(block.querySelector('.mak-tag').textContent, 'Extensión');
    assert.equal(block.querySelector('.Mrphs-toolTitleNav'), null, 'not the head of the blocks of MiAulario');
    assert.equal(getComputedStyle(block.querySelector('.mak-head')).backgroundColor, 'rgb(16, 82, 78)', 'the green of the extension');
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

  test('the semesters: the one of the date open, the other folded below; its state stays; from 25 January only the second', async () => {
    const keys = ['mak-sem:test:autumn', 'mak-sem:test:spring'];
    try { for (const k of keys) localStorage.removeItem(k); } catch {}
    MAK.setLang('es');
    const parts = { autumn: { count: 3, body: document.createTextNode('A') }, spring: { count: 2, body: document.createTextNode('B') } };
    const make = (now) => MAK.semesterSections({ key: 'test', now, parts, title: (s) => MAK.t(`short.semester.${s}`) });
    const autumnDay = new Date(2026, 9, 20).getTime();
    let el = make(autumnDay);
    document.body.append(el);
    let sems = [...el.querySelectorAll('.sem')];
    assert.deepEqual(sems.map((x) => [x.querySelector('.sem-title').textContent, x.className]), [['Otoño · 1.er semestre · 3', 'sem open'], ['Primavera · 2.º semestre · 2', 'sem closed']]);
    assert.equal(el.querySelector('.sems').classList.contains('two'), false, 'one column: the folded one below');
    sems[1].querySelector('.mak-fold').click();
    assert.ok(el.querySelector('.sems').classList.contains('two'), 'both open: two columns');
    assert.equal(localStorage.getItem('mak-sem:test:spring'), '1');
    el.remove();
    el = make(autumnDay);
    assert.equal(el.querySelectorAll('.sem.open').length, 2, 'the open state stays');
    el = make(new Date(2027, 0, 25).getTime());
    assert.deepEqual([...el.querySelectorAll('.sem')].map((x) => [x.querySelector('.sem-title').textContent, x.className]), [['Primavera · 2.º semestre · 2', 'sem open']], 'from 25 January: no first semester');
    assert.equal(MAK.semesterSections({ key: 'test', now: autumnDay, parts: {}, title: String }), null);
    try { for (const k of keys) localStorage.removeItem(k); } catch {}
  });
})();
