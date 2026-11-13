Pass `throttlingMethod: 'devtools'` or `'provided'` to every soft navigation step.

```js
const observed = { throttlingMethod: 'devtools' };

await flow.navigate(() => page.click('a.product-link'), observed);

await flow.startNavigation(observed);
await page.click('a.checkout-link');
await flow.endNavigation();
```

## Why simulated throttling does not work

Lighthouse's default, `simulate`, loads the page unthrottled and then models how it would load on a slow device. The model is a graph of the network requests and CPU tasks that start at the document request.

A soft navigation has no document request. There is nothing to build the graph from, so the simulated metric audits fail, and the step gets a run warning that says so.

| Method     | What it does                                                    | Soft navigation |
| ---------- | --------------------------------------------------------------- | --------------- |
| `simulate` | Measures unthrottled, then models a slow load from the document | Not supported   |
| `devtools` | Throttles network and CPU in Chrome while the step runs         | Supported       |
| `provided` | No throttling; you control the conditions                       | Supported       |

## Why the package cannot switch it for you

A Lighthouse user flow has one config for all of its steps, and Lighthouse drops every setting it does not know. The package learns that a step is a soft navigation only while it runs, after its settings are fixed. So the step has to ask for observed throttling itself.

Upstream support in Lighthouse switches `simulate` to `devtools` for soft navigation steps automatically. See [Upstreaming to Lighthouse](/docs/upstream/overview).

## For the whole flow

Instead of passing `throttlingMethod` to each soft navigation step, set it once in the config:

```js
const flow = await startFlow(page, {
  config: softNavigationConfig({
    extends: 'lighthouse:default',
    settings: { throttlingMethod: 'devtools' },
  }),
});

await flow.navigate('https://example.com');
await flow.navigate(async () => {
  await page.click('a.product-link');
});
```

The setting for the whole flow applies to page loads too. With `devtools` throttling, a page load is actually slowed down, so the flow takes longer and its numbers vary more between runs. They also no longer compare with PageSpeed Insights or a default Lighthouse run, which both use `simulate`.

| Set it             | When                                                                    |
| ------------------ | ----------------------------------------------------------------------- |
| On each soft step  | Page load numbers have to compare with PageSpeed Insights or Lighthouse |
| For the whole flow | Every step should be measured the same way                              |

## Longer steps

With any throttling method but `simulate`, Lighthouse waits longer before it ends a step: at least 5.25 s instead of 1 s after FCP and after load, and for the network and the CPU to go quiet. Expect each soft navigation step to take several seconds.
