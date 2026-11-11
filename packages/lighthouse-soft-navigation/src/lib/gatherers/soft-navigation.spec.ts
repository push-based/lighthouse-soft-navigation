import { EventEmitter } from 'node:events';
import { NetworkMonitor } from 'lighthouse/core/gather/driver/network-monitor.js';
import type * as LH from 'lighthouse/types/lh.js';
import { SoftNavigation } from './soft-navigation.js';

const MAIN_FRAME = {
  id: 'MAIN_FRAME',
  loaderId: 'LOADER',
  url: 'https://example.com/',
};

/** The parts of a gatherer context the gatherer uses, with a session that only re-emits events. */
function setup(gatherMode: LH.Gatherer.GatherMode = 'navigation') {
  const session = Object.assign(new EventEmitter(), {
    sendCommand: vi.fn(async (method: string) =>
      method === 'Page.getFrameTree'
        ? { frameTree: { frame: MAIN_FRAME } }
        : undefined,
    ),
    setNextProtocolTimeout: vi.fn(),
  });

  let reportSoftNavigation: (detected: boolean) => void = () => {};
  let failWait: (error: Error) => void = () => {};
  const evaluate = vi.fn((fn: { name: string }) => {
    if (fn.name !== 'softNavigationReported') return Promise.resolve();
    return new Promise<boolean>((resolve, reject) => {
      reportSoftNavigation = resolve;
      failWait = reject;
    });
  });

  const received: Array<[string, unknown]> = [];
  for (const name of [
    'Page.frameNavigated',
    'Page.domContentEventFired',
    'Page.loadEventFired',
    'Page.lifecycleEvent',
  ]) {
    session.on(name, (params) => received.push([name, params]));
  }

  const context = {
    gatherMode,
    driver: { defaultSession: session, executionContext: { evaluate } },
    settings: { maxWaitForLoad: 45_000 },
  } as unknown as LH.Gatherer.Context;

  return {
    context,
    session,
    evaluate,
    received,
    names: () => received.map(([name]) => name),
    reportSoftNavigation: async (detected = true) => {
      reportSoftNavigation(detected);
      await Promise.resolve();
    },
    failWait: async () => {
      failWait(new Error('Execution context was destroyed'));
      await Promise.resolve();
    },
  };
}

const navigatedWithinDocument = {
  frameId: MAIN_FRAME.id,
  url: 'https://example.com/products',
  navigationType: 'historyApi',
};

