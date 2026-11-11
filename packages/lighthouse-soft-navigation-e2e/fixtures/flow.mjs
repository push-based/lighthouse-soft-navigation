/**
 * Runs a stock Lighthouse user flow with the config of the package, and writes the flow result
 * to the path given as the first argument.
 */
import { writeFileSync } from 'node:fs';
import { startFlow } from 'lighthouse';
import puppeteer from 'puppeteer';
import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';
import { startAppServer } from './app-server.mjs';

const [output] = process.argv.slice(2);
if (!output) throw new Error('Usage: node flow.mjs <output.json>');

// A soft navigation has no document request to simulate from, so it is observed.
const observed = { throttlingMethod: 'devtools' };

const server = await startAppServer();
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  const flow = await startFlow(page, { config: softNavigationConfig() });

  // 1. Page load.
  await flow.navigate(`${server.origin}/`);

  // 2. Soft navigation, triggered by a click in a callback.
  await flow.navigate(async () => {
    await page.click('#products-link');
  }, observed);

  // 3. Soft navigation, triggered by a click between startNavigation and endNavigation.
  await flow.startNavigation(observed);
  await page.click('#home-link');
  await flow.endNavigation();

  // 4. Page load, triggered by a click in a callback.
  await flow.navigate(async () => {
    await page.click('#page-load-link');
  });

  // 5. Page load that follows a URL change, as a route that redirects to another document does.
  await flow.navigate(async () => {
    await page.evaluate(() => {
      history.pushState({}, '', '/redirecting');
      location.assign('/');
    });
  });

  writeFileSync(output, JSON.stringify(await flow.createFlowResult()));
} finally {
  await browser.close();
  await server.close();
}
