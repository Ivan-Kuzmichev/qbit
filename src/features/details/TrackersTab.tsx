import { MoreHorizontal, Plus } from 'lucide-react'
import { memo, useCallback, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Tracker } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Menu } from '../../components/ui/Menu'
import { toast } from '../../components/ui/Toast'
import { t } from '../../i18n'
import styles from './TrackersTab.module.css'

export interface TrackersTabProps {
  /** `null` until the first response. */
  trackers: readonly Tracker[] | null
  /** Rejects when the request fails. */
  onAdd(urls: string[]): Promise<void>
  onRemove(url: string): Promise<void>
  variant: 'desktop' | 'mobile'
  /** Where «Добавить трекер» goes instead of a line of its own: the tab bar, once it is mounted. */
  toolbarTarget?: HTMLElement | null
}

type Kind = 'disabled' | 'updating' | 'working' | 'error'
// 1 is "not contacted yet": the next announce is pending, which reads the same as updating.
const KIND: Record<number, Kind> = { 0: 'disabled', 1: 'updating', 2: 'working', 3: 'updating', 4: 'error' }
const COLOR: Record<Kind, string> = {
  disabled: 'var(--muted)',
  updating: 'var(--queue)',
  working: 'var(--seed)',
  error: 'var(--danger)',
}

/** DHT, PeX and LSD arrive as pseudo-trackers: they are never removable. */
const isPseudo = (url: string) => /^\*\* \[.+\] \*\*$/.test(url)
/** "18 204": a no-break space between thousands. */
const count = (n: number) => (n >= 0 ? String(n).replace(/\B(?=(\d{3})+$)/g, '\u00a0') : '—')

export function TrackersTab({ trackers, onAdd, onRemove, variant, toolbarTarget }: TrackersTabProps) {
  const [adding, setAdding] = useState(false)

  const remove = useCallback(
    (url: string) => {
      onRemove(url).catch(() => toast(t.details.trackers.failed))
    },
    [onRemove],
  )

  const addButton = (
    <Button size="sm" className={`${styles.add} ${toolbarTarget !== undefined ? styles.addOnTabs : ''}`} onClick={() => setAdding(true)}>
      <Plus size={13} strokeWidth={2.2} aria-hidden="true" />
      {t.details.trackers.add}
    </Button>
  )

  return (
    <div className={`${styles.root} ${styles[variant]}`}>
      {toolbarTarget === undefined ? <div className={styles.toolbar}>{addButton}</div> : toolbarTarget && createPortal(addButton, toolbarTarget)}
      {trackers && trackers.length === 0 && <p className={styles.empty}>{t.details.trackers.empty}</p>}
      {trackers && trackers.length > 0 && variant === 'desktop' && (
        <div role="table" aria-label={t.details.tabTrackers}>
          <div role="row" className={`${styles.grid} ${styles.head}`}>
            <span role="columnheader">{t.details.trackers.address}</span>
            <span role="columnheader">{t.details.trackers.status}</span>
            <span role="columnheader" className={styles.num}>{t.details.trackers.seeds}</span>
            <span role="columnheader" className={styles.num}>{t.details.trackers.peers}</span>
            <span role="columnheader" className={styles.num}>{t.details.trackers.downloaded}</span>
            <span role="columnheader">{t.details.trackers.message}</span>
            <span role="columnheader" aria-hidden="true" />
          </div>
          {trackers.map((tr) => (
            <TrackerRow key={tr.url} tracker={tr} variant="desktop" onRemove={remove} />
          ))}
        </div>
      )}
      {trackers && trackers.length > 0 && variant === 'mobile' && (
        <ul className={styles.cards}>
          {trackers.map((tr) => (
            <li key={tr.url}>
              <TrackerRow tracker={tr} variant="mobile" onRemove={remove} />
            </li>
          ))}
        </ul>
      )}
      {adding && <AddDialog onClose={() => setAdding(false)} onAdd={onAdd} />}
    </div>
  )
}

interface RowProps {
  tracker: Tracker
  variant: 'desktop' | 'mobile'
  onRemove(url: string): void
}

const TrackerRow = memo(function TrackerRow({ tracker: tr, variant, onRemove }: RowProps) {
  const kind = KIND[tr.status] ?? 'error'
  const pseudo = isPseudo(tr.url)
  const color = COLOR[kind]
  const status = (
    <span className={styles.status} style={{ color }}>
      <span className={styles.dot} style={{ background: color }} aria-hidden="true" />
      {t.details.trackers.statuses[kind]}
    </span>
  )
  const menu = pseudo ? (
    <span />
  ) : (
    <Menu
      label={`${t.details.trackers.actions} ${tr.url}`}
      triggerClassName={styles.more}
      portal
      items={[{ id: 'remove', label: t.details.trackers.remove, danger: true, onSelect: () => onRemove(tr.url) }]}
    >
      <MoreHorizontal size={16} aria-hidden="true" />
    </Menu>
  )
  const url = (
    <span className={`${styles.url} ${pseudo ? styles.muted : ''}`} title={tr.url}>
      {tr.url}
    </span>
  )

  if (variant === 'mobile') {
    const stat = (label: string, n: number) => (
      <span className={styles.stat}>
        {label} <b>{count(n)}</b>
      </span>
    )
    return (
      <div className={styles.card} data-row data-muted={pseudo}>
        <div className={styles.cardTop}>
          {url}
          {menu}
        </div>
        {status}
        <div className={styles.stats}>
          {stat(t.details.trackers.seeds, tr.num_seeds)}
          {stat(t.details.trackers.peers, tr.num_peers)}
          {stat(t.details.trackers.downloaded, tr.num_downloaded)}
        </div>
        {tr.msg && <span className={styles.msg}>{tr.msg}</span>}
      </div>
    )
  }
  return (
    <div role="row" className={`${styles.grid} ${styles.row}`} data-row data-muted={pseudo}>
      <span role="cell" className={styles.cellUrl}>{url}</span>
      <span role="cell">{status}</span>
      <span role="cell" className={`${styles.num} ${styles.mono}`}>{count(tr.num_seeds)}</span>
      <span role="cell" className={`${styles.num} ${styles.mono}`}>{count(tr.num_peers)}</span>
      <span role="cell" className={`${styles.num} ${styles.mono} ${styles.muted}`}>{count(tr.num_downloaded)}</span>
      <span role="cell" className={styles.msg} title={tr.msg}>{tr.msg}</span>
      <span role="cell" className={styles.menuCell}>{menu}</span>
    </div>
  )
})

function AddDialog({ onClose, onAdd }: { onClose(): void; onAdd(urls: string[]): Promise<void> }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const id = useId()
  const urls = text.split('\n').map((l) => l.trim()).filter(Boolean)

  async function submit() {
    if (urls.length === 0 || busy) return
    setBusy(true)
    try {
      await onAdd(urls)
      onClose()
    } catch {
      toast(t.details.trackers.failed)
      setBusy(false)
    }
  }

  return (
    <Dialog title={t.details.trackers.addTitle} onClose={onClose}>
      <div className={styles.dialogBody}>
        <label htmlFor={id} className={styles.dialogLabel}>
          {t.details.trackers.addLabel}
        </label>
        <textarea
          id={id}
          className={styles.textarea}
          rows={5}
          value={text}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="udp://tracker.example.org:1337/announce"
          onChange={(e) => setText(e.target.value)}
        />
        <div className={styles.dialogActions}>
          <Button onClick={onClose}>{t.details.trackers.cancel}</Button>
          <Button variant="primary" disabled={urls.length === 0 || busy} onClick={() => void submit()}>
            {t.details.trackers.addSubmit}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
