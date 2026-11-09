import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';
import packageJson from './package.json' with { type: 'json' };

// Installed at runtime instead of bundled (native addons, dynamic requires).
const dependencies = [
  ...Object.keys(
    (packageJson as { dependencies?: Record<string, string> }).dependencies ??
      {},
  ),
  ...Object.keys(
    (packageJson as { peerDependencies?: Record<string, string> })
      .peerDependencies ?? {},
  ),
];

export default defineConfig([
  {
    input: 'src/index.ts',
    platform: 'node',
    tsconfig: 'tsconfig.lib.json',
    external: (id) =>
      dependencies.some((dep) => id === dep || id.startsWith(`${dep}/`)),
    // Emits bundled declarations (index.d.ts) next to the JS output.
    plugins: [
      dts({
        cwd: import.meta.dirname,
        tsconfig: 'tsconfig.lib.json',
        sourcemap: true,
      }),
    ],
    output: {
      dir: 'dist',
      cleanDir: true,
      format: 'esm',
      sourcemap: true,
    },
  },
]);
