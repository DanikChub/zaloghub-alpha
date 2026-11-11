import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
try {
  const status = JSON.parse(await readFile(resolve(process.env.COLLECTOR_STORAGE ?? '.local/collector', 'health.json'), 'utf8'));
  const age = Date.now() - status.at;
  process.exitCode = status.connected && status.sources > 0 && age >= 0 && age < 120000 ? 0 : 1;
} catch { process.exitCode = 1; }
