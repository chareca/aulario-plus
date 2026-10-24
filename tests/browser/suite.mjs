// All the browser tests (the pages of index.html and the whole pages of the extension, harness.mjs) in a browser with the
// interface of cdp.mjs: openTab, waitFor, call('Target.closeTarget'). Result: [{ name, ok, error }]. run.mjs (Chromium) and
// firefox/run.mjs (Firefox) print them.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runHarness } from './harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));

export async function runSuite(browser) {
  const tab = await browser.openTab(pathToFileURL(join(here, 'index.html')).href);
  if (!(await browser.waitFor(tab, 'window.__done === true', 30000))) throw new Error('The tests did not end in 30 seconds');
  const results = await tab.evaluate('window.__results');
  // The whole pages of the extension (tests/harness/out).
  execFileSync(process.execPath, [join(here, '..', 'harness', 'make.js')], { stdio: 'ignore' });
  results.push(...(await runHarness(browser, join(here, '..', 'harness', 'out'))));
  return results;
}

// Print the results; the number of the tests that failed.
export function report(results, name) {
  const failed = results.filter((r) => !r.ok).length;
  for (const r of results) console.log(`${r.ok ? 'ok    ' : 'FAILED'} ${r.name}${r.ok ? '' : `\n       ${r.error}`}`);
  console.log(`${results.length - failed} passed, ${failed} failed${name ? ` (${name})` : ''}`);
  return failed;
}
