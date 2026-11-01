import { locale } from '../../i18n'
import type { Torrent } from '../../api/types'
import type { SortDir } from '../../store/ui'
import { matchesFilter, type Filter } from './filters'
import { shownSpeed } from './columns'
import { uiStatus } from './status'

const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })

const STATUS_ORDER = ['downloading', 'seeding', 'done', 'paused', 'queued', 'checking', 'moving', 'error']

function compare(a: Torrent, b: Torrent, key: string): number {
  switch (key) {
    case 'name':
      return collator.compare(a.name, b.name)
    case 'status':
      return STATUS_ORDER.indexOf(uiStatus(a).kind) - STATUS_ORDER.indexOf(uiStatus(b).kind)
    case 'progress':
      return a.progress - b.progress
    case 'speed':
      return shownSpeed(a).value - shownSpeed(b).value
    case 'size':
      return a.size - b.size
    case 'queue':
      return a.priority - b.priority
    case 'ratio':
      return a.ratio - b.ratio
    case 'added_on':
      return a.added_on - b.added_on
    default:
      return 0
  }
}

/** Ties go by hash in the same direction whatever `dir` is, so rows keep their place between syncs. */
export function sortTorrents(list: readonly Torrent[], sort: { key: string; dir: SortDir }): Torrent[] {
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    const c = compare(a, b, sort.key)
    // NaN-safe: a missing numeric field compares as equal
    if (c !== 0 && !Number.isNaN(c)) return c * sign
    return a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0
  })
}

export function selectVisible(
  state: { torrents: Record<string, Torrent> },
  ui: { filter: Filter; search: string; sort: { key: string; dir: SortDir } },
): Torrent[] {
  const needle = ui.search.trim().toLowerCase()
  const list = Object.values(state.torrents).filter(
    (x) => matchesFilter(x, ui.filter) && (needle === '' || x.name.toLowerCase().includes(needle)),
  )
  return sortTorrents(list, ui.sort)
}
