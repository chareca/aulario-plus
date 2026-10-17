// Aulario Plus: the deliveries model (state, urgency, links, badge counts).
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});
  const { DAY } = MAK;

  MAK.OFFLINE_TYPE = 'NON_ELECTRONIC_ASSIGNMENT_SUBMISSION';

  // State of one delivery:
  //   'action'    the teacher returned it and you can submit again
  //   'submitted' you submitted it
  //   'closed'    you cannot submit it now
  //   'late'      the due time is past, but you can still submit
  //   'pending'   you did not submit it, and the due time is in the future
  MAK.deliveryState = function (a, now) {
    const sub = a.sub || {};
    const offline = a.type === MAK.OFFLINE_TYPE;
    if (sub.returned && sub.canSubmit) return 'action';
    if (sub.submitted) return 'submitted';
    if (a.close && now >= a.close) return 'closed';
    if (sub.canSubmit === false && a.status === 'CLOSED') return 'closed';
    if (a.due && now >= a.due) return offline || sub.canSubmit === false ? 'closed' : 'late';
    return 'pending';
  };

  // Link to the delivery. Use the direct link of the tool if possible.
  MAK.deliveryUrl = function (a, pages) {
    const tool = pages && pages[a.siteId] && pages[a.siteId].tools['sakai.assignment.grades'];
    if (tool && tool.placement) {
      const q = new URLSearchParams({ assignmentId: a.id, panel: 'Main', sakai_action: 'doView_submission' });
      return MAK.safeSiteUrl(`/portal/directtool/${encodeURIComponent(tool.placement)}?${q}`);
    }
    return MAK.toolUrl(pages, a.siteId, 'sakai.assignment.grades');
  };

  MAK.buildDue = function ({ assignments, sites, pages, hidden, now }) {
    const titles = new Map((sites || []).map((s) => [s.id, s.title]));
    const hide = hidden || new Set();
    const groups = { late: [], pending: [], action: [], submitted: [], closed: [] };
    let soon = 0; // not submitted, due in 72 hours or less (late ones included)
    let urgent = false; // not submitted, due in less than 24 hours, or late
    for (const a of assignments || []) {
      if (hide.has(a.siteId)) continue;
      const state = MAK.deliveryState(a, now);
      const offline = a.type === MAK.OFFLINE_TYPE;
      const left = a.due ? a.due - now : null;
      const item = {
        id: a.id,
        title: a.title,
        siteId: a.siteId,
        siteTitle: titles.get(a.siteId) || a.siteId,
        due: a.due,
        close: a.close,
        state,
        offline,
        urgency: offline ? null : state === 'late' ? 'overdue' : state === 'pending' && left !== null ? MAK.urgency(left) : null,
        url: MAK.deliveryUrl(a, pages),
        dueChange: a.dueChange || null
      };
      groups[state].push(item);
      if (!offline && (state === 'late' || (state === 'pending' && left !== null && left <= 3 * DAY))) {
        soon++;
        if (state === 'late' || left < DAY) urgent = true;
      }
    }
    const byDue = (dir) => (x, y) => ((x.due || Infinity) - (y.due || Infinity)) * dir;
    groups.late.sort(byDue(1));
    groups.pending.sort(byDue(1));
    groups.action.sort(byDue(1));
    groups.submitted.sort((x, y) => (y.due || 0) - (x.due || 0));
    groups.closed.sort((x, y) => (y.due || 0) - (x.due || 0));
    return { groups, soon, urgent };
  };

  // Text for the time that remains, for example "quedan 2d 04h 12m" or "vencida hace 3h 05m".
  MAK.countdownText = function (due, now) {
    if (!due) return MAK.t('due.noDate');
    const left = due - now;
    return MAK.t(left >= 0 ? 'due.in' : 'due.lateBy', { d: MAK.formatDuration(left) });
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
