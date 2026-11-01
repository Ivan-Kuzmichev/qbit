import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
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
  children: ReactNode
}

export function Menu({ items, label, children }: MenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    function onDown(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const els = [...root.current!.querySelectorAll<HTMLElement>('[role="menuitem"]')]
        const i = els.indexOf(document.activeElement as HTMLElement)
        const step = e.key === 'ArrowDown' ? 1 : -1
        els[(i + step + els.length) % els.length]?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className={styles.root}>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {children}
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={label} className={styles.menu}>
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
      )}
    </div>
  )
}
