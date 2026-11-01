import { Gauge, Link, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Logo } from '../../components/ui/Logo'
import { t } from '../../i18n/ru'
import { formatSpeed } from '../../lib/format'
import { useRoute } from '../../lib/router'
import { useDialogs } from '../../store/dialogs'
import { useTorrents } from '../../store/torrents'
import { useUi } from '../../store/ui'
import { toggleAltLimits } from '../torrents/actions'
import { ALL_FILTER, countByFilter, filterKey, type Filter } from '../torrents/filters'
import styles from './MobileLayout.module.css'
import { MobileDetail } from './MobileDetail'
import { MobileList } from './MobileList'
import { MobileSettings } from './MobileSettings'

type StatusFilter = Extract<Filter, { type: 'status' }>['value']

const CHIPS: { value: StatusFilter; label: string; optional?: boolean }[] = [
  { value: 'all', label: t.sidebar.all },
  { value: 'downloading', label: t.sidebar.downloading },
  { value: 'seeding', label: t.sidebar.seeding },
  { value: 'done', label: t.sidebar.done },
  { value: 'paused', label: t.sidebar.paused },
  { value: 'queued', label: t.sidebar.queued, optional: true },
  { value: 'error', label: t.sidebar.error, optional: true },
]

function Header() {
  const torrents = useTorrents((s) => s.torrents)
  const server = useTorrents((s) => s.server)
  const filter = useUi((s) => s.filter)
  const setFilter = useUi((s) => s.setFilter)
  const search = useUi((s) => s.search)
  const setSearch = useUi((s) => s.setSearch)
  const counts = useMemo(() => countByFilter(Object.values(torrents)), [torrents])
  const alt = Boolean(server.use_alt_speed_limits)

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <span className={styles.logo}>
          <Logo size={16} />
        </span>
        <span className={styles.name}>{t.app.name}</span>
        <div className={styles.speeds}>
          <span className={styles.down}>↓ {formatSpeed(server.dl_info_speed ?? 0)}</span>
          <span>↑ {formatSpeed(server.up_info_speed ?? 0)}</span>
        </div>
        <button type="button" className={styles.alt} aria-label={t.mobile.altLimits} aria-pressed={alt} onClick={() => void toggleAltLimits()}>
          <Gauge size={17} aria-hidden="true" />
        </button>
      </div>
      <label className={styles.search}>
        <Search size={15} strokeWidth={2} aria-hidden="true" color="var(--muted)" />
        <input
          type="text"
          className={styles.input}
          placeholder={t.topbar.search}
          aria-label={t.topbar.searchLabel}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className={styles.chips} role="group" aria-label={t.mobile.filters}>
        {CHIPS.map(({ value, label, optional }) => {
          const f: Filter = { type: 'status', value }
          const count = counts[filterKey(f)] ?? 0
          const active = filter.type === 'status' && filter.value === value
          if (optional && count === 0 && !active) return null
          return (
            <button key={value} type="button" className={styles.chipHit} aria-pressed={active} onClick={() => setFilter(f)}>
              <span className={styles.chip}>
                {label}
                <span className={styles.count}>{count}</span>
              </span>
            </button>
          )
        })}
      </div>
    </header>
  )
}

function Footer() {
  const { navigate } = useRoute()
  return (
    <footer className={styles.footer}>
      <button type="button" className={styles.add} onClick={() => useDialogs.getState().openAdd('file')}>
        <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
        {t.topbar.addTorrent}
      </button>
      <button type="button" className={styles.square} aria-label={t.topbar.addMagnet} onClick={() => useDialogs.getState().openAdd('magnet')}>
        <Link size={16} aria-hidden="true" />
      </button>
      <button type="button" className={styles.square} aria-label={t.sidebar.settings} onClick={() => navigate('/settings')}>
        <SlidersHorizontal size={16} aria-hidden="true" />
      </button>
    </footer>
  )
}

export function MobileLayout() {
  const { path } = useRoute()
  // the filter can name a category or tag that has gone; chips only offer statuses
  const filter = useUi((s) => s.filter)
  const setFilter = useUi((s) => s.setFilter)
  useEffect(() => {
    if (filter.type !== 'status') setFilter(ALL_FILTER)
  }, [filter, setFilter])

  let body
  const torrent = /^\/torrent\/([^/]+)/.exec(path)
  if (torrent) {
    body = <MobileDetail hash={torrent[1]} />
  } else if (/^\/settings(\/|$)/.test(path)) {
    body = <MobileSettings />
  } else {
    body = (
      <>
        <Header />
        <MobileList />
        <Footer />
      </>
    )
  }
  return <main className={styles.layout}>{body}</main>
}
