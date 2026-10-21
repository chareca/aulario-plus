// The confetti after a submission (lib/celebrate.js): the pages of confirmation of Sakai 23 (the templates
// chef_assignments_student_view_submission_confirmation.vm and samigo submitted.jsp), and the fire.
(function () {
  'use strict';

  // The page of confirmation of the tool Tareas. h3: its title; rows: [label, value] of the table.
  const taskPage = (h3, banner, rows) => parse(`<div class="portletBody">
    <h3>
            ${h3}
    </h3>
    <div class="sak-banner-success">${banner}</div>
    <form name="addSubmissionForm" action="#" method="post" onsubmit="return true;">
      <table class="itemSummary" border="0" cellspacing="0">
        ${rows.map(([th, td, cls]) => `<tr><th>${th}</th><td${cls ? ` class="${cls}"` : ''}>${td}</td></tr>`).join('\n')}
      </table>
    </form>
  </div>`);
  const ROWS = (title) => [
    ['Usuario', 'Nicolas Chareca (nchareca)'],
    ['Sitio de clase', 'Informática y Programación'],
    ['Título', `${title} <span class="fa fa-file"></span>`],
    ['Identificador del envío', '\n 9f1c2a7e-4b2d \n', 'highlight'],
    ['Hora de envío', '21 oct 2026 10:12']
  ];

  test('a submitted task: Fireworks, once for its submission id', () => {
    const doc = taskPage('Confirmación de envío', 'Se ha enviado su trabajo con éxito.', ROWS('Práctica 3'));
    assert.deepEqual(MAK.submissionKind(doc), { kind: 'task', key: 'task-9f1c2a7e-4b2d', title: 'Práctica 3' });
    const group = taskPage('Grupo\n            Confirmación de envío', 'Se ha enviado su trabajo con éxito.', ROWS('Trabajo en grupo'));
    assert.equal(MAK.submissionKind(group).kind, 'task', 'a group task');
    const eu = taskPage('Bidalketaren berrespena', 'Zure zeregina behar bezala bidali duzu.', ROWS('Praktika'));
    assert.equal(MAK.submissionKind(eu).kind, 'task', 'in Basque');
    const other = taskPage('Confirmación del envío de la tarea', 'Se ha enviado su trabajo con éxito.', ROWS('Práctica 4'));
    assert.equal(MAK.submissionKind(other).kind, 'task', 'another title: the banner says "enviado"');
  });

  test('a task that is only saved, or another page: no confetti', () => {
    assert.equal(MAK.submissionKind(taskPage('Confirmación de envío guardado', 'Se ha guardado su trabajo con éxito', ROWS('Práctica 3'))), null);
    assert.equal(MAK.submissionKind(taskPage('Saved Assignment Confirmation', 'You have successfully saved your work but NOT submitted yet.', ROWS('Lab 3'))), null);
    assert.equal(MAK.submissionKind(taskPage('Confirmación del borrador', 'Se ha guardado su trabajo con éxito', ROWS('Práctica 4'))), null, 'another title, the banner says "guardado"');
    assert.equal(MAK.submissionKind(parse('<div class="portletBody"><h3>Tareas</h3><form name="addSubmissionForm"></form></div>')), null);
    assert.equal(MAK.submissionKind(parse('<main><h1>Mi sitio</h1></main>')), null);
  });

  test('an exam: the page "submitted" of Exámenes, and a task with "examen" in its title', () => {
    const sam = parse(`<div class="portletBody container-fluid"><div style=""><div class="page-header"><h1>Envío <small>Examen parcial 1 </small></h1></div>
      <form id="submittedForm" method="post" action="/samigo-app/jsf/delivery/submitted.faces"><div class="table">Has completado la evaluación.
      <table class="table table-striped"><tr><td><label>Número de confirmación</label></td><td>1123-445</td></tr></table></div></form></div></div>`);
    const exam = MAK.submissionKind(sam);
    assert.equal(exam.kind, 'exam');
    assert.equal(exam.title, 'Examen parcial 1');
    assert.ok(/^exam-[0-9a-z]+$/.test(exam.key), exam.key);
    assert.equal(MAK.submissionKind(taskPage('Confirmación de envío', 'Se ha enviado su trabajo con éxito.', ROWS('Examen final de prácticas'))).kind, 'exam');
  });

  test('the fire: a canvas over the page that the mouse does not see; from the bottom corners; School Pride only for an exam', async () => {
    const calls = { task: [], exam: [] };
    const fake = (list) => (canvas, opts) => {
      list.opts = opts;
      list.canvas = canvas;
      const fire = (o) => list.push(o);
      fire.reset = () => {};
      return fire;
    };
    MAK.celebrate('task', fake(calls.task), document);
    MAK.celebrate('exam', fake(calls.exam), document);
    await new Promise((r) => setTimeout(r, 300));
    const c = calls.task.canvas;
    assert.ok(c.isConnected, 'in the page');
    assert.equal(getComputedStyle(c).pointerEvents, 'none');
    assert.equal(getComputedStyle(c).position, 'fixed');
    assert.equal(c.getAttribute('aria-hidden'), 'true');
    assert.deepEqual([calls.task.opts.useWorker, calls.task.opts.disableForReducedMotion], [false, true], 'no worker; nothing with reduced motion');
    assert.ok(calls.task.length >= 2 && calls.task.every((o) => o.origin.y === 1 && (o.origin.x <= 0.08 || o.origin.x >= 0.92)), 'the bottom corners');
    assert.ok(calls.task.every((o) => !o.colors), 'a task: Fireworks only');
    assert.ok(calls.exam.some((o) => o.colors) && calls.exam.some((o) => !o.colors), 'an exam: School Pride and Fireworks');
    c.remove();
    calls.exam.canvas.remove();
  });
})();
