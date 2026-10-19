// Aulario Plus: the degree of the user and its exams (public pages of the UPNA).
// - The degree: the plan code and the degree line of the course guides ("Graduado o Graduada en
//   X por la Universidad Pública de Navarra"), found in the list of degrees (sites/grados).
// - The page "Evaluación" of the degree: the periods of the exams of each semester and the links
//   to the exam calendars (PDF files on www2.unavarra.es).
// - The rows of an exam calendar (lib/pdftext.js): the subject code, the final exam and the
//   recovery exam. Only the PDFs with one row for each subject give rows.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  const ORIGIN = 'https://www.unavarra.es';
  MAK.DEGREE_LIST_URL = `${ORIGIN}/sites/grados/home.html`;
  MAK.DEGREE_MS = 7 * 24 * 60 * 60 * 1000; // the degree and its page are read again after 7 days
  MAK.EXAMS_MS = 24 * 60 * 60 * 1000; // an exam calendar is read again after 1 day (the rooms change)
  MAK.EXAMS_ORIGIN = 'https://www2.unavarra.es';
  MAK.EXPEDIENTE_URL = 'https://portal.unavarra.es/group/estudiantes/servicios-sigma';
  // The optional permission to read the exam calendars (the user gives it in tools.html?perm=exams).
  MAK.EXAMS_PERMISSION = { origins: [`${MAK.EXAMS_ORIGIN}/*`] };

  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const cut = (s, n) => String(s || '').slice(0, n);
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  // "Graduado o Graduada en Ingeniería Informática por la Universidad Pública de Navarra" ->
  // "Ingeniería Informática". Another text: "".
  MAK.degreeName = function (line) {
    const m = /graduad[oa](?:\s+o\s+graduad[oa])?\s+en\s+(.+?)\s+por\s+la\s+universidad/i.exec(String(line || ''));
    return m ? m[1].trim() : '';
  };

  // The base address of a degree: https://www.unavarra.es/sites/grados/<area>/<degree>. From a link
  // of the list ("<degree>.html" or "<degree>/presentacion.html"). Another address: null.
  MAK.degreeBase = function (href) {
    try {
      const u = new URL(String(href), ORIGIN);
      if (u.origin !== ORIGIN) return null;
      const m = /^\/sites\/grados\/([a-z0-9-]+)\/([a-z0-9-]+)(?:\.html|\/[a-z0-9-]+\.html)$/.exec(u.pathname);
      return m ? `${ORIGIN}/sites/grados/${m[1]}/${m[2]}` : null;
    } catch {
      return null;
    }
  };
  MAK.isDegreeBase = (v) => typeof v === 'string' && MAK.degreeBase(`${v}.html`) === v;
  MAK.evaluationUrl = (base) => `${base}/evaluacion.html`;

  // The degrees of the list page: [{ name, base }], without the same degree two times.
  MAK.parseDegreeList = function (doc) {
    const out = [];
    for (const a of doc.querySelectorAll('a[href]')) {
      const name = text(a);
      if (!/^(grado|doble grado|programa internacional)/i.test(name)) continue;
      const base = MAK.degreeBase(a.getAttribute('href'));
      if (base && !out.some((d) => d.base === base)) out.push({ name: cut(name, 200), base });
      if (out.length >= 200) break;
    }
    return out;
  };

  // The degree of the list for a name of a guide: first "Grado en <name>" ("Grado dual en" too),
  // then the first degree that contains the name. No name or no degree: null.
  MAK.matchDegree = function (name, list) {
    const n = norm(name);
    if (!n || !Array.isArray(list)) return null;
    const plain = (d) => norm(d.name).replace(/^grado (dual )?en /, '');
    return list.find((d) => /^grado /i.test(d.name) && plain(d) === n) || list.find((d) => norm(d.name).includes(n)) || null;
  };

  // The plan code of most of the guides (codPlan in the address of a guide), or ''.
  MAK.degreePlan = function (guides) {
    const count = new Map();
    for (const g of guides || []) {
      let plan = '';
      try { plan = new URL(g.url).searchParams.get('codPlan') || ''; } catch {}
      if (/^\d{2,6}$/.test(plan)) count.set(plan, (count.get(plan) || 0) + 1);
    }
    return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  };

  // The name of the degree in the guides with this plan (the degree line of the guide), or ''.
  MAK.degreeOfGuides = function (guides, plan) {
    for (const g of guides || []) {
      let p = '';
      try { p = new URL(g.url).searchParams.get('codPlan') || ''; } catch {}
      if ((!plan || p === plan) && MAK.degreeName(g.degree)) return MAK.degreeName(g.degree);
    }
    return '';
  };

  // An address of an exam calendar: a PDF file on www2.unavarra.es (https). Another address: null.
  MAK.examPdfUrl = function (href) {
    try {
      const u = new URL(String(href), ORIGIN);
      u.protocol = 'https:';
      return u.origin === MAK.EXAMS_ORIGIN && /\.pdf$/i.test(u.pathname) && !u.username && !u.password ? u.href : null;
    } catch {
      return null;
    }
  };

  const seasonOf = (s) => (/oto[nñ]o|autumn|udazken/i.test(s) ? 'autumn' : /primavera|spring|udaberri/i.test(s) ? 'spring' : null);
  const RECOVERY = /recuperaci[oó]n|extraordinari/i;
  const FINALS = /ex[aá]menes finales|(?<!extra)ordinari/i;
  const EXAM_LINK = /ex[aá]men|evaluaci[oó]n (ordinaria|extraordinaria)|calendario/i;
  const NOT_EXAMS = /normativa|preguntas|fraude|directrices|castellano|euskera/i;

  // The page "Evaluación" of a degree: { periods: [{ season, finals, recovery }], pdfs: [{ text, url, season }] }.
  // Each semester is a section with a heading ("Evaluación de Otoño"), the periods in a list, and
  // the links to the PDF files. The text of the links is different in each faculty.
  MAK.parseEvaluation = function (doc) {
    const periods = [];
    const pdfs = [];
    let season = null;
    let period = null;
    for (const el of doc.querySelectorAll('h2, h3, h4, li, p, a[href]')) {
      if (/^H[2-4]$/.test(el.tagName)) {
        const s = seasonOf(text(el));
        if (s && s !== season) {
          season = s;
          period = { season, finals: '', recovery: '' };
          periods.push(period);
        }
        continue;
      }
      if (el.tagName === 'A') {
        const url = MAK.examPdfUrl(el.getAttribute('href'));
        const t = text(el);
        if (url && EXAM_LINK.test(t) && !NOT_EXAMS.test(t) && !pdfs.some((p) => p.url === url) && pdfs.length < 8) {
          pdfs.push({ text: cut(t, 120), url, season: seasonOf(t) || season });
        }
        continue;
      }
      if (!period || el.querySelector('li, p')) continue;
      const line = text(el);
      if (!/periodo|ex[aá]menes|evaluaci[oó]n/i.test(line) || el.querySelector('a')) continue;
      const value = cut(line.replace(/^[^:]*:\s*/, '').replace(/\.$/, ''), 200);
      if (RECOVERY.test(line.split(':')[0])) { if (!period.recovery) period.recovery = value; }
      else if (FINALS.test(line.split(':')[0]) && !period.finals) period.finals = value;
    }
    return { periods: periods.filter((p) => p.finals || p.recovery).slice(0, 4), pdfs };
  };

  // The semester of a date: autumn from August to January (the recovery exams are in January).
  MAK.currentSeason = (now) => {
    const m = new Date(now).getMonth();
    return m >= 7 || m === 0 ? 'autumn' : 'spring';
  };

  // "11/01/2027 08:00" -> the time (local).
  const when = (d, t) => {
    const [day, month, year] = d.split('/').map(Number);
    const [h, min] = t.split(':').map(Number);
    const ms = new Date(year, month - 1, day, h, min).getTime();
    return Number.isFinite(ms) ? ms : null;
  };
  // A date and a time: "11/01/2027 08:00". A new RegExp for each search (no shared lastIndex).
  const DATE_TIME = '(\\d{2}/\\d{2}/\\d{4})\\s+(\\d{1,2}:\\d{2})';
  const hasDateTime = (s) => new RegExp(DATE_TIME).test(s);

  // The rows of an exam calendar (the lines of lib/pdftext.js): [{ code, name, final, recovery }].
  // A row starts with the subject code (6 digits). A PDF can cut the name of a row in parts: the
  // parts of the name join without a space, the dates with a space.
  MAK.parseExamRows = function (lines) {
    const rows = [];
    let cur = null;
    const close = () => {
      if (!cur) return;
      const pairs = [...cur.text.matchAll(new RegExp(DATE_TIME, 'g'))];
      if (pairs.length) {
        const name = cur.text.slice(0, pairs[0].index).trim();
        const room = (i) => (pairs[i] ? cur.text.slice(pairs[i].index + pairs[i][0].length, pairs[i + 1] ? pairs[i + 1].index : undefined).trim().slice(0, 40) : '');
        rows.push({
          code: cur.code,
          name: cut(name, 200),
          final: when(pairs[0][1], pairs[0][2]),
          finalRoom: room(0),
          recovery: pairs[1] ? when(pairs[1][1], pairs[1][2]) : null,
          recoveryRoom: room(1)
        });
      }
      cur = null;
    };
    for (const raw of lines || []) {
      const line = String(raw).trim();
      const m = /^(\d{6})(?:\s+(.*))?$/.exec(line);
      if (m) {
        close();
        cur = { code: m[1], text: m[2] || '' };
        continue;
      }
      if (!cur) continue;
      if (/^\d{2}\/\d{2}\/\d{4}/.test(line)) cur.text += ` ${line}`;
      else if (hasDateTime(cur.text)) close(); // the row has its dates: this line is another thing
      else cur.text += line;
      if (rows.length >= 500) break;
    }
    close();
    return rows;
  };

  // The exams of the subjects of the user: the rows with the code of a guide, the next first.
  // subjects: [{ code, siteId }]. Each result: the row and the site.
  MAK.myExams = function (rows, subjects, now) {
    const bySite = new Map((subjects || []).filter((s) => s.code).map((s) => [s.code, s.siteId]));
    const out = [];
    for (const r of rows || []) {
      if (!bySite.has(r.code) || out.some((x) => x.code === r.code)) continue;
      out.push(Object.assign({}, r, { siteId: bySite.get(r.code) }));
    }
    const next = (r) => [r.final, r.recovery].filter((t) => t && t >= now - 86400000).sort((a, b) => a - b)[0] || Infinity;
    return out.sort((a, b) => next(a) - next(b) || (a.final || 0) - (b.final || 0));
  };

  // ---- Wuolah: the community of the degree (notes and exams that the students share) --------
  // The addresses of Wuolah do not come from the names (for example "grado-biotecnologia-2"), so a
  // table gives the community of each degree of the UPNA (wuolah.com/university/universidad-publica-
  // de-navarra/grado-universitario-es, 2026-10-19). The extension sends no request to Wuolah.
  MAK.WUOLAH_ORIGIN = 'https://wuolah.com';
  MAK.WUOLAH_UPNA = `${MAK.WUOLAH_ORIGIN}/university/universidad-publica-de-navarra/grado-universitario-es`;
  const AGRO = 'upna-escuela-tecnica-superior-ingenieria-agronomic';
  const ETSIIIT = 'upna-escuela-tecnica-superior-ingenieria-industria';
  const ECO = 'upna-facultad-ciencias-economicas-empresariales';
  const HUM = 'upna-facultad-ciencias-humanas-sociales-educacion';
  const LAW = 'upna-facultad-ciencias-juridicas';
  const COMMUNITIES = {
    agro: [`${AGRO}/grado-ingenieria-agroalimentaria-medio-rural`, 'Ingeniería Agroalimentaria'],
    food: [`${AGRO}/grado-innovacion-procesos-productos-alimentarios`, 'Innovación de Procesos y Productos Alimentarios'],
    biotec: [`${AGRO}/grado-biotecnologia-2`, 'Biotecnología'],
    science: [`${AGRO}/grado-ciencias`, 'Ciencias'],
    data: [`${AGRO}/grado-ciencia-datos-2`, 'Ciencia de Datos'],
    electric: [`${ETSIIIT}/grado-ingenieria-electrica-electronica`, 'Ingeniería Eléctrica y Electrónica'],
    telecom: [`${ETSIIIT}/grado-ingenieria-tecnologias-telecomunicacion`, 'Telecomunicación'],
    industrial: [`${ETSIIIT}/grado-ingenieria-tecnologias-industriales`, 'Tecnologías Industriales'],
    mechanical: [`${ETSIIIT}/grado-ingenieria-mecanica`, 'Ingeniería Mecánica'],
    computer: [`${ETSIIIT}/grado-ingenieria-informatica`, 'Ingeniería Informática'],
    design: ['upna-escuela-tecnica-superior-ingenieros-industria/grado-ingenieria-diseno-mecanico', 'Diseño Mecánico'],
    nursing: ['upna-facultad-ciencias-salud/grado-enfermeria', 'Enfermería'],
    ade: [`${ECO}/grado-administracion-direccion-empresas`, 'ADE'],
    economy: [`${ECO}/grado-economia`, 'Economía'],
    infant: [`${HUM}/grado-maestroa-educacion-infantil`, 'Educación Infantil'],
    primary: [`${HUM}/grado-maestroa-educacion-primaria`, 'Educación Primaria'],
    sociology: [`${HUM}/grado-sociologia-aplicada`, 'Sociología Aplicada'],
    social: [`${HUM}/grado-trabajo-social`, 'Trabajo Social'],
    law: [`${LAW}/grado-derecho`, 'Derecho'],
    labour: [`${LAW}/grado-relaciones-laborales-recursos-humanos`, 'Relaciones Laborales'],
  };
  // The degree of the UPNA ("area/degree" of its address) -> its communities. A double degree has
  // two; an international program has the community of its degree. The other degrees have none.
  MAK.WUOLAH = {
    'agroalimentacion/ingenieria-agroalimentaria-rural': ['agro'],
    'agroalimentacion/innovacion-procesos-alimentarios': ['food'],
    'agroalimentacion/doble-agroalimentaria-innovacion': ['agro', 'food'],
    'ciencias/biotecnologia': ['biotec'],
    'ciencias/ciencia-de-datos': ['data'],
    'ciencias/ciencias': ['science'],
    'ciencias/doble-ciencia-datos-ade': ['data', 'ade'],
    'ciencias/doble-ciencia-datos-biotec': ['data', 'biotec'],
    'economia-y-empresa/administracion-empresas': ['ade'],
    'economia-y-empresa/economia': ['economy'],
    'economia-y-empresa/internacional-ade': ['ade'],
    'economia-y-empresa/doble-ade-derecho': ['ade', 'law'],
    'economia-y-empresa/internacional-doble-ade-economia': ['ade', 'economy'],
    'economia-y-empresa/doble-internacional-ade-derecho': ['ade', 'law'],
    'educacion/maestro-educacion-infantil': ['infant'],
    'educacion/maestro-educacion-primaria': ['primary'],
    'educacion/internacional-maestro-infantil': ['infant'],
    'educacion/internacional-maestro-primaria': ['primary'],
    'educacion/doble-maestro-infantil-primaria': ['infant', 'primary'],
    'educacion/internacional-infantil-primaria': ['infant', 'primary'],
    'humanas-y-sociales/sociologia-aplicada': ['sociology'],
    'humanas-y-sociales/trabajo-social': ['social'],
    'industriales/ingenieria-electrica-electronica': ['electric'],
    'industriales/ingenieria-mecanica': ['mechanical'],
    'industriales/disenio-mecanico': ['design'],
    'industriales/tecnologias-industriales': ['industrial'],
    'industriales/internacional-industriales': ['industrial'],
    'informatica-y-telecomunicacion/ingenieria-informatica': ['computer'],
    'informatica-y-telecomunicacion/internacional-informatica': ['computer'],
    'informatica-y-telecomunicacion/ingenieria-telecomunicacion': ['telecom'],
    'informatica-y-telecomunicacion/internacional-telecomunicacion': ['telecom'],
    'informatica-y-telecomunicacion/doble-biomedica-telecomunicacion': ['telecom'],
    'juridicas/derecho': ['law'],
    'juridicas/laborales-recursos-humanos': ['labour'],
    'salud/enfermeria': ['nursing']
  };

  // The links to Wuolah for a degree: [{ url, name, year }], at the year of the user ("?course=4").
  // A degree without a community: the page of the degrees of the UPNA in Wuolah ({ url, name: '' }).
  MAK.wuolahLinks = function (base, year) {
    const key = MAK.isDegreeBase(base) ? base.slice(`${ORIGIN}/sites/grados/`.length) : '';
    const ids = Object.prototype.hasOwnProperty.call(MAK.WUOLAH, key) ? MAK.WUOLAH[key] : null;
    if (!ids) return [{ url: MAK.WUOLAH_UPNA, name: '', year: null }];
    const y = Number.isInteger(year) && year >= 1 && year <= 6 ? year : null;
    return ids.map((id) => ({ url: `${MAK.WUOLAH_ORIGIN}/${COMMUNITIES[id][0]}${y ? `?course=${y}` : ''}`, name: COMMUNITIES[id][1], year: y }));
  };

  // The year of the user: the year ("Curso") of most of the guides, the higher one if two are the
  // same; else from the subject codes (plan code, then the semester: 240702 -> semester 7 -> year 4).
  // No data: null.
  MAK.studyYear = function (guides) {
    const most = (list) => {
      const count = new Map();
      for (const y of list) count.set(y, (count.get(y) || 0) + 1);
      return [...count].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] || null;
    };
    const list = (guides || []).filter(Boolean);
    const byCourse = list.map((g) => Number(g.course)).filter((y) => Number.isInteger(y) && y >= 1 && y <= 6);
    if (byCourse.length) return most(byCourse);
    const byCode = list.map((g) => {
      let plan = '';
      try { plan = new URL(g.url).searchParams.get('codPlan') || ''; } catch {}
      const code = String(g.code || '');
      const semester = plan && code.startsWith(plan) && code.length === plan.length + 3 ? Number(code[plan.length]) : 0;
      return semester >= 1 && semester <= 8 ? Math.ceil(semester / 2) : 0;
    }).filter(Boolean);
    return byCode.length ? most(byCode) : null;
  };

  // The stored form of the degree (it comes from a message): known fields with limits.
  MAK.cleanDegree = function (d) {
    if (!d || typeof d !== 'object' || !MAK.isDegreeBase(d.base)) return null;
    const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
    const season = (s) => (s === 'autumn' || s === 'spring' ? s : null);
    return {
      base: d.base,
      name: str(d.name, 200),
      plan: /^\d{2,6}$/.test(d.plan) ? d.plan : '',
      periods: (Array.isArray(d.periods) ? d.periods : []).slice(0, 4).map((p) => ({ season: season(p && p.season), finals: str(p && p.finals, 200), recovery: str(p && p.recovery, 200) })).filter((p) => p.season),
      pdfs: (Array.isArray(d.pdfs) ? d.pdfs : []).slice(0, 8).map((p) => ({ text: str(p && p.text, 120), url: MAK.examPdfUrl(p && p.url), season: season(p && p.season) })).filter((p) => p.url)
    };
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
