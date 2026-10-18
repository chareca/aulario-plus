# Privacy policy of Aulario Plus

Last change: 2026-10-18 (version 1.6.1). [Español más abajo](#política-de-privacidad-de-aulario-plus-español).

Aulario Plus is a browser extension for MiAulario, the virtual campus of the Universidad Pública de Navarra (UPNA). The UPNA did not make this extension and does not support it.

## Summary

- The developers do not receive, keep or sell any data. The extension has no analytics and no servers of its own.
- The extension keeps the data that it needs only in your browser.
- The extension sends requests to MiAulario and reads the public course guides of the UPNA. Only one function sends data to other servers: the download links, which you must enable, and which send your files encrypted.

## Data that the extension uses

| Data | Where it is | Who gets it |
|---|---|---|
| Your settings (names of sites, hidden sites, language, targets of the grade calculator, the settings of the download links) | The storage of the extension in your browser | Nobody |
| A copy of your course data: sites, pages of the sites, deliveries, announcements, notifications, calendar events, forums, grades, resources, and what you read | The storage of the extension in your browser | Nobody. The extension removes it when you log out of MiAulario or when a different user logs in |
| The course guides of your sites (assessment, teachers) | The storage of the extension, for 7 days | Nobody |
| The session cookies of MiAulario (`miaulario.unavarra.es`) and of the UPNA login page (`sso.unavarra.es`) | Your browser | The extension changes them into persistent cookies, so that the session stays after you close the browser. They do not go to other sites |

## Requests

- **MiAulario (`miaulario.unavarra.es`):** the extension reads your course data, sends a request every 3 to 10 minutes to keep your session active, and, when you use these functions, sends messages by the internal mail of MiAulario and opens its pages. These are the same requests as when you use MiAulario.
- **UPNA login page (`sso.unavarra.es`):** the extension does not send requests to this page. It only makes its cookie last longer.
- **Public course guides (`www.unavarra.es/ficha-asignaturaDOA/`):** the extension reads the public guide of each of your sites. The request has only the code of the subject, not your data.
- **Download links (off by default):** if you enable them and make a link, your browser encrypts the file, and the extension sends the encrypted file to the Send server that you select (`send.vis.ee`, `send.artemislena.eu` or `send.monks.tools`). The key is only in the link. The extension then sends the address of the link to a shortener (`is.gd`, `spoo.me` or `tinyurl.com`). With the form "Very short + password", the shortener gets the key, but not the password. With "Short, no password", it gets only the address without the key. With "Long", no shortener gets the link. These services have their own privacy policies.

## Permissions

- `storage`: keep the settings and the copy of your course data.
- `cookies`: make the session cookies of MiAulario and of the UPNA login page persistent, and remove them when you log out.
- `alarms`: send the request that keeps the session active, and read the course data at intervals.
- `notifications`: tell you about a new grade (it shows the site and the item, not the grade).
- Host permissions for `miaulario.unavarra.es`, `sso.unavarra.es` and `www.unavarra.es`: the requests above.
- Optional host permissions for the Send servers and the shorteners: only if you enable the download links. In Firefox, the extension also asks for your consent for "website content" (the encrypted files).

## Your control

- Settings → turn off the sync, the notifications or the download links.
- Log out of MiAulario: the extension removes the course data.
- Remove the extension: the browser removes all its data.

## Contact

Open an issue at <https://github.com/chareca/aulario-plus/issues>.

---

# Política de privacidad de Aulario Plus (español)

Último cambio: 18-10-2026 (versión 1.6.1).

Aulario Plus es una extensión del navegador para MiAulario, el campus virtual de la Universidad Pública de Navarra (UPNA). La UPNA no hizo esta extensión y no le da soporte.

## Resumen

- Los desarrolladores no reciben, no guardan ni venden ningún dato. La extensión no tiene analíticas ni servidores propios.
- La extensión guarda los datos que necesita solo en tu navegador.
- La extensión hace peticiones a MiAulario y lee las guías docentes públicas de la UPNA. Solo una función envía datos a otros servidores: los enlaces de descarga, que tienes que activar tú y que envían tus archivos cifrados.

## Datos que usa la extensión

| Datos | Dónde están | Quién los recibe |
|---|---|---|
| Tus ajustes (nombres de materias, materias ocultas, idioma, objetivos de la calculadora, ajustes de los enlaces de descarga) | El almacenamiento de la extensión en tu navegador | Nadie |
| Una copia de tus datos de las asignaturas: sitios, páginas, entregas, anuncios, notificaciones, eventos del calendario, foros, notas, recursos y lo que has leído | El almacenamiento de la extensión en tu navegador | Nadie. La extensión la borra al cerrar sesión en MiAulario o si entra otro usuario |
| Las guías docentes de tus materias (evaluación, profesorado) | El almacenamiento de la extensión, durante 7 días | Nadie |
| Las cookies de sesión de MiAulario (`miaulario.unavarra.es`) y de la página de inicio de sesión de la UPNA (`sso.unavarra.es`) | Tu navegador | La extensión las hace persistentes para que la sesión siga al cerrar el navegador. No van a otros sitios |

## Peticiones

- **MiAulario (`miaulario.unavarra.es`):** la extensión lee tus datos de las asignaturas, envía una petición cada 3 a 10 minutos para mantener la sesión activa y, cuando usas esas funciones, envía mensajes por el Correo interno y abre sus páginas. Son las mismas peticiones que cuando usas MiAulario.
- **Página de inicio de sesión de la UPNA (`sso.unavarra.es`):** la extensión no le hace peticiones. Solo alarga la duración de su cookie.
- **Guías docentes públicas (`www.unavarra.es/ficha-asignaturaDOA/`):** la extensión lee la guía pública de cada materia. La petición solo lleva el código de la asignatura, no tus datos.
- **Enlaces de descarga (desactivados por defecto):** si los activas y creas un enlace, tu navegador cifra el archivo y la extensión envía el archivo cifrado al servidor de Send que elijas (`send.vis.ee`, `send.artemislena.eu` o `send.monks.tools`). La clave solo va en el enlace. Después, la extensión envía la dirección del enlace a un acortador (`is.gd`, `spoo.me` o `tinyurl.com`). Con «Muy corto + contraseña», el acortador recibe la clave pero no la contraseña. Con «Corto, sin contraseña», solo recibe la dirección sin la clave. Con «Largo», ningún acortador recibe el enlace. Estos servicios tienen sus propias políticas de privacidad.

## Permisos

- `storage`: guardar los ajustes y la copia de tus datos de las asignaturas.
- `cookies`: hacer persistentes las cookies de sesión de MiAulario y de la página de inicio de sesión de la UPNA, y borrarlas al cerrar sesión.
- `alarms`: enviar la petición que mantiene la sesión y leer los datos de las asignaturas cada cierto tiempo.
- `notifications`: avisarte de una nota nueva (muestra la materia y el ítem, no la nota).
- Acceso a `miaulario.unavarra.es`, `sso.unavarra.es` y `www.unavarra.es`: las peticiones de arriba.
- Acceso opcional a los servidores de Send y a los acortadores: solo si activas los enlaces de descarga. En Firefox, la extensión también pide tu consentimiento para «contenido de sitios web» (los archivos cifrados).

## Tu control

- Ajustes → desactivar la sincronización, las notificaciones o los enlaces de descarga.
- Cerrar sesión en MiAulario: la extensión borra los datos de las asignaturas.
- Quitar la extensión: el navegador borra todos sus datos.

## Contacto

Abre un issue en <https://github.com/chareca/aulario-plus/issues>.
