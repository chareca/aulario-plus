// Aulario Plus: the themes (the look of the popup, the tools page and all the parts of the extension in
// MiAulario). The user selects a theme in the settings ("theme").
//
// A theme is data: values for the CSS variables --ap-* (colors, fonts, borders, shadows) for the light
// and the dark mode, the fonts that it needs (files in fonts/, OFL), and a little CSS of its own for the
// details that a variable cannot give (a tilted countdown, a scribble under a title). All the styles of
// the extension use only the variables, so a theme changes everything.
//
// A new theme: add an object to MAK.THEMES (copy one and change it). "light": its values; "dark": only the
// values that change in the dark mode (the others stay as in "light"). A variable that the theme does not
// set has the value of BASE (light or dark). "icons" (optional): its own drawings for the icons. Its own CSS goes into every part (the popup, each shadow root): use the class
// names of the parts, and :host for a shadow root. "blockCss" (optional): CSS for the block "Aulario Plus" of
// "Mi sitio", which is in the page (each rule starts with #mak-block). "brand" (optional): the name in the
// titles (else "Aulario Plus"). Nothing from other servers: the fonts are files of the
// extension, the images are data: URLs. tests/themes.test.js checks the list.
(function (root) {
  'use strict';
  const MAK = (root.MAK = root.MAK || {});

  // The values of all the variables. A theme changes some of them.
  const BASE = {
    light: {
      // Text
      font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      'font-head': 'var(--ap-font)',
      'font-num': 'var(--ap-font)',
      weight: '400',
      zoom: '1', // the size of the text (1 = 13 px in the popup, 14 px in MiAulario)
      'head-weight': '700',
      'head-style': 'normal',
      'head-zoom': '1', // the size of the titles
      'head-spacing': 'normal',
      // Colors and backgrounds ("page", "surface", "head-bg", "btn-bg"... can be a gradient or a data: image)
      page: '#f6f7f8',
      surface: '#ffffff',
      solid: '#ffffff', // the color of "surface" without an image or transparency
      surface2: '#f1f3f4',
      fg: '#1d2327',
      muted: '#5f6b73',
      line: '#e1e4e7',
      edge: '#d3d8dc',
      accent: '#1d4ed8',
      'accent-fg': '#ffffff',
      'accent-soft': '#e8efff',
      link: '#1a5fb4',
      red: '#c5221f', 'red-bg': '#fce8e6',
      orange: '#b45309', 'orange-bg': '#feefe3',
      yellow: '#8a6d00', 'yellow-bg': '#fef7e0',
      green: '#137333', 'green-bg': '#e6f4ea',
      blue: '#1a5fb4', 'blue-bg': '#e8f0fe',
      grey: '#80868b', 'grey-bg': '#f1f3f4',
      'mark-bg': '#fff1a8',
      'mark-fg': 'inherit',
      // The head of the block "Aulario Plus" and of the windows
      'head-bg': 'transparent',
      'head-fg': 'var(--ap-fg)',
      'head-line': '1px solid var(--ap-line)',
      'head-btn-bg': 'var(--ap-btn-bg)', // the buttons in a head (the arrow, the close button)
      'head-btn-fg': 'var(--ap-btn-fg)',
      'head-btn-edge': 'var(--ap-btn-edge)',
      'head-btn-size': '30px',
      'title-deco': 'none', // an image under the titles (a background at the bottom)
      'title-pad': '0px', // the space under the titles for that image
      // Buttons: "btn" the normal ones, "primary" the main action
      'btn-bg': 'var(--ap-surface2)',
      'btn-fg': 'var(--ap-fg)',
      'btn-edge': 'var(--ap-edge)',
      'primary-bg': 'var(--ap-accent)',
      'primary-fg': 'var(--ap-accent-fg)',
      'primary-edge': 'var(--ap-accent)',
      // Forms
      radius: '10px', // the boxes and the cards
      'radius-sm': '6px', // the buttons, the fields and the tags
      'radius-box': 'var(--ap-radius-sm)', // the small boxes in a box (a semester, an exam, a result)
      bw: '1px', // the border of the boxes
      'bw-sm': '1px', // the border of the buttons and the fields
      shadow: 'none',
      'shadow-sm': 'none',
      'shadow-pop': '0 12px 40px rgba(0, 0, 0, 0.3)', // the windows over the page
      blur: 'none', // backdrop-filter of the boxes (glass)
      backdrop: 'rgba(0, 0, 0, 0.35)', // behind a window
      'win-bg': 'var(--ap-surface)', // a window over the page, and the block "Aulario Plus" of "Mi sitio"
      // A row of a list (a delivery, a message)
      'item-bg': 'transparent',
      'item-edge': 'transparent',
      'item-radius': '0',
      'item-shadow': 'none',
      'item-gap': '0px',
      'item-sep': '1px solid var(--ap-line)',
      'item-pad': '9px 2px',
      // The countdowns and the small tags ("2 d 4 h", "Corregida · 8,5")
      'count-bg': 'transparent',
      'count-fg': 'var(--ap-fg)',
      'count-edge': 'transparent',
      'count-radius': 'var(--ap-radius-sm)',
      'count-font': 'var(--ap-font-num)',
      'count-size': '1em',
      'count-weight': '700',
      'count-style': 'normal',
      'count-pad': '0',
      'count-shadow': 'none',
      'count-glow': 'none', // text-shadow
      'count-turn': 'none', // transform
      'count-soon-bg': 'var(--ap-count-bg)',
      'count-soon-fg': 'var(--ap-orange)',
      'count-hot-bg': 'var(--ap-count-bg)',
      'count-hot-fg': 'var(--ap-red)',
      'count-hot-edge': 'var(--ap-count-edge)',
      'count-ok-bg': 'var(--ap-count-bg)',
      'count-ok-fg': 'var(--ap-green)',
      'count-ok-edge': 'var(--ap-count-edge)',
      // Fields
      'input-bg': 'var(--ap-surface)',
      'input-fg': 'var(--ap-fg)',
      'input-edge': 'var(--ap-edge)',
      'input-radius': 'var(--ap-radius-sm)',
      'input-shadow': 'none',
      // The logo (a ring and a dot on a square)
      'logo-bg': '#0b3b38',
      'logo-ring': '#6fe0b8',
      'logo-dot': '#e9fbf5',
      // The kinds of activity of a course guide (the bar of the weights)
      'k-exam': '#3b5bdb', 'k-exam-fg': '#ffffff',
      'k-practice': '#0ca678', 'k-practice-fg': '#ffffff',
      'k-work': '#99e9d0', 'k-work-fg': '#0b1a17',
      'k-participation': '#f08c00', 'k-participation-fg': '#1a1205',
      'k-presentation': '#ae3ec9', 'k-presentation-fg': '#ffffff',
      'k-other': '#868e96', 'k-other-fg': '#ffffff'
    },
    dark: {
      page: '#16181b',
      surface: '#1f2326',
      solid: '#1f2326',
      surface2: '#2a2f33',
      fg: '#e8ecee',
      muted: '#9aa6ad',
      line: '#2f363b',
      edge: '#3a4248',
      accent: '#8fb3ff',
      'accent-fg': '#0b1430',
      'accent-soft': '#1c2b41',
      link: '#8ab4f8',
      red: '#f28b82', 'red-bg': '#3c1f1e',
      orange: '#fcad70', 'orange-bg': '#3d2a16',
      yellow: '#fdd663', 'yellow-bg': '#3a3214',
      green: '#81c995', 'green-bg': '#1e3326',
      blue: '#8ab4f8', 'blue-bg': '#1c2b41',
      grey: '#9aa0a6', 'grey-bg': '#2a2f33',
      'mark-bg': '#5a4e10',
      'shadow-pop': '0 12px 40px rgba(0, 0, 0, 0.6)',
      backdrop: 'rgba(0, 0, 0, 0.55)'
    }
  };

  // The grain of paper, cloth and rubber (fractal noise, an SVG in a data: URL).
  const NOISE = (alpha) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .3 0 0 0 0 .26 0 0 0 0 .2 0 0 0 ${alpha} 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
  const GRID = (c) => `linear-gradient(${c} 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, ${c} 1px, transparent 1px) 0 0 / 22px 22px`;

  // The green arrow of the links of Cromo (a drawing of our own, in the style of 2002).
  const XP_ARROW = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#86d863"/><stop offset="1" stop-color="#2a8a0e"/></linearGradient></defs><rect x="2" y="2" width="20" height="20" rx="4" fill="url(#a)" stroke="#1d6a08"/><path d="M6.5 12h10M12.5 7.5L17 12l-4.5 4.5" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---- The drawings and the pieces of CSS of "Cuaderno" ----
  const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  // The lines of a page (every 26 px).
  const RULED = (c) => `repeating-linear-gradient(180deg, transparent 0 25px, ${c} 25px 26px)`;
  // The red margin of a page, 34 px from the left.
  const MARGIN = 'linear-gradient(90deg, transparent 33px, color-mix(in srgb, var(--ap-accent) 55%, transparent) 33px 34.5px, transparent 34.5px)';
  // A line in pen under a title.
  const PEN_LINE = (c) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 10" preserveAspectRatio="none"><path d="M2 5.5C50 3 120 7 198 4" stroke="${c}" stroke-width="2.2" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`);
  // The rubber of an eraser: a light on the top, a darker bottom, a little dirt. base: a color or a gradient.
  const RUBBER = (base) => `linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0) 40%, rgba(0, 0, 0, 0) 65%, rgba(0, 0, 0, 0.13) 100%), ${NOISE(0.1)}, ${base}`;
  // A sticky note: a light on the paper, the corner a little up, the shadow under it (declarations).
  const NOTE = (c) => `background: linear-gradient(172deg, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0) 38%), linear-gradient(315deg, rgba(110, 80, 0, 0.16) 0%, rgba(110, 80, 0, 0) 18%), ${c};
    border-radius: 2px 2px 34px 2px / 2px 2px 6px 2px; box-shadow: 0 1px 1px rgba(0, 0, 0, 0.14), 3px 10px 12px -8px rgba(0, 0, 0, 0.5);`;
  // A piece of washi tape (the declarations of a ::before or ::after): its look, and one on the top of a note.
  const TAPE_LOOK = (c) => `content: ""; position: absolute; z-index: 1; height: 22px; pointer-events: none;
    background: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.2) 0 3px, rgba(255, 255, 255, 0) 3px 7px), ${c};
    clip-path: polygon(0 0, 100% 0, 97% 25%, 100% 50%, 97% 75%, 100% 100%, 0 100%, 3% 75%, 0 50%, 3% 25%);`;
  const TAPE = (c) => `${TAPE_LOOK(c)} top: -11px; left: 50%; width: 88px; margin-left: -44px; transform: rotate(-3deg);`;
  // The spiral (the ::before of a page): a ring every 24 px, the hole in the paper and the wire over the
  // edge (the edge of the paper is at x = 14 of the drawing).
  const COIL = '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="24" viewBox="0 0 34 24"><defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#b4b8bf"/><stop offset="1" stop-color="#555a62"/></linearGradient></defs><ellipse cx="26" cy="12" rx="3.2" ry="3.5" fill="#1b1916" stroke="#8c8c8c" stroke-opacity=".55" stroke-width=".8"/><path d="M26.5 10.5C21 4.5 6 4 4 10.5C2.6 15.5 9 17.5 15 16" fill="none" stroke="#000000" stroke-opacity=".3" stroke-width="3" stroke-linecap="round" transform="translate(.8 1.5)"/><path d="M26.5 10.5C21 4.5 6 4 4 10.5C2.6 15.5 9 17.5 15 16" fill="none" stroke="url(#w)" stroke-width="2.6" stroke-linecap="round"/></svg>';
  const SPIRAL = `content: ""; position: absolute; top: 6px; bottom: 6px; left: -14px; width: 34px; pointer-events: none; background: ${svgUrl(COIL)} 0 0 / 34px 24px repeat-y;`;
  // A magnifier in pen (the search field).
  const LENS = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="10" cy="10" r="6.2" fill="none" stroke="#5a6cc0" stroke-width="2.2"/><path d="M14.6 14.8l5.6 5.4" stroke="#5a6cc0" stroke-width="2.6" stroke-linecap="round"/></svg>');

  MAK.THEMES = [
    // ---- 1 · Bloques: Neo-Brutalism + Bento Grid ----------------------------------------------
    {
      id: 'bloques',
      name: { es: 'Bloques', en: 'Blocks' },
      about: { es: 'Bordes negros gruesos, sombras duras y colores planos.', en: 'Thick black borders, hard shadows and flat colors.' },
      fonts: [{ family: 'AP Archivo', file: 'archivo.woff2', weight: '500 900' }],
      light: {
        font: '"AP Archivo", "Archivo", system-ui, sans-serif',
        weight: '500',
        'head-weight': '900',
        'head-spacing': '-0.02em',
        page: `${GRID('rgba(17, 17, 17, 0.06)')}, #fdfbf3`,
        surface: '#ffffff',
        solid: '#ffffff',
        surface2: '#fff4bf',
        fg: '#111111',
        muted: '#4a4a4a',
        line: '#111111',
        edge: '#111111',
        accent: '#ffd400',
        'accent-fg': '#111111',
        'accent-soft': '#fff1a6',
        link: '#111111',
        red: '#d42a1e', 'red-bg': '#ffe1ef',
        orange: '#b34700', 'orange-bg': '#ffe6cc',
        yellow: '#7a6000', 'yellow-bg': '#fff4bf',
        green: '#0b6b40', 'green-bg': '#c9f7e1',
        blue: '#2349d6', 'blue-bg': '#dce6ff',
        grey: '#555555', 'grey-bg': '#eeeeee',
        'mark-bg': '#ff86bd',
        'mark-fg': '#111111',
        'head-bg': '#ffd400',
        'head-fg': '#111111',
        'head-line': '3px solid #111111',
        'btn-bg': '#ffffff',
        'btn-fg': '#111111',
        'btn-edge': '#111111',
        'primary-bg': '#ffd400',
        'primary-fg': '#111111',
        'primary-edge': '#111111',
        radius: '12px',
        'radius-sm': '8px',
        bw: '3px',
        'bw-sm': '2px',
        shadow: '5px 5px 0 #111111',
        'shadow-sm': '3px 3px 0 #111111',
        'shadow-pop': '8px 8px 0 #111111',
        backdrop: 'rgba(17, 17, 17, 0.45)',
        'item-sep': '3px solid #111111',
        'item-pad': '10px 2px',
        'count-bg': '#ffffff',
        'count-fg': '#111111',
        'count-edge': '#111111',
        'count-radius': '8px',
        'count-weight': '900',
        'count-pad': '3px 8px',
        'count-shadow': '3px 3px 0 #111111',
        'count-turn': 'rotate(-3deg)',
        'count-soon-bg': '#ffd400',
        'count-soon-fg': '#111111',
        'count-hot-bg': '#ff4b3e',
        'count-hot-fg': '#ffffff',
        'count-ok-bg': '#43e09b',
        'count-ok-fg': '#111111',
        'input-bg': '#ffffff',
        'input-edge': '#111111',
        'logo-bg': '#111111',
        'logo-ring': '#ffd400',
        'logo-dot': '#ffffff',
        'k-exam': '#ffd400', 'k-exam-fg': '#111111',
        'k-practice': '#6c9bff', 'k-practice-fg': '#111111',
        'k-work': '#43e09b', 'k-work-fg': '#111111',
        'k-participation': '#ff86bd', 'k-participation-fg': '#111111',
        'k-presentation': '#b99bff', 'k-presentation-fg': '#111111',
        'k-other': '#dddddd', 'k-other-fg': '#111111'
      },
      dark: {
        page: `${GRID('rgba(255, 255, 255, 0.05)')}, #151517`,
        surface: '#202024',
        solid: '#202024',
        surface2: '#3a3410',
        'accent-soft': '#3a3410',
        fg: '#f5f2e8',
        muted: '#c9c4b5',
        line: '#f5f2e8',
        edge: '#f5f2e8',
        link: '#f5f2e8',
        red: '#ff7a6e', 'red-bg': '#4a1f2c',
        orange: '#ffb066', 'orange-bg': '#3d2a16',
        yellow: '#ffd400', 'yellow-bg': '#3a3410',
        green: '#43e09b', 'green-bg': '#16382a',
        blue: '#8fb0ff', 'blue-bg': '#1d2a4d',
        grey: '#bbbbbb', 'grey-bg': '#2c2c30',
        'head-line': '3px solid #f5f2e8',
        'btn-bg': '#202024',
        'btn-fg': '#f5f2e8',
        'btn-edge': '#f5f2e8',
        'primary-edge': '#f5f2e8',
        shadow: '5px 5px 0 #f5f2e8',
        'shadow-sm': '3px 3px 0 #f5f2e8',
        'shadow-pop': '8px 8px 0 #f5f2e8',
        backdrop: 'rgba(0, 0, 0, 0.6)',
        'item-sep': '3px solid #f5f2e8',
        'count-bg': '#202024',
        'count-fg': '#f5f2e8',
        'count-edge': '#f5f2e8',
        'count-shadow': '3px 3px 0 #f5f2e8',
        'input-bg': '#151517',
        'input-edge': '#f5f2e8',
        'logo-bg': '#ffd400',
        'logo-ring': '#111111',
        'logo-dot': '#111111'
      },
      css: `
        .countdown, .count, .tag { border: var(--ap-bw-sm) solid var(--ap-count-edge); }
        .tag { border-radius: 6px; font-weight: 800; }
        nav.tabs { gap: 4px; border-bottom: 0; padding: 0 10px 8px; }
        nav.tabs button { flex: 1 1 auto; padding: 2px 4px; border: 2px solid var(--ap-edge); border-radius: 6px; background: var(--ap-surface); color: var(--ap-fg); font-weight: 800; font-size: 11.5px; }
        nav.tabs .count-badge { min-width: 14px; padding: 0 3px; margin-left: 3px; font-size: 9.5px; line-height: 13px; }
        nav.tabs button[aria-selected="true"] { background: var(--ap-fg); color: var(--ap-surface); border-color: var(--ap-fg); }
        .item.u-overdue, .item.u-red { background: var(--ap-red-bg); }
        .backdrop .win > header, .panel > input { border-bottom: 3px solid var(--ap-edge); }
        a.res.sel, a.item.sel, .result.sel { background: var(--ap-accent); color: #111111; }
        .exams li { border: 2px solid var(--ap-edge); box-shadow: 3px 3px 0 var(--ap-edge); }
        .next-exam { --ap-fg: #111111; --ap-muted: #333333; background: #ffd400; color: #111111; border: 3px solid var(--ap-edge); box-shadow: 4px 4px 0 var(--ap-edge); }
        .next-exam .day { font-size: 54px; letter-spacing: -0.05em; }
        .next-exam .count { background: #ffffff; color: #111111; border-color: #111111; }
        .actions .action:nth-child(3n+1) { background: #6c9bff; }
        .actions .action:nth-child(3n+2) { background: #43e09b; }
        .actions .action:nth-child(3n+3) { background: #ff86bd; }
        .actions .action { color: #111111; border: 3px solid var(--ap-edge); box-shadow: 4px 4px 0 var(--ap-edge); border-radius: 12px; }
        .actions .action .go { font-weight: 900; font-size: 1.25em; letter-spacing: -0.02em; }
        .guide-card, .sem { border-width: 3px; box-shadow: 4px 4px 0 var(--ap-edge); }
        .bar.weights { border: 3px solid var(--ap-edge); gap: 0; border-radius: 8px; }
        .bar.weights span { border-right: 3px solid var(--ap-edge); }
        .bar.weights span:last-child { border-right: 0; }
      `
    },

    // ---- 3 · Plastilina: Claymorphism + Neumorphism ----------------------------------------------
    {
      id: 'plastilina',
      name: { es: 'Plastilina', en: 'Clay' },
      about: { es: 'Formas blandas e infladas, colores pastel y campos hundidos.', en: 'Soft puffy shapes, pastel colors and sunken fields.' },
      fonts: [
        { family: 'AP Fredoka', file: 'fredoka.woff2', weight: '400 700' },
        { family: 'AP Nunito', file: 'nunito.woff2', weight: '400 900' }
      ],
      light: {
        font: '"AP Nunito", "Nunito", system-ui, sans-serif',
        'font-head': '"AP Fredoka", "Fredoka", "AP Nunito", system-ui, sans-serif',
        'font-num': '"AP Fredoka", "Fredoka", system-ui, sans-serif',
        weight: '600',
        'head-weight': '600',
        page: 'radial-gradient(280px 220px at 0% 0%, #ffe0cf, transparent 70%), radial-gradient(320px 260px at 100% 100%, #d3f2df, transparent 70%), radial-gradient(260px 200px at 90% 0%, #dbe8ff, transparent 70%), #ebeef6',
        surface: '#f8f5fb',
        solid: '#f8f5fb',
        surface2: '#ffffff',
        fg: '#2e2a3a',
        muted: '#6d6880',
        line: 'rgba(70, 60, 110, 0.12)',
        edge: 'transparent',
        accent: '#ffe7a0',
        'accent-fg': '#2e2a3a',
        'accent-soft': '#fff3c9',
        link: '#2f5bd0',
        red: '#c8324f', 'red-bg': '#ffd9df',
        orange: '#b4581a', 'orange-bg': '#ffe2cf',
        yellow: '#8a6400', 'yellow-bg': '#fff3c9',
        green: '#2c7f50', 'green-bg': '#d6f5e2',
        blue: '#2f5bd0', 'blue-bg': '#dbe8ff',
        grey: '#6d6880', 'grey-bg': '#ece9f2',
        'mark-bg': '#ffe7a0',
        'head-fg': '#2e2a3a',
        'head-line': '0 solid transparent',
        'btn-bg': '#ffffff',
        'btn-fg': '#2e2a3a',
        'btn-edge': 'transparent',
        'primary-bg': '#ffe7a0',
        'primary-fg': '#2e2a3a',
        'primary-edge': 'transparent',
        radius: '26px',
        'radius-sm': '14px',
        bw: '0px',
        'bw-sm': '0px',
        shadow: '0 18px 30px -16px rgba(70, 60, 110, 0.38), inset -6px -8px 14px rgba(70, 60, 110, 0.09), inset 6px 6px 12px rgba(255, 255, 255, 0.95)',
        'shadow-sm': '0 8px 14px -8px rgba(70, 60, 110, 0.42), inset -3px -4px 7px rgba(0, 0, 0, 0.07), inset 3px 3px 7px rgba(255, 255, 255, 0.8)',
        'shadow-pop': '0 30px 60px -20px rgba(70, 60, 110, 0.55), inset -6px -8px 14px rgba(70, 60, 110, 0.09), inset 6px 6px 12px rgba(255, 255, 255, 0.95)',
        backdrop: 'rgba(60, 55, 90, 0.3)',
        'item-bg': '#ffffff',
        'item-radius': '20px',
        'item-shadow': 'var(--ap-shadow-sm)',
        'item-gap': '10px',
        'item-sep': '0 solid transparent',
        'item-pad': '10px 12px',
        'count-bg': '#c4dcff',
        'count-fg': '#2e2a3a',
        'count-radius': '14px',
        'count-weight': '600',
        'count-pad': '5px 10px',
        'count-shadow': 'var(--ap-shadow-sm)',
        'count-soon-bg': '#ffcdb2',
        'count-soon-fg': '#2e2a3a',
        'count-hot-bg': '#ff8fa3',
        'count-hot-fg': '#ffffff',
        'count-ok-bg': '#bdecce',
        'count-ok-fg': '#2e2a3a',
        'input-bg': '#f8f5fb',
        'input-edge': 'transparent',
        'input-radius': '14px',
        'input-shadow': 'inset 3px 3px 7px rgba(70, 60, 110, 0.18), inset -3px -3px 7px #ffffff',
        'logo-bg': '#ffcdb2',
        'logo-ring': '#2e2a3a',
        'logo-dot': '#2e2a3a',
        'k-exam': '#c4dcff', 'k-exam-fg': '#2e2a3a',
        'k-practice': '#bdecce', 'k-practice-fg': '#2e2a3a',
        'k-work': '#ffcdb2', 'k-work-fg': '#2e2a3a',
        'k-participation': '#ffe7a0', 'k-participation-fg': '#2e2a3a',
        'k-presentation': '#dcd0ff', 'k-presentation-fg': '#2e2a3a',
        'k-other': '#e4e2ea', 'k-other-fg': '#2e2a3a'
      },
      dark: {
        page: 'radial-gradient(280px 220px at 0% 0%, #3a2c35, transparent 70%), radial-gradient(320px 260px at 100% 100%, #213a33, transparent 70%), #1d2130',
        surface: '#2a2f3e',
        solid: '#2a2f3e',
        surface2: '#343a4b',
        'accent-soft': '#4a4330',
        'mark-bg': '#6b5a1f',
        'head-fg': '#f0eef6',
        fg: '#f0eef6',
        muted: '#b6b2c8',
        line: 'rgba(255, 255, 255, 0.08)',
        link: '#9dbaff',
        red: '#ff9fb1', 'red-bg': '#4a2a33',
        orange: '#ffb98c', 'orange-bg': '#45301f',
        green: '#8fe0b0', 'green-bg': '#21392e',
        blue: '#9dbaff', 'blue-bg': '#263452',
        grey: '#b6b2c8', 'grey-bg': '#343a4b',
        accent: '#f2cf63',
        'btn-bg': '#343a4b',
        'btn-fg': '#f0eef6',
        'primary-bg': '#f2cf63',
        shadow: '0 18px 30px -16px rgba(0, 0, 0, 0.6), inset -6px -8px 14px rgba(0, 0, 0, 0.25), inset 6px 6px 12px rgba(255, 255, 255, 0.06)',
        'shadow-sm': '0 8px 14px -8px rgba(0, 0, 0, 0.6), inset -3px -4px 7px rgba(0, 0, 0, 0.25), inset 3px 3px 7px rgba(255, 255, 255, 0.07)',
        'shadow-pop': '0 30px 60px -20px rgba(0, 0, 0, 0.7), inset 6px 6px 12px rgba(255, 255, 255, 0.06)',
        'item-bg': '#343a4b',
        'count-bg': '#3d5a8a',
        'count-fg': '#ffffff',
        'count-soon-bg': '#8a5a3c',
        'count-soon-fg': '#ffffff',
        'count-hot-bg': '#c9506a',
        'count-ok-bg': '#2f6b4a',
        'count-ok-fg': '#ffffff',
        'input-bg': '#252a37',
        'input-shadow': 'inset 3px 3px 7px rgba(0, 0, 0, 0.45), inset -3px -3px 7px rgba(255, 255, 255, 0.05)',
        'logo-bg': '#f2a98a',
        'k-exam': '#7f9fd6', 'k-practice': '#7cc79d', 'k-work': '#e3a98a', 'k-participation': '#e6c66e', 'k-presentation': '#a996e0', 'k-other': '#8d8a99'
      },
      css: `
        nav.tabs { margin: 0 12px; padding: 5px; gap: 3px; border: 0; border-radius: 18px; background: var(--ap-input-bg); box-shadow: var(--ap-input-shadow); }
        nav.tabs button { border: 0; border-radius: 13px; padding: 6px 4px; font-family: var(--ap-font-head); }
        nav.tabs button[aria-selected="true"] { background: var(--ap-surface2); box-shadow: var(--ap-shadow-sm); }
        .mak-logo { border-radius: 12px; box-shadow: var(--ap-shadow-sm); }
        .exams li, .guide-card, .sem, .tile { background: var(--ap-surface2); box-shadow: var(--ap-shadow-sm); border: 0; }
        .next-exam { --ap-fg: #2e2a3a; --ap-muted: #5e5970; background: #ffe7a0; color: #2e2a3a; box-shadow: var(--ap-shadow-sm); }
        .next-exam .count { background: #c4dcff; color: #2e2a3a; }
        .actions .action:nth-child(3n+1) { background: #c4dcff; }
        .actions .action:nth-child(3n+2) { background: #bdecce; }
        .actions .action:nth-child(3n+3) { background: #ffcdb2; }
        .actions .action { color: #2e2a3a; border-radius: 18px; box-shadow: var(--ap-shadow-sm); }
        .actions .action .label { display: none; }
        .bar.weights { height: 26px; border-radius: 14px; gap: 3px; }
        .bar.weights span { border-radius: 10px; }
      `
    },

    // ---- 5 · Etérea: Glassmorphism + Ethereal + Surrealism -----------------------------------------
    {
      id: 'eterea',
      name: { es: 'Etérea', en: 'Ethereal' },
      about: { es: 'Vidrio esmerilado sobre un amanecer pastel, con una luna que flota.', en: 'Frosted glass over a pastel dawn, with a floating moon.' },
      fonts: [
        { family: 'AP Cormorant', file: 'cormorant.woff2', weight: '400 700' },
        { family: 'AP Cormorant', file: 'cormorant-italic.woff2', weight: '400 700', style: 'italic' },
        { family: 'AP Manrope', file: 'manrope.woff2', weight: '400 800' }
      ],
      light: {
        font: '"AP Manrope", "Manrope", system-ui, sans-serif',
        'font-head': '"AP Cormorant", "Cormorant Garamond", Georgia, serif',
        'font-num': '"AP Cormorant", "Cormorant Garamond", Georgia, serif',
        weight: '500',
        'head-weight': '500',
        'head-style': 'italic',
        'head-zoom': '1.3',
        page: 'radial-gradient(circle 64px at 88% 250px, #fff4f7 0%, #ffd6e4 48%, #b9c8f5 98%, transparent 100%), radial-gradient(420px 300px at 0% 0%, #ffd9c6, transparent 62%), radial-gradient(400px 320px at 100% 30%, #c6dcfb, transparent 60%), radial-gradient(420px 300px at 40% 100%, #f5c9e0, transparent 62%), #f1ecf5',
        surface: 'rgba(255, 255, 255, 0.38)',
        solid: '#f6f0f7',
        'win-bg': 'linear-gradient(rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.4)), radial-gradient(circle 44px at calc(100% - 150px) -14px, #fff4f7 0%, #ffd6e4 48%, #b9c8f5 98%, transparent 100%), radial-gradient(640px 420px at 0% 0%, #ffd9c6, transparent 62%), radial-gradient(640px 440px at 100% 45%, #c6dcfb, transparent 60%), radial-gradient(640px 420px at 40% 100%, #f5c9e0, transparent 62%), #f1ecf5',
        surface2: 'rgba(255, 255, 255, 0.62)',
        fg: '#2a2740',
        muted: '#5c5778',
        line: 'rgba(255, 255, 255, 0.78)',
        edge: 'rgba(255, 255, 255, 0.72)',
        accent: '#2a2740',
        'accent-fg': '#ffffff',
        'accent-soft': 'rgba(255, 255, 255, 0.6)',
        link: '#2a2740',
        red: '#b8336a', 'red-bg': 'rgba(255, 200, 215, 0.6)',
        orange: '#a8521f', 'orange-bg': 'rgba(255, 220, 200, 0.6)',
        yellow: '#7c6512', 'yellow-bg': 'rgba(255, 240, 180, 0.6)',
        green: '#2a7259', 'green-bg': 'rgba(200, 240, 220, 0.6)',
        blue: '#3d55b0', 'blue-bg': 'rgba(205, 220, 255, 0.6)',
        grey: '#5c5778', 'grey-bg': 'rgba(255, 255, 255, 0.5)',
        'mark-bg': 'linear-gradient(transparent 58%, rgba(255, 170, 200, 0.85) 58%)',
        'head-fg': '#2a2740',
        'head-line': '1px solid rgba(255, 255, 255, 0.78)',
        'btn-bg': 'rgba(255, 255, 255, 0.55)',
        'btn-fg': '#2a2740',
        'btn-edge': 'rgba(255, 255, 255, 0.8)',
        'primary-bg': '#2a2740',
        'primary-fg': '#ffffff',
        'primary-edge': '#2a2740',
        radius: '22px',
        'radius-sm': '999px',
        'radius-box': '16px',
        shadow: '0 24px 50px -28px rgba(70, 50, 120, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
        'shadow-pop': '0 30px 70px -20px rgba(70, 50, 120, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
        blur: 'blur(18px) saturate(150%)',
        backdrop: 'rgba(120, 100, 160, 0.25)',
        'item-sep': '1px solid rgba(255, 255, 255, 0.78)',
        'count-font': '"AP Cormorant", "Cormorant Garamond", Georgia, serif',
        'count-size': '1.45em',
        'count-weight': '500',
        'count-style': 'italic',
        'count-fg': '#2a2740',
        'count-soon-fg': '#a8521f',
        'count-hot-fg': '#b8336a',
        'count-ok-fg': '#2a7259',
        'input-bg': 'rgba(255, 255, 255, 0.5)',
        'input-edge': 'rgba(255, 255, 255, 0.85)',
        'input-radius': '12px',
        'logo-bg': '#ffffff',
        'logo-ring': '#b9c8f5',
        'logo-dot': '#ffb3c9',
        'k-exam': 'linear-gradient(90deg, #ffc1d6, #ffb196)', 'k-exam-fg': '#2a2740',
        'k-practice': 'linear-gradient(90deg, #c7d8ff, #b5c2f7)', 'k-practice-fg': '#2a2740',
        'k-work': '#cdeedd', 'k-work-fg': '#2a2740',
        'k-participation': '#fff0b3', 'k-participation-fg': '#2a2740',
        'k-presentation': '#e5d5ff', 'k-presentation-fg': '#2a2740',
        'k-other': '#e6e3ee', 'k-other-fg': '#2a2740'
      },
      dark: {
        page: 'radial-gradient(circle 64px at 88% 250px, #d9ccb0 0%, #a89a7e 50%, #4f5888 98%, transparent 100%), radial-gradient(460px 380px at 10% 0%, #2b2d5a, transparent 60%), radial-gradient(460px 380px at 100% 100%, #3d2348, transparent 60%), #13142a',
        surface: 'rgba(36, 34, 70, 0.48)',
        solid: '#1f1e3d',
        'win-bg': 'linear-gradient(rgba(19, 20, 42, 0.35), rgba(19, 20, 42, 0.35)), radial-gradient(circle 44px at calc(100% - 150px) -14px, #d9ccb0 0%, #a89a7e 50%, #4f5888 98%, transparent 100%), radial-gradient(640px 460px at 10% 0%, #2b2d5a, transparent 60%), radial-gradient(640px 460px at 100% 100%, #3d2348, transparent 60%), #13142a',
        surface2: 'rgba(255, 255, 255, 0.1)',
        'accent-soft': 'rgba(255, 255, 255, 0.08)',
        fg: '#ecebff',
        muted: '#b4b1d8',
        line: 'rgba(255, 255, 255, 0.14)',
        edge: 'rgba(255, 255, 255, 0.18)',
        accent: '#ecebff',
        'accent-fg': '#13142a',
        link: '#ecebff',
        red: '#ff94b4', 'red-bg': 'rgba(120, 40, 70, 0.45)',
        orange: '#ffbb8f', 'orange-bg': 'rgba(120, 70, 40, 0.45)',
        green: '#9be0c0', 'green-bg': 'rgba(40, 100, 80, 0.45)',
        blue: '#a9bbff', 'blue-bg': 'rgba(50, 70, 140, 0.45)',
        grey: '#b4b1d8', 'grey-bg': 'rgba(255, 255, 255, 0.08)',
        'mark-bg': 'linear-gradient(transparent 58%, rgba(255, 120, 170, 0.55) 58%)',
        'head-fg': '#ecebff',
        'head-line': '1px solid rgba(255, 255, 255, 0.14)',
        'btn-bg': 'rgba(255, 255, 255, 0.08)',
        'btn-fg': '#ecebff',
        'btn-edge': 'rgba(255, 255, 255, 0.2)',
        'primary-bg': '#ecebff',
        'primary-fg': '#13142a',
        'primary-edge': '#ecebff',
        shadow: '0 24px 50px -28px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        'shadow-pop': '0 30px 70px -20px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        backdrop: 'rgba(5, 5, 20, 0.5)',
        'item-sep': '1px solid rgba(255, 255, 255, 0.14)',
        'count-fg': '#ecebff',
        'count-soon-fg': '#ffbb8f',
        'count-hot-fg': '#ff94b4',
        'count-ok-fg': '#9be0c0',
        'input-bg': 'rgba(255, 255, 255, 0.06)',
        'input-edge': 'rgba(255, 255, 255, 0.2)',
        'logo-bg': '#13142a',
        'logo-ring': '#f2e2bd',
        'logo-dot': '#ff94b4',
        'k-exam': 'linear-gradient(90deg, #c76b8f, #c98a6a)', 'k-exam-fg': '#ffffff',
        'k-practice': 'linear-gradient(90deg, #6f82c9, #6a74b8)', 'k-practice-fg': '#ffffff',
        'k-work': '#4f8f78', 'k-work-fg': '#ffffff',
        'k-participation': '#b39a4a', 'k-participation-fg': '#ffffff',
        'k-presentation': '#8a6fc0', 'k-presentation-fg': '#ffffff',
        'k-other': '#5f5c78', 'k-other-fg': '#ffffff'
      },
      css: `
        .countdown, .count { letter-spacing: 0; }
        nav.tabs { border-bottom: 1px solid var(--ap-line); }
        .mak-logo { border-radius: 50%; }
        /* One level of glass (a tile, a card of a guide); in it, rows with thin lines, not more glass. */
        .tile, .guide-card { background: var(--ap-surface2); border: 1px solid var(--ap-edge); }
        .sem { background: transparent; border: 0; border-top: 1px solid var(--ap-line); border-radius: 0; padding: 8px 0 4px; }
        .sems.two .sem { border-top: 0; }
        .exams { gap: 0 18px; }
        .exams li { background: transparent; border: 0; border-top: 1px solid var(--ap-line); border-radius: 0; padding: 8px 2px; }
        .exams .when { color: var(--ap-muted); }
        .next-exam .day { width: 92px; height: 92px; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 50%;
          background: radial-gradient(circle at 34% 28%, #fff 0%, #ffe3ec 42%, #c9d6fb 100%); box-shadow: 0 18px 30px -12px rgba(110, 80, 160, 0.5); color: #2a2740; font-size: 34px; line-height: 0.9; }
        .next-exam .day small { font-size: 16px; }
        .actions .action { color: var(--ap-btn-fg); background: var(--ap-btn-bg); border: 1px solid var(--ap-btn-edge); border-radius: 999px; }
        .actions .action .label { display: none; }
        .bar.weights { height: 10px; border-radius: 99px; gap: 0; }
        .bar.weights span { color: transparent; }
      `
    },

    // ---- 6 · Cromo: the desktop of 2002 (blue title bars, beige windows; the dark mode as the black
    // themes of that time). The fonts of the system (Tahoma, Trebuchet MS). The icons are drawings of
    // our own in that style, not the icons of a system.
    {
      id: 'cromo',
      name: { es: 'Cromo XP', en: 'Chrome XP' },
      brand: 'Aulario XP',
      about: { es: 'Barra de título azul, ventanas beige y botones con borde azul, como el escritorio de 2002.', en: 'Blue title bars, beige windows and buttons with a blue border, as the desktop of 2002.' },
      fonts: [],
      icons: {
        mail: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d4e0f7"/></linearGradient></defs><rect x="2.5" y="5.5" width="19" height="13" rx="1.5" fill="url(#g)" stroke="#2c5bc0"/><path d="M3.2 6.6L12 13l8.8-6.4" fill="none" stroke="#2c5bc0" stroke-width="1.3"/><path d="M3.5 17.6l6.4-5.6M20.5 17.6l-6.4-5.6" fill="none" stroke="#8eaae0"/></svg>`,
        pencil: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5.3 15.2L15.9 4.6l3.5 3.5L8.8 18.7z" fill="#f6c445" stroke="#7a5a10"/><path d="M15.9 4.6l1.5-1.5a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2l-1.5 1.5z" fill="#ef8aa0" stroke="#7a3040"/><path d="M5.3 15.2L4 20l4.8-1.3z" fill="#f3dab2" stroke="#7a5a10" stroke-linejoin="round"/><path d="M4 20l.7-2.4 1.7 1.7z" fill="#333333"/><path d="M7 15.8l9.3-9.3" stroke="#fde18f"/></svg>`,
        calc: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f6f6"/><stop offset="1" stop-color="#c4c4c4"/></linearGradient></defs><rect x="4.5" y="2.5" width="15" height="19" rx="1.5" fill="url(#b)" stroke="#4d4d4d"/><rect x="6.5" y="4.5" width="11" height="4" fill="#d6ebcf" stroke="#64845a" stroke-width=".8"/><g fill="#2c5bc0"><rect x="6.5" y="10.5" width="3" height="2.3"/><rect x="10.5" y="10.5" width="3" height="2.3"/><rect x="6.5" y="13.9" width="3" height="2.3"/><rect x="10.5" y="13.9" width="3" height="2.3"/><rect x="6.5" y="17.2" width="3" height="2.3"/><rect x="10.5" y="17.2" width="3" height="2.3"/></g><rect x="14.5" y="10.5" width="3" height="9" fill="#d64529"/></svg>`,
        arrow: XP_ARROW
      },
      light: {
        font: 'Tahoma, "Segoe UI", Verdana, "DejaVu Sans", sans-serif',
        'font-head': '"Trebuchet MS", Tahoma, "Segoe UI", sans-serif',
        'font-num': 'Tahoma, "Segoe UI", Verdana, sans-serif',
        zoom: '0.85',
        'head-weight': '700',
        'head-zoom': '0.8',
        page: '#ece9d8',
        surface: '#ffffff',
        solid: '#ffffff',
        surface2: '#eef3fc',
        'win-bg': '#ece9d8',
        fg: '#000000',
        muted: '#555555',
        line: '#d0d0bf',
        edge: '#0831d9',
        accent: '#316ac5',
        'accent-fg': '#ffffff',
        'accent-soft': '#d6dff7',
        link: '#215dc6',
        red: '#c00000', 'red-bg': '#ffe4e0',
        orange: '#b85400', 'orange-bg': '#fff1dc',
        yellow: '#7a5d00', 'yellow-bg': '#ffffe1',
        green: '#2b7a0b', 'green-bg': '#e2f5d6',
        blue: '#215dc6', 'blue-bg': '#d6dff7',
        grey: '#555555', 'grey-bg': '#ece9d8',
        'mark-bg': '#316ac5',
        'mark-fg': '#ffffff',
        // The title bar of the windows
        'head-bg': 'linear-gradient(180deg, #0997ff 0%, #0053ee 8%, #0050ee 40%, #0066ff 88%, #0066ff 93%, #005bff 95%, #003dd7 96%, #003dd7 100%)',
        'head-fg': '#ffffff',
        'head-line': '0 solid transparent',
        'head-btn-bg': 'radial-gradient(circle at 90% 90%, #0054e3 0%, #2263d5 55%, #4479e4 70%, #a3bbec 90%, #ffffff 100%)',
        'head-btn-fg': '#ffffff',
        'head-btn-edge': '#ffffff',
        'head-btn-size': '22px',
        // The buttons
        'btn-bg': 'linear-gradient(180deg, #ffffff 0%, #ecebe6 86%, #d6d0c5 100%)',
        'btn-fg': '#000000',
        'btn-edge': '#003c74',
        'primary-bg': 'linear-gradient(180deg, #ffffff 0%, #ecebe6 86%, #d6d0c5 100%)',
        'primary-fg': '#000000',
        'primary-edge': '#003c74',
        // A window: a thick blue frame, rounded at the top
        radius: '8px 8px 0 0',
        'radius-sm': '3px',
        'radius-box': '3px',
        bw: '3px',
        'bw-sm': '1px',
        'shadow-pop': '2px 4px 14px rgba(0, 0, 0, 0.4)',
        backdrop: 'rgba(0, 0, 0, 0.25)',
        'item-sep': '1px solid #ece9d8',
        'item-pad': '6px 2px',
        // The countdowns: text, as in a list of the desktop
        'count-weight': '700',
        'count-radius': '0',
        'count-soon-fg': '#b85400',
        'count-hot-fg': '#c00000',
        'count-ok-fg': '#2b7a0b',
        'input-bg': '#ffffff',
        'input-fg': '#000000',
        'input-edge': '#7f9db9',
        'input-radius': '0',
        'logo-bg': '#ffffff',
        'logo-ring': '#2f71e6',
        'logo-dot': '#3c8d0d',
        'k-exam': '#245edb', 'k-exam-fg': '#ffffff',
        'k-practice': '#3c8d0d', 'k-practice-fg': '#ffffff',
        'k-work': '#f7c33a', 'k-work-fg': '#000000',
        'k-participation': '#e0451e', 'k-participation-fg': '#ffffff',
        'k-presentation': '#7a5ac4', 'k-presentation-fg': '#ffffff',
        'k-other': '#a0a0a0', 'k-other-fg': '#000000'
      },
      // The same windows, title bars, buttons and fields; only the backgrounds are dark.
      dark: {
        page: '#1d2433',
        surface: '#151b27',
        solid: '#151b27',
        surface2: '#24304a',
        'win-bg': '#232c3f',
        fg: '#eef2f8',
        muted: '#b6bfd0',
        line: '#3e4a63',
        'accent-soft': '#1f2d4d',
        link: '#8fb4ff',
        red: '#ff8a7a', 'red-bg': '#4a2018',
        orange: '#ffb366', 'orange-bg': '#45301a',
        yellow: '#ffd76a', 'yellow-bg': '#423816',
        green: '#8bd36a', 'green-bg': '#20381a',
        blue: '#8fb4ff', 'blue-bg': '#1f2d4d',
        grey: '#b6bfd0', 'grey-bg': '#24304a',
        'shadow-pop': '2px 4px 14px rgba(0, 0, 0, 0.7)',
        backdrop: 'rgba(0, 0, 0, 0.55)',
        'item-sep': '1px solid #2a3550',
        'count-soon-fg': '#ffb366',
        'count-hot-fg': '#ff8a7a',
        'count-ok-fg': '#8bd36a'
      },
      css: `
        /* Title bars: Trebuchet, with a dark blue shadow */
        header.top h1, .box > .head .title, .win > header h2, .mail > header h2, .panel > .bar { text-shadow: 1px 1px 0 #0f1089; }
        /* The popup: the content in a white panel, with the border of the lists */
        main { border: 1px solid #7f9db9; border-radius: 0; }
        /* Buttons of 23 px; an orange light on hover; the default button with a blue edge */
        .btn, .mak-btn, .win button.plain, .win button.btn, .mail button:not(.x), .chips button { min-height: 23px; padding: 2px 12px; font-weight: 400; }
        .btn:hover, .chips button:hover, .week:hover, button.plain:hover, button.btn:hover, .mak-btn:hover, .mak-icon:hover, .icon-btn:hover {
          filter: none; box-shadow: inset -1px 1px #fff0cf, inset 1px 2px #fdd889, inset -2px 2px #fbc761, inset 2px -2px #e5a01a; }
        .btn.primary, .mak-btn { box-shadow: inset -1px 1px #cee7ff, inset 1px 2px #98b8ea, inset -2px 2px #bcd4f6, inset 1px -1px #89ade4, inset 2px -2px #89ade4; }
        /* The tabs of a window of properties */
        nav.tabs { gap: 2px; padding: 6px 8px 0; border-bottom: 1px solid #919b9c; }
        nav.tabs button { flex: none; padding: 3px 8px; margin-bottom: -1px; color: #000000; font-size: 11px; border: 1px solid #919b9c; border-bottom: 0;
          border-radius: 3px 3px 0 0; background: linear-gradient(180deg, #ffffff 0%, #fafaf9 26%, #f0f0ea 95%, #ecebe6 100%); }
        nav.tabs button[aria-selected="true"] { color: var(--ap-fg); background: var(--ap-surface); border-top: 3px solid #e68b2c; padding-top: 1px; font-weight: 400; }
        /* The week strip: buttons, with the dark text of the buttons also in the dark mode */
        .week .n { color: #000000; }
        .week .label { color: #444444; }
        .week .track { background: #d6d0c5; }
        /* The close button of a window: the red square */
        .win > header button.x, .mail > header button.x, .box > .head button.close, .panel > .bar button.x, header.top .icon-btn.close { width: 22px; height: 22px; padding: 0; color: #ffffff; font-size: 13px;
          border: 1px solid #ffffff; border-radius: 3px; background: radial-gradient(circle at 90% 90%, #cc4600 0%, #dc6527 55%, #cd7546 70%, #ffccb2 90%, #ffffff 100%); }
        /* The search (Ctrl+K): a window with a title bar, a field and a white list, and a status bar */
        .panel > .bar { display: flex; }
        .panel > input { margin: 10px 10px 6px; padding: 3px 6px; font-family: var(--ap-font); font-size: 12px; font-weight: 400; font-style: normal; letter-spacing: normal;
          color: var(--ap-input-fg); background: var(--ap-input-bg); border: 1px solid var(--ap-input-edge); caret-color: auto; }
        .panel > input::placeholder { color: #808080; }
        .panel > .list { margin: 0 10px 8px; padding: 2px; background: var(--ap-surface); border: 1px solid #7f9db9; }
        .panel h3 { margin: 6px 4px 2px; font-family: var(--ap-font); font-size: 11px; font-weight: 700; font-style: normal; color: var(--ap-link); }
        .panel a.item { padding: 3px 6px; border-radius: 0; }
        .panel .tip { padding: 4px 4px 0; }
        .panel > .foot { padding: 3px 10px; font-size: 11px; color: var(--ap-fg); border-top: 1px solid #d0d0bf; }
        /* The selection of the lists */
        a.item.sel, .result.sel { background: #316ac5; color: #ffffff; }
        a.item.sel .meta, .result.sel .meta { color: inherit; opacity: 0.85; }
        a.item.sel mark, .result.sel mark { background: none; color: inherit; text-decoration: underline; }
        /* Group boxes: the title on the border */
        .tile, .guide-card { border: 1px solid #d0d0bf; border-radius: 3px; }
        .tile h4, .guide-card h4 { font-family: var(--ap-font); font-size: 11px; font-weight: 700; text-shadow: none; }
        .tile h4 { font-size: 13px; color: var(--ap-link); }
        .sem { position: relative; margin-top: 12px; padding: 12px 10px 8px; border: 1px solid #d0d0bf; border-radius: 3px; }
        .sem-head { position: absolute; top: -11px; left: 8px; right: 8px; }
        .sem-head .sem-title { flex: none; padding: 0 4px; background: var(--ap-win-bg); color: var(--ap-link); font-family: var(--ap-font); font-size: 11px; font-weight: 400; }
        .tile .sem-head .sem-title { background: var(--ap-surface); }
        .sem-head .mak-fold { margin-left: auto; }
        .exams li { border-radius: 3px; background: var(--ap-surface); }
        /* The panels of tasks: the head (white to blue, a round button), the body in light blue */
        :host(.in-block) .box > .head { margin: 0; padding: 5px 8px 5px 12px; background: linear-gradient(90deg, #ffffff 0%, #c6d3f7 100%); color: #215dc6;
          border-radius: 5px 5px 0 0; }
        :host(.in-block) .box > .head .title { font-family: var(--ap-font); font-size: 12px; font-weight: 700; text-shadow: none; }
        :host(.in-block) .box > .head + * { padding: 10px; background: var(--ap-accent-soft); border: 1px solid #ffffff; border-top: 0; }
        :host(.in-block) .box > .head .mak-fold, .sem .mak-fold { width: 20px; height: 20px; border-radius: 50%; color: #215dc6; border: 1px solid #ffffff;
          background: linear-gradient(180deg, #ffffff 0%, #c6d3f7 100%); box-shadow: 0 0 0 1px #8aa4d8; }
        .mak-fold svg { width: 14px; height: 14px; }
        /* The actions: the links of a panel of tasks, the green arrow first */
        .actions { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 10px 12px; background: var(--ap-accent-soft);
          border: 1px solid #ffffff; border-radius: 3px; }
        .actions .action { min-height: 0; padding: 0; gap: 6px; flex-direction: row-reverse; background: none; border: 0; box-shadow: none; color: var(--ap-link);
          font-weight: 400; text-decoration: underline; text-decoration-color: transparent; }
        .actions .action:hover, .actions .action:focus-visible { filter: none; box-shadow: none; text-decoration-color: currentColor; }
        .actions .action .mak-arrow, .actions button.action::after { width: 16px; height: 16px; }
        .actions button.action::after { content: ""; flex: none; background: url("data:image/svg+xml,${encodeURIComponent(XP_ARROW)}") center / contain no-repeat; }
        /* The links: the green arrow first */
        .mak-link { display: inline-flex; flex-direction: row-reverse; align-items: center; gap: 4px; }
        .mak-link .mak-arrow { margin-left: 0; width: 14px; height: 14px; }
        /* The weights: a progress bar */
        .bar.weights { height: 16px; padding: 1px; gap: 1px; border: 1px solid #686868; border-radius: 3px; background: #ffffff; }
        .bar.weights span { border-radius: 2px; font-size: 10px; }
        /* The next exam: the days in large, in the blue of the titles */
        .next-exam { background: var(--ap-accent-soft); border: 1px solid #ffffff; border-radius: 3px; }
        .next-exam .day { font-size: 34px; color: var(--ap-link); text-shadow: none; }
        .next-exam .count { font-size: 1.15em; }
      `
    },

    // ---- 7 · Cuaderno: a real notebook. A page with lines, a red margin and a spiral; blue pen; sticky
    // notes with washi tape, index cards, dividers with tabs, highlighters, and erasers for the buttons.
    // The dark mode: a notebook of black paper and a white gel pen (the notes and the erasers stay as they are).
    {
      id: 'cuaderno',
      name: { es: 'Cuaderno', en: 'Notebook' },
      about: { es: 'Hojas rayadas con espiral, post-its, separadores, resaltador y gomas de borrar.', en: 'Lined pages with a spiral, sticky notes, dividers, a highlighter and erasers.' },
      fonts: [
        { family: 'AP Caveat', file: 'caveat.woff2', weight: '400 700' },
        { family: 'AP Patrick Hand', file: 'patrick-hand.woff2', weight: '400' }
      ],
      icons: {
        pencil: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6.2 14.6L15.8 5l3.2 3.2-9.6 9.6z" fill="#f5c542" stroke="#6b4e0e" stroke-width=".8"/><path d="M7.9 16.3l9.5-9.5" stroke="#dca21c" stroke-width="1.3"/><path d="M15.8 5l1.4-1.4a1.2 1.2 0 0 1 1.7 0l1.5 1.5a1.2 1.2 0 0 1 0 1.7L19 8.2z" fill="#ef9aa6" stroke="#7a3644" stroke-width=".8"/><path d="M15 5.8l3.2 3.2" stroke="#9aa0a8" stroke-width="1.7"/><path d="M6.2 14.6L4 20l5.4-2.2z" fill="#f1d3a6" stroke="#6b4e0e" stroke-width=".8" stroke-linejoin="round"/><path d="M4 20l.9-2.3 1.4 1.4z" fill="#2b2b2b"/></svg>',
        mail: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2.5" y="5.5" width="19" height="13" rx="1" fill="#fbf7ec"/><rect x="2.5" y="5.5" width="19" height="13" rx="1" fill="none" stroke="#d8434b" stroke-width="1.6" stroke-dasharray="2.2 2.2"/><rect x="2.5" y="5.5" width="19" height="13" rx="1" fill="none" stroke="#2b4fb3" stroke-width="1.6" stroke-dasharray="2.2 2.2" stroke-dashoffset="2.2"/><path d="M4.2 7.2l7.8 5.8 7.8-5.8" fill="none" stroke="#6a5a3a" stroke-width="1"/></svg>'
      },
      light: {
        font: '"AP Patrick Hand", "Patrick Hand", "Comic Sans MS", cursive',
        'font-head': '"AP Caveat", "Caveat", "Comic Sans MS", cursive',
        'font-num': '"AP Caveat", "Caveat", "Comic Sans MS", cursive',
        zoom: '1.1',
        'head-weight': '700',
        'head-zoom': '1.45',
        // The page: lines on cream paper
        page: `${NOISE(0.05)}, ${RULED('rgba(88, 132, 205, 0.33)')}, #fbf8ef`,
        'win-bg': 'var(--ap-page)',
        surface: '#fffdf7', // an index card
        solid: '#fbf8ef',
        surface2: '#eadcbc', // a divider of cardboard
        // The blue pen
        fg: '#1d2a78',
        muted: '#58619a',
        line: 'rgba(29, 42, 120, 0.28)',
        edge: 'rgba(80, 60, 20, 0.15)',
        accent: '#d8434b', // the red pen (the margin, the circles)
        'accent-fg': '#ffffff',
        'accent-soft': '#fdf09a', // the yellow sticky note
        link: '#1f45c0',
        red: '#cf2b2b', 'red-bg': '#fde3e0',
        orange: '#b8580f', 'orange-bg': '#fde9d2',
        yellow: '#7a6400', 'yellow-bg': '#fdf6c2',
        green: '#2c7a3a', 'green-bg': '#e1f1dc',
        blue: '#1f45c0', 'blue-bg': '#d9e4f2',
        grey: '#58619a', 'grey-bg': '#ece7da',
        'mark-bg': 'linear-gradient(100deg, rgba(255, 226, 60, 0) 1%, rgba(255, 226, 60, 0.85) 4%, rgba(255, 220, 40, 0.75) 95%, rgba(255, 226, 60, 0) 99%)',
        // The titles: written on the page, a line in pen under them
        'head-bg': 'transparent',
        'head-fg': '#1d2a78',
        'head-line': '0 solid transparent',
        'head-btn-bg': 'transparent',
        'head-btn-fg': '#1d2a78',
        'head-btn-edge': '#1d2a78',
        'head-btn-size': '28px',
        'title-deco': `${PEN_LINE('#2b3fae')} left bottom / 100% 8px no-repeat`,
        'title-pad': '6px',
        // The buttons: erasers (a white one; the main one pink)
        'btn-bg': RUBBER('#f5f2ea'),
        'btn-fg': '#1d2a78',
        'btn-edge': 'rgba(0, 0, 0, 0.1)',
        'primary-bg': RUBBER('#f3a2a8'),
        'primary-fg': '#1d2a78',
        'primary-edge': 'rgba(120, 30, 40, 0.22)',
        radius: '4px',
        'radius-sm': '9px',
        'radius-box': '3px',
        bw: '0px',
        'bw-sm': '1px',
        // The page: the pages under it
        shadow: '0 1px 1px rgba(0, 0, 0, 0.12), 2px 3px 0 -1px #f3eee0, 2px 3px 1px -1px rgba(0, 0, 0, 0.2), 4px 6px 0 -2px #ebe4d2, 4px 6px 1px -2px rgba(0, 0, 0, 0.2), 0 12px 20px -10px rgba(0, 0, 0, 0.45)',
        // The thickness of an eraser
        'shadow-sm': 'inset 0 1px 0 rgba(255, 255, 255, 0.6), inset 0 -2px 3px rgba(0, 0, 0, 0.08), 0 3px 0 -1px rgba(0, 0, 0, 0.2), 0 6px 8px -4px rgba(0, 0, 0, 0.45)',
        'shadow-pop': '0 2px 3px rgba(0, 0, 0, 0.2), 0 22px 44px -12px rgba(0, 0, 0, 0.55)',
        backdrop: 'rgba(30, 24, 12, 0.4)',
        'item-sep': '0 solid transparent',
        'item-pad': '7px 2px',
        // The countdowns: written with the pen; a red circle when it is close
        'count-fg': '#1d2a78',
        'count-size': '1.35em',
        'count-pad': '0 6px',
        'count-radius': '50% 45% 55% 48% / 55% 50% 45% 52%',
        'count-soon-fg': '#c2570c',
        'count-hot-fg': '#d0262b',
        'count-hot-edge': '#d0262b',
        'count-ok-fg': '#2c7a3a',
        'count-ok-edge': '#2c7a3a',
        // The fields: a box drawn with the pen
        'input-bg': 'rgba(255, 255, 255, 0.5)',
        'input-fg': '#1d2a78',
        'input-edge': '#2b3a8f',
        'input-radius': '12px 16px 10px 14px / 14px 10px 16px 12px',
        'logo-bg': 'transparent',
        'logo-ring': '#1f45c0',
        'logo-dot': '#d8434b',
        // The weights: highlighters
        'k-exam': 'rgba(255, 210, 0, 0.82)', 'k-exam-fg': '#1d2a78',
        'k-practice': 'rgba(255, 110, 170, 0.6)', 'k-practice-fg': '#1d2a78',
        'k-work': 'rgba(80, 210, 110, 0.6)', 'k-work-fg': '#1d2a78',
        'k-participation': 'rgba(255, 150, 40, 0.65)', 'k-participation-fg': '#1d2a78',
        'k-presentation': 'rgba(90, 170, 255, 0.6)', 'k-presentation-fg': '#1d2a78',
        'k-other': 'rgba(160, 160, 160, 0.5)', 'k-other-fg': '#1d2a78'
      },
      dark: {
        page: `${NOISE(0.12)}, ${RULED('rgba(150, 178, 230, 0.17)')}, #1f1e1c`,
        surface: '#2d2b28',
        solid: '#1f1e1c',
        surface2: '#3b3428',
        // The white gel pen
        fg: '#eeebe3',
        muted: '#aca79d',
        line: 'rgba(238, 235, 227, 0.25)',
        edge: 'rgba(0, 0, 0, 0.5)',
        accent: '#ff8a80',
        'accent-fg': '#1f1e1c',
        'accent-soft': '#e8d978',
        link: '#93b8ff',
        red: '#ff8a80', 'red-bg': '#4a2420',
        orange: '#ffb070', 'orange-bg': '#45301a',
        yellow: '#f1d86a', 'yellow-bg': '#3d3518',
        green: '#8fd49a', 'green-bg': '#1f3a26',
        blue: '#93b8ff', 'blue-bg': '#283245',
        grey: '#aca79d', 'grey-bg': '#2d2b28',
        'mark-bg': 'linear-gradient(100deg, rgba(255, 214, 0, 0) 1%, rgba(255, 214, 0, 0.55) 4%, rgba(255, 208, 0, 0.5) 95%, rgba(255, 214, 0, 0) 99%)',
        'head-fg': '#eeebe3',
        'head-btn-fg': '#eeebe3',
        'head-btn-edge': '#eeebe3',
        'title-deco': `${PEN_LINE('#93b8ff')} left bottom / 100% 8px no-repeat`,
        shadow: '0 1px 1px rgba(0, 0, 0, 0.4), 2px 3px 0 -1px #2a2926, 2px 3px 1px -1px rgba(0, 0, 0, 0.6), 4px 6px 0 -2px #252421, 4px 6px 1px -2px rgba(0, 0, 0, 0.6), 0 12px 20px -10px rgba(0, 0, 0, 0.8)',
        'shadow-pop': '0 2px 3px rgba(0, 0, 0, 0.5), 0 22px 44px -12px rgba(0, 0, 0, 0.85)',
        backdrop: 'rgba(0, 0, 0, 0.6)',
        'count-fg': '#eeebe3',
        'count-soon-fg': '#ffb070',
        'count-hot-fg': '#ff8a80',
        'count-hot-edge': '#ff8a80',
        'count-ok-fg': '#8fd49a',
        'count-ok-edge': '#8fd49a',
        'input-bg': 'rgba(255, 255, 255, 0.05)',
        'input-fg': '#eeebe3',
        'input-edge': '#cfcabe',
        'logo-ring': '#93b8ff',
        'logo-dot': '#ff8a80',
        'k-exam': 'rgba(255, 214, 40, 0.88)', 'k-exam-fg': '#1d1b16',
        'k-practice': 'rgba(255, 130, 185, 0.85)', 'k-practice-fg': '#1d1b16',
        'k-work': 'rgba(110, 220, 135, 0.85)', 'k-work-fg': '#1d1b16',
        'k-participation': 'rgba(255, 165, 70, 0.88)', 'k-participation-fg': '#1d1b16',
        'k-presentation': 'rgba(120, 185, 255, 0.85)', 'k-presentation-fg': '#1d1b16',
        'k-other': 'rgba(190, 190, 190, 0.75)', 'k-other-fg': '#1d1b16'
      },
      // The block of "Mi sitio": a page with the spiral on the left and the red margin.
      blockCss: `
        #mak-block { position: relative; margin-top: 6px; background: ${MARGIN}, var(--ap-win-bg) !important; }
        #mak-block::before { ${SPIRAL} }
        #mak-block > .mak-head { padding: 12px 14px 2px 46px; }
        #mak-block > #mak-block-body { padding: 4px 16px 16px 46px; }
        #mak-block .mak-title { font-size: calc(21px * var(--ap-head-zoom)); }
        #mak-block .mak-head .mak-fold { border-width: 1.6px; border-radius: 5px 8px 6px 7px / 7px 5px 8px 6px; box-shadow: none; }
      `,
      css: `
        /* ---- The popup: the page, the spiral on the edge, the red margin ---- */
        body { position: relative; background: ${MARGIN}, var(--ap-page); }
        body::before { ${SPIRAL} }
        body.wide::before { position: fixed; } /* the tab: the page is the window */
        header.top { padding: 10px 12px 2px 46px; }
        header.top h1 { font-size: calc(19px * var(--ap-head-zoom)); }
        .searchbar { padding: 6px 12px 8px 46px; }
        .searchbar input { padding-left: 32px; background: ${LENS} 9px center / 16px no-repeat, var(--ap-input-bg); }
        main { margin: 0 8px 4px 40px; padding: 10px 6px 12px 6px; background: none; border: 0; border-radius: 0; box-shadow: none; }
        footer.privacy { padding-left: 46px; }
        /* The tabs: the tabs of the dividers, of colored cardboard */
        nav.tabs { gap: 3px; padding: 4px 8px 0 42px; border-bottom: 2px solid var(--ap-line); }
        nav.tabs button { flex: 1 1 auto; min-width: 0; margin-bottom: -2px; padding: 4px 2px 1px; overflow: hidden; text-overflow: ellipsis;
          font-family: var(--ap-font-head); font-size: 1.12em; font-weight: 700; color: #1d2a78; border: 0; border-radius: 9px 9px 0 0;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0) 60%), ${NOISE(0.08)}, var(--nb-tab);
          box-shadow: inset 0 -7px 6px -6px rgba(0, 0, 0, 0.35); opacity: 0.82; }
        nav.tabs button:nth-child(6n+1) { --nb-tab: #f2b3b9; } nav.tabs button:nth-child(6n+2) { --nb-tab: #eadbb5; }
        nav.tabs button:nth-child(6n+3) { --nb-tab: #b9d0ee; } nav.tabs button:nth-child(6n+4) { --nb-tab: #c3e2c1; }
        nav.tabs button:nth-child(6n+5) { --nb-tab: #d8cbf0; } nav.tabs button:nth-child(6n+6) { --nb-tab: #f5cfae; }
        nav.tabs button[aria-selected="true"] { color: #1d2a78; opacity: 1; transform: translateY(-3px); box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.14);
          text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 3px; }
        nav.tabs .count-badge { background: #d8434b; color: #ffffff; font-family: var(--ap-font); }
        /* The buttons of the head and the weeks: boxes drawn with the pen */
        .icon-btn { box-shadow: none; border-width: 1.6px; border-radius: 6px 9px 7px 8px / 8px 6px 9px 7px; }
        .week { color: var(--ap-fg); background: none; border: 1.5px solid var(--ap-line); border-radius: 8px 12px 7px 10px / 10px 7px 12px 8px; box-shadow: none; }
        .week.on { outline: 0; border-color: var(--ap-fg); background: var(--ap-mark-bg); }
        .week .n { font-family: var(--ap-font-head); font-size: 1.45em; line-height: 1; }
        .week .track { background: none; border: 1.5px solid var(--ap-line); border-radius: 3px 5px 4px 6px / 6px 4px 5px 3px; }
        .week .bar { opacity: 0.85; }
        /* A note after an update: a sticky note */
        .whatsnew { --ap-fg: #1d2a78; color: #1d2a78; border: 0; border-radius: 2px; transform: rotate(-0.8deg); ${NOTE('var(--ap-accent-soft)')} }
        .notice { border: 2px solid var(--ap-red); border-radius: 12px 16px 10px 14px / 14px 10px 16px 12px; background: none; }
        .tag { font-family: var(--ap-font-head); font-size: 1.1em; background: none; border: 1.5px solid currentColor; border-radius: 10px 14px 9px 12px / 12px 9px 14px 10px; }

        /* ---- The parts in MiAulario ---- */
        /* The titles: written on the page, a line in pen under them */
        .tile h4 { display: inline-block; padding-bottom: var(--ap-title-pad); background: var(--ap-title-deco); }
        .tile { padding: 0; background: none; border: 0; border-radius: 0; box-shadow: none; }
        /* The arrows: a box drawn with the pen */
        .mak-fold { color: var(--ap-fg) !important; background: transparent !important; border: 1.6px solid currentColor !important; box-shadow: none !important;
          border-radius: 5px 8px 6px 7px / 7px 5px 8px 6px !important; }
        /* The next exam: a yellow sticky note with tape */
        .next-exam { --ap-fg: #1d2a78; --ap-muted: #4c5590; --ap-count-fg: #1d2a78; --ap-count-soon-fg: #c2570c; --ap-count-hot-fg: #d0262b; --ap-count-hot-edge: #d0262b;
          position: relative; margin: 16px 6px 18px; padding: 16px 18px 14px; color: #1d2a78; border: 0; transform: rotate(-1.2deg);
          ${NOTE('var(--ap-accent-soft)')} }
        .next-exam::before { ${TAPE('rgba(240, 150, 168, 0.62)')} }
        .next-exam .day { font-size: 60px; }
        .next-exam .count { font-size: 1.6em; }
        /* The semesters: dividers of cardboard, with the tab on top */
        .sem { --nb-folder: var(--ap-surface2); position: relative; margin-top: 30px; padding: 6px 10px 12px; border: 0; border-radius: 0 6px 6px 6px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0) 40%), ${NOISE(0.08)}, var(--nb-folder);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18), 0 7px 10px -8px rgba(0, 0, 0, 0.45); }
        .sem + .sem { --nb-folder: var(--ap-blue-bg); }
        .sem-head { justify-content: flex-end; min-height: 26px; }
        .sem-head .sem-title { position: absolute; left: 0; bottom: 100%; flex: none; padding: 3px 18px 0; border-radius: 10px 10px 0 0;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0) 70%), ${NOISE(0.08)}, var(--nb-folder);
          font-size: calc(15px * var(--ap-head-zoom)); box-shadow: 0 -1px 2px rgba(0, 0, 0, 0.12); }
        .sem .mak-fold { width: 24px; height: 24px; }
        /* The exams: index cards */
        .exams { gap: 12px; }
        .exams li { padding: 8px 10px; border: 0; border-radius: 2px; background: var(--ap-surface);
          box-shadow: 0 1px 1px rgba(0, 0, 0, 0.15), 0 5px 8px -5px rgba(0, 0, 0, 0.4); }
        .exams li:nth-child(odd) { transform: rotate(-0.6deg); }
        .exams li:nth-child(even) { transform: rotate(0.5deg); }
        .exams .name { font-family: var(--ap-font-head); font-size: 1.25em; line-height: 1.1; }
        .count.hot, .count.ok, .countdown.u-hot, .tag.ok { border: 2px solid var(--ap-count-hot-edge); }
        .count.ok, .tag.ok { border-color: var(--ap-count-ok-edge); }
        /* The links: blue pen */
        .mak-link .t { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
        /* The actions: three erasers */
        .actions { gap: 18px; padding: 8px 4px 6px; }
        .actions .action { min-height: 50px; padding: 8px 14px; color: #1d2a78; border: 0; border-radius: 11px; box-shadow: var(--ap-shadow-sm);
          font-family: var(--ap-font-head); font-size: 1.45em; font-weight: 700; }
        .actions .action:nth-child(3n+1) { background: ${RUBBER('#f3a2a8')}; transform: rotate(-1.5deg); }
        .actions .action:nth-child(3n+2) { background: ${RUBBER('linear-gradient(90deg, #5a82c8 0 24%, #f5f2ea 24%)')}; padding-left: calc(24% + 10px); transform: rotate(1deg); }
        .actions .action:nth-child(3n+3) { background: ${RUBBER('linear-gradient(90deg, #f5f2ea 0 12%, #a3cbaa 12% 88%, #f5f2ea 88%)')}; transform: rotate(-0.6deg); }
        .actions .action:hover, .actions .action:focus-visible { filter: brightness(0.97); translate: 0 -1px; }
        /* The course guides: sticky notes of colors, with tape */
        .guide-card { --ap-fg: #1d2a78; --ap-muted: #4c5590; --ap-link: #1f45c0; --ap-line: rgba(29, 42, 120, 0.25);
          position: relative; margin-top: 10px; padding: 14px 14px 12px; color: #1d2a78; border: 0; ${NOTE('var(--nb-note)')} }
        .guide-card:nth-child(4n+1) { --nb-note: color-mix(in srgb, #ddd0f4 85%, var(--ap-solid)); --nb-tape: rgba(150, 200, 175, 0.62); transform: rotate(-0.7deg); }
        .guide-card:nth-child(4n+2) { --nb-note: color-mix(in srgb, #cdeacf 85%, var(--ap-solid)); --nb-tape: rgba(240, 150, 168, 0.6); transform: rotate(0.6deg); }
        .guide-card:nth-child(4n+3) { --nb-note: color-mix(in srgb, #fcd8c2 85%, var(--ap-solid)); --nb-tape: rgba(150, 185, 235, 0.62); transform: rotate(0.4deg); }
        .guide-card:nth-child(4n+4) { --nb-note: color-mix(in srgb, #cfe1f6 85%, var(--ap-solid)); --nb-tape: rgba(245, 210, 110, 0.66); transform: rotate(-0.5deg); }
        .guide-card::before { ${TAPE('var(--nb-tape)')} }
        .guide-card h4 { font-size: calc(16px * var(--ap-head-zoom)); }
        /* The weights: strokes of highlighter */
        .bar.weights { gap: 3px; height: 23px; overflow: visible; border: 0; border-radius: 0; }
        .bar.weights span { border-radius: 3px 11px 4px 12px / 11px 3px 12px 4px; text-shadow: none; }
        /* The table of a course guide: a sheet glued on the page, a little tilted, with tape on two corners
           (on a sticky note, only the table) */
        .content table { position: relative; width: calc(100% - 20px); margin: 34px 10px 20px; background: var(--ap-surface); transform: rotate(-0.4deg);
          box-shadow: 0 0 0 10px var(--ap-surface), 0 1px 2px 10px rgba(0, 0, 0, 0.1), 0 12px 18px 5px rgba(0, 0, 0, 0.24); }
        .content table::before { ${TAPE_LOOK('rgba(245, 210, 110, 0.66)')} top: -20px; left: -30px; width: 72px; transform: rotate(-36deg); }
        .content table::after { ${TAPE_LOOK('rgba(240, 150, 168, 0.62)')} top: -20px; right: -30px; width: 72px; transform: rotate(36deg); }
        .guide-card table { width: 100%; margin: 6px 0 4px; background: none; transform: none; box-shadow: none; }
        .guide-card table::before, .guide-card table::after { content: none; }
        /* The windows and the search: a sheet of paper; the selection with the highlighter */
        .backdrop .win > header, .mail > header { border-bottom: 0; }
        a.item.sel, .result.sel { background: var(--ap-mark-bg); }
        .panel > input { margin: 12px 14px 4px; padding: 6px 12px; border: 1.6px solid var(--ap-input-edge); border-radius: var(--ap-input-radius); background: var(--ap-input-bg); }
        .panel > .foot { border-top: 0; }
      `
    }
  ];

  MAK.DEFAULT_THEME = 'bloques';
  MAK.themeIds = () => MAK.THEMES.map((th) => th.id);
  // The theme with this id, else the default theme.
  MAK.theme = (id) => MAK.THEMES.find((th) => th.id === id) || MAK.THEMES.find((th) => th.id === MAK.DEFAULT_THEME) || MAK.THEMES[0];
  // The name of a theme in the language of the user.
  MAK.themeName = (th, lang) => (th.name && (th.name[lang] || th.name.es)) || th.id;
  MAK.themeAbout = (th, lang) => (th.about && (th.about[lang] || th.about.es)) || '';
  // The name of the extension in the titles: the name of the theme ("Aulario XP"), else "Aulario Plus".
  MAK.brandName = (th) => (th || MAK.theme(MAK.themeId)).brand || 'Aulario Plus';

  // All the variables of a theme for one mode: BASE (light, then dark in the dark mode), then the light
  // values of the theme, then (dark) the dark values of the theme. { name: value }.
  MAK.themeValues = function (id, dark) {
    const th = MAK.theme(id);
    return Object.assign({}, BASE.light, dark ? BASE.dark : null, th.light, dark ? th.dark : null);
  };
  MAK.THEME_VARS = Object.keys(BASE.light);

  // The icons that a theme can draw again (MAK.icon, lib/ui.js). theme.icons: { name: '<svg …>' }.
  MAK.ICON_NAMES = ['pencil', 'mail', 'chevron', 'calc', 'arrow'];
  // CSS that shows the drawing of the theme (an SVG in a data: URL) instead of the lines of the icon.
  MAK.themeIconCss = function (th) {
    return Object.entries(th.icons || {})
      .map(([name, svg]) => `svg.ap-icon-${name} { background: url("data:image/svg+xml,${encodeURIComponent(svg)}") center / contain no-repeat; } svg.ap-icon-${name} > * { display: none; }`)
      .join('\n');
  };

  // "--ap-name: value;" for all the variables (a CSS declaration block).
  MAK.themeVars = function (id, dark) {
    return Object.entries(MAK.themeValues(id, dark)).map(([k, v]) => `--ap-${k}: ${v};`).join(' ');
  };

  // The @font-face rules of the fonts of the themes (the popup and the tools page: the browser loads
  // a file only when a text uses it). url: (file) => the address of fonts/<file>.
  MAK.fontFaceCss = function (themes, url) {
    const seen = new Set();
    const out = [];
    for (const th of themes) {
      for (const f of th.fonts || []) {
        const key = `${f.family}|${f.file}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(`@font-face { font-family: "${f.family}"; src: url("${url(f.file)}") format("woff2"); font-weight: ${f.weight || '400'}; font-style: ${f.style || 'normal'}; font-display: swap; }`);
      }
    }
    return out.join('\n');
  };

  // The motion of the extension: every change of a color, a shadow, a filter or a place (on hover, on focus,
  // on a click) takes 0.18 s; none with reduced motion. scope: the elements (a selector).
  MAK.motionCss = (scope) => `${scope} { transition: color 0.18s ease, background-color 0.18s ease, border-color 0.18s ease, outline-color 0.18s ease,
    box-shadow 0.18s ease, filter 0.18s ease, opacity 0.18s ease, transform 0.18s ease, translate 0.18s ease, text-decoration-color 0.18s ease; }
    @media (prefers-reduced-motion: reduce) { ${scope} { transition: none !important; } }`;
  const ALL = '*, *::before, *::after';

  // The mode (light or dark) of the pages of the extension: 'light', 'dark' or 'system' (the setting of
  // the system). colorMode 'auto': the mode of MiAulario (sakaiMode, from content-theme.js), else the system.
  MAK.pageScheme = function (colorMode, sakaiMode) {
    if (colorMode === 'light' || colorMode === 'dark') return colorMode;
    return sakaiMode === 'light' || sakaiMode === 'dark' ? sakaiMode : 'system';
  };

  // The CSS of a theme for a page of the extension (the popup, the tools page): the fonts of all the
  // themes (for the previews of the settings), the variables of the mode (scheme: 'light', 'dark', or
  // 'system': light, and dark with prefers-color-scheme) and the CSS of the theme.
  MAK.pageThemeCss = function (id, url, scheme) {
    const th = MAK.theme(id);
    const vars = scheme === 'light' || scheme === 'dark'
      ? [`:root { color-scheme: ${scheme}; ${MAK.themeVars(th.id, scheme === 'dark')} }`]
      : [`:root { color-scheme: light dark; ${MAK.themeVars(th.id, false)} }`, `@media (prefers-color-scheme: dark) { :root { ${MAK.themeVars(th.id, true)} } }`];
    return [MAK.fontFaceCss(MAK.THEMES, url), ...vars, MAK.motionCss(ALL), th.css || '', MAK.themeIconCss(th)].join('\n');
  };

  // Put the theme on a page of the extension: <html data-theme="…" data-scheme="…"> and one
  // <style id="ap-theme">; the elements with "data-brand" get the name of the theme. Result: { id, scheme }.
  MAK.applyPageTheme = function (doc, id, url, scheme) {
    const th = MAK.theme(id);
    const mode = scheme === 'light' || scheme === 'dark' ? scheme : 'system';
    let style = doc.getElementById('ap-theme');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'ap-theme';
      (doc.head || doc.documentElement).append(style);
    }
    const css = MAK.pageThemeCss(th.id, url || ((f) => `fonts/${f}`), mode);
    if (style.textContent !== css) style.textContent = css;
    doc.documentElement.dataset.theme = th.id;
    doc.documentElement.dataset.scheme = mode;
    for (const el of doc.querySelectorAll('[data-brand]')) el.textContent = MAK.brandName(th);
    return { id: th.id, scheme: mode };
  };

  // ---- MiAulario: the shadow roots of the content scripts -----------------------------------------
  // MAK.themedStyle(css) gives a <style> for a shadow root: the variables of the theme (on :host, for
  // the dark or the light theme of the page), the CSS of the part, then the CSS of the theme. The
  // content scripts keep the list of these styles and draw them again when the user selects another
  // theme (content-theme.js).
  const styles = new Set();
  MAK.themeId = MAK.DEFAULT_THEME;
  function themedText(css, opts) {
    const th = MAK.theme(MAK.themeId);
    const dark = typeof MAK.isDarkPage === 'function' && MAK.isDarkPage();
    const scope = (opts && opts.scope) || ':host';
    const own = opts && opts.scope ? th.blockCss || '' : `${th.css || ''}\n${MAK.themeIconCss(th)}`; // the block: its own CSS
    const motion = MAK.motionCss(opts && opts.scope ? `${scope}, ${scope} *, ${scope}::before, ${scope} *::before, ${scope} *::after` : ALL);
    return `${scope} { ${MAK.themeVars(th.id, dark)} }\n${motion}\n${css}\n${own}`;
  }
  // opts.scope: a selector for a style in the page (not in a shadow root); then the variables and the
  // blockCss of the theme (the only style in the page is the one of the block).
  MAK.themedStyle = function (css, opts) {
    const el = document.createElement('style');
    el.textContent = themedText(css, opts);
    styles.add({ el, css, opts, seen: false });
    return el;
  };
  MAK.refreshThemedStyles = function () {
    for (const s of [...styles]) {
      if (s.el.isConnected) s.seen = true;
      else if (s.seen) { styles.delete(s); continue; }
      const text = themedText(s.css, s.opts);
      if (s.el.textContent !== text) s.el.textContent = text;
    }
  };

  // The fonts of a theme in a page of MiAulario. The fonts must be in the document (a @font-face in a
  // shadow root does not work). First FontFace with the bytes of the file (the page does not load
  // anything), else a @font-face rule with the address of the file (web_accessible_resources).
  const loaded = new Set();
  MAK.loadPageFonts = async function (id, url) {
    const th = MAK.theme(id);
    for (const f of th.fonts || []) {
      const key = `${f.family}|${f.file}`;
      if (loaded.has(key)) continue;
      loaded.add(key);
      try {
        const buf = await (await fetch(url(f.file))).arrayBuffer();
        const face = new FontFace(f.family, buf, { weight: f.weight || '400', style: f.style || 'normal' });
        await face.load();
        document.fonts.add(face);
      } catch {
        const style = document.createElement('style');
        style.textContent = MAK.fontFaceCss([{ fonts: [f] }], url);
        (document.head || document.documentElement).append(style);
      }
    }
  };

  if (typeof module === 'object' && module.exports) module.exports = MAK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
