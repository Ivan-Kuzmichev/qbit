import { Link, Pause, Play, Plus, Search } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '../../components/ui/Button'
import { t } from '../../i18n/ru'
import { useTorrents } from '../../store/torrents'
import { useUi } from '../../store/ui'
import { pauseAllLabel, runBulkPause } from './actions'
import styles from './TopBar.module.css'

function isTyping(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

export function TopBar() {
  const search = useUi((s) => s.search)
  const setSearch = useUi((s) => s.setSearch)
  const torrents = useTorrents((s) => s.torrents)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || isTyping(document.activeElement)) return
      e.preventDefault()
      input.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const selected = useTorrents((s) => s.selected)
  const all = Object.values(torrents)
  const scope = selected.size > 0 ? all.filter((x) => selected.has(x.hash)) : all
  const allPaused = pauseAllLabel(scope) === 'start'

  return (
    <div className={styles.bar}>
      <label className={styles.search}>
        <Search size={15} strokeWidth={2} aria-hidden="true" color="var(--muted)" />
        <input
          ref={input}
          type="text"
          className={styles.input}
          placeholder={t.topbar.search}
          aria-label={t.topbar.searchLabel}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <Button variant="primary">
        <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
        {t.topbar.addTorrent}
      </Button>
      <Button>
        <Link size={15} aria-hidden="true" />
        {t.topbar.addMagnet}
      </Button>
      <Button disabled={all.length === 0} onClick={() => void runBulkPause(allPaused ? 'start' : 'stop')}>
        {allPaused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
        {allPaused ? t.topbar.resumeAll : t.topbar.pauseAll}
      </Button>
    </div>
  )
}
