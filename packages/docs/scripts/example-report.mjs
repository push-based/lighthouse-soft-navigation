// Renders public/examples/soft-navigation-flow.html, the example flow report
// linked from the results guide. It measures the single page app of the e2e
// fixtures: a page load, two soft navigations, and a page load of the same
// route as the first soft navigation, to compare the two. Run it after a
// change to what the package reports:
//
//   pnpm nx build lighthouse-soft-navigation
//   node packages/docs/scripts/example-report.mjs
//
// It needs the repository's puppeteer.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { startFlow } from 'lighthouse';
import { launch } from 'puppeteer';
import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';
import { startAppServer } from '../../lighthouse-soft-navigation-e2e/fixtures/app-server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/examples/soft-navigation-flow.html');

const server = await startAppServer();
const browser = await launch({ headless: true });
try {
  const page = await browser.newPage();
  const flow = await startFlow(page, {
    name: 'Browse the shop',
    // A soft navigation can't be simulated, so the whole flow is observed.
    config: softNavigationConfig({
      extends: 'lighthouse:default',
      settings: { throttlingMethod: 'devtools' },
    }),
  });

  await flow.navigate(`${server.origin}/`, {
    name: 'Open the home page (page load)',
  });
  await flow.navigate(() => page.click('#products-link'), {
    name: 'Go to products (soft navigation)',
  });
  await flow.navigate(() => page.click('#home-link'), {
    name: 'Go back home (soft navigation)',
  });
  await flow.navigate(`${server.origin}/products`, {
    name: 'Reload products (page load)',
  });

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, await flow.generateReport());
  console.log(`Wrote ${out}`);
} finally {
  await browser.close();
  await server.close();
}
