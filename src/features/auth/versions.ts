const KEY = 'qbit.versions'

export interface KnownVersions {
  app: string
  api: string
}

export function saveVersions(v: KnownVersions): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    // storage unavailable: the login footer just shows less
  }
}

export function loadVersions(): KnownVersions | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<KnownVersions>
    return typeof v.app === 'string' && typeof v.api === 'string' ? { app: v.app, api: v.api } : null
  } catch {
    return null
  }
}
