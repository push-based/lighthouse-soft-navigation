import MainDocumentContent from 'lighthouse/core/gather/gatherers/main-document-content.js';
import type * as LH from 'lighthouse/types/lh.js';
import {
  SoftNavigation,
  type SoftNavigationArtifact,
} from './soft-navigation.js';

/** A soft navigation has no document response, so there is no content to read. */
export class SoftNavigationMainDocumentContent extends MainDocumentContent {
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
  ): Promise<LH.Artifacts['MainDocumentContent']> {
    const { SoftNavigation: navigation } = context.dependencies as {
      SoftNavigation?: SoftNavigationArtifact;
    };
    return navigation ? '' : super.getArtifact(context);
  }
}
