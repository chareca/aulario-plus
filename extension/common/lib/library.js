// Aulario Plus: the hours of the library of the UPNA (www.unavarra.es/biblioteca) for "Mi sitio" (content-library.js).
// The usual hours of the campus of the user (the setting "libraryCampus": its page), and the notices of the board with
// other hours (exams, summer, Easter): their text for the campus, and their calendar if they have one (a PDF file of
// Canva: the color of each day and the legend of the colors, MAK.pdfTextRuns). The background reads it all
// (MAK.loadLibrary) and keeps it for MAK.LIBRARY_MS.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  MAK.LIBRARY_MS = 12 * MAK.HOUR;
  MAK.NOTICE_LEAD = 7; // a notice is shown from these days before its first day with other hours
  // The form of the kept hours (storage "library"): another form (an older version) is read again at once.
  MAK.LIBRARY_FORM = 4;
  MAK.LIBRARY_BOARD = 'https://www.unavarra.es/biblioteca/tablon-de-anuncios';
  // The hours of the sports facilities of the UPNA (Arrosadía): the access (also the gym) and the pool.
  MAK.SPORTS_HOURS = 'https://www.unavarra.es/deportes/instalaciones/horario?languageId=100000'; // in Spanish
  // The cafeterias and the dining hall: a table for each place.
  MAK.FOOD_PAGES = ['https://www.unavarra.es/restauracion/cafeterias?languageId=100000', 'https://www.unavarra.es/restauracion/comedores?languageId=100000'];
  // The campuses: the page with their usual hours, and the words that name them (in a notice, a row, a PDF file).
  MAK.LIBRARY_CAMPUSES = {
    arrosadia: { page: 'https://www.unavarra.es/biblioteca/la-biblioteca/Campus+de+Arrosadia', names: /arrosad[ií]a/i },
    salud: { page: 'https://www.unavarra.es/biblioteca/la-biblioteca/Campus+de+Ciencias+de+la+Salud', names: /salud|sani(?:_|\b)/i },
    tudela: { page: 'https://www.unavarra.es/biblioteca/la-biblioteca/Campus+de+Tudela', names: /tudela/i }
  };
  const named = (text) => Object.keys(MAK.LIBRARY_CAMPUSES).filter((k) => MAK.LIBRARY_CAMPUSES[k].names.test(text));

  // An address of the library of the UPNA (its pages, the board) or of its PDF files, or the hours of the sports facilities,
  // of the cafeterias or of the dining hall, with https; else null.
  MAK.libraryUrl = function (href) {
    if (String(href).length > 2000) return null; // no address of a page is so long (it is kept in the storage)
    try {
      const u = new URL(String(href).trim(), 'https://www.unavarra.es/biblioteca/');
      if (u.hostname !== 'www.unavarra.es' || (u.protocol !== 'https:' && u.protocol !== 'http:')) return null;
      u.protocol = 'https:';
      u.hash = '';
      return u.pathname.startsWith('/biblioteca/') || u.pathname === new URL(MAK.SPORTS_HOURS).pathname || /^\/restauracion\/(?:cafeterias|comedores)$/.test(u.pathname) || /^\/digitalAssets\/[^?#]+\.pdf$/i.test(u.pathname) ? u.href : null;
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
  // A day of a month named in a notice: its time. The year: the one in the text, else the one nearest to the publication
  // of the notice, a past one counting double (a notice of December about January: the next year; of January about the
  // December before: that one). NaN: not a day.
  function dayOf(d, month, year, pub) {
    const n = Number(d);
    if (month < 0 || !(n >= 1 && n <= 31)) return NaN;
    const score = (t) => (t < pub ? 2 * (pub - t) : t - pub);
    const t = year ? new Date(Number(year), month, n) : [-1, 0, 1].map((k) => new Date(pub.getFullYear() + k, month, n)).filter((x) => x.getMonth() === month).sort((a, b) => score(a) - score(b))[0];
    return t && t.getMonth() === month ? t.getTime() : NaN;
  }

  // The ranges of hours in a text: "8:00 a 21:00", "9.00-22:45", "de 9 a 23 horas", "de 9h. a 21h.", "horario 8-15" ->
  // ["8:00–21:00", ...]. Two hours without minutes need a word of hours ("h", "horas") or "de", "horario", "abre" before
  // them, and a range is never followed by a month ("19-25 de octubre": days).
  const RANGE = /(?<![\d:.,])(\d{1,2})(?:[:.,](\d{2}))?\s*(h\b\.?|horas?\b)?\s*(?:[-–]|\ba\b)\s*(\d{1,2})(?:[:.,](\d{2}))?\s*(h\b\.?|horas?\b)?(?![\d])/g;
  function timeRanges(text) {
    const s = fold(text);
    const out = [];
    for (const m of s.matchAll(RANGE)) {
      const [h1, m1, h2, m2] = [Number(m[1]), m[2] ? Number(m[2]) : 0, Number(m[4]), m[5] ? Number(m[5]) : 0];
      if (h1 > 24 || h2 > 24 || m1 > 59 || m2 > 59 || h1 * 60 + m1 >= h2 * 60 + m2) continue;
      if (new RegExp(`^\\s*(?:de\\s+)?(?:${MONTH_WORDS})\\b`).test(s.slice(m.index + m[0].length))) continue;
      const before = s.slice(Math.max(0, m.index - 14), m.index);
      if (!m[2] && !m[5] && !m[3] && !m[6] && !/(?:\bde|horario|abre|abrira|abriran|:)\s*$/.test(before)) continue;
      out.push(`${h1}:${String(m1).padStart(2, '0')}–${h2}:${String(m2).padStart(2, '0')}`);
    }
    return out;
  }
  const hoursOf = (text) => timeRanges(text)[0] || '';

  // The days that a text of a notice names, as spans { from, to } (to: the day after the last one): ranges ("Del 1 de julio
  // al 31 de agosto", "del 1 al 5 julio", "A partir del sábado 22 de noviembre y hasta el domingo 18 de enero", "18
  // ABRIL-14 JUNIO", "(diciembre 2016-enero 2017)", "mayo-junio 2018"), single days ("13 y 14 de julio", "abril: 18, 19 y
  // 26", "mayo: días 6, 7", "24, 25 y 31 de dic. y 1 de enero") and starts without an end ("a partir del sábado 26 de
  // noviembre", "a partir del viernes 13": the month of the notice), as { from, open: true }. Also "los días 10 a 20 de
  // enero", "entre el 10 y el 20 de enero", "10-20 de enero", "1º de julio" and "13/07" ("13/07/2026").
  function spansIn(text, pub) {
    const W = `(${MONTH_WORDS})\\b\\.?`;
    const Y = '(?:\\s+(?:de\\s+)?(20\\d\\d))?';
    const WD = '(?:[a-z]+\\s+){0,2}'; // "el sábado", "este sábado"
    const out = [];
    const add = (from, to) => {
      if (from && to && from <= to && to - from < 400 * MAK.DAY) out.push({ from, to: new Date(new Date(to).getFullYear(), new Date(to).getMonth(), new Date(to).getDate() + 1).getTime() });
    };
    const range = (d1, m1, y1, d2, m2, y2) => {
      const end = dayOf(d2, m2, y2, pub);
      let start = dayOf(d1, m1, y1, pub);
      if (start > end) start = dayOf(d1, m1, new Date(end).getFullYear() - (m1 > m2 ? 1 : 0), pub);
      add(start, end);
      return ' ';
    };
    let s = fold(text).replace(/(\d)\s*\.?[ºª°]/g, '$1');
    s = s.replace(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d\d|\d\d))?\b/g, (all, d, m, y) => (Number(m) >= 1 && Number(m) <= 12 ? `${d} de ${MONTHS[m - 1]}${y ? ` de ${y.length === 2 ? `20${y}` : y}` : ''}` : all));
    s = s.replace(new RegExp(`\\b(?:del?|desde el|a partir del?|(?:los\\s+)?dias|entre el)\\s+${WD}(\\d{1,2})(?:\\s+(?:de\\s+)?${W})?${Y}\\s*,?\\s+(?:y\\s+)?(?:al|a|hasta(?:\\s+el)?|y el)\\s+${WD}(\\d{1,2})\\s+(?:de\\s+)?${W}${Y}`, 'g'),
      (all, d1, m1, y1, d2, m2, y2) => range(d1, monthIndex(m1 || m2), y1 || y2, d2, monthIndex(m2), y2));
    s = s.replace(new RegExp(`(\\d{1,2})(?:\\s+(?:de\\s+)?${W}${Y})?\\s*[-–]\\s*(\\d{1,2})\\s+(?:de\\s+)?${W}${Y}`, 'g'),
      (all, d1, m1, y1, d2, m2, y2) => range(d1, monthIndex(m1 || m2), y1 || (m1 ? undefined : y2), d2, monthIndex(m2), y2));
    s = s.replace(new RegExp(`\\b${W}${Y}\\s*[-–]\\s*${W}${Y}`, 'g'), (all, m1, y1, m2, y2) => {
      const [a, b] = [monthIndex(m1), monthIndex(m2)];
      const endYear = y2 ? Number(y2) : new Date(dayOf(1, b, null, pub)).getFullYear();
      const startYear = y1 ? Number(y1) : endYear - (a > b ? 1 : 0);
      add(new Date(startYear, a, 1).getTime(), new Date(endYear, b + 1, 0).getTime());
      return ' ';
    });
    s = s.replace(new RegExp(`\\b(?:a partir del?|desde el)\\s+${WD}(\\d{1,2})(?:\\s+(?:de\\s+)?${W}${Y})?`, 'g'), (all, d, m, y) => {
      const month = m ? monthIndex(m) : Number(d) >= pub.getDate() ? pub.getMonth() : (pub.getMonth() + 1) % 12;
      const t = dayOf(d, month, y, pub);
      if (t) out.push({ from: t, to: 0, open: true });
      return ' ';
    });
    const single = (list, m, y) => {
      for (const d of list.match(/\d{1,2}/g) || []) {
        const t = dayOf(d, monthIndex(m), y, pub);
        add(t, t);
      }
    };
    for (const m of s.matchAll(new RegExp(`(\\d{1,2})((?:\\s*(?:,|y)\\s*\\d{1,2})*)\\s+(?:de\\s+)?${W}${Y}`, 'g'))) single(m[1] + m[2], m[3], m[4]);
    for (const m of s.matchAll(new RegExp(`\\b${W}\\s*:\\s*(?:dias?\\s+)?(\\d{1,2}(?:\\s*(?:,|y)\\s*\\d{1,2})*)`, 'g'))) single(m[2], m[1]);
    return out;
  }

  // The first and the last day that texts name: { from, to } or null (a start without an end: one day).
  MAK.noticePeriod = function (texts, published) {
    const spans = texts.flatMap((t) => spansIn(t, new Date(published)));
    if (!spans.length) return null;
    return { from: Math.min(...spans.map((x) => x.from)), to: Math.max(...spans.map((x) => x.to || x.from + MAK.DAY)) };
  };

  // The usual days of a notice of a season without dates ("Horario de Navidad"): Christmas 20 December to 8 January,
  // Easter from Palm Sunday to Easter Monday, summer July and August; the season nearest to the notice. null.
  function seasonPeriod(title, published) {
    const s = fold(title);
    const pub = new Date(published);
    const y = pub.getFullYear();
    const near = (spans) => spans.filter((x) => x.to > published - 30 * MAK.DAY).sort((a, b) => a.from - b.from)[0] || null;
    if (/navidad/.test(s)) return near([y - 1, y].map((k) => ({ from: new Date(k, 11, 20).getTime(), to: new Date(k + 1, 0, 9).getTime() })));
    if (/semana santa/.test(s)) return near([y, y + 1].map((k) => { const e = easter(k); return { from: new Date(k, e.getMonth(), e.getDate() - 7).getTime(), to: new Date(k, e.getMonth(), e.getDate() + 2).getTime() }; }));
    if (/verano/.test(s)) return near([y, y + 1].map((k) => ({ from: new Date(k, 6, 1).getTime(), to: new Date(k, 8, 1).getTime() })));
    return null;
  }

  // A text about another space than the library: "aulas en el aulario", "aula de estudio", "salón" (without "biblioteca").
  const SPACE = /\baulas?\b|aulario|sal[oó]n/i;
  const otherSpace = (own, head = '') => !/bibliotec/i.test(own) && (SPACE.test(own) || SPACE.test(head));

  // A sentence of a notice for a campus: { text, own } (own: the part about the campus, for the space). The whole sentence
  // when it names no campus or only that one; when it names several, the start of the sentence and the part about the
  // campus: from its name, or the "y"/"," before it, to the next part ("Arrosadía abrirá de 9 a 22:45 y las de Tudela y
  // Ciencias de la Salud, de 9 a 21:45": a part without hours takes the hours of the next one). null: only other campuses.
  function campusPart(sentence, campus) {
    const found = [];
    for (const [k, c] of Object.entries(MAK.LIBRARY_CAMPUSES)) for (const m of sentence.matchAll(new RegExp(c.names.source, 'gi'))) found.push({ k, at: m.index });
    if (!found.length) return { text: sentence, own: sentence };
    const kinds = new Set(found.map((f) => f.k));
    if (!kinds.has(campus)) return null;
    if (kinds.size === 1) return { text: sentence, own: sentence };
    found.sort((a, b) => a.at - b.at);
    // A part starts at the last "y" or "," before the name (within 40 characters), else at the name.
    const starts = found.map((f, i) => {
      const from = i ? found[i - 1].at + 1 : 0;
      const before = sentence.slice(Math.max(from, f.at - 40), f.at);
      const c = Math.max(before.lastIndexOf(' y '), before.lastIndexOf(','));
      return i && c >= 0 ? f.at - before.length + c : f.at;
    });
    const parts = found.map((f, i) => ({ k: f.k, own: sentence.slice(starts[i], i + 1 < found.length ? starts[i + 1] : sentence.length) }));
    for (const p of parts) p.text = p.own;
    for (let i = parts.length - 2; i >= 0; i--) if (!timeRanges(parts[i].text).length && !/cerrad/i.test(parts[i].text)) parts[i].text += parts[i + 1].text;
    const mine = parts.filter((p) => p.k === campus);
    return { text: sentence.slice(0, starts[0]) + mine.map((p) => p.text).join(' '), own: mine.map((p) => p.own).join(' '), head: sentence.slice(0, starts[0]) };
  }

  // The hours of each day of the week in a text with several ranges ("sábado de 8.00 a 21:45 - domingo de 9.00 a 21.45"):
  // [{ days, hours }], each range with the days named before it; null if a range has none.
  function hoursByDay(text) {
    const s = fold(text);
    const list = [];
    let last = 0;
    for (const m of s.matchAll(RANGE)) {
      const hours = timeRanges(m[0])[0] || timeRanges(s.slice(Math.max(0, m.index - 14), m.index + m[0].length))[0];
      if (!hours) continue;
      const days = [...weekdays(s.slice(last, m.index))];
      if (!days.length) return null;
      list.push({ days, hours });
      last = m.index + m[0].length;
    }
    return list.length ? list : null;
  }

  // The hours of a notice in words for a campus (its blocks, MAK.parseNotice): rules { from, to, hours, closed, days }
  // (days: only those days of the week; null: all) and the days of the week of the whole notice ("Sábados, domingos y
  // festivos permanecerán cerradas": weekly). Each sentence: only the part about the campus (campusPart), never about
  // another space (an "aula", the "aulario"). A sentence with days and hours (or "cerrado") is a rule; days without hours
  // wait for the hours of a next sentence or row (a table); hours without days take the days of the sentence before it
  // ("El día 8 de abril se habilitarán aulas en Arrosadía. Las bibliotecas de Tudela permanecerán cerradas"); days with
  // no hours after them are not about hours (the loans). A start without an end lasts to the last day of the notice.
  // uncertain: a sentence that the reader does not understand (hours and "cerrado" together, ranges without their days):
  // then the hours of the days of the notice are not known. { rules, weekly, from, to, uncertain } or null.
  MAK.noticeRules = function (blocks, published, campus, title = '') {
    const pub = new Date(published);
    const rules = [];
    const weekly = [];
    const seen = []; // all the days of the notice (for the end of a start without an end)
    let uncertain = false;
    let other = false; // a sentence about another space (an "aula")
    let waiting = [];
    const put = (spans, value, days) => rules.push(...spans.map((x) => ({ from: x.from, to: x.to, open: x.open, hours: value.hours, closed: value.closed, days: days || null })));
    for (const b of blocks || []) {
      if (otherSpace(b.head || '')) {
        other = true;
        continue;
      }
      for (const line of b.lines) {
        let context = [];
        for (const sentence of line.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ¡¿])/)) {
          const all = spansIn(sentence, pub);
          seen.push(...all);
          const part = campus ? campusPart(sentence, campus) : { text: sentence, own: sentence };
          const before = context;
          if (all.length) context = all;
          if (!part) continue;
          const spans = part.text === sentence ? all : spansIn(part.text, pub);
          if (otherSpace(part.own, part.head)) {
            other = true;
            if (spans.length) waiting = [];
            continue;
          }
          const ranges = timeRanges(part.text);
          const closed = /cerrad/i.test(part.text);
          const weekends = /fines? de semana/i.test(part.text) ? [0, 6] : null;
          if (closed && ranges.length) {
            uncertain = true;
            continue;
          }
          if (ranges.length > 1) {
            const byDay = hoursByDay(part.text);
            if (!byDay) {
              uncertain = true;
              continue;
            }
            const days = spans.length ? spans : waiting.length ? waiting : null;
            for (const x of byDay) days ? put(days, { hours: x.hours, closed: false }, x.days) : weekly.push({ days: x.days, hours: x.hours, closed: false });
            if (!spans.length) waiting = [];
            continue;
          }
          const value = closed ? { hours: '', closed: true } : ranges.length ? { hours: ranges[0], closed: false } : null;
          const week = restriction(part.text);
          if (spans.length) {
            if (value) put(spans, value, weekends || (week.length ? week : null));
            else waiting.push(...spans.map((x) => Object.assign({}, x, { days: weekends })));
          } else if (value) {
            if (waiting.length) {
              for (const w of waiting) put([w], value, week.length ? week : w.days);
              waiting = [];
            } else if (week.length) weekly.push({ days: week, hours: value.hours, closed: value.closed });
            else if (before.length) put(before, value, null);
          }
        }
      }
    }
    // A start without an end: to the last day of the notice, else 90 days.
    const last = Math.max(0, ...seen.map((x) => x.to || 0), ...rules.map((r) => r.to || 0));
    for (const r of rules) if (r.open) r.to = last > r.from ? last : r.from + 90 * MAK.DAY;
    // Only days of the week: in the days of the title ("Horario de apertura los fines de semana de 7 de mayo a 26 de junio").
    if (!rules.length && weekly.length) {
      const t = MAK.noticePeriod([title], published);
      if (t) for (const w of weekly.splice(0)) rules.push({ from: t.from, to: t.to, hours: w.hours, closed: w.closed, days: w.days });
    }
    // Nothing about the library, only about another space: the library keeps its hours (no rules, not uncertain).
    if (!rules.length) return uncertain || other ? { rules: [], weekly: [], from: 0, to: 0, uncertain, other: !uncertain && !weekly.length } : null;
    const clean = rules.slice(0, 80).map((r) => ({ from: r.from, to: r.to, hours: r.hours, closed: r.closed, days: r.days }));
    return { rules: clean, weekly: weekly.slice(0, 7), from: Math.min(...clean.map((r) => r.from)), to: Math.max(...clean.map((r) => r.to)), uncertain, other: false };
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

  // The days of the week that a text of a notice keeps its hours to ("de lunes a viernes", "sábados y domingos"), not the
  // ones of a date ("a partir del sábado 26 de noviembre"): [0..6].
  const restriction = (text) => [...weekdays(fold(text).replace(new RegExp(`(?:${DAY_WORDS})\\s+(?=\\d)`, 'g'), ''))];

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
    const seen = new Set();
    for (const l of found) {
      const ranges = timeRanges(l);
      const closed = /cerrad/i.test(l);
      if (!closed && !ranges.length) continue;
      // Not known (null): two ranges ("de 8 a 14 y de 16 a 20"), hours and "cerrado" together, another space ("aula de
      // estudio de 9:00 a 21:45").
      const day = otherSpace(l) || (closed && ranges.length) || ranges.length > 1 ? null : closed ? { closed: true } : { hours: ranges[0] };
      for (const d of weekdays(l)) {
        if (!seen.has(d)) week[d] = day;
        seen.add(d);
      }
    }
    return week;
  }
  // The minutes of "9:00–22:45": [540, 1365]; null.
  const minutes = (hours) => {
    const m = /^(\d{1,2}):(\d{2})–(\d{1,2}):(\d{2})$/.exec(hours || '');
    return m ? [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])] : null;
  };

  // A text of hours, shorter: "De lunes a viernes, de 7:30 a 22:00" -> "L-V, de 7:30 a 22:00".
  MAK.shortDays = (text) => String(text).replace(/\b(?:de\s+)?lunes\s+a\s+viernes\b/gi, 'L-V');

  // The hours of today of a week (weekOf), the usual ones: { hours, closed, usual: true } or null.
  MAK.weekToday = function (week, now = Date.now()) {
    const w = Array.isArray(week) ? week[new Date(now).getDay()] : null;
    return w ? { hours: w.hours || '', closed: !!w.closed, usual: true } : null;
  };

  // A page of the cafeterias or of the dining hall: a table for each place, with its caption ("Cafetería Aulario
  // (Aramark)") and a row for each period ("Curso académico", "Vacaciones", "Fines de semana y festivos"): the opening
  // hours and the hours of the kitchen or of the meals. [{ name, campus, extra ('kitchen', 'meals' or ''), course,
  // holidays, weekend: { hours, extra } or { closed: true } }].
  MAK.parseFoodPage = function (html) {
    const places = [];
    for (const table of String(html).match(/<table\b[\s\S]*?<\/table>/gi) || []) {
      const caption = /<caption\b[^>]*>([\s\S]*?)<\/caption>/i.exec(table);
      if (!caption) continue;
      const name = lines(caption[1]).join(' ').replace(/\s*\([^)]*\)\s*$/, '').trim().slice(0, 80);
      const place = { name, campus: /salud/i.test(name) ? 'salud' : /tudela/i.test(name) ? 'tudela' : 'arrosadia', extra: '' };
      for (const row of table.match(/<tr\b[\s\S]*?<\/tr>/gi) || []) {
        const cells = [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => lines(c[1]).join(' '));
        const head = fold(cells[0] || '');
        if (/periodo/.test(head)) place.extra = /cocina/.test(fold(cells[2] || '')) ? 'kitchen' : /comida/.test(fold(cells[2] || '')) ? 'meals' : '';
        const key = /curso/.test(head) ? 'course' : /vacacion/.test(head) ? 'holidays' : /semana|festiv/.test(head) ? 'weekend' : '';
        if (!key) continue;
        place[key] = /cerrad/i.test(cells[1] || '') ? { closed: true } : hoursOf(cells[1] || '') ? { hours: hoursOf(cells[1]), extra: hoursOf(cells[2] || '') } : null;
      }
      if (place.course || place.holidays) places.push(place);
    }
    return places.slice(0, 12);
  };

  // The period of the hours of the cafeterias on a day: 'weekend' (Saturday and Sunday; the holidays of a place are not
  // known), 'holidays' (July and August, 24 December to 6 January, and Easter from Holy Thursday to Easter Monday) or
  // 'course'. shortcut: the vacations are the usual ones, not the calendar of the UPNA of each year (a PDF file).
  const easter = (y) => {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    return new Date(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
  };
  MAK.foodPeriod = function (when) {
    const d = new Date(when);
    if (d.getDay() === 0 || d.getDay() === 6) return 'weekend';
    const [m, day] = [d.getMonth(), d.getDate()];
    if (m === 6 || m === 7 || (m === 11 && day >= 24) || (m === 0 && day <= 6)) return 'holidays';
    const e = easter(d.getFullYear());
    const t = startOfDay(when);
    return t >= new Date(e.getFullYear(), e.getMonth(), e.getDate() - 3).getTime() && t <= new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1).getTime() ? 'holidays' : 'course';
  };
  // The hours of the places on a day, together: from the first one that opens to the last one that closes.
  // { hours, closed, period, usual (a weekend), notice ('vacaciones' when all are closed for the holidays) } or null.
  MAK.foodDay = function (places, when) {
    const period = MAK.foodPeriod(when);
    const days = (places || []).map((p) => p[period]).filter(Boolean);
    if (!days.length) return null;
    const spans = days.map((x) => (!x.closed && minutes(x.hours)) || null).filter(Boolean);
    const time = (mins) => `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
    if (!spans.length) return { hours: '', closed: true, period, usual: period === 'weekend', notice: period === 'holidays' ? 'vacaciones' : '' };
    return { hours: `${time(Math.min(...spans.map((s) => s[0])))}–${time(Math.max(...spans.map((s) => s[1])))}`, closed: false, period };
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

  // A notice about hours, for a campus: "horario", "aula de estudio" or the closing of the libraries ("Cierre de las
  // bibliotecas") in the title, and no other campus alone.
  MAK.isHoursNotice = function (title, campus) {
    if (!/horario|aula de estudio|cierre de (?:la|las) bibliotecas?|bibliotecas? cerrad/.test(fold(title))) return false;
    const n = named(title);
    return !n.length || n.includes(campus);
  };

  // The PDF files of an HTML fragment: [{ url, label }].
  const pdfLinks = (html) => [...String(html).matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ url: MAK.libraryUrl(decode(m[1])), label: lines(m[2]).join(' ') }))
    .filter((l) => l.url && /\.pdf$/i.test(new URL(l.url).pathname));

  // A notice: its text for a campus in blocks { head, lines } (each row of a table: its first cell and the rest; a table
  // with rows of campuses: only the rows of the campus; out of the tables: the lines that name no other campus, nor are
  // under a line of another campus that ends with ":"), all its text (for its dates) and its PDF file for the campus (''
  // without one).
  MAK.parseNotice = function (html, campus) {
    const s = String(html);
    const at = s.indexOf('class="fecha"');
    const top = at < 0 ? -1 : s.indexOf('</h2>', at);
    if (top < 0) return { blocks: [], text: [], pdf: '' };
    let end = s.indexOf('class="volver"', top);
    end = Math.min(end < 0 ? s.length : s.lastIndexOf('<', end), top + 30000); // up to the tag of "Volver", 30000 characters at most
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
        // A line that names a campus and ends with ":", or without a number (a heading: "Campus de Tudela"), heads the
        // lines after it (up to a line that names a campus).
        let owner = null;
        const mine = found.filter((l) => {
          const n = named(l);
          if (n.length) owner = /:$/.test(l) || !/\d/.test(l) ? n : null;
          const of = n.length ? n : owner;
          return !of || of.includes(campus);
        });
        if (mine.length) blocks.push({ head: '', lines: mine });
      }
    }
    // The PDF file of the campus: one that names it; else the only one, when it names no campus and the notice names no
    // campus or this one (a notice about another campus is not about this one).
    const about = named(text.join(' '));
    const pick = pdfs.find((p) => named(p.words).includes(campus))
      || (pdfs.length === 1 && !named(pdfs[0].words).length && (!about.length || about.includes(campus)) ? pdfs[0] : null);
    return { blocks: blocks.slice(0, 12).map((b) => ({ head: b.head, lines: b.lines.slice(0, 12) })), text, pdf: pick ? pick.url : '' };
  };

  // ---- The calendar of a PDF file ------------------------------------------------------------------------------------

  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const SAME = 0.06; // the same color (the legend and its hours)
  const NEAR = 0.35; // a day of the color of the legend (Canva uses several blues and greens)

  // The calendar of a PDF file of the library (MAK.pdfTextRuns): a month on each page, with the legend of the colors
  // ("biblioteca: 9:00 - 22:45 h.", "cerrado", "horario habitual de la biblioteca": usual) and the numbers of the days in
  // color. { legend: [{ hours, closed, usual }], months: [{ y, m, days: [the index in the legend of each day; -1: gray, no
  // other hours; -2: a color that is not in the legend (of an "aula"): its hours are not known] }] } or null. The year: the one of the page, else the one nearest to the publication (published). A page
  // whose numbers are not exactly the days of its month is left out.
  MAK.libraryCalendar = function (content, published = Date.now()) {
    const { runs, shapes } = Array.isArray(content) ? { runs: content, shapes: [] } : content;
    const legend = [];
    const months = [];
    const index = (l) => {
      const i = legend.findIndex((x) => x.closed === l.closed && x.hours === l.hours && !!x.usual === !!l.usual);
      return i < 0 ? legend.push(l) - 1 : i;
    };
    for (const page of [...new Set(runs.map((r) => r.page))].slice(0, 24)) {
      const rs = runs.filter((r) => r.page === page);
      const drawn = (shapes || []).filter((x) => x.page === page);
      const top = [...rs].sort((a, b) => b.y - a.y);
      const isDay = (r) => /^\d{1,2}$/.test(r.text);
      const title = top.find((r) => !isDay(r) && r.text.length < 60 && new RegExp(`^(${MONTHS.join('|')})\\b`).test(fold(r.text)));
      const year = top.map((r) => /\b(20\d\d)\b/.exec(r.text)).find(Boolean);
      if (!title) continue;
      const m = MONTHS.indexOf(/^[a-z]+/.exec(fold(title.text))[0]);
      const numbers = rs.filter(isDay).map((r) => ({ n: Number(r.text), rgb: r.rgb, x: r.x, y: r.y, size: r.size, len: r.text.length }));
      // The year: the one of the page, else the one nearest to the publication; with its days in 7 columns, the one that
      // puts the 1st in its column (Monday first). No year that fits: the page is left out.
      const pub = new Date(published);
      const score = (k) => Math.abs(new Date(k, m, 15) - pub) * (new Date(k, m, 15) < pub ? 2 : 1);
      const column = firstColumn(numbers);
      const y = [...new Set([year ? Number(year[1]) : 0, ...[-1, 0, 1].map((k) => pub.getFullYear() + k).sort((a, b) => score(a) - score(b))])]
        .find((k) => k && numbers.length === new Date(k, m + 1, 0).getDate() && (column < 0 || (new Date(k, m, 1).getDay() + 6) % 7 === column));
      if (!y) continue;
      // The legend of the page: a color with "biblioteca" or "cerrado"; its hours, in a text of the same color under a
      // name that is not of an "aula" ("biblioteca: 8:00 - 14:30 h. aula 02: 14:30 - 21:00 h."). A color with two hours
      // (for "8:00 - 21:00" and "8:00 - 14:30") does not tell the hours of its days: -2.
      // A mark of the legend: an image or a ring on the left of a name ("biblioteca: 8:00 - 14:30 h."), around the days of
      // those hours (the rings of Ciencias de la Salud, 2025): marks [{ shape, index }], over the color of the day.
      const marks = [];
      const sameMark = (a, b) => (a.image ? a.image === b.image : !!a.stroke && !a.fill && !!b.stroke && !b.fill && distance(a.stroke, b.stroke) < SAME);
      for (const k of rs.filter((r) => /bibliotec|liburutegi|cerrad|itxit/i.test(r.text))) {
        const shape = drawn.filter((x) => (x.image || (x.stroke && !x.fill)) && x.x1 <= k.x + 2 && x.x1 > k.x - 5 * k.size && x.x1 - x.x0 < 5 * k.size
          && Math.abs((x.y0 + x.y1) / 2 - k.y) < 2.5 * k.size).sort((a, b) => b.x1 - a.x1)[0];
        if (!shape || marks.some((x) => sameMark(x.shape, shape))) continue;
        const under = rs.filter((r) => !isDay(r) && distance(r.rgb, k.rgb) < SAME && r.y < k.y && k.y - r.y < 2.5 * k.size).sort((a, b) => b.y - a.y);
        const closed = /cerrad|itxit/i.test(k.text);
        const hours = closed ? '' : hoursOf(k.text) || under.map((r) => hoursOf(r.text)).find(Boolean) || '';
        if (closed || hours) marks.push({ shape, rgb: k.rgb, hours, index: index({ hours, closed }) });
      }
      const keys = [];
      for (const k of rs.filter((r) => /bibliotec|liburutegi|cerrad|itxit/i.test(r.text))) {
        if (keys.some((x) => distance(x.rgb, k.rgb) < SAME)) continue;
        const same = rs.filter((r) => !isDay(r) && distance(r.rgb, k.rgb) < SAME).sort((a, b) => b.y - a.y || a.x - b.x);
        const closed = same.some((r) => /cerrad|itxit/i.test(r.text));
        const found = new Set();
        let label = '';
        for (const r of same) {
          const h = hoursOf(r.text);
          if (!h) label = r.text;
          else if (!/\baulas?\b|gela|aulario/i.test(fold(r.text.slice(0, r.text.search(/\d/))) || fold(label))) found.add(h);
        }
        const hours = closed ? '' : [...found][0] || '';
        const usual = !closed && !hours && same.some((r) => /habitual|ohiko/i.test(r.text));
        if (!closed && !hours && !usual) continue;
        // Two hours, one of them with its mark: the color has the other one.
        const rest = [...found].filter((x) => !marks.some((mk) => mk.hours === x && distance(mk.rgb, k.rgb) < SAME));
        if (!closed && found.size > 1) {
          keys.push({ rgb: k.rgb, index: rest.length === 1 ? index({ hours: rest[0], closed: false }) : -2 });
          continue;
        }
        keys.push({ rgb: k.rgb, index: index(usual ? { hours, closed, usual } : { hours, closed }) });
      }
      const count = new Date(y, m + 1, 0).getDate();
      if (numbers.length !== count || new Set(numbers.map((x) => x.n)).size !== count || numbers.some((x) => x.n < 1 || x.n > count)) continue;
      // A gray day (out of the calendar) only in a gray of the legend.
      const days = Array(count).fill(-1);
      for (const x of numbers) {
        const gray = Math.max(...x.rgb) - Math.min(...x.rgb) <= 0.1;
        const near = keys.map((k) => ({ k, d: distance(k.rgb, x.rgb) })).sort((a, b) => a.d - b.d)[0];
        if (near && near.d < (gray ? SAME : NEAR)) days[x.n - 1] = near.k.index;
        else if (!gray) days[x.n - 1] = -2;
        // A mark around the number: its hours.
        const cx = x.x + 0.28 * x.size * x.len;
        const cy = x.y + 0.35 * x.size;
        const mark = marks.find((mk) => drawn.some((d) => sameMark(mk.shape, d) && d !== mk.shape && d.x0 <= cx && cx <= d.x1 && d.y0 <= cy && cy <= d.y1 && d.x1 - d.x0 < 5 * x.size));
        if (mark) days[x.n - 1] = mark.index;
      }
      if (!months.some((x) => x.y === y && x.m === m)) months.push({ y, m, days });
    }
    months.sort((a, b) => a.y * 12 + a.m - (b.y * 12 + b.m));
    return months.length && (legend.length || months.some((x) => x.days.includes(-2))) ? { legend, months: months.slice(0, 12) } : null;
  };

  // The column (0: the first one) of the 1st of a month in a calendar, its numbers { n, x } in 7 columns, each day after
  // the one before it; -1 if they are not so.
  function firstColumn(numbers) {
    const xs = [...new Set(numbers.map((d) => Math.round(d.x)))].sort((a, b) => a - b);
    const gap = (xs.at(-1) - xs[0]) / 12; // half a column
    const cols = [];
    for (const x of xs) {
      if (cols.length && x - cols.at(-1).at(-1) <= gap) cols.at(-1).push(x);
      else cols.push([x]);
    }
    const col = (d) => cols.findIndex((c) => c.includes(Math.round(d.x)));
    const one = numbers.find((d) => d.n === 1);
    if (cols.length !== 7 || !one) return -1;
    return numbers.every((d) => col(d) === (col(one) + d.n - 1) % 7) ? col(one) : -1;
  }

  // The period of a calendar: from its first day with other hours than the usual ones of its day of the week (week) to
  // the day after its last one ({ from, to }); null without one. A day closed on a weekend that is always closed does not
  // count. Without the usual hours: every day with a color of the legend.
  function calendarPeriod(cal, week) {
    let from = 0;
    let to = 0;
    for (const x of cal.months) {
      x.days.forEach((i, k) => {
        const l = cal.legend[i];
        if (i !== -2 && (!l || l.usual)) return;
        const date = new Date(x.y, x.m, k + 1);
        const u = week && week[date.getDay()];
        if (l && u && !!u.closed === !!l.closed && (l.closed || u.hours === l.hours)) return;
        if (!from || date.getTime() < from) from = date.getTime();
        to = Math.max(to, new Date(x.y, x.m, k + 2).getTime());
      });
    }
    return from ? { from, to } : null;
  }

  // The notices shown on a day: from MAK.NOTICE_LEAD days before their first day to their last day; a notice without
  // dates, 90 days after it was published.
  MAK.visibleNotices = function (data, when = Date.now()) {
    const day = startOfDay(when);
    return ((data && data.notices) || []).filter((n) => {
      if (!n.from) return when - n.date <= 90 * MAK.DAY;
      const f = new Date(n.from);
      return new Date(f.getFullYear(), f.getMonth(), f.getDate() - MAK.NOTICE_LEAD).getTime() <= day && day < n.to;
    });
  };

  // ---- All of it -------------------------------------------------------------------------------------------------

  // The hours of the library for a campus and of the sports facilities: getText(url) and getBytes(url) read the pages and
  // the PDF files (the background checks the addresses). { at, campus, partial (a page failed), board (false: the board
  // did not answer, so no day is known), page: { url, lines,
  // week } or null, notices: [{ title, date, url, blocks, pdf, cal, from, to }], sports: { url, access, pool } or null }:
  // the notices of the last year about hours, of the campus, that did not end (a notice without dates: 90 days), at most
  // 4, the first one first (MAK.visibleNotices: the ones to show on a day). An error when no page answers.
  MAK.loadLibrary = async function ({ campus, getText, getBytes, now = Date.now() }) {
    const key = Object.hasOwn(MAK.LIBRARY_CAMPUSES, campus) ? campus : 'arrosadia';
    const c = MAK.LIBRARY_CAMPUSES[key];
    const sports = MAK.parseSportsPage(await getText(MAK.SPORTS_HOURS).catch(() => ''));
    const food = [];
    for (const url of MAK.FOOD_PAGES) food.push(...MAK.parseFoodPage(await getText(url).catch(() => '')));
    const page = MAK.parseLibraryPage(await getText(c.page).catch(() => ''));
    if (!page && !sports) throw new Error('library: no hours');
    const first = MAK.parseBoardList(await getText(MAK.LIBRARY_BOARD).catch(() => ''));
    let failed = !first.items.length; // a page or a PDF file that did not answer: read again soon (partial)
    const more = [`${MAK.LIBRARY_BOARD}?pagina=1`];
    const before = first.years.find((x) => x.year === new Date(now).getFullYear() - 1);
    if (before) more.push(before.url);
    const lists = [first];
    for (const url of more) lists.push(MAK.parseBoardList(await getText(url).catch(() => { failed = true; return ''; }))); // a list missing: read again soon
    const seen = new Set();
    const items = lists.flatMap((l) => l.items)
      .filter((it) => !seen.has(it.id) && seen.add(it.id) && MAK.isHoursNotice(it.title, key) && it.date <= now && now - it.date < 365 * MAK.DAY)
      .sort((a, b) => b.date - a.date)
      .slice(0, 6);
    const today = startOfDay(now);
    const notices = [];
    for (const it of items) {
      // A notice that the reader cannot read (a page too odd): left out, the others stay; read again soon.
      try {
        // A notice that does not answer: only its title (its days, or its season: then they are not known).
        const html = await getText(it.url).catch(() => '');
        if (!html) failed = true;
        const n = MAK.parseNotice(html, key);
        if (!n.blocks.length && !n.pdf && n.text.length && !named(n.text.join(' ')).includes(key)) continue; // only about other campuses
        let cal = null;
        if (n.pdf) {
          try {
            cal = MAK.libraryCalendar(await MAK.pdfContent(await getBytes(n.pdf)), it.date);
          } catch {
            failed = true;
          }
        }
        // A notice that the reader does not understand (uncertain, no rules): no rules, its days come from all its text, the
        // title or the season ("Horario de Navidad"); then the hours of those days are not known (MAK.libraryDay).
        const read = cal ? null : MAK.noticeRules(n.blocks, it.date, key, it.title);
        const rules = read && (read.rules.length || read.other) && !read.uncertain ? read : null;
        const text = MAK.noticePeriod([it.title, ...n.text], it.date);
        const period = cal
          ? calendarPeriod(cal, page && page.week) || { from: new Date(cal.months[0].y, cal.months[0].m, 1).getTime(), to: new Date(cal.months.at(-1).y, cal.months.at(-1).m + 1, 1).getTime() }
          : (rules && rules.rules.length ? rules : null) || (read && read.rules.length && text ? { from: Math.min(read.from, text.from), to: Math.max(read.to, text.to) } : text) || seasonPeriod(it.title, it.date);
        if (period ? period.to <= today : now - it.date > 90 * MAK.DAY) continue;
        notices.push({ title: it.title, date: it.date, url: it.url, blocks: n.blocks, pdf: n.pdf, cal, rules: rules && { rules: rules.rules, weekly: rules.weekly }, from: period ? period.from : 0, to: period ? period.to : 0 });
      } catch {
        failed = true;
      }
      if (notices.length >= 4) break;
    }
    notices.sort((a, b) => (a.from || a.date) - (b.from || b.date));
    return {
      v: MAK.LIBRARY_FORM, at: now, campus: key, partial: !page || !sports || !food.length || failed, board: !!first.items.length, notices,
      food: food.length ? { places: food.filter((p) => p.campus === key) } : null,
      page: page ? { url: c.page, lines: page.lines, week: page.week } : null,
      sports: sports ? { url: MAK.SPORTS_HOURS, access: sports.access, pool: sports.pool } : null
    };
  };

  // The hours of the library on a day: from the calendar or the rules of a notice (the newest one about that day: it
  // corrects the ones before it), else the usual hours of its day of the week. null: a notice without a calendar or rules
  // is about that day (its text says it), or nothing is known. { hours, closed, notice (its title) } or { hours, closed,
  // usual: true }.
  MAK.libraryDay = function (data, when = Date.now()) {
    if (!data || data.board === false) return null;
    const d = new Date(when);
    const day = startOfDay(when);
    const usual = data.page ? MAK.weekToday(data.page.week, when) : null;
    // A day of a notice with the usual hours of its day of the week: also "usual".
    const of = (x, n) => Object.assign({ hours: x.hours, closed: x.closed, notice: n.title },
      usual && usual.closed === !!x.closed && (x.closed || usual.hours === x.hours) ? { usual: true } : {});
    for (const n of MAK.visibleNotices(data, when).sort((a, b) => b.date - a.date)) {
      const month = n.cal && n.cal.months.find((x) => x.y === d.getFullYear() && x.m === d.getMonth());
      if (month && month.days[d.getDate() - 1] === -2) return null;
      const l = month && n.cal.legend[month.days[d.getDate() - 1]];
      if (l) return l.usual ? usual : of(l, n);
      if (n.rules && n.from <= day && day < n.to) {
        // The rule of that day: a day named alone ("13 de julio"), else a closing ("CERRADO: del 6 al 13 de julio"), else
        // days of the week ("Sábados, domingos y festivos permanecerán cerradas", "de lunes a viernes"), else a range of
        // days with hours ("Del 22 al 31 de agosto, de 8:00 a 21:30": not its weekend then); the shortest one first.
        const wd = d.getDay();
        const rank = (r, span) => [span <= MAK.DAY + MAK.HOUR ? 0 : r.closed && !r.days ? 1 : r.days ? 2 : 3, span]; // 25 hours: the day of the change of time
        const found = [
          ...n.rules.rules.filter((r) => r.from <= day && day < r.to && (!r.days || r.days.includes(wd))).map((r) => ({ r, k: rank(r, r.to - r.from) })),
          ...n.rules.weekly.filter((r) => r.days.includes(wd)).map((r) => ({ r, k: rank(r, n.to - n.from) }))
        ].sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1])[0];
        if (found) return of(found.r, n);
      } else if (!n.cal && !n.rules && n.from && n.from <= day && day < n.to) return null;
    }
    return usual;
  };

  MAK.libraryToday = (data, now = Date.now()) => MAK.libraryDay(data, now);

  // A notice in short (the window of a new notice, content-library.js): its days with other hours than the usual ones of
  // their day of the week, in groups of the same hours, the first day first: [{ value: { hours, closed } or null (not
  // known: see the notice), days: [the start of each day], form, weekdays, extra }]. form: 'list' (at most 3 days), 'run'
  // (every day from the first to the last; closed: also the days closed anyway, the weekends), 'week' (every date of some days of the week between the first and the last
  // one, or a day with other hours: weekdays [0..6]; extra: a few days more, the holidays) or 'some'.
  MAK.noticeSummary = function (data, notice) {
    if (!data || !notice || !notice.from) return [];
    const alone = Object.assign({}, data, { notices: [notice], board: true });
    const before = Object.assign({}, data, { notices: [], board: true });
    const groups = new Map();
    const special = new Set();
    const shut = new Set(); // closed, also as usual
    const start = new Date(notice.from);
    for (let k = 0; k < 200; k++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + k);
      if (d.getTime() >= notice.to) break;
      const noon = d.getTime() + 12 * MAK.HOUR;
      const x = MAK.libraryDay(alone, noon);
      if (x && x.closed) shut.add(d.getTime());
      if (x ? x.usual || !x.notice : !MAK.libraryDay(before, noon)) continue; // the usual hours, or nothing known anyway
      const key = !x ? '?' : x.closed ? 'closed' : x.hours;
      if (!groups.has(key)) groups.set(key, { value: x && { hours: x.hours, closed: !!x.closed }, days: [] });
      groups.get(key).days.push(d.getTime());
      special.add(d.getTime());
    }
    return [...groups.values()].map((g) => {
      const first = new Date(g.days[0]);
      const last = new Date(g.days.at(-1));
      const between = [];
      for (let d = first; d <= last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) between.push(d);
      if (g.days.length <= 3) return Object.assign(g, { form: 'list' });
      const mine = new Set(g.days);
      if (between.every((d) => mine.has(d.getTime()) || (g.value && g.value.closed && shut.has(d.getTime())))) return Object.assign(g, { form: 'run' });
      const weekdays = [0, 1, 2, 3, 4, 5, 6].filter((wd) => {
        const dates = between.filter((d) => d.getDay() === wd);
        return dates.some((d) => mine.has(d.getTime())) && dates.every((d) => special.has(d.getTime()));
      });
      const extra = g.days.filter((t) => !weekdays.includes(new Date(t).getDay()));
      return Object.assign(g, weekdays.length && extra.length * 3 <= g.days.length ? { form: 'week', weekdays, extra: extra.length > 0 } : { form: 'some' });
    }).sort((a, b) => a.days[0] - b.days[0]);
  };
  // Why a notice closes the library, from its title: 'summer', 'easter', 'christmas' or ''.
  MAK.closedReason = (title) => {
    const s = fold(title || '');
    return /verano/.test(s) ? 'summer' : /semana santa/.test(s) ? 'easter' : /navidad|navide/.test(s) ? 'christmas' : /vacacion/.test(s) ? 'holidays' : '';
  };

  // Open now and until when, or closed and when it opens: { open, at } (at: the time of the change; 0: not known in the
  // next days, two weeks by default). dayOf(time) gives the hours of the day of that time (MAK.libraryDay, MAK.weekToday): { hours: "9:00–
  // 22:45" } or { closed: true }; null: not known (then null, or at 0 if it is not today).
  MAK.openState = function (dayOf, now = Date.now(), days = 14) {
    const d = new Date(now);
    const at = (base, mins) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(mins / 60), mins % 60).getTime();
    const today = dayOf(now);
    const span = today && !today.closed ? minutes(today.hours) : null;
    if (!today || (!today.closed && !span)) return null;
    const mins = d.getHours() * 60 + d.getMinutes();
    if (span && mins >= span[0] && mins < span[1]) return { open: true, at: at(d, span[1]) };
    if (span && mins < span[0]) return { open: false, at: at(d, span[0]) };
    for (let k = 1; k <= days; k++) {
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
