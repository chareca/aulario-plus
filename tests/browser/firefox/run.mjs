// The browser tests (../suite.mjs) in the engine of Firefox of Playwright, headless, with its own profile: the same
// pages and checks as ../run.mjs in Chromium (animations, styles, the organizer, the popup).
// One time: pnpm --dir tests/browser/firefox install
//           pnpm --dir tests/browser/firefox exec playwright-core install firefox   (only without that Firefox)
// Usage:    node tests/browser/firefox/run.mjs   (exit code 0: all tests passed; 2: no playwright-core or no Firefox)
import { runSuite, report } from '../suite.mjs';

let firefox;
try {
  ({ firefox } = await import('playwright-core'));
} catch {
  console.log('No playwright-core: the Firefox tests did not run. Run: pnpm --dir tests/browser/firefox install');
  process.exit(2);
}
let engine;
try {
  engine = await firefox.launch({ firefoxUserPrefs: { 'devtools.jsonview.enabled': false } }); // a JSON file as a page of its origin
} catch (e) {
  console.log(`No Firefox of Playwright: the Firefox tests did not run (${String(e.message).split('\n')[0]}). Run: pnpm --dir tests/browser/firefox exec playwright-core install firefox`);
  process.exit(2);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ctx = await engine.newContext({ viewport: { width: 1280, height: 720 } });
const pages = new Map();
let n = 0;
// The interface of ../cdp.mjs.
const browser = {
  async openTab(url) {
    const page = await ctx.newPage();
    const targetId = String(++n);
    pages.set(targetId, page);
    await page.goto(url, { waitUntil: 'commit' });
    return {
      targetId,
      evaluate: (expression) => page.evaluate(expression),
      // A function of the page with arguments: the values go to the page as data, never inside the code.
      callFunction: (declaration, ...args) => page.evaluate(new Function('a', `return (${declaration})(...a)`), args),
      navigate: (to) => page.goto(to, { waitUntil: 'commit' })
    };
  },
  async waitFor(tab, expression, ms = 15000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      try {
        if (await tab.evaluate(expression)) return true;
      } catch {}
      await sleep(200);
    }
    return false;
  },
  async call(method, params) {
    if (method !== 'Target.closeTarget') throw new Error(`${method}: not in Firefox`);
    const page = pages.get(params.targetId);
    pages.delete(params.targetId);
    if (page) await page.close();
    return {};
  }
};
let failed = 0;
try {
  failed = report(await runSuite(browser), `Firefox ${engine.version()}`);
} finally {
  await engine.close();
}
process.exit(failed ? 1 : 0);
