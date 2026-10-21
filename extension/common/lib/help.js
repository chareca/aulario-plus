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
  // update to a version of this list. "{key}": the keys of the search of the system (MAK.searchKey).
  MAK.CHANGES = [
    {
      version: '1.6.5',
      es: [
        'El popup abre en un menú de inicio: tu sesión con un botón para pausarla, los avisos y el modo claro u oscuro en un clic, y lo que tienes pendiente.',
        'Confeti al entregar una tarea o un examen, sin sonido. Se apaga en Ajustes.',
        'En los Recursos de Mi sitio: descarga todos tus archivos en un ZIP o envíalos todos a la Papelera, siempre con confirmación.',
        'El buscador da prioridad a las iniciales: «ip» encuentra primero Informática y Programación.',
        'Las ayudas muestran el atajo de tu sistema: {key}.'
      ],
      en: [
        'The popup opens on a main menu: your session with a button to pause it, the reminders and the light or dark mode in one click, and what you have to do.',
        'Confetti when you submit a task or an exam, with no sound. You can set it to off in the settings.',
        'In the Resources of Mi sitio: download all your files in one ZIP, or send all of them to the trash, always with a confirmation.',
        'The search gives priority to the initials: "ip" finds Informática y Programación first.',
        'The help shows the shortcut of your system: {key}.'
      ]
    },
    {
      version: '1.6.4',
      es: [
        'Seis temas para elegir en Ajustes: MiAulario (el de siempre, igual que MiAulario), Cómic, Malvavisco, Aurora, AulaXP y Folio. Cada uno en claro y en oscuro, o como MiAulario.',
        'El triángulo de la esquina del bloque de Mi sitio lo pone a todo el ancho, con el calendario debajo.',
        'Mi sitio muestra tu próximo examen en grande, y los accesos a tu expediente, Wuolah y el correo interno en una fila.',
        '{key} busca también en los «Contenidos» de las materias: títulos y enlaces a PDF.',
        'Avisos antes de una entrega que no entregaste: 24 horas y 1 hora antes, configurables en Ajustes.',
        'Calculadora de notas en cada guía docente: te dice qué necesitas para aprobar, toma tus notas del Libro de evaluación y guarda las tuyas.',
        'Tus exámenes finales muestran la nota que te falta en cada uno, con los datos de la calculadora.',
        'Las tareas corregidas muestran la nota, el comentario del profesor y los archivos de la corrección.',
        'Mi sitio separa los exámenes y las guías por semestre; desde el 25 de enero desaparece el primero.',
        'Una tarea no se da por entregada al aceptar la cláusula de veracidad.',
        'Al cerrar sesión o al entrar otro usuario se borra también lo que escribiste: las notas y los pesos de la calculadora, los objetivos y la dirección de reenvío.',
        'Bienvenida, esta página de novedades, y en Ajustes: reportar un problema e invitarme a un café.'
      ],
      en: [
        'Six themes to select in the settings: MiAulario (the default, the same as MiAulario), Comic, Marshmallow, Aurora, AulaXP and Folio. Each one in light and in dark, or as MiAulario.',
        'The triangle in the corner of the block of Mi sitio gives it the full width, with the calendar below it.',
        'Mi sitio shows your next exam in large, and the links to your academic record, Wuolah and the internal mail in one row.',
        '{key} also searches the "Contenidos" of the sites: titles and links to PDF files.',
        'Reminders before a delivery that you did not submit: 24 hours and 1 hour before, in the settings.',
        'A grade calculator in each course guide: it tells you what you need to pass, takes your grades from the gradebook and keeps yours.',
        'Your final exams show the grade that you need in each of them, with the data of the calculator.',
        'The returned tasks show the grade, the comment of the teacher and the files of the correction.',
        'Mi sitio shows the exams and the guides by semester; from 25 January the first one goes away.',
        'A task is not "submitted" when you accept its honor pledge.',
        'When you log out or another user logs in, the extension also removes what you wrote: the grades and the weights of the calculator, the targets and the forward address.',
        'A welcome page, this page of changes, and in the settings: report a problem and buy me a coffee.'
      ]
    }
  ];
  MAK.changesOf = (version) => MAK.CHANGES.find((c) => c.version === version) || null;

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
