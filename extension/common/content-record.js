// Aulario Plus: the Expediente of SIGMA (lib/record.js). The background script registers this script
// only when the user gives the permission for MiUPNA and SIGMA. In SIGMA, the table "Expediente
// completo" goes to the background script. In the tab of the reading in the background: MiUPNA →
// "Consulta tu Expediente" → "Expediente completo".
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const send = (msg) => Promise.resolve(ext.runtime.sendMessage(msg)).catch(() => null);
  (async () => {
    const record = location.origin === MAK.SIGMA_ORIGIN ? MAK.parseRecord(document) : null;
    if (record) return send({ type: 'recordSave', record });
    if (!(await send({ type: 'recordTab' }))) return; // a page that the user opened: nothing more
    const next = location.origin === MAK.PORTAL_ORIGIN ? MAK.recordEntry(document) : MAK.recordMenuLink(document);
    if (next) location.assign(next);
  })();
})();
