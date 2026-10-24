'use strict';
// The hours of the library of the UPNA (lib/library.js) and the reader of the text with colors of a PDF file
// (MAK.pdfTextRuns, lib/pdftext.js), with the synthetic pages and files of tests/fixtures/library.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib } = require('./helpers');
const F = require('./fixtures/library');
const MAK = loadLib('core', 'store', 'pdftext', 'library');

const at = (y, m, d, h = 10) => new Date(y, m - 1, d, h).getTime();
const near = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 0.01);

test('libraryUrl: only the library of www.unavarra.es and its PDF files, with https', () => {
  assert.equal(MAK.libraryUrl('http://www.unavarra.es/biblioteca/tablon-de-anuncios?contentId=1'), 'https://www.unavarra.es/biblioteca/tablon-de-anuncios?contentId=1');
  assert.equal(MAK.libraryUrl('/digitalAssets/289/a_b.pdf'), 'https://www.unavarra.es/digitalAssets/289/a_b.pdf');
  assert.equal(MAK.libraryUrl('http://www.unavarra.es/deportes/instalaciones/horario?languageId=100000'), 'https://www.unavarra.es/deportes/instalaciones/horario?languageId=100000');
  assert.equal(MAK.libraryUrl('https://www.unavarra.es/deportes/instalaciones/precios'), null, 'only the page of the hours of Sports');
  for (const bad of ['https://evil.example/biblioteca/x', 'javascript:alert(1)', '/digitalAssets/1/x.exe', 'https://www.unavarra.es/sites/grados/x', 'https://www.unavarra.es.evil.example/biblioteca/']) {
    assert.equal(MAK.libraryUrl(bad), null, bad);
  }
  assert.deepEqual(Object.keys(MAK.LIBRARY_CAMPUSES), ['arrosadia', 'salud', 'tudela'], 'the same campuses as MAK.withDefaults');
  assert.deepEqual(['salud', 'tudela', 'x', 7].map((c) => MAK.withDefaults({ libraryCampus: c }).libraryCampus), ['salud', 'tudela', 'arrosadia', 'arrosadia']);
});

test('parseLibraryPage: the lines of the usual hours and the hours of each day of the week', () => {
  const a = MAK.parseLibraryPage(F.PAGES.arrosadia);
  assert.deepEqual(a.lines, ['Lunes a viernes: 8:00 a 21:00 horas.', 'Sábado y domingo: cerrado.']);
  assert.deepEqual(a.week, [{ closed: true }, ...Array(5).fill({ hours: '8:00–21:00' }), { closed: true }]);
  const s = MAK.parseLibraryPage(F.PAGES.salud);
  assert.deepEqual([s.week[0], s.week[3], s.week[6]], [{ hours: '9:00–21:45' }, { hours: '8:00–21:00' }, { hours: '9:00–21:45' }]);
  assert.equal(MAK.parseLibraryPage('<p>Nada</p>'), null);
});

test('parseSportsPage: the access (also the gym) and the pool, each day of the week; not the office', () => {
  const s = MAK.parseSportsPage(F.SPORTS);
  assert.deepEqual(s.access.lines, ['De lunes a viernes, de 7:30 a 22:00', 'Sábados, de 9:00 a 22:00', 'Domingos y festivos, de 9:00 a 14:00']);
  assert.deepEqual([s.access.week[0], s.access.week[2], s.access.week[6]], [{ hours: '9:00–14:00' }, { hours: '7:30–22:00' }, { hours: '9:00–22:00' }]);
  assert.deepEqual([s.pool.week[0], s.pool.week[5], s.pool.week[6]], [{ closed: true }, { hours: '7:30–21:00' }, { hours: '9:00–14:00' }]);
  assert.deepEqual(MAK.weekToday(s.pool.week, at(2026, 10, 25)), { hours: '', closed: true, usual: true }, 'a Sunday');
  assert.equal(MAK.parseSportsPage('<div class="texto"><p>nada</p></div>'), null);
  assert.equal(MAK.weekToday(null), null);
  assert.deepEqual([...s.access.lines, ...MAK.parseLibraryPage(F.PAGES.arrosadia).lines].map(MAK.shortDays).filter((l) => l.startsWith('L-V')),
    ['L-V, de 7:30 a 22:00', 'L-V: 8:00 a 21:00 horas.'], '"(de) lunes a viernes": "L-V"');
});

