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
  // Salud on weekends: an "aula de estudio", not the library (not known).
  const s = MAK.parseLibraryPage(F.PAGES.salud);
  assert.deepEqual([s.week[0], s.week[3], s.week[6]], [null, { hours: '8:00–21:00' }, null]);
  const week = (...l) => MAK.parseLibraryPage(F.campusPage(l)).week;
  assert.deepEqual(week('Lunes a viernes: de 8:00 a 14:00 y de 16:00 a 20:00', 'Sábados: 9:00 a 14:00')[1], null, 'two ranges');
  assert.deepEqual(week('Sábados de 9:00 a 14:00, domingos cerrado', 'Sábados: 10:00 a 13:00')[6], null, 'hours and closed together; the first line of a day');
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
  // The only PDF of a notice about another campus is not the calendar of this one; a heading without ":" ("Campus de
  // Tudela") gives its lines only to its campus.
  const one = F.notice('Lunes 13 de abril de 2026', 'Horario especial de época de exámenes',
    '<p>La biblioteca de Arrosadía abrirá los fines de semana según este calendario:</p><p><a href="/digitalAssets/1/1_calendario.pdf">Calendario</a></p>');
  assert.deepEqual([MAK.parseNotice(one, 'arrosadia').pdf, MAK.parseNotice(one, 'tudela').pdf], ['https://www.unavarra.es/digitalAssets/1/1_calendario.pdf', '']);
  const heads = F.notice('Lunes 13 de abril de 2026', 'Horario de las bibliotecas',
    '<p><strong>Campus de Arrosadía</strong></p><p>Del 10 al 20 de enero, de 8:00 a 22:00.</p><p><strong>Campus de Tudela</strong></p><p>Del 10 al 20 de enero, de 9:00 a 14:00.</p>');
  assert.deepEqual(MAK.parseNotice(heads, 'tudela').blocks.flatMap((x) => x.lines), ['Campus de Tudela', 'Del 10 al 20 de enero, de 9:00 a 14:00.']);
  assert.deepEqual(MAK.parseNotice(heads, 'salud').blocks, []);
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
  // The forms of the board since 2015 (titles and lines).
  const of = (text, published) => {
    const p = MAK.noticePeriod([text], published);
    return p && [new Date(p.from).toDateString().slice(4), new Date(p.to - 1).toDateString().slice(4)];
  };
  const cases = [
    ['(diciembre 2016-enero 2017)', at(2016, 12, 8), ['Dec 01 2016', 'Jan 31 2017']],
    ['Horario especial de época de exámenes: 18 ABRIL-14 JUNIO', at(2026, 4, 12), ['Apr 18 2026', 'Jun 14 2026']],
    ['Horario de verano JULIO-AGOSTO 2015', at(2015, 6, 30), ['Jul 01 2015', 'Aug 31 2015']],
    ['(nov. 2025- en. 2026)', at(2025, 10, 27), ['Nov 01 2025', 'Jan 31 2026']],
    ['mayo: días 6, 7 y 13', at(2026, 4, 20), ['May 06 2026', 'May 13 2026']],
    ['Del 1 al 5 julio, de 8:00 a 21:30', at(2016, 6, 27), ['Jul 01 2016', 'Jul 05 2016']],
    ['los días 10 a 20 de julio', at(2026, 6, 20), ['Jul 10 2026', 'Jul 20 2026']],
    ['entre el 10 y el 20 de julio', at(2026, 6, 20), ['Jul 10 2026', 'Jul 20 2026']],
    ['10-20 de julio', at(2026, 6, 20), ['Jul 10 2026', 'Jul 20 2026']],
    ['el 1º de julio', at(2026, 6, 20), ['Jul 01 2026', 'Jul 01 2026']],
    ['el 13/07 cerrado', at(2026, 6, 20), ['Jul 13 2026', 'Jul 13 2026']],
    ['24, 25 y 31 de dic. y 1 de ene.', at(2022, 11, 22), ['Dec 24 2022', 'Jan 01 2023']],
    ['el 20 de diciembre', at(2027, 1, 5), ['Dec 20 2026', 'Dec 20 2026']], // a notice of January: the December before
    ['el 29 de febrero', at(2028, 1, 10), ['Feb 29 2028', 'Feb 29 2028']],
    ['a partir del viernes 13', at(2026, 11, 2), ['Nov 13 2026', 'Nov 13 2026']], // the month of the notice
    ['Semana Internacional de Acceso Abierto 2026 (19-25 de octubre)', at(2026, 10, 14), ['Oct 19 2026', 'Oct 25 2026']]
  ];
  for (const [text, published, want] of cases) assert.deepEqual(of(text, published), want, text);
  assert.equal(of('el 29 de febrero', at(2026, 6, 20)), null, 'no leap year near');
  assert.equal(of('sábados y domingos de 9 a 19 horas', at(2026, 6, 20)), null, 'hours are not days');
});

