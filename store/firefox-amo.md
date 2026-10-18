# Firefox Add-ons (AMO): the listing of Aulario Plus

Submit the first version at https://addons.mozilla.org/developers/addon/submit/ with the file `dist/aulario-plus-firefox-vX.Y.Z.zip` ("On this site": listed). Then copy these texts.

The add-on id is `@aulario-plus.chareca` (in the manifest). Do not change it: AMO keeps one id for each add-on.

## Listing

**Name:** Aulario Plus

**Summary** (250 characters at most):

- es: `Mejora MiAulario, el campus virtual de la UPNA: mantiene la sesión activa y reúne entregas, anuncios, notas con calculadora, guías docentes, búsqueda y Correo interno. Extensión no oficial: la UPNA no la hizo.`
- en: `Improves MiAulario, the virtual campus of the UPNA: keeps the session active and shows deliveries, announcements, grades with a calculator, course guides, search and internal mail in one place. Not an official extension.`

**Description:** the same texts as in `store/chrome-web-store.md` (es and en).

**Categories:** Alerts & Updates; Other.

**Tags:** education, university, upna, miaulario, sakai.

**Homepage:** `https://github.com/chareca/aulario-plus`

**Support site:** `https://github.com/chareca/aulario-plus/issues`

**License:** select a license in the form (the repository has no license file yet).

**Privacy policy:** paste the text of `PRIVACY.md` (AMO shows it on the page of the add-on).

**Images:** the screenshots of `store/images` (1280x800).

## Data collection

The manifest declares `data_collection_permissions`:

- required: `none`.
- optional: `websiteContent` (the encrypted files of a download link). The extension asks for this consent only when the user enables the download links (a separate click in the settings).

## Notes for the reviewer

```
MiAulario requires an account of the Universidad Pública de Navarra, so the reviewer cannot log in. To see all the functions with synthetic data and the real code of the extension:

1. git clone https://github.com/chareca/aulario-plus && cd aulario-plus
2. node tests/harness/make.js   (Node.js 22 or later, no packages)
3. python3 -m http.server 8766 --directory tests/harness/out
4. Open http://localhost:8766/popup.html and http://localhost:8766/site.html (and site.html?mine=1 for "Mi sitio").

The code is not minified or transpiled: build.sh only copies extension/common and the manifest of each browser into dist/, and makes the ZIP. No source code archive is necessary.

The extension changes the session cookies of miaulario.unavarra.es and sso.unavarra.es into persistent cookies (its main function), and sends a request every 3 to 10 minutes to keep the MiAulario session active. It sends requests only to miaulario.unavarra.es and www.unavarra.es (public course guides), and, only if the user enables the download links, to the selected Send server and shortener.
```
