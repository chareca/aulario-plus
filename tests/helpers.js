// Helpers for the Node tests: load the shared scripts, a storage area in memory,
// and a fetch function that returns MiAulario responses from the synthetic fixtures.
'use strict';
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const COMMON = path.join(ROOT, 'extension', 'common');

function loadLib(...names) {
  for (const n of names) require(path.join(COMMON, 'lib', `${n}.js`));
  return globalThis.MAK;
}

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// A storage area with the same interface as chrome.storage.local.
function memoryArea(initial = {}) {
  const data = clone(initial);
  return {
    data,
    async get(keys) {
      if (keys === null || keys === undefined) return clone(data);
      if (typeof keys === 'string') keys = [keys];
      if (Array.isArray(keys)) {
        const out = {};
        for (const k of keys) if (k in data) out[k] = clone(data[k]);
        return out;
      }
      const out = {};
      for (const [k, d] of Object.entries(keys)) out[k] = k in data ? clone(data[k]) : d;
      return out;
    },
    async set(obj) {
      for (const [k, v] of Object.entries(obj)) data[k] = clone(v);
    },
    async remove(keys) {
      for (const k of [].concat(keys)) delete data[k];
    }
  };
}

function response(body, { status = 200, type = 'application/json', url } = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: { get: (h) => (h.toLowerCase() === 'content-type' ? type : null) },
    json: async () => JSON.parse(text),
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer
  };
}

// fetch that answers from a map: path without "auto=true" -> body, function or response.
function fakeFetch(routes, log = []) {
  return async (url, init = {}) => {
    const u = new URL(url);
    u.searchParams.delete('auto');
    const key = u.pathname + (u.searchParams.toString() ? `?${u.searchParams}` : '');
    log.push({ url, key, method: init.method || 'GET' });
    let route = routes[key];
    if (route === undefined) route = routes[u.pathname];
    if (route === undefined) return response({ error: 'not found' }, { status: 404 });
    if (typeof route === 'function') route = await route(url, init);
    if (route && route.__response) return route.__response;
    return response(route);
  };
}
fakeFetch.raw = (resp) => ({ __response: resp });

// A small copy of the extension API (chrome.*) for tests.
function mockExtension({ id = 'ext-id', local = {} } = {}) {
  const listeners = { message: [], alarm: [], installed: [], startup: [], cookies: [], storage: [], noteClick: [] };
  const alarms = new Map();
  const on = (list) => ({ addListener: (f) => list.push(f), removeListener: (f) => list.splice(list.indexOf(f), 1) });
  const localArea = memoryArea(local);
  const sessionArea = memoryArea();
  const badge = { text: '', color: null };
  const tabsCreated = [];
  const notes = new Map();
  // Send storage.onChanged events, the same as the browser does.
  for (const area of [localArea]) {
    const set = area.set.bind(area);
    const remove = area.remove.bind(area);
    area.set = async (obj) => {
      const changes = {};
      for (const [k, v] of Object.entries(obj)) changes[k] = { oldValue: clone(area.data[k]), newValue: clone(v) };
      await set(obj);
      for (const f of listeners.storage) f(changes, 'local');
    };
    area.remove = async (keys) => {
      const changes = {};
      for (const k of [].concat(keys)) if (k in area.data) changes[k] = { oldValue: clone(area.data[k]) };
      await remove(keys);
      for (const f of listeners.storage) f(changes, 'local');
    };
  }
  return {
    runtime: {
      id,
      getURL: (p = '') => `chrome-extension://${id}/${p}`,
      onMessage: on(listeners.message),
      onInstalled: on(listeners.installed),
      onStartup: on(listeners.startup)
    },
    storage: { local: localArea, session: sessionArea, onChanged: on(listeners.storage) },
    alarms: {
      create: async (name, info) => {
        alarms.set(name, { name, scheduledTime: info.when || Date.now() + (info.delayInMinutes || 0) * 60000, periodInMinutes: info.periodInMinutes });
      },
      get: async (name) => alarms.get(name),
      clear: async (name) => alarms.delete(name),
      onAlarm: on(listeners.alarm)
    },
    cookies: { onChanged: on(listeners.cookies), get: async () => null, set: async () => {}, remove: async () => {} },
    action: {
      setBadgeText: async ({ text }) => { badge.text = text; },
      setBadgeBackgroundColor: async ({ color }) => { badge.color = color; },
      setBadgeTextColor: async () => {},
      setTitle: async ({ title }) => { badge.title = title; }
    },
    tabs: { create: async (o) => { tabsCreated.push(o); return { id: tabsCreated.length }; } },
    notifications: {
      create: async (id, o) => { notes.set(id, o); return id; },
      clear: async (id) => notes.delete(id),
      getAll: async () => Object.fromEntries([...notes.keys()].map((k) => [k, true])),
      onClicked: on(listeners.noteClick)
    },
    _listeners: listeners,
    _notes: notes,
    _alarms: alarms,
    _badge: badge,
    _tabs: tabsCreated
  };
}

// Load background.js and the shared scripts in an isolated context with a mock extension API.
function loadBackground({ fetch, local, now } = {}) {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const ext = mockExtension({ local });
  const sandbox = {
    chrome: ext,
    fetch: fetch || (async () => response({}, { status: 404 })),
    console,
    URL,
    URLSearchParams,
    TextEncoder,
    setTimeout,
    clearTimeout,
    Date: now ? fixedDate(now) : Date
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const src = fs.readFileSync(path.join(COMMON, 'background.js'), 'utf8');
  const libs = [...(/importScripts\(([^)]*)\)/.exec(src) || ['', ''])[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const lib of libs) vm.runInContext(fs.readFileSync(path.join(COMMON, lib), 'utf8'), sandbox, { filename: lib });
  vm.runInContext(src, sandbox, { filename: 'background.js' });
  const send = (msg, sender = { id: ext.runtime.id, url: ext.runtime.getURL('popup.html') }) =>
    new Promise((resolve) => {
      // Copy the answer: objects from the other context have a different prototype.
      const done = (v) => resolve(clone(v));
      const keep = ext._listeners.message.some((f) => f(msg, sender, done) === true);
      if (!keep) setTimeout(() => resolve(undefined), 0);
    });
  const fireAlarm = async (name) => {
    for (const f of ext._listeners.alarm) await f({ name });
  };
  return { ext, sandbox, send, fireAlarm, MAK: sandbox.MAK };
}

// A Date class with a fixed "now", for tests that depend on the time.
function fixedDate(nowRef) {
  const Real = Date;
  const current = typeof nowRef === 'function' ? nowRef : () => nowRef;
  class FixedDate extends Real {
    constructor(...args) {
      if (args.length) super(...args);
      else super(current());
    }
    static now() {
      return current();
    }
  }
  return FixedDate;
}

module.exports = { ROOT, COMMON, loadLib, memoryArea, response, fakeFetch, clone, mockExtension, loadBackground, fixedDate };
