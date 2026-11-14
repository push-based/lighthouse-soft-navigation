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
          'What a soft navigation is, what the package adds to Lighthouse user flows and the two ways to set it up.',
        load: md(() => import('../../content/getting-started/introduction.md')),
      },
      {
        slug: 'lighthouse',
        title: 'Set up with Lighthouse',
        description:
          'Install the package and measure a soft navigation step in a Lighthouse script of your own.',
        load: md(() => import('../../content/getting-started/lighthouse.md')),
      },
      {
        slug: 'user-flow',
        title: 'Set up with user-flow',
        description:
          'Install the package and measure a soft navigation step in a flow file of the user-flow CLI.',
        load: md(() => import('../../content/getting-started/user-flow.md')),
      },
    ],
  },
  {
    slug: 'guides',
    title: 'Guides',
    pages: [
      {
        slug: 'results',
        title: 'Reading the result',
        description:
          'What a soft navigation step looks like in a report, and how to tell it from a page load.',
        load: md(() => import('../../content/guides/results.md')),
      },
      {
        slug: 'throttling',
        title: 'Throttling',
        description:
          'Why a soft navigation step needs DevTools or provided throttling, per step or for the whole flow.',
        load: md(() => import('../../content/guides/throttling.md')),
      },
      {
        slug: 'limits',
        title: 'Limits and troubleshooting',
        description:
          'What a soft navigation step cannot measure, and what to do when one fails.',
        load: md(() => import('../../content/guides/limits.md')),
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
