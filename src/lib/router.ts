import { useSyncExternalStore } from 'react'

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

function currentPath(): string {
  const h = window.location.hash.replace(/^#/, '')
  return h === '' ? '/' : h
}

export function navigate(path: string): void {
  window.location.hash = path
}

export function useRoute(): { path: string; navigate(path: string): void } {
  const path = useSyncExternalStore(subscribe, currentPath, () => '/')
  return { path, navigate }
}
