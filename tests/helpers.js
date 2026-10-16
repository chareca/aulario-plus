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

module.exports = { ROOT, COMMON, loadLib, memoryArea, response, fakeFetch, clone };
