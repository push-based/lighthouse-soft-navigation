The package is a set of overrides of the default Lighthouse config. Lighthouse's navigation runner, trace processor and metric audits stay stock and do the rest.

<!-- diagram: pipeline -->

## Gathering

A navigation step that starts with a callback runs like this on stock Lighthouse: Lighthouse calls the callback, then waits for the frame to navigate, for FCP, for the load event, and for network and CPU quiet. A soft navigation emits none of the page load events, so the wait never ends.

The `SoftNavigation` gatherer listens on the page during the step. When the main frame navigates within the document and no document starts loading, it emits on the Lighthouse session:

1. `Page.frameNavigated`, with the new URL, so the navigation is recognised and the URL becomes the requested and main document URL.
2. `Page.domContentEventFired` and `Page.loadEventFired`, so the load waits complete.
3. The `firstContentfulPaint` lifecycle event, once Chrome reports the soft navigation's performance entry, so `pauseAfterFcpMs` counts from the soft navigation's FCP.

Network and CPU quiet are then awaited as usual. The trace keeps running past FCP, which TTI and TBT need.

## Trace processing

Lighthouse's trace processor looks for the events of a page load: a navigation start as the time origin, FCP, LCP candidates and DOMContentLoaded. The `SoftNavigationTrace` gatherer extends the stock trace gatherer. For a soft navigation it adds those events to the trace, derived from what Chrome records:

| Added event                         | Derived from                                         |
| ----------------------------------- | ---------------------------------------------------- |
| Time origin marker (`clock_sync`)   | `SoftNavigationStart`                                |
| `firstContentfulPaint`              | The soft navigation's first contentful paint         |
| `largestContentfulPaint::Candidate` | `largestContentfulPaint::CandidateForSoftNavigation` |
| `domContentLoadedEventEnd`, load    | The URL change                                       |

The stock trace processor then builds a regular processed navigation, and the stock FCP, LCP, Speed Index, TBT and TTI audits compute their metrics from it.

## Audits

| Piece                                           | What it does                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `soft-navigation` audit                         | Marks the step and carries its run warnings                                       |
| Audits that need the document request           | Wrapped: either not applicable, or run the way Lighthouse runs them in a timespan |
| `LinkElements`, `MainDocumentContent` gatherers | Extend the stock gatherers so they do not fail without a document request         |
| `performance` category                          | Gets a hidden `soft-navigation` audit ref                                         |

## Why there is no flag

Lighthouse drops every setting that is not part of its default settings, and a flow has one config for all of its steps. A `softNavigation: true` option on a step never reaches the gatherers on stock Lighthouse.

So the package recognises a soft navigation instead of being told about one. That also means it cannot change a step's settings, which is why a soft navigation step passes `throttlingMethod` itself.

Each of these pieces stands in for a change in Lighthouse itself. [Upstreaming to Lighthouse](/docs/upstream/overview) maps them one by one.
