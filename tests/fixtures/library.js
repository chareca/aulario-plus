// Synthetic pages and PDF files of the library of the UPNA (www.unavarra.es/biblioteca), with the same structure as the
// real ones (October 2026): the page of a campus, the list of the board, two notices, and a calendar of Canva (a font
// Type0 with ToUnicode, a text box in a form for each number, the legend in colors). For tests/library.test.js and the
// harness (tests/harness/make.js).
'use strict';
const zlib = require('node:zlib');

const BLUE = [0.016, 0.329, 0.475]; // the legend: 8:00 - 21:00
const BLUE_DAY = [0.039, 0.4, 0.553]; // the numbers of the usual days: another blue
const GREEN = [0.51, 0.722, 0.259]; // 9:00 - 22:45
const RED = [0.855, 0.161, 0.11]; // cerrado
const GREY = [0.357, 0.365, 0.384]; // days before the period: no color of the legend
const AULA = [0.902, 0.569, 0.176]; // an "aula" (not the library): its days are not known

// A PDF file: pages of texts { text, x, y, rgb, form (a form XObject, a literal string) or not (a hex string in the page;
// the content of the page compressed) }.
function canvaPdf(pages) {
  const chars = [...new Set(pages.flatMap((p) => p.flatMap((t) => [...t.text])))];
  const code = (c) => chars.indexOf(c) + 1;
  const two = (text) => [...text].map((c) => String.fromCharCode(code(c) >> 8, code(c) & 255)).join('');
  const literal = (text) => `(${two(text).replace(/[\\()]/g, (c) => `\\${c}`)})`;
  const hex = (text) => `<${[...text].map((c) => code(c).toString(16).padStart(4, '0')).join('')}>`;
  const rg = (c) => `${c.map((x) => x.toFixed(4)).join(' ')} rg`;
  const objects = [];
  const add = (body) => objects.push(body) && objects.length;
  const stream = (dict, data, deflate) => {
    const raw = deflate ? zlib.deflateSync(Buffer.from(data, 'latin1')).toString('latin1') : data;
    return `<< ${dict}${deflate ? ' /Filter /FlateDecode' : ''} /Length ${raw.length} >>\nstream\n${raw}\nendstream`;
  };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(''); // the pages, below
  const cmap = `/CIDInit /ProcSet findresource begin\nbegincmap\n1 begincodespacerange <0000> <FFFF> endcodespacerange\n${chars.length} beginbfchar\n${chars.map((c) => `<${code(c).toString(16).padStart(4, '0')}> <${c.charCodeAt(0).toString(16).padStart(4, '0')}>`).join('\n')}\nendbfchar\nendcmap`;
  const toUnicode = add(stream('', cmap));
  const font = add(`<< /Type /Font /Subtype /Type0 /BaseFont /AAAAAA+Biko /Encoding /Identity-H /ToUnicode ${toUnicode} 0 R >>`);
  const kids = [];
  for (const texts of pages) {
    const forms = {};
    let content = 'q\n.24 0 0 -.24 0 263 cm\n';
    for (const [i, t] of texts.entries()) {
      if (t.form) {
        const name = `X${i}`;
        forms[name] = add(stream(`/Type /XObject /Subtype /Form /BBox [0 0 100 40] /Resources << /Font << /F1 ${font} 0 R >> >>`,
          `q\n${rg(t.rgb)}\nBT\n/F1 12 Tf\n1 0 0 -1 0 11 Tm\n${literal(t.text)} Tj\nET\nQ`));
        content += `q\n1 0 0 1 ${t.x} ${t.y} cm\n/${name} Do\nQ\n`;
      } else content += `q\n${rg(t.rgb)}\nBT\n/F1 30 Tf\n1 0 0 -1 ${t.x} ${t.y} Tm\n${hex(t.text)} Tj\nET\nQ\n`;
    }
    content += 'Q';
    const contents = add(stream('', content, !texts.some((t) => t.form)));
    const xobjects = Object.entries(forms).map(([n, ref]) => `/${n} ${ref} 0 R`).join(' ');
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 330 263] /Resources << /Font << /F1 ${font} 0 R >> /XObject << ${xobjects} >> >> /Contents ${contents} 0 R >>`));
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const body = objects.map((o, i) => `${i + 1} 0 obj\n${o}\nendobj\n`).join('');
  return Buffer.from(`%PDF-1.4\n%\xe2\xe3\xcf\xd3\n${body}trailer\n<< /Root 1 0 R >>\n%%EOF\n`, 'latin1');
}

// A month: its title, the legend and the days in a grid of weeks from Monday (green: the days in "green"; red: in "red"
// and the other weekends, as in the real ones; grey: before "from"; aula: in the color of an "aula"). yearText: the year
// on the page ('' without one); usual: the blue of the legend is "horario habitual" (no hours); twoHours: the blue of the
// legend has two hours.
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function month(name, year, count, { green = [], red = [], aula = [], from = 1, form = true, splitLegend = false, yearText = String(year), usual = false, twoHours = false } = {}) {
  const weekend = (d) => [0, 6].includes(new Date(year, MONTHS.indexOf(name), d).getDay());
  const blue = usual ? [{ text: 'horario habitual de la biblioteca', rgb: BLUE }]
    : [{ text: 'biblioteca / liburutegia: 8:00 - 21:00 h.', rgb: BLUE }, ...(twoHours ? [{ text: 'biblioteca / liburutegia: 8:00 - 14:30 h.', rgb: BLUE }] : [])];
  const legend = splitLegend
    ? [{ text: 'biblioteca / liburutegia', rgb: BLUE }, { text: '8:00 - 21:00 h.', rgb: BLUE }, { text: 'biblioteca / liburutegia', rgb: GREEN }, { text: '9:00 - 22:45 h.', rgb: GREEN }]
    : [...blue, { text: 'biblioteca / liburutegia: 9:00 - 22:45 h.', rgb: GREEN }, ...(aula.length ? [{ text: 'aula 03 / gela 03', rgb: AULA }, { text: '9:00 - 21:45 h.', rgb: AULA }] : [])];
  return [
    { text: `${name} / apirila`, rgb: BLUE, x: 270, y: 100, form },
    ...(yearText ? [{ text: yearText, rgb: BLUE, x: 740, y: 100, form }] : []),
    ...legend.map((l, i) => ({ ...l, x: 180, y: 330 + i * 40, form })),
    { text: 'cerrado/itxita', rgb: RED, x: 180, y: 500, form },
    { text: 'AULA 04 / 04 GELA', rgb: [0, 0, 0], x: 940, y: 600, form },
    { text: '8:00 - 14:45 H.', rgb: [0, 0, 0], x: 940, y: 640, form },
    ...Array.from({ length: count }, (_, i) => {
      const d = i + 1;
      const rgb = green.includes(d) ? GREEN : red.includes(d) ? RED : aula.includes(d) ? AULA : d < from ? GREY : weekend(d) ? RED : BLUE_DAY;
      const cell = i + (new Date(year, MONTHS.indexOf(name), 1).getDay() + 6) % 7; // Monday first, as in the real ones
      return { text: String(d), rgb, x: 90 + (cell % 7) * 95, y: 560 + Math.floor(cell / 7) * 85, form };
    })
  ];
}

// The calendar of the exams of 2026 (Arrosadía): April from the 13th, May (its text in the pages, hex strings, the legend
// in two texts), and a June with a number missing (left out).
const calendarPdf = () => canvaPdf([
  month('abril', 2026, 30, { green: [18, 19, 20, 25, 26], from: 13 }),
  month('mayo', 2026, 31, { green: [1, 2, 3, 9, 10], red: [30, 31], form: false, splitLegend: true }),
  month('junio', 2026, 29, { green: [6, 7] })
]);

const campusPage = (lines) => `<html><body><p>La sede principal de la Biblioteca.</p><table><tbody><tr><td><strong>Horario:</strong></td><td colspan="3"><ul>
${lines.map((l) => `<li>${l}</li>`).join('\n')}
<li>Los horarios extraordinarios por&nbsp;calendario lectivo y otros se avisar&aacute;n oportunamente en el&nbsp;<a href="/biblioteca/tablon-de-anuncios">tabl&oacute;n de anuncios de la Biblioteca</a></li>
</ul></td></tr></tbody></table></body></html>`;
const PAGES = {
  arrosadia: campusPage(['<strong>Lunes a viernes: </strong>8:00 a 21:00 horas.&nbsp;', '<strong>S&aacute;bado y domingo: </strong>cerrado.']),
  salud: campusPage(['<strong>Lunes a viernes: </strong>8:00 a 21:00 horas.&nbsp;', '<strong>S&aacute;bados, domingos y festivos</strong>: aula de estudio de&nbsp;9:00 a 21:45 horas.']),
  tudela: campusPage(['<strong>Lunes a viernes: </strong>8:00 a 21:00&nbsp;horas.&nbsp;', '<strong>S&aacute;bado y domingo</strong>: cerrado'])
};

const entry = (date, id, title) => `<li>
	    <span class="fecha">${date}</span>

                            <a href="http://www.unavarra.es/biblioteca/tablon-de-anuncios?contentId=${id}">${title}</a>
        </li>`;
const list = (entries, years = '') => `<html><body><ul class="years">${years}</ul><ul class="listadoActualidad">${entries.join('\n')}</ul></body></html>`;
const BOARD = list([
  entry('Mi&eacute;rcoles 14 de octubre de 2026', 291288, 'Semana Internacional de Acceso Abierto 2026 (19-25 de octubre)'),
  entry('Mi&eacute;rcoles 16 de septiembre de 2026', 290965, 'Biblioteca de Ciencias de la Salud: aula de estudio abierta los fines de semana'),
  entry('Mi&eacute;rcoles 17 de junio de 2026', 290185, 'Horario de verano de las Bibliotecas: Arrosadia, Ciencias de la Salud y Tudela'),
  entry('Lunes 13 de abril de 2026', 289130, 'Horario especial de &eacute;poca de ex&aacute;menes: 18 ABRIL-14 JUNIO'),
  entry('Martes 24 de marzo de 2026', 288889, 'Semana Santa: horario')
], '<li><a href="http://www.unavarra.es/biblioteca/tablon-de-anuncios?opcion=2">2025</a></li><li><a href="http://www.unavarra.es/biblioteca/tablon-de-anuncios?opcion=3">2024</a></li>');
const BOARD_2025 = list([entry('Martes 28 de octubre de 2025', 286888, 'Horario de las bibliotecas en periodo de ex&aacute;menes (nov. 2025- en. 2026)')]);

const notice = (date, title, body) => `<html><body><div class="texto"><div>
	    <span class="fecha">${date}</span>
<h2>${title}</h2>
${body}
</div>
<br/><p class="volver" style="display:none;">Volver</p></div></body></html>`;
const NOTICES = {
  290965: notice('Mi&eacute;rcoles 16 de septiembre de 2026', 'Biblioteca de Ciencias de la Salud: aula de estudio abierta los fines de semana',
    '<p>A partir de este fin de semana, la Biblioteca de Ciencias de la Salud habilitar&aacute; un aula de estudio que permanecer&aacute; abierta de 9:00 a 21:45 horas (s&aacute;bados, domingos y festivos)</p>'),
  290185: notice('Mi&eacute;rcoles 17 de junio de 2026', 'Horario de verano de las Bibliotecas: Arrosadia, Ciencias de la Salud y Tudela', `<table border="1"><tbody>
<tr><td>Arrosadia</td><td>Del 1 de julio al 31 de agosto, de 8.00 a 15.00 horas<br />CERRADO: del 6 al 10 de julio<br />13 y 14 de julio, de 9.00 a 13.00 horas</td></tr>
<tr><td>C. Salud</td><td><div>Del 1 de julio al 31 de agosto, de 8.00 a 14.30 horas</div><div>CERRADO: del 6&nbsp;al 10&nbsp;de julio</div></td></tr>
<tr><td>Tudela</td><td>Del 1 de julio al 31 de agosto, de 8.00 a 14.30 horas<br />CERRADO: del 24 al 31 de julio<br />3 y 4 de agosto, de 9.00 a 13.00 horas&nbsp;</td></tr>
<tr><td>Aula 015 C. Salud</td><td>de 14.30 a 21:00.<br />CERRADO: del 6 al 14 de julio</td></tr>
</tbody></table>
<p>S&Aacute;BADOS, DOMINGOS Y FESTIVOS PERMANECER&Aacute;N CERRADAS.&nbsp;</p>`),
  289130: notice('Lunes 13 de abril de 2026', 'Horario especial de &eacute;poca de ex&aacute;menes: 18 ABRIL-14 JUNIO', `<table border="1"><tbody>
<tr></tr>
<tr><td><strong>Periodo de ex&aacute;menes</strong></td><td>D&iacute;as</td><td>Horario</td><td>Calendario</td></tr>
<tr><td><strong>Arrosad&iacute;a (biblioteca)</strong></td><td>abril: 18, 19, 20, 25 y 26<br />mayo: 1, 2, 3, 9 y 10</td><td><br />9:00-22:45</td><td><a href="/digitalAssets/289/289130_1000002026_examenes_arrosadia.pdf">calendario</a></td></tr>
<tr><td><strong>Arrosad&iacute;a (aula 04)</strong></td><td>s&aacute;bados</td><td><br />8:00-14:45<br />&nbsp;</td></tr>
<tr><td><strong>Ciencias de la Salud y Tudela</strong></td><td>abril: 18, 19, 20, 25 y 26</td><td><br />9:00-21:45</td><td><a href="/digitalAssets/289/289130_1000002026_examenes_sani_tudela.pdf">calendario</a></td></tr>
</tbody></table>
<p>Biblioteca de Arrosad&iacute;a:&nbsp;<strong>sistema de acceso de tornos. <a href="https://portal.unavarra.es/group/biblioteca/tornos-de-acceso">Reg&iacute;strate</a></strong><br />
Ciencias de la Salud:&nbsp;<strong>necesario mostrar identificaci&oacute;n acreditativa UPNA para entrar.</strong></p>`),
  288889: notice('Martes 24 de marzo de 2026', 'Semana Santa: horario ',
    '<p>Los d&iacute;as 2, 3, 4, 5 y 6 de abril las bibliotecas de Arrosadia y Tudela permanecer&aacute;n cerradas.</p><p>Los d&iacute;as 2, 3, 4, 5 y 6 de abril la biblioteca de Ciencias de la Salud abrir&aacute; en horario de 9h. a 21h.</p><p>Los pr&eacute;stamos realizados desde el 26 de marzo se podr&aacute;n devolver hasta el 13 de abril</p>'),
  286888: notice('Martes 28 de octubre de 2025', 'Horario de las bibliotecas en periodo de ex&aacute;menes (nov. 2025- en. 2026)',
    '<p>A partir del s&aacute;bado 22 de noviembre y hasta el domingo 18 de enero (&eacute;poca de ex&aacute;menes) las bibliotecas abrir&aacute;n los d&iacute;as festivos y fines de semana:</p><p>Campus de Arrosad&iacute;a: de 09:00 a 22:45 h.</p><p>En festivos navide&ntilde;os: 24, 25 y 31 de dic. y 1 de enero CERRADO</p>')
};

// The hours of the sports facilities (www.unavarra.es/deportes/instalaciones/horario).
const SPORTS = `<html><body><div class="texto">
<h2 class="tituloPagina">Horario de las instalaciones deportivas</h2>
<table style="width:70%"><caption>HORARIO</caption><tbody>
<tr><th>Horario de acceso</th><th>&nbsp;</th></tr>
<tr><td>&nbsp;&nbsp; De lunes a viernes, de 7:30 a 22:00<br />&nbsp;&nbsp; S&aacute;bados, de 9:00 a 22:00<br />&nbsp;&nbsp; Domingos y festivos, de 9:00 a 14:00</td><td>&nbsp;</td></tr>
<tr><th>Piscina</th><th>&nbsp;</th></tr>
<tr><td>&nbsp;&nbsp; De lunes a viernes, de 7:30 a 21:00<br />&nbsp;&nbsp; S&aacute;bados, 9:00 a 14:00<br />&nbsp;&nbsp; Domingos y festivos, cerrada</td><td>&nbsp;</td></tr>
<tr><th colspan="2">Atenci&oacute;n al p&uacute;blico de la Oficina de Deportes</th></tr>
<tr><td>&nbsp;&nbsp; De lunes a viernes,&nbsp;de 9:00 a 14:30</td><td>&nbsp;</td></tr>
</tbody></table></div></body></html>`;

// The cafeterias and the dining hall (www.unavarra.es/restauracion): a table for each place.
const foodTable = (caption, extra, course, holidays) => `<table class="dcf-table"><caption>${caption}</caption>
<thead><tr><th scope="col">PER&Iacute;ODO</th><th scope="col">HORARIO APERTURA</th><th scope="col">HORARIO ${extra}</th></tr></thead>
<tbody><tr><th scope="row">Curso acad&eacute;mico</th><td>${course[0]}</td><td>${course[1]}</td></tr>
<tr><th scope="row">Vacaciones</th><td>${holidays[0]}</td><td>${holidays[1]}</td></tr>
<tr><th scope="row">Fines de semana y festivos</th><td>Cerrado</td><td><span>&nbsp;</span></td></tr></tbody></table>`;
const CAFETERIAS = `<html><body><div class="texto"><p><h2><img alt="" src="x.jpg" /></h2>
${foodTable('Cafeter&iacute;a Aulario (Aramark)', 'COCINA', ['7.30 - 19.30', '8.00 - 19.00'], ['7.30 - 16.30', '9.00 - 16.00'])}
${foodTable('Cafeter&iacute;a El Sario&nbsp;(The Sario Experience)', 'COMIDAS', ['9.00 - 17.00&nbsp;', '13.00 - 16.00'], ['Cerrado', '&nbsp;'])}
${foodTable('Cafeter&iacute;a Ciencias de la Salud (El fog&oacute;n errante)', '<strong>COMIDAS</strong>', ['9.00 - 19.00', '13.00 - 16.00'], ['Cerrado', '&nbsp;'])}
${foodTable('Cafeter&iacute;a Tudela (Aramark)', 'COMIDAS', ['9.00 - 19.00', '13.00 - 16.00'], ['Cerrado', '&nbsp;'])}
</div></body></html>`;
const COMEDORES = `<html><body><div class="texto">${foodTable('Edificio comedores (Aramark)', 'COMIDAS', ['9.00 - 16.30', '13.00 - 16.00'], ['Cerrado', '&nbsp;'])}</div></body></html>`;

// The answers of www.unavarra.es: address -> text or bytes.
function routes() {
  const B = 'https://www.unavarra.es/biblioteca';
  const out = {
    [`${B}/la-biblioteca/Campus+de+Arrosadia`]: PAGES.arrosadia,
    [`${B}/la-biblioteca/Campus+de+Ciencias+de+la+Salud`]: PAGES.salud,
    [`${B}/la-biblioteca/Campus+de+Tudela`]: PAGES.tudela,
    [`${B}/tablon-de-anuncios`]: BOARD,
    'https://www.unavarra.es/deportes/instalaciones/horario?languageId=100000': SPORTS,
    'https://www.unavarra.es/restauracion/cafeterias?languageId=100000': CAFETERIAS,
    'https://www.unavarra.es/restauracion/comedores?languageId=100000': COMEDORES,
    [`${B}/tablon-de-anuncios?pagina=1`]: list([]),
    [`${B}/tablon-de-anuncios?opcion=2`]: BOARD_2025,
    'https://www.unavarra.es/digitalAssets/289/289130_1000002026_examenes_arrosadia.pdf': calendarPdf()
  };
  for (const [id, html] of Object.entries(NOTICES)) out[`${B}/tablon-de-anuncios?contentId=${id}`] = html;
  return out;
}

module.exports = { canvaPdf, month, calendarPdf, campusPage, PAGES, BOARD, NOTICES, SPORTS, CAFETERIAS, COMEDORES, routes, entry, list, notice, colors: { BLUE, BLUE_DAY, GREEN, RED, GREY } };
