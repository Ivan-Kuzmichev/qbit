import type { Torrent } from '../../api/types'
import { uiStatus, type UiKind } from './status'

export type Filter =
  | { type: 'status'; value: UiKind | 'all' }
  | { type: 'category'; value: string }
  | { type: 'tag'; value: string }

export const ALL_FILTER: Filter = { type: 'status', value: 'all' }

/** Stable key for a filter, used for counts and React keys. */
export function filterKey(f: Filter): string {
  return `${f.type}:${f.value}`
}

function tagList(tags: string | undefined): string[] {
  return tags ? tags.split(',').map((x) => x.trim()).filter(Boolean) : []
}

/** Checking and moving have no sidebar item of their own, so only "all" shows them. */
export function matchesFilter(t: Torrent, f: Filter): boolean {
  switch (f.type) {
    case 'status':
      return f.value === 'all' || uiStatus(t).kind === f.value
    case 'category':
      return (t.category ?? '') === f.value
    case 'tag':
      return tagList(t.tags).includes(f.value)
  }
}

/** One pass over the list; keys come from `filterKey`. */
export function countByFilter(torrents: Torrent[]): Record<string, number> {
  const counts: Record<string, number> = { [filterKey({ type: 'status', value: 'all' })]: 0 }
  const bump = (key: string) => {
    counts[key] = (counts[key] ?? 0) + 1
  }
  for (const t of torrents) {
    bump(filterKey({ type: 'status', value: 'all' }))
    bump(filterKey({ type: 'status', value: uiStatus(t).kind }))
    if (t.category) bump(filterKey({ type: 'category', value: t.category }))
    for (const tag of tagList(t.tags)) bump(filterKey({ type: 'tag', value: tag }))
  }
  return counts
}
