With Lighthouse alone, you write the script that runs the flow: it launches Chrome with Puppeteer, measures the steps and saves the report. To run flow files from a CLI instead, see [Set up with user-flow](/docs/getting-started/user-flow).

## Install

```sh
npm install --save-dev @push-based/lighthouse-soft-navigation lighthouse puppeteer
```

## Write the flow

Pass `softNavigationConfig()` to `startFlow` with DevTools throttling, load the page, then trigger the route change in a navigation step. The page load has to come first: a soft navigation starts from a page that is already loaded.

```js title="flow.mjs"
import { writeFileSync } from 'node:fs';
import { startFlow } from 'lighthouse';
import puppeteer from 'puppeteer';
import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';

const browser = await puppeteer.launch();
const page = await browser.newPage();
const flow = await startFlow(page, {
  config: softNavigationConfig({
    extends: 'lighthouse:default',
    settings: { throttlingMethod: 'devtools' },
  }),
});

// Load the page first.
await flow.navigate('https://example.com');

// A soft navigation, from the loaded page.
await flow.navigate(() => page.click('a.product-link'));

// The same with startNavigation/endNavigation.
await flow.startNavigation();
await page.click('a.checkout-link');
await flow.endNavigation();

writeFileSync('flow.report.html', await flow.generateReport());
await browser.close();
```

There is no flag. A step is a soft navigation when the main frame navigates within the document and no document starts loading. A soft navigation needs `throttlingMethod: 'devtools'` or `'provided'`, so the flow sets it once for every step. To keep page loads on Lighthouse's default, set it per step instead; see [Throttling](/docs/guides/throttling).

`softNavigationConfig(config?)` takes any Lighthouse config, including `desktopConfig` and configs with `extends: 'lighthouse:default'`.

## Run it

```sh
node flow.mjs
```

Open `flow.report.html`. [Telling soft navigations apart](/docs/guides/results) shows how to spot a soft navigation step in it.
