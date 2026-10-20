// The block "Aulario Plus" of "Mi sitio" (content-banner.js): above the block of MiAulario, with
// its own head, and an arrow that folds it.
(function () {
  'use strict';

  // A page "Mi sitio" with the block "Mostrar información de Mi Sitio".
  function page() {
    const old = document.getElementById('mak-test-main');
    if (old) old.remove();
    const main = document.createElement('main');
    main.id = 'mak-test-main';
    main.innerHTML = '<div class="Mrphs-container Mrphs-sakai-iframe-myworkspace"><nav class="Mrphs-toolTitleNav"><h2 class="Mrphs-toolTitleNav__title">Mostrar información de Mi Sitio</h2></nav><div class="Mrphs-toolBody">Bienvenido</div></div>';
    document.body.append(main);
    return main;
  }

  test('Mi sitio: the block is above the block of MiAulario, with the logo, the title, the tag and the arrow', () => {
    try { localStorage.removeItem('mak-mysite-closed'); } catch {}
    MAK.setLang('es');
    const main = page();
    const body = MAK.mySiteSlot();
    const block = document.getElementById('mak-mysite-block');
    assert.equal(block.nextElementSibling, main.querySelector('.Mrphs-sakai-iframe-myworkspace'), 'just above "Mostrar información de Mi Sitio"');
    assert.equal(main.querySelector('.Mrphs-sakai-iframe-myworkspace .Mrphs-toolBody').textContent, 'Bienvenido', 'that block does not change');
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
    block.remove();
  });

  test('Mi sitio: the arrow folds the block, and it stays folded when the page opens again', () => {
    try { localStorage.removeItem('mak-mysite-closed'); } catch {}
    page();
    const body = MAK.mySiteSlot();
    body.append(document.createTextNode('Accesos directos'));
    const block = document.getElementById('mak-mysite-block');
    const fold = block.querySelector('button.mak-fold');
    fold.click();
    assert.equal(body.hidden, true);
    assert.equal(getComputedStyle(body).display, 'none');
    assert.equal(fold.getAttribute('aria-expanded'), 'false');
    assert.equal(fold.getAttribute('aria-label'), 'Desplegar Aulario Plus');
    assert.ok(block.classList.contains('mak-closed'));
    // The page opens again.
    block.remove();
    page();
    const again = MAK.mySiteSlot();
    assert.equal(again.hidden, true, 'still folded');
    document.querySelector('#mak-mysite-block button.mak-fold').click();
    assert.equal(again.hidden, false, 'the arrow unfolds it');
    assert.equal(localStorage.getItem('mak-mysite-closed'), '0');
    document.getElementById('mak-mysite-block').remove();
    document.getElementById('mak-test-main').remove();
  });
})();
