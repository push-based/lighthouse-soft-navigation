## This project

- [GitHub repository](https://github.com/push-based/lighthouse-soft-navigation)
- [Issues](https://github.com/push-based/lighthouse-soft-navigation/issues)
- [Design of the package](https://github.com/push-based/lighthouse-soft-navigation/issues/1)
- [End-to-end user flow](https://github.com/push-based/lighthouse-soft-navigation/blob/main/packages/lighthouse-soft-navigation-e2e/fixtures/flow.mjs): a flow with page loads and soft navigations, run against a small single page app on every CI run

## Lighthouse

- [Lighthouse user flows](https://github.com/GoogleChrome/lighthouse/blob/main/docs/user-flows.md): navigations, timespans and snapshots
- [Soft navigation support in Lighthouse](https://github.com/GoogleChrome/lighthouse/issues/14573): the tracking issue
- [GoogleChrome/lighthouse#17075](https://github.com/GoogleChrome/lighthouse/pull/17075): the prototype of the upstream change
- [GoogleChrome/lighthouse#17434](https://github.com/GoogleChrome/lighthouse/pull/17434): fail fast when a navigation callback only soft navigates

## Soft navigations in Chrome

- [Soft navigations explainer](https://github.com/WICG/soft-navigations): the WICG proposal Chrome implements
- [Experimenting with measuring soft navigations](https://developer.chrome.com/docs/web-platform/soft-navigations-experiment): how Chrome detects soft navigations and reports their metrics

## Related tools

- [@push-based/user-flow](https://push-based.github.io/user-flow/): a CLI to write, run and report Lighthouse user flows. Its [soft navigations integration](https://push-based.github.io/user-flow/docs/integrations/soft-navigations) shows how to use this package in a flow file.
