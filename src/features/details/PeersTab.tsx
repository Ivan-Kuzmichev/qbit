import { memo } from 'react'
import { createPortal } from 'react-dom'
import type { Peer } from '../../api/types'
import { t } from '../../i18n/ru'
import { formatBytes, formatSpeed } from '../../lib/format'
import { Flag } from './Flag'
import styles from './PeersTab.module.css'

export interface PeersTabProps {
  /** `null` until the first response. */
  peers: readonly Peer[] | null
  /** Peers in the swarm (`num_complete + num_incomplete`); `null` when the tracker reports none. */
  swarm: number | null
  variant: 'desktop' | 'mobile'
  /** Where the summary goes instead of a line of its own: the tab bar, once it is mounted. */
  toolbarTarget?: HTMLElement | null
}

const percent = (p: number) => `${Math.floor(Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0)) * 100)}%`
const address = (p: Peer) => (p.ip.includes(':') ? `[${p.ip}]:${p.port}` : `${p.ip}:${p.port}`)

export function PeersTab({ peers, swarm, variant, toolbarTarget }: PeersTabProps) {
  if (peers === null) return <div className={`${styles.root} ${styles[variant]}`} />
  const summary = `${peers.length} ${t.details.peers.connected}${swarm !== null ? ` · ${swarm} ${t.details.peers.inSwarm}` : ''}`
  return (
    <div className={`${styles.root} ${styles[variant]}`}>
      {toolbarTarget === undefined ? (
        <div className={styles.summary}>{summary}</div>
      ) : (
        toolbarTarget && createPortal(<div className={`${styles.summary} ${styles.summaryOnTabs}`}>{summary}</div>, toolbarTarget)
      )}
      {peers.length === 0 && <p className={styles.empty}>{t.details.peers.empty}</p>}
      {peers.length > 0 && variant === 'desktop' && (
        <div role="table" aria-label={t.details.tabPeers}>
          <div role="row" className={`${styles.grid} ${styles.head}`}>
            <span role="columnheader">{t.details.peers.address}</span>
            <span role="columnheader">{t.details.peers.client}</span>
            <span role="columnheader">{t.details.peers.progress}</span>
            <span role="columnheader" className={styles.num}>{t.details.peers.download}</span>
            <span role="columnheader" className={styles.num}>{t.details.peers.upload}</span>
            <span role="columnheader" className={styles.num}>{t.details.peers.received}</span>
            <span role="columnheader">{t.details.peers.flags}</span>
          </div>
          {peers.map((p) => (
            <PeerRow key={`${p.ip}:${p.port}`} peer={p} variant="desktop" />
          ))}
        </div>
      )}
      {peers.length > 0 && variant === 'mobile' && (
        <ul className={styles.cards}>
          {peers.map((p) => (
            <li key={`${p.ip}:${p.port}`}>
              <PeerRow peer={p} variant="mobile" />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Peers update every 2 s, but the sync merge keeps unchanged peers as the same object: those rows skip rendering.
const PeerRow = memo(function PeerRow({ peer: p, variant }: { peer: Peer; variant: 'desktop' | 'mobile' }) {
  const pct = percent(p.progress)
  const flags = (
    <span className={styles.flags} title={p.flags_desc}>
      {p.flags}
    </span>
  )
  const ip = (
    <span className={styles.addr}>
      <Flag code={p.country_code} name={p.country} />
      <span className={styles.ip}>{address(p)}</span>
    </span>
  )
  const bar = (
    <div className={styles.progress}>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: pct }} />
      </div>
      <span className={styles.pct}>{pct}</span>
    </div>
  )
  const dl = <span className={`${styles.num} ${styles.mono} ${p.dl_speed > 0 ? styles.active : styles.dim}`}>{formatSpeed(p.dl_speed)}</span>
  const ul = <span className={`${styles.num} ${styles.mono} ${styles.muted}`}>{formatSpeed(p.up_speed)}</span>

  if (variant === 'mobile') {
    return (
      <div className={styles.card}>
        <div className={styles.cardTop}>
          {ip}
          {flags}
        </div>
        <span className={styles.client}>{p.client}</span>
        {bar}
        <div className={styles.cardStats}>
          <span>↓ {dl}</span>
          <span>↑ {ul}</span>
          <span className={`${styles.mono} ${styles.muted}`}>{formatBytes(p.downloaded)}</span>
        </div>
      </div>
    )
  }
  return (
    <div role="row" className={`${styles.grid} ${styles.row}`}>
      <span role="cell" className={styles.cellAddr}>{ip}</span>
      <span role="cell" className={styles.client} title={p.client}>{p.client}</span>
      <span role="cell">{bar}</span>
      <span role="cell" className={styles.num}>{dl}</span>
      <span role="cell" className={styles.num}>{ul}</span>
      <span role="cell" className={`${styles.num} ${styles.mono} ${styles.muted}`}>{formatBytes(p.downloaded)}</span>
      <span role="cell">{flags}</span>
    </div>
  )
})
