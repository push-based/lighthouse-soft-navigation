export { softNavigationConfig } from './lib/config.js';
export {
  SoftNavigationAudit,
  MULTIPLE_SOFT_NAVIGATIONS_WARNING,
  NO_SOFT_NAVIGATION_WARNING,
  SIMULATED_THROTTLING_WARNING,
} from './lib/audits/soft-navigation.js';
export { withoutDocumentRequest } from './lib/audits/document-request.js';
export {
  SoftNavigation,
  type SoftNavigationArtifact,
} from './lib/gatherers/soft-navigation.js';
export { SoftNavigationTrace } from './lib/gatherers/trace.js';
export { SoftNavigationLinkElements } from './lib/gatherers/link-elements.js';
export { SoftNavigationMainDocumentContent } from './lib/gatherers/main-document-content.js';
export {
  softNavigationStarts,
  withPageLoadEvents,
  type SoftNavigationStartEvent,
} from './lib/trace/page-load-events.js';
