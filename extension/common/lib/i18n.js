// MiAulario Keep-Alive: texts of the interface. Spanish is the default language.
// The user can select English in the settings. Each key must exist in both languages.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  const STRINGS = {
    es: {
      'app.title': 'MiAulario Keep-Alive',
      'header.refresh': 'Actualizar los datos de las asignaturas',
      'header.openTab': 'Abrir en una pestaña',
      'tab.due': 'Entregas',
      'tab.settings': 'Ajustes',
      'perm.text': 'La extensión no tiene permiso para miaulario.unavarra.es y sso.unavarra.es.',
      'perm.grant': 'Dar permiso',

      'status.paused': 'En pausa',
      'status.connected': 'Conectado',
      'status.networkError': 'Error de red',
      'status.notLoggedIn': 'Sin sesión',
      'status.noPing': 'Aún no hay ping',
      'sub.syncOff': 'La sincronización está desactivada',
      'sub.updating': 'Actualizando…',
      'sub.lastSync': 'Datos: {ago}',
      'sub.stale': ' (algunos datos no están al día)',
      'sub.noData': 'Aún no hay datos',

      'empty.syncOff': 'La sincronización está desactivada. Actívala en Ajustes para ver tus {what}.',
      'empty.paused': 'La extensión está en pausa. Reanúdala en Ajustes.',
      'empty.login': 'Inicia sesión en MiAulario. Después aparecerán aquí tus {what}.',
      'empty.noData': 'Aún no hay datos. Pulsa ↻ para actualizar.',
      'what.deliveries': 'entregas',

      'site.all': 'Todos los sitios',
      'site.label': 'Sitio',

      'due.none': 'No hay entregas.',
      'due.nothing': 'No tienes nada pendiente de entregar.',
      'due.late': 'Atrasadas: aún puedes entregar',
      'due.todo': 'Pendientes',
      'due.returned': 'Devueltas: puedes volver a entregar',
      'due.submitted': 'Entregadas',
      'due.closed': 'Cerradas',
      'due.tagSubmitted': 'Entregada',
      'due.tagClosed': 'Cerrada',
      'due.tagOffline': 'Sin entrega en línea',
      'due.noDate': 'Sin fecha límite',
      'due.in': 'quedan {d}',
      'due.lateBy': 'vencida hace {d}',

      'ago.s': 'hace {n} s',
      'ago.min': 'hace {n} min',
      'ago.h': 'hace {n} h',

      'set.keepAlive': 'Mantener la sesión',
      'set.session': 'Sesión',
      'set.lastPing': 'Último ping',
      'set.timeLeft': 'Tiempo restante',
      'set.nextPing': 'Próximo ping',
      'set.pingNow': 'Hacer ping ahora',
      'set.pause': 'Pausar',
      'set.resume': 'Reanudar',
      'set.autoLogin': 'Abrir la página de inicio de sesión cuando la sesión termine',
      'set.courseData': 'Datos de las asignaturas',
      'set.sync': 'Sincronizar los datos de las asignaturas',
      'set.syncHelp': 'La extensión lee tus entregas, anuncios, mensajes, foros y archivos de MiAulario. Hace unas pocas peticiones cada 15 minutos. Desactívalo para que no haga estas peticiones.',
      'set.language': 'Idioma',
      'ka.active': 'Activa',
      'ka.loggedOut': 'Sin sesión',
      'ka.in': 'en {t}',

      'skip.paused': 'La extensión está en pausa',
      'skip.disabled': 'La sincronización está desactivada',
      'skip.logged-out': 'Primero inicia sesión en MiAulario',
      'skip.backoff': 'El servidor está ocupado. Inténtalo más tarde',
      'skip.locked': 'Ya hay una actualización en curso',
      'skip.someFailed': 'Algunos datos no se actualizaron',

      'badge.title': 'MiAulario: {due} entregas pronto · {unread} sin leer',
      'set.badge': 'Número en el icono',
      'set.badgeShow': 'Mostrar un número en el icono de la extensión',
      'set.badgeDeliveries': 'Entregas atrasadas o que vencen en 72 h o menos',
      'set.badgeAnnouncements': 'Anuncios sin leer',
      'set.badgeMessages': 'Mensajes sin leer',
      'set.badgeForums': 'Mensajes de foro sin leer',
      'set.badgeHelp': 'El número es rojo si una entrega está atrasada o vence en menos de 24 h.',
      'tab.inbox': 'Bandeja',
      'what.inbox': 'anuncios y mensajes',
      'inbox.type.all': 'Todo',
      'inbox.type.announcement': 'Anuncios',
      'inbox.type.messages': 'Mensajes',
      'inbox.type.forum': 'Foros',
      'inbox.unreadOnly': 'Solo sin leer',
      'inbox.search': 'Buscar en título, texto o asignatura',
      'inbox.markAllRead': 'Marcar los anuncios como leídos',
      'inbox.empty': 'No hay nada en la bandeja.',
      'inbox.noResults': 'No hay resultados.',
      'inbox.messages': '{n} mensajes sin leer',
      'inbox.messages_one': '1 mensaje sin leer',
      'inbox.forumSite': '{n} mensajes de foro sin leer',
      'inbox.forumSite_one': '1 mensaje de foro sin leer',
      'inbox.unreadTag': '{n} sin leer',
      'inbox.open': 'Abrir en MiAulario',
      'inbox.attachments': 'Adjuntos:',
      'inbox.unread': 'Sin leer',

      'privacy.short': '🔒 Solo se conecta con MiAulario. Tus datos no salen de tu navegador.',
      'privacy.title': 'Privacidad',
      'privacy.text1': 'La extensión solo hace peticiones a MiAulario (miaulario.unavarra.es). No se conecta con ningún otro servidor: no tiene analíticas ni servidores propios.',
      'privacy.text2': 'También alarga la cookie del inicio de sesión de la UPNA (sso.unavarra.es), pero no le hace peticiones. Tu navegador abre esa página cuando inicias sesión.',
      'privacy.text3': 'Los datos que necesita (tus ajustes, una copia de tus entregas, anuncios y novedades, y lo que has leído) se guardan solo en tu navegador. Nadie más los recibe. Los datos de las asignaturas se borran al cerrar sesión.'
    },
    en: {
      'app.title': 'MiAulario Keep-Alive',
      'header.refresh': 'Refresh the course data',
      'header.openTab': 'Open in a tab',
      'tab.due': 'Due',
      'tab.settings': 'Settings',
      'perm.text': 'The extension does not have permission for miaulario.unavarra.es and sso.unavarra.es.',
      'perm.grant': 'Give permission',

      'status.paused': 'Paused',
      'status.connected': 'Connected',
      'status.networkError': 'Network error',
      'status.notLoggedIn': 'Not logged in',
      'status.noPing': 'No ping yet',
      'sub.syncOff': 'Course data sync is off',
      'sub.updating': 'Update in progress…',
      'sub.lastSync': 'Course data: {ago}',
      'sub.stale': ' (some data is old)',
      'sub.noData': 'No course data yet',

      'empty.syncOff': 'Course data sync is off. Turn it on in Settings to see your {what}.',
      'empty.paused': 'The extension is paused. Resume it in Settings.',
      'empty.login': 'Log in to MiAulario. Then your {what} show here.',
      'empty.noData': 'No course data yet. Click ↻ to update it.',
      'what.deliveries': 'deliveries',

      'site.all': 'All sites',
      'site.label': 'Site',

      'due.none': 'No deliveries.',
      'due.nothing': 'Nothing to submit.',
      'due.late': 'Late: you can still submit',
      'due.todo': 'To do',
      'due.returned': 'Returned: you can submit again',
      'due.submitted': 'Submitted',
      'due.closed': 'Closed',
      'due.tagSubmitted': 'Submitted',
      'due.tagClosed': 'Closed',
      'due.tagOffline': 'No online submission',
      'due.noDate': 'No due date',
      'due.in': 'in {d}',
      'due.lateBy': 'late by {d}',

      'ago.s': '{n} s ago',
      'ago.min': '{n} min ago',
      'ago.h': '{n} h ago',

      'set.keepAlive': 'Keep-alive',
      'set.session': 'Session',
      'set.lastPing': 'Last ping',
      'set.timeLeft': 'Time left',
      'set.nextPing': 'Next ping',
      'set.pingNow': 'Ping now',
      'set.pause': 'Pause',
      'set.resume': 'Resume',
      'set.autoLogin': 'Open the login page when the session ends',
      'set.courseData': 'Course data',
      'set.sync': 'Sync course data',
      'set.syncHelp': 'The extension reads your deliveries, announcements, messages, forums and files from MiAulario. It sends a few requests every 15 minutes. Turn this off to stop these requests.',
      'set.language': 'Language',
      'ka.active': 'Active',
      'ka.loggedOut': 'Logged out',
      'ka.in': 'in {t}',

      'skip.paused': 'The extension is paused',
      'skip.disabled': 'Course data sync is off',
      'skip.logged-out': 'Log in to MiAulario first',
      'skip.backoff': 'The server is busy. Do it again later',
      'skip.locked': 'An update is in progress',
      'skip.someFailed': 'Some data did not update',

      'badge.title': 'MiAulario: {due} deliveries soon · {unread} unread',
      'set.badge': 'Number on the icon',
      'set.badgeShow': 'Show a number on the extension icon',
      'set.badgeDeliveries': 'Deliveries that are late or due in 72 hours or less',
      'set.badgeAnnouncements': 'Unread announcements',
      'set.badgeMessages': 'Unread messages',
      'set.badgeForums': 'Unread forum posts',
      'set.badgeHelp': 'The number is red if a delivery is late or due in less than 24 hours.',
      'tab.inbox': 'Inbox',
      'what.inbox': 'announcements and messages',
      'inbox.type.all': 'All',
      'inbox.type.announcement': 'Announcements',
      'inbox.type.messages': 'Messages',
      'inbox.type.forum': 'Forums',
      'inbox.unreadOnly': 'Unread only',
      'inbox.search': 'Search in title, text or site',
      'inbox.markAllRead': 'Mark the announcements as read',
      'inbox.empty': 'The inbox is empty.',
      'inbox.noResults': 'No results.',
      'inbox.messages': '{n} unread messages',
      'inbox.messages_one': '1 unread message',
      'inbox.forumSite': '{n} unread forum posts',
      'inbox.forumSite_one': '1 unread forum post',
      'inbox.unreadTag': '{n} unread',
      'inbox.open': 'Open in MiAulario',
      'inbox.attachments': 'Attachments:',
      'inbox.unread': 'Unread',

      'privacy.short': '🔒 Connects only to MiAulario. Your data stays in your browser.',
      'privacy.title': 'Privacy',
      'privacy.text1': 'The extension sends requests only to MiAulario (miaulario.unavarra.es). It does not connect to other servers. It has no analytics and no servers of its own.',
      'privacy.text2': 'It also makes the cookie of the UPNA login page (sso.unavarra.es) last longer, but it does not send requests to that page. Your browser opens it when you log in.',
      'privacy.text3': 'The extension keeps the data that it needs (your settings, a copy of your deliveries, announcements and new items, and what you read) only in your browser. Nobody else receives this data. The extension removes the course data when you log out.'
    }
  };

  MAK.STRINGS = STRINGS;
  MAK.LANGUAGES = { es: 'Español', en: 'English' };
  const LOCALES = { es: 'es-ES', en: 'en-GB' };
  let lang = 'es';

  MAK.setLang = function (l) {
    lang = Object.prototype.hasOwnProperty.call(STRINGS, l) ? l : 'es';
    if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = lang;
    return lang;
  };
  MAK.getLang = () => lang;
  MAK.locale = () => LOCALES[lang];

  // The text of a key. "{name}" parts change to the values in params.
  // If the key ends in a count, use params.n: the key "x" uses "x_one" when n is 1 (if it exists).
  MAK.t = function (key, params) {
    const table = STRINGS[lang];
    let k = key;
    if (params && params.n === 1 && (table[`${key}_one`] || STRINGS.es[`${key}_one`])) k = `${key}_one`;
    let s = table[k] !== undefined ? table[k] : STRINGS.es[k] !== undefined ? STRINGS.es[k] : key;
    if (params) s = s.replace(/\{(\w+)\}/g, (m, name) => (params[name] !== undefined ? String(params[name]) : m));
    return s;
  };

  // Put the texts in the elements that have data-i18n (text) or data-i18n-title (title and aria-label).
  MAK.applyI18n = function (rootEl) {
    for (const el of rootEl.querySelectorAll('[data-i18n]')) el.textContent = MAK.t(el.dataset.i18n);
    for (const el of rootEl.querySelectorAll('[data-i18n-title]')) {
      const text = MAK.t(el.dataset.i18nTitle);
      el.title = text;
      el.setAttribute('aria-label', text);
    }
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
