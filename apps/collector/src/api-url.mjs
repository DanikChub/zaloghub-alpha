export function apiUrl(env) {
  const raw = env.MARKETPLACE_API_URL ?? 'http://localhost:3000';
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('Некорректный MARKETPLACE_API_URL');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const compose = env.COLLECTOR_ALLOW_INTERNAL_HTTP === 'true' && url.hostname === 'api' && url.port === '3000';
  if (url.protocol !== 'https:' && !loopback && !compose)
    throw new Error('Для удалённого API нужен HTTPS');
  return raw.replace(/\/$/, '');
}
