import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { t } from '../../i18n'
import { IconButton } from './IconButton'
import styles from './Dialog.module.css'

export interface DialogProps {
  title: string
  onClose(): void
  children: ReactNode
  /** Max width in px on desktop; defaults to 480. */
  width?: number
  /** Min height in px on desktop: the dialog does not jump when its content changes. */
  minHeight?: number
  /** Beside the title, in the danger colour. */
  icon?: ReactNode
  /** Under the title. */
  description?: ReactNode
  /** Without the X, for a dialog whose actions already include a way out. */
  hideClose?: boolean
  /** Hangs from a fixed line on desktop instead of the centre: a dialog whose height changes does not jump. */
  anchorTop?: boolean
  /** Pinned under the scrolling content. */
  footer?: ReactNode
  /** `line`: a rule above it. `plain`: no rule, a little more air. `sheet`: a rule and room for the thumb. */
  footerKind?: 'line' | 'plain' | 'sheet'
}

/** Mounted dialogs, oldest first; only the last one handles Escape and Tab. */
const openDialogs: object[] = []

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The last element the pointer went down on. Safari does not focus a button on click, so
 * `document.activeElement` can be <body> when a dialog opens; this is the fallback opener.
 */
let lastPressed: HTMLElement | null = null
if (typeof document !== 'undefined') {
  document.addEventListener(
    'mousedown',
    (e) => {
      lastPressed = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('button, a[href], [role="button"], [tabindex]') ?? null
    },
    true,
  )
}

function findOpener(): HTMLElement | null {
  const active = document.activeElement as HTMLElement | null
  if (active && active !== document.body) return active
  return lastPressed?.isConnected ? lastPressed : null
}

export function Dialog({ title, onClose, children, width, minHeight, icon, description, hideClose, anchorTop, footer, footerKind = 'line' }: DialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const root = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const opener = findOpener()
    const el = root.current!
    const focusables = () => [...el.querySelectorAll<HTMLElement>(FOCUSABLE)]
    // The first control of the content, not the close button in the header.
    const first = body.current?.querySelector<HTMLElement>(FOCUSABLE) ?? focusables()[0] ?? el
    first.focus()

    const token = {}
    function onKey(e: KeyboardEvent) {
      // only the topmost dialog reacts to the keyboard
      if (openDialogs[openDialogs.length - 1] !== token) return
      if (e.key === 'Escape') {
        // something inside (an open menu) already used this Escape
        if (e.defaultPrevented) return
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
    openDialogs.push(token)
    document.addEventListener('keydown', onKey)
    return () => {
      openDialogs.splice(openDialogs.indexOf(token), 1)
      document.removeEventListener('keydown', onKey)
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  return (
    <div
      className={styles.backdrop}
      data-testid="dialog-backdrop"
      data-anchor={anchorTop ? 'top' : undefined}
      onMouseDown={(e) => {
        if (e.button === 0 && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={root}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        style={
          {
            ...(width ? { '--dialog-w': `${width}px` } : {}),
            ...(minHeight ? { '--dialog-min-h': `${minHeight}px` } : {}),
          } as React.CSSProperties
        }
      >
        <header className={`${styles.header} ${icon ? styles.withIcon : ''}`}>
          {icon && <div className={styles.icon}>{icon}</div>}
          <div className={styles.heading}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {description && (
              <span id={descriptionId} className={styles.description} title={typeof description === 'string' && !icon ? description : undefined}>
                {description}
              </span>
            )}
          </div>
          {!hideClose && (
            <IconButton aria-label={t.app.close} onClick={onClose}>
              <X size={16} aria-hidden="true" />
            </IconButton>
          )}
        </header>
        <div ref={body} className={styles.body} data-has-footer={footer ? true : undefined}>
          {children}
        </div>
        {footer && (
          <div className={styles.footer} data-kind={footerKind}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
