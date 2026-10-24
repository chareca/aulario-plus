// Aulario Plus: the hours of the library of the UPNA (www.unavarra.es/biblioteca) for "Mi sitio" (content-library.js).
// The usual hours of the campus of the user (the setting "libraryCampus": its page), and the notices of the board with
// other hours (exams, summer, Easter): their text for the campus, and their calendar if they have one (a PDF file of
// Canva: the color of each day and the legend of the colors, MAK.pdfTextRuns). The background reads it all
// (MAK.loadLibrary) and keeps it for MAK.LIBRARY_MS.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  MAK.LIBRARY_MS = 12 * MAK.HOUR;
  // The form of the kept hours (storage "library"): another form (an older version) is read again at once.
  MAK.LIBRARY_FORM = 2;
  MAK.LIBRARY_BOARD = 'https://www.unavarra.es/biblioteca/tablon-de-anuncios';
  // The hours of the sports facilities of the UPNA (Arrosadía): the access (also the gym) and the pool.
  MAK.SPORTS_HOURS = 'https://www.unavarra.es/deportes/instalaciones/horario?languageId=100000'; // in Spanish
  // The campuses: the page with their usual hours, and the words that name them (in a notice, a row, a PDF file).
  MAK.LIBRARY_CAMPUSES = {
    arrosadia: { page: 'https://www.unavarra.es/biblioteca/la-biblioteca/Campus+de+Arrosadia', names: /arrosad[ií]a/i },
    salud: { page: 'https://www.unavarra.es/biblioteca/la-biblioteca/Campus+de+Ciencias+de+la+Salud', names: /salud|sani(?:_|\b)/i },
    tudela: { page: 'https://www.unavarra.es/biblioteca/la-biblioteca/Campus+de+Tudela', names: /tudela/i }
  };
  const named = (text) => Object.keys(MAK.LIBRARY_CAMPUSES).filter((k) => MAK.LIBRARY_CAMPUSES[k].names.test(text));

  // An address of the library of the UPNA (its pages, the board) or of its PDF files, or the hours of the sports facilities,
  // with https; else null.
  MAK.libraryUrl = function (href) {
    try {
      const u = new URL(String(href).trim(), 'https://www.unavarra.es/biblioteca/');
      if (u.hostname !== 'www.unavarra.es' || (u.protocol !== 'https:' && u.protocol !== 'http:')) return null;
      u.protocol = 'https:';
      u.hash = '';
      return u.pathname.startsWith('/biblioteca/') || u.pathname === new URL(MAK.SPORTS_HOURS).pathname || /^\/digitalAssets\/[^?#]+\.pdf$/i.test(u.pathname) ? u.href : null;
    } catch {
      return null;
    }
  };

  // ---- HTML as text (the background has no DOMParser) ------------------------------------------------------------

  const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", laquo: '«', raquo: '»', iexcl: '¡', iquest: '¿',
    ordm: 'º', ordf: 'ª', ndash: '–', mdash: '—', hellip: '…', middot: '·', euro: '€', deg: '°', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
  const MARKS = { acute: '́', grave: '̀', uml: '̈', circ: '̂', tilde: '̃', cedil: '̧' };
  const entity = (name) => {
    if (Object.hasOwn(ENTITIES, name)) return ENTITIES[name];
    const m = /^([a-zA-Z])(acute|grave|uml|circ|tilde|cedil)$/.exec(name);
    return m ? (m[1] + MARKS[m[2]]).normalize('NFC') : null;
  };
  const decode = (s) => s.replace(/&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]{2,8}));/gi, (all, d, x, n) => {
    if (n) return entity(n) ?? all;
    const c = parseInt(d || x, d ? 10 : 16);
    return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : '';
  });
  // An HTML fragment as lines of text: a line for each block (p, div, li, a row, br), at most 300 characters each.
  const lines = (html) =>
    decode(String(html)
      .replace(/<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<br\b[^>]*>|<\/?(?:p|div|li|ul|ol|h\d|tr|table|tbody|caption)\b[^>]*>/gi, '\n')
      .replace(/<\/t[dh]\s*>/gi, ' ')
      .replace(/<[^>]*>/g, ''))
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim().slice(0, 300))
      .filter(Boolean);
  // Spanish without accents, in lower case (to compare words).
  const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // ---- Dates and hours in Spanish ----------------------------------------------------------------------------------

  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  // A month in a folded text: its index; also the short forms ("dic.", "sept.", "en." before a year).
  const MONTH_WORDS = 'enero|ene|en(?=\\.)|febrero|feb|marzo|mar|abril|abr|mayo|may|junio|jun|julio|jul|agosto|ago|septiembre|setiembre|sept|sep|set|octubre|oct|noviembre|nov|diciembre|dic';
  const monthIndex = (w) => {
    const s = fold(w).replace(/\.$/, '');
    if (s.startsWith('set')) return 8;
    return MONTHS.findIndex((m) => m.startsWith(s.slice(0, 3)) || (s === 'en' && m === 'enero'));
  };
  const startOfDay = (ms) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  // "Miércoles 14 de octubre de 2026" -> its time (local); NaN.
  MAK.spanishDate = function (text) {
    const m = /(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/.exec(fold(decode(String(text))));
    const month = m ? MONTHS.indexOf(m[2]) : -1;
    return month < 0 ? NaN : new Date(Number(m[3]), month, Number(m[1])).getTime();
  };
  // The hours in a text: "8:00 a 21:00", "9.00-22:45" -> "8:00–21:00"; ''.
  const TIME = /(\d{1,2})[:.](\d{2})\s*(?:-|–|a)\s*(\d{1,2})[:.](\d{2})/;
  const hoursOf = (text) => {
    const m = TIME.exec(String(text));
    if (m) return `${Number(m[1])}:${m[2]}–${Number(m[3])}:${m[4]}`;
    const h = /(\d{1,2})\s*h\b\.?\s*(?:-|–|a)\s*(\d{1,2})\s*h\b/.exec(String(text)); // "de 9h. a 21h."
    return h ? `${Number(h[1])}:00–${Number(h[2])}:00` : '';
  };

  // The days that a text names: "Del 1 de julio al 31 de agosto", "abril: 18, 19 y 26", "24, 25 y 31 de dic. y 1 de
  // enero". The year: the one in the text, else the one of the notice (a month two or more before it: the next year).
  // { from, to } (to: the day after the last one) or null.
  MAK.noticePeriod = function (texts, published) {
    const pub = new Date(published);
    const s = fold(texts.join('\n'));
    const days = [];
    const add = (day, month, year) => {
      const d = Number(day);
      if (month < 0 || d < 1 || d > 31) return;
      const y = year ? Number(year) : pub.getFullYear() + (month < pub.getMonth() - 2 ? 1 : 0);
      const t = new Date(y, month, d);
      if (t.getMonth() === month) days.push(t.getTime());
    };
    const nums = (list) => list.match(/\d{1,2}/g) || [];
    for (const m of s.matchAll(new RegExp(`(\\d{1,2})((?:\\s*(?:,|y|al|a|-|–)\\s*\\d{1,2})*)\\s+(?:de\\s+)?(${MONTH_WORDS})\\b\\.?(?:\\s+(?:de\\s+)?(20\\d\\d))?`, 'g'))) {
      for (const d of nums(m[1] + m[2])) add(d, monthIndex(m[3]), m[4]);
    }
    for (const m of s.matchAll(new RegExp(`\\b(${MONTH_WORDS})\\b\\.?\\s*:\\s*(\\d{1,2}(?:\\s*(?:,|y)\\s*\\d{1,2})*)`, 'g'))) {
      for (const d of nums(m[2])) add(d, monthIndex(m[1]));
    }
    if (!days.length) return null;
    return { from: Math.min(...days), to: Math.max(...days) + MAK.DAY };
  };

  // The days that a line of a notice names, as spans { from, to } (to: the day after): ranges ("Del 1 de julio al 31 de
  // agosto", "del 6 al 10 de julio", "A partir del sábado 22 de noviembre y hasta el domingo 18 de enero") and single days
  // ("13 y 14 de julio", "abril: 18, 19 y 26", "24, 25 y 31 de dic. y 1 de enero").
  function spansIn(line, pub) {
    const day = (d, month, year) => {
      if (month < 0 || Number(d) < 1 || Number(d) > 31) return NaN;
      const t = new Date(year ? Number(year) : pub.getFullYear() + (month < pub.getMonth() - 2 ? 1 : 0), month, Number(d));
      return t.getMonth() === month ? t.getTime() : NaN;
    };
    const out = [];
    const add = (from, to) => { if (from && to && from <= to) out.push({ from, to: to + MAK.DAY }); };
    const W = `(${MONTH_WORDS})\\b\\.?`;
    let s = fold(line);
    s = s.replace(new RegExp(`\\b(?:del?|desde el|a partir del?)\\s+(?:[a-z]+\\s+)?(\\d{1,2})(?:\\s+de\\s+${W})?(?:\\s+de\\s+(20\\d\\d))?\\s+(?:y\\s+)?(?:al|a|hasta(?:\\s+el)?)\\s+(?:[a-z]+\\s+)?(\\d{1,2})\\s+de\\s+${W}(?:\\s+de\\s+(20\\d\\d))?`, 'g'),
      (all, d1, m1, y1, d2, m2, y2) => {
        const end = day(d2, monthIndex(m2), y2);
        add(day(d1, monthIndex(m1 || m2), y1 || y2), end);
        return ' ';
      });
    const single = (list, m, y) => { for (const d of list.match(/\d{1,2}/g) || []) { const t = day(d, monthIndex(m), y); add(t, t); } };
    for (const m of s.matchAll(new RegExp(`(\\d{1,2})((?:\\s*(?:,|y)\\s*\\d{1,2})*)\\s+(?:de\\s+)?${W}(?:\\s+(?:de\\s+)?(20\\d\\d))?`, 'g'))) single(m[1] + m[2], m[3], m[4]);
    for (const m of s.matchAll(new RegExp(`\\b${W}\\s*:\\s*(\\d{1,2}(?:\\s*(?:,|y)\\s*\\d{1,2})*)`, 'g'))) single(m[2], m[1]);
    return out;
  }

  // The hours of a notice in words (the blocks of the campus, MAK.parseNotice): rules { from, to, hours, closed, days }
  // (days: only those days of the week; null: all) and the days of the week of the whole notice ("Sábados, domingos y
  // festivos permanecerán cerradas": weekly). A line with days and hours (or "cerrado") is a rule; a line with only days
  // takes the hours of the next line with only hours (a row of a table); a line with days and no hours ("los préstamos ...
  // hasta el 13 de abril") is not about hours. { rules, weekly, from, to } or null.
  MAK.noticeRules = function (blocks, published) {
    const pub = new Date(published);
    const rules = [];
    const weekly = [];
    for (const b of blocks || []) {
      let waiting = [];
      for (const line of b.lines) {
        const spans = spansIn(line, pub);
        const closed = /cerrad/i.test(line);
        const hours = closed ? '' : hoursOf(line);
        const weekends = /fines? de semana/i.test(line) ? [0, 6] : null;
        if (spans.length) {
          const list = spans.map((x) => Object.assign(x, { days: weekends }));
          if (closed || hours) rules.push(...list.map((x) => Object.assign(x, { hours, closed })));
          else waiting.push(...list);
        } else if (closed || hours) {
          const days = [...weekdays(line)];
          if (days.length) weekly.push({ days, hours, closed });
          else if (waiting.length) rules.push(...waiting.map((x) => Object.assign(x, { hours, closed })));
          waiting = [];
        }
      }
    }
    if (!rules.length) return null;
    return { rules: rules.slice(0, 60), weekly: weekly.slice(0, 7), from: Math.min(...rules.map((r) => r.from)), to: Math.max(...rules.map((r) => r.to)) };
  };

  // ---- The pages -------------------------------------------------------------------------------------------------

  // The days of the week that a text names (0 = Sunday): "Lunes a viernes", "Sábados, domingos y festivos".
  const WEEK = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const DAY_WORDS = 'lunes|martes|miercoles|jueves|viernes|sabados?|domingos?';
  const weekday = (w) => WEEK.findIndex((d) => w.startsWith(d));
  function weekdays(text) {
    const s = fold(text);
    const out = new Set();
    for (const m of s.matchAll(new RegExp(`(${DAY_WORDS})\\s+a\\s+(${DAY_WORDS})`, 'g'))) {
      for (let d = weekday(m[1]), k = 0; k < 7; d = (d + 1) % 7, k++) {
        out.add(d);
        if (d === weekday(m[2])) break;
      }
    }
    for (const m of s.matchAll(new RegExp(DAY_WORDS, 'g'))) out.add(weekday(m[0]));
    return out;
  }

  // The page of a campus: the lines of its hours ("Lunes a viernes: 8:00 a 21:00 horas.") and the hours of each day of
  // the week (0 = Sunday): { hours: "8:00–21:00" } or { closed: true }, null if the page does not say. null: no hours.
  MAK.parseLibraryPage = function (html) {
    const s = String(html);
    const at = s.search(/Horario:?\s*<\/strong>|Horario:/i);
    if (at < 0) return null;
    const end = s.indexOf('</ul>', at);
    const found = lines(s.slice(at, end < 0 ? at + 3000 : end)).slice(1)
      .filter((l) => !/extraordinari|tabl[oó]n de anuncios/i.test(l)).slice(0, 8);
    return found.length ? { lines: found, week: weekOf(found) } : null;
  };

  // The hours of each day of the week (0 = Sunday) in lines as "Lunes a viernes: 8:00 a 21:00 horas.", "Sábados, 9:00 a
  // 14:00", "Domingos y festivos, cerrada": { hours: "8:00–21:00" } or { closed: true }; null if no line says.
  function weekOf(found) {
    const week = Array(7).fill(null);
    for (const l of found) {
      const day = /cerrad/i.test(l) ? { closed: true } : hoursOf(l) ? { hours: hoursOf(l) } : null;
      if (day) for (const d of weekdays(l)) if (!week[d]) week[d] = day;
    }
    return week;
  }
  // A text of hours, shorter: "De lunes a viernes, de 7:30 a 22:00" -> "L-V, de 7:30 a 22:00".
  MAK.shortDays = (text) => String(text).replace(/\b(?:de\s+)?lunes\s+a\s+viernes\b/gi, 'L-V');

  // The hours of today of a week (weekOf), the usual ones: { hours, closed, usual: true } or null.
  MAK.weekToday = function (week, now = Date.now()) {
    const w = Array.isArray(week) ? week[new Date(now).getDay()] : null;
    return w ? { hours: w.hours || '', closed: !!w.closed, usual: true } : null;
  };

  // The page of the hours of the sports facilities: its table, a part under each head ("Horario de acceso": also the gym;
  // "Piscina"; the office is left out). { access: { lines, week }, pool: { lines, week } } (a part can be null) or null.
  MAK.parseSportsPage = function (html) {
    const s = String(html);
    const at = s.indexOf('class="texto"');
    const end = at < 0 ? -1 : s.indexOf('</table>', at);
    if (end < 0) return null;
    const parts = { access: [], pool: [] };
    let part = null;
    for (const row of s.slice(at, end).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      if (/<th\b/i.test(row[1])) {
        const head = fold(lines(row[1]).join(' '));
        part = /acceso/.test(head) ? 'access' : /piscina/.test(head) ? 'pool' : null;
      } else if (part) {
        const cell = /<td\b[^>]*>([\s\S]*?)<\/td>/i.exec(row[1]);
        if (cell) parts[part].push(...lines(cell[1]).slice(0, 8));
      }
    }
    const of = (found) => (found.length ? { lines: found.slice(0, 8), week: weekOf(found) } : null);
    const out = { access: of(parts.access), pool: of(parts.pool) };
    return out.access || out.pool ? out : null;
  };

  // A page of the list of the board: its notices [{ id, date, title, url }] and the links to the other years.
  MAK.parseBoardList = function (html) {
    const s = String(html);
    const items = [];
    for (const m of s.matchAll(/<span class="fecha">([^<]{1,80})<\/span>[\s\S]{0,600}?<a\s[^>]*href="([^"]*contentId=(\d{1,12})[^"]*)"[^>]*>([\s\S]{0,400}?)<\/a>/g)) {
      const url = MAK.libraryUrl(decode(m[2]));
      const date = MAK.spanishDate(m[1]);
      const title = lines(m[4]).join(' ');
      if (url && title && date) items.push({ id: m[3], date, title, url });
    }
    const years = [];
    for (const m of s.matchAll(/<a\s[^>]*href="([^"]*opcion=\d+[^"]*)"[^>]*>\s*(20\d\d)\s*<\/a>/g)) {
      const url = MAK.libraryUrl(decode(m[1]));
      if (url) years.push({ year: Number(m[2]), url });
    }
    return { items, years };
  };

  // A notice about hours, for a campus: "horario" or "aula de estudio" in the title, and no other campus alone.
  MAK.isHoursNotice = function (title, campus) {
    if (!/horario|aula de estudio/.test(fold(title))) return false;
    const n = named(title);
    return !n.length || n.includes(campus);
  };

  // The PDF files of an HTML fragment: [{ url, label }].
  const pdfLinks = (html) => [...String(html).matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ url: MAK.libraryUrl(decode(m[1])), label: lines(m[2]).join(' ') }))
    .filter((l) => l.url && /\.pdf$/i.test(new URL(l.url).pathname));

  // A notice: its text for a campus in blocks { head, lines } (each row of a table: its first cell and the rest; a table
  // with rows of campuses: only the rows of the campus; out of the tables: the lines that name no other campus), all its
  // text (for its dates) and its PDF file for the campus ('' without one).
  MAK.parseNotice = function (html, campus) {
    const s = String(html);
    const at = s.indexOf('class="fecha"');
    const top = at < 0 ? -1 : s.indexOf('</h2>', at);
    if (top < 0) return { blocks: [], text: [], pdf: '' };
    let end = s.indexOf('class="volver"', top);
    end = end < 0 ? Math.min(s.length, top + 30000) : s.lastIndexOf('<', end); // up to the tag of "Volver"
    const blocks = [];
    const text = [];
    const pdfs = [];
    for (const [i, part] of s.slice(top + 5, end).split(/(<table\b[\s\S]*?<\/table>)/i).entries()) {
      if (i % 2) {
        const rows = [...part.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) => {
          const cells = [...r[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => c[1]);
          const links = cells.flatMap(pdfLinks);
          const labels = new Set(links.map((l) => l.label));
          return { head: cells.length ? lines(cells[0]).join(' ') : '', lines: cells.slice(1).flatMap(lines).filter((l) => !labels.has(l)), links };
        }).filter((r) => r.head || r.lines.length);
        const byCampus = rows.some((r) => named(r.head).length);
        for (const r of rows) {
          text.push(r.head, ...r.lines);
          for (const l of r.links) pdfs.push({ url: l.url, words: `${l.url} ${l.label} ${r.head}` });
          if (!byCampus || named(r.head).includes(campus)) blocks.push({ head: r.head, lines: r.lines });
        }
      } else {
        const links = pdfLinks(part);
        const labels = new Set(links.map((l) => l.label));
        for (const l of links) pdfs.push({ url: l.url, words: `${l.url} ${l.label}` });
        const found = lines(part).filter((l) => !labels.has(l));
        text.push(...found);
        const mine = found.filter((l) => !named(l).length || named(l).includes(campus));
        if (mine.length) blocks.push({ head: '', lines: mine });
      }
    }
    const pick = pdfs.find((p) => named(p.words).includes(campus)) || (pdfs.length === 1 && !named(pdfs[0].words).length ? pdfs[0] : null);
    return { blocks: blocks.slice(0, 12).map((b) => ({ head: b.head, lines: b.lines.slice(0, 12) })), text, pdf: pick ? pick.url : '' };
  };

  // ---- The calendar of a PDF file ------------------------------------------------------------------------------------

  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const SAME = 0.06; // the same color (the legend and its hours)
  const NEAR = 0.2; // a day of the color of the legend (Canva uses several blues)

  // The calendar of a PDF file of the library (MAK.pdfTextRuns): a month on each page, with the legend of the colors
  // ("biblioteca: 9:00 - 22:45 h.", "cerrado") and the numbers of the days in color. { legend: [{ hours, closed }],
  // months: [{ y, m, days: [the index in the legend of each day, -1: no color of the legend] }] } or null. A page whose
  // numbers are not exactly the days of its month is left out.
  MAK.libraryCalendar = function (runs) {
    const legend = [];
    const months = [];
    for (const page of [...new Set(runs.map((r) => r.page))].slice(0, 24)) {
      const rs = runs.filter((r) => r.page === page);
      const top = [...rs].sort((a, b) => b.y - a.y);
      const isDay = (r) => /^\d{1,2}$/.test(r.text);
      const title = top.find((r) => !isDay(r) && r.text.length < 60 && new RegExp(`^(${MONTHS.join('|')})\\b`).test(fold(r.text)));
      const year = top.map((r) => /\b(20\d\d)\b/.exec(r.text)).find(Boolean);
      if (!title || !year) continue;
      const m = MONTHS.indexOf(/^[a-z]+/.exec(fold(title.text))[0]);
      const y = Number(year[1]);
      // The legend of the page: a color with "biblioteca" or "cerrado"; its hours, in a text of the same color.
      const keys = [];
      for (const k of rs.filter((r) => /bibliotec|liburutegi|cerrad|itxit/i.test(r.text))) {
        if (keys.some((x) => distance(x.rgb, k.rgb) < SAME)) continue;
        const same = rs.filter((r) => !isDay(r) && distance(r.rgb, k.rgb) < SAME);
        const closed = same.some((r) => /cerrad|itxit/i.test(r.text));
        const hours = closed ? '' : same.map((r) => hoursOf(r.text)).find(Boolean) || '';
        if (!closed && !hours) continue;
        let index = legend.findIndex((l) => l.closed === closed && l.hours === hours);
        if (index < 0) index = legend.push({ hours, closed }) - 1;
        keys.push({ rgb: k.rgb, index });
      }
      const count = new Date(y, m + 1, 0).getDate();
      const numbers = rs.filter(isDay).map((r) => ({ n: Number(r.text), rgb: r.rgb }));
      if (numbers.length !== count || new Set(numbers.map((x) => x.n)).size !== count || numbers.some((x) => x.n < 1 || x.n > count)) continue;
      const days = Array(count).fill(-1);
      for (const x of numbers) {
        const near = keys.map((k) => ({ k, d: distance(k.rgb, x.rgb) })).sort((a, b) => a.d - b.d)[0];
        if (near && near.d < NEAR) days[x.n - 1] = near.k.index;
      }
      if (!months.some((x) => x.y === y && x.m === m)) months.push({ y, m, days });
    }
    months.sort((a, b) => a.y * 12 + a.m - (b.y * 12 + b.m));
    return months.length && legend.length ? { legend, months: months.slice(0, 12) } : null;
  };

  // ---- All of it -------------------------------------------------------------------------------------------------

  // The hours of the library for a campus and of the sports facilities: getText(url) and getBytes(url) read the pages and
  // the PDF files (the background checks the addresses). { at, campus, partial (a page failed), page: { url, lines,
  // week } or null, notices: [{ title, date, url, blocks, pdf, cal, from, to }], sports: { url, access, pool } or null }:
  // the notices of the last year about hours, of the campus, that did not end (a notice without dates: 90 days), at most
  // 4, the first one first. An error when no page answers.
  MAK.loadLibrary = async function ({ campus, getText, getBytes, now = Date.now() }) {
    const key = Object.hasOwn(MAK.LIBRARY_CAMPUSES, campus) ? campus : 'arrosadia';
    const c = MAK.LIBRARY_CAMPUSES[key];
    const sports = MAK.parseSportsPage(await getText(MAK.SPORTS_HOURS).catch(() => ''));
    const page = MAK.parseLibraryPage(await getText(c.page).catch(() => ''));
    if (!page && !sports) throw new Error('library: no hours');
    const first = MAK.parseBoardList(await getText(MAK.LIBRARY_BOARD).catch(() => ''));
    const more = [`${MAK.LIBRARY_BOARD}?pagina=1`];
    const before = first.years.find((x) => x.year === new Date(now).getFullYear() - 1);
    if (before) more.push(before.url);
    const lists = [first];
    for (const url of more) lists.push(MAK.parseBoardList(await getText(url).catch(() => '')));
    const seen = new Set();
    const items = lists.flatMap((l) => l.items)
      .filter((it) => !seen.has(it.id) && seen.add(it.id) && MAK.isHoursNotice(it.title, key) && it.date <= now && now - it.date < 365 * MAK.DAY)
      .sort((a, b) => b.date - a.date)
      .slice(0, 6);
    const today = startOfDay(now);
    const notices = [];
    for (const it of items) {
      const html = await getText(it.url).catch(() => '');
      if (!html) continue;
      const n = MAK.parseNotice(html, key);
      let cal = null;
      if (n.pdf) {
        try {
          cal = MAK.libraryCalendar(await MAK.pdfTextRuns(await getBytes(n.pdf)));
        } catch {}
      }
      const rules = cal ? null : MAK.noticeRules(n.blocks, it.date);
      const period = cal
        ? { from: new Date(cal.months[0].y, cal.months[0].m, 1).getTime(), to: new Date(cal.months.at(-1).y, cal.months.at(-1).m + 1, 1).getTime() }
        : rules || MAK.noticePeriod(n.text, it.date);
      if (period ? period.to <= today : now - it.date > 90 * MAK.DAY) continue;
      notices.push({ title: it.title, date: it.date, url: it.url, blocks: n.blocks, pdf: n.pdf, cal, rules: rules && { rules: rules.rules, weekly: rules.weekly }, from: period ? period.from : 0, to: period ? period.to : 0 });
      if (notices.length >= 4) break;
    }
    notices.sort((a, b) => (a.from || a.date) - (b.from || b.date));
    return {
      v: MAK.LIBRARY_FORM, at: now, campus: key, partial: !page || !sports, notices,
      page: page ? { url: c.page, lines: page.lines, week: page.week } : null,
      sports: sports ? { url: MAK.SPORTS_HOURS, access: sports.access, pool: sports.pool } : null
    };
  };

  // The hours of the library on a day: from the calendar of a notice (a day with a color of its legend), else the usual
  // hours of its day of the week. null: a notice without a calendar is about that day (its text says it), or nothing is
  // known. { hours, closed, notice (its title) } or { hours, closed, usual: true }.
  MAK.libraryDay = function (data, when = Date.now()) {
    if (!data) return null;
    const d = new Date(when);
    const day = startOfDay(when);
    const usual = data.page ? MAK.weekToday(data.page.week, when) : null;
    // A day of a notice with the usual hours of its day of the week: also "usual".
    const of = (x, n) => Object.assign({ hours: x.hours, closed: x.closed, notice: n.title },
      usual && usual.closed === !!x.closed && (x.closed || usual.hours === x.hours) ? { usual: true } : {});
    for (const n of data.notices || []) {
      const month = n.cal && n.cal.months.find((x) => x.y === d.getFullYear() && x.m === d.getMonth());
      const l = month && n.cal.legend[month.days[d.getDate() - 1]];
      if (l) return of(l, n);
      if (n.rules && n.from <= day && day < n.to) {
        // The rule of that day: the shortest one (a few days over a month), a day of the week of the whole notice as a week.
        const wd = d.getDay();
        const found = [
          ...n.rules.rules.filter((r) => r.from <= day && day < r.to && (!r.days || r.days.includes(wd))).map((r) => ({ r, span: r.to - r.from })),
          ...n.rules.weekly.filter((r) => r.days.includes(wd)).map((r) => ({ r, span: 7 * MAK.DAY }))
        ].sort((a, b) => a.span - b.span)[0];
        if (found) return of(found.r, n);
      } else if (!n.cal && !n.rules && n.from && n.from <= day && day < n.to) return null;
    }
    return usual;
  };

  MAK.libraryToday = (data, now = Date.now()) => MAK.libraryDay(data, now);
  // Why a notice closes the library, from its title: 'summer', 'easter', 'christmas' or ''.
  MAK.closedReason = (title) => {
    const s = fold(title || '');
    return /verano/.test(s) ? 'summer' : /semana santa/.test(s) ? 'easter' : /navidad|navide/.test(s) ? 'christmas' : '';
  };

  // Open now and until when, or closed and when it opens: { open, at } (at: the time of the change; 0: not known in the
  // next two weeks). dayOf(time) gives the hours of the day of that time (MAK.libraryDay, MAK.weekToday): { hours: "9:00–
  // 22:45" } or { closed: true }; null: not known (then null, or at 0 if it is not today).
  const minutes = (hours) => {
    const m = /^(\d{1,2}):(\d{2})–(\d{1,2}):(\d{2})$/.exec(hours || '');
    return m ? [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])] : null;
  };
  MAK.openState = function (dayOf, now = Date.now()) {
    const d = new Date(now);
    const at = (base, mins) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(mins / 60), mins % 60).getTime();
    const today = dayOf(now);
    const span = today && !today.closed ? minutes(today.hours) : null;
    if (!today || (!today.closed && !span)) return null;
    const mins = d.getHours() * 60 + d.getMinutes();
    if (span && mins >= span[0] && mins < span[1]) return { open: true, at: at(d, span[1]) };
    if (span && mins < span[0]) return { open: false, at: at(d, span[0]) };
    for (let k = 1; k <= 14; k++) {
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + k, 12);
      const day = dayOf(next.getTime());
      const s = day && !day.closed ? minutes(day.hours) : null;
      if (!day || (!day.closed && !s)) break;
      if (s) return { open: false, at: at(next, s[0]) };
    }
    return { open: false, at: 0 };
  };


  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
