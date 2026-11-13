import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';
import {
  createUserFlowRunner,
  type UserFlowProvider,
} from '@push-based/user-flow';

// A soft navigation has no document request to simulate from, so it is observed.
const observed = { throttlingMethod: 'devtools' } as const;

export default {
  flowOptions: { name: 'Soft navigations', config: softNavigationConfig() },
  launchOptions: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
  interactions: async (context) => {
    const { flow, page, collectOptions } = context;

    // 1. Page load.
    await flow.navigate(collectOptions.url);

    // 2. Soft navigation, triggered by a click in a callback.
    await flow.navigate(async () => {
      await page.click('#products-link');
    }, observed);

    // 3. Soft navigation, triggered by a click between startNavigation and endNavigation.
    await flow.startNavigation(observed);
    await page.click('#home-link');
    await flow.endNavigation();

    // 4. Soft navigation, from the startNavigation and endNavigation steps of a recording.
    const runner = await createUserFlowRunner(
      './recordings/products.replay.json',
      context,
    );
    await runner.run();

    // 5. Page load, triggered by a click in a callback.
    await flow.navigate(async () => {
      await page.click('#page-load-link');
    });
  },
} satisfies UserFlowProvider;
