import { existsSync } from 'node:fs';
import { defineConfig, env } from 'prisma/config';

// Node's built-in loader does not overwrite an explicitly supplied DATABASE_URL.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
