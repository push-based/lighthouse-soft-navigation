The package's entry point is one function. The pieces it is built from are exported too, for configs that assemble their own artifacts and audits.

## softNavigationConfig

```ts
function softNavigationConfig(config?: LH.Config): LH.Config;
```

Returns the config with soft navigation support. A navigation step whose interaction only navigates within the document is measured as a navigation, from that interaction. Page loads, timespans and snapshots run exactly as they do with the config that was passed in.

| Parameter | Type        | Default                     | Description                                                      |
| --------- | ----------- | --------------------------- | ---------------------------------------------------------------- |
| `config`  | `LH.Config` | Lighthouse's default config | Any Lighthouse config, including `extends: 'lighthouse:default'` |

```js
import { startFlow, desktopConfig } from 'lighthouse';
import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';

// The default config.
await startFlow(page, { config: softNavigationConfig() });

// The desktop preset.
await startFlow(page, { config: softNavigationConfig(desktopConfig) });

// A custom config that extends the default.
await startFlow(page, {
  config: softNavigationConfig({
    extends: 'lighthouse:default',
    settings: { onlyCategories: ['performance'] },
  }),
});
```

The config it returns has only the settings that were passed in. Lighthouse fills in the defaults, so settings that a tool layers under the config, such as the project settings of user-flow, still apply.

The function is idempotent: calling it on a config it returned does not add anything twice.

What it changes in the config:

- Adds the `SoftNavigation` artifact, first, since the gatherers below depend on it.
- Replaces the stock `trace`, `link-elements` and `main-document-content` gatherers with extended ones.
- Wraps the audits that need the document request. See [How it works](/docs/reference/how-it-works).
- Adds the `soft-navigation` audit, and a hidden reference to it in the `performance` category, so its run warnings survive `onlyCategories: ['performance']`.

## Building blocks

The other exports are the pieces `softNavigationConfig` puts together.

| Export                              | Kind     | Purpose                                                                                     |
| ----------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `SoftNavigation`                    | Gatherer | Recognises a soft navigation and lets Lighthouse's wait conditions complete for it          |
| `SoftNavigationTrace`               | Gatherer | The stock trace gatherer, plus the page load events of a soft navigation                    |
| `SoftNavigationLinkElements`        | Gatherer | The stock gatherer, without failing on a missing document request                           |
| `SoftNavigationMainDocumentContent` | Gatherer | The stock gatherer, without failing on a missing document request                           |
| `SoftNavigationAudit`               | Audit    | The `soft-navigation` audit: marks the step and carries its run warnings                    |
| `withoutDocumentRequest`            | Function | Wraps a stock audit so it is not applicable, or runs as in a timespan, on a soft navigation |
| `softNavigationStarts`              | Function | The `SoftNavigationStart` events of a trace                                                 |
| `withPageLoadEvents`                | Function | Adds the page load events the trace processor reads to the trace of a soft navigation       |
| `SoftNavigationArtifact`            | Type     | The `SoftNavigation` artifact: `{ url, navigationType }`, or `null` for a page load         |
| `SoftNavigationStartEvent`          | Type     | A `SoftNavigationStart` trace event                                                         |

### withoutDocumentRequest

```ts
function withoutDocumentRequest<T extends typeof Audit>(
  StockAudit: T,
  onSoftNavigation: 'timespan' | 'notApplicable',
): T;
```

Use it for a custom audit that reads the document request. On a page load the audit runs unchanged. On a soft navigation it either runs as in a timespan (`'timespan'`), or reports `notApplicable` (`'notApplicable'`).

```js
import MyDocumentAudit from './my-document-audit.js';
import { withoutDocumentRequest } from '@push-based/lighthouse-soft-navigation';

const config = softNavigationConfig({
  extends: 'lighthouse:default',
  audits: [
    {
      implementation: withoutDocumentRequest(MyDocumentAudit, 'notApplicable'),
    },
  ],
});
```

## Exported messages

`MULTIPLE_SOFT_NAVIGATIONS_WARNING`, `NO_SOFT_NAVIGATION_WARNING` and `SIMULATED_THROTTLING_WARNING` are the run warnings of the `soft-navigation` audit, for code that checks a result for them.

```js
import { SIMULATED_THROTTLING_WARNING } from '@push-based/lighthouse-soft-navigation';

if (step.lhr.runWarnings.includes(SIMULATED_THROTTLING_WARNING)) {
  throw new Error(`${step.name} ran with simulated throttling`);
}
```
