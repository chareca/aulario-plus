// Synthetic MiAulario data. The shapes are the same as the real API responses.
// The names, texts and ids are not real. Do not put real data in this repository.
'use strict';

// make(now) builds all the data for a given time. The tests use a fixed time.
function make(NOW) {
  const H = 3600 * 1000;
  const D = 24 * H;
  const epoch = (ms) => ({ epochSecond: Math.floor(ms / 1000), nano: 0 });
  const sakaiDate = (ms) => new Date(ms).toISOString().replace(/[-:TZ.]/g, '').slice(0, 17);

  const SITES = [
    { id: '2026_0_100001_1_G', title: 'Mathematics I', type: 'course_asig' },
    { id: '2026_0_100002_1_G', title: 'Computer Science', type: 'course_asig' },
    { id: '2026_0_100003_1_G', title: 'Physics', type: 'course_asig' },
    { id: 'coord-2026-001', title: 'Degree Coordination', type: 'coord' }
  ];
  const [MATH, CS, PHYS, COORD] = SITES.map((s) => s.id);

  function pages(siteId) {
    const tool = (toolId, n) => ({
      id: `${siteId}-page-${n}`,
      title: toolId,
      url: `https://miaulario.unavarra.es/portal/site/${siteId}/page/${siteId}-page-${n}`,
      tools: [{ id: `${siteId}-tool-${n}`, toolId, title: toolId }]
    });
    return [
      tool('sakai.synoptic.announcement', 0),
      tool('sakai.announcements', 1),
      tool('sakai.resources', 2),
      tool('sakai.assignment.grades', 3),
      tool('sakai.forums', 4),
      tool('sakai.messages', 5)
    ];
  }

  function submission(o) {
    return Object.assign({ submitted: false, draft: false, graded: false, returned: false, canSubmit: true, userSubmission: true, status: 'Sin enviar' }, o);
  }

  function assignment(id, siteId, title, o) {
    return Object.assign(
      {
        id,
        title,
        context: siteId,
        status: 'OPEN',
        submissionType: 'ATTACHMENT_ONLY_ASSIGNMENT_SUBMISSION',
        openTime: epoch(NOW - 10 * D),
        timeCreated: epoch(NOW - 11 * D),
        dueTime: epoch(NOW + 5 * D),
        closeTime: epoch(NOW + 5 * D),
        submissions: [submission({})]
      },
      o
    );
  }

  const ASSIGNMENTS = [
    assignment('asg-red', CS, 'Lab report 3', { dueTime: epoch(NOW + 20 * H), closeTime: epoch(NOW + 20 * H) }),
    assignment('asg-orange', MATH, 'Problem set 4', { dueTime: epoch(NOW + 2 * D), closeTime: epoch(NOW + 2 * D) }),
    assignment('asg-submitted', PHYS, 'Essay', { submissions: [submission({ submitted: true, canSubmit: false, status: 'Enviado' })] }),
    assignment('asg-late', CS, 'Lab report 2', { dueTime: epoch(NOW - 2 * H), closeTime: epoch(NOW + D) }),
    assignment('asg-closed', MATH, 'Problem set 1', { status: 'CLOSED', dueTime: epoch(NOW - 3 * D), closeTime: epoch(NOW - D), submissions: [submission({ canSubmit: false })] }),
    assignment('asg-paper', COORD, 'Signed form (on paper)', { submissionType: 'NON_ELECTRONIC_ASSIGNMENT_SUBMISSION', dueTime: epoch(NOW + 10 * D), closeTime: epoch(NOW + 10 * D) }),
    assignment('asg-returned', MATH, 'Problem set 3', { submissions: [submission({ submitted: true, returned: true, graded: true, canSubmit: true })] }),
    assignment('asg-draft', CS, 'Final project', { dueTime: epoch(NOW + 12 * D), closeTime: epoch(NOW + 12 * D), submissions: [submission({ draft: true })] }),
    assignment('asg-new', PHYS, 'Lab safety quiz', { timeCreated: epoch(NOW - 2 * H), openTime: epoch(NOW - 2 * H), dueTime: epoch(NOW + 6 * D), closeTime: epoch(NOW + 6 * D) })
  ];

  function announcement(uuid, siteId, siteTitle, title, createdOn, body) {
    return {
      id: `${siteId}:main:${uuid}`,
      announcementId: uuid,
      channel: 'main',
      siteId,
      siteTitle,
      title,
      body,
      createdOn,
      createdByDisplayName: 'Teacher A',
      attachments: [],
      entityReference: `/announcement/${siteId}:main:${uuid}`
    };
  }

  const ANNOUNCEMENTS = [
    announcement('ann-1', CS, 'Computer Science', 'Exam room changed', NOW - 3 * H, '<p>The exam is in room <b>A&nbsp;12</b>.</p><p>Bring your ID &amp; a pen.</p>'),
    announcement('ann-2', MATH, 'Mathematics I', 'Clase de recuperación', NOW - 2 * D, '<div>La clase del jueves pasa al viernes.<br>Gracias.</div>'),
    announcement('ann-3', PHYS, 'Physics', 'Lab groups', NOW - 9 * D, '<ul><li>Group 1: Monday</li><li>Group 2: Tuesday</li></ul>'),
    announcement('ann-4', COORD, 'Degree Coordination', 'Calendar of exams', NOW - 20 * D, '<p>The exam calendar is available.</p>')
  ];

  const NOTIFICATIONS = [
    {
      id: 101,
      event: 'annc.new',
      ref: `/announcement/msg/${CS}/main/ann-1`,
      url: `https://miaulario.unavarra.es/portal/directtool/${CS}-tool-1?itemReference=/announcement/msg/${CS}/main/ann-1&sakai_action=doShowmetadata`,
      viewed: false,
      siteId: CS,
      siteTitle: 'Computer Science',
      tool: 'sakai.announcements',
      title: 'Exam room changed',
      eventDate: NOW - 3 * H
    },
    {
      id: 102,
      event: 'annc.new',
      ref: `/announcement/msg/${MATH}/main/ann-2`,
      url: `https://miaulario.unavarra.es/portal/directtool/${MATH}-tool-1?itemReference=/announcement/msg/${MATH}/main/ann-2&sakai_action=doShowmetadata`,
      viewed: true,
      siteId: MATH,
      siteTitle: 'Mathematics I',
      tool: 'sakai.announcements',
      title: 'Clase de recuperación',
      eventDate: NOW - 2 * D
    },
    {
      id: 103,
      event: 'asn.available.assignment',
      ref: `/assignment/a/${PHYS}/asg-new`,
      url: `https://miaulario.unavarra.es/portal/directtool/${PHYS}-tool-3?assignmentId=asg-new&panel=Main&sakai_action=doView_submission`,
      viewed: false,
      siteId: PHYS,
      tool: 'sakai.assignment.grades',
      title: 'Lab safety quiz',
      eventDate: NOW - 2 * H
    }
  ];

  const GRADES = [
    { id: 501, name: 'Problem set 1', score: '7,5', notGradedYet: false, ungraded: 0, siteId: MATH, siteTitle: 'Mathematics I', url: `/portal/directtool/${MATH}-tool-6`, canGrade: false },
    { id: 502, name: 'Problem set 2', score: '', notGradedYet: true, ungraded: 0, siteId: MATH, siteTitle: 'Mathematics I', url: `/portal/directtool/${MATH}-tool-6`, canGrade: false },
    { id: 503, name: 'Lab report 1', score: '', notGradedYet: true, ungraded: 0, siteId: CS, siteTitle: 'Computer Science', url: `/portal/directtool/${CS}-tool-6`, canGrade: false },
    { id: 504, name: 'Theory exam', score: '', notGradedYet: true, ungraded: 0, siteId: PHYS, siteTitle: 'Physics', url: `/portal/directtool/${PHYS}-tool-6`, canGrade: false },
    { id: 505, name: 'Group work (as a tutor)', score: '6.2', notGradedYet: false, ungraded: 3, siteId: COORD, siteTitle: 'Degree Coordination', url: `/portal/directtool/${COORD}-tool-6`, canGrade: true }
  ];

  const SYNOPTIC = [
    { siteId: MATH, siteTitle: 'Mathematics I', newMessagesCount: 0, newForumCount: 0 },
    { siteId: CS, siteTitle: 'Computer Science', newMessagesCount: 2, newForumCount: 5 },
    { siteId: PHYS, siteTitle: 'Physics', newMessagesCount: 1, newForumCount: 0 }
  ];

  const FORUMS = {
    [CS]: [{ id: 7, title: 'General', readMessages: 10, totalMessages: 15 }]
  };
  const FORUM_DETAIL = {
    [`${CS}/7`]: {
      id: 7,
      title: 'General',
      topics: [
        { id: 71, title: 'Questions about lab 3', readMessages: 4, totalMessages: 7, modifiedDate: NOW - 5 * H },
        { id: 72, title: 'Exam doubts', readMessages: 6, totalMessages: 8, modifiedDate: NOW - D }
      ]
    }
  };

  function resources(siteId) {
    const base = `https://miaulario.unavarra.es/access/content/group/${siteId}/`;
    const item = (rel, type, size, modifiedMs, extra) =>
      Object.assign({ url: base + rel, title: decodeURIComponent(rel.replace(/\/$/, '').split('/').pop() || siteId), type, size, modifiedDate: sakaiDate(modifiedMs), container: '/content/group/', numChildren: 0, hidden: false, visible: true }, extra);
    return [
      item('', 'collection', 0, NOW - 30 * D),
      item('Apuntes/', 'collection', 0, NOW - 30 * D),
      item('Apuntes/Tema%201.pdf', 'application/pdf', 1200, NOW - 30 * D),
      item('Apuntes/Tema%202%20-%20Integrales.pdf', 'application/pdf', 3400, NOW - 4 * H),
      item('Pr%C3%A1cticas/', 'collection', 0, NOW - 20 * D),
      item('Pr%C3%A1cticas/Enunciado.pdf', 'application/pdf', 800, NOW - 20 * D),
      item('Vac%C3%ADa/', 'collection', 0, NOW - 20 * D),
      item('Enlaces/', 'collection', 0, NOW - 20 * D),
      item('Enlaces/Simulador', 'text/url', 40, NOW - 20 * D, { webLinkUrl: 'https://example.org/simulator' })
    ];
  }

  const CALENDAR = [
    { eventId: 'ev-1', title: 'Exam: Mathematics I', description: '<p>Room <b>A1</b></p>', type: 'Exam', firstTime: { time: NOW + 7 * D }, duration: 2 * H, siteId: MATH, siteName: 'Mathematics I', assignmentId: null },
    { eventId: 'ev-2', title: 'Due Lab report 3', description: '', type: 'Deadline', firstTime: { time: NOW + 20 * H }, duration: 0, siteId: CS, siteName: 'Computer Science', assignmentId: 'asg-red' },
    { eventId: 'ev-3', title: 'Tutoría; grupo A, aula 3', description: 'Línea 1\nLínea 2', type: 'Meeting', firstTime: { time: NOW + 2 * D }, duration: H, siteId: PHYS, siteName: 'Physics', assignmentId: null }
  ];

  // Routes for tests/helpers.js fakeFetch.
  function routes(o = {}) {
    const r = {
      '/direct/session/current.json': { userId: o.userId || 'user-1', active: true, maxInactiveInterval: 3600, currentTime: NOW, lastAccessedTime: NOW },
      '/direct/site.json': { entityPrefix: 'site', site_collection: SITES },
      '/direct/assignment/my.json': { entityPrefix: 'assignment', assignment_collection: ASSIGNMENTS },
      '/direct/announcement/user.json': { entityPrefix: 'announcement', announcement_collection: ANNOUNCEMENTS },
      '/api/users/me/notifications': NOTIFICATIONS,
      '/direct/synopticmsgcntritem.json': { entityPrefix: 'synopticmsgcntritem', synopticmsgcntritem_collection: SYNOPTIC },
      '/direct/calendar/my.json': { entityPrefix: 'calendar', calendar_collection: CALENDAR },
    '/api/users/me/grades': { grades: GRADES, sites: SITES.map((s) => ({ siteId: s.id, title: s.title })) }
    };
    for (const s of SITES) {
      r[`/direct/site/${s.id}/pages.json`] = pages(s.id);
      r[`/direct/content/site/${s.id}.json`] = { entityPrefix: 'content', content_collection: s.type === 'coord' ? [] : resources(s.id) };
      r[`/direct/forums/site/${s.id}.json`] = { entityPrefix: 'forums', forums_collection: FORUMS[s.id] || [] };
    }
    for (const [key, detail] of Object.entries(FORUM_DETAIL)) {
      const [siteId, forumId] = key.split('/');
      r[`/direct/forums/site/${siteId}/forum/${forumId}.json`] = detail;
    }
    return r;
  }

  return { NOW, H, D, SITES, MATH, CS, PHYS, COORD, ASSIGNMENTS, ANNOUNCEMENTS, NOTIFICATIONS, GRADES, SYNOPTIC, FORUMS, FORUM_DETAIL, CALENDAR, pages, resources, routes, epoch, sakaiDate };
}

module.exports = Object.assign(make(Date.UTC(2026, 9, 16, 10, 0, 0)), { make }); // 2026-10-16 10:00 UTC
