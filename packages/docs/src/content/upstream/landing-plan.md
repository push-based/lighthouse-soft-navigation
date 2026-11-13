How the Lighthouse change is meant to land, and the questions that are still open for the Lighthouse team.

## Proposed landing sequence

#17075 touches about 40 files and is hard to review in one go. I plan to split it into PRs that each make
sense alone, most of them inert until the setting is used:

1. **[#17434](https://github.com/GoogleChrome/lighthouse/pull/17434): fail fast on soft navigations** (open). Replaces the 30 s `NO_FCP` hang with a clear error,
   which is the fallback behaviour when `softNavigation` is not set.
2. **Trace processing.** `SoftNavigationStart` time origin and `processSoftNavigation` in tracehouse, with
   trace fixtures from Chrome 149+. Pure functions, no behaviour change for existing runs.
3. **Setting and config.** `softNavigation` in `defaultSettings`/`settings.d.ts` and the settings overrides.
   This also unblocks the package from using the upstream flag.
4. **Gathering.** `waitForSoftNavigation` including the FCP wait, `gotoURL` and the navigation runner.
   This is where the feature turns on.
5. **Audits without a document request and errors.** Optional main resource, `NO_SOFT_NAVIGATION`
   (including the proto enum) and the multiple-navigation warning.
6. **Report and docs.** Flow report labels, default step name and `docs/user-flows.md`.

## Open questions for the Lighthouse team

- **Multiple soft navigations per step:** measure only the first (current proposal), fail, or split?
- **Scoring:** the page-load FCP/LCP curves are reused. Soft navigations likely deserve their own curves,
  or no Performance score until there is field data to calibrate against.
- **Document audits:** not applicable (the package), filtered out (#17075), or evaluated against the
  document that was already loaded?
- **INP:** keep it in the soft navigation step (it covers the triggering interaction) with zero weight, as
  in timespans?
- **Chrome support:** soft navigation trace events require Chrome 149+. Should Lighthouse feature-detect
  and emit a dedicated error on older Chrome?
- **Timespans:** should a timespan that contains a soft navigation warn and point to the navigation step?
