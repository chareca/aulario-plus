// Aulario Plus: a small reader of the text of a PDF file (the exam calendars of the UPNA).
// It reads the content streams (FlateDecode) and the text operators Tj and TJ with literal
// strings: the PDFs of simple fonts (WinAnsi). One line for each operator. A PDF with other fonts
// (hex strings, CID fonts) gives lines without the text: then the caller finds no rows.
// No packages: DecompressionStream is in the browsers, in the service worker and in Node.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  const MAX_STREAMS = 400;
  const MAX_CHARS = 2000000;
  const MAX_INFLATE = 20000000; // the bytes of one stream after the decompression: a "zip bomb" stops here
  const MAX_INFLATE_ALL = 50000000; // and of all the streams of a file
  const GAP = -200; // a move in a TJ array of less than -200 thousandths of an em is a space

  async function inflate(bytes) {
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
    const parts = [];
    let size = 0;
    for (let r; !(r = await reader.read()).done;) {
      size += r.value.length;
      if (size > MAX_INFLATE) {
        reader.cancel().catch(() => {});
        throw new Error('pdf: stream too large');
      }
      parts.push(r.value);
    }
    return new Uint8Array(await new Blob(parts).arrayBuffer());
  }

  // The characters of the bytes of a simple font (WinAnsi = windows-1252). Made at the first use.
  let decoders = null;
  const dec = () => (decoders = decoders || { ansi: new TextDecoder('windows-1252'), latin: new TextDecoder('latin1') });

  // The literal string that starts at s[i] ("("): its bytes and the position after it.
  function literalBytes(s, i) {
    let depth = 0;
    const bytes = [];
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (c === '\\') {
        const n = s[j + 1];
        const esc = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 }[n];
        if (esc !== undefined) { bytes.push(esc); j++; continue; }
        const oct = /^[0-7]{1,3}/.exec(s.slice(j + 1, j + 4));
        if (oct) { bytes.push(parseInt(oct[0], 8) & 255); j += oct[0].length; continue; }
        if (n === '\r' || n === '\n') { j++; if (n === '\r' && s[j + 1] === '\n') j++; continue; }
        continue;
      }
      if (c === '(') { depth++; if (depth === 1) continue; }
      if (c === ')') { depth--; if (depth === 0) return { bytes: new Uint8Array(bytes), end: j + 1 }; }
      bytes.push(c.charCodeAt(0) & 255);
    }
    return { bytes: new Uint8Array(bytes), end: s.length };
  }
  // The same, with its text in a simple font.
  function literal(s, i) {
    const r = literalBytes(s, i);
    return { text: dec().ansi.decode(r.bytes), end: r.end };
  }

  // The lines of text of one content stream (a string of bytes as latin1 characters).
  MAK.pdfStreamLines = function (s) {
    const lines = [];
    let parts = [];
    let gapOk = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '(') {
        const r = literal(s, i);
        parts.push(r.text);
        gapOk = true;
        i = r.end - 1;
      } else if (c === '[') {
        parts = [];
        gapOk = false;
      } else if (c === '-' || c === '.' || (c >= '0' && c <= '9')) {
        const m = /^-?\d*\.?\d+/.exec(s.slice(i, i + 20));
        if (m) {
          if (gapOk && Number(m[0]) < GAP) parts.push(' ');
          i += m[0].length - 1;
        }
      } else if (c === 'T' && (s[i + 1] === 'J' || s[i + 1] === 'j') && !/[A-Za-z]/.test(s[i + 2] || ' ')) {
        const line = parts.join('').replace(/\s+/g, ' ').trim();
        if (line) lines.push(line);
        parts = [];
        gapOk = false;
        i++;
      } else if (c === '%') {
        while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i++;
      }
    }
    return lines;
  };

  // All the lines of text of a PDF file (an ArrayBuffer or a Uint8Array), in the order of the file.
  MAK.pdfTextLines = async function (data, unzip = inflate) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const s = dec().latin.decode(bytes);
    if (!s.startsWith('%PDF-')) return [];
    const lines = [];
    let chars = 0;
    let streams = 0;
    let inflated = 0;
    const re = /stream\r?\n/g;
    let m;
    while ((m = re.exec(s)) && streams < MAX_STREAMS && chars < MAX_CHARS && inflated < MAX_INFLATE_ALL) {
      const start = m.index + m[0].length;
      const end = s.indexOf('endstream', start);
      if (end < 0) break;
      re.lastIndex = end + 9;
      // The dictionary of the stream: only compressed streams that are not images or fonts.
      const dict = s.slice(Math.max(0, s.lastIndexOf('obj', m.index)), m.index);
      if (!/\/FlateDecode/.test(dict) || /\/Subtype\s*\/Image|\/Length[23]\b|\/Type\s*\/(XRef|ObjStm|Metadata)/.test(dict)) continue;
      streams++;
      // The length of the dictionary, if it is a number; else up to "endstream" without the end of line.
      const len = /\/Length\s+(\d+)(?!\d)(?!\s+\d+\s+R)/.exec(dict);
      let stop = len ? start + Number(len[1]) : end;
      if (stop > end) stop = end;
      if (!len) while (stop > start && (s[stop - 1] === '\n' || s[stop - 1] === '\r')) stop--;
      let raw;
      try {
        raw = await unzip(bytes.subarray(start, stop));
      } catch {
        continue;
      }
      inflated += raw.length;
      const text = dec().latin.decode(raw);
      if (!/T[Jj]/.test(text)) continue;
      for (const line of MAK.pdfStreamLines(text)) {
        lines.push(line);
        chars += line.length;
      }
    }
    return lines;
  };

  // ---- The text with its color and its place (the calendars of the library: PDF files of Canva) ------------------
  // A small reader of the objects of the file (not the object streams of PDF 1.5), the content of each page and of its
  // forms (XObject), the fonts with a map ToUnicode (also Identity-H: 2 bytes for each character) and the fill color.

  const MAX_OBJECTS = 20000;
  const MAX_OPS = 2000000; // the values and operators of all the pages (a flood of numbers is work too)
  const MAX_DEPTH = 8; // forms in forms
  const MAX_CODES = 70000; // the codes of the map of a font
  const MAX_ARGS = 64; // the operands of an operator
  const MAX_SHAPES = 5000; // the drawn shapes of all the pages

  // A value of PDF at s[i]: a number, a name ("/Name"), a string (Uint8Array), an array, a dictionary (no prototype),
  // a reference ({ ref }), true, false, null or an operator ({ op }). Its position after it.
  function value(s, i) {
    for (;;) {
      while (i < s.length && /[\s\0]/.test(s[i])) i++;
      if (s[i] !== '%') break;
      while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i++;
    }
    const c = s[i];
    if (c === undefined) return { end: i };
    if (c === '/') {
      const m = /^\/[^\s\0/[\]()<>{}%]*/.exec(s.slice(i, i + 128));
      return { v: m[0].replace(/#([0-9A-Fa-f]{2})/g, (_, x) => String.fromCharCode(parseInt(x, 16))), end: i + m[0].length };
    }
    if (c === '(') {
      const r = literalBytes(s, i);
      return { v: r.bytes, end: r.end };
    }
    if (c === '<' && s[i + 1] === '<') {
      const d = Object.create(null);
      let j = i + 2;
      for (;;) {
        const k = value(s, j);
        if (k.v === undefined || (k.v && k.v.op === '>>')) return { v: d, end: k.end };
        const v = value(s, k.end);
        if (typeof k.v === 'string' && k.v[0] === '/') d[k.v.slice(1)] = v.v;
        j = v.end;
      }
    }
    if (c === '<') {
      const end = s.indexOf('>', i);
      const hex = s.slice(i + 1, end < 0 ? s.length : end).replace(/[^0-9A-Fa-f]/g, '');
      const bytes = new Uint8Array(Math.ceil(hex.length / 2));
      for (let k = 0; k < bytes.length; k++) bytes[k] = parseInt((hex.slice(k * 2, k * 2 + 2) + '0').slice(0, 2), 16);
      return { v: bytes, end: end < 0 ? s.length : end + 1 };
    }
    if (c === '[') {
      const list = [];
      let j = i + 1;
      for (;;) {
        const r = value(s, j);
        if (r.v === undefined || (r.v && r.v.op === ']')) return { v: list, end: r.end };
        list.push(r.v);
        j = r.end;
      }
    }
    if (c === ']' || c === '{' || c === '}') return { v: { op: c }, end: i + 1 };
    if (c === '>' && s[i + 1] === '>') return { v: { op: '>>' }, end: i + 2 };
    const n = /^[+-]?(?:\d+\.?\d*|\.\d+)/.exec(s.slice(i, i + 32));
    if (n) {
      const r = /^\s+(\d+)\s+R(?![A-Za-z])/.exec(s.slice(i + n[0].length, i + n[0].length + 24));
      if (r && /^\d+$/.test(n[0])) return { v: { ref: Number(n[0]) }, end: i + n[0].length + r[0].length };
      return { v: Number(n[0]), end: i + n[0].length };
    }
    const w = /^[^\s\0/[\]()<>{}%]+/.exec(s.slice(i, i + 32));
    if (!w) return { v: { op: c }, end: i + 1 };
    const word = w[0];
    return { v: word === 'true' ? true : word === 'false' ? false : word === 'null' ? null : { op: word }, end: i + word.length };
  }

  // The objects of the file: number -> { dict, start, stop } (start/stop: the bytes of the stream, if it has one).
  function objects(s) {
    const map = new Map();
    const re = /(\d+)\s+\d+\s+obj\b/g;
    let m;
    while ((m = re.exec(s)) && map.size < MAX_OBJECTS) {
      const r = value(s, m.index + m[0].length);
      const o = { dict: r.v, start: -1, stop: -1 };
      const after = /^\s*stream\r?\n/.exec(s.slice(r.end, r.end + 20));
      if (after && r.v && typeof r.v === 'object') {
        o.start = r.end + after[0].length;
        const end = s.indexOf('endstream', o.start);
        o.stop = typeof r.v.Length === 'number' && o.start + r.v.Length <= (end < 0 ? s.length : end) ? o.start + r.v.Length : end < 0 ? s.length : end;
        if (typeof r.v.Length !== 'number') while (o.stop > o.start && (s[o.stop - 1] === '\n' || s[o.stop - 1] === '\r')) o.stop--;
        re.lastIndex = end < 0 ? s.length : end + 9; // never an "obj" inside the data of a stream
      } else re.lastIndex = r.end;
      map.set(Number(m[1]), o);
    }
    return map;
  }

  // The fill color of an operator of color, as [r, g, b] (0..1); null: not a color of the device (a pattern).
  function color(args) {
    const n = args.filter((a) => typeof a === 'number').map((a) => Math.min(1, Math.max(0, a)));
    if (n.length !== args.length) return null;
    if (n.length === 1) return [n[0], n[0], n[0]];
    if (n.length === 3) return n;
    if (n.length === 4) return [0, 1, 2].map((k) => (1 - n[k]) * (1 - n[3]));
    return null;
  }

  // The path operators (the number of their operands) and the ones that paint the path (W and W*, a clip, do not).
  const PATH = { m: 2, l: 2, c: 6, v: 4, y: 4, re: 4 };
  const PAINT = { S: 'stroke', s: 'stroke', f: 'fill', F: 'fill', 'f*': 'fill', B: 'both', 'B*': 'both', b: 'both', 'b*': 'both', n: 'none' };

  // a × b of two matrices [a b c d e f].
  const times = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
  const ONE = [1, 0, 0, 1, 0, 0];

  // The map of a ToUnicode stream: code -> text.
  function toUnicode(text) {
    const map = new Map();
    let budget = MAX_CODES; // the codes of all the ranges, also repeated ones
    const hex = (h) => parseInt(h, 16);
    const utf16 = (h) => {
      const units = [];
      for (let k = 0; k + 4 <= h.length; k += 4) units.push(hex(h.slice(k, k + 4)));
      return String.fromCharCode(...units);
    };
    for (const block of text.match(/beginbfchar[\s\S]*?endbfchar/g) || []) {
      for (const m of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g)) map.set(hex(m[1]), utf16(m[2]));
    }
    for (const block of text.match(/beginbfrange[\s\S]*?endbfrange/g) || []) {
      for (const m of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([^\]]*)\])/g)) {
        const [from, to] = [hex(m[1]), Math.min(hex(m[2]), hex(m[1]) + 0xffff)];
        const list = m[4] ? [...m[4].matchAll(/<([0-9A-Fa-f]*)>/g)].map((x) => utf16(x[1])) : null;
        for (let code = from; code <= to && budget-- > 0; code++) {
          if (list) map.set(code, list[code - from] || '');
          else {
            const base = utf16(m[3]);
            map.set(code, base.slice(0, -1) + String.fromCharCode(base.charCodeAt(base.length - 1) + code - from));
          }
        }
      }
    }
    return map;
  }

  // The text of each page of a PDF file (an ArrayBuffer or a Uint8Array): [{ page, x, y, size, rgb, text }], one run for
  // each text block (BT ... ET; a new line in it: a space). x, y: the start, in the space of the page (y grows to the top);
  // size: the height of the letters; rgb: the fill color. The pages in their order.
  MAK.pdfTextRuns = async (data, unzip = inflate) => (await MAK.pdfContent(data, unzip)).runs;

  // The text (MAK.pdfTextRuns) and the drawn shapes of a PDF file: { runs, shapes: [{ page, x0, y0, x1, y1 (the box, in
  // the space of the runs), fill (its color, or null: not filled), stroke (the color of its line, or null), image (an
  // image: the number of its object) }] }.
  MAK.pdfContent = async function (data, unzip = inflate) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const s = dec().latin.decode(bytes);
    if (!s.startsWith('%PDF-')) return { runs: [], shapes: [] };
    const objs = objects(s);
    const get = (v) => (v && typeof v === 'object' && 'ref' in v ? (objs.get(v.ref) || {}).dict : v);
    let inflated = 0;
    const decoded = new Map();
    async function streamText(ref) {
      if (decoded.has(ref)) return decoded.get(ref);
      const o = objs.get(ref);
      let text = '';
      if (o && o.start >= 0 && inflated < MAX_INFLATE_ALL) {
        const filter = get(o.dict.Filter);
        const filters = Array.isArray(filter) ? filter.map(get) : filter ? [filter] : [];
        const raw = bytes.subarray(o.start, o.stop);
        try {
          if (!filters.length) text = dec().latin.decode(raw);
          else if (filters.length === 1 && filters[0] === '/FlateDecode') {
            const out = await unzip(raw);
            inflated += out.length;
            text = dec().latin.decode(out);
          }
        } catch {}
      }
      decoded.set(ref, text);
      return text;
    }
    // The fonts: ref -> { two (2 bytes for each character), map (ToUnicode) }.
    const fonts = new Map();
    async function font(v) {
      const ref = v && v.ref;
      if (ref !== undefined && fonts.has(ref)) return fonts.get(ref);
      const d = get(v) || {};
      const f = { two: d.Subtype === '/Type0', map: d.ToUnicode && d.ToUnicode.ref !== undefined ? toUnicode(await streamText(d.ToUnicode.ref)) : null };
      if (ref !== undefined) fonts.set(ref, f);
      return f;
    }
    const textOf = (f, b) => {
      if (!f) return '';
      if (!f.two) return f.map ? Array.from(b, (x) => f.map.get(x) ?? String.fromCharCode(x)).join('') : dec().ansi.decode(b);
      if (!f.map) return '';
      let out = '';
      for (let k = 0; k + 1 < b.length; k += 2) out += f.map.get(b[k] * 256 + b[k + 1]) ?? '';
      return out;
    };

    // The pages in their order: the tree of /Pages from the catalog; else the objects /Page. Each node once (a broken
    // tree that names itself in its /Kids would never end).
    const pages = [];
    const walked = new Set();
    const walk = (node, inherited, depth) => {
      const d = get(node);
      if (!d || walked.has(d) || depth > 20 || pages.length > 500) return;
      walked.add(d);
      const res = d.Resources || inherited;
      if (d.Type === '/Page') pages.push({ d, res });
      else if (Array.isArray(get(d.Kids))) for (const kid of get(d.Kids)) walk(kid, res, depth + 1);
    };
    const catalog = [...objs.values()].find((o) => o.dict && o.dict.Type === '/Catalog');
    if (catalog) walk(catalog.dict.Pages, null, 0);
    if (!pages.length) for (const o of objs.values()) if (o.dict && o.dict.Type === '/Page') pages.push({ d: o.dict, res: o.dict.Resources });

    const runs = [];
    const shapes = [];
    let ops = 0;
    async function run(text, res, gs0, page, depth, seen) {
      const resources = get(res) || {};
      const fontDict = get(resources.Font) || {};
      const xobjects = get(resources.XObject) || {};
      let gs = { ctm: gs0.ctm, rgb: gs0.rgb, stroke: gs0.stroke };
      let path = []; // the points of the path, in the space of the page
      const stack = [];
      let args = [];
      let f = null;
      let size = 0;
      let leading = 0;
      let tm = ONE;
      let tlm = ONE;
      let block = null; // the run of the text block
      const move = (tx, ty) => { tlm = times([1, 0, 0, 1, tx, ty], tlm); tm = tlm; };
      const show = (str) => {
        const b = str instanceof Uint8Array ? str : null;
        const t = b ? textOf(f, b) : '';
        const m = times(tm, gs.ctm);
        const at = { x: m[4], y: m[5], size: Math.abs(size * Math.hypot(m[2], m[3])) };
        if (!block) block = { page, x: at.x, y: at.y, size: at.size, rgb: gs.rgb, text: '', ly: at.y };
        else if (Math.abs(at.y - block.ly) > at.size * 0.5) { block.text += ' '; block.ly = at.y; }
        block.text += t;
      };
      const end = () => {
        if (block && block.text.trim()) runs.push({ page: block.page, x: block.x, y: block.y, size: block.size, rgb: block.rgb, text: block.text.replace(/\s+/g, ' ').trim() });
        block = null;
      };
      for (let i = 0; i < text.length && ops < MAX_OPS;) {
        const r = value(text, i);
        if (r.end <= i) break;
        i = r.end;
        if (r.v === undefined) break;
        ops++;
        if (!(r.v && typeof r.v === 'object' && 'op' in r.v)) {
          if (args.push(r.v) > MAX_ARGS) args.shift();
          continue;
        }
        const op = r.v.op;
        const num = (k) => (typeof args[k] === 'number' ? args[k] : 0);
        if (op === 'BI') { // an inline image: up to "EI"
          const e = text.slice(i).search(/\sEI(?![^\s\0/[\]()<>{}%])/);
          i = e < 0 ? text.length : i + e + 3;
        } else if (op === 'q') stack.push(gs);
        else if (op === 'Q') gs = stack.pop() || gs;
        else if (op === 'cm' && args.length >= 6) gs = Object.assign({}, gs, { ctm: times(args.slice(-6).map((a) => (typeof a === 'number' ? a : 0)), gs.ctm) });
        else if (op === 'rg' || op === 'g' || op === 'k' || op === 'sc' || op === 'scn') {
          const c = color(args);
          if (c) gs = Object.assign({}, gs, { rgb: c });
        } else if (op === 'RG' || op === 'G' || op === 'K' || op === 'SC' || op === 'SCN') {
          const c = color(args);
          if (c) gs = Object.assign({}, gs, { stroke: c });
        } else if (PATH[op] && args.length >= PATH[op] && path.length < 2000) {
          const n = args.slice(-PATH[op]).map((a) => (typeof a === 'number' ? a : 0));
          const at = (x, y) => { const m = times([1, 0, 0, 1, x, y], gs.ctm); path.push([m[4], m[5]]); };
          if (op === 're') for (const [x, y] of [[0, 0], [n[2], 0], [0, n[3]], [n[2], n[3]]]) at(n[0] + x, n[1] + y);
          else for (let k = 0; k + 1 < n.length; k += 2) at(n[k], n[k + 1]);
        } else if (PAINT[op]) {
          if (PAINT[op] !== 'none' && path.length && shapes.length < MAX_SHAPES) {
            const xs = path.map((p) => p[0]);
            const ys = path.map((p) => p[1]);
            shapes.push({ page, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys),
              fill: PAINT[op] !== 'stroke' ? gs.rgb : null, stroke: PAINT[op] !== 'fill' ? gs.stroke : null });
          }
          path = [];
        } else if (op === 'BT') { tm = tlm = ONE; block = null; }
        else if (op === 'ET') end();
        else if (op === 'Tf' && args.length >= 2) { f = await font(fontDict[String(args[args.length - 2]).slice(1)]); size = num(args.length - 1); }
        else if (op === 'TL') leading = num(0);
        else if (op === 'Tm' && args.length >= 6) tm = tlm = args.slice(-6).map((a) => (typeof a === 'number' ? a : 0));
        else if (op === 'Td') move(num(0), num(1));
        else if (op === 'TD') { leading = -num(1); move(num(0), num(1)); }
        else if (op === 'T*') move(0, -leading);
        else if (op === 'Tj') show(args[args.length - 1]);
        else if (op === "'") { move(0, -leading); show(args[args.length - 1]); }
        else if (op === '"') { move(0, -leading); show(args[args.length - 1]); }
        else if (op === 'TJ') {
          const list = args[args.length - 1];
          for (const part of Array.isArray(list) ? list : []) if (part instanceof Uint8Array) show(part);
        }
        else if (op === 'Do' && depth < MAX_DEPTH) {
          const ref = xobjects[String(args[0]).slice(1)];
          const x = ref && ref.ref !== undefined ? objs.get(ref.ref) : null;
          if (x && x.dict && x.dict.Subtype === '/Form' && !seen.has(ref.ref)) {
            const matrix = Array.isArray(x.dict.Matrix) && x.dict.Matrix.length === 6 ? x.dict.Matrix.map((a) => (typeof a === 'number' ? a : 0)) : ONE;
            await run(await streamText(ref.ref), x.dict.Resources || res, { ctm: times(matrix, gs.ctm), rgb: gs.rgb, stroke: gs.stroke }, page, depth + 1, new Set([...seen, ref.ref]));
          } else if (x && x.dict && x.dict.Subtype === '/Image' && shapes.length < MAX_SHAPES) {
            // An image: the box of the unit square in the space of the page; image: its object (the same drawing again).
            const c = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => [u * gs.ctm[0] + v * gs.ctm[2] + gs.ctm[4], u * gs.ctm[1] + v * gs.ctm[3] + gs.ctm[5]]);
            shapes.push({ page, x0: Math.min(...c.map((p) => p[0])), y0: Math.min(...c.map((p) => p[1])), x1: Math.max(...c.map((p) => p[0])), y1: Math.max(...c.map((p) => p[1])), fill: null, stroke: null, image: ref.ref });
          }
        }
        args = [];
      }
      end();
    }
    for (const [n, p] of pages.entries()) {
      const contents = get(p.d.Contents);
      const parts = Array.isArray(contents) ? contents : [p.d.Contents];
      let text = '';
      for (const c of parts) if (c && c.ref !== undefined) text += `${await streamText(c.ref)}\n`;
      await run(text, p.res, { ctm: ONE, rgb: [0, 0, 0], stroke: [0, 0, 0] }, n + 1, 0, new Set());
      if (ops >= MAX_OPS) break;
    }
    return { runs, shapes };
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
