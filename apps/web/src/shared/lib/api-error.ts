export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return fallback
  }

  if (error.status === 'FETCH_ERROR') {
    return 'Не удалось подключиться к серверу. Проверьте соединение.'
  }

  if (error.status === 429) {
    return 'Слишком много попыток. Попробуйте немного позже.'
  }

  if ('data' in error && typeof error.data === 'object' && error.data !== null && 'message' in error.data) {
    const message = error.data.message
    if (typeof message === 'string') return message
    if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
      return message.join('. ')
    }
  }

  return fallback
}
