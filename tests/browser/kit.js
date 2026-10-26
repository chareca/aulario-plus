// A very small test kit for the pages of tests/browser. run.mjs reads window.__results.
(function () {
  'use strict';
  const tests = [];
  window.__results = [];
  window.test = (name, fn) => tests.push({ name, fn });
  const show = (v) => JSON.stringify(v);
  window.assert = {
    ok(v, msg) {
      if (!v) throw new Error(msg || `expected a true value, got ${show(v)}`);
    },
    equal(a, b, msg) {
      if (a !== b) throw new Error(`${msg ? `${msg}: ` : ''}${show(a)} !== ${show(b)}`);
    },
    deepEqual(a, b, msg) {
      if (show(a) !== show(b)) throw new Error(`${msg ? `${msg}: ` : ''}${show(a)} is not ${show(b)}`);
    },
    async rejects(promise, code) {
      try {
        await promise;
      } catch (e) {
        if (code && e.code !== code) throw new Error(`expected the error ${code}, got ${e.code || e.message}`);
        return;
      }
      throw new Error(`expected the error ${code}`);
    }
  };
  // HTML text -> a document, as the extension does with a response of MiAulario.
  window.parse = (html) => new DOMParser().parseFromString(html, 'text/html');
  // A file of tests or a library that does not load (a syntax error): a test that fails (else its tests are only missing).
  window.addEventListener('error', (e) => window.__results.push({ name: `load: ${e.filename || 'a script'}`, ok: false, error: e.message }));
  window.addEventListener('load', async () => {
    for (const t of tests) {
      try {
        await t.fn();
        window.__results.push({ name: t.name, ok: true });
      } catch (e) {
        window.__results.push({ name: t.name, ok: false, error: String(e && e.message ? e.message : e) });
      }
    }
    window.__done = true;
  });
})();
