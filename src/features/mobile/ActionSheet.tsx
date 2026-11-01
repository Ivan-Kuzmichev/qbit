import { useEffect, useId, useRef, type ReactNode } from 'react'
import { t } from '../../i18n/ru'
import styles from './ActionSheet.module.css'

export interface ActionSheetItem {
  id: string
  label: string
  onSelect(): void
  icon?: ReactNode
  danger?: boolean
  /** Defined for choices: marks the current one. */
  checked?: boolean
}

export interface ActionSheetProps {
  title: string
  items: ActionSheetItem[]
  onClose(): void
}

const FOCUSABLE = 'button:not([disabled])'

/** Bottom sheet: closes by backdrop tap, Esc or "Отмена", and keeps focus inside while open. */
export function ActionSheet({ title, items, onClose }: ActionSheetProps) {
  const titleId = useId()
  const root = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const el = root.current!
    const focusables = () => [...el.querySelectorAll<HTMLElement>(FOCUSABLE)]
    ;(focusables()[0] ?? el).focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      } else if (e.key === 'Tab') {
        const list = focusables()
        if (list.length === 0) {
          e.preventDefault()
          return
        }
        const first = list[0]
        const last = list[list.length - 1]
        const active = document.activeElement
        if (!el.contains(active) || (e.shiftKey && active === first)) {
          e.preventDefault()
          ;(e.shiftKey ? last : first).focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [])

  return (
    <div
      className={styles.backdrop}
      data-testid="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div ref={root} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className={styles.grip} aria-hidden="true" />
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div className={styles.items}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.danger ? `${styles.item} ${styles.danger}` : styles.item}
              aria-pressed={item.checked}
              onClick={item.onSelect}
            >
              {item.icon}
              <span className={styles.label}>{item.label}</span>
            </button>
          ))}
        </div>
        <button type="button" className={styles.cancel} onClick={onClose}>
          {t.dialogs.cancel}
        </button>
      </div>
    </div>
  )
}
