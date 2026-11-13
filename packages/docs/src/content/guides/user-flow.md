[@push-based/user-flow](https://push-based.github.io/user-flow/) runs Lighthouse user flows from `*.uf.mts` files with `npx user-flow collect`. The config of this package goes in the flow file.

> [!IMPORTANT]
> Requires user-flow 0.21.6 or newer. Older versions add `extends: 'lighthouse:default'` to the config, so the first step fails with `TypeError: Expected object but got string`. They also run Chrome 148, where a soft navigation step loses TBT, TTI and its Performance score.

## Installation

```sh
npm install --save-dev @push-based/user-flow @push-based/lighthouse-soft-navigation
```

The gatherers of this package extend the stock gatherers of the Lighthouse they import, so user-flow and this package have to share one copy of Lighthouse. Both depend on `lighthouse@^13.6.0`, so npm installs it once. `npm ls lighthouse` shows a single version.

## Flow file

```typescript title="user-flows/checkout.uf.mts"
import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';
import type { UserFlowProvider } from '@push-based/user-flow';

const observed = { throttlingMethod: 'devtools' } as const;

export default {
  flowOptions: { name: 'Checkout', config: softNavigationConfig() },
  interactions: async ({ flow, page, collectOptions }) => {
    // A page load, measured by stock Lighthouse.
    await flow.navigate(collectOptions.url);

    // A soft navigation.
    await flow.navigate(async () => {
      await page.click('a.product-link');
    }, observed);

    // The same with startNavigation/endNavigation.
    await flow.startNavigation(observed);
    await page.click('a.checkout-link');
    await flow.endNavigation();
  },
} satisfies UserFlowProvider;
```

```sh
npx user-flow collect --url https://example.com --ufPath ./user-flows
```

- The config goes in `flowOptions.config`. `collect.config` and `collect.configPath` in `.user-flowrc.json` and `--configPath` take JSON, which cannot hold the gatherer and audit classes of the package.
- The steps are the same as in [Soft navigation steps](/docs/guides/steps). A soft navigation step passes `throttlingMethod`; see [Throttling](/docs/guides/throttling).

## Settings

Settings for every flow of the project go in `collect.config` of `.user-flowrc.json`, or in the file passed with `--configPath`, as for any user-flow project:

```json title=".user-flowrc.json"
{
  "collect": {
    "config": {
      "settings": {
        "throttlingMethod": "devtools",
        "onlyCategories": ["performance"]
      }
    }
  }
}
```

Settings for one flow go in its config, through `softNavigationConfig`. They take precedence over the settings of the project:

```typescript
config: softNavigationConfig({
  extends: 'lighthouse:default',
  settings: { onlyCategories: ['performance'] },
}),
```

## Recordings

A Chrome DevTools recording replayed with `createUserFlowRunner` measures a soft navigation with `startNavigation` and `endNavigation` steps. The throttling method goes in `stepOptions`:

```json title="products.replay.json"
{
  "title": "Open a product",
  "steps": [
    {
      "type": "startNavigation",
      "stepOptions": { "throttlingMethod": "devtools" }
    },
    {
      "type": "click",
      "selectors": [["a.product-link"]],
      "offsetX": 5,
      "offsetY": 5
    },
    { "type": "endNavigation" }
  ]
}
```

## Reports

A soft navigation step is a navigation step, so the HTML, JSON and Markdown reports of user-flow show it like a page load: gather mode `navigation`, with a Performance score. The `soft-navigation` audit tells the two apart; see [Reading the results](/docs/guides/results).

## Dry runs

`--dryRun` fails for a flow that navigates with a callback or calls `startNavigation`, which every soft navigation does. The dry run stand-in of user-flow does not support either yet; see [push-based/user-flow#355](https://github.com/push-based/user-flow/issues/355).
