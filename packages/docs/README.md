# lighthouse-soft-navigation docs

The documentation site for `@push-based/lighthouse-soft-navigation`, built with Angular and prerendered to static HTML for GitHub Pages.

## Develop

```bash
npx nx serve docs
```

Opens a dev server with hot reload on http://localhost:4300.

## Build

```bash
npx nx build docs
```

Produces a fully prerendered site in `dist/packages/docs/browser` with `/lighthouse-soft-navigation/` as base href, ready for GitHub Pages. Use `--configuration=development` for a build with `/` as base href.

## Write content

Pages are Markdown files under `src/content/<section>/<page>.md`. Register a page in `src/app/docs/nav.ts` to give it a route, a title and a description; the sidebar, the start page, prerendering and the previous/next links all derive from that list.

Pages start with their first paragraph: the page title and description come from `nav.ts`.

Markdown extras:

- Fenced code blocks are highlighted. Add a file name with ` ```js title="flow.mjs" `.
- `> [!TIP]`, `> [!NOTE]`, `> [!IMPORTANT]` and `> [!WARNING]` block quotes render as callouts.
- Links that start with `/docs/` are in-app links and are rewritten for the base href.
- Images live in `public/images` and are referenced as `images/<file>`.
- `<!-- diagram: name -->` draws one of the inline diagrams from `src/app/docs/diagrams.ts`, and `<!-- cta -->` adds the install call to action.

The site follows the system colour scheme and offers a toggle in the header; the choice is stored in `localStorage`. Colours come from the push-based design tokens in `src/tokens.scss`, mapped to semantic roles with light and dark values in `src/styles.scss`. Use the semantic roles (`--surface`, `--text`, `--border`, `--accent`, ...) in components, never the raw `--color-*` ramps.

## Preview image and icons

`node packages/docs/scripts/og-image.mjs` renders `public/og-image.png`, `public/favicon.png` and `public/apple-touch-icon.png` from the hero and `public/images/mark.svg`. Run it after changing either.

## Deploy

`.github/workflows/docs.yml` builds and deploys the site on every push to `main` that touches the docs. The site is served at https://push-based.github.io/lighthouse-soft-navigation/. The repository's Pages source must be set to "GitHub Actions".
