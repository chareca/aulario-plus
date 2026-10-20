// Aulario Plus: the deliveries model (state, urgency, links, badge counts).
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});
  const { MINUTE, HOUR, DAY } = MAK;

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

  // Link to the delivery: the same link as the list of the Assignments tool, in the page of the
  // site. It must have the full reference ("/assignment/a/{site}/{id}"). With only the id, Sakai
  // finds the assignment but not the submission of the user: the honor pledge comes back after
  // "De acuerdo", and the user sees an empty submission.
  MAK.deliveryUrl = function (a, pages) {
    const tool = pages && pages[a.siteId] && pages[a.siteId].tools['sakai.assignment.grades'];
    if (tool && tool.placement && a.siteId && a.id) {
      const q = new URLSearchParams({ assignmentReference: `/assignment/a/${a.siteId}/${a.id}`, panel: 'Main', sakai_action: 'doView_submission' });
      return MAK.safeSiteUrl(`/portal/site/${encodeURIComponent(a.siteId)}/tool/${encodeURIComponent(tool.placement)}?${q}`);
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
        dueChange: a.dueChange || null,
        feedback: (a.sub && a.sub.feedback) || null
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

  // The week view: for each week (Monday to Sunday) from this week, the open deliveries and the
  // calendar events. The events of a delivery (with assignmentId) are not shown two times.
  MAK.buildWeeks = function ({ deliveries, events, sites, hidden, now, count = 6 }) {
    const hide = hidden || new Set();
    const names = new Map((sites || []).map((s) => [s.id, s.title]));
    const weeks = [];
    for (let i = 0, start = MAK.startOfWeek(now); i < count; i++) {
      const end = MAK.startOfWeek(start + 8 * DAY); // the next Monday, also with a change of the time
      weeks.push({ start, end, deliveries: [], events: [], total: 0 });
      start = end;
    }
    const weekOf = (ms) => (ms ? weeks.find((w) => ms >= w.start && ms < w.end) : null);
    for (const d of deliveries || []) {
      const w = weekOf(d.due);
      if (w) w.deliveries.push(d);
    }
    for (const e of events || []) {
      if (e.assignmentId || hide.has(e.siteId)) continue;
      const w = weekOf(e.start);
      if (w) w.events.push(Object.assign({}, e, { siteTitle: names.get(e.siteId) || e.siteTitle }));
    }
    for (const w of weeks) {
      w.deliveries.sort((x, y) => x.due - y.due);
      w.events.sort((x, y) => x.start - y.start);
      w.total = w.deliveries.length + w.events.length;
    }
    return weeks;
  };

  // The reminders before a delivery (the settings notifyDue and dueOffsets): for the deliveries that
  // are not submitted, online, with a due time in the future. offsets: the minutes before the due
  // time (24 h and 1 h by default, at most 3). notified: { id: { due, sent: [minutes] } }; a new
  // due date gives new reminders. Result:
  // - now: [{ a, sent }], a reminder now (one, also if more times are past: the extension was off);
  //   sent: all the past times, to remember
  // - later: [{ id, when }], the next time of a reminder of each delivery
  MAK.DUE_OFFSET_CHOICES = [15, 30, 60, 120, 180, 360, 720, 1440, 2880, 4320, 10080];
  MAK.DEFAULT_DUE_OFFSETS = [1440, 60];
  MAK.dueReminders = function ({ assignments, hidden, now, notified, offsets }) {
    const hide = hidden || new Set();
    const shown = notified || {};
    const list = offsets && offsets.length ? offsets : MAK.DEFAULT_DUE_OFFSETS;
    const out = { now: [], later: [] };
    for (const a of assignments || []) {
      if (hide.has(a.siteId) || !a.due || a.due <= now || a.type === MAK.OFFLINE_TYPE) continue;
      if (MAK.deliveryState(a, now) !== 'pending') continue;
      const before = shown[a.id];
      // Before version 1.6.4: the due date only (the reminder of 1 hour was sent).
      const sent = before === a.due ? [60] : before && before.due === a.due && Array.isArray(before.sent) ? before.sent : [];
      const past = list.filter((m) => a.due - m * MINUTE <= now);
      if (past.some((m) => !sent.includes(m))) out.now.push({ a, sent: [...new Set(sent.concat(past))] });
      const next = list.map((m) => a.due - m * MINUTE).filter((at) => at > now);
      if (next.length) out.later.push({ id: a.id, when: Math.min(...next) });
    }
    return out;
  };

  // The time to the due time for a reminder: "45 minutos", "23 horas", "2 días".
  MAK.leftText = function (ms) {
    const min = Math.max(1, Math.round(ms / MINUTE));
    if (min < 60) return MAK.t('dur.minutes', { n: min });
    if (ms < 48 * HOUR) return MAK.t('dur.hours', { n: Math.round(ms / HOUR) });
    return MAK.t('dur.days', { n: Math.round(ms / DAY) });
  };

  // Text for the time that remains, for example "quedan 2d 04h 12m" or "vencida hace 3h 05m".
  MAK.countdownText = function (due, now) {
    if (!due) return MAK.t('due.noDate');
    const left = due - now;
    return MAK.t(left >= 0 ? 'due.in' : 'due.lateBy', { d: MAK.formatDuration(left) });
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
