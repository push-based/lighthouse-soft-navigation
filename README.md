# Lighthouse Soft Navigation

Measure soft navigations as navigation steps of a Lighthouse user flow, on stock Lighthouse.

**[Documentation](https://push-based.github.io/lighthouse-soft-navigation/)**

The goal is to land this in Lighthouse itself; see [Upstreaming to Lighthouse](docs/upstreaming-to-lighthouse.md) for how each part maps to a Lighthouse change.

| Project                                                                         | Description                                                                                     |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`@push-based/lighthouse-soft-navigation`](packages/lighthouse-soft-navigation) | Publishable library                                                                             |
| [`lighthouse-soft-navigation-e2e`](packages/lighthouse-soft-navigation-e2e)     | Publishes to a local Verdaccio registry, installs it and runs a user flow with soft navigations |
| [`docs`](packages/docs)                                                         | The documentation site, deployed to GitHub Pages                                                |

## Development

```sh
npm install
npx nx run-many -t lint test build typecheck   # all checks
npx nx e2e lighthouse-soft-navigation-e2e      # publish to Verdaccio, install, run a user flow
npx nx local-registry                          # run Verdaccio on http://localhost:4873
npx nx serve docs                              # docs site on http://localhost:4300
```

## Release

Versioning follows conventional commits via `nx release`:

```sh
npx nx release --dry-run
npx nx release
```
