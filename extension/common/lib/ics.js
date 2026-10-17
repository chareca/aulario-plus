// Aulario Plus: export deliveries and calendar events as an iCalendar file (RFC 5545).
// All times are UTC. Each event has a fixed UID, so most calendar apps update an event when
// the user imports the file again. There are no alarms (VALARM).
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  const encoder = new TextEncoder();

  // Escape a TEXT value: backslash, semicolon, comma and line breaks.
  MAK.icsEscape = function (text) {
    return String(text || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n|\r|\n/g, '\\n');
  };

  // Fold a content line: a maximum of 75 octets for each line, without a cut inside a UTF-8 character.
  // The next lines start with one space (that space is part of the 75 octets).
  MAK.icsFold = function (line) {
    const out = [];
    let current = '';
    let size = 0;
    for (const ch of line) {
      const n = encoder.encode(ch).length;
      if (size + n > 75) {
        out.push(current);
        current = ` ${ch}`;
        size = 1 + n;
      } else {
        current += ch;
        size += n;
      }
    }
    out.push(current);
    return out.join('\r\n');
  };

  // "20261016T100000Z"
  MAK.icsDate = function (ms) {
    return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  };

  const uidPart = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '-');

  // deliveries: items of MAK.buildDue (with siteTitle and url). events: trimmed calendar events.
  MAK.buildIcs = function ({ deliveries, events, now, t }) {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Aulario Plus//Calendar export//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:MiAulario'
    ];
    const stamp = MAK.icsDate(now);
    let count = 0;
    const exported = new Set();

    const event = (fields) => {
      lines.push('BEGIN:VEVENT');
      for (const [k, v] of fields) if (v !== null && v !== undefined && v !== '') lines.push(`${k}:${v}`);
      lines.push('END:VEVENT');
      count++;
    };

    for (const d of deliveries || []) {
      if (!d.due) continue;
      exported.add(d.id);
      const url = MAK.safeHttpUrl(d.url);
      event([
        ['UID', `asg-${uidPart(d.id)}@aulario-plus`],
        ['DTSTAMP', stamp],
        ['DTSTART', MAK.icsDate(d.due)],
        ['SUMMARY', MAK.icsEscape(t('ics.deliverySummary', { title: d.title, site: d.siteTitle }))],
        ['DESCRIPTION', MAK.icsEscape([t('ics.descSite', { site: d.siteTitle }), url].filter(Boolean).join('\n'))],
        ['URL', url],
        ['CATEGORIES', 'MiAulario']
      ]);
    }

    for (const e of events || []) {
      if (!e.start) continue;
      if (e.assignmentId && exported.has(e.assignmentId)) continue; // the same as a delivery
      event([
        ['UID', `cal-${uidPart(e.id)}@aulario-plus`],
        ['DTSTAMP', stamp],
        ['DTSTART', MAK.icsDate(e.start)],
        ['DTEND', e.duration > 0 ? MAK.icsDate(e.start + e.duration) : null],
        ['SUMMARY', MAK.icsEscape(`${e.title} [${e.siteTitle}]`)],
        ['DESCRIPTION', MAK.icsEscape([e.type, e.text].filter(Boolean).join('\n'))],
        ['CATEGORIES', 'MiAulario']
      ]);
    }

    lines.push('END:VCALENDAR');
    return { text: `${lines.map(MAK.icsFold).join('\r\n')}\r\n`, count };
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
