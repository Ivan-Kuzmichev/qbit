import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type MouseEvent } from 'react'
import { t } from '../../i18n/ru'
import { useHotkeys } from '../../lib/useHotkeys'
import { useDialogs } from '../../store/dialogs'
import { useTorrents } from '../../store/torrents'
import { useUi } from '../../store/ui'
import { gridTemplate, visibleColumns } from './columns'
import { toggleTorrentsPause } from './actions'
import { ContextMenu, type ContextMenuProps } from './ContextMenu'
import { EmptyState } from './EmptyState'
import { ALL_FILTER } from './filters'
import { selectVisible } from './sortTorrents'
import { TableHeader } from './TableHeader'
import { ROW_HEIGHT, TorrentRow } from './TorrentRow'
import styles from './TorrentTable.module.css'

const MIN_WIDTH = 900
/** Height of the sticky header (TableHeader.module.css): rows scroll under it, so scrolling to a row must leave this much room. */
const HEADER_HEIGHT = 40

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

  const loaded = useTorrents((s) => s.rid > 0)
  const total = useTorrents((s) => Object.keys(s.torrents).length)

  const scroller = useRef<HTMLDivElement>(null)
  // TanStack Virtual returns unmemoizable functions; nothing here is passed to memoized children
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: list.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    scrollMargin: HEADER_HEIGHT,
    scrollPaddingStart: HEADER_HEIGHT,
    getItemKey: (i) => list[i].hash,
  })

  // Roving tabindex: one row is in the tab order, the one last focused, else the first selected, else the first.
  const [active, setActive] = useState<string | null>(null)
  const currentHash = useMemo(() => {
    if (active !== null && list.some((x) => x.hash === active)) return active
    return list.find((x) => selected.has(x.hash))?.hash ?? list[0]?.hash ?? null
  }, [list, selected, active])
  const wantFocus = useRef(false)
  const wantDetails = useRef(false)

  // After a keyboard move the target row may only now have been rendered: focus it once it exists.
  useEffect(() => {
    if (wantFocus.current && currentHash !== null) {
      const el = scroller.current?.querySelector<HTMLElement>(`[data-hash="${CSS.escape(currentHash)}"]`)
      if (el) {
        el.focus({ preventScroll: true })
        wantFocus.current = false
      }
    }
    if (wantDetails.current) {
      const el = document.querySelector<HTMLElement>('[data-details]')
      if (el) {
        el.focus()
        wantDetails.current = false
      }
    }
  })

  function moveTo(index: number, extend: boolean) {
    const hash = list[index].hash
    const order = list.map((x) => x.hash)
    useTorrents.getState().select(hash, extend ? 'range' : 'single', order)
    setActive(hash)
    wantFocus.current = true
    virtualizer.scrollToIndex(index, { align: 'auto' })
  }
  function step(delta: 1 | -1, extend: boolean) {
    if (list.length === 0) return
    const at = currentHash === null ? -1 : list.findIndex((x) => x.hash === currentHash)
    // nothing selected yet: the first press selects the current row instead of skipping it
    const next = selected.size === 0 ? Math.max(at, 0) : Math.min(list.length - 1, Math.max(0, at + delta))
    moveTo(next, extend)
  }
  function focusedHash(): string | null {
    const row = document.activeElement?.closest?.<HTMLElement>('[role="row"][data-hash]')
    return row?.dataset.hash ?? null
  }

  useHotkeys([
    { keys: ['ArrowDown'], run: (e) => step(1, e.shiftKey) },
    { keys: ['ArrowUp'], run: (e) => step(-1, e.shiftKey) },
    {
      keys: ['Enter'],
      run: () => {
        const hash = focusedHash() ?? currentHash
        if (hash === null) return
        const state = useTorrents.getState()
        if (state.selected.size === 1 && state.selected.has(hash)) {
          document.querySelector<HTMLElement>('[data-details]')?.focus()
          return
        }
        state.select(hash, 'single', list.map((x) => x.hash))
        wantDetails.current = true
      },
    },
    {
      keys: [' '],
      run: () => {
        const hashes = [...useTorrents.getState().selected]
        const focused = focusedHash()
        const target = hashes.length > 0 ? hashes : focused ? [focused] : []
        if (target.length > 0) void toggleTorrentsPause(target)
      },
    },
    {
      // Mac keyboards send Backspace for the key labelled "delete"
      keys: ['Delete', 'Backspace'],
      run: () => {
        const { selected: sel, torrents: all } = useTorrents.getState()
        const hashes = [...sel].filter((h) => h in all)
        if (hashes.length > 0) useDialogs.getState().openDelete(hashes)
      },
    },
  ])

  // One handler for all rows keeps the memoized rows untouched.
  function onClick(e: MouseEvent) {
    const hash = hashOf(e)
    if (!hash || (e.target as HTMLElement).closest('button')) return
    const order = list.map((x) => x.hash)
    useTorrents.getState().select(hash, e.shiftKey ? 'range' : e.ctrlKey || e.metaKey ? 'toggle' : 'single', order)
  }
  function onFocus(e: FocusEvent) {
    const hash = (e.target as HTMLElement).closest<HTMLElement>('[role="row"][data-hash]')?.dataset.hash
    if (hash) setActive(hash)
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
            onFocus={onFocus}
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
                  top={v.start - HEADER_HEIGHT}
                  selected={selected.has(tor.hash)}
                  tabbable={tor.hash === currentHash}
                />
              )
            })}
          </div>
        </div>
        {loaded && list.length === 0 && <EmptyState kind={total === 0 ? 'none' : 'noMatch'} />}
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} onClose={closeMenu} onDialog={onDialog} />}
    </div>
  )
}
