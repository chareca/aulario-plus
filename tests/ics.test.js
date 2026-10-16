'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib } = require('./helpers');
const F = require('./fixtures/miaulario');
const MAK = loadLib('core', 'store', 'sync', 'i18n', 'due', 'ics');

const pages = Object.fromEntries(F.SITES.map((s) => [s.id, MAK.trimPages(F.pages(s.id), F.NOW)]));
const assignments = F.ASSIGNMENTS.map(MAK.trimAssignment);
const events = F.CALENDAR.map(MAK.trimEvent);
const unfold = (text) => text.replace(/\r\n /g, '');
const due = (hidden = new Set()) => MAK.buildDue({ assignments, sites: F.SITES, pages, hidden, now: F.NOW }).groups;

test('icsEscape: backslash, semicolon, comma and line breaks', () => {
  assert.equal(MAK.icsEscape('a,b;c\\d\ne\r\nf'), 'a\\,b\\;c\\\\d\\ne\\nf');
});

test('icsFold: 75 octets for each line, and no cut inside a UTF-8 character', () => {
  const value = `DESCRIPTION:${'ñandú € 😀 '.repeat(30)}`;
  const folded = MAK.icsFold(value);
  for (const line of folded.split('\r\n')) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `line too long: ${Buffer.byteLength(line, 'utf8')}`);
    assert.ok(!line.includes('�'), 'no broken characters');
  }
  assert.equal(unfold(folded), value);
  assert.equal(MAK.icsFold('SHORT:x'), 'SHORT:x');
});

test('icsDate is UTC', () => {
  assert.equal(MAK.icsDate(Date.UTC(2026, 9, 16, 10, 5, 9)), '20261016T100509Z');
});

test('the calendar file: header, deliveries, events, no duplicates and no alarms', () => {
  MAK.setLang('es');
  const g = due();
  const deliveries = [...g.late, ...g.pending, ...g.action];
  const { text, count } = MAK.buildIcs({ deliveries, events, now: F.NOW, t: MAK.t });
  assert.ok(text.endsWith('\r\n'));
  assert.ok(!/[^\r]\n/.test(text), 'all line breaks are CRLF');
  const flat = unfold(text);
  assert.match(flat, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\nPRODID:-\/\/MiAulario Keep-Alive\/\/Calendar export\/\/ES\r\n/);
  assert.match(flat, /END:VCALENDAR\r\n$/);
  assert.doesNotMatch(flat, /VALARM/);
  // ev-2 is the calendar copy of the delivery asg-red: only the delivery is in the file.
  assert.doesNotMatch(flat, /UID:cal-ev-2@/);
  assert.match(flat, /UID:asg-asg-red@miaulario-keepalive/);
  assert.equal(count, deliveries.length + 2);
  assert.equal((flat.match(/BEGIN:VEVENT/g) || []).length, count);
  assert.match(flat, /SUMMARY:Entrega: Lab report 3 \[Computer Science\]/);
  assert.match(flat, /SUMMARY:Tutoría\\; grupo A\\, aula 3 \[Physics\]/);
  assert.match(flat, /DESCRIPTION:Meeting\\nLínea 1\\nLínea 2/);
  assert.match(flat, /DESCRIPTION:Exam\\nRoom A1/, 'the HTML of the description is plain text');
  // The exam has a duration (DTEND); the delivery is a point in time (DTSTART only).
  assert.match(flat, new RegExp(`UID:cal-ev-1@miaulario-keepalive\\r\\nDTSTAMP:\\d{8}T\\d{6}Z\\r\\nDTSTART:${MAK.icsDate(F.NOW + 7 * F.D)}\\r\\nDTEND:${MAK.icsDate(F.NOW + 7 * F.D + 2 * F.H)}`));
  assert.match(flat, /URL:https:\/\/miaulario\.unavarra\.es\/portal\/directtool\//);
});

test('the file is the same for the same data (fixed UIDs), and English works', () => {
  MAK.setLang('en');
  const g = due();
  const a = MAK.buildIcs({ deliveries: g.pending, events, now: F.NOW, t: MAK.t }).text;
  const b = MAK.buildIcs({ deliveries: g.pending, events, now: F.NOW, t: MAK.t }).text;
  assert.equal(a, b);
  assert.match(unfold(a), /SUMMARY:Due: Lab report 3 \[Computer Science\]/);
  MAK.setLang('es');
});

test('hidden sites are not exported; an event without a start is left out', () => {
  const g = due(new Set([F.CS]));
  const evs = events.filter((e) => e.siteId !== F.CS).concat({ id: 'x', title: 'No date', start: null });
  const { text } = MAK.buildIcs({ deliveries: [...g.pending], events: evs, now: F.NOW, t: MAK.t });
  assert.doesNotMatch(text, /Computer Science/);
  assert.doesNotMatch(text, /No date/);
});

test('trimEvent reads the shape of /direct/calendar/my.json', () => {
  const e = MAK.trimEvent(F.CALENDAR[0]);
  assert.deepEqual(e, { id: 'ev-1', title: 'Exam: Mathematics I', text: 'Room A1', type: 'Exam', start: F.NOW + 7 * F.D, duration: 2 * F.H, siteId: F.MATH, siteTitle: 'Mathematics I', assignmentId: null });
});
