import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inject } from 'vitest';

const PACKAGE = '@push-based/lighthouse-soft-navigation';

describe(PACKAGE, () => {
  const projectDirectory = inject('consumerDirectory');

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
    expect(JSON.parse(exports)).toContain('softNavigationConfig');
  });

  it('ships type declarations', () => {
    const packageRoot = join(projectDirectory, 'node_modules', PACKAGE);
    const { types } = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8'),
    );
    expect(existsSync(join(packageRoot, types))).toBe(true);
  });
});
