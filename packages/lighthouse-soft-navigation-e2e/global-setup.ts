import { execSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { releasePublish, releaseVersion } from 'nx/release';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    /** A project that installed the package from the local registry, like a consumer would. */
    consumerDirectory: string;
  }
}

const PACKAGE = '@push-based/lighthouse-soft-navigation';
const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));
const manifest = `${workspaceRoot}packages/lighthouse-soft-navigation/package.json`;
const fixtures = fileURLToPath(new URL('./fixtures', import.meta.url));

/**
 * Starts Verdaccio, publishes the package to it under the `e2e` tag and installs it into a
 * consumer project, next to the Lighthouse, Puppeteer and user-flow versions of the workspace.
 */
export default async function setup(project: TestProject) {
  process.chdir(workspaceRoot);
  const originalManifest = readFileSync(manifest, 'utf8');
  const consumerDirectory = mkdtempSync(
    join(tmpdir(), 'lighthouse-soft-navigation-e2e-'),
  );

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
    rmSync(consumerDirectory, { recursive: true, force: true });
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
    installConsumer(consumerDirectory);
  } catch (error) {
    teardown();
    throw error;
  }

  project.provide('consumerDirectory', consumerDirectory);
  return teardown;
}

function installConsumer(directory: string) {
  const { devDependencies } = JSON.parse(
    readFileSync(`${workspaceRoot}package.json`, 'utf8'),
  );
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({
      name: 'consumer',
      version: '0.0.0',
      private: true,
      type: 'module',
    }),
  );
  cpSync(fixtures, directory, { recursive: true });

  const run = (command: string) =>
    // startLocalRegistry points npm_config_registry at Verdaccio for this process.
    execSync(command, { cwd: directory, stdio: 'inherit', env: process.env });

  run(
    `npm install ${PACKAGE}@e2e lighthouse@${devDependencies.lighthouse} puppeteer@${devDependencies.puppeteer} @push-based/user-flow@${devDependencies['@push-based/user-flow']}`,
  );
  // npm does not run Puppeteer's install script, so the browser is downloaded here if it is missing.
  run('npx puppeteer browsers install chrome');
}