test('parseFoodPage, foodPeriod and foodDay: the cafeterias and the dining hall, in the course, the holidays or a weekend', () => {
  const places = [...MAK.parseFoodPage(F.CAFETERIAS), ...MAK.parseFoodPage(F.COMEDORES)];
  assert.deepEqual(places.map((p) => [p.name, p.campus, p.extra]), [['Cafetería Aulario', 'arrosadia', 'kitchen'], ['Cafetería El Sario', 'arrosadia', 'meals'],
    ['Cafetería Ciencias de la Salud', 'salud', 'meals'], ['Cafetería Tudela', 'tudela', 'meals'], ['Edificio comedores', 'arrosadia', 'meals']]);
  assert.deepEqual([places[0].course, places[0].holidays, places[1].holidays, places[0].weekend], [{ hours: '7:30–19:30', extra: '8:00–19:00' }, { hours: '7:30–16:30', extra: '9:00–16:00' }, { closed: true }, { closed: true }]);
  assert.deepEqual([[2026, 10, 26], [2026, 10, 24], [2026, 7, 8], [2026, 4, 2], [2026, 4, 6], [2026, 4, 7], [2026, 12, 28], [2027, 1, 7], [2027, 3, 25]].map(([y, m, d]) => MAK.foodPeriod(at(y, m, d))),
    ['course', 'weekend', 'holidays', 'holidays', 'holidays', 'course', 'holidays', 'course', 'holidays'], 'Easter 2026: 2 to 6 April; Easter 2027: 25 to 29 March');
  const arrosadia = places.filter((p) => p.campus === 'arrosadia');
  assert.deepEqual(MAK.foodDay(arrosadia, at(2026, 10, 26)), { hours: '7:30–19:30', closed: false, period: 'course' }, 'from the first one that opens to the last one that closes');
  assert.deepEqual(MAK.foodDay(arrosadia, at(2026, 7, 8)), { hours: '7:30–16:30', closed: false, period: 'holidays' });
  assert.deepEqual(MAK.foodDay(places.filter((p) => p.campus === 'salud'), at(2026, 7, 8)), { hours: '', closed: true, period: 'holidays', usual: false, notice: 'vacaciones' });
  assert.equal(MAK.closedReason('vacaciones'), 'holidays');
  assert.deepEqual(MAK.parseFoodPage('<p>nada</p>'), []);
  assert.equal(MAK.libraryUrl('https://www.unavarra.es/restauracion/sugerencias'), null);
});

test('parseBoardList and isHoursNotice: the notices with their date, and only the ones about hours of the campus', () => {
  const { items, years } = MAK.parseBoardList(F.BOARD);
  assert.equal(items.length, 5);
  assert.deepEqual([items[3].id, items[3].date, items[3].title], ['289130', at(2026, 4, 13, 0), 'Horario especial de época de exámenes: 18 ABRIL-14 JUNIO']);
  assert.equal(items[0].url, 'https://www.unavarra.es/biblioteca/tablon-de-anuncios?contentId=291288');
  assert.deepEqual(years.map((y) => y.year), [2025, 2024]);
  const hours = (campus) => items.filter((it) => MAK.isHoursNotice(it.title, campus)).map((it) => it.id);
  assert.deepEqual(hours('arrosadia'), ['290185', '289130', '288889'], 'not "Acceso Abierto", not the room of Salud');
  assert.deepEqual(hours('salud'), ['290965', '290185', '289130', '288889']);
});

test('parseNotice: the rows of the campus, the lines that name no other campus, the PDF file of the campus', () => {
  const summer = (campus) => MAK.parseNotice(F.NOTICES[290185], campus);
  assert.deepEqual(summer('tudela').blocks, [
    { head: 'Tudela', lines: ['Del 1 de julio al 31 de agosto, de 8.00 a 14.30 horas', 'CERRADO: del 24 al 31 de julio', '3 y 4 de agosto, de 9.00 a 13.00 horas'] },
    { head: '', lines: ['SÁBADOS, DOMINGOS Y FESTIVOS PERMANECERÁN CERRADAS.'] }
  ]);
  assert.deepEqual(summer('salud').blocks.map((b) => b.head), ['C. Salud', 'Aula 015 C. Salud', '']);
  assert.equal(summer('salud').pdf, '');
  const exams = MAK.parseNotice(F.NOTICES[289130], 'arrosadia');
  assert.deepEqual(exams.blocks, [
    { head: 'Arrosadía (biblioteca)', lines: ['abril: 18, 19, 20, 25 y 26', 'mayo: 1, 2, 3, 9 y 10', '9:00-22:45'] },
    { head: 'Arrosadía (aula 04)', lines: ['sábados', '8:00-14:45'] },
    { head: '', lines: ['Biblioteca de Arrosadía: sistema de acceso de tornos. Regístrate'] }
  ], 'no head of the table, no "calendario", not the line of Salud');
  assert.equal(exams.pdf, 'https://www.unavarra.es/digitalAssets/289/289130_1000002026_examenes_arrosadia.pdf');
  assert.equal(MAK.parseNotice(F.NOTICES[289130], 'tudela').pdf, 'https://www.unavarra.es/digitalAssets/289/289130_1000002026_examenes_sani_tudela.pdf');
  assert.deepEqual(MAK.parseNotice('<html>nada</html>', 'tudela'), { blocks: [], text: [], pdf: '' });
});

