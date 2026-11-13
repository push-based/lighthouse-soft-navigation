import { LAST_UPDATED } from '../../content/last-updated.generated';

export interface DocPageEntry {
  /** URL segment inside its section, e.g. `quick-start`. */
  slug: string;
  title: string;
  description: string;
  load: () => Promise<string>;
}

export interface DocSection {
  slug: string;
  title: string;
  pages: DocPageEntry[];
}

const md = (loader: () => Promise<{ default: string }>) => () =>
  loader().then((m) => m.default);

/** Icon paths (24px grid, stroked) for each docs section, used by the sidebar and the landing page. */
export const SECTION_ICONS: Record<string, string[]> = {
  // Rocket
  'getting-started': [
    'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z',
    'm12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z',
    'M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0',
    'M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5',
  ],
  // Route
  guides: [
    'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    'M9 17h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15',
    'M18 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  // Braces
  reference: [
    'M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1',
    'M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1',
  ],
  // Git pull request
  upstream: [
    'M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M13 6h3a2 2 0 0 1 2 2v7',
    'M6 9v12',
  ],
  // Book
  resources: ['M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20'],
};

export const DOCS_NAV: DocSection[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    pages: [
      {
        slug: 'introduction',
        title: 'Introduction',
        description:
          'What a soft navigation is, why stock Lighthouse cannot measure one and what the package changes.',
        load: md(() => import('../../content/getting-started/introduction.md')),
      },
      {
        slug: 'installation',
        title: 'Installation',
        description:
          'Install the package next to Lighthouse, and the Lighthouse and Chrome versions it needs.',
        load: md(() => import('../../content/getting-started/installation.md')),
      },
      {
        slug: 'quick-start',
        title: 'Quick start',
        description:
          'Run a user flow with a page load and a soft navigation, and open the flow report.',
        load: md(() => import('../../content/getting-started/quick-start.md')),
      },
    ],
  },
  {
    slug: 'guides',
    title: 'Guides',
    pages: [
      {
        slug: 'steps',
        title: 'Soft navigation steps',
        description:
          'Write soft navigation steps with a callback or with startNavigation, and how the package recognises them.',
        load: md(() => import('../../content/guides/steps.md')),
      },
      {
        slug: 'results',
        title: 'Reading the results',
        description:
          'The shape of a soft navigation step, its metrics, the audits that do not apply and its run warnings.',
        load: md(() => import('../../content/guides/results.md')),
      },
      {
        slug: 'throttling',
        title: 'Throttling',
        description:
          'Why a soft navigation step needs DevTools or provided throttling instead of simulated throttling.',
        load: md(() => import('../../content/guides/throttling.md')),
      },
      {
        slug: 'limits',
        title: 'Limits and troubleshooting',
        description:
          'What a soft navigation step cannot measure, and what to do when a step fails or has a warning.',
        load: md(() => import('../../content/guides/limits.md')),
      },
      {
        slug: 'user-flow',
        title: 'Using with user-flow',
        description:
          'Measure soft navigations in the *.uf.mts flows of @push-based/user-flow.',
        load: md(() => import('../../content/guides/user-flow.md')),
      },
    ],
  },
  {
    slug: 'reference',
    title: 'Reference',
    pages: [
      {
        slug: 'api',
        title: 'API',
        description:
          'softNavigationConfig, the gatherers and audits it is built from, and the exported run warnings.',
        load: md(() => import('../../content/reference/api.md')),
      },
      {
        slug: 'how-it-works',
        title: 'How it works',
        description:
          'How the gatherers, the trace and the wrapped audits turn a soft navigation into a navigation step.',
        load: md(() => import('../../content/reference/how-it-works.md')),
      },
    ],
  },
  {
    slug: 'upstream',
    title: 'Upstreaming',
    pages: [
      {
        slug: 'overview',
        title: 'Upstreaming to Lighthouse',
        description:
          'The target behaviour in Lighthouse, why the package cannot use the same flag and how it stays swappable.',
        load: md(() => import('../../content/upstream/overview.md')),
      },
      {
        slug: 'override-map',
        title: 'Override map',
        description:
          'Each override of the package next to the Lighthouse change it stands in for, with the files involved.',
        load: md(() => import('../../content/upstream/override-map.md')),
      },
      {
        slug: 'landing-plan',
        title: 'Landing plan',
        description:
          'The proposed sequence of Lighthouse pull requests and the open questions for the Lighthouse team.',
        load: md(() => import('../../content/upstream/landing-plan.md')),
      },
    ],
  },
  {
    slug: 'resources',
    title: 'Resources',
    pages: [
      {
        slug: 'links',
        title: 'Links',
        description:
          'The Lighthouse issues and pull requests, Chrome soft navigation docs and related tools.',
        load: md(() => import('../../content/resources/links.md')),
      },
    ],
  },
];

export interface FlatDocPage extends DocPageEntry {
  section: DocSection;
  path: string;
  /** Link to edit the page's Markdown source on GitHub. */
  editUrl: string;
  /** ISO date of the last commit that touched the page, when known. */
  lastUpdated?: string;
}

const EDIT_BASE =
  'https://github.com/push-based/lighthouse-soft-navigation/edit/main/packages/docs/src/content';

export const ALL_DOC_PAGES: FlatDocPage[] = DOCS_NAV.flatMap((section) =>
  section.pages.map((page) => {
    const file = `${section.slug}/${page.slug}.md`;
    return {
      ...page,
      section,
      path: `/docs/${section.slug}/${page.slug}`,
      editUrl: `${EDIT_BASE}/${file}`,
      lastUpdated: LAST_UPDATED[file],
    };
  }),
);

export function findDocPage(
  section: string,
  page: string,
): FlatDocPage | undefined {
  return ALL_DOC_PAGES.find(
    (p) => p.section.slug === section && p.slug === page,
  );
}
