import type { Audit } from 'lighthouse';
import type * as LH from 'lighthouse/types/lh.js';
import ClickjackingMitigation from 'lighthouse/core/audits/clickjacking-mitigation.js';
import CspXss from 'lighthouse/core/audits/csp-xss.js';
import Diagnostics from 'lighthouse/core/audits/diagnostics.js';
import Charset from 'lighthouse/core/audits/dobetterweb/charset.js';
import HasHsts from 'lighthouse/core/audits/has-hsts.js';
import NetworkRequests from 'lighthouse/core/audits/network-requests.js';
import OriginIsolation from 'lighthouse/core/audits/origin-isolation.js';
import Redirects from 'lighthouse/core/audits/redirects.js';
import Canonical from 'lighthouse/core/audits/seo/canonical.js';
import Hreflang from 'lighthouse/core/audits/seo/hreflang.js';
import HttpStatusCode from 'lighthouse/core/audits/seo/http-status-code.js';
import IsCrawlable from 'lighthouse/core/audits/seo/is-crawlable.js';
import ServerResponseTime from 'lighthouse/core/audits/server-response-time.js';
import TrustedTypesXss from 'lighthouse/core/audits/trusted-types-xss.js';
import UnminifiedCss from 'lighthouse/core/audits/byte-efficiency/unminified-css.js';
import UnminifiedJavascript from 'lighthouse/core/audits/byte-efficiency/unminified-javascript.js';
import UnusedCssRules from 'lighthouse/core/audits/byte-efficiency/unused-css-rules.js';
import UnusedJavascript from 'lighthouse/core/audits/byte-efficiency/unused-javascript.js';
import type { SoftNavigationArtifact } from '../gatherers/soft-navigation.js';

type AuditClass = typeof Audit;
type Artifacts = LH.Artifacts & { SoftNavigation: SoftNavigationArtifact };

/**
 * Lets a stock audit that needs the document request of the navigation run on a soft navigation,
 * which has none. A page load is audited by the stock audit, unchanged.
 *
 * @param onSoftNavigation `timespan` runs the audit the way Lighthouse runs it in a timespan,
 *   where it already works without a document request. `notApplicable` is for audits that assert
 *   something about the document response.
 */
export function withoutDocumentRequest<T extends AuditClass>(
  StockAudit: T,
  onSoftNavigation: 'timespan' | 'notApplicable',
): T {
  // @ts-expect-error TypeScript does not see a class that only overrides statics as a mixin.
  return class extends StockAudit {
    static override get meta(): LH.Audit.Meta {
      const meta = super.meta;
      return {
        ...meta,
        requiredArtifacts: [
          ...meta.requiredArtifacts,
          'SoftNavigation' as keyof LH.Artifacts,
        ],
      };
    }

    static override audit(
      artifacts: LH.Artifacts,
      context: LH.Audit.Context,
    ): ReturnType<AuditClass['audit']> {
      if (!(artifacts as Artifacts).SoftNavigation) {
        return super.audit(artifacts, context);
      }
      if (onSoftNavigation === 'notApplicable') {
        return { score: null, notApplicable: true };
      }
      return super.audit(
        { ...artifacts, GatherContext: { gatherMode: 'timespan' } },
        context,
      );
    }
  };
}

/** Audits of the requests and resources of the navigation. They also work on a timespan. */
const timespanAudits = {
  'network-requests': NetworkRequests,
  'byte-efficiency/unminified-css': UnminifiedCss,
  'byte-efficiency/unminified-javascript': UnminifiedJavascript,
  'byte-efficiency/unused-css-rules': UnusedCssRules,
  'byte-efficiency/unused-javascript': UnusedJavascript,
} satisfies Record<string, AuditClass>;

/** Audits of the document response: its timing, redirects, status, headers and content. */
const documentResponseAudits = {
  'server-response-time': ServerResponseTime,
  redirects: Redirects,
  diagnostics: Diagnostics,
  'csp-xss': CspXss,
  'has-hsts': HasHsts,
  'origin-isolation': OriginIsolation,
  'clickjacking-mitigation': ClickjackingMitigation,
  'trusted-types-xss': TrustedTypesXss,
  'dobetterweb/charset': Charset,
  'seo/http-status-code': HttpStatusCode,
  'seo/is-crawlable': IsCrawlable,
  'seo/hreflang': Hreflang,
  'seo/canonical': Canonical,
} satisfies Record<string, AuditClass>;

/**
 * The stock audits that need the document request, by their path in the default config, wrapped
 * for soft navigations.
 *
 * Upstream, `network-requests` already notes that the main resource only exists for navigations;
 * a soft navigation is the second case of that.
 */
export const documentRequestAudits: Record<string, AuditClass> = {
  ...wrap(timespanAudits, 'timespan'),
  ...wrap(documentResponseAudits, 'notApplicable'),
};

function wrap(
  audits: Record<string, AuditClass>,
  onSoftNavigation: 'timespan' | 'notApplicable',
): Record<string, AuditClass> {
  return Object.fromEntries(
    Object.entries(audits).map(([path, StockAudit]) => [
      path,
      withoutDocumentRequest(StockAudit, onSoftNavigation),
    ]),
  );
}
