A soft navigation step is a navigation step with a Performance score. Its metrics start at the click, and its URL is the route it navigated to.

## In the HTML report

The reports of Lighthouse and of user-flow show a soft navigation step like a page load. Three things set it apart:

- **The URL** is the route the click navigated to.
- **Audits of the document response**, like `server-response-time` or `redirects`, are not applicable. The step has no document request, so this is expected.
- **Run warnings** at the top of the step flag a run that went wrong: no soft navigation reported, more than one, or simulated throttling. [Limits and troubleshooting](/docs/guides/limits) covers each.

The [example report](/examples/soft-navigation-flow.html) measures the coffee-cart demo app. It loads the menu, opens the cart and the GitHub page with a click, and then loads the cart as a page. The cart appears twice, once as a soft navigation and once as a page load. Its soft navigation paints in about 20 ms, because the app switches routes without fetching anything, so the report shows 0.0 s.

## In code

The `soft-navigation` audit tells the two apart. The HTML report hides it, but in the result it is `informative` for a soft navigation and `notApplicable` for a page load.

```js
const isSoft = (step) =>
  step.lhr.audits['soft-navigation']?.scoreDisplayMode === 'informative';
```

`step` is a step of the flow result: `(await flow.createFlowResult()).steps` with Lighthouse, or `steps` in the JSON report of user-flow.
