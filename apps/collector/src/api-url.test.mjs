import test from 'node:test';
import assert from 'node:assert/strict';
import { apiUrl } from './api-url.mjs';
test('HTTP stays restricted to loopback and explicitly enabled Compose API', () => {
  assert.equal(apiUrl({}), 'http://localhost:3000');
  assert.equal(apiUrl({ MARKETPLACE_API_URL:'http://api:3000', COLLECTOR_ALLOW_INTERNAL_HTTP:'true' }), 'http://api:3000');
  for(const url of ['http://api:3000', 'http://example.com', 'ftp://localhost:3000', 'https://token@example.com'])
    assert.throws(()=>apiUrl({ MARKETPLACE_API_URL:url }));
  assert.throws(()=>apiUrl({ MARKETPLACE_API_URL:'http://example.com', COLLECTOR_ALLOW_INTERNAL_HTTP:'true' }));
  assert.equal(apiUrl({ MARKETPLACE_API_URL:'https://app.zaloghub.ru/api/' }), 'https://app.zaloghub.ru/api');
});
