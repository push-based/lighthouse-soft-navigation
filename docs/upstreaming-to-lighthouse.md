# Upstreaming to Lighthouse

This package makes soft navigation metrics usable in Lighthouse user flows **today**, on stock Lighthouse.
The long-term goal is for the same behaviour to live in Lighthouse itself, at which point this package
shrinks to a thin compatibility layer and is then deprecated.

The code here will not look like the Lighthouse code. Lighthouse changes the gather pipeline and trace
processing; this package can only work around them from the outside (config overrides, a flow wrapper and
result post-processing). This document maps every workaround to the Lighthouse change that replaces it, so
the two stay aligned and each upstream PR has a clear scope.

- Tracking issue: [GoogleChrome/lighthouse#14573](https://github.com/GoogleChrome/lighthouse/issues/14573)
- Prototype of the upstream change: [GoogleChrome/lighthouse#17075](https://github.com/GoogleChrome/lighthouse/pull/17075) (draft, currently has merge conflicts with `main`)
- Prerequisite bug fix: [GoogleChrome/lighthouse#17434](https://github.com/GoogleChrome/lighthouse/pull/17434) (fail fast when a navigation callback only soft navigates)
- Reference implementation on stock Lighthouse: [app-speed `libs/audit/user-flow/runner/src/lib/soft-navigation`](https://github.com/ChristopherPHolder/app-speed/tree/main/libs/audit/user-flow/runner/src/lib/soft-navigation)

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
Performance score, and FCP/LCP are measured from the `SoftNavigationStart` trace event. Only audits that also
work in a timespan run, and the page is never reset before the step. Chrome 149 or newer is required.

### Why the package cannot use the same flag

`cleanFlagsForSettings` in `core/config/config-helpers.js` drops every flag that is not a key of
`defaultSettings`. A `softNavigation` flag passed to `startNavigation` never reaches `context.settings` on
stock Lighthouse, so the package needs its own entry points (`startSoftNavigation()` / `endSoftNavigation()`)
and has to track which steps are soft navigations itself.

Adding `softNavigation: false` to `defaultSettings` is therefore the first and smallest upstream change.
It is useful on its own: once it ships, the package can accept the upstream flag unchanged and read it
from `context.settings` in its audits.

## Workaround → Lighthouse change

| Concern                               | Package workaround on stock Lighthouse                                                                                                                                             | Lighthouse change                                                                                                                                                                                                                       | Files (from #17075 unless noted)                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Setting**                           | Own `startSoftNavigation`/`endSoftNavigation`; steps tracked by index                                                                                                              | `softNavigation` setting, documented as experimental                                                                                                                                                                                    | `core/config/constants.js`, `types/lhr/settings.d.ts`                                                                                                     |
| **Gathering**                         | Runs a **timespan** with `disableStorageReset`, waits for the main frame `framenavigated`, then for fresh network quiet                                                            | Navigation runner waits on `['softNavigation']` instead of `load`/`fcp`; `waitForSoftNavigation` waits for `Page.navigatedWithinDocument` plus network and CPU quiet; `gotoURL` uses the in-document URL as requested/main document URL | `core/gather/navigation-runner.js`, `core/gather/driver/navigation.js`, `core/gather/driver/wait-for-condition.js`                                        |
| **Requestor guard**                   | Not needed: the package only offers callback-style APIs                                                                                                                            | Throw when `softNavigation` is combined with a URL requestor                                                                                                                                                                            | `core/gather/navigation-runner.js`                                                                                                                        |
| **Settings overrides**                | Passes `disableStorageReset: true` to the timespan                                                                                                                                 | For soft navigations: `skipAboutBlank`, `disableStorageReset`, and `simulate` → `devtools` throttling (no document request to build a graph from)                                                                                       | `core/config/config.js` (`overrideSettingsForGatherMode`)                                                                                                 |
| **Config filtering**                  | Implicit: timespan mode already filters to timespan-capable audits; FCP/LCP are added by declaring `supportedModes: ['navigation', 'timespan']`                                    | `filterConfigForSoftNavigation`: timespan artifacts and audits, plus navigation-only `first-contentful-paint` and `largest-contentful-paint`                                                                                            | `core/config/filters.js`, `core/config/config.js`                                                                                                         |
| **Time origin**                       | None; audits compute offsets from `SoftNavigationStart.args.context.timeOrigin` themselves                                                                                         | New `softNavigationStart` time-origin method; a `clock_sync` marker recorded at trace start excludes soft navigations that happened before the step                                                                                     | `core/lib/tracehouse/trace-processor.js`, `core/gather/gatherers/trace.js`                                                                                |
| **FCP / LCP**                         | Subclassed FCP/LCP audits that read `SoftNavigationStart` and `largestContentfulPaint::CandidateForSoftNavigation` in timespan mode, delegating to the stock audits for page loads | `processSoftNavigation` builds a regular `ProcessedNavigation`, so the **stock** FCP/LCP audits work unchanged                                                                                                                          | `core/lib/tracehouse/trace-processor.js`                                                                                                                  |
| **TBT**                               | Timespan TBT over the whole trace                                                                                                                                                  | Measured from the soft navigation FCP to the end of the trace                                                                                                                                                                           | `core/computed/metrics/total-blocking-time.js`                                                                                                            |
| **Document-dependent audits**         | Not run (timespan mode)                                                                                                                                                            | `byte-efficiency-audit` and `network-requests` treat soft navigations like timespans; page load errors are not checked                                                                                                                  | `core/audits/byte-efficiency/byte-efficiency-audit.js`, `core/audits/network-requests.js`, `core/gather/navigation-runner.js`                             |
| **No soft navigation detected**       | FCP/LCP `notApplicable` plus a run warning                                                                                                                                         | `NO_SOFT_NAVIGATION` runtime error                                                                                                                                                                                                      | `core/lib/lh-error.js`, `core/lib/lh-trace-processor.js`, **`proto/lighthouse-result.proto` (missing in #17075)**, locales                                |
| **Multiple soft navigations**         | Run warning added while post-processing `createFlowResult`                                                                                                                         | Localized run warning from the navigation runner                                                                                                                                                                                        | `core/gather/navigation-runner.js`, locales                                                                                                               |
| **Step mode in the result**           | Post-processing rewrites `gatherMode` to `'navigation'` and sets `configSettings.softNavigation`                                                                                   | Native; no rewrite needed                                                                                                                                                                                                               | n/a                                                                                                                                                       |
| **Report labels**                     | None (shows "Navigation")                                                                                                                                                          | "Soft navigation" mode label in the flow report; default step name "Soft navigation report (url)"                                                                                                                                       | `flow-report/src/util.ts`, `flow-report/src/header.tsx`, `flow-report/src/summary/summary.tsx`, `flow-report/src/i18n/ui-strings.js`, `core/user-flow.js` |
| **Soft navigation inside a timespan** | Warning recommending a soft navigation step (from app-speed)                                                                                                                       | **Not in #17075**; candidate follow-up                                                                                                                                                                                                  | `core/user-flow.js` or the timespan runner                                                                                                                |
| **Docs**                              | This repository's README                                                                                                                                                           | "Soft navigations (experimental)" section                                                                                                                                                                                               | `docs/user-flows.md`                                                                                                                                      |

## Keeping the package swappable

To make adopting the upstream version a mechanical change for user-flow and other consumers, the package
should produce the same result shape Lighthouse will:

- Steps have `gatherMode: 'navigation'` and `configSettings.softNavigation: true`.
- Audit IDs stay `first-contentful-paint` / `largest-contentful-paint`, with the same scoring curves.
- Warning text matches the upstream `UIStrings`, and the missing-detection case maps to `NO_SOFT_NAVIGATION`.
- Once `softNavigation` is in `defaultSettings`, the package accepts it as a flag and uses
  `startSoftNavigation` only on older Lighthouse versions.
- When a Lighthouse version with native support is detected, the config override and the flow wrapper
  become no-ops.

The e2e suite doubles as an upstream conformance check. Pointing the workspace `lighthouse` dependency at a
tarball built from a Lighthouse branch (`yarn build-all && npm pack`) shows whether that branch produces the
same results as the package.

## Proposed landing sequence

#17075 touches about 40 files and is hard to review in one go. I plan to split it into PRs that each make
sense alone, most of them inert until the setting is used:

1. **#17434: fail fast on soft navigations** (open). Replaces the 30 s `NO_FCP` hang with a clear error,
   which is the fallback behaviour when `softNavigation` is not set.
2. **Trace processing.** `SoftNavigationStart` time origin and `processSoftNavigation` in tracehouse, with
   trace fixtures from Chrome 149+. Pure functions, no behaviour change for existing runs.
3. **Setting and config.** `softNavigation` in `defaultSettings`/`settings.d.ts`, the settings overrides
   and `filterConfigForSoftNavigation`. This also unblocks the package from using the upstream flag.
4. **Gathering.** `waitForSoftNavigation`, `gotoURL` and the navigation runner, plus the trace marker.
   This is where the feature turns on.
5. **Audit adjustments and errors.** TBT, byte-efficiency, network-requests, `NO_SOFT_NAVIGATION`
   (including the proto enum) and the multiple-navigation warning.
6. **Report and docs.** Flow report labels, default step name and `docs/user-flows.md`.

## Open questions for the Lighthouse team

- **Multiple soft navigations per step:** measure only the first (current proposal), fail, or split?
- **Scoring:** the page-load FCP/LCP curves are reused. Soft navigations likely deserve their own curves,
  or no Performance score until there is field data to calibrate against.
- **Metrics that do not apply:** Speed Index and TTI are not available; is TBT from FCP to trace end the
  right window?
- **INP:** keep it in the soft navigation step (it covers the triggering interaction) with zero weight, as
  in timespans?
- **Chrome support:** soft navigation trace events require Chrome 149+. Should Lighthouse feature-detect
  and emit a dedicated error on older Chrome?
- **Timespans:** should a timespan that contains a soft navigation warn and point to the navigation step?
