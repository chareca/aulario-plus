# Privacy policy of Aulario Plus

Last change: 2026-10-19 (version 1.6.2). [Español más abajo](#política-de-privacidad-de-aulario-plus-español).

Aulario Plus is a browser extension for MiAulario, the virtual campus of the Universidad Pública de Navarra (UPNA). The UPNA did not make this extension and does not support it.

## Summary

- The developers do not receive, keep or sell any data. The extension has no analytics and no servers of its own.
- The extension keeps the data that it needs only in your browser.
- The extension sends requests to MiAulario and reads the public course guides of the UPNA. Only one function sends data to other servers: the download links, which you must enable, and which send your files encrypted.

## Data that the extension uses

| Data | Where it is | Who gets it |
|---|---|---|
| Your settings (names of sites, hidden sites, language, the settings of the download links) | The storage of the extension in your browser | Nobody |
| A copy of your course data: sites, pages of the sites, deliveries, announcements, notifications, calendar events, forums, grades, resources, and what you read; and what you write: the targets, grades and weights of the grade calculators, the address for the forward of the internal mail | The storage of the extension in your browser | Nobody. The extension removes it when you log out of MiAulario or when a different user logs in |
| The course guides of your sites (assessment, teachers) | The storage of the extension, for 7 days | Nobody |
| Your official grades (only if you turn on "Notas oficiales (SIGMA)"): the subjects, credits, calls and grades of your record in SIGMA, and its credits | The storage of the extension in your browser | Nobody. They stay when you log out of MiAulario (you come back). The extension removes them when a different user logs in, or when you turn it off |
| Your degree (from the guides), its exam periods and the exam dates of the calendar (public data) | The storage of the extension, for 7 days (1 day for an exam calendar) | Nobody. The extension removes it when you log out |
| The session cookies of MiAulario (`miaulario.unavarra.es`) and of the UPNA login page (`sso.unavarra.es`) | Your browser | The extension changes them into persistent cookies, so that the session stays after you close the browser. They do not go to other sites |

## Requests

- **MiAulario (`miaulario.unavarra.es`):** the extension reads your course data, sends a request every 3 to 10 minutes to keep your session active, and, when you use these functions, sends messages by the internal mail of MiAulario, changes the forward of the internal mail of your sites to the address that you write (only when you click the buttons), and opens its pages. These are the same requests as when you use MiAulario.
- **UPNA login page (`sso.unavarra.es`):** the extension does not send requests to this page. It only makes its cookie last longer.
- **Public course guides (`www.unavarra.es/ficha-asignaturaDOA/`):** the extension reads the public guide of each of your sites. The request has only the code of the subject, not your data.
- **Public pages of the degrees (`www.unavarra.es/sites/grados/`):** the extension reads the list of degrees and the page "Evaluación" of your degree, for the shortcuts of "Mi sitio". The requests do not contain your data.
- **Official grades (`portal.unavarra.es` and `academicos.unavarra.es`, only if you turn them on):** the extension reads your record in SIGMA when you open it, in a small window when you click "Abrir expediente" (you can log in there), and every 3 days in a background tab that closes itself (MiUPNA → "Consulta tu Expediente" → "Expediente completo"). It uses your UPNA session: it never asks for, keeps or sends your password, and it does not keep the link of MiUPNA to SIGMA. If the UPNA login asks for your password in the background tab, the tab closes. The extension computes the credits of your degree and your rank in your browser. The grades stay in your browser.
- **Exam calendars (`www2.unavarra.es`, only with your permission):** if you click "Ver mis fechas" and give the permission, the extension reads the public exam calendars (PDF files) of your degree. The request does not contain your data. The extension compares the calendar with your subjects in your browser.
- **Download links (off by default):** if you enable them and make a link, your browser encrypts the file, and the extension sends the encrypted file to the Send server that you select (`send.vis.ee`, `send.artemislena.eu` or `send.monks.tools`). The key is only in the link. The extension then sends the address of the link to a shortener (`is.gd`, `spoo.me` or `tinyurl.com`). With the form "Very short + password", the shortener gets the key, but not the password. With "Short, no password", it gets only the address without the key. With "Long", no shortener gets the link. These services have their own privacy policies.

## Permissions

- `storage`: keep the settings and the copy of your course data.
- `cookies`: make the session cookies of MiAulario and of the UPNA login page persistent, and remove them when you log out.
- `alarms`: send the request that keeps the session active, and read the course data at intervals.
- `notifications`: tell you about a new grade (it shows the site and the item, not the grade).
- `scripting`: read your record in SIGMA, only after you give the optional permission for MiUPNA and SIGMA.
- Host permissions for `miaulario.unavarra.es`, `sso.unavarra.es` and `www.unavarra.es`: the requests above.
- Optional host permissions for the Send servers and the shorteners: only if you enable the download links. In Firefox, the extension also asks for your consent for "website content" (the encrypted files).
- Optional host permission for `www2.unavarra.es`: only if you click "Ver mis fechas" in "Mi sitio" (the exam calendars).
- Optional host permissions for `portal.unavarra.es` and `academicos.unavarra.es`: only if you turn on "Notas oficiales (SIGMA)" in the settings.

## Your control

- Settings → turn off the sync, the notifications, the download links or the official grades (this removes them and the permission).
- Log out of MiAulario: the extension removes the course data.
- Remove the extension: the browser removes all its data.

## Contact

Open an issue at <https://github.com/chareca/aulario-plus/issues>.

---

# Política de privacidad de Aulario Plus (español)

Último cambio: 19-10-2026 (versión 1.6.2).

Aulario Plus es una extensión del navegador para MiAulario, el campus virtual de la Universidad Pública de Navarra (UPNA). La UPNA no hizo esta extensión y no le da soporte.

## Resumen

- Los desarrolladores no reciben, no guardan ni venden ningún dato. La extensión no tiene analíticas ni servidores propios.
- La extensión guarda los datos que necesita solo en tu navegador.
- La extensión hace peticiones a MiAulario y lee las guías docentes públicas de la UPNA. Solo una función envía datos a otros servidores: los enlaces de descarga, que tienes que activar tú y que envían tus archivos cifrados.

## Datos que usa la extensión

| Datos | Dónde están | Quién los recibe |
|---|---|---|
| Tus ajustes (nombres de materias, materias ocultas, idioma, ajustes de los enlaces de descarga) | El almacenamiento de la extensión en tu navegador | Nadie |
| Una copia de tus datos de las asignaturas: sitios, páginas, entregas, anuncios, notificaciones, eventos del calendario, foros, notas, recursos y lo que has leído; y lo que escribes: los objetivos, las notas y los pesos de las calculadoras, la dirección de reenvío del Correo interno | El almacenamiento de la extensión en tu navegador | Nadie. La extensión la borra al cerrar sesión en MiAulario o si entra otro usuario |
| Las guías docentes de tus materias (evaluación, profesorado) | El almacenamiento de la extensión, durante 7 días | Nadie |
| Tus notas oficiales (solo si activas «Notas oficiales (SIGMA)»): las asignaturas, créditos, convocatorias y notas de tu expediente de SIGMA, y sus créditos | El almacenamiento de la extensión en tu navegador | Nadie. Se quedan al cerrar sesión en MiAulario (vuelves tú). La extensión las borra si entra otro usuario o si lo desactivas |
| Tu carrera (de las guías), sus periodos de exámenes y las fechas del calendario de exámenes (datos públicos) | El almacenamiento de la extensión, durante 7 días (1 día para un calendario de exámenes) | Nadie. La extensión los borra al cerrar sesión |
| Las cookies de sesión de MiAulario (`miaulario.unavarra.es`) y de la página de inicio de sesión de la UPNA (`sso.unavarra.es`) | Tu navegador | La extensión las hace persistentes para que la sesión siga al cerrar el navegador. No van a otros sitios |

## Peticiones

- **MiAulario (`miaulario.unavarra.es`):** la extensión lee tus datos de las asignaturas, envía una petición cada 3 a 10 minutos para mantener la sesión activa y, cuando usas esas funciones, envía mensajes por el Correo interno, cambia el reenvío del Correo interno de tus materias a la dirección que escribas (solo cuando pulsas los botones) y abre sus páginas. Son las mismas peticiones que cuando usas MiAulario.
- **Página de inicio de sesión de la UPNA (`sso.unavarra.es`):** la extensión no le hace peticiones. Solo alarga la duración de su cookie.
- **Guías docentes públicas (`www.unavarra.es/ficha-asignaturaDOA/`):** la extensión lee la guía pública de cada materia. La petición solo lleva el código de la asignatura, no tus datos.
- **Páginas públicas de las carreras (`www.unavarra.es/sites/grados/`):** la extensión lee la lista de carreras y la página «Evaluación» de tu carrera, para los accesos directos de Mi sitio. Las peticiones no llevan tus datos.
- **Notas oficiales (`portal.unavarra.es` y `academicos.unavarra.es`, solo si las activas):** la extensión lee tu expediente de SIGMA cuando lo abres, en una ventana pequeña cuando pulsas «Abrir expediente» (ahí puedes iniciar sesión) y, cada 3 días, en una pestaña de fondo que se cierra sola (MiUPNA → «Consulta tu Expediente» → «Expediente completo»). Usa tu sesión de la UPNA: nunca pide, guarda ni envía tu contraseña, y no guarda el enlace de MiUPNA a SIGMA. Si el inicio de sesión de la UPNA pide la contraseña en la pestaña de fondo, la pestaña se cierra. La extensión calcula los créditos de tu carrera y tu rango en tu navegador. Las notas quedan en tu navegador.
- **Calendarios de exámenes (`www2.unavarra.es`, solo con tu permiso):** si pulsas «Ver mis fechas» y das el permiso, la extensión lee los calendarios de exámenes públicos (PDF) de tu carrera. La petición no lleva tus datos. La extensión compara el calendario con tus materias en tu navegador.
- **Enlaces de descarga (desactivados por defecto):** si los activas y creas un enlace, tu navegador cifra el archivo y la extensión envía el archivo cifrado al servidor de Send que elijas (`send.vis.ee`, `send.artemislena.eu` o `send.monks.tools`). La clave solo va en el enlace. Después, la extensión envía la dirección del enlace a un acortador (`is.gd`, `spoo.me` o `tinyurl.com`). Con «Muy corto + contraseña», el acortador recibe la clave pero no la contraseña. Con «Corto, sin contraseña», solo recibe la dirección sin la clave. Con «Largo», ningún acortador recibe el enlace. Estos servicios tienen sus propias políticas de privacidad.

## Permisos

- `storage`: guardar los ajustes y la copia de tus datos de las asignaturas.
- `cookies`: hacer persistentes las cookies de sesión de MiAulario y de la página de inicio de sesión de la UPNA, y borrarlas al cerrar sesión.
- `alarms`: enviar la petición que mantiene la sesión y leer los datos de las asignaturas cada cierto tiempo.
- `notifications`: avisarte de una nota nueva (muestra la materia y el ítem, no la nota).
- `scripting`: leer tu expediente de SIGMA, solo después de que des el acceso opcional a MiUPNA y SIGMA.
- Acceso a `miaulario.unavarra.es`, `sso.unavarra.es` y `www.unavarra.es`: las peticiones de arriba.
- Acceso opcional a los servidores de Send y a los acortadores: solo si activas los enlaces de descarga. En Firefox, la extensión también pide tu consentimiento para «contenido de sitios web» (los archivos cifrados).
- Acceso opcional a `www2.unavarra.es`: solo si pulsas «Ver mis fechas» en Mi sitio (los calendarios de exámenes).
- Acceso opcional a `portal.unavarra.es` y `academicos.unavarra.es`: solo si activas «Notas oficiales (SIGMA)» en Ajustes.

## Tu control

- Ajustes → desactivar la sincronización, las notificaciones, los enlaces de descarga o las notas oficiales (las borra y quita el acceso).
- Cerrar sesión en MiAulario: la extensión borra los datos de las asignaturas.
- Quitar la extensión: el navegador borra todos sus datos.

## Contacto

Abre un issue en <https://github.com/chareca/aulario-plus/issues>.
