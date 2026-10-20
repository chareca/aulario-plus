// Aulario Plus: background sync of course data.
// Only the background script runs the sync. The sync sends one request at a time, with a
// pause between requests, and keeps the old data if a request fails.
//
// Each stored item has "seen": the time when the extension saw the item for the first time.
// Items of the first fetch of each kind get seen = 0 (they existed before the extension).
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});
  const { MINUTE, HOUR, DAY } = MAK;

  const ROUTINE_MS = 15 * MINUTE;
  const IDLE_ROUTINE_MS = HOUR;
  const IDLE_AFTER_MS = 12 * HOUR;
  const FULL_MS = 4 * HOUR;
  const SITES_MS = 6 * HOUR;
  const CALENDAR_MS = 6 * HOUR;
  const CALENDAR_DAYS = 6 * 7; // the week view: this week and the next 5 weeks
  const PAGES_MS = DAY;
  const LOCK_MS = 3 * MINUTE;
  const ANNOUNCEMENT_DAYS = 60;
  const MAX_FORUMS_PER_SITE = 10;
  const MAX_LESSONS_PER_SITE = 10;

  // Keep "seen" from the previous data. New items get "now", or 0 for the first fetch.
  function withSeen(items, previous, keyOf, now, baseline) {
    const old = new Map((previous || []).map((x) => [keyOf(x), x.seen]));
    return items.map((x) => {
      const k = keyOf(x);
      const seen = old.has(k) ? old.get(k) : baseline ? 0 : now;
      return Object.assign(x, { seen });
    });
  }

  // Keep "feedbackAt": the time when the extension saw the correction of a delivery (its grade, its
  // comment or its files), for "new since the last visit". A changed correction gets the time again.
  // The first fetch (baseline) gives 0.
  const feedbackKey = (f) => (f ? JSON.stringify([f.grade, f.comment, f.files.map((x) => x.url)]) : '');
  MAK.trackFeedback = function (items, previous, now, baseline) {
    const old = new Map((previous || []).map((x) => [x.id, x]));
    return items.map((x) => {
      const f = x.sub && x.sub.feedback;
      if (!f) return x;
      const p = old.get(x.id);
      const same = p && p.sub && feedbackKey(p.sub.feedback) === feedbackKey(f);
      return Object.assign(x, { feedbackAt: same ? p.feedbackAt || 0 : baseline ? 0 : now });
    });
  };

  // Keep "dueChange" for a delivery with a new due date: { from: the first date, at: the time when
  // the extension saw the last change }. A date that goes back to "from" removes the change.
  // The first fetch (baseline) records no change.
  MAK.trackDueChanges = function (items, previous, now, baseline) {
    const old = new Map((previous || []).map((x) => [x.id, x]));
    return items.map((x) => {
      const p = old.get(x.id);
      let change = p && p.dueChange ? p.dueChange : null;
      if (!baseline && p && p.due && x.due && p.due !== x.due) change = { from: change ? change.from : p.due, at: now };
      if (change && change.from === x.due) change = null;
      return change ? Object.assign(x, { dueChange: change }) : x;
    });
  };

  // Announcements: a full fetch replaces the list; a small fetch adds to it and changes the
  // items that it contains. Keep the items of the last 60 days, newest first.
  MAK.mergeAnnouncements = function (prev, fetched, full, minDate) {
    let merged = fetched;
    if (!full) {
      const byId = new Map((prev || []).map((x) => [x.id, x]));
      for (const a of fetched) byId.set(a.id, Object.assign({}, byId.get(a.id), a));
      merged = [...byId.values()];
    }
    return merged.filter((a) => (a.created || 0) >= minDate).sort((a, b) => (b.created || 0) - (a.created || 0));
  };

  // ---- The sync engine -------------------------------------------------------

  MAK.createSync = function (opts) {
    const api = opts.api;
    const store = opts.store;
    const lockArea = opts.lockArea || null;
    const now = opts.now || (() => Date.now());
    const pauseMs = opts.pauseMs === undefined ? 300 : opts.pauseMs;
    const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
    let running = null;

    function isDue(meta) {
      const t = now();
      const idle = meta.lastUse ? t - meta.lastUse > IDLE_AFTER_MS : false;
      return t - (meta.lastSync || 0) >= (idle ? IDLE_ROUTINE_MS : ROUTINE_MS);
    }

    async function takeLock() {
      if (!lockArea) return true;
      const { syncLock } = await lockArea.get('syncLock');
      if (syncLock && syncLock > now()) return false;
      await lockArea.set({ syncLock: now() + LOCK_MS });
      return true;
    }

    async function releaseLock() {
      if (lockArea) await lockArea.set({ syncLock: 0 });
    }

    // Remove all the course data and the reading state, and from the settings what the user wrote about
    // their studies (the grades and the weights of the calculator, the address of the forward): not for
    // the next user of this browser. Keep the other settings.
    async function clearData() {
      await store.transaction(async (tx) => {
        const all = await tx.get(null);
        const keys = Object.keys(all).filter((k) => MAK.DATA_KEYS.includes(k) || k.startsWith(MAK.RESOURCE_PREFIX));
        if (keys.length) await tx.remove(keys);
        const meta = all.meta || {};
        await tx.set({ meta: { installedAt: meta.installedAt || now() } });
        if (all.settings) await tx.set({ settings: Object.assign({}, all.settings, { guideGrades: {}, guideWeights: {}, forwardEmail: '' }) });
      });
    }

    // One sync at a time. A request for specific sites, or a forced request, waits for the
    // current sync and then runs. Other requests get the result of the current sync.
    async function run(options) {
      const o = options || {};
      if (running) {
        if (o.force || (o.siteIds && o.siteIds.length)) return running.then(() => run(o));
        return running;
      }
      running = runOnce(o).finally(() => { running = null; });
      return running;
    }

    async function runOnce(o) {
      const st = await store.get(['paused', 'settings', 'meta']);
      if (st.paused) return { skipped: 'paused' };
      const settings = MAK.withDefaults(st.settings);
      if (!settings.syncEnabled) return { skipped: 'disabled' };
      let meta = Object.assign({}, st.meta);
      // After a server error, wait. Also a manual refresh waits, so that it does not add load.
      if (meta.backoffUntil && now() < meta.backoffUntil) return { skipped: 'backoff' };
      if (!o.force && !(o.siteIds && o.siteIds.length) && !isDue(meta)) return { skipped: 'not-due' };
      if (!(await takeLock())) return { skipped: 'locked' };

      const t = now();
      const result = { steps: {}, errors: [] };
      const hidden = MAK.hiddenEverywhere(settings);
      let full = !!o.full || !meta.lastFullSync || t - meta.lastFullSync >= FULL_MS;
      meta.stale = Object.assign({}, meta.stale);
      meta.baselined = Object.assign({}, meta.baselined);
      if (!meta.installedAt) meta.installedAt = t;

      async function step(name, fn) {
        try {
          await fn();
          result.steps[name] = 'ok';
          delete meta.stale[name];
        } catch (e) {
          result.steps[name] = 'error';
          result.errors.push(name);
          meta.stale[name] = t;
          if (e && e.retryLater) throw e;
        }
        if (pauseMs) await sleep(pauseMs);
      }

      try {
        // 1. Session. Stop if the user is not logged in. Keep the old data.
        let session = null;
        try {
          session = await api.session();
        } catch (e) {
          // A login page (HTML) or 401/403 means that the session is not active.
          if (!(e && (e.kind === 'not-json' || e.status === 401 || e.status === 403))) throw e;
        }
        if (!session || !session.userId) {
          meta.loggedIn = false;
          await store.set({ meta });
          return { skipped: 'logged-out' };
        }
        if (meta.userId && meta.userId !== session.userId) {
          await clearData();
          meta = { installedAt: meta.installedAt, stale: {}, baselined: {} };
          full = true; // Get all the data of the new user.
        }
        meta.userId = session.userId;
        meta.loggedIn = true;
        if (pauseMs) await sleep(pauseMs);

        // 2. Sites and the pages of each site (for links and tool ids).
        let { sites, pages } = await store.get(['sites', 'pages']);
        if (!Array.isArray(sites) || !meta.sitesAt || t - meta.sitesAt >= SITES_MS) {
          await step('sites', async () => {
            sites = (await api.sites()).filter((s) => s && !MAK.isSpecialSite(s.id)).map(MAK.trimSite);
            await store.set({ sites });
            meta.sitesAt = t;
          });
        }
        sites = Array.isArray(sites) ? sites : [];
        pages = pages && typeof pages === 'object' ? pages : {};
        const visible = sites.filter((s) => !hidden.has(s.id));
        for (const s of visible) {
          // Pages from 1.3 have no menu, and pages from 1.5.0 have no "guide": get them again.
          if (pages[s.id] && pages[s.id].nav && 'guide' in pages[s.id] && t - pages[s.id].at < PAGES_MS) continue;
          await step(`pages:${s.id}`, async () => {
            pages[s.id] = MAK.trimPages(await api.pages(s.id), t);
            await store.update('pages', (cur) => Object.assign({}, cur, { [s.id]: pages[s.id] }));
          });
        }

        // 3. Deliveries.
        await step('assignments', async () => {
          const list = (await api.assignments()).filter((a) => a && !a.draft).map(MAK.trimAssignment);
          await store.update('assignments', (prev) => MAK.trackFeedback(MAK.trackDueChanges(withSeen(list, prev, (x) => x.id, t, !meta.baselined.asg), prev, t, !meta.baselined.asg), prev, t, !meta.baselined.asg));
          meta.baselined.asg = true;
        });

        // 4. Unread private messages and forum posts, per site.
        let synoptic = [];
        await step('synoptic', async () => {
          synoptic = (await api.synoptic()).map(MAK.trimSynoptic);
          await store.set({ synoptic });
        });

        // 4b. Grades of all sites. The new grades go to opts.onNewGrades (not on the first fetch).
        await step('grades', async () => {
          const fetched = (await api.grades()).map(MAK.trimGrade).filter(Boolean);
          let changed = [];
          await store.update('grades', (prev) => {
            // The time is taken here, inside the write, so that "seen" and "new" stay in order.
            const r = MAK.mergeGrades(prev, fetched, now(), !meta.baselined.grades);
            changed = r.changed;
            return r.list;
          });
          meta.baselined.grades = true;
          if (changed.length && opts.onNewGrades) await opts.onNewGrades(changed);
        });

        // 4c. Calendar events of the week view (every 6 hours, and on a full sync).
        if (full || !meta.calendarAt || t - meta.calendarAt >= CALENDAR_MS) {
          await step('calendar', async () => {
            const from = MAK.startOfWeek(t);
            const events = (await api.calendar(MAK.ymd(from), MAK.ymd(from + CALENDAR_DAYS * DAY))).map(MAK.trimEvent);
            await store.set({ events });
            meta.calendarAt = t;
          });
        }

        // 5. Notifications of the bell (read state of announcements).
        await step('notifications', async () => {
          const list = (await api.notifications()).map(MAK.trimNotification);
          await store.set({ notifications: list });
        });

        // 6. Announcements: a small fetch each time, a full fetch every 4 hours.
        await step('announcements', async () => {
          const fetched = (full ? await api.announcements(200, ANNOUNCEMENT_DAYS) : await api.announcements(30, 7)).map(MAK.trimAnnouncement);
          const merge = (prev) => MAK.mergeAnnouncements(prev, fetched, full, t - ANNOUNCEMENT_DAYS * DAY);
          await store.update('announcements', (prev) => withSeen(merge(prev), prev, (x) => x.id, t, !meta.baselined.ann));
          meta.baselined.ann = true;
          if (full) {
            // Remove the read state of announcements that are not in the list.
            const { announcements } = await store.get('announcements');
            const ids = new Set((announcements || []).map((a) => a.id));
            await store.update('readAnn', (r) => {
              const out = {};
              for (const [k, v] of Object.entries(r || {})) if (ids.has(k)) out[k] = v;
              return out;
            });
          }
        });

        // 7. Forum topics: sites with unread posts, the requested sites, all sites on a full sync.
        const askSites = new Set((o.siteIds || []).filter((id) => !hidden.has(id)));
        const forumSites = new Set(askSites);
        for (const x of synoptic) if (x.forums > 0 && !hidden.has(x.siteId)) forumSites.add(x.siteId);
        if (full) for (const s of visible) if (pages[s.id] && pages[s.id].tools['sakai.forums']) forumSites.add(s.id);
        for (const siteId of forumSites) {
          if (!pages[siteId] || !pages[siteId].tools['sakai.forums']) continue;
          await step(`forums:${siteId}`, async () => {
            const topics = [];
            for (const f of (await api.forums(siteId)).slice(0, MAX_FORUMS_PER_SITE)) {
              const detail = await api.forum(siteId, f.id);
              for (const tp of (detail && Array.isArray(detail.topics) ? detail.topics : [])) topics.push(MAK.trimTopic(tp, f));
              if (pauseMs) await sleep(pauseMs);
            }
            await store.update('forums', (cur) => Object.assign({}, cur, { [siteId]: { at: t, topics } }));
          });
        }

        // 8. Files: the requested sites, and all sites on a full sync.
        const fileSites = new Set(askSites);
        if (full) for (const s of visible) if (pages[s.id] && pages[s.id].tools['sakai.resources']) fileSites.add(s.id);
        for (const siteId of fileSites) {
          await step(`resources:${siteId}`, async () => {
            const items = (await api.resources(siteId)).map((r) => MAK.trimResource(r, siteId)).filter(Boolean);
            const key = MAK.resourceKey(siteId);
            await store.update(key, (prev) => ({ at: t, items: withSeen(items, prev && prev.items, (x) => x.url, t, !meta.baselined[key]) }));
            meta.baselined[key] = true;
          });
        }

        // 9. Lessons ("Contenidos", for the search): the sites with the tool, on a full sync, and
        // a site without them or with old ones (the first sync after an update). A site whose
        // Lessons give an error of the server has no parts (some sites give it each time).
        {
          const empty = (e) => { if (e && e.status >= 500) return null; throw e; };
          const { lessons: stored } = await store.get('lessons');
          for (const s of visible) {
            if (!pages[s.id] || !pages[s.id].tools['sakai.lessonbuildertool']) continue;
            const old = stored && stored[s.id];
            if (!full && old && t - old.at < FULL_MS) continue;
            await step(`lessons:${s.id}`, async () => {
              const items = [];
              for (const l of ((await api.lessons(s.id).catch(empty)) || []).slice(0, MAX_LESSONS_PER_SITE)) {
                if (!l || l.hidden || (MAK.toMs(l.releaseDate) || 0) > t) continue;
                const tree = await api.lesson(l.id).catch(empty);
                items.push(...MAK.trimLessonTree(tree, l.lessonTitle));
                if (pauseMs) await sleep(pauseMs);
              }
              await store.update('lessons', (cur) => Object.assign({}, cur, { [s.id]: { at: t, items: items.slice(0, 300) } }));
            });
          }
        }

        // The sync is complete: an old error outside the steps is gone. The steps of a site that is
        // hidden or removed do not run again, so its errors go too.
        delete meta.stale.session;
        const visibleIds = new Set(visible.map((s) => s.id));
        for (const name of Object.keys(meta.stale)) {
          const m = /^(?:pages|forums|resources):(.*)$/.exec(name);
          if (m && !visibleIds.has(m[1])) delete meta.stale[name];
        }

        meta.lastSync = t;
        if (full) meta.lastFullSync = t;
        meta.backoffStep = 0;
        meta.backoffUntil = 0;
      } catch (e) {
        if (e && e.retryLater) {
          meta.backoffStep = (meta.backoffStep || 0) + 1;
          meta.backoffUntil = t + Math.min(2 ** meta.backoffStep * MINUTE, HOUR);
          result.backoff = meta.backoffUntil;
        } else {
          result.errors.push('session');
          meta.stale.session = t;
        }
      } finally {
        await store.set({ meta });
        await releaseLock();
      }
      result.full = full;
      return result;
    }

    // Record that the user used the extension (the sync is faster after this).
    async function touch() {
      await store.update('meta', (m) => Object.assign({}, m, { lastUse: now() }));
    }

    return { run, touch, clearData };
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
