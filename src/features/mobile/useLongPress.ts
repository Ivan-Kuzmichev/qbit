import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from 'react'

/** A finger that drifts further than this is scrolling, not holding. */
const MOVE_TOLERANCE = 10

export interface LongPressHandlers {
  onPointerDown(e: PointerEvent): void
  onPointerMove(e: PointerEvent): void
  onPointerUp(): void
  onPointerCancel(): void
  onClickCapture(e: MouseEvent): void
  onContextMenu(e: MouseEvent): void
}

/**
 * Spread the result on an element. `cb` receives the element the finger went down on, so one
 * handler can serve a whole list. After a long press the click that follows the release is swallowed.
 */
export function useLongPress(cb: (target: EventTarget | null) => void, ms = 500): LongPressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const origin = useRef({ x: 0, y: 0 })
  const fired = useRef(false)
  const cbRef = useRef(cb)
  useEffect(() => {
    cbRef.current = cb
  })

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }, [])
  useEffect(() => cancel, [cancel])

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      if (e.button !== undefined && e.button > 0) return
      cancel()
      fired.current = false
      origin.current = { x: e.clientX, y: e.clientY }
      const target = e.target
      timer.current = setTimeout(() => {
        timer.current = null
        fired.current = true
        cbRef.current(target)
      }, ms)
    },
    [cancel, ms],
  )

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (timer.current === null) return
      if (Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > MOVE_TOLERANCE) cancel()
    },
    [cancel],
  )

  const onClickCapture = useCallback((e: MouseEvent) => {
    if (!fired.current) return
    fired.current = false
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // iOS and Android raise a context menu on a long press; the action sheet replaces it
  const onContextMenu = useCallback((e: MouseEvent) => e.preventDefault(), [])

  return { onPointerDown, onPointerMove, onPointerUp: cancel, onPointerCancel: cancel, onClickCapture, onContextMenu }
}
