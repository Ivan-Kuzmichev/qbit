import { Check, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../components/ui/Toast'
import { t } from '../../i18n/ru'
import { copyText } from '../../lib/copyText'
import { useTorrents } from '../../store/torrents'
import { runTorrentAction } from './actions'
import styles from './ContextMenu.module.css'
import { uiStatus } from './status'

export type DialogKind = 'limits' | 'move' | 'delete'
type Sub = 'category' | 'tags' | 'queue'

export interface ContextMenuProps {
  x: number
  y: number
  onClose(): void
  /** Opens a dialog for the targets; the dialogs themselves live outside the table. */
  onDialog?(kind: DialogKind, hashes: string[]): void
}

const EDGE = 8
const SUB_WIDTH = 208

const splitTags = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

interface Entry {
  id: string
  label: string
  onSelect(): void
  sub?: Sub
  /** Defined for toggles. */
  checked?: boolean
  danger?: boolean
  separatorBefore?: boolean
}

export function ContextMenu({ x, y, onClose, onDialog }: ContextMenuProps) {
  const torrents = useTorrents((s) => s.torrents)
  const selected = useTorrents((s) => s.selected)
  const categories = useTorrents((s) => s.categories)
  const allTags = useTorrents((s) => s.tags)
  const root = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y, flip: false })
  const [sub, setSub] = useState<Sub | null>(null)
  const [shift, setShift] = useState<{ sub: Sub; by: number } | null>(null)
  /** Where focus was when the menu opened (the row); it goes back there when the menu closes from the keyboard. */
  const [opener] = useState(() => document.activeElement as HTMLElement | null)
  const restoreFocus = useCallback(() => {
    if (opener?.isConnected) opener.focus({ preventScroll: true })
  }, [opener])
  /** Closes the menu and puts focus back first, so a dialog opened next remembers the row as its opener. */
  const finish = useCallback(() => {
    restoreFocus()
    onClose()
  }, [restoreFocus, onClose])

  const targets = useMemo(() => [...selected].filter((h) => h in torrents).map((h) => torrents[h]), [selected, torrents])
  const hashes = targets.map((x) => x.hash)

  useLayoutEffect(() => {
    const r = root.current?.getBoundingClientRect()
    const w = r?.width ?? 0
    const h = r?.height ?? 0
    setPos({
      left: Math.max(EDGE, Math.min(x, window.innerWidth - w - EDGE)),
      top: Math.max(EDGE, Math.min(y, window.innerHeight - h - EDGE)),
      flip: x + w + SUB_WIDTH > window.innerWidth,
    })
  }, [x, y])

  // Nothing left to act on (the torrent was removed elsewhere): drop the menu.
  const empty = targets.length === 0
  useEffect(() => {
    if (empty) onClose()
  }, [empty, onClose])

  useEffect(() => {
    root.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus()
  }, [])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'Tab') {
        // Capture phase + stop: nothing else (a dialog, the hotkeys) may also act on this Escape.
        if (e.key === 'Escape') e.stopPropagation()
        e.preventDefault()
        finish()
        return
      }
      const active = document.activeElement as HTMLElement | null
      const menu = active?.closest<HTMLElement>('[role="menu"]')
      if (!menu || !root.current?.contains(menu)) return
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = [...menu.querySelectorAll<HTMLElement>(':scope > [role^="menuitem"], :scope > [role="none"] > [role^="menuitem"]')]
        const step = e.key === 'ArrowDown' ? 1 : -1
        items[(items.indexOf(active!) + step + items.length) % items.length]?.focus()
      } else if (e.key === 'ArrowRight' && active?.getAttribute('aria-haspopup')) {
        e.preventDefault()
        active.click()
      } else if (e.key === 'ArrowLeft' && menu !== root.current) {
        e.preventDefault()
        setSub(null)
        root.current?.querySelector<HTMLElement>('[aria-expanded="true"]')?.focus()
      }
    }
    // Scrolling inside the menu itself (a long submenu) must not dismiss it.
    function onScroll(e: Event) {
      if (!(e.target instanceof Node && root.current?.contains(e.target))) onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onClose)
    window.addEventListener('blur', onClose)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('blur', onClose)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [onClose, finish])

  // Keyboard and click open a submenu with focus inside it; hovering only shows it.
  const [focusTick, setFocusTick] = useState(0)
  useEffect(() => {
    if (focusTick > 0) root.current?.querySelector<HTMLElement>('[data-submenu] [role^="menuitem"]')?.focus()
  }, [focusTick])

  // A submenu that would run off the bottom of the window is pulled up.
  useLayoutEffect(() => {
    const el = root.current?.querySelector<HTMLElement>('[data-submenu]')
    if (!el || !sub) {
      // a closed submenu forgets its shift, so reopening it is measured from its natural position
      setShift(null)
      return
    }
    const r = el.getBoundingClientRect()
    const overflow = r.bottom - (window.innerHeight - EDGE)
    setShift({ sub, by: overflow > 0 ? Math.max(0, Math.min(overflow, r.top - EDGE)) : 0 })
  }, [sub])
  const subShift = shift && shift.sub === sub ? shift.by : 0

  if (empty) return null

  const openSub = (kind: Sub) => {
    setSub(kind)
    setFocusTick((n) => n + 1)
  }
  const act = (path: string, ids = hashes, extra = {}) => () => {
    finish()
    void runTorrentAction(path, ids, extra)
  }
  const dialog = (kind: DialogKind) => () => {
    finish()
    onDialog?.(kind, hashes)
  }
  const allPaused = targets.every((x) => uiStatus(x).action === 'start')
  const allHave = (pick: (x: (typeof targets)[number]) => boolean) => targets.every(pick)
  /** Toggle endpoints flip each torrent, so send only those that are not in the target state yet. */
  const toggle = (path: string, on: boolean, pick: (x: (typeof targets)[number]) => boolean) => () => {
    finish()
    void runTorrentAction(path, targets.filter((x) => pick(x) === on).map((x) => x.hash))
  }
  const seqOn = allHave((x) => x.seq_dl)
  const flOn = allHave((x) => x.f_l_piece_prio)

  const entries: Entry[] = [
    allPaused
      ? { id: 'start', label: t.menu.start, onSelect: act('torrents/start') }
      : { id: 'stop', label: t.menu.pause, onSelect: act('torrents/stop') },
    { id: 'force', label: t.menu.forceStart, onSelect: act('torrents/setForceStart', hashes, { value: true }) },
    { id: 'limits', label: t.menu.limits, onSelect: dialog('limits') },
    { id: 'category', label: t.menu.category, sub: 'category', onSelect: () => openSub('category') },
    { id: 'tags', label: t.menu.tags, sub: 'tags', onSelect: () => openSub('tags') },
    { id: 'queue', label: t.menu.queue, sub: 'queue', onSelect: () => openSub('queue') },
    { id: 'seq', label: t.menu.sequential, checked: seqOn, onSelect: toggle('torrents/toggleSequentialDownload', seqOn, (x) => x.seq_dl), separatorBefore: true },
    { id: 'fl', label: t.menu.firstLast, checked: flOn, onSelect: toggle('torrents/toggleFirstLastPiecePrio', flOn, (x) => x.f_l_piece_prio) },
    { id: 'move', label: t.menu.move, onSelect: dialog('move'), separatorBefore: true },
    { id: 'recheck', label: t.menu.recheck, onSelect: act('torrents/recheck') },
    { id: 'reannounce', label: t.menu.reannounce, onSelect: act('torrents/reannounce') },
    {
      id: 'magnet',
      label: t.menu.copyMagnet,
      onSelect: () => {
        finish()
        const links = targets.map((x) => x.magnet_uri).filter(Boolean)
        if (links.length === 0) {
          toast(t.actions.magnetFailed)
          return
        }
        void copyText(links.join('\n')).then((ok) => toast(ok ? t.actions.magnetCopied : t.actions.magnetFailed))
      },
    },
    { id: 'remove', label: t.menu.remove, onSelect: dialog('delete'), danger: true, separatorBefore: true },
  ]

  const subEntries = (kind: Sub): Entry[] => {
    switch (kind) {
      case 'queue':
        return [
          ['up', t.menu.queueUp, 'increasePrio'],
          ['down', t.menu.queueDown, 'decreasePrio'],
          ['top', t.menu.queueTop, 'topPrio'],
          ['bottom', t.menu.queueBottom, 'bottomPrio'],
        ].map(([id, label, path]) => ({ id, label, onSelect: act(`torrents/${path}`) }))
      case 'category': {
        const common = targets.every((x) => x.category === targets[0].category) ? targets[0].category : null
        return [
          { id: '', label: t.menu.noCategory, checked: common === '', onSelect: act('torrents/setCategory', hashes, { category: '' }) },
          ...Object.keys(categories).sort((a, b) => a.localeCompare(b, 'ru')).map((name) => ({
            id: name,
            label: name,
            checked: common === name,
            onSelect: act('torrents/setCategory', hashes, { category: name }),
          })),
        ]
      }
      case 'tags':
        return allTags.map((tag) => {
          const on = allHave((x) => splitTags(x.tags).includes(tag))
          return { id: tag, label: tag, checked: on, onSelect: act(on ? 'torrents/removeTags' : 'torrents/addTags', hashes, { tags: tag }) }
        })
    }
  }

  const tick = (on: boolean | undefined) => (
    <span className={styles.tick}>{on && <Check size={14} aria-hidden="true" />}</span>
  )

  return (
    <div
      ref={root}
      role="menu"
      data-root
      aria-label={t.menu.label}
      className={styles.menu}
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {entries.map((e) => (
        <div key={e.id} role="none" className={styles.wrap}>
          {e.separatorBefore && <div role="separator" className={styles.sep} />}
          <button
            type="button"
            role={e.checked !== undefined && !e.sub ? 'menuitemcheckbox' : 'menuitem'}
            aria-checked={e.sub ? undefined : e.checked}
            aria-haspopup={e.sub ? 'menu' : undefined}
            aria-expanded={e.sub ? sub === e.sub : undefined}
            className={e.danger ? `${styles.item} ${styles.danger}` : styles.item}
            onClick={e.onSelect}
            onMouseEnter={() => e.sub ? setSub(e.sub) : setSub(null)}
          >
            {e.checked !== undefined && !e.sub && tick(e.checked)}
            <span className={styles.label}>{e.label}</span>
            {e.sub && <ChevronRight size={14} aria-hidden="true" />}
          </button>
          {e.sub && sub === e.sub && (
            <div role="menu" data-submenu aria-label={e.label} style={subShift ? { top: -5 - subShift } : undefined} className={pos.flip ? `${styles.sub} ${styles.flip}` : styles.sub}>
              {subEntries(e.sub).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role={s.checked !== undefined && e.sub === 'tags' ? 'menuitemcheckbox' : 'menuitem'}
                  aria-checked={e.sub === 'tags' ? s.checked : undefined}
                  className={styles.item}
                  onClick={s.onSelect}
                >
                  {s.checked !== undefined && tick(s.checked)}
                  <span className={styles.label}>{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
