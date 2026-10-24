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
  // update to a version of this list. "{key}": the keys of the search of the system (MAK.searchKey). "short": the
  // news in one line, for the window over MiAulario after the update (each new version needs it).
  MAK.CHANGES = [
    {
      version: '1.6.8',
      short: {
        es: 'Nuevo en Mi sitio: «Horarios» (biblioteca con sus horarios especiales, gimnasio, piscina y cafetería) y tus secciones en el orden que quieras.',
        en: 'New in Mi sitio: "Hours" (the library with its special hours, the gym, the pool and the cafeteria) and your sections in the order you like.'
      },
      es: [
        'Mi sitio tiene una sección nueva, «Horarios», cerrada al empezar: una tarjeta para la biblioteca de tu campus (el horario de hoy, el habitual y los avisos de su tablón con horarios especiales de exámenes, verano o Semana Santa, con su calendario en colores), otra para las instalaciones deportivas y el gimnasio, otra para la piscina y otra para las cafeterías y el comedor de tu campus (con su horario de curso, de vacaciones y de fin de semana). Cada tarjeta dice si está abierto ahora y hasta qué hora, o cuándo abre, y la cabecera enseña el horario de hoy de todas. Elige el campus de la biblioteca (Arrosadía, Ciencias de la Salud o Tudela) en Ajustes → Biblioteca.',
        'En Mi sitio, «Guías docentes» y «Horarios» tienen su propio recuadro, como «Exámenes finales».',
        'Cuando la biblioteca publica un horario especial, una ventana te lo cuenta en una línea una sola vez (por ejemplo, «Fines de semana y festivos, 18 de abril – 14 de junio: 9:00–22:45»), aunque falten días para que empiece.',
        'Organiza las secciones de Mi sitio con el botón de la cabecera de Aulario Plus: en el orden que quieras, una debajo de otra, en tres columnas o una a un lado y dos al otro. Arrastra una sección a otro hueco o pulsa dos para cambiarlas. Con poco ancho (media pantalla, móvil), van una debajo de otra.',
        '«Exámenes finales» también se pliega con su flecha, como las demás secciones.'
      ],
      en: [
        'Mi sitio has a new section, "Hours", closed at the start: a card for the library of your campus (the hours of today, the usual ones and the notices of its board with special hours for exams, summer or Easter, with their calendar in colors), another one for the sports facilities and the gym, another one for the pool and another one for the cafeterias and the dining hall of your campus (with their hours in the term, in the holidays and on weekends). Each card says if it is open now and until when, or when it opens, and the head shows the hours of today of all of them. Choose the campus of the library (Arrosadía, Ciencias de la Salud or Tudela) in Settings → Library.',
        'In Mi sitio, "Guías docentes" and "Hours" have their own box, as "Exámenes finales".',
        'When the library publishes special hours, a window tells you in one line, only once (for example, "Weekends and holidays, April 18 – June 14: 9:00–22:45"), even days before they start.',
        'Arrange the sections of Mi sitio with the button in the head of Aulario Plus: in the order you like, one below the other, in three columns, or one on one side and two on the other. Drag a section to another place or click two to swap them. With little width (half a screen, a phone), they go one below the other.',
        '"Exámenes finales" also folds with its arrow, as the other sections.'
      ]
    },
    {
      version: '1.6.7',
      // The news in one line: the window over MiAulario after the update (background.js, pageNotice).
      short: {
        es: 'Dos temas nuevos (Vía Láctea y Catppuccin), Mi sitio aprovecha mejor el espacio y puedes guardar y recuperar tu configuración en Ajustes.',
        en: 'Two new themes (Milky Way and Catppuccin), Mi sitio uses the space better, and you can save and restore your settings in the settings.'
      },
      es: [
        'El estado de tu sesión se comprueba al abrir el popup y al pulsar ↻: después de iniciar sesión dice «Conectado» enseguida, sin esperar unos minutos.',
        'La ventana «Escribir a un profesor» se queda siempre dentro de la pantalla, también con las asignaturas del final de la lista.',
        'En el calendario de una asignatura, los exámenes de las otras siguen en gris, pero al pasar el ratón dicen de qué asignatura son y cuándo.',
        'Las ventanas se cierran con un clic fuera o con Esc, como al pulsar Cancelar, también las del popup y aunque hayas hecho clic en su texto.',
        'En todos los temas, los botones invierten sus colores al pasar el ratón, poco a poco.',
        'El buscador ({key}) no pierde nunca el foco mientras está abierto: puedes escribir siempre, aunque hagas clic dentro de él o la página se esté cargando. Un clic fuera lo cierra.',
        'Mi sitio aprovecha mejor el espacio: los atajos van en la cabecera de los exámenes, el próximo examen ocupa una franja baja y las tarjetas de los exámenes van al lado del calendario. Con la pantalla a la mitad, las tarjetas van de dos en dos y el calendario debajo, con los meses lado a lado.',
        'Antes de enviar archivos por el correo interno a otras personas, la extensión siempre te pregunta, con la lista de destinatarios.',
        'En la calculadora, dos actividades con el mismo nombre ya no comparten la nota: la segunda se llama, por ejemplo, «Prueba escrita (2)».',
        'Si MiAulario falla o tu sesión ha terminado, la guía docente de una asignatura ya no desaparece durante una semana: se lee otra vez al volver.',
        'En los grados con el mismo calendario de exámenes en los dos semestres, como Medicina, Mi sitio lo enseña todo el curso.',
        'Tema nuevo, Vía Láctea («Vía Aulactea»): vidrio sobre la Vía Láctea de verdad, una foto del espacio para cada asignatura (siempre la misma), otra para las novedades y la Tierra en la cuenta atrás del próximo examen (fotos de ESO y NASA). En light mode, el mismo cielo al anochecer.',
        'Tema nuevo, Catppuccin («Aulappuccin»): los colores pastel de Catppuccin, Latte en light mode y Mocha en dark mode, con botones de varios colores y títulos en degradado.',
        'Ajustes → «Tu configuración»: «Exportar mi configuración» descarga un archivo JSON con todos tus ajustes, los recuadros de Mi sitio abiertos o cerrados y la foto de cada asignatura; «Importar mi configuración» los recupera de ese archivo, después de decirte cuántos cambian y preguntarte. Un archivo roto o cambiado no cambia nada: solo cuentan los valores correctos.',
        'Después de cada actualización, la primera página de MiAulario te enseña una sola vez las novedades en una línea.'
      ],
      en: [
        'The extension checks your session when you open the popup and when you click ↻: after you log in, it says "Connected" at once, with no wait of some minutes.',
        'The window "Write to a teacher" always stays inside the screen, also for the subjects at the end of the list.',
        'In the calendar of a subject, the exams of the other subjects stay grey, but on hover they say which subject and when.',
        'The windows close with a click outside or with Esc, as "Cancel" does, also the ones of the popup and after a click on their text.',
        'In all the themes, the buttons swap their colors on hover, slowly.',
        'The search ({key}) never loses the focus while it is open: you can always type, also after a click in it or while the page loads. A click outside closes it.',
        'Mi sitio uses the space better: the shortcuts are in the head of the exams, the next exam takes a low strip, and the cards of the exams are next to the calendar. With the window at half the screen, the cards go two by two and the calendar below them, with its months side by side.',
        'Before the extension sends files by the internal mail to other people, it always asks you, with the list of the recipients.',
        'In the calculator, two activities with the same name do not share their grade any more: the second one is, for example, "Prueba escrita (2)".',
        'If MiAulario fails or your session ended, the course guide of a subject does not go away for a week: it is read again when you come back.',
        'In the degrees with the same exam calendar for the two semesters, as Medicine, Mi sitio shows it all the year.',
        'A new theme, Milky Way ("Vía Aulactea"): glass over the real Milky Way, a photo of space for each subject (always the same one), another one for the novelties, and the Earth in the countdown of the next exam (photos of ESO and NASA). In light mode, the same sky at dusk.',
        'A new theme, Catppuccin ("Aulappuccin"): the pastel colors of Catppuccin, Latte in light mode and Mocha in dark mode, with buttons of several colors and titles in a gradient.',
        'Settings → "Your settings": "Export my settings" downloads a JSON file with all your settings, the open or closed boxes of Mi sitio and the photo of each subject; "Import my settings" gets them back from that file, after it tells you how many change and asks you. A broken or changed file changes nothing: only the right values count.',
        'After each update, the first page of MiAulario shows you the news in one line, one time.'
      ]
    },
    {
      version: '1.6.6',
      es: [
        'Notas oficiales de SIGMA (actívalo en Ajustes): tu media y tu rango junto a tu foto en MiAulario. Hay ocho rangos, de Bronce a Leyenda, uno por cada octavo de los créditos de tu carrera, cada uno con su gema; te dice qué te falta para el siguiente.',
        'Las notas oficiales se leen cuando abres tu expediente y, cada pocos días, en una pestaña en segundo plano. Se quedan al cerrar sesión; se borran si entra otro usuario.',
        'Un calendario de tus exámenes por meses en cada semestre de Mi sitio y junto a la guía de cada asignatura: finales y recuperaciones en dos colores. Su botón lo muestra u oculta.',
        'Historial (en el menú de inicio): todas tus tareas y exámenes, también de años pasados, con tu entrega, la nota y el comentario, y con las notas oficiales de SIGMA, la nota de cada asignatura de cada curso, también de los cursos de antes de la actualización de MiAulario de 2025.',
        'El Historial va por curso y por asignatura, en filas por columnas, con filtros de tipo, curso y asignatura y un botón para expandir o colapsar todo.',
        'Entregas ya no cuenta las tutorías del calendario.',
        'Ajustes → Danger zone: «Borrar todos los datos» borra todo lo que guarda la extensión, con dos confirmaciones. Sigue instalada y no hace nada hasta que pulses «Empezar de nuevo».'
      ],
      en: [
        'Official grades of SIGMA (turn it on in the settings): your average and your rank next to your photo in MiAulario. There are eight ranks, from Bronze to Legend, one for each eighth of the credits of your degree, each one with its gem; it tells you what you need for the next one.',
        'The extension reads the official grades when you open your record and, every few days, in a tab in the background. They stay when you log out; they go when another user logs in.',
        'A calendar of your exams by month in each semester of Mi sitio and next to the guide of each subject: the finals and the recoveries in two colors. Its button shows or hides it.',
        'History (in the main menu): all your tasks and exams, also of past years, with your submission, the grade and the comment, and with the official grades of SIGMA, the grade of each subject of each year, also of the years before the update of MiAulario in 2025.',
        'The history goes by year and by subject, in rows with columns, with filters of type, year and subject and a button to expand or collapse all.',
        'The deliveries do not count the office hours (tutorías) of the calendar any more.',
        'Settings → Danger zone: "Delete all the data" deletes all that the extension keeps, with two confirmations. It stays installed and does nothing until you click "Start again".'
      ]
    },
    {
      version: '1.6.5',
      es: [
        'El popup abre en un menú de inicio: tu sesión con un botón para pausarla, los avisos y el light o dark mode en un clic, y lo que tienes pendiente.',
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
        'Seis temas para elegir en Ajustes: MiAulario (el de siempre, igual que MiAulario), Cómic, Malvavisco, Aurora, AulaXP y Folio. Cada uno en light y dark mode, o como MiAulario.',
        'El triángulo de la esquina del bloque de Mi sitio lo pone a todo el ancho, con el calendario debajo.',
        'Mi sitio muestra tu próximo examen en grande, y los accesos a tu expediente, Wuolah y el correo interno en una fila.',
        '{key} busca también en los «Contenidos» de las asignaturas: títulos y enlaces a PDF.',
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
