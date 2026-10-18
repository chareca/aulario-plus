// A course guide with the same structure as the public page of the UPNA (ficha-asignaturaDOA):
// the table of the data and the teachers, then sections with h3; "Evaluación" has text, the table
// of the assessment and more text. Synthetic names and values. Also used by tests/harness/make.js.
(function (root) {
  root.GUIDE_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Universidad Pública de Navarra</title></head><body>
<h2>Universidad Pública de Navarra</h2>
<table>
  <tr><td>Código: 240999</td><td>Asignatura: COMPUTER SCIENCE</td></tr>
  <tr><td>Créditos: 6</td><td>Tipo: Obligatoria</td><td>Curso: 2</td><td>Periodo: 1º S</td></tr>
  <tr><td>Departamento: Estadística, Informática y Matemáticas</td></tr>
  <tr><td>Profesorado:</td></tr>
  <tr><td><a href="/pdi?uid=1001">GARCÍA LÓPEZ, ANA (Resp)</a> <a href="/pdi?uid=1001&amp;tutorias=1">[Tutorías ]</a></td>
      <td><a href="/pdi?uid=1002">PÉREZ ARANA, JUAN</a> <a href="/pdi?uid=1002&amp;tutorias=1">[Tutorías ]</a></td></tr>
</table>
<h3>Metodología</h3>
<table><tr><th>ACTIVIDAD FORMATIVA</th><th>HORAS</th><th>PRESENCIALIDAD</th></tr><tr><td>Clases magistrales</td><td>30</td><td>100</td></tr></table>
<h3>Evaluación</h3>
<p></p>
<p>La evaluación es continua.</p>
<table>
  <tr><th>Resultados de aprendizaje</th><th>Actividad de evaluación</th><th>Peso (%)</th><th>Carácter recuperable</th><th>Nota mínima requerida</th></tr>
  <tr><td>R1, R2</td><td>Examen teórico-práctico</td><td>60%</td><td>Sí, en el examen de recuperación</td><td>5 sobre 10</td></tr>
  <tr><td>R3</td><td>Prácticas</td><td>30 %</td><td>No</td><td>No</td></tr>
  <tr><td>R4</td><td>Lab report 1</td><td>10%</td><td>No</td><td>No</td></tr>
</table>
<p>Si no obtienes un 5 en el examen, no se promedia con el resto.</p>
<h3>Temario</h3>
<p>Tema 1. Introducción.</p>
</body></html>`;
})(typeof window !== 'undefined' ? window : globalThis);
