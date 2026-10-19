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
  const GAP = -200; // a move in a TJ array of less than -200 thousandths of an em is a space

  async function inflate(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  // The characters of the bytes of a simple font (WinAnsi = windows-1252). Made at the first use.
  let decoders = null;
  const dec = () => (decoders = decoders || { ansi: new TextDecoder('windows-1252'), latin: new TextDecoder('latin1') });

  // The literal string that starts at s[i] ("("): its text and the position after it.
  function literal(s, i) {
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
      if (c === ')') { depth--; if (depth === 0) return { text: dec().ansi.decode(new Uint8Array(bytes)), end: j + 1 }; }
      bytes.push(c.charCodeAt(0) & 255);
    }
    return { text: dec().ansi.decode(new Uint8Array(bytes)), end: s.length };
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
    const re = /stream\r?\n/g;
    let m;
    while ((m = re.exec(s)) && streams < MAX_STREAMS && chars < MAX_CHARS) {
      const start = m.index + m[0].length;
      const end = s.indexOf('endstream', start);
      if (end < 0) break;
      re.lastIndex = end + 9;
      // The dictionary of the stream: only compressed streams that are not images or fonts.
      const dict = s.slice(Math.max(0, s.lastIndexOf('obj', m.index)), m.index);
      if (!/\/FlateDecode/.test(dict) || /\/Subtype\s*\/Image|\/Length[23]\b|\/Type\s*\/(XRef|ObjStm|Metadata)/.test(dict)) continue;
      streams++;
      // The length of the dictionary, if it is a number; else up to "endstream" without the end of line.
      const len = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
      let stop = len ? start + Number(len[1]) : end;
      if (stop > end) stop = end;
      if (!len) while (stop > start && (s[stop - 1] === '\n' || s[stop - 1] === '\r')) stop--;
      let raw;
      try {
        raw = await unzip(bytes.subarray(start, stop));
      } catch {
        continue;
      }
      const text = dec().latin.decode(raw);
      if (!/T[Jj]/.test(text)) continue;
      for (const line of MAK.pdfStreamLines(text)) {
        lines.push(line);
        chars += line.length;
      }
    }
    return lines;
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
