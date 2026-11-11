import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FlowResult } from 'lighthouse';
import { inject } from 'vitest';

type Step = FlowResult.Step;

/**
 * Runs `fixtures/flow.mjs` in the consumer project: a stock Lighthouse user flow that uses the
 * config of the published package.
 *
 * 1. page load
 * 2. soft navigation to /products, clicked in a `navigate` callback
 * 3. soft navigation to /, clicked between `startNavigation` and `endNavigation`
 * 4. page load of /about, clicked in a `navigate` callback
 * 5. page load of /, right after the page changed its URL
 */
describe('a Lighthouse user flow with soft navigations', () => {
  let steps: Step[];
  let origin: string;

  beforeAll(() => {
    const consumerDirectory = inject('consumerDirectory');
    const output = join(consumerDirectory, 'flow-result.json');
    execFileSync('node', ['flow.mjs', output], {
      cwd: consumerDirectory,
      stdio: 'inherit',
    });
    const result: FlowResult = JSON.parse(readFileSync(output, 'utf8'));
    steps = result.steps;
    origin = new URL(steps[0].lhr.finalDisplayedUrl).origin;
  }, 300_000);

  const audit = (step: Step, id: string) => step.lhr.audits[id];
  const erroredAudits = (step: Step) =>
    Object.values(step.lhr.audits)
      .filter(({ scoreDisplayMode }) => scoreDisplayMode === 'error')
      .map(({ id, errorMessage }) => `${id}: ${errorMessage}`);
  const urls = ({ lhr }: Step) => ({
    requestedUrl: lhr.requestedUrl,
    mainDocumentUrl: lhr.mainDocumentUrl,
    finalDisplayedUrl: lhr.finalDisplayedUrl,
  });
  const allUrls = (url: string) => ({
    requestedUrl: url,
    mainDocumentUrl: url,
    finalDisplayedUrl: url,
  });

  it('runs every step as a navigation', () => {
    expect(steps.map(({ lhr }) => lhr.gatherMode)).toEqual([
      'navigation',
      'navigation',
      'navigation',
      'navigation',
      'navigation',
    ]);
    expect(steps.map(({ name }) => name)).toEqual([
      expect.stringMatching(/^Navigation report \(.+\/\)$/),
      expect.stringMatching(/^Navigation report \(.+\/products\)$/),
      expect.stringMatching(/^Navigation report \(.+\/\)$/),
      expect.stringMatching(/^Navigation report \(.+\/about\)$/),
      expect.stringMatching(/^Navigation report \(.+\/\)$/),
    ]);
  });

  describe.each([
    ['clicked in a navigate callback', 1, '/products'],
    ['clicked between startNavigation and endNavigation', 2, '/'],
  ])('a soft navigation %s', (_, index, path) => {
    let step: Step;

    beforeAll(() => {
      step = steps[index];
    });

    it('is the URL the page navigated to within the document', () => {
      expect(urls(step)).toEqual(allUrls(`${origin}${path}`));
    });

    it('is reported as a soft navigation', () => {
      expect(audit(step, 'soft-navigation')).toMatchObject({
        scoreDisplayMode: 'informative',
        details: {
          url: `${origin}${path}`,
          navigationType: 'historyApi',
          softNavigations: 1,
        },
      });
    });

    it('measures FCP and LCP from the interaction with the stock audits', () => {
      const fcp = audit(step, 'first-contentful-paint');
      const lcp = audit(step, 'largest-contentful-paint');

      expect(fcp).toMatchObject({
        scoreDisplayMode: 'numeric',
        numericUnit: 'millisecond',
      });
      expect(lcp).toMatchObject({
        scoreDisplayMode: 'numeric',
        numericUnit: 'millisecond',
      });
      expect(fcp.numericValue).toBeGreaterThan(0);
      // The fixture renders its largest content with a second request, after the first paint.
      expect(lcp.numericValue).toBeGreaterThan(fcp.numericValue as number);
      expect(lcp.numericValue).toBeLessThan(30_000);
    });

    it('computes the other performance metrics and a performance score', () => {
      for (const id of [
        'speed-index',
        'total-blocking-time',
        'cumulative-layout-shift',
        'interactive',
      ]) {
        expect(audit(step, id), id).toMatchObject({
          scoreDisplayMode: 'numeric',
          numericValue: expect.any(Number),
        });
      }
      expect(step.lhr.categories['performance'].score).toEqual(
        expect.any(Number),
      );
    });

    it('scores every category without an audit failing', () => {
      expect(erroredAudits(step)).toEqual([]);
      expect(step.lhr.runtimeError).toBeUndefined();
      expect(step.lhr.runWarnings).toEqual([]);
      for (const [id, category] of Object.entries(step.lhr.categories)) {
        expect(category.score, id).toEqual(expect.any(Number));
      }
    });

    it('reports the requests the soft navigation made', () => {
      const details = audit(step, 'network-requests').details as {
        items: Array<{ url: string }>;
      };

      expect(details.items.map(({ url }) => new URL(url).pathname)).toEqual(
        expect.arrayContaining(['/api/route', '/api/details']),
      );
    });

    it('does not apply the audits of a document response', () => {
      for (const id of [
        'server-response-time',
        'redirects',
        'http-status-code',
        'csp-xss',
      ]) {
        expect(audit(step, id).scoreDisplayMode, id).toBe('notApplicable');
      }
    });

    it('is observed, since there is no document request to simulate from', () => {
      expect(step.lhr.configSettings.throttlingMethod).toBe('devtools');
    });
  });

  describe.each([
    ['of a URL', 0, '/'],
    ['clicked in a navigate callback', 3, '/about'],
    ['that follows a URL change', 4, '/'],
  ])('a page load %s', (_, index, path) => {
    let step: Step;

    beforeAll(() => {
      step = steps[index];
    });

    it('is the URL of the document', () => {
      expect(urls(step)).toEqual(allUrls(`${origin}${path}`));
    });

    it('is not reported as a soft navigation', () => {
      expect(audit(step, 'soft-navigation').scoreDisplayMode).toBe(
        'notApplicable',
      );
    });

    it('is audited by stock Lighthouse', () => {
      expect(erroredAudits(step)).toEqual([]);
      expect(step.lhr.runWarnings).toEqual([]);
      expect(step.lhr.configSettings.throttlingMethod).toBe('simulate');
      expect(audit(step, 'server-response-time').scoreDisplayMode).not.toBe(
        'notApplicable',
      );
      expect(audit(step, 'http-status-code').score).toBe(1);
      expect(step.lhr.categories['performance'].score).toEqual(
        expect.any(Number),
      );
    });
  });
});
