import * as Lantern from 'lighthouse/core/lib/lantern/lantern.js';

/**
 * Changes 1, 2 and 3: the graph of a soft navigation.
 *
 * Upstream these are changes to `graph/PageDependencyGraph.ts` in Lantern. Here they replace
 * `PageDependencyGraph.createGraph` and `linkNetworkNodes` at runtime, so Lighthouse's own
 * computed artifacts use them.
 */

const { BaseNode, PageDependencyGraph } = Lantern.Graph;
const { LanternError } = Lantern.Core;

/** Child events of a task that change what is rendered. */
const RENDER_INVALIDATIONS = new Set([
  'ScheduleStyleRecalculation',
  'InvalidateLayout',
]);

/**
 * A soft navigation graph is rooted at a task. Page load graphs are rooted at the document
 * request, so the root tells the two apart, also in the clones the metrics simulate.
 *
 * @param {Lantern.Graph.Node} graph
 */
export function isSoftNavigationGraph(graph) {
  return graph.getRootNode().type === BaseNode.types.CPU;
}

/**
 * Lighthouse change 5, stood in for: the start of the soft navigation of the step. Upstream,
 * Lighthouse passes it from the `ProcessedNavigation` of the soft navigation; here it comes from
 * the first `SoftNavigationStart` on the main thread, the one the package measures.
 *
 * @param {Array<{name: string, ts: number}>} mainThreadEvents
 * @return {number | undefined} Trace timestamp, in µs.
 */
export function findSoftNavigationStart(mainThreadEvents) {
  return mainThreadEvents.find((event) => event.name === 'SoftNavigationStart')
    ?.ts;
}

/**
 * `linkNetworkNodes` with a root that may be a task. The stock version reads `rootNode.request`
 * when a request has no initiator, which only a request has. For a request root it does exactly
 * what the stock version does.
 */
function linkNetworkNodes(rootNode, networkNodeOutput) {
  for (const node of networkNodeOutput.nodes) {
    const initiatorRequest = node.request.initiatorRequest;
    const directInitiatorNode =
      (initiatorRequest &&
        networkNodeOutput.idToNodeMap.get(initiatorRequest.requestId)) ||
      rootNode;
    const canDependOnInitiator =
      !directInitiatorNode.isDependentOn(node) &&
      node.canDependOn(directInitiatorNode);
    const initiators = PageDependencyGraph.getNetworkInitiators(node.request);
    if (initiators.length) {
      for (const initiator of initiators) {
        const parentCandidates =
          networkNodeOutput.urlToNodeMap.get(initiator) || [];
        if (
          parentCandidates.length === 1 &&
          parentCandidates[0].startTime <= node.startTime &&
          !parentCandidates[0].isDependentOn(node)
        ) {
          node.addDependency(parentCandidates[0]);
        } else if (canDependOnInitiator) {
          directInitiatorNode.addDependent(node);
        }
      }
    } else if (canDependOnInitiator) {
      directInitiatorNode.addDependent(node);
    }

    if (
      node !== rootNode &&
      node.getDependencies().length === 0 &&
      node.canDependOn(rootNode)
    ) {
      node.addDependency(rootNode);
    }

    if (!node.request.redirects) continue;
    const redirects = [...node.request.redirects, node.request];
    for (let i = 1; i < redirects.length; i++) {
      const redirectNode = networkNodeOutput.idToNodeMap.get(
        redirects[i - 1].requestId,
      );
      const actualNode = networkNodeOutput.idToNodeMap.get(
        redirects[i].requestId,
      );
      if (actualNode && redirectNode) actualNode.addDependency(redirectNode);
    }
  }
}

/**
 * Change 1: the graph of a soft navigation, rooted at the input that started it.
 *
 * The root is the first task that was still running at `SoftNavigationStart`, which Chrome sets to
 * the time of the input. In every recording of the spike that is a task of a few µs, up to 2 ms,
 * that ran as the input arrived, not the task that dispatched the click. That one starts up to
 * 2 ms later and is usually under 10 ms, so it is pruned, and what it started depends on the root
 * instead. Requests and tasks from before the root belong to the page load and are left out.
 * There is no main document request.
 *
 * @param {Array<object>} mainThreadEvents
 * @param {Array<object>} networkRequests Lantern network requests.
 * @param {number} softNavigationStart Trace timestamp, in µs.
 * @param {Flags} flags
 */
