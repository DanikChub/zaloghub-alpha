import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
assert.ok(
  process.env.TEST_DATABASE_URL,
  'Set TEST_DATABASE_URL to a dedicated local zaloghub_migration_test database',
);
const target = new URL(process.env.TEST_DATABASE_URL);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
assert.equal(target.pathname, '/zaloghub_migration_test');
const result = spawnSync(
  process.execPath,
  [
    'node_modules/vitest/vitest.mjs',
    'run',
    'src/borrower-verifications',
    '--maxWorkers=1',
  ],
  { stdio: 'inherit', windowsHide: true },
);
process.exitCode = result.status ?? 1;
