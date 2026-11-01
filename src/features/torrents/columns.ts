import type { Torrent } from '../../api/types'
import { t } from '../../i18n/ru'
import type { OptionalColumn } from '../../store/ui'

export type ColumnId = 'name' | 'status' | 'progress' | 'speed' | 'size' | OptionalColumn

export interface Column {
  id: ColumnId
  /** Key stored in `useUi.sort`. */
  sortKey: string
  label: string
  width: string
  align?: 'right'
  /** Direction applied the first time the column is clicked. */
  firstDir: 'asc' | 'desc'
  optional?: boolean
}

const FIXED_BEFORE: Column[] = [
  { id: 'name', sortKey: 'name', label: t.table.name, width: 'minmax(0, 1fr)', firstDir: 'asc' },
  { id: 'status', sortKey: 'status', label: t.table.status, width: '140px', firstDir: 'asc' },
  { id: 'progress', sortKey: 'progress', label: t.table.progress, width: '220px', firstDir: 'desc' },
  { id: 'speed', sortKey: 'speed', label: t.table.speed, width: '110px', align: 'right', firstDir: 'desc' },
  { id: 'size', sortKey: 'size', label: t.table.size, width: '84px', align: 'right', firstDir: 'desc' },
]

export const OPTIONAL_COLUMNS: Column[] = [
  { id: 'queue', sortKey: 'queue', label: t.table.queue, width: '96px', align: 'right', firstDir: 'asc', optional: true },
  { id: 'ratio', sortKey: 'ratio', label: t.table.ratio, width: '72px', align: 'right', firstDir: 'desc', optional: true },
  { id: 'added', sortKey: 'added_on', label: t.table.added, width: '140px', align: 'right', firstDir: 'desc', optional: true },
]

export function visibleColumns(on: Record<OptionalColumn, boolean>): Column[] {
  return [...FIXED_BEFORE, ...OPTIONAL_COLUMNS.filter((c) => on[c.id as OptionalColumn])]
}

/** The first track is the 52px action column. */
export function gridTemplate(columns: Column[]): string {
  return `52px ${columns.map((c) => c.width).join(' ')}`
}

/** The speed shown in a row: download if there is any, otherwise upload. */
export function shownSpeed(tor: Torrent): { dir: 'down' | 'up' | null; value: number } {
  if (tor.dlspeed > 0) return { dir: 'down', value: tor.dlspeed }
  if (tor.upspeed > 0) return { dir: 'up', value: tor.upspeed }
  return { dir: null, value: 0 }
}