export function createSoftNavigationGraph(
  mainThreadEvents,
  networkRequests,
  softNavigationStart,
  flags,
) {
  const tasks = PageDependencyGraph.getCPUNodes(mainThreadEvents);
  const rootNode = tasks.find((task) => task.endTime >= softNavigationStart);
  if (!rootNode) throw new LanternError('softNavigationTask not found');

  const cpuNodes = tasks.filter((task) => task.startTime > rootNode.startTime);
  const requests = networkRequests.filter(
    (request) => request.rendererStartTime * 1000 >= rootNode.startTime,
  );
  const networkNodeOutput = PageDependencyGraph.getNetworkNodeOutput(requests);

  linkNetworkNodes(rootNode, networkNodeOutput);

  // `linkCPUNodes` ends by pruning tasks under 10 ms, which rewires the graph around them. The
  // tasks of a soft navigation are mostly that short, and the links below are between them, so
  // the pruning waits until every link is in.
  const pruneNode = PageDependencyGraph.pruneNode;
  PageDependencyGraph.pruneNode = () => {};
  try {
    // Without the root: a task that depends on nothing is linked to the root, which the root
    // cannot be to itself.
    PageDependencyGraph.linkCPUNodes(rootNode, networkNodeOutput, cpuNodes);
  } finally {
    PageDependencyGraph.pruneNode = pruneNode;
  }

  const allTasks = [rootNode, ...cpuNodes];
  if (flags.taskRequests) linkTaskRequests(allTasks, networkNodeOutput);
  if (flags.fetchChains) linkAsyncTasks(allTasks, networkNodeOutput);
  if (flags.paintGraph) linkRenderTasks(allTasks);

  if (!flags.keepShortTasks) {
    pruneShortTasks(cpuNodes, { keepRenderTasks: flags.paintGraph });
  }

  if (BaseNode.findCycle(rootNode)) {
    throw new LanternError('Invalid dependency graph created, cycle detected');
  }
  return rootNode;
}

/** Lantern's `SIGNIFICANT_DUR_THRESHOLD_MS`. */
const SIGNIFICANT_DURATION = 10 * 1000;

/**
 * The pruning at the end of `linkCPUNodes`, run after every link is in: a task under 10 ms is
 * removed, and its dependents depend on its dependencies instead, unless it is the first layout,
 * paint or parse, or too connected to rewire cheaply.
 *
 * With the paint graph, a task that paints is kept as well, because the FCP and LCP graphs are
 * built from it.
 *
 * @param {Array<Lantern.Graph.CPUNode>} cpuNodes
 * @param {{ keepRenderTasks: boolean }} options
 */
export function pruneShortTasks(cpuNodes, { keepRenderTasks }) {
  const found = { Layout: false, Paint: false, ParseHTML: false };
  for (const node of cpuNodes) {
    let isFirst = false;
    for (const name of /** @type {const} */ ([
      'Layout',
      'Paint',
      'ParseHTML',
    ])) {
      if (
        !found[name] &&
        node.childEvents.some((event) => event.name === name)
      ) {
        isFirst = found[name] = true;
      }
    }
    if (isFirst || node.duration >= SIGNIFICANT_DURATION) continue;
    if (keepRenderTasks && isRenderTask(node)) continue;
    if (
      node.getNumberOfDependencies() === 1 ||
      node.getNumberOfDependents() <= 1
    ) {
      PageDependencyGraph.pruneNode(node);
    }
  }
}

/**
 * The async task flows between tasks: V8 reports where a promise reaction or another async task
 * was scheduled and where it ran, with `v8::Debugger::AsyncTaskScheduled` flow events. They are
 * recorded when async stack traces are on (Lighthouse turns them on for every step) and the trace
 * has the `disabled-by-default-v8.inspector` category.
 *
 * @param {Array<Lantern.Graph.CPUNode>} tasks
 * @return {Array<{scheduler: Lantern.Graph.CPUNode, scheduledAt: number, runner: Lantern.Graph.CPUNode}>}
 */
