`@push-based/lighthouse-soft-navigation` measures soft navigations as navigation steps of a Lighthouse user flow, on stock Lighthouse. It is a Lighthouse config: you pass it to `startFlow`, and a navigation step that only navigates within the document is measured from the interaction that started it, by the stock metric audits.

## What is a soft navigation?

A soft navigation is a route change that updates the URL and the content without loading a new document. A single page app does one every time you click a link: the router calls `history.pushState`, renders the next view and the browser never requests a new HTML page.

For the user it is a navigation like any other. They click, wait, and see a new page. Chrome 149 and newer recognise it as one too: it reports a [soft navigation](https://github.com/WICG/soft-navigations) with its own first contentful paint and largest contentful paint.

<!-- diagram: hard-vs-soft -->

## Why stock Lighthouse cannot measure one

A Lighthouse navigation step waits for a page load: a document request, then FCP and the load event. A soft navigation has none of them, so the step hangs until `maxWaitForFcp` and fails with `NO_FCP`.

The workaround so far has been a timespan. A timespan records the interaction, but it does not have FCP, LCP, Speed Index or a Performance score, which are exactly the numbers you want for a route change.

| Step                  | Stock Lighthouse   | With this package             |
| --------------------- | ------------------ | ----------------------------- |
| Navigation, page load | Measured           | Measured, unchanged           |
| Navigation, soft      | Fails with NO_FCP  | Measured from the interaction |
| Timespan              | No FCP, LCP, score | Unchanged                     |
| Snapshot              | Measured           | Unchanged                     |

## What you get

- **A navigation step.** `gatherMode` is `navigation`, and the step has a Performance score.
- **The stock metrics.** FCP, LCP, Speed Index, TBT, CLS and TTI come from Lighthouse's own audits and scoring curves, with the interaction as their time origin.
- **No flag.** The package recognises a soft navigation from what the browser does. Page loads, timespans and snapshots run exactly as they do without it.
- **Every category scored.** Audits that need the document response are not applicable on a soft navigation, so no audit errors.
- **A path to Lighthouse.** Each part of the package stands in for a change in Lighthouse itself, and the result has the shape upstream support will produce. See [Upstreaming to Lighthouse](/docs/upstream/overview).

> [!NOTE]
> The package needs Lighthouse 13.6 and Chrome 149 or newer, which is the first Chrome that emits soft navigation trace events.

Continue with [Installation](/docs/getting-started/installation).

<!-- cta -->
