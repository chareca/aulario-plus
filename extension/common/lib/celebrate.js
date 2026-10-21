// Aulario Plus: confetti after a submission (the setting "confetti"; no sound). After a submission MiAulario
// shows a page of confirmation: of a task (the tool Tareas) or of an exam (Exámenes, Samigo).
// MAK.submissionKind finds it in a page; MAK.celebrate fires confetti (vendor/canvas-confetti.js) from the
// bottom corners to the center: "Fireworks" for a task; "School Pride" and "Fireworks" for an exam (or for a
// task with "examen" in its title).
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  const words = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const lower = (s) => words(s).toLowerCase();
  // The titles of the page of confirmation of the tool Tareas (Sakai 23, assignment*.properties: es, eu, en).
  // A task that is only saved has its own title: no confetti.
  const SUBMITTED = ['confirmación de envío', 'bidalketaren berrespena', 'submission confirmation'];
  const SAVED = ['confirmación de envío guardado', 'gorde da zereginaren berrespena', 'saved assignment confirmation'];
  const EXAM = /\b(examen|exam|azterketa)/i;
  // A short key of a text (the confetti of a submission fires once).
  const hash = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };

  // The submission of this page: { kind: 'task' or 'exam', key, title }, or null.
  MAK.submissionKind = function (doc) {
    // Exámenes: the page "submitted.jsp" of Samigo, with the form "submittedForm".
    const sam = doc.querySelector('form[id$="submittedForm"]');
    if (sam) {
      const title = words((doc.querySelector('.page-header h1 small') || {}).textContent);
      return { kind: 'exam', key: `exam-${hash(words(sam.textContent))}`, title };
    }
    // Tareas: "chef_assignments_student_view_submission_confirmation.vm".
    const table = doc.querySelector('form[name="addSubmissionForm"] table.itemSummary');
    const head = doc.querySelector('.portletBody > h3');
    if (!table || !head || !doc.querySelector('.portletBody > .sak-banner-success')) return null;
    const text = lower(head.textContent);
    if (SAVED.some((t) => text.endsWith(t)) || !SUBMITTED.some((t) => text.endsWith(t))) return null;
    const id = table.querySelector('td.highlight');
    const row = id && id.closest('tr').previousElementSibling;
    const title = words(row && row.querySelector('td') ? row.querySelector('td').textContent : '');
    return { kind: EXAM.test(title) ? 'exam' : 'task', key: `task-${words(id ? id.textContent : '') || hash(words(table.textContent))}`, title };
  };

  const MS = 4000; // the time of the confetti
  const rand = (min, max) => Math.random() * (max - min) + min;
  // The colors of MiAulario (its blue and the blue of its focus), for "School Pride".
  const PRIDE = ['#0f4b70', '#75bfec'];

  // "Fireworks": bursts every 250 ms, fewer at the end, from the two bottom corners up to the center.
  function fireworks(fire, end) {
    const shoot = () => {
      const left = end - Date.now();
      if (left <= 0) return;
      const particleCount = Math.max(6, Math.round(45 * (left / MS)));
      const base = { particleCount, spread: 70, startVelocity: rand(50, 68), ticks: 90 };
      fire(Object.assign({}, base, { angle: rand(55, 70), origin: { x: rand(0, 0.08), y: 1 } }));
      fire(Object.assign({}, base, { angle: rand(110, 125), origin: { x: rand(0.92, 1), y: 1 } }));
      setTimeout(shoot, 250);
    };
    shoot();
  }

  // "School Pride": a rapid fire of the two colors, from the two bottom corners, at each frame.
  function schoolPride(fire, end, frame) {
    const shoot = () => {
      fire({ particleCount: 2, angle: 60, spread: 55, startVelocity: 58, origin: { x: 0, y: 1 }, colors: PRIDE });
      fire({ particleCount: 2, angle: 120, spread: 55, startVelocity: 58, origin: { x: 1, y: 1 }, colors: PRIDE });
      if (Date.now() < end) frame(shoot);
    };
    shoot();
  }

  // Fire the confetti of a submission in doc, on a canvas over all the page that the mouse does not see.
  // create: confetti.create of canvas-confetti. With reduced motion, nothing moves (the library).
  MAK.celebrate = function (kind, create, doc) {
    const canvas = doc.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2147483646;';
    (doc.body || doc.documentElement).append(canvas);
    const fire = create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true });
    const end = Date.now() + MS;
    fireworks(fire, end);
    if (kind === 'exam') schoolPride(fire, end, (f) => (doc.defaultView || root).requestAnimationFrame(f));
    setTimeout(() => {
      fire.reset();
      canvas.remove();
    }, MS + 3000);
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
