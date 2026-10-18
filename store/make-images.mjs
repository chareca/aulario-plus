// The images of the store listings (store/images), from the test harness: synthetic data and the
// real code of the extension. Screenshots of 1280x800 (a text and a capture of the extension), and
// the small promo tile of 440x280 of the Chrome Web Store.
// Usage: node store/make-images.mjs   (Node.js 22 or later, a Chromium browser: see tests/browser/cdp.mjs)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, launch } from '../tests/browser/cdp.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'store', 'images');
const HARNESS = join(ROOT, 'tests', 'harness', 'out');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

execFileSync(process.execPath, [join(ROOT, 'tests', 'harness', 'make.js')], { stdio: 'ignore' });
mkdirSync(OUT, { recursive: true });

// The browser gets the files of the harness from the disk (Fetch interception): no network, no server.
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const BASE = 'http://harness.localhost';
function harnessFile(url) {
  const path = normalize(decodeURIComponent(new URL(url).pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(HARNESS, path === '/' ? 'site.html' : path);
  return file.startsWith(HARNESS) && existsSync(file) ? file : null;
}

const chrome = findChrome();
if (!chrome) throw new Error('No Chromium browser (set CHROME_PATH)');
const browser = await launch({ chrome, headless: true });
try {
  const tab = await browser.openTab('about:blank');
  const call = (method, params = {}) => browser.call(method, params, tab.sessionId);
  browser.on((m) => {
    if (m.method !== 'Fetch.requestPaused' || m.sessionId !== tab.sessionId) return;
    const file = harnessFile(m.params.request.url);
    const reply = file
      ? { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: TYPES[extname(file)] || 'application/octet-stream' }], body: readFileSync(file).toString('base64') }
      : { requestId: m.params.requestId, responseCode: 404, responseHeaders: [], body: '' };
    call('Fetch.fulfillRequest', reply).catch(() => {});
  });
  await call('Fetch.enable', { patterns: [{ urlPattern: `${BASE}/*` }] });
  await call('Page.enable');
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  const size = (width, height, scale = 2) => call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
  const open = async (url, wait = 4500) => {
    await tab.navigate(url);
    await sleep(wait);
  };
  const shot = async (clip) => (await call('Page.captureScreenshot', Object.assign({ format: 'png' }, clip ? { clip: Object.assign({ scale: 1 }, clip) } : {}))).data;
  const rect = (expr) => tab.evaluate(`(() => { const r = (${expr}).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
  const click = async (x, y) => {
    for (const type of ['mousePressed', 'mouseReleased']) await call('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  };
  // The windows of the extension are in closed shadow roots: the page cannot see them, CDP can.
  const attr = (n, name) => {
    const a = n.attributes || [];
    for (let i = 0; i < a.length; i += 2) if (a[i] === name) return a[i + 1];
    return '';
  };
  const textOf = (n) => (n.children || []).map((c) => (c.nodeType === 3 ? c.nodeValue : textOf(c))).join('');
  const shadowBox = async (test, what) => {
    const { root } = await call('DOM.getDocument', { depth: -1, pierce: true });
    const walk = (n) => {
      if (n.nodeType === 1 && test(n)) return n;
      for (const k of [...(n.shadowRoots || []), ...(n.children || [])]) {
        const f = walk(k);
        if (f) return f;
      }
      return null;
    };
    const node = walk(root);
    if (!node) throw new Error(`No ${what} in the harness`);
    const [x1, y1, , , x2, y2] = (await call('DOM.getBoxModel', { nodeId: node.nodeId })).model.border;
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  };

  // The harness keeps its data in the memory of the page and syncs at each load: wait for the data.
  const ready = async (expr, what) => {
    if (!(await browser.waitFor(tab, expr, 20000))) throw new Error(`No ${what} in the harness`);
    await sleep(600);
  };

  // 1. The popup: the deliveries.
  await size(460, 580);
  await open(`${BASE}/popup.html?tab=due`, 500);
  await ready("document.querySelectorAll('.item').length > 2", 'deliveries');
  const due = await shot();

  // 2. The popup: the grade calculator with the weights of the course guide.
  await open(`${BASE}/popup.html?tab=grades`, 500);
  await ready("!!document.querySelector('.card[data-site] .head .link-btn')", 'grades');
  await tab.evaluate(`(async () => {
    const card = [...document.querySelectorAll('.card[data-site]')].find((c) => c.querySelector('.head .link-btn'));
    card.querySelector('.head .link-btn').click();
    await new Promise((r) => setTimeout(r, 1500));
    const c = document.querySelector('.card[data-site="' + card.dataset.site + '"]');
    const g = [...c.querySelectorAll('.calc-row.chips button')].find((b) => /Gu/.test(b.textContent));
    if (g) g.click();
    await new Promise((r) => setTimeout(r, 400));
    const c2 = document.querySelector('.card[data-site="' + card.dataset.site + '"]');
    const d = c2.querySelector('.calc-guide');
    if (d) d.open = true;
    c2.querySelector('.calc').scrollIntoView({ block: 'start' });
    document.querySelector('main').scrollTop -= 40;
    return true;
  })()`);
  await sleep(500);
  const grades = await shot();

  // 3. "Mi sitio": the assessment of the course guides.
  await size(1180, 760);
  await open(`${BASE}/site.html?mine=1`, 500);
  await ready("!!document.getElementById('mak-guide-host')", 'course guides');
  const guideBox = await rect("document.getElementById('mak-guide-host')");
  const guide = await shot({ x: guideBox.x, y: guideBox.y, width: guideBox.width, height: Math.min(guideBox.height, 560) });

  // 4. "Write to a teacher": the window of the button ✉ next to the name of a site.
  await size(1180, 760);
  await open(`${BASE}/site.html`, 500);
  await ready("document.querySelectorAll('.mak-teacher-button').length > 1 && !!document.getElementById('mak-guide-host')", 'buttons');
  const env = await rect("document.querySelectorAll('li.site-list-item .mak-teacher-button, .mak-teacher-button')[1]");
  await click(env.x + env.width / 2, env.y + env.height / 2);
  await sleep(1500);
  const pop = await shadowBox((n) => attr(n, 'role') === 'dialog' && /\bpop\b/.test(attr(n, 'class')), 'teacher window');
  const right = pop.x + pop.width + 24;
  const teacher = await shot({ x: Math.max(0, right - 700), y: 0, width: Math.min(700, right), height: pop.y + pop.height + 80 });

  // 5. The Resources list: the window "Send as an internal message".
  await size(1180, 800);
  await open(`${BASE}/site.html`, 500);
  await ready("!!document.querySelector('.mak-mail-button')", 'Resources buttons');
  await tab.evaluate("[...document.querySelectorAll('input[name=selectedMembers]')].filter((c) => !c.value.endsWith('/')).forEach((c) => c.click()); true");
  await sleep(600);
  // The button of the bar: the window with all the selected files.
  const barBtn = await shadowBox((n) => n.nodeName === 'BUTTON' && /Enviar por mensaje/.test(textOf(n)), 'button of the bar');
  await click(barBtn.x + barBtn.width / 2, barBtn.y + barBtn.height / 2);
  await sleep(1500);
  const win = await shadowBox((n) => attr(n, 'role') === 'dialog' && /\bmail\b/.test(attr(n, 'class')), 'mail window');
  const mail = await shot(win);

  // The icon of the extension, for the texts.
  const icon = readFileSync(join(ROOT, 'extension', 'common', 'icons', 'icon128.png')).toString('base64');

  // Compose: the text on the left, the capture on the right, on the color of the extension.
  const page = (body, w, h) => `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; }
    body { font-family: -apple-system, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif; color: #fff;
      background: radial-gradient(circle at 15% 20%, #1d7a6f 0%, #10524e 45%, #0b3330 100%); }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 700; font-size: 22px; letter-spacing: 0.2px; }
    .brand img { width: 44px; height: 44px; }
    h1 { font-size: 46px; line-height: 1.12; margin: 34px 0 18px; font-weight: 800; letter-spacing: -0.5px; }
    p { font-size: 21px; line-height: 1.45; margin: 0; color: #d6efe9; }
    .note { position: absolute; left: 64px; bottom: 44px; font-size: 14px; color: #a8d8cd; }
    .shot { border-radius: 14px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.12); background: #fff; display: block; }
    .fade { filter: drop-shadow(0 24px 30px rgba(0, 0, 0, 0.4)); }
    .fade .shot { box-shadow: none; mask-image: linear-gradient(to right, transparent 0, #000 110px), linear-gradient(to top, transparent 0, #000 60px); mask-composite: intersect; }
  </style></head><body>${body}</body></html>`;
  const slide = (title, text, png, maxW, maxH, fade) => page(`
    <div style="position:absolute; left:64px; top:64px; width:390px;">
      <div class="brand"><img src="data:image/png;base64,${icon}">Aulario Plus</div>
      <h1>${title}</h1><p>${text}</p>
    </div>
    <div class="note">Extensión no oficial para MiAulario (UPNA) · Datos de ejemplo</div>
    <div style="position:absolute; left:500px; top:0; right:0; bottom:0; display:flex; align-items:center; justify-content:center;">
      <div class="${fade ? 'fade' : ''}"><img class="shot" src="data:image/png;base64,${png}" style="max-width:${maxW}px; max-height:${maxH}px;"></div>
    </div>`, 1280, 800);

  const render = async (html, w, h, file) => {
    await size(w, h, 1);
    await tab.navigate('about:blank');
    const { frameTree } = await call('Page.getFrameTree');
    await call('Page.setDocumentContent', { frameId: frameTree.frame.id, html });
    await sleep(700);
    writeFileSync(join(OUT, file), Buffer.from(await shot(), 'base64'));
    console.log(`store/images/${file}`);
  };

  await render(slide('Todas tus entregas en un lugar', 'Cuenta atrás, las próximas semanas y lo que te falta entregar en cada materia.', due, 700, 720), 1280, 800, 'screenshot-1.png');
  await render(slide('La evaluación de cada materia', 'La guía docente en tu Mi sitio y en el Inicio de cada materia: pesos por tipo de actividad, recuperables y notas mínimas.', guide, 720, 700), 1280, 800, 'screenshot-2.png');
  await render(slide('Calcula tu nota con la guía docente', 'Tu nota actual y lo que necesitas para tu objetivo, con los pesos de la guía o del libro de calificaciones.', grades, 700, 720), 1280, 800, 'screenshot-3.png');
  await render(slide('Escribe a un profesor con un clic', 'El Correo interno se abre con el profesor como destinatario y un saludo ya escrito.', teacher, 740, 600, true), 1280, 800, 'screenshot-4.png');
  await render(slide('Envía archivos sin descargarlos', 'Los archivos de Recursos por el Correo interno, a ti o a tus compañeros, con un enlace cifrado si quieres.', mail, 700, 720), 1280, 800, 'screenshot-5.png');

  // The small promo tile (440x280).
  await render(page(`
    <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
      <img src="data:image/png;base64,${icon}" style="width:84px; height:84px;">
      <div style="font-size:34px; font-weight:800; margin-top:10px; letter-spacing:-0.3px;">Aulario Plus</div>
      <div style="font-size:17px; color:#d6efe9; margin-top:4px;">MiAulario, mejorado</div>
      <div style="font-size:11px; color:#a8d8cd; margin-top:14px;">Extensión no oficial para la UPNA</div>
    </div>`, 440, 280), 440, 280, 'promo-small.png');
} finally {
  browser.close();
}