// The hours of a day by the rules of a notice (its blocks) for a campus with the usual hours of Arrosadía: "9:00–14:00",
// "closed", "usual" (no rule of the notice) or null (not known).
const ARROSADIA_WEEK = MAK.parseLibraryPage(F.PAGES.arrosadia).week;
const ruleDay = (blocks, published, campus, title = 'Horario') => {
  const read = MAK.noticeRules(blocks, published, campus, title);
  return (y, m, d) => {
    if (!read || read.uncertain) return read && 'uncertain';
    const data = { page: { week: ARROSADIA_WEEK }, notices: [{ title, date: published, rules: { rules: read.rules, weekly: read.weekly }, from: read.from, to: read.to }] };
    const x = MAK.libraryDay(data, at(y, m, d, 12));
    return !x ? null : !x.notice ? 'usual' : x.closed ? 'closed' : x.hours;
  };
};
const lines = (...l) => ({ head: '', lines: l });
const row = (head, ...l) => ({ head, lines: l });

test('noticeRules: the notices of the board since 2015, day by day', () => {
  // Summer 2016: "Del 1 al 5 julio" (no "de"), CERRADO, and the weekends closed over the ranges.
  let day = ruleDay([lines('A partir del 1 de julio el horario de las Bibliotecas es:'),
    row('Arrosadía', 'Del 1 al 5 julio, de 8:00 a 21:30', 'Del 14 de julio al 19 de agosto, de 8:00 a 15:30', 'Del 22 al 31 de agosto, de 8:00 a 21:30', 'CERRADO: del 6 al 13 de julio'),
    lines('Sábados, domingos y festivos permanecerán cerradas.')], at(2016, 6, 27), 'arrosadia');
  assert.deepEqual([day(2016, 7, 1), day(2016, 7, 2), day(2016, 7, 8), day(2016, 7, 16), day(2016, 7, 18), day(2016, 8, 27), day(2016, 8, 29), day(2016, 9, 1)],
    ['8:00–21:30', 'closed', 'closed', 'closed', '8:00–15:30', 'closed', '8:00–21:30', 'usual']);
  // Summer 2018: a day as an exception of a range.
  day = ruleDay([row('Arrosadía', 'Del 2 de julio al 31 de agosto, de 8.00 a 15.00 horas', 'excepto 13 de julio, de 9.00 a 13.00', 'CERRADO: del 6 al 12 de julio'),
    lines('Sábados, domingos y festivos permanecerán cerradas.')], at(2018, 6, 27), 'arrosadia');
  assert.deepEqual([day(2018, 7, 2), day(2018, 7, 9), day(2018, 7, 13), day(2018, 7, 14)], ['8:00–15:00', 'closed', '9:00–13:00', 'closed']);
  // A range with days of the week ("de lunes a viernes"), not the ones of a date ("del lunes 6").
  day = ruleDay([lines('Del lunes 6 al viernes 31 de julio, de lunes a viernes de 8:00 a 14:00.')], at(2026, 6, 20), 'arrosadia');
  assert.deepEqual([day(2026, 7, 6), day(2026, 7, 11)], ['8:00–14:00', 'usual']);
  // November 2021: one sentence for the three campuses; the one of Salud is an "aula" (the library keeps its hours).
  const nov = [lines('Los días 27, 28 y 29 de noviembre y 3, 4, 5, 6, 8, 11 y 12 de diciembre la biblioteca del campus de Arrosadía abrirá de 9 a 22:45 y las de los campus de Tudela y Ciencias de la Salud (aula 03), abrirán de 9 a 21:45.', 'El resto de los días seguirá el horario habitual')];
  assert.deepEqual(['arrosadia', 'tudela', 'salud'].map((c) => ruleDay(nov, at(2021, 11, 14), c)(2021, 11, 29)), ['9:00–22:45', '9:00–21:45', 'usual']);
  assert.equal(ruleDay(nov, at(2021, 11, 14), 'arrosadia')(2021, 12, 7), 'usual');
  // Easter 2023: "aulas" in Arrosadía (not the library) and the other two closed that day; the "aulario" on weekends.
  const easter = [lines('El día 8 de abril se habilitarán aulas en Arrosadía; horario 8-15. Las bibliotecas de Ciencias de la Salud y Tudela permanecerán cerradas.', 'Los días 6, 7, 9 y 10 de abril permanecerán cerradas todas las bibliotecas'),
    row('Arrosadía (aulario)', 'abril: 22, 23, 29 y 30', '9:00-22:45')];
  assert.deepEqual(['arrosadia', 'tudela'].map((c) => { const d = ruleDay(easter, at(2023, 3, 28), c); return [d(2023, 4, 6), d(2023, 4, 8), d(2023, 4, 22)]; }),
    [['closed', 'usual', 'usual'], ['closed', 'closed', 'usual']]);
  // Exams 2022: from a Saturday on, the weekends with the hours of the next line; the days of Christmas.
  const start = 'A partir de este sábado 26 de noviembre (época de exámenes) las bibliotecas abrirán los días festivos y fines de semana en el siguiente horario.';
  day = ruleDay([lines(start, 'Campus de Tudela: abre la biblioteca de 09:00 a 21:45.', 'En festivos navideños:', '24 y 31 de dic. de 9:00 a 15:00', '25 de dic. y 1 de ene. CERRADO')], at(2022, 11, 22), 'tudela');
  assert.deepEqual([day(2022, 11, 26), day(2022, 11, 28), day(2022, 12, 24), day(2022, 12, 25), day(2023, 1, 1)], ['9:00–21:45', 'usual', '9:00–15:00', 'closed', 'closed']);
  day = ruleDay([lines(start, 'Arrosadía: aulas en el aulario de 09:00 a 22:45. La biblioteca permanecerá cerrada')], at(2022, 11, 22), 'arrosadia');
  assert.deepEqual([day(2022, 11, 26), day(2022, 11, 28)], ['closed', 'usual']);
  // Weekends of 2016: the days in the title; the "aulario" is not the library.
  day = ruleDay([row('Arrosadia', 'Biblioteca: sábados y domingos de 9 a 23 horas', 'Aulario: sábados de 8 a 16 horas')], at(2016, 5, 2), 'arrosadia', 'Horario de apertura los fines de semana de 7 de mayo a 26 de junio');
  assert.deepEqual([day(2016, 5, 7), day(2016, 5, 8), day(2016, 5, 9), day(2016, 6, 25), day(2016, 7, 2)], ['9:00–23:00', '9:00–23:00', 'usual', '9:00–23:00', 'usual']);
  // Easter 2026 for Salud ("de 9h. a 21h."); a day on the change of the time (25 hours) still before the closed weekends.
  assert.equal(ruleDay([lines('Los días 2, 3, 4, 5 y 6 de abril la biblioteca de Ciencias de la Salud abrirá en horario de 9h. a 21h.')], at(2026, 3, 23), 'salud')(2026, 4, 3), '9:00–21:00');
  assert.equal(ruleDay([lines('Sábados, domingos y festivos permanecerán cerradas.'), lines('El 25 de octubre la biblioteca abrirá de 9 a 14.')], at(2026, 10, 1), 'arrosadia')(2026, 10, 25), '9:00–14:00');
  // The closing of 2020, without an end: to 90 days.
  day = ruleDay([lines('Las bibliotecas de la UPNA permanecerán cerradas a partir del viernes 13 de marzo.')], at(2020, 3, 11), 'salud');
  assert.deepEqual([day(2020, 3, 12), day(2020, 3, 13), day(2020, 6, 10), day(2020, 6, 12)], ['usual', 'closed', 'closed', 'usual']);
  assert.ok(MAK.isHoursNotice('Cierre de las bibliotecas de la UPNA', 'tudela'));
});

