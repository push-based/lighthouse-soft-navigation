A soft navigation is a route change that updates the URL and the content without loading a new document, like a single page app does on a link click. Stock Lighthouse can't measure one as a navigation step: it waits for a page load that never comes and fails with `NO_FCP`.

`@push-based/lighthouse-soft-navigation` is a Lighthouse config that fixes this. With it, a navigation step that stays in the document is measured from the click, with FCP, LCP, TBT, CLS and a Performance score, by Lighthouse's own audits. Page loads, timespans and snapshots run exactly as before.

<!-- diagram: hard-vs-soft -->

## Requirements

- Lighthouse 13.6 or newer
- Chrome 149 or newer, the first version that reports soft navigations in the trace

## Two ways to set it up

The package is a config, so it runs wherever a Lighthouse user flow runs. Both setups measure the same steps and give the same result.

- [With Lighthouse](/docs/getting-started/lighthouse): you write a Node script that launches Chrome with Puppeteer, runs the flow and saves the report.
- [With user-flow](/docs/getting-started/user-flow): the user-flow CLI launches Chrome, runs your flow files and writes the reports.
