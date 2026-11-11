import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// Deliberately do not load .env or fall back to the application database.
assert.ok(
  process.env.TEST_DATABASE_URL,
  'Set TEST_DATABASE_URL to a disposable local zaloghub_migration_test database',
);
const target = new URL(process.env.TEST_DATABASE_URL);
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname),
  'Only a local test database is allowed',
);
assert.equal(
  target.pathname,
  '/zaloghub_migration_test',
  'Refusing a non-test database',
);
const result = spawnSync(
  process.execPath,
  [
    'node_modules/vitest/vitest.mjs',
    'run',
    'src/finance/application/deal-finance.db.spec.ts',
    '--maxWorkers=1',
  ],
  {
    stdio: 'inherit',
    windowsHide: true,
  },
);
process.exitCode = result.status ?? 1;
