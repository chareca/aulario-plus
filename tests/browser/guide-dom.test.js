// The course guide: read the public page of the UPNA (fixtures-guide.js has the same structure).
(function () {
  'use strict';
  const URL_OK = 'https://www.unavarra.es/ficha-asignaturaDOA/?languageId=100000&codPlan=240&codAsig=240999&anio=2026';

  test('guide: the data, the teachers and the assessment table with its notes', () => {
    const g = MAK.parseGuide(parse(GUIDE_HTML), URL_OK);
    assert.equal(g.url, URL_OK);
    assert.equal(g.code, '240999');
    assert.equal(g.name, 'COMPUTER SCIENCE');
    assert.equal(g.credits, '6');
    assert.equal(g.period, '1º S');
    assert.equal(g.degree, 'Graduado o Graduada en Computer Science por la Universidad Pública de Navarra');
    assert.equal(MAK.degreeName(g.degree), 'Computer Science');
    assert.deepEqual(g.teachers.map((t) => [t.name, t.resp, !!t.tutorias]), [['GARCÍA LÓPEZ, ANA', true, true], ['PÉREZ ARANA, JUAN', false, true]]);
    assert.ok(g.teachers[0].tutorias.startsWith('https://www.unavarra.es/pdi?uid=1001'));
    assert.deepEqual(g.evaluation.rows.map((r) => [r.activity, r.weight, r.minimum]), [['Examen teórico-práctico', 60, '5 sobre 10'], ['Prácticas', 30, 'No'], ['Lab report 1', 10, 'No']]);
    assert.equal(g.evaluation.rows[0].recoverable, 'Sí, en el examen de recuperación');
    assert.deepEqual(g.evaluation.notes, ['La evaluación es continua.', 'Si no obtienes un 5 en el examen, no se promedia con el resto.'], 'the text of the section, not the methodology table, not the link "Subir"');
    assert.deepEqual(MAK.cleanGuide(g), g, 'the stored form is the same');
  });

  test('guide: a page that is not a guide gives null; a guide without the table gives no rows', () => {
    assert.equal(MAK.parseGuide(parse('<html><body><h1>Forbidden</h1></body></html>'), URL_OK), null);
    const noTable = GUIDE_HTML.replace(/<h3>Evaluación<\/h3>[\s\S]*<h3>Temario<\/h3>/, '<h3>Evaluación</h3><p>Examen final: 100 %.</p><h3>Temario</h3>');
    const g = MAK.parseGuide(parse(noTable), URL_OK);
    assert.deepEqual(g.evaluation.rows, []);
    assert.deepEqual(g.evaluation.notes, ['Examen final: 100 %.']);
  });
})();
