With Lighthouse alone, you write the script that runs the flow: it launches Chrome with Puppeteer, measures the steps and saves the report. To run flow files from a CLI instead, see [Set up with user-flow](/docs/getting-started/user-flow).

## Install

```sh
npm install --save-dev @push-based/lighthouse-soft-navigation lighthouse puppeteer
```

## Write the flow

Pass `softNavigationConfig()` to `startFlow`, load the page, then trigger the route change in a navigation step. The page load has to come first: a soft navigation starts from a page that is already loaded.

```js title="flow.mjs"
import { writeFileSync } from 'node:fs';
import { startFlow } from 'lighthouse';
import puppeteer from 'puppeteer';
import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';

const browser = await puppeteer.launch();
const page = await browser.newPage();
const flow = await startFlow(page, { config: softNavigationConfig() });

// Load the page first. This step is measured by stock Lighthouse.
await flow.navigate('https://example.com');

// A soft navigation, from the loaded page.
await flow.navigate(() => page.click('a.product-link'), {
  throttlingMethod: 'devtools',
});

// The same with startNavigation/endNavigation.
await flow.startNavigation({ throttlingMethod: 'devtools' });
await page.click('a.checkout-link');
await flow.endNavigation();

writeFileSync('flow.report.html', await flow.generateReport());
await browser.close();
```

There is no flag. A step is a soft navigation when the main frame navigates within the document and no document starts loading. Every soft navigation step needs `throttlingMethod: 'devtools'` or `'provided'`; see [Throttling](/docs/guides/throttling).

`softNavigationConfig(config?)` takes any Lighthouse config, including `desktopConfig` and configs with `extends: 'lighthouse:default'`.

## Run it

```sh
node flow.mjs
```

Open `flow.report.html`. [Reading the result](/docs/guides/results) explains what a soft navigation step looks like in it.
