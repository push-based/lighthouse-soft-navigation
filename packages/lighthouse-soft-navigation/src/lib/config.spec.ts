import { Audit, defaultConfig, desktopConfig } from 'lighthouse';
import type * as LH from 'lighthouse/types/lh.js';
import { initializeConfig } from 'lighthouse/core/config/config.js';
import { documentRequestAudits } from './audits/document-request.js';
import { SoftNavigationAudit } from './audits/soft-navigation.js';
import { softNavigationConfig } from './config.js';
import { SoftNavigationLinkElements } from './gatherers/link-elements.js';
import { SoftNavigationMainDocumentContent } from './gatherers/main-document-content.js';
import { SoftNavigation } from './gatherers/soft-navigation.js';
import { SoftNavigationTrace } from './gatherers/trace.js';

function artifact(config: LH.Config, id: string) {
  return config.artifacts?.find((candidate) => candidate.id === id);
}

async function resolve(
  gatherMode: LH.Gatherer.GatherMode,
  config: LH.Config,
  flags?: LH.Flags,
) {
  const { resolvedConfig } = await initializeConfig(gatherMode, config, flags);
  return {
    artifacts: resolvedConfig.artifacts?.map(({ id }) => id) ?? [],
    audits:
      resolvedConfig.audits?.map(
        ({ implementation }) => implementation.meta.id,
      ) ?? [],
    resolvedConfig,
  };
}

