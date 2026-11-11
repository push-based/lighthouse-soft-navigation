import Trace from 'lighthouse/core/gather/gatherers/trace.js';
import type * as LH from 'lighthouse/types/lh.js';
import { withPageLoadEvents } from '../trace/page-load-events.js';
import {
  SoftNavigation,
  type SoftNavigationArtifact,
} from './soft-navigation.js';

/**
 * The stock trace gatherer, with the soft navigation as the navigation of the trace.
 *
 * It keeps the symbol of the stock gatherer, so every gatherer that depends on the trace gets
 * this one.
 */
export class SoftNavigationTrace extends Trace {
  constructor() {
    super();
    this.meta = {
      ...this.meta,
      dependencies: { SoftNavigation: SoftNavigation.symbol },
    } as LH.Gatherer.GathererMeta;
  }

  override getArtifact(context?: LH.Gatherer.Context): LH.Trace {
    const trace = super.getArtifact();
    const { SoftNavigation: navigation } = (context?.dependencies ?? {}) as {
      SoftNavigation?: SoftNavigationArtifact;
    };
    return navigation ? withPageLoadEvents(trace) : trace;
  }
}