test('noticePeriod: the first and the last day that a notice names, with the year of the notice', () => {
  const period = (id, published) => {
    const p = MAK.noticePeriod(MAK.parseNotice(F.NOTICES[id], 'arrosadia').text, published);
    return p && [new Date(p.from).toDateString(), new Date(p.to - MAK.DAY).toDateString()];
  };
  assert.deepEqual(period(290185, at(2026, 6, 17)), [new Date(2026, 6, 1).toDateString(), new Date(2026, 7, 31).toDateString()]);
  assert.deepEqual(period(288889, at(2026, 3, 24)), [new Date(2026, 2, 26).toDateString(), new Date(2026, 3, 13).toDateString()], 'all the days it names (the loans too): only without rules (MAK.noticeRules)');
  assert.deepEqual(period(286888, at(2025, 10, 28)), [new Date(2025, 10, 22).toDateString(), new Date(2026, 0, 18).toDateString()], 'January: the next year');
  assert.equal(period(290965, at(2026, 9, 16)), null, 'no date');
});

test('pdfTextRuns: the text of a PDF of Canva (Identity-H, ToUnicode, forms, hex strings, FlateDecode) with its color', async () => {
  const runs = await MAK.pdfTextRuns(F.calendarPdf());
  const page1 = runs.filter((r) => r.page === 1);
  assert.ok(page1.some((r) => r.text === 'abril / apirila'));
  const day18 = page1.find((r) => r.text === '18');
  assert.ok(day18 && near(day18.rgb, F.colors.GREEN) && day18.size > 0, 'a number in a form, with the color of the form');
  const page2 = runs.filter((r) => r.page === 2);
  assert.ok(page2.some((r) => r.text === '9:00 - 22:45 h.' && near(r.rgb, F.colors.GREEN)), 'a hex string in the compressed page');
  assert.equal(page2.filter((r) => /^\d{1,2}$/.test(r.text)).length, 31);
  assert.deepEqual(await MAK.pdfTextRuns(new TextEncoder().encode('not a pdf')), []);
  // A hostile file: a form that draws itself, a map of 2000 full ranges, many operands. It ends at once.
  const start = Date.now();
  const latin = (text) => Uint8Array.from(text, (c) => c.charCodeAt(0));
  await MAK.pdfTextRuns(latin('%PDF-1.4\n1 0 obj << /Type /Page /Contents 2 0 R /Resources << /XObject << /X 3 0 R >> /Font << /F 4 0 R >> >> >> endobj\n' +
    '2 0 obj << /Length 41 >>\nstream\n/X Do BT /F 12 Tf <0001> Tj ET q Q q Q Q\nendstream endobj\n' +
    '3 0 obj << /Subtype /Form /Length 5 /Resources << /XObject << /X 3 0 R >> >> >>\nstream\n/X Do\nendstream endobj\n' +
    '4 0 obj << /Type /Font /Subtype /Type0 /ToUnicode 5 0 R >> endobj\n' +
    `5 0 obj << >>\nstream\nbeginbfrange\n${'<0000> <FFFF> <0041>\n'.repeat(2000)}endbfrange\n${'1 '.repeat(100000)}\nendstream endobj\n`));
  assert.ok(Date.now() - start < 2000, `${Date.now() - start} ms`);
});

