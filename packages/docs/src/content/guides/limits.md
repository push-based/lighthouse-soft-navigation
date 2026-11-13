## Limits

- **One soft navigation per step.** If Chrome reports several, the first is measured and the step has a run warning.
- **No LCP breakdown.** The LCP breakdown insight is not available, because Lighthouse runs the trace engine with soft navigations turned off. Other insights are evaluated over the whole trace, as in a timespan.
- **No simulated throttling.** See [Throttling](/docs/guides/throttling).
- **Needs a trace audit.** A soft navigation step needs an audit that uses the trace or one of the document audits. For accessibility alone, use a snapshot.
- **A redirect is a page load.** A step that changes the URL and then loads a document is measured as a page load.
- **Report labels.** The flow report labels a soft navigation step "Navigation", since the step mode cannot be set on stock Lighthouse.

## Troubleshooting

### The step fails with NO_FCP

The URL changed, but Chrome did not report a soft navigation, so there is no first contentful paint to wait for. The step fails after `maxWaitForFcp`, like a page load that never paints.

Check that:

- The interaction renders new content, not only a URL change. Chrome needs a paint that follows the interaction.
- The interaction is a real user input, like `page.click`. Chrome attributes a soft navigation to a user interaction.
- Chrome is 149 or newer: `await browser.version()`.

### The step has no metrics and a warning

On a Chrome older than 149, or with soft navigation detection turned off, the step completes, but the `soft-navigation` audit warns that the URL changed without a soft navigation. Update Chrome.

### The metric audits error

The step ran with simulated throttling. The step's run warnings say so. Pass `throttlingMethod: 'devtools'`.

### The step is measured as a page load

The interaction loaded a document. Common causes are a link the router does not handle, a full reload after the route change, or a redirect. The `soft-navigation` audit is `notApplicable` for these steps.

### Multiple soft navigations were detected

The interaction changed the route more than once, for example a navigation followed by a redirect inside the router. Only the first is measured. Split the interaction into separate steps, or trigger the final route directly.
