A soft navigation step is a navigation step with a Performance score. Its metrics start at the click, and its URL is the route it navigated to. Audits of the document response, like `server-response-time` or `redirects`, are not applicable.

The reports of Lighthouse and of user-flow show it like a page load. The `soft-navigation` audit tells the two apart: it is `informative` for a soft navigation and `notApplicable` for a page load.

```js
const isSoft = (step) =>
  step.lhr.audits['soft-navigation']?.scoreDisplayMode === 'informative';
```

`step` is a step of the flow result: `(await flow.createFlowResult()).steps` with Lighthouse, or `steps` in the JSON report of user-flow.
