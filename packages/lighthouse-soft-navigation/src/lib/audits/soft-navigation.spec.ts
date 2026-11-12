import type * as LH from 'lighthouse/types/lh.js';
import {
  MULTIPLE_SOFT_NAVIGATIONS_WARNING,
  NO_SOFT_NAVIGATION_WARNING,
  SIMULATED_THROTTLING_WARNING,
  SoftNavigationAudit,
} from './soft-navigation.js';

const navigation = {
  url: 'https://example.com/products',
  navigationType: 'historyApi',
};

function artifacts(SoftNavigation: object | null, softNavigations = 1) {
  return {
    SoftNavigation,
    Trace: {
      traceEvents: Array.from({ length: softNavigations }, (_, index) => ({
        name: 'SoftNavigationStart',
        ts: index,
        args: { frame: 'MAIN_FRAME' },
      })),
    },
  } as unknown as LH.Artifacts;
}

function context(throttlingMethod = 'devtools') {
  return { settings: { throttlingMethod } } as unknown as LH.Audit.Context;
}

describe('SoftNavigationAudit', () => {
  it('runs on navigations and needs the soft navigation and the trace', () => {
    expect(SoftNavigationAudit.meta).toMatchObject({
      id: 'soft-navigation',
      scoreDisplayMode: 'informative',
      supportedModes: ['navigation'],
      requiredArtifacts: ['SoftNavigation', 'Trace'],
    });
  });

  it('is not applicable for a page load', () => {
    expect(SoftNavigationAudit.audit(artifacts(null), context())).toEqual({
      score: null,
      notApplicable: true,
    });
  });

  it('describes the soft navigation', () => {
    expect(SoftNavigationAudit.audit(artifacts(navigation), context())).toEqual(
      {
        score: 1,
        runWarnings: [],
        details: {
          type: 'debugdata',
          url: 'https://example.com/products',
          navigationType: 'historyApi',
          softNavigations: 1,
        },
      },
    );
  });

  it('warns when the URL changed without Chrome reporting a soft navigation', () => {
    const { runWarnings } = SoftNavigationAudit.audit(
      artifacts(navigation, 0),
      context(),
    );

    expect(runWarnings).toEqual([NO_SOFT_NAVIGATION_WARNING]);
  });

  it('warns when several soft navigations happened', () => {
    const { runWarnings } = SoftNavigationAudit.audit(
      artifacts(navigation, 2),
      context(),
    );

    expect(runWarnings).toEqual([MULTIPLE_SOFT_NAVIGATIONS_WARNING]);
  });

  it('warns when throttling is simulated', () => {
    const { runWarnings } = SoftNavigationAudit.audit(
      artifacts(navigation),
      context('simulate'),
    );

    expect(runWarnings).toEqual([SIMULATED_THROTTLING_WARNING]);
  });
});
