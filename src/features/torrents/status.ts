import type { Torrent } from '../../api/types'
import { t } from '../../i18n'
import { formatBytes, formatEta, percentOf, plural } from '../../lib/format'

export type UiKind =
  | 'downloading' | 'seeding' | 'done' | 'paused' | 'queued' | 'checking' | 'moving' | 'error'
export type RowAction = 'stop' | 'start' | 'forceStart' | 'recheck' | null

const pct = (p: number) => `${percentOf(p)}%`
const peers = (n: number) => plural(Number.isFinite(n) ? n : 0, t.plural.peers)

export function uiStatus(tor: Torrent): { kind: UiKind; action: RowAction; sub: string } {
  const s = t.statusSub
  switch (tor.state) {
    case 'downloading':
    case 'forcedDL':
    case 'metaDL':
    case 'forcedMetaDL':
      return {
        kind: 'downloading',
        action: 'stop',
        sub: `${peers((tor.num_seeds || 0) + (tor.num_leechs || 0))} · ${s.remaining} ${formatEta(tor.eta)}`,
      }
    case 'stalledDL':
      return { kind: 'downloading', action: 'stop', sub: s.searchingPeers }
    case 'uploading':
    case 'forcedUP':
    case 'stalledUP':
      return {
        kind: 'seeding',
        action: 'stop',
        sub: `${peers(tor.num_leechs)} · ${s.uploaded} ${formatBytes(tor.uploaded)}`,
      }
    case 'stoppedUP':
      return { kind: 'done', action: 'start', sub: formatBytes(tor.size) }
    case 'stoppedDL':
      return {
        kind: 'paused',
        action: 'start',
        sub: `${formatBytes(tor.completed)} ${s.of} ${formatBytes(tor.size)}`,
      }
    case 'queuedDL':
    case 'queuedUP':
      return { kind: 'queued', action: 'forceStart', sub: s.waitingInQueue }
    case 'checkingDL':
    case 'checkingUP':
    case 'checkingResumeData':
      return { kind: 'checking', action: null, sub: pct(tor.progress) }
    case 'moving':
      return { kind: 'moving', action: null, sub: pct(tor.progress) }
    case 'error':
      return { kind: 'error', action: 'recheck', sub: s.errorText }
    case 'missingFiles':
      return { kind: 'error', action: 'recheck', sub: s.missingFiles }
    default:
      return tor.progress >= 1
        ? { kind: 'done', action: 'start', sub: formatBytes(tor.size) }
        : {
            kind: 'paused',
            action: 'start',
            sub: `${formatBytes(tor.completed)} ${s.of} ${formatBytes(tor.size)}`,
          }
  }
}
