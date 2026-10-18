# Chrome Web Store: the listing of Aulario Plus

Copy these texts into the Developer Dashboard (https://chrome.google.com/webstore/devconsole). Default language: Spanish (es). Add English (en) as a second language of the listing.

## Store listing

**Name** (from the manifest): Aulario Plus

**Summary** (132 characters at most):

- es: `Mejora MiAulario (UPNA): sesión activa, entregas, notas con calculadora, guía docente, búsqueda y Correo interno. No oficial.`
- en: `Improves MiAulario (UPNA): active session, deliveries, grades with a calculator, course guides, search and internal mail.`

**Description (es):**

```
Aulario Plus mejora MiAulario, el campus virtual de la Universidad Pública de Navarra (UPNA). Es una extensión no oficial: la UPNA no la hizo ni le da soporte.

• Sesión activa: mantiene tu sesión de MiAulario mientras el navegador está abierto, y la conserva al cerrarlo.
• Todo en un lugar: entregas con cuenta atrás y vista de las próximas semanas, bandeja de anuncios y mensajes, novedades de cada materia y notas.
• Guía docente: la tabla de evaluación de cada materia en su Inicio y todas juntas en Mi sitio, con los pesos por tipo de actividad.
• Calculadora de notas: tu nota actual y la media que necesitas para tu objetivo, con los pesos del libro de calificaciones o de la guía docente.
• Escribir a un profesor: un clic abre el Correo interno de la materia con el profesor como destinatario y un saludo ya escrito.
• Archivos de Recursos por el Correo interno, sin descargarlos, o con un enlace de descarga cifrado (opcional).
• Nombres cortos o propios para tus materias, búsqueda en todas tus materias (Ctrl+K), descarga de una materia en ZIP y exportación del calendario.

Privacidad: tus datos se quedan en tu navegador. Sin analíticas ni servidores propios.
Política de privacidad: https://github.com/chareca/aulario-plus/blob/main/PRIVACY.md
Código fuente: https://github.com/chareca/aulario-plus

Antes de usarla, lee las normas de uso de los sistemas informáticos de la UPNA. No la uses en un ordenador compartido.
```

**Description (en):**

```
Aulario Plus improves MiAulario, the virtual campus of the Universidad Pública de Navarra (UPNA). It is not an official extension: the UPNA did not make it and does not support it.

• Active session: keeps your MiAulario session active while the browser is open, and keeps it after you close the browser.
• All in one place: deliveries with a countdown and a view of the next weeks, an inbox of announcements and messages, the new items of each site, and grades.
• Course guide: the assessment table of each site on its home page, and all of them in "Mi sitio", with the weights by kind of activity.
• Grade calculator: your current grade and the average that you need for your target, with the weights of the gradebook or of the course guide.
• Write to a teacher: one click opens the internal mail of the site with the teacher as the recipient and a greeting.
• Files of the Resources tool by the internal mail, without a download, or with an encrypted download link (optional).
• Short names or your own names for your sites, one search for all your sites (Ctrl+K), a ZIP of all the files of a site, and a calendar export.

Privacy: your data stays in your browser. No analytics and no servers of the developers.
Privacy policy: https://github.com/chareca/aulario-plus/blob/main/PRIVACY.md
Source code: https://github.com/chareca/aulario-plus

Before you use it, read the IT rules of the UPNA. Do not use it on a shared computer.
```

**Category:** Education (if the dashboard does not have it: Productivity → Workflow & planning).

**Language:** Spanish.

**Images** (folder `store/images`):

- Icon: from the ZIP (`icons/icon128.png`).
- Screenshots (1280x800): `store/images/screenshot-1.png` to `screenshot-5.png`.
- Small promo tile (440x280): `store/images/promo-small.png`.

**Additional fields:**

- Homepage URL: `https://github.com/chareca/aulario-plus`
- Support URL: `https://github.com/chareca/aulario-plus/issues`

## Privacy tab

**Single purpose:**

```
Improve the use of MiAulario, the Sakai virtual campus of the Universidad Pública de Navarra, for a student: keep the session active, and show and use the course data of MiAulario (deliveries, announcements, grades, course guides, internal mail, files) in one place.
```

**Permission justifications:**

| Permission | Justification |
|---|---|
| `storage` | Keeps the settings of the user and a copy of the course data of MiAulario (deliveries, announcements, grades, course guides) in the browser, for the popup and the pages of MiAulario. |
| `cookies` | Changes the session cookies of miaulario.unavarra.es and sso.unavarra.es into persistent cookies, so that the MiAulario session stays after the browser closes, and removes them when the user logs out. This is the main function of the extension. |
| `alarms` | Sends a request to MiAulario every 3 to 10 minutes to keep the session active, and reads the course data at intervals. |
| `notifications` | Tells the user about a new grade in MiAulario (the site and the item, not the grade). |
| Host `https://miaulario.unavarra.es/*` | Reads the course data of the user from MiAulario, keeps the session active, adds functions to its pages (course guide, internal mail, search, names of sites). |
| Host `https://sso.unavarra.es/*` | Makes the cookie of the UPNA login page persistent (the extension does not send requests to this site). |
| Host `https://www.unavarra.es/*` | Reads the public course guides of the UPNA (www.unavarra.es/ficha-asignaturaDOA), to show the assessment table of each site. |
| Optional hosts (send.vis.ee, send.artemislena.eu, send.monks.tools, is.gd, spoo.me, tinyurl.com) | Only if the user enables the download links in the settings: the extension uploads a file, encrypted in the browser, to the Send server that the user selects, and makes a short link. |

**Remote code:** No, I am not using remote code. (All the JavaScript is in the package. There is no build step that changes the code.)

**Data usage** (what the extension collects):

- ✅ **Authentication information:** the extension reads and changes the session cookies of MiAulario, only in the browser. They do not go to the developers or to other sites.
- ✅ **Website content:** only when the user makes a download link, the selected files go, encrypted, to the Send server that the user selected.
- Do not select the other types.

Certify the three points (no sale of data, no use that is not related to the single purpose, no use for credit).

**Privacy policy URL:** `https://github.com/chareca/aulario-plus/blob/main/PRIVACY.md`

## Notes for the reviewer (test instructions)

```
MiAulario requires an account of the Universidad Pública de Navarra, so the reviewer cannot log in. To see all the functions with synthetic data and the real code of the extension:

1. git clone https://github.com/chareca/aulario-plus && cd aulario-plus
2. node tests/harness/make.js   (Node.js 22 or later, no packages)
3. python3 -m http.server 8766 --directory tests/harness/out
4. Open http://localhost:8766/popup.html (the popup: deliveries, inbox, new items, grades with the calculator, sites, settings) and http://localhost:8766/site.html (a page with the structure of MiAulario: the course guide box, the buttons next to the site names, the Resources list with the internal mail window). http://localhost:8766/site.html?mine=1 shows "Mi sitio".

The extension sends requests only to miaulario.unavarra.es and www.unavarra.es (public course guides), and, only if the user enables the download links, to the selected Send server and shortener.
```
