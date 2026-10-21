// Aulario Plus: the rank of the average of the user (lib/record.js) in the bar of MiAulario, at the left of
// the photo of the user, when the extension has read the Expediente. A click: the average, the rank, and
// "Actualizar notas" (first the window that says why the Expediente opens). At the end of a reading that
// the user asked for in this tab (or in the popup, with this tab active): the result in a window.
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const HOST_ID = 'mak-rank-host';
  const send = (msg) => MAK.safeCall(() => ext.runtime.sendMessage(msg), null);
  const read = () => MAK.safeCall(() => ext.storage.local.get(['record', 'settings']), {});
  let shadow = null;

  // The bar of Sakai 23: ul#sakai-system-indicators > li > button.sak-sysInd-account (the photo).
  function draw(record) {
    const photo = document.querySelector('#sakai-system-indicators .sak-sysInd-account');
    const sum = MAK.recordSummary(record);
    let host = document.getElementById(HOST_ID);
    if (!sum || !photo || !photo.closest('li')) return host && host.remove();
    if (!host) {
      const box = MAK.h('span', { attrs: { style: 'display: flex; align-items: center' } }); // a <li> cannot have a shadow root
      host = MAK.h('li', { attrs: { id: HOST_ID, style: 'display: flex; align-items: center' } }, box);
      shadow = box.attachShadow({ mode: 'closed' });
      shadow.append(MAK.themedStyle(`:host { all: initial; display: flex; align-items: center; }
        ${MAK.RANK_CSS}
        button.mak-rank { cursor: pointer; font: 700 calc(13px * var(--ap-zoom))/1.3 var(--ap-font); }
        button.mak-rank:focus-visible { outline: 2px solid var(--ap-fg); outline-offset: 2px; }`));
    }
    const pill = MAK.rankPill(sum, 'button');
    pill.type = 'button';
    pill.title = MAK.t('record.badge');
    pill.addEventListener('click', showRank);
    const old = shadow.querySelector('button');
    if (old) old.replaceWith(pill);
    else shadow.append(pill);
    if (host.nextElementSibling !== photo.closest('li')) photo.closest('li').before(host);
  }

  async function openRecord() {
    if (await MAK.askWindow(MAK.t('record.askTitle'), MAK.t('record.ask'), MAK.t('record.open'), MAK.t('record.back'))) send({ type: 'recordOpen' });
  }

  async function showRank() {
    const sum = MAK.recordSummary((await read()).record);
    if (sum && (await MAK.askWindow(MAK.t('record.rankTitle'), MAK.rankView(sum), MAK.t('record.update'), MAK.t('record.close')))) openRecord();
  }

  read().then((d) => {
    MAK.setLang(d.settings && d.settings.lang);
    draw(d.record);
  });
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !MAK.extensionAlive()) return;
    if (changes.settings) MAK.setLang(changes.settings.newValue && changes.settings.newValue.lang);
    if (changes.record || changes.settings) read().then((d) => draw(d.record));
  });
  // The end of a reading (the background script): the result.
  ext.runtime.onMessage.addListener((msg, sender, reply) => {
    if (!msg || msg.type !== 'recordDone') return;
    read().then((d) => {
      const sum = MAK.recordSummary(d.record);
      draw(d.record);
      if (sum) MAK.askWindow(MAK.t('record.doneTitle'), MAK.rankView(sum), MAK.t('record.close'), null);
    });
    reply(true);
  });
})();
