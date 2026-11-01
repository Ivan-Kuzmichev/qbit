import { api, type Params } from '../../api/client'
import type { Torrent } from '../../api/types'
import { toast } from '../../components/ui/Toast'
import { t } from '../../i18n/ru'
import { useTorrents } from '../../store/torrents'
import type { RowAction } from './status'
import { uiStatus } from './status'

/** Selected hashes; empty when nothing is selected. */
export function targetHashes(state: { selected: ReadonlySet<string> }): string[] {
  return [...state.selected]
}

/** Posts a torrent action, then refreshes the list. A failure becomes a toast, never an exception. */
export async function runTorrentAction(path: string, hashes: readonly string[] | 'all', extra: Params = {}): Promise<void> {
  if (hashes !== 'all' && hashes.length === 0) return
  try {
    await api.post(path, { hashes: hashes === 'all' ? 'all' : hashes.join('|'), ...extra })
    await useTorrents.getState().refresh()
  } catch {
    toast(t.actions.failed)
  }
}

/** The per-row button: acts on that row only, whatever is selected. */
export function runRowAction(torrent: Pick<Torrent, 'hash'>, action: Exclude<RowAction, null>): Promise<void> {
  const hashes = [torrent.hash]
  switch (action) {
    case 'stop':
      return runTorrentAction('torrents/stop', hashes)
    case 'start':
      return runTorrentAction('torrents/start', hashes)
    case 'forceStart':
      return runTorrentAction('torrents/setForceStart', hashes, { value: true })
    case 'recheck':
      return runTorrentAction('torrents/recheck', hashes)
  }
}

/** Top bar button: the selection if there is one, otherwise every torrent. */
export function runBulkPause(kind: 'stop' | 'start'): Promise<void> {
  const selected = targetHashes(useTorrents.getState())
  return runTorrentAction(`torrents/${kind}`, selected.length > 0 ? selected : 'all')
}

export function pauseAllLabel(torrents: readonly Torrent[]): 'pause' | 'start' {
  return torrents.length > 0 && torrents.every((x) => uiStatus(x).action === 'start') ? 'start' : 'pause'
}
