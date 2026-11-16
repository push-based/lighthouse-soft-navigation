import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { startFlow } from 'lighthouse';
import puppeteer from 'puppeteer';
import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';
import { SCENARIOS, startApp } from './app/server.mjs';
import { installLanternChanges } from './lantern/install.mjs';
import { REAL_APPS } from './real-apps.mjs';
import { METRICS, RECORDINGS } from './paths.mjs';

/**
 * Records each target's soft navigation twice, each time in a fresh browser after loading the page:
 *
 * - `simulate`: recorded without throttling, as Lighthouse does for simulated throttling. Its
 *   artifacts are saved for `evaluate.mjs`, which runs Lantern on them.
 * - `devtools`: recorded with DevTools throttling. Its metrics are the reference.
 *
 * The trace also records `disabled-by-default-v8.inspector`, which change 3 reads. The process has
 * every Lantern change installed, so the `simulate` step's report shows them end to end.
 *
 * Usage: node record.mjs [--runs 3] [--only sequential,image] [--real]
 */

const { values } = parseArgs({
  options: {
    runs: { type: 'string', default: '3' },
    only: { type: 'string' },
    real: { type: 'boolean', default: false },
  },
});
const runs = Number(values.runs);
const only = values.only?.split(',');

installLanternChanges();

const app = values.real ? undefined : await startApp();
const targets = (
  values.real
    ? REAL_APPS
    : SCENARIOS.map((scenario) => ({
        id: scenario.id,
        url: app.urlOf(scenario),
        navigate: (page) => page.click('#go'),
      }))
).filter((target) => !only || only.includes(target.id));

try {
  for (const target of targets) {
    for (let run = 1; run <= runs; run++) {
      const dir = join(
        RECORDINGS,
        values.real ? 'real-apps' : 'fixture',
        target.id,
        String(run),
      );
      let result;
      try {
        result = await record(target);
      } catch (error) {
        // A site that does not produce a soft navigation, or changed, should not stop the others.
        console.log(
          `${target.id} #${run}: failed, ${error.code ?? error.message}`,
        );
        continue;
      }
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'artifacts.json'),
        JSON.stringify(result.artifacts),
      );
      writeFileSync(
        join(dir, 'report.json'),
        JSON.stringify(result.report, null, 2),
      );
      console.log(
        `${target.id} #${run}: devtools ${format(result.report.devtools)} | simulate ${format(result.report.simulate)}`,
      );
    }
  }
} finally {
  await app?.close();
}

/**
 * @param {{ id: string, url: string, navigate: (page: import('puppeteer').Page) => Promise<unknown> }} target
 */
async function record(target) {
  const simulate = await measure(target, 'simulate');
  const devtools = await measure(target, 'devtools');
  return {
    artifacts: simulate.artifacts,
    report: {
      url: target.url,
      simulate: metricsOf(simulate.lhr),
      observed: observedMetricsOf(simulate.lhr),
      devtools: metricsOf(devtools.lhr),
      softNavigations: {
        simulate:
          simulate.lhr.audits['soft-navigation']?.details?.softNavigations,
        devtools:
          devtools.lhr.audits['soft-navigation']?.details?.softNavigations,
      },
      errors: {
        simulate: errorsOf(simulate.lhr),
        devtools: errorsOf(devtools.lhr),
      },
    },
  };
}

/**
 * Loads the page and measures the click, in a browser of its own. Both measurements of a run then
 * start alike: without the connections or the HTTP cache of the other one, which would otherwise
 * make the second one faster. Browser contexts share connections, so a context is not enough.
 *
 * @param {{ url: string, navigate: (page: import('puppeteer').Page) => Promise<unknown> }} target
 * @param {'simulate' | 'devtools'} throttlingMethod
 */
async function measure(target, throttlingMethod) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--ignore-certificate-errors'],
  });
  const page = await browser.newPage();
  try {
    const flow = await startFlow(page, {
      config: softNavigationConfig(),
      flags: {
        additionalTraceCategories: 'disabled-by-default-v8.inspector',
        // Keeps the HTTP cache and the connections of the page load, as a user's next click would.
        disableStorageReset: true,
        // Real sites collapse their navigation on a phone screen, which would hide the link. The
        // throttling stays the default mobile one.
        ...(values.real && { screenEmulation: { disabled: true } }),
      },
    });
    // Real sites keep a request or two going in the background.
    await page.goto(target.url, {
      waitUntil: values.real ? 'networkidle2' : 'networkidle0',
      timeout: 60_000,
    });
    await flow.navigate(() => target.navigate(page), {
      name: throttlingMethod,
      throttlingMethod,
    });
    const { steps } = await flow.createFlowResult();
    const { gatherSteps } = flow.createArtifactsJson();
    return { lhr: steps[0].lhr, artifacts: gatherSteps[0].artifacts };
  } finally {
    await browser.close();
  }
}

/** @param {import('lighthouse').Result} lhr */
function metricsOf(lhr) {
  return Object.fromEntries(
    METRICS.map(({ id, audit }) => [
      id,
      lhr.audits[audit]?.numericValue ?? null,
    ]),
  );
}

/** The metrics of the unthrottled recording, before simulation. */
function observedMetricsOf(lhr) {
  const metrics = lhr.audits.metrics?.details?.items?.[0] ?? {};
  return {
    fcp: metrics.observedFirstContentfulPaint ?? null,
    lcp: metrics.observedLargestContentfulPaint ?? null,
    si: metrics.observedSpeedIndex ?? null,
  };
}

/** @param {import('lighthouse').Result} lhr */
function errorsOf(lhr) {
  return Object.fromEntries(
    METRICS.map(({ audit }) => lhr.audits[audit])
      .filter((audit) => audit?.scoreDisplayMode === 'error')
      .map((audit) => [audit.id, audit.errorMessage]),
  );
}

function format(metrics) {
  return METRICS.map(
    ({ id }) => `${id} ${metrics[id] === null ? '—' : Math.round(metrics[id])}`,
  ).join(' ');
}
