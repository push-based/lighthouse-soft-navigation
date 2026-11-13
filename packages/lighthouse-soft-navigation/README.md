# @push-based/lighthouse-soft-navigation

Measure soft navigations as navigation steps of a Lighthouse user flow.

A soft navigation is a route change that updates the URL and the content without loading a new document, like a single page app does on a link click. Stock Lighthouse cannot audit one as a navigation: it waits for a page load that never comes and fails with `NO_FCP`.

This package is a Lighthouse config. With it, a navigation step whose interaction only navigates within the document is measured as a navigation, from that interaction, by the stock metric audits.

## Installation

```sh
npm install @push-based/lighthouse-soft-navigation lighthouse
```

Requires Lighthouse 13.6 and Chrome 149 or newer.

## Usage

```js
import { startFlow } from 'lighthouse';
import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';

const flow = await startFlow(page, { config: softNavigationConfig() });

// A page load, measured by stock Lighthouse.
await flow.navigate('https://example.com');

// A soft navigation.
await flow.navigate(
  async () => {
    await page.click('a.product-link');
  },
  { throttlingMethod: 'devtools' },
);

// The same with startNavigation/endNavigation.
await flow.startNavigation({ throttlingMethod: 'devtools' });
await page.click('a.checkout-link');
await flow.endNavigation();

const result = await flow.createFlowResult();
```

`softNavigationConfig(config?)` takes any Lighthouse config, including `desktopConfig` and configs with `extends: 'lighthouse:default'`. Without an argument it uses the default config.

There is no flag to set. A navigation step becomes a soft navigation when the main frame navigates within the document and no document starts loading. Page loads, timespans and snapshots run exactly as they do without the package.

### What a soft navigation step looks like

- `gatherMode` is `navigation`, and the step has a Performance score.
- `first-contentful-paint`, `largest-contentful-paint`, `speed-index`, `total-blocking-time`, `cumulative-layout-shift` and `interactive` are the stock audits. Their time origin is the interaction that started the soft navigation.
- `requestedUrl`, `mainDocumentUrl` and `finalDisplayedUrl` are the URL the page navigated to.
- The `soft-navigation` audit is `informative` and has the URL in its details. It is `notApplicable` for a page load, which is how to tell the two apart.
- Audits of the document response (`server-response-time`, `redirects`, `http-status-code`, `is-crawlable`, `canonical`, `hreflang`, `charset` and the security header audits) are `notApplicable`, since there is no document request. They carry no weight, so every category still has a score.

### Throttling

Pass `throttlingMethod: 'devtools'` or `'provided'` to a soft navigation step. Simulated throttling, the default, models a page load from its document request, and a soft navigation has none. With simulated throttling the metric audits fail and the step has a run warning that says so.

### Limits

- Trigger one soft navigation per step. If Chrome reports several, the first is measured and the step has a run warning.
- If the URL changes but Chrome does not report a soft navigation (the interaction did not paint new content), the step fails with `NO_FCP` after `maxWaitForFcp`, like a page load that never paints.
- A step that changes the URL and then loads a document is measured as a page load.
- The LCP breakdown insight is not available, because Lighthouse runs the trace engine with soft navigations turned off.
- A soft navigation step needs an audit that uses the trace or one of the document audits above. For accessibility alone, use a snapshot.

## Use with @push-based/user-flow

[`@push-based/user-flow`](https://github.com/push-based/user-flow) runs Lighthouse user flows from `*.uf.mts` files with `npx user-flow collect`. The config of this package goes in the flow file.

Requires user-flow 0.21.6 or newer. Older versions add `extends: 'lighthouse:default'` to the config, so the first step fails with `TypeError: Expected object but got string`. They also run Chrome 148, where a soft navigation step loses TBT, TTI and its Performance score.

### Installation

```sh
npm install --save-dev @push-based/user-flow @push-based/lighthouse-soft-navigation
```

The gatherers of this package extend the stock gatherers of the Lighthouse they import, so user-flow and this package have to share one copy of Lighthouse. Both depend on `lighthouse@^13.6.0`, so npm installs it once. `npm ls lighthouse` shows a single version.

### Flow file

```ts
// user-flows/checkout.uf.mts
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
- The steps are the same as in [Usage](#usage). A soft navigation step passes `throttlingMethod`; see [Throttling](#throttling).

### Settings

Settings for this flow go in the config, through `softNavigationConfig`:

```ts
config: softNavigationConfig({
  extends: 'lighthouse:default',
  settings: { onlyCategories: ['performance'] },
}),
```

Settings in `collect.config` of `.user-flowrc.json` and in `--configPath` are ignored for now. `softNavigationConfig()` returns every default setting, and user-flow gives the settings of the flow config precedence over the global ones; see [#8](https://github.com/push-based/lighthouse-soft-navigation/issues/8).

### Recordings

A Chrome DevTools recording replayed with `createUserFlowRunner` measures a soft navigation with `startNavigation` and `endNavigation` steps. The throttling method goes in `stepOptions`:

```json
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

### Reports

A soft navigation step is a navigation step, so the HTML, JSON and Markdown reports of user-flow show it like a page load: gather mode `navigation`, with a Performance score. The `soft-navigation` audit tells the two apart; see [What a soft navigation step looks like](#what-a-soft-navigation-step-looks-like).

### Dry runs

`--dryRun` fails for a flow that navigates with a callback or calls `startNavigation`, which every soft navigation does. The dry run stand-in of user-flow does not support either yet; see [push-based/user-flow#355](https://github.com/push-based/user-flow/issues/355).

## How it works

The config overrides pieces of the default config. Lighthouse's navigation runner, trace processor and audits do the rest.

| Piece                                           | What it does                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SoftNavigation` gatherer                       | Tells Lighthouse's wait conditions about the navigation. When the main frame navigates within the document it emits the navigation, DOMContentLoaded and load on the Lighthouse session, and the first contentful paint once Chrome reports the soft navigation. Network and CPU quiet are then awaited as usual. |
| `Trace` gatherer                                | Extends the stock gatherer. For a soft navigation it adds the page load events the trace processor reads (time origin, FCP, LCP candidates, DOMContentLoaded), derived from Chrome's `SoftNavigationStart` and `largestContentfulPaint::CandidateForSoftNavigation` events.                                       |
| `LinkElements`, `MainDocumentContent` gatherers | Extend the stock gatherers so they do not fail without a document request.                                                                                                                                                                                                                                        |
| `soft-navigation` audit                         | Marks the step and carries its run warnings.                                                                                                                                                                                                                                                                      |
| Audits that need the document request           | Wrapped: either not applicable, or run the way Lighthouse runs them in a timespan (`network-requests` and the unused/unminified CSS and JavaScript audits).                                                                                                                                                       |
| `performance` category                          | Gets a hidden `soft-navigation` audit ref.                                                                                                                                                                                                                                                                        |

Each piece stands in for a change in Lighthouse itself. See [Upstreaming to Lighthouse](../../docs/upstreaming-to-lighthouse.md).

## Development

```sh
pnpm nx build lighthouse-soft-navigation
pnpm nx test lighthouse-soft-navigation
pnpm nx e2e lighthouse-soft-navigation-e2e
```
