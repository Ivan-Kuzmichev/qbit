import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { t } from '../../i18n/ru'
import { useDialogs } from '../../store/dialogs'
import { useTorrents } from '../../store/torrents'
import { useUi } from '../../store/ui'
import { gridTemplate, visibleColumns } from './columns'
import { ContextMenu, type ContextMenuProps } from './ContextMenu'
import { ALL_FILTER } from './filters'
import { selectVisible } from './sortTorrents'
import { TableHeader } from './TableHeader'
import { ROW_HEIGHT, TorrentRow } from './TorrentRow'
import styles from './TorrentTable.module.css'

const MIN_WIDTH = 900

/** Falls back to "all" when the selected category or tag no longer exists. */
function useResetStaleFilter() {
  const filter = useUi((s) => s.filter)
  const setFilter = useUi((s) => s.setFilter)
  const categories = useTorrents((s) => s.categories)
  const tags = useTorrents((s) => s.tags)
  useEffect(() => {
    const gone =
      (filter.type === 'category' && !(filter.value in categories)) ||
      (filter.type === 'tag' && !tags.includes(filter.value))
    if (gone) setFilter(ALL_FILTER)
  }, [filter, categories, tags, setFilter])
}

const hashOf = (e: MouseEvent): string | null =>
  (e.target as HTMLElement).closest<HTMLElement>('[role="row"][data-hash]')?.dataset.hash ?? null

/** Opens the dialog in the shared host; Limits and Move/Delete all start from the context menu. */
const openFromMenu: NonNullable<ContextMenuProps['onDialog']> = (kind, hashes) => {
  const d = useDialogs.getState()
  if (kind === 'delete') d.openDelete(hashes)
  else if (kind === 'move') d.openMove(hashes)
  else d.openLimits('torrent', hashes)
}

export function TorrentTable({ onDialog = openFromMenu }: Pick<ContextMenuProps, 'onDialog'> = {}) {
  useResetStaleFilter()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  const torrents = useTorrents((s) => s.torrents)
  const selected = useTorrents((s) => s.selected)
  const filter = useUi((s) => s.filter)
  const search = useUi((s) => s.search)
  const sort = useUi((s) => s.sort)
  const optional = useUi((s) => s.columns)

  const list = useMemo(() => selectVisible({ torrents }, { filter, search, sort }), [torrents, filter, search, sort])
  const columns = useMemo(() => visibleColumns(optional), [optional])
  const template = useMemo(() => gridTemplate(columns), [columns])

  const scroller = useRef<HTMLDivElement>(null)
  // TanStack Virtual returns unmemoizable functions; nothing here is passed to memoized children
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: (i) => list[i].hash,
  })

  // One handler for all rows keeps the memoized rows untouched.
  function onClick(e: MouseEvent) {
    const hash = hashOf(e)
    if (!hash || (e.target as HTMLElement).closest('button')) return
    const order = list.map((x) => x.hash)
    useTorrents.getState().select(hash, e.shiftKey ? 'range' : e.ctrlKey || e.metaKey ? 'toggle' : 'single', order)
  }
  function onContextMenu(e: MouseEvent) {
    const hash = hashOf(e)
    if (!hash) return
    e.preventDefault()
    // the menu hands focus back to this row when it closes
    ;(e.target as HTMLElement).closest<HTMLElement>('[role="row"]')?.focus({ preventScroll: true })
    const state = useTorrents.getState()
    if (!state.selected.has(hash)) state.select(hash, 'single', list.map((x) => x.hash))
    setMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <div className={styles.card}>
      <div ref={scroller} className={styles.scroller}>
        <div
          role="grid"
          aria-label={t.table.label}
          aria-rowcount={list.length + 1}
          className={styles.table}
          style={{ minWidth: MIN_WIDTH }}
        >
          <TableHeader columns={columns} template={template} />
          <div
            role="rowgroup"
            className={styles.body}
            style={{ height: virtualizer.getTotalSize() }}
            onClick={onClick}
            onContextMenu={onContextMenu}
          >
            {virtualizer.getVirtualItems().map((v) => {
              const tor = list[v.index]
              return (
                <TorrentRow
                  key={tor.hash}
                  torrent={tor}
                  columns={columns}
                  template={template}
                  index={v.index}
                  top={v.start}
                  selected={selected.has(tor.hash)}
                />
              )
            })}
          </div>
        </div>
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} onClose={closeMenu} onDialog={onDialog} />}
    </div>
  )
}
