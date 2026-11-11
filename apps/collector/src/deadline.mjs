// A pending Promise alone does not keep Node alive. Keep a referenced deadline
// until GramJS settles, and fail visibly if its transport stops making progress.
export class OperationTimeout extends Error {
  constructor(stage) { super(`${stage}: превышено время ожидания`); this.name='OperationTimeout'; }
}
export async function withDeadline(operation, milliseconds, stage) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => { timer=setTimeout(()=>reject(new OperationTimeout(stage)),milliseconds); }),
    ]);
  } finally { clearTimeout(timer); }
}
export function startupFailure(error, stage) {
  if (error instanceof OperationTimeout) return `${error.message}. Проверьте доступ к Telegram и настройки прокси.`;
  if (/AUTH_KEY|SESSION_REVOKED|SESSION_EXPIRED|UNAUTHORIZED|Сессия Telegram недействительна/i.test(error?.message ?? '')) return 'Telegram-сессия недействительна. Нужна действующая TG_SESSION; автоматическая авторизация не запускается.';
  return `Ошибка этапа «${stage}». Проверьте доступ к Telegram, сессию и настройки прокси. Секреты и детали ответа не выводятся.`;
}