test('libraryCalendar: each day with the index of its color in the legend; a month with a missing number is out', async () => {
  const cal = MAK.libraryCalendar(await MAK.pdfTextRuns(F.calendarPdf()));
  assert.deepEqual(cal.legend, [{ hours: '8:00–21:00', closed: false }, { hours: '9:00–22:45', closed: false }, { hours: '', closed: true }]);
  assert.deepEqual(cal.months.map((x) => [x.y, x.m, x.days.length]), [[2026, 3, 30], [2026, 4, 31]], 'June has 29 numbers: out');
  const april = cal.months[0].days;
  assert.deepEqual([april[0], april[12], april[17], april[19], april[20]], [-1, 0, 1, 1, 0], 'grey: no color of the legend; another blue: the blue');
  const may = cal.months[1].days;
  assert.deepEqual([may[0], may[29], may[30], may[4]], [1, 2, 2, 0], 'the legend in two texts');
});

test('openState: open until when, or closed and when it opens (also after a weekend or a closed day of a calendar)', () => {
  const week = MAK.parseLibraryPage(F.PAGES.arrosadia).week; // Monday to Friday 8:00–21:00, weekends closed
  const usual = (ms) => MAK.weekToday(week, ms);
  const state = (when, dayOf = usual) => {
    const s = MAK.openState(dayOf, when);
    return s && [s.open, s.at && new Date(s.at).toString().slice(0, 21)];
  };
  assert.deepEqual(state(at(2026, 10, 22, 10)), [true, 'Thu Oct 22 2026 21:00'], 'a Thursday at 10:00');
  assert.deepEqual(state(at(2026, 10, 22, 7)), [false, 'Thu Oct 22 2026 08:00'], 'before it opens');
  assert.deepEqual(state(at(2026, 10, 23, 22)), [false, 'Mon Oct 26 2026 08:00'], 'a Friday night: on Monday');
  assert.deepEqual(state(at(2026, 10, 24, 12)), [false, 'Mon Oct 26 2026 08:00'], 'a Saturday');
  assert.equal(MAK.openState(() => null, at(2026, 10, 24)), null, 'not known today');
  assert.deepEqual(MAK.openState((ms) => (ms > at(2026, 10, 24, 23) ? null : { closed: true }), at(2026, 10, 24, 12)), { open: false, at: 0 }, 'closed, the next days not known');
  const holidays = (ms) => (new Date(ms).getMonth() === 7 ? { closed: true } : { hours: '9:00–19:00' }); // closed all August
  assert.equal(MAK.openState(holidays, at(2026, 8, 10, 12)).at, 0, 'two weeks by default');
  assert.equal(new Date(MAK.openState(holidays, at(2026, 8, 10, 12), 75).at).toString().slice(0, 21), 'Tue Sep 01 2026 09:00', 'more days');
});

