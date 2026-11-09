import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/packages/lighthouse-soft-navigation-e2e',
  test: {
    name: 'lighthouse-soft-navigation-e2e',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.e2e-test.ts'],
    reporters: ['default'],
    // Starts Verdaccio and publishes the workspace packages to it once for the whole run.
    globalSetup: './global-setup.ts',
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
}));
