## Limits

- **One soft navigation per step.** If Chrome reports several, the first is measured and the step gets a run warning.
- **No simulated throttling.** See [Throttling](/docs/guides/throttling).
- **No LCP breakdown insight.** Other insights cover the whole trace, as in a timespan.
- **A redirect is a page load.** A step that changes the URL and then loads a document is measured as a page load.
- **Accessibility alone needs a snapshot.** A soft navigation step needs at least one audit that uses the trace.

## Troubleshooting

| Symptom                             | Cause and fix                                                                                                                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The step fails with `NO_FCP`        | Chrome didn't report a soft navigation. The interaction has to be a real input such as `page.click`, and it has to paint new content. Check that Chrome is 149 or newer.                 |
| The metric audits error             | The step ran with simulated throttling. Pass `throttlingMethod: 'devtools'`.                                                                                                             |
| The step is measured as a page load | The click loaded a document: a link the router doesn't handle, a reload or a redirect.                                                                                                   |
| Multiple soft navigations warning   | The click changed the route more than once. Only the first is measured.                                                                                                                  |
| `user-flow collect --dryRun` fails  | Dry runs don't support navigations that start with a callback or `startNavigation` yet. Run without `--dryRun`; see [user-flow#355](https://github.com/push-based/user-flow/issues/355). |
