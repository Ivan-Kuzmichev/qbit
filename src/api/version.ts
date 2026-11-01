import { api } from './client'

const MIN_API: readonly [number, number] = [2, 11]

export function getAppVersion(): Promise<string> {
  return api.get<string>('app/version')
}

export function getApiVersion(): Promise<string> {
  return api.get<string>('app/webapiVersion')
}

/** WebAPI 2.11+ (qBittorrent 5.0+). Compares numeric parts, not strings. */
export function isApiSupported(v: string): boolean {
  const m = /^(\d+)\.(\d+)/.exec(v.trim())
  if (!m) return false
  const major = Number(m[1])
  const minor = Number(m[2])
  return major > MIN_API[0] || (major === MIN_API[0] && minor >= MIN_API[1])
}
