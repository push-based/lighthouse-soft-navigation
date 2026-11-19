// Renders public/examples/soft-navigation-flow.html, the example flow report
// linked from the results guide. It measures the coffee-cart demo app that
// user-flow uses: a page load, two soft navigations, and a page load of the
// same route as the first soft navigation, to compare the two. Run it after
// a change to what the package reports:
//
//   pnpm nx build lighthouse-soft-navigation
//   node packages/docs/scripts/example-report.mjs
//
// It needs the repository's puppeteer and network access.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { startFlow } from 'lighthouse';
import { launch } from 'puppeteer';
import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/examples/soft-navigation-flow.html');
const url = 'https://coffee-cart.netlify.app/';

const browser = await launch({ headless: true });
try {
  const page = await browser.newPage();
  const flow = await startFlow(page, {
    name: 'Order coffee',
    // A soft navigation can't be simulated, so the whole flow is observed.
    config: softNavigationConfig({
      extends: 'lighthouse:default',
      settings: { throttlingMethod: 'devtools' },
    }),
  });

  await flow.navigate(url, { name: 'Open the menu (page load)' });
  await page.click('.cup:nth-child(1)');
  await flow.navigate(() => page.click('a[href="/cart"]'), {
    name: 'Go to the cart (soft navigation)',
  });
  await flow.navigate(() => page.click('a[href="/github"]'), {
    name: 'Go to GitHub (soft navigation)',
  });
  await flow.navigate(`${url}cart`, { name: 'Reload the cart (page load)' });

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, await flow.generateReport());
  console.log(`Wrote ${out}`);
} finally {
  await browser.close();
}
