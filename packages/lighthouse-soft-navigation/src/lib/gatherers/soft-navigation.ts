import type { EventEmitter } from 'node:events';
import { Gatherer } from 'lighthouse';
import type * as LH from 'lighthouse/types/lh.js';

/**
 * The same-document navigation that completed the navigation step, or `null` when the step was a
 * page load (or not a navigation at all).
 */
export type SoftNavigationArtifact = {
  /** The URL the main frame navigated to within the document. */
  url: string;
  navigationType: LH.Crdp.Page.NavigatedWithinDocumentEvent['navigationType'];
} | null;

type Session = LH.Gatherer.ProtocolSession;
type CrdpEvent<T extends keyof LH.CrdpEvents> = LH.CrdpEvents[T][0];

/** Navigation types of `Page.frameStartedNavigating` that keep the document. */
const SAME_DOCUMENT_NAVIGATIONS = new Set([
  'sameDocument',
  'historySameDocument',
]);

/** What the functions below use in the page. The workspace is not typed against the DOM. */
interface PageGlobal {
  __lighthouseSoftNavigation?: { reported: Promise<boolean>; stop: () => void };
  PerformanceObserver: {
    new (callback: () => void): {
      observe(options: { type: string }): void;
      disconnect(): void;
    };
    supportedEntryTypes: readonly string[];
  };
}

/*
 * The functions below run in the page, in Lighthouse's isolated world, so they cannot reference
 * anything outside of themselves.
 */
/* c8 ignore start */

/**
 * Starts observing soft navigations. Chrome reports one after its first contentful paint. The
 * observation ends with the first report, after `timeoutMs`, or when it is stopped.
 */
function observeSoftNavigation(timeoutMs: number): void {
  const page = globalThis as unknown as PageGlobal;
  let stop = () => {};
  const reported = new Promise<boolean>((resolve) => {
    // A browser that cannot report soft navigations must not hold the navigation back.
    if (
      !page.PerformanceObserver.supportedEntryTypes.includes('soft-navigation')
    ) {
      resolve(false);
      return;
    }
    const observer = new page.PerformanceObserver(() => finish(true));
    const timeout = setTimeout(() => finish(false), timeoutMs);
    function finish(detected: boolean) {
      observer.disconnect();
      clearTimeout(timeout);
      resolve(detected);
    }
    stop = () => finish(false);
    observer.observe({ type: 'soft-navigation' });
  });
  page.__lighthouseSoftNavigation = { reported, stop };
}

/** Resolves when the observation ends, with whether a soft navigation was reported. */
function softNavigationReported(): Promise<boolean> | boolean {
  const page = globalThis as unknown as PageGlobal;
  return page.__lighthouseSoftNavigation?.reported ?? false;
}

function stopObservingSoftNavigation(): void {
  const page = globalThis as unknown as PageGlobal;
  page.__lighthouseSoftNavigation?.stop();
  delete page.__lighthouseSoftNavigation;
}

/* c8 ignore stop */

/**
 * Lets Lighthouse's navigation runner complete on a soft navigation.
 *
 * The runner waits for a main frame navigation, DOMContentLoaded, the load event and a first
 * contentful paint. A soft navigation emits none of them, only `Page.navigatedWithinDocument`.
 * This gatherer translates: when the main frame navigates within the document it emits the
 * navigation, DOMContentLoaded and load on the Lighthouse session, and the first contentful paint
 * once Chrome reports the soft navigation. The stock wait conditions, including network and CPU
 * quiet, then run unchanged. A page load is left alone.
 *
 * Upstream this is `waitForSoftNavigation` and the `gotoURL` changes of
 * GoogleChrome/lighthouse#17075.
 */
export class SoftNavigation extends Gatherer {
  static symbol = Symbol('SoftNavigation');

  override meta: LH.Gatherer.GathererMeta = {
    symbol: SoftNavigation.symbol,
    // Timespan support is only declared so that timespan gatherers can depend on this artifact.
    supportedModes: ['timespan', 'navigation'],
  };

  private navigation: SoftNavigationArtifact = null;
  private stop: () => Promise<void> = async () => {};

