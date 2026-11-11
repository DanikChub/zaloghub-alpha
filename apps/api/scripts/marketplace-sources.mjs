import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const path = process.argv[2];
if (!path)
  throw new Error(
    'Укажите JSON-файл источников; --apply для записи в выбранную DATABASE_URL',
  );
const items = JSON.parse(await readFile(path, 'utf8'));
const keys = [
  'zalog-doveriya',
  'mosinvestfinance',
  'aktiv-kapital',
  'fin-expert',
  'kredit-consult',
  'air-if',
];
if (!Array.isArray(items) || !items.length)
  throw new Error('Нужен массив источников');
for (const item of items) {
  if (
    !keys.includes(item.key) ||
    typeof item.title !== 'string' ||
    !item.title.trim() ||
    !/^(-100)?\d+$/.test(item.channelId) ||
    typeof item.enabled !== 'boolean' ||
    typeof item.parseImages !== 'boolean' ||
    (item.channelUsername &&
      !/^[A-Za-z0-9_]{4,32}$/.test(item.channelUsername)) ||
    (item.contactUrl &&
      !/^https:\/\/t\.me\/[A-Za-z0-9_?=&-]+$/.test(item.contactUrl))
  )
    throw new Error('Некорректный источник');
}
console.log(`Проверено источников: ${items.length}`);
if (process.argv.includes('--apply')) {
  if (!process.env.DATABASE_URL) throw new Error('Явно задайте DATABASE_URL');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const s of items)
      await client.query(
        'INSERT INTO marketplace_sources (id,key,title,"channelId","channelUsername","contactUrl",enabled,"parseImages") VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(key) DO UPDATE SET title=EXCLUDED.title,"channelId"=EXCLUDED."channelId","channelUsername"=EXCLUDED."channelUsername","contactUrl"=EXCLUDED."contactUrl",enabled=EXCLUDED.enabled,"parseImages"=EXCLUDED."parseImages"',
        [
          randomUUID(),
          s.key,
          s.title,
          s.channelId,
          s.channelUsername || null,
          s.contactUrl || null,
          s.enabled,
          s.parseImages,
        ],
      );
    await client.query('COMMIT');
    console.log('Источники сохранены');
  } catch {
    await client.query('ROLLBACK');
    throw new Error(
      'Источники не изменены; проверьте миграцию и уникальность каналов',
    );
  } finally {
    await client.end();
  }
} else
  console.log(
    'Проверка без записи. Добавьте --apply после проверки целевой БД.',
  );
