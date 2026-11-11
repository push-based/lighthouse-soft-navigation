import { Audit } from 'lighthouse';
import type * as LH from 'lighthouse/types/lh.js';
import {
  documentRequestAudits,
  withoutDocumentRequest,
} from './document-request.js';

const stock = vi.fn((artifacts: LH.Artifacts): LH.Audit.Product => ({
  score: artifacts.GatherContext.gatherMode === 'navigation' ? 1 : 0.5,
}));

class StockAudit extends Audit {
  static override get meta(): LH.Audit.Meta {
    return {
      id: 'stock',
      title: 'Stock',
      description: 'A stock audit.',
      requiredArtifacts: ['DevtoolsLog', 'URL'],
    };
  }

  static override audit(
    artifacts: LH.Artifacts,
    _context: LH.Audit.Context,
  ): LH.Audit.Product {
    return stock(artifacts);
  }
}

const context = {} as LH.Audit.Context;
const navigation = {
  url: 'https://example.com/products',
  navigationType: 'historyApi',
};

function artifacts(SoftNavigation: object | null) {
  return {
    SoftNavigation,
    GatherContext: { gatherMode: 'navigation' },
    URL: { finalDisplayedUrl: 'https://example.com/products' },
  } as unknown as LH.Artifacts;
}

beforeEach(() => {
  stock.mockClear();
});

describe('withoutDocumentRequest', () => {
  it('keeps the audit and additionally requires the soft navigation', () => {
    const Wrapped = withoutDocumentRequest(StockAudit, 'notApplicable');

    expect(Object.getPrototypeOf(Wrapped)).toBe(StockAudit);
    expect(Wrapped.meta).toEqual({
      ...StockAudit.meta,
      requiredArtifacts: ['DevtoolsLog', 'URL', 'SoftNavigation'],
    });
  });

  it.each(['notApplicable', 'timespan'] as const)(
    'audits a page load with the stock audit (%s)',
    (onSoftNavigation) => {
      const Wrapped = withoutDocumentRequest(StockAudit, onSoftNavigation);
      const pageLoad = artifacts(null);

      expect(Wrapped.audit(pageLoad, context)).toEqual({ score: 1 });
      expect(stock).toHaveBeenCalledWith(pageLoad);
    },
  );

  it('is not applicable on a soft navigation', () => {
    const Wrapped = withoutDocumentRequest(StockAudit, 'notApplicable');

    expect(Wrapped.audit(artifacts(navigation), context)).toEqual({
      score: null,
      notApplicable: true,
    });
    expect(stock).not.toHaveBeenCalled();
  });

  it('audits a soft navigation the way Lighthouse audits a timespan', () => {
    const Wrapped = withoutDocumentRequest(StockAudit, 'timespan');
    const softNavigation = artifacts(navigation);

    expect(Wrapped.audit(softNavigation, context)).toEqual({ score: 0.5 });
    expect(stock).toHaveBeenCalledWith({
      ...softNavigation,
      GatherContext: { gatherMode: 'timespan' },
    });
    expect(softNavigation.GatherContext).toEqual({ gatherMode: 'navigation' });
  });
});

describe('documentRequestAudits', () => {
  it('wraps the stock audits under their path in the default config', () => {
    expect(
      Object.fromEntries(
        Object.entries(documentRequestAudits).map(([path, audit]) => [
          path,
          audit.meta.id,
        ]),
      ),
    ).toEqual({
      'network-requests': 'network-requests',
      'byte-efficiency/unminified-css': 'unminified-css',
      'byte-efficiency/unminified-javascript': 'unminified-javascript',
      'byte-efficiency/unused-css-rules': 'unused-css-rules',
      'byte-efficiency/unused-javascript': 'unused-javascript',
      'server-response-time': 'server-response-time',
      redirects: 'redirects',
      diagnostics: 'diagnostics',
      'csp-xss': 'csp-xss',
      'has-hsts': 'has-hsts',
      'origin-isolation': 'origin-isolation',
      'clickjacking-mitigation': 'clickjacking-mitigation',
      'trusted-types-xss': 'trusted-types-xss',
      'dobetterweb/charset': 'charset',
      'seo/http-status-code': 'http-status-code',
      'seo/is-crawlable': 'is-crawlable',
      'seo/hreflang': 'hreflang',
      'seo/canonical': 'canonical',
    });
  });

  it('requires the soft navigation for each of them', () => {
    for (const audit of Object.values(documentRequestAudits)) {
      expect(audit.meta.requiredArtifacts).toContain('SoftNavigation');
    }
  });
});
