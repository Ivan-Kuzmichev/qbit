import { useSyncExternalStore } from 'react'
import styles from './Toast.module.css'

interface Item {
  id: number
  message: string
}

const MAX_VISIBLE = 3
const LIFETIME_MS = 4000

let items: Item[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((l) => l())
}

/** Shows a short message. An identical message already on screen is not repeated. */
export function toast(message: string): void {
  if (items.some((i) => i.message === message)) return
  const id = nextId++
  items = [...items, { id, message }].slice(-MAX_VISIBLE)
  emit()
  setTimeout(() => {
    items = items.filter((i) => i.id !== id)
    emit()
  }, LIFETIME_MS)
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function ToastHost() {
  const list = useSyncExternalStore(subscribe, () => items)
  return (
    <div className={styles.host} aria-live="polite">
      {list.map((i) => (
        <div key={i.id} className={styles.toast}>
          {i.message}
        </div>
      ))}
    </div>
  )
}
