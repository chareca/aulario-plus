// Aulario Plus: the grade calculator of a course guide (the button of the calculator next to the
// arrow of a guide, content-guide.js). A window with the activities of the guide that have a weight:
// the user writes the grades of the activities that are done, and the window tells the grade that is
// necessary in the other activities to pass (5), with the minimum of each activity, and the final
// grade with that. With all the grades: the final grade. The grades stay (the background saves them in the settings,
// "guideGrades"); "Limpiar todo" removes them. Nothing goes to MiAulario.
(function () {
  'use strict';
  const ext = globalThis.browser ?? globalThis.chrome;
  const h = MAK.h;
  const t = (k, p) => MAK.t(k, p);
  const send = (msg) => MAK.safeCall(() => ext.runtime.sendMessage(msg), null);
  const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString(MAK.locale(), { maximumFractionDigits: 2 });

  const CSS = `
    :host { all: initial; }
    .backdrop { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: flex-start; justify-content: center;
      padding-top: 6vh; background: rgba(0, 0, 0, 0.35); }
    .win { width: min(620px, calc(100vw - 32px)); max-height: 88vh; overflow: auto; box-sizing: border-box; padding: 14px 18px;
      font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1d2327; background: #fff;
      border-radius: 10px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3); }
    .dark .win { color: #e8ecee; background: #1e2a28; }
    header { display: flex; align-items: center; gap: 8px; }
    h2 { flex: 1; margin: 0; font-size: 16px; }
    button.x { font: inherit; font-size: 18px; line-height: 1; background: none; border: 0; padding: 2px 6px; cursor: pointer; color: inherit; }
    .meta { color: #5f6b73; font-size: 12px; } .dark .meta { color: #9aa6ad; }
    .help { margin: 4px 0 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-size: 12px; font-weight: 600; color: #5f6b73; padding: 4px; } .dark th { color: #9aa6ad; }
    td { padding: 6px 4px; border-top: 1px solid #e1e8e6; vertical-align: middle; }
    .dark td { border-color: #2e4440; }
    td.w { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; width: 3.5em; }
    td.g { width: 5.5em; }
    td.s { font-size: 12px; width: 9.5em; }
    .tag { font-size: 11px; color: #5f6b73; } .dark .tag { color: #9aa6ad; }
    input { font: inherit; box-sizing: border-box; width: 4.8em; padding: 5px 7px; border: 1px solid #b9c9c5; border-radius: 6px;
      background: #fff; color: inherit; text-align: right; font-variant-numeric: tabular-nums; }
    .dark input { background: #15201e; border-color: #3a524d; }
    input.bad { border-color: #c5221f; outline: 1px solid #c5221f; }
    .need { color: #10524e; font-weight: 600; } .dark .need { color: #4fd1a5; }
    .low { color: #c5221f; } .dark .low { color: #f28b82; }
    .ok { color: #137333; } .dark .ok { color: #81c995; }
    .sum { margin: 12px 0 0; padding: 10px 12px; border-radius: 8px; background: #f3f8f7; border: 1px solid #d6e3e0; }
    .dark .sum { background: #15201e; border-color: #2e4440; }
    .sum p { margin: 2px 0; }
    .big { font-size: 18px; font-weight: 700; }
    .row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
    button.plain { font: inherit; font-size: 13px; background: none; border: 1px solid #b9c9c5; border-radius: 6px; padding: 4px 12px; cursor: pointer; color: inherit; }
    .dark button.plain { border-color: #3a524d; }
  `;

  let open = null;

  // site: { id, name }. rows: the rows of the assessment of the guide.
  MAK.openGuideCalc = async function ({ site, rows }) {
    if (open) return;
    const raw = (await MAK.safeCall(() => ext.storage.local.get('settings'), null)) || {};
    const settings = MAK.withDefaults(raw.settings);
    MAK.setLang(settings.lang);
    const grades = Object.assign({}, settings.guideGrades[site.id]);
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    const close = () => {
      host.remove();
      open = null;
    };

    let timer = null;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => send({ type: 'setGuideGrades', siteId: site.id, grades }), 300);
    };

    const base = MAK.guideCalc(rows, {});
    const lines = base.rows.map((r) => {
      const input = h('input', { attrs: { type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '–', 'aria-label': t('gcalc.gradeOf', { activity: r.activity }) } });
      if (typeof grades[r.activity] === 'number') input.value = fmt(grades[r.activity]);
      const state = h('td', { class: 's' });
      input.addEventListener('input', () => {
        const v = input.value.trim();
        const n = MAK.parseGrade(v);
        input.classList.toggle('bad', !!v && n === null);
        if (n === null) delete grades[r.activity];
        else grades[r.activity] = n;
        draw();
        save();
      });
      return {
        activity: r.activity,
        input,
        state,
        tr: h('tr', null,
          h('td', null, r.activity, r.minimum !== null ? h('div', { class: 'tag', text: t('gcalc.minimum', { n: fmt(r.minimum) }) }) : null),
          h('td', { class: 'w', text: `${fmt(r.weight)} %` }),
          h('td', { class: 'g' }, input),
          state)
      };
    });

    const summary = h('div', { class: 'sum', attrs: { role: 'status', 'aria-live': 'polite' } });
    function draw() {
      const c = MAK.guideCalc(rows, grades);
      c.rows.forEach((r, i) => {
        const cell = lines[i].state;
        cell.className = 's';
        if (r.grade !== null) {
          cell.textContent = r.below ? t('gcalc.belowMin') : '';
          cell.classList.toggle('low', r.below);
        } else if (!c.reachable) {
          cell.textContent = t('gcalc.needTen');
          cell.classList.add('low');
        } else {
          cell.textContent = t('gcalc.needHere', { n: fmt(r.plan) });
          cell.classList.add('need');
        }
      });
      const filled = c.rows.filter((r) => r.grade !== null).length;
      const below = c.rows.filter((r) => r.below).map((r) => r.activity);
      const parts = [];
      if (c.complete) {
        parts.push(h('p', { class: 'big' }, t('gcalc.final', { n: fmt(c.final) }), ' · ', h('span', { class: c.passed ? 'ok' : 'low', text: t(c.passed ? 'gcalc.passed' : 'gcalc.failed') })));
      } else if (!filled) {
        parts.push(h('p', { text: t('gcalc.start') }));
      } else if (!c.reachable) {
        parts.push(h('p', { class: 'low', text: t('gcalc.unreachable', { n: fmt(c.projected) }) }));
      } else if (c.need === 0) {
        parts.push(h('p', { class: 'ok', text: t('gcalc.alreadyPass') }));
        parts.push(h('p', { text: t('gcalc.projectedMin', { n: fmt(c.projected) }) }));
      } else {
        parts.push(h('p', null, t('gcalc.needRest'), ' ', h('span', { class: 'need big', text: fmt(c.need) })));
        parts.push(h('p', { text: t('gcalc.projected', { n: fmt(c.projected) }) }));
      }
      if (below.length) parts.push(h('p', { class: 'low', text: t('gcalc.belowList', { list: below.join(', ') }) }));
      if (Math.abs(c.total - 100) > 0.01) parts.push(h('p', { class: 'meta', text: t('gcalc.total', { n: fmt(c.total) }) }));
      MAK.fill(summary, parts);
    }

    const clear = h('button', { class: 'plain', text: t('gcalc.clear'), attrs: { type: 'button' }, on: { click: () => {
      for (const k of Object.keys(grades)) delete grades[k];
      for (const l of lines) {
        l.input.value = '';
        l.input.classList.remove('bad');
      }
      draw();
      save();
      if (lines[0]) lines[0].input.focus();
    } } });

    const title = `🧮 ${t('gcalc.title', { site: site.name })}`;
    const win = h('div', { class: 'win', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': title } },
      h('header', null, h('h2', { text: title }), h('button', { class: 'x', text: '✕', attrs: { type: 'button', title: t('mail.close'), 'aria-label': t('mail.close') }, on: { click: close } })),
      h('p', { class: 'help meta', text: t('gcalc.help') }),
      lines.length
        ? h('table', null,
          h('thead', null, h('tr', null, h('th', { text: t('guide.activity') }), h('th', { class: 'w', text: t('guide.weight') }), h('th', { text: t('gcalc.grade') }), h('th'))),
          h('tbody', null, lines.map((l) => l.tr)))
        : h('p', { text: t('gcalc.noWeights') }),
      lines.length ? summary : null,
      lines.length ? h('div', { class: 'row' }, clear) : null);
    const backdrop = h('div', { class: `backdrop${MAK.isDarkPage() ? ' dark' : ''}` }, win);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
    // The keys stay in the window: the page (the shortcuts of MiAulario) does not get them.
    backdrop.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') close();
    });
    shadow.append(style, backdrop);
    document.documentElement.append(host);
    open = host;
    draw();
    const first = lines.find((l) => !l.input.value) || lines[0];
    if (first) first.input.focus();
  };
})();
