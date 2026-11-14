-- Dedicated source for measuring text-only Telegram delivery latency.
-- Repeating this statement does not modify an existing source.
INSERT INTO marketplace_sources (
  id, key, title, "channelId", "channelUsername",
  "contactUrl", enabled, "parseImages"
)
VALUES (
  gen_random_uuid()::text,
  'test-transport',
  'Тест транспорта ZalogHub',
  '-1004346478796',
  'test_zaloghub',
  NULL,
  true,
  false
)
ON CONFLICT DO NOTHING;

SELECT id, key, title, "channelId", "channelUsername", enabled, "parseImages"
FROM marketplace_sources
WHERE key = 'test-transport' OR "channelId" = '-1004346478796';
