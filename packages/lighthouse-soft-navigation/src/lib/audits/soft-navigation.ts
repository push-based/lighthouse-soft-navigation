import { Audit } from 'lighthouse';
import type * as LH from 'lighthouse/types/lh.js';
import type { SoftNavigationArtifact } from '../gatherers/soft-navigation.js';
import { softNavigationStarts } from '../trace/page-load-events.js';

/** Same wording as the warning proposed for Lighthouse in GoogleChrome/lighthouse#17075. */
export const MULTIPLE_SOFT_NAVIGATIONS_WARNING =
  'Multiple soft navigations were detected during the run. Only the first soft navigation is measured.';

export const NO_SOFT_NAVIGATION_WARNING =
  'The URL changed without Chrome reporting a soft navigation, so the navigation has no metrics. ' +
  'Make sure the interaction renders new content and that Chrome 149 or newer is being used.';

export const SIMULATED_THROTTLING_WARNING =
  'Simulated throttling cannot be applied to a soft navigation, because there is no document ' +
  "request to simulate from. Run the navigation with `throttlingMethod: 'devtools'` or `'provided'`.";

type Artifacts = LH.Artifacts & { SoftNavigation: SoftNavigationArtifact };

/**
 * Marks a navigation step as a soft navigation, and carries the run warnings that only apply to
 * one. Not applicable for a page load.
 */
export class SoftNavigationAudit extends Audit {
  static override get meta(): LH.Audit.Meta {
    return {
      id: 'soft-navigation',
      title: 'Soft navigation',
      description:
        'The navigation changed the URL and rendered new content without loading a new document. ' +
        'Metrics are measured from the interaction that started it. ' +
        '[Learn more about soft navigations](https://github.com/WICG/soft-navigations).',
      scoreDisplayMode: Audit.SCORING_MODES.INFORMATIVE,
      supportedModes: ['navigation'],
      requiredArtifacts: ['SoftNavigation', 'Trace'] as Array<
        keyof LH.Artifacts
      >,
    };
  }

  static override audit(
    artifacts: LH.Artifacts,
    context: LH.Audit.Context,
  ): LH.Audit.Product {
    const { SoftNavigation: navigation, Trace: trace } = artifacts as Artifacts;
    if (!navigation) return { score: null, notApplicable: true };

    const detected = softNavigationStarts(trace).length;
    const runWarnings: string[] = [];
    if (detected === 0) runWarnings.push(NO_SOFT_NAVIGATION_WARNING);
    if (detected > 1) runWarnings.push(MULTIPLE_SOFT_NAVIGATIONS_WARNING);
    if (context.settings.throttlingMethod === 'simulate') {
      runWarnings.push(SIMULATED_THROTTLING_WARNING);
    }

    return {
      score: 1,
      // Typed as localizable messages, but plain strings are reported as they are.
      runWarnings: runWarnings as unknown as LH.IcuMessage[],
      details: {
        type: 'debugdata',
        url: navigation.url,
        navigationType: navigation.navigationType,
        softNavigations: detected,
      },
    };
  }
}
