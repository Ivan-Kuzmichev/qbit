import type { KeyboardEvent } from 'react'

/**
 * Arrow/Home/End navigation over a row of buttons. Returns the index to move to,
 * or null when the key is not a navigation key. Disabled entries are skipped.
 */
export function nextIndex(key: string, current: number, enabled: readonly boolean[], vertical = false): number | null {
  const n = enabled.length
  if (n === 0) return null
  const forward = key === 'ArrowRight' || (vertical && key === 'ArrowDown')
  const backward = key === 'ArrowLeft' || (vertical && key === 'ArrowUp')
  if (key === 'Home' || key === 'End') {
    const order = key === 'Home' ? [...enabled.keys()] : [...enabled.keys()].reverse()
    return order.find((i) => enabled[i]) ?? null
  }
  if (!forward && !backward) return null
  const step = forward ? 1 : -1
  for (let k = 1; k <= n; k++) {
    const i = (((current + step * k) % n) + n) % n
    if (enabled[i]) return i
  }
  return null
}

/** Moves focus to the sibling button at `index` inside the group of the event's current target. */
export function focusSibling(e: KeyboardEvent<HTMLElement>, index: number): void {
  const group = e.currentTarget.parentElement
  group?.querySelectorAll<HTMLElement>(':scope > button')[index]?.focus()
}
