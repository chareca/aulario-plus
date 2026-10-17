// The tests that need a real DOM (the readers of the MiAulario pages). They run in a headless
// Chromium with synthetic pages, without network and without a session.
// Usage: node tests/browser/run.mjs   (exit code 0: all tests passed; 2: no browser)
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { findChrome, launch } from './cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const chrome = findChrome();
if (!chrome) {
  console.log('No Chromium browser: the browser tests did not run. Set CHROME_PATH, or install the Chrome for Testing of Playwright.');
  process.exit(2);
}
const browser = await launch({ chrome });
let failed = 0;
try {
  const tab = await browser.openTab(pathToFileURL(join(here, 'index.html')).href);
  if (!(await browser.waitFor(tab, 'window.__done === true', 20000))) throw new Error('The tests did not end in 20 seconds');
  const results = await tab.evaluate('window.__results');
  for (const r of results) {
    console.log(`${r.ok ? 'ok    ' : 'FAILED'} ${r.name}${r.ok ? '' : `\n       ${r.error}`}`);
    if (!r.ok) failed++;
  }
  console.log(`${results.length - failed} passed, ${failed} failed`);
} finally {
  browser.close();
}
process.exit(failed ? 1 : 0);
