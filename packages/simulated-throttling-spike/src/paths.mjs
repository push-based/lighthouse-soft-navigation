import { join } from 'node:path';

const workspace = join(import.meta.dirname, '../../..');

/** Recordings are large, so they live in the ignored `tmp` folder of the workspace. */
export const RECORDINGS = join(workspace, 'tmp/simulated-throttling-spike');

/** The results that are committed with the spike. */
export const RESULTS = join(import.meta.dirname, '../results');

/** The metrics compared, by the id of their audit. */
export const METRICS = [
  { id: 'fcp', audit: 'first-contentful-paint' },
  { id: 'lcp', audit: 'largest-contentful-paint' },
  { id: 'si', audit: 'speed-index' },
  { id: 'tbt', audit: 'total-blocking-time' },
  { id: 'tti', audit: 'interactive' },
];
