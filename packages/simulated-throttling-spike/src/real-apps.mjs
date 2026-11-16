/**
 * Public sites with client-side routing, each with a link whose click is a soft navigation.
 *
 * They are documentation sites of front-end frameworks, picked because their routers are what
 * applications are built with, and because they are public and stable. Each one runs its own
 * router, prefetching and data loading, so together they cover more than the fixture.
 *
 * vuejs.org and nextjs.org were tried too. A click on their links did not navigate in headless
 * Chrome at a desktop size, so they were left out.
 *
 * @type {Array<{ id: string, url: string, navigate: (page: import('puppeteer').Page) => Promise<unknown> }>}
 */
export const REAL_APPS = [
  {
    // Next.js App Router.
    id: 'react.dev',
    url: 'https://react.dev/',
    navigate: (page) => clickLink(page, '/learn'),
  },
  {
    // Angular router.
    id: 'angular.dev',
    url: 'https://angular.dev/',
    navigate: (page) => clickLink(page, '/docs'),
  },
  {
    // VitePress, on Vue.
    id: 'vite.dev',
    url: 'https://vite.dev/',
    navigate: (page) => clickLink(page, '/guide'),
  },
  {
    // SvelteKit.
    id: 'svelte.dev',
    url: 'https://svelte.dev/',
    navigate: (page) => clickLink(page, '/docs'),
  },
];

/**
 * Clicks the first visible link to `pathname` with real input. Chrome only reports a soft
 * navigation that a trusted event started, which `element.click()` is not.
 */
async function clickLink(page, pathname) {
  const handle = await page.evaluateHandle((pathname) => {
    return [...document.querySelectorAll('a[href]')].find((a) => {
      const url = new URL(a.href, location.href);
      const box = a.getBoundingClientRect();
      return (
        url.origin === location.origin &&
        url.pathname.replace(/\/$/, '') === pathname &&
        box.width > 0 &&
        box.height > 0 &&
        box.top >= 0 &&
        box.bottom <= innerHeight
      );
    });
  }, pathname);
  const link = handle.asElement();
  if (!link) throw new Error(`No visible link to ${pathname} on ${page.url()}`);
  await link.click();
}
