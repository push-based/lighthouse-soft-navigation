import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PACKAGE = '@push-based/lighthouse-soft-navigation';

describe(PACKAGE, () => {
  let projectDirectory: string;

  beforeAll(() => {
    projectDirectory = mkdtempSync(
      join(tmpdir(), 'lighthouse-soft-navigation-e2e-'),
    );
    writeFileSync(
      join(projectDirectory, 'package.json'),
      JSON.stringify({
        name: 'consumer',
        version: '0.0.0',
        private: true,
        type: 'module',
      }),
    );
    // startLocalRegistry points npm_config_registry at Verdaccio for this process.
    execSync(`npm install ${PACKAGE}@e2e`, {
      cwd: projectDirectory,
      stdio: 'inherit',
      env: process.env,
    });
  });

  afterAll(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  it('is installed from the local registry', () => {
    const version = execSync(`npm ls ${PACKAGE} --json`, {
      cwd: projectDirectory,
      encoding: 'utf8',
    });
    expect(JSON.parse(version).dependencies[PACKAGE].version).toBe('0.0.0-e2e');
  });

  it('can be imported by a consumer', () => {
    const exports = execSync(
      `node --input-type=module -e "import * as m from '${PACKAGE}'; console.log(JSON.stringify(Object.keys(m)))"`,
      { cwd: projectDirectory, encoding: 'utf8' },
    );
    expect(JSON.parse(exports).length).toBeGreaterThan(0);
  });
});
