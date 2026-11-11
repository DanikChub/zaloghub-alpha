import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { MarketplaceService } from './marketplace.service.js';
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('Маркетплейс: PostgreSQL и реальные сервисы', () => {
  const schema = `marketplace_test_${randomUUID().replaceAll('-', '')}`;
  let client: pg.Client,
    db: PrismaClient,
    service: MarketplaceService,
    sourceId: string,
    otherSourceId: string;
  const users = [randomUUID(), randomUUID()];
  const raw = () => ({
    sourceId,
    externalMessageId: '10',
    messageIds: ['10'],
    text: '🏢 Квартира\n📍 Адрес: г. Казань, ул. Тестовая, 1\nСумма займа: 2 000 000 ₽\nРыночная стоимость: 4 000 000 ₽\nСтавка: 3% в месяц',
    publishedAt: '2026-11-08T00:00:00Z',
    revisionAt: '2026-11-08T00:00:00Z',
  });
  beforeAll(async () => {
    const target = new URL(url!);
    if (
      !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
      target.pathname !== '/zaloghub_migration_test'
    )
      throw new Error('Нужна отдельная локальная zaloghub_migration_test');
    client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}",public`);
    const migrations = (
      await readdir(new URL('../../prisma/migrations/', import.meta.url))
    ).sort();
    for (const name of migrations)
      if (name !== 'migration_lock.toml')
        await client.query(
          await readFile(
            new URL(
              `../../prisma/migrations/${name}/migration.sql`,
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
    service = new MarketplaceService(db as PrismaService);
    for (const id of users)
      await db.user.create({
        data: { id, email: `${id}@example.test`, passwordHash: 'fixture' },
      });
    sourceId = (
      await db.marketplaceSource.create({
        data: {
          key: 'zalog-doveriya',
          title: 'Fixture',
          channelId: '-10012345',
        },
      })
    ).id;
    otherSourceId = (
      await db.marketplaceSource.create({
        data: { key: 'air-if', title: 'Other', channelId: '-10067890' },
      })
    ).id;
  }, 60000);
  afterAll(async () => {
    await db?.$disconnect();
    if (client) {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  });
  it('параллельная доставка создаёт ровно одно предложение и сохраняет отметки', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => service.ingest(raw(), [])),
    );
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    const id = results[0].id;
    await service.mark(users[0], id, { saved: true, hidden: true });
    await service.ingest(
      {
        ...raw(),
        text: raw().text.replace('2 000 000', '3 000 000'),
        revisionAt: '2026-11-08T01:00:00Z',
      },
      [],
    );
    expect((await service.one(users[0], id)).marks).toEqual([
      { saved: true, hidden: true },
    ]);
    expect((await service.one(users[1], id)).marks).toEqual([]);
    expect((await service.list(users[0], {})).items).toHaveLength(0);
    expect((await service.list(users[1], {})).items).toHaveLength(1);
    expect(
      (await service.list(users[0], { view: 'hidden' })).items,
    ).toHaveLength(1);
    expect(
      (await service.list(users[1], { view: 'saved' })).items,
    ).toHaveLength(0);
    await service.ingest(raw(), []);
    expect(String((await service.one(users[0], id)).loanAmount)).toBe(
      '3000000',
    );
  });
  it('одинаковый адрес в другом канале не объединяется', async () => {
    const r = await service.ingest({ ...raw(), sourceId: otherSourceId }, []);
    expect((await service.one(users[0], r.id)).sourceId).toBe(otherSourceId);
    expect(await db.marketplaceOffer.count()).toBe(2);
  });
  it('альбом имеет стабильную идентичность, фотографии не дублируются', async () => {
    const photo = {
      originalname: '20.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from([255, 216, 255, 1]),
      size: 4,
    };
    const first = await service.ingest(
      {
        ...raw(),
        externalMessageId: '20',
        messageIds: ['20', '21'],
        albumId: '999',
      },
      [photo],
    );
    await service.ingest(
      {
        ...raw(),
        externalMessageId: '21',
        messageIds: ['20', '21'],
        albumId: '999',
      },
      [photo],
    );
    const offer = await service.one(users[0], first.id);
    expect(offer.photos).toHaveLength(1);
    expect(await db.marketplaceOffer.count({ where: { albumId: '999' } })).toBe(
      1,
    );
  });
  it('неразобранный исходник доступен, неизвестная ставка остаётся NULL', async () => {
    const r = await service.ingest(
      {
        ...raw(),
        externalMessageId: '30',
        messageIds: ['30'],
        text: 'исходное сообщение без полей',
      },
      [],
    );
    const o = await service.one(users[0], r.id);
    expect(o.rawText).toBe('исходное сообщение без полей');
    expect(o.interestRateMonthly).toBeNull();
    expect(o.monthlyIncome).toBeNull();
    expect(o.ltv).toBeNull();
  });
  it('не пишет объявления в финансовые таблицы', async () => {
    expect(await db.deal.count()).toBe(0);
    expect(await db.financialEvent.count()).toBe(0);
  });
});
