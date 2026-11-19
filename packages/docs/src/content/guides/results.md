A soft navigation step is a navigation step with a Performance score. Its metrics start at the click, and its URL is the route it navigated to.

## In the HTML report

The reports of Lighthouse and of user-flow show a soft navigation step like a page load. Three things set it apart:

- **The URL** is the route the click navigated to.
- **Audits of the document response**, like `server-response-time` or `redirects`, are not applicable. The step has no document request, so this is expected.
- **Run warnings** at the top of the step flag a run that went wrong: no soft navigation reported, more than one, or simulated throttling. [Limits and troubleshooting](/docs/guides/limits) covers each.

The [example report](/examples/soft-navigation-flow.html) measures a small single page app. It loads the home page, opens the products and home routes with a click, and then loads products as a page. Each route paints its heading first and fetches its text after, so LCP comes after FCP. Products appears twice, once as a soft navigation and once as a page load.

## In code

The `soft-navigation` audit tells the two apart. The HTML report hides it, but in the result it is `informative` for a soft navigation and `notApplicable` for a page load.

```js
const isSoft = (step) =>
  step.lhr.audits['soft-navigation']?.scoreDisplayMode === 'informative';
```

`step` is a step of the flow result: `(await flow.createFlowResult()).steps` with Lighthouse, or `steps` in the JSON report of user-flow.
