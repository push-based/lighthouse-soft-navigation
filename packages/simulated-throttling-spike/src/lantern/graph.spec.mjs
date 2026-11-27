import * as Lantern from 'lighthouse/core/lib/lantern/lantern.js';
import { describe, expect, it } from 'vitest';
import {
  asyncTaskFlows,
  findSoftNavigationStart,
  isSoftNavigationGraph,
  linkAsyncTasks,
  linkRenderTasks,
  linkTaskRequests,
  pruneShortTasks,
} from './graph.mjs';

const { CPUNode, NetworkNode } = Lantern.Graph;

/** A task from `ts` to `ts + dur`, in µs, with the given child events. */
function task(ts, dur, children = []) {
  return new CPUNode({ name: 'RunTask', tid: 1, ts, dur, args: {} }, children);
}

/** A request from `start` to `end`, in ms like Lantern's network requests. */
function request(requestId, start, end, resourceType = 'Fetch') {
  return new NetworkNode({
    requestId,
    url: `https://example.com/${requestId}`,
    rendererStartTime: start,
    networkRequestTime: start,
    networkEndTime: end,
    resourceType,
    initiator: { type: 'script' },
  });
}

function output(...nodes) {
  return { idToNodeMap: new Map(nodes.map((node) => [node.id, node])) };
}

const send = (ts, requestId) => ({
  name: 'ResourceSendRequest',
  ph: 'I',
  ts,
  args: { data: { requestId } },
});
const scheduled = (ts, id, ph) => ({
  name: 'v8::Debugger::AsyncTaskScheduled',
  ph,
  ts,
  id,
  args: {},
});

describe('findSoftNavigationStart', () => {
  it('returns the first SoftNavigationStart', () => {
    expect(
      findSoftNavigationStart([
        { name: 'RunTask', ts: 1 },
        { name: 'SoftNavigationStart', ts: 5 },
        { name: 'SoftNavigationStart', ts: 9 },
      ]),
    ).toBe(5);
  });

  it('returns undefined for a page load', () => {
    expect(
      findSoftNavigationStart([{ name: 'RunTask', ts: 1 }]),
    ).toBeUndefined();
  });
});

describe('isSoftNavigationGraph', () => {
  it('tells a graph rooted at a task from one rooted at a request', () => {
    expect(isSoftNavigationGraph(task(0, 10))).toBe(true);
    expect(isSoftNavigationGraph(request('document', 0, 1))).toBe(false);
  });
});

describe('asyncTaskFlows', () => {
  it('pairs where an async task was scheduled with where it ran', () => {
    const click = task(0, 1000, [scheduled(500, '0x1', 's')]);
    const continuation = task(60_000, 500, [scheduled(60_010, '0x1', 'f')]);
    expect(asyncTaskFlows([click, continuation])).toEqual([
      { scheduler: click, scheduledAt: 500, runner: continuation },
    ]);
  });

  it('ignores an async task that ran in the task that scheduled it', () => {
    const click = task(0, 1000, [
      scheduled(10, '0x1', 's'),
      scheduled(20, '0x1', 'f'),
    ]);
    expect(asyncTaskFlows([click])).toEqual([]);
  });
});

describe('linkAsyncTasks', () => {
  it('makes the continuation of a fetch depend on the fetch and its task', () => {
    const route = request('route', 1, 55);
    const click = task(0, 1000, [
      send(400, 'route'),
      scheduled(500, '0x1', 's'),
    ]);
    const continuation = task(56_000, 500, [scheduled(56_010, '0x1', 'f')]);

    linkAsyncTasks([click, continuation], output(route));

    expect(continuation.getDependencies()).toEqual([click, route]);
  });

  it('leaves out a request that was still loading when the continuation ran', () => {
    const slow = request('slow', 1, 900);
    const click = task(0, 1000, [
      send(400, 'slow'),
      scheduled(500, '0x1', 's'),
    ]);
    const continuation = task(56_000, 500, [scheduled(56_010, '0x1', 'f')]);

    linkAsyncTasks([click, continuation], output(slow));

    expect(continuation.getDependencies()).toEqual([click]);
  });

  it('leaves out a request sent after the async task was scheduled', () => {
    const later = request('later', 1, 10);
    const click = task(0, 1000, [
      scheduled(300, '0x1', 's'),
      send(400, 'later'),
    ]);
    const continuation = task(56_000, 500, [scheduled(56_010, '0x1', 'f')]);

    linkAsyncTasks([click, continuation], output(later));

    expect(continuation.getDependencies()).toEqual([click]);
  });
});

describe('linkTaskRequests', () => {
  it('makes an image depend on the task that requested it', () => {
    const image = request('image', 57, 300, 'Image');
    const render = task(56_000, 500, [send(56_400, 'image')]);

    linkTaskRequests([render], output(image));

    expect(image.getDependencies()).toEqual([render]);
  });
});

describe('linkRenderTasks', () => {
  it('makes a paint depend on the last task that changed the view', () => {
    const update = task(1000, 100, [
      { name: 'ScheduleStyleRecalculation', ts: 1050 },
    ]);
    const unrelated = task(1200, 100);
    const paint = task(1400, 100, [{ name: 'Paint', ts: 1450 }]);

    linkRenderTasks([paint, unrelated, update]);

    expect(paint.getDependencies()).toEqual([update]);
    expect(unrelated.getDependencies()).toEqual([]);
  });
});

describe('pruneShortTasks', () => {
  it('keeps a short paint when asked to, and prunes it otherwise', () => {
    const root = task(0, 100);
    const firstPaint = task(200, 100, [{ name: 'Paint', ts: 250 }]);
    const secondPaint = task(400, 100, [{ name: 'Paint', ts: 450 }]);
    // Long enough to be kept.
    const after = task(600, 20_000);
    firstPaint.addDependency(root);
    secondPaint.addDependency(root);
    after.addDependency(secondPaint);

    pruneShortTasks([firstPaint, secondPaint, after], {
      keepRenderTasks: true,
    });
    expect(after.getDependencies()).toEqual([secondPaint]);

    pruneShortTasks([firstPaint, secondPaint], { keepRenderTasks: false });
    expect(after.getDependencies()).toEqual([root]);
  });
});
