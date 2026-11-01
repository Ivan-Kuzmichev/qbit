import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { t } from '../../i18n/ru'
import { IconButton } from './IconButton'
import styles from './Dialog.module.css'

export interface DialogProps {
  title: string
  onClose(): void
  children: ReactNode
  /** Max width in px on desktop; defaults to 480. */
  width?: number
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Dialog({ title, onClose, children, width }: DialogProps) {
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
        const items = focusables()
        if (items.length === 0) {
          e.preventDefault()
          return
        }
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement
        if (!el.contains(active)) {
          e.preventDefault()
          first.focus()
        } else if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
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
      data-testid="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={root}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={width ? ({ '--dialog-w': `${width}px` } as React.CSSProperties) : undefined}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <IconButton aria-label={t.app.close} onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </IconButton>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}
