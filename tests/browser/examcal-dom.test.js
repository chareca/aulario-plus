// The calendar of the exams (lib/ui.js, MAK.examCalendar): the months of the exams from Monday to Sunday,
// the finals and the recoveries in two colors, a tooltip on each day of an exam; the focus of a subject.
(function () {
  'use strict';
  const at = (y, m, d, h = 9) => new Date(y, m, d, h).getTime();
  const MINE = [
    { siteId: 'pl', name: 'PROCESADORES', final: at(2026, 11, 15, 12), recovery: at(2027, 0, 15, 8), finalRoom: 'A1', recoveryRoom: '' },
    { siteId: 'si', name: 'SEGURIDAD', final: at(2026, 11, 16, 12), recovery: at(2027, 0, 18), finalRoom: '', recoveryRoom: '' },
    { siteId: 'cc', name: 'COMPLEJIDAD', final: at(2027, 0, 11, 12), recovery: at(2027, 0, 15, 12), finalRoom: '', recoveryRoom: '' }
  ];
  const days = () => MAK.examDays(MINE, (r) => r.name.charAt(0) + r.name.slice(1).toLowerCase());
  const day = (cal, title, n) => [...[...cal.querySelectorAll('.cal-month')].find((m) => m.querySelector('.cal-title').textContent.startsWith(title)).querySelectorAll('.cal-day')]
    .find((d) => d.textContent === String(n));

  test('a semester: the months of its exams, from Monday; the finals and the recoveries; a tooltip with the subject, the kind and the date', () => {
    MAK.setLang('es');
    const cal = MAK.examCalendar(days(), { now: at(2026, 9, 21) });
    assert.deepEqual([...cal.querySelectorAll('.cal-title')].map((t) => t.textContent), ['diciembre de 2026', 'enero de 2027']);
    assert.deepEqual([...cal.querySelectorAll('.cal-month')[0].querySelectorAll('.cal-wd')].map((w) => w.textContent), ['L', 'M', 'X', 'J', 'V', 'S', 'D']);
    const dec = [...cal.querySelectorAll('.cal-month')[0].querySelectorAll('.cal-day')];
    assert.equal(dec.findIndex((d) => d.textContent === '1'), 1, '1 December 2026: a Tuesday');
    assert.ok(day(cal, 'diciembre', 15).classList.contains('final'));
    assert.ok(day(cal, 'enero', 18).classList.contains('rec'));
    const both = day(cal, 'enero', 15);
    assert.ok(both.classList.contains('final') === false && both.classList.contains('rec'), 'two recoveries on one day');
    assert.equal(both.dataset.tip.split('\n').length, 2, 'both in the tooltip');
    const tip = day(cal, 'diciembre', 15).dataset.tip;
    assert.ok(/^Procesadores · Final · .*15.* · A1$/.test(tip), tip);
    assert.equal(day(cal, 'diciembre', 15).getAttribute('tabindex'), '0', 'the tooltip also with the keyboard');
    assert.equal(day(cal, 'diciembre', 3).dataset.tip, undefined, 'a day without an exam');
    assert.equal(MAK.examCalendar([], {}), null);
  });

  test('a subject: the months of its exams; its days stand out, the days of the others are grey, with their tooltip', () => {
    const cal = MAK.examCalendar(days(), { focus: 'si', now: at(2026, 9, 21) });
    assert.ok(cal.classList.contains('focus'));
    assert.deepEqual([...cal.querySelectorAll('.cal-title')].map((t) => t.textContent), ['diciembre de 2026', 'enero de 2027']);
    const mine = day(cal, 'diciembre', 16);
    assert.ok(mine.dataset.tip && !mine.classList.contains('dim'));
    const other = day(cal, 'diciembre', 15);
    assert.ok(other.classList.contains('dim') && other.classList.contains('final'), 'another subject: its color, grey');
    assert.ok(/^Procesadores · Final · .*15.* · A1$/.test(other.dataset.tip), 'which subject and when, on hover');
    assert.equal(other.getAttribute('tabindex'), '0', 'also with the keyboard');
    // A day of the subject with an exam of another one too: both in the tooltip, the subject first (before: only it).
    const shared = MAK.examCalendar(days(), { focus: 'cc', now: at(2026, 9, 21) });
    const fifteen = day(shared, 'enero', 15);
    assert.ok(!fifteen.classList.contains('dim'));
    assert.deepEqual(fifteen.dataset.tip.split('\n').map((l) => l.split(' · ')[0]), ['Complejidad', 'Procesadores']);
    fifteen.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    assert.deepEqual([...shared.querySelectorAll('.cal-tip b')].map((b) => b.textContent.split(' · ')[0]), ['Complejidad'], 'the subject in bold, the other not');
    assert.equal(shared.querySelector('.cal-tip').textContent.split('\n').length, 2);
    const style = document.createElement('style');
    style.textContent = MAK.EXAM_CAL_CSS;
    document.head.append(style);
    document.body.append(cal);
    cal.style.cssText = '--ap-surface: #fff; --ap-fg: #000'; // the colors of the ring come from the theme
    assert.ok(getComputedStyle(mine).boxShadow !== 'none', 'a ring on the days of the subject');
    assert.equal(getComputedStyle(other).boxShadow, 'none', 'no ring on the grey days: they are not of this subject');
    other.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    assert.ok(!cal.querySelector('.cal-tip').hidden && cal.querySelector('.cal-tip').textContent.startsWith('Procesadores'), 'the tooltip on hover');
    cal.remove();
    style.remove();
    const only = MAK.examCalendar(days().filter((d) => d.siteId !== 'si').concat({ ms: at(2026, 11, 16), kind: 'final', siteId: 'si', name: 'S' }), { focus: 'si' });
    assert.deepEqual([...only.querySelectorAll('.cal-title')].map((t) => t.textContent), ['diciembre de 2026'], 'only the months of the subject');
  });

  test('the tooltip: on hover and on focus, inside the calendar (not under the sidebar of MiAulario), also for a day at an edge', () => {
    const cal = MAK.examCalendar(days(), { now: at(2026, 9, 21) });
    cal.style.width = '520px';
    const style = document.createElement('style');
    style.textContent = MAK.EXAM_CAL_CSS;
    document.head.append(style);
    document.body.append(cal);
    const tip = cal.querySelector('.cal-tip');
    const inside = () => {
      const b = cal.getBoundingClientRect();
      const r = tip.getBoundingClientRect();
      return r.left >= b.left - 0.5 && r.right <= b.right + 0.5;
    };
    const edge = day(cal, 'diciembre', 15); // Tuesday: the second column, at the left edge
    edge.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    assert.equal(tip.hidden, false);
    assert.ok(tip.textContent.startsWith('Procesadores · Final'), tip.textContent);
    assert.ok(inside(), 'at the left edge');
    assert.ok(tip.getBoundingClientRect().bottom <= edge.getBoundingClientRect().top, 'above the day');
    day(cal, 'enero', 18).dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    assert.ok(inside() && tip.textContent.startsWith('Seguridad'), 'another day');
    day(cal, 'enero', 3).dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    assert.equal(tip.hidden, true, 'a day without an exam');
    day(cal, 'enero', 11).focus();
    assert.equal(tip.hidden, false, 'the keyboard');
    cal.dispatchEvent(new MouseEvent('mouseleave'));
    assert.equal(tip.hidden, true);
    cal.remove();
    style.remove();
  });

  test('two months side by side, smaller with less space; one below the other only without room for two', () => {
    const style = document.createElement('style');
    style.textContent = MAK.EXAM_CAL_CSS;
    document.head.append(style);
    const tops = (width) => {
      const cal = MAK.examCalendar(days(), { now: at(2026, 9, 21) });
      cal.style.width = `${width}px`;
      document.body.append(cal);
      const months = [...cal.querySelectorAll('.cal-month')].map((m) => m.getBoundingClientRect());
      const day = cal.querySelector('.cal-day').getBoundingClientRect();
      cal.remove();
      return { same: months[0].top === months[1].top, inside: months[1].right <= months[0].left + width + 0.5, day };
    };
    try {
      assert.deepEqual([tops(560).same, tops(340).same, tops(300).same], [true, true, false]);
      assert.ok(tops(340).inside, 'inside the calendar');
      const [big, small] = [tops(560).day, tops(340).day];
      assert.ok(small.width < big.width && Math.abs(small.height / small.width - 7 / 8) < 0.05, 'smaller days, the same shape');
    } finally {
      style.remove();
    }
  });

  test('the button shows and hides the calendars, and saves the setting', () => {
    const wraps = [document.createElement('div'), document.createElement('div')];
    wraps.forEach((w) => { w.hidden = true; });
    const saved = [];
    const b = MAK.calendarButton(false, wraps, (on) => saved.push(on));
    assert.equal(b.getAttribute('aria-pressed'), 'false');
    b.click();
    assert.deepEqual([b.getAttribute('aria-pressed'), wraps.map((w) => w.hidden), saved], ['true', [false, false], [true]]);
    b.click();
    assert.deepEqual([wraps.every((w) => w.hidden), saved], [true, [true, false]]);
  });
  test('the cards of the exams (Mi sitio): rows of 3, the last row never with one card alone, the cards of a short row wider; less space: rows of 2, then 1', () => {
    const style = document.createElement('style');
    style.textContent = `.wrap { width: 900px; } .exams { list-style: none; display: grid; gap: 8px; padding: 0; } ${MAK.EXAM_ROWS_CSS}`;
    document.head.append(style);
    // The cards of each row (the same top), from the top.
    const rows = (n, width = 900) => {
      const ul = h('ul', { class: 'exams' }, Array.from({ length: n }, () => h('li', { text: 'x' })));
      const wrap = h('div', { class: 'wrap', attrs: { style: `width: ${width}px` } }, h('div', { class: 'exams-row' }, ul));
      document.body.append(wrap);
      const tops = [...ul.children].map((li) => Math.round(li.getBoundingClientRect().top));
      const widths = [...ul.children].map((li) => Math.round(li.getBoundingClientRect().width));
      wrap.remove();
      const counts = [...new Set(tops)].map((t) => tops.filter((x) => x === t).length);
      return { counts, full: widths[n - 1] > width - 50 };
    };
    const h = MAK.h;
    try {
      assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => rows(n).counts), [[1], [2], [3], [2, 2], [3, 2], [3, 3], [3, 2, 2], [3, 3, 2]]);
      assert.ok(rows(1).full, 'one exam: the full width');
      assert.deepEqual([1, 2, 3, 4, 5].map((n) => rows(n, 640).counts), [[1], [2], [2, 1], [2, 2], [2, 2, 1]], 'half a screen: rows of 2');
      assert.ok(rows(3, 640).full, 'the odd last card: the full width');
      assert.deepEqual(rows(3, 400).counts, [1, 1, 1], 'a column: one card a row');
    } finally {
      style.remove();
    }
  });
})();
