import LinkElements from 'lighthouse/core/gather/gatherers/link-elements.js';
import type * as LH from 'lighthouse/types/lh.js';
import {
  SoftNavigation,
  type SoftNavigationArtifact,
} from './soft-navigation.js';

/**
 * The stock gatherer reads links from the DOM and from the `Link` headers of the document
 * response. A soft navigation has no document response, so its links come from the DOM only.
 */
export class SoftNavigationLinkElements extends LinkElements {
  constructor() {
    super();
    this.meta = {
      ...this.meta,
      dependencies: {
        ...this.meta.dependencies,
        SoftNavigation: SoftNavigation.symbol,
      },
    } as typeof this.meta;
  }

  override async getArtifact(
    context: LH.Gatherer.Context<'DevtoolsLog'>,
  ): Promise<LH.Artifacts['LinkElements']> {
    const { SoftNavigation: navigation } = context.dependencies as {
      SoftNavigation?: SoftNavigationArtifact;
    };
    if (!navigation) return super.getArtifact(context);

    const links = await LinkElements.getLinkElementsInDOM(context);
    for (const link of links) link.rel = link.rel.toLowerCase();
    return links;
  }
}
