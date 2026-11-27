import * as Lantern from 'lighthouse/core/lib/lantern/lantern.js';
import { isRenderTask, isSoftNavigationGraph } from './graph.mjs';

/**
 * Change 2, second part: the graph a paint of a soft navigation waited for.
 *
 * Upstream this is a change to `metrics/FirstContentfulPaint.ts` and
 * `metrics/LargestContentfulPaint.ts`. Here it wraps their graph functions at runtime, and only
 * acts on the graph of a soft navigation.
 */

const { BaseNode } = Lantern.Graph;
const { FirstContentfulPaint, LargestContentfulPaint } = Lantern.Metrics;
const { LanternError } = Lantern.Core;

/**
 * The paint and everything it depends on: the last task that rendered before the paint was
 * reported, which `linkRenderTasks` made depend on the task that changed the view, which in turn
 * depends on the requests it waited for. Every task that ran before that paint is part of it too.
 *
 * For the LCP, the images that finished before it are added with their own dependencies, since an
 * image paints in a task that does not depend on its request.
 *
 * Lantern's page load rule, the requests that would have blocked the parser, does not apply: the
 * document was parsed long before.
 *
 * @param {Lantern.Graph.Node} graph
 * @param {number} cutoff Trace timestamp of the paint, in µs.
 * @param {{ images: boolean }} options
 */
export function softNavigationPaintGraph(graph, cutoff, { images }) {
  const root = graph.getRootNode();
  let paintTask;
  root.traverse((node) => {
    if (node.type !== BaseNode.types.CPU) return;
    if (node.startTime > cutoff || !isRenderTask(node)) return;
    if (!paintTask || node.startTime > paintTask.startTime) paintTask = node;
  });

  // The main thread runs one task at a time, so the paint also waited for every task that ran
  // before it, whether the view needed it or not. On sites whose data was prefetched, that work is
  // most of the soft navigation.
  const paintedAt = paintTask?.startTime ?? -Infinity;
  return root.cloneWithRelationships(
    (node) =>
      node === root ||
      node === paintTask ||
      (node.type === BaseNode.types.CPU && node.endTime <= paintedAt) ||
      (images &&
        node.type === BaseNode.types.NETWORK &&
        node.request.resourceType === 'Image' &&
        node.endTime <= cutoff &&
        LargestContentfulPaint.isNotLowPriorityImageNode(node)),
  );
}

/**
 * @return {() => void} Restores the stock methods.
 */
export function installMetrics() {
  const fcp = {
    optimistic: FirstContentfulPaint.getOptimisticGraph,
    pessimistic: FirstContentfulPaint.getPessimisticGraph,
  };
  const lcp = {
    optimistic: LargestContentfulPaint.getOptimisticGraph,
    pessimistic: LargestContentfulPaint.getPessimisticGraph,
  };

  for (const kind of /** @type {const} */ (['optimistic', 'pessimistic'])) {
    const name =
      kind === 'optimistic' ? 'getOptimisticGraph' : 'getPessimisticGraph';

    FirstContentfulPaint[name] = function (graph, processedNavigation) {
      if (!isSoftNavigationGraph(graph)) {
        return fcp[kind].call(this, graph, processedNavigation);
      }
      return softNavigationPaintGraph(
        graph,
        processedNavigation.timestamps.firstContentfulPaint,
        { images: false },
      );
    };

    LargestContentfulPaint[name] = function (graph, processedNavigation) {
      if (!isSoftNavigationGraph(graph)) {
        return lcp[kind].call(this, graph, processedNavigation);
      }
      const { largestContentfulPaint } = processedNavigation.timestamps;
      if (!largestContentfulPaint) throw new LanternError('NO_LCP');
      return softNavigationPaintGraph(graph, largestContentfulPaint, {
        images: true,
      });
    };
  }

  return () => {
    FirstContentfulPaint.getOptimisticGraph = fcp.optimistic;
    FirstContentfulPaint.getPessimisticGraph = fcp.pessimistic;
    LargestContentfulPaint.getOptimisticGraph = lcp.optimistic;
    LargestContentfulPaint.getPessimisticGraph = lcp.pessimistic;
  };
}
