import * as Lantern from 'lighthouse/core/lib/lantern/lantern.js';
import { isSoftNavigationGraph } from './graph.mjs';

/**
 * Change 4: start a soft navigation with the connections the page already has.
 *
 * Upstream these are changes to `simulation/Simulator.ts`, `simulation/ConnectionPool.ts` and
 * `simulation/TCPConnection.ts`. Here they wrap the stock methods at runtime, and only act on the
 * graph of a soft navigation.
 */

const { Simulator, TCPConnection } = Lantern.Simulation;
const { NetworkAnalyzer } = Lantern.Core;
const { BaseNode } = Lantern.Graph;

/**
 * The origins the page had a connection to before the soft navigation. Chrome reports
 * `connectionReused` on the first request of the step to such an origin, because the page load
 * opened the connection.
 *
 * `ConnectionPool` does not read `connectionReused` at all: it forces its own estimate, which
 * counts the first request to each origin as a new connection. For a page load that is right,
 * since nothing was open before the document request.
 *
 * @param {Array<Lantern.Types.NetworkRequest>} requests
 * @return {Set<string>}
 */
export function warmOrigins(requests) {
  const warm = new Set();
  for (const [origin, originRequests] of NetworkAnalyzer.groupByOrigin(
    requests,
  )) {
    const first = originRequests.reduce((a, b) =>
      a.networkRequestTime <= b.networkRequestTime ? a : b,
    );
    if (first.connectionReused) warm.add(origin);
  }
  return warm;
}

/**
 * Whether a request on a multiplexed connection was sent while another request to its origin was
 * in flight, in the recording. Lantern charges a warm HTTP/2 connection no time to first byte, as
 * if every request rode along with one already under way. That holds for requests sent together,
 * not for one sent after the previous response, which is the case GoogleChrome/lighthouse#15897
 * describes for module imports, and the common case of a soft navigation.
 *
 * @param {Lantern.Types.NetworkRequest} request
 * @param {Array<Lantern.Types.NetworkRequest>} originRequests
 */
export function sentWhileAnotherWasInFlight(request, originRequests) {
  return originRequests.some(
    (other) =>
      other !== request &&
      other.networkRequestTime < request.networkRequestTime &&
      request.networkRequestTime < other.networkEndTime,
  );
}

/**
 * `coldRequests` is the opposite of `warmConnections`, for comparison: every request of the soft
 * navigation is simulated as the first on a new connection, DNS lookup included. That is close to
 * what DevTools throttling does, which adds the same latency to every request.
 *
 * @param {{ warmConnections: boolean, h2Ttfb: boolean, coldRequests: boolean }} flags
 * @return {() => void} Restores the stock methods.
 */
export function installSimulation(flags) {
  const initializeConnectionPool = Simulator.prototype.initializeConnectionPool;
  const estimateNetworkTimeRemaining =
    Simulator.prototype.estimateNetworkTimeRemaining;
  const updateProgressMadeInTimePeriod =
    Simulator.prototype.updateProgressMadeInTimePeriod;
  const simulateDownloadUntil = TCPConnection.prototype.simulateDownloadUntil;

  Simulator.prototype.initializeConnectionPool = function (graph) {
    initializeConnectionPool.call(this, graph);
    this.softNavigationTtfb = undefined;
    this.coldRequests = false;
    if (!isSoftNavigationGraph(graph)) return;

    /** @type {Array<Lantern.Types.NetworkRequest>} */
    const requests = [];
    graph.getRootNode().traverse((node) => {
      if (node.type === BaseNode.types.NETWORK) requests.push(node.request);
    });

    if (flags.warmConnections) {
      for (const origin of warmOrigins(requests)) {
        for (const connection of this.connectionPool.connectionsByOrigin.get(
          origin,
        ) ?? []) {
          connection.setWarmed(true);
        }
      }
    }

    if (flags.coldRequests) {
      // Every request pays a DNS lookup, as on a connection that was never used.
      this.dns.getTimeUntilResolution = () =>
        this.dns.rtt * Lantern.Simulation.DNSCache.rttMultiplier;
      this.coldRequests = true;
    }

    if (flags.h2Ttfb) {
      const byOrigin = NetworkAnalyzer.groupByOrigin(requests);
      /** @type {WeakMap<object, boolean>} */
      const chargeTtfb = new WeakMap();
      for (const originRequests of byOrigin.values()) {
        for (const request of originRequests) {
          chargeTtfb.set(
            request,
            !sentWhileAnotherWasInFlight(request, originRequests),
          );
        }
      }
      this.softNavigationTtfb = chargeTtfb;
    }
  };

  /** Tells the connection whether the request it simulates next pays a time to first byte. */
  function withTtfbOf(simulator, node, run) {
    const charge = simulator.softNavigationTtfb?.get(node.request);
    if (charge === undefined) return run();
    let connection;
    try {
      connection = simulator.connectionPool.acquireActiveConnectionFromRequest(
        node.request,
      );
    } catch {
      return run();
    }
    connection.chargeTtfbWhenWarm = charge;
    try {
      return run();
    } finally {
      connection.chargeTtfbWhenWarm = undefined;
    }
  }

  Simulator.prototype.estimateNetworkTimeRemaining = function (node) {
    return withTtfbOf(this, node, () =>
      estimateNetworkTimeRemaining.call(this, node),
    );
  };
  Simulator.prototype.updateProgressMadeInTimePeriod = function (
    node,
    ...rest
  ) {
    if (node.type !== BaseNode.types.NETWORK) {
      return updateProgressMadeInTimePeriod.call(this, node, ...rest);
    }
    let connection;
    if (this.coldRequests && !node.isConnectionless) {
      connection = this.connectionPool.acquireActiveConnectionFromRequest(
        node.request,
      );
    }
    const result = withTtfbOf(this, node, () =>
      updateProgressMadeInTimePeriod.call(this, node, ...rest),
    );
    // The simulator warms a connection when a request on it finishes. DevTools throttling adds
    // the same latency to every request, warm connection or not, which this mimics.
    connection?.setWarmed(false);
    return result;
  };

  // A warm multiplexed connection that has to pay a time to first byte is simulated like a warm
  // connection that is not multiplexed: one round trip and the server's response time.
  TCPConnection.prototype.simulateDownloadUntil = function (
    bytesToDownload,
    options,
  ) {
    if (!(this.chargeTtfbWhenWarm && this.warmed && this.multiplexed)) {
      return simulateDownloadUntil.call(this, bytesToDownload, options);
    }
    this.multiplexed = false;
    try {
      return simulateDownloadUntil.call(this, bytesToDownload, options);
    } finally {
      this.multiplexed = true;
    }
  };

  return () => {
    Simulator.prototype.initializeConnectionPool = initializeConnectionPool;
    Simulator.prototype.estimateNetworkTimeRemaining =
      estimateNetworkTimeRemaining;
    Simulator.prototype.updateProgressMadeInTimePeriod =
      updateProgressMadeInTimePeriod;
    TCPConnection.prototype.simulateDownloadUntil = simulateDownloadUntil;
  };
}
