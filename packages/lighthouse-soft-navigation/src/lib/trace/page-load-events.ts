import type * as LH from 'lighthouse/types/lh.js';
import { TraceProcessor } from 'lighthouse/core/lib/tracehouse/trace-processor.js';

/**
 * Chrome's trace events for a soft navigation, and the page load events Lighthouse's trace
 * processor reads instead. Upstream, the trace processor would read the soft navigation events
 * itself (`processSoftNavigation` in GoogleChrome/lighthouse#17075).
 */

type TraceEvent = LH.TraceEvent;

interface SoftNavigationContext {
  URL?: string;
  /** Timestamp of the first contentful paint of the soft navigation. */
  firstContentfulPaint?: number;
  /** Correlates the LCP candidates with the soft navigation. */
  performanceTimelineNavigationId?: number;
  /** Timestamp of the same-document navigation commit. */
  urlChangeTime?: number;
}

export type SoftNavigationStartEvent = TraceEvent & {
  name: 'SoftNavigationStart';
  args: { frame?: string; context?: SoftNavigationContext };
};

const SOFT_NAVIGATION_START = 'SoftNavigationStart';
const SOFT_NAVIGATION_LCP_CANDIDATE =
  'largestContentfulPaint::CandidateForSoftNavigation';

/** The soft navigations of the inspected page's main frame, in the order they started. */
export function softNavigationStarts(
  trace: LH.Trace,
): SoftNavigationStartEvent[] {
  const mainFrameId = mainFrame(trace.traceEvents);
  return trace.traceEvents
    .filter(
      (event): event is SoftNavigationStartEvent =>
        event.name === SOFT_NAVIGATION_START &&
        (mainFrameId === undefined || event.args.frame === mainFrameId),
    )
    .sort((a, b) => a.ts - b.ts);
}

/**
 * Adds the page load events of the first soft navigation in the trace, so that the soft
 * navigation is what Lighthouse measures:
 *
 * - the time origin, at the interaction that started the soft navigation
 * - `firstContentfulPaint` and the `largestContentfulPaint::Candidate`s Chrome attributed to it
 * - DOMContentLoaded and load at the URL change, since the document was already loaded
 *
 * The events of the trace are kept as they are. A trace without a soft navigation is returned
 * unchanged.
 */
export function withPageLoadEvents(trace: LH.Trace): LH.Trace {
  const [start, next] = softNavigationStarts(trace);
  if (!start) return trace;

  const context = start.args.context ?? {};
  // The soft navigation is observed until the next one starts.
  const end = next?.ts ?? Infinity;
  const isObserved = (ts: number) => ts > start.ts && ts < end;
  const base = { pid: start.pid, tid: start.tid };
  const frame = start.args.frame;
  // The trace engine looks up the navigation of a paint event by this id, and skips paints of
  // navigations it does not know. Insights then cover the whole trace, as they do in a timespan.
  const navigationId = `soft-navigation-${context.performanceTimelineNavigationId ?? start.ts}`;

  const events: TraceEvent[] = [
    traceEvent({
      ...base,
      name: 'clock_sync',
      cat: '__metadata',
      ph: 'c',
      ts: start.ts,
      args: { sync_id: TraceProcessor.TIMESPAN_MARKER_ID },
    }),
  ];

  const committed = Math.max(context.urlChangeTime ?? 0, start.ts + 1);
  for (const name of ['domContentLoadedEventEnd', 'loadEventEnd']) {
    events.push(
      traceEvent({
        ...base,
        name,
        cat: 'blink.user_timing',
        ph: 'R',
        ts: committed,
        args: { frame },
      }),
    );
  }

  const firstContentfulPaint = context.firstContentfulPaint;
  if (firstContentfulPaint !== undefined && isObserved(firstContentfulPaint)) {
    events.push(
      traceEvent({
        ...base,
        name: 'firstContentfulPaint',
        cat: 'loading,rail,devtools.timeline',
        ph: 'R',
        ts: firstContentfulPaint,
        args: { frame, data: { navigationId } },
      }),
    );
  }

  for (const event of trace.traceEvents) {
    if (event.name !== SOFT_NAVIGATION_LCP_CANDIDATE) continue;
    if (!isObserved(event.ts)) continue;
    const data = event.args.data as
      { performanceTimelineNavigationId?: number } | undefined;
    if (
      data?.performanceTimelineNavigationId !==
      context.performanceTimelineNavigationId
    ) {
      continue;
    }
    events.push(
      traceEvent({
        ...event,
        name: 'largestContentfulPaint::Candidate',
        args: { ...event.args, data: { ...data, navigationId } },
      }),
    );
  }

  return { ...trace, traceEvents: [...trace.traceEvents, ...events] };
}

/** Instant events carry no duration, which Lighthouse's event type requires. */
function traceEvent(event: object): TraceEvent {
  return event as TraceEvent;
}

/** The main frame of the inspected page, found the way Lighthouse's trace processor finds it. */
function mainFrame(events: TraceEvent[]): string | undefined {
  const frames: Array<{ frame: string; parent?: string }> =
    events.find((event) => event.name === 'TracingStartedInBrowser')?.args.data
      ?.frames ?? [];
  return frames.find((frame) => !frame.parent)?.frame;
}
