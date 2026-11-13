[@push-based/user-flow](https://push-based.github.io/user-flow/) runs Lighthouse user flows from `*.uf.mts` files. To measure soft navigations in one of them, pass `softNavigationConfig()` as the flow's Lighthouse config.

```sh
npm install @push-based/lighthouse-soft-navigation
```

```typescript title="user-flows/products.uf.mts"
import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';

const observed = { throttlingMethod: 'devtools' } as const;

export default {
  flowOptions: { name: 'Browse products', config: softNavigationConfig() },
  interactions: async ({ flow, page, collectOptions: { url } }) => {
    await flow.navigate(url);

    await flow.navigate(() => page.click('a.products-link'), {
      ...observed,
      name: 'Open the product list',
    });

    await flow.startNavigation({ ...observed, name: 'Open a product' });
    await page.click('a.product-card');
    await flow.endNavigation();
  },
};
```

Then collect as usual:

```sh
npx user-flow collect
```

## How user-flow combines the config

`softNavigationConfig()` returns a complete config: it brings its own artifacts and has no `extends`. user-flow runs a complete flow config as written and takes only `settings` from the global config in `.user-flowrc.json`. See [Complete configs](https://push-based.github.io/user-flow/docs/cli/lighthouse-configuration#complete-configs) in the user-flow docs.

To change settings for the flow, pass them through `softNavigationConfig`:

```typescript
config: softNavigationConfig({
  extends: 'lighthouse:default',
  settings: { onlyCategories: ['performance'] },
}),
```

## Reports

user-flow's HTML, JSON and Markdown reports show a soft navigation step as a navigation with a Performance score, next to the page loads, timespans and snapshots of the flow.
