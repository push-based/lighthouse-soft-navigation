import { installGraph } from './graph.mjs';
import { installMetrics } from './metrics.mjs';
import { installSimulation } from './simulation.mjs';

/**
 * The changes of `docs/simulated-throttling.md`, each switchable, so that its effect can be measured
 * on its own:
 *
 * - `root` (change 1): the graph starts at the task of the interaction.
 * - `fetchChains` (change 3): a task that continues after a `fetch` depends on it.
 * - `taskRequests` (change 3): a request of any type depends on the task that sent it.
 * - `paintGraph` (change 2): a paint depends on the task that changed the view, and the FCP and LCP
 *   graphs are that paint and what it depends on.
 * - `warmConnections` (change 4): connections the page load opened are warm.
 * - `h2Ttfb` (change 4): a request on a warm HTTP/2 connection pays a time to first byte unless it
 *   was sent while another was in flight.
 * - `keepShortTasks` (change 1): tasks under 10 ms stay in the graph. Lantern prunes them, and most
 *   of the work of a soft navigation is in tasks that short.
 * - `coldRequests` (for comparison with change 4): every request is simulated as the first on a new
 *   connection, the way DevTools throttling adds the same latency to every request.
 *
 * @typedef {import('./graph.mjs').Flags} Flags
 */

/** Configurations in the order the changes build on each other. */
export const CONFIGURATIONS = /** @type {const} */ ({
  stock: {},
  root: { root: true },
  'root+chains': { root: true, fetchChains: true, taskRequests: true },
  'root+chains+paint': {
    root: true,
    fetchChains: true,
    taskRequests: true,
    paintGraph: true,
  },
  'root+chains+paint+warm': {
    root: true,
    fetchChains: true,
    taskRequests: true,
    paintGraph: true,
    warmConnections: true,
  },
  all: {
    root: true,
    fetchChains: true,
    taskRequests: true,
    paintGraph: true,
    warmConnections: true,
    h2Ttfb: true,
  },
  'all+short': {
    root: true,
    fetchChains: true,
    taskRequests: true,
    paintGraph: true,
    warmConnections: true,
    h2Ttfb: true,
    keepShortTasks: true,
  },
  'root+chains+paint+cold': {
    root: true,
    fetchChains: true,
    taskRequests: true,
    paintGraph: true,
    coldRequests: true,
  },
  // Each change left out of `all` once.
  'all-but-chains': {
    root: true,
    paintGraph: true,
    warmConnections: true,
    h2Ttfb: true,
  },
  'all-but-paint': {
    root: true,
    fetchChains: true,
    taskRequests: true,
    warmConnections: true,
    h2Ttfb: true,
  },
  'all-but-warm': {
    root: true,
    fetchChains: true,
    taskRequests: true,
    paintGraph: true,
    h2Ttfb: true,
  },
});

/**
 * Installs the changes into the Lantern that Lighthouse uses, for the whole process.
 *
 * @param {Partial<Flags>} [partial] By default `all-but-warm`, which came closest to DevTools
 *   throttling.
 * @return {() => void} Restores stock Lantern.
 */
export function installLanternChanges(
  partial = CONFIGURATIONS['all-but-warm'],
) {
  /** @type {Flags} */
  const flags = {
    root: false,
    fetchChains: false,
    taskRequests: false,
    paintGraph: false,
    warmConnections: false,
    h2Ttfb: false,
    coldRequests: false,
    keepShortTasks: false,
    ...partial,
  };
  const restore = [installGraph(flags), installSimulation(flags)];
  if (flags.paintGraph) restore.push(installMetrics());
  return () => {
    for (const undo of restore.reverse()) undo();
  };
}
