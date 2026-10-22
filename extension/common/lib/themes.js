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
// titles (else "Aulario Plus"). "cardCss" (optional): CSS for its card in the settings, with any theme (each rule
// starts with .theme-card[data-theme="<id>"]). Nothing from other servers: the fonts are files of the
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
      'head-btn-solid': 'var(--ap-btn-solid)',
      'head-btn-size': '30px',
      'win-head-bg': 'var(--ap-head-bg)', // the head of a window over the page (else as the head of a box)
      'win-head-fg': 'var(--ap-head-fg)',
      'title-deco': 'none', // an image under the titles (a background at the bottom)
      'title-pad': '0px', // the space under the titles for that image
      // Buttons: "btn" the normal ones, "primary" the main action
      'btn-bg': 'var(--ap-surface2)',
      'btn-fg': 'var(--ap-fg)',
      'btn-edge': 'var(--ap-edge)',
      'btn-solid': 'var(--ap-btn-bg)', // the color of a button as one color: its text on hover (MAK.hoverCss)
      'primary-bg': 'var(--ap-accent)',
      'primary-fg': 'var(--ap-accent-fg)',
      'primary-edge': 'var(--ap-accent)',
      'primary-solid': 'var(--ap-primary-bg)', // the same for a primary button
      'hover-shadow': 'none', // a shadow of the buttons on hover, outside (a glow)
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
      'pane-bg': 'transparent', // the body of the block "Aulario Plus" (under its boxes)
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
  // The planets of the cards of the exams (Vía Láctea), drawn: one for each subject, by the number of its photo
  // (MAK.assignSitePhotos; content-shortcuts.js gives the card data-photo="n"). [name, SVG, its own glow].
  const PLANETS = [
    ['Saturno', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><radialGradient id="g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff0cc"/><stop offset=".55" stop-color="#e2b866"/><stop offset="1" stop-color="#8a5a24"/></radialGradient></defs><g transform="rotate(-18 16 16)" fill="none" stroke-width="2.2"><path d="M1.5 16a14.5 4.6 0 0 1 29 0" stroke="#e8d3a6"/><circle cx="16" cy="16" r="7.6" fill="url(#g)" stroke="none"/><path d="M1.5 16a14.5 4.6 0 0 0 29 0" stroke="#f3e2bb"/><path d="M4.2 16a11.8 3.3 0 0 0 23.6 0" stroke="#b99556" stroke-width=".9"/></g></svg>'],
    ['Sol', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><radialGradient id="c" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe27a" stop-opacity=".95"/><stop offset=".55" stop-color="#ff8a1e" stop-opacity=".8"/><stop offset="1" stop-color="#ff3d00" stop-opacity="0"/></radialGradient><radialGradient id="s" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#fff3a8"/><stop offset=".75" stop-color="#ffb02e"/><stop offset="1" stop-color="#ff6a00"/></radialGradient><filter id="f" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="3.4"/></filter><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="5" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1 0 0 0 0 .5 0 0 0 0 0 0 0 0 .55 -.12"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs><circle cx="16" cy="16" r="15" fill="url(#c)" filter="url(#f)"/><circle cx="16" cy="16" r="10.5" fill="url(#s)"/><circle cx="16" cy="16" r="10.5" fill="#fff" filter="url(#g)"/></svg>', 'drop-shadow(0 0 6px rgba(255, 175, 40, 0.95)) drop-shadow(0 0 14px rgba(255, 90, 0, 0.65))'],
    ['Tierra', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><radialGradient id="g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#a7d8ff"/><stop offset=".55" stop-color="#2f74d6"/><stop offset="1" stop-color="#0c2560"/></radialGradient><clipPath id="c"><circle cx="16" cy="16" r="12"/></clipPath></defs><circle cx="16" cy="16" r="12" fill="url(#g)"/><g clip-path="url(#c)"><path d="M7 9c3-2 6-1 7 1s-1 4 1 6-2 5-4 4-3-3-5-3-2-5 1-8z" fill="#4f9a4a"/><path d="M18 13c2-1 5 0 6 2s0 5-2 6-3 3-4 1 1-3 0-5-2-3 0-4z" fill="#5aa152"/><path d="M19 6c2 0 4 1 4 2s-3 1-4 0z" fill="#c9a86a"/><g fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.4" stroke-linecap="round"><path d="M9 20c3 1 6 0 8 1"/><path d="M15 8c2-1 4-1 6 0"/><path d="M20 24c2 0 4-1 5-2"/></g></g></svg>'],
    ['Marte', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><radialGradient id="g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffc09a"/><stop offset=".55" stop-color="#d45a2c"/><stop offset="1" stop-color="#5e1c0c"/></radialGradient><clipPath id="c"><circle cx="16" cy="16" r="12"/></clipPath></defs><circle cx="16" cy="16" r="12" fill="url(#g)"/><g clip-path="url(#c)"><ellipse cx="16" cy="4.6" rx="6" ry="2.7" fill="#fff4ee"/><path d="M8 15c2-2 5-1 6 1s-2 4-4 3-3-2-2-4z" fill="#8a2f14" opacity=".55"/><path d="M18 18c2-1 5 0 5 2s-3 3-5 2z" fill="#8a2f14" opacity=".5"/></g></svg>'],
    ['Júpiter', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><clipPath id="c"><circle cx="16" cy="16" r="12"/></clipPath><radialGradient id="s" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient></defs><g clip-path="url(#c)"><rect x="4" y="4" width="24" height="24" fill="#e9d2a8"/><rect x="4" y="8" width="24" height="3" fill="#c48a52"/><rect x="4" y="13" width="24" height="2" fill="#f4e4c4"/><rect x="4" y="16" width="24" height="3.5" fill="#b9733f"/><rect x="4" y="22" width="24" height="2.5" fill="#cf9a64"/><ellipse cx="20" cy="18.6" rx="2.8" ry="1.7" fill="#b2402a"/></g><circle cx="16" cy="16" r="12" fill="url(#s)"/></svg>'],
    ['Cometa', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="t" x1=".85" y1=".15" x2=".08" y2=".92"><stop offset="0" stop-color="#eaf5ff" stop-opacity=".95"/><stop offset=".5" stop-color="#9cc6ff" stop-opacity=".5"/><stop offset="1" stop-color="#6a9cff" stop-opacity="0"/></linearGradient><radialGradient id="h" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#d8ecff"/><stop offset="1" stop-color="#6aa6ff" stop-opacity="0"/></radialGradient></defs><path d="M19.5 5.5L27.5 12.5L3.5 29Z" fill="url(#t)"/><path d="M23.5 8.5L6 27" stroke="#ffffff" stroke-opacity=".55" stroke-width=".9" stroke-linecap="round"/><circle cx="23.5" cy="8.5" r="6.5" fill="url(#h)"/><circle cx="23.5" cy="8.5" r="2.7" fill="#ffffff"/></svg>'],
    ['Urano', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><radialGradient id="g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#eafdff"/><stop offset=".55" stop-color="#86dbe6"/><stop offset="1" stop-color="#2b7d8f"/></radialGradient></defs><circle cx="16" cy="16" r="11" fill="url(#g)"/><ellipse cx="16" cy="16" rx="3.4" ry="14.5" fill="none" stroke="#d7f6fa" stroke-opacity=".8" stroke-width="1.2" transform="rotate(-8 16 16)"/></svg>'],
    ['Neptuno', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><radialGradient id="g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#a9c4ff"/><stop offset=".55" stop-color="#2f58d8"/><stop offset="1" stop-color="#0b1a5a"/></radialGradient><clipPath id="c"><circle cx="16" cy="16" r="12"/></clipPath></defs><circle cx="16" cy="16" r="12" fill="url(#g)"/><g clip-path="url(#c)" fill="none" stroke-linecap="round"><ellipse cx="12" cy="17" rx="3" ry="1.8" fill="#0d1f6b" opacity=".75"/><path d="M15 12c3-1 6-1 8 0" stroke="#e6efff" stroke-opacity=".8" stroke-width="1.2"/><path d="M5 21c4 1 8 1 12 0" stroke="#7fa3ff" stroke-opacity=".5" stroke-width="1.4"/></g></svg>'],
    ['Plutón', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><radialGradient id="g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#f0ddc6"/><stop offset=".55" stop-color="#b08a68"/><stop offset="1" stop-color="#4f3626"/></radialGradient></defs><circle cx="16" cy="16" r="10" fill="url(#g)"/><path d="M18.5 22.5c-3-2-5.4-3.8-5.4-6a2.6 2.6 0 0 1 5.4-1.1 2.6 2.6 0 0 1 5.4 1.1c0 2.2-2.4 4-5.4 6z" fill="#fbf1e4" opacity=".9"/></svg>'],
    ['Luna', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><radialGradient id="g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#c9c9c9"/><stop offset="1" stop-color="#5c5c5c"/></radialGradient></defs><circle cx="16" cy="16" r="11" fill="url(#g)"/><g fill="#8a8a8a" opacity=".6"><path d="M10 11c2-2 5-1 5 1s-3 3-5 2-1-2 0-3z"/><ellipse cx="19.5" cy="14" rx="3" ry="2.2"/><ellipse cx="14" cy="19.5" rx="2.4" ry="1.7"/></g><circle cx="21" cy="21" r="1.2" fill="#a3a3a3"/></svg>']
  ];
  const PLANET_CSS = PLANETS.map(([name, svg, glow], i) => `.exams li[data-photo="${i}"]::before { background-image: ${svgUrl(svg)};${glow ? ` filter: ${glow};` : ''} } /* ${name} */`).join('\n');
  // Saturn, the logo of the theme Vía Láctea: the back of the ring, the planet, the front of the ring.
  const SATURN = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26"><defs>'
    + '<radialGradient id="p" cx="0.38" cy="0.32" r="0.78"><stop offset="0" stop-color="#fff4d8"/><stop offset="0.55" stop-color="#e9b766"/><stop offset="1" stop-color="#8f5427"/></radialGradient>'
    + '<linearGradient id="r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9fb4ff"/><stop offset="0.5" stop-color="#ffe3ad"/><stop offset="1" stop-color="#c79bff"/></linearGradient></defs>'
    + '<g transform="rotate(-20 13 13)" fill="none" stroke="url(#r)" stroke-width="1.9" stroke-linecap="round"><path d="M1.8 13a11.2 3.6 0 0 1 22.4 0"/>'
    + '<circle cx="13" cy="13" r="6.4" fill="url(#p)" stroke="none"/><path d="M1.8 13a11.2 3.6 0 0 0 22.4 0"/></g></svg>');
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

  // ---- The drawings and the pieces of CSS of "Cómic" (our own, in the style of the comics printed on newsprint) ----
  const INK = '#15120f';
  // The dots of the print (Ben-Day): a grid of dots, and a second one between them. s: the step in px.
  const DOTS = (c, s) => `radial-gradient(circle, ${c} 30%, transparent 34%) 0 0 / ${s}px ${s}px, radial-gradient(circle, ${c} 30%, transparent 34%) ${s / 2}px ${s / 2}px / ${s}px ${s}px`;
  // A panel: its color, and the dots of the shade in the corner at the bottom on the right.
  const SHADE = (base, c) => `linear-gradient(135deg, ${base} 50%, transparent 100%), ${DOTS(c, 6)}, ${base}`;
  // The lines of speed: rays from a point (at), under the other layers.
  const RAYS = (c, at) => `repeating-conic-gradient(from 4deg at ${at}, ${c} 0 2.2deg, transparent 2.2deg 10deg)`;
  // Letters in ink: an outline of w px around them, then the shadows ("drop"), as the titles of a cover.
  const LETTERING = (w, drop) => [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]].map(([x, y]) => `${x * w}px ${y * w}px 0 ${INK}`).concat(drop || []).join(', ');
  // A burst (the "¡POW!" of a comic): spikes around a rounded rectangle, stretched to its box. under: a second
  // burst of this color behind it (the main buttons).
  const BURST_POINTS = '194 50 183 58 192 72 173 71 177 82 160 78 158 90 140 81 131 96 112 84 92 95 74 82 52 93 42 78 24 84 25 70 9 72 20 61 6 46 18 41 11 28 24 31 18 17 40 23 45 8 61 18 76 5 98 16 118 4 136 19 159 11 161 23 180 16 174 29 189 29 182 42';
  const BURST = (fill, under) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" preserveAspectRatio="none">${under
    ? `<polygon points="${BURST_POINTS}" fill="${under}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><g transform="translate(100 50) scale(.86 .76) translate(-100 -50)">`
    : '<g>'}<polygon points="${BURST_POINTS}" fill="${fill}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></g></svg>`);
  // A speech balloon (declarations): white, an edge in ink. Its tail (the declarations of its ::after): under the
  // edge at the bottom on the left, white over the edge, two sides in ink; the same size on any balloon.
  const BALLOON = `position: relative; color: ${INK}; background: #ffffff; border: 2.5px solid ${INK}; box-shadow: none;`;
  const TAIL = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 13"><path d="M0 0H15L3 12.5Z" fill="#ffffff"/><path d="M1.5 0L3 12.5L14 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></svg>`);
  const BALLOON_TAIL = `content: ""; position: absolute; left: 16px; bottom: -12px; width: 18px; height: 13px; background: ${TAIL} center / 100% 100% no-repeat; pointer-events: none;`;
  // The tick of a check box, in ink; the arrow of a list; a magnifier (yellow glass, an ink frame).
  const INK_CHECK = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M2.5 8.6l3.6 3.6L13.8 3" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
  const INK_DOWN = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 8"><path d="M1.5 1.5L6 6l4.5-4.5" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
  const INK_LENS = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M15 15.4l5.6 5.4" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><circle cx="10" cy="10" r="6.5" fill="#ffd43b" stroke="${INK}" stroke-width="2.4"/><path d="M7 8.4a3.4 3.4 0 0 1 3-2.4" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/></svg>`);

  // ---- The drawings of "AulaXP" (our own, in the style of the desktop of 2002) ----
  const XP = {
    // The buttons of a title bar: minimize, maximize, restore (white)
    min: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect x="2" y="7.5" width="6" height="2.5" fill="#ffffff"/></svg>'),
    max: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><rect x="1.5" y="1.5" width="8" height="8" fill="none" stroke="#ffffff"/><rect x="1" y="1" width="9" height="2.6" fill="#ffffff"/></svg>'),
    restore: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11"><path d="M3.5 3V1.5h6v5H8" fill="none" stroke="#ffffff"/><rect x="3" y="1" width="7" height="2" fill="#ffffff"/><rect x="1.5" y="4.5" width="6" height="5" fill="none" stroke="#ffffff"/><rect x="1" y="4" width="7" height="2" fill="#ffffff"/></svg>'),
    // The green tick of a check box
    check: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 9"><path d="M1 4.3l2.4 2.4L8 1.9" fill="none" stroke="#21a121" stroke-width="2"/></svg>'),
    // The arrows of a combo box and of a scroll bar
    down: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 5"><path d="M.6.6L4 4 7.4.6" fill="none" stroke="#4d6185" stroke-width="1.7"/></svg>'),
    up: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 5"><path d="M.6 4.4L4 1l3.4 3.4" fill="none" stroke="#4d6185" stroke-width="1.7"/></svg>'),
    left: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 8"><path d="M4.4.6L1 4l3.4 3.4" fill="none" stroke="#4d6185" stroke-width="1.7"/></svg>'),
    right: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 8"><path d="M.6.6L4 4 .6 7.4" fill="none" stroke="#4d6185" stroke-width="1.7"/></svg>'),
    // The light blue button of a combo box and of a scroll bar
    knob: 'linear-gradient(135deg, #e3ecfe 0%, #c4d6fc 55%, #a9c2f7 100%)',
    // The lines on the thumb of a scroll bar
    grip: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 .5h8M0 2.5h8M0 4.5h8M0 6.5h8" stroke="#eef4fe"/><path d="M0 1.5h8M0 3.5h8M0 5.5h8M0 7.5h8" stroke="#8cb0f8"/></svg>'),
    // The corner of a status bar (to resize a window)
    corner: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><g fill="#ffffff"><rect x="10" y="10" width="2" height="2"/><rect x="10" y="7" width="2" height="2"/><rect x="10" y="4" width="2" height="2"/><rect x="7" y="10" width="2" height="2"/><rect x="7" y="7" width="2" height="2"/><rect x="4" y="10" width="2" height="2"/></g><g fill="#a3a08f"><rect x="9" y="9" width="2" height="2"/><rect x="9" y="6" width="2" height="2"/><rect x="9" y="3" width="2" height="2"/><rect x="6" y="9" width="2" height="2"/><rect x="6" y="6" width="2" height="2"/><rect x="3" y="9" width="2" height="2"/></g></svg>'),
    // The icons of a balloon: information, warning
    info: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><defs><radialGradient id="i" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#8fb6ff"/><stop offset="1" stop-color="#1f56d6"/></radialGradient></defs><circle cx="8" cy="8" r="7.4" fill="url(#i)" stroke="#173f9e" stroke-width=".8"/><circle cx="8" cy="4.4" r="1.25" fill="#ffffff"/><rect x="6.9" y="6.6" width="2.2" height="6" rx=".6" fill="#ffffff"/></svg>'),
    warn: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 1.2l7 13.3H1z" fill="#ffd21f" stroke="#a37b00" stroke-linejoin="round"/><rect x="7" y="5.4" width="2" height="5.4" rx=".5" fill="#000000"/><circle cx="8" cy="12.5" r="1.1" fill="#000000"/></svg>'),
    // The three buttons of a title bar (minimize, maximize, close) in one drawing; dim: of a window that is not active
    captions: (dim) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 19"><defs><radialGradient id="b" cx=".9" cy=".9" r="1"><stop offset="0" stop-color="#0054e3"/><stop offset=".55" stop-color="#2263d5"/><stop offset=".7" stop-color="#4479e4"/><stop offset=".9" stop-color="#a3bbec"/><stop offset="1" stop-color="#ffffff"/></radialGradient><radialGradient id="r" cx=".9" cy=".9" r="1"><stop offset="0" stop-color="#cc4600"/><stop offset=".55" stop-color="#dc6527"/><stop offset=".7" stop-color="#cd7546"/><stop offset=".9" stop-color="#ffccb2"/><stop offset="1" stop-color="#ffffff"/></radialGradient></defs><g opacity="${dim ? 0.55 : 1}"><rect x=".5" y=".5" width="18" height="18" rx="3" fill="url(#b)" stroke="#ffffff"/><rect x="5" y="12" width="6" height="2.5" fill="#ffffff"/><rect x="22.5" y=".5" width="18" height="18" rx="3" fill="url(#b)" stroke="#ffffff"/><rect x="27.5" y="5.5" width="8" height="8" fill="none" stroke="#ffffff"/><rect x="27" y="5" width="9" height="2.6" fill="#ffffff"/><rect x="44.5" y=".5" width="18" height="18" rx="3" fill="url(#r)" stroke="#ffffff"/><path d="M49.5 5.5l8 8M57.5 5.5l-8 8" stroke="#ffffff" stroke-width="2"/></g></svg>`),
    // The title bar of an active window
    title: 'linear-gradient(180deg, #0997ff 0%, #0053ee 8%, #0050ee 40%, #0066ff 88%, #0066ff 93%, #005bff 95%, #003dd7 96%, #003dd7 100%)',
    // A button: its face, pressed
    face: 'linear-gradient(180deg, #ffffff 0%, #ecebe6 86%, #d6d0c5 100%)',
    pressed: 'linear-gradient(180deg, #cdcac3 0%, #e3e3db 8%, #e5e5de 94%, #f2f2f1 100%)',
    hover: 'inset -1px 1px #fff0cf, inset 1px 2px #fdd889, inset -2px 2px #fbc761, inset 2px -2px #e5a01a',
    default: 'inset -1px 1px #cee7ff, inset 1px 2px #98b8ea, inset -2px 2px #bcd4f6, inset 1px -1px #89ade4, inset 2px -2px #89ade4'
  };

  MAK.THEMES = [
    // ---- MiAulario (the default): the look of MiAulario itself, so the parts of the extension do not look
    // added. The values come from the skin of MiAulario (Sakai 23, /library/skin/default-skin/tool.css): its
    // colors (--sakai-*), the font Open Sans (14 px), the blocks of "Mi sitio" (white, corners of 4 px, a soft
    // shadow, a grey head), its buttons and its windows (a blue head). The dark mode: its dark theme.
    {
      id: 'miaulario',
      name: { es: 'MiAulario', en: 'MiAulario' },
      about: { es: 'Igual que MiAulario: sus colores, su letra, sus bloques y sus botones.', en: 'The same as MiAulario: its colors, its font, its blocks and its buttons.' },
      // MiAulario loads Open Sans; the popup and the tools page have their own copy.
      fonts: [{ family: 'AP Open Sans', file: 'open-sans.woff2', weight: '400 700' }],
      light: {
        font: '"Open Sans", "AP Open Sans", sans-serif',
        'head-weight': '700',
        'head-zoom': '0.95',
        page: '#ffffff', // --portal-background-color
        surface: '#ffffff', // --sakai-background-color-1
        solid: '#ffffff',
        surface2: '#f3f3f4', // --sakai-background-color-2
        fg: '#333435', // --sakai-text-color-1
        muted: '#454749', // --sakai-text-color-dimmed
        line: '#e3e4e5', // --sakai-border-color
        edge: '#e3e4e5',
        accent: '#0f4b70', // --sakai-brand
        'accent-fg': '#ffffff',
        'accent-soft': '#e9f5fc', // --infoBanner-bgcolor
        link: '#0f4b70', // --link-color
        // The banners of MiAulario (error, warning, success, information)
        red: '#9e0008', 'red-bg': '#fae6e7',
        orange: '#a35405', 'orange-bg': '#fdf0e3',
        yellow: '#6e5c01', 'yellow-bg': '#fbf8e6',
        green: '#046b32', 'green-bg': '#e6f6ed',
        blue: '#196390', 'blue-bg': '#e9f5fc',
        grey: '#6b6e72', 'grey-bg': '#f3f3f4',
        'mark-bg': '#fff3cd',
        // The head of a block of "Mi sitio" (--overview-portlet-title-background-color, --button-text-color)
        'head-bg': '#e3e4e5',
        'head-fg': '#202122',
        'head-line': '0 solid transparent',
        'head-btn-bg': 'transparent',
        'head-btn-fg': '#202122',
        'head-btn-edge': 'transparent',
        // The head of a window (--sakai-modal-header-bg, --sakai-modal-header-color)
        'win-head-bg': '#0f4b70',
        'win-head-fg': '#ffffff',
        // The buttons (--button-*, --button-primary-*)
        'btn-bg': '#e3e4e5',
        'btn-fg': '#202122',
        'btn-edge': '#d3d4d6',
        'primary-bg': '#0f4b70',
        'primary-fg': '#ffffff',
        'primary-edge': '#0f4b70',
        radius: '4px',
        'radius-sm': '4px',
        'radius-box': '4px',
        bw: '0px',
        'bw-sm': '1px',
        shadow: '0 3px 1px -2px rgba(0, 0, 0, 0.2), 0 2px 2px 0 rgba(0, 0, 0, 0.14), 0 1px 5px 0 rgba(0, 0, 0, 0.12)', // --elevation-2dp
        'shadow-pop': '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
        backdrop: 'rgba(0, 0, 0, 0.5)', // --portal-mask-background
        'item-sep': '1px solid #e3e4e5',
        'item-pad': '8px 2px',
        'count-weight': '600',
        'count-soon-fg': '#a35405',
        'count-hot-fg': '#9e0008',
        'count-ok-fg': '#046b32',
        'input-bg': '#ffffff',
        'input-fg': '#333435',
        'input-edge': '#ced4da',
        'input-radius': '0.4rem',
        'logo-bg': '#0f4b70', // --logo-background-color
        'logo-ring': '#ffffff',
        'logo-dot': '#ffffff',
        'k-exam': '#1f78af', 'k-exam-fg': '#ffffff',
        'k-practice': '#05843f', 'k-practice-fg': '#ffffff',
        'k-work': '#dab601', 'k-work-fg': '#202122',
        'k-participation': '#d97008', 'k-participation-fg': '#ffffff',
        'k-presentation': '#4848f9', 'k-presentation-fg': '#ffffff',
        'k-other': '#898c90', 'k-other-fg': '#ffffff'
      },
      // The dark theme of MiAulario (:root.sakaiUserTheme-dark)
      dark: {
        page: '#1f2225',
        surface: '#1f2225',
        solid: '#1f2225',
        surface2: '#31353b',
        fg: '#d3d4d6',
        muted: '#c3c5c7',
        line: '#454749',
        edge: '#454749',
        'accent-fg': '#e3e4e5',
        'accent-soft': '#092435',
        link: '#c7d5dd',
        red: '#e57e83', 'red-bg': '#300002',
        orange: '#e1903f', 'orange-bg': '#3a2104',
        yellow: '#ecda7f', 'yellow-bg': '#332b00',
        green: '#82d2a6', 'green-bg': '#022713',
        blue: '#92ccf0', 'blue-bg': '#092435',
        grey: '#c3c5c7', 'grey-bg': '#31353b',
        'mark-bg': '#5c4b00',
        'head-bg': '#31353b',
        'head-fg': '#e3e4e5',
        'head-btn-fg': '#e3e4e5',
        'win-head-bg': '#434950',
        'win-head-fg': '#d3d4d6',
        'btn-bg': '#31353b',
        'btn-fg': '#e3e4e5',
        'btn-edge': '#434950',
        'primary-fg': '#e3e4e5',
        shadow: '0 3px 1px -2px rgba(0, 0, 0, 0.4), 0 2px 2px 0 rgba(0, 0, 0, 0.3), 0 1px 5px 0 rgba(0, 0, 0, 0.3)',
        'shadow-pop': '0 0.5rem 1rem rgba(0, 0, 0, 0.5)',
        'item-sep': '1px solid #454749',
        'count-soon-fg': '#e1903f',
        'count-hot-fg': '#e57e83',
        'count-ok-fg': '#82d2a6',
        'input-bg': '#1f2225',
        'input-fg': '#d3d4d6',
        'input-edge': '#555c65'
      },
      // The block of "Mi sitio": one more block of MiAulario (the head of 16 px with the title in 14 px,
      // without the logo; the body with the padding of the blocks).
      blockCss: `
        #mak-block { margin: 0 0 16px; }
        #mak-block > .mak-head { padding: 10px 10px 10px 16px; }
        #mak-block .mak-logo { display: none; }
        #mak-block .mak-title { font-size: 14px; font-weight: 400; line-height: 1.43; }
        #mak-block > #mak-block-body { padding: 12px 16px 14px; }
        #mak-block .mak-head .mak-fold { border: 0; box-shadow: none; }
        #mak-block .mak-head .mak-fold:hover { background: rgba(0, 0, 0, 0.08); filter: none; }
      `,
      // Its card in the settings: a block of "Mi sitio" (the grey head with the name).
      cardCss: `
        .theme-card[data-theme="miaulario"] { gap: 4px; padding: 0 0 10px; border: 0; border-radius: 4px; background: var(--ap-surface); box-shadow: var(--ap-shadow); }
        .theme-card[data-theme="miaulario"] .name { display: block; margin: 0 0 4px; padding: 9px 12px 9px 34px; border-radius: 4px 4px 0 0; background: var(--ap-head-bg);
          color: var(--ap-head-fg); font: 400 14px/1.43 "Open Sans", "AP Open Sans", sans-serif; }
        .theme-card[data-theme="miaulario"] input { left: 12px; top: 12px; accent-color: #0f4b70; }
        .theme-card[data-theme="miaulario"] .about, .theme-card[data-theme="miaulario"] .sample { padding-left: 12px; padding-right: 12px; }
        .theme-card[data-theme="miaulario"] .chip { padding: 4px 12px; font-weight: 600; box-shadow: var(--ap-shadow); }
      `,
      css: `
        /* The buttons of MiAulario: 7 px 16 px, 18 px of line; the main one in blue, with a shadow */
        .btn, .mak-btn, .chips button, .win button.plain, .win button.btn, .mail button:not(.x), .actions .action { padding: 7px 16px; line-height: 18px; font-weight: 400; }
        .chips button { padding: 4px 12px; }
        .btn.primary, .mak-btn, .actions .action, .chips button[aria-pressed="true"], .win button.primary { font-weight: 600; box-shadow: var(--ap-shadow); }
        .btn:hover, .chips button:hover, .win button.plain:hover, .win button.btn:hover, .mail button:not(.x):hover, .week:hover { filter: none; background: var(--ap-btn-edge); }
        .btn.primary:hover, .mak-btn:hover, .actions .action:hover, .chips button[aria-pressed="true"]:hover, .win button.primary:hover {
          filter: none; background: color-mix(in srgb, var(--ap-primary-bg) 80%, var(--ap-fg)); box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12); }
        .actions .action { min-height: 0; }
        /* "Exámenes finales": in the block itself, as the content of a block of MiAulario */
        .tile { padding: 0; background: none; border: 0; border-radius: 0; }
        /* The buttons with an icon (the pencil, the mail, the calculator): as the icons of MiAulario, without a frame */
        .mak-icon { color: var(--ap-fg); background: transparent; border-color: transparent; box-shadow: none; --ap-primary-fg: var(--ap-fg); --ap-primary-solid: var(--ap-solid); }
        .mak-icon:hover { background: var(--ap-surface2); filter: none; }
        /* The focus: the light blue ring of MiAulario */
        .btn:focus-visible, .mak-btn:focus-visible, .mak-icon:focus-visible, .mak-fold:focus-visible, .chips button:focus-visible, .actions .action:focus-visible,
        button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, a:focus-visible { outline: none; box-shadow: 0 0 0 3px #75bfec; }
        input[type="checkbox"], input[type="radio"], label.check input { accent-color: var(--ap-accent); }
        /* The tabs of a tool of MiAulario */
        nav.tabs { gap: 3px; padding: 8px 10px 2px; border-bottom: 0; }
        nav.tabs button { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; padding: 4px 5px; font-size: 12px; line-height: 18px; color: var(--ap-btn-fg); background: var(--ap-btn-bg); border: 1px solid var(--ap-line);
          border-radius: 4px; }
        nav.tabs button:hover { background: var(--ap-btn-edge); }
        nav.tabs button[aria-selected="true"] { font-weight: 400; color: var(--ap-link); background: var(--ap-surface);
          border-top: 3px solid color-mix(in srgb, var(--ap-accent) 55%, var(--ap-surface)); padding-top: 2px; }
        /* The buttons in the blue head of a window: white, with a light border */
        .win > header { --ap-head-btn-fg: var(--ap-win-head-fg); --ap-head-btn-solid: var(--ap-win-head-bg); }
        .win > header button.plain, .win > header button.btn { color: var(--ap-win-head-fg); background: transparent;
          border-color: color-mix(in srgb, var(--ap-win-head-fg) 55%, transparent); box-shadow: none; }
        .win > header button.plain:hover, .win > header button.btn:hover { background: color-mix(in srgb, var(--ap-win-head-fg) 15%, transparent); }
        /* The popup: the top bar of MiAulario (white, the logo on blue), the content in a block */
        header.top { background: var(--ap-surface); color: var(--ap-fg); border-bottom: 1px solid var(--ap-line); }
        .icon-btn { box-shadow: none; }
        .icon-btn:hover { background: var(--ap-surface2); filter: none; }
        /* The banners of MiAulario: information and warning */
        .whatsnew { color: var(--ap-blue); background: var(--ap-blue-bg); border: 1px solid color-mix(in srgb, var(--ap-blue) 45%, transparent); border-radius: 4px; }
        .notice { color: var(--ap-yellow); background: var(--ap-yellow-bg); border: 1px solid color-mix(in srgb, var(--ap-yellow) 45%, transparent); border-radius: 4px; }
        /* The next exam: a banner of information */
        .next-exam { color: var(--ap-fg); background: var(--ap-blue-bg); border: 1px solid color-mix(in srgb, var(--ap-blue) 45%, transparent); border-radius: 4px; }
        .next-exam .day { color: var(--ap-link); }
        /* The scroll bars of MiAulario */
        ::-webkit-scrollbar { width: 12px; height: 12px; }
        ::-webkit-scrollbar-track { background: var(--ap-line); }
        ::-webkit-scrollbar-thumb { background: var(--ap-link); border-radius: 30px; border: 4px solid var(--ap-line); }
      `
    },

    // ---- 1 · Cómic: a real comic book. The newsprint and its dots (Ben-Day), panels in ink, yellow captions,
    // speech balloons for the buttons and bursts for the main ones, the titles lettered as on a cover, and lines
    // of speed. The dark mode: an issue of the night (black gutters, the panels of the night; the captions, the
    // balloons and the bursts stay as they are).
    {
      id: 'bloques',
      keepHover: ['.actions .action'], // the bursts: their own hover (they turn and grow)
      name: { es: 'Cómic', en: 'Comic' },
      about: { es: 'Viñetas en tinta, tramas de puntos, globos de diálogo y explosiones.', en: 'Panels in ink, halftone dots, speech balloons and bursts.' },
      fonts: [
        { family: 'AP Bangers', file: 'bangers.woff2', weight: '400' },
        { family: 'AP Comic Neue', file: 'comic-neue.woff2', weight: '400' },
        { family: 'AP Comic Neue', file: 'comic-neue-bold.woff2', weight: '700' }
      ],
      light: {
        font: '"AP Comic Neue", "Comic Neue", "Comic Sans MS", cursive',
        'font-head': '"AP Bangers", "Bangers", Impact, "Arial Black", sans-serif',
        'font-num': '"AP Bangers", "Bangers", Impact, "Arial Black", sans-serif',
        zoom: '1.05',
        'head-weight': '400',
        'head-zoom': '1.3',
        'head-spacing': '0.04em',
        // The newsprint: a little yellow, its grain and the dots of the print
        page: `${NOISE(0.06)}, ${DOTS('rgba(205, 150, 60, 0.12)', 7)}, #f6edd3`,
        'win-bg': 'var(--ap-page)',
        surface: '#fffcf3', // the white of a panel
        solid: '#fffcf3',
        surface2: '#fff1b8',
        fg: INK,
        muted: '#4d443a',
        line: INK,
        edge: INK,
        accent: '#e8302a',
        'accent-fg': '#ffffff',
        'accent-soft': '#ffe27a', // a caption
        link: '#1f5fc8',
        red: '#d5221b', 'red-bg': '#ffe3dc',
        orange: '#bf5200', 'orange-bg': '#ffe9cf',
        yellow: '#735a00', 'yellow-bg': '#fff3bf',
        green: '#1d7a39', 'green-bg': '#dcf3df',
        blue: '#1f5fc8', 'blue-bg': '#dde9fb',
        grey: '#5c544a', 'grey-bg': '#efe7d4',
        'mark-bg': '#ffd43b',
        'mark-fg': INK,
        // The heads: a sky of the comic (blue, its dots), the title lettered in yellow
        'head-bg': `${DOTS('rgba(255, 255, 255, 0.17)', 7)}, linear-gradient(180deg, #3f8bee 0%, #1f5cc4 100%)`,
        'head-fg': '#ffd43b',
        'head-line': `3px solid ${INK}`,
        'head-btn-bg': '#ffffff',
        'head-btn-fg': INK,
        'head-btn-edge': INK,
        'head-btn-size': '32px',
        // The buttons (else a balloon or a burst, in the CSS below)
        'btn-bg': '#ffffff',
        'btn-fg': INK,
        'btn-edge': INK,
        'primary-bg': '#ffd43b',
        'primary-fg': INK,
        'primary-edge': INK,
        radius: '2px',
        'radius-sm': '14px',
        'radius-box': '2px',
        bw: '3px',
        'bw-sm': '2px',
        // A window over the page: a panel cut out of the page, with its white edge
        'shadow-pop': '0 0 0 5px #fffcf3, 0 18px 44px rgba(0, 0, 0, 0.5)',
        backdrop: 'rgba(21, 18, 15, 0.55)',
        'item-sep': '1.5px solid rgba(21, 18, 15, 0.4)',
        'item-pad': '9px 2px',
        // The countdowns: captions (yellow when it is close, red when it is late)
        'count-bg': '#ffffff',
        'count-fg': INK,
        'count-edge': INK,
        'count-radius': '1px',
        'count-size': '1.12em',
        'count-weight': '400',
        'count-pad': '2px 8px 1px',
        'count-turn': 'rotate(-2deg)',
        'count-soon-bg': '#ffd43b',
        'count-soon-fg': INK,
        'count-hot-bg': '#e8302a',
        'count-hot-fg': '#ffffff',
        'count-hot-edge': INK,
        'count-ok-bg': '#79d68c',
        'count-ok-fg': INK,
        'count-ok-edge': INK,
        'input-bg': '#fff8d6',
        'input-fg': INK,
        'input-edge': INK,
        'input-radius': '2px',
        'logo-bg': '#e8302a',
        'logo-ring': '#ffd43b',
        'logo-dot': '#ffffff',
        // The weights: the flat inks of the print
        'k-exam': '#e8302a', 'k-exam-fg': '#ffffff',
        'k-practice': '#2e6fd6', 'k-practice-fg': '#ffffff',
        'k-work': '#ffd43b', 'k-work-fg': INK,
        'k-participation': '#2a9d4b', 'k-participation-fg': '#ffffff',
        'k-presentation': '#c93a8f', 'k-presentation-fg': '#ffffff',
        'k-other': '#b3a990', 'k-other-fg': INK
      },
      // An issue of the night: black gutters, the panels in the blue of the night, the lines in cream.
      dark: {
        page: `${NOISE(0.1)}, ${DOTS('rgba(120, 150, 230, 0.09)', 7)}, #10131c`,
        surface: '#1b2131',
        solid: '#1b2131',
        surface2: '#2a3148',
        fg: '#f5ecd6',
        muted: '#c2baa6',
        line: '#f5ecd6',
        edge: '#f5ecd6',
        accent: '#ff5a4f',
        link: '#8db8ff',
        red: '#ff7b70', 'red-bg': '#45201d',
        orange: '#ffaa5c', 'orange-bg': '#43301a',
        yellow: '#ffd43b', 'yellow-bg': '#3d3415',
        green: '#7fdc92', 'green-bg': '#1c3a26',
        blue: '#8db8ff', 'blue-bg': '#1d2c4d',
        grey: '#c2baa6', 'grey-bg': '#262c3d',
        'head-bg': `${DOTS('rgba(140, 170, 255, 0.16)', 7)}, linear-gradient(180deg, #24407f 0%, #121f45 100%)`,
        'head-line': '3px solid #f5ecd6',
        'shadow-pop': '0 0 0 5px #10131c, 0 0 0 7px #f5ecd6, 0 18px 44px rgba(0, 0, 0, 0.75)',
        backdrop: 'rgba(0, 0, 0, 0.65)',
        'item-sep': '1.5px solid rgba(245, 236, 214, 0.35)',
        'input-bg': '#232a3d',
        'input-fg': '#f5ecd6',
        'input-edge': '#f5ecd6'
      },
      // Its card in the settings: a panel of newsprint, the name lettered as a cover, the button a burst.
      cardCss: `
        .theme-card[data-theme="bloques"] { border: 3px solid var(--ap-edge); border-radius: 2px; box-shadow: none; background: var(--ap-page); }
        .theme-card[data-theme="bloques"] .name { color: #ffd43b; font-size: 24px; text-transform: uppercase; text-shadow: ${LETTERING(1.2, `2.5px 2.5px 0 #e8302a, 3.5px 3.5px 0 ${INK}`)}; }
        .theme-card[data-theme="bloques"] .about { color: var(--ap-fg); }
        .theme-card[data-theme="bloques"] .sample .countdown { border: 2px solid ${INK}; }
        .theme-card[data-theme="bloques"] .chip { padding: 10px 20px; font: 400 15px/1 "AP Bangers", Impact, sans-serif; letter-spacing: 0.05em; text-transform: uppercase;
          border: 0; border-radius: 0; box-shadow: none; background: ${BURST('#ffd43b', '#e8302a')} center / 100% 100% no-repeat; }
      `,
      // The block of "Mi sitio": a page of a comic. The head is its cover (the sky, the rays, the title).
      blockCss: `
        #mak-block > .mak-head { padding: 12px 14px; background: radial-gradient(ellipse at 18% 50%, rgba(255, 255, 255, 0.28) 0%, transparent 55%),
          ${RAYS('rgba(255, 255, 255, 0.13)', '18% 50%')}, var(--ap-head-bg); }
        #mak-block .mak-title { font-size: calc(26px * var(--ap-head-zoom)); text-transform: uppercase; text-shadow: ${LETTERING(1.6, `3px 3px 0 #e8302a, 4.5px 4.5px 0 ${INK}`)}; }
        #mak-block .mak-logo { width: 34px; height: 34px; }
        #mak-block .mak-logo .lg-bg { stroke: ${INK}; stroke-width: 3px; }
        #mak-block .mak-head .mak-fold { border: 2.5px solid ${INK}; border-radius: 50%; box-shadow: none; }
        #mak-block .mak-head .mak-fold svg { stroke-width: 3; }
        #mak-block .mak-head .mak-fold:hover, #mak-block .mak-head .mak-fold:focus-visible { filter: none; transform: rotate(-8deg) scale(1.08); }
        #mak-block .mak-widen { width: 24px; height: 24px; background: #ffd43b; opacity: 1; }
        #mak-block .mak-widen:hover, #mak-block .mak-widen:focus-visible { background: #ffffff; opacity: 1; }
        #mak-block > #mak-block-body { padding: 18px 16px 16px; }
      `,
      css: `
        ::selection { background: #ffd43b; color: ${INK}; }
        /* ---- The titles: lettered as on a cover (yellow, an outline in ink, a red shadow) ---- */
        header.top h1, :host(:not(.in-block)) .box > .head .title, .win > header h2, .mail > header h2, .panel > .bar span, .pop > header h2 {
          color: #ffd43b; text-transform: uppercase; text-shadow: ${LETTERING(1.4, `2.5px 2.5px 0 #e8302a, 3.5px 3.5px 0 ${INK}`)}; }
        header.top, :host(:not(.in-block)) .box > .head, .win > header, .mail > header, .panel > .bar, .pop > header {
          background: radial-gradient(ellipse at 15% 50%, rgba(255, 255, 255, 0.26) 0%, transparent 60%), ${RAYS('rgba(255, 255, 255, 0.12)', '15% 50%')}, var(--ap-win-head-bg); }
        /* ---- The captions (the voice of the narrator): yellow boxes, the letters in capitals ---- */
        .tile > h4, :host(.in-block) .box > .head .title, .sem-head .sem-title, h2.group, .section h2, .panel h3, .pop h3, header.top .status-line {
          color: ${INK}; background: #ffe27a; border: 2.5px solid ${INK}; border-radius: 0; font-family: var(--ap-font); font-weight: 700; font-style: normal;
          font-size: 12.5px; line-height: 1.3; letter-spacing: 0.05em; text-transform: uppercase; text-shadow: none; }
        h2.group, .section h2, .panel h3, .pop h3, :host(.in-block) .box > .head .title { display: inline-block; margin: 14px 0 8px; padding: 3px 9px 2px; }

        /* ---- The popup: a page of newsprint, its cover on the top, the content in one large panel ---- */
        header.top { padding: 10px 12px 11px; }
        header.top h1 { font-size: calc(22px * var(--ap-head-zoom)); line-height: 1; }
        header.top .mak-logo { width: 32px; height: 32px; }
        .mak-logo .lg-bg { stroke: ${INK}; stroke-width: 3px; }
        header.top .status-line { display: inline-block; max-width: 100%; margin-top: 5px; padding: 1px 7px; font-size: 10.5px; opacity: 1; }
        header.top .status-line.bad, header.top .status-line.warn { color: #c01a14; text-decoration: none; }
        .icon-btn { border-width: 2.5px; border-radius: 50%; font-weight: 700; box-shadow: none; }
        .icon-btn:hover, .icon-btn:focus-visible { filter: none; transform: rotate(-10deg) scale(1.08); }
        #close { color: #ffffff; background: #e8302a; }
        .searchbar { padding: 10px 12px 8px; }
        .searchbar input { padding: 7px 10px 7px 36px; font-weight: 700; border-width: 2.5px; background: ${INK_LENS} 9px center / 20px no-repeat, var(--ap-input-bg); }
        main { margin: 8px 10px 6px; border-width: 3px; background: ${SHADE('var(--ap-surface)', 'rgba(21, 18, 15, 0.1)')}; }
        /* The tabs: a strip of panels; the open one in red */
        nav.tabs { margin: 0 10px; padding: 0; border: 2.5px solid var(--ap-edge); background: var(--ap-surface); }
        nav.tabs button { flex: 1 1 auto; padding: 5px 3px 3px; color: var(--ap-fg); font-family: var(--ap-font-head); font-size: 15.5px; letter-spacing: 0.05em;
          text-transform: uppercase; border: 0; border-right: 2.5px solid var(--ap-edge); }
        nav.tabs button:last-child { border-right: 0; }
        nav.tabs button:hover { color: ${INK}; background: #ffe27a; }
        nav.tabs button[aria-selected="true"] { color: #ffffff; font-weight: 400; background: ${DOTS('rgba(255, 255, 255, 0.18)', 6)}, #e8302a;
          text-shadow: ${LETTERING(1, `1.5px 1.5px 0 ${INK}`)}; }
        nav.tabs .count-badge { color: ${INK}; background: #ffd43b; border: 1.5px solid ${INK}; font-family: var(--ap-font); text-shadow: none; }
        /* The main menu: the switches that are on, captions */
        .switch[aria-pressed="true"], .switch:not([aria-pressed]) { color: ${INK}; border: 2.5px solid ${INK}; }
        /* The rows: a late one on the red dots */
        .item.u-overdue, .item.u-red { background: ${DOTS('rgba(232, 48, 42, 0.15)', 6)}, var(--ap-red-bg); }
        .card .head a { letter-spacing: 0.04em; }
        /* The countdowns and the tags: captions of ink */
        .countdown, .count, .tag { border: 2px solid var(--ap-count-edge); letter-spacing: 0.04em; }
        .u-overdue .countdown, .u-red .countdown, .count.hot { text-shadow: ${LETTERING(0.8)}; }
        .tag { font-weight: 700; font-size: 10.5px; border-width: 1.5px; border-radius: 1px; text-transform: uppercase; }
        /* The weeks: small panels; the selected one in yellow */
        .week { color: var(--ap-fg); background: var(--ap-surface); border: 2.5px solid var(--ap-edge); border-radius: 2px; box-shadow: none; }
        .week:hover { filter: none; background: ${DOTS('rgba(21, 18, 15, 0.1)', 6)}, #fff3bf; color: ${INK}; }
        .week.on { outline: 0; color: ${INK}; background: ${DOTS('rgba(21, 18, 15, 0.12)', 6)}, #ffd43b; }
        .week:hover .label, .week.on .label { color: ${INK}; }
        .week .n { font-family: var(--ap-font-num); font-size: 17px; font-weight: 400; }
        .week .track { background: transparent; border: 2px solid currentColor; border-radius: 0; }
        .week .bar { border-radius: 0; }
        /* After an update: a speech balloon; a problem: a caption */
        .whatsnew { --ap-fg: ${INK}; ${BALLOON} margin-bottom: 18px; padding: 8px 14px; border-radius: 22px; }
        .whatsnew .x { color: ${INK}; }
        .empty { ${BALLOON} max-width: 300px; margin: 18px auto 26px; padding: 14px 20px; border-radius: 26px; font-weight: 700; }
        .whatsnew::after, .empty::after { ${BALLOON_TAIL} }
        .notice { color: ${INK}; background: #ffe27a; border: 2.5px solid ${INK}; border-radius: 0; }

        /* ---- The controls ---- */
        /* The buttons: speech balloons */
        .btn:not(.primary), .win button.plain:not(.primary), .win button.btn:not(.primary), .mail button:not(.x):not(.primary), .pop button:not(.x):not(.save) {
          ${BALLOON} margin-bottom: 10px; padding: 5px 16px; font-weight: 700; border-radius: 999px; }
        .btn:not(.primary)::after, .win button.plain:not(.primary)::after, .win button.btn:not(.primary)::after, .mail button:not(.x):not(.primary)::after,
        .pop button:not(.x):not(.save)::after { ${BALLOON_TAIL} }
        .pop .people button { border-radius: 20px; }
        .btn:hover, .btn:focus-visible, .win button.plain:hover, .win button.btn:hover, .mail button:not(.x):hover { filter: none; transform: rotate(-2deg) scale(1.03); }
        /* The main buttons: a burst, red under yellow; pressed, a red one and "¡CLIC!" */
        .btn.primary, .mak-btn, .win button.primary, .mail button.primary, .pop button.save { position: relative; padding: 13px 30px; color: ${INK}; font-family: var(--ap-font-head);
          font-size: 1.12em; font-weight: 400; letter-spacing: 0.06em; text-transform: uppercase; border: 0; border-radius: 0; box-shadow: none;
          background: ${BURST('#ffd43b', '#e8302a')} center / 100% 100% no-repeat; }
        .btn.primary:hover, .mak-btn:hover, .btn.primary:focus-visible, .mak-btn:focus-visible, .win button.primary:hover, .mail button.primary:hover {
          filter: none; transform: rotate(-2deg) scale(1.05); }
        .btn.primary:active, .mak-btn:active, .win button.primary:active, .mail button.primary:active, .actions .action:active { color: #ffffff; transform: scale(0.97);
          background: ${BURST('#e8302a')} center / 100% 100% no-repeat; text-shadow: ${LETTERING(1)}; }
        .btn.primary:active::after, .mak-btn:active::after, .actions .action:active::after { content: "¡CLIC!"; position: absolute; top: -12px; right: -8px;
          color: #ffd43b; font: 400 16px/1 "AP Bangers", Impact, sans-serif; letter-spacing: 0.04em; transform: rotate(12deg); text-shadow: ${LETTERING(1.2)}; pointer-events: none; }
        .btn:disabled, .mak-btn:disabled, .win button:disabled, .mail button:disabled { filter: grayscale(1); opacity: 0.5; transform: none; }
        /* The focus of a balloon or a burst: a blue light around its form */
        .btn:focus-visible, .mak-btn:focus-visible, .mak-icon:focus-visible, .actions .action:focus-visible, .win button:focus-visible, .mail button:focus-visible,
        .pop button:focus-visible { outline: none; filter: drop-shadow(0 0 1.5px #2e6fd6) drop-shadow(0 0 1.5px #2e6fd6) drop-shadow(0 0 1px #2e6fd6); }
        /* The chips: pills of ink; the pressed one in red */
        .chips button { font-weight: 700; color: var(--ap-fg); background: var(--ap-surface); border: 2px solid var(--ap-edge); border-radius: 999px; box-shadow: none; }
        .chips button:hover { color: ${INK}; background: #fff3bf; }
        .chips button[aria-pressed="true"] { color: #ffffff; background: #e8302a; border-color: ${INK}; text-shadow: 1px 1px 0 ${INK}; }
        /* The buttons with an icon (the pencil, the mail, the calculator): small bursts */
        .mak-icon { width: 36px; height: 30px; color: ${INK}; border: 0; border-radius: 0; box-shadow: none; background: ${BURST('#ffd43b')} center / 100% 100% no-repeat; }
        .mak-icon svg { width: 15px; height: 15px; stroke-width: 2.6; }
        .mak-icon:hover, .mak-icon:focus-visible { filter: none; transform: rotate(-10deg) scale(1.1); }
        /* The arrows: a white round balloon */
        .mak-fold { color: ${INK}; background: #ffffff; border: 2.5px solid ${INK}; border-radius: 50%; box-shadow: none; }
        .mak-fold svg { stroke-width: 3; }
        .mak-fold:hover, .mak-fold:focus-visible { filter: none; transform: rotate(-8deg) scale(1.08); }
        /* The fields: boxes of ink */
        input[type="text"], input[type="search"], textarea, select { border-width: 2.5px; }
        select { -webkit-appearance: none; appearance: none; padding-right: 34px; font-weight: 700;
          background: ${INK_DOWN} right 8px center / 12px 8px no-repeat, linear-gradient(90deg, ${INK} 0 2.5px, #ffd43b 2.5px) right center / 28px 100% no-repeat, var(--ap-input-bg); }
        /* The check boxes and the radio buttons: ink; a tick, a red dot */
        input[type="checkbox"], input[type="radio"] { -webkit-appearance: none; appearance: none; flex: none; width: 18px; height: 18px; margin: 1px 0 0; padding: 0; cursor: pointer;
          background: #ffffff; border: 2.5px solid ${INK}; border-radius: 2px; box-shadow: none; }
        input[type="radio"] { border-radius: 50%; }
        input[type="checkbox"]:checked { background: ${INK_CHECK} center / 14px no-repeat, #ffd43b; }
        input[type="radio"]:checked { background: radial-gradient(circle, #e8302a 0 3.6px, ${INK} 4.1px 4.9px, #ffffff 5.4px); }
        input[type="checkbox"]:hover, input[type="radio"]:hover { transform: scale(1.1); }
        /* The scroll bars: a yellow thumb in ink */
        ::-webkit-scrollbar { width: 14px; height: 14px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #ffd43b; border: 2.5px solid ${INK}; border-radius: 8px; }

        /* ---- The windows and the search: panels cut out of the page ---- */
        .win > header, .mail > header { padding: 11px 14px 11px 18px; }
        .win > header h2, .mail > header h2 { font-size: calc(19px * var(--ap-head-zoom)); }
        .mail > header .muted { color: #ffffff; font-weight: 700; opacity: 1; text-shadow: ${LETTERING(1)}; }
        .win > header button.x, .mail > header button.x, .panel > .bar button.x, .pop > header button.x { width: 32px; height: 32px; padding: 0; color: #ffffff; font-size: 15px; font-weight: 700;
          background: #e8302a; border: 2.5px solid ${INK}; border-radius: 50%; box-shadow: none; }
        .win > header button.x:hover, .mail > header button.x:hover, .panel > .bar button.x:hover { transform: rotate(-10deg) scale(1.08); }
        .sum { color: ${INK}; border: 2.5px solid ${INK}; border-radius: 0; }
        .win .tag { display: table; margin-top: 4px; }
        /* The small windows (a teacher to write to, a new name for a site) */
        .pop > header { align-items: center; margin: -12px -12px 10px; padding: 9px 10px 9px 14px; border-bottom: var(--ap-head-line); }
        .pop > header h2 { font-size: calc(16px * var(--ap-head-zoom)); line-height: 1.15; }
        .pop h3 { margin: 4px 0 8px; font-size: 11px; }
        .pop .people { gap: 8px; }
        .panel > .bar { display: flex; padding: 9px 12px 9px 16px; border-bottom: var(--ap-head-line); }
        .panel > .bar span { font-size: calc(19px * var(--ap-head-zoom)); }
        .panel > input { margin: 14px 14px 6px; padding: 8px 12px 8px 40px; font-family: var(--ap-font); font-weight: 700; font-style: normal; font-size: 18px;
          letter-spacing: normal; color: var(--ap-input-fg); background: ${INK_LENS} 10px center / 22px no-repeat, var(--ap-input-bg); border: 2.5px solid var(--ap-input-edge);
          border-radius: 2px; caret-color: #e8302a; }
        .panel h3 { margin: 12px 6px 4px; font-size: 11px; }
        a.item.sel, .result.sel { color: ${INK}; background: #ffd43b; box-shadow: inset 0 0 0 2px ${INK}; }
        a.item.sel .meta, .result.sel .meta { color: #4d443a; }
        a.item.sel mark, .result.sel mark { background: #ffffff; }
        .panel > .foot { border-top: 2.5px solid var(--ap-edge); font-weight: 700; }

        /* ---- Mi sitio and the sites: panels of ink with the dots of the shade; a caption in the corner ---- */
        .tile { position: relative; padding: 38px 14px 14px; background: ${SHADE('var(--ap-surface)', 'rgba(21, 18, 15, 0.1)')}; border: 3px solid var(--ap-edge); border-radius: 2px; }
        .tile > h4 { position: absolute; top: -3px; left: -3px; margin: 0; padding: 4px 11px 3px; }
        :host(.in-block) .box > .head { align-items: center; }
        :host(.in-block) .box > .head .title { margin: 4px 0; }
        /* The next exam: a splash panel. The sky and the rays, the days lettered in yellow, a caption, a burst */
        .next-exam { --ap-fg: ${INK}; --ap-muted: #3a332b; position: relative; overflow: visible; margin: 0 0 12px; padding: 8px 14px; color: ${INK};
          border: 3px solid var(--ap-edge); border-radius: 2px;
          background: radial-gradient(ellipse at 60px 50%, rgba(255, 255, 255, 0.45) 0%, transparent 45%), ${RAYS('rgba(255, 255, 255, 0.16)', '60px 50%')},
            var(--ap-head-bg); }
        .next-exam .day { color: #ffd43b; font-size: calc(38px * var(--ap-head-zoom)); text-shadow: ${LETTERING(2, `4px 4px 0 #e8302a, 6px 6px 0 ${INK}`)}; }
        .next-exam .day small { margin-top: 4px; font-size: 0.42em; letter-spacing: 0.06em; text-shadow: ${LETTERING(1.4, `2px 2px 0 #e8302a, 3px 3px 0 ${INK}`)}; }
        .next-exam .what { flex: 0 1 auto; padding: 6px 12px 7px; background: #ffe27a; border: 2.5px solid ${INK}; }
        .next-exam .what .name { font-family: var(--ap-font-head); font-weight: 400; font-size: 1.3em; letter-spacing: 0.04em; }
        .next-exam .count { margin-left: auto; padding: 10px 20px; color: #ffffff; font-size: 1.3em; border: 0; border-radius: 0; box-shadow: none; transform: rotate(-5deg);
          background: ${BURST('#e8302a')} center / 100% 100% no-repeat; text-shadow: ${LETTERING(1.1)}; }
        /* The semesters: panels, the name in a caption in the corner */
        .sem { position: relative; padding: 6px 10px 12px; background: var(--ap-surface); border: 3px solid var(--ap-edge); border-radius: 2px; }
        .sem-head { justify-content: flex-end; min-height: 30px; }
        .sem-head .sem-title { position: absolute; top: -3px; left: -3px; flex: none; max-width: calc(100% - 44px); padding: 4px 11px 3px; }
        .sem-head .sem-title .meta { color: #4d443a; font-size: 1em; }
        .sem-body { margin-top: 8px; }
        /* The exams: small panels */
        .exams { gap: 10px; }
        .exams li { padding: 8px 10px; background: ${SHADE('var(--ap-surface)', 'rgba(21, 18, 15, 0.1)')}; border: 2.5px solid var(--ap-edge); border-radius: 2px; }
        .exams .name { font-weight: 700; }
        .mak-link .t { font-weight: 700; }
        /* The actions: three bursts of the colors of the print, the words lettered */
        .actions:has(.action) { gap: 14px; padding: 4px 2px; }
        .actions .action { position: relative; min-height: 64px; padding: 14px 32px; color: #ffffff; font-family: var(--ap-font-head); font-size: 1.5em; font-weight: 400;
          letter-spacing: 0.06em; text-transform: uppercase; border: 0; border-radius: 0; box-shadow: none; text-shadow: ${LETTERING(1.4, `2px 2px 0 ${INK}`)}; }
        .actions .action:nth-child(3n+1) { background: ${BURST('#2e6fd6')} center / 100% 100% no-repeat; }
        .actions .action:nth-child(3n+2) { color: ${INK}; text-shadow: none; background: ${BURST('#ffd43b')} center / 100% 100% no-repeat; }
        .actions .action:nth-child(3n+3) { background: ${BURST('#e8302a')} center / 100% 100% no-repeat; }
        .actions .action:hover, .actions .action:focus-visible { filter: none; transform: rotate(-2deg) scale(1.05); }
        /* The course guides: panels of a light color each one, the name lettered */
        .guide-card { --nb-tint: var(--ap-surface); padding: 12px 14px; border: 3px solid var(--ap-edge); border-radius: 2px;
          background: ${SHADE('var(--nb-tint)', 'rgba(21, 18, 15, 0.1)')}; }
        .guide-card:nth-child(4n+2) { --nb-tint: color-mix(in srgb, #8fc1ff 22%, var(--ap-solid)); }
        .guide-card:nth-child(4n+3) { --nb-tint: color-mix(in srgb, #ffd43b 24%, var(--ap-solid)); }
        .guide-card:nth-child(4n+4) { --nb-tint: color-mix(in srgb, #ff9a8f 20%, var(--ap-solid)); }
        .guide-card h4 { letter-spacing: 0.05em; }
        /* The weights: one bar of ink, the flat colors and their dots */
        .bar.weights { gap: 0; height: 26px; border: 2.5px solid var(--ap-edge); border-radius: 2px; }
        .bar.weights span { border-right: 2.5px solid var(--ap-edge); background-image: radial-gradient(circle, rgba(255, 255, 255, 0.22) 30%, transparent 34%),
          radial-gradient(circle, rgba(255, 255, 255, 0.22) 30%, transparent 34%); background-size: 6px 6px; background-position: 0 0, 3px 3px; }
        .bar.weights span:last-child { border-right: 0; }
        /* The tables: a grid of ink, the heads in a caption */
        .content table { border: 2.5px solid var(--ap-edge); background: var(--ap-surface); }
        th, td { border: 1.5px solid var(--ap-line); }
        th { color: ${INK}; background: #ffe27a; text-transform: uppercase; letter-spacing: 0.04em; }
      `
    },

    // ---- 3 · Plastilina: Claymorphism + Neumorphism ----------------------------------------------
    {
      id: 'plastilina',
      name: { es: 'Malvavisco', en: 'Marshmallow' },
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
      name: { es: 'Aurora', en: 'Aurora' },
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
        'btn-solid': 'var(--ap-solid)',
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
        .next-exam .day { width: 64px; height: 64px; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 50%;
          background: radial-gradient(circle at 34% 28%, #fff 0%, #ffe3ec 42%, #c9d6fb 100%); box-shadow: 0 14px 24px -12px rgba(110, 80, 160, 0.5); color: #2a2740; font-size: 24px; line-height: 0.9; }
        .next-exam .day small { font-size: 12px; }
        .actions .action { color: var(--ap-btn-fg); background: var(--ap-btn-bg); border: 1px solid var(--ap-btn-edge); border-radius: 999px; }
        .actions .action .label { display: none; }
        .bar.weights { height: 10px; border-radius: 99px; gap: 0; }
        .bar.weights span { color: transparent; }
      `
    },

    // ---- 6 · AulaXP (id "cromo"): the desktop of 2002. Blue title bars with their buttons, beige windows,
    // buttons of 23 px, check boxes with a green tick, combo boxes and scroll bars in light blue, balloons,
    // and the blue pane of tasks of the file explorer; the dark mode: the same, on dark backgrounds. The
    // fonts of the system (Tahoma, Trebuchet MS). The drawings are our own, in that style.
    {
      id: 'cromo',
      name: { es: 'AulaXP', en: 'AulaXP' },
      brand: 'AulaXP',
      about: { es: 'Barra de título azul, ventanas beige y botones con borde azul, como el escritorio de 2002.', en: 'Blue title bars, beige windows and buttons with a blue border, as the desktop of 2002.' },
      fonts: [],
      icons: {
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
        'head-bg': XP.title,
        'head-fg': '#ffffff',
        'head-line': '0 solid transparent',
        'head-btn-bg': 'radial-gradient(circle at 90% 90%, #0054e3 0%, #2263d5 55%, #4479e4 70%, #a3bbec 90%, #ffffff 100%)',
        'head-btn-fg': '#ffffff',
        'head-btn-edge': '#ffffff',
        'head-btn-size': '21px',
        // The buttons
        'btn-bg': XP.face,
        'btn-fg': '#000000',
        'btn-edge': '#003c74',
        'primary-bg': XP.face,
        'primary-fg': '#000000',
        'primary-edge': '#003c74',
        'primary-solid': '#ece9d8',
        'btn-solid': '#ece9d8',
        'head-btn-solid': '#2263d5',
        // A window: a thick blue frame, rounded at the top
        'pane-bg': 'linear-gradient(180deg, #7ba2e7 0%, #6375d6 100%)', // the pane of tasks of the file explorer
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
        'pane-bg': 'linear-gradient(180deg, #2c4170 0%, #1f2b52 100%)',
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
      // Its card in the settings: a small window (active when it is the theme, else inactive: a pale title bar)
      // with the buttons of the title bar, the radio button as the icon of the window, and a button.
      cardCss: `
        .theme-card[data-theme="cromo"] { gap: 4px; padding: 0 0 10px; border: 3px solid #7a96df; border-top: 0; border-radius: 8px 8px 0 0;
          background: var(--ap-win-bg); box-shadow: 2px 3px 8px rgba(0, 0, 0, 0.3); }
        .theme-card[data-theme="cromo"]:has(input:checked) { border-color: #0831d9; }
        .theme-card[data-theme="cromo"] .name { display: block; margin: 0 0 4px; padding: 6px 72px 6px 28px; border-radius: 6px 6px 0 0; color: #ffffff;
          font: 700 13px/1.25 "Trebuchet MS", Tahoma, sans-serif; text-shadow: 1px 1px 0 #3d4f8f; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          background: ${XP.captions(true)} right 4px center / 63px 19px no-repeat, linear-gradient(180deg, #a8c0f0 0%, #7a96df 10%, #7a96df 88%, #6f8ad9 100%); }
        .theme-card[data-theme="cromo"]:has(input:checked) .name { text-shadow: 1px 1px 0 #0f1089;
          background: ${XP.captions(false)} right 4px center / 63px 19px no-repeat, ${XP.title}; }
        .theme-card[data-theme="cromo"] input { -webkit-appearance: none; appearance: none; left: 7px; top: 7px; width: 14px; height: 14px; margin: 0;
          border: 1px solid #1c5180; border-radius: 50%; background: linear-gradient(135deg, #dcdcd7 0%, #ffffff 100%); }
        .theme-card[data-theme="cromo"] input:checked { background: radial-gradient(circle, #5fdc54 0 1.8px, #21a121 2.8px, rgba(33, 161, 33, 0) 3.4px), linear-gradient(135deg, #dcdcd7 0%, #ffffff 100%); }
        .theme-card[data-theme="cromo"] .about, .theme-card[data-theme="cromo"] .sample { padding-left: 10px; padding-right: 10px; }
        .theme-card[data-theme="cromo"] .about { font: 11px/1.4 Tahoma, "Segoe UI", sans-serif; color: var(--ap-fg); }
        .theme-card[data-theme="cromo"] .chip { min-width: 64px; padding: 2px 10px; text-align: center; color: #000000; font: 400 11px Tahoma, "Segoe UI", sans-serif;
          background: ${XP.face}; border: 1px solid #003c74; border-radius: 3px; box-shadow: ${XP.default}; }
      `,
      // The block of "Mi sitio": a window with the buttons of a title bar (minimize: fold, maximize: the full
      // width), and the blue pane of tasks of the file explorer.
      blockCss: `
        #mak-block > .mak-head { gap: 4px; padding: 5px 6px 5px 9px; }
        #mak-block .mak-logo { width: 18px; height: 18px; margin-right: 4px; }
        #mak-block .mak-title { text-shadow: 1px 1px 0 #0f1089; }
        #mak-block > #mak-block-body { padding: 12px; }
        #mak-block .mak-head .mak-fold, #mak-block .mak-widen { position: static; flex: none; width: 21px; height: 21px; margin: 0; opacity: 1; clip-path: none;
          border: 1px solid #ffffff; border-radius: 3px; box-shadow: none; background: ${XP.min} center / 11px no-repeat, var(--ap-head-btn-bg); }
        #mak-block .mak-head .mak-fold svg { display: none; }
        #mak-block .mak-head .mak-fold[aria-expanded="false"], #mak-block .mak-widen[aria-pressed="true"] { background: ${XP.restore} center / 11px no-repeat, var(--ap-head-btn-bg); }
        #mak-block .mak-widen { margin-left: 2px; background: ${XP.max} center / 11px no-repeat, var(--ap-head-btn-bg); }
        #mak-block .mak-head .mak-fold:hover, #mak-block .mak-widen:hover, #mak-block .mak-head .mak-fold:focus-visible, #mak-block .mak-widen:focus-visible { filter: brightness(1.18); opacity: 1; }
      `,
      css: `
        /* ---- The windows ---- */
        /* The popup: a window, with its blue frame, its title bar and a status bar */
        body { border: 3px solid #0831d9; border-top: 0; }
        header.top { padding: 6px 6px 6px 9px; }
        header.top .mak-logo { width: 22px; height: 22px; }
        header.top h1, .box > .head .title, .win > header h2, .mail > header h2, .panel > .bar { text-shadow: 1px 1px 0 #0f1089; }
        footer.privacy { padding: 3px 20px 3px 8px; text-align: left; background: ${XP.corner} right 2px bottom 2px / 12px no-repeat, var(--ap-win-bg);
          border-top: 1px solid rgba(0, 0, 0, 0.22); box-shadow: inset 0 1px rgba(255, 255, 255, 0.7); }
        footer.privacy button, footer.privacy span { color: var(--ap-fg); font-size: 11px; }
        /* The content: a white panel, with the border of the lists */
        main { border: 1px solid #7f9db9; border-radius: 0; }
        /* The buttons of a title bar: blue, white symbols; open in a tab = maximize; the red close button */
        .icon-btn { width: 21px; height: 21px; padding: 0; font-size: 13px; font-weight: 700; border: 1px solid #ffffff; border-radius: 3px; box-shadow: none; }
        #openTab { font-size: 0; background: ${XP.max} center / 11px no-repeat, var(--ap-head-btn-bg); }
        .icon-btn:hover, .icon-btn:focus-visible { filter: brightness(1.18); }
        .win > header button.x, .mail > header button.x, .box > .head button.close, .panel > .bar button.x, header.top .icon-btn.close { width: 21px; height: 21px; padding: 0;
          color: #ffffff; font-size: 13px; font-weight: 700; border: 1px solid #ffffff; border-radius: 3px; box-shadow: none;
          background: radial-gradient(circle at 90% 90%, #cc4600 0%, #dc6527 55%, #cd7546 70%, #ffccb2 90%, #ffffff 100%); }
        .win > header button.x:hover, .mail > header button.x:hover, .box > .head button.close:hover, .panel > .bar button.x:hover { filter: brightness(1.15); }
        /* The head of a box on a page: the title bar; the arrow: minimize */
        :host(:not(.in-block)) .box > .head .mak-fold[aria-expanded] { width: 21px; height: 21px; border: 1px solid #ffffff; border-radius: 3px; box-shadow: none;
          background: ${XP.min} center / 11px no-repeat, var(--ap-head-btn-bg); }
        :host(:not(.in-block)) .box > .head .mak-fold[aria-expanded] svg { display: none; }
        /* The buttons with an icon (the pencil, the mail, the calculator): the buttons of a title bar, a white symbol */
        .mak-icon, .box > .head .mak-fold:not([aria-expanded]) { width: 21px; height: 21px; padding: 0; color: #ffffff; border: 1px solid #ffffff; border-radius: 3px;
          box-shadow: 0 0 0 1px rgba(0, 40, 140, 0.35); background: var(--ap-head-btn-bg); }
        .mak-icon svg, .box > .head .mak-fold:not([aria-expanded]) svg { width: 13px; height: 13px; }
        .mak-icon:hover, .mak-icon:focus-visible, .box > .head .mak-fold:not([aria-expanded]):hover { filter: brightness(1.18); box-shadow: 0 0 0 1px rgba(0, 40, 140, 0.35); }
        .mak-icon:active { filter: brightness(0.88); }
        :host(:not(.in-block)) .box > .head .mak-fold[aria-expanded="false"] { background: ${XP.restore} center / 11px no-repeat, var(--ap-head-btn-bg); }

        /* ---- The controls ---- */
        /* The buttons: 23 px high, 75 px wide with a text; an orange light on hover; pressed; the default one with a blue edge */
        .btn, .mak-btn, .chips button, .week, .win button.plain, .win button.btn, .mail button:not(.x) {
          color: #000000; font-family: var(--ap-font); font-weight: 400; background: ${XP.face}; border: 1px solid #003c74; border-radius: 3px; box-shadow: none; }
        .btn, .mak-btn, .win button.plain, .win button.btn, .mail button:not(.x) { min-width: 75px; min-height: 23px; padding: 2px 12px; }
        .chips button { min-height: 21px; padding: 1px 10px; }
        .btn:hover, .mak-btn:hover, .chips button:hover, .week:hover, .win button.plain:hover, .win button.btn:hover, .mail button:not(.x):hover {
          filter: none; box-shadow: ${XP.hover}; }
        .btn.primary, .mak-btn { box-shadow: ${XP.default}; }
        .btn:active, .mak-btn:active, .chips button:active, .week:active, .win button.plain:active, .win button.btn:active, .mail button:not(.x):active,
        .chips button[aria-pressed="true"], .week.on { background: ${XP.pressed}; box-shadow: none; outline: 0; }
        .btn:focus-visible, .mak-btn:focus-visible, .chips button:focus-visible, .week:focus-visible, .win button:focus-visible, .mail button:focus-visible {
          outline: 1px dotted #000000; outline-offset: -4px; }
        .btn:disabled, .mak-btn:disabled, .win button.plain:disabled, .win button.btn:disabled, .mail button:disabled {
          color: #aca899; background: #f5f4ea; border-color: #c9c7ba; box-shadow: none; opacity: 1; }
        /* The check boxes and the radio buttons: white, a green tick, a green dot */
        input[type="checkbox"], input[type="radio"] { -webkit-appearance: none; appearance: none; flex: none; width: 13px; height: 13px; padding: 0; cursor: pointer;
          border: 1px solid #1c5180; border-radius: 0; background: linear-gradient(135deg, #dcdcd7 0%, #ffffff 100%); box-shadow: none; }
        input[type="radio"] { border-radius: 50%; }
        input[type="checkbox"]:checked { background: ${XP.check} center / 9px no-repeat, linear-gradient(135deg, #dcdcd7 0%, #ffffff 100%); }
        input[type="radio"]:checked { background: radial-gradient(circle, #5fdc54 0 1.6px, #21a121 2.6px, rgba(33, 161, 33, 0) 3.2px), linear-gradient(135deg, #dcdcd7 0%, #ffffff 100%); }
        input[type="checkbox"]:hover, input[type="radio"]:hover { box-shadow: inset -2px -2px #f8b636, inset 2px 2px #fedf9c; }
        /* The combo boxes: white, with the light blue button and its arrow */
        select { -webkit-appearance: none; appearance: none; min-height: 21px; padding: 1px 22px 1px 4px; color: #000000; border: 1px solid #7f9db9; border-radius: 0;
          background: ${XP.down} right 6px center / 8px 5px no-repeat, ${XP.knob} right 1px center / 16px calc(100% - 2px) no-repeat, #ffffff; }
        select:hover { background: ${XP.down} right 6px center / 8px 5px no-repeat, linear-gradient(135deg, #f2f6ff 0%, #d4e2fd 55%, #bad0fa 100%) right 1px center / 16px calc(100% - 2px) no-repeat, #ffffff; }
        /* The scroll bars */
        ::-webkit-scrollbar { width: 17px; height: 17px; }
        ::-webkit-scrollbar-track { background: linear-gradient(90deg, #f3f1ec 0%, #fefefe 100%); }
        ::-webkit-scrollbar-thumb { border: 1px solid #ffffff; border-radius: 3px; box-shadow: inset 0 0 0 1px #b1c6f7;
          background: ${XP.grip} center / 8px 8px no-repeat, linear-gradient(90deg, #c8d6fb 0%, #bccefa 45%, #b0c6f9 100%); }
        ::-webkit-scrollbar-thumb:hover { background: ${XP.grip} center / 8px 8px no-repeat, linear-gradient(90deg, #dae5fd 0%, #cddcfc 45%, #c2d4fb 100%); }
        ::-webkit-scrollbar-button { display: block; width: 17px; height: 17px; border: 1px solid #ffffff; border-radius: 3px; box-shadow: inset 0 0 0 1px #b1c6f7; }
        ::-webkit-scrollbar-button:start:increment, ::-webkit-scrollbar-button:end:decrement { display: none; }
        ::-webkit-scrollbar-button:vertical:start:decrement { background: ${XP.up} center / 8px 5px no-repeat, ${XP.knob}; }
        ::-webkit-scrollbar-button:vertical:end:increment { background: ${XP.down} center / 8px 5px no-repeat, ${XP.knob}; }
        ::-webkit-scrollbar-button:horizontal:start:decrement { background: ${XP.left} center / 5px 8px no-repeat, ${XP.knob}; }
        ::-webkit-scrollbar-button:horizontal:end:increment { background: ${XP.right} center / 5px 8px no-repeat, ${XP.knob}; }
        ::-webkit-scrollbar-corner { background: var(--ap-win-bg); }
        /* The tabs of a window of properties */
        nav.tabs { gap: 2px; padding: 6px 8px 0; border-bottom: 1px solid #919b9c; }
        nav.tabs button { flex: none; padding: 3px 8px; margin-bottom: -1px; color: #000000; font-size: 11px; border: 1px solid #919b9c; border-bottom: 0;
          border-radius: 3px 3px 0 0; background: linear-gradient(180deg, #ffffff 0%, #fafaf9 26%, #f0f0ea 95%, #ecebe6 100%); }
        nav.tabs button:hover { border-top: 2px solid #e68b2c; padding-top: 2px; }
        nav.tabs button[aria-selected="true"] { color: var(--ap-fg); background: var(--ap-surface); border-top: 3px solid #e68b2c; padding-top: 1px; font-weight: 400; }
        /* The week strip: buttons, with the dark text of the buttons also in the dark mode */
        .week .n { color: #000000; }
        .week .label { color: #444444; }
        .week .track { background: #d6d0c5; }
        /* The balloons of the notification area: information, warning */
        .whatsnew, .notice { color: #000000; padding: 8px 10px 8px 32px; border: 1px solid #000000; border-radius: 7px; box-shadow: 2px 3px 6px rgba(0, 0, 0, 0.3);
          background: ${XP.info} 9px 9px / 16px no-repeat, #ffffe1; }
        .notice { background: ${XP.warn} 9px 9px / 16px no-repeat, #ffffe1; }
        .whatsnew .x { color: #000000; }

        /* ---- The search (Ctrl+K): a window with a title bar, a field and a white list, and a status bar ---- */
        .panel > .bar { display: flex; }
        .panel > input { margin: 10px 10px 6px; padding: 3px 6px; font-family: var(--ap-font); font-size: 12px; font-weight: 400; font-style: normal; letter-spacing: normal;
          color: var(--ap-input-fg); background: var(--ap-input-bg); border: 1px solid var(--ap-input-edge); caret-color: auto; }
        .panel > input::placeholder { color: #808080; }
        .panel > .list { margin: 0 10px 8px; padding: 2px; background: var(--ap-surface); border: 1px solid #7f9db9; }
        .panel h3 { margin: 6px 4px 2px; font-family: var(--ap-font); font-size: 11px; font-weight: 700; font-style: normal; color: var(--ap-link); }
        .panel a.item { padding: 3px 6px; border-radius: 0; }
        .panel .tip { padding: 4px 4px 0; }
        .panel > .foot { padding: 3px 20px 3px 10px; font-size: 11px; color: var(--ap-fg); border-top: 1px solid rgba(0, 0, 0, 0.22);
          box-shadow: inset 0 1px rgba(255, 255, 255, 0.7); background: ${XP.corner} right 2px bottom 2px / 12px no-repeat; }
        /* The selection of the lists */
        a.item.sel, .result.sel { background: #316ac5; color: #ffffff; }
        a.item.sel .meta, .result.sel .meta { color: inherit; opacity: 0.85; }
        a.item.sel mark, .result.sel mark { background: none; color: inherit; text-decoration: underline; }

        /* ---- Mi sitio: the panes of tasks of the file explorer, on the blue of the block ---- */
        /* A pane: the head (white to blue, the title in blue, a round button), the body in light blue */
        .tile, :host(.in-block) .box > .head + *, .actions { background: var(--ap-accent-soft); border: 1px solid #ffffff; border-radius: 5px 5px 0 0; }
        .tile { padding: 0 12px 12px; }
        .tile > h4, :host(.in-block) .box > .head { margin: 0 -12px 10px; padding: 6px 8px 6px 12px; background: linear-gradient(90deg, #ffffff 0%, #c6d3f7 100%);
          color: #215dc6; border-radius: 4px 4px 0 0; }
        :host(.in-block) .box > .head { margin: 0; border-radius: 5px 5px 0 0; }
        .tile > h4, :host(.in-block) .box > .head .title { font-family: var(--ap-font); font-size: 12px; font-weight: 700; text-shadow: none; }
        :host(.in-block) .box > .head + * { padding: 10px; border-top: 0; border-radius: 0; }
        :host(.in-block) .box > .head .mak-fold, .sem .mak-fold { width: 20px; height: 20px; border-radius: 50%; color: #215dc6; border: 1px solid #ffffff;
          background: linear-gradient(180deg, #ffffff 0%, #c6d3f7 100%); box-shadow: 0 0 0 1px #8aa4d8; }
        .mak-fold svg { width: 14px; height: 14px; }
        /* Group boxes: the title on the border */
        .guide-card { border: 1px solid #d0d0bf; border-radius: 3px; }
        .guide-card h4 { font-family: var(--ap-font); font-size: 11px; font-weight: 700; text-shadow: none; }
        .sem { position: relative; margin-top: 12px; padding: 12px 10px 8px; border: 1px solid #d0d0bf; border-radius: 3px; }
        .sem-head { position: absolute; top: -11px; left: 8px; right: 8px; }
        .sem-head .sem-title { flex: none; padding: 0 4px; background: var(--ap-win-bg); color: var(--ap-link); font-family: var(--ap-font); font-size: 11px; font-weight: 400; }
        :host(.in-block) .sem-head .sem-title { background: var(--ap-accent-soft); }
        .sem-head .mak-fold { margin-left: auto; }
        .exams li { border-radius: 3px; background: var(--ap-surface); }
        /* The actions: the links of a pane of tasks, the green arrow first */
        .actions { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 10px 12px; border-radius: 5px; }
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
        /* The next exam: a white panel, the days in large, in the blue of the titles */
        .next-exam { background: var(--ap-surface); border: 1px solid #7f9db9; border-radius: 0; }
        .next-exam .day { font-size: 28px; color: var(--ap-link); text-shadow: none; }
        .next-exam .count { font-size: 1.15em; }
      `
    },

    // ---- 7 · Cuaderno: a real notebook. A page with lines, a red margin and a spiral; blue pen; sticky
    // notes with washi tape, index cards, dividers with tabs, highlighters, and erasers for the buttons.
    // The dark mode: a notebook of black paper and a white gel pen (the notes and the erasers stay as they are).
    {
      id: 'cuaderno',
      keepHover: ['.actions .action'], // the erasers: their own hover (they rise)
      name: { es: 'Folio', en: 'Folio' },
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
        'primary-solid': '#f5f2ea',
        'btn-solid': '#f5f2ea',
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
        'head-btn-solid': 'var(--ap-solid)',
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
          border-radius: 5px 8px 6px 7px / 7px 5px 8px 6px !important;
          --ap-btn-fg: var(--ap-fg); --ap-btn-solid: var(--ap-solid); --ap-head-btn-fg: var(--ap-fg); --ap-head-btn-solid: var(--ap-solid); --ap-primary-fg: var(--ap-fg); --ap-primary-solid: var(--ap-solid); }
        /* The next exam: a yellow sticky note with tape */
        .next-exam { --ap-fg: #1d2a78; --ap-muted: #4c5590; --ap-count-fg: #1d2a78; --ap-count-soon-fg: #c2570c; --ap-count-hot-fg: #d0262b; --ap-count-hot-edge: #d0262b;
          position: relative; margin: 14px 6px 14px; padding: 10px 16px 9px; color: #1d2a78; border: 0; transform: rotate(-1.2deg);
          ${NOTE('var(--ap-accent-soft)')} }
        .next-exam::before { ${TAPE('rgba(240, 150, 168, 0.62)')} }
        .next-exam .day { font-size: 44px; }
        .next-exam .count { font-size: 1.35em; }
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
        .count.hot, .count.ok, .u-red .countdown, .u-overdue .countdown, .tag.ok { border: 2px solid var(--ap-count-hot-edge); }
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
    },
    // ---- 7 · Vía Láctea (id "galaxia"): glass over the real Milky Way, a photo of ESO/S. Brunier (CC BY 4.0,
    // https://www.eso.org/public/images/eso0932a/), turned so that the band goes up to the right. The light mode:
    // the same sky at dusk, periwinkle, with the band in white. The images are files of the extension (img/).
    {
      id: 'galaxia',
      name: { es: 'Vía Láctea', en: 'Milky Way' },
      brand: 'Vía Aulactea', // the name in the titles
      about: { es: 'Vidrio sobre la Vía Láctea de verdad y una foto del espacio en cada asignatura (fotos: ESO y NASA).', en: 'Glass over the real Milky Way, and a photo of space in each subject (photos: ESO and NASA).' },
      // The photos of the parts of a subject (one for each subject, MAK.assignSitePhotos) and of the bar of the novelties:
      // ESO, CC BY 4.0 (eso1625a ESO/H. Drass et al., eso1208a ESO/T. Preibisch, eso0202a, eso1238a ESO/B. Bailleul,
      // eso1740a, eso1105a ESO/Igor Chekalin, eso0848a, eso0926a, eso1221a, eso1303a ESO/F. Comeron; the novelties
      // eso1131a). Blurred on purpose, small: the browser makes them large. The Earth of the next exam: NASA (Blue Marble).
      photos: { sites: ['galaxia-site-01', 'galaxia-site-02', 'galaxia-site-03', 'galaxia-site-04', 'galaxia-site-05', 'galaxia-site-06', 'galaxia-site-07', 'galaxia-site-08', 'galaxia-site-09', 'galaxia-site-10'], news: 'galaxia-news' },
      photoBg: {
        light: 'linear-gradient(rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.5)), url("ap-asset:img/{photo}-light.webp") 50% 35% / cover no-repeat, #e8e4f9',
        dark: 'linear-gradient(rgba(5, 8, 26, 0.5), rgba(5, 8, 26, 0.5)), url("ap-asset:img/{photo}.webp") 50% 35% / cover no-repeat, #05081a'
      },
      fonts: [{ family: 'AP Manrope', file: 'manrope.woff2', weight: '400 800' }],
      light: {
        font: '"AP Manrope", "Manrope", system-ui, sans-serif',
        weight: '500',
        'head-weight': '800',
        'head-spacing': '0.01em',
        page: 'url("ap-asset:img/galaxia-light.webp") 50% 40% / cover no-repeat, #e8e4f9',
        surface: 'rgba(255, 255, 255, 0.4)',
        solid: '#eef0fd',
        'btn-solid': 'var(--ap-solid)',
        'hover-shadow': '0 0 18px -2px rgba(163, 139, 255, 0.6)',
        'win-bg': 'linear-gradient(rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.5)), url("ap-asset:img/galaxia-light.webp") 50% 0 / 100% auto no-repeat, #e8e4f9',
        surface2: 'rgba(255, 255, 255, 0.66)',
        fg: '#181c4f',
        muted: '#454c8c',
        line: 'rgba(255, 255, 255, 0.7)',
        edge: 'rgba(255, 255, 255, 0.78)',
        accent: '#2c32a6',
        'accent-fg': '#ffffff',
        'accent-soft': 'rgba(255, 255, 255, 0.55)',
        link: '#2c32a6',
        red: '#b0275e', 'red-bg': 'rgba(255, 205, 222, 0.7)',
        orange: '#9c4a14', 'orange-bg': 'rgba(255, 224, 200, 0.7)',
        yellow: '#715c0c', 'yellow-bg': 'rgba(255, 240, 185, 0.7)',
        green: '#1f6a52', 'green-bg': 'rgba(200, 240, 222, 0.7)',
        blue: '#2c32a6', 'blue-bg': 'rgba(210, 218, 255, 0.75)',
        grey: '#454c8c', 'grey-bg': 'rgba(255, 255, 255, 0.55)',
        'mark-bg': 'linear-gradient(transparent 58%, rgba(160, 150, 255, 0.55) 58%)',
        'head-fg': '#181c4f',
        'head-line': '1px solid rgba(255, 255, 255, 0.7)',
        'btn-bg': 'rgba(255, 255, 255, 0.55)',
        'btn-fg': '#181c4f',
        'btn-edge': 'rgba(255, 255, 255, 0.85)',
        'primary-bg': 'linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9)) padding-box, linear-gradient(110deg, #3fa6e0, #7b5fe0, #e05fa8) border-box',
        'primary-fg': '#181c4f',
        'primary-edge': 'transparent',
        'primary-solid': '#ffffff',
        radius: '18px',
        'radius-sm': '999px',
        'radius-box': '14px',
        shadow: '0 22px 46px -28px rgba(30, 30, 110, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        'shadow-pop': '0 30px 70px -22px rgba(30, 30, 110, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        blur: 'blur(4px) saturate(120%)',
        backdrop: 'rgba(40, 44, 120, 0.3)',
        'item-sep': '1px solid rgba(255, 255, 255, 0.7)',
        'count-weight': '800',
        'count-fg': '#181c4f',
        'count-soon-fg': '#9c4a14',
        'count-hot-fg': '#b0275e',
        'count-ok-fg': '#1f6a52',
        'input-bg': 'rgba(255, 255, 255, 0.55)',
        'input-edge': 'rgba(255, 255, 255, 0.9)',
        'input-radius': '12px',
        'logo-bg': '#ffffff',
        'logo-ring': '#3a3fc4',
        'logo-dot': '#a38bff',
        'k-exam': 'linear-gradient(90deg, #b9c2ff, #d3c4ff)', 'k-exam-fg': '#181c4f',
        'k-practice': 'linear-gradient(90deg, #bfe3ff, #c8d4ff)', 'k-practice-fg': '#181c4f',
        'k-work': '#cdeee0', 'k-work-fg': '#181c4f',
        'k-participation': '#fff0b8', 'k-participation-fg': '#181c4f',
        'k-presentation': '#e6d8ff', 'k-presentation-fg': '#181c4f',
        'k-other': '#e3e5f6', 'k-other-fg': '#181c4f'
      },
      dark: {
        page: 'linear-gradient(rgba(5, 8, 26, 0.18), rgba(5, 8, 26, 0.18)), url("ap-asset:img/galaxia-dark.webp") 50% 40% / cover no-repeat, #05081a',
        surface: 'rgba(8, 11, 36, 0.3)',
        solid: '#0c1031',
        'win-bg': 'linear-gradient(rgba(5, 8, 26, 0.52), rgba(5, 8, 26, 0.52)), url("ap-asset:img/galaxia-dark.webp") 50% 0 / 100% auto no-repeat, #05081a',
        surface2: 'rgba(255, 255, 255, 0.08)',
        fg: '#eceeff',
        muted: '#afb6e2',
        line: 'rgba(200, 210, 255, 0.16)',
        edge: 'rgba(200, 210, 255, 0.24)',
        accent: '#c9d0ff',
        'accent-fg': '#0c1031',
        'accent-soft': 'rgba(200, 210, 255, 0.1)',
        link: '#c9d0ff',
        red: '#ff95b6', 'red-bg': 'rgba(130, 40, 80, 0.45)',
        orange: '#ffbf8f', 'orange-bg': 'rgba(130, 75, 40, 0.45)',
        yellow: '#f3d97a', 'yellow-bg': 'rgba(110, 95, 30, 0.45)',
        green: '#9ee3c3', 'green-bg': 'rgba(40, 100, 80, 0.45)',
        blue: '#aebcff', 'blue-bg': 'rgba(55, 70, 150, 0.5)',
        grey: '#afb6e2', 'grey-bg': 'rgba(255, 255, 255, 0.08)',
        'mark-bg': 'linear-gradient(transparent 58%, rgba(140, 130, 255, 0.5) 58%)',
        'head-fg': '#eceeff',
        'head-line': '1px solid rgba(200, 210, 255, 0.16)',
        'btn-bg': 'rgba(255, 255, 255, 0.08)',
        'btn-fg': '#eceeff',
        'btn-edge': 'rgba(200, 210, 255, 0.3)',
        'primary-bg': 'linear-gradient(rgba(14, 18, 48, 0.92), rgba(14, 18, 48, 0.92)) padding-box, linear-gradient(110deg, #7fd3ff, #a38bff, #ff9bd2) border-box',
        'primary-fg': '#ffffff',
        'primary-edge': 'transparent',
        'primary-solid': '#0e1230',
        shadow: '0 22px 46px -26px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'shadow-pop': '0 30px 70px -20px rgba(0, 0, 0, 0.85), 0 0 40px -12px rgba(120, 120, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        backdrop: 'rgba(2, 3, 14, 0.55)',
        'item-sep': '1px solid rgba(200, 210, 255, 0.16)',
        'count-fg': '#eceeff',
        'count-soon-fg': '#ffbf8f',
        'count-hot-fg': '#ff95b6',
        'count-ok-fg': '#9ee3c3',
        'input-bg': 'rgba(255, 255, 255, 0.06)',
        'input-edge': 'rgba(200, 210, 255, 0.28)',
        'logo-bg': '#0c1031',
        'logo-ring': '#c9d0ff',
        'logo-dot': '#a38bff',
        'k-exam': 'linear-gradient(90deg, #5d5fd0, #8a6fd6)', 'k-exam-fg': '#ffffff',
        'k-practice': 'linear-gradient(90deg, #3f7fc4, #5b6fd0)', 'k-practice-fg': '#ffffff',
        'k-work': '#3f8a72', 'k-work-fg': '#ffffff',
        'k-participation': '#a8903e', 'k-participation-fg': '#ffffff',
        'k-presentation': '#7f62c4', 'k-presentation-fg': '#ffffff',
        'k-other': '#4c5180', 'k-other-fg': '#ffffff'
      },
      css: `
        nav.tabs { border-bottom: 1px solid var(--ap-line); }
        .mak-logo { border-radius: 50%; }
        /* One level of glass (a tile, a card of a guide); in it, rows with thin lines, not more glass. */
        .tile, .guide-card { background: var(--ap-surface2); border: 1px solid var(--ap-edge); }
        .sem { background: transparent; border: 0; border-top: 1px solid var(--ap-line); border-radius: 0; padding: 8px 0 4px; }
        .sems.two .sem { border-top: 0; }
        /* The exams: a card for each subject, with its planet */
        .exams { gap: 10px; }
        .exams li { position: relative; padding: 10px 12px; border-radius: 14px; border: 1px solid var(--ap-edge);
          background: linear-gradient(110deg, rgba(61, 94, 230, 0.2), rgba(201, 74, 166, 0.1)), var(--ap-surface2); }
        .exams li[data-photo] { padding-left: 54px; }
        .exams li[data-photo]::before { content: ""; position: absolute; left: 11px; top: 10px; width: 34px; height: 34px;
          background: center / contain no-repeat; filter: drop-shadow(0 0 6px rgba(150, 170, 255, 0.45)); }
        ${PLANET_CSS}
        .countdown, .count { text-shadow: 0 0 14px rgba(160, 150, 255, 0.45); }
        .next-exam .day { width: 66px; height: 66px; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 50%;
          background: radial-gradient(circle, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.24) 40%, transparent 66%), url("ap-asset:img/galaxia-earth.webp") center / cover no-repeat, #1d4e9e;
          color: #ffffff; text-shadow: 0 0 10px rgba(0, 0, 0, 0.75), 0 0 2px rgba(0, 0, 0, 0.6); /* a shadow in the middle, behind the days */
          box-shadow: 0 0 20px rgba(110, 170, 255, 0.5); font-size: 24px; line-height: 0.9; }
        .next-exam .day small { font-size: 11px; margin-top: 2px; }
        /* The buttons: an edge of nebula and a glow (on hover the colors change places, with a stronger glow: MAK.hoverCss). */
        .btn.primary, .power, .mak-btn, .mak-icon, .actions .action, .win button.primary, .mail button.primary {
          box-shadow: 0 0 14px -2px rgba(163, 139, 255, 0.35), inset 0 0 0 0 var(--ap-primary-fg); }
        .mak-logo { background: ${SATURN} center / contain no-repeat; }
        .mak-logo > * { display: none; }
      `,
      blockCss: `
        #mak-block .mak-logo { background: ${SATURN} center / contain no-repeat; }
        #mak-block .mak-logo > * { display: none; }
      `
    }
  ];

  MAK.DEFAULT_THEME = 'miaulario';
  MAK.themeIds = () => MAK.THEMES.map((th) => th.id);
  // The theme with this id, else the default theme.
  MAK.theme = (id) => MAK.THEMES.find((th) => th.id === id) || MAK.THEMES.find((th) => th.id === MAK.DEFAULT_THEME) || MAK.THEMES[0];
  // The name of a theme in the language of the user.
  MAK.themeName = (th, lang) => (th.name && (th.name[lang] || th.name.es)) || th.id;
  MAK.themeAbout = (th, lang) => (th.about && (th.about[lang] || th.about.es)) || '';
  // The name of the extension in the titles: the name of the theme ("AulaXP"), else "Aulario Plus".
  MAK.brandName = (th) => (th || MAK.theme(MAK.themeId)).brand || 'Aulario Plus';

  // All the variables of a theme for one mode: BASE (light, then dark in the dark mode), then the light
  // values of the theme, then (dark) the dark values of the theme. { name: value }.
  // A file of the extension in a value: "ap-asset:img/<file>". In the pages of the extension, the address is relative;
  // content-theme.js gives the full address for the parts in MiAulario (web_accessible_resources).
  MAK.assetUrl = (file) => file;
  const assets = (text) => String(text || '').replace(/ap-asset:([\w./-]+)/g, (_, file) => MAK.assetUrl(file));
  MAK.themeValues = function (id, dark) {
    const th = MAK.theme(id);
    const all = Object.assign({}, BASE.light, dark ? BASE.dark : null, th.light, dark ? th.dark : null);
    for (const k of Object.keys(all)) all[k] = assets(all[k]);
    return all;
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

  // On hover (and with the keyboard) a button changes its colors, slowly (0.3 s): the color of its text fills it from
  // the edges, and its own color as one color (…-solid) is the text. The shadow of the theme stays, and hover-shadow
  // comes (first in the list, so the change is smooth). [the buttons, their colors]: the normal ones, the ones in a head,
  // the primary ones (the last ones win). A theme that draws a button with other colors sets these variables on it, and
  // it can keep its own hover for some buttons (keepHover: their selectors); its other hover rules do not hide the text
  // (!important). dark: the mode.
  const INVERT = [
    [['.btn', 'nav.tabs button', '.chips button', '.switch', '.counter', '.tool', '.pencil', '.history-icon', '.week', '.mak-fold',
      '.cal-toggle[aria-pressed="false"]', ':host(.in-block) .box > .head .mak-fold', '.win button.plain', '.win button.btn', '.mail button', '.pop button'], 'btn'],
    [['.icon-btn', 'button.x', '.box > .head .mak-fold', '.win > header button.plain', '.win > header button.btn'], 'head-btn'],
    [['.btn.primary', '.power', '.mak-btn', '.mak-icon', '.actions .action', '.chips button[aria-pressed="true"]', '.cal-toggle[aria-pressed="true"]',
      '.win button.primary', '.mail button.primary', '.pop button.save'], 'primary']
  ];
  MAK.hoverCss = function (th, dark) {
    const v = MAK.themeValues(th.id, dark);
    const keep = ['shadow-sm', 'hover-shadow'].filter((k) => v[k] && v[k].trim() !== 'none').map((k) => `var(--ap-${k}), `).join('');
    // A ✕ has no frame: it fills with the shape of the buttons (a theme with its own ✕ keeps it).
    return `button.x { border-radius: var(--ap-radius-sm); }\n${INVERT.map(([all, kind]) => {
      const sel = all.filter((s) => !(th.keepHover || []).includes(s));
      return `${sel.join(', ')} { transition-duration: 0.3s; }
    ${sel.flatMap((s) => [`${s}:hover`, `${s}:focus-visible`]).join(', ')} {
      color: var(--ap-${kind}-solid) !important; filter: none !important; box-shadow: ${keep}inset 0 0 0 40px var(--ap-${kind}-fg) !important; }`;
    }).join('\n')}`;
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
  // 'system': light, and dark with prefers-color-scheme), the cards of all the themes and the CSS of the theme.
  MAK.pageThemeCss = function (id, url, scheme) {
    const th = MAK.theme(id);
    const vars = scheme === 'light' || scheme === 'dark'
      ? [`:root { color-scheme: ${scheme}; ${MAK.themeVars(th.id, scheme === 'dark')} }`]
      : [`:root { color-scheme: light dark; ${MAK.themeVars(th.id, false)} }`, `@media (prefers-color-scheme: dark) { :root { ${MAK.themeVars(th.id, true)} } }`];
    const cards = MAK.THEMES.map((t) => t.cardCss || '');
    return [MAK.fontFaceCss(MAK.THEMES, url), ...vars, MAK.motionCss(ALL), ...cards, assets(th.css), MAK.hoverCss(th, scheme === 'dark'), MAK.themeIconCss(th)].join('\n');
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
  MAK.sitePhotoMap = {}; // the photo of each subject: { siteId: n } (MAK.assignSitePhotos; content-theme.js reads it)
  // The background of a part with a photo of its own, if the theme has photos: "news" (the bar of the novelties) or the
  // id of a site (the photo of the subject).
  function photoVar(th, photo, dark) {
    if (!photo || !th.photos || !th.photoBg) return '';
    const file = photo === 'news' ? th.photos.news : th.photos.sites[MAK.sitePhotoMap[photo]];
    return file ? ` --ap-win-bg: ${assets((dark ? th.photoBg.dark : th.photoBg.light).replace('{photo}', file))};` : '';
  }
  function themedText(css, opts) {
    const th = MAK.theme(MAK.themeId);
    const dark = typeof MAK.isDarkPage === 'function' && MAK.isDarkPage();
    const scope = (opts && opts.scope) || ':host';
    const own = opts && opts.scope ? th.blockCss || '' : `${th.css || ''}\n${MAK.hoverCss(th, dark)}\n${MAK.themeIconCss(th)}`; // the block: its own CSS
    const motion = MAK.motionCss(opts && opts.scope ? `${scope}, ${scope} *, ${scope}::before, ${scope} *::before, ${scope} *::after` : ALL);
    return `${scope} { ${MAK.themeVars(th.id, dark)}${photoVar(th, opts && opts.photo, dark)} }\n${motion}\n${css}\n${assets(own)}`;
  }
  // opts.scope: a selector for a style in the page (not in a shadow root); then the variables and the
  // blockCss of the theme (the only style in the page is the one of the block). opts.photo: the photo of the part.
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
