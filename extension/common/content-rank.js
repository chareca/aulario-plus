// Aulario Plus: the rank of the average of the user (lib/record.js) in the bar of MiAulario, at the left of
// the photo of the user, when the extension has read the Expediente and the setting "rankBar" is on. Only the
// name of the rank (the average is not on the screen for everybody), with a ring when something went up. A
// click: the window with the average, what went up, the credits and the next goal, and "Actualizar notas"
// (first the window that says why the Expediente opens). At the end of a reading that the user asked for in
// this tab (or in the popup, with this tab active): the same window, with confetti if something went up.
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const HOST_ID = 'mak-rank-host';
  const send = (msg) => MAK.safeCall(() => ext.runtime.sendMessage(msg), null);
  const read = async () => {
    const d = await MAK.safeCall(() => ext.storage.local.get(['record', 'recordSeen', 'settings']), {});
    const settings = MAK.withDefaults(d.settings);
    MAK.setLang(settings.lang);
    return { record: d.record, seen: d.recordSeen, settings };
  };
  let shadow = null;

  // The bar of Sakai 23: ul#sakai-system-indicators > li > button.sak-sysInd-account (the photo).
  function draw({ record, seen, settings }) {
    const photo = document.querySelector('#sakai-system-indicators .sak-sysInd-account');
    const sum = MAK.recordSummary(record);
    let host = document.getElementById(HOST_ID);
    if (!sum || !settings.rankBar || !photo || !photo.closest('li')) return host && host.remove();
    if (!host) {
      const box = MAK.h('span', { attrs: { style: 'display: flex; align-items: center' } }); // a <li> cannot have a shadow root
      host = MAK.h('li', { attrs: { id: HOST_ID, style: 'display: flex; align-items: center' } }, box);
      shadow = box.attachShadow({ mode: 'closed' });
      shadow.append(MAK.themedStyle(`:host { all: initial; display: flex; align-items: center; }
        ${MAK.RANK_CSS}
        button.mak-rank { cursor: pointer; font: 700 calc(13px * var(--ap-zoom))/1.3 var(--ap-font); }
        button.mak-rank:focus-visible { outline: 2px solid var(--ap-fg); outline-offset: 2px; }`));
    }
    const news = !!MAK.recordGain(record, seen);
    const pill = MAK.rankPill(sum, 'button', true);
    pill.type = 'button';
    pill.title = MAK.t(news ? 'record.badgeNew' : 'record.badge');
    pill.classList.toggle('new', news);
    pill.addEventListener('click', showRank);
    const old = shadow.querySelector('button');
    if (old) old.replaceWith(pill);
    else shadow.append(pill);
    if (host.nextElementSibling !== photo.closest('li')) photo.closest('li').before(host);
  }

  async function openRecord() {
    if (await MAK.askWindow(MAK.t('record.askTitle'), MAK.t('record.ask'), MAK.t('record.open'), MAK.t('record.back'))) send({ type: 'recordOpen' });
  }

  // The window of the rank. title: its title; yes: "Actualizar notas", or null (only "Cerrar"). Then the
  // user saw it: what went up is not news any more.
  async function rankWindow(title, update) {
    const d = await read();
    if (!MAK.recordSummary(d.record)) return;
    const gain = MAK.recordGain(d.record, d.seen);
    const asked = MAK.askWindow(title, MAK.rankView(d.record, d.seen), MAK.t(update ? 'record.update' : 'record.close'), update ? MAK.t('record.close') : null);
    send({ type: 'recordSeen' });
    if (gain && d.settings.confetti && typeof window.confetti === 'function' && MAK.celebrate) MAK.celebrate(gain.rankUp ? 'exam' : 'task', window.confetti.create, document);
    if ((await asked) && update) openRecord();
  }
  const showRank = () => rankWindow(MAK.t('record.rankTitle'), true);

  const redraw = () => read().then(draw);
  redraw();
  ext.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && MAK.extensionAlive() && (changes.record || changes.recordSeen || changes.settings)) redraw();
  });
  // The end of a reading (the background script): the result.
  ext.runtime.onMessage.addListener((msg, sender, reply) => {
    if (!msg || msg.type !== 'recordDone') return;
    rankWindow(MAK.t('record.doneTitle'), false);
    reply(true);
  });
})();