test('noticeRules: what it does not understand is not known (uncertain), never other hours', () => {
  const read = (...l) => MAK.noticeRules([lines(...l)], at(2026, 6, 20), 'arrosadia');
  assert.equal(read('Del 1 al 5 de julio, de 8:00 a 14:00 y de 16:00 a 20:00').uncertain, true, 'two ranges without their days');
  assert.equal(read('El 3 de julio, de 8:00 a 14:00; por la tarde, cerrada').uncertain, true, 'hours and closed');
  assert.deepEqual(read('Del 1 al 31 de julio: sábado de 8.00 a 21:45 - domingo de 9.00 a 21.45').rules.map((r) => [r.hours, r.days]), [['8:00–21:45', [6]], ['9:00–21:45', [0]]], 'each range with its day');
  assert.equal(read('Semana del acceso abierto: 19-25 de octubre'), null, 'days, no hours');
  assert.equal(read('Los préstamos realizados desde el 26 de marzo se podrán devolver hasta el 13 de abril'), null, 'the loans');
  // An uncertain notice: its days are not known (loadLibrary keeps no rules).
  const data = { page: { week: ARROSADIA_WEEK }, notices: [{ title: 'Horario', date: at(2026, 6, 20), rules: null, from: at(2026, 7, 1, 0), to: at(2026, 7, 6, 0) }] };
  assert.deepEqual([MAK.libraryDay(data, at(2026, 7, 3)), MAK.libraryDay(data, at(2026, 7, 6)).hours], [null, '8:00–21:00']);
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
  // A tree of pages that names itself in its /Kids (before: it never ended).
  await MAK.pdfTextRuns(latin(`%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [${'2 0 R '.repeat(10)}] >> endobj\n`));
  // A flood of numbers (no operator) that 40 pages read 10 times each: every value counts (before: minutes).
  const flood = '0 '.repeat(400000);
  const pages = Array.from({ length: 40 }, (_, k) => `${10 + k} 0 obj << /Type /Page /Contents [${'4 0 R '.repeat(10)}] >> endobj\n`).join('');
  await MAK.pdfTextRuns(latin(`%PDF-1.4\n${pages}4 0 obj << /Length ${flood.length} >>\nstream\n${flood}\nendstream endobj\n`));
  assert.ok(Date.now() - start < 3000, `${Date.now() - start} ms`);
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

test('libraryCalendar: "horario habitual", the days of an "aula" or of a color with two hours (not known), the year by the grid', async () => {
  const read = async (page, published) => MAK.libraryCalendar(await MAK.pdfTextRuns(F.canvaPdf([page])), published);
  // May 2024 without a year on the page (published in March), "horario habitual" in the legend, the "aula" on a weekend.
  const a = await read(F.month('mayo', 2024, 31, { yearText: '', usual: true, aula: [4, 5], green: [1] }), at(2024, 3, 19));
  assert.deepEqual([a.months[0].y, a.months[0].m], [2024, 4]);
  const usual = a.legend.findIndex((l) => l.usual);
  assert.deepEqual([a.months[0].days[0], a.months[0].days[1], a.months[0].days[3], a.months[0].days[10]], [a.legend.findIndex((l) => l.hours === '9:00–22:45'), usual, -2, a.legend.findIndex((l) => l.closed)]);
  const data = { page: { week: ARROSADIA_WEEK }, notices: [{ title: 'Exámenes', date: at(2024, 3, 19), cal: a, from: at(2024, 5, 1, 0), to: at(2024, 6, 1, 0) }] };
  assert.deepEqual([MAK.libraryDay(data, at(2024, 5, 2)), MAK.libraryDay(data, at(2024, 5, 4))], [{ hours: '8:00–21:00', closed: false, usual: true }, null], 'usual; an "aula": not known');
  // A year on the page that does not fit the grid ("curso 2025-2026" on January 2026): the year that puts the 1st on a Thursday.
  assert.equal((await read(F.month('enero', 2026, 31, { yearText: 'curso 2025-2026' }), at(2025, 3, 1))).months[0].y, 2026);
  // A color with two hours ("8:00 - 21:00" and "8:00 - 14:30"): its days are not known.
  assert.equal((await read(F.month('diciembre', 2025, 31, { twoHours: true }), at(2025, 10, 27))).months[0].days[1], -2);
  // The same with a ring (an image as Canva, or a line) on the left of "8:00 - 14:30" and around its days (Ciencias de la
  // Salud, 2025): the ringed days have those hours, the others the other ones.
  for (const ring of ['image', 'stroke']) {
    const c = MAK.libraryCalendar(await MAK.pdfContent(F.canvaPdf([F.month('diciembre', 2025, 31, { twoHours: true, rings: [23, 26], ring })])), at(2025, 10, 27));
    const hours = (d) => (c.legend[c.months[0].days[d - 1]] || {}).hours;
    assert.deepEqual([hours(22), hours(23), hours(26), hours(29)], ['8:00–21:00', '8:00–14:30', '8:00–14:30', '8:00–21:00'], ring);
  }
  assert.deepEqual(await MAK.pdfContent(new Uint8Array([1, 2, 3])), { runs: [], shapes: [] }, 'not a PDF file');
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
  // The period of the calendar: its days with other hours (18 April to 10 May), not its months, not the closed weekends.
  const exams = april.notices[0];
  assert.deepEqual([new Date(exams.from).toDateString(), new Date(exams.to).toDateString()], [new Date(2026, 3, 18).toDateString(), new Date(2026, 4, 11).toDateString()]);
  // Shown from 7 days before (11 April) to its last day (10 May).
  assert.deepEqual([[4, 10], [4, 11], [5, 10], [5, 11]].map(([m, d]) => MAK.visibleNotices(april, at(2026, m, d)).length), [0, 1, 1, 0]);
  assert.deepEqual(MAK.libraryToday(april, at(2026, 5, 16)), { hours: '', closed: true, usual: true }, 'after it: the usual hours (a Saturday)');
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
  assert.equal(MAK.libraryToday(salud, at(2026, 10, 24)), null, 'a Saturday: only the "aula de estudio"');
  assert.deepEqual(MAK.libraryToday(salud, at(2026, 10, 26)), { hours: '8:00–21:00', closed: false, usual: true });

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

  // The board does not answer: no day is known (a closing could be there), read again soon.
  const fail = (bad) => (url) => (bad(url) ? Promise.reject(new Error('503')) : getText(url));
  const noBoard = await MAK.loadLibrary({ campus: 'arrosadia', getText: fail((url) => url === MAK.LIBRARY_BOARD), getBytes, now: at(2026, 7, 8) });
  assert.deepEqual([noBoard.board, noBoard.partial, MAK.libraryToday(noBoard, at(2026, 7, 8))], [false, true, null]);
  // A notice that does not answer: its days by its title (or its season), not known; read again soon.
  const noNotice = await MAK.loadLibrary({ campus: 'arrosadia', getText: fail((url) => url.endsWith('contentId=289130')), getBytes, now: at(2026, 4, 15) });
  assert.deepEqual([noNotice.partial, noNotice.notices[0].rules, MAK.libraryToday(noNotice, at(2026, 4, 18)), MAK.libraryToday(noNotice, at(2026, 4, 15)).usual], [true, null, null, true]);
  // A list of the board that does not answer (the second page): read again soon, it may hide a notice.
  const noList = await MAK.loadLibrary({ campus: 'arrosadia', getText: fail((url) => url.includes('pagina=1')), getBytes, now: at(2026, 4, 15) });
  assert.deepEqual([noList.board, noList.partial], [true, true]);
  // A notice that the reader cannot read: left out, the other parts and notices stay; read again soon.
  const rules = MAK.noticeRules;
  MAK.noticeRules = () => { throw new RangeError('too many'); };
  const odd = await MAK.loadLibrary({ campus: 'arrosadia', getText, getBytes, now: at(2026, 4, 15) }).finally(() => { MAK.noticeRules = rules; });
  assert.deepEqual([odd.partial, !!odd.page, !!odd.sports], [true, true, true]);
  // A newer notice about the same days corrects the one before it; a notice only about other campuses is not shown.
  const B = 'https://www.unavarra.es/biblioteca/tablon-de-anuncios';
  const more = Object.assign(F.routes(), {
    [B]: F.list([
      F.entry('Lunes 20 de julio de 2026', 291000, 'Horario de verano: cambio'),
      F.entry('Domingo 19 de julio de 2026', 291001, 'Horario fines de semana de julio'),
      F.entry('Mi&eacute;rcoles 17 de junio de 2026', 290185, 'Horario de verano de las Bibliotecas: Arrosadia, Ciencias de la Salud y Tudela')
    ]),
    [`${B}?contentId=291000`]: F.notice('Lunes 20 de julio de 2026', 'Horario de verano: cambio', '<p>El 22 de julio la biblioteca de Arrosad&iacute;a abrir&aacute; de 9:00 a 13:00.</p>'),
    [`${B}?contentId=291001`]: F.notice('Domingo 19 de julio de 2026', 'Horario fines de semana de julio', '<p>Los d&iacute;as 25 y 26 de julio se abrir&aacute;n aulas en el Aulario de Arrosad&iacute;a y la Biblioteca de Tudela de 9.00 a 21.45.</p>')
  });
  const getMore = async (url) => {
    if (!(url in more)) throw new Error(`404 ${url}`);
    return String(more[url]);
  };
  const two = await MAK.loadLibrary({ campus: 'arrosadia', getText: getMore, getBytes, now: at(2026, 7, 21) });
  assert.equal(MAK.libraryToday(two, at(2026, 7, 22)).hours, '9:00–13:00', 'the newer notice');
  assert.equal(MAK.libraryToday(two, at(2026, 7, 23)).hours, '8:00–15:00', 'the summer');
  const salud2 = await MAK.loadLibrary({ campus: 'salud', getText: getMore, getBytes, now: at(2026, 7, 21) });
  assert.ok(!salud2.notices.some((n) => n.title === 'Horario fines de semana de julio'), 'only Arrosadía and Tudela');
});

test('noticeSummary: the days of a notice with other hours, in groups (the window of a new notice)', async () => {
  const routes = F.routes();
  const getText = async (url) => {
    if (!(url in routes)) throw new Error(`404 ${url}`);
    return String(routes[url]);
  };
  const load = (campus, now) => MAK.loadLibrary({ campus, getText, getBytes: async (url) => routes[url], now });
  const short = (data) => MAK.noticeSummary(data, data.notices[0]).map((g) => [g.form, g.value && (g.value.closed ? 'closed' : g.value.hours), new Date(g.days[0]).getDate(), new Date(g.days.at(-1)).getDate(), g.weekdays || null, !!g.extra]);
  // The summer: Monday to Friday; closed 6 to 10 July (a run); 13 and 14 July (a list). The weekends: as usual.
  assert.deepEqual(short(await load('arrosadia', at(2026, 6, 25))), [['week', '8:00–15:00', 1, 31, [1, 2, 3, 4, 5], false], ['run', 'closed', 6, 10, null, false], ['list', '9:00–13:00', 13, 14, null, false]]);
  // Tudela: closed 24 to 31 July, its weekend in it (closed anyway): one run.
  assert.deepEqual(short(await load('tudela', at(2026, 6, 25)))[1], ['run', 'closed', 24, 31, null, false]);
  // The exams: the weekends and a holiday.
  assert.deepEqual(short(await load('arrosadia', at(2026, 4, 15))), [['week', '9:00–22:45', 18, 10, [0, 6], true]]);
  // A notice without dates: nothing.
  const salud = await load('salud', at(2026, 10, 24));
  assert.deepEqual(MAK.noticeSummary(salud, salud.notices[0]), []);
});
