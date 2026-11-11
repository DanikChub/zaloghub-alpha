// Run after build. Owns only a random schema in an explicitly selected local test DB.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { PrismaModule } from '../dist/prisma/prisma.module.js';
import { MarketplaceModule } from '../dist/marketplace/marketplace.module.js';
const url = process.env.TEST_DATABASE_URL;
assert.ok(url, 'Set TEST_DATABASE_URL explicitly');
const target = new URL(url);
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname));
assert.equal(target.pathname, '/zaloghub_migration_test');
const schema = `marketplace_http_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Client({ connectionString: url });
await admin.connect();
let db, app;
try {
  await admin.query(`CREATE SCHEMA "${schema}"`);
  await admin.query(`SET search_path TO "${schema}",public`);
  for (const entry of (
    await readdir(new URL('../prisma/migrations/', import.meta.url), {
      withFileTypes: true,
    })
  )
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await admin.query(
      await readFile(
        new URL(
          `../prisma/migrations/${entry.name}/migration.sql`,
          import.meta.url,
        ),
        'utf8',
      ),
    );
  db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: url, options: `-c search_path=${schema},public` },
      { schema },
    ),
  });
  const secret = randomUUID(),
    collectorToken = randomUUID();
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        skipProcessEnv: true,
        load: [
          () => ({
            JWT_SECRET: secret,
            MARKETPLACE_COLLECTOR_TOKEN: collectorToken,
          }),
        ],
      }),
      PrismaModule,
      MarketplaceModule,
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(db)
    .compile();
  app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  const http = request(app.getHttpServer());
  const jwt = new JwtService({ secret });
  const users = await Promise.all(
    [1, 2].map((i) =>
      db.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          passwordHash: 'fixture',
        },
      }),
    ),
  );
  const auth = users.map((u) => `Bearer ${jwt.sign({ sub: u.id })}`);
  const source = await db.marketplaceSource.create({
    data: { key: 'zalog-doveriya', title: 'Fixture', channelId: '-10012345' },
  });
  await http.get('/marketplace/offers').expect(401);
  await http.get('/internal/marketplace/sources').expect(401);
  await http
    .get('/internal/marketplace/sources')
    .set('x-collector-token', 'incorrect')
    .expect(401);
  const sources = await http
    .get('/internal/marketplace/sources')
    .set('x-collector-token', collectorToken)
    .expect(200);
  assert.equal(sources.body[0].id, source.id);
  const raw = {
    sourceId: source.id,
    externalMessageId: '1',
    messageIds: ['1'],
    text: 'исходный текст без параметров',
    publishedAt: '2026-11-08T00:00:00Z',
    revisionAt: '2026-11-08T00:00:00Z',
  };
  const ingest = () =>
    http
      .post('/internal/marketplace/messages')
      .set('x-collector-token', collectorToken)
      .field('raw', JSON.stringify(raw))
      .attach('photos', Buffer.from([255, 216, 255, 1]), '1.jpg');
  const first = await ingest().expect(201);
  await ingest().expect(201);
  const id = first.body.id;
  await http
    .patch(`/marketplace/offers/${id}/mark`)
    .set('Authorization', auth[0])
    .send({ saved: true })
    .expect(200);
  await http
    .patch(`/marketplace/offers/${id}/mark`)
    .set('Authorization', auth[0])
    .send({ saved: true, userId: users[1].id })
    .expect(400);
  const detail = await http
    .get(`/marketplace/offers/${id}`)
    .set('Authorization', auth[1])
    .expect(200);
  assert.deepEqual(detail.body.marks, []);
  assert.equal(detail.body.rawText, raw.text);
  assert.equal(detail.body.photos.length, 1);
  await http.get(`/marketplace/photos/${detail.body.photos[0].id}`).expect(401);
  await http
    .get(`/marketplace/photos/${detail.body.photos[0].id}`)
    .set('Authorization', auth[0])
    .expect('Content-Type', 'image/jpeg')
    .expect(200);
  const saved = await http
    .get('/marketplace/offers?view=saved')
    .set('Authorization', auth[0])
    .expect(200);
  assert.equal(saved.body.total, 1);
  const other = await http
    .get('/marketplace/offers?view=saved')
    .set('Authorization', auth[1])
    .expect(200);
  assert.equal(other.body.total, 0);
  await http
    .get('/marketplace/offers?minAmount=NaN')
    .set('Authorization', auth[0])
    .expect(400);
  console.log(
    'PASS: HTTP auth, collector protection, multipart delivery, deduplication, photos, marks and validation',
  );
} finally {
  await app?.close();
  await db?.$disconnect();
  await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.end();
}
