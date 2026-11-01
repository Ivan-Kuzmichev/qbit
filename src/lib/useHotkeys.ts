import { useEffect, useRef } from 'react'
import { useDialogs } from '../store/dialogs'

export interface Hotkey {
  /** `KeyboardEvent.key` values; several keys can share one handler (Delete and Backspace). */
  keys: readonly string[]
  run(e: KeyboardEvent): void
  /**
   * By default a key acts only when focus is on the page body or on a grid row, so Space and
   * Enter keep their native meaning on a focused button. `anywhere` also allows other focus targets.
   */
  anywhere?: boolean
  /** Physical keys (`KeyboardEvent.code`) that also trigger it: `/` arrives as `.` on the Russian layout. */
  codes?: readonly string[]
  /** Ignore auto-repeat while the key is held. */
  noRepeat?: boolean
}

function isTyping(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

const isIdle = (el: Element | null) => !el || el === document.body || el === document.documentElement || el.getAttribute('role') === 'row'

/**
 * A dialog is open (ours, or any modal in the page) or a menu popup is showing: only Escape works then,
 * and the dialog or menu handles that itself.
 */
const dialogOpen = () =>
  useDialogs.getState().open !== null || document.querySelector('[role="dialog"][aria-modal="true"], [role="menu"]') !== null

/** Page-level keyboard shortcuts. Handlers are read at event time, so they may change on every render. */
export function useHotkeys(bindings: readonly Hotkey[]): void {
  const latest = useRef(bindings)
  useEffect(() => {
    latest.current = bindings
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
      const hit = latest.current.find((b) => b.keys.includes(e.key) || (b.codes?.includes(e.code) ?? false))
      if (!hit) return
      const active = document.activeElement
      if (isTyping(active) || dialogOpen()) return
      if (!hit.anywhere && !isIdle(active)) return
      e.preventDefault()
      if (hit.noRepeat && e.repeat) return
      hit.run(e)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
}
