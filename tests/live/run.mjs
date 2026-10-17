// The MiAulario checks against the real MiAulario, for the development. When MiAulario changes,
// the failed checks tell what to correct.
// - A test browser opens with the extension (dist/chromium) and its own profile (tests/live/.profile).
// - If there is no MiAulario session, log in in that window. The script waits for you.
//   The script never writes a user name or a password.
// - Then it runs the diagnostic page of the extension (tools.html?check=1) and prints the results.
// Usage: ./build.sh && node tests/live/run.mjs
// Exit code: 0 all checks passed, 1 a check failed, 2 the checks did not run.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, launch } from '../browser/cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const extension = join(here, '..', '..', 'dist', 'chromium');
const LOGIN_WAIT_MS = 5 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stop = (code, text) => {
  console.log(text);
  process.exit(code);
};

const chrome = findChrome();
if (!chrome) stop(2, 'No Chromium browser that can load an extension. Set CHROME_PATH, or install the Chrome for Testing of Playwright.');
if (!existsSync(join(extension, 'manifest.json'))) stop(2, 'No build of the extension. Run ./build.sh first.');

const browser = await launch({ chrome, headless: false, profile: join(here, '.profile'), extension });
let code = 2;
try {
  // The id of the extension: the address of its service worker.
  let extId = null;
  for (let i = 0; i < 50 && !extId; i++) {
    const { targetInfos } = await browser.call('Target.getTargets');
    const sw = targetInfos.find((t) => t.type === 'service_worker' && /^chrome-extension:\/\/[a-p]{32}\/background\.js$/.test(t.url));
    extId = sw ? new URL(sw.url).host : null;
    if (!extId) await sleep(200);
  }
  if (!extId) throw new Error('The extension did not start');

  const portal = await browser.openTab('https://miaulario.unavarra.es/portal');
  const loggedIn = () => portal.evaluate("fetch('/direct/session/current.json?auto=true', { credentials: 'include' }).then((r) => r.json()).then((s) => !!s.userId).catch(() => false)");
  await browser.waitFor(portal, "document.readyState === 'complete'", 30000);
  if (!(await loggedIn())) {
    console.log('Log in to MiAulario in the window of the test browser. The script waits 5 minutes.');
    console.log('It asks /direct/session/current.json every 2 seconds: the page can look logged in before the session is active.');
    const start = Date.now();
    let lastNote = start;
    while (Date.now() - start < LOGIN_WAIT_MS && !(await loggedIn().catch(() => false))) {
      await sleep(2000);
      if (Date.now() - lastNote >= 15000) {
        lastNote = Date.now();
        console.log(`  ... no active session yet (${Math.round((Date.now() - start) / 1000)} s)`);
      }
    }
    if (!(await loggedIn().catch(() => false))) throw new Error('No MiAulario session after 5 minutes');
  }
  console.log('Session found. Running the checks...');

  const page = await browser.openTab(`chrome-extension://${extId}/tools.html?check=1&auto=1`);
  if (!(await browser.waitFor(page, 'window.__checksDone === true', 180000))) throw new Error('The checks did not end in 3 minutes');
  const results = await page.evaluate('window.__checkResults');
  let failed = 0;
  for (const r of results) {
    const mark = r.ok === true ? 'ok     ' : r.ok === false ? 'FAILED ' : 'skipped';
    if (r.ok === false) failed++;
    console.log(`${mark} ${r.id}: ${r.detail} (${r.ms} ms)`);
  }
  console.log(`${results.filter((r) => r.ok === true).length} passed, ${failed} failed, ${results.filter((r) => r.ok === null).length} skipped`);
  code = failed ? 1 : 0;
} catch (e) {
  console.log(`The checks did not run: ${e.message}`);
} finally {
  browser.close();
}
process.exit(code);
