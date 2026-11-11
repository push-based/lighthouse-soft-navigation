import LinkElements from 'lighthouse/core/gather/gatherers/link-elements.js';
import MainDocumentContent from 'lighthouse/core/gather/gatherers/main-document-content.js';
import Trace from 'lighthouse/core/gather/gatherers/trace.js';
import type * as LH from 'lighthouse/types/lh.js';
import { SoftNavigationLinkElements } from './link-elements.js';
import { SoftNavigationMainDocumentContent } from './main-document-content.js';
import { SoftNavigation } from './soft-navigation.js';
import { SoftNavigationTrace } from './trace.js';

const navigation = {
  url: 'https://example.com/products',
  navigationType: 'historyApi',
};

function context(dependencies: object) {
  return { dependencies } as unknown as LH.Gatherer.Context<'DevtoolsLog'>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SoftNavigationTrace', () => {
  const trace: LH.Trace = {
    traceEvents: [
      {
        name: 'SoftNavigationStart',
        ts: 2_000,
        pid: 1,
        tid: 1,
        cat: 'loading',
        args: { frame: 'MAIN_FRAME', context: { firstContentfulPaint: 2_300 } },
      } as unknown as LH.TraceEvent,
    ],
  };

  function gatherer() {
    const instance = new SoftNavigationTrace();
    instance._trace = trace;
    return instance;
  }

  it('is the stock trace gatherer for everything that depends on the trace', () => {
    const instance = new SoftNavigationTrace();

    expect(instance).toBeInstanceOf(Trace);
    expect(instance.meta).toEqual({
      ...new Trace().meta,
      dependencies: { SoftNavigation: SoftNavigation.symbol },
    });
    expect(instance.meta.symbol).toBe(Trace.symbol);
  });

  it('returns the trace of a page load as it was recorded', () => {
    expect(gatherer().getArtifact(context({ SoftNavigation: null }))).toBe(
      trace,
    );
    expect(gatherer().getArtifact()).toBe(trace);
  });

  it('adds the page load events of a soft navigation', () => {
    const result = gatherer().getArtifact(
      context({ SoftNavigation: navigation }),
    );

    expect(result.traceEvents.map((event) => event.name)).toEqual([
      'SoftNavigationStart',
      'clock_sync',
      'domContentLoadedEventEnd',
      'loadEventEnd',
      'firstContentfulPaint',
    ]);
  });

  it('leaves the recorded trace to the page load error handling of the navigation runner', () => {
    expect(gatherer().getDebugData()).toBe(trace);
  });
});

describe('SoftNavigationLinkElements', () => {
  const fromDom = [{ rel: 'Canonical', href: 'https://example.com/products' }];

  it('depends on the devtools log and the soft navigation', () => {
    expect(new SoftNavigationLinkElements().meta.dependencies).toEqual({
      ...new LinkElements().meta.dependencies,
      SoftNavigation: SoftNavigation.symbol,
    });
  });

  it('collects links the stock way for a page load', async () => {
    const stock = vi
      .spyOn(LinkElements.prototype, 'getArtifact')
      .mockResolvedValue([]);
    const pageLoad = context({ SoftNavigation: null, DevtoolsLog: [] });

    await expect(
      new SoftNavigationLinkElements().getArtifact(pageLoad),
    ).resolves.toEqual([]);
    expect(stock).toHaveBeenCalledWith(pageLoad);
  });

  it('collects the links in the DOM for a soft navigation', async () => {
    vi.spyOn(LinkElements, 'getLinkElementsInDOM').mockResolvedValue(
      structuredClone(fromDom) as LH.Artifacts['LinkElements'],
    );
    const headers = vi.spyOn(LinkElements, 'getLinkElementsInHeaders');

    await expect(
      new SoftNavigationLinkElements().getArtifact(
        context({ SoftNavigation: navigation, DevtoolsLog: [] }),
      ),
    ).resolves.toEqual([{ ...fromDom[0], rel: 'canonical' }]);
    expect(headers).not.toHaveBeenCalled();
  });
});

describe('SoftNavigationMainDocumentContent', () => {
  it('depends on the devtools log and the soft navigation', () => {
    expect(new SoftNavigationMainDocumentContent().meta.dependencies).toEqual({
      ...new MainDocumentContent().meta.dependencies,
      SoftNavigation: SoftNavigation.symbol,
    });
  });

  it('reads the document content the stock way for a page load', async () => {
    const stock = vi
      .spyOn(MainDocumentContent.prototype, 'getArtifact')
      .mockResolvedValue('<html></html>');
    const pageLoad = context({ SoftNavigation: null, DevtoolsLog: [] });

    await expect(
      new SoftNavigationMainDocumentContent().getArtifact(pageLoad),
    ).resolves.toBe('<html></html>');
    expect(stock).toHaveBeenCalledWith(pageLoad);
  });

  it('has no document content for a soft navigation', async () => {
    await expect(
      new SoftNavigationMainDocumentContent().getArtifact(
        context({ SoftNavigation: navigation, DevtoolsLog: [] }),
      ),
    ).resolves.toBe('');
  });
});
