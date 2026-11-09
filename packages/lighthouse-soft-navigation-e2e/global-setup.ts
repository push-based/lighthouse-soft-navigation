import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { releasePublish, releaseVersion } from 'nx/release';

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));
const manifest = `${workspaceRoot}packages/lighthouse-soft-navigation/package.json`;

/**
 * Starts Verdaccio and publishes the package to it under the `e2e` tag.
 * Tests install it from there, exactly like a consumer would from npm.
 */
export default async function setup() {
  process.chdir(workspaceRoot);
  const originalManifest = readFileSync(manifest, 'utf8');

  const stopLocalRegistry = await startLocalRegistry({
    localRegistryTarget:
      '@push-based/lighthouse-soft-navigation-workspace:local-registry',
    storage: './tmp/local-registry/storage',
    verbose: false,
  });

  const teardown = () => {
    stopLocalRegistry();
    // releaseVersion writes the e2e version into the manifest; put the original back.
    writeFileSync(manifest, originalManifest);
  };

  try {
    await releaseVersion({
      specifier: '0.0.0-e2e',
      stageChanges: false,
      gitCommit: false,
      gitTag: false,
      firstRelease: true,
      versionActionsOptionsOverrides: { skipLockFileUpdate: true },
    });
    await releasePublish({ tag: 'e2e', firstRelease: true });
  } catch (error) {
    teardown();
    throw error;
  }

  return teardown;
}
