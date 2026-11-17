# Spike: simulated throttling for soft navigations

A soft navigation step only works with `throttlingMethod: 'devtools'` or `'provided'`. Under `simulate`, Lighthouse's
default, Lantern has no document request to root its graph at, and the metric audits error.
[`docs/simulated-throttling.md`](../../docs/simulated-throttling.md) lists what Lantern and Lighthouse would need to
change. This spike prototypes those changes and measures them against DevTools throttling, before anything is raised
upstream. It is tracked in [#28](https://github.com/push-based/lighthouse-soft-navigation/issues/28).

The package is private. It does not change the published package, which keeps requiring `devtools` or `provided`.

## Results

Lantern's estimate of a soft navigation against the same soft navigation under DevTools throttling, over 8 fixture
scenarios and 4 public sites, 3 runs each. The error is the median of the absolute error over the runs. Everything is in
[`results/fixture.md`](results/fixture.md) and [`results/real-apps.md`](results/real-apps.md).

| Configuration                                   | Fixture FCP | Fixture LCP | Fixture within 20 % | Sites FCP | Sites LCP | Sites within 20 % |
| ----------------------------------------------- | ----------: | ----------: | ------------------: | --------: | --------: | ----------------: |
| Stock Lantern                                   |       error |       error |                 0 % |     error |     error |               0 % |
| Root only (change 1)                            |       100 % |        41 % |                 6 % |      78 % |      78 % |               0 % |
| Root and `fetch` chains (1, 3)                  |       100 % |        29 % |                13 % |      41 % |      41 % |               0 % |
| Root, chains and paint graph (1, 3, 2)          |        13 % |        21 % |                56 % |      28 % |      28 % |               0 % |
| The same, with the HTTP/2 rule (`all-but-warm`) |        13 % |        17 % |                63 % |      26 % |      26 % |              17 % |
| Every change, warm connections included (`all`) |        13 % |        17 % |                60 % |      44 % |      44 % |               0 % |

"Within 20 %" is the share of FCP and LCP values within 20 % of DevTools throttling. Under `simulate`, the soft navigation step now gets a Performance score: the audits compute instead of erroring. The
recordings were made with every change installed, and the values the step's audits reported are the ones
`evaluate.mjs` computes for `all`, to the millisecond, for all 180 of them.

### What held

- **Changes 1, 2 and 3 are needed together.** Without the root, the audits error, and with chains or the paint graph left out, the FCP is off by 62 % to 100 %. With all
  three, the fixture's FCP is off by 13 % and its LCP by 21 %. Per fixture scenario, the FCP is within -26 % (`lazy-chunk`) to +37 % (`sequential-h2`) of DevTools throttling.
- **The signal for `fetch` chains is there.** Every recording has the `v8::Debugger::AsyncTaskScheduled` flows, linking 8
  to 121 pairs of tasks per soft navigation. In the fixture they link each task that sent a `fetch` to the task that continued after
  it, and the chains take the fixture's LCP from 41 % to 29 % off before the paint graph is added.
- **The page load rule for the paint does not apply.** Lantern keeps the requests that would have blocked the parser.
  For a soft navigation the paint graph has to be the paint and what it depends on, plus every task that ran before
  it. The last part came from the real sites: react.dev and vite.dev had their data before the click, and their soft
  navigation is script work that is not on the paint's path but kept the main thread busy. Without it, the sites' FCP is off by 96 %, and the fixture's is the same either way.
- **Pruning has to wait.** See [the changes](#the-changes): Lantern prunes short tasks before the new links could be
  added. Not pruning at all (`all+short`) was tried and is worse: 49 % on the sites, because tasks that finished before
  the paint in the unthrottled recording pull in requests the paint did not wait for.

### What did not

- **Change 4 moves Lantern away from the reference.** DevTools throttling adds 562.5 ms to every request, warm
  connection or not. Lantern charges a request on a warm connection one round trip, 150 ms, and the server's time. A
  soft navigation is mostly requests on warm connections, so the warmer Lantern's model, the further it is from DevTools
  throttling: warm connections take the sites from 28 % to 60 %. A real network is closer to Lantern here, but Lighthouse
  validates Lantern against DevTools throttling ([its golden traces](https://github.com/GoogleChrome/lighthouse/tree/main/core/scripts/lantern/collect)),
  so that is the bar upstream.
- **Charging every request as a new connection (`root+chains+paint+cold`) is no fix either.** It matches the fixture's
  LCP best, 13 %, but overshoots the sites that request their data at the click, where requests that ran in parallel
  each pay a connection: angular.dev by 26 % and svelte.dev by 148 %. The sites' median stays at 28 % only because
  react.dev and vite.dev come out the same with it.
- **The HTTP/2 rule is mixed.** It brings the fixture's HTTP/2 LCP from -31 % to -13 % and angular.dev's, on HTTP/3, from
  -26 % to -15 %, but takes svelte.dev, on HTTP/2, from +25 % to +54 %.
- **On the fixture, Chrome did not reuse the page load's connection** for the first `fetch` over HTTP/1.1, with or without
  Lighthouse. Warm connections then change nothing, which is right: the change only trusts what Chrome reports.

### What does not compare

- **TTI.** For a soft navigation, Lighthouse's observed TTI often equals the FCP and comes before the LCP, while Lantern's
  never comes before its LCP. The fixture's TTI errors are that difference, not the graph.
- **Speed Index.** Lantern's Speed Index is mostly its FCP. Under DevTools throttling it is measured from screenshots
  and depends on how much of the screen changed, which is little for a soft navigation on a docs site.
- **TBT.** 0 ms under both for most targets, so it is not compared.

### Measurement pitfalls

Three things made early numbers wrong, and would make any re-run wrong:

- **Connections outlive a browser context.** Contexts share Chrome's connections, so a run in a new context still found
  the previous run's connections warm. Every measurement runs in a browser of its own.
- **The HTTP cache.** With both measurements of a run in one browser, the DevTools one got the view's data from the cache
  the first one filled. angular.dev's FCP under DevTools throttling was 187 ms that way, and 1466 ms without.
- **Work that waits on the clock.** A long task that loops until `performance.now()` has moved on takes as long under CPU
  throttling as without it, while Lantern multiplies it by 4. The fixture's long task does a fixed amount of work.

### What it means for upstream

- Changes 1, 2 and 3 hold, with two additions to the doc: the pruning in `linkCPUNodes` has to run after the new links,
  and the paint graph has to include the tasks that ran before the paint.
- Change 4 should not be proposed as it stands. Against DevTools throttling it makes the result worse. Whether Lantern or
  DevTools throttling models a warm connection better is a question for the Lighthouse team, and it affects page loads
  too.
- 26 % to 28 % on four sites is not good enough to remove the override in lighthouse#17075 (change 7). The open points:
  - vite.dev is 44 % too fast in every run: its soft navigation is script work, and Lantern's estimate of it is short.
  - svelte.dev is 25 % too slow, and 54 % with the HTTP/2 rule. In an earlier set of recordings its estimate swung
    between runs, from 53 ms to about 1000 ms, against a steady 630 ms under DevTools throttling, likely depending on
    whether prefetched data arrived before the click. In the committed set it varies less, 785 to 810 ms
    without the HTTP/2 rule, but one site across two sets of recordings is not enough to rule the swing out.
  - Four sites and one fixture, on one machine. Lighthouse's golden set has over a hundred sites; soft navigations
    would need a set of their own (change 6).

## How it works

### The changes

The changes replace Lantern functions at runtime, in the Lantern that Lighthouse imports, so that Lighthouse's own
computed artifacts and audits use them. Each one can be switched on its own (`src/lantern/install.mjs`):

| Flag              | Change in the doc | What it does                                                                                                                                                                                                                                                                                                                                          | Upstream file                                                                                          |
| ----------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `root`            | 1                 | Roots the graph at the first task still running at `SoftNavigationStart`, the time of the input. That is usually a task of a few µs, not the click's own task, which starts up to 2 ms later and is usually pruned, so what it started then depends on the root. Requests and tasks from before the root are left out, and there is no main document. | `graph/PageDependencyGraph.ts` (`createGraph`, `linkNetworkNodes`)                                     |
| `fetchChains`     | 3                 | A task that continues after an async task depends on the task that scheduled it, and on the requests that task sent before scheduling it and that had finished. The link comes from `v8::Debugger::AsyncTaskScheduled` flows.                                                                                                                         | `graph/PageDependencyGraph.ts` (`linkCPUNodes`)                                                        |
| `taskRequests`    | 3                 | A request of any type depends on the task that sent it. Lantern only links `fetch`, XHR and scripts, which leaves an inserted image hanging off the root.                                                                                                                                                                                             | `graph/PageDependencyGraph.ts` (`linkCPUNodes`)                                                        |
| `paintGraph`      | 2                 | A task that paints depends on the last task that changed the view. The FCP and LCP graphs are the last paint before the metric, with everything it depends on, every task that ran before it, and finished images for the LCP.                                                                                                                        | `graph/PageDependencyGraph.ts`, `metrics/FirstContentfulPaint.ts`, `metrics/LargestContentfulPaint.ts` |
| `warmConnections` | 4                 | Origins whose first request in the step reused a connection, by Chrome's `connectionReused`, start with warm connections.                                                                                                                                                                                                                             | `simulation/ConnectionPool.ts`, `simulation/Simulator.ts`                                              |
| `h2Ttfb`          | 4                 | A request on a warm HTTP/2 connection pays a time to first byte unless another request to the origin was in flight when it was sent ([lighthouse#15897](https://github.com/GoogleChrome/lighthouse/issues/15897)).                                                                                                                                    | `simulation/TCPConnection.ts`                                                                          |
| `keepShortTasks`  | tried             | Tasks under 10 ms stay in the graph instead of being pruned.                                                                                                                                                                                                                                                                                          | `graph/PageDependencyGraph.ts` (`linkCPUNodes`)                                                        |
| `coldRequests`    | for comparison    | Every request is simulated as the first on a new connection, DNS lookup included. That is close to what DevTools throttling does.                                                                                                                                                                                                                     | —                                                                                                      |

Lighthouse change 5, passing the soft navigation to Lantern, is stood in for: the replaced `createGraph` finds the
first `SoftNavigationStart` among the main thread events itself. The trace category change 3 reads,
`disabled-by-default-v8.inspector`, is added with Lighthouse's `additionalTraceCategories` setting.

One thing came up that the doc did not have: `linkCPUNodes` ends by pruning tasks under 10 ms and rewiring the graph
around them. The tasks of a soft navigation are almost all that short, and the new links are between them, so the
graph needs every link in before the pruning runs. The spike links first and prunes after, with Lantern's rule, and
keeps tasks that paint.

### The fixture

`src/app/server.mjs` is a single page app with one soft navigation per scenario:

| Scenario        | What the click does                                                       |
| --------------- | ------------------------------------------------------------------------- |
| `sequential`    | Two `fetch`es in sequence. The heading is the FCP, the paragraph the LCP. |
| `parallel`      | Two `fetch`es in parallel, rendered together.                             |
| `image`         | A `fetch`, then an image of about 300 KB that is the LCP.                 |
| `long-task`     | A `fetch`, then about 150 ms of script before the render.                 |
| `lazy-chunk`    | A script chunk loaded with `import()`, which then requests its data.      |
| `cold-origin`   | Two `fetch`es in sequence to an API origin the page load did not contact. |
| `xhr`           | Two XHRs in sequence, which Lantern already links.                        |
| `sequential-h2` | `sequential` over HTTP/2.                                                 |

The API answers after 50 ms (`/api/route`) and 150 ms (`/api/details`), the chunk after 100 ms, the image after 50 ms.

### The measurement

`src/record.mjs` records each scenario three times. A run measures the click twice, each time in a fresh browser after
loading the page:

- under `simulate`, which records without throttling. Its artifacts are what Lantern runs on.
- under `devtools`, which is the reference. Lighthouse checks Lantern against DevTools throttling too: its
  [golden traces](https://github.com/GoogleChrome/lighthouse/tree/main/core/scripts/lantern/collect) are each site
  recorded without throttling and then with DevTools throttling.

`src/evaluate.mjs` runs Lighthouse's Lantern metrics on every recording, once per configuration, and `src/report.mjs`
writes the tables in `results/`. The configurations are in `src/lantern/install.mjs`. Throttling is Lighthouse's
default mobile one: 150 ms RTT, 1.6 Mbps and a 4× CPU slowdown for `simulate`, and 562.5 ms of latency per request,
1.4 Mbps and the same CPU slowdown for `devtools`.

The public sites are in `src/real-apps.mjs`: react.dev (Next.js), angular.dev (Angular), vite.dev (VitePress, on Vue)
and svelte.dev (SvelteKit), each with a click on a link in its header. They are measured without screen emulation,
since their navigation collapses on a phone screen, and with the same mobile throttling. vuejs.org and nextjs.org were
tried too, but a click on their links did not navigate in headless Chrome.

## Running it

```sh
pnpm nx build lighthouse-soft-navigation
cd packages/simulated-throttling-spike
node src/record.mjs --runs 3            # the fixture, into tmp/simulated-throttling-spike/fixture
node src/record.mjs --runs 3 --real     # the public sites in src/real-apps.mjs
node src/evaluate.mjs --set fixture     # results/fixture.json
node src/report.mjs --set fixture       # results/fixture.md
pnpm nx test simulated-throttling-spike
```

The HTTP/2 scenario needs `openssl` to make a certificate.
