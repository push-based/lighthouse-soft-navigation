# Upstreaming to Lighthouse

This package makes soft navigations measurable as navigation steps of a Lighthouse user flow **today**, on
stock Lighthouse. The long-term goal is for the same behaviour to live in Lighthouse itself, at which point
this package shrinks to a thin compatibility layer and is then deprecated.

The package is built as overrides of the Lighthouse config: gatherers, audits and one category. Lighthouse's
navigation runner, trace processor and metric audits stay stock. Each override stands in for one change in
Lighthouse, and this document maps them, so the two stay aligned and each upstream PR has a clear scope.

- Tracking issue: [GoogleChrome/lighthouse#14573](https://github.com/GoogleChrome/lighthouse/issues/14573)
- Upstream implementation: [GoogleChrome/lighthouse#17075](https://github.com/GoogleChrome/lighthouse/pull/17075) (draft). It behaves the same as this package; the table below shows how each part maps
- Simulated throttling for soft navigations: [#23](https://github.com/push-based/lighthouse-soft-navigation/issues/23)
- Prerequisite bug fix: [GoogleChrome/lighthouse#17434](https://github.com/GoogleChrome/lighthouse/pull/17434) (fail fast when a navigation callback only soft navigates)
- Design of the package: [#1](https://github.com/push-based/lighthouse-soft-navigation/issues/1)
- Earlier implementation with its own runner: [app-speed `libs/audit/user-flow/runner/src/lib/soft-navigation`](https://github.com/ChristopherPHolder/app-speed/tree/main/libs/audit/user-flow/runner/src/lib/soft-navigation)

## Target behaviour

A soft navigation is a **navigation step**, not a timespan. Upstream, the API from #17075 is a single setting:

```js
await flow.navigate('https://example.com');

await flow.navigate(
  async () => {
    await page.click('a.product-link');
  },
  { softNavigation: true },
);

await flow.startNavigation({ softNavigation: true });
await page.click('a.checkout-link');
await flow.endNavigation();
```

The resulting step has `gatherMode: 'navigation'` and `configSettings.softNavigation: true`. It has a
Performance score, and FCP/LCP are measured from the `SoftNavigationStart` trace event. The page is never
reset before the step. Chrome 149 or newer is required.

With the package, the same steps are written without the setting and with observed throttling:

```js
const flow = await startFlow(page, {
  config: softNavigationConfig({
    extends: 'lighthouse:default',
    settings: { throttlingMethod: 'devtools' },
  }),
});

await flow.navigate(async () => {
  await page.click('a.product-link');
});
```

### Why the package cannot use the same flag

`cleanFlagsForSettings` in `core/config/config-helpers.js` drops every flag that is not a key of
`defaultSettings`, and a flow has one config for all of its steps. A `softNavigation` flag passed to
`startNavigation` never reaches `context.settings` on stock Lighthouse.

The package therefore recognises a soft navigation instead of being told about one: the main frame navigates
within the document, and no document starts loading. For the same reason it cannot switch simulated
throttling to DevTools throttling for the step, which is why the flow sets `throttlingMethod` itself.
What simulated throttling would need to work for a soft navigation is in
[Simulated throttling for soft navigations](simulated-throttling.md).

Adding `softNavigation: false` to `defaultSettings` is the first and smallest upstream change. It is useful
on its own: once it ships, the package can read the flag from `context.settings` and only bridge steps that
ask for it.

## Override → Lighthouse change

| Concern                         | Package override on stock Lighthouse                                                                                                                                                                                                               | Lighthouse change                                                                                                                                                                                                                                                | Files (from #17075 unless noted)                                                                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Setting**                     | None. A soft navigation is recognised from the protocol events of the step                                                                                                                                                                         | `softNavigation` setting, documented as experimental                                                                                                                                                                                                             | `core/config/constants.js`, `types/lhr/settings.d.ts`                                                                                                                             |
| **Gathering**                   | `SoftNavigation` gatherer: on a main frame `Page.navigatedWithinDocument` it emits `Page.frameNavigated`, `Page.domContentEventFired` and `Page.loadEventFired` on the Lighthouse session, so `gotoURL` and its wait conditions complete unchanged | Navigation runner waits on `['softNavigation']` instead of `load`/`fcp`; `waitForSoftNavigation` waits for `Page.navigatedWithinDocument` plus `pauseAfterLoadMs`, then network and CPU quiet; `gotoURL` uses the in-document URL as requested/main document URL | `core/gather/navigation-runner.js`, `core/gather/driver/navigation.js`, `core/gather/driver/wait-for-condition.js`                                                                |
| **Waiting for the paint**       | The gatherer emits the `firstContentfulPaint` lifecycle event once Chrome reports the `soft-navigation` performance entry, so `pauseAfterFcpMs` counts from the soft navigation's FCP                                                              | `waitForSoftNavigationFcp` observes the `soft-navigation` performance entry in an isolated world, set up before the requestor runs, then waits `pauseAfterFcpMs`                                                                                                 | `core/gather/driver/wait-for-condition.js`, `core/gather/driver/navigation.js`                                                                                                    |
| **Requestor guard**             | Not needed: a URL requestor always loads a document                                                                                                                                                                                                | Throw when `softNavigation` is combined with a URL requestor                                                                                                                                                                                                     | `core/gather/navigation-runner.js`                                                                                                                                                |
| **Settings overrides**          | None possible. A flow already skips `about:blank` and the storage reset for a callback; the flow sets `throttlingMethod: 'devtools'`                                                                                                               | For soft navigations: `skipAboutBlank`, `disableStorageReset`, and `simulate` → `devtools` throttling (no document request to build a graph from)                                                                                                                | `core/config/config.js` (`overrideSettingsForGatherMode`)                                                                                                                         |
| **Config filtering**            | None. Every navigation audit runs; the ones that cannot apply report `notApplicable`                                                                                                                                                               | None. Every navigation audit runs; the ones that cannot apply report `notApplicable`                                                                                                                                                                             | n/a                                                                                                                                                                               |
| **Time origin**                 | `Trace` gatherer (extends the stock one): adds the time origin marker at `SoftNavigationStart` to the trace of a soft navigation                                                                                                                   | New `softNavigationStart` time-origin method; a `clock_sync` marker recorded at trace start excludes soft navigations that happened before the step                                                                                                              | `core/lib/tracehouse/trace-processor.js`, `core/gather/gatherers/trace.js`                                                                                                        |
| **FCP / LCP**                   | Same gatherer: adds `firstContentfulPaint` and `largestContentfulPaint::Candidate` events derived from `SoftNavigationStart` and `largestContentfulPaint::CandidateForSoftNavigation`. The **stock** audits compute them                           | `processSoftNavigation` builds a regular `ProcessedNavigation`, so the **stock** FCP/LCP audits work unchanged                                                                                                                                                   | `core/lib/tracehouse/trace-processor.js`                                                                                                                                          |
| **TBT / TTI / Speed Index**     | Same gatherer: adds DOMContentLoaded and load at the URL change. The stock audits then compute all three, TBT from FCP to TTI as for a page load                                                                                                   | `processSoftNavigation` places DOMContentLoaded and load at the URL change (`urlChangeTime`). The stock audits then compute all three                                                                                                                            | `core/lib/tracehouse/trace-processor.js`                                                                                                                                          |
| **Document-dependent audits**   | Wrapped in one module (`audits/document-request.ts`): not applicable, or run the way Lighthouse runs them in a timespan. `LinkElements` and `MainDocumentContent` extend the stock gatherers so they do not fail                                   | The same document response audits return `notApplicable`; `byte-efficiency-audit` and `network-requests` treat soft navigations like timespans; `LinkElements` reads the DOM only and `MainDocumentContent` is empty; page load errors are not checked           | the audits listed in `audits/document-request.ts`, `core/gather/gatherers/link-elements.js`, `core/gather/gatherers/main-document-content.js`, `core/gather/navigation-runner.js` |
| **No soft navigation detected** | The step fails with the stock `NO_FCP` after `maxWaitForFcp`. When the browser cannot report soft navigations at all, the step completes and the `soft-navigation` audit warns                                                                     | `NO_SOFT_NAVIGATION` runtime error                                                                                                                                                                                                                               | `core/lib/lh-error.js`, `core/lib/lh-trace-processor.js`, `proto/lighthouse-result.proto`, locales                                                                                |
| **Multiple soft navigations**   | Run warning from the `soft-navigation` audit, with the upstream wording                                                                                                                                                                            | Localized run warning from the navigation runner, counting main frame soft navigations                                                                                                                                                                           | `core/gather/navigation-runner.js`, locales                                                                                                                                       |
| **Step mode in the result**     | Native: the step is run by the navigation runner. `configSettings.softNavigation` cannot be set; the `soft-navigation` audit marks the step                                                                                                        | Native, with `configSettings.softNavigation: true`                                                                                                                                                                                                               | n/a                                                                                                                                                                               |
| **Insights**                    | Evaluated over the whole trace, as in a timespan; no LCP breakdown                                                                                                                                                                                 | **Not in #17075**. `TraceEngineResult` sets `enableSoftNavigation = false`; turning it on for soft navigation steps gives per-navigation insights                                                                                                                | `core/computed/trace-engine-result.js`, `core/audits/insights/insight-audit.js`                                                                                                   |
| **Report labels**               | None (shows "Navigation")                                                                                                                                                                                                                          | "Soft navigation" mode label in the flow report; default step name "Soft navigation report (url)"                                                                                                                                                                | `flow-report/src/util.ts`, `flow-report/src/header.tsx`, `flow-report/src/summary/summary.tsx`, `flow-report/src/i18n/ui-strings.js`, `core/user-flow.js`                         |
| **Docs**                        | This repository's README                                                                                                                                                                                                                           | "Soft navigations (experimental)" section                                                                                                                                                                                                                        | `docs/user-flows.md`                                                                                                                                                              |

## What the package changed in the upstream design

The first version of #17075 implemented soft navigations as `if (settings.softNavigation)` branches in the
runner, `gotoURL`, the config filters, the trace gatherer, the trace processor and several audits. Building
the package without access to any of those showed that most of the branches were not needed, and #17075
now follows the package:

- **One place decides what a navigation is.** Once the wait conditions accept a same-document navigation and
  the trace processor produces a `ProcessedNavigation` for it, the runner and the metric audits do not need
  to know the difference.
- **TTI, TBT and Speed Index work.** The stock implementations compute them once DOMContentLoaded is defined
  for a soft navigation (the URL change) and the run waits for the soft navigation's FCP. The special case
  for TBT is gone.
- **Audits are not filtered out.** The only audits that cannot run are the ones that need the document
  request, and they report themselves as not applicable.

## Keeping the package swappable

To make adopting the upstream version a mechanical change for user-flow and other consumers, the package
produces the result shape Lighthouse will:

- Steps have `gatherMode: 'navigation'`.
- Audit IDs stay `first-contentful-paint` / `largest-contentful-paint`, computed by the stock audits with
  their scoring curves.
- The multiple-navigation warning uses the upstream `UIStrings` wording.

Two steps are left for when Lighthouse moves:

- Once `softNavigation` is in `defaultSettings`, the package reads it and only bridges the steps that set it.
- Once a Lighthouse version has native support, `softNavigationConfig` returns the config unchanged for it.

The e2e suite doubles as an upstream conformance check. Pointing the workspace `lighthouse` dependency at a
tarball built from a Lighthouse branch (`yarn build-all && npm pack`) shows whether that branch produces the
same results as the package.

## Proposed landing sequence

#17075 touches about 55 files and is hard to review in one go. I plan to split it into PRs that each make
sense alone, most of them inert until the setting is used:

1. **#17434: fail fast on soft navigations** (open). Replaces the 30 s `NO_FCP` hang with a clear error,
   which is the fallback behaviour when `softNavigation` is not set.
2. **Trace processing.** `SoftNavigationStart` time origin and `processSoftNavigation` in tracehouse, with
   trace fixtures from Chrome 149+. Pure functions, no behaviour change for existing runs.
3. **Setting and config.** `softNavigation` in `defaultSettings`/`settings.d.ts` and the settings overrides.
   This also unblocks the package from using the upstream flag.
4. **Gathering.** `waitForSoftNavigation`, the FCP wait, `gotoURL` and the navigation runner.
   This is where the feature turns on.
5. **Audits and gatherers without a document request, and errors.** Not applicable document response
   audits, `NO_SOFT_NAVIGATION` (including the proto enum) and the multiple-navigation warning.
6. **Report and docs.** Flow report labels, default step name and `docs/user-flows.md`.

## Open questions for the Lighthouse team

- **Multiple soft navigations per step:** measure only the first (current proposal), fail, or split?
- **Scoring:** the page-load FCP/LCP curves are reused. Soft navigations likely deserve their own curves,
  or no Performance score until there is field data to calibrate against.
- **Document audits:** not applicable (the package and #17075), filtered out, or evaluated against the
  document that was already loaded?
- **INP:** keep it in the soft navigation step (it covers the triggering interaction) with zero weight, as
  in timespans?
- **Chrome support:** soft navigation trace events require Chrome 149+. Should Lighthouse feature-detect
  and emit a dedicated error on older Chrome?
- **Timespans:** should a timespan that contains a soft navigation warn and point to the navigation step?
- **Simulated throttling:** #17075 switches a soft navigation from `simulate` to `devtools`. Should Lantern
  simulate soft navigations instead? [Simulated throttling for soft navigations](simulated-throttling.md)
  lists what that takes, and [#23](https://github.com/push-based/lighthouse-soft-navigation/issues/23)
  tracks it.
