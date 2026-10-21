// Aulario Plus: the Expediente of SIGMA (lib/record.js). The background script injects this script in the
// pages of MiUPNA and SIGMA, only when the user gave the permission for them. In SIGMA, the table of the
// Expediente goes to the background script. In the tab of a reading: MiUPNA → "Consulta tu Expediente" →
// "Año actual" → "Expediente completo".
(function () {
  'use strict';
  // The background script injects it at each load of a page (and in its frames): once in a page.
  if (globalThis.__makRecord) return;
  globalThis.__makRecord = true;
  const ext = globalThis.browser ?? globalThis.chrome;
  const send = (msg) => Promise.resolve(ext.runtime.sendMessage(msg)).catch(() => null);
  // The table and the links can come some moments after the page: look for them for 6 s.
  const waitFor = async (find) => {
    for (let i = 0; i < 12; i++) {
      const r = find(document);
      if (r) return r;
      await new Promise((ok) => setTimeout(ok, 500));
    }
    return null;
  };
  (async () => {
    const sigma = location.origin === MAK.SIGMA_ORIGIN;
    const record = sigma ? await waitFor(MAK.parseRecord) : null;
    const complete = !!record && MAK.recordComplete(document);
    if (record) await send({ type: 'recordSave', record, complete });
    // The tab of a reading: from MiUPNA to SIGMA, then from "Año actual" to "Expediente completo" (the page, not a frame).
    if (complete || window !== window.top || !(await send({ type: 'recordTab' }))) return;
    const next = await waitFor(sigma ? MAK.recordMenuLink : MAK.recordEntry);
    if (next && next !== location.href) location.assign(next);
  })();
})();
