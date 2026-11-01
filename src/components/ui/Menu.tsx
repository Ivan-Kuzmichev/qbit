import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './Menu.module.css'

export interface MenuItem {
  id: string
  label: string
  icon?: ReactNode
  danger?: boolean
  onSelect(): void
}

export interface MenuProps {
  items: readonly MenuItem[]
  /** Accessible name of the trigger button. */
  label: string
  /** Extra class for the trigger, to restyle it as a field-like button. */
  triggerClassName?: string
  /** Render the popup in `document.body`, positioned from the trigger, so no scroll container or stacking context can clip it. */
  portal?: boolean
  children: ReactNode
}

export function Menu({ items, label, triggerClassName, portal, children }: MenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const popup = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<CSSProperties | null>(null)

  // Portal mode: place the popup under the trigger, or above it when it would run off the window.
  useLayoutEffect(() => {
    if (!portal || !open || !trigger.current || !popup.current) return
    const r = trigger.current.getBoundingClientRect()
    const h = popup.current.offsetHeight
    const flip = r.bottom + 4 + h > window.innerHeight && r.top - 4 - h >= 0
    setPos({
      position: 'fixed',
      right: window.innerWidth - r.right,
      top: flip ? r.top - 4 - h : r.bottom + 4,
    })
  }, [portal, open])

  useEffect(() => {
    if (!open) return
    ;(popup.current ?? root.current)?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (!root.current?.contains(t) && !popup.current?.contains(t)) setOpen(false)
    }
    const close = () => setOpen(false)
    function onScroll(e: Event) {
      if (!(e.target instanceof Node && popup.current?.contains(e.target))) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const els = [...(popup.current ?? root.current!).querySelectorAll<HTMLElement>('[role="menuitem"]')]
        const i = els.indexOf(document.activeElement as HTMLElement)
        const step = e.key === 'ArrowDown' ? 1 : -1
        els[(i + step + els.length) % els.length]?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    if (portal) {
      window.addEventListener('scroll', onScroll, true)
      window.addEventListener('resize', close)
    }
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, portal])

  const popupEl = open ? (
    <div
      ref={popup}
      id={menuId}
      role="menu"
      aria-label={label}
      className={styles.menu}
      style={portal ? (pos ?? { position: 'fixed', opacity: 0, top: 0, left: 0 }) : undefined}
    >
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="menuitem"
          className={it.danger ? `${styles.item} ${styles.danger}` : styles.item}
          onClick={() => {
            setOpen(false)
            it.onSelect()
          }}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  ) : null

  return (
    <div ref={root} className={styles.root}>
      <button
        ref={trigger}
        type="button"
        className={triggerClassName ? `${styles.trigger} ${triggerClassName}` : styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {children}
      </button>
      {portal && popupEl ? createPortal(popupEl, document.body) : popupEl}
    </div>
  )
}
