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
})();
