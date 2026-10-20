'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, fakeFetch, response } = require('./helpers');
const F = require('./fixtures/miaulario');
const MAK = loadLib('core', 'api');

test('each GET adds auto=true and sends the cookies', async () => {
  const log = [];
  let init;
  const fetch = fakeFetch(F.routes(), log);
  const api = MAK.createApi({ fetch: async (u, i) => { init = i; return fetch(u, i); } });
  const list = await api.assignments();
  assert.equal(list.length, F.ASSIGNMENTS.length);
  assert.match(log[0].url, /\/direct\/assignment\/my\.json\?auto=true$/);
  assert.equal(init.credentials, 'include');
  await api.announcements(30, 7);
  assert.match(log[1].url, /user\.json\?n=30&d=7&auto=true$/);
});

test('the API finds the array in all the response shapes', async () => {
  const api = MAK.createApi({ fetch: fakeFetch(F.routes()) });
  assert.equal((await api.notifications()).length, F.NOTIFICATIONS.length); // plain array
  assert.equal((await api.pages(F.CS)).length, 8); // plain array (with the course guide)
  assert.equal((await api.forums(F.CS)).length, 1); // forums_collection
  assert.equal((await api.sites()).length, F.SITES.length);
  const detail = await api.forum(F.CS, 7);
  assert.equal(detail.topics.length, 2);
});

test('the API rejects HTML, bad shapes and HTTP errors', async () => {
  const routes = {
    '/direct/site.json': fakeFetch.raw(response('<html>login</html>', { type: 'text/html' })),
    '/direct/assignment/my.json': { entityPrefix: 'assignment' },
    '/direct/synopticmsgcntritem.json': fakeFetch.raw(response({}, { status: 503 })),
    '/direct/announcement/user.json': fakeFetch.raw(response({}, { status: 403 }))
  };
  const api = MAK.createApi({ fetch: fakeFetch(routes) });
  await assert.rejects(api.sites(), (e) => e.kind === 'not-json');
  await assert.rejects(api.assignments(), (e) => e.kind === 'shape');
  await assert.rejects(api.synoptic(), (e) => e.kind === 'http' && e.status === 503 && e.retryLater);
  await assert.rejects(api.announcements(1, 1), (e) => e.status === 403 && !e.retryLater);
  const offline = MAK.createApi({ fetch: async () => { throw new TypeError('offline'); } });
  await assert.rejects(offline.session(), (e) => e.kind === 'network');
});

test('markViewed sends a POST without auto=true', async () => {
  const log = [];
  const api = MAK.createApi({ fetch: fakeFetch({ '/api/users/me/notifications/markViewed': { ok: true } }, log) });
  assert.equal(await api.markViewed(F.CS, 'sakai.announcements'), true);
  assert.equal(log[0].method, 'POST');
  assert.doesNotMatch(log[0].url, /auto=true/);
  assert.match(log[0].url, /siteId=2026_0_100002_1_G&toolId=sakai\.announcements$/);
});

test('gradebook: the HTML of the Gradebook page, with auto=true; other content types fail', async () => {
  const log = [];
  const html = F.gradebookHtml(F.MATH);
  const api = MAK.createApi({
    fetch: fakeFetch({ [`/portal/tool/${F.MATH}-tool-6`]: fakeFetch.raw(response(html, { type: 'text/html;charset=UTF-8' })), '/portal/tool/x': { a: 1 } }, log)
  });
  assert.equal(await api.gradebook(`${F.MATH}-tool-6`), html);
  assert.match(log[0].url, /\/portal\/tool\/.+-tool-6\?auto=true$/);
  await assert.rejects(api.gradebook('x'), (e) => e.kind === 'not-html');
});

test('trimPages keeps the home page and the page of the course guide', () => {
  const p = MAK.trimPages(F.pages(F.CS), F.NOW);
  assert.equal(p.home, `${F.CS}-page-0`);
  assert.deepEqual(p.guide, { page: `https://miaulario.unavarra.es/portal/site/${F.CS}/page/${F.CS}-page-7`, placement: `${F.CS}-tool-7` });
  const none = MAK.trimPages(F.pages(F.PHYS), F.NOW);
  assert.equal(none.guide, null);
  // Another "Web content" tool is not the guide.
  const other = MAK.trimPages([{ id: 'p', title: 'Zoom', url: 'https://miaulario.unavarra.es/portal/site/S/page/p', tools: [{ id: 't', toolId: 'sakai.iframe', title: 'Zoom' }] }], 0);
  assert.equal(other.guide, null);
});

test('trimAssignment: the correction only when the teacher returned the task; never the private notes', () => {
  const base = { id: 'a1', context: 'S', title: 'Entrega 1', submissionType: 'TEXT_ONLY_ASSIGNMENT_SUBMISSION' };
  const sub = (o) => Object.assign({ submitted: true, userSubmission: true, grade: '8,50', feedbackComment: '<p>Bien, pero <b>revisa</b> el punto 2.</p>', privateNotes: 'secreto del profesor',
    feedbackAttachments: [{ name: 'correccion.pdf', url: 'https://miaulario.unavarra.es/access/content/attachment/S/c.pdf' }, { name: 'x', url: 'https://evil.example/x' }] }, o);
  const returned = MAK.trimAssignment(Object.assign({}, base, { submissions: [sub({ returned: true })] }));
  assert.deepEqual(returned.sub.feedback, { grade: '8,50', comment: 'Bien, pero revisa el punto 2.', files: [{ name: 'correccion.pdf', url: 'https://miaulario.unavarra.es/access/content/attachment/S/c.pdf' }] });
  assert.ok(!JSON.stringify(returned).includes('secreto'), 'no private notes');
  const notYet = MAK.trimAssignment(Object.assign({}, base, { submissions: [sub({ returned: false, graded: true })] }));
  assert.equal(notYet.sub.feedback, null, 'graded but not returned: the student must not see it yet');
  assert.equal(MAK.trimAssignment(Object.assign({}, base, { submissions: [sub({ returned: true, grade: '', feedbackComment: '', feedbackAttachments: [] })] })).sub.feedback, null, 'nothing to show');
});
