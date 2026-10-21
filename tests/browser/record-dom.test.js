// The Expediente of SIGMA (lib/record.js): the table "Expediente completo", the credits, the link of
// MiUPNA to SIGMA and the link of the menu. The pages have the structure of the real ones (2026).
(function () {
  'use strict';

  const HEAD = ['', 'Año académ.', 'Código', 'Descripción', 'Cr.', 'Gr.', 'Convocatoria', 'Descripción convocatoria', 'Calificación', 'C.N.', 'Cvl.', 'Tipo Asig.', 'Cic.', 'Cur.', 'Observaciones', 'Sem.'];
  const tr = (cells) => `<tr>${cells.map((c) => `<td> ${c} </td>`).join('')}</tr>`;
  const SIGMA_PAGE = `<div class="menu"><a href="Controlador/?apl=EXPS&amp;idNav=menu&amp;logica=anual">Año actual</a>
    <a href="?apl=EXPS&amp;idNav=menu&amp;logica=completo">Expediente completo</a><a href="https://evil.example/x">Expediente completo</a></div>
    <table id="sortableTable0"><tr><td>x.x</td><td>1</td></tr><tr><td>y.y</td><td>2</td></tr></table>
    <table id="table1" class="taulainformativa"><thead><tr>${HEAD.map((h) => `<th><a href="Controlador/?k=1">${h}</a></th>`).join('')}</tr></thead><tbody>
    ${tr(['', '2025/26-1', '240101', '1 Matemáticas I', '6.0', '1', 'Enero', '1', 'NOTABLE', '7,5', 'N', 'Básica', '1', '1', 'Asig. superada', '1'])}
    ${tr(['', '2026/27-1', '240401', 'Procesadores del Lenguaje', '6.0', '1', 'Enero', '1', '', '', 'N', 'Obligatoria', '1', '4', 'Asig. matriculada', '1'])}
    ${tr(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])}
    </tbody></table>
    <table id="sortableTable3" class="taulainformativa"><tr><th>Créditos</th><th>Superados</th><th>Matriculados y No superados</th><th>Créditos mínimos</th></tr>
    ${tr(['Formación básica', '60,0', '0,0', '60,0'])}${tr(['Obligatoria', '96,0', '12,0', '120,0'])}</table>`;

  test('the table "Expediente completo": the rows with a code, the grade in words and in numbers, the credits', () => {
    const doc = new DOMParser().parseFromString(`<base href="https://academicos.unavarra.es/exps-war/">${SIGMA_PAGE}`, 'text/html');
    const r = MAK.parseRecord(doc);
    assert.equal(r.rows.length, 2, 'not the empty row');
    assert.deepEqual(r.rows[0], { year: '2025/26-1', code: '240101', name: '1 Matemáticas I', credits: 6, group: '1', call: 'Enero', callText: '1', grade: 'NOTABLE', mark: 7.5,
      kind: 'Básica', course: '1', term: '1', notes: 'Asig. superada' });
    assert.deepEqual([r.rows[1].grade, r.rows[1].mark], ['', null], 'no grade yet');
    assert.deepEqual(r.credits, [{ kind: 'Formación básica', passed: 60, pending: 0, min: 60 }, { kind: 'Obligatoria', passed: 96, pending: 12, min: 120 }]);
    assert.equal(MAK.parseRecord(parse('<table id="table1"><tr><th>Otra</th></tr><tr><td>1</td></tr></table>')), null, 'another table');
    assert.equal(MAK.parseRecord(parse('<p>Sesión expirada</p>')), null);
  });

  test('the way: the link of MiUPNA to the Expediente (only SIGMA), and "Expediente completo" in the menu of SIGMA', () => {
    const portal = new DOMParser().parseFromString(`<base href="https://portal.unavarra.es/group/estudiantes/servicios-sigma">
      <div onclick="parent.open('https://academicos.unavarra.es/cosmos/Controlador/?apl=Uninavs&amp;idNav=abc&amp;aplDestino=CERS&amp;sso-cg=1')">Certificado</div>
      <div onclick="parent.open('https://evil.example/?aplDestino=EXPS')">Otro</div>
      <div onclick="parent.open('https://academicos.unavarra.es/cosmos/Controlador/?apl=Uninavs&amp;idNav=abc&amp;aplDestino=EXPS&amp;gu=A&amp;sso-cg=zz')"><h1>Consulta tu Expediente</h1></div>`, 'text/html');
    assert.equal(MAK.recordEntry(portal), 'https://academicos.unavarra.es/cosmos/Controlador/?apl=Uninavs&idNav=abc&aplDestino=EXPS&gu=A&sso-cg=zz');
    assert.equal(MAK.recordEntry(parse('<div>Nada</div>')), null);
    const sigma = new DOMParser().parseFromString(`<base href="https://academicos.unavarra.es/exps-war/Controlador/">${SIGMA_PAGE}`, 'text/html');
    assert.equal(MAK.recordMenuLink(sigma), 'https://academicos.unavarra.es/exps-war/Controlador/?apl=EXPS&idNav=menu&logica=completo');
  });
})();
