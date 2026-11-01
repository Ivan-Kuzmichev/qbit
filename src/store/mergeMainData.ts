import type { CategoryInfo, MainData, ServerState, Torrent } from '../api/types'

export interface SyncState {
  rid: number
  torrents: Record<string, Torrent>
  categories: Record<string, CategoryInfo>
  tags: string[]
  server: ServerState
}

export const emptySync: SyncState = {
  rid: 0,
  torrents: {},
  categories: {},
  tags: [],
  server: {} as ServerState,
}

/** Applies an incremental `sync/maindata` response. Untouched torrents keep their reference. */
export function mergeMainData(prev: SyncState, resp: MainData): SyncState {
  const base = resp.full_update ? emptySync : prev

  let torrents = base.torrents
  if (resp.torrents || resp.torrents_removed?.length) {
    torrents = { ...base.torrents }
    for (const [hash, patch] of Object.entries(resp.torrents ?? {})) {
      torrents[hash] = { ...torrents[hash], ...patch, hash } as Torrent
    }
    for (const hash of resp.torrents_removed ?? []) delete torrents[hash]
  }

  let categories = base.categories
  if (resp.categories || resp.categories_removed?.length) {
    categories = { ...base.categories }
    for (const [name, patch] of Object.entries(resp.categories ?? {})) {
      categories[name] = { ...categories[name], ...patch }
    }
    for (const name of resp.categories_removed ?? []) delete categories[name]
  }

  let tags = base.tags
  if (resp.tags?.length || resp.tags_removed?.length) {
    const removed = new Set(resp.tags_removed)
    tags = [...new Set([...base.tags, ...(resp.tags ?? [])])].filter((x) => !removed.has(x))
  }

  const server = resp.server_state ? { ...base.server, ...resp.server_state } : base.server

  return { rid: resp.rid, torrents, categories, tags, server }
}
