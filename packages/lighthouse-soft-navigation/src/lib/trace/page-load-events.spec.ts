import type * as LH from 'lighthouse/types/lh.js';
import { TraceProcessor } from 'lighthouse/core/lib/tracehouse/trace-processor.js';
import {
  softNavigationStarts,
  withPageLoadEvents,
} from './page-load-events.js';

const PID = 100;
const TID = 200;
const FRAME = 'MAIN_FRAME';

function event(
  name: string,
  ts: number,
  args: object = {},
  cat = 'loading,devtools.timeline',
): LH.TraceEvent {
  return { name, ts, args, cat, pid: PID, tid: TID, ph: 'I' } as LH.TraceEvent;
}

function softNavigationStart(
  ts: number,
  context: object,
  frame = FRAME,
): LH.TraceEvent {
  return event('SoftNavigationStart', ts, { frame, context });
}

function lcpCandidate(
  ts: number,
  performanceTimelineNavigationId: number,
  size = 100,
): LH.TraceEvent {
  return event('largestContentfulPaint::CandidateForSoftNavigation', ts, {
    frame: FRAME,
    data: { performanceTimelineNavigationId, size, type: 'text' },
  });
}

/** A trace of an already loaded page: tracing starts, then the page is interacted with. */
function trace(...events: LH.TraceEvent[]): LH.Trace {
  return {
    traceEvents: [
      event(
        'TracingStartedInBrowser',
        1_000,
        {
          data: {
            frames: [
              { frame: FRAME, processId: PID, url: 'https://example.com/' },
              {
                frame: 'CHILD_FRAME',
                parent: FRAME,
                processId: PID,
                url: 'https://example.com/frame',
              },
            ],
          },
        },
        'disabled-by-default-devtools.timeline',
      ),
      {
        ...event('thread_name', 0, { name: 'CrRendererMain' }, '__metadata'),
        ph: 'M',
      } as LH.TraceEvent,
      {
        ...event('RunTask', 1_500, {}, 'disabled-by-default-devtools.timeline'),
        ph: 'X',
        dur: 100,
      } as LH.TraceEvent,
      ...events,
    ],
  };
}

function added(original: LH.Trace, result: LH.Trace): LH.TraceEvent[] {
  return result.traceEvents.slice(original.traceEvents.length);
}

describe('softNavigationStarts', () => {
  it('returns the soft navigations of the main frame in the order they started', () => {
    const starts = softNavigationStarts(
      trace(
        softNavigationStart(9_000, {}),
        softNavigationStart(5_000, {}, 'CHILD_FRAME'),
        softNavigationStart(2_000, {}),
      ),
    );

    expect(starts.map((start) => start.ts)).toEqual([2_000, 9_000]);
  });

  it('returns every soft navigation when the trace does not describe its frames', () => {
    const starts = softNavigationStarts({
      traceEvents: [softNavigationStart(2_000, {}, 'UNKNOWN_FRAME')],
    });

    expect(starts).toHaveLength(1);
  });
});

describe('withPageLoadEvents', () => {
  it('returns a trace without a soft navigation unchanged', () => {
    const original = trace(lcpCandidate(3_000, 1));

    expect(withPageLoadEvents(original)).toBe(original);
  });

  it('keeps the events of the trace and does not modify it', () => {
    const original = trace(
      softNavigationStart(2_000, { firstContentfulPaint: 2_500 }),
    );
    const events = [...original.traceEvents];

    const result = withPageLoadEvents(original);

    expect(original.traceEvents).toEqual(events);
    expect(result.traceEvents.slice(0, events.length)).toEqual(events);
  });

  it('makes the soft navigation what the Lighthouse trace processor measures', () => {
    const result = withPageLoadEvents(
      trace(
        softNavigationStart(2_000_000, {
          firstContentfulPaint: 2_300_000,
          performanceTimelineNavigationId: 7,
          urlChangeTime: 2_010_000,
        }),
        lcpCandidate(2_300_000, 7, 100),
        lcpCandidate(2_900_000, 7, 400),
      ),
    );

    const processedTrace = TraceProcessor.processTrace(result);
    const { timings } = TraceProcessor.processNavigation(processedTrace);

    expect(processedTrace.timestamps.timeOrigin).toBe(2_000_000);
    expect(timings).toMatchObject({
      timeOrigin: 0,
      firstContentfulPaint: 300,
      firstContentfulPaintAllFrames: 300,
      largestContentfulPaint: 900,
      largestContentfulPaintAllFrames: 900,
      domContentLoaded: 10,
      load: 10,
    });
  });

  it('gives the paint events a navigation id that no navigation of the trace has', () => {
    const original = trace(
      softNavigationStart(2_000, {
        firstContentfulPaint: 2_300,
        performanceTimelineNavigationId: 7,
      }),
      lcpCandidate(2_300, 7),
    );

    const paints = added(original, withPageLoadEvents(original)).filter(
      (event) =>
        event.name === 'firstContentfulPaint' ||
        event.name === 'largestContentfulPaint::Candidate',
    );

    expect(paints.map((paint) => paint.args.data?.navigationId)).toEqual([
      'soft-navigation-7',
      'soft-navigation-7',
    ]);
  });

  it('only measures the first soft navigation, until the next one starts', () => {
    const original = trace(
      softNavigationStart(2_000, {
        firstContentfulPaint: 2_300,
        performanceTimelineNavigationId: 7,
      }),
      lcpCandidate(2_300, 7),
      softNavigationStart(5_000, {
        firstContentfulPaint: 5_300,
        performanceTimelineNavigationId: 8,
      }),
      // Attributed to the first soft navigation, but painted after the second one started.
      lcpCandidate(5_100, 7),
      lcpCandidate(5_300, 8),
    );

    const events = added(original, withPageLoadEvents(original));

    expect(events.find((event) => event.name === 'clock_sync')).toMatchObject({
      ts: 2_000,
    });
    expect(
      events
        .filter((event) => event.name === 'largestContentfulPaint::Candidate')
        .map((event) => event.ts),
    ).toEqual([2_300]);
  });

  it('ignores LCP candidates of other soft navigations', () => {
    const original = trace(
      softNavigationStart(2_000, {
        firstContentfulPaint: 2_300,
        performanceTimelineNavigationId: 7,
      }),
      lcpCandidate(2_400, 6),
    );

    const events = added(original, withPageLoadEvents(original));

    expect(
      events.some(
        (event) => event.name === 'largestContentfulPaint::Candidate',
      ),
    ).toBe(false);
  });

  it('adds no first contentful paint when Chrome did not report one', () => {
    const original = trace(softNavigationStart(2_000_000, {}));

    const result = withPageLoadEvents(original);

    expect(
      added(original, result).some(
        (event) => event.name === 'firstContentfulPaint',
      ),
    ).toBe(false);
    expect(() =>
      TraceProcessor.processNavigation(TraceProcessor.processTrace(result)),
    ).toThrow('No FirstContentfulPaint event found');
  });

  it('places DOMContentLoaded and load after the time origin when the URL changed first', () => {
    const original = trace(
      softNavigationStart(2_000, {
        firstContentfulPaint: 2_300,
        urlChangeTime: 1_900,
      }),
    );

    const events = added(original, withPageLoadEvents(original));

    expect(
      events
        .filter((event) => event.name.endsWith('EventEnd'))
        .map((event) => [event.name, event.ts]),
    ).toEqual([
      ['domContentLoadedEventEnd', 2_001],
      ['loadEventEnd', 2_001],
    ]);
  });
});