  override async startInstrumentation(
    context: LH.Gatherer.Context,
  ): Promise<void> {
    if (context.gatherMode !== 'navigation') return;

    const { driver, settings } = context;
    const session = driver.defaultSession;
    await session.sendCommand('Page.enable');
    const { frameTree } = await session.sendCommand('Page.getFrameTree');
    const mainFrame = frameTree.frame;

    let crossDocument = false;
    let painted = false;
    let paintEmitted = false;
    /** The frame of the navigation this gatherer emitted. */
    let emittedFrame: LH.Crdp.Page.Frame | undefined;

    const emitFirstContentfulPaint = () => {
      if (!this.navigation || !painted || paintEmitted) return;
      paintEmitted = true;
      emit(session, 'Page.lifecycleEvent', {
        frameId: mainFrame.id,
        loaderId: mainFrame.loaderId,
        name: 'firstContentfulPaint',
        timestamp: now(),
      });
    };

    const onStartedNavigating = (
      event: CrdpEvent<'Page.frameStartedNavigating'>,
    ) => {
      if (event.frameId !== mainFrame.id) return;
      if (SAME_DOCUMENT_NAVIGATIONS.has(event.navigationType)) return;
      crossDocument = true;
    };

    const onNavigated = (event: CrdpEvent<'Page.frameNavigated'>) => {
      if (event.frame.parentId || event.frame === emittedFrame) return;
      crossDocument = true;
      if (!emittedFrame) return;
      // A document loaded after the URL change, so the step is a page load after all. Lighthouse's
      // network monitor keeps the frame of every navigation and reads the URLs of the step from
      // the main frame ones; as a child frame, the emitted navigation no longer counts.
      emittedFrame.parentId = mainFrame.id;
      this.navigation = null;
    };

    const onNavigatedWithinDocument = (
      event: CrdpEvent<'Page.navigatedWithinDocument'>,
    ) => {
      if (event.frameId !== mainFrame.id) return;
      // Pages commonly call `replaceState` while they load; that is not a soft navigation.
      if (crossDocument || emittedFrame) return;

      this.navigation = {
        url: event.url,
        navigationType: event.navigationType,
      };

      emittedFrame = { ...mainFrame, url: event.url };
      emit(session, 'Page.frameNavigated', {
        frame: emittedFrame,
        type: 'Navigation',
      });
      // The document is already loaded.
      emit(session, 'Page.domContentEventFired', { timestamp: now() });
      emit(session, 'Page.loadEventFired', { timestamp: now() });
      emitFirstContentfulPaint();
    };

    session.on('Page.frameStartedNavigating', onStartedNavigating);
    session.on('Page.frameNavigated', onNavigated);
    session.on('Page.navigatedWithinDocument', onNavigatedWithinDocument);

    // The observer is in place before the navigation is triggered. Lighthouse gives up on the
    // navigation after `maxWaitForLoad`, and so does the observation.
    const timeoutMs = settings.maxWaitForLoad;
    const isolated = { useIsolation: true };
    await driver.executionContext.evaluate(observeSoftNavigation, {
      args: [timeoutMs],
      ...isolated,
    });
    session.setNextProtocolTimeout(timeoutMs + 5_000);
    void driver.executionContext
      .evaluate(softNavigationReported, { args: [], ...isolated })
      .then(() => {
        painted = true;
        emitFirstContentfulPaint();
      })
      // The page loaded a new document, or the step ended.
      .catch(() => {});

    this.stop = async () => {
      session.off('Page.frameStartedNavigating', onStartedNavigating);
      session.off('Page.frameNavigated', onNavigated);
      session.off('Page.navigatedWithinDocument', onNavigatedWithinDocument);
      await driver.executionContext
        .evaluate(stopObservingSoftNavigation, { args: [], ...isolated })
        .catch(() => {});
    };
  }

  override async stopInstrumentation(): Promise<void> {
    await this.stop();
  }

  override getArtifact(): LH.Gatherer.PhaseResult {
    // Lighthouse types artifacts as the union of its own; this one is `SoftNavigationArtifact`.
    return this.navigation as unknown as LH.Gatherer.PhaseResult;
  }
}

/**
 * Lighthouse's session re-emits every protocol event to its listeners. Emitting on it is how the
 * wait conditions and the network monitor, which only listen, are told about the navigation.
 */
function emit<T extends keyof LH.CrdpEvents>(
  session: Session,
  event: T,
  params: CrdpEvent<T>,
): void {
  (session as unknown as EventEmitter).emit(event, params);
}

/** Seconds, like protocol timestamps. Lighthouse's listeners only look at the event names. */
function now(): number {
  return performance.now() / 1000;
}
