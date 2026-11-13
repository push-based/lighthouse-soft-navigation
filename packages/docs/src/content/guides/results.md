A soft navigation step has the shape of a navigation step. Tools that read flow results, like the flow report, the Lighthouse viewer or `@push-based/user-flow`, show it without changes.

## What a soft navigation step looks like

| Field                                                              | Value                                      |
| ------------------------------------------------------------------ | ------------------------------------------ |
| `lhr.gatherMode`                                                   | `navigation`                               |
| `lhr.requestedUrl`, `lhr.mainDocumentUrl`, `lhr.finalDisplayedUrl` | The URL the page navigated to              |
| `lhr.categories.performance.score`                                 | A score, from the stock metric weights     |
| `lhr.audits['soft-navigation']`                                    | `informative`, with the URL in its details |
| Document response audits                                           | `notApplicable`                            |

## Telling soft navigations and page loads apart

Every navigation step has a `soft-navigation` audit. It is `informative` for a soft navigation and `notApplicable` for a page load.

```js
const isSoftNavigation = (step) =>
  step.lhr.audits['soft-navigation']?.scoreDisplayMode === 'informative';

const result = await flow.createFlowResult();
for (const step of result.steps) {
  console.log(step.name, isSoftNavigation(step) ? 'soft' : step.lhr.gatherMode);
}
```

The audit's details carry what the package saw:

```json title="audits['soft-navigation'].details"
{
  "type": "debugdata",
  "url": "https://example.com/products",
  "navigationType": "push",
  "softNavigations": 1
}
```

`softNavigations` is the number of soft navigations Chrome reported in the step. It is `1` for a clean step.

## Metrics

`first-contentful-paint`, `largest-contentful-paint`, `speed-index`, `total-blocking-time`, `cumulative-layout-shift` and `interactive` are the stock audits, with their stock scoring curves. Their time origin is the interaction that started the soft navigation, not the start of the step.

<!-- diagram: timeline -->

- **FCP** is the first paint after the interaction that Chrome attributes to the soft navigation.
- **LCP** is the largest of the soft navigation's LCP candidates.
- **TBT and TTI** are computed from FCP, as for a page load. DOMContentLoaded and load are placed at the URL change.
- **Speed Index** is computed from the screenshots of the step.

## Audits of the document response

There is no document request in a soft navigation. Audits that assert something about the document response are `notApplicable`:

- `server-response-time`, `redirects`, `http-status-code`, `diagnostics`
- `is-crawlable`, `canonical`, `hreflang`, `charset`
- `csp-xss`, `has-hsts`, `origin-isolation`, `clickjacking-mitigation`, `trusted-types-xss`

They carry no weight, so every category still has a score.

`network-requests` and the unused and unminified CSS and JavaScript audits run the way Lighthouse runs them in a timespan, where they already work without a document request. `network-requests` lists the requests the soft navigation made, such as the API calls of the new route.

## Run warnings

The `soft-navigation` audit adds a run warning to the step when:

| Warning                                   | Cause                                                     |
| ----------------------------------------- | --------------------------------------------------------- |
| Multiple soft navigations were detected   | The interaction triggered more than one; the first counts |
| The URL changed without a soft navigation | No new content was painted, or Chrome is older than 149   |
| Simulated throttling cannot be applied    | The step ran with `throttlingMethod: 'simulate'`          |
