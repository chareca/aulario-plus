// The degree of the user: the list of degrees and the page "Evaluación" (fixtures-degree.js).
(function () {
  'use strict';
  const BASE = 'https://www.unavarra.es/sites/grados';

  test('degree list: the degrees with their base address, once; not the areas or other sites', () => {
    const list = MAK.parseDegreeList(parse(DEGREE_LIST_HTML));
    assert.deepEqual(list.map((d) => d.base), [
      `${BASE}/informatica-y-telecomunicacion/ingenieria-informatica`,
      `${BASE}/informatica-y-telecomunicacion/internacional-informatica`,
      `${BASE}/juridicas/derecho`,
      `${BASE}/economia-y-empresa/doble-ade-derecho`,
      `${BASE}/industriales/grado-dual-ingenieria-termica`
    ]);
    assert.equal(MAK.matchDegree('Ingeniería Informática', list).base, `${BASE}/informatica-y-telecomunicacion/ingenieria-informatica`, 'the degree, not the international program');
    assert.equal(MAK.matchDegree('INGENIERIA INFORMATICA', list).base, `${BASE}/informatica-y-telecomunicacion/ingenieria-informatica`, 'no accents, no case');
    assert.equal(MAK.matchDegree('Ingeniería Térmica', list).base, `${BASE}/industriales/grado-dual-ingenieria-termica`, '"Grado dual en"');
    assert.equal(MAK.matchDegree('Administración y Dirección de Empresas', list).base, `${BASE}/economia-y-empresa/doble-ade-derecho`, 'else a degree that contains the name');
    assert.equal(MAK.matchDegree('Medicina', list), null);
    assert.equal(MAK.matchDegree('', list), null);
  });

  test('evaluation page (Informática): the periods of each semester and the PDF of each semester', () => {
    const e = MAK.parseEvaluation(parse(EVALUATION_INF_HTML));
    assert.deepEqual(e.periods, [
      { season: 'autumn', finals: 'del 15 al 22 de diciembre y del 7 al 11 de enero', recovery: 'del 15 al 23 de enero' },
      { season: 'spring', finals: 'del 17 de mayo al 28 de mayo', recovery: 'del 7 al 15 de junio' }
    ]);
    assert.deepEqual(e.pdfs.map((p) => [p.text, p.season]), [['Exámenes Otoño', 'autumn'], ['Exámenes Primavera', 'spring']], 'not the rules, the questions or the guidelines');
    assert.equal(e.pdfs[0].url, 'https://www2.unavarra.es/gesadj/CyD1/ETSIIT/Examenes/Grados/Otono/999_otono.pdf');
  });

  test('evaluation page (Derecho): "evaluación ordinaria" and the season of a link from its section', () => {
    const e = MAK.parseEvaluation(parse(EVALUATION_LAW_HTML));
    assert.deepEqual(e.periods.map((p) => [p.season, p.finals, p.recovery]), [
      ['autumn', 'del 12 de diciembre de 2026 al 11 de enero de 2027 (excepto periodo vacaciones)', 'del 15 al 23 de enero de 2027'],
      ['spring', 'del 15 al 29 de mayo de 2027', 'del 5 al 15 de junio de 2027']
    ]);
    assert.deepEqual(e.pdfs.map((p) => [p.text, p.season]), [['Exámenes 2026/2027', 'autumn'], ['Exámenes 2026/2027', 'spring']]);
    assert.ok(e.pdfs[0].url.endsWith('999_examenes%20otono_26-27.pdf'));
  });

  test('evaluation page (Medicina): no periods, the PDF files once', () => {
    const e = MAK.parseEvaluation(parse(EVALUATION_MED_HTML));
    assert.deepEqual(e.periods, []);
    assert.deepEqual(e.pdfs.map((p) => p.text), ['Evaluación ordinaria Curso 2026-2027', 'Evaluación extraordinaria Curso 2026-2027']);
  });

  test('a page that is not an evaluation page gives nothing', () => {
    assert.deepEqual(MAK.parseEvaluation(parse('<html><body><h1>Not found</h1></body></html>')), { periods: [], pdfs: [] });
  });
})();
