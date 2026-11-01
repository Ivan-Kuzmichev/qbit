import {
  ArrowDown, ArrowUp, Check, ChevronDown, CircleAlert, Clock, Folder, List, Pause,
  SlidersHorizontal, Tag, type LucideIcon,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Logo } from '../../components/ui/Logo'
import { t } from '../../i18n'
import { useRoute } from '../../lib/router'
import { useTorrents } from '../../store/torrents'
import { useUi } from '../../store/ui'
import { countByFilter, filterKey, type Filter } from '../torrents/filters'
import { SpeedCard } from './SpeedCard'
import styles from './Sidebar.module.css'

const STATUS_ITEMS: { value: Extract<Filter, { type: 'status' }>['value']; label: string; Icon: LucideIcon; optional?: boolean }[] = [
  { value: 'all', label: t.sidebar.all, Icon: List },
  { value: 'downloading', label: t.sidebar.downloading, Icon: ArrowDown },
  { value: 'seeding', label: t.sidebar.seeding, Icon: ArrowUp },
  { value: 'done', label: t.sidebar.done, Icon: Check },
  { value: 'paused', label: t.sidebar.paused, Icon: Pause },
  { value: 'queued', label: t.sidebar.queued, Icon: Clock, optional: true },
  { value: 'error', label: t.sidebar.error, Icon: CircleAlert, optional: true },
]

function Item(props: { active: boolean; icon: ReactNode; label: string; count: number; onClick(): void }) {
  return (
    <button
      type="button"
      className={styles.item}
      aria-current={props.active ? 'true' : undefined}
      onClick={props.onClick}
    >
      <span className={styles.bar} />
      {props.icon}
      <span className={styles.label}>{props.label}</span>
      <span className={styles.count}>{props.count}</span>
    </button>
  )
}

function Group(props: { title: string; hasActive: boolean; children: ReactNode }) {
  // Collapsed by default, unless the current filter (kept across a re-login) would be hidden inside.
  const [open, setOpen] = useState(props.hasActive)
  return (
    <div className={styles.group}>
      <button type="button" className={styles.groupHead} aria-expanded={open} onClick={() => setOpen(!open)}>
        <ChevronDown size={13} aria-hidden="true" className={open ? undefined : styles.closed} />
        {props.title}
      </button>
      {open && <div className={styles.list}>{props.children}</div>}
    </div>
  )
}

export function Sidebar() {
  const torrents = useTorrents((s) => s.torrents)
  const categories = useTorrents((s) => s.categories)
  const tags = useTorrents((s) => s.tags)
  const filter = useUi((s) => s.filter)
  const setFilter = useUi((s) => s.setFilter)
  const { path, navigate } = useRoute()
  const onSettings = path.startsWith('/settings')

  const counts = useMemo(() => countByFilter(Object.values(torrents)), [torrents])
  const count = (f: Filter) => counts[filterKey(f)] ?? 0
  const pick = (f: Filter) => {
    setFilter(f)
    if (onSettings) navigate('/')
  }
  const isActive = (f: Filter) => !onSettings && filterKey(f) === filterKey(filter)
  const categoryNames = Object.keys(categories).sort((a, b) => a.localeCompare(b))

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.logo}>
          <Logo size={16} />
        </span>
        <span className={styles.name}>{t.app.name}</span>
      </div>

      <nav className={styles.nav} aria-label={t.sidebar.filters}>
        {STATUS_ITEMS.map(({ value, label, Icon, optional }) => {
          const f: Filter = { type: 'status', value }
          if (optional && count(f) === 0) return null
          return (
            <Item key={value} active={isActive(f)} icon={<Icon size={15} aria-hidden="true" />} label={label} count={count(f)} onClick={() => pick(f)} />
          )
        })}

        {categoryNames.length > 0 && (
          <Group title={t.sidebar.categories} hasActive={filter.type === 'category'}>
            {categoryNames.map((name) => {
              const f: Filter = { type: 'category', value: name }
              return <Item key={name} active={isActive(f)} icon={<Folder size={15} aria-hidden="true" />} label={name} count={count(f)} onClick={() => pick(f)} />
            })}
          </Group>
        )}
        {tags.length > 0 && (
          <Group title={t.sidebar.tags} hasActive={filter.type === 'tag'}>
            {tags.map((name) => {
              const f: Filter = { type: 'tag', value: name }
              return <Item key={name} active={isActive(f)} icon={<Tag size={15} aria-hidden="true" />} label={name} count={count(f)} onClick={() => pick(f)} />
            })}
          </Group>
        )}
      </nav>

      <div className={styles.bottom}>
        <SpeedCard />
        <button
          type="button"
          className={styles.item}
          aria-current={onSettings ? 'page' : undefined}
          onClick={() => navigate('/settings')}
        >
          <span className={styles.bar} />
          <SlidersHorizontal size={15} aria-hidden="true" />
          <span className={styles.label}>{t.sidebar.settings}</span>
        </button>
      </div>
    </aside>
  )
}
