import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/packages/simulated-throttling-spike',
  test: {
    name: 'simulated-throttling-spike',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.mjs'],
    reporters: ['default'],
  },
}));
