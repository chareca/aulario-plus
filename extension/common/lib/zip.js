// Aulario Plus: a small ZIP writer (STORE method: no compression) and the ZIP of the
// files of one site. Most course files (PDF, ZIP, images) are compressed already.
// Limits (no ZIP64): 65535 entries and 4 GB. The tools page stops at 2 GB (memory).
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  // ---- CRC-32 ----------------------------------------------------------------

  let table = null;
  MAK.crc32 = function (bytes) {
    if (!table) {
      table = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };

  // ---- ZIP writer ------------------------------------------------------------

  function dosDateTime(ms) {
    const d = new Date(ms || Date.now());
    const year = Math.min(Math.max(d.getFullYear(), 1980), 2107);
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
  }

  MAK.ZIP_MAX_ENTRIES = 65535;
  MAK.ZIP_MAX_BYTES = 0xffffffff;

  MAK.createZip = function (opts) {
    const o = opts || {};
    const maxEntries = o.maxEntries || MAK.ZIP_MAX_ENTRIES;
    const maxBytes = o.maxBytes || MAK.ZIP_MAX_BYTES;
    const encoder = new TextEncoder();
    const parts = [];
    const central = []; // two parts for each entry: the header and the name
    let entries = 0;
    let centralSize = 0;
    let offset = 0;

    function add(name, data, ms, isDir) {
      const nameBytes = encoder.encode(name);
      const size = isDir ? 0 : data.length;
      if (entries + 1 > maxEntries) throw new Error('zip-too-many-entries');
      // The end of the archive also contains a central header (46 bytes + name) for each entry.
      if (offset + 30 + nameBytes.length + size + centralSize + 46 + nameBytes.length + 22 > maxBytes) throw new Error('zip-too-big');
      const crc = isDir ? 0 : MAK.crc32(data);
      const { time, date } = dosDateTime(ms);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true); // version needed
      local.setUint16(6, 0x0800, true); // flag: UTF-8 names
      local.setUint16(8, 0, true); // method: STORE
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, size, true);
      local.setUint32(22, size, true);
      local.setUint16(26, nameBytes.length, true);
      local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), nameBytes);
      if (size) parts.push(data);

      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true); // version made by
      cd.setUint16(6, 20, true); // version needed
      cd.setUint16(8, 0x0800, true);
      cd.setUint16(10, 0, true);
      cd.setUint16(12, time, true);
      cd.setUint16(14, date, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, size, true);
      cd.setUint32(24, size, true);
      cd.setUint16(28, nameBytes.length, true);
      cd.setUint16(30, 0, true); // extra
      cd.setUint16(32, 0, true); // comment
      cd.setUint16(34, 0, true); // disk
      cd.setUint16(36, 0, true); // internal attributes
      cd.setUint32(38, isDir ? 0x10 : 0, true); // external attributes (MS-DOS directory)
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), nameBytes);
      centralSize += 46 + nameBytes.length;
      entries++;
      offset += 30 + nameBytes.length + size;
    }

    return {
      addFile: (name, data, ms) => add(name, data, ms, false),
      addDir: (name, ms) => add(name.endsWith('/') ? name : `${name}/`, null, ms, true),
      get count() {
        return entries;
      },
      // The parts of the archive, for new Blob(parts) or for a file in Node.
      finish() {
        const cdStart = offset;
        const cdSize = centralSize;
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true);
        end.setUint16(4, 0, true);
        end.setUint16(6, 0, true);
        end.setUint16(8, entries, true);
        end.setUint16(10, entries, true);
        end.setUint32(12, cdSize, true);
        end.setUint32(16, cdStart, true);
        end.setUint16(20, 0, true);
        return parts.concat(central, [new Uint8Array(end.buffer)]);
      }
    };
  };

  // ---- Safe names and paths ----------------------------------------------------

  const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

  // A name that is safe on Windows, macOS and Linux.
  MAK.safeFileName = function (name) {
    let s = String(name || '').normalize('NFC').replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_').trim().replace(/[. ]+$/, '');
    if (!s || /^\.+$/.test(s)) s = '_';
    if (RESERVED.test(s)) s = `_${s}`;
    if (s.length > 150) {
      const ext = /\.[^.]{1,10}$/.exec(s);
      s = s.slice(0, 150 - (ext ? ext[0].length : 0)).replace(/[. ]+$/, '') + (ext ? ext[0] : '');
    }
    return s;
  };

  // Folders and file names of the archive, without two names that differ only in the case.
  MAK.createNamer = function () {
    const used = new Map(); // folder path (lower case) -> Set of names (lower case)
    return function unique(folder, name) {
      const key = folder.toLowerCase();
      if (!used.has(key)) used.set(key, new Set());
      const set = used.get(key);
      const m = /^(.*?)(\.[^.]{1,10})?$/.exec(name);
      let candidate = name;
      for (let i = 2; set.has(candidate.toLowerCase()); i++) candidate = `${m[1]} (${i})${m[2] || ''}`;
      set.add(candidate.toLowerCase());
      return candidate;
    };
  };

  // The path parts of a resource below the site folder, decoded and safe.
  MAK.resourceSegments = function (url, siteId) {
    let path;
    try {
      path = new URL(url).pathname;
    } catch {
      return null;
    }
    for (const prefix of [`/access/content/group/${encodeURIComponent(siteId)}/`, `/access/content/group/${siteId}/`]) {
      if (path.startsWith(prefix)) {
        return path
          .slice(prefix.length)
          .split('/')
          .filter(Boolean)
          .map((seg) => {
            let s = seg;
            try { s = decodeURIComponent(seg); } catch {}
            return MAK.safeFileName(s);
          });
      }
    }
    return null;
  };

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // A small HTML file that opens a link (works on all systems).
  MAK.linkFile = function (title, url) {
    const safe = MAK.safeHttpUrl(url);
    if (!safe) return null;
    const u = escapeHtml(safe);
    return `<!doctype html>\n<meta charset="utf-8">\n<meta http-equiv="refresh" content="0; url=${u}">\n<title>${escapeHtml(title)}</title>\n<p><a href="${u}">${u}</a></p>\n`;
  };

  MAK.ZIP_WARN_BYTES = 500 * 1024 * 1024;
  MAK.ZIP_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;

  // Make the ZIP of the files of one site.
  // items: trimmed resources (MAK.trimResource). fetchFile(url, signal) -> { ok, status, url, type, data (Uint8Array) }.
  // t: the translate function. Returns { parts, files, errors }.
  MAK.buildSiteZip = async function ({ items, siteId, siteTitle, fetchFile, onProgress, signal, t, now }) {
    const zip = MAK.createZip();
    const unique = MAK.createNamer();
    const rootName = MAK.safeFileName(siteTitle || siteId);
    const errors = [];
    let files = 0;

    const folders = items.filter((x) => x.folder).sort((a, b) => a.url.length - b.url.length);
    const downloads = items.filter((x) => !x.folder);
    zip.addDir(rootName, now);
    // The address of a folder (its path, with "/" at the end) -> its unique path in the archive. By the
    // address: two folders whose names become the same ("a: b", "a? b") stay apart.
    const dirNames = new Map();
    const folderOf = (segments) => [rootName].concat(segments.slice(0, -1)).join('/');
    const addressOf = (url) => { try { return new URL(url).pathname; } catch { return ''; } };
    const parentOf = (url) => dirNames.get(addressOf(url).replace(/[^/]+\/?$/, ''));

    for (const f of folders) {
      const seg = MAK.resourceSegments(f.url, siteId);
      if (!seg || !seg.length) continue;
      // In the folder of its parent, also when that one has a new name ("practicas (2)").
      const parent = parentOf(f.url) || folderOf(seg);
      const name = unique(parent, seg[seg.length - 1]);
      const path = `${parent}/${name}`;
      dirNames.set(addressOf(f.url), path);
      zip.addDir(path, f.modified);
    }

    let i = 0;
    for (const item of downloads) {
      i++;
      if (signal && signal.aborted) throw new Error('aborted');
      const seg = MAK.resourceSegments(item.url, siteId);
      if (!seg || !seg.length) continue;
      const parent = seg.length > 1 ? parentOf(item.url) || folderOf(seg) : rootName;
      const baseName = item.link ? MAK.safeFileName(`${item.title || seg[seg.length - 1]}.html`) : seg[seg.length - 1];
      const name = unique(parent, baseName);
      const path = `${parent}/${name}`;
      if (onProgress) onProgress({ index: i, total: downloads.length, name });

      if (item.link) {
        const html = MAK.linkFile(item.title || name, item.link);
        if (html) {
          zip.addFile(path, new TextEncoder().encode(html), item.modified);
          files++;
        }
        continue;
      }
      let reason = null;
      try {
        const r = await fetchFile(item.url, signal);
        const finalPath = r.url ? new URL(r.url).pathname : '/access/content/';
        if (!r.ok) reason = t('zip.err.http', { status: r.status });
        else if (!finalPath.startsWith('/access/content/')) reason = t('zip.err.redirect');
        else if (/text\/html/i.test(r.type || '') && !/html/i.test(item.type)) reason = t(item.copyright ? 'zip.err.copyright' : 'zip.err.html');
        else {
          zip.addFile(path, r.data, item.modified);
          files++;
        }
      } catch (e) {
        if (signal && signal.aborted) throw new Error('aborted');
        reason = t('zip.err.network');
      }
      if (reason) errors.push(`${path.slice(rootName.length + 1)}: ${reason}`);
    }

    // Its own name too: the site can have a file "_errores.txt" (then "_errores (2).txt").
    if (errors.length) zip.addFile(`${rootName}/${unique(rootName, t('zip.errorsFile'))}`, new TextEncoder().encode(`${errors.join('\r\n')}\r\n`), now);
    return { parts: zip.finish(), files, errors };
  };

  // "17,7 MB"
  MAK.formatSize = function (bytes, locale) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let n = bytes;
    let u = 0;
    while (n >= 1024 && u < units.length - 1) { n /= 1024; u++; }
    return `${new Intl.NumberFormat(locale || 'es-ES', { maximumFractionDigits: u ? 1 : 0 }).format(n)} ${units[u]}`;
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
