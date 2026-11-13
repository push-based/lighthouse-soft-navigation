Install the package next to Lighthouse. Lighthouse is a peer dependency, so the version your project uses is the one the package extends.

```sh
npm install @push-based/lighthouse-soft-navigation lighthouse
```

To drive the browser you also need Puppeteer, if your project does not have it yet:

```sh
npm install puppeteer
```

## Requirements

| Requirement | Version        | Why                                                                                         |
| ----------- | -------------- | ------------------------------------------------------------------------------------------- |
| Lighthouse  | 13.6 or newer  | The package overrides gatherers and audits of this version's default config                 |
| Chrome      | 149 or newer   | Earlier versions do not emit the `SoftNavigationStart` and soft navigation LCP trace events |
| Node.js     | 22.19 or newer | Lighthouse 13 requires it                                                                   |

> [!WARNING]
> On an older Chrome the URL changes, but Chrome never reports a soft navigation. The step then completes without metrics, and the `soft-navigation` audit has a run warning that says so.

The package is an ES module. Import it with `import`, from an `.mjs` file or a project with `"type": "module"`.

```js
import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';
```

Continue with the [Quick start](/docs/getting-started/quick-start).
