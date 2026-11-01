import {
  ArrowDown, ArrowUp, Check, CircleAlert, Clock, FolderInput, Pause, Play, RotateCw, ScanSearch,
  type LucideIcon,
} from 'lucide-react'
import { memo } from 'react'
import type { Torrent } from '../../api/types'
import { IconButton } from '../../components/ui/IconButton'
import { Progress } from '../../components/ui/Progress'
import { t } from '../../i18n/ru'
import { formatBytes, formatDate, formatSpeed } from '../../lib/format'
import { shownSpeed, type Column } from './columns'
import { runRowAction } from './actions'
import { uiStatus, type RowAction, type UiKind } from './status'
import styles from './TorrentRow.module.css'

export const ROW_HEIGHT = 48

export const STATUS_VIEW: Record<UiKind, { Icon: LucideIcon; color: string; tone: 'accent' | 'done' | 'dim' }> = {
  downloading: { Icon: ArrowDown, color: 'var(--accent)', tone: 'accent' },
  seeding: { Icon: ArrowUp, color: 'var(--seed)', tone: 'done' },
  done: { Icon: Check, color: 'var(--text-2)', tone: 'done' },
  paused: { Icon: Pause, color: 'var(--muted)', tone: 'dim' },
  queued: { Icon: Clock, color: 'var(--queue)', tone: 'dim' },
  checking: { Icon: ScanSearch, color: 'var(--muted)', tone: 'dim' },
  moving: { Icon: FolderInput, color: 'var(--muted)', tone: 'dim' },
  error: { Icon: CircleAlert, color: 'var(--danger)', tone: 'dim' },
}

const ACTION_ICON: Record<Exclude<RowAction, null>, LucideIcon> = {
  stop: Pause,
  start: Play,
  forceStart: Play,
  recheck: RotateCw,
}

function actionLabel(action: Exclude<RowAction, null>, kind: UiKind): string {
  switch (action) {
    case 'stop':
      return t.rowAction.stop
    case 'start':
      return kind === 'done' ? t.rowAction.startSeeding : t.rowAction.start
    case 'forceStart':
      return t.rowAction.forceStart
    case 'recheck':
      return t.rowAction.recheck
  }
}

export interface TorrentRowProps {
  torrent: Torrent
  columns: Column[]
  /** CSS `grid-template-columns` for `columns`. */
  template: string
  /** 0-based position in the visible list. */
  index: number
  /** Offset from the top of the list in px. */
  top: number
  selected: boolean
}

function Cell({ column, torrent, status }: { column: Column; torrent: Torrent; status: ReturnType<typeof uiStatus> }) {
  const kind = status.kind
  const view = STATUS_VIEW[kind]
  switch (column.id) {
    case 'name':
      return (
        <div role="gridcell" className={styles.name}>
          <span className={styles.title} title={torrent.name}>{torrent.name}</span>
          <span className={styles.sub}>{status.sub}</span>
        </div>
      )
    case 'status':
      return (
        <span role="gridcell" className={styles.status} style={{ color: view.color }}>
          <view.Icon size={14} strokeWidth={2.2} aria-hidden="true" />
          {t.status[kind]}
        </span>
      )
    case 'progress':
      return (
        <div role="gridcell" className={styles.progress}>
          <div className={styles.bar}>
            <Progress value={torrent.progress} tone={view.tone} height={12} />
          </div>
          <span className={styles.pct}>{Math.floor((Number.isFinite(torrent.progress) ? torrent.progress : 0) * 100)}%</span>
        </div>
      )
    case 'speed': {
      const sp = shownSpeed(torrent)
      return (
        <span role="gridcell" className={`${styles.mono} ${styles.right}`} style={{ color: sp.dir ? 'var(--text)' : 'var(--dim)' }}>
          {sp.dir ? `${sp.dir === 'down' ? '↓' : '↑'} ${formatSpeed(sp.value)}` : '—'}
        </span>
      )
    }
    case 'size':
      return <span role="gridcell" className={`${styles.mono} ${styles.right} ${styles.strong}`}>{formatBytes(torrent.size)}</span>
    case 'queue':
      return <span role="gridcell" className={`${styles.mono} ${styles.right}`}>{torrent.priority > 0 ? torrent.priority : '—'}</span>
    case 'ratio':
      return <span role="gridcell" className={`${styles.mono} ${styles.right}`}>{Number.isFinite(torrent.ratio) ? Math.max(0, torrent.ratio).toFixed(2) : '—'}</span>
    case 'added':
      return <span role="gridcell" className={`${styles.mono} ${styles.right}`}>{formatDate(torrent.added_on)}</span>
  }
}

export const TorrentRow = memo(function TorrentRow({ torrent, columns, template, index, top, selected }: TorrentRowProps) {
  const status = uiStatus(torrent)
  const { kind, action } = status
  const Icon = action ? ACTION_ICON[action] : null
  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      aria-selected={selected}
      data-hash={torrent.hash}
      data-selected={selected || undefined}
      className={styles.row}
      style={{ gridTemplateColumns: template, height: ROW_HEIGHT, transform: `translateY(${top}px)` }}
    >
      <span role="gridcell" className={styles.actionCell}>
        {Icon && action && (
          <IconButton
            aria-label={actionLabel(action, kind)}
            onClick={() => void runRowAction(torrent, action)}
            style={{ color: kind === 'downloading' ? 'var(--accent)' : 'var(--muted)' }}
          >
            <Icon size={14} strokeWidth={2.2} aria-hidden="true" />
          </IconButton>
        )}
      </span>
      {columns.map((c) => (
        <Cell key={c.id} column={c} torrent={torrent} status={status} />
      ))}
    </div>
  )
})
