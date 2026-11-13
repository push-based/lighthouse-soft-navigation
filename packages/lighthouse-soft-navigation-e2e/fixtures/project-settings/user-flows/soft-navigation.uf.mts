import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';
import type { UserFlowProvider } from '@push-based/user-flow';

// No step options: the throttling method comes from the settings of the project's .user-flowrc.json.
export default {
  flowOptions: { name: 'Project settings', config: softNavigationConfig() },
  launchOptions: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
  interactions: async ({ flow, page, collectOptions }) => {
    // 1. Page load.
    await flow.navigate(collectOptions.url);

    // 2. Soft navigation, triggered by a click in a callback.
    await flow.navigate(async () => {
      await page.click('#products-link');
    });

    // 3. Soft navigation, triggered by a click between startNavigation and endNavigation.
    await flow.startNavigation();
    await page.click('#home-link');
    await flow.endNavigation();
  },
} satisfies UserFlowProvider;
