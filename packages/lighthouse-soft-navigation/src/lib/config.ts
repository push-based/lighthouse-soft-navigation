import { defaultConfig } from 'lighthouse';
import type * as LH from 'lighthouse/types/lh.js';
import {
  deepCloneConfigJson,
  mergeConfigFragment,
  mergeConfigFragmentArrayByKey,
} from 'lighthouse/core/config/config-helpers.js';
import { documentRequestAudits } from './audits/document-request.js';
import { SoftNavigationAudit } from './audits/soft-navigation.js';
import { SoftNavigationLinkElements } from './gatherers/link-elements.js';
import { SoftNavigationMainDocumentContent } from './gatherers/main-document-content.js';
import { SoftNavigation } from './gatherers/soft-navigation.js';
import { SoftNavigationTrace } from './gatherers/trace.js';

type ArtifactJson = NonNullable<LH.Config['artifacts']>[number];
type AuditJson = NonNullable<LH.Config['audits']>[number];
type GathererClass = new () => LH.Gatherer.GathererInstance;

const SOFT_NAVIGATION_ARTIFACT = 'SoftNavigation';

/** The gatherers that replace a stock gatherer, by the stock gatherer's path in the default config. */
const gatherers: Record<string, GathererClass> = {
  trace: SoftNavigationTrace,
  'link-elements': SoftNavigationLinkElements,
  'main-document-content': SoftNavigationMainDocumentContent,
};

/**
 * Returns the config with soft navigation support: a navigation step whose interaction only
 * navigates within the document is measured as a navigation, from that interaction.
 *
 * Page loads, timespans and snapshots run exactly as they do with the config that was passed in.
 *
 * @param config A Lighthouse config, `extends: 'lighthouse:default'` included. Defaults to the
 *   default config.
 */
export function softNavigationConfig(config?: LH.Config): LH.Config {
  const resolved = resolveExtension(config);
  // Only the settings that were passed in. Resolving `extends` copies every default setting, and
  // Lighthouse fills those in anyway. A tool that layers its own settings under the config's, like
  // user-flow, would otherwise have every one of them replaced by its default.
  const { settings: _resolvedSettings, ...rest } = resolved;
  const base: LH.Config = {
    ...(config?.settings && { settings: config.settings }),
    ...rest,
  };
  const artifacts = base.artifacts ?? [];
  if (artifacts.some((artifact) => artifact.id === SOFT_NAVIGATION_ARTIFACT)) {
    return resolved === config ? config : base;
  }

  return {
    ...base,
    artifacts: [
      // First, because the gatherers below depend on it.
      {
        id: SOFT_NAVIGATION_ARTIFACT,
        gatherer: { implementation: SoftNavigation },
      } as ArtifactJson,
      ...artifacts.map(overrideGatherer),
    ],
    audits: [
      ...(base.audits ?? []).map(overrideAudit),
      { implementation: SoftNavigationAudit },
    ],
    categories: withSoftNavigationAudit(base.categories, base.groups),
  };
}

/** Resolves `extends` the way Lighthouse does, so that stock gatherers can be replaced by a class. */
function resolveExtension(config: LH.Config = defaultConfig): LH.Config {
  if (!config.extends) return config;

  const { artifacts, extends: _extends, ...extension } = config;
  const base = deepCloneConfigJson(defaultConfig);
  const merged: LH.Config = mergeConfigFragment(base, extension);
  merged.artifacts = mergeConfigFragmentArrayByKey(
    base.artifacts,
    artifacts,
    (artifact) => artifact.id,
  );
  return merged;
}

function overrideGatherer(artifact: ArtifactJson): ArtifactJson {
  const { gatherer } = artifact;
  const path =
    typeof gatherer === 'string'
      ? gatherer
      : 'path' in gatherer
        ? gatherer.path
        : undefined;
  const implementation = path === undefined ? undefined : gatherers[path];
  if (!implementation) return artifact;
  return { ...artifact, gatherer: { implementation } } as ArtifactJson;
}

function overrideAudit(audit: AuditJson): AuditJson {
  if (typeof audit === 'string') {
    const implementation = documentRequestAudits[audit];
    return implementation ? { implementation } : audit;
  }
  if ('path' in audit) {
    const implementation = documentRequestAudits[audit.path];
    return implementation ? { implementation, options: audit.options } : audit;
  }
  return audit;
}

/** Keeps the audit, and with it the run warnings, in runs filtered to the performance category. */
function withSoftNavigationAudit(
  categories: LH.Config['categories'],
  groups: LH.Config['groups'],
): LH.Config['categories'] {
  const performance = categories?.['performance'];
  if (!categories || !performance) return categories;

  const { id } = SoftNavigationAudit.meta;
  return {
    ...categories,
    performance: {
      ...performance,
      auditRefs: [
        ...performance.auditRefs,
        groups?.['hidden']
          ? { id, weight: 0, group: 'hidden' }
          : { id, weight: 0 },
      ],
    },
  };
}
