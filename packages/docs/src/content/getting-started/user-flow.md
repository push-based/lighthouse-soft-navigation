[user-flow](https://push-based.github.io/user-flow/) is a CLI for Lighthouse user flows: it launches Chrome, runs your flow files and writes the reports. The config of the package goes in the flow file. To script Lighthouse yourself instead, see [Set up with Lighthouse](/docs/getting-started/lighthouse).

## Install

```sh
npm install --save-dev @push-based/user-flow @push-based/lighthouse-soft-navigation
```

Requires user-flow 0.21.6 or newer. It brings Lighthouse and Puppeteer with it. The package has to share that copy of Lighthouse, so `npm ls lighthouse` should show a single version.

## Configure the project

`.user-flowrc.json` tells user-flow which URL to measure, where the flow files are and where the reports go. Run `npx user-flow init` to answer that in prompts, or write the file yourself:

```json title=".user-flowrc.json"
{
  "collect": {
    "url": "https://example.com",
    "ufPath": "./user-flows"
  },
  "persist": {
    "outPath": "./measures",
    "format": ["html"]
  }
}
```

## Write the flow

Pass `softNavigationConfig()` as `flowOptions.config` of a flow file, load the page, then trigger the route change in a navigation step. The page load has to come first: a soft navigation starts from a page that is already loaded.

```typescript title="user-flows/checkout.uf.mts"
import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';
import type { UserFlowProvider } from '@push-based/user-flow';

export default {
  flowOptions: { name: 'Checkout', config: softNavigationConfig() },
  interactions: async ({ flow, page, collectOptions }) => {
    // Load the page first. This step is measured by stock Lighthouse.
    await flow.navigate(collectOptions.url);

    // A soft navigation, from the loaded page.
    await flow.navigate(() => page.click('a.product-link'), {
      throttlingMethod: 'devtools',
    });

    // The same with startNavigation/endNavigation.
    await flow.startNavigation({ throttlingMethod: 'devtools' });
    await page.click('a.checkout-link');
    await flow.endNavigation();
  },
} satisfies UserFlowProvider;
```

The config has to go in the flow file. `collect.config` in `.user-flowrc.json` and `--configPath` take JSON, which can't hold the gatherers and audits of the package.

There is no flag. A step is a soft navigation when the main frame navigates within the document and no document starts loading. Every soft navigation step needs `throttlingMethod: 'devtools'` or `'provided'`; see [Throttling](/docs/guides/throttling).

`softNavigationConfig(config?)` takes any Lighthouse config, including `desktopConfig` and configs with `extends: 'lighthouse:default'`.

## Run it

```sh
npx user-flow collect
```

user-flow writes the report to `./measures` and opens it. [Reading the result](/docs/guides/results) explains what a soft navigation step looks like in it.

## Settings for every flow

Lighthouse settings in `collect.config` of `.user-flowrc.json` apply to every flow of the project. With the throttling method set there, the steps don't have to pass it:

```json title=".user-flowrc.json" {5-7}
{
  "collect": {
    "url": "https://example.com",
    "ufPath": "./user-flows",
    "config": {
      "settings": { "throttlingMethod": "devtools" }
    }
  },
  "persist": {
    "outPath": "./measures",
    "format": ["html"]
  }
}
```

Page loads then run with DevTools throttling too; [Throttling](/docs/guides/throttling) explains the trade-off.

For recordings from Chrome DevTools and the rest of the CLI, see [soft navigations in the user-flow docs](https://push-based.github.io/user-flow/docs/integrations/soft-navigations).