describe('softNavigationConfig', () => {
  it('uses the default config when no config is given', () => {
    const config = softNavigationConfig();

    expect(config.settings).toBe(defaultConfig.settings);
    expect(config.artifacts).toHaveLength(defaultConfig.artifacts!.length + 1);
    expect(config.audits).toHaveLength(defaultConfig.audits!.length + 1);
  });

  it('does not modify the config it is given', () => {
    const before = structuredClone(defaultConfig);

    softNavigationConfig(defaultConfig);

    expect(defaultConfig).toEqual(before);
  });

  it('gathers the soft navigation first, since other gatherers depend on it', () => {
    expect(softNavigationConfig().artifacts?.[0]).toEqual({
      id: 'SoftNavigation',
      gatherer: { implementation: SoftNavigation },
    });
  });

  it('replaces the stock gatherers that need to know about a soft navigation', () => {
    const config = softNavigationConfig();

    expect(artifact(config, 'Trace')).toEqual({
      id: 'Trace',
      gatherer: { implementation: SoftNavigationTrace },
    });
    expect(artifact(config, 'LinkElements')).toEqual({
      id: 'LinkElements',
      gatherer: { implementation: SoftNavigationLinkElements },
    });
    expect(artifact(config, 'MainDocumentContent')).toEqual({
      id: 'MainDocumentContent',
      gatherer: { implementation: SoftNavigationMainDocumentContent },
    });
    expect(artifact(config, 'DevtoolsLog')).toEqual({
      id: 'DevtoolsLog',
      gatherer: 'devtools-log',
    });
  });

  it('replaces a stock gatherer that is configured by path', () => {
    const config = softNavigationConfig({
      artifacts: [{ id: 'Trace', gatherer: { path: 'trace' } }],
    });

    expect(artifact(config, 'Trace')).toEqual({
      id: 'Trace',
      gatherer: { implementation: SoftNavigationTrace },
    });
  });

  it('keeps a gatherer that replaces a stock one', () => {
    class CustomTrace extends SoftNavigationTrace {}
    const custom = { id: 'Trace', gatherer: { implementation: CustomTrace } };

    const config = softNavigationConfig({ artifacts: [custom] });

    expect(artifact(config, 'Trace')).toBe(custom);
  });

  it('replaces the stock audits that need the document request and adds the soft navigation audit', () => {
    const { audits } = softNavigationConfig();

    expect(audits).toContainEqual({
      implementation: documentRequestAudits['network-requests'],
    });
    expect(audits).toContainEqual({
      implementation: documentRequestAudits['seo/canonical'],
    });
    expect(audits).not.toContain('network-requests');
    expect(audits).toContain('metrics/first-contentful-paint');
    expect(audits?.at(-1)).toEqual({ implementation: SoftNavigationAudit });
  });

  it('keeps the options of an audit that is configured by path', () => {
    const { audits } = softNavigationConfig({
      audits: [
        { path: 'redirects', options: { budget: 1 } },
        { path: 'viewport' },
      ],
    });

    expect(audits).toEqual([
      {
        implementation: documentRequestAudits['redirects'],
        options: { budget: 1 },
      },
      { path: 'viewport' },
      { implementation: SoftNavigationAudit },
    ]);
  });

  it('keeps audits that are configured by implementation', () => {
    class Custom extends Audit {}
    const custom = { implementation: Custom };

    expect(softNavigationConfig({ audits: [custom, Custom] }).audits).toEqual([
      custom,
      Custom,
      { implementation: SoftNavigationAudit },
    ]);
  });

  it('adds the soft navigation audit to the performance category without a weight', () => {
    const { categories } = softNavigationConfig();

    expect(categories?.['performance']?.auditRefs.at(-1)).toEqual({
      id: 'soft-navigation',
      weight: 0,
      group: 'hidden',
    });
    expect(categories?.['accessibility']).toBe(
      defaultConfig.categories?.['accessibility'],
    );
  });

  it('does not use a group the config does not have', () => {
    const { categories } = softNavigationConfig({
      categories: { performance: { title: 'Performance', auditRefs: [] } },
    });

    expect(categories?.['performance']?.auditRefs).toEqual([
      { id: 'soft-navigation', weight: 0 },
    ]);
  });

  it('leaves the categories of a config without a performance category alone', () => {
    const categories = { seo: { title: 'SEO', auditRefs: [] } };

    expect(softNavigationConfig({ categories }).categories).toBe(categories);
    expect(softNavigationConfig({}).categories).toBeUndefined();
  });

  it('extends the default config the way Lighthouse does', () => {
    class Custom extends Audit {
      static override get meta(): LH.Audit.Meta {
        return {
          id: 'custom',
          title: 'Custom',
          failureTitle: 'Custom fails',
          description: 'A custom audit.',
          requiredArtifacts: ['Custom' as keyof LH.Artifacts],
        };
      }
    }
    const customArtifact = { id: 'Custom', gatherer: 'devtools-log' };

    const config = softNavigationConfig({
      extends: 'lighthouse:default',
      settings: { onlyCategories: ['performance'] },
      artifacts: [customArtifact],
      audits: [{ implementation: Custom }],
    });

    expect(config.extends).toBeUndefined();
    expect(config.settings).toMatchObject({
      ...defaultConfig.settings,
      onlyCategories: ['performance'],
    });
    expect(artifact(config, 'Trace')?.gatherer).toEqual({
      implementation: SoftNavigationTrace,
    });
    expect(config.artifacts?.at(-1)).toEqual(customArtifact);
    expect(config.audits).toContainEqual({ implementation: Custom });
    expect(config.categories?.['performance']?.auditRefs.at(-1)?.id).toBe(
      'soft-navigation',
    );
  });

  it('returns a config that already supports soft navigations as it is', () => {
    const config = softNavigationConfig(desktopConfig);

    expect(softNavigationConfig(config)).toBe(config);
  });

  describe('resolved by Lighthouse', () => {
    it('is a valid navigation config with the soft navigation gathered before the trace', async () => {
      const { artifacts, audits, resolvedConfig } = await resolve(
        'navigation',
        softNavigationConfig(),
      );

      expect(artifacts.indexOf('SoftNavigation')).toBe(0);
      expect(artifacts).toContain('Trace');
      expect(audits).toContain('soft-navigation');
      expect(
        resolvedConfig.artifacts?.find(({ id }) => id === 'Trace')
          ?.dependencies,
      ).toEqual({ SoftNavigation: { id: 'SoftNavigation' } });
    });

    it('gathers and audits the same as the stock config, plus the soft navigation', async () => {
      const stock = await resolve('navigation', defaultConfig);
      const soft = await resolve('navigation', softNavigationConfig());

      expect(soft.artifacts).toEqual(['SoftNavigation', ...stock.artifacts]);
      expect(soft.audits).toEqual([...stock.audits, 'soft-navigation']);
    });

    it.each([
      ['the performance category', { onlyCategories: ['performance'] }],
      ['the SEO category', { onlyCategories: ['seo'] }],
      ['a single metric', { onlyAudits: ['first-contentful-paint'] }],
    ])(
      'still gathers the soft navigation when filtered to %s',
      async (_, flags) => {
        const { artifacts } = await resolve(
          'navigation',
          softNavigationConfig(),
          flags,
        );

        expect(artifacts).toContain('SoftNavigation');
      },
    );

    it('audits the soft navigation when filtered to the performance category', async () => {
      const { audits } = await resolve('navigation', softNavigationConfig(), {
        onlyCategories: ['performance'],
      });

      expect(audits).toContain('soft-navigation');
    });

    it('supports the desktop config and configs that extend the default config', async () => {
      const desktop = await resolve(
        'navigation',
        softNavigationConfig(desktopConfig),
      );
      const extended = await resolve(
        'navigation',
        softNavigationConfig({ extends: 'lighthouse:default' }),
      );

      expect(desktop.resolvedConfig.settings.formFactor).toBe('desktop');
      expect(desktop.artifacts).toContain('SoftNavigation');
      expect(extended.artifacts).toContain('SoftNavigation');
    });

    it('keeps the trace usable in a timespan and leaves snapshots alone', async () => {
      const stockSnapshot = await resolve('snapshot', defaultConfig);
      const timespan = await resolve('timespan', softNavigationConfig());
      const snapshot = await resolve('snapshot', softNavigationConfig());

      expect(timespan.artifacts).toEqual(
        expect.arrayContaining(['SoftNavigation', 'Trace']),
      );
      expect(timespan.audits).not.toContain('soft-navigation');
      expect(snapshot.artifacts).toEqual(stockSnapshot.artifacts);
      expect(snapshot.audits).toEqual(stockSnapshot.audits);
    });
  });
});
