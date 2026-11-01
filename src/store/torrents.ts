import { create } from 'zustand'
import { api, NetworkError } from '../api/client'
import type { MainData } from '../api/types'
import { createPoller } from '../lib/poller'
import { emptySync, mergeMainData, type SyncState } from './mergeMainData'

const HISTORY_LEN = 60
const SYNC_INTERVAL_MS = 1000

export type SelectMode = 'single' | 'toggle' | 'range'

interface TorrentsState extends SyncState {
  speedHistory: { dl: number; up: number }[]
  connection: 'ok' | 'lost'
  selected: Set<string>
  anchor: string | null
  select(hash: string, mode: SelectMode, order: string[]): void
  clearSelection(): void
  startSync(): void
  stopSync(): void
  refresh(): Promise<void>
}

export const useTorrents = create<TorrentsState>()((set, get) => ({
  ...emptySync,
  speedHistory: [],
  connection: 'ok',
  selected: new Set(),
  anchor: null,

  select(hash, mode, order) {
    const { selected, anchor } = get()
    if (mode === 'toggle') {
      const next = new Set(selected)
      if (!next.delete(hash)) next.add(hash)
      set({ selected: next, anchor: hash })
    } else if (mode === 'range' && anchor !== null) {
      const a = order.indexOf(anchor)
      const b = order.indexOf(hash)
      if (a < 0 || b < 0) {
        set({ selected: new Set([hash]), anchor: hash })
        return
      }
      const [from, to] = a <= b ? [a, b] : [b, a]
      set({ selected: new Set(order.slice(from, to + 1)) })
    } else {
      set({ selected: new Set([hash]), anchor: hash })
    }
  },

  clearSelection() {
    set({ selected: new Set(), anchor: null })
  },

  async refresh() {
    let resp: MainData
    try {
      resp = await api.get<MainData>('sync/maindata', { rid: get().rid })
    } catch (e) {
      if (e instanceof NetworkError) {
        set({ connection: 'lost' })
        return
      }
      throw e
    }
    const prev = get()
    const next = mergeMainData(prev, resp)
    const selected = [...prev.selected].filter((h) => h in next.torrents)
    const keepSelection = selected.length === prev.selected.size
    const point = { dl: next.server.dl_info_speed ?? 0, up: next.server.up_info_speed ?? 0 }
    set({
      ...next,
      connection: 'ok',
      speedHistory: [...prev.speedHistory, point].slice(-HISTORY_LEN),
      ...(keepSelection ? {} : { selected: new Set(selected) }),
      ...(prev.anchor !== null && !(prev.anchor in next.torrents) ? { anchor: null } : {}),
    })
  },

  startSync() {
    poller.start()
  },
  stopSync() {
    poller.stop()
  },
}))

const poller = createPoller(() => useTorrents.getState().refresh(), SYNC_INTERVAL_MS)
