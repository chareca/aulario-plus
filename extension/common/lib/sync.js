// MiAulario Keep-Alive: background sync of course data.
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
  const PAGES_MS = DAY;
  const LOCK_MS = 3 * MINUTE;
  const ANNOUNCEMENT_DAYS = 60;
  const MAX_FORUMS_PER_SITE = 10;

  // Keep "seen" from the previous data. New items get "now", or 0 for the first fetch.
  function withSeen(items, previous, keyOf, now, baseline) {
    const old = new Map((previous || []).map((x) => [keyOf(x), x.seen]));
    return items.map((x) => {
      const k = keyOf(x);
      const seen = old.has(k) ? old.get(k) : baseline ? 0 : now;
      return Object.assign(x, { seen });
    });
  }

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

    // Remove all the course data and the reading state. Keep the settings.
    async function clearData() {
      await store.transaction(async (tx) => {
        const all = await tx.get(null);
        const keys = Object.keys(all).filter((k) => MAK.DATA_KEYS.includes(k) || k.startsWith(MAK.RESOURCE_PREFIX));
        if (keys.length) await tx.remove(keys);
        const meta = all.meta || {};
        await tx.set({ meta: { installedAt: meta.installedAt || now() } });
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
          if (pages[s.id] && t - pages[s.id].at < PAGES_MS) continue;
          await step(`pages:${s.id}`, async () => {
            pages[s.id] = MAK.trimPages(await api.pages(s.id), t);
            await store.update('pages', (cur) => Object.assign({}, cur, { [s.id]: pages[s.id] }));
          });
        }

        // 3. Deliveries.
        await step('assignments', async () => {
          const list = (await api.assignments()).filter((a) => a && !a.draft).map(MAK.trimAssignment);
          await store.update('assignments', (prev) => withSeen(list, prev, (x) => x.id, t, !meta.baselined.asg));
          meta.baselined.asg = true;
        });

        // 4. Unread private messages and forum posts, per site.
        let synoptic = [];
        await step('synoptic', async () => {
          synoptic = (await api.synoptic()).map(MAK.trimSynoptic);
          await store.set({ synoptic });
        });

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
