// Aulario Plus: the Expediente of SIGMA (lib/record.js). The background script injects this script in the
// pages of MiUPNA and SIGMA, only when the user gave the permission for them. In SIGMA, the table of the
// Expediente goes to the background script. In the window (or the tab) of a reading: MiUPNA → "Consulta tu
// Expediente" → the first view of SIGMA ("Año actual") → once "Expediente completo"; after its table, the
// background script closes it.
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
    if (record) await send({ type: 'recordSave', record });
    // The page (not a frame) of a reading goes on if the background script says so: all the views of SIGMA
    // have the same address (".../Controlador/"), so only the background script knows the step.
    if (window !== window.top || !(await send({ type: 'recordTab', sigma }))) return;
    const next = await waitFor(sigma ? MAK.recordMenuLink : MAK.recordEntry);
    if (next) location.assign(next);
  })();
})();
