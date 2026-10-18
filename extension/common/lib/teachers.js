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

  // The groups of teachers. recipients: MAK.pmRecipients(compose, myEid); members: parseMemberships()
  // or null. Result: [{ key: 'instructor' | 'assistant' | 'probable', people: [{ value, label, name }] }].
  MAK.teacherGroups = function (recipients, members) {
    const persons = (recipients || []).filter((r) => r.kind === 'person' && !r.me);
    const person = (r) => ({ value: r.value, label: r.label, name: nameOf(r.label) });
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
  // pm: MAK.createPm(...); doFetch: fetch of the page. Result: { compose, groups }.
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
    return { compose, groups: MAK.teacherGroups(MAK.pmRecipients(compose, myEid), members) };
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
