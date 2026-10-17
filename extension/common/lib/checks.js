// Aulario Plus: the checks of MiAulario. Each check reads one part of MiAulario that the
// extension uses (an API or a page) and tells if it still has the expected form. When MiAulario
// changes, a check fails and tells what to correct. The checks only read: in the internal mail,
// they open the compose form and the attachment page, then they cancel. They never send.
// The results have no personal data: only numbers, names of fields and the texts of the checks.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  class CheckError extends Error {}
  const need = (ok, detail) => {
    if (!ok) throw new CheckError(detail);
  };
  // The fields that are missing in the first item of a list (null if the list is empty).
  const missingIn = (list, fields) => (list.length ? fields.filter((f) => !(f in Object(list[0]))) : null);
  const fieldsOk = (list, fields, what) => {
    const missing = missingIn(list, fields);
    need(!missing || !missing.length, `${what}: no field ${(missing || []).join(', ')}`);
    return missing === null ? `0 ${what} (the fields were not checked)` : `${list.length} ${what}`;
  };

  // ctx: { api: MAK.createApi(...), getDoc: (path) => Promise<Document>, pm: MAK.createPm(...), now }
  // s: what the checks find for the next checks (the test site, its pages, the user id).
  MAK.CHECKS = [
    { id: 'session', area: 'api', run: async (ctx, s) => {
      const x = await ctx.api.session();
      need(x && x.userId, 'no session: log in to MiAulario');
      need(x.userEid, 'the session has no userEid');
      s.eid = x.userEid;
      return 'active session';
    } },
    { id: 'sites', area: 'api', after: 'session', run: async (ctx, s) => {
      s.sites = (await ctx.api.sites()).map(MAK.trimSite).filter((x) => !MAK.isSpecialSite(x.id));
      need(s.sites.length, 'no sites');
      return `${s.sites.length} sites`;
    } },
    { id: 'pages', area: 'api', after: 'sites', run: async (ctx, s) => {
      for (const site of s.sites) {
        const pages = MAK.trimPages(await ctx.api.pages(site.id), ctx.now);
        if (!s.anyPages) s.anyPages = { site, pages };
        if (pages.tools['sakai.messages'] && pages.tools['sakai.resources']) {
          s.site = site;
          s.pages = pages;
          break;
        }
      }
      const p = (s.pages || (s.anyPages && s.anyPages.pages));
      need(p && p.nav.length, 'the pages have no title or no address');
      need(s.site, 'no site has the internal mail (sakai.messages) and the Resources tool (sakai.resources)');
      return `${s.pages.nav.length} pages, ${Object.keys(s.pages.tools).length} tools in the test site`;
    } },
    { id: 'assignments', area: 'api', after: 'session', run: async (ctx) => {
      const list = await ctx.api.assignments();
      const out = fieldsOk(list, ['id', 'context', 'title', 'dueTime', 'submissions'], 'deliveries');
      need(list.map(MAK.trimAssignment).every((a) => a.id && a.siteId), 'a delivery has no id or no site');
      return out;
    } },
    { id: 'announcements', area: 'api', after: 'session', run: async (ctx) => fieldsOk(await ctx.api.announcements(10, 60), ['id', 'siteId', 'title', 'createdOn'], 'announcements') },
    { id: 'notifications', area: 'api', after: 'session', run: async (ctx) => fieldsOk(await ctx.api.notifications(), ['event', 'ref', 'viewed'], 'notifications') },
    { id: 'synoptic', area: 'api', after: 'session', run: async (ctx) => fieldsOk(await ctx.api.synoptic(), ['siteId', 'newMessagesCount', 'newForumCount'], 'sites with counts') },
    { id: 'forums', area: 'api', after: 'pages', run: async (ctx, s) => fieldsOk(await ctx.api.forums(s.site.id), ['id', 'title'], 'forums') },
    { id: 'resources', area: 'api', after: 'pages', run: async (ctx, s) => {
      const list = await ctx.api.resources(s.site.id);
      const out = fieldsOk(list, ['url', 'type', 'size', 'modifiedDate'], 'files and folders');
      need(!list.length || list.map((r) => MAK.trimResource(r, s.site.id)).some(Boolean), 'no file has an address of the site');
      return out;
    } },
    { id: 'calendar', area: 'api', after: 'session', run: async (ctx) => {
      const from = MAK.startOfWeek(ctx.now);
      return fieldsOk(await ctx.api.calendar(MAK.ymd(from), MAK.ymd(from + 42 * MAK.DAY)), ['eventId', 'title', 'firstTime', 'siteId'], 'events');
    } },
    { id: 'grades', area: 'api', after: 'session', run: async (ctx) => fieldsOk(await ctx.api.grades(), ['id', 'siteId', 'name', 'notGradedYet'], 'grade items') },

    // ---- Pages (HTML) ----
    { id: 'sidebar', area: 'page', after: 'pages', run: async (ctx, s) => {
      const doc = await ctx.getDoc(`/portal/site/${encodeURIComponent(s.site.id)}`);
      const items = doc.querySelectorAll('li.site-list-item[data-site]');
      need(items.length, 'no sites in the sidebar (li.site-list-item[data-site])');
      need(doc.querySelector('li.site-list-item[data-site] a.sidebar-site-title[title]'), 'the sites of the sidebar have no a.sidebar-site-title[title]');
      need(doc.querySelector('.portal-header-site-title a'), 'no name of the site in the page header (.portal-header-site-title a)');
      return `${items.length} sites in the sidebar`;
    } },
    { id: 'resourcesPage', area: 'page', after: 'pages', run: async (ctx, s) => {
      const doc = await ctx.getDoc(new URL(s.pages.tools['sakai.resources'].page).pathname);
      const boxes = [...doc.querySelectorAll('input[type=checkbox][name="selectedMembers"]')];
      need(boxes.length, 'no list of files (input[name=selectedMembers])');
      need(boxes.every((b) => b.value.startsWith('/group/')), 'a checkbox has no id of a resource (/group/...)');
      need(doc.querySelector('td.title'), 'no column of titles (td.title)');
      return `${boxes.length} items in the list`;
    } },
    { id: 'gradebook', area: 'page', after: 'sites', run: async (ctx, s) => {
      let placement = null;
      for (const site of s.sites) {
        const pages = s.site && site.id === s.site.id ? s.pages : MAK.trimPages(await ctx.api.pages(site.id), ctx.now);
        const tool = pages.tools['sakai.gradebookng'];
        if (tool && tool.placement) {
          placement = tool.placement;
          break;
        }
      }
      if (!placement) return { skip: 'no site has a gradebook' };
      const data = MAK.extractGradebookRows(await ctx.getDoc(`/portal/tool/${encodeURIComponent(placement)}`));
      need(data.found, 'the gradebook has no summary table (gb-summary-...)');
      return `${data.rows.length} rows`;
    } },
    { id: 'mail', area: 'mail', after: 'pages', run: async (ctx, s) => {
      const r = await ctx.pm.inspect(s.pages.tools['sakai.messages'].placement, s.eid);
      need(r.recipients.length, 'the list "To" is empty');
      need(r.recipients.some((x) => x.me), 'the user is not in the list "To"');
      need(r.picker.item.includes('itemId') && r.picker.continueUrl, 'the attachment page has no form doattachitem or no "Continue"');
      need(r.closed, 'the internal mail did not go back to the inbox after "Cancel"');
      return `compose form, ${r.recipients.length} recipients, attachment page; cancelled`;
    } }
  ];

  // Run the checks in order. A check that needs a check that did not pass is skipped.
  MAK.runChecks = async function (ctx, opts = {}) {
    const s = {};
    const done = new Map();
    const out = [];
    for (const c of MAK.CHECKS) {
      if (opts.areas && !opts.areas.includes(c.area)) continue;
      const t0 = Date.now();
      let r;
      if (c.after && done.get(c.after) !== true) r = { id: c.id, area: c.area, ok: null, detail: `skipped: "${c.after}" did not pass` };
      else {
        try {
          const v = await c.run(ctx, s);
          r = v && v.skip ? { id: c.id, area: c.area, ok: null, detail: `skipped: ${v.skip}` } : { id: c.id, area: c.area, ok: true, detail: v };
        } catch (e) {
          const msg = String(e && e.message ? e.message : e);
          const detail = e instanceof CheckError || !(e && e.code) || msg.startsWith(e.code) ? msg : `${e.code}: ${msg}`;
          r = { id: c.id, area: c.area, ok: false, detail };
        }
      }
      r.ms = Date.now() - t0;
      done.set(c.id, r.ok);
      out.push(r);
      if (opts.onResult) opts.onResult(r);
    }
    return out;
  };

  // A text to copy: the results, without personal data.
  MAK.checksReport = function (results, { version, date }) {
    const mark = (r) => (r.ok === true ? '✓' : r.ok === false ? '✗' : '–');
    const failed = results.filter((r) => r.ok === false).length;
    return [`Aulario Plus ${version} · MiAulario checks · ${date}`, `${results.length - failed}/${results.length} without errors`, ...results.map((r) => `${mark(r)} ${r.id}: ${r.detail}`)].join('\n');
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
