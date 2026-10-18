'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib } = require('./helpers');
const MAK = loadLib('core', 'pm', 'teachers');

// The list "Para" of a compose form: everybody, a role, the user, teachers and students.
const recipients = () => MAK.pmRecipients({ fields: { to: { options: [
  { value: 'v0', label: 'Todos los participantes' },
  { value: 'v1', label: 'Rol Instructor' },
  { value: 'v2', label: 'Chareca , Nicolas (chareca.165075)' },
  { value: 'v3', label: 'ZUBIRI ARANA, MIREN (miren.zubiri)' },
  { value: 'v4', label: 'ALDAZ ZARAGUETA, MIGUEL ANGEL (maldaz)' },
  { value: 'v5', label: 'GARCIA LOPEZ, ANA (garcia.161234)' },
  { value: 'v6', label: 'PEREZ, JUAN (juan.perez)' }
] } } }, 'chareca.165075');

test('parseMemberships: the user names and the roles, or null without the list', () => {
  assert.deepEqual(MAK.parseMemberships({ membership_collection: [{ userEid: 'a.b', memberRole: 'Instructor', userEmail: 'x' }, { memberRole: 'Student' }] }), [{ eid: 'a.b', role: 'Instructor' }]);
  assert.equal(MAK.parseMemberships(null), null);
  assert.equal(MAK.parseMemberships({ error: 403 }), null);
});

test('teacherGroups with the roles: teachers, then other teaching staff; never students or the user', () => {
  const members = [
    { eid: 'miren.zubiri', role: 'Instructor' },
    { eid: 'MALDAZ', role: 'Instructor' }, // a user name without a dot: the role decides
    { eid: 'juan.perez', role: 'Teaching Assistant' },
    { eid: 'garcia.161234', role: 'Student' },
    { eid: 'chareca.165075', role: 'Student' }
  ];
  const groups = MAK.teacherGroups(recipients(), members);
  assert.deepEqual(groups.map((g) => g.key), ['instructor', 'assistant']);
  assert.deepEqual(groups[0].people.map((p) => p.name), ['ALDAZ ZARAGUETA, MIGUEL ANGEL', 'ZUBIRI ARANA, MIREN'], 'sorted by name, without the user name');
  assert.deepEqual(groups[0].people.map((p) => p.value), ['v4', 'v3']);
  assert.deepEqual(groups[1].people.map((p) => p.label), ['PEREZ, JUAN (juan.perez)']);
  assert.deepEqual(MAK.teacherGroups(recipients(), [{ eid: 'garcia.161234', role: 'Student' }]), [], 'no teachers: no groups');
});

test('teacherGroups without the roles (error 403): the user names without digits', () => {
  const groups = MAK.teacherGroups(recipients(), null);
  assert.deepEqual(groups.map((g) => g.key), ['probable']);
  assert.deepEqual(groups[0].people.map((p) => p.value), ['v4', 'v6', 'v3'], 'the students have digits; the user is not in the list');
});

test('loadTeachers: the compose form and the members together; a 403 uses the user names', async () => {
  const compose = { fields: { to: { options: [{ value: 'a', label: 'ZUBIRI, MIREN (miren.zubiri)' }, { value: 'b', label: 'GARCIA, ANA (garcia.1)' }] } } };
  const pm = { open: async (placement) => (assert.equal(placement, 'P'), compose) };
  const asked = [];
  const ok = async (url) => (asked.push(url), { ok: true, json: async () => ({ membership_collection: [{ userEid: 'miren.zubiri', memberRole: 'Instructor' }] }) });
  const r = await MAK.loadTeachers({ siteId: 'S 1', placement: 'P', pm, myEid: 'x', doFetch: ok });
  assert.equal(asked[0], '/direct/site/S%201/memberships.json?auto=true');
  assert.equal(r.compose, compose);
  assert.deepEqual(r.groups, [{ key: 'instructor', people: [{ value: 'a', label: 'ZUBIRI, MIREN (miren.zubiri)', name: 'ZUBIRI, MIREN' }] }]);
  const denied = await MAK.loadTeachers({ siteId: 'S', placement: 'P', pm, myEid: 'x', doFetch: async () => ({ ok: false, status: 403 }) });
  assert.deepEqual(denied.groups.map((g) => g.key), ['probable']);
  const offline = await MAK.loadTeachers({ siteId: 'S', placement: 'P', pm, myEid: 'x', doFetch: async () => { throw new Error('offline'); } });
  assert.deepEqual(offline.groups.map((g) => g.key), ['probable']);
});
