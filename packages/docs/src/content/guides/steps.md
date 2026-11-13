A soft navigation step is a regular Lighthouse navigation step whose interaction does not load a document. There is no flag and no new API: you write the step the way you write a navigation triggered by a click, and the package recognises what happened.

## With a callback

Pass a function to `flow.navigate`. Lighthouse calls it to start the navigation.

```js
await flow.navigate(
  async () => {
    await page.click('a.product-link');
  },
  { throttlingMethod: 'devtools', name: 'Open a product' },
);
```

## With startNavigation and endNavigation

Use `startNavigation` and `endNavigation` when the interaction takes several calls, or comes from code you do not want to wrap in a function.

```js
await flow.startNavigation({ throttlingMethod: 'devtools', name: 'Checkout' });
await page.click('a.checkout-link');
await flow.endNavigation();
```

## How a soft navigation is recognised

<!-- diagram: detection -->

The package decides per step, from the protocol events of the step:

- The main frame navigates within the document (`Page.navigatedWithinDocument`), and
- no document starts loading.

Then the step is a soft navigation. Everything else is left to stock Lighthouse, so the same flow can mix both kinds freely:

```js
// Page load: a URL.
await flow.navigate('https://example.com');

// Soft navigation: a link the router handles.
await flow.navigate(() => page.click('#products-link'), observed);

// Page load: a link that loads a new document.
await flow.navigate(() => page.click('#external-link'));

// Page load: the route changes, then redirects to another document.
await flow.navigate(() =>
  page.evaluate(() => {
    history.pushState({}, '', '/redirecting');
    location.assign('/');
  }),
);
```

A step that changes the URL and then loads a document is measured as a page load.

## Mixing with timespans and snapshots

Timespans and snapshots run exactly as they do without the package. A typical flow measures the route change as a navigation, then the interactions on the new page as a timespan, then the resulting state as a snapshot:

```js
await flow.navigate(() => page.click('a.cart-link'), observed);

await flow.startTimespan({ name: 'Change the quantity' });
await page.click('button.increment');
await flow.endTimespan();

await flow.snapshot({ name: 'Cart with two items' });
```

## Writing reliable steps

- **One soft navigation per step.** If Chrome reports several, only the first is measured and the step gets a run warning.
- **Render new content.** Chrome reports a soft navigation only when the interaction changes the URL and paints new content. A `pushState` alone is not one.
- **Let the step end on its own.** Lighthouse waits for the soft navigation's FCP, then network and CPU quiet, as it does for a page load. You do not need to wait for selectors inside the callback.
