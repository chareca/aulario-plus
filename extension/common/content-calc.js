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

  // The look comes from the theme (lib/themes.js, MAK.themedStyle) and MAK.WIN_CSS.
  const CSS = () => `${MAK.WIN_CSS()}
    .help { margin: 0 0 10px; }
    td.w { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; width: 5.4em; }
    td.g { width: 5.5em; }
    td.s { font-size: 0.86em; width: 9.5em; }
    .tag { font-size: 0.8em; color: var(--ap-muted); }
    input { width: 4.8em; text-align: right; font-variant-numeric: tabular-nums; }
    input.bad { border-color: var(--ap-red); outline: 1px solid var(--ap-red); }
    input.weight { width: 3.6em; }
    input.weight.changed { border-color: var(--ap-orange); }
    input.book { color: var(--ap-blue); }
    .book-status { margin: 8px 0 0; }
    .need { font-weight: 700; }
    .sum { margin: 12px 0 0; padding: 12px 14px; border-radius: var(--ap-radius-box); background: var(--ap-accent-soft); color: var(--ap-fg); border: var(--ap-bw-sm) solid var(--ap-line); }
    .sum p { margin: 2px 0; }
    .big { font-family: var(--ap-font-num); font-size: 1.35em; font-weight: 700; }
    .need.big { font-size: 1.8em; }
    .row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
  `;

  let open = null;
  // Firefox: content.fetch sends the request as the page. Chromium: fetch does this.
  const pageFetch = globalThis.content && typeof globalThis.content.fetch === 'function' ? globalThis.content.fetch.bind(globalThis.content) : fetch;

  // The grades of the gradebook of the site for the activities of the guide, or null. This page is
  // activity in MiAulario (as a visit of the user), so it is read only when the user opens the window.
  async function bookGrades(placement, rows) {
    if (!placement) return null;
    try {
      const r = await pageFetch(`/portal/tool/${encodeURIComponent(placement)}`, { credentials: 'include', cache: 'no-store' });
      if (!r.ok) return null;
      const data = MAK.extractGradebookRows(new DOMParser().parseFromString(await r.text(), 'text/html'));
      return data.found ? MAK.guideBookGrades(rows, MAK.buildGradebook(data)) : null;
    } catch {
      return null;
    }
  }

  // site: { id, name }. rows: the rows of the assessment of the guide.
  MAK.openGuideCalc = async function ({ site, rows }) {
    if (open) return;
    const raw = (await MAK.safeCall(() => ext.storage.local.get(['settings', 'pages']), null)) || {};
    const settings = MAK.withDefaults(raw.settings);
    MAK.setLang(settings.lang);
    const grades = Object.assign({}, settings.guideGrades[site.id]); // what the user wrote
    const weights = Object.assign({}, settings.guideWeights[site.id]);
    let book = {}; // the grades of the gradebook, for the activities without a grade of the user
    const tool = raw.pages && raw.pages[site.id] && raw.pages[site.id].tools && raw.pages[site.id].tools['sakai.gradebookng'];
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = MAK.themedStyle(CSS());
    const close = () => {
      host.remove();
      open = null;
    };

    let timer = null;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => send({ type: 'setGuideGrades', siteId: site.id, grades, weights }), 300);
    };
    // The grades for the calculation: the ones of the user, else the ones of the gradebook.
    const current = () => Object.assign({}, book, grades);

    const lines = MAK.guideCalc(rows, {}, {}).rows.map((r) => {
      const input = h('input', { attrs: { type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '–', 'aria-label': t('gcalc.gradeOf', { activity: r.activity }) } });
      const weight = h('input', { class: 'weight', attrs: { type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '0', 'aria-label': t('gcalc.weightOf', { activity: r.activity }) } });
      const state = h('td', { class: 's' });
      const line = { activity: r.activity, guideWeight: r.guideWeight, input, weight, state };
      input.addEventListener('input', () => {
        const v = input.value.trim();
        const n = MAK.parseGrade(v);
        input.classList.toggle('bad', !!v && n === null);
        input.classList.remove('book');
        if (n === null) delete grades[r.activity];
        else grades[r.activity] = n;
        draw();
        save();
      });
      weight.addEventListener('input', () => {
        const v = weight.value.trim();
        const n = v === '' ? 0 : MAK.parseWeight(v);
        weight.classList.toggle('bad', n === null);
        if (n === null) return;
        if (n === r.guideWeight) delete weights[r.activity];
        else weights[r.activity] = n;
        draw();
        save();
      });
      line.tr = h('tr', null,
        h('td', null, r.activity, r.minimum !== null ? h('div', { class: 'tag', text: t('gcalc.minimum', { n: fmt(r.minimum) }) }) : null),
        h('td', { class: 'w' }, weight, ' %'),
        h('td', { class: 'g' }, input),
        state);
      return line;
    });
    // The inputs from the values: the grades of the user, else the ones of the gradebook.
    const fill = () => {
      for (const l of lines) {
        const own = typeof grades[l.activity] === 'number';
        const fromBook = !own && typeof book[l.activity] === 'number';
        if (document.activeElement !== host || !l.input.matches(':focus')) l.input.value = own ? fmt(grades[l.activity]) : fromBook ? fmt(book[l.activity]) : '';
        l.input.classList.toggle('book', fromBook);
        l.input.classList.remove('bad');
        const w = typeof weights[l.activity] === 'number' ? weights[l.activity] : l.guideWeight;
        l.weight.value = w ? fmt(w) : '';
        l.weight.classList.toggle('changed', typeof weights[l.activity] === 'number');
        l.weight.classList.remove('bad');
      }
    };

    const summary = h('div', { class: 'sum', attrs: { role: 'status', 'aria-live': 'polite' } });
    const status = h('p', { class: 'meta book-status' });
    function draw() {
      const c = MAK.guideCalc(rows, current(), weights);
      c.rows.forEach((r, i) => {
        const cell = lines[i].state;
        cell.className = 's';
        cell.textContent = '';
        if (!(r.weight > 0)) {
          cell.textContent = t('gcalc.noWeight');
          cell.classList.add('tag');
        } else if (r.grade !== null) {
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
      const filled = c.rows.filter((r) => r.weight > 0 && r.grade !== null).length;
      const below = c.rows.filter((r) => r.below).map((r) => r.activity);
      const parts = [];
      if (!c.total) {
        parts.push(h('p', { text: t('gcalc.noWeights') }));
      } else if (c.complete) {
        parts.push(h('p', { class: 'big' }, t('gcalc.final', { n: fmt(c.final) }), ' · ', h('span', { class: c.passed ? 'ok' : 'low', text: t(c.passed ? 'gcalc.passed' : 'gcalc.failed') })));
      } else if (!filled) {
        parts.push(h('p', { text: t('gcalc.start') }));
      } else if (!c.reachable) {
        parts.push(h('p', { class: 'low', text: t('gcalc.unreachable', { n: fmt(c.projected) }) }));
      } else if (c.need === 0) {
        parts.push(h('p', { class: 'ok', text: t('gcalc.alreadyPass') }));
        parts.push(h('p', { text: t('gcalc.projectedMin', { n: fmt(c.projected) }) }));
      } else {
        // "Necesitas 5 en lo que falta", the number in large.
        const [before, after] = t('gcalc.needRest', { n: '\u0001' }).split('\u0001');
        parts.push(h('p', null, before, h('span', { class: 'need big', text: fmt(c.need) }), after));
        parts.push(h('p', { text: t('gcalc.projected', { n: fmt(c.projected) }) }));
      }
      if (below.length) parts.push(h('p', { class: 'low', text: t('gcalc.belowList', { list: below.join(', ') }) }));
      if (c.total && Math.abs(c.total - 100) > 0.01) parts.push(h('p', { class: 'meta', text: t('gcalc.total', { n: fmt(c.total) }) }));
      MAK.fill(summary, parts);
    }

    // "Actualizar": the weights of the guide again.
    const reset = h('button', { class: 'plain', text: t('gcalc.resetWeights'), attrs: { type: 'button', title: t('gcalc.resetWeightsHelp') }, on: { click: () => {
      for (const k of Object.keys(weights)) delete weights[k];
      fill();
      draw();
      save();
    } } });
    // "Limpiar todo": the grades of the user go away (the grades of the gradebook stay).
    const clear = h('button', { class: 'plain', text: t('gcalc.clear'), attrs: { type: 'button' }, on: { click: () => {
      for (const k of Object.keys(grades)) delete grades[k];
      fill();
      draw();
      save();
      if (lines[0]) lines[0].input.focus();
    } } });

    const title = t('gcalc.title', { site: site.name });
    const win = h('div', { class: 'win', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': title } },
      h('header', null, h('h2', { text: title }), lines.length ? reset : null, h('button', { class: 'x', text: '✕', attrs: { type: 'button', title: t('mail.close'), 'aria-label': t('mail.close') }, on: { click: close } })),
      h('p', { class: 'help meta', text: t('gcalc.help') }),
      lines.length
        ? h('table', null,
          h('thead', null, h('tr', null, h('th', { text: t('guide.activity') }), h('th', { class: 'w', text: t('guide.weight') }), h('th', { text: t('gcalc.grade') }), h('th'))),
          h('tbody', null, lines.map((l) => l.tr)))
        : h('p', { text: t('gcalc.noWeights') }),
      lines.length ? status : null,
      lines.length ? summary : null,
      lines.length ? h('div', { class: 'row' }, clear) : null);
    const backdrop = h('div', { class: 'backdrop' }, win);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
    // The keys stay in the window: the page (the shortcuts of MiAulario) does not get them.
    backdrop.addEventListener('keydown', (e) => e.stopPropagation());
    shadow.append(style, backdrop);
    document.documentElement.append(host);
    MAK.escCloses(win, close);
    open = host;
    fill();
    draw();
    const first = lines.find((l) => !l.input.value) || lines[0];
    if (first) first.input.focus();

    // The grades of the gradebook, after the window opens.
    if (tool && tool.placement && lines.length) {
      status.textContent = t('gcalc.bookLoading');
      const got = await bookGrades(tool.placement, rows);
      if (!host.isConnected) return;
      book = got || {};
      const n = Object.keys(book).length;
      status.textContent = got === null ? t('gcalc.bookError') : n ? t('gcalc.bookFound', { n }) : '';
      for (const l of lines) if (l.input === shadow.activeElement) l.input.blur();
      fill();
      draw();
    }
  };
})();
