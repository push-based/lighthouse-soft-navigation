/**
 * Serves the fixture app and runs `user-flow collect` against it. Without an argument it uses the
 * `.user-flowrc.json` of the project, with the flows of `user-flows/`; with one, the rc file at that
 * path. Exits with the exit code of user-flow.
 */
import { spawn } from 'node:child_process';
import { startAppServer } from './app-server.mjs';

const [rcPath] = process.argv.slice(2);
const server = await startAppServer();

try {
  // Not spawnSync: the app server runs in this process and has to keep answering requests.
  const userFlow = spawn(
    'npx',
    [
      'user-flow',
      'collect',
      '--url',
      `${server.origin}/`,
      '--no-interactive',
      ...(rcPath ? ['--rcPath', rcPath] : []),
    ],
    { stdio: 'inherit' },
  );
  process.exitCode = await new Promise((resolve) =>
    userFlow.on('exit', (code) => resolve(code ?? 1)),
  );
} finally {
  await server.close();
}
