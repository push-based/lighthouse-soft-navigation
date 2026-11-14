# Simulated throttling for soft navigations

A soft navigation step has to run with `throttlingMethod: 'devtools'` or `'provided'`. With `simulate`,
Lighthouse's default, its metric audits error and the step has no Performance score.

This document records why, what has to change in Lighthouse and in Lantern before `simulate` can work for a
soft navigation, and the measurement behind that list. How to land the changes, and whether the package
should bridge them until then, is tracked in
[#23](https://github.com/push-based/lighthouse-soft-navigation/issues/23).

Everything here was checked against Lighthouse 13.6.0, `@paulirish/trace_engine` 0.0.67 and Chrome 157.

## What happens today

With `simulate`, Lighthouse records the step without throttling. Lantern, its simulator, then builds a graph
of the requests and main-thread tasks of the recording and replays that graph on a slow network and CPU.

`PageDependencyGraph.createGraph` builds the graph. It takes the request for `requestedUrl` as the root, and
it requires a `Document` request for `mainDocumentUrl`. It throws when either is missing. A soft navigation
requests no document, so the first lookup fails:

- Seven audits error with `rootRequest not found`: `first-contentful-paint`, `largest-contentful-paint`,
  `speed-index`, `total-blocking-time`, `interactive`, `max-potential-fid` and `long-tasks`.
- The Performance score of the step is `null`.
- The `soft-navigation` audit of the package adds a run warning that names the fix.

The other audits of the step are unaffected.

## A root is not enough

The graph needs a root, but a root alone gives wrong numbers. I measured that on the fixture app of the e2e
suite. A click on a link there changes the URL and fetches `/api/route`, which answers after 50 ms. The app
paints a heading, which is the FCP. It then fetches `/api/details`, which answers after 150 ms, and paints a
paragraph, which is the LCP.

To give Lantern a root, I added a cached document request for the new URL to the DevTools log of the step,
at the `SoftNavigationStart` trace event. Lantern then ran without an error. The table compares its result
with the same soft navigation recorded without throttling and with DevTools throttling. Times are from
`SoftNavigationStart`, over two runs:

|                                    | FCP        | LCP          |
| ---------------------------------- | ---------- | ------------ |
| Recorded without throttling        | 54–55 ms   | 206–207 ms   |
| DevTools throttling, the reference | 574–578 ms | 1146–1151 ms |
| Lantern, with the synthetic root   | 9–10 ms    | 659–660 ms   |

The simulated FCP is below the FCP that was recorded without any throttling. The simulated LCP is a little
over half of the reference. Three rules in Lantern explain both.

### The FCP graph leaves out the request the paint waited for

For FCP, Lantern simulates only the part of the graph that could have blocked the paint. A request that
ended before the paint is in that part when Chrome reports it as render-blocking or, without that, when it
has `VeryHigh` priority or is a `High` priority script or document. The rule is
`NetworkNode.hasRenderBlockingPriority`, used by `FirstContentfulPaint.getFirstPaintBasedGraph`.

That describes what blocks the parser of a loading document. In a soft navigation the paint usually waits
for a `fetch` or an XHR, and neither qualifies. In the measurement the FCP graph was the synthetic root and
two tasks of under 1 ms. `/api/route`, which the heading waited for, was not in it.

LCP uses the same graph when the LCP is text painted with the FCP, so a view that renders in one paint gets
the same result for both.

### A request that waits for another is simulated next to it

The app requests `/api/details` after `/api/route` has answered. In the simulation both started at 8 ms and
both ended at about 659 ms.

Lantern links a request to the request that initiated it and to the task that sent it. It has no link from
the response of a `fetch` to the task that continues after it, so that task and everything it requests hang
off the root. This is known for page loads as
[lighthouse#15897](https://github.com/GoogleChrome/lighthouse/issues/15897). In a soft navigation it is the
common case, because the data of a view is usually requested from script.

### Every origin is charged a new connection

Each of the two requests took about 651 ms in the simulation. That matches a connection opened from scratch in
`TCPConnection`: 300 ms for DNS, 225 ms for the TCP handshake, about 50 ms of server time and 75 ms for the
response to arrive. Chrome reported `connectionReused: true` for both, because the page load before the step
had opened the connection.

`ConnectionPool` does not use that field. It estimates reuse itself and counts the first request to each
origin as a new connection. Reading the code, trusting the field would not work either: the pool throws
`Could not find a connection for origin` when no request of an origin opened one.

The second and third rule pull in opposite directions here. The simulated LCP is what is left of two errors,
one that removes a wait and one that adds one.

## What has to change

### In Lantern

Lantern's source is in the Chrome DevTools frontend, under
[`front_end/models/trace/lantern`](https://github.com/ChromeDevTools/devtools-frontend/tree/main/front_end/models/trace/lantern),
and reaches Lighthouse through the `@paulirish/trace_engine` package. Changes are reviewed on
[Chromium's Gerrit](https://chromium.googlesource.com/devtools/devtools-frontend); the GitHub repository is
a read-only mirror. Lantern issues are filed on `GoogleChrome/lighthouse`.

| #   | Change                                                                                                                                                                                                                                                          | Files                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | **Root the graph at the soft navigation.** `createGraph` accepts the start of a soft navigation in place of a document request. The root is a node at that time, the main document node is optional, and requests and tasks from before the start are left out. | `graph/PageDependencyGraph.ts`, `LanternComputationData.ts` (the trace-based path, which calls it) |
| 2   | **Decide what the paint of a soft navigation waited for.** The candidates are the requests that started after the soft navigation and ended before the paint, whatever their type and priority, with the tasks that handled them.                               | `metrics/FirstContentfulPaint.ts`, `metrics/LargestContentfulPaint.ts`, `graph/NetworkNode.ts`     |
| 3   | **Keep request chains.** A task that runs because a `fetch` or XHR answered depends on that request, so the requests it sends are simulated after it. This is lighthouse#15897.                                                                                 | `graph/PageDependencyGraph.ts` (`linkCPUNodes`)                                                    |
| 4   | **Start with the connections the page has.** A request on a connection that was open before the step pays no DNS lookup and no handshake, and an origin does not need a request that opens one.                                                                 | `simulation/ConnectionPool.ts`, `core/NetworkAnalyzer.ts` (`estimateIfConnectionWasReused`)        |

### In Lighthouse

| #   | Change                                                                                                                                                                                                                                                                                                              | Files                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 5   | **Pass the soft navigation to Lantern.** The computed graph and the Lantern metrics hand the `SoftNavigationStart` of the step to `createGraph`. They get it from the `ProcessedNavigation` that [lighthouse#17075](https://github.com/GoogleChrome/lighthouse/pull/17075) builds for a soft navigation.            | `core/computed/page-dependency-graph.js`, `core/computed/metrics/lantern-metric.js` |
| 6   | **Validate against recorded soft navigations.** Lighthouse checks Lantern against a set of golden traces, each site recorded without throttling and with DevTools throttling. The set has page loads only. Soft navigations need a flow per site, a URL and the interaction that navigates, and their own baseline. | `core/scripts/lantern/collect`, `core/test/fixtures/lantern-baseline-accuracy.json` |
| 7   | **Remove the override.** lighthouse#17075 switches a soft navigation from `simulate` to `devtools`. That goes once 1 to 6 are in.                                                                                                                                                                                   | `core/config/config.js` (`overrideSettingsForGatherMode`)                           |

### Order

Change 1 comes first, because nothing else can be tried without a graph. It should not ship alone: it turns
the error into the wrong numbers of the measurement. Changes 2 to 4 make the result right, and each can be
judged against the DevTools reference on a fixture. Change 6 is what shows the result holds outside a
fixture. The golden traces were last collected in
[lighthouse#17411](https://github.com/GoogleChrome/lighthouse/pull/17411), which is the place to see how.
Changes 5 and 7 are small and come last.

## Until then

The package requires `devtools` or `provided` and warns under `simulate`. That stays the default until the
changes above exist.

The synthetic root of the measurement would be a small override, an extension of the `DevtoolsLog` gatherer
like the one the package has for the trace. It is not something to ship alone, because it replaces an error
with a wrong number. Going further means carrying Lantern's graph rules in the package, without data to validate
them. The options and their trade-offs are in
[#23](https://github.com/push-based/lighthouse-soft-navigation/issues/23).

## Limits of the measurement

- One app, with two requests and almost no script. It shows that the three rules apply, not how large their
  effect is on a real app.
- Two runs on one machine. The reference is DevTools throttling, which is also what Lighthouse records its
  golden traces with, but those cover 122 sites.
- The synthetic root is a cached request, which Lantern charges 8 ms. A root that is not a request would not
  add that.

The scripts are in [#23](https://github.com/push-based/lighthouse-soft-navigation/issues/23).
