import { memo } from 'react'
import type { Torrent } from '../../api/types'
import { Progress } from '../../components/ui/Progress'
import { t } from '../../i18n'
import { formatBytes, formatEta, formatSpeed, percentOf } from '../../lib/format'
import { shownSpeed } from '../torrents/columns'
import { uiStatus } from '../torrents/status'
import { STATUS_VIEW } from '../torrents/TorrentRow'
import styles from './MobileRow.module.css'

/** Measured in the browser (e2e/mobile.spec.ts checks it): padding 13+13, name, bar, status, gaps and the 1px border. */
export const MOBILE_ROW_HEIGHT = 87

function meta(tor: Torrent, kind: ReturnType<typeof uiStatus>['kind']): string {
  const sp = shownSpeed(tor)
  if (sp.dir) {
    const speed = `${sp.dir === 'down' ? '↓' : '↑'} ${formatSpeed(sp.value)}`
    return kind === 'downloading' && Number.isFinite(tor.eta) && tor.eta > 0 ? `${speed} · ${formatEta(tor.eta)}` : speed
  }
  return tor.progress >= 1 || kind === 'done' ? formatBytes(tor.size) : `${formatBytes(tor.completed)} / ${formatBytes(tor.size)}`
}

export interface MobileRowProps {
  torrent: Torrent
  top: number
  index: number
  count: number
}

export const MobileRow = memo(function MobileRow({ torrent, top, index, count }: MobileRowProps) {
  const { kind } = uiStatus(torrent)
  const view = STATUS_VIEW[kind]
  const pct = percentOf(torrent.progress)
  return (
    <div
      role="listitem"
      aria-posinset={index + 1}
      aria-setsize={count}
      className={styles.item}
      style={{ height: MOBILE_ROW_HEIGHT, transform: `translateY(${top}px)` }}
    >
      <a href={`#/torrent/${torrent.hash}`} data-hash={torrent.hash} className={styles.row} draggable={false}>
        <span className={styles.icon} style={{ color: view.color }}>
          <view.Icon size={15} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className={styles.body}>
          <span className={styles.name}>{torrent.name}</span>
          <span className={styles.progress}>
            <span className={styles.bar}>
              <Progress value={torrent.progress} tone={view.tone} height={10} />
            </span>
            <span className={styles.pct}>{pct}%</span>
          </span>
          <span className={styles.foot}>
            <span style={{ color: view.color }}>{t.status[kind]}</span>
            <span className={styles.meta}>{meta(torrent, kind)}</span>
          </span>
        </span>
      </a>
    </div>
  )
})