describe('SoftNavigation', () => {
  it('supports timespans so that timespan gatherers can depend on it', () => {
    expect(new SoftNavigation().meta).toEqual({
      symbol: SoftNavigation.symbol,
      supportedModes: ['timespan', 'navigation'],
    });
  });

  it('does nothing outside of a navigation', async () => {
    const { context, session, evaluate } = setup('timespan');
    const gatherer = new SoftNavigation();

    await gatherer.startInstrumentation(context);
    session.emit('Page.navigatedWithinDocument', navigatedWithinDocument);
    await gatherer.stopInstrumentation();

    expect(session.sendCommand).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
    expect(gatherer.getArtifact()).toBeNull();
  });

  it('reports a page load as no soft navigation', async () => {
    const { context } = setup();
    const gatherer = new SoftNavigation();

    await gatherer.startInstrumentation(context);

    expect(gatherer.getArtifact()).toBeNull();
  });

  it('emits the navigation, DOMContentLoaded and load when the main frame navigates within the document', async () => {
    const { context, session, received } = setup();
    const gatherer = new SoftNavigation();
    await gatherer.startInstrumentation(context);

    session.emit('Page.navigatedWithinDocument', navigatedWithinDocument);

    expect(received).toEqual([
      [
        'Page.frameNavigated',
        {
          frame: { ...MAIN_FRAME, url: 'https://example.com/products' },
          type: 'Navigation',
        },
      ],
      ['Page.domContentEventFired', { timestamp: expect.any(Number) }],
      ['Page.loadEventFired', { timestamp: expect.any(Number) }],
    ]);
    expect(gatherer.getArtifact()).toEqual({
      url: 'https://example.com/products',
      navigationType: 'historyApi',
    });
  });

  it('emits the first contentful paint once Chrome reports the soft navigation', async () => {
    const { context, session, received, names, reportSoftNavigation } = setup();
    const gatherer = new SoftNavigation();
    await gatherer.startInstrumentation(context);

    session.emit('Page.navigatedWithinDocument', navigatedWithinDocument);
    expect(names()).not.toContain('Page.lifecycleEvent');

    await reportSoftNavigation();

    expect(received.at(-1)).toEqual([
      'Page.lifecycleEvent',
      {
        frameId: MAIN_FRAME.id,
        loaderId: MAIN_FRAME.loaderId,
        name: 'firstContentfulPaint',
        timestamp: expect.any(Number),
      },
    ]);
  });

  it('observes soft navigations before the navigation is triggered, as long as Lighthouse waits for the load', async () => {
    const { context, session, evaluate } = setup();

    await new SoftNavigation().startInstrumentation(context);

    expect(evaluate.mock.calls).toEqual([
      [
        expect.objectContaining({ name: 'observeSoftNavigation' }),
        { args: [45_000], useIsolation: true },
      ],
      [
        expect.objectContaining({ name: 'softNavigationReported' }),
        { args: [], useIsolation: true },
      ],
    ]);
    expect(session.setNextProtocolTimeout).toHaveBeenCalledWith(50_000);
  });

  it('does not hold the navigation back in a browser that cannot report soft navigations', async () => {
    const { context, session, names, reportSoftNavigation } = setup();
    const gatherer = new SoftNavigation();
    await gatherer.startInstrumentation(context);

    await reportSoftNavigation(false);
    session.emit('Page.navigatedWithinDocument', navigatedWithinDocument);

    expect(names()).toEqual([
      'Page.frameNavigated',
      'Page.domContentEventFired',
      'Page.loadEventFired',
      'Page.lifecycleEvent',
    ]);
  });

  it('emits no first contentful paint when the page cannot be observed', async () => {
    const { context, session, names, failWait } = setup();
    const gatherer = new SoftNavigation();
    await gatherer.startInstrumentation(context);

    await failWait();
    session.emit('Page.navigatedWithinDocument', navigatedWithinDocument);

    expect(names()).not.toContain('Page.lifecycleEvent');
  });

  it('only bridges the first navigation within the document', async () => {
    const { context, session, names } = setup();
    const gatherer = new SoftNavigation();
    await gatherer.startInstrumentation(context);

    session.emit('Page.navigatedWithinDocument', navigatedWithinDocument);
    session.emit('Page.navigatedWithinDocument', {
      ...navigatedWithinDocument,
      url: 'https://example.com/products/1',
    });

    expect(
      names().filter((name) => name === 'Page.frameNavigated'),
    ).toHaveLength(1);
    expect(gatherer.getArtifact()).toMatchObject({
      url: 'https://example.com/products',
    });
  });

  it('ignores navigations within the document of other frames', async () => {
    const { context, session, received } = setup();
    const gatherer = new SoftNavigation();
    await gatherer.startInstrumentation(context);

    session.emit('Page.navigatedWithinDocument', {
      ...navigatedWithinDocument,
      frameId: 'CHILD_FRAME',
    });

    expect(received).toEqual([]);
    expect(gatherer.getArtifact()).toBeNull();
  });

  it.each([
    [
      'started loading a document',
      'Page.frameStartedNavigating',
      { frameId: MAIN_FRAME.id, navigationType: 'differentDocument' },
    ],
    [
      'loaded a document',
      'Page.frameNavigated',
      { frame: { id: MAIN_FRAME.id, url: 'https://example.com/' } },
    ],
  ])(
    'leaves a page that %s alone when it then changes its URL',
    async (_, event, params) => {
      const { context, session, received } = setup();
      const gatherer = new SoftNavigation();
      await gatherer.startInstrumentation(context);

      session.emit(event, params);
      received.length = 0;
      session.emit('Page.navigatedWithinDocument', navigatedWithinDocument);

      expect(received).toEqual([]);
      expect(gatherer.getArtifact()).toBeNull();
    },
  );

  it.each([
    [
      'of another frame',
      { frameId: 'CHILD_FRAME', navigationType: 'differentDocument' },
    ],
    [
      'within the document',
      { frameId: MAIN_FRAME.id, navigationType: 'sameDocument' },
    ],
    [
      'in the history of the document',
      { frameId: MAIN_FRAME.id, navigationType: 'historySameDocument' },
    ],
  ])('still bridges after a navigation %s started', async (_, params) => {
    const { context, session } = setup();
    const gatherer = new SoftNavigation();
    await gatherer.startInstrumentation(context);

    session.emit('Page.frameStartedNavigating', params);
    session.emit('Page.navigatedWithinDocument', navigatedWithinDocument);

    expect(gatherer.getArtifact()).not.toBeNull();
  });

  it('ignores the navigation of a child frame', async () => {
    const { context, session } = setup();
    const gatherer = new SoftNavigation();
    await gatherer.startInstrumentation(context);

    session.emit('Page.frameNavigated', {
      frame: { id: 'CHILD_FRAME', parentId: MAIN_FRAME.id },
    });
    session.emit('Page.navigatedWithinDocument', navigatedWithinDocument);

    expect(gatherer.getArtifact()).not.toBeNull();
  });

  it('stays a soft navigation while a document only started loading after the URL changed', async () => {
    const { context, session } = setup();
    const gatherer = new SoftNavigation();
    await gatherer.startInstrumentation(context);

    session.emit('Page.navigatedWithinDocument', navigatedWithinDocument);
    session.emit('Page.frameStartedNavigating', {
      frameId: MAIN_FRAME.id,
      navigationType: 'differentDocument',
    });

    expect(gatherer.getArtifact()).not.toBeNull();
  });

  it('reports a page load when a document loads after the URL changed', async () => {
    const { context, session, names, reportSoftNavigation } = setup();
    const gatherer = new SoftNavigation();
    await gatherer.startInstrumentation(context);

    session.emit('Page.navigatedWithinDocument', navigatedWithinDocument);
    session.emit('Page.frameNavigated', {
      frame: { id: MAIN_FRAME.id, url: 'https://example.com/about' },
    });
    await reportSoftNavigation();

    expect(gatherer.getArtifact()).toBeNull();
    expect(names()).not.toContain('Page.lifecycleEvent');
  });

  describe('with the network monitor of Lighthouse', () => {
    async function monitor(session: EventEmitter) {
      const targetManager = Object.assign(new EventEmitter(), {
        rootSession: () => session,
      });
      const networkMonitor = new NetworkMonitor(
        targetManager as unknown as ConstructorParameters<
          typeof NetworkMonitor
        >[0],
      );
      await networkMonitor.enable();
      return networkMonitor;
    }

    it('makes the URL of the soft navigation the URL of the step', async () => {
      const { context, session } = setup();
      const networkMonitor = await monitor(session);
      await new SoftNavigation().startInstrumentation(context);

      session.emit('Page.navigatedWithinDocument', navigatedWithinDocument);

      await expect(networkMonitor.getNavigationUrls()).resolves.toEqual({
        requestedUrl: 'https://example.com/products',
        mainDocumentUrl: 'https://example.com/products',
      });
    });

    it('leaves the URLs of the step to a document that loads after the URL changed', async () => {
      const { context, session } = setup();
      const networkMonitor = await monitor(session);
      await new SoftNavigation().startInstrumentation(context);

      session.emit('Page.navigatedWithinDocument', navigatedWithinDocument);
      session.emit('Page.frameNavigated', {
        frame: { id: MAIN_FRAME.id, url: 'https://example.com/about' },
      });

      await expect(networkMonitor.getNavigationUrls()).resolves.toEqual({
        requestedUrl: 'https://example.com/about',
        mainDocumentUrl: 'https://example.com/about',
      });
    });
  });

  it('stops listening and stops observing the page when instrumentation stops', async () => {
    const { context, session, received, evaluate } = setup();
    const gatherer = new SoftNavigation();
    await gatherer.startInstrumentation(context);

    await gatherer.stopInstrumentation();
    session.emit('Page.navigatedWithinDocument', navigatedWithinDocument);

    expect(received).toEqual([]);
    expect(evaluate).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'stopObservingSoftNavigation' }),
      { args: [], useIsolation: true },
    );
  });

  it('can be stopped without having been started', async () => {
    await expect(
      new SoftNavigation().stopInstrumentation(),
    ).resolves.toBeUndefined();
  });
});
