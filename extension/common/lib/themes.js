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
// set has the value of BASE (light or dark). Its own CSS goes into every part (the popup, each shadow root): use the class
// names of the parts, and :host for a shadow root. Nothing from other servers: the fonts are files of the
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
      'radius-sm': '6px', // the buttons, the fields and the small parts
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

  // The paper of "Cuaderno" (fractal noise, an SVG in a data: URL).
  const NOISE = (alpha) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .3 0 0 0 0 .26 0 0 0 0 .2 0 0 0 ${alpha} 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
  // A red scribble under a title (Cuaderno).
  const SCRIBBLE = (color) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 10' preserveAspectRatio='none'%3E%3Cpath d='M2 6 C 40 2, 70 9, 110 5 S 170 3, 198 6' stroke='${encodeURIComponent(color)}' stroke-width='2.4' fill='none' stroke-linecap='round' vector-effect='non-scaling-stroke'/%3E%3C/svg%3E")`;
  const GRID = (c) => `linear-gradient(${c} 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, ${c} 1px, transparent 1px) 0 0 / 22px 22px`;
  const HATCH = (deg, c) => `repeating-linear-gradient(${deg}deg, ${c} 0 1.5px, transparent 1.5px 6px)`;

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
        'win-bg': 'linear-gradient(rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.4)), radial-gradient(circle 70px at 94% 90px, #fff4f7 0%, #ffd6e4 48%, #b9c8f5 98%, transparent 100%), radial-gradient(640px 420px at 0% 0%, #ffd9c6, transparent 62%), radial-gradient(640px 440px at 100% 45%, #c6dcfb, transparent 60%), radial-gradient(640px 420px at 40% 100%, #f5c9e0, transparent 62%), #f1ecf5',
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
        'win-bg': 'linear-gradient(rgba(19, 20, 42, 0.35), rgba(19, 20, 42, 0.35)), radial-gradient(circle 70px at 94% 90px, #d9ccb0 0%, #a89a7e 50%, #4f5888 98%, transparent 100%), radial-gradient(640px 460px at 10% 0%, #2b2d5a, transparent 60%), radial-gradient(640px 460px at 100% 100%, #3d2348, transparent 60%), #13142a',
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
        .exams li, .guide-card, .sem, .tile { background: rgba(255, 255, 255, 0.28); border: 1px solid var(--ap-edge); }
        .next-exam .day { width: 92px; height: 92px; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 50%;
          background: radial-gradient(circle at 34% 28%, #fff 0%, #ffe3ec 42%, #c9d6fb 100%); box-shadow: 0 18px 30px -12px rgba(110, 80, 160, 0.5); color: #2a2740; font-size: 34px; line-height: 0.9; }
        .next-exam .day small { font-size: 16px; }
        .actions .action { color: var(--ap-btn-fg); background: var(--ap-btn-bg); border: 1px solid var(--ap-btn-edge); border-radius: 999px; }
        .actions .action .label { display: none; }
        .bar.weights { height: 10px; border-radius: 99px; gap: 0; }
        .bar.weights span { color: transparent; }
      `
    },

    // ---- 6 · Cromo: Y2K Aesthetic ----------------------------------------------------------------
    {
      id: 'cromo',
      name: { es: 'Cromo', en: 'Chrome' },
      about: { es: 'El escritorio del 2002: barras brillantes, botones de gel y pantallas LCD.', en: 'The desktop of 2002: glossy title bars, gel buttons and LCD screens.' },
      fonts: [
        { family: 'AP Rubik', file: 'rubik.woff2', weight: '500 900' },
        { family: 'AP Silkscreen', file: 'silkscreen.woff2', weight: '400' }
      ],
      light: {
        font: 'Verdana, Tahoma, "DejaVu Sans", sans-serif',
        'font-head': '"AP Rubik", "Rubik", Verdana, sans-serif',
        'font-num': '"AP Silkscreen", "Silkscreen", ui-monospace, monospace',
        zoom: '0.95',
        'head-weight': '800',
        page: 'linear-gradient(160deg, #d3efff 0%, #f6e1ff 55%, #fff4d1 100%)',
        surface: '#ffffff',
        solid: '#ffffff',
        surface2: '#eaf3ff',
        fg: '#1b2440',
        muted: '#52607f',
        line: '#c4d4ec',
        edge: '#5d8fd6',
        accent: '#2271f5',
        'accent-fg': '#ffffff',
        'accent-soft': '#dceeff',
        link: '#0b4fd4',
        red: '#c4127a', 'red-bg': '#ffe2f4',
        orange: '#c25100', 'orange-bg': '#fff0dc',
        yellow: '#7a6400', 'yellow-bg': '#fff8c9',
        green: '#2f7d0e', 'green-bg': '#e6fbd0',
        blue: '#0b4fd4', 'blue-bg': '#dceeff',
        grey: '#52607f', 'grey-bg': '#eef2f8',
        'mark-bg': '#fff36b',
        'head-bg': 'linear-gradient(#a5dcff 0%, #4b95ff 46%, #2271f5 54%, #4fa2ff 100%)',
        'head-fg': '#ffffff',
        'head-line': '1px solid #2a64c9',
        'head-btn-bg': 'linear-gradient(#7fb6ff, #2a6fe6)',
        'head-btn-fg': '#ffffff',
        'head-btn-edge': '#ffffff',
        'btn-bg': 'linear-gradient(#ffffff 0%, #e6edf6 50%, #d6e0ee 51%, #f1f5fa 100%)',
        'btn-fg': '#1b2440',
        'btn-edge': '#8aa0bf',
        'primary-bg': 'linear-gradient(#a8e0ff 0%, #3d8dff 50%, #1d6af2 51%, #5fb2ff 100%)',
        'primary-fg': '#ffffff',
        'primary-edge': '#1c5bcc',
        radius: '10px',
        'radius-sm': '999px',
        shadow: '0 14px 28px -14px rgba(30, 60, 140, 0.5), 0 0 0 3px rgba(255, 255, 255, 0.55)',
        'shadow-sm': 'inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 2px 4px rgba(0, 40, 120, 0.25)',
        'shadow-pop': '0 20px 40px -10px rgba(30, 60, 140, 0.55), 0 0 0 4px rgba(255, 255, 255, 0.6)',
        backdrop: 'rgba(40, 60, 120, 0.3)',
        'item-sep': '1px dashed #c4d4ec',
        'count-bg': 'linear-gradient(#082234, #0e3550)',
        'count-fg': '#7fe7ff',
        'count-edge': '#000000',
        'count-radius': '6px',
        'count-size': '0.85em',
        'count-weight': '400',
        'count-pad': '4px 7px',
        'count-glow': '0 0 5px rgba(127, 231, 255, 0.8)',
        'count-soon-bg': 'linear-gradient(#2a1c05, #4a3008)',
        'count-soon-fg': '#ffd27a',
        'count-hot-bg': 'linear-gradient(#2b0a2f, #4a1350)',
        'count-hot-fg': '#ff9be3',
        'count-ok-bg': 'linear-gradient(#0f2408, #1d3c10)',
        'count-ok-fg': '#c8ff7a',
        'input-bg': '#ffffff',
        'input-edge': '#7f9db9',
        'input-radius': '2px',
        'logo-bg': '#2271f5',
        'logo-ring': '#ffffff',
        'logo-dot': '#ff4fbf',
        'k-exam': 'repeating-linear-gradient(45deg, #7cc4ff 0 7px, #4ea6ff 7px 14px)', 'k-exam-fg': '#0d1a33',
        'k-practice': 'repeating-linear-gradient(45deg, #ff9fe0 0 7px, #ff6fcd 7px 14px)', 'k-practice-fg': '#330d26',
        'k-work': 'repeating-linear-gradient(45deg, #c4f77d 0 7px, #9be44a 7px 14px)', 'k-work-fg': '#14330a',
        'k-participation': 'repeating-linear-gradient(45deg, #ffe07a 0 7px, #ffc93d 7px 14px)', 'k-participation-fg': '#332605',
        'k-presentation': 'repeating-linear-gradient(45deg, #d6c2ff 0 7px, #b99bff 7px 14px)', 'k-presentation-fg': '#1d0d33',
        'k-other': 'repeating-linear-gradient(45deg, #e3e9f2 0 7px, #cdd6e3 7px 14px)', 'k-other-fg': '#1b2440'
      },
      dark: {
        page: 'linear-gradient(160deg, #0f1730 0%, #22123a 55%, #2a2210 100%)',
        surface: '#1b2134',
        solid: '#1b2134',
        surface2: '#263049',
        'accent-soft': '#1c2f55',
        fg: '#e4ecff',
        muted: '#a3b2d6',
        line: '#33415f',
        edge: '#3d6fd8',
        accent: '#4f8dff',
        link: '#8ec0ff',
        red: '#ff8ad4', 'red-bg': '#4a1640',
        orange: '#ffb15c', 'orange-bg': '#3d2a10',
        green: '#b4f06e', 'green-bg': '#20361a',
        blue: '#8ec0ff', 'blue-bg': '#1c2f55',
        grey: '#a3b2d6', 'grey-bg': '#263049',
        'mark-bg': '#a38f00',
        'mark-fg': '#ffffff',
        'head-bg': 'linear-gradient(#4f8dff 0%, #1d4fd6 46%, #0f3db8 54%, #2f6cf0 100%)',
        'head-line': '1px solid #0f3db8',
        'btn-bg': 'linear-gradient(#3a4560 0%, #2a3349 50%, #222a3d 51%, #2e3850 100%)',
        'btn-fg': '#e4ecff',
        'btn-edge': '#4a5a80',
        shadow: '0 14px 28px -14px rgba(0, 0, 0, 0.7), 0 0 0 3px rgba(80, 110, 200, 0.25)',
        'shadow-pop': '0 20px 40px -10px rgba(0, 0, 0, 0.75), 0 0 0 4px rgba(80, 110, 200, 0.3)',
        'item-sep': '1px dashed #33415f',
        'input-bg': '#11182a',
        'input-edge': '#4a5a80'
      },
      css: `
        header.top h1, .box > .head .title, .win > header h2 { text-shadow: 0 1px 0 rgba(0, 0, 0, 0.35); }
        .btn, .mak-btn, .mak-icon, .mak-fold, .chips button { text-shadow: none; }
        .btn.primary, .mak-btn { text-shadow: 0 1px 0 rgba(0, 0, 0, 0.3); }
        .countdown, .count, .tag { border: 1px solid var(--ap-count-edge); letter-spacing: 0.02em; }
        .tag { font-family: var(--ap-font-num); font-size: 10px; }
        nav.tabs { gap: 2px; padding: 6px 8px 0; background: linear-gradient(#f2f7ff, #dce9fb); border-bottom: 1px solid #91b1dd; }
        nav.tabs button { flex: none; padding: 4px 8px; margin-bottom: -1px; border: 1px solid #91b1dd; border-bottom: 0; border-radius: 6px 6px 0 0; background: linear-gradient(#fff, #e4eefc); color: var(--ap-fg); font-size: 11.5px; }
        nav.tabs button[aria-selected="true"] { background: #fff; font-weight: 700; border-top: 3px solid #ff9f1c; }
        a.res.sel, a.item.sel, .result.sel { background: #316ac5; color: #ffffff; }
        a.res.sel .meta, a.item.sel .meta, .result.sel .meta { color: #dbe8ff; }
        .next-exam .day { display: inline-block; padding: 6px 12px; border-radius: 6px; border: 1px solid #000; background: linear-gradient(#082234, #0e3550);
          color: #7fe7ff; text-shadow: 0 0 5px rgba(127, 231, 255, 0.8); font-family: var(--ap-font-num); font-size: 22px; }
        .next-exam { background: var(--ap-surface2); border: 1px solid var(--ap-line); }
        .actions .action:nth-child(3n+2) { background: linear-gradient(#e9ffc5 0%, #a7f24a 50%, #84dd25 51%, #c3fa7a 100%); border-color: #4f9a10; color: #17330a; text-shadow: none; }
        .actions .action:nth-child(3n+3) { background: linear-gradient(#ffc6ee 0%, #ff63c9 50%, #ef34ae 51%, #ff8ed9 100%); border-color: #c4228f; }
        .actions .action { background: var(--ap-primary-bg); color: #fff; border: 1px solid var(--ap-primary-edge); border-radius: 999px; box-shadow: var(--ap-shadow-sm); text-shadow: 0 1px 0 rgba(0, 0, 0, 0.3); }
        .actions .action .label { display: none; }
        .bar.weights { height: 18px; border-radius: 99px; border: 1px solid #7a9cc9; gap: 0; }
        .bar.weights span { border-right: 1px solid rgba(0, 0, 0, 0.15); font-size: 10.5px; }
        .sem, .guide-card { border: 1px solid #c9c9b5; border-radius: 5px; }
        .exams li, .week { border-radius: 8px; }
      `
    },

    // ---- 7 · Cuaderno: Conceptual Sketch + Wabi-Sabi ------------------------------------------------
    {
      id: 'cuaderno',
      name: { es: 'Cuaderno', en: 'Notebook' },
      about: { es: 'Papel, letra a mano, resaltador y un sello rojo. Imperfecto a propósito.', en: 'Paper, handwriting, a highlighter and a red stamp. Imperfect on purpose.' },
      fonts: [
        { family: 'AP Caveat', file: 'caveat.woff2', weight: '400 700' },
        { family: 'AP Patrick Hand', file: 'patrick-hand.woff2', weight: '400' }
      ],
      light: {
        font: '"AP Patrick Hand", "Patrick Hand", "Comic Sans MS", cursive',
        'font-head': '"AP Caveat", "Caveat", "Comic Sans MS", cursive',
        'font-num': '"AP Caveat", "Caveat", "Comic Sans MS", cursive',
        zoom: '1.12',
        'head-weight': '700',
        'head-zoom': '1.45',
        page: `${NOISE(0.09)}, #e9e2d4`,
        surface: `${NOISE(0.07)}, #f6f1e7`,
        solid: '#f6f1e7',
        surface2: '#fff8d6',
        fg: '#2a2622',
        muted: '#6a6259',
        line: 'rgba(42, 38, 34, 0.35)',
        edge: '#2a2622',
        accent: '#c23b22',
        'accent-fg': '#ffffff',
        'accent-soft': '#fde9dc',
        link: '#2f4c73',
        red: '#c23b22', 'red-bg': '#fde9dc',
        orange: '#b0581c', 'orange-bg': '#fbe8d2',
        yellow: '#7d6a12', 'yellow-bg': '#fff5c2',
        green: '#4e6b2e', 'green-bg': '#e8efd9',
        blue: '#2f4c73', 'blue-bg': '#e3eaf3',
        grey: '#6a6259', 'grey-bg': '#ece6da',
        'mark-bg': 'linear-gradient(100deg, transparent 1%, #ffe27a 4%, #ffe27a 95%, transparent 99%)',
        'head-fg': '#2a2622',
        'head-line': '1.5px dashed rgba(42, 38, 34, 0.45)',
        'title-deco': `${SCRIBBLE('#c23b22')} left bottom / 100% 8px no-repeat`,
        'title-pad': '6px',
        'btn-bg': '#f6f1e7',
        'btn-fg': '#2a2622',
        'btn-edge': '#2a2622',
        'primary-bg': '#fff1a6',
        'primary-fg': '#2a2622',
        'primary-edge': '#2a2622',
        radius: '255px 14px 225px 14px / 14px 225px 14px 255px',
        'radius-sm': '15px 255px 15px 225px / 225px 15px 255px 15px',
        bw: '2px',
        'bw-sm': '2px',
        shadow: '3px 4px 0 rgba(42, 38, 34, 0.18)',
        'shadow-sm': '2px 3px 0 #2a2622',
        'shadow-pop': '4px 8px 18px -6px rgba(0, 0, 0, 0.4)',
        backdrop: 'rgba(42, 38, 34, 0.35)',
        'item-sep': '1.5px dashed rgba(42, 38, 34, 0.35)',
        'count-size': '1.35em',
        'count-pad': '0 6px',
        'count-hot-fg': '#c23b22',
        'count-hot-edge': '#c23b22',
        'count-radius': '50% 45% 55% 48% / 55% 50% 45% 52%',
        'count-ok-fg': '#c23b22',
        'count-ok-edge': '#c23b22',
        'input-bg': 'transparent',
        'input-edge': '#2a2622',
        'input-radius': '12px 225px 10px 255px / 225px 10px 255px 12px',
        'logo-bg': 'transparent',
        'logo-ring': '#c23b22',
        'logo-dot': '#2a2622',
        'k-exam': HATCH(45, 'rgba(42, 38, 34, 0.75)'), 'k-exam-fg': '#2a2622',
        'k-practice': HATCH(-45, 'rgba(47, 76, 115, 0.75)'), 'k-practice-fg': '#2a2622',
        'k-work': 'repeating-linear-gradient(0deg, rgba(78, 107, 46, 0.7) 0 1.5px, transparent 1.5px 5px)', 'k-work-fg': '#2a2622',
        'k-participation': 'rgba(194, 59, 34, 0.45)', 'k-participation-fg': '#2a2622',
        'k-presentation': 'radial-gradient(rgba(42, 38, 34, 0.6) 1.2px, transparent 1.6px) 0 0 / 6px 6px', 'k-presentation-fg': '#2a2622',
        'k-other': HATCH(90, 'rgba(42, 38, 34, 0.35)'), 'k-other-fg': '#2a2622'
      },
      dark: {
        page: `${NOISE(0.12)}, #1d362b`,
        surface: `${NOISE(0.1)}, #24433a`,
        solid: '#24433a',
        surface2: '#2e5247',
        'accent-soft': '#4a2d26',
        fg: '#f1efe6',
        muted: '#bcc6b8',
        line: 'rgba(241, 239, 230, 0.3)',
        edge: '#f1efe6',
        accent: '#ff9a85',
        'accent-fg': '#1d362b',
        link: '#bcd8ff',
        red: '#ff9a85', 'red-bg': '#4a2d26',
        orange: '#ffbe85', 'orange-bg': '#4a3a26',
        green: '#c8e6a0', 'green-bg': '#2e4a2e',
        blue: '#bcd8ff', 'blue-bg': '#2a3f52',
        grey: '#bcc6b8', 'grey-bg': '#2e5247',
        'mark-bg': 'linear-gradient(100deg, transparent 1%, rgba(255, 226, 122, 0.35) 4%, rgba(255, 226, 122, 0.35) 95%, transparent 99%)',
        'head-fg': '#f1efe6',
        'head-line': '1.5px dashed rgba(241, 239, 230, 0.4)',
        'title-deco': `${SCRIBBLE('#ff9a85')} left bottom / 100% 8px no-repeat`,
        'btn-bg': '#24433a',
        'btn-fg': '#f1efe6',
        'btn-edge': '#f1efe6',
        'primary-bg': '#3d5a3a',
        'primary-fg': '#f1efe6',
        'primary-edge': '#f1efe6',
        shadow: '3px 4px 0 rgba(0, 0, 0, 0.3)',
        'shadow-sm': '2px 3px 0 rgba(0, 0, 0, 0.45)',
        'item-sep': '1.5px dashed rgba(241, 239, 230, 0.3)',
        'count-hot-fg': '#ff9a85',
        'count-hot-edge': '#ff9a85',
        'count-ok-fg': '#ff9a85',
        'count-ok-edge': '#ff9a85',
        'input-edge': '#f1efe6',
        'logo-ring': '#ff9a85',
        'logo-dot': '#f1efe6',
        'k-exam': HATCH(45, 'rgba(241, 239, 230, 0.7)'), 'k-exam-fg': '#f1efe6',
        'k-practice': HATCH(-45, 'rgba(188, 216, 255, 0.7)'), 'k-practice-fg': '#f1efe6',
        'k-work': 'repeating-linear-gradient(0deg, rgba(200, 230, 160, 0.6) 0 1.5px, transparent 1.5px 5px)', 'k-work-fg': '#f1efe6',
        'k-participation': 'rgba(255, 154, 133, 0.45)', 'k-participation-fg': '#f1efe6',
        'k-presentation': 'radial-gradient(rgba(241, 239, 230, 0.6) 1.2px, transparent 1.6px) 0 0 / 6px 6px', 'k-presentation-fg': '#f1efe6',
        'k-other': HATCH(90, 'rgba(241, 239, 230, 0.3)'), 'k-other-fg': '#f1efe6'
      },
      css: `
        .countdown.u-hot, .count.hot, .count.ok, .tag.ok, .countdown.ok { border: 2px solid var(--ap-count-hot-edge); }
        .tag.ok, .count.ok { display: inline-grid; place-items: center; min-width: 46px; min-height: 46px; padding: 0 4px; border-style: double; border-width: 3px;
          border-radius: 50%; transform: rotate(-12deg); font-family: var(--ap-font-num); font-size: 1.25em; }
        nav.tabs { border-bottom: 1.5px dashed var(--ap-line); }
        nav.tabs button { font-family: var(--ap-font-head); font-size: 1.35em; font-weight: 700; }
        nav.tabs button[aria-selected="true"] { border-bottom: 0; text-decoration: underline wavy var(--ap-accent); text-underline-offset: 5px; }
        .bar.weights { border: 2px solid var(--ap-edge); border-radius: 4px 9px 5px 10px; gap: 0; }
        .bar.weights span { border-right: 2px solid var(--ap-edge); text-shadow: 0 0 3px var(--ap-solid), 0 0 3px var(--ap-solid); }
        .bar.weights span:last-child { border-right: 0; }
        .next-exam { --ap-fg: #2a2622; --ap-muted: #5e564d; --ap-count-fg: #2a2622; --ap-count-hot-fg: #c23b22; --ap-count-hot-edge: #c23b22;
          background: #fff1a6; color: #2a2622; transform: rotate(-1.5deg); box-shadow: 2px 6px 12px -5px rgba(0, 0, 0, 0.35); border-radius: 2px; }
        .next-exam .day { font-family: var(--ap-font-head); font-size: 54px; }
        .exams li { border-radius: 4px 12px 6px 14px; }
        .actions .action { background: transparent; border: 0; box-shadow: none; padding: 2px 0; color: var(--ap-link); text-decoration: underline; text-underline-offset: 3px; }
        .actions .action::before { content: "→ "; text-decoration: none; }
        .actions .action .label { display: none; }
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

  // All the variables of a theme for one mode: BASE (light, then dark in the dark mode), then the light
  // values of the theme, then (dark) the dark values of the theme. { name: value }.
  MAK.themeValues = function (id, dark) {
    const th = MAK.theme(id);
    return Object.assign({}, BASE.light, dark ? BASE.dark : null, th.light, dark ? th.dark : null);
  };
  MAK.THEME_VARS = Object.keys(BASE.light);

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
    return [MAK.fontFaceCss(MAK.THEMES, url), ...vars, th.css || ''].join('\n');
  };

  // Put the theme on a page of the extension: <html data-theme="…" data-scheme="…"> and one
  // <style id="ap-theme">. Result: { id, scheme }.
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
    const own = opts && opts.scope ? '' : th.css || ''; // the CSS of the theme only in a shadow root
    return `${scope} { ${MAK.themeVars(th.id, dark)} }\n${css}\n${own}`;
  }
  // opts.scope: a selector for a style in the page (not in a shadow root); then only the variables.
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
