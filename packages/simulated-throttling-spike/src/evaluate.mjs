import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { LanternFirstContentfulPaint } from 'lighthouse/core/computed/metrics/lantern-first-contentful-paint.js';
import { LanternInteractive } from 'lighthouse/core/computed/metrics/lantern-interactive.js';
import { LanternLargestContentfulPaint } from 'lighthouse/core/computed/metrics/lantern-largest-contentful-paint.js';
import { LanternSpeedIndex } from 'lighthouse/core/computed/metrics/lantern-speed-index.js';
import { LanternTotalBlockingTime } from 'lighthouse/core/computed/metrics/lantern-total-blocking-time.js';
import { CONFIGURATIONS, installLanternChanges } from './lantern/install.mjs';
import { summarize } from './evaluate-summary.mjs';
import { METRICS, RECORDINGS, RESULTS } from './paths.mjs';

/**
 * Runs Lantern on every recording of `record.mjs`, once per configuration of the changes, and
 * compares each metric with the same soft navigation under DevTools throttling.
 *
 * Usage: node evaluate.mjs [--set fixture|real-apps] [--only sequential,image]
 *   [--configurations root,all]
 *
 * Writes `results/<set>.json` with every value, and prints a summary.
 */

const { values } = parseArgs({
  options: {
    set: { type: 'string', default: 'fixture' },
    only: { type: 'string' },
    configurations: { type: 'string' },
  },
});
const only = values.only?.split(',');
const configurations =
  values.configurations?.split(',') ?? Object.keys(CONFIGURATIONS);
const unknown = configurations.filter(
  (name) => !Object.hasOwn(CONFIGURATIONS, name),
);
if (unknown.length) {
  throw new Error(
    `Unknown configuration ${unknown.join(', ')}. Known: ${Object.keys(CONFIGURATIONS).join(', ')}`,
  );
}

const LANTERN = {
  fcp: LanternFirstContentfulPaint,
  lcp: LanternLargestContentfulPaint,
  si: LanternSpeedIndex,
  tbt: LanternTotalBlockingTime,
  tti: LanternInteractive,
};

const recordings = join(RECORDINGS, values.set);
const targets = readdirSync(recordings).filter(
  (id) => !only || only.includes(id),
);

/** @type {Array<object>} */
const rows = [];
for (const target of targets) {
  const runs = readdirSync(join(recordings, target)).filter((run) =>
    existsSync(join(recordings, target, run, 'artifacts.json')),
  );
  for (const run of runs) {
    const dir = join(recordings, target, run);
    const artifacts = JSON.parse(
      readFileSync(join(dir, 'artifacts.json'), 'utf8'),
    );
    const report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'));
    const row = {
      target,
      run: Number(run),
      reference: report.devtools,
      observed: report.observed,
      lantern: {},
      errors: {},
    };
    for (const configuration of configurations) {
      const restore = installLanternChanges(CONFIGURATIONS[configuration]);
      try {
        const result = await lanternMetrics(artifacts);
        row.lantern[configuration] = result.values;
        if (Object.keys(result.errors).length)
          row.errors[configuration] = result.errors;
      } finally {
        restore();
      }
    }
    rows.push(row);
  }
}

mkdirSync(RESULTS, { recursive: true });
writeFileSync(
  join(RESULTS, `${values.set}.json`),
  JSON.stringify({ configurations: CONFIGURATIONS, rows }, null, 2) + '\n',
);
console.log(summarize(rows, configurations));

/** Lighthouse's own Lantern metrics for the recording, as the step's audits compute them. */
async function lanternMetrics(artifacts) {
  const data = {
    trace: artifacts.Trace,
    devtoolsLog: artifacts.DevtoolsLog,
    gatherContext: artifacts.GatherContext,
    settings: { ...artifacts.settings, throttlingMethod: 'simulate' },
    URL: artifacts.URL,
    SourceMaps: artifacts.SourceMaps,
    HostDPR: artifacts.HostDPR,
    simulator: null,
  };
  const context = { computedCache: new Map() };
  const values = {};
  const errors = {};
  for (const { id } of METRICS) {
    try {
      values[id] = (await LANTERN[id].request(data, context)).timing;
    } catch (error) {
      values[id] = null;
      errors[id] = error.code ?? error.message;
    }
  }
  return { values, errors };
}
