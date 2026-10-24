// The tests that need a real DOM (the readers of the MiAulario pages) and the whole pages of the extension
// (harness.mjs). They run in a headless Chromium with synthetic pages, without network and without a session.
// The same tests in Firefox: firefox/run.mjs.
// Usage: node tests/browser/run.mjs   (exit code 0: all tests passed; 2: no browser)
import { findChrome, launch } from './cdp.mjs';
import { runSuite, report } from './suite.mjs';

const chrome = findChrome();
if (!chrome) {
  console.log('No Chromium browser: the browser tests did not run. Set CHROME_PATH, or install the Chrome for Testing of Playwright.');
  process.exit(2);
}
const browser = await launch({ chrome });
let failed = 0;
try {
  failed = report(await runSuite(browser));
} finally {
  browser.close();
}
process.exit(failed ? 1 : 0);
