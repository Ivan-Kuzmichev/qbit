import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useMemo, useRef } from 'react'
import { t } from '../../i18n/ru'
import { useTorrents } from '../../store/torrents'
import { useUi } from '../../store/ui'
import { gridTemplate, visibleColumns } from './columns'
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

export function TorrentTable() {
  useResetStaleFilter()
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

  return (
    <div className={styles.card}>
      <div ref={scroller} className={styles.scroller}>
        <div
          role="table"
          aria-label={t.table.label}
          aria-rowcount={list.length + 1}
          className={styles.table}
          style={{ minWidth: MIN_WIDTH }}
        >
          <TableHeader columns={columns} template={template} />
          <div role="rowgroup" className={styles.body} style={{ height: virtualizer.getTotalSize() }}>
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
    </div>
  )
}
