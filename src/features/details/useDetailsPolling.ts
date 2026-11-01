import { useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../../api/client'
import type { Peer, Properties, TorrentFile, Tracker } from '../../api/types'
import { createPoller } from '../../lib/poller'

export type DetailsTab = 'files' | 'trackers' | 'peers' | 'info'

export interface PeersMeta {
  showFlags: boolean
}

export interface DetailsData {
  properties: Properties | null
  files: TorrentFile[] | null
  pieces: number[]
  trackers: Tracker[] | null
  peers: Peer[]
  peersMeta: PeersMeta
}

interface PeersResponse {
  rid: number
  full_update?: boolean
  peers?: Record<string, Peer>
  peers_removed?: string[]
  show_flags?: boolean
}

interface Store {
  hash: string
  properties: Properties | null
  files: TorrentFile[] | null
  pieces: number[]
  trackers: Tracker[] | null
  peerMap: Record<string, Peer>
  showFlags: boolean
}

const FAST_MS = 2000
const TRACKERS_MS = 5000

const emptyStore = (hash: string): Store => ({
  hash, properties: null, files: null, pieces: [], trackers: null, peerMap: {}, showFlags: false,
})

const EMPTY = emptyStore('')

/**
 * Runs `load` on an interval until cleanup. A 404 (the torrent is gone) stops the loop quietly;
 * other errors are left to the poller, which keeps going. `alive()` turns false at cleanup,
 * so a response that arrives after a torrent or tab switch must be dropped by the caller.
 */
function poll(ms: number, load: (alive: () => boolean) => Promise<void>): () => void {
  let live = true
  const alive = () => live
  const poller = createPoller(async () => {
    try {
      await load(alive)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) poller.stop()
      throw e
    }
  }, ms)
  poller.start()
  return () => {
    live = false
    poller.stop()
  }
}

/**
 * Live data for one torrent. Properties and pieces are polled while `hash` is set; files, peers
 * and trackers only while their tab is open. Responses of a previous torrent are discarded.
 */
export function useDetailsPolling(hash: string | null, tab: DetailsTab): DetailsData {
  const [store, setStore] = useState<Store>(() => emptyStore(''))

  useEffect(() => {
    if (!hash) return
    const patch = (fn: (s: Store) => Partial<Store>) =>
      setStore((prev) => {
        const base = prev.hash === hash ? prev : emptyStore(hash)
        return { ...base, ...fn(base) }
      })
    const stops: (() => void)[] = []

    stops.push(
      poll(FAST_MS, async (alive) => {
        const properties = await api.get<Properties>('torrents/properties', { hash })
        if (alive()) patch(() => ({ properties }))
      }),
      poll(FAST_MS, async (alive) => {
        const pieces = await api.get<number[]>('torrents/pieceStates', { hash })
        if (alive()) patch(() => ({ pieces }))
      }),
    )
    if (tab === 'files') {
      stops.push(
        poll(FAST_MS, async (alive) => {
          const files = await api.get<TorrentFile[]>('torrents/files', { hash })
          if (alive()) patch(() => ({ files }))
        }),
      )
    }
    if (tab === 'trackers') {
      stops.push(
        poll(TRACKERS_MS, async (alive) => {
          const trackers = await api.get<Tracker[]>('torrents/trackers', { hash })
          if (alive()) patch(() => ({ trackers }))
        }),
      )
    }
    if (tab === 'peers') {
      let rid = 0
      stops.push(
        poll(FAST_MS, async (alive) => {
          const resp = await api.get<PeersResponse>('sync/torrentPeers', { hash, rid })
          if (!alive()) return
          rid = resp.rid
          patch((s) => {
            const peerMap = resp.full_update ? {} : { ...s.peerMap }
            Object.assign(peerMap, resp.peers)
            for (const key of resp.peers_removed ?? []) delete peerMap[key]
            return { peerMap, showFlags: resp.show_flags ?? s.showFlags }
          })
        }),
      )
    }
    return () => stops.forEach((stop) => stop())
  }, [hash, tab === 'files', tab === 'trackers', tab === 'peers']) // eslint-disable-line react-hooks/exhaustive-deps

  const current = store.hash === hash ? store : EMPTY
  const peers = useMemo(() => Object.values(current.peerMap), [current.peerMap])
  return {
    properties: current.properties,
    files: current.files,
    pieces: current.pieces,
    trackers: current.trackers,
    peers,
    peersMeta: { showFlags: current.showFlags },
  }
}
