import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FlowResult } from 'lighthouse';
import { inject } from 'vitest';

/**
 * Runs `fixtures/flow-wide-throttling.mjs` in the consumer project: a stock Lighthouse user flow
 * with DevTools throttling in the config, so no step passes options.
 *
 * 1. page load
 * 2. soft navigation to /products, clicked in a `navigate` callback
 * 3. soft navigation to /, clicked between `startNavigation` and `endNavigation`
 */
describe('a user flow with DevTools throttling for the whole flow', () => {
  let steps: FlowResult.Step[];

  beforeAll(() => {
    const consumerDirectory = inject('consumerDirectory');
    const output = join(consumerDirectory, 'flow-wide-throttling-result.json');
    execFileSync('node', ['flow-wide-throttling.mjs', output], {
      cwd: consumerDirectory,
      stdio: 'inherit',
    });
    steps = (JSON.parse(readFileSync(output, 'utf8')) as FlowResult).steps;
  }, 300_000);

  it('observes every step, page loads included', () => {
    expect(steps.map(({ lhr }) => lhr.configSettings.throttlingMethod)).toEqual(
      ['devtools', 'devtools', 'devtools'],
    );
  });

  it('measures the soft navigations without step options or a run warning', () => {
    expect(
      steps.map(({ lhr }) => lhr.audits['soft-navigation'].scoreDisplayMode),
    ).toEqual(['notApplicable', 'informative', 'informative']);
    for (const { lhr } of steps) {
      const errored = Object.values(lhr.audits)
        .filter(({ scoreDisplayMode }) => scoreDisplayMode === 'error')
        .map(({ id }) => id);
      expect(errored).toEqual([]);
      expect(lhr.runWarnings).toEqual([]);
      expect(lhr.categories['performance'].score).toEqual(expect.any(Number));
    }
  });
});
