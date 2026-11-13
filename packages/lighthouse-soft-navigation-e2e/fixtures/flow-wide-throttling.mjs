/**
 * Runs a stock Lighthouse user flow with the config of the package and DevTools throttling for the
 * whole flow, so no step passes options. Writes the flow result to the path given as the first
 * argument.
 */
import { writeFileSync } from 'node:fs';
import { startFlow } from 'lighthouse';
import puppeteer from 'puppeteer';
import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';
import { startAppServer } from './app-server.mjs';

const [output] = process.argv.slice(2);
if (!output)
  throw new Error('Usage: node flow-wide-throttling.mjs <output.json>');

const server = await startAppServer();
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  const flow = await startFlow(page, {
    config: softNavigationConfig({
      extends: 'lighthouse:default',
      settings: { throttlingMethod: 'devtools' },
    }),
  });

  // 1. Page load.
  await flow.navigate(`${server.origin}/`);

  // 2. Soft navigation, triggered by a click in a callback.
  await flow.navigate(async () => {
    await page.click('#products-link');
  });

  // 3. Soft navigation, triggered by a click between startNavigation and endNavigation.
  await flow.startNavigation();
  await page.click('#home-link');
  await flow.endNavigation();

  writeFileSync(output, JSON.stringify(await flow.createFlowResult()));
} finally {
  await browser.close();
  await server.close();
}