export function asyncTaskFlows(tasks) {
  /** @type {Map<string, {task: Lantern.Graph.CPUNode, ts: number}>} */
  const scheduled = new Map();
  const flows = [];
  for (const task of tasks) {
    for (const event of task.childEvents) {
      if (event.name !== 'v8::Debugger::AsyncTaskScheduled') continue;
      const id = String(event.id ?? event.id2?.local ?? event.id2?.global);
      if (event.ph === 's') {
        scheduled.set(id, { task, ts: event.ts });
      } else if (event.ph === 'f') {
        const from = scheduled.get(id);
        if (from && from.task !== task) {
          flows.push({
            scheduler: from.task,
            scheduledAt: from.ts,
            runner: task,
          });
        }
      }
    }
  }
  return flows;
}

/**
 * Change 3: a task that continues after an async task depends on the task that scheduled it, and
 * on the requests that task sent before scheduling it and that had finished when it ran. That is
 * the `fetch` it awaited, and the requests a `Promise.all` waited for.
 *
 * A request the task sent without waiting for it is linked too when it happened to finish first.
 * The flow does not say which promise was awaited.
 */
export function linkAsyncTasks(tasks, networkNodeOutput) {
  for (const { scheduler, scheduledAt, runner } of asyncTaskFlows(tasks)) {
    if (!scheduler.isDependentOn(runner)) runner.addDependency(scheduler);
    for (const event of scheduler.childEvents) {
      if (event.name !== 'ResourceSendRequest' || event.ts > scheduledAt) {
        continue;
      }
      const request = networkNodeOutput.idToNodeMap.get(
        event.args.data.requestId,
      );
      if (!request || request.endTime > runner.startTime) continue;
      if (request.isDependentOn(runner)) continue;
      runner.addDependency(request);
    }
  }
}

/**
 * Change 3, second part: a request depends on the task that sent it, whatever its type. Lantern
 * only links `fetch`, XHR and script requests to their task, which leaves an image that a view
 * inserted hanging off the root.
 */
export function linkTaskRequests(tasks, networkNodeOutput) {
  for (const task of tasks) {
    for (const event of task.childEvents) {
      if (event.name !== 'ResourceSendRequest') continue;
      const request = networkNodeOutput.idToNodeMap.get(
        event.args.data.requestId,
      );
      if (!request || request.startTime <= task.startTime) continue;
      if (task.isDependentOn(request)) continue;
      task.addDependent(request);
    }
  }
}

/**
 * Change 2, first part: a task that renders depends on the last task before it that changed what
 * is rendered. Without it, the paint of a view hangs off the root, however late its content
 * arrived.
 */
export function linkRenderTasks(tasks) {
  let lastInvalidation;
  for (const task of [...tasks].sort((a, b) => a.startTime - b.startTime)) {
    if (
      lastInvalidation &&
      isRenderTask(task) &&
      !lastInvalidation.isDependentOn(task)
    ) {
      task.addDependency(lastInvalidation);
    }
    if (
      task.childEvents.some((event) => RENDER_INVALIDATIONS.has(event.name))
    ) {
      lastInvalidation = task;
    }
  }
}

/** @param {Lantern.Graph.CPUNode} task */
export function isRenderTask(task) {
  return task.childEvents.some((event) => event.name === 'Paint');
}

/**
 * @typedef {{
 *   root: boolean,
 *   fetchChains: boolean,
 *   taskRequests: boolean,
 *   paintGraph: boolean,
 *   warmConnections: boolean,
 *   h2Ttfb: boolean,
 *   coldRequests: boolean,
 *   keepShortTasks: boolean,
 * }} Flags
 */

/**
 * Replaces `createGraph` so that a step with a soft navigation gets a soft navigation graph.
 *
 * @param {Flags} flags
 * @return {() => void} Restores the stock functions.
 */
export function installGraph(flags) {
  const createGraph = PageDependencyGraph.createGraph;
  const stockLinkNetworkNodes = PageDependencyGraph.linkNetworkNodes;

  PageDependencyGraph.linkNetworkNodes = linkNetworkNodes;
  PageDependencyGraph.createGraph = function (
    mainThreadEvents,
    networkRequests,
    url,
    options,
  ) {
    const start =
      options?.softNavigationStart ?? findSoftNavigationStart(mainThreadEvents);
    if (!flags.root || start === undefined) {
      return createGraph.call(this, mainThreadEvents, networkRequests, url);
    }
    return createSoftNavigationGraph(
      mainThreadEvents,
      networkRequests,
      start,
      flags,
    );
  };

  return () => {
    PageDependencyGraph.createGraph = createGraph;
    PageDependencyGraph.linkNetworkNodes = stockLinkNetworkNodes;
  };
}
