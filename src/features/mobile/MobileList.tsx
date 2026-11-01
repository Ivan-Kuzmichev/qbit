import { useVirtualizer } from '@tanstack/react-virtual'
import { Gauge, Pause, Play, Tag, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { t } from '../../i18n/ru'
import { navigate } from '../../lib/router'
import { useDialogs } from '../../store/dialogs'
import { useTorrents } from '../../store/torrents'
import { useUi } from '../../store/ui'
import { runTorrentAction } from '../torrents/actions'
import { selectVisible } from '../torrents/sortTorrents'
import { uiStatus } from '../torrents/status'
import { ActionSheet, type ActionSheetItem } from './ActionSheet'
import styles from './MobileList.module.css'
import { MOBILE_ROW_HEIGHT, MobileRow } from './MobileRow'
import { useLongPress } from './useLongPress'

const hashOf = (target: EventTarget | null): string | null =>
  (target as HTMLElement | null)?.closest?.<HTMLElement>('a[data-hash]')?.dataset.hash ?? null

type Sheet = { hash: string; view: 'main' | 'category' }

function TorrentSheet({ sheet, onChange, onClose }: { sheet: Sheet; onChange(s: Sheet): void; onClose(): void }) {
  const torrent = useTorrents((s) => s.torrents[sheet.hash])
  const categories = useTorrents((s) => s.categories)
  // the torrent may be removed elsewhere while the sheet is open
  useEffect(() => {
    if (!torrent) onClose()
  }, [torrent, onClose])
  if (!torrent) return null

  const hashes = [sheet.hash]
  /** Closes first so the sheet never sits under a dialog it opened. */
  const then = (fn: () => void) => () => {
    onClose()
    fn()
  }

  if (sheet.view === 'category') {
    const names = Object.keys(categories).sort((a, b) => a.localeCompare(b, 'ru'))
    const pick = (category: string) => then(() => void runTorrentAction('torrents/setCategory', hashes, { category }))
    const items: ActionSheetItem[] = [
      { id: '', label: t.menu.noCategory, checked: torrent.category === '', onSelect: pick('') },
      ...names.map((name) => ({ id: name, label: name, checked: torrent.category === name, onSelect: pick(name) })),
    ]
    return <ActionSheet title={t.mobile.category} items={items} onClose={onClose} />
  }

  const paused = uiStatus(torrent).action === 'start'
  const items: ActionSheetItem[] = [
    paused
      ? { id: 'start', label: t.menu.start, icon: <Play size={18} aria-hidden="true" />, onSelect: then(() => void runTorrentAction('torrents/start', hashes)) }
      : { id: 'stop', label: t.menu.pause, icon: <Pause size={18} aria-hidden="true" />, onSelect: then(() => void runTorrentAction('torrents/stop', hashes)) },
    { id: 'limits', label: t.mobile.limits, icon: <Gauge size={18} aria-hidden="true" />, onSelect: then(() => useDialogs.getState().openLimits('torrent', hashes)) },
    { id: 'category', label: t.mobile.category, icon: <Tag size={18} aria-hidden="true" />, onSelect: () => onChange({ ...sheet, view: 'category' }) },
    { id: 'remove', label: t.mobile.remove, icon: <Trash2 size={18} aria-hidden="true" />, danger: true, onSelect: then(() => useDialogs.getState().openDelete(hashes)) },
  ]
  return <ActionSheet title={torrent.name} items={items} onClose={onClose} />
}

export function MobileList() {
  const torrents = useTorrents((s) => s.torrents)
  const filter = useUi((s) => s.filter)
  const search = useUi((s) => s.search)
  const sort = useUi((s) => s.sort)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const closeSheet = useCallback(() => setSheet(null), [])

  const list = useMemo(() => selectVisible({ torrents }, { filter, search, sort }), [torrents, filter, search, sort])

  const scroller = useRef<HTMLDivElement>(null)
  // TanStack Virtual returns unmemoizable functions; nothing here is passed to memoized children
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => MOBILE_ROW_HEIGHT,
    overscan: 8,
    getItemKey: (i) => list[i].hash,
  })

  const press = useLongPress((target) => {
    const hash = hashOf(target)
    if (hash) setSheet({ hash, view: 'main' })
  })

  // One handler for all rows keeps the memoized rows untouched. The long-press hook swallows the click after a hold.
  function onClick(e: MouseEvent) {
    const hash = hashOf(e.target)
    if (!hash) return
    e.preventDefault()
    navigate(`/torrent/${hash}`)
  }

  return (
    <div className={styles.card}>
      <div ref={scroller} className={styles.scroller}>
        <div
          role="list"
          aria-label={t.mobile.torrentList}
          className={styles.list}
          style={{ height: virtualizer.getTotalSize() }}
          onClick={onClick}
          {...press}
        >
          {virtualizer.getVirtualItems().map((v) => (
            <MobileRow key={list[v.index].hash} torrent={list[v.index]} top={v.start} index={v.index} count={list.length} />
          ))}
        </div>
      </div>
      {sheet && <TorrentSheet key={sheet.view} sheet={sheet} onChange={setSheet} onClose={closeSheet} />}
    </div>
  )
}
