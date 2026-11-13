# Lighthouse Soft Navigation

Measure soft navigations as navigation steps of a Lighthouse user flow, on stock Lighthouse.

**[Documentation](https://push-based.github.io/lighthouse-soft-navigation/)**

The goal is to land this in Lighthouse itself; see [Upstreaming to Lighthouse](docs/upstreaming-to-lighthouse.md) for how each part maps to a Lighthouse change.

| Project                                                                         | Description                                                                                                                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@push-based/lighthouse-soft-navigation`](packages/lighthouse-soft-navigation) | Publishable library                                                                                                                               |
| [`lighthouse-soft-navigation-e2e`](packages/lighthouse-soft-navigation-e2e)     | Publishes to a local Verdaccio registry, installs it and runs a user flow with soft navigations, with Lighthouse and with `@push-based/user-flow` |
| [`docs`](packages/docs)                                                         | The documentation site, deployed to GitHub Pages                                                                                                  |

## Development

```sh
pnpm install
pnpm nx run-many -t lint test build typecheck   # all checks
pnpm nx e2e lighthouse-soft-navigation-e2e      # publish to Verdaccio, install, run a user flow
pnpm nx local-registry                          # run Verdaccio on http://localhost:4873
pnpm nx serve docs                              # docs site on http://localhost:4300
```

## Release

Versioning follows conventional commits via `nx release`:

```sh
pnpm nx release --dry-run
pnpm nx release
```
