// Aulario Plus: the teachers of a site, for "Write to a teacher" (the button ✉ next to the pencil of
// the site). The list comes from the list "Para" of the internal mail (the persons that the user can
// write to). The roles come from /direct/site/{site}/memberships.json: "Instructor" (the teachers)
// and "Teaching Assistant" (other teaching staff). Some sites do not give the roles (error 403):
// then the persons whose user name has no digits are probably teachers (the user names of the
// students have digits, live test: 2786 of 2799).
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  // The members of a site: [{ eid, role }], or null if MiAulario does not give them.
  MAK.parseMemberships = function (json) {
    const list = json && Array.isArray(json.membership_collection) ? json.membership_collection : null;
    if (!list) return null;
    return list.map((m) => ({ eid: String((m && m.userEid) || ''), role: String((m && m.memberRole) || '') })).filter((m) => m.eid);
  };

  const eidOf = (label) => {
    const m = /\(([^()]+)\)\s*$/.exec(label || '');
    return m ? m[1] : null;
  };
  const nameOf = (label) => String(label || '').replace(/\s*\([^()]+\)\s*$/, '').replace(/\s+,/, ',').trim();

  // A name in capital letters becomes "Miguel Ángel de la Fuente"; a name in mixed letters stays.
  const SMALL = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'i', 'da', 'van', 'von']);
  MAK.properName = function (s) {
    const text = String(s || '').replace(/\s+/g, ' ').trim();
    if (text !== text.toLocaleUpperCase('es')) return text;
    return text
      .toLocaleLowerCase('es')
      .split(' ')
      .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.replace(/(^|[-'’])(\p{L})/gu, (m, sep, c) => sep + c.toLocaleUpperCase('es'))))
      .join(' ');
  };

  // The parts of a label "SURNAME, Name (eid)": { first, last, eid }.
  MAK.personParts = function (label) {
    const name = nameOf(label);
    const at = name.indexOf(',');
    const first = at < 0 ? name : name.slice(at + 1);
    const last = at < 0 ? '' : name.slice(0, at);
    return { first: MAK.properName(first), last: MAK.properName(last), eid: eidOf(label) };
  };

  // The fields of the template of a message to a teacher (Settings), with their names in Spanish
  // and in English. The names of both languages work in a template.
  const FIELDS = {
    teacher: ['profesor', 'teacher'],
    teacherFull: ['profesor_completo', 'teacher_full'],
    me: ['nombre', 'name'],
    meFull: ['nombre_completo', 'full_name'],
    course: ['asignatura', 'course']
  };
  const FIELD_OF = new Map(Object.entries(FIELDS).flatMap(([key, names]) => names.map((n) => [n, key])));
  MAK.TEMPLATE_FIELDS = Object.keys(FIELDS);
  // The name of a field in the language of the extension, for example "{profesor}".
  MAK.templateField = (key) => `{${FIELDS[key][MAK.getLang() === 'en' ? 1 : 0]}}`;
  // The template of the language: "Hola {profesor}," two empty lines, "Saludos," and "{nombre}.".
  MAK.defaultTeacherTemplate = () => MAK.t('teach.template', { teacher: MAK.templateField('teacher'), name: MAK.templateField('me') });

  // Put the values in the fields of a template: the lines of the result. A line with an empty field
  // and no other letters goes away (for example "{nombre}." when MiAulario does not give the name).
  function fillTemplate(text, values) {
    return String(text || '').split('\n').flatMap((line) => {
      let empty = false;
      const out = line.replace(/\{(\w+)\}/g, (m, name) => {
        const key = FIELD_OF.get(name.toLowerCase());
        if (!key) return m;
        if (!values[key]) empty = true;
        return values[key] || '';
      });
      return empty && !/[\p{L}\p{N}]/u.test(out) ? [] : [out];
    });
  }

  // Lines of text to the HTML of the editor of MiAulario. The lines of a paragraph go with <br>. An
  // empty line ends the paragraph; each other empty line is an empty paragraph (space to write).
  function editorHtml(lines) {
    const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const out = [];
    let para = [];
    let blanks = 0;
    for (const line of lines) {
      if (!line.trim()) {
        blanks++;
        continue;
      }
      if (para.length && blanks) {
        out.push(`<p>${para.join('<br>')}</p>`, ...Array(blanks - 1).fill('<p>&nbsp;</p>'));
        para = [];
      }
      blanks = 0;
      para.push(esc(line.trim()));
    }
    if (para.length) out.push(`<p>${para.join('<br>')}</p>`);
    return out.join('');
  }

  // A new message to a teacher: { subject, body (HTML of the editor of MiAulario) }. The texts come
  // from the template of the user (settings.teacherSubject, settings.teacherBody); an empty body is
  // the text of the language: "Hola <first name>," an empty line, "Saludos," and the first name of
  // the user. course: the name of the site.
  MAK.teacherMail = function ({ teacher, me, course, settings }) {
    const s = settings || {};
    const t = MAK.personParts(teacher);
    const m = me ? MAK.personParts(me) : null;
    const full = (p) => [p.first, p.last].filter(Boolean).join(' ');
    const values = {
      teacher: t.first || t.last,
      teacherFull: full(t),
      me: m ? m.first || m.last : '',
      meFull: m ? full(m) : '',
      course: course || ''
    };
    return {
      subject: fillTemplate(s.teacherSubject, values).join(' ').replace(/\s+/g, ' ').trim().slice(0, 200),
      body: editorHtml(fillTemplate(s.teacherBody || MAK.defaultTeacherTemplate(), values))
    };
  };

  // The groups of teachers. recipients: MAK.pmRecipients(compose, myEid); members: parseMemberships()
  // or null. Result: [{ key: 'instructor' | 'assistant' | 'probable', people: [{ value, label, name, eid }] }].
  MAK.teacherGroups = function (recipients, members) {
    const persons = (recipients || []).filter((r) => r.kind === 'person' && !r.me);
    const person = (r) => ({ value: r.value, label: r.label, name: nameOf(r.label), eid: eidOf(r.label) });
    const byName = (a, b) => a.name.localeCompare(b.name, 'es');
    if (members) {
      const role = new Map(members.map((m) => [m.eid.toLowerCase(), m.role]));
      const pick = (re) => persons.filter((r) => re.test(role.get(String(eidOf(r.label)).toLowerCase()) || '')).map(person).sort(byName);
      return [
        { key: 'instructor', people: pick(/^instructor$/i) },
        { key: 'assistant', people: pick(/^teaching assistant$/i) }
      ].filter((g) => g.people.length);
    }
    const probable = persons.filter((r) => {
      const eid = eidOf(r.label);
      return eid && !/\d/.test(eid);
    });
    return probable.length ? [{ key: 'probable', people: probable.map(person).sort(byName) }] : [];
  };

  // Load the compose form (for the values of the list "Para") and the members of the site.
  // pm: MAK.createPm(...); doFetch: fetch of the page. Result: { compose, groups, me (the user in the list) }.
  MAK.loadTeachers = async function ({ siteId, placement, pm, myEid, doFetch }) {
    const membersOf = async () => {
      try {
        const r = await doFetch(`/direct/site/${encodeURIComponent(siteId)}/memberships.json?auto=true`, { credentials: 'include' });
        return r.ok ? MAK.parseMemberships(await r.json()) : null;
      } catch {
        return null;
      }
    };
    const [compose, members] = await Promise.all([pm.open(placement), membersOf()]);
    const recipients = MAK.pmRecipients(compose, myEid);
    return { compose, groups: MAK.teacherGroups(recipients, members), me: recipients.find((r) => r.me) || null };
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
