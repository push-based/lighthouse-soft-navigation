import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { FlowResult } from 'lighthouse';
import { inject } from 'vitest';

type Step = FlowResult.Step;

/**
 * Runs `fixtures/collect.mjs` in the consumer project: `user-flow collect` with
 * `fixtures/user-flows/soft-navigation.uf.mts`, which uses the config of the published package.
 *
 * 1. page load
 * 2. soft navigation to /products, clicked in a `navigate` callback
 * 3. soft navigation to /, clicked between `startNavigation` and `endNavigation`
 * 4. soft navigation to /products, from the `startNavigation` and `endNavigation` steps of a recording
 * 5. page load of /about, clicked in a `navigate` callback
 */
function collect(consumerDirectory: string) {
  const reports = join(consumerDirectory, 'user-flow-reports');
  rmSync(reports, { recursive: true, force: true });
  const { status, stdout, stderr } = spawnSync('node', ['collect.mjs'], {
    cwd: consumerDirectory,
    encoding: 'utf8',
  });
  return { status, output: `${stdout}${stderr}`, reports };
}

function readReport(directory: string, extension: 'json' | 'md') {
  const files = readdirSync(directory).filter((file) =>
    file.endsWith(`.${extension}`),
  );
  expect(files).toHaveLength(1);
  return readFileSync(join(directory, files[0]), 'utf8');
}

describe('user-flow collect with soft navigations', () => {
  const consumerDirectory = inject('consumerDirectory');

  let steps: Step[];
  let markdown: string;
  let origin: string;

  beforeAll(() => {
    const { status, output, reports } = collect(consumerDirectory);
    expect(status, output).toBe(0);
    steps = (JSON.parse(readReport(reports, 'json')) as FlowResult).steps;
    markdown = readReport(reports, 'md');
    origin = new URL(steps[0].lhr.finalDisplayedUrl).origin;
  }, 300_000);

  const audit = (step: Step, id: string) => step.lhr.audits[id];
  const erroredAudits = (step: Step) =>
    Object.values(step.lhr.audits)
      .filter(({ scoreDisplayMode }) => scoreDisplayMode === 'error')
      .map(({ id, errorMessage }) => `${id}: ${errorMessage}`);

  it('runs every step as a navigation', () => {
    expect(steps.map(({ lhr }) => lhr.gatherMode)).toEqual([
      'navigation',
      'navigation',
      'navigation',
      'navigation',
      'navigation',
    ]);
    expect(
      steps.map(({ lhr }) => new URL(lhr.finalDisplayedUrl).pathname),
    ).toEqual(['/', '/products', '/', '/products', '/about']);
  });

  it('runs on the Chrome of user-flow, which supports soft navigations', () => {
    for (const { lhr } of steps) {
      const major = Number(
        lhr.environment.hostUserAgent.match(/Chrome\/(\d+)/)?.[1],
      );
      expect(major).toBeGreaterThanOrEqual(149);
    }
  });

  describe.each([
    ['clicked in a navigate callback', 1, '/products'],
    ['clicked between startNavigation and endNavigation', 2, '/'],
    ['from a recording', 3, '/products'],
  ])('a soft navigation %s', (_, index, path) => {
    let step: Step;

    beforeAll(() => {
      step = steps[index];
    });

    it('is reported as a soft navigation', () => {
      expect(audit(step, 'soft-navigation')).toMatchObject({
        scoreDisplayMode: 'informative',
        details: { url: `${origin}${path}`, softNavigations: 1 },
      });
    });

    it('measures FCP and LCP from the interaction and has a performance score', () => {
      const fcp = audit(step, 'first-contentful-paint');
      const lcp = audit(step, 'largest-contentful-paint');

      expect(fcp.numericValue).toBeGreaterThan(0);
      expect(lcp.numericValue).toBeGreaterThan(fcp.numericValue as number);
      expect(step.lhr.categories['performance'].score).toEqual(
        expect.any(Number),
      );
    });

    it('scores every category without an audit failing', () => {
      expect(erroredAudits(step)).toEqual([]);
      expect(step.lhr.runWarnings).toEqual([]);
      for (const [id, category] of Object.entries(step.lhr.categories)) {
        expect(category.score, id).toEqual(expect.any(Number));
      }
    });

    it('is observed, with the throttling method of its step options', () => {
      expect(step.lhr.configSettings.throttlingMethod).toBe('devtools');
    });
  });

  describe.each([
    ['of the URL', 0],
    ['clicked in a navigate callback', 4],
  ])('a page load %s', (_, index) => {
    let step: Step;

    beforeAll(() => {
      step = steps[index];
    });

    it('is audited by stock Lighthouse', () => {
      expect(audit(step, 'soft-navigation').scoreDisplayMode).toBe(
        'notApplicable',
      );
      expect(erroredAudits(step)).toEqual([]);
      expect(step.lhr.runWarnings).toEqual([]);
      expect(step.lhr.configSettings.throttlingMethod).toBe('simulate');
    });
  });

  it('lists every step with its scores in the Markdown report', () => {
    const rows = markdown
      .split('\n')
      .filter((line) => line.startsWith('| Navigation report'));

    expect(rows).toHaveLength(5);
    for (const row of rows) {
      const [, , gatherMode, performance] = row
        .split('|')
        .map((cell) => cell.trim());
      expect(gatherMode).toBe('navigation');
      expect(Number(performance)).toBeGreaterThanOrEqual(0);
    }
  });
});
