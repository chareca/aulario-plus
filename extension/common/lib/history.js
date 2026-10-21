// Aulario Plus: the history of the tasks and the exams of the user (tools.html?history). MiAulario keeps a list of
// them in its panel "Tareas" (/api/users/me/tasks, from September 2025), also of the sites of other years (the user
// is not a member of them any more), and gives each task with the submission of the user
// (/direct/assignment/item/{id}), also of another year. The exams come only with their title, their dates and the
// mark "complete" (Samigo gives no more to a student). The extension keeps the history in the browser and adds to it:
// it never removes an item that MiAulario removes.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  MAK.HISTORY_MS = MAK.DAY; // a new reading in the background after this time
  MAK.HISTORY_DETAIL_MS = 180 * MAK.DAY; // a task without a correction: its submission is read again until 180 days after its date

  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  // The tasks and the exams of the panel "Tareas" (not its events of the calendar, of the Gradebook or of Lessons):
  // [{ ref, kind ('task' | 'exam'), id, siteId, siteTitle, title, starts, due, url, complete }].
  MAK.cleanHistoryItems = function (raw) {
    const out = [];
    for (const t of Array.isArray(raw) ? raw : []) {
      const ref = String((t && t.reference) || '');
      const m = /^\/(assignment)\/a\/([^/]+)\/([^/]+)$/.exec(ref) || /^\/(samigo)\/([^/]+)\/(\d+)$/.exec(ref);
      if (!m) continue;
      out.push({ ref, kind: m[1] === 'assignment' ? 'task' : 'exam', id: m[3], siteId: m[2], siteTitle: String(t.siteTitle || '').slice(0, 200),
        title: String(t.description || '').slice(0, 300), starts: num(t.starts), due: num(t.due), url: MAK.safeSiteUrl(t.url), complete: t.complete === true });
    }
    return out;
  };

  // The submission of the user in a task (/direct/assignment/item/{id}): submitted (only a submission of the user:
  // MAK.trimAssignment), its date, late, its files, and the correction (only when the teacher returned it).
  MAK.historyDetail = function (a, at) {
    const base = MAK.trimAssignment(a);
    const subs = Array.isArray(a && a.submissions) ? a.submissions : [];
    const mine = subs.find((s) => s && s.userSubmission) || subs[0] || {};
    const sent = base.sub.submitted;
    const files = (Array.isArray(mine.submittedAttachments) ? mine.submittedAttachments : [])
      .map((f) => ({ name: String((f && f.name) || 'archivo').slice(0, 200), url: MAK.safeSiteUrl(f && f.url), size: num(f && f.size) }))
      .filter((f) => f.url)
      .slice(0, 20);
    return { at, submitted: sent, date: sent && num(mine.dateSubmittedEpochSeconds) ? mine.dateSubmittedEpochSeconds * 1000 : null, late: sent && mine.late === true,
      files: sent ? files : [], feedback: base.sub.feedback, returned: base.sub.returned };
  };

  // The kept history and the items of now: all the items of both (an item that MiAulario removed stays), the new
  // fields of an item over the old ones (its submission stays). { at, items: { [ref]: item } }.
  MAK.mergeHistory = function (kept, items, at) {
    const all = Object.assign({}, (kept && kept.items) || {});
    for (const it of items) all[it.ref] = Object.assign({}, all[it.ref], it);
    return { at, items: all };
  };

  // Read the submission of a task again? Without it, or without a correction until 180 days after its date.
  MAK.historyNeedsDetail = (it, now) => it.kind === 'task' && (!it.detail || (!it.detail.returned && (it.due || it.starts || 0) > now - MAK.HISTORY_DETAIL_MS));

  // The state of an item. A task: 'submitted', 'late', 'missed' (its date is past), 'pending', 'unknown' (no
  // submission read). An exam: 'sent' (the mark of MiAulario), 'pending', 'noRecord'.
  MAK.historyStatus = function (it, now) {
    const future = (it.due || 0) > now;
    if (it.kind === 'exam') return it.complete ? 'sent' : future ? 'pending' : 'noRecord';
    if (!it.detail) return 'unknown';
    if (it.detail.submitted) return it.detail.late ? 'late' : 'submitted';
    return future ? 'pending' : 'missed';
  };

  // The submission confirmation emails of MiAulario that the user pastes: the exams (and the tasks) that the panel
  // "Tareas" does not have any more (before September 2025). Each email has "Site ID", "Assessment" or "Assignment
  // Title", "Submitted Date" and the dates. Result: items as MAK.cleanHistoryItems, with source 'email', complete
  // (it was submitted) and the submitted date.
  const MONTHS_EN = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const MONTHS_ES = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11 };
  const field = (block, label) => { const m = new RegExp(label + '\\s*:\\s*(.+)').exec(block); return m ? m[1].trim() : ''; };
  const enDate = (s) => {
    const m = /\w{3}\s+(\w{3})\s+(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})\s+\S+\s+(\d{4})/.exec(s);
    const mo = m && MONTHS_EN[m[1].toLowerCase()];
    return m && mo !== undefined ? new Date(+m[6], mo, +m[2], +m[3], +m[4], +m[5]).getTime() : null;
  };
  const esDate = (s) => {
    const m = /(\d{4})-([A-Za-záéíóú]+)\.?-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})\s*([ap])\.?\s*\.?\s*m)?/i.exec(s);
    const mo = m && MONTHS_ES[m[2].slice(0, 3).toLowerCase()];
    if (!m || mo === undefined) return null;
    let h = m[4] ? +m[4] : 0;
    if (m[6]) { const pm = m[6].toLowerCase() === 'p'; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
    return new Date(+m[1], mo, +m[3], h, m[5] ? +m[5] : 0).getTime();
  };
  MAK.parseSubmissionEmails = function (text) {
    const str = String(text || '');
    const blocks = str.split(/The following (?:assessment|assignment) submission/i);
    const chunks = blocks.length > 1 ? blocks.slice(1) : [str];
    const out = [];
    const seen = new Set();
    for (const b of chunks) {
      const siteId = field(b, 'Site ID');
      const title = field(b, 'Assessment') || field(b, 'Assignment Title') || field(b, 'Assignment');
      if (!/^\d{4}_/.test(siteId) && !/^[0-9a-f-]{20,}$/.test(siteId)) continue; // a site of MiAulario
      if (!title) continue;
      const isExam = /Confirmation Number/i.test(b);
      const parts = field(b, 'Confirmation Number').split('-');
      const subId = field(b, 'Submission ID') || parts[0] || '';
      const pubId = isExam ? (parts[1] || subId) : subId;
      if (!pubId) continue;
      const ref = isExam ? `/samigo/${siteId}/${pubId}` : `/assignment/a/${siteId}/${pubId}`;
      if (seen.has(ref)) continue;
      seen.add(ref);
      out.push({ ref, kind: isExam ? 'exam' : 'task', id: String(pubId), siteId, siteTitle: field(b, 'Site Title').slice(0, 200),
        title: title.slice(0, 300), starts: null, due: esDate(field(b, 'Due Date')) || enDate(field(b, 'Due Date')), url: null, complete: true, source: 'email',
        detail: { at: Date.now(), submitted: true, date: enDate(field(b, 'Submitted Date')) || esDate(field(b, 'Submitted Date')), late: false, files: [], feedback: null, returned: false } });
    }
    return out;
  };

  // The academic year of an item: of its site ("2025_0_240610_1_G": 2025/26), else of its date (from August).
  MAK.academicYear = function (it) {
    const site = /^(20\d\d)_/.exec(it.siteId || '');
    let year = site ? Number(site[1]) : null;
    if (year === null) {
      const d = new Date(it.due || it.starts || Date.now());
      year = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
    }
    return `${year}/${String(year + 1).slice(2)}`;
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
