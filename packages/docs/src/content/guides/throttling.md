A soft navigation step needs `throttlingMethod: 'devtools'` or `'provided'`.

Lighthouse's default, `simulate`, estimates a throttled load from the requests that follow the document request. A soft navigation requests no document, so there is nothing to estimate from: the metric audits fail and the step gets a run warning.

The package can't switch the method for you. A flow has one config for all steps, and the package only knows a step is a soft navigation once it runs.

## Per step or per flow

Set it on each soft navigation step, as in [Usage](/docs/getting-started/usage), or once for the whole flow:

```js
const flow = await startFlow(page, {
  config: softNavigationConfig({
    extends: 'lighthouse:default',
    settings: { throttlingMethod: 'devtools' },
  }),
});
```

The flow-wide setting applies to page loads too. Those then take longer, vary more between runs and no longer compare with PageSpeed Insights or a default Lighthouse run. Set it per step when page load numbers have to compare with those.
