This guide runs a user flow with one page load and one soft navigation, and writes the flow report to disk.

## 1. Write the flow

```js title="flow.mjs"
import { writeFileSync } from 'node:fs';
import { startFlow } from 'lighthouse';
import puppeteer from 'puppeteer';
import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';

const browser = await puppeteer.launch();
const page = await browser.newPage();

// The only change to a regular user flow: the config.
const flow = await startFlow(page, { config: softNavigationConfig() });

// A page load, measured by stock Lighthouse.
await flow.navigate('https://example.com');

// A soft navigation: the click changes the route without loading a document.
await flow.navigate(
  async () => {
    await page.click('a.product-link');
  },
  { throttlingMethod: 'devtools' },
);

writeFileSync('flow.report.html', await flow.generateReport());
await browser.close();
```

Replace the URL and the selector with a page of your app and a link its router handles.

> [!IMPORTANT]
> Pass `throttlingMethod: 'devtools'` (or `'provided'`) to every soft navigation step. Simulated throttling models a page load from its document request, and a soft navigation has none. See [Throttling](/docs/guides/throttling).

## 2. Run it

```sh
node flow.mjs
```

## 3. Open the report

Open `flow.report.html` in a browser. The flow has two navigation steps, both with a Performance score:

- The first step is the page load.
- The second step is the soft navigation. Its URL is the route you navigated to, and its metrics start at the click.

To tell the two apart in the JSON result, look at the `soft-navigation` audit. It is `informative` for a soft navigation and `notApplicable` for a page load. [Reading the results](/docs/guides/results) has the details.

## Next steps

- [Soft navigation steps](/docs/guides/steps) shows every way to write a step.
- [Limits](/docs/guides/limits) lists what a step cannot measure, and what to do when one fails.
- Using [@push-based/user-flow](https://push-based.github.io/user-flow/)? Pass `softNavigationConfig()` as its Lighthouse config.
