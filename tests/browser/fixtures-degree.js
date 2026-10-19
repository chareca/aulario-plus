// The public pages of the degrees of the UPNA, with the same structure as the real pages:
// the list of degrees (sites/grados/home.html) and the page "Evaluación" of three faculties.
// Synthetic text. Also used by tests/harness/make.js.
(function (root) {
  root.DEGREE_LIST_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Grados</title></head><body>
<ul>
  <li><a href="/sites/grados/asignaturas-sostenibilidad.html">Asignaturas de sostenibilidad</a></li>
  <li><a href="/sites/grados/informatica-y-telecomunicacion.html">Informática y Telecomunicación</a></li>
  <li><a href="/sites/grados/informatica-y-telecomunicacion/ingenieria-informatica.html">Grado en Ingeniería Informática</a></li>
  <li><a href="/sites/grados/informatica-y-telecomunicacion/internacional-informatica.html">Programa Internacional del Grado en Ingeniería Informática</a></li>
  <li><a href="/sites/grados/juridicas/derecho.html">Grado en Derecho</a></li>
  <li><a href="/sites/grados/economia-y-empresa/doble-ade-derecho.html">Doble grado Administración y Dirección de Empresas + Derecho</a></li>
  <li><a href="/sites/grados/economia-y-empresa/doble-ade-derecho/presentacion.html">Doble grado Administración y Dirección de Empresas + Derecho</a></li>
  <li><a href="/sites/grados/industriales/grado-dual-ingenieria-termica.html">Grado dual en Ingeniería Térmica</a></li>
  <li><a href="https://example.org/sites/grados/x/y.html">Grado en Otra Cosa</a></li>
</ul></body></html>`;

  const page = (sections) => `<!doctype html><html><head><meta charset="utf-8"><title>Evaluación</title></head><body>
<nav><ul><li><a href="/sites/grados/x/y/plan-de-estudios.html">Plan de estudios</a></li></ul></nav>
<div class="-list">${sections}</div></body></html>`;

  // Informática (ETSIIIT): a list with the periods, and one PDF link for each semester.
  root.EVALUATION_INF_HTML = page(`
<section id="opcion1"><header class="-my-4"><h3><strong>Evaluación de Otoño</strong></h3></header><p class="-mb-4"> </p>
<h3>Curso 2026-2027</h3>
<ul><li>Periodo de ex&aacute;menes finales: del 15 al 22 de diciembre y del 7 al 11 de enero</li><li>Periodo de recuperaci&oacute;n: del 15 al 23 de enero.</li></ul>
<p><a href="https://www2.unavarra.es/gesadj/CyD1/ETSIIT/Examenes/Grados/Otono/999_otono.pdf">Ex&aacute;menes Oto&ntilde;o</a></p>
<p><a href="https://www2.unavarra.es/gesadj/seccionNormativa/texto_consolidado_normativa_evaluacion.pdf">Normativa de evaluaci&oacute;n de los estudios de grado</a>&nbsp;- <a href="http://www2.unavarra.es/gesadj/Estudios/informacion/preguntas-frecuentes_evaluacion.pdf">Preguntas frecuentes</a></p>
</section><section id="opcion2"><header class="-my-4"><h3><strong>Evaluación de Primavera</strong></h3></header><p class="-mb-4"> </p>
<h3>Curso 2026-2027</h3>
<ul><li>Periodo de ex&aacute;menes finales: del 17&nbsp;de mayo al 28&nbsp;de mayo.</li><li>Periodo de recuperaci&oacute;n: del 7&nbsp;al 15&nbsp;de junio.</li></ul>
<p><a href="https://www2.unavarra.es/gesadj/CyD1/ETSIIT/Examenes/Grados/Primavera/999_Primavera.pdf">Ex&aacute;menes Primavera</a></p>
<p><a href="https://www2.unavarra.es/gesadj/CyD1/ETSIIT/Examenes/FRAUDE_ACADEMICO/Directrices.pdf">Directrices para la realizaci&oacute;n de pruebas de evaluaci&oacute;n</a></p>
</section>`);

  // Derecho: "evaluación ordinaria / de recuperación", and the same link text in both semesters.
  root.EVALUATION_LAW_HTML = page(`
<section id="opcion1"><header class="-my-4"><h3><strong>Evaluación de Otoño</strong></h3></header>
<ul><li>Periodo de evaluaci&oacute;n ordinaria: del 12&nbsp;de diciembre de 2026&nbsp;&nbsp;al 11&nbsp;de enero de 2027&nbsp;(excepto periodo vacaciones)</li>
<li>Periodo de evaluaci&oacute;n de recuperaci&oacute;n:&nbsp;del 15&nbsp;al 23&nbsp;de enero de 2027</li>
<li><a href="https://www2.unavarra.es/gesadj/seccionNormativa/texto_consolidado_normativa_evaluacion.pdf">Normativa de evaluaci&oacute;n de los estudios de Grado</a>&nbsp;- Preguntas frecuentes: <a href="https://www2.unavarra.es/gesadj/Estudios/informacion/preguntas-frecuentes_evaluacion.pdf">castellano</a></li>
<li><a href="https://www2.unavarra.es/gesadj/CyD3/Fac_Ciencias_Juridicas/Examenes/999_examenes%20otono_26-27.pdf">Ex&aacute;menes 2026/2027&nbsp;</a>(JF 22/06/2026)</li>
<li>Ex&aacute;menes Oto&ntilde;o (con asignaci&oacute;n de aulas)</li></ul>
</section><section id="opcion2"><header class="-my-4"><h3><strong>Evaluación de Primavera</strong></h3></header>
<ul><li>Periodo de evaluaci&oacute;n ordinaria: del 15&nbsp;al 29&nbsp;de mayo&nbsp;de 2027</li>
<li>Periodo de evaluaci&oacute;n de recuperaci&oacute;n: del 5&nbsp;al 15&nbsp;de junio de 2027</li>
<li><a href="https://www2.unavarra.es/gesadj/CyD3/Fac_Ciencias_Juridicas/Examenes/999_examenes%20primavera_26-27.pdf">Ex&aacute;menes 2026/2027&nbsp;</a>(JF 22/06/2026)</li></ul>
</section>`);

  // Medicina: no periods, two PDF files that are the same in both semesters.
  root.EVALUATION_MED_HTML = page(`
<section id="opcion1"><header class="-my-4"><h3><strong>Evaluación de Otoño</strong></h3></header>
<ul><li><a href="https://www2.unavarra.es/gesadj/CyD6/evaluacion/medicina/evaluacionordinaria.pdf">Evaluaci&oacute;n ordinaria Curso 2026-2027</a></li>
<li><a href="https://www2.unavarra.es/gesadj/CyD6/evaluacion/medicina/evaluacionextraordinaria.pdf">Evaluaci&oacute;n extraordinaria Curso 2026-2027</a></li></ul>
</section><section id="opcion2"><header class="-my-4"><h3><strong>Evaluación de Primavera</strong></h3></header>
<ul><li><a href="https://www2.unavarra.es/gesadj/CyD6/evaluacion/medicina/evaluacionordinaria.pdf">Evaluaci&oacute;n ordinaria Curso 2026-2027</a></li></ul>
</section>`);
})(typeof window !== 'undefined' ? window : globalThis);
