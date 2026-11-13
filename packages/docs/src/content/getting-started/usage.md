## Install

```sh
npm install @push-based/lighthouse-soft-navigation lighthouse
```

## Measure a soft navigation

Pass `softNavigationConfig()` to `startFlow`, then trigger the route change in a navigation step:

```js
import { startFlow } from 'lighthouse';
import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';

const flow = await startFlow(page, { config: softNavigationConfig() });

// A page load, measured by stock Lighthouse.
await flow.navigate('https://example.com');

// A soft navigation.
await flow.navigate(() => page.click('a.product-link'), {
  throttlingMethod: 'devtools',
});

// The same with startNavigation/endNavigation.
await flow.startNavigation({ throttlingMethod: 'devtools' });
await page.click('a.checkout-link');
await flow.endNavigation();
```

There is no flag. A step is a soft navigation when the main frame navigates within the document and no document starts loading. Every soft navigation step needs `throttlingMethod: 'devtools'` or `'provided'`; see [Throttling](/docs/guides/throttling).

`softNavigationConfig(config?)` takes any Lighthouse config, including `desktopConfig` and configs with `extends: 'lighthouse:default'`.

## With user-flow

Pass the config in `flowOptions.config` of a flow file. It can't go in `.user-flowrc.json`, which only takes JSON. Requires `@push-based/user-flow` 0.21.6 or newer.

```typescript title="user-flows/checkout.uf.mts"
import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';
import type { UserFlowProvider } from '@push-based/user-flow';

export default {
  flowOptions: { name: 'Checkout', config: softNavigationConfig() },
  interactions: async ({ flow, page, collectOptions }) => {
    await flow.navigate(collectOptions.url);
    await flow.navigate(() => page.click('a.product-link'), {
      throttlingMethod: 'devtools',
    });
  },
} satisfies UserFlowProvider;
```

## The result

A soft navigation step is a navigation step with a Performance score. Its metrics start at the click, and its URL is the route it navigated to. Audits of the document response, like `server-response-time` or `redirects`, are not applicable.

The `soft-navigation` audit tells it apart from a page load: it is `informative` for a soft navigation and `notApplicable` for a page load.

```js
const isSoft = (step) =>
  step.lhr.audits['soft-navigation']?.scoreDisplayMode === 'informative';
```
