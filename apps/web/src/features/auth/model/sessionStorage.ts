const sessionKey = 'zaloghub.accessToken'
const deviceKey = 'zaloghub.trustedDeviceToken'

export function readToken(key = sessionKey): string | null {
  try {
    const token = localStorage.getItem(key)
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
      localStorage.removeItem(key)
      return null
    }
    return token
  } catch {
    return null
  }
}

export function saveToken(token: string | null, key = sessionKey) {
  try {
    if (token) localStorage.setItem(key, token)
    else localStorage.removeItem(key)
  } catch {
    // Browsers with blocked storage can still use the current session.
  }
}

export const readTrustedDevice = () => readToken(deviceKey)
export const rememberDevice = (token: string) => saveToken(token, deviceKey)
