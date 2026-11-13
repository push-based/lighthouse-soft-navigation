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

## Comparing with page loads

DevTools throttling slows down the run itself, so numbers from `devtools` and `simulate` are not directly comparable. To compare a soft navigation with the page load of the same route, measure both with the same method:

```js
await flow.navigate('https://example.com/products', observed);
await flow.navigate(() => page.click('a.home-link'), observed);
await flow.navigate(() => page.click('a.products-link'), observed);
```

> [!TIP]
> Set `throttlingMethod: 'devtools'` in the config's settings to use it for every step of the flow, page loads included: `softNavigationConfig({ extends: 'lighthouse:default', settings: { throttlingMethod: 'devtools' } })`.
