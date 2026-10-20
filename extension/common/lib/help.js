// Aulario Plus: help and support. The links of the project (the code, the issues, the donations),
// an issue on GitHub with the version and the browser, and the list of the changes of each version
// for the page "What's new" (tools.html?news) and the notice of the popup after an update.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  MAK.REPO_URL = 'https://github.com/chareca/aulario-plus';
  MAK.COFFEE_URL = 'https://buymeacoffee.com/chareca';
  MAK.PRIVACY_URL = `${MAK.REPO_URL}/blob/main/PRIVACY.md`;

  // The browser and the system from the user agent: "Edge 142 · Windows". No other data.
  MAK.browserName = function (ua, brave) {
    const s = String(ua || '');
    const v = (re) => (re.exec(s) || [])[1] || '';
    let name;
    if (/Firefox\//.test(s)) name = `Firefox ${v(/Firefox\/(\d+)/)}`;
    else if (/Edg\//.test(s)) name = `Edge ${v(/Edg\/(\d+)/)}`;
    else if (/OPR\//.test(s)) name = `Opera ${v(/OPR\/(\d+)/)}`;
    else if (/Vivaldi\//.test(s)) name = `Vivaldi ${v(/Vivaldi\/(\d+)/)}`;
    else if (/Chrome\//.test(s)) name = `${brave ? 'Brave' : 'Chrome'} ${v(/Chrome\/(\d+)/)}`;
    else name = 'unknown browser';
    const os = /Windows/.test(s) ? 'Windows' : /Mac OS X|Macintosh/.test(s) ? 'macOS' : /CrOS/.test(s) ? 'ChromeOS' : /Android/.test(s) ? 'Android' : /Linux/.test(s) ? 'Linux' : '';
    return [name.trim(), os].filter(Boolean).join(' · ');
  };

  // A new issue on GitHub: kind "bug" (a problem) or "idea". The text has the version, the browser
  // and the language; no data of MiAulario.
  MAK.issueUrl = function ({ kind, version, browser, lang }) {
    const bug = kind === 'bug';
    const body = bug
      ? [MAK.t('issue.bugWhat'), '', '', MAK.t('issue.bugExpected'), '', '', MAK.t('issue.bugSteps'), '1. ', '']
      : [MAK.t('issue.ideaWhat'), '', '', MAK.t('issue.ideaWhy'), '', ''];
    body.push('---', `Aulario Plus ${version || '?'} · ${browser || '?'} · ${lang || 'es'}`);
    const q = new URLSearchParams({ labels: bug ? 'bug' : 'enhancement', title: bug ? MAK.t('issue.bugTitle') : MAK.t('issue.ideaTitle'), body: body.join('\n') });
    return `${MAK.REPO_URL}/issues/new?${q}`;
  };

  // The changes of each version, the newest first (es and en). The popup shows a notice after an
  // update to a version of this list.
  MAK.CHANGES = [
    {
      version: '1.6.4',
      es: [
        'Cinco temas para elegir en Ajustes: Bloques, Plastilina, Etérea, Cromo XP y Cuaderno. Cada uno en claro y en oscuro, o como MiAulario.',
        'El triángulo de la esquina del bloque de Mi sitio lo pone a todo el ancho, con el calendario debajo.',
        'Mi sitio muestra tu próximo examen en grande, y los accesos a tu expediente, Wuolah y el correo interno en una fila.',
        'Ctrl+K (⌘K en Mac) busca también en los «Contenidos» de las materias: títulos y enlaces a PDF.',
        'Avisos antes de una entrega que no entregaste: 24 horas y 1 hora antes, configurables en Ajustes.',
        'Calculadora de notas en cada guía docente: te dice qué necesitas para aprobar, toma tus notas del Libro de evaluación y guarda las tuyas.',
        'Tus exámenes finales muestran la nota que te falta en cada uno, con los datos de la calculadora.',
        'Las tareas corregidas muestran la nota, el comentario del profesor y los archivos de la corrección.',
        'Mi sitio separa los exámenes y las guías por semestre; desde el 25 de enero desaparece el primero.',
        'Una tarea no se da por entregada al aceptar la cláusula de veracidad.',
        'Bienvenida, esta página de novedades, y en Ajustes: reportar un problema e invitarme a un café.'
      ],
      en: [
        'Five themes to select in the settings: Blocks, Clay, Ethereal, Chrome XP and Notebook. Each one in light and in dark, or as MiAulario.',
        'The triangle in the corner of the block of Mi sitio gives it the full width, with the calendar below it.',
        'Mi sitio shows your next exam in large, and the links to your academic record, Wuolah and the internal mail in one row.',
        'Ctrl+K (⌘K on Mac) also searches the "Contenidos" of the sites: titles and links to PDF files.',
        'Reminders before a delivery that you did not submit: 24 hours and 1 hour before, in the settings.',
        'A grade calculator in each course guide: it tells you what you need to pass, takes your grades from the gradebook and keeps yours.',
        'Your final exams show the grade that you need in each of them, with the data of the calculator.',
        'The returned tasks show the grade, the comment of the teacher and the files of the correction.',
        'Mi sitio shows the exams and the guides by semester; from 25 January the first one goes away.',
        'A task is not "submitted" when you accept its honor pledge.',
        'A welcome page, this page of changes, and in the settings: report a problem and buy me a coffee.'
      ]
    }
  ];
  MAK.changesOf = (version) => MAK.CHANGES.find((c) => c.version === version) || null;

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
