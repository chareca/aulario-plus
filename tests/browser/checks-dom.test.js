// The checks of the MiAulario pages (MAK.runChecks), with synthetic pages and a fake API.
(function () {
  'use strict';
  const F = window.PM_FIXTURES;
  const BASE = 'https://miaulario.unavarra.es';
  const PAGES = [
    { id: 'p1', title: 'Recursos', url: `${BASE}/portal/site/S/page/p1`, tools: [{ id: 'res-1', toolId: 'sakai.resources' }] },
    { id: 'p2', title: 'Correo interno', url: `${BASE}/portal/site/S/page/p2`, tools: [{ id: 'T', toolId: 'sakai.messages' }] },
    { id: 'p3', title: 'Libro de evaluación', url: `${BASE}/portal/site/S/page/p3`, tools: [{ id: 'gb-1', toolId: 'sakai.gradebookng' }] }
  ];
  const api = {
    session: async () => ({ userId: 'u-me', userEid: 'chareca.1' }),
    sites: async () => [{ id: 'S', title: '26_0_1_1 SITIO', type: 'course' }],
    pages: async () => PAGES,
    assignments: async () => [], announcements: async () => [], notifications: async () => [], synoptic: async () => [],
    forums: async () => [], resources: async () => [], calendar: async () => [], grades: async () => []
  };
  const SIDEBAR = (titleAttr = true) => `<ul><li class="site-list-item" data-site="S"><div class="site-link-block"><a class="sidebar-site-title" href="#"${titleAttr ? ' title="26_0_1_1 SITIO"' : ''}>SITIO</a></div></li></ul>
    <div class="portal-header-site-title"><a href="#">26_0_1_1 SITIO</a></div>`;
  const RESOURCES = (name = 'selectedMembers') => `<table class="table table-striped"><tbody>
    <tr><td><input type="checkbox" name="${name}" value="/group/S/Apuntes/"></td><td class="title"><a href="#">Apuntes</a></td></tr>
    <tr><td><input type="checkbox" name="${name}" value="/group/S/a.pdf"></td><td class="title"><a href="${BASE}/access/content/group/S/a.pdf">a.pdf</a></td></tr></tbody></table>`;
  const GRADEBOOK = '<table><tbody class="gb-summary-assignments-tbody"><tr class="gb-summary-grade-row"><td><span class="gb-summary-grade-title">Examen</span></td><td><span class="gb-summary-grade-score-raw">-</span><span class="gb-summary-grade-score-outof">/10</span></td></tr></tbody></table><span class="gb-summary-course-grade-value">-</span>';

  function fakeMail(compose = () => F.COMPOSE()) {
    return async (url, init = {}) => {
      const body = init.body ? [...init.body.entries()] : [];
      const has = (n) => body.some(([k]) => k === n);
      let html = F.LOGIN;
      if (!init.method) html = F.HOME;
      else if (url.endsWith('/pvtMsgHpView')) html = compose();
      else if (url === `${F.TOOL}/compose` && has('compose:j_id_jsp_1863517013_94')) html = F.PICKER_PAGE([]);
      else if (url === `${F.TOOL}/compose` && has('compose:j_id_jsp_1863517013_124')) html = F.HOME;
      else if (url.startsWith(`${F.PICKER}?sakai_action=doCancel`)) html = compose();
      return MAK.pmSnapshot(parse(html), url);
    };
  }
  const ctx = (o = {}) => ({
    api,
    now: Date.now(),
    getDoc: async (path) => parse(path === '/portal/site/S' ? (o.sidebar || SIDEBAR()) : path === '/portal/site/S/page/p1' ? (o.resources || RESOURCES()) : path === '/portal/tool/gb-1' ? GRADEBOOK : F.LOGIN),
    pm: MAK.createPm({ load: fakeMail(o.compose) })
  });
  const byId = (results) => Object.fromEntries(results.map((r) => [r.id, r]));

  test('checks: all the checks pass with pages in the form of MiAulario', async () => {
    const r = await MAK.runChecks(ctx());
    const bad = r.filter((x) => x.ok !== true).map((x) => `${x.id}: ${x.detail}`);
    assert.deepEqual(bad, []);
    assert.equal(r.length, MAK.CHECKS.length);
    assert.ok(/cancelled/.test(byId(r).mail.detail));
  });

  test('checks: a sidebar without the full title fails the check "sidebar"', async () => {
    const r = byId(await MAK.runChecks(ctx({ sidebar: SIDEBAR(false) })));
    assert.equal(r.sidebar.ok, false);
    assert.ok(/sidebar-site-title\[title\]/.test(r.sidebar.detail));
    assert.equal(r.resourcesPage.ok, true, 'the other checks still pass');
  });

  test('checks: a Resources list with other names fails the check "resourcesPage"', async () => {
    const r = byId(await MAK.runChecks(ctx({ resources: RESOURCES('items') })));
    assert.equal(r.resourcesPage.ok, false);
    assert.ok(/selectedMembers/.test(r.resourcesPage.detail));
  });

  test('checks: a compose form without the button "Send" fails the check "mail" with the code', async () => {
    const r = byId(await MAK.runChecks(ctx({ compose: () => F.COMPOSE({ labels: ['Añadir adjuntos', 'Vista preliminar', 'Guardar borrador', 'Otro', 'Cancelar'] }) })));
    assert.equal(r.mail.ok, false);
    assert.ok(/pm\.noButtons/.test(r.mail.detail), r.mail.detail);
  });
})();
