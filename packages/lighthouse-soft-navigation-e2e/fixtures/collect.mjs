/**
 * Serves the fixture app and runs `user-flow collect` against it, with the flows of `user-flows/`
 * and the settings of `.user-flowrc.json`. Exits with the exit code of user-flow.
 */
import { spawn } from 'node:child_process';
import { startAppServer } from './app-server.mjs';

const server = await startAppServer();

try {
  // Not spawnSync: the app server runs in this process and has to keep answering requests.
  const userFlow = spawn(
    'npx',
    ['user-flow', 'collect', '--url', `${server.origin}/`, '--no-interactive'],
    { stdio: 'inherit' },
  );
  process.exitCode = await new Promise((resolve) =>
    userFlow.on('exit', (code) => resolve(code ?? 1)),
  );
} finally {
  await server.close();
}
