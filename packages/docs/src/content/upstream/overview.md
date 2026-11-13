This package makes soft navigations measurable as navigation steps of a Lighthouse user flow **today**, on
stock Lighthouse. The long-term goal is for the same behaviour to live in Lighthouse itself, at which point
this package shrinks to a thin compatibility layer and is then deprecated.

The package is built as overrides of the Lighthouse config: gatherers, audits and one category. Lighthouse's
navigation runner, trace processor and metric audits stay stock. Each override stands in for one change in
Lighthouse, and these pages map them, so the two stay aligned and each upstream PR has a clear scope.

- Tracking issue: [GoogleChrome/lighthouse#14573](https://github.com/GoogleChrome/lighthouse/issues/14573)
- Prototype of the upstream change: [GoogleChrome/lighthouse#17075](https://github.com/GoogleChrome/lighthouse/pull/17075) (draft, currently has merge conflicts with `main`)
- Prerequisite bug fix: [GoogleChrome/lighthouse#17434](https://github.com/GoogleChrome/lighthouse/pull/17434) (fail fast when a navigation callback only soft navigates)
- Design of the package: [#1](https://github.com/push-based/lighthouse-soft-navigation/issues/1)
- Earlier implementation with its own runner: [app-speed `libs/audit/user-flow/runner/src/lib/soft-navigation`](https://github.com/ChristopherPHolder/app-speed/tree/main/libs/audit/user-flow/runner/src/lib/soft-navigation)

## Target behaviour

A soft navigation is a **navigation step**, not a timespan. Upstream, the API from #17075 is a single setting:

```js
await flow.navigate('https://example.com');

await flow.navigate(
  async () => {
    await page.click('a.product-link');
  },
  { softNavigation: true },
);

await flow.startNavigation({ softNavigation: true });
await page.click('a.checkout-link');
await flow.endNavigation();
```

The resulting step has `gatherMode: 'navigation'` and `configSettings.softNavigation: true`. It has a
Performance score, and FCP/LCP are measured from the `SoftNavigationStart` trace event. The page is never
reset before the step. Chrome 149 or newer is required.

With the package, the same steps are written without the setting and with observed throttling:

```js
const flow = await startFlow(page, { config: softNavigationConfig() });

await flow.navigate(
  async () => {
    await page.click('a.product-link');
  },
  { throttlingMethod: 'devtools' },
);
```

## Why the package cannot use the same flag

`cleanFlagsForSettings` in `core/config/config-helpers.js` drops every flag that is not a key of
`defaultSettings`, and a flow has one config for all of its steps. A `softNavigation` flag passed to
`startNavigation` never reaches `context.settings` on stock Lighthouse.

The package therefore recognises a soft navigation instead of being told about one: the main frame navigates
within the document, and no document starts loading. For the same reason it cannot switch simulated
throttling to DevTools throttling for the step, which is why the step passes `throttlingMethod` itself.

Adding `softNavigation: false` to `defaultSettings` is the first and smallest upstream change. It is useful
on its own: once it ships, the package can read the flag from `context.settings` and only bridge steps that
ask for it.

## Keeping the package swappable

To make adopting the upstream version a mechanical change for user-flow and other consumers, the package
produces the result shape Lighthouse will:

- Steps have `gatherMode: 'navigation'`.
- Audit IDs stay `first-contentful-paint` / `largest-contentful-paint`, computed by the stock audits with
  their scoring curves.
- The multiple-navigation warning uses the upstream `UIStrings` wording.

Two steps are left for when Lighthouse moves:

- Once `softNavigation` is in `defaultSettings`, the package reads it and only bridges the steps that set it.
- Once a Lighthouse version has native support, `softNavigationConfig` returns the config unchanged for it.

The e2e suite doubles as an upstream conformance check. Pointing the workspace `lighthouse` dependency at a
tarball built from a Lighthouse branch (`yarn build-all && npm pack`) shows whether that branch produces the
same results as the package.

Continue with the [override map](/docs/upstream/override-map) and the [landing plan](/docs/upstream/landing-plan).
