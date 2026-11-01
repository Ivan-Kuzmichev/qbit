import { Copy } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Properties, Torrent } from '../../api/types'
import { toast } from '../../components/ui/Toast'
import { t } from '../../i18n'
import { copyText } from '../../lib/copyText'
import { formatBytes, formatDate, formatEta, formatSpeed } from '../../lib/format'
import styles from './InfoTab.module.css'

export interface InfoTabProps {
  /** `null` until the first response. */
  properties: Properties | null
  torrent: Pick<Torrent, 'category' | 'tags'>
  variant: 'desktop' | 'mobile'
}

const DASH = '—'
const positive = (n: number) => Number.isFinite(n) && n > 0
const limit = (n: number) => (positive(n) ? formatSpeed(n) : t.details.info.unlimited)

async function copyHash(hash: string) {
  toast((await copyText(hash)) ? t.details.info.copied : t.details.info.copyFailed)
}

export function InfoTab({ properties: p, torrent, variant }: InfoTabProps) {
  if (!p) return <p className={styles.loading}>{t.details.info.loading}</p>
  const i = t.details.info

  const hashButton = (hash: string) => (
    <button type="button" className={styles.hash} aria-label={`${i.copyHash} ${hash}`} onClick={() => void copyHash(hash)}>
      <span>{hash}</span>
      <Copy size={12} aria-hidden="true" />
    </button>
  )
  const pieces =
    positive(p.pieces_num) && positive(p.piece_size)
      ? `${p.pieces_num} × ${formatBytes(p.piece_size)}${p.pieces_have >= 0 ? ` · ${p.pieces_have} ${t.details.of} ${p.pieces_num}` : ''}`
      : DASH
  const created = [p.created_by, positive(p.creation_date) ? formatDate(p.creation_date) : ''].filter(Boolean).join(' · ')
  const hash = p.infohash_v1 || p.hash

  const rows: [string, ReactNode, boolean?][] = [
    [i.path, p.save_path || DASH, true],
    [i.category, torrent.category || DASH],
    [i.tags, torrent.tags || DASH],
    [i.added, formatDate(p.addition_date)],
    [i.completed, formatDate(p.completion_date)],
    [i.hash, hash ? hashButton(hash) : DASH, true],
    ...(p.infohash_v2 ? ([[i.hashV2, hashButton(p.infohash_v2), true]] as [string, ReactNode, boolean][]) : []),
    [i.comment, p.comment || DASH],
    [i.created, created || DASH],
    [i.size, positive(p.total_size) ? formatBytes(p.total_size) : DASH],
    [i.pieces, pieces],
    [i.ratio, Number.isFinite(p.share_ratio) && p.share_ratio >= 0 ? p.share_ratio.toFixed(2) : DASH, true],
    [i.seedingTime, positive(p.seeding_time) ? formatEta(p.seeding_time) : DASH],
    [i.limits, `↓ ${limit(p.dl_limit)} · ↑ ${limit(p.up_limit)}`],
  ]

  return (
    <dl className={`${styles.list} ${styles[variant]}`}>
      {rows.map(([label, value, mono]) => (
        <div key={label} className={styles.item}>
          <dt className={styles.label}>{label}</dt>
          <dd className={`${styles.value} ${mono ? styles.mono : ''}`}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
