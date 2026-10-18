// Aulario Plus: the course guide ("Guía docente") of a site. MiAulario shows it in a page of the site
// (a "Web content" tool, sakai.iframe): an iframe with the public page of the UPNA
//   https://www.unavarra.es/ficha-asignaturaDOA/?languageId=…&codPlan=…&codAsig=…&anio=…
// The extension reads from it: the data of the subject, the teachers (the responsible teacher and
// the link to the office hours) and the table of the assessment (activity, weight, recoverable,
// minimum grade or compulsory attendance) with its notes.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  MAK.GUIDE_ORIGIN = 'https://www.unavarra.es';
  MAK.GUIDE_MS = 7 * 24 * 60 * 60 * 1000; // a stored guide is read again after 7 days
  MAK.GUIDE_TITLE = /gu[ií]a\s*docente|teaching\s*guide|irakaskuntza[-\s]*gida/i;

  // The address of a guide, or null: only the page of the UPNA, with the 4 parameters in digits.
  MAK.guideUrl = function (u) {
    let url;
    try {
      url = new URL(String(u || '').replace(/&amp;/g, '&'), MAK.GUIDE_ORIGIN);
    } catch {
      return null;
    }
    if (url.origin !== MAK.GUIDE_ORIGIN || !/^\/ficha-asignaturaDOA\/?$/.test(url.pathname)) return null;
    const q = {};
    for (const k of ['languageId', 'codPlan', 'codAsig', 'anio']) {
      const v = url.searchParams.get(k);
      if (!/^\d{1,10}$/.test(v || '')) return null;
      q[k] = v;
    }
    return `${MAK.GUIDE_ORIGIN}/ficha-asignaturaDOA/?${new URLSearchParams(q)}`;
  };

  // The address of the guide in the HTML of the page of the tool (the iframe), or null.
  MAK.findGuideUrl = function (html) {
    for (const m of String(html || '').matchAll(/(?:src|href)\s*=\s*["']([^"']*ficha-asignaturaDOA[^"']*)["']/gi)) {
      const u = MAK.guideUrl(m[1]);
      if (u) return u;
    }
    return null;
  };

  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const cut = (s, n) => String(s || '').slice(0, n);
  const absolute = (href) => {
    try {
      const u = new URL(href, MAK.GUIDE_ORIGIN);
      return u.origin === MAK.GUIDE_ORIGIN ? u.href : null;
    } catch {
      return null;
    }
  };
  // "10%", "35 %", "12,5%" -> 10, 35, 12.5. No number -> null.
  MAK.guideWeight = function (s) {
    const m = /(\d+(?:[.,]\d+)?)/.exec(String(s || ''));
    return m ? Number(m[1].replace(',', '.')) : null;
  };

  // Read the page of a guide (a Document). Null if it is not a guide.
  MAK.parseGuide = function (doc, url) {
    const head = doc.querySelector('table');
    if (!head || !/c[oó]digo|code|kodea/i.test(text(head))) return null;
    const info = {};
    for (const cell of head.querySelectorAll('td, th')) {
      const m = /^([^:]{2,30}):\s*(.*)$/.exec(text(cell));
      if (m) info[m[1].toLowerCase()] = cut(m[2], 200);
    }
    const pick = (re) => {
      const k = Object.keys(info).find((x) => re.test(x));
      return k ? info[k] : '';
    };
    // The teachers: the links to their pages. "(Resp)" is the responsible teacher; the next link
    // "[Tutorías]" goes to the office hours.
    const teachers = [];
    for (const a of head.querySelectorAll('a[href]')) {
      const t = text(a);
      if (/^\[?\s*(tutor|office|tutoretza)/i.test(t)) {
        const last = teachers[teachers.length - 1];
        if (last && !last.tutorias) last.tutorias = absolute(a.getAttribute('href'));
        continue;
      }
      if (!t || t.startsWith('[') || teachers.length >= 20) continue;
      teachers.push({ name: cut(t.replace(/\(\s*resp[^)]*\)/i, '').trim(), 120), resp: /\(\s*resp/i.test(t), tutorias: null });
    }
    // The section "Evaluación": its table, and the text before and after it (the rules).
    const evaluation = { rows: [], notes: [] };
    const h = [...doc.querySelectorAll('h2, h3, h4')].find((x) => /^(evaluaci[oó]n|assessment|ebaluazioa)$/i.test(text(x)));
    for (let e = h && h.nextElementSibling; e && !/^H[1-4]$/.test(e.tagName); e = e.nextElementSibling) {
      const table = e.tagName === 'TABLE' ? e : e.querySelector('table');
      if (table && !evaluation.rows.length) evaluation.rows = readAssessment(table);
      else if (!table && text(e) && evaluation.notes.length < 12) evaluation.notes.push(cut(text(e), 800));
    }
    return {
      url: MAK.guideUrl(url),
      code: pick(/^c[oó]digo|^code|^kodea/),
      name: pick(/^asignatura|^subject|^irakasgaia/),
      credits: pick(/^cr[eé]ditos|^credits|^kredituak/),
      type: pick(/^tipo|^type|^mota/),
      period: pick(/^periodo|^period|^aldia/),
      department: pick(/^departamento|^department|^saila/),
      teachers,
      evaluation
    };
  };

  function readAssessment(table) {
    const rows = [...table.rows];
    if (!rows.length) return [];
    const headers = [...rows[0].cells].map(text);
    const col = (re) => headers.findIndex((x) => re.test(x));
    const cA = col(/actividad|activity|jarduera/i);
    const cW = col(/peso|weight|pisua/i);
    const cR = col(/recuperable|recoverable|berreskura/i);
    const cM = col(/m[ií]nim|minimum|gutxieneko/i);
    const cT = col(/asistencia|attendance|asistentzia/i);
    if (cA < 0 || cW < 0) return [];
    const at = (cells, i) => (i >= 0 ? cut(cells[i] || '', 200) : '');
    const out = [];
    for (const r of rows.slice(1, 31)) {
      const c = [...r.cells].map(text);
      if (!c[cA]) continue;
      out.push({ activity: at(c, cA), weight: MAK.guideWeight(c[cW]), weightText: at(c, cW), recoverable: at(c, cR), minimum: at(c, cM), attendance: at(c, cT) });
    }
    return out;
  }

  // The stored form of a guide: only the known fields, with limits (it comes from a message).
  MAK.cleanGuide = function (g) {
    if (!g || typeof g !== 'object') return null;
    const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
    const ev = g.evaluation && typeof g.evaluation === 'object' ? g.evaluation : {};
    return {
      url: MAK.guideUrl(g.url),
      code: str(g.code, 40), name: str(g.name, 200), credits: str(g.credits, 20), type: str(g.type, 60), period: str(g.period, 60), department: str(g.department, 200),
      teachers: (Array.isArray(g.teachers) ? g.teachers : []).slice(0, 20).map((t) => ({ name: str(t && t.name, 120), resp: !!(t && t.resp), tutorias: t && typeof t.tutorias === 'string' && t.tutorias.startsWith(`${MAK.GUIDE_ORIGIN}/`) ? t.tutorias.slice(0, 300) : null })).filter((t) => t.name),
      evaluation: {
        rows: (Array.isArray(ev.rows) ? ev.rows : []).slice(0, 30).map((r) => ({
          activity: str(r && r.activity, 200), weight: r && typeof r.weight === 'number' && r.weight >= 0 && r.weight <= 100 ? r.weight : null,
          weightText: str(r && r.weightText, 40), recoverable: str(r && r.recoverable, 200), minimum: str(r && r.minimum, 200), attendance: str(r && r.attendance, 200)
        })).filter((r) => r.activity),
        notes: (Array.isArray(ev.notes) ? ev.notes : []).slice(0, 12).map((n) => str(n, 800)).filter(Boolean)
      }
    };
  };

  // ---- The kind of an activity ---------------------------------------------------------
  // The guide does not give the kind of an activity: the extension finds it in the name. The order
  // of the rules is important: "Examen teórico-práctico" is an exam, "Asistencia a sesiones de
  // laboratorio" is participation, "Entrega de prácticas" is practice, "Entrega 1" is work.
  const KINDS = [
    ['exam', /examen|parcial|prueba escrita|prueba de respuesta|cuestionario|\btest\b|ex[aá]men/],
    ['participation', /participaci|asistencia|actitud|intervenci|evoluci|seguimiento|registro del profesor/],
    ['practice', /pr[aá]ctic|laborator|\blab\b|experimental|taller/],
    ['work', /entrega|trabajo|proyecto|informe|memoria|ejercicio|problema|caso|portafolio|portfolio/],
    ['presentation', /presentaci|exposici|defensa|\boral\b/],
    ['exam', /prueba|teor[ií]/]
  ];
  MAK.ACTIVITY_KINDS = ['exam', 'practice', 'work', 'participation', 'presentation', 'other'];
  MAK.activityKind = function (name) {
    const s = String(name || '').toLowerCase();
    const k = KINDS.find(([, re]) => re.test(s));
    return k ? k[0] : 'other';
  };

  // The weights by kind, in the order of the first activity of each kind: [{ kind, weight, names }].
  MAK.weightsByKind = function (rows) {
    const out = [];
    for (const r of rows || []) {
      if (!(r.weight > 0)) continue;
      const kind = MAK.activityKind(r.activity);
      let part = out.find((p) => p.kind === kind);
      if (!part) out.push((part = { kind, weight: 0, names: [] }));
      part.weight += r.weight;
      part.names.push(r.activity);
    }
    return out;
  };

  // ---- Names -------------------------------------------------------------------

  // "García López, Jesús" and "GARCIA LOPEZ, JESUS (jgarcia)" -> "GARCIA LOPEZ, JESUS".
  MAK.normName = function (s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\([^()]*\)/g, ' ')
      .toUpperCase()
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // The teacher of the guide with the name of a label of the list "Para", or null.
  MAK.guideTeacher = function (guide, label) {
    const n = MAK.normName(label);
    return ((guide && guide.teachers) || []).find((t) => MAK.normName(t.name) === n) || null;
  };

  // ---- The weights of the guide in the grade calculator -------------------------------

  // "Entrega1 - Análisis" -> ["entrega", "1", "analisis"].
  const words = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/(\d)([a-z])|([a-z])(\d)/g, '$1$3 $2$4').split(/[^a-z0-9]+/).filter(Boolean);
  const stem = (w) => w.replace(/(es|s)$/, '');
  // An item of the gradebook is a part of an activity of the guide: the same words in the same
  // order ("Entrega 1" in "Entrega 1 - Análisis"), or, for an activity without a number
  // ("Prácticas"), the same first word ("Práctica 2").
  MAK.activityMatches = function (activity, item) {
    const a = words(activity);
    const b = words(item);
    if (!a.length || !b.length) return false;
    // x is a sequence of whole words of y ("entrega 1" is in "entrega 1 analisis", not in "entrega 10").
    const inside = (x, y) => y.some((_, i) => x.every((w, j) => y[i + j] === w));
    if (inside(a, b) || inside(b, a)) return true;
    const hasNumber = a.some((w) => /^\d+$/.test(w));
    return !hasNumber && stem(a[0]) === stem(b[0]) && stem(a[0]).length >= 4;
  };

  // A book for MAK.gradeModel with the weights of the guide: each activity with a weight is a
  // category; it has the items of the gradebook that match it, or one empty item (not graded yet,
  // so the simulator can give it a value). Null if the guide has no weights.
  MAK.guideBook = function (guide, book) {
    const acts = ((guide && guide.evaluation && guide.evaluation.rows) || []).filter((r) => r.weight > 0);
    if (!acts.length) return null;
    const items = book.categories.flatMap((c) => c.items);
    const used = new Set();
    // The activities with a number first ("Entrega 1"), then the general ones ("Prácticas").
    const order = acts.map((a, i) => i).sort((x, y) => Number(!/\d/.test(acts[x].activity)) - Number(!/\d/.test(acts[y].activity)));
    const matched = new Map();
    for (const i of order) {
      const list = items.filter((it) => !used.has(it.key) && MAK.activityMatches(acts[i].activity, it.name));
      for (const it of list) used.add(it.key);
      matched.set(i, list);
    }
    const categories = acts.map((a, i) => {
      const list = matched.get(i);
      return {
        name: a.activity,
        weight: a.weight,
        gradeText: '',
        minimum: a.minimum,
        recoverable: a.recoverable,
        matched: list.length > 0,
        items: list.length ? list : [{ key: `guide${i}`, name: a.activity, score: null, max: 10, placeholder: true }]
      };
    });
    const unused = items.filter((it) => !used.has(it.key)).map((it) => Object.assign({}, it, { reason: 'notInGuide' }));
    const total = acts.reduce((n, a) => n + a.weight, 0);
    return { weighted: true, fromGuide: true, total, categories, unused: unused.concat(book.unused), courseGradeText: book.courseGradeText };
  };

  // The minimum grade (0..10) of an activity from its text ("5 sobre 10", "4,5", "50 %"), or null
  // ("No", empty).
  MAK.guideMinimum = function (text) {
    const s = String(text || '');
    const n = MAK.guideWeight(s);
    if (n === null || n <= 0) return null;
    if (/%/.test(s)) return n / 10;
    const m = /sobre\s*(\d+(?:[.,]\d+)?)|\/\s*(\d+(?:[.,]\d+)?)|out of\s*(\d+)/i.exec(s);
    const of = m ? Number((m[1] || m[2] || m[3]).replace(',', '.')) : 10;
    return of > 0 ? Math.min(10, (n / of) * 10) : null;
  };

  // ---- Get a guide -------------------------------------------------------------------

  // The guide of a site: the stored one if it is recent, else read again. tool: pages[siteId].guide.
  // fetchMia(path) -> HTML of a page of MiAulario; fetchGuide(url) -> HTML of the guide;
  // parse(html) -> Document; save(guide) -> store it. Returns the guide or null.
  MAK.loadGuide = async function ({ tool, stored, now, fetchMia, fetchGuide, parse, save }) {
    if (!tool || !tool.placement) return null;
    if (stored && now - stored.at < MAK.GUIDE_MS) return stored.guide || null;
    const url = MAK.findGuideUrl(await fetchMia(`/portal/tool/${encodeURIComponent(tool.placement)}`));
    const guide = url ? MAK.parseGuide(parse(await fetchGuide(url)), url) : null;
    await save(guide);
    return guide;
  };

  // In a page of MiAulario (content scripts): the guide of a site. The guide is on another origin,
  // so the background script gets it (fetchGuide) and stores it (saveGuide). data: { pages, guides }
  // from the storage; send(message) -> the answer of the background script.
  MAK.pageGuide = function (siteId, data, send) {
    return MAK.loadGuide({
      tool: data.pages && data.pages[siteId] && data.pages[siteId].guide,
      stored: data.guides && data.guides[siteId],
      now: Date.now(),
      fetchMia: async (path) => (await fetch(path, { credentials: 'include' })).text(),
      fetchGuide: async (url) => {
        const r = await send({ type: 'fetchGuide', url });
        if (!r || !r.html) throw new Error((r && r.error) || 'guide.network');
        return r.html;
      },
      parse: (html) => new DOMParser().parseFromString(html, 'text/html'),
      save: (guide) => send({ type: 'saveGuide', siteId, guide })
    });
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
