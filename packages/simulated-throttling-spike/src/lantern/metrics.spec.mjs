import * as Lantern from 'lighthouse/core/lib/lantern/lantern.js';
import { describe, expect, it } from 'vitest';
import { softNavigationPaintGraph } from './metrics.mjs';

const { CPUNode, NetworkNode } = Lantern.Graph;

function task(ts, dur, children = []) {
  return new CPUNode({ name: 'RunTask', tid: 1, ts, dur, args: {} }, children);
}

function request(requestId, start, end, resourceType = 'Fetch') {
  return new NetworkNode({
    requestId,
    url: `https://example.com/${requestId}`,
    rendererStartTime: start,
    networkRequestTime: start,
    networkEndTime: end,
    resourceType,
    priority: 'High',
    initiator: { type: 'script' },
  });
}

const paint = { name: 'Paint' };

/** The ids of the nodes in a graph. */
function ids(graph) {
  const found = [];
  graph.getRootNode().traverse((node) => found.push(node.id));
  return found.sort();
}

describe('softNavigationPaintGraph', () => {
  // The click requests the view's data, renders it and paints. Before the paint, an unrelated task
  // runs too, and after it, a later request and its paint.
  const root = task(0, 1000);
  const data = request('data', 1, 50);
  const render = task(51_000, 2000);
  const viewPaint = task(54_000, 1000, [paint]);
  const unrelated = task(20_000, 5000);
  const later = request('later', 60, 200);
  const laterPaint = task(201_000, 1000, [paint]);
  data.addDependency(root);
  render.addDependency(data);
  viewPaint.addDependency(render);
  unrelated.addDependency(root);
  later.addDependency(render);
  laterPaint.addDependency(later);

  it('is the last paint before the metric, what it depends on, and the tasks that ran before it', () => {
    expect(
      ids(softNavigationPaintGraph(root, 56_000, { images: false })),
    ).toEqual(
      [root, data, render, viewPaint, unrelated].map((node) => node.id).sort(),
    );
  });

  it('includes an image that finished before the LCP', () => {
    const image = request('image', 60, 150, 'Image');
    image.addDependency(render);
    const graph = softNavigationPaintGraph(root, 160_000, { images: true });
    expect(ids(graph)).toContain('image');
    expect(ids(graph)).not.toContain('later');
    image.removeDependency(render);
  });
});