test('loadLibrary and libraryToday: the notices that did not end, of the campus; the hours of today', async () => {
  const routes = F.routes();
  const asked = [];
  const getText = async (url) => {
    asked.push(url);
    if (!(url in routes)) throw new Error(`404 ${url}`);
    return String(routes[url]);
  };
  const getBytes = async (url) => routes[url];
  const load = (campus, now) => MAK.loadLibrary({ campus, getText, getBytes, now });

  // 15 April 2026, Arrosadía: the exams (with their calendar) and Easter (ended) -> the exams.
  const april = await load('arrosadia', at(2026, 4, 15));
  assert.deepEqual(april.notices.map((n) => n.title), ['Horario especial de época de exámenes: 18 ABRIL-14 JUNIO']);
  assert.ok(april.notices[0].cal && april.notices[0].pdf.endsWith('_arrosadia.pdf'));
  assert.ok(asked.every((u) => MAK.libraryUrl(u) === u), 'only addresses of the library');
  assert.deepEqual(MAK.libraryToday(april, at(2026, 4, 18)), { hours: '9:00–22:45', closed: false, notice: 'Horario especial de época de exámenes: 18 ABRIL-14 JUNIO' });
  assert.deepEqual(MAK.libraryToday(april, at(2026, 4, 15)), { hours: '8:00–21:00', closed: false, notice: april.notices[0].title, usual: true }, 'the blue of the legend: the usual hours of a Wednesday');
  assert.deepEqual(MAK.libraryToday(april, at(2026, 4, 11)), { hours: '', closed: true, usual: true }, 'a Saturday without a color: the usual hours');
  const opens = MAK.openState((ms) => MAK.libraryDay(april, ms), at(2026, 4, 17, 22));
  assert.equal(new Date(opens.at).toString().slice(0, 21), 'Sat Apr 18 2026 09:00', 'a Friday night before the exams: on Saturday at 9:00 (the calendar)');

  // Easter (a notice in words): closed on its days, the usual hours the others; the days of the loans do not count.
  const easter = await load('arrosadia', at(2026, 3, 26));
  const notice = easter.notices.find((n) => n.title.startsWith('Semana Santa'));
  assert.deepEqual([new Date(notice.from).getDate(), new Date(notice.to - MAK.DAY).getDate()], [2, 6], 'from 2 to 6 April, not from 26 March to 13 April');
  assert.deepEqual(MAK.libraryToday(easter, at(2026, 3, 26)), { hours: '8:00–21:00', closed: false, usual: true });
  assert.deepEqual(MAK.libraryToday(easter, at(2026, 4, 3)), { hours: '', closed: true, notice: notice.title });
  assert.equal(MAK.closedReason(notice.title), 'easter');
  const easterSalud = (await load('salud', at(2026, 3, 26))).notices.find((n) => n.title.startsWith('Semana Santa'));
  assert.deepEqual(MAK.libraryDay({ notices: [easterSalud] }, at(2026, 4, 4)), { hours: '9:00–21:00', closed: false, notice: easterSalud.title }, '"de 9h. a 21h."');

  // 8 July 2026, Tudela: the summer, only the row of Tudela.
  const summer = await load('tudela', at(2026, 7, 8));
  assert.deepEqual(summer.notices.map((n) => n.blocks[0].head), ['Tudela']);
  assert.equal(summer.page.url, MAK.LIBRARY_CAMPUSES.tudela.page);
  // Its days: the summer hours, closed 24 to 31 July and on the weekends, 9:00–13:00 on 3 and 4 August.
  const day = (m, d) => { const x = MAK.libraryDay(summer, at(2026, m, d)); return x && (x.closed ? 'closed' : x.hours); };
  assert.deepEqual([day(7, 8), day(7, 11), day(7, 27), day(8, 3), day(8, 31), day(9, 1)], ['8:00–14:30', 'closed', 'closed', '9:00–13:00', '8:00–14:30', '8:00–21:00']);
  assert.equal(MAK.closedReason(summer.notices[0].title), 'summer');

  // 24 October 2026, Salud: the room on weekends (no date: 90 days); the summer and the exams ended.
  const salud = await load('salud', at(2026, 10, 24));
  assert.deepEqual(salud.notices.map((n) => n.title), ['Biblioteca de Ciencias de la Salud: aula de estudio abierta los fines de semana']);
  assert.deepEqual(MAK.libraryToday(salud, at(2026, 10, 24)), { hours: '9:00–21:45', closed: false, usual: true });

  // 10 January 2026: the notice of the year before (November to January), from the link of 2025.
  const dec = await load('arrosadia', at(2026, 1, 10));
  assert.deepEqual(dec.notices.map((n) => n.title), ['Horario de las bibliotecas en periodo de exámenes (nov. 2025- en. 2026)']);

  // The sports facilities and the pool, for all the campuses.
  assert.deepEqual([april.sports.url, april.sports.access.lines.length, april.sports.pool.week[0], april.partial], [MAK.SPORTS_HOURS, 3, { closed: true }, false]);
  assert.deepEqual(april.food.places.map((p) => p.name), ['Cafetería Aulario', 'Cafetería El Sario', 'Edificio comedores'], 'the places of the campus');

  // A campus that does not exist: Arrosadía. A page that fails: the other one, "partial". No page: an error.
  assert.equal((await load('mars', at(2026, 4, 15))).campus, 'arrosadia');
  const noSports = await MAK.loadLibrary({ campus: 'tudela', getText: (url) => (url === MAK.SPORTS_HOURS ? Promise.reject(new Error('503')) : getText(url)), getBytes, now: at(2026, 4, 15) });
  assert.deepEqual([noSports.sports, !!noSports.page, noSports.partial], [null, true, true]);
  const noLibrary = await MAK.loadLibrary({ campus: 'tudela', getText: (url) => (url === MAK.LIBRARY_CAMPUSES.tudela.page ? Promise.reject(new Error('503')) : getText(url)), getBytes, now: at(2026, 4, 15) });
  assert.deepEqual([noLibrary.page, !!noLibrary.sports, MAK.libraryToday(noLibrary, at(2026, 4, 11))], [null, true, null]);
  await assert.rejects(MAK.loadLibrary({ campus: 'tudela', getText: async () => '<p>no</p>', getBytes, now: at(2026, 4, 15) }));
});
