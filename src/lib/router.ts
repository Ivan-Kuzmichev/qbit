import { useSyncExternalStore } from 'react'

/**
 * Returns true to let the navigation happen. Returning false blocks it; the guard may then ask
 * the user and call `proceed` to carry on to the same target.
 */
export type NavigationGuard = (to: string, proceed: () => void) => boolean

let guard: NavigationGuard | null = null
let lastPath = ''
let restoring = false

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

function currentPath(): string {
  const h = window.location.hash.replace(/^#/, '')
  return h === '' ? '/' : h
}

function go(path: string): void {
  lastPath = path
  window.location.hash = path
}

/** Back/forward and typed hashes bypass `navigate`, so they are checked here and undone if blocked. */
function onHashChange(): void {
  if (restoring) {
    restoring = false
    return
  }
  const to = currentPath()
  if (!guard || to === lastPath) {
    lastPath = to
    return
  }
  const from = lastPath
  if (guard(to, () => go(to))) {
    lastPath = to
    return
  }
  restoring = true
  window.location.hash = from
}

export function navigate(path: string): void {
  if (guard && path !== currentPath() && !guard(path, () => go(path))) return
  go(path)
}

/** At most one guard at a time; pass null to remove it. */
export function setNavigationGuard(next: NavigationGuard | null): void {
  if (next && !guard) {
    lastPath = currentPath()
    window.addEventListener('hashchange', onHashChange)
  } else if (!next && guard) {
    window.removeEventListener('hashchange', onHashChange)
  }
  guard = next
}

export function useRoute(): { path: string; navigate(path: string): void } {
  const path = useSyncExternalStore(subscribe, currentPath, () => '/')
  return { path, navigate }
}
